from abc import ABC, abstractmethod
from contextlib import AbstractContextManager, nullcontext
import threading
import cv2
import mediapipe as mp
from typing import Optional, List, Any, Sequence
import numpy as np


class FaceDetectorSeam(ABC):
    @abstractmethod
    def locate_face(self, frame: np.ndarray, width: int) -> Optional[float]:
        """Process RGB frame and returns the largest face x-coordinate, or None."""
        pass

    @abstractmethod
    def locate_faces(self, frame: np.ndarray, width: int, height: int) -> List[float]:
        """Process RGB frame and returns list of prominent face x-coordinates sorted left-to-right."""
        pass

    def close(self) -> None:
        """Releases any detector resources held by the implementation."""
        pass


class MediaPipeFaceDetector(FaceDetectorSeam):
    def __init__(self, min_detection_confidence: float = 0.3, max_width: int = 640):
        solutions: Any = getattr(mp, "solutions")
        self.mp_face_detection = solutions.face_detection
        self.max_width = max_width
        self._lock = threading.Lock()
        self._closed = False
        self.face_detection: Any = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 1 = full-range
            min_detection_confidence=min_detection_confidence
        )

    def _lock_ctx(self) -> AbstractContextManager[Any]:
        return getattr(self, "_lock", None) or nullcontext()

    def _run_detection(self, rgb_frame: np.ndarray) -> Any:
        if getattr(self, "_closed", False) or self.face_detection is None:
            return None
        return self.face_detection.process(rgb_frame)

    def locate_faces(self, frame: np.ndarray, width: int, height: int) -> List[float]:
        if getattr(self, "_closed", False) or self.face_detection is None:
            return []

        max_width = getattr(self, "max_width", 640)
        input_frame = frame
        if max_width and max_width > 0 and frame.shape[1] > max_width:
            scale = max_width / float(frame.shape[1])
            resized_h = max(1, int(round(frame.shape[0] * scale)))
            input_frame = cv2.resize(frame, (max_width, resized_h), interpolation=cv2.INTER_AREA)

        # OpenCV reads BGR, MediaPipe expects RGB
        rgb_frame = cv2.cvtColor(input_frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False

        with self._lock_ctx():
            results = self._run_detection(rgb_frame)

        if results is None or not results.detections:
            return []

        # Prominence Filter: bounding box height >= 8% of frame height (0.08 relative)
        prominent = []
        for d in results.detections:
            bbox = d.location_data.relative_bounding_box
            if bbox.height >= 0.08:
                area = bbox.width * bbox.height
                x_center = float(bbox.xmin + bbox.width / 2) * width
                prominent.append((area, x_center))

        if not prominent:
            # Fallback to largest detected face if none meet 8% height threshold
            best = max(
                results.detections, 
                key=lambda d: d.location_data.relative_bounding_box.width * d.location_data.relative_bounding_box.height
            )
            bbox = best.location_data.relative_bounding_box
            return [float(bbox.xmin + bbox.width / 2) * width]

        # Sort by area descending to pick up to 2 largest faces
        prominent.sort(key=lambda item: item[0], reverse=True)
        top_faces = prominent[:2]

        # Sort the chosen faces by horizontal position: left-to-right
        top_faces.sort(key=lambda item: item[1])
        return [x for (_, x) in top_faces]

    def locate_face(self, frame: np.ndarray, width: int) -> Optional[float]:
        h = frame.shape[0] if frame is not None else 1080
        faces = self.locate_faces(frame, width, h)
        return faces[0] if faces else None

    def close(self) -> None:
        with self._lock_ctx():
            if getattr(self, "_closed", False):
                return
            self._closed = True
            detector = getattr(self, "face_detection", None)
            self.face_detection = None
            if detector is not None and hasattr(detector, "close"):
                detector.close()


class MockFaceDetector(FaceDetectorSeam):
    def __init__(self, coordinate_list: Optional[Sequence[Any]] = None):
        self.coordinates = coordinate_list or []
        self._current_index = 0

    def locate_faces(self, frame: np.ndarray, width: int, height: int) -> List[float]:
        if self._current_index >= len(self.coordinates):
            return []
        res = self.coordinates[self._current_index]
        self._current_index += 1
        if res is None:
            return []
        if isinstance(res, (list, tuple)):
            return [float(x) for x in res]
        return [float(res)]

    def locate_face(self, frame: np.ndarray, width: int) -> Optional[float]:
        h = frame.shape[0] if frame is not None else 1080
        faces = self.locate_faces(frame, width, h)
        return faces[0] if faces else None

