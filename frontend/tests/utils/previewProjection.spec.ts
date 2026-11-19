import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, ref } from 'vue';
import {
  createPreviewProjection,
  type NativeVideoAdapter,
  type PreviewProjection,
  type PreviewSessionSource
} from '../../app/utils/previewProjection';
import { MockPlayerBridge } from '../../app/utils/playerBridge';

function makeSession() {
  return {
    currentTime: ref(0),
    isPlaying: ref(false),
    isTimelineShifting: ref(false),
    isDraggingTimelineItem: ref(false),
    isMediaLoading: ref(true),
    isCapturingThumbnail: ref(false),
    useNativePlayer: ref(false),
    videoUrl: ref<string | null>('http://localhost:8765/assets/clip.mp4'),
    outputUrl: ref<string | null>(null),
    videoFps: ref(30),
    timelineDuration: ref(20),
    timelineTracks: ref<any[]>([
      {
        id: 'text',
        name: 'Text 1',
        type: 'text',
        items: [{ id: 't1', start: 1, duration: 2, content: 'Hello' }]
      },
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', start: 0, duration: 20, mediaStart: 5 }]
      },
      {
        id: 'audio',
        name: 'Audio 1',
        type: 'audio',
        items: [{ id: 'a1', start: 0, duration: 4, src: 'data:audio/wav' }]
      }
    ]),
    coverEnabled: ref(false),
    coverDuration: ref(2),
    volume: ref(0.8),
    fullTranscript: ref<any[]>([{ start: 0, end: 1, text: 'hello world' }]),
    subtitleMode: ref('word'),
    subtitleSyncOffset: ref(0),
    subtitlesEnabled: ref(true),
    showIframeDebug: ref(false),
    activeHook: ref<any>(null),
    subtitlePosition: ref('center'),
    subtitleOffset: ref(50),
    autoAdaptiveSubtitles: ref(true),
    videoLayout: ref('vertical'),
    landscapeBackground: ref('black'),
    landscapeBlurRadius: ref(25),
    landscapeDarkness: ref(35),
    font: ref('Montserrat'),
    fontSize: ref(50),
    subtitleFontWeight: ref(900),
    subtitleTextColor: ref('#FFFFFF'),
    subtitleHighlightColor: ref('#CFFF50'),
    subtitleStrokeColor: ref('#000000'),
    subtitleStrokeWidth: ref(0),
    subtitleTextTransform: ref('uppercase'),
    subtitleAnimation: ref('pop'),
    subtitleHighlightMode: ref('color'),
    subtitleBackground: ref('none'),
    subtitleBackgroundOpacity: ref(0.7),
    subtitleWordSpacing: ref(0),
    cropMode: ref('face_tracking'),
    cropMap: ref<any[]>([
      { time: 0, x: 500 },
      { time: 2, x: 800 }
    ]),
    cropPercentX: ref(50),
    cropPercentXTop: ref(40),
    cropPercentXBottom: ref(60),
    splitZoomTop: ref(1),
    splitZoomBottom: ref(1),
    splitOffsetXTop: ref(0),
    splitOffsetYTop: ref(0),
    splitOffsetXBottom: ref(0),
    splitOffsetYBottom: ref(0),
    audioBleepEnabled: ref(false),
    audioBleepSource: ref('default'),
    customBleepFile: ref<any>(null),
    contentAudit: ref<any>({ flaggedSegments: [] })
  };
}

type FakeSession = ReturnType<typeof makeSession>;

