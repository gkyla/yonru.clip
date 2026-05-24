from abc import ABC, abstractmethod
import json
import os
from typing import Dict, Optional

class JobStore(ABC):
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


class InMemoryJobStore(JobStore):
    def __init__(self):
        self._jobs: Dict[str, dict] = {}

    def get(self, job_id: str) -> Optional[dict]:
        return self._jobs.get(job_id)

    def set(self, job_id: str, data: dict) -> None:
        self._jobs[job_id] = data

    def list_all(self) -> Dict[str, dict]:
        return self._jobs.copy()


class JSONFileJobStore(JobStore):
    def __init__(self, file_path: str):
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
