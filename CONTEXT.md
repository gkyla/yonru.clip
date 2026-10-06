# Yonru Clip Domain Model

Yonru Clip is an AI-powered short video clipping and re-framing platform that detects viral moments (hooks) from long-form video content and prepares them for editing.

## Language

**Hook**:
A high-virality timestamp interval extracted from a source video, containing start and end seconds, a theme title, a virality score, and a sharp extracted static thumbnail (`thumb_{start}.jpg`).
_Avoid_: Segment, cut, highlight

**Studio Hook Card**:
The compact interactive card component within the Studio Editor Hooks Panel representing an extracted Hook candidate or Saved Hook, structured with a three-tier visual hierarchy (header status pills & duration chip, theme title & quote body, and dedicated timestamp footer).
_Avoid_: Hook item, clip button, sidebar card, list row

**Ready Clip**:
A rendered or extracted standalone video clip derived from a Hook that is available in the library and ready for multi-track editing and subtitle customization.
_Avoid_: Exported video, snippet, output file

**Clip Thumbnail**:
A clean, static video frame extracted from a Ready Clip representing the media asset in library grids, workspace cards, and navigation sidebars without editorial graphic overlays.
_Avoid_: Cover slide, card image, editor thumbnail, preview picture

**Cover Slide**:
The creator-customized title card sequence designed in the Studio Editor featuring a chosen video frame, typography, and text overlays, rendered as an initial intro slide before video playback in exported media.
_Avoid_: Clip thumbnail, video poster, card image, intro card

**Last Accessed Clip**:
The clip session that was most recently explicitly opened into the Studio Editor and tracked in the workspace for quick-resume editing via the Navigation Sidebar. Retains the Hook theme title, the parent Source Video title, and a static Clip Thumbnail image. Unopened background-generated clips or newly discovered hooks are never treated as the Last Accessed Clip until opened.
_Avoid_: Recent project, draft, active session

**Source Video / Cached Video**:
A downloaded or imported full-length source video stored locally with associated transcripts, heatmaps, and hook candidates.
_Avoid_: Raw file, base video, input asset

**Command Palette**:
A global modal overlay triggered via `⌘K` / `Ctrl+K` or the sidebar search bar providing fuzzy search, quick actions, and deep navigation across cached videos, ready clips, prompt templates, settings sections, and core views.
_Avoid_: Search modal, quick finder, spotlight bar

**Hardware Capability Profile**:
The host computer's hardware metrics (CPU cores, physical RAM, and GPU/VRAM capacity) evaluated to calculate realistic local transcription processing times and memory safety guardrails without prescriptive recommendations.
_Avoid_: System specs, PC benchmark, machine diagnostics

**Transcription Engine Preset**:
A local Whisper model tier (`tiny`, `base`, `small`, `medium`, `large-v3`) balancing processing speed, word-level timestamp accuracy, and memory allocation.
_Avoid_: Audio AI level, speech model size, whisper mode

**Transcription Duration Estimate**:
The expected speech-to-text processing time for a standard 60-second video clip calculated dynamically from host hardware acceleration metrics.
_Avoid_: Speed score, processing percentage

**Navigation Sidebar**:
The primary collapsible navigation panel on the left rail containing global views (Home, Prompts, Docs, Settings), quick video access, and hardware health indicator. Defaults to a collapsed rail (64px) for maximum workspace focus and expands on demand or via `⌘B` / `Ctrl+B`.
_Avoid_: Navbar, menu drawer, left bar

**Brand Mark**:
The signature visual mark of Yonru Clip ("The Focal Frame") consisting of two framing brackets embracing a central timeline clip capsule rendered in Brand Gold (`#ffd700`) on dark surfaces, displayed in the Navigation Sidebar header, the Editor Transition Overlay, and as the browser tab favicon.
_Avoid_: App icon, site logo, avatar, monogram, logo badge

**Timeline Viewport**:
The scrollable horizontal canvas displaying multi-track media segments (video, audio, subtitle, text) across time, enabling independent navigation and panning without mutating the current playback time.
_Avoid_: Scroll track, timeline window, seek pane

**Playhead**:
The visual marker and time-tracking line indicating the exact frame/second currently displayed in the video preview workspace.
_Avoid_: Time bar, scrub line, cursor indicator

