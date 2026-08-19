<template>
  <div class="h-screen w-full overflow-hidden bg-[#060608] relative">
    <div v-if="state" class="flex h-screen w-full bg-[#060608] overflow-hidden">
      <!-- Blacklist Settings Modal -->
      <div v-if="showBlacklistSettings" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-xl" @click="showBlacklistSettings = false"></div>
        <div class="w-full max-w-5xl max-h-[90vh] flex flex-col bg-surface-panel border border-surface-border rounded-3xl shadow-2xl relative overflow-hidden">
          <BlacklistSettings @close="showBlacklistSettings = false" />
        </div>
      </div>

      <!-- Navigation Sidebar -->
      <HomeSidebar
        v-model:activeView="sidebarView"
        :cached-videos="state.cachedVideos.value"
        :is-processing="isProcessing"
        :processing-title="state.videoTitle.value"
        :processing-status="loadingLabel"
        :last-video="state.lastAccessedVideo.value"
        :last-clip="state.lastAccessedClip.value"
        :API_BASE="API_BASE"
        :default-collapsed="true"
        :is-floating="true"
        @update:activeView="handleSidebarNav"
      />

      <div class="flex-1 flex flex-col overflow-hidden relative">
        <div class="flex-1 flex overflow-hidden">
          <!-- Settings Sidebar -->
          <SidebarSettings />

          <!-- Content / Preview Area -->
          <div class="flex-1 flex flex-col items-stretch bg-surface-dark relative">
            <div id="previewArea" class="flex-1 flex overflow-hidden min-h-0 relative flex-row w-full">
              <div class="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

              <div class="flex items-stretch z-10 w-full max-w-full h-full p-0 overflow-hidden relative">
                <!-- Video Workspace Pane -->
                <div class="flex-1 flex items-center justify-center p-5 relative overflow-hidden">
                  <!-- Pipeline Loading Overlay -->
                  <EditorPipelineOverlay
                    :pipeline-step="pipelineStep"
                    :pipeline-step-idx="pipelineStepIdx"
                    @error-back="handleErrorBack"
                    @error-retry="handleErrorRetry"
                  />

                  <!-- Remotion Rendering Overlay -->
                  <EditorRenderProgressOverlay />

                  <!-- Video Preview + Action Rail Group -->
                  <div class="flex justify-center items-start gap-4 relative h-full">
                    <VideoPreview />
                    <EditorActionRail
                      :is-panel-open="isPanelOpen"
                      :editor-tab="editorTab"
                      @toggle-tab="toggleTab"
                    />
                  </div>
                </div>

                <!-- Hooks Panel -->
                <EditorHooksListPanel
                  v-model:panel-tab="panelTab"
                  :is-current-hook-saved="isCurrentHookSaved"
                  :is-overlay-visible="isOverlayVisible"
                  :is-hook-rendered="isHookRendered"
                  :is-active-hook="isActiveHook"
                  @select-hook="selectSidebarHook"
                  @save-current-hook="saveCurrentHook"
                  @remove-current-saved-hook="removeCurrentSavedHook"
                  @open-blacklist-settings="showBlacklistSettings = true"
                />

                <!-- Floating Subtitle / Thumbnail / Quote Panel Overlay -->
                <EditorFloatingPanel
                  :is-panel-open="isPanelOpen"
                  :editor-tab="editorTab"
                  @close="isPanelOpen = false"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Timeline -->
        <div class="h-64 border-t border-surface-border flex flex-col bg-[#060608] z-40 relative">
          <TimelineEditor />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onActivated, onDeactivated, onUnmounted } from 'vue'
import type { Hook, ReadyClip } from '../types/clipper'

definePageMeta({
  layout: false,
  keepalive: true
})

const state = useClipperState()
const route = useRoute()
const router = useRouter()

const isOverlayVisible = useState<boolean>('isOverlayVisible', () => false)
let overlayTimeout: ReturnType<typeof setTimeout> | null = null

const isPanelOpen = ref(false)
const editorTab = ref<'edit' | 'quote' | 'thumbnail'>('edit')

const toggleTab = (tab: 'edit' | 'quote' | 'thumbnail') => {
  if (isPanelOpen.value && editorTab.value === tab) {
    isPanelOpen.value = false
  } else {
    editorTab.value = tab
    isPanelOpen.value = true
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isPanelOpen.value) {
    isPanelOpen.value = false
  }
}

