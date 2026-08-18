<template>
  <div>
    <!-- Ready to Edit Section (Top 3 on Home) -->
    <div class="mb-4 overflow-visible p-8 pt-0">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Icon name="ri:scissors-cut-fill" class="text-accent-500" />
          Ready to Edit
        </h3>
        <button 
          v-if="readyClips.length > 3"
          @click="showAllReadyClips = true"
          class="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-accent-500 transition-colors flex items-center gap-2 cursor-pointer"
        >
          View All ({{ readyClips.length }})
          <Icon name="ri:arrow-right-s-line" />
        </button>
      </div>

      <!-- Skeletons -->
      <div v-if="isReadyClipsLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
         <div v-for="i in 3" :key="i" class="bg-surface-panel/30 border border-surface-border/50 rounded-2xl flex flex-col animate-pulse overflow-hidden">
            <div class="aspect-video bg-surface-dark flex items-center justify-center relative">
               <div class="w-6 h-6 border-2 border-accent-500/10 border-t-accent-500/30 rounded-full animate-spin"></div>
            </div>
            <div class="p-5 flex-1">
               <div class="flex items-center gap-2 mb-3">
                  <div class="w-10 h-3 bg-surface-dark rounded border border-surface-border/30"></div>
                  <div class="w-16 h-3 bg-surface-dark rounded border border-surface-border/30"></div>
               </div>
               <div class="w-full h-4 bg-surface-dark rounded mb-2"></div>
               <div class="w-2/3 h-2.5 bg-surface-dark/50 rounded"></div>
            </div>
         </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="readyClips.length === 0" class="bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center">
        <div class="w-16 h-16 bg-surface-dark rounded-full flex items-center justify-center mb-4 border border-surface-border/50">
           <Icon name="ri:movie-2-line" class="text-3xl text-slate-600" />
        </div>
        <h4 class="text-white font-bold text-lg mb-1">Your Video Library is Empty</h4>
        <p class="text-slate-500 text-sm max-w-sm">Paste a YouTube URL above to start generating viral clips automatically.</p>
      </div>

      <!-- Real Clips (Top 3) -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div 
          v-for="clip in readyClips.slice(0, 3)" :key="clip.clip_id"
          @click="$emit('load-clip', clip)"
          class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-2xl flex flex-col group hover:border-accent-500/50 hover:shadow-[0_0_30px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden"
        >
          <div class="aspect-video bg-black overflow-hidden relative">
            <div v-if="!loadedClips.has(clip.clip_id)" class="absolute inset-0 bg-surface-dark animate-pulse flex items-center justify-center z-10">
               <div class="w-6 h-6 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"></div>
            </div>

            <video 
              :src="`${API_BASE}${clip.asset_url}`"
              muted
              preload="metadata"
              class="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-500"
              :class="{ 'opacity-0': !loadedClips.has(clip.clip_id) }"
              @loadedmetadata="loadedClips.add(clip.clip_id)"
              @mouseenter="e => { const p = (e.target as HTMLVideoElement).play(); if (p !== undefined) p.catch(() => {}); }"
              @mouseleave="e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }"
            ></video>
            
            <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded-lg text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md border border-white/10 group-hover:opacity-0 transition-opacity duration-300">
              {{ formatSec(clip.duration ?? 0) }}
            </div>
            
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <Icon name="ri:play-circle-fill" class="text-4xl text-accent-500" />
            </div>

            <button 
              @click.stop="confirmDeleteClip(clip)"
              class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90 z-30 cursor-pointer"
            >
              <Icon name="ri:close-line" class="text-lg" />
            </button>
          </div>
          
          <div class="flex-1 p-5 relative">
            <div class="flex items-center gap-2 mb-2">
               <span class="bg-surface-dark border border-surface-border px-1.5 py-0.5 rounded text-[8px] font-black tracking-tighter text-accent-500 uppercase">READY</span>
               <span class="text-[9px] text-slate-500 font-mono italic">{{ clip.folder_name.split('_').pop() }}</span>
            </div>
            <h4 class="text-white font-bold text-sm line-clamp-1 leading-snug group-hover:text-accent-500 transition-colors">{{ clip.theme || 'Untitled Clip' }}</h4>
            <p class="text-[10px] text-slate-500 font-medium mt-1 truncate">{{ clip.title }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- View All Ready Clips Modal -->
    <div v-if="showAllReadyClips" class="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-black/90 backdrop-blur-xl" @click="showAllReadyClips = false"></div>
       
       <div class="relative w-full max-w-7xl bg-surface-dark border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 h-[85vh]">
          <div class="p-6 border-b border-surface-border flex items-center justify-between bg-surface-panel/30">
             <div class="flex items-center gap-3">
                <h3 class="text-xl font-bold text-white flex items-center gap-3">
                   <Icon name="ri:scissors-cut-fill" class="text-accent-500" />
                   All Ready Clips
                   <span class="text-sm font-mono text-slate-500 ml-2">({{ readyClips.length }})</span>
                </h3>
                
                <div v-if="isManageMode" class="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-2 duration-300">
                   <button 
                     @click="selectAllClips"
                     class="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-accent-500/10 text-accent-500 border border-accent-500/20 rounded-lg hover:bg-accent-500 hover:text-black transition-all cursor-pointer"
                   >
                     {{ selectedClips.size === readyClips.length ? 'Deselect All' : 'Select All' }}
                   </button>
                </div>
             </div>

             <div class="flex items-center gap-4">
                <button 
                  @click="toggleManageMode"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer"
                  :class="isManageMode ? 'bg-accent-500 text-black shadow-[0_0_15px_rgba(207,255,80,0.3)]' : 'bg-surface-dark text-slate-400 border border-surface-border hover:text-white'"
                >
                   <Icon :name="isManageMode ? 'ri:check-line' : 'ri:settings-4-line'" />
                   {{ isManageMode ? 'Done' : 'Manage' }}
                </button>
                <button @click="showAllReadyClips = false" class="text-slate-400 hover:text-white transition-colors cursor-pointer">
                   <Icon name="ri:close-line" class="text-2xl" />
                </button>
             </div>
          </div>
          
          <div class="flex-1 relative overflow-hidden">
             <div v-if="readyClips.length > 0 && !readyClips.some(c => loadedClips.has(c.clip_id))" class="absolute inset-0 z-40 bg-surface-dark/60 backdrop-blur-md flex flex-col items-center justify-center">
                <div class="w-12 h-12 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin mb-4"></div>
                <p class="text-accent-500 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Initializing Library...</p>
             </div>

             <div v-else-if="readyClips.length === 0" class="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-500">
               <div class="w-20 h-20 bg-surface-panel rounded-full flex items-center justify-center mb-6 border border-surface-border">
                 <Icon name="ri:inbox-line" class="text-4xl text-slate-600" />
               </div>
               <h3 class="text-xl font-bold text-white mb-2">No Ready Clips Found</h3>
               <p class="text-slate-500 text-sm max-w-xs mb-8">Your library is currently empty. Start generating clips in the editor to populate this space.</p>
               <button @click="showAllReadyClips = false" class="bg-accent-500 text-black px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent-500/20 cursor-pointer">
                 Back to Editor
               </button>
             </div>

             <div class="p-8 h-full overflow-y-auto custom-scrollbar">
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div 
                      v-for="clip in paginatedReadyClips" :key="clip.clip_id"
                      @click="handleClipClick(clip)"
                      class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-xl flex flex-col group hover:border-accent-500/50 hover:shadow-[0_0_30px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden"
                      :class="{ 'ring-2 ring-accent-500 ring-offset-4 ring-offset-[#060608]': isManageMode && selectedClips.has(clip.clip_id) }"
                    >
                      <!-- Selection Checkbox -->
                      <div v-if="isManageMode" class="absolute top-2 left-2 z-40">
                         <div class="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all" 
                              :class="selectedClips.has(clip.clip_id) ? 'bg-accent-500 border-accent-500 shadow-[0_0_10px_rgba(207,255,80,0.5)]' : 'bg-black/50 border-white/30 hover:border-white/60'">
                           <Icon v-if="selectedClips.has(clip.clip_id)" name="ri:check-line" class="text-black text-sm font-bold" />
                         </div>
                      </div>

                      <div class="aspect-video bg-black overflow-hidden relative">
                        <div v-if="!loadedClips.has(clip.clip_id)" class="absolute inset-0 bg-surface-dark animate-pulse flex items-center justify-center z-10">
                           <div class="w-6 h-6 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin"></div>
                        </div>
                        <video 
                          :src="`${API_BASE}${clip.asset_url}`"
                          muted
                          preload="metadata"
                          class="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-500"
                          :class="{ 'opacity-0': !loadedClips.has(clip.clip_id), 'opacity-30': isManageMode && selectedClips.has(clip.clip_id) }"
                          @loadedmetadata="loadedClips.add(clip.clip_id)"
                          @mouseenter="e => { if (!isManageMode) { const p = (e.target as HTMLVideoElement).play(); if (p !== undefined) p.catch(() => {}); } }"
                          @mouseleave="e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }"
                        ></video>
                        <div class="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[9px] text-white font-mono font-bold tracking-widest backdrop-blur-md border border-white/10">
                          {{ formatSec(clip.duration ?? 0) }}
                        </div>

                        <button 
                          v-if="!isManageMode"
                          @click.stop="confirmDeleteClip(clip)"
                          class="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-30 cursor-pointer"
                        >
                          <Icon name="ri:close-line" class="text-base" />
                        </button>
                      </div>
                      <div class="p-3">
                        <h4 class="text-white font-bold text-xs line-clamp-1 leading-snug group-hover:text-accent-500 transition-colors" :class="{ 'text-accent-500': isManageMode && selectedClips.has(clip.clip_id) }">{{ clip.theme || 'Untitled Clip' }}</h4>
                        <p class="text-[9px] text-slate-500 font-medium mt-1 truncate">{{ clip.title }}</p>
                      </div>
                    </div>
                </div>
             </div>
          </div>

          <!-- Floating Action Bar / Success Bar -->
          <div 
            v-if="(isManageMode && selectedClips.size > 0) || showSuccessState"
            class="absolute bottom-24 inset-x-0 flex justify-center z-50 px-8"
          >
            <!-- Success Bar -->
            <div v-if="showSuccessState" class="bg-emerald-500/90 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl p-4 px-8 flex items-center gap-4 shadow-[0_20px_50px_rgba(16,185,129,0.3)] animate-in slide-in-from-bottom-10 duration-500">
               <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                 <Icon name="ri:check-double-line" class="text-white text-xl" />
               </div>
               <div class="flex flex-col">
                  <span class="text-white font-black text-sm uppercase tracking-tight">Success!</span>
                  <span class="text-white/80 text-[10px] font-bold uppercase tracking-widest">{{ lastDeletedCount }} Clips removed forever</span>
               </div>
               <button @click="showSuccessState = false" class="ml-4 text-white/50 hover:text-white transition-colors cursor-pointer">
                 <Icon name="ri:close-line" class="text-xl" />
               </button>
            </div>

            <!-- Manage Bar -->
            <div v-else class="bg-surface-panel/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 px-6 flex items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 duration-500 ring-1 ring-white/5">
              <div class="flex flex-col">
                 <span class="text-accent-500 font-black text-xs uppercase tracking-tighter">{{ selectedClips.size }} CLIPS SELECTED</span>
                 <span class="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Bulk Actions</span>
              </div>
              
              <div class="h-8 w-px bg-white/10 mx-2"></div>
              
              <button 
                @click="confirmDeleteSelectedClips"
                :disabled="isBatchDeleting"
                class="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Icon v-if="isBatchDeleting" name="ri:loader-4-line" class="animate-spin" />
                <Icon v-else name="ri:delete-bin-line" />
                {{ isBatchDeleting ? 'Deleting...' : 'Delete Permanently' }}
              </button>
              
              <button 
                @click="clearSelection"
                class="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>

          <!-- Pagination Footer -->
          <div class="p-4 border-t border-surface-border bg-surface-panel/30 flex items-center justify-between px-8 shrink-0 z-50">
             <div class="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Page {{ clipsCurrentPage }} of {{ totalClipsPages || 1 }}
             </div>
             <div class="flex items-center gap-4">
                <button 
                  @click="clipsCurrentPage--" 
                  :disabled="clipsCurrentPage === 1"
                  class="px-4 py-2 bg-surface-dark border border-surface-border rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:text-accent-500 hover:border-accent-500/50 disabled:opacity-20 disabled:grayscale disabled:pointer-events-none transition-all cursor-pointer"
                >
                  [ PREV ]
                </button>
                <button 
                  @click="clipsCurrentPage++" 
                  :disabled="clipsCurrentPage === totalClipsPages || totalClipsPages === 0"
                  class="px-4 py-2 bg-surface-dark border border-surface-border rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:text-accent-500 hover:border-accent-500/50 disabled:opacity-20 disabled:grayscale disabled:pointer-events-none transition-all cursor-pointer"
                >
                  [ NEXT ]
                </button>
             </div>
          </div>
       </div>
    </div>

    <!-- Beautiful Glass Clip Deletion Warning Modal -->
    <div v-if="clipDeleteConfirmModalOpen" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="clipDeleteConfirmModalOpen = false"></div>
       
       <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[130]">
          <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
          
          <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
             <Icon name="ri:scissors-cut-line" class="text-3xl" />
          </div>

          <h3 class="text-2xl font-black text-white tracking-wide mb-3">Delete Ready Clip?</h3>
          
          <div class="bg-surface-panel/30 border border-surface-border rounded-xl p-4 mb-6 flex flex-col gap-1">
             <span class="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                {{ clipToDelete ? 'Selected Clip' : 'Clips Selected for Deletion' }}
             </span>
             <span class="text-white font-mono text-xs font-bold truncate">
                {{ clipToDelete ? (clipToDelete.theme || 'Untitled Clip') : `${selectedClips.size} ready clips` }}
             </span>
          </div>

          <div class="flex flex-col gap-4 text-xs mb-8">
             <div class="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
                <Icon name="ri:delete-bin-2-line" class="text-red-400 text-lg shrink-0 mt-0.5" />
                <div>
                   <h4 class="text-red-400 font-bold uppercase tracking-wider text-[10px] mb-1">Permanent Removal</h4>
                   <p class="text-slate-400 leading-relaxed font-semibold">This will permanently delete the local video segment, transcription assets, and saved timeline track files. This action cannot be undone.</p>
                </div>
             </div>
          </div>

          <div class="flex items-center gap-3 w-full">
             <button 
               @click="clipDeleteConfirmModalOpen = false"
               class="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
             >
                Cancel
             </button>
             <button 
               @click="executeDeleteClip"
               class="flex-1 py-3 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-[0.98] cursor-pointer"
             >
                Confirm Delete
             </button>
          </div>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReadyClip, CachedVideo } from '../../types/clipper'

const props = defineProps<{
  readyClips: ReadyClip[]
  isReadyClipsLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'load-clip', clip: ReadyClip): void
  (e: 'refresh-clips'): void
}>()

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const showAllReadyClips = ref(false)
const loadedClips = ref(new Set<string>())
const clipDeleteConfirmModalOpen = ref(false)
const clipToDelete = ref<ReadyClip | null>(null)

const isManageMode = ref(false)
const selectedClips = ref(new Set<string>())
const isBatchDeleting = ref(false)
const showSuccessState = ref(false)
const lastDeletedCount = ref(0)
let successTimeout: ReturnType<typeof setTimeout> | null = null

const clipsCurrentPage = ref(1)
const clipsPageSize = 9
const paginatedReadyClips = computed(() => {
  const start = (clipsCurrentPage.value - 1) * clipsPageSize
  return props.readyClips.slice(start, start + clipsPageSize)
})
const totalClipsPages = computed(() => Math.ceil(props.readyClips.length / clipsPageSize))

watch(showAllReadyClips, (val) => {
  if (val) {
    clipsCurrentPage.value = 1
    isManageMode.value = false
    selectedClips.value = new Set()
  }
})

function formatSec(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function toggleManageMode() {
  isManageMode.value = !isManageMode.value
  if (!isManageMode.value) {
    selectedClips.value = new Set()
  }
}

function clearSelection() {
  selectedClips.value = new Set()
}

function handleClipClick(clip: ReadyClip) {
  if (isManageMode.value) {
    const next = new Set(selectedClips.value)
    if (next.has(clip.clip_id)) {
      next.delete(clip.clip_id)
    } else {
      next.add(clip.clip_id)
    }
    selectedClips.value = next
  } else {
    const parentVid = state.cachedVideos.value.find((v: CachedVideo) => v.folder_name === clip.folder_name)
    if (parentVid) state.setLastAccessed(parentVid.video_id)
    emit('load-clip', clip)
  }
}

function selectAllClips() {
  if (selectedClips.value.size === props.readyClips.length) {
    selectedClips.value = new Set()
  } else {
    selectedClips.value = new Set(props.readyClips.map(c => c.clip_id))
  }
}

function confirmDeleteClip(clip: ReadyClip) {
  clipToDelete.value = clip
  clipDeleteConfirmModalOpen.value = true
}

function confirmDeleteSelectedClips() {
  if (selectedClips.value.size === 0) return
  clipToDelete.value = null
  clipDeleteConfirmModalOpen.value = true
}

async function executeDeleteClip() {
  try {
    if (clipToDelete.value) {
      const clip = clipToDelete.value
      await $fetch(`${API_BASE}/api/ready-clips/${clip.folder_name}/${clip.clip_id}`, { method: 'DELETE' })
      state.showToast('Clip successfully deleted.', 'success')
      emit('refresh-clips')
    } else if (selectedClips.value.size > 0) {
      const count = selectedClips.value.size
      isBatchDeleting.value = true
      const clipsToDelete = props.readyClips
        .filter(c => selectedClips.value.has(c.clip_id))
        .map(c => ({ folder_name: c.folder_name, clip_id: c.clip_id }))
      
      await $fetch(`${API_BASE}/api/ready-clips/delete-batch`, {
        method: 'POST',
        body: { clips: clipsToDelete }
      })
      
      lastDeletedCount.value = count
      showSuccessState.value = true
      if (successTimeout) clearTimeout(successTimeout)
      successTimeout = setTimeout(() => {
        showSuccessState.value = false
      }, 5000)

      selectedClips.value = new Set()
      isManageMode.value = false
      state.showToast(`${count} clips successfully deleted.`, 'success')
      emit('refresh-clips')
    }
  } catch (e: unknown) {
    console.error('Failed to delete clip(s)', e)
    const msg = e instanceof Error ? e.message : String(e)
    state.showToast(msg, 'error')
  } finally {
    clipDeleteConfirmModalOpen.value = false
    clipToDelete.value = null
    isBatchDeleting.value = false
  }
}
</script>
