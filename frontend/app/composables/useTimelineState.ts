// useTimelineState.ts - Extracted timeline tracks and duration sequencing logic
export const useTimelineState = () => {
  const API_BASE = 'http://localhost:8000'

  const timelineTracks = useState<any[]>('timelineTracks', () => [
    { id: 'video', name: 'Main Video', type: 'video', items: [] },
    { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
    { id: 'text', name: 'Text layers', type: 'text', items: [] }
  ])
  const defaultTimelineTextStyle = useState<any | null>('defaultTimelineTextStyle', () => null)
  const selectedTimelineItem = useState<any | null>('selectedTimelineItem', () => null)
  const isSavingLocked = useState<boolean>('isSavingLocked', () => false)
  const isTimelineShifting = useState<boolean>('isTimelineShifting', () => false)

  // External states synced globally via useState
  const thumbnailEnabled = useState<boolean>('thumbnailEnabled')
  const thumbnailDuration = useState<number>('thumbnailDuration')
  const videoDuration = useState<number>('videoDuration')
  const currentTime = useState<number>('currentTime')
  const folderName = useState<string | null>('folderName')
  const clipId = useState<string | null>('clipId')

  const timelineDuration = computed(() => {
    let max = 0
    let hasItems = false
    timelineTracks.value.forEach(track => {
      if (track.items.length > 0) hasItems = true
      track.items.forEach((item: any) => {
        max = Math.max(max, item.start + item.duration)
      })
    })
    
    const offset = (thumbnailEnabled.value ? thumbnailDuration.value : 0)
    
    if (hasItems) {
      return (max > 0 ? max : 1) + offset
    }
    return (videoDuration.value > 0 ? videoDuration.value : 60) + offset
  })

  const videoTime = computed(() => {
    const thumbSec = thumbnailEnabled.value ? thumbnailDuration.value : 0
    const t = Math.max(0, currentTime.value - thumbSec)
    const videoTrack = timelineTracks.value.find(tr => tr.id === 'video')
    if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0) return t
    
    const activeItem = videoTrack.items.find((i: any) => t >= i.start && t < i.start + i.duration)
    if (activeItem) {
      const mediaStart = activeItem.mediaStart !== undefined ? activeItem.mediaStart : activeItem.start
      return mediaStart + (t - activeItem.start)
    }
    return t
  })

  async function saveTimelineTracks() {
    if (isSavingLocked.value) {
      console.log('[clipper] saveTimelineTracks BLOCKED (lock active)')
      return
    }
    if (!folderName.value || !clipId.value) return
    
    console.log('[clipper] saveTimelineTracks triggered for:', folderName.value, clipId.value)
    console.log('[clipper] Tracks state:', JSON.stringify(timelineTracks.value).substring(0, 200) + '...')

    try {
      await $fetch(`${API_BASE}/api/timeline`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          timeline_tracks: timelineTracks.value
        }
      })
      console.log('[clipper] Saved timeline tracks successfully')
    } catch (e) {
      console.error('[clipper] Failed to save timeline tracks:', e)
    }
  }

  function getGlobalStyleSnapshot() {
    const font = useState<string>('font')
    const subtitleFontWeight = useState<string | number>('subtitleFontWeight')
    const subtitleTextTransform = useState<string>('subtitleTextTransform')
    const subtitleTextColor = useState<string>('subtitleTextColor')
    const subtitleStrokeColor = useState<string>('subtitleStrokeColor')
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth')
    const subtitleBackground = useState<string>('subtitleBackground')
    const subtitleBackgroundOpacity = useState<number>('subtitleBackgroundOpacity')
    const subtitleWordSpacing = useState<number>('subtitleWordSpacing')

    return {
      font: font.value || 'Outfit',
      fontSize: 80,
      fontWeight: subtitleFontWeight.value ? String(subtitleFontWeight.value) : '900',
      textTransform: subtitleTextTransform.value || 'uppercase',
      align: 'center',
      color: subtitleTextColor.value || '#FFFFFF',
      opacity: 1,
      strokeColor: subtitleStrokeColor.value || '#000000',
      strokeWidth: subtitleStrokeWidth.value ?? 5,
      showStroke: (subtitleStrokeWidth.value ?? 0) > 0,
      showBackground: (subtitleBackground.value || 'none') !== 'none',
      backgroundColor: '#000000',
      backgroundOpacity: subtitleBackgroundOpacity.value ?? 0.7,
      letterSpacing: 0,
      wordSpacing: subtitleWordSpacing.value ?? 0,
      lineHeight: 1.1,
      shadowBlur: 10,
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowOffsetX: 5,
      shadowOffsetY: 5,
    }
  }

  function addTimelineItem(trackId: string, item: any) {
    const track = timelineTracks.value.find(t => t.id === trackId)
    if (track) {
      const startSec = item.start ?? currentTime.value
      const maxRemaining = Math.max(0.5, timelineDuration.value - startSec)
      const defaultDuration = item.duration ?? 5
      const durationSec = Math.min(defaultDuration, maxRemaining)

      let styleOverrides: any = {}
      if (trackId === 'text') {
        if (defaultTimelineTextStyle.value) {
          styleOverrides = { ...defaultTimelineTextStyle.value, linkToGlobal: true }
        } else {
          styleOverrides = getGlobalStyleSnapshot()
          styleOverrides.linkToGlobal = true
        }
      }

      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        start: startSec,
        mediaStart: item.mediaStart ?? 0,
        duration: durationSec,
        content: '',
        ...styleOverrides,
        ...item
      }
      track.items.push(newItem)
      selectedTimelineItem.value = newItem
    }
  }

  function deleteTimelineItem(trackId: string, itemId: string) {
    const track = timelineTracks.value.find(t => t.id === trackId)
    if (track) {
      track.items = track.items.filter((i: any) => i.id !== itemId)
      if (selectedTimelineItem.value?.id === itemId) {
        selectedTimelineItem.value = null
      }
    }
  }

  function updateTimelineItem(trackId: string, itemId: string, updates: any) {
    const track = timelineTracks.value.find(t => t.id === trackId)
    if (track) {
      const item = track.items.find((i: any) => i.id === itemId)
      if (item) {
        Object.assign(item, updates)
      }
    }
  }

  function syncGlobalStylesToItem(item: any) {
    const snap = getGlobalStyleSnapshot()
    Object.assign(item, snap)
    item.linkToGlobal = true
  }

  function saveTimelineTextStyleAsDefault(item: any) {
    const font = useState<string>('font')
    const toast = useState<any>('clipperToast')
    
    const style = {
      font: item.font || font.value || 'Montserrat',
      fontSize: item.fontSize || 80,
      fontWeight: item.fontWeight || '900',
      textTransform: item.textTransform || 'none',
      align: item.align || 'center',
      color: item.color || '#FFFFFF',
      opacity: item.opacity ?? 1,
      strokeColor: item.strokeColor || '#000000',
      strokeWidth: item.strokeWidth ?? 5,
      showStroke: item.showStroke ?? false,
      showBackground: item.showBackground ?? false,
      backgroundColor: item.backgroundColor || '#000000',
      backgroundOpacity: item.backgroundOpacity ?? 0.7,
      letterSpacing: item.letterSpacing ?? 0,
      wordSpacing: item.wordSpacing ?? 0,
      lineHeight: item.lineHeight ?? 1.1,
      shadowBlur: item.shadowBlur ?? 10,
      shadowColor: item.shadowColor || '#000000',
      shadowOpacity: item.shadowOpacity ?? 0.5,
      shadowOffsetX: item.shadowOffsetX ?? 5,
      shadowOffsetY: item.shadowOffsetY ?? 5,
    }
    defaultTimelineTextStyle.value = style
    if (import.meta.client) {
      localStorage.setItem('defaultTimelineTextStyle', JSON.stringify(style))
    }
    toast.value = { message: 'Saved current style as manual text default!', type: 'success' }
  }

  return {
    timelineTracks,
    defaultTimelineTextStyle,
    selectedTimelineItem,
    isSavingLocked,
    isTimelineShifting,
    timelineDuration,
    videoTime,
    saveTimelineTracks,
    addTimelineItem,
    deleteTimelineItem,
    updateTimelineItem,
    syncGlobalStylesToItem,
    saveTimelineTextStyleAsDefault
  }
}

