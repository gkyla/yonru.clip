// previewProjection.ts - Preview Projection: projects the live Clip Session
// onto the Remotion preview player through the PlayerBridge seam.
//
// Each slice watches only the session fields it needs and pushes only its own
// props. Pushes are merged to at most one per animation frame. Timeline Text
// Layers and Cover Slide text are drawn by Konva/HTML in VideoPreview.vue, so
// they are never watched here.
import { effectScope, toRaw, watch, type WatchSource } from 'vue';
import type { YonruClipProps } from '@yonru/remotion';
import type { useClipperState } from '../composables/useClipperState';
import { resolveApiBase } from './apiBase';
import { SubtitleLayoutEngine } from './subtitleChunker';
import { SubtitleStyleCoordinator } from './subtitleStyleCoordinator';
import { findVideoTrack, isAudioTrack } from './timelineHelpers';
import type { PlayerBridge, PlayerBridgeEvent } from './playerBridge';
import type { TimelineTrackItem } from '../types/clipper';

type ClipperState = ReturnType<typeof useClipperState>;

/** The Clip Session fields the Preview Projection reads. */
export type PreviewSessionSource = Pick<
  ClipperState,
  | 'currentTime'
  | 'isPlaying'
  | 'isTimelineShifting'
  | 'isDraggingTimelineItem'
  | 'isMediaLoading'
  | 'isCapturingThumbnail'
  | 'videoUrl'
  | 'outputUrl'
  | 'videoFps'
  | 'timelineDuration'
  | 'timelineTracks'
  | 'coverEnabled'
  | 'coverDuration'
  | 'volume'
  | 'fullTranscript'
  | 'subtitleMode'
  | 'subtitleSyncOffset'
  | 'subtitlesEnabled'
  | 'showIframeDebug'
  | 'activeHook'
  | 'subtitlePosition'
  | 'subtitleOffset'
  | 'autoAdaptiveSubtitles'
  | 'videoLayout'
  | 'landscapeBackground'
  | 'landscapeBlurRadius'
  | 'landscapeDarkness'
  | 'font'
  | 'fontSize'
  | 'subtitleFontWeight'
  | 'subtitleTextColor'
  | 'subtitleHighlightColor'
  | 'subtitleStrokeColor'
  | 'subtitleStrokeWidth'
  | 'subtitleTextTransform'
  | 'subtitleAnimation'
  | 'subtitleHighlightMode'
  | 'subtitleBackground'
  | 'subtitleBackgroundOpacity'
  | 'subtitleWordSpacing'
  | 'cropMode'
  | 'cropMap'
  | 'cropPercentX'
  | 'cropPercentXTop'
  | 'cropPercentXBottom'
  | 'splitZoomTop'
  | 'splitZoomBottom'
  | 'splitOffsetXTop'
  | 'splitOffsetYTop'
  | 'splitOffsetXBottom'
  | 'splitOffsetYBottom'
  | 'audioBleepEnabled'
  | 'audioBleepSource'
  | 'customBleepFile'
  | 'contentAudit'
> &
  Partial<Pick<ClipperState, 'videoDuration'>>;

export interface PreviewProjectionOptions {
  scheduleFrame?: (cb: () => void) => number;
  cancelFrame?: (handle: number) => void;
  now?: () => number;
}

export interface PreviewProjection {
  /** Push pending slices now (skips the frame wait and drag deferral). */
  flush(): void;
  dispose(): void;
}

type ProjectedProps = Partial<YonruClipProps>;

/** How much a slice change moves the paused playhead mapping. */
type SeekInvalidation = 'none' | 'timing' | 'clip';
const INVALIDATION_RANK: Record<SeekInvalidation, number> = {
  none: 0,
  timing: 1,
  clip: 2
};

interface Slice {
  sources: WatchSource[];
  deep?: boolean;
  /** Return false when the new source values do not change the props. */
  changed?: (values: unknown[]) => boolean;
  invalidation: SeekInvalidation;
  build: () => ProjectedProps;
}

const END_OF_TIMELINE_EPSILON_SEC = 0.05;

