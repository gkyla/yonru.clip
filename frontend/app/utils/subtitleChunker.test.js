// Simple standalone TDD test suite for subtitleChunker module using Node assert
import assert from 'assert';
import { 
  groupTranscript, 
  updateSegmentText, 
  updateSegmentStart, 
  updateSegmentDuration 
} from './subtitleChunker.js';

console.log('Running Subtitle Chunker TDD tests...');

try {
  // Test 1: groupTranscript - 1 word mode
  const words = [
    { text: 'hello', start: 0.0, end: 1.0, duration: 1.0 },
    { text: 'world', start: 1.0, end: 2.0, duration: 1.0 },
    { text: 'test', start: 2.0, end: 3.5, duration: 1.5 }
  ];

  const grouped1 = groupTranscript(words, 'word');
  assert.strictEqual(grouped1.length, 3, 'Should have 3 segments in word mode');
  assert.strictEqual(grouped1[0].text, 'hello', 'First word matches');
  assert.strictEqual(grouped1[0].words.length, 1, 'First segment has exactly 1 underlying word');

  // Test 2: groupTranscript - 3 words mode
  const grouped3 = groupTranscript(words, '3_words');
  assert.strictEqual(grouped3.length, 1, 'Should chunk 3 words into 1 segment');
  assert.strictEqual(grouped3[0].text, 'hello world test', 'Combined text matches');
  assert.strictEqual(grouped3[0].start, 0.0, 'Start matches first word start');
  assert.strictEqual(grouped3[0].end, 3.5, 'End matches last word end');
  assert.strictEqual(grouped3[0].duration, 3.5, 'Duration matches span');
  assert.strictEqual(grouped3[0].words.length, 3, 'Group has 3 underlying words');

  // Test 3: updateSegmentText - proportional redistribution
  const testSeg = grouped3[0];
  updateSegmentText(testSeg, 'hi world check');
  assert.strictEqual(testSeg.text, 'hi world check', 'Stretched text updated');
  assert.strictEqual(words[0].text, 'hi', 'First word updated to "hi"');
  assert.strictEqual(words[1].text, 'world', 'Second word remains "world"');
  assert.strictEqual(words[2].text, 'check', 'Third word updated to "check"');

  // Test 4: updateSegmentStart - delta shift
  const startSeg = {
    start: 10.0,
    end: 12.0,
    duration: 2.0,
    words: [
      { text: 'first', start: 10.0, end: 11.0, duration: 1.0 },
      { text: 'second', start: 11.0, end: 12.0, duration: 1.0 }
    ]
  };
  updateSegmentStart(startSeg, 9.0);
  assert.strictEqual(startSeg.start, 9.0, 'Segment start updated');
  assert.strictEqual(startSeg.words[0].start, 9.0, 'First word shifted');
  assert.strictEqual(startSeg.words[0].end, 10.0, 'First word end shifted');
  assert.strictEqual(startSeg.words[1].start, 10.0, 'Second word shifted');
  assert.strictEqual(startSeg.words[1].end, 11.0, 'Second word end shifted');

  // Test 5: updateSegmentDuration - proportional scaling
  const durationSeg = {
    start: 0.0,
    end: 2.0,
    duration: 2.0,
    words: [
      { text: 'a', start: 0.0, end: 1.0, duration: 1.0 },
      { text: 'b', start: 1.0, end: 2.0, duration: 1.0 }
    ]
  };
  updateSegmentDuration(durationSeg, 4.0);
  assert.strictEqual(durationSeg.duration, 4.0, 'Segment duration updated');
  assert.strictEqual(durationSeg.words[0].duration, 2.0, 'First word duration scaled proportionally');
  assert.strictEqual(durationSeg.words[0].start, 0.0, 'First word start');
  assert.strictEqual(durationSeg.words[0].end, 2.0, 'First word end');
  assert.strictEqual(durationSeg.words[1].duration, 2.0, 'Second word duration scaled');
  assert.strictEqual(durationSeg.words[1].start, 2.0, 'Second word start sequential');
  assert.strictEqual(durationSeg.words[1].end, 4.0, 'Second word end sequential');

  console.log('ALL TESTS PASSED SUCCESSFULLY! (GREEN)');
} catch (err) {
  console.error('TEST FAIL (RED):', err.message);
  process.exit(1);
}
