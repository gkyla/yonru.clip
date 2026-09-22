# 0013. Responsive Face Tracking and Stacked Multi-Speaker Reframe

Date: 2026-09-22

## Status

Accepted

## Context

In `yonru.clip`, face tracking was previously governed by [ADR 0008](./0008-precomputed-auto-reframe-and-default-face-tracking.md). While pre-computation and default face tracking solved render latency, the camera motion and framing suffered from three significant limitations in production:
1. **Trailing Latency (Laggy Panning)**: The backend smoothing in `FaceTracker` used a conservative exponential moving average factor of `0.1` evaluated at half-framerate, requiring ~1.5 seconds (40–45 frames) to catch up with speaker movement, making camera panning feel sluggish and delayed.
2. **Discrete Stepping Stutter**: In `Composition.tsx`, Remotion resolved the active crop position via a discrete "hold" step (`entry.time <= currentTime`) without interpolation between keyframes. This produced a visible "staircase" jump artifact during playback and export rather than smooth gliding.
3. **Lack of Multi-Speaker Layout (Wide Shot Crop Degradation)**: When two speakers were visible simultaneously in wide footage (e.g. podcasts, interviews), `MediaPipeFaceDetector` arbitrarily tracked only the largest single face, completely cropping out the second speaker.

## Decision

1. **Responsive Damped Camera Gliding**:
   - Raise the backend tracking smoothing factor from `0.1` to `~0.3` in `FaceTracker`, accelerating convergence from 1.5s down to ~0.35s for responsive camera movement.
   - Implement sub-frame continuous LERP (Linear/Smooth Interpolation) in Remotion `Composition.tsx` between adjacent `cropMap` keyframes, eliminating discrete stepping stutter.
2. **Instant Snap-Cut on Hard Transitions**:
   - When detected face movement exceeds the cut threshold (>15% frame width) or across scene cuts, execute an immediate jump cut without animated whip-panning to prevent motion sickness.
3. **Dynamic Stacked Multi-Speaker Reframe**:
   - Detect when two primary speakers are visible in wide footage. Automatically split the vertical 9:16 canvas into stacked top and bottom viewports (1080x960 each):
     - **Top Viewport**: Crops and centers the left-hand speaker.
     - **Bottom Viewport**: Crops and centers the right-hand speaker.
   - When footage transitions to a solo close-up, automatically revert to single vertical 9:16 framing.
4. **Hysteresis Anti-Flicker Guardrail & Zero-Face Fallback**:
   - Require a minimum stability window of 1.0 second (consecutive detection) before switching between single and stacked multi-speaker layouts.
   - Maintain a 1.0 second persistence hold when a face temporarily drops out, preventing jarring layout flickering.
   - When no faces are detected (e.g. B-roll, presentation slides, or scenery footage), automatically revert to Single-Speaker framing with center crop ($X = 50\%$) after the stability hold.
   - Use instant jump cuts (1-frame snap cuts) for layout switches without animated whip-pan or slide-morph.
5. **Prominence Filtering for Background Noise**:
   - Filter detected faces by requiring a minimum bounding box height of $\ge 10\%$ of frame height, discarding background bystanders and passerby noise.
   - Sort the two most prominent faces by horizontal position (left $\rightarrow$ top pane, right $\rightarrow$ bottom pane).
6. **Center-Seam Visual Divider & Auto-Adaptive Subtitle Ergonomics**:
   - Render a sleek 2px dark dividing seam with subtle shadow at $Y = 960\text{px}$ between the top and bottom panels.
   - **Auto-Adaptive Subtitle Placement (Default)**:
     - In Single-Speaker framing, subtitles anchor at the user's selected position (default lower-third).
     - In Stacked Multi-Speaker framing, subtitles automatically adapt to float over the center dividing seam ($Y = 960\text{px}$), guaranteeing that neither speaker's face or chest is occluded.
   - **User Override Settings**: Provide a toggle in `SidebarSettings.vue` allowing creators to choose between *Auto-Adaptive* (dynamic seam float) and *Custom/Fixed* (strict adherence to manual presets).
7. **Independent Viewport Manual Overrides & Dual Settings Sliders**:
   - Allow creators to drag the top and bottom viewports independently on the editor canvas to fine-tune framing.
   - Expose dual slider controls in `SidebarSettings.vue` for manual X-offset adjustments of both top and bottom speakers.
8. **Backward-Compatible Crop Map Schema**:
   - Extend `crop_map.json` keyframes with `mode: 'single' | 'split'`, providing `top_x` and `bottom_x` while preserving legacy `x` fallback.

## Consequences

### Positive
- Camera tracking is responsive, fluid, and stutter-free across both preview and final export.
- Dual-speaker podcast and interview clips automatically receive professional split-screen framing without manual multi-track setup.
- Subtitles remain legible without covering either speaker's face.
- Creators retain full manual control via direct canvas drag and sidebar sliders.

### Negative / Trade-offs
- Analyzing dual-face coordinates slightly increases pre-computation time during initial ingestion.
- Remotion composition renders two video elements during split segments, increasing GPU texture memory usage during active split frames.
