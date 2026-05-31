/**
 * Subtitle Chunker helper module for grouping and editing timed transcript segments.
 * Hides all complex timing interpolation and original segment back-synchronization
 * behind a stable public interface to improve codebase modularity and locality of state mutations.
 */

export interface ChunkerFlatWord {
  text: string
  start: number
  duration: number
  end: number
  originalSegment: ChunkerSegment
}

export interface ChunkerSegment {
  text: string
  start: number
  duration: number
  end?: number
  flatWords?: ChunkerFlatWord[]
  words?: ChunkerFlatWord[]
}

export function groupTranscript(segments: ChunkerSegment[], subtitleMode: string): ChunkerSegment[] {
  const mode = subtitleMode || 'word'
  
  // 1. Map segments 1-to-1 to stable flat words (Option A). Do not split by whitespace to prevent timeline shifts.
  const flatWords: ChunkerFlatWord[] = []
  segments.forEach(seg => {
    // Clear any previous flatWords tracker and set up a fresh one
    seg.flatWords = []
    
    const wordObj: ChunkerFlatWord = {
      text: seg.text || '',
      start: seg.start,
      duration: seg.duration,
      end: seg.start + seg.duration,
      originalSegment: seg
    }
    flatWords.push(wordObj)
    seg.flatWords.push(wordObj)
  })

  if (flatWords.length === 0) return []

  // 2. Group flatWords based on subtitleMode
  let groupedSegments: ChunkerSegment[] = []

  if (mode === 'word' || mode === '1_word') {
    groupedSegments = flatWords.map(w => ({
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
      numWords = parseInt(match[1]) || 1
    }
    
    for (let i = 0; i < flatWords.length; i += numWords) {
      const chunk = flatWords.slice(i, i + numWords)
      if (chunk.length > 0) {
        const first = chunk[0]
        const last = chunk[chunk.length - 1]
        groupedSegments.push({
          text: chunk.map(w => w.text).filter(t => t.length > 0).join(' '),
          start: first.start,
          duration: last.end - first.start,
          end: last.end,
          words: chunk
        })
      }
    }
  } else {
    groupedSegments = flatWords.map(w => ({
      text: w.text,
      start: w.start,
      duration: w.duration,
      end: w.end,
      words: [w]
    }))
  }

  return groupedSegments
}

export function updateSegmentText(seg: ChunkerSegment, newText: string): void {
  seg.text = newText
  if (!seg.words || !seg.words.length) return
  
  const words = newText.split(/\s+/).filter(w => w.length > 0)
  const flatWordsInSeg = seg.words
  
  if (!words.length) {
    flatWordsInSeg.forEach(w => w.text = '')
  } else {
    // Implement Needleman-Wunsch alignment to align new words onto original slot timings (Option A)
    const m = flatWordsInSeg.length
    const n = words.length
    
    // dp[i][j] stores maximum alignment score
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(-Infinity))
    const parent: (string | null)[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(null))
    
    dp[0][0] = 0
    
    // Initialize first column: matching original slots to empty strings
    for (let i = 1; i <= m; i++) {
      dp[i][0] = i * -0.1
      parent[i][0] = 'skip_orig'
    }
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const origWord = (flatWordsInSeg[i-1].text || '').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        const newWord = words[j-1].toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        
        // Option 1: Match original slot i-1 with new word j-1
        let matchScore = -1.0 // mismatch penalty
        if (origWord === newWord) {
          matchScore = 2.0
        } else if (origWord && (origWord.includes(newWord) || newWord.includes(origWord))) {
          matchScore = 0.5
        }
        const scoreMatch = dp[i-1][j-1] + matchScore
        
        // Option 2: Skip original slot i-1
        const scoreSkipOrig = dp[i-1][j] - 0.1
        
        if (scoreMatch >= scoreSkipOrig) {
          dp[i][j] = scoreMatch
          parent[i][j] = 'match'
        } else {
          dp[i][j] = scoreSkipOrig
          parent[i][j] = 'skip_orig'
        }
      }
    }
    
    // Backtrack to find optimal assignments
    const assignment: string[] = Array(m).fill("")
    let i = m
    let j = n
    
    while (i > 0) {
      const action = parent[i][j]
      if (action === 'match' && j > 0) {
        assignment[i-1] = words[j-1]
        i--
        j--
      } else { // 'skip_orig' or j === 0
        assignment[i-1] = ""
        i--
      }
    }
    
    // If there are leftover words at the beginning, group them into the first slot
    if (j > 0) {
      const remaining = words.slice(0, j)
      assignment[0] = (remaining.join(" ") + " " + assignment[0]).trim()
    }
    
    // Apply assignments to underlying flat words
    flatWordsInSeg.forEach((w, idx) => {
      w.text = assignment[idx]
    })
  }

  // 2. Re-assemble the originalSegment.text for each affected original segment
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

  // Update original segments
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
      originalSeg.start = first.start
      originalSeg.duration = last.end - first.start
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
    seg.words.forEach((w) => {
      w.duration = w.duration * ratio
      w.start = currentStart
      w.end = currentStart + w.duration
      currentStart = w.end
    })
  }

  // Update original segments
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
      originalSeg.start = first.start
      originalSeg.duration = last.end - first.start
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
