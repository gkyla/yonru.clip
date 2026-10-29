import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const FrameContext = React.createContext<number>(0);

vi.mock('remotion', () => {
  const ReactLib = React;
  return {
    registerRoot: vi.fn(),
    Composition: () => null,
    staticFile: (p: string) => p,
    delayRender: () => 1,
    continueRender: vi.fn(),
    useCurrentFrame: () => ReactLib.useContext(FrameContext),
    useVideoConfig: () => ({
      fps: 30,
      width: 1080,
      height: 1920,
      durationInFrames: 600
    }),
    useRemotionEnvironment: () => ({
      isRendering: false,
      isStudio: false,
      isPlayer: true
    }),
    AbsoluteFill: ({ children, style }: any) =>
      ReactLib.createElement(
        'div',
        { style: { position: 'absolute', inset: 0, ...style } },
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
            style: {
              position: 'absolute',
              inset: 0,
              ...style,
              ...(isPremounted ? { opacity: 0, pointerEvents: 'none' } : {})
            }
          },
          children
        )
      );
    },
    Video: ReactLib.forwardRef(
      ({ src, startFrom, endAt, style }: any, ref: any) =>
        ReactLib.createElement('video', {
          ref,
          src,
          'data-remotion-video': 'true',
          'data-start-from': startFrom ?? 0,
          'data-end-at': endAt ?? '',
          style
        })
    ),
    OffthreadVideo: () => null,
    Audio: () => null,
    Img: () => null,
    spring: () => 1,
    interpolate: (_v: number, _i: number[], o: number[]) => o[0] ?? 0
  };
});

import { YonruClip } from '@yonru/remotion';

function configureMockVideo(
  video: HTMLVideoElement,
  currentTime: number,
  readyState = 4
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
    value: false,
    configurable: true
  });
  Object.defineProperty(video, 'paused', {
    value: true,
    configurable: true
  });
  video.currentTime = currentTime;
}

