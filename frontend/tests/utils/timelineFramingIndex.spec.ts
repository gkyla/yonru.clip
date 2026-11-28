import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const SubtitleFrameContext = React.createContext<number>(0);

vi.mock('remotion', () => {
  const ReactLib = React;
  return {
    useCurrentFrame: () => ReactLib.useContext(SubtitleFrameContext),
    useVideoConfig: () => ({
      fps: 30,
      width: 1080,
      height: 1920,
      durationInFrames: 300
    }),
    spring: () => 1,
    interpolate: (_v: number, _i: number[], out: number[]) =>
      Array.isArray(out) ? (out[out.length - 1] ?? 1) : 1
  };
});

import { AnimatedSubtitles } from '@yonru/remotion/AnimatedSubtitles';
import { DEFAULT_SUBTITLE_STYLE } from '@yonru/remotion/types';
import {
  TimelineSegmentIndex,
  CropMapIndex,
  TimelineFramingIndex,
  SubtitleChunkIndex,
  CensoredAudioIndex,
  createTimelineSegmentIndex,
  getOrCreateTimelineSegmentIndex,
  createCropMapIndex,
  getOrCreateCropMapIndex,
  createTimelineFramingIndex,
  createSubtitleChunkIndex,
  createCensoredAudioIndex,
  mergeCensoredSegments,
  indexTimelineTextLayers,
  computeViewportFraming
} from '@yonru/remotion/TimelineFramingIndex';