const showBlacklistSettings = ref(false)
const panelTab = ref<'generated' | 'saved'>((route.query.tab as any) || 'generated')
const sidebarView = ref('editor')
const hasBeenMounted = ref(false)

const readyClips = useState<ReadyClip[]>('readyClips', () => [])
const API_BASE = 'http://localhost:8000'

const isCurrentHookSaved = computed(() => {
  if (!state?.activeHook?.value || !state?.savedHooks?.value?.length) return false
  const active = state.activeHook.value
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end

  return state.savedHooks.value.some((h: Hook) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })
})

const currentSavedHookId = computed(() => {
  if (!state?.activeHook?.value || !state?.savedHooks?.value?.length) return null
  const active = state.activeHook.value
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end

  const match = state.savedHooks.value.find((h: Hook) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })
  return match?._id || null
})

function saveCurrentHook() {
  if (state?.activeHook?.value && state.saveHook) {
    state.saveHook(state.activeHook.value)
  }
}

async function removeCurrentSavedHook() {
  const hookId = currentSavedHookId.value
  if (hookId && state.deleteSavedHook) {
    await state.deleteSavedHook(hookId)
  }
}

async function fetchReadyClips() {
  try {
    const res = await $fetch<{ clips: ReadyClip[] }>(`${API_BASE}/api/ready-clips`)
    readyClips.value = res.clips || []
  } catch (e) {
    console.error('[yonru] Failed to fetch ready clips in background:', e)
  }
}

function findMatchingClip(hook: Hook | null): ReadyClip | undefined {
  if (!readyClips.value?.length || !state.folderName.value || !hook) return undefined
  return readyClips.value.find(c => {
    if (c.folder_name !== state.folderName.value) return false
    const parts = c.clip_id.split('_')
    const part0 = parts[0]
    const part1 = parts[1]
    if (part0 === undefined || part1 === undefined) return false
    const cStart = parseFloat(part0)
    const cEnd = parseFloat(part1)
    if (isNaN(cStart) || isNaN(cEnd)) return false

    const safetyBuffer = state.startSafetyBuffer?.value ?? 2.0
    const expectedStart = Math.max(0, Math.floor(hook.start - safetyBuffer))
    const expectedEnd = Math.ceil(hook.end)
    if (Math.abs(cStart - expectedStart) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }

    const expectedStartDefault = Math.max(0, Math.floor(hook.start - 2.0))
    if (Math.abs(cStart - expectedStartDefault) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }
    const expectedStartNone = Math.max(0, Math.floor(hook.start))
    if (Math.abs(cStart - expectedStartNone) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }

    const hookDuration = hook.end - hook.start
    if (hookDuration <= 0) return false
    const overlapStart = Math.max(cStart, hook.start)
    const overlapEnd = Math.min(cEnd, hook.end)
    const overlap = overlapEnd - overlapStart
    if (overlap > 0 && (overlap / hookDuration) >= 0.8) {
      return true
    }

    if (hook.theme && parts.length >= 3) {
      const cleanHookTheme = hook.theme.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()
      const clipThemeStr = parts.slice(2).join(' ').replace(/_/g, ' ')
      const cleanClipTheme = clipThemeStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()
      if (cleanHookTheme && cleanClipTheme && (cleanClipTheme.includes(cleanHookTheme) || cleanHookTheme.includes(cleanClipTheme))) {
        return true
      }
    }

    return false
  })
}

function isHookRendered(hook: Hook | null) {
  if (!hook) return false
  const status = state.jobStatus.value
  if (['cutting', 'transcribing', 'queued'].includes(status)) {
    if (state.activeHook.value) {
      const hStart = typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start
      const hEnd = typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end
      const aStart = typeof state.activeHook.value.start === 'string' ? parseFloat(state.activeHook.value.start) : state.activeHook.value.start
      const aEnd = typeof state.activeHook.value.end === 'string' ? parseFloat(state.activeHook.value.end) : state.activeHook.value.end
      if (Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1) {
        return false
      }
    }
  }

  const matchingClip = findMatchingClip(hook)
  if (!matchingClip) return false

  if (['cutting', 'transcribing', 'queued'].includes(status) && state.clipId.value === matchingClip.clip_id) {
    return false
  }

  return true
}

