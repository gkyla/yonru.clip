import unittest
from unittest.mock import MagicMock, patch
import os
import sys
import json

# Dynamic path resolution to root of backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.asset_repository import AssetRepository
from core.youtube_client import YouTubeClient

class DummyYouTubeClient(YouTubeClient):
    """A test double for YouTubeClient that avoids hitting the network."""
    def extract_video_id(self, url: str) -> str:
        return "abc12345678"

    def get_video_info_fast(self, url: str) -> dict:
        return {
            "title": "Test Video Title",
            "id": "abc12345678"
        }

    def fetch_transcript(self, video_id: str) -> list:
        return [
            {"start": 0.0, "duration": 1.5, "text": "hello"},
            {"start": 1.5, "duration": 2.0, "text": "world"}
        ]

    def download_video(self, url: str, target_dir: str, quality: str = "1080p", progress_callback = None) -> None:
        # Create a dummy full.mp4 or preview.mp4 so the repository can run its metadata checks
        os.makedirs(target_dir, exist_ok=True)
        filename = "preview.mp4" if quality == "360p" else "full.mp4"
        with open(os.path.join(target_dir, filename), "w") as f:
            f.write("dummy video data")


class TestAssetRepository(unittest.TestCase):
    def setUp(self):
        self.output_dir = "temp_test_assets"
        self.mock_client = DummyYouTubeClient()
        self.repo = AssetRepository(output_dir=self.output_dir, youtube_client=self.mock_client)

    def tearDown(self):
        import shutil
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)

    @patch('core.asset_repository.AssetRepository._ffprobe_info')
    def test_get_or_create_source_downloads_and_caches(self, mock_ffprobe):
        mock_ffprobe.return_value = {
            "streams": [{"codec_type": "video", "width": 1920, "height": 1080, "avg_frame_rate": "30/1"}],
            "format": {"duration": "60.0"}
        }

        url = "https://youtube.com/watch?v=abc12345678"
        source = self.repo.get_or_create_source(url)

        self.assertEqual(source["video_id"], "abc12345678")
        self.assertEqual(source["width"], 1920)
        self.assertEqual(source["height"], 1080)
        self.assertEqual(source["duration"], 60.0)
        self.assertEqual(source["fps"], 30.0)

        # Check files were created in local output directory structure
        source_dir = os.path.join(self.output_dir, "sources", "Test_Video_Title_abc12345678")
        self.assertTrue(os.path.exists(os.path.join(source_dir, "full.mp4")))

    def test_invalid_path_traversal_throws_error(self):
        with self.assertRaises(ValueError):
            self.repo.delete_cached_video("../../unsafe_path")
            
        with self.assertRaises(ValueError):
            self.repo.delete_clip("../../unsafe_folder", "clip_1")

    @patch('core.asset_repository.AssetRepository._run_ffmpeg')
    @patch('core.asset_repository.AssetRepository._ffprobe_info')
    def test_create_clip_executes_ffmpeg(self, mock_ffprobe, mock_ffmpeg):
        mock_ffprobe.return_value = {
            "streams": [{"codec_type": "video", "width": 1080, "height": 1920}],
            "format": {"duration": "10.0"}
        }
        
        # Staging a dummy file so exists() returns True
        video_dir = os.path.join(self.output_dir, "sources", "test_video_123")
        os.makedirs(video_dir, exist_ok=True)
        video_path = os.path.join(video_dir, "full.mp4")
        with open(video_path, "w") as f:
            f.write("content")

        clip = self.repo.create_clip(video_path, start_time=5.0, end_time=15.0, theme="Funny Moment")
        
        self.assertEqual(clip["clip_id"], "5_15_Funny_Moment")
        self.assertEqual(clip["start"], 5.0)
        self.assertEqual(clip["end"], 15.0)
        self.assertEqual(clip["theme"], "Funny Moment")
        self.assertTrue(mock_ffmpeg.called)

    def test_hooks_saving_and_deletion(self):
        folder_name = "test_video_123"
        folder_path = os.path.join(self.output_dir, "sources", folder_name)
        os.makedirs(folder_path, exist_ok=True)
        
        # Add a hook
        hook = {"start": 10.0, "end": 20.0, "text": "test hook text"}
        hooks = self.repo.add_saved_hook(folder_name, hook)
        
        self.assertEqual(len(hooks), 1)
        self.assertEqual(hooks[0]["start"], 10.0)
        self.assertTrue("_id" in hooks[0])
        
        # Fetch hooks
        fetched = self.repo.get_saved_hooks(folder_name)
        self.assertEqual(len(fetched), 1)
        
        # Delete hook
        hook_id = hooks[0]["_id"]
        cleared = self.repo.delete_saved_hook(folder_name, hook_id)
        self.assertEqual(len(cleared), 0)

    @patch('core.asset_repository.AssetRepository.get_video_duration')
    def test_list_all_clips_auto_healing(self, mock_duration):
        mock_duration.return_value = 10.0
        
        clip_dir = os.path.join(self.output_dir, "clips", "test_video_123", "10_20_test")
        os.makedirs(clip_dir, exist_ok=True)
        
        video_path = os.path.join(clip_dir, "video.mp4")
        with open(video_path, "w") as f:
            f.write("dummy video data")
            
        transcript_path = os.path.join(clip_dir, "transcript.json")
        self.assertFalse(os.path.exists(transcript_path))
        
        clips = self.repo.list_all_clips()
        
        self.assertEqual(len(clips), 1)
        self.assertEqual(clips[0]["clip_id"], "10_20_test")
        self.assertEqual(clips[0]["folder_name"], "test_video_123")
        self.assertTrue(os.path.exists(transcript_path))
        
        with open(transcript_path, "r", encoding="utf-8") as f:
            saved_transcript = json.load(f)
        self.assertEqual(saved_transcript, [])

    @patch('core.asset_repository.AssetRepository._generate_thumbnail')
    @patch('core.asset_repository.AssetRepository.get_video_duration')
    @patch('core.asset_repository.AssetRepository.get_video_resolution')
    def test_list_cached_videos_includes_mtime(self, mock_res, mock_dur, mock_thumb):
        mock_res.return_value = (1920, 1080)
        mock_dur.return_value = 60.0
        mock_thumb.return_value = "thumb.jpg"
        
        folder_name = "Test_Video_Title_abc12345678"
        folder_path = os.path.join(self.output_dir, "sources", folder_name)
        os.makedirs(folder_path, exist_ok=True)
        video_path = os.path.join(folder_path, "full.mp4")
        with open(video_path, "w") as f:
            f.write("content")
            
        videos = self.repo.list_cached_videos()
        self.assertEqual(len(videos), 1)
        self.assertEqual(videos[0]["video_id"], "abc12345678")
        self.assertIn("mtime", videos[0])
        self.assertIsInstance(videos[0]["mtime"], float)

