import { describe, it, expect, beforeEach } from 'vitest'
import {
  ContentSafetyAuditor,
  createContentSafetyAuditor,
  getCompiledPattern,
  compileBlacklist,
  auditTranscript,
  maskText,
  auditLayoutCollision,
  calculateSafeOffset,
  auditReadability,
  calculateAdjustedScore,
  DEFAULT_BLEEP_PRESET,
  BUILTIN_BLEEP_PRESETS
} from '../../app/utils/safetyEngine'

describe('SafetyEngine Unit Tests', () => {
  describe('Pattern Compilation & Caching', () => {
    it('returns null for empty or whitespace-only patterns', () => {
      expect(getCompiledPattern('')).toBeNull()
      expect(getCompiledPattern('   ')).toBeNull()
    })

    it('compiles literal words with word-boundary regexes', () => {
      const p = getCompiledPattern('kill')
      expect(p).not.toBeNull()
      expect(p?.regex.test('kill')).toBe(true)
      expect(p?.regex.test('skill')).toBe(false)
    })

    it('compiles slash-enclosed regex patterns', () => {
      const p = getCompiledPattern('/bunuh/')
      expect(p).not.toBeNull()
      expect(p?.regex.test('membunuh')).toBe(true)
    })

    it('reuses cached pattern instances for identical inputs', () => {
      const p1 = getCompiledPattern('death')
      const p2 = getCompiledPattern('death')
      expect(p1).toBe(p2)
    })

    it('compiles array of blacklist words', () => {
      const compiled = compileBlacklist(['kill', 'death', ''])
      expect(compiled.length).toBe(2)
    })
  })

  describe('Transcript Auditing', () => {
    it('returns 100 with no flags for empty transcript or empty blacklist', () => {
      expect(auditTranscript([], ['kill'])).toEqual({
        score: 100,
        flaggedWords: [],
        flaggedSegments: [],
        uniqueFlagsCount: 0
      })
      expect(auditTranscript([{ text: 'hello', start: 0, duration: 1 }], [])).toEqual({
        score: 100,
        flaggedWords: [],
        flaggedSegments: [],
        uniqueFlagsCount: 0
      })
    })

    it('accurately flags words with full padding offset', () => {
      const transcript = [{ text: 'a kill b', start: 0, duration: 3 }]
      const res = auditTranscript(transcript, ['kill'], 'word', 50, 'full')
      expect(res.flaggedWords).toContain('kill')
      expect(res.flaggedSegments).toEqual([
        { start: 0.95, duration: 1.1, word: 'kill', text: 'kill' }
      ])
      expect(res.score).toBeLessThan(100)
    })

    it('calculates partial_end bleep offset targeting trailing 50% syllable', () => {
      const transcript = [{ text: 'mati', start: 2.0, duration: 1.0 }]
      const res = auditTranscript(transcript, ['mati'], 'word', 50, 'partial_end')
      expect(res.flaggedWords).toContain('mati')
      expect(res.flaggedSegments).toEqual([
        { start: 2.5, duration: 0.55, word: 'mati', text: 'mati' }
      ])
    })
  })

  describe('Profanity Masking', () => {
    it('masks with asterisk style', () => {
      expect(maskText('kill', ['kill'], 'asterisk')).toBe('k*ll')
      expect(maskText('ab', ['ab'], 'asterisk')).toBe('a*')
      expect(maskText('a', ['a'], 'asterisk')).toBe('a')
    })

    it('masks with block style', () => {
      expect(maskText('kill', ['kill'], 'block')).toBe('****')
    })

    it('masks with bleep_marker style', () => {
      expect(maskText('stop the kill now', ['kill'], 'bleep_marker')).toBe('stop the [BLEEP] now')
    })

    it('handles empty input gracefully', () => {
      expect(maskText('', ['kill'])).toBe('')
      expect(maskText('hello', [])).toBe('hello')
    })
  })

  describe('Layout Safe-Zone Auditing', () => {
    const allActive = { tiktok: true, reels: true, shorts: true }

    it('returns safe when platform is none or warning ignored', () => {
      const resNone = auditLayoutCollision('none', 'top', 50, allActive, false)
      expect(resNone.isSafe).toBe(true)

      const resIgnored = auditLayoutCollision('tiktok', 'top', 50, allActive, true)
      expect(resIgnored.isSafe).toBe(true)
    })

    it('detects top collision on TikTok header deadzone (<130px)', () => {
      const colliding = auditLayoutCollision('tiktok', 'top', 100, allActive)
      expect(colliding.isSafe).toBe(false)
      expect(colliding.collisionCount).toBe(1)
      expect(colliding.reason).toContain('130px')

      const safe = auditLayoutCollision('tiktok', 'top', 150, allActive)
      expect(safe.isSafe).toBe(true)
    })

    it('detects bottom collision on Reels controls deadzone (<350px)', () => {
      const colliding = auditLayoutCollision('reels', 'bottom', 300, allActive)
      expect(colliding.isSafe).toBe(false)
      expect(colliding.collisionCount).toBe(1)

      const safe = auditLayoutCollision('reels', 'bottom', 370, allActive)
      expect(safe.isSafe).toBe(true)
    })

    it('calculates optimal safe offsets', () => {
      expect(calculateSafeOffset('none', 'top')).toBeNull()
      expect(calculateSafeOffset('tiktok', 'top')).toBe(150)
      expect(calculateSafeOffset('reels', 'bottom')).toBe(370)
      expect(calculateSafeOffset('shorts', 'bottom')).toBe(300)
    })
  })

  describe('Readability & Contrast Auditing', () => {
    it('is safe when background is set', () => {
      const res = auditReadability('#000000', 0, 'none')
      expect(res.isSafe).toBe(true)
    })

    it('is safe when outline stroke is >= 2px and not transparent', () => {
      const res = auditReadability('none', 3, '#000000')
      expect(res.isSafe).toBe(true)
    })

    it('flags unsafe when neither background nor sufficient stroke exists', () => {
      const res = auditReadability('none', 1, '#000000')
      expect(res.isSafe).toBe(false)
      expect(res.reason).toContain('Low subtitle contrast')
    })

    it('bypasses check when warnings are ignored', () => {
      const res = auditReadability('none', 0, 'none', true)
      expect(res.isSafe).toBe(true)
    })
  })

  describe('Score Penalty Calculation', () => {
    it('applies penalties for layout (-15) and readability (-10)', () => {
      expect(calculateAdjustedScore(100, true, true, false)).toBe(100)
      expect(calculateAdjustedScore(100, false, true, false)).toBe(85)
      expect(calculateAdjustedScore(100, true, false, false)).toBe(90)
      expect(calculateAdjustedScore(100, false, false, false)).toBe(75)
    })

    it('clamps adjusted score to 0 minimum', () => {
      expect(calculateAdjustedScore(10, false, false, false)).toBe(0)
    })

    it('returns 100 when warnings are ignored', () => {
      expect(calculateAdjustedScore(50, false, false, true)).toBe(100)
    })
  })

  describe('ContentSafetyAuditor Deep Engine Methods', () => {
    let auditor: ContentSafetyAuditor

    beforeEach(() => {
      auditor = createContentSafetyAuditor()
    })

    it('compiles effective blacklist respecting category toggles and whitelist', () => {
      auditor.customBlacklist = ['custombadword']
      auditor.customWhitelist = ['kill']

      const effective = auditor.getEffectiveBlacklist()
      expect(effective).toContain('custombadword')
      expect(effective).not.toContain('kill')
      expect(effective).toContain('murder')
    })

    it('filters non-severe words when standard sensitivity is active without audio bleeping', () => {
      auditor.safetySensitivity = 'standard'
      auditor.audioBleepEnabled = false

      const effective = auditor.getEffectiveBlacklist()
      expect(effective).toContain('murder') // severe word
      expect(effective).not.toContain('crash') // mild word in violence category
    })

    it('uses all category words when strict sensitivity is active', () => {
      auditor.safetySensitivity = 'strict'
      const effective = auditor.getEffectiveBlacklist()
      expect(effective).toContain('crash')
      expect(effective).toContain('murder')
    })

    it('evaluates comprehensive 3-pillar audit report in a single call', () => {
      const report = auditor.audit({
        transcript: [{ text: 'this is murder', start: 0, duration: 2 }],
        activeSafeZone: 'tiktok',
        subtitlePosition: 'bottom',
        subtitleOffset: 100, // Collides with bottom 250px deadzone
        subtitleBackground: 'none',
        subtitleStrokeWidth: 0 // Collides with readability
      })

      expect(report.score).toBeLessThan(80)
      expect(report.flaggedWords).toContain('murder')
      expect(report.isLayoutSafe).toBe(false)
      expect(report.isReadabilitySafe).toBe(false)
    })

    it('masks entire transcript array using maskTranscript()', () => {
      auditor.customBlacklist = ['danger']
      const masked = auditor.maskTranscript([
        { text: 'this is danger zone', start: 0, duration: 2 }
      ])
      expect(masked[0]?.text).toBe('this is d*nger zone')
    })

    it('manages bleep audio preset library lifecycle', () => {
      expect(auditor.bleepLibrary.length).toBeGreaterThanOrEqual(BUILTIN_BLEEP_PRESETS.length)
      expect(auditor.selectedBleepAudioId).toBe(DEFAULT_BLEEP_PRESET.id)

      // Add custom bleep
      const custom = auditor.addCustomBleepFile({ name: 'My Bleep', data: 'data:audio/mp3;base64,123' })
      expect(auditor.selectedBleepAudioId).toBe(custom.id)
      expect(auditor.customBleepFile?.name).toBe('My Bleep')

      // Select preset
      expect(auditor.selectBleepAudio('roblox_death')).toBe(true)
      expect(auditor.selectedBleepAudioId).toBe('roblox_death')

      // Remove custom bleep
      expect(auditor.removeCustomBleepFile(custom.id)).toBe(true)
      expect(auditor.bleepLibrary.some(item => item.id === custom.id)).toBe(false)
    })

    it('exports and hydrates state cleanly', () => {
      auditor.customBlacklist = ['testword']
      auditor.bleepPaddingOffset = 80
      auditor.bleepMode = 'partial_end'

      const exported = auditor.exportState()
      const freshAuditor = createContentSafetyAuditor()
      freshAuditor.hydrate(exported)

      expect(freshAuditor.customBlacklist).toEqual(['testword'])
      expect(freshAuditor.bleepPaddingOffset).toBe(80)
      expect(freshAuditor.bleepMode).toBe('partial_end')
    })

    it('serializes and hydrates with mock localStorage', () => {
      const storageMap = new Map<string, string>()
      const mockStorage = {
        getItem: (k: string) => storageMap.get(k) || null,
        setItem: (k: string, v: string) => { storageMap.set(k, v) },
        removeItem: (k: string) => { storageMap.delete(k) },
        clear: () => { storageMap.clear() },
        key: () => null,
        length: 0
      } as Storage

      auditor.customBlacklist = ['persisted_bad_word']
      auditor.serializeToStorage(mockStorage)

      const reloadedAuditor = createContentSafetyAuditor()
      reloadedAuditor.hydrateFromStorage(mockStorage)

      expect(reloadedAuditor.customBlacklist).toContain('persisted_bad_word')
    })
  })
})
