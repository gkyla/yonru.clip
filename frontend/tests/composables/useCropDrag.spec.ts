// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useCropDrag } from '../../app/composables/useCropDrag'
import { useClipperState } from '../../app/composables/useClipperState'

describe('useCropDrag Composable - Canvas Auto-Reframe Override', () => {
  beforeEach(() => {
    const state = useClipperState()
    state.videoLayout.value = 'vertical'
    state.cropMode.value = 'face_tracking'
    state.cropPercentX.value = 50
    state.selectedTimelineItem.value = null
  })

  it('locks canvas drag when in face_tracking mode to prevent accidental overrides', () => {
    const previewScale = ref(1.0)
    const maxOffset = ref(1000)
    const hasActiveTextItems = ref(false)

    const state = useClipperState()
    const { startDrag, onDrag, stopDrag, isDragging } = useCropDrag(
      previewScale,
      maxOffset,
      hasActiveTextItems
    )

    expect(state.cropMode.value).toBe('face_tracking')

    // Attempt drag while in face_tracking
    startDrag({ clientX: 100 } as MouseEvent)
    expect(isDragging.value).toBe(false)

    // Movement does not change mode or start drag
    onDrag({ clientX: 120 } as MouseEvent)
    expect(state.cropMode.value).toBe('face_tracking')
    expect(isDragging.value).toBe(false)

    stopDrag()
  })

  it('updates cropPercentX continuously when in manual mode', () => {
    const previewScale = ref(1.0)
    const maxOffset = ref(1000)
    const hasActiveTextItems = ref(false)

    const state = useClipperState()
    state.cropMode.value = 'manual'
    state.cropPercentX.value = 50

    const { startDrag, onDrag, stopDrag } = useCropDrag(
      previewScale,
      maxOffset,
      hasActiveTextItems
    )

    startDrag({ clientX: 100 } as MouseEvent)
    onDrag({ clientX: 150 } as MouseEvent)

    expect(state.cropPercentX.value).not.toBe(50)
    stopDrag()
  })

  it('does not allow crop dragging when videoLayout is landscape', () => {
    const previewScale = ref(1.0)
    const maxOffset = ref(1000)
    const hasActiveTextItems = ref(false)

    const state = useClipperState()
    state.videoLayout.value = 'landscape'

    const { startDrag, onDrag, isDragging } = useCropDrag(
      previewScale,
      maxOffset,
      hasActiveTextItems
    )

    startDrag({ clientX: 100 } as MouseEvent)
    expect(isDragging.value).toBe(false)
  })

  it('drags top and bottom viewports independently in split mode', () => {
    const previewScale = ref(1.0)
    const maxOffset = ref(1000)
    const hasActiveTextItems = ref(false)

    // Mock container with height 1000 (midpoint at 500)
    const mockContainer = ref<HTMLElement>({
      getBoundingClientRect: () => ({
        top: 0,
        height: 1000,
        left: 0,
        width: 500,
        bottom: 1000,
        right: 500
      })
    } as any)

    const state = useClipperState()
    state.cropMap.value = [
      { time: 0, x: 500, mode: 'split', top_x: 300, bottom_x: 700 }
    ]
    state.currentTime.value = 0
    state.cropMode.value = 'manual'
    state.cropPercentXTop.value = 50
    state.cropPercentXBottom.value = 50

    const { startDrag, onDrag, stopDrag } = useCropDrag(
      previewScale,
      maxOffset,
      hasActiveTextItems,
      mockContainer
    )

    // Drag upper half (clientY = 200 < 500) -> affects cropPercentXTop
    startDrag({ clientX: 100, clientY: 200 } as MouseEvent)
    onDrag({ clientX: 150, clientY: 200 } as MouseEvent)
    expect(state.cropPercentXTop.value).not.toBe(50)
    expect(state.cropPercentXBottom.value).toBe(50)
    stopDrag()

    // Drag lower half (clientY = 700 >= 500) -> affects cropPercentXBottom
    const prevTop = state.cropPercentXTop.value
    startDrag({ clientX: 100, clientY: 700 } as MouseEvent)
    onDrag({ clientX: 160, clientY: 700 } as MouseEvent)
    expect(state.cropPercentXBottom.value).not.toBe(50)
    expect(state.cropPercentXTop.value).toBe(prevTop)
    stopDrag()
  })

  it('allows 2D canvas dragging in face_tracking mode when zoom > 1.0x and clamps offsets within [-50, +50]', () => {
    const previewScale = ref(1.0)
    const maxOffset = ref(1000)
    const hasActiveTextItems = ref(false)

    const mockContainer = ref<HTMLElement>({
      getBoundingClientRect: () => ({
        top: 0,
        height: 1000,
        left: 0,
        width: 500,
        bottom: 1000,
        right: 500
      })
    } as any)

    const state = useClipperState()
    state.cropMode.value = 'face_tracking'
    state.cropMap.value = [
      { time: 0, x: 500, mode: 'split', top_x: 300, bottom_x: 700 }
    ]
    state.currentTime.value = 0
    state.splitZoomTop.value = 1.4
    state.splitOffsetXTop.value = 0
    state.splitOffsetYTop.value = 0

    const { startDrag, onDrag, stopDrag, isDragging } = useCropDrag(
      previewScale,
      maxOffset,
      hasActiveTextItems,
      mockContainer
    )

    // Drag top half (clientY = 200 < 500)
    startDrag({ clientX: 100, clientY: 200 } as MouseEvent)
    expect(isDragging.value).toBe(true)

    // Drag right by 50px, down by 30px
    onDrag({ clientX: 150, clientY: 230 } as MouseEvent)
    // dx = 50 -> splitOffsetXTop > 0
    // dy = 30 -> splitOffsetYTop > 0
    expect(state.splitOffsetXTop.value).toBeGreaterThan(0)
    expect(state.splitOffsetYTop.value).toBeGreaterThan(0)

    // Extreme drag to test boundary clamping to +50%
    onDrag({ clientX: 5000, clientY: 5000 } as MouseEvent)
    expect(state.splitOffsetXTop.value).toBe(50)
    expect(state.splitOffsetYTop.value).toBe(50)

    // Extreme negative drag to test boundary clamping to -50%
    onDrag({ clientX: -5000, clientY: -5000 } as MouseEvent)
    expect(state.splitOffsetXTop.value).toBe(-50)
    expect(state.splitOffsetYTop.value).toBe(-50)

    stopDrag()
  })
})

