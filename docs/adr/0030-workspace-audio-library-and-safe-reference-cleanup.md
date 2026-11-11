# 0030. Workspace Audio Library and Safe Reference Cleanup

Date: 2026-11-11

## Status

Accepted

## Context

Previously in Yonru Clip, clicking the `AUDIO` button in the Studio Editor timeline toolbar opened the operating system file picker and read the selected audio file via `FileReader.readAsDataURL()`, embedding a base64 `data:audio/...` string directly inside the active clip's timeline item state.

This approach created three major workflow and architectural limitations:
1. **Repetitive Manual Uploads**: Creators who reuse standard sound effects (whooshes, pops, transitions) or background music across multiple clips had to repeatedly locate and upload the same files from disk for every clip.
2. **Base64 Payload Bloat**: Full-length background music tracks encoded as base64 inflated clip session JSON manifests (`ClipSessionStore`) and render job payloads (`props_*.json`), making client-side storage (`localStorage`, used for short 1-second bleep tones in ADR 0007) unsuitable for multi-megabyte timeline audio tracks.
3. **Cross-Clip Deletion Risk**: If audio assets are shared across clips in a global workspace library, naively deleting a file from disk when a creator tidies up their library list would break previously edited Ready Clips (`404 Not Found`) during subsequent playback or Remotion MP4 rendering.

## Decision

1. **Global Disk-Backed Audio Library (`AudioLibraryRepository`)**:
   - Store uploaded timeline audio files in a workspace-wide directory (`temp_assets/audio_library/`) tracked by a catalog (`audio_library.json`) and served via `/assets/audio_library/<filename>`.
   - Detect duplicate uploads by filename or SHA-256 content hash, surfacing a confirmation dialog in the UI that lets the creator either **Replace** the existing library file or **Use Existing** without duplicating files on disk.
2. **Safe Reference Cleanup on Deletion**:
   - When a creator deletes an item from the Audio Library, immediately remove the entry from `audio_library.json` so the UI catalog stays clean.
   - Before deleting the physical audio file from `temp_assets/audio_library/`, inspect saved clip manifests via `ClipSessionStore` (and optional active references). Physically delete the file on disk only when no clip session references that audio asset.
3. **Staged Remotion Asset Resolution (`StagedRenderContext`)**:
   - During headless MP4 rendering in `render_engine.py`, resolve any timeline audio item referencing `/assets/audio_library/<filename>` to its local file in `temp_assets/audio_library/` and stage a temporary copy into `shared/remotion/public/` (rewriting `item.src` to the staged filename for `staticFile()` resolution in `Composition.tsx`), ensuring zero network or port dependencies during CLI rendering.
4. **Anchored Audio Library Popover & Duration Clamping**:
   - Replace direct file-picker invocation on the `AUDIO` toolbar button with a contextual floating popover (`AudioLibraryPopover.vue`) rendered via `<Teleport to="body">` directly above the `AUDIO` button and expanding to the right.
   - Provide inline audio preview playback, search filtering, one-click timeline insertion at the Playhead (auto-clamping initial layer duration to remaining clip duration), and `+ Upload Audio` (which both persists to the library and auto-inserts onto the timeline).

## Consequences

### Positive
- Creators can build a persistent workspace collection of sound effects and background music accessible in one click across all Ready Clips.
- Clip manifests store lightweight `/assets/audio_library/<filename>` URLs instead of multi-megabyte base64 strings, while remaining backward-compatible with legacy `data:audio/...` items.
- Deleting an item from the Audio Library never corrupts or breaks older clips that still use that audio on their timelines.
- Staged rendering guarantees deterministic audio inclusion in headless Remotion exports.

### Negative / Trade-offs
- Orphaned audio files that are deleted from the Audio Library while still referenced by an old clip remain on disk in `temp_assets/audio_library/` until that clip is deleted or no longer references the file.
