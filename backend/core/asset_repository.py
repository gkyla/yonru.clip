import os
import re
import sys
import subprocess
import json
import uuid
import shutil
import time
from typing import Optional, Dict, Any, List
from abc import ABC, abstractmethod
from core.youtube_client import YouTubeClient
from core.media_transcoder import MediaTranscoder

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
    def delete_cached_video(self, folder_name: str) -> int:
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
        """Backward-compatible delegate: routes to deepened HookDiscoveryEngine."""
        from core.hook_discovery_engine import HookDiscoveryEngine
        engine = HookDiscoveryEngine(media_transcoder=getattr(self, "transcoder", None))
        return engine.sanitize_and_prepare_hooks(raw_hooks, video_info)

class AssetRepository(AssetStore):
    def __init__(self, output_dir="temp_assets", youtube_client=None, config_store=None, media_transcoder=None):
        self.output_dir = output_dir
        self.source_dir = os.path.join(output_dir, "sources")
        self.clips_dir = os.path.join(output_dir, "clips")
        
        os.makedirs(self.source_dir, exist_ok=True)
        os.makedirs(self.clips_dir, exist_ok=True)
        
        self.cookie_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt"))
        self.client = youtube_client or YouTubeClient(cookie_path=self.cookie_path)
        self.config_store = config_store
        self.transcoder = media_transcoder or MediaTranscoder(config_store=self.config_store)
        self._env = getattr(self.transcoder.adapter, "_env", os.environ.copy())
        
        import threading
        self._download_locks = {}
        self._repo_lock = threading.Lock()

    def _sanitize_filename(self, title: str) -> str:
        """Sanitize title for folder naming, truncating to 50 chars."""
        s = re.sub(r'[^\w\s-]', '_', title).strip()
        s = re.sub(r'\s+', '_', s)
        s = re.sub(r'_+', '_', s)
        clean = s.strip('_')[:50].strip('_')
        return clean or "Video"

    def _sanitize_channel_name(self, channel: Optional[str]) -> str:
        """Sanitize channel name for folder naming, truncating to 40 chars."""
        if not channel:
            return "Unknown Channel"
        s = re.sub(r'[^\w\s-]', '', channel).strip()
        s = re.sub(r'\s+', ' ', s)
        clean = s[:40].strip()
        return clean or "Unknown Channel"

    def _run_ffmpeg(self, args: list) -> bool:
        return self.transcoder.run_ffmpeg(args)

    def _ffprobe_info(self, file_path: str) -> dict:
        """Get video metadata via ffprobe."""
        return self.transcoder.adapter.ffprobe_info(file_path)

    def get_video_resolution(self, file_path: str) -> tuple:
        """Returns (width, height)."""
        info = self._ffprobe_info(file_path)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                return (int(stream.get("width", 0)), int(stream.get("height", 0)))
        return (0, 0)

    def get_video_duration(self, file_path: str) -> float:
        """Returns duration in seconds."""
        info = self._ffprobe_info(file_path)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video" and stream.get("duration"):
                try:
                    return float(stream["duration"])
                except Exception:
                    pass
        fmt = info.get("format", {})
        try:
            return float(fmt.get("duration", 0))
        except (ValueError, TypeError):
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
        
        with os.scandir(self.source_dir) as entries:
            for entry in entries:
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
                        
                        title = None
                        channel = "Unknown Channel"
                        meta_path = os.path.join(entry.path, "metadata.json")
                        if os.path.exists(meta_path):
                            try:
                                with open(meta_path, "r", encoding="utf-8") as mf:
                                    meta = json.load(mf)
                                    title = meta.get("title") or meta.get("raw_title")
                                    if meta.get("channel"):
                                        channel = meta.get("channel")
                                    elif meta.get("uploader"):
                                        channel = meta.get("uploader")
                            except Exception:
                                pass
                        
                        if not title:
                            title = entry.name.replace(f"_{video_id}", "")
                            if title.startswith("[") and "] " in title:
                                title = title.split("] ", 1)[1]
                            title = title.replace("_", " ")

                        return {
                            "video_id": video_id,
                            "title": title,
                            "channel": channel,
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

                title = None
                channel = "Unknown Channel"
                meta_path = os.path.join(target_dir, "metadata.json")
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, "r", encoding="utf-8") as mf:
                            meta = json.load(mf)
                            title = meta.get("title") or meta.get("raw_title")
                            if meta.get("channel"):
                                channel = meta.get("channel")
                            elif meta.get("uploader"):
                                channel = meta.get("uploader")
                    except Exception:
                        pass

                if not title:
                    title = folder_name.replace(f"_{video_id}", "")
                    if title.startswith("[") and "] " in title:
                        title = title.split("] ", 1)[1]
                    title = title.replace("_", " ")

                return {
                    "video_id": video_id,
                    "title": title,
                    "channel": channel,
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
            channel = info.get("channel") or info.get("uploader") or "Unknown Channel"
            safe_channel = self._sanitize_channel_name(channel)
            safe_title = self._sanitize_filename(info["title"])
            folder_name = f"[{safe_channel}] {safe_title}_{video_id}"
            
            target_dir = os.path.join(self.source_dir, folder_name)
            os.makedirs(target_dir, exist_ok=True)
            
            self.client.download_video(url, target_dir, quality=quality, progress_callback=progress_callback)
            filename = "preview.mp4" if quality == "360p" else "full.mp4"
            file_path = os.path.join(target_dir, filename)
            w, h = self.get_video_resolution(file_path)

            added_at = time.time()
            try:
                meta_path = os.path.join(target_dir, "metadata.json")
                with open(meta_path, "w", encoding="utf-8") as mf:
                    json.dump({
                        "video_id": video_id,
                        "title": info["title"],
                        "raw_title": info["title"],
                        "channel": channel,
                        "added_at": added_at
                    }, mf, indent=2, ensure_ascii=False)
            except Exception as me:
                print(f"[asset_repository] Failed to write metadata.json: {me}")
            
            return {
                "video_id": video_id,
                "title": info["title"],
                "channel": channel,
                "added_at": added_at,
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
        return self.transcoder.extract_audio(video_path, audio_path)

    def extract_hook_thumbnail(self, video_path: str, timestamp: float, output_path: str) -> Optional[str]:
        """Extract a single frame at a specific timestamp and save as JPEG."""
        if os.path.exists(output_path):
            return output_path
        success = self.transcoder.extract_frame(video_path, timestamp, output_path)
        return output_path if success else None

    def create_clip(self, video_path: str, start_time: float, end_time: float, theme: Optional[str] = None) -> Optional[dict]:
        """Backward-compatible delegate: routes to deepened ClipSessionStore."""
        from core.clip_session_store import ClipSessionStore
        store = ClipSessionStore(clips_dir=self.clips_dir, output_dir=self.output_dir, config_store=self.config_store, media_transcoder=self.transcoder)
        store._run_ffmpeg = self._run_ffmpeg
        store._ffprobe_info = self._ffprobe_info
        return store.create_clip(video_path, start_time, end_time, theme)



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
            
        with os.scandir(self.source_dir) as entries:
            for entry in entries:
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
                    
                    channel = "Unknown Channel"
                    added_at = mtime
                    title = None
                    meta_path = os.path.join(entry.path, "metadata.json")
                    if os.path.exists(meta_path):
                        try:
                            with open(meta_path, "r", encoding="utf-8") as mf:
                                meta = json.load(mf)
                                title = meta.get("title") or meta.get("raw_title")
                                if meta.get("channel"):
                                    channel = meta.get("channel")
                                elif meta.get("uploader"):
                                    channel = meta.get("uploader")
                                if meta.get("added_at"):
                                    added_at = float(meta.get("added_at"))
                        except Exception:
                            pass

                    if not title:
                        title = entry.name.replace(f"_{video_id}", "")
                        if title.startswith("[") and "] " in title:
                            title = title.split("] ", 1)[1]
                        title = title.replace("_", " ")

                    results.append({
                        "video_id": video_id,
                        "title": title,
                        "folder_name": entry.name,
                        "channel": channel,
                        "added_at": added_at,
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
                if search_lower in v.get("title", "").lower()
                or search_lower in v.get("video_id", "").lower()
                or search_lower in v.get("channel", "").lower()
            ]

        # 2. Sorting
        if sort_by == "title":
            reverse = (order == "desc")
            results.sort(key=lambda x: x.get("title", "").lower(), reverse=reverse)
        else:
            reverse = (order != "asc")
            results.sort(key=lambda x: x.get("added_at", x.get("mtime", 0.0)), reverse=reverse)

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

    def delete_cached_video(self, folder_name: str) -> int:
        """Delete titled source folder securely with validation."""
        if not folder_name or not re.match(r"^[\w\s.\-\[\]]+$", folder_name) or ".." in folder_name:
            raise ValueError(f"Invalid or unsafe folder name: {folder_name}")

        base_src = os.path.abspath(self.source_dir)
        src_path = os.path.abspath(os.path.join(base_src, folder_name))
        
        if os.path.commonpath([base_src, src_path]) != base_src:
            raise ValueError(f"Path traversal detected: {folder_name}")

        if os.path.exists(src_path) and os.path.isdir(src_path):
            shutil.rmtree(src_path)
            return 1

        return 0


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

    def extract_clip_screenshot(self, clip_path: str, timestamp: float, output_path: str) -> bool:
        """Backward-compatible delegate: routes to deepened ClipSessionStore."""
        from core.clip_session_store import ClipSessionStore
        store = ClipSessionStore(clips_dir=self.clips_dir, output_dir=self.output_dir, config_store=self.config_store, media_transcoder=self.transcoder)
        store._run_ffmpeg = self._run_ffmpeg
        return store.extract_clip_screenshot(clip_path, timestamp, output_path)




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
            "channel": "Mock Channel",
            "added_at": 1600000000.0,
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

    def delete_cached_video(self, folder_name: str) -> int:
        self.calls.append(("delete_cached_video", folder_name))
        return 1

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

