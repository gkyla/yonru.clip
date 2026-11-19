from abc import ABC, abstractmethod
import copy
import json
import os
import tempfile
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


ACTIVE_JOB_STATUSES: frozenset[str] = frozenset({
    "queued",
    "pending",
    "checking_transcript",
    "downloading",
    "downloading_video",
    "processing",
    "extracting_audio",
    "generating_hooks",
    "cutting",
    "transcribing",
    "tracking_face",
})

ACTIVE_CLIP_JOB_STATUSES: frozenset[str] = frozenset({
    "cutting",
    "transcribing",
    "queued",
})

DEFAULT_MAX_AGE_SECONDS: float = 7 * 24 * 60 * 60
DEFAULT_MAX_COMPLETED_JOBS: int = 100


def _normalized_status(job: dict) -> str:
    return str(job.get("status") or "").strip().lower()


def _extract_video_id_from_folder(folder_name: str) -> Optional[str]:
    if len(folder_name) >= 12 and folder_name[-12] == "_":
        return folder_name[-11:]
    return None


def _job_matches_source(job: dict, folder_name: str, target_video_id: Optional[str]) -> bool:
    if job.get("folder_name") == folder_name:
        return True

    clip = job.get("clip")
    if isinstance(clip, dict) and clip.get("folder_name") == folder_name:
        return True

    video_info = job.get("video_info")
    if isinstance(video_info, dict):
        if video_info.get("folder_name") == folder_name:
            return True
        file_path = video_info.get("file_path")
        if isinstance(file_path, str) and file_path:
            if os.path.basename(os.path.dirname(file_path)) == folder_name:
                return True

    clip_path = job.get("clip_path")
    if isinstance(clip_path, str) and clip_path:
        if os.path.basename(os.path.dirname(os.path.dirname(clip_path))) == folder_name:
            return True

    if target_video_id is not None:
        url = job.get("url")
        if isinstance(url, str) and target_video_id in url:
            return True

    return False


def _job_timestamp(job: dict) -> float:
    for key in ("updated_at", "created_at"):
        val = job.get(key)
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            return float(val)
    return 0.0


