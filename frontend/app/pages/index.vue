<template>
  <NuxtLayout>
    <div class="w-full max-w-5xl z-10 flex flex-col">
        <!-- Header Input Area -->
        <div class="text-center mt-12 mb-10">
          <h2 class="text-4xl font-bold tracking-tight text-white mb-4">Paste URL. Extract Hooks.</h2>
          <p class="text-slate-400 max-w-xl mx-auto mb-8">Download strict 1080p video, extract audio locally, and let Gemini find the most viral segments.</p>
          
          <!-- Unified Analyzer Panel -->
          <div class="px-8 w-full mb-10">
            <div class="bg-[#111318] border border-surface-border rounded-2xl p-4 flex flex-col gap-4 shadow-2xl relative">
              <!-- Row 1: YouTube URL Input + Analyze Button -->
              <div class="flex items-center gap-3 relative">
                 <input 
                   v-model="state.youtubeUrl.value"
                   type="url" 
                   placeholder="Paste YouTube video URL (e.g. https://youtube.com/watch?v=...)" 
                   class="flex-1 bg-surface-dark border border-surface-border text-white px-5 py-3.5 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all font-medium text-sm placeholder-slate-500 pr-10"
                   :disabled="isProcessing"
                 />
                 <button 
                   @click="handleAnalyzeClick" 
                   :disabled="!state.youtubeUrl.value || isProcessing"
                   class="px-6 py-3.5 bg-accent-500 text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-accent-400 hover:shadow-[0_0_15px_rgba(207,255,80,0.5)] focus:outline-none disabled:opacity-50 disabled:hover:shadow-none transition-all duration-300 shrink-0"
                 >
                   {{ isProcessing ? 'WORKING...' : 'ANALYZE' }}
                 </button>
              </div>
              
              <!-- Separator Line -->
              <div class="border-t border-surface-border/70"></div>

              <!-- Row 2: Prompt Selection & Transcription Settings Shortcut -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                <!-- AI Prompt dropdown selector -->
                <div class="flex items-center gap-2 flex-1 min-w-0">
                   <label class="text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0">AI PROMPT:</label>
                   <div ref="promptDropdownRef" class="relative flex-1 max-w-[350px]">
                     <!-- Dropdown Toggle Button -->
                     <button 
                       @click="isPromptDropdownOpen = !isPromptDropdownOpen"
                       :disabled="isProcessing"
                       class="w-full bg-surface-dark border border-surface-border text-white pl-3 pr-4 py-2.5 rounded-lg text-xs font-semibold focus:outline-none focus:border-accent-500/50 flex items-center justify-between cursor-pointer disabled:opacity-50 select-none"
                     >
                       <span class="truncate">{{ currentPrompt?.name || 'Select a Prompt' }}</span>
                       <Icon 
                         name="ri:arrow-down-s-line" 
                         class="text-slate-500 text-base font-bold transition-transform duration-200" 
                         :class="{ 'rotate-180': isPromptDropdownOpen }"
                       />
                     </button>
                     
                     <!-- Dropdown Menu Options Panel -->
                     <Transition
                       enter-active-class="transition duration-100 ease-out"
                       enter-from-class="transform scale-95 opacity-0"
                       enter-to-class="transform scale-100 opacity-100"
                       leave-active-class="transition duration-75 ease-in"
                       leave-from-class="transform scale-100 opacity-100"
                       leave-to-class="transform scale-95 opacity-0"
                     >
                       <div 
                         v-if="isPromptDropdownOpen"
                         class="absolute bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 left-0 w-full bg-[#171a21]/95 backdrop-blur-md border border-surface-border rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                       >
                         <!-- Prompt Options List -->
                         <div class="max-h-60 overflow-y-auto custom-scrollbar">
                           <button 
                             v-for="p in state.promptsList.value" 
                             :key="p.id"
                             @click="state.selectedPrompt.value = p.id; isPromptDropdownOpen = false"
                             @mouseenter="hoveredPrompt = p"
                             @mouseleave="hoveredPrompt = null"
                             class="w-full px-3 py-2 flex items-center justify-between text-left text-xs text-slate-300 hover:bg-accent-500/10 hover:text-accent-500 transition-colors font-medium select-none"
                           >
                             <span class="truncate" :class="{ 'text-accent-500 font-bold': state.selectedPrompt.value === p.id }">
                               {{ p.name }}
                             </span>
                             <Icon 
                               v-if="state.selectedPrompt.value === p.id" 
                               name="ri:checkbox-circle-fill" 
                               class="text-accent-500 text-sm shrink-0 ml-2" 
                             />
                           </button>
                         </div>
                         
                         <!-- Manage Prompts shortcut -->
                         <button 
                           @click="navigateTo('/prompts'); isPromptDropdownOpen = false"
                           class="w-full px-3 py-2.5 flex items-center gap-2 text-left text-xs font-black text-slate-400 hover:text-accent-500 bg-[#111318] hover:bg-[#1e222b] transition-all duration-200 tracking-wider uppercase border-t border-surface-border/30"
                         >
                           <Icon name="ri:settings-5-line" class="text-sm shrink-0" />
                           + Manage Prompts
                         </button>

                         <!-- Hover Tooltip showing Suitable For (placed outside overflow container) -->
                         <div 
                           v-if="hoveredPrompt && hoveredPrompt.suitableFor && hoveredPrompt.suitableFor.length"
                           class="absolute left-full top-0 ml-2.5 w-64 bg-[#171a21]/95 backdrop-blur-md border border-accent-500/50 rounded-xl shadow-[0_0_20px_rgba(207,255,80,0.1)] p-3 z-[60] text-left animate-in fade-in duration-150 pointer-events-none"
                         >
                           <h5 class="text-accent-500 text-sm font-bold uppercase tracking-wider mb-2">Suitable For:</h5>
                           <div class="flex flex-col gap-1.5">
                             <div 
                               v-for="(item, i) in hoveredPrompt.suitableFor" :key="i"
                               class="text-xs text-slate-300 leading-tight flex items-start gap-1.5"
                             >
                               <span class="text-accent-500 mt-0.5">•</span>
                               <span>{{ item }}</span>
                             </div>
                           </div>
                         </div>
                       </div>
                     </Transition>
                   </div>

                   <!-- Tooltip for suitableFor -->
                   <div class="relative group cursor-help shrink-0">
                     <Icon name="ri:information-line" class="text-slate-500 text-lg group-hover:text-accent-500 transition-colors" />
                     
                     <!-- Tooltip Content -->
                     <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-80 bg-surface-panel border border-surface-border rounded-xl shadow-2xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0 z-50 text-left">
                       <h4 class="text-accent-500 text-xs font-bold uppercase tracking-widest mb-3">Suitable For:</h4>
                       <div v-if="currentPrompt && currentPrompt.suitableFor && currentPrompt.suitableFor.length" class="flex flex-col gap-2">
                         <div 
                           v-for="(item, i) in currentPrompt.suitableFor" :key="i"
                           class="text-[11px] text-slate-300 leading-tight flex items-start gap-2"
                         >
                           <span class="text-accent-500 mt-0.5">•</span>
                           <span>{{ item }}</span>
                         </div>
                       </div>
                       <div v-else class="text-[11px] text-slate-500 italic">No specific categories defined.</div>
                       
                       <!-- Triangle pointer -->
                       <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-surface-panel border-b border-r border-surface-border transform rotate-45"></div>
                     </div>
                   </div>
                </div>

                <!-- Transcriber settings display & Shortcut -->
                <div class="flex items-center gap-2 justify-end shrink-0 select-none">
                  <!-- Active Transcriber Metadata Badge -->
                  <div class="group relative cursor-help flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-surface-dark border border-surface-border text-slate-400 font-mono text-[10px] font-bold tracking-wider uppercase">
                    <span class="w-1.5 h-1.5 rounded-full bg-accent-500"></span>
                    WHISPER: {{ state.whisperModel.value }}

                    <!-- Transcription Model Tooltip Card -->
                    <div class="absolute bottom-full right-0 mb-3 w-72 bg-[#171a21]/95 backdrop-blur-md border border-accent-500/50 rounded-xl p-4 shadow-[0_0_20px_rgba(207,255,80,0.1)] opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0 z-50 text-left pointer-events-none">
                      <div class="flex justify-between items-start mb-2">
                        <span class="font-black uppercase tracking-widest text-xs text-accent-500">{{ activeWhisperMetadata.name }}</span>
                        <Icon name="ri:checkbox-circle-fill" class="text-accent-500 text-base shrink-0" />
                      </div>
                      <div class="flex gap-2 mb-3">
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-400 font-bold uppercase tracking-tighter">{{ activeWhisperMetadata.speed }}</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-400 font-bold uppercase tracking-tighter">{{ activeWhisperMetadata.acc }}</span>
                      </div>
                      <p class="text-[11px] leading-relaxed text-slate-400 font-sans normal-case tracking-normal">{{ activeWhisperMetadata.desc }}</p>

                      <!-- Triangle pointer -->
                      <div class="absolute -bottom-2 right-8 w-4 h-4 bg-[#171a21] border-b border-r border-accent-500/50 transform rotate-45 z-40"></div>
                    </div>
                  </div>
                  
                  <!-- Settings Shortcut Button -->
                  <button 
                    @click="state.settingsScrollTarget.value = 'settings-whisper'; navigateTo('/settings')"
                    class="p-2.5 bg-surface-dark hover:bg-surface-panel border border-surface-border text-slate-400 hover:text-white rounded-lg hover:border-accent-500/50 hover:shadow-[0_0_10px_rgba(207,255,80,0.1)] transition-all duration-300 flex items-center justify-center cursor-pointer"
                    title="Transcriber Settings"
                    :disabled="isProcessing"
                  >
                    <Icon name="ri:settings-4-fill" class="text-base" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="state.jobError.value" class="text-red-400 text-sm mt-4 mono bg-red-500/10 inline-block px-3 py-1 rounded border border-red-500/20 shadow-lg">
            {{ state.jobError.value }}
          </div>
        </div>

        <!-- Ready to Edit -->
        <div v-if="!isProcessing && !state.hooks.value.length" class="mb-4 overflow-visible p-8 pt-0">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Icon name="ri:scissors-cut-fill" class="text-accent-500" />
              Ready to Edit
            </h3>
            <button 
              v-if="readyClips.length > 3"
              @click="showAllReadyClips = true"
              class="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-accent-500 transition-colors flex items-center gap-2"
            >
              View All ({{ readyClips.length }})
              <Icon name="ri:arrow-right-s-line" />
            </button>
          </div>

          <!-- Skeletons (Perfect Height Parity) -->
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

          <!-- Empty State for Section -->
          <div v-else-if="readyClips.length === 0" class="bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center">
            <div class="w-16 h-16 bg-surface-dark rounded-full flex items-center justify-center mb-4 border border-surface-border/50">
               <Icon name="ri:movie-2-line" class="text-3xl text-slate-600" />
            </div>
            <h4 class="text-white font-bold text-lg mb-1">Your Video Library is Empty</h4>
            <p class="text-slate-500 text-sm max-w-sm">Paste a YouTube URL above to start generating viral clips automatically.</p>
          </div>

          <!-- Real Clips -->
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div 
              v-for="clip in readyClips.slice(0, 3)" :key="clip.clip_id"
              @click="loadReadyClip(clip)"
              class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-2xl flex flex-col group hover:border-accent-500/50 hover:shadow-[0_0_30px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden"
            >
              <div class="aspect-video bg-black overflow-hidden relative">
                <!-- Skeleton Loader -->
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

                <!-- Delete Button -->
                <button 
                  @click.stop="confirmDeleteClip(clip)"
                  class="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90 z-30"
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
                        class="w-full px-3 py-2 flex items-center justify-between text-left text-xs text-slate-300 hover:bg-accent-500/10 hover:text-accent-500 transition-colors font-semibold uppercase tracking-wider select-none"
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
                     <div class="w-full h-4 bg-surface-dark rounded mb-3"></div>
                     <div class="w-1/3 h-2.5 bg-surface-dark/50 rounded"></div>
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
                
                <div class="flex-1 p-5 relative">
                  <h4 class="text-white font-bold text-sm line-clamp-2 leading-snug group-hover:text-accent-500 transition-colors">{{ vid.title }}</h4>
                  <p class="text-[10px] text-slate-500 font-mono mt-3">ID: {{ vid.video_id }}</p>
                </div>

                <!-- Full Card Action Overlay -->
                <div class="absolute inset-0 bg-surface-dark/80 backdrop-blur-md opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 z-20 pointer-events-none">
                  
                  <!-- Center Action Buttons -->
                  <div class="grid items-center gap-3 mb-4">
                    <button 
                      @click.stop="analyzeCached(vid.video_id, false)"
                      class="bg-surface-card hover:bg-surface-panel border border-surface-border text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100"
                    >
                      <Icon name="ri:folder-open-line" class="text-base" />
                      Load Cache Hooks
                    </button>
                    <button 
                      @click.stop="triggerReanalyze(vid.video_id)"
                      class="bg-accent-500 hover:bg-accent-400 text-black px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100"
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
                      @click.stop="confirmRedownload(vid)"
                      class="py-2.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-white rounded-xl border border-sky-500/20 transition-colors shadow-xl"
                      title="Refresh"
                    >
                      <Icon name="ri:download-cloud-2-line" class="text-sm" />
                    </button>
                    <button 
                      @click.stop="confirmDelete(vid)"
                      class="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-colors shadow-xl"
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
                <div class="w-40 aspect-video bg-black rounded-xl overflow-hidden relative shrink-0">
                  <img v-if="vid.thumbnail_url" :src="`${API_BASE}${vid.thumbnail_url}`" class="w-full h-full object-cover opacity-80 group-hover:opacity-40 transition-opacity duration-500" />
                  <Icon v-else name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-xl opacity-50 group-hover:opacity-20 transition-opacity" />
                  
                  <div class="absolute bottom-1.5 right-1.5 bg-black/80 px-2 py-0.5 rounded-lg text-[9px] text-white font-mono font-bold tracking-widest backdrop-blur-md border border-white/10 group-hover:opacity-0 transition-opacity duration-300">
                    {{ formatSec(vid.duration) }}
                  </div>

                </div>
                
                <div class="flex-1 min-w-0 py-2">
                  <h4 class="text-white font-bold text-sm truncate group-hover:text-accent-500 transition-colors">{{ vid.title }}</h4>
                  <p class="text-[10px] text-slate-500 font-mono mt-2">ID: {{ vid.video_id }}</p>
                </div>

                <!-- Full Card Action Overlay -->
                <div class="absolute inset-0 bg-surface-dark/80 backdrop-blur-md opacity-0 group-hover:opacity-100 flex items-center justify-center gap-6 transition-all duration-300 z-20 pointer-events-none">
                  
                  <button 
                    @click.stop="analyzeCached(vid.video_id, false)"
                    class="px-5 py-2.5 bg-surface-card hover:bg-surface-panel border border-surface-border text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100"
                  >
                    <Icon name="ri:folder-open-line" class="text-base" /> Load Cache
                  </button>
                  <button 
                    @click.stop="triggerReanalyze(vid.video_id)"
                    class="px-5 py-2.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-accent-400 transition-all shadow-xl active:scale-95 flex items-center gap-2 pointer-events-auto scale-95 group-hover:scale-100"
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
                      @click.stop="confirmRedownload(vid)"
                      class="p-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-white rounded-xl border border-sky-500/20 transition-colors shadow-xl"
                      title="Refresh"
                    >
                      <Icon name="ri:download-cloud-2-line" class="text-base" />
                    </button>
                    <button 
                      @click.stop="confirmDelete(vid)"
                      class="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-white rounded-xl border border-red-500/20 transition-colors shadow-xl"
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
             <!-- Sentinel target for IntersectionObserver -->
             <div ref="scrollSentinel" class="absolute inset-0 pointer-events-none opacity-0"></div>

             <!-- Loading state -->
             <div v-if="state.isCachedMoreLoading.value" class="flex items-center gap-2 text-xs font-mono text-slate-500 tracking-wider">
               <Icon name="ri:loader-2-line" class="animate-spin text-accent-500 text-sm" />
               <span>LOADING MORE VIDEOS...</span>
             </div>

             <!-- Error state -->
             <div v-else-if="state.cachedVideosFetchError.value" class="flex flex-col items-center gap-3 z-10">
               <span class="text-xs font-mono text-red-400 tracking-wider">FAILED TO LOAD VIDEOS</span>
               <button 
                 @click="loadMoreCached"
                 class="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 hover:text-white rounded-none cursor-pointer text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-md"
               >
                 RETRY
               </button>
             </div>
             
             <!-- Idle helper so sentinel gets height if not loading/error -->
             <div v-else class="text-xs font-mono text-slate-600/50 tracking-wider">
               SCROLL TO LOAD MORE
             </div>
          </div>
        </div>

        <Transition name="fade-layout" mode="out-in">
          <!-- Processing State -->
          <div v-if="showProcessingOverlay" key="processing" class="px-8 w-full mb-14">
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
                 <div class="grid gap-4 w-full z-10 mb-8 select-none" :class="[stages.length === 1 ? 'max-w-md mx-auto grid-cols-1' : stages.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto w-full' : 'grid-cols-1 sm:grid-cols-4 w-full']">
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
                      :class="state.isCachedAnalysis.value && !isReanalyzingCached ? 'animate-progress-sweep' : 'transition-all duration-700 ease-out'"
                      :style="state.isCachedAnalysis.value && !isReanalyzingCached ? {} : { width: `${progressPercent}%` }"
                    >
                      <div class="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer-fast bg-[length:200%_100%]"></div>
                    </div>
                 </div>

                 <!-- Cyber-deck Status Details Card -->
                 <div class="w-full bg-black/30 border border-surface-border/50 p-5 font-mono text-xs text-slate-300 text-left z-10 shadow-inner flex flex-col md:flex-row justify-between gap-5 relative">
                   <div class="flex-1 flex flex-col gap-1.5">
                      <div class="flex items-center gap-2 border-b border-surface-border/50 pb-2 mb-1.5">
                         <span class="text-accent-500 font-bold tracking-wider">PIPELINE STAGE</span>
                         <span class="text-slate-200 font-bold uppercase tracking-wider animate-pulse-subtle">» {{ state.jobStatus.value.replace('_', ' ') }}</span>
                      </div>
                      <p class="leading-relaxed"><span class="text-slate-400 font-bold mr-1">Active Task:</span> <span class="text-slate-200">{{ loadingLabel }}</span></p>
                      <p class="leading-relaxed"><span class="text-slate-400 font-bold mr-1">Engine Stack:</span> <span class="text-slate-200">yt-dlp + FFmpeg + Whisper + Gemini Flash 2.5</span></p>
                   </div>
                   <div class="flex-1 md:border-l border-surface-border/50 md:pl-5 flex flex-col gap-1.5">
                      <div class="flex justify-between border-b border-surface-border/50 pb-2 mb-1.5">
                         <span class="text-slate-400 font-bold">SYSTEM METADATA</span>
                         <span class="text-slate-200 font-bold">{{ state.jobId.value || '—' }}</span>
                      </div>
                      <p class="leading-relaxed"><span class="text-slate-400 font-bold mr-1">Model Configuration:</span> <span class="text-slate-200">Whisper {{ state.whisperModel.value.toUpperCase() }}</span></p>
                      <p class="leading-relaxed truncate"><span class="text-slate-400 font-bold mr-1">Prompt Guidelines:</span> <span class="text-slate-200">{{ state.selectedPrompt.value }}</span></p>
                   </div>
                 </div>

                 <!-- Cancel Escape Route -->
                 <button 
                   @click="resetToStart" 
                   class="z-10 mt-8 h-9 px-6 bg-surface-dark border border-surface-border/80 hover:border-red-500/30 hover:text-red-400 rounded-none cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none select-none active:scale-98"
                 >
                   <Icon name="ri:close-circle-line" class="text-sm" />
                   <span>Cancel & Return to Library</span>
                 </button>
             </div>
          </div>

          <!-- Hit List -->
          <div id="hooks-header" v-else-if="state.jobStatus.value !== 'idle' && (state.jobStatus.value === 'hooks_ready' || state.hooks.value.length > 0 || state.savedHooks.value.length > 0)" key="hooks" class="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full p-8 -mt-8">
         <div class="flex flex-col mb-6">
            <div class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4">
               <div class="flex flex-col gap-1.5 shrink-0">
                  <h3 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <Icon name="ri:fire-fill" class="text-accent-500" />
                    <span>Generated Hooks</span>
                    <!-- HD Caching Badge -->
                    <Transition name="scale-fade">
                      <span 
                        v-if="!state.hdReady.value && state.downloadPercent.value < 100" 
                        class="inline-flex items-center gap-1.5 px-2 py-0.5 border border-accent-500/20 bg-accent-500/[0.05] rounded-none text-[9px] font-black uppercase tracking-wider text-accent-500 animate-pulse"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-accent-500 animate-ping"></span>
                        Caching HD Source... {{ state.downloadPercent.value }}%
                      </span>
                      <span 
                        v-else-if="state.hdReady.value || state.downloadPercent.value === 100" 
                        class="inline-flex items-center gap-1.5 px-2 py-0.5 border border-emerald-500/20 bg-emerald-500/[0.05] rounded-none text-[9px] font-black uppercase tracking-wider text-emerald-400"
                      >
                        <Icon name="ri:checkbox-circle-fill" class="text-[10px]" />
                        HD Local Ready
                      </span>
                    </Transition>
                  </h3>
                  <p class="text-slate-400 text-xs">Select a hook to cut the segment and start editing.</p>
               </div>
               <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                 <!-- Tab Switcher -->
                 <div class="flex items-center bg-surface-dark border border-surface-border p-1 rounded-none shrink-0 h-9 select-none">
                    <button 
                      @click="activeTab = 'generated'" 
                      class="px-3 rounded-none transition-colors duration-150 cursor-pointer h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider focus:outline-none focus-visible:outline-none focus:ring-0"
                      :class="activeTab === 'generated' ? 'bg-surface-panel text-white shadow' : 'text-slate-500 hover:text-slate-300'"
                    >
                      All Hooks ({{ state.hooks.value.length }})
                    </button>
                    <button 
                      @click="activeTab = 'saved'" 
                      class="px-3 rounded-none transition-colors duration-150 cursor-pointer h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider focus:outline-none focus-visible:outline-none focus:ring-0"
                      :class="activeTab === 'saved' ? 'bg-surface-panel text-white shadow' : 'text-slate-500 hover:text-slate-300'"
                    >
                      Saved Hooks ({{ state.savedHooks.value.length }})
                    </button>
                 </div>

                 <!-- Back to Library Button -->
                 <button 
                   @click="resetToStart" 
                   class="h-9 px-4 bg-surface-dark border border-surface-border rounded-none cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-accent-500 hover:border-accent-500 transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none focus-visible:outline-none focus:ring-0"
                 >
                   <Icon name="ri:arrow-left-line" class="text-sm" />
                   <span>Back to Library</span>
                 </button>
               </div>
            </div>
         </div>

         <Transition name="fade-layout" mode="out-in">
           <!-- Generated Hooks List -->
           <div v-if="activeTab === 'generated'" key="generated" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-if="state.hooks.value.length === 0" class="col-span-full py-12 bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-none flex flex-col items-center justify-center text-center p-8">
                 <div class="w-12 h-12 bg-surface-dark border border-surface-border/50 flex items-center justify-center mb-4 text-slate-500 rounded-none">
                    <Icon name="ri:fire-line" class="text-2xl" />
                 </div>
                 <h4 class="text-white font-bold text-xs mb-1 uppercase tracking-wider">No Hooks Extracted</h4>
                 <p class="text-slate-400 text-xs max-w-sm normal-case tracking-normal">We couldn't extract any segments from this video. Try adjusting the prompt template or using another URL.</p>
              </div>
              <div 
                v-for="(hook, idx) in state.hooks.value" 
                :key="idx"
                @click="selectedModalHook = hook"
                @mouseenter="hoveredHookIndex = Number(idx)"
                @mouseleave="hoveredHookIndex = null"
                class="bg-surface-panel border border-surface-border hover:border-accent-500/50 rounded-none cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col"
              >
                <div class="absolute inset-0 bg-gradient-to-br from-accent-500/0 to-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0"></div>
                
                <!-- Video Preview Area -->
                <div class="w-full aspect-video bg-black relative overflow-hidden rounded-none shrink-0 border-b border-surface-border z-10"
                     style="backface-visibility: hidden; transform: translate3d(0,0,0); -webkit-backface-visibility: hidden; -webkit-transform: translate3d(0,0,0);">
                   <Icon name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity" />
                   <img 
                     v-if="hook.thumbnail_url"
                     :src="API_BASE + hook.thumbnail_url"
                     class="absolute inset-0 w-full h-full object-cover z-10 select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                     alt="Hook thumbnail"
                   />
                   <video 
                     v-else-if="previewVideoUrl"
                     :src="previewVideoUrl + '#t=' + Math.max(0, hook.start - state.startSafetyBuffer.value)"
                     muted
                     preload="metadata"
                     class="absolute inset-0 w-full h-full object-cover z-10 focus:outline-none select-none pointer-events-none"
                     style="backface-visibility: hidden; transform: translate3d(0,0,0); -webkit-backface-visibility: hidden; -webkit-transform: translate3d(0,0,0);"
                     @mouseenter="e => { const p = (e.target as HTMLVideoElement).play(); if (p !== undefined) p.catch(() => {}); }"
                     @mouseleave="e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                     @timeupdate="e => { if (selectedModalHook === null && (e.target as HTMLVideoElement).currentTime >= hook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                   ></video>
                   <!-- Low Res Preview badge overlay -->
                   <div v-if="state.hasPreview.value && !hook.thumbnail_url" class="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md border border-blue-500/30 text-blue-400 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider select-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                     Low Res Preview
                   </div>
                   <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded-none text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10">
                     {{ formatHookDuration(hook.start, hook.end) }}
                   </div>
                </div>
                
                <div class="p-5 flex-1 flex flex-col relative z-10">
                  <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-2">
                      <span class="bg-surface-dark border border-surface-border px-2 py-0.5 rounded-none text-[10px] b-mono text-accent-500 font-black tracking-widest">HOOK {{ String(Number(idx) + 1).padStart(2, '0') }}</span>
                      <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center">
                        <div class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help">
                          <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                        </div>
                        <!-- Custom Tooltip -->
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-none shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-30 font-medium normal-case tracking-normal text-center">
                          This clip has already been cut and transcribed, and is ready for editing!
                          <!-- Tooltip Arrow -->
                          <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                       <span class="text-slate-500 text-[10px] font-mono font-bold">{{ state.formatDuration(hook.start) }} - {{ state.formatDuration(hook.end) }}</span>
                       <button @click.stop="toggleSaveHook(hook)" class="text-slate-400 hover:text-amber-400 transition-colors z-20">
                          <Icon :name="isHookSaved(hook) ? 'ri:bookmark-fill' : 'ri:bookmark-line'" class="text-xl" :class="{'text-amber-400': isHookSaved(hook)}" />
                       </button>
                    </div>
                  </div>
                  
                  <h4 class="text-white font-bold mb-2 text-lg pr-2 leading-tight">{{ hook.theme || 'Untitled Hook' }}</h4>
                  <p class="text-slate-400 text-sm line-clamp-2 italic leading-relaxed flex-1">"{{ (hook.transcript_quote || '').length > 120 ? (hook.transcript_quote || '').substring(0, 117) + '...' : (hook.transcript_quote || '') }}"</p>
                  
                  <div class="mt-4 pt-4 border-t border-surface-border/50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-accent-500 transition-colors">
                     <span>Preview Segment</span>
                     <Icon name="ri:play-circle-fill" class="text-lg group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              </div>
           </div>

           <!-- Saved Hooks List -->
           <div v-else-if="activeTab === 'saved'" key="saved" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-if="state.savedHooks.value.length === 0" class="col-span-full py-12 bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-none flex flex-col items-center justify-center text-center p-8">
                 <div class="w-12 h-12 bg-surface-dark border border-surface-border/50 flex items-center justify-center mb-4 text-slate-500 rounded-none">
                    <Icon name="ri:bookmark-line" class="text-2xl" />
                 </div>
                 <h4 class="text-white font-bold text-xs mb-1 uppercase tracking-wider">No Saved Hooks Yet</h4>
                 <p class="text-slate-400 text-xs max-w-sm normal-case tracking-normal">Click the bookmark icon on any generated hook to save it here for editing later.</p>
              </div>
              <div 
                v-else
                v-for="(hook, idx) in state.savedHooks.value" 
                :key="hook._id || idx"
                @click="selectedModalHook = hook"
                @mouseenter="hoveredHookIndex = Number(idx) + 1000"
                @mouseleave="hoveredHookIndex = null"
                class="bg-surface-panel border border-surface-border hover:border-amber-400/50 rounded-none cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col"
              >
                <div class="absolute inset-0 bg-gradient-to-br from-amber-400/0 to-amber-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0"></div>
                
                <!-- Video Preview Area -->
                <div class="w-full aspect-video bg-black relative overflow-hidden rounded-none shrink-0 border-b border-surface-border z-10"
                     style="backface-visibility: hidden; transform: translate3d(0,0,0); -webkit-backface-visibility: hidden; -webkit-transform: translate3d(0,0,0);">
                   <Icon name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity" />
                   <img 
                     v-if="hook.thumbnail_url"
                     :src="API_BASE + hook.thumbnail_url"
                     class="absolute inset-0 w-full h-full object-cover z-10 select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                     alt="Hook thumbnail"
                   />
                   <video 
                     v-else-if="previewVideoUrl"
                     :src="previewVideoUrl + '#t=' + Math.max(0, hook.start - state.startSafetyBuffer.value)"
                     muted
                     preload="metadata"
                     class="absolute inset-0 w-full h-full object-cover z-10 focus:outline-none select-none pointer-events-none"
                     style="backface-visibility: hidden; transform: translate3d(0,0,0); -webkit-backface-visibility: hidden; -webkit-transform: translate3d(0,0,0);"
                     @mouseenter="e => { const p = (e.target as HTMLVideoElement).play(); if (p !== undefined) p.catch(() => {}); }"
                     @mouseleave="e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                     @timeupdate="e => { if (selectedModalHook === null && (e.target as HTMLVideoElement).currentTime >= hook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                   ></video>
                   <!-- Low Res Preview badge overlay -->
                   <div v-if="state.hasPreview.value && !hook.thumbnail_url" class="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-md border border-blue-500/30 text-blue-400 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider select-none pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                     Low Res Preview
                   </div>
                   <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded-none text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10">
                     {{ formatHookDuration(hook.start, hook.end) }}
                   </div>
                </div>
                
                <div class="p-5 flex-1 flex flex-col relative z-10">
                  <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-2">
                      <span class="bg-surface-dark border border-amber-500/30 px-2 py-0.5 rounded-none text-[10px] b-mono text-amber-500 font-black tracking-widest">SAVED</span>
                      <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center">
                        <div class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help">
                          <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                        </div>
                        <!-- Custom Tooltip -->
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-none shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-30 font-medium normal-case tracking-normal text-center">
                          This clip has already been cut and transcribed, and is ready for editing!
                          <!-- Tooltip Arrow -->
                          <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-slate-900"></div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-3">
                       <span class="text-slate-500 text-[10px] font-mono font-bold">{{ state.formatDuration(hook.start) }} - {{ state.formatDuration(hook.end) }}</span>
                       <button @click.stop="toggleSaveHook(hook)" class="text-amber-400 hover:text-red-400 transition-colors z-20">
                          <Icon name="ri:bookmark-fill" class="text-xl" />
                       </button>
                    </div>
                  </div>
                  
                  <h4 class="text-white font-bold mb-2 text-lg pr-2 leading-tight">{{ hook.theme || 'Untitled Hook' }}</h4>
                  <p class="text-slate-400 text-sm line-clamp-2 italic leading-relaxed flex-1">"{{ (hook.transcript_quote || '').length > 120 ? (hook.transcript_quote || '').substring(0, 117) + '...' : (hook.transcript_quote || '') }}"</p>
                  
                  <div class="mt-4 pt-4 border-t border-surface-border/50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-amber-500/50 group-hover:text-amber-400 transition-colors">
                     <span>Preview Segment</span>
                     <Icon name="ri:play-circle-fill" class="text-lg group-hover:scale-110 transition-transform" />
                  </div>
                </div>
              </div>
           </div>
         </Transition>
      </div>
    </Transition>
    </div>



    <!-- Cinematic Modal Overlay -->
    <div v-if="selectedModalHook" class="fixed inset-0 z-50 flex items-center justify-center p-4">
       <!-- Backdrop -->
       <div class="absolute inset-0 bg-black/90 backdrop-blur-xl" @click="selectedModalHook = null"></div>
       
       <!-- Modal Content -->
       <div class="relative w-full max-w-5xl bg-surface-dark border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[90vh]">
          <div class="absolute top-4 right-4 z-50">
             <button @click="selectedModalHook = null" class="w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all border border-white/10 hover:border-white/30">
                <Icon name="ri:close-line" class="text-xl" />
             </button>
          </div>
          <div class="flex flex-col md:flex-row h-full overflow-hidden">
             <!-- Video Player (50/50) -->
             <div class="md:w-1/2 bg-black relative aspect-video md:aspect-auto flex-shrink-0 flex items-center justify-center">
                <video 
                  ref="modalVideoPlayer"
                  v-if="previewVideoUrl"
                  :src="previewVideoUrl"
                  controls
                  autoplay
                  class="w-full h-full object-contain max-h-[70vh]"
                  @timeupdate="e => { if (selectedModalHook && (e.target as HTMLVideoElement).currentTime >= selectedModalHook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value); }"
                  @loadedmetadata="onModalLoadedMetadata"
                  @volumechange="onVolumeChange"
                ></video>
                <div v-if="state.hasPreview.value && previewVideoUrl" class="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-0.5 flex items-center gap-1 select-none group/resolution">
                   <!-- Icon for context -->
                   <Icon name="ri:speed-line" class="text-[11px] text-slate-400 ml-1.5 mr-0.5" />
                   
                   <!-- SD Toggle Button -->
                   <button 
                     @click="toggleResolution(false)"
                     class="px-2 py-1 text-[9px] font-black tracking-widest rounded transition-all cursor-pointer"
                     :class="!forceHighRes ? 'bg-accent-500 text-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'"
                   >
                     SD
                   </button>
                   
                   <!-- HD Toggle Button -->
                   <button 
                     @click="state.hdReady.value && toggleResolution(true)"
                     class="px-2 py-1 text-[9px] font-black tracking-widest rounded transition-all mr-0.5"
                     :class="[
                       state.hdReady.value 
                         ? (forceHighRes ? 'bg-accent-500 text-black shadow-md cursor-pointer' : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer')
                         : 'text-slate-500 cursor-not-allowed opacity-60'
                     ]"
                   >
                     <span v-if="state.hdReady.value">HD</span>
                     <span v-else-if="state.downloadPercent.value > 0">HD ({{ state.downloadPercent.value }}%)</span>
                     <span v-else>HD (QUEUED)</span>
                   </button>
  
                   <!-- Custom Tooltip on Hover -->
                   <div class="absolute top-full left-0 mt-2 w-64 bg-[#171a21]/95 backdrop-blur-md border border-surface-border text-[10px] text-slate-300 p-3 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:pointer-events-auto transition-all -translate-y-1 group-hover/resolution:translate-y-0 z-30 font-medium normal-case tracking-normal">
                      <h5 class="text-accent-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                         <Icon name="ri:information-line" class="text-xs" />
                         Preview Quality
                      </h5>
                      <p v-if="state.hdReady.value" class="leading-relaxed">This toggle applies to the preview only. The timeline editor always uses the original high-definition (HD) version.</p>
                      <p v-else class="leading-relaxed">The high-definition (HD) version is downloading in the background. You can preview the optimized SD version in the meantime.</p>
                      <!-- Triangle Pointer -->
                      <div class="absolute bottom-full left-4 -mb-[5px] border-4 border-transparent border-b-[#171a21]/95"></div>
                   </div>
                </div>
                <div v-else-if="!previewVideoUrl" class="w-full h-full flex flex-col items-center justify-center text-slate-500">
                   <Icon name="ri:film-line" class="text-4xl mb-2 opacity-50" />
                   <p class="text-sm font-medium">Video source unavailable</p>
                </div>
             </div>
             
             <!-- Sidebar Info (50/50) -->
             <div class="md:w-1/2 p-6 md:p-8 flex flex-col border-t md:border-t-0 md:border-l border-surface-border bg-surface-panel/50 overflow-y-auto custom-scrollbar select-text">
                <div class="flex-1">
                   <div class="flex items-center gap-3 mb-4">
                     <span class="bg-accent-500/10 text-accent-500 border border-accent-500/20 px-2 py-1 rounded text-[10px] b-mono font-black tracking-widest">
                       PREVIEW
                     </span>
                     <button @click.stop="toggleSaveHook(selectedModalHook)" class="text-slate-400 hover:text-amber-400 transition-colors">
                        <Icon :name="isHookSaved(selectedModalHook) ? 'ri:bookmark-fill' : 'ri:bookmark-line'" class="text-xl" :class="{'text-amber-400': isHookSaved(selectedModalHook)}" />
                     </button>
                   </div>

                   <h3 class="text-xl md:text-2xl font-bold text-white mb-3 leading-tight">{{ selectedModalHook.theme || 'Untitled Hook' }}</h3>
                   
                   <div class="flex flex-wrap items-center gap-2 mb-6">
                      <div class="flex items-center gap-2 bg-surface-dark border border-surface-border/50 px-3 py-2 rounded-lg w-max">
                         <Icon name="ri:time-line" class="text-slate-400" />
                         <span class="text-slate-300 font-mono text-xs">{{ state.formatDuration(Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value)) }} - {{ state.formatDuration(selectedModalHook.end) }}</span>
                         <span class="text-accent-500 font-bold ml-1 text-xs">{{ formatHookDuration(Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value), selectedModalHook.end) }}</span>
                      </div>
                      <button 
                         @click="showAdjustDuration = !showAdjustDuration"
                         class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-dark hover:bg-surface-panel border border-surface-border hover:border-accent-500/50 text-slate-300 hover:text-accent-500 text-xs font-bold transition-all"
                         :class="{ 'border-accent-500/50 text-accent-500 bg-surface-panel': showAdjustDuration }"
                      >
                         <Icon name="ri:settings-4-line" />
                         Adjust Start - End duration
                      </button>
                    </div>

                    <!-- Hook Timing Adjustment Panel -->
                    <div v-if="showAdjustDuration" class="mb-6 p-4 bg-black/30 border border-surface-border/60 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                       <div class="flex items-center justify-between">
                          <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Adjust Clip Timing</span>
                          <button 
                             v-if="selectedModalHook && (selectedModalHook.start !== selectedModalHook.originalStart || selectedModalHook.end !== selectedModalHook.originalEnd)"
                             @click="resetToDefaultDuration"
                             class="text-[9px] text-accent-500 hover:text-accent-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-all"
                          >
                             <Icon name="ri:restart-line" />
                             Reset to Default
                          </button>
                          <span v-else class="text-[9px] text-slate-500 font-mono">Total Video: {{ state.formatDuration(state.videoDuration.value || 0) }}</span>
                       </div>

                       <div class="grid grid-cols-2 gap-4">
                           <div>
                              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Start Time</label>
                              <div class="relative flex items-center">
                                 <input 
                                    type="text" 
                                    v-model="startInputStr" 
                                    @change="onTimeInputChange('start')"
                                    @keydown.up.prevent="onTimeInputStep('start', 1)"
                                    @keydown.down.prevent="onTimeInputStep('start', -1)"
                                    placeholder="mm:ss"
                                    class="w-full bg-surface-dark border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                                 />
                                 <span class="absolute right-3 text-[10px] text-slate-500 font-bold">mm:ss</span>
                              </div>
                              <span class="text-[10px] text-slate-500 block mt-1 font-mono">{{ Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value).toFixed(1) }}s</span>
                           </div>
                           <div>
                              <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">End Time</label>
                              <div class="relative flex items-center">
                                 <input 
                                    type="text" 
                                    v-model="endInputStr" 
                                    @change="onTimeInputChange('end')"
                                    @keydown.up.prevent="onTimeInputStep('end', 1)"
                                    @keydown.down.prevent="onTimeInputStep('end', -1)"
                                    placeholder="mm:ss"
                                    class="w-full bg-surface-dark border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                                 />
                                 <span class="absolute right-3 text-[10px] text-slate-500 font-bold">mm:ss</span>
                              </div>
                              <span class="text-[10px] text-slate-500 block mt-1 font-mono">{{ selectedModalHook.end.toFixed(1) }}s</span>
                           </div>
                       </div>

                       <!-- Timeline Range Drag Control -->
                       <div class="space-y-1">
                          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Drag to adjust</label>
                          <div 
                             id="modal-hook-slider"
                             class="relative w-full h-8 flex items-center cursor-pointer select-none"
                             @mousedown="onSliderClick"
                             @touchstart="onSliderClick"
                          >
                             <!-- Slider Track -->
                             <div class="absolute left-0 right-0 h-2 bg-surface-dark border border-surface-border/50 rounded-full"></div>
                             
                             <!-- Highlighted Active range -->
                             <div 
                                class="absolute h-2 bg-accent-500 rounded-full"
                                :style="{
                                   left: ((Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value) / (state.videoDuration.value || 100)) * 100) + '%',
                                   width: (((selectedModalHook.end - Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value)) / (state.videoDuration.value || 100)) * 100) + '%'
                                }"
                             ></div>

                             <!-- Start Handle -->
                             <div 
                                class="absolute w-4 h-4 rounded-full bg-accent-500 border border-white cursor-ew-resize -translate-x-1/2 flex items-center justify-center shadow-lg hover:scale-125 active:scale-125 transition-transform"
                                :style="{ left: ((Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value) / (state.videoDuration.value || 100)) * 100) + '%' }"
                                @mousedown.stop="startDrag('start')"
                                @touchstart.stop="startDrag('start')"
                             >
                                <div class="w-1 h-1 bg-black rounded-full"></div>
                             </div>

                             <!-- End Handle -->
                             <div 
                                class="absolute w-4 h-4 rounded-full bg-accent-500 border border-white cursor-ew-resize -translate-x-1/2 flex items-center justify-center shadow-lg hover:scale-125 active:scale-125 transition-transform"
                                :style="{ left: ((selectedModalHook.end / (state.videoDuration.value || 100)) * 100) + '%' }"
                                @mousedown.stop="startDrag('end')"
                                @touchstart.stop="startDrag('end')"
                             >
                                <div class="w-1 h-1 bg-black rounded-full"></div>
                             </div>
                          </div>
                       </div>
                    </div>

                    <div class="bg-black/30 p-5 rounded-xl border border-surface-border relative group overflow-y-auto max-h-[250px] custom-scrollbar">
                       <Icon name="ri:quote-text" class="absolute -top-2 -right-2 text-6xl text-surface-border opacity-30 group-hover:text-accent-500/10 transition-colors" />
                       <p class="text-slate-300 text-sm italic leading-relaxed relative z-10">"{{ (selectedModalHook.transcript_quote || '').length > 300 ? (selectedModalHook.transcript_quote || '').substring(0, 297) + '...' : (selectedModalHook.transcript_quote || '') }}"</p>
                    </div>
                </div>

                <div class="mt-8 pt-6 border-t border-surface-border/50">
                   <button 
                     @click="() => { if (selectedModalHook) { selectHook(selectedModalHook); selectedModalHook = null; } }" 
                     class="w-full py-4 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(207,255,80,0.2)] hover:shadow-[0_0_30px_rgba(207,255,80,0.4)] active:scale-95 flex items-center justify-center gap-2"
                   >
                     <Icon name="ri:scissors-cut-fill" class="text-xl" />
                     Go to Editor
                   </button>
                   <p class="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-bold">Opens Subtitle Editor</p>
                </div>
             </div>
          </div>
        </div>
     </div>

      <!-- Premium Glass Library Duplicate Intercept Warning Modal -->
      <div v-if="duplicateModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
         <!-- Backdrop filter blurring background -->
         <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="duplicateModalOpen = false"></div>
         
         <!-- Content Card -->
         <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
            <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
            
            <!-- Large info/warning icon -->
            <div class="w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(207,255,80,0.1)]">
               <Icon name="ri:information-fill" class="text-3xl" />
            </div>

            <h3 class="text-2xl font-black text-white tracking-wide mb-3">Video Already In Library</h3>
            <p class="text-slate-400 text-xs mb-6 font-semibold leading-relaxed">
               This video has already been downloaded and processed in your Cached Library. You can load it instantly or choose to reanalyze the hooks without downloading it again.
            </p>

            <!-- Buttons -->
            <div class="flex flex-col gap-3 w-full">
               <button 
                 @click="() => { duplicateModalOpen = false; analyzeCached(duplicateVideoId, false); }"
                 class="w-full py-3 bg-accent-500 text-black hover:bg-accent-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(207,255,80,0.2)] active:scale-[0.98] flex items-center justify-center gap-2"
               >
                  <Icon name="ri:folder-open-line" class="text-sm" />
                  Load Existing Hooks
               </button>
               <button 
                 @click="() => { duplicateModalOpen = false; triggerReanalyze(duplicateVideoId); }"
                 class="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
               >
                  <Icon name="ri:magic-line" class="text-sm text-accent-500" />
                  Reanalyze Hooks Only
               </button>
               <button 
                 @click="duplicateModalOpen = false"
                 class="w-full py-3 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center"
               >
                  Cancel
               </button>
            </div>
         </div>
      </div>

      <!-- Beautiful Glass Reanalyze Settings Modal -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="reanalyzePromptModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
           <!-- Backdrop filter blurring background -->
           <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="reanalyzePromptModalOpen = false"></div>
           
           <!-- Content Card -->
           <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
              <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
              
              <!-- Large info/warning icon -->
              <div class="w-16 h-16 rounded-2xl bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(207,255,80,0.1)]">
                 <Icon name="ri:magic-line" class="text-3xl" />
              </div>

              <h3 class="text-2xl font-black text-white tracking-wide mb-3">Reanalyze Video Hooks</h3>
              <p class="text-slate-400 text-xs mb-6 font-semibold leading-relaxed">
                 Select an AI prompt template and customize hook settings for this reanalysis run. This will not change your global settings.
              </p>

              <!-- Settings Form -->
              <div class="flex flex-col gap-5 mb-6">
                  <!-- Prompt Dropdown -->
                  <div class="flex flex-col gap-2 relative">
                     <div class="flex items-center justify-between">
                        <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">AI Prompt Template</label>
                        
                        <!-- Tooltip for suitableFor -->
                        <div class="relative group cursor-help shrink-0">
                           <Icon name="ri:information-line" class="text-slate-500 text-base group-hover:text-accent-500 transition-colors" />
                           
                           <!-- Tooltip Content -->
                           <div class="absolute bottom-full right-0 mb-2 w-64 bg-surface-panel border border-surface-border rounded-xl shadow-2xl p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-1 group-hover:translate-y-0 z-[70] text-left">
                              <h4 class="text-accent-500 text-[10px] font-black uppercase tracking-widest mb-2">Suitable For:</h4>
                              <div v-if="state.promptsList.value.find((p: PromptTemplate) => p.id === reanalyzeSelectedPromptId)?.suitableFor?.length" class="flex flex-col gap-1.5">
                                 <div 
                                   v-for="(item, i) in state.promptsList.value.find((p: PromptTemplate) => p.id === reanalyzeSelectedPromptId)?.suitableFor" :key="i"
                                   class="text-[11px] text-slate-300 leading-tight flex items-start gap-1.5"
                                 >
                                    <span class="text-accent-500 mt-0.5">•</span>
                                    <span>{{ item }}</span>
                                 </div>
                              </div>
                              <div v-else class="text-[11px] text-slate-500 italic">No specific categories defined.</div>
                              
                              <!-- Triangle pointer -->
                              <div class="absolute -bottom-1.5 right-1 w-3 h-3 bg-surface-panel border-b border-r border-surface-border transform rotate-45"></div>
                           </div>
                        </div>
                     </div>
                     
                     <!-- Dropdown Trigger Button -->
                     <button 
                       @click="isReanalyzePromptDropdownOpen = !isReanalyzePromptDropdownOpen"
                       class="w-full px-4 py-3 bg-surface-card hover:bg-surface-panel border border-surface-border text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-between text-left active:scale-[0.99] select-none"
                     >
                        <span class="truncate">
                           {{ state.promptsList.value.find((p: PromptTemplate) => p.id === reanalyzeSelectedPromptId)?.name || 'Select Prompt' }}
                        </span>
                        <Icon 
                          name="ri:arrow-down-s-line" 
                          class="text-slate-400 text-base transition-transform duration-200" 
                          :class="{ 'rotate-180': isReanalyzePromptDropdownOpen }" 
                        />
                     </button>
 
                     <!-- Dropdown List -->
                     <Transition
                       enter-active-class="transition duration-100 ease-out"
                       enter-from-class="transform scale-95 opacity-0"
                       enter-to-class="transform scale-100 opacity-100"
                       leave-active-class="transition duration-75 ease-in"
                       leave-from-class="transform scale-100 opacity-100"
                       leave-to-class="transform scale-95 opacity-0"
                     >
                        <div 
                          v-if="isReanalyzePromptDropdownOpen"
                          class="absolute top-full mt-2 left-0 w-full bg-[#171a21]/95 backdrop-blur-md border border-surface-border rounded-xl shadow-2xl py-1 z-[60] max-h-48 overflow-y-auto custom-scrollbar"
                        >
                           <button 
                             v-for="p in state.promptsList.value" 
                             :key="p.id"
                             @click="reanalyzeSelectedPromptId = p.id; isReanalyzePromptDropdownOpen = false"
                             @mouseenter="hoveredPrompt = p"
                             @mouseleave="hoveredPrompt = null"
                             class="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs text-slate-300 hover:bg-accent-500/10 hover:text-accent-500 transition-colors font-semibold"
                           >
                              <span class="truncate" :class="{ 'text-accent-500 font-bold': reanalyzeSelectedPromptId === p.id }">
                                 {{ p.name }}
                              </span>
                              <Icon 
                                v-if="reanalyzeSelectedPromptId === p.id" 
                                name="ri:checkbox-circle-fill" 
                                class="text-accent-500 text-sm shrink-0 ml-2" 
                              />
                           </button>
 
                           <!-- Hover Tooltip showing Suitable For in Modal (placed outside overflow container) -->
                           <div 
                             v-if="hoveredPrompt && hoveredPrompt.suitableFor && hoveredPrompt.suitableFor.length"
                             class="absolute left-full top-0 ml-2.5 w-64 bg-[#171a21]/95 backdrop-blur-md border border-accent-500/50 rounded-xl shadow-[0_0_20px_rgba(207,255,80,0.1)] p-3 z-[70] text-left animate-in fade-in duration-150 pointer-events-none"
                           >
                             <h5 class="text-accent-500 text-[10px] font-black uppercase tracking-widest mb-2">Suitable For:</h5>
                             <div class="flex flex-col gap-1.5">
                               <div 
                                 v-for="(item, i) in hoveredPrompt.suitableFor" :key="i"
                                 class="text-xs text-slate-300 leading-tight flex items-start gap-1.5"
                               >
                                 <span class="text-accent-500 mt-0.5">•</span>
                                 <span>{{ item }}</span>
                               </div>
                             </div>
                           </div>
                        </div>
                     </Transition>
                  </div>

                 <!-- Hook Count & Auto Toggle Grid -->
                  <div class="grid grid-cols-2 gap-4">
                     <!-- Target Hook Count -->
                     <div class="flex flex-col gap-2">
                        <div class="flex items-center justify-between h-5">
                           <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Hooks</label>
                        </div>
                        <div class="relative flex items-center">
                           <input 
                             type="number" 
                             v-model.number="reanalyzeNumHooks"
                             :disabled="reanalyzeAutoHooks"
                             min="1"
                             max="50"
                             class="w-full h-11 px-4 bg-surface-card border border-surface-border text-white text-xs font-semibold rounded-xl focus:outline-none focus:border-accent-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                           />
                        </div>
                     </div>

                     <!-- Auto-Hooks Toggle Button -->
                     <div class="flex flex-col gap-2">
                        <div class="flex items-center justify-between h-5">
                           <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Auto Hooks Mode</label>
                           
                           <!-- Tooltip for Auto Hooks -->
                           <div class="relative group cursor-help shrink-0">
                              <Icon name="ri:information-line" class="text-slate-500 text-base group-hover:text-accent-500 transition-colors" />
                              
                              <!-- Tooltip Content -->
                              <div class="absolute bottom-full right-0 mb-2 w-64 bg-surface-panel border border-surface-border rounded-xl shadow-2xl p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-1 group-hover:translate-y-0 z-[70] text-left">
                                 <h4 class="text-accent-500 text-[10px] font-black uppercase tracking-widest mb-1.5">Auto Hooks Mode:</h4>
                                 <p class="text-[11px] text-slate-300 leading-normal font-semibold">
                                    When enabled, the AI dynamically decides how many high-quality hooks to extract based on video content. When disabled, the AI strictly attempts to extract the exact number of target hooks requested.
                                 </p>
                                 
                                 <!-- Triangle pointer -->
                                 <div class="absolute -bottom-1.5 right-1 w-3 h-3 bg-surface-panel border-b border-r border-surface-border transform rotate-45"></div>
                              </div>
                           </div>
                        </div>
                        <button 
                          @click="reanalyzeAutoHooks = !reanalyzeAutoHooks"
                          class="w-full h-11 px-4 border text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 active:scale-[0.98] select-none flex items-center justify-center gap-2"
                          :class="reanalyzeAutoHooks ? 'bg-accent-500/10 border-accent-500 text-accent-500 hover:bg-accent-500/20' : 'bg-surface-card border-surface-border text-slate-400 hover:text-white hover:bg-surface-panel'"
                        >
                           <Icon :name="reanalyzeAutoHooks ? 'ri:toggle-fill' : 'ri:toggle-line'" class="text-base shrink-0" />
                           {{ reanalyzeAutoHooks ? 'Enabled' : 'Disabled' }}
                        </button>
                     </div>
                  </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex flex-col gap-3 w-full">
                 <button 
                   @click="() => { 
                     reanalyzePromptModalOpen = false; 
                     analyzeCached(reanalyzeVideoId, true, { 
                       promptFile: reanalyzeSelectedPromptId, 
                       numHooks: reanalyzeNumHooks, 
                       autoHooks: reanalyzeAutoHooks 
                     }); 
                   }"
                   class="w-full py-3 bg-accent-500 text-black hover:bg-accent-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 hover:shadow-[0_0_20px_rgba(207,255,80,0.5)] active:scale-[0.98] flex items-center justify-center gap-2"
                 >
                    <Icon name="ri:magic-line" class="text-sm" />
                    Run Reanalysis
                 </button>
                 <button 
                   @click="reanalyzePromptModalOpen = false"
                   class="w-full py-3 bg-transparent hover:bg-white/5 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center"
                 >
                    Cancel
                 </button>
              </div>
           </div>
        </div>
      </Transition>

     <!-- Beautiful Glass Deletion Warning Modal -->
     <div v-if="deleteConfirmModalOpen && videoToDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop filter blurring background -->
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="deleteConfirmModalOpen = false"></div>
        
        <!-- Content Card -->
        <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
           <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
           
           <!-- Large warning shield icon -->
           <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <Icon name="ri:error-warning-fill" class="text-3xl" />
           </div>

           <h3 class="text-2xl font-black text-white tracking-wide mb-3">Delete Video Source?</h3>
           
           <!-- Subtitle / target filename -->
           <div class="bg-surface-panel/30 border border-surface-border rounded-xl p-3 mb-6 flex flex-col gap-1">
              <span class="text-[10px] uppercase font-bold tracking-widest text-slate-500">Source Name</span>
              <span class="text-white font-mono text-xs font-bold truncate">{{ videoToDelete.title }}</span>
           </div>

           <!-- Bullet details about what is deleted vs preserved -->
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
              
              <!-- Warning if workspace is currently loaded with this video -->
              <div v-if="state.folderName.value === videoToDelete.folder_name" class="flex items-start gap-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">
                 <Icon name="ri:refresh-line" class="text-amber-400 text-lg shrink-0 mt-0.5" />
                 <div>
                    <h4 class="text-amber-400 font-bold uppercase tracking-wider text-[10px] mb-1">Active Editor Reset</h4>
                    <p class="text-slate-400 leading-relaxed font-semibold">This source is currently active. Deleting it will clear the editor workspace and reset your view.</p>
                 </div>
              </div>
           </div>

           <!-- Buttons -->
           <div class="flex items-center gap-3 w-full">
              <button 
                @click="deleteConfirmModalOpen = false"
                class="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]"
              >
                 Cancel
              </button>
              <button 
                @click="deleteVideo(videoToDelete.folder_name)"
                class="flex-1 py-3 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-[0.98]"
              >
                 Confirm Delete
              </button>
           </div>
        </div>
     </div>

     <!-- Beautiful Glass Clip Deletion Warning Modal -->
     <div v-if="clipDeleteConfirmModalOpen" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <!-- Backdrop filter blurring background -->
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="clipDeleteConfirmModalOpen = false"></div>
        
        <!-- Content Card -->
        <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[130]">
           <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
           
           <!-- Large warning shield icon -->
           <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <Icon name="ri:scissors-cut-line" class="text-3xl" />
           </div>

           <h3 class="text-2xl font-black text-white tracking-wide mb-3">Delete Ready Clip?</h3>
           
           <!-- Subtitle / target filename -->
           <div class="bg-surface-panel/30 border border-surface-border rounded-xl p-4 mb-6 flex flex-col gap-1">
              <span class="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                 {{ clipToDelete ? 'Selected Clip' : 'Clips Selected for Deletion' }}
              </span>
              <span class="text-white font-mono text-xs font-bold truncate">
                 {{ clipToDelete ? (clipToDelete.theme || 'Untitled Clip') : `${selectedClips.size} ready clips` }}
              </span>
           </div>

           <!-- Warning details -->
           <div class="flex flex-col gap-4 text-xs mb-8">
              <div class="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
                 <Icon name="ri:delete-bin-2-line" class="text-red-400 text-lg shrink-0 mt-0.5" />
                 <div>
                    <h4 class="text-red-400 font-bold uppercase tracking-wider text-[10px] mb-1">Permanent Removal</h4>
                    <p class="text-slate-400 leading-relaxed font-semibold">This will permanently delete the local video segment, transcription assets, and saved timeline track files. This action cannot be undone.</p>
                 </div>
              </div>
           </div>

           <!-- Buttons -->
           <div class="flex items-center gap-3 w-full">
              <button 
                @click="clipDeleteConfirmModalOpen = false"
                class="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98]"
              >
                 Cancel
              </button>
              <button 
                @click="executeDeleteClip"
                class="flex-1 py-3 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-[0.98]"
              >
                 Confirm Delete
              </button>
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
                
                <!-- Selection Controls -->
                <div v-if="isManageMode" class="flex items-center gap-2 ml-4 animate-in fade-in slide-in-from-left-2 duration-300">
                   <button 
                     @click="selectAllClips"
                     class="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-accent-500/10 text-accent-500 border border-accent-500/20 rounded-lg hover:bg-accent-500 hover:text-black transition-all"
                   >
                     {{ selectedClips.size === readyClips.length ? 'Deselect All' : 'Select All' }}
                   </button>
                </div>
             </div>

             <div class="flex items-center gap-4">
                <button 
                  @click="toggleManageMode"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                  :class="isManageMode ? 'bg-accent-500 text-black shadow-[0_0_15px_rgba(207,255,80,0.3)]' : 'bg-surface-dark text-slate-400 border border-surface-border hover:text-white'"
                >
                   <Icon :name="isManageMode ? 'ri:check-line' : 'ri:settings-4-line'" />
                   {{ isManageMode ? 'Done' : 'Manage' }}
                </button>
                <button @click="showAllReadyClips = false" class="text-slate-400 hover:text-white transition-colors">
                   <Icon name="ri:close-line" class="text-2xl" />
                </button>
             </div>
          </div>
          
          <div class="flex-1 relative overflow-hidden">
             <!-- Global Loading Overlay -->
             <div v-if="readyClips.length > 0 && !readyClips.some(c => loadedClips.has(c.clip_id))" class="absolute inset-0 z-40 bg-surface-dark/60 backdrop-blur-md flex flex-col items-center justify-center">
                <div class="w-12 h-12 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin mb-4"></div>
                <p class="text-accent-500 font-black uppercase tracking-[0.2em] text-[10px] animate-pulse">Initializing Library...</p>
             </div>

             <!-- Empty State -->
             <div v-else-if="readyClips.length === 0" class="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-500">
               <div class="w-20 h-20 bg-surface-panel rounded-full flex items-center justify-center mb-6 border border-surface-border">
                 <Icon name="ri:inbox-line" class="text-4xl text-slate-600" />
               </div>
               <h3 class="text-xl font-bold text-white mb-2">No Ready Clips Found</h3>
               <p class="text-slate-500 text-sm max-w-xs mb-8">Your library is currently empty. Start generating clips in the editor to populate this space.</p>
               <button @click="showAllReadyClips = false" class="bg-accent-500 text-black px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent-500/20">
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
                        <!-- Skeleton Loader -->
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
                          class="absolute top-1 right-1 w-6 h-6 bg-red-500/80 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-30"
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
                <button @click="showSuccessState = false" class="ml-4 text-white/50 hover:text-white transition-colors">
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
                 class="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl hover:scale-105 active:scale-95"
               >
                 <Icon v-if="isBatchDeleting" name="ri:loader-4-line" class="animate-spin" />
                 <Icon v-else name="ri:delete-bin-line" />
                 {{ isBatchDeleting ? 'Deleting...' : 'Delete Permanently' }}
               </button>
               
               <button 
                 @click="clearSelection"
                 class="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
               >
                 Cancel
               </button>
             </div>
           </div>

           <!-- Pagination Footer (Fixed to Bottom) -->
       <div class="p-4 border-t border-surface-border bg-surface-panel/30 flex items-center justify-between px-8 shrink-0 z-50">
          <div class="text-[10px] font-black uppercase tracking-widest text-slate-500">
             Page {{ clipsCurrentPage }} of {{ totalClipsPages || 1 }}
          </div>
          <div class="flex items-center gap-4">
             <button 
               @click="clipsCurrentPage--" 
               :disabled="clipsCurrentPage === 1"
               class="px-4 py-2 bg-surface-dark border border-surface-border rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:text-accent-500 hover:border-accent-500/50 disabled:opacity-20 disabled:grayscale disabled:pointer-events-none transition-all"
             >
               [ PREV ]
             </button>
             <button 
               @click="clipsCurrentPage++" 
               :disabled="clipsCurrentPage === totalClipsPages || totalClipsPages === 0"
               class="px-4 py-2 bg-surface-dark border border-surface-border rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:text-accent-500 hover:border-accent-500/50 disabled:opacity-20 disabled:grayscale disabled:pointer-events-none transition-all"
             >
               [ NEXT ]
             </button>
          </div>
       </div>
    </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { CachedVideo, Hook, ReadyClip, PromptTemplate, WhisperModelOption } from '../types/clipper'

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const forceHighRes = ref(false)
const isTogglingResolution = ref(false)
const savedPlaybackTime = ref<number | null>(null)

