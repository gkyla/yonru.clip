import unittest
import threading
import time
import os
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.job_store import InMemoryJobStore, JSONFileJobStore
from core.job_manager import JobManager

class TestJobManager(unittest.TestCase):
    def test_in_memory_job_store_basic_crud(self):
        store = InMemoryJobStore()
        manager = JobManager(store)

        # Create job
        manager.create_job("job_1", {"url": "https://example.com/1"})
        
        # Get job
        job = manager.get_job("job_1")
        self.assertEqual(job["job_id"], "job_1")
        self.assertEqual(job["url"], "https://example.com/1")
        self.assertEqual(job["status"], "pending")

        # Update job
        manager.update_job("job_1", status="ready", progress=100)
        updated = manager.get_job("job_1")
        self.assertEqual(updated["status"], "ready")
        self.assertEqual(updated["progress"], 100)

        # List all jobs
        all_jobs = manager.list_all_jobs()
        self.assertEqual(len(all_jobs), 1)
        self.assertTrue("job_1" in all_jobs)

    def test_file_based_job_store(self):
        temp_file = "temp_test_jobs.json"
        if os.path.exists(temp_file):
            os.remove(temp_file)

        try:
            store = JSONFileJobStore(temp_file)
            manager = JobManager(store)

            manager.create_job("job_file", {"status": "started"})
            self.assertTrue(os.path.exists(temp_file))

            # Retrieve from fresh store (caching sync verify)
            new_store = JSONFileJobStore(temp_file)
            job = new_store.get("job_file")
            self.assertEqual(job["status"], "started")
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)

    def test_thread_safety_updates(self):
        store = InMemoryJobStore()
        manager = JobManager(store)
        manager.create_job("concurrent_job", {"counter": 0})

        def worker():
            for _ in range(50):
                # Retrieve, increment, and set atomic increments thread-safely
                job = manager.get_job("concurrent_job")
                current = job.get("counter", 0)
                manager.update_job("concurrent_job", counter=current + 1)
                time.sleep(0.001)

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        job = manager.get_job("concurrent_job")
        # Confirms concurrent lock protection works
        self.assertEqual(job["counter"], 250)
