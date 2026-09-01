<template>
  <div class="w-full max-w-5xl z-10 flex flex-col">
    <!-- Hero Header Area -->
    <div class="text-center mt-4 mb-10 relative z-30 flex flex-col items-center">
      <!-- Masked Grid Backdrop & Bi-Chromatic Ambient Aura Glow -->
      <div class="absolute -top-24 -bottom-24 -left-12 -right-12 sm:-left-28 sm:-right-28 pointer-events-none -z-10 overflow-hidden select-none flex items-center justify-center">
        <!-- 1. Ambient Aura Glows (Bi-Chromatic: Lime Central Aura + Soft Violet & Emerald Wings) -->
        <div class="absolute -top-10 left-1/2 -translate-x-1/2 w-[340px] sm:w-[540px] md:w-[680px] h-56 sm:h-72 bg-accent-500/12 rounded-full blur-[110px] mix-blend-screen pointer-events-none"></div>
        <div class="absolute top-10 left-1/4 -translate-x-1/2 w-72 sm:w-96 h-48 bg-violet-600/10 rounded-full blur-[90px] mix-blend-screen pointer-events-none"></div>
        <div class="absolute top-14 right-1/4 translate-x-1/2 w-64 sm:w-80 h-44 bg-emerald-500/10 rounded-full blur-[90px] mix-blend-screen pointer-events-none"></div>

        <!-- 2. Faded / Masked Linear Square Grid (1.5x Baseline Contrast & 48px Spacious Spacing) -->
        <div 
          class="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.053)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.053)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_20%,transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000_20%,transparent_85%)]"
        ></div>
      </div>

      <!-- Eyebrow Glassmorphic Badge -->
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(207,255,80,0.04)] mb-5 select-none hover:border-accent-500/30 transition-all duration-300">
        <Icon name="ri:sparkling-2-fill" class="text-accent-500 text-xs sm:text-sm shrink-0" />
        <span class="text-[11px] sm:text-xs font-semibold text-slate-300 tracking-wide">Next-Gen Short Video Clipper</span>
      </div>

      <!-- Dynamic Typewriter Headline (Zero Layout Shift) -->
      <h1 class="text-3xl sm:text-5xl font-bold tracking-tight text-white mb-4 max-w-3xl flex flex-col items-center gap-1 sm:gap-1.5 select-none">
        <span class="block text-white leading-tight">Turn Long Videos into</span>
        <span class="inline-flex items-center justify-center min-h-[1.25em] text-transparent bg-clip-text bg-gradient-to-r from-accent-500 via-lime-300 to-accent-500 font-extrabold text-center">
          <span>{{ currentTypewriterText || '\u00A0' }}</span>
          <span class="inline-block w-[3px] sm:w-[4px] h-[0.85em] bg-accent-500 ml-1.5 align-middle animate-pulse shadow-[0_0_8px_#CFFF50]"></span>
        </span>
      </h1>

      <!-- Clean Plain-Language Subtitle -->
      <p class="text-slate-400 max-w-xl sm:max-w-2xl mx-auto text-xs sm:text-sm sm:leading-relaxed mb-8 px-4 font-normal">
        Automatically find the most exciting moments, add animated captions, and create ready-to-post Shorts in seconds.
      </p>
      
      <!-- 1. Unified Analyzer Panel Sub-Module -->
      <HomeUnifiedAnalyzerPanel 
        :is-processing="isProcessing" 
        @analyze="handleAnalyzeClick" 
      />
    </div>

    <!-- Main Dynamic Content Sections -->
    <Transition name="fade-layout" mode="out-in">
      <!-- 2. Pipeline Progress Stepper Sub-Module -->
      <HomePipelineProgressStepper 
        v-if="showProcessingOverlay" 
        key="processing"
        :stages="stages" 
        :progress-percent="progressPercent" 
        :loading-label="loadingLabel" 
        :is-reanalyzing-cached="isReanalyzingCached" 
        @cancel="resetToStart" 
      />

      <!-- 3. Generated / Saved Hooks Gallery Sub-Module -->
      <HomeHookResultsGallery 
        v-else-if="state.jobStatus.value !== 'idle' && (state.jobStatus.value === 'hooks_ready' || state.hooks.value.length > 0 || state.savedHooks.value.length > 0)" 
        key="hooks"
        :preview-video-url="previewVideoUrl" 
        :ready-clips="readyClips" 
        @select-hook="selectHook" 
        @back-to-library="resetToStart" 
      />

      <!-- 4. Default Home Library View: Ready Clips + Cached Library -->
      <div v-else key="library" class="flex flex-col">
        <!-- Ready to Edit Section Sub-Module -->
        <HomeReadyClipsSection 
          :ready-clips="readyClips" 
          :is-ready-clips-loading="isReadyClipsLoading" 
          @load-clip="loadReadyClip" 
          @refresh-clips="fetchReadyClips" 
        />

        <!-- Cached Video Library Sub-Module -->
        <HomeCachedVideoLibrary 
          ref="cachedLibraryRef"
          :cached-videos="cachedVideos" 
          :is-cached-loading="isCachedLoading" 
          :is-processing="isProcessing" 
          @analyze-cached="analyzeCached" 
          @reanalyze="triggerReanalyze" 
          @redownload="confirmRedownload" 
          @delete-video="deleteVideo" 
          @refresh-cached="state.fetchCached(true)" 
        />
      </div>
    </Transition>

    <!-- Standalone Reanalyze Settings Modal (Always Accessible) -->
    <HomeReanalyzeModal
      ref="reanalyzeModalRef"
      @reanalyze="analyzeCached"
    />
  </div>
