// useClipperThumbnail.ts - Extracted thumbnail composition and overlay editing logic
import { useTimelineState } from './useTimelineState'

export const useClipperThumbnail = () => {
  const API_BASE = 'http://localhost:8000'
  const timeline = useTimelineState()

  // Ingestion & basic states shared via useState keys
  const jobId = useState<string | null>('jobId')
  const videoFps = useState<number>('videoFps', () => 30)
  const currentTime = useState<number>('currentTime', () => 0)
  const folderName = useState<string | null>('folderName')
  const clipId = useState<string | null>('clipId')

  // Thumbnail core states
  const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
  const thumbnailUrl = useState<string | null>('thumbnailUrl', () => null)
  const thumbnailDuration = useState<number>('thumbnailDuration', () => 1.0)
  const thumbnailScreenshotTime = useState<number>('thumbnailScreenshotTime', () => 0)
  const thumbnailTextOverlays = useState<any[]>('thumbnailTextOverlays', () => [])
  const thumbnailEditMode = useState<boolean>('thumbnailEditMode', () => false)
  const thumbnailXOffset = useState<number>('thumbnailXOffset', () => 50)

  // Loading/saving transient states
  const isDeletingThumbnail = ref(false)
  const isCapturingThumbnail = useState<boolean>('isCapturingThumbnail', () => false)

  // Toast notification state
  const toast = useState<any>('clipperToast')
  let toastTimeout: any = null

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    toast.value = { message, type }
    if (toastTimeout) clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      toast.value = null
    }, 3000)
  }

  // --- Watch Handlers for Thumbnail side-effects ---
  let prevDuration = thumbnailDuration.value
  watch(thumbnailDuration, (newVal) => {
    if (thumbnailEnabled.value) {
      const diff = newVal - prevDuration
      currentTime.value = Math.max(0, currentTime.value + diff)
    }
    prevDuration = newVal
  })

  watch([thumbnailEnabled, thumbnailDuration, thumbnailTextOverlays], () => {
    if (!timeline.isSavingLocked.value) {
      saveThumbnailConfig()
    }
  }, { deep: true })

  // --- Operations ---

  function resetThumbnailState() {
    timeline.isSavingLocked.value = true
    thumbnailEnabled.value = false
    thumbnailUrl.value = null
    thumbnailDuration.value = 1.0
    thumbnailScreenshotTime.value = 0
    thumbnailXOffset.value = 50
    thumbnailTextOverlays.value = []
    thumbnailEditMode.value = false
    nextTick(() => {
      timeline.isSavingLocked.value = false
    })
  }

  async function captureScreenshot(timestamp?: number, isAutoCapture = false) {
    if (!jobId.value) return
    isCapturingThumbnail.value = true
    try {
      if (isAutoCapture) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      let requestTimestamp = timestamp ?? null
      if (timestamp !== undefined && timestamp !== null) {
        const fps = videoFps.value || 30
        const frameOffset = 3 / fps
        requestTimestamp = Math.max(0, timestamp - frameOffset)
      }

      const res = await $fetch<{ status: string; timestamp: number; thumbnail_url: string }>(`${API_BASE}/api/thumbnail/screenshot`, {
        method: 'POST',
        body: {
          job_id: jobId.value,
          timestamp: requestTimestamp
        }
      })
      thumbnailUrl.value = `${API_BASE}${res.thumbnail_url}?t=${Date.now()}`
      thumbnailScreenshotTime.value = timestamp ?? res.timestamp
      thumbnailEnabled.value = true
      showToast('Thumbnail captured!', 'success')
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (e: any) {
      showToast('Failed to capture thumbnail', 'error')
    } finally {
      isCapturingThumbnail.value = false
    }
  }

  function addThumbnailText() {
    const first = thumbnailTextOverlays.value[0]
    const style = first ? {
      fontSize: first.fontSize,
      fontFamily: first.fontFamily,
      fontWeight: first.fontWeight,
      color: first.color,
      strokeColor: first.strokeColor,
      strokeWidth: first.strokeWidth,
      showStroke: first.showStroke,
      textTransform: first.textTransform,
      rotation: first.rotation,
      showBackground: first.showBackground,
      backgroundColor: first.backgroundColor,
      backgroundOpacity: first.backgroundOpacity,
      backgroundPadding: first.backgroundPadding
    } : {
      fontSize: 100,
      fontFamily: 'Montserrat',
      fontWeight: 900,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 5,
      showStroke: true,
      textTransform: 'uppercase',
      rotation: 0,
      showBackground: false,
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      backgroundPadding: 20
    }

    let newX = 540
    let newY = 960

    // Ensure new text overlays do not stack or overlap exactly on top of any existing overlay
    while (thumbnailTextOverlays.value.some(o => o.x === newX && o.y === newY)) {
      newX += 40
      newY += 80
    }

    thumbnailTextOverlays.value = [
      ...thumbnailTextOverlays.value,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: 'YOUR TEXT',
        x: newX,
        y: newY,
        ...style
      }
    ]
  }

  function removeThumbnailText(id: string) {
    thumbnailTextOverlays.value = thumbnailTextOverlays.value.filter(t => t.id !== id)
  }

  async function saveThumbnailConfig() {
    if (!folderName.value || !clipId.value) return
    try {
      await $fetch(`${API_BASE}/api/thumbnail/config`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          config: {
            enabled: thumbnailEnabled.value,
            duration: thumbnailDuration.value,
            screenshotTime: thumbnailScreenshotTime.value,
            textOverlays: thumbnailTextOverlays.value,
            xOffset: thumbnailXOffset.value
          }
        }
      })
    } catch (e) {}
  }

  async function loadThumbnailConfig() {
    if (!folderName.value || !clipId.value) return
    try {
      const res = await $fetch<{ config: any }>(`${API_BASE}/api/thumbnail/config/${folderName.value}/${clipId.value}`)
      if (res.config) {
        timeline.isSavingLocked.value = true
        thumbnailEnabled.value = res.config.enabled ?? false
        thumbnailDuration.value = res.config.duration ?? 1.0
        thumbnailScreenshotTime.value = res.config.screenshotTime ?? 0
        thumbnailXOffset.value = res.config.xOffset ?? 50
        thumbnailTextOverlays.value = (res.config.textOverlays ?? []).map((o: any) => ({
          x: 540,
          y: 960,
          fontSize: 100,
          fontFamily: 'Montserrat',
          fontWeight: 900,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 5,
          showStroke: true,
          textTransform: 'uppercase',
          rotation: 0,
          showBackground: false,
          backgroundColor: '#000000',
          backgroundOpacity: 0.7,
          backgroundPadding: 20,
          ...o
        }))
        
        const baseClipUrl = `${API_BASE}/assets/clips/${folderName.value}/${clipId.value}`
        try {
          const thumbUrl = `${baseClipUrl}/thumbnail.jpg?t=${Date.now()}`
          thumbnailUrl.value = thumbUrl
        } catch { }
        
        nextTick(() => {
          timeline.isSavingLocked.value = false
        })
      } else {
        resetThumbnailState()
      }
    } catch (e) {
      resetThumbnailState()
    }
  }

  async function toggleThumbnail() {
    timeline.isTimelineShifting.value = true
    timeline.isSavingLocked.value = true

    if (!thumbnailEnabled.value) {
      const originalTime = currentTime.value
      
      if (!thumbnailUrl.value) {
        isCapturingThumbnail.value = true
        await new Promise(resolve => setTimeout(resolve, 350))
      }

      currentTime.value += thumbnailDuration.value
      thumbnailEnabled.value = true

      if (!thumbnailUrl.value) {
        await captureScreenshot(originalTime, true)
      }
    } else {
      currentTime.value = Math.max(0, currentTime.value - thumbnailDuration.value)
      thumbnailEnabled.value = false
    }

    await saveThumbnailConfig()

    nextTick(() => {
      timeline.isTimelineShifting.value = false
      timeline.isSavingLocked.value = false
    })
  }

  async function deleteThumbnail() {
    if (!folderName.value || !clipId.value) return
    try {
      await $fetch(`${API_BASE}/api/thumbnail/${folderName.value}/${clipId.value}`, {
        method: 'DELETE'
      })
      
      timeline.isTimelineShifting.value = true
      timeline.isSavingLocked.value = true
      isDeletingThumbnail.value = true
      
      if (thumbnailEnabled.value) {
        currentTime.value = Math.max(0, currentTime.value - thumbnailDuration.value)
      }
      
      thumbnailUrl.value = null
      thumbnailEnabled.value = false
      thumbnailScreenshotTime.value = 0
      thumbnailTextOverlays.value = []
      thumbnailDuration.value = 1.0
      
      nextTick(() => {
        timeline.isTimelineShifting.value = false
        timeline.isSavingLocked.value = false
        isDeletingThumbnail.value = false
      })
      
      showToast('Thumbnail deleted!', 'success')
    } catch (e: any) {
      timeline.isTimelineShifting.value = false
      timeline.isSavingLocked.value = false
      isDeletingThumbnail.value = false
      showToast('Failed to delete thumbnail', 'error')
    }
  }

  return {
    thumbnailEnabled,
    thumbnailUrl,
    thumbnailDuration,
    thumbnailScreenshotTime,
    thumbnailTextOverlays,
    thumbnailEditMode,
    thumbnailXOffset,
    isDeletingThumbnail,
    isCapturingThumbnail,
    resetThumbnailState,
    captureScreenshot,
    addThumbnailText,
    removeThumbnailText,
    saveThumbnailConfig,
    loadThumbnailConfig,
    toggleThumbnail,
    deleteThumbnail
  }
}