**Pipeline Progress Stepper**:
The automated multi-stage workflow overlay tracking ingestion, transcription, AI hook generation, and preview extraction for source videos.
_Avoid_: Loading spinner, progress modal, analysis bar

**Pipeline Status Card**:
The clean media preview card within the Pipeline Progress Stepper displaying the active source video thumbnail, title, channel, duration, and preset configuration.
_Avoid_: Tech card, details box, status panel, debugger console

**Virality Rationale**:
The AI-generated contextual explanation justifying why a Hook has viral potential, highlighting narrative tension, emotional peaks, or audience hook moments.
_Avoid_: Hook reasoning, virality explanation, description, AI comment

**Face Tracking & Auto-Reframe**:
The intelligent visual tracking pipeline that dynamically crops and follows active speakers or salient subjects from horizontal 16:9 source footage into vertical 9:16 aspect ratio suitable for short-form video.
_Avoid_: Vertical crop, auto pan, smart crop, aspect reframing

**Stacked Multi-Speaker Reframe**:
The dynamic layout mode within the Face Tracking & Auto-Reframe pipeline that splits the vertical 9:16 canvas into stacked top and bottom viewports when two speakers are simultaneously visible in wide footage, framing the left speaker on top and the right speaker on bottom, and automatically reverting to single-speaker framing during solo shots.
_Avoid_: Split screen video, double crop, 2 face mode, dual vertical

**Face-Anchored Viewport Zoom**:
The scaling mechanism within Stacked Multi-Speaker Reframe that magnifies the video centered on each detected speaker's face coordinates, isolating tight single-speaker closeups and cropping out adjacent subjects in crowded or wide-angle footage.
_Avoid_: Digital zoom, scale slider, crop zoom, camera zoom

**Zoom-Relative Framing Offset**:
The dual-axis (horizontal and vertical) micro-adjustment mechanism within Face-Anchored Viewport Zoom that enables creators to fine-tune vertical framing (Up / Down) and horizontal composition (Left / Right) relative to detected faces while preserving active dynamic AI face tracking and enforcing strict edge clamping to prevent black voids.
_Avoid_: Manual pan override, static crop position, pixel nudge, split camera drag

**Auto-Adaptive Subtitle Placement**:
The dynamic positioning mechanism that automatically anchors subtitles over the center dividing seam in Stacked Multi-Speaker Reframe to prevent speaker occlusion, while returning to standard lower-third positioning in single-speaker framing, with manual override available in settings.
_Avoid_: Dynamic subtitles, floating text jump, split captions

**Subtitle Offset (Timing)**:
The millisecond adjustment applied to subtitle timestamps to synchronize caption visibility with spoken audio, defaulting to a 150ms lead time.
_Avoid_: Audio delay, subtitle delay, speech lag

**Subtitle Style Preset**:
A preconfigured collection of typography, color palette, highlight animation, stroke, and background treatments applied to subtitles for viral video pacing and visual branding.
_Avoid_: Template, subtitle theme, font style, caption design

**Subtitle Visibility Toggle**:
The clip-level presentation control that enables creators to show or hide visual subtitles in both the Studio Editor preview and final rendered media without mutating or deleting underlying transcript timing or audio censorship boundaries.
_Avoid_: Mute subtitles, hide captions, delete transcript, subtitle disable

**Subtitle Pacing**:
The word grouping density configuration (1 Word, 3 Words, or 4 Words) dictating how many words appear concurrently on-screen during playback and export.
_Avoid_: Display mode, word density, text chunks, caption flow

**Default Style Settings**:
The persisted global user preference configuring the baseline layout mode (Vertical 9:16), auto-reframing crop mode (Face Track), and subtitle typography applied to newly extracted or initialized clips.
_Avoid_: Global template, root config, editor defaults, initial layout preset

**Landscape Background Treatment**:
The visual presentation applied to the letterbox padding zones above and below horizontal footage when presented in the vertical 9:16 canvas, offering Solid Black or Blurred Video Fill with adjustable blur radius and dimming overlay.
_Avoid_: Background color, bar blur, letterbox style, pad blur.

**Platform Safe Zone Overlay**:
The realistic platform simulation layer (such as TikTok, Instagram Reels, or YouTube Shorts) rendered directly over the 1080x1920 canvas in Video Preview, reproducing native mobile UI elements (status bar, navigation header, interaction controls, creator metadata, and audio ticker) to verify visual occlusion, safe zone boundaries, and caption readability without modifying final rendered media.
_Avoid_: Deadzone box, safe zone grid, mock overlay, fake tiktok, watermarked player

