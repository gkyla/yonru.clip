import copy
import math
import os
import re
import threading
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Tuple
import yt_dlp

class AbstractYouTubeClient(ABC):
    @abstractmethod
    def extract_video_id(self, url: str) -> Optional[str]:
        """Extract YouTube video ID from URL."""
        pass

    @abstractmethod
    def get_video_info_fast(self, url: str) -> dict:
        """Get video title, ID, channel, and duration without downloading."""
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
    def __init__(
        self,
        cookie_path: Optional[str] = None,
        info_cache_ttl_seconds: float = 600.0,
        info_cache_max_entries: int = 32,
        clock: Optional[Callable[[], float]] = None,
    ):
        self.cookie_path = cookie_path
        self._info_cache_ttl = max(0.0, float(info_cache_ttl_seconds))
        self._info_cache_max_entries = max(1, int(info_cache_max_entries))
        self._clock: Callable[[], float] = clock or time.monotonic
        self._info_cache_lock = threading.Lock()
        self._info_cache: OrderedDict[Tuple[str, Optional[str]], Tuple[float, Dict[str, Any]]] = OrderedDict()

    def _resolve_cookiefile(self) -> Optional[str]:
        return self.cookie_path if self.cookie_path and os.path.exists(self.cookie_path) else None

    def _cache_key(self, url: str, cookiefile: Optional[str]) -> Tuple[str, Optional[str]]:
        return (self.extract_video_id(url) or url, cookiefile)

    @staticmethod
    def _parse_duration(value: Any) -> Optional[float]:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        parsed = float(value)
        return parsed if math.isfinite(parsed) and parsed > 0.0 else None

    def _store_cached_ie_result(self, key: Tuple[str, Optional[str]], ie_result: Dict[str, Any]) -> None:
        """Cache a deep copy of raw yt-dlp extraction data because process_ie_result mutates dicts in place."""
        snapshot = copy.deepcopy(ie_result)
        now = self._clock()
        with self._info_cache_lock:
            self._info_cache[key] = (now, snapshot)
            self._info_cache.move_to_end(key)
            while len(self._info_cache) > self._info_cache_max_entries:
                self._info_cache.popitem(last=False)

    def _get_cached_ie_result(self, url: str, cookiefile: Optional[str]) -> Optional[Dict[str, Any]]:
        key = self._cache_key(url, cookiefile)
        with self._info_cache_lock:
            cached = self._info_cache.get(key)
            if cached is None:
                return None
            stored_at, raw_ie = cached
            if (self._clock() - stored_at) > self._info_cache_ttl:
                self._info_cache.pop(key, None)
                return None
            self._info_cache.move_to_end(key)
            return copy.deepcopy(raw_ie)

    def _evict_cached_ie_result(self, url: str, cookiefile: Optional[str]) -> None:
        key = self._cache_key(url, cookiefile)
        with self._info_cache_lock:
            removed = self._info_cache.pop(key, None)
            if removed is None:
                return
            resolved_id = removed[1].get("id")
            if isinstance(resolved_id, str) and resolved_id:
                stale_keys = [
                    k for k, (_, payload) in self._info_cache.items()
                    if k[1] == cookiefile and (k[0] == resolved_id or payload.get("id") == resolved_id)
                ]
                for stale_key in stale_keys:
                    self._info_cache.pop(stale_key, None)

    def _empty_video_info(self, url: str) -> dict:
        return {
            "title": "Unknown",
            "id": self.extract_video_id(url),
            "channel": "Unknown Channel",
            "duration": None,
        }

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
        """Get video title, ID, channel, and duration without downloading, caching raw extraction for download reuse."""
        cookiefile = self._resolve_cookiefile()
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'cookiefile': cookiefile,
        }
        opts: Any = ydl_opts
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl_any: Any = ydl
            try:
                raw_info: Any = ydl_any.extract_info(url, download=False, process=False)
                if not isinstance(raw_info, dict):
                    return self._empty_video_info(url)

                if raw_info.get("_type") in (None, "video"):
                    info: Dict[str, Any] = raw_info
                    formats = raw_info.get("formats")
                    if isinstance(formats, list) and len(formats) > 0:
                        primary_key = self._cache_key(url, cookiefile)
                        self._store_cached_ie_result(primary_key, info)
                        resolved_id = raw_info.get("id")
                        if isinstance(resolved_id, str) and resolved_id and resolved_id != primary_key[0]:
                            self._store_cached_ie_result((resolved_id, cookiefile), info)
                else:
                    resolved = ydl_any.process_ie_result(raw_info, download=False)
                    info = resolved if isinstance(resolved, dict) else {}

                channel = info.get("channel") or info.get("uploader") or "Unknown Channel"
                return {
                    "title": info.get("title", "Unknown"),
                    "id": info.get("id") or self.extract_video_id(url),
                    "channel": channel,
                    "duration": self._parse_duration(info.get("duration")),
                }
            except Exception as e:
                print(f"[youtube-client] Info Extraction Error: {e}")
                return self._empty_video_info(url)

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

            raw_captions = []
            for s in segments:
                if isinstance(s, dict):
                    text = s.get("text", "").replace("\n", " ").strip()
                    start = float(s.get("start", 0.0) or 0.0)
                    duration = max(0.0, float(s.get("duration", 0.0) or 0.0))
                else:
                    text = getattr(s, "text", "").replace("\n", " ").strip()
                    start = float(getattr(s, "start", 0.0) or 0.0)
                    duration = max(0.0, float(getattr(s, "duration", 0.0) or 0.0))

                words = text.split()
                if not words:
                    continue
                raw_captions.append((start, duration, words))

            word_level = []
            cursor = 0.0
            for idx, (raw_start, raw_dur, words) in enumerate(raw_captions):
                eff_start = max(cursor, raw_start)
                raw_end = max(eff_start, raw_start + raw_dur)
                if idx + 1 < len(raw_captions):
                    next_start = raw_captions[idx + 1][0]
                    eff_end = min(raw_end, next_start) if next_start >= eff_start else eff_start
                else:
                    eff_end = raw_end

                word_dur = (eff_end - eff_start) / len(words)
                for i, w in enumerate(words):
                    word_level.append({
                        "start": eff_start + (i * word_dur),
                        "duration": word_dur,
                        "text": w,
                    })
                cursor = eff_end

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

        cookiefile = self._resolve_cookiefile()
        ydl_opts = {
            'format': format_spec,
            'merge_output_format': 'mp4',
            'outtmpl': os.path.join(target_dir, f"{filename_prefix}.%(ext)s"),
            'cookiefile': cookiefile,
            'quiet': False,
            'noplaylist': True,
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

        cached_ie = self._get_cached_ie_result(url, cookiefile)
        opts: Any = ydl_opts
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl_any: Any = ydl
            if cached_ie is not None:
                try:
                    ydl_any.process_ie_result(cached_ie, download=True)
                    return
                except Exception as cache_err:
                    print(f"[youtube-client] Cached extraction replay failed, re-extracting: {cache_err}")
                    self._evict_cached_ie_result(url, cookiefile)

            try:
                ydl_any.download([url])
            except Exception as e:
                print(f"[youtube-client] Download Error: {e}")
                raise RuntimeError(f"YouTube Download Error: {e}")


class MockYouTubeClient(AbstractYouTubeClient):
    def __init__(self, mock_info: Optional[dict] = None, mock_transcript: Optional[list] = None):
        self.mock_info = mock_info or {"title": "Mock Video", "id": "mock_id_123", "channel": "Mock Channel"}
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
            "id": self.mock_info.get("id", self.extract_video_id(url)),
            "channel": self.mock_info.get("channel", "Mock Channel"),
            "duration": self.mock_info.get("duration"),
        }

    def fetch_transcript(self, video_id: str) -> list:
        return self.mock_transcript

    def download_video(self, url: str, target_dir: str, quality: str = "1080p", progress_callback = None) -> None:
        self.downloaded_urls.append(url)
        self.downloaded_dirs.append(target_dir)
        if progress_callback:
            progress_callback(50.0)
            progress_callback(100.0)
