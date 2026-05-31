<template>
  <!-- Backdrop Overlay (Only in floating mode) -->
  <Transition
    v-if="isFloating"
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="!isCollapsed" 
      @click="isCollapsed = true"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[55]"
    ></div>
  </Transition>

  <!-- Container with dynamic footprint -->
  <div 
    class="h-full shrink-0 transition-all duration-300 ease-in-out"
    :class="isFloating ? 'w-[64px] relative z-[60]' : 'relative border-r border-surface-border z-30'"
    :style="{ width: isFloating ? '64px' : (isCollapsed ? '64px' : `${sidebarWidth}px`) }"
  >
    <aside 
      class="bg-surface-dark flex flex-col h-full transition-all duration-300 ease-in-out overflow-visible"
      :class="[
        isFloating ? 'absolute top-0 left-0 shadow-2xl border-r border-surface-border' : 'relative w-full h-full',
        !isCollapsed && isFloating ? 'backdrop-blur-xl bg-surface-dark/95' : ''
      ]"
      :style="{ width: isCollapsed ? '64px' : `${sidebarWidth}px` }"
    >
      <!-- Toggle Button -->
      <div class="absolute -right-3 top-[72px] z-[9999]">
        <button 
          @click="isCollapsed = !isCollapsed"
          class="w-6 h-6 bg-surface-card border border-surface-border rounded-full flex items-center justify-center text-slate-400 hover:text-accent-500 hover:border-accent-500/50 shadow-md transition-colors"
          :title="isCollapsed ? 'Expand Sidebar (Cmd+B)' : 'Collapse Sidebar (Cmd+B)'"
        >
          <Icon :name="isCollapsed ? 'ri:arrow-right-s-line' : 'ri:arrow-left-s-line'" />
        </button>
      </div>

      <!-- Resizer Handle -->
      <div 
        v-if="!isCollapsed"
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-500/50 transition-colors z-40 group"
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
              @click="handleNav('home')"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              :class="activeView === 'home' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
              :title="isCollapsed ? 'Home' : ''"
            >
              <Icon name="ri:home-smile-fill" class="text-xl shrink-0" />
              <span v-if="!isCollapsed" class="whitespace-nowrap">Home</span>
            </button>


            <div class="flex flex-col">
              <button 
                @click="handleNav('settings')"
                class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group/settings w-full text-left"
                :class="activeView === 'settings' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
                :title="isCollapsed ? 'Settings' : ''"
              >
                <div class="relative flex items-center justify-center">
                  <Icon name="ri:settings-4-fill" class="text-xl shrink-0" />
                  <div 
                    v-if="state.isAnyPrerequisiteMissing.value && isCollapsed"
                    class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-surface-dark animate-pulse-amber"
                  ></div>
                </div>
                <div v-if="!isCollapsed" class="flex items-center justify-between flex-1 min-w-0">
                  <span class="whitespace-nowrap font-semibold">Settings</span>
                  <div class="flex items-center gap-2">
                    <div 
                      v-if="state.isAnyPrerequisiteMissing.value"
                      class="w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse-amber mr-1 shrink-0"
                      title="Prerequisite health check is missing or unconfigured"
                    ></div>
                    <div
                      @click.stop="isSettingsSubnavExpanded = !isSettingsSubnavExpanded"
                      class="p-1 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <Icon 
                        :name="isSettingsSubnavExpanded ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" 
                        class="text-base transition-transform duration-200"
                      />
                    </div>
                  </div>
                </div>
              </button>

              <!-- Collapsible Subsection List -->
              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="opacity-0 -translate-y-2 max-h-0"
                enter-to-class="opacity-100 translate-y-0 max-h-60"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="opacity-100 translate-y-0 max-h-60"
                leave-to-class="opacity-0 -translate-y-2 max-h-0"
              >
                <div 
                  v-if="!isCollapsed && isSettingsSubnavExpanded" 
                  class="pl-4 pr-2 py-1.5 flex flex-col gap-1 border-l border-surface-border/50 ml-5 overflow-hidden"
                >
                  <button 
                    v-for="sub in [
                      { id: 'settings-health', name: 'Prerequisites & Health', icon: 'ri:shield-cross-line', hasWarning: isHealthWarning },
                      { id: 'settings-api', name: 'API Configuration', icon: 'ri:key-2-line', hasWarning: isApiWarning },
                      { id: 'settings-whisper', name: 'Transcription Engine', icon: 'ri:cpu-line', hasWarning: false },
                      { id: 'settings-cookies', name: 'YouTube Cookies', icon: 'ri:shield-keyhole-line', hasWarning: isCookiesWarning },
                      { id: 'settings-env', name: 'Environment Paths', icon: 'ri:terminal-window-line', hasWarning: false }
                    ]"
                    :key="sub.id"
                    @click="scrollToSettingsSection(sub.id)"
                    class="flex items-center gap-2 py-2 px-1.5 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors text-left rounded hover:bg-surface-panel/40 w-full"
                  >
                    <Icon :name="sub.icon" class="text-sm shrink-0 text-slate-500" />
                    <span class="truncate flex-1 tracking-wider uppercase text-[10.5px]">{{ sub.name }}</span>
                    <div 
                      v-if="sub.hasWarning" 
                      class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.6)] mr-1"
                    ></div>
                  </button>
                </div>
              </Transition>
            </div>
            <button 
              @click="handleNav('prompts')"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              :class="activeView === 'prompts' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
              :title="isCollapsed ? 'Prompts' : ''"
            >
              <Icon name="ri:chat-quote-fill" class="text-xl shrink-0" />
              <span v-if="!isCollapsed" class="whitespace-nowrap">Prompts</span>
            </button>
            <button 
              @click="handleNav('docs')"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              :class="activeView === 'docs' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel'"
              :title="isCollapsed ? 'Documentation' : ''"
            >
              <Icon name="ri:book-read-fill" class="text-xl shrink-0" />
              <span v-if="!isCollapsed" class="whitespace-nowrap">Documentation</span>
            </button>

            <!-- Separator -->
            <div class="my-2 border-t border-surface-border/50 mx-2"></div>

            <!-- Continue Editing -->
            <button 
              v-if="lastClip && lastVideo && !isProcessing"
              @click="handleNav('editor')"
              class="flex items-center gap-3 px-2 py-2 rounded-lg transition-all group hover:bg-surface-panel"
              :title="isCollapsed ? `Continue Editing: ${lastClip.title || 'Clip'}` : ''"
            >
              <div class="w-8 h-8 rounded bg-surface-dark overflow-hidden shrink-0 border border-white/5 group-hover:border-accent-500/30 relative">
                 <img v-if="lastVideo.thumbnail" :src="`${API_BASE}/api/proxy-image?url=${encodeURIComponent(lastVideo.thumbnail)}`" class="w-full h-full object-cover" />
                 <div v-else class="w-full h-full flex items-center justify-center bg-accent-500/10 text-accent-500 text-xs">
                   <Icon name="ri:movie-2-line" />
                 </div>
                 <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Icon name="ri:edit-2-fill" class="text-white text-xs" />
                 </div>
              </div>
              <div v-if="!isCollapsed" class="overflow-hidden text-left flex-1">
                <div class="flex items-center justify-between mb-1">
                   <p class="text-[10px] text-accent-500 font-black uppercase tracking-tighter leading-none">{{ isFloating ? 'CURRENT WORK' : 'CONTINUE EDITING' }}</p>
                </div>
                <p class="text-[11px] text-white font-bold truncate leading-tight">{{ lastClip.title || 'Untitled Clip' }}</p>
                <p class="text-[9px] text-slate-500 truncate mt-0.5">{{ lastVideo.title || 'Untitled Video' }}</p>
              </div>
            </button>
          </div>

        </div>

        <!-- Footer / Status Dashboard -->
        <div class="mt-auto border-t border-surface-border">
          <!-- Expanded Status -->
          <div v-if="!isCollapsed" class="p-4 flex flex-col gap-4">
            
            <!-- Active Task -->
            <div v-if="isProcessing" class="bg-surface-panel/50 rounded-xl p-3 border border-amber-500/20 animate-pulse-subtle">
              <div class="flex items-center gap-2 mb-2">
                <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span class="text-[10px] font-bold text-amber-500 tracking-tighter uppercase">Active Job</span>
              </div>
              <p class="text-[11px] text-white font-medium line-clamp-1 mb-1">{{ processingTitle }}</p>
              <p class="text-[9px] text-slate-400 uppercase tracking-widest">{{ processingStatus }}</p>
            </div>

            <!-- System Status Micro-Badge -->
            <div class="flex items-center justify-between bg-[#111318]/50 border border-surface-border/50 rounded-xl px-3 py-2">
              <span class="text-[9px] uppercase font-bold text-slate-500 tracking-wider">System Status</span>
              <div class="flex items-center gap-1.5 mono text-[10px] text-slate-300 font-bold">
                 <span class="w-1.5 h-1.5 rounded-full" :class="statusColor"></span>
                 {{ statusLabel }}
              </div>
            </div>

            <!-- Storage Summary -->
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2 text-slate-500">
                <Icon name="ri:database-2-line" class="text-xs" />
                <span class="text-[9px] uppercase font-bold tracking-widest">{{ cachedVideos.length }} SOURCES</span>
              </div>
              <span class="text-[9px] text-slate-600 font-mono">V.0.4.2</span>
            </div>
          </div>

          <!-- Collapsed Status -->
          <div v-else class="flex flex-col items-center py-4 gap-4">
            <div 
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group"
              :class="isProcessing ? 'bg-amber-500/10 text-amber-500' : 'bg-surface-panel/50 text-slate-500'"
              @click="isCollapsed = false"
            >
              <Icon :name="isProcessing ? 'ri:loader-4-line' : 'ri:database-2-line'" :class="{ 'animate-spin': isProcessing }" class="text-xl" />
              <!-- Dynamic Status Dot Overlay -->
              <div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-dark shadow-[0_0_6px_rgba(0,0,0,0.5)] animate-pulse-subtle" :class="statusColor"></div>
              
              <!-- Tooltip -->
              <div class="absolute left-full ml-3 px-3 py-1.5 bg-surface-card border border-surface-border rounded-md text-[10px] text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {{ isProcessing ? `Processing: ${processingTitle}` : `${cachedVideos.length} Sources` }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

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