class FakeVideo implements NativeVideoAdapter {
  paused = true;
  muted = false;
  volume = 1;
  currentTime = 0;
  videoWidth = 0;
  videoHeight = 0;
  listeners = new Map<string, Set<() => void>>();
  play = vi.fn(async () => {
    this.paused = false;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  addEventListener(type: string, listener: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string) {
    this.listeners.get(type)?.forEach(l => l());
  }
  count(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe('Preview Projection', () => {
  let session: FakeSession;
  let bridge: MockPlayerBridge;
  let frames: Array<() => void>;
  let projection: PreviewProjection | null;
  let video: FakeVideo;

  const runFrame = () => {
    const pending = frames;
    frames = [];
    pending.forEach(cb => cb());
  };
  const updates = () =>
    bridge.calls.filter(c => c.type === 'updateProps') as Array<{
      type: 'updateProps';
      payload: Record<string, any>;
    }>;
  const seeks = () =>
    bridge.calls.filter(c => c.type === 'seek') as Array<{
      type: 'seek';
      frame: number;
    }>;
  const lastPayload = () => updates().at(-1)?.payload ?? {};

  function create(withVideo = false) {
    projection = createPreviewProjection(
      session as unknown as PreviewSessionSource,
      bridge,
      {
        nativeVideo: withVideo ? ref(video) : undefined,
        scheduleFrame: cb => frames.push(cb),
        cancelFrame: () => {
          frames = [];
        },
        now: () => 1234
      }
    );
    return projection;
  }

  /** Apply a change, let watchers run, then run one animation frame. */
  async function settle() {
    await nextTick();
    runFrame();
  }

  beforeEach(() => {
    session = makeSession();
    bridge = new MockPlayerBridge();
    frames = [];
    projection = null;
    video = new FakeVideo();
  });

  afterEach(() => {
    projection?.dispose();
  });

  describe('initial projection', () => {
    it('pushes the full props once and seeks to the playhead', () => {
      create();
      expect(updates()).toHaveLength(1);
      const props = lastPayload();
      expect(props.videoPath).toBe(
        'http://localhost:8765/assets/clip.mp4?t=1234'
      );
      expect(props.volume).toBe(0.8);
      expect(props.cropX).toBe(960);
      expect(props.fps).toBe(30);
      expect(props.durationInFrames).toBe(600);
      expect(props.timelineVideoItems).toEqual([
        { id: 'v1', start: 0, duration: 20, mediaStart: 5 }
      ]);
      expect(props.words.length).toBeGreaterThan(0);
      expect(props.subtitleStyle.fontFamily).toBe('Montserrat');
      expect(seeks()).toEqual([{ type: 'seek', frame: 0 }]);
    });

    it('never projects Timeline Text Layers or Cover Slide text', () => {
      create();
      const props = lastPayload();
      expect(props).not.toHaveProperty('timelineTextItems');
      expect(props).not.toHaveProperty('coverTextOverlays');
      expect(props).not.toHaveProperty('thumbnailTextOverlays');
      expect(props).not.toHaveProperty('coverImagePath');
    });
  });

  describe('slice isolation', () => {
    it('merges a burst of edits into one push with only the changed slices', async () => {
      create();
      bridge.calls = [];

      session.font.value = 'Inter';
      session.fontSize.value = 64;
      session.volume.value = 0.3;
      await nextTick();
      expect(updates()).toHaveLength(0);

      runFrame();
      expect(updates()).toHaveLength(1);
      const props = lastPayload();
      expect(props.subtitleStyle.fontFamily).toBe('Inter');
      expect(props.subtitleStyle.fontSize).toBe(64);
      expect(props.volume).toBe(0.3);
      expect(props).not.toHaveProperty('videoPath');
      expect(props).not.toHaveProperty('words');
      expect(props).not.toHaveProperty('cropMap');
    });

    it('does no work when only a Timeline Text Layer changes', async () => {
      create();
      bridge.calls = [];

      // In-place edit (like useTimelineState.updateTimelineItem)
      Object.assign(session.timelineTracks.value[0].items[0], {
        content: 'Changed',
        start: 3
      });
      await settle();
      // Whole-array replacement that keeps video/audio items the same
      const [text, videoTrack, audio] = session.timelineTracks.value;
      session.timelineTracks.value = [
        {
          ...text,
          items: [...text.items, { id: 't2', start: 5, duration: 1 }]
        },
        videoTrack,
        audio
      ];
      await settle();

      expect(bridge.calls).toEqual([]);
    });

    it('updates durationInFrames from timelineDuration and re-seeks', async () => {
      create();
      bridge.calls = [];

      session.timelineDuration.value = 25;
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({ durationInFrames: 750, fps: 30 })
      );
      expect(seeks()).toEqual([{ type: 'seek', frame: 0 }]);
    });

    it('sends cover timing only (coverEnabled / coverDuration)', async () => {
      create();
      bridge.calls = [];

      session.coverEnabled.value = true;
      session.coverDuration.value = 3;
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({
          coverEnabled: true,
          coverDuration: 3,
          thumbnailEnabled: true,
          thumbnailDuration: 3
        })
      );
    });

    it('detects in-place Main Video item edits', async () => {
      create();
      bridge.calls = [];

      Object.assign(session.timelineTracks.value[1].items[0], { duration: 12 });
      await settle();

      expect(lastPayload().timelineVideoItems).toEqual([
        { id: 'v1', start: 0, duration: 12, mediaStart: 5 }
      ]);
    });

    it('drops muted Audio Track items', async () => {
      create();
      expect(lastPayload().timelineAudioItems).toHaveLength(1);
      bridge.calls = [];

      session.timelineTracks.value[2].muted = true;
      await settle();

      expect(lastPayload().timelineAudioItems).toEqual([]);
    });

    it('detects in-place transcript text edits', async () => {
      create();
      bridge.calls = [];

      session.fullTranscript.value[0].text = 'brand new words';
      await settle();

      const words = lastPayload()
        .words.map((w: any) => w.word)
        .join(' ');
      expect(words.toLowerCase()).toContain('brand');
    });

    it('updates style props when the layout changes', async () => {
      create();
      bridge.calls = [];

      session.videoLayout.value = 'landscape';
      session.landscapeBackground.value = 'blur';
      session.landscapeBlurRadius.value = 35;
      session.landscapeDarkness.value = 45;
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({
          videoLayout: 'landscape',
          landscapeBackground: 'blur',
          landscapeBlurRadius: 35,
          landscapeDarkness: 45
        })
      );
    });
  });

  describe('framing', () => {
    it('passes cropMap by reference without cloning', async () => {
      create();
      bridge.calls = [];
      const stringify = vi.spyOn(JSON, 'stringify');

      const nextMap = [
        { time: 0, x: 600 },
        { time: 3, x: 900 }
      ];
      session.cropMap.value = nextMap;
      await settle();

      expect(lastPayload().cropMap).toBe(nextMap);
      expect(stringify).not.toHaveBeenCalled();
      stringify.mockRestore();
    });

    it('sends an empty cropMap and split percents in manual mode', async () => {
      create();
      bridge.calls = [];

      session.cropMode.value = 'manual';
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({
          cropMap: [],
          cropPercentXTop: 40,
          cropPercentXBottom: 60
        })
      );
    });

    it('reads the source size from the editor video element', async () => {
      create(true);
      expect(lastPayload().sourceWidth).toBe(1920);
      bridge.calls = [];

      video.videoWidth = 1280;
      video.videoHeight = 720;
      video.emit('loadedmetadata');
      runFrame();

      expect(lastPayload()).toEqual(
        expect.objectContaining({ sourceWidth: 1280, sourceHeight: 720 })
      );
    });
  });

  describe('censorship', () => {
    it('merges contiguous or overlapping flagged segments and sends custom bleep source', async () => {
      create();
      bridge.calls = [];

      session.audioBleepEnabled.value = true;
      session.audioBleepSource.value = 'custom';
      session.customBleepFile.value = { name: 'b', data: 'data:audio/x' };
      session.contentAudit.value = {
        flaggedSegments: [
          { start: 2, duration: 1.0, word: 'a' },
          { start: 3.004, duration: 0.5, word: 'b' },
          { start: 5, duration: 1.0, word: 'c' }
        ]
      };
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({
          censoredSegments: [
            { start: 2, duration: 1.504 },
            { start: 5, duration: 1 }
          ],
          bleepAudioSrc: 'data:audio/x'
        })
      );
    });
  });

