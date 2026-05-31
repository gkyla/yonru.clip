// Standalone TDD test suite for subtitleChunker module using Vitest
import { describe, it } from 'vitest';
import assert from 'assert';
import { 
  groupTranscript, 
  updateSegmentText, 
  updateSegmentStart, 
  updateSegmentDuration,
  redistributeTranscript
} from '../../app/utils/subtitleChunker.js';

describe('Subtitle Chunker TDD tests', () => {
  it('passes all group and update assertions', () => {
    // Test 1: groupTranscript - 1 word mode (using segment inputs)
    const segments = [
      { text: 'hello', start: 0.0, duration: 1.0 },
      { text: 'world', start: 1.0, duration: 1.0 },
      { text: 'test', start: 2.0, duration: 1.5 }
    ];

    const grouped1 = groupTranscript(segments, 'word');
    assert.strictEqual(grouped1.length, 3, 'Should have 3 segments in word mode');
    assert.strictEqual(grouped1[0].text, 'hello', 'First word matches');
    assert.strictEqual(grouped1[0].words.length, 1, 'First segment has exactly 1 underlying word');

    // Test 2: groupTranscript - 3 words mode (using segment inputs)
    const grouped3 = groupTranscript(segments, '3_words');
    assert.strictEqual(grouped3.length, 1, 'Should chunk 3 words into 1 segment');
    assert.strictEqual(grouped3[0].text, 'hello world test', 'Combined text matches');
    assert.strictEqual(grouped3[0].start, 0.0, 'Start matches first word start');
    assert.strictEqual(grouped3[0].end, 3.5, 'End matches last word end');
    assert.strictEqual(grouped3[0].duration, 3.5, 'Duration matches span');
    assert.strictEqual(grouped3[0].words.length, 3, 'Group has 3 underlying words');

    // Test 3: updateSegmentText - proportional redistribution & original segment sync
    const testSeg = grouped3[0];
    updateSegmentText(testSeg, 'hi world check');
    assert.strictEqual(testSeg.text, 'hi world check', 'Stretched text updated');
    assert.strictEqual(segments[0].text, 'hi', 'First original segment reconstructed correctly');
    assert.strictEqual(segments[1].text, 'world', 'Second original segment reconstructed correctly');
    assert.strictEqual(segments[2].text, 'check', 'Third original segment reconstructed correctly');

    // Test 4: updateSegmentStart - delta shift & original segment sync
    const originalSeg1 = { text: 'first second', start: 10.0, duration: 2.0 };
    const flatWord1 = { text: 'first', start: 10.0, end: 11.0, duration: 1.0, originalSegment: originalSeg1 };
    const flatWord2 = { text: 'second', start: 11.0, end: 12.0, duration: 1.0, originalSegment: originalSeg1 };
    originalSeg1.flatWords = [flatWord1, flatWord2];

    const startSeg = {
      start: 10.0,
      end: 12.0,
      duration: 2.0,
      words: [flatWord1, flatWord2]
    };
    
    updateSegmentStart(startSeg, 9.0);
    assert.strictEqual(startSeg.start, 9.0, 'Segment start updated');
    assert.strictEqual(flatWord1.start, 9.0, 'First word shifted');
    assert.strictEqual(flatWord1.end, 10.0, 'First word end shifted');
    assert.strictEqual(flatWord2.start, 10.0, 'Second word shifted');
    assert.strictEqual(flatWord2.end, 11.0, 'Second word end shifted');
    assert.strictEqual(originalSeg1.start, 9.0, 'Original segment start synchronized');
    assert.strictEqual(originalSeg1.duration, 2.0, 'Original segment duration preserved');

    // Test 5: updateSegmentDuration - proportional scaling & original segment sync
    const originalSeg2 = { text: 'a b', start: 0.0, duration: 2.0 };
    const flatWordA = { text: 'a', start: 0.0, end: 1.0, duration: 1.0, originalSegment: originalSeg2 };
    const flatWordB = { text: 'b', start: 1.0, end: 2.0, duration: 1.0, originalSegment: originalSeg2 };
    originalSeg2.flatWords = [flatWordA, flatWordB];

    const durationSeg = {
      start: 0.0,
      end: 2.0,
      duration: 2.0,
      words: [flatWordA, flatWordB]
    };
    
    updateSegmentDuration(durationSeg, 4.0);
    assert.strictEqual(durationSeg.duration, 4.0, 'Segment duration updated');
    assert.strictEqual(flatWordA.duration, 2.0, 'First word duration scaled proportionally');
    assert.strictEqual(flatWordA.start, 0.0, 'First word start');
    assert.strictEqual(flatWordA.end, 2.0, 'First word end');
    assert.strictEqual(flatWordB.duration, 2.0, 'Second word duration scaled');
    assert.strictEqual(flatWordB.start, 2.0, 'Second word start sequential');
    assert.strictEqual(flatWordB.end, 4.0, 'Second word end sequential');
    assert.strictEqual(originalSeg2.duration, 4.0, 'Original segment duration synchronized');

    // Test 6: redistributeTranscript - All Words bulk edit redistribution
    const masterList = [
      { text: 'old', duration: 1.0 },
      { text: 'text', duration: 1.0 }
    ];
    redistributeTranscript(masterList, 'brand new content');
    assert.strictEqual(masterList[0].text, 'brand new', 'First segment got its proportional quota');
    assert.strictEqual(masterList[1].text, 'content', 'Last segment got all remaining words');

    // Test 7: updateSegmentText - Option A Locked Slots Alignment when deleting words
    const originalList = [
      { text: 'hello', start: 0.0, duration: 1.0 },
      { text: 'brave', start: 1.0, duration: 1.0 },
      { text: 'world', start: 2.0, duration: 1.0 }
    ];
    const groupedList = groupTranscript(originalList, '3_words');
    assert.strictEqual(groupedList.length, 1, 'Should group into 1 segment');
    
    // Deleting the middle word 'brave' -> 'hello world'
    updateSegmentText(groupedList[0], 'hello world');
    
    assert.strictEqual(originalList[0].text, 'hello', 'First slot remains hello');
    assert.strictEqual(originalList[1].text, '', 'Second slot becomes empty (deleted)');
    assert.strictEqual(originalList[2].text, 'world', 'Third slot remains world (no time shifting!)');

    // Test 8: groupTranscript - Do not skip empty segments to prevent timeline collapse
    const listWithEmpty = [
      { text: 'hello', start: 0.0, duration: 1.0 },
      { text: '', start: 1.0, duration: 1.0 },
      { text: 'world', start: 2.0, duration: 1.0 }
    ];
    
    // 1-word mode: Should render 3 cards (no skip)
    const groupedEmpty1 = groupTranscript(listWithEmpty, 'word');
    assert.strictEqual(groupedEmpty1.length, 3, 'Should keep empty card in 1-word mode');
    assert.strictEqual(groupedEmpty1[1].text, '', 'Second segment is empty');
    assert.strictEqual(groupedEmpty1[1].start, 1.0, 'Second segment start is intact');
    
    // 3-word mode: Should render 1 card spanning 3.0s total (no collapse)
    const groupedEmpty3 = groupTranscript(listWithEmpty, '3_words');
    assert.strictEqual(groupedEmpty3.length, 1, 'Should group all 3 slots');
    assert.strictEqual(groupedEmpty3[0].text, 'hello world', 'Joined text trims empty space');
    assert.strictEqual(groupedEmpty3[0].duration, 3.0, 'Box duration remains intact (3.0s)');
    assert.strictEqual(groupedEmpty3[0].end, 3.0, 'Box end remains intact (3.0s)');
  })
})

