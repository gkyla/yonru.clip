from abc import ABC, abstractmethod
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
import math
import os
import platform
import shutil
import sys
import subprocess
import threading
import json
from typing import Optional, Dict, Any, List, Tuple, Callable, Set, Sequence, Union
from dataclasses import dataclass

from core.hardware_profiler import (
    CPUMetrics,
    GPUMetrics,
    HardwareProfiler,
    HostHardwareMetrics,
)


@dataclass(frozen=True)
class MediaSpecs:
    """Immutable data DTO representing media container and stream properties."""
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 30.0


@dataclass(frozen=True)
class FrameExtractionRequest:
    """Immutable specification for extracting a single video frame to disk."""
    timestamp: float
    output_path: str


@dataclass(frozen=True)
class VideoEncoderSpec:
    """Immutable specification describing an H.264 encoder and its FFmpeg flags."""
    codec: str
    args: Tuple[str, ...]
    is_hardware: bool = False


@dataclass(frozen=True)
class ClipExtractionResult:
    """Result DTO returned by single-pass clip media extraction."""
    video_path: str
    thumbnail_path: Optional[str] = None
    audio_path: Optional[str] = None
    encoder: str = "libx264"


SOFTWARE_H264_ENCODER = VideoEncoderSpec(
    codec="libx264",
    args=("-c:v", "libx264", "-preset", "superfast", "-crf", "23", "-bf", "0", "-pix_fmt", "yuv420p"),
    is_hardware=False,
)

VIDEOTOOLBOX_H264_ENCODER = VideoEncoderSpec(
    codec="h264_videotoolbox",
    args=("-c:v", "h264_videotoolbox", "-q:v", "65", "-bf", "0", "-pix_fmt", "yuv420p"),
    is_hardware=True,
)

NVENC_H264_ENCODER = VideoEncoderSpec(
    codec="h264_nvenc",
    args=("-c:v", "h264_nvenc", "-preset", "p4", "-cq", "23", "-pix_fmt", "yuv420p"),
    is_hardware=True,
)

_HARDWARE_DISABLE_TOKENS = frozenset({"disable", "false", "0", "off", "software", "libx264"})
_VIDEOTOOLBOX_OVERRIDE_TOKENS = frozenset({"videotoolbox", "h264_videotoolbox"})
_NVENC_OVERRIDE_TOKENS = frozenset({"nvenc", "h264_nvenc"})
_HARDWARE_FORCE_TOKENS = frozenset({"force", "hardware", "require", "required"})
_MISSING_AUDIO_STREAM_ERROR_TOKENS = (
    "matches no streams",
    "does not contain any stream",
)


def _is_missing_audio_stream_error(message: str) -> bool:
    lowered = (message or "").lower()
    return any(token in lowered for token in _MISSING_AUDIO_STREAM_ERROR_TOKENS)


def resolve_video_encoder(
    metrics: HostHardwareMetrics,
    *,
    hardware_acceleration_override: Optional[str] = None,
) -> VideoEncoderSpec:
    """
    Pick the fastest reliable H.264 encoder for standalone clip cutting.

    On Apple Silicon Macs, multicore NEON libx264 with B-frames disabled (-bf 0)
    is faster than Apple's single Media Engine h264_videotoolbox, so it is used by
    default unless the user opts in via FFMPEG_HARDWARE_ACCELERATION=videotoolbox.
    """
    raw_override = (hardware_acceleration_override or "").strip().lower()
    system_os = (metrics.cpu.system_os or "").strip().lower()
    cpu_arch = (metrics.cpu.arch or "").strip().lower()
    gpu_type = (metrics.gpu.type or "").strip().lower()
    is_apple_silicon = gpu_type == "apple_silicon" or (
        system_os == "darwin" and cpu_arch in {"arm64", "aarch64"}
    )

    if raw_override in _HARDWARE_DISABLE_TOKENS:
        return SOFTWARE_H264_ENCODER
    if raw_override in _VIDEOTOOLBOX_OVERRIDE_TOKENS:
        return VIDEOTOOLBOX_H264_ENCODER
    if raw_override in _NVENC_OVERRIDE_TOKENS:
        return NVENC_H264_ENCODER
    if raw_override in _HARDWARE_FORCE_TOKENS:
        if system_os == "darwin":
            return VIDEOTOOLBOX_H264_ENCODER
        if gpu_type == "cuda":
            return NVENC_H264_ENCODER
        return SOFTWARE_H264_ENCODER

    if gpu_type == "cuda":
        return NVENC_H264_ENCODER
    if system_os == "darwin" and not is_apple_silicon:
        return VIDEOTOOLBOX_H264_ENCODER

    return SOFTWARE_H264_ENCODER


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

    def resolve_ffmpeg_path(self) -> Optional[str]:
        """Resolve an available ffmpeg executable path, or return None if unavailable."""
        return None


