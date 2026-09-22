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
    isDragging.value = true
    dragStartX.value = e.clientX
    dragTargetHalf.value = determineTargetHalf(e.clientY)

    if (dragTargetHalf.value === 'top') {
      dragStartPercent.value = state.cropPercentXTop.value ?? 50
    } else if (dragTargetHalf.value === 'bottom') {
      dragStartPercent.value = state.cropPercentXBottom.value ?? 50
    } else {
      dragStartPercent.value = state.cropPercentX.value ?? 50
    }
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
    if (touch) {
      isDragging.value = true
      dragStartX.value = touch.clientX
      dragTargetHalf.value = determineTargetHalf(touch.clientY)

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
    if (!isDragging.value || maxOffset.value === 0) return
    const touch = e.touches[0]
    if (touch) {
      const dx = touch.clientX - dragStartX.value

      if (state.cropMode.value === 'face_tracking' && Math.abs(dx) > 5) {
        state.cropMode.value = 'manual'
        notifyOverride()
      }

      if (state.cropMode.value === 'manual') {
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
