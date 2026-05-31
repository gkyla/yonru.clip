import { describe, it, expect } from 'vitest'
import { auditTranscript } from '../../app/utils/contentAuditor'

describe('Content Auditor TDD', () => {
  it('empty transcript returns perfect score with no flags', () => {
    const result = auditTranscript([], ['kill', 'death'], 'word', 30)

    expect(result.score).toBe(100)
    expect(result.flaggedWords).toEqual([])
    expect(result.flaggedSegments).toEqual([])
    expect(result.uniqueFlagsCount).toBe(0)
    expect(result.isDurationOk).toBe(true)
    expect(result.durationReason).toBe('Optimal')
  })

  it('flags literal blacklist word and drops score', () => {
    const transcript = [
      { text: 'this has kill in it', start: 0, duration: 3 }
    ]
    const result = auditTranscript(transcript, ['kill', 'death'], 'word', 30)

    expect(result.flaggedWords).toContain('kill')
    expect(result.flaggedSegments.length).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  it('flags regex blacklist word and drops score', () => {
    const transcript = [
      { text: 'jangan bunuh diri', start: 5, duration: 4 }
    ]
    const result = auditTranscript(transcript, ['/bunuh/', 'death'], 'word', 30)

    expect(result.flaggedWords).toContain('/bunuh/')
    expect(result.flaggedSegments.length).toBeGreaterThan(0)
    expect(result.score).toBeLessThan(100)
  })

  it('does not flag words containing blacklist word as substring (word-boundary precision)', () => {
    const transcript = [
      { text: 'this skill is great', start: 0, duration: 3 }
    ]
    const result = auditTranscript(transcript, ['kill'], 'word', 30)

    expect(result.flaggedWords).not.toContain('kill')
    expect(result.flaggedSegments).toEqual([])
    expect(result.score).toBe(100)
  })

  it('applies penalty for too short duration (< 5s)', () => {
    const result = auditTranscript([], ['kill'], 'word', 3)
    expect(result.score).toBe(70)
    expect(result.isDurationOk).toBe(false)
    expect(result.durationReason).toBe('Too short')
  })

  it('applies penalty for long duration (60s < duration <= 90s)', () => {
    const result = auditTranscript([], ['kill'], 'word', 75)
    expect(result.score).toBe(90)
    expect(result.isDurationOk).toBe(false)
    expect(result.durationReason).toBe('Long')
  })

  it('applies larger penalty for extremely long duration (> 90s)', () => {
    const result = auditTranscript([], ['kill'], 'word', 100)
    expect(result.score).toBe(70)
    expect(result.isDurationOk).toBe(false)
    expect(result.durationReason).toBe('Long')
  })

  it('chunks words and flags multi-word chunk containing blacklist word', () => {
    const transcript = [
      { text: 'one kill three', start: 0, duration: 3 }
    ]
    const result = auditTranscript(transcript, ['kill'], '3_words', 30)

    expect(result.flaggedWords).toContain('kill')
    expect(result.flaggedSegments).toEqual([
      { start: 0, duration: 3, word: 'kill', text: 'one kill three' }
    ])
  })
})
