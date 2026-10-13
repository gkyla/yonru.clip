# 0024. Scoped Subtitle Preset Application & Layout Preservation

Date: 2026-10-13

## Status

Accepted

## Context

In Yonru Clip, applying a `Subtitle Style Preset` (e.g. *Hormozi Bold*, *Clean Vlog*, *Viral Hook*) was previously implemented by extracting a monolithic style snapshot and overwriting all reactive styling refs via `loadStyleSettings(updated)`. 

Because the underlying coordinator was initialized with `DEFAULT_SUBTITLE_STYLES`, this monolithic rehydration inadvertently wiped out:
1. **Canvas Layout & Letterbox Presentation**: Resets `videoLayout` (`landscape` back to `vertical`) and `landscapeBackground` (`blur` back to `black`).
2. **Camera Framing & Zoom**: Resets `cropMode`, `cropPercentX`, and `splitZoomTop` / `splitZoomBottom` back to default values.
3. **Subtitle Pacing (Word Chunking Density)**: Resets `subtitleMode` (e.g. `1_word`, `3_words`) back to default.
4. **Subtitle Placement & Timing**: Resets `subtitlePosition` (e.g. `top`, `bottom`) and `subtitleOffset` back to defaults.

Creators expect that selecting a subtitle visual theme (typography, colors, highlight effects, stroke) should never destructively mutate their canvas aspect ratio, video crop framing, or subtitle placement.

## Decision

1. **Domain Model Scoping ([CONTEXT.md](../../CONTEXT.md))**:
   - Applying a **Subtitle Style Preset** is strictly scoped to aesthetic typographic styling: `font`, `fontSize`, `subtitleFontWeight`, `subtitleTextColor`, `subtitleHighlightColor`, `subtitleAnimation`, `subtitleHighlightMode`, `subtitleBackground`, `subtitleStrokeWidth`, `subtitleTextTransform`, and the active `subtitlePreset` ID.
   - Non-typographic properties are completely decoupled from preset application:
     - **Canvas Layout**: `videoLayout`, `landscapeBackground`, `landscapeBlurRadius`, `landscapeDarkness`.
     - **Camera Framing**: `cropMode`, `cropMap`, `cropPercentX`, `splitZoomTop`, `splitZoomBottom`, `splitOffsetXTop`, `splitOffsetYTop`, `splitOffsetXBottom`, `splitOffsetYBottom`.
     - **Subtitle Pacing**: `subtitleMode` (`word`, `3_words`, `4_words`).
     - **Subtitle Positioning & Timing**: `subtitlePosition`, `subtitleOffset`, `subtitleSyncOffset`, `autoAdaptiveSubtitles`.
     - **Audio & Presentation**: `volume`, `subtitlesEnabled`.

2. **Targeted State Mutation in `applyPreset`**:
   - `useSubtitleStyle.ts` and `SubtitleStyleCoordinator.ts` must mutate only the declared typographic fields when applying a preset, leaving all other reactive properties intact.
   - Non-typographic state is never passed through a full-reset cycle during preset selection.

3. **Base Preset with Custom Tweaks Preservation**:
   - When a creator customizes individual typographic properties (e.g. changing font size or stroke color in the Text tab) after selecting a preset, the active `subtitlePreset` ID remains intact as the baseline design identity.
   - Subsequent preset selection replaces the entire typography & animation bundle with the new preset's values, while preserving Layout, Framing, Pacing, and Positioning.

## Consequences

### Positive
- Zero unexpected side effects: creators can freely experiment with subtitle presets without losing their camera framing, letterbox background blur, or custom subtitle placement.
- Clean separation of concerns between visual branding (Presets) and physical framing / timeline pacing.
- Full adherence to ubiquitous domain language in `CONTEXT.md`.

### Negative / Trade-offs
- Unit tests and coordinators must distinguish between full snapshot rehydration (when loading a clip from disk) and targeted preset application (when clicking a preset).
