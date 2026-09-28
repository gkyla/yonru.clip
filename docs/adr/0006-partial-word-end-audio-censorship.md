# 0006. Partial Word End Audio Censorship

Date: 2026-07-26

## Status

Deprecated (Superseded by [ADR-0018](0018-frame-locked-audio-censorship-and-acoustic-word-map.md) on 2026-09-27)

## Deprecation Notice

In practice, partial syllable muting (`partial_end`) proved problematic:
1. Human speech syllables do not distribute evenly across 50% durations. Slicing at `duration * 0.5` causes unnatural phoneme clipping, choppy speech artifacts, or leakage of sensitive trailing plosives.
2. Short words (< 250ms) resulted in sub-100ms bleeps that sounded like digital audio glitches/clicks.
3. Social media moderation algorithms (YouTube, TikTok, Instagram) penalize clips with partially-audible profanity.
4. Redundant UI toggle cluttered the Content Safety dialog.

Consequently, `partial_end` has been retired. Word-Level Audio Censorship operates exclusively via **Full Word Frame-Locked Censorship** with zero-crossing micro-envelopes, ensuring 100% platform compliance, clean acoustics, and streamlined UI.

## Context (Historical)

Users requested an option to mute only the ending syllable of flagged sensitive words (e.g. "Mati" -> "Ma" audible, "ti" muted), so viewers retain spoken context without unmuting explicit profanity.

## Decision (Historical)

1. **Bleep Mode Setting**: Add a reactive `bleepMode` state (`'full'` vs `'partial_end'`), defaulted to `'full'`, persisted in `localStorage` as `yonru_bleep_mode`.
2. **Partial End Calculation**: In `auditTranscript` (`contentAuditor.ts`), when `bleepMode` is `'partial_end'`:
   - Keep the initial 50% of the word's duration unmuted (`start = word.start + (word.duration * 0.5)`).
   - Mute the remaining 50% duration plus configured `bleepPaddingOffsetMs` (`duration = (word.duration * 0.5) + paddingSec`).
3. **UI Integration**: Add an **Audio Mute Scope** radio button / toggle in `BlacklistSettings.vue` allowing users to choose between "Full Word (Utuh)" and "Partial End (Akhiran Kata)".
4. **Backend Render Payload**: Include `bleep_mode` in the backend render export payload (`useClipperExport.ts`).
