from abc import ABC, abstractmethod
import os
import sys
import subprocess
import json
import re
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass


@dataclass(frozen=True)
class MediaSpecs:
    """Immutable data DTO representing media container and stream properties."""
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 30.0


class MediaProcessAdapter(ABC):
    """
    Seam for low-level process execution and probing.
    Permits local-substitutability via SubprocessMediaAdapter (prod) and FakeMediaAdapter (test).
    """

    @abstractmethod
    def run_ffmpeg(self, args: List[str]) -> bool:
        """Executes ffmpeg arguments, returning True on success or raising RuntimeError."""
        pass

    @abstractmethod
    def ffprobe_info(self, file_path: str) -> Dict[str, Any]:
        """Inspects media file via ffprobe and returns raw parsed dictionary."""
        pass


class SubprocessMediaAdapter(MediaProcessAdapter):
    """Production adapter executing ffmpeg and ffprobe via OS subprocess."""

    def __init__(self, config_store: Optional[Any] = None):
        self.config_store = config_store
        self._env = os.environ.copy()

        extra_paths = []
        custom_ffmpeg = (
            self.config_store.get("FFMPEG_PATH")
            if self.config_store
            else os.environ.get("FFMPEG_PATH")
        )
        if custom_ffmpeg:
            if os.path.isdir(custom_ffmpeg):
                extra_paths.append(custom_ffmpeg)
            else:
                extra_paths.append(os.path.dirname(custom_ffmpeg))

        if sys.platform.startswith("win"):
            extra_paths.extend([
                "C:\\Program Files\\ffmpeg\\bin",
                "C:\\ffmpeg\\bin",
                "C:\\Program Files\\nodejs"
            ])
        else:
            extra_paths.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"])

        current_path = self._env.get("PATH", "")
        sep = ";" if sys.platform.startswith("win") else ":"

        for p in extra_paths:
            if os.path.exists(p) and p not in current_path.split(sep):
                current_path = f"{p}{sep}{current_path}" if current_path else p

        self._env["PATH"] = current_path

    def run_ffmpeg(self, args: List[str]) -> bool:
        clean_args = list(args)
        if clean_args and clean_args[0] == "ffmpeg":
            clean_args = clean_args[1:]
        cmd = ["ffmpeg"] + clean_args
        print(f"[ffmpeg] Running: {' '.join(cmd)}")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=self._env,
            encoding="utf-8"
        )
        if result.returncode != 0:
            error_msg = result.stderr.strip()[-500:] or f"ffmpeg failed with code {result.returncode}"
            print(f"[ffmpeg] Error: {error_msg}")
            raise RuntimeError(f"FFmpeg Error: {error_msg}")
        return True

    def ffprobe_info(self, file_path: str) -> Dict[str, Any]:
        cmd = [
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path
        ]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=self._env,
            encoding="utf-8"
        )
        if result.returncode != 0:
            return {}
        try:
            return json.loads(result.stdout)
        except Exception:
            return {}


class FakeMediaAdapter(MediaProcessAdapter):
    """
    In-memory fake adapter for lightning-fast testing without spawning OS subprocesses.
    Records executed calls and returns configured or synthetic metadata.
    """

    def __init__(self, default_duration: float = 60.0, default_width: int = 1920, default_height: int = 1080, default_fps: float = 30.0):
        self.default_duration = default_duration
        self.default_width = default_width
        self.default_height = default_height
        self.default_fps = default_fps
        self.calls: List[Tuple[str, Any]] = []
        self.probe_overrides: Dict[str, Dict[str, Any]] = {}
        self.simulate_output_creation: bool = True

    def run_ffmpeg(self, args: List[str]) -> bool:
        self.calls.append(("run_ffmpeg", list(args)))
        # If output path is specified at the end of args, create dummy output file for os.path.exists checks
        if self.simulate_output_creation and args:
            last_arg = args[-1]
            if last_arg and not last_arg.startswith("-") and ("." in os.path.basename(last_arg)):
                try:
                    os.makedirs(os.path.dirname(os.path.abspath(last_arg)), exist_ok=True)
                    if not os.path.exists(last_arg):
                        with open(last_arg, "wb") as f:
                            f.write(b"\xff\xd8\xff\xe0\x00\x10JFIF")  # Minimal JPEG header
                except Exception:
                    pass
        return True

    def ffprobe_info(self, file_path: str) -> Dict[str, Any]:
        self.calls.append(("ffprobe_info", file_path))
        if file_path in self.probe_overrides:
            return self.probe_overrides[file_path]

        return {
            "format": {
                "duration": str(self.default_duration),
                "size": "1048576"
            },
            "streams": [
                {
                    "codec_type": "video",
                    "width": self.default_width,
                    "height": self.default_height,
                    "r_frame_rate": f"{int(self.default_fps)}/1",
                    "duration": str(self.default_duration)
                },
                {
                    "codec_type": "audio",
                    "sample_rate": "44100",
                    "channels": 2
                }
            ]
        }


