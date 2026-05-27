/**
 * Subtitle Chunker helper module for grouping and editing timed transcript segments.
 */

export function groupTranscript(flatWords, subtitleMode) {
  const mode = subtitleMode || 'word';
  
  if (mode === 'word' || mode === '1_word') {
    return flatWords.map(w => ({
      text: w.text,
      start: w.start,
      duration: w.duration,
      end: w.end !== undefined ? w.end : (w.start + w.duration),
      words: [w]
    }));
  }
  
  let numWords = 1;
  const match = mode.match(/^(\d+)_(?:word|words)$/);
  if (match && match[1]) {
    numWords = parseInt(match[1]) || 1;
  }
  
  const grouped = [];
  for (let i = 0; i < flatWords.length; i += numWords) {
    const chunk = flatWords.slice(i, i + numWords);
    if (chunk.length > 0) {
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      const start = first.start;
      const end = last.end !== undefined ? last.end : (last.start + last.duration);
      grouped.push({
        text: chunk.map(w => w.text).join(' '),
        start: start,
        duration: end - start,
        end: end,
        words: chunk
      });
    }
  }
  return grouped;
}

export function updateSegmentText(seg, newText) {
  seg.text = newText;
  if (!seg.words || !seg.words.length) return;
  
  const words = newText.split(/\s+/).filter(w => w.length > 0);
  if (!words.length) {
    seg.words.forEach(w => {
      w.text = '';
    });
    return;
  }
  
  let wordIdx = 0;
  seg.words.forEach((w, idx) => {
    if (idx === seg.words.length - 1) {
      w.text = words.slice(wordIdx).join(' ');
      return;
    }
    const quota = Math.max(1, Math.round((w.duration / seg.duration) * words.length));
    w.text = words.slice(wordIdx, wordIdx + quota).join(' ');
    wordIdx += quota;
  });
}

export function updateSegmentStart(seg, newStart) {
  const delta = newStart - seg.start;
  seg.start = newStart;
  seg.end = seg.end + delta;
  
  if (seg.words && seg.words.length) {
    seg.words.forEach(w => {
      w.start += delta;
      if (w.end !== undefined) {
        w.end += delta;
      }
    });
  }
}

export function updateSegmentDuration(seg, newDuration) {
  if (seg.duration <= 0) return;
  const ratio = newDuration / seg.duration;
  seg.duration = newDuration;
  seg.end = seg.start + newDuration;
  
  if (seg.words && seg.words.length) {
    let currentStart = seg.start;
    seg.words.forEach((w) => {
      w.duration = w.duration * ratio;
      w.start = currentStart;
      w.end = currentStart + w.duration;
      currentStart = w.end;
    });
  }
}
