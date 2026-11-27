"""
Reproducible micro- and macro-benchmark suite for Candidate #01:
1. Cached Video Library / Command Palette listing (`AssetRepository.list_cached_videos(page=1, limit=100)`):
   cold `ffprobe` baseline vs. one-time legacy backfill vs. cold server restart vs. warm catalog
2. Read-only cached hook loading (`HookDiscoveryEngine.load_cached_hooks` with 25 missing thumbnails)
3. Batched parallel hook thumbnail extraction (`MediaTranscoder.extract_frames` vs. sequential `extract_frame`)

Usage:
    ./backend/venv/bin/python backend/scripts/benchmark_candidate_01.py
    ./backend/venv/bin/python backend/scripts/benchmark_candidate_01.py --synthetic --runs 3
"""

from __future__ import annotations

import argparse
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

from core.asset_repository import AssetRepository
from core.hardware_profiler import HardwareProfiler
from core.hook_discovery_engine import HookDiscoveryEngine
from core.media_transcoder import (
    FrameExtractionRequest,
    MediaProcessAdapter,
    MediaSpecs,
    MediaTranscoder,
    SubprocessMediaAdapter,
)
from core.youtube_client import YouTubeClient


class _NoopYouTubeClient(YouTubeClient):
    """Test/benchmark double preventing any accidental YouTube network calls."""

    def __init__(self) -> None:
        super().__init__(cookie_path="")

    def get_video_info_fast(self, url: str) -> dict:
        raise AssertionError("Network YouTube calls are disabled during benchmarks")

    def download_video(self, url: str, target_dir: str, quality: str = "1080p", progress_callback=None) -> None:
        raise AssertionError("YouTube downloads are disabled during benchmarks")

    def fetch_transcript(self, video_id: str) -> list:
        raise AssertionError("Transcript network calls are disabled during benchmarks")


class CountingMediaAdapter(MediaProcessAdapter):
    """Thread-safe wrapper counting FFmpeg and FFprobe subprocess invocations."""

    def __init__(self, inner: MediaProcessAdapter) -> None:
        self._inner = inner
        self._lock = threading.Lock()
        self.ffmpeg_calls: int = 0
        self.ffprobe_calls: int = 0

    def reset_counts(self) -> None:
        with self._lock:
            self.ffmpeg_calls = 0
            self.ffprobe_calls = 0

    def run_ffmpeg(self, args: List[str]) -> bool:
        with self._lock:
            self.ffmpeg_calls += 1
        return self._inner.run_ffmpeg(args)

    def ffprobe_info(self, file_path: str) -> Dict[str, Any]:
        with self._lock:
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


def _discover_local_cached_sources() -> List[Dict[str, str]]:
    """Collect valid cached source folders in backend/temp_assets/sources read-only."""
    sources_root = os.path.join(BACKEND_DIR, "temp_assets", "sources")
    discovered: List[Dict[str, str]] = []
    if not os.path.isdir(sources_root):
        return discovered

    for name in sorted(os.listdir(sources_root)):
        folder_path = os.path.join(sources_root, name)
        if not os.path.isdir(folder_path) or len(name) < 12 or name[-12] != "_":
            continue
        full_path = os.path.join(folder_path, "full.mp4")
        preview_path = os.path.join(folder_path, "preview.mp4")
        media_path = full_path if os.path.isfile(full_path) else (preview_path if os.path.isfile(preview_path) else None)
        if not media_path:
            continue
        discovered.append({
            "folder_name": name,
            "folder_path": folder_path,
            "media_path": media_path,
            "media_name": os.path.basename(media_path),
            "meta_path": os.path.join(folder_path, "metadata.json"),
            "thumb_path": os.path.join(folder_path, "thumb.jpg"),
        })
    return discovered


def _generate_synthetic_1080p_source(work_dir: str, duration: float = 60.0) -> str:
    """Create a synthetic 1080p H.264 video for self-contained benchmarks."""
    synth_path = os.path.join(work_dir, "synthetic_1080p_source.mp4")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-f", "lavfi",
            "-i", f"testsrc2=size=1920x1080:rate=30:duration={duration}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            synth_path,
        ],
        check=True,
        capture_output=True,
    )
    return synth_path


