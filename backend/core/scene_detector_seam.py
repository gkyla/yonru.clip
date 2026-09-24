from abc import ABC, abstractmethod
from typing import List, Optional, Sequence
import cv2
import numpy as np
from core.frame_source import FrameSource

class SceneDetectorSeam(ABC):
    @abstractmethod
    def detect_cuts(self, frame_source: FrameSource) -> List[float]:
        """Scans video frames and returns a list of visual cut timestamps in seconds."""
        pass


class OpenCVSceneDetector(SceneDetectorSeam):
    def __init__(
        self,
        threshold: float = 0.85,
        min_refractory_sec: float = 0.5,
        target_size: tuple = (160, 90)
    ):
        """
        Detects hard camera cuts using HSV color histogram correlation.
        - threshold: Correlation threshold below which a cut is detected (default 0.75).
        - min_refractory_sec: Minimum duration in seconds between consecutive cuts (default 0.5s).
        - target_size: Micro-resolution for fast histogram evaluation (default 160x90).
        """
        self.threshold = threshold
        self.min_refractory_sec = min_refractory_sec
        self.target_size = target_size

    def _calc_hist(self, frame: np.ndarray) -> np.ndarray:
        # Resize to micro thumbnail
        small = cv2.resize(frame, self.target_size, interpolation=cv2.INTER_NEAREST)
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        # Calculate 2D Hue-Saturation histogram (H: 16 bins, S: 8 bins)
        hist = cv2.calcHist([hsv], [0, 1], None, [16, 8], [0, 180, 0, 256])
        cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        return hist

    def detect_cuts(self, frame_source: FrameSource) -> List[float]:
        fps = frame_source.fps
        if fps <= 0:
            fps = 30.0
        start_time = getattr(frame_source, "start_time", 0.0)

        cut_timestamps: List[float] = []
        prev_hist: Optional[np.ndarray] = None
        frame_idx = 0
        last_cut_time = -self.min_refractory_sec

        while True:
            ret, frame = frame_source.read()
            if not ret or frame is None:
                break

            t_sec = start_time + (frame_idx / fps)
            current_hist = self._calc_hist(frame)

            if prev_hist is not None:
                # Compare histogram correlation (1.0 = identical, < 0.65 = distinct camera cut)
                correlation = cv2.compareHist(prev_hist, current_hist, cv2.HISTCMP_CORREL)
                if correlation < self.threshold:
                    if (t_sec - last_cut_time) >= self.min_refractory_sec:
                        cut_timestamps.append(round(t_sec, 3))
                        last_cut_time = t_sec

            prev_hist = current_hist
            frame_idx += 1

        print(f"[scene-detect] Detected {len(cut_timestamps)} visual cuts: {cut_timestamps}")
        return cut_timestamps


class MockSceneDetector(SceneDetectorSeam):
    def __init__(self, cut_timestamps: Optional[Sequence[float]] = None):
        self.cut_timestamps = list(cut_timestamps) if cut_timestamps is not None else []

    def detect_cuts(self, frame_source: FrameSource) -> List[float]:
        return self.cut_timestamps