class MediaTranscoder:
    """
    Deep media transcoding module encapsulating FFmpeg execution, probing,
    screenshot extraction, video cutting, and audio extraction behind a single cohesive seam.
    """

    def __init__(
        self,
        adapter: Optional[MediaProcessAdapter] = None,
        config_store: Optional[Any] = None
    ):
        if adapter is not None:
            self.adapter = adapter
        else:
            self.adapter = SubprocessMediaAdapter(config_store=config_store)
        self.config_store = config_store

    def run_ffmpeg(self, args: List[str]) -> bool:
        """Executes raw FFmpeg argument list with unified error sanitization."""
        return self.adapter.run_ffmpeg(args)

    def probe_video(self, file_path: str) -> MediaSpecs:
        """
        Inspects video file via ffprobe and returns typed MediaSpecs DTO
        containing duration, resolution width/height, and fps.
        """
        if not file_path:
            return MediaSpecs()

        info = self.adapter.ffprobe_info(file_path)
        duration = 0.0
        width = 0
        height = 0
        fps = 30.0

        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                width = int(stream.get("width") or 0)
                height = int(stream.get("height") or 0)
                r_fps = stream.get("r_frame_rate")
                if r_fps and "/" in str(r_fps):
                    try:
                        num, den = str(r_fps).split("/")
                        if float(den) > 0:
                            fps = float(num) / float(den)
                    except Exception:
                        fps = 30.0
                elif r_fps:
                    try:
                        fps = float(r_fps)
                    except Exception:
                        fps = 30.0

                s_dur = stream.get("duration")
                if s_dur:
                    try:
                        duration = float(s_dur)
                    except Exception:
                        pass
                break

        if duration <= 0:
            fmt_dur = info.get("format", {}).get("duration")
            if fmt_dur:
                try:
                    duration = float(fmt_dur)
                except Exception:
                    pass

        return MediaSpecs(
            duration=round(duration, 3),
            width=width,
            height=height,
            fps=round(fps, 2)
        )

    def get_video_duration(self, file_path: str) -> float:
        """Returns video duration in seconds."""
        return self.probe_video(file_path).duration

    def get_video_resolution(self, file_path: str) -> Tuple[int, int]:
        """Returns video resolution as a (width, height) tuple."""
        specs = self.probe_video(file_path)
        return (specs.width, specs.height)

    def extract_frame(
        self,
        video_path: str,
        timestamp: float,
        output_path: str,
        quality: int = 2
    ) -> bool:
        """
        Extracts a single frame from video at timestamp with bounds clamping
        and ensures output directory exists.
        """
        if not video_path or not os.path.exists(video_path):
            return False

        dur = self.get_video_duration(video_path)
        if dur > 0:
            ts = max(0.0, min(float(timestamp), max(0.0, dur - 0.1)))
        else:
            ts = max(0.0, float(timestamp))

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        cmd = [
            "-y",
            "-ss", str(round(ts, 3)),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", str(quality),
            output_path
        ]
        try:
            self.run_ffmpeg(cmd)
            return os.path.exists(output_path)
        except Exception as e:
            print(f"[media_transcoder] Failed to extract frame at {ts}s: {e}")
            return False

    def slice_video(
        self,
        video_path: str,
        start_time: float,
        end_time: float,
        output_path: str
    ) -> bool:
        """
        Accurately cuts video interval [start_time, end_time] using two-pass seek
        and H.264 re-encoding.
        """
        if not video_path or not os.path.exists(video_path):
            raise FileNotFoundError(f"Source video not found: {video_path}")
        if start_time < 0 or end_time <= start_time:
            raise ValueError(f"Invalid clip boundaries: start={start_time}, end={end_time}")

        duration = round(end_time - start_time, 2)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        cmd = [
            "-accurate_seek",
            "-ss", str(start_time),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "superfast",
            "-crf", "23",
            "-c:a", "aac",
            "-avoid_negative_ts", "auto",
            "-y", output_path
        ]
        self.run_ffmpeg(cmd)
        return os.path.exists(output_path)

    def extract_audio(
        self,
        video_path: str,
        output_wav_path: str,
        sample_rate: int = 16000
    ) -> str:
        """
        Extracts high-stability mono PCM WAV audio from video required for speech transcription.
        """
        if not video_path or not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        if os.path.exists(output_wav_path):
            return output_wav_path

        os.makedirs(os.path.dirname(os.path.abspath(output_wav_path)), exist_ok=True)
        self.run_ffmpeg([
            "-i", video_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", str(sample_rate),
            "-ac", "1",
            "-y", output_wav_path
        ])
        return output_wav_path
