/**
 * Timeline Helpers — pure-function sequencing algorithms from useTimelineState composable.
 */

export interface TimelineItem {
  start: number
  duration: number
  mediaStart?: number
  [key: string]: any
}

export interface TimelineTrack {
  id: string
  items: TimelineItem[]
  [key: string]: any
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

  const activeItem = videoTrack.items.find(i => t >= i.start && t <= i.start + i.duration)
    || videoTrack.items[videoTrack.items.length - 1]

  if (activeItem) {
    const mediaStart = activeItem.mediaStart !== undefined ? activeItem.mediaStart : activeItem.start
    return mediaStart + (t - activeItem.start)
  }

  return t
}
