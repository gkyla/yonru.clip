// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import HomeSidebar from '../../app/components/HomeSidebar.vue'
import { useRouter } from '#imports'

// Mock useClipperState
const mockSystemHealth = ref<any>({
  ffmpeg: { status: 'OK' },
  node: { status: 'OK' },
  python_env: { status: 'OK' },
  gemini_api: { status: 'Configured' },
  cookies: { status: 'Configured' }
})
const mockCheckingHealth = ref(false)
const mockJobStatus = ref('idle')
const mockSettingsScrollTarget = ref('')
const mockIsAnyPrerequisiteMissing = ref(false)
const mockIsNavigatingToEditor = ref(false)
const mockLoadReadyClipIntoEditor = vi.fn().mockResolvedValue({})
const mockFetchSavedHooks = vi.fn().mockResolvedValue({})
const mockSavedHooks = ref([])
const mockHooks = ref([])
const mockJobId = ref('job-123')
const mockFolderName = ref('')
const mockClipId = ref('')
const mockCheckSystemHealth = vi.fn().mockResolvedValue({})

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: mockSystemHealth,
    checkingHealth: mockCheckingHealth,
    jobStatus: mockJobStatus,
    settingsScrollTarget: mockSettingsScrollTarget,
    isAnyPrerequisiteMissing: mockIsAnyPrerequisiteMissing,
    isNavigatingToEditor: mockIsNavigatingToEditor,
    loadReadyClipIntoEditor: mockLoadReadyClipIntoEditor,
    fetchSavedHooks: mockFetchSavedHooks,
    savedHooks: mockSavedHooks,
    hooks: mockHooks,
    jobId: mockJobId,
    folderName: mockFolderName,
    clipId: mockClipId,
    checkSystemHealth: mockCheckSystemHealth
  })
}))

