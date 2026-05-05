<template>
  <aside 
    class="bg-surface-dark border-r border-surface-border flex flex-col h-full shrink-0 relative transition-all duration-300 ease-in-out"
    :style="{ width: isCollapsed ? '64px' : `${sidebarWidth}px` }"
  >
    <!-- Toggle Button -->
    <div class="absolute -right-3 top-6 z-10">
      <button 
        @click="isCollapsed = !isCollapsed"
        class="w-6 h-6 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-slate-400 hover:text-accent-500 hover:border-accent-500/50 shadow-md transition-colors"
      >
        <Icon :name="isCollapsed ? 'ri:arrow-right-s-line' : 'ri:arrow-left-s-line'" />
      </button>
    </div>

    <!-- Resizer Handle -->
    <div 
      v-if="!isCollapsed"
      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-500/50 transition-colors z-10 group"
      @mousedown="startDrag"
    >
      <div class="absolute inset-y-0 -left-1 -right-1"></div>
    </div>

    <!-- Sidebar Content -->
    <div class="flex flex-col h-full overflow-hidden w-full">
      
      <!-- Header -->
      <div class="h-14 border-b border-surface-border flex items-center px-4 gap-3 shrink-0">
        <NuxtLink to="/" class="w-7 h-7 bg-accent-500 flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_rgba(207,255,80,0.3)] hover:scale-105 transition-transform cursor-pointer shrink-0">Y</NuxtLink>
        <div v-if="!isCollapsed" class="overflow-hidden">
          <h1 class="font-bold text-white tracking-widest text-[11px] leading-tight flex items-center gap-2 whitespace-nowrap">YONRU <span class="bg-surface-border text-[7px] px-1.5 py-0.5 rounded text-slate-400 normal-case">INTERNAL</span></h1>
          <p class="text-[9px] text-accent-500 mono whitespace-nowrap">AI SHORT ENGINE</p>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-3 gap-6">
        
        <!-- Navigation -->
        <div class="flex flex-col gap-1">
          <button 
            @click="$emit('update:activeView', 'home')"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
            :class="activeView === 'home' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
            :title="isCollapsed ? 'Home' : ''"
          >
            <Icon name="ri:home-smile-fill" class="text-xl shrink-0" />
            <span v-if="!isCollapsed" class="whitespace-nowrap">Home</span>
          </button>
          <button 
            @click="$emit('update:activeView', 'settings')"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
            :class="activeView === 'settings' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
            :title="isCollapsed ? 'Settings' : ''"
          >
            <Icon name="ri:settings-4-fill" class="text-xl shrink-0" />
            <span v-if="!isCollapsed" class="whitespace-nowrap">Settings</span>
          </button>
          <button 
            @click="$emit('update:activeView', 'prompts')"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
            :class="activeView === 'prompts' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
            :title="isCollapsed ? 'Prompts' : ''"
          >
            <Icon name="ri:chat-quote-fill" class="text-xl shrink-0" />
            <span v-if="!isCollapsed" class="whitespace-nowrap">Prompts</span>
          </button>
          <button 
            @click="$emit('update:activeView', 'docs')"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
            :class="activeView === 'docs' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
            :title="isCollapsed ? 'Documentation' : ''"
          >
            <Icon name="ri:book-read-fill" class="text-xl shrink-0" />
            <span v-if="!isCollapsed" class="whitespace-nowrap">Documentation</span>
          </button>
        </div>

      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  activeView: string
  cachedVideos: any[]
  isProcessing: boolean
  API_BASE: string
}>()

const emit = defineEmits<{
  (e: 'update:activeView', view: string): void
  (e: 'analyze', videoId: string, force: boolean): void
  (e: 'redownload', vid: any): void
  (e: 'delete', vid: any): void
}>()

const isCollapsed = ref(false)
const sidebarWidth = ref(320)
const minWidth = 280
const maxWidth = 600
let isDragging = false

function formatSec(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function startDrag(e: MouseEvent) {
  isDragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onDrag(e: MouseEvent) {
  if (!isDragging) return
  let newWidth = e.clientX
  if (newWidth < minWidth) newWidth = minWidth
  if (newWidth > maxWidth) newWidth = maxWidth
  sidebarWidth.value = newWidth
}

function stopDrag() {
  if (isDragging) {
    isDragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.05);
  border-radius: 0;
}
</style>