function isActiveHook(hook: Hook) {
  if (!state?.activeHook?.value) return false
  const active = state.activeHook.value
  const hStart = typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start
  const hEnd = typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end

  return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
}

function handleSidebarNav(view: string) {
  if (view !== 'editor') {
    router.push('/')
  }
}

function handleErrorBack() {
  state.jobStatus.value = 'idle'
  state.jobError.value = null
  state.isMediaLoading.value = false
  router.push('/')
}

function handleErrorRetry() {
  if (state.activeHook.value) {
    state.extractClip(state.activeHook.value)
  }
}

const isProcessing = computed(() => {
  return ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks', 'cutting', 'extracting_video'].includes(state.jobStatus.value)
})

const loadingLabel = computed(() => {
  const map: Record<string, string> = {
    queued: 'STARTING PIPELINE...',
    checking_transcript: 'VERIFYING TRANSCRIPT ACCESSIBILITY...',
    downloading_video: 'DOWNLOADING 1080p VIDEO...',
    downloading_ai_models: 'FETCHING AI MODELS (FIRST RUN)...',
    transcribing: `TRANSCRIBING WITH WHISPER (${state.whisperModel.value.toUpperCase()})...`,
    generating_hooks: 'GEMINI AI ANALYZING...',
    cutting: 'CUTTING SEGMENT...',
    extracting_video: 'EXTRACTING VIDEO FRAME...',
  }
  return map[state.jobStatus.value] || 'PROCESSING...'
})

async function handleSave(isSilent = false) {
  const silent = isSilent === true
  await Promise.all([
    state.saveTranscript(silent),
    state.saveStyleSettings(),
    state.saveTimelineTracks(),
    state.saveThumbnailConfig()
  ])
}

async function selectSidebarHook(hook: Hook) {
  if (state.jobStatus.value === 'cutting' || isActiveHook(hook)) return

  if (state?.activeHook?.value && state?.clipId?.value) {
    console.log('[editor] Saving current hook state before switching...')
    await handleSave(true)
  }

  const hooksList = panelTab.value === 'saved' ? state.savedHooks.value : state.hooks.value
  const hookIndex = hooksList.indexOf(hook)
  const matchingClip = findMatchingClip(hook)

  const query: Record<string, string | number | (string | null)[] | null> = {
    ...route.query as Record<string, string | number | (string | null)[]>,
    hook_index: hookIndex >= 0 ? hookIndex : 0,
    tab: panelTab.value
  }
  if (matchingClip) {
    query.clip_id = matchingClip.clip_id
  } else {
    delete query.clip_id
  }
  router.replace({ query })

  if (matchingClip) {
    console.log('[editor] Hook is already rendered, loading ready clip:', matchingClip.clip_id)
    state.loadReadyClipIntoEditor(state.folderName.value || '', matchingClip.clip_id)
  } else {
    console.log('[editor] Hook is not rendered, starting extraction...')
    state.extractClip(hook)
  }
}

let restoreQueryWatcher: (() => void) | null = null

function restoreStateFromQuery() {
  if (restoreQueryWatcher) {
    restoreQueryWatcher()
    restoreQueryWatcher = null
  }

  const jobId = route.query.job_id as string
  const folder = route.query.folder as string
  const clipId = route.query.clip_id as string
  const hookIndex = parseInt(route.query.hook_index as string)
  const tab = (route.query.tab as string) || 'generated'

  if (jobId) {
    console.log('[editor] Restoring state from query. JobID:', jobId, 'Folder:', folder, 'ClipID:', clipId, 'HookIndex:', hookIndex, 'Tab:', tab)
    state.jobId.value = jobId
    state.folderName.value = folder
    if (clipId) {
      state.clipId.value = clipId
    }
    panelTab.value = tab as any

    restoreQueryWatcher = watch(
      [() => state?.jobStatus?.value, () => state?.hooks?.value, () => state?.savedHooks?.value],
      () => {
        const status = state?.jobStatus?.value || 'idle'
        const hooksAvailable = (state?.hooks?.value?.length || 0) > 0 || (state?.savedHooks?.value?.length || 0) > 0

        if (status === 'ready' || (status === 'hooks_ready' && hooksAvailable)) {
          const hooksList = tab === 'saved' ? state?.savedHooks?.value : state?.hooks?.value
          const targetIndex = isNaN(hookIndex) ? 0 : hookIndex
          if (hooksList && hooksList[targetIndex]) {
            console.log('[editor] Restoring hook from index:', targetIndex)
            if (state?.activeHook && (!state.activeHook.value || status !== 'ready')) {
              state.activeHook.value = hooksList[targetIndex]
            }
            if (status !== 'ready') {
              state?.extractClip?.(hooksList[targetIndex])
            }
          }
          nextTick(() => {
            if (restoreQueryWatcher) {
              restoreQueryWatcher()
              restoreQueryWatcher = null
            }
          })
        }
      },
      { immediate: true }
    )

    state?.startPolling?.()
  } else if (folder && clipId) {
    console.log('[editor] Restoring ready clip from query without jobId. Folder:', folder, 'ClipID:', clipId)
    panelTab.value = tab as any
    state.loadReadyClipIntoEditor(folder, clipId)
  }
}

