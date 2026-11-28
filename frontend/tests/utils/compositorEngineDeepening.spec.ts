import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const EnvState = {
  fps: 30,
  durationInFrames: 900,
  isRendering: false
};

const useVideoConfigSpy = vi.fn(() => ({
  fps: EnvState.fps,
  width: 1080,
  height: 1920,
  durationInFrames: EnvState.durationInFrames
}));

const FrameContext = React.createContext<number>(0);
const staticFileSpy = vi.fn((p: string) => p);
const getFontSpy = vi.fn();
const capturedOnVideoFrames: Array<
  ((frame: CanvasImageSource) => void) | undefined
> = [];

vi.mock('../../../shared/remotion/src/fonts', async () => {
  const actual = await vi.importActual<
    typeof import('../../../shared/remotion/src/fonts')
  >('../../../shared/remotion/src/fonts');
  return {
    ...actual,
    getFont: (name: string) => {
      getFontSpy(name);
      return actual.getFont(name);
    }
  };
});

vi.mock('@remotion/google-fonts/Montserrat', () => ({
  loadFont: () => ({ fontFamily: 'Montserrat' })
}));
vi.mock('@remotion/google-fonts/Outfit', () => ({
  loadFont: () => ({ fontFamily: 'Outfit' })
}));
vi.mock('@remotion/google-fonts/Poppins', () => ({
  loadFont: () => ({ fontFamily: 'Poppins' })
}));
vi.mock('@remotion/google-fonts/Oswald', () => ({
  loadFont: () => ({ fontFamily: 'Oswald' })
}));
vi.mock('@remotion/google-fonts/NotoSans', () => ({
  loadFont: () => ({ fontFamily: 'Noto Sans' })
}));
vi.mock('@remotion/google-fonts/PlusJakartaSans', () => ({
  loadFont: () => ({ fontFamily: 'Plus Jakarta Sans' })
}));
vi.mock('@remotion/google-fonts/SpaceGrotesk', () => ({
  loadFont: () => ({ fontFamily: 'Space Grotesk' })
}));
vi.mock('@remotion/google-fonts/Bangers', () => ({
  loadFont: () => ({ fontFamily: 'Bangers' })
}));