  describe('media', () => {
    it('rotates the cache buster and re-seeks when the video changes', async () => {
      let clock = 1;
      projection = createPreviewProjection(
        session as unknown as PreviewSessionSource,
        bridge,
        {
          scheduleFrame: cb => frames.push(cb),
          cancelFrame: () => {},
          now: () => clock
        }
      );
      bridge.calls = [];
      clock = 2;

      session.videoUrl.value = '/assets/other.mp4';
      await settle();

      expect(lastPayload().videoPath).toBe('/assets/other.mp4?t=2');
      expect(seeks()).toHaveLength(1);
    });

    it('hides subtitles when previewing the rendered output', async () => {
      create();
      bridge.calls = [];

      session.outputUrl.value = session.videoUrl.value;
      await settle();

      expect(lastPayload().hideSubtitles).toBe(true);
    });
  });

  describe('transport', () => {
    it('forwards play and pause', async () => {
      create();
      bridge.calls = [];

      session.isPlaying.value = true;
      await nextTick();
      session.isPlaying.value = false;
      await nextTick();

      expect(bridge.calls.map(c => c.type)).toEqual(['play', 'pause']);
    });

    it('does not re-seek on paused style or crop edits', async () => {
      create();
      bridge.calls = [];

      session.fontSize.value = 70;
      session.cropMap.value = [{ time: 0, x: 1 }];
      session.cropPercentX.value = 30;
      await settle();

      expect(updates()).toHaveLength(1);
      expect(seeks()).toHaveLength(0);
    });

    it('seeks once per new frame on external playhead moves', async () => {
      create();
      bridge.calls = [];

      session.currentTime.value = 10.5;
      await nextTick();
      session.currentTime.value = 10.51; // same frame at 30fps
      await nextTick();

      expect(seeks()).toEqual([{ type: 'seek', frame: 315 }]);
    });

    it('does not seek while the timeline is shifting, then catches up', async () => {
      create();
      bridge.calls = [];

      session.isTimelineShifting.value = true;
      await nextTick();
      session.currentTime.value = 4;
      await nextTick();
      expect(seeks()).toHaveLength(0);

      session.isTimelineShifting.value = false;
      await nextTick();
      expect(seeks()).toEqual([{ type: 'seek', frame: 120 }]);
    });

    it('applies REMOTION_TIMEUPDATE without seeking back', async () => {
      create();
      bridge.calls = [];

      bridge.emitMessage({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 15.75,
        frame: 472
      });
      await nextTick();
      expect(session.currentTime.value).toBe(15.75);
      expect(seeks()).toHaveLength(0);

      // Paused edits after a reported frame keep the player where it is.
      session.subtitleTextColor.value = '#FF0000';
      await settle();
      expect(seeks()).toHaveLength(0);
    });

    it('clamps and pauses at the end of the timeline', async () => {
      create();
      session.isPlaying.value = true;
      await nextTick();
      bridge.calls = [];

      bridge.emitMessage({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 19.97,
        frame: 599
      });

      expect(session.currentTime.value).toBe(20);
      expect(session.isPlaying.value).toBe(false);
      expect(bridge.calls.some(c => c.type === 'pause')).toBe(true);
    });

    it('stops playing on REMOTION_PAUSED and REMOTION_ENDED', () => {
      create();
      session.isPlaying.value = true;
      bridge.emitMessage({ type: 'REMOTION_PAUSED' });
      expect(session.isPlaying.value).toBe(false);

      session.isPlaying.value = true;
      bridge.emitMessage({ type: 'REMOTION_ENDED' });
      expect(session.isPlaying.value).toBe(false);
    });

    it('does not seek while playing when props change', async () => {
      create();
      session.isPlaying.value = true;
      await nextTick();
      bridge.calls = [];

      session.timelineDuration.value = 30;
      await settle();

      expect(updates()).toHaveLength(1);
      expect(seeks()).toHaveLength(0);
    });
  });

