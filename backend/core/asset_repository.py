import os
import re
import sys
import subprocess
import json
import uuid
import shutil
from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod
from core.youtube_client import YouTubeClient

class AssetStore(ABC):
    @abstractmethod
    def get_cached_video(self, url: str) -> Optional[dict]:
        pass

    @abstractmethod
    def get_cached_video_by_folder(self, folder_name: str) -> Optional[dict]:
        pass

    @abstractmethod
    def get_or_create_source(self, url: str, force_download: bool = False, quality: str = "1080p", progress_callback = None) -> Optional[dict]:
        pass

    @abstractmethod
    def extract_hook_thumbnail(self, video_path: str, timestamp: float, output_path: str) -> Optional[str]:
        pass

    @abstractmethod
    def extract_audio_from_local(self, video_path: str) -> str:
        pass

    @abstractmethod
    def create_clip(self, video_path: str, start_time: float, end_time: float, theme: Optional[str] = None) -> Optional[dict]:
        pass

    @abstractmethod
    def list_cached_videos(self, page: Optional[int] = None, limit: int = 6, search: Optional[str] = None, sort_by: str = "date", order: str = "desc") -> Any:
        pass

    @abstractmethod
    def list_all_clips(self) -> list:
        pass

    @abstractmethod
    def list_ready_clips(self, active_clip_ids: Optional[set] = None) -> list:
        pass

    @abstractmethod
    def delete_cached_video(self, folder_name: str) -> int:
        pass

    @abstractmethod
    def delete_clip(self, folder_name: str, clip_id: str) -> bool:
        pass

    @abstractmethod
    def delete_clip_with_job(self, folder_name: str, clip_id: str, job_store: Any = None) -> bool:
        pass

    @abstractmethod
    def delete_cached_video_with_jobs(self, folder_name: str, job_store: Any = None) -> int:
        pass

    @abstractmethod
    def get_saved_hooks(self, folder_name: str) -> list:
        pass

    @abstractmethod
    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        pass

    @abstractmethod
    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        pass


    def sanitize_and_prepare_hooks(self, raw_hooks: list, video_info: dict) -> list:
        """Filter, format, and ensure thumbnails exist for a list of hooks."""
        video_duration = video_info.get("duration", float("inf"))
        file_path = video_info.get("file_path")
        if not file_path:
            return []
            
        folder_name = video_info.get("folder_name") or os.path.basename(os.path.dirname(file_path))
        
        MIN_DUR, MAX_DUR = 15, 180
        filtered = []
        for h in raw_hooks:
            try:
                h_start = float(h.get("start", 0))
                h_end = float(h.get("end", 0))
                h_dur = h_end - h_start
                
                # Check for out of bounds timestamps
                if h_start < 0 or h_start >= video_duration or h_end > (video_duration + 5):
                    continue
                    
                if h_dur < MIN_DUR:
                    h_end = h_start + MIN_DUR
                if (h_end - h_start) > MAX_DUR:
                    h_end = h_start + MAX_DUR
                
                h["start"] = round(h_start, 2)
                h["end"] = round(h_end, 2)
                h["duration"] = round(h_end - h_start, 2)
                
                # Ensure static sharp thumbnail exists and is linked
                thumb_name = f"thumb_{int(h_start)}.jpg"
                thumb_local_path = os.path.join(os.path.dirname(file_path), thumb_name)
                self.extract_hook_thumbnail(
                    video_path=file_path,
                    timestamp=h_start,
                    output_path=thumb_local_path
                )
                h["thumbnail_url"] = f"/assets/sources/{folder_name}/{thumb_name}"
                filtered.append(h)
            except Exception as e:
                print(f"[asset-store] Failed to sanitize hook: {e}")
        return filtered

