// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import HomeSettings from '../../app/components/HomeSettings.vue'
import { useRouter, useRoute } from '#imports'

// Mock useClipperState
const mockSettingsScrollTarget = ref<string | null>(null)
const mockSystemHealth = ref<any>({})

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: mockSystemHealth,
    checkingHealth: ref(false),
    isAnyPrerequisiteMissing: ref(false),
    settingsScrollTarget: mockSettingsScrollTarget,
    whisperModel: ref('base'),
    language: ref('auto'),
    whisperModels: [
      { id: 'tiny', name: 'Tiny', speed: 'Ultra Fast', acc: 'Basic', desc: 'Minimal accuracy, best for quick testing on weak hardware.' },
      { id: 'base', name: 'Base', speed: 'Very Fast', acc: 'Good', desc: 'Great balance for clear audio. Default choice.' },
      { id: 'small', name: 'Small', speed: 'Fast', acc: 'Better', desc: 'Significantly better for non-English or noisy audio.' },
      { id: 'medium', name: 'Medium', speed: 'Moderate', acc: 'Excellent', desc: 'High precision. Requires decent hardware (~5GB VRAM).' },
      { id: 'large-v3', name: 'Large-v3', speed: 'Slow', acc: 'State-of-the-Art', desc: 'Highest accuracy possible. Best for complex dialogue.' }
    ],
    showToast: vi.fn(),
    checkSystemHealth: vi.fn(),
  })
}))

describe('HomeSettings Component', () => {
  let mockEnvConfig = 'key_1, key_2'

  beforeEach(() => {
    mockEnvConfig = 'key_1, key_2'
    mockSettingsScrollTarget.value = null
    mockSystemHealth.value = {}

    // Mock global $fetch to return mock settings
    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url, options) => {
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
    }))
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
    
    await flushPromises()
    
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
    
    await flushPromises()
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
    
    await flushPromises()
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
    
    await flushPromises()
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

  it('supports drag-and-drop interactions to reorder keys', async () => {
    mockEnvConfig = '[{"title":"First","value":"k1"},{"title":"Second","value":"k2"}]'
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    await flushPromises()
    const vm = wrapper.vm as any
    
    expect(vm.draggedIndex).toBeNull()
    expect(vm.keysList[0].value).toBe('k1')
    expect(vm.keysList[1].value).toBe('k2')
    
    // Simulate dragstart
    const mockDataTransfer = {
      effectAllowed: '',
      setData: vi.fn()
    }
    const dragStartEvent = {
      dataTransfer: mockDataTransfer
    } as unknown as DragEvent
    
    vm.dragStart(0, dragStartEvent)
    expect(vm.draggedIndex).toBe(0)
    expect(mockDataTransfer.effectAllowed).toBe('move')
    expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/plain', '0')
    
    vi.useFakeTimers()

    // Simulate dragenter on index 1 (swapping index 0 and 1)
    vm.dragEnter(1)
    expect(vm.keysList[0].value).toBe('k2')
    expect(vm.keysList[1].value).toBe('k1')
    expect(vm.draggedIndex).toBe(1)
    expect(vm.keysList[0].activeFlash).toBe(true)
    expect(vm.keysList[1].activeFlash).toBe(true)
    
    // Fast-forward cooldown timers
    vi.advanceTimersByTime(600)
    expect(vm.keysList[0].activeFlash).toBe(false)
    expect(vm.keysList[1].activeFlash).toBe(false)
    
    // Simulate dragenter on the same index (should do nothing)
    vm.dragEnter(1)
    expect(vm.keysList[0].value).toBe('k2')
    expect(vm.keysList[1].value).toBe('k1')
    
    // Simulate dragend
    vm.dragEnd()
    expect(vm.draggedIndex).toBeNull()

    vi.useRealTimers()
  })

  it('tracks hasUnsavedChanges when keys list is modified, added, or saved', async () => {
    mockEnvConfig = '[{"title":"First","value":"k1"}]'
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    await flushPromises()
    const vm = wrapper.vm as any
    
    // Initial state: no unsaved changes
    expect(vm.hasUnsavedChanges).toBe(false)
    
    // Add key: has unsaved changes
    vm.addKey()
    expect(vm.hasUnsavedChanges).toBe(true)
    
    // Remove the added key: back to no unsaved changes
    vm.removeKey(1)
    expect(vm.hasUnsavedChanges).toBe(false)
    
    // Modify existing key value: has unsaved changes
    vm.keysList[0].value = 'k1_modified'
    expect(vm.hasUnsavedChanges).toBe(true)
    
    // Save: back to no unsaved changes
    await vm.saveApiKeys()
    expect(vm.hasUnsavedChanges).toBe(false)
  })

  it('prevents rapid double-swap glitch loops of the same elements', async () => {
    mockEnvConfig = '[{"title":"First","value":"k1"},{"title":"Second","value":"k2"}]'
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    await flushPromises()
    const vm = wrapper.vm as any
    
    vi.useFakeTimers()
    
    // Start drag on index 0
    vm.dragStart(0, { dataTransfer: { effectAllowed: '', setData: vi.fn() } } as any)
    
    // First swap: enter index 1
    vm.dragEnter(1)
    expect(vm.keysList[0].value).toBe('k2')
    expect(vm.keysList[1].value).toBe('k1')
    
    // Rapid swap back: immediate dragenter on index 0 (within 50ms)
    vi.advanceTimersByTime(50)
    vm.dragEnter(0)
    // Should NOT swap back yet due to the rapid-swap cooldown
    expect(vm.keysList[0].value).toBe('k2')
    expect(vm.keysList[1].value).toBe('k1')
    
    // Swap back after cooldown: dragenter on index 0 after 200ms total (50ms + 150ms)
    vi.advanceTimersByTime(150)
    vm.dragEnter(0)
    // Should now successfully swap back
    expect(vm.keysList[0].value).toBe('k1')
    expect(vm.keysList[1].value).toBe('k2')
    
    vi.useRealTimers()
  })

  it('initializes default active tab to health and handles switchTab properly', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    const vm = wrapper.vm as any
    expect(vm.activeTab).toBe('health')
    expect(vm.sections.length).toBe(5)

    // Switch to API tab
    vm.switchTab('api')
    expect(vm.activeTab).toBe('api')

    // Switch to Whisper tab
    vm.switchTab('whisper')
    expect(vm.activeTab).toBe('whisper')

    // Switch to Cookies tab
    vm.switchTab('cookies')
    expect(vm.activeTab).toBe('cookies')

    // Switch to Env tab
    vm.switchTab('env')
    expect(vm.activeTab).toBe('env')
  })

  it('syncs active tab when settingsScrollTarget changes', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })
    
    const vm = wrapper.vm as any
    expect(vm.activeTab).toBe('health')

    // Trigger settingsScrollTarget update (e.g. from alert banner)
    mockSettingsScrollTarget.value = 'settings-api'
    await wrapper.vm.$nextTick()
    await flushPromises()

    expect(vm.activeTab).toBe('api')
    expect(mockSettingsScrollTarget.value).toBeNull()
  })
})
