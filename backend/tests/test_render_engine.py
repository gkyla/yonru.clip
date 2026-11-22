import unittest
from unittest.mock import MagicMock, patch, mock_open
import os
import json
import shutil
import sys
import threading
from typing import Any

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.hardware_profiler import FakeHardwareMetricsSource, HardwareProfiler
from core.media_transcoder import FakeMediaAdapter, MediaTranscoder
from core.render_engine import (
    FakeRemotionAdapter,
    FakeRenderEngine,
    RemotionProgressParser,
    RemotionRenderEngine,
    RemotionRunResult,
    RenderComposition,
    RenderPipelineCoordinator,
    StagedRenderContext,
    SubprocessRemotionAdapter,
    compute_ram_concurrency_cap,
    resolve_render_execution_policy,
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
        mock_asset_repo.transcoder = None

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
        mock_asset_repo.transcoder = None

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
        mock_asset_repo.transcoder = None

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
        mock_asset_repo.transcoder = None

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
        hw_profiler = HardwareProfiler(
            metrics_source=FakeHardwareMetricsSource(
                cpu_cores=10,
                system_os="Darwin",
                total_ram_gb=16.0,
                gpu_type="apple_silicon",
            )
        )
        coordinator = RenderPipelineCoordinator(
            media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
            process_adapter=FakeRemotionAdapter(),
            hardware_profiler=hw_profiler,
        )
        mock_ctx = MagicMock()
        mock_ctx.remotion_dir = "/fake/remotion"
        mock_ctx.props_path = "C:\\Users\\tester\\output\\props_clip.json"
        mock_ctx.frames = 300
        comp = RenderComposition("test.mp4", 960, fps=30.0)

        with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
            cmd = coordinator._build_remotion_cmd(mock_ctx, comp, "static/output/clip.mp4")
            self.assertEqual(cmd[0], "remotion")
            self.assertEqual(cmd[1], "render")
            self.assertEqual(cmd[2], ".bundle")
            self.assertIn("--overwrite", cmd)
            self.assertNotIn("--force", cmd)
            self.assertIn("--hardware-acceleration=if-possible", cmd)
            self.assertIn("--concurrency=4", cmd)
            # Props path must have forward slashes
            props_idx = cmd.index("--props")
            self.assertEqual(cmd[props_idx + 1], "C:/Users/tester/output/props_clip.json")
            self.assertNotIn("\\", cmd[props_idx + 1])
            # Output path must have forward slashes
            out_idx = props_idx + 2
            self.assertTrue(cmd[out_idx].endswith("/static/output/clip.mp4"))
            self.assertNotIn("\\", cmd[out_idx])

    def test_render_streaming_captures_error_ring_buffer(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "test.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            remotion_adapter = FakeRemotionAdapter(
                stream_scripts=[
                    {
                        "lines": [
                            "Bundling 10%\n",
                            "Error: [Chrome Headless Shell] GPU process launch failed\n",
                            "at /shared/remotion/node_modules/remotion/render.js:42\n",
                        ],
                        "returncode": 1,
                    }
                ]
            )
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(
                    metrics_source=FakeHardwareMetricsSource(
                        cpu_cores=8,
                        system_os="Linux",
                        total_ram_gb=16.0,
                        gpu_type="cpu",
                    )
                ),
            )
            comp = RenderComposition(video_src, 960, fps=30.0, clip_duration=2.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                self.assertIsNotNone(coordinator.render(comp, "seed_out.mp4"))
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
            dummy_video = os.path.join(tmp_out, "video.mp4")
            with open(dummy_video, "wb") as vf:
                vf.write(b"VIDEO")
            comp.original_video = dummy_video
            with StagedRenderContext(comp, "adaptive_test.mp4", output_dir=tmp_out, public_dir=tmp_pub) as ctx:
                assert ctx.props_path is not None
                with open(ctx.props_path, "r", encoding="utf-8") as pf:
                    staged_props = json.load(pf)

            self.assertFalse(staged_props.get("autoAdaptiveSubtitles"))
            self.assertEqual(staged_props["timelineVideoItems"][0]["mediaStart"], 10.78)
            self.assertEqual(staged_props["cropMap"][1]["mode"], "split")
        finally:
            shutil.rmtree(tmp_out, ignore_errors=True)

    def test_multi_track_nle_stacking_render_composition(self):
        import main as backend_main

        req = backend_main.RenderRequest(
            job_id="test_job_nle",
            timeline_tracks=[
                {
                    "id": "text-3",
                    "name": "Text 3",
                    "type": "text",
                    "hidden": True,
                    "items": [{"id": "txt-hidden", "content": "Hidden", "start": 0.0, "duration": 25.0}],
                },
                {
                    "id": "text-2",
                    "name": "Text 2",
                    "type": "text",
                    "hidden": False,
                    "items": [{"id": "txt-top", "content": "Top", "start": 0.0, "duration": 4.0}],
                },
                {
                    "id": "text",
                    "name": "Text 1",
                    "type": "text",
                    "hidden": False,
                    "items": [{"id": "txt-bottom", "content": "Bottom", "start": 0.0, "duration": 5.0}],
                },
                {
                    "id": "video",
                    "name": "Main Video",
                    "type": "video",
                    "items": [{"id": "vid-1", "start": 0.0, "duration": 10.0}],
                },
                {
                    "id": "audio",
                    "name": "Audio 1",
                    "type": "audio",
                    "muted": False,
                    "items": [{"id": "aud-1", "name": "bgm.mp3", "start": 0.0, "duration": 8.0}],
                },
                {
                    "id": "audio-2",
                    "name": "Audio 2",
                    "type": "audio",
                    "muted": False,
                    "items": [{"id": "aud-2", "name": "sfx.mp3", "start": 1.0, "duration": 60.0}],
                },
                {
                    "id": "audio-3",
                    "name": "Audio 3",
                    "type": "audio",
                    "muted": True,
                    "items": [{"id": "aud-muted", "name": "muted.mp3", "start": 0.0, "duration": 4.0}],
                },
            ],
            transcript=[{"start": 0.0, "duration": 2.0, "text": "Hello"}],
        )

        mock_job = {
            "clip_path": "temp_assets/sources/video.mp4",
            "video_info": {"file_path": "temp_assets/sources/video.mp4", "duration": 25.0, "fps": 30.0},
            "hooks": [],
        }

        engine = FakeRenderEngine()
        orig_exists = os.path.exists

        def fake_exists(p):
            if str(p) == "temp_assets/sources/video.mp4":
                return True
            return orig_exists(p)

        with patch("os.path.exists", side_effect=fake_exists):
            comp = engine.compile_composition(mock_job, req)

        # Text tracks filtered for hidden and ordered bottom-to-top (Text 1 then Text 2)
        self.assertEqual([i["id"] for i in (comp.timeline_text_items or [])], ["txt-bottom", "txt-top"])
        # Audio tracks aggregate non-muted tracks only
        self.assertEqual([i["id"] for i in (comp.timeline_audio_items or [])], ["aud-1", "aud-2"])
        # Video track resolved cleanly
        self.assertEqual([i["id"] for i in (comp.timeline_video_items or [])], ["vid-1"])
        # Neither hidden text-3 (25s) nor audio-2 (61s) extends clip duration past 10.0s
        self.assertEqual(comp.clip_duration, 10.0)

        # Empty video items with NLE text at index 0 must NOT fallback to text items
        req_empty_video = backend_main.RenderRequest(
            job_id="test_job_nle_empty_vid",
            timeline_tracks=[
                {"id": "text", "type": "text", "items": [{"id": "t1", "start": 0.0, "duration": 3.0}]},
                {"id": "video", "type": "video", "items": []},
            ],
            transcript=[],
        )
        with patch("os.path.exists", side_effect=fake_exists):
            comp_empty = engine.compile_composition(mock_job, req_empty_video)
        self.assertEqual(comp_empty.timeline_video_items, [])

    def test_compile_composition_uses_clip_session_store_and_persists_crop_map(self):
        import tempfile
        import main as backend_main
        from core.clip_session_store import ClipSessionStore
        from core.face_tracker import MockFaceTracker

        with tempfile.TemporaryDirectory() as tmp_dir:
            clips_dir = os.path.join(tmp_dir, "clips")
            clip_dir = os.path.join(clips_dir, "demo_src", "0_12_hook")
            os.makedirs(clip_dir, exist_ok=True)
            video_path = os.path.join(clip_dir, "video.mp4")
            with open(video_path, "wb") as f:
                f.write(b"VIDEO")
            with open(os.path.join(clip_dir, "transcript.json"), "w", encoding="utf-8") as f:
                json.dump([{"text": "Hello clip", "start": 0.0, "duration": 1.0}], f)
            cover_path = os.path.join(clip_dir, "cover.jpg")
            with open(cover_path, "wb") as f:
                f.write(b"COVER_JPG")

            store = ClipSessionStore(clips_dir=clips_dir, output_dir=tmp_dir)
            tracker = MockFaceTracker(mock_result=[{"time": 0.0, "x": 615}, {"time": 1.5, "x": 640}])
            engine = FakeRenderEngine(face_tracker=tracker, clip_session_store=store)

            req = backend_main.RenderRequest(
                job_id="job_store_test",
                face_tracking=True,
                cover_enabled=True,
                cover_duration=1.5,
            )
            job = {
                "job_id": "job_store_test",
                "clip_path": video_path,
                "clip_duration": 12.0,
                "folder_name": "demo_src",
                "clip_id": "0_12_hook",
                "video_info": {"file_path": os.path.join(tmp_dir, "sources", "demo_src", "video.mp4"), "duration": 12.0, "fps": 30.0},
                "hooks": [],
            }

            comp1 = engine.compile_composition(job, req)
            self.assertEqual([w["word"] for w in (comp1.words_data or [])], ["Hello", "clip"])
            self.assertIsNotNone(comp1.thumbnail_config)
            assert comp1.thumbnail_config is not None
            self.assertEqual(comp1.thumbnail_config["imagePath"], cover_path)
            self.assertTrue(comp1.thumbnail_config["enabled"])
            self.assertEqual(comp1.crop_center_x, [{"time": 0.0, "x": 615}, {"time": 1.5, "x": 640}])
            self.assertEqual(tracker.analyzed_paths, [video_path])
            # ADR-0008 §6: cache-miss tracking must persist crop_map.json
            self.assertEqual(store.get_crop_map("demo_src", "0_12_hook"), [{"time": 0.0, "x": 615}, {"time": 1.5, "x": 640}])

            # Second compile_composition hits persisted crop_map.json with zero tracker invocations
            comp2 = engine.compile_composition(job, req)
            self.assertEqual(comp2.crop_center_x, [{"time": 0.0, "x": 615}, {"time": 1.5, "x": 640}])
            self.assertEqual(tracker.analyzed_paths, [video_path])

    def test_compile_composition_fallback_closes_temporary_face_tracker(self):
        import tempfile
        import main as backend_main

        with tempfile.TemporaryDirectory() as tmp_dir:
            video_path = os.path.join(tmp_dir, "video.mp4")
            with open(video_path, "wb") as f:
                f.write(b"VIDEO")

            req = backend_main.RenderRequest(job_id="job_fallback_close", face_tracking=True)
            job = {
                "job_id": "job_fallback_close",
                "clip_path": video_path,
                "clip_duration": 5.0,
                "video_info": {"file_path": video_path, "duration": 5.0, "fps": 30.0},
                "hooks": [],
            }

            mock_tracker = MagicMock()
            mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 640}]
            engine = FakeRenderEngine(face_tracker=None, clip_session_store=None)

            with patch("core.face_tracker.FaceTracker", return_value=mock_tracker):
                comp = engine.compile_composition(job, req)

            self.assertEqual(comp.crop_center_x, [{"time": 0.0, "x": 640}])
            mock_tracker.close.assert_called_once()

            failing_tracker = MagicMock()
            failing_tracker.analyze_video.side_effect = RuntimeError("boom")
            with patch("core.face_tracker.FaceTracker", return_value=failing_tracker):
                with self.assertRaises(RuntimeError):
                    engine.compile_composition(job, req)
            failing_tracker.close.assert_called_once()

    def test_shallow_passthrough_render_helpers_are_deleted(self):
        from core.render_engine import RenderEngine
        self.assertFalse(hasattr(RenderEngine, "compile_and_render"))
        self.assertFalse(hasattr(RenderEngine, "compile_and_render_streaming"))
        self.assertFalse(hasattr(RenderPipelineCoordinator, "_prepare_props_and_paths"))

    def test_staged_render_context_hardlinks_video_cover_and_audio_and_preserves_originals(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            src_dir = os.path.join(tmp_dir, "sources")
            audio_dir = os.path.join(tmp_dir, "audio_library")
            out_dir = os.path.join(tmp_dir, "output")
            pub_dir = os.path.join(tmp_dir, "bundle_public")
            os.makedirs(src_dir, exist_ok=True)
            os.makedirs(audio_dir, exist_ok=True)

            video_src = os.path.join(src_dir, "video.mp4")
            cover_src = os.path.join(src_dir, "cover.jpg")
            audio_src = os.path.join(audio_dir, "bgm.mp3")

            with open(video_src, "wb") as f:
                f.write(b"VIDEO_BYTES_123")
            with open(cover_src, "wb") as f:
                f.write(b"COVER_BYTES_456")
            with open(audio_src, "wb") as f:
                f.write(b"AUDIO_BYTES_789")

            comp = RenderComposition(
                original_video=video_src,
                crop_center_x=960,
                clip_duration=2.0,
                fps=30.0,
                thumbnail_config={"enabled": True, "duration": 1.0, "imagePath": cover_src},
                timeline_audio_items=[
                    {"id": "aud-1", "src": "/assets/audio_library/bgm.mp3", "start": 0.0, "duration": 2.0}
                ],
            )

            with StagedRenderContext(
                comp,
                "clip_link.mp4",
                output_dir=out_dir,
                public_dir=pub_dir,
                audio_library_dir=audio_dir,
            ) as ctx:
                assert ctx.public_video_path is not None
                assert ctx.thumbnail_image_path is not None
                assert len(ctx.staged_audio_paths) == 1

                self.assertEqual(os.stat(ctx.public_video_path).st_ino, os.stat(video_src).st_ino)
                self.assertEqual(os.stat(ctx.thumbnail_image_path).st_ino, os.stat(cover_src).st_ino)
                self.assertEqual(os.stat(ctx.staged_audio_paths[0]).st_ino, os.stat(audio_src).st_ino)

                staged_video = ctx.public_video_path
                staged_cover = ctx.thumbnail_image_path
                staged_audio = ctx.staged_audio_paths[0]
                staged_props = ctx.props_path

            self.assertFalse(os.path.exists(staged_video))
            self.assertFalse(os.path.exists(staged_cover))
            self.assertFalse(os.path.exists(staged_audio))
            assert staged_props is not None
            self.assertFalse(os.path.exists(staged_props))

            with open(video_src, "rb") as f:
                self.assertEqual(f.read(), b"VIDEO_BYTES_123")
            with open(cover_src, "rb") as f:
                self.assertEqual(f.read(), b"COVER_BYTES_456")
            with open(audio_src, "rb") as f:
                self.assertEqual(f.read(), b"AUDIO_BYTES_789")

    def test_staged_render_context_falls_back_to_copy_on_exdev(self):
        import errno
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            out_dir = os.path.join(tmp_dir, "output")
            pub_dir = os.path.join(tmp_dir, "public")
            video_src = os.path.join(tmp_dir, "video.mp4")
            with open(video_src, "wb") as f:
                f.write(b"CROSS_DEVICE_BYTES")

            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=1.0, fps=30.0)
            exdev_err = OSError(errno.EXDEV, "Invalid cross-device link")

            with patch("os.link", side_effect=exdev_err):
                with StagedRenderContext(comp, "exdev_clip.mp4", output_dir=out_dir, public_dir=pub_dir) as ctx:
                    assert ctx.public_video_path is not None
                    self.assertTrue(os.path.exists(ctx.public_video_path))
                    with open(ctx.public_video_path, "rb") as f:
                        self.assertEqual(f.read(), b"CROSS_DEVICE_BYTES")
                    staged_video = ctx.public_video_path

            self.assertFalse(os.path.exists(staged_video))
            self.assertTrue(os.path.exists(video_src))

    def test_staged_render_context_replaces_stale_dest_and_cleans_on_enter_error(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            out_dir = os.path.join(tmp_dir, "output")
            pub_dir = os.path.join(tmp_dir, "public")
            os.makedirs(pub_dir, exist_ok=True)

            video_src = os.path.join(tmp_dir, "video.mp4")
            with open(video_src, "wb") as f:
                f.write(b"FRESH_VIDEO")

            stale_dst = os.path.join(pub_dir, "source_stale_clip.mp4")
            with open(stale_dst, "wb") as f:
                f.write(b"STALE_CONTENT")

            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=1.0, fps=30.0)

            with patch("json.dump", side_effect=OSError("disk full")):
                ctx = StagedRenderContext(comp, "stale_clip.mp4", output_dir=out_dir, public_dir=pub_dir)
                with self.assertRaises(OSError):
                    ctx.__enter__()

            self.assertFalse(os.path.exists(stale_dst))
            with open(video_src, "rb") as f:
                self.assertEqual(f.read(), b"FRESH_VIDEO")

    def test_staged_render_context_rejects_unsafe_out_filename_and_dereferences_symlinks(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            out_dir = os.path.join(tmp_dir, "output")
            pub_dir = os.path.join(tmp_dir, "public")
            real_video = os.path.join(tmp_dir, "real_video.mp4")
            symlink_video = os.path.join(tmp_dir, "link_video.mp4")
            with open(real_video, "wb") as f:
                f.write(b"SYMLINK_TARGET_BYTES")
            os.symlink(real_video, symlink_video)

            bad_comp = RenderComposition(original_video=real_video, crop_center_x=960, clip_duration=1.0, fps=30.0)
            with self.assertRaises(ValueError):
                StagedRenderContext(bad_comp, "../evil.mp4", output_dir=out_dir, public_dir=pub_dir).__enter__()

            sym_comp = RenderComposition(original_video=symlink_video, crop_center_x=960, clip_duration=1.0, fps=30.0)
            with StagedRenderContext(sym_comp, "sym_clip.mp4", output_dir=out_dir, public_dir=pub_dir) as ctx:
                assert ctx.public_video_path is not None
                self.assertFalse(os.path.islink(ctx.public_video_path))
                self.assertEqual(os.stat(ctx.public_video_path).st_ino, os.stat(real_video).st_ino)

    def _create_temp_remotion_project(self, root_dir: str) -> str:
        remotion_dir = os.path.join(root_dir, "shared", "remotion")
        src_dir = os.path.join(remotion_dir, "src")
        os.makedirs(src_dir, exist_ok=True)
        files = {
            "package.json": '{"name": "@yonru/remotion", "version": "0.3.0"}\n',
            "package-lock.json": '{"lockfileVersion": 3}\n',
            "remotion.config.ts": "export default {};\n",
            "tsconfig.json": '{"compilerOptions": {}}\n',
            os.path.join("src", "index.ts"): "import { registerRoot } from 'remotion';\n",
            os.path.join("src", "Composition.tsx"): "export const Composition = () => null;\n",
        }
        for rel_path, content in files.items():
            full_path = os.path.join(remotion_dir, rel_path)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
        return remotion_dir

    def test_bundle_cache_cold_build_then_warm_hit_and_source_invalidation(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO_CONTENT_FOR_BUNDLE")

            seen_inodes = []

            def fake_run_handler(cmd, cwd, _env, _cancel_event):
                if "bundle" in cmd:
                    out_idx = cmd.index("--out-dir")
                    bundle_path = os.path.join(cwd or remotion_dir, cmd[out_idx + 1])
                    os.makedirs(bundle_path, exist_ok=True)
                    with open(os.path.join(bundle_path, "index.html"), "w", encoding="utf-8") as f:
                        f.write("<html><body>bundle</body></html>")
                elif "render" in cmd:
                    staged = os.path.join(cwd or remotion_dir, ".bundle", "public", "source_clip1.mp4")
                    self.assertTrue(os.path.exists(staged))
                    seen_inodes.append(os.stat(staged).st_ino)
                return RemotionRunResult(returncode=0)

            remotion_adapter = FakeRemotionAdapter(run_handler=fake_run_handler)
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                res1 = coordinator.render(comp, "clip1.mp4")
                self.assertEqual(res1, os.path.join(out_dir, "clip1.mp4"))

                recorded_cmds = [c["cmd"] for c in remotion_adapter.calls]
                bundle_cmds_1 = [c for c in recorded_cmds if "bundle" in c]
                render_cmds_1 = [c for c in recorded_cmds if "render" in c]
                self.assertEqual(len(bundle_cmds_1), 1)
                self.assertEqual(bundle_cmds_1[0], ["remotion", "bundle", "src/index.ts", "--out-dir", ".bundle"])
                self.assertEqual(len(render_cmds_1), 1)
                self.assertEqual(render_cmds_1[0][2], ".bundle")

                bundle_dir = os.path.join(remotion_dir, ".bundle")
                hash_file = os.path.join(bundle_dir, ".bundle.hash")
                self.assertTrue(os.path.isfile(hash_file))
                with open(hash_file, "r", encoding="utf-8") as f:
                    hash1 = f.read().strip()
                self.assertEqual(len(hash1), 64)
                self.assertEqual(seen_inodes, [os.stat(video_src).st_ino])
                self.assertFalse(os.path.exists(os.path.join(bundle_dir, "public", "source_clip1.mp4")))

                # Second export with unchanged sources: 0 bundle calls and logs cache hit
                remotion_adapter.calls.clear()
                printed_logs = []
                with patch("builtins.print", side_effect=lambda *args, **kwargs: printed_logs.append(" ".join(str(a) for a in args))):
                    res2 = coordinator.render(comp, "clip1.mp4")
                self.assertEqual(res2, os.path.join(out_dir, "clip1.mp4"))
                recorded_cmds_2 = [c["cmd"] for c in remotion_adapter.calls]
                self.assertEqual([c for c in recorded_cmds_2 if "bundle" in c], [])
                self.assertEqual(len([c for c in recorded_cmds_2 if "render" in c]), 1)
                self.assertTrue(
                    any("[render-engine] Reusing cached Remotion bundle:" in msg for msg in printed_logs),
                    f"Expected cache-hit log in {printed_logs}",
                )

                # Modify source file: triggers re-bundle and updates hash
                with open(os.path.join(remotion_dir, "src", "Composition.tsx"), "w", encoding="utf-8") as f:
                    f.write("export const Composition = () => 1;\n")

                remotion_adapter.calls.clear()
                res3 = coordinator.render(comp, "clip1.mp4")
                self.assertEqual(res3, os.path.join(out_dir, "clip1.mp4"))
                recorded_cmds_3 = [c["cmd"] for c in remotion_adapter.calls]
                self.assertEqual(len([c for c in recorded_cmds_3 if "bundle" in c]), 1)
                self.assertEqual(len([c for c in recorded_cmds_3 if "render" in c]), 1)
                with open(hash_file, "r", encoding="utf-8") as f:
                    hash2 = f.read().strip()
                self.assertNotEqual(hash1, hash2)

    def test_bundle_cache_recovers_corrupt_dir_and_handles_bundle_failure(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            bundle_dir = os.path.join(remotion_dir, ".bundle")
            os.makedirs(bundle_dir, exist_ok=True)
            garbage_path = os.path.join(bundle_dir, "garbage.txt")
            with open(garbage_path, "w", encoding="utf-8") as f:
                f.write("corrupt")

            def fake_run_recover(cmd, _cwd, _env, _cancel_event):
                if "bundle" in cmd:
                    self.assertFalse(os.path.exists(bundle_dir))
                    os.makedirs(bundle_dir, exist_ok=True)
                    with open(os.path.join(bundle_dir, "index.html"), "w", encoding="utf-8") as f:
                        f.write("<html>recovered</html>")
                return RemotionRunResult(returncode=0)

            remotion_adapter = FakeRemotionAdapter(run_handler=fake_run_recover)
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                self.assertEqual(coordinator.render(comp, "recovered.mp4"), os.path.join(out_dir, "recovered.mp4"))

                # Force cache miss and simulate bundle failure
                shutil.rmtree(bundle_dir)
                remotion_adapter.run_handler = None
                remotion_adapter.run_results = [
                    RemotionRunResult(returncode=1, stderr="bundle boom"),
                    RemotionRunResult(returncode=1, stderr="bundle boom"),
                ]

                self.assertIsNone(coordinator.render(comp, "fail.mp4"))
                self.assertFalse(os.path.exists(os.path.join(bundle_dir, ".bundle.hash")))

                events = list(coordinator.render_streaming(comp, "fail.mp4"))
                error_events = [e for e in events if e.get("stage") == "error"]
                self.assertEqual(len(error_events), 1)
                self.assertIn("bundle boom", error_events[0]["message"])

    def test_render_streaming_emits_immediate_done_without_sleep(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            remotion_adapter = FakeRemotionAdapter(
                stream_scripts=[
                    {
                        "lines": [
                            "Rendered 0/60\n",
                            "Rendered 60/60\n",
                            "Encoding and muxing audio...\n",
                        ],
                        "returncode": 0,
                    }
                ]
            )
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                self.assertIsNotNone(coordinator.render(comp, "warm_seed.mp4"))
                with patch("core.render_engine.time.sleep") as mock_sleep:
                    events = list(coordinator.render_streaming(comp, "fast_clip.mp4"))

            mock_sleep.assert_not_called()
            stream_calls = [c for c in remotion_adapter.calls if c["method"] == "stream"]
            self.assertEqual(len(stream_calls), 1)
            self.assertEqual(stream_calls[0]["cmd"][2], ".bundle")
            self.assertFalse(any(e.get("stage") == "encoding" and e.get("percent") == 98 for e in events))
            self.assertEqual(
                events[-1],
                {
                    "stage": "done",
                    "percent": 100,
                    "frame": 60,
                    "totalFrames": 60,
                    "outputPath": os.path.join(out_dir, "fast_clip.mp4"),
                    "outputUrl": "/static/output/fast_clip.mp4",
                },
            )

    def test_generator_exit_teardown_ordering_kills_process_before_cleanup(self):
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            target_mp4 = os.path.join(out_dir, "abort_clip.mp4")
            staged_video = os.path.join(remotion_dir, ".bundle", "public", "source_abort_clip.mp4")
            props_file = os.path.join(out_dir, "props_abort_clip.mp4.json")
            order_log: list[str] = []

            def on_terminate_cb():
                # Step 1: Process must die while partial MP4 and staged assets are still present
                self.assertTrue(os.path.exists(target_mp4))
                self.assertTrue(os.path.exists(staged_video))
                self.assertTrue(os.path.exists(props_file))
                order_log.append("process_killed_and_reaped")

            def stream_handler(_cmd, _cwd, _env, _cancel_event):
                os.makedirs(out_dir, exist_ok=True)
                with open(target_mp4, "wb") as mf:
                    mf.write(b"PARTIAL_MP4_BYTES")
                yield "Rendered 10/60\n"
                yield "Rendered 20/60\n"
                return RemotionRunResult(returncode=0)

            remotion_adapter = FakeRemotionAdapter(
                stream_handler=stream_handler,
                on_terminate=on_terminate_cb,
            )
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            # Seed bundle first
            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                self.assertIsNotNone(coordinator.render(comp, "warm.mp4"))

            orig_remove_partial = coordinator._remove_partial_output
            orig_stage_ctx = coordinator._stage_render_context

            def tracked_remove_partial(path: str) -> None:
                self.assertEqual(order_log, ["process_killed_and_reaped"])
                self.assertTrue(os.path.exists(staged_video))
                orig_remove_partial(path)
                order_log.append("partial_mp4_deleted")

            class TrackedStageContext(StagedRenderContext):
                def _cleanup(self) -> None:
                    self.assert_order_and_clean()
                    super()._cleanup()
                    order_log.append("staged_assets_cleaned")

                def assert_order_and_clean(self) -> None:
                    assert order_log == ["process_killed_and_reaped", "partial_mp4_deleted"]
                    assert not os.path.exists(target_mp4)

            def tracked_stage(c, name, bdir):
                return TrackedStageContext(
                    c,
                    name,
                    coordinator.output_dir,
                    remotion_dir=coordinator.remotion_dir,
                    public_dir=os.path.join(bdir, "public"),
                    audio_library_dir=coordinator.audio_library_dir,
                )

            coordinator._remove_partial_output = tracked_remove_partial  # type: ignore[method-assign]
            coordinator._stage_render_context = tracked_stage  # type: ignore[method-assign]

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                gen = coordinator.render_streaming(comp, "abort_clip.mp4")
                first = next(gen)
                self.assertEqual(first["stage"], "starting")
                second = next(gen)
                self.assertEqual(second["stage"], "rendering")
                gen.close()

            self.assertEqual(
                order_log,
                ["process_killed_and_reaped", "partial_mp4_deleted", "staged_assets_cleaned"],
            )
            self.assertEqual(remotion_adapter.terminated_count, 1)
            self.assertFalse(os.path.exists(target_mp4))
            self.assertFalse(os.path.exists(staged_video))
            self.assertFalse(os.path.exists(props_file))

    def test_cancel_during_remotion_bundle_cleans_incomplete_bundle_dir(self):
        import tempfile
        import threading

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            bundle_dir = os.path.join(remotion_dir, ".bundle")
            cancel_ev = threading.Event()

            def bundle_cancel_handler(cmd, cwd, _env, c_ev):
                if "bundle" in cmd:
                    os.makedirs(bundle_dir, exist_ok=True)
                    with open(os.path.join(bundle_dir, "partial_chunk.js"), "w", encoding="utf-8") as bf:
                        bf.write("incomplete")
                    if c_ev is not None:
                        c_ev.set()
                    return RemotionRunResult(returncode=-1, cancelled=True)
                return RemotionRunResult(returncode=0)

            remotion_adapter = FakeRemotionAdapter(run_handler=bundle_cancel_handler)
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                events = list(coordinator.render_streaming(comp, "cancel_bundle.mp4", cancel_event=cancel_ev))

            self.assertFalse(any(e.get("stage") == "done" for e in events))
            self.assertFalse(any(e.get("stage") == "error" for e in events))
            self.assertFalse(os.path.exists(bundle_dir))
            self.assertFalse(os.path.exists(os.path.join(bundle_dir, ".bundle.hash")))

            # Sync path cancellation during bundle also cleans incomplete .bundle/
            cancel_ev.clear()
            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                self.assertIsNone(coordinator._render_comp(comp, "cancel_bundle_sync.mp4", cancel_event=cancel_ev))
            self.assertFalse(os.path.exists(bundle_dir))

    def test_partial_mp4_deletion_policy_on_cancel_failure_success_and_preexisting(self):
        import tempfile
        import threading

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            os.makedirs(out_dir, exist_ok=True)
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            remotion_adapter = FakeRemotionAdapter()
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(
                    FakeHardwareMetricsSource(system_os="Linux", gpu_type="cpu")
                ),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                # Seed warm bundle
                self.assertIsNotNone(coordinator.render(comp, "seed.mp4"))

                # 1. Newly created MP4 deleted on cancel
                cancel_ev = threading.Event()
                cancel_out = os.path.join(out_dir, "new_cancel.mp4")

                def cancel_after_write(_cmd, _cwd, _env, c_ev):
                    with open(cancel_out, "wb") as mf:
                        mf.write(b"PARTIAL")
                    if c_ev is not None:
                        c_ev.set()
                    yield "Rendered 5/60\n"
                    return RemotionRunResult(returncode=-1, cancelled=True)

                remotion_adapter.stream_handler = cancel_after_write
                list(coordinator.render_streaming(comp, "new_cancel.mp4", cancel_event=cancel_ev))
                self.assertFalse(os.path.exists(cancel_out))

                # 2. Newly created MP4 deleted on non-zero failure
                remotion_adapter.stream_handler = None
                fail_out = os.path.join(out_dir, "new_fail.mp4")
                remotion_adapter.stream_scripts = [
                    {"lines": ["Error: crash\n"], "returncode": 1, "write_output_bytes": b"CORRUPT"}
                ]
                events = list(coordinator.render_streaming(comp, "new_fail.mp4"))
                self.assertEqual(events[-1]["stage"], "error")
                self.assertFalse(os.path.exists(fail_out))

                # 3. Newly created MP4 preserved on clean success
                ok_out = os.path.join(out_dir, "clean_ok.mp4")
                remotion_adapter.stream_scripts = [
                    {"lines": ["Rendered 60/60\n"], "returncode": 0, "write_output_bytes": b"VALID_MP4"}
                ]
                events_ok = list(coordinator.render_streaming(comp, "clean_ok.mp4"))
                self.assertEqual(events_ok[-1]["stage"], "done")
                self.assertTrue(os.path.exists(ok_out))
                with open(ok_out, "rb") as mf:
                    self.assertEqual(mf.read(), b"VALID_MP4")

                # 4. Pre-existing MP4 preserved on failed run
                pre_out = os.path.join(out_dir, "preexisting.mp4")
                with open(pre_out, "wb") as mf:
                    mf.write(b"EXISTING_GOOD_MP4")
                remotion_adapter.stream_scripts = [
                    {"lines": ["Error: aborted overwrite\n"], "returncode": 1}
                ]
                events_pre = list(coordinator.render_streaming(comp, "preexisting.mp4"))
                self.assertEqual(events_pre[-1]["stage"], "error")
                self.assertTrue(os.path.exists(pre_out))

    def test_hardware_acceleration_and_ram_concurrency_policy_matrix(self):
        from core.config_store import InMemoryConfigStore
        import tempfile

        # RAM concurrency caps across all tiers
        self.assertEqual(compute_ram_concurrency_cap(4.0), 1)
        self.assertEqual(compute_ram_concurrency_cap(7.9), 1)
        self.assertEqual(compute_ram_concurrency_cap(8.0), 2)
        self.assertEqual(compute_ram_concurrency_cap(11.9), 2)
        self.assertEqual(compute_ram_concurrency_cap(12.0), 3)
        self.assertEqual(compute_ram_concurrency_cap(15.9), 3)
        self.assertEqual(compute_ram_concurrency_cap(16.0), 4)
        self.assertEqual(compute_ram_concurrency_cap(23.9), 4)
        self.assertEqual(compute_ram_concurrency_cap(24.0), 6)
        self.assertEqual(compute_ram_concurrency_cap(31.9), 6)
        self.assertEqual(compute_ram_concurrency_cap(32.0), 8)
        self.assertEqual(compute_ram_concurrency_cap(64.0), 8)

        # Platform & GPU matrix
        cases = [
            # (system_os, gpu_type, cores, ram_gb, expected_hw, expected_conc)
            ("Darwin", "apple_silicon", 8, 8.0, "if-possible", 2),
            ("Darwin", "apple_silicon", 10, 16.0, "if-possible", 4),
            ("Darwin", "apple_silicon", 14, 36.0, "if-possible", 7),
            ("Darwin", "cpu", 8, 16.0, "if-possible", 4),  # Intel Mac -> VideoToolbox
            ("Linux", "cuda", 16, 32.0, "if-possible", 8),
            ("Windows", "cuda", 12, 24.0, "if-possible", 6),
            ("Windows", "cpu", 8, 16.0, "disable", 4),
            ("Linux", "cpu", 2, 16.0, "disable", 1),
            ("Linux", "cpu", 1, 16.0, "disable", 1),
        ]
        for os_name, gpu_type, cores, ram_gb, exp_hw, exp_conc in cases:
            metrics = FakeHardwareMetricsSource(
                cpu_cores=cores,
                system_os=os_name,
                total_ram_gb=ram_gb,
                gpu_type=gpu_type,
            ).probe_metrics()
            policy = resolve_render_execution_policy(metrics)
            self.assertEqual(policy.hardware_acceleration, exp_hw, f"{os_name}/{gpu_type}")
            self.assertEqual(policy.concurrency, exp_conc, f"{os_name}/{cores}c/{ram_gb}gb")
            self.assertFalse(policy.hw_accel_explicit)

        # Overrides: valid, clamped, and invalid fallbacks
        m8 = FakeHardwareMetricsSource(cpu_cores=8, system_os="Darwin", total_ram_gb=16.0, gpu_type="apple_silicon").probe_metrics()
        p_req = resolve_render_execution_policy(m8, hardware_acceleration_override="required", concurrency_override="99")
        self.assertEqual(p_req.hardware_acceleration, "required")
        self.assertTrue(p_req.hw_accel_explicit)
        self.assertEqual(p_req.concurrency, 8)  # clamped to cpu_cores

        p_zero = resolve_render_execution_policy(m8, hardware_acceleration_override="invalid", concurrency_override="0")
        self.assertEqual(p_zero.hardware_acceleration, "if-possible")
        self.assertFalse(p_zero.hw_accel_explicit)
        self.assertEqual(p_zero.concurrency, 1)  # clamped to >= 1

        p_bad_conc = resolve_render_execution_policy(m8, hardware_acceleration_override="disable", concurrency_override="not-a-number")
        self.assertEqual(p_bad_conc.hardware_acceleration, "disable")
        self.assertEqual(p_bad_conc.concurrency, 4)

        # Lazy probing & single in-memory caching across renders
        class CountingMetricsSource(FakeHardwareMetricsSource):
            def __init__(self):
                super().__init__(cpu_cores=12, system_os="Darwin", total_ram_gb=24.0, gpu_type="apple_silicon")
                self.probe_calls = 0

            def probe_metrics(self):
                self.probe_calls += 1
                return super().probe_metrics()

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            counting_source = CountingMetricsSource()
            cfg = InMemoryConfigStore({})
            remotion_adapter = FakeRemotionAdapter()
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                config_store=cfg,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(metrics_source=counting_source),
            )
            # Zero startup latency: never probes in __init__
            self.assertEqual(counting_source.probe_calls, 0)

            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)
            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                coordinator.render(comp, "r1.mp4")
                self.assertEqual(counting_source.probe_calls, 1)
                coordinator.render(comp, "r2.mp4")
                self.assertEqual(counting_source.probe_calls, 1)

            render_calls = [c for c in remotion_adapter.calls if "render" in c["cmd"]]
            self.assertIn("--hardware-acceleration=if-possible", render_calls[0]["cmd"])
            self.assertIn("--concurrency=6", render_calls[0]["cmd"])

    def test_hardware_acceleration_one_shot_software_fallback(self):
        from core.config_store import InMemoryConfigStore
        import tempfile
        import threading

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            cfg = InMemoryConfigStore({})
            remotion_adapter = FakeRemotionAdapter()
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                config_store=cfg,
                media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(
                    FakeHardwareMetricsSource(cpu_cores=8, system_os="Linux", total_ram_gb=16.0, gpu_type="cuda")
                ),
            )
            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)

            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                # Seed bundle once
                self.assertIsNotNone(coordinator.render(comp, "seed.mp4"))

                # 1. Streaming: early GPU failure -> one-shot retry with --hardware-acceleration=disable -> done
                remotion_adapter.calls.clear()
                remotion_adapter.stream_scripts = [
                    {
                        "lines": ["Error: h264_nvenc encoder initialization failed\n"],
                        "returncode": 1,
                        "write_output_bytes": b"BAD_GPU_MP4",
                    },
                    {
                        "lines": ["Rendered 60/60\n", "Encoding...\n"],
                        "returncode": 0,
                        "write_output_bytes": b"GOOD_CPU_MP4",
                    },
                ]
                events = list(coordinator.render_streaming(comp, "fallback_stream.mp4"))
                self.assertEqual(events[-1]["stage"], "done")
                stream_calls = [c for c in remotion_adapter.calls if c["method"] == "stream"]
                self.assertEqual(len(stream_calls), 2)
                self.assertIn("--hardware-acceleration=if-possible", stream_calls[0]["cmd"])
                self.assertIn("--hardware-acceleration=disable", stream_calls[1]["cmd"])
                with open(os.path.join(out_dir, "fallback_stream.mp4"), "rb") as mf:
                    self.assertEqual(mf.read(), b"GOOD_CPU_MP4")

                # 2. Sync render: GPU error -> one-shot software fallback
                remotion_adapter.calls.clear()
                remotion_adapter.run_results = [
                    RemotionRunResult(returncode=1, stderr="vtCompressionSessionCreate failed"),
                    RemotionRunResult(returncode=0),
                ]
                sync_out = coordinator.render(comp, "fallback_sync.mp4")
                self.assertEqual(sync_out, os.path.join(out_dir, "fallback_sync.mp4"))
                run_calls = [c for c in remotion_adapter.calls if c["method"] == "run"]
                self.assertEqual(len(run_calls), 2)
                self.assertIn("--hardware-acceleration=if-possible", run_calls[0]["cmd"])
                self.assertIn("--hardware-acceleration=disable", run_calls[1]["cmd"])

                # 3. Explicit 'required': NEVER falls back to software
                cfg.set("REMOTION_HARDWARE_ACCELERATION", "required")
                remotion_adapter.calls.clear()
                remotion_adapter.stream_scripts = [
                    {"lines": ["Error: h264_nvenc failed\n"], "returncode": 1}
                ]
                req_events = list(coordinator.render_streaming(comp, "req_fail.mp4"))
                self.assertEqual(req_events[-1]["stage"], "error")
                self.assertEqual(len([c for c in remotion_adapter.calls if c["method"] == "stream"]), 1)
                self.assertIn("--hardware-acceleration=required", remotion_adapter.calls[0]["cmd"])

                # 4. Cancelled during GPU attempt: NEVER falls back
                cfg.set("REMOTION_HARDWARE_ACCELERATION", "if-possible")
                remotion_adapter.calls.clear()
                cancel_ev = threading.Event()

                def cancel_gpu(_cmd, _cwd, _env, c_ev):
                    if False:
                        yield ""
                    if c_ev is not None:
                        c_ev.set()
                    return RemotionRunResult(returncode=-1, cancelled=True)

                remotion_adapter.stream_handler = cancel_gpu
                cancel_events = list(coordinator.render_streaming(comp, "cancel_nofallback.mp4", cancel_event=cancel_ev))
                self.assertFalse(any(e.get("stage") == "done" for e in cancel_events))
                self.assertEqual(len(remotion_adapter.calls), 1)

    def test_lazy_ffmpeg_check_and_scoped_env_propagation(self):
        from core.config_store import InMemoryConfigStore
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            remotion_dir = self._create_temp_remotion_project(tmp_dir)
            out_dir = os.path.join(tmp_dir, "output")
            video_src = os.path.join(tmp_dir, "clip_src.mp4")
            with open(video_src, "wb") as f:
                f.write(b"VIDEO")

            orig_env_path = os.environ.get("PATH")
            orig_env_ffmpeg = os.environ.get("FFMPEG_PATH")
            orig_env_node = os.environ.get("NODE_PATH")

            cfg = InMemoryConfigStore({
                "FFMPEG_PATH": "/custom/ffmpeg/v1/ffmpeg",
                "NODE_PATH": "/custom/node/v1/node",
            })
            fake_media = FakeMediaAdapter(ffmpeg_available=False)
            remotion_adapter = FakeRemotionAdapter()
            coordinator = RenderPipelineCoordinator(
                output_dir=out_dir,
                remotion_dir=remotion_dir,
                config_store=cfg,
                media_transcoder=MediaTranscoder(adapter=fake_media),
                process_adapter=remotion_adapter,
                hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
            )
            # Constructor neither mutated os.environ nor failed when FFmpeg is absent
            self.assertEqual(os.environ.get("PATH"), orig_env_path)
            self.assertEqual(os.environ.get("FFMPEG_PATH"), orig_env_ffmpeg)
            self.assertEqual(os.environ.get("NODE_PATH"), orig_env_node)

            comp = RenderComposition(original_video=video_src, crop_center_x=960, clip_duration=2.0, fps=30.0)
            with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
                events_missing = list(coordinator.render_streaming(comp, "missing_ffmpeg.mp4"))
                self.assertEqual(events_missing[-1]["stage"], "error")
                self.assertIn("FFmpeg", events_missing[-1]["message"])
                self.assertEqual(remotion_adapter.calls, [])
                self.assertIsNone(coordinator.render(comp, "missing_ffmpeg_sync.mp4"))

                # Settings updated in-place take effect immediately on next render via fresh scoped env
                fake_media.ffmpeg_available = True
                coordinator.render(comp, "render_v1.mp4")

                cfg.set("FFMPEG_PATH", "/custom/ffmpeg/v2/ffmpeg")
                cfg.set("NODE_PATH", "/custom/node/v2/node")
                events_v2 = list(coordinator.render_streaming(comp, "render_v2.mp4"))
                self.assertEqual(events_v2[-1]["stage"], "done")

            render_calls = [c for c in remotion_adapter.calls if "render" in c["cmd"]]
            self.assertEqual(len(render_calls), 2)

            env1 = render_calls[0]["env"]
            self.assertEqual(env1["FFMPEG_PATH"], "/custom/ffmpeg/v1/ffmpeg")
            self.assertEqual(env1["NODE_PATH"], "/custom/node/v1/node")
            self.assertEqual(env1["FORCE_COLOR"], "0")
            self.assertEqual(env1["NO_COLOR"], "1")
            self.assertIn("/custom/ffmpeg/v1", env1["PATH"])
            self.assertIn("/custom/node/v1", env1["PATH"])

            env2 = render_calls[1]["env"]
            self.assertEqual(env2["FFMPEG_PATH"], "/custom/ffmpeg/v2/ffmpeg")
            self.assertEqual(env2["NODE_PATH"], "/custom/node/v2/node")
            self.assertEqual(env2["FORCE_COLOR"], "0")
            self.assertEqual(env2["NO_COLOR"], "1")
            self.assertIn("/custom/ffmpeg/v2", env2["PATH"])
            self.assertIn("/custom/node/v2", env2["PATH"])

            # Global process environment remains completely untouched
            self.assertEqual(os.environ.get("PATH"), orig_env_path)
            self.assertEqual(os.environ.get("FFMPEG_PATH"), orig_env_ffmpeg)
            self.assertEqual(os.environ.get("NODE_PATH"), orig_env_node)

    def test_subprocess_remotion_adapter_real_process_group_kill_and_terminate_all(self):
        import tempfile
        import threading
        import time

        def is_pid_alive(pid: int) -> bool:
            if pid <= 0:
                return False
            if os.name == "nt":
                return False
            try:
                os.kill(pid, 0)
                return True
            except ProcessLookupError:
                return False
            except PermissionError:
                return True
            except OSError:
                return False

        child_script = (
            "import os, signal, subprocess, sys, time\n"
            "grand_code = 'import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(30)'\n"
            "grand = subprocess.Popen([sys.executable, '-u', '-c', grand_code])\n"
            "pidfile = sys.argv[1]\n"
            "with open(pidfile, 'w', encoding='utf-8') as f:\n"
            "    f.write(f'{os.getpid()}:{grand.pid}')\n"
            "print(f'PIDS:{os.getpid()}:{grand.pid}', flush=True)\n"
            "time.sleep(30)\n"
        )

        adapter = SubprocessRemotionAdapter(terminate_grace_seconds=0.15, poll_interval_seconds=0.02)
        with tempfile.TemporaryDirectory() as tmp_dir:
            # 1. Cancel via cancel_event kills both child and grandchild across process group
            pidfile1 = os.path.join(tmp_dir, "pids1.txt")
            cancel_ev = threading.Event()
            stream_gen = adapter.stream(
                [sys.executable, "-u", "-c", child_script, pidfile1],
                cwd=tmp_dir,
                env=os.environ.copy(),
                cancel_event=cancel_ev,
            )
            line = next(stream_gen)
            self.assertTrue(line.startswith("PIDS:"))
            _, c_pid_s, g_pid_s = line.strip().split(":")
            c_pid1, g_pid1 = int(c_pid_s), int(g_pid_s)
            self.assertTrue(is_pid_alive(c_pid1))
            self.assertTrue(is_pid_alive(g_pid1))

            t0 = time.monotonic()
            cancel_ev.set()
            stream_gen.close()
            elapsed = time.monotonic() - t0
            self.assertLess(elapsed, 2.0)
            self.assertFalse(is_pid_alive(c_pid1))
            self.assertFalse(is_pid_alive(g_pid1))
            self.assertEqual(len(adapter._active_procs), 0)

            # 2. terminate_all() kills in-flight run() child and grandchild and clears active handles
            pidfile2 = os.path.join(tmp_dir, "pids2.txt")
            run_holder: dict = {}

            def run_worker():
                run_holder["res"] = adapter.run(
                    [sys.executable, "-u", "-c", child_script, pidfile2],
                    cwd=tmp_dir,
                    env=os.environ.copy(),
                )

            worker = threading.Thread(target=run_worker, daemon=True)
            worker.start()

            deadline = time.monotonic() + 3.0
            c_pid2 = g_pid2 = 0
            while time.monotonic() < deadline:
                if os.path.isfile(pidfile2):
                    raw = open(pidfile2, "r", encoding="utf-8").read().strip()
                    if ":" in raw:
                        p1, p2 = raw.split(":")
                        c_pid2, g_pid2 = int(p1), int(p2)
                        break
                time.sleep(0.02)

            self.assertGreater(c_pid2, 0)
            self.assertGreater(g_pid2, 0)
            self.assertTrue(is_pid_alive(c_pid2))
            self.assertTrue(is_pid_alive(g_pid2))

            adapter.terminate_all()
            worker.join(timeout=3.0)
            self.assertFalse(worker.is_alive())
            self.assertFalse(is_pid_alive(c_pid2))
            self.assertFalse(is_pid_alive(g_pid2))
            self.assertEqual(len(adapter._active_procs), 0)

    def test_fastapi_lifespan_shutdown_calls_render_engine_terminate_all(self):
        from fastapi.testclient import TestClient
        import main

        mock_engine = MagicMock()
        with patch.object(main, "render_engine", mock_engine):
            with TestClient(main.app):
                mock_engine.terminate_all.assert_not_called()
            mock_engine.terminate_all.assert_called_once()