describe('TimelineFramingIndex module', () => {
  describe('TimelineSegmentIndex', () => {
    it('sets needsRetention to false for empty, single, or contiguous coalescable segments and true for multi-segment timelines', () => {
      expect(createTimelineSegmentIndex([], 30).needsRetention).toBe(false);
      expect(
        createTimelineSegmentIndex(
          [{ id: 's1', start: 0, duration: 10, mediaStart: 0 }],
          30
        ).needsRetention
      ).toBe(false);

      // Two contiguous segments coalesce into 1 window -> no retention needed
      const contiguous = createTimelineSegmentIndex(
        [
          { id: 's1', start: 0, duration: 4, mediaStart: 0 },
          { id: 's2', start: 4, duration: 6, mediaStart: 4 }
        ],
        30
      );
      expect(contiguous.windows).toHaveLength(1);
      expect(contiguous.needsRetention).toBe(false);

      // Jump cut produces 2 windows -> retention needed
      const jumpCut = createTimelineSegmentIndex(
        [
          { id: 's1', start: 0, duration: 4, mediaStart: 0 },
          { id: 's2', start: 4, duration: 6, mediaStart: 10 }
        ],
        30
      );
      expect(jumpCut.windows).toHaveLength(2);
      expect(jumpCut.needsRetention).toBe(true);
    });

    it('handles empty vs zero-duration non-empty segments in isFrameCovered and resolves media time across cuts and gaps', () => {
      const emptyIdx = createTimelineSegmentIndex([], 30);
      expect(emptyIdx.isFrameCovered(0)).toBe(true);
      expect(emptyIdx.isFrameCovered(42)).toBe(true);
      expect(emptyIdx.isFrameCovered(-1)).toBe(false);
      expect(emptyIdx.resolveMediaTime(45)).toBeCloseTo(1.5, 6);

      const zeroDurIdx = createTimelineSegmentIndex(
        [{ id: 'z', start: 0, duration: 0, mediaStart: 0 }],
        30
      );
      expect(zeroDurIdx.isFrameCovered(0)).toBe(false);

      const segs = [
        { id: 's1', start: 1, duration: 3, mediaStart: 2 },
        { id: 's2', start: 5, duration: 4, mediaStart: 10 },
        { id: 's3', start: 9, duration: 2, mediaStart: 20 }
      ];
      const idx = createTimelineSegmentIndex(segs, 30);

      // Before first segment holds first mediaStart
      expect(idx.isFrameCovered(10)).toBe(false);
      expect(idx.resolveMediaTime(10)).toBeCloseTo(2.0, 6);

      // Sequential forward scan across s1 -> gap -> s2 -> s3 -> past end
      expect(idx.isFrameCovered(30)).toBe(true);
      expect(idx.resolveMediaTime(60)).toBeCloseTo(3.0, 6);
      expect(idx.isFrameCovered(120)).toBe(false); // gap [4s, 5s)
      expect(idx.resolveMediaTime(135)).toBeCloseTo(5.0, 6); // holds end of s1 (2 + 3 = 5)
      expect(idx.isFrameCovered(150)).toBe(true);
      expect(idx.resolveMediaTime(180)).toBeCloseTo(11.0, 6);
      expect(idx.isFrameCovered(270)).toBe(true);
      expect(idx.resolveMediaTime(300)).toBeCloseTo(21.0, 6);
      expect(idx.isFrameCovered(330)).toBe(false);
      expect(idx.resolveMediaTime(360)).toBeCloseTo(22.0, 6);

      // Random backward seek
      expect(idx.isFrameCovered(45)).toBe(true);
      expect(idx.resolveMediaTime(45)).toBeCloseTo(2.5, 6);
    });

    it('caches indexes per segment array reference and fps via getOrCreateTimelineSegmentIndex', () => {
      const segs = [{ id: 's1', start: 0, duration: 5, mediaStart: 0 }];
      const a = getOrCreateTimelineSegmentIndex(segs, 30);
      const b = getOrCreateTimelineSegmentIndex(segs, 30);
      const c = getOrCreateTimelineSegmentIndex(segs, 60);
      expect(a).toBeInstanceOf(TimelineSegmentIndex);
      expect(a).toBe(b);
      expect(c).not.toBe(a);
    });
  });

  describe('CropMapIndex', () => {
    it('supports O(1) sequential cursor and O(log N) random seeks with epsilon and duplicate timestamp parity', () => {
      const raw = [
        { time: 10, x: 1400, mode: 'single' as const },
        { time: 2, x: 500, mode: 'single' as const },
        {
          time: 5,
          x: 900,
          mode: 'split' as const,
          top_x: 400,
          bottom_x: 1300
        },
        {
          time: 5,
          x: 960,
          mode: 'split' as const,
          top_x: 450,
          bottom_x: 1350
        }
      ];
      const idx = createCropMapIndex(raw);
      expect(idx).toBeInstanceOf(CropMapIndex);
      // Caller's array must not be mutated
      expect(raw[0]?.time).toBe(10);

      // Before first entry clamps to index 0
      expect(idx.findPrevIndex(0.5)).toBe(0);
      expect(idx.getEntryAt(0.5)?.x).toBe(500);

      // 1ms epsilon hits entry at t=2
      expect(idx.findPrevIndex(1.9995)).toBe(0);
      expect(idx.isSplitAt(1.9995)).toBe(false);

      // Duplicate timestamp at t=5 returns the LAST matching entry (index 2)
      expect(idx.findPrevIndex(5.0)).toBe(2);
      expect(idx.getEntryAt(5.0)?.top_x).toBe(450);
      expect(idx.isSplitAt(5.0)).toBe(true);

      // Forward jump to t=10+
      expect(idx.findPrevIndex(12.0)).toBe(3);
      expect(idx.isSplitAt(12.0)).toBe(false);

      // Backward step to t=6.5 (between 5 and 10)
      expect(idx.findPrevIndex(6.5)).toBe(2);

      // Split windows collapse contiguous split entries
      expect(idx.getSplitWindows()).toEqual([{ start: 5, end: 10 }]);
    });

    it('reuses cached CropMapIndex for unchanged array references', () => {
      const map = [{ time: 0, x: 960, mode: 'single' as const }];
      expect(getOrCreateCropMapIndex(map)).toBe(getOrCreateCropMapIndex(map));
    });
  });

  describe('TimelineFramingIndex', () => {
    it('matches computeViewportFraming across single, smooth interpolated, cut-threshold, split, manual override, and empty cropMap cases', () => {
      const cropMap = [
        { time: 0, x: 500, mode: 'single' as const },
        { time: 1, x: 560, mode: 'single' as const },
        { time: 2, x: 1400, mode: 'single' as const }, // jump > 0.15 * 1920 = 288 -> snap, no interp
        {
          time: 3,
          x: 960,
          mode: 'split' as const,
          top_x: 400,
          bottom_x: 1400
        },
        {
          time: 4,
          x: 960,
          mode: 'split' as const,
          top_x: 460,
          bottom_x: 1340
        }
      ];
      const baseParams = {
        cropMap,
        cropX: 960,
        splitZoomTop: 1.4,
        splitZoomBottom: 1.2,
        splitOffsetXTop: 10,
        splitOffsetYTop: -20,
        splitOffsetXBottom: -5,
        splitOffsetYBottom: 15,
        rawSourceW: 1920,
        isLandscape: false,
        videoDisplayW: 1920 * (1920 / 1080),
        videoDisplayH: 1920,
        CONTAINER_W: 1080,
        CONTAINER_H: 1920,
        PANEL_H: 960
      };

      const index = createTimelineFramingIndex(baseParams);
      expect(index.hasCropMap).toBe(true);

      for (const t of [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0]) {
        const expected = computeViewportFraming(t, baseParams);
        const actual = index.computeFraming(t);
        expect(actual).toEqual(expected);
        expect(index.isSplitAt(t)).toBe(expected.isSplitActive);
      }

      // Empty cropMap fast path returns identical static framing
      const staticParams = {
        ...baseParams,
        cropMap: [],
        cropPercentXTop: 25,
        cropPercentXBottom: 75
      };
      const staticIndex = createTimelineFramingIndex(staticParams);
      expect(staticIndex.hasCropMap).toBe(false);
      expect(staticIndex.computeFraming(0)).toEqual(
        computeViewportFraming(0, staticParams)
      );
      expect(staticIndex.computeFraming(12.3)).toBe(
        staticIndex.computeFraming(0)
      );
    });

    it('short-circuits landscape clips with non-empty split cropMaps to the cached static single result', () => {
      const landscapeParams = {
        cropMap: [
          {
            time: 0,
            x: 500,
            mode: 'split' as const,
            top_x: 300,
            bottom_x: 1500
          },
          {
            time: 2,
            x: 1400,
            mode: 'split' as const,
            top_x: 400,
            bottom_x: 1600
          }
        ],
        cropX: 960,
        rawSourceW: 1920,
        isLandscape: true,
        videoDisplayW: 1080,
        videoDisplayH: 607.5,
        CONTAINER_W: 1080,
        CONTAINER_H: 1920,
        PANEL_H: 960
      };

      const index = createTimelineFramingIndex(landscapeParams);
      const t0 = index.computeFraming(0);
      const t2 = index.computeFraming(2.5);

      expect(t0).toEqual(computeViewportFraming(0, landscapeParams));
      expect(t2).toEqual(computeViewportFraming(2.5, landscapeParams));
      expect(t0.isSplitActive).toBe(false);
      expect(t0.curTranslateX).toBe(0);
      expect(index.isSplitAt(2.5)).toBe(false);
      expect(t2).toBe(t0);
    });
  });

  describe('CensoredAudioIndex and mergeCensoredSegments', () => {
    it('normalizes, clamps, merges within 5ms tolerance, and leaves caller arrays untouched', () => {
      const raw = [
        { start: 5.0, duration: 0.4 },
        { start: -0.25, duration: 0.75 },
        { start: 0.5041, duration: 0.3 },
        { start: 1.5, duration: 0 },
        { start: Number.NaN, duration: 1.0 },
        { start: -2.0, duration: 1.0 }
      ];
      const snapshot = raw.map(item => ({ ...item }));

      const merged = mergeCensoredSegments(raw);

      expect(raw).toEqual(snapshot);
      expect(merged).toEqual([
        { start: 0, duration: 0.804 },
        { start: 5, duration: 0.4 }
      ]);
    });

    it('builds MainVideo-relative bleepWindows and resolves volume envelopes across sequential/random lookups and short segments', () => {
      const emptyIndex = createCensoredAudioIndex([], 30);
      expect(emptyIndex.isEmpty).toBe(true);
      expect(emptyIndex.bleepWindows).toEqual([]);
      expect(emptyIndex.createSegmentVolume(0.75, 150)).toBe(0.75);

      const index = createCensoredAudioIndex(
        [
          { start: 1.0, duration: 0.5 },
          { start: 2.0, duration: 0.02 },
          { start: 7.0, duration: 0.5 }
        ],
        30
      );
      expect(index).toBeInstanceOf(CensoredAudioIndex);
      expect(index.isEmpty).toBe(false);
      expect(index.bleepWindows).toEqual([
        {
          start: 1.0,
          duration: 0.5,
          end: 1.5,
          startFrame: 30,
          durationFrames: 15
        },
        {
          start: 2.0,
          duration: 0.02,
          end: 2.02,
          startFrame: 60,
          durationFrames: 1
        },
        {
          start: 7.0,
          duration: 0.5,
          end: 7.5,
          startFrame: 210,
          durationFrames: 15
        }
      ]);

      // Entry/exit 15ms micro-envelope + center hold on standard segment
      expect(index.resolveVolumeAtTime(0.5, 0.8)).toBe(0.8);
      expect(index.resolveVolumeAtTime(1.0, 0.8)).toBeCloseTo(0.8, 6);
      expect(index.resolveVolumeAtTime(1.0075, 0.8)).toBeCloseTo(0.4, 6);
      expect(index.resolveVolumeAtTime(1.25, 0.8)).toBe(0);
      expect(index.resolveVolumeAtTime(1.4925, 0.8)).toBeCloseTo(0.4, 6);
      expect(index.resolveVolumeAtTime(1.5, 0.8)).toBeCloseTo(0.8, 6);

      // Clamped micro-envelope on <30ms segment (20ms -> 10ms fade each side)
      expect(index.resolveVolumeAtTime(2.005, 1.0)).toBeCloseTo(0.5, 6);
      expect(index.resolveVolumeAtTime(2.01, 1.0)).toBe(0);
      expect(index.resolveVolumeAtTime(2.015, 1.0)).toBeCloseTo(0.5, 6);

      // Backward seek & gap checks
      expect(index.resolveVolumeAtTime(1.8, 0.8)).toBe(0.8);
      expect(index.resolveVolumeAtTime(1.2, 0.8)).toBe(0);

      // Segment-local volume closures map (segmentStartFrame + localFrame) / fps
      const seg0Vol = index.createSegmentVolume(0.8, 0);
      const seg2Vol = index.createSegmentVolume(0.8, 150);
      expect(typeof seg0Vol).toBe('function');
      expect(typeof seg2Vol).toBe('function');
      if (typeof seg0Vol === 'function' && typeof seg2Vol === 'function') {
        expect(seg0Vol(37)).toBe(0); // frame 37 = 1.233s
        expect(seg0Vol(67)).toBe(0.8); // frame 67 = 2.233s
        expect(seg2Vol(67)).toBe(0); // 150 + 67 = 217 = 7.233s
      }
    });
  });

  describe('indexTimelineTextLayers', () => {
    it('computes Sequence frame bounds, clamps negative starts, skips non-positive frames, and preserves z-order', () => {
      const layers = indexTimelineTextLayers(
        [
          { id: 't-neg', start: -0.5, duration: 2 },
          { id: 't-skip-expired', start: -2, duration: 1 },
          { id: 't-skip-zero', start: 1, duration: 0 },
          { id: 't-skip-tiny', start: 1, duration: 0.001 },
          { id: 't-skip-nan', start: Number.NaN, duration: 1 },
          { id: '', start: 1, duration: 2 }
        ],
        30
      );

      expect(layers).toHaveLength(2);
      expect(layers[0]).toEqual({
        key: 't-neg',
        item: { id: 't-neg', start: -0.5, duration: 2 },
        startFrame: 0,
        durationFrames: 45,
        zIndex: 21
      });
      expect(layers[1]).toEqual({
        key: 'text-5',
        item: { id: '', start: 1, duration: 2 },
        startFrame: 30,
        durationFrames: 60,
        zIndex: 26
      });
    });
  });

  describe('SubtitleChunkIndex', () => {
    it('indexes word timings per chunk, resolves active chunks with O(1) cursor and O(log N) binary search, and handles touching/overlapping/fallback chunks', () => {
      const chunks = [
        { start: 0.0, end: 1.0, word: 'HELLO WORLD' },
        { start: 1.0, end: 2.0, word: 'TOUCHING CHUNK' },
        { start: 3.0, end: 4.5, word: 'FALLBACK WORDS HERE' }
      ];
      const wordTimings = [
        { start: 0.0, end: 0.45, word: 'HELLO' },
        { start: 0.5, end: 0.98, word: 'WORLD' },
        { start: 1.0, end: 1.4, word: 'TOUCHING' },
        { start: 1.45, end: 1.98, word: 'CHUNK' }
      ];

      const idx = createSubtitleChunkIndex(chunks, wordTimings);
      expect(idx).toBeInstanceOf(SubtitleChunkIndex);
      expect(idx.length).toBe(3);
      expect(idx.firstChunk).toEqual(chunks[0]);

      // Sequential lookup
      const c0 = idx.findActiveChunk(0.4);
      expect(c0?.chunk.word).toBe('HELLO WORLD');
      expect(c0?.words.map(w => w.word)).toEqual(['HELLO', 'WORLD']);

      // Touching boundary t=1.0 returns FIRST matching chunk (matching Array.prototype.find)
      expect(idx.findActiveChunk(1.0)?.chunk.word).toBe('HELLO WORLD');

      // Step to chunk 1
      const c1 = idx.findActiveChunk(1.2);
      expect(c1?.chunk.word).toBe('TOUCHING CHUNK');
      expect(c1?.words.map(w => w.word)).toEqual(['TOUCHING', 'CHUNK']);

      // Gap returns null
      expect(idx.findActiveChunk(2.5)).toBeNull();

      // Chunk 2 uses pre-computed even fallback split words
      const c2 = idx.findActiveChunk(3.6);
      expect(c2?.chunk.word).toBe('FALLBACK WORDS HERE');
      expect(c2?.words).toHaveLength(3);
      expect(c2?.words[0]).toEqual({ word: 'FALLBACK', start: 3.0, end: 3.5 });
      expect(c2?.words[1]).toEqual({ word: 'WORDS', start: 3.5, end: 4.0 });
      expect(c2?.words[2]).toEqual({ word: 'HERE', start: 4.0, end: 4.5 });
      // Same pre-sliced array reference returned across frames
      expect(idx.findActiveChunk(4.1)?.words).toBe(c2?.words);

      // Backward seek
      expect(idx.findActiveChunk(0.2)?.chunk.word).toBe('HELLO WORLD');
    });

    it('preserves first-match semantics on overlapping and unsorted chunk inputs', () => {
      const overlapping = createSubtitleChunkIndex([
        { start: 0, end: 3, word: 'OUTER' },
        { start: 1, end: 2, word: 'INNER' }
      ]);
      expect(overlapping.findActiveChunk(1.5)?.chunk.word).toBe('OUTER');
      expect(overlapping.findActiveChunk(2.5)?.chunk.word).toBe('OUTER');

      const unsorted = createSubtitleChunkIndex([
        { start: 5, end: 6, word: 'LATE' },
        { start: 1, end: 2, word: 'EARLY' }
      ]);
      expect(unsorted.findActiveChunk(1.5)?.chunk.word).toBe('EARLY');
      expect(unsorted.findActiveChunk(5.5)?.chunk.word).toBe('LATE');
    });
  });

  describe('AnimatedSubtitles rendering with SubtitleChunkIndex', () => {
    beforeEach(() => {
      (
        globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
      ).IS_REACT_ACT_ENVIRONMENT = true;
    });

    it('renders pop highlight color, karaoke dimPast, and typewriter wordTimings/fallback across frames', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const chunks = [
        { start: 0.0, end: 1.0, word: 'ONE TWO' },
        { start: 2.0, end: 3.0, word: 'ALPHA BETA' }
      ];
      const wordTimings = [
        { start: 0.0, end: 0.45, word: 'ONE' },
        { start: 0.5, end: 1.0, word: 'TWO' }
      ];

      const renderSubs = (
        frame: number,
        animation: 'pop' | 'karaoke' | 'typewriter'
      ) => {
        act(() => {
          root.render(
            React.createElement(
              SubtitleFrameContext.Provider,
              { value: frame },
              React.createElement(AnimatedSubtitles, {
                words: chunks,
                wordTimings,
                style: {
                  ...DEFAULT_SUBTITLE_STYLE,
                  animation,
                  highlightMode: 'color',
                  highlightColor: '#CFFF50'
                }
              })
            )
          );
        });
      };

      try {
        // 1. Pop animation with wordTimings: frame 6 (0.2s -> 'ONE' highlighted)
        renderSubs(6, 'pop');
        let wordSpans = Array.from(container.querySelectorAll('span span'));
        expect(wordSpans.map(s => s.textContent)).toEqual(['ONE', 'TWO']);
        expect((wordSpans[0] as HTMLElement).style.color).not.toBe('');
        expect((wordSpans[1] as HTMLElement).style.color).toBe('');
        for (const span of wordSpans) {
          expect((span as HTMLElement).style.transition).toBe('');
        }

        // Advance to frame 21 (0.7s -> 'TWO' highlighted)
        renderSubs(21, 'pop');
        wordSpans = Array.from(container.querySelectorAll('span span'));
        expect((wordSpans[0] as HTMLElement).style.color).toBe('');
        expect((wordSpans[1] as HTMLElement).style.color).not.toBe('');

        // 2. Karaoke dims past words ('ONE' has opacity 0.5 at t=0.7s)
        renderSubs(21, 'karaoke');
        wordSpans = Array.from(container.querySelectorAll('span span'));
        expect((wordSpans[0] as HTMLElement).style.opacity).toBe('0.5');
        expect((wordSpans[1] as HTMLElement).style.color).not.toBe('');
        for (const span of wordSpans) {
          expect((span as HTMLElement).style.transition).toBe('');
        }

        // 3. Gap returns null
        renderSubs(45, 'pop');
        expect(container.innerHTML).toBe('');

        // 4. Typewriter with wordTimings (t=0.2s) and fallback split words (t=2.7s -> 'BETA' active)
        renderSubs(6, 'typewriter');
        wordSpans = Array.from(container.querySelectorAll('span span'));
        expect(wordSpans.map(s => s.textContent)).toEqual(['ONE', 'TWO']);
        expect((wordSpans[0] as HTMLElement).style.color).not.toBe('');
        expect((wordSpans[1] as HTMLElement).style.color).toBe('');
        for (const span of wordSpans) {
          expect((span as HTMLElement).style.transition).toBe('');
        }

        renderSubs(81, 'typewriter');
        wordSpans = Array.from(container.querySelectorAll('span span'));
        expect(wordSpans.map(s => s.textContent)).toEqual(['ALPHA', 'BETA']);
        expect((wordSpans[0] as HTMLElement).style.color).toBe('');
        expect((wordSpans[1] as HTMLElement).style.color).not.toBe('');
        for (const span of wordSpans) {
          expect((span as HTMLElement).style.transition).toBe('');
        }
      } finally {
        act(() => {
          root.unmount();
        });
        container.remove();
      }
    });
  });
});
