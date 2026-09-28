# 0007. Bleep Audio Preset Library & Static Audio Asset Integration

Date: 2026-07-28

## Status

Accepted

## Context

Previously, enabling custom bleep sound required users to manually upload a custom audio file every time. If no file was uploaded, selecting custom audio mode resulted in missing bleep tones. Creators needed pre-packaged system default bleep sounds alongside the ability to manage a library of custom uploaded censorship tones.

## Decision

1. **Pre-Packaged Static Asset**: Ship a built-in static bleep tone at `frontend/public/audio/bleep.wav` (1000 Hz sine wave tone, 1-second duration) accessible via static URL `/audio/bleep.wav`.
2. **Bleep Audio Preset Library**: Maintain a `bleepLibrary` array in `useSafetyAuditor.ts` initialized with the default system preset (`Standard Bleep (1000Hz)`).
3. **Custom Audio Upload & Selection**: Automatically append user-uploaded audio files to `bleepLibrary`, set the uploaded file as the active `selectedBleepAudioId`, and persist non-preset library items to `localStorage` (`yonru_bleep_library`).
4. **Reactive Backward Compatibility**: Maintain reactive binding for `customBleepFile` pointing to the currently selected library item so existing bridge and export payload watchers continue working without breaking API contracts.

## Amendment (2026-09-28)
- **Built-in Preset Standardization**: Removed novelty presets (Discord, Roblox, Spongebob) to keep the repository and default audio library focused and clean.
- **Sole Built-in Preset**: Retained `Standard Bleep` (`/audio/bleep.wav`, 1000Hz sine tone) as the single pre-packaged built-in preset.
- **Custom Uploads Intact**: The ability for users to upload and manage custom audio files remains fully supported.

## Consequences

### Positive
- Users immediately have a functional, high-quality default bleep tone without needing manual uploads.
- Multiple custom audio tones can be uploaded, stored, and toggled seamlessly.
- Preset items are protected from deletion while user custom uploads can be managed easily.
- Repository footprint is kept clean without unnecessary third-party novelty audio files.

### Negative / Trade-offs
- Base64 encoded custom audio files stored in `localStorage` use client-side storage space (capped by file upload limits).
