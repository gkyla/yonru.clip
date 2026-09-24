import unittest
import numpy as np
import os
import sys
from typing import Tuple, Optional, List

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.frame_source import FrameSource
from core.scene_detector_seam import OpenCVSceneDetector, MockSceneDetector

class SyntheticColoredFrameSource(FrameSource):
    def __init__(self, color_sequence: List[Tuple[int, int, int]], frames_per_color: int = 5, fps: float = 10.0, start_time: float = 0.0):
        self.color_sequence = color_sequence
        self.frames_per_color = frames_per_color
        self._fps = fps
        self._start_time = start_time
        self._current_frame = 0
        self._total_frames = len(color_sequence) * frames_per_color

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        if self._current_frame >= self._total_frames:
            return False, None
        
        color_idx = self._current_frame // self.frames_per_color
        bgr = self.color_sequence[color_idx]
        frame = np.full((100, 100, 3), bgr, dtype=np.uint8)
        self._current_frame += 1
        return True, frame

    @property
    def width(self) -> int:
        return 100

    @property
    def height(self) -> int:
        return 100

    @property
    def fps(self) -> float:
        return self._fps

    @property
    def start_time(self) -> float:
        return self._start_time

    def close(self) -> None:
        pass

    def reset(self) -> None:
        self._current_frame = 0


class TestSceneDetector(unittest.TestCase):
    def test_mock_scene_detector(self):
        detector = MockSceneDetector([1.5, 4.2])
        source = SyntheticColoredFrameSource([(255, 0, 0)], frames_per_color=2)
        cuts = detector.detect_cuts(source)
        self.assertEqual(cuts, [1.5, 4.2])

    def test_opencv_scene_detector_detects_color_cuts(self):
        # 3 colors: Red, Blue, Green (6 frames each at 10 fps -> 0.6s per color)
        # Cut 1 should be at frame 6 (0.6s)
        # Cut 2 should be at frame 12 (1.2s)
        colors = [
            (0, 0, 255),    # Red
            (255, 0, 0),    # Blue
            (0, 255, 0)     # Green
        ]
        source = SyntheticColoredFrameSource(colors, frames_per_color=6, fps=10.0)
        detector = OpenCVSceneDetector(threshold=0.65, min_refractory_sec=0.5)
        cuts = detector.detect_cuts(source)

        self.assertEqual(len(cuts), 2)
        self.assertAlmostEqual(cuts[0], 0.6, places=2)
        self.assertAlmostEqual(cuts[1], 1.2, places=2)

    def test_opencv_scene_detector_refractory_period(self):
        # Colors change every 2 frames (0.2s at 10 fps)
        # Since min_refractory_sec=0.5s, rapid cuts within 0.5s should be suppressed
        colors = [
            (0, 0, 255),    # Red (0.0s - 0.2s)
            (255, 0, 0),    # Blue (0.2s - 0.4s) -> Cut at 0.2s
            (0, 255, 0),    # Green (0.4s - 0.6s) -> Suppressed (< 0.5s from 0.2s)
            (255, 255, 0)   # Yellow (0.6s - 0.8s) -> Suppressed (< 0.5s from 0.2s)
        ]
        source = SyntheticColoredFrameSource(colors, frames_per_color=2, fps=10.0)
        detector = OpenCVSceneDetector(threshold=0.65, min_refractory_sec=0.5)
        cuts = detector.detect_cuts(source)

        # Only the first cut at 0.2s should be recorded
        self.assertEqual(cuts, [0.2])

    def test_opencv_scene_detector_honors_stream_start_time(self):
        # When container stream has non-zero start_time (e.g. 0.083s offset)
        colors = [
            (0, 0, 255),    # Red
            (255, 0, 0),    # Blue -> cut at 0.6s + start_time
        ]
        start_offset = 0.083
        source = SyntheticColoredFrameSource(colors, frames_per_color=6, fps=10.0, start_time=start_offset)
        detector = OpenCVSceneDetector(threshold=0.65, min_refractory_sec=0.5)
        cuts = detector.detect_cuts(source)

        self.assertEqual(len(cuts), 1)
        self.assertAlmostEqual(cuts[0], 0.6 + start_offset, places=3)

if __name__ == "__main__":
    unittest.main()
