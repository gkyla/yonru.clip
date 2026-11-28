import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, ref, type Ref } from 'vue';
import {
  createPreviewProjection,
  type PreviewProjection,
  type PreviewSessionSource
} from '../../app/utils/previewProjection';
import { MockPlayerBridge } from '../../app/utils/playerBridge';
import type { FlaggedSegment } from '../../app/utils/safetyEngine';

function makeSession() {
  return {
    currentTime: ref(0),
    isPlaying: ref(false),
    isTimelineShifting: ref(false),
    isDraggingTimelineItem: ref(false),
    isMediaLoading: ref(true),
    isCapturingThumbnail: ref(false),
    videoDuration: ref(0),
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

type FakeSession = ReturnType<typeof makeSession> & {
  flaggedSegments?: Ref<FlaggedSegment[]>;
};

describe('Preview Projection', () => {
  let session: FakeSession;
  let bridge: MockPlayerBridge;
  let frames: Array<() => void>;
  let projection: PreviewProjection | null;

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

  function create() {
    projection = createPreviewProjection(
      session as unknown as PreviewSessionSource,
      bridge,
      {
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

    it('reads source dimensions and fallback duration from REMOTION_MEDIA_METADATA', () => {
      create();
      expect(lastPayload().sourceWidth).toBe(1920);
      expect(lastPayload().sourceHeight).toBe(1080);
      bridge.calls = [];

      bridge.emitMessage({
        type: 'REMOTION_MEDIA_METADATA',
        width: 1280,
        height: 720,
        duration: 42.5
      });
      runFrame();

      expect(lastPayload()).toEqual(
        expect.objectContaining({ sourceWidth: 1280, sourceHeight: 720 })
      );
      expect(session.videoDuration.value).toBe(42.5);

      // Re-emitting identical dimensions with invalid duration does not dirty framing
      bridge.calls = [];
      bridge.emitMessage({
        type: 'REMOTION_MEDIA_METADATA',
        width: 1280,
        height: 720,
        duration: 0
      });
      runFrame();
      expect(updates()).toHaveLength(0);
      expect(session.videoDuration.value).toBe(42.5);
    });

    it('projects auto-adaptive subtitle settings into Remotion style props', async () => {
      create();
      bridge.calls = [];

      session.autoAdaptiveSubtitles.value = false;
      session.subtitlePosition.value = 'bottom';
      session.subtitleOffset.value = 110;
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({
          autoAdaptiveSubtitles: false,
          position: 'bottom',
          subtitleOffset: 110
        })
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

    it('ignores unrelated contentAudit changes when session.flaggedSegments is provided', async () => {
      const flaggedSegments = ref<FlaggedSegment[]>([
        { start: 1, duration: 0.5, word: 'kill', text: 'kill' }
      ]);
      session.flaggedSegments = flaggedSegments;

      create();
      expect(lastPayload().censoredSegments).toEqual([]);
      bridge.calls = [];

      // Unrelated contentAudit object churn (e.g. layout score slider change) must not dirty censorship slice
      session.contentAudit.value = {
        score: 85,
        flaggedSegments: flaggedSegments.value
      };
      await settle();
      expect(updates()).toHaveLength(0);

      // Updating flaggedSegments with bleeping enabled DOES project merged segments
      session.audioBleepEnabled.value = true;
      flaggedSegments.value = [
        { start: 1, duration: 0.5, word: 'kill', text: 'kill' },
        { start: 4, duration: 0.4, word: 'bad', text: 'bad' }
      ];
      await settle();
      expect(lastPayload()).toEqual(
        expect.objectContaining({
          censoredSegments: [
            { start: 1, duration: 0.5 },
            { start: 4, duration: 0.4 }
          ]
        })
      );
    });

    it('projects flaggedSegments when contentAudit is omitted from the session', async () => {
      const asSource = (
        s: Omit<PreviewSessionSource, 'contentAudit'>
      ): PreviewSessionSource => s;
      const flaggedSegments = ref<FlaggedSegment[]>([
        { start: 2, duration: 0.75, word: 'kill', text: 'kill' }
      ]);
      const sessionWithoutAudit: Omit<FakeSession, 'contentAudit'> &
        Partial<Pick<FakeSession, 'contentAudit'>> = {
        ...session,
        flaggedSegments
      };
      delete sessionWithoutAudit.contentAudit;

      projection = createPreviewProjection(
        asSource(
          sessionWithoutAudit as unknown as Omit<
            PreviewSessionSource,
            'contentAudit'
          >
        ),
        bridge,
        {
          scheduleFrame: cb => frames.push(cb),
          cancelFrame: () => {
            frames = [];
          },
          now: () => 1234
        }
      );

      sessionWithoutAudit.audioBleepEnabled.value = true;
      await settle();

      expect(lastPayload()).toEqual(
        expect.objectContaining({
          censoredSegments: [{ start: 2, duration: 0.75 }]
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

    it('clears isMediaLoading on REMOTION_MEDIA_READY even on clip switches', () => {
      create();
      expect(session.isMediaLoading.value).toBe(true);

      bridge.emitMessage({ type: 'IFRAME_READY' });
      expect(session.isMediaLoading.value).toBe(false);

      // Simulate switching to a new clip while Remotion Player stays mounted
      session.isMediaLoading.value = true;
      session.videoUrl.value = 'http://localhost:8765/assets/next-clip.mp4';
      bridge.emitMessage({ type: 'REMOTION_MEDIA_READY' });

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
      bridge.emitMessage({ type: 'REMOTION_MEDIA_READY' });

      expect(bridge.calls).toEqual([]);
    });
  });
});
