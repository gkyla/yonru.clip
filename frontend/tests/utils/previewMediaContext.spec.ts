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
      durationInFrames: 300
    }),
    useRemotionEnvironment: () => ({
      isRendering: false,
      isStudio: false,
      isPlayer: true
    }),
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
    )
  };
});

import {
  CanvasVideoCompositor,
  PreviewMediaContext,
  type PreviewMediaCallbacks
} from '@yonru/remotion';

function setVideoMetrics(
  video: HTMLVideoElement,
  {
    width,
    height,
    duration,
    readyState,
    src
  }: {
    width: number;
    height: number;
    duration: number;
    readyState: number;
    src: string;
  }
) {
  Object.defineProperty(video, 'videoWidth', {
    value: width,
    configurable: true
  });
  Object.defineProperty(video, 'videoHeight', {
    value: height,
    configurable: true
  });
  Object.defineProperty(video, 'duration', {
    value: duration,
    configurable: true
  });
  Object.defineProperty(video, 'readyState', {
    value: readyState,
    configurable: true
  });
  Object.defineProperty(video, 'currentSrc', {
    value: src,
    configurable: true
  });
}

describe('PreviewMediaContext & CanvasVideoCompositor Single-Decoder Seam', () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('emits onMediaMetadata on loadedmetadata, deduplicates onMediaReady, and resets cleanly across clip switches', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onMediaMetadata = vi.fn();
    const onMediaReady = vi.fn();
    const callbacks: PreviewMediaCallbacks = {
      onMediaMetadata,
      onMediaReady
    };

    const renderCompositor = (videoSrc: string) => {
      act(() => {
        root.render(
          React.createElement(
            PreviewMediaContext.Provider,
            { value: callbacks },
            React.createElement(CanvasVideoCompositor, {
              videoSrc,
              volume: 1,
              fps: 30,
              CONTAINER_W: 1080,
              CONTAINER_H: 1920,
              PANEL_H: 960,
              isLandscape: false,
              videoDisplayW: 3413,
              videoDisplayH: 1920,
              rawSourceW: 1920,
              sourceHeight: 1080
            })
          )
        );
      });
    };

    try {
      renderCompositor('http://localhost:8765/clip-1.mp4');
      const video = container.querySelector('video') as HTMLVideoElement;
      expect(video).not.toBeNull();

      setVideoMetrics(video, {
        width: 1280,
        height: 720,
        duration: 15.25,
        readyState: 3,
        src: 'http://localhost:8765/clip-1.mp4'
      });

      act(() => {
        video.dispatchEvent(new Event('loadedmetadata'));
        video.dispatchEvent(new Event('loadeddata'));
        video.dispatchEvent(new Event('canplay'));
      });

      expect(onMediaMetadata).toHaveBeenCalledTimes(1);
      expect(onMediaMetadata).toHaveBeenCalledWith({
        width: 1280,
        height: 720,
        duration: 15.25
      });
      expect(onMediaReady).toHaveBeenCalledTimes(1);

      // Switch to clip 2 while browser video element still holds stale currentSrc/readyState briefly
      onMediaMetadata.mockClear();
      onMediaReady.mockClear();
      renderCompositor('http://localhost:8765/clip-2.mp4');

      // Stale readyState from clip-1 must NOT prematurely emit onMediaReady
      expect(onMediaReady).not.toHaveBeenCalled();

      setVideoMetrics(video, {
        width: 3840,
        height: 2160,
        duration: 32.0,
        readyState: 3,
        src: 'http://localhost:8765/clip-2.mp4'
      });
      act(() => {
        video.dispatchEvent(new Event('loadedmetadata'));
        video.dispatchEvent(new Event('canplay'));
      });

      expect(onMediaMetadata).toHaveBeenCalledWith({
        width: 3840,
        height: 2160,
        duration: 32.0
      });
      expect(onMediaReady).toHaveBeenCalledTimes(1);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('renders safely without PreviewMediaContext.Provider (headless export mode)', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      expect(() => {
        act(() => {
          root.render(
            React.createElement(CanvasVideoCompositor, {
              videoSrc: 'http://localhost:8765/headless.mp4',
              volume: 1,
              fps: 30,
              CONTAINER_W: 1080,
              CONTAINER_H: 1920,
              PANEL_H: 960,
              isLandscape: false,
              videoDisplayW: 3413,
              videoDisplayH: 1920,
              rawSourceW: 1920,
              sourceHeight: 1080
            })
          );
        });
      }).not.toThrow();
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
