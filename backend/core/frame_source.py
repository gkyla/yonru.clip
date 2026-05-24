from abc import ABC, abstractmethod
import cv2
from typing import Tuple, Optional, Any
import numpy as np

class FrameSource(ABC):
    @abstractmethod
    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Reads next frame, returning (success, frame)."""
        pass

    @property
    @abstractmethod
    def width(self) -> int:
        pass

    @property
    @abstractmethod
    def height(self) -> int:
        pass

    @property
    @abstractmethod
    def fps(self) -> float:
        pass

    @abstractmethod
    def close(self) -> None:
        """Releases the frame source."""
        pass


class OpenCVFrameSource(FrameSource):
    def __init__(self, video_path: str):
        self.video_path = video_path
        self.cap = cv2.VideoCapture(video_path)
        
        self._width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self._height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self._fps = self.cap.get(cv2.CAP_PROP_FPS)
        if self._fps <= 0:
            self._fps = 30.0

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        if not self.cap.isOpened():
            return False, None
        ret, frame = self.cap.read()
        return ret, frame

    @property
    def width(self) -> int:
        return self._width

    @property
    def height(self) -> int:
        return self._height

    @property
    def fps(self) -> float:
        return self._fps

    def close(self) -> None:
        if self.cap.isOpened():
            self.cap.release()


class InMemoryFrameSource(FrameSource):
    def __init__(self, total_frames: int = 100, width: int = 1920, height: int = 1080, fps: float = 30.0):
        self._total_frames = total_frames
        self._width = width
        self._height = height
        self._fps = fps
        self._current_frame = 0

    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        if self._current_frame >= self._total_frames:
            return False, None
        self._current_frame += 1
        # Return a dummy empty frame array of correct shape
        dummy_frame = np.zeros((self._height, self._width, 3), dtype=np.uint8)
        return True, dummy_frame

    @property
    def width(self) -> int:
        return self._width

    @property
    def height(self) -> int:
        return self._height

    @property
    def fps(self) -> float:
        return self._fps

    def close(self) -> None:
        pass
