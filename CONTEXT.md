# Domain Glossary (yonru.clip)

Welcome to the **yonru.clip** domain glossary. This document serves as the single source of truth for terminology used in the clipper editor and subtitle processing domain.

---

## Language

### Transcript Editor UI

**Flowing Document View**:
A continuous text presentation area in the editor where subtitle segments are rendered sequentially to look like a single flowing document page without bulky card boundaries.
_Avoid_: All Words tab, continuous editor text

**Hybrid Highlight**:
A visual highlighting technique during video playback where the active subtitle segment block receives a soft glassmorphic background glow, while the exact spoken word inside it glows with a karaoke-style text highlight.
_Avoid_: Active segment highlight, karaoke overlay

**Segment-by-Segment Inline Edit**:
An interaction model where clicking a segment in the Flowing Document View smoothly transforms that segment into a borderless, auto-growing text input.
_Avoid_: Inline text input, edit mode

**Karaoke-Style Word Highlight**:
A visual state where individual word spans are highlighted dynamically based on the current playback timing, creating a smooth, active reading flow.
_Avoid_: Word highlighting, text glow

**Draggable Subtitle Panel**:
A resizable sidebar panel in the editor whose width can be adjusted dynamically by dragging the left border handle.
_Avoid_: Resizable sidebar, subtitle panel drawer

**Sidebar Status Indicator**:
A unified, real-time job status tracking element placed in the global sidebar panel, rendering as a badge in expanded mode and as a status dot in collapsed mode.
_Avoid_: Status badge, footer status

**Workspace Continue Editing Card**:
A sidebar card in the Workspace accordion that displays the last-accessed clip and video, allowing the user to resume editing from any page.
_Avoid_: Continue editing button, edit resumption link

**Section Divider**:
A subtle visual boundary line used to organize functional control groups in editor panels without nesting containers.
_Avoid_: Border line, panel separator

**Thumbnail Screenshot Preview**:
The still-image preview container displayed inside the sidebar Thumbnail Editor, representing the captured video frame that will be prepended as a thumbnail.
_Avoid_: Screenshot container, preview frame

**Horizontal Shift Offset**:
A percentage value representing the horizontal pan displacement of the background image within the portrait viewport.
_Avoid_: Pan offset, horizontal scroll value

**Thumbnail Text Overlay**:
A customizable text block overlaid on the thumbnail frame, supporting configurable typography, backgrounds, strokes, and positioning.
_Avoid_: Overlay text, subtitle text overlay

**Default Thumbnail Style**:
A reusable template defining layout and styling rules applied automatically to new thumbnail overlays.
_Avoid_: Preset thumbnail style, default text styling

**Library Duplicate Intercept**:
A client-side warning dialog that triggers when a user submits a video source that already exists in the library.
_Avoid_: Duplicate URL warning, check dialog

**Cinematic Preview Modal**:
A fullscreen modal overlay that provides a dual-pane interface (video preview player and hook details sidebar) for reviewing hooks before entering the subtitle editor.
_Avoid_: Ingestion preview player, hook previewer

**Ready Badge**:
A visual checkmark indicator displayed next to a hook in the sidebar to signify that its corresponding video clip has been successfully cut and transcribed on the server.
_Avoid_: Processed badge, ready checkmark

**Start Safety Buffer**:
A fixed time padding subtracted from the AI-generated hook start time to prevent cut-off spoken words during preview playback and clip extraction.
_Avoid_: Padding buffer, start time buffer

**Hook Timing Adjustment**:
A control panel within the Cinematic Preview Modal sidebar that allows the user to fine-tune the start and end times of a specific hook.
_Avoid_: Timeline slider panel, hook cropper

**Timeline History Stack**:
An in-memory, transient double-stack (undo/redo) that stores deep-cloned snapshots of the timeline tracks, full transcripts, and selected item IDs.
_Avoid_: Undo redo history, transaction logs

**Manual State Snapshot**:
A snapshot of the timeline tracks and transcription state committed to the history stack at discrete interaction boundaries.
_Avoid_: History snapshot, save point

**Unified Analyzer Panel**:
A unified control card on the index page that groups the YouTube URL search input, prompt template dropdown, current transcription settings metadata, and settings page shortcut.
_Avoid_: Analyzer card, dashboard search

**Transcription Model Tooltip Card**:
A hover-activated card overlay displaying the name, speed, accuracy, and detailed description of the currently selected Whisper transcriber model size.
_Avoid_: Model details card, hover information

