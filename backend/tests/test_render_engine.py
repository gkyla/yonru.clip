import unittest
from unittest.mock import MagicMock, patch, mock_open
import os
import json
import shutil
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.render_engine import (
    FakeRenderEngine,
    RenderComposition,
    RemotionProgressParser,
    StagedRenderContext,
    RenderPipelineCoordinator,
    RemotionRenderEngine
)

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

    def test_compile_composition_uses_cached_crop_map_file(self):
        from core.face_tracker import MockFaceTracker

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
            "clip_path": "temp_assets/clips/demo/video.mp4",
            "video_info": {"file_path": "temp_assets/clips/demo/video.mp4", "duration": 10.0, "fps": 30.0},
            "hooks": []
        }

        mock_asset_repo = MagicMock()
        mock_asset_repo.get_video_resolution.return_value = (1920, 1080)

        cached_crop_map = [{"time": 0.0, "x": 750}, {"time": 2.5, "x": 820}]
        mock_tracker = MockFaceTracker(mock_result=500)

        def mock_exists_side_effect(path):
            if "crop_map.json" in str(path):
                return True
            return False

        mock_open_data = json.dumps(cached_crop_map)
        with patch("os.path.exists", side_effect=mock_exists_side_effect), \
             patch("builtins.open", mock_open(read_data=mock_open_data)):
            engine = FakeRenderEngine()
            engine.face_tracker = mock_tracker
            comp = engine.compile_composition(mock_job, mock_req, mock_asset_repo)

            self.assertEqual(comp.crop_center_x, cached_crop_map)
            # tracker should NOT have been invoked because crop_map.json was cached
            self.assertEqual(len(mock_tracker.analyzed_paths), 0)

    def test_resolve_output_filename_default(self):
        engine = FakeRenderEngine()
        filename = engine.resolve_output_filename(None, job_id="job123", hook_index=2)
        self.assertEqual(filename, "job123_clip_2.mp4")

    def test_resolve_output_filename_sanitized(self):
        engine = FakeRenderEngine()
        filename = engine.resolve_output_filename("My Cool Clip! #1", job_id="job123", hook_index=0)
        self.assertEqual(filename, "My_Cool_Clip_1.mp4")

    def test_resolve_output_filename_auto_versioning(self, tmp_path=None):
        import tempfile
        import shutil
        temp_dir = tempfile.mkdtemp()
        try:
            engine = FakeRenderEngine(output_dir=temp_dir)
            # Create existing files
            (open(os.path.join(temp_dir, "My_Clip.mp4"), "w")).close()
            (open(os.path.join(temp_dir, "My_Clip_v2.mp4"), "w")).close()

            filename = engine.resolve_output_filename("My Clip", job_id="job123")
            self.assertEqual(filename, "My_Clip_v3.mp4")
        finally:
            shutil.rmtree(temp_dir)

    def test_unified_render_and_render_stream(self):
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
        mock_req.output_name = "Epic Reel"

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 10.0, "fps": 30.0},
            "hooks": []
        }

        mock_asset_repo = MagicMock()
        mock_asset_repo.get_video_resolution.return_value = (1920, 1080)

        with patch("os.path.exists", return_value=False):
            engine = FakeRenderEngine()
            
            # Unified render
            res = engine.render(mock_job, mock_req, mock_asset_repo, output_name=mock_req.output_name)
            self.assertEqual(res["out_filename"], "Epic_Reel.mp4")
            self.assertEqual(res["output_url"], "/static/output/Epic_Reel.mp4")

            # Unified render_stream
            events = list(engine.render_stream(mock_job, mock_req, mock_asset_repo, output_name=mock_req.output_name))
            self.assertEqual(events[-1]["stage"], "done")
            self.assertEqual(events[-1]["outputUrl"], "/static/output/Epic_Reel.mp4")

    def test_remotion_progress_parser_lifecycle(self):
        parser = RemotionProgressParser(total_frames=300)

        # 1. Starting event
        start_ev = parser.starting_event()
        self.assertEqual(start_ev["stage"], "starting")
        self.assertEqual(start_ev["totalFrames"], 300)

        # 2. Bundling progress
        bundle_ev = parser.parse_line("Bundling 50%...")
        self.assertIsNotNone(bundle_ev)
        if bundle_ev:
            self.assertEqual(bundle_ev["stage"], "bundling")
            self.assertEqual(bundle_ev["percent"], 7)  # 50 * 0.15 = 7.5 -> 7

        # 3. Transition to rendering
        rend_trans = parser.parse_line("Rendering frames...")
        self.assertIsNotNone(rend_trans)
        if rend_trans:
            self.assertEqual(rend_trans["stage"], "rendering")
            self.assertEqual(rend_trans["percent"], 15)

        # 4. Frame progress
        frame_ev = parser.parse_line("Rendering (150/300)")
        self.assertIsNotNone(frame_ev)
        if frame_ev:
            self.assertEqual(frame_ev["stage"], "rendering")
            self.assertEqual(frame_ev["frame"], 150)
            self.assertEqual(frame_ev["totalFrames"], 300)
            self.assertEqual(frame_ev["percent"], 55)  # 15 + (0.5 * 80) = 55

        # 5. Encoding progress
        enc_ev = parser.parse_line("Encoding and muxing audio...")
        self.assertIsNotNone(enc_ev)
        if enc_ev:
            self.assertEqual(enc_ev["stage"], "encoding")
            self.assertEqual(enc_ev["percent"], 96)

        # 6. Complete event
        done_ev = parser.complete_event("/static/output/clip.mp4", "/static/output/clip.mp4")
        self.assertEqual(done_ev["stage"], "done")
        self.assertEqual(done_ev["percent"], 100)

        # 7. Error event
        err_ev = parser.error_event("Render crashed")
        self.assertEqual(err_ev["stage"], "error")
        self.assertEqual(err_ev["message"], "Render crashed")

    def test_remotion_progress_parser_ansi_stripping(self):
        parser = RemotionProgressParser(total_frames=100)
        # Line with ANSI color escapes
        ansi_line = "\x1b[32mRendering\x1b[39m (50/100)"
        clean = parser.clean_line(ansi_line)
        self.assertEqual(clean, "Rendering (50/100)")

    def test_staged_render_context_lifecycle_and_cleanup(self):
        import tempfile
        temp_dir = tempfile.mkdtemp()
        temp_video = os.path.join(temp_dir, "dummy_video.mp4")
        with open(temp_video, "w") as f:
            f.write("dummy video content")

        try:
            comp = RenderComposition(
                original_video=temp_video,
                crop_center_x=960,
                clip_duration=2.0,
                fps=30.0
            )

            props_path_created = None
            staged_video_created = None

            with StagedRenderContext(comp, "test_out.mp4", output_dir=temp_dir) as ctx:
                self.assertIsNotNone(ctx.props_path)
                self.assertIsNotNone(ctx.public_video_path)
                if ctx.props_path and ctx.public_video_path:
                    self.assertTrue(os.path.exists(ctx.props_path))
                    self.assertTrue(os.path.exists(ctx.public_video_path))
                    props_path_created = ctx.props_path
                    staged_video_created = ctx.public_video_path
                self.assertEqual(ctx.frames, 60)

            # Check that files were cleaned up automatically on exit
            if props_path_created:
                self.assertFalse(os.path.exists(props_path_created))
            if staged_video_created:
                self.assertFalse(os.path.exists(staged_video_created))
        finally:
            shutil.rmtree(temp_dir)

    def test_render_pipeline_coordinator_alias(self):
        self.assertIs(RemotionRenderEngine, RenderPipelineCoordinator)



