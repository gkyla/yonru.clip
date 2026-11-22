from abc import ABC, abstractmethod
from dataclasses import dataclass
import hashlib
import os
import queue
import signal
import sys
import subprocess
import json
import shutil
import re
import threading
import time
import uuid
from typing import Any, Callable, Dict, Generator, List, Optional, Set, Tuple

from core.hardware_profiler import (
    CPUMetrics,
    GPUMetrics,
    HardwareProfiler,
    HostHardwareMetrics,
)


_BUNDLE_LOCK = threading.Lock()
VALID_HARDWARE_ACCELERATION_MODES = frozenset({"if-possible", "disable", "required"})
_HW_ENCODER_ERROR_TOKENS = (
    "videotoolbox",
    "h264_videotoolbox",
    "nvenc",
    "h264_nvenc",
    "hevc_nvenc",
    "hardware acceleration",
    "hardware encoder",
    "gpu process",
    "encoder initialization",
    "cannot load libcuda",
    "cuda_error",
    "failed to initialize encoder",
    "error initializing output stream",
    "vtcompressionsession",
)


class RenderCancelledError(Exception):
    """Raised when an active render or bundle step is cancelled by the client or shutdown."""


@dataclass(frozen=True)
class RemotionRunResult:
    """Normalized outcome of executing a Remotion CLI invocation."""
    returncode: int
    stdout: str = ""
    stderr: str = ""
    cancelled: bool = False


@dataclass(frozen=True)
class RenderExecutionPolicy:
    """Hardware-guided GPU acceleration and RAM-bounded concurrency policy for Remotion."""
    hardware_acceleration: str
    concurrency: int
    hw_accel_explicit: bool = False


def compute_ram_concurrency_cap(total_ram_gb: float) -> int:
    """Map host physical RAM (GB) to a safe headless Chromium tab concurrency ceiling."""
    if total_ram_gb < 8.0:
        return 1
    if total_ram_gb < 12.0:
        return 2
    if total_ram_gb < 16.0:
        return 3
    if total_ram_gb < 24.0:
        return 4
    if total_ram_gb < 32.0:
        return 6
    return 8


