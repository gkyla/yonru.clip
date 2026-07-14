/**
 * Content Auditor — pure-function extraction from useSafetyAuditor composable.
 * Scores transcript segments against a blacklist and duration constraints.
 */

export interface TranscriptSegment {
  text: string
  start: number
  duration: number
}

export interface FlaggedSegment {
  start: number
  duration: number
  word: string
  text: string
}

export interface AuditResult {
  score: number
  flaggedWords: string[]
  flaggedSegments: FlaggedSegment[]
  uniqueFlagsCount: number
}

export function auditTranscript(
  transcript: TranscriptSegment[],
  blacklist: string[],
  mode: string
): AuditResult {
  const flaggedWords: string[] = []
  const flaggedSegments: FlaggedSegment[] = []

  const flatWords: { text: string; start: number; duration: number; end: number }[] = []

  for (const seg of transcript) {
    const segText = (seg.text || '').trim()
    if (!segText) continue

    const words = segText.split(/\s+/)
    if (words.length === 1) {
      flatWords.push({
        text: words[0] || '',
        start: seg.start,
        duration: seg.duration,
        end: seg.start + seg.duration
      })
    } else {
      const wordDur = seg.duration / words.length
      words.forEach((w: string, idx: number) => {
        flatWords.push({
          text: w,
          start: seg.start + (idx * wordDur),
          duration: wordDur,
          end: seg.start + ((idx + 1) * wordDur)
        })
      })
    }
  }

  let chunks: { text: string; start: number; duration: number }[] = []

  if (mode === 'word' || mode === '1_word') {
    chunks = flatWords.map(w => ({ text: w.text, start: w.start, duration: w.duration }))
  } else if (mode.endsWith('_words')) {
    let numWords = 1
    const match = mode.match(/^(\d+)_(?:word|words)$/)
    if (match && match[1]) {
      numWords = parseInt(match[1]) || 1
    }
    
    for (let i = 0; i < flatWords.length; i += numWords) {
      const chunk = flatWords.slice(i, i + numWords)
      if (chunk.length > 0) {
        const first = chunk[0]
        const last = chunk[chunk.length - 1]
        if (first && last) {
          const start = first.start
          const end = last.end
          const text = chunk.map(w => w.text).join(' ')
          chunks.push({ text, start, duration: end - start })
        }
      }
    }
  } else {
    chunks = flatWords.map(w => ({ text: w.text, start: w.start, duration: w.duration }))
  }

  chunks.forEach(chunk => {
    const lowerText = chunk.text.toLowerCase()
    blacklist.forEach(word => {
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

  let score = 100
  const uniqueTimeFlags = new Set(flaggedSegments.map(f => f.start.toFixed(2))).size
  score -= (uniqueTimeFlags * 12)

  return {
    score: Math.max(0, score),
    flaggedWords,
    flaggedSegments,
    uniqueFlagsCount: flaggedSegments.length
  }
}
