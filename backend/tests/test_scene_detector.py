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


def _scan_cuts(detector, source: FrameSource) -> List[float]:
    detector.reset()
    cuts: List[float] = []
    fps = source.fps if source.fps > 0 else 30.0
    start_time = getattr(source, "start_time", 0.0)
    frame_idx = 0
    while True:
        ret, frame = source.read()
        if not ret or frame is None:
            break
        t_sec = start_time + (frame_idx / fps)
        cut_t = detector.evaluate_frame(frame, t_sec)
        if cut_t is not None:
            cuts.append(cut_t)
        frame_idx += 1
    return cuts


class TestSceneDetector(unittest.TestCase):
    def test_mock_scene_detector(self):
        detector = MockSceneDetector([1.5, 4.2])
        dummy_frame = np.zeros((10, 10, 3), dtype=np.uint8)

        detector.reset()
        self.assertIsNone(detector.evaluate_frame(dummy_frame, 0.0))
        self.assertIsNone(detector.evaluate_frame(dummy_frame, 1.4))
        self.assertEqual(detector.evaluate_frame(dummy_frame, 1.5), 1.5)
        self.assertIsNone(detector.evaluate_frame(dummy_frame, 2.0))
        self.assertEqual(detector.evaluate_frame(dummy_frame, 4.2), 4.2)

        # Calling reset() replays the mock cut sequence cleanly
        detector.reset()
        self.assertIsNone(detector.evaluate_frame(dummy_frame, 1.0))
        self.assertEqual(detector.evaluate_frame(dummy_frame, 1.5), 1.5)

        # Odd-frame cut timestamp (e.g. 0.5s) is emitted at 0.5s
        odd_detector = MockSceneDetector([0.5])
        odd_detector.reset()
        self.assertIsNone(odd_detector.evaluate_frame(dummy_frame, 0.4))
        self.assertEqual(odd_detector.evaluate_frame(dummy_frame, 0.5), 0.5)
        self.assertIsNone(odd_detector.evaluate_frame(dummy_frame, 0.6))

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
        cuts = _scan_cuts(detector, source)

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
        cuts = _scan_cuts(detector, source)

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
        cuts = _scan_cuts(detector, source)

        self.assertEqual(len(cuts), 1)
        self.assertAlmostEqual(cuts[0], 0.6 + start_offset, places=3)

    def test_opencv_scene_detector_reset_isolates_consecutive_streams(self):
        detector = OpenCVSceneDetector(threshold=0.65, min_refractory_sec=0.5)
        stream_one = SyntheticColoredFrameSource([(0, 0, 255)], frames_per_color=4, fps=10.0)
        stream_two = SyntheticColoredFrameSource([(255, 0, 0)], frames_per_color=4, fps=10.0)

        cuts_one = _scan_cuts(detector, stream_one)
        cuts_two = _scan_cuts(detector, stream_two)

        self.assertEqual(cuts_one, [])
        self.assertEqual(cuts_two, [])

if __name__ == "__main__":
    unittest.main()
