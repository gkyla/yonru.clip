import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Dynamic path resolution to root of backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.renderer import VideoRenderer

class TestRendererDuration(unittest.TestCase):
    @patch('shutil.copy2')
    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_process_and_render_timeline_override(self, mock_exists, mock_run, mock_copy):
        mock_exists.return_value = True
        
        # Setup mock subprocess response
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_run.return_value = mock_process
        
        renderer = VideoRenderer(output_dir="static/test_output")
        
        # 1. Mock inputs
        original_video = "dummy_video.mp4"
        subtitle_ass = "dummy_subs.ass"
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
        
        # Total duration from items: max(0+5.5, 5.5+10.2, 1.0+20.0) = 21.0
        
        with patch('json.dump') as mock_json_dump, patch('builtins.open', create=True):
            renderer.process_and_render(
                original_video=original_video,
                subtitle_ass=subtitle_ass,
                crop_center_x=crop_center_x,
                timeline_tracks=timeline_tracks,
                clip_duration=30.0, # Initial/uncut duration
                fps=30.0
            )
            
            # Retrieve the props passed to json.dump
            self.assertTrue(mock_json_dump.called)
            props = mock_json_dump.call_args[0][0]
            
            # Assert clip_duration was overridden based on max timeline item end boundary (21.0 seconds)
            # Total frames = clip_duration * fps = 21.0 * 30.0 = 630
            self.assertEqual(props["durationInFrames"], 630)
            
            # Assert timelineVideoItems was robustly extracted from the 'video' track specifically
            self.assertEqual(len(props["timelineVideoItems"]), 2)
            self.assertEqual(props["timelineVideoItems"][0]["duration"], 5.5)
            
            print("\n[OK] process_and_render correctly calculated and overrode duration to 21.0s (630 frames)!")
            print("[OK] process_and_render robustly extracted the 'video' timeline track!")

    @patch('shutil.copy2')
    @patch('subprocess.run')
    @patch('os.path.exists')
    def test_process_and_render_streaming_timeline_override(self, mock_exists, mock_run, mock_copy):
        mock_exists.return_value = True
        
        mock_process = MagicMock()
        mock_process.returncode = 0
        mock_run.return_value = mock_process
        
        renderer = VideoRenderer(output_dir="static/test_output")
        
        original_video = "dummy_video.mp4"
        subtitle_ass = "dummy_subs.ass"
        crop_center_x = 960
        timeline_tracks = [
            {
                "id": "video",
                "items": [
                    {"start": 0.0, "duration": 8.0}
                ]
            }
        ]
        
        with patch('json.dump') as mock_json_dump, patch('builtins.open', create=True):
            # Consume the generator to trigger render processing
            list(renderer.process_and_render_streaming(
                original_video=original_video,
                subtitle_ass=subtitle_ass,
                crop_center_x=crop_center_x,
                timeline_tracks=timeline_tracks,
                clip_duration=30.0,
                fps=30.0
            ))
            
            self.assertTrue(mock_json_dump.called)
            props = mock_json_dump.call_args[0][0]
            
            # Assert clip_duration was overridden to 8.0s (240 frames)
            self.assertEqual(props["durationInFrames"], 240)
            
            print("[OK] process_and_render_streaming correctly calculated and overrode duration to 8.0s (240 frames)!")

if __name__ == '__main__':
    unittest.main()