const isPromptDropdownOpen = ref(false)
const promptDropdownRef = ref<HTMLElement | null>(null)
const hoveredPrompt = ref<PromptTemplate | null>(null)

const isSortDropdownOpen = ref(false)
const sortDropdownRef = ref<HTMLElement | null>(null)

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

const activeWhisperMetadata = computed(() => {
  const modelId = state.whisperModel.value || 'base'
  return state.whisperModels.find((m: WhisperModelOption) => m.id === modelId) || state.whisperModels[1]
})

const previewVideoUrl = computed(() => {
  const url = state.videoUrl.value
  if (!url) return null
  if (url.includes('/assets/sources/') && url.endsWith('/full.mp4')) {
    if (state.hasPreview.value && !forceHighRes.value) {
      return url.replace('/full.mp4', '/preview.mp4')
    }
  }
  return url
})


function handleDocumentClick(e: MouseEvent) {
  if (promptDropdownRef.value && !promptDropdownRef.value.contains(e.target as Node)) {
    isPromptDropdownOpen.value = false
  }
  if (sortDropdownRef.value && !sortDropdownRef.value.contains(e.target as Node)) {
    isSortDropdownOpen.value = false
  }
}

const scrollSentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function triggerLazyLoad() {
  if (
    state.cachedVideosHasMore.value &&
    !isCachedLoading.value &&
    !state.isCachedMoreLoading.value &&
    !state.cachedVideosFetchError.value
  ) {
    loadMoreCached()
  }
}

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
  if (processingTimeout) {
    clearTimeout(processingTimeout)
    processingTimeout = null
  }
  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
    scrollTimeout = null
  }
})

