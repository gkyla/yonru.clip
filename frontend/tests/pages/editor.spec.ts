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
const mockFolderName = ref('test_folder')
const mockClipId = ref('')
const mockSavedHooks = ref<any[]>([])
const mockHooks = ref<any[]>([])

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
    folderName: mockFolderName,
    clipId: mockClipId,
    savedHooks: mockSavedHooks,
    hooks: mockHooks,
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
    mockFolderName.value = 'test_folder'
    mockClipId.value = ''
    mockSavedHooks.value = []
    mockHooks.value = []
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

  it('retains the loading overlay visibility for 800ms after job status transitions to ready', async () => {
    vi.useFakeTimers()
    mockJobStatus.value = 'cutting'
    
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
    
    // With status 'cutting', the overlay must be visible
    expect(wrapper.find('.bg-\\[\\#060608\\]\\/95').isVisible()).toBe(true)

    // Now transition to ready
    mockJobStatus.value = 'ready'
    await wrapper.vm.$nextTick()

    // Even though it transitioned to ready, the overlay should still be visible because of the 800ms delay
    expect(wrapper.find('.bg-\\[\\#060608\\]\\/95').isVisible()).toBe(true)

    // Advance by 799ms - should still be visible
    vi.advanceTimersByTime(799)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.bg-\\[\\#060608\\]\\/95').isVisible()).toBe(true)

    // Advance to 800ms - should finally trigger timeout and set state to false
    vi.advanceTimersByTime(1)
    await wrapper.vm.$nextTick()
    
    // Check state value directly
    const isOverlayVisibleState = useState<boolean>('isOverlayVisible')
    expect(isOverlayVisibleState.value).toBe(false)

    vi.useRealTimers()
  })

  it('hides the Ready badge for the active hook while a job is cutting/transcribing/queued', async () => {
    // 1. Set up a hook and a matching ready clip
    const hook = { start: 10, end: 20, theme: 'Test Active Hook', transcript_quote: '' }
    mockHooks.value = [hook]
    mockFolderName.value = 'test_folder'
    
    // Set up readyClips to contain a matching clip on disk
    // A matching clip name uses: Math.floor(hook.start - safetyBuffer) or hook.start, etc.
    // By default, safetyBuffer is 2.0. So 10 - 2 = 8.
    const matchingClipId = '8_20_Test_Active_Hook'
    const readyClipsState = useState<any[]>('readyClips', () => [])
    readyClipsState.value = [
      { folder_name: 'test_folder', clip_id: matchingClipId }
    ]

    // 2. Mount the editor page
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

    // Wait for nextTick for state to propagate
    await wrapper.vm.$nextTick()

    // 3. Since jobStatus is 'idle', the hook should be considered rendered/ready (since matching clip is in readyClips)
    const getHookButton = () => wrapper.findAll('button').find(b => b.text().includes('Test Active Hook'))
    expect(getHookButton()).toBeDefined()
    expect(getHookButton()!.text()).toContain('Ready')

    // 4. Now, simulate the user running a cut job for this hook
    mockJobStatus.value = 'cutting'
    mockActiveHook.value = hook
    mockClipId.value = '' // Reset when starting job

    await wrapper.vm.$nextTick()

    // 5. The hook is now currently being processed by the active job.
    // The "Ready" badge MUST NOT be displayed!
    expect(getHookButton()!.text()).not.toContain('Ready')

    // 6. Once the job transitions to 'ready', the badge should reappear
    mockJobStatus.value = 'ready'
    await wrapper.vm.$nextTick()
    expect(getHookButton()!.text()).toContain('Ready')
  })

  it('renders Floating Subtitle Panel as a 500px far-right overlay and dismisses on ESC key', async () => {
    mockActiveHook.value = {
      theme: 'Test Floating Overlay Hook',
      start: 10,
      end: 25,
      transcript_quote: 'Testing far right overlay panel positioning'
    }

    const wrapper = mount(editor, {
      global: {
        stubs: {
          HomeSidebar: true,
          SidebarSettings: true,
          VideoPreview: true,
          TimelineEditor: true,
          BlacklistSettings: true,
          ContentAuditPanel: true,
          ThumbnailEditor: true,
          Icon: true
        }
      }
    })

    await wrapper.vm.$nextTick()

    // Open Floating Subtitle Panel via action button
    const actionBtn = wrapper.findAll('button').find(b => b.html().includes('ri:edit-box-line'))
    if (actionBtn) {
      await actionBtn.trigger('click')
    } else {
      // Fallback: click first button if Icon stub renders differently
      const firstBtn = wrapper.find('button')
      if (firstBtn.exists()) await firstBtn.trigger('click')
    }
    await wrapper.vm.$nextTick()

    // Find Floating Subtitle Panel container
    const panel = wrapper.find('.w-\\[500px\\]')
    expect(panel.exists()).toBe(true)
    expect(panel.classes()).toContain('right-0')
    expect(panel.classes()).toContain('top-0')
    expect(panel.classes()).toContain('bottom-0')
    expect(panel.classes()).toContain('rounded-3xl')
    expect(panel.classes()).toContain('z-40')

    // Simulate ESC key press to dismiss panel
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(escEvent)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.w-\\[500px\\]').exists()).toBe(false)
  })
})