class AssetRepository(AssetStore):
    def __init__(self, output_dir="temp_assets", youtube_client=None, config_store=None):
        self.output_dir = output_dir
        self.source_dir = os.path.join(output_dir, "sources")
        self.clips_dir = os.path.join(output_dir, "clips")
        
        os.makedirs(self.source_dir, exist_ok=True)
        os.makedirs(self.clips_dir, exist_ok=True)
        
        self.cookie_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt"))
        self.client = youtube_client or YouTubeClient(cookie_path=self.cookie_path)
        self.config_store = config_store
        
        import threading
        self._download_locks = {}
        self._repo_lock = threading.Lock()
        
        self._env = os.environ.copy()
        
        # Update execution PATH securely
        extra_paths = []
        custom_ffmpeg = self.config_store.get("FFMPEG_PATH") if self.config_store else os.environ.get("FFMPEG_PATH")
        if custom_ffmpeg:
            if os.path.isdir(custom_ffmpeg):
                extra_paths.append(custom_ffmpeg)
            else:
                extra_paths.append(os.path.dirname(custom_ffmpeg))
                
        if sys.platform.startswith("win"):
            extra_paths.extend(["C:\\Program Files\\ffmpeg\\bin", "C:\\ffmpeg\\bin", "C:\\Program Files\\nodejs"])
        else:
            extra_paths.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"])
            
        current_path = self._env.get("PATH", "")
        sep = ";" if sys.platform.startswith("win") else ":"
        
        for p in extra_paths:
            if os.path.exists(p) and p not in current_path.split(sep):
                current_path = f"{p}{sep}{current_path}" if current_path else p
                
        self._env["PATH"] = current_path


    def _sanitize_filename(self, title: str) -> str:
        """Sanitize title for folder naming, truncating to 50 chars."""
        s = re.sub(r'[^\w\s-]', '_', title).strip()
        s = re.sub(r'\s+', '_', s)
        return s[:50]

    def _run_ffmpeg(self, args: list) -> bool:
        cmd = ["ffmpeg"] + args
        print(f"[ffmpeg] Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, env=self._env, encoding="utf-8")
        if result.returncode != 0:
            error_msg = result.stderr.strip()[-500:] or f"ffmpeg failed with code {result.returncode}"
            print(f"[ffmpeg] Error: {error_msg}")
            raise RuntimeError(f"FFmpeg Error: {error_msg}")
        return True

    def _ffprobe_info(self, file_path: str) -> dict:
        """Get video metadata via ffprobe."""
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, env=self._env, encoding="utf-8")
        if result.returncode != 0:
            return {}
        try:
            return json.loads(result.stdout)
        except:
            return {}

    def get_video_resolution(self, file_path: str) -> tuple:
        """Returns (width, height)."""
        info = self._ffprobe_info(file_path)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                return (stream.get("width", 0), stream.get("height", 0))
        return (0, 0)

    def get_video_duration(self, file_path: str) -> float:
        """Returns duration in seconds."""
        info = self._ffprobe_info(file_path)
        fmt = info.get("format", {})
        try:
            return float(fmt.get("duration", 0))
        except:
            return 0.0

    def _get_video_fps(self, file_path: str) -> float:
        """Returns frame rate as float."""
        info = self._ffprobe_info(file_path)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                fps_str = stream.get("avg_frame_rate", "30/1")
                if "/" in fps_str:
                    try:
                        num, den = map(int, fps_str.split("/"))
                        if den > 0:
                            return num / den
                    except:
                        pass
                try:
                    return float(fps_str)
                except:
                    return 30.0
        return 30.0

    def _generate_thumbnail(self, folder_path: str, video_id: str) -> Optional[str]:
        """Generate a video thumbnail inside the source folder."""
        video_path = os.path.join(folder_path, "full.mp4")
        if not os.path.exists(video_path):
            video_path = os.path.join(folder_path, "preview.mp4")
        thumb_path = os.path.join(folder_path, "thumb.jpg")
        
        if os.path.exists(thumb_path):
            return thumb_path
            
        if not os.path.exists(video_path):
            return None
            
        try:
            self._run_ffmpeg(["-ss", "00:00:05", "-i", video_path, "-vframes", "1", "-q:v", "2", "-y", thumb_path])
        except:
            try:
                self._run_ffmpeg(["-i", video_path, "-vframes", "1", "-q:v", "2", "-y", thumb_path])
            except:
                return None
        return thumb_path

    # ── High Leverage Deep Interface Methods ────────────────────────

    def get_cached_video(self, url: str) -> Optional[dict]:
        """Search sources/ subfolders for the video ID."""
        video_id = self.client.extract_video_id(url)
        if not video_id:
            return None
        
        for entry in os.scandir(self.source_dir):
            if entry.is_dir() and entry.name.endswith(f"_{video_id}"):
                full_path = os.path.join(entry.path, "full.mp4")
                preview_path = os.path.join(entry.path, "preview.mp4")
                
                target_path = None
                hd_ready = False
                if os.path.exists(full_path):
                    target_path = full_path
                    hd_ready = True
                elif os.path.exists(preview_path):
                    target_path = preview_path
                    hd_ready = False
                
                if target_path:
                    w, h = self.get_video_resolution(target_path)
                    filename = os.path.basename(target_path)
                    return {
                        "video_id": video_id,
                        "title": entry.name.replace(f"_{video_id}", ""),
                        "duration": self.get_video_duration(target_path),
                        "fps": self._get_video_fps(target_path),
                        "file_path": target_path,
                        "folder_name": entry.name,
                        "asset_url": f"/assets/sources/{entry.name}/{filename}",
                        "width": w,
                        "height": h,
                        "hd_ready": hd_ready,
                        "has_preview": os.path.exists(preview_path),
                        "heatmap": []
                    }
        return None

    def get_cached_video_by_folder(self, folder_name: str) -> Optional[dict]:
        """Search sources/ subfolders by exact folder name."""
        target_dir = os.path.join(self.source_dir, folder_name)
        if os.path.exists(target_dir) and os.path.isdir(target_dir):
            full_path = os.path.join(target_dir, "full.mp4")
            preview_path = os.path.join(target_dir, "preview.mp4")
            
            target_path = None
            hd_ready = False
            if os.path.exists(full_path):
                target_path = full_path
                hd_ready = True
            elif os.path.exists(preview_path):
                target_path = preview_path
                hd_ready = False
                
            if target_path:
                video_id = folder_name.split("_")[-1]
                w, h = self.get_video_resolution(target_path)
                filename = os.path.basename(target_path)
                return {
                    "video_id": video_id,
                    "title": folder_name.replace(f"_{video_id}", ""),
                    "duration": self.get_video_duration(target_path),
                    "fps": self._get_video_fps(target_path),
                    "file_path": target_path,
                    "folder_name": folder_name,
                    "asset_url": f"/assets/sources/{folder_name}/{filename}",
                    "width": w,
                    "height": h,
                    "hd_ready": hd_ready,
                    "has_preview": os.path.exists(preview_path),
                    "heatmap": []
                }
        return None

    def get_or_create_source(self, url: str, force_download: bool = False, quality: str = "1080p", progress_callback = None) -> dict:
        """
        Gets metadata of a video by URL, downloading and extracting transcript/audio 
        automatically if not already cached.
        """
        import threading
        video_id = self.client.extract_video_id(url)
        if not video_id:
            # Fall back to URL md5 hash if extract fails
            import hashlib
            video_id = hashlib.md5(url.encode()).hexdigest()
            
        lock_key = (video_id, quality)
        
        with self._repo_lock:
            if lock_key not in self._download_locks:
                self._download_locks[lock_key] = threading.Lock()
            download_lock = self._download_locks[lock_key]
            
        with download_lock:
            if not force_download:
                cached = self.get_cached_video(url)
                if cached:
                    if quality == "1080p" and not cached.get("hd_ready"):
                        pass
                    else:
                        return cached
            else:
                # Even if force is True, if we are fetching 1080p and the file now exists on disk,
                # we don't need to force download it again.
                cached = self.get_cached_video(url)
                if cached and cached.get("hd_ready") and quality == "1080p":
                    return cached
                if cached and quality == "360p":
                    return cached

            # Otherwise, retrieve metadata and download
            info = self.client.get_video_info_fast(url)
            video_id = info["id"]
            safe_title = self._sanitize_filename(info["title"])
            folder_name = f"{safe_title}_{video_id}"
            
            target_dir = os.path.join(self.source_dir, folder_name)
            os.makedirs(target_dir, exist_ok=True)
            
            self.client.download_video(url, target_dir, quality=quality, progress_callback=progress_callback)
            filename = "preview.mp4" if quality == "360p" else "full.mp4"
            file_path = os.path.join(target_dir, filename)
            w, h = self.get_video_resolution(file_path)
            
            return {
                "video_id": video_id,
                "title": info["title"],
                "duration": self.get_video_duration(file_path),
                "fps": self._get_video_fps(file_path),
                "file_path": file_path,
                "folder_name": folder_name,
                "asset_url": f"/assets/sources/{folder_name}/{filename}",
                "width": w,
                "height": h,
                "hd_ready": (quality == "1080p"),
                "has_preview": os.path.exists(os.path.join(target_dir, "preview.mp4")),
                "heatmap": []
            }

    def extract_audio_from_local(self, video_path: str) -> str:
        """Extract high-stability WAV for AI analysis."""
        audio_path = video_path.replace("full.mp4", "audio_v2.wav").replace("preview.mp4", "audio_v2.wav").replace("video.mp4", "audio_v2.wav")
        if audio_path == video_path:
            audio_path = os.path.splitext(video_path)[0] + "_audio_v2.wav"
        if os.path.exists(audio_path):
            return audio_path
        
        self._run_ffmpeg([
            "-i", video_path, 
            "-vn", 
            "-acodec", "pcm_s16le", 
            "-ar", "16000", 
            "-ac", "1", 
            "-y", audio_path
        ])
        return audio_path

    def extract_hook_thumbnail(self, video_path: str, timestamp: float, output_path: str) -> Optional[str]:
        """Extract a single frame at a specific timestamp and save as JPEG."""
        if os.path.exists(output_path):
            return output_path
            
        try:
            self._run_ffmpeg([
                "-ss", str(timestamp),
                "-i", video_path,
                "-vframes", "1",
                "-s", "640x360",
                "-q:v", "2",
                "-y", output_path
            ])
            return output_path
        except Exception as e:
            print(f"[asset-repository] Failed to extract thumbnail at {timestamp}: {e}")
            try:
                self._run_ffmpeg([
                    "-i", video_path,
                    "-vframes", "1",
                    "-s", "640x360",
                    "-q:v", "2",
                    "-y", output_path
                ])
                return output_path
            except Exception as e2:
                print(f"[asset-repository] Double fallback thumbnail extraction failed: {e2}")
                return None

    def create_clip(self, video_path: str, start_time: float, end_time: float, theme: Optional[str] = None) -> Optional[dict]:
        """Cut video segment into a unique clips subfolder."""
        folder_name = os.path.basename(os.path.dirname(video_path))
        
        safe_theme = ""
        if theme:
            safe_theme = re.sub(r'[^\w\s-]', '', theme).strip().replace(' ', '_')[:50]
            
        if safe_theme:
            clip_id = f"{int(start_time)}_{int(end_time)}_{safe_theme}"
        else:
            clip_id = f"{int(start_time)}_{int(end_time)}"
            
        target_dir = os.path.join(self.clips_dir, folder_name, clip_id)
        os.makedirs(target_dir, exist_ok=True)
        
        out_name = "video.mp4"
        out_path = os.path.join(target_dir, out_name)
        
        duration = end_time - start_time
        if os.path.exists(out_path):
            return {
                "file_path": out_path, 
                "asset_url": f"/assets/clips/{folder_name}/{clip_id}/{out_name}", 
                "duration": duration,
                "clip_id": clip_id,
                "start": start_time,
                "end": end_time,
                "theme": theme
            }
        
        try:
            self._run_ffmpeg([
                "-accurate_seek",
                "-i", video_path, 
                "-ss", str(start_time), 
                "-t", str(duration),
                "-c:v", "libx264", 
                "-preset", "superfast", 
                "-crf", "23", 
                "-c:a", "aac", 
                "-avoid_negative_ts", "make_zero",
                "-y", out_path
            ])
        except Exception as e:
            print(f"Error cutting segment: {e}")
            raise e
            
        return {
            "file_path": out_path, 
            "asset_url": f"/assets/clips/{folder_name}/{clip_id}/{out_name}", 
            "duration": duration,
            "clip_id": clip_id,
            "start": start_time,
            "end": end_time,
            "theme": theme
        }

    def list_cached_videos(
        self,
        page: Optional[int] = None,
        limit: int = 6,
        search: Optional[str] = None,
        sort_by: str = "date",
        order: str = "desc"
    ) -> Any:
        """List, search, sort, and paginate cached source videos."""
        results = []
        if not os.path.exists(self.source_dir):
            return {"videos": [], "total": 0, "has_more": False} if page is not None else []
            
        for entry in os.scandir(self.source_dir):
            if entry.is_dir() and len(entry.name) >= 12 and entry.name[-12] == "_":
                video_id = entry.name[-11:]
                full_path = os.path.join(entry.path, "full.mp4")
                preview_path = os.path.join(entry.path, "preview.mp4")
                
                target_path = None
                hd_ready = False
                if os.path.exists(full_path):
                    target_path = full_path
                    hd_ready = True
                elif os.path.exists(preview_path):
                    target_path = preview_path
                    hd_ready = False
                
                if not target_path:
                    continue
                
                w, h = self.get_video_resolution(target_path)
                thumb_path = self._generate_thumbnail(entry.path, video_id)
                filename = os.path.basename(target_path)
                
                try:
                    mtime = os.path.getmtime(target_path)
                except Exception:
                    mtime = 0.0
                
                results.append({
                    "video_id": video_id,
                    "title": entry.name.replace(f"_{video_id}", "").replace("_", " "),
                    "folder_name": entry.name,
                    "resolution": f"{w}x{h}",
                    "duration": self.get_video_duration(target_path),
                    "mtime": mtime,
                    "asset_url": f"/assets/sources/{entry.name}/{filename}",
                    "thumbnail_url": f"/assets/sources/{entry.name}/thumb.jpg" if thumb_path else None,
                    "youtube_url": f"https://youtube.com/watch?v={video_id}",
                    "hd_ready": hd_ready
                })
        
        # If raw list requested without pagination
        if page is None:
            return results

        # 1. Search Filter (case-insensitive)
        if search:
            search_lower = search.lower()
            results = [
                v for v in results
                if search_lower in v.get("title", "").lower() or search_lower in v.get("video_id", "").lower()
            ]

        # 2. Sorting
        if sort_by == "title":
            reverse = (order == "desc")
            results.sort(key=lambda x: x.get("title", "").lower(), reverse=reverse)
        else:
            reverse = (order != "asc")
            results.sort(key=lambda x: x.get("mtime", 0.0), reverse=reverse)

        # 3. Pagination Slicing
        total = len(results)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_videos = results[start_idx:end_idx]
        has_more = end_idx < total

        return {
            "videos": paginated_videos,
            "total": total,
            "has_more": has_more
        }

    def list_all_clips(self) -> list:
        """Scan all clips subfolders for ready videos (video.mp4 + transcript.json)."""
        results = []
        if not os.path.exists(self.clips_dir):
            return []
        
        for video_entry in os.scandir(self.clips_dir):
            if not video_entry.is_dir():
                continue
            
            for clip_entry in os.scandir(video_entry.path):
                if not clip_entry.is_dir():
                    continue
                
                video_path = os.path.join(clip_entry.path, "video.mp4")
                transcript_path = os.path.join(clip_entry.path, "transcript.json")
                
                if os.path.exists(video_path):
                    if not os.path.exists(transcript_path):
                        try:
                            with open(transcript_path, "w", encoding="utf-8") as f:
                                json.dump([], f, ensure_ascii=False, indent=2)
                            print(f"[asset_repository] Auto-healed missing transcript at {transcript_path}")
                        except Exception as e:
                            print(f"[asset_repository] Failed to auto-heal missing transcript at {transcript_path}: {e}")
                    
                    mtime = os.path.getmtime(video_path)
                    clip_id = clip_entry.name
                    duration = self.get_video_duration(video_path)
                    
                    parent_name = video_entry.name
                    title = "Unknown Clip"
                    if "_" in parent_name:
                        title = " ".join(parent_name.split("_")[:-1])
                    
                    theme = ""
                    start_time = 0.0
                    end_time = 0.0
                    parts = clip_id.split("_")
                    if len(parts) >= 2:
                        try:
                            start_time = float(parts[0])
                            end_time = float(parts[1])
                            if len(parts) >= 3:
                                theme = " ".join(parts[2:])
                        except:
                            pass
                    
                    results.append({
                        "clip_id": clip_id,
                        "folder_name": parent_name,
                        "title": title,
                        "theme": theme.replace("_", " "),
                        "start_time": start_time,
                        "end_time": end_time,
                        "duration": duration,
                        "mtime": mtime,
                        "asset_url": f"/assets/clips/{parent_name}/{clip_id}/video.mp4"
                    })
        
        results.sort(key=lambda x: x["mtime"], reverse=True)
        return results

    def list_ready_clips(self, active_clip_ids: Optional[set] = None) -> list:
        """List all ready clips, filtering out clips currently being processed."""
        clips = self.list_all_clips()
        if not active_clip_ids:
            return clips
        return [c for c in clips if c.get("clip_id") not in active_clip_ids]

    def delete_cached_video(self, folder_name: str) -> int:
        """Delete titled folders in sources and clips securely with validation."""
        if not folder_name or not re.match(r"^[\w\s.-]+$", folder_name) or ".." in folder_name:
            raise ValueError(f"Invalid or unsafe folder name: {folder_name}")

        count = 0
        
        # 1. Source folder absolute validation & deletion
        base_src = os.path.abspath(self.source_dir)
        src_path = os.path.abspath(os.path.join(base_src, folder_name))
        
        if os.path.commonpath([base_src, src_path]) != base_src:
            raise ValueError(f"Path traversal detected: {folder_name}")

        if os.path.exists(src_path) and os.path.isdir(src_path):
            shutil.rmtree(src_path)
            count += 1

        # 2. Clips folder absolute validation & deletion
        base_clips = os.path.abspath(self.clips_dir)
        clip_path = os.path.abspath(os.path.join(base_clips, folder_name))

        if os.path.commonpath([base_clips, clip_path]) != base_clips:
            raise ValueError(f"Path traversal detected: {folder_name}")

        if os.path.exists(clip_path) and os.path.isdir(clip_path):
            shutil.rmtree(clip_path)
            count += 1

        return count

    def delete_clip(self, folder_name: str, clip_id: str) -> bool:
        """Delete a specific clip folder securely."""
        if not folder_name or ".." in folder_name or not re.match(r"^[\w\s.-]+$", folder_name):
            raise ValueError(f"Invalid folder name: {folder_name}")
        if not clip_id or ".." in clip_id or not re.match(r"^[\w\s.-]+$", clip_id):
            raise ValueError(f"Invalid clip ID: {clip_id}")

        base_clips = os.path.abspath(self.clips_dir)
        clip_dir = os.path.abspath(os.path.join(base_clips, folder_name, clip_id))
        
        if os.path.commonpath([base_clips, clip_dir]) != base_clips:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        if os.path.exists(clip_dir) and os.path.isdir(clip_dir):
            shutil.rmtree(clip_dir)
            return True
        return False

    def delete_clip_with_job(self, folder_name: str, clip_id: str, job_store: Any = None) -> bool:
        """Delete a specific clip folder and clean up any associated JobStore session."""
        success = self.delete_clip(folder_name, clip_id)
        if success and job_store is not None:
            import hashlib
            hash_input = f"{folder_name}_{clip_id}"
            derived_job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
            if hasattr(job_store, "delete_job"):
                job_store.delete_job(derived_job_id)
            elif isinstance(job_store, dict) and derived_job_id in job_store:
                del job_store[derived_job_id]
        return success

    def delete_cached_video_with_jobs(self, folder_name: str, job_store: Any = None) -> int:
        """Cancel active background jobs matching folder/video_id and purge source & clip assets."""
        if job_store is not None:
            target_video_id = None
            if len(folder_name) >= 12 and folder_name[-12] == "_":
                target_video_id = folder_name[-11:]
            
            jobs_dict = job_store.items() if hasattr(job_store, "items") else []
            for j_id, j_info in list(jobs_dict):
                is_match = False
                if isinstance(j_info, dict):
                    if j_info.get("video_info") and j_info["video_info"].get("folder_name") == folder_name:
                        is_match = True
                    elif target_video_id and j_info.get("url") and target_video_id in j_info["url"]:
                        is_match = True
                    
                    if is_match:
                        current_status = j_info.get("status")
                        if current_status in ["queued", "downloading", "processing", "checking_transcript", "extracting_audio", "generating_hooks"]:
                            print(f"[delete] Cancelling active background job {j_id} for deleted source {folder_name}")
                            j_info["status"] = "cancelled"
                            j_info["error"] = "Source video deleted by user."
                            job_store[j_id] = j_info
            
            if hasattr(job_store, "save") or hasattr(job_store, "save_jobs"):
                save_fn = getattr(job_store, "save", None) or getattr(job_store, "save_jobs", None)
                if callable(save_fn):
                    save_fn()

        return self.delete_cached_video(folder_name)


    # ── Hooks DB/JSON Operations ──────────────────────────────────

    def get_saved_hooks(self, folder_name: str) -> list:
        folder_path = os.path.join(self.source_dir, folder_name)
        saved_hooks_path = os.path.join(folder_path, "saved_hooks.json")
        if os.path.exists(saved_hooks_path):
            with open(saved_hooks_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        hooks = self.get_saved_hooks(folder_name)
        if not any(h.get('start') == hook.get('start') and h.get('end') == hook.get('end') for h in hooks):
            hook["_id"] = str(uuid.uuid4())
            hooks.append(hook)
            folder_path = os.path.join(self.source_dir, folder_name)
            saved_hooks_path = os.path.join(folder_path, "saved_hooks.json")
            with open(saved_hooks_path, "w", encoding="utf-8") as f:
                json.dump(hooks, f, indent=4)
        return hooks

    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        hooks = self.get_saved_hooks(folder_name)
        hooks = [h for h in hooks if h.get("_id") != hook_id]
        folder_path = os.path.join(self.source_dir, folder_name)
        saved_hooks_path = os.path.join(folder_path, "saved_hooks.json")
        with open(saved_hooks_path, "w", encoding="utf-8") as f:
            json.dump(hooks, f, indent=4)
        return hooks

    # ── Clip Artifacts & Config Persistence ───────────────────────

    def _resolve_clip_path(self, folder_name: str, clip_id: str, filename: str) -> str:
        base = os.path.realpath(self.clips_dir)
        target = os.path.realpath(os.path.join(self.clips_dir, folder_name, clip_id, filename))
        if os.path.commonpath([base, target]) != base:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}/{filename}")
        return target

    def save_clip_transcript(self, folder_name: str, clip_id: str, transcript: list) -> bool:
        clip_transcript_path = self._resolve_clip_path(folder_name, clip_id, "transcript.json")
        os.makedirs(os.path.dirname(clip_transcript_path), exist_ok=True)
        with open(clip_transcript_path, "w", encoding="utf-8") as f:
            json.dump(transcript, f, ensure_ascii=False, indent=2)
        return True

    def update_source_hooks(self, folder_name: str, hooks: list) -> bool:
        base = os.path.realpath(self.source_dir)
        hooks_path = os.path.realpath(os.path.join(self.source_dir, folder_name, "hooks.json"))
        if os.path.commonpath([base, hooks_path]) != base:
            raise ValueError(f"Path traversal detected: {folder_name}/hooks.json")
        if not os.path.exists(hooks_path):
            return False
        with open(hooks_path, "w", encoding="utf-8") as f:
            json.dump(hooks, f, ensure_ascii=False, indent=2)
        return True

    def save_clip_style_settings(self, folder_name: str, clip_id: str, settings: dict) -> bool:
        style_path = self._resolve_clip_path(folder_name, clip_id, "style_settings.json")
        os.makedirs(os.path.dirname(style_path), exist_ok=True)
        with open(style_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True

    def save_clip_timeline(self, folder_name: str, clip_id: str, timeline_tracks: list) -> bool:
        timeline_path = self._resolve_clip_path(folder_name, clip_id, "timeline.json")
        os.makedirs(os.path.dirname(timeline_path), exist_ok=True)
        with open(timeline_path, "w", encoding="utf-8") as f:
            json.dump(timeline_tracks, f, ensure_ascii=False, indent=2)
        return True

    def save_clip_history(self, folder_name: str, clip_id: str, undo_stack: list, redo_stack: list) -> bool:
        history_path = self._resolve_clip_path(folder_name, clip_id, "history.json")
        os.makedirs(os.path.dirname(history_path), exist_ok=True)
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump({"undo_stack": undo_stack, "redo_stack": redo_stack}, f, ensure_ascii=False)
        return True

    def save_default_style_settings(self, settings: dict) -> bool:
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        with open(default_style_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
        return True

    def get_default_style_settings(self) -> Optional[dict]:
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        if os.path.exists(default_style_path):
            try:
                with open(default_style_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def save_default_thumbnail_style(self, style: dict) -> bool:
        default_thumb_path = os.path.join(self.output_dir, "default_thumbnail_style.json")
        with open(default_thumb_path, "w", encoding="utf-8") as f:
            json.dump(style, f, ensure_ascii=False, indent=2)
        return True

    def get_default_thumbnail_style(self) -> Optional[dict]:
        default_thumb_path = os.path.join(self.output_dir, "default_thumbnail_style.json")
        if os.path.exists(default_thumb_path):
            try:
                with open(default_thumb_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def save_thumbnail_config(self, folder_name: str, clip_id: str, config: dict) -> bool:
        config_path = self._resolve_clip_path(folder_name, clip_id, "thumbnail_config.json")
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True

    def get_thumbnail_config(self, folder_name: str, clip_id: str) -> Optional[dict]:
        config_path = self._resolve_clip_path(folder_name, clip_id, "thumbnail_config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def delete_thumbnail(self, folder_name: str, clip_id: str) -> bool:
        thumb_path = self._resolve_clip_path(folder_name, clip_id, "thumbnail.jpg")
        if os.path.exists(thumb_path):
            try:
                os.remove(thumb_path)
            except Exception:
                pass
        return True

    def extract_clip_screenshot(self, clip_path: str, timestamp: float, output_path: str) -> bool:
        if not os.path.exists(clip_path):
            return False
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        cmd = [
            "ffmpeg", "-y",
            "-ss", str(timestamp),
            "-i", clip_path,
            "-vframes", "1",
            "-q:v", "2",
            output_path
        ]
        res = self._run_ffmpeg(cmd)
        return res and os.path.exists(output_path)


class MockAssetStore(AssetStore):

    def __init__(self, cached_videos=None, ready_clips=None, saved_hooks=None):
        self.cached_videos = cached_videos or []
        self.ready_clips = ready_clips or []
        self.saved_hooks = saved_hooks or {}
        self.calls = []

    def get_cached_video(self, url: str) -> Optional[dict]:
        self.calls.append(("get_cached_video", url))
        for v in self.cached_videos:
            if url in v.get("youtube_url", "") or url == v.get("video_id") or v.get("video_id") in url:
                return v
        return None

    def get_cached_video_by_folder(self, folder_name: str) -> Optional[dict]:
        self.calls.append(("get_cached_video_by_folder", folder_name))
        for v in self.cached_videos:
            if v.get("folder_name") == folder_name:
                return v
        return None

    def get_or_create_source(self, url: str, force_download: bool = False, quality: str = "1080p", progress_callback = None) -> Optional[dict]:
        self.calls.append(("get_or_create_source", url, force_download, quality))
        cached = self.get_cached_video(url)
        if cached:
            if quality == "1080p" and not cached.get("hd_ready"):
                pass
            else:
                return cached
        filename = "preview.mp4" if quality == "360p" else "full.mp4"
        mock_source = {
            "video_id": "mock_id",
            "title": "Mock Video",
            "duration": 60.0,
            "fps": 30.0,
            "file_path": f"mock_path/{filename}",
            "folder_name": "Mock_Video_mock_id",
            "asset_url": f"/assets/sources/Mock_Video_mock_id/{filename}",
            "width": 1920,
            "height": 1080,
            "hd_ready": (quality == "1080p"),
            "has_preview": True,
            "mtime": 1600000000.0
        }
        self.cached_videos.append(mock_source)
        if progress_callback:
            progress_callback(100.0)
        return mock_source

    def extract_hook_thumbnail(self, video_path: str, timestamp: float, output_path: str) -> Optional[str]:
        self.calls.append(("extract_hook_thumbnail", video_path, timestamp, output_path))
        return output_path

    def extract_audio_from_local(self, video_path: str) -> str:
        self.calls.append(("extract_audio_from_local", video_path))
        return video_path.replace("full.mp4", "audio_v2.wav")

    def create_clip(self, video_path: str, start_time: float, end_time: float, theme: Optional[str] = None) -> Optional[dict]:
        self.calls.append(("create_clip", video_path, start_time, end_time, theme))
        return {
            "file_path": video_path.replace("full.mp4", "video.mp4"),
            "asset_url": "/assets/clips/mock_folder/mock_clip/video.mp4",
            "duration": end_time - start_time,
            "clip_id": "mock_clip",
            "start": start_time,
            "end": end_time,
            "theme": theme
        }

    def list_cached_videos(self, page: Optional[int] = None, limit: int = 6, search: Optional[str] = None, sort_by: str = "date", order: str = "desc") -> Any:
        self.calls.append(("list_cached_videos", page, limit, search, sort_by, order))
        if page is not None:
            return {"videos": self.cached_videos, "total": len(self.cached_videos), "has_more": False}
        return self.cached_videos

    def list_all_clips(self) -> list:
        self.calls.append(("list_all_clips",))
        return self.ready_clips

    def list_ready_clips(self, active_clip_ids: Optional[set] = None) -> list:
        self.calls.append(("list_ready_clips", active_clip_ids))
        if not active_clip_ids:
            return self.ready_clips
        return [c for c in self.ready_clips if c.get("clip_id") not in active_clip_ids]

    def delete_cached_video(self, folder_name: str) -> int:
        self.calls.append(("delete_cached_video", folder_name))
        return 1

    def delete_clip(self, folder_name: str, clip_id: str) -> bool:
        self.calls.append(("delete_clip", folder_name, clip_id))
        return True

    def delete_clip_with_job(self, folder_name: str, clip_id: str, job_store: Any = None) -> bool:
        self.calls.append(("delete_clip_with_job", folder_name, clip_id, job_store))
        return self.delete_clip(folder_name, clip_id)

    def delete_cached_video_with_jobs(self, folder_name: str, job_store: Any = None) -> int:
        self.calls.append(("delete_cached_video_with_jobs", folder_name, job_store))
        return self.delete_cached_video(folder_name)

    def get_saved_hooks(self, folder_name: str) -> list:
        self.calls.append(("get_saved_hooks", folder_name))
        return self.saved_hooks.get(folder_name, [])

    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        self.calls.append(("add_saved_hook", folder_name, hook))
        if folder_name not in self.saved_hooks:
            self.saved_hooks[folder_name] = []
        self.saved_hooks[folder_name].append(hook)
        return self.saved_hooks[folder_name]

    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        self.calls.append(("delete_saved_hook", folder_name, hook_id))
        if folder_name in self.saved_hooks:
            self.saved_hooks[folder_name] = [h for h in self.saved_hooks[folder_name] if h.get("_id") != hook_id]
        return self.saved_hooks.get(folder_name, [])

