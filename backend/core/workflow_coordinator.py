import os
import json
import shutil
import re
import uuid
from typing import Optional, Dict, Any, List
from core.clip_session_store import ClipSessionStore, CANONICAL_DEFAULT_STYLE_SETTINGS, CANONICAL_DEFAULT_COVER_CONFIG

class ClipWorkflowCoordinator:
    def __init__(
        self,
        job_store,
        asset_repository,
        youtube_client,
        speech_transcriber,
        prompt_repository,
        config_store,
        face_tracker=None,
        clip_session_store=None,
        hook_discovery_engine=None,
    ):
        self.jobs = job_store
        self.asset_repository = asset_repository
        self.youtube_client = youtube_client
        self.speech_transcriber = speech_transcriber
        self.prompt_repository = prompt_repository
        self.config_store = config_store
        self.face_tracker = face_tracker

        if hook_discovery_engine is not None:
            self.hook_discovery_engine = hook_discovery_engine
        else:
            from core.hook_discovery_engine import HookDiscoveryEngine
            transcoder = getattr(self.asset_repository, "transcoder", None)
            self.hook_discovery_engine = HookDiscoveryEngine(
                config_store=self.config_store,
                prompt_repository=self.prompt_repository,
                media_transcoder=transcoder,
            )

        if clip_session_store is not None:
            self._clip_session_store = clip_session_store
        else:
            raw_out = getattr(self.asset_repository, "output_dir", None)
            output_dir = raw_out if isinstance(raw_out, str) and raw_out else "temp_assets"
            raw_clips = getattr(self.asset_repository, "clips_dir", None)
            clips_dir = raw_clips if isinstance(raw_clips, str) and raw_clips else os.path.join(output_dir, "clips")
            self._clip_session_store = ClipSessionStore(
                clips_dir=clips_dir,
                output_dir=output_dir,
                config_store=self.config_store,
                face_tracker=self.face_tracker,
                media_transcoder=getattr(self.asset_repository, "transcoder", None),
            )

    @property
    def clip_session_store(self) -> ClipSessionStore:
        return self._clip_session_store

    @clip_session_store.setter
    def clip_session_store(self, value: Any) -> None:
        self._clip_session_store = value

    @staticmethod
    def _job_video_info(job: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(job, dict):
            return {}
        raw = job.get("video_info")
        return raw if isinstance(raw, dict) else {}

    def get_or_create_crop_map(
        self, folder_name: str, clip_id: str, tracker: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Generates, caches, and returns Auto-Reframe crop_map.json for a clip.
        Validates path traversal on folder_name and clip_id.
        """
        clip_dir = self.clip_session_store.resolve_clip_dir(folder_name, clip_id)

        video_path = os.path.join(clip_dir, "video.mp4")
        if not os.path.exists(video_path):
            raise FileNotFoundError("Clip video not found")

        active_tracker = tracker or getattr(self, "face_tracker", None)
        points = self.clip_session_store.ensure_crop_map(
            folder_name,
            clip_id,
            video_path=video_path,
            tracker=active_tracker,
        )
        return {"status": "ready", "crop_map": points}

    def get_job_summary(self, job_id: str) -> Dict[str, Any]:
        """
        Retrieves and fully hydrates job status, video metadata, cut clip details, transcript, and persisted history.
        """
        job = self.jobs.get_job(job_id)
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
                clip_id = os.path.basename(clip_dir)
                folder_name = os.path.basename(os.path.dirname(clip_dir))
                try:
                    session = self.clip_session_store.get_clip_session(
                        folder_name, clip_id, ensure_crop_map=False
                    )
                    if session.get("transcript"):
                        clip_data["transcript"] = session["transcript"]
                    if session.get("history"):
                        response["history"] = session["history"]
                except Exception:
                    pass

            response["clip"] = clip_data

        if job.get("hooks"):
            response["hooks"] = job["hooks"]

        return response

    def extract_clip_cover(self, job_id: str, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Extracts a single frame from the clip video as a custom Cover Slide frame (cover.jpg)
        with timestamp bounds clamping, strictly leaving the Clip Thumbnail (thumbnail.jpg) intact.
        """
        job = self.jobs.get_job(job_id)
        if not job:
            raise KeyError(f"Job {job_id} not found")

        clip_path = job.get("clip_path")
        if not clip_path or not os.path.exists(clip_path):
            raise ValueError("No clip available. Extract a clip first.")

        clip_dir = os.path.dirname(clip_path)
        clip_id = os.path.basename(clip_dir)
        folder_name = os.path.basename(os.path.dirname(clip_dir))

        return self.clip_session_store.extract_cover_frame(folder_name, clip_id, timestamp=timestamp)


    def extract_clip_thumbnail(self, job_id: str, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """Backward compatibility alias for extract_clip_cover."""
        return self.extract_clip_cover(job_id=job_id, timestamp=timestamp)


    def delete_source_video(self, folder_name: str) -> Dict[str, Any]:
        """Cancel active background jobs matching folder/video_id and purge source & clip assets."""
        if not folder_name:
            raise ValueError("Folder name must not be empty")

        cancelled = self.jobs.cancel_source_jobs(
            folder_name,
            reason="Source video deleted by user.",
            active_only=True,
        )
        if cancelled:
            print(f"[delete] Cancelled {cancelled} active background job(s) for deleted source {folder_name}")

        source_deleted = 1 if self.asset_repository.delete_cached_video(folder_name) else 0
        clips_deleted = self.clip_session_store.delete_source_clips(folder_name, job_store=self.jobs)
        total_deleted = source_deleted + (1 if clips_deleted > 0 else 0)

        return {"deleted": total_deleted, "folder": folder_name}

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
            filtered = self.hook_discovery_engine.load_cached_hooks(cached)
            if filtered is not None:
                try:
                    job_id = str(uuid.uuid4())[:8]
                    is_hd_ready = cached.get("hd_ready", False)
                    job_status = "ready" if is_hd_ready else "hooks_ready"
                    download_percent = 100.0 if is_hd_ready else 0.0

                    self.jobs.create_job(job_id, {
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
                    })

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
                    video_dict = {
                        "title": cached.get("title"),
                        "duration": cached.get("duration"),
                        "has_heatmap": len(_heatmap) > 0,
                        "heatmap_segments": len(_heatmap),
                        "asset_url": cached.get("asset_url"),
                        "folder_name": folder_name,
                        "fps": cached.get("fps", 30.0),
                        "hd_ready": is_hd_ready,
                        "has_preview": cached.get("has_preview", False)
                    }
                    return {
                        "job_id": job_id,
                        "status": job_status,
                        "hooks": filtered,
                        "folder_name": folder_name,
                        "video": video_dict,
                        "video_info": video_dict,
                        "cached": True
                    }
                except Exception as e:
                    print(f"[cache] Failed to load cached hooks for {video_id}: {e}")

        job_id = str(uuid.uuid4())[:8]
        self.jobs.create_job(job_id, {
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
        })

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
        job = self.jobs.get_job(job_id)
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
                self.clip_session_store.ensure_clip_defaults(folder_name, clip_id)
                self.clip_session_store.ensure_crop_map(
                    folder_name,
                    clip_id,
                    video_path=video_file,
                    tracker=getattr(self, "face_tracker", None),
                )

                self.jobs.update_job(
                    job_id,
                    status="ready",
                    clip_path=video_file,
                    clip_duration=end_time - start_time,
                    clip_start=start_time,
                    fps=cached_info.get("fps", 30.0),
                    clip={
                        "asset_url": f"/assets/clips/{folder_name}/{clip_id}/video.mp4",
                        "thumbnail_url": f"/assets/clips/{folder_name}/{clip_id}/thumbnail.jpg",
                        "duration": end_time - start_time,
                        "start": start_time,
                        "end": end_time,
                        "theme": theme
                    },
                )
                return {"job_id": job_id, "status": "ready"}

        # Clear previous clip state to prevent UI race conditions atomically
        resolved_clip_id = None
        if cached_info and cached_info.get("file_path"):
            folder_name = os.path.basename(os.path.dirname(cached_info["file_path"]))
            safe_theme = re.sub(r'[^\w\s-]', '', theme).strip().replace(' ', '_')[:50] if theme else ""
            resolved_clip_id = f"{int(start_time)}_{int(end_time)}_{safe_theme}" if safe_theme else f"{int(start_time)}_{int(end_time)}"

        self.jobs.update_job(
            job_id,
            clip=None,
            clip_path=None,
            clip_duration=None,
            clip_start=None,
            clip_end=None,
            clip_theme=None,
            clip_id=resolved_clip_id,
            status="cutting",
        )

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
        clip_dir = self.clip_session_store.resolve_clip_dir(folder_name, clip_id)
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
        transcoder = (
            getattr(self.clip_session_store, "transcoder", None)
            or getattr(self.asset_repository, "transcoder", None)
        )
        if transcoder and hasattr(transcoder, "probe_video"):
            try:
                dur = transcoder.probe_video(clip_path).duration
                if dur and dur > 0:
                    duration = dur
            except Exception:
                pass
        elif transcoder and hasattr(transcoder, "get_video_duration"):
            try:
                dur = transcoder.get_video_duration(clip_path)
                if dur and dur > 0:
                    duration = dur
            except Exception:
                pass


        # Load generated hooks from sources folder if present
        ready_hooks = []
        sources_dir = getattr(self.asset_repository, "source_dir", os.path.join("temp_assets", "sources"))
        source_video_path = os.path.join(sources_dir, folder_name, "video.mp4")
        cached_hooks = self.hook_discovery_engine.load_cached_hooks({
            "file_path": source_video_path,
            "folder_name": folder_name,
            "duration": duration,
        })
        if cached_hooks:
            ready_hooks = cached_hooks
        elif os.path.exists(os.path.join(sources_dir, folder_name, "hooks.json")):
            try:
                with open(os.path.join(sources_dir, folder_name, "hooks.json"), "r", encoding="utf-8") as f:
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

        # Load unified Clip Session once (heals defaults, migrates legacy cover/audio, computes crop_map)
        session = self.clip_session_store.get_clip_session(folder_name, clip_id)
        saved_hooks = self.asset_repository.get_saved_hooks(folder_name)

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
                "asset_url": session.get("asset_url") or f"/assets/clips/{folder_name}/{clip_id}/video.mp4",
                "thumbnail_url": session.get("thumbnail_url") or f"/assets/clips/{folder_name}/{clip_id}/thumbnail.jpg",
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

        created_job = self.jobs.create_job(job_id, job_data)

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

        return {
            "job_id": job_id,
            "status": status,
            "job": created_job,
            "saved_hooks": saved_hooks,
            "session": session,
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
                    filtered = self.hook_discovery_engine.load_cached_hooks(cached_video)
                    if filtered is not None:
                        print(f"[cache] Video and hooks found locally for {url}. Skipping YouTube network calls.")
                        updates: Dict[str, Any] = {
                            "video_info": cached_video,
                            "full_video_path": cached_video["file_path"],
                            "fps": cached_video.get("fps", 30.0),
                            "hooks": filtered,
                        }
                        if cached_video.get("hd_ready"):
                            updates["status"] = "ready"
                            updates["download_percent"] = 100.0
                            self.jobs.update_job(job_id, **updates)
                        else:
                            updates["status"] = "hooks_ready"
                            updates["download_percent"] = 0.0
                            self.jobs.update_job(job_id, **updates)
                            # Trigger background HD prefetch
                            import threading
                            t = threading.Thread(target=self.run_source_download, args=(job_id, url))
                            t.daemon = True
                            t.start()
                            
                        print(f"[cache] successfully load from cache")
                        return

            # Step 0: Check Transcript FIRST
            self.jobs.update_job(job_id, status="checking_transcript")
            video_id = self.youtube_client.extract_video_id(url)
            if not video_id:
                info = self.youtube_client.get_video_info_fast(url)
                video_id = info.get("id")
                
            if not video_id:
                self.jobs.update_job(job_id, status="error", error="Could not extract video ID from URL.")
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
                self.jobs.update_job(
                    job_id,
                    status="error",
                    error="No transcript found. Yonru requires videos with available closed-captions to guarantee accurate frame synchronization.",
                )
                return

            # Step 1: Download fast 360p video for analysis and previews
            self.jobs.update_job(job_id, status="downloading_video")
            video_info = self.asset_repository.get_or_create_source(url, quality="360p")
            
            if not video_info:
                self.jobs.update_job(job_id, status="error", error="Failed to download preview video")
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
            
            self.jobs.update_job(
                job_id,
                video_info=video_info,
                full_video_path=video_info["file_path"],
                status="generating_hooks",
            )

            from core.hook_discovery_engine import HookDiscoveryOptions
            options = HookDiscoveryOptions(
                num_hooks=num_hooks or 10,
                auto_hooks=auto_hooks or False,
                preset_id=preset_id,
                extraction_mode=extraction_mode,
                prompt_file=prompt_file,
                focus_topic=focus_topic,
                min_duration=min_duration or 15,
                max_duration=max_duration or 180,
            )

            filtered = self.hook_discovery_engine.get_or_discover_hooks(
                video_info=video_info,
                transcript_segments=transcript_segments,
                options=options,
                force_reanalyze=force_reanalyze,
            )

            if not filtered and transcript_segments and len(transcript_segments) > 0 and (force_reanalyze or not self.hook_discovery_engine.load_cached_hooks(video_info)):
                api_key = self.config_store.get("GEMINI_API_KEY") if self.config_store else None
                if api_key:
                    self.jobs.update_job(
                        job_id,
                        status="error",
                        error="Gemini failed to generate hooks from the transcript.",
                    )
                    return

            self.jobs.update_job(
                job_id,
                hooks=filtered or [],
                status="hooks_ready",
                download_percent=0.0,
            )
            
            # Start background prefetch of the high-res 1080p source video
            import threading
            t = threading.Thread(target=self.run_source_download, args=(job_id, url))
            t.daemon = True
            t.start()
            
        except Exception as e:
            self.jobs.update_job(job_id, status="error", error=str(e))

    def run_source_download(self, job_id: str, url: str):
        """Silently download 1080p source video in background with progress reporting"""
        try:
            print(f"[prefetch] Starting background 1080p prefetch for job {job_id} ({url})")
            
            def progress_callback(percent: float):
                self.jobs.set_download_progress(job_id, percent)
            
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
                updates: Dict[str, Any] = {
                    "video_info": video_info,
                    "full_video_path": video_info["file_path"],
                    "download_percent": 100.0,
                }
                if job.get("status") not in ["cutting", "transcribing", "error", "cancelled"]:
                    updates["status"] = "ready"
                self.jobs.update_job(job_id, **updates)
                print(f"[prefetch] 1080p prefetch complete for job {job_id}")
                
        except Exception as e:
            print(f"[prefetch] Background prefetch failed for job {job_id}: {e}")

    def run_local_cut(self, job_id: str, start_time: float, end_time: float, theme: Optional[str] = None, whisper_model: str = "base"):
        """Background: cut segment from cached full video via local ffmpeg"""
        try:
            job = self.jobs.update_job(job_id, status="cutting")
            full_path = job.get("full_video_path")
            
            # If full_path is missing or only contains preview, synchronously fetch the high-res source video
            if not full_path or not os.path.exists(full_path) or "preview.mp4" in full_path:
                print(f"[cut] High-res video source not found locally. Triggering synchronous 1080p download...")
                video_info_dict = self._job_video_info(job)
                url = video_info_dict.get("youtube_url") or f"https://youtube.com/watch?v={video_info_dict.get('video_id')}"
                
                video_info = self.asset_repository.get_or_create_source(
                    url=url,
                    force_download=True,
                    quality="1080p"
                )
                full_path = video_info["file_path"]
                
                self.jobs.update_job(
                    job_id,
                    video_info=video_info,
                    full_video_path=full_path,
                )
                
            if not full_path or not os.path.exists(full_path):
                self.jobs.update_job(
                    job_id,
                    status="error",
                    error="High-res video source not found and could not be fetched.",
                )
                return
            
            clip = self.clip_session_store.create_clip(full_path, start_time, end_time, theme=theme)
            
            if not clip:
                self.jobs.update_job(job_id, status="error", error="Failed to cut segment")
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
                clip_id = os.path.basename(clip_dir)
                folder_name = os.path.basename(os.path.dirname(clip_dir))
                self.clip_session_store.ensure_clip_defaults(folder_name, clip_id)
                self.clip_session_store.ensure_crop_map(
                    folder_name,
                    clip_id,
                    video_path=clip["file_path"],
                    tracker=getattr(self, "face_tracker", None),
                )

                job = self.jobs.get_job(job_id)
                video_info_dict = self._job_video_info(job)
                self.jobs.update_job(
                    job_id,
                    clip=clip,
                    clip_path=clip["file_path"],
                    clip_duration=clip["duration"],
                    clip_start=start_time,
                    fps=video_info_dict.get("fps", 30.0),
                    status="ready",
                )
                return

            self.jobs.update_job(job_id, status="transcribing")
            
            precise_words = None
            try:
                # Extract audio from clip
                clip_audio = self.clip_session_store.extract_clip_audio(clip["file_path"])
                print(f"[transcribe] Transcribing clip audio...")
                precise_words = self.speech_transcriber.transcribe(clip_audio, model_size=whisper_model)
            except Exception as e:
                print(f"[transcribe] Whisper failed for clip, falling back to global: {e}")
                
            if not precise_words:
                source_dir = os.path.dirname(full_path) if full_path else ""
                global_transcript_path = os.path.join(source_dir, "youtube-transcript.json")
                if os.path.exists(global_transcript_path):
                    try:
                        with open(global_transcript_path, "r", encoding="utf-8") as f:
                            global_segments = json.load(f)
                        if isinstance(global_segments, list):
                            fallback_words = []
                            for seg in global_segments:
                                s_start = float(seg.get("start", 0.0))
                                s_dur = float(seg.get("duration", 0.0))
                                s_end = s_start + s_dur
                                if s_end > start_time and s_start < end_time:
                                    rel_start = max(0.0, round(s_start - start_time, 3))
                                    fallback_words.append({
                                        "start": rel_start,
                                        "duration": round(s_dur, 3),
                                        "text": str(seg.get("text", "")).strip()
                                    })
                            if fallback_words:
                                print(f"[transcribe] Recovered {len(fallback_words)} segments from global transcript fallback")
                                precise_words = fallback_words
                    except Exception as ge:
                        print(f"[transcribe] Failed to parse global transcript fallback: {ge}")

            clip_dir = os.path.dirname(clip["file_path"])
            clip_id = os.path.basename(clip_dir)
            folder_name = os.path.basename(os.path.dirname(clip_dir))

            if precise_words:
                # Save precise transcript atomically via ClipSessionStore
                self.clip_session_store.save_clip_session(
                    folder_name, clip_id, {"transcript": precise_words}
                )
                print(f"[transcribe] Saved high-precision clip transcript ({len(precise_words)} words)")
                
                c_quote = " ".join([s.get("text", "") for s in precise_words]).strip()
                if len(c_quote) > 1000: c_quote = c_quote[:997] + "..."
                clip["transcript_quote"] = c_quote
                
                # Update in-memory job object so polling picks it up immediately
                job = self.jobs.get_job(job_id)
                if job and isinstance(job.get("clip"), dict):
                    updated_clip = dict(job["clip"])
                    updated_clip["transcript_quote"] = c_quote
                    self.jobs.update_job(job_id, clip=updated_clip)
                    print(f"[transcribe] Updated in-memory clip quote for job {job_id}")
            else:
                # Fallback: ensure defaults seeds empty transcript if missing
                self.clip_session_store.ensure_clip_defaults(folder_name, clip_id)

            self.clip_session_store.ensure_clip_defaults(folder_name, clip_id)
            self.clip_session_store.ensure_crop_map(
                folder_name,
                clip_id,
                video_path=clip["file_path"],
                tracker=getattr(self, "face_tracker", None),
            )

            # Store full clip metadata
            job = self.jobs.get_job(job_id)
            video_info_dict = self._job_video_info(job)
            self.jobs.update_job(
                job_id,
                clip=clip,
                clip_path=clip["file_path"],
                clip_duration=clip["duration"],
                clip_start=start_time,
                fps=video_info_dict.get("fps", 30.0),
                status="ready",
            )
            
        except Exception as e:
            self.jobs.update_job(job_id, status="error", error=str(e))
