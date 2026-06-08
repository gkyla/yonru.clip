// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
const mockJobStatus = ref('idle')
const mockSettingsScrollTarget = ref('')
const mockIsAnyPrerequisiteMissing = ref(false)

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: mockSystemHealth,
    jobStatus: mockJobStatus,
    settingsScrollTarget: mockSettingsScrollTarget,
    isAnyPrerequisiteMissing: mockIsAnyPrerequisiteMissing
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
    mockJobStatus.value = 'idle'
    mockSettingsScrollTarget.value = ''
    mockIsAnyPrerequisiteMissing.value = false
    
    // Stub navigateTo global
    vi.stubGlobal('navigateTo', vi.fn())
    
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
})
