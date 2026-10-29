import React, { useRef, useCallback, useLayoutEffect } from 'react';

export interface TimelineVideoSegmentBounds {
  id?: string;
  start: number;
  duration: number;
  mediaStart?: number;
}

export interface SegmentFrameWindow {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  mediaStartFrame: number;
}

export function getSegmentFrameWindow(
  segment: TimelineVideoSegmentBounds,
  fps: number
): SegmentFrameWindow {
  const startFrame = Math.round(segment.start * fps);
  const endFrame = Math.round((segment.start + segment.duration) * fps);
  const durationFrames = Math.max(0, endFrame - startFrame);
  const mediaStartFrame = Math.round((segment.mediaStart ?? 0) * fps);
  return {
    startFrame,
    endFrame,
    durationFrames,
    mediaStartFrame
  };
}

export function coalesceContiguousVideoSegments<
  T extends TimelineVideoSegmentBounds
>(items: readonly T[] | undefined, contiguityEpsilon: number = 0.005): T[] {
  if (!items || items.length === 0) {
    return [];
  }

  const validSorted = items
    .filter(
      item =>
        item &&
        typeof item.start === 'number' &&
        Number.isFinite(item.start) &&
        typeof item.duration === 'number' &&
        Number.isFinite(item.duration) &&
        item.duration > 0
    )
    .slice()
    .sort((a, b) => a.start - b.start);

  if (validSorted.length === 0) {
    return [];
  }

  const coalesced: T[] = [{ ...validSorted[0] }];

  for (let i = 1; i < validSorted.length; i++) {
    const prev = coalesced[coalesced.length - 1];
    const next = validSorted[i];

    const prevTimelineEnd = prev.start + prev.duration;
    const prevMediaStart = prev.mediaStart ?? 0;
    const prevMediaEnd = prevMediaStart + prev.duration;
    const nextMediaStart = next.mediaStart ?? 0;

    const isTimelineContiguous =
      Math.abs(next.start - prevTimelineEnd) <= contiguityEpsilon;
    const isMediaContiguous =
      Math.abs(nextMediaStart - prevMediaEnd) <= contiguityEpsilon;

    if (isTimelineContiguous && isMediaContiguous) {
      const mergedEnd = Math.max(prevTimelineEnd, next.start + next.duration);
      prev.duration = mergedEnd - prev.start;
    } else {
      coalesced.push({ ...next });
    }
  }

  return coalesced;
}

export function isMainVideoFrameCovered(
  mainVideoFrame: number,
  timelineVideoItems: TimelineVideoSegmentBounds[] | undefined,
  fps: number
): boolean {
  if (mainVideoFrame < 0) {
    return false;
  }
  if (!timelineVideoItems || timelineVideoItems.length === 0) {
    return true;
  }
  return timelineVideoItems.some(item => {
    const { startFrame, endFrame, durationFrames } = getSegmentFrameWindow(
      item,
      fps
    );
    return (
      durationFrames > 0 &&
      mainVideoFrame >= startFrame &&
      mainVideoFrame < endFrame
    );
  });
}

export function resolveTimelineMediaTime(
  mainVideoFrame: number,
  timelineVideoItems: readonly TimelineVideoSegmentBounds[] | undefined,
  fps: number
): number {
  const safeFps = fps > 0 ? fps : 30;
  const clampedFrame = Math.max(0, mainVideoFrame);

  if (!timelineVideoItems || timelineVideoItems.length === 0) {
    return clampedFrame / safeFps;
  }

  const coalesced = coalesceContiguousVideoSegments(timelineVideoItems);
  if (coalesced.length === 0) {
    return clampedFrame / safeFps;
  }

  const firstWin = getSegmentFrameWindow(coalesced[0], safeFps);
  if (clampedFrame < firstWin.startFrame) {
    return firstWin.mediaStartFrame / safeFps;
  }

  let lastPriorWin: SegmentFrameWindow | null = null;
  for (const item of coalesced) {
    const win = getSegmentFrameWindow(item, safeFps);
    if (win.durationFrames <= 0) {
      continue;
    }
    if (clampedFrame >= win.startFrame && clampedFrame < win.endFrame) {
      return (win.mediaStartFrame + (clampedFrame - win.startFrame)) / safeFps;
    }
    if (clampedFrame >= win.endFrame) {
      lastPriorWin = win;
    }
  }

  if (lastPriorWin) {
    return (
      (lastPriorWin.mediaStartFrame + lastPriorWin.durationFrames) / safeFps
    );
  }

  return clampedFrame / safeFps;
}

