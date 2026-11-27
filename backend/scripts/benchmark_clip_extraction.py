"""
Reproducible micro- and macro-benchmark suite for Candidate #02:
1. Single-pass hardware-guided Ready Clip extraction (video.mp4 + thumbnail.jpg + ephemeral WAV)
2. Frame-0 thumbnail extraction without redundant ffprobe
3. Single-flight concurrent face tracking locking (ensure_crop_map)
4. Read-only ClipSessionStore cache stability across get_clip_session() + list_all_clips()
5. Compact JSON manifest serialization vs. pretty-printed Baseline

Usage:
    cd backend && ./venv/bin/python scripts/benchmark_clip_extraction.py
    cd backend && ./venv/bin/python scripts/benchmark_clip_extraction.py --synthetic --runs 3
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import contextlib
import glob
import io
import json
import os
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from core.clip_session_store import ClipSessionStore
from core.config_store import InMemoryConfigStore
from core.hardware_profiler import HardwareProfiler
from core.media_transcoder import (
    FakeMediaAdapter,
    MediaProcessAdapter,
    MediaSpecs,
    MediaTranscoder,
    SubprocessMediaAdapter,
)


class CountingMediaAdapter(MediaProcessAdapter):
    """Wraps a MediaProcessAdapter and counts FFmpeg/FFprobe subprocess invocations."""

    def __init__(self, inner: MediaProcessAdapter) -> None:
        self._inner = inner
        self.ffmpeg_calls: int = 0
        self.ffprobe_calls: int = 0

    def reset_counts(self) -> None:
        self.ffmpeg_calls = 0
        self.ffprobe_calls = 0

    def run_ffmpeg(self, args: List[str]) -> bool:
        self.ffmpeg_calls += 1
        return self._inner.run_ffmpeg(args)

    def ffprobe_info(self, file_path: str) -> Dict[str, Any]:
        self.ffprobe_calls += 1
        return self._inner.ffprobe_info(file_path)

    def resolve_ffmpeg_path(self) -> Optional[str]:
        return self._inner.resolve_ffmpeg_path()


def _detect_ffmpeg_version() -> str:
    try:
        res = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.splitlines()[0].strip()
    except Exception:
        pass
    return "unknown"


def _resolve_source_video(
    work_dir: str,
    transcoder: MediaTranscoder,
    source_arg: Optional[str],
    synthetic: bool,
    start: float,
    duration: float,
) -> Tuple[str, str, MediaSpecs]:
    """Locate a real source video (read-only) or generate a synthetic 1080p AV source."""
    required_duration = start + duration + 2.0

    if source_arg:
        if not os.path.isfile(source_arg):
            raise FileNotFoundError(f"Specified source video not found: {source_arg}")
        specs = transcoder.probe_video(source_arg)
        if specs.duration < required_duration:
            raise ValueError(
                f"Source video duration ({specs.duration}s) is shorter than requested window "
                f"({start}s + {duration}s + 2s buffer)."
            )
        return source_arg, f"real:{os.path.basename(os.path.dirname(source_arg))}/{os.path.basename(source_arg)}", specs

    if not synthetic:
        pattern = os.path.join(BACKEND_DIR, "temp_assets", "sources", "*", "full.mp4")
        candidates = sorted(
            (p for p in glob.glob(pattern) if os.path.isfile(p)),
            key=lambda p: os.path.getsize(p),
        )
        for candidate in candidates:
            try:
                info = transcoder.adapter.ffprobe_info(candidate)
                streams = info.get("streams", [])
                has_video = any(s.get("codec_type") == "video" for s in streams)
                has_audio = any(s.get("codec_type") == "audio" for s in streams)
                if not (has_video and has_audio):
                    continue
                specs = transcoder.probe_video(candidate)
                if specs.duration >= required_duration:
                    label = f"real:{os.path.basename(os.path.dirname(candidate))}/full.mp4"
                    return candidate, label, specs
            except Exception:
                continue

    synth_path = os.path.join(work_dir, "synthetic_1080p_source.mp4")
    total_dur = max(12.0, required_duration)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f", "lavfi",
            "-i", f"testsrc2=size=1920x1080:rate=30:duration={total_dur}",
            "-f", "lavfi",
            "-i", f"sine=frequency=440:duration={total_dur}",
            "-c:v", "libx264",
            "-preset", "superfast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            synth_path,
        ],
        check=True,
        capture_output=True,
    )
    specs = transcoder.probe_video(synth_path)
    return synth_path, "synthetic:1920x1080@30fps", specs


def _bench_ready_clip_extraction(
    work_dir: str,
    source_path: str,
    start: float,
    duration: float,
    runs: int,
    profiler: HardwareProfiler,
) -> Dict[str, Any]:
    """Benchmark 1: 4-subprocess libx264 baseline vs interleaved single-pass default and alt encoder."""
    base_adapter = SubprocessMediaAdapter()
    metrics = profiler.metrics_source.probe_metrics()
    is_darwin = (metrics.cpu.system_os or "").strip().lower() == "darwin"
    alt_override = "videotoolbox" if is_darwin else "disable"
    alt_label = (
        "Candidate #02 (Opt-In VideoToolbox)"
        if is_darwin
        else "Candidate #02 (Software Override)"
    )

    def run_baseline_once(tag: str) -> Dict[str, Any]:
        adapter = CountingMediaAdapter(base_adapter)
        tc = MediaTranscoder(adapter=adapter, hardware_profiler=profiler)
        run_dir = os.path.join(work_dir, "extract_baseline", tag)
        os.makedirs(run_dir, exist_ok=True)
        video_out = os.path.join(run_dir, "video.mp4")
        thumb_out = os.path.join(run_dir, "thumbnail.jpg")
        audio_v2_out = os.path.join(run_dir, "audio_v2.wav")

        buf = io.StringIO()
        t0 = time.perf_counter()
        with contextlib.redirect_stdout(buf):
            # 1. Cut video with legacy hardcoded libx264 flags
            adapter.run_ffmpeg([
                "-accurate_seek",
                "-ss", str(start),
                "-i", source_path,
                "-t", str(duration),
                "-c:v", "libx264",
                "-preset", "superfast",
                "-crf", "23",
                "-c:a", "aac",
                "-avoid_negative_ts", "auto",
                "-y", video_out,
            ])
            # 2 & 3. Legacy frame-0 extraction probed the cut video, then extracted frame 0
            tc.invalidate_probe_cache(video_out)
            _ = tc.get_video_duration(video_out)
            adapter.run_ffmpeg([
                "-y", "-ss", "0.0", "-i", video_out,
                "-vframes", "1", "-q:v", "2", thumb_out,
            ])
            # 4. Legacy transcription WAV persisted audio_v2.wav in clip directory
            adapter.run_ffmpeg([
                "-i", video_out, "-vn", "-acodec", "pcm_s16le",
                "-ar", "16000", "-ac", "1", "-y", audio_v2_out,
            ])
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return {
            "elapsed_ms": elapsed_ms,
            "encoder": "libx264",
            "subprocesses": adapter.ffmpeg_calls + adapter.ffprobe_calls,
            "ffmpeg_calls": adapter.ffmpeg_calls,
            "ffprobe_calls": adapter.ffprobe_calls,
            "video_bytes": os.path.getsize(video_out),
            "thumb_bytes": os.path.getsize(thumb_out),
            "wav_bytes": os.path.getsize(audio_v2_out),
            "persistent_audio_bytes": os.path.getsize(audio_v2_out),
        }

    def run_single_pass_once(tag: str, hw_override: Optional[str]) -> Dict[str, Any]:
        adapter = CountingMediaAdapter(base_adapter)
        cfg = (
            InMemoryConfigStore({"FFMPEG_HARDWARE_ACCELERATION": hw_override})
            if hw_override is not None
            else None
        )
        tc = MediaTranscoder(adapter=adapter, config_store=cfg, hardware_profiler=profiler)
        mode_slug = "single_default" if hw_override is None else f"single_{hw_override}"
        run_dir = os.path.join(work_dir, mode_slug, tag)
        os.makedirs(run_dir, exist_ok=True)
        video_out = os.path.join(run_dir, "video.mp4")
        thumb_out = os.path.join(run_dir, "thumbnail.jpg")
        temp_wav = os.path.join(run_dir, "ephemeral.wav")

        buf = io.StringIO()
        wav_bytes = 0
        t0 = time.perf_counter()
        with contextlib.redirect_stdout(buf):
            res = tc.extract_clip_bundle(
                source_path,
                start,
                round(start + duration, 3),
                video_out,
                output_thumbnail_path=thumb_out,
                output_audio_path=temp_wav,
            )
            if res.audio_path and os.path.exists(res.audio_path):
                wav_bytes = os.path.getsize(res.audio_path)
                os.remove(res.audio_path)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        persistent_audio = (
            os.path.getsize(os.path.join(run_dir, "audio_v2.wav"))
            if os.path.exists(os.path.join(run_dir, "audio_v2.wav"))
            else 0
        )
        return {
            "elapsed_ms": elapsed_ms,
            "encoder": res.encoder,
            "subprocesses": adapter.ffmpeg_calls + adapter.ffprobe_calls,
            "ffmpeg_calls": adapter.ffmpeg_calls,
            "ffprobe_calls": adapter.ffprobe_calls,
            "video_bytes": os.path.getsize(video_out),
            "thumb_bytes": os.path.getsize(thumb_out),
            "wav_bytes": wav_bytes,
            "persistent_audio_bytes": persistent_audio,
        }

    modes = [
        ("baseline", "Baseline (4 serial procs)", lambda tag: run_baseline_once(tag)),
        ("single_pass_default", "Candidate #02 (Auto Default)", lambda tag: run_single_pass_once(tag, None)),
        ("single_pass_alt", alt_label, lambda tag: run_single_pass_once(tag, alt_override)),
    ]

    for key, _, fn in modes:
        fn(f"{key}_warmup")

    samples_by_key: Dict[str, List[Dict[str, Any]]] = {key: [] for key, _, _ in modes}
    for r in range(runs):
        round_modes = modes if r % 2 == 0 else list(reversed(modes))
        for key, _, fn in round_modes:
            samples_by_key[key].append(fn(f"{key}_run_{r}"))

    summary: Dict[str, Any] = {}
    for key, label, _ in modes:
        samples = samples_by_key[key]
        times = [s["elapsed_ms"] for s in samples]
        last = samples[-1]
        summary[key] = {
            "label": label,
            "median_ms": round(statistics.median(times), 1),
            "mean_ms": round(statistics.mean(times), 1),
            "min_ms": round(min(times), 1),
            "max_ms": round(max(times), 1),
            "runs_ms": [round(t, 1) for t in times],
            "encoder": last["encoder"],
            "subprocesses": last["subprocesses"],
            "ffmpeg_calls": last["ffmpeg_calls"],
            "ffprobe_calls": last["ffprobe_calls"],
            "video_bytes": last["video_bytes"],
            "thumb_bytes": last["thumb_bytes"],
            "wav_bytes": last["wav_bytes"],
            "persistent_audio_bytes": last["persistent_audio_bytes"],
        }

    base_med = float(summary["baseline"]["median_ms"])
    for key, _, _ in modes:
        entry = summary[key]
        entry["speedup"] = round(base_med / max(0.1, float(entry["median_ms"])), 2)

    return summary


def _bench_frame_zero_extraction(
    work_dir: str,
    source_path: str,
    start: float,
    runs: int,
) -> Dict[str, Any]:
    """Benchmark 2: Frame-0 thumbnail extraction (ffprobe+ffmpeg vs zero-ffprobe extract_frame)."""
    base_adapter = SubprocessMediaAdapter()
    ref_clip = os.path.join(work_dir, "frame_zero_ref.mp4")
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        MediaTranscoder(adapter=base_adapter).slice_video(source_path, start, start + 5.0, ref_clip)

    baseline_times: List[float] = []
    candidate_times: List[float] = []

    base_counter = CountingMediaAdapter(base_adapter)
    base_tc = MediaTranscoder(adapter=base_counter)
    cand_counter = CountingMediaAdapter(base_adapter)
    cand_tc = MediaTranscoder(adapter=cand_counter)

    # Warmup
    with contextlib.redirect_stdout(io.StringIO()):
        _ = base_tc.get_video_duration(ref_clip)
        base_counter.run_ffmpeg(["-y", "-ss", "0.0", "-i", ref_clip, "-vframes", "1", "-q:v", "2", os.path.join(work_dir, "fz_w1.jpg")])
        cand_tc.extract_frame(ref_clip, 0.0, os.path.join(work_dir, "fz_w2.jpg"))

    base_counter.reset_counts()
    cand_counter.reset_counts()

    for i in range(runs):
        out_b = os.path.join(work_dir, f"fz_base_{i}.jpg")
        out_c = os.path.join(work_dir, f"fz_cand_{i}.jpg")

        base_tc.invalidate_probe_cache(ref_clip)
        t0 = time.perf_counter()
        with contextlib.redirect_stdout(io.StringIO()):
            _ = base_tc.get_video_duration(ref_clip)
            base_counter.run_ffmpeg(["-y", "-ss", "0.0", "-i", ref_clip, "-vframes", "1", "-q:v", "2", out_b])
        baseline_times.append((time.perf_counter() - t0) * 1000.0)

        cand_tc.invalidate_probe_cache(ref_clip)
        t1 = time.perf_counter()
        with contextlib.redirect_stdout(io.StringIO()):
            cand_tc.extract_frame(ref_clip, 0.0, out_c)
        candidate_times.append((time.perf_counter() - t1) * 1000.0)

    base_med = statistics.median(baseline_times)
    cand_med = statistics.median(candidate_times)
    return {
        "baseline": {
            "median_ms": round(base_med, 1),
            "subprocesses_per_run": (base_counter.ffmpeg_calls + base_counter.ffprobe_calls) // max(1, runs),
            "ffprobe_per_run": base_counter.ffprobe_calls // max(1, runs),
        },
        "candidate": {
            "median_ms": round(cand_med, 1),
            "subprocesses_per_run": (cand_counter.ffmpeg_calls + cand_counter.ffprobe_calls) // max(1, runs),
            "ffprobe_per_run": cand_counter.ffprobe_calls // max(1, runs),
            "speedup": round(base_med / max(0.1, cand_med), 2),
        },
    }


def _bench_single_flight_crop_map(work_dir: str, workers: int = 4) -> Dict[str, Any]:
    """Benchmark 3: Unlocked concurrent tracking vs single-flight per-clip ensure_crop_map."""
    clips_dir = os.path.join(work_dir, "sf_clips")
    store = ClipSessionStore(clips_dir=clips_dir, output_dir=work_dir)
    for cid in ("clip_unlocked", "clip_same", "clip_p1", "clip_p2"):
        cdir = os.path.join(clips_dir, "vid", cid)
        os.makedirs(cdir, exist_ok=True)
        with open(os.path.join(cdir, "video.mp4"), "wb") as f:
            f.write(b"video")

    analyze_cost_s = 0.15

    class TimedStubTracker:
        def __init__(self) -> None:
            self.calls = 0
            self._lock = threading.Lock()

        def analyze_video(self, _video_path: str) -> List[Dict[str, Any]]:
            with self._lock:
                self.calls += 1
            time.sleep(analyze_cost_s)
            return [{"time": 0.0, "x": 960}]

    # Baseline simulation: unlocked read-miss -> barrier -> analyze_video per thread
    unlocked_tracker = TimedStubTracker()
    barrier = threading.Barrier(workers, timeout=5.0)

    def unlocked_worker() -> None:
        existing = store.get_crop_map("vid", "clip_unlocked")
        assert existing is None
        barrier.wait()
        points = unlocked_tracker.analyze_video(os.path.join(clips_dir, "vid", "clip_unlocked", "video.mp4"))
        store.save_crop_map("vid", "clip_unlocked", points)

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(unlocked_worker) for _ in range(workers)]
        for f in futs:
            f.result()
    unlocked_wall_ms = (time.perf_counter() - t0) * 1000.0
    unlocked_cpu_ms = unlocked_tracker.calls * analyze_cost_s * 1000.0

    # Candidate #02: single-flight same-clip locking
    sf_tracker = TimedStubTracker()
    t1 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [
            pool.submit(store.ensure_crop_map, "vid", "clip_same", tracker=sf_tracker)
            for _ in range(workers)
        ]
        for f in futs:
            f.result()
    sf_wall_ms = (time.perf_counter() - t1) * 1000.0
    sf_cpu_ms = sf_tracker.calls * analyze_cost_s * 1000.0

    # Cross-clip parallelism verification
    parallel_tracker = TimedStubTracker()
    t2 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=2) as pool:
        fa = pool.submit(store.ensure_crop_map, "vid", "clip_p1", tracker=parallel_tracker)
        fb = pool.submit(store.ensure_crop_map, "vid", "clip_p2", tracker=parallel_tracker)
        fa.result()
        fb.result()
    cross_clip_wall_ms = (time.perf_counter() - t2) * 1000.0

    return {
        "workers": workers,
        "tracker_cost_ms": round(analyze_cost_s * 1000.0, 1),
        "baseline_unlocked": {
            "analyze_calls": unlocked_tracker.calls,
            "wall_ms": round(unlocked_wall_ms, 1),
            "tracker_cpu_ms": round(unlocked_cpu_ms, 1),
        },
        "candidate_single_flight": {
            "analyze_calls": sf_tracker.calls,
            "wall_ms": round(sf_wall_ms, 1),
            "tracker_cpu_ms": round(sf_cpu_ms, 1),
            "duplicate_reduction_pct": round(
                (1.0 - (sf_tracker.calls / max(1, unlocked_tracker.calls))) * 100.0, 1
            ),
        },
        "cross_clip_parallel": {
            "clips": 2,
            "analyze_calls": parallel_tracker.calls,
            "wall_ms": round(cross_clip_wall_ms, 1),
        },
    }


def _bench_ready_clip_cache_stability(work_dir: str, num_clips: int = 30, cycles: int = 20) -> Dict[str, Any]:
    """Benchmark 4: Cache epoch & redundant ffprobe calls across get_clip_session + list_all_clips."""
    clips_dir = os.path.join(work_dir, "cache_clips")
    adapter = FakeMediaAdapter(default_duration=24.0)
    transcoder = MediaTranscoder(adapter=adapter)
    store = ClipSessionStore(clips_dir=clips_dir, output_dir=work_dir, media_transcoder=transcoder)

    for i in range(num_clips):
        clip_id = f"legacy_clip_{i:02d}"
        cdir = os.path.join(clips_dir, "bench_folder", clip_id)
        os.makedirs(cdir, exist_ok=True)
        with open(os.path.join(cdir, "video.mp4"), "wb") as f:
            f.write(b"video")
        with open(os.path.join(cdir, "thumbnail.jpg"), "wb") as f:
            f.write(b"thumb")
        store.ensure_clip_defaults("bench_folder", clip_id)
        store.save_crop_map("bench_folder", clip_id, [{"time": 0.0, "x": 960}])

    # Warm initial Ready Clips cache
    _ = store.list_all_clips()
    adapter.calls.clear()

    # Candidate #02: read-only session opens leave cache intact
    epoch_start = store._cache_epoch
    t0 = time.perf_counter()
    for i in range(cycles):
        cid = f"legacy_clip_{i % num_clips:02d}"
        _ = store.get_clip_session("bench_folder", cid, ensure_crop_map=True)
        _ = store.list_all_clips()
    cand_ms = (time.perf_counter() - t0) * 1000.0
    cand_epoch_bumps = store._cache_epoch - epoch_start
    cand_probes = sum(1 for name, _ in adapter.calls if name == "ffprobe_info")

    # Baseline simulation: unconditional invalidation inside ensure_clip_defaults
    adapter.calls.clear()
    epoch_base_start = store._cache_epoch
    t1 = time.perf_counter()
    for i in range(cycles):
        cid = f"legacy_clip_{i % num_clips:02d}"
        _ = store.get_clip_session("bench_folder", cid, ensure_crop_map=True)
        store.invalidate_ready_clips_cache("bench_folder", cid)
        _ = store.list_all_clips()
    base_ms = (time.perf_counter() - t1) * 1000.0
    base_epoch_bumps = store._cache_epoch - epoch_base_start
    base_probes = sum(1 for name, _ in adapter.calls if name == "ffprobe_info")

    return {
        "num_clips": num_clips,
        "cycles": cycles,
        "baseline": {
            "epoch_bumps": base_epoch_bumps,
            "redundant_ffprobes": base_probes,
            "total_ms": round(base_ms, 2),
        },
        "candidate": {
            "epoch_bumps": cand_epoch_bumps,
            "redundant_ffprobes": cand_probes,
            "total_ms": round(cand_ms, 2),
        },
    }


def _load_sample_manifests() -> Tuple[Dict[str, Any], str]:
    """Load real manifest payloads from temp_assets/clips read-only, or synthesize realistic ones."""
    clips_root = os.path.join(BACKEND_DIR, "temp_assets", "clips")

    def find_largest(filename: str) -> Optional[Tuple[str, Any]]:
        candidates = glob.glob(os.path.join(clips_root, "*", "*", filename))
        if not candidates:
            return None
        for path in sorted(candidates, key=lambda p: os.path.getsize(p), reverse=True):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return path, json.load(f)
            except Exception:
                continue
        return None

    real_history = find_largest("history.json")
    real_transcript = find_largest("transcript.json")
    real_crop_map = find_largest("crop_map.json")
    real_timeline = find_largest("timeline.json")

    if real_history and real_transcript and real_crop_map:
        source_label = f"real:{os.path.basename(os.path.dirname(real_history[0]))}"
        history_data = real_history[1]
        transcript_data = real_transcript[1]
        crop_map_data = real_crop_map[1]
        timeline_data = real_timeline[1] if real_timeline else [
            {"id": "text_1", "type": "text", "items": [{"id": "t1", "start": 0.0, "end": 4.5, "text": "Key hook"}]}
        ]
    else:
        source_label = "synthetic:500w_300kf_20snap"
        transcript_data = [
            {"start": round(i * 0.25, 3), "duration": 0.22, "text": f"word{i}"}
            for i in range(500)
        ]
        crop_map_data = [
            {"time": round(i * 0.1, 2), "x": 900 + (i % 120)}
            for i in range(300)
        ]
        timeline_data = [
            {
                "id": "track_text",
                "type": "text",
                "items": [
                    {"id": f"item_{i}", "start": float(i * 2), "end": float(i * 2 + 1.5), "text": f"Caption {i}"}
                    for i in range(15)
                ],
            }
        ]
        history_data = {
            "undo_stack": [
                {"tracks": timeline_data, "transcript": transcript_data[:100]}
                for _ in range(20)
            ],
            "redo_stack": [],
        }

    payload = {
        "history": history_data,
        "transcript": transcript_data,
        "crop_map": crop_map_data,
        "timeline": timeline_data,
        "style_settings": {"font": "Montserrat", "fontSize": 50, "cropMode": "face_tracking"},
        "cover_config": {"enabled": False, "duration": 1.0, "screenshotTime": 0, "textOverlays": [], "xOffset": 50},
    }
    return payload, source_label


def _bench_manifest_json_serialization(work_dir: str, iterations: int = 30) -> Dict[str, Any]:
    """Benchmark 5: Compact machine manifests vs indent=2 baseline atomic write + read."""
    payload, sample_source = _load_sample_manifests()
    manifest_map = {
        "history.json": payload["history"],
        "transcript.json": payload["transcript"],
        "crop_map.json": payload["crop_map"],
        "timeline.json": payload["timeline"],
    }
    config_map = {
        "style_settings.json": payload["style_settings"],
        "cover_config.json": payload["cover_config"],
    }

    pretty_dir = os.path.join(work_dir, "json_pretty")
    os.makedirs(pretty_dir, exist_ok=True)
    pretty_write_ms: List[float] = []
    pretty_read_ms: List[float] = []

    for _ in range(iterations):
        t0 = time.perf_counter()
        staged: List[Tuple[str, str]] = []
        for fname, data in {**manifest_map, **config_map}.items():
            target = os.path.join(pretty_dir, fname)
            tmp = f"{target}.tmp"
            staged.append((tmp, target))
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
        for tmp, target in staged:
            os.replace(tmp, target)
        pretty_write_ms.append((time.perf_counter() - t0) * 1000.0)

        t1 = time.perf_counter()
        for fname in manifest_map:
            with open(os.path.join(pretty_dir, fname), "r", encoding="utf-8") as f:
                _ = json.load(f)
        pretty_read_ms.append((time.perf_counter() - t1) * 1000.0)

    store = ClipSessionStore(clips_dir=os.path.join(work_dir, "json_compact_clips"), output_dir=work_dir)
    compact_clip_dir = store.resolve_clip_dir("bench", "clip_json")
    compact_write_ms: List[float] = []
    compact_read_ms: List[float] = []

    for _ in range(iterations):
        t0 = time.perf_counter()
        store.save_clip_session("bench", "clip_json", payload)
        compact_write_ms.append((time.perf_counter() - t0) * 1000.0)

        t1 = time.perf_counter()
        for fname in manifest_map:
            with open(os.path.join(compact_clip_dir, fname), "r", encoding="utf-8") as f:
                _ = json.load(f)
        compact_read_ms.append((time.perf_counter() - t1) * 1000.0)

    pretty_bytes = sum(os.path.getsize(os.path.join(pretty_dir, fname)) for fname in manifest_map)
    compact_bytes = sum(os.path.getsize(os.path.join(compact_clip_dir, fname)) for fname in manifest_map)
    per_file_sizes = {
        fname: {
            "baseline_bytes": os.path.getsize(os.path.join(pretty_dir, fname)),
            "compact_bytes": os.path.getsize(os.path.join(compact_clip_dir, fname)),
        }
        for fname in manifest_map
    }

    configs_remain_pretty = all(
        "\n" in open(os.path.join(compact_clip_dir, fname), "r", encoding="utf-8").read()
        for fname in config_map
    )

    return {
        "sample_source": sample_source,
        "iterations": iterations,
        "configs_remain_pretty": configs_remain_pretty,
        "baseline": {
            "total_manifest_bytes": pretty_bytes,
            "write_median_ms": round(statistics.median(pretty_write_ms), 2),
            "read_median_ms": round(statistics.median(pretty_read_ms), 2),
        },
        "candidate": {
            "total_manifest_bytes": compact_bytes,
            "size_reduction_pct": round((1.0 - (compact_bytes / max(1, pretty_bytes))) * 100.0, 1),
            "write_median_ms": round(statistics.median(compact_write_ms), 2),
            "read_median_ms": round(statistics.median(compact_read_ms), 2),
        },
        "per_file_sizes": per_file_sizes,
    }


def _fmt_bytes(num_bytes: int) -> str:
    if num_bytes >= 1024 * 1024:
        return f"{num_bytes / (1024 * 1024):.2f} MB"
    if num_bytes >= 1024:
        return f"{num_bytes / 1024:.1f} KB"
    return f"{num_bytes} B"


def _print_report(report: Dict[str, Any]) -> None:
    env = report["environment"]
    print("# Candidate #02 Benchmark Report\n")
    print(f"- **Host**: `{env['system_os']}` | CPU: `{env['cpu_brand']}` ({env['cpu_cores']} cores) | GPU: `{env['gpu_type']}` (`{env['gpu_name']}`)")
    print(f"- **FFmpeg**: `{env['ffmpeg_version']}`")
    print(
        f"- **Source**: `{env['source_label']}` ({env['source_width']}x{env['source_height']} @ {env['source_fps']}fps, "
        f"duration={env['source_duration']}s, window=`[{env['clip_start']}s, {env['clip_start'] + env['clip_duration']}s]`)\n"
    )

    b1 = report["benchmarks"]["ready_clip_extraction"]
    print("## 1. Ready Clip Extraction (`video.mp4` + `thumbnail.jpg` + 16 kHz WAV)")
    print("| Mode | Encoder | Subprocesses | Median (ms) | Mean (ms) | Speedup | Video Size | Persistent WAV Left |")
    print("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for key in ("baseline", "single_pass_default", "single_pass_alt"):
        row = b1[key]
        print(
            f"| {row['label']} | `{row['encoder']}` | {row['subprocesses']} "
            f"({row['ffmpeg_calls']} ffmpeg + {row['ffprobe_calls']} ffprobe) | "
            f"{row['median_ms']} | {row['mean_ms']} | {row['speedup']}x | "
            f"{_fmt_bytes(row['video_bytes'])} | {_fmt_bytes(row['persistent_audio_bytes'])} |"
        )
    print()

    if env["system_os"].lower() == "darwin" and b1["single_pass_alt"]["encoder"] != "h264_videotoolbox":
        print(
            "> **Note**: `h264_videotoolbox` fell back to `libx264` in this environment "
            "(for example inside a restricted macOS sandbox). Run outside the sandbox to measure native VideoToolbox speed.\n"
        )

    b2 = report["benchmarks"]["frame_zero_extraction"]
    print("## 2. Frame-0 Thumbnail Extraction (`extract_frame` at `0.0s`)")
    print("| Mode | Subprocesses / run | `ffprobe` / run | Median (ms) | Speedup |")
    print("| --- | ---: | ---: | ---: | ---: |")
    print(
        f"| Baseline (`ffprobe` + `ffmpeg`) | {b2['baseline']['subprocesses_per_run']} | "
        f"{b2['baseline']['ffprobe_per_run']} | {b2['baseline']['median_ms']} | 1.0x |"
    )
    print(
        f"| Candidate #02 (`extract_frame(0.0)`) | {b2['candidate']['subprocesses_per_run']} | "
        f"{b2['candidate']['ffprobe_per_run']} | {b2['candidate']['median_ms']} | "
        f"{b2['candidate']['speedup']}x |"
    )
    print()

    b3 = report["benchmarks"]["single_flight_crop_map"]
    print(f"## 3. Single-Flight Concurrent Face Tracking ({b3['workers']} threads, {b3['tracker_cost_ms']}ms/decode)")
    print("| Mode | `analyze_video` Calls | Wall Time (ms) | Tracker Work (ms) | Notes |")
    print("| --- | ---: | ---: | ---: | --- |")
    print(
        f"| Baseline (unlocked, same clip) | {b3['baseline_unlocked']['analyze_calls']} | "
        f"{b3['baseline_unlocked']['wall_ms']} | {b3['baseline_unlocked']['tracker_cpu_ms']} | 4x duplicate decode |"
    )
    print(
        f"| Candidate #02 (single-flight, same clip) | {b3['candidate_single_flight']['analyze_calls']} | "
        f"{b3['candidate_single_flight']['wall_ms']} | {b3['candidate_single_flight']['tracker_cpu_ms']} | "
        f"-{b3['candidate_single_flight']['duplicate_reduction_pct']}% duplicate work |"
    )
    print(
        f"| Candidate #02 (2 different clips in parallel) | {b3['cross_clip_parallel']['analyze_calls']} | "
        f"{b3['cross_clip_parallel']['wall_ms']} | - | Runs concurrently (per-clip lock) |"
    )
    print()

    b4 = report["benchmarks"]["ready_clip_cache_stability"]
    print(f"## 4. Ready Clip Listing Cache Under Session Reads ({b4['num_clips']} clips x {b4['cycles']} cycles)")
    print("| Mode | Cache Epoch Bumps | Redundant `ffprobe` Calls | Total Cycle Time (ms) |")
    print("| --- | ---: | ---: | ---: |")
    print(
        f"| Baseline (unconditional invalidation) | {b4['baseline']['epoch_bumps']} | "
        f"{b4['baseline']['redundant_ffprobes']} | {b4['baseline']['total_ms']} |"
    )
    print(
        f"| Candidate #02 (mutation-gated invalidation) | {b4['candidate']['epoch_bumps']} | "
        f"{b4['candidate']['redundant_ffprobes']} | {b4['candidate']['total_ms']} |"
    )
    print()

    b5 = report["benchmarks"]["manifest_json_serialization"]
    print(f"## 5. Manifest JSON Serialization (`{b5['sample_source']}`, {b5['iterations']} iterations)")
    print("| Mode | Machine Manifest Bytes | Size Reduction | Atomic Write Median (ms) | Read Median (ms) | Configs Indented |")
    print("| --- | ---: | ---: | ---: | ---: | --- |")
    print(
        f"| Baseline (`indent=2`) | {_fmt_bytes(b5['baseline']['total_manifest_bytes'])} | 0.0% | "
        f"{b5['baseline']['write_median_ms']} | {b5['baseline']['read_median_ms']} | True |"
    )
    print(
        f"| Candidate #02 (compact manifests) | {_fmt_bytes(b5['candidate']['total_manifest_bytes'])} | "
        f"-{b5['candidate']['size_reduction_pct']}% | {b5['candidate']['write_median_ms']} | "
        f"{b5['candidate']['read_median_ms']} | {b5['configs_remain_pretty']} |"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Candidate #02 clip extraction & session store improvements.")
    parser.add_argument("--source", type=str, default=None, help="Optional path to a source MP4 video.")
    parser.add_argument("--synthetic", action="store_true", help="Force a synthetic 1080p AV source instead of scanning local sources.")
    parser.add_argument("--start", type=float, default=10.0, help="Clip start timestamp in seconds (default: 10.0).")
    parser.add_argument("--duration", type=float, default=30.0, help="Clip cut duration in seconds (default: 30.0).")
    parser.add_argument("--runs", type=int, default=3, help="Measured FFmpeg repetitions per mode (default: 3).")
    parser.add_argument("--json-out", type=str, default=None, help="Optional path to write raw JSON benchmark report.")
    args = parser.parse_args()

    profiler = HardwareProfiler()
    metrics = profiler.metrics_source.probe_metrics()
    probe_tc = MediaTranscoder(adapter=SubprocessMediaAdapter(), hardware_profiler=profiler)

    with tempfile.TemporaryDirectory(prefix="yonru_bench_") as work_dir:
        source_path, source_label, specs = _resolve_source_video(
            work_dir,
            probe_tc,
            args.source,
            args.synthetic,
            args.start,
            args.duration,
        )

        report: Dict[str, Any] = {
            "environment": {
                "system_os": metrics.cpu.system_os,
                "cpu_brand": metrics.cpu.brand,
                "cpu_cores": metrics.cpu.cores,
                "total_ram_gb": metrics.total_ram_gb,
                "gpu_type": metrics.gpu.type,
                "gpu_name": metrics.gpu.name,
                "ffmpeg_version": _detect_ffmpeg_version(),
                "source_label": source_label,
                "source_width": specs.width,
                "source_height": specs.height,
                "source_fps": specs.fps,
                "source_duration": specs.duration,
                "clip_start": args.start,
                "clip_duration": args.duration,
                "runs": args.runs,
            },
            "benchmarks": {
                "ready_clip_extraction": _bench_ready_clip_extraction(
                    work_dir, source_path, args.start, args.duration, max(1, args.runs), profiler
                ),
                "frame_zero_extraction": _bench_frame_zero_extraction(
                    work_dir, source_path, args.start, max(1, args.runs)
                ),
                "single_flight_crop_map": _bench_single_flight_crop_map(work_dir),
                "ready_clip_cache_stability": _bench_ready_clip_cache_stability(work_dir),
                "manifest_json_serialization": _bench_manifest_json_serialization(work_dir),
            },
        }

    _print_report(report)

    if args.json_out:
        out_dir = os.path.dirname(os.path.abspath(args.json_out))
        os.makedirs(out_dir, exist_ok=True)
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nSaved raw JSON results to `{args.json_out}`")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
