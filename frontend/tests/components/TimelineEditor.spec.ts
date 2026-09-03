// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TimelineEditor from '../../app/components/TimelineEditor.vue'
import { ref } from 'vue'

const mockCurrentTime = ref(0)
const mockIsPlaying = ref(false)
const mockSeekTo = vi.fn((t: number) => {
  mockCurrentTime.value = t
})

const mockState = {
  currentTime: mockCurrentTime,
  isPlaying: mockIsPlaying,
  timelineDuration: ref(60),
  videoDuration: ref(60),
  thumbnailEnabled: ref(false),
  thumbnailDuration: ref(3),
  useNativePlayer: ref(false),
  canUndo: ref(false),
  canRedo: ref(false),
  isSavingHistory: ref(false),
  volume: ref(1),
  videoLayout: ref('portrait'),
  selectedTimelineItem: ref<any>(null),
  contentAudit: ref({ flaggedSegments: [] }),
  timelineTracks: ref([
    {
      id: 'video',
      name: 'Video',
      type: 'video',
      items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 30 }]
    },
    {
      id: 'subtitle',
      name: 'Subtitle',
      type: 'subtitle',
      items: [{ id: 's1', content: 'Hello world', start: 0, duration: 10 }]
    }
  ]),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  },
  seekTo: mockSeekTo,
  addTimelineItem: vi.fn(),
  saveTimelineTracks: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  commitToHistory: vi.fn()
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('TimelineEditor Component', () => {
  beforeEach(() => {
    mockCurrentTime.value = 0
    mockIsPlaying.value = false
    mockSeekTo.mockClear()
    mockState.selectedTimelineItem.value = null
  })

  it('renders timeline tracks and playhead at initial position 0', () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.tl-scroll').exists()).toBe(true)
    expect(mockCurrentTime.value).toBe(0)
  })

  it('does not mutate currentTime when timeline viewport is scrolled manually', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    })

    const scrollEl = wrapper.find('.tl-scroll')
    expect(scrollEl.exists()).toBe(true)

    // Simulate user scrolling viewport to the right (e.g. 500px)
    const element = scrollEl.element as HTMLElement
    Object.defineProperty(element, 'scrollLeft', { value: 500, writable: true })
    Object.defineProperty(element, 'clientWidth', { value: 800, writable: true })

    await scrollEl.trigger('scroll')

    // Current playhead time MUST remain 0 (decoupled viewport)
    expect(mockCurrentTime.value).toBe(0)
  })

  it('seeks to calculated time when user clicks on the ruler', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    })

    const rulerContainer = wrapper.find('.ruler-container')
    expect(rulerContainer.exists()).toBe(true)

    // Mock getBoundingClientRect
    vi.spyOn(rulerContainer.element, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 0,
      width: 2000,
      height: 20,
      right: 2100,
      bottom: 20,
      x: 100,
      y: 0,
      toJSON: () => {}
    })

    // Click at clientX = 500 (offset from left = 400px, at 50px/sec => 8s)
    await wrapper.find('.timeline-ruler').trigger('mousedown', {
      button: 0,
      clientX: 500
    })

    expect(mockSeekTo).toHaveBeenCalled()
    const seekArg = mockSeekTo.mock.calls[0][0]
    expect(seekArg).toBeGreaterThan(0)
    expect(seekArg).toBeLessThanOrEqual(60)
  })

  it('keeps scroll position at the end after playback has finished and reset to 0', async () => {
    vi.useFakeTimers()
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    })

    const scrollEl = wrapper.find('.tl-scroll')
    const element = scrollEl.element as HTMLElement
    Object.defineProperty(element, 'scrollLeft', { value: 0, writable: true })
    Object.defineProperty(element, 'clientWidth', { value: 800, writable: true })

    // 1. Play starts
    mockIsPlaying.value = true
    await wrapper.vm.$nextTick()

    // 2. Playback finishes, time resets to 0, playing becomes false
    mockCurrentTime.value = 60
    await wrapper.vm.$nextTick()
    mockIsPlaying.value = false
    mockCurrentTime.value = 0
    await wrapper.vm.$nextTick()

    // 3. User scrolls to 1200px
    element.scrollLeft = 1200
    await scrollEl.trigger('scroll')

    // 4. Fast forward past isUserScrolling timeout (150ms)
    vi.advanceTimersByTime(300)
    await wrapper.vm.$nextTick()

    // 5. Background time update arrives while paused
    mockCurrentTime.value = 0.001
    await wrapper.vm.$nextTick()

    expect(element.scrollLeft).toBe(1200)
    vi.useRealTimers()
  })
})
