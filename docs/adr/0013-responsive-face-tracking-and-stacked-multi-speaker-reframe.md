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
4. **Hysteresis Anti-Flicker Guardrail & Fast Cut Bypass**:
   - **Fast Cut Bypass into Split (0-Frame Delay)**: When a camera cut transitions from solo to wide dual-speaker footage (detected dual faces separated by $\ge 20\%$ frame width), execute an instant snap cut after 2 confirmation samples (~0.13s) and **backfill** the keyframe timestamp to sample 1 ($T$), achieving 0-frame delay at the cut boundary.
   - For regular in-scene entry into split (non-cut / closer proximity $< 20\%$), apply a trimmed stability window of ~0.35 seconds (~5 samples / 10 frames) before switching from single into stacked multi-speaker layout.
   - For reverting from split back to single on regular/partial dropout (e.g. eye blink, head turn, or temporary face occlusion while the other speaker remains in place), maintain a stability hold window of 0.8 seconds while freezing the missing speaker's viewport coordinates, preventing layout collapse or flicker during conversational pauses.
   - On camera scene cuts to solo close-ups (where the solo face position jumps $>15\%$ frame width from existing viewports), bypass hysteresis and execute an immediate jump cut after 2 confirmation frames (~0.12s).
   - When no faces are detected (e.g. B-roll, presentation slides, or scenery footage), automatically revert to Single-Speaker framing with center crop ($X = 50\%$) after the stability hold.
   - Use instant jump cuts (1-frame snap cuts) for layout switches without animated whip-pan or slide-morph.
5. **Prominence Filtering for Background Noise**:
   - Filter detected faces by requiring a minimum bounding box height of $\ge 8\%$ of frame height (reduced from 10% to reliably capture deep/wide podcast camera shots while discarding distant bystanders and passerby noise).
   - Sort the two most prominent faces by horizontal position (left $\rightarrow$ top pane, right $\rightarrow$ bottom pane).
6. **Center-Seam Visual Divider & Auto-Adaptive Subtitle Ergonomics**:
   - Render a sleek 2px dark dividing seam with subtle shadow at $Y = 960\text{px}$ between the top and bottom panels.
   - **Auto-Adaptive Subtitle Placement (Default)**:
     - In Single-Speaker framing, subtitles anchor at the user's selected position (default lower-third).
     - In Stacked Multi-Speaker framing, subtitles automatically adapt to float over the center dividing seam ($Y = 960\text{px}$), guaranteeing that neither speaker's face or chest is occluded.
   - **User Override Settings**: Provide a toggle in `SidebarSettings.vue` allowing creators to choose between *Auto-Adaptive* (dynamic seam float) and *Custom/Fixed* (strict adherence to manual presets).
7. **Face-Anchored Viewport Framing Zoom & Dual Split Sliders**:
   - In `face_tracking` mode, expose dual zoom sliders (`Top Speaker Zoom` and `Bottom Speaker Zoom`, $1.0\times$–$2.5\times$) in `SidebarSettings.vue` during Stacked Multi-Speaker segments.
   - Each slider scales the viewport centered around the active speaker's detected face coordinates (`top_x`, `bottom_x`) with natural headroom bias, isolating tight single-speaker closeups and cropping out adjacent subjects in wide-angle footage.
   - Lock canvas dragging during active `face_tracking` mode to prevent accidental overrides to manual mode, requiring explicit navigation to `[ Manual Pan ]`.
8. **Backward-Compatible Crop Map Schema**:
   - Extend `crop_map.json` keyframes with `mode: 'single' | 'split'`, providing `top_x` and `bottom_x` while preserving legacy `x` fallback.
9. **Constant Native Video Dimensions and Instant Synchronous Snap Cut**:
   - In `Composition.tsx`, eliminate 1-frame compositor texture drops and black flashes by enforcing **constant native CSS dimensions** on all `<Video>` elements (`width: videoDisplayW`, `height: videoDisplayH`, e.g. $3413\text{px} \times 1920\text{px}$). Neither `<Video>` element ever alters its DOM pixel dimensions across mode transitions, eliminating Chromium GPU texture surface reallocation.
   - All viewport framing, dual zoom scales, and 2D headroom/pan offsets are executed $100\%$ via GPU hardware-accelerated transforms (`transform: translate3d(...) scale(...)`) with `overflow: hidden` container clipping.
   - Execute an **Instant Synchronous Snap Cut (0s handoff delay)** on layout reversion: the instant `isSplit` becomes `false`, Secondary Viewport and Center Seam Divider cut to `visibility: 'hidden'` and `opacity: 0` on the exact cut frame. This prevents lingering secondary panels from rendering over single-speaker footage (which previously caused duplicate host face glitches).
   - Viewport containers and video elements maintain GPU hardware layer promotion via `willChange` and `backfaceVisibility: 'hidden'`.
10. **Zoom-Relative Framing Offset & 2D Canvas Dragging Guardrails**:
   - When zoom $> 1.0\times$ in `face_tracking` mode, enable direct 2D canvas dragging and sidebar offset sliders (`splitOffsetXTop`, `splitOffsetYTop`, `splitOffsetXBottom`, `splitOffsetYBottom`) normalized between $[-50\%, +50\%]$.
   - Rather than dropping out of face tracking into manual pan, framing offsets act as a persistent relative bias on top of the dynamic face tracking anchor. The camera continues to dynamically follow the speaker's movement while preserving custom headroom and horizontal framing.
   - Enforce mathematical edge guardrails: translations are strictly clamped within physical source dimensions ($[- \text{extraH}, 0]$ vertically, $[- \text{maxOffset}, 0]$ horizontally), guaranteeing that black bars or background voids are physically impossible.
   - At $1.0\times$ zoom, vertical headroom adjustment is locked to 0 (no vertical margin exists) and canvas dragging is disabled to avoid accidental mode disruption.

## Consequences

### Positive
- Camera tracking is responsive, fluid, and stutter-free across both preview and final export.
- Dual-speaker podcast and interview clips automatically receive professional split-screen framing without manual multi-track setup.
- Subtitles remain legible without covering either speaker's face.
- Creators retain full manual control via direct canvas drag and sidebar sliders.

### Negative / Trade-offs
- Analyzing dual-face coordinates slightly increases pre-computation time during initial ingestion.
- Remotion composition renders two video elements during split segments, increasing GPU texture memory usage during active split frames.