def _populate_mirrored_library(
    base_dir: str,
    local_sources: List[Dict[str, str]],
    synthetic_source_path: Optional[str],
    synthetic_count: int = 36,
    *,
    strip_media_specs: bool = True,
) -> int:
    """Create an isolated temp copy of cached sources using read-only symlinks for media binaries."""
    sources_dir = os.path.join(base_dir, "sources")
    os.makedirs(sources_dir, exist_ok=True)
    os.makedirs(os.path.join(base_dir, "clips"), exist_ok=True)

    if local_sources:
        for item in local_sources:
            dst_folder = os.path.join(sources_dir, item["folder_name"])
            os.makedirs(dst_folder, exist_ok=True)
            os.symlink(item["media_path"], os.path.join(dst_folder, item["media_name"]))
            if os.path.isfile(item["thumb_path"]):
                os.symlink(item["thumb_path"], os.path.join(dst_folder, "thumb.jpg"))
            if os.path.isfile(item["meta_path"]):
                with open(item["meta_path"], "r", encoding="utf-8") as mf:
                    meta = json.load(mf)
                if strip_media_specs and isinstance(meta, dict):
                    meta = dict(meta)
                    meta.pop("media_specs", None)
                with open(os.path.join(dst_folder, "metadata.json"), "w", encoding="utf-8") as wf:
                    json.dump(meta, wf, indent=2, ensure_ascii=False)
        return len(local_sources)

    assert synthetic_source_path is not None
    for idx in range(synthetic_count):
        vid = f"synth{idx:06d}"
        folder_name = f"[Benchmark Channel] Synthetic_Video_{idx:02d}_{vid}"
        dst_folder = os.path.join(sources_dir, folder_name)
        os.makedirs(dst_folder, exist_ok=True)
        os.symlink(synthetic_source_path, os.path.join(dst_folder, "full.mp4"))
        with open(os.path.join(dst_folder, "thumb.jpg"), "wb") as tf:
            tf.write(b"\xff\xd8\xff\xe0\x00\x10JFIF")
        with open(os.path.join(dst_folder, "metadata.json"), "w", encoding="utf-8") as wf:
            json.dump(
                {
                    "video_id": vid,
                    "title": f"Synthetic Video {idx:02d}",
                    "raw_title": f"Synthetic Video {idx:02d}",
                    "channel": "Benchmark Channel",
                    "added_at": 1700000000.0 + idx,
                },
                wf,
                indent=2,
            )
    return synthetic_count


def _select_hook_source_video(
    work_dir: str,
    probe_tc: MediaTranscoder,
    local_sources: List[Dict[str, str]],
    synthetic: bool,
) -> Tuple[str, str, MediaSpecs]:
    """Pick a 1080p full.mp4 source video (>= 40s) for hook thumbnail extraction benchmarks."""
    if not synthetic and local_sources:
        hd_candidates = sorted(
            (s for s in local_sources if s["media_name"] == "full.mp4"),
            key=lambda s: os.path.getsize(s["media_path"]),
        )
        for item in hd_candidates:
            specs = probe_tc.probe_video(item["media_path"])
            if specs.duration >= 40.0 and specs.width >= 1280:
                return item["media_path"], f"real:{item['folder_name']}/full.mp4", specs

    synth_path = os.path.join(work_dir, "hook_benchmark_1080p.mp4")
    if not os.path.isfile(synth_path):
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f", "lavfi",
                "-i", "testsrc2=size=1920x1080:rate=30:duration=60",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                synth_path,
            ],
            check=True,
            capture_output=True,
        )
    specs = probe_tc.probe_video(synth_path)
    return synth_path, "synthetic:1920x1080@30fps", specs