</template>

<script setup lang="ts">
import type { CachedVideo, Hook, ReadyClip, PromptTemplate } from '../types/clipper'

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const cachedLibraryRef = ref<{ openDuplicateModal: (videoId: string) => void } | null>(null)
const reanalyzeModalRef = ref<{ open: (videoId: string) => void; close: () => void } | null>(null)

// Hero Headline Typewriter
const typewriterPhrases: string[] = [
  'Viral Short Clips',
  'Catchy Video Hooks',
  'Podcast Highlights',
  'Ready-to-Post Shorts'
]
const currentPhraseIndex = ref(0)
const currentTypewriterText = ref<string>(typewriterPhrases[0] ?? 'Viral Short Clips')
const isDeleting = ref(false)
let typewriterTimer: ReturnType<typeof setTimeout> | null = null

function updateTypewriter() {
  const fullText = typewriterPhrases[currentPhraseIndex.value] ?? typewriterPhrases[0] ?? ''

  if (isDeleting.value) {
    currentTypewriterText.value = fullText.substring(0, (currentTypewriterText.value || '').length - 1)
  } else {
    currentTypewriterText.value = fullText.substring(0, (currentTypewriterText.value || '').length + 1)
  }

  let typeSpeed = isDeleting.value ? 40 : 80

  if (!isDeleting.value && currentTypewriterText.value === fullText) {
    typeSpeed = 2200
    isDeleting.value = true
  } else if (isDeleting.value && currentTypewriterText.value === '') {
    isDeleting.value = false
    currentPhraseIndex.value = (currentPhraseIndex.value + 1) % typewriterPhrases.length
    typeSpeed = 400
  }

  typewriterTimer = setTimeout(updateTypewriter, typeSpeed)
}

const { 
  cachedVideos, isCachedLoading, isNavigatingToEditor 
} = state

const readyClips = useState<ReadyClip[]>('readyClips', () => [])
const isReadyClipsLoading = ref(false)
const showProcessingOverlay = ref(false)
const isReanalyzingCached = ref(false)
let processingTimeout: ReturnType<typeof setTimeout> | null = null
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

const isProcessing = computed(() => {
  return ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks', 'cutting', 'extracting_video'].includes(state.jobStatus.value)
})

const isAnalyzing = computed(() => {
  return ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks'].includes(state.jobStatus.value)
})

const previewVideoUrl = computed(() => {
  const url = state.videoUrl.value
  if (!url) return null
  if (url.includes('/assets/sources/') && url.endsWith('/full.mp4')) {
    if (state.hasPreview.value) {
      return url.replace('/full.mp4', '/preview.mp4')
    }
  }
  return url
})

watch(
  [() => isAnalyzing.value, () => state.jobStatus.value],
  ([active, status]) => {
    if (active) {
      if (processingTimeout) {
        clearTimeout(processingTimeout)
        processingTimeout = null
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
        scrollTimeout = null
      }
      showProcessingOverlay.value = true
    } else {
      if (status === 'hooks_ready' || status === 'ready') {
        if (!processingTimeout) {
          processingTimeout = setTimeout(() => {
            showProcessingOverlay.value = false
            processingTimeout = null
            scrollTimeout = setTimeout(() => {
              if (typeof document !== 'undefined') {
                const el = document.getElementById('hooks-header')
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }
              scrollTimeout = null
            }, 300)
          }, 1000)
        }
      } else {
        if (processingTimeout) {
          clearTimeout(processingTimeout)
          processingTimeout = null
        }
        if (scrollTimeout) {
          clearTimeout(scrollTimeout)
          scrollTimeout = null
        }
        showProcessingOverlay.value = false
      }
    }
  },
  { immediate: true }
)

