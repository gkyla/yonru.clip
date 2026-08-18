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

**Floating Subtitle Panel**:
A floating overlay panel in the editor that slides in from the far-right boundary over the Hooks Panel, providing dedicated edit controls for Subtitles, Thumbnail, and Raw Quote modes.
_Avoid_: Subtitle drawer, edit modal, right sidebar overlay

**Settings Segmented Navigation**:
A top-level tabbed control bar inside the Draggable Subtitle Panel that categorizes subtitle and video customization controls into discrete tabs (Style & Presets, Typography & Color, Layout & Export) to optimize vertical space.
_Avoid_: Editor tab bar, settings pagination, sub-header tabs

**Settings Two-Column Navigation**:
A responsive two-column layout on the global settings page featuring a sticky category sidebar on the left and a focused content panel on the right, synchronized with URL query parameters and system health status indicators.
_Avoid_: Settings tabs, stacked settings list, settings accordion

**Elastic Spring Pop**:
A dynamic entry animation for subtitle chunks where text expands smoothly from a scaled-down state with a calibrated spring overshoot before settling, creating an energetic caption pop without disorienting vertical drops.
_Avoid_: Hard bounce, rigid drop animation

**Word Wave Reveal**:
A fluid subtitle entry animation where words or characters emerge sequentially via smooth opacity easing and subtle motion sweep, replacing character-by-character typewriter steps with modern short-form motion.
_Avoid_: Old typewriter effect, character-by-character cursor chop

**Capsule Marker Underline**:
A floating, rounded pill accent underline rendered beneath the active highlighted word with smooth border radiuses and calibrated vertical offsets to avoid colliding with text descenders.
_Avoid_: Harsh table border line, rigid square underline

**Curated Gradient Backdrop**:
A configurable subtitle background styling mode offering preset visual gradients (Cinematic Dark, Ambient Aura Glow, Two-Tone Duo) with variable opacity and spread to maximize subtitle legibility and aesthetic depth.
_Avoid_: Static dark gradient box, hardcoded linear gradient

**Editor Workspace Action Rail**:
A narrow vertical icon rail positioned adjacent to the VideoPreview pane that provides single-click access and hover tooltips for toggling editor panel views.
_Avoid_: Editor tab bar, right button column

**Sidebar Status Indicator**:
A unified, real-time job status tracking element placed in the global sidebar panel, rendering as a badge in expanded mode and as a status dot in collapsed mode.
_Avoid_: Status badge, footer status

**Dynamic Saved Hook Header Action**:
A contextual action button in the Hooks Panel header row that dynamically toggles between "Save Current" (amber bookmark icon) when the active hook is unsaved, and "Remove Saved" (rose-red trash icon) when the active hook is saved, allowing single-click save and unsave management.
_Avoid_: Delete hook button, header bookmark toggle

**Workspace Continue Editing Card**:
A sidebar card in the Workspace accordion that displays the last-accessed clip and video, allowing the user to resume editing from any page.
_Avoid_: Continue editing button, edit resumption link

**Section Divider**:
A subtle visual boundary line used to organize functional control groups in editor panels without nesting containers.
_Avoid_: Border line, panel separator

**Thumbnail Screenshot Preview**:
The still-image preview container displayed inside the sidebar Thumbnail Editor, representing the captured video frame that will be prepended as a thumbnail.
_Avoid_: Screenshot container, preview frame

**Content Safety Audit Panel**:
An accordion-style sidebar panel displaying automatic profanity scan scores, flagged shadowban keywords, and deep AI-driven safety diagnostics with auto-fix trigger actions.
_Avoid_: Safety audit box, profanity scanner container

**Safety Score Tiers**:
Four discrete eligibility brackets (Excellent >= 90, Good >= 70, Caution >= 40, High Risk < 40) calculated by the Content Safety Audit Panel to evaluate shadowban keyword risk, safe zone visual collisions, and subtitle legibility before export.
_Avoid_: Audit score levels, safety ratings


**Granular Word-Level Audio Censorship**:
A mechanism in the Content Safety Audit Panel where audio bleeping/muting and timeline flagged markers strictly target the exact timestamp bounds of individual sensitive words, decoupling audio censorship timing from visual subtitle chunking modes.
_Avoid_: Chunk-level muting, full subtitle line bleeping

**Bleep Padding Offset**:
A configurable time buffer in milliseconds (defaulting to 50ms) added before and after a flagged sensitive word timestamp to prevent spoken phoneme leakage during audio censorship.
_Avoid_: Audio padding, bleep margin

**Comprehensive Audio Censorship Coverage**:
A policy in the Content Safety Audit Panel ensuring that when audio bleeping is enabled, all flagged words across active categories are targeted for muting/bleeping, regardless of subtitle sensitivity presets.
_Avoid_: Selective bleeping, partial category muting

