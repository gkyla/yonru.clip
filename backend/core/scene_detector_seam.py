from abc import ABC, abstractmethod
from typing import List, Optional, Sequence
import cv2
import numpy as np


class SceneDetectorSeam(ABC):
    @abstractmethod
    def reset(self) -> None:
        """Resets any per-stream state before scanning a new video stream."""
        pass

    @abstractmethod
    def evaluate_frame(self, frame: np.ndarray, t_sec: float) -> Optional[float]:
        """Evaluates one sequential frame at t_sec and returns cut timestamp if detected."""
        pass


class OpenCVSceneDetector(SceneDetectorSeam):
    def __init__(
        self,
        threshold: float = 0.75,
        min_refractory_sec: float = 0.5,
        target_size: tuple[int, int] = (160, 90)
    ):
        """
        Detects hard camera cuts using 3D HSV color histogram correlation.
        - threshold: Correlation threshold below which a cut is detected (default 0.75).
        - min_refractory_sec: Minimum duration in seconds between consecutive cuts (default 0.5s).
        - target_size: Micro-resolution for fast histogram evaluation (default 160x90).
        """
        self.threshold = threshold
        self.min_refractory_sec = min_refractory_sec
        self.target_size = target_size
        self._prev_hist: Optional[np.ndarray] = None
        self._last_cut_time: float = -self.min_refractory_sec
        self.reset()

    def reset(self) -> None:
        self._prev_hist = None
        self._last_cut_time = -self.min_refractory_sec

    def _calc_hist(self, frame: np.ndarray) -> np.ndarray:
        # Resize to micro thumbnail
        small = cv2.resize(frame, self.target_size, interpolation=cv2.INTER_NEAREST)
        hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
        # Calculate 3D Hue-Saturation-Value histogram (H: 16 bins, S: 8 bins, V: 8 bins)
        hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 8, 8], [0, 180, 0, 256, 0, 256])
        cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        return hist

    def evaluate_frame(self, frame: np.ndarray, t_sec: float) -> Optional[float]:
        current_hist = self._calc_hist(frame)
        cut_time: Optional[float] = None

        if self._prev_hist is not None:
            # Compare histogram correlation (1.0 = identical, < 0.65 = distinct camera cut)
            correlation = cv2.compareHist(self._prev_hist, current_hist, cv2.HISTCMP_CORREL)
            if correlation < self.threshold:
                if (t_sec - self._last_cut_time) >= self.min_refractory_sec:
                    cut_time = round(t_sec, 3)
                    self._last_cut_time = t_sec

        self._prev_hist = current_hist
        return cut_time


class MockSceneDetector(SceneDetectorSeam):
    def __init__(self, cut_timestamps: Optional[Sequence[float]] = None):
        self.cut_timestamps: List[float] = sorted(float(t) for t in cut_timestamps) if cut_timestamps is not None else []
        self._next_idx: int = 0

    def reset(self) -> None:
        self._next_idx = 0

    def evaluate_frame(self, frame: np.ndarray, t_sec: float) -> Optional[float]:
        if self._next_idx < len(self.cut_timestamps) and self.cut_timestamps[self._next_idx] <= t_sec + 1e-6:
            cut_time = self.cut_timestamps[self._next_idx]
            self._next_idx += 1
            return cut_time
        return None
