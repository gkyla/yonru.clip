/** @jsxImportSource react */
import React, { useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  coalesceContiguousVideoSegments,
  createTimelineSegmentIndex,
  getOrCreateTimelineSegmentIndex,
  getSegmentFrameWindow,
  TimelineSegmentIndex,
  type SegmentFrameWindow,
  type TimelineVideoSegmentBounds
} from './TimelineFramingIndex';

export {
  coalesceContiguousVideoSegments,
  createTimelineSegmentIndex,
  getOrCreateTimelineSegmentIndex,
  getSegmentFrameWindow,
  TimelineSegmentIndex
};
export type { SegmentFrameWindow, TimelineVideoSegmentBounds };

const NOOP_ON_FRAME_RENDERED = (_sourceCanvas: HTMLCanvasElement): void => {};

export function isMainVideoFrameCovered(
  mainVideoFrame: number,
  timelineVideoItems: readonly TimelineVideoSegmentBounds[] | undefined,
  fps: number
): boolean {
  return getOrCreateTimelineSegmentIndex(
    timelineVideoItems,
    fps
  ).isFrameCovered(mainVideoFrame);
}

export function resolveTimelineMediaTime(
  mainVideoFrame: number,
  timelineVideoItems: readonly TimelineVideoSegmentBounds[] | undefined,
  fps: number
): number {
  return getOrCreateTimelineSegmentIndex(
    timelineVideoItems,
    fps
  ).resolveMediaTime(mainVideoFrame);
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
  timelineVideoItems?: readonly TimelineVideoSegmentBounds[];
  segmentIndex?: TimelineSegmentIndex;
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
  segmentIndex,
  children
}) => {
  const retentionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const retentionCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const hasRetainedFrameRef = useRef<boolean>(false);
  const lastVideoSrcRef = useRef<string>(videoSrc);

  const fallbackIndex = useMemo(
    () =>
      segmentIndex ? null : createTimelineSegmentIndex(timelineVideoItems, fps),
    [segmentIndex, timelineVideoItems, fps]
  );
  const activeIndex = segmentIndex ?? fallbackIndex!;
  const needsRetention = activeIndex.needsRetention;

  if (lastVideoSrcRef.current !== videoSrc) {
    lastVideoSrcRef.current = videoSrc;
    hasRetainedFrameRef.current = false;
  }
  if (!needsRetention) {
    hasRetainedFrameRef.current = false;
  }

  const isCovered = needsRetention
    ? activeIndex.isFrameCovered(mainVideoFrame)
    : true;
  const isCoveredRef = useRef<boolean>(isCovered);
  isCoveredRef.current = isCovered;

  const syncVisibility = useCallback(() => {
    const el = retentionCanvasRef.current;
    if (!el) return;
    el.style.opacity =
      isCoveredRef.current && hasRetainedFrameRef.current ? '1' : '0';
  }, []);

  const setRetentionCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    if (retentionCanvasRef.current !== el) {
      retentionCanvasRef.current = el;
      retentionCtxRef.current = el
        ? el.getContext('2d', { alpha: false })
        : null;
    }
    if (el) {
      el.style.opacity =
        isCoveredRef.current && hasRetainedFrameRef.current ? '1' : '0';
    }
  }, []);

  useLayoutEffect(() => {
    if (needsRetention) {
      syncVisibility();
    }
  }, [needsRetention, isCovered, videoSrc, syncVisibility]);

  const handleFrameRendered = useCallback(
    (sourceCanvas: HTMLCanvasElement) => {
      const retentionCanvas = retentionCanvasRef.current;
      if (!retentionCanvas || !sourceCanvas) return;
      const ctx =
        retentionCtxRef.current ??
        (retentionCtxRef.current = retentionCanvas.getContext('2d', {
          alpha: false
        }));
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
      {needsRetention && (
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
      )}
      {children(needsRetention ? handleFrameRendered : NOOP_ON_FRAME_RENDERED)}
    </>
  );
};
