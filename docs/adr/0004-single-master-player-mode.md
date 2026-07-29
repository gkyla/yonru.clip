# 0004. Single Master Player Mode Architecture

Date: 2026-07-26

## Status

Accepted

## Context

Previously, when `useNativePlayer` was set to `false`, the background native `<video>` element (`previewVideo`) was still issued `play()` commands alongside the Remotion Player iframe. As both players played simultaneously, timestamp drift (>0.25s) between the background native video and the foreground Remotion iframe triggered forced native seeking. This native seeking triggered native `@timeupdate` events, which updated global `currentTime` and seeked the Remotion Player backward, creating a 30Hz feedback seek loop that caused severe video stuttering and repeating audio.

## Decision

1. **Strict Single Master Player Isolation**: Enforce single master player execution. When `useNativePlayer` is `false`, the background native `<video>` element MUST be kept paused and muted. Only the Remotion Player iframe plays media and drives playback timeupdates.
2. **Conditional Sync Drift Evaluation**: Restrict background native video sync drift checks in `onRemotionMessage` exclusively to when `useNativePlayer` is `true`.
3. **Selective Player Playback Triggering**: Update `watch(isPlaying)` and `watch(currentTime)` to trigger native video playback methods strictly when `useNativePlayer` is `true`.

## Consequences

### Positive
- Completely eliminates dual-player feedback seek loops, backward jumps, and repeating audio.
- Significantly reduces CPU/GPU resource usage by decoding only a single video stream at a time.
- Guarantees deterministic, smooth playback across all preview modes.

### Negative / Trade-offs
- Switching between Remotion mode and Native player mode during active playback requires a quick seek alignment.
