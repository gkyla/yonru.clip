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
  beforeEach(() => {
    // Mock global $fetch to return mock settings
    global.$fetch = vi.fn().mockImplementation((url, options) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/system-settings')) {
        return Promise.resolve({
          settings: {
            GEMINI_API_KEY: 'key_1, key_2',
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

  it('populates keysList from split GEMINI_API_KEY on mount', async () => {
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
    expect(vm.keysList[1].value).toBe('key_2')
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
    
    // Remove key
    vm.removeKey(0)
    expect(vm.keysList.length).toBe(2)
    expect(vm.keysList[0].value).toBe('key_2')
  })
})