const viewMode = ref<'grid' | 'list'>('grid')
const isSearchPending = ref(false)
const { 
  cachedVideos, isCachedLoading, lastAccessedVideo, lastAccessedVideoId, 
  setLastAccessed, isNavigatingToEditor,
  thumbnailEnabled, contentAudit, customBlacklist,
  videoTitle, lastAccessedClip,
  cachedVideosTotal, cachedVideosPage, cachedVideosLimit, cachedVideosSearch,
  cachedVideosSortBy, cachedVideosSortOrder, cachedVideosHasMore
} = state
const readyClips = useState<ReadyClip[]>('readyClips', () => [])
const isReadyClipsLoading = ref(false)
const activeTab = ref<'generated' | 'saved'>('generated')

watch(() => state.jobStatus.value, (newStatus) => {
  if (newStatus === 'queued') {
    activeTab.value = 'generated'
  }
})
const hoveredHookIndex = ref<number | null>(null)
const selectedModalHook = ref<Hook | null>(null)
const modalVideoPlayer = ref<HTMLVideoElement | null>(null)

function toggleResolution(highRes: boolean) {
  if (forceHighRes.value === highRes) return
  
  if (modalVideoPlayer.value) {
    savedPlaybackTime.value = modalVideoPlayer.value.currentTime
    isTogglingResolution.value = true
  }
  forceHighRes.value = highRes
}

