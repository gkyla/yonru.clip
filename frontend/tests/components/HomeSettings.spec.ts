import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeSettings from '../../app/components/HomeSettings.vue'

// Mock useClipperState
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: { value: {} },
    checkingHealth: { value: false },
    isAnyPrerequisiteMissing: { value: false },
    settingsScrollTarget: { value: '' },
    whisperModel: { value: 'base' },
    showToast: vi.fn(),
    checkSystemHealth: vi.fn(),
  })
}))

describe('HomeSettings Component', () => {
  let mockEnvConfig = 'key_1, key_2'

  beforeEach(() => {
    mockEnvConfig = 'key_1, key_2'
    // Mock global $fetch to return mock settings
    global.$fetch = vi.fn().mockImplementation((url, options) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/system-settings')) {
        return Promise.resolve({
          settings: {
            GEMINI_API_KEY: mockEnvConfig,
            FFMPEG_PATH: '',
            NODE_PATH: ''
          }
        })
      }
      if (urlStr.includes('/api/cookies-status')) {
        return Promise.resolve({ exists: false, size_bytes: 0, last_modified: null })
      }
      return Promise.resolve({})
    })
  })

  it('populates keysList from plain comma-separated string on mount', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    // Wait for onMounted fetchSettings to execute
    await new Promise(resolve => setTimeout(resolve, 50))
    
    const vm = wrapper.vm as any
    expect(vm.keysList).toBeDefined()
    expect(vm.keysList.length).toBe(2)
    expect(vm.keysList[0].value).toBe('key_1')
    expect(vm.keysList[0].title).toBe('')
    expect(vm.keysList[1].value).toBe('key_2')
  })

  it('populates keysList from JSON formatted key configuration', async () => {
    mockEnvConfig = '[{"title":"Work Key","value":"key_work"},{"title":"Home Key","value":"key_home"}]'
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 50))
    const vm = wrapper.vm as any
    
    expect(vm.keysList.length).toBe(2)
    expect(vm.keysList[0].value).toBe('key_work')
    expect(vm.keysList[0].title).toBe('Work Key')
    expect(vm.keysList[1].value).toBe('key_home')
    expect(vm.keysList[1].title).toBe('Home Key')
  })

  it('can dynamically add and remove fallback keys', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 50))
    const vm = wrapper.vm as any
    
    expect(vm.keysList.length).toBe(2)
    
    // Add key
    vm.addKey()
    expect(vm.keysList.length).toBe(3)
    expect(vm.keysList[2].value).toBe('')
    expect(vm.keysList[2].title).toBe('')
    
    // Remove key
    vm.removeKey(0)
    expect(vm.keysList.length).toBe(2)
    expect(vm.keysList[0].value).toBe('key_2')
  })

  it('can reorder keys dynamically using moveKey and triggers activeFlash animation states', async () => {
    mockEnvConfig = '[{"title":"First","value":"k1"},{"title":"Second","value":"k2"},{"title":"Third","value":"k3"}]'
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    await new Promise(resolve => setTimeout(resolve, 50))
    const vm = wrapper.vm as any
    
    expect(vm.keysList[0].value).toBe('k1')
    expect(vm.keysList[1].value).toBe('k2')
    
    vi.useFakeTimers()
    
    // Move second key up
    vm.moveKey(1, -1)
    expect(vm.keysList[0].value).toBe('k2')
    expect(vm.keysList[0].title).toBe('Second')
    expect(vm.keysList[0].activeFlash).toBe(true)
    expect(vm.keysList[1].value).toBe('k1')
    expect(vm.keysList[1].title).toBe('First')
    expect(vm.keysList[1].activeFlash).toBe(true)
    
    // Fast-forward cooldown timers
    vi.advanceTimersByTime(600)
    expect(vm.keysList[0].activeFlash).toBe(false)
    expect(vm.keysList[1].activeFlash).toBe(false)
    
    // Move first key down
    vm.moveKey(0, 1)
    expect(vm.keysList[0].value).toBe('k1')
    expect(vm.keysList[1].value).toBe('k2')
    
    vi.useRealTimers()
  })
})
