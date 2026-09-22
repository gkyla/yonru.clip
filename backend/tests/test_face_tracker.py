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

    def test_responsive_smoothing_faster_convergence(self):
        # 10 frames at 10 fps (5 samples: 0, 2, 4, 6, 8)
        # Start at 500, then target moves to 600
        source = InMemoryFrameSource(total_frames=10, width=1000, height=1000, fps=10.0)
        mock_coordinates = [500.0, 600.0, 600.0, 600.0, 600.0]
        detector = MockFaceDetector(mock_coordinates)
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")

        # With 0.3 factor (move_amt - DEADZONE(25)) * 0.3:
        # Step 1: 500
        # Step 2: move_amt = 100 - 25 = 75 * 0.3 = 22.5 -> 522
        # After 4 steps, x should be well above 550 (much faster than 0.1 which would be ~515)
        last_point = crop_map[-1]
        self.assertGreater(last_point["x"], 540)
        self.assertEqual(last_point["mode"], "single")

    def test_dual_speaker_split_and_hysteresis_hold(self):
        # 24 frames at 10 fps -> 12 samples (0.2s each)
        # STABLE_HOLD_SAMPLES for 10fps = max(2, int(1.0 * 5)) = 5 samples
        source = InMemoryFrameSource(total_frames=24, width=1000, height=1000, fps=10.0)
        
        # 5 samples of single face, then 6 samples of dual faces, then 1 sample single face (transient drop)
        mock_coordinates = [
            500.0, 500.0, 500.0, 500.0, 500.0,          # 5 single
            [250.0, 750.0], [250.0, 750.0], [250.0, 750.0], # 3 dual
            [250.0, 750.0], [250.0, 750.0], [250.0, 750.0], # 3 dual (total 6 dual >= 5 hold)
            500.0                                            # 1 transient single
        ]
        detector = MockFaceDetector(mock_coordinates)
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")

        # Verify that split mode was triggered
        split_points = [p for p in crop_map if p.get("mode") == "split"]
        self.assertTrue(len(split_points) > 0)
        
        # Verify top_x and bottom_x are populated
        first_split = split_points[0]
        self.assertEqual(first_split["mode"], "split")
        self.assertEqual(first_split["top_x"], 250)
        self.assertEqual(first_split["bottom_x"], 750)

        # The last sample was a 1-frame transient single drop.
        # Because 1 frame < STABLE_HOLD_SAMPLES (5), hysteresis should keep it in split mode!
        self.assertEqual(crop_map[-1]["mode"], "split")

    def test_fast_revert_to_single_on_scene_cut_without_ghost_panning(self):
        # 20 frames at 10 fps -> 10 samples (0.2s each)
        source = InMemoryFrameSource(total_frames=20, width=1000, height=1000, fps=10.0)
        
        # 6 samples of dual faces [200.0, 800.0] (enters split after 5 samples)
        # followed by camera cut to single face in center 500.0 for 4 samples (0.8s)
        mock_coordinates = [
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0], 
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0],
            500.0, 500.0, 500.0, 500.0
        ]
        detector = MockFaceDetector(mock_coordinates)
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")

        # 1. No ghost tracking: while in split mode, top_x must NOT drift towards 500.0
        split_points = [p for p in crop_map if p.get("mode") == "split"]
        self.assertTrue(len(split_points) > 0, "Split mode should have been activated")
        for sp in split_points:
            self.assertLess(sp.get("top_x", 0), 250, f"top_x ghost-tracked towards center during split: {sp}")

        # 2. Fast revert on cut: by 0.4s after cut (time >= 1.6s), mode MUST be single (not hold 1.0s)
        late_points = [p for p in crop_map if p["time"] >= 1.6]
        self.assertTrue(len(late_points) > 0)
        for lp in late_points:
            self.assertEqual(lp.get("mode"), "single", f"Expected single mode after cut at time {lp['time']}, got {lp.get('mode')}")

if __name__ == '__main__':
    unittest.main()