function onModalLoadedMetadata(e: Event) {
  const videoEl = e.target as HTMLVideoElement
  if (isTogglingResolution.value && savedPlaybackTime.value !== null) {
    videoEl.currentTime = savedPlaybackTime.value
    isTogglingResolution.value = false
    savedPlaybackTime.value = null
  } else if (selectedModalHook.value) {
    videoEl.currentTime = Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
  }
  restoreModalVolume(videoEl)
}

function restoreModalVolume(el: HTMLVideoElement | null) {
  if (!el) return
  if (typeof localStorage !== 'undefined') {
    const savedVolume = localStorage.getItem('yonru_preview_volume')
    const savedMuted = localStorage.getItem('yonru_preview_muted')
    if (savedVolume !== null) {
      el.volume = parseFloat(savedVolume)
    }
    if (savedMuted !== null) {
      el.muted = savedMuted === 'true'
    }
  }
}

function onVolumeChange() {
  const el = modalVideoPlayer.value
  if (el && typeof localStorage !== 'undefined') {
    localStorage.setItem('yonru_preview_volume', el.volume.toString())
    localStorage.setItem('yonru_preview_muted', el.muted.toString())
  }
}

watch(modalVideoPlayer, (el) => {
  if (el) {
    restoreModalVolume(el)
  }
})

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseMMSS(str: string): number | null {
  const parts = str.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0] || '0', 10)
    const s = parseInt(parts[1] || '0', 10)
    if (!isNaN(m) && !isNaN(s)) {
      return m * 60 + s
    }
  }
  const val = parseFloat(str)
  if (!isNaN(val)) return val
  return null
}

