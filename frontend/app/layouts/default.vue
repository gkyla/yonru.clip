<template>
  <div class="flex h-screen w-full bg-[#060608] overflow-hidden relative">
    <!-- Resizable Sidebar -->
    <HomeSidebar 
      :active-view="activeView"
      :cached-videos="cachedVideos"
      :is-processing="isProcessing"
      :processing-title="videoTitle"
      :processing-status="loadingLabel"
      :last-video="lastAccessedVideo"
      :last-clip="lastAccessedClip"
      :API_BASE="API_BASE"
      :default-collapsed="false"
      :is-floating="false"
      @analyze="analyzeCached"
      @redownload="confirmRedownload"
      @delete="confirmDelete"
    />

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col h-full overflow-hidden relative">
      <TheTopbar />
      
      <div class="flex-1 overflow-y-auto custom-scrollbar w-full relative flex flex-col items-center p-8">
        <!-- Abstract Background Setup -->
        <div class="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#060608]">
           <div class="absolute w-[60vw] h-[60vw] rounded-full bg-accent-500/5 blur-[120px] -top-1/4 -right-1/4 mix-blend-screen"></div>
           <div class="absolute w-[50vw] h-[40vw] rounded-full bg-violet-500/5 blur-[100px] bottom-0 -left-1/4 mix-blend-screen"></div>
           <div class="absolute inset-0 bg-noise opacity-5 mix-blend-overlay"></div>
        </div>

        <slot />
      </div>
    </div>

    <!-- Cinematic Delete Confirmation Modal -->
    <div v-if="deleteConfirmModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="deleteConfirmModalOpen = false"></div>
      <div class="relative w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-200">
         <Icon name="ri:error-warning-fill" class="text-4xl text-amber-500 mb-3" />
         <h3 class="text-lg font-bold text-white mb-2 uppercase tracking-wide">Delete Cached Video</h3>
         <p class="text-slate-400 text-xs mb-6">Are you sure you want to delete <span class="text-white font-bold">"{{ videoToDelete?.title }}"</span>? This will clear all clips and prompts cached for this project.</p>
         <div class="flex items-center gap-3">
            <button 
              @click="deleteConfirmModalOpen = false"
              class="flex-1 py-2.5 bg-surface-dark hover:bg-surface-panel border border-surface-border text-slate-300 font-bold rounded-lg text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button 
              @click="deleteVideo(videoToDelete.folder_name)"
              class="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              Delete
            </button>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const state = useClipperState()
const route = useRoute()
const API_BASE = 'http://localhost:8000'

const activeView = computed(() => {
  if (route.path === '/settings') return 'settings'
  if (route.path === '/prompts') return 'prompts'
  if (route.path === '/docs') return 'docs'
  return 'home'
})

const { 
  cachedVideos, lastAccessedVideo, lastAccessedClip, videoTitle 
} = state

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

// Library Dialog States
const deleteConfirmModalOpen = ref(false)
const videoToDelete = ref<any | null>(null)

async function analyzeCached(videoId: string, force = false) {
  state.jobStatus.value = 'queued'
  state.jobError.value = null
  state.hooks.value = []
  state.outputUrl.value = null
  state.activeHook.value = null

  try {
    const currentPrompt = state.promptsList.value.find(p => p.id === state.selectedPrompt.value)
    const res = await $fetch<{ job_id: string; status: string }>(`${API_BASE}/api/analyze-cached/${videoId}?force=${force}`, { 
      method: 'POST',
      body: { 
        prompt_file: state.selectedPrompt.value,
        num_hooks: currentPrompt?.numHooks ?? 10,
        auto_hooks: currentPrompt?.autoHooks ?? false
      }
    })
    state.jobId.value = res.job_id
    state.jobStatus.value = res.status
    state.startPolling()
  } catch (e: any) {
    state.jobStatus.value = 'error'
    state.jobError.value = e.message || 'Failed to analyze cached video'
  }
}

function confirmRedownload(vid: any) {
  if (window.confirm(`Are you sure you want to re-download "${vid.title}"? This will replace the existing file.`)) {
    deleteThenRedownload(vid.folder_name, vid.video_id)
  }
}

async function deleteThenRedownload(folderName: string, videoId: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    state.youtubeUrl.value = `https://youtube.com/watch?v=${videoId}`
    state.analyzeUrl()
    await state.fetchCached()
  } catch (e: any) {
    state.jobError.value = e.message || 'Failed to re-download'
  }
}

function confirmDelete(vid: any) {
  videoToDelete.value = vid
  deleteConfirmModalOpen.value = true
}

async function deleteVideo(folderName: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    if (state.folderName.value === folderName) {
      state.resetWorkspace()
      state.showToast('Workspace reset because active video was deleted.', 'info')
    }
    await state.fetchCached()
    state.showToast('Video source successfully deleted.', 'success')
  } catch (e: any) {
    state.jobError.value = e.message || 'Failed to delete'
    state.showToast(e.message || 'Failed to delete', 'error')
  } finally {
    deleteConfirmModalOpen.value = false
    videoToDelete.value = null
  }
}
</script>
