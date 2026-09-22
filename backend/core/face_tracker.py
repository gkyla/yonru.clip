import cv2
from abc import ABC, abstractmethod
from typing import Optional, Any
import numpy as np
from core.frame_source import OpenCVFrameSource
from core.face_detector_seam import MediaPipeFaceDetector

class AbstractFaceTracker(ABC):
    @abstractmethod
    def analyze_video(self, video_path: str, words_data: Optional[list] = None) -> Any:
        """Analyzes a video and returns a crop_map of (time, x) keyframes."""
        pass

class FaceTracker(AbstractFaceTracker):
    def __init__(self, frame_source=None, face_detector=None):
        self.frame_source = frame_source
        self.face_detector = face_detector

    def analyze_video(self, video_path: str, words_data: Optional[list] = None) -> Any:
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
        SMOOTHING_FACTOR = 0.3
        
        # Stability / Hysteresis thresholds
        # Entering split mode requires 0.8s of stable dual faces
        # Reverting to single mode on regular dropout requires fast confirmation (~0.12s / 2 samples)
        samples_per_sec = max(1.0, fps / 2.0)
        SPLIT_ENTER_HOLD_SAMPLES = max(2, int(0.8 * samples_per_sec))
        SPLIT_REVERT_HOLD_SAMPLES = max(2, int(0.12 * samples_per_sec))

        frame_idx = 0
        crop_map = []
        actual_x = None             # Current camera position (single speaker)
        actual_top_x = None         # Current top speaker position (split mode)
        actual_bottom_x = None      # Current bottom speaker position (split mode)
        
        # Single-mode snap stability state
        pending_snap_x = None
        snap_frames_count = 0

        # Multi-speaker hysteresis state
        is_split_mode = False
        consecutive_split_samples = 0
        consecutive_single_samples = 0
        pending_split_cut_x = None
        split_cut_frames_count = 0
        
        while True:
            ret, frame = source.read()
            if not ret or frame is None:
                break
            
            if frame_idx % 2 == 0:
                t_sec = frame_idx / fps
                
                # Locate face positions using deep seam
                detected_faces = detector.locate_faces(frame, width, height)
                
                # Update split hysteresis counters and cut detection
                is_cut_to_single = False
                if len(detected_faces) >= 2:
                    consecutive_split_samples += 1
                    consecutive_single_samples = 0
                    pending_split_cut_x = None
                    split_cut_frames_count = 0
                else:
                    consecutive_single_samples += 1
                    consecutive_split_samples = 0

                    # Scene Cut Detection: if single face jumps far from BOTH viewports, it is a camera cut
                    if is_split_mode and len(detected_faces) == 1 and actual_top_x is not None and actual_bottom_x is not None:
                        cand_x = detected_faces[0]
                        d_top = abs(cand_x - actual_top_x)
                        d_bot = abs(cand_x - actual_bottom_x)
                        if d_top >= MIN_SWITCH_DIST and d_bot >= MIN_SWITCH_DIST:
                            if pending_split_cut_x is not None and abs(cand_x - pending_split_cut_x) < DEADZONE:
                                split_cut_frames_count += 1
                            else:
                                pending_split_cut_x = cand_x
                                split_cut_frames_count = 1

                            if split_cut_frames_count >= 2:
                                is_cut_to_single = True
                        else:
                            pending_split_cut_x = None
                            split_cut_frames_count = 0
                    else:
                        pending_split_cut_x = None
                        split_cut_frames_count = 0

                # Evaluate layout mode transitions
                just_entered_split = False
                just_entered_single = False
                if not is_split_mode and consecutive_split_samples >= SPLIT_ENTER_HOLD_SAMPLES:
                    is_split_mode = True
                    just_entered_split = True
                    print(f"[face-track] [{t_sec:.2f}s] Switched to STACKED MULTI-SPEAKER (Split) mode.")
                elif is_split_mode and (is_cut_to_single or consecutive_single_samples >= SPLIT_REVERT_HOLD_SAMPLES):
                    is_split_mode = False
                    just_entered_single = True
                    pending_split_cut_x = None
                    split_cut_frames_count = 0
                    print(f"[face-track] [{t_sec:.2f}s] Reverted to SINGLE-SPEAKER mode (cut={is_cut_to_single}).")

                if is_split_mode:
                    # ── STACKED MULTI-SPEAKER TRACKING ──
                    if len(detected_faces) >= 2:
                        target_top = detected_faces[0]
                        target_bottom = detected_faces[1]
                    elif len(detected_faces) == 1:
                        # Partial dropout: check if the single face matches one of the existing speakers
                        cand_x = detected_faces[0]
                        d_top = abs(cand_x - actual_top_x) if actual_top_x is not None else 0
                        d_bot = abs(cand_x - actual_bottom_x) if actual_bottom_x is not None else 0

                        if d_top < MIN_SWITCH_DIST and d_top <= d_bot:
                            # Matches top speaker: gently track top, freeze bottom
                            target_top = cand_x
                            target_bottom = actual_bottom_x
                        elif d_bot < MIN_SWITCH_DIST:
                            # Matches bottom speaker: freeze top, gently track bottom
                            target_top = actual_top_x
                            target_bottom = cand_x
                        else:
                            # Far from both (cut candidate): FREEZE BOTH viewports (no ghost tracking)
                            target_top = actual_top_x
                            target_bottom = actual_bottom_x
                    else:
                        # Full temporary dropout: freeze both
                        target_top = actual_top_x
                        target_bottom = actual_bottom_x

                    if target_top is not None and target_bottom is not None:
                        if actual_top_x is None or actual_bottom_x is None or just_entered_split:
                            actual_top_x = float(target_top)
                            actual_bottom_x = float(target_bottom)
                            if not crop_map:
                                crop_map.append({
                                    "time": 0.0,
                                    "mode": "split",
                                    "x": int(actual_top_x),
                                    "top_x": int(actual_top_x),
                                    "bottom_x": int(actual_bottom_x)
                                })
                        else:
                            # Smooth tracking for top
                            d_top = abs(target_top - actual_top_x)
                            if d_top > DEADZONE:
                                move_top = target_top - actual_top_x
                                move_top = (move_top - DEADZONE) if move_top > 0 else (move_top + DEADZONE)
                                actual_top_x += move_top * SMOOTHING_FACTOR

                            # Smooth tracking for bottom
                            d_bot = abs(target_bottom - actual_bottom_x)
                            if d_bot > DEADZONE:
                                move_bot = target_bottom - actual_bottom_x
                                move_bot = (move_bot - DEADZONE) if move_bot > 0 else (move_bot + DEADZONE)
                                actual_bottom_x += move_bot * SMOOTHING_FACTOR

                        # Decimate: record keyframe if moved or mode changed
                        prev_entry = crop_map[-1] if crop_map else None
                        should_append = (
                            not prev_entry
                            or prev_entry.get("mode") != "split"
                            or abs(actual_top_x - prev_entry.get("top_x", 0)) >= 1.0
                            or abs(actual_bottom_x - prev_entry.get("bottom_x", 0)) >= 1.0
                        )
                        if should_append:
                            crop_map.append({
                                "time": round(t_sec, 3),
                                "mode": "split",
                                "x": int(actual_top_x),
                                "top_x": int(actual_top_x),
                                "bottom_x": int(actual_bottom_x)
                            })
                            actual_x = actual_top_x  # Keep sync for single-mode fallback

                else:
                    # ── SINGLE-SPEAKER TRACKING ──
                    detected_target = detected_faces[0] if detected_faces else None

                    if detected_target is not None:
                        if actual_x is None:
                            # ── FIRST FACE EVER ──
                            actual_x = detected_target
                            actual_top_x = actual_x
                            actual_bottom_x = min(width - 1, actual_x + width * 0.3)
                            # Backfill: Ensure the video starts at this position
                            crop_map.append({
                                "time": 0.0,
                                "mode": "single",
                                "x": int(actual_x)
                            })
                            print(f"[face-track] [{t_sec:.2f}s] First face! Initializing & Backfilling to X: {actual_x:.0f}")
                        elif just_entered_single:
                            # Instant snap cut when reverting from split to single
                            actual_x = detected_target
                            pending_snap_x = None
                            snap_frames_count = 0
                            print(f"[face-track] [{t_sec:.2f}s] Reverted to single: snapped to {actual_x:.0f}")
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
                                    actual_x = actual_x + move_amt * SMOOTHING_FACTOR
                    else:
                        # ── NO FACE DETECTED (PERSISTENCE) ──
                        pending_snap_x = None
                        snap_frames_count = 0

                    # Decimate: only append to crop_map if moved by >= 1 pixel or mode changed
                    if actual_x is not None:
                        prev_entry = crop_map[-1] if crop_map else None
                        should_append = (
                            not prev_entry
                            or prev_entry.get("mode") != "single"
                            or abs(actual_x - prev_entry.get("x", 0)) >= 1.0
                        )
                        if should_append:
                            crop_map.append({
                                "time": round(t_sec, 3),
                                "mode": "single",
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
            final_entry = dict(crop_map[-1])
            final_entry["time"] = round(last_t, 3)
            crop_map.append(final_entry)

        print(f"[face-track] Finished: {len(crop_map)} points generated.")
        return crop_map



class MockFaceTracker(AbstractFaceTracker):
    def __init__(self, mock_result: Any = 960):
        self.mock_result = mock_result
        self.analyzed_paths = []

    def analyze_video(self, video_path: str, words_data: Optional[list] = None) -> Any:
        self.analyzed_paths.append(video_path)
        return self.mock_result