const showAdjustDuration = ref(false)
const dragMode = ref<'start' | 'end' | null>(null)
const startInputStr = ref('00:00')
const endInputStr = ref('00:00')

watch(() => selectedModalHook.value?.start, (newVal) => {
  if (newVal !== undefined) {
    startInputStr.value = formatMMSS(Math.max(0, newVal - state.startSafetyBuffer.value))
  }
})

watch(() => selectedModalHook.value?.end, (newVal) => {
  if (newVal !== undefined) {
    endInputStr.value = formatMMSS(newVal)
  }
})

function startDrag(mode: 'start' | 'end') {
  dragMode.value = mode
  window.addEventListener('mousemove', onDragging)
  window.addEventListener('mouseup', stopDragging)
  window.addEventListener('touchmove', onDragging, { passive: false })
  window.addEventListener('touchend', stopDragging)
}

function onDragging(e: MouseEvent | TouchEvent) {
  if (!dragMode.value || !selectedModalHook.value) return
  
  const slider = document.getElementById('modal-hook-slider')
  if (!slider) return
  
  const rect = slider.getBoundingClientRect()
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
  const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const totalDuration = state.videoDuration.value || 100
  const newVal = parseFloat((percentage * totalDuration).toFixed(1))
  
  if (dragMode.value === 'start') {
    if (newVal <= selectedModalHook.value.end - 1.0) {
      selectedModalHook.value.start = Math.max(0, newVal) + state.startSafetyBuffer.value
      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
      }
    }
  } else if (dragMode.value === 'end') {
    const maxVal = state.videoDuration.value || 3600
    if (newVal >= selectedModalHook.value.start + 1.0) {
      selectedModalHook.value.end = Math.min(maxVal, newVal)
      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.end - 1)
      }
    }
  }
}

