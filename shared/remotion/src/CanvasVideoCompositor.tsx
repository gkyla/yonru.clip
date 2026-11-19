/** @jsxImportSource react */
import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo
} from 'react';
import {
  Video,
  useCurrentFrame,
  useRemotionEnvironment,
  delayRender,
  continueRender
} from 'remotion';
import { isInitialDecoderFrameAligned } from './TimelineFrameRetention';
import {
  computeViewportFraming,
  createTimelineFramingIndex,
  TimelineFramingIndex,
  type CropMapEntry,
  type ViewportFramingParams,
  type ViewportFramingResult
} from './TimelineFramingIndex';

export { computeViewportFraming, TimelineFramingIndex };
export type { CropMapEntry, ViewportFramingParams, ViewportFramingResult };

export interface CanvasVideoCompositorProps {
  videoSrc: string;
  volume: number | ((frame: number) => number);
  mediaStartFrame?: number;
  durationFrames?: number;
  fps?: number;
  CONTAINER_W: number;
  CONTAINER_H: number;
  PANEL_H: number;
  isLandscape: boolean;
  landscapeBackground?: 'black' | 'blur';
  landscapeBlurRadius?: number;
  landscapeDarkness?: number;
  videoDisplayW: number;
  videoDisplayH: number;
  rawSourceW: number;
  sourceHeight?: number;
  framingIndex?: TimelineFramingIndex;
  // Dynamic time-anchored framing props (fallback if framingIndex is not provided)
  cropMap?: CropMapEntry[];
  cropX?: number;
  cropPercentXTop?: number;
  cropPercentXBottom?: number;
  splitZoomTop?: number;
  splitZoomBottom?: number;
  splitOffsetXTop?: number;
  splitOffsetYTop?: number;
  splitOffsetXBottom?: number;
  splitOffsetYBottom?: number;
  isActive?: boolean;
  onFrameRendered?: (canvas: HTMLCanvasElement) => void;
}

