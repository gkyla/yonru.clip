<template>
  <div v-if="state" class="h-14 border-b border-surface-border bg-surface-dark flex items-center px-6 justify-between shrink-0 shadow-sm z-50 relative">
    <div class="flex gap-4 ml-auto">
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