function stopDragging() {
  dragMode.value = null
  window.removeEventListener('mousemove', onDragging)
  window.removeEventListener('mouseup', stopDragging)
  window.removeEventListener('touchmove', onDragging)
  window.removeEventListener('touchend', stopDragging)
}

function onTimeInputChange(mode: 'start' | 'end') {
  if (!selectedModalHook.value) return
  
  const str = mode === 'start' ? startInputStr.value : endInputStr.value
  const parsed = parseMMSS(str)
  
  if (parsed === null) {
    if (mode === 'start') {
      startInputStr.value = formatMMSS(Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value))
    } else {
      endInputStr.value = formatMMSS(selectedModalHook.value.end)
    }
    return
  }
  
  const total = state.videoDuration.value || 3600
  if (mode === 'start') {
    let newStart = Math.max(0, parsed)
    if (newStart > selectedModalHook.value.end - 1.0) {
      newStart = selectedModalHook.value.end - 1.0
    }
    selectedModalHook.value.start = parseFloat((newStart + state.startSafetyBuffer.value).toFixed(1))
    startInputStr.value = formatMMSS(Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value))
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
    }
  } else {
    let newEnd = Math.min(total, parsed)
    if (newEnd < selectedModalHook.value.start - state.startSafetyBuffer.value + 1.0) {
      newEnd = selectedModalHook.value.start - state.startSafetyBuffer.value + 1.0
    }
    selectedModalHook.value.end = parseFloat(newEnd.toFixed(1))
    endInputStr.value = formatMMSS(selectedModalHook.value.end)
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.end - 1)
    }
  }
}

function onTimeInputStep(mode: 'start' | 'end', delta: number) {
  if (!selectedModalHook.value) return
  
  const currentVal = mode === 'start' 
    ? Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
    : selectedModalHook.value.end
    
  const newVal = currentVal + delta
  
  const total = state.videoDuration.value || 3600
  if (mode === 'start') {
    let newStart = Math.max(0, newVal)
    if (newStart > selectedModalHook.value.end - 1.0) {
      newStart = selectedModalHook.value.end - 1.0
    }
    selectedModalHook.value.start = parseFloat((newStart + state.startSafetyBuffer.value).toFixed(1))
    startInputStr.value = formatMMSS(Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value))
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
    }
  } else {
    let newEnd = Math.min(total, newVal)
    if (newEnd < selectedModalHook.value.start - state.startSafetyBuffer.value + 1.0) {
      newEnd = selectedModalHook.value.start - state.startSafetyBuffer.value + 1.0
    }
    selectedModalHook.value.end = parseFloat(newEnd.toFixed(1))
    endInputStr.value = formatMMSS(selectedModalHook.value.end)
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.end - 1)
    }
  }
}

function onSliderClick(e: MouseEvent | TouchEvent) {
  if (!selectedModalHook.value) return
  const slider = document.getElementById('modal-hook-slider')
  if (!slider) return
  
  const rect = slider.getBoundingClientRect()
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX
  const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const totalDuration = state.videoDuration.value || 100
  const clickVal = percentage * totalDuration
  
  const distStart = Math.abs(clickVal - Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value))
  const distEnd = Math.abs(clickVal - selectedModalHook.value.end)
  
  const mode = distStart < distEnd ? 'start' : 'end'
  
  if (mode === 'start') {
    if (clickVal <= selectedModalHook.value.end - 1.0) {
      selectedModalHook.value.start = Math.max(0, parseFloat(clickVal.toFixed(1))) + state.startSafetyBuffer.value
      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
      }
    }
  } else {
    const maxVal = state.videoDuration.value || 3600
    if (clickVal >= selectedModalHook.value.start - state.startSafetyBuffer.value + 1.0) {
      selectedModalHook.value.end = Math.min(maxVal, parseFloat(clickVal.toFixed(1)))
      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.end - 1)
      }
    }
  }
  
  startDrag(mode)
}

watch(selectedModalHook, (newHook) => {
  if (newHook) {
    if (newHook.originalStart === undefined) {
      newHook.originalStart = newHook.start
    }
    if (newHook.originalEnd === undefined) {
      newHook.originalEnd = newHook.end
    }
    startInputStr.value = formatMMSS(Math.max(0, newHook.start - state.startSafetyBuffer.value))
    endInputStr.value = formatMMSS(newHook.end)
    forceHighRes.value = false
    isTogglingResolution.value = false
    savedPlaybackTime.value = null
  } else {
    showAdjustDuration.value = false
    forceHighRes.value = false
    isTogglingResolution.value = false
    savedPlaybackTime.value = null
  }
})

function resetToDefaultDuration() {
  if (selectedModalHook.value && selectedModalHook.value.originalStart !== undefined && selectedModalHook.value.originalEnd !== undefined) {
    selectedModalHook.value.start = selectedModalHook.value.originalStart
    selectedModalHook.value.end = selectedModalHook.value.originalEnd
    startInputStr.value = formatMMSS(Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value))
    endInputStr.value = formatMMSS(selectedModalHook.value.end)
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
    }
  }
}

const deleteConfirmModalOpen = ref(false)
const videoToDelete = ref<CachedVideo | null>(null)
const clipDeleteConfirmModalOpen = ref(false)
const clipToDelete = ref<ReadyClip | null>(null)
const showAllReadyClips = ref(false)
const loadedClips = ref(new Set<string>())

