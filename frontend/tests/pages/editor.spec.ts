// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import editor from '../../app/pages/editor.vue'

import { useRouter } from '#imports'

const mockJobStatus = ref('idle')
const mockJobError = ref<string | null>(null)
const mockIsMediaLoading = ref(false)
const mockActiveHook = ref<any>(null)
const mockExtractClip = vi.fn()
const mockSubtitleMode = ref('word')

// Mock useRoute from #imports but preserve other auto-imports (like useRouter)
vi.mock('#imports', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    useRoute: () => ({
      query: {
        job_id: 'job-123',
        folder: 'test_folder',
        clip_id: '10_20_test'
      }
    })
  }
})

// Mock useClipperState using relative path
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    cachedVideos: { value: [] },
    lastAccessedVideo: { value: null },
    lastAccessedClip: { value: null },
    videoTitle: { value: '' },
    jobStatus: mockJobStatus,
    jobError: mockJobError,
    whisperModel: { value: 'base' },
    isNavigatingToEditor: { value: false },
    isMediaLoading: mockIsMediaLoading,
    fetchCached: vi.fn(),
    fetchSavedHooks: vi.fn(),
    initPersistence: vi.fn(),
    stopPolling: vi.fn(),
    startPolling: vi.fn(),
    renderStatus: { value: 'idle' },
    jobId: { value: '' },
    folderName: { value: '' },
    clipId: { value: '' },
    savedHooks: { value: [] },
    hooks: { value: [] },
    activeHook: mockActiveHook,
    extractClip: mockExtractClip,
    subtitleMode: mockSubtitleMode,
    formatDuration: (sec: number) => `${Math.floor(sec/60)}:${Math.floor(sec%60).toString().padStart(2, '0')}`
  })
}))

describe('Editor Page', () => {
  beforeEach(() => {
    mockJobStatus.value = 'idle'
    mockJobError.value = null
    mockIsMediaLoading.value = false
    mockActiveHook.value = null
    mockExtractClip.mockReset()
  })

  it('renders successfully', () => {
    const wrapper = mount(editor, {
      global: {
        stubs: {
          HomeSidebar: true,
          SidebarSettings: true,
          VideoPreview: true,
          TimelinePanel: true,
          TimelineEditor: true,
          BlacklistSettings: true,
          TranscriptEditor: true,
          AuditLogsPanel: true,
          RenderingOverlay: true,
          Icon: true
        }
      }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('resets sidebarView to editor on keep-alive activation', async () => {
    const wrapper = mount(editor, {
      global: {
        stubs: {
          HomeSidebar: true,
          SidebarSettings: true,
          VideoPreview: true,
          TimelinePanel: true,
          TimelineEditor: true,
          BlacklistSettings: true,
          TranscriptEditor: true,
          AuditLogsPanel: true,
          RenderingOverlay: true,
          Icon: true
        }
      }
    })
    
    // Wait for hasBeenMounted to become true via nextTick
    await wrapper.vm.$nextTick()
    
    // Simulate navigating away to home page (which mutates sidebarView ref)
    const vm = wrapper.vm as any
    vm.sidebarView = 'home'
    
    // Trigger keep-alive activated hooks
    const instance = wrapper.vm.$.vnode.component as Record<string, unknown> | null
    if (instance && Array.isArray(instance.a)) {
      instance.a.forEach((hook: unknown) => {
        if (typeof hook === 'function') {
          hook()
        }
      })
    }
    
    await wrapper.vm.$nextTick()
    
    expect(vm.sidebarView).toBe('editor')
  })

  it('displays the error overlay when jobStatus is error and allows back/retry', async () => {
    mockJobStatus.value = 'error'
    mockJobError.value = 'Failed to extract audio stream'
    mockActiveHook.value = { theme: 'Test Hook Theme', start: 10, end: 20 }

    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(editor, {
      global: {
        stubs: {
          HomeSidebar: true,
          SidebarSettings: true,
          VideoPreview: true,
          TimelinePanel: true,
          TimelineEditor: true,
          BlacklistSettings: true,
          TranscriptEditor: true,
          AuditLogsPanel: true,
          RenderingOverlay: true,
          Icon: true
        }
      }
    })

    // Check that overlay text matches the error
    expect(wrapper.text()).toContain('Extraction Failed')
    expect(wrapper.text()).toContain('Failed to extract audio stream')

    // Find back & retry buttons
    const buttons = wrapper.findAll('button')
    const backBtn = buttons.find(b => b.text().includes('Go Back'))
    const retryBtn = buttons.find(b => b.text().includes('Retry Cut'))

    expect(backBtn).toBeDefined()
    expect(retryBtn).toBeDefined()

    // Clicking Go Back resets error states and navigates home
    await backBtn!.trigger('click')
    expect(mockJobStatus.value).toBe('idle')
    expect(mockJobError.value).toBeNull()
    expect(pushSpy).toHaveBeenCalledWith('/')

    // Reset and check retry
    mockJobStatus.value = 'error'
    mockJobError.value = 'Failed to extract audio stream'
    await retryBtn!.trigger('click')
    expect(mockExtractClip).toHaveBeenCalledWith(mockActiveHook.value)
  })
})
