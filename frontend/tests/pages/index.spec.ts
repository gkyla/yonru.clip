// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import index from '../../app/pages/index.vue'
import { ref } from 'vue'

// Mock useClipperState
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    youtubeUrl: ref(''),
    selectedPrompt: ref('prompt.json'),
    promptsList: ref([]),
    jobError: ref(null),
    hooks: ref([]),
    jobId: ref('job-123'),
    jobStatus: ref('idle'),
    savedHooks: ref([]),
    activeHook: ref(null),
    lastAccessedVideoId: ref(null),
    lastAccessedClip: ref(null),
    videoUrl: ref(null),
    startSafetyBuffer: ref(2.0),
    videoDuration: ref(100),
    folderName: ref('test-folder'),
    isMediaLoading: ref(false),
    isNavigatingToEditor: ref(false),
    cachedVideos: ref([]),
    isCachedLoading: ref(false),
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
    const inputs = wrapper.findAll('input[type="text"]')
    const startInput = inputs.find(i => i.element.value === '00:10')
    const endInput = inputs.find(i => i.element.value === '00:20')
    
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
})