// Library Duplicate Intercept state & helpers
const duplicateModalOpen = ref(false)
const duplicateVideoId = ref('')

// Reanalyze settings modal state & helpers
const reanalyzePromptModalOpen = ref(false)
const reanalyzeVideoId = ref('')
const reanalyzeSelectedPromptId = ref('')
const reanalyzeNumHooks = ref(10)
const reanalyzeAutoHooks = ref(false)
const isReanalyzePromptDropdownOpen = ref(false)

watch(reanalyzeSelectedPromptId, (newPromptId) => {
  const p = state.promptsList.value.find((prompt: PromptTemplate) => prompt.id === newPromptId)
  if (p) {
    reanalyzeNumHooks.value = p.numHooks ?? 10
    reanalyzeAutoHooks.value = p.autoHooks ?? false
  }
})

function triggerReanalyze(videoId: string) {
  reanalyzeVideoId.value = videoId
  reanalyzeSelectedPromptId.value = state.selectedPrompt.value
  
  const p = state.promptsList.value.find((prompt: PromptTemplate) => prompt.id === state.selectedPrompt.value)
  if (p) {
    reanalyzeNumHooks.value = p.numHooks ?? 10
    reanalyzeAutoHooks.value = p.autoHooks ?? false
  } else {
    reanalyzeNumHooks.value = 10
    reanalyzeAutoHooks.value = false
  }
  
  isReanalyzePromptDropdownOpen.value = false
  reanalyzePromptModalOpen.value = true
}


function extractYoutubeId(url: string): string | null {
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i
  const match = url.match(reg)
  return match ? (match[1] ?? null) : null
}

function handleAnalyzeClick() {
  const url = state.youtubeUrl.value
  if (!url) return
  
  const videoId = extractYoutubeId(url)
  if (videoId && cachedVideos.value.some((v: CachedVideo) => v.video_id === videoId)) {
    duplicateVideoId.value = videoId
    duplicateModalOpen.value = true
  } else {
    state.analyzeUrl(false)
  }
}

async function initDashboard() {
  isNavigatingToEditor.value = false // Reset state on mount/activate
  
  // Clear any finished hit lists when returning to the dashboard
  // so the default "Ready to Edit" and "Cached Library" sections are shown.
  const processingStatuses = ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks', 'cutting', 'extracting_video']
  if (!processingStatuses.includes(state.jobStatus.value)) {
    state.hooks.value = []
    state.jobStatus.value = 'idle'
    state.jobId.value = null
  } else {
    console.log('[yonru] Dashboard initialized with active background job, starting polling...')
    state.startPolling()
  }

  // Always reset active hook when returning to home, so background analysis polling can update videoUrl
  state.activeHook.value = null

  await state.fetchPrompts()
  await state.fetchSavedHooks()
  await state.fetchCached(true)
  await fetchReadyClips()
  state.initPersistence()
  state.checkSystemHealth()
  
  if (import.meta.client) {
    const savedVid = localStorage.getItem('yonru_last_video')
    if (savedVid) state.lastAccessedVideoId.value = savedVid
    
    const savedClip = localStorage.getItem('yonru_last_clip')
    if (savedClip) {
      try {
        state.lastAccessedClip.value = JSON.parse(savedClip)
      } catch (e) {}
    }
  }
}

const hasBeenMounted = ref(false)

onMounted(() => {
  console.log('[yonru] Dashboard mounted (first time)')
  initDashboard()
  // Defer flag so onActivated (fires same tick) still sees false on first load
  nextTick(() => {
    hasBeenMounted.value = true
  })
})

onActivated(() => {
  if (hasBeenMounted.value) {
    console.log('[yonru] Dashboard activated (returned from cache)')
    initDashboard()
  }
})

onDeactivated(() => {
  console.log('[yonru] Dashboard deactivated — stopping background polling')
  state.stopPolling()
})

// Manage Mode
const isManageMode = ref(false)
const selectedClips = ref(new Set<string>())
const isBatchDeleting = ref(false)
const showSuccessState = ref(false)
const lastDeletedCount = ref(0)
let successTimeout: ReturnType<typeof setTimeout> | null = null

// Pagination for Ready Clips Modal
const clipsCurrentPage = ref(1)
const clipsPageSize = 9
const paginatedReadyClips = computed(() => {
  const start = (clipsCurrentPage.value - 1) * clipsPageSize
  return readyClips.value.slice(start, start + clipsPageSize)
})
const totalClipsPages = computed(() => Math.ceil(readyClips.value.length / clipsPageSize))

watch(showAllReadyClips, (val) => {
  if (val) {
    clipsCurrentPage.value = 1
    isManageMode.value = false
    selectedClips.value = new Set()
  }
})

watch(() => state.startSafetyBuffer.value, (newVal) => {
  if (selectedModalHook.value && modalVideoPlayer.value) {
    modalVideoPlayer.value.currentTime = Math.max(0, selectedModalHook.value.start - newVal)
  }
})

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
    const parentVid = cachedVideos.value.find((v: CachedVideo) => v.folder_name === clip.folder_name)
    if (parentVid) setLastAccessed(parentVid.video_id)
    loadReadyClip(clip)
  }
}

function selectAllClips() {
  if (selectedClips.value.size === readyClips.value.length) {
    selectedClips.value = new Set()
  } else {
    selectedClips.value = new Set(readyClips.value.map(c => c.clip_id))
  }
}

async function deleteSelectedClips() {
  if (selectedClips.value.size === 0) return
  if (!window.confirm(`Are you sure you want to delete ${selectedClips.value.size} clips? This cannot be undone.`)) return
  
  const count = selectedClips.value.size
  isBatchDeleting.value = true
  try {
    const clipsToDelete = readyClips.value
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
    await fetchReadyClips()
  } catch (e: unknown) {
    console.error('Failed to delete clips batch', e)
    alert('Failed to delete some clips. Please try again.')
  } finally {
    isBatchDeleting.value = false
  }
}

function resetToStart() {
  state.hooks.value = []
  state.jobStatus.value = 'idle'
  state.jobId.value = null
  state.jobError.value = null
  state.youtubeUrl.value = ''
  state.isCachedAnalysis.value = false
  isReanalyzingCached.value = false
}

function isHookSaved(hook: Hook) {
  return state.savedHooks.value.some((h: Hook) => Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1)
}

function findMatchingClip(hook: Hook | null): ReadyClip | undefined {
  if (!readyClips.value?.length || !state.folderName.value || !hook) return undefined
  return readyClips.value.find(c => {
    if (c.folder_name !== state.folderName.value) return false
    const parts = c.clip_id.split('_')
    const part0 = parts[0]
    const part1 = parts[1]
    if (part0 === undefined || part1 === undefined) return false
    const cStart = parseFloat(part0)
    const cEnd = parseFloat(part1)
    if (isNaN(cStart) || isNaN(cEnd)) return false

    // Method 1: Proximity check using the active start safety buffer
    const safetyBuffer = state.startSafetyBuffer?.value ?? 2.0
    const expectedStart = Math.max(0, Math.floor(hook.start - safetyBuffer))
    const expectedEnd = Math.ceil(hook.end)
    if (Math.abs(cStart - expectedStart) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }

    // Method 2: Proximity check with default 2.0s buffer or no buffer (fallbacks)
    const expectedStartDefault = Math.max(0, Math.floor(hook.start - 2.0))
    if (Math.abs(cStart - expectedStartDefault) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }
    const expectedStartNone = Math.max(0, Math.floor(hook.start))
    if (Math.abs(cStart - expectedStartNone) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }

    // Method 3: Overlap heuristic (handles custom user duration adjustment in editor)
    const hookDuration = hook.end - hook.start
    if (hookDuration <= 0) return false
    const overlapStart = Math.max(cStart, hook.start)
    const overlapEnd = Math.min(cEnd, hook.end)
    const overlap = overlapEnd - overlapStart
    if (overlap > 0 && (overlap / hookDuration) >= 0.8) {
      return true
    }

    // Method 4: Theme name matching (fallback if times shifted completely but theme matches)
    if (hook.theme && parts.length >= 3) {
      const cleanHookTheme = hook.theme.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()
      const clipThemeStr = parts.slice(2).join(' ').replace(/_/g, ' ')
      const cleanClipTheme = clipThemeStr.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, ' ').trim()
      if (cleanHookTheme && cleanClipTheme && (cleanClipTheme.includes(cleanHookTheme) || cleanHookTheme.includes(cleanClipTheme))) {
        return true
      }
    }

    return false
  })
}

function isHookRendered(hook: Hook | null) {
  if (!hook) return false
  
  const status = state.jobStatus.value
  if (['cutting', 'transcribing', 'queued'].includes(status)) {
    if (state.activeHook.value) {
      const hStart = typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start
      const hEnd = typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end
      const aStart = typeof state.activeHook.value.start === 'string' ? parseFloat(state.activeHook.value.start) : state.activeHook.value.start
      const aEnd = typeof state.activeHook.value.end === 'string' ? parseFloat(state.activeHook.value.end) : state.activeHook.value.end
      if (Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1) {
        return false
      }
    }
  }
  
  const matchingClip = findMatchingClip(hook)
  if (!matchingClip) return false
  
  // If this clip is currently being processed (cut/transcribed) in the active job, it is not ready/rendered yet
  if (['cutting', 'transcribing', 'queued'].includes(status) && state.clipId.value === matchingClip.clip_id) {
    return false
  }
  
  return true
}

async function toggleSaveHook(hook: Hook) {
  const existing = state.savedHooks.value.find((h: Hook) => Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1)
  if (existing) {
    if (existing._id) {
      await state.deleteSavedHook(existing._id)
    }
  } else {
    await state.saveHook(hook)
  }
}

const currentPrompt = computed(() => {
  return state.promptsList.value.find((p: PromptTemplate) => p.id === state.selectedPrompt.value)
})

const isProcessing = computed(() => {
  return ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks', 'cutting', 'extracting_video'].includes(state.jobStatus.value)
})

const isAnalyzing = computed(() => {
  return ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'transcribing', 'generating_hooks'].includes(state.jobStatus.value)
})

const showProcessingOverlay = ref(false)
const isReanalyzingCached = ref(false)
let processingTimeout: ReturnType<typeof setTimeout> | null = null
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  [() => isAnalyzing.value, () => state.jobStatus.value],
  ([active, status]) => {
    if (active) {
      if (processingTimeout) {
        clearTimeout(processingTimeout)
        processingTimeout = null
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
        scrollTimeout = null
      }
      showProcessingOverlay.value = true
    } else {
      if (status === 'hooks_ready' || status === 'ready') {
        if (!processingTimeout) {
          processingTimeout = setTimeout(() => {
            showProcessingOverlay.value = false
            processingTimeout = null
            scrollTimeout = setTimeout(() => {
              if (typeof document !== 'undefined') {
                const el = document.getElementById('hooks-header')
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }
              scrollTimeout = null
            }, 300)
          }, 1000)
        }
      } else {
        if (processingTimeout) {
          clearTimeout(processingTimeout)
          processingTimeout = null
        }
        if (scrollTimeout) {
          clearTimeout(scrollTimeout)
          scrollTimeout = null
        }
        showProcessingOverlay.value = false
      }
    }
  },
  { immediate: true }
)

