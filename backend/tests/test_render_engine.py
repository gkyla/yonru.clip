import unittest
from unittest.mock import MagicMock, patch
import os
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.render_engine import FakeRenderEngine, RenderComposition

class TestRenderEngine(unittest.TestCase):
    def test_render_composition_dto_attributes(self):
        comp = RenderComposition(
            original_video="test_video.mp4",
            crop_center_x=960,
            volume=0.8,
            fps=60.0
        )
        self.assertEqual(comp.original_video, "test_video.mp4")
        self.assertEqual(comp.crop_center_x, 960)
        self.assertEqual(comp.volume, 0.8)
        self.assertEqual(comp.fps, 60.0)

    def test_fake_render_engine_sync(self):
        engine = FakeRenderEngine()
        comp = RenderComposition("test_video.mp4", 960)
        path = engine.render(comp, "output.mp4")
        
        self.assertEqual(path, "static/output/output.mp4")

    def test_fake_render_engine_streaming(self):
        engine = FakeRenderEngine()
        comp = RenderComposition("test_video.mp4", 960, fps=30.0, clip_duration=5.0)
        
        progress_yields = list(engine.render_streaming(comp, "output.mp4"))
        self.assertEqual(len(progress_yields), 5)
        
        self.assertEqual(progress_yields[0]["stage"], "starting")
        self.assertEqual(progress_yields[1]["stage"], "bundling")
        self.assertEqual(progress_yields[2]["stage"], "rendering")
        self.assertEqual(progress_yields[3]["stage"], "encoding")
        self.assertEqual(progress_yields[4]["stage"], "done")
        self.assertEqual(progress_yields[4]["percent"], 100)

    def test_compile_composition(self):
        mock_req = MagicMock()
        mock_req.fps = 30.0
        mock_req.hook_index = 0
        mock_req.timeline_tracks = []
        mock_req.transcript = [{"text": "Hello", "start": 0.0, "duration": 1.0}]
        mock_req.subtitle_mode = "word"
        mock_req.subtitle_sync_offset = 0.0
        mock_req.font = "Arial"
        mock_req.font_size = 24
        mock_req.subtitle_offset = 50
        mock_req.subtitle_font_weight = 900
        mock_req.subtitle_text_color = "#FFFFFF"
        mock_req.subtitle_highlight_color = "#CFFF50"
        mock_req.subtitle_stroke_color = "#000000"
        mock_req.subtitle_stroke_width = 4.0
        mock_req.subtitle_text_transform = "uppercase"
        mock_req.subtitle_animation = "pop"
        mock_req.subtitle_highlight_mode = "color"
        mock_req.subtitle_background = "none"
        mock_req.subtitle_background_opacity = 0.7
        mock_req.subtitle_word_spacing = 0
        mock_req.volume = 0.5
        mock_req.thumbnail_enabled = False
        mock_req.face_tracking = False
        mock_req.crop_percent_x = 50.0
        mock_req.subtitle_position = "bottom"

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 10.0, "fps": 30.0},
            "hooks": []
        }

        mock_asset_repo = MagicMock()
        mock_asset_repo.get_video_resolution.return_value = (1920, 1080)

        with patch("os.path.exists", return_value=False):
            engine = FakeRenderEngine()
            comp = engine.compile_composition(mock_job, mock_req, mock_asset_repo)

            self.assertEqual(comp.original_video, "temp_assets/sources/video.mp4")
            self.assertEqual(comp.crop_center_x, 960)  # 50% of 1920
            self.assertEqual(comp.volume, 0.5)
            self.assertEqual(comp.fps, 30.0)
            self.assertEqual(comp.position, "bottom")

    def test_compile_and_render_methods(self):
        mock_req = MagicMock()
        mock_req.fps = 30.0
        mock_req.hook_index = 0
        mock_req.timeline_tracks = []
        mock_req.transcript = None
        mock_req.subtitle_mode = "word"
        mock_req.subtitle_sync_offset = 0.0
        mock_req.font = "Arial"
        mock_req.font_size = 24
        mock_req.subtitle_offset = 50
        mock_req.subtitle_font_weight = 900
        mock_req.subtitle_text_color = "#FFFFFF"
        mock_req.subtitle_highlight_color = "#CFFF50"
        mock_req.subtitle_stroke_color = "#000000"
        mock_req.subtitle_stroke_width = 4.0
        mock_req.subtitle_text_transform = "uppercase"
        mock_req.subtitle_animation = "pop"
        mock_req.subtitle_highlight_mode = "color"
        mock_req.subtitle_background = "none"
        mock_req.subtitle_background_opacity = 0.7
        mock_req.subtitle_word_spacing = 0
        mock_req.volume = 0.5
        mock_req.thumbnail_enabled = False
        mock_req.face_tracking = False
        mock_req.crop_percent_x = 50.0
        mock_req.subtitle_position = "bottom"

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 10.0, "fps": 30.0},
            "hooks": []
        }

        mock_asset_repo = MagicMock()
        mock_asset_repo.get_video_resolution.return_value = (1920, 1080)

        with patch("os.path.exists", return_value=False):
            engine = FakeRenderEngine()
            
            # Test compile_and_render
            path = engine.compile_and_render(mock_job, mock_req, mock_asset_repo, "output.mp4")
            self.assertEqual(path, "static/output/output.mp4")

            # Test compile_and_render_streaming
            yields = list(engine.compile_and_render_streaming(mock_job, mock_req, mock_asset_repo, "output.mp4"))
            self.assertEqual(yields[-1]["stage"], "done")

    def test_compile_composition_with_mock_face_tracker(self):
        from core.face_tracker import MockFaceTracker
        from core.render_engine import RemotionRenderEngine

        mock_req = MagicMock()
        mock_req.fps = 30.0
        mock_req.hook_index = 0
        mock_req.timeline_tracks = []
        mock_req.transcript = []
        mock_req.subtitle_mode = "word"
        mock_req.subtitle_sync_offset = 0.0
        mock_req.font = "Arial"
        mock_req.font_size = 24
        mock_req.subtitle_offset = 50
        mock_req.subtitle_font_weight = 900
        mock_req.subtitle_text_color = "#FFFFFF"
        mock_req.subtitle_highlight_color = "#CFFF50"
        mock_req.subtitle_stroke_color = "#000000"
        mock_req.subtitle_stroke_width = 4.0
        mock_req.subtitle_text_transform = "uppercase"
        mock_req.subtitle_animation = "pop"
        mock_req.subtitle_highlight_mode = "color"
        mock_req.subtitle_background = "none"
        mock_req.subtitle_background_opacity = 0.7
        mock_req.subtitle_word_spacing = 0
        mock_req.volume = 0.5
        mock_req.thumbnail_enabled = False
        mock_req.face_tracking = True
        mock_req.crop_percent_x = 50.0
        mock_req.subtitle_position = "bottom"

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 10.0, "fps": 30.0},
            "hooks": []
        }

        mock_asset_repo = MagicMock()
        mock_asset_repo.get_video_resolution.return_value = (1920, 1080)

        # Mock result of 500 for crop tracking
        mock_tracker = MockFaceTracker(mock_result=500)
        
        with patch("os.path.exists", return_value=False):
            # Bypass system check by using FakeRenderEngine with attribute injection
            engine = FakeRenderEngine()
            engine.face_tracker = mock_tracker
            comp = engine.compile_composition(mock_job, mock_req, mock_asset_repo)

            self.assertEqual(comp.crop_center_x, 500)
            self.assertIn("temp_assets/sources/video.mp4", mock_tracker.analyzed_paths)
