import cv2
from abc import ABC, abstractmethod
import numpy as np
from core.frame_source import OpenCVFrameSource
from core.face_detector_seam import MediaPipeFaceDetector

class AbstractFaceTracker(ABC):
    @abstractmethod
    def analyze_video(self, video_path: str, words_data: list = None):
        """Analyzes a video and returns a crop_map of (time, x) keyframes."""
        pass

class FaceTracker(AbstractFaceTracker):
    def __init__(self, frame_source=None, face_detector=None):
        self.frame_source = frame_source
        self.face_detector = face_detector

    def analyze_video(self, video_path: str, words_data: list = None):
        """
        Analyzes a video and returns a crop_map of (time, x) keyframes.
        Triple-B Stability Strategy:
          - Backfill: Wait for 1st face, then apply its position to the start.
          - Persistence: If detection is lost (cuts), freeze the camera.
          - Verification: Hard cuts require 2 frames of confirmation to prevent ghosting.
        """
        print(f"[face-track] Analyzing {video_path}...")
        
        # 1. Fallback to production wrappers if no stubs are injected
        source = self.frame_source or OpenCVFrameSource(video_path)
        detector = self.face_detector or MediaPipeFaceDetector()
        
        width = source.width
        height = source.height
        fps = source.fps

        # Thresholds
        DEADZONE = width * 0.025
        MIN_SWITCH_DIST = width * 0.15
        
        frame_idx = 0
        crop_map = []
        actual_x = None      # Current camera position
        
        # Stability State
        pending_snap_x = None
        snap_frames_count = 0
        
        while True:
            ret, frame = source.read()
            if not ret:
                break
            
            if frame_idx % 2 == 0:
                t_sec = frame_idx / fps
                
                # Locate face position using deep seam
                detected_target = detector.locate_face(frame, width)
                
                # ── APPLY Triple-B STABILITY ──
                if detected_target is not None:
                    if actual_x is None:
                        # ── FIRST FACE EVER ──
                        actual_x = detected_target
                        # Backfill: Ensure the video starts at this position
                        crop_map.append({"time": 0.0, "x": int(actual_x)})
                        print(f"[face-track] [{t_sec:.2f}s] First face! Initializing & Backfilling to X: {actual_x:.0f}")
                    else:
                        dist = abs(detected_target - actual_x)
                        
                        if dist >= MIN_SWITCH_DIST:
                            # ── POTENTIAL HARD CUT (VERIFICATION) ──
                            if pending_snap_x is not None and abs(detected_target - pending_snap_x) < DEADZONE:
                                snap_frames_count += 1
                            else:
                                pending_snap_x = detected_target
                                snap_frames_count = 1
                            
                            if snap_frames_count >= 2:
                                # Confirmed for 2 frames → commit the snap
                                actual_x = detected_target
                                pending_snap_x = None
                                snap_frames_count = 0
                                print(f"[face-track] [{t_sec:.2f}s] SNAP CONFIRMED to X: {actual_x:.0f}")
                            else:
                                # Not confirmed yet → stay put (Persistence)
                                print(f"[face-track] [{t_sec:.2f}s] Potential snap to {detected_target:.0f}, waiting for verification...")
                        else:
                            # ── DRIFT (SAME SPEAKER) ──
                            pending_snap_x = None
                            snap_frames_count = 0
                            
                            if dist > DEADZONE:
                                move_amt = detected_target - actual_x
                                move_amt = (move_amt - DEADZONE) if move_amt > 0 else (move_amt + DEADZONE)
                                actual_x = actual_x + move_amt * 0.1
                                # No print here to keep logs clean
                else:
                    # ── NO FACE DETECTED (PERSISTENCE) ──
                    # If we have a position, keep it (Freeze). If not, do nothing.
                    pending_snap_x = None
                    snap_frames_count = 0
                    if actual_x is not None:
                        # We don't change actual_x, effectively freezing the camera
                        pass
                
                # Decimate: only append to crop_map if moved by >= 1 pixel and we have a valid position
                if actual_x is not None:
                    if not crop_map or abs(actual_x - crop_map[-1]["x"]) >= 1.0:
                        crop_map.append({
                            "time": round(t_sec, 3),
                            "x": int(actual_x)
                        })
            
            frame_idx += 1
        
        source.close()

        if not crop_map:
            print("[face-track] No faces found in entire video. Defaulting to center.")
            return width // 2

        # Add final keyframe for timeline coverage
        last_t = (frame_idx - 1) / fps
        if crop_map[-1]["time"] < last_t:
            crop_map.append({"time": round(last_t, 3), "x": crop_map[-1]["x"]})

        print(f"[face-track] Finished: {len(crop_map)} points generated.")
        return crop_map


class MockFaceTracker(AbstractFaceTracker):
    def __init__(self, mock_result=960):
        self.mock_result = mock_result
        self.analyzed_paths = []

    def analyze_video(self, video_path: str, words_data: list = None):
        self.analyzed_paths.append(video_path)
        return self.mock_result
