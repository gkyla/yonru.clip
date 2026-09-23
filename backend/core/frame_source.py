import subprocess
import json
from abc import ABC, abstractmethod
import cv2
from typing import Tuple, Optional, Any
import numpy as np

def get_video_start_time(video_path: str) -> float:
    """Extracts container video stream start presentation timestamp (PTS) in seconds via ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_entries", "stream=start_time",
            "-select_streams", "v:0",
            video_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0 and res.stdout:
            data = json.loads(res.stdout)
            streams = data.get("streams", [])
            if streams and "start_time" in streams[0]:
                val = streams[0]["start_time"]
                if val is not None:
                    return float(val)
    except Exception:
        pass
    return 0.0

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

    @property
    @abstractmethod
    def start_time(self) -> float:
        """Stream presentation timestamp start offset in seconds."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Releases the frame source."""
        pass

    @abstractmethod
    def reset(self) -> None:
        """Rewinds the frame source back to the beginning (frame 0)."""
        pass


class OpenCVFrameSource(FrameSource):
    def __init__(self, video_path: str, start_time: Optional[float] = None):
        self.video_path = video_path
        self.cap = cv2.VideoCapture(video_path)
        self._start_time = start_time if start_time is not None else get_video_start_time(video_path)
        
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

    @property
    def start_time(self) -> float:
        return self._start_time

    def close(self) -> None:
        if self.cap.isOpened():
            self.cap.release()

    def reset(self) -> None:
        if self.cap.isOpened():
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)


class InMemoryFrameSource(FrameSource):
    def __init__(self, total_frames: int = 100, width: int = 1920, height: int = 1080, fps: float = 30.0, start_time: float = 0.0):
        self._total_frames = total_frames
        self._width = width
        self._height = height
        self._fps = fps
        self._start_time = start_time
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

    @property
    def start_time(self) -> float:
        return self._start_time

    def close(self) -> None:
        pass

    def reset(self) -> None:
        self._current_frame = 0

