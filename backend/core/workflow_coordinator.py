import os
import json
import shutil
import re
import uuid
from typing import Optional, Dict, Any, List

class ClipWorkflowCoordinator:
    def __init__(self, job_store, asset_repository, youtube_client, speech_transcriber, prompt_repository, config_store, face_tracker=None):
        self.jobs = job_store
        self.asset_repository = asset_repository
        self.youtube_client = youtube_client
        self.speech_transcriber = speech_transcriber
        self.prompt_repository = prompt_repository
        self.config_store = config_store
        self.face_tracker = face_tracker

    def save_jobs(self):
        try:
            self.jobs.save()
        except:
            pass

    def _ensure_defaults(self, clip_dir: str):
        """Ensures default style settings and thumbnail config are seeded in clip directory."""
        output_dir = getattr(self.asset_repository, "output_dir", None)
        if not isinstance(output_dir, str) or not output_dir:
            output_dir = "temp_assets"

        # 1. Check for default style settings
        clip_style_path = os.path.join(clip_dir, "style_settings.json")
        default_style_path = os.path.join(output_dir, "default_style_settings.json")
        if not os.path.exists(clip_style_path) and os.path.exists(default_style_path):
            try:
                shutil.copy(default_style_path, clip_style_path)
                print(f"[defaults] Populated default style settings to {clip_style_path}")
            except Exception as e:
                print(f"[defaults] Failed to copy default style settings: {e}")

        # 2. Check for default thumbnail config
        clip_thumb_config_path = os.path.join(clip_dir, "thumbnail_config.json")
        default_thumb_style_path = os.path.join(output_dir, "default_thumbnail_style.json")
        if not os.path.exists(clip_thumb_config_path) and os.path.exists(default_thumb_style_path):
            try:
                with open(default_thumb_style_path, "r", encoding="utf-8") as f:
                    default_style = json.load(f)
                duration = default_style.get("thumbnailDuration", 1.0)
                initial_config = {
                    "enabled": False,
                    "duration": duration,
                    "screenshotTime": 0,
                    "textOverlays": [],
                    "xOffset": 50
                }
                os.makedirs(clip_dir, exist_ok=True)
                with open(clip_thumb_config_path, "w", encoding="utf-8") as f:
                    json.dump(initial_config, f, ensure_ascii=False, indent=2)
                print(f"[defaults] Populated default thumbnail config to {clip_thumb_config_path}")
            except Exception as e:
                print(f"[defaults] Failed to populate default thumbnail config: {e}")

    def _compute_and_cache_crop_map(
        self, clip_dir: str, video_path: str, tracker: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """Internal helper to load or compute Auto-Reframe crop map keyframes for a clip directory."""
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        if os.path.exists(crop_map_path):
            try:
                with open(crop_map_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
            except Exception:
                pass

        if tracker is None:
            tracker = getattr(self, "face_tracker", None)
        if not tracker:
            from core.face_tracker import FaceTracker
            tracker = FaceTracker()

        crop_map_points = None
        try:
            crop_data = tracker.analyze_video(video_path)
            if isinstance(crop_data, (int, float)):
                crop_map_points = [{"time": 0.0, "x": int(crop_data)}]
            elif isinstance(crop_data, list) and len(crop_data) > 0:
                crop_map_points = crop_data
            else:
                crop_map_points = [{"time": 0.0, "x": 960}]
        except Exception as e:
            print(f"[workflow] Face tracking failed for {video_path}, falling back to center: {e}")
            crop_map_points = [{"time": 0.0, "x": 960}]

        try:
            with open(crop_map_path, "w", encoding="utf-8") as f:
                json.dump(crop_map_points, f, ensure_ascii=False, indent=2)
            print(f"[workflow] Saved auto-reframe crop map ({len(crop_map_points)} points) to {crop_map_path}")
        except Exception as e:
            print(f"[workflow] Failed to write crop_map.json: {e}")

        return crop_map_points

    def _ensure_crop_map(self, clip_path: str):
        """Generates and caches Auto-Reframe crop_map.json for the clip if not already present."""
        clip_dir = os.path.dirname(clip_path)
        self._compute_and_cache_crop_map(clip_dir, clip_path)

    def get_or_create_crop_map(
        self, folder_name: str, clip_id: str, tracker: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Generates, caches, and returns Auto-Reframe crop_map.json for a clip.
        Validates path traversal on folder_name and clip_id.
        """
        clips_dir = getattr(self.asset_repository, "clips_dir", os.path.join("temp_assets", "clips"))
        clip_dir = os.path.abspath(os.path.join(clips_dir, folder_name, clip_id))
        base_dir = os.path.abspath(clips_dir)
        if os.path.commonpath([base_dir, clip_dir]) != base_dir:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        video_path = os.path.join(clip_dir, "video.mp4")
        if not os.path.exists(video_path):
            raise FileNotFoundError("Clip video not found")

        points = self._compute_and_cache_crop_map(clip_dir, video_path, tracker=tracker)
        return {"status": "ready", "crop_map": points}

    def get_job_summary(self, job_id: str) -> Dict[str, Any]:
        """
        Retrieves and fully hydrates job status, video metadata, cut clip details, transcript, and persisted history.
        """
        job = self.jobs.get_job(job_id) if hasattr(self.jobs, "get_job") else self.jobs.get(job_id)
        if not job:
            raise KeyError(f"Job {job_id} not found")

        response = {
            "job_id": job_id,
            "status": job.get("status", "unknown"),
            "error": job.get("error"),
            "download_percent": job.get("download_percent", 0.0),
        }

        if job.get("video_info"):
            _heatmap = job["video_info"].get("heatmap") or []
            folder_name = (
                os.path.basename(os.path.dirname(job["video_info"].get("file_path", "")))
                if job["video_info"].get("file_path")
                else None
            )
            response["video"] = {
                "title": job["video_info"].get("title"),
                "duration": job["video_info"].get("duration"),
                "has_heatmap": len(_heatmap) > 0,
                "heatmap_segments": len(_heatmap),
                "asset_url": job["video_info"].get("asset_url"),
                "folder_name": folder_name,
                "hd_ready": job["video_info"].get("hd_ready", False),
                "has_preview": job["video_info"].get("has_preview", False),
            }
            response["folder_name"] = folder_name
        elif job.get("clip_path"):
            folder_name = os.path.basename(os.path.dirname(os.path.dirname(job["clip_path"])))
            response["folder_name"] = folder_name

        if job.get("clip"):
            clip_data = {
                "asset_url": job["clip"].get("asset_url"),
                "duration": job["clip"].get("duration"),
                "start": job["clip"].get("start"),
                "end": job["clip"].get("end"),
                "theme": job["clip"].get("theme"),
                "transcript_quote": job["clip"].get("transcript_quote", ""),
            }

            clip_path = job.get("clip_path")
            if clip_path:
                clip_dir = os.path.dirname(clip_path)
                transcript_path = os.path.join(clip_dir, "transcript.json")
                if os.path.exists(transcript_path):
                    try:
                        with open(transcript_path, "r", encoding="utf-8") as f:
                            clip_data["transcript"] = json.load(f)
                    except Exception:
                        pass

                history_path = os.path.join(clip_dir, "history.json")
                if os.path.exists(history_path):
                    try:
                        with open(history_path, "r", encoding="utf-8") as f:
                            response["history"] = json.load(f)
                    except Exception as e:
                        print(f"[workflow] Failed to read history for job {job_id}: {e}")

            response["clip"] = clip_data

        if job.get("hooks"):
            response["hooks"] = job["hooks"]

        return response

    def extract_clip_thumbnail(self, job_id: str, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Extracts a single frame from the clip video as a thumbnail with timestamp bounds clamping.
        """
        job = self.jobs.get_job(job_id) if hasattr(self.jobs, "get_job") else self.jobs.get(job_id)
        if not job:
            raise KeyError(f"Job {job_id} not found")

        clip_path = job.get("clip_path")
        if not clip_path or not os.path.exists(clip_path):
            raise ValueError("No clip available. Extract a clip first.")

        clip_dir = os.path.dirname(clip_path)
        clip_duration = float(job.get("clip_duration") or 10.0)

        if timestamp is not None:
            ts = max(0.0, min(float(timestamp), max(0.0, clip_duration - 0.1)))
        else:
            import random
            ts = random.uniform(0.5, max(0.6, clip_duration * 0.8))

        thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
        success = self.asset_repository.extract_clip_screenshot(clip_path, ts, thumb_path)
        if not success:
            raise RuntimeError("Failed to extract thumbnail frame")

        parts = clip_path.replace("\\", "/").split("/")
        try:
            clips_idx = parts.index("clips")
            relative = "/".join(parts[clips_idx:])
            asset_url = f"/assets/{relative.rsplit('/', 1)[0]}/thumbnail.jpg"
        except Exception:
            asset_url = "/assets/clips/thumbnail.jpg"

        print(f"[thumbnail] Captured frame at {ts:.3f}s → {thumb_path}")
        return {"status": "ok", "timestamp": round(ts, 3), "thumbnail_url": asset_url}

    def replay_cached_analysis(
        self,
        video_id: str,
        background_tasks: Any = None,
        force: bool = False,
        prompt_file: Optional[str] = "prompt.json",
        num_hooks: int = 10,
        auto_hooks: bool = False,
        extraction_mode: str = "preset",
        preset_id: str = "auto",
        focus_topic: Optional[str] = None,
        min_duration: int = 30,
        max_duration: int = 180,
    ) -> Dict[str, Any]:
        """
        Re-analyze or instantly replay a cached video using titled folder lookup.
        If cached hooks exist and force is False, returns instant ready/hooks_ready status and triggers HD prefetch if needed.
        Otherwise schedules full background analysis.
        """
        cached = self.asset_repository.get_cached_video(f"https://youtube.com/watch?v={video_id}")
        if not cached:
            raise FileNotFoundError(f"Cached video for ID {video_id} not found in titled folders")

        # If force is False, and hooks.json exists, load it immediately and return status ready/hooks_ready
        if not force and cached.get("file_path"):
            folder_name = os.path.basename(os.path.dirname(cached["file_path"]))
            hooks_cache_path = os.path.join(os.path.dirname(cached["file_path"]), "hooks.json")
            if os.path.exists(hooks_cache_path):
                try:
                    with open(hooks_cache_path, "r", encoding="utf-8") as f:
                        hooks_json = f.read()
                    raw_hooks = json.loads(hooks_json)
                    filtered = self.asset_repository.sanitize_and_prepare_hooks(raw_hooks, cached)
                    job_id = str(uuid.uuid4())[:8]
                    is_hd_ready = cached.get("hd_ready", False)
                    job_status = "ready" if is_hd_ready else "hooks_ready"
                    download_percent = 100.0 if is_hd_ready else 0.0

                    self.jobs[job_id] = {
                        "status": job_status,
                        "url": f"https://youtube.com/watch?v={video_id}",
                        "video_info": cached,
                        "full_video_path": cached["file_path"],
                        "audio_path": None,
                        "clip_path": None,
                        "clip_duration": None,
                        "hooks": filtered,
                        "fps": cached.get("fps", 30.0),
                        "download_percent": download_percent,
                        "error": None
                    }
                    self.save_jobs()

                    if not is_hd_ready:
                        if background_tasks is not None:
                            background_tasks.add_task(
                                self.run_source_download,
                                job_id,
                                f"https://youtube.com/watch?v={video_id}"
                            )
                        else:
                            import threading
                            t = threading.Thread(
                                target=self.run_source_download,
                                args=(job_id, f"https://youtube.com/watch?v={video_id}")
                            )
                            t.daemon = True
                            t.start()
                        print(f"[cache] Triggered background prefetch of HD source for {video_id}")
                    else:
                        print(f"[cache] Video and hooks loaded instantly from cache for {video_id}")

                    _heatmap = cached.get("heatmap") or []
                    return {
                        "job_id": job_id,
                        "status": job_status,
                        "hooks": filtered,
                        "folder_name": folder_name,
                        "video": {
                            "title": cached.get("title"),
                            "duration": cached.get("duration"),
                            "has_heatmap": len(_heatmap) > 0,
                            "heatmap_segments": len(_heatmap),
                            "asset_url": cached.get("asset_url"),
                            "folder_name": folder_name,
                            "fps": cached.get("fps", 30.0),
                            "hd_ready": is_hd_ready,
                            "has_preview": cached.get("has_preview", False)
                        },
                        "cached": True
                    }
                except Exception as e:
                    print(f"[cache] Failed to load cached hooks for {video_id}: {e}")

        job_id = str(uuid.uuid4())[:8]
        self.jobs[job_id] = {
            "status": "queued",
            "url": f"https://youtube.com/watch?v={video_id}",
            "video_info": cached,
            "full_video_path": cached["file_path"],
            "audio_path": None,
            "clip_path": None,
            "clip_duration": None,
            "hooks": None,
            "fps": cached.get("fps", 30.0),
            "error": None
        }

        if background_tasks is not None:
            background_tasks.add_task(
                self.run_full_analysis,
                job_id,
                f"https://youtube.com/watch?v={video_id}",
                "id",
                force,
                prompt_file or "prompt.json",
                num_hooks or 10,
                auto_hooks or False,
                extraction_mode or "preset",
                preset_id or "auto",
                focus_topic,
                min_duration or 30,
                max_duration or 180
            )
        else:
            import threading
            t = threading.Thread(
                target=self.run_full_analysis,
                args=(
                    job_id,
                    f"https://youtube.com/watch?v={video_id}",
                    "id",
                    force,
                    prompt_file or "prompt.json",
                    num_hooks or 10,
                    auto_hooks or False,
                    extraction_mode or "preset",
                    preset_id or "auto",
                    focus_topic,
                    min_duration or 30,
                    max_duration or 180
                )
            )
            t.daemon = True
            t.start()

        self.save_jobs()
        return {"job_id": job_id, "status": "queued", "cached": True}

    def provision_clip(
        self,
        job_id: str,
        start_time: float,
        end_time: float,
        theme: Optional[str] = None,
        whisper_model: str = "base",
        background_tasks: Any = None
    ) -> Dict[str, Any]:
        """
        Idempotent clip provisioning.
        If ready on disk: populates missing artifacts, updates JobStore, returns {"job_id": job_id, "status": "ready"}.
        If not ready: schedules background cut & transcribe, returns {"job_id": job_id, "status": "cutting"}.
        """
        job = self.jobs.get_job(job_id) if hasattr(self.jobs, "get_job") else self.jobs.get(job_id)
        if not job:
            raise KeyError(f"Job {job_id} not found")

        cached_info = job.get("video_info")
        if cached_info and cached_info.get("file_path"):
            folder_name = os.path.basename(os.path.dirname(cached_info["file_path"]))
            safe_theme = re.sub(r'[^\w\s-]', '', theme).strip().replace(' ', '_')[:50] if theme else ""
            clip_id = f"{int(start_time)}_{int(end_time)}_{safe_theme}" if safe_theme else f"{int(start_time)}_{int(end_time)}"
            
            clips_dir = getattr(self.asset_repository, "clips_dir", os.path.join("temp_assets", "clips"))
            target_dir = os.path.join(clips_dir, folder_name, clip_id)
            video_file = os.path.join(target_dir, "video.mp4")
            transcript_path = os.path.join(target_dir, "transcript.json")

            is_transcript_valid = False
            if os.path.exists(transcript_path):
                try:
                    with open(transcript_path, "r", encoding="utf-8") as f:
                        t_data = json.load(f)
                        if isinstance(t_data, list) and len(t_data) > 0:
                            is_transcript_valid = True
                except Exception:
                    pass

            if os.path.exists(video_file) and not is_transcript_valid:
                if os.path.exists(transcript_path):
                    try:
                        os.remove(transcript_path)
                    except Exception:
                        pass

            if os.path.exists(video_file) and is_transcript_valid:
                print(f"[provision] Clip {clip_id} already ready on disk. Ensuring defaults and crop map...")
                self._ensure_defaults(target_dir)
                self._ensure_crop_map(video_file)

                job["status"] = "ready"
                job["clip_path"] = video_file
                job["clip_duration"] = end_time - start_time
                job["clip_start"] = start_time
                job["fps"] = cached_info.get("fps", 30.0)
                job["clip"] = {
                    "asset_url": f"/assets/clips/{folder_name}/{clip_id}/video.mp4",
                    "duration": end_time - start_time,
                    "start": start_time,
                    "end": end_time,
                    "theme": theme
                }
                self.jobs[job_id] = job
                self.save_jobs()
                return {"job_id": job_id, "status": "ready"}

        # Clear previous clip state to prevent UI race conditions atomically
        job["clip"] = None
        job["clip_path"] = None
        job["clip_duration"] = None
        job["clip_start"] = None
        job["clip_end"] = None
        job["clip_theme"] = None
        
        resolved_clip_id = None
        if cached_info and cached_info.get("file_path"):
            folder_name = os.path.basename(os.path.dirname(cached_info["file_path"]))
            safe_theme = re.sub(r'[^\w\s-]', '', theme).strip().replace(' ', '_')[:50] if theme else ""
            resolved_clip_id = f"{int(start_time)}_{int(end_time)}_{safe_theme}" if safe_theme else f"{int(start_time)}_{int(end_time)}"
        
        job["clip_id"] = resolved_clip_id
        job["status"] = "cutting"
        self.jobs[job_id] = job
        self.save_jobs()

        if background_tasks is not None:
            background_tasks.add_task(self.run_local_cut, job_id, start_time, end_time, theme, whisper_model)
        else:
            import threading
            t = threading.Thread(target=self.run_local_cut, args=(job_id, start_time, end_time, theme, whisper_model))
            t.daemon = True
            t.start()

        return {"job_id": job_id, "status": "cutting"}

    def load_ready_clip(
        self,
        folder_name: str,
        clip_id: str,
        whisper_model: str = "base",
        background_tasks: Any = None
    ) -> Dict[str, Any]:
        """
        Loads and initializes a job state from an existing ready clip on disk.
        """
        clips_dir = getattr(self.asset_repository, "clips_dir", os.path.join("temp_assets", "clips"))
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        clip_path = os.path.join(clip_dir, "video.mp4")
        transcript_path = os.path.join(clip_dir, "transcript.json")

        if not os.path.exists(clip_path):
            raise FileNotFoundError("Ready clip assets not found")

        video_info = self.asset_repository.get_cached_video_by_folder(folder_name)
        if not video_info:
            raise FileNotFoundError("Source video folder not found")

        # Parse clip metadata from ID
        start_time = 0.0
        end_time = 0.0
        theme = ""
        parts = clip_id.split("_")
        if len(parts) >= 2:
            try:
                start_time = float(parts[0])
                end_time = float(parts[1])
                if len(parts) >= 3:
                    theme = " ".join(parts[2:]).replace("_", " ")
            except Exception:
                pass

        # Verify transcript validity
        is_transcript_valid = False
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8") as f:
                    t_data = json.load(f)
                    if isinstance(t_data, list) and len(t_data) > 0:
                        is_transcript_valid = True
            except Exception:
                pass

        if not is_transcript_valid and os.path.exists(transcript_path):
            try:
                os.remove(transcript_path)
            except Exception:
                pass

        # Deterministic job_id
        import hashlib
        hash_input = f"{folder_name}_{clip_id}"
        job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
        
        duration = end_time - start_time
        if hasattr(self.asset_repository, "get_video_duration"):
            try:
                dur = self.asset_repository.get_video_duration(clip_path)
                if dur and dur > 0:
                    duration = dur
            except Exception:
                pass

        # Load generated hooks from sources folder if present
        ready_hooks = []
        sources_dir = getattr(self.asset_repository, "source_dir", os.path.join("temp_assets", "sources"))
        source_hooks_path = os.path.join(sources_dir, folder_name, "hooks.json")
        if os.path.exists(source_hooks_path):
            try:
                with open(source_hooks_path, "r", encoding="utf-8") as f:
                    ready_hooks = json.load(f)
            except Exception as e:
                print(f"[load-ready-clip] Failed to read source hooks: {e}")

        # Extract transcript quote
        active_quote = "No transcript preview available."
        if is_transcript_valid:
            try:
                with open(transcript_path, "r", encoding="utf-8") as f:
                    t_data = json.load(f)
                    active_quote = " ".join([s.get("text", "") for s in t_data]).strip()
                    if len(active_quote) > 1000:
                        active_quote = active_quote[:997] + "..."
            except Exception as e:
                print(f"[load-ready-clip] Failed to read active transcript: {e}")

        ready_hooks.sort(key=lambda x: x.get("start", 0.0))

        # Snap start/end to closest matching hook
        snapped_start, snapped_end = start_time, end_time
        best_dist = float("inf")
        for h in ready_hooks:
            h_start = float(h.get("start", 0.0))
            h_end = float(h.get("end", 0.0))
            dist = abs(h_start - start_time) + abs(h_end - end_time)
            if dist < 5.0 and dist < best_dist:
                best_dist = dist
                snapped_start = h_start
                snapped_end = h_end

        # Ensure defaults and crop map
        self._ensure_defaults(clip_dir)
        self._ensure_crop_map(clip_path)

        status = "ready" if is_transcript_valid else "queued"
        job_data = {
            "job_id": job_id,
            "status": status,
            "url": f"https://youtube.com/watch?v={video_info.get('video_id', '')}",
            "video_info": video_info,
            "full_video_path": video_info.get("file_path"),
            "clip_path": clip_path,
            "clip_duration": duration,
            "clip": {
                "asset_url": f"/assets/clips/{folder_name}/{clip_id}/video.mp4",
                "duration": duration,
                "file_path": clip_path,
                "start": snapped_start,
                "end": snapped_end,
                "theme": theme,
                "transcript_quote": active_quote
            },
            "hooks": ready_hooks,
            "fps": video_info.get("fps", 30.0),
            "error": None
        }

        self.jobs[job_id] = job_data
        self.save_jobs()

        if not is_transcript_valid:
            if background_tasks is not None:
                background_tasks.add_task(
                    self.run_local_cut,
                    job_id,
                    start_time,
                    end_time,
                    theme,
                    whisper_model
                )
            else:
                import threading
                t = threading.Thread(target=self.run_local_cut, args=(job_id, start_time, end_time, theme, whisper_model))
                t.daemon = True
                t.start()

        # Load persisted history if present
        history_data = None
        history_path = os.path.join(clip_dir, "history.json")
        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    history_data = json.load(f)
            except Exception as e:
                print(f"[load-ready-clip] Failed to read history: {e}")

        # Load persisted style settings if present
        style_data = None
        style_path = os.path.join(clip_dir, "style_settings.json")
        if os.path.exists(style_path):
            try:
                with open(style_path, "r", encoding="utf-8") as f:
                    style_data = json.load(f)
            except Exception as e:
                print(f"[load-ready-clip] Failed to read style settings: {e}")

        # Load persisted crop map
        crop_map_data = None
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        if os.path.exists(crop_map_path):
            try:
                with open(crop_map_path, "r", encoding="utf-8") as f:
                    crop_map_data = json.load(f)
            except Exception as e:
                print(f"[load-ready-clip] Failed to read crop map: {e}")

        # Load thumbnail config
        thumbnail_config_data = None
        thumb_config_path = os.path.join(clip_dir, "thumbnail_config.json")
        if os.path.exists(thumb_config_path):
            try:
                with open(thumb_config_path, "r", encoding="utf-8") as f:
                    thumbnail_config_data = json.load(f)
            except Exception as e:
                print(f"[load-ready-clip] Failed to read thumbnail config: {e}")

        return {
            "job_id": job_id,
            "status": status,
            "job": job_data,
            "style_settings": style_data,
            "history": history_data,
            "crop_map": crop_map_data,
            "thumbnail_config": thumbnail_config_data
        }



    def run_full_analysis(
        self,
        job_id: str,
        url: str,
        language: str,
        force_reanalyze: bool = False,
        prompt_file: Optional[str] = "prompt.json",
        num_hooks: int = 10,
        auto_hooks: bool = False,
        extraction_mode: str = "preset",
        preset_id: str = "auto",
        focus_topic: Optional[str] = None,
        min_duration: int = 30,
        max_duration: int = 180
    ):
        """Background: check transcript → download full 1080p → Gemini hooks"""
        try:
            # Step -1: Check for cached video and hooks FIRST to avoid YouTube network calls
            if not force_reanalyze:
                cached_video = self.asset_repository.get_cached_video(url)
                if cached_video and cached_video.get("file_path"):
                    hooks_cache_path = os.path.join(os.path.dirname(cached_video["file_path"]), "hooks.json")
                    if os.path.exists(hooks_cache_path):
                        print(f"[cache] Video and hooks found locally for {url}. Skipping YouTube network calls.")
                        job = self.jobs[job_id]
                        job["video_info"] = cached_video
                        job["full_video_path"] = cached_video["file_path"]
                        job["fps"] = cached_video.get("fps", 30.0)
                        
                        with open(hooks_cache_path, "r", encoding="utf-8") as f:
                            hooks_json = f.read()
                        
                        try:
                            raw_hooks = json.loads(hooks_json)
                            filtered = self.asset_repository.sanitize_and_prepare_hooks(raw_hooks, cached_video)
                            
                            job["hooks"] = filtered
                            if cached_video.get("hd_ready"):
                                job["status"] = "ready"
                                job["download_percent"] = 100.0
                                self.jobs[job_id] = job
                            else:
                                job["status"] = "hooks_ready"
                                job["download_percent"] = 0.0
                                self.jobs[job_id] = job
                                # Trigger background HD prefetch
                                import threading
                                t = threading.Thread(target=self.run_source_download, args=(job_id, url))
                                t.daemon = True
                                t.start()
                                
                            print(f"[cache] successfully load from cache")
                            return
                        except Exception as e:
                            print(f"[cache] Failed to load cached hooks: {e}")

            # Step 0: Check Transcript FIRST
            job = self.jobs[job_id]
            job["status"] = "checking_transcript"
            self.jobs[job_id] = job
            video_id = self.youtube_client.extract_video_id(url)
            if not video_id:
                info = self.youtube_client.get_video_info_fast(url)
                video_id = info.get("id")
                
            if not video_id:
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "Could not extract video ID from URL."
                self.jobs[job_id] = job
                return
                
            # Try to load cached YouTube transcript first
            transcript_segments = None
            cached_video = self.asset_repository.get_cached_video(url)
            if cached_video and cached_video.get("file_path"):
                folder_path = os.path.dirname(cached_video["file_path"])
                transcript_cache_path = os.path.join(folder_path, "youtube-transcript.json")
                if os.path.exists(transcript_cache_path):
                    try:
                        with open(transcript_cache_path, "r", encoding="utf-8") as f:
                            transcript_segments = json.load(f)
                        print(f"[cache] Loaded YouTube transcript from {transcript_cache_path}")
                    except Exception as e:
                        print(f"[cache] Failed to read cached transcript: {e}")
                        transcript_segments = None

            if not transcript_segments:
                transcript_segments = self.youtube_client.fetch_transcript(video_id)
                
            if not transcript_segments or len(transcript_segments) == 0:
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "No transcript found. Yonru requires videos with available closed-captions to guarantee accurate frame synchronization."
                self.jobs[job_id] = job
                return

            # Step 1: Download fast 360p video for analysis and previews
            job = self.jobs[job_id]
            job["status"] = "downloading_video"
            self.jobs[job_id] = job
            video_info = self.asset_repository.get_or_create_source(url, quality="360p")
            
            if not video_info:
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "Failed to download preview video"
                self.jobs[job_id] = job
                return

            # Save transcript to cache if it doesn't already exist on disk
            video_folder = os.path.dirname(video_info["file_path"])
            transcript_cache_path = os.path.join(video_folder, "youtube-transcript.json")
            if not os.path.exists(transcript_cache_path) and transcript_segments:
                try:
                    with open(transcript_cache_path, "w", encoding="utf-8") as f:
                        json.dump(transcript_segments, f, ensure_ascii=False, indent=2)
                    print(f"[cache] Saved YouTube transcript to {transcript_cache_path}")
                except Exception as e:
                    print(f"[cache] Failed to cache YouTube transcript: {e}")
            
            job = self.jobs[job_id]
            job["video_info"] = video_info
            job["full_video_path"] = video_info["file_path"]
            job["status"] = "generating_hooks"
            self.jobs[job_id] = job
            hooks_cache_path = os.path.join(os.path.dirname(video_info["file_path"]), "hooks.json")
            hooks_json = None
            
            # Step 3: Check for cached hooks or use Transcript-First approach (fallback to Audio)
            if not force_reanalyze and os.path.exists(hooks_cache_path):
                print(f"[cache] Found existing hooks.json at {hooks_cache_path}")
                with open(hooks_cache_path, "r", encoding="utf-8") as f:
                    hooks_json = f.read()
            else:
                if force_reanalyze:
                    print(f"[cache] Force reanalyze requested, bypassing {hooks_cache_path}...")
                
                api_key = self.config_store.get("GEMINI_API_KEY")
                if api_key:
                    from core.hook_generator import HookGenerator
                    generator = HookGenerator(api_key=api_key, prompt_repository=self.prompt_repository)
                    
                    # Generate from transcript
                    if transcript_segments and len(transcript_segments) > 0:
                        print(f"[pipeline] Using Transcript-First approach ({len(transcript_segments)} segments)")
                        hooks_json = generator.find_hooks_from_transcript(
                            transcript_segments=transcript_segments,
                            num_hooks=num_hooks,
                            auto_hooks=auto_hooks,
                            video_duration=video_info.get("duration"),
                            prompt_file=prompt_file,
                            extraction_mode=extraction_mode,
                            preset_id=preset_id,
                            focus_topic=focus_topic,
                            min_duration=min_duration,
                            max_duration=max_duration
                        )
                    
                    if not hooks_json:
                        job = self.jobs[job_id]
                        job["status"] = "error"
                        job["error"] = "Gemini failed to generate hooks from the transcript."
                        self.jobs[job_id] = job
                        return
                    if hooks_json:
                        try:
                            # Validate before saving
                            json.loads(hooks_json)
                            with open(hooks_cache_path, "w", encoding="utf-8") as f:
                                f.write(hooks_json)
                            print(f"[cache] Saved hooks to {hooks_cache_path}")
                        except Exception as e:
                            print(f"[cache] Failed to cache hooks: {e}")
            
            job = self.jobs[job_id]
            if hooks_json:
                try:
                    raw_hooks = json.loads(hooks_json)
                    
                    filtered = self.asset_repository.sanitize_and_prepare_hooks(raw_hooks, video_info)
                    
                    print(f"[filter] {len(filtered)}/{len(raw_hooks)} hooks valid for video ({video_info.get('duration', 0.0):.1f}s)")
                    
                    # Write filtered hooks back to cache so it stays clean
                    if len(filtered) != len(raw_hooks) and os.path.exists(hooks_cache_path):
                        try:
                            with open(hooks_cache_path, "w", encoding="utf-8") as f:
                                json.dump(filtered, f, ensure_ascii=False, indent=2)
                            print(f"[filter] Overwrote cache with {len(filtered)} clean hooks")
                        except Exception as e:
                            print(f"[filter] Failed to overwrite cache: {e}")
                    
                    job["hooks"] = filtered
                except Exception as e:
                    print(f"[hooks] Parse error: {e}")
                    job["hooks"] = []
            else:
                job["hooks"] = []
                    
            job["status"] = "hooks_ready"
            job["download_percent"] = 0.0
            self.jobs[job_id] = job
            
            # Start background prefetch of the high-res 1080p source video
            import threading
            t = threading.Thread(target=self.run_source_download, args=(job_id, url))
            t.daemon = True
            t.start()
            
        except Exception as e:
            job = self.jobs[job_id]
            job["status"] = "error"
            job["error"] = str(e)
            self.jobs[job_id] = job

    def run_source_download(self, job_id: str, url: str):
        """Silently download 1080p source video in background with progress reporting"""
        try:
            print(f"[prefetch] Starting background 1080p prefetch for job {job_id} ({url})")
            
            def progress_callback(percent: float):
                self.jobs.update_job(job_id, download_percent=round(percent, 1))
            
            # Download 1080p stream
            video_info = self.asset_repository.get_or_create_source(
                url=url,
                force_download=True,
                quality="1080p",
                progress_callback=progress_callback
            )
            
            # Once complete, update job
            job = self.jobs.get_job(job_id)
            if job:
                job["video_info"] = video_info
                job["full_video_path"] = video_info["file_path"]
                job["download_percent"] = 100.0
                if job.get("status") not in ["cutting", "transcribing", "error"]:
                    job["status"] = "ready"
                self.jobs[job_id] = job
                print(f"[prefetch] 1080p prefetch complete for job {job_id}")
                
        except Exception as e:
            print(f"[prefetch] Background prefetch failed for job {job_id}: {e}")

    def run_local_cut(self, job_id: str, start_time: float, end_time: float, theme: Optional[str] = None, whisper_model: str = "base"):
        """Background: cut segment from cached full video via local ffmpeg"""
        try:
            job = self.jobs[job_id]
            job["status"] = "cutting"
            self.jobs[job_id] = job
            
            full_path = job.get("full_video_path")
            
            # If full_path is missing or only contains preview, synchronously fetch the high-res source video
            if not full_path or not os.path.exists(full_path) or "preview.mp4" in full_path:
                print(f"[cut] High-res video source not found locally. Triggering synchronous 1080p download...")
                url = job.get("video_info", {}).get("youtube_url") or f"https://youtube.com/watch?v={job.get('video_info', {}).get('video_id')}"
                
                video_info = self.asset_repository.get_or_create_source(
                    url=url,
                    force_download=True,
                    quality="1080p"
                )
                full_path = video_info["file_path"]
                
                job = self.jobs.get_job(job_id)
                job["video_info"] = video_info
                job["full_video_path"] = full_path
                self.jobs[job_id] = job
                
            if not full_path or not os.path.exists(full_path):
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "High-res video source not found and could not be fetched."
                self.jobs[job_id] = job
                return
            
            clip = self.asset_repository.create_clip(full_path, start_time, end_time, theme=theme)
            
            if not clip:
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "Failed to cut segment"
                self.jobs[job_id] = job
                return
            
            # Step 3: Use existing transcript if available (prevents overwriting manual edits)
            transcript_path = os.path.join(os.path.dirname(clip["file_path"]), "transcript.json")
            is_transcript_valid = False
            if os.path.exists(transcript_path):
                try:
                    with open(transcript_path, "r", encoding="utf-8") as f:
                        t_data = json.load(f)
                        if isinstance(t_data, list) and len(t_data) > 0:
                            is_transcript_valid = True
                except Exception:
                    pass

            if is_transcript_valid:
                print(f"[transcribe] Reuse existing transcript at {transcript_path}")
                
                clip_dir = os.path.dirname(clip["file_path"])
                self._ensure_defaults(clip_dir)
                self._ensure_crop_map(clip["file_path"])

                job = self.jobs[job_id]
                job["clip"] = clip 
                job["clip_path"] = clip["file_path"]
                job["clip_duration"] = clip["duration"]
                job["clip_start"] = start_time
                job["fps"] = job.get("video_info", {}).get("fps", 30.0)
                job["status"] = "ready"
                self.jobs[job_id] = job
                return

            job = self.jobs[job_id]
            job["status"] = "transcribing"
            self.jobs[job_id] = job
            
            precise_words = None
            try:
                # Extract audio from clip
                clip_audio = self.asset_repository.extract_audio_from_local(clip["file_path"])
                print(f"[transcribe] Transcribing clip audio...")
                precise_words = self.speech_transcriber.transcribe(clip_audio, model_size=whisper_model)
            except Exception as e:
                print(f"[transcribe] Whisper failed for clip, falling back to global: {e}")
                
            if precise_words:
                # Save precise transcript
                with open(transcript_path, "w", encoding="utf-8") as f:
                    json.dump(precise_words, f, ensure_ascii=False, indent=2)
                print(f"[transcribe] Saved high-precision clip transcript ({len(precise_words)} words)")
                
                c_quote = " ".join([s.get("text", "") for s in precise_words]).strip()
                if len(c_quote) > 1000: c_quote = c_quote[:997] + "..."
                clip["transcript_quote"] = c_quote
                
                # Update in-memory job object so polling picks it up immediately
                job = self.jobs[job_id]
                if "clip" in job and job["clip"]:
                    job["clip"]["transcript_quote"] = c_quote
                    self.jobs[job_id] = job
                    print(f"[transcribe] Updated in-memory clip quote for job {job_id}")
            else:
                # Fallback: save empty transcript.json if missing
                if not os.path.exists(transcript_path):
                    try:
                        with open(transcript_path, "w", encoding="utf-8") as f:
                            json.dump([], f, ensure_ascii=False, indent=2)
                        print(f"[transcribe] Saved fallback empty clip transcript")
                    except Exception as fe:
                        print(f"[transcribe] Failed to write fallback empty transcript: {fe}")

            clip_dir = os.path.dirname(clip["file_path"])
            self._ensure_defaults(clip_dir)
            self._ensure_crop_map(clip["file_path"])

            # Store full clip metadata
            job = self.jobs[job_id]
            job["clip"] = clip 
            job["clip_path"] = clip["file_path"]
            job["clip_duration"] = clip["duration"]
            job["clip_start"] = start_time
            job["fps"] = job.get("video_info", {}).get("fps", 30.0)
            job["status"] = "ready"
            self.jobs[job_id] = job
            
        except Exception as e:
            job = self.jobs[job_id]
            job["status"] = "error"
            job["error"] = str(e)
            self.jobs[job_id] = job