vi.mock('remotion', () => {
  const ReactLib = React;
  return {
    registerRoot: vi.fn(),
    Composition: () => null,
    staticFile: (p: string) => staticFileSpy(p),
    delayRender: () => 1,
    continueRender: vi.fn(),
    spring: () => 1,
    interpolate: (_v: number, _i: number[], out: number[]) =>
      Array.isArray(out) ? (out[0] ?? 0) : 0,
    useCurrentFrame: () => ReactLib.useContext(FrameContext),
    useVideoConfig: () => useVideoConfigSpy(),
    useRemotionEnvironment: () => ({
      isRendering: EnvState.isRendering,
      isStudio: false,
      isPlayer: !EnvState.isRendering
    }),
    AbsoluteFill: ({
      children,
      style
    }: {
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) =>
      ReactLib.createElement(
        'div',
        {
          'data-abs-fill': 'true',
          'data-z-index': String(style?.zIndex ?? ''),
          style: { position: 'absolute', inset: 0, ...style }
        },
        children
      ),
    Sequence: ({
      from = 0,
      durationInFrames = Infinity,
      premountFor = 0,
      layout,
      name,
      children,
      style
    }: {
      from?: number;
      durationInFrames?: number;
      premountFor?: number;
      layout?: 'absolute-fill' | 'none';
      name?: string;
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) => {
      if (durationInFrames !== Infinity && durationInFrames <= 0) {
        throw new TypeError('durationInFrames must be positive');
      }
      if (layout === 'none' && style) {
        throw new Error('style cannot be passed when layout="none"');
      }
      const parentFrame = ReactLib.useContext(FrameContext);
      const isPremounted =
        premountFor > 0 &&
        parentFrame >= from - premountFor &&
        parentFrame < from;
      const relFrame = isPremounted ? 0 : parentFrame - from;
      if (!isPremounted && (relFrame < 0 || relFrame >= durationInFrames)) {
        return null;
      }
      const wrapperProps: Record<string, unknown> = {
        'data-sequence-name': name ?? '',
        'data-from': String(from),
        'data-duration': Number.isFinite(durationInFrames)
          ? String(durationInFrames)
          : '',
        'data-layout': layout ?? '',
        'data-premounted': isPremounted ? 'true' : 'false'
      };
      if (layout !== 'none') {
        wrapperProps.style = {
          position: 'absolute',
          inset: 0,
          ...style,
          ...(isPremounted ? { opacity: 0, pointerEvents: 'none' } : {})
        };
      }
      return ReactLib.createElement(
        FrameContext.Provider,
        { value: relFrame },
        ReactLib.createElement('div', wrapperProps, children)
      );
    },
    Video: ReactLib.forwardRef(
      (
        {
          src,
          volume,
          startFrom,
          endAt,
          style
        }: {
          src?: string;
          volume?: number | ((f: number) => number);
          startFrom?: number;
          endAt?: number;
          style?: React.CSSProperties;
        },
        ref: React.Ref<HTMLVideoElement>
      ) => {
        const relFrame = ReactLib.useContext(FrameContext);
        const resolvedVolume =
          typeof volume === 'function' ? volume(relFrame) : (volume ?? 1);
        return ReactLib.createElement('video', {
          ref,
          src,
          'data-remotion-video': 'true',
          'data-start-from': startFrom ?? 0,
          'data-end-at': endAt ?? '',
          'data-resolved-volume': String(resolvedVolume),
          style
        });
      }
    ),
    OffthreadVideo: ({
      src,
      volume,
      startFrom = 0,
      onVideoFrame,
      style
    }: {
      src?: string;
      volume?: number | ((f: number) => number);
      startFrom?: number;
      onVideoFrame?: (frame: CanvasImageSource) => void;
      style?: React.CSSProperties;
    }) => {
      capturedOnVideoFrames.push(onVideoFrame);
      const relFrame = ReactLib.useContext(FrameContext);
      const mediaTime = ((startFrom || 0) + relFrame) / EnvState.fps;
      const resolvedVolume =
        typeof volume === 'function' ? volume(relFrame) : (volume ?? 1);
      return ReactLib.createElement('div', {
        'data-offthread-video': 'true',
        'data-src': src ?? '',
        'data-media-time': String(mediaTime),
        'data-resolved-volume': String(resolvedVolume),
        'data-has-on-video-frame': onVideoFrame ? 'true' : 'false',
        'data-transform': style?.transform ?? '',
        style
      });
    },
    Audio: ({
      src,
      loop,
      volume
    }: {
      src?: string;
      loop?: boolean;
      volume?: number | ((f: number) => number);
    }) => {
      const relFrame = ReactLib.useContext(FrameContext);
      const resolvedVolume =
        typeof volume === 'function' ? volume(relFrame) : (volume ?? 1);
      return ReactLib.createElement('audio', {
        'data-remotion-audio': 'true',
        src: src ?? '',
        'data-loop': loop ? 'true' : 'false',
        'data-volume': String(resolvedVolume)
      });
    },
    Img: () => null
  };
});

import {
  YonruClip,
  CanvasVideoCompositor,
  computeLandscapeBlurSpec,
  drawLandscapeBlurFrame,
  type YonruClipProps
} from '@yonru/remotion';

interface MockCanvas2DContext {
  save: ReturnType<typeof vi.fn>;
  restore: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  fillStyle: string;
  filter: string;
  imageSmoothingEnabled: boolean;
}

function createCanvasContextTracker() {
  const contextsByCanvas = new Map<HTMLCanvasElement, MockCanvas2DContext>();
  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function (this: HTMLCanvasElement) {
      let ctx = contextsByCanvas.get(this);
      if (!ctx) {
        ctx = {
          save: vi.fn(),
          restore: vi.fn(),
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          fillStyle: '#000000',
          filter: 'none',
          imageSmoothingEnabled: false
        };
        contextsByCanvas.set(this, ctx);
      }
      return ctx as unknown as CanvasRenderingContext2D;
    });

  return { contextsByCanvas, getContextSpy };
}

function configureMockVideo(
  video: HTMLVideoElement,
  {
    currentTime,
    paused = true,
    readyState = 4,
    seeking = false,
    duration = 30
  }: {
    currentTime: number;
    paused?: boolean;
    readyState?: number;
    seeking?: boolean;
    duration?: number;
  }
) {
  Object.defineProperty(video, 'readyState', {
    value: readyState,
    configurable: true
  });
  Object.defineProperty(video, 'videoWidth', {
    value: 1920,
    configurable: true
  });
  Object.defineProperty(video, 'videoHeight', {
    value: 1080,
    configurable: true
  });
  Object.defineProperty(video, 'seeking', {
    value: seeking,
    configurable: true
  });
  Object.defineProperty(video, 'paused', {
    value: paused,
    configurable: true
  });
  Object.defineProperty(video, 'duration', {
    value: duration,
    configurable: true
  });
  Object.defineProperty(video, 'currentTime', {
    value: currentTime,
    writable: true,
    configurable: true
  });
}

describe('Compositor Engine Deepening (Candidate #02)', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    EnvState.fps = 30;
    EnvState.durationInFrames = 900;
    EnvState.isRendering = false;
    useVideoConfigSpy.mockClear();
    staticFileSpy.mockClear();
    getFontSpy.mockClear();
    capturedOnVideoFrames.length = 0;
  });

  it('isolates useCurrentFrame to leaf layers so YonruClip does not re-render across frames', () => {
    const { getContextSpy } = createCanvasContextTracker();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let setFrameFn: ((f: number) => void) | null = null;
    const StatefulFrameWrapper: React.FC<{ children: React.ReactNode }> = ({
      children
    }) => {
      const [frame, setFrame] = React.useState(0);
      setFrameFn = setFrame;
      return React.createElement(
        FrameContext.Provider,
        { value: frame },
        children
      );
    };

    const clipElement = React.createElement(YonruClip, {
      videoPath: 'http://localhost/clip.mp4',
      words: [],
      cropX: 960,
      position: 'bottom',
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: true,
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 10, mediaStart: 0 }]
    });

    try {
      act(() => {
        root.render(
          React.createElement(StatefulFrameWrapper, null, clipElement)
        );
      });

      expect(useVideoConfigSpy).toHaveBeenCalledTimes(1);

      for (let f = 1; f <= 10; f++) {
        act(() => {
          setFrameFn!(f);
        });
      }

      // YonruClip mounted once and never re-rendered across frames 1..10
      expect(useVideoConfigSpy).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('updates AdaptiveSubtitleLayer and ActiveTextOverlays across frame windows and split transitions', () => {
    const { getContextSpy } = createCanvasContextTracker();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let setFrameFn: ((f: number) => void) | null = null;
    const StatefulFrameWrapper: React.FC<{ children: React.ReactNode }> = ({
      children
    }) => {
      const [frame, setFrame] = React.useState(0);
      setFrameFn = setFrame;
      return React.createElement(
        FrameContext.Provider,
        { value: frame },
        children
      );
    };

    const clipElement = React.createElement(YonruClip, {
      videoPath: 'http://localhost/clip.mp4',
      words: [{ start: 0, end: 10, word: 'HELLO WORLD' }],
      cropX: 960,
      cropMap: [
        { time: 0, x: 960, mode: 'single' },
        { time: 2, x: 960, mode: 'split', top_x: 400, bottom_x: 1400 }
      ],
      position: 'bottom',
      subtitleOffset: 100,
      autoAdaptiveSubtitles: true,
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: false,
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 10, mediaStart: 0 }],
      timelineTextItems: [
        {
          id: 't1',
          content: 'INTRO CARD',
          start: 1,
          duration: 2,
          x: 100,
          y: 200
        }
      ]
    });

    try {
      act(() => {
        root.render(
          React.createElement(StatefulFrameWrapper, null, clipElement)
        );
      });

      const getSubJustify = () =>
        (container.querySelector('[data-z-index="20"]') as HTMLElement | null)
          ?.style.justifyContent ?? '';

      // Frame 0 (0.0s): single framing (flex-end), text overlay inactive
      expect(getSubJustify()).toBe('flex-end');
      expect(container.textContent).not.toContain('INTRO CARD');

      // Frame 45 (1.5s): text overlay active, still single framing
      act(() => setFrameFn!(45));
      expect(getSubJustify()).toBe('flex-end');
      expect(container.textContent).toContain('INTRO CARD');

      // Frame 75 (2.5s): split framing (center), text overlay still active
      act(() => setFrameFn!(75));
      expect(getSubJustify()).toBe('center');
      expect(container.textContent).toContain('INTRO CARD');

      // Frame 100 (3.33s): text overlay expired
      act(() => setFrameFn!(100));
      expect(getSubJustify()).toBe('center');
      expect(container.textContent).not.toContain('INTRO CARD');
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('emits zero console.log calls during preview and headless rendering across frame ticks', () => {
    const { getContextSpy } = createCanvasContextTracker();
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const props: YonruClipProps = {
      videoPath: 'http://localhost/clip.mp4',
      words: [{ start: 0, end: 5, word: 'TEST' }],
      cropX: 960,
      position: 'bottom',
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 5, mediaStart: 0 }]
    };

    try {
      for (const isRendering of [false, true]) {
        EnvState.isRendering = isRendering;
        for (const frame of [0, 1, 30]) {
          act(() => {
            root.render(
              React.createElement(
                FrameContext.Provider,
                { value: frame },
                React.createElement(YonruClip, props)
              )
            );
          });
        }
      }

      expect(consoleLogSpy).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      container.remove();
      consoleLogSpy.mockRestore();
      getContextSpy.mockRestore();
    }
  });

  it('renders landscape blur on a cached 1/8-scale offscreen canvas without applying ctx.filter to the 1080x1920 main canvas', () => {
    const { contextsByCanvas, getContextSpy } = createCanvasContextTracker();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const renderCompositor = (frame: number) => {
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: frame },
            React.createElement(CanvasVideoCompositor, {
              videoSrc: 'http://localhost/landscape.mp4',
              volume: 1,
              fps: 30,
              CONTAINER_W: 1080,
              CONTAINER_H: 1920,
              PANEL_H: 960,
              isLandscape: true,
              landscapeBackground: 'blur',
              landscapeBlurRadius: 25,
              landscapeDarkness: 40,
              videoDisplayW: 1080,
              videoDisplayH: 607.5,
              rawSourceW: 1920,
              sourceHeight: 1080
            })
          )
        );
      });
    };

    try {
      renderCompositor(0);
      const video = container.querySelector('video') as HTMLVideoElement;
      const mainCanvas = container.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;
      configureMockVideo(video, { currentTime: 0, paused: true });

      // Clear and draw frame 0 via seeked
      const mainCtx = contextsByCanvas.get(mainCanvas)!;
      mainCtx.drawImage.mockClear();
      mainCtx.fillRect.mockClear();

      act(() => {
        video.dispatchEvent(new Event('seeked'));
      });

      // Only 2 canvases ever requested a 2D context: main + cached 1/8 blur canvas
      expect(getContextSpy).toHaveBeenCalledTimes(2);
      expect(contextsByCanvas.size).toBe(2);

      const offscreenEntry = Array.from(contextsByCanvas.entries()).find(
        ([el]) => el !== mainCanvas
      );
      expect(offscreenEntry).toBeDefined();
      const [blurCanvas, blurCtx] = offscreenEntry!;

      // 1/8 dimensions (135x240) and proportionally scaled blur radius round(25 / 8) = 3px
      expect(blurCanvas.width).toBe(135);
      expect(blurCanvas.height).toBe(240);
      expect(blurCtx.filter).toBe('blur(3px)');
      expect(mainCtx.filter).toBe('none');
      expect(mainCtx.imageSmoothingEnabled).toBe(true);

      // Blur canvas received the video draw; main canvas composited blurCanvas -> dimming fillRect -> sharp video
      expect(blurCtx.drawImage).toHaveBeenCalledTimes(1);
      expect(blurCtx.drawImage.mock.calls[0]?.[0]).toBe(video);

      expect(mainCtx.drawImage).toHaveBeenCalledTimes(2);
      expect(mainCtx.drawImage.mock.calls[0]).toEqual([
        blurCanvas,
        0,
        0,
        135,
        240,
        0,
        0,
        1080,
        1920
      ]);
      expect(mainCtx.drawImage.mock.calls[1]?.[0]).toBe(video);
      expect(mainCtx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920);

      // Advance frames 1, 2, 3: cached offscreen canvas & context are reused without extra getContext calls
      for (const f of [1, 2, 3]) {
        video.currentTime = f / 30;
        renderCompositor(f);
      }

      expect(getContextSpy).toHaveBeenCalledTimes(2);
      expect(mainCtx.filter).toBe('none');
      expect(blurCtx.drawImage).toHaveBeenCalledTimes(4);
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('skips retention blits during continuous playback and snapshots once on cut unmount or deactivation', () => {
    const { contextsByCanvas, getContextSpy } = createCanvasContextTracker();
    const origRVFC = (HTMLVideoElement.prototype as any)
      .requestVideoFrameCallback;
    const origCancelRVFC = (HTMLVideoElement.prototype as any)
      .cancelVideoFrameCallback;

    const rVfcCallbacks = new Map<
      HTMLVideoElement,
      (now: number, metadata: { mediaTime: number }) => void
    >();
    let nextCbId = 1;
    (HTMLVideoElement.prototype as any).requestVideoFrameCallback = function (
      this: HTMLVideoElement,
      cb: (now: number, metadata: { mediaTime: number }) => void
    ) {
      rVfcCallbacks.set(this, cb);
      return nextCbId++;
    };
    (HTMLVideoElement.prototype as any).cancelVideoFrameCallback = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const jumpCutItems = [
      { id: 'block-1', start: 0, duration: 5, mediaStart: 0 },
      { id: 'block-2', start: 5, duration: 5, mediaStart: 8 }
    ];

    const renderAtFrame = (frame: number) => {
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: frame },
            React.createElement(YonruClip, {
              videoPath: 'http://localhost/clip.mp4',
              words: [],
              cropX: 960,
              position: 'bottom',
              fps: 30,
              sourceWidth: 1920,
              sourceHeight: 1080,
              hideSubtitles: true,
              timelineVideoItems: jumpCutItems
            })
          )
        );
      });
    };

    try {
      // Frame 145: block-1 active, block-2 premounted
      renderAtFrame(145);

      const retentionCanvas = container.querySelector(
        '[data-testid="timeline-retention-canvas"]'
      ) as HTMLCanvasElement;
      const retentionCtx = contextsByCanvas.get(retentionCanvas)!;
      const block1Seq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-1"]'
      ) as HTMLElement;
      const block1Video = block1Seq.querySelector('video') as HTMLVideoElement;
      const block1Canvas = block1Seq.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;
      const block1Ctx = contextsByCanvas.get(block1Canvas)!;

      configureMockVideo(block1Video, {
        currentTime: 145 / 30,
        paused: false
      });

      const onFrameBlock1 = rVfcCallbacks.get(block1Video);
      expect(onFrameBlock1).toBeDefined();

      // 5 consecutive continuous playback ticks -> compositor paints 5 times, 0 retention blits
      retentionCtx.drawImage.mockClear();
      block1Ctx.drawImage.mockClear();
      for (let i = 0; i < 5; i++) {
        act(() => {
          onFrameBlock1!(performance.now(), { mediaTime: (145 + i) / 30 });
        });
      }
      expect(block1Ctx.drawImage).toHaveBeenCalledTimes(5);
      expect(retentionCtx.drawImage).not.toHaveBeenCalled();

      // Cross cut boundary to frame 150 (block-1 unmounts, block-2 activates)
      renderAtFrame(150);
      expect(retentionCtx.drawImage).toHaveBeenCalledTimes(1);
      expect(retentionCtx.drawImage).toHaveBeenCalledWith(
        block1Canvas,
        0,
        0,
        1080,
        1920
      );
      expect(retentionCanvas.style.opacity).toBe('1');

      // Now block-2 is active and playing; paint a valid frame via rVFC -> 0 retention blits
      const block2Seq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-2"]'
      ) as HTMLElement;
      const block2Video = block2Seq.querySelector('video') as HTMLVideoElement;
      const block2Canvas = block2Seq.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;
      configureMockVideo(block2Video, { currentTime: 8.0, paused: false });
      retentionCtx.drawImage.mockClear();
      const onFrameBlock2 = rVfcCallbacks.get(block2Video);
      act(() => {
        onFrameBlock2!(performance.now(), { mediaTime: 8.1 });
      });
      expect(retentionCtx.drawImage).not.toHaveBeenCalled();

      // Scrub backward into block-2's premount window (frame 140): block-2 stays mounted,
      // deactivates (isActive: true -> false), and snapshots once onto retentionCanvas
      renderAtFrame(140);
      expect(retentionCtx.drawImage).toHaveBeenCalledTimes(1);
      expect(retentionCtx.drawImage).toHaveBeenCalledWith(
        block2Canvas,
        0,
        0,
        1080,
        1920
      );
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
      if (origRVFC === undefined) {
        delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback;
      } else {
        (HTMLVideoElement.prototype as any).requestVideoFrameCallback =
          origRVFC;
      }
      if (origCancelRVFC === undefined) {
        delete (HTMLVideoElement.prototype as any).cancelVideoFrameCallback;
      } else {
        (HTMLVideoElement.prototype as any).cancelVideoFrameCallback =
          origCancelRVFC;
      }
    }
  });

  it('gates premounted CanvasVideoCompositor after priming 1 frame and refreshes on activation', () => {
    const { contextsByCanvas, getContextSpy } = createCanvasContextTracker();
    const origRVFC = (HTMLVideoElement.prototype as any)
      .requestVideoFrameCallback;
    const origCancelRVFC = (HTMLVideoElement.prototype as any)
      .cancelVideoFrameCallback;

    const rVfcCallbacks = new Map<
      HTMLVideoElement,
      (now: number, metadata: { mediaTime: number }) => void
    >();
    let nextCbId = 1;
    (HTMLVideoElement.prototype as any).requestVideoFrameCallback = function (
      this: HTMLVideoElement,
      cb: (now: number, metadata: { mediaTime: number }) => void
    ) {
      rVfcCallbacks.set(this, cb);
      return nextCbId++;
    };
    (HTMLVideoElement.prototype as any).cancelVideoFrameCallback = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const jumpCutItems = [
      { id: 'block-1', start: 0, duration: 5, mediaStart: 0 },
      { id: 'block-2', start: 5, duration: 5, mediaStart: 8 }
    ];

    const renderAtFrame = (frame: number) => {
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: frame },
            React.createElement(YonruClip, {
              videoPath: 'http://localhost/clip.mp4',
              words: [],
              cropX: 960,
              position: 'bottom',
              fps: 30,
              sourceWidth: 1920,
              sourceHeight: 1080,
              hideSubtitles: true,
              timelineVideoItems: jumpCutItems
            })
          )
        );
      });
    };

    try {
      // Frame 130: block-2 is premounted (isActive = false)
      renderAtFrame(130);

      const retentionCanvas = container.querySelector(
        '[data-testid="timeline-retention-canvas"]'
      ) as HTMLCanvasElement;
      const retentionCtx = contextsByCanvas.get(retentionCanvas)!;
      const premountedSeq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-2"]'
      ) as HTMLElement;
      expect(premountedSeq.getAttribute('data-premounted')).toBe('true');

      const block2Video = premountedSeq.querySelector(
        'video'
      ) as HTMLVideoElement;
      const block2Canvas = premountedSeq.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;
      const block2Ctx = contextsByCanvas.get(block2Canvas)!;

      // Aligned seek paints 1 initial frame on block-2 with zero retention blits
      configureMockVideo(block2Video, { currentTime: 8.0, paused: false });
      act(() => {
        block2Video.dispatchEvent(new Event('seeked'));
      });
      expect(block2Canvas.style.opacity).toBe('1');
      expect(block2Ctx.drawImage).toHaveBeenCalledTimes(1);
      expect(retentionCtx.drawImage).not.toHaveBeenCalled();

      // Additional rVFC, timeupdate, seeked, and frame ticks while premounted perform 0 extra draws
      block2Ctx.drawImage.mockClear();
      const onFrameBlock2 = rVfcCallbacks.get(block2Video);
      act(() => {
        onFrameBlock2?.(performance.now(), { mediaTime: 8.03 });
        block2Video.dispatchEvent(new Event('timeupdate'));
        block2Video.dispatchEvent(new Event('seeked'));
      });
      renderAtFrame(131);
      renderAtFrame(132);
      expect(block2Ctx.drawImage).not.toHaveBeenCalled();

      // Flip to active at frame 150 (while playing): refreshes immediately with 0 retention blits
      retentionCtx.drawImage.mockClear();
      renderAtFrame(150);
      expect(premountedSeq.getAttribute('data-premounted')).toBe('false');
      expect(block2Ctx.drawImage).toHaveBeenCalledTimes(1);
      expect(retentionCtx.drawImage).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
      if (origRVFC === undefined) {
        delete (HTMLVideoElement.prototype as any).requestVideoFrameCallback;
      } else {
        (HTMLVideoElement.prototype as any).requestVideoFrameCallback =
          origRVFC;
      }
      if (origCancelRVFC === undefined) {
        delete (HTMLVideoElement.prototype as any).cancelVideoFrameCallback;
      } else {
        (HTMLVideoElement.prototype as any).cancelVideoFrameCallback =
          origCancelRVFC;
      }
    }
  });

  it('resolves HeadlessMediaViewports media time internally when timelineVideoItems is empty', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    EnvState.isRendering = true;

    const props: YonruClipProps = {
      videoPath: 'http://localhost/clip.mp4',
      words: [],
      cropX: 960,
      cropMap: [
        { time: 0, x: 960, mode: 'single' },
        { time: 2, x: 960, mode: 'split', top_x: 400, bottom_x: 1400 }
      ],
      position: 'bottom',
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: true,
      timelineVideoItems: []
    };

    try {
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: 30 },
            React.createElement(YonruClip, props)
          )
        );
      });
      expect(
        container.querySelectorAll('[data-offthread-video="true"]')
      ).toHaveLength(1);

      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: 60 },
            React.createElement(YonruClip, props)
          )
        );
      });
      expect(
        container.querySelectorAll('[data-offthread-video="true"]')
      ).toHaveLength(2);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('computes 1/8-scale landscape blur geometry and reuses cached canvas context across source types', () => {
    const spec = computeLandscapeBlurSpec({
      containerWidth: 1080,
      containerHeight: 1920,
      sourceWidth: 1920,
      sourceHeight: 1080,
      blurRadius: 25
    });
    expect(spec.blurWidth).toBe(135);
    expect(spec.blurHeight).toBe(240);
    expect(spec.scaledBlurRadius).toBe(3);
    expect(spec.drawHeight).toBeCloseTo(240 * 1.08, 4);
    expect(spec.drawWidth).toBeCloseTo(240 * 1.08 * (16 / 9), 4);

    const { contextsByCanvas, getContextSpy } = createCanvasContextTracker();
    const blurCanvas = document.createElement('canvas');
    const mockImg = document.createElement('img');
    Object.defineProperty(mockImg, 'naturalWidth', {
      value: 1920,
      configurable: true
    });
    Object.defineProperty(mockImg, 'naturalHeight', {
      value: 1080,
      configurable: true
    });

    try {
      const first = drawLandscapeBlurFrame(blurCanvas, mockImg, {
        containerWidth: 1080,
        containerHeight: 1920,
        blurRadius: 25
      });
      expect(blurCanvas.width).toBe(135);
      expect(blurCanvas.height).toBe(240);
      expect(getContextSpy).toHaveBeenCalledTimes(1);
      const blurCtx = contextsByCanvas.get(blurCanvas)!;
      expect(first.ctx).toBe(blurCtx);
      expect(blurCtx.filter).toBe('blur(3px)');
      expect(blurCtx.drawImage).toHaveBeenCalledTimes(1);
      expect(blurCtx.drawImage.mock.calls[0]?.[0]).toBe(mockImg);

      // Zero-dimension image falls back cleanly without re-creating 2D context
      const zeroImg = document.createElement('img');
      const second = drawLandscapeBlurFrame(blurCanvas, zeroImg, {
        containerWidth: 1080,
        containerHeight: 1920,
        blurRadius: 25,
        fallbackSourceWidth: 1280,
        fallbackSourceHeight: 720,
        cachedCtx: first.ctx
      });
      expect(second.ctx).toBe(blurCtx);
      expect(getContextSpy).toHaveBeenCalledTimes(1);
      expect(blurCtx.drawImage).toHaveBeenCalledTimes(2);
      expect(blurCtx.drawImage.mock.calls[1]?.[3]).toBe(1280);
      expect(blurCtx.drawImage.mock.calls[1]?.[4]).toBe(720);
    } finally {
      getContextSpy.mockRestore();
    }
  });

  it('uses a single OffthreadVideo and 1/8-scale blur canvas in HeadlessMediaViewports with stable onVideoFrame callback', () => {
    const { contextsByCanvas, getContextSpy } = createCanvasContextTracker();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    EnvState.isRendering = true;

    const blurProps: YonruClipProps = {
      videoPath: 'http://localhost/landscape.mp4',
      words: [],
      cropX: 960,
      position: 'bottom',
      videoLayout: 'landscape',
      landscapeBackground: 'blur',
      landscapeBlurRadius: 25,
      landscapeDarkness: 40,
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: true,
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 5, mediaStart: 0 }]
    };

    try {
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: 0 },
            React.createElement(YonruClip, blurProps)
          )
        );
      });

      const videos = container.querySelectorAll(
        '[data-offthread-video="true"]'
      );
      expect(videos).toHaveLength(1);
      expect(videos[0]?.getAttribute('data-has-on-video-frame')).toBe('true');

      const blurCanvas = container.querySelector(
        '[data-testid="headless-landscape-blur-canvas"]'
      ) as HTMLCanvasElement | null;
      expect(blurCanvas).not.toBeNull();
      expect(blurCanvas!.width).toBe(135);
      expect(blurCanvas!.height).toBe(240);
      expect(blurCanvas!.style.width).toBe('1080px');
      expect(blurCanvas!.style.height).toBe('1920px');

      const bgWrapper = blurCanvas!.parentElement as HTMLElement;
      expect(bgWrapper.style.zIndex).toBe('0');
      const dimLayer = bgWrapper.querySelector('div') as HTMLElement | null;
      expect(dimLayer?.style.backgroundColor).toContain('0.4');

      const cbFrame0 = capturedOnVideoFrames[0];
      expect(typeof cbFrame0).toBe('function');

      // Invoke onVideoFrame across 3 frames -> single cached 2D context, 3 blur draws
      const mockImg = document.createElement('img');
      Object.defineProperty(mockImg, 'naturalWidth', {
        value: 1920,
        configurable: true
      });
      Object.defineProperty(mockImg, 'naturalHeight', {
        value: 1080,
        configurable: true
      });
      cbFrame0!(mockImg);
      cbFrame0!(mockImg);
      cbFrame0!(mockImg);

      expect(getContextSpy).toHaveBeenCalledTimes(1);
      const blurCtx = contextsByCanvas.get(blurCanvas!)!;
      expect(blurCtx.filter).toBe('blur(3px)');
      expect(blurCtx.drawImage).toHaveBeenCalledTimes(3);

      // Next frame preserves exact referential stability for onVideoFrame
      capturedOnVideoFrames.length = 0;
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: 1 },
            React.createElement(YonruClip, blurProps)
          )
        );
      });
      const cbFrame1 = capturedOnVideoFrames[0];
      expect(cbFrame1).toBe(cbFrame0);

      // Black background mode mounts 1 OffthreadVideo, 0 blur canvas, and omits onVideoFrame
      capturedOnVideoFrames.length = 0;
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: 0 },
            React.createElement(YonruClip, {
              ...blurProps,
              landscapeBackground: 'black'
            })
          )
        );
      });
      const blackVideos = container.querySelectorAll(
        '[data-offthread-video="true"]'
      );
      expect(blackVideos).toHaveLength(1);
      expect(blackVideos[0]?.getAttribute('data-has-on-video-frame')).toBe(
        'false'
      );
      expect(
        container.querySelector(
          '[data-testid="headless-landscape-blur-canvas"]'
        )
      ).toBeNull();
      expect(capturedOnVideoFrames[0]).toBeUndefined();
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('scopes timeline text overlays into Sequence(layout="none") windows with zero per-frame re-renders between transitions', () => {
    const { getContextSpy } = createCanvasContextTracker();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let setFrameFn: ((f: number) => void) | null = null;
    const StatefulFrameWrapper: React.FC<{ children: React.ReactNode }> = ({
      children
    }) => {
      const [frame, setFrame] = React.useState(0);
      setFrameFn = setFrame;
      return React.createElement(
        FrameContext.Provider,
        { value: frame },
        children
      );
    };

    const clipElement = React.createElement(YonruClip, {
      videoPath: 'http://localhost/clip.mp4',
      words: [],
      cropX: 960,
      position: 'bottom',
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: true,
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 10, mediaStart: 0 }],
      timelineTextItems: [
        {
          id: 't-zero',
          content: 'BAD ZERO',
          start: 0,
          duration: 0,
          x: 0,
          y: 0
        },
        {
          id: 't-neg-expired',
          content: 'EXPIRED',
          start: -2,
          duration: 1,
          x: 0,
          y: 0
        },
        {
          id: 't1',
          content: 'FIRST OVERLAY',
          start: 1,
          duration: 2,
          font: 'Outfit',
          x: 100,
          y: 200
        },
        {
          id: 't2',
          content: 'SECOND OVERLAY',
          start: 1.5,
          duration: 2,
          font: 'Montserrat',
          x: 120,
          y: 300
        }
      ]
    });

    try {
      act(() => {
        root.render(
          React.createElement(StatefulFrameWrapper, null, clipElement)
        );
      });

      // Frame 0: neither valid layer active; invalid zero/expired entries did not throw
      expect(getFontSpy).toHaveBeenCalledTimes(0);
      expect(
        container.querySelector('[data-sequence-name="TextLayer-t1"]')
      ).toBeNull();

      // Frame 30 (1.0s): t1 mounts inside <Sequence layout="none" from={30} durationInFrames={60}>
      act(() => setFrameFn!(30));
      const seq1 = container.querySelector(
        '[data-sequence-name="TextLayer-t1"]'
      ) as HTMLElement | null;
      expect(seq1).not.toBeNull();
      expect(seq1!.getAttribute('data-layout')).toBe('none');
      expect(seq1!.getAttribute('data-from')).toBe('30');
      expect(seq1!.getAttribute('data-duration')).toBe('60');
      expect(seq1!.style.position).toBe('');
      expect(getFontSpy).toHaveBeenCalledTimes(1);

      // Step through frames 31..44 inside t1's active window (before t2 starts at frame 45):
      // 0 extra card renders / getFont calls
      getFontSpy.mockClear();
      for (let f = 31; f < 45; f++) {
        act(() => setFrameFn!(f));
      }
      expect(getFontSpy).toHaveBeenCalledTimes(0);

      // Frame 45 (1.5s): t2 mounts while t1 stays mounted without re-rendering t1
      act(() => setFrameFn!(45));
      expect(getFontSpy).toHaveBeenCalledTimes(1);
      expect(getFontSpy).toHaveBeenCalledWith('Montserrat');

      const t1Fill = container
        .querySelector('[data-sequence-name="TextLayer-t1"]')
        ?.querySelector('[data-abs-fill="true"]') as HTMLElement | null;
      const t2Fill = container
        .querySelector('[data-sequence-name="TextLayer-t2"]')
        ?.querySelector('[data-abs-fill="true"]') as HTMLElement | null;
      expect(Number(t1Fill?.getAttribute('data-z-index'))).toBeGreaterThan(20);
      expect(Number(t2Fill?.getAttribute('data-z-index'))).toBeGreaterThan(
        Number(t1Fill?.getAttribute('data-z-index'))
      );

      // Step frames 46..89: 0 re-renders while both cards remain mounted
      getFontSpy.mockClear();
      for (let f = 46; f < 90; f++) {
        act(() => setFrameFn!(f));
      }
      expect(getFontSpy).toHaveBeenCalledTimes(0);

      // Frame 90 (3.0s): t1 exits cleanly while t2 remains active
      act(() => setFrameFn!(90));
      expect(container.textContent).not.toContain('FIRST OVERLAY');
      expect(container.textContent).toContain('SECOND OVERLAY');
      expect(getFontSpy).toHaveBeenCalledTimes(0);
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('aligns bleep Sequences and frameVolume in MainVideo coordinates across Cover Slides and multi-segment cuts', () => {
    const { getContextSpy } = createCanvasContextTracker();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const coverProps: YonruClipProps = {
      videoPath: 'http://localhost/clip.mp4',
      words: [],
      cropX: 960,
      position: 'bottom',
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: true,
      coverEnabled: true,
      coverDuration: 2,
      coverImagePath: 'cover_test.jpg',
      volume: 0.8,
      censoredSegments: [{ start: 1.0, duration: 0.5 }],
      bleepAudioSrc: 'bleep_clip_bleep.wav',
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 10, mediaStart: 0 }]
    };

    const jumpCutProps: YonruClipProps = {
      videoPath: 'http://localhost/clip.mp4',
      words: [],
      cropX: 960,
      position: 'bottom',
      fps: 30,
      sourceWidth: 1920,
      sourceHeight: 1080,
      hideSubtitles: true,
      coverEnabled: true,
      coverDuration: 1,
      coverImagePath: 'cover_test.jpg',
      volume: 1,
      censoredSegments: [{ start: 7.0, duration: 0.5 }],
      bleepAudioSrc: 'bleep_clip_bleep.wav',
      timelineVideoItems: [
        { id: 's1', start: 0, duration: 5, mediaStart: 0 },
        { id: 's2', start: 5, duration: 5, mediaStart: 8 }
      ]
    };

    try {
      // 1. Cover Slide (2s = 60 frames) + censored word at MainVideo 1.0s..1.5s -> comp frames 90..104
      for (const isRendering of [false, true]) {
        act(() => {
          root.render(null);
        });
        EnvState.isRendering = isRendering;
        staticFileSpy.mockClear();

        act(() => {
          root.render(
            React.createElement(
              FrameContext.Provider,
              { value: 97 },
              React.createElement(YonruClip, coverProps)
            )
          );
        });

        const bleepSeq = container.querySelector(
          '[data-sequence-name="Bleep-0"]'
        ) as HTMLElement | null;
        expect(bleepSeq).not.toBeNull();
        expect(bleepSeq!.getAttribute('data-from')).toBe('30');
        expect(bleepSeq!.getAttribute('data-duration')).toBe('15');

        const bleepAudio = bleepSeq!.querySelector(
          'audio[data-remotion-audio="true"]'
        ) as HTMLAudioElement | null;
        expect(bleepAudio?.getAttribute('src')).toBe('bleep_clip_bleep.wav');
        expect(staticFileSpy).toHaveBeenCalledWith('bleep_clip_bleep.wav');

        const activeMedia = container.querySelector(
          isRendering
            ? '[data-offthread-video="true"]'
            : '[data-remotion-video="true"]'
        ) as HTMLElement | null;
        expect(activeMedia?.getAttribute('data-resolved-volume')).toBe('0');

        // Frame 120 (MainVideo 2.0s): unmuted and bleep unmounted
        act(() => {
          root.render(
            React.createElement(
              FrameContext.Provider,
              { value: 120 },
              React.createElement(YonruClip, coverProps)
            )
          );
        });
        expect(
          container.querySelector('[data-sequence-name="Bleep-0"]')
        ).toBeNull();
        const unmutedMedia = container.querySelector(
          isRendering
            ? '[data-offthread-video="true"]'
            : '[data-remotion-video="true"]'
        ) as HTMLElement | null;
        expect(unmutedMedia?.getAttribute('data-resolved-volume')).toBe('0.8');
      }

      // 2. Multi-segment jump-cut + Cover Slide (1s = 30 frames) + censored word in s2 at 7.0s
      for (const isRendering of [false, true]) {
        EnvState.isRendering = isRendering;
        const selector = isRendering
          ? '[data-offthread-video="true"]'
          : '[data-remotion-video="true"]';

        // Comp frame 247 => MainVideo frame 217 (7.233s) => s2 (startFrame=150, localFrame=67)
        act(() => {
          root.render(
            React.createElement(
              FrameContext.Provider,
              { value: 247 },
              React.createElement(YonruClip, jumpCutProps)
            )
          );
        });
        const s2Media = container
          .querySelector('[data-sequence-name="VideoSegment-s2"]')
          ?.querySelector(selector) as HTMLElement | null;
        expect(s2Media?.getAttribute('data-resolved-volume')).toBe('0');

        // Comp frame 97 => MainVideo frame 67 (2.233s) => s1 (startFrame=0, localFrame=67)
        act(() => {
          root.render(
            React.createElement(
              FrameContext.Provider,
              { value: 97 },
              React.createElement(YonruClip, jumpCutProps)
            )
          );
        });
        const s1Media = container
          .querySelector('[data-sequence-name="VideoSegment-s1"]')
          ?.querySelector(selector) as HTMLElement | null;
        expect(s1Media?.getAttribute('data-resolved-volume')).toBe('1');
      }

      // 3. Direct URLs & data URIs pass through without calling staticFile()
      EnvState.isRendering = true;
      for (const directSrc of [
        '/audio/bleep.wav',
        'data:audio/wav;base64,AAAA'
      ]) {
        staticFileSpy.mockClear();
        act(() => {
          root.render(
            React.createElement(
              FrameContext.Provider,
              { value: 37 },
              React.createElement(YonruClip, {
                ...coverProps,
                coverEnabled: false,
                coverDuration: 0,
                coverImagePath: undefined,
                bleepAudioSrc: directSrc
              })
            )
          );
        });
        const bleepAudio = container.querySelector(
          'audio[data-remotion-audio="true"]'
        ) as HTMLAudioElement | null;
        expect(bleepAudio?.getAttribute('src')).toBe(directSrc);
        expect(staticFileSpy).not.toHaveBeenCalledWith(directSrc);
      }
    } finally {
      act(() => root.unmount());
      container.remove();
      getContextSpy.mockRestore();
    }
  });
});