const stages = computed(() => {
  const currentStatus = state.jobStatus.value
  const isCached = state.isCachedAnalysis.value
  
  if (isCached && !isReanalyzingCached.value) {
    const stage1Statuses = ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'generating_hooks', 'cutting', 'extracting_video']
    const allStatuses = stage1Statuses
    const currentIndex = allStatuses.indexOf(currentStatus)
    
    const getStageState = (statuses: string[]) => {
      if (statuses.includes(currentStatus)) return 'active'
      const stageFirstIndex = allStatuses.indexOf(statuses[0]!)
      if (currentIndex !== -1 && currentIndex < stageFirstIndex) {
        return 'pending'
      }
      return 'completed'
    }
    
    return [
      {
        id: 'cache_lookup',
        name: 'Cache Lookup',
        description: 'Verifying local video assets & transcripts',
        icon: 'ri:database-2-line',
        state: getStageState(stage1Statuses)
      }
    ]
  } else if (isCached) {
    const stage1Statuses = ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models']
    const stage2Statuses = ['generating_hooks', 'cutting', 'extracting_video']
    const allStatuses = [...stage1Statuses, ...stage2Statuses]
    const currentIndex = allStatuses.indexOf(currentStatus)
    
    const getStageState = (statuses: string[]) => {
      if (statuses.includes(currentStatus)) return 'active'
      const stageFirstIndex = allStatuses.indexOf(statuses[0]!)
      if (currentIndex !== -1 && currentIndex < stageFirstIndex) {
        return 'pending'
      }
      return 'completed'
    }
    
    return [
      {
        id: 'cache_lookup',
        name: 'Cache Lookup',
        description: 'Verifying local video assets & transcripts',
        icon: 'ri:database-2-line',
        state: getStageState(stage1Statuses)
      },
      {
        id: 'analysis',
        name: 'AI Analysis',
        description: 'AI Model generating hooks',
        icon: 'ri:magic-line',
        state: getStageState(stage2Statuses)
      }
    ]
  } else {
    const stage1Statuses = ['queued', 'checking_transcript']
    const stage2Statuses = ['downloading_video', 'downloading_ai_models']
    const stage3Statuses = ['transcribing', 'generating_hooks']
    const stage4Statuses = ['cutting', 'extracting_video']
    const allStatuses = [...stage1Statuses, ...stage2Statuses, ...stage3Statuses, ...stage4Statuses]
    const currentIndex = allStatuses.indexOf(currentStatus)
    
    const getStageState = (statuses: string[]) => {
      if (statuses.includes(currentStatus)) return 'active'
      const stageFirstIndex = allStatuses.indexOf(statuses[0]!)
      if (currentIndex !== -1 && currentIndex < stageFirstIndex) {
        return 'pending'
      }
      return 'completed'
    }
    
    return [
      {
        id: 'ingestion',
        name: 'Ingestion',
        description: 'Verifying URL & transcript',
        icon: 'ri:link-m',
        state: getStageState(stage1Statuses)
      },
      {
        id: 'preview_download',
        name: 'Fast Preview',
        description: 'Fetching preview video',
        icon: 'ri:download-cloud-2-line',
        state: getStageState(stage2Statuses)
      },
      {
        id: 'analysis',
        name: 'AI Analysis',
        description: 'AI Model generating hooks',
        icon: 'ri:magic-line',
        state: getStageState(stage3Statuses)
      },
      {
        id: 'previews',
        name: 'Visual Previews',
        description: 'Generating sharp hook thumbnails',
        icon: 'ri:image-line',
        state: getStageState(stage4Statuses)
      }
    ]
  }
})

const progressPercent = computed(() => {
  const currentStatus = state.jobStatus.value
  if (['hooks_ready', 'ready'].includes(currentStatus)) return 100
  if (state.isCachedAnalysis.value) {
    const map: Record<string, number> = {
      queued: 20,
      checking_transcript: 50,
      downloading_video: 50,
      downloading_ai_models: 50,
      generating_hooks: 85,
      cutting: 95,
      extracting_video: 95
    }
    return map[currentStatus] || 0
  } else {
    const map: Record<string, number> = {
      queued: 12.5,
      checking_transcript: 25,
      downloading_video: 40,
      downloading_ai_models: 50,
      transcribing: 75,
      generating_hooks: 90,
      cutting: 95,
      extracting_video: 98
    }
    return map[currentStatus] || 0
  }
})

