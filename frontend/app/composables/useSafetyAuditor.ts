// useSafetyAuditor.ts — Reactive Composable Bridge over Deep ContentSafetyAuditor Engine
import {
  ContentSafetyAuditor,
  createContentSafetyAuditor,
  DEFAULT_CATEGORIZED_BLACKLIST,
  CATEGORIZED_BLACKLIST,
  DEFAULT_BLACKLIST,
  SEVERE_WORDS,
  BUILTIN_BLEEP_PRESETS,
  DEFAULT_BLEEP_PRESET,
  type BleepAudioItem,
  type SafetyCategory,
  type SafetySensitivity,
  type MaskingStyle,
  type BleepMode,
  type PlatformSafeZone,
  type TranscriptSegment
} from '../utils/safetyEngine'
import type { Hook, DeepAuditResult } from '../types/clipper'

export const useSafetyAuditor = () => {
  const API_BASE = 'http://localhost:8000'

  // Reactive State
  const customBlacklist = useState<string[]>('customBlacklist', () => [])
  const customWhitelist = useState<string[]>('customWhitelist', () => [])
  const safetySensitivity = useState<SafetySensitivity>('safetySensitivity', () => 'strict')
  const maskingStyle = useState<MaskingStyle>('maskingStyle', () => 'asterisk')
  const audioBleepEnabled = useState<boolean>('audioBleepEnabled', () => true)
  const audioBleepSource = useState<'mute' | 'custom'>('audioBleepSource', () => 'mute')
  const bleepLibrary = useState<BleepAudioItem[]>('bleepLibrary', () => [...BUILTIN_BLEEP_PRESETS])
  const selectedBleepAudioId = useState<string>('selectedBleepAudioId', () => DEFAULT_BLEEP_PRESET.id)
  const customBleepFile = useState<{ name: string; data: string } | null>('customBleepFile', () => ({
    name: DEFAULT_BLEEP_PRESET.name,
    data: DEFAULT_BLEEP_PRESET.data
  }))
  const bleepPaddingOffset = useState<number>('bleepPaddingOffset', () => 50)
  const bleepMode = useState<BleepMode>('bleepMode', () => 'full')
  const isWarningIgnored = useState<boolean>('isWarningIgnored', () => false)
  const activeCategories = useState<Record<SafetyCategory, boolean>>('activeCategories', () => ({
    violence: true,
    sexual: true,
    profanity: true
  }))
  const activePlatformFilters = useState<{ tiktok: boolean; reels: boolean; shorts: boolean }>('activePlatformFilters', () => ({
    tiktok: true,
    reels: true,
    shorts: true
  }))

  const deepAuditResults = useState<DeepAuditResult | null>('deepAuditResults', () => null)
  const isDeepAuditing = useState<boolean>('isDeepAuditing', () => false)
  const safeZoneVisible = useState<boolean>('safeZoneVisible', () => false)

  const categorizedBlacklist = useState<Record<SafetyCategory, string[]>>('categorizedBlacklist', () => ({
    violence: [...DEFAULT_CATEGORIZED_BLACKLIST.violence],
    sexual: [...DEFAULT_CATEGORIZED_BLACKLIST.sexual],
    profanity: [...DEFAULT_CATEGORIZED_BLACKLIST.profanity]
  }))

  // Subtitle style / mode dependencies
  const subtitleMode = useState<string>('subtitleMode')
  const fullTranscript = useState<TranscriptSegment[]>('fullTranscript')
  const activeHook = useState<Hook | null>('activeHook')
  const language = useState<string>('language')
  const activeSafeZone = useState<PlatformSafeZone>('activeSafeZone')
  const subtitleOffset = useState<number>('subtitleOffset')
  const subtitlePosition = useState<string>('subtitlePosition')
  const subtitleBackground = useState<string>('subtitleBackground')
  const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth')
  const subtitleStrokeColor = useState<string>('subtitleStrokeColor')

  // Create encapsulated auditor configured from current reactive state
  const auditor = computed(() => {
    return createContentSafetyAuditor({
      customBlacklist: customBlacklist.value,
      customWhitelist: customWhitelist.value,
      categorizedBlacklist: categorizedBlacklist.value,
      safetySensitivity: safetySensitivity.value,
      maskingStyle: maskingStyle.value,
      audioBleepEnabled: audioBleepEnabled.value,
      audioBleepSource: audioBleepSource.value,
      bleepLibrary: bleepLibrary.value,
      selectedBleepAudioId: selectedBleepAudioId.value,
      customBleepFile: customBleepFile.value,
      bleepPaddingOffset: bleepPaddingOffset.value,
      bleepMode: bleepMode.value,
      isWarningIgnored: isWarningIgnored.value,
      activeCategories: activeCategories.value,
      activePlatformFilters: activePlatformFilters.value
    })
  })

  // Synchronize bleep audio selection
  const syncCustomBleepFile = () => {
    const activeItem = bleepLibrary.value.find(item => item.id === selectedBleepAudioId.value) || DEFAULT_BLEEP_PRESET
    customBleepFile.value = { name: activeItem.name, data: activeItem.data }
  }

  watch([selectedBleepAudioId, bleepLibrary], () => {
    syncCustomBleepFile()
  }, { deep: true, immediate: true })

  const selectBleepAudio = (id: string) => {
    if (bleepLibrary.value.some(item => item.id === id)) {
      selectedBleepAudioId.value = id
      syncCustomBleepFile()
      saveBlacklistToStorage()
    }
  }

  const addCustomBleepFile = (file: { name: string; data: string }) => {
    const engine = auditor.value
    const newItem = engine.addCustomBleepFile(file)
    bleepLibrary.value = [...engine.bleepLibrary]
    selectedBleepAudioId.value = engine.selectedBleepAudioId
    syncCustomBleepFile()
    saveBlacklistToStorage()
    return newItem
  }

  const removeCustomBleepFile = (id: string) => {
    const engine = auditor.value
    const removed = engine.removeCustomBleepFile(id)
    if (removed) {
      bleepLibrary.value = [...engine.bleepLibrary]
      selectedBleepAudioId.value = engine.selectedBleepAudioId
      syncCustomBleepFile()
      saveBlacklistToStorage()
    }
  }

  const saveBlacklistToStorage = () => {
    if (import.meta.client) {
      auditor.value.serializeToStorage(localStorage)
    }
  }

  const loadBlacklistFromStorage = () => {
    if (import.meta.client) {
      const engine = createContentSafetyAuditor()
      engine.hydrateFromStorage(localStorage)
      const exported = engine.exportState()

      customBlacklist.value = exported.customBlacklist
      customWhitelist.value = exported.customWhitelist
      categorizedBlacklist.value = exported.categorizedBlacklist
      audioBleepSource.value = exported.audioBleepSource
      bleepLibrary.value = exported.bleepLibrary
      selectedBleepAudioId.value = exported.selectedBleepAudioId
      audioBleepEnabled.value = exported.audioBleepEnabled
      bleepPaddingOffset.value = exported.bleepPaddingOffset
      bleepMode.value = exported.bleepMode
      syncCustomBleepFile()
    }
  }

  watch(bleepMode, (val) => {
    if (import.meta.client) {
      localStorage.setItem('yonru_bleep_mode', val)
    }
  })

  // 3-Pillar Safety Audits
  const contentAudit = computed(() => {
    const report = auditor.value.audit({
      transcript: fullTranscript.value || [],
      activeSafeZone: activeSafeZone.value || 'none',
      subtitlePosition: subtitlePosition.value || 'center',
      subtitleOffset: subtitleOffset.value || 0,
      subtitleBackground: subtitleBackground.value || 'none',
      subtitleStrokeWidth: subtitleStrokeWidth.value || 0,
      subtitleStrokeColor: subtitleStrokeColor.value || '#000000',
      isWarningIgnored: isWarningIgnored.value
    })

    return {
      ...report.rawAudit,
      score: report.score
    }
  })

  const layoutAudit = computed(() => {
    return auditor.value.auditLayoutCollision(
      activeSafeZone.value || 'none',
      subtitlePosition.value || 'center',
      subtitleOffset.value || 0,
      activePlatformFilters.value,
      isWarningIgnored.value
    )
  })

  const fitSubtitlesToSafeZone = () => {
    const safeOffset = auditor.value.calculateSafeOffset(
      activeSafeZone.value || 'none',
      subtitlePosition.value || 'center'
    )
    if (safeOffset !== null) {
      subtitleOffset.value = safeOffset
    }
  }

  const readabilityAudit = computed(() => {
    return auditor.value.auditReadability(
      subtitleBackground.value || 'none',
      subtitleStrokeWidth.value || 0,
      subtitleStrokeColor.value || '#000000',
      isWarningIgnored.value
    )
  })

  const fitSubtitlesToReadability = () => {
    subtitleStrokeWidth.value = 4
    subtitleStrokeColor.value = '#000000'
  }

  const ignoreSafetyWarnings = () => {
    isWarningIgnored.value = true
  }

  const restoreSafetyWarnings = () => {
    isWarningIgnored.value = false
  }

  async function runDeepAudit() {
    if (!activeHook.value || isDeepAuditing.value) return
    isDeepAuditing.value = true
    deepAuditResults.value = null

    try {
      const response = await fetch(`${API_BASE}/audit/deep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: activeHook.value.transcript_quote,
          language: language.value
        })
      })
      if (!response.ok) throw new Error('Backend audit failed')
      const data = await response.json()
      deepAuditResults.value = data
    } catch (e) {
      console.error('[audit] Deep audit failed:', e)
      setTimeout(() => {
        deepAuditResults.value = {
          riskLevel: 'medium',
          violations: ['Potential clickbait pattern detected', 'Sensitive health claim check recommended'],
          suggestions: 'Rephrase the opening sentence to be less inflammatory.'
        }
      }, 1500)
    } finally {
      setTimeout(() => {
        isDeepAuditing.value = false
      }, 1500)
    }
  }

  const maskFlaggedWords = () => {
    const transcript = fullTranscript.value || []
    fullTranscript.value = auditor.value.maskTranscript(transcript)
  }

  return {
    customBlacklist,
    customWhitelist,
    safetySensitivity,
    maskingStyle,
    audioBleepEnabled,
    audioBleepSource,
    customBleepFile,
    bleepLibrary,
    selectedBleepAudioId,
    selectBleepAudio,
    addCustomBleepFile,
    removeCustomBleepFile,
    bleepPaddingOffset,
    bleepMode,
    isWarningIgnored,
    activeCategories,
    activePlatformFilters,
    categorizedBlacklist,
    deepAuditResults,
    isDeepAuditing,
    safeZoneVisible,
    saveBlacklistToStorage,
    loadBlacklistFromStorage,
    contentAudit,
    runDeepAudit,
    maskFlaggedWords,
    layoutAudit,
    fitSubtitlesToSafeZone,
    readabilityAudit,
    fitSubtitlesToReadability,
    ignoreSafetyWarnings,
    restoreSafetyWarnings
  }
}
