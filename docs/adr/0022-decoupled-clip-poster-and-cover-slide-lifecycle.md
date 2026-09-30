# 0022. Decoupled Clip Thumbnail & Cover Slide Lifecycle

Date: 2026-09-29

## Status

Accepted

## Context

In Yonru Clip, video clips previously coupled the library card preview and the editor's intro title card customization to a single file (`thumbnail.jpg`) and configuration (`thumbnail_config.json`) inside each clip directory. This created several architectural and UX issues:

1. **Card Preview Pollution**: The static frame representing the clip in the Library grid, HomeSidebar, and workspace card (`LastAccessedClip`) was the exact same file modified when a creator edited the intro title card in the Studio Editor. Adjusting frames or editing overlays in the editor risked conflicting with or corrupting library card aesthetics.
2. **Ambiguous Domain Semantics**: The term "Thumbnail" was overloaded to describe two distinct concepts: a clean, static image representing the video asset on cards, and a customizable title-card slide (with text overlays and intro duration) designed by creators in the editor.
3. **Capture Ambiguity**: Capturing a new frame in the editor automatically overwrote the library card frame, mutating the clip's appearance across the entire application without explicit creator intent to change the library card.

## Decision

1. **Domain Model Separation ([CONTEXT.md](../../CONTEXT.md))**:
   - **Clip Thumbnail**: A clean, static video frame extracted at `00:00:00` representing the media asset in library grids, workspace cards, and navigation sidebars without editorial graphic overlays. Avoid: *cover slide*, *editor thumbnail*, *card image*.
   - **Cover Slide**: The creator-customized title card sequence designed in the Studio Editor featuring a chosen video frame, typography, and text overlays, rendered as an initial intro slide before video playback in exported media. Avoid: *clip thumbnail*, *video poster*, *card image*, *intro card*.

2. **Physical Storage & Asset Isolation**:
   - `thumbnail.jpg`: Dedicated strictly to the **Clip Thumbnail** (card / sidebar / library representation). It is created automatically during clip cutting/extraction and remains immutable during Studio Editor operations.
   - `cover.jpg` + `cover_config.json`: Dedicated strictly to the creator-customized **Cover Slide** managed inside `CoverEditor.vue` and `useClipperCover.ts`.

3. **Explicit Manual Capture for Cover Slide**:
   - For newly created clips, the Cover Slide starts in an uncaptured state. The creator must explicitly choose a timestamp and trigger "Capture Frame" to generate `cover.jpg`.
   - Deleting the cover slide in the editor deletes `cover.jpg` and resets `cover_config.json`, strictly preserving `thumbnail.jpg`.

4. **Guaranteed Backward Compatibility & Safe Migration**:
   - **Config Migration**: The backend reads `cover_config.json` first, falling back to legacy `thumbnail_config.json` if present.
   - **Asset Healing**: If an existing clip has an active legacy cover configuration but lacks `cover.jpg`, the system auto-migrates or copies `thumbnail.jpg` to `cover.jpg` without mutating the original `thumbnail.jpg`.
   - **API Aliases**: Route endpoints `/api/thumbnail/*` are preserved as backward-compatible aliases to `/api/cover/*`.

5. **Library & Workspace Card Uniformity**:
   - The Library grid, HomeSidebar, and `LastAccessedClip` cards strictly render the clean **Clip Thumbnail** (`thumbnail.jpg` / `thumbnail_url`), ensuring a consistent and uncluttered UI that aligns perfectly with creator expectations.

## Consequences

### Positive
- Perfect alignment with creator mental models and modern platforms (CapCut, TikTok, YouTube): cards display the **Thumbnail**, and the editor designs the **Cover Slide**.
- Consistent domain language across `CachedVideo` (thumbnail), `Hook` (thumbnail), and `ReadyClip` (thumbnail).
- Eliminates side effects where editor actions alter library card previews.
- Full backward compatibility for existing user clip configurations and assets.

### Negative / Trade-offs
- The application maintains a backward-compatible mapping between legacy `thumbnail_config.json` and new `cover_config.json`.