import anyio
import pytest


@pytest.mark.anyio
async def test_async_http_disconnect_teardown_ordering_and_self_update_preflight(tmp_path, monkeypatch):
    """ASGI http.disconnect triggers immediate process kill -> MP4 delete -> staging cleanup -> tracker decrement."""
    import asyncio
    import time
    import main
    from core.job_store import InMemoryJobStore
    from core.self_update_service import (
        FakeGitPort,
        FakeSupervisorPort,
        RenderActivityTracker,
        SelfUpdateService,
    )

    remotion_dir = tmp_path / "shared" / "remotion"
    (remotion_dir / "src").mkdir(parents=True)
    (remotion_dir / "package.json").write_text('{"name":"@yonru/remotion"}\n', encoding="utf-8")
    (remotion_dir / "src" / "index.ts").write_text("export {};\n", encoding="utf-8")

    out_dir = tmp_path / "output"
    out_dir.mkdir(parents=True)
    video_src = tmp_path / "clip.mp4"
    video_src.write_bytes(b"SOURCE_VIDEO_BYTES")

    order_log: list[str] = []
    stream_started = threading.Event()
    preflight_during_stream: dict = {}

    tracker = RenderActivityTracker()
    service = SelfUpdateService(
        current_version="0.4.0",
        git_port=FakeGitPort(
            branch="main",
            head_commit="1111111",
            dirty_files=[],
            tags={"v0.4.1": "2222222"},
            ancestors={("1111111", "refs/tags/v0.4.1"): True},
        ),
        supervisor_port=FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=True),
        job_store=InMemoryJobStore(),
        render_tracker=tracker,
    )

    target_mp4 = str(out_dir / "job_disc_clip_0.mp4")
    staged_video = str(remotion_dir / ".bundle" / "public" / "source_job_disc_clip_0.mp4")

    def on_terminate_cb():
        assert tracker.active_count == 1
        assert os.path.exists(target_mp4)
        assert os.path.exists(staged_video)
        order_log.append("process_killed_and_reaped")

    def silent_stream_handler(_cmd, _cwd, _env, cancel_event):
        with open(target_mp4, "wb") as mf:
            mf.write(b"PARTIAL_RENDER_MP4")
        yield "Rendered 0/300\n"
        stream_started.set()
        # Simulate silent Remotion stdout after first progress line until cancelled
        assert cancel_event is not None
        cancel_event.wait(timeout=5.0)
        return RemotionRunResult(returncode=-1, cancelled=True)

    remotion_adapter = FakeRemotionAdapter(
        stream_handler=silent_stream_handler,
        on_terminate=on_terminate_cb,
    )
    coordinator = RenderPipelineCoordinator(
        output_dir=str(out_dir),
        remotion_dir=str(remotion_dir),
        media_transcoder=MediaTranscoder(adapter=FakeMediaAdapter()),
        process_adapter=remotion_adapter,
        hardware_profiler=HardwareProfiler(FakeHardwareMetricsSource()),
    )
    # Seed warm bundle before ASGI call
    with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
        assert coordinator._ensure_remotion_bundle(str(remotion_dir))

    orig_remove_partial = coordinator._remove_partial_output
    orig_decrement = tracker.decrement

    def tracked_remove_partial(path: str) -> None:
        assert order_log == ["process_killed_and_reaped"]
        assert tracker.active_count == 1
        assert os.path.exists(staged_video)
        orig_remove_partial(path)
        order_log.append("partial_mp4_deleted")

    class TrackedStageContext(StagedRenderContext):
        def _cleanup(self) -> None:
            assert order_log == ["process_killed_and_reaped", "partial_mp4_deleted"]
            assert tracker.active_count == 1
            assert not os.path.exists(target_mp4)
            super()._cleanup()
            order_log.append("staged_assets_cleaned")

    def tracked_stage(c, name, bdir):
        return TrackedStageContext(
            c,
            name,
            coordinator.output_dir,
            remotion_dir=coordinator.remotion_dir,
            public_dir=os.path.join(bdir, "public"),
            audio_library_dir=coordinator.audio_library_dir,
        )

    def tracked_decrement() -> None:
        assert order_log == [
            "process_killed_and_reaped",
            "partial_mp4_deleted",
            "staged_assets_cleaned",
        ]
        orig_decrement()
        order_log.append("tracker_decremented")

    coordinator._remove_partial_output = tracked_remove_partial  # type: ignore[method-assign]
    coordinator._stage_render_context = tracked_stage  # type: ignore[method-assign]
    monkeypatch.setattr(tracker, "decrement", tracked_decrement)

    job_store = InMemoryJobStore()
    job_store.create_job(
        "job_disc",
        {
            "job_id": "job_disc",
            "status": "ready",
            "clip_path": str(video_src),
            "clip_duration": 10.0,
            "video_info": {"file_path": str(video_src), "duration": 10.0, "fps": 30.0},
            "hooks": [],
        },
    )
    monkeypatch.setattr(main, "jobs", job_store)
    monkeypatch.setattr(main, "render_engine", coordinator)
    monkeypatch.setattr(main, "render_activity_tracker", tracker)
    monkeypatch.setattr(main, "self_update_service", service)

    body_bytes = json.dumps({"job_id": "job_disc", "transcript": []}).encode("utf-8")
    body_sent = False
    disconnect_event = asyncio.Event()
    sent_messages: list[dict] = []

    async def receive() -> dict[str, Any]:
        nonlocal body_sent
        if not body_sent:
            body_sent = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}
        await disconnect_event.wait()
        return {"type": "http.disconnect"}

    async def send(message: Any) -> None:
        sent_messages.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/render-stream",
        "raw_path": b"/api/render-stream",
        "query_string": b"",
        "headers": [(b"content-type", b"application/json")],
        "client": ("127.0.0.1", 51234),
        "server": ("localhost", 8765),
    }

    t_disconnect = 0.0
    with patch.object(coordinator, "resolve_remotion_command", return_value=["remotion"]):
        async with anyio.create_task_group() as tg:
            async def drive_app():
                await main.app(scope, receive, send)

            tg.start_soon(drive_app)
            with anyio.fail_after(3.0):
                while not stream_started.is_set():
                    await asyncio.sleep(0.01)

            preflight_during_stream.update(service.preflight("0.4.1"))
            t_disconnect = time.monotonic()
            disconnect_event.set()

        cancel_elapsed = time.monotonic() - t_disconnect

    assert cancel_elapsed < 1.0
    assert preflight_during_stream["canUpdate"] is False
    assert preflight_during_stream["activeRenders"] == 1
    assert order_log == [
        "process_killed_and_reaped",
        "partial_mp4_deleted",
        "staged_assets_cleaned",
        "tracker_decremented",
    ]
    assert not os.path.exists(target_mp4)
    assert not os.path.exists(staged_video)
    assert tracker.active_count == 0
    after_preflight = service.preflight("0.4.1")
    assert after_preflight["canUpdate"] is True
    assert after_preflight["activeRenders"] == 0