// Pipeline loading overlay calculations
const pipelineStep = computed(() => {
  const status = state?.jobStatus?.value || 'idle'
  if (state?.activeHook?.value && !isHookRendered(state.activeHook.value) && status !== 'ready') {
    return status === 'transcribing' ? 'transcribing' : 'cutting'
  }
  return status
})

const pipelineStepIdx = computed(() => {
  const map: Record<string, number> = { cutting: 0, transcribing: 1, ready: 2 }
  return map[pipelineStep.value] ?? 2
})

const isPipelineActive = computed(() => ['cutting', 'transcribing', 'error'].includes(state?.jobStatus?.value || '') || state?.isMediaLoading?.value)

watch(
  [isPipelineActive, () => state?.jobStatus?.value],
  ([active, status]) => {
    if (active) {
      isOverlayVisible.value = true
      if (overlayTimeout) {
        clearTimeout(overlayTimeout)
        overlayTimeout = null
      }
    } else {
      if (status === 'ready') {
        if (!overlayTimeout) {
          overlayTimeout = setTimeout(() => {
            isOverlayVisible.value = false
            overlayTimeout = null
          }, 800)
        }
      } else {
        isOverlayVisible.value = false
        if (overlayTimeout) {
          clearTimeout(overlayTimeout)
          overlayTimeout = null
        }
      }
    }
  },
  { immediate: true }
)

watch(() => state.renderStatus.value, (newStatus) => {
  if (newStatus === 'done') {
    fetchReadyClips()
  }
})

watch(() => state.jobStatus.value, (newStatus) => {
  if (newStatus === 'ready') {
    fetchReadyClips()
  }
}, { immediate: true })

watch(() => state.jobId.value, (newJobId) => {
  if (newJobId && route.query.job_id !== newJobId) {
    const query = { ...route.query, job_id: newJobId }
    router.replace({ query })
  }
})

onMounted(async () => {
  console.log('[yonru] Editor mounted (first time)')
  state.isNavigatingToEditor.value = false
  fetchReadyClips()
  state.fetchCached()
  state.fetchSavedHooks()

  if (import.meta.client) {
    const saved = localStorage.getItem('yonru_last_video')
    if (saved) state.lastAccessedVideoId.value = saved
  }

  restoreStateFromQuery()
  state.initPersistence()
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
  nextTick(() => {
    hasBeenMounted.value = true
  })
})

onActivated(() => {
  if (hasBeenMounted.value) {
    console.log('[yonru] Editor activated (returned from cache)')
    sidebarView.value = 'editor'
    state.isNavigatingToEditor.value = false
    fetchReadyClips()
    state.fetchCached()
    state.fetchSavedHooks()
    restoreStateFromQuery()
  }
})

onDeactivated(() => {
  console.log('[yonru] Editor deactivated — stopping background polling')
  state.stopPolling()
  if (restoreQueryWatcher) {
    restoreQueryWatcher()
    restoreQueryWatcher = null
  }
  if (overlayTimeout) {
    clearTimeout(overlayTimeout)
    overlayTimeout = null
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
  if (restoreQueryWatcher) {
    restoreQueryWatcher()
    restoreQueryWatcher = null
  }
  if (overlayTimeout) {
    clearTimeout(overlayTimeout)
    overlayTimeout = null
  }
})
</script>
