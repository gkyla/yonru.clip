import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const FrameContext = React.createContext<number>(30);

vi.mock('../../../shared/remotion/src/fonts', () => ({
  getFont: (name: string) => name || 'Outfit'
}));

vi.mock('../../../shared/remotion/src/AnimatedSubtitles', () => ({
  AnimatedSubtitles: () => null
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
      fps: 30,
      width: 1080,
      height: 1920,
      durationInFrames: 300
    }),
    useRemotionEnvironment: () => ({
      isRendering: true,
      isStudio: false,
      isPlayer: false
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
      name,
      children,
      style
    }: {
      from?: number;
      durationInFrames?: number;
      name?: string;
      children?: React.ReactNode;
      style?: React.CSSProperties;
    }) => {
      const parentFrame = ReactLib.useContext(FrameContext);
      const relFrame = parentFrame - from;
      if (relFrame < 0 || relFrame >= durationInFrames) {
        return null;
      }
      return ReactLib.createElement(
        FrameContext.Provider,
        { value: relFrame },
        ReactLib.createElement(
          'div',
          {
            'data-sequence-name': name ?? '',
            style: { position: 'absolute', inset: 0, ...style }
          },
          children
        )
      );
    },
    Video: () => null,
    OffthreadVideo: () => null,
    Audio: ({ src, volume }: { src?: string; volume?: number }) =>
      ReactLib.createElement('audio', {
        'data-remotion-audio': 'true',
        src,
        'data-volume': String(volume ?? 1)
      }),
    Img: () => null
  };
});

import { YonruClip } from '../../../shared/remotion/src/Composition';
import type { YonruClipProps } from '../../../shared/remotion/src/types';
import { SubtitleStyleCoordinator } from '../../app/utils/subtitleStyleCoordinator';

describe('Remotion Multi-Track Z-Order & Audio Mixing', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('assigns strictly increasing zIndex bottom-to-top for overlapping text tracks and mounts multi-track audio concurrently', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const props: YonruClipProps = {
      videoPath: 'http://localhost:8000/video.mp4',
      words: [],
      wordTimings: [],
      cropX: 960,
      sourceWidth: 1920,
      sourceHeight: 1080,
      position: 'bottom',
      videoLayout: 'vertical',
      subtitleOffset: 100,
      autoAdaptiveSubtitles: true,
      hideSubtitles: false,
      volume: 1,
      coverEnabled: false,
      coverDuration: 0,
      timelineVideoItems: [{ id: 'v1', start: 0, duration: 10, mediaStart: 0 }],
      timelineTextItems: [
        {
          id: 't-bottom',
          content: 'Bottom Track Text',
          start: 0,
          duration: 5,
          x: 100,
          y: 200
        },
        {
          id: 't-top',
          content: 'Top Track Text',
          start: 0,
          duration: 5,
          x: 100,
          y: 200
        }
      ],
      timelineAudioItems: [
        {
          id: 'a1',
          name: 'bgm.mp3',
          src: 'http://localhost:8000/bgm.mp3',
          start: 0,
          duration: 8,
          volume: 0.4
        },
        {
          id: 'a2',
          name: 'sfx.mp3',
          src: 'http://localhost:8000/sfx.mp3',
          start: 0.5,
          duration: 3,
          volume: 0.9
        }
      ],
      subtitleStyle: SubtitleStyleCoordinator.extractRenderPayload({})
    };

    await act(async () => {
      root.render(
        React.createElement(
          FrameContext.Provider,
          { value: 30 },
          React.createElement(YonruClip, props)
        )
      );
    });

    const leafFills = Array.from(
      container.querySelectorAll<HTMLElement>('[data-abs-fill="true"]')
    ).filter(el => !el.querySelector('[data-abs-fill="true"]'));
    const bottomFill = leafFills.find(el =>
      el.textContent?.includes('Bottom Track Text')
    );
    const topFill = leafFills.find(el =>
      el.textContent?.includes('Top Track Text')
    );

    expect(bottomFill).toBeDefined();
    expect(topFill).toBeDefined();

    const bottomZ = Number(bottomFill!.getAttribute('data-z-index'));
    const topZ = Number(topFill!.getAttribute('data-z-index'));
    expect(bottomZ).toBeGreaterThan(20);
    expect(topZ).toBeGreaterThan(bottomZ);

    const audios = Array.from(
      container.querySelectorAll('audio[data-remotion-audio="true"]')
    );
    expect(audios.map(a => a.getAttribute('src'))).toEqual([
      'http://localhost:8000/bgm.mp3',
      'http://localhost:8000/sfx.mp3'
    ]);

    await act(async () => root.unmount());
    container.remove();
  });
});
