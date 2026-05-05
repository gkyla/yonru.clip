import cv2
import mediapipe as mp
import numpy as np

class FaceTracker:
    def __init__(self):
        self.mp_face_detection = mp.solutions.face_detection
        self.face_detection = self.mp_face_detection.FaceDetection(
            model_selection=1,  # 1 = full-range (further faces)
            min_detection_confidence=0.3
        )

    def analyze_video(self, video_path: str, words_data: list = None):
        """
        Analyzes a video and returns a crop_map of (time, x) keyframes.
        
        Simplified "Follow the Face" algorithm:
          - 1 face on screen  → center on it (covers camera-cut podcasts)
          - 2+ faces on screen → center on the one with the most mouth motion
          - motion inconclusive → stay on current speaker ("stay put" rule)
        
        Stabilized with:
          - Deadzone: ignore micro-jitter within ~2.5% of frame width
          - Slow EMA (0.1): cinematic smooth panning for same-speaker drift
          - Hard cut: instant jump when switching to a distant speaker
        """
        print(f"[face-track] Analyzing {video_path}...")
        cap = cv2.VideoCapture(video_path)
        
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0

        # Thresholds
        DEADZONE = width * 0.025         # ~48px — ignore jitter smaller than this
        MIN_SWITCH_DIST = width * 0.15   # ~288px — must move this far to trigger a hard cut
        MOTION_RATIO = 1.5               # speaker must have 1.5x more motion than others to switch

        frame_idx = 0
        prev_gray = None
        crop_map = []
        actual_x = width / 2  # start centered
        last_hard_cut_time = -1.0  # debounce: time of last hard cut
        HARD_CUT_COOLDOWN = 0.5   # seconds before allowing another hard cut

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every 2nd frame for performance
            if frame_idx % 2 == 0:
                t_sec = frame_idx / fps
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb_frame.flags.writeable = False
                results = self.face_detection.process(rgb_frame)
                
                target_x = None  # where the camera WANTS to go this frame
                
                if results.detections:
                    faces = []
                    for detection in results.detections:
                        bboxC = detection.location_data.relative_bounding_box
                        x_min = max(0, int(bboxC.xmin * width))
                        y_min = max(0, int(bboxC.ymin * height))
                        box_w = min(width - x_min, int(bboxC.width * width))
                        box_h = min(height - y_min, int(bboxC.height * height))
                        
                        center_x = float(x_min + box_w / 2)
                        
                        # Measure mouth-region motion (bottom 40% of face bbox)
                        motion = 0.0
                        if prev_gray is not None and box_w > 0 and box_h > 0:
                            m_y = y_min + int(box_h * 0.6)
                            m_h = int(box_h * 0.4)
                            m_y = max(0, m_y)
                            m_h = min(height - m_y, m_h)
                            if m_h > 0 and box_w > 0:
                                curr_mouth = gray[m_y:m_y+m_h, x_min:x_min+box_w]
                                prev_mouth = prev_gray[m_y:m_y+m_h, x_min:x_min+box_w]
                                if curr_mouth.shape == prev_mouth.shape and curr_mouth.size > 0:
                                    diff = cv2.absdiff(curr_mouth, prev_mouth)
                                    motion = float(np.mean(diff))
                        
                        faces.append({"x": center_x, "motion": motion})
                    
                    if len(faces) == 1:
                        # ── SINGLE FACE: just follow it ──
                        target_x = faces[0]["x"]
                    
                    elif len(faces) >= 2:
                        # ── MULTIPLE FACES: pick the one talking ──
                        faces_sorted = sorted(faces, key=lambda f: f["motion"], reverse=True)
                        top = faces_sorted[0]
                        runner_up = faces_sorted[1]
                        
                        if top["motion"] > 0 and (runner_up["motion"] == 0 or top["motion"] / max(runner_up["motion"], 0.01) >= MOTION_RATIO):
                            # Clear winner — this face is talking
                            target_x = top["x"]
                        else:
                            # Motion inconclusive — "stay put" on current speaker
                            # Find the face closest to where camera already is
                            closest = min(faces, key=lambda f: abs(f["x"] - actual_x))
                            target_x = closest["x"]
                
                # ── APPLY CAMERA MOVEMENT ──
                if target_x is not None:
                    dist = abs(target_x - actual_x)
                    in_cooldown = (t_sec - last_hard_cut_time) < HARD_CUT_COOLDOWN
                    
                    if dist >= MIN_SWITCH_DIST:
                        if not in_cooldown:
                            # Large jump → hard cut (speaker switch or camera cut in source)
                            actual_x = target_x
                            last_hard_cut_time = t_sec
                        # else: in cooldown → hold perfectly still (don't drift via EMA)
                    elif dist > DEADZONE:
                        # Small drift → smooth EMA (same speaker moving slightly)
                        move_amt = target_x - actual_x
                        if move_amt > 0:
                            move_amt -= DEADZONE
                        else:
                            move_amt += DEADZONE
                        actual_x = actual_x + move_amt * 0.1
                    # else: within deadzone → don't move at all (rock solid)
                
                # Decimate: only append to crop_map if moved by >= 1 pixel
                if not crop_map or abs(actual_x - crop_map[-1]["x"]) >= 1.0:
                    crop_map.append({
                        "time": round(t_sec, 3),
                        "x": int(actual_x)
                    })
                
                prev_gray = gray.copy()
            
            frame_idx += 1
        
        cap.release()

        if not crop_map:
            print("[face-track] No faces detected. Defaulting to center.")
            return width // 2

        # Add final keyframe
        last_t = (frame_idx - 1) / fps
        if crop_map[-1]["time"] < last_t:
            crop_map.append({
                "time": round(last_t, 3),
                "x": int(actual_x)
            })

        unique_x = set(e["x"] for e in crop_map)
        print(f"[face-track] Generated crop map: {len(crop_map)} points, {len(unique_x)} unique positions")
        
        return crop_map
