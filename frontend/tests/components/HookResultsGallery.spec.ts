// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HookResultsGallery from '../../app/components/home/HookResultsGallery.vue'
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
    },
    {
      start: 50,
      end: 80,
      theme: 'The Secret to Growth',
      transcript_quote: 'Growth comes from consistency and rapid iteration.',
      virality_score: 82,
      virality_reason: 'Solid topic but pacing is moderate.'
    },
    {
      start: 100,
      end: 130,
      theme: 'Behind the Scenes Setup',
      transcript_quote: 'Here is the setup we used in the studio.',
      virality_score: 65,
      virality_reason: 'Informational segment with low virality.'
    }
  ]),
  savedHooks: ref([
    {
      start: 10,
      end: 40,
      theme: 'How AI Automation Works',
      transcript_quote: 'We built an agent that automates the entire workflow seamlessly.',
      virality_score: 95,
      virality_reason: 'High intrigue hook with strong value proposition.'
    }
  ]),
  folderName: ref('test_folder'),
  clipId: ref(''),
  jobStatus: ref('idle'),
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
  }
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('HookResultsGallery Component (Cinematic Hook Cards)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.savedHooks.value = [
      {
        start: 10,
        end: 40,
        theme: 'How AI Automation Works',
        transcript_quote: 'We built an agent that automates the entire workflow seamlessly.',
        virality_score: 95,
        virality_reason: 'High intrigue hook with strong value proposition.'
      }
    ]
  })

  it('renders unified hook score pill in top-left overlay with virality color tiers', () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    })

    // First card: Hook 01 with score 95 (emerald tier)
    const text = wrapper.text()
    expect(text).toContain('HOOK 01')
    expect(text).toContain('95')

    // Check virality score color styling on first card
    const emeraldPills = wrapper.findAll('.text-emerald-400')
    expect(emeraldPills.length).toBeGreaterThan(0)

    // Check second card score 82 (cyan tier)
    expect(text).toContain('HOOK 02')
    expect(text).toContain('82')
    const cyanPills = wrapper.findAll('.text-cyan-400')
    expect(cyanPills.length).toBeGreaterThan(0)

    // Check third card score 65 (slate tier)
    expect(text).toContain('HOOK 03')
    expect(text).toContain('65')
  })

  it('renders ambient ready indicator when hook matches a ready clip', () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: [
          {
            clip_id: '8_40_How_AI_Automation_Works',
            folder_name: 'test_folder',
            theme: 'How AI Automation Works',
            asset_url: '/static/test_folder/clip1.mp4',
            title: 'Clip 1',
            duration: 30
          } as any
        ]
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    })

    expect(wrapper.text()).toContain('Ready')
  })

  it('toggles saved hook on bookmark click and prevents modal opening', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    })

    const bookmarkBtns = wrapper.findAll('button[aria-label="Bookmark Hook"]')
    expect(bookmarkBtns.length).toBeGreaterThan(0)

    // First hook in mockState is in savedHooks, but doesn't have _id so it calls saveHook for non-saved hooks
    // Second hook (idx 1) is not saved
    await bookmarkBtns[1]!.trigger('click')
    expect(mockState.saveHook).toHaveBeenCalledTimes(1)

    // Modal should not open
    const vm = wrapper.vm as any
    expect(vm.selectedModalHook).toBeNull()
  })

  it('renders streamlined card body with theme, quote, timestamp range, and preview CTA', () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    })

    expect(wrapper.text()).toContain('How AI Automation Works')
    expect(wrapper.text()).toContain('We built an agent that automates the entire workflow seamlessly.')
    expect(wrapper.text()).toContain('00:10')
    expect(wrapper.text()).toContain('00:40')
    expect(wrapper.text()).toContain('Preview Segment')
  })

  it('renders saved hooks tab with amber styling and active bookmark state', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: {
            template: '<div><slot /></div>'
          }
        }
      }
    })

    // Click Saved Hooks tab
    const vm = wrapper.vm as any
    vm.activeTab = 'saved'
    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    expect(text).toContain('SAVED 01')
    expect(text).toContain('How AI Automation Works')
  })
})