def _bench_cached_library_listing(
    work_dir: str,
    local_sources: List[Dict[str, str]],
    synthetic: bool,
    runs: int,
) -> Dict[str, Any]:
    """Benchmark 1: Cold ffprobe storm vs legacy backfill vs cold server restart vs warm catalog."""
    base_adapter = SubprocessMediaAdapter()
    yt = _NoopYouTubeClient()
    synthetic_source_path = (
        _generate_synthetic_1080p_source(work_dir, duration=15.0)
        if (synthetic or not local_sources)
        else None
    )

    legacy_dir = os.path.join(work_dir, "library_legacy")
    count = _populate_mirrored_library(
        legacy_dir,
        local_sources if not synthetic else [],
        synthetic_source_path,
        synthetic_count=36,
        strip_media_specs=True,
    )

    # 1. Baseline: cold ffprobe across all N folders (what pre-Candidate-01 list_cached_videos did)
    baseline_ms: List[float] = []
    baseline_ffprobes = 0
    for _ in range(runs):
        adapter = CountingMediaAdapter(base_adapter)
        tc = MediaTranscoder(adapter=adapter)
        repo = AssetRepository(output_dir=legacy_dir, youtube_client=yt, media_transcoder=tc)
        t0 = time.perf_counter()
        with os.scandir(repo.source_dir) as entries:
            for entry in entries:
                if entry.is_dir() and len(entry.name) >= 12 and entry.name[-12] == "_":
                    full_p = os.path.join(entry.path, "full.mp4")
                    prev_p = os.path.join(entry.path, "preview.mp4")
                    target_p = full_p if os.path.exists(full_p) else prev_p
                    if os.path.exists(target_p):
                        tc.probe_video(target_p)
        baseline_ms.append((time.perf_counter() - t0) * 1000.0)
        baseline_ffprobes = adapter.ffprobe_calls

    # 2. Candidate #01 — One-Time Legacy Backfill (reads legacy metadata, probes once, persists media_specs)
    backfill_adapter = CountingMediaAdapter(base_adapter)
    backfill_tc = MediaTranscoder(adapter=backfill_adapter)
    backfill_repo = AssetRepository(output_dir=legacy_dir, youtube_client=yt, media_transcoder=backfill_tc)
    t0 = time.perf_counter()
    res_backfill = backfill_repo.list_cached_videos(page=1, limit=100)
    backfill_ms = (time.perf_counter() - t0) * 1000.0
    assert res_backfill["total"] == count

    # 3. Candidate #01 — Cold Server Restart (brand-new AssetRepository + brand-new MediaTranscoder, persisted metadata.json)
    cold_restart_ms: List[float] = []
    cold_restart_ffprobes = 0
    cold_restart_ffmpeg = 0
    for _ in range(runs):
        cold_adapter = CountingMediaAdapter(base_adapter)
        cold_tc = MediaTranscoder(adapter=cold_adapter)
        cold_repo = AssetRepository(output_dir=legacy_dir, youtube_client=yt, media_transcoder=cold_tc)
        t0 = time.perf_counter()
        res_cold = cold_repo.list_cached_videos(page=1, limit=100)
        cold_restart_ms.append((time.perf_counter() - t0) * 1000.0)
        assert res_cold["total"] == count
        cold_restart_ffprobes = cold_adapter.ffprobe_calls
        cold_restart_ffmpeg = cold_adapter.ffmpeg_calls

    # 4. Candidate #01 — Warm In-Memory Catalog (second call on existing AssetRepository)
    warm_adapter = CountingMediaAdapter(base_adapter)
    warm_tc = MediaTranscoder(adapter=warm_adapter)
    warm_repo = AssetRepository(output_dir=legacy_dir, youtube_client=yt, media_transcoder=warm_tc)
    _ = warm_repo.list_cached_videos(page=1, limit=100)
    warm_adapter.reset_counts()
    warm_ms: List[float] = []
    for _ in range(runs):
        t0 = time.perf_counter()
        res_warm = warm_repo.list_cached_videos(page=1, limit=100)
        warm_ms.append((time.perf_counter() - t0) * 1000.0)
        assert res_warm["total"] == count

    base_med = round(statistics.median(baseline_ms), 2)
    cold_med = round(statistics.median(cold_restart_ms), 2)
    warm_med = round(statistics.median(warm_ms), 2)
    return {
        "cached_video_count": count,
        "source_dataset": "real_workspace_mirror" if (local_sources and not synthetic) else "synthetic_library",
        "baseline_cold_ffprobe": {
            "median_ms": base_med,
            "ffprobe_calls": baseline_ffprobes,
            "ffmpeg_calls": 0,
            "speedup": 1.0,
        },
        "legacy_one_time_backfill": {
            "ms": round(backfill_ms, 2),
            "ffprobe_calls": backfill_adapter.ffprobe_calls,
            "ffmpeg_calls": backfill_adapter.ffmpeg_calls,
        },
        "candidate_cold_restart": {
            "median_ms": cold_med,
            "ffprobe_calls": cold_restart_ffprobes,
            "ffmpeg_calls": cold_restart_ffmpeg,
            "speedup": round(base_med / max(cold_med, 0.01), 1),
        },
        "candidate_warm_catalog": {
            "median_ms": warm_med,
            "ffprobe_calls": warm_adapter.ffprobe_calls,
            "ffmpeg_calls": warm_adapter.ffmpeg_calls,
            "speedup": round(base_med / max(warm_med, 0.01), 1),
        },
    }


