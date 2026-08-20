// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import index from '../../app/pages/index.vue'
import HookResultsGallery from '../../app/components/home/HookResultsGallery.vue'
import CachedVideoLibrary from '../../app/components/home/CachedVideoLibrary.vue'
import { ref } from 'vue'
import { useState } from '#imports'
import type { Hook, CachedVideo, PromptTemplate } from '../../app/types/clipper'

const mockState = {
  youtubeUrl: ref(''),
  selectedPrompt: ref('prompt.json'),
  promptsList: ref<PromptTemplate[]>([]),
  extractionMode: ref('preset'),
  selectedPresetId: ref('auto'),
  focusTopic: ref(''),
  minDuration: ref(30),
  maxDuration: ref(180),
  whisperModel: ref('base'),
  language: ref('auto'),
  whisperModels: [
    { id: 'tiny', name: 'Tiny', speed: 'Ultra Fast', acc: 'Basic', desc: 'Minimal accuracy, best for quick testing on weak hardware.' },
    { id: 'base', name: 'Base', speed: 'Very Fast', acc: 'Good', desc: 'Great balance for clear audio. Default choice.' },
    { id: 'small', name: 'Small', speed: 'Fast', acc: 'Better', desc: 'Significantly better for non-English or noisy audio.' },
    { id: 'medium', name: 'Medium', speed: 'Moderate', acc: 'Excellent', desc: 'High precision. Requires decent hardware (~5GB VRAM).' },
    { id: 'large-v3', name: 'Large-v3', speed: 'Slow', acc: 'State-of-the-Art', desc: 'Highest accuracy possible. Best for complex dialogue.' }
  ],
  jobError: ref<string | null>(null),
  hooks: ref<Hook[]>([]),
  jobId: ref<string | null>('job-123'),
  jobStatus: ref('idle'),
  clipId: ref(''),
  savedHooks: ref<Hook[]>([]),
  activeHook: ref<Hook | null>(null),
  lastAccessedVideoId: ref<string | null>(null),
  lastAccessedClip: ref<any>(null),
  videoUrl: ref<string | null>(null),
  outputUrl: ref<string | null>(null),
  startSafetyBuffer: ref(2.0),
  videoDuration: ref(100),
  folderName: ref<string | null>('test-folder'),
  isMediaLoading: ref(false),
  isNavigatingToEditor: ref(false),
  isCachedAnalysis: ref(false),
  cachedVideos: ref<CachedVideo[]>([]),
  isCachedLoading: ref(false),
  isCachedMoreLoading: ref(false),
  cachedVideosFetchError: ref(false),
  cachedVideosTotal: ref(0),
  cachedVideosPage: ref(1),
  cachedVideosLimit: ref(6),
  cachedVideosSearch: ref(''),
  cachedVideosSortBy: ref('date'),
  downloadPercent: ref(0),
  hdReady: ref(false),
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

// Mock useClipperState
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}))

