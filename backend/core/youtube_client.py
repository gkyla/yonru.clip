import os
import re
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
import yt_dlp

class AbstractYouTubeClient(ABC):
    @abstractmethod
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from URL."""
        pass

    @abstractmethod
    def get_video_info_fast(self, url: str) -> dict:
        """Get video title and ID without downloading."""
        pass

    @abstractmethod
    def fetch_transcript(self, video_id: str) -> list:
        """Fetch transcript and segment into snappy word-level structure."""
        pass

    @abstractmethod
    def download_video(self, url: str, target_dir: str, quality: str = "1080p", progress_callback = None) -> None:
        """Download video at the requested quality (1080p or 360p) into target directory."""
        pass


class YouTubeClient(AbstractYouTubeClient):
    def __init__(self, cookie_path: Optional[str] = None):
        self.cookie_path = cookie_path

    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from URL."""
        patterns = [
            r'(?:v=|/v/|youtu\.be/)([a-zA-Z0-9_-]{11})',
            r'(?:embed/)([a-zA-Z0-9_-]{11})',
            r'(?:shorts/)([a-zA-Z0-9_-]{11})',
        ]
        for p in patterns:
            m = re.search(p, url)
            if m:
                return m.group(1)
        return None

    def get_video_info_fast(self, url: str) -> dict:
        """Get video title and ID without downloading."""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'cookiefile': self.cookie_path if self.cookie_path and os.path.exists(self.cookie_path) else None,
        }
        opts: Any = ydl_opts
        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                return {
                    "title": info.get("title", "Unknown"),
                    "id": info.get("id", self.extract_video_id(url))
                }
            except Exception as e:
                print(f"[youtube-client] Info Extraction Error: {e}")
                return {"title": "Unknown", "id": self.extract_video_id(url)}

    def fetch_transcript(self, video_id: str) -> list:
        """Fetch transcript and segment into snappy word-level structure."""
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            ytt = YouTubeTranscriptApi()
            transcript_list = ytt.list(video_id)
            
            try:
                # Try to find Indonesian specific first
                transcript = transcript_list.find_transcript(['id'])
            except:
                try:
                    # Fallback to English
                    transcript = transcript_list.find_transcript(['en', 'en-US'])
                except:
                    # Final fallback: first available
                    transcript = next(iter(transcript_list))
            
            segments = transcript.fetch()
            
            word_level = []
            for s in segments:
                if isinstance(s, dict):
                    text = s.get("text", "").replace("\n", " ").strip()
                    start = s.get("start", 0)
                    duration = s.get("duration", 0)
                else:
                    text = getattr(s, 'text', "").replace("\n", " ").strip()
                    start = getattr(s, 'start', 0)
                    duration = getattr(s, 'duration', 0)

                words = text.split()
                if not words: continue
                
                word_dur = duration / len(words)
                for i, w in enumerate(words):
                    word_level.append({
                        "start": start + (i * word_dur),
                        "duration": word_dur,
                        "text": w
                    })

            print(f"[youtube-client] Successfully word-split '{transcript.language}' transcript ({len(word_level)} words)")
            return word_level
        except Exception as e:
            print(f"[youtube-client] Transcript error: {e}")
            return []

    def download_video(self, url: str, target_dir: str, quality: str = "1080p", progress_callback = None) -> None:
        """Download video at requested quality (1080p or 360p) with optional progress reporting."""
        filename_prefix = "preview" if quality == "360p" else "full"
        
        # 18 is 360p mp4 video+audio single stream. If unavailable, fall back.
        if quality == "360p":
            format_spec = "18/bestvideo[height<=360]+bestaudio/best[height<=360]"
        else:
            format_spec = "bestvideo[height=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height=1080]+bestaudio/best"

        ydl_opts = {
            'format': format_spec,
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(target_dir, f"{filename_prefix}.%(ext)s"),
            'cookiefile': self.cookie_path if self.cookie_path and os.path.exists(self.cookie_path) else None,
            'quiet': False,
            'no_playlist': True,
        }

        if progress_callback:
            # yt-dlp downloads video and audio as separate streams for bestvideo+bestaudio
            # formats, firing progress_hooks independently for each. Track stream transitions
            # to report a single smooth 0→99% to the caller (100% is set on completion).
            stream_state = {'current_file': None, 'stream_index': 0}

            def hook(d):
                if d.get('status') == 'downloading':
                    filename = d.get('filename', '')
                    total = d.get('total_bytes') or d.get('total_bytes_estimate')
                    downloaded = d.get('downloaded_bytes', 0)

                    # Detect stream transitions (e.g. video → audio)
                    if filename != stream_state['current_file']:
                        if stream_state['current_file'] is not None:
                            stream_state['stream_index'] += 1
                        stream_state['current_file'] = filename

                    if total:
                        stream_percent = (downloaded / total) * 100
                        idx = stream_state['stream_index']

                        if idx == 0:
                            # First stream (video): maps to 0–90%
                            overall = stream_percent * 0.9
                        else:
                            # Subsequent streams (audio): maps to 90–99%
                            overall = 90.0 + (stream_percent * 0.09)

                        try:
                            progress_callback(min(overall, 99.0))
                        except Exception as pe:
                            print(f"[youtube-client] Progress callback error: {pe}")
            ydl_opts['progress_hooks'] = [hook]

        opts: Any = ydl_opts
        with yt_dlp.YoutubeDL(opts) as ydl:
            try:
                ydl.download([url])
            except Exception as e:
                print(f"[youtube-client] Download Error: {e}")
                raise RuntimeError(f"YouTube Download Error: {e}")


class MockYouTubeClient(AbstractYouTubeClient):
    def __init__(self, mock_info: Optional[dict] = None, mock_transcript: Optional[list] = None):
        self.mock_info = mock_info or {"title": "Mock Video", "id": "mock_id_123"}
        self.mock_transcript = mock_transcript or []
        self.downloaded_urls = []
        self.downloaded_dirs = []

    def extract_video_id(self, url: str) -> Optional[str]:
        if "watch?v=" in url:
            return url.split("watch?v=")[-1][:11]
        elif "youtu.be/" in url:
            return url.split("youtu.be/")[-1][:11]
        return "mock_id_123"

    def get_video_info_fast(self, url: str) -> dict:
        return {
            "title": self.mock_info.get("title", "Mock Video"),
            "id": self.mock_info.get("id", self.extract_video_id(url))
        }

    def fetch_transcript(self, video_id: str) -> list:
        return self.mock_transcript

    def download_video(self, url: str, target_dir: str, quality: str = "1080p", progress_callback = None) -> None:
        self.downloaded_urls.append(url)
        self.downloaded_dirs.append(target_dir)
        if progress_callback:
            progress_callback(50.0)
            progress_callback(100.0)
