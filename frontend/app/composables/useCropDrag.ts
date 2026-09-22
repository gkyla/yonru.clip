// useCropDrag.ts - Encapsulates crop dragging and bounds calculation logic
import { ref } from 'vue'
import { useClipperState } from './useClipperState'
import { calculateCropPercent } from '../utils/cropHelpers'

export const useCropDrag = (
  previewScale: { value: number },
  maxOffset: { value: number },
  hasActiveTextItems: { value: boolean },
  container?: { value: HTMLElement | null }
) => {
  const state = useClipperState()
  const isDragging = ref(false)
  const dragStartX = ref(0)
  const dragStartPercent = ref(50)
  const dragStartY = ref(0)
  const dragStartOffsetX = ref(0)
  const dragStartOffsetY = ref(0)
  const dragTargetHalf = ref<'single' | 'top' | 'bottom'>('single')
  const showOverrideToast = ref(false)
  let toastTimer: any = null

  function notifyOverride() {
    showOverrideToast.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      showOverrideToast.value = false
    }, 2500)
  }

  function getActiveMode(): 'single' | 'split' {
    if (!state.cropMap.value || state.cropMap.value.length === 0) return 'single'
    const t = state.currentTime.value
    let active = state.cropMap.value[0]
    for (const entry of state.cropMap.value) {
      if (entry.time <= t) active = entry
      else break
    }
    return active?.mode === 'split' ? 'split' : 'single'
  }

  function canDragInFaceTracking(half: 'single' | 'top' | 'bottom'): boolean {
    if (getActiveMode() !== 'split') return false
    if (half === 'top') return (state.splitZoomTop?.value ?? 1.0) > 1.0
    if (half === 'bottom') return (state.splitZoomBottom?.value ?? 1.0) > 1.0
    return false
  }

  function determineTargetHalf(clientY: number): 'single' | 'top' | 'bottom' {
    if (getActiveMode() !== 'split' || !container?.value) return 'single'
    const rect = container.value.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    return clientY < midY ? 'top' : 'bottom'
  }

  function startDrag(e: MouseEvent) {
    if (state.videoLayout?.value === 'landscape') return
    // Don't start pan drag if a timeline text overlay is selected
    if (state.selectedTimelineItem.value?.type === 'text' && hasActiveTextItems.value) return

    const targetHalf = determineTargetHalf(e.clientY)
    if (state.cropMode.value === 'face_tracking') {
      if (!canDragInFaceTracking(targetHalf)) return
    }

    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartY.value = e.clientY
    dragTargetHalf.value = targetHalf

    if (state.cropMode.value === 'face_tracking') {
      if (dragTargetHalf.value === 'top') {
        dragStartOffsetX.value = state.splitOffsetXTop?.value ?? 0
        dragStartOffsetY.value = state.splitOffsetYTop?.value ?? 0
      } else if (dragTargetHalf.value === 'bottom') {
        dragStartOffsetX.value = state.splitOffsetXBottom?.value ?? 0
        dragStartOffsetY.value = state.splitOffsetYBottom?.value ?? 0
      }
    } else {
      if (dragTargetHalf.value === 'top') {
        dragStartPercent.value = state.cropPercentXTop.value ?? 50
      } else if (dragTargetHalf.value === 'bottom') {
        dragStartPercent.value = state.cropPercentXBottom.value ?? 50
      } else {
        dragStartPercent.value = state.cropPercentX.value ?? 50
      }
    }
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging.value) return
    const dx = e.clientX - dragStartX.value
    const dy = e.clientY - dragStartY.value

    if (state.cropMode.value === 'face_tracking') {
      const SENSITIVITY = 0.35
      const newOffsetX = Math.max(-50, Math.min(50, Math.round(dragStartOffsetX.value + dx * SENSITIVITY)))
      const newOffsetY = Math.max(-50, Math.min(50, Math.round(dragStartOffsetY.value + dy * SENSITIVITY)))

      if (dragTargetHalf.value === 'top') {
        state.splitOffsetXTop.value = newOffsetX
        state.splitOffsetYTop.value = newOffsetY
      } else if (dragTargetHalf.value === 'bottom') {
        state.splitOffsetXBottom.value = newOffsetX
        state.splitOffsetYBottom.value = newOffsetY
      }
    } else if (state.cropMode.value === 'manual' && maxOffset.value !== 0) {
      const newPercent = calculateCropPercent(
        dx,
        dragStartPercent.value,
        previewScale.value,
        maxOffset.value
      )
      if (dragTargetHalf.value === 'top') {
        state.cropPercentXTop.value = newPercent
      } else if (dragTargetHalf.value === 'bottom') {
        state.cropPercentXBottom.value = newPercent
      } else {
        state.cropPercentX.value = newPercent
      }
    }
  }

  function stopDrag() {
    isDragging.value = false
  }

  function startDragTouch(e: TouchEvent) {
    if (state.videoLayout?.value === 'landscape') return
    if (state.selectedTimelineItem.value?.type === 'text' && hasActiveTextItems.value) return

    const touch = e.touches[0]
    if (!touch) return

    const targetHalf = determineTargetHalf(touch.clientY)
    if (state.cropMode.value === 'face_tracking') {
      if (!canDragInFaceTracking(targetHalf)) return
    }

    isDragging.value = true
    dragStartX.value = touch.clientX
    dragStartY.value = touch.clientY
    dragTargetHalf.value = targetHalf

    if (state.cropMode.value === 'face_tracking') {
      if (dragTargetHalf.value === 'top') {
        dragStartOffsetX.value = state.splitOffsetXTop?.value ?? 0
        dragStartOffsetY.value = state.splitOffsetYTop?.value ?? 0
      } else if (dragTargetHalf.value === 'bottom') {
        dragStartOffsetX.value = state.splitOffsetXBottom?.value ?? 0
        dragStartOffsetY.value = state.splitOffsetYBottom?.value ?? 0
      }
    } else {
      if (dragTargetHalf.value === 'top') {
        dragStartPercent.value = state.cropPercentXTop.value ?? 50
      } else if (dragTargetHalf.value === 'bottom') {
        dragStartPercent.value = state.cropPercentXBottom.value ?? 50
      } else {
        dragStartPercent.value = state.cropPercentX.value ?? 50
      }
    }
  }

  function onDragTouch(e: TouchEvent) {
    if (!isDragging.value) return
    const touch = e.touches[0]
    if (!touch) return

    const dx = touch.clientX - dragStartX.value
    const dy = touch.clientY - dragStartY.value

    if (state.cropMode.value === 'face_tracking') {
      const SENSITIVITY = 0.35
      const newOffsetX = Math.max(-50, Math.min(50, Math.round(dragStartOffsetX.value + dx * SENSITIVITY)))
      const newOffsetY = Math.max(-50, Math.min(50, Math.round(dragStartOffsetY.value + dy * SENSITIVITY)))

      if (dragTargetHalf.value === 'top') {
        state.splitOffsetXTop.value = newOffsetX
        state.splitOffsetYTop.value = newOffsetY
      } else if (dragTargetHalf.value === 'bottom') {
        state.splitOffsetXBottom.value = newOffsetX
        state.splitOffsetYBottom.value = newOffsetY
      }
    } else if (state.cropMode.value === 'manual' && maxOffset.value !== 0) {
      const newPercent = calculateCropPercent(
        dx,
        dragStartPercent.value,
        previewScale.value,
        maxOffset.value
      )
      if (dragTargetHalf.value === 'top') {
        state.cropPercentXTop.value = newPercent
      } else if (dragTargetHalf.value === 'bottom') {
        state.cropPercentXBottom.value = newPercent
      } else {
        state.cropPercentX.value = newPercent
      }
    }
  }


  return {
    isDragging,
    showOverrideToast,
    startDrag,
    onDrag,
    stopDrag,
    startDragTouch,
    onDragTouch
  }
}
