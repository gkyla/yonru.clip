import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const EnvState = {
  fps: 30,
  durationInFrames: 900,
  isRendering: false
};

const FrameContext = React.createContext<number>(0);

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
    staticFile: (p: string) => p,
    delayRender: () => 1,
    continueRender: vi.fn(),
    spring: () => 1,
    interpolate: (_v: number, _i: number[], out: number[]) =>
      Array.isArray(out) ? (out[0] ?? 0) : 0,
    useCurrentFrame: () => ReactLib.useContext(FrameContext),
    useVideoConfig: () => ({
      fps: EnvState.fps,
      width: 1080,
      height: 1920,
      durationInFrames: EnvState.durationInFrames
    }),
    useRemotionEnvironment: () => ({
      isRendering: EnvState.isRendering,
      isStudio: false,
      isPlayer: !EnvState.isRendering
    }),
    AbsoluteFill: ({ children, style }: any) =>
      ReactLib.createElement(
        'div',
        {
          'data-abs-fill': 'true',
          style: { position: 'absolute', inset: 0, ...style }
        },
        children
      ),
    Sequence: ({
      from = 0,
      durationInFrames = Infinity,
      premountFor = 0,
      name,
      children,
      style
    }: any) => {
      const parentFrame = ReactLib.useContext(FrameContext);
      const isPremounted =
        premountFor > 0 &&
        parentFrame >= from - premountFor &&
        parentFrame < from;
      const relFrame = isPremounted ? 0 : parentFrame - from;
      if (!isPremounted && (relFrame < 0 || relFrame >= durationInFrames)) {
        return null;
      }
      return ReactLib.createElement(
        FrameContext.Provider,
        { value: relFrame },
        ReactLib.createElement(
          'div',
          {
            'data-sequence-name': name ?? '',
            'data-premounted': isPremounted ? 'true' : 'false',
            style: { position: 'absolute', inset: 0, ...style }
          },
          children
        )
      );
    },
    Video: ReactLib.forwardRef(
      ({ src, startFrom = 0, style }: any, ref: any) => {
        const relFrame = ReactLib.useContext(FrameContext);
        const mediaTime = ((startFrom || 0) + relFrame) / EnvState.fps;
        return ReactLib.createElement('video', {
          ref: (el: HTMLVideoElement | null) => {
            if (el) {
              Object.defineProperty(el, 'readyState', {
                value: 4,
                configurable: true
              });
              Object.defineProperty(el, 'videoWidth', {
                value: 1920,
                configurable: true
              });
              Object.defineProperty(el, 'videoHeight', {
                value: 1080,
                configurable: true
              });
              Object.defineProperty(el, 'paused', {
                value: true,
                configurable: true
              });
              Object.defineProperty(el, 'seeking', {
                value: false,
                configurable: true
              });
              Object.defineProperty(el, 'currentTime', {
                value: mediaTime,
                configurable: true
              });
            }
            if (typeof ref === 'function') ref(el);
            else if (ref) ref.current = el;
          },
          src,
          'data-remotion-video': 'true',
          'data-media-time': String(mediaTime),
          style
        });
      }
    ),
    OffthreadVideo: ({ src, startFrom = 0, style }: any) => {
      const relFrame = ReactLib.useContext(FrameContext);
      const mediaTime = ((startFrom || 0) + relFrame) / EnvState.fps;
      return ReactLib.createElement('div', {
        'data-offthread-video': 'true',
        'data-media-time': String(mediaTime),
        'data-transform': style?.transform ?? '',
        style
      });
    },
    Audio: () => null,
    Img: () => null
  };
});

import { YonruClip } from '../../../shared/remotion/src/Composition';
import { resolveTimelineMediaTime } from '../../../shared/remotion/src/TimelineFrameRetention';
import { SubtitleStyleCoordinator } from '../../app/utils/subtitleStyleCoordinator';
import {
  isSplitFramingAtTimelineTime,
  findSplitTimelineJumpTime
} from '../../app/utils/timelineHelpers';

