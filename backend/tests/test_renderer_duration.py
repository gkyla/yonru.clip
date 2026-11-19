import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

# Dynamic path resolution to root of backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.render_engine import RemotionRenderEngine, RenderComposition, StagedRenderContext


class TestRendererDuration(unittest.TestCase):
    def test_remotion_render_engine_duration_override(self):
        timeline_tracks = [
            {
                "id": "video",
                "items": [
                    {"start": 0.0, "duration": 5.5},
                    {"start": 5.5, "duration": 10.2},
                ],
            },
            {
                "id": "text",
                "items": [
                    {"start": 1.0, "duration": 20.0},
                ],
            },
        ]

        temp_dir = tempfile.mkdtemp()
        try:
            temp_out = os.path.join(temp_dir, "out")
            temp_pub = os.path.join(temp_dir, "public")
            dummy_video = os.path.join(temp_dir, "dummy_video.mp4")
            with open(dummy_video, "wb") as f:
                f.write(b"VIDEO")

            comp = RenderComposition(
                original_video=dummy_video,
                crop_center_x=960,
                timeline_tracks=timeline_tracks,
                clip_duration=30.0,
                fps=30.0,
            )

            with StagedRenderContext(comp, "test_clip.mp4", output_dir=temp_out, public_dir=temp_pub) as ctx:
                self.assertIsNotNone(ctx.props_path)
                assert ctx.props_path is not None
                with open(ctx.props_path, "r", encoding="utf-8") as pf:
                    props = json.load(pf)

                # Assert clip_duration was overridden based on max timeline item end boundary (21.0 seconds)
                # Total frames = clip_duration * fps = 21.0 * 30.0 = 630
                self.assertEqual(props["durationInFrames"], 630)
                self.assertEqual(ctx.frames, 630)

                # Assert timelineVideoItems was robustly extracted from the 'video' track specifically
                self.assertEqual(len(props["timelineVideoItems"]), 2)
                self.assertEqual(props["timelineVideoItems"][0]["duration"], 5.5)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_audio_track_does_not_inflate_render_duration(self):
        # Video is 15.7s (5.5 + 10.2). Audio track has full song of 180.0s.
        timeline_tracks = [
            {
                "id": "video",
                "items": [
                    {"start": 0.0, "duration": 5.5},
                    {"start": 5.5, "duration": 10.2},
                ],
            },
            {
                "id": "audio",
                "items": [
                    {"start": 0.0, "duration": 3.0},
                    {"start": 3.0, "duration": 177.0},
                ],
            },
        ]

        temp_dir = tempfile.mkdtemp()
        try:
            temp_out = os.path.join(temp_dir, "out")
            temp_pub = os.path.join(temp_dir, "public")
            dummy_video = os.path.join(temp_dir, "dummy_video.mp4")
            with open(dummy_video, "wb") as f:
                f.write(b"VIDEO")

            comp = RenderComposition(
                original_video=dummy_video,
                crop_center_x=960,
                timeline_tracks=timeline_tracks,
                clip_duration=15.7,
                fps=30.0,
            )

            with StagedRenderContext(comp, "test_clip.mp4", output_dir=temp_out, public_dir=temp_pub) as ctx:
                self.assertIsNotNone(ctx.props_path)
                assert ctx.props_path is not None
                with open(ctx.props_path, "r", encoding="utf-8") as pf:
                    props = json.load(pf)

                # Must strictly follow video boundary (15.7s * 30fps = 471 frames), NEVER 180.0s (5400 frames)
                self.assertEqual(props["durationInFrames"], 471)
                self.assertEqual(ctx.frames, 471)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_compile_composition_ignores_audio_when_calculating_timeline_duration(self):
        engine = RemotionRenderEngine(output_dir="/tmp")
        mock_job = {
            "clip_path": "dummy_clip.mp4",
            "clip_duration": 15.0,
            "video_info": {"file_path": "dummy_video.mp4", "duration": 60.0, "fps": 30.0},
            "hooks": []
        }
        mock_req = MagicMock()
        mock_req.fps = 30.0
        mock_req.hook_index = 0
        mock_req.transcript = []
        mock_req.timeline_tracks = [
            {
                "id": "video",
                "items": [{"start": 0.0, "duration": 15.0}]
            },
            {
                "id": "audio",
                "items": [
                    {"start": 0.0, "duration": 3.0}, # Intro cut to cover slide
                    {"start": 3.0, "duration": 177.0} # Cut tail from song
                ]
            }
        ]
        mock_req.face_tracking = False
        mock_req.crop_percent_x = 50.0
        mock_req.thumbnail_enabled = False
        mock_req.volume = 1.0

        with patch("os.path.exists", return_value=False):
            comp = engine.compile_composition(mock_job, mock_req)
            # clip_duration must strictly remain 15.0s, NOT overridden to 180.0s by audio!
            self.assertEqual(comp.clip_duration, 15.0)

if __name__ == '__main__':
    unittest.main()
