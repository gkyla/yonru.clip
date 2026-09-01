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

  it('aggregates navigation, settings (5 preferences tabs), and prompt presets', () => {
    const palette = useCommandPalette()
    const items = palette.allItems.value

    expect(items.some(i => i.id === 'nav-home')).toBe(true)
    expect(items.some(i => i.id === 'nav-prompts')).toBe(true)
    expect(items.some(i => i.id === 'nav-docs')).toBe(true)
    expect(items.some(i => i.id === 'nav-changelog')).toBe(true)
    expect(items.some(i => i.id === 'nav-settings')).toBe(true)
    expect(items.some(i => i.id === 'setting-health')).toBe(true)
    expect(items.some(i => i.id === 'setting-api')).toBe(true)
    expect(items.some(i => i.id === 'setting-whisper')).toBe(true)
    expect(items.some(i => i.id === 'setting-cookies')).toBe(true)
    expect(items.some(i => i.id === 'setting-env')).toBe(true)
    expect(items.some(i => i.id === 'prompt-preset-auto')).toBe(true)
  })

  it('groups prompts under Prompt Template parent category with Preset Prompt and Custom Prompt subgroups in groupedItems', () => {
    mockPromptsList.value = [
      { id: 'custom_tech.json', name: 'Tech Deep Dive', suitableFor: ['podcasts'] }
    ]

    const palette = useCommandPalette()
    palette.open()

    const groups = palette.groupedItems.value
    const promptGroup = groups.find(g => g.key === 'prompts')

    expect(promptGroup).toBeDefined()
    expect(promptGroup?.label).toBe('Prompt Template')
    expect(promptGroup?.subgroups).toBeDefined()
    expect(promptGroup?.subgroups?.length).toBe(2)

    const presetSubgroup = promptGroup?.subgroups?.find(sg => sg.key === 'presets')
    const customSubgroup = promptGroup?.subgroups?.find(sg => sg.key === 'custom')

    expect(presetSubgroup).toBeDefined()
    expect(presetSubgroup?.label).toBe('Preset Prompt')
    expect(presetSubgroup?.items.some(i => i.id === 'prompt-preset-auto')).toBe(true)

    expect(customSubgroup).toBeDefined()
    expect(customSubgroup?.label).toBe('Custom Prompt')
    expect(customSubgroup?.items.some(i => i.id === 'custom-prompt-custom_tech.json')).toBe(true)
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

    palette.searchQuery.value = 'cookies'
    expect(palette.filteredItems.value.some(i => i.id === 'setting-cookies')).toBe(true)

    palette.searchQuery.value = 'settings'
    expect(palette.filteredItems.value.some(i => i.id === 'nav-settings' || i.id === 'setting-health')).toBe(true)
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

  it('routes to the matching tab when selecting a settings preference item', () => {
    const palette = useCommandPalette()
    palette.open()

    const cookiesItem = palette.allItems.value.find(i => i.id === 'setting-cookies')
    expect(cookiesItem).toBeDefined()

    palette.executeItem(cookiesItem!)
    expect(pushSpy).toHaveBeenCalledWith({ path: '/settings', query: { tab: 'cookies' } })
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

  it('prefetches larger batch of cached videos when open() is called', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      videos: [
        { video_id: 'vid-batch-1', title: 'Batch Video 1', duration: 120, folder_name: 'vid-batch-1' },
        { video_id: 'vid-batch-2', title: 'Batch Video 2', duration: 240, folder_name: 'vid-batch-2' }
      ],
      total: 2
    })
    vi.stubGlobal('$fetch', mockFetch)

    const palette = useCommandPalette()
    palette.open()

    await palette.fetchPaletteCachedVideos()

    expect(palette.paletteCachedVideos.value.length).toBeGreaterThanOrEqual(2)
    expect(palette.allItems.value.some(i => i.id === 'cached-video-vid-batch-1')).toBe(true)
    expect(palette.allItems.value.some(i => i.id === 'cached-video-vid-batch-2')).toBe(true)
  })

  it('fetches remote search results when user searches for an un-cached video', async () => {
    const mockFetch = vi.fn().mockImplementation((url, opts) => {
      if (opts?.params?.search === 'quantum') {
        return Promise.resolve({
          videos: [
            { video_id: 'vid-quantum-99', title: 'Quantum Computing Explained', duration: 450, folder_name: 'vid-quantum-99' }
          ],
          total: 1
        })
      }
      return Promise.resolve({ videos: [], total: 0 })
    })
    vi.stubGlobal('$fetch', mockFetch)

    const palette = useCommandPalette()
    palette.open()

    await palette.fetchPaletteCachedVideos('quantum')

    expect(palette.allItems.value.some(i => i.id === 'cached-video-vid-quantum-99')).toBe(true)
    palette.searchQuery.value = 'quantum'
    expect(palette.filteredItems.value.some(i => i.id === 'cached-video-vid-quantum-99')).toBe(true)
  })
})
