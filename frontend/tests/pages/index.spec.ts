// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import index from '../../app/pages/index.vue'
import { ref } from 'vue'
import { useState } from '#imports'

// Mock useClipperState
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    youtubeUrl: ref(''),
    selectedPrompt: ref('prompt.json'),
    promptsList: ref([]),
    whisperModel: ref('base'),
    whisperModels: [
      { id: 'tiny', name: 'Tiny', speed: 'Ultra Fast', acc: 'Basic', desc: 'Minimal accuracy, best for quick testing on weak hardware.' },
      { id: 'base', name: 'Base', speed: 'Very Fast', acc: 'Good', desc: 'Great balance for clear audio. Default choice.' },
      { id: 'small', name: 'Small', speed: 'Fast', acc: 'Better', desc: 'Significantly better for non-English or noisy audio.' },
      { id: 'medium', name: 'Medium', speed: 'Moderate', acc: 'Excellent', desc: 'High precision. Requires decent hardware (~5GB VRAM).' },
      { id: 'large-v3', name: 'Large-v3', speed: 'Slow', acc: 'State-of-the-Art', desc: 'Highest accuracy possible. Best for complex dialogue.' }
    ],
    jobError: ref(null),
    hooks: ref([]),
    jobId: ref('job-123'),
    jobStatus: ref('idle'),
    clipId: ref(''),
    savedHooks: ref([]),
    activeHook: ref(null),
    lastAccessedVideoId: ref(null),
    lastAccessedClip: ref(null),
    videoUrl: ref(null),
    outputUrl: ref(null),
    startSafetyBuffer: ref(2.0),
    videoDuration: ref(100),
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
  })
}))

