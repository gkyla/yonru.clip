// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import PipelineProgressStepper from '../../app/components/home/PipelineProgressStepper.vue'

const mockJobStatus = ref('transcribing')
const mockJobId = ref('job-xyz-123')
const mockVideoTitle = ref('')
const mockVideoDuration = ref(0)
const mockVideoFps = ref(30)
const mockFolderName = ref<string | null>(null)
const mockYoutubeUrl = ref('')
const mockVideoUrl = ref<string | null>(null)
const mockHasHeatmap = ref(false)
const mockWhisperModel = ref('base')
const mockSelectedPrompt = ref('prompt.json')
const mockSelectedPresetId = ref('educational')
const mockExtractionMode = ref('preset')
const mockPromptsList = ref<any[]>([])
const mockCachedVideos = ref<any[]>([])
const mockIsCachedAnalysis = ref(false)

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    jobStatus: mockJobStatus,
    jobId: mockJobId,
    videoTitle: mockVideoTitle,
    videoDuration: mockVideoDuration,
    videoFps: mockVideoFps,
    folderName: mockFolderName,
    youtubeUrl: mockYoutubeUrl,
    videoUrl: mockVideoUrl,
    hasHeatmap: mockHasHeatmap,
    whisperModel: mockWhisperModel,
    selectedPrompt: mockSelectedPrompt,
    selectedPresetId: mockSelectedPresetId,
    extractionMode: mockExtractionMode,
    promptsList: mockPromptsList,
    cachedVideos: mockCachedVideos,
    isCachedAnalysis: mockIsCachedAnalysis
  })
}))

const defaultStages = [
  { id: '1', name: 'Ingestion', description: 'Checking url', icon: 'ri:link', state: 'completed' },
  { id: '2', name: 'AI Analysis', description: 'Generating hooks', icon: 'ri:magic-line', state: 'active' }
]

const globalStubs = {
  Icon: { template: '<span class="icon-stub" :data-name="$attrs.name"></span>' },
  NuxtIcon: { template: '<span class="nuxt-icon-stub"></span>' },
  Transition: { template: '<div><slot /></div>' },
  ClientOnly: { template: '<div><slot /></div>' }
}

