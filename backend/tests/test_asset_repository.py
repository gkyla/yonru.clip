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
            "id": "abc12345678",
            "channel": "Test Channel"
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

        # Check files were created in local output directory structure with bracket format
        source_dir = os.path.join(self.output_dir, "sources", "[Test Channel] Test_Video_Title_abc12345678")
        self.assertTrue(os.path.exists(os.path.join(source_dir, "full.mp4")))
        meta_file = os.path.join(source_dir, "metadata.json")
        self.assertTrue(os.path.exists(meta_file))
        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)
        self.assertEqual(meta["channel"], "Test Channel")
        self.assertEqual(meta["title"], "Test Video Title")
        self.assertEqual(meta["raw_title"], "Test Video Title")

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
        
        assert clip is not None
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

    def test_save_clip_transcript_and_security(self):
        folder_name = "test_video_123"
        clip_id = "10_20"
        transcript = [{"text": "hello", "start": 0.0, "duration": 1.0}]
        
        success = self.repo.save_clip_transcript(folder_name, clip_id, transcript)
        self.assertTrue(success)
        
        saved_file = os.path.join(self.output_dir, "clips", folder_name, clip_id, "transcript.json")
        self.assertTrue(os.path.exists(saved_file))
        with open(saved_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data, transcript)

        # Test path traversal prevention
        with self.assertRaises(ValueError):
            self.repo.save_clip_transcript("../../unsafe", clip_id, transcript)

    def test_save_clip_style_and_timeline(self):
        folder_name = "test_video_123"
        clip_id = "10_20"
        settings = {"fontSize": 32, "font": "Impact"}
        timeline = [{"id": "video", "items": []}]
        
        self.assertTrue(self.repo.save_clip_style_settings(folder_name, clip_id, settings))
        self.assertTrue(self.repo.save_clip_timeline(folder_name, clip_id, timeline))
        self.assertTrue(self.repo.save_clip_history(folder_name, clip_id, ["undo1"], ["redo1"]))

        style_file = os.path.join(self.output_dir, "clips", folder_name, clip_id, "style_settings.json")
        timeline_file = os.path.join(self.output_dir, "clips", folder_name, clip_id, "timeline.json")
        history_file = os.path.join(self.output_dir, "clips", folder_name, clip_id, "history.json")

        self.assertTrue(os.path.exists(style_file))
        self.assertTrue(os.path.exists(timeline_file))
        self.assertTrue(os.path.exists(history_file))

    def test_default_styles_persistence(self):
        style = {"font": "Roboto", "fontSize": 48}
        thumb_style = {"thumbnailDuration": 2.0}

        self.assertTrue(self.repo.save_default_style_settings(style))
        self.assertEqual(self.repo.get_default_style_settings(), style)

        self.assertTrue(self.repo.save_default_thumbnail_style(thumb_style))
        self.assertEqual(self.repo.get_default_thumbnail_style(), thumb_style)

    def test_thumbnail_config_and_deletion(self):
        folder_name = "test_video_123"
        clip_id = "10_20"
        config = {"enabled": True, "duration": 1.5}
        
        self.assertTrue(self.repo.save_thumbnail_config(folder_name, clip_id, config))
        self.assertEqual(self.repo.get_thumbnail_config(folder_name, clip_id), config)

        # Create dummy thumbnail image
        thumb_img = os.path.join(self.output_dir, "clips", folder_name, clip_id, "thumbnail.jpg")
        with open(thumb_img, "w") as f:
            f.write("image data")
        self.assertTrue(os.path.exists(thumb_img))

        self.assertTrue(self.repo.delete_thumbnail(folder_name, clip_id))
        self.assertFalse(os.path.exists(thumb_img))

    @patch('core.asset_repository.AssetRepository._generate_thumbnail')
    @patch('core.asset_repository.AssetRepository.get_video_duration')
    @patch('core.asset_repository.AssetRepository.get_video_resolution')
    def test_list_cached_videos_search_and_pagination(self, mock_res, mock_dur, mock_thumb):
        mock_res.return_value = (1920, 1080)
        mock_dur.return_value = 60.0
        mock_thumb.return_value = "thumb.jpg"

        # Create three fake source folders
        for title, vid in [("Alpha Video", "aaaa1111111"), ("Beta Video", "bbbb2222222"), ("Gamma Video", "cccc3333333")]:
            folder_path = os.path.join(self.output_dir, "sources", f"{title}_{vid}")
            os.makedirs(folder_path, exist_ok=True)
            with open(os.path.join(folder_path, "full.mp4"), "w") as f:
                f.write("content")

        # Give Alpha Video a metadata.json with custom channel and added_at
        alpha_meta = os.path.join(self.output_dir, "sources", "Alpha Video_aaaa1111111", "metadata.json")
        with open(alpha_meta, "w") as f:
            json.dump({"channel": "Fireship", "added_at": 1720000000.0, "title": "Alpha Video", "video_id": "aaaa1111111"}, f)

        # Test search by title
        search_res = self.repo.list_cached_videos(page=1, limit=10, search="beta")
        self.assertEqual(search_res["total"], 1)
        self.assertEqual(search_res["videos"][0]["video_id"], "bbbb2222222")

        # Test search by channel name
        channel_search = self.repo.list_cached_videos(page=1, limit=10, search="fireship")
        self.assertEqual(channel_search["total"], 1)
        self.assertEqual(channel_search["videos"][0]["channel"], "Fireship")
        self.assertEqual(channel_search["videos"][0]["added_at"], 1720000000.0)

        # Test fallback for video without metadata.json
        beta_search = self.repo.list_cached_videos(page=1, limit=10, search="bbbb2222222")
        self.assertEqual(beta_search["videos"][0]["channel"], "Unknown Channel")
        self.assertIsNotNone(beta_search["videos"][0]["added_at"])

        # Test pagination
        page1 = self.repo.list_cached_videos(page=1, limit=2, sort_by="title", order="asc")
        self.assertEqual(len(page1["videos"]), 2)
        self.assertEqual(page1["total"], 3)
        self.assertTrue(page1["has_more"])
        self.assertEqual(page1["videos"][0]["title"], "Alpha Video")
        self.assertEqual(page1["videos"][1]["title"], "Beta Video")

        page2 = self.repo.list_cached_videos(page=2, limit=2, sort_by="title", order="asc")
        self.assertEqual(len(page2["videos"]), 1)
        self.assertFalse(page2["has_more"])
        self.assertEqual(page2["videos"][0]["title"], "Gamma Video")

    @patch('core.asset_repository.AssetRepository.get_video_duration')
    def test_list_ready_clips_filters_active(self, mock_dur):
        mock_dur.return_value = 10.0
        
        for clip_id in ["1_10_c1", "10_20_c2"]:
            clip_dir = os.path.join(self.output_dir, "clips", "src_video", clip_id)
            os.makedirs(clip_dir, exist_ok=True)
            with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
                f.write("data")
            with open(os.path.join(clip_dir, "transcript.json"), "w") as f:
                f.write("[]")

        all_clips = self.repo.list_ready_clips()
        self.assertEqual(len(all_clips), 2)

        filtered = self.repo.list_ready_clips(active_clip_ids={"1_10_c1"})
        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0]["clip_id"], "10_20_c2")

    def test_delete_clip_with_job(self):
        clip_dir = os.path.join(self.output_dir, "clips", "test_folder", "1_10")
        os.makedirs(clip_dir, exist_ok=True)
        with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
            f.write("data")

        import hashlib
        job_id = hashlib.md5("test_folder_1_10".encode('utf-8')).hexdigest()[:8]
        fake_jobs = {job_id: {"status": "ready"}}

        success = self.repo.delete_clip_with_job("test_folder", "1_10", job_store=fake_jobs)
        self.assertTrue(success)
        self.assertFalse(os.path.exists(clip_dir))
        self.assertNotIn(job_id, fake_jobs)

    def test_delete_cached_video_with_jobs(self):
        source_dir = os.path.join(self.output_dir, "sources", "Test_Video_12345678901")
        os.makedirs(source_dir, exist_ok=True)

        fake_jobs = {
            "job1": {
                "status": "processing",
                "video_info": {"folder_name": "Test_Video_12345678901"}
            }
        }

        count = self.repo.delete_cached_video_with_jobs("Test_Video_12345678901", job_store=fake_jobs)
        self.assertEqual(count, 1)
        self.assertEqual(fake_jobs["job1"]["status"], "cancelled")

    def test_extract_clip_screenshot_ffmpeg_command_args(self):
        clip_dir = os.path.join(self.output_dir, "clips", "test_folder", "1_10")
        os.makedirs(clip_dir, exist_ok=True)
        clip_path = os.path.join(clip_dir, "video.mp4")
        output_path = os.path.join(clip_dir, "thumbnail.jpg")
        with open(clip_path, "w") as f:
            f.write("video data")

        with patch.object(self.repo, '_run_ffmpeg') as mock_run_ffmpeg:
            def side_effect(args):
                with open(output_path, "w") as f:
                    f.write("thumb data")
                return True
            mock_run_ffmpeg.side_effect = side_effect

            success = self.repo.extract_clip_screenshot(clip_path, 3.5, output_path)
            self.assertTrue(success)
            self.assertTrue(os.path.exists(output_path))
            
            mock_run_ffmpeg.assert_called_once()
            called_args = mock_run_ffmpeg.call_args[0][0]
            self.assertNotEqual(called_args[0], "ffmpeg")
            self.assertEqual(called_args, [
                "-y",
                "-ss", "3.5",
                "-i", clip_path,
                "-vframes", "1",
                "-q:v", "2",
                output_path
            ])

    @patch('subprocess.run')
    def test_run_ffmpeg_strips_leading_ffmpeg_token(self, mock_subprocess):
        mock_res = MagicMock()
        mock_res.returncode = 0
        mock_subprocess.return_value = mock_res

        self.repo._run_ffmpeg(["ffmpeg", "-y", "-version"])
        self.assertEqual(mock_subprocess.call_args[0][0], ["ffmpeg", "-y", "-version"])

        self.repo._run_ffmpeg(["-y", "-version"])
        self.assertEqual(mock_subprocess.call_args[0][0], ["ffmpeg", "-y", "-version"])

    def test_sanitize_channel_and_filename(self):
        # Channel name sanitization
        self.assertEqual(self.repo._sanitize_channel_name("Raditya Dika"), "Raditya Dika")
        self.assertEqual(self.repo._sanitize_channel_name("Channel [Official] / 100%"), "Channel Official 100")
        self.assertEqual(self.repo._sanitize_channel_name(""), "Unknown Channel")
        self.assertEqual(self.repo._sanitize_channel_name(None), "Unknown Channel")
        self.assertEqual(self.repo._sanitize_channel_name("   🔥✨   "), "Unknown Channel")

        # Filename sanitization
        self.assertEqual(self.repo._sanitize_filename("Yang Merasa Sehat?!"), "Yang_Merasa_Sehat")
        self.assertEqual(self.repo._sanitize_filename("Video / Part 1 : Intro"), "Video_Part_1_Intro")
        self.assertEqual(self.repo._sanitize_filename("   🔥✨   "), "Video")

    @patch('core.asset_repository.AssetRepository._generate_thumbnail')
    @patch('core.asset_repository.AssetRepository.get_video_duration')
    @patch('core.asset_repository.AssetRepository.get_video_resolution')
    def test_list_cached_videos_with_bracket_format_and_raw_title(self, mock_res, mock_dur, mock_thumb):
        mock_res.return_value = (1920, 1080)
        mock_dur.return_value = 120.0
        mock_thumb.return_value = "thumb.jpg"

        # 1. Folder with brackets and metadata.json (with raw title containing special characters)
        folder_1 = "[Raditya Dika] Yang_merasa_sehat_lihat_ini_abc12345678"
        p1 = os.path.join(self.output_dir, "sources", folder_1)
        os.makedirs(p1, exist_ok=True)
        with open(os.path.join(p1, "full.mp4"), "w") as f:
            f.write("content")
        with open(os.path.join(p1, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump({
                "video_id": "abc12345678",
                "title": "Yang Merasa Sehat Coba Nonton Ini?! #shorts",
                "raw_title": "Yang Merasa Sehat Coba Nonton Ini?! #shorts",
                "channel": "Raditya Dika",
                "added_at": 1725000000.0
            }, f)

        # 2. Folder with brackets but NO metadata.json (fallback title stripping channel)
        folder_2 = "[Fireship] 100_Seconds_of_Code_xyz98765432"
        p2 = os.path.join(self.output_dir, "sources", folder_2)
        os.makedirs(p2, exist_ok=True)
        with open(os.path.join(p2, "full.mp4"), "w") as f:
            f.write("content")

        videos = self.repo.list_cached_videos()
        v1 = next(v for v in videos if v["video_id"] == "abc12345678")
        self.assertEqual(v1["channel"], "Raditya Dika")
        self.assertEqual(v1["title"], "Yang Merasa Sehat Coba Nonton Ini?! #shorts")
        self.assertEqual(v1["folder_name"], folder_1)

        v2 = next(v for v in videos if v["video_id"] == "xyz98765432")
        self.assertEqual(v2["channel"], "Unknown Channel")
        self.assertEqual(v2["title"], "100 Seconds of Code")
        self.assertEqual(v2["folder_name"], folder_2)

        # Test get_cached_video finds it by URL and reads metadata.json
        cached_res = self.repo.get_cached_video("https://youtube.com/watch?v=abc12345678")
        self.assertIsNotNone(cached_res)
        assert cached_res is not None
        self.assertEqual(cached_res["title"], "Yang Merasa Sehat Coba Nonton Ini?! #shorts")
        self.assertEqual(cached_res["channel"], "Raditya Dika")

        # Test get_cached_video_by_folder
        folder_res = self.repo.get_cached_video_by_folder(folder_1)
        self.assertIsNotNone(folder_res)
        assert folder_res is not None
        self.assertEqual(folder_res["title"], "Yang Merasa Sehat Coba Nonton Ini?! #shorts")
        self.assertEqual(folder_res["channel"], "Raditya Dika")