  describe('scheduling', () => {
    it('defers pushes while dragging and flushes on drag end', async () => {
      create();
      bridge.calls = [];

      session.isDraggingTimelineItem.value = true;
      await nextTick();
      Object.assign(session.timelineTracks.value[1].items[0], { start: 1 });
      await settle();
      expect(updates()).toHaveLength(0);

      session.isDraggingTimelineItem.value = false;
      await nextTick();
      expect(updates()).toHaveLength(1);
      expect(lastPayload().timelineVideoItems[0].start).toBe(1);
    });

    it('flush() pushes pending slices synchronously', async () => {
      const p = create();
      bridge.calls = [];

      session.font.value = 'Inter';
      await nextTick();
      p.flush();

      expect(updates()).toHaveLength(1);
      expect(frames).toHaveLength(0);
    });

    it('flushes and re-seeks on IFRAME_READY', async () => {
      create();
      bridge.calls = [];

      session.volume.value = 0.1;
      await nextTick();
      bridge.emitMessage({ type: 'IFRAME_READY' });

      expect(updates()).toHaveLength(1);
      expect(lastPayload().volume).toBe(0.1);
      expect(seeks()).toEqual([{ type: 'seek', frame: 0 }]);
      expect(session.isMediaLoading.value).toBe(false);
    });

    it('stops all work after dispose', async () => {
      const p = create();
      bridge.calls = [];
      p.dispose();

      session.font.value = 'Inter';
      session.currentTime.value = 3;
      session.isPlaying.value = true;
      await settle();
      bridge.emitMessage({ type: 'IFRAME_READY' });

      expect(bridge.calls).toEqual([]);
    });
  });

