<template>
  <div v-if="state" class="h-14 border-b border-surface-border bg-surface-dark flex items-center px-6 justify-between shrink-0 shadow-sm z-50 relative">
    <div class="flex items-center gap-3" v-if="route.path !== '/'">
      <NuxtLink to="/" class="w-7 h-7 rounded bg-accent-500 flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_rgba(207,255,80,0.3)] hover:scale-105 transition-transform cursor-pointer">Y</NuxtLink>
      <div>
        <h1 class="font-bold text-white tracking-widest text-[11px] leading-tight flex items-center gap-2">YONRU <span class="bg-surface-border text-[7px] px-1.5 py-0.5 rounded text-slate-400 normal-case">INTERNAL</span></h1>
        <p class="text-[9px] text-accent-500 mono">AI SHORT ENGINE</p>
      </div>
    </div>
    <div v-else></div>
    
    <div class="flex gap-4">
      <div class="flex items-center gap-1.5 mono text-xs bg-[#111318] border border-surface-border px-3 py-1.5 rounded-full shadow-inner">
         <span class="w-2 h-2 rounded-full" :class="statusColor"></span>
         {{ state?.jobStatus?.value?.toUpperCase()?.replace('_', ' ') || 'IDLE' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const state = useClipperState()

const statusColor = computed(() => {
  const status = state?.jobStatus?.value || 'idle'
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
