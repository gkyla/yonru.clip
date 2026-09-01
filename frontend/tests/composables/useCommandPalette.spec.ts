import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useCommandPalette } from '~/composables/useCommandPalette'

const pushSpy = vi.fn().mockResolvedValue(true)
vi.stubGlobal('useRouter', () => ({
  push: pushSpy
}))

const mockActiveSafeZone = ref<'none' | 'tiktok' | 'reels' | 'shorts'>('none')
const mockIsOverlayVisible = ref(false)
const mockShowToast = vi.fn()
const mockAnalyzeCached = vi.fn().mockResolvedValue(true)
const mockCachedVideos = ref<any[]>([])
const mockSavedHooks = ref<any[]>([])
const mockHooks = ref<any[]>([])
const mockPromptsList = ref<any[]>([])
const mockActiveHook = ref<any>(null)
const mockExtractionMode = ref('preset')
const mockSelectedPresetId = ref('auto')
const mockSelectedPrompt = ref('prompt.json')

vi.mock('~/composables/useClipperState', () => ({
  useClipperState: () => ({
    activeSafeZone: mockActiveSafeZone,
    isOverlayVisible: mockIsOverlayVisible,
    showToast: mockShowToast,
    analyzeCached: mockAnalyzeCached,
    cachedVideos: mockCachedVideos,
    savedHooks: mockSavedHooks,
    hooks: mockHooks,
    promptsList: mockPromptsList,
    activeHook: mockActiveHook,
    extractionMode: mockExtractionMode,
    selectedPresetId: mockSelectedPresetId,
    selectedPrompt: mockSelectedPrompt,
    folderName: ref(null),
    videoTitle: ref(''),
    videoDuration: ref(0)
  })
}))

describe('useCommandPalette Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveSafeZone.value = 'none'
    mockIsOverlayVisible.value = false
    mockCachedVideos.value = []
    mockSavedHooks.value = []
    mockHooks.value = []
    mockPromptsList.value = []
  })

  it('manages open, close, and toggle states properly', () => {
    const palette = useCommandPalette()
    palette.close()
    expect(palette.isOpen.value).toBe(false)

    palette.open()
    expect(palette.isOpen.value).toBe(true)

    palette.toggle()
    expect(palette.isOpen.value).toBe(false)

    palette.toggle()
    expect(palette.isOpen.value).toBe(true)
  })

  it('aggregates navigation, settings, and prompt presets', () => {
    const palette = useCommandPalette()
    const items = palette.allItems.value

    expect(items.some(i => i.id === 'nav-home')).toBe(true)
    expect(items.some(i => i.id === 'nav-settings')).toBe(true)
    expect(items.some(i => i.id === 'setting-whisper')).toBe(true)
    expect(items.some(i => i.id === 'setting-api')).toBe(true)
    expect(items.some(i => i.id === 'prompt-preset-auto')).toBe(true)
  })

  it('filters items correctly on search query matching title and keywords', () => {
    const palette = useCommandPalette()
    palette.open()

    palette.searchQuery.value = 'whisper'
    expect(palette.filteredItems.value.some(i => i.id === 'setting-whisper')).toBe(true)
    expect(palette.filteredItems.value.every(i => 
      i.title.toLowerCase().includes('whisper') || 
      i.subtitle?.toLowerCase().includes('whisper') ||
      i.keywords?.some(k => k.toLowerCase().includes('whisper'))
    )).toBe(true)

    palette.searchQuery.value = 'settings'
    expect(palette.filteredItems.value.some(i => i.id === 'nav-settings' || i.id === 'setting-diagnostics')).toBe(true)
  })

  it('navigates selected index up and down with wrapping', () => {
    const palette = useCommandPalette()
    palette.open()
    palette.searchQuery.value = ''

    palette.selectedIndex.value = 0
    palette.selectNext()
    expect(palette.selectedIndex.value).toBe(1)

    palette.selectPrev()
    expect(palette.selectedIndex.value).toBe(0)

    palette.selectPrev()
    expect(palette.selectedIndex.value).toBe(palette.filteredItems.value.length - 1)
  })

  it('executes item handler and closes palette on selection', () => {
    const palette = useCommandPalette()
    palette.open()

    const navSettings = palette.allItems.value.find(i => i.id === 'nav-settings')
    expect(navSettings).toBeDefined()

    palette.executeItem(navSettings!)
    expect(pushSpy).toHaveBeenCalledWith('/settings')
    expect(palette.isOpen.value).toBe(false)
  })

  it('triggers analyzeCached and routes to home when selecting a cached source video', async () => {
    mockCachedVideos.value = [
      { video_id: 'vid-tech-101', title: 'Tech Talk Episode 1', duration: 300, folder_name: 'vid-tech-101' }
    ]

    const palette = useCommandPalette()
    palette.open()

    const cachedVideoItem = palette.allItems.value.find(i => i.id === 'cached-video-vid-tech-101')
    expect(cachedVideoItem).toBeDefined()
    expect(cachedVideoItem?.actionLabel).toBe('Load Hooks')

    await palette.executeItem(cachedVideoItem!)
    expect(pushSpy).toHaveBeenCalledWith('/')
    expect(mockAnalyzeCached).toHaveBeenCalledWith('vid-tech-101', false)
    expect(mockShowToast).toHaveBeenCalledWith('Loading cached hooks for "Tech Talk Episode 1"...', 'info')
    expect(palette.isOpen.value).toBe(false)
  })
})
