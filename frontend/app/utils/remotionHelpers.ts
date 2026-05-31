export interface RemotionTranscriptSegment {
  text: string
  start: number
  duration: number
}

export interface RemotionWord {
  word: string;
  start: number;
  end: number;
}

export function parseSubtitleWords(
  transcript: RemotionTranscriptSegment[] | null | undefined,
  syncOffsetMs: number,
  subtitleMode: string
): { wordsData: RemotionWord[]; allWordTimings: RemotionWord[] } {
  const wordsData: RemotionWord[] = []
  const allWordTimings: RemotionWord[] = []

  const syncOffsetSec = syncOffsetMs / 1000

  const flatWords: { text: string; start: number; duration: number; end: number }[] = []
  if (transcript) {
    transcript.forEach(s => {
      const segText = (s.text || '').trim()
      if (!segText) return

      const relativeStart = s.start + syncOffsetSec
      const segmentDuration = s.duration
      if (segmentDuration <= 0) return

      const rawWords = segText.split(/\s+/)
      const wordDur = segmentDuration / Math.max(1, rawWords.length)

      rawWords.forEach((w: string, idx: number) => {
        const wStart = relativeStart + (idx * wordDur)
        const wEnd = relativeStart + ((idx + 1) * wordDur)

        flatWords.push({
          text: w,
          start: wStart,
          duration: wordDur,
          end: wEnd
        })

        allWordTimings.push({
          word: w,
          start: wStart,
          end: wEnd
        })
      })
    })
  }

  if (flatWords.length > 0) {
    const mode = subtitleMode || 'word'

    if (mode === 'word' || mode === '1_word') {
      flatWords.forEach(w => {
        wordsData.push({
          word: w.text,
          start: w.start,
          end: w.end
        })
      })
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
            wordsData.push({
              word: text,
              start,
              end
            })
          }
        }
      }
    } else {
      flatWords.forEach(w => {
        wordsData.push({
          word: w.text,
          start: w.start,
          end: w.end
        })
      })
    }
  }

  return { wordsData, allWordTimings }
}
