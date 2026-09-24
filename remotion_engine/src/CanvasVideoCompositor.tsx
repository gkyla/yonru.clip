import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Video, useCurrentFrame, useRemotionEnvironment, delayRender, continueRender } from 'remotion';

export interface CropMapEntry {
  time: number;
  x: number;
  mode?: 'single' | 'split';
  top_x?: number;
  bottom_x?: number;
}

export interface CanvasVideoCompositorProps {
  videoSrc: string;
  volume: number;
  mediaStartFrame?: number;
  durationFrames?: number;
  fps?: number;
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
  // Dynamic time-anchored framing props
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
}) => {
  const frame = useCurrentFrame();
  const { isRendering } = useRemotionEnvironment();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Dynamically calculate framing from physical playback time to prevent 1-tick layout tearing
  const computeFramingForTime = useCallback((targetTime: number) => {
    if (!cropMap || cropMap.length === 0) {
      return {
        isSplitActive: isSplit,
        curTranslateX: translateX,
        curTranslateY: translateY,
        curTopTranslateX: topTranslateX,
        curTopTranslateY: topTranslateY,
        curBottomTranslateX: bottomTranslateX,
        curBottomTranslateY: bottomTranslateY,
        curScaleTop: currentScaleTop,
        curScaleBottom: currentScaleBottom,
      };
    }

    const timeEpsilon = 0.5 / fps;
    let prevIdx = 0;
    for (let i = 0; i < cropMap.length; i++) {
      if (cropMap[i].time <= targetTime + timeEpsilon) {
        prevIdx = i;
      } else {
        break;
      }
    }

    const prevEntry = cropMap[prevIdx];
    const nextEntry = prevIdx < cropMap.length - 1 ? cropMap[prevIdx + 1] : null;

    let mode = prevEntry.mode || 'single';
    let x = prevEntry.x;
    let top_x = prevEntry.top_x ?? prevEntry.x;
    let bottom_x = prevEntry.bottom_x ?? prevEntry.x;

    const CUT_THRESHOLD = rawSourceW * 0.15;

    if (nextEntry && prevEntry.time !== nextEntry.time) {
      if ((prevEntry.mode || 'single') === (nextEntry.mode || 'single')) {
        const duration = nextEntry.time - prevEntry.time;
        const progress = Math.max(0, Math.min(1, (targetTime - prevEntry.time) / duration));
        const smoothT = progress * progress * (3 - 2 * progress);

        if (mode === 'split') {
          const prevTop = prevEntry.top_x ?? prevEntry.x;
          const nextTop = nextEntry.top_x ?? nextEntry.x;
          const prevBot = prevEntry.bottom_x ?? prevEntry.x;
          const nextBot = nextEntry.bottom_x ?? nextEntry.x;

          top_x = Math.abs(nextTop - prevTop) > CUT_THRESHOLD ? prevTop : prevTop + (nextTop - prevTop) * smoothT;
          bottom_x = Math.abs(nextBot - prevBot) > CUT_THRESHOLD ? prevBot : prevBot + (nextBot - prevBot) * smoothT;
        } else {
          const delta = Math.abs(nextEntry.x - prevEntry.x);
          x = delta > CUT_THRESHOLD ? prevEntry.x : prevEntry.x + (nextEntry.x - prevEntry.x) * smoothT;
        }
      }
    }

    if (cropPercentXTop !== undefined) top_x = (cropPercentXTop / 100) * rawSourceW;
    if (cropPercentXBottom !== undefined) bottom_x = (cropPercentXBottom / 100) * rawSourceW;

    const isSplitActive = !isLandscape && mode === 'split';

    // Single framing transforms
    const maxOffset = Math.max(0, videoDisplayW - CONTAINER_W);
    const singleScale = videoDisplayW / rawSourceW;
    const targetTranslateX = isLandscape ? 0 : (CONTAINER_W / 2) - (x * singleScale);
    const curTranslateX = isLandscape ? 0 : Math.max(-maxOffset, Math.min(0, targetTranslateX));
    const curTranslateY = isLandscape ? (CONTAINER_H - videoDisplayH) / 2 : 0;

    // Top split transforms
    const effectiveZoomTop = Math.max(1.0, Math.min(2.5, splitZoomTop || 1.0));
    const curScaleTop = 0.5 * effectiveZoomTop;
    const topDisplayW = videoDisplayW * curScaleTop;
    const topDisplayH = videoDisplayH * curScaleTop;
    const topMaxOffset = Math.max(0, topDisplayW - CONTAINER_W);
    const topExtraH = Math.max(0, topDisplayH - PANEL_H);
    const topNudgeX = ((splitOffsetXTop || 0) / 100) * (CONTAINER_W * 0.35);
    const targetTopTranslateX = (CONTAINER_W / 2) - ((top_x / rawSourceW) * topDisplayW) + topNudgeX;
    const curTopTranslateX = Math.max(-topMaxOffset, Math.min(0, targetTopTranslateX));
    const baseTopTranslateY = -topExtraH * 0.25;
    const topNudgeY = ((splitOffsetYTop || 0) / 100) * (topExtraH * 0.5);
    const curTopTranslateY = Math.max(-topExtraH, Math.min(0, baseTopTranslateY + topNudgeY));

    // Bottom split transforms
    const effectiveZoomBottom = Math.max(1.0, Math.min(2.5, splitZoomBottom || 1.0));
    const curScaleBottom = 0.5 * effectiveZoomBottom;
    const bottomDisplayW = videoDisplayW * curScaleBottom;
    const bottomDisplayH = videoDisplayH * curScaleBottom;
    const bottomMaxOffset = Math.max(0, bottomDisplayW - CONTAINER_W);
    const bottomExtraH = Math.max(0, bottomDisplayH - PANEL_H);
    const bottomNudgeX = ((splitOffsetXBottom || 0) / 100) * (CONTAINER_W * 0.35);
    const targetBottomTranslateX = (CONTAINER_W / 2) - ((bottom_x / rawSourceW) * bottomDisplayW) + bottomNudgeX;
    const curBottomTranslateX = Math.max(-bottomMaxOffset, Math.min(0, targetBottomTranslateX));
    const baseBottomTranslateY = -bottomExtraH * 0.25;
    const bottomNudgeY = ((splitOffsetYBottom || 0) / 100) * (bottomExtraH * 0.5);
    const curBottomTranslateY = Math.max(-bottomExtraH, Math.min(0, baseBottomTranslateY + bottomNudgeY));

    return {
      isSplitActive,
      curTranslateX,
      curTranslateY,
      curTopTranslateX,
      curTopTranslateY,
      curBottomTranslateX,
      curBottomTranslateY,
      curScaleTop,
      curScaleBottom,
    };
  }, [
    cropMap,
    fps,
    rawSourceW,
    isLandscape,
    isSplit,
    videoDisplayW,
    videoDisplayH,
    CONTAINER_W,
    CONTAINER_H,
    PANEL_H,
    translateX,
    translateY,
    topTranslateX,
    topTranslateY,
    bottomTranslateX,
    bottomTranslateY,
    currentScaleTop,
    currentScaleBottom,
    cropPercentXTop,
    cropPercentXBottom,
    splitZoomTop,
    splitZoomBottom,
    splitOffsetXTop,
    splitOffsetYTop,
    splitOffsetXBottom,
    splitOffsetYBottom,
  ]);

  const draw = useCallback((force: boolean = false, explicitMediaTime?: number) => {
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

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Anchor layout dynamically to the exact physical presentation timestamp (PTS) from video decoder
    const currentTime = (typeof explicitMediaTime === 'number' && !isNaN(explicitMediaTime) && explicitMediaTime >= 0)
      ? explicitMediaTime
      : ((video && !isNaN(video.currentTime) && video.currentTime > 0)
          ? video.currentTime
          : (frame / fps));

    const framing = computeFramingForTime(currentTime);

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

    if (!framing.isSplitActive) {
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
      } catch (err) {
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
    CONTAINER_W,
    CONTAINER_H,
    PANEL_H,
    rawSourceW,
    sourceHeight,
    videoDisplayW,
    frame,
    fps,
    isRendering,
    computeFramingForTime,
  ]);

  // Keep drawRef up-to-date with latest draw callback so rVFC and event listeners never churn
  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Draw on layout effect whenever frame or draw dependencies change
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (video && video.seeking && !isRendering) {
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
    } else {
      draw(false);
    }
  }, [frame, isRendering, draw]);

  // Video event-driven updates (scrubbing, seeking, loadeddata)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => drawRef.current(true, video.currentTime);
    const handleTimeUpdate = () => drawRef.current(false, video.currentTime);
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
    let isActive = true;

    const onFrame = (_now: DOMHighResTimeStamp, metadata: any) => {
      if (!isActive) return;
      const mediaTime = (metadata && typeof metadata.mediaTime === 'number') ? metadata.mediaTime : undefined;
      drawRef.current(false, mediaTime);
      callbackId = (video as any).requestVideoFrameCallback(onFrame);
    };

    callbackId = (video as any).requestVideoFrameCallback(onFrame);

    return () => {
      isActive = false;
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
