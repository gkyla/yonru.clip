# Domain Glossary (yonru.clip)

Welcome to the **yonru.clip** domain glossary. This document serves as the single source of truth for terminology used in the clipper editor and subtitle processing domain.

---

## Transcript Editor

### Flowing Document View
A continuous text presentation area in the editor ("All Words" tab) where subtitle segments are rendered sequentially to look like a single flowing document page without bulky card boundaries.

### Hybrid Highlight
A visual highlighting technique during video playback where the active subtitle segment block receives a soft glassmorphic background glow, while the exact spoken word inside it glows with a karaoke-style text highlight.

### Segment-by-Segment Inline Edit
An interaction model where clicking a segment in the Flowing Document View smoothly transforms that segment into a borderless, auto-growing text input. Changes are committed automatically on blur or `Enter`, and reverted on `Escape`.

### Karaoke-Style Word Highlight
A visual state where individual word spans are highlighted dynamically based on the current playback timing, creating a smooth, active reading flow.

### Draggable Subtitle Panel
A resizable sidebar panel in the editor whose width can be adjusted dynamically by dragging the left border handle, with boundaries restricted between 320px and 650px and the selected width persisted in browser `localStorage`.

### Sidebar Status Indicator
A unified, real-time job status tracking element placed in the footer of the global sidebar panel, rendering as a clean, bordered micro-badge row in expanded mode and as a dynamic, glowing status dot overlaid on the database icon in collapsed mode.

### Section Divider
A low-contrast, border-only horizontal seam (`border-t border-surface-border/30 pt-3`) used inside editor panels to separate functional control groups cleanly without nesting bulky card backgrounds or rounded containers, keeping visual density balanced.

### Thumbnail Screenshot Preview
The aspect-[9/16] still-image preview container displayed inside the sidebar Thumbnail Editor, representing the captured video frame that will be prepended as a thumbnail.

### Horizontal Shift Offset
A percentage value (0 to 100) representing the horizontal pan displacement of the background image within the 9:16 portrait viewport.

### Thumbnail Text Overlay
A customizable text block overlaid on the thumbnail frame, supporting configurable typography, backgrounds, strokes, transformations, and positioning.

### Default Thumbnail Style
A reusable styling template that encapsulates typography and still frame duration, persisted inside `default_thumbnail_style.json` via backend APIs, automatically initialized on new clips, and applied to overlays when explicitly loaded.

### Library Duplicate Intercept
A client-side warning dialog that triggers when a user submits a YouTube URL that already exists in the Cached Library, offering choices to load existing hooks instantly or reanalyze hooks using Gemini without re-downloading the video.

### Cinematic Preview Modal
A fullscreen modal overlay that provides a dual-pane interface (video preview player on the left and hook details sidebar on the right) for reviewing generated or saved hooks before entering the subtitle editor.

### Start Safety Buffer
A fixed time padding (strictly 2.0 seconds) subtracted from the AI-generated hook start time to prevent cut-off spoken words during preview playback and clip extraction.

### Hook Timing Adjustment
A control panel within the Cinematic Preview Modal sidebar that allows the user to fine-tune the start and end times of a specific hook by entering timing in MM:SS format or by dragging a dual-ended timeline slider.

---

## Asset Synchronization & Bootstrapping

### Font Synchronizer
A backend deep module responsible for validating, fetching, and offline-synchronizing Google Web Fonts. It dynamically resolves missing local woff2 files and automatically compiles stylesheets tailored to both the main Transcription Editor and the Remotion Engine.

### Shared Font Manifest
A single source of truth configuration file (`shared/fonts_manifest.json`) that catalogs active fonts, their subsets, and IDs, ingested directly by both the python backend Font Synchronizer and the Nuxt frontend state composables to ensure absolute configuration alignment across boundaries.

### Speech Transcriber
A deep backend domain adapter wrapping the Whisper AI engine to perform high-fidelity audio transcription. It converts audio files into word-level timestamps and dynamically loads different model sizes (e.g. tiny, base, small, medium) on demand according to active configuration settings.

---

## API Configuration & Fallbacks

### Fallback API Key Manager
A deep backend domain service that manages multiple Gemini API keys in sequence, automatically rolling over to backup keys if a primary key hits rate limits (429) or connection issues.

### Key Degradation Cache
An in-memory cache tracking the error status and cool-down times of individual fallback keys to prevent retrying known-failed keys within their recovery window.
