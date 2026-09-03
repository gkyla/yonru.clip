// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HookResultsGallery from '../../app/components/home/HookResultsGallery.vue'
import PipelineProgressStepper from '../../app/components/home/PipelineProgressStepper.vue'
import TimelineEditor from '../../app/components/TimelineEditor.vue'
import { ref } from 'vue'

const mockState = {
  hooks: ref([
    {
      start: 10,
      end: 40,
      theme: 'How AI Automation Works',
      transcript_quote: 'We built an agent that automates the entire workflow seamlessly.',
      virality_score: 95,
      virality_reason: 'High intrigue hook with strong value proposition.'
    }
  ]),
  savedHooks: ref([
    {
      start: 10,
      end: 40,
      theme: 'Saved AI Automation Hook',
      transcript_quote: 'We built an agent that automates the entire workflow seamlessly.',
      virality_score: 95,
      virality_reason: 'High intrigue hook with strong value proposition.'
    }
  ]),
  folderName: ref('test_folder'),
  clipId: ref(''),
  jobId: ref('job-1234'),
  jobStatus: ref('transcribing'),
  whisperModel: ref('base'),
  selectedPrompt: ref('viral'),
  isCachedAnalysis: ref(false),
  activeHook: ref(null),
  hdReady: ref(false),
  downloadPercent: ref(0),
  videoUrl: ref('http://localhost:8000/static/test_folder/full.mp4'),
  hasPreview: ref(true),
  videoDuration: ref(300),
  startSafetyBuffer: ref(2),
  saveHook: vi.fn(),
  deleteSavedHook: vi.fn(),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  },
  timelineTracks: ref([
    {
      id: 'video',
      name: 'Main Video',
      type: 'video',
      items: [
        { id: 'item-1', name: 'Intro', start: 0, duration: 15, content: 'Welcome to Yonru' }
      ]
    }
  ]),
  selectedTimelineItem: ref(null),
  renderStatus: ref('idle'),
  isPlaying: ref(false),
  currentTime: ref(0),
  totalDuration: ref(60),
  timelineDuration: ref(60),
  videoLayout: ref('vertical'),
  contentAudit: ref({ flaggedSegments: [] }),
  volume: ref(1),
  canUndo: ref(false),
  canRedo: ref(false),
  undo: vi.fn(),
  redo: vi.fn(),
  commitToHistory: vi.fn(),
  isSavingHistory: ref(false),
  thumbnailEnabled: ref(false),
  thumbnailDuration: ref(3),
  useNativePlayer: ref(true),
  font: ref('Outfit'),
  fontSize: ref(24),
  subtitleFontWeight: ref(700),
  subtitleWordSpacing: ref(0),
  subtitleHighlightMode: ref('none'),
  subtitleHighlightColor: ref('#CFFF50'),
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState,
  FONT_OPTIONS: ['Outfit', 'Montserrat', 'Inter', 'Roboto']
}))

const globalStubs = {
  Icon: { template: '<span class="icon-stub" :data-name="$attrs.name"></span>' },
  NuxtIcon: { template: '<span class="nuxt-icon-stub"></span>' },
  Transition: { template: '<div><slot /></div>' },
  ClientOnly: { template: '<div><slot /></div>' }
}

describe('Text Selection and Smart Selection Guard Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.selectedTimelineItem.value = null
  })

  describe('HookResultsGallery Text Selection & Smart Selection Guard', () => {
    it('applies cursor-text and select-text styling to hook title and transcript quote', () => {
      const wrapper = mount(HookResultsGallery, {
        props: {
          previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
          readyClips: []
        },
        global: {
          stubs: globalStubs
        }
      })

      const title = wrapper.find('h4')
      expect(title.exists()).toBe(true)
      expect(title.classes()).toContain('cursor-text')
      expect(title.classes()).toContain('select-text')

      const quote = wrapper.find('p.italic')
      expect(quote.exists()).toBe(true)
      expect(quote.classes()).toContain('cursor-text')
      expect(quote.classes()).toContain('select-text')
    })

    it('opens modal when clicking card with NO text selected', async () => {
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => ''
      } as any)

      const wrapper = mount(HookResultsGallery, {
        props: {
          previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
          readyClips: []
        },
        global: {
          stubs: globalStubs
        }
      })

      const card = wrapper.find('.cursor-pointer.group')
      expect(card.exists()).toBe(true)

      await card.trigger('click')
      expect((wrapper.vm as any).selectedModalHook).not.toBeNull()
      expect((wrapper.vm as any).selectedModalHook.theme).toBe('How AI Automation Works')
    })

    it('guards card click: does NOT open modal when text is actively selected', async () => {
      // Simulate user selecting text across the quote or theme
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => 'How AI Automation Works'
      } as any)

      const wrapper = mount(HookResultsGallery, {
        props: {
          previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
          readyClips: []
        },
        global: {
          stubs: globalStubs
        }
      })

      const card = wrapper.find('.cursor-pointer.group')
      expect(card.exists()).toBe(true)

      await card.trigger('click')
      // Smart Selection Guard should prevent modal from opening
      expect((wrapper.vm as any).selectedModalHook).toBeNull()
    })
  })

  describe('PipelineProgressStepper Selection Compatibility', () => {
    it('does not apply select-none to the stages grid container', () => {
      const wrapper = mount(PipelineProgressStepper, {
        props: {
          stages: [
            { id: 'download', name: 'Download', description: 'Fetching video', icon: 'download', state: 'active' }
          ],
          progressPercent: 50,
          loadingLabel: 'Downloading...'
        },
        global: {
          stubs: globalStubs
        }
      })

      const grid = wrapper.find('.grid.gap-4.w-full')
      expect(grid.exists()).toBe(true)
      expect(grid.classes()).not.toContain('select-none')
    })
  })

  describe('TimelineEditor Selection Scoping', () => {
    it('allows text selection in root editor container and properties panel while keeping timeline track body select-none', async () => {
      mockState.selectedTimelineItem.value = {
        id: 'item-1',
        content: 'Sample Subtitle Text',
        start: 0,
        duration: 5,
        type: 'text'
      }

      const wrapper = mount(TimelineEditor, {
        global: {
          stubs: {
            ...globalStubs,
            Transition: false
          }
        }
      })

      // 1. Root container does NOT have select-none
      const root = wrapper.element
      expect(root.classList.contains('select-none')).toBe(false)

      // 2. Timeline track body has select-none to prevent gesture glitches
      const timelineBody = wrapper.find('.flex-1.flex.overflow-hidden.relative.select-none')
      expect(timelineBody.exists()).toBe(true)

      // 3. Properties panel (when item selected and teleported to body) does NOT have select-none
      const propertiesPanel = document.body.querySelector('.fixed.top-\\[72px\\]')
      expect(propertiesPanel).not.toBeNull()
      const scrollableBody = propertiesPanel?.querySelector('.flex-1.overflow-y-auto')
      expect(scrollableBody).not.toBeNull()
      expect(scrollableBody?.classList.contains('select-none')).toBe(false)
    })
  })
})
