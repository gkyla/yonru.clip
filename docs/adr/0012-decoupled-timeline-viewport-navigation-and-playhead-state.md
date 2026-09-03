# 0012. Decoupled Timeline Viewport Navigation and Playhead State

Date: 2026-09-03

## Status

Accepted

## Context

In the multi-track `/editor` timeline, viewport horizontal scrolling was previously coupled to the playback `currentTime` state via an experimental fixed-center playhead model (`onScroll` set `state.currentTime.value = (scrollLeft + containerW / 2) / pxPerSec`). Simultaneously, a watcher on `currentTime` forced `scrollLeft = playheadPx - containerW / 2` whenever the player was paused.

When the playhead was at 0s (before playback started or after video finished), scrolling horizontally to inspect elements toward the end of the video caused the scroll position to violently snap back to 0. Once the user stopped scrolling (150ms timeout), the watcher clamped `targetScroll` (`0 - containerW / 2`) to `0`, resetting `scrollLeft`. Additionally, attempting to scrub via viewport scroll at the tail end triggered boundary resets from player sync messages.

## Decision

1. **Decouple Viewport Panning from Playhead State**: Horizontal scrolling/panning on the timeline canvas (`scrollEl`) purely navigates the visible canvas area across time. It does NOT mutate `state.currentTime.value` during pause.
2. **Eliminate Aggressive Pause Auto-Centering**: Remove the aggressive watcher that forced viewport scroll centering during pause. The viewport stays wherever the user scrolled it until playback begins or an explicit out-of-bounds seek occurs.
3. **Playback Auto-Follow**: Maintain automatic smooth scrolling (`startRaf`) during active playback (`state.isPlaying.value === true`) to keep the moving playhead visible on screen.
4. **Direct Ruler Drag-to-Scrub**: Implement direct drag-to-scrub interactions on the timeline ruler (`mousedown` + `mousemove` + `mouseup`), allowing users to scrub playback time continuously without hijacking the viewport scrollbar.
5. **Clean Visual Hierarchy**: Remove the vestigial center line indicator (`centerLinePx`), establishing the playhead as the sole unambiguous time marker.

## Consequences

### Positive
- Users can freely pan and inspect any portion of the timeline (beginning, middle, or end) while paused without scroll positions snapping back.
- Scrubbing is intentional and controlled via the ruler bar or direct clip interaction.
- Conforms to standard desktop Non-Linear Editor (NLE) interaction patterns (Premiere, DaVinci, Final Cut).

### Negative / Trade-offs
- Users accustomed to mobile-style centered scrubbing must use the ruler or playhead to scrub instead of generic viewport panning.
