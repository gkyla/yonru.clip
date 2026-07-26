# 0002. Word-Level Granular Audio Censorship with Configurable Padding

Date: 2026-07-20

## Status

Accepted

## Context

Previously, the Content Safety Audit Panel (`auditTranscript`) generated `flaggedSegments` using the active `subtitleMode` (e.g. `3_words`, `sentence`, `phrase`). When a single sensitive word (e.g. "mati") occurred inside a multi-word chunk (e.g. "mereka akan mati"), the entire chunk's time window was flagged. Consequently:
- The red marker on the timeline covered all words in the subtitle chunk.
- Both frontend preview player muting and backend export bleeping muted the entire multi-word phrase, muting non-sensitive adjacent words.

## Decision

We decided to decouple audio censorship timing from visual subtitle layout chunking (`subtitleMode`):
1. **Word-Level Granularity**: `auditTranscript` now always evaluates `flaggedSegments` at the individual word level (`flatWords`), ensuring only the exact timestamps of sensitive words are flagged and muted.
2. **Configurable Bleep Padding Offset**: Implemented a customizable `bleepPaddingOffset` setting (defaulting to `50ms`) applied to the start and end boundaries of each flagged word to prevent phoneme leakage without clipping surrounding text.

## Consequences

### Positive
- Only sensitive words are muted/bleeped during preview playback and video export.
- Adjacent spoken text remains fully audible and intelligible.
- Timeline indicators on the Subtitle track reflect exact word timestamps.

### Negative / Trade-offs
- Word duration estimates rely on linear distribution (`seg.duration / words.length`) when word-level Whisper timestamps are unavailable.
