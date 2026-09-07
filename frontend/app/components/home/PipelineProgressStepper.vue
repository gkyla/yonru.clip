<template>
  <div class="px-8 w-full mb-14">
     <div class="bg-[#0b0c10] border border-surface-border/60 p-8 sm:p-12 rounded-none shadow-2xl flex flex-col items-center justify-center min-h-[450px] relative overflow-hidden w-full">
         <div class="absolute inset-0 bg-noise opacity-[0.02] mix-blend-overlay"></div>
         <!-- Dynamic atmospheric lighting that glows behind the active step -->
         <div class="absolute w-[300px] h-[300px] bg-accent-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
         <div class="absolute w-[200px] h-[200px] bg-violet-500/5 rounded-full blur-[80px] animate-pulse pointer-events-none -mr-40 -mt-20"></div>

         <div class="flex flex-col items-center gap-1.5 mb-8 z-10 text-center">
           <span class="text-[9px] uppercase tracking-[0.25em] font-black text-accent-500 mb-1">AUTOMATED WORKFLOW</span>
           <h3 class="font-black text-white tracking-widest text-lg sm:text-xl uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-500">ANALYZING VIDEO CONTENT</h3>
           <p class="text-[10px] text-slate-400 normal-case tracking-normal">Server is executing ingestion pipeline. You can safely return to library while it runs.</p>
         </div>

         <!-- Bento Stepper Grid -->
         <div class="grid gap-4 w-full z-10 mb-8" :class="[stages.length === 1 ? 'max-w-md mx-auto grid-cols-1' : stages.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto w-full' : 'grid-cols-1 sm:grid-cols-4 w-full']">
           <div 
             v-for="(stg, idx) in stages" 
             :key="stg.id"
             class="border p-5 flex flex-col justify-between min-h-[120px] transition-all duration-700 ease-out relative group"
             :class="[
               stg.state === 'active' 
                 ? 'border-accent-500/40 bg-gradient-to-br from-accent-500/[0.04] to-violet-500/[0.02] shadow-[0_0_20px_rgba(207,255,80,0.08)]' 
                 : stg.state === 'completed'
                 ? 'border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400'
                 : 'border-surface-border/50 bg-black/10 text-slate-500 opacity-60'
             ]"
           >
             <!-- Shimmer line on active card -->
             <div 
                class="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-accent-500 to-violet-500 shadow-[0_0_10px_#CFFF50] transition-opacity duration-700 ease-out pointer-events-none"
                :class="stg.state === 'active' ? 'opacity-100' : 'opacity-0'"
              ></div>
             
             <div class="flex justify-between items-start mb-3">
               <div 
                 class="w-8 h-8 flex items-center justify-center border text-sm transition-all duration-700 ease-out group-hover:scale-105"
                 :class="[
                   stg.state === 'active' 
                     ? 'border-accent-500/30 text-accent-500 bg-accent-500/10 shadow-[0_0_10px_rgba(207,255,80,0.2)]' 
                     : stg.state === 'completed'
                     ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                     : 'border-surface-border/50 text-slate-500'
                 ]"
               >
                 <Icon :name="stg.icon" />
               </div>
               
               <!-- Indicator Badge -->
               <div class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border transition-all duration-700 ease-out"
                    :class="[
                      stg.state === 'active' 
                        ? 'border-accent-500/30 text-accent-500 bg-accent-500/5 animate-pulse' 
                        : stg.state === 'completed'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                        : 'border-surface-border/50 text-slate-500'
                    ]">
                 {{ stg.state }}
               </div>
             </div>

             <div>
               <h4 class="text-xs font-black uppercase tracking-wider mb-1 transition-colors duration-700 ease-out" :class="stg.state === 'pending' ? 'text-slate-400' : 'text-white'">
                 {{ idx + 1 }}. {{ stg.name }}
               </h4>
               <p class="text-[11px] leading-snug transition-all duration-700 ease-out" :class="stg.state === 'pending' ? 'text-slate-500' : stg.state === 'completed' ? 'text-emerald-400' : 'text-slate-300'">
                 {{ stg.description }}
               </p>
             </div>
           </div>
         </div>

         <!-- Glowing progress line -->
         <div class="w-full bg-black/40 border border-surface-border/50 h-2.5 overflow-hidden mb-8 relative z-10 p-[2px]">
            <div 
              class="h-full bg-gradient-to-r from-accent-500 to-violet-500 relative shadow-[0_0_12px_rgba(207,255,80,0.5)]" 
              :class="state.isCachedAnalysis?.value && !isReanalyzingCached ? 'animate-progress-sweep' : 'transition-all duration-700 ease-out'"
              :style="state.isCachedAnalysis?.value && !isReanalyzingCached ? {} : { width: `${progressPercent}%` }"
            >
              <div class="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer-fast bg-[length:200%_100%]"></div>
            </div>
         </div>

         <!-- 2-Column Unified Video & Parameters Card -->
         <div class="w-full bg-[#0e1015]/90 border border-surface-border/60 p-5 text-xs text-slate-300 text-left z-10 shadow-2xl relative">
            <div v-if="hasVideoMetadata" class="flex flex-col md:flex-row justify-between gap-6">
               <!-- Left Column: Video Identity -->
               <div class="flex-1 flex items-start gap-4 min-w-0">
                  <!-- 16:9 Mini Thumbnail -->
                  <div class="w-28 sm:w-36 aspect-video bg-surface-dark border border-surface-border/70 shrink-0 overflow-hidden relative group">
                     <img 
                        v-if="displayThumbnail && !thumbnailLoadError" 
                        :src="displayThumbnail" 
                        :alt="displayTitle" 
                        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        @error="thumbnailLoadError = true"
                     />
                     <div v-else class="w-full h-full flex items-center justify-center text-slate-600 bg-surface-dark">
                        <Icon name="ri:movie-2-line" class="text-2xl" />
                     </div>
                     <!-- Duration Overlay Badge -->
                     <div v-if="displayDuration > 0" class="absolute bottom-1 right-1 bg-black/85 px-1.5 py-0.5 text-[9px] text-white font-mono font-bold tracking-wider border border-white/10">
                        {{ formatDuration(displayDuration) }}
                     </div>
                  </div>

                  <!-- Details: Title, Channel, Added Date -->
                  <div class="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
                     <div class="flex items-center gap-1.5 min-w-0">
                        <h4 class="font-bold text-white text-sm truncate" :title="displayTitle">
                           {{ displayTitle }}
                        </h4>
                        <a 
                           v-if="sourceVideoLink" 
                           :href="sourceVideoLink" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           class="text-slate-400 hover:text-accent-500 transition-colors shrink-0 cursor-pointer p-0.5"
                           title="Open original video"
                        >
                           <Icon name="ri:external-link-line" class="text-xs" />
                        </a>
                     </div>
                     <p v-if="displayChannel" class="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                        <Icon name="ri:user-3-line" class="text-xs text-slate-500 shrink-0" />
                        <span class="truncate">{{ displayChannel }}</span>
                     </p>
                     <p class="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                        <Icon name="ri:calendar-line" class="text-xs text-slate-500 shrink-0" />
                        <span>Added: {{ displayAddedDate }}</span>
                     </p>
                  </div>
               </div>

               <!-- Right Column: Model Whisper & Prompt Template -->
               <div class="flex-1 md:border-l border-surface-border/50 md:pl-6 flex flex-col justify-center gap-3 min-w-0">
                  <div class="flex items-center justify-between gap-2 border-b border-surface-border/40 pb-2.5">
                     <span class="text-slate-400 font-medium">Whisper Model</span>
                     <span class="font-mono text-slate-200 font-bold uppercase px-2 py-0.5 bg-surface-dark border border-surface-border/60">
                        {{ (state.whisperModel?.value || 'base').toUpperCase() }}
                     </span>
                  </div>
                  <div class="flex items-center justify-between gap-2">
                     <span class="text-slate-400 font-medium">Prompt Template</span>
                     <span class="text-accent-400 font-bold truncate max-w-[240px]" :title="displayPromptTemplate">
                        {{ displayPromptTemplate }}
                     </span>
                  </div>
               </div>
            </div>

            <!-- Shimmer Skeleton Placeholder (URL Ingestion Pre-Metadata) -->
            <div v-else class="flex flex-col md:flex-row justify-between gap-6 animate-pulse">
               <div class="flex-1 flex items-start gap-4">
                  <div class="w-28 sm:w-36 aspect-video bg-surface-border/20 border border-surface-border/40 shrink-0 flex items-center justify-center">
                     <Icon name="ri:loader-4-line" class="text-slate-500 text-xl animate-spin" />
                  </div>
                  <div class="flex-1 flex flex-col justify-center gap-2 pt-1">
                     <div class="h-4 bg-surface-border/30 rounded-none w-3/4"></div>
                     <div class="h-3 bg-surface-border/20 rounded-none w-1/2"></div>
                     <div class="h-3 bg-surface-border/20 rounded-none w-1/3"></div>
                  </div>
               </div>
               <div class="flex-1 md:border-l border-surface-border/50 md:pl-6 flex flex-col justify-center gap-3">
                  <div class="h-4 bg-surface-border/20 rounded-none w-full"></div>
                  <div class="h-4 bg-surface-border/20 rounded-none w-3/4"></div>
               </div>
            </div>
         </div>

         <!-- Cancel Escape Route -->
         <button 
           @click="$emit('cancel')" 
           class="z-10 mt-8 h-9 px-6 bg-surface-dark border border-surface-border/80 hover:border-red-500/30 hover:text-red-400 rounded-none cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none select-none active:scale-98"
         >
           <Icon name="ri:close-circle-line" class="text-sm" />
           <span>Cancel & Return to Library</span>
         </button>
     </div>
  </div>
