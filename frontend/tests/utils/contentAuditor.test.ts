import { describe, it, expect } from 'vitest'
import { auditTranscript } from '../../app/utils/contentAuditor'

describe('Content Auditor TDD', () => {
  it('empty transcript returns perfect score with no flags', () => {
    const result = auditTranscript([], ['kill', 'death'], 'word')

    expect(result.score).toBe(100)
    expect(result.flaggedWords).toEqual([])
    expect(result.flaggedSegments).toEqual([])
    expect(result.uniqueFlagsCount).toBe(0)
  })

  it('flags literal blacklist word and drops score', () => {
    const transcript = [
      { text: 'this has kill in it', start: 0, duration: 3 }
    ]
    const result = auditTranscript(transcript, ['kill', 'death'], 'word')

    expect(result.flaggedWords).toContain('kill')
    expect(result.flaggedSegments.length).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  it('flags regex blacklist word and drops score', () => {
    const transcript = [
      { text: 'jangan bunuh diri', start: 5, duration: 4 }
    ]
    const result = auditTranscript(transcript, ['/bunuh/', 'death'], 'word')

    expect(result.flaggedWords).toContain('/bunuh/')
    expect(result.flaggedSegments.length).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  it('does not flag words containing blacklist word as substring (word-boundary precision)', () => {
    const transcript = [
      { text: 'this skill is great', start: 0, duration: 3 }
    ]
    const result = auditTranscript(transcript, ['kill'], 'word')

    expect(result.flaggedWords).not.toContain('kill')
    expect(result.flaggedSegments).toEqual([])
    expect(result.score).toBe(100)
  })

  it('evaluates flaggedSegments strictly at word-level with padding offset', () => {
    const transcript = [
      { text: 'one kill three', start: 0, duration: 3 }
    ]
    // With 0ms padding offset
    const resultZeroPadding = auditTranscript(transcript, ['kill'], '3_words', 0)

    expect(resultZeroPadding.flaggedWords).toContain('kill')
    expect(resultZeroPadding.flaggedSegments).toEqual([
      { start: 1, duration: 1, word: 'kill', text: 'kill' }
    ])

    // With 50ms (default) padding offset
    const resultPadded = auditTranscript(transcript, ['kill'], '3_words', 50)
    expect(resultPadded.flaggedSegments).toEqual([
      { start: 0.95, duration: 1.1, word: 'kill', text: 'kill' }
    ])
  })

  it('calculates partial_end bleepMode to target only the ending 50% syllable duration', () => {
    const transcript = [
      { text: 'mati', start: 2.0, duration: 1.0 }
    ]
    // Word start = 2.0, duration = 1.0
    // partial_end mode: start = 2.0 + 0.5 = 2.5, duration = 0.5 + 0.05 (50ms padding) = 0.55
    const result = auditTranscript(transcript, ['mati'], 'word', 50, 'partial_end')

    expect(result.flaggedWords).toContain('mati')
    expect(result.flaggedSegments).toEqual([
      { start: 2.5, duration: 0.55, word: 'mati', text: 'mati' }
    ])
  })
})
