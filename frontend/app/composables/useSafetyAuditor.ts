// useSafetyAuditor.ts - Extracted safety and profanity scanning logic
import { auditTranscript } from '../utils/contentAuditor'
import { maskText } from '../utils/profanityMasker'
import type { Hook, TranscriptSegment, DeepAuditResult } from '../types/clipper'

export const DEFAULT_CATEGORIZED_BLACKLIST = {
  violence: [
    'kill', 'death', 'suicide', 'unalive', 'gun', 'blood', 'weapon', 'murder', 'shot',
    '/bunuh/', 'mati', 'tewas', '/darah/', '/senjata/', '/tembak/', 'perang', '/teroris/', '/bom/',
    'war', 'terror', 'bomb', 'crash', 'accident', 'crime'
  ],
  sexual: [
    'sex', 'porn', 'seggs', 'hentai', 'nude', 'nudity', 'sexy',
    '/bokep/', '/telanjang/', '/seks/', '/mesum/', 's*ksi', '/lonte/', '/perek/'
  ],
  profanity: [
    'sh!t', 'f*ck', 'b!tch', 'damn', 'hell',
    '/anjing/', '/anjg/', '/bangsat/', '/bgsat/', '/tolol/', '/goblok/', '/babi/', '/kontol/', '/kontl/', '/memek/', '/memk/', '/itil/', '/bajingan/', '/pantek/', '/jancok/', '/jancuk/', '/tai/'
  ]
}

export const CATEGORIZED_BLACKLIST = DEFAULT_CATEGORIZED_BLACKLIST

export const DEFAULT_BLACKLIST = [
  ...DEFAULT_CATEGORIZED_BLACKLIST.violence,
  ...DEFAULT_CATEGORIZED_BLACKLIST.sexual,
  ...DEFAULT_CATEGORIZED_BLACKLIST.profanity
]

export const SEVERE_WORDS = new Set([
  // violence
  'suicide', 'unalive', 'murder', 'bunuh', 'teroris', 'bom', 'terror', 'bomb',
  // sexual
  'porn', 'hentai', 'nude', 'nudity', 'bokep', 'telanjang', 'mesum', 'lonte', 'perek',
  // profanity
  'f*ck', 'b!tch', 'bangsat', 'bgsat', 'kontol', 'kontl', 'memek', 'memk', 'itil', 'bajingan', 'pantek', 'jancok', 'jancuk'
])

export interface BleepAudioItem {
  id: string
  name: string
  data: string
  isPreset?: boolean
}

export const DEFAULT_BLEEP_PRESET: BleepAudioItem = {
  id: 'default_preset',
  name: 'Standard Bleep',
  data: '/audio/bleep.wav',
  isPreset: true
}

