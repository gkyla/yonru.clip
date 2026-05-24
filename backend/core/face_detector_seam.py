from abc import ABC, abstractmethod
import cv2
import mediapipe as mp
from typing import Optional, List, Any
import numpy as np

class FaceDetectorSeam(ABC):
    @abstractmethod
    def locate_face(self, frame: np.ndarray, width: int) -> Optional[float]:
        """Process RGB frame and returns the largest face x-coordinate, or None."""
        pass


class MediaPipeFaceDetector(FaceDetectorSeam):
    def __init__(self, min_detection_confidence: float = 0.3):
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 1 = full-range
            min_detection_confidence=min_detection_confidence
        )

    def locate_face(self, frame: np.ndarray, width: int) -> Optional[float]:
        # OpenCV reads BGR, MediaPipe expects RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.face_detection.process(rgb_frame)
        
        if results.detections:
            # Pick the largest face (Solo-Mode focus)
            best_detection = max(
                results.detections, 
                key=lambda d: d.location_data.relative_bounding_box.width * d.location_data.relative_bounding_box.height
            )
            bboxC = best_detection.location_data.relative_bounding_box
            return float(bboxC.xmin + bboxC.width / 2) * width
        return None


class MockFaceDetector(FaceDetectorSeam):
    def __init__(self, coordinate_list: List[Optional[float]] = None):
        self.coordinates = coordinate_list or []
        self._current_index = 0

    def locate_face(self, frame: np.ndarray, width: int) -> Optional[float]:
        if self._current_index >= len(self.coordinates):
            return None
        res = self.coordinates[self._current_index]
        self._current_index += 1
        return res
