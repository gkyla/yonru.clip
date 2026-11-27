import unittest
import os
import sys
import json

# Dynamic path resolution to root of backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.asset_repository import AssetRepository, AssetStore
from core.media_transcoder import FakeMediaAdapter, MediaTranscoder
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
        self.media_adapter = FakeMediaAdapter()
        self.transcoder = MediaTranscoder(adapter=self.media_adapter)
        self.repo = AssetRepository(
            output_dir=self.output_dir,
            youtube_client=self.mock_client,
            media_transcoder=self.transcoder
        )

    def tearDown(self):
        import shutil
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)

    def test_get_or_create_source_downloads_and_caches(self):
        source_dir = os.path.join(self.output_dir, "sources", "[Test Channel] Test_Video_Title_abc12345678")
        full_video_path = os.path.join(source_dir, "full.mp4")
        self.media_adapter.probe_overrides[full_video_path] = {
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
        probe_calls = [c for c in self.media_adapter.calls if c[0] == "ffprobe_info"]
        self.assertEqual(len(probe_calls), 1)

        # Check files were created in local output directory structure with bracket format
        self.assertTrue(os.path.exists(full_video_path))
        self.assertTrue(os.path.exists(os.path.join(source_dir, "thumb.jpg")))
        self.assertEqual(source["thumbnail_url"], "/assets/sources/[Test Channel] Test_Video_Title_abc12345678/thumb.jpg")
        meta_file = os.path.join(source_dir, "metadata.json")
        self.assertTrue(os.path.exists(meta_file))
        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)
        self.assertEqual(meta["channel"], "Test Channel")
        self.assertEqual(meta["title"], "Test Video Title")
        self.assertEqual(meta["raw_title"], "Test Video Title")
        self.assertIn("media_specs", meta)
        st = os.stat(full_video_path)
        self.assertEqual(meta["media_specs"], {
            "filename": "full.mp4",
            "mtime_ns": st.st_mtime_ns,
            "size": st.st_size,
            "duration": 60.0,
            "width": 1920,
            "height": 1080,
            "fps": 30.0,
        })

    def test_get_or_create_source_preserves_added_at_across_quality_upgrade(self):
        url = "https://youtube.com/watch?v=abc12345678"
        preview = self.repo.get_or_create_source(url, quality="360p")
        original_added_at = preview["added_at"]

        upgraded = self.repo.get_or_create_source(url, quality="1080p")
        self.assertTrue(upgraded["hd_ready"])
        self.assertEqual(upgraded["added_at"], original_added_at)

        source_dir = os.path.dirname(upgraded["file_path"])
        with open(os.path.join(source_dir, "metadata.json"), "r", encoding="utf-8") as f:
            meta = json.load(f)
        self.assertEqual(meta["added_at"], original_added_at)
        self.assertEqual(meta["media_specs"]["filename"], "full.mp4")

    def test_invalid_path_traversal_throws_error(self):
        with self.assertRaises(ValueError):
            self.repo.delete_cached_video("../../unsafe_path")


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

    def test_list_cached_videos_includes_mtime_and_stays_readonly_without_thumb(self):
        folder_name = "Test_Video_Title_abc12345678"
        folder_path = os.path.join(self.output_dir, "sources", folder_name)
        os.makedirs(folder_path, exist_ok=True)
        video_path = os.path.join(folder_path, "full.mp4")
        with open(video_path, "w") as f:
            f.write("content")

        videos = self.repo.list_cached_videos()
        self.assertEqual(len(videos), 1)
        self.assertEqual(videos[0]["video_id"], "abc12345678")
        self.assertEqual(videos[0]["resolution"], "1920x1080")
        self.assertEqual(videos[0]["duration"], 60.0)
        self.assertIn("mtime", videos[0])
        self.assertIsInstance(videos[0]["mtime"], float)
        self.assertIsNone(videos[0]["thumbnail_url"])
        self.assertFalse(os.path.exists(os.path.join(folder_path, "thumb.jpg")))
        ffmpeg_calls = [c for c in self.media_adapter.calls if c[0] == "run_ffmpeg"]
        self.assertEqual(ffmpeg_calls, [])

    def test_list_cached_videos_search_and_pagination(self):
        # Create three fake source folders
        for title, vid in [("Alpha Video", "aaaa1111111"), ("Beta Video", "bbbb2222222"), ("Gamma Video", "cccc3333333")]:
            folder_path = os.path.join(self.output_dir, "sources", f"{title}_{vid}")
            os.makedirs(folder_path, exist_ok=True)
            with open(os.path.join(folder_path, "full.mp4"), "w") as f:
                f.write("content")
            with open(os.path.join(folder_path, "thumb.jpg"), "wb") as tf:
                tf.write(b"\xff\xd8\xff")

        # Give Alpha Video a metadata.json with custom channel and added_at (no media_specs yet)
        alpha_meta = os.path.join(self.output_dir, "sources", "Alpha Video_aaaa1111111", "metadata.json")
        with open(alpha_meta, "w") as f:
            json.dump({"channel": "Fireship", "added_at": 1720000000.0, "title": "Alpha Video", "video_id": "aaaa1111111"}, f)

        # Verify paginated search only probes the matched legacy slice once and runs 0 ffmpeg
        self.media_adapter.calls.clear()
        search_res = self.repo.list_cached_videos(page=1, limit=10, search="beta")
        self.assertEqual(search_res["total"], 1)
        self.assertEqual(search_res["videos"][0]["video_id"], "bbbb2222222")
        self.assertEqual(search_res["videos"][0]["thumbnail_url"], "/assets/sources/Beta Video_bbbb2222222/thumb.jpg")
        probe_calls = [c for c in self.media_adapter.calls if c[0] == "ffprobe_info"]
        ffmpeg_calls = [c for c in self.media_adapter.calls if c[0] == "run_ffmpeg"]
        self.assertEqual(len(probe_calls), 1)
        self.assertEqual(len(ffmpeg_calls), 0)

        # Test search by channel name (preserves channel and added_at after backfill)
        channel_search = self.repo.list_cached_videos(page=1, limit=10, search="fireship")
        self.assertEqual(channel_search["total"], 1)
        self.assertEqual(channel_search["videos"][0]["channel"], "Fireship")
        self.assertEqual(channel_search["videos"][0]["added_at"], 1720000000.0)

        # Test fallback for video originally without metadata.json
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

    def test_cold_restart_reads_persisted_media_specs_with_zero_ffprobe(self):
        # 1. Ingest a source so metadata.json persists fingerprinted media_specs
        source_dir = os.path.join(self.output_dir, "sources", "[Test Channel] Test_Video_Title_abc12345678")
        full_video_path = os.path.join(source_dir, "full.mp4")
        self.media_adapter.probe_overrides[full_video_path] = {
            "streams": [{"codec_type": "video", "width": 1920, "height": 1080, "avg_frame_rate": "60/1"}],
            "format": {"duration": "95.5"},
        }
        url = "https://youtube.com/watch?v=abc12345678"
        self.repo.get_or_create_source(url)

        # 2. Simulate brand-new cold process: new FakeMediaAdapter + MediaTranscoder + AssetRepository
        cold_adapter = FakeMediaAdapter()
        cold_transcoder = MediaTranscoder(adapter=cold_adapter)
        cold_repo = AssetRepository(
            output_dir=self.output_dir,
            youtube_client=self.mock_client,
            media_transcoder=cold_transcoder,
        )

        listed = cold_repo.list_cached_videos(page=1, limit=100)
        by_url = cold_repo.get_cached_video(url)
        by_folder = cold_repo.get_cached_video_by_folder("[Test Channel] Test_Video_Title_abc12345678")

        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["videos"][0]["duration"], 95.5)
        self.assertEqual(listed["videos"][0]["resolution"], "1920x1080")
        assert by_url is not None and by_folder is not None
        self.assertEqual(by_url["fps"], 60.0)
        self.assertEqual(by_folder["duration"], 95.5)
        self.assertEqual(cold_adapter.calls, [])

        # 3. Replacing full.mp4 with new size/mtime invalidates catalog + persisted fingerprint and re-probes once
        with open(full_video_path, "wb") as f:
            f.write(b"new upgraded 1080p stream payload with different size")
        cold_adapter.probe_overrides[full_video_path] = {
            "streams": [{"codec_type": "video", "width": 3840, "height": 2160, "avg_frame_rate": "24/1"}],
            "format": {"duration": "120.0"},
        }
        updated_list = cold_repo.list_cached_videos(page=1, limit=100)
        self.assertEqual(updated_list["videos"][0]["resolution"], "3840x2160")
        self.assertEqual(updated_list["videos"][0]["duration"], 120.0)
        self.assertEqual(len([c for c in cold_adapter.calls if c[0] == "ffprobe_info"]), 1)

    def test_delete_cached_video(self):
        source_dir = os.path.join(self.output_dir, "sources", "Test_Video_12345678901")
        os.makedirs(source_dir, exist_ok=True)
        with open(os.path.join(source_dir, "full.mp4"), "w") as f:
            f.write("content")

        listed_before = self.repo.list_cached_videos(page=1, limit=10)
        self.assertEqual(listed_before["total"], 1)

        self.assertTrue(os.path.exists(source_dir))
        success = self.repo.delete_cached_video("Test_Video_12345678901")
        self.assertTrue(success)
        self.assertFalse(os.path.exists(source_dir))
        self.assertEqual(self.repo.list_cached_videos(page=1, limit=10)["total"], 0)

        # Deleting non-existent returns False
        self.assertFalse(self.repo.delete_cached_video("Non_Existent"))

    def test_deprecated_shallow_passthroughs_removed(self):
        self.assertFalse(hasattr(AssetStore, "sanitize_and_prepare_hooks"))
        self.assertFalse(hasattr(self.repo, "_run_ffmpeg"))
        self.assertFalse(hasattr(self.repo, "_generate_thumbnail"))
        self.assertFalse(hasattr(self.repo, "extract_clip_screenshot"))

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

    def test_list_cached_videos_with_bracket_format_and_raw_title(self):
        self.media_adapter.default_duration = 120.0

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



