/**
 * SafetyEngine — Pure-function domain engine for content safety, profanity detection,
 * layout safe-zone collisions, and subtitle readability auditing.
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

export interface LayoutAuditResult {
  isSafe: boolean
  reason: string
  collisionCount: number
}

export interface ReadabilityAuditResult {
  isSafe: boolean
  reason: string
}

export interface CompiledPattern {
  source: string
  regex: RegExp
  globalRegex: RegExp
}

// Regex compilation cache for high-throughput single-pass filtering
const patternCache = new Map<string, CompiledPattern>()

export function getCompiledPattern(word: string): CompiledPattern | null {
  if (!word) return null
  const trimmed = word.trim()
  if (!trimmed) return null

  let pattern = patternCache.get(trimmed)
  if (!pattern) {
    if (trimmed.startsWith('/') && trimmed.endsWith('/') && trimmed.length > 2) {
      const raw = trimmed.slice(1, -1)
      pattern = {
        source: trimmed,
        regex: new RegExp(raw, 'i'),
        globalRegex: new RegExp(raw, 'gi')
      }
    } else {
      const escaped = trimmed.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      pattern = {
        source: trimmed,
        regex: new RegExp(`\\b${escaped}\\b`, 'i'),
        globalRegex: new RegExp(`\\b${escaped}\\b`, 'gi')
      }
    }
    patternCache.set(trimmed, pattern)
  }
  return pattern
}

export function compileBlacklist(blacklist: string[]): CompiledPattern[] {
  const compiled: CompiledPattern[] = []
  for (const word of blacklist) {
    const p = getCompiledPattern(word)
    if (p) compiled.push(p)
  }
  return compiled
}

export function auditTranscript(
  transcript: TranscriptSegment[],
  blacklist: string[],
  _mode: string = 'word',
  bleepPaddingOffsetMs: number = 50,
  bleepMode: 'full' | 'partial_end' = 'full'
): AuditResult {
  const flaggedWords: string[] = []
  const flaggedSegments: FlaggedSegment[] = []

  const compiledPatterns = compileBlacklist(blacklist)
  if (compiledPatterns.length === 0 || !transcript || transcript.length === 0) {
    return {
      score: 100,
      flaggedWords: [],
      flaggedSegments: [],
      uniqueFlagsCount: 0
    }
  }

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
          start: seg.start + idx * wordDur,
          duration: wordDur,
          end: seg.start + (idx + 1) * wordDur
        })
      })
    }
  }

  const paddingSec = (bleepPaddingOffsetMs || 0) / 1000

  for (const w of flatWords) {
    const lowerText = w.text.toLowerCase()
    for (const pattern of compiledPatterns) {
      if (pattern.regex.test(lowerText)) {
        let segStart: number
        let segDuration: number

        if (bleepMode === 'partial_end') {
          const halfDur = w.duration * 0.5
          segStart = w.start + halfDur
          segDuration = halfDur + paddingSec
        } else {
          segStart = Math.max(0, w.start - paddingSec)
          segDuration = w.duration + 2 * paddingSec
        }

        flaggedSegments.push({
          start: segStart,
          duration: segDuration,
          word: pattern.source,
          text: w.text
        })
        if (!flaggedWords.includes(pattern.source)) {
          flaggedWords.push(pattern.source)
        }
      }
    }
  }

  let score = 100
  const uniqueTimeFlags = new Set(flaggedSegments.map(f => f.start.toFixed(2))).size
  score -= uniqueTimeFlags * 12

  return {
    score: Math.max(0, score),
    flaggedWords,
    flaggedSegments,
    uniqueFlagsCount: flaggedSegments.length
  }
}

export function maskText(
  text: string,
  blacklist: string[],
  style: 'asterisk' | 'block' | 'bleep_marker' = 'asterisk'
): string {
  let masked = text || ''
  if (!masked || !blacklist || blacklist.length === 0) return masked

  const compiledPatterns = compileBlacklist(blacklist)

  for (const pattern of compiledPatterns) {
    masked = masked.replace(pattern.globalRegex, (match: string) => {
      if (style === 'block') {
        return '*'.repeat(match.length)
      } else if (style === 'bleep_marker') {
        return '[BLEEP]'
      } else {
        if (match.length <= 1) return match
        if (match.length === 2) return match.charAt(0) + '*'
        return match.charAt(0) + '*' + match.slice(2)
      }
    })
  }
  return masked
}

export function auditLayoutCollision(
  platform: 'none' | 'tiktok' | 'reels' | 'shorts',
  position: 'top' | 'bottom' | 'center' | string,
  offset: number,
  activeFilters: { tiktok: boolean; reels: boolean; shorts: boolean },
  isWarningIgnored: boolean = false
): LayoutAuditResult {
  const isFilterActive =
    platform === 'none' ||
    (platform === 'tiktok' && activeFilters.tiktok) ||
    (platform === 'reels' && activeFilters.reels) ||
    (platform === 'shorts' && activeFilters.shorts)

  if (platform === 'none' || !isFilterActive || isWarningIgnored) {
    return {
      isSafe: true,
      reason: 'No safe zone selected or check is disabled.',
      collisionCount: 0
    }
  }

  let isColliding = false
  let reason = 'Subtitles are placed in a safe layout zone.'

  if (position === 'top') {
    const topDeadzone = platform === 'tiktok' ? 130 : platform === 'reels' ? 220 : 160
    if (offset < topDeadzone) {
      isColliding = true
      reason = `Subtitles collide with top ${platform} header zone (${topDeadzone}px).`
    }
  } else if (position === 'bottom') {
    const bottomDeadzone = platform === 'tiktok' ? 250 : platform === 'reels' ? 350 : 280
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
}

export function calculateSafeOffset(
  platform: 'none' | 'tiktok' | 'reels' | 'shorts',
  position: 'top' | 'bottom' | 'center' | string
): number | null {
  if (platform === 'none') return null
  if (position === 'top') {
    const topDeadzone = platform === 'tiktok' ? 130 : platform === 'reels' ? 220 : 160
    return topDeadzone + 20
  }
  if (position === 'bottom') {
    const bottomDeadzone = platform === 'tiktok' ? 250 : platform === 'reels' ? 350 : 280
    return bottomDeadzone + 20
  }
  return null
}

export function auditReadability(
  background: string = 'none',
  strokeWidth: number = 0,
  strokeColor: string = '#000000',
  isWarningIgnored: boolean = false
): ReadabilityAuditResult {
  if (isWarningIgnored) {
    return {
      isSafe: true,
      reason: 'Subtitle readability warnings ignored.'
    }
  }

  const hasBg = background !== 'none'
  const hasStroke = strokeWidth >= 2 && strokeColor !== 'transparent' && strokeColor !== 'none'

  if (!hasBg && !hasStroke) {
    return {
      isSafe: false,
      reason: 'Low subtitle contrast: Add a text outline or background box to guarantee readability.'
    }
  }

  return {
    isSafe: true,
    reason: 'Subtitle readability is secured with active outline or background styles.'
  }
}

export function calculateAdjustedScore(
  rawScore: number,
  isLayoutSafe: boolean,
  isReadabilitySafe: boolean,
  isWarningIgnored: boolean = false
): number {
  if (isWarningIgnored) return 100

  let score = rawScore
  if (!isLayoutSafe) score -= 15
  if (!isReadabilitySafe) score -= 10
  return Math.max(0, score)
}
