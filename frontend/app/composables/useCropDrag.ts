// useCropDrag.ts - Encapsulates crop dragging and bounds calculation logic
import { ref } from 'vue'
import { useClipperState } from './useClipperState'
import { calculateCropPercent } from '../utils/cropHelpers'

export const useCropDrag = (
  previewScale: { value: number },
  maxOffset: { value: number },
  hasActiveTextItems: { value: boolean }
) => {
  const state = useClipperState()
  const isDragging = ref(false)
  const dragStartX = ref(0)
  const dragStartPercent = ref(50)
  const showOverrideToast = ref(false)
  let toastTimer: any = null

  function notifyOverride() {
    showOverrideToast.value = true
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      showOverrideToast.value = false
    }, 2500)
  }

  function startDrag(e: MouseEvent) {
    if (state.videoLayout?.value === 'landscape') return
    // Don't start pan drag if a timeline text overlay is selected
    if (state.selectedTimelineItem.value?.type === 'text' && hasActiveTextItems.value) return
    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartPercent.value = state.cropPercentX.value
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging.value || maxOffset.value === 0) return
    const dx = e.clientX - dragStartX.value

    // Auto-Reframe Override: If in face tracking mode and dragged beyond 5px, switch to manual pan
    if (state.cropMode.value === 'face_tracking' && Math.abs(dx) > 5) {
      state.cropMode.value = 'manual'
      notifyOverride()
    }

    if (state.cropMode.value === 'manual') {
      state.cropPercentX.value = calculateCropPercent(
        dx,
        dragStartPercent.value,
        previewScale.value,
        maxOffset.value
      )
    }
  }

  function stopDrag() {
    isDragging.value = false
  }

  function startDragTouch(e: TouchEvent) {
    if (state.videoLayout?.value === 'landscape') return
    if (state.selectedTimelineItem.value?.type === 'text' && hasActiveTextItems.value) return
    const touch = e.touches[0]
    if (touch) {
      isDragging.value = true
      dragStartX.value = touch.clientX
      dragStartPercent.value = state.cropPercentX.value
    }
  }

  function onDragTouch(e: TouchEvent) {
    if (!isDragging.value || maxOffset.value === 0) return
    const touch = e.touches[0]
    if (touch) {
      const dx = touch.clientX - dragStartX.value

      if (state.cropMode.value === 'face_tracking' && Math.abs(dx) > 5) {
        state.cropMode.value = 'manual'
        notifyOverride()
      }

      if (state.cropMode.value === 'manual') {
        state.cropPercentX.value = calculateCropPercent(
          dx,
          dragStartPercent.value,
          previewScale.value,
          maxOffset.value
        )
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
