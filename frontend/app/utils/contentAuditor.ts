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
  mode: string,
  bleepPaddingOffsetMs: number = 50
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

  const paddingSec = (bleepPaddingOffsetMs || 0) / 1000

  flatWords.forEach(w => {
    const lowerText = w.text.toLowerCase()
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
        const paddedStart = Math.max(0, w.start - paddingSec)
        const paddedDuration = w.duration + (2 * paddingSec)
        flaggedSegments.push({
          start: paddedStart,
          duration: paddedDuration,
          word,
          text: w.text
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
