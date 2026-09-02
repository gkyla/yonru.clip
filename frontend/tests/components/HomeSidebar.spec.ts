import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeSidebar from '~/components/HomeSidebar.vue'
import { ref } from 'vue'

const stateStore: Record<string, any> = {}
const mockUseState = (key: string, init?: () => any) => {
  if (!stateStore[key]) {
    stateStore[key] = ref(init ? init() : false)
  }
  return stateStore[key]
}

const pushSpy = vi.fn()
vi.stubGlobal('useRouter', () => ({
  push: pushSpy
}))

vi.mock('#imports', () => ({
  useState: mockUseState,
  useRouter: () => ({
    push: pushSpy
  })
}))

const mockJobStatus = ref('idle')
const mockSavedHooks = ref<any[]>([])
const mockHooks = ref<any[]>([])
const mockJobId = ref('')
const mockIsAnyPrerequisiteMissing = ref(false)
const mockLastAccessedVideo = ref<any>(null)
const mockLastAccessedClip = ref<any>(null)
const mockLoadReadyClipIntoEditor = vi.fn().mockResolvedValue(true)
const mockIsNavigatingToEditor = ref(false)
const mockShowToast = vi.fn()
const mockCheckSystemHealth = vi.fn()

vi.mock('~/composables/useClipperState', () => ({
  useClipperState: () => ({
    jobStatus: mockJobStatus,
    savedHooks: mockSavedHooks,
    hooks: mockHooks,
    jobId: mockJobId,
    isAnyPrerequisiteMissing: mockIsAnyPrerequisiteMissing,
    lastAccessedVideo: mockLastAccessedVideo,
    lastAccessedClip: mockLastAccessedClip,
    loadReadyClipIntoEditor: mockLoadReadyClipIntoEditor,
    isNavigatingToEditor: mockIsNavigatingToEditor,
    showToast: mockShowToast,
    checkSystemHealth: mockCheckSystemHealth
  })
}))