def _build_synthetic_hooks(duration: float, count: int = 25) -> List[Dict[str, Any]]:
    hooks: List[Dict[str, Any]] = []
    usable = max(25.0, duration - 5.0)
    step = usable / float(count)
    for i in range(count):
        start = round(1.0 + i * step, 2)
        end = round(min(duration - 0.5, start + 25.0), 2)
        if end <= start:
            end = start + 15.0
        hooks.append({
            "start": start,
            "end": end,
            "duration": round(end - start, 2),
            "duration_seconds": round(end - start, 2),
            "theme": f"Benchmark Hook {i + 1}",
            "virality_score": max(50, 99 - i),
        })
    return hooks


def _bench_hook_load_and_thumbnails(
    work_dir: str,
    source_path: str,
    specs: MediaSpecs,
    runs: int,
) -> Dict[str, Any]:
    """Benchmarks 2 & 3: Read-only load_cached_hooks and 25-frame sequential vs extract_frames."""
    base_adapter = SubprocessMediaAdapter()
    hooks_payload = _build_synthetic_hooks(specs.duration, count=25)
    timestamps = [float(h["start"]) for h in hooks_payload]

    # Benchmark 2 & 3 Baseline: 25 sequential 1080p seeks on a cold MediaTranscoder
    seq_ms: List[float] = []
    seq_ffprobes = 0
    seq_ffmpegs = 0
    for r_idx in range(runs):
        adapter = CountingMediaAdapter(base_adapter)
        tc = MediaTranscoder(adapter=adapter)
        run_dir = os.path.join(work_dir, "seq_thumbs", f"run_{r_idx}")
        os.makedirs(run_dir, exist_ok=True)
        buf = io.StringIO()
        t0 = time.perf_counter()
        with contextlib.redirect_stdout(buf):
            for i, ts in enumerate(timestamps):
                ok = tc.extract_frame(source_path, ts, os.path.join(run_dir, f"thumb_{int(ts)}_{i}.jpg"))
                assert ok
        seq_ms.append((time.perf_counter() - t0) * 1000.0)
        seq_ffprobes = adapter.ffprobe_calls
        seq_ffmpegs = adapter.ffmpeg_calls

    # Benchmark 2 Candidate: HookDiscoveryEngine.load_cached_hooks with 25 missing thumbnails (0 FFmpeg/ffprobe)
    ro_dir = os.path.join(work_dir, "readonly_hooks")
    os.makedirs(ro_dir, exist_ok=True)
    ro_video = os.path.join(ro_dir, "full.mp4")
    os.symlink(source_path, ro_video)
    with open(os.path.join(ro_dir, "hooks.json"), "w", encoding="utf-8") as hf:
        json.dump(hooks_payload, hf)
    ro_adapter = CountingMediaAdapter(base_adapter)
    ro_tc = MediaTranscoder(adapter=ro_adapter)
    engine = HookDiscoveryEngine(media_transcoder=ro_tc)
    video_info = {
        "file_path": ro_video,
        "folder_name": "readonly_hooks",
        "duration": specs.duration,
    }
    ro_ms: List[float] = []
    for _ in range(max(runs, 5)):
        t0 = time.perf_counter()
        loaded = engine.load_cached_hooks(video_info)
        ro_ms.append((time.perf_counter() - t0) * 1000.0)
        assert loaded is not None and len(loaded) == 25
        assert all(h["thumbnail_url"] is None for h in loaded)

    # Benchmark 3 Candidate: Batched parallel MediaTranscoder.extract_frames(..., video_duration=specs.duration)
    batch_ms: List[float] = []
    batch_ffprobes = 0
    batch_ffmpegs = 0
    skip_exists_ms: List[float] = []
    skip_ffprobes = 0
    skip_ffmpegs = 0
    for r_idx in range(runs):
        adapter = CountingMediaAdapter(base_adapter)
        tc = MediaTranscoder(adapter=adapter)
        run_dir = os.path.join(work_dir, "batch_thumbs", f"run_{r_idx}")
        os.makedirs(run_dir, exist_ok=True)
        reqs = [
            FrameExtractionRequest(
                timestamp=ts,
                output_path=os.path.join(run_dir, f"thumb_{int(ts)}_{i}.jpg"),
            )
            for i, ts in enumerate(timestamps)
        ]
        buf = io.StringIO()
        t0 = time.perf_counter()
        with contextlib.redirect_stdout(buf):
            res = tc.extract_frames(source_path, reqs, video_duration=specs.duration)
        batch_ms.append((time.perf_counter() - t0) * 1000.0)
        assert all(res.values())
        batch_ffprobes = adapter.ffprobe_calls
        batch_ffmpegs = adapter.ffmpeg_calls

        adapter.reset_counts()
        t1 = time.perf_counter()
        skip_res = tc.extract_frames(source_path, reqs, video_duration=specs.duration)
        skip_exists_ms.append((time.perf_counter() - t1) * 1000.0)
        assert all(skip_res.values())
        skip_ffprobes = adapter.ffprobe_calls
        skip_ffmpegs = adapter.ffmpeg_calls

    seq_med = round(statistics.median(seq_ms), 2)
    ro_med = round(statistics.median(ro_ms), 2)
    batch_med = round(statistics.median(batch_ms), 2)
    skip_med = round(statistics.median(skip_exists_ms), 2)

    return {
        "hook_count": 25,
        "load_cached_hooks_comparison": {
            "baseline_sequential_extract": {
                "median_ms": seq_med,
                "ffprobe_calls": seq_ffprobes,
                "ffmpeg_calls": seq_ffmpegs,
            },
            "candidate_readonly": {
                "median_ms": ro_med,
                "ffprobe_calls": ro_adapter.ffprobe_calls,
                "ffmpeg_calls": ro_adapter.ffmpeg_calls,
                "speedup": round(seq_med / max(ro_med, 0.01), 1),
            },
        },
        "batch_extract_frames_comparison": {
            "baseline_sequential": {
                "median_ms": seq_med,
                "ffprobe_calls": seq_ffprobes,
                "ffmpeg_calls": seq_ffmpegs,
                "speedup": 1.0,
            },
            "candidate_parallel_batch": {
                "median_ms": batch_med,
                "ffprobe_calls": batch_ffprobes,
                "ffmpeg_calls": batch_ffmpegs,
                "workers": min(4, os.cpu_count() or 1),
                "speedup": round(seq_med / max(batch_med, 0.01), 2),
            },
            "candidate_all_present_skip": {
                "median_ms": skip_med,
                "ffprobe_calls": skip_ffprobes,
                "ffmpeg_calls": skip_ffmpegs,
                "speedup": round(seq_med / max(skip_med, 0.01), 1),
            },
        },
    }