describe('Index Page', () => {
  beforeEach(() => {
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

  it('supports modifying values using arrow keys', async () => {
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
    
    // Set selectedModalHook on vm
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
    const inputs = wrapper.findAll('input[type=\"text\"]')
    const startInput = inputs.find(i => (i.element as HTMLInputElement).value === '00:10')
    const endInput = inputs.find(i => (i.element as HTMLInputElement).value === '00:20')
    
    expect(startInput).toBeDefined()
    expect(endInput).toBeDefined()
    
    // Trigger arrow up on start input
    await startInput!.trigger('keydown.up')
    // new start display value is 10.0 + 1 = 11.0. start safety buffer is 2.0.
    // So raw start is 11.0 + 2.0 = 13.0
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

  it('persists and restores volume and muted state', async () => {
    localStorage.clear()
    
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
    vm.state.videoUrl.value = 'dummy.mp4'
    
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

  it('hides the Ready badge for the active hook while a job is cutting/transcribing/queued', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/ready-clips')) {
        return Promise.resolve({
          clips: [
            { folder_name: 'test-folder', clip_id: '8_20_Test_Active_Hook' }
          ]
        })
      }
      return Promise.resolve({})
    }))

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
    // Set active video details to match folderName
    vm.state.folderName.value = 'test-folder'
    vm.state.jobStatus.value = 'hooks_ready'
    
    // Set up readyClips to contain a matching clip
    // With hook start 10, safetyBuffer 2.0 (default in index.vue is 2.0)
    // Clip ID will start at 10 - 2 = 8, end at 20: '8_20_Test_Active_Hook'
    const hook = { start: 10, end: 20, theme: 'Test Active Hook', transcript_quote: '' }
    vm.state.hooks.value = [hook]

    // Set state value as well just in case
    const readyClipsState = useState<any[]>('readyClips', () => [])
    readyClipsState.value = [
      { folder_name: 'test-folder', clip_id: '8_20_Test_Active_Hook' }
    ]

    await wrapper.vm.$nextTick()

    // 1. Since status is idle, hook should show "Ready"
    const getHookCard = () => wrapper.findAll('.bg-surface-panel').find(d => d.text().includes('Test Active Hook'))
    expect(getHookCard()).toBeDefined()
    expect(getHookCard()!.text()).toContain('Ready')

    // 2. Set jobStatus to cutting and activeHook to our hook
    vm.state.jobStatus.value = 'cutting'
    vm.state.activeHook.value = hook
    vm.state.clipId.value = ''

    await wrapper.vm.$nextTick()

    // 3. Ready badge should be hidden
    expect(getHookCard()!.text()).not.toContain('Ready')

    // 4. Set jobStatus to ready, badge should reappear
    vm.state.jobStatus.value = 'ready'
    await wrapper.vm.$nextTick()
    expect(getHookCard()!.text()).toContain('Ready')
  })

  it('toggles sort dropdown and triggers fetchCached on selection', async () => {
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
    expect(vm.state.cachedVideosSortBy.value).toBe('title')
    expect(vm.state.cachedVideosSortOrder.value).toBe('asc')
    expect(vm.state.fetchCached).toHaveBeenCalledWith(true)
    expect(vm.isSortDropdownOpen).toBe(false)
  })

  it('triggers loadMoreCached when sentinel intersects', async () => {
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

    // Mock hasMore videos
    vm.state.cachedVideosHasMore.value = true
    vm.state.cachedVideos.value = [{ video_id: 'vid1', title: 'Video 1', duration: 10, folder_name: 'Vid_1' }]
    await wrapper.vm.$nextTick()

    // Assert sentinel element is mounted
    const sentinel = wrapper.find({ ref: 'scrollSentinel' })
    expect(sentinel.exists()).toBe(true)

    // Trigger intersection
    if ((globalThis as any)._triggerIntersection) {
      (globalThis as any)._triggerIntersection([{ isIntersecting: true }])
    }
    
    // Assert fetchCached is triggered with false (page 2 incremental fetch)
    expect(vm.state.fetchCached).toHaveBeenCalledWith(false)
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
    vm.state.jobStatus.value = 'idle'
    vm.state.savedHooks.value = [{ theme: 'Saved Hook', start: 10, end: 20 }]
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
    vm.state.savedHooks.value = [{ theme: 'Stale Hook', start: 10, end: 20 }]
    vm.state.folderName.value = 'stale-folder'
    
    // Call analyzeCached
    await vm.analyzeCached('some-video-id', false)
    
    expect(vm.state.savedHooks.value).toEqual([])
    expect(vm.state.folderName.value).toBeNull()
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

    const vm = wrapper.vm as any
    vm.state.jobStatus.value = 'queued'
    vm.state.savedHooks.value = []
    vm.state.hooks.value = []
    await wrapper.vm.$nextTick()

    // Find the Hit List container (it starts with .animate-in and contains generated hooks)
    const hooksContainer = wrapper.find('.animate-in')
    expect(hooksContainer.exists()).toBe(false)
  })

  it('resets activeTab to generated when jobStatus transitions to queued', async () => {
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
    vm.activeTab = 'saved'
    
    vm.state.jobStatus.value = 'queued'
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
    vm.state.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    expect(vm.progressPercent).toBe(12.5)
    expect(vm.stages[0].state).toBe('active')
    expect(vm.stages[1].state).toBe('pending')
    expect(vm.stages[2].state).toBe('pending')
    expect(vm.stages[3].state).toBe('pending')

    // 2. Test status: transcribing
    vm.state.jobStatus.value = 'transcribing'
    await wrapper.vm.$nextTick()
    expect(vm.progressPercent).toBe(75)
    expect(vm.stages[0].state).toBe('completed')
    expect(vm.stages[1].state).toBe('completed')
    expect(vm.stages[2].state).toBe('active')
    expect(vm.stages[3].state).toBe('pending')

    // 3. Test status in cached mode (isCachedAnalysis = true, isReanalyzingCached = false - Load Cache Hooks)
    vm.state.isCachedAnalysis.value = true
    vm.isReanalyzingCached = false
    vm.state.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    expect(vm.stages).toHaveLength(1)
    expect(vm.stages[0].id).toBe('cache_lookup')
    expect(vm.stages[0].state).toBe('active')
    expect(vm.progressPercent).toBe(20)

    vm.state.jobStatus.value = 'ready'
    await wrapper.vm.$nextTick()
    expect(vm.stages[0].state).toBe('completed')
    expect(vm.progressPercent).toBe(100)

    // 4. Test status in cached mode with force re-analysis (isCachedAnalysis = true, isReanalyzingCached = true - Reanalyze Hooks)
    vm.isReanalyzingCached = true
    vm.state.jobStatus.value = 'queued'
    await wrapper.vm.$nextTick()
    expect(vm.stages).toHaveLength(2)
    expect(vm.progressPercent).toBe(20)
    expect(vm.stages[0].id).toBe('cache_lookup')
    expect(vm.stages[0].state).toBe('active')
    expect(vm.stages[1].state).toBe('pending')

    vm.state.jobStatus.value = 'generating_hooks'
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
    vm.state.jobStatus.value = 'queued'
    vm.state.hooks.value = []
    await wrapper.vm.$nextTick()

    // Find the cancel button containing "Cancel & Return to Library"
    const btn = wrapper.findAll('button').find(b => b.text().includes('Cancel & Return to Library'))
    expect(btn).toBeDefined()
    
    await btn!.trigger('click')
    expect(vm.state.jobStatus.value).toBe('idle')
  })
})