**Safe Zone Alignment Check**:
An automated diagnostic rule within the Content Safety Audit Panel that scans subtitle positions against active platform safe zones (TikTok, Reels, Shorts) and flags layouts that overlap with platform UI controls or bottom description fields.
_Avoid_: Subtitle overlay scan, boundary collision check

**Subtitle Readability Audit**:
An automated accessibility check within the Content Safety Audit Panel that verifies if subtitle text styles have sufficient visual contrast (via border strokes or background boxes) to remain legible over bright video frames.
_Avoid_: Contrast scan, subtitle legibility test

**Timeline Linear Motion & Auto-Pause**:
A video playback rule ensuring videoTime maps continuously and linearly from item mediaStart timestamps across timeline coordinates without static freezing, automatically pausing video playback and clamping playhead position when currentTime reaches timelineDuration.
_Avoid_: Static timestamp clamping, end-of-clip overrun

**Single Master Player Mode**:
A video playback architecture rule ensuring that only one active media player (either the Remotion iframe or the native video element) controls playback and emits timeupdate events at any time, keeping the inactive player strictly paused to eliminate dual-player feedback loops.
_Avoid_: Background video playback, dual-player sync drift

**Mute State Deduplication & Iframe Props Isolation**:
A reactive optimization in player bridge watchers that deduplicates mute state transitions and isolates currentTime from iframe props updates, preventing 60Hz React re-rendering loops and word replay bugs during video playback.
_Avoid_: High-frequency props updates, 60Hz iframe re-renders

**Partial Word End Audio Censorship**:
A mechanism in the Content Safety Audit Panel where audio muting/bleeping targets only the ending 50% syllable duration of sensitive words, leaving the initial syllable audible so viewers retain spoken context.
_Avoid_: Half muting, partial word bleeping

**Bleep Audio Preset Library**:
A configurable collection of bleep audio assets within the Content Safety Audit Panel comprising static system default tones (e.g. 1000Hz beep) and user-uploaded custom audio files, allowing creators to select and manage their active audio censorship sound.
_Avoid_: Bleep sound list, custom bleep array

**Video Layout Mode**:
A setting in the Layout & Export tab controlling how the video source is framed within the 1080x1920 portrait canvas, offering `vertical` (full-height 9:16 crop using horizontal pan offset) and `landscape` (centered letterboxed video with top and bottom blank zones for text overlays).
_Avoid_: Video aspect ratio, crop mode switch, orientation toggle

**Letterbox Blank Zone**:
The un-covered black area above (Top Blank Zone) and below (Bottom Blank Zone) a centered 16:9 video when Video Layout Mode is set to `landscape` on a 1080x1920 portrait canvas.
_Avoid_: Black bars, letterbox margin

**Blank Zone Alignment Snap**:
A quick action control in the timeline text item inspector that calculates and snaps the vertical ($Y$) position of a text overlay to the center of either the Top Blank Zone or Bottom Blank Zone.
_Avoid_: Auto header snap, bar alignment toggle

**Horizontal Shift Offset**:
A percentage value representing the horizontal pan displacement of the background image within the portrait viewport.
_Avoid_: Pan offset, horizontal scroll value

**Thumbnail Text Overlay**:
A customizable text block overlaid on the thumbnail frame, supporting configurable typography, backgrounds, strokes, and positioning.
_Avoid_: Overlay text, subtitle text overlay

**Default Thumbnail Style**:
A reusable template defining layout and styling rules applied automatically to new thumbnail overlays.
_Avoid_: Preset thumbnail style, default text styling

**Thumbnail Composition Coordinator**:
A domain coordinator that manages thumbnail overlay creation, typography and stroke style inheritance cascades, collision-free layout positioning, and thumbnail duration time-shift calculations.
_Avoid_: Thumbnail helper, overlay manager, thumbnail builder

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
A unified control card on the index page that groups the YouTube URL search input, hook extraction mode controls, current transcription settings metadata, and settings page shortcut.
_Avoid_: Analyzer card, dashboard search

**Hook Extraction Mode**:
An operational mode selector in the Unified Analyzer Panel allowing creators to toggle between curated Smart Presets and user-defined Custom Prompt templates.
_Avoid_: Prompt mode switch, hook generator setting

**Hook Intent Preset**:
A pre-calibrated content style archetype (such as Auto Viral, Humor, Education & Debunk, or Storytelling) that configures hook detection criteria without exposing raw prompt engineering.
_Avoid_: AI Prompt category, Prompt tag

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

**Video Playback Coordinator**:
A domain coordinator responsible for managing dual-player synchronization, single master player mode enforcement (ADR-0004), mute state deduplication (ADR-0005), audio bleep triggers, and Remotion props generation.
_Avoid_: Playback manager, video controller, player sync helper

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
An interactive overlay layer positioned above the video preview canvas and projected onto the Thumbnail Screenshot Preview, displaying platform-specific UI button placements (TikTok, Instagram Reels, YouTube Shorts) to ensure text and visual contents remain unobstructed.
_Avoid_: Social media safe zone, safe area template

