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

---

## Asset Synchronization & Bootstrapping

### Font Synchronizer
A backend deep module responsible for validating, fetching, and offline-synchronizing Google Web Fonts. It dynamically resolves missing local woff2 files and automatically compiles stylesheets tailored to both the main Transcription Editor and the Remotion Engine.

### Shared Font Manifest
A single source of truth configuration file (`shared/fonts_manifest.json`) that catalogs active fonts, their subsets, and IDs, ingested directly by both the python backend Font Synchronizer and the Nuxt frontend state composables to ensure absolute configuration alignment across boundaries.

