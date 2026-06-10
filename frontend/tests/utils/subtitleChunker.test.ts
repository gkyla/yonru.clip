import { describe, it, expect } from 'vitest'
import { 
  groupTranscript, 
  updateSegmentText, 
  updateSegmentStart, 
  updateSegmentDuration,
  redistributeTranscript,
  type ChunkerSegment,
  type ChunkerFlatWord
} from '../../app/utils/subtitleChunker'

describe('Subtitle Chunker TDD tests', () => {
  it('passes all group and update assertions', () => {
    // Test 1: groupTranscript - 1 word mode (using segment inputs)
    const segments: ChunkerSegment[] = [
      { text: 'hello', start: 0.0, duration: 1.0 },
      { text: 'world', start: 1.0, duration: 1.0 },
      { text: 'test', start: 2.0, duration: 1.5 }
    ]

    const grouped1 = groupTranscript(segments, 'word')
    expect(grouped1).toHaveLength(3)
    expect(grouped1[0]!.text).toBe('hello')
    expect(grouped1[0]!.words).toHaveLength(1)

    // Test 2: groupTranscript - 3 words mode (using segment inputs)
    const grouped3 = groupTranscript(segments, '3_words')
    expect(grouped3).toHaveLength(1)
    expect(grouped3[0]!.text).toBe('hello world test')
    expect(grouped3[0]!.start).toBe(0.0)
    expect(grouped3[0]!.end).toBe(3.5)
    expect(grouped3[0]!.duration).toBe(3.5)
    expect(grouped3[0]!.words).toHaveLength(3)

    // Test 3: updateSegmentText - proportional redistribution & original segment sync
    const testSeg = grouped3[0]!
    updateSegmentText(testSeg, 'hi world check')
    expect(testSeg.text).toBe('hi world check')
    expect(segments[0]!.text).toBe('hi')
    expect(segments[1]!.text).toBe('world')
    expect(segments[2]!.text).toBe('check')

    // Test 4: updateSegmentStart - delta shift & original segment sync
    const originalSeg1: ChunkerSegment = { text: 'first second', start: 10.0, duration: 2.0 }
    const flatWord1: ChunkerFlatWord = { text: 'first', start: 10.0, end: 11.0, duration: 1.0, originalSegment: originalSeg1 }
    const flatWord2: ChunkerFlatWord = { text: 'second', start: 11.0, end: 12.0, duration: 1.0, originalSegment: originalSeg1 }
    originalSeg1.flatWords = [flatWord1, flatWord2]

    const startSeg: ChunkerSegment = {
      text: 'first second',
      start: 10.0,
      end: 12.0,
      duration: 2.0,
      words: [flatWord1, flatWord2]
    }
    
    updateSegmentStart(startSeg, 9.0)
    expect(startSeg.start).toBe(9.0)
    expect(flatWord1.start).toBe(9.0)
    expect(flatWord1.end).toBe(10.0)
    expect(flatWord2.start).toBe(10.0)
    expect(flatWord2.end).toBe(11.0)
    expect(originalSeg1.start).toBe(9.0)
    expect(originalSeg1.duration).toBe(2.0)

    // Test 5: updateSegmentDuration - proportional scaling & original segment sync
    const originalSeg2: ChunkerSegment = { text: 'a b', start: 0.0, duration: 2.0 }
    const flatWordA: ChunkerFlatWord = { text: 'a', start: 0.0, end: 1.0, duration: 1.0, originalSegment: originalSeg2 }
    const flatWordB: ChunkerFlatWord = { text: 'b', start: 1.0, end: 2.0, duration: 1.0, originalSegment: originalSeg2 }
    originalSeg2.flatWords = [flatWordA, flatWordB]

    const durationSeg: ChunkerSegment = {
      text: 'a b',
      start: 0.0,
      end: 2.0,
      duration: 2.0,
      words: [flatWordA, flatWordB]
    }
    
    updateSegmentDuration(durationSeg, 4.0)
    expect(durationSeg.duration).toBe(4.0)
    expect(flatWordA.duration).toBe(2.0)
    expect(flatWordA.start).toBe(0.0)
    expect(flatWordA.end).toBe(2.0)
    expect(flatWordB.duration).toBe(2.0)
    expect(flatWordB.start).toBe(2.0)
    expect(flatWordB.end).toBe(4.0)
    expect(originalSeg2.duration).toBe(4.0)

    // Test 6: redistributeTranscript - All Words bulk edit redistribution
    const masterList: ChunkerSegment[] = [
      { text: 'old', start: 0.0, duration: 1.0 },
      { text: 'text', start: 1.0, duration: 1.0 }
    ]
    redistributeTranscript(masterList, 'brand new content')
    expect(masterList[0]!.text).toBe('brand new')
    expect(masterList[1]!.text).toBe('content')

    // Test 7: updateSegmentText - Option A Locked Slots Alignment when deleting words
    const originalList: ChunkerSegment[] = [
      { text: 'hello', start: 0.0, duration: 1.0 },
      { text: 'brave', start: 1.0, duration: 1.0 },
      { text: 'world', start: 2.0, duration: 1.0 }
    ]
    const groupedList = groupTranscript(originalList, '3_words')
    expect(groupedList).toHaveLength(1)
    
    // Deleting the middle word 'brave' -> 'hello world'
    updateSegmentText(groupedList[0]!, 'hello world')
    
    expect(originalList[0]!.text).toBe('hello')
    expect(originalList[1]!.text).toBe('')
    expect(originalList[2]!.text).toBe('world')

    // Test 8: groupTranscript - Do not skip empty segments to prevent timeline collapse
    const listWithEmpty: ChunkerSegment[] = [
      { text: 'hello', start: 0.0, duration: 1.0 },
      { text: '', start: 1.0, duration: 1.0 },
      { text: 'world', start: 2.0, duration: 1.0 }
    ]
    
    // 1-word mode: Should render 3 cards (no skip)
    const groupedEmpty1 = groupTranscript(listWithEmpty, 'word')
    expect(groupedEmpty1).toHaveLength(3)
    expect(groupedEmpty1[1]!.text).toBe('')
    expect(groupedEmpty1[1]!.start).toBe(1.0)
    
    // 3-word mode: Should render 1 card spanning 3.0s total (no collapse)
    const groupedEmpty3 = groupTranscript(listWithEmpty, '3_words')
    expect(groupedEmpty3).toHaveLength(1)
    expect(groupedEmpty3[0]!.text).toBe('hello world')
    expect(groupedEmpty3[0]!.duration).toBe(3.0)
    expect(groupedEmpty3[0]!.end).toBe(3.0)
  })
})
