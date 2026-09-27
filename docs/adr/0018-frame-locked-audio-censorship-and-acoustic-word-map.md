# 0018. Frame-Locked Audio Censorship & Acoustic Word Map

Date: 2026-09-27

## Status

Accepted (Evolves and supersedes manual padding mechanism in ADR-0002)

## Context

In ADR-0002, Word-Level Audio Censorship introduced a manual `bleepPaddingOffset` slider (defaulting to 50ms) to prevent phoneme leakage during muting. However, users reported that audio bleeps still felt unaligned or mistimed without manual tuning. Codebase investigation revealed two core architectural bottlenecks:
1. **Linear Word Duration Approximation**: In `safetyEngine.ts`, word timestamps were calculated by uniformly dividing segment duration (`seg.duration / words.length`), causing significant timing drift whenever subtitles were chunked into multi-word phrases (e.g. `3_words` mode).
2. **Imperative Asynchronous Audio Latency**: In `useRemotionBridge.ts`, bleep playback relied on `new Audio().play()`, introducing non-deterministic browser audio engine startup delays (~40–120ms) while the video track was muted instantly. Furthermore, backend headless MP4 export lacked frame-locked bleep composition parity.

## Decision

1. **Acoustic Word Map as Source of Truth**:
   - Decouple audio censorship timing completely from visual subtitle chunking (`subtitleMode`).
   - Maintain an immutable `Acoustic Word Map` preserving exact Whisper word boundaries (`start`, `duration`, `word`) directly from acoustic transcription.
   - `safetyEngine.ts` strictly queries the `Acoustic Word Map` instead of linearly slicing formatted subtitle segments.

2. **Native Remotion Frame-Locked Audio Censorship**:
   - Route audio muting and bleep playback directly through the Remotion composition pipeline (`Composition.tsx`).
   - Use frame-accurate volume ducking on the main video source combined with synchronized Remotion `<Sequence><Audio>` bleep layers frame-locked to video playback.
   - Guarantees 100% parity across editor scrubbing, live preview, and backend headless MP4 export with 0ms browser scheduler latency.

3. **Automated Internal Micro-Envelope**:
   - Replace manual user-configured padding with an internal 15–20ms zero-crossing micro-envelope crossfade at word onset and offset boundaries to eliminate digital clicking and consonant clipping without user intervention.

4. **UI Simplification**:
   - Set `Auto Acoustic Snapping` as default behavior in `BlacklistSettings.vue`.
   - Relocate the manual `Bleep Padding` slider into an "Advanced Timing" collapsible section solely for extreme acoustic environments (e.g., severe room reverb/echo).

## Consequences

### Positive
- Censorship bleeps and video muting are always frame-accurate and instant across all subtitle modes without requiring manual padding adjustments.
- Eliminates browser audio thread lag during interactive preview playback.
- Subtitle visual chunking (`1_word`, `3_words`, `sentence`) can be changed freely without corrupting audio censorship accuracy.
- Complete parity between frontend editor preview and backend headless render outputs.

### Negative / Trade-offs
- Requires passing censored audio sequences and ducking metadata into Remotion props for both preview and export pipelines.
