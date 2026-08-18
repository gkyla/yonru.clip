import { describe, it, expect } from 'vitest'
import { maskText } from '../../app/utils/safetyEngine'

describe('Profanity Masker TDD', () => {
  it('returns original text if text or blacklist is empty', () => {
    expect(maskText('', ['kill'])).toBe('')
    expect(maskText('hello world', [])).toBe('hello world')
  })

  it('masks literal blacklist words by replacing second character with *', () => {
    expect(maskText('kill', ['kill'])).toBe('k*ll')
    expect(maskText('death', ['death'])).toBe('d*ath')
    expect(maskText('this is a kill word', ['kill'])).toBe('this is a k*ll word')
  })

  it('masks case-insensitively', () => {
    expect(maskText('KiLl', ['kill'])).toBe('K*Ll')
    expect(maskText('DEATH', ['death'])).toBe('D*ATH')
  })

  it('masks based on regex patterns', () => {
    expect(maskText('jangan bunuh diri', ['/bunuh/'])).toBe('jangan b*nuh diri')
  })

  it('does not mask substrings without word boundaries', () => {
    expect(maskText('this skill is high', ['kill'])).toBe('this skill is high')
  })
})