const loadingLabel = computed(() => {
  const map: Record<string, string> = {
    queued: 'STARTING PIPELINE...',
    checking_transcript: 'VERIFYING TRANSCRIPT ACCESSIBILITY...',
    downloading_video: 'DOWNLOADING 1080p VIDEO...',
    downloading_ai_models: 'FETCHING AI MODELS (FIRST RUN)...',
    transcribing: `TRANSCRIBING WITH WHISPER (${(state.whisperModel.value || 'base').toUpperCase()})...`,
    generating_hooks: 'GEMINI AI ANALYZING...',
    cutting: 'CUTTING SEGMENT...',
    extracting_video: 'EXTRACTING VIDEO FRAME...',
  }
  return map[state.jobStatus.value] || 'PROCESSING...'
})

function extractYoutubeId(url: string): string | null {
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i
  const match = url.match(reg)
  return match ? (match[1] ?? null) : null
}

function handleAnalyzeClick() {
  const url = state.youtubeUrl.value
  if (!url) return
  
  const videoId = extractYoutubeId(url)
  if (videoId && cachedVideos.value.some((v: CachedVideo) => v.video_id === videoId)) {
    if (cachedLibraryRef.value?.openDuplicateModal) {
      cachedLibraryRef.value.openDuplicateModal(videoId)
    }
  } else {
    state.analyzeUrl(false)
  }
}

function triggerReanalyze(videoId: string) {
  if (reanalyzeModalRef.value?.open) {
    reanalyzeModalRef.value.open(videoId)
  }
}

async function analyzeCached(
  videoId: string, 
  force = false, 
  options?: any
) {
  isReanalyzingCached.value = force
  await state.analyzeCached(videoId, force, options)
}

function confirmRedownload(vid: CachedVideo) {
  if (window.confirm(`Are you sure you want to re-download "${vid.title}"? This will replace the existing file.`)) {
    deleteThenRedownload(vid.folder_name, vid.video_id)
  }
}

async function deleteThenRedownload(folderName: string, videoId: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    state.youtubeUrl.value = `https://youtube.com/watch?v=${videoId}`
    state.analyzeUrl()
    await state.fetchCached(true)
  } catch (e: unknown) {
    state.jobError.value = e instanceof Error ? e.message : String(e)
  }
}

async function deleteVideo(folderName: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    
    if (state.folderName.value === folderName) {
      state.resetWorkspace()
      state.showToast('Workspace reset because active video was deleted.', 'info')
    }
    
    await state.fetchCached(true)
    state.showToast('Video source successfully deleted.', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    state.jobError.value = msg
    state.showToast(msg, 'error')
  }
}

async function resetToStart() {
  state.stopPolling()
  state.resetWorkspace()
  state.youtubeUrl.value = ''
  isReanalyzingCached.value = false
  await state.fetchCached(true)
  await fetchReadyClips()
}

async function fetchReadyClips() {
  if (readyClips.value.length === 0) {
    isReadyClipsLoading.value = true
  }
  try {
    const res = await $fetch<{ clips: ReadyClip[] }>(`${API_BASE}/api/ready-clips`)
    readyClips.value = res.clips || []
  } catch { 
    if (readyClips.value.length === 0) readyClips.value = [] 
  } finally {
    isReadyClipsLoading.value = false
  }
}

