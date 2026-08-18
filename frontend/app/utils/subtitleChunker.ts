/**
 * SubtitleLayoutEngine — Deep Domain Engine for Subtitle Chunking,
 * Needleman-Wunsch Word Alignment, Start/Duration Scaling, and Timestamp Lookups.
 */

import type { TranscriptSegment } from '../types/clipper'

export interface ChunkerFlatWord {
  text: string
  start: number
  duration: number
  end: number
  originalSegment?: ChunkerSegment
}

export interface ChunkerSegment {
  text: string
  start: number
  duration: number
  end?: number
  flatWords?: ChunkerFlatWord[]
  words?: ChunkerFlatWord[]
  id?: string
}

export type SubtitleChunk = ChunkerSegment

export interface ChunkLookupOptions {
  syncOffsetMs?: number
  isZeroBased?: boolean
  hookStart?: number
  thumbnailDuration?: number
}

/**
 * Deep Subtitle Layout Engine encapsulating transcript grouping,
 * sequence alignment, duration scaling, and time searches.
 */
export class SubtitleLayoutEngine {
  private _masterTranscript: TranscriptSegment[] = []
  private _mode: string = 'word'
  private _flatWords: ChunkerFlatWord[] = []
  private _chunks: SubtitleChunk[] = []

  constructor(masterTranscript: TranscriptSegment[] = [], mode: string = 'word') {
    this._mode = mode || 'word'
    this.setTranscript(masterTranscript)
  }

  // --- Getters & Setters ---

  public get masterTranscript(): TranscriptSegment[] {
    return this._masterTranscript
  }

  public get mode(): string {
    return this._mode
  }

  public set mode(newMode: string) {
    this._mode = newMode || 'word'
    this._rebuildChunks()
  }

  public get chunks(): SubtitleChunk[] {
    return this._chunks
  }

  public get flatWords(): ChunkerFlatWord[] {
    return this._flatWords
  }

  public setTranscript(segments: TranscriptSegment[]): void {
    this._masterTranscript = segments || []
    this._rebuildChunks()
  }

  // --- Chunk Building & Layout Logic ---

  private _rebuildChunks(): void {
    if (!this._masterTranscript || this._masterTranscript.length === 0) {
      this._flatWords = []
      this._chunks = []
      return
    }

    const flatWords: ChunkerFlatWord[] = []

    this._masterTranscript.forEach(seg => {
      const chunkerSeg = seg as ChunkerSegment
      chunkerSeg.flatWords = []

      const wordObj: ChunkerFlatWord = {
        text: seg.text || '',
        start: seg.start,
        duration: seg.duration,
        end: seg.start + seg.duration,
        originalSegment: chunkerSeg
      }
      flatWords.push(wordObj)
      chunkerSeg.flatWords.push(wordObj)
    })

    this._flatWords = flatWords

    const mode = this._mode || 'word'
    let grouped: SubtitleChunk[] = []

    if (mode === 'word' || mode === '1_word') {
      grouped = flatWords.map(w => ({
        text: w.text,
        start: w.start,
        duration: w.duration,
        end: w.end,
        words: [w]
      }))
    } else if (mode.endsWith('_words')) {
      let numWords = 1
      const match = mode.match(/^(\d+)_(?:word|words)$/)
      if (match && match[1]) {
        numWords = parseInt(match[1], 10) || 1
      }

      for (let i = 0; i < flatWords.length; i += numWords) {
        const chunk = flatWords.slice(i, i + numWords)
        const first = chunk[0]
        const last = chunk[chunk.length - 1]
        if (first && last) {
          grouped.push({
            text: chunk.map(w => w.text).filter(t => t.length > 0).join(' '),
            start: first.start,
            duration: last.end - first.start,
            end: last.end,
            words: chunk
          })
        }
      }
    } else if (mode === 'full') {
      if (flatWords.length > 0) {
        const first = flatWords[0]!
        const last = flatWords[flatWords.length - 1]!
        grouped = [{
          text: flatWords.map(w => w.text).filter(t => t.length > 0).join(' '),
          start: first.start,
          duration: last.end - first.start,
          end: last.end,
          words: [...flatWords]
        }]
      }
    } else {
      grouped = flatWords.map(w => ({
        text: w.text,
        start: w.start,
        duration: w.duration,
        end: w.end,
        words: [w]
      }))
    }

    this._chunks = grouped
  }

