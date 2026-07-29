# 0005. Mute State Deduplication & Iframe Props Isolation

Date: 2026-07-26

## Status

Accepted

## Context

The audio bleep volume watcher in `useRemotionBridge.ts` previously monitored `state.currentTime.value` in its watched sources array. As `currentTime` updated on every single frame during playback (up to 60 times a second), the watcher triggered `bridge.updateProps({ volume })` on every frame. Sending `UPDATE_PROPS` postMessages 60 times per second to the Remotion Player iframe forced React inside the iframe to re-evaluate props and re-render `<YonruClip>` on every tick, causing HTML5 `<video>` elements inside Remotion to re-sync and replay spoken words repeatedly.

## Decision

1. **Remove `currentTime` from Volume Watcher**: Exclude `state.currentTime.value` from the bleep audio watcher dependency array.
2. **State Deduplication**: Introduce `lastMuteState` to track mute transitions. `bridge.updateProps({ volume })` is dispatched strictly when the mute status toggles (entering/exiting a flagged sensitive word segment or updating volume settings).

## Consequences

### Positive
- Completely eliminates 60Hz iframe re-rendering loops and word replay bugs during video playback.
- Reduces postMessage communication overhead between parent window and iframe to near zero during steady-state playback.
- Ensures seamless audio censorship muting without affecting video playback smoothness.

### Negative / Trade-offs
- None.
