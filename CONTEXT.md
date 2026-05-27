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
