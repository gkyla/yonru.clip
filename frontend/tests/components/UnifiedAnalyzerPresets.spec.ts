// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IndexPage from '../../app/pages/index.vue'
import { ref } from 'vue'

const mockState = {
  youtubeUrl: ref('https://youtube.com/watch?v=dQw4w9WgXcQ'),
  selectedPrompt: ref('prompt.json'),
  promptsList: ref([
    { id: 'prompt.json', name: 'Default Viral Short', suitableFor: ['Podcast', 'Talkshow'] },
    { id: 'custom.json', name: 'Custom Clip Archetype', suitableFor: ['Vlog'] }
  ]),
  extractionMode: ref('preset'),
  selectedPresetId: ref('auto'),
  focusTopic: ref(''),
  minDuration: ref(30),
  maxDuration: ref(180),
  whisperModel: ref('base'),
  language: ref('auto'),
  whisperModels: [
    { id: 'base', name: 'Base', speed: 'Very Fast', acc: 'Good', desc: 'Default choice.' }
  ],
  jobError: ref(null),
  hooks: ref([
    {
      theme: 'High Retention Moment',
      start: 10,
      end: 45,
      transcript_quote: 'This is the most viral part of the conversation.',
      virality_score: 95,
      virality_reason: 'High energy hook with unexpected twist that maximizes watch time.'
    },
    {
      theme: 'Funny Punchline',
      start: 50,
      end: 80,
      transcript_quote: 'Everyone laughed at this joke.',
      virality_score: 82,
      virality_reason: 'Relatable humor with strong comedic timing.'
    },
    {
      theme: 'Standard Discussion',
      start: 90,
      end: 120,
      transcript_quote: 'Standard topic elaboration.',
      virality_score: 68,
      virality_reason: 'Solid context builder with moderate engagement.'
    }
  ]),
  jobId: ref('job-456'),
  jobStatus: ref('hooks_ready'),
  clipId: ref(''),
  savedHooks: ref([]),
  activeHook: ref(null),
  lastAccessedVideoId: ref(null),
  lastAccessedClip: ref(null),
  videoUrl: ref(null),
  outputUrl: ref(null),
  startSafetyBuffer: ref(2.0),
  videoDuration: ref(300),
  folderName: ref('test-folder'),
  isMediaLoading: ref(false),
  isNavigatingToEditor: ref(false),
  isCachedAnalysis: ref(false),
  cachedVideos: ref([]),
  isCachedLoading: ref(false),
  isCachedMoreLoading: ref(false),
  cachedVideosFetchError: ref(false),
  cachedVideosTotal: ref(0),
  cachedVideosPage: ref(1),
  cachedVideosLimit: ref(6),
  cachedVideosSearch: ref(''),
  cachedVideosSortBy: ref('date'),
  downloadPercent: ref(100),
  hdReady: ref(true),
  hasPreview: ref(false),
  cachedVideosSortOrder: ref('desc'),
  cachedVideosHasMore: ref(false),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  },
  fetchCached: vi.fn().mockResolvedValue({}),
  fetchPrompts: vi.fn().mockResolvedValue({}),
  fetchSavedHooks: vi.fn().mockResolvedValue({}),
  showToast: vi.fn(),
  checkSystemHealth: vi.fn().mockResolvedValue({}),
  systemHealth: ref({}),
  checkingHealth: ref(false),
  isAnyPrerequisiteMissing: ref(false),
  settingsScrollTarget: ref(''),
  saveTranscript: vi.fn().mockResolvedValue({}),
  saveStyleSettings: vi.fn().mockResolvedValue({}),
  saveDefaultStyleSettings: vi.fn().mockResolvedValue({}),
  updateHooks: vi.fn().mockResolvedValue({}),
  initPersistence: vi.fn(),
  resetWorkspace: vi.fn(),
  analyzeUrl: vi.fn().mockResolvedValue({}),
  extractClip: vi.fn().mockResolvedValue({}),
  loadReadyClipIntoEditor: vi.fn().mockResolvedValue({}),
  renderClip: vi.fn().mockResolvedValue({}),
  startPolling: vi.fn(),
  stopPolling: vi.fn()
}

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('Unified Analyzer Panel - Modular Presets & Virality Score', () => {
  beforeEach(() => {
    mockState.extractionMode.value = 'preset'
    mockState.selectedPresetId.value = 'auto'
    mockState.focusTopic.value = ''
    mockState.minDuration.value = 30
    mockState.maxDuration.value = 180
  })

  it('renders all 5 smart intent preset pills with default auto selected', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: { template: '<span class="icon-stub" :data-icon="$attrs.name"></span>' },
          NuxtLink: { template: '<a><slot /></a>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    })

    const text = wrapper.text()
    expect(text).toContain('Auto Viral')
    expect(text).toContain('Funny & Relatable')
    expect(text).toContain('Edukasi & Debunk')
    expect(text).toContain('Story & Deep Talk')
    expect(text).toContain('Hot Takes')
  })

  it('switches active preset when user clicks a preset pill', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: { template: '<span class="icon-stub" :data-icon="$attrs.name"></span>' },
          NuxtLink: { template: '<a><slot /></a>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    })

    const humorBtn = wrapper.findAll('button').find(b => b.text().includes('Funny & Relatable'))
    expect(humorBtn).toBeDefined()
    await humorBtn!.trigger('click')

    expect(mockState.extractionMode.value).toBe('preset')
    expect(mockState.selectedPresetId.value).toBe('humor')
  })

  it('renders virality score badges with correct color tiers and scores', async () => {
    const wrapper = mount(IndexPage, {
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: { template: '<span class="icon-stub" :data-icon="$attrs.name"></span>' },
          NuxtLink: { template: '<a><slot /></a>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    })

    mockState.jobStatus.value = 'hooks_ready'
    mockState.hooks.value = [
      {
        theme: 'High Retention Moment',
        start: 10,
        end: 45,
        transcript_quote: 'This is the most viral part of the conversation.',
        virality_score: 95,
        virality_reason: 'High energy hook with unexpected twist that maximizes watch time.'
      },
      {
        theme: 'Funny Punchline',
        start: 50,
        end: 80,
        transcript_quote: 'Everyone laughed at this joke.',
        virality_score: 82,
        virality_reason: 'Relatable humor with strong comedic timing.'
      },
      {
        theme: 'Standard Discussion',
        start: 90,
        end: 120,
        transcript_quote: 'Standard topic elaboration.',
        virality_score: 68,
        virality_reason: 'Solid context builder with moderate engagement.'
      }
    ]

    await wrapper.vm.$nextTick()

    const text = wrapper.text()
    expect(text).toContain('95')
    expect(text).toContain('82')
    expect(text).toContain('68')
    expect(text).toContain('High energy hook with unexpected twist')
    expect(text).toContain('Relatable humor with strong comedic timing')
  })
})
