import os
import json
import shutil
import re
from typing import Optional, Dict, Any

class ClipWorkflowCoordinator:
    def __init__(self, job_store, asset_repository, youtube_client, speech_transcriber, prompt_repository, config_store):
        self.jobs = job_store
        self.asset_repository = asset_repository
        self.youtube_client = youtube_client
        self.speech_transcriber = speech_transcriber
        self.prompt_repository = prompt_repository
        self.config_store = config_store

    def save_jobs(self):
        try:
            self.jobs.save()
        except:
            pass

    def run_full_analysis(self, job_id: str, url: str, language: str, force_reanalyze: bool = False, prompt_file: str = "prompt.json", num_hooks: int = 10, auto_hooks: bool = False):
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
                            video_duration = cached_video.get("duration", float("inf"))
                            MIN_DUR, MAX_DUR = 15, 180
                            filtered = []
                            for h in raw_hooks:
                                try:
                                    h_start = float(h.get("start", 0))
                                    h_end = float(h.get("end", 0))
                                    h_dur = h_end - h_start
                                    if h_start < video_duration and h_end <= (video_duration + 5) and h_start >= 0:
                                        if h_dur < MIN_DUR:
                                            h_end = h_start + MIN_DUR
                                        if (h_end - h_start) > MAX_DUR:
                                            h_end = h_start + MAX_DUR
                                        h["start"] = round(h_start, 2)
                                        h["end"] = round(h_end, 2)
                                        h["duration"] = round(h_end - h_start, 2)
                                        filtered.append(h)
                                except:
                                    pass
                            
                            job["hooks"] = filtered
                            job["status"] = "ready"
                            self.jobs[job_id] = job
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
                
            transcript_segments = self.youtube_client.fetch_transcript(video_id)
            if not transcript_segments or len(transcript_segments) == 0:
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "No transcript found. Yonru requires videos with available closed-captions to guarantee accurate frame synchronization."
                self.jobs[job_id] = job
                return

            # Step 1: Download full 1080p video (single network call)
            job = self.jobs[job_id]
            job["status"] = "downloading_video"
            self.jobs[job_id] = job
            video_info = self.asset_repository.get_or_create_source(url)
            
            if not video_info:
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "Failed to download video"
                self.jobs[job_id] = job
                return
            
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
                            prompt_file=prompt_file
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
                    
                    # Filter: drop hooks with bad timestamps or out-of-range duration
                    video_duration = video_info.get("duration", float("inf"))
                    MIN_DUR, MAX_DUR = 15, 180
                    filtered = []
                    for h in raw_hooks:
                        h_start = float(h.get("start", 0))
                        h_end = float(h.get("end", 0))
                        h_dur = h_end - h_start
                        
                        if h_dur < MIN_DUR:
                            h_end = h_start + MIN_DUR
                        if (h_end - h_start) > MAX_DUR:
                            h_end = h_start + MAX_DUR
                        
                        h["start"] = round(h_start, 2)
                        h["end"] = round(h_end, 2)
                        h["duration"] = round(h["end"] - h["start"], 2)
                        
                        if h["end"] > (video_duration + 5):
                            print(f"[filter] Drop hook {h['start']}→{h['end']}: beyond video ({video_duration:.1f}s)")
                            continue
                        if h["start"] < 0:
                            print(f"[filter] Drop hook {h['start']}→{h['end']}: negative start")
                            continue
                        filtered.append(h)
                    
                    print(f"[filter] {len(filtered)}/{len(raw_hooks)} hooks valid for video ({video_duration:.1f}s)")
                    
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
            self.jobs[job_id] = job
            
        except Exception as e:
            job = self.jobs[job_id]
            job["status"] = "error"
            job["error"] = str(e)
            self.jobs[job_id] = job

    def run_local_cut(self, job_id: str, start_time: float, end_time: float, theme: Optional[str] = None, whisper_model: str = "base"):
        """Background: cut segment from cached full video via local ffmpeg"""
        try:
            job = self.jobs[job_id]
            job["status"] = "cutting"
            self.jobs[job_id] = job
            
            full_path = job.get("full_video_path")
            if not full_path or not os.path.exists(full_path):
                job = self.jobs[job_id]
                job["status"] = "error"
                job["error"] = "Full video not found. Re-analyze first."
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
            if os.path.exists(transcript_path):
                print(f"[transcribe] Reuse existing transcript at {transcript_path}")
                
                # Check for default style settings
                clip_style_path = os.path.join(os.path.dirname(clip["file_path"]), "style_settings.json")
                default_style_path = os.path.join("temp_assets", "default_style_settings.json")
                if not os.path.exists(clip_style_path) and os.path.exists(default_style_path):
                    import shutil
                    shutil.copy(default_style_path, clip_style_path)
                    print(f"[transcribe] Populated default style settings to {clip_style_path}")

                # Check for default thumbnail config
                clip_thumb_config_path = os.path.join(os.path.dirname(clip["file_path"]), "thumbnail_config.json")
                default_thumb_style_path = os.path.join("temp_assets", "default_thumbnail_style.json")
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
                        with open(clip_thumb_config_path, "w", encoding="utf-8") as f:
                            json.dump(initial_config, f, ensure_ascii=False, indent=2)
                        print(f"[transcribe] Populated default thumbnail config to {clip_thumb_config_path}")
                    except Exception as e:
                        print(f"[transcribe] Failed to populate default thumbnail config: {e}")

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
            
            try:
                # Extract audio from clip
                clip_audio = self.asset_repository.extract_audio_from_local(clip["file_path"])
                print(f"[transcribe] Transcribing clip audio...")
                precise_words = self.speech_transcriber.transcribe(clip_audio, model_size=whisper_model)
                
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
            except Exception as e:
                print(f"[transcribe] Whisper failed for clip, falling back to global: {e}")

            # Check for default style settings
            clip_style_path = os.path.join(os.path.dirname(clip["file_path"]), "style_settings.json")
            default_style_path = os.path.join("temp_assets", "default_style_settings.json")
            if not os.path.exists(clip_style_path) and os.path.exists(default_style_path):
                import shutil
                shutil.copy(default_style_path, clip_style_path)
                print(f"[transcribe] Populated default style settings to {clip_style_path}")

            # Check for default thumbnail config
            clip_thumb_config_path = os.path.join(os.path.dirname(clip["file_path"]), "thumbnail_config.json")
            default_thumb_style_path = os.path.join("temp_assets", "default_thumbnail_style.json")
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
                    with open(clip_thumb_config_path, "w", encoding="utf-8") as f:
                        json.dump(initial_config, f, ensure_ascii=False, indent=2)
                    print(f"[transcribe] Populated default thumbnail config to {clip_thumb_config_path}")
                except Exception as e:
                    print(f"[transcribe] Failed to populate default thumbnail config: {e}")

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