**Nested Border Radius Formula**:
A visual design rule for nested UI containers where the inner element's border radius ($R_{\text{inner}}$) is calculated using $R_{\text{inner}} = \max(0, R_{\text{outer}} - p)$, where $R_{\text{outer}}$ is the outer container radius and $p$ is the inner padding, ensuring smooth concentric corners without visual gaps or clashing curves.
_Avoid_: Arbitrary inner border radius, mismatched corner curvature

**Hero Headline Typewriter**:
An interactive, high-visibility text element within the home hero header that dynamically cycles through short-form video content phrases using smooth typewriter character pacing and a glowing Radioactive Green cursor.
_Avoid_: Static technical header, rapid text ticker



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
A user-defined custom content archetype directive providing specific thematic criteria, tone guidelines, and key phrase triggers, which is dynamically composed with core system guardrails inside the Modular Composite Prompt Builder.
_Avoid_: Raw prompt override, full prompt script, AI instructions template

**Natural AI Hook Detection**:
An extraction policy where the AI engine identifies all naturally compelling hooks based on content density and virality standards without enforcing an artificial fixed count quota (`auto_hooks = true`).
_Avoid_: Fixed hook quota, manual hook count, forced clip count

**Modular Composite Prompt Builder**:
A service in the ingestion domain that dynamically assembles core extraction guardrails, intent archetypes (or custom prompt templates), and optional topic focus filters into a cohesive AI prompt.
_Avoid_: Prompt stitcher, prompt concatenator, prompt builder script

**Thought Completion Verification**:
A four-step analytical rule in the prompt engine (lookahead scan, unfinished thought signal detection, caveat check, and hard stop confirmation) ensuring extracted hooks never cut off sentences mid-thought or omit critical caveats.
_Avoid_: End boundary check, sentence continuity detector

**Virality Score**:
A normalized integer score (0–100) generated by the AI engine evaluating the opening hook curiosity, emotional delivery, and retention potential of an extracted hook.
_Avoid_: Viral rating, hook points, clip score

**Virality Explanation**:
A concise English summary generated alongside each hook explaining the specific structural and psychological reasons for its virality potential.
_Avoid_: Virality reason, hook description

**Inline Variable Highlight**:
A visual presentation style inside the prompt template editor where template variables are dynamically highlighted.
_Avoid_: Variable tag highlight, inline highlight block

**Unsaved Prompt Guard**:
A client-side navigation and interaction interceptor in the Prompt Template editor that detects unsaved form changes (dirty state) and presents an exit confirmation dialog (Save & Continue, Discard Changes, or dismiss) before executing template switching, page navigation, or window unloading.
_Avoid_: Unsaved changes alert, dirty prompt popup, navigation blocker

**Prompt Draft Revert**:
An explicit in-editor action that restores all modified prompt template fields (name, tags, content) back to their baseline saved state without closing or unselecting the active template, guarded by a dedicated binary confirmation dialog.
_Avoid_: Cancel edit, prompt undo all, form reset

**Route Page Transition**:
A lightweight, high-performance client-side page transition across application routes featuring a fast 120ms ease-out pure opacity fade without positional shift ($Y = 0$), synchronized with the top route loading bar.
_Avoid_: Route animation, page slide effect, route fade slide

**First-Visit Route Progress Bar**:
A top-level loading indicator policy where `<NuxtLoadingIndicator>` only activates on the first time a unique route path is visited during a user session, suppressing subsequent loading bars for already-visited routes to provide instantaneous, clutter-free tab switching.
_Avoid_: Constant route loading bar, global progress bar on every click

**Auto-Reframe Crop Map**:
A pre-computed time-series keyframe sequence mapping video timestamps to horizontal pan positions ($X$), generated during clip ingestion via face tracking detection to provide instant WYSIWYG camera tracking in the editor and export engine.
_Avoid_: Pan keyframes, tracking coords, face position array

**Canvas Auto-Reframe Override**:
A direct-manipulation gesture in the Video Preview canvas where dragging the video frame during active Face Tracking mode automatically switches Crop Mode to Manual Pan at the dragged horizontal position.
_Avoid_: Drag override, manual pan switch gesture

**Triple-B Stability Strategy**:
The camera stabilization policy used during face tracking comprising Backfill (applying first detected face position to clip start), Persistence (freezing camera position during tracking loss or scene transitions), and Verification (requiring multi-frame confirmation before snapping to a new speaker).
_Avoid_: Face smoothing, camera lock policy

**Ingestion Job Coordinator**:
A domain coordinator responsible for managing video analysis dispatching, periodic polling timers, 404 session self-healing, and parallel asset bundle hydration.
_Avoid_: Polling manager, job fetcher, download scheduler

**Hydrated Clip Bundle**:
A consolidated data transfer object containing all synchronized asset payloads (transcript segments, style settings, auto-reframe crop map, timeline tracks, thumbnail configuration, and history stacks) required to initialize an editable workspace clip.
_Avoid_: Clip data object, clip files payload

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
