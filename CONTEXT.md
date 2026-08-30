# Yonru Clip Domain Model

Yonru Clip is an AI-powered short video clipping and re-framing platform that detects viral moments (hooks) from long-form video content and prepares them for editing.

## Language

**Hook**:
A high-virality timestamp interval extracted from a source video, containing start and end seconds, a theme title, a virality score, and a sharp extracted static thumbnail (`thumb_{start}.jpg`).
_Avoid_: Segment, cut, highlight

**Ready Clip**:
A rendered or extracted standalone video clip derived from a Hook that is available in the library and ready for multi-track editing and subtitle customization.
_Avoid_: Exported video, snippet, output file

**Last Accessed Clip**:
The most recently opened or active clip session tracked in the workspace for quick-resume editing via the sidebar.
_Avoid_: Recent project, draft, active session

**Source Video / Cached Video**:
A downloaded or imported full-length source video stored locally with associated transcripts, heatmaps, and hook candidates.
_Avoid_: Raw file, base video, input asset

**Niche Profile**:
A persona or channel configuration preset (e.g. Finance, Gaming, Tech) defining prompt styles, typography, and subtitle aesthetic preferences.
_Avoid_: Workspace profile, template account

**Hardware Capability Profile**:
The host computer's hardware metrics (CPU cores, physical RAM, and GPU/VRAM capacity) evaluated to calculate realistic local transcription processing times and memory safety guardrails without prescriptive recommendations.
_Avoid_: System specs, PC benchmark, machine diagnostics

**Transcription Engine Preset**:
A local Whisper model tier (`tiny`, `base`, `small`, `medium`, `large-v3`) balancing processing speed, word-level timestamp accuracy, and memory allocation.
_Avoid_: Audio AI level, speech model size, whisper mode

**Transcription Duration Estimate**:
The expected speech-to-text processing time for a standard 60-second video clip calculated dynamically from host hardware acceleration metrics.
_Avoid_: Speed score, processing percentage
