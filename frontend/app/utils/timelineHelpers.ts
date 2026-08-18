import type { TimelineTrack, TimelineTrackItem, TranscriptSegment } from '../types/clipper'

export type TimelineItem = TimelineTrackItem

export interface RulerTick {
  pos: number
  major: boolean
  label: string | null
}

export function calculateTimelineDuration(
  tracks: TimelineTrack[],
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  videoDuration: number
): number {
  let max = 0
  let hasItems = false
  tracks.forEach(track => {
    if (track.items && track.items.length > 0) hasItems = true
    track.items.forEach(item => {
      max = Math.max(max, item.start + item.duration)
    })
  })

  const offset = thumbnailEnabled ? thumbnailDuration : 0

  if (hasItems) {
    return (max > 0 ? max : 1) + offset
  }
  return (videoDuration > 0 ? videoDuration : 60) + offset
}

export function calculateVideoTime(
  currentTime: number,
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  tracks: TimelineTrack[]
): number {
  const thumbSec = thumbnailEnabled ? thumbnailDuration : 0
  const t = Math.max(0, currentTime - thumbSec)
  const videoTrack = tracks.find(tr => tr.id === 'video')
  if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0) return t

  const activeItem =
    videoTrack.items.find(i => t >= i.start && t <= i.start + i.duration) ||
    videoTrack.items[videoTrack.items.length - 1]

  if (activeItem) {
    const mediaStart = activeItem.mediaStart !== undefined ? activeItem.mediaStart : activeItem.start
    return mediaStart + (t - activeItem.start)
  }

  return t
}

export function splitTimelineItem(
  item: TimelineItem,
  cutTime: number,
  newIdGenerator: () => string = () => Math.random().toString(36).substr(2, 9)
): { firstItem: TimelineItem; secondItem: TimelineItem } | null {
  if (cutTime <= item.start || cutTime >= item.start + item.duration) {
    return null
  }

  const splitOffset = cutTime - item.start
  const originalMediaStart = item.mediaStart !== undefined ? item.mediaStart : 0
  const newMediaStart = originalMediaStart + splitOffset
  const dur2 = item.start + item.duration - cutTime

  const firstItem: TimelineItem = {
    ...item,
    duration: cutTime - item.start
  }

  const secondItem: TimelineItem = {
    ...item,
    id: newIdGenerator(),
    start: cutTime,
    duration: dur2,
    mediaStart: newMediaStart
  }

  return { firstItem, secondItem }
}

export function deleteTimelineItemWithRipple(
  tracks: TimelineTrack[],
  transcript: any[],
  itemToDelete: TimelineItem,
  trackId: string,
  currentTime: number,
  thumbnailEnabled: boolean,
  thumbnailDuration: number
): {
  updatedTracks: TimelineTrack[]
  updatedTranscript: any[]
  updatedCurrentTime: number
} {
  // 1. Remove deleted item from tracks
  const updatedTracks: TimelineTrack[] = tracks.map(track => ({
    ...track,
    items: track.items.filter(i => i.id !== itemToDelete.id)
  }))

  let updatedCurrentTime = currentTime
  let updatedTranscript = transcript ? [...transcript] : []

  // ONLY perform ripple edit if we deleted a video segment!
  if (trackId === 'video') {
    // Ripple edit: shift all items starting at or after deleted item to the left
    updatedTracks.forEach(track => {
      track.items.forEach(item => {
        if (item.start >= itemToDelete.start - 0.001) {
          item.start = Math.max(0, item.start - itemToDelete.duration)
        }
      })
    })

    // Update playhead position
    const offset = thumbnailEnabled ? thumbnailDuration : 0
    const relTime = currentTime - offset

    if (relTime > itemToDelete.start + itemToDelete.duration) {
      updatedCurrentTime = Math.max(0, currentTime - itemToDelete.duration)
    } else if (relTime >= itemToDelete.start) {
      updatedCurrentTime = itemToDelete.start + offset
    }

    // Subtitle ripple edit
    if (transcript && transcript.length > 0) {
      const newTranscript: any[] = []
      const delStart = itemToDelete.start
      const delEnd = itemToDelete.start + itemToDelete.duration

      transcript.forEach(s => {
        const segStart = s.start + offset
        const segEnd = s.start + s.duration + offset

        // Case 1: completely before deleted window
        if (segEnd <= delStart + 0.001) {
          newTranscript.push(s)
        }
        // Case 2: completely after deleted window
        else if (segStart >= delEnd - 0.001) {
          newTranscript.push({
            ...s,
            start: Math.max(0, s.start - itemToDelete.duration)
          })
        }
        // Case 3: overlaps with deleted window
        else {
          const rawWords = (s.text || '').trim().split(/\s+/)
          if (!rawWords.length || !(s.text || '').trim()) return
          const wordDur = s.duration / rawWords.length

          const block1Words: string[] = []
          const block2Words: string[] = []
          let block2StartIndex = -1

          rawWords.forEach((w: string, i: number) => {
            const wordStart = segStart + i * wordDur
            const wordEnd = wordStart + wordDur

            if (wordEnd <= delStart + 0.001) {
              block1Words.push(w)
            } else if (wordStart >= delEnd - 0.001) {
              block2Words.push(w)
              if (block2StartIndex === -1) block2StartIndex = i
            }
          })

          if (block1Words.length > 0) {
            newTranscript.push({
              ...s,
              text: block1Words.join(' '),
              duration: block1Words.length * wordDur
            })
          }

          if (block2Words.length > 0) {
            const originalStart = segStart + block2StartIndex * wordDur - offset
            newTranscript.push({
              ...s,
              id: s.id + '_shifted',
              text: block2Words.join(' '),
              start: Math.max(0, originalStart - itemToDelete.duration),
              duration: block2Words.length * wordDur
            })
          }
        }
      })
      updatedTranscript = newTranscript
    }
  }

  return {
    updatedTracks,
    updatedTranscript,
    updatedCurrentTime
  }
}

