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
from core.job_store import InMemoryJobStore


class TestWorkflowCoordinatorCropMap(unittest.TestCase):
    def setUp(self):
        self.test_dir = os.path.abspath("temp_test_workflow_crop_map")
        os.makedirs(self.test_dir, exist_ok=True)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_run_local_cut_generates_and_saves_crop_map(self):
        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
        mock_youtube_client = MagicMock()
        mock_speech_transcriber = MagicMock()
        mock_prompt_repo = MagicMock()
        mock_config_store = MagicMock()

        clip_dir = os.path.join(clips_dir, "src_folder", "clip_10_20")
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

    def test_get_or_create_crop_map_delegates_to_store_ensure_crop_map(self):
        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
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
        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
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
        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
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
            mock_ensure.assert_called_once_with(folder_name, clip_id)

    def test_run_local_cut_reusing_transcript_routes_through_store_ensure_crop_map(self):
        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
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
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
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

    def test_run_local_cut_runs_crop_map_concurrently_with_whisper(self):
        import threading

        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
        mock_speech_transcriber = MagicMock()

        clip_dir = os.path.join(clips_dir, "src_concurrent", "clip_0_10")
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("dummy video")

        transcribe_entered = threading.Event()
        crop_entered = threading.Event()
        transcribe_saw_crop = []
        crop_saw_transcribe = []

        def fake_transcribe(*args, **kwargs):
            transcribe_entered.set()
            transcribe_saw_crop.append(crop_entered.wait(timeout=2.0))
            return [{"start": 0.0, "duration": 1.0, "text": "hello"}]

        mock_speech_transcriber.transcribe.side_effect = fake_transcribe

        class ConcurrentStubTracker:
            def __init__(self):
                self.calls = 0

            def analyze_video(self, video_path, words_data=None):
                self.calls += 1
                crop_entered.set()
                crop_saw_transcribe.append(transcribe_entered.wait(timeout=2.0))
                return [{"time": 0.0, "x": 640}]

        stub_tracker = ConcurrentStubTracker()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=mock_speech_transcriber,
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=stub_tracker,
        )

        job_id = "job_concurrent_crop_whisper"
        full_video_path = os.path.join(self.test_dir, "full_source_concurrent.mp4")
        with open(full_video_path, "w") as f:
            f.write("dummy full source")
        coordinator.jobs[job_id] = {"status": "queued", "full_video_path": full_video_path}

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "create_clip", return_value={
            "file_path": clip_video_path,
            "duration": 10.0,
            "start": 0.0,
            "end": 10.0,
        }), patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
            coordinator.run_local_cut(job_id, 0.0, 10.0)

        self.assertEqual(transcribe_saw_crop, [True])
        self.assertEqual(crop_saw_transcribe, [True])
        self.assertEqual(stub_tracker.calls, 1)
        self.assertEqual(coordinator.jobs[job_id]["status"], "ready")

        self.assertEqual(
            coordinator.clip_session_store.get_crop_map("src_concurrent", "clip_0_10"),
            [{"time": 0.0, "x": 640}],
        )
        session = coordinator.clip_session_store.get_clip_session(
            "src_concurrent", "clip_0_10", ensure_crop_map=False
        )
        self.assertEqual(session["transcript"], [{"start": 0.0, "duration": 1.0, "text": "hello"}])

    def test_run_local_cut_joins_crop_map_when_whisper_fails(self):
        import time

        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
        mock_speech_transcriber = MagicMock()
        mock_speech_transcriber.transcribe.side_effect = RuntimeError("whisper failed")

        clip_dir = os.path.join(clips_dir, "src_fail_join", "clip_0_10")
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("dummy video")

        class SlowStubTracker:
            def __init__(self):
                self.calls = 0

            def analyze_video(self, video_path, words_data=None):
                self.calls += 1
                time.sleep(0.15)
                return [{"time": 0.0, "x": 720}]

        stub_tracker = SlowStubTracker()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=mock_speech_transcriber,
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=stub_tracker,
        )

        job_id = "job_whisper_fails_join"
        full_video_path = os.path.join(self.test_dir, "full_source_fail_join.mp4")
        with open(full_video_path, "w") as f:
            f.write("dummy full source")
        coordinator.jobs[job_id] = {"status": "queued", "full_video_path": full_video_path}

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "create_clip", return_value={
            "file_path": clip_video_path,
            "duration": 10.0,
            "start": 0.0,
            "end": 10.0,
        }), patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
            coordinator.run_local_cut(job_id, 0.0, 10.0)

        self.assertEqual(stub_tracker.calls, 1)
        self.assertEqual(coordinator.jobs[job_id]["status"], "ready")
        self.assertEqual(
            coordinator.clip_session_store.get_crop_map("src_fail_join", "clip_0_10"),
            [{"time": 0.0, "x": 720}],
        )
        session = coordinator.clip_session_store.get_clip_session(
            "src_fail_join", "clip_0_10", ensure_crop_map=False
        )
        self.assertEqual(session["transcript"], [])

    def test_run_local_cut_joins_crop_map_when_whisper_falls_back_to_global_transcript(self):
        import time

        mock_job_store = InMemoryJobStore()
        mock_asset_repo = MagicMock()
        clips_dir = os.path.join(self.test_dir, "clips")
        mock_asset_repo.clips_dir = clips_dir
        mock_asset_repo.output_dir = self.test_dir
        mock_speech_transcriber = MagicMock()
        mock_speech_transcriber.transcribe.side_effect = RuntimeError("whisper failed")

        source_dir = os.path.join(self.test_dir, "src_global_fallback")
        os.makedirs(source_dir, exist_ok=True)
        full_video_path = os.path.join(source_dir, "full.mp4")
        with open(full_video_path, "w") as f:
            f.write("dummy full source")
        with open(os.path.join(source_dir, "youtube-transcript.json"), "w", encoding="utf-8") as f:
            json.dump([
                {"start": 5.0, "duration": 2.0, "text": "Before clip"},
                {"start": 12.0, "duration": 3.0, "text": "Inside segment"},
                {"start": 25.0, "duration": 2.0, "text": "After clip"},
            ], f)

        clip_dir = os.path.join(clips_dir, "src_global_fallback", "clip_10_20")
        os.makedirs(clip_dir, exist_ok=True)
        clip_video_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_video_path, "w") as f:
            f.write("dummy video")

        class SlowStubTracker:
            def __init__(self):
                self.calls = 0

            def analyze_video(self, video_path, words_data=None):
                self.calls += 1
                time.sleep(0.15)
                return [{"time": 0.0, "x": 810}]

        stub_tracker = SlowStubTracker()
        coordinator = ClipWorkflowCoordinator(
            job_store=mock_job_store,
            asset_repository=mock_asset_repo,
            youtube_client=MagicMock(),
            speech_transcriber=mock_speech_transcriber,
            prompt_repository=MagicMock(),
            config_store=MagicMock(),
            face_tracker=stub_tracker,
        )

        job_id = "job_whisper_fallback_join"
        coordinator.jobs[job_id] = {"status": "queued", "full_video_path": full_video_path}

        from core.clip_session_store import ClipSessionStore
        with patch.object(ClipSessionStore, "create_clip", return_value={
            "file_path": clip_video_path,
            "duration": 10.0,
            "start": 10.0,
            "end": 20.0,
        }), patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
            coordinator.run_local_cut(job_id, 10.0, 20.0)

        self.assertEqual(stub_tracker.calls, 1)
        self.assertEqual(coordinator.jobs[job_id]["status"], "ready")
        self.assertEqual(
            coordinator.clip_session_store.get_crop_map("src_global_fallback", "clip_10_20"),
            [{"time": 0.0, "x": 810}],
        )
        session = coordinator.clip_session_store.get_clip_session(
            "src_global_fallback", "clip_10_20", ensure_crop_map=False
        )
        self.assertEqual(
            session["transcript"],
            [{"start": 2.0, "duration": 3.0, "text": "Inside segment"}],
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


