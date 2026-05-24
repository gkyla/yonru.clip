import threading
from typing import Optional, Dict
from core.job_store import JobStore

class JobManager:
    def __init__(self, store: JobStore):
        self.store = store
        self.lock = threading.Lock()

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
            self.store.set(job_id, data)
            return data

    def get_job(self, job_id: str) -> Optional[dict]:
        """Retrieve a job thread-safely."""
        with self.lock:
            return self.store.get(job_id)

    def update_job(self, job_id: str, **kwargs) -> dict:
        """Atomically update specific keys of a job thread-safely."""
        with self.lock:
            data = self.store.get(job_id)
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
            self.store.set(job_id, data)
            return data

    def list_all_jobs(self) -> Dict[str, dict]:
        """List all jobs thread-safely."""
        with self.lock:
            return self.store.list_all()
