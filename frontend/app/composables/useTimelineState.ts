// useTimelineState.ts - Extracted timeline tracks and duration sequencing logic
import { nextTick } from 'vue'
import { calculateTimelineDuration, calculateVideoTime } from '../utils/timelineHelpers'
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
  const fullTranscript = useState<any[]>('fullTranscript', () => [])

  // History state for undo/redo
  const timelineUndoStack = useState<any[]>('timelineUndoStack', () => [])
  const timelineRedoStack = useState<any[]>('timelineRedoStack', () => [])
  const isSavingHistory = useState<boolean>('isSavingHistory', () => false)
  const hasUnsavedHistory = useState<boolean>('hasUnsavedHistory', () => false)
  const isHydratingHistory = useState<boolean>('isHydratingHistory', () => false)

  // Isolate history to specific hook/clip — save before clearing (option A)
  watch([folderName, clipId], async (_newVal, oldVal) => {
    const [oldFolder, oldClip] = oldVal || [null, null]
    // Save current stacks to backend for the old clip before clearing
    if (oldFolder && oldClip && (timelineUndoStack.value.length > 0 || timelineRedoStack.value.length > 0)) {
      try {
        await $fetch(`${API_BASE}/api/timeline-history`, {
          method: 'PUT',
          body: {
            folder_name: oldFolder,
            clip_id: oldClip,
            undo_stack: timelineUndoStack.value,
            redo_stack: timelineRedoStack.value
          }
        })
      } catch (e) {
        console.error('[timeline] Failed to save history before clip switch:', e)
      }
    }
    isHydratingHistory.value = true
    timelineUndoStack.value = []
    timelineRedoStack.value = []
    hasUnsavedHistory.value = false
    nextTick(() => {
      isHydratingHistory.value = false
    })
  })

  const canUndo = computed(() => timelineUndoStack.value.length > 0)
  const canRedo = computed(() => timelineRedoStack.value.length > 0)

  function safeCloneTranscript(transcript: any[]) {
    if (!transcript) return []
    return transcript.map((seg: any) => {
      const copy = { ...seg }
      delete copy.flatWords
      if (seg.words) {
        copy.words = JSON.parse(JSON.stringify(seg.words))
      }
      return copy
    })
  }

  function commitToHistory() {
    const snapshot = {
      tracks: JSON.parse(JSON.stringify(timelineTracks.value)),
      transcript: safeCloneTranscript(fullTranscript.value),
      selectedId: selectedTimelineItem.value?.id || null
    }

    const lastState = timelineUndoStack.value[timelineUndoStack.value.length - 1]
    // Only push if there is a real change to avoid duplicate commits
    if (!lastState || JSON.stringify(lastState.tracks) !== JSON.stringify(snapshot.tracks) || JSON.stringify(lastState.transcript) !== JSON.stringify(snapshot.transcript)) {
      timelineUndoStack.value.push(snapshot)
      if (timelineUndoStack.value.length > 50) {
        timelineUndoStack.value.shift()
      }
      timelineRedoStack.value = [] // Clear redo stack on new action
    }
  }

  function undo() {
    if (timelineUndoStack.value.length === 0) return

    const currentState = {
      tracks: JSON.parse(JSON.stringify(timelineTracks.value)),
      transcript: safeCloneTranscript(fullTranscript.value),
      selectedId: selectedTimelineItem.value?.id || null
    }
    timelineRedoStack.value.push(currentState)

    const previousState = timelineUndoStack.value.pop()
    if (previousState) {
      timelineTracks.value = previousState.tracks
      fullTranscript.value = previousState.transcript
      if (previousState.selectedId) {
        const item = previousState.tracks
          .flatMap((t: any) => t.items)
          .find((i: any) => i.id === previousState.selectedId)
        selectedTimelineItem.value = item || null
      } else {
        selectedTimelineItem.value = null
      }
    }
  }

  function redo() {
    if (timelineRedoStack.value.length === 0) return

    const currentState = {
      tracks: JSON.parse(JSON.stringify(timelineTracks.value)),
      transcript: safeCloneTranscript(fullTranscript.value),
      selectedId: selectedTimelineItem.value?.id || null
    }
    timelineUndoStack.value.push(currentState)

    const nextState = timelineRedoStack.value.pop()
    if (nextState) {
      timelineTracks.value = nextState.tracks
      fullTranscript.value = nextState.transcript
      if (nextState.selectedId) {
        const item = nextState.tracks
          .flatMap((t: any) => t.items)
          .find((i: any) => i.id === nextState.selectedId)
        selectedTimelineItem.value = item || null
      } else {
        selectedTimelineItem.value = null
      }
    }
  }

  async function saveHistoryToBackend() {
    if (!folderName.value || !clipId.value) return
    isSavingHistory.value = true
    try {
      await $fetch(`${API_BASE}/api/timeline-history`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          undo_stack: timelineUndoStack.value,
          redo_stack: timelineRedoStack.value
        }
      })
      hasUnsavedHistory.value = false
      console.log('[timeline] Saved history to backend')
    } catch (e) {
      console.error('[timeline] Failed to save history:', e)
    } finally {
      isSavingHistory.value = false
    }
  }

  function loadHistoryFromResponse(historyData: any) {
    if (historyData && typeof historyData === 'object') {
      isHydratingHistory.value = true
      timelineUndoStack.value = historyData.undo_stack || []
      timelineRedoStack.value = historyData.redo_stack || []
      hasUnsavedHistory.value = false
      nextTick(() => {
        isHydratingHistory.value = false
      })
      console.log(`[timeline] Hydrated history: ${timelineUndoStack.value.length} undo, ${timelineRedoStack.value.length} redo`)
    }
  }

  const timelineDuration = computed(() => {
    return calculateTimelineDuration(
      timelineTracks.value,
      thumbnailEnabled.value,
      thumbnailDuration.value,
      videoDuration.value
    )
  })

  const videoTime = computed(() => {
    return calculateVideoTime(
      currentTime.value,
      thumbnailEnabled.value,
      thumbnailDuration.value,
      timelineTracks.value
    )
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
    saveTimelineTextStyleAsDefault,
    // History controls
    canUndo,
    canRedo,
    commitToHistory,
    undo,
    redo,
    isSavingHistory,
    hasUnsavedHistory,
    saveHistoryToBackend,
    loadHistoryFromResponse,
    timelineUndoStack,
    timelineRedoStack,
    isHydratingHistory
  }
}

