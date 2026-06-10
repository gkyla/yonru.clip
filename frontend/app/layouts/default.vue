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


</script>
