import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json
import shutil

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.workflow_coordinator import ClipWorkflowCoordinator
from core.face_tracker import MockFaceTracker


class TestWorkflowCoordinatorCropMap(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.abspath("temp_test_workflow_crop_map")
        os.makedirs(self.test_dir, exist_ok=True)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_run_local_cut_generates_and_saves_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_youtube_client = MagicMock()
        mock_speech_transcriber = MagicMock()
        mock_prompt_repo = MagicMock()
        mock_config_store = MagicMock()

        clip_dir = os.path.join(self.test_dir, "clip_10_20")
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("dummy video")

        mock_asset_repo.create_clip.return_value = {
            "file_path": clip_video_path,
            "duration": 10.0,
            "start": 10.0,
            "end": 20.0
        }
        mock_speech_transcriber.transcribe.return_value = [
            {"start": 0.0, "duration": 1.0, "text": "hello"}
        ]

        mock_crop_map = [{"time": 0.0, "x": 600}, {"time": 2.0, "x": 800}]
        mock_tracker = MockFaceTracker(mock_result=mock_crop_map)

        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=mock_youtube_client,
            speech_transcriber=mock_speech_transcriber,
            prompt_repository=mock_prompt_repo,
            config_store=mock_config_store,
            face_tracker=mock_tracker
        )

        job_id = "job_crop_map_test"
        full_video_path = os.path.join(self.test_dir, "full_source.mp4")
        with open(full_video_path, "w") as f:
            f.write("dummy full source")

        coordinator.jobs[job_id] = {
            "status": "queued",
            "full_video_path": full_video_path
        }

        coordinator.run_local_cut(job_id, 10.0, 20.0)

        # Verify crop_map.json was saved in clip_dir
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        self.assertTrue(os.path.exists(crop_map_path), f"crop_map.json was not created at {crop_map_path}")
        with open(crop_map_path, "r", encoding="utf-8") as f:
            saved_crop_map = json.load(f)
        self.assertEqual(saved_crop_map, mock_crop_map)
        self.assertEqual(coordinator.jobs[job_id]["status"], "ready")


if __name__ == "__main__":
    unittest.main()