export interface InitialDecoderFrameAlignmentParams {
  currentTime: number;
  expectedMediaTime: number;
  duration?: number;
  paused: boolean;
  fallbackUnlocked?: boolean;
}

export function isInitialDecoderFrameAligned({
  currentTime,
  expectedMediaTime,
  duration,
  paused,
  fallbackUnlocked = false
}: InitialDecoderFrameAlignmentParams): boolean {
  if (fallbackUnlocked) {
    return true;
  }

  const safeExpected = Math.max(0, expectedMediaTime);
  const clampedExpected =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? Math.min(safeExpected, Math.max(0, duration - 0.05))
      : safeExpected;

  const tolerance = paused ? 0.35 : 0.75;
  return Math.abs(currentTime - clampedExpected) <= tolerance;
}

export interface TimelineFrameRetentionProps {
  videoSrc: string;
  width: number;
  height: number;
  mainVideoFrame: number;
  fps: number;
  timelineVideoItems?: TimelineVideoSegmentBounds[];
  children: (
    onFrameRendered: (sourceCanvas: HTMLCanvasElement) => void
  ) => React.ReactNode;
}

export const TimelineFrameRetention: React.FC<TimelineFrameRetentionProps> = ({
  videoSrc,
  width,
  height,
  mainVideoFrame,
  fps,
  timelineVideoItems,
  children
}) => {
  const retentionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasRetainedFrameRef = useRef<boolean>(false);
  const lastVideoSrcRef = useRef<string>(videoSrc);

  if (lastVideoSrcRef.current !== videoSrc) {
    lastVideoSrcRef.current = videoSrc;
    hasRetainedFrameRef.current = false;
  }

  const isCovered = isMainVideoFrameCovered(
    mainVideoFrame,
    timelineVideoItems,
    fps
  );
  const isCoveredRef = useRef<boolean>(isCovered);
  isCoveredRef.current = isCovered;

  const syncVisibility = useCallback(() => {
    const el = retentionCanvasRef.current;
    if (!el) return;
    el.style.opacity =
      isCoveredRef.current && hasRetainedFrameRef.current ? '1' : '0';
  }, []);

  const setRetentionCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    retentionCanvasRef.current = el;
    if (el) {
      el.style.opacity =
        isCoveredRef.current && hasRetainedFrameRef.current ? '1' : '0';
    }
  }, []);

  useLayoutEffect(() => {
    syncVisibility();
  }, [isCovered, videoSrc, syncVisibility]);

  const handleFrameRendered = useCallback(
    (sourceCanvas: HTMLCanvasElement) => {
      const retentionCanvas = retentionCanvasRef.current;
      if (!retentionCanvas || !sourceCanvas) return;
      const ctx = retentionCanvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      try {
        ctx.drawImage(sourceCanvas, 0, 0, width, height);
        hasRetainedFrameRef.current = true;
        syncVisibility();
      } catch {
        // Ignore transient texture read failure
      }
    },
    [width, height, syncVisibility]
  );

  return (
    <>
      <canvas
        ref={setRetentionCanvasRef}
        data-testid="timeline-retention-canvas"
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${width}px`,
          height: `${height}px`,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      {children(handleFrameRendered)}
    </>
  );
};