const stages = computed(() => {
  const currentStatus = state.jobStatus.value
  const isCached = state.isCachedAnalysis.value
  
  if (isCached && !isReanalyzingCached.value) {
    // 1-stage layout: Cache Lookup only for instant cache load
    const stage1Statuses = ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models', 'generating_hooks', 'cutting', 'extracting_video']
    const allStatuses = stage1Statuses
    const currentIndex = allStatuses.indexOf(currentStatus)
    
    const getStageState = (statuses: string[]) => {
      if (statuses.includes(currentStatus)) return 'active'
      const stageFirstIndex = allStatuses.indexOf(statuses[0]!)
      if (currentIndex !== -1 && currentIndex < stageFirstIndex) {
        return 'pending'
      }
      return 'completed'
    }
    
    return [
      {
        id: 'cache_lookup',
        name: 'Cache Lookup',
        description: 'Verifying local video assets & transcripts',
        icon: 'ri:database-2-line',
        state: getStageState(stage1Statuses)
      }
    ]
  } else if (isCached) {
    // 2-stage layout: Cache Lookup + AI Analysis for forced re-analysis
    const stage1Statuses = ['queued', 'checking_transcript', 'downloading_video', 'downloading_ai_models']
    const stage2Statuses = ['generating_hooks', 'cutting', 'extracting_video']
    const allStatuses = [...stage1Statuses, ...stage2Statuses]
    const currentIndex = allStatuses.indexOf(currentStatus)
    
    const getStageState = (statuses: string[]) => {
      if (statuses.includes(currentStatus)) return 'active'
      const stageFirstIndex = allStatuses.indexOf(statuses[0]!)
      if (currentIndex !== -1 && currentIndex < stageFirstIndex) {
        return 'pending'
      }
      return 'completed'
    }
    
    return [
      {
        id: 'cache_lookup',
        name: 'Cache Lookup',
        description: 'Verifying local video assets & transcripts',
        icon: 'ri:database-2-line',
        state: getStageState(stage1Statuses)
      },
      {
        id: 'analysis',
        name: 'AI Analysis',
        description: 'AI Model generating hooks',
        icon: 'ri:magic-line',
        state: getStageState(stage2Statuses)
      }
    ]
  } else {
    // 4-stage layout: full URL ingestion pipeline with preview-first
    const stage1Statuses = ['queued', 'checking_transcript']
    const stage2Statuses = ['downloading_video', 'downloading_ai_models']
    const stage3Statuses = ['transcribing', 'generating_hooks']
    const stage4Statuses = ['cutting', 'extracting_video']
    const allStatuses = [...stage1Statuses, ...stage2Statuses, ...stage3Statuses, ...stage4Statuses]
    const currentIndex = allStatuses.indexOf(currentStatus)
    
    const getStageState = (statuses: string[]) => {
      if (statuses.includes(currentStatus)) return 'active'
      const stageFirstIndex = allStatuses.indexOf(statuses[0]!)
      if (currentIndex !== -1 && currentIndex < stageFirstIndex) {
        return 'pending'
      }
      return 'completed'
    }
    
    return [
      {
        id: 'ingestion',
        name: 'Ingestion',
        description: 'Verifying URL & transcript',
        icon: 'ri:link-m',
        state: getStageState(stage1Statuses)
      },
      {
        id: 'preview_download',
        name: 'Fast Preview',
        description: 'Fetching preview video',
        icon: 'ri:download-cloud-2-line',
        state: getStageState(stage2Statuses)
      },
      {
        id: 'analysis',
        name: 'AI Analysis',
        description: 'AI Model generating hooks',
        icon: 'ri:magic-line',
        state: getStageState(stage3Statuses)
      },
      {
        id: 'previews',
        name: 'Visual Previews',
        description: 'Generating sharp hook thumbnails',
        icon: 'ri:image-line',
        state: getStageState(stage4Statuses)
      }
    ]
  }
})

const progressPercent = computed(() => {
  const currentStatus = state.jobStatus.value
  if (['hooks_ready', 'ready'].includes(currentStatus)) return 100
  if (state.isCachedAnalysis.value) {
    const map: Record<string, number> = {
      queued: 20,
      checking_transcript: 50,
      downloading_video: 50,
      downloading_ai_models: 50,
      generating_hooks: 85,
      cutting: 95,
      extracting_video: 95
    }
    return map[currentStatus] || 0
  } else {
    const map: Record<string, number> = {
      queued: 12.5,
      checking_transcript: 25,
      downloading_video: 40,
      downloading_ai_models: 50,
      transcribing: 75,
      generating_hooks: 90,
      cutting: 95,
      extracting_video: 98
    }
    return map[currentStatus] || 0
  }
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

const processingTitle = computed(() => {
  if (!isProcessing.value) return ''
  return state.videoTitle.value || 'Untitled Project'
})

function formatSec(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatHookDuration(start: number, end: number) {
  const diff = Math.abs(end - start)
  if (diff < 60) return `(${Math.floor(diff)}s)`
  const m = Math.floor(diff / 60)
  const s = Math.floor(diff % 60)
  if (s === 0) return `(${m}m)`
  return `(${m}m ${s}s)`
}

// fetchCached moved to useClipperState.ts
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

watch(cachedVideosSearch, (newVal) => {
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

function loadMoreCached() {
  cachedVideosPage.value += 1
  state.fetchCached(false)
}

async function analyzeCached(
  videoId: string, 
  force = false, 
  options?: { promptFile: string; numHooks: number; autoHooks: boolean }
) {
  state.isCachedAnalysis.value = true
  isReanalyzingCached.value = force
  state.downloadPercent.value = 0
  state.hdReady.value = false
  state.jobStatus.value = 'queued'
  state.jobError.value = null
  state.hooks.value = []
  state.savedHooks.value = []
  state.folderName.value = null
  state.outputUrl.value = null
  state.activeHook.value = null // Reset active hook
  state.clipId.value = null

  try {
    const promptFile = options ? options.promptFile : state.selectedPrompt.value
    const numHooks = options ? options.numHooks : (state.promptsList.value.find((p: PromptTemplate) => p.id === state.selectedPrompt.value)?.numHooks ?? 10)
    const autoHooks = options ? options.autoHooks : (state.promptsList.value.find((p: PromptTemplate) => p.id === state.selectedPrompt.value)?.autoHooks ?? false)

    const res = await $fetch<{ job_id: string; status: string; hooks?: Hook[]; folder_name?: string; video?: any }>(`${API_BASE}/api/analyze-cached/${videoId}?force=${force}`, { 
      method: 'POST',
      body: { 
        prompt_file: promptFile,
        num_hooks: numHooks,
        auto_hooks: autoHooks
      }
    })
    
    state.jobId.value = res.job_id
    state.jobStatus.value = res.status
    
    // Hydrate immediately from cached response
    if (res.hooks) {
      state.hooks.value = res.hooks
    }
    if (res.folder_name) {
      state.folderName.value = res.folder_name
    }
    if (res.video) {
      if (res.video.title) state.videoTitle.value = res.video.title
      if (res.video.duration) state.videoDuration.value = res.video.duration
      if (res.video.fps) state.videoFps.value = res.video.fps
      state.hasHeatmap.value = res.video.has_heatmap || false
      if (res.video.has_preview !== undefined) {
        state.hasPreview.value = res.video.has_preview
      }
      if (res.video.hd_ready !== undefined) {
        state.hdReady.value = res.video.hd_ready
      }
      if (res.video.asset_url) {
        state.videoUrl.value = `${API_BASE}${res.video.asset_url}`
      }
    }
    
    await state.fetchSavedHooks()
    
    if (res.status === 'ready') {
      // Done, no polling needed
    } else {
      state.startPolling()
    }
  } catch (e: unknown) {
    state.jobStatus.value = 'error'
    state.jobError.value = e instanceof Error ? e.message : String(e)
  }
}

function confirmRedownload(vid: CachedVideo) {
  if (window.confirm(`Are you sure you want to re-download "${vid.title}"? This will replace the existing file.`)) {
    deleteThenRedownload(vid.folder_name, vid.video_id)
  }
}

async function deleteThenRedownload(folderName: string, videoId: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    state.youtubeUrl.value = `https://youtube.com/watch?v=${videoId}`
    state.analyzeUrl()
    await state.fetchCached(true)
  } catch (e: unknown) {
    state.jobError.value = e instanceof Error ? e.message : String(e)
  }
}

function confirmDelete(vid: CachedVideo) {
  videoToDelete.value = vid
  deleteConfirmModalOpen.value = true
}

async function deleteVideo(folderName: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    
    // Check if the deleted video is the active workspace video
    if (state.folderName.value === folderName) {
      state.resetWorkspace()
      state.showToast('Workspace reset because active video was deleted.', 'info')
    }
    
    await state.fetchCached(true)
    state.showToast('Video source successfully deleted.', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    state.jobError.value = msg
    state.showToast(msg, 'error')
  } finally {
    deleteConfirmModalOpen.value = false
    videoToDelete.value = null
  }
}

async function fetchReadyClips() {
  if (readyClips.value.length === 0) {
    isReadyClipsLoading.value = true
  }
  try {
    const res = await $fetch<{ clips: ReadyClip[] }>(`${API_BASE}/api/ready-clips`)
    readyClips.value = res.clips || []
  } catch { 
    if (readyClips.value.length === 0) readyClips.value = [] 
  } finally {
    isReadyClipsLoading.value = false
  }
}

async function loadReadyClip(clip: ReadyClip) {
  const router = useRouter()
  console.log('[yonru] Loading ready clip:', clip.clip_id, 'from folder:', clip.folder_name)
  showAllReadyClips.value = false
  
  try {
    isNavigatingToEditor.value = true
    const minWait = new Promise(resolve => setTimeout(resolve, 600))
    // Load the clip into state first to get a job_id
    await state.loadReadyClipIntoEditor(clip.folder_name, clip.clip_id)
    
    console.log('[yonru] State loaded. JobID:', state.jobId.value, 'FolderName:', state.folderName.value)
    
    // Save this as the last accessed clip
    state.setLastClip(clip.folder_name, clip.clip_id, clip.theme || clip.title)
    
    // Find matching hook index in the loaded hooks list to highlight correctly
    let hookIndex = 0
    let tab = 'generated'
    
    const parts = clip.clip_id.split('_')
    const part0 = parts[0]
    const part1 = parts[1]
    if (part0 !== undefined && part1 !== undefined) {
      const clipStart = parseFloat(part0) || 0
      const clipEnd = parseFloat(part1) || 0
      
      // Ensure saved hooks are loaded
      await state.fetchSavedHooks()
      
      // Look in saved hooks first
      const savedIdx = state.savedHooks.value.findIndex((h: Hook) => {
        const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
        const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
        return Math.abs(hStart - clipStart) < 1.1 && Math.abs(hEnd - clipEnd) < 1.1
      })
      
      if (savedIdx >= 0) {
        hookIndex = savedIdx
        tab = 'saved'
      } else {
        // Look in generated hooks
        const genIdx = state.hooks.value.findIndex((h: Hook) => {
          const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
          const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
          return Math.abs(hStart - clipStart) < 1.1 && Math.abs(hEnd - clipEnd) < 1.1
        })
        if (genIdx >= 0) {
          hookIndex = genIdx
          tab = 'generated'
        }
      }
    }
    
    await minWait
    // Then navigate with the job_id for persistence/refresh
    console.log('[yonru] Navigating to editor with hook index:', hookIndex, 'tab:', tab)
    await router.push({
      path: '/editor',
      query: { 
        job_id: state.jobId.value || '',
        folder: clip.folder_name,
        clip_id: clip.clip_id,
        hook_index: hookIndex,
        tab: tab
      }
    })
  } catch (e) {
    console.error('[yonru] Failed to load ready clip:', e)
    state.showToast('Failed to load clip data', 'error')
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
      // Single delete
      const clip = clipToDelete.value
      await $fetch(`${API_BASE}/api/ready-clips/${clip.folder_name}/${clip.clip_id}`, { method: 'DELETE' })
      state.showToast('Clip successfully deleted.', 'success')
      await fetchReadyClips()
    } else if (selectedClips.value.size > 0) {
      // Bulk delete
      const count = selectedClips.value.size
      isBatchDeleting.value = true
      const clipsToDelete = readyClips.value
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
      await fetchReadyClips()
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

async function selectHook(hook: Hook) {
  if (isProcessing.value) return
  isNavigatingToEditor.value = true
  const minWait = new Promise(resolve => setTimeout(resolve, 600))
  state.activeHook.value = hook
  console.log('[clipper] Navigating to editor: waiting for HD cache readiness...')
  
  // Wait for HD ready if background prefetching is still active
  if (!state.hdReady.value && state.downloadPercent.value < 100) {
    try {
      await new Promise<void>((resolve, reject) => {
        const unwatch = watch(
          [state.hdReady, state.downloadPercent, state.jobStatus],
          ([ready, percent, status]) => {
            if (ready || percent === 100) {
              unwatch()
              resolve()
            } else if (status === 'error') {
              unwatch()
              reject(new Error(state.jobError.value || 'HD source download failed.'))
            }
          },
          { immediate: true }
        )
      })
    } catch (err: any) {
      isNavigatingToEditor.value = false
      state.showToast(err.message || 'Failed to prepare HD assets.', 'error')
      return
    }
  }

  // Fire extract in background
  state.extractClip(hook)
  
  // Navigate with hook info for refresh persistence
  const hooksList = activeTab.value === 'saved' ? state.savedHooks.value : state.hooks.value
  const hookIndex = hooksList.indexOf(hook)
  
  await minWait
  await navigateTo({
    path: '/editor',
    query: { 
      job_id: state.jobId.value, 
      folder: state.folderName.value,
      hook_index: hookIndex >= 0 ? hookIndex : 0,
      tab: activeTab.value
    }
  })
}

// onMounted moved up to unify initialization logic
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

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  opacity: 0;
  animation: fadeInUp 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

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