interface DrawCall {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

function parseTransform(transformStr: string) {
  const m =
    /translate3d\(\s*([-\d.]+)px,\s*([-\d.]+)px,\s*0(?:px)?\s*\)\s*scale\(\s*([-\d.]+)\s*\)/.exec(
      transformStr
    );
  if (!m) {
    throw new Error(`Unexpected transform format: ${transformStr}`);
  }
  return {
    tx: parseFloat(m[1]!),
    ty: parseFloat(m[2]!),
    scale: parseFloat(m[3]!)
  };
}

describe('Face Tracking & Multi-Speaker Render Parity', () => {
  const canvasDrawCalls = new WeakMap<HTMLCanvasElement, DrawCall[]>();

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    EnvState.fps = 30;
    EnvState.durationInFrames = 900;
    EnvState.isRendering = false;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        const canvasEl = this;
        return {
          save: vi.fn(),
          restore: vi.fn(),
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn((...args: any[]) => {
            if (args.length === 9) {
              const list = canvasDrawCalls.get(canvasEl) ?? [];
              list.push({
                sx: args[1],
                sy: args[2],
                sw: args[3],
                sh: args[4],
                dx: args[5],
                dy: args[6],
                dw: args[7],
                dh: args[8]
              });
              canvasDrawCalls.set(canvasEl, list);
            }
          })
        } as unknown as CanvasRenderingContext2D;
      }
    );
  });

  async function evaluateFrameParity(props: any, frame: number) {
    // 1. Studio Editor Preview (isRendering = false)
    const previewContainer = document.createElement('div');
    document.body.appendChild(previewContainer);
    EnvState.isRendering = false;
    const previewRoot = createRoot(previewContainer);
    await act(async () => {
      previewRoot.render(
        React.createElement(
          FrameContext.Provider,
          { value: frame },
          React.createElement(YonruClip, props)
        )
      );
    });

    const activeSeqs = Array.from(
      previewContainer.querySelectorAll('[data-sequence-name^="VideoSegment-"]')
    ).filter(el => el.getAttribute('data-premounted') === 'false');
    const scope = activeSeqs[0] ?? previewContainer;
    const canvas = scope.querySelector(
      'canvas[data-testid="compositor-canvas"]'
    ) as HTMLCanvasElement | null;
    const draws = canvas ? (canvasDrawCalls.get(canvas) ?? []) : [];
    const previewSub = Array.from(
      previewContainer.querySelectorAll('[data-abs-fill="true"]')
    ).find(el => (el as HTMLElement).style.zIndex === '20') as
      HTMLElement | undefined;

    const preview =
      draws.length >= 2
        ? {
            mode: 'split' as const,
            sxTop: draws[draws.length - 2]!.sx,
            sxBot: draws[draws.length - 1]!.sx,
            subJustify: previewSub?.style.justifyContent ?? ''
          }
        : {
            mode: 'single' as const,
            sxSingle: draws[0]!.sx,
            subJustify: previewSub?.style.justifyContent ?? ''
          };

    await act(async () => previewRoot.unmount());
    previewContainer.remove();

    // 2. Headless Export Render (isRendering = true)
    const renderContainer = document.createElement('div');
    document.body.appendChild(renderContainer);
    EnvState.isRendering = true;
    const renderRoot = createRoot(renderContainer);
    await act(async () => {
      renderRoot.render(
        React.createElement(
          FrameContext.Provider,
          { value: frame },
          React.createElement(YonruClip, props)
        )
      );
    });

    const offthreads = Array.from(
      renderContainer.querySelectorAll('[data-offthread-video="true"]')
    );
    const renderSub = Array.from(
      renderContainer.querySelectorAll('[data-abs-fill="true"]')
    ).find(el => (el as HTMLElement).style.zIndex === '20') as
      HTMLElement | undefined;

    const baseScale = (1920 * (1920 / 1080)) / 1920;
    const render =
      offthreads.length >= 2
        ? (() => {
            const topT = parseTransform(
              offthreads[0]!.getAttribute('data-transform') || ''
            );
            const botT = parseTransform(
              offthreads[1]!.getAttribute('data-transform') || ''
            );
            const swTop = 1080 / (baseScale * topT.scale);
            const swBot = 1080 / (baseScale * botT.scale);
            return {
              mode: 'split' as const,
              sxTop: Math.max(
                0,
                Math.min(1920 - swTop, -topT.tx / (baseScale * topT.scale))
              ),
              sxBot: Math.max(
                0,
                Math.min(1920 - swBot, -botT.tx / (baseScale * botT.scale))
              ),
              subJustify: renderSub?.style.justifyContent ?? ''
            };
          })()
        : (() => {
            const singleT = parseTransform(
              offthreads[0]!.getAttribute('data-transform') || ''
            );
            const sw = 1080 / baseScale;
            return {
              mode: 'single' as const,
              sxSingle: Math.max(
                0,
                Math.min(1920 - sw, -singleT.tx / baseScale)
              ),
              subJustify: renderSub?.style.justifyContent ?? ''
            };
          })();

    await act(async () => renderRoot.unmount());
    renderContainer.remove();

    return { preview, render };
  }

  it('maintains 1:1 face-tracking & multi-speaker split parity across ripple-trimmed timelineVideoItems', async () => {
    const cropMap = [
      { time: 0.0, x: 960, mode: 'single' as const },
      {
        time: 10.0,
        x: 360,
        mode: 'split' as const,
        top_x: 360,
        bottom_x: 1400
      },
      { time: 20.0, x: 1320, mode: 'single' as const }
    ];

    // Segment 1: timeline 0..4s -> media 0..4s (single)
    // Deleted media 4..10s via ripple cut!
    // Segment 2: timeline 4..20s -> media 10..26s (media 10..20s is split; media 20..26s is single x=1320)
    const props = {
      videoPath: 'http://localhost:8765/video.mp4',
      words: [{ start: 0, end: 20, word: 'TEST' }],
      cropX: 960,
      cropMap,
      position: 'bottom' as const,
      subtitleOffset: 400,
      autoAdaptiveSubtitles: true,
      sourceWidth: 1920,
      sourceHeight: 1080,
      timelineVideoItems: [
        { id: 'seg-1', start: 0, mediaStart: 0, duration: 4 },
        { id: 'seg-2', start: 4, mediaStart: 10, duration: 16 }
      ]
    };

    // At timeline t=6s (frame=180), active media is 12s -> MUST be split[0, 705] with center subtitles in BOTH preview & render!
    const at6s = await evaluateFrameParity(props, 180);
    expect(at6s.preview.mode).toBe('split');
    expect(at6s.render.mode).toBe('split');
    if (at6s.preview.mode === 'split' && at6s.render.mode === 'split') {
      expect(at6s.render.sxTop).toBeCloseTo(at6s.preview.sxTop, 1);
      expect(at6s.render.sxBot).toBeCloseTo(at6s.preview.sxBot, 1);
    }
    expect(at6s.preview.subJustify).toBe('center');
    expect(at6s.render.subJustify).toBe('center');

    // At timeline t=15s (frame=450), active media is 21s -> MUST be single (x=1320), NOT split from timeline t=15s!
    const at15s = await evaluateFrameParity(props, 450);
    expect(at15s.preview.mode).toBe('single');
    expect(at15s.render.mode).toBe('single');
    if (at15s.preview.mode === 'single' && at15s.render.mode === 'single') {
      expect(at15s.render.sxSingle).toBeCloseTo(at15s.preview.sxSingle, 1);
    }
    expect(at15s.preview.subJustify).toBe('flex-end');
    expect(at15s.render.subJustify).toBe('flex-end');
  });

  it('resolves frame-locked media time across uncut, trimmed, and gap timeline windows', () => {
    const segments = [
      { id: 's1', start: 0, mediaStart: 0, duration: 4 },
      { id: 's2', start: 5, mediaStart: 12, duration: 10 }
    ];
    expect(resolveTimelineMediaTime(60, segments, 30)).toBeCloseTo(2.0, 4);
    // Gap between 4s (f=120) and 5s (f=150) holds end of s1 rather than jumping to raw timeline time
    expect(resolveTimelineMediaTime(135, segments, 30)).toBeCloseTo(4.0, 2);
    // Inside s2 at timeline 7s (f=210) -> media 14s
    expect(resolveTimelineMediaTime(210, segments, 30)).toBeCloseTo(14.0, 4);
  });

  it('serializes auto_adaptive_subtitles in SubtitleStyleCoordinator.extractRenderPayload', () => {
    const offPayload = SubtitleStyleCoordinator.extractRenderPayload({
      autoAdaptiveSubtitles: false,
      subtitlePosition: 'bottom'
    });
    expect(offPayload.auto_adaptive_subtitles).toBe(false);

    const defaultPayload = SubtitleStyleCoordinator.extractRenderPayload({});
    expect(defaultPayload.auto_adaptive_subtitles).toBe(true);
  });

  it('maps timeline split detection and jumpToSplit across ripple-trimmed tracks', () => {
    const cropMap = [
      { time: 0.0, x: 960, mode: 'single' as const },
      {
        time: 13.3,
        x: 360,
        mode: 'split' as const,
        top_x: 360,
        bottom_x: 1400
      },
      { time: 20.0, x: 960, mode: 'single' as const }
    ];
    const tracks = [
      {
        id: 'video' as const,
        name: 'Video',
        type: 'video' as const,
        items: [
          { id: 'v1', start: 0, duration: 4.2, mediaStart: 0 },
          { id: 'v2', start: 4.87, duration: 51.22, mediaStart: 10.78 }
        ]
      }
    ];

    // Timeline 8.0s -> media 13.91s (inside split!)
    expect(isSplitFramingAtTimelineTime(cropMap, 8.0, false, 0, tracks)).toBe(
      true
    );
    // Timeline 16.0s -> media 21.91s (single!)
    expect(isSplitFramingAtTimelineTime(cropMap, 16.0, false, 0, tracks)).toBe(
      false
    );

    // Jumping to split from timeline 1.0s should land on timeline ~7.44s (4.87 + (13.3 - 10.78) + 0.05), NOT 13.35s!
    const jumpTarget = findSplitTimelineJumpTime(
      cropMap,
      1.0,
      false,
      0,
      tracks
    );
    expect(jumpTarget).not.toBeNull();
    expect(jumpTarget!).toBeCloseTo(4.87 + (13.3 - 10.78) + 0.05, 2);
  });
});
