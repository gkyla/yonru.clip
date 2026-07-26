// useClipperThumbnail.ts - Extracted thumbnail composition and overlay editing logic
import { useTimelineState } from './useTimelineState'
import { resolveThumbnailTextStyle, calculateNextOverlayPosition, mapThumbnailOverlays } from '../utils/thumbnailHelpers'
import type { ThumbnailTextOverlay, ThumbnailConfig, DefaultThumbnailStyle } from '../types/clipper'

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
  const thumbnailTextOverlays = useState<ThumbnailTextOverlay[]>('thumbnailTextOverlays', () => [])
  const thumbnailEditMode = useState<boolean>('thumbnailEditMode', () => false)
  const thumbnailXOffset = useState<number>('thumbnailXOffset', () => 50)
  const defaultThumbnailStyle = useState<DefaultThumbnailStyle | null>('defaultThumbnailStyle', () => null)

  // Loading/saving transient states
  const isDeletingThumbnail = ref(false)
  const isCapturingThumbnail = useState<boolean>('isCapturingThumbnail', () => false)

  // Toast notification state
  const toast = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>('clipperToast')
  let toastTimeout: ReturnType<typeof setTimeout> | null = null

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
    if (!jobId.value) {
      isCapturingThumbnail.value = false
      return
    }
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
    const style = resolveThumbnailTextStyle(
      thumbnailTextOverlays.value[0],
      defaultThumbnailStyle.value
    )

    const { x: newX, y: newY } = calculateNextOverlayPosition(thumbnailTextOverlays.value)

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
      if (!defaultThumbnailStyle.value) {
        await loadDefaultThumbnailStyle()
      }
      const res = await $fetch<{ config: ThumbnailConfig }>(`${API_BASE}/api/thumbnail/config/${folderName.value}/${clipId.value}`)
      if (res.config) {
        timeline.isSavingLocked.value = true
        thumbnailEnabled.value = res.config.enabled ?? false
        thumbnailDuration.value = res.config.duration ?? 1.0
        thumbnailScreenshotTime.value = res.config.screenshotTime ?? 0
        thumbnailXOffset.value = res.config.xOffset ?? 50
        thumbnailTextOverlays.value = mapThumbnailOverlays(res.config.textOverlays)
        
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
        if (!jobId.value) {
          timeline.isTimelineShifting.value = false
          timeline.isSavingLocked.value = false
          return
        }
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

  async function loadDefaultThumbnailStyle() {
    try {
      const res = await $fetch<{ style: DefaultThumbnailStyle }>(`${API_BASE}/api/default-thumbnail-style`)
      if (res.style) {
        defaultThumbnailStyle.value = res.style
      } else {
        defaultThumbnailStyle.value = null
      }
    } catch (e) {
      defaultThumbnailStyle.value = null
    }
  }

  async function saveDefaultThumbnailStyle() {
    const first = thumbnailTextOverlays.value[0]
    if (!first) {
      showToast('Add at least one text overlay to save its style as default!', 'error')
      return
    }

    const style = {
      thumbnailDuration: thumbnailDuration.value,
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
    }

    try {
      await $fetch(`${API_BASE}/api/default-thumbnail-style`, {
        method: 'PUT',
        body: { style }
      })
      defaultThumbnailStyle.value = style
      showToast('Thumbnail style saved as default!', 'success')
    } catch (e) {
      showToast('Failed to save default thumbnail style', 'error')
    }
  }

  function applyDefaultThumbnailStyle() {
    const style = defaultThumbnailStyle.value
    if (!style) {
      showToast('No saved default thumbnail style found!', 'error')
      return
    }

    timeline.isSavingLocked.value = true
    
    if (style.thumbnailDuration !== undefined) {
      thumbnailDuration.value = style.thumbnailDuration
    }

    thumbnailTextOverlays.value = thumbnailTextOverlays.value.map(o => ({
      ...o,
      fontSize: style.fontSize ?? o.fontSize,
      fontFamily: style.fontFamily ?? o.fontFamily,
      fontWeight: style.fontWeight ?? o.fontWeight,
      color: style.color ?? o.color,
      strokeColor: style.strokeColor ?? o.strokeColor,
      strokeWidth: style.strokeWidth ?? o.strokeWidth,
      showStroke: style.showStroke ?? o.showStroke,
      textTransform: style.textTransform ?? o.textTransform,
      rotation: style.rotation ?? o.rotation,
      showBackground: style.showBackground ?? o.showBackground,
      backgroundColor: style.backgroundColor ?? o.backgroundColor,
      backgroundOpacity: style.backgroundOpacity ?? o.backgroundOpacity,
      backgroundPadding: style.backgroundPadding ?? o.backgroundPadding
    }))

    showToast('Applied default thumbnail style to overlays!', 'success')

    nextTick(() => {
      timeline.isSavingLocked.value = false
      saveThumbnailConfig()
    })
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
    defaultThumbnailStyle,
    resetThumbnailState,
    captureScreenshot,
    addThumbnailText,
    removeThumbnailText,
    saveThumbnailConfig,
    loadThumbnailConfig,
    toggleThumbnail,
    deleteThumbnail,
    loadDefaultThumbnailStyle,
    saveDefaultThumbnailStyle,
    applyDefaultThumbnailStyle
  }
}