describe('HomeSidebar Component', () => {
  beforeEach(() => {
    mockSystemHealth.value = {
      ffmpeg: { status: 'OK' },
      node: { status: 'OK' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Configured' }
    }
    mockCheckingHealth.value = false
    mockJobStatus.value = 'idle'
    mockSettingsScrollTarget.value = ''
    mockIsAnyPrerequisiteMissing.value = false
    mockFolderName.value = ''
    mockClipId.value = ''
    mockCheckSystemHealth.mockClear()
    
    // Clear localStorage mock
    localStorage.clear()
  })

  it('renders expanded mode by default and displays all accordions', () => {
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    // Should display core navigation accordion
    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Prompts')
    expect(wrapper.text()).toContain('Documentation')
    expect(wrapper.text()).toContain('Settings')
  })

  it('emits navigation changes and calls navigateTo on navigation clicks', async () => {
    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    // Find and click Prompts button
    const promptsBtn = wrapper.findAll('button').find(b => b.text().includes('Prompts'))
    expect(promptsBtn).toBeDefined()
    await promptsBtn!.trigger('click')

    // Verifies the emit update active view and route change
    expect(wrapper.emitted('update:activeView')?.[0]).toEqual(['prompts'])
    expect(pushSpy).toHaveBeenCalledWith('/prompts')
  })

  it('collapses the sidebar when the toggle button is clicked', async () => {
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const toggleBtn = wrapper.find('button[title*="Collapse Sidebar"]')
    expect(toggleBtn.exists()).toBe(true)
    await toggleBtn.trigger('click')

    // After collapsing, title should be expand
    const expandBtn = wrapper.find('button[title*="Expand Sidebar"]')
    expect(expandBtn.exists()).toBe(true)
  })

  it('triggers settings scroll targets when status checklist links are clicked', async () => {
    // Setup healthy checks to fail
    mockSystemHealth.value.gemini_api.status = 'Missing'
    
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    // Click API configuration warning item
    const apiBtn = wrapper.findAll('button').find(b => b.text().includes('Gemini API'))
    expect(apiBtn).toBeDefined()
    await apiBtn!.trigger('click')

    expect(mockSettingsScrollTarget.value).toBe('settings-api')
  })

  it('respects sidebar drag boundaries and saves width to localStorage', async () => {
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const vm = wrapper.vm as any
    expect(vm.sidebarWidth).toBe(320)

    // Simulate drag start
    vm.startDrag(new MouseEvent('mousedown'))
    expect(vm.isDragging).toBe(true)

    // Drag to wider width
    vm.onDrag(new MouseEvent('mousemove', { clientX: 450 }))
    expect(vm.sidebarWidth).toBe(450)

    // Drag beyond maximum limit
    vm.onDrag(new MouseEvent('mousemove', { clientX: 900 }))
    expect(vm.sidebarWidth).toBe(600) // max width

    // Drag below minimum limit
    vm.onDrag(new MouseEvent('mousemove', { clientX: 100 }))
    expect(vm.sidebarWidth).toBe(280) // min width

    // Stop drag and persist
    vm.stopDrag()
    expect(vm.isDragging).toBe(false)
    expect(localStorage.getItem('yonru_sidebar_width')).toBe('280')
  })

  it('loads the active clip and routes to editor when Continue Editing is clicked', async () => {
    vi.useFakeTimers()
    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false,
        lastClip: { folder_name: 'test_folder', clip_id: '10_20_test', theme: 'Test Theme' },
        lastVideo: { title: 'Test Video', thumbnail: 'thumb.jpg' }
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const continueBtn = wrapper.findAll('button').find(b => b.text().includes('CONTINUE EDITING'))
    expect(continueBtn).toBeDefined()
    await continueBtn!.trigger('click')
    
    // Advance fake timers by 600ms to resolve minWait promise
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    // Expect clip load and routing to be called
    expect(mockLoadReadyClipIntoEditor).toHaveBeenCalledWith('test_folder', '10_20_test')
    expect(pushSpy).toHaveBeenCalledWith({
      path: '/editor',
      query: {
        job_id: 'job-123',
        folder: 'test_folder',
        hook_index: 0,
        tab: 'generated'
      }
    })
    vi.useRealTimers()
  })

  it('disables the card, displays ON EDITING, and prevents click handlers when the clip is currently active in the editor', async () => {
    vi.useFakeTimers()
    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push')
    mockLoadReadyClipIntoEditor.mockClear()
    pushSpy.mockClear()

    // Mock active workspace state to match lastClip props
    mockFolderName.value = 'test_folder'
    mockClipId.value = '10_20_test'

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'editor',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false,
        lastClip: { folder_name: 'test_folder', clip_id: '10_20_test', theme: 'Test Theme' },
        lastVideo: { title: 'Test Video', thumbnail: 'thumb.jpg' }
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const continueBtn = wrapper.findAll('button').find(b => b.text().includes('ON EDITING'))
    expect(continueBtn).toBeDefined()
    expect(continueBtn!.element.disabled).toBe(true)

    // Also verify the collapsed workspace indicator button is disabled
    const collapsedBtn = wrapper.findAll('button').find(b => b.html().includes('ri:movie-2-fill'))
    expect(collapsedBtn).toBeDefined()
    expect(collapsedBtn!.element.disabled).toBe(true)
    
    // Clicking should be a no-op / disabled
    await continueBtn!.trigger('click')
    await collapsedBtn!.trigger('click')
    
    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(mockLoadReadyClipIntoEditor).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('renders loading indicators for health check items when diagnostics are loading', async () => {
    mockCheckingHealth.value = true
    
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const items = (wrapper.vm as any).systemHealthItems
    const healthItem = items.find((i: any) => i.id === 'settings-health')
    const apiItem = items.find((i: any) => i.id === 'settings-api')
    const cookiesItem = items.find((i: any) => i.id === 'settings-cookies')
    const whisperItem = items.find((i: any) => i.id === 'settings-whisper')

    expect(healthItem.loading).toBe(true)
    expect(apiItem.loading).toBe(true)
    expect(cookiesItem.loading).toBe(true)
    expect(whisperItem.loading).toBe(false)

    const html = wrapper.html()
    expect(html).toContain('ri:loader-4-line')
  })

  it('renders correct navigation and status buttons in collapsed mode and handles clicks directly', async () => {
    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push')

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: true, // Start collapsed!
        lastClip: { folder_name: 'test_folder', clip_id: '10_20_test', theme: 'Test Theme' },
        lastVideo: { title: 'Test Video', thumbnail: 'thumb.jpg' }
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    expect((wrapper.vm as any).isCollapsed).toBe(true)

    // Find the prompts navigation icon button in collapsed view and click it
    const promptsBtn = wrapper.findAll('button').find(b => b.html().includes('ri:chat-quote-fill'))
    expect(promptsBtn).toBeDefined()
    await promptsBtn!.trigger('click')

    expect(wrapper.emitted('update:activeView')?.[0]).toEqual(['prompts'])
    expect(pushSpy).toHaveBeenCalledWith('/prompts')
    expect((wrapper.vm as any).isCollapsed).toBe(true) // Should remain collapsed!

    // Find the Continue Editing / movie button in collapsed view and click it
    const movieBtn = wrapper.findAll('button').find(b => b.html().includes('ri:movie-2-fill'))
    expect(movieBtn).toBeDefined()
    await movieBtn!.trigger('click')
    await flushPromises()

    expect(mockLoadReadyClipIntoEditor).toHaveBeenCalledWith('test_folder', '10_20_test')
    expect((wrapper.vm as any).isCollapsed).toBe(true) // Should remain collapsed!

    // Find the System Health / database button in collapsed view and click it
    const healthBtn = wrapper.findAll('button').find(b => b.html().includes('ri:database-2-line'))
    expect(healthBtn).toBeDefined()
    await healthBtn!.trigger('click')
    expect((wrapper.vm as any).isCollapsed).toBe(true) // Should remain collapsed!
  })

  it('restores collapsed state from localStorage on mount', () => {
    localStorage.setItem('yonru_sidebar_collapsed', 'true')
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    expect((wrapper.vm as any).isCollapsed).toBe(true)
  })

  it('does not persist or load collapsed state from localStorage when isFloating is true', async () => {
    localStorage.setItem('yonru_sidebar_collapsed', 'false')
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: true,
        isFloating: true
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    // Should ignore localStorage (which is 'false') and use defaultCollapsed (true)
    expect((wrapper.vm as any).isCollapsed).toBe(true)

    // Modifying collapsed state should not write to localStorage
    localStorage.removeItem('yonru_sidebar_collapsed');
    (wrapper.vm as any).isCollapsed = false
    await wrapper.vm.$nextTick()
    expect(localStorage.getItem('yonru_sidebar_collapsed')).toBeNull()
  })

  it('dispatches checkSystemHealth on mount if systemHealth is null and not checking', () => {
    mockSystemHealth.value = null
    mockCheckingHealth.value = false

    mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    expect(mockCheckSystemHealth).toHaveBeenCalledOnce()
  })

  it('does not dispatch checkSystemHealth on mount if systemHealth is already populated', () => {
    mockSystemHealth.value = {
      ffmpeg: { status: 'OK' },
      node: { status: 'OK' },
      python_env: { status: 'OK' },
      gemini_api: { status: 'Configured' },
      cookies: { status: 'Configured' }
    }
    mockCheckingHealth.value = false

    mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    expect(mockCheckSystemHealth).not.toHaveBeenCalled()
  })

  it('instantly disables workspace card and icon when activeView is editor even if state folder/clip are not set yet', async () => {
    vi.useFakeTimers()
    const router = useRouter()
    const pushSpy = vi.spyOn(router, 'push')
    mockLoadReadyClipIntoEditor.mockClear()
    pushSpy.mockClear()

    // Empty state (simulating reload tick before params are restored)
    mockFolderName.value = ''
    mockClipId.value = ''

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'editor',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false,
        lastClip: { folder_name: 'test_folder', clip_id: '10_20_test', theme: 'Test Theme' },
        lastVideo: { title: 'Test Video', thumbnail: 'thumb.jpg' }
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const continueBtn = wrapper.findAll('button').find(b => b.text().includes('ON EDITING'))
    expect(continueBtn).toBeDefined()
    expect(continueBtn!.element.disabled).toBe(true)

    const collapsedBtn = wrapper.findAll('button').find(b => b.html().includes('ri:movie-2-fill'))
    expect(collapsedBtn).toBeDefined()
    expect(collapsedBtn!.element.disabled).toBe(true)

    // Clicking should do nothing
    await continueBtn!.trigger('click')
    await collapsedBtn!.trigger('click')

    await vi.advanceTimersByTimeAsync(600)
    await flushPromises()

    expect(mockLoadReadyClipIntoEditor).not.toHaveBeenCalled()
    expect(pushSpy).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('enables the workspace card and icon when navigating back to home even if state matches the last clip', () => {
    mockFolderName.value = 'test_folder'
    mockClipId.value = '10_20_test'

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false,
        lastClip: { folder_name: 'test_folder', clip_id: '10_20_test', theme: 'Test Theme' },
        lastVideo: { title: 'Test Video', thumbnail: 'thumb.jpg' }
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: true
        }
      }
    })

    const continueBtn = wrapper.findAll('button').find(b => b.text().includes('CONTINUE EDITING'))
    expect(continueBtn).toBeDefined()
    expect(continueBtn!.element.disabled).toBe(false)

    const collapsedBtn = wrapper.findAll('button').find(b => b.html().includes('ri:movie-2-fill'))
    expect(collapsedBtn).toBeDefined()
    expect(collapsedBtn!.element.disabled).toBe(false)
  })
})
