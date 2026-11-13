# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-11-13

### Features

- **Timeline**:
  - Add multi-track audio and text layers with NLE stacking (#318)
  - Streamline canvas and decouple subtitle editing (#314)
  - Global span audio track and fix drag/undo lag (#311) (#312)
- **Editor**:
  - Add workspace audio library and precision playhead placement (#315) (#316)
  - Align timeline text inspector and drag snapping with cover slide design (#307) (#308)

### Bug Fixes

- **Timeline**: Align text layer block width and inspector with ruler (#310)

## [0.2.0] - 2026-11-02

### Features

- **Editor**:
  - Show custom preset indicator and sync studio preview with text case (#306)
  - Integrate PresetStudioViewport into modal grid and sidebar pane (#304)
  - Add PresetStudioViewport with kinetic animation engine (#303)
  - Deferred render autoplay, studio control deck, and workspace preview isolation (#295)

### Bug Fixes

- **Preview**: Hide timeline text layers and overlays during rendered video preview (#299)
- **Remotion**: Fix timeline segment cuts and face tracking render parity (#297)
- **Home**: Show skeleton loading during initial load of ready clips

## [0.1.0] - 2026-10-21

### Features

- feat: AI Hook Discovery Engine
- feat: Smart Face Tracking & Auto-Reframe
- feat: Multi-Track Studio Timeline
- feat: Dynamic Subtitle Styling & Presets
- feat: Word-Level Audio Censorship
- feat: Platform Safe Zone Overlays
- feat: Creator Cover Slide Studio
- feat: Local Whisper Transcription

### Bug Fixes

- fix: Video playback desynchronization during backward timeline scrubbing
- fix: Subtitle timestamp lead-time clamping
- fix: Canvas letterbox clipping