**Canvas Snapping Guides**:
Transient visual alignment axes and safe zone boundary lines rendered dynamically during drag-and-drop manipulation of Timeline Text Overlays and Cover Slide text, magnetically snapping text coordinates to canvas centers and platform-safe margins to prevent UI occlusion.
_Avoid_: Static grid, magnet lines, drag ruler, alignment mesh


**Preset Studio Viewport**:
The cinematic live preview canvas within the active subtitle preset card that renders real-time typography, highlight effects, stroke, and background treatments against a dark studio backdrop simulating actual video output.
_Avoid_: Preview box, font tester, text demo

**Visual Cut Point**:
The exact timestamp or frame where a video camera angle or scene visually cuts between different shots.
_Avoid_: Scene jump, split boundary, edit splice

**Shot-Anchored Layout Snapping**:
The synchronization mechanism within Face Tracking & Auto-Reframe that locks layout switches between single-speaker and Stacked Multi-Speaker Reframe strictly to the nearest prior Visual Cut Point, eliminating transition delay and duplicate face artifacts.
_Avoid_: Cut backfill, frame snap, layout jump

**Compositor Engine**:
The hybrid video presentation architecture in Remotion Engine that routes playback rendering through a single-decoder HTML5 `<canvas>` compositor in the editor preview (preventing hardware decoder duplication and backwards scrubbing glitches), while switching to native `<OffthreadVideo>` extraction during headless MP4 rendering for frame-accurate output.
_Avoid_: Dual player mode, render switch, canvas exporter



**Word-Level Audio Censorship**:
The surgical audio alteration feature that mutes or replaces specific spoken words with bleep audio presets at millisecond precision without cutting or shifting video timeline frames.
_Avoid_: Audio bleep, profanity filter, censor cut, voice mute

**Acoustic Word Map**:
The immutable, word-level audio alignment map produced directly from speech transcription that acts as the single source of truth for audio censorship boundaries, completely decoupled from visual subtitle chunking.
_Avoid_: Subtitle words, transcript cache, word timing list

**Remediated Violation**:
A sensitive speech violation that has been neutralized through both visual subtitle masking and active Word-Level Audio Censorship, restoring the Content Safety Score to safe without removing timeline censorship boundaries.
_Avoid_: Fixed flag, ignored warning, masked audit

**Safety Filter Scope**:
The keyword detection threshold (`Strict`, `Standard`, `Custom Only`) that determines which sensitive words and profanities are flagged from transcripts, strictly decoupled from remediation actions (subtitle masking and audio bleeping).
_Avoid_: Safety sensitivity, censor level, sensitivity mode, manual mode



**Prompt Editor**:
The dedicated template workspace in Yonru Clip for composing, testing, and managing modular natural language AI hook detection prompts and extraction directives.
_Avoid_: Prompt settings, AI config, template screen

**Hook Results Gallery**:
The responsive grid workspace displaying AI-curated Hook cards sorted by virality score, with category filters, thumbnail previews, and transcript quotes.
_Avoid_: Hook list, results screen, card grid, clip browser

**Cinematic Hook Preview Modal**:
The focused inspection dialog providing synchronized video playback, start/end timestamp adjustments, transcript excerpts, and the AI Virality Rationale breakdown before opening a clip in the Studio Editor.
_Avoid_: Video preview popup, hook detail modal, player dialog

**Two-Tier Hook Timing Slider**:
The dual-scale timeline control within the Cinematic Hook Preview Modal comprising a macro source video overview bar and an expanded micro context window for precise hook boundary adjustment without handle collision.
_Avoid_: Dual slider, time scrub, range picker, clip trimmer

**Cached Video Library**:
The local storage repository and grid interface showcasing previously ingested and processed source videos for instant re-analysis, hook replay, or offline management without re-downloading.
_Avoid_: Download history, video cache list, saved files

**Editor Transition Overlay**:
The transient full-screen loading state displayed while preparing media assets, timeline tracks, and studio components when transitioning from the Home workspace to the Studio Editor.
_Avoid_: Loading screen, wait modal, editor spinner, cinematic loading overlay