def resolve_render_execution_policy(
    metrics: HostHardwareMetrics,
    *,
    hardware_acceleration_override: Optional[str] = None,
    concurrency_override: Optional[str] = None,
) -> RenderExecutionPolicy:
    """Compute `--hardware-acceleration` and `--concurrency` flags from Hardware Capability Profile."""
    cpu_cores = max(1, int(metrics.cpu.cores or 1))
    ram_cap = compute_ram_concurrency_cap(float(metrics.total_ram_gb or 0.0))
    concurrency = max(1, min(cpu_cores, max(1, min(8, cpu_cores // 2)), ram_cap))

    if concurrency_override is not None and concurrency_override.strip():
        try:
            parsed_concurrency = int(concurrency_override.strip())
            concurrency = max(1, min(cpu_cores, parsed_concurrency))
        except ValueError:
            pass

    raw_hw = (hardware_acceleration_override or "").strip().lower()
    if raw_hw in VALID_HARDWARE_ACCELERATION_MODES:
        hw_accel = raw_hw
        hw_accel_explicit = True
    else:
        is_macos = (metrics.cpu.system_os or "").strip().lower() == "darwin"
        has_cuda = (metrics.gpu.type or "").strip().lower() == "cuda"
        hw_accel = "if-possible" if (is_macos or has_cuda) else "disable"
        hw_accel_explicit = False

    return RenderExecutionPolicy(
        hardware_acceleration=hw_accel,
        concurrency=concurrency,
        hw_accel_explicit=hw_accel_explicit,
    )


def _has_hardware_encoder_error(output_tail: str) -> bool:
    lowered = (output_tail or "").lower()
    return any(token in lowered for token in _HW_ENCODER_ERROR_TOKENS)


def _should_retry_with_software_encoding(
    *,
    hardware_acceleration: str,
    returncode: int,
    cancelled: bool,
    completed_frames: bool,
    output_tail: str,
) -> bool:
    if cancelled or returncode == 0 or hardware_acceleration != "if-possible":
        return False
    return (not completed_frames) or _has_hardware_encoder_error(output_tail)


def _resolve_bin_dir(raw_path: str, tool_names: Tuple[str, ...]) -> str:
    expanded = os.path.expanduser(raw_path.strip())
    if os.path.isdir(expanded):
        return expanded
    if os.path.isfile(expanded) or os.path.basename(expanded).lower() in tool_names:
        return os.path.dirname(expanded)
    return expanded


class RemotionProcessAdapter(ABC):
    """Seam isolating Remotion CLI subprocess execution, process-group ownership, and cancellation."""

    @abstractmethod
    def run(
        self,
        cmd: List[str],
        *,
        cwd: str,
        env: Dict[str, str],
        cancel_event: Optional[threading.Event] = None,
    ) -> RemotionRunResult:
        """Execute a Remotion command to completion with cancellation support."""
        pass

    @abstractmethod
    def stream(
        self,
        cmd: List[str],
        *,
        cwd: str,
        env: Dict[str, str],
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[str, None, RemotionRunResult]:
        """Execute a Remotion command, yielding stdout lines and returning RemotionRunResult."""
        pass

    def terminate_all(self) -> None:
        """Terminate all active Remotion process trees tracked by this adapter."""
        return None


class SubprocessRemotionAdapter(RemotionProcessAdapter):
    """Production adapter owning OS process groups, grace-window escalation, and shutdown cleanup."""

    def __init__(self, terminate_grace_seconds: float = 2.0, poll_interval_seconds: float = 0.05) -> None:
        self.terminate_grace_seconds = max(0.05, float(terminate_grace_seconds))
        self.poll_interval_seconds = max(0.01, float(poll_interval_seconds))
        self._lock = threading.Lock()
        self._active_procs: Set[subprocess.Popen[str]] = set()

    @staticmethod
    def _spawn_kwargs(cmd: List[str]) -> Dict[str, Any]:
        if sys.platform == "win32":
            use_shell = bool(cmd) and cmd[0].lower().endswith((".cmd", ".bat"))
            return {
                "shell": use_shell,
                "creationflags": getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
            }
        return {"shell": False, "start_new_session": True}

    @staticmethod
    def _wait_for_pgid_exit(killpg_fn: Any, pgid: int, timeout: float) -> bool:
        end = time.monotonic() + timeout
        while True:
            try:
                killpg_fn(pgid, 0)
            except ProcessLookupError:
                return True
            except PermissionError:
                pass
            except OSError:
                return True
            if time.monotonic() >= end:
                return False
            time.sleep(0.01)

    def _terminate_process_tree(self, proc: subprocess.Popen[str]) -> None:
        if sys.platform == "win32":
            if proc.poll() is None:
                try:
                    subprocess.run(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=5.0,
                        check=False,
                    )
                except Exception:
                    try:
                        proc.kill()
                    except OSError:
                        pass
            if proc.poll() is None:
                try:
                    proc.wait(timeout=5.0)
                except subprocess.TimeoutExpired:
                    try:
                        proc.kill()
                    except OSError:
                        pass
                    try:
                        proc.wait(timeout=2.0)
                    except subprocess.TimeoutExpired:
                        pass
            return

        killpg_fn = getattr(os, "killpg", None)
        pgid = proc.pid
        sigterm = signal.SIGTERM
        sigkill = getattr(signal, "SIGKILL", signal.SIGTERM)

        if killpg_fn is not None and pgid > 0:
            try:
                killpg_fn(pgid, sigterm)
            except (ProcessLookupError, PermissionError, OSError):
                if proc.poll() is None:
                    try:
                        proc.terminate()
                    except OSError:
                        pass
        elif proc.poll() is None:
            try:
                proc.terminate()
            except OSError:
                pass

        deadline = time.monotonic() + self.terminate_grace_seconds
        group_alive = True
        while True:
            if proc.poll() is None:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                try:
                    proc.wait(timeout=min(0.05, remaining))
                except subprocess.TimeoutExpired:
                    pass

            if killpg_fn is not None and pgid > 0:
                try:
                    killpg_fn(pgid, 0)
                except ProcessLookupError:
                    group_alive = False
                    break
                except PermissionError:
                    pass
                except OSError:
                    group_alive = False
                    break
            else:
                if proc.poll() is not None:
                    group_alive = False
                    break

            if time.monotonic() >= deadline:
                break
            time.sleep(0.02)

        if proc.poll() is None or group_alive:
            if killpg_fn is not None and pgid > 0:
                try:
                    killpg_fn(pgid, sigkill)
                except (ProcessLookupError, PermissionError, OSError):
                    if proc.poll() is None:
                        try:
                            proc.kill()
                        except OSError:
                            pass
            elif proc.poll() is None:
                try:
                    proc.kill()
                except OSError:
                    pass

        if proc.poll() is None:
            try:
                proc.wait(timeout=5.0)
            except subprocess.TimeoutExpired:
                try:
                    proc.kill()
                except OSError:
                    pass
                try:
                    proc.wait(timeout=2.0)
                except subprocess.TimeoutExpired:
                    pass

        if killpg_fn is not None and pgid > 0:
            self._wait_for_pgid_exit(killpg_fn, pgid, timeout=0.5)

    def run(
        self,
        cmd: List[str],
        *,
        cwd: str,
        env: Dict[str, str],
        cancel_event: Optional[threading.Event] = None,
    ) -> RemotionRunResult:
        if cancel_event is not None and cancel_event.is_set():
            return RemotionRunResult(returncode=-1, cancelled=True)

        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            encoding="utf-8",
            errors="replace",
            **self._spawn_kwargs(cmd),
        )
        with self._lock:
            self._active_procs.add(proc)

        stdout_chunks: List[str] = []
        stderr_chunks: List[str] = []

        def _drain(pipe: Any, target: List[str]) -> None:
            if pipe is None:
                return
            try:
                for chunk in iter(lambda: pipe.read(4096), ""):
                    target.append(chunk)
            except Exception:
                pass

        t_out = threading.Thread(target=_drain, args=(proc.stdout, stdout_chunks), daemon=True)
        t_err = threading.Thread(target=_drain, args=(proc.stderr, stderr_chunks), daemon=True)
        t_out.start()
        t_err.start()

        cancelled = False
        try:
            while True:
                if cancel_event is not None and cancel_event.is_set():
                    cancelled = True
                    break
                try:
                    proc.wait(timeout=self.poll_interval_seconds)
                    break
                except subprocess.TimeoutExpired:
                    continue
        finally:
            if cancelled or proc.poll() is None:
                self._terminate_process_tree(proc)
            else:
                proc.wait()
            t_out.join(timeout=1.0)
            t_err.join(timeout=1.0)
            for pipe in (proc.stdout, proc.stderr):
                if pipe is not None:
                    try:
                        pipe.close()
                    except Exception:
                        pass
            with self._lock:
                self._active_procs.discard(proc)

        return RemotionRunResult(
            returncode=proc.returncode if proc.returncode is not None else -1,
            stdout="".join(stdout_chunks),
            stderr="".join(stderr_chunks),
            cancelled=cancelled,
        )

    def stream(
        self,
        cmd: List[str],
        *,
        cwd: str,
        env: Dict[str, str],
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[str, None, RemotionRunResult]:
        if cancel_event is not None and cancel_event.is_set():
            return RemotionRunResult(returncode=-1, cancelled=True)

        proc = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
            encoding="utf-8",
            errors="replace",
            **self._spawn_kwargs(cmd),
        )
        with self._lock:
            self._active_procs.add(proc)

        line_queue: queue.Queue[Tuple[str, Optional[str]]] = queue.Queue()

        def _reader() -> None:
            try:
                if proc.stdout is not None:
                    for line in iter(proc.stdout.readline, ""):
                        line_queue.put(("line", line))
            except Exception:
                pass
            finally:
                line_queue.put(("eof", None))

        reader = threading.Thread(target=_reader, daemon=True)
        reader.start()

        cancelled = False
        completed_cleanly = False
        try:
            while True:
                if cancel_event is not None and cancel_event.is_set():
                    cancelled = True
                    break
                try:
                    kind, line = line_queue.get(timeout=self.poll_interval_seconds)
                except queue.Empty:
                    if cancel_event is not None and cancel_event.is_set():
                        cancelled = True
                        break
                    if proc.poll() is not None and not reader.is_alive() and line_queue.empty():
                        break
                    continue

                if kind == "eof":
                    break
                if line is not None:
                    if cancel_event is not None and cancel_event.is_set():
                        cancelled = True
                        break
                    yield line

            if not cancelled:
                while True:
                    if cancel_event is not None and cancel_event.is_set():
                        cancelled = True
                        break
                    try:
                        proc.wait(timeout=self.poll_interval_seconds)
                        completed_cleanly = True
                        break
                    except subprocess.TimeoutExpired:
                        continue
        finally:
            if not completed_cleanly or proc.poll() is None:
                self._terminate_process_tree(proc)
            else:
                proc.wait()
            reader.join(timeout=1.0)
            if proc.stdout is not None:
                try:
                    proc.stdout.close()
                except Exception:
                    pass
            with self._lock:
                self._active_procs.discard(proc)

        return RemotionRunResult(
            returncode=proc.returncode if proc.returncode is not None else -1,
            cancelled=cancelled,
        )

    def terminate_all(self) -> None:
        with self._lock:
            procs = list(self._active_procs)
        for proc in procs:
            try:
                self._terminate_process_tree(proc)
            finally:
                with self._lock:
                    self._active_procs.discard(proc)


class FakeRemotionAdapter(RemotionProcessAdapter):
    """In-memory deterministic Remotion adapter for unit and ASGI integration tests."""

    def __init__(
        self,
        *,
        run_results: Optional[List[RemotionRunResult]] = None,
        stream_scripts: Optional[List[Dict[str, Any]]] = None,
        run_handler: Optional[Callable[[List[str], str, Dict[str, str], Optional[threading.Event]], RemotionRunResult]] = None,
        stream_handler: Optional[Callable[[List[str], str, Dict[str, str], Optional[threading.Event]], Generator[str, None, RemotionRunResult]]] = None,
        auto_create_bundle: bool = True,
        on_terminate: Optional[Callable[[], None]] = None,
    ) -> None:
        self.calls: List[Dict[str, Any]] = []
        self.run_results: List[RemotionRunResult] = list(run_results or [])
        self.stream_scripts: List[Dict[str, Any]] = list(stream_scripts or [])
        self.run_handler = run_handler
        self.stream_handler = stream_handler
        self.auto_create_bundle = auto_create_bundle
        self.on_terminate = on_terminate
        self.terminated_count = 0
        self.terminate_all_calls = 0

    @staticmethod
    def _extract_output_path(cmd: List[str]) -> Optional[str]:
        if "--props" in cmd:
            idx = cmd.index("--props")
            if idx + 2 < len(cmd):
                return cmd[idx + 2]
        return None

    def _maybe_create_bundle(self, cmd: List[str], cwd: str) -> None:
        if not self.auto_create_bundle or "bundle" not in cmd:
            return
        out_dir = ".bundle"
        if "--out-dir" in cmd:
            out_idx = cmd.index("--out-dir")
            if out_idx + 1 < len(cmd):
                out_dir = cmd[out_idx + 1]
        bundle_path = os.path.join(cwd, out_dir)
        os.makedirs(bundle_path, exist_ok=True)
        with open(os.path.join(bundle_path, "index.html"), "w", encoding="utf-8") as f:
            f.write("<html><body>fake bundle</body></html>")

    def run(
        self,
        cmd: List[str],
        *,
        cwd: str,
        env: Dict[str, str],
        cancel_event: Optional[threading.Event] = None,
    ) -> RemotionRunResult:
        self.calls.append({"method": "run", "cmd": list(cmd), "cwd": cwd, "env": dict(env)})
        if cancel_event is not None and cancel_event.is_set():
            self.terminated_count += 1
            if self.on_terminate is not None:
                self.on_terminate()
            return RemotionRunResult(returncode=-1, cancelled=True)

        if self.run_handler is not None:
            result = self.run_handler(list(cmd), cwd, dict(env), cancel_event)
            if result.cancelled or (cancel_event is not None and cancel_event.is_set()):
                self.terminated_count += 1
                if self.on_terminate is not None:
                    self.on_terminate()
            return result

        if self.run_results:
            result = self.run_results.pop(0)
        else:
            self._maybe_create_bundle(cmd, cwd)
            result = RemotionRunResult(returncode=0)

        if result.cancelled:
            self.terminated_count += 1
            if self.on_terminate is not None:
                self.on_terminate()
        return result

    def stream(
        self,
        cmd: List[str],
        *,
        cwd: str,
        env: Dict[str, str],
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[str, None, RemotionRunResult]:
        self.calls.append({"method": "stream", "cmd": list(cmd), "cwd": cwd, "env": dict(env)})
        if cancel_event is not None and cancel_event.is_set():
            self.terminated_count += 1
            if self.on_terminate is not None:
                self.on_terminate()
            return RemotionRunResult(returncode=-1, cancelled=True)

        completed_cleanly = False
        try:
            if self.stream_handler is not None:
                result = yield from self.stream_handler(list(cmd), cwd, dict(env), cancel_event)
                if result is None:
                    result = RemotionRunResult(
                        returncode=0,
                        cancelled=bool(cancel_event is not None and cancel_event.is_set()),
                    )
                if not result.cancelled and not (cancel_event is not None and cancel_event.is_set()):
                    completed_cleanly = True
                return result

            script = dict(self.stream_scripts.pop(0)) if self.stream_scripts else {}
            write_bytes = script.get("write_output_bytes")
            if write_bytes is not None:
                out_path = self._extract_output_path(cmd)
                if out_path:
                    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                    with open(out_path, "wb") as f:
                        f.write(write_bytes)

            for line in script.get("lines", []):
                if cancel_event is not None and cancel_event.is_set():
                    return RemotionRunResult(returncode=-1, cancelled=True)
                yield line

            if script.get("wait_for_cancel_after_lines") and cancel_event is not None:
                cancel_event.wait(timeout=float(script.get("cancel_wait_timeout", 5.0)))
                if cancel_event.is_set():
                    return RemotionRunResult(returncode=-1, cancelled=True)

            if cancel_event is not None and cancel_event.is_set():
                return RemotionRunResult(returncode=-1, cancelled=True)

            is_cancelled = bool(script.get("cancelled", False))
            if not is_cancelled:
                completed_cleanly = True
            return RemotionRunResult(
                returncode=int(script.get("returncode", 0)),
                cancelled=is_cancelled,
            )
        finally:
            if not completed_cleanly:
                self.terminated_count += 1
                if self.on_terminate is not None:
                    self.on_terminate()

    def terminate_all(self) -> None:
        self.terminate_all_calls += 1
        if self.on_terminate is not None:
            self.on_terminate()


def _resolve_track_type(track: Any) -> str:
    """Resolve canonical NLE track type ('text', 'audio', 'video') from track metadata or ID."""
    if not isinstance(track, dict):
        return ""
    track_type = track.get("type")
    if track_type in ("text", "audio", "video"):
        return str(track_type)
    track_id = str(track.get("id") or "")
    if track_id == "audio" or track_id.startswith("audio-"):
        return "audio"
    if track_id == "text" or track_id.startswith("text-"):
        return "text"
    if track_id == "video" or track_id.startswith("video-"):
        return "video"
    return ""


def _compute_timeline_duration(tracks: Optional[List[Dict[str, Any]]]) -> float:
    """Return max non-audio, visible end time (seconds) across tracks, or 0.0."""
    if not tracks:
        return 0.0
    max_timeline_end = 0.0
    for track in tracks:
        resolved_type = _resolve_track_type(track)
        if resolved_type == "audio":
            continue
        if resolved_type == "text" and track.get("hidden"):
            continue
        for item in track.get("items") or []:
            end = float(item.get("start") or 0.0) + float(item.get("duration") or 0.0)
            if end > max_timeline_end:
                max_timeline_end = end
    return max_timeline_end


def _stage_file(src: str, dst: str) -> None:
    """Stage a media file via zero-copy hardlink, falling back to copy across filesystems."""
    real_src = os.path.realpath(src)
    real_dst = os.path.realpath(dst)
    if real_src == real_dst:
        return
    if os.path.lexists(dst):
        os.remove(dst)
    try:
        os.link(real_src, dst)
    except OSError:
        shutil.copy2(real_src, dst)


class RenderComposition:
    """A data DTO containing the complete settings of a video composition."""
    def __init__(self, original_video: str, crop_center_x: Any, **kwargs):
        self.original_video = original_video
        self.crop_center_x = crop_center_x
        self.video_layout = kwargs.get("video_layout", "vertical")
        sub_style = kwargs.get("subtitle_style") or {}
        self.landscape_background = kwargs.get("landscape_background") or sub_style.get("landscapeBackground") or "black"
        self.landscape_blur_radius = kwargs.get("landscape_blur_radius") or sub_style.get("landscapeBlurRadius") or 25
        self.landscape_darkness = kwargs.get("landscape_darkness") if kwargs.get("landscape_darkness") is not None else sub_style.get("landscapeDarkness", 35)
        self.timeline_tracks = kwargs.get("timeline_tracks")
        self.words_data = kwargs.get("words_data")
        self.timeline_text_items = kwargs.get("timeline_text_items")
        self.timeline_audio_items = kwargs.get("timeline_audio_items")
        self.timeline_video_items = kwargs.get("timeline_video_items")
        self.position = kwargs.get("position", "bottom")
        self.auto_adaptive_subtitles = (
            kwargs.get("auto_adaptive_subtitles")
            if kwargs.get("auto_adaptive_subtitles") is not None
            else sub_style.get("autoAdaptiveSubtitles", True)
        )
        self.clip_duration = kwargs.get("clip_duration")
        self.subtitle_style = kwargs.get("subtitle_style")
        self.volume = kwargs.get("volume", 0.5)
        self.fps = kwargs.get("fps", 30.0)
        self.thumbnail_config = kwargs.get("thumbnail_config")
        self.source_width = kwargs.get("source_width", 1920)
        self.source_height = kwargs.get("source_height", 1080)
        self.split_zoom_top = kwargs.get("split_zoom_top", 1.0)
        self.split_zoom_bottom = kwargs.get("split_zoom_bottom", 1.0)
        self.split_offset_x_top = kwargs.get("split_offset_x_top", 0.0)
        self.split_offset_y_top = kwargs.get("split_offset_y_top", 0.0)
        self.split_offset_x_bottom = kwargs.get("split_offset_x_bottom", 0.0)
        self.split_offset_y_bottom = kwargs.get("split_offset_y_bottom", 0.0)
        self.censored_segments = kwargs.get("censored_segments") or []
        self.bleep_audio_src = kwargs.get("bleep_audio_src")
        subtitles_enabled = kwargs.get("subtitles_enabled")
        if subtitles_enabled is not None:
            self.hide_subtitles = not subtitles_enabled
        else:
            self.hide_subtitles = kwargs.get("hide_subtitles", False)

    def compute_total_frames(self) -> Tuple[int, float]:
        """Compute total composition frames and active cover slide duration in seconds."""
        cover_duration = 0.0
        cover_cfg = getattr(self, "cover_config", None) or getattr(self, "thumbnail_config", None)
        if cover_cfg and cover_cfg.get("enabled"):
            cover_src = cover_cfg.get("imagePath")
            if cover_src and os.path.exists(cover_src):
                raw_duration = cover_cfg.get("duration", 1.0)
                cover_duration = float(1.0 if raw_duration is None else raw_duration)

        clip_dur = self.clip_duration
        max_timeline_end = _compute_timeline_duration(self.timeline_tracks)
        if max_timeline_end > 0.0:
            clip_dur = max_timeline_end

        video_frames = max(1, int((clip_dur or 10.0) * self.fps))
        cover_frames = int(cover_duration * self.fps)
        return video_frames + cover_frames, cover_duration


class SafeEncoder(json.JSONEncoder):
    """JSON encoder that safely handles numpy types from MediaPipe/OpenCV."""
    def default(self, o):
        try:
            import numpy as np
            if isinstance(o, np.integer):
                return int(o)
            if isinstance(o, np.floating):
                return float(o)
            if isinstance(o, np.ndarray):
                return o.tolist()
        except ImportError:
            pass
        return super().default(o)


class RemotionProgressParser:
    """
    Pure stateful parser converting raw Remotion CLI stdout lines into structured SSE event dicts.
    Handles ANSI stripping, bundling stage, rendering frame/percent parsing, and ETA estimation.
    """
    def __init__(self, total_frames: int, start_time: Optional[float] = None):
        self.total_frames = max(1, total_frames)
        self.start_time = start_time if start_time is not None else time.time()
        self.render_start_time: Optional[float] = None
        self.last_overall: int = 0
        self.last_frame: int = -1
        self.current_stage: str = "bundling"
        self.frame_re = re.compile(r'(?:Rendered\s+)?(?:\()?(\d+)/(\d+)(?:\))?', re.IGNORECASE)
        self.time_re = re.compile(r'time remaining:\s*(?:(\d+)m\s*)?(\d+)s', re.IGNORECASE)
        self.pct_re = re.compile(r'(\d+)%')
        self.ansi_re = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]')

    def clean_line(self, line: str) -> str:
        return self.ansi_re.sub('', line).strip()

    def parse_line(self, raw_line: str) -> Optional[Dict[str, Any]]:
        clean = self.clean_line(raw_line)
        if not clean:
            return None

        line_lower = clean.lower()

        # Stage 1: Bundling
        if "bundling" in line_lower:
            self.current_stage = "bundling"
            m = self.pct_re.search(clean)
            if m:
                bpct = int(m.group(1))
                overall = int(bpct * 0.15)
                if overall > self.last_overall:
                    self.last_overall = overall
                    return {
                        "stage": "bundling",
                        "percent": overall,
                        "frame": 0,
                        "totalFrames": self.total_frames,
                        "etaSeconds": 0
                    }
            return None

        # Stage transition: Entering rendering or frame lines
        if "rendered" in line_lower or ("rendering" in line_lower and "encoding" not in line_lower) or "concurrency" in line_lower:
            fm = self.frame_re.search(clean)
            if fm:
                self.current_stage = "rendering"
                if not self.render_start_time:
                    self.render_start_time = time.time()

                frame_num = int(fm.group(1))
                total = int(fm.group(2))
                render_pct = (frame_num / max(total, 1)) * 100
                overall = int(15 + (render_pct * 0.80))

                tm = self.time_re.search(clean)
                if tm:
                    mins = int(tm.group(1)) if tm.group(1) else 0
                    secs = int(tm.group(2)) if tm.group(2) else 0
                    eta_sec = mins * 60 + secs
                else:
                    elapsed = time.time() - (self.render_start_time or self.start_time)
                    eta_sec = max(0, int((elapsed / max(render_pct, 0.001)) * (100 - render_pct))) if render_pct > 0 else 0

                if frame_num > self.last_frame or overall > self.last_overall:
                    self.last_frame = frame_num
                    self.last_overall = max(self.last_overall, overall)
                    return {
                        "stage": "rendering",
                        "percent": min(overall, 95),
                        "frame": frame_num,
                        "totalFrames": total,
                        "etaSeconds": eta_sec
                    }
                return None

            if self.current_stage != "rendering":
                self.current_stage = "rendering"
                self.render_start_time = time.time()
                self.last_overall = max(self.last_overall, 15)
                return {
                    "stage": "rendering",
                    "percent": 15,
                    "frame": 0,
                    "totalFrames": self.total_frames,
                    "etaSeconds": 0
                }

        # Stage 2: Fallback rendering percent without explicit frame match
        if self.current_stage == "rendering":
            pm = self.pct_re.search(clean)
            if pm and "bundling" not in line_lower:
                rpct = int(pm.group(1))
                overall = int(15 + (rpct * 0.80))
                if overall > self.last_overall:
                    self.last_overall = overall
                    elapsed = time.time() - (self.render_start_time or self.start_time)
                    eta_sec = max(0, int((elapsed / max(rpct, 1)) * (100 - rpct))) if rpct > 0 else 0
                    return {
                        "stage": "rendering",
                        "percent": min(overall, 95),
                        "frame": int(self.total_frames * rpct / 100),
                        "totalFrames": self.total_frames,
                        "etaSeconds": eta_sec
                    }
                return None

        # Stage 3: Encoding / Muxing
        if "encoding" in line_lower or "muxing" in line_lower or "stitching" in line_lower:
            self.current_stage = "encoding"
            if self.last_overall < 96:
                self.last_overall = 96
            return {
                "stage": "encoding",
                "percent": self.last_overall,
                "frame": self.total_frames,
                "totalFrames": self.total_frames,
                "etaSeconds": 0
            }

        return None

    def starting_event(self) -> Dict[str, Any]:
        return {"stage": "starting", "percent": 0, "frame": 0, "totalFrames": self.total_frames}

    def bundling_event(self, percent: int = 5) -> Dict[str, Any]:
        return {
            "stage": "bundling",
            "percent": percent,
            "frame": 0,
            "totalFrames": self.total_frames,
            "etaSeconds": 0,
        }

    def complete_event(self, output_path: str, output_url: str) -> Dict[str, Any]:
        return {
            "stage": "done",
            "percent": 100,
            "frame": self.total_frames,
            "totalFrames": self.total_frames,
            "outputPath": output_path,
            "outputUrl": output_url
        }

    def error_event(self, message: str) -> Dict[str, Any]:
        return {"stage": "error", "message": message}


class StagedRenderContext:
    """
    Context manager that prepares and cleans up staged video assets and props JSON
    in shared/remotion/public/ and static/output/ for Remotion rendering.
    Guarantees cleanup on normal completion, failures, and exceptions.
    """
    def __init__(
        self,
        comp: RenderComposition,
        out_filename: str,
        output_dir: str = "static/output",
        remotion_dir: Optional[str] = None,
        public_dir: Optional[str] = None,
        audio_library_dir: Optional[str] = None,
    ):
        self.comp = comp
        self.out_filename = out_filename
        self.output_dir = output_dir
        self.remotion_dir = os.path.abspath(
            remotion_dir or os.path.join(os.path.dirname(__file__), "../../shared/remotion")
        )
        self.public_dir = os.path.abspath(public_dir or os.path.join(self.remotion_dir, "public"))
        self.audio_library_dir = os.path.abspath(audio_library_dir or "temp_assets/audio_library")
        self.public_video_path: Optional[str] = None
        self.thumbnail_image_path: Optional[str] = None
        self.staged_audio_paths: List[str] = []
        self.props_path: Optional[str] = None
        self.frames: int = 0

    def __enter__(self):
        self.staged_audio_paths = []
        os.makedirs(self.public_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

        safe_out_filename = os.path.basename(self.out_filename)
        if not safe_out_filename or safe_out_filename in {".", ".."} or safe_out_filename != self.out_filename:
            raise ValueError(f"Unsafe output filename for staging: {self.out_filename}")

        base_public_dir = os.path.abspath(self.public_dir)
        base_output_dir = os.path.abspath(self.output_dir)

        try:
            temp_public_video_name = f"source_{safe_out_filename}"
            public_video_dest = os.path.abspath(os.path.join(base_public_dir, temp_public_video_name))
            if os.path.commonpath([base_public_dir, public_video_dest]) != base_public_dir:
                raise ValueError(f"Unsafe staged video destination: {public_video_dest}")
            self.public_video_path = public_video_dest
            _stage_file(self.comp.original_video, self.public_video_path)

            cover_image_name = None
            cover_cfg = getattr(self.comp, "cover_config", None) or getattr(self.comp, "thumbnail_config", None)
            if cover_cfg and cover_cfg.get("enabled"):
                cover_src = cover_cfg.get("imagePath")
                if cover_src and os.path.exists(cover_src):
                    cover_image_name = f"cover_{safe_out_filename}.jpg"
                    cover_dest = os.path.abspath(os.path.join(base_public_dir, cover_image_name))
                    if os.path.commonpath([base_public_dir, cover_dest]) != base_public_dir:
                        raise ValueError(f"Unsafe staged cover destination: {cover_dest}")
                    self.thumbnail_image_path = cover_dest
                    _stage_file(cover_src, self.thumbnail_image_path)

            timeline_video_items = self.comp.timeline_video_items
            if timeline_video_items is None and self.comp.timeline_tracks:
                video_track = next(
                    (t for t in self.comp.timeline_tracks if _resolve_track_type(t) == "video"),
                    None,
                )
                timeline_video_items = video_track.get("items", []) if video_track else []
            timeline_video_items = timeline_video_items or []

            self.frames, cover_duration = self.comp.compute_total_frames()

            staged_audio_items = []
            base_audio_dir = os.path.abspath(self.audio_library_dir)
            for idx, item in enumerate(self.comp.timeline_audio_items or []):
                item_copy = dict(item)
                src = str(item_copy.get("src") or "")
                if "/assets/audio_library/" in src:
                    raw_filename = src.split("/assets/audio_library/")[-1].split("?")[0]
                    audio_filename = os.path.basename(raw_filename)
                    local_audio_path = os.path.abspath(os.path.join(base_audio_dir, audio_filename))
                    if (
                        audio_filename
                        and os.path.commonpath([base_audio_dir, local_audio_path]) == base_audio_dir
                        and os.path.isfile(local_audio_path)
                    ):
                        staged_audio_name = f"audio_{safe_out_filename}_{idx}_{audio_filename}"
                        staged_audio_dest = os.path.abspath(os.path.join(base_public_dir, staged_audio_name))
                        if os.path.commonpath([base_public_dir, staged_audio_dest]) == base_public_dir:
                            _stage_file(local_audio_path, staged_audio_dest)
                            self.staged_audio_paths.append(staged_audio_dest)
                            item_copy["src"] = staged_audio_name
                staged_audio_items.append(item_copy)

            props = {
                "videoPath": temp_public_video_name,
                "words": self.comp.words_data or [],
                "cropX": self.comp.crop_center_x if isinstance(self.comp.crop_center_x, (int, float)) else (self.comp.crop_center_x[0]["x"] if isinstance(self.comp.crop_center_x, list) and len(self.comp.crop_center_x) > 0 else 960),
                "cropMap": self.comp.crop_center_x if isinstance(self.comp.crop_center_x, list) else [],
                "position": self.comp.position,
                "videoLayout": self.comp.video_layout,
                "landscapeBackground": self.comp.landscape_background,
                "landscapeBlurRadius": self.comp.landscape_blur_radius,
                "landscapeDarkness": self.comp.landscape_darkness,
                "subtitleOffset": self.comp.subtitle_style.get("subtitleOffset", 50) if self.comp.subtitle_style else 50,
                "autoAdaptiveSubtitles": getattr(self.comp, "auto_adaptive_subtitles", True),
                "hideSubtitles": getattr(self.comp, "hide_subtitles", False),
                "durationInFrames": self.frames,
                "subtitleStyle": self.comp.subtitle_style or {},
                "timelineTextItems": self.comp.timeline_text_items or [],
                "timelineAudioItems": staged_audio_items,
                "timelineVideoItems": timeline_video_items,
                "censoredSegments": self.comp.censored_segments or [],
                "bleepAudioSrc": self.comp.bleep_audio_src,
                "volume": self.comp.volume,
                "fps": self.comp.fps,
                "coverEnabled": cover_image_name is not None,
                "coverDuration": cover_duration,
                "coverImagePath": cover_image_name,
                "coverTextOverlays": cover_cfg.get("textOverlays", []) if cover_cfg else [],
                "coverXOffset": cover_cfg.get("xOffset", 50.0) if cover_cfg else 50.0,
                "thumbnailEnabled": cover_image_name is not None,
                "thumbnailDuration": cover_duration,
                "thumbnailImagePath": cover_image_name,
                "thumbnailTextOverlays": cover_cfg.get("textOverlays", []) if cover_cfg else [],
                "thumbnailXOffset": cover_cfg.get("xOffset", 50.0) if cover_cfg else 50.0,
                "sourceWidth": self.comp.source_width,
                "sourceHeight": self.comp.source_height,
                "splitZoomTop": getattr(self.comp, "split_zoom_top", 1.0) or 1.0,
                "splitZoomBottom": getattr(self.comp, "split_zoom_bottom", 1.0) or 1.0,
                "splitOffsetXTop": getattr(self.comp, "split_offset_x_top", 0.0) or 0.0,
                "splitOffsetYTop": getattr(self.comp, "split_offset_y_top", 0.0) or 0.0,
                "splitOffsetXBottom": getattr(self.comp, "split_offset_x_bottom", 0.0) or 0.0,
                "splitOffsetYBottom": getattr(self.comp, "split_offset_y_bottom", 0.0) or 0.0,
            }

            props_dest = os.path.abspath(os.path.join(base_output_dir, f"props_{safe_out_filename}.json"))
            if os.path.commonpath([base_output_dir, props_dest]) != base_output_dir:
                raise ValueError(f"Unsafe props destination: {props_dest}")
            self.props_path = props_dest
            with open(self.props_path, "w", encoding="utf-8") as f:
                json.dump(props, f, cls=SafeEncoder)
        except Exception:
            self._cleanup()
            raise

        return self

    def _cleanup(self) -> None:
        paths_to_remove: List[Optional[str]] = [
            self.props_path,
            self.public_video_path,
            self.thumbnail_image_path,
            *self.staged_audio_paths,
        ]
        for path in paths_to_remove:
            if path and os.path.lexists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._cleanup()


class RenderEngine(ABC):
    face_tracker: Any
    output_dir: str = "static/output"

    def resolve_output_filename(self, output_name: Optional[str], job_id: str, hook_index: int = 0) -> str:
        """Determines and deduplicates output filename against the output directory."""
        output_dir = getattr(self, "output_dir", "static/output")
        os.makedirs(output_dir, exist_ok=True)

        if output_name:
            safe_name = re.sub(r'[^\w\s-]', '', output_name).strip().replace(' ', '_')
            if not safe_name:
                safe_name = f"{job_id}_clip_{hook_index}"
            base_filename = f"{safe_name}.mp4"

            if os.path.exists(os.path.join(output_dir, base_filename)):
                counter = 2
                while os.path.exists(os.path.join(output_dir, f"{safe_name}_v{counter}.mp4")):
                    counter += 1
                return f"{safe_name}_v{counter}.mp4"
            return base_filename
        else:
            return f"{job_id}_clip_{hook_index}.mp4"

    def __init__(
        self,
        media_transcoder: Optional[Any] = None,
        face_tracker: Optional[Any] = None,
        subtitle_engine: Optional[Any] = None,
        clip_session_store: Optional[Any] = None,
    ):
        self.media_transcoder = media_transcoder
        self.face_tracker = face_tracker
        self.subtitle_engine = subtitle_engine
        self.clip_session_store = clip_session_store

    @abstractmethod
    def _render_comp(self, comp: RenderComposition, out_filename: str) -> Optional[str]:
        """Internal synchronous render method for RenderComposition."""
        pass

    @abstractmethod
    def render_streaming(
        self,
        comp: RenderComposition,
        out_filename: str,
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[dict, None, None]:
        """Asynchronously render and yield progress dictionaries."""
        pass

    def terminate_all(self) -> None:
        """Terminate any active render subprocesses owned by this engine."""
        return None

    def render(
        self,
        target: Any,
        out_filename_or_req: Any = None,
        asset_repository: Any = None,
        output_name: Optional[str] = None,
        media_transcoder: Optional[Any] = None
    ) -> Any:
        """
        Unified render entrypoint.
        Can be called with:
          render(comp, out_filename) -> str (legacy DTO path)
          render(job, req, output_name=...) -> dict (decoupled from asset_repository)
          render(job, req, asset_repository, output_name=...) -> dict (legacy compatibility)
        """
        if isinstance(target, RenderComposition):
            return self._render_comp(target, out_filename_or_req)

        job = target
        req = out_filename_or_req

        if isinstance(asset_repository, str) and output_name is None:
            output_name = asset_repository
            asset_repository = None

        job_id = req.job_id if hasattr(req, "job_id") else job.get("job_id", "job")
        hook_index = getattr(req, "hook_index", 0)
        resolved_name = output_name or getattr(req, "output_name", None)
        out_filename = self.resolve_output_filename(resolved_name, job_id, hook_index)

        comp = self.compile_composition(
            job,
            req,
            asset_repository=asset_repository,
            media_transcoder=media_transcoder
        )
        output_path = self._render_comp(comp, out_filename)
        if output_path:
            return {
                "status": "done",
                "out_filename": out_filename,
                "output_path": output_path,
                "output_url": f"/static/output/{out_filename}"
            }
        return None

    def render_stream(
        self,
        job: dict,
        req: Any,
        asset_repository: Any = None,
        output_name: Optional[str] = None,
        media_transcoder: Optional[Any] = None,
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[dict, None, None]:
        """Unified SSE progress streaming entrypoint decoupled from asset_repository."""
        if cancel_event is not None and cancel_event.is_set():
            return

        if isinstance(asset_repository, str) and output_name is None:
            output_name = asset_repository
            asset_repository = None

        job_id = req.job_id if hasattr(req, "job_id") else job.get("job_id", "job")
        hook_index = getattr(req, "hook_index", 0)
        resolved_name = output_name or getattr(req, "output_name", None)
        out_filename = self.resolve_output_filename(resolved_name, job_id, hook_index)

        comp = self.compile_composition(
            job,
            req,
            asset_repository=asset_repository,
            media_transcoder=media_transcoder
        )
        if cancel_event is not None and cancel_event.is_set():
            return

        yield from self.render_streaming(comp, out_filename, cancel_event=cancel_event)

    def compile_composition(
        self,
        job: dict,
        req: Any,
        asset_repository: Any = None,
        media_transcoder: Optional[Any] = None
    ) -> RenderComposition:
        """
        Translates raw timestamps, subtitle grouping modes, face tracking paths, 
        and thumbnail options directly from job metadata and request options 
        into a consolidated RenderComposition DTO.
        """
        video_path = job.get("clip_path") or job["video_info"]["file_path"]
        fps = job.get("fps") or job["video_info"].get("fps") or req.fps or 30.0

        hook = job["hooks"][req.hook_index] if "hooks" in job and len(job["hooks"]) > req.hook_index else None

        if job.get("clip_path"):
            clip_start = 0
            clip_duration = job.get("clip_duration") or 0
            if not clip_duration and job.get("clip"):
                clip_duration = job["clip"].get("duration") or 0
        elif hook:
            clip_start = hook["start"]
            clip_duration = hook["duration"]
        else:
            clip_start = 0
            clip_duration = job.get("video_info", {}).get("duration") or 0

        # Extract tracks and calculate duration override via shared helper
        timeline_text: List[Dict[str, Any]] = []
        timeline_text_tracks: List[List[Dict[str, Any]]] = []
        timeline_audio: List[Dict[str, Any]] = []
        timeline_video: List[Dict[str, Any]] = []

        if req.timeline_tracks:
            for track in req.timeline_tracks:
                resolved_type = _resolve_track_type(track)
                items = track.get("items") or []
                if resolved_type == "text":
                    if not track.get("hidden"):
                        timeline_text_tracks.append(items)
                elif resolved_type == "audio":
                    if not track.get("muted"):
                        timeline_audio.extend(items)
                elif resolved_type == "video":
                    timeline_video = items

        # Flatten visible text tracks bottom-to-top so upper tracks paint above lower tracks
        for text_items in reversed(timeline_text_tracks):
            timeline_text.extend(text_items)

        max_timeline_end = _compute_timeline_duration(req.timeline_tracks)
        if max_timeline_end > 0.0:
            print(f"[render-engine] Overriding clip_duration with timeline duration: {max_timeline_end:.2f}s (was: {clip_duration}s)", flush=True)
            clip_duration = max_timeline_end

        clip_meta = job.get("clip") or {}
        folder_name = job.get("folder_name") or (clip_meta.get("folder_name") if isinstance(clip_meta, dict) else None)
        clip_id = job.get("clip_id") or (clip_meta.get("clip_id") if isinstance(clip_meta, dict) else None)
        artifacts = None
        if self.clip_session_store is not None and hasattr(self.clip_session_store, "resolve_clip_artifacts"):
            try:
                artifacts = self.clip_session_store.resolve_clip_artifacts(
                    video_path,
                    folder_name=folder_name,
                    clip_id=clip_id,
                )
            except ValueError:
                artifacts = None

        if artifacts is not None and artifacts.transcript_path:
            transcript_path = artifacts.transcript_path
        else:
            clip_transcript = os.path.join(os.path.dirname(video_path), "transcript.json")
            if os.path.exists(clip_transcript):
                transcript_path = clip_transcript
            else:
                transcript_path = os.path.join(os.path.dirname(job["video_info"]["file_path"]), "transcript.json")

        if req.transcript:
            segments = req.transcript
        elif os.path.exists(transcript_path):
            with open(transcript_path, "r", encoding="utf-8") as f:
                segments = json.load(f)
        else:
            segments = []

        is_relative = (
            (artifacts is not None and artifacts.transcript_path is not None)
            or "/clips/" in transcript_path.replace("\\", "/")
            or req.transcript is not None
        )

        subtitle_engine = getattr(self, "subtitle_engine", None)
        if subtitle_engine is None:
            from core.subtitle_engine import DefaultSubtitleEngine
            subtitle_engine = DefaultSubtitleEngine()
        words_data = subtitle_engine.format_subtitles(
            segments=segments,
            subtitle_mode=req.subtitle_mode,
            sync_offset_ms=req.subtitle_sync_offset,
            clip_duration=clip_duration,
            clip_start=clip_start,
            is_relative=is_relative
        )

        w, h = 0, 0
        transcoder = media_transcoder or getattr(self, "media_transcoder", None)
        if transcoder and hasattr(transcoder, "probe_video"):
            try:
                specs = transcoder.probe_video(video_path)
                w, h = specs.width, specs.height
            except Exception:
                w, h = 0, 0
        elif transcoder and hasattr(transcoder, "get_video_resolution"):
            try:
                w, h = transcoder.get_video_resolution(video_path)
            except Exception:
                w, h = 0, 0

        source_width = w if w > 0 else 1920
        source_height = h if h > 0 else 1080

        if req.face_tracking:
            if artifacts is not None and self.clip_session_store is not None:
                crop_x = self.clip_session_store.ensure_crop_map(
                    artifacts.folder_name,
                    artifacts.clip_id,
                    video_path=video_path,
                    tracker=getattr(self, "face_tracker", None),
                    words_data=words_data,
                )
            else:
                clip_dir = os.path.dirname(video_path)
                cached_crop_map_path = os.path.join(clip_dir, "crop_map.json")
                crop_x = None
                if os.path.exists(cached_crop_map_path):
                    try:
                        with open(cached_crop_map_path, "r", encoding="utf-8") as f:
                            cached_data = json.load(f)
                            if (isinstance(cached_data, list) and len(cached_data) > 0) or isinstance(cached_data, (int, float)):
                                crop_x = cached_data
                    except Exception as e:
                        print(f"[render-engine] Failed to load cached crop_map.json: {e}", flush=True)
                        crop_x = None

                if crop_x is None:
                    tracker = getattr(self, "face_tracker", None)
                    if not tracker and self.clip_session_store is not None:
                        tracker = getattr(self.clip_session_store, "face_tracker", None)
                    created_local_tracker = False
                    if not tracker:
                        from core.face_tracker import FaceTracker
                        tracker = FaceTracker()
                        created_local_tracker = True
                    try:
                        crop_x = tracker.analyze_video(video_path, words_data=words_data)
                    finally:
                        if created_local_tracker and hasattr(tracker, "close"):
                            tracker.close()
        else:
            crop_x = int((req.crop_percent_x / 100.0) * source_width)

        is_cover_enabled = getattr(req, "cover_enabled", None)
        if is_cover_enabled is None:
            is_cover_enabled = getattr(req, "thumbnail_enabled", False)

        thumbnail_config = None
        if is_cover_enabled:
            cover_dur = getattr(req, "cover_duration", None)
            if cover_dur is None:
                cover_dur = getattr(req, "thumbnail_duration", 1.0)

            cover_overlays = getattr(req, "cover_text_overlays", None)
            if cover_overlays is None:
                cover_overlays = getattr(req, "thumbnail_text_overlays", None) or []

            cover_off = getattr(req, "cover_x_offset", None)
            if cover_off is None:
                cover_off = getattr(req, "thumbnail_x_offset", 50.0)

            thumbnail_config = {
                "enabled": True,
                "duration": cover_dur,
                "textOverlays": cover_overlays,
                "xOffset": cover_off,
            }
            if artifacts is not None:
                if artifacts.cover_image_path:
                    thumbnail_config["imagePath"] = artifacts.cover_image_path
                else:
                    thumbnail_config["enabled"] = False
            else:
                clip_dir = os.path.dirname(video_path)
                cover_path = os.path.join(clip_dir, "cover.jpg")
                thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
                if os.path.exists(cover_path):
                    thumbnail_config["imagePath"] = cover_path
                elif os.path.exists(thumb_path):
                    thumbnail_config["imagePath"] = thumb_path
                else:
                    thumbnail_config["enabled"] = False

        censored_segments = []
        bleep_audio_src = None
        if getattr(req, "audio_bleep_enabled", False):
            censored_segments = getattr(req, "censored_segments", None) or []
            if getattr(req, "audio_bleep_source", "mute") == "custom":
                custom_file = getattr(req, "custom_bleep_file", None)
                if custom_file and isinstance(custom_file, dict) and custom_file.get("data"):
                    bleep_audio_src = custom_file["data"]
                else:
                    bleep_audio_src = "/audio/bleep.wav"

        return RenderComposition(
            original_video=video_path,
            crop_center_x=crop_x or 960,
            video_layout=getattr(req, "video_layout", "vertical") or "vertical",
            landscape_background=getattr(req, "landscape_background", "black") or "black",
            landscape_blur_radius=getattr(req, "landscape_blur_radius", 25) or 25,
            landscape_darkness=getattr(req, "landscape_darkness", 35) if getattr(req, "landscape_darkness", None) is not None else 35,
            timeline_tracks=req.timeline_tracks,
            words_data=words_data,
            timeline_text_items=timeline_text,
            timeline_audio_items=timeline_audio,
            timeline_video_items=timeline_video,
            position=req.subtitle_position,
            auto_adaptive_subtitles=getattr(req, "auto_adaptive_subtitles", True),
            clip_duration=clip_duration,
            subtitle_style={
                "fontFamily": req.font,
                "fontSize": req.font_size,
                "subtitleOffset": req.subtitle_offset,
                "fontWeight": req.subtitle_font_weight,
                "color": req.subtitle_text_color,
                "highlightColor": req.subtitle_highlight_color,
                "strokeColor": req.subtitle_stroke_color,
                "strokeWidth": req.subtitle_stroke_width,
                "textTransform": req.subtitle_text_transform,
                "animation": req.subtitle_animation,
                "highlightMode": req.subtitle_highlight_mode,
                "background": req.subtitle_background,
                "backgroundOpacity": req.subtitle_background_opacity,
                "wordSpacing": req.subtitle_word_spacing
            },
            volume=req.volume,
            fps=fps,
            thumbnail_config=thumbnail_config,
            source_width=source_width,
            source_height=source_height,
            split_zoom_top=getattr(req, "split_zoom_top", 1.0) or 1.0,
            split_zoom_bottom=getattr(req, "split_zoom_bottom", 1.0) or 1.0,
            split_offset_x_top=getattr(req, "split_offset_x_top", 0.0) or 0.0,
            split_offset_y_top=getattr(req, "split_offset_y_top", 0.0) or 0.0,
            split_offset_x_bottom=getattr(req, "split_offset_x_bottom", 0.0) or 0.0,
            split_offset_y_bottom=getattr(req, "split_offset_y_bottom", 0.0) or 0.0,
            censored_segments=censored_segments,
            bleep_audio_src=bleep_audio_src,
            hide_subtitles=not getattr(req, "subtitles_enabled", True),
        )


class RenderPipelineCoordinator(RenderEngine):
    """
    Deep coordinator managing composition compilation, asset staging,
    Remotion subprocess lifecycle, hardware-guided encoding, and SSE progress streaming.
    """
    def __init__(
        self,
        output_dir: str = "static/output",
        config_store: Any = None,
        face_tracker: Any = None,
        media_transcoder: Optional[Any] = None,
        subtitle_engine: Optional[Any] = None,
        clip_session_store: Optional[Any] = None,
        remotion_dir: Optional[str] = None,
        audio_library_dir: Optional[str] = None,
        process_adapter: Optional[RemotionProcessAdapter] = None,
        hardware_profiler: Optional[HardwareProfiler] = None,
    ):
        super().__init__(
            media_transcoder=media_transcoder,
            face_tracker=face_tracker,
            subtitle_engine=subtitle_engine,
            clip_session_store=clip_session_store,
        )
        self.output_dir = output_dir
        self.remotion_dir = os.path.abspath(
            remotion_dir or os.path.join(os.path.dirname(__file__), "../../shared/remotion")
        )
        self.audio_library_dir = os.path.abspath(audio_library_dir) if audio_library_dir else None
        os.makedirs(output_dir, exist_ok=True)

        if config_store is None:
            try:
                main_module = sys.modules.get("main")
                if main_module and hasattr(main_module, "config_store"):
                    config_store = main_module.config_store
            except Exception:
                pass

        self.config_store = config_store
        self.process_adapter: RemotionProcessAdapter = process_adapter or SubprocessRemotionAdapter()
        self.hardware_profiler = hardware_profiler
        self._cached_hardware_metrics: Optional[HostHardwareMetrics] = None
        self._hardware_metrics_lock = threading.Lock()

        if self.media_transcoder is None:
            try:
                from core.media_transcoder import MediaTranscoder
                self.media_transcoder = MediaTranscoder(config_store=self.config_store)
            except Exception:
                self.media_transcoder = None

        if self.clip_session_store is None:
            try:
                from core.clip_session_store import ClipSessionStore
                self.clip_session_store = ClipSessionStore(
                    config_store=self.config_store,
                    media_transcoder=self.media_transcoder,
                )
            except Exception:
                self.clip_session_store = None

    def terminate_all(self) -> None:
        self.process_adapter.terminate_all()

    def _get_config_value(self, key: str) -> Optional[str]:
        if self.config_store is not None:
            return self.config_store.get(key)
        return os.environ.get(key)

    def _build_subprocess_env(self) -> Dict[str, str]:
        env = os.environ.copy()
        env["FORCE_COLOR"] = "0"
        env["NO_COLOR"] = "1"

        extra_paths: List[str] = []
        ffmpeg_val = self._get_config_value("FFMPEG_PATH")
        if ffmpeg_val is not None and ffmpeg_val.strip():
            expanded_ffmpeg = os.path.expanduser(ffmpeg_val.strip())
            env["FFMPEG_PATH"] = expanded_ffmpeg
            bin_dir = _resolve_bin_dir(expanded_ffmpeg, ("ffmpeg", "ffmpeg.exe"))
            if bin_dir:
                extra_paths.append(bin_dir)
        elif self.config_store is not None:
            env.pop("FFMPEG_PATH", None)

        node_val = self._get_config_value("NODE_PATH")
        if node_val is not None and node_val.strip():
            expanded_node = os.path.expanduser(node_val.strip())
            env["NODE_PATH"] = expanded_node
            bin_dir = _resolve_bin_dir(expanded_node, ("node", "node.exe"))
            if bin_dir:
                extra_paths.append(bin_dir)
        elif self.config_store is not None:
            env.pop("NODE_PATH", None)

        if sys.platform.startswith("win"):
            default_paths = [
                "C:\\Program Files\\ffmpeg\\bin",
                "C:\\ffmpeg\\bin",
                "C:\\Program Files\\nodejs",
            ]
        else:
            default_paths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]

        sep = ";" if sys.platform.startswith("win") else ":"
        existing_parts = [p for p in env.get("PATH", "").split(sep) if p]

        prefix_parts: List[str] = []
        for p in extra_paths:
            if p and p not in prefix_parts and p not in existing_parts:
                prefix_parts.append(p)

        suffix_parts: List[str] = []
        for p in default_paths:
            if os.path.exists(p) and p not in prefix_parts and p not in existing_parts and p not in suffix_parts:
                suffix_parts.append(p)

        env["PATH"] = sep.join(prefix_parts + existing_parts + suffix_parts)
        return env

    def _ensure_ffmpeg_available(self) -> None:
        transcoder = self.media_transcoder
        if transcoder is not None and hasattr(transcoder, "is_ffmpeg_available"):
            if transcoder.is_ffmpeg_available():
                return
        elif transcoder is not None and hasattr(transcoder, "resolve_ffmpeg_path"):
            if transcoder.resolve_ffmpeg_path():
                return
        else:
            scoped_path = self._build_subprocess_env().get("PATH", "")
            if shutil.which("ffmpeg", path=scoped_path):
                return

        raise RuntimeError(
            "Friendly Alert: FFmpeg was not detected on this machine. "
            "Please download/install FFmpeg and configure FFMPEG_PATH in Settings."
        )

    def _get_hardware_metrics(self) -> HostHardwareMetrics:
        with self._hardware_metrics_lock:
            if self._cached_hardware_metrics is not None:
                return self._cached_hardware_metrics
            profiler = self.hardware_profiler or HardwareProfiler()
            try:
                metrics = profiler.metrics_source.probe_metrics()
            except Exception:
                metrics = HostHardwareMetrics(
                    cpu=CPUMetrics(
                        brand="unknown",
                        arch="unknown",
                        cores=os.cpu_count() or 4,
                        system_os="Darwin" if sys.platform == "darwin" else ("Windows" if sys.platform == "win32" else "Linux"),
                    ),
                    total_ram_gb=8.0,
                    gpu=GPUMetrics(type="cpu", name="Fallback CPU", vram_gb=None),
                )
            self._cached_hardware_metrics = metrics
            return metrics

    def _resolve_execution_policy(self) -> RenderExecutionPolicy:
        return resolve_render_execution_policy(
            self._get_hardware_metrics(),
            hardware_acceleration_override=self._get_config_value("REMOTION_HARDWARE_ACCELERATION"),
            concurrency_override=self._get_config_value("REMOTION_CONCURRENCY"),
        )

    @staticmethod
    def resolve_remotion_command(remotion_dir: str, env_path: Optional[str] = None) -> List[str]:
        """
        Resolve the Remotion CLI command.
        Prefers direct execution of local node_modules/.bin/remotion (.cmd on Windows)
        to eliminate npm/npx package resolution overhead and npm 11+ getBinFromManifest failure.
        Falls back to npx --package=@remotion/cli remotion.
        """
        bin_name = "remotion.cmd" if sys.platform == "win32" else "remotion"
        local_bin = os.path.abspath(os.path.join(remotion_dir, "node_modules", ".bin", bin_name))
        if os.path.isfile(local_bin):
            return [local_bin]

        if env_path is not None:
            if sys.platform == "win32":
                npx_bin = shutil.which("npx.cmd", path=env_path) or shutil.which("npx", path=env_path) or "npx.cmd"
            else:
                npx_bin = shutil.which("npx", path=env_path) or "npx"
        else:
            npx_bin = (
                (shutil.which("npx.cmd") or shutil.which("npx") or "npx.cmd")
                if sys.platform == "win32"
                else (shutil.which("npx") or "npx")
            )
        return [npx_bin, "--package=@remotion/cli", "remotion"]

    @staticmethod
    def _compute_remotion_bundle_hash(remotion_dir: str) -> str:
        """Compute deterministic SHA-256 hash of Remotion dependencies, config, src/, and public/."""
        hasher = hashlib.sha256()
        hasher.update(b"remotion-bundle-v1\0")

        for fname in ("package.json", "package-lock.json", "remotion.config.ts", "tsconfig.json"):
            fpath = os.path.join(remotion_dir, fname)
            if not os.path.isfile(fpath):
                continue
            hasher.update(fname.encode("utf-8"))
            try:
                with open(fpath, "rb") as f:
                    hasher.update(f.read())
            except OSError:
                pass

        transient_prefixes = ("source_", "cover_", "audio_", "props_")
        for subdir in ("src", "public"):
            dir_path = os.path.join(remotion_dir, subdir)
            if not os.path.isdir(dir_path):
                continue
            file_entries: List[Tuple[str, int, int]] = []
            for root, _, files in os.walk(dir_path):
                for file in files:
                    if file == ".DS_Store":
                        continue
                    if subdir == "public" and file.startswith(transient_prefixes):
                        continue
                    full_p = os.path.join(root, file)
                    rel_posix = os.path.relpath(full_p, remotion_dir).replace("\\", "/")
                    try:
                        st = os.stat(full_p)
                        file_entries.append((rel_posix, st.st_size, st.st_mtime_ns))
                    except OSError:
                        pass
            file_entries.sort()
            for rel_posix, size, mtime_ns in file_entries:
                hasher.update(f"{rel_posix}:{size}:{mtime_ns}\0".encode("utf-8"))

        return hasher.hexdigest()

    def _inspect_bundle_state(self, remotion_dir: str) -> Tuple[bool, str, str]:
        """Inspect whether .bundle/index.html exists and matches the current source SHA-256 hash."""
        bundle_dir = os.path.join(remotion_dir, ".bundle")
        index_html = os.path.join(bundle_dir, "index.html")
        hash_file = os.path.join(bundle_dir, ".bundle.hash")
        current_hash = self._compute_remotion_bundle_hash(remotion_dir)

        stored_hash = ""
        if os.path.isfile(hash_file):
            try:
                with open(hash_file, "r", encoding="utf-8") as f:
                    stored_hash = f.read().strip()
            except OSError:
                stored_hash = ""

        is_fresh = os.path.isfile(index_html) and bool(current_hash) and stored_hash == current_hash
        return is_fresh, bundle_dir, current_hash

    @staticmethod
    def _cleanup_incomplete_bundle(remotion_dir: str, bundle_dir: str) -> None:
        hash_file = os.path.join(bundle_dir, ".bundle.hash")
        if os.path.isdir(bundle_dir) and not os.path.isfile(hash_file):
            real_remotion = os.path.realpath(remotion_dir)
            real_bundle = os.path.realpath(bundle_dir)
            if os.path.commonpath([real_remotion, real_bundle]) == real_remotion and real_bundle != real_remotion:
                shutil.rmtree(bundle_dir, ignore_errors=True)

    @staticmethod
    def _remove_partial_output(output_path: str) -> None:
        if output_path and os.path.lexists(output_path):
            try:
                os.remove(output_path)
            except OSError:
                pass

    def _ensure_remotion_bundle(
        self,
        remotion_dir: str,
        cancel_event: Optional[threading.Event] = None,
    ) -> str:
        """Build or reuse a SHA-256 cached Remotion Webpack bundle inside .bundle/."""
        if cancel_event is not None and cancel_event.is_set():
            raise RenderCancelledError("Remotion bundling cancelled")

        acquired = False
        while not acquired:
            if cancel_event is not None and cancel_event.is_set():
                raise RenderCancelledError("Remotion bundling cancelled")
            acquired = _BUNDLE_LOCK.acquire(timeout=0.05)

        try:
            is_fresh, bundle_dir, current_hash = self._inspect_bundle_state(remotion_dir)
            if is_fresh:
                os.makedirs(os.path.join(bundle_dir, "public"), exist_ok=True)
                print(f"[render-engine] Reusing cached Remotion bundle: {bundle_dir}", flush=True)
                return bundle_dir

            hash_file = os.path.join(bundle_dir, ".bundle.hash")
            if os.path.isfile(hash_file):
                try:
                    os.remove(hash_file)
                except OSError:
                    pass

            if os.path.isdir(bundle_dir) and not os.path.isfile(os.path.join(bundle_dir, "index.html")):
                real_remotion = os.path.realpath(remotion_dir)
                real_bundle = os.path.realpath(bundle_dir)
                if os.path.commonpath([real_remotion, real_bundle]) == real_remotion and real_bundle != real_remotion:
                    shutil.rmtree(bundle_dir, ignore_errors=True)

            env = self._build_subprocess_env()
            remotion_cmd = self.resolve_remotion_command(remotion_dir, env_path=env.get("PATH"))
            bundle_cmd = remotion_cmd + ["bundle", "src/index.ts", "--out-dir", ".bundle"]
            print(f"[render-engine] Building cached Remotion bundle: {' '.join(bundle_cmd)}", flush=True)

            result = self.process_adapter.run(
                bundle_cmd,
                cwd=remotion_dir,
                env=env,
                cancel_event=cancel_event,
            )

            if result.cancelled or (cancel_event is not None and cancel_event.is_set()):
                self._cleanup_incomplete_bundle(remotion_dir, bundle_dir)
                raise RenderCancelledError("Remotion bundling cancelled")

            index_html = os.path.join(bundle_dir, "index.html")
            if result.returncode != 0 or not os.path.isfile(index_html):
                self._cleanup_incomplete_bundle(remotion_dir, bundle_dir)
                stdout_tail = (result.stdout or "").strip()
                stderr_tail = (result.stderr or "").strip()
                detail = f"Stdout:\n{stdout_tail}\nStderr:\n{stderr_tail}" if stdout_tail else stderr_tail
                raise RuntimeError(f"Remotion bundle failed with code {result.returncode}: {detail}".strip())

            os.makedirs(os.path.join(bundle_dir, "public"), exist_ok=True)
            tmp_hash = f"{hash_file}.tmp.{uuid.uuid4().hex}"
            try:
                with open(tmp_hash, "w", encoding="utf-8") as f:
                    f.write(current_hash)
                os.replace(tmp_hash, hash_file)
            finally:
                if os.path.exists(tmp_hash):
                    try:
                        os.remove(tmp_hash)
                    except OSError:
                        pass

            return bundle_dir
        finally:
            _BUNDLE_LOCK.release()

    def _stage_render_context(
        self,
        comp: RenderComposition,
        out_filename: str,
        bundle_dir: str,
    ) -> StagedRenderContext:
        """Create a StagedRenderContext targeting the cached .bundle/public/ directory."""
        return StagedRenderContext(
            comp,
            out_filename,
            self.output_dir,
            remotion_dir=self.remotion_dir,
            public_dir=os.path.join(bundle_dir, "public"),
            audio_library_dir=self.audio_library_dir,
        )

    def _build_remotion_cmd(
        self,
        ctx: StagedRenderContext,
        comp: RenderComposition,
        output_path: str,
        *,
        hardware_acceleration: Optional[str] = None,
        concurrency: Optional[int] = None,
        env_path: Optional[str] = None,
    ) -> List[str]:
        remotion_cmd = (
            self.resolve_remotion_command(ctx.remotion_dir, env_path=env_path)
            if env_path is not None
            else self.resolve_remotion_command(ctx.remotion_dir)
        )
        # Normalize paths with forward slashes to prevent backslash escape collisions on Windows
        props_path = (ctx.props_path or "").replace("\\", "/")
        norm_output_path = os.path.abspath(output_path).replace("\\", "/")

        if hardware_acceleration is None or concurrency is None:
            policy = self._resolve_execution_policy()
            hw_accel = hardware_acceleration or policy.hardware_acceleration
            resolved_concurrency = concurrency if concurrency is not None else policy.concurrency
        else:
            hw_accel = hardware_acceleration
            resolved_concurrency = concurrency

        return remotion_cmd + [
            "render",
            ".bundle", "YonruClip",
            "--props", props_path,
            norm_output_path,
            "--overwrite",
            f"--fps={comp.fps}",
            "--width=1080",
            "--height=1920",
            "--frames", f"0-{ctx.frames-1}",
            f"--hardware-acceleration={hw_accel}",
            f"--concurrency={resolved_concurrency}",
        ]

    def _render_comp(
        self,
        comp: RenderComposition,
        out_filename: str,
        cancel_event: Optional[threading.Event] = None,
    ) -> Optional[str]:
        output_path = os.path.join(self.output_dir, out_filename)
        try:
            self._ensure_ffmpeg_available()
            bundle_dir = self._ensure_remotion_bundle(self.remotion_dir, cancel_event=cancel_event)
        except RenderCancelledError:
            print("[render-engine] Render cancelled before execution", flush=True)
            return None
        except Exception as e:
            print(f"[render-engine] {e}", flush=True)
            return None

        output_existed_before = os.path.lexists(output_path)
        render_succeeded = False
        policy = self._resolve_execution_policy()

        with self._stage_render_context(comp, out_filename, bundle_dir) as ctx:
            try:
                hw_accel = policy.hardware_acceleration
                for attempt in range(2):
                    env = self._build_subprocess_env()
                    cmd = self._build_remotion_cmd(
                        ctx,
                        comp,
                        output_path,
                        hardware_acceleration=hw_accel,
                        concurrency=policy.concurrency,
                        env_path=env.get("PATH"),
                    )
                    print(f"[render-engine] Executing Remotion: {' '.join(cmd)}", flush=True)
                    result = self.process_adapter.run(
                        cmd,
                        cwd=ctx.remotion_dir,
                        env=env,
                        cancel_event=cancel_event,
                    )

                    if result.cancelled or (cancel_event is not None and cancel_event.is_set()):
                        return None

                    if result.returncode == 0:
                        render_succeeded = True
                        return output_path

                    stdout_tail = (result.stdout or "").strip()
                    stderr_tail = (result.stderr or "").strip()
                    err_detail = f"Stdout:\n{stdout_tail}\nStderr:\n{stderr_tail}" if stdout_tail else stderr_tail
                    if attempt == 0 and _should_retry_with_software_encoding(
                        hardware_acceleration=hw_accel,
                        returncode=result.returncode,
                        cancelled=False,
                        completed_frames=False,
                        output_tail=err_detail,
                    ):
                        if not output_existed_before:
                            self._remove_partial_output(output_path)
                        print(
                            f"[render-engine] Hardware-accelerated render failed (code {result.returncode}); "
                            "retrying once with software encoding (--hardware-acceleration=disable).",
                            flush=True,
                        )
                        hw_accel = "disable"
                        continue

                    print(f"[render-engine] Remotion failed with code {result.returncode}:\n{err_detail}", flush=True)
                    return None
                return None
            finally:
                if not render_succeeded and not output_existed_before:
                    self._remove_partial_output(output_path)

    def render_streaming(
        self,
        comp: RenderComposition,
        out_filename: str,
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[dict, None, None]:
        output_path = os.path.join(self.output_dir, out_filename)
        total_frames, _ = comp.compute_total_frames()
        parser = RemotionProgressParser(total_frames)
        closing = False
        try:
            yield parser.starting_event()
        except GeneratorExit:
            closing = True
            raise

        try:
            if cancel_event is not None and cancel_event.is_set():
                return

            self._ensure_ffmpeg_available()

            if not self._inspect_bundle_state(self.remotion_dir)[0]:
                try:
                    yield parser.bundling_event(5)
                except GeneratorExit:
                    closing = True
                    raise

            bundle_dir = self._ensure_remotion_bundle(self.remotion_dir, cancel_event=cancel_event)

            output_existed_before = os.path.lexists(output_path)
            render_succeeded = False
            error_message: Optional[str] = None
            policy = self._resolve_execution_policy()

            with self._stage_render_context(comp, out_filename, bundle_dir) as ctx:
                try:
                    hw_accel = policy.hardware_acceleration
                    for attempt in range(2):
                        env = self._build_subprocess_env()
                        cmd = self._build_remotion_cmd(
                            ctx,
                            comp,
                            output_path,
                            hardware_acceleration=hw_accel,
                            concurrency=policy.concurrency,
                            env_path=env.get("PATH"),
                        )
                        print(f"[render-engine-stream] Executing Remotion: {' '.join(cmd)}", flush=True)

                        output_history: List[str] = []
                        max_history = 50
                        run_result = RemotionRunResult(returncode=-1)

                        stream_iter = self.process_adapter.stream(
                            cmd,
                            cwd=ctx.remotion_dir,
                            env=env,
                            cancel_event=cancel_event,
                        )
                        try:
                            while True:
                                if cancel_event is not None and cancel_event.is_set():
                                    break
                                try:
                                    line = next(stream_iter)
                                except StopIteration as stop:
                                    run_result = (
                                        stop.value
                                        if isinstance(stop.value, RemotionRunResult)
                                        else RemotionRunResult(returncode=0)
                                    )
                                    break

                                cleaned = line.strip()
                                if cleaned:
                                    output_history.append(cleaned)
                                    if len(output_history) > max_history:
                                        output_history.pop(0)

                                event = parser.parse_line(line)
                                if event:
                                    try:
                                        yield event
                                    except GeneratorExit:
                                        closing = True
                                        raise
                                elif cleaned:
                                    if any(
                                        token in cleaned.lower()
                                        for token in ["error", "warn", "fail", "exit", "cannot", "unable", "fatal"]
                                    ):
                                        print(f"[render-engine-stream] Remotion output: {cleaned}", flush=True)
                        finally:
                            stream_iter.close()

                        if run_result.cancelled or (cancel_event is not None and cancel_event.is_set()):
                            return

                        if run_result.returncode == 0:
                            render_succeeded = True
                            break

                        tail_output = "\n".join(output_history[-20:])
                        completed_frames = parser.last_frame >= parser.total_frames
                        if attempt == 0 and _should_retry_with_software_encoding(
                            hardware_acceleration=hw_accel,
                            returncode=run_result.returncode,
                            cancelled=False,
                            completed_frames=completed_frames,
                            output_tail=tail_output,
                        ):
                            if not output_existed_before:
                                self._remove_partial_output(output_path)
                            print(
                                f"[render-engine-stream] Hardware-accelerated render failed (code {run_result.returncode}); "
                                "retrying once with software encoding (--hardware-acceleration=disable).",
                                flush=True,
                            )
                            parser = RemotionProgressParser(total_frames)
                            hw_accel = "disable"
                            continue

                        print(
                            f"[render-engine-stream] Remotion failed with code {run_result.returncode}:\n{tail_output}",
                            flush=True,
                        )
                        error_msg = f"Remotion exited with code {run_result.returncode}"
                        if tail_output:
                            error_msg += f":\n{tail_output}"
                        error_message = error_msg
                        break
                finally:
                    if not render_succeeded and not output_existed_before:
                        self._remove_partial_output(output_path)

            if render_succeeded:
                yield parser.complete_event(output_path, f"/static/output/{out_filename}")
            elif error_message is not None:
                yield parser.error_event(error_message)

        except GeneratorExit:
            raise
        except RenderCancelledError:
            return
        except Exception as e:
            print(f"[render-engine-stream] Error: {str(e)}", flush=True)
            if closing:
                raise
            yield parser.error_event(str(e))


# Backward-compatible alias
RemotionRenderEngine = RenderPipelineCoordinator


class FakeRenderEngine(RenderEngine):
    def __init__(
        self,
        output_dir: str = "static/output",
        should_fail: bool = False,
        media_transcoder: Optional[Any] = None,
        face_tracker: Optional[Any] = None,
        subtitle_engine: Optional[Any] = None,
        clip_session_store: Optional[Any] = None,
    ):
        if media_transcoder is None:
            try:
                from core.media_transcoder import MediaTranscoder, FakeMediaAdapter
                media_transcoder = MediaTranscoder(adapter=FakeMediaAdapter())
            except Exception:
                media_transcoder = None
        super().__init__(
            media_transcoder=media_transcoder,
            face_tracker=face_tracker,
            subtitle_engine=subtitle_engine,
            clip_session_store=clip_session_store,
        )
        self.output_dir = output_dir
        self.should_fail = should_fail

    def _render_comp(self, comp: RenderComposition, out_filename: str) -> Optional[str]:
        if self.should_fail:
            return None
        return f"{self.output_dir}/{out_filename}"

    def render_streaming(
        self,
        comp: RenderComposition,
        out_filename: str,
        cancel_event: Optional[threading.Event] = None,
    ) -> Generator[dict, None, None]:
        if cancel_event is not None and cancel_event.is_set():
            return
        if self.should_fail:
            yield {"stage": "error", "message": "Simulated Render Failure"}
            return

        frames = max(1, int((comp.clip_duration or 10.0) * comp.fps))
        events = [
            {"stage": "starting", "percent": 0, "frame": 0, "totalFrames": frames},
            {"stage": "bundling", "percent": 10, "frame": 0, "totalFrames": frames, "etaSeconds": 0},
            {"stage": "rendering", "percent": 50, "frame": frames // 2, "totalFrames": frames, "etaSeconds": 0},
            {"stage": "encoding", "percent": 96, "frame": frames, "totalFrames": frames, "etaSeconds": 0},
            {
                "stage": "done",
                "percent": 100,
                "frame": frames,
                "totalFrames": frames,
                "outputPath": f"{self.output_dir}/{out_filename}",
                "outputUrl": f"/static/output/{out_filename}",
            },
        ]
        for event in events:
            if cancel_event is not None and cancel_event.is_set():
                return
            yield event
