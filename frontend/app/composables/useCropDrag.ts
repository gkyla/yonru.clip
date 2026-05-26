// useCropDrag.ts - Encapsulates crop dragging and bounds calculation logic
import { ref } from 'vue'
import { useClipperState } from './useClipperState'

export const useCropDrag = (
  previewScale: { value: number },
  maxOffset: { value: number },
  hasActiveTextItems: { value: boolean }
) => {
  const state = useClipperState()
  const isDragging = ref(false)
  const dragStartX = ref(0)
  const dragStartPercent = ref(50)

  function startDrag(e: MouseEvent) {
    if (state.cropMode.value !== 'manual') return
    // Don't start pan drag if a timeline text overlay is selected
    if (state.selectedTimelineItem.value?.type === 'text' && hasActiveTextItems.value) return
    isDragging.value = true
    dragStartX.value = e.clientX
    dragStartPercent.value = state.cropPercentX.value
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging.value || maxOffset.value === 0) return
    const dx = e.clientX - dragStartX.value
    
    // dx is in screen pixels. Map to 1080 scale using current previewScale.
    const scaledDx = dx / previewScale.value
    
    // Transform is `-(pct * maxOffset)`. 
    // If moving mouse left (negative dx), we want to view more of the RIGHT side. Percent should increase.
    const percentDelta = (scaledDx / maxOffset.value) * -100
    state.cropPercentX.value = Math.max(0, Math.min(100, dragStartPercent.value + percentDelta))
  }

  function stopDrag() {
    isDragging.value = false
  }

  function startDragTouch(e: TouchEvent) {
    if (state.cropMode.value !== 'manual') return
    if (state.selectedTimelineItem.value?.type === 'text' && hasActiveTextItems.value) return
    isDragging.value = true
    dragStartX.value = e.touches[0].clientX
    dragStartPercent.value = state.cropPercentX.value
  }

  function onDragTouch(e: TouchEvent) {
    if (!isDragging.value || maxOffset.value === 0) return
    const dx = e.touches[0].clientX - dragStartX.value
    const scaledDx = dx / previewScale.value
    const percentDelta = (scaledDx / maxOffset.value) * -100
    state.cropPercentX.value = Math.max(0, Math.min(100, dragStartPercent.value + percentDelta))
  }

  return {
    isDragging,
    startDrag,
    onDrag,
    stopDrag,
    startDragTouch,
    onDragTouch
  }
}