  // --- Playback & Time Lookups ---

  public findChunkIndexAt(currentTime: number, options: ChunkLookupOptions = {}): number {
    if (!this._chunks || this._chunks.length === 0) return -1

    const offsetSec = (options.syncOffsetMs || 0) / 1000
    const thumbSec = options.thumbnailDuration || 0
    const relativeTime = Math.max(0, currentTime - thumbSec)

    const firstStart = this._masterTranscript[0]?.start || 0
    const hookStart = options.hookStart || 0
    const isZeroBased = options.isZeroBased ?? (firstStart < hookStart - 2)

    const searchTime = isZeroBased
      ? relativeTime + offsetSec
      : hookStart + relativeTime + offsetSec

    return this._chunks.findIndex(chunk => {
      const end = chunk.end ?? (chunk.start + chunk.duration)
      return searchTime >= chunk.start && searchTime < end
    })
  }

  public getChunkAt(currentTime: number, options: ChunkLookupOptions = {}): SubtitleChunk | null {
    const idx = this.findChunkIndexAt(currentTime, options)
    return idx !== -1 && this._chunks[idx] ? this._chunks[idx] : null
  }

  // --- Word Alignment & Text Edits (Needleman-Wunsch) ---

  public updateChunkText(chunkIndex: number, newText: string): boolean {
    const chunk = this._chunks[chunkIndex]
    if (!chunk) return false

    chunk.text = newText
    if (!chunk.words || !chunk.words.length) return true

    const words = newText.split(/\s+/).filter(w => w.length > 0)
    const flatWordsInSeg = chunk.words

    if (!words.length) {
      flatWordsInSeg.forEach(w => { w.text = '' })
    } else {
      const m = flatWordsInSeg.length
      const n = words.length

      const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(-Infinity))
      const parent: (string | null)[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(null))

      dp[0]![0] = 0

      for (let i = 1; i <= m; i++) {
        dp[i]![0] = i * -0.1
        parent[i]![0] = 'skip_orig'
      }

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const origWord = (flatWordsInSeg[i - 1]!.text || '').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
          const newWord = words[j - 1]!.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')

          let matchScore = -1.0
          if (origWord === newWord) {
            matchScore = 2.0
          } else if (origWord && (origWord.includes(newWord) || newWord.includes(origWord))) {
            matchScore = 0.5
          }
          const scoreMatch = dp[i - 1]![j - 1]! + matchScore
          const scoreSkipOrig = dp[i - 1]![j]! - 0.1

          if (scoreMatch >= scoreSkipOrig) {
            dp[i]![j] = scoreMatch
            parent[i]![j] = 'match'
          } else {
            dp[i]![j] = scoreSkipOrig
            parent[i]![j] = 'skip_orig'
          }
        }
      }

      const assignment: string[] = Array(m).fill('')
      let i = m
      let j = n

      while (i > 0) {
        const action = parent[i]![j]
        if (action === 'match' && j > 0) {
          assignment[i - 1] = words[j - 1]!
          i--
          j--
        } else {
          assignment[i - 1] = ''
          i--
        }
      }

      if (j > 0) {
        const remaining = words.slice(0, j)
        assignment[0] = (remaining.join(' ') + ' ' + (assignment[0] || '')).trim()
      }

      flatWordsInSeg.forEach((w, idx) => {
        w.text = assignment[idx] ?? ''
      })
    }

    // Re-assemble the originalSegment.text for each affected original segment
    const affectedSegments = new Set<ChunkerSegment>()
    flatWordsInSeg.forEach(w => {
      if (w.originalSegment) {
        affectedSegments.add(w.originalSegment)
      }
    })

    affectedSegments.forEach(originalSeg => {
      if (originalSeg.flatWords && originalSeg.flatWords.length) {
        originalSeg.text = originalSeg.flatWords
          .map(w => w.text)
          .filter(t => t.length > 0)
          .join(' ')
      }
    })

    return true
  }

  // --- Timing & Duration Updates ---

  public updateChunkStart(chunkIndex: number, newStart: number): boolean {
    const chunk = this._chunks[chunkIndex]
    if (!chunk) return false

    const delta = newStart - chunk.start
    chunk.start = newStart
    if (chunk.end !== undefined) {
      chunk.end = chunk.end + delta
    }

    if (chunk.words && chunk.words.length) {
      chunk.words.forEach(w => {
        w.start += delta
        w.end += delta
      })
    }

    const affectedSegments = new Set<ChunkerSegment>()
    if (chunk.words) {
      chunk.words.forEach(w => {
        if (w.originalSegment) affectedSegments.add(w.originalSegment)
      })
    }

    affectedSegments.forEach(originalSeg => {
      if (originalSeg.flatWords && originalSeg.flatWords.length) {
        const first = originalSeg.flatWords[0]
        const last = originalSeg.flatWords[originalSeg.flatWords.length - 1]
        if (first && last) {
          originalSeg.start = first.start
          originalSeg.duration = last.end - first.start
        }
      }
    })

    return true
  }

  public updateChunkDuration(chunkIndex: number, newDuration: number): boolean {
    const chunk = this._chunks[chunkIndex]
    if (!chunk || chunk.duration <= 0) return false

    const ratio = newDuration / chunk.duration
    chunk.duration = newDuration
    chunk.end = chunk.start + newDuration

    if (chunk.words && chunk.words.length) {
      let currentStart = chunk.start
      chunk.words.forEach(w => {
        w.duration = w.duration * ratio
        w.start = currentStart
        w.end = currentStart + w.duration
        currentStart = w.end
      })
    }

    const affectedSegments = new Set<ChunkerSegment>()
    if (chunk.words) {
      chunk.words.forEach(w => {
        if (w.originalSegment) affectedSegments.add(w.originalSegment)
      })
    }

    affectedSegments.forEach(originalSeg => {
      if (originalSeg.flatWords && originalSeg.flatWords.length) {
        const first = originalSeg.flatWords[0]
        const last = originalSeg.flatWords[originalSeg.flatWords.length - 1]
        if (first && last) {
          originalSeg.start = first.start
          originalSeg.duration = last.end - first.start
        }
      }
    })

    return true
  }

  // --- Bulk Text Redistribution ---

  public redistributeBulkText(newBulkText: string): void {
    const words = newBulkText.split(/\s+/).filter(w => w.length > 0)
    if (!words.length || !this._masterTranscript.length) return

    const totalDuration = this._masterTranscript.reduce((acc, s) => acc + s.duration, 0)
    if (totalDuration <= 0) return

    let wordIdx = 0
    this._masterTranscript.forEach((seg, i) => {
      if (i === this._masterTranscript.length - 1) {
        seg.text = words.slice(wordIdx).join(' ')
        return
      }

      const quota = Math.max(1, Math.round((seg.duration / totalDuration) * words.length))
      seg.text = words.slice(wordIdx, wordIdx + quota).join(' ')
      wordIdx += quota
    })

    this._rebuildChunks()
  }

  // --- Split / Merge Operations ---

  public splitChunk(chunkIndex: number, splitTime: number): boolean {
    const chunk = this._chunks[chunkIndex]
    if (!chunk || splitTime <= chunk.start || splitTime >= (chunk.start + chunk.duration)) {
      return false
    }

    const words = (chunk.text || '').split(/\s+/).filter(w => w.length > 0)
    if (words.length <= 1) return false

    const mid = Math.floor(words.length / 2)
    const text1 = words.slice(0, mid).join(' ')
    const text2 = words.slice(mid).join(' ')

    const dur1 = splitTime - chunk.start
    const dur2 = (chunk.start + chunk.duration) - splitTime

    const newSeg1: TranscriptSegment = { text: text1, start: chunk.start, duration: dur1 }
    const newSeg2: TranscriptSegment = { text: text2, start: splitTime, duration: dur2 }

    const originalIdx = this._masterTranscript.findIndex(s => s.start === chunk.start)
    if (originalIdx !== -1) {
      this._masterTranscript.splice(originalIdx, 1, newSeg1, newSeg2)
      this._rebuildChunks()
      return true
    }

    return false
  }

  public mergeChunks(firstIndex: number, secondIndex: number): boolean {
    const chunk1 = this._chunks[firstIndex]
    const chunk2 = this._chunks[secondIndex]
    if (!chunk1 || !chunk2) return false

    const mergedText = `${chunk1.text || ''} ${chunk2.text || ''}`.trim()
    const mergedStart = Math.min(chunk1.start, chunk2.start)
    const mergedEnd = Math.max(chunk1.start + chunk1.duration, chunk2.start + chunk2.duration)
    const mergedDur = mergedEnd - mergedStart

    const orig1Idx = this._masterTranscript.findIndex(s => s.start === chunk1.start)
    const orig2Idx = this._masterTranscript.findIndex(s => s.start === chunk2.start)

    if (orig1Idx !== -1 && orig2Idx !== -1) {
      const minIdx = Math.min(orig1Idx, orig2Idx)
      const maxIdx = Math.max(orig1Idx, orig2Idx)

      this._masterTranscript.splice(maxIdx, 1)
      this._masterTranscript.splice(minIdx, 1, {
        text: mergedText,
        start: mergedStart,
        duration: mergedDur
      })
      this._rebuildChunks()
      return true
    }

    return false
  }

  public exportMaster(): TranscriptSegment[] {
    return this._masterTranscript.map(s => ({
      text: s.text,
      start: s.start,
      duration: s.duration,
      ...(s.id ? { id: s.id } : {})
    }))
  }

  public exportChunks(): SubtitleChunk[] {
    return this._chunks.map(c => ({
      text: c.text,
      start: c.start,
      duration: c.duration,
      end: c.end
    }))
  }
}

