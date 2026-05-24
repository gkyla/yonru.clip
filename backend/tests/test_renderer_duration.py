import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Dynamic path resolution to root of backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.render_engine import RemotionRenderEngine, RenderComposition

class TestRendererDuration(unittest.TestCase):
    @patch('shutil.copy2')
    @patch('os.path.exists')
    def test_remotion_render_engine_duration_override(self, mock_exists, mock_copy):
        mock_exists.return_value = True
        
        # Setup mock inputs
        original_video = "dummy_video.mp4"
        crop_center_x = 960
        timeline_tracks = [
            {
                "id": "video",
                "items": [
                    {"start": 0.0, "duration": 5.5},
                    {"start": 5.5, "duration": 10.2}
                ]
            },
            {
                "id": "audio",
                "items": [
                    {"start": 1.0, "duration": 20.0}
                ]
            }
        ]
        
        comp = RenderComposition(
            original_video=original_video,
            crop_center_x=crop_center_x,
            timeline_tracks=timeline_tracks,
            clip_duration=30.0,
            fps=30.0
        )
        
        engine = RemotionRenderEngine(output_dir="static/test_output")
        
        with patch('json.dump') as mock_json_dump, patch('builtins.open', create=True):
            _, _, _, frames = engine._prepare_props_and_paths(comp, "test_clip.mp4")
            
            # Retrieve the props passed to json.dump
            self.assertTrue(mock_json_dump.called)
            props = mock_json_dump.call_args[0][0]
            
            # Assert clip_duration was overridden based on max timeline item end boundary (21.0 seconds)
            # Total frames = clip_duration * fps = 21.0 * 30.0 = 630
            self.assertEqual(props["durationInFrames"], 630)
            self.assertEqual(frames, 630)
            
            # Assert timelineVideoItems was robustly extracted from the 'video' track specifically
            self.assertEqual(len(props["timelineVideoItems"]), 2)
            self.assertEqual(props["timelineVideoItems"][0]["duration"], 5.5)
            
            print("\n[OK] RemotionRenderEngine correctly calculated and overrode duration to 21.0s (630 frames)!")
            print("[OK] RemotionRenderEngine robustly extracted the 'video' timeline track!")

if __name__ == '__main__':
    unittest.main()