class JobStore(ABC):
    """Deep job store owning single-job persistence, active-job queries, source scoping, and retention."""

    def __init__(
        self,
        *,
        max_age_seconds: Optional[float] = None,
        max_completed_jobs: Optional[int] = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.lock = threading.Lock()
        self._jobs: Dict[str, dict] = {}
        self._clock = clock
        self._max_age_seconds = max_age_seconds
        self._max_completed_jobs = max_completed_jobs

    def _validate_job_id(self, job_id: str) -> None:
        """Hook for adapters to enforce job_id invariants before mutating state."""
        return None

    @abstractmethod
    def _persist_job(self, job_id: str, data: dict) -> None:
        """Persist a single job entry to the underlying backend."""
        pass

    @abstractmethod
    def _remove_job_file(self, job_id: str) -> None:
        """Remove a single job entry from the underlying backend."""
        pass

    def _default_job_skeleton(self, job_id: str, now: float) -> dict:
        return {
            "job_id": job_id,
            "status": "pending",
            "video_info": None,
            "full_video_path": None,
            "hooks": [],
            "error": None,
            "created_at": now,
            "updated_at": now,
        }

    def _prune_locked(self, now: float) -> int:
        if self._max_age_seconds is None and self._max_completed_jobs is None:
            return 0

        to_delete: Set[str] = set()
        surviving_terminal: List[Tuple[str, dict]] = []

        for job_id, job in self._jobs.items():
            if isinstance(job, dict) and _normalized_status(job) in ACTIVE_JOB_STATUSES:
                continue
            if (
                self._max_age_seconds is not None
                and isinstance(job, dict)
                and (now - _job_timestamp(job)) > self._max_age_seconds
            ):
                to_delete.add(job_id)
            else:
                surviving_terminal.append((job_id, job if isinstance(job, dict) else {}))

        if self._max_completed_jobs is not None:
            cap = max(0, self._max_completed_jobs)
            if len(surviving_terminal) > cap:
                ordered = sorted(surviving_terminal, key=lambda item: _job_timestamp(item[1]))
                overflow = len(surviving_terminal) - cap
                for job_id, _ in ordered[:overflow]:
                    to_delete.add(job_id)

        for job_id in to_delete:
            self._jobs.pop(job_id, None)
            self._remove_job_file(job_id)

        return len(to_delete)

    def _maybe_prune_cap_locked(self, now: float) -> None:
        if self._max_completed_jobs is None:
            return
        terminal_count = sum(
            1
            for job in self._jobs.values()
            if not isinstance(job, dict) or _normalized_status(job) not in ACTIVE_JOB_STATUSES
        )
        if terminal_count > max(0, self._max_completed_jobs):
            self._prune_locked(now)

    def create_job(self, job_id: str, initial_data: dict) -> dict:
        """Create or replace a job thread-safely and persist that single job."""
        self._validate_job_id(job_id)
        with self.lock:
            now = float(self._clock())
            data = self._default_job_skeleton(job_id, now)
            payload = copy.deepcopy(initial_data)
            data.update(payload)
            data["job_id"] = job_id
            if not isinstance(data.get("created_at"), (int, float)) or isinstance(data.get("created_at"), bool):
                data["created_at"] = now
            data["updated_at"] = now
            self._jobs[job_id] = data
            self._persist_job(job_id, data)
            self._maybe_prune_cap_locked(now)
            return copy.deepcopy(data)

    def get_job(self, job_id: str) -> Optional[dict]:
        """Retrieve a defensive copy of a job thread-safely without touching disk."""
        with self.lock:
            job = self._jobs.get(job_id)
            return copy.deepcopy(job) if job is not None else None

    def update_job(self, job_id: str, **kwargs: Any) -> dict:
        """Atomically update specific keys of a job and persist only that job."""
        self._validate_job_id(job_id)
        with self.lock:
            now = float(self._clock())
            existing = self._jobs.get(job_id)
            if existing is None:
                data = self._default_job_skeleton(job_id, now)
            else:
                data = existing
            data.update(copy.deepcopy(kwargs))
            data["job_id"] = job_id
            if not isinstance(data.get("created_at"), (int, float)) or isinstance(data.get("created_at"), bool):
                data["created_at"] = now
            data["updated_at"] = now
            self._jobs[job_id] = data
            self._persist_job(job_id, data)
            self._maybe_prune_cap_locked(now)
            return copy.deepcopy(data)

    def set_download_progress(self, job_id: str, percent: float) -> None:
        """Update ephemeral download progress in memory only (zero disk writes)."""
        self._validate_job_id(job_id)
        with self.lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["download_percent"] = round(float(percent), 1)
            job["updated_at"] = float(self._clock())

    def delete_job(self, job_id: str) -> None:
        """Delete a single job from memory and storage thread-safely."""
        with self.lock:
            self._jobs.pop(job_id, None)
            self._remove_job_file(job_id)

    def list_all_jobs(self) -> Dict[str, dict]:
        """Return defensive copies of all cached jobs without touching disk."""
        with self.lock:
            return copy.deepcopy(self._jobs)

    def list_active_jobs(self) -> List[Dict[str, str]]:
        """List all jobs currently in an active pipeline state."""
        with self.lock:
            active: List[Dict[str, str]] = []
            for job_id, job in self._jobs.items():
                if not isinstance(job, dict):
                    continue
                status = _normalized_status(job)
                if status in ACTIVE_JOB_STATUSES:
                    active.append({"job_id": str(job_id), "status": status})
            return active

    def list_active_clip_ids(self) -> Set[str]:
        """Return clip IDs currently undergoing cutting, transcribing, or queued."""
        with self.lock:
            clip_ids: Set[str] = set()
            for job in self._jobs.values():
                if not isinstance(job, dict):
                    continue
                if _normalized_status(job) in ACTIVE_CLIP_JOB_STATUSES:
                    clip = job.get("clip")
                    c_id = job.get("clip_id") or (clip.get("clip_id") if isinstance(clip, dict) else None)
                    if isinstance(c_id, str) and c_id:
                        clip_ids.add(c_id)
            return clip_ids

    def cancel_source_jobs(
        self,
        folder_name: str,
        *,
        reason: str = "Source video deleted by user.",
        active_only: bool = True,
    ) -> int:
        """Cancel jobs belonging to a source folder and persist only changed jobs."""
        if not folder_name:
            return 0
        target_video_id = _extract_video_id_from_folder(folder_name)
        with self.lock:
            now = float(self._clock())
            cancelled = 0
            for job_id, job in self._jobs.items():
                if not isinstance(job, dict):
                    continue
                if not _job_matches_source(job, folder_name, target_video_id):
                    continue
                if active_only and _normalized_status(job) not in ACTIVE_JOB_STATUSES:
                    continue
                if _normalized_status(job) == "cancelled" and job.get("error") == reason:
                    continue
                job["status"] = "cancelled"
                job["error"] = reason
                job["updated_at"] = now
                self._persist_job(job_id, job)
                cancelled += 1
            return cancelled

    def sync_source_hooks(self, folder_name: str, hooks: List[dict]) -> int:
        """Update and persist hooks on cached jobs belonging to a source folder."""
        if not folder_name:
            return 0
        target_video_id = _extract_video_id_from_folder(folder_name)
        with self.lock:
            now = float(self._clock())
            updated = 0
            for job_id, job in self._jobs.items():
                if not isinstance(job, dict):
                    continue
                if _job_matches_source(job, folder_name, target_video_id):
                    job["hooks"] = copy.deepcopy(hooks)
                    job["updated_at"] = now
                    self._persist_job(job_id, job)
                    updated += 1
            return updated

    def prune_expired(self) -> int:
        """Remove expired or overflow terminal jobs while preserving all active jobs."""
        with self.lock:
            return self._prune_locked(float(self._clock()))

    # Minimal mapping helpers for readable indexing in tests and routes
    def __getitem__(self, key: str) -> dict:
        res = self.get_job(key)
        if res is None:
            raise KeyError(key)
        return res

    def __setitem__(self, key: str, value: dict) -> None:
        self._validate_job_id(key)
        with self.lock:
            now = float(self._clock())
            existing = self._jobs.get(key)
            data = copy.deepcopy(value)
            data.setdefault("job_id", key)
            if existing and isinstance(existing.get("created_at"), (int, float)) and "created_at" not in data:
                data["created_at"] = existing["created_at"]
            elif not isinstance(data.get("created_at"), (int, float)) or isinstance(data.get("created_at"), bool):
                data["created_at"] = now
            data["updated_at"] = now
            self._jobs[key] = data
            self._persist_job(key, data)
            self._maybe_prune_cap_locked(now)

    def __contains__(self, key: object) -> bool:
        if not isinstance(key, str):
            return False
        return self.get_job(key) is not None

    def get(self, key: str, default: Optional[dict] = None) -> Optional[dict]:
        res = self.get_job(key)
        return res if res is not None else default

    def __len__(self) -> int:
        with self.lock:
            return len(self._jobs)


class InMemoryJobStore(JobStore):
    """In-memory adapter for tests and ephemeral execution."""

    def __init__(
        self,
        *,
        max_age_seconds: Optional[float] = None,
        max_completed_jobs: Optional[int] = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        super().__init__(
            max_age_seconds=max_age_seconds,
            max_completed_jobs=max_completed_jobs,
            clock=clock,
        )

    def _persist_job(self, job_id: str, data: dict) -> None:
        return None

    def _remove_job_file(self, job_id: str) -> None:
        return None


class JSONFileJobStore(JobStore):
    """Directory-based job store with atomic single-file writes, orphan recovery, and retention pruning."""

    def __init__(
        self,
        dir_path: str,
        *,
        max_age_seconds: Optional[float] = DEFAULT_MAX_AGE_SECONDS,
        max_completed_jobs: Optional[int] = DEFAULT_MAX_COMPLETED_JOBS,
        clock: Callable[[], float] = time.time,
    ) -> None:
        super().__init__(
            max_age_seconds=max_age_seconds,
            max_completed_jobs=max_completed_jobs,
            clock=clock,
        )
        self.dir_path = dir_path
        os.makedirs(self.dir_path, exist_ok=True)
        self._migrate_old_file()
        self._load_all()

    def _resolve_job_path(self, job_id: str) -> str:
        if (
            not isinstance(job_id, str)
            or not job_id
            or "/" in job_id
            or "\\" in job_id
            or "\0" in job_id
            or job_id.strip() in {".", ".."}
            or ".." in job_id
        ):
            raise ValueError(f"Directory traversal blocked for job_id: {job_id!r}")
        base_dir = os.path.abspath(self.dir_path)
        target_path = os.path.abspath(os.path.join(base_dir, f"{job_id}.json"))
        if os.path.commonpath([base_dir, target_path]) != base_dir or os.path.dirname(target_path) != base_dir:
            raise ValueError(f"Directory traversal blocked for job_id: {job_id!r}")
        return target_path

    def _validate_job_id(self, job_id: str) -> None:
        self._resolve_job_path(job_id)

    def _migrate_old_file(self) -> None:
        """Auto-migrate from monolithic jobs.json to per-job files."""
        old_file = self.dir_path + ".json"
        if os.path.isfile(old_file):
            try:
                with open(old_file, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                if isinstance(old_data, dict):
                    migrated = 0
                    for job_id, job_data in old_data.items():
                        if not isinstance(job_data, dict):
                            continue
                        try:
                            job_path = self._resolve_job_path(str(job_id))
                        except ValueError:
                            continue
                        if not os.path.exists(job_path):
                            self._persist_job(str(job_id), job_data)
                            migrated += 1
                    print(f"[JSONFileJobStore] Migrated {migrated} jobs from {old_file}")
                backup_path = old_file + ".bak"
                os.rename(old_file, backup_path)
                print(f"[JSONFileJobStore] Old file backed up to {backup_path}")
            except Exception as e:
                print(f"[JSONFileJobStore] Migration failed: {e}")

    def _load_all(self) -> None:
        """Load all job files into memory, reconcile interrupted active jobs, and prune expired entries."""
        self._jobs = {}
        if not os.path.isdir(self.dir_path):
            return

        now = float(self._clock())
        reconciled_ids: List[str] = []

        for entry in os.scandir(self.dir_path):
            if entry.name.startswith(".") or not entry.is_file() or not entry.name.endswith(".json"):
                continue
            job_id = entry.name[:-5]
            try:
                self._resolve_job_path(job_id)
            except ValueError:
                continue

            try:
                with open(entry.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"[JSONFileJobStore] Failed to load {entry.name}: {e}")
                continue

            if not isinstance(data, dict):
                continue

            data.setdefault("job_id", job_id)
            has_created = isinstance(data.get("created_at"), (int, float)) and not isinstance(data.get("created_at"), bool)
            has_updated = isinstance(data.get("updated_at"), (int, float)) and not isinstance(data.get("updated_at"), bool)
            if not has_created or not has_updated:
                try:
                    mtime = float(entry.stat().st_mtime)
                except OSError:
                    mtime = now
                if not has_created:
                    data["created_at"] = mtime
                if not has_updated:
                    data["updated_at"] = mtime

            if _normalized_status(data) in ACTIVE_JOB_STATUSES:
                data["status"] = "error"
                data["error"] = "Interrupted by server restart"
                data["updated_at"] = now
                reconciled_ids.append(job_id)

            self._jobs[job_id] = data

        for job_id in reconciled_ids:
            self._persist_job(job_id, self._jobs[job_id])

        self.prune_expired()

    def _persist_job(self, job_id: str, data: dict) -> None:
        """Atomically write a single job file to disk."""
        target_path = self._resolve_job_path(job_id)
        os.makedirs(self.dir_path, exist_ok=True)
        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self.dir_path,
                prefix=f".{job_id}.",
                suffix=".tmp",
                delete=False,
            ) as tmp_file:
                tmp_path = tmp_file.name
                json.dump(data, tmp_file)
                tmp_file.flush()
            os.replace(tmp_path, target_path)
        except Exception as e:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            print(f"[JSONFileJobStore] Failed to save job {job_id}: {e}")

    def _remove_job_file(self, job_id: str) -> None:
        try:
            path = self._resolve_job_path(job_id)
        except ValueError:
            print(f"[JSONFileJobStore] Directory traversal blocked for job_id: {job_id!r}")
            return

        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"[JSONFileJobStore] Failed to delete file {path}: {e}")
