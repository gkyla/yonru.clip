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

  it('automatically transitions from face_tracking to manual when dragging beyond threshold', () => {
    const previewScale = ref(1.0)
    const maxOffset = ref(1000)
    const hasActiveTextItems = ref(false)

    const state = useClipperState()
    const { startDrag, onDrag, stopDrag, showOverrideToast } = useCropDrag(
      previewScale,
      maxOffset,
      hasActiveTextItems
    )

    expect(state.cropMode.value).toBe('face_tracking')

    // Start drag at x = 100
    startDrag({ clientX: 100 } as MouseEvent)

    // Minor movement below threshold (4px)
    onDrag({ clientX: 104 } as MouseEvent)
    expect(state.cropMode.value).toBe('face_tracking')

    // Movement exceeding threshold (20px)
    onDrag({ clientX: 120 } as MouseEvent)
    expect(state.cropMode.value).toBe('manual')
    expect(showOverrideToast.value).toBe(true)

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
})

