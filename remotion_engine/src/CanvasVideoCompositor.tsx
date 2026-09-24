import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Video, useCurrentFrame, useRemotionEnvironment, delayRender, continueRender } from 'remotion';

export interface CanvasVideoCompositorProps {
  videoSrc: string;
  volume: number;
  mediaStartFrame?: number;
  durationFrames?: number;
  CONTAINER_W: number;
  CONTAINER_H: number;
  PANEL_H: number;
  isLandscape: boolean;
  isSplit: boolean;
  videoDisplayW: number;
  videoDisplayH: number;
  rawSourceW: number;
  sourceHeight?: number;
  translateX: number;
  translateY: number;
  topTranslateX: number;
  topTranslateY: number;
  currentScaleTop: number;
  bottomTranslateX: number;
  bottomTranslateY: number;
  currentScaleBottom: number;
}

export const CanvasVideoCompositor: React.FC<CanvasVideoCompositorProps> = ({
  videoSrc,
  volume,
  mediaStartFrame,
  durationFrames,
  CONTAINER_W,
  CONTAINER_H,
  PANEL_H,
  isLandscape,
  isSplit,
  videoDisplayW,
  videoDisplayH,
  rawSourceW,
  sourceHeight,
  translateX,
  translateY,
  topTranslateX,
  topTranslateY,
  currentScaleTop,
  bottomTranslateX,
  bottomTranslateY,
  currentScaleBottom,
}) => {
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((force: boolean = false) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < 2) return;

    // GUARD: During interactive preview / scrubbing, if the video is actively seeking to a new timestamp,
    // do NOT draw stale video texture on top of a newly changed layout mode (eliminates "muka kembar").
    // The 'seeked' event handler will draw the fresh frame as soon as decoding completes.
    if (!force && !isRendering && video.seeking) {
      return;
    }

    const vW = video.videoWidth || rawSourceW || 1920;
    const vH = video.videoHeight || sourceHeight || 1080;
    if (vW === 0 || vH === 0) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    if (isLandscape) {
      // Landscape display: center letterboxed
      const aspect = vW / vH;
      const dw = CONTAINER_W;
      const dh = dw / aspect;
      const dy = (CONTAINER_H - dh) / 2;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, CONTAINER_W, CONTAINER_H);
      try {
        ctx.drawImage(video, 0, 0, vW, vH, 0, dy, dw, dh);
      } catch (err) {
        // Ignored if video texture is still preparing
      }
      return;
    }

    if (!isSplit) {
      // Single-speaker framing (portrait 9:16)
      const scaleFactor = videoDisplayW / vW;
      const sw = CONTAINER_W / scaleFactor;
      const sh = CONTAINER_H / scaleFactor;
      const targetSx = -translateX / scaleFactor;
      const targetSy = -translateY / scaleFactor;
      const sx = Math.max(0, Math.min(vW - sw, targetSx));
      const sy = Math.max(0, Math.min(vH - sh, targetSy));

      try {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CONTAINER_W, CONTAINER_H);
      } catch (err) {
        // Ignored
      }
    } else {
      // Stacked Multi-Speaker Reframe: Draw top and bottom synchronously from the exact same frame
      // 1. Top speaker viewport (0, 0, 1080, PANEL_H)
      const scaleFactorTop = (videoDisplayW / vW) * currentScaleTop;
      const sw_top = CONTAINER_W / scaleFactorTop;
      const sh_top = PANEL_H / scaleFactorTop;
      const targetSxTop = -topTranslateX / scaleFactorTop;
      const targetSyTop = -topTranslateY / scaleFactorTop;
      const sx_top = Math.max(0, Math.min(vW - sw_top, targetSxTop));
      const sy_top = Math.max(0, Math.min(vH - sh_top, targetSyTop));

      // 2. Bottom speaker viewport (0, PANEL_H, 1080, PANEL_H)
      const scaleFactorBot = (videoDisplayW / vW) * currentScaleBottom;
      const sw_bot = CONTAINER_W / scaleFactorBot;
      const sh_bot = PANEL_H / scaleFactorBot;
      const targetSxBot = -bottomTranslateX / scaleFactorBot;
      const targetSyBot = -bottomTranslateY / scaleFactorBot;
      const sx_bot = Math.max(0, Math.min(vW - sw_bot, targetSxBot));
      const sy_bot = Math.max(0, Math.min(vH - sh_bot, targetSyBot));

      try {
        ctx.drawImage(video, sx_top, sy_top, sw_top, sh_top, 0, 0, CONTAINER_W, PANEL_H);
        ctx.drawImage(video, sx_bot, sy_bot, sw_bot, sh_bot, 0, PANEL_H, CONTAINER_W, PANEL_H);

        // Center Seam Divider (2px dark line with subtle shadow)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, PANEL_H - 1, CONTAINER_W, 2);
      } catch (err) {
        // Ignored
      }
    }
  }, [
    isLandscape,
    isSplit,
    CONTAINER_W,
    CONTAINER_H,
    PANEL_H,
    rawSourceW,
    sourceHeight,
    videoDisplayW,
    currentScaleTop,
    currentScaleBottom,
    translateX,
    translateY,
    topTranslateX,
    topTranslateY,
    bottomTranslateX,
    bottomTranslateY,
    isRendering,
  ]);

  // Draw on layout effect whenever frame or draw dependencies change
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (video && video.seeking && !isRendering) {
      let cancelled = false;
      const onSeeked = () => {
        if (!cancelled) draw(true);
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      const timer = setTimeout(() => {
        if (!cancelled) draw(true);
      }, 150);
      return () => {
        cancelled = true;
        video.removeEventListener('seeked', onSeeked);
        clearTimeout(timer);
      };
    } else {
      draw();
    }
  }, [frame, isRendering, draw]);

  // Video event-driven updates (scrubbing, seeking, loadeddata)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => draw(true);
    const handleTimeUpdate = () => draw();
    const handleLoadedData = () => draw();

    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [draw]);

  // High-performance playback sync via requestVideoFrameCallback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !('requestVideoFrameCallback' in video)) return;

    let callbackId: number;
    let isActive = true;

    const onFrame = () => {
      if (!isActive) return;
      draw();
      callbackId = (video as any).requestVideoFrameCallback(onFrame);
    };

    callbackId = (video as any).requestVideoFrameCallback(onFrame);

    return () => {
      isActive = false;
      if (callbackId && 'cancelVideoFrameCallback' in video) {
        (video as any).cancelVideoFrameCallback(callbackId);
      }
    };
  }, [draw]);

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
        endAt={durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
      <canvas
        ref={canvasRef}
        width={CONTAINER_W}
        height={CONTAINER_H}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${CONTAINER_W}px`,
          height: `${CONTAINER_H}px`,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    </div>
  );
};
