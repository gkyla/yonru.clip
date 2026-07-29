import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import BlacklistSettings from '../../app/components/BlacklistSettings.vue'

const mockAudioBleepEnabled = ref(false)
const mockAudioBleepSource = ref('mute')
const mockBleepLibrary = ref([
  { id: 'default_preset', name: 'Standard Bleep', data: '/audio/bleep.wav', isPreset: true }
])
const mockSelectedBleepAudioId = ref('default_preset')
const mockCustomBleepFile = ref<any>({ name: 'Standard Bleep', data: '/audio/bleep.wav' })

// Mock useClipperState
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    customBlacklist: ref([]),
    customWhitelist: ref([]),
    safetySensitivity: ref('standard'),
    maskingStyle: ref('asterisk'),
    audioBleepEnabled: mockAudioBleepEnabled,
    audioBleepSource: mockAudioBleepSource,
    bleepLibrary: mockBleepLibrary,
    selectedBleepAudioId: mockSelectedBleepAudioId,
    customBleepFile: mockCustomBleepFile,
    bleepPaddingOffset: ref(50),
    isWarningIgnored: ref(false),
    activeCategories: ref({ violence: true, sexual: true, profanity: true }),
    activePlatformFilters: ref({ tiktok: true, reels: true, shorts: true }),
    categorizedBlacklist: ref({ violence: ['kill'], sexual: ['porn'], profanity: ['f*ck'] }),
    saveBlacklistToStorage: vi.fn(),
    loadBlacklistFromStorage: vi.fn(),
    selectBleepAudio: (id: string) => { mockSelectedBleepAudioId.value = id },
    addCustomBleepFile: (file: any) => {
      const item = { id: 'custom_123', name: file.name, data: file.data, isPreset: false }
      mockBleepLibrary.value.push(item)
      mockSelectedBleepAudioId.value = item.id
      return item
    },
    removeCustomBleepFile: (id: string) => {
      mockBleepLibrary.value = mockBleepLibrary.value.filter(i => i.id !== id)
      mockSelectedBleepAudioId.value = 'default_preset'
    }
  })
}))

describe('BlacklistSettings Component - Custom Bleep Audio Options', () => {
  beforeEach(() => {
    mockAudioBleepEnabled.value = false
    mockAudioBleepSource.value = 'mute'
    mockBleepLibrary.value = [
      { id: 'default_preset', name: 'Standard Bleep', data: '/audio/bleep.wav', isPreset: true }
    ]
    mockSelectedBleepAudioId.value = 'default_preset'
  })

  it('renders bleep audio options only when bleep enabled checkbox is checked', async () => {
    const wrapper = mount(BlacklistSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    // Assert custom bleep settings container is not rendered initially
    expect(wrapper.text()).not.toContain('Bleep Sound Type')

    // Set audioBleepEnabled to true
    mockAudioBleepEnabled.value = true
    await wrapper.vm.$nextTick()

    // Assert bleep sound type section is now visible
    expect(wrapper.text()).toContain('Bleep Sound Type')
  })

  it('toggles custom bleep source selection and displays bleep audio library', async () => {
    const wrapper = mount(BlacklistSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    // Enable bleep
    mockAudioBleepEnabled.value = true
    await wrapper.vm.$nextTick()

    // Set bleep source to custom
    mockAudioBleepSource.value = 'custom'
    await wrapper.vm.$nextTick()

    // Upload button and default preset should be visible in library
    expect(wrapper.text()).toContain('Upload Custom Sound')
    expect(wrapper.text()).toContain('Standard Bleep')
    expect(wrapper.text()).toContain('Default Preset')

    // Mock adding custom file
    mockBleepLibrary.value.push({
      id: 'custom_123',
      name: 'beep.mp3',
      data: 'data:audio/mp3;base64,AAAA',
      isPreset: false
    })
    mockSelectedBleepAudioId.value = 'custom_123'
    await wrapper.vm.$nextTick()

    // Assert custom beep file details are displayed in library
    expect(wrapper.text()).toContain('beep.mp3')
    expect(wrapper.text()).toContain('Custom Upload')
  })
})
