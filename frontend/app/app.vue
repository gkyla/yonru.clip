<template>
  <div class="h-screen bg-[#060608] text-slate-300 font-sans flex flex-col overflow-hidden selection:bg-accent-500/30">
    <!-- Page Content -->
    <NuxtErrorBoundary>
      <NuxtPage keepalive />
      <template #error="{ error, clearError }">
        <div class="flex-1 flex items-center justify-center bg-red-950/50 p-8">
          <div class="max-w-xl bg-surface-panel border border-red-500/30 rounded-2xl p-8 text-center">
            <Icon name="ri:error-warning-fill" class="text-5xl text-red-500 mb-4" />
            <h2 class="text-xl font-black text-red-400 uppercase tracking-wider mb-2">Page Crash</h2>
            <p class="text-sm text-slate-400 mb-4">A runtime error prevented this page from loading:</p>
            <pre class="text-left bg-black/50 border border-red-500/20 rounded-xl p-4 text-xs text-red-300 overflow-auto max-h-48 mb-6 font-mono">{{ error }}</pre>
            <button @click="clearError" class="bg-accent-500 text-black px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-accent-400 transition-all">
              Clear & Retry
            </button>
          </div>
        </div>
      </template>
    </NuxtErrorBoundary>
    
    <!-- Cinematic Loading Overlay (Global) -->
    <Transition
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="opacity-0 scale-105"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-700 ease-in-out"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div v-if="state.isNavigatingToEditor.value" class="fixed inset-0 z-[99999] bg-[#060608]/95 backdrop-blur-2xl flex flex-col items-center justify-center overflow-hidden">
        <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay"></div>
        <div class="absolute w-[60vw] h-[60vw] rounded-full bg-accent-500/10 blur-[150px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-screen animate-pulse"></div>
        
        <div class="w-24 h-24 rounded-full border-[4px] border-surface-border border-t-accent-500 animate-spin flex items-center justify-center mb-10 shadow-[0_0_30px_#CFFF50_inset,0_0_50px_rgba(207,255,80,0.4)] relative z-10"></div>
        
        <h2 class="text-3xl font-black text-white tracking-[0.2em] uppercase mb-4 relative z-10">Initializing Editor</h2>
        <p class="text-slate-400 font-mono text-sm uppercase tracking-widest animate-pulse relative z-10">Loading Timeline & Assets...</p>
      </div>
    </Transition>

    <!-- Toast Notifications -->
    <div class="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <Transition
        enter-active-class="transition duration-500 ease-out transform"
        enter-from-class="translate-y-4 opacity-0 scale-95"
        enter-to-class="translate-y-0 opacity-100 scale-100"
        leave-active-class="transition duration-300 ease-in transform"
        leave-from-class="translate-y-0 opacity-100 scale-100"
        leave-to-class="translate-y-4 opacity-0 scale-95"
      >
        <div v-if="state.toast.value" class="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[300px]"
          :class="[
            state.toast.value.type === 'success' ? 'bg-accent-500/10 border-accent-500/20 text-accent-500' :
            state.toast.value.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
            'bg-white/10 border-white/20 text-white'
          ]"
        >
          <Icon :name="state.toast.value.type === 'success' ? 'ri:checkbox-circle-fill' : 'ri:error-warning-fill'" class="text-xl shrink-0" />
          <span class="text-sm font-bold tracking-wide uppercase">{{ state.toast.value.message }}</span>
        </div>
      </Transition>
    </div>

    <!-- Hidden Font Preloader -->
    <div class="font-preloader" aria-hidden="true">
      <span class="font-p-montserrat">a</span>
      <span class="font-p-inter">a</span>
      <span class="font-p-bebas">a</span>
      <span class="font-p-oswald">a</span>
      <span class="font-p-poppins">a</span>
      <span class="font-p-outfit">a</span>
      <span class="font-p-noto">a</span>
      <span class="font-p-roboto">a</span>
      <span class="font-p-playfair">a</span>
      <span class="font-p-anton">a</span>
      <span class="font-p-bangers">a</span>
      <span class="font-p-marker">a</span>
      <span class="font-p-russo">a</span>
      <span class="font-p-teko">a</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const state = useClipperState()

onMounted(() => {
  state.initPersistence()
})

const statusColor = computed(() => {
  const status = state.jobStatus.value
  const map: Record<string, string> = {
    idle: 'bg-slate-600',
    queued: 'bg-amber-500',
    downloading_audio: 'bg-sky-500 animate-pulse',
    transcribing: 'bg-violet-500 animate-pulse',
    generating_hooks: 'bg-fuchsia-500 animate-pulse',
    hooks_ready: 'bg-accent-500 shadow-[0_0_8px_#CFFF50]',
    extracting_video: 'bg-sky-500 animate-pulse',
    cutting: 'bg-sky-400 animate-pulse',
    ready: 'bg-accent-500 shadow-[0_0_8px_#CFFF50]',
    error: 'bg-red-500 shadow-[0_0_8px_#ef4444]'
  }
  return map[status] || 'bg-slate-600'
})
</script>