export function createSubtitleLayoutEngine(
  masterTranscript: TranscriptSegment[] = [],
  mode: string = 'word'
): SubtitleLayoutEngine {
  return new SubtitleLayoutEngine(masterTranscript, mode)
}

// --- Backward-Compatible Procedural Functions ---

export function groupTranscript(segments: ChunkerSegment[], subtitleMode: string): ChunkerSegment[] {
  const engine = new SubtitleLayoutEngine(segments as TranscriptSegment[], subtitleMode)
  return engine.chunks
}

export function updateSegmentText(seg: ChunkerSegment, newText: string): void {
  seg.text = newText
  if (!seg.words || !seg.words.length) return

  const words = newText.split(/\s+/).filter(w => w.length > 0)
  const flatWordsInSeg = seg.words

  if (!words.length) {
    flatWordsInSeg.forEach(w => { w.text = '' })
  } else {
    const m = flatWordsInSeg.length
    const n = words.length

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(-Infinity))
    const parent: (string | null)[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(null))

    dp[0]![0] = 0

    for (let i = 1; i <= m; i++) {
      dp[i]![0] = i * -0.1
      parent[i]![0] = 'skip_orig'
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const origWord = (flatWordsInSeg[i - 1]!.text || '').toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
        const newWord = words[j - 1]!.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')

        let matchScore = -1.0
        if (origWord === newWord) {
          matchScore = 2.0
        } else if (origWord && (origWord.includes(newWord) || newWord.includes(origWord))) {
          matchScore = 0.5
        }
        const scoreMatch = dp[i - 1]![j - 1]! + matchScore
        const scoreSkipOrig = dp[i - 1]![j]! - 0.1

        if (scoreMatch >= scoreSkipOrig) {
          dp[i]![j] = scoreMatch
          parent[i]![j] = 'match'
        } else {
          dp[i]![j] = scoreSkipOrig
          parent[i]![j] = 'skip_orig'
        }
      }
    }

    const assignment: string[] = Array(m).fill('')
    let i = m
    let j = n

    while (i > 0) {
      const action = parent[i]![j]
      if (action === 'match' && j > 0) {
        assignment[i - 1] = words[j - 1]!
        i--
        j--
      } else {
        assignment[i - 1] = ''
        i--
      }
    }

    if (j > 0) {
      const remaining = words.slice(0, j)
      assignment[0] = (remaining.join(' ') + ' ' + (assignment[0] || '')).trim()
    }

    flatWordsInSeg.forEach((w, idx) => {
      w.text = assignment[idx] ?? ''
    })
  }

  const affectedSegments = new Set<ChunkerSegment>()
  flatWordsInSeg.forEach(w => {
    if (w.originalSegment) {
      affectedSegments.add(w.originalSegment)
    }
  })

  affectedSegments.forEach(originalSeg => {
    if (originalSeg.flatWords && originalSeg.flatWords.length) {
      originalSeg.text = originalSeg.flatWords
        .map(w => w.text)
        .filter(t => t.length > 0)
        .join(' ')
    }
  })
}

