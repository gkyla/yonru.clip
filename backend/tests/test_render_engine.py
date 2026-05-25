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
