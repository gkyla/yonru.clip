import unittest
import numpy as np
import os
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.frame_source import InMemoryFrameSource
from core.face_detector_seam import MockFaceDetector
from core.face_tracker import FaceTracker

class TestFaceTracker(unittest.TestCase):
    def test_backfill_first_face(self):
        source = InMemoryFrameSource(total_frames=10, width=1000, height=1000, fps=10.0)
        
        # Processed frames: 0, 2, 4, 6, 8
        # None at start, then 500.0
        mock_coordinates = [None, 500.0, 500.0, 500.0, 500.0]
        detector = MockFaceDetector(mock_coordinates)
        
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")
        
        # Backfill must establish 0.0s time at the first detected face's position (500)
        self.assertEqual(crop_map[0]["time"], 0.0)
        self.assertEqual(crop_map[0]["x"], 500)

    def test_persistence_camera_freezes(self):
        source = InMemoryFrameSource(total_frames=10, width=1000, height=1000, fps=10.0)
        
        # Coordinate sequence: 500.0, None, None, 500.0, 500.0
        mock_coordinates = [500.0, None, None, 500.0, 500.0]
        detector = MockFaceDetector(mock_coordinates)
        
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")
        
        # The crop map should freeze at 500 because face loss triggers freezing/persistence
        for point in crop_map:
            self.assertEqual(point["x"], 500)

    def test_hard_cut_verification_requires_two_frames(self):
        source = InMemoryFrameSource(total_frames=14, width=1000, height=1000, fps=10.0)
        
        # Processed frames: 0, 2, 4, 6, 8, 10, 12
        # frame 0: 500.0 (First face - Backfill)
        # frame 2: 500.0 (Same)
        # frame 4: 800.0 (Potential Snap - wait 1 confirmation)
        # frame 6: 800.0 (Confirmed Snap! commits -> 800)
        # frame 8: 800.0 (Same)
        # frame 10: 200.0 (Potential Snap)
        # frame 12: 800.0 (Verification failed! Snap aborted; stays at 800)
        mock_coordinates = [500.0, 500.0, 800.0, 800.0, 800.0, 200.0, 800.0]
        detector = MockFaceDetector(mock_coordinates)
        
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")
        
        # The crop map should confirm the snap to 800
        snap_points = [p for p in crop_map if p["x"] == 800]
        self.assertTrue(len(snap_points) > 0)
        
        # Verify that the unconfirmed snap to 200 was successfully aborted
        aborted_points = [p for p in crop_map if p["x"] == 200]
        self.assertEqual(len(aborted_points), 0)

if __name__ == '__main__':
    unittest.main()
