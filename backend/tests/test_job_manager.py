import unittest
import threading
import time
import os
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.job_store import InMemoryJobStore, JSONFileJobStore

class TestJobManager(unittest.TestCase):
    def test_in_memory_job_store_basic_crud(self):
        store = InMemoryJobStore()

        # Create job
        store.create_job("job_1", {"url": "https://example.com/1"})
        
        # Get job
        job = store.get_job("job_1")
        assert job is not None
        self.assertEqual(job["job_id"], "job_1")
        self.assertEqual(job["url"], "https://example.com/1")
        self.assertEqual(job["status"], "pending")

        # Update job
        store.update_job("job_1", status="ready", progress=100)
        updated = store.get_job("job_1")
        assert updated is not None
        self.assertEqual(updated["status"], "ready")
        self.assertEqual(updated["progress"], 100)

        # List all jobs
        all_jobs = store.list_all_jobs()
        self.assertEqual(len(all_jobs), 1)
        self.assertTrue("job_1" in all_jobs)

        # Verify dict-like mapping behaviors
        self.assertEqual(store["job_1"]["status"], "ready")
        self.assertTrue("job_1" in store)
        self.assertEqual(len(store), 1)

    def test_file_based_job_store(self):
        temp_dir = "temp_test_jobs"
        if os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)

        try:
            store = JSONFileJobStore(temp_dir)

            store.create_job("job_file", {"status": "started"})
            self.assertTrue(os.path.exists(os.path.join(temp_dir, "job_file.json")))

            # Retrieve from fresh store (caching sync verify)
            new_store = JSONFileJobStore(temp_dir)
            job = new_store.get("job_file")
            assert job is not None
            self.assertEqual(job["status"], "started")
        finally:
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)

    def test_file_based_job_store_manual_delete_sync(self):
        temp_dir = "temp_test_jobs_delete"
        if os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)

        try:
            store = JSONFileJobStore(temp_dir)
            store.create_job("job_1", {"status": "started"})
            store.create_job("job_2", {"status": "started"})
            
            # Manually delete job_1 file on disk
            os.remove(os.path.join(temp_dir, "job_1.json"))
            
            # Save the store (simulating global save)
            store.save()
            
            # job_1 should NOT be recreated on disk
            self.assertFalse(os.path.exists(os.path.join(temp_dir, "job_1.json")))
            # job_2 should still exist
            self.assertTrue(os.path.exists(os.path.join(temp_dir, "job_2.json")))
            # cache should no longer contain job_1
            self.assertNotIn("job_1", store)
        finally:
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)

    def test_thread_safety_updates(self):
        store = InMemoryJobStore()
        store.create_job("concurrent_job", {"counter": 0})

        def worker():
            for _ in range(50):
                # Retrieve, increment, and set atomic increments thread-safely
                job = store.get_job("concurrent_job")
                assert job is not None
                current = job.get("counter", 0)
                store.update_job("concurrent_job", counter=current + 1)
                time.sleep(0.001)

        threads = [threading.Thread(target=worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        job = store.get_job("concurrent_job")
        assert job is not None
        # Confirms concurrent lock protection works
        self.assertEqual(job["counter"], 250)

    def test_job_store_deletion(self):
        temp_dir = "temp_test_jobs_delete_explicit"
        if os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)

        try:
            # Test InMemoryJobStore deletion
            mem_store = InMemoryJobStore()
            mem_store.create_job("job_mem", {"status": "running"})
            self.assertIn("job_mem", mem_store)
            mem_store.delete_job("job_mem")
            self.assertNotIn("job_mem", mem_store)

            # Test JSONFileJobStore deletion
            file_store = JSONFileJobStore(temp_dir)
            file_store.create_job("job_file", {"status": "running"})
            job_file_path = os.path.join(temp_dir, "job_file.json")
            self.assertTrue(os.path.exists(job_file_path))
            self.assertIn("job_file", file_store)

            # Delete the job
            file_store.delete_job("job_file")
            self.assertNotIn("job_file", file_store)
            self.assertFalse(os.path.exists(job_file_path))

            # Test path traversal block
            file_store.create_job("job_safe", {"status": "ok"})
            # Try to delete with directory traversal
            file_store.delete_job("../outside")
        finally:
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)
