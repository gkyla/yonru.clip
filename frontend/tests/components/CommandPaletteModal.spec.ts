import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CommandPaletteModal from '~/components/CommandPaletteModal.vue'
import { useCommandPalette } from '~/composables/useCommandPalette'

const pushSpy = vi.fn().mockResolvedValue(true)
vi.stubGlobal('useRouter', () => ({
  push: pushSpy
}))

vi.mock('#imports', () => ({
  useRouter: () => ({
    push: pushSpy
  })
}))

const mockActiveSafeZone = ref<'none' | 'tiktok' | 'reels' | 'shorts'>('none')
const mockIsOverlayVisible = ref(false)
const mockShowToast = vi.fn()
const mockCachedVideos = ref<any[]>([
  { video_id: 'vid-1', title: 'Vue & Nuxt Tutorial', duration: 120, folder_name: 'vid-1' }
])
const mockSavedHooks = ref<any[]>([
  { id: 'hook-1', theme: 'Amazing Hook Moment', start: 10, end: 40, virality_score: 95 }
])
const mockHooks = ref<any[]>([])
const mockPromptsList = ref<any[]>([])

vi.mock('~/composables/useClipperState', () => ({
  useClipperState: () => ({
    activeSafeZone: mockActiveSafeZone,
    isOverlayVisible: mockIsOverlayVisible,
    showToast: mockShowToast,
    cachedVideos: mockCachedVideos,
    savedHooks: mockSavedHooks,
    hooks: mockHooks,
    promptsList: mockPromptsList,
    activeHook: ref(null),
    extractionMode: ref('preset'),
    selectedPresetId: ref('auto'),
    selectedPrompt: ref('prompt.json'),
    folderName: ref(null),
    videoTitle: ref(''),
    videoDuration: ref(0)
  })
}))

describe('CommandPaletteModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const palette = useCommandPalette()
    palette.close()
  })

  it('renders nothing when palette is closed', () => {
    const wrapper = mount(CommandPaletteModal, {
      global: {
        stubs: {
          Teleport: true,
          Icon: { template: '<span class="icon-stub" />' },
          NuxtIcon: { template: '<span class="nuxt-icon-stub" />' }
        }
      }
    })

    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('renders modal search input and results when palette is open', async () => {
    const palette = useCommandPalette()
    palette.open()

    const wrapper = mount(CommandPaletteModal, {
      global: {
        stubs: {
          Teleport: true,
          Icon: { template: '<span class="icon-stub" />' },
          NuxtIcon: { template: '<span class="nuxt-icon-stub" />' }
        }
      }
    })

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    expect(wrapper.text()).toContain('Navigation')
    expect(wrapper.text()).toContain('Settings')
    expect(wrapper.text()).toContain('Prompt Templates')
  })

  it('filters results interactively on typing', async () => {
    const palette = useCommandPalette()
    palette.open()

    const wrapper = mount(CommandPaletteModal, {
      global: {
        stubs: {
          Teleport: true,
          Icon: { template: '<span class="icon-stub" />' },
          NuxtIcon: { template: '<span class="nuxt-icon-stub" />' }
        }
      }
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('Whisper')

    expect(wrapper.text()).toContain('Whisper Transcription Engine')
    expect(wrapper.text()).not.toContain('AI Prompts Library')
  })

  it('shows empty state when no results match', async () => {
    const palette = useCommandPalette()
    palette.open()

    const wrapper = mount(CommandPaletteModal, {
      global: {
        stubs: {
          Teleport: true,
          Icon: { template: '<span class="icon-stub" />' },
          NuxtIcon: { template: '<span class="nuxt-icon-stub" />' }
        }
      }
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('xyz non existing query 12345')

    expect(wrapper.text()).toContain('No matching results found')
  })

  it('executes item when clicked and triggers navigation', async () => {
    const palette = useCommandPalette()
    palette.open()

    const wrapper = mount(CommandPaletteModal, {
      global: {
        stubs: {
          Teleport: true,
          Icon: { template: '<span class="icon-stub" />' },
          NuxtIcon: { template: '<span class="nuxt-icon-stub" />' }
        }
      }
    })

    const navItem = wrapper.findAll('[data-item-id]').find(el => el.text().includes('System Settings'))
    expect(navItem).toBeDefined()

    await navItem!.trigger('click')
    expect(pushSpy).toHaveBeenCalledWith('/settings')
    expect(palette.isOpen.value).toBe(false)
  })
})