const statusLabel = computed(() => {
  return state?.jobStatus?.value?.toUpperCase()?.replace('_', ' ') || 'IDLE'
})

const isHealthWarning = computed(() => {
  const health = state.systemHealth.value
  if (!health) return false
  return ['ffmpeg', 'node', 'python_env'].some(key => health[key]?.status !== 'OK')
})

const isApiWarning = computed(() => {
  const health = state.systemHealth.value
  if (!health) return false
  return health.gemini_api?.status !== 'Configured'
})

const isCookiesWarning = computed(() => {
  const health = state.systemHealth.value
  if (!health) return false
  return health.cookies?.status !== 'Configured'
})

const props = defineProps<{
  activeView: string
  cachedVideos: any[]
  isProcessing: boolean
  processingTitle?: string
  processingStatus?: string
  lastVideo?: any
  lastClip?: any
  API_BASE: string
  defaultCollapsed?: boolean
  isFloating?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeView', view: string): void
  (e: 'analyze', videoId: string, force: boolean): void
  (e: 'redownload', vid: any): void
  (e: 'delete', vid: any): void
}>()

const isCollapsed = ref(props.defaultCollapsed ?? false)
const isSettingsSubnavExpanded = ref(true)
const sidebarWidth = ref(320)
const minWidth = 280
const maxWidth = 600
let isDragging = false

function handleNav(view: string) {
  emit('update:activeView', view)
  if (view === 'settings') {
    isSettingsSubnavExpanded.value = true
    navigateTo('/settings')
  } else if (view === 'prompts') {
    navigateTo('/prompts')
  } else if (view === 'docs') {
    navigateTo('/docs')
  } else if (view === 'home') {
    navigateTo('/')
  }
  if (props.isFloating) {
    isCollapsed.value = true
  }
}

function scrollToSettingsSection(sectionId: string) {
  if (props.activeView !== 'settings') {
    handleNav('settings')
  }
  state.settingsScrollTarget.value = sectionId
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
    localStorage.setItem('yonru_sidebar_width', sidebarWidth.value.toString())
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault()
    isCollapsed.value = !isCollapsed.value
  }
}

onMounted(() => {
  const savedWidth = localStorage.getItem('yonru_sidebar_width')
  if (savedWidth) {
    sidebarWidth.value = parseInt(savedWidth)
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('keydown', handleKeydown)
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

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-amber {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0);
  }
}
.animate-pulse-amber {
  animation: pulse-amber 2s infinite;
}
</style>