describe('PipelineProgressStepper Component', () => {
  beforeEach(() => {
    mockJobStatus.value = 'transcribing'
    mockJobId.value = 'job-xyz-123'
    mockVideoTitle.value = ''
    mockVideoDuration.value = 0
    mockVideoFps.value = 30
    mockFolderName.value = null
    mockYoutubeUrl.value = ''
    mockVideoUrl.value = null
    mockHasHeatmap.value = false
    mockWhisperModel.value = 'base'
    mockSelectedPrompt.value = 'prompt.json'
    mockSelectedPresetId.value = 'educational'
    mockExtractionMode.value = 'preset'
    mockPromptsList.value = []
    mockCachedVideos.value = []
    mockIsCachedAnalysis.value = false
  })

  it('renders clean shimmer skeleton when video metadata is not yet resolved', () => {
    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 40,
        loadingLabel: 'TRANSCRIBING AUDIO...'
      },
      global: {
        stubs: globalStubs
      }
    })

    const skeleton = wrapper.find('.animate-pulse')
    expect(skeleton.exists()).toBe(true)
    expect(wrapper.text()).not.toContain('PIPELINE STAGE')
    expect(wrapper.text()).not.toContain('SYSTEM METADATA')
    expect(wrapper.text()).not.toContain('Active Task:')
  })

  it('renders rich source video metadata when videoTitle and duration are available', () => {
    mockVideoTitle.value = 'How to Master Machine Learning'
    mockVideoDuration.value = 754 // 12:34
    mockVideoFps.value = 60
    mockHasHeatmap.value = true
    mockYoutubeUrl.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    mockWhisperModel.value = 'base'
    mockSelectedPrompt.value = 'prompt.json'
    mockSelectedPresetId.value = 'educational'
    mockCachedVideos.value = [
      {
        video_id: 'dQw4w9WgXcQ',
        title: 'How to Master Machine Learning',
        duration: 754,
        fps: 60,
        channel: 'Tech Academy',
        thumbnail_url: '/assets/sources/sample/thumb.jpg',
        added_at: 1725710000000,
        has_heatmap: true
      }
    ]

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 75,
        loadingLabel: 'TRANSCRIBING AUDIO...'
      },
      global: {
        stubs: globalStubs
      }
    })

    // Left Column: Video details
    expect(wrapper.text()).toContain('How to Master Machine Learning')
    expect(wrapper.text()).toContain('Tech Academy')
    expect(wrapper.text()).toContain('12:34')
    expect(wrapper.text()).toContain('Added:')

    // Right Column: Whisper model and prompt template
    expect(wrapper.text()).toContain('Whisper Model')
    expect(wrapper.text()).toContain('BASE')
    expect(wrapper.text()).toContain('Prompt Template')
    expect(wrapper.text()).toContain('Edukasi & Debunk')

    // External link to YouTube
    const externalLink = wrapper.find('a[href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"]')
    expect(externalLink.exists()).toBe(true)
    expect(externalLink.attributes('target')).toBe('_blank')

    // Confirms removal of 30 fps, AI Intent, and robotic technical headers/labels
    expect(wrapper.text()).not.toContain('FPS')
    expect(wrapper.text()).not.toContain('AI Intent')
    expect(wrapper.text()).not.toContain('PIPELINE STAGE')
    expect(wrapper.text()).not.toContain('SYSTEM METADATA')
    expect(wrapper.text()).not.toContain('Active Task:')
    expect(wrapper.text()).not.toContain('Engine Stack:')
    expect(wrapper.text()).not.toContain('job-xyz-123')
  })

  it('renders custom prompt template name when custom extraction mode is active', () => {
    mockVideoTitle.value = 'Podcast Deep Dive Episode 42'
    mockVideoDuration.value = 3600
    mockExtractionMode.value = 'custom'
    mockSelectedPrompt.value = 'podcast_blak_blakan_v2.json'
    mockPromptsList.value = [
      { id: 'podcast_blak_blakan_v2.json', name: 'Podcast Blak-Blakan V2 (Deep & Raw)' }
    ]
    mockCachedVideos.value = [
      {
        video_id: 'sample-podcast',
        title: 'Podcast Deep Dive Episode 42',
        duration: 3600,
        channel: 'Creator Hub',
        thumbnail_url: '/assets/thumb.jpg',
        added_at: 1725710000000
      }
    ]

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 60,
        loadingLabel: 'ANALYZING...'
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(wrapper.text()).toContain('Prompt Template')
    expect(wrapper.text()).toContain('Podcast Blak-Blakan V2 (Deep & Raw)')
    expect(wrapper.text()).not.toContain('AI Intent')
  })

  it('handles thumbnail error gracefully by setting thumbnailLoadError flag', async () => {
    mockVideoTitle.value = 'Sample Video'
    mockVideoDuration.value = 100
    mockCachedVideos.value = [
      {
        video_id: 'sample-1',
        title: 'Sample Video',
        duration: 100,
        thumbnail_url: '/invalid/thumb.jpg'
      }
    ]

    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'PROCESSING...'
      },
      global: {
        stubs: globalStubs
      }
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    await img.trigger('error')
    expect((wrapper.vm as any).thumbnailLoadError).toBe(true)
  })

  it('emits cancel event when cancel button is clicked', async () => {
    const wrapper = mount(PipelineProgressStepper, {
      props: {
        stages: defaultStages,
        progressPercent: 50,
        loadingLabel: 'PROCESSING...'
      },
      global: {
        stubs: globalStubs
      }
    })

    const cancelBtn = wrapper.find('button')
    await cancelBtn.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
