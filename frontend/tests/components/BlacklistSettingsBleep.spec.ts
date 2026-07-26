import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import BlacklistSettings from '../../app/components/BlacklistSettings.vue'

const mockAudioBleepEnabled = ref(false)
const mockAudioBleepSource = ref('mute')
const mockCustomBleepFile = ref<any>(null)

// Mock useClipperState
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    customBlacklist: ref([]),
    customWhitelist: ref([]),
    safetySensitivity: ref('standard'),
    maskingStyle: ref('asterisk'),
    audioBleepEnabled: mockAudioBleepEnabled,
    audioBleepSource: mockAudioBleepSource,
    customBleepFile: mockCustomBleepFile,
    bleepPaddingOffset: ref(50),
    isWarningIgnored: ref(false),
    activeCategories: ref({ violence: true, sexual: true, profanity: true }),
    activePlatformFilters: ref({ tiktok: true, reels: true, shorts: true }),
    categorizedBlacklist: ref({ violence: ['kill'], sexual: ['porn'], profanity: ['f*ck'] }),
    saveBlacklistToStorage: vi.fn(),
    loadBlacklistFromStorage: vi.fn()
  })
}))

describe('BlacklistSettings Component - Custom Bleep Audio Options', () => {
  beforeEach(() => {
    mockAudioBleepEnabled.value = false
    mockAudioBleepSource.value = 'mute'
    mockCustomBleepFile.value = null
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

  it('toggles custom bleep source selection and shows file upload area', async () => {
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

    // Upload placeholder should be visible
    expect(wrapper.text()).toContain('Upload Bleep Sound')

    // Mock upload file
    mockCustomBleepFile.value = {
      name: 'beep.mp3',
      data: 'data:audio/mp3;base64,AAAA'
    }
    await wrapper.vm.$nextTick()

    // Assert custom beep file details are displayed
    expect(wrapper.text()).toContain('beep.mp3')
    expect(wrapper.text()).toContain('Custom Beep Configured')
  })
})