export function calculateSnapTime(
  val: number,
  snapEnabled: boolean,
  pxPerSec: number,
  currentTime: number,
  tracks: TimelineTrack[],
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  activeDraggingItemId?: string
): number {
  if (!snapEnabled) return val
  const tolerance = 5 / pxPerSec

  const targets: number[] = []

  // 1. Ruler interval snap
  let step = 1
  if (pxPerSec >= 200) step = 0.1
  else if (pxPerSec >= 100) step = 0.25
  else if (pxPerSec >= 50) step = 0.5

  const nearestRuler = Math.round(val / step) * step
  targets.push(nearestRuler)

  // 2. Playhead snap
  const offset = thumbnailEnabled ? thumbnailDuration : 0
  targets.push(currentTime - offset)

  // 3. Clip edge snap
  tracks.forEach(track => {
    track.items.forEach(item => {
      if (activeDraggingItemId && item.id === activeDraggingItemId) return
      targets.push(item.start)
      targets.push(item.start + item.duration)
    })
  })

  // Find closest target within tolerance
  let closest = val
  let minDist = tolerance
  for (const t of targets) {
    const dist = Math.abs(val - t)
    if (dist < minDist) {
      minDist = dist
      closest = t
    }
  }
  return closest
}

export function calculateDragBounds(
  mode: 'move' | 'start' | 'end',
  startVal: number,
  dx: number,
  currentItem: TimelineItem,
  snapFn: (val: number) => number
): { newStart: number; newDuration: number } {
  if (mode === 'start') {
    let newStart = Math.max(0, startVal + dx)
    newStart = snapFn(newStart)
    const diff = currentItem.start - newStart
    if (currentItem.duration + diff > 0.1) {
      return {
        newStart,
        newDuration: currentItem.duration + diff
      }
    }
    return {
      newStart: currentItem.start,
      newDuration: currentItem.duration
    }
  }

  if (mode === 'end') {
    let newDur = Math.max(0.1, startVal + dx)
    const newEnd = currentItem.start + newDur
    const snappedEnd = snapFn(newEnd)
    newDur = Math.max(0.1, snappedEnd - currentItem.start)
    return {
      newStart: currentItem.start,
      newDuration: newDur
    }
  }

  // mode === 'move'
  let newStart = Math.max(0, startVal + dx)
  newStart = snapFn(newStart)
  return {
    newStart,
    newDuration: currentItem.duration
  }
}

export function calculateRulerTicks(totalW: number, pxPerSec: number): RulerTick[] {
  const ticks: RulerTick[] = []
  const dur = totalW / pxPerSec
  let step: number
  let labelEvery: number

  if (pxPerSec >= 200) {
    step = 0.1
    labelEvery = 1
  } else if (pxPerSec >= 100) {
    step = 0.25
    labelEvery = 1
  } else if (pxPerSec >= 50) {
    step = 0.5
    labelEvery = 5
  } else {
    step = 1
    labelEvery = 5
  }

  for (let t = 0; t <= dur; t = Math.round((t + step) * 1000) / 1000) {
    const pos = t * pxPerSec
    const isMajor = Math.abs(t % labelEvery) < 0.001 || Math.abs((t % labelEvery) - labelEvery) < 0.001
    const showLabel = isMajor && t > 0
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    const ms = Math.round((t % 1) * 10)
    const label = showLabel
      ? t >= 60
        ? `${m}:${s.toString().padStart(2, '0')}`
        : t % 1 === 0
          ? `${s}s`
          : `${s}.${ms}s`
      : null
    ticks.push({ pos, major: isMajor, label })
  }
  return ticks
}
