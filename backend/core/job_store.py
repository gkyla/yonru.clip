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
    def __init__(self, file_path: str):
        super().__init__()
        self.file_path = file_path
        self._cache: Dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
            except Exception as e:
                print(f"[JSONFileJobStore] Failed to load jobs file: {e}")
                self._cache = {}
        else:
            self._cache = {}

    def _save(self) -> None:
        # Ensure parent folder exists if possible
        parent = os.path.dirname(self.file_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, indent=4)
        except Exception as e:
            print(f"[JSONFileJobStore] Failed to save jobs file: {e}")

    def get(self, job_id: str) -> Optional[dict]:
        self._load()
        return self._cache.get(job_id)

    def set(self, job_id: str, data: dict) -> None:
        self._load()
        self._cache[job_id] = data
        self._save()

    def list_all(self) -> Dict[str, dict]:
        self._load()
        return self._cache.copy()

    def save(self) -> None:
        """Manually trigger disk serialization for nested dictionary updates."""
        with self.lock:
            self._save()
