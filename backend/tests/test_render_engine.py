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
        self.assertFalse(comp.hide_subtitles)

        comp_disabled = RenderComposition(
            original_video="test_video.mp4",
            crop_center_x=960,
            subtitles_enabled=False
        )
        self.assertTrue(comp_disabled.hide_subtitles)

        comp_enabled = RenderComposition(
            original_video="test_video.mp4",
            crop_center_x=960,
            subtitles_enabled=True
        )
        self.assertFalse(comp_enabled.hide_subtitles)

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

            # Test decoupled compile_composition without asset_repository
            comp_decoupled = engine.compile_composition(mock_job, mock_req)
            self.assertEqual(comp_decoupled.original_video, "temp_assets/sources/video.mp4")
            self.assertEqual(comp_decoupled.crop_center_x, 960)  # 50% of default 1920

            # Test backwards-compatible compile_composition with asset_repository
            comp = engine.compile_composition(mock_job, mock_req, mock_asset_repo)
            self.assertEqual(comp.original_video, "temp_assets/sources/video.mp4")
            self.assertEqual(comp.crop_center_x, 960)  # 50% of 1920
            self.assertEqual(comp.volume, 0.5)
            self.assertEqual(comp.fps, 30.0)
            self.assertEqual(comp.position, "bottom")
            self.assertFalse(comp.hide_subtitles)

            # Test with subtitles_enabled=False
            mock_req.subtitles_enabled = False
            comp_no_sub = engine.compile_composition(mock_job, mock_req)
            self.assertTrue(comp_no_sub.hide_subtitles)

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
            
            # Test compile_and_render decoupled from asset_repository
            path_decoupled = engine.compile_and_render(mock_job, mock_req, out_filename="output.mp4")
            self.assertEqual(path_decoupled, "static/output/output.mp4")

            # Test legacy compile_and_render with asset_repository
            path = engine.compile_and_render(mock_job, mock_req, mock_asset_repo, "output.mp4")
            self.assertEqual(path, "static/output/output.mp4")

            # Test compile_and_render_streaming decoupled
            yields_decoupled = list(engine.compile_and_render_streaming(mock_job, mock_req, out_filename="output.mp4"))
            self.assertEqual(yields_decoupled[-1]["stage"], "done")

            # Test compile_and_render_streaming legacy
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
            
            # Unified render decoupled from asset_repository
            res_decoupled = engine.render(mock_job, mock_req, output_name=mock_req.output_name)
            self.assertEqual(res_decoupled["out_filename"], "Epic_Reel.mp4")
            self.assertEqual(res_decoupled["output_url"], "/static/output/Epic_Reel.mp4")

            # Unified render legacy with asset_repository
            res = engine.render(mock_job, mock_req, mock_asset_repo, output_name=mock_req.output_name)
            self.assertEqual(res["out_filename"], "Epic_Reel.mp4")
            self.assertEqual(res["output_url"], "/static/output/Epic_Reel.mp4")

            # Unified render_stream decoupled from asset_repository
            events_decoupled = list(engine.render_stream(mock_job, mock_req, output_name=mock_req.output_name))
            self.assertEqual(events_decoupled[-1]["stage"], "done")
            self.assertEqual(events_decoupled[-1]["outputUrl"], "/static/output/Epic_Reel.mp4")

            # Unified render_stream legacy with asset_repository
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

    def test_remotion_progress_parser_real_cli_format(self):
        parser = RemotionProgressParser(total_frames=300)
        
        # Line 1: Rendered 0/300
        ev0 = parser.parse_line("Rendered 0/300")
        self.assertIsNotNone(ev0)
        if ev0:
            self.assertEqual(ev0["stage"], "rendering")
            self.assertEqual(ev0["frame"], 0)
            self.assertEqual(ev0["totalFrames"], 300)
            self.assertEqual(ev0["percent"], 15)

        # Line 2: Rendered 1/300, time remaining: 1m 57s
        ev1 = parser.parse_line("Rendered 1/300, time remaining: 1m 57s")
        self.assertIsNotNone(ev1)
        if ev1:
            self.assertEqual(ev1["stage"], "rendering")
            self.assertEqual(ev1["frame"], 1)
            self.assertEqual(ev1["etaSeconds"], 117)

        # Line 3: Rendered 150/300, time remaining: 25s
        ev2 = parser.parse_line("Rendered 150/300, time remaining: 25s")
        self.assertIsNotNone(ev2)
        if ev2:
            self.assertEqual(ev2["stage"], "rendering")
            self.assertEqual(ev2["frame"], 150)
            self.assertEqual(ev2["etaSeconds"], 25)
            self.assertEqual(ev2["percent"], 55)

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
                self.assertTrue(ctx.remotion_dir.endswith(os.path.join("shared", "remotion")))
                self.assertEqual(ctx.public_dir, os.path.join(ctx.remotion_dir, "public"))
                self.assertIsNotNone(ctx.props_path)
                self.assertIsNotNone(ctx.public_video_path)
                if ctx.props_path and ctx.public_video_path:
                    self.assertTrue(os.path.exists(ctx.props_path))
                    self.assertTrue(os.path.exists(ctx.public_video_path))
                    with open(ctx.props_path, "r", encoding="utf-8") as f:
                        props_data = json.load(f)
                    self.assertIn("hideSubtitles", props_data)
                    self.assertFalse(props_data["hideSubtitles"])
                    props_path_created = ctx.props_path
                    staged_video_created = ctx.public_video_path
                self.assertEqual(ctx.frames, 60)

            # Test StagedRenderContext with hide_subtitles=True
            comp_no_sub = RenderComposition(
                original_video=temp_video,
                crop_center_x=960,
                clip_duration=2.0,
                fps=30.0,
                hide_subtitles=True
            )
            with StagedRenderContext(comp_no_sub, "test_nosub.mp4", output_dir=temp_dir) as ctx:
                self.assertIsNotNone(ctx.props_path)
                if ctx.props_path:
                    with open(ctx.props_path, "r", encoding="utf-8") as f:
                        props_data = json.load(f)
                    self.assertTrue(props_data["hideSubtitles"])

            # Check that files were cleaned up automatically on exit
            if props_path_created:
                self.assertFalse(os.path.exists(props_path_created))
            if staged_video_created:
                self.assertFalse(os.path.exists(staged_video_created))
        finally:
            shutil.rmtree(temp_dir)

    def test_render_pipeline_coordinator_alias(self):
        self.assertIs(RemotionRenderEngine, RenderPipelineCoordinator)

    def test_render_composition_landscape_background(self):
        import tempfile
        temp_dir = tempfile.mkdtemp()
        temp_video = os.path.join(temp_dir, "dummy_landscape.mp4")
        with open(temp_video, "w") as f:
            f.write("dummy video content")

        try:
            comp = RenderComposition(
                original_video=temp_video,
                crop_center_x=960,
                video_layout="landscape",
                landscape_background="blur",
                landscape_blur_radius=30,
                landscape_darkness=50,
                clip_duration=2.0,
                fps=30.0
            )
            self.assertEqual(comp.video_layout, "landscape")
            self.assertEqual(comp.landscape_background, "blur")
            self.assertEqual(comp.landscape_blur_radius, 30)
            self.assertEqual(comp.landscape_darkness, 50)

            with StagedRenderContext(comp, "test_landscape.mp4", output_dir=temp_dir) as ctx:
                self.assertIsNotNone(ctx.props_path)
                assert ctx.props_path is not None
                with open(ctx.props_path, "r", encoding="utf-8") as f:
                    props = json.load(f)
                self.assertEqual(props.get("videoLayout"), "landscape")
                self.assertEqual(props.get("landscapeBackground"), "blur")
                self.assertEqual(props.get("landscapeBlurRadius"), 30)
                self.assertEqual(props.get("landscapeDarkness"), 50)
        finally:
            shutil.rmtree(temp_dir)

    def test_render_composition_audio_censorship_props(self):
        import tempfile
        temp_dir = tempfile.mkdtemp()
        temp_video = os.path.join(temp_dir, "dummy_censor.mp4")
        with open(temp_video, "w") as f:
            f.write("dummy video content")

        try:
            comp = RenderComposition(
                original_video=temp_video,
                crop_center_x=960,
                clip_duration=2.0,
                fps=30.0,
                censored_segments=[{"start": 0.5, "duration": 0.8, "word": "badword"}],
                bleep_audio_src="/audio/bleep.wav"
            )
            self.assertEqual(len(comp.censored_segments), 1)
            self.assertEqual(comp.bleep_audio_src, "/audio/bleep.wav")

            with StagedRenderContext(comp, "test_censor.mp4", output_dir=temp_dir) as ctx:
                self.assertIsNotNone(ctx.props_path)
                assert ctx.props_path is not None
                with open(ctx.props_path, "r", encoding="utf-8") as f:
                    props = json.load(f)
                self.assertEqual(len(props.get("censoredSegments", [])), 1)
                self.assertEqual(props.get("censoredSegments")[0]["word"], "badword")
                self.assertEqual(props.get("bleepAudioSrc"), "/audio/bleep.wav")
        finally:
            shutil.rmtree(temp_dir)

    def test_resolve_remotion_command_local_bin_exists(self):
        with patch("os.path.isfile", return_value=True):
            cmd = RenderPipelineCoordinator.resolve_remotion_command("/fake/remotion")
            self.assertEqual(len(cmd), 1)
            self.assertTrue(cmd[0].endswith("remotion.cmd") or cmd[0].endswith("remotion"))

    def test_resolve_remotion_command_fallback_windows(self):
        with patch("sys.platform", "win32"), patch("os.path.isfile", return_value=False), patch("shutil.which") as mock_which:
            mock_which.side_effect = lambda c: "C:\\Program Files\\nodejs\\npx.cmd" if c == "npx.cmd" else None
            cmd = RenderPipelineCoordinator.resolve_remotion_command("/fake/remotion")
            self.assertEqual(cmd, ["C:\\Program Files\\nodejs\\npx.cmd", "--package=@remotion/cli", "remotion"])

    def test_resolve_remotion_command_fallback_unix(self):
        with patch("sys.platform", "darwin"), patch("os.path.isfile", return_value=False), patch("shutil.which", return_value="/usr/local/bin/npx"):
            cmd = RenderPipelineCoordinator.resolve_remotion_command("/fake/remotion")
            self.assertEqual(cmd, ["/usr/local/bin/npx", "--package=@remotion/cli", "remotion"])

    def test_build_remotion_cmd_path_normalization(self):
        coordinator = RenderPipelineCoordinator()
        mock_ctx = MagicMock()
        mock_ctx.remotion_dir = "/fake/remotion"
        mock_ctx.props_path = "C:\\Users\\tester\\output\\props_clip.json"
        mock_ctx.frames = 300
        comp = RenderComposition("test.mp4", 960, fps=30.0)

        with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
            cmd = coordinator._build_remotion_cmd(mock_ctx, comp, "static/output/clip.mp4")
            self.assertEqual(cmd[0], "remotion")
            self.assertEqual(cmd[1], "render")
            self.assertIn("--overwrite", cmd)
            self.assertNotIn("--force", cmd)
            # Props path must have forward slashes
            props_idx = cmd.index("--props")
            self.assertEqual(cmd[props_idx + 1], "C:/Users/tester/output/props_clip.json")
            self.assertNotIn("\\", cmd[props_idx + 1])
            # Output path must have forward slashes
            out_idx = props_idx + 2
            self.assertTrue(cmd[out_idx].endswith("/static/output/clip.mp4"))
            self.assertNotIn("\\", cmd[out_idx])

    def test_render_streaming_captures_error_ring_buffer(self):
        coordinator = RenderPipelineCoordinator()
        comp = RenderComposition("test.mp4", 960, fps=30.0, clip_duration=2.0)

        mock_proc = MagicMock()
        mock_proc.stdout.readline.side_effect = [
            "Bundling 10%\n",
            "Error: [Chrome Headless Shell] GPU process launch failed\n",
            "at /shared/remotion/node_modules/remotion/render.js:42\n",
            ""
        ]
        mock_proc.poll.return_value = 1
        mock_proc.returncode = 1

        with patch.object(coordinator, "_build_remotion_cmd", return_value=["npx", "remotion", "render"]), \
             patch("core.render_engine.StagedRenderContext.__enter__", return_value=MagicMock(frames=60, remotion_dir=".")), \
             patch("core.render_engine.StagedRenderContext.__exit__"), \
             patch("subprocess.Popen", return_value=mock_proc):

            events = list(coordinator.render_streaming(comp, "test_out.mp4"))
            error_events = [e for e in events if e.get("stage") == "error"]
            self.assertEqual(len(error_events), 1)
            err_msg = error_events[0]["message"]
            self.assertIn("Remotion exited with code 1", err_msg)
            self.assertIn("GPU process launch failed", err_msg)

    def test_render_engine_decoupled_from_asset_repository(self):
        from core.media_transcoder import MediaTranscoder, FakeMediaAdapter

        mock_req = MagicMock()
        mock_req.fps = 30.0
        mock_req.hook_index = 0
        mock_req.timeline_tracks = []
        mock_req.transcript = [{"text": "Hello world", "start": 0.0, "duration": 1.0}]
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
        mock_req.output_name = "Decoupled_Clip"

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 10.0, "fps": 30.0},
            "hooks": []
        }

        fake_adapter = FakeMediaAdapter(default_width=1280, default_height=720)
        fake_transcoder = MediaTranscoder(adapter=fake_adapter)

        with patch("os.path.exists", return_value=False):
            engine = FakeRenderEngine(media_transcoder=fake_transcoder)

            # 1. compile_composition without asset_repository
            comp = engine.compile_composition(mock_job, mock_req)
            self.assertEqual(comp.source_width, 1280)
            self.assertEqual(comp.source_height, 720)
            self.assertEqual(comp.crop_center_x, 640)  # 50% of 1280

            # 2. render without asset_repository
            res = engine.render(mock_job, mock_req, output_name="Decoupled_Clip")
            self.assertIsNotNone(res)
            self.assertEqual(res["out_filename"], "Decoupled_Clip.mp4")

            # 3. render_stream without asset_repository
            events = list(engine.render_stream(mock_job, mock_req, output_name="Decoupled_Clip"))
            self.assertEqual(events[-1]["stage"], "done")
            self.assertEqual(events[-1]["outputUrl"], "/static/output/Decoupled_Clip.mp4")

    def test_auto_adaptive_subtitles_plumbed_to_staged_props(self):
        import tempfile
        import main as backend_main

        req_off = backend_main.RenderRequest(
            job_id="test_job_adaptive",
            face_tracking=True,
            auto_adaptive_subtitles=False,
            subtitle_position="bottom",
            subtitle_offset=418,
            timeline_tracks=[
                {
                    "id": "video",
                    "items": [{"id": "seg-1", "start": 4.87, "mediaStart": 10.78, "duration": 10.0}],
                }
            ],
            transcript=[{"start": 0.0, "duration": 2.0, "text": "Hello"}],
        )
        self.assertFalse(req_off.auto_adaptive_subtitles)

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 25.0, "fps": 24.0},
            "hooks": [],
        }

        crop_data = [
            {"time": 0.0, "x": 960, "mode": "single"},
            {"time": 10.5, "x": 360, "mode": "split", "top_x": 360, "bottom_x": 1400},
        ]

        engine = FakeRenderEngine()
        orig_exists = os.path.exists
        orig_open = open

        def fake_exists(p):
            if str(p).endswith("crop_map.json") or str(p) == "temp_assets/sources/video.mp4":
                return True
            return orig_exists(p)

        from io import StringIO

        def fake_open(p, mode="r", *a, **kw):
            if "r" in mode and str(p).endswith("crop_map.json"):
                return StringIO(json.dumps(crop_data))
            return orig_open(p, mode, *a, **kw)

        with patch("os.path.exists", side_effect=fake_exists), patch("builtins.open", side_effect=fake_open):
            comp = engine.compile_composition(mock_job, req_off)

        self.assertFalse(comp.auto_adaptive_subtitles)

        tmp_out = tempfile.mkdtemp(prefix="test_stage_adaptive_")
        tmp_pub = os.path.join(tmp_out, "public")
        os.makedirs(tmp_pub, exist_ok=True)
        try:
            ctx = StagedRenderContext(comp, "adaptive_test.mp4", output_dir=tmp_out)
            ctx.public_dir = tmp_pub
            with patch("shutil.copy2", side_effect=lambda src, dst: None):
                ctx.__enter__()
                assert ctx.props_path is not None
                with open(ctx.props_path, "r", encoding="utf-8") as pf:
                    staged_props = json.load(pf)
                ctx.__exit__(None, None, None)

            self.assertFalse(staged_props.get("autoAdaptiveSubtitles"))
            self.assertEqual(staged_props["timelineVideoItems"][0]["mediaStart"], 10.78)
            self.assertEqual(staged_props["cropMap"][1]["mode"], "split")
        finally:
            shutil.rmtree(tmp_out, ignore_errors=True)






