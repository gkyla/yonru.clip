import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

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
          style: { position: 'absolute', inset: 0, ...style }
        },
        children
      ),
    Sequence: ({
      from = 0,
      durationInFrames = Infinity,
      children,
      style
    }: {
      from?: number;
      durationInFrames?: number;
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
          { style: { position: 'absolute', inset: 0, ...style } },
          children
        )
      );
    },
    Video: () => null,
    OffthreadVideo: () => null,
    Audio: () => null,
    Img: () => null
  };
});

import { YonruClip } from '../../../shared/remotion/src/Composition';
import type { YonruClipProps } from '../../../shared/remotion/src/types';
import { SubtitleStyleCoordinator } from '../../app/utils/subtitleStyleCoordinator';

interface TextOverlayInput {
  showStroke?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
}

function renderTimelineTextMarkup(textItem: TextOverlayInput): string {
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
        id: 't1',
        content: 'Sample Text',
        start: 0,
        duration: 5,
        x: 100,
        y: 200,
        ...textItem
      }
    ],
    subtitleStyle: SubtitleStyleCoordinator.extractRenderPayload(
      {}
    ) as unknown as YonruClipProps['subtitleStyle']
  };

  return renderToStaticMarkup(
    React.createElement(
      FrameContext.Provider,
      { value: 30 },
      React.createElement(YonruClip, props)
    )
  );
}

describe('Remotion Timeline Text Outline Gating', () => {
  it('omits -webkit-text-stroke and paint-order when showStroke is false even if strokeWidth > 0', () => {
    const markup = renderTimelineTextMarkup({
      showStroke: false,
      strokeWidth: 5,
      strokeColor: '#000000'
    });

    expect(markup).toContain('Sample Text');
    expect(markup).not.toMatch(/-webkit-text-stroke:/i);
    expect(markup).not.toMatch(/paint-order:/i);
  });

  it('omits -webkit-text-stroke and paint-order when showStroke is undefined even if strokeWidth > 0', () => {
    const markup = renderTimelineTextMarkup({
      showStroke: undefined,
      strokeWidth: 5,
      strokeColor: '#000000'
    });

    expect(markup).toContain('Sample Text');
    expect(markup).not.toMatch(/-webkit-text-stroke:/i);
    expect(markup).not.toMatch(/paint-order:/i);
  });

  it('defaults strokeWidth to 5 (10px outer outline) when showStroke is true and strokeWidth is undefined', () => {
    const markup = renderTimelineTextMarkup({
      showStroke: true,
      strokeWidth: undefined,
      strokeColor: '#000000'
    });

    expect(markup).toContain('paint-order:stroke fill');
    expect(markup).toContain('-webkit-text-stroke:10px #000000');
  });

  it('renders 2x strokeWidth with stroke fill paintOrder when showStroke is true', () => {
    const markup = renderTimelineTextMarkup({
      showStroke: true,
      strokeWidth: 5,
      strokeColor: '#FF0000'
    });

    expect(markup).toContain('paint-order:stroke fill');
    expect(markup).toContain('-webkit-text-stroke:10px #FF0000');
  });

  it('omits -webkit-text-stroke and paint-order when showStroke is true and strokeWidth is 0', () => {
    const markup = renderTimelineTextMarkup({
      showStroke: true,
      strokeWidth: 0,
      strokeColor: '#000000'
    });

    expect(markup).toContain('Sample Text');
    expect(markup).not.toMatch(/-webkit-text-stroke:/i);
    expect(markup).not.toMatch(/paint-order:/i);
  });
});
