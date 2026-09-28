# 0019. Dual-Layer Content Safety Remediation & Score Decoupling

Date: 2026-09-27

## Status

Accepted

## Context

In Yonru Clip, creators rely on the Content Safety Audit to detect profanity, hate speech, and sensitive keywords that could trigger platform shadowbans on TikTok, YouTube Shorts, and Instagram Reels. Previously, activating "Auto-Fix (Mask Words)" masked visual subtitle text (e.g. `kamu b*engsek`), but the Content Safety Score remained penalized because re-auditing against the Acoustic Word Map still detected the underlying spoken word. Conversely, if words were erased from the audit engine, audio censorship timestamps (`flaggedSegments`) were cleared, causing the audio to unmute.

Creators were trapped in an architectural catch-22: either keep the audio muted with a failing audit score, or pass the audit score with unmuted profanity.

## Decision

1. **Dual-Layer Remediation Model**:
   - Establish two distinct violation states in `safetyEngine.ts`: **Active Violations** (unmitigated speech) and **Remediated Violations** (speech that is both visually masked in subtitles and covered by active Word-Level Audio Censorship).
   - A violation is classified as **Remediated** if and only if:
     1. Its visual representation in `seg.text` / `w.text` is masked (e.g., contains masking characters `*` or `[BLEEP]`, or has `isMasked: true`), **AND**
     2. `audioBleepEnabled` is `true`.

2. **Score Decoupling from Censorship Intervals**:
   - `flaggedSegments` remains fully populated with exact millisecond timestamps from the Acoustic Word Map regardless of masking state, guaranteeing continuous frame-accurate audio ducking/bleeping in Remotion and backend export.
   - Remediated Violations do NOT deduct points from the Content Safety Score (Score = 100 / Safe).
   - If the creator disables `audioBleepEnabled`, the remediated status drops, reverting to an active audio violation and penalizing the safety score.

3. **Lossless Transcript Masking & Revert**:
   - When `maskTranscript()` executes, store `w.rawText` and `seg.rawText` alongside the masked text.
   - Implement `unmaskTranscript()` to enable zero-loss, instant reverting of masked words.

4. **Streamlined Remediation in Content Audit UI**:
   - In `ContentAuditPanel.vue`, render remediated keywords as clean emerald tags without redundant clutter badges, update the score gauge status to `"PROTECTED & NEUTRALIZED"`, and provide a single-click `"Revert to Unmasked Text"` action for effortless rollback.

## Consequences

### Positive
- Creators achieve a 100% clean safety audit score immediately upon clicking "Auto-Fix", while audio remains surgical and fully muted during preview and export.
- Eliminates accidental shadowban risk if creators mistakenly turn off audio censorship while subtitles are masked.
- Provides immediate visual feedback and a deterministic revert mechanism.

### Negative / Trade-offs
- `auditTranscript()` and `audit()` must evaluate both visual text and acoustic word map representations to determine remediation status.
