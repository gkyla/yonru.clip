# 0022. Decoupled Clip Poster & Cover Slide Lifecycle

Date: 2026-09-29

## Status

Accepted

## Context

In Yonru Clip, video clips previously coupled the library card preview and the editor's thumbnail customization to a single file (`thumbnail.jpg`) and single configuration (`thumbnail_config.json`) inside each clip directory. This created several architectural and UX issues:

1. **Card Preview Pollution**: The static frame representing the clip in the Library grid, HomeSidebar, and workspace card (`LastAccessedClip`) was the exact same file modified when a creator used the "Thumbnail Editor" in the Studio Editor. Adjusting frames or editing overlays in the editor risked conflicting with or corrupting library card aesthetics.
2. **Ambiguous Domain Semantics**: The term "Thumbnail" was overloaded to describe two distinct concepts: a clean, static poster representing the video asset on cards, and a customizable title-card slide (with text overlays and intro duration) rendered before the video in exported MP4s.
3. **Capture Ambiguity**: Capturing a new frame in the editor automatically overwrote `thumbnail.jpg`, mutating the clip's appearance across the entire application without explicit creator intent to change the library card.

## Decision

1. **Domain Model Separation ([CONTEXT.md](../../CONTEXT.md))**:
   - **Clip Poster**: A clean, static video frame extracted at `00:00:00` representing the media asset in library grids, workspace cards, and navigation sidebars without editorial graphic overlays. Avoid: *clip thumbnail*, *editor thumbnail*, *card image*.
   - **Cover Slide**: A customizable title card sequence designed in the Studio Editor featuring a chosen video frame, typography, and text overlays, rendered as an initial intro slide before video playback in exported MP4s. Avoid: *thumbnail*, *cover thumbnail*, *thumbnail intro*.

2. **Physical Storage & Asset Isolation**:
   - `thumbnail.jpg`: Dedicated strictly to the **Clip Poster**. It is created automatically during clip cutting/extraction and remains immutable during Studio Editor operations.
   - `cover.jpg`: Dedicated strictly to the **Cover Slide** background frame, paired with `cover_config.json`.

3. **Explicit Manual Capture for Cover Slide**:
   - For newly created clips, the Cover Slide starts in an uncaptured state. The creator must explicitly choose a timestamp and trigger "Capture Frame" to generate `cover.jpg`.
   - Capturing in the Cover Slide editor strictly writes to `cover.jpg` and never touches `thumbnail.jpg`.

4. **Guaranteed Backward Compatibility & Safe Migration**:
   - **Config Fallback**: The backend and frontend read `cover_config.json` first; if absent, they seamlessly read `thumbnail_config.json`. Existing text overlays, styling, and duration settings are 100% preserved.
   - **Legacy Frame Migration**: For existing clips where `thumbnail_config.json` is enabled but `cover.jpg` does not yet exist, the system automatically copies `thumbnail.jpg` to `cover.jpg` on first access.

5. **Library & Workspace Card Uniformity**:
   - The Library grid, HomeSidebar, and `LastAccessedClip` cards strictly render the clean **Clip Poster** (`thumbnail.jpg`), ensuring a consistent and uncluttered UI that does not clash with card title typography.

## Consequences

### Positive
- Strict separation of concerns between media asset cataloging and video intro composition.
- Eliminates side effects where editor actions alter library card previews.
- Full backward compatibility for existing user clip configurations and assets.

### Negative / Trade-offs
- The application maintains a migration and fallback read path from legacy `thumbnail_config.json` to `cover_config.json`.