function mergeCensoredSegments(
  segments: ReadonlyArray<{ start: number; duration: number }>
): Array<{ start: number; duration: number }> {
  if (!segments || segments.length === 0) return [];
  const valid = segments
    .filter(
      s =>
        s &&
        typeof s.start === 'number' &&
        typeof s.duration === 'number' &&
        s.duration > 0
    )
    .map(s => ({
      start: Math.round(s.start * 1000) / 1000,
      duration: Math.round(s.duration * 1000) / 1000
    }))
    .sort((a, b) => a.start - b.start);

  if (valid.length === 0) return [];

  const merged: Array<{ start: number; duration: number }> = [];
  let current = { ...valid[0]! };

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i]!;
    const currentEnd =
      Math.round((current.start + current.duration) * 1000) / 1000;
    if (next.start <= currentEnd + 0.005) {
      const nextEnd = Math.round((next.start + next.duration) * 1000) / 1000;
      const newEnd = Math.max(currentEnd, nextEnd);
      current.duration = Math.round((newEnd - current.start) * 1000) / 1000;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

function sameItems(
  a: ReadonlyArray<Record<string, unknown>> | null,
  b: ReadonlyArray<Record<string, unknown>>
): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    const keys = Object.keys(right);
    if (Object.keys(left).length !== keys.length) return false;
    for (const key of keys) {
      if (!Object.is(left[key], right[key])) return false;
    }
  }
  return true;
}

function defaultScheduleFrame(cb: () => void): number {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(cb);
  }
  return setTimeout(cb, 16) as unknown as number;
}

function defaultCancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}

