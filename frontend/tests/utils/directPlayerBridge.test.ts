import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import {
  DirectPlayerBridge,
  type PreviewPlayer
} from '../../app/utils/playerBridge';
import {
  createPreviewProjection,
  type PreviewSessionSource
} from '../../app/utils/previewProjection';

describe('DirectPlayerBridge Unit Tests', () => {
  let bridge: DirectPlayerBridge;
  let mockPlayer: PreviewPlayer & {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
    getCurrentFrame: ReturnType<typeof vi.fn>;
    isPlaying: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let playerListeners: Record<string, (e?: any) => void>;

  beforeEach(() => {
    playerListeners = {};
    mockPlayer = {
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentFrame: vi.fn().mockReturnValue(120),
      isPlaying: vi.fn().mockReturnValue(true),
      addEventListener: vi.fn((event: string, cb: (e?: any) => void) => {
        playerListeners[event] = cb;
      }),
      removeEventListener: vi.fn((event: string) => {
        delete playerListeners[event];
      })
    };
    bridge = new DirectPlayerBridge();
  });

  describe('Player Reference Resolution & Binding', () => {
    it('initializes with null player and resolves to null safely', () => {
      expect(bridge.getPlayer()).toBeNull();
      expect(() => {
        bridge.play();
        bridge.pause();
        bridge.seek(100);
      }).not.toThrow();
    });

    it('binds to a React-style ref object ({ current: player })', () => {
      const reactRef = { current: mockPlayer };
      bridge.bindPlayer(reactRef);
      expect(bridge.getPlayer()).toBe(mockPlayer);

      bridge.play();
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('binds to a Vue-style ref object ({ value: player })', () => {
      const vueRef = { value: mockPlayer };
      bridge.bindPlayer(vueRef);
      expect(bridge.getPlayer()).toBe(mockPlayer);

      bridge.pause();
      expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    });

    it('binds to direct player object instance', () => {
      bridge.bindPlayer(mockPlayer);
      expect(bridge.getPlayer()).toBe(mockPlayer);

      bridge.seek(300);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(300);
    });

    it('accepts player ref in constructor', () => {
      const ctorBridge = new DirectPlayerBridge({ current: mockPlayer });
      expect(ctorBridge.getPlayer()).toBe(mockPlayer);
      ctorBridge.play();
      expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    });

    it('queries getCurrentFrame and isPlaying when available', () => {
      bridge.bindPlayer(mockPlayer);
      expect(bridge.getCurrentFrame()).toBe(120);
      expect(bridge.isPlaying()).toBe(true);

      const emptyBridge = new DirectPlayerBridge();
      expect(emptyBridge.getCurrentFrame()).toBeNull();
      expect(emptyBridge.isPlaying()).toBeNull();
    });
  });

  describe('attachPlayer Lifecycle & Event Forwarding', () => {
    it('binds player before emitting IFRAME_READY so ready handlers can seek immediately', () => {
      let playerDuringReady: PreviewPlayer | null = null;
      bridge.onMessage(event => {
        if (event.type === 'IFRAME_READY') {
          playerDuringReady = bridge.getPlayer();
          bridge.seek(42);
        }
      });

      const detach = bridge.attachPlayer(mockPlayer);

      expect(playerDuringReady).toBe(mockPlayer);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(42);

      detach();
      expect(bridge.getPlayer()).toBeNull();
      expect(mockPlayer.removeEventListener).toHaveBeenCalledTimes(3);
    });

    it('forwards frameupdate using live fps from currentProps, pause, and ended', () => {
      const events: any[] = [];
      bridge.onMessage(e => events.push(e));
      bridge.updateProps({ fps: 60 });

      bridge.attachPlayer(mockPlayer);
      events.length = 0; // clear IFRAME_READY

      playerListeners.frameupdate?.({ detail: { frame: 150 } });
      playerListeners.pause?.();
      playerListeners.ended?.();

      expect(events).toEqual([
        { type: 'REMOTION_TIMEUPDATE', currentTime: 2.5, frame: 150 },
        { type: 'REMOTION_PAUSED' },
        { type: 'REMOTION_ENDED' }
      ]);
    });
  });

  describe('Props Management & External Store Contract', () => {
    it('returns a stable empty snapshot before any updateProps call', () => {
      const first = bridge.getPropsSnapshot();
      const second = bridge.getPropsSnapshot();
      expect(first).toBe(second);
      expect(first).toEqual({});
    });

    it('synchronously updates snapshot, notifies subscribeProps, and does not echo UPDATE_PROPS on onMessage', () => {
      const propsSpy = vi.fn();
      const messageSpy = vi.fn();

      const unsubProps = bridge.subscribeProps(propsSpy);
      const unsubMessage = bridge.onMessage(messageSpy);

      const testProps = {
        videoPath: 'https://localhost:8000/test.mp4',
        durationInFrames: 600,
        volume: 0.75
      };

      bridge.updateProps(testProps);

      expect(bridge.currentProps).toEqual(testProps);
      expect(bridge.getPropsSnapshot()).toEqual(testProps);
      expect(propsSpy).toHaveBeenCalledTimes(1);
      expect(messageSpy).not.toHaveBeenCalled();

      unsubProps();
      unsubMessage();
      bridge.updateProps({ volume: 0.2 });
      expect(propsSpy).toHaveBeenCalledTimes(1);
    });

    it('skips allocation and listener notification when patch values are identical by Object.is', () => {
      const cropMap = [{ time: 0, x: 500 }];
      bridge.updateProps({ volume: 0.8, cropMap });
      const prevSnapshot = bridge.getPropsSnapshot();

      const propsSpy = vi.fn();
      bridge.subscribeProps(propsSpy);

      // Identical primitive and identical reference -> no-op
      bridge.updateProps({ volume: 0.8, cropMap });

      expect(propsSpy).not.toHaveBeenCalled();
      expect(bridge.getPropsSnapshot()).toBe(prevSnapshot);
    });

    it('merges partial props updates without overwriting unrelated keys', () => {
      const fullProps = {
        videoPath: 'https://localhost:8000/video.mp4',
        durationInFrames: 300,
        fps: 30,
        words: [{ word: 'test', start: 0, end: 1 }],
        volume: 0.8
      };

      bridge.updateProps(fullProps);
      expect(bridge.currentProps).toEqual(fullProps);

      bridge.updateProps({ volume: 0.5 });

      expect(bridge.currentProps?.videoPath).toBe(
        'https://localhost:8000/video.mp4'
      );
      expect(bridge.currentProps?.words).toHaveLength(1);
      expect(bridge.currentProps?.durationInFrames).toBe(300);
      expect(bridge.currentProps?.fps).toBe(30);
      expect(bridge.currentProps?.volume).toBe(0.5);
    });
  });

  describe('Remotion Event Notifications & Emitters', () => {
    it('emits time updates matching REMOTION_TIMEUPDATE contract', () => {
      const listener = vi.fn();
      bridge.onMessage(listener);

      bridge.emitTimeUpdate(5.25, 157);
      expect(listener).toHaveBeenCalledWith({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 5.25,
        frame: 157
      });
    });

    it('emits pause, ended, and ready lifecycle events', () => {
      const listener = vi.fn();
      bridge.onMessage(listener);

      bridge.emitPaused();
      expect(listener).toHaveBeenCalledWith({ type: 'REMOTION_PAUSED' });

      bridge.emitEnded();
      expect(listener).toHaveBeenCalledWith({ type: 'REMOTION_ENDED' });

      bridge.emitReady();
      expect(listener).toHaveBeenCalledWith({ type: 'IFRAME_READY' });
    });
  });

  describe('Lifecycle Cleanup (destroy)', () => {
    it('resets player binding and clears all message and props listeners', () => {
      const propsListener = vi.fn();
      const messageListener = vi.fn();

      bridge.bindPlayer(mockPlayer);
      bridge.subscribeProps(propsListener);
      bridge.onMessage(messageListener);

      bridge.destroy();

      expect(bridge.getPlayer()).toBeNull();
      expect(bridge.currentProps).toBeNull();

      bridge.updateProps({ volume: 0.1 });
      bridge.emitReady();
      bridge.play();

      expect(propsListener).not.toHaveBeenCalled();
      expect(messageListener).not.toHaveBeenCalled();
      expect(mockPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe('Integration with createPreviewProjection', () => {
    it('projects initial props and seeks player when attachPlayer fires IFRAME_READY', () => {
      const session = {
        currentTime: ref(4),
        isPlaying: ref(false),
        isTimelineShifting: ref(false),
        isDraggingTimelineItem: ref(false),
        isMediaLoading: ref(true),
        isCapturingThumbnail: ref(false),
        useNativePlayer: ref(false),
        videoUrl: ref<string | null>('http://localhost:8765/assets/video.mp4'),
        outputUrl: ref<string | null>(null),
        videoFps: ref(30),
        timelineDuration: ref(30),
        timelineTracks: ref<any[]>([]),
        coverEnabled: ref(false),
        coverDuration: ref(1),
        volume: ref(0.8),
        fullTranscript: ref<any[]>([]),
        subtitleMode: ref('word'),
        subtitleSyncOffset: ref(0),
        subtitlesEnabled: ref(true),
        showIframeDebug: ref(false),
        activeHook: ref(null),
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
        subtitleStrokeWidth: ref(4),
        subtitleTextTransform: ref('uppercase'),
        subtitleAnimation: ref('pop'),
        subtitleHighlightMode: ref('color'),
        subtitleBackground: ref('none'),
        subtitleBackgroundOpacity: ref(0.7),
        subtitleWordSpacing: ref(0),
        cropMode: ref('manual'),
        cropMap: ref<any[]>([]),
        cropPercentX: ref(50),
        cropPercentXTop: ref(50),
        cropPercentXBottom: ref(50),
        splitZoomTop: ref(1),
        splitZoomBottom: ref(1),
        splitOffsetXTop: ref(0),
        splitOffsetYTop: ref(0),
        splitOffsetXBottom: ref(0),
        splitOffsetYBottom: ref(0),
        audioBleepEnabled: ref(false),
        audioBleepSource: ref('default'),
        customBleepFile: ref(null),
        contentAudit: ref({ flaggedSegments: [] })
      } as unknown as PreviewSessionSource;

      const projection = createPreviewProjection(session, bridge);
      const detach = bridge.attachPlayer(mockPlayer);

      expect(session.isMediaLoading.value).toBe(false);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(120);

      detach();
      projection.dispose();
    });
  });
});
