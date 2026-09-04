<template>
  <!-- Cached Library -->
  <div v-if="(cachedVideos.length > 0 || isCachedLoading || state.cachedVideosSearch.value) && !isProcessing && !state.hooks.value.length" class="mb-14 overflow-visible p-8">
    <div class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
      <h3 class="text-xl font-bold text-white tracking-tight flex items-center gap-2 shrink-0">
        <Icon name="ri:folder-video-fill" class="text-accent-500" />
        Cached Library
      </h3>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        <!-- Search Input -->
        <div class="relative flex items-center bg-surface-dark border border-surface-border focus-within:border-accent-500/50 transition-colors h-9 px-3 w-full sm:w-64 rounded-none">
          <div class="w-4 h-4 relative flex items-center justify-center shrink-0 mr-2 select-none">
            <Transition name="scale-fade">
              <Icon v-if="isCachedLoading || isSearchPending" key="loading" name="ri:loader-2-line" class="absolute inset-0 animate-spin text-accent-500 text-sm" />
              <Icon v-else key="search" name="ri:search-line" class="absolute inset-0 text-slate-500 text-sm" />
            </Transition>
          </div>
          <input 
            v-model="state.cachedVideosSearch.value"
            type="text" 
            placeholder="Search cached videos..." 
            class="bg-transparent border-none text-white text-xs focus:ring-0 focus:outline-none w-full normal-case font-medium"
          />
          <button 
            v-if="state.cachedVideosSearch.value && !isCachedLoading && !isSearchPending"
            @click="state.cachedVideosSearch.value = ''"
            class="text-slate-500 hover:text-white shrink-0 ml-1 cursor-pointer"
          >
            <Icon name="ri:close-fill" class="text-sm" />
          </button>
        </div>

        <!-- Sort Dropdown -->
        <div ref="sortDropdownRef" class="relative shrink-0 select-none">
          <button 
            @click="isSortDropdownOpen = !isSortDropdownOpen"
            class="h-9 bg-surface-dark border border-surface-border text-slate-300 px-3 py-2 rounded-none text-xs font-bold uppercase tracking-wider focus:outline-none focus:border-accent-500/50 flex items-center justify-between gap-2.5 cursor-pointer min-w-[150px]"
          >
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 relative flex items-center justify-center shrink-0">
                <Transition name="scale-fade">
                  <Icon v-if="isCachedLoading" key="loading" name="ri:loader-2-line" class="absolute inset-0 animate-spin text-accent-500 text-sm" />
                  <Icon v-else :key="currentSortOption.value" :name="currentSortOption.icon" class="absolute inset-0 text-accent-500 text-sm" />
                </Transition>
              </div>
              <span class="truncate">{{ currentSortOption.label }}</span>
            </div>
            <Icon 
              name="ri:arrow-down-s-line" 
              class="text-slate-500 text-xs font-bold transition-transform duration-200" 
              :class="{ 'rotate-180': isSortDropdownOpen }"
            />
          </button>
          
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <div 
              v-if="isSortDropdownOpen"
              class="absolute top-full mt-1.5 right-0 w-44 bg-[#171a21]/95 backdrop-blur-md border border-surface-border rounded-none shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div class="overflow-y-auto max-h-60 custom-scrollbar">
                <button 
                  v-for="opt in sortOptions" 
                  :key="opt.value"
                  @click="selectSortOption(opt.value)"
                  class="w-full px-3 py-2 flex items-center justify-between text-left text-xs text-slate-300 hover:bg-accent-500/10 hover:text-accent-500 transition-colors font-semibold uppercase tracking-wider select-none cursor-pointer"
                >
                  <div class="flex items-center gap-2">
                    <Icon :name="opt.icon" class="text-xs shrink-0" :class="currentSortOption.value === opt.value ? 'text-accent-500' : 'text-slate-500'" />
                    <span class="truncate" :class="{ 'text-accent-500 font-black': currentSortOption.value === opt.value }">
                      {{ opt.label }}
                    </span>
                  </div>
                  <Icon 
                    v-if="currentSortOption.value === opt.value" 
                    name="ri:checkbox-circle-fill" 
                    class="text-accent-500 text-xs shrink-0 ml-2" 
                  />
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- View Mode Toggle -->
        <div class="flex items-center gap-1 bg-surface-dark border border-surface-border p-1 rounded-none shrink-0 h-9">
          <button 
            @click="viewMode = 'grid'" 
            class="p-1 rounded-none transition-all cursor-pointer h-full aspect-square flex items-center justify-center"
            :class="viewMode === 'grid' ? 'bg-surface-panel text-white shadow' : 'text-slate-500 hover:text-slate-300'"
          >
            <Icon name="ri:grid-fill" />
          </button>
          <button 
            @click="viewMode = 'list'" 
            class="p-1 rounded-none transition-all cursor-pointer h-full aspect-square flex items-center justify-center"
            :class="viewMode === 'list' ? 'bg-surface-panel text-white shadow' : 'text-slate-500 hover:text-slate-300'"
          >
            <Icon name="ri:list-check" />
          </button>
        </div>
      </div>
    </div>

    <Transition name="fade-layout" mode="out-in">
      <!-- Skeletons (Grid Mode) -->
      <div v-if="isCachedLoading && cachedVideos.length === 0" key="skeletons" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
         <div v-for="i in 3" :key="i" class="bg-surface-panel/30 border border-surface-border/50 rounded-2xl flex flex-col animate-pulse overflow-hidden">
            <div class="aspect-video bg-surface-dark flex items-center justify-center">
               <div class="w-6 h-6 border-2 border-accent-500/10 border-t-accent-500/30 rounded-full animate-spin"></div>
            </div>
            <div class="p-5">
               <div class="w-full h-4 bg-surface-dark rounded mb-2"></div>
               <div class="w-1/2 h-3 bg-surface-dark/70 rounded mb-4"></div>
               <div class="flex justify-between items-center pt-2 border-t border-surface-border/30">
                 <div class="w-1/4 h-2.5 bg-surface-dark/50 rounded"></div>
                 <div class="w-1/4 h-2.5 bg-surface-dark/50 rounded"></div>
               </div>
            </div>
         </div>
      </div>

      <!-- Empty Search State -->
      <div v-else-if="cachedVideos.length === 0 && !isCachedLoading" key="empty" class="bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-none p-12 flex flex-col items-center justify-center text-center">
        <div class="w-16 h-16 bg-surface-dark rounded-none flex items-center justify-center mb-4 border border-surface-border/50">
           <Icon name="ri:search-line" class="text-3xl text-slate-600" />
        </div>
        <h4 class="text-white font-bold text-lg mb-1">No videos found</h4>
        <p class="text-slate-500 text-sm max-w-sm font-sans normal-case tracking-normal">No videos match your search: "{{ state.cachedVideosSearch.value }}".</p>
      </div>

      <!-- Grid View -->
      <div v-else-if="viewMode === 'grid' && cachedVideos.length > 0" key="grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-200" :class="{ 'opacity-50 pointer-events-none': isCachedLoading }">
        <div 
          v-for="(vid, idx) in cachedVideos" :key="vid.video_id"
          class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-2xl flex flex-col group hover:border-accent-500/50 hover:shadow-[0_0_30px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden animate-fade-in-up"
          :class="{ 'opacity-50 pointer-events-none': isProcessing }"
          :style="{ animationDelay: `${idx * 40}ms` }"
        >
          <div class="aspect-video bg-black overflow-hidden relative">
            <img v-if="vid.thumbnail_url" :src="`${API_BASE}${vid.thumbnail_url}`" class="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-500" />
            <Icon v-else name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity" />
            
            <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded-lg text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md border border-white/10 group-hover:opacity-0 transition-opacity duration-300">
              {{ formatSec(vid.duration) }}
            </div>
          </div>
          
          <div class="flex-1 p-5 relative flex flex-col justify-between">
            <div>
              <h4 class="text-white font-bold text-sm line-clamp-2 leading-snug group-hover:text-accent-500 transition-colors">{{ vid.title }}</h4>
              <div class="flex items-center gap-1.5 mt-2 text-slate-300 font-semibold text-xs truncate" :title="vid.channel || 'Unknown Channel'">
                <span class="truncate">{{ vid.channel || 'Unknown Channel' }}</span>
              </div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-4 pt-2 border-t border-surface-border/30">
              <span class="flex items-center gap-1 cursor-default" :title="formatFullDateTime(vid.added_at ?? vid.mtime)">
                {{ formatRelativeTime(vid.added_at ?? vid.mtime) }}
              </span>
              <span>ID: {{ vid.video_id }}</span>
            </div>
          </div>

          <!-- Full Card Action Overlay -->
          <div class="absolute inset-0 bg-surface-dark/80 backdrop-blur-md opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 z-20 pointer-events-none">
            <!-- Center Action Buttons -->
            <div class="grid items-center gap-3 mb-4">
              <button 
                @click.stop="$emit('analyze-cached', vid.video_id, false)"
                class="bg-surface-card hover:bg-surface-panel border border-surface-border text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100 cursor-pointer"
              >
                <Icon name="ri:folder-open-line" class="text-base" />
                Load Cache Hooks
              </button>
              <button 
                @click.stop="$emit('reanalyze', vid.video_id)"
                class="bg-accent-500 hover:bg-accent-400 text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100 cursor-pointer"
              >
                <Icon name="ri:magic-line" class="text-base" />
                Reanalyze Hooks
              </button>
            </div>

            <!-- Bottom Utility Buttons -->
            <div class="absolute bottom-5 inset-x-0 flex justify-center items-center gap-3 pointer-events-auto">
              <a 
                :href="`https://youtube.com/watch?v=${vid.video_id}`" 
                target="_blank" 
                @click.stop 
                title="Watch on YouTube"
                class="py-2.5 px-3 bg-white/5 hover:bg-white/10 text-white hover:text-red-500 rounded-xl border border-white/10 transition-colors shadow-xl"
              >
                <Icon name="ri:youtube-fill" class="text-sm" />
              </a>
              <button 
                @click.stop="$emit('redownload', vid)"
                class="py-2.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-white rounded-xl border border-sky-500/20 transition-colors shadow-xl cursor-pointer"
                title="Refresh"
              >
                <Icon name="ri:download-cloud-2-line" class="text-sm" />
              </button>
              <button 
                @click.stop="confirmDelete(vid)"
                class="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-colors shadow-xl cursor-pointer"
                title="Delete"
              >
                <Icon name="ri:delete-bin-line" class="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div v-else-if="viewMode === 'list' && cachedVideos.length > 0" key="list" class="flex flex-col gap-3 transition-opacity duration-200" :class="{ 'opacity-50 pointer-events-none': isCachedLoading }">
        <div 
          v-for="(vid, idx) in cachedVideos" :key="vid.video_id"
          class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-2xl p-2 flex items-center gap-5 group hover:border-accent-500/50 hover:shadow-[0_0_20px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden animate-fade-in-up"
          :class="{ 'opacity-50 pointer-events-none': isProcessing }"
          :style="{ animationDelay: `${idx * 40}ms` }"
        >
          <div class="w-40 aspect-video bg-black rounded-lg overflow-hidden relative shrink-0">
            <img v-if="vid.thumbnail_url" :src="`${API_BASE}${vid.thumbnail_url}`" class="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-500" />
            <Icon v-else name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-xl opacity-50 group-hover:opacity-20 transition-opacity" />
            
            <div class="absolute bottom-1.5 right-1.5 bg-black/80 px-2 py-0.5 rounded-lg text-[9px] text-white font-mono font-bold tracking-widest backdrop-blur-md border border-white/10 group-hover:opacity-0 transition-opacity duration-300">
              {{ formatSec(vid.duration) }}
            </div>
          </div>
          
          <div class="flex-1 min-w-0 py-2 flex flex-col justify-center">
            <h4 class="text-white font-bold text-sm truncate group-hover:text-accent-500 transition-colors">{{ vid.title }}</h4>
            <div class="flex items-center gap-3 mt-1.5 text-[11px]">
              <div class="flex items-center text-slate-300 font-semibold truncate max-w-[200px]" :title="vid.channel || 'Unknown Channel'">
                <span class="truncate">{{ vid.channel || 'Unknown Channel' }}</span>
              </div>
              <span class="text-slate-600 select-none">•</span>
              <span class="text-[10px] text-slate-500 font-mono shrink-0 cursor-default" :title="formatFullDateTime(vid.added_at ?? vid.mtime)">
                {{ formatRelativeTime(vid.added_at ?? vid.mtime) }}
              </span>
              <span class="text-slate-600 select-none">•</span>
              <span class="text-[10px] text-slate-500 font-mono shrink-0">ID: {{ vid.video_id }}</span>
            </div>
          </div>

          <!-- Full Card Action Overlay -->
          <div class="absolute inset-0 bg-surface-dark/80 backdrop-blur-md opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-all duration-300 z-20 pointer-events-none">
            <button 
              @click.stop="$emit('analyze-cached', vid.video_id, false)"
              class="px-5 py-2.5 bg-surface-card hover:bg-surface-panel border border-surface-border text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100 cursor-pointer"
            >
              <Icon name="ri:folder-open-line" class="text-base" /> Load Cache
            </button>
            <button 
              @click.stop="$emit('reanalyze', vid.video_id)"
              class="px-5 py-2.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent-400 transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100 cursor-pointer"
            >
              <Icon name="ri:magic-line" class="text-base" /> Reanalyze
            </button>

            <div class="flex items-center gap-3 pointer-events-auto">
              <a 
                :href="`https://youtube.com/watch?v=${vid.video_id}`" 
                target="_blank" 
                @click.stop 
                class="p-2.5 bg-white/5 hover:bg-white/10 text-white hover:text-red-500 rounded-xl border border-white/10 transition-colors shadow-xl"
                title="Watch on YouTube"
              >
                <Icon name="ri:youtube-fill" class="text-base" />
              </a>
              <button 
                @click.stop="$emit('redownload', vid)"
                class="p-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-white rounded-xl border border-sky-500/20 transition-colors shadow-xl cursor-pointer"
                title="Refresh"
              >
                <Icon name="ri:download-cloud-2-line" class="text-base" />
              </button>
              <button 
                @click.stop="confirmDelete(vid)"
                class="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-colors shadow-xl cursor-pointer"
                title="Delete"
              >
                <Icon name="ri:delete-bin-line" class="text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Infinite Scroll Sentinel & Loading / Error States -->
    <div v-if="state.cachedVideosHasMore.value && !isCachedLoading && cachedVideos.length > 0" class="mt-8 flex flex-col items-center justify-center gap-3 relative min-h-[60px]">
       <div ref="scrollSentinel" class="absolute inset-0 pointer-events-none opacity-0"></div>

       <div v-if="state.isCachedMoreLoading.value" class="flex items-center gap-2 text-xs font-mono text-slate-500 tracking-wider">
         <Icon name="ri:loader-2-line" class="animate-spin text-accent-500 text-sm" />
         <span>LOADING MORE VIDEOS...</span>
       </div>

       <div v-else-if="state.cachedVideosFetchError.value" class="flex flex-col items-center gap-3 z-10">
         <span class="text-xs font-mono text-red-400 tracking-wider">FAILED TO LOAD VIDEOS</span>
         <button 
           @click="loadMoreCached"
           class="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 hover:text-white rounded-none cursor-pointer text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md"
         >
           RETRY
         </button>
       </div>
       
       <div v-else class="text-xs font-mono text-slate-600/50 tracking-wider">
         SCROLL TO LOAD MORE
       </div>
    </div>

    <!-- Duplicate Video Intercept Modal -->
    <div v-if="duplicateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="duplicateModalOpen = false"></div>
       
       <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
          <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
          
          <div class="w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(207,255,80,0.1)]">
             <Icon name="ri:information-fill" class="text-3xl" />
          </div>

          <h3 class="text-2xl font-black text-white tracking-wide mb-3">Video Already In Library</h3>
          <p class="text-slate-400 text-xs mb-6 font-semibold leading-relaxed">
             This video has already been downloaded and processed in your Cached Library. You can load it instantly or choose to reanalyze the hooks without downloading it again.
          </p>

          <div class="flex flex-col gap-3 w-full">
             <button 
               @click="() => { duplicateModalOpen = false; $emit('analyze-cached', duplicateVideoId, false); }"
               class="w-full py-3 bg-accent-500 text-black hover:bg-accent-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(207,255,80,0.2)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
             >
                <Icon name="ri:folder-open-line" class="text-sm" />
                Load Existing Hooks
             </button>
             <button 
               @click="() => { duplicateModalOpen = false; $emit('reanalyze', duplicateVideoId); }"
               class="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
             >
                <Icon name="ri:magic-line" class="text-sm text-accent-500" />
                Reanalyze Hooks Only
             </button>
             <button 
               @click="duplicateModalOpen = false"
               class="w-full py-3 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center cursor-pointer"
             >
                Cancel
             </button>
          </div>
       </div>
    </div>

    <!-- Video Deletion Confirmation Modal -->
    <div v-if="deleteConfirmModalOpen && videoToDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="deleteConfirmModalOpen = false"></div>
       
       <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
          <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
          
          <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
             <Icon name="ri:error-warning-fill" class="text-3xl" />
          </div>

          <h3 class="text-2xl font-black text-white tracking-wide mb-3">Delete Video Source?</h3>
          
          <div class="bg-surface-panel/30 border border-surface-border rounded-xl p-3 mb-6 flex flex-col gap-1">
             <span class="text-[10px] uppercase font-bold tracking-widest text-slate-500">Source Name</span>
             <span class="text-white font-mono text-xs font-bold truncate">{{ videoToDelete.title }}</span>
          </div>

          <div class="flex flex-col gap-4 text-xs mb-8">
             <div class="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
                <Icon name="ri:delete-bin-2-line" class="text-red-400 text-lg shrink-0 mt-0.5" />
                <div>
                   <h4 class="text-red-400 font-bold uppercase tracking-wider text-[10px] mb-1">Permanently Deleted</h4>
                   <p class="text-slate-400 leading-relaxed font-semibold">Raw high-resolution video file, audio tracks, transcripts, draft timelines, and AI-suggested hooks. This frees up major local disk space.</p>
                </div>
             </div>

             <div class="flex items-start gap-3 bg-accent-500/5 border border-accent-500/10 rounded-2xl p-4">
                <Icon name="ri:checkbox-circle-line" class="text-accent-500 text-lg shrink-0 mt-0.5" />
                <div>
                   <h4 class="text-accent-500 font-bold uppercase tracking-wider text-[10px] mb-1">Preserved & Saved</h4>
                   <p class="text-slate-400 leading-relaxed font-semibold">Your completed, fully rendered videos in your download folder are completely safe and will not be touched.</p>
                </div>
             </div>
             
             <div v-if="state.folderName.value === videoToDelete.folder_name" class="flex items-start gap-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">
                <Icon name="ri:refresh-line" class="text-amber-400 text-lg shrink-0 mt-0.5" />
                <div>
                   <h4 class="text-amber-400 font-bold uppercase tracking-wider text-[10px] mb-1">Active Editor Reset</h4>
                   <p class="text-slate-400 leading-relaxed font-semibold">This source is currently active. Deleting it will clear the editor workspace and reset your view.</p>
                </div>
             </div>
          </div>

          <div class="flex items-center gap-3 w-full">
             <button 
               @click="deleteConfirmModalOpen = false"
               class="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
             >
                Cancel
             </button>
             <button 
               @click="handleExecuteDeleteVideo"
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
import type { CachedVideo } from '../../types/clipper'

const props = defineProps<{
  cachedVideos: CachedVideo[]
  isCachedLoading: boolean
  isProcessing: boolean
}>()

const emit = defineEmits<{
  (e: 'analyze-cached', videoId: string, force?: boolean): void
  (e: 'reanalyze', videoId: string): void
  (e: 'redownload', vid: CachedVideo): void
  (e: 'delete-video', folderName: string): void
  (e: 'refresh-cached'): void
}>()

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const viewMode = ref<'grid' | 'list'>('grid')
const isSearchPending = ref(false)
const isSortDropdownOpen = ref(false)
const sortDropdownRef = ref<HTMLElement | null>(null)

const deleteConfirmModalOpen = ref(false)
const videoToDelete = ref<CachedVideo | null>(null)
const duplicateModalOpen = ref(false)
const duplicateVideoId = ref('')

const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

interface SortOption {
  value: string
  label: string
  icon: string
}

const sortOptions: SortOption[] = [
  { value: 'date:desc', label: 'NEWEST FIRST', icon: 'ri:calendar-line' },
  { value: 'date:asc', label: 'OLDEST FIRST', icon: 'ri:calendar-line' },
  { value: 'title:asc', label: 'TITLE A-Z', icon: 'ri:sort-asc' },
  { value: 'title:desc', label: 'TITLE Z-A', icon: 'ri:sort-desc' },
  { value: 'duration:desc', label: 'LONGEST FIRST', icon: 'ri:time-line' },
  { value: 'duration:asc', label: 'SHORTEST FIRST', icon: 'ri:time-line' }
]

const currentSortOption = computed<SortOption>(() => {
  const by = state.cachedVideosSortBy.value
  const order = state.cachedVideosSortOrder.value
  const val = `${by}:${order}`
  return sortOptions.find(o => o.value === val) || sortOptions[0]!
})

function selectSortOption(val: string) {
  const parts = val.split(':')
  const by = parts[0]
  const order = parts[1]
  if (by && order) {
    state.cachedVideosSortBy.value = by
    state.cachedVideosSortOrder.value = order
    state.fetchCached(true)
  }
  isSortDropdownOpen.value = false
}

function formatSec(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return 'Recently'
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp
  const now = Date.now()
  const diffSec = Math.floor((now - ms) / 1000)

  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`

  const date = new Date(ms)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatFullDateTime(timestamp?: number): string {
  if (!timestamp) return 'Added timestamp unavailable'
  const ms = timestamp < 1e11 ? timestamp * 1000 : timestamp
  const date = new Date(ms)
  return `Added on ${date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })}`
}

function confirmDelete(vid: CachedVideo) {
  videoToDelete.value = vid
  deleteConfirmModalOpen.value = true
}

function handleExecuteDeleteVideo() {
  if (videoToDelete.value) {
    emit('delete-video', videoToDelete.value.folder_name)
    deleteConfirmModalOpen.value = false
    videoToDelete.value = null
  }
}

function loadMoreCached() {
  state.cachedVideosPage.value += 1
  state.fetchCached(false)
}

function triggerLazyLoad() {
  if (
    state.cachedVideosHasMore.value &&
    !props.isCachedLoading &&
    !state.isCachedMoreLoading.value &&
    !state.cachedVideosFetchError.value
  ) {
    loadMoreCached()
  }
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as Node
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(target)) {
    isSortDropdownOpen.value = false
  }
}

watch(state.cachedVideosSearch, (newVal) => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  
  if (!newVal) {
    isSearchPending.value = false
    state.fetchCached(true)
  } else {
    isSearchPending.value = true
    searchDebounceTimer = setTimeout(() => {
      isSearchPending.value = false
      state.fetchCached(true)
    }, 300)
  }
})

watch(scrollSentinel, (newEl) => {
  if (observer) {
    observer.disconnect()
  }
  if (newEl && observer) {
    observer.observe(newEl)
  }
})

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      triggerLazyLoad()
    }
  }, {
    rootMargin: '150px'
  })
  
  if (scrollSentinel.value) {
    observer.observe(scrollSentinel.value)
  }
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleDocumentClick)
  }
  if (observer) {
    observer.disconnect()
  }
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
})

defineExpose({
  openDuplicateModal: (videoId: string) => {
    duplicateVideoId.value = videoId
    duplicateModalOpen.value = true
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

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: opacity 80ms ease, transform 80ms ease;
}
.scale-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
