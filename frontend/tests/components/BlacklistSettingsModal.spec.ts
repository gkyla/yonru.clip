import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import BlacklistSettings from '../../app/components/BlacklistSettings.vue'

const mockCustomBlacklist = ref<string[]>([])
const mockCustomWhitelist = ref<string[]>([])
const mockSafetySensitivity = ref<'strict' | 'standard' | 'manual'>('standard')
const mockSaveBlacklistToStorage = vi.fn()

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    customBlacklist: mockCustomBlacklist,
    customWhitelist: mockCustomWhitelist,
    safetySensitivity: mockSafetySensitivity,
    maskingStyle: ref('asterisk'),
    audioBleepEnabled: ref(false),
    audioBleepSource: ref('mute'),
    bleepLibrary: ref([
      {
        id: 'default_preset',
        name: 'Standard Bleep',
        data: '/audio/bleep.wav',
        isPreset: true
      }
    ]),
    selectedBleepAudioId: ref('default_preset'),
    customBleepFile: ref(null),
    bleepPaddingOffset: ref(0),
    isWarningIgnored: ref(false),
    activeCategories: ref({ violence: true, sexual: true, profanity: true }),
    activePlatformFilters: ref({ tiktok: true, reels: true, shorts: true }),
    categorizedBlacklist: ref({
      violence: ['kill', 'death'],
      sexual: ['porn'],
      profanity: ['f*ck']
    }),
    saveBlacklistToStorage: mockSaveBlacklistToStorage,
    loadBlacklistFromStorage: vi.fn(),
    selectBleepAudio: vi.fn(),
    addCustomBleepFile: vi.fn(),
    removeCustomBleepFile: vi.fn()
  })
}))

describe('BlacklistSettings Component - Modal Navigation and Multi-Word Input', () => {
  beforeEach(() => {
    mockCustomBlacklist.value = []
    mockCustomWhitelist.value = []
    mockSafetySensitivity.value = 'standard'
    mockSaveBlacklistToStorage.mockClear()
  })

  it('renders top-level tabs and switches content correctly', async () => {
    const wrapper = mount(BlacklistSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    // Initially in General tab
    expect(wrapper.text()).toContain('Safety Filter Scope')
    expect(wrapper.text()).toContain('Auto-Fix Masking Style')

    // Find tab buttons
    const tabButtons = wrapper.findAll('button[type="button"]')
    const categoriesTab = tabButtons.find(b => b.text().includes('Categories'))
    expect(categoriesTab).toBeDefined()
    await categoriesTab!.trigger('click')

    expect(wrapper.text()).toContain('Kategori Aktif')
    expect(wrapper.text()).toContain('violence')

    const blacklistTab = tabButtons.find(b => b.text().includes('Blacklist'))
    expect(blacklistTab).toBeDefined()
    await blacklistTab!.trigger('click')

    expect(
      wrapper.find('input[placeholder*="Tambah kata kustom"]').exists()
    ).toBe(true)
    expect(wrapper.text()).toContain('Total Kustom')
  })

  it('switches Safety Filter Scope and calls saveBlacklistToStorage', async () => {
    const wrapper = mount(BlacklistSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const buttons = wrapper.findAll('button')
    const strictBtn = buttons.find(b => b.text() === 'Strict')
    expect(strictBtn).toBeDefined()

    await strictBtn!.trigger('click')
    expect(mockSafetySensitivity.value).toBe('strict')
    expect(mockSaveBlacklistToStorage).toHaveBeenCalled()

    const customOnlyBtn = buttons.find(b => b.text() === 'Custom Only')
    expect(customOnlyBtn).toBeDefined()

    await customOnlyBtn!.trigger('click')
    expect(mockSafetySensitivity.value).toBe('manual')
    expect(mockSaveBlacklistToStorage).toHaveBeenCalled()
  })

  it('supports comma-separated multi-word entry for custom blacklist', async () => {
    const wrapper = mount(BlacklistSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    // Switch to blacklist tab
    const tabButtons = wrapper.findAll('button[type="button"]')
    const blacklistTab = tabButtons.find(b => b.text().includes('Blacklist'))
    await blacklistTab!.trigger('click')

    const input = wrapper.find('input[placeholder*="Tambah kata kustom"]')
    expect(input.exists()).toBe(true)

    // Type comma-separated words
    await input.setValue('judi, slot, gacor')
    const addBtn = wrapper.findAll('button').find(b => b.text() === 'Add')
    expect(addBtn).toBeDefined()
    await addBtn!.trigger('click')

    expect(mockCustomBlacklist.value).toEqual(['judi', 'slot', 'gacor'])
    expect(mockSaveBlacklistToStorage).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Total Kustom: 3 kata')
  })

  it('emits close event when close button or Escape key is triggered', async () => {
    const wrapper = mount(BlacklistSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    })

    const closeBtn = wrapper.find('button[aria-label="Close settings"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()

    // Test Escape keydown on window
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(escEvent)
    expect(wrapper.emitted('close')!.length).toBe(2)
  })
})
