# 0034. Headless Render Subprocess Ownership, Cancellation Teardown & Hardware-Guided Encoding

Date: 2026-11-22

## Status

Accepted — Fixes active breach of [ADR 0032](./0032-supervised-self-update-and-tag-fast-forward.md) (`RenderActivityTracker` idle-render invariant) and extends [ADR 0011](./0011-hardware-guided-transcription-engine-selection.md) (**Hardware Capability Profile** reuse without startup latency).

## Context

`RenderPipelineCoordinator` previously spawned Remotion CLI subprocesses inline via `subprocess.run` and `subprocess.Popen` inside `with self._stage_render_context(...)`:

1. **Orphaned Headless Render Trees & Premature Asset Removal**: When a creator canceled an export (`AbortController.abort()` closing the SSE stream on `POST /api/render-stream`), FastAPI's synchronous `def sse_generator()` blocked inside `process.stdout.readline()` whenever Remotion was silent, and closing the generator raised `GeneratorExit` (`BaseException`), bypassing `except Exception:`. `StagedRenderContext.__exit__` deleted staged `source_*.mp4`, `cover_*.jpg`, `audio_*.mp3`, and `props_*.json` while the orphaned `remotion render` + Chrome Headless Shell + FFmpeg tree continued running and `RenderActivityTracker` prematurely decremented `active_count` to `0`—violating [ADR 0032](./0032-supervised-self-update-and-tag-fast-forward.md)'s `SelfUpdateService.preflight()` safety check.
2. **Software-Only Export & Unbounded Browser Concurrency**: `_build_remotion_cmd` omitted `--hardware-acceleration` (forcing Remotion's default `'disable'` and software `libx264` even on Apple Silicon or NVIDIA CUDA hosts) and omitted `--concurrency`, risking memory pressure on 8 GB hosts.
3. **Startup Global `PATH` Mutation & Duplicated FFmpeg Probing**: `RenderPipelineCoordinator.__init__` duplicated FFmpeg probing, mutated global `os.environ["PATH"]`, and raised at server boot instead of honoring Settings updates dynamically via **Media Transcoder Engine**.
4. **Untestable Subprocess Seam**: Inline `subprocess` calls forced tests to monkeypatch `subprocess`, leaving cancellation teardown and OS process-group ownership untested.

## Decision

1. **Two-Adapter `RemotionProcessAdapter` Seam (`backend/core/render_engine.py`)**:
   - Define `RemotionProcessAdapter` with two abstract methods (`run` and `stream`) plus lifecycle hook `terminate_all()`, implemented by `SubprocessRemotionAdapter` (production) and `FakeRemotionAdapter` (tests), injected into `RenderPipelineCoordinator`.
   - Route all three Remotion subprocess paths (`_ensure_remotion_bundle`, `_render_comp`, and `render_streaming`) through this seam while preserving `FakeRenderEngine` for FastAPI and **Self-Update** route tests.
   - Track active `Popen` handles inside `SubprocessRemotionAdapter` and invoke `render_engine.terminate_all()` during FastAPI's `lifespan` shutdown.

2. **Disconnect-Driven Cancellation & Strict 4-Step Teardown (`backend/main.py`, `backend/core/render_engine.py`)**:
   - Upgrade `POST /api/render-stream` to an async disconnect-aware SSE route that runs the sync render worker in a background thread and watches `request.is_disconnected()` / `CancelledError` so a shared `cancel_event` (`threading.Event`) triggers process-group termination immediately (~50–100ms) even while Remotion stdout is silent.
   - Wire `cancel_event` into `_ensure_remotion_bundle`; if cancelled during bundling, kill the bundle process group and remove any incomplete `.bundle/` directory missing `.bundle.hash`.
   - Enforce strict teardown order on every render, cancel, and error:
     1. Kill the entire process tree (`start_new_session=True` -> `SIGTERM` with a `2.0s` grace window -> `SIGKILL` on POSIX; `CREATE_NEW_PROCESS_GROUP` -> `taskkill /F /T /PID` on Windows) and reap (`wait()`),
     2. Delete any partial `output_path` `.mp4` created by the aborted or failed run (preserving clean successes and pre-existing files),
     3. Clean up staged `.bundle/public/*` files and `props_*.json` via `StagedRenderContext.__exit__`,
     4. Decrement `RenderActivityTracker` only after all cleanup steps complete and the process tree is confirmed dead, restoring [ADR 0032](./0032-supervised-self-update-and-tag-fast-forward.md)'s pre-flight invariant.

3. **Hardware-Guided GPU Encoding & RAM-Bounded Concurrency**:
   - Inject `system_repository.hardware_profiler` into `RenderPipelineCoordinator`, probing `HostHardwareMetrics` lazily once on the first render and caching it in memory (preserving [ADR 0011](./0011-hardware-guided-transcription-engine-selection.md)'s zero startup latency).
   - Compute `--hardware-acceleration` (`if-possible` on all macOS `Darwin` hosts and Windows/Linux NVIDIA CUDA hosts; `disable` on CPU-only Windows/Linux hosts; optional `REMOTION_HARDWARE_ACCELERATION` override) and leave Remotion's default hardware bitrate untouched.
   - If a non-cancelled `if-possible` render fails before completing frames or with an encoder/hardware initialization error in its output tail, automatically retry once with `--hardware-acceleration=disable` (unless `required` was explicitly configured).
   - Compute `--concurrency=<N>` via `max(1, min(cpu_cores, max(1, min(8, cpu_cores // 2)), ram_cap))` using the RAM table (`< 8 GB -> 1`, `8–11.9 GB -> 2`, `12–15.9 GB -> 3`, `16–23.9 GB -> 4`, `24–31.9 GB -> 6`, `>= 32 GB -> 8`), with an optional `REMOTION_CONCURRENCY` override clamped to `[1, cpu_cores]`.

4. **Lazy FFmpeg Delegation & Fresh Scoped Subprocess Environment**:
   - Remove startup FFmpeg probing and global `os.environ["PATH"]` mutation from `RenderPipelineCoordinator.__init__`.
   - Check FFmpeg availability lazily at render time via **Media Transcoder Engine** (`MediaTranscoder.is_ffmpeg_available()`, honored by `FakeMediaAdapter`), returning a clean error / SSE error event when missing.
   - Build a fresh scoped `env` copy per Remotion invocation including `FFMPEG_PATH` and `NODE_PATH` from `config_store` alongside `FORCE_COLOR=0` and `NO_COLOR=1`, so **Home Settings & Preference Panes** changes apply immediately without restarting the backend.

## Consequences

### Positive
- Client export cancellation (`AbortController.abort()`) immediately kills the entire Remotion + Chrome + FFmpeg process tree, prevents orphan background CPU/RAM usage, cleans partial MP4 and staged assets in strict order, and keeps `SelfUpdateService.preflight()` accurate.
- Apple Silicon (`h264_videotoolbox`) and NVIDIA CUDA (`h264_nvenc`) hosts automatically gain hardware-accelerated export with resilient one-shot software fallback and RAM-bounded Chromium concurrency.
- Render lifecycle, cancellation, GPU policy, and FFmpeg/env scoping are deterministically tested through `FakeRemotionAdapter` and `FakeMediaAdapter`, backed by one real OS process-group kill test.

### Negative / Trade-offs
- Adds a tiny background-thread + async queue bridge in `POST /api/render-stream` with 50ms disconnect polling (`anyio.CancelScope(shield=True)` in cleanup) so cancellation does not depend on Remotion stdout activity.
- Hosts that explicitly misconfigure `REMOTION_HARDWARE_ACCELERATION=required` without a compatible hardware encoder fail fast instead of falling back to software `libx264`.
