from abc import ABC, abstractmethod
from contextlib import contextmanager
from datetime import datetime, timezone
import ipaddress
import json
import os
import subprocess
import threading
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse

from core.job_store import ACTIVE_JOB_STATUSES
from core.release_service import parse_semver

IGNORED_DIRTY_TRACKED_PATHS = frozenset({
    "backend/prompts/prompt.json",
})

LOCAL_ORIGIN_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


class SelfUpdateError(Exception):
    """Domain error raised when self-update validation or triggering cannot proceed."""

    def __init__(self, status_code: int, detail: str, preflight: Optional[Dict[str, Any]] = None):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.preflight = preflight


class RenderActivityTracker:
    """Thread-safe active render counter shared between render routes and self-update guards."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._active = 0

    @property
    def active_count(self) -> int:
        with self._lock:
            return self._active

    def increment(self) -> None:
        with self._lock:
            self._active += 1

    def decrement(self) -> None:
        with self._lock:
            if self._active > 0:
                self._active -= 1

    @contextmanager
    def track(self):
        self.increment()
        try:
            yield
        finally:
            self.decrement()


class GitPort(ABC):
    """Abstract port for read-only Git pre-flight inspection."""

    @abstractmethod
    def get_current_branch(self) -> str:
        pass

    @abstractmethod
    def get_head_commit(self) -> str:
        pass

    @abstractmethod
    def get_dirty_files(self) -> List[str]:
        pass

    @abstractmethod
    def fetch_tags(self) -> None:
        pass

    @abstractmethod
    def resolve_tag_commit(self, tag_name: str) -> Optional[str]:
        pass

    @abstractmethod
    def is_ancestor(self, ancestor_commit: str, target_ref: str) -> bool:
        pass


class PlatformGitPort(GitPort):
    """Production GitPort executing parameterized git commands against repo_root."""

    def __init__(self, repo_root: str) -> None:
        self.repo_root = os.path.abspath(repo_root)

    def _run_git(self, args: Sequence[str], *, check: bool = True, timeout: float = 15.0) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=check,
            timeout=timeout,
        )

    def get_current_branch(self) -> str:
        res = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        return res.stdout.strip()

    def get_head_commit(self) -> str:
        res = self._run_git(["rev-parse", "HEAD"])
        return res.stdout.strip()

    def get_dirty_files(self) -> List[str]:
        res = self._run_git(["status", "--porcelain", "--untracked-files=no"])
        dirty: List[str] = []
        for raw_line in res.stdout.splitlines():
            if len(raw_line) < 4:
                continue
            path_part = raw_line[3:]
            if " -> " in path_part:
                path_part = path_part.split(" -> ", 1)[1]
            cleaned = path_part.strip().strip('"').replace("\\", "/")
            if cleaned in IGNORED_DIRTY_TRACKED_PATHS:
                continue
            dirty.append(cleaned)
        return dirty

    def fetch_tags(self) -> None:
        self._run_git(["fetch", "origin", "--tags"], timeout=30.0)

    def resolve_tag_commit(self, tag_name: str) -> Optional[str]:
        res = self._run_git(["rev-parse", "-q", "--verify", f"refs/tags/{tag_name}^{{commit}}"], check=False)
        if res.returncode != 0:
            return None
        commit = res.stdout.strip()
        return commit or None

    def is_ancestor(self, ancestor_commit: str, target_ref: str) -> bool:
        res = self._run_git(["merge-base", "--is-ancestor", ancestor_commit, target_ref], check=False)
        return res.returncode == 0


class FakeGitPort(GitPort):
    """Deterministic in-memory GitPort adapter for unit and integration tests."""

    def __init__(
        self,
        *,
        branch: str = "main",
        head_commit: str = "1111111",
        dirty_files: Optional[List[str]] = None,
        tags: Optional[Dict[str, str]] = None,
        ancestors: Optional[Dict[Tuple[str, str], bool]] = None,
        fetch_error: Optional[Exception] = None,
    ) -> None:
        self.branch = branch
        self.head_commit = head_commit
        self.dirty_files = list(dirty_files or [])
        self.tags = dict(tags or {})
        self.ancestors = dict(ancestors or {})
        self.fetch_error = fetch_error
        self.fetch_calls = 0

    def get_current_branch(self) -> str:
        return self.branch

    def get_head_commit(self) -> str:
        return self.head_commit

    def get_dirty_files(self) -> List[str]:
        return [
            p.replace("\\", "/")
            for p in self.dirty_files
            if p.replace("\\", "/") not in IGNORED_DIRTY_TRACKED_PATHS
        ]

    def fetch_tags(self) -> None:
        self.fetch_calls += 1
        if self.fetch_error is not None:
            raise self.fetch_error

    def resolve_tag_commit(self, tag_name: str) -> Optional[str]:
        return self.tags.get(tag_name)

    def is_ancestor(self, ancestor_commit: str, target_ref: str) -> bool:
        return self.ancestors.get((ancestor_commit, target_ref), False)


class SupervisorPort(ABC):
    """Abstract port representing run.py supervisor supervision and IPC channel."""

    @abstractmethod
    def is_supervised(self) -> bool:
        pass

    @abstractmethod
    def get_mode(self) -> str:
        pass

    @abstractmethod
    def write_request(self, payload: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def has_pending_request(self) -> bool:
        pass

    @abstractmethod
    def write_status(self, payload: Dict[str, Any]) -> None:
        pass

    @abstractmethod
    def read_status(self) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    def clear_status(self) -> None:
        pass


def _is_pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        try:
            import ctypes
            process = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
            if not process:
                return False
            ctypes.windll.kernel32.CloseHandle(process)
            return True
        except Exception:
            return True
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False


def _atomic_write_json(path: str, payload: Dict[str, Any]) -> None:
    parent = os.path.dirname(os.path.abspath(path))
    os.makedirs(parent, exist_ok=True)
    tmp_path = f"{path}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f)
    os.replace(tmp_path, path)


class EnvSupervisorPort(SupervisorPort):
    """Production SupervisorPort reading launcher metadata from environment and IPC files."""

    def __init__(self) -> None:
        self.ipc_dir = os.environ.get("YONRU_UPDATE_IPC_DIR", "").strip()
        raw_pid = os.environ.get("YONRU_SUPERVISOR_PID", "").strip()
        try:
            self.supervisor_pid = int(raw_pid) if raw_pid else None
        except ValueError:
            self.supervisor_pid = None
        self.dev_mode = os.environ.get("YONRU_SUPERVISOR_DEV", "0") == "1"

    def is_supervised(self) -> bool:
        if not self.ipc_dir or self.supervisor_pid is None:
            return False
        return _is_pid_alive(self.supervisor_pid)

    def get_mode(self) -> str:
        return "dev" if self.dev_mode else "production"

    def _request_path(self) -> str:
        return os.path.join(self.ipc_dir, "request.json")

    def _status_path(self) -> str:
        return os.path.join(self.ipc_dir, "status.json")

    def write_request(self, payload: Dict[str, Any]) -> None:
        if not self.ipc_dir:
            raise RuntimeError("Supervisor IPC directory is not configured.")
        _atomic_write_json(self._request_path(), payload)

    def has_pending_request(self) -> bool:
        return bool(self.ipc_dir and os.path.isfile(self._request_path()))

    def write_status(self, payload: Dict[str, Any]) -> None:
        if not self.ipc_dir:
            raise RuntimeError("Supervisor IPC directory is not configured.")
        _atomic_write_json(self._status_path(), payload)

    def read_status(self) -> Optional[Dict[str, Any]]:
        if not self.ipc_dir:
            return None
        path = self._status_path()
        if not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def clear_status(self) -> None:
        if not self.ipc_dir:
            return
        for p in (self._status_path(), self._request_path()):
            if os.path.isfile(p):
                try:
                    os.remove(p)
                except OSError:
                    pass


class FakeSupervisorPort(SupervisorPort):
    """Deterministic SupervisorPort adapter storing IPC messages in memory or tmp_path."""

    def __init__(
        self,
        *,
        ipc_dir: str = "",
        supervised: bool = True,
        dev_mode: bool = False,
        initial_status: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.ipc_dir = ipc_dir
        self.supervised = supervised
        self.dev_mode = dev_mode
        self.request: Optional[Dict[str, Any]] = None
        self.status: Optional[Dict[str, Any]] = dict(initial_status) if initial_status else None

    def is_supervised(self) -> bool:
        return self.supervised

    def get_mode(self) -> str:
        return "dev" if self.dev_mode else "production"

    def write_request(self, payload: Dict[str, Any]) -> None:
        self.request = dict(payload)

    def has_pending_request(self) -> bool:
        return self.request is not None

    def write_status(self, payload: Dict[str, Any]) -> None:
        self.status = dict(payload)

    def read_status(self) -> Optional[Dict[str, Any]]:
        return dict(self.status) if self.status is not None else None

    def clear_status(self) -> None:
        self.request = None
        self.status = None


def normalize_target_version(raw: str) -> Tuple[str, str]:
    """Validate and return (normalized_semver, canonical_tag) such as ('0.4.0', 'v0.4.0')."""
    parsed = parse_semver(raw)
    if parsed is None:
        raise SelfUpdateError(400, f"Invalid target release version: {raw!r}")
    version = f"{parsed[0]}.{parsed[1]}.{parsed[2]}"
    return version, f"v{version}"


def is_loopback_host(client_host: Optional[str]) -> bool:
    if not client_host:
        return False
    host = client_host.split("%", 1)[0].strip()
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_loopback:
            return True
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            return ip.ipv4_mapped.is_loopback
        return False
    except ValueError:
        return False


def is_local_origin(value: Optional[str]) -> bool:
    if value is None:
        return True
    trimmed = value.strip()
    if not trimmed or trimmed.lower() == "null":
        return False
    parsed = urlparse(trimmed)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    return parsed.hostname.lower() in LOCAL_ORIGIN_HOSTS


def validate_local_request(
    client_host: Optional[str],
    origin: Optional[str],
    referer: Optional[str],
) -> None:
    """Enforce loopback client IP and local Origin/Referer before mutating update state."""
    if not is_loopback_host(client_host):
        raise SelfUpdateError(
            403,
            "Self-update can only be triggered locally from the host machine.",
        )
    if not is_local_origin(origin) or not is_local_origin(referer):
        raise SelfUpdateError(
            403,
            "Self-update requests from non-local origins are not allowed.",
        )


def build_update_steps(tag: str, dev_mode: bool) -> List[Dict[str, str]]:
    """Build ordered progress stepper definitions matching run.py update phases."""
    steps = [
        {"id": "stopping_services", "label": "Stopping services", "status": "active"},
        {"id": "backing_up_prompts", "label": "Preserving local prompts", "status": "pending"},
        {"id": "fetching_tags", "label": f"Fetching release tag {tag}", "status": "pending"},
        {"id": "merging_tag", "label": f"Updating repository to {tag}", "status": "pending"},
        {"id": "installing_dependencies", "label": "Updating dependencies", "status": "pending"},
    ]
    if not dev_mode:
        steps.append({"id": "building_frontend", "label": "Building interface", "status": "pending"})
    steps.append({"id": "restarting", "label": "Restarting Yonru", "status": "pending"})
    return steps


class SelfUpdateService:
    """Deep coordinator for read-only update pre-flight, trust guards, and supervisor handoff."""

    def __init__(
        self,
        *,
        current_version: str,
        git_port: GitPort,
        supervisor_port: SupervisorPort,
        job_store: Any,
        render_tracker: RenderActivityTracker,
    ) -> None:
        self.current_version = current_version.lstrip("vV")
        self.git_port = git_port
        self.supervisor_port = supervisor_port
        self.job_store = job_store
        self.render_tracker = render_tracker
        self._trigger_lock = threading.Lock()

    def _find_active_jobs(self) -> List[Dict[str, str]]:
        if not self.job_store:
            return []
        try:
            active_jobs = self.job_store.list_active_jobs()
        except Exception:
            return []
        return [
            {"jobId": item["job_id"], "status": item["status"]}
            for item in active_jobs
        ]

    def preflight(self, target_version: str) -> Dict[str, Any]:
        version, tag = normalize_target_version(target_version)
        manual_command = f"git fetch origin --tags && git merge --ff-only {tag} && python run.py"

        supervised = self.supervisor_port.is_supervised()
        mode = self.supervisor_port.get_mode()

        checks: List[Dict[str, Any]] = [
            {
                "id": "supervisor",
                "label": "Managed by Yonru Launcher",
                "passed": supervised,
                "detail": None if supervised else "Automatic restart is only available when launched via run.py.",
            }
        ]

        branch = ""
        initial_commit = ""
        dirty_files: List[str] = []
        branch_ok = False
        clean_ok = False
        tag_ok = False
        branch_detail: Optional[str] = None
        clean_detail: Optional[str] = None
        tag_detail: Optional[str] = None

        try:
            branch = self.git_port.get_current_branch()
            initial_commit = self.git_port.get_head_commit()
            branch_ok = branch == "main"
            if not branch_ok:
                branch_detail = (
                    f"Workspace is on '{branch or 'detached HEAD'}' instead of 'main'."
                )
        except Exception as exc:
            branch_detail = f"Failed to inspect Git branch: {exc}"

        checks.append({
            "id": "branch",
            "label": "Workspace on main branch",
            "passed": branch_ok,
            "detail": branch_detail,
        })

        try:
            dirty_files = self.git_port.get_dirty_files()
            clean_ok = len(dirty_files) == 0
            if not clean_ok:
                preview = ", ".join(dirty_files[:5])
                suffix = f" (+{len(dirty_files) - 5} more)" if len(dirty_files) > 5 else ""
                clean_detail = f"{len(dirty_files)} tracked file(s) have uncommitted changes: {preview}{suffix}."
        except Exception as exc:
            clean_detail = f"Failed to check tracked repository status: {exc}"

        checks.append({
            "id": "clean_tree",
            "label": "No uncommitted tracked changes",
            "passed": clean_ok,
            "detail": clean_detail,
        })

        try:
            self.git_port.fetch_tags()
            tag_commit = self.git_port.resolve_tag_commit(tag)
            if not tag_commit:
                tag_detail = f"Release tag {tag} was not found on remote origin."
            elif not initial_commit:
                tag_detail = "Current HEAD commit could not be resolved."
            elif not self.git_port.is_ancestor(initial_commit, f"refs/tags/{tag}"):
                tag_detail = f"Local main cannot fast-forward cleanly to {tag}."
            else:
                tag_ok = True
        except Exception as exc:
            tag_detail = f"Could not fetch tags from origin: {exc}"

        checks.append({
            "id": "target_tag",
            "label": f"Release tag {tag} verified",
            "passed": tag_ok,
            "detail": tag_detail,
        })

        active_jobs = self._find_active_jobs()
        active_renders = self.render_tracker.active_count
        idle_ok = len(active_jobs) == 0 and active_renders == 0
        idle_detail = None
        if not idle_ok:
            reasons = []
            if active_jobs:
                reasons.append(f"{len(active_jobs)} active pipeline job(s)")
            if active_renders:
                reasons.append(f"{active_renders} active MP4 render(s)")
            idle_detail = "Wait until " + " and ".join(reasons) + " finish before updating."

        checks.append({
            "id": "idle_workers",
            "label": "No active downloads, AI jobs, or renders",
            "passed": idle_ok,
            "detail": idle_detail,
        })

        can_update = all(item["passed"] for item in checks)
        first_failure = next((item["detail"] for item in checks if not item["passed"] and item["detail"]), None)

        return {
            "supported": supervised,
            "canUpdate": can_update,
            "currentVersion": self.current_version,
            "targetVersion": version,
            "targetTag": tag,
            "mode": mode,
            "branch": branch,
            "initialCommit": initial_commit,
            "checks": checks,
            "dirtyFiles": dirty_files,
            "activeJobs": active_jobs,
            "activeRenders": active_renders,
            "blockingReason": None if can_update else first_failure,
            "manualCommand": manual_command,
        }

    def trigger_update(self, target_version: str) -> Dict[str, Any]:
        """Validate pre-flight state under single-flight lock and signal run.py to execute update."""
        with self._trigger_lock:
            existing_status = self.supervisor_port.read_status()
            if self.supervisor_port.has_pending_request() or (
                existing_status and existing_status.get("state") in ("pending_restart", "updating", "restarting")
            ):
                raise SelfUpdateError(409, "A self-update is already in progress.")

            preflight = self.preflight(target_version)
            if not preflight["canUpdate"]:
                raise SelfUpdateError(
                    409,
                    preflight["blockingReason"] or "Self-update pre-flight checks failed.",
                    preflight=preflight,
                )

            update_id = str(uuid.uuid4())
            now_iso = datetime.now(timezone.utc).isoformat()
            dev_mode = preflight["mode"] == "dev"
            status_payload: Dict[str, Any] = {
                "updateId": update_id,
                "state": "pending_restart",
                "step": "stopping_services",
                "message": f"Stopping services and preparing update to {preflight['targetTag']}...",
                "currentVersion": self.current_version,
                "targetVersion": preflight["targetVersion"],
                "targetTag": preflight["targetTag"],
                "mode": preflight["mode"],
                "initialCommit": preflight["initialCommit"],
                "rolledBack": False,
                "error": None,
                "updatedAt": now_iso,
                "steps": build_update_steps(preflight["targetTag"], dev_mode=dev_mode),
            }
            request_payload: Dict[str, Any] = {
                "updateId": update_id,
                "targetVersion": preflight["targetVersion"],
                "targetTag": preflight["targetTag"],
                "initialCommit": preflight["initialCommit"],
                "currentVersion": self.current_version,
                "requestedAt": now_iso,
            }

            self.supervisor_port.write_status(status_payload)
            self.supervisor_port.write_request(request_payload)
            return status_payload

    def get_status(self) -> Dict[str, Any]:
        """Read current self-update status from IPC and promote restarting->completed when upgraded."""
        status = self.supervisor_port.read_status()
        if not status:
            return {
                "state": "idle",
                "step": "idle",
                "message": "",
                "currentVersion": self.current_version,
                "targetVersion": None,
                "targetTag": None,
                "rolledBack": False,
                "error": None,
                "steps": [],
            }

        if status.get("state") == "restarting" and status.get("targetVersion") == self.current_version:
            updated_steps = [
                {**s, "status": "done"} if isinstance(s, dict) else s
                for s in status.get("steps", [])
            ]
            status = {
                **status,
                "state": "completed",
                "step": "completed",
                "currentVersion": self.current_version,
                "message": f"Updated to {status.get('targetTag') or f'v{self.current_version}'}.",
                "steps": updated_steps,
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
            self.supervisor_port.write_status(status)

        return status

    def acknowledge(self) -> Dict[str, Any]:
        """Clear completed or failed self-update state after the UI has processed it."""
        self.supervisor_port.clear_status()
        return self.get_status()
