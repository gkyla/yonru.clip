# 0029. Decoupled Subtitle Editing and Streamlined Timeline

Date: 2026-11-11

## Status

Accepted

## Context

In Yonru Clip, the Studio Editor timeline previously included a dedicated `subtitle` track (`{ id: 'subtitle', name: 'Subtitle', type: 'subtitle', items: [] }`).

However, this track introduced significant UX and architectural friction:
1. **Empty Track Confusion**: Subtitles in Yonru Clip are word-level transcript segments rendered dynamically from `fullTranscript` / `transcript` data, styled via presets and typography panels, and edited through the dedicated floating panel (`EditorFloatingPanel.vue`). The timeline `subtitle` track never contained draggable or editable timeline track items (`items: []` was permanently empty), confusing creators who expected direct inline manipulation on the canvas.
2. **Coupled Content Safety Visualization**: The only active visual element rendered on the `subtitle` track was the Content Safety Audit flagged segment markers (`flaggedSegments` red markers). Because dialogue speech originates from the Main Video footage rather than a separate subtitle media asset, displaying safety flags on an empty subtitle track masked the actual source of the flagged speech.
3. **Redundant Status Indicator**: The track label displayed `(OFF)` when subtitles were disabled, duplicating state indicators that are already prominently surfaced in the Action Rail, the Floating Subtitle Panel, and the Subtitle Preset Pane.

## Decision

1. **Remove Subtitle Track from Canonical Timeline Tracks**:
   - Update `useTimelineState.ts` default tracks to include only media tracks: `['video', 'audio', 'text']`.
   - Update `types/clipper.ts` so `TimelineTrack.id` and `type` reflect canonical tracks (`'video' | 'audio' | 'text'`).
   - Remove automatic `subtitle` track injection from `jobCoordinator.ts`.
2. **Backward-Compatible Session Sanitization**:
   - In `jobCoordinator.ts` and clip session loaders, automatically filter out legacy `subtitle` track entries (`t.id !== 'subtitle'`) when loading existing clip manifests from disk or backend responses, preventing empty legacy tracks from persisting in future saves.
3. **Relocate Content Safety Flagged Markers to Main Video Track**:
   - In `TimelineEditor.vue`, render the Content Safety Audit `flaggedSegments` overlay directly across the `video` (Main Video) track, visually tying censored speech bleeps directly to the source footage from which the dialogue originated.
4. **Preserve Decoupled Subtitle Lifecycle**:
   - Full transcript editing remains cleanly housed in `EditorFloatingPanel.vue`.
   - Visual styling, kinetic animations, and presets remain housed in `SubtitlePresetPane.vue` and `PresetStudioModal.vue`.
   - Ripple delete and trim operations continue to shift `fullTranscript` timestamps without requiring synthetic timeline track items.

## Consequences

### Positive
- **Streamlined Timeline Canvas**: Eliminates dead vertical space and user confusion caused by a non-interactive, perpetually empty subtitle track.
- **Accurate Speech Violation Context**: Content safety violation markers are rendered directly over the Main Video track where the spoken dialogue exists.
- **Clean Architecture & Data Model**: Removes technical debt and synthetic track injections from `jobCoordinator.ts` and `timelineTracks` state.
- **Full Backward Compatibility**: Seamlessly loads legacy projects without data corruption or schema errors.

### Negative / Trade-offs
- Subtitle visibility (`subtitlesEnabled`) is no longer indicated on the timeline canvas itself; users rely on the left Action Rail and the Subtitle floating panel to observe or toggle subtitle status.