class SubprocessMediaAdapter(MediaProcessAdapter):
    """Production adapter executing ffmpeg and ffprobe via OS subprocess."""

    def __init__(self, config_store: Optional[Any] = None):
        self.config_store = config_store
        self._env = self._build_env()

    def _build_env(self) -> Dict[str, str]:
        env = os.environ.copy()
        extra_paths: List[str] = []
        custom_ffmpeg = (
            self.config_store.get("FFMPEG_PATH")
            if self.config_store is not None
            else os.environ.get("FFMPEG_PATH")
        )
        if custom_ffmpeg and str(custom_ffmpeg).strip():
            expanded = os.path.expanduser(str(custom_ffmpeg).strip())
            if os.path.isdir(expanded):
                extra_paths.append(expanded)
            else:
                parent = os.path.dirname(expanded)
                if parent:
                    extra_paths.append(parent)

        if sys.platform.startswith("win"):
            extra_paths.extend([
                "C:\\Program Files\\ffmpeg\\bin",
                "C:\\ffmpeg\\bin",
                "C:\\Program Files\\nodejs",
            ])
        else:
            extra_paths.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"])

        current_path = env.get("PATH", "")
        sep = ";" if sys.platform.startswith("win") else ":"
        for p in extra_paths:
            if p and os.path.exists(p) and p not in current_path.split(sep):
                current_path = f"{p}{sep}{current_path}" if current_path else p

        env["PATH"] = current_path
        return env

    def resolve_ffmpeg_path(self) -> Optional[str]:
        custom_ffmpeg = (
            self.config_store.get("FFMPEG_PATH")
            if self.config_store is not None
            else os.environ.get("FFMPEG_PATH")
        ) or ""
        custom_ffmpeg = str(custom_ffmpeg).strip()
        if custom_ffmpeg:
            expanded = os.path.expanduser(custom_ffmpeg)
            if os.path.isfile(expanded):
                return expanded
            if os.path.isdir(expanded):
                for name in ("ffmpeg.exe", "ffmpeg"):
                    candidate = os.path.join(expanded, name)
                    if os.path.isfile(candidate):
                        return candidate

        env = self._build_env() if self.config_store is not None else self._env
        return shutil.which("ffmpeg", path=env.get("PATH", ""))

    def run_ffmpeg(self, args: List[str]) -> bool:
        clean_args = list(args)
        if clean_args and clean_args[0] == "ffmpeg":
            clean_args = clean_args[1:]
        cmd = ["ffmpeg"] + clean_args
        print(f"[ffmpeg] Running: {' '.join(cmd)}")
        env = self._build_env() if self.config_store is not None else self._env
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
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
        env = self._build_env() if self.config_store is not None else self._env
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env,
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

    def __init__(
        self,
        default_duration: float = 60.0,
        default_width: int = 1920,
        default_height: int = 1080,
        default_fps: float = 30.0,
        ffmpeg_available: bool = True,
        ffmpeg_path: str = "/fake/bin/ffmpeg",
        fail_codecs: Optional[Set[str]] = None,
        ffmpeg_side_effect: Optional[Callable[[List[str]], None]] = None,
    ):
        self.default_duration = default_duration
        self.default_width = default_width
        self.default_height = default_height
        self.default_fps = default_fps
        self.ffmpeg_available = ffmpeg_available
        self.ffmpeg_path = ffmpeg_path
        self._lock = threading.Lock()
        self.calls: List[Tuple[str, Any]] = []
        self.probe_overrides: Dict[str, Dict[str, Any]] = {}
        self.simulate_output_creation: bool = True
        self.fail_codecs: Set[str] = set(fail_codecs or ())
        self.ffmpeg_side_effect = ffmpeg_side_effect

    _FFMPEG_BOOL_FLAGS = frozenset({
        "-y", "-n", "-vn", "-an", "-sn", "-dn", "-accurate_seek", "-nostdin", "-stats",
    })

    @classmethod
    def _extract_output_paths(cls, args: List[str]) -> List[str]:
        """Collect all output file paths from single- or multi-output FFmpeg arguments."""
        outputs: List[str] = []
        idx = 1 if (args and args[0] == "ffmpeg") else 0
        while idx < len(args):
            token = args[idx]
            if token in cls._FFMPEG_BOOL_FLAGS:
                idx += 1
            elif token.startswith("-"):
                idx += 2
            else:
                if token and "." in os.path.basename(token):
                    outputs.append(token)
                idx += 1
        return outputs

    def resolve_ffmpeg_path(self) -> Optional[str]:
        return self.ffmpeg_path if self.ffmpeg_available else None

    def run_ffmpeg(self, args: List[str]) -> bool:
        with self._lock:
            self.calls.append(("run_ffmpeg", list(args)))
        if self.ffmpeg_side_effect is not None:
            self.ffmpeg_side_effect(list(args))

        if self.fail_codecs:
            for idx, token in enumerate(args):
                if token in {"-c:v", "-vcodec"} and idx + 1 < len(args):
                    codec = args[idx + 1]
                    if codec in self.fail_codecs:
                        raise RuntimeError(f"FFmpeg Error: simulated hardware encoder failure for {codec}")

        # Create dummy files for every output path in single- or multi-output invocations
        if self.simulate_output_creation and args:
            with self._lock:
                for out_path in self._extract_output_paths(args):
                    try:
                        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                        if not os.path.exists(out_path):
                            ext = os.path.splitext(out_path)[1].lower()
                            payload = (
                                b"\xff\xd8\xff\xe0\x00\x10JFIF"
                                if ext in {".jpg", ".jpeg"}
                                else b"mock-media-output"
                            )
                            with open(out_path, "wb") as f:
                                f.write(payload)
                    except Exception:
                        pass
        return True

    def ffprobe_info(self, file_path: str) -> Dict[str, Any]:
        with self._lock:
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

    _PROBE_CACHE_MAX_SIZE = 2048

    def __init__(
        self,
        adapter: Optional[MediaProcessAdapter] = None,
        config_store: Optional[Any] = None,
        hardware_profiler: Optional[HardwareProfiler] = None,
    ):
        if adapter is not None:
            self.adapter = adapter
        else:
            self.adapter = SubprocessMediaAdapter(config_store=config_store)
        self.config_store = config_store
        self.hardware_profiler = hardware_profiler
        self._hardware_metrics_lock = threading.Lock()
        self._cached_hardware_metrics: Optional[HostHardwareMetrics] = None
        self._probe_lock = threading.RLock()
        self._probe_cache: OrderedDict[Tuple[str, int, int], MediaSpecs] = OrderedDict()

    def _get_config_value(self, key: str) -> Optional[str]:
        raw = self.config_store.get(key) if self.config_store is not None else os.environ.get(key)
        if raw is None:
            return None
        val = str(raw).strip()
        return val or None

    def _get_hardware_metrics(self) -> HostHardwareMetrics:
        with self._hardware_metrics_lock:
            if self._cached_hardware_metrics is not None:
                return self._cached_hardware_metrics

            if self.hardware_profiler is not None:
                profiler: Optional[HardwareProfiler] = self.hardware_profiler
            elif isinstance(self.adapter, SubprocessMediaAdapter):
                profiler = HardwareProfiler()
            else:
                # Non-subprocess test adapters default to CPU unless a profiler is injected.
                profiler = None

            if profiler is not None:
                try:
                    metrics = profiler.metrics_source.probe_metrics()
                except Exception:
                    metrics = HostHardwareMetrics(
                        cpu=CPUMetrics(
                            brand="unknown",
                            arch=platform.machine().lower() or "unknown",
                            cores=os.cpu_count() or 4,
                            system_os="Darwin" if sys.platform == "darwin" else ("Windows" if sys.platform == "win32" else "Linux"),
                        ),
                        total_ram_gb=8.0,
                        gpu=GPUMetrics(type="cpu", name="Fallback CPU", vram_gb=None),
                    )
            else:
                metrics = HostHardwareMetrics(
                    cpu=CPUMetrics(
                        brand="cpu",
                        arch="generic",
                        cores=os.cpu_count() or 4,
                        system_os="Linux",
                    ),
                    total_ram_gb=8.0,
                    gpu=GPUMetrics(type="cpu", name="Software CPU", vram_gb=None),
                )

            self._cached_hardware_metrics = metrics
            return metrics

    def _resolve_video_encoder(self) -> VideoEncoderSpec:
        return resolve_video_encoder(
            self._get_hardware_metrics(),
            hardware_acceleration_override=self._get_config_value("FFMPEG_HARDWARE_ACCELERATION"),
        )

    def invalidate_probe_cache(self, file_path: Optional[str] = None) -> None:
        """Invalidate cached probe results for one path or clear the entire cache."""
        with self._probe_lock:
            if file_path is None:
                self._probe_cache.clear()
                return
            abs_path = os.path.abspath(file_path)
            stale_keys = [k for k in self._probe_cache if k[0] == abs_path]
            for k in stale_keys:
                del self._probe_cache[k]

    def seed_probe_cache(
        self,
        file_path: str,
        specs: MediaSpecs,
        *,
        mtime_ns: Optional[int] = None,
        size: Optional[int] = None,
    ) -> None:
        """Seed the in-memory probe cache from persisted fingerprinted MediaSpecs."""
        if not file_path:
            return
        if mtime_ns is None or size is None:
            try:
                st = os.stat(file_path)
                mtime_ns = st.st_mtime_ns
                size = st.st_size
            except OSError:
                return

        cache_key = (os.path.abspath(file_path), int(mtime_ns), int(size))
        with self._probe_lock:
            self._probe_cache[cache_key] = specs
            self._probe_cache.move_to_end(cache_key)
            while len(self._probe_cache) > self._PROBE_CACHE_MAX_SIZE:
                self._probe_cache.popitem(last=False)

    @staticmethod
    def _parse_fps(raw_fps: Any) -> Optional[float]:
        """Parse an ffprobe rational or numeric frame-rate value."""
        if not raw_fps:
            return None
        fps_str = str(raw_fps).strip()
        if "/" in fps_str:
            try:
                num_s, den_s = fps_str.split("/", 1)
                den = float(den_s)
                if den > 0:
                    val = float(num_s) / den
                    return val if val > 0 else None
            except Exception:
                return None
            return None
        try:
            val = float(fps_str)
            return val if val > 0 else None
        except Exception:
            return None

    def run_ffmpeg(self, args: List[str]) -> bool:
        """Executes raw FFmpeg argument list with unified error sanitization."""
        return self.adapter.run_ffmpeg(args)

    def resolve_ffmpeg_path(self) -> Optional[str]:
        """Resolve an available FFmpeg binary path via the configured process adapter."""
        return self.adapter.resolve_ffmpeg_path()

    def is_ffmpeg_available(self) -> bool:
        """Return True if an FFmpeg binary can be resolved for rendering or transcoding."""
        return bool(self.resolve_ffmpeg_path())

    def probe_video(self, file_path: str) -> MediaSpecs:
        """
        Inspects video file via ffprobe and returns typed MediaSpecs DTO
        containing duration, resolution width/height, and fps.
        Caches results in memory keyed by (abspath, mtime_ns, size) when stat succeeds.
        """
        if not file_path:
            return MediaSpecs()

        cache_key: Optional[Tuple[str, int, int]] = None
        try:
            st = os.stat(file_path)
            cache_key = (os.path.abspath(file_path), st.st_mtime_ns, st.st_size)
        except OSError:
            cache_key = None

        if cache_key is not None:
            with self._probe_lock:
                cached = self._probe_cache.get(cache_key)
                if cached is not None:
                    self._probe_cache.move_to_end(cache_key)
                    return cached

        info = self.adapter.ffprobe_info(file_path)
        duration = 0.0
        width = 0
        height = 0
        fps = 30.0

        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video":
                width = int(stream.get("width") or 0)
                height = int(stream.get("height") or 0)
                parsed_fps = (
                    self._parse_fps(stream.get("r_frame_rate"))
                    or self._parse_fps(stream.get("avg_frame_rate"))
                )
                if parsed_fps is not None:
                    fps = parsed_fps

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

        specs = MediaSpecs(
            duration=round(duration, 3),
            width=width,
            height=height,
            fps=round(fps, 2)
        )

        if cache_key is not None:
            with self._probe_lock:
                self._probe_cache[cache_key] = specs
                self._probe_cache.move_to_end(cache_key)
                while len(self._probe_cache) > self._PROBE_CACHE_MAX_SIZE:
                    self._probe_cache.popitem(last=False)

        return specs

    def get_video_duration(self, file_path: str) -> float:
        """Returns video duration in seconds."""
        return self.probe_video(file_path).duration

    def get_video_resolution(self, file_path: str) -> Tuple[int, int]:
        """Returns video resolution as a (width, height) tuple."""
        specs = self.probe_video(file_path)
        return (specs.width, specs.height)

    @staticmethod
    def _clamp_frame_timestamp(requested_ts: float, duration: float) -> float:
        """Clamp requested frame timestamp inside valid video duration bounds."""
        if requested_ts <= 0.0:
            return 0.0
        if duration > 0.0:
            return max(0.0, min(requested_ts, max(0.0, duration - 0.1)))
        return max(0.0, requested_ts)

    @staticmethod
    def _build_extract_frame_cmd(
        video_path: str,
        clamped_ts: float,
        output_path: str,
        quality: int,
    ) -> List[str]:
        """Build fast input-seek FFmpeg arguments for single-frame JPEG extraction."""
        return [
            "-y",
            "-ss", str(round(clamped_ts, 3)),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", str(quality),
            output_path,
        ]

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

        requested_ts = float(timestamp)
        # Frame 0 never needs an ffprobe duration lookup.
        dur = 0.0 if requested_ts <= 0.0 else self.get_video_duration(video_path)
        ts = self._clamp_frame_timestamp(requested_ts, dur)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        cmd = self._build_extract_frame_cmd(video_path, ts, output_path, quality)
        try:
            self.run_ffmpeg(cmd)
            return os.path.exists(output_path)
        except Exception as e:
            print(f"[media_transcoder] Failed to extract frame at {ts}s: {e}")
            return False

    def extract_frames(
        self,
        video_path: str,
        requests: Sequence[Union[FrameExtractionRequest, Tuple[float, str]]],
        *,
        quality: int = 2,
        video_duration: Optional[float] = None,
        overwrite: bool = False,
        max_workers: Optional[int] = None,
    ) -> Dict[str, bool]:
        """
        Batch-extract multiple frames with single duration clamping, target deduplication,
        skip-if-exists optimization, and bounded parallel FFmpeg execution.
        """
        normalized: List[Tuple[float, str]] = []
        for req in requests:
            if isinstance(req, FrameExtractionRequest):
                normalized.append((float(req.timestamp), str(req.output_path)))
            else:
                normalized.append((float(req[0]), str(req[1])))

        if not normalized:
            return {}

        if not video_path or not os.path.exists(video_path):
            return {out_path: False for _, out_path in normalized}

        abs_to_caller_keys: Dict[str, List[str]] = {}
        seen_abs: Set[str] = set()
        abs_results: Dict[str, bool] = {}
        pending: List[Tuple[float, str, str]] = []

        for req_ts, out_path in normalized:
            abs_out = os.path.abspath(out_path)
            abs_to_caller_keys.setdefault(abs_out, []).append(out_path)
            if abs_out in seen_abs:
                continue
            seen_abs.add(abs_out)
            if not overwrite and os.path.exists(abs_out):
                abs_results[abs_out] = True
            else:
                pending.append((req_ts, abs_out, out_path))

        if pending:
            dur = 0.0
            if video_duration is not None:
                try:
                    parsed_dur = float(video_duration)
                    if math.isfinite(parsed_dur) and parsed_dur > 0.0:
                        dur = parsed_dur
                except (TypeError, ValueError):
                    dur = 0.0
            if dur <= 0.0 and any(ts > 0.0 for ts, _, _ in pending):
                dur = self.get_video_duration(video_path)

            tasks: List[Tuple[float, str, str]] = []
            parent_dirs: Set[str] = set()
            for req_ts, abs_out, target_path in pending:
                clamped_ts = self._clamp_frame_timestamp(req_ts, dur)
                parent_dirs.add(os.path.dirname(abs_out))
                tasks.append((clamped_ts, abs_out, target_path))

            for parent_dir in parent_dirs:
                if parent_dir:
                    os.makedirs(parent_dir, exist_ok=True)

            def _extract_one(task: Tuple[float, str, str]) -> Tuple[str, bool]:
                clamped_ts, abs_out_path, target_path = task
                cmd = self._build_extract_frame_cmd(video_path, clamped_ts, target_path, quality)
                try:
                    self.run_ffmpeg(cmd)
                    return abs_out_path, os.path.exists(abs_out_path)
                except Exception as e:
                    print(f"[media_transcoder] Failed to extract frame at {clamped_ts}s: {e}")
                    return abs_out_path, False

            default_workers = min(4, os.cpu_count() or 1)
            requested_workers = (
                int(max_workers)
                if (max_workers is not None and max_workers > 0)
                else default_workers
            )
            workers = max(1, min(len(tasks), requested_workers))

            if workers == 1 or len(tasks) == 1:
                for task in tasks:
                    abs_out_path, ok = _extract_one(task)
                    abs_results[abs_out_path] = ok
            else:
                with ThreadPoolExecutor(max_workers=workers) as executor:
                    for abs_out_path, ok in executor.map(_extract_one, tasks):
                        abs_results[abs_out_path] = ok

        return {
            caller_key: abs_results.get(abs_out, False)
            for abs_out, keys in abs_to_caller_keys.items()
            for caller_key in keys
        }

    def capture_screenshot(
        self,
        video_path: str,
        timestamp: float,
        output_path: str,
        quality: int = 2
    ) -> bool:
        """Convenience alias for extract_frame."""
        return self.extract_frame(video_path, timestamp, output_path, quality)

    @staticmethod
    def _build_clip_bundle_cmd(
        video_path: str,
        start_time: float,
        duration: float,
        output_video_path: str,
        encoder: VideoEncoderSpec,
        *,
        output_thumbnail_path: Optional[str] = None,
        output_audio_path: Optional[str] = None,
        thumbnail_quality: int = 2,
        audio_sample_rate: int = 16000,
    ) -> List[str]:
        cmd = [
            "-y",
            "-accurate_seek",
            "-ss", str(start_time),
            "-i", video_path,
            "-map", "0:v:0",
            "-map", "0:a?",
            "-t", str(duration),
            *encoder.args,
            "-c:a", "aac",
            "-avoid_negative_ts", "auto",
            "-movflags", "+faststart",
            output_video_path,
        ]
        if output_thumbnail_path:
            cmd.extend([
                "-map", "0:v:0",
                "-frames:v", "1",
                "-q:v", str(thumbnail_quality),
                "-update", "1",
                output_thumbnail_path,
            ])
        if output_audio_path:
            cmd.extend([
                "-map", "0:a:0",
                "-t", str(duration),
                "-vn",
                "-acodec", "pcm_s16le",
                "-ar", str(audio_sample_rate),
                "-ac", "1",
                output_audio_path,
            ])
        return cmd

    @staticmethod
    def _cleanup_partial_outputs(paths: List[Optional[str]]) -> None:
        for path in paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

    def extract_clip_bundle(
        self,
        video_path: str,
        start_time: float,
        end_time: float,
        output_video_path: str,
        *,
        output_thumbnail_path: Optional[str] = None,
        output_audio_path: Optional[str] = None,
        thumbnail_quality: int = 2,
        audio_sample_rate: int = 16000,
    ) -> ClipExtractionResult:
        """
        Extracts a clip video plus optional frame-0 thumbnail and transcription WAV
        in a single FFmpeg pass, with one-shot hardware-to-software and silent-video fallbacks.
        """
        if not video_path or not os.path.exists(video_path):
            raise FileNotFoundError(f"Source video not found: {video_path}")
        if start_time < 0 or end_time <= start_time:
            raise ValueError(f"Invalid clip boundaries: start={start_time}, end={end_time}")

        duration = round(end_time - start_time, 2)
        for target in (output_video_path, output_thumbnail_path, output_audio_path):
            if target:
                os.makedirs(os.path.dirname(os.path.abspath(target)), exist_ok=True)

        active_encoder = self._resolve_video_encoder()
        active_audio_path = output_audio_path

        for _ in range(3):
            cmd = self._build_clip_bundle_cmd(
                video_path,
                start_time,
                duration,
                output_video_path,
                active_encoder,
                output_thumbnail_path=output_thumbnail_path,
                output_audio_path=active_audio_path,
                thumbnail_quality=thumbnail_quality,
                audio_sample_rate=audio_sample_rate,
            )
            try:
                self.run_ffmpeg(cmd)
                break
            except RuntimeError as err:
                self._cleanup_partial_outputs([
                    output_video_path,
                    output_thumbnail_path,
                    active_audio_path,
                ])
                if active_audio_path is not None and _is_missing_audio_stream_error(str(err)):
                    print(f"[media_transcoder] Source has no audio stream; retrying clip extraction without WAV: {err}")
                    active_audio_path = None
                    continue
                if active_encoder.is_hardware:
                    print(f"[media_transcoder] Hardware encoder '{active_encoder.codec}' failed; falling back to libx264: {err}")
                    active_encoder = SOFTWARE_H264_ENCODER
                    continue
                raise

        self.invalidate_probe_cache(output_video_path)
        return ClipExtractionResult(
            video_path=output_video_path,
            thumbnail_path=(
                output_thumbnail_path
                if (output_thumbnail_path and os.path.exists(output_thumbnail_path))
                else None
            ),
            audio_path=(
                active_audio_path
                if (active_audio_path and os.path.exists(active_audio_path))
                else None
            ),
            encoder=active_encoder.codec,
        )

    def slice_video(
        self,
        video_path: str,
        start_time: float,
        end_time: float,
        output_path: str
    ) -> bool:
        """
        Accurately cuts video interval [start_time, end_time] using two-pass seek
        and hardware-guided H.264 re-encoding with software fallback.
        """
        result = self.extract_clip_bundle(video_path, start_time, end_time, output_path)
        return os.path.exists(result.video_path)

    def extract_audio(
        self,
        video_path: str,
        output_wav_path: str,
        sample_rate: int = 16000,
        *,
        overwrite: bool = False,
    ) -> str:
        """
        Extracts high-stability mono PCM WAV audio from video required for speech transcription.
        """
        if not video_path or not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found at: {video_path}")

        if not overwrite and os.path.exists(output_wav_path):
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