async function loadReadyClip(clip: ReadyClip) {
  const router = useRouter()
  console.log('[yonru] Loading ready clip:', clip.clip_id, 'from folder:', clip.folder_name)
  
  try {
    isNavigatingToEditor.value = true
    const minWait = new Promise(resolve => setTimeout(resolve, 600))
    await state.loadReadyClipIntoEditor(clip.folder_name, clip.clip_id)
    
    state.setLastClip(clip.folder_name, clip.clip_id, clip.theme || clip.title, clip.thumbnail_url)
    
    let hookIndex = 0
    let tab = 'generated'
    
    const parts = clip.clip_id.split('_')
    const part0 = parts[0]
    const part1 = parts[1]
    if (part0 !== undefined && part1 !== undefined) {
      const clipStart = parseFloat(part0) || 0
      const clipEnd = parseFloat(part1) || 0
      
      function findBestMatchingHookIndex(list: Hook[], targetStart: number, targetEnd: number) {
        let bestIndex = -1
        let minDiff = 5.0
        list.forEach((h, idx) => {
          const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
          const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
          const diff = Math.abs(hStart - targetStart) + Math.abs(hEnd - targetEnd)
          if (diff < minDiff) {
            minDiff = diff
            bestIndex = idx
          }
        })
        return { index: bestIndex, diff: minDiff }
      }

      const savedMatch = findBestMatchingHookIndex(state.savedHooks.value, clipStart, clipEnd)
      const genMatch = findBestMatchingHookIndex(state.hooks.value, clipStart, clipEnd)

      if (savedMatch.index >= 0 && (genMatch.index < 0 || savedMatch.diff <= genMatch.diff)) {
        hookIndex = savedMatch.index
        tab = 'saved'
      } else if (genMatch.index >= 0) {
        hookIndex = genMatch.index
        tab = 'generated'
      }
    }
    
    await minWait
    await router.push({
      path: '/editor',
      query: { 
        job_id: state.jobId.value || '',
        folder: clip.folder_name,
        clip_id: clip.clip_id,
        hook_index: hookIndex,
        tab: tab
      }
    })
  } catch (e) {
    console.error('[yonru] Failed to load ready clip:', e)
    state.showToast('Failed to load clip data', 'error')
  }
}

async function selectHook(hook: Hook) {
  if (isProcessing.value) return
  isNavigatingToEditor.value = true
  const minWait = new Promise(resolve => setTimeout(resolve, 600))
  state.activeHook.value = hook
  
  if (!state.hdReady.value && state.downloadPercent.value < 100) {
    try {
      await new Promise<void>((resolve, reject) => {
        const unwatch = watch(
          [state.hdReady, state.downloadPercent, state.jobStatus],
          ([ready, percent, status]) => {
            if (ready || percent === 100) {
              unwatch()
              resolve()
            } else if (status === 'error') {
              unwatch()
              reject(new Error(state.jobError.value || 'HD source download failed.'))
            }
          },
          { immediate: true }
        )
      })
    } catch (err: any) {
      isNavigatingToEditor.value = false
      state.showToast(err.message || 'Failed to prepare HD assets.', 'error')
      return
    }
  }

  state.extractClip(hook)
  
  const hooksList = state.hooks.value
  const hookIndex = hooksList.indexOf(hook)
  
  await minWait
  await navigateTo({
    path: '/editor',
    query: { 
      job_id: state.jobId.value, 
      folder: state.folderName.value,
      hook_index: hookIndex >= 0 ? hookIndex : 0,
      tab: 'generated'
    }
  })
}

async function initDashboard() {
  isNavigatingToEditor.value = false
  
  const processingStatuses = ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks', 'cutting', 'extracting_video']
  if (!processingStatuses.includes(state.jobStatus.value)) {
    state.hooks.value = []
    state.jobStatus.value = 'idle'
    state.jobId.value = null
  } else {
    state.startPolling()
  }

  state.activeHook.value = null

  await state.fetchPrompts()
  await state.fetchSavedHooks()
  await state.fetchCached(true)
  await fetchReadyClips()
  state.initPersistence()
  state.checkSystemHealth()
  
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const savedVid = localStorage.getItem('yonru_last_video')
    if (savedVid) state.lastAccessedVideoId.value = savedVid
    
    const savedClip = localStorage.getItem('yonru_last_clip')
    if (savedClip) {
      try {
        state.lastAccessedClip.value = JSON.parse(savedClip)
      } catch (e) {}
    }
  }
}

const hasBeenMounted = ref(false)

onMounted(() => {
  initDashboard()
  nextTick(() => {
    hasBeenMounted.value = true
  })

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!prefersReducedMotion) {
    typewriterTimer = setTimeout(updateTypewriter, 1200)
  }
})

onActivated(() => {
  if (hasBeenMounted.value) {
    initDashboard()
  }
})

onDeactivated(() => {
  state.stopPolling()
})

onUnmounted(() => {
  if (processingTimeout) {
    clearTimeout(processingTimeout)
    processingTimeout = null
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
    scrollTimeout = null
  }
  if (typewriterTimer) {
    clearTimeout(typewriterTimer)
    typewriterTimer = null
  }
})
</script>

<style scoped>
.fade-layout-enter-active,
.fade-layout-leave-active {
  transition: opacity 200ms ease;
}
.fade-layout-enter-from,
.fade-layout-leave-to {
  opacity: 0;
}
</style>
