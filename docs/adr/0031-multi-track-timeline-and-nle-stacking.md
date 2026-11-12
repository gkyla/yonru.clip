# 0031. Multi-Track Timeline and NLE Layer Stacking

Date: 2026-11-13

## Status

Accepted — extends [ADR 0029](./0029-decoupled-subtitle-editing-and-streamlined-timeline.md); preserves [ADR 0028](./0028-global-span-audio-and-cover-intro-anchoring.md) coordinate spaces.

## Context

Under [ADR 0029](./0029-decoupled-subtitle-editing-and-streamlined-timeline.md), `timelineTracks` stored three fixed singleton tracks in `[video, audio, text]` order with hardcoded IDs (`'video'`, `'audio'`, `'text'`). Creators could not layer parallel audio (such as background music under sound effects) or overlapping styled text elements without item collisions inside one track row.

Multiple UI, state, history, preview, and backend render modules also assumed `'text'` / `'audio'` ID lookups or `timelineTracks[0]` as the Main Video track.

## Decision

1. **Track Cardinality and Minimums**:
   - Keep **Main Video** (`type: 'video'`) strictly limited to **1** track so linear `videoTime`, Cover Slide intro anchoring, and video ripple deletes remain deterministic.
   - Allow multiple **Text Tracks** (`type: 'text'`) and multiple **Audio Tracks** (`type: 'audio'`), always preserving at least **1** active track per type (deleting the last remaining track of a type is blocked).
   - Deleting any additional track (`> 1` of that type) removes the track and its items right away with full Undo/Redo support via `TimelineTransactionEngine`.

2. **NLE Vertical Stack Order and Top-Track-Wins Z-Order**:
   - Organize `timelineTracks` vertically as `[...textTracks, videoTrack, ...audioTracks]`: all Text Tracks stack above Main Video, and all Audio Tracks stack below Main Video.
   - Adding a new Text Track (`Text 2`, `Text 3`, ...) prepends it to the top of the Text group; adding a new Audio Track (`Audio 2`, `Audio 3`, ...) appends it to the bottom of the Audio group.
   - Higher Text Tracks in the vertical list render **in front** of lower Text Tracks and receive canvas click priority first in both live canvas preview (`VideoPreview.vue`) and headless Remotion renders (`Composition.tsx`). Concurrent Audio Tracks mix in parallel.

3. **Per-Track Non-Overlap, Vertical Drag, and Smart Auto-Routing**:
   - Items on the same track row cannot overlap horizontally.
   - Adding a new item targets the active/selected track of the matching `type` first (defaulting to the primary track). If the target interval overlaps an existing item, insertion checks other compatible tracks for an open gap and automatically creates a new track of that type when none fits. Splitting an existing item keeps both halves on the same track.
   - Creators can drag items vertically across tracks of the same `type` (cross-type drops are blocked), subject to target lane collision checks.

4. **Track Naming, Visibility/Mute Controls, and Coordinates**:
   - Use automatic numbered names (`Text 1`, `Text 2`, `Audio 1`, `Audio 2`, ...); custom renaming, per-item volume controls, and manual track row reordering are out of scope for now.
   - Track headers provide per-track **Mute** (Audio) and **Hide/Eye** (Text) toggles that suppress output synchronously in both live Preview and final MP4 export.
   - All Text Tracks inherit [ADR 0028](./0028-global-span-audio-and-cover-intro-anchoring.md) video-relative coordinates and the hatched Cover Slide Intro Zone; all Audio Tracks use global `0.0s` timeline coordinates.

## Considered Options

- **Allow overlapping items within one track vs. multi-track non-overlap + auto-routing**: Single-row overlapping obscures bars and breaks lane drag-clamping; multi-track with auto-routing keeps every row readable without forcing extra clicks.
- **Keep legacy `[video, audio, text]` array order vs. NLE `[text..., video, audio...]`**: Putting Text Tracks above Main Video directly reflects foreground overlay layering and prevents ambiguity about Z-order when adding `Text 2`.

## Consequences

- Every timeline producer and consumer across Frontend, Remotion, and Backend must resolve tracks by `type` (`'video'`, `'text'`, `'audio'`) rather than `'audio'`/`'text'` singleton IDs or `timelineTracks[0]` indexing.
- Saved legacy `[video, audio, text]` clip sessions normalize on load into `[...textTracks, videoTrack, ...audioTracks]` while keeping existing `'text'`, `'video'`, and `'audio'` track IDs intact.
- `TimelineEditor.vue` and `editor.vue` need sticky toolbar/ruler headers, synced vertical scrolling, and a vertical drag-resize handle so multi-track projects (> 4 rows) do not clip.
