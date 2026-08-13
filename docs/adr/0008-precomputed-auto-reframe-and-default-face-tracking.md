# 0008. Pre-computed Auto-Reframe & Default Face Tracking

Date: 2026-08-13

## Status

Accepted

## Context

In vertical 9:16 short-form video editing, creators expect the subject to be framed automatically without manual panning. Previously in `yonru.clip`, face tracking was an optional setting computed strictly at render/export time. This meant:
1. The editor canvas preview remained locked to a static center crop (50%) with no live preview of the speaker framing.
2. Export rendering suffered an extra 2–5 second delay while OpenCV and MediaPipe processed video frames.
3. Creators had to manually discover and enable "Face Track" in the sidebar settings.

## Decision

1. **Ingestion Pre-computation**: Run `FaceTracker.analyze_video()` concurrently with or immediately following clip extraction (`run_local_cut`), persisting the resulting `crop_map.json` alongside `transcript.json` in the clip asset directory.
2. **Default Crop Mode**: Make `cropMode: 'face_tracking'` the default state for vertical layout clips in `useClipperState.ts` and style initializers.
3. **WYSIWYG Editor Preview**: Pass `cropMap` through `useRemotionBridge.ts` to `Composition.tsx` so the editor preview dynamically tracks the speaker during playback.
4. **Auto-Backfill & Non-Face Fallback**: When loading legacy clips missing `crop_map.json`, trigger background generation via `/api/clips/{folder}/{clip_id}/track-face`. If no faces are detected, default `cropMode` to `'manual'` with a static center crop.
5. **Canvas Auto-Reframe Override**: Allow creators to directly drag the video canvas in `VideoPreview.vue` / `useCropDrag.ts`; exceeding a drag threshold immediately switches `cropMode` to `'manual'` at the dragged position with a subtle notification.
6. **Persistence & Export Zero-Overhead**: Save explicit user overrides to `style_settings.json`. During export, `render_engine.py` reuses the cached `crop_map.json`, eliminating render latency.

## Consequences

### Positive
- Live editor canvas provides true WYSIWYG face tracking identical to final export.
- Export render time is zero-delay because face coordinates are already pre-computed.
- Creators can seamlessly override AI tracking at any point by dragging the canvas.

### Negative / Trade-offs
- Initial clip extraction takes an additional ~1.5s–3.5s before `job.status = 'ready'`.
