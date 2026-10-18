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

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "create_clip", return_value={
            "file_path": clip_video_path,
            "duration": 10.0,
            "start": 10.0,
            "end": 20.0
        }), patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
            coordinator.run_local_cut(job_id, 10.0, 20.0)

        # Verify crop_map.json was saved in clip_dir
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        self.assertTrue(os.path.exists(crop_map_path), f"crop_map.json was not created at {crop_map_path}")
        with open(crop_map_path, "r", encoding="utf-8") as f:
            saved_crop_map = json.load(f)
        self.assertEqual(saved_crop_map, mock_crop_map)
        self.assertEqual(coordinator.jobs[job_id]["status"], "ready")

    def test_ensure_crop_map_delegates_to_store_ensure_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_tracker = MagicMock()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=MagicMock(),
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=mock_tracker,
        )

        clip_dir = os.path.join(self.test_dir, "test_folder", "clip_1")
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("video content")

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "ensure_crop_map", return_value=[{"time": 0.0, "x": 640}]) as mock_ensure:
            res = coordinator._ensure_crop_map(clip_video_path)
            self.assertEqual(res, [{"time": 0.0, "x": 640}])
            mock_ensure.assert_called_once_with(
                "test_folder",
                "clip_1",
                video_path=clip_video_path,
                tracker=mock_tracker,
            )

    def test_compute_and_cache_crop_map_delegates_to_store_ensure_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_tracker = MagicMock()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=MagicMock(),
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=mock_tracker,
        )

        clip_dir = os.path.join(self.test_dir, "test_folder", "clip_2")
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("video content")

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "ensure_crop_map", return_value=[{"time": 0.0, "x": 720}]) as mock_ensure:
            res = coordinator._compute_and_cache_crop_map(clip_dir, clip_video_path, tracker=mock_tracker)
            self.assertEqual(res, [{"time": 0.0, "x": 720}])
            mock_ensure.assert_called_once_with(
                "test_folder",
                "clip_2",
                video_path=clip_video_path,
                tracker=mock_tracker,
            )

    def test_get_or_create_crop_map_delegates_to_store_ensure_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_tracker = MagicMock()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=MagicMock(),
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=mock_tracker,
        )

        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        clip_dir = os.path.join(clips_dir, "folder_test", "clip_test")
        os.makedirs(clip_dir, exist_ok=True)
        video_path = os.path.join(clip_dir, "video.mp4")
        with open(video_path, "w") as f:
            f.write("video dummy")

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "ensure_crop_map", return_value=[{"time": 0.0, "x": 500}]) as mock_ensure:
            res = coordinator.get_or_create_crop_map("folder_test", "clip_test")
            self.assertEqual(res, {"status": "ready", "crop_map": [{"time": 0.0, "x": 500}]})
            mock_ensure.assert_called_once_with(
                "folder_test",
                "clip_test",
                video_path=video_path,
                tracker=mock_tracker,
            )

    def test_provision_clip_routes_through_store_ensure_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_tracker = MagicMock()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=MagicMock(),
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=mock_tracker,
        )

        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        folder_name = "test_vid_provision"
        clip_id = "10_20"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        video_file = os.path.join(clip_dir, "video.mp4")
        with open(video_file, "w") as f:
            f.write("video content")
        with open(os.path.join(clip_dir, "transcript.json"), "w") as f:
            json.dump([{"start": 0.0, "text": "hello"}], f)

        job_id = "job_provision_crop_map"
        coordinator.jobs[job_id] = {
            "status": "queued",
            "video_info": {
                "file_path": os.path.join(self.test_dir, "source", folder_name, "full.mp4"),
                "fps": 30.0,
            }
        }

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "ensure_crop_map", return_value=[{"time": 0.0, "x": 640}]) as mock_ensure:
            res = coordinator.provision_clip(job_id, 10.0, 20.0)
            self.assertEqual(res["status"], "ready")
            mock_ensure.assert_called_once_with(
                folder_name,
                clip_id,
                video_path=video_file,
                tracker=mock_tracker,
            )

    def test_load_ready_clip_routes_through_store_ensure_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_tracker = MagicMock()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=MagicMock(),
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=mock_tracker,
        )

        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        folder_name = "vid_load_ready"
        clip_id = "5_15"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        clip_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_path, "w") as f:
            f.write("video content")
        with open(os.path.join(clip_dir, "transcript.json"), "w") as f:
            json.dump([{"start": 0.0, "text": "hello"}], f)

        video_info = {
            "video_id": "test_id",
            "file_path": os.path.join(self.test_dir, "source", folder_name, "full.mp4"),
            "fps": 30.0,
        }
        mock_asset_repo.get_cached_video_by_folder.return_value = video_info

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "ensure_crop_map", return_value=[{"time": 0.0, "x": 700}]) as mock_ensure:
            res = coordinator.load_ready_clip(
                folder_name=folder_name,
                clip_id=clip_id,
            )
            self.assertEqual(res["status"], "ready")
            mock_ensure.assert_called_once_with(
                folder_name,
                clip_id,
                video_path=clip_path,
                tracker=mock_tracker,
            )

    def test_run_local_cut_reusing_transcript_routes_through_store_ensure_crop_map(self):
        mock_job_store = {}
        mock_asset_repo = MagicMock()
        mock_tracker = MagicMock()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=MagicMock(),
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=mock_tracker,
        )

        folder_name = "test_reuse_folder"
        clip_id = "0_10"
        clip_dir = os.path.join(self.test_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("video")
        with open(os.path.join(clip_dir, "transcript.json"), "w") as f:
            json.dump([{"start": 0.0, "duration": 1.0, "text": "already transcribed"}], f)

        full_video_path = os.path.join(self.test_dir, "full.mp4")
        with open(full_video_path, "w") as f:
            f.write("full")

        job_id = "job_reuse_transcript"
        coordinator.jobs[job_id] = {
            "status": "queued",
            "full_video_path": full_video_path,
        }

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "create_clip", return_value={
            "file_path": clip_video_path,
            "duration": 10.0,
            "start": 0.0,
            "end": 10.0
        }), patch.object(ClipSessionStore, "ensure_crop_map", return_value=[{"time": 0.0, "x": 640}]) as mock_ensure:
            coordinator.run_local_cut(job_id, 0.0, 10.0)
            mock_ensure.assert_called_once_with(
                folder_name,
                clip_id,
                video_path=clip_video_path,
                tracker=mock_tracker,
            )

    def test_workflow_coordinator_has_no_low_level_facetracker_or_fallback_points(self):
        """Verifies that duplicate FaceTracker instantiation and fallback 960 points are removed."""
        coord_file = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "core", "workflow_coordinator.py")
        )
        with open(coord_file, "r", encoding="utf-8") as f:
            content = f.read()

        # FaceTracker should not be imported or instantiated inside workflow_coordinator
        self.assertNotIn("from core.face_tracker import FaceTracker", content)
        self.assertNotIn("FaceTracker()", content)
        # Coordinate fallback 960 points should not be present in workflow_coordinator
        self.assertNotIn('"x": 960', content)


if __name__ == "__main__":
    unittest.main()


