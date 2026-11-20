# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2026-11-20

### Features

- **Updater**: Add supervised one-click self-update workflow so you can update Yonru Clip directly from the app (#322)
- **Changelog**: Add hybrid changelog with remote GitHub release discovery and update indicators (#320)

### Improvements

- **Render**: Cache Remotion bundle across renders and stage media files with hardlinks instead of full copies (#332)
- **Remotion**: Pre-index framing, segment, and subtitle lookups for faster frame evaluation (#335)
- **Preview**: Replace the preview bridge with slice-based Preview Projection (#329)
- **Session**: Unify clip session loading and saving into a single flow (#328)
- **Media**: Cache video probe metadata and remove duplicate `ffprobe` calls

### Bug Fixes

- **API**: Unblock the FastAPI event loop and split clip session queries from background healing (#339)
- **Session**: Coalesce clip session saves behind one scheduler and strip `cropMap` from subtitle styles (#337)
- **Job Store**: Redesign `JobStore` to stop full-store rewrites and disk I/O storms (#333) (#334)
- **Frontend**: Resolve `nuxi typecheck` errors and enforce the pre-push verification gate (#331)
- **Launcher**:
  - Ignore package metadata edits and align Bun installs with `package-lock.json` (#326)
  - Clear stale Vite and npm lock caches after package installation (#324)

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