export function createPreviewProjection(
  session: PreviewSessionSource,
  bridge: PlayerBridge,
  options: PreviewProjectionOptions = {}
): PreviewProjection {
  const scheduleFrame = options.scheduleFrame ?? defaultScheduleFrame;
  const cancelFrame = options.cancelFrame ?? defaultCancelFrame;
  const now = options.now ?? Date.now;

  const fps = () => session.videoFps.value || 30;
  const coverActive = () => !!session.coverEnabled.value;
  const coverDuration = () => session.coverDuration.value || 0;

  // --- shared private state ---
  let lastSeekFrame: number | null = null;
  let lastReportedTime: number | null = null;
  let frameHandle: number | null = null;
  let pendingInvalidation: SeekInvalidation = 'none';
  const dirty = new Set<Slice>();
  let disposed = false;

  let cacheBuster = String(now());
  let lastVideoUrl: string | null = session.videoUrl.value;
  let sourceSize = { width: 1920, height: 1080 };

  let videoItems: Record<string, unknown>[] | null = null;
  let audioItems: Record<string, unknown>[] | null = null;

  // --- slices ---
  const media: Slice = {
    sources: [
      () => session.videoUrl.value,
      () => session.outputUrl.value,
      () => session.subtitlesEnabled.value,
      () => session.showIframeDebug.value
    ],
    invalidation: 'clip',
    build() {
      const url = session.videoUrl.value || '';
      if (url !== lastVideoUrl) {
        lastVideoUrl = url;
        if (url) cacheBuster = String(now());
      }
      let videoPath = url;
      if (
        (url.includes('localhost') ||
          url.startsWith('/') ||
          url.includes(resolveApiBase())) &&
        !url.includes('?t=') &&
        !url.includes('&t=')
      ) {
        videoPath += (url.includes('?') ? '&' : '?') + 't=' + cacheBuster;
      }
      const outputUrl = session.outputUrl.value;
      return {
        videoPath,
        hideSubtitles:
          session.subtitlesEnabled.value === false ||
          (!!outputUrl && url === outputUrl),
        showDebug: session.showIframeDebug.value
      };
    }
  };

  const timing: Slice = {
    sources: [
      () => session.videoFps.value,
      () => session.timelineDuration.value,
      () => session.coverEnabled.value,
      () => session.coverDuration.value
    ],
    invalidation: 'timing',
    build() {
      const activeFps = fps();
      return {
        fps: activeFps,
        durationInFrames: Math.round(
          session.timelineDuration.value * activeFps
        ),
        coverEnabled: coverActive(),
        coverDuration: coverDuration(),
        thumbnailEnabled: coverActive(),
        thumbnailDuration: coverDuration()
      };
    }
  };

  const readVideoItems = () =>
    (findVideoTrack(session.timelineTracks.value)?.items ?? []).map(
      (item: TimelineTrackItem) => ({ ...item })
    );
  const timelineVideo: Slice = {
    // Items are edited in place (Object.assign), so the getter copies each
    // item to track every field; Text Track items are never read.
    sources: [readVideoItems],
    changed([next]) {
      const items = next as Record<string, unknown>[];
      if (sameItems(videoItems, items)) return false;
      videoItems = items;
      return true;
    },
    invalidation: 'timing',
    build() {
      videoItems = videoItems ?? readVideoItems();
      return { timelineVideoItems: videoItems };
    }
  };

  const readAudioItems = () =>
    session.timelineTracks.value
      .filter(t => isAudioTrack(t) && !t.muted)
      .flatMap(t => (t.items ?? []).map(item => ({ ...item })));
  const timelineAudio: Slice = {
    sources: [readAudioItems],
    changed([next]) {
      const items = next as Record<string, unknown>[];
      if (sameItems(audioItems, items)) return false;
      audioItems = items;
      return true;
    },
    invalidation: 'none',
    build() {
      audioItems = audioItems ?? readAudioItems();
      return { timelineAudioItems: audioItems };
    }
  };

  const transcript: Slice = {
    // Segment text is edited in place (EditorFloatingPanel v-model), so this
    // one slice keeps a deep watch.
    sources: [
      () => session.fullTranscript.value,
      () => session.subtitleMode.value,
      () => session.subtitleSyncOffset.value
    ],
    deep: true,
    invalidation: 'none',
    build() {
      const { wordsData, allWordTimings } =
        SubtitleLayoutEngine.extractRemotionProps(
          toRaw(session.fullTranscript.value) || [],
          session.subtitleMode.value || 'word',
          session.subtitleSyncOffset.value
        );
      return { words: wordsData, wordTimings: allWordTimings };
    }
  };

  const style: Slice = {
    sources: [
      () => session.subtitlePosition.value,
      () => session.subtitleOffset.value,
      () => session.autoAdaptiveSubtitles.value,
      () => session.videoLayout.value,
      () => session.landscapeBackground.value,
      () => session.landscapeBlurRadius.value,
      () => session.landscapeDarkness.value,
      () => session.font.value,
      () => session.fontSize.value,
      () => session.subtitleFontWeight.value,
      () => session.subtitleTextColor.value,
      () => session.subtitleHighlightColor.value,
      () => session.subtitleStrokeColor.value,
      () => session.subtitleStrokeWidth.value,
      () => session.subtitleTextTransform.value,
      () => session.subtitleAnimation.value,
      () => session.subtitleHighlightMode.value,
      () => session.subtitleBackground.value,
      () => session.subtitleBackgroundOpacity.value,
      () => session.subtitleWordSpacing.value
    ],
    invalidation: 'none',
    build() {
      const bundle = SubtitleStyleCoordinator.extractRemotionProps({
        subtitlePosition: session.subtitlePosition.value,
        subtitleOffset: session.subtitleOffset.value,
        autoAdaptiveSubtitles: session.autoAdaptiveSubtitles.value,
        videoLayout: session.videoLayout.value,
        landscapeBackground: session.landscapeBackground.value,
        landscapeBlurRadius: session.landscapeBlurRadius.value,
        landscapeDarkness: session.landscapeDarkness.value,
        font: session.font.value,
        fontSize: session.fontSize.value,
        subtitleFontWeight: session.subtitleFontWeight.value,
        subtitleTextColor: session.subtitleTextColor.value,
        subtitleHighlightColor: session.subtitleHighlightColor.value,
        subtitleStrokeColor: session.subtitleStrokeColor.value,
        subtitleStrokeWidth: session.subtitleStrokeWidth.value,
        subtitleTextTransform: session.subtitleTextTransform.value,
        subtitleAnimation: session.subtitleAnimation.value,
        subtitleHighlightMode: session.subtitleHighlightMode.value,
        subtitleBackground: session.subtitleBackground.value,
        subtitleBackgroundOpacity: session.subtitleBackgroundOpacity.value,
        subtitleWordSpacing: session.subtitleWordSpacing.value
      });
      return {
        position: bundle.position as YonruClipProps['position'],
        videoLayout: bundle.videoLayout,
        landscapeBackground: bundle.landscapeBackground,
        landscapeBlurRadius: bundle.landscapeBlurRadius,
        landscapeDarkness: bundle.landscapeDarkness,
        subtitleOffset: bundle.subtitleOffset,
        autoAdaptiveSubtitles: bundle.autoAdaptiveSubtitles,
        subtitleStyle: bundle.subtitleStyle as YonruClipProps['subtitleStyle']
      };
    }
  };

  const framing: Slice = {
    // cropMap is treated as immutable: watched by reference, passed by
    // reference (no deep watch, no clone).
    sources: [
      () => session.cropMode.value,
      () => session.cropMap.value,
      () => session.cropPercentX.value,
      () => session.cropPercentXTop.value,
      () => session.cropPercentXBottom.value,
      () => session.splitZoomTop.value,
      () => session.splitZoomBottom.value,
      () => session.splitOffsetXTop.value,
      () => session.splitOffsetYTop.value,
      () => session.splitOffsetXBottom.value,
      () => session.splitOffsetYBottom.value
    ],
    invalidation: 'none',
    build() {
      const mode = session.cropMode.value || 'face_tracking';
      const cropXPixel = ((session.cropPercentX.value ?? 50) / 100) * 1920;
      return {
        cropX: isNaN(cropXPixel) ? 960 : cropXPixel,
        cropPercentXTop:
          mode === 'manual' ? session.cropPercentXTop.value : undefined,
        cropPercentXBottom:
          mode === 'manual' ? session.cropPercentXBottom.value : undefined,
        splitZoomTop: session.splitZoomTop.value ?? 1.0,
        splitZoomBottom: session.splitZoomBottom.value ?? 1.0,
        splitOffsetXTop: session.splitOffsetXTop.value ?? 0,
        splitOffsetYTop: session.splitOffsetYTop.value ?? 0,
        splitOffsetXBottom: session.splitOffsetXBottom.value ?? 0,
        splitOffsetYBottom: session.splitOffsetYBottom.value ?? 0,
        cropMap:
          mode === 'face_tracking' ? toRaw(session.cropMap.value) || [] : [],
        sourceWidth: sourceSize.width,
        sourceHeight: sourceSize.height
      };
    }
  };

  const readFlaggedSignature = () =>
    (session.contentAudit.value?.flaggedSegments ?? [])
      .map(s => `${s.start}:${s.duration}`)
      .join('|');
  const censorship: Slice = {
    sources: [
      () => session.audioBleepEnabled.value,
      () => session.audioBleepSource.value,
      () => session.customBleepFile.value?.data,
      readFlaggedSignature
    ],
    invalidation: 'none',
    build() {
      const enabled = session.audioBleepEnabled.value;
      const segments = toRaw(session.contentAudit.value?.flaggedSegments) ?? [];
      return {
        // Composition.tsx ducks and bleeps these frame-locked (ADR-0018).
        censoredSegments: enabled ? mergeCensoredSegments(segments) : [],
        bleepAudioSrc:
          enabled && session.audioBleepSource.value === 'custom'
            ? session.customBleepFile.value?.data || '/audio/bleep.wav'
            : undefined
      };
    }
  };

  const volume: Slice = {
    sources: [() => session.volume.value],
    invalidation: 'none',
    build() {
      return { volume: session.volume.value };
    }
  };

  const slices: Slice[] = [
    media,
    timing,
    timelineVideo,
    timelineAudio,
    transcript,
    style,
    framing,
    censorship,
    volume
  ];

  // --- flush & seek ---
  function raiseInvalidation(level: SeekInvalidation) {
    if (INVALIDATION_RANK[level] > INVALIDATION_RANK[pendingInvalidation]) {
      pendingInvalidation = level;
    }
  }

  function seekTo(time: number, force: boolean) {
    const frame = Math.floor(time * fps());
    if (!force && frame === lastSeekFrame) return;
    bridge.seek(frame);
    lastSeekFrame = frame;
  }

  function flushNow() {
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
    if (disposed) return;
    const invalidation = pendingInvalidation;
    pendingInvalidation = 'none';
    if (dirty.size > 0) {
      const patch: ProjectedProps = {};
      for (const slice of slices) {
        if (dirty.has(slice)) Object.assign(patch, slice.build());
      }
      dirty.clear();
      bridge.updateProps(patch);
    }
    if (!session.isPlaying.value) {
      seekTo(session.currentTime.value, invalidation !== 'none');
    }
  }

  function scheduleFlush() {
    if (frameHandle !== null || disposed) return;
    if (session.isDraggingTimelineItem.value) return;
    frameHandle = scheduleFrame(() => {
      frameHandle = null;
      if (session.isDraggingTimelineItem.value) return;
      flushNow();
    });
  }

  function markDirty(slice: Slice) {
    dirty.add(slice);
    raiseInvalidation(slice.invalidation);
    scheduleFlush();
  }

  // --- bridge events ---
  function onBridgeEvent(event: PlayerBridgeEvent) {
    switch (event.type) {
      case 'REMOTION_TIMEUPDATE': {
        let time = event.currentTime;
        lastSeekFrame = event.frame;
        const duration = session.timelineDuration.value;
        if (
          session.isPlaying.value &&
          time >= duration - END_OF_TIMELINE_EPSILON_SEC
        ) {
          time = duration;
          session.isPlaying.value = false;
          bridge.pause();
        }
        lastReportedTime = time;
        session.currentTime.value = time;
        break;
      }
      case 'REMOTION_PAUSED':
      case 'REMOTION_ENDED':
        session.isPlaying.value = false;
        break;
      case 'IFRAME_READY':
        raiseInvalidation('clip');
        flushNow();
        session.isMediaLoading.value = false;
        break;
      case 'REMOTION_MEDIA_METADATA': {
        if (
          event.width > 0 &&
          event.height > 0 &&
          (event.width !== sourceSize.width ||
            event.height !== sourceSize.height)
        ) {
          sourceSize = { width: event.width, height: event.height };
          markDirty(framing);
        }
        if (
          session.videoDuration &&
          Number.isFinite(event.duration) &&
          event.duration > 0
        ) {
          session.videoDuration.value = event.duration;
        }
        break;
      }
      case 'REMOTION_MEDIA_READY':
        session.isMediaLoading.value = false;
        break;
    }
  }

  // --- wiring ---
  const scope = effectScope();
  let stopBridge: (() => void) | null = null;

  scope.run(() => {
    for (const slice of slices) {
      watch(
        slice.sources,
        values => {
          if (slice.changed && !slice.changed(values)) return;
          markDirty(slice);
        },
        { deep: slice.deep }
      );
    }

    watch(
      () => session.isDraggingTimelineItem.value,
      dragging => {
        if (!dragging) flushNow();
      }
    );

    watch(
      () => session.isPlaying.value,
      playing => (playing ? bridge.play() : bridge.pause())
    );

    watch(
      () => session.currentTime.value,
      time => {
        if (time === lastReportedTime) return;
        if (session.isTimelineShifting.value) return;
        seekTo(time, false);
      }
    );

    watch(
      () => session.isTimelineShifting.value,
      shifting => {
        if (!shifting) seekTo(session.currentTime.value, false);
      }
    );

    stopBridge = bridge.onMessage(onBridgeEvent);
  });

  // Seed the slice caches and push the first full projection.
  videoItems = readVideoItems();
  audioItems = readAudioItems();
  for (const slice of slices) dirty.add(slice);
  raiseInvalidation('clip');
  flushNow();

  return {
    flush: flushNow,
    dispose() {
      if (disposed) return;
      if (frameHandle !== null) cancelFrame(frameHandle);
      frameHandle = null;
      disposed = true;
      stopBridge?.();
      scope.stop();
    }
  };
}