**Ambient Aura Glows**:
Soft, high-blur radial gradient light backdrops positioned behind workspace layouts to provide visual depth.
_Avoid_: Blur backgrounds, radial accents

**Player Bridge**:
An abstract interface that decouples player controller logic from physical message-passing protocols.
_Avoid_: Player controller adapter, video player bridge

**Iframe PostMessage Bridge**:
A concrete adapter implementation of the Player Bridge that targets the Remotion preview iframe via window messages.
_Avoid_: Remotion iframe bridge, message adapter

**Mock Player Bridge**:
A concrete mock adapter implementation of the Player Bridge that stores calls and simulates events in memory for testing.
_Avoid_: Test player bridge, fake bridge

**Pending Search Spinner**:
A visual loading indicator integrated directly inside the library search input box to indicate keypress debouncing.
_Avoid_: Debounce spinner, input loader

**Infinite Scroll Sentinel**:
A scroll-based lazy loading trigger zone positioned at the bottom of the Cached Library list that dynamically detects viewport intersection to fetch and append the next page of videos.
_Avoid_: Scroll lazy loader, scroll detector

**Cinematic Progress Bar**:
A visual loading progress bar used in the processing overlay that sweeps smoothly from 0% to 100%.
_Avoid_: Ingestion progress bar, loading slider

**Top Route Progress Bar**:
A visual progress bar rendered at the top of the viewport during route transitions to signify active page loading.
_Avoid_: Page load indicator, top route loader

**Social Safe Zone Overlay**:
An interactive overlay layer positioned above the video preview canvas displaying platform-specific UI button placements (TikTok, Instagram Reels, YouTube Shorts) to ensure overlay text content remains unobstructed.
_Avoid_: Social media safe zone, safe area template

### Ingestion & Services

**Font Synchronizer**:
A coordinator responsible for validating, fetching, and offline-synchronizing web fonts.
_Avoid_: Google Fonts sync, font sync module

**Shared Font Manifest**:
A configuration file that catalogs active fonts, subsets, and IDs, used to ensure absolute configuration alignment across the system.
_Avoid_: Font list JSON, global font config

**Speech Transcriber**:
A domain adapter wrapping the AI engine to perform high-fidelity audio transcription.
_Avoid_: Whisper engine wrapper, transcriber service

**System Health Diagnostics**:
Status indicators representing the availability of external system binaries required for media operations.
_Avoid_: Dependency checker, diagnostic logs

**Fallback API Key Manager**:
A coordinator that rotates between multiple AI API keys to bypass rate limits or connection errors.
_Avoid_: Gemini key rotator, key fallback manager

**Key Degradation Cache**:
A temporary record of exhausted or failed API keys and their cool-down periods to avoid retrying them prematurely.
_Avoid_: Bad key cache, rotator state

**Prompt Template**:
A customizable set of AI guidelines and instructions used by the analyzer to extract segments from a transcript.
_Avoid_: AI instructions template, analyzer prompt

**Inline Variable Highlight**:
A visual presentation style inside the prompt template editor where template variables are dynamically highlighted.
_Avoid_: Variable tag highlight, inline highlight block

---

## Flagged Ambiguities

**Hook vs. Ready Clip (or Clip)**:
A **Hook** is a recommendation schema (timestamps, title, theme, and quote) generated by the AI analyzer. A **Ready Clip** (often referred to simply as a **Clip**) is the physical asset cut from the source video and initialized as an editable workspace project containing timeline tracks and editable transcripts.

**Subtitle Segment vs. Word Span**:
A **Subtitle Segment** represents the complete block of subtitle text rendered at once on screen. A **Word Span** represents an individual word within that segment, possessing its own timestamp for karaoke-style highlight synchronizations.

---

## Example Dialogue

**Developer**: "I am working on the video cuts. When a user clicks 'Load Existing', do we pull the Clip or the Hook?"
**Domain Expert**: "We pull the **Hook** first to show it in the **Cinematic Preview Modal**. If they save it, we generate a **Ready Clip**. The editor then loads that Clip and displays its **Subtitle Segments** in the **Flowing Document View**."
**Developer**: "Understood. And when the user is correcting text, are they editing Subtitle Segments or Word Spans?"
**Domain Expert**: "They do **Segment-by-Segment Inline Edits**. But the video player synchronizes playback with individual **Word Spans** for the **Karaoke-Style Word Highlight**."