describe('Index Page & Sub-Modules', () => {
  beforeEach(() => {
    mockState.jobStatus.value = 'idle'
    mockState.hooks.value = []
    mockState.savedHooks.value = []
    mockState.isCachedAnalysis.value = false
    mockState.cachedVideos.value = []
    mockState.cachedVideosHasMore.value = false
    mockState.fetchCached.mockClear()

    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/ready-clips')) {
        return Promise.resolve({ clips: [] })
      }
      return Promise.resolve({})
    }))
  })

  it('renders successfully', () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('supports modifying values using arrow keys in HookResultsGallery', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'dummy.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    const vm = wrapper.vm as any
    vm.selectedModalHook = {
      start: 12.0, // subtracted start time display: 12.0 - 2.0 = 10.0 => 00:10
      end: 20.0,
      originalStart: 12.0,
      originalEnd: 20.0,
      theme: 'Test Hook',
      transcript_quote: 'Hello world'
    }
    vm.showAdjustDuration = true
    
    // Set initial input string values
    vm.startInputStr = '00:10'
    vm.endInputStr = '00:20'
    
    await wrapper.vm.$nextTick()
    
    // Find inputs
    const inputs = wrapper.findAll('input[type="text"]')
    const startInput = inputs.find(i => (i.element as HTMLInputElement).value === '00:10')
    const endInput = inputs.find(i => (i.element as HTMLInputElement).value === '00:20')
    
    expect(startInput).toBeDefined()
    expect(endInput).toBeDefined()
    
    // Trigger arrow up on start input
    await startInput!.trigger('keydown.up')
    expect(vm.selectedModalHook.start).toBe(13.0)
    expect(vm.startInputStr).toBe('00:11')
    
    // Trigger arrow down on start input
    await startInput!.trigger('keydown.down')
    expect(vm.selectedModalHook.start).toBe(12.0)
    expect(vm.startInputStr).toBe('00:10')
    
    // Trigger arrow up on end input
    await endInput!.trigger('keydown.up')
    expect(vm.selectedModalHook.end).toBe(21.0)
    expect(vm.endInputStr).toBe('00:21')
    
    // Trigger arrow down on end input
    await endInput!.trigger('keydown.down')
    expect(vm.selectedModalHook.end).toBe(20.0)
    expect(vm.endInputStr).toBe('00:20')
  })

  it('persists and restores volume and muted state in HookResultsGallery', async () => {
    localStorage.clear()
    
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'dummy.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    const vm = wrapper.vm as any
    vm.selectedModalHook = {
      start: 12.0,
      end: 20.0,
      originalStart: 12.0,
      originalEnd: 20.0,
      theme: 'Test Hook',
      transcript_quote: 'Hello world'
    }
    
    await wrapper.vm.$nextTick()
    
    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    
    const videoEl = video.element as HTMLVideoElement
    
    // Trigger volume change
    videoEl.volume = 0.45
    videoEl.muted = true
    await video.trigger('volumechange')
    
    expect(localStorage.getItem('yonru_preview_volume')).toBe('0.45')
    expect(localStorage.getItem('yonru_preview_muted')).toBe('true')
    
    // Clear and restore
    videoEl.volume = 1.0
    videoEl.muted = false
    
    vm.restoreModalVolume(videoEl)
    
    expect(videoEl.volume).toBe(0.45)
    expect(videoEl.muted).toBe(true)
  })

  it('hides the Ready badge for the active hook while a job is cutting/transcribing/queued in HookResultsGallery', async () => {
    mockState.folderName.value = 'test-folder'
    mockState.jobStatus.value = 'hooks_ready'
    
    const hook = { start: 10, end: 20, theme: 'Test Active Hook', transcript_quote: '' }
    mockState.hooks.value = [hook]

    const readyClips = [
      { folder_name: 'test-folder', clip_id: '8_20_Test_Active_Hook' }
    ]

    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: null,
        readyClips: readyClips as any
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // 1. Since status is idle/hooks_ready, hook should show "Ready"
    const getHookCard = () => wrapper.findAll('.bg-surface-panel').find(d => d.text().includes('Test Active Hook'))
    expect(getHookCard()).toBeDefined()
    expect(getHookCard()!.text()).toContain('Ready')

    // 2. Set jobStatus to cutting and activeHook to our hook
    mockState.jobStatus.value = 'cutting'
    mockState.activeHook.value = hook
    mockState.clipId.value = ''

    await wrapper.vm.$nextTick()

    // 3. Ready badge should be hidden
    expect(getHookCard()!.text()).not.toContain('Ready')

    // 4. Set jobStatus to ready, badge should reappear
    mockState.jobStatus.value = 'ready'
    await wrapper.vm.$nextTick()
    expect(getHookCard()!.text()).toContain('Ready')
  })

  it('toggles sort dropdown and triggers fetchCached on selection in CachedVideoLibrary', async () => {
    mockState.cachedVideos.value = [{ video_id: 'vid1', title: 'Video 1', duration: 10, folder_name: 'Vid_1' }]

    const wrapper = mount(CachedVideoLibrary, {
      props: {
        cachedVideos: mockState.cachedVideos.value,
        isCachedLoading: false,
        isProcessing: false
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any

    // Initially closed
    expect(vm.isSortDropdownOpen).toBe(false)

    // Open dropdown
    vm.isSortDropdownOpen = true
    await wrapper.vm.$nextTick()
    expect(vm.isSortDropdownOpen).toBe(true)

    // Select 'title:asc' option
    vm.selectSortOption('title:asc')
    await wrapper.vm.$nextTick()

    // Assert state update and fetch trigger
    expect(mockState.cachedVideosSortBy.value).toBe('title')
    expect(mockState.cachedVideosSortOrder.value).toBe('asc')
    expect(mockState.fetchCached).toHaveBeenCalledWith(true)
    expect(vm.isSortDropdownOpen).toBe(false)
  })

  it('triggers loadMoreCached when sentinel intersects in CachedVideoLibrary', async () => {
    const mockObserver = vi.fn().mockImplementation((callback) => {
      // Expose callback so we can manually trigger intersection
      (globalThis as any)._triggerIntersection = callback
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn()
      }
    })
    vi.stubGlobal('IntersectionObserver', mockObserver)

    mockState.cachedVideosHasMore.value = true
    mockState.cachedVideos.value = [{ video_id: 'vid1', title: 'Video 1', duration: 10, folder_name: 'Vid_1' }]

    const wrapper = mount(CachedVideoLibrary, {
      props: {
        cachedVideos: mockState.cachedVideos.value,
        isCachedLoading: false,
        isProcessing: false
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Assert sentinel element is mounted
    const sentinel = wrapper.find({ ref: 'scrollSentinel' })
    expect(sentinel.exists()).toBe(true)

    // Trigger intersection
    if ((globalThis as any)._triggerIntersection) {
      (globalThis as any)._triggerIntersection([{ isIntersecting: true }])
    }
    
    // Assert fetchCached is triggered with false (page 2 incremental fetch)
    expect(mockState.fetchCached).toHaveBeenCalledWith(false)
  })

  it('does not render the hooks section on the dashboard when jobStatus is idle, even if savedHooks has items', async () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    mockState.jobStatus.value = 'idle'
    mockState.savedHooks.value = [{ theme: 'Saved Hook', start: 10, end: 20 }] as Hook[]
    await wrapper.vm.$nextTick()

    // Find the Hit List container (it starts with .animate-in and contains generated hooks)
    const hooksContainer = wrapper.find('.animate-in')
    expect(hooksContainer.exists()).toBe(false)
  })

  it('resets savedHooks and folderName when starting a cached analysis', async () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    mockState.savedHooks.value = [{ theme: 'Stale Hook', start: 10, end: 20 }] as Hook[]
    mockState.folderName.value = 'stale-folder'
    
    // Call analyzeCached
    await vm.analyzeCached('some-video-id', false)
    
    expect(mockState.savedHooks.value).toEqual([])
    expect(mockState.folderName.value).toBeNull()
  })

  it('does not render the hooks section on the dashboard when jobStatus is queued and savedHooks is empty', async () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    mockState.jobStatus.value = 'queued'
    mockState.savedHooks.value = []
    mockState.hooks.value = []
    await wrapper.vm.$nextTick()

    // Find the Hit List container (it starts with .animate-in and contains generated hooks)
    const hooksContainer = wrapper.find('.animate-in')
    expect(hooksContainer.exists()).toBe(false)
  })

  it('resets activeTab to generated when jobStatus transitions to queued in HookResultsGallery', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: null,
        readyClips: []
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.activeTab = 'saved'
    
    mockState.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    
    expect(vm.activeTab).toBe('generated')
  })

  it('correctly maps jobStatus to stages and progressPercent', async () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any

    // 1. Test status: queued
    mockState.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    expect(vm.progressPercent).toBe(12.5)
    expect(vm.stages[0].state).toBe('active')
    expect(vm.stages[1].state).toBe('pending')
    expect(vm.stages[2].state).toBe('pending')
    expect(vm.stages[3].state).toBe('pending')

    // 2. Test status: transcribing
    mockState.jobStatus.value = 'transcribing'
    await wrapper.vm.$nextTick()
    expect(vm.progressPercent).toBe(75)
    expect(vm.stages[0].state).toBe('completed')
    expect(vm.stages[1].state).toBe('completed')
    expect(vm.stages[2].state).toBe('active')
    expect(vm.stages[3].state).toBe('pending')

    // 3. Test status in cached mode (isCachedAnalysis = true, isReanalyzingCached = false - Load Cache Hooks)
    mockState.isCachedAnalysis.value = true
    vm.isReanalyzingCached = false
    mockState.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    expect(vm.stages).toHaveLength(1)
    expect(vm.stages[0].id).toBe('cache_lookup')
    expect(vm.stages[0].state).toBe('active')
    expect(vm.progressPercent).toBe(20)

    mockState.jobStatus.value = 'ready'
    await wrapper.vm.$nextTick()
    expect(vm.stages[0].state).toBe('completed')
    expect(Number(vm.progressPercent)).toBe(100)

    // 4. Test status in cached mode with force re-analysis (isCachedAnalysis = true, isReanalyzingCached = true - Reanalyze Hooks)
    vm.isReanalyzingCached = true
    mockState.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    expect(vm.stages).toHaveLength(2)
    expect(vm.progressPercent).toBe(20)
    expect(vm.stages[0].id).toBe('cache_lookup')
    expect(vm.stages[0].state).toBe('active')
    expect(vm.stages[1].state).toBe('pending')

    mockState.jobStatus.value = 'generating_hooks'
    await wrapper.vm.$nextTick()
    expect(vm.progressPercent).toBe(85)
    expect(vm.stages[0].state).toBe('completed')
    expect(vm.stages[1].state).toBe('active')
  })

  it('renders cancel button that resets status to idle when clicked', async () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    mockState.jobStatus.value = 'queued'
    mockState.hooks.value = []
    await wrapper.vm.$nextTick()

    // Find the cancel button containing "Cancel & Return to Library"
    const btn = wrapper.findAll('button').find(b => b.text().includes('Cancel & Return to Library'))
    expect(btn).toBeDefined()
    
    await btn!.trigger('click')
    expect(mockState.jobStatus.value).toBe('idle')
  })

  it('triggers ReanalyzeModal.open when triggerReanalyze is invoked', async () => {
    const wrapper = mount(index, {
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    const vm = wrapper.vm as any
    expect(vm.reanalyzeModalRef).toBeDefined()

    // Trigger reanalyze
    vm.triggerReanalyze('vid-456')
    await wrapper.vm.$nextTick()

    // The modal should now be active/visible
    expect(wrapper.text()).toContain('Reanalyze Video Hooks')
  })

  it('renders Virality Breakdown default tab and switches to Transcript Quote in HookResultsGallery', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'dummy.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedModalHook = {
      start: 5.0,
      end: 25.0,
      theme: 'Viral Mystery',
      virality_score: 94,
      virality_reason: 'Strong psychological curiosity gap in opening 3 seconds.',
      transcript_quote: 'You will never believe what happened next.'
    }
    await wrapper.vm.$nextTick()

    expect(vm.activeModalTab).toBe('breakdown')
    expect(wrapper.text()).toContain('Virality Analysis')
    expect(wrapper.text()).toContain('Strong psychological curiosity gap in opening 3 seconds.')

    // Switch to Transcript Quote tab
    const transcriptTabBtn = wrapper.findAll('button').find(b => b.text().includes('Transcript Quote'))
    expect(transcriptTabBtn).toBeDefined()
    await transcriptTabBtn!.trigger('click')

    expect(vm.activeModalTab).toBe('transcript')
    expect(wrapper.text()).toContain('Spoken Dialog')
    expect(wrapper.text()).toContain('You will never believe what happened next.')
  })

  it('toggles floating timing adjustment popover in HookResultsGallery', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'dummy.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedModalHook = {
      start: 5.0,
      end: 25.0,
      theme: 'Viral Mystery',
      virality_score: 94
    }
    await wrapper.vm.$nextTick()

    expect(vm.showAdjustDuration).toBe(false)

    // Toggle popover button
    const adjustBtn = wrapper.findAll('button').find(b => b.text().includes('Adjust Start - End'))
    expect(adjustBtn).toBeDefined()
    await adjustBtn!.trigger('click')

    expect(vm.showAdjustDuration).toBe(true)
    expect(wrapper.text()).toContain('Adjust Clip Timing')

    // Click Done to close popover
    const doneBtn = wrapper.findAll('button').find(b => b.text().includes('Done'))
    expect(doneBtn).toBeDefined()
    await doneBtn!.trigger('click')

    expect(vm.showAdjustDuration).toBe(false)
  })

  it('loads video as HD by default when available and allows toggling to SD in HookResultsGallery', async () => {
    mockState.hasPreview.value = true
    mockState.hdReady.value = true
    mockState.videoUrl.value = 'http://localhost:8000/assets/sources/sample/full.mp4'

    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/assets/sources/sample/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          NuxtLayout: { template: '<div><slot /></div>' },
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const vm = wrapper.vm as any
    vm.selectedModalHook = {
      start: 5.0,
      end: 25.0,
      theme: 'Viral Mystery',
      virality_score: 94
    }
    await wrapper.vm.$nextTick()

    // Default resolution should be HD (full.mp4) since hdReady is true
    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('http://localhost:8000/assets/sources/sample/full.mp4')

    // Click SD toggle button
    const sdBtn = wrapper.findAll('button').find(b => b.text() === 'SD')
    expect(sdBtn).toBeDefined()
    await sdBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Video src should switch to SD preview.mp4
    expect(video.attributes('src')).toBe('http://localhost:8000/assets/sources/sample/preview.mp4')

    // Click HD toggle button to switch back to HD
    const hdBtn = wrapper.findAll('button').find(b => b.text() === 'HD')
    expect(hdBtn).toBeDefined()
    await hdBtn!.trigger('click')
    await wrapper.vm.$nextTick()

    // Video src should now switch back to HD full.mp4
    expect(video.attributes('src')).toBe('http://localhost:8000/assets/sources/sample/full.mp4')
  })
})