</template>

<script setup lang="ts">
import type { CachedVideo } from '../../types/clipper'

interface StageItem {
  id: string
  name: string
  description: string
  icon: string
  state: string
}

defineProps<{
  stages: StageItem[]
  progressPercent: number
  loadingLabel: string
  isReanalyzingCached?: boolean
}>()

defineEmits<{
  (e: 'cancel'): void
}>()

const state = useClipperState()
const API_BASE = 'http://localhost:8000'
const thumbnailLoadError = ref(false)

function extractYoutubeId(url: string): string | null {
  if (!url) return null
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i
  const match = url.match(reg)
  return match ? (match[1] ?? null) : null
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function formatIntentPreset(preset?: string): string {
  if (!preset) return 'Auto Virality'
  const map: Record<string, string> = {
    auto: 'Auto Virality',
    humor: 'Funny & Relatable',
    educational: 'Edukasi & Debunk',
    storytelling: 'Story & Deep Talk',
    debate: 'Hot Takes'
  }
  return map[preset] || (preset.charAt(0).toUpperCase() + preset.slice(1))
}

const displayPromptTemplate = computed(() => {
  if (state.extractionMode?.value === 'custom' || (state.selectedPrompt?.value && state.selectedPrompt.value !== 'prompt.json')) {
    const found = state.promptsList?.value?.find((p: any) => p.id === state.selectedPrompt?.value)
    if (found?.name) return found.name
    if (state.selectedPrompt?.value) {
      return state.selectedPrompt.value.replace(/\.json$/i, '')
    }
  }

  return formatIntentPreset(state.selectedPresetId?.value)
})

const activeCachedVideo = computed<CachedVideo | null>(() => {
  const cached = state.cachedVideos?.value
  if (!cached || !cached.length) return null
  
  if (state.folderName?.value) {
    const byFolder = cached.find((v: CachedVideo) => v.folder_name === state.folderName.value)
    if (byFolder) return byFolder
  }
  
  const ytId = extractYoutubeId(state.youtubeUrl?.value || '')
  if (ytId) {
    const byId = cached.find((v: CachedVideo) => v.video_id === ytId)
    if (byId) return byId
  }
  
  if (state.videoTitle?.value) {
    const byTitle = cached.find((v: CachedVideo) => v.title === state.videoTitle?.value)
    if (byTitle) return byTitle
  }
  
  return null
})

const displayTitle = computed(() => {
  return state.videoTitle?.value || activeCachedVideo.value?.title || ''
})

const displayDuration = computed(() => {
  return state.videoDuration?.value || activeCachedVideo.value?.duration || 0
})

const displayChannel = computed(() => {
  return activeCachedVideo.value?.channel || ''
})

const displayAddedDate = computed(() => {
  const ts = activeCachedVideo.value?.added_at ?? activeCachedVideo.value?.mtime
  if (ts) {
    const ms = ts < 1e11 ? ts * 1000 : ts
    const d = new Date(ms)
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const now = new Date()
  return now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
})

const displayThumbnail = computed(() => {
  if (activeCachedVideo.value?.thumbnail_url) {
    return `${API_BASE}${activeCachedVideo.value.thumbnail_url}`
  }
  if (activeCachedVideo.value?.thumbnail) {
    return activeCachedVideo.value.thumbnail
  }
  const ytId = extractYoutubeId(state.youtubeUrl?.value || '') || activeCachedVideo.value?.video_id
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  }
  return null
})

watch(displayThumbnail, () => {
  thumbnailLoadError.value = false
})

const sourceVideoLink = computed(() => {
  if (state.youtubeUrl?.value) return state.youtubeUrl.value
  const ytId = activeCachedVideo.value?.video_id || extractYoutubeId(state.videoUrl?.value || '')
  if (ytId) return `https://youtube.com/watch?v=${ytId}`
  return null
})

const hasVideoMetadata = computed(() => {
  return !!displayTitle.value
})
</script>

<style scoped>
@keyframes shimmer-fast {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer-fast {
  animation: shimmer-fast 1.5s infinite linear;
}

@keyframes progress-sweep {
  0% { width: 0%; }
  100% { width: 100%; }
}

.animate-progress-sweep {
  animation: progress-sweep 800ms cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}
</style>
