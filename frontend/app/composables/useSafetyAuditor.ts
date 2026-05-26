// useSafetyAuditor.ts - Extracted safety and profanity scanning logic
export const DEFAULT_BLACKLIST = [
  // Violence & Harm
  'kill', 'death', 'suicide', 'unalive', 'gun', 'blood', 'weapon', 'murder', 'shot',
  '/bunuh/', 'mati', 'tewas', '/darah/', '/senjata/', '/tembak/', 'perang', '/teroris/', '/bom/',
  // Sexual
  'sex', 'porn', 'seggs', 'hentai', 'nude', 'nudity', 'sexy',
  '/bokep/', '/telanjang/', '/seks/', '/mesum/', 's*ksi',
  // Sensitive
  'war', 'terror', 'bomb', 'crash', 'accident', 'crime',
  // Algospeak / Profanity
  'sh!t', 'f*ck', 'b!tch', 'damn', 'hell',
  '/anjing/', '/bangsat/', '/tolol/', '/goblok/', '/babi/', '/kontol/', '/memek/', '/itil/'
]

export const useSafetyAuditor = () => {
  const API_BASE = 'http://localhost:8000'

  const customBlacklist = useState<string[]>('customBlacklist', () => [])
  const deepAuditResults = useState<any | null>('deepAuditResults', () => null)
  const isDeepAuditing = useState<boolean>('isDeepAuditing', () => false)
  const safeZoneVisible = useState<boolean>('safeZoneVisible', () => false)

  // Subtitle style / mode dependencies (will be synchronized globally via useState)
  const subtitleMode = useState<string>('subtitleMode')
  const fullTranscript = useState<any[]>('fullTranscript')
  const timelineDuration = useState<number>('timelineDuration')
  const activeHook = useState<any | null>('activeHook')
  const language = useState<string>('language')

  const saveBlacklistToStorage = () => {
    if (import.meta.client) {
      localStorage.setItem('yonru_subtitle_blacklist', JSON.stringify(customBlacklist.value))
    }
  }

  const loadBlacklistFromStorage = () => {
    if (import.meta.client) {
      const saved = localStorage.getItem('yonru_subtitle_blacklist')
      if (saved) {
        try {
          customBlacklist.value = JSON.parse(saved)
        } catch (e) {
          customBlacklist.value = [...DEFAULT_BLACKLIST]
        }
      } else {
        customBlacklist.value = [...DEFAULT_BLACKLIST]
      }
    }
  }

  const contentAudit = computed(() => {
    const transcript = fullTranscript.value || []
    const combinedBlacklist = [...new Set([...DEFAULT_BLACKLIST, ...customBlacklist.value])]
    const mode = subtitleMode.value || 'word'
    
    const flaggedWords: string[] = []
    const flaggedSegments: { start: number, duration: number, word: string, text: string }[] = []
    
    const flatWords: { text: string, start: number, duration: number, end: number }[] = []
    
    for (const seg of transcript) {
      const segText = (seg.text || '').trim()
      if (!segText) continue
      
      const words = segText.split(/\s+/)
      if (words.length === 1) {
        flatWords.push({
          text: words[0],
          start: seg.start,
          duration: seg.duration,
          end: seg.start + seg.duration
        })
      } else {
        const wordDur = seg.duration / words.length
        words.forEach((w, idx) => {
          flatWords.push({
            text: w,
            start: seg.start + (idx * wordDur),
            duration: wordDur,
            end: seg.start + ((idx + 1) * wordDur)
          })
        })
      }
    }

    if (flatWords.length > 0) {
      let chunks: { text: string, start: number, duration: number }[] = []

      if (mode === 'word' || mode === '1_word') {
        chunks = flatWords.map(w => ({ text: w.text, start: w.start, duration: w.duration }))
      } else if (mode.endsWith('_words')) {
        let numWords = 1
        const match = mode.match(/^(\d+)_(?:word|words)$/)
        if (match) {
          numWords = parseInt(match[1]) || 1
        }
        
        for (let i = 0; i < flatWords.length; i += numWords) {
          const chunk = flatWords.slice(i, i + numWords)
          const start = chunk[0].start
          const end = chunk[chunk.length - 1].end
          const text = chunk.map(w => w.text).join(' ')
          chunks.push({ text, start, duration: end - start })
        }
      } else {
        const limit = parseInt(mode) || 0
        if (limit <= 0) {
          chunks = flatWords.map(w => ({ text: w.text, start: w.start, duration: w.duration }))
        } else {
          let currentChunk: typeof flatWords = []
          let currentLen = 0
          
          for (const w of flatWords) {
            if (currentLen + w.text.length > limit && currentChunk.length > 0) {
              const start = currentChunk[0].start
              const end = currentChunk[currentChunk.length - 1].end
              const text = currentChunk.map(c => c.text).join(' ')
              chunks.push({ text, start, duration: end - start })
              
              currentChunk = [w]
              currentLen = w.text.length
            } else {
              currentChunk.push(w)
              currentLen += w.text.length + (currentChunk.length > 1 ? 1 : 0)
            }
          }
          if (currentChunk.length > 0) {
            const start = currentChunk[0].start
            const end = currentChunk[currentChunk.length - 1].end
            const text = currentChunk.map(c => c.text).join(' ')
            chunks.push({ text, start, duration: end - start })
          }
        }
      }

      chunks.forEach(chunk => {
        const lowerText = chunk.text.toLowerCase()
        combinedBlacklist.forEach(word => {
          if (!word) return
          let regex: RegExp
          if (word.startsWith('/') && word.endsWith('/')) {
            regex = new RegExp(word.slice(1, -1), 'i')
          } else {
            const escapedWord = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            regex = new RegExp(`\\b${escapedWord}\\b`, 'i')
          }
          if (regex.test(lowerText)) {
            flaggedSegments.push({ 
              start: chunk.start, 
              duration: chunk.duration, 
              word, 
              text: chunk.text 
            })
            if (!flaggedWords.includes(word)) flaggedWords.push(word)
          }
        })
      })
    }

    const duration = timelineDuration.value || 0
    const isDurationOk = duration >= 5 && duration <= 60
    
    let score = 100
    const uniqueTimeFlags = new Set(flaggedSegments.map(f => f.start.toFixed(2))).size
    score -= (uniqueTimeFlags * 12) 
    
    if (duration < 5 || duration > 90) score -= 30
    else if (duration > 60) score -= 10
    
    return {
      score: Math.max(0, score),
      flaggedWords,
      flaggedSegments,
      isDurationOk,
      uniqueFlagsCount: flaggedSegments.length,
      durationReason: duration < 5 ? 'Too short' : duration > 60 ? 'Long' : 'Optimal'
    }
  })

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

  return {
    customBlacklist,
    deepAuditResults,
    isDeepAuditing,
    safeZoneVisible,
    saveBlacklistToStorage,
    loadBlacklistFromStorage,
    contentAudit,
    runDeepAudit
  }
}
