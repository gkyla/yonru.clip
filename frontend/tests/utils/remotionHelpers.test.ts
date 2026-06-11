import { describe, it, expect } from 'vitest'
import { parseSubtitleWords, type RemotionTranscriptSegment } from '../../app/utils/remotionHelpers'

describe('parseSubtitleWords', () => {
  it('should flatten transcript segments into individual words with default mode', () => {
    const transcript: RemotionTranscriptSegment[] = [
      { text: 'hello world', start: 1.0, duration: 2.0 }
    ]
    const syncOffsetMs = 0
    const subtitleMode = 'word'

    const { wordsData, allWordTimings } = parseSubtitleWords(transcript, syncOffsetMs, subtitleMode)

    expect(wordsData).toHaveLength(2)
    expect(wordsData[0]).toEqual({ word: 'hello', start: 1.0, end: 2.0 })
    expect(wordsData[1]).toEqual({ word: 'world', start: 2.0, end: 3.0 })
    
    expect(allWordTimings).toEqual(wordsData)
  })

  it('should shift word timings correctly based on syncOffsetMs', () => {
    const transcript: RemotionTranscriptSegment[] = [
      { text: 'test offset', start: 5.0, duration: 1.0 }
    ]
    const syncOffsetMs = -500 // -0.5s shift

    const { wordsData } = parseSubtitleWords(transcript, syncOffsetMs, 'word')

    expect(wordsData).toHaveLength(2)
    // 5.0 - 0.5 = 4.5
    expect(wordsData[0]!.start).toBeCloseTo(4.5)
    expect(wordsData[0]!.end).toBeCloseTo(5.0)
    expect(wordsData[1]!.start).toBeCloseTo(5.0)
    expect(wordsData[1]!.end).toBeCloseTo(5.5)
  })

  it('should support chunking multiple words based on mode (e.g. 3_words)', () => {
    const transcript: RemotionTranscriptSegment[] = [
      { text: 'one two three four five six', start: 10.0, duration: 6.0 }
    ]
    const syncOffsetMs = 0
    const subtitleMode = '3_words'

    const { wordsData, allWordTimings } = parseSubtitleWords(transcript, syncOffsetMs, subtitleMode)

    // Flat word timings should still be individual
    expect(allWordTimings).toHaveLength(6)
    expect(allWordTimings[0]!.word).toBe('one')

    // wordsData should be grouped in 3s
    expect(wordsData).toHaveLength(2)
    expect(wordsData[0]).toEqual({
      word: 'one two three',
      start: 10.0,
      end: 13.0
    })
    expect(wordsData[1]).toEqual({
      word: 'four five six',
      start: 13.0,
      end: 16.0
    })
  })

  it('should handle uneven chunking in multi-word mode gracefully', () => {
    const transcript: RemotionTranscriptSegment[] = [
      { text: 'one two three four', start: 10.0, duration: 4.0 }
    ]
    const { wordsData } = parseSubtitleWords(transcript, 0, '3_words')

    expect(wordsData).toHaveLength(2)
    expect(wordsData[0]!.word).toBe('one two three')
    expect(wordsData[1]!.word).toBe('four')
    expect(wordsData[1]!.start).toBeCloseTo(13.0)
    expect(wordsData[1]!.end).toBeCloseTo(14.0)
  })

  it('should handle empty, null, or invalid inputs safely', () => {
    expect(parseSubtitleWords([], 0, 'word')).toEqual({ wordsData: [], allWordTimings: [] })
    expect(parseSubtitleWords(null, 100, 'word')).toEqual({ wordsData: [], allWordTimings: [] })
    expect(parseSubtitleWords(undefined, 0, '3_words')).toEqual({ wordsData: [], allWordTimings: [] })
  })

  it('should skip segments with zero or negative durations and trim spaces', () => {
    const transcript: RemotionTranscriptSegment[] = [
      { text: '   ', start: 1.0, duration: 2.0 },
      { text: 'valid segment', start: 3.0, duration: 0 },
      { text: 'hello  world', start: 4.0, duration: 2.0 }
    ]
    const { wordsData } = parseSubtitleWords(transcript, 0, 'word')
    expect(wordsData).toHaveLength(2)
    expect(wordsData[0]!.word).toBe('hello')
    expect(wordsData[1]!.word).toBe('world')
  })
})

