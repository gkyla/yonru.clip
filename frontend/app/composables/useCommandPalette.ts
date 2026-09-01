import { ref, computed, watch } from 'vue'
import type { CommandPaletteItem, CommandPaletteCategory, CommandPaletteGroup, Hook, CachedVideo } from '../types/clipper'
import { useClipperState } from './useClipperState'

let cachedCommandPalette: ReturnType<typeof createCommandPaletteState> | null = null

export const useCommandPalette = () => {
  if (import.meta.server) {
    return createCommandPaletteState()
  }

  if (!cachedCommandPalette) {
    cachedCommandPalette = createCommandPaletteState()
  }
  return cachedCommandPalette
}

function createCommandPaletteState() {
  const isOpen = ref(false)
  const searchQuery = ref('')
  const selectedIndex = ref(0)
  const activeCategoryFilter = ref<CommandPaletteCategory | 'all'>('all')
  const paletteCachedVideos = ref<CachedVideo[]>([])
  const isPaletteCachedLoading = ref(false)

  const state = useClipperState()
  let searchDebounceTimer: any = null
  let activeRequestId = 0

  async function safeFetch<T>(url: string, opts?: any): Promise<T> {
    try {
      if (typeof $fetch === 'function') {
        return await $fetch<T>(url, opts)
      }
    } catch {}
    try {
      if (typeof (globalThis as any).$fetch === 'function') {
        return await (globalThis as any).$fetch(url, opts)
      }
    } catch {}
    return { videos: [], total: 0 } as any
  }

  async function fetchPaletteCachedVideos(searchQueryParam?: string) {
    const reqId = ++activeRequestId
    isPaletteCachedLoading.value = true
    try {
      const q = (searchQueryParam ?? '').trim()
      const queryParams: Record<string, any> = {
        limit: q ? 30 : 100,
        sort_by: 'date',
        order: 'desc'
      }
      if (q) {
        queryParams.search = q
      }

      const res = await safeFetch<{ videos: CachedVideo[], total: number }>(
        'http://localhost:8000/api/cached',
        { params: queryParams }
      )

      if (reqId !== activeRequestId) return

      if (res && Array.isArray(res.videos)) {
        const existingMap = new Map<string, CachedVideo>()
        for (const v of paletteCachedVideos.value) {
          const id = v.video_id || v.folder_name
          if (id) existingMap.set(id, v)
        }
        if (state.cachedVideos && state.cachedVideos.value) {
          for (const v of state.cachedVideos.value) {
            const id = v.video_id || v.folder_name
            if (id && !existingMap.has(id)) existingMap.set(id, v)
          }
        }
        for (const v of res.videos) {
          const id = v.video_id || v.folder_name
          if (id) existingMap.set(id, v)
        }

        paletteCachedVideos.value = Array.from(existingMap.values())
      }
    } catch (e) {
      // safe fallback
    } finally {
      if (reqId === activeRequestId) {
        isPaletteCachedLoading.value = false
      }
    }
  }

  function useSafeRouter() {
    try {
      const r = useRouter()
      if (r && typeof r.push === 'function') return r
    } catch {}
    try {
      if (typeof (globalThis as any).useRouter === 'function') {
        return (globalThis as any).useRouter()
      }
    } catch {}
    return { push: async () => true }
  }

  const router = useSafeRouter()

  function open() {
    isOpen.value = true
    searchQuery.value = ''
    selectedIndex.value = 0
    activeCategoryFilter.value = 'all'

    if (paletteCachedVideos.value.length === 0 && state.cachedVideos && state.cachedVideos.value) {
      paletteCachedVideos.value = [...state.cachedVideos.value]
    }
    fetchPaletteCachedVideos()
  }

  function close() {
    isOpen.value = false
    searchQuery.value = ''
    selectedIndex.value = 0
  }

  function toggle() {
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }

  watch(searchQuery, (newVal) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    const q = (newVal || '').trim()
    if (q.length >= 2) {
      searchDebounceTimer = setTimeout(() => {
        fetchPaletteCachedVideos(q)
      }, 250)
    }
  })

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Generate all searchable items dynamically
  const allItems = computed<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = []

    // 1. NAVIGATION
    items.push({
      id: 'nav-home',
      title: 'Home & Video Analyzer',
      subtitle: 'Main dashboard for video ingestion & hook detection',
      category: 'navigation',
      icon: 'lucide:home',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['home', 'main', 'dashboard', 'analyzer', 'ingest'],
      handler: () => {
        close()
        router.push('/')
      }
    })

    items.push({
      id: 'nav-prompts',
      title: 'AI Prompts Library',
      subtitle: 'Manage viral prompt templates and custom instructions',
      category: 'navigation',
      icon: 'lucide:sparkles',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['prompts', 'prompt', 'templates', 'ai', 'custom', 'presets'],
      handler: () => {
        close()
        router.push('/prompts')
      }
    })

    items.push({
      id: 'nav-docs',
      title: 'Documentation',
      subtitle: 'User guide, system architecture, and tutorials',
      category: 'navigation',
      icon: 'lucide:book-open',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['docs', 'documentation', 'guide', 'help', 'tutorial', 'manual'],
      handler: () => {
        close()
        router.push('/docs')
      }
    })

    items.push({
      id: 'nav-changelog',
      title: 'Changelog',
      subtitle: 'Version history, release notes, and latest updates',
      category: 'navigation',
      icon: 'lucide:history',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['changelog', 'release', 'notes', 'updates', 'history', 'version', 'whatsnew'],
      handler: () => {
        close()
        router.push('/changelog')
      }
    })

    items.push({
      id: 'nav-settings',
      title: 'System Settings',
      subtitle: 'Configure AI providers, transcription engine, and hardware',
      category: 'navigation',
      icon: 'lucide:settings',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['settings', 'preferences', 'config', 'hardware', 'setup'],
      handler: () => {
        close()
        router.push('/settings')
      }
    })

    items.push({
      id: 'nav-editor',
      title: 'Video & Subtitle Editor',
      subtitle: 'Multi-track timeline, typography presets, and reframing',
      category: 'navigation',
      icon: 'lucide:clapperboard',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['editor', 'timeline', 'subtitles', 'canvas', 'tracks', 'render'],
      handler: () => {
        close()
        router.push('/editor')
      }
    })

    // 3. SETTINGS PREFERENCES SECTIONS (1:1 with /settings tabs)
    items.push({
      id: 'setting-health',
      title: 'System Health & Diagnostics',
      subtitle: 'Verify FFmpeg, Node.js, Python, and Gemini API prerequisites',
      category: 'settings',
      icon: 'lucide:activity',
      badge: 'Setting',
      actionLabel: 'Inspect',
      keywords: ['health', 'diagnostics', 'system', 'ffmpeg', 'node', 'python', 'prerequisites', 'status', 'hardware'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'health' } })
      }
    })

    items.push({
      id: 'setting-api',
      title: 'Gemini API Keys',
      subtitle: 'Key pool & failover management for AI transcript analysis',
      category: 'settings',
      icon: 'lucide:key',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['api', 'keys', 'gemini', 'google', 'key pool', 'failover', 'token', 'ai'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'api' } })
      }
    })

    items.push({
      id: 'setting-whisper',
      title: 'Whisper Engine',
      subtitle: 'Configure local speech-to-text model tier (tiny, base, small, medium, large-v3)',
      category: 'settings',
      icon: 'lucide:cpu',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['whisper', 'transcription', 'engine', 'speech', 'audio', 'stt', 'model', 'subtitles'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'whisper' } })
      }
    })

    items.push({
      id: 'setting-cookies',
      title: 'YouTube Cookies',
      subtitle: 'Upload yt-dlp authorization file to bypass download limits & bot verification',
      category: 'settings',
      icon: 'lucide:cookie',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['cookies', 'youtube', 'yt-dlp', 'authorization', 'cookies.txt', 'download', 'bypass', 'rate limit'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'cookies' } })
      }
    })

    items.push({
      id: 'setting-env',
      title: 'Environment Paths',
      subtitle: 'Custom binary and executable directory paths stored locally in .env',
      category: 'settings',
      icon: 'lucide:terminal',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['env', 'paths', 'binaries', 'environment', 'ffmpeg path', 'node path', 'configuration'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'env' } })
      }
    })

    // 4. PROMPT TEMPLATES
    const defaultPrompts = [
      {
        id: 'prompt-preset-auto',
        name: 'Auto AI Viral Hook Detector',
        desc: 'Balanced viral moments detection with high audience retention',
        presetId: 'auto' as const,
        icon: 'lucide:sparkles'
      },
      {
        id: 'prompt-preset-humor',
        name: 'Humor & Funny Moments',
        desc: 'Focuses on jokes, hilarious reactions, and comedic punchlines',
        presetId: 'humor' as const,
        icon: 'lucide:smile'
      },
      {
        id: 'prompt-preset-educational',
        name: 'Educational & Actionable Tips',
        desc: 'Highlights lessons, insightful advice, and intellectual takeaways',
        presetId: 'educational' as const,
        icon: 'lucide:graduation-cap'
      },
      {
        id: 'prompt-preset-storytelling',
        name: 'Storytelling & Narratives',
        desc: 'Captures suspenseful stories, emotional beats, and narratives',
        presetId: 'storytelling' as const,
        icon: 'lucide:book-open'
      },
      {
        id: 'prompt-preset-debate',
        name: 'Debates & Polarized Discussions',
        desc: 'Extracts heated discussions, controversial takes, and arguments',
        presetId: 'debate' as const,
        icon: 'lucide:flame'
      }
    ]

    for (const p of defaultPrompts) {
      items.push({
        id: p.id,
        title: p.name,
        subtitle: p.desc,
        category: 'prompts',
        subcategory: 'preset',
        groupLabel: 'Preset Prompt',
        icon: p.icon,
        badge: 'Preset',
        actionLabel: 'Apply',
        keywords: ['prompt', 'preset', 'hook', 'template', p.presetId, ...p.name.toLowerCase().split(' ')],
        handler: () => {
          state.extractionMode.value = 'preset'
          state.selectedPresetId.value = p.presetId
          state.selectedPrompt.value = 'prompt.json'
          state.showToast(`Applied preset: ${p.name}`, 'success')
          close()
          router.push('/')
        }
      })
    }

    // Dynamic custom prompts from state
    if (state.promptsList.value && Array.isArray(state.promptsList.value)) {
      for (const customP of state.promptsList.value) {
        if (customP.id && customP.name && !items.some(i => i.id === `custom-prompt-${customP.id}`)) {
          items.push({
            id: `custom-prompt-${customP.id}`,
            title: customP.name,
            subtitle: `Custom prompt template (${customP.id})`,
            category: 'prompts',
            subcategory: 'custom',
            groupLabel: 'Custom Prompt',
            icon: 'lucide:file-text',
            badge: 'Custom',
            actionLabel: 'Apply',
            keywords: ['prompt', 'custom', 'template', ...customP.name.toLowerCase().split(' ')],
            handler: () => {
              state.extractionMode.value = 'custom'
              state.selectedPrompt.value = customP.id
              state.showToast(`Applied custom template: ${customP.name}`, 'success')
              close()
              router.push('/')
            }
          })
        }
      }
    }

    // 5. CACHED VIDEOS
    const sourceVideosList = paletteCachedVideos.value.length > 0
      ? paletteCachedVideos.value
      : (state.cachedVideos?.value || [])

    const seenVideoIds = new Set<string>()
    for (const vid of sourceVideosList) {
      const videoId = vid.video_id || vid.folder_name
      if (videoId && !seenVideoIds.has(videoId)) {
        seenVideoIds.add(videoId)
        items.push({
          id: `cached-video-${videoId}`,
          title: vid.title || 'Untitled Source Video',
          subtitle: `${formatTime(vid.duration || 0)} • Cached Source Video`,
          category: 'videos',
          icon: 'lucide:film',
          badge: 'Video',
          actionLabel: 'Load Hooks',
          keywords: ['video', 'cached', 'source', 'download', 'hooks', ...(vid.title || '').toLowerCase().split(' ')],
          handler: async () => {
            close()
            await router.push('/')
            state.showToast(`Loading cached hooks for "${vid.title || 'Source Video'}"...`, 'info')
            await state.analyzeCached(videoId, false)
          }
        })
      }
    }

    // 6. READY CLIPS & HOOKS
    const allHooks: Hook[] = [
      ...(state.savedHooks.value || []),
      ...(state.hooks.value || [])
    ]
    const seenHookIds = new Set<string>()

    for (const hook of allHooks) {
      const hookId = hook.id || `${hook.start}-${hook.end}-${hook.theme}`
      if (!seenHookIds.has(hookId) && hook.theme) {
        seenHookIds.add(hookId)
        items.push({
          id: `hook-clip-${hookId}`,
          title: hook.theme,
          subtitle: `${formatTime(hook.start)} - ${formatTime(hook.end)} (${Math.round(hook.end - hook.start)}s) • Score: ${hook.score || 85}%`,
          category: 'clips',
          icon: 'lucide:scissors',
          badge: hook.saved ? 'Saved' : 'Hook',
          actionLabel: 'Edit Clip',
          keywords: ['clip', 'hook', 'ready', 'saved', 'segment', ...(hook.theme || '').toLowerCase().split(' ')],
          handler: () => {
            state.activeHook.value = hook
            close()
            router.push('/editor')
          }
        })
      }
    }

    return items
  })

  // Filtered list based on active category tab & search query
  const filteredItems = computed(() => {
    let list = allItems.value

    // Apply category tab filter
    if (activeCategoryFilter.value !== 'all') {
      list = list.filter(item => item.category === activeCategoryFilter.value)
    }

    const q = searchQuery.value.trim().toLowerCase()
    if (!q) {
      const categoryOrder: Record<CommandPaletteCategory, number> = {
        navigation: 1,
        settings: 2,
        prompts: 3,
        videos: 4,
        clips: 5
      }
      return [...list].sort((a, b) => (categoryOrder[a.category] || 99) - (categoryOrder[b.category] || 99))
    }

    return list.filter(item => {
      if (item.title.toLowerCase().includes(q)) return true
      if (item.subtitle && item.subtitle.toLowerCase().includes(q)) return true
      if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(q))) return true
      if (item.category.toLowerCase().includes(q)) return true
      if (item.badge && item.badge.toLowerCase().includes(q)) return true
      return false
    })
  })

  // Grouped results for categorized view (with nested sub-groups for Preset Prompt & Custom Prompt)
  const groupedItems = computed<CommandPaletteGroup[]>(() => {
    const groups: CommandPaletteGroup[] = [
      { key: 'navigation', category: 'navigation', label: 'Navigation', items: [] },
      { key: 'settings', category: 'settings', label: 'Settings', items: [] },
      { 
        key: 'prompts', 
        category: 'prompts', 
        label: 'Prompt Template', 
        items: [],
        subgroups: [
          { key: 'presets', label: 'Preset Prompt', items: [] },
          { key: 'custom', label: 'Custom Prompt', items: [] }
        ]
      },
      { key: 'videos', category: 'videos', label: 'Cached Videos', items: [] },
      { key: 'clips', category: 'clips', label: 'Ready Clips', items: [] }
    ]

    for (const item of filteredItems.value) {
      if (item.category === 'prompts') {
        const promptsGroup = groups.find(g => g.key === 'prompts')!
        promptsGroup.items.push(item)
        if (item.subcategory === 'custom') {
          promptsGroup.subgroups![1].items.push(item)
        } else {
          promptsGroup.subgroups![0].items.push(item)
        }
      } else {
        const group = groups.find(g => g.category === item.category)
        if (group) {
          group.items.push(item)
        }
      }
    }

    return groups
      .map(g => {
        if (g.subgroups) {
          return {
            ...g,
            subgroups: g.subgroups.filter(sg => sg.items.length > 0)
          }
        }
        return g
      })
      .filter(g => g.items.length > 0)
  })

  function selectNext() {
    const total = filteredItems.value.length
    if (total === 0) return
    selectedIndex.value = (selectedIndex.value + 1) % total
  }

  function selectPrev() {
    const total = filteredItems.value.length
    if (total === 0) return
    selectedIndex.value = (selectedIndex.value - 1 + total) % total
  }

  function executeItem(item: CommandPaletteItem) {
    if (item && typeof item.handler === 'function') {
      item.handler()
    }
  }

  function executeSelected() {
    const item = filteredItems.value[selectedIndex.value]
    if (item) {
      executeItem(item)
    }
  }

  return {
    isOpen,
    searchQuery,
    selectedIndex,
    activeCategoryFilter,
    allItems,
    filteredItems,
    groupedItems,
    paletteCachedVideos,
    isPaletteCachedLoading,
    fetchPaletteCachedVideos,
    open,
    close,
    toggle,
    selectNext,
    selectPrev,
    executeItem,
    executeSelected
  }
}