  describe('Remotion mode (default)', () => {
    it('never drives the native video element', async () => {
      create(true);
      session.audioBleepEnabled.value = true;
      session.contentAudit.value = {
        flaggedSegments: [{ start: 2, duration: 1.5 }]
      };
      session.isPlaying.value = true;
      await settle();
      bridge.calls = [];

      bridge.emitMessage({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 2.5,
        frame: 75
      });
      await settle();

      expect(video.count('timeupdate')).toBe(0);
      expect(video.count('ended')).toBe(0);
      expect(video.play).not.toHaveBeenCalled();
      expect(video.muted).toBe(false);
      expect(video.volume).toBe(1);
      // Censorship ducking is frame-locked in Composition.tsx (ADR-0018).
      expect(updates()).toHaveLength(0);
    });
  });

  describe('native fallback mode (ADR-0004 / ADR-0005)', () => {
    it('plays the native video at the mapped media time', async () => {
      session.useNativePlayer.value = true;
      create(true);
      expect(video.count('timeupdate')).toBe(1);

      session.currentTime.value = 2;
      await nextTick();
      session.isPlaying.value = true;
      await nextTick();

      expect(video.play).toHaveBeenCalled();
      expect(video.currentTime).toBe(7); // mediaStart 5 + 2
      expect(video.muted).toBe(false);
      expect(video.volume).toBe(0.8);
    });

    it('mutes the native video only inside flagged segments while playing', async () => {
      session.useNativePlayer.value = true;
      session.audioBleepEnabled.value = true;
      session.volume.value = 0.5;
      session.contentAudit.value = {
        flaggedSegments: [{ start: 2, duration: 1.5 }]
      };
      session.isPlaying.value = true;
      create(true);
      await nextTick();

      session.currentTime.value = 0.5;
      await nextTick();
      expect(video.muted).toBe(false);
      expect(video.volume).toBe(0.5);

      session.currentTime.value = 2.5;
      await nextTick();
      expect(video.muted).toBe(true);
      expect(video.volume).toBe(0);

      session.currentTime.value = 4;
      await nextTick();
      expect(video.muted).toBe(false);
      expect(video.volume).toBe(0.5);
    });

    it('maps native timeupdate back to the playhead', async () => {
      session.useNativePlayer.value = true;
      create(true);
      bridge.calls = [];

      video.paused = false;
      video.currentTime = 9; // media 9 => timeline 4
      video.emit('timeupdate');
      await nextTick();

      expect(session.currentTime.value).toBe(4);
      expect(seeks()).toHaveLength(0);
    });

    it('detaches listeners and pauses when switching back to Remotion', async () => {
      session.useNativePlayer.value = true;
      create(true);
      video.paused = false;

      session.useNativePlayer.value = false;
      await nextTick();

      expect(video.count('timeupdate')).toBe(0);
      expect(video.count('ended')).toBe(0);
      expect(video.pause).toHaveBeenCalled();
    });
  });
});
