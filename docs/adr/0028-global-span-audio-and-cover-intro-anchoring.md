# 0028. Global Span Audio Track and Cover Intro Anchoring

Date: 2026-11-06

## Status

Accepted

## Context

In Yonru Clip, the Studio Editor timeline previously rendered a `Cover Slide Intro Zone` (hatched zone) across all non-video tracks (Subtitles, Text layers, and Audio layers). Track item positions (`item.start`) were calculated relative to the start of the source video clip, and `TimelineEditor.vue` visually shifted track blocks by `+ thumbOffsetPx` (`activeCoverDuration * pxPerSec`).

While this model correctly represents video-bound assets (dialogue subtitles and in-video text overlays), it created three critical UX and audio playback constraints for creator workflows:
1. **Blocked Intro Audio**: Creators were unable to place custom intro sound effects, whooshes, or opening background music starting at `0.0s` during the Cover Slide.
2. **Audio Delay in Headless Render and Preview**: In Remotion (`Composition.tsx`), `timelineAudioItems` were nested inside `<Sequence from={thumbnailFrames} name="MainVideo">`. This caused any timeline audio with `start: 0` to begin playing only after the Cover Slide finished, rather than at the start of video playback.
3. **Rigid Coordinate Shifting**: If audio items were shifted along with the Cover Slide, modifying or disabling the Cover Slide would unexpectedly alter audio synchronization.

## Decision

1. **Remove Hatched Intro Zone Exclusively on Audio Track**: In `TimelineEditor.vue`, render the hatched intro zone on `text` and `subtitle` tracks, but leave `audio` completely open from `0px` (`0.0s` global timeline start).
2. **Global Span Audio Track Semantics**: The `Audio layers` track operates across the full global timeline (`0.0s .. timelineDuration`). For audio items, `item.start` represents absolute timeline ruler seconds. `getItemLeft` renders audio items starting at `item.start * pxPerSec` without adding `thumbOffsetPx`.
3. **Auto-Anchor Intro Insertion**: When a creator adds an audio file with the Playhead parked inside the Cover Slide window (`currentTime < coverDuration`), automatically set `item.start = 0.0`. If the Playhead is positioned within the main video (`currentTime >= coverDuration`), position `item.start = currentTime`.
4. **Tolerance-Based Timeline Magnetic Snapping**: In `calculateSnapTime`, introduce magnetic snap targets for audio manipulation at `0.0s`, `coverDuration` (Cover Slide transition boundary), and `currentTime` within a 5px tolerance threshold, while preserving fluid, unconstrained movement outside the tolerance window.
5. **Floating Properties Inspector Minimum Bound**: In `TimelinePropertiesInspector.vue`, permit the `Start` input to reach minimum `0.0s` for audio items (`:min="isAudioItem ? 0 : coverOffsetSec"`).
6. **Remotion Engine Parity**: In `Composition.tsx`, hoist `timelineAudioItems` outside `<Sequence from={thumbnailFrames} name="MainVideo">` to the root composition `<AbsoluteFill>`, enabling audio items positioned at `0.0s` to execute from frame 0 during both editor preview and headless MP4 rendering.

## Consequences

### Positive
- Creators can seamlessly add custom audio intros, music, and sound effects starting right at the first frame of the Cover Slide.
- Audio items can smoothly cross the boundary from the Cover Slide into main video speech.
- Absolute time anchoring ensures that toggling or altering Cover Slide duration does not inadvertently shift or corrupt audio timing.
- Text layers and subtitles remain protected from premature rendering during the Cover Slide.

### Negative / Trade-offs
- The Audio track uses global ruler coordinates (`0.0s` based), whereas Video, Text, and Subtitle tracks use video-relative coordinates shifted by `thumbOffsetPx`. This coordinate distinction is encapsulated within `timelineHelpers.ts` to keep component logic clean.
