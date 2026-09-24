from abc import ABC, abstractmethod
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


class MediaPipeFaceDetector(FaceDetectorSeam):
    def __init__(self, min_detection_confidence: float = 0.3):
        solutions: Any = getattr(mp, "solutions")
        self.mp_face_detection = solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 1 = full-range
            min_detection_confidence=min_detection_confidence
        )

    def locate_faces(self, frame: np.ndarray, width: int, height: int) -> List[float]:
        # OpenCV reads BGR, MediaPipe expects RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.face_detection.process(rgb_frame)
        
        if not results.detections:
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