export const CanvasVideoCompositor: React.FC<CanvasVideoCompositorProps> = ({
  videoSrc,
  volume,
  mediaStartFrame,
  durationFrames,
  fps = 30,
  CONTAINER_W,
  CONTAINER_H,
  PANEL_H,
  isLandscape,
  landscapeBackground = 'black',
  landscapeBlurRadius = 25,
  landscapeDarkness = 35,
  videoDisplayW,
  videoDisplayH,
  rawSourceW,
  sourceHeight,
  framingIndex,
  cropMap,
  cropX,
  cropPercentXTop,
  cropPercentXBottom,
  splitZoomTop = 1.0,
  splitZoomBottom = 1.0,
  splitOffsetXTop = 0,
  splitOffsetYTop = 0,
  splitOffsetXBottom = 0,
  splitOffsetYBottom = 0,
  isActive = true,
  onFrameRendered
}) => {
  const frame = useCurrentFrame();
  const frameRef = useRef<number>(frame);
  frameRef.current = frame;

  const { isRendering } = useRemotionEnvironment();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isActiveRef = useRef<boolean>(isActive);
  isActiveRef.current = isActive;
  const onFrameRenderedRef = useRef(onFrameRendered);
  onFrameRenderedRef.current = onFrameRendered;
  const hasRenderedValidFrameRef = useRef<boolean>(false);
  const mountFallbackUnlockedRef = useRef<boolean>(false);
  const lastVideoSrcRef = useRef<string>(videoSrc);

  if (lastVideoSrcRef.current !== videoSrc) {
    lastVideoSrcRef.current = videoSrc;
    hasRenderedValidFrameRef.current = false;
    mountFallbackUnlockedRef.current = false;
  }

  const fallbackFramingIndex = useMemo(
    () =>
      framingIndex
        ? null
        : createTimelineFramingIndex({
            cropMap,
            cropX,
            cropPercentXTop,
            cropPercentXBottom,
            splitZoomTop,
            splitZoomBottom,
            splitOffsetXTop,
            splitOffsetYTop,
            splitOffsetXBottom,
            splitOffsetYBottom,
            rawSourceW,
            isLandscape,
            videoDisplayW,
            videoDisplayH,
            CONTAINER_W,
            CONTAINER_H,
            PANEL_H
          }),
    [
      framingIndex,
      cropMap,
      cropX,
      cropPercentXTop,
      cropPercentXBottom,
      splitZoomTop,
      splitZoomBottom,
      splitOffsetXTop,
      splitOffsetYTop,
      splitOffsetXBottom,
      splitOffsetYBottom,
      rawSourceW,
      isLandscape,
      videoDisplayW,
      videoDisplayH,
      CONTAINER_W,
      CONTAINER_H,
      PANEL_H
    ]
  );
  const activeFramingIndex = framingIndex ?? fallbackFramingIndex!;

  const setCanvasRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      if (canvasRef.current !== el) {
        canvasRef.current = el;
        ctxRef.current = el ? el.getContext('2d', { alpha: false }) : null;
      }
      if (!el) return;
      if (
        !isRendering &&
        onFrameRenderedRef.current &&
        !hasRenderedValidFrameRef.current
      ) {
        el.style.opacity = '0';
      } else {
        el.style.opacity = '1';
      }
    },
    [isRendering]
  );

  const draw = useCallback(
    (force: boolean = false, explicitMediaTime?: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.readyState < 2) return;

      // GUARD: During interactive preview / scrubbing, if the video is actively seeking to a new timestamp,
      // do NOT draw stale video texture on top of a newly changed layout mode.
      if (!force && !isRendering && video.seeking) {
        return;
      }

      const vW = video.videoWidth || rawSourceW || 1920;
      const vH = video.videoHeight || sourceHeight || 1080;
      if (vW === 0 || vH === 0) return;

      if (
        !isRendering &&
        onFrameRenderedRef.current &&
        !hasRenderedValidFrameRef.current
      ) {
        const expectedMediaTime =
          ((mediaStartFrame ?? 0) + frameRef.current) / fps;
        if (
          !isInitialDecoderFrameAligned({
            currentTime: Number.isFinite(video.currentTime)
              ? video.currentTime
              : 0,
            expectedMediaTime,
            duration: video.duration,
            paused: video.paused,
            fallbackUnlocked: mountFallbackUnlockedRef.current
          })
        ) {
          return;
        }
      }

      const ctx =
        ctxRef.current ??
        (ctxRef.current = canvas.getContext('2d', { alpha: false }));
      if (!ctx) return;

      // Anchor layout dynamically to the exact physical presentation timestamp (PTS) from video decoder
      const currentTime =
        typeof explicitMediaTime === 'number' &&
        !isNaN(explicitMediaTime) &&
        explicitMediaTime >= 0
          ? explicitMediaTime
          : video && !isNaN(video.currentTime) && video.currentTime > 0
            ? video.currentTime
            : ((mediaStartFrame ?? 0) + frameRef.current) / fps;

      const framing = activeFramingIndex.computeFraming(currentTime);
      let didDrawFrame = false;

      if (isLandscape) {
        // Landscape display: center letterboxed
        const aspect = vW / vH;
        const dw = CONTAINER_W;
        const dh = dw / aspect;
        const dy = (CONTAINER_H - dh) / 2;

        if (landscapeBackground === 'blur') {
          try {
            // 1. Draw blurred video scaled to cover the 9:16 canvas with 8% overscan
            ctx.save();
            const blurRad = Math.max(1, landscapeBlurRadius ?? 25);
            ctx.filter = `blur(${blurRad}px)`;
            const coverScale =
              Math.max(CONTAINER_W / vW, CONTAINER_H / vH) * 1.08;
            const bgW = vW * coverScale;
            const bgH = vH * coverScale;
            const bgX = (CONTAINER_W - bgW) / 2;
            const bgY = (CONTAINER_H - bgH) / 2;
            ctx.drawImage(video, 0, 0, vW, vH, bgX, bgY, bgW, bgH);
            ctx.restore();

            // 2. Dimming overlay
            const darkness = Math.max(
              0,
              Math.min(100, landscapeDarkness ?? 35)
            );
            if (darkness > 0) {
              ctx.fillStyle = `rgba(0, 0, 0, ${darkness / 100})`;
              ctx.fillRect(0, 0, CONTAINER_W, CONTAINER_H);
            }
          } catch {
            // Fallback to black if texture read fails
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, CONTAINER_W, CONTAINER_H);
          }
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, CONTAINER_W, CONTAINER_H);
        }

        try {
          ctx.drawImage(video, 0, 0, vW, vH, 0, dy, dw, dh);
          didDrawFrame = true;
        } catch {
          // Ignored if video texture is still preparing
        }
      } else if (!framing.isSplitActive) {
        // Single-speaker framing (portrait 9:16)
        const scaleFactor = videoDisplayW / vW;
        const sw = CONTAINER_W / scaleFactor;
        const sh = CONTAINER_H / scaleFactor;
        const targetSx = -framing.curTranslateX / scaleFactor;
        const targetSy = -framing.curTranslateY / scaleFactor;
        const sx = Math.max(0, Math.min(vW - sw, targetSx));
        const sy = Math.max(0, Math.min(vH - sh, targetSy));

        try {
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CONTAINER_W, CONTAINER_H);
          didDrawFrame = true;
        } catch {
          // Ignored
        }
      } else {
        // Stacked Multi-Speaker Reframe: Draw top and bottom synchronously from the exact same frame
        // 1. Top speaker viewport (0, 0, 1080, PANEL_H)
        const scaleFactorTop = (videoDisplayW / vW) * framing.curScaleTop;
        const sw_top = CONTAINER_W / scaleFactorTop;
        const sh_top = PANEL_H / scaleFactorTop;
        const targetSxTop = -framing.curTopTranslateX / scaleFactorTop;
        const targetSyTop = -framing.curTopTranslateY / scaleFactorTop;
        const sx_top = Math.max(0, Math.min(vW - sw_top, targetSxTop));
        const sy_top = Math.max(0, Math.min(vH - sh_top, targetSyTop));

        // 2. Bottom speaker viewport (0, PANEL_H, 1080, PANEL_H)
        const scaleFactorBot = (videoDisplayW / vW) * framing.curScaleBottom;
        const sw_bot = CONTAINER_W / scaleFactorBot;
        const sh_bot = PANEL_H / scaleFactorBot;
        const targetSxBot = -framing.curBottomTranslateX / scaleFactorBot;
        const targetSyBot = -framing.curBottomTranslateY / scaleFactorBot;
        const sx_bot = Math.max(0, Math.min(vW - sw_bot, targetSxBot));
        const sy_bot = Math.max(0, Math.min(vH - sh_bot, targetSyBot));

        try {
          ctx.drawImage(
            video,
            sx_top,
            sy_top,
            sw_top,
            sh_top,
            0,
            0,
            CONTAINER_W,
            PANEL_H
          );
          ctx.drawImage(
            video,
            sx_bot,
            sy_bot,
            sw_bot,
            sh_bot,
            0,
            PANEL_H,
            CONTAINER_W,
            PANEL_H
          );

          // Center Seam Divider (2px dark line with subtle shadow)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
          ctx.fillRect(0, PANEL_H - 1, CONTAINER_W, 2);
          didDrawFrame = true;
        } catch {
          // Ignored
        }
      }

      if (didDrawFrame) {
        if (!hasRenderedValidFrameRef.current) {
          hasRenderedValidFrameRef.current = true;
          canvas.style.opacity = '1';
        }
        if (isActiveRef.current) {
          onFrameRenderedRef.current?.(canvas);
        }
      }
    },
    [
      isLandscape,
      landscapeBackground,
      landscapeBlurRadius,
      landscapeDarkness,
      CONTAINER_W,
      CONTAINER_H,
      PANEL_H,
      rawSourceW,
      sourceHeight,
      videoDisplayW,
      mediaStartFrame,
      fps,
      isRendering,
      activeFramingIndex
    ]
  );

  // Keep drawRef up-to-date with latest draw callback so rVFC and event listeners never churn
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Sync initial canvas opacity when videoSrc changes and provide safety fallback timer
  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    if (
      !isRendering &&
      onFrameRenderedRef.current &&
      !hasRenderedValidFrameRef.current
    ) {
      el.style.opacity = '0';
    } else {
      el.style.opacity = '1';
    }
  }, [videoSrc, isRendering]);

  useLayoutEffect(() => {
    if (isActive && hasRenderedValidFrameRef.current && canvasRef.current) {
      onFrameRenderedRef.current?.(canvasRef.current);
    }
  }, [isActive]);

  useEffect(() => {
    if (
      !isActive ||
      isRendering ||
      !onFrameRenderedRef.current ||
      hasRenderedValidFrameRef.current
    ) {
      return;
    }
    const timer = setTimeout(() => {
      if (!hasRenderedValidFrameRef.current) {
        mountFallbackUnlockedRef.current = true;
        drawRef.current(true);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [isActive, videoSrc, isRendering]);

  // Draw on layout effect whenever frame or draw dependencies change
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.seeking && !isRendering) {
      let cancelled = false;
      const onSeeked = () => {
        if (!cancelled) drawRef.current(true);
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      const timer = setTimeout(() => {
        if (!cancelled) drawRef.current(true);
      }, 150);
      return () => {
        cancelled = true;
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timer);
      };
    }

    // EXCLUSIVE SOVEREIGN RENDERER GUARD: During active playback, do NOT draw from useLayoutEffect.
    // requestVideoFrameCallback holds 100% exclusive authority over the canvas using exact decoder PTS.
    // useLayoutEffect only draws when video is paused or during headless render.
    if (!isRendering && !video.paused && !video.seeking) {
      return;
    }

    draw(false);
  }, [frame, isRendering, draw]);

  // Video event-driven updates (scrubbing, seeking, loadeddata)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => drawRef.current(true, video.currentTime);
    const handleTimeUpdate = () => {
      // During active playback, rVFC is the exclusive renderer; do not allow timeupdate to clobber
      if (video && !video.paused && !video.seeking) return;
      drawRef.current(false, video.currentTime);
    };
    const handleLoadedData = () => drawRef.current();

    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, []);

  // High-performance playback sync via requestVideoFrameCallback with exact decoder PTS
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !('requestVideoFrameCallback' in video)) return;

    let callbackId: number;
    let isMounted = true;

    const onFrame = (_now: DOMHighResTimeStamp, metadata: any) => {
      if (!isMounted) return;
      const mediaTime =
        metadata && typeof metadata.mediaTime === 'number'
          ? metadata.mediaTime
          : undefined;
      drawRef.current(false, mediaTime);
      callbackId = (video as any).requestVideoFrameCallback(onFrame);
    };

    callbackId = (video as any).requestVideoFrameCallback(onFrame);

    return () => {
      isMounted = false;
      if (callbackId && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(callbackId);
      }
    };
  }, []);

  // Headless rendering synchronization with delayRender / continueRender
  useEffect(() => {
    if (!isRendering) return;
    const video = videoRef.current;
    if (!video) return;

    const handle = delayRender(`CanvasVideoCompositor frame ${frame}`);
    let resolved = false;

    const resolve = () => {
      if (resolved) return;
      resolved = true;
      draw();
      continueRender(handle);
    };

    if (video.readyState >= 2 && !video.seeking) {
      const timer = setTimeout(resolve, 10);
      return () => {
        clearTimeout(timer);
        if (!resolved) continueRender(handle);
      };
    }

    const onSeeked = () => resolve();
    video.addEventListener('seeked', onSeeked, { once: true });
    const safetyTimeout = setTimeout(resolve, 300);

    return () => {
      video.removeEventListener('seeked', onSeeked);
      clearTimeout(safetyTimeout);
      if (!resolved) continueRender(handle);
    };
  }, [frame, isRendering, draw]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <Video
        ref={videoRef}
        src={videoSrc}
        volume={volume}
        crossOrigin="anonymous"
        startFrom={mediaStartFrame}
        endAt={
          durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined
        }
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1
        }}
      />
      <canvas
        ref={setCanvasRef}
        data-testid="compositor-canvas"
        width={CONTAINER_W}
        height={CONTAINER_H}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${CONTAINER_W}px`,
          height: `${CONTAINER_H}px`,
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
    </div>
  );
};
