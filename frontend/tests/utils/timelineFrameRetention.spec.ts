import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  coalesceContiguousVideoSegments,
  getSegmentFrameWindow,
  isMainVideoFrameCovered,
  isInitialDecoderFrameAligned,
  TimelineFrameRetention
} from '@yonru/remotion';

describe('Timeline Frame Retention & Contiguous Segment Coalescing', () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('coalesces unsorted contiguous split segments while preserving trimmed jump cuts and timeline gaps', () => {
    const rawItems = [
      { id: 'main-video', start: 0, mediaStart: 0, duration: 1.38 },
      { id: 'bd2nfay38', start: 4.87, mediaStart: 10.78, duration: 51.22 },
      {
        id: 'a0xad3cjp',
        start: 1.38,
        mediaStart: 1.38,
        duration: 2.8200000000000003
      }
    ];

    const coalesced = coalesceContiguousVideoSegments(rawItems);
    expect(coalesced).toHaveLength(2);
    expect(coalesced[0].id).toBe('main-video');
    expect(coalesced[0].start).toBeCloseTo(0, 6);
    expect(coalesced[0].mediaStart).toBeCloseTo(0, 6);
    expect(coalesced[0].duration).toBeCloseTo(4.2, 6);

    expect(coalesced[1].id).toBe('bd2nfay38');
    expect(coalesced[1].start).toBeCloseTo(4.87, 6);
    expect(coalesced[1].mediaStart).toBeCloseTo(10.78, 6);
    expect(coalesced[1].duration).toBeCloseTo(51.22, 6);

    // Adjacent on timeline, but mediaStart jumps (trimmed ripple delete): MUST NOT coalesce
    const jumpCutItems = [
      { id: 'seg-1', start: 0, mediaStart: 0, duration: 4.2 },
      { id: 'seg-2', start: 4.2, mediaStart: 10.78, duration: 5.0 }
    ];
    expect(coalesceContiguousVideoSegments(jumpCutItems)).toHaveLength(2);

    // Contiguous mediaStart, but separated by timeline gap: MUST NOT coalesce
    const gappedItems = [
      { id: 'seg-1', start: 0, mediaStart: 0, duration: 4.2 },
      { id: 'seg-2', start: 4.5, mediaStart: 4.2, duration: 5.0 }
    ];
    expect(coalesceContiguousVideoSegments(gappedItems)).toHaveLength(2);
  });

  it('computes exact half-open frame partitions without 1-frame rounding gaps or overlaps', () => {
    const fps = 30;
    // 0.51 * 30 = 15.3 -> round(15.3) = 15, whereas 1.02 * 30 = 30.6 -> round(30.6) = 31.
    // Independent duration rounding would yield 15 + 15 = 30 (leaving frame 30 uncovered!).
    const fractionalJumpSegments = [
      { id: 'seg-1', start: 0, duration: 0.51, mediaStart: 0 },
      { id: 'seg-2', start: 0.51, duration: 0.51, mediaStart: 3.0 }
    ];
    const win1 = getSegmentFrameWindow(fractionalJumpSegments[0], fps);
    const win2 = getSegmentFrameWindow(fractionalJumpSegments[1], fps);

    expect(win1.startFrame).toBe(0);
    expect(win1.endFrame).toBe(15);
    expect(win1.durationFrames).toBe(15);

    expect(win2.startFrame).toBe(15);
    expect(win2.endFrame).toBe(31);
    expect(win2.durationFrames).toBe(16);

    expect(isMainVideoFrameCovered(15, fractionalJumpSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(30, fractionalJumpSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(31, fractionalJumpSegments, fps)).toBe(
      false
    );

    // 0.49 * 30 = 14.7 -> round = 15; 0.98 * 30 = 29.4 -> round = 29.
    // Cumulative endFrame ensures seg-2 ends at 29 and seg-3 starts at 29 with zero overlap!
    const overlapProneSegments = [
      { id: 's1', start: 0, duration: 0.49, mediaStart: 0 },
      { id: 's2', start: 0.49, duration: 0.49, mediaStart: 2 },
      { id: 's3', start: 0.98, duration: 1.02, mediaStart: 5 }
    ];
    const w2 = getSegmentFrameWindow(overlapProneSegments[1], fps);
    const w3 = getSegmentFrameWindow(overlapProneSegments[2], fps);
    expect(w2.endFrame).toBe(w3.startFrame);
  });

  it('treats adjacent cut boundaries as covered while marking empty timeline gaps as uncovered', () => {
    const fps = 30;
    const adjacentSegments = [
      { id: 'seg-1', start: 0, duration: 5, mediaStart: 0 },
      { id: 'seg-2', start: 5, duration: 5, mediaStart: 8 }
    ];

    expect(isMainVideoFrameCovered(0, adjacentSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(149, adjacentSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(150, adjacentSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(299, adjacentSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(300, adjacentSegments, fps)).toBe(false);

    const gappedSegments = [
      { id: 'seg-1', start: 0, duration: 4, mediaStart: 0 },
      { id: 'seg-2', start: 6, duration: 4, mediaStart: 4 }
    ];
    expect(isMainVideoFrameCovered(119, gappedSegments, fps)).toBe(true);
    expect(isMainVideoFrameCovered(150, gappedSegments, fps)).toBe(false);
    expect(isMainVideoFrameCovered(180, gappedSegments, fps)).toBe(true);

    expect(isMainVideoFrameCovered(42, [], fps)).toBe(true);
    expect(isMainVideoFrameCovered(-1, adjacentSegments, fps)).toBe(false);
  });

  it('guards against unseeked 0.0s frames on backward segment mount while allowing aligned and clamped frames', () => {
    expect(
      isInitialDecoderFrameAligned({
        currentTime: 0,
        expectedMediaTime: 4.95,
        duration: 10,
        paused: true
      })
    ).toBe(false);

    expect(
      isInitialDecoderFrameAligned({
        currentTime: 4.94,
        expectedMediaTime: 4.95,
        duration: 10,
        paused: true
      })
    ).toBe(true);

    expect(
      isInitialDecoderFrameAligned({
        currentTime: 9.8,
        expectedMediaTime: 9.99,
        duration: 9.85,
        paused: true
      })
    ).toBe(true);

    expect(
      isInitialDecoderFrameAligned({
        currentTime: 0,
        expectedMediaTime: 4.95,
        duration: 10,
        paused: true,
        fallbackUnlocked: true
      })
    ).toBe(true);
  });

  it('retains last composited frame across adjacent segment unmounts, hides on timeline gaps, and resets on videoSrc change', () => {
    const drawImageSpy = vi.fn();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        drawImage: drawImageSpy,
        fillRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn()
      } as unknown as CanvasRenderingContext2D);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const segments = [
      { id: 'seg-1', start: 0, duration: 5, mediaStart: 0 },
      { id: 'seg-2', start: 5, duration: 1, mediaStart: 8 },
      { id: 'seg-3', start: 7, duration: 3, mediaStart: 12 }
    ];

    let capturedCallback: ((canvas: HTMLCanvasElement) => void) | null = null;

    const renderScene = (frame: number, src: string, activeSegId: string) => {
      act(() => {
        root.render(
          React.createElement(
            TimelineFrameRetention,
            {
              videoSrc: src,
              width: 1080,
              height: 1920,
              mainVideoFrame: frame,
              fps: 30,
              timelineVideoItems: segments
            },
            (onFrameRendered: (canvas: HTMLCanvasElement) => void) => {
              capturedCallback = onFrameRendered;
              return React.createElement('canvas', {
                key: activeSegId,
                'data-testid': `segment-canvas-${activeSegId}`
              });
            }
          )
        );
      });
    };

    try {
      renderScene(149, 'http://localhost/clip-a.mp4', 'seg-1');
      const retentionCanvas = container.querySelector(
        '[data-testid="timeline-retention-canvas"]'
      ) as HTMLCanvasElement;
      expect(retentionCanvas).toBeTruthy();
      expect(retentionCanvas.style.opacity).toBe('0');

      const seg1Canvas = container.querySelector(
        '[data-testid="segment-canvas-seg-1"]'
      ) as HTMLCanvasElement;
      act(() => {
        capturedCallback!(seg1Canvas);
      });
      expect(drawImageSpy).toHaveBeenCalledWith(seg1Canvas, 0, 0, 1080, 1920);
      expect(retentionCanvas.style.opacity).toBe('1');

      renderScene(150, 'http://localhost/clip-a.mp4', 'seg-2');
      expect(
        container.querySelector('[data-testid="segment-canvas-seg-1"]')
      ).toBeNull();
      expect(retentionCanvas.style.opacity).toBe('1');

      renderScene(195, 'http://localhost/clip-a.mp4', 'none');
      expect(retentionCanvas.style.opacity).toBe('0');

      renderScene(210, 'http://localhost/clip-a.mp4', 'seg-3');
      expect(retentionCanvas.style.opacity).toBe('1');

      renderScene(0, 'http://localhost/clip-b.mp4', 'seg-1');
      expect(retentionCanvas.style.opacity).toBe('0');
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      getContextSpy.mockRestore();
    }
  });
});