export function updateSegmentStart(seg: ChunkerSegment, newStart: number): void {
  const delta = newStart - seg.start
  seg.start = newStart
  if (seg.end !== undefined) {
    seg.end = seg.end + delta
  }

  if (seg.words && seg.words.length) {
    seg.words.forEach(w => {
      w.start += delta
      w.end += delta
    })
  }

  const affectedSegments = new Set<ChunkerSegment>()
  if (seg.words) {
    seg.words.forEach(w => {
      if (w.originalSegment) affectedSegments.add(w.originalSegment)
    })
  }

  affectedSegments.forEach(originalSeg => {
    if (originalSeg.flatWords && originalSeg.flatWords.length) {
      const first = originalSeg.flatWords[0]
      const last = originalSeg.flatWords[originalSeg.flatWords.length - 1]
      if (first && last) {
        originalSeg.start = first.start
        originalSeg.duration = last.end - first.start
      }
    }
  })
}

export function updateSegmentDuration(seg: ChunkerSegment, newDuration: number): void {
  if (seg.duration <= 0) return
  const ratio = newDuration / seg.duration
  seg.duration = newDuration
  seg.end = seg.start + newDuration

  if (seg.words && seg.words.length) {
    let currentStart = seg.start
    seg.words.forEach(w => {
      w.duration = w.duration * ratio
      w.start = currentStart
      w.end = currentStart + w.duration
      currentStart = w.end
    })
  }

  const affectedSegments = new Set<ChunkerSegment>()
  if (seg.words) {
    seg.words.forEach(w => {
      if (w.originalSegment) affectedSegments.add(w.originalSegment)
    })
  }

  affectedSegments.forEach(originalSeg => {
    if (originalSeg.flatWords && originalSeg.flatWords.length) {
      const first = originalSeg.flatWords[0]
      const last = originalSeg.flatWords[originalSeg.flatWords.length - 1]
      if (first && last) {
        originalSeg.start = first.start
        originalSeg.duration = last.end - first.start
      }
    }
  })
}

export function redistributeTranscript(masterTranscript: ChunkerSegment[], newBulkText: string): void {
  const words = newBulkText.split(/\s+/).filter(w => w.length > 0)
  if (!words.length || !masterTranscript.length) return

  const totalDuration = masterTranscript.reduce((acc, s) => acc + s.duration, 0)
  if (totalDuration <= 0) return

  let wordIdx = 0
  masterTranscript.forEach((seg, i) => {
    if (i === masterTranscript.length - 1) {
      seg.text = words.slice(wordIdx).join(' ')
      return
    }

    const quota = Math.max(1, Math.round((seg.duration / totalDuration) * words.length))
    seg.text = words.slice(wordIdx, wordIdx + quota).join(' ')
    wordIdx += quota
  })
}
