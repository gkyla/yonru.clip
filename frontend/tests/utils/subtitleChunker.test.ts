import { describe, it, expect } from 'vitest';
import {
  SubtitleLayoutEngine,
  createSubtitleLayoutEngine,
  groupTranscript,
  updateSegmentText,
  updateSegmentStart,
  updateSegmentDuration,
  redistributeTranscript,
  type ChunkerSegment,
  type ChunkerFlatWord
} from '../../app/utils/subtitleChunker';
import type { TranscriptSegment } from '../../app/types/clipper';

describe('Subtitle Chunker & LayoutEngine Unit Tests', () => {
  describe('Legacy Procedural Functions', () => {
    it('passes all group and update assertions', () => {
      // 1. 1-word mode
      const segments: ChunkerSegment[] = [
        { text: 'hello', start: 0.0, duration: 1.0 },
        { text: 'world', start: 1.0, duration: 1.0 },
        { text: 'test', start: 2.0, duration: 1.5 }
      ];

      const grouped1 = groupTranscript(segments, 'word');
      expect(grouped1).toHaveLength(3);
      expect(grouped1[0]!.text).toBe('hello');
      expect(grouped1[0]!.words).toHaveLength(1);

      // 2. 3-words mode
      const grouped3 = groupTranscript(segments, '3_words');
      expect(grouped3).toHaveLength(1);
      expect(grouped3[0]!.text).toBe('hello world test');
      expect(grouped3[0]!.start).toBe(0.0);
      expect(grouped3[0]!.end).toBe(3.5);
      expect(grouped3[0]!.duration).toBe(3.5);
      expect(grouped3[0]!.words).toHaveLength(3);

      // 3. updateSegmentText
      const testSeg = grouped3[0]!;
      updateSegmentText(testSeg, 'hi world check');
      expect(testSeg.text).toBe('hi world check');
      expect(segments[0]!.text).toBe('hi');
      expect(segments[1]!.text).toBe('world');
      expect(segments[2]!.text).toBe('check');

      // 4. updateSegmentStart
      const originalSeg1: ChunkerSegment = {
        text: 'first second',
        start: 10.0,
        duration: 2.0
      };
      const flatWord1: ChunkerFlatWord = {
        text: 'first',
        start: 10.0,
        end: 11.0,
        duration: 1.0,
        originalSegment: originalSeg1
      };
      const flatWord2: ChunkerFlatWord = {
        text: 'second',
        start: 11.0,
        end: 12.0,
        duration: 1.0,
        originalSegment: originalSeg1
      };
      originalSeg1.flatWords = [flatWord1, flatWord2];

      const startSeg: ChunkerSegment = {
        text: 'first second',
        start: 10.0,
        end: 12.0,
        duration: 2.0,
        words: [flatWord1, flatWord2]
      };

      updateSegmentStart(startSeg, 9.0);
      expect(startSeg.start).toBe(9.0);
      expect(flatWord1.start).toBe(9.0);
      expect(flatWord1.end).toBe(10.0);
      expect(flatWord2.start).toBe(10.0);
      expect(flatWord2.end).toBe(11.0);
      expect(originalSeg1.start).toBe(9.0);
      expect(originalSeg1.duration).toBe(2.0);

      // 5. updateSegmentDuration
      const originalSeg2: ChunkerSegment = {
        text: 'a b',
        start: 0.0,
        duration: 2.0
      };
      const flatWordA: ChunkerFlatWord = {
        text: 'a',
        start: 0.0,
        end: 1.0,
        duration: 1.0,
        originalSegment: originalSeg2
      };
      const flatWordB: ChunkerFlatWord = {
        text: 'b',
        start: 1.0,
        end: 2.0,
        duration: 1.0,
        originalSegment: originalSeg2
      };
      originalSeg2.flatWords = [flatWordA, flatWordB];

      const durationSeg: ChunkerSegment = {
        text: 'a b',
        start: 0.0,
        end: 2.0,
        duration: 2.0,
        words: [flatWordA, flatWordB]
      };

      updateSegmentDuration(durationSeg, 4.0);
      expect(durationSeg.duration).toBe(4.0);
      expect(flatWordA.duration).toBe(2.0);
      expect(flatWordA.start).toBe(0.0);
      expect(flatWordA.end).toBe(2.0);
      expect(flatWordB.duration).toBe(2.0);
      expect(flatWordB.start).toBe(2.0);
      expect(flatWordB.end).toBe(4.0);
      expect(originalSeg2.duration).toBe(4.0);

      // 6. redistributeTranscript
      const masterList: ChunkerSegment[] = [
        { text: 'old', start: 0.0, duration: 1.0 },
        { text: 'text', start: 1.0, duration: 1.0 }
      ];
      redistributeTranscript(masterList, 'brand new content');
      expect(masterList[0]!.text).toBe('brand new');
      expect(masterList[1]!.text).toBe('content');

      // 7. Deleting middle word
      const originalList: ChunkerSegment[] = [
        { text: 'hello', start: 0.0, duration: 1.0 },
        { text: 'brave', start: 1.0, duration: 1.0 },
        { text: 'world', start: 2.0, duration: 1.0 }
      ];
      const groupedList = groupTranscript(originalList, '3_words');
      expect(groupedList).toHaveLength(1);

      updateSegmentText(groupedList[0]!, 'hello world');
      expect(originalList[0]!.text).toBe('hello');
      expect(originalList[1]!.text).toBe('');
      expect(originalList[2]!.text).toBe('world');
    });
  });

  describe('SubtitleLayoutEngine Class', () => {
    it('initializes with default word mode and builds chunks', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'one', start: 0.0, duration: 1.0 },
        { text: 'two', start: 1.0, duration: 1.0 },
        { text: 'three', start: 2.0, duration: 1.0 },
        { text: 'four', start: 3.0, duration: 1.0 }
      ];

      const engine = new SubtitleLayoutEngine(transcript, '2_words');
      expect(engine.mode).toBe('2_words');
      expect(engine.chunks).toHaveLength(2);
      expect(engine.chunks[0]!.text).toBe('one two');
      expect(engine.chunks[1]!.text).toBe('three four');
    });

    it('dynamically switches chunking modes and updates chunks', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'one', start: 0.0, duration: 1.0 },
        { text: 'two', start: 1.0, duration: 1.0 },
        { text: 'three', start: 2.0, duration: 1.0 }
      ];

      const engine = createSubtitleLayoutEngine(transcript, 'word');
      expect(engine.chunks).toHaveLength(3);

      engine.mode = '3_words';
      expect(engine.chunks).toHaveLength(1);
      expect(engine.chunks[0]!.text).toBe('one two three');
      expect(engine.chunks[0]!.duration).toBe(3.0);

      engine.mode = 'full';
      expect(engine.chunks).toHaveLength(1);
      expect(engine.chunks[0]!.text).toBe('one two three');
    });

    it('accurately finds active chunk index across playback timestamps', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'first', start: 10.0, duration: 2.0 },
        { text: 'second', start: 12.0, duration: 3.0 }
      ];

      const engine = new SubtitleLayoutEngine(transcript, '1_word');

      // Zero-based lookup (relative to hookStart = 10.0)
      expect(
        engine.findChunkIndexAt(0.5, { hookStart: 10.0, isZeroBased: false })
      ).toBe(0);
      expect(
        engine.findChunkIndexAt(2.5, { hookStart: 10.0, isZeroBased: false })
      ).toBe(1);
      expect(
        engine.findChunkIndexAt(6.0, { hookStart: 10.0, isZeroBased: false })
      ).toBe(-1);

      // Direct lookup on zero-based transcript
      const zeroTranscript: TranscriptSegment[] = [
        { text: 'start', start: 0.0, duration: 2.0 },
        { text: 'end', start: 2.0, duration: 2.0 }
      ];
      const zeroEngine = new SubtitleLayoutEngine(zeroTranscript, '1_word');
      expect(zeroEngine.findChunkIndexAt(1.0)).toBe(0);
      expect(zeroEngine.findChunkIndexAt(3.0)).toBe(1);
      expect(zeroEngine.getChunkAt(3.0)?.text).toBe('end');
    });

    it('performs Needleman-Wunsch text updates and syncs master transcript', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'quick', start: 0.0, duration: 1.0 },
        { text: 'brown', start: 1.0, duration: 1.0 },
        { text: 'fox', start: 2.0, duration: 1.0 }
      ];

      const engine = new SubtitleLayoutEngine(transcript, '3_words');
      expect(engine.chunks[0]!.text).toBe('quick brown fox');

      // Edit chunk text: replace 'brown' with 'red'
      engine.updateChunkText(0, 'quick red fox');
      expect(engine.chunks[0]!.text).toBe('quick red fox');
      expect(engine.masterTranscript[0]!.text).toBe('quick');
      expect(engine.masterTranscript[1]!.text).toBe('red');
      expect(engine.masterTranscript[2]!.text).toBe('fox');
    });

    it('handles start and duration updates via engine methods', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'alpha beta', start: 5.0, duration: 2.0 }
      ];

      const engine = new SubtitleLayoutEngine(transcript, 'word');

      // Shift start from 5.0 to 6.0
      engine.updateChunkStart(0, 6.0);
      expect(engine.chunks[0]!.start).toBe(6.0);
      expect(engine.masterTranscript[0]!.start).toBe(6.0);

      // Scale duration from 2.0 to 4.0
      engine.updateChunkDuration(0, 4.0);
      expect(engine.chunks[0]!.duration).toBe(4.0);
      expect(engine.masterTranscript[0]!.duration).toBe(4.0);
    });

    it('supports splitChunk and mergeChunks operations', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'hello world', start: 0.0, duration: 4.0 },
        { text: 'another line', start: 4.0, duration: 2.0 }
      ];

      const engine = new SubtitleLayoutEngine(transcript, '1_word');

      // Split first segment at 2.0s
      const splitOk = engine.splitChunk(0, 2.0);
      expect(splitOk).toBe(true);
      expect(engine.masterTranscript).toHaveLength(3);
      expect(engine.masterTranscript[0]!.text).toBe('hello');
      expect(engine.masterTranscript[0]!.duration).toBe(2.0);
      expect(engine.masterTranscript[1]!.text).toBe('world');
      expect(engine.masterTranscript[1]!.start).toBe(2.0);

      // Merge first two segments back
      const mergeOk = engine.mergeChunks(0, 1);
      expect(mergeOk).toBe(true);
      expect(engine.masterTranscript).toHaveLength(2);
      expect(engine.masterTranscript[0]!.text).toBe('hello world');
    });

    it('redistributes bulk text across all master segments', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'a', start: 0.0, duration: 2.0 },
        { text: 'b', start: 2.0, duration: 2.0 }
      ];

      const engine = new SubtitleLayoutEngine(transcript, '1_word');
      engine.redistributeBulkText('the quick brown fox');

      expect(engine.masterTranscript[0]!.text).toBe('the quick');
      expect(engine.masterTranscript[1]!.text).toBe('brown fox');
    });

    it('preserves acoustic word map (words array) during chunk building and master export', () => {
      const transcript: TranscriptSegment[] = [
        {
          text: 'one two',
          start: 0.0,
          duration: 2.0,
          words: [
            { text: 'one', start: 0.1, duration: 0.8 },
            { text: 'two', start: 1.0, duration: 0.9 }
          ]
        }
      ];

      const engine = new SubtitleLayoutEngine(transcript, '1_word');
      expect(engine.chunks).toHaveLength(2);
      expect(engine.chunks[0]!.start).toBe(0.1);
      expect(engine.chunks[0]!.duration).toBe(0.8);
      expect(engine.chunks[1]!.start).toBe(1.0);
      expect(engine.chunks[1]!.duration).toBe(0.9);

      const exported = engine.exportMaster();
      expect(exported[0]!.words).toBeDefined();
      expect(exported[0]!.words).toHaveLength(2);
      expect(exported[0]!.words![0]!.start).toBe(0.1);
    });

    it('uses monotonic binary search for ordered chunks and falls back cleanly for unsorted or overlapping timestamps', () => {
      const orderedTranscript: TranscriptSegment[] = Array.from(
        { length: 200 },
        (_, i) => ({
          text: `word${i}`,
          start: i * 1.0,
          duration: 0.8
        })
      );
      const monotonicEngine = new SubtitleLayoutEngine(
        orderedTranscript,
        '1_word'
      );
      expect(monotonicEngine.isMonotonic).toBe(true);
      expect(monotonicEngine.findChunkIndexAt(0.2)).toBe(0);
      expect(monotonicEngine.findChunkIndexAt(0.9)).toBe(-1); // gap between [0..0.8) and [1..1.8)
      expect(monotonicEngine.findChunkIndexAt(142.3)).toBe(142);
      expect(monotonicEngine.findChunkIndexAt(199.7)).toBe(199);
      expect(monotonicEngine.findChunkIndexAt(250)).toBe(-1);

      // Re-evaluates monotonicity after in-place chunk edits
      monotonicEngine.updateChunkStart(0, 5.0); // now chunk 0 overlaps chunk 5
      expect(monotonicEngine.isMonotonic).toBe(false);
      expect(monotonicEngine.findChunkIndexAt(5.2)).toBe(0);

      // Unsorted / overlapping transcript uses linear scan fallback
      const unsortedTranscript: TranscriptSegment[] = [
        { text: 'late', start: 10.0, duration: 2.0 },
        { text: 'early', start: 2.0, duration: 2.0 },
        { text: 'overlap', start: 3.0, duration: 3.0 }
      ];
      const fallbackEngine = new SubtitleLayoutEngine(
        unsortedTranscript,
        '1_word'
      );
      expect(fallbackEngine.isMonotonic).toBe(false);
      expect(fallbackEngine.findChunkIndexAt(10.5)).toBe(0);
      expect(fallbackEngine.findChunkIndexAt(2.5)).toBe(1);
      expect(fallbackEngine.findChunkIndexAt(4.5)).toBe(2);
      expect(fallbackEngine.findChunkIndexAt(0.5)).toBe(-1);
    });

    it('keeps binary search active across IEEE-754 float drift on contiguous decimal Whisper timestamps', () => {
      const whisperLike: TranscriptSegment[] = Array.from(
        { length: 500 },
        (_, i) => ({
          text: `word${i}`,
          start: Number((i * 0.24).toFixed(4)),
          duration: 0.24
        })
      );
      const engine = new SubtitleLayoutEngine(whisperLike, 'word');
      expect(engine.isMonotonic).toBe(true);
      // 2.16 + 0.24 === 2.4000000000000004 (> 2.4); query on float seam matches linear findIndex (chunk 9)
      expect(engine.findChunkIndexAt(2.4)).toBe(9);
      expect(engine.findChunkIndexAt(2.4001)).toBe(10);

      // Genuine overlap beyond float tolerance disables monotonic binary search and preserves linear first-match
      const realOverlap = new SubtitleLayoutEngine(
        [
          { text: 'first', start: 0, duration: 1.01 },
          { text: 'second', start: 1.0, duration: 1.0 }
        ],
        'word'
      );
      expect(realOverlap.isMonotonic).toBe(false);
      expect(realOverlap.findChunkIndexAt(1.005)).toBe(0);
    });
  });

  describe('Remotion Timing Projections (Deep Interface)', () => {
    it('flattens transcript segments into individual words with default mode', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'hello world', start: 1.0, duration: 2.0 }
      ];
      const result = SubtitleLayoutEngine.extractRemotionProps(
        transcript,
        'word',
        0
      );

      expect(result.words).toHaveLength(2);
      expect(result.words[0]).toEqual({ word: 'hello', start: 1.0, end: 2.0 });
      expect(result.words[1]).toEqual({ word: 'world', start: 2.0, end: 3.0 });
      expect(result.wordTimings).toEqual(result.words);
    });

    it('shifts word timings accurately based on syncOffsetMs', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'test offset', start: 5.0, duration: 1.0 }
      ];
      const result = SubtitleLayoutEngine.extractRemotionProps(
        transcript,
        'word',
        -500
      );

      expect(result.words).toHaveLength(2);
      expect(result.words[0]!.start).toBeCloseTo(4.5);
      expect(result.words[0]!.end).toBeCloseTo(5.0);
      expect(result.words[1]!.start).toBeCloseTo(5.0);
      expect(result.words[1]!.end).toBeCloseTo(5.5);
    });

    it('supports chunking multiple words based on mode (e.g. 3_words)', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'one two three four five six', start: 10.0, duration: 6.0 }
      ];
      const result = SubtitleLayoutEngine.extractRemotionProps(
        transcript,
        '3_words',
        0
      );

      expect(result.wordTimings).toHaveLength(6);
      expect(result.wordTimings[0]!.word).toBe('one');
      expect(result.words).toHaveLength(2);
      expect(result.words[0]).toEqual({
        word: 'one two three',
        start: 10.0,
        end: 13.0
      });
      expect(result.words[1]).toEqual({
        word: 'four five six',
        start: 13.0,
        end: 16.0
      });
    });

    it('handles uneven multi-word chunking gracefully', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'one two three four', start: 10.0, duration: 4.0 }
      ];
      const result = SubtitleLayoutEngine.extractRemotionProps(
        transcript,
        '3_words',
        0
      );

      expect(result.words).toHaveLength(2);
      expect(result.words[0]!.word).toBe('one two three');
      expect(result.words[1]!.word).toBe('four');
      expect(result.words[1]!.start).toBeCloseTo(13.0);
      expect(result.words[1]!.end).toBeCloseTo(14.0);
    });

    it('handles empty, null, or invalid inputs safely without throwing', () => {
      expect(SubtitleLayoutEngine.extractRemotionProps([], 'word', 0)).toEqual({
        words: [],
        wordTimings: [],
        wordsData: [],
        allWordTimings: []
      });
      expect(
        SubtitleLayoutEngine.extractRemotionProps(null, 'word', 100)
      ).toEqual({
        words: [],
        wordTimings: [],
        wordsData: [],
        allWordTimings: []
      });
      expect(
        SubtitleLayoutEngine.extractRemotionProps(undefined, '3_words', 0)
      ).toEqual({
        words: [],
        wordTimings: [],
        wordsData: [],
        allWordTimings: []
      });
    });

    it('skips empty whitespace segments and non-positive durations', () => {
      const transcript: TranscriptSegment[] = [
        { text: '   ', start: 1.0, duration: 2.0 },
        { text: 'valid segment', start: 3.0, duration: 0 },
        { text: 'hello  world', start: 4.0, duration: 2.0 }
      ];
      const result = SubtitleLayoutEngine.extractRemotionProps(
        transcript,
        'word',
        0
      );
      expect(result.words).toHaveLength(2);
      expect(result.words[0]!.word).toBe('hello');
      expect(result.words[1]!.word).toBe('world');
    });

    it('strictly preserves true acoustic Whisper word timestamps (seg.words) over uniform distribution', () => {
      const transcript: TranscriptSegment[] = [
        {
          text: 'precise acoustic timing',
          start: 2.0,
          duration: 3.0,
          words: [
            { text: 'precise', start: 2.1, duration: 0.5 },
            { text: 'acoustic', start: 2.8, duration: 1.1 },
            { text: 'timing', start: 4.2, duration: 0.6 }
          ]
        }
      ];

      const result = SubtitleLayoutEngine.extractRemotionProps(
        transcript,
        '1_word',
        100
      );

      expect(result.words).toHaveLength(3);
      // 2.1 + 0.1s offset = 2.2
      expect(result.words[0]!.start).toBeCloseTo(2.2);
      expect(result.words[0]!.end).toBeCloseTo(2.7);
      // 2.8 + 0.1s offset = 2.9
      expect(result.words[1]!.start).toBeCloseTo(2.9);
      expect(result.words[1]!.end).toBeCloseTo(4.0);
      // 4.2 + 0.1s offset = 4.3
      expect(result.words[2]!.start).toBeCloseTo(4.3);
      expect(result.words[2]!.end).toBeCloseTo(4.9);
    });

    it('supports instance method getRemotionTimings on SubtitleLayoutEngine', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'instance test', start: 0.0, duration: 2.0 }
      ];
      const engine = new SubtitleLayoutEngine(transcript, 'word');
      const timings = engine.getRemotionTimings({ syncOffsetMs: 200 });

      expect(timings.words).toHaveLength(2);
      expect(timings.words[0]!.start).toBeCloseTo(0.2);
      expect(timings.words[0]!.end).toBeCloseTo(1.2);
      expect(timings.words[1]!.start).toBeCloseTo(1.2);
      expect(timings.words[1]!.end).toBeCloseTo(2.2);
    });

    it('works identically via parseSubtitleWords procedural bridge', () => {
      const transcript: TranscriptSegment[] = [
        { text: 'bridge test', start: 1.0, duration: 2.0 }
      ];
      const bridged = parseSubtitleWords(transcript, 0, 'word');
      expect(bridged.wordsData).toHaveLength(2);
      expect(bridged.wordsData[0]!.word).toBe('bridge');
    });
  });
});