describe('YonruClip Cut Boundary Frame Retention & Seamless Coalescing Integration', () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('coalesces continuous uncut splits so playhead crosses the cut with zero <Video> remount', () => {
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        fillStyle: '#000000',
        filter: 'none'
      } as unknown as CanvasRenderingContext2D);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Exact unsorted continuous split pattern from real editor timeline.json
    const uncutSplitItems = [
      { id: 'main-video', start: 0, duration: 1.38, mediaStart: 0 },
      { id: 'bd2nfay38', start: 4.87, duration: 5.0, mediaStart: 10.78 },
      {
        id: 'a0xad3cjp',
        start: 1.38,
        duration: 2.8200000000000003,
        mediaStart: 1.38
      }
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
              cropX: 50,
              position: 'bottom',
              fps: 30,
              sourceWidth: 1920,
              sourceHeight: 1080,
              hideSubtitles: true,
              timelineVideoItems: uncutSplitItems
            })
          )
        );
      });
    };

    try {
      // Frame 40 (1.333s, before 1.38s split)
      renderAtFrame(40);
      const videosBefore = container.querySelectorAll(
        'video[data-remotion-video="true"]'
      );
      expect(videosBefore).toHaveLength(1);
      const activeVideoBefore = videosBefore[0] as HTMLVideoElement;
      expect(activeVideoBefore.getAttribute('data-start-from')).toBe('0');
      expect(activeVideoBefore.getAttribute('data-end-at')).toBe('126');

      configureMockVideo(activeVideoBefore, 40 / 30);
      act(() => {
        activeVideoBefore.dispatchEvent(new Event('seeked'));
      });

      const canvasBefore = container.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;
      expect(canvasBefore.style.opacity).toBe('1');

      // Cross 1.38s split boundary -> Frame 41 & Frame 42
      renderAtFrame(41);
      renderAtFrame(42);

      const videosAfter = container.querySelectorAll(
        'video[data-remotion-video="true"]'
      );
      expect(videosAfter).toHaveLength(1);
      // Exact same <video> DOM element — zero unmount, zero cold-boot, zero freeze!
      expect(videosAfter[0]).toBe(activeVideoBefore);
      expect(canvasBefore.style.opacity).toBe('1');
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('premounts incoming jump-cut segments without clobbering retention and retains frames on cold scrubs', () => {
    const drawImageSpy = vi.fn();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: drawImageSpy,
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        fillStyle: '#000000',
        filter: 'none'
      } as unknown as CanvasRenderingContext2D);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    // Non-contiguous trimmed jump cut: mediaStart jumps from 5.0s to 8.0s at timeline 5.0s (frame 150)
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
              cropX: 50,
              position: 'bottom',
              fps: 30,
              sourceWidth: 1920,
              sourceHeight: 1080,
              hideSubtitles: true,
              timelineVideoItems: jumpCutItems,
              cropMap: [
                { time: 0, x: 600, mode: 'single' },
                {
                  time: 8,
                  x: 960,
                  mode: 'split',
                  top_x: 500,
                  bottom_x: 1400
                }
              ]
            })
          )
        );
      });
    };

    try {
      // 1. Frame 130 (4.33s): block-1 is active AND block-2 is premounted ahead of frame 150!
      renderAtFrame(130);

      const retentionCanvas = container.querySelector(
        '[data-testid="timeline-retention-canvas"]'
      ) as HTMLCanvasElement;
      const premountedSeq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-2"]'
      ) as HTMLElement;
      expect(premountedSeq).toBeTruthy();
      expect(premountedSeq.getAttribute('data-premounted')).toBe('true');

      const block1Seq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-1"]'
      ) as HTMLElement;
      const block1Video = block1Seq.querySelector(
        'video[data-remotion-video="true"]'
      ) as HTMLVideoElement;
      const block2Video = premountedSeq.querySelector(
        'video[data-remotion-video="true"]'
      ) as HTMLVideoElement;
      const block2Canvas = premountedSeq.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;

      configureMockVideo(block1Video, 130 / 30);
      act(() => {
        block1Video.dispatchEvent(new Event('seeked'));
      });
      expect(retentionCanvas.style.opacity).toBe('1');

      // Premounted block-2 finishes seeking to 8.0s BEFORE frame 150!
      // It must paint its own canvas (opacity 1 inside hidden sequence), WITHOUT overwriting retentionCanvas!
      drawImageSpy.mockClear();
      configureMockVideo(block2Video, 8.0);
      act(() => {
        block2Video.dispatchEvent(new Event('seeked'));
      });
      expect(block2Canvas.style.opacity).toBe('1');
      // drawImage called for split top + bottom panels on block2Canvas, NOT with block2Canvas onto retentionCanvas!
      const retentionBlitsDuringPremount = drawImageSpy.mock.calls.filter(
        call => call[0] === block2Canvas
      );
      expect(retentionBlitsDuringPremount).toHaveLength(0);

      // 2. Advance across jump cut to frame 150 -> block-2 becomes active IMMEDIATELY with opacity 1!
      renderAtFrame(150);
      expect(premountedSeq.getAttribute('data-premounted')).toBe('false');
      expect(block2Canvas.style.opacity).toBe('1');

      // 3. Scrub backward across jump cut to frame 148 (cold mount of block-1)
      renderAtFrame(148);
      const remountedBlock1Seq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-1"]'
      ) as HTMLElement;
      const remountedBlock1Canvas = remountedBlock1Seq.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;
      const remountedBlock1Video = remountedBlock1Seq.querySelector(
        'video[data-remotion-video="true"]'
      ) as HTMLVideoElement;

      // Simulate premature loadeddata at 0.0s before seek lands at 4.933s
      configureMockVideo(remountedBlock1Video, 0, 2);
      act(() => {
        remountedBlock1Video.dispatchEvent(new Event('loadeddata'));
      });
      expect(remountedBlock1Canvas.style.opacity).toBe('0');
      expect(retentionCanvas.style.opacity).toBe('1');

      // Seek completes at 4.933s -> reveals block-1 canvas cleanly
      remountedBlock1Video.currentTime = 148 / 30;
      act(() => {
        remountedBlock1Video.dispatchEvent(new Event('seeked'));
      });
      expect(remountedBlock1Canvas.style.opacity).toBe('1');
      expect(retentionCanvas.style.opacity).toBe('1');
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      getContextSpy.mockRestore();
    }
  });

  it('uses mediaStartFrame-anchored timestamp on fallback unlock so framing never snaps to 0.0s', () => {
    vi.useFakeTimers();
    const drawImageSpy = vi.fn();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: drawImageSpy,
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        fillStyle: '#000000',
        filter: 'none'
      } as unknown as CanvasRenderingContext2D);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      // Cold scrub straight to frame 150 (block-2 with mediaStart = 8.0s, split mode at t >= 8.0s, single mode at t = 0s)
      act(() => {
        root.render(
          React.createElement(
            FrameContext.Provider,
            { value: 150 },
            React.createElement(YonruClip, {
              videoPath: 'http://localhost/portrait.mp4',
              words: [],
              cropX: 50,
              position: 'bottom',
              videoLayout: 'vertical',
              fps: 30,
              sourceWidth: 1920,
              sourceHeight: 1080,
              hideSubtitles: true,
              timelineVideoItems: [
                { id: 'block-1', start: 0, duration: 5, mediaStart: 0 },
                { id: 'block-2', start: 5, duration: 5, mediaStart: 8 }
              ],
              cropMap: [
                { time: 0, x: 600, mode: 'single' },
                {
                  time: 8,
                  x: 960,
                  mode: 'split',
                  top_x: 500,
                  bottom_x: 1400
                }
              ]
            })
          )
        );
      });

      const block2Seq = container.querySelector(
        '[data-sequence-name="VideoSegment-block-2"]'
      ) as HTMLElement;
      const video = block2Seq.querySelector(
        'video[data-remotion-video="true"]'
      ) as HTMLVideoElement;
      const compositorCanvas = block2Seq.querySelector(
        '[data-testid="compositor-canvas"]'
      ) as HTMLCanvasElement;

      // Simulate lagging currentTime = 0 on fallback unlock
      configureMockVideo(video, 0, 4);
      expect(compositorCanvas.style.opacity).toBe('0');

      drawImageSpy.mockClear();
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(compositorCanvas.style.opacity).toBe('1');
      // Because t=8.0s is in 'split' mode, drawImage is called twice on compositorCanvas (top + bottom panel) + 1 retention blit = 3 calls!
      // If fallback wrongly used frame/fps = 0.0s, it would have drawn 'single' mode (only 1 call + 1 blit = 2 calls)!
      expect(drawImageSpy).toHaveBeenCalledTimes(3);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      getContextSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
