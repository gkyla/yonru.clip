import cv2
from abc import ABC, abstractmethod
from typing import Optional, Any, List
import numpy as np
from core.frame_source import OpenCVFrameSource
from core.face_detector_seam import MediaPipeFaceDetector
from core.scene_detector_seam import SceneDetectorSeam, OpenCVSceneDetector

def find_recent_cut(cuts: List[float], t_sec: float, lookback: float = 0.25, last_consumed_cut: Optional[float] = None) -> Optional[float]:
    """Finds the latest visual cut point in [t_sec - lookback, t_sec] that has not already been consumed."""
    if not cuts:
        return None
    # Use 0.05s (~1 frame at 24fps) forward tolerance for floating point / rounding precision
    recent = [
        c for c in cuts
        if (t_sec - lookback - 1e-3) <= c <= (t_sec + 0.05)
        and (last_consumed_cut is None or c > (last_consumed_cut + 0.01))
    ]
    return max(recent) if recent else None

class AbstractFaceTracker(ABC):
    @abstractmethod
    def analyze_video(self, video_path: str, words_data: Optional[list] = None) -> Any:
        """Analyzes a video and returns a crop_map of (time, x) keyframes."""
        pass

class FaceTracker(AbstractFaceTracker):
    def __init__(self, frame_source=None, face_detector=None, scene_detector=None):
        self.frame_source = frame_source
        self.face_detector = face_detector
        self.scene_detector = scene_detector

    def analyze_video(self, video_path: str, words_data: Optional[list] = None) -> Any:
        """
        Analyzes a video and returns a crop_map of (time, x) keyframes.
        Shot-Anchored Snapping Strategy:
          - Pass 1 (Scene Cut Detection): Detects precise Visual Cut Points via color histogram analysis.
          - Pass 2 (Face Tracking & Classification): Snaps layout transitions to visual cut points.
          - Persistence: If detection is lost without a cut (e.g. blinks), layout and camera freeze.
        """
        print(f"[face-track] Analyzing {video_path}...")
        
        # 1. Fallback to production wrappers if no stubs are injected
        source = self.frame_source or OpenCVFrameSource(video_path)
        detector = self.face_detector or MediaPipeFaceDetector()
        scene_detector = self.scene_detector or OpenCVSceneDetector()

        # Pass 1: Detect visual camera cuts (Shot Boundaries)
        cut_timestamps = scene_detector.detect_cuts(source)
        if hasattr(source, "reset"):
            source.reset()
        
        width = source.width
        height = source.height
        fps = source.fps

        # Thresholds
        DEADZONE = width * 0.025
        MIN_SWITCH_DIST = width * 0.15
        MIN_SPLIT_SEPARATION = width * 0.20
        SMOOTHING_FACTOR = 0.3
        
        # Stability / Hysteresis thresholds
        # Entering split mode:
        #   - Shot-Anchored Snap: Snaps to exact visual cut point in [t - 0.25s, t]
        #   - Fast Cut Bypass Fallback: 2 samples (~0.13s) when dual faces are separated by >= 20% width
        #   - Regular In-Scene Entry: ~0.35s of stable dual faces
        # Reverting to single mode:
        #   - Shot-Anchored Snap: Snaps instantly to visual cut point when single face appears after cut
        #   - Partial Dropout / Blink Hold: ~0.8s of sustained single speaker before collapsing layout
        #   - Full Dropout Hold: ~0.8s when 0 faces are detected
        samples_per_sec = max(1.0, fps / 2.0)
        SPLIT_ENTER_HOLD_SAMPLES = max(2, int(0.35 * samples_per_sec))
        SPLIT_REVERT_HOLD_SAMPLES = max(2, int(0.8 * samples_per_sec))

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
        split_enter_cut_samples = 0
        split_cut_first_t = None
        split_cut_target_t = None
        single_cut_target_t = None
        last_consumed_cut: Optional[float] = None
        start_time = getattr(source, "start_time", 0.0)

        def append_crop_entry(entry: dict):
            entry_t = round(entry["time"], 3)
            entry["time"] = entry_t
            if crop_map and round(crop_map[-1]["time"], 3) == entry_t:
                crop_map[-1] = entry
            else:
                crop_map.append(entry)
        
        while True:
            ret, frame = source.read()
            if not ret or frame is None:
                break
            
            if frame_idx % 2 == 0:
                t_sec = start_time + (frame_idx / fps)
                
                # Locate face positions using deep seam
                detected_faces = detector.locate_faces(frame, width, height)
                
                # Update split hysteresis counters and cut detection
                is_cut_to_single = False
                is_cut_to_split = False
                if len(detected_faces) >= 2:
                    consecutive_split_samples += 1
                    consecutive_single_samples = 0
                    pending_split_cut_x = None
                    split_cut_frames_count = 0

                    # Scene Cut Detection into Split: two prominent faces with >= 20% width separation
                    if not is_split_mode:
                        d_faces = abs(detected_faces[1] - detected_faces[0])
                        recent_cut = find_recent_cut(cut_timestamps, t_sec, lookback=0.25, last_consumed_cut=last_consumed_cut)

                        if recent_cut is not None:
                            # Shot-Anchored Snap: visual cut point found!
                            is_cut_to_split = True
                            split_cut_target_t = recent_cut
                            last_consumed_cut = recent_cut
                        elif d_faces >= MIN_SPLIT_SEPARATION:
                            # Fast Cut Bypass fallback (when no visual cut detected or in un-cut videos)
                            split_enter_cut_samples += 1
                            if split_enter_cut_samples == 1:
                                split_cut_first_t = t_sec
                            elif split_enter_cut_samples >= 2:
                                is_cut_to_split = True
                                split_cut_target_t = split_cut_first_t
                        else:
                            split_enter_cut_samples = 0
                            split_cut_first_t = None
                else:
                    consecutive_single_samples += 1
                    consecutive_split_samples = 0
                    split_enter_cut_samples = 0
                    split_cut_first_t = None

                    # Scene Cut Detection: if single face appears following a visual cut, or jumps far
                    if is_split_mode and len(detected_faces) == 1:
                        cand_x = detected_faces[0]
                        recent_cut = find_recent_cut(cut_timestamps, t_sec, lookback=0.25, last_consumed_cut=last_consumed_cut)

                        d_top = abs(cand_x - actual_top_x) if actual_top_x is not None else 0
                        d_bot = abs(cand_x - actual_bottom_x) if actual_bottom_x is not None else 0

                        # In-Shot Partial Dropout Immunity:
                        # A single face matching either existing speaker position is an in-shot head-turn/blink, NOT a camera cut.
                        # Only a face far from BOTH existing split speakers can be an instant cut to a single-speaker close-up.
                        if recent_cut is not None and d_top >= MIN_SWITCH_DIST and d_bot >= MIN_SWITCH_DIST:
                            # Shot-Anchored Snap: visual cut back to single speaker!
                            is_cut_to_single = True
                            single_cut_target_t = recent_cut
                            last_consumed_cut = recent_cut
                        elif actual_top_x is not None and actual_bottom_x is not None:
                            # Fallback spatial jump cut detection
                            if d_top >= MIN_SWITCH_DIST and d_bot >= MIN_SWITCH_DIST:
                                if pending_split_cut_x is not None and abs(cand_x - pending_split_cut_x) < DEADZONE:
                                    split_cut_frames_count += 1
                                else:
                                    pending_split_cut_x = cand_x
                                    split_cut_frames_count = 1

                                if split_cut_frames_count >= 2:
                                    is_cut_to_single = True
                                    single_cut_target_t = t_sec
                            else:
                                pending_split_cut_x = None
                                split_cut_frames_count = 0
                    else:
                        pending_split_cut_x = None
                        split_cut_frames_count = 0

                # Evaluate layout mode transitions
                just_entered_split = False
                just_entered_single = False
                if not is_split_mode and (is_cut_to_split or consecutive_split_samples >= SPLIT_ENTER_HOLD_SAMPLES):
                    is_split_mode = True
                    just_entered_split = True
                    print(f"[face-track] [{t_sec:.2f}s] Switched to STACKED MULTI-SPEAKER (Split) mode (cut={is_cut_to_split}).")
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

                            split_time = t_sec
                            if is_cut_to_split and split_cut_target_t is not None:
                                split_time = split_cut_target_t
                                # Shot-Anchored Snapping: prune any intermediate single-mode entries at or after split_cut_target_t
                                target_time_rounded = round(split_time, 3)
                                while crop_map and round(crop_map[-1]["time"], 3) >= target_time_rounded:
                                    crop_map.pop()

                            split_enter_cut_samples = 0
                            split_cut_first_t = None
                            split_cut_target_t = None

                            if not crop_map or just_entered_split:
                                append_crop_entry({
                                    "time": split_time,
                                    "mode": "split",
                                    "x": int(actual_top_x),
                                    "top_x": int(actual_top_x),
                                    "bottom_x": int(actual_bottom_x)
                                })
                                actual_x = actual_top_x
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
                            append_crop_entry({
                                "time": t_sec,
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
                            append_crop_entry({
                                "time": 0.0,
                                "mode": "single",
                                "x": int(actual_x)
                            })
                            print(f"[face-track] [{t_sec:.2f}s] First face! Initializing & Backfilling to X: {actual_x:.0f}")
                        elif just_entered_single:
                            # Instant snap cut when reverting from split to single
                            actual_x = float(detected_target)
                            actual_top_x = actual_x
                            actual_bottom_x = min(width - 1, actual_x + width * 0.3)
                            pending_snap_x = None
                            snap_frames_count = 0

                            single_time = t_sec
                            if single_cut_target_t is not None:
                                single_time = single_cut_target_t
                                # Shot-Anchored Snapping: prune any intermediate split-mode entries at or after single_cut_target_t
                                target_time_rounded = round(single_time, 3)
                                while crop_map and round(crop_map[-1]["time"], 3) >= target_time_rounded:
                                    crop_map.pop()

                            single_cut_target_t = None
                            append_crop_entry({
                                "time": single_time,
                                "mode": "single",
                                "x": int(actual_x)
                            })
                            print(f"[face-track] [{single_time:.2f}s] Reverted to single: snapped to {actual_x:.0f}")
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
                            append_crop_entry({
                                "time": t_sec,
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
