from abc import ABC, abstractmethod
import json
import os
import threading
from typing import Dict, Optional

class JobStore(ABC):
    def __init__(self):
        self.lock = threading.Lock()

    @abstractmethod
    def get(self, job_id: str) -> Optional[dict]:
        """Retrieve a job by ID."""
        pass

    @abstractmethod
    def set(self, job_id: str, data: dict) -> None:
        """Store or update a job's complete data dict."""
        pass

    @abstractmethod
    def list_all(self) -> Dict[str, dict]:
        """List all jobs."""
        pass

    # Thread-safe unified aliases and operations from JobManager
    def create_job(self, job_id: str, initial_data: dict) -> dict:
        """Create a new job thread-safely."""
        with self.lock:
            data = {
                "job_id": job_id,
                "status": "pending",
                "video_info": None,
                "full_video_path": None,
                "hooks": [],
                "error": None
            }
            data.update(initial_data)
            self.set(job_id, data)
            return data

    def get_job(self, job_id: str) -> Optional[dict]:
        """Retrieve a job thread-safely."""
        with self.lock:
            return self.get(job_id)

    def update_job(self, job_id: str, **kwargs) -> dict:
        """Atomically update specific keys of a job thread-safely."""
        with self.lock:
            data = self.get(job_id)
            if data is None:
                data = {
                    "job_id": job_id,
                    "status": "pending",
                    "video_info": None,
                    "full_video_path": None,
                    "hooks": [],
                    "error": None
                }
            data.update(kwargs)
            self.set(job_id, data)
            return data

    def list_all_jobs(self) -> Dict[str, dict]:
        """List all jobs thread-safely."""
        with self.lock:
            return self.list_all()

    # Dictionary-like mapping interface for backward compatibility
    def __getitem__(self, key: str) -> dict:
        res = self.get_job(key)
        if res is None:
            raise KeyError(key)
        return res

    def __setitem__(self, key: str, value: dict) -> None:
        with self.lock:
            self.set(key, value)

    def __contains__(self, key: str) -> bool:
        return self.get_job(key) is not None

    def get(self, key: str, default=None) -> Optional[dict]:
        res = self.get_job(key)
        return res if res is not None else default

    def values(self):
        return self.list_all_jobs().values()

    def items(self):
        return self.list_all_jobs().items()

    def __len__(self) -> int:
        return len(self.list_all_jobs())


class InMemoryJobStore(JobStore):
    def __init__(self):
        super().__init__()
        self._jobs: Dict[str, dict] = {}

    def get(self, job_id: str) -> Optional[dict]:
        return self._jobs.get(job_id)

    def set(self, job_id: str, data: dict) -> None:
        self._jobs[job_id] = data

    def list_all(self) -> Dict[str, dict]:
        return self._jobs.copy()


class JSONFileJobStore(JobStore):
    """Directory-based job store: each job is stored as a separate JSON file
    inside a directory, eliminating monolithic read/write bottlenecks."""

    def __init__(self, dir_path: str):
        super().__init__()
        self.dir_path = dir_path
        self._cache: Dict[str, dict] = {}
        os.makedirs(self.dir_path, exist_ok=True)
        self._migrate_old_file()
        self._load_all()

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
                        job_path = os.path.join(self.dir_path, f"{job_id}.json")
                        if not os.path.exists(job_path):
                            with open(job_path, "w", encoding="utf-8") as f:
                                json.dump(job_data, f)
                            migrated += 1
                    print(f"[JSONFileJobStore] Migrated {migrated} jobs from {old_file}")
                # Rename old file as backup
                backup_path = old_file + ".bak"
                os.rename(old_file, backup_path)
                print(f"[JSONFileJobStore] Old file backed up to {backup_path}")
            except Exception as e:
                print(f"[JSONFileJobStore] Migration failed: {e}")

    def _load_all(self) -> None:
        """Load all job files into memory cache at startup."""
        self._cache = {}
        if not os.path.isdir(self.dir_path):
            return
        for entry in os.scandir(self.dir_path):
            if entry.is_file() and entry.name.endswith(".json"):
                job_id = entry.name[:-5]  # strip .json
                try:
                    with open(entry.path, "r", encoding="utf-8") as f:
                        self._cache[job_id] = json.load(f)
                except Exception as e:
                    print(f"[JSONFileJobStore] Failed to load {entry.name}: {e}")

    def _job_path(self, job_id: str) -> str:
        return os.path.join(self.dir_path, f"{job_id}.json")

    def _save_job(self, job_id: str) -> None:
        """Write a single job to disk."""
        try:
            os.makedirs(self.dir_path, exist_ok=True)
            with open(self._job_path(job_id), "w", encoding="utf-8") as f:
                json.dump(self._cache[job_id], f)
        except Exception as e:
            print(f"[JSONFileJobStore] Failed to save job {job_id}: {e}")

    def get(self, job_id: str) -> Optional[dict]:
        if not os.path.exists(self._job_path(job_id)):
            self._cache.pop(job_id, None)
            return None
        return self._cache.get(job_id)

    def set(self, job_id: str, data: dict) -> None:
        self._cache[job_id] = data
        self._save_job(job_id)

    def list_all(self) -> Dict[str, dict]:
        for job_id in list(self._cache.keys()):
            if not os.path.exists(self._job_path(job_id)):
                self._cache.pop(job_id, None)
        return self._cache.copy()

    def save(self) -> None:
        """Manually trigger disk serialization for all cached jobs."""
        with self.lock:
            for job_id in self._cache:
                self._save_job(job_id)
