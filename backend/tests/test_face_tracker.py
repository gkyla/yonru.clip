import unittest
import numpy as np
import os
import sys

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.frame_source import InMemoryFrameSource
from core.face_detector_seam import MockFaceDetector
from core.scene_detector_seam import MockSceneDetector
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

    def test_speaker_blink_dropout_does_not_collapse_split_mode(self):
        # 16 frames at 10 fps -> 8 samples (0.2s each)
        source = InMemoryFrameSource(total_frames=16, width=1000, height=1000, fps=10.0)
        
        # Enters split mode with dual faces [200.0, 800.0]
        # Then top speaker (200.0) blinks / drops out for 2 samples (t = 0.6, 0.8), only bottom speaker (800.0) visible
        # Then top speaker reappears at t = 1.0
        mock_coordinates = [
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0],
            800.0, 800.0,  # Top speaker blinks for ~0.4s (2 samples)
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0]
        ]
        detector = MockFaceDetector(mock_coordinates)
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")

        # The system must remain in split mode throughout the blink, not collapse to single
        for p in crop_map:
            self.assertEqual(p.get("mode"), "split", f"Falsely reverted to single mode during speaker blink at t={p['time']}: {p}")

    def test_fast_cut_bypass_into_split_with_backfill(self):
        # 20 frames at 10 fps -> 10 samples (0.2s each, t = 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8)
        source = InMemoryFrameSource(total_frames=20, width=1000, height=1000, fps=10.0)
        
        # 5 samples single face 500.0 (t = 0.0 to 0.8)
        # sample 5 (t = 1.0): camera cut to dual separated faces [200.0, 800.0] (separation 600 >= 200)
        # sample 6 (t = 1.2): confirmed cut to dual faces [200.0, 800.0]
        # sample 7-9 (t = 1.4..1.8): continuous dual faces
        mock_coordinates = [
            500.0, 500.0, 500.0, 500.0, 500.0,
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0], [200.0, 800.0], [200.0, 800.0]
        ]
        detector = MockFaceDetector(mock_coordinates)
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")

        # Split mode must be activated
        split_points = [p for p in crop_map if p.get("mode") == "split"]
        self.assertTrue(len(split_points) > 0, "Split mode should have activated via fast cut bypass")

        # The first split keyframe must be backfilled to time: 1.0 (the cut point), NOT delayed to 1.2
        first_split = split_points[0]
        self.assertEqual(first_split["time"], 1.0, f"Expected backfilled cut at 1.0s, got {first_split['time']}")
        self.assertEqual(first_split["top_x"], 200)
        self.assertEqual(first_split["bottom_x"], 800)

        # No single-mode entry should exist at or after 1.0s
        for p in crop_map:
            if p["time"] >= 1.0:
                self.assertEqual(p.get("mode"), "split", f"Found lingering single-mode keyframe at t={p['time']}: {p}")

    def test_dense_faces_requires_hold_and_no_cut_bypass(self):
        # 20 fps -> samples_per_sec = 10.0 -> SPLIT_ENTER_HOLD_SAMPLES = max(2, int(0.35 * 10)) = 3 samples
        source = InMemoryFrameSource(total_frames=20, width=1000, height=1000, fps=20.0)
        
        # 4 samples single face 500.0 (t = 0.0, 0.1, 0.2, 0.3)
        # 2 samples dual faces closely positioned [480.0, 520.0] (separation 40 < 200 = 20% width)
        # 4 samples single face 500.0 (t = 0.6..0.9)
        mock_coordinates = [
            500.0, 500.0, 500.0, 500.0,
            [480.0, 520.0], [480.0, 520.0],
            500.0, 500.0, 500.0, 500.0
        ]
        detector = MockFaceDetector(mock_coordinates)
        tracker = FaceTracker(frame_source=source, face_detector=detector)
        crop_map = tracker.analyze_video("dummy_path")

        # Since separation is < 20% and 2 samples < 3 hold samples, split mode should NOT activate
        split_points = [p for p in crop_map if p.get("mode") == "split"]
        self.assertEqual(len(split_points), 0, "Dense faces without spatial separation should not trigger fast cut bypass")

    def test_mediapipe_face_detector_prominence_filter(self):
        from unittest.mock import MagicMock
        from core.face_detector_seam import MediaPipeFaceDetector

        detector = MediaPipeFaceDetector.__new__(MediaPipeFaceDetector)
        detector.face_detection = MagicMock()

        # Mock two detections: one with height 0.085 (>= 0.08, kept), one with 0.075 (< 0.08, filtered)
        d1 = MagicMock()
        d1.location_data.relative_bounding_box.height = 0.085
        d1.location_data.relative_bounding_box.width = 0.06
        d1.location_data.relative_bounding_box.xmin = 0.2

        d2 = MagicMock()
        d2.location_data.relative_bounding_box.height = 0.075
        d2.location_data.relative_bounding_box.width = 0.05
        d2.location_data.relative_bounding_box.xmin = 0.7

        results = MagicMock()
        results.detections = [d1, d2]
        detector.face_detection.process.return_value = results

        dummy_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        faces = detector.locate_faces(dummy_frame, width=1000, height=1000)

        # Only d1 should be recognized as prominent
        self.assertEqual(len(faces), 1)
        expected_x = (0.2 + 0.06 / 2) * 1000
        self.assertAlmostEqual(faces[0], expected_x)

    def test_shot_anchored_snap_locks_exactly_to_scene_cut(self):
        # 16 frames at 10 fps -> 8 samples (t = 0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4)
        # Visual cut occurs at t = 0.5s (between sample 2 (0.4s) and sample 3 (0.6s))
        source = InMemoryFrameSource(total_frames=16, width=1000, height=1000, fps=10.0)
        
        # Samples 0, 1, 2 (t = 0.0, 0.2, 0.4): single face 500.0
        # Samples 3..7 (t = 0.6..1.4): dual faces [200.0, 800.0]
        mock_coordinates = [
            500.0, 500.0, 500.0,
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0], [200.0, 800.0], [200.0, 800.0]
        ]
        detector = MockFaceDetector(mock_coordinates)
        scene_detector = MockSceneDetector(cut_timestamps=[0.5])
        tracker = FaceTracker(frame_source=source, face_detector=detector, scene_detector=scene_detector)
        crop_map = tracker.analyze_video("dummy_path")

        split_points = [p for p in crop_map if p.get("mode") == "split"]
        self.assertTrue(len(split_points) > 0, "Split mode should have activated via shot-anchored snap")

        # The first split keyframe MUST snap exactly to the visual cut point at 0.5s!
        # It must NOT be delayed to sample time 0.6s, and MUST NOT be prematurely backfilled to 0.4s.
        first_split = split_points[0]
        self.assertEqual(first_split["time"], 0.5, f"Expected split keyframe exactly at cut time 0.5s, got {first_split['time']}")
        self.assertEqual(first_split["top_x"], 200)
        self.assertEqual(first_split["bottom_x"], 800)

        # No single-mode keyframe should exist at or after 0.5s
        for p in crop_map:
            if p["time"] >= 0.5:
                self.assertEqual(p.get("mode"), "split", f"Found single mode at or after cut time: {p}")

    def test_shot_anchored_revert_to_single_snaps_instantly_at_cut_point(self):
        # 16 frames at 10 fps -> 8 samples
        source = InMemoryFrameSource(total_frames=16, width=1000, height=1000, fps=10.0)
        
        # Starts in split mode (4 samples of dual faces)
        # Visual cut occurs at t = 0.7s to a single face 500.0
        # Sample at t = 0.8s detects single face 500.0
        mock_coordinates = [
            [200.0, 800.0], [200.0, 800.0], [200.0, 800.0], [200.0, 800.0],
            500.0, 500.0, 500.0, 500.0
        ]
        detector = MockFaceDetector(mock_coordinates)
        scene_detector = MockSceneDetector(cut_timestamps=[0.7])
        tracker = FaceTracker(frame_source=source, face_detector=detector, scene_detector=scene_detector)
        crop_map = tracker.analyze_video("dummy_path")

        # Reversion to single mode should snap exactly to 0.7s
        single_reverts = [p for p in crop_map if p.get("mode") == "single" and p["time"] > 0.0]
        self.assertTrue(len(single_reverts) > 0, "Single mode should have reverted via shot-anchored snap")
        self.assertEqual(single_reverts[0]["time"], 0.7, f"Expected single keyframe at 0.7s, got {single_reverts[0]['time']}")
        self.assertEqual(single_reverts[0]["x"], 500)

if __name__ == '__main__':
    unittest.main()


