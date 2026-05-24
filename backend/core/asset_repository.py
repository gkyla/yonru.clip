import os
import re
import sys
import subprocess
import json
import uuid
import shutil
from core.youtube_client import YouTubeClient

class AssetRepository:
    def __init__(self, output_dir="temp_assets", youtube_client=None, config_store=None):
        self.output_dir = output_dir
        self.source_dir = os.path.join(output_dir, "sources")
        self.clips_dir = os.path.join(output_dir, "clips")
        
        os.makedirs(self.source_dir, exist_ok=True)
        os.makedirs(self.clips_dir, exist_ok=True)
        
        self.cookie_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt"))
        self.client = youtube_client or YouTubeClient(cookie_path=self.cookie_path)
        self.config_store = config_store
        
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
        return s[:50].replace(' ', '_')

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

    def _generate_thumbnail(self, folder_path: str, video_id: str) -> str:
        """Generate a video thumbnail inside the source folder."""
        video_path = os.path.join(folder_path, "full.mp4")
        thumb_path = os.path.join(folder_path, "thumb.jpg")
        
        if os.path.exists(thumb_path):
            return thumb_path
            
        try:
            self._run_ffmpeg(["-ss", "00:00:05", "-i", video_path, "-vframes", "1", "-q:v", "2", "-y", thumb_path])
        except:
            try:
                self._run_ffmpeg(["-i", video_path, "-vframes", "1", "-q:v", "2", "-y", thumb_path])
            except:
                return None
        return thumb_path

    # ── High Leverage Deep Interface Methods ────────────────────────

    def get_cached_video(self, url: str) -> dict:
        """Search sources/ subfolders for the video ID."""
        video_id = self.client.extract_video_id(url)
        if not video_id:
            return None
        
        for entry in os.scandir(self.source_dir):
            if entry.is_dir() and entry.name.endswith(f"_{video_id}"):
                file_path = os.path.join(entry.path, "full.mp4")
                if os.path.exists(file_path):
                    w, h = self.get_video_resolution(file_path)
                    return {
                        "video_id": video_id,
                        "title": entry.name.replace(f"_{video_id}", ""),
                        "duration": self.get_video_duration(file_path),
                        "fps": self._get_video_fps(file_path),
                        "file_path": file_path,
                        "folder_name": entry.name,
                        "asset_url": f"/assets/sources/{entry.name}/full.mp4",
                        "width": w,
                        "height": h,
                        "heatmap": []
                    }
        return None

    def get_cached_video_by_folder(self, folder_name: str) -> dict:
        """Search sources/ subfolders by exact folder name."""
        target_dir = os.path.join(self.source_dir, folder_name)
        if os.path.exists(target_dir) and os.path.isdir(target_dir):
            file_path = os.path.join(target_dir, "full.mp4")
            if os.path.exists(file_path):
                video_id = folder_name.split("_")[-1]
                w, h = self.get_video_resolution(file_path)
                return {
                    "video_id": video_id,
                    "title": folder_name.replace(f"_{video_id}", ""),
                    "duration": self.get_video_duration(file_path),
                    "fps": self._get_video_fps(file_path),
                    "file_path": file_path,
                    "folder_name": folder_name,
                    "asset_url": f"/assets/sources/{folder_name}/full.mp4",
                    "width": w,
                    "height": h,
                    "heatmap": []
                }
        return None

    def get_or_create_source(self, url: str, force_download: bool = False) -> dict:
        """
        Gets metadata of a video by URL, downloading and extracting transcript/audio 
        automatically if not already cached.
        """
        if not force_download:
            cached = self.get_cached_video(url)
            if cached:
                return cached

        # Otherwise, retrieve metadata and download
        info = self.client.get_video_info_fast(url)
        video_id = info["id"]
        safe_title = self._sanitize_filename(info["title"])
        folder_name = f"{safe_title}_{video_id}"
        
        target_dir = os.path.join(self.source_dir, folder_name)
        os.makedirs(target_dir, exist_ok=True)
        
        self.client.download_video(url, target_dir)
        file_path = os.path.join(target_dir, "full.mp4")
        w, h = self.get_video_resolution(file_path)
        
        return {
            "video_id": video_id,
            "title": info["title"],
            "duration": self.get_video_duration(file_path),
            "fps": self._get_video_fps(file_path),
            "file_path": file_path,
            "folder_name": folder_name,
            "asset_url": f"/assets/sources/{folder_name}/full.mp4",
            "width": w,
            "height": h,
            "heatmap": []
        }

    def extract_audio_from_local(self, video_path: str) -> str:
        """Extract high-stability WAV for AI analysis."""
        audio_path = video_path.replace("full.mp4", "audio_v2.wav")
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

    def create_clip(self, video_path: str, start_time: float, end_time: float, theme: str = None) -> dict:
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

    def list_cached_videos(self) -> list:
        """List titled source folders."""
        results = []
        if not os.path.exists(self.source_dir):
            return []
            
        for entry in os.scandir(self.source_dir):
            if entry.is_dir() and len(entry.name) >= 12 and entry.name[-12] == "_":
                video_id = entry.name[-11:]
                file_path = os.path.join(entry.path, "full.mp4")
                if not os.path.exists(file_path):
                    continue
                
                w, h = self.get_video_resolution(file_path)
                thumb_path = self._generate_thumbnail(entry.path, video_id)
                
                results.append({
                    "video_id": video_id,
                    "title": entry.name.replace(f"_{video_id}", "").replace("_", " "),
                    "folder_name": entry.name,
                    "resolution": f"{w}x{h}",
                    "duration": self.get_video_duration(file_path),
                    "asset_url": f"/assets/sources/{entry.name}/full.mp4",
                    "thumbnail_url": f"/assets/sources/{entry.name}/thumb.jpg" if thumb_path else None,
                    "youtube_url": f"https://youtube.com/watch?v={video_id}"
                })
        return results

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
                
                if os.path.exists(video_path) and os.path.exists(transcript_path):
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

    def delete_cached_video(self, folder_name: str) -> int:
        """Delete titled folders in sources and clips securely with validation."""
        if not folder_name or not re.match(r"^[a-zA-Z0-9_.-]+$", folder_name) or ".." in folder_name:
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
        if not folder_name or ".." in folder_name or not re.match(r"^[a-zA-Z0-9_.-]+$", folder_name):
            raise ValueError(f"Invalid folder name: {folder_name}")
        if not clip_id or ".." in clip_id or not re.match(r"^[a-zA-Z0-9_.-]+$", clip_id):
            raise ValueError(f"Invalid clip ID: {clip_id}")

        base_clips = os.path.abspath(self.clips_dir)
        clip_dir = os.path.abspath(os.path.join(base_clips, folder_name, clip_id))
        
        if os.path.commonpath([base_clips, clip_dir]) != base_clips:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        if os.path.exists(clip_dir) and os.path.isdir(clip_dir):
            shutil.rmtree(clip_dir)
            return True
        return False

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
