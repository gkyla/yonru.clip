// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest'
import { useState } from '#app'
import { useSafetyAuditor } from '../../app/composables/useSafetyAuditor'
import { DEFAULT_BLEEP_PRESET } from '../../app/utils/safetyEngine'
import type { TranscriptSegment } from '../../app/types/clipper'

describe('useSafetyAuditor Composable Reactive Seam', () => {
  beforeEach(() => {
    // Reset global Nuxt states
    const customBlacklist = useState<string[]>('customBlacklist', () => [])
    const customWhitelist = useState<string[]>('customWhitelist', () => [])
    const safetySensitivity = useState<'strict' | 'standard' | 'manual'>('safetySensitivity', () => 'strict')
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript', () => [])
    const activeSafeZone = useState<string>('activeSafeZone', () => 'none')
    const subtitleOffset = useState<number>('subtitleOffset', () => 50)
    const subtitlePosition = useState<string>('subtitlePosition', () => 'center')
    const subtitleBackground = useState<string>('subtitleBackground', () => 'none')
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth', () => 4)
    const subtitleStrokeColor = useState<string>('subtitleStrokeColor', () => '#000000')
    const isWarningIgnored = useState<boolean>('isWarningIgnored', () => false)

    customBlacklist.value = []
    customWhitelist.value = []
    safetySensitivity.value = 'strict'
    fullTranscript.value = []
    activeSafeZone.value = 'none'
    subtitleOffset.value = 50
    subtitlePosition.value = 'center'
    subtitleBackground.value = 'none'
    subtitleStrokeWidth.value = 4
    subtitleStrokeColor.value = '#000000'
    isWarningIgnored.value = false
  })

  it('computes contentAudit score reactively when transcript updates', () => {
    const auditor = useSafetyAuditor()
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript')

    expect(auditor.contentAudit.value.score).toBe(100)
    expect(auditor.contentAudit.value.flaggedWords).toEqual([])

    fullTranscript.value = [
      { text: 'this is a kill word', start: 0, duration: 2 }
    ]

    expect(auditor.contentAudit.value.flaggedWords).toContain('kill')
    expect(auditor.contentAudit.value.score).toBeLessThan(100)
  })

  it('allows adding and removing custom bleep files reactively', () => {
    const auditor = useSafetyAuditor()

    const initialLen = auditor.bleepLibrary.value.length
    const newItem = auditor.addCustomBleepFile({
      name: 'Custom Sound',
      data: 'data:audio/mp3;base64,abc'
    })

    expect(auditor.bleepLibrary.value.length).toBe(initialLen + 1)
    expect(auditor.selectedBleepAudioId.value).toBe(newItem.id)

    auditor.removeCustomBleepFile(newItem.id)
    expect(auditor.bleepLibrary.value.length).toBe(initialLen)
    expect(auditor.selectedBleepAudioId.value).toBe(DEFAULT_BLEEP_PRESET.id)
  })

  it('handles safe zone snapping via fitSubtitlesToSafeZone()', () => {
    const auditor = useSafetyAuditor()
    const activeSafeZone = useState<string>('activeSafeZone')
    const subtitlePosition = useState<string>('subtitlePosition')
    const subtitleOffset = useState<number>('subtitleOffset')

    activeSafeZone.value = 'tiktok'
    subtitlePosition.value = 'bottom'
    subtitleOffset.value = 50 // In deadzone (<250px)

    expect(auditor.layoutAudit.value.isSafe).toBe(false)

    auditor.fitSubtitlesToSafeZone()
    expect(subtitleOffset.value).toBe(270) // Safe offset: 250 + 20
    expect(auditor.layoutAudit.value.isSafe).toBe(true)
  })

  it('fixes contrast issues via fitSubtitlesToReadability()', () => {
    const auditor = useSafetyAuditor()
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth')
    const subtitleStrokeColor = useState<string>('subtitleStrokeColor')
    const subtitleBackground = useState<string>('subtitleBackground')

    subtitleBackground.value = 'none'
    subtitleStrokeWidth.value = 0 // Low contrast

    expect(auditor.readabilityAudit.value.isSafe).toBe(false)

    auditor.fitSubtitlesToReadability()
    expect(subtitleStrokeWidth.value).toBe(4)
    expect(subtitleStrokeColor.value).toBe('#000000')
    expect(auditor.readabilityAudit.value.isSafe).toBe(true)
  })

  it('masks flagged words in fullTranscript with maskFlaggedWords()', () => {
    const auditor = useSafetyAuditor()
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript')

    fullTranscript.value = [
      { text: 'jangan bunuh diri', start: 0, duration: 2 }
    ]

    auditor.maskFlaggedWords()
    expect(fullTranscript.value[0]?.text).toBe('jangan b*nuh diri')
  })

  it('allows ignoring and restoring safety warnings', () => {
    const auditor = useSafetyAuditor()
    const fullTranscript = useState<TranscriptSegment[]>('fullTranscript')

    fullTranscript.value = [
      { text: 'kill', start: 0, duration: 1 }
    ]

    expect(auditor.contentAudit.value.score).toBeLessThan(100)

    auditor.ignoreSafetyWarnings()
    expect(auditor.contentAudit.value.score).toBe(100)

    auditor.restoreSafetyWarnings()
    expect(auditor.contentAudit.value.score).toBeLessThan(100)
  })
})