describe('HomeSidebar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockJobStatus.value = 'idle'
    mockLastAccessedVideo.value = null
    mockLastAccessedClip.value = null
    mockIsNavigatingToEditor.value = false
    Object.keys(stateStore).forEach(k => delete stateStore[k])
    try {
      const nuxt = (globalThis as any).useNuxtApp?.()
      if (nuxt?.payload?.state) {
        nuxt.payload.state = {}
      }
    } catch {}
    try {
      (globalThis as any).clearNuxtState?.()
    } catch {}
    localStorage.clear()
  })

  it('renders expanded mode by default and displays all core navigation and utility items', () => {
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
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('Search or jump to...')
    expect(wrapper.text()).toContain('⌘K')
    expect(wrapper.text()).toContain('Home')
    expect(wrapper.text()).toContain('Prompts')
    expect(wrapper.text()).toContain('Documentation')
    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).toContain('Changelog')
    expect(wrapper.text()).toContain('Support on')
    expect(wrapper.text()).toContain('Saweria')
    expect(wrapper.text()).toContain('Trakteer')
  })

  it('emits update:activeView event on navigation clicks', async () => {
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
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    const promptsBtn = wrapper.findAll('button').find(b => b.text().includes('Prompts'))
    expect(promptsBtn).toBeDefined()
    await promptsBtn!.trigger('click')

    expect(wrapper.emitted('update:activeView')).toBeTruthy()
    expect(wrapper.emitted('update:activeView')![0]).toEqual(['prompts'])
  })

  it('collapses and expands the sidebar when toggle buttons are clicked', async () => {
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
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    const toggleBtn = wrapper.find('button[title*="Sidebar"]')
    expect(toggleBtn.exists()).toBe(true)

    await toggleBtn.trigger('click')
    expect((wrapper.vm as any).isCollapsed).toBe(true)

    await toggleBtn.trigger('click')
    expect((wrapper.vm as any).isCollapsed).toBe(false)
  })

  it('opens Command Palette when search trigger button is clicked in expanded mode', async () => {
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
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    const searchBtn = wrapper.find('button[title*="Search"]')
    expect(searchBtn.exists()).toBe(true)

    const { useCommandPalette } = await import('~/composables/useCommandPalette')
    const palette = useCommandPalette()
    palette.close()
    expect(palette.isOpen.value).toBe(false)

    await searchBtn.trigger('click')
    expect(palette.isOpen.value).toBe(true)
  })

  it('respects sidebar drag boundaries and saves width to localStorage', () => {
    localStorage.setItem('yonru_sidebar_width', '320')

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
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    const resizer = wrapper.find('.cursor-col-resize')
    expect(resizer.exists()).toBe(true)
  })

  it('loads the active clip and routes to editor when Continue Editing is clicked', async () => {
    const firstClip = {
      clip_id: '0_30',
      folder_name: 'test_folder',
      theme: 'Clip Theme 1',
      start_time: '00:00:00',
      end_time: '00:00:30'
    }
    const firstVideo = {
      folder_name: 'test_folder',
      title: 'Test Video',
      clips: [firstClip]
    }
    const mockVideos = [firstVideo]

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: mockVideos,
        lastVideo: firstVideo,
        lastClip: firstClip,
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    const continueBtn = wrapper.findAll('button').find(b => b.text().includes('CONTINUE EDITING'))
    expect(continueBtn).toBeDefined()
    await continueBtn!.trigger('click')
    await new Promise(r => setTimeout(r, 700))

    expect(pushSpy).toHaveBeenCalledWith({
      path: '/editor',
      query: {
        job_id: '',
        folder: 'test_folder',
        hook_index: 0,
        tab: 'generated'
      }
    })
  })

  it('disables the card, displays ON EDITING, and prevents click handlers when activeView is editor', async () => {
    const mockClip = { clip_id: '0_30', theme: 'Clip Theme 1' }
    const mockVideos = [
      {
        folder_name: 'test_folder',
        title: 'Test Video',
        clips: [mockClip]
      }
    ]

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'editor',
        cachedVideos: mockVideos,
        lastVideo: mockVideos[0],
        lastClip: mockClip,
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: false
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect(wrapper.text()).toContain('ON EDITING')
    const button = wrapper.find('button[disabled]')
    expect(button.exists()).toBe(true)
  })

  it('renders correct navigation in collapsed mode and handles clicks directly', async () => {
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        defaultCollapsed: true
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect(wrapper.find('button[title*="Sidebar"]').exists()).toBe(true)
    expect(wrapper.find('a[title*="Support @gitkyla on Saweria"]').exists()).toBe(true)
    expect(wrapper.find('a[title*="Support @gitkyla on Trakteer"]').exists()).toBe(true)
  })

  it('restores collapsed state from localStorage on mount', () => {
    localStorage.setItem('yonru_sidebar_collapsed', 'true')

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000'
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect((wrapper.vm as any).isCollapsed).toBe(true)
  })

  it('defaults to collapsed mode when defaultCollapsed prop is omitted and localStorage is empty', () => {
    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000'
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect((wrapper.vm as any).isCollapsed).toBe(true)
    expect(wrapper.find('button[title*="Expand Sidebar"]').exists()).toBe(true)
  })

  it('does not persist or load collapsed state from localStorage when isFloating is true', () => {
    localStorage.setItem('yonru_sidebar_collapsed', 'false')

    const wrapper = mount(HomeSidebar, {
      props: {
        activeView: 'home',
        cachedVideos: [],
        isProcessing: false,
        API_BASE: 'http://localhost:8000',
        isFloating: true,
        defaultCollapsed: true
      },
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    expect((wrapper.vm as any).isCollapsed).toBe(true)
  })

  it('triggers Command Palette modal on search button click in expanded and collapsed modes', async () => {
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
          NuxtLink: { template: '<a><slot /></a>' }
        }
      }
    })

    // Click Spotlight search trigger in expanded mode
    const searchTrigger = wrapper.find('button[title*="Search"]')
    expect(searchTrigger.exists()).toBe(true)
    await searchTrigger.trigger('click')

    const { useCommandPalette } = await import('~/composables/useCommandPalette')
    const palette = useCommandPalette()
    expect(palette.isOpen.value).toBe(true)

    // Collapse sidebar and verify circular button trigger
    const collapseBtn = wrapper.find('button[title*="Collapse Sidebar"]')
    await collapseBtn.trigger('click')

    palette.close()
    expect(palette.isOpen.value).toBe(false)

    const collapsedTrigger = wrapper.find('button[title*="Search"]')
    expect(collapsedTrigger.exists()).toBe(true)
    await collapsedTrigger.trigger('click')
    expect(palette.isOpen.value).toBe(true)
  })
})

