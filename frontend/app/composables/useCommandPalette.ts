import { ref, computed } from 'vue'
import type { CommandPaletteItem, CommandPaletteCategory, Hook } from '../types/clipper'
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

  const state = useClipperState()

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
      title: 'Documentation & Changelog',
      subtitle: 'System architecture, ADR records, and release history',
      category: 'navigation',
      icon: 'lucide:book-open',
      badge: 'Page',
      actionLabel: 'Jump',
      keywords: ['docs', 'documentation', 'changelog', 'release', 'notes', 'help', 'history'],
      handler: () => {
        close()
        router.push('/docs')
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

    // 3. SETTINGS SECTIONS
    items.push({
      id: 'setting-whisper',
      title: 'Whisper Transcription Engine',
      subtitle: 'Switch Whisper model tiers (tiny, base, small, medium, large-v3)',
      category: 'settings',
      icon: 'lucide:mic',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['whisper', 'transcription', 'engine', 'model', 'audio', 'speech', 'subtitles', 'stt'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'engine' } })
      }
    })

    items.push({
      id: 'setting-api',
      title: 'AI Provider & API Keys',
      subtitle: 'Manage Google Gemini, Groq, and Local Ollama connection',
      category: 'settings',
      icon: 'lucide:key',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['api', 'keys', 'gemini', 'groq', 'ollama', 'provider', 'token', 'llm'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'api' } })
      }
    })

    items.push({
      id: 'setting-diagnostics',
      title: 'Hardware Acceleration & Diagnostics',
      subtitle: 'Inspect CPU cores, RAM, VRAM, and GPU acceleration status',
      category: 'settings',
      icon: 'lucide:cpu',
      badge: 'Setting',
      actionLabel: 'Inspect',
      keywords: ['hardware', 'gpu', 'vram', 'ram', 'cpu', 'acceleration', 'specs', 'diagnostics', 'benchmark'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'diagnostics' } })
      }
    })

    items.push({
      id: 'setting-style',
      title: 'Safe Zone & Subtitle Defaults',
      subtitle: 'Adjust safe zone opacity, color, and global typography defaults',
      category: 'settings',
      icon: 'lucide:palette',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['safe zone', 'subtitle', 'font', 'style', 'presets', 'color', 'opacity', 'typography'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'style' } })
      }
    })

    items.push({
      id: 'setting-blacklist',
      title: 'Blacklist & Audio Censorship',
      subtitle: 'Manage banned words, automatic mute intervals, and bleep sounds',
      category: 'settings',
      icon: 'lucide:shield-alert',
      badge: 'Setting',
      actionLabel: 'Configure',
      keywords: ['blacklist', 'censorship', 'profanity', 'bleep', 'mute', 'filter', 'safety', 'words'],
      handler: () => {
        close()
        router.push({ path: '/settings', query: { tab: 'blacklist' } })
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
    if (state.cachedVideos.value && Array.isArray(state.cachedVideos.value)) {
      for (const vid of state.cachedVideos.value) {
        if (vid.video_id || vid.folder_name) {
          items.push({
            id: `cached-video-${vid.video_id || vid.folder_name}`,
            title: vid.title || 'Untitled Source Video',
            subtitle: `${formatTime(vid.duration || 0)} • Cached Source Video`,
            category: 'videos',
            icon: 'lucide:film',
            badge: 'Source',
            actionLabel: 'Open',
            keywords: ['video', 'cached', 'source', 'download', ...(vid.title || '').toLowerCase().split(' ')],
            handler: () => {
              state.folderName.value = vid.folder_name || vid.video_id
              state.videoTitle.value = vid.title || ''
              state.videoDuration.value = vid.duration || 0
              close()
              router.push('/')
            }
          })
        }
      }
    }

    // 6. READY CLIPS & HOOKS
    const allHooks: Hook[] = [
      ...(state.savedHooks.value || []),
      ...(state.hooks.value || [])
    ]
    const seenHookIds = new Set<string>()

    for (const h of allHooks) {
      const hookId = h.id || h._id || `${h.start}-${h.end}`
      if (seenHookIds.has(hookId)) continue
      seenHookIds.add(hookId)

      const title = h.theme || h.title || 'Untitled Clip'
      const duration = (h.end && h.start) ? Math.max(0, h.end - h.start) : 0
      const score = h.virality_score ? `${h.virality_score}/100` : 'Ready'

      items.push({
        id: `hook-${hookId}`,
        title,
        subtitle: `Score: ${score} • ${formatTime(duration)} duration`,
        category: 'clips',
        icon: 'lucide:clapperboard',
        badge: 'Clip',
        actionLabel: 'Edit',
        keywords: ['clip', 'hook', 'viral', 'moment', ...title.toLowerCase().split(' ')],
        handler: () => {
          state.activeHook.value = h
          close()
          router.push('/editor')
        }
      })
    }

    return items
  })

  // Filtered items based on query & category filter
  const filteredItems = computed<CommandPaletteItem[]>(() => {
    const q = searchQuery.value.trim().toLowerCase()
    let list = allItems.value

    if (activeCategoryFilter.value !== 'all') {
      list = list.filter(i => i.category === activeCategoryFilter.value)
    }

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

  // Grouped results for categorized view
  const groupedItems = computed(() => {
    const groups: { category: CommandPaletteCategory; label: string; items: CommandPaletteItem[] }[] = [
      { category: 'navigation', label: 'Navigation', items: [] },
      { category: 'settings', label: 'Settings', items: [] },
      { category: 'prompts', label: 'Prompt Templates', items: [] },
      { category: 'videos', label: 'Cached Videos', items: [] },
      { category: 'clips', label: 'Ready Clips', items: [] }
    ]

    for (const item of filteredItems.value) {
      const group = groups.find(g => g.category === item.category)
      if (group) {
        group.items.push(item)
      }
    }

    return groups.filter(g => g.items.length > 0)
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
    open,
    close,
    toggle,
    selectNext,
    selectPrev,
    executeItem,
    executeSelected
  }
}
