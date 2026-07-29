# 0003. Timeline Linear Motion & End-of-Timeline Auto-Pause

Date: 2026-07-26

## Status

Accepted

## Context

When playing video clips trimmed from a source video (where `mediaStart` differs from `start`), evaluating segment bounds with strict upper bounds (`t < i.start + i.duration`) caused `videoTime` to collapse to raw `t` at item boundaries. A previous attempt to clamp `videoTime` to a static frozen timestamp caused an active playback sync drift loop (`diff > 0.25s` triggering 30 times a second), resulting in severe video stuttering.

## Decision

1. **Linear Continuous VideoTime Motion**: Update `calculateVideoTime` in `timelineHelpers.ts` and `videoTime` computed in `VideoPreview.vue` to map continuously and linearly (`mediaStart + (t - activeItem.start)`) using inclusive segment matching (`t >= i.start && t <= i.start + i.duration`) or the active item. `videoTime` advances linearly with `t` without raw fallback drops or static freezing.
2. **End-of-Timeline Auto-Pause**: In both native timeupdate handlers (`onNativeTimeUpdate`) and Remotion iframe timeupdate listeners (`onRemotionMessage`), when `currentTime >= timelineDuration`, automatically pause video playback (`state.isPlaying.value = false`) and clamp `currentTime` to `timelineDuration`.

## Consequences

### Positive
- Completely eliminates backward seeking and repeating audio when video playback crosses clip boundaries.
- Prevents sync drift jitter and stuttering loops by maintaining continuous linear videoTime motion.
- Provides smooth end-of-timeline playback pausing consistent with professional video editors.

### Negative / Trade-offs
- Users must manually click Play to replay after the player reaches the end of the timeline.
