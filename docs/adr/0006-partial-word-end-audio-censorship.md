# 0006. Partial Word End Audio Censorship

Date: 2026-07-26

## Status

Accepted

## Context

Users requested an option to mute only the ending syllable of flagged sensitive words (e.g. "Mati" -> "Ma" audible, "ti" muted), so viewers retain spoken context without unmuting explicit profanity.

## Decision

1. **Bleep Mode Setting**: Add a reactive `bleepMode` state (`'full'` vs `'partial_end'`), defaulted to `'full'`, persisted in `localStorage` as `yonru_bleep_mode`.
2. **Partial End Calculation**: In `auditTranscript` (`contentAuditor.ts`), when `bleepMode` is `'partial_end'`:
   - Keep the initial 50% of the word's duration unmuted (`start = word.start + (word.duration * 0.5)`).
   - Mute the remaining 50% duration plus configured `bleepPaddingOffsetMs` (`duration = (word.duration * 0.5) + paddingSec`).
3. **UI Integration**: Add an **Audio Mute Scope** radio button / toggle in `BlacklistSettings.vue` allowing users to choose between "Full Word (Utuh)" and "Partial End (Akhiran Kata)".
4. **Backend Render Payload**: Include `bleep_mode` in the backend render export payload (`useClipperExport.ts`).

## Consequences

### Positive
- Allows viewers to retain spoken word context while censoring sensitive term suffixes.
- Seamlessly integrates with existing padding offset buffers and player volume muting logic.
- Fully synchronized across frontend live preview and backend render payloads.

### Negative / Trade-offs
- Words shorter than 100ms may have very brief initial syllables.