def _print_report(report: Dict[str, Any]) -> None:
    env = report["environment"]
    print("# Candidate #01 Benchmark Report\n")
    print(f"- **Host**: `{env['system_os']}` | CPU: `{env['cpu_brand']}` ({env['cpu_cores']} cores)")
    print(f"- **FFmpeg**: `{env['ffmpeg_version']}`")
    print(
        f"- **Hook Source Video**: `{env['hook_source_label']}` "
        f"({env['hook_source_width']}x{env['hook_source_height']} @ {env['hook_source_fps']}fps, "
        f"duration={env['hook_source_duration']}s)\n"
    )

    b1 = report["benchmarks"]["cached_library_listing"]
    print(f"## 1. Cached Video Library & Command Palette (`list_cached_videos(page=1, limit=100)`, N={b1['cached_video_count']}, `{b1['source_dataset']}`)")
    print("| Mode | `ffprobe` Calls | `ffmpeg` Calls | Median (ms) | Speedup |")
    print("| --- | ---: | ---: | ---: | ---: |")
    base = b1["baseline_cold_ffprobe"]
    backfill = b1["legacy_one_time_backfill"]
    cold = b1["candidate_cold_restart"]
    warm = b1["candidate_warm_catalog"]
    print(f"| Baseline (Cold `ffprobe` per folder) | {base['ffprobe_calls']} | {base['ffmpeg_calls']} | {base['median_ms']} | 1.0x |")
    print(f"| Candidate #01 — One-Time Legacy Backfill | {backfill['ffprobe_calls']} | {backfill['ffmpeg_calls']} | {backfill['ms']} | - |")
    print(f"| Candidate #01 — Cold Server Restart (Persisted `metadata.json`) | {cold['ffprobe_calls']} | {cold['ffmpeg_calls']} | {cold['median_ms']} | {cold['speedup']}x |")
    print(f"| Candidate #01 — Warm In-Memory Catalog | {warm['ffprobe_calls']} | {warm['ffmpeg_calls']} | {warm['median_ms']} | {warm['speedup']}x |")
    print()

    b2 = report["benchmarks"]["hooks_and_thumbnails"]["load_cached_hooks_comparison"]
    print("## 2. Read-Only Cached Hook Load (`load_cached_hooks`, 25 Hooks Missing Thumbnails)")
    print("| Mode | `ffprobe` Calls | `ffmpeg` Calls | Median (ms) | Speedup |")
    print("| --- | ---: | ---: | ---: | ---: |")
    print(
        f"| Baseline (25 sequential FFmpeg seeks on read path) | "
        f"{b2['baseline_sequential_extract']['ffprobe_calls']} | "
        f"{b2['baseline_sequential_extract']['ffmpeg_calls']} | "
        f"{b2['baseline_sequential_extract']['median_ms']} | 1.0x |"
    )
    print(
        f"| Candidate #01 (`load_cached_hooks` read-only) | "
        f"{b2['candidate_readonly']['ffprobe_calls']} | "
        f"{b2['candidate_readonly']['ffmpeg_calls']} | "
        f"{b2['candidate_readonly']['median_ms']} | {b2['candidate_readonly']['speedup']}x |"
    )
    print()

    b3 = report["benchmarks"]["hooks_and_thumbnails"]["batch_extract_frames_comparison"]
    print("## 3. 25-Hook Thumbnail Extraction on 1080p Source (`MediaTranscoder.extract_frames`)")
    print("| Mode | `ffprobe` Calls | `ffmpeg` Calls | Pool Workers | Median (ms) | Speedup |")
    print("| --- | ---: | ---: | ---: | ---: | ---: |")
    print(
        f"| Baseline (25 sequential `extract_frame`) | "
        f"{b3['baseline_sequential']['ffprobe_calls']} | "
        f"{b3['baseline_sequential']['ffmpeg_calls']} | 1 | "
        f"{b3['baseline_sequential']['median_ms']} | 1.0x |"
    )
    print(
        f"| Candidate #01 (`extract_frames` parallel batch) | "
        f"{b3['candidate_parallel_batch']['ffprobe_calls']} | "
        f"{b3['candidate_parallel_batch']['ffmpeg_calls']} | "
        f"{b3['candidate_parallel_batch']['workers']} | "
        f"{b3['candidate_parallel_batch']['median_ms']} | {b3['candidate_parallel_batch']['speedup']}x |"
    )
    print(
        f"| Candidate #01 (`extract_frames` skip-if-exists warm check) | "
        f"{b3['candidate_all_present_skip']['ffprobe_calls']} | "
        f"{b3['candidate_all_present_skip']['ffmpeg_calls']} | - | "
        f"{b3['candidate_all_present_skip']['median_ms']} | {b3['candidate_all_present_skip']['speedup']}x |"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark Candidate #01 persisted media specs & batched hook thumbnails.")
    parser.add_argument("--synthetic", action="store_true", help="Force synthetic library/video instead of scanning local sources.")
    parser.add_argument("--runs", type=int, default=3, help="Measured repetitions per mode (default: 3).")
    parser.add_argument("--json-out", type=str, default=None, help="Optional path to write raw JSON benchmark report.")
    args = parser.parse_args()

    profiler = HardwareProfiler()
    metrics = profiler.metrics_source.probe_metrics()
    probe_tc = MediaTranscoder(adapter=SubprocessMediaAdapter(), hardware_profiler=profiler)
    local_sources = _discover_local_cached_sources()
    runs = max(1, args.runs)

    with tempfile.TemporaryDirectory(prefix="yonru_bench_c01_") as work_dir:
        hook_source_path, hook_source_label, hook_specs = _select_hook_source_video(
            work_dir, probe_tc, local_sources, args.synthetic
        )
        report: Dict[str, Any] = {
            "environment": {
                "system_os": metrics.cpu.system_os,
                "cpu_brand": metrics.cpu.brand,
                "cpu_cores": metrics.cpu.cores,
                "ffmpeg_version": _detect_ffmpeg_version(),
                "hook_source_label": hook_source_label,
                "hook_source_width": hook_specs.width,
                "hook_source_height": hook_specs.height,
                "hook_source_fps": hook_specs.fps,
                "hook_source_duration": hook_specs.duration,
                "runs": runs,
            },
            "benchmarks": {
                "cached_library_listing": _bench_cached_library_listing(
                    work_dir, local_sources, args.synthetic, runs
                ),
                "hooks_and_thumbnails": _bench_hook_load_and_thumbnails(
                    work_dir, hook_source_path, hook_specs, runs
                ),
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
