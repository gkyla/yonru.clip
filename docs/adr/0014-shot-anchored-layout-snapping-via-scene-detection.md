# 0014. Shot-Anchored Layout Snapping via Two-Pass Scene Detection

Date: 2026-09-23

## Status

Accepted (Amends [ADR 0013](./0013-responsive-face-tracking-and-stacked-multi-speaker-reframe.md))

## Context

In `yonru.clip`, transitioning between Single-Speaker framing and **Stacked Multi-Speaker Reframe** previously relied on online frame-by-frame sample-counter heuristics and blind backfill in `FaceTracker` ([ADR 0013](./0013-responsive-face-tracking-and-stacked-multi-speaker-reframe.md)). This created a fundamental dilemma:
1. Waiting for multi-frame confirmation delayed camera cuts into split mode by 2–4 frames after the visual cut.
2. Conversely, blind backfill to sample 1 caused premature split layout activation on odd-frame cut boundaries, transitional frames, or false-positive detections, resulting in duplicate host faces ("muka kembar") rendered across both viewports on solo footage.
3. In wide footage, temporary speaker dropouts (blinking, head turning, looking down) caused layout jitter and risking inadvertent reversion to single-speaker framing.

Because `yonru.clip` processes pre-recorded source videos with discrete camera shot boundaries, estimating cuts purely from face bounding boxes without visual frame delta knowledge was inherently fragile.

## Decision

1. **Two-Pass Shot Boundary Architecture**:
   - Decouple **Visual Cut Point** detection from **Face Tracking & Layout Classification**.
   - **Pass 1 (`SceneDetectorSeam`)**: Fast pre-scan across consecutive frames downscaled to micro-resolution ($160\times 90$) evaluating HSV color histogram correlation (`cv2.compareHist`). Significant correlation drops ($< 0.65$) establish exact integer-frame **Visual Cut Points**. A minimum refractory period of $0.5\text{s}$ prevents rapid strobe/gesture false positives.
   - **Reset Capability**: Add `reset()` to the `FrameSource` contract (`cv2.CAP_PROP_POS_FRAMES = 0` or stream reset), enabling zero-overhead rewind between passes.
   - **Pass 2 (`FaceTracker`)**: Perform deep face tracking every 2 frames as before, cross-referencing layout mode candidates against the pre-computed cut timestamps.

2. **Shot-Anchored Layout Snapping**:
   - **Cut into Split**: When dual prominent faces ($\ge 20\%$ frame width separation) are detected at time $T$, `FaceTracker` checks for a Visual Cut Point in the asymmetric lookback window $[T - 0.25\text{s}, T]$. If found, the layout switch is **snapped strictly to the exact cut timestamp**.
   - **Cut into Single**: When detected faces drop from 2 to 1 and a Visual Cut Point exists in $[T - 0.25\text{s}, T]$, the layout instantly snaps back to single-speaker framing at the cut timestamp.
   - **In-Shot Continuity & Dropout Rejection**: If faces drop from 2 to 1 without a Visual Cut Point, the tracker recognizes that the camera did not switch; the event is classified as an in-shot blink or temporary occlusion. The split layout remains locked and coordinates freeze.
   - **In-Shot Entry**: In continuous shots without camera cuts, entering split mode requires the standard $0.35\text{s}$ stability hold.

3. **Container Stream Presentation Timestamp (PTS) Alignment**:
   - `ffmpeg` clip extractions and video streams often exhibit a non-zero initial presentation timestamp (`start_time`, e.g. `0.083s` / ~2 frames delay due to audio-video interleaving or B-frame reordering).
   - While HTML5 `<video>` and Remotion seek according to container stream PTS, OpenCV's `VideoCapture` starts decoding sequentially from frame index 0 ($0.0\text{s}$).
   - `FrameSource` extracts the container stream `start_time` via `ffprobe` (`get_video_start_time`), ensuring both `OpenCVSceneDetector` and `FaceTracker` compute timestamps anchored to container PTS: $t = \text{start\_time} + (\text{frame\_idx} / \text{fps})$. This prevents sub-second desynchronization between backend detection and frontend playback.

4. **Seam Abstraction & TDD Isolation**:
   - Abstract scene detection behind `SceneDetectorSeam`, with production `OpenCVSceneDetector` and deterministic `MockSceneDetector` for millisecond unit testing without video assets.

## Consequences

### Positive
- Completely eliminates duplicate face artifacts ("muka kembar") by never activating split mode before the physical camera cut.
- Eliminates camera cut latency (0-frame delay at cut boundaries).
- Immunizes Stacked Multi-Speaker Reframe against speaker blinks and temporary head turns without risking delayed cuts.
- Guarantees exact sub-frame timestamp synchronization between OpenCV analysis and HTML5 / Remotion video playback.
- Maintains clean architectural boundaries and testability via dependency injection.

### Negative / Trade-offs
- Reading video frames in two passes adds an initial pre-scan, though the downscaled histogram scan overhead is negligible ($< 0.5\text{s}$ per 60 seconds of video).