export const useSafetyAuditor = () => {
  const API_BASE = 'http://localhost:8000'

  const customBlacklist = useState<string[]>('customBlacklist', () => [])
  const customWhitelist = useState<string[]>('customWhitelist', () => [])
  const safetySensitivity = useState<'strict' | 'standard' | 'manual'>('safetySensitivity', () => 'standard')
  const maskingStyle = useState<'asterisk' | 'block' | 'bleep_marker'>('maskingStyle', () => 'asterisk')
  const audioBleepEnabled = useState<boolean>('audioBleepEnabled', () => false)
  const audioBleepSource = useState<'mute' | 'custom'>('audioBleepSource', () => 'mute')
  const bleepLibrary = useState<BleepAudioItem[]>('bleepLibrary', () => [DEFAULT_BLEEP_PRESET])
  const selectedBleepAudioId = useState<string>('selectedBleepAudioId', () => DEFAULT_BLEEP_PRESET.id)
  const customBleepFile = useState<{ name: string; data: string } | null>('customBleepFile', () => ({
    name: DEFAULT_BLEEP_PRESET.name,
    data: DEFAULT_BLEEP_PRESET.data
  }))
  const bleepPaddingOffset = useState<number>('bleepPaddingOffset', () => 50)
  const bleepMode = useState<'full' | 'partial_end'>('bleepMode', () => 'full')
  const isWarningIgnored = useState<boolean>('isWarningIgnored', () => false)
  const activeCategories = useState<{ violence: boolean; sexual: boolean; profanity: boolean }>('activeCategories', () => ({
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

  const categorizedBlacklist = useState<Record<'violence' | 'sexual' | 'profanity', string[]>>('categorizedBlacklist', () => ({
    violence: [...DEFAULT_CATEGORIZED_BLACKLIST.violence],
    sexual: [...DEFAULT_CATEGORIZED_BLACKLIST.sexual],
    profanity: [...DEFAULT_CATEGORIZED_BLACKLIST.profanity]
  }))

  // Subtitle style / mode dependencies (will be synchronized globally via useState)
  const subtitleMode = useState<string>('subtitleMode')
  const fullTranscript = useState<TranscriptSegment[]>('fullTranscript')
  const timelineDuration = useState<number>('timelineDuration')
  const activeHook = useState<Hook | null>('activeHook')
  const language = useState<string>('language')
  const activeSafeZone = useState<'none' | 'tiktok' | 'reels' | 'shorts'>('activeSafeZone')
  const subtitleOffset = useState<number>('subtitleOffset')
  const subtitlePosition = useState<string>('subtitlePosition')
  const subtitleBackground = useState<string>('subtitleBackground')
  const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth')
  const subtitleStrokeColor = useState<string>('subtitleStrokeColor')

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
    const newItem: BleepAudioItem = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      data: file.data,
      isPreset: false
    }
    bleepLibrary.value.push(newItem)
    selectedBleepAudioId.value = newItem.id
    syncCustomBleepFile()
    saveBlacklistToStorage()
    return newItem
  }

  const removeCustomBleepFile = (id: string) => {
    const index = bleepLibrary.value.findIndex(item => item.id === id && !item.isPreset)
    if (index !== -1) {
      bleepLibrary.value.splice(index, 1)
      if (selectedBleepAudioId.value === id) {
        selectedBleepAudioId.value = DEFAULT_BLEEP_PRESET.id
      }
      syncCustomBleepFile()
      saveBlacklistToStorage()
    }
  }

  const saveBlacklistToStorage = () => {
    if (import.meta.client) {
      localStorage.setItem('yonru_subtitle_blacklist', JSON.stringify(customBlacklist.value))
      localStorage.setItem('yonru_subtitle_whitelist', JSON.stringify(customWhitelist.value))
      localStorage.setItem('yonru_categorized_blacklist', JSON.stringify(categorizedBlacklist.value))
      localStorage.setItem('yonru_audio_bleep_enabled', audioBleepEnabled.value ? 'true' : 'false')
      localStorage.setItem('yonru_audio_bleep_source', audioBleepSource.value)
      localStorage.setItem('yonru_bleep_padding_offset', bleepPaddingOffset.value.toString())
      localStorage.setItem('yonru_selected_bleep_id', selectedBleepAudioId.value)
      const customOnly = bleepLibrary.value.filter(item => !item.isPreset)
      localStorage.setItem('yonru_bleep_library', JSON.stringify(customOnly))
      if (customBleepFile.value) {
        localStorage.setItem('yonru_custom_bleep_file', JSON.stringify(customBleepFile.value))
      } else {
        localStorage.removeItem('yonru_custom_bleep_file')
      }
    }
  }

  const loadBlacklistFromStorage = () => {
    if (import.meta.client) {
      const savedBlack = localStorage.getItem('yonru_subtitle_blacklist')
      if (savedBlack) {
        try {
          customBlacklist.value = JSON.parse(savedBlack)
        } catch (e) {
          customBlacklist.value = []
        }
      }
      const savedWhite = localStorage.getItem('yonru_subtitle_whitelist')
      if (savedWhite) {
        try {
          customWhitelist.value = JSON.parse(savedWhite)
        } catch (e) {
          customWhitelist.value = []
        }
      }
      const savedCategorized = localStorage.getItem('yonru_categorized_blacklist')
      if (savedCategorized) {
        try {
          categorizedBlacklist.value = JSON.parse(savedCategorized)
        } catch (e) {
          // Keep default values
        }
      }
      const savedBleepSource = localStorage.getItem('yonru_audio_bleep_source')
      if (savedBleepSource === 'mute' || savedBleepSource === 'custom') {
        audioBleepSource.value = savedBleepSource
      }

      const savedLibrary = localStorage.getItem('yonru_bleep_library')
      if (savedLibrary) {
        try {
          const parsedCustom: BleepAudioItem[] = JSON.parse(savedLibrary)
          bleepLibrary.value = [DEFAULT_BLEEP_PRESET, ...parsedCustom]
        } catch (e) {
          bleepLibrary.value = [DEFAULT_BLEEP_PRESET]
        }
      } else {
        bleepLibrary.value = [DEFAULT_BLEEP_PRESET]
      }

      const savedSelectedId = localStorage.getItem('yonru_selected_bleep_id')
      if (savedSelectedId && bleepLibrary.value.some(item => item.id === savedSelectedId)) {
        selectedBleepAudioId.value = savedSelectedId
      } else {
        selectedBleepAudioId.value = DEFAULT_BLEEP_PRESET.id
      }
      syncCustomBleepFile()

      const savedBleepEnabled = localStorage.getItem('yonru_audio_bleep_enabled')
      if (savedBleepEnabled !== null) {
        audioBleepEnabled.value = savedBleepEnabled === 'true'
      }
      const savedPadding = localStorage.getItem('yonru_bleep_padding_offset')
      if (savedPadding !== null) {
        const parsed = parseInt(savedPadding, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          bleepPaddingOffset.value = parsed
        }
      }
      const savedBleepMode = localStorage.getItem('yonru_bleep_mode')
      if (savedBleepMode === 'full' || savedBleepMode === 'partial_end') {
        bleepMode.value = savedBleepMode
      }
    }
  }

  watch(bleepMode, (val) => {
    if (import.meta.client) {
      localStorage.setItem('yonru_bleep_mode', val)
    }
  })

  // Compile active blacklist categories & custom blacklist minus custom whitelist exceptions
  const compiledBlacklist = computed(() => {
    const list: string[] = []
    
    if (safetySensitivity.value !== 'manual') {
      const categories: ('violence' | 'sexual' | 'profanity')[] = ['violence', 'sexual', 'profanity']
      for (const cat of categories) {
        if (activeCategories.value[cat]) {
          const words = categorizedBlacklist.value[cat] || []
          if (safetySensitivity.value === 'standard' && !audioBleepEnabled.value) {
            // Only severe words OR user-added words (not in default list)
            const defaultSet = new Set(DEFAULT_CATEGORIZED_BLACKLIST[cat])
            list.push(...words.filter(word => {
              const clean = word.startsWith('/') && word.endsWith('/') ? word.slice(1, -1) : word
              const isSevere = SEVERE_WORDS.has(clean.toLowerCase().trim())
              const isUserAdded = !defaultSet.has(word)
              return isSevere || isUserAdded
            }))
          } else {
            // Strict mode OR audio bleep enabled uses all words from active categories
            list.push(...words)
          }
        }
      }
    }
    
    // Add custom blacklist
    list.push(...customBlacklist.value)
    
    // Filter out case-insensitive whitelisted words
    const whitelistSet = new Set(customWhitelist.value.map(w => w.toLowerCase().trim()))
    return [...new Set(list)].filter(word => {
      const cleanWord = word.startsWith('/') && word.endsWith('/') ? word.slice(1, -1) : word
      return !whitelistSet.has(cleanWord.toLowerCase().trim()) && !whitelistSet.has(word.toLowerCase().trim())
    })
  })

  const contentAudit = computed(() => {
    const transcript = fullTranscript.value || []
    const mode = subtitleMode.value || 'word'

    // Compile active blacklist based on sensitivity
    const activeBlacklist = compiledBlacklist.value

    const rawAudit = auditTranscript(transcript, activeBlacklist, mode, bleepPaddingOffset.value, bleepMode.value)
    
    // Adjust score based on safe zone layout collision and readability
    const currentPlatform = activeSafeZone.value || 'none'
    const isLayoutFilterActive = currentPlatform === 'none' || 
      (currentPlatform === 'tiktok' && activePlatformFilters.value.tiktok) ||
      (currentPlatform === 'reels' && activePlatformFilters.value.reels) ||
      (currentPlatform === 'shorts' && activePlatformFilters.value.shorts)

    const isLayoutSafe = !isLayoutFilterActive || layoutAudit.value.isSafe
    const isReadabilitySafe = readabilityAudit.value.isSafe
    
    let adjustedScore = rawAudit.score
    if (!isLayoutSafe) adjustedScore -= 15
    if (!isReadabilitySafe) adjustedScore -= 10
    adjustedScore = Math.max(0, adjustedScore)

    // Override visual scores if warning is ignored
    if (isWarningIgnored.value) {
      return {
        ...rawAudit,
        score: 100,
        flaggedWords: []
      }
    }

    return {
      ...rawAudit,
      score: adjustedScore
    }
  })

  // Pilar 2: Cek Tabrakan Tata Letak dengan Safe Zone Platform aktif
  const layoutAudit = computed(() => {
    const platform = activeSafeZone.value || 'none'
    const position = subtitlePosition.value || 'center'
    const offset = subtitleOffset.value || 0

    // If platform checks are toggled off or warning ignored, treat layout as safe
    const isFilterActive = platform === 'none' ||
      (platform === 'tiktok' && activePlatformFilters.value.tiktok) ||
      (platform === 'reels' && activePlatformFilters.value.reels) ||
      (platform === 'shorts' && activePlatformFilters.value.shorts)

    if (platform === 'none' || !isFilterActive || isWarningIgnored.value) {
      return {
        isSafe: true,
        reason: 'No safe zone selected or check is disabled.',
        collisionCount: 0
      }
    }

    let isColliding = false
    let reason = 'Subtitles are placed in a safe layout zone.'

    if (position === 'top') {
      const topDeadzone = platform === 'tiktok' ? 130 : (platform === 'reels' ? 220 : 160)
      if (offset < topDeadzone) {
        isColliding = true
        reason = `Subtitles collide with top ${platform} header zone (${topDeadzone}px).`
      }
    } else if (position === 'bottom') {
      const bottomDeadzone = platform === 'tiktok' ? 250 : (platform === 'reels' ? 350 : 280)
      if (offset < bottomDeadzone) {
        isColliding = true
        reason = `Subtitles collide with bottom ${platform} controls/caption zone (${bottomDeadzone}px).`
      }
    }

    return {
      isSafe: !isColliding,
      reason,
      collisionCount: isColliding ? 1 : 0
    }
  })

  // Action to fit subtitle Y coordinate into safe zone
  const fitSubtitlesToSafeZone = () => {
    const platform = activeSafeZone.value || 'none'
    const position = subtitlePosition.value || 'center'

    if (platform === 'none') return

    if (position === 'top') {
      const topDeadzone = platform === 'tiktok' ? 130 : (platform === 'reels' ? 220 : 160)
      subtitleOffset.value = topDeadzone + 20
    } else if (position === 'bottom') {
      const bottomDeadzone = platform === 'tiktok' ? 250 : (platform === 'reels' ? 350 : 280)
      subtitleOffset.value = bottomDeadzone + 20
    }
  }

  // Pilar 3: Cek Keterbacaan & Kontras Subtitle
  const readabilityAudit = computed(() => {
    if (isWarningIgnored.value) {
      return {
        isSafe: true,
        reason: 'Subtitle readability warnings ignored.'
      }
    }

    const bg = subtitleBackground.value || 'none'
    const strokeWidth = subtitleStrokeWidth.value || 0
    const strokeColor = subtitleStrokeColor.value || '#000000'

    const hasBg = bg !== 'none'
    const hasStroke = strokeWidth >= 2 && strokeColor !== 'transparent' && strokeColor !== 'none'

    let isSafe = true
    let reason = 'Subtitle readability is secured with active outline or background styles.'

    if (!hasBg && !hasStroke) {
      isSafe = false
      reason = 'Low subtitle contrast: Add a text outline or background box to guarantee readability.'
    }

    return {
      isSafe,
      reason
    }
  })

  // Action to fix readability by applying a high-contrast dark outline
  const fitSubtitlesToReadability = () => {
    subtitleStrokeWidth.value = 4
    subtitleStrokeColor.value = '#000000'
  }

  // Action to ignore safety warnings with confirmation dialog
  const ignoreSafetyWarnings = () => {
    if (import.meta.client) {
      const confirmIgnore = window.confirm(
        "Are you sure you want to ignore safety warnings? Flagged words will remain uncensored in the final video export, which could lead to platform shadowbans."
      )
      if (confirmIgnore) {
        isWarningIgnored.value = true
      }
    } else {
      isWarningIgnored.value = true
    }
  }

  // Action to restore warnings
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
    
    // Choose blacklist according to sensitivity settings
    const activeBlacklist = compiledBlacklist.value
    
    fullTranscript.value = transcript.map(seg => ({
      ...seg,
      text: maskText(seg.text || '', activeBlacklist, maskingStyle.value)
    }))
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
