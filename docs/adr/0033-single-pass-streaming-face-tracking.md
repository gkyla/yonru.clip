# 0033. Single-Pass Streaming Face Tracking & Concurrent Clip Ingestion

Date: 2026-11-21

## Status

Accepted — Amends [ADR 0014](./0014-shot-anchored-layout-snapping-via-scene-detection.md) (§1 & §3 `get_video_start_time()`); Fulfills [ADR 0008](./0008-precomputed-auto-reframe-and-default-face-tracking.md) (§1)

## Context

Under [ADR 0014](./0014-shot-anchored-layout-snapping-via-scene-detection.md), **Face Tracking & Auto-Reframe** (`FaceTracker.analyze_video`) scanned every video in two sequential passes (`SceneDetectorSeam.detect_cuts(source)` followed by `FrameSource.reset()` and even-frame face detection), while **ClipWorkflowCoordinator.run_local_cut()** ran `ensure_crop_map()` strictly after Whisper audio transcription completed.

In production on 1080p H.264 clips, this introduced four bottlenecks:
1. **Duplicate Full-Video Decode**: Decoding every 1080p frame twice and seeking back to frame 0 via `FrameSource.reset()` exceeded the original `<0.5s` pre-scan estimate.
2. **Serial Critical Path**: Waiting behind Whisper transcription serialized CPU-bound face tracking behind transcription instead of overlapping both during **Ready Clip** extraction ([ADR 0008 §1](./0008-precomputed-auto-reframe-and-default-face-tracking.md)).
3. **Repeated MediaPipe Cold-Loads & Full-HD Colorspace Conversion**: `ClipSessionStore.ensure_crop_map()` instantiated a fresh `FaceTracker` and `MediaPipeFaceDetector` per clip, and converted full `1920x1080` frames from BGR to RGB before feeding MediaPipe's internal BlazeFace graph (`192x192`).
4. **Dead Code & Unprotected Resource Lifetime**: `get_video_start_time()` in `frame_source.py` was unused, and `source.close()` was not guarded by `try/finally`.

## Decision

1. **Causal Single-Pass `SceneDetectorSeam` (`reset()` + `evaluate_frame()`)**:
   - Replace `SceneDetectorSeam.detect_cuts(frame_source)` with causal per-frame methods: `reset() -> None` and `evaluate_frame(frame: np.ndarray, t_sec: float) -> Optional[float]`.
   - `OpenCVSceneDetector` preserves its 3D HSV histogram correlation parameters (`target_size=(160, 90)`, `cv2.INTER_NEAREST`, `[16, 8, 8]` bins, `cv2.HISTCMP_CORREL`, `threshold=0.75`, `min_refractory_sec=0.5`) while resetting `_prev_hist` and `_last_cut_time` via `reset()` before each stream.
   - `FaceTracker.analyze_video()` reads each frame exactly once inside `try ... finally: source.close()`. On every frame (`frame_idx = 0, 1, 2, ...`, both odd and even), it evaluates `scene_detector.evaluate_frame(frame, t_sec)` **before** running `detector.locate_faces()` on even frames (`frame_idx % 2 == 0`).
   - All **Shot-Anchored Layout Snapping** invariants from [ADR 0014 §2](./0014-shot-anchored-layout-snapping-via-scene-detection.md) — `MIN_SPLIT_SEPARATION = 0.20 * width`, `0.08` prominence filtering, `0.35s` / `0.8s` **Stacked Multi-Speaker Reframe** hysteresis, `last_consumed_cut`, In-Shot Partial Dropout Immunity, and 2-frame single-speaker cut verification — remain unchanged.
   - Remove `FrameSource.reset()` and dead `get_video_start_time()`.

2. **Safe Pre-RGB Downscale, Thread-Safe Cached Detector, & Resource Cleanup**:
   - `MediaPipeFaceDetector` adds `max_width: int = 640`, downscaling BGR frames with `cv2.INTER_AREA` (preserving aspect ratio) before `cv2.cvtColor(..., cv2.COLOR_BGR2RGB)` when `frame.shape[1] > max_width`, keeping normalized `bbox` coordinates mapped to original frame `width`.
   - `MediaPipeFaceDetector` serializes `face_detection.process(...)` behind a `threading.Lock` and exposes an idempotent `close()` method.
   - `FaceTracker` lazily caches its internal `MediaPipeFaceDetector` thread-safely and releases it on `FaceTracker.close()`. `ClipSessionStore.ensure_crop_map()` lazily caches and reuses `self.face_tracker` (also wired at startup in `backend/main.py`), while `RemotionRenderEngine` fallback paths either reuse an existing tracker or close temporary local trackers in `try/finally`.

3. **Concurrent `ensure_crop_map` + Whisper Execution in `run_local_cut()`**:
   - After `create_clip()` and initial `ClipSessionStore.ensure_clip_defaults(folder_name, clip_id)`, `ClipWorkflowCoordinator.run_local_cut()` runs `ensure_crop_map()` on a single-worker `ThreadPoolExecutor` concurrently with `extract_clip_audio()` and `speech_transcriber.transcribe()`, joining `crop_future.result()` in `try/finally` before marking the job `"ready"`.
   - Concurrency is safe because `crop_map.json` and `transcript.json` are separate **Clip Session** manifests written atomically via UUID temp files and `os.replace`.

## Consequences

### Positive
- Cuts video decoding in `FaceTracker.analyze_video()` from two passes to one pass (`total_frames` reads total) and removes seek-to-zero overhead.
- Overlaps face tracking with Whisper transcription in `run_local_cut()`, reducing total Ready Clip ingestion latency without changing `crop_map.json` or frontend/Remotion contracts.
- Eliminates repeated MediaPipe initialization and unnecessary `1920x1080` BGR-to-RGB allocations across clips while preserving thread safety and deterministic resource cleanup.

### Negative / Trade-offs
- **Shot-Anchored Layout Snapping** continues to inspect cuts within the `[T - 0.25s, T]` lookback window; future rules requiring look-ahead beyond the current even frame would need explicit buffering.
- Sharing a `MediaPipeFaceDetector` instance across concurrent `/track-face` and ingestion jobs serializes `face_detection.process()` calls via its lock, preventing simultaneous MediaPipe C++ calls from corrupting state while trading parallel inference for safety.
