<template>
  <NuxtLayout>
    <div class="w-full max-w-5xl z-10 flex flex-col">
        <!-- Header Input Area -->
        <div class="text-center mt-12 mb-10">
          <h2 class="text-4xl font-bold tracking-tight text-white mb-4">Paste URL. Extract Hooks.</h2>
          <p class="text-slate-400 max-w-xl mx-auto mb-8">Download strict 1080p video, extract audio locally, and let Gemini find the most viral segments.</p>
          
          <div class="relative max-w-2xl mx-auto flex items-center group shadow-2xl">
             <input 
               v-model="state.youtubeUrl.value"
               type="url" 
               placeholder="https://youtube.com/watch?v=..." 
               class="w-full bg-[#111318] border border-surface-border text-white px-6 py-4 rounded-xl pr-32 focus:outline-none focus:border-accent-500/50 transition-all font-medium"
               :disabled="isProcessing"
             />
             <button 
               @click="handleAnalyzeClick" 
               :disabled="!state.youtubeUrl.value || isProcessing"
               class="absolute right-2 px-5 py-2.5 bg-accent-500 text-black font-bold uppercase tracking-wider text-sm rounded-lg hover:bg-accent-400 hover:shadow-[0_0_15px_#CFFF50] focus:outline-none disabled:opacity-50 disabled:hover:shadow-none transition-all"
             >
               {{ isProcessing ? 'WORKING...' : 'ANALYZE' }}
             </button>
          </div>
          
          <div class="max-w-2xl mx-auto mt-4 flex items-center gap-3 bg-[#111318]/50 p-2 rounded-xl border border-surface-border/50">
            <label class="text-slate-400 text-xs font-bold uppercase tracking-widest shrink-0 pl-3">AI PROMPT:</label>
            <select 
              v-model="state.selectedPrompt.value"
              class="flex-1 bg-surface-dark border border-surface-border text-white px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-accent-500/50 appearance-none cursor-pointer"
              :disabled="isProcessing"
            >
              <option v-for="p in state.promptsList.value" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
            
            <!-- Tooltip for suitableFor -->
            <div class="relative group cursor-help pr-2">
              <Icon name="ri:information-line" class="text-slate-500 text-xl group-hover:text-accent-500 transition-colors" />
              
              <!-- Tooltip Content -->
              <div class="absolute bottom-full right-0 mb-3 w-80 bg-surface-panel border border-surface-border rounded-xl shadow-2xl p-4 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0 z-50 text-left">
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
                <div class="absolute -bottom-2 right-2 w-4 h-4 bg-surface-panel border-b border-r border-surface-border transform rotate-45"></div>
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
                  {{ formatSec(clip.duration) }}
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
        <div v-if="(cachedVideos.length > 0 || isCachedLoading) && !isProcessing && !state.hooks.value.length" class="mb-14 overflow-visible p-8">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Icon name="ri:folder-video-fill" class="text-accent-500" />
              Cached Library
            </h3>
            <div class="flex items-center gap-2 bg-surface-dark border border-surface-border p-1 rounded-lg">
              <button 
                @click="viewMode = 'grid'" 
                class="p-1.5 rounded transition-all"
                :class="viewMode === 'grid' ? 'bg-surface-panel text-white shadow' : 'text-slate-500 hover:text-slate-300'"
              >
                <Icon name="ri:grid-fill" />
              </button>
              <button 
                @click="viewMode = 'list'" 
                class="p-1.5 rounded transition-all"
                :class="viewMode === 'list' ? 'bg-surface-panel text-white shadow' : 'text-slate-500 hover:text-slate-300'"
              >
                <Icon name="ri:list-check" />
              </button>
            </div>
          </div>

          <!-- Skeletons (Grid Mode) -->
          <div v-if="isCachedLoading && viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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

          <!-- Grid View -->
          <div v-else-if="viewMode === 'grid'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div 
              v-for="vid in cachedVideos" :key="vid.video_id"
              class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-2xl flex flex-col group hover:border-accent-500/50 hover:shadow-[0_0_30px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden"
              :class="{ 'opacity-50 pointer-events-none': isProcessing }"
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
                    @click.stop="analyzeCached(vid.video_id, true)"
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
          <div v-else class="flex flex-col gap-3">
            <div 
              v-for="vid in cachedVideos" :key="vid.video_id"
              class="bg-surface-panel/50 backdrop-blur-md border border-surface-border rounded-2xl p-2 flex items-center gap-5 group hover:border-accent-500/50 hover:shadow-[0_0_20px_rgba(207,255,80,0.05)] transition-all cursor-pointer relative overflow-hidden"
              :class="{ 'opacity-50 pointer-events-none': isProcessing }"
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
                  @click.stop="analyzeCached(vid.video_id, true)"
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
        </div>

        <!-- Processing State -->
        <div v-if="isProcessing && !state.hooks.value.length" class="bg-[#111318] border border-surface-border p-12 rounded-2xl shadow-2xl flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
           <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>
            <!-- Atmospheric lighting behind spinner -->
            <div class="absolute w-40 h-40 bg-accent-500/10 rounded-full blur-[60px] animate-pulse"></div>
            
            <div class="w-20 h-20 rounded-full bg-surface-dark border-[4px] border-surface-border border-t-accent-500 animate-spin flex items-center justify-center mb-8 shadow-[0_0_20px_#CFFF50_inset,0_0_40px_rgba(207,255,80,0.3)] relative z-10">
            </div>
          <h3 class="font-black text-white tracking-widest text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-500">{{ loadingLabel }}</h3>
          
          <div class="w-full max-w-lg mt-8 bg-black/50 border border-surface-border rounded-lg p-5 font-mono text-xs text-slate-400 text-left shadow-inner">
             <div class="flex justify-between border-b border-surface-border/50 pb-2 mb-3">
                <span class="text-accent-500 font-bold">PIPELINE STATUS</span>
                <span class="text-slate-500">{{ state.jobId.value || '—' }}</span>
             </div>
             <p class="mb-1">» Pipeline: Verify Transcript → Download 1080p → Gemini AI</p>
             <p class="mb-1 text-slate-300">» Engine: yt-dlp + FFmpeg + Gemini API</p>
             <p class="mb-1">» Status: {{ state.jobStatus.value }}...</p>
             <p class="text-accent-500 mt-2 font-bold animate-pulse">» Please wait, processing on server...</p>
          </div>
        </div>

      <!-- Hit List -->
      <div v-if="state.jobStatus.value === 'hooks_ready' || state.hooks.value.length > 0 || state.savedHooks.value.length > 0" class="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full p-8">
         <div class="flex flex-col mb-6">
            <div class="flex items-center justify-between mb-2 border-b border-surface-border pb-2">
              <div class="flex items-center gap-6">
                <button @click="activeTab = 'generated'" :class="activeTab === 'generated' ? 'text-white border-b-2 border-accent-500' : 'text-slate-500 hover:text-slate-300'" class="text-xl font-bold flex items-center gap-2 pb-2 -mb-[9px] transition-colors">
                  <Icon name="ri:fire-fill" :class="activeTab === 'generated' ? 'text-accent-500' : 'text-slate-500'" /> Generated Hooks ({{ state.hooks.value.length }})
                </button>
                <button @click="activeTab = 'saved'" :class="activeTab === 'saved' ? 'text-white border-b-2 border-amber-400' : 'text-slate-500 hover:text-slate-300'" class="text-xl font-bold flex items-center gap-2 pb-2 -mb-[9px] transition-colors">
                  <Icon name="ri:bookmark-fill" :class="activeTab === 'saved' ? 'text-amber-400' : 'text-slate-500'" /> Saved Hooks ({{ state.savedHooks.value.length }})
                </button>
              </div>
              <button 
                @click="resetToStart" 
                class="flex items-center gap-2 px-3 py-1.5 bg-surface-dark border border-surface-border rounded-lg text-xs font-bold text-slate-400 hover:text-accent-500 hover:border-accent-500/50 transition-all shadow-sm"
              >
                <Icon name="ri:arrow-left-line" /> Back to Library
              </button>
            </div>
            <p class="text-slate-400 text-sm mt-2">Select a hook to cut the segment and start editing.</p>
         </div>

         <!-- Generated Hooks List -->
         <div v-show="activeTab === 'generated'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div 
              v-for="(hook, idx) in state.hooks.value" 
              :key="idx"
              @click="selectedModalHook = hook"
              @mouseenter="hoveredHookIndex = idx"
              @mouseleave="hoveredHookIndex = null"
              class="bg-surface-panel border border-surface-border hover:border-accent-500/50 rounded-xl cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col"
            >
              <div class="absolute inset-0 bg-gradient-to-br from-accent-500/0 to-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0"></div>
              
              <!-- Video Preview Area -->
              <div class="w-full aspect-video bg-black relative overflow-hidden rounded-t-xl shrink-0 border-b border-surface-border z-10">
                 <Icon name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity" />
                 <video 
                   v-if="state.videoUrl.value"
                   :src="state.videoUrl.value + '#t=' + Math.max(0, hook.start - state.startSafetyBuffer.value)"
                   muted
                   preload="metadata"
                   class="absolute inset-0 w-full h-full object-cover z-10"
                   @mouseenter="e => { const p = (e.target as HTMLVideoElement).play(); if (p !== undefined) p.catch(() => {}); }"
                   @mouseleave="e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                   @timeupdate="e => { if (selectedModalHook === null && (e.target as HTMLVideoElement).currentTime >= hook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                 ></video>
                 <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded-lg text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10">
                   {{ formatHookDuration(hook.start, hook.end) }}
                 </div>
              </div>
              
              <div class="p-5 flex-1 flex flex-col relative z-10">
                <div class="flex justify-between items-start mb-4">
                  <div class="flex items-center gap-2">
                    <span class="bg-surface-dark border border-surface-border px-2 py-0.5 rounded text-[10px] b-mono text-accent-500 font-black tracking-widest">HOOK {{ String(idx + 1).padStart(2, '0') }}</span>
                    <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center">
                      <div class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help">
                        <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                      </div>
                      <!-- Custom Tooltip -->
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-30 font-medium normal-case tracking-normal text-center">
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
         <div v-show="activeTab === 'saved'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-if="state.savedHooks.value.length === 0" class="col-span-1 md:col-span-2 py-12 text-center text-slate-500">
               No saved hooks yet. Click the bookmark icon on any generated hook to save it here.
            </div>
            <div 
              v-else
              v-for="(hook, idx) in state.savedHooks.value" 
              :key="hook._id || idx"
              @click="selectedModalHook = hook"
              @mouseenter="hoveredHookIndex = idx + 1000"
              @mouseleave="hoveredHookIndex = null"
              class="bg-surface-panel border border-surface-border hover:border-amber-400/50 rounded-xl cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col"
            >
              <div class="absolute inset-0 bg-gradient-to-br from-amber-400/0 to-amber-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0"></div>
              
              <!-- Video Preview Area -->
              <div class="w-full aspect-video bg-black relative overflow-hidden rounded-t-xl shrink-0 border-b border-surface-border z-10">
                 <Icon name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity" />
                 <video 
                   v-if="state.videoUrl.value"
                   :src="state.videoUrl.value + '#t=' + Math.max(0, hook.start - state.startSafetyBuffer.value)"
                   muted
                   preload="metadata"
                   class="absolute inset-0 w-full h-full object-cover z-10"
                   @mouseenter="e => { const p = (e.target as HTMLVideoElement).play(); if (p !== undefined) p.catch(() => {}); }"
                   @mouseleave="e => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                   @timeupdate="e => { if (selectedModalHook === null && (e.target as HTMLVideoElement).currentTime >= hook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, hook.start - state.startSafetyBuffer.value); }"
                 ></video>
                 <div class="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded-lg text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10">
                   {{ formatHookDuration(hook.start, hook.end) }}
                 </div>
              </div>
              
              <div class="p-5 flex-1 flex flex-col relative z-10">
                <div class="flex justify-between items-start mb-4">
                  <div class="flex items-center gap-2">
                    <span class="bg-surface-dark border border-amber-500/30 px-2 py-0.5 rounded text-[10px] b-mono text-amber-500 font-black tracking-widest">SAVED</span>
                    <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center">
                      <div class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help">
                        <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                      </div>
                      <!-- Custom Tooltip -->
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-30 font-medium normal-case tracking-normal text-center">
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
      </div>
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
                  v-if="state.videoUrl.value"
                  :src="state.videoUrl.value"
                  controls
                  autoplay
                  class="w-full h-full object-contain max-h-[70vh]"
                  @timeupdate="e => { if (selectedModalHook && (e.target as HTMLVideoElement).currentTime >= selectedModalHook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value); }"
                  @loadedmetadata="e => { if (selectedModalHook) (e.target as HTMLVideoElement).currentTime = Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value); }"
                ></video>
                <div v-else class="w-full h-full flex flex-col items-center justify-center text-slate-500">
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
                   
                   <div class="flex items-center gap-2 mb-6 bg-surface-dark border border-surface-border/50 px-3 py-2 rounded-lg self-start w-max">
                      <Icon name="ri:time-line" class="text-slate-400" />
                      <span class="text-slate-300 font-mono text-xs">{{ state.formatDuration(selectedModalHook.start) }} - {{ state.formatDuration(selectedModalHook.end) }}</span>
                      <span class="text-accent-500 font-bold ml-1 text-xs">{{ formatHookDuration(selectedModalHook.start, selectedModalHook.end) }}</span>
                   </div>

                   <div class="bg-black/30 p-5 rounded-xl border border-surface-border relative group overflow-y-auto max-h-[250px] custom-scrollbar">
                      <Icon name="ri:quote-text" class="absolute -top-2 -right-2 text-6xl text-surface-border opacity-30 group-hover:text-accent-500/10 transition-colors" />
                      <p class="text-slate-300 text-sm italic leading-relaxed relative z-10">"{{ (selectedModalHook.transcript_quote || '').length > 300 ? (selectedModalHook.transcript_quote || '').substring(0, 297) + '...' : (selectedModalHook.transcript_quote || '') }}"</p>
                   </div>

                    <!-- Start Safety Buffer Adjustment -->
                    <div class="mt-5 bg-black/20 p-4 rounded-xl border border-surface-border/50">
                       <div class="flex items-center justify-between mb-3">
                          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                             <Icon name="ri:settings-5-line" class="text-accent-500" />
                             Start Safety Buffer
                          </span>
                          <div class="flex items-center gap-2">
                             <input 
                                type="number" 
                                min="0" 
                                max="5" 
                                step="1"
                                v-model.number="state.startSafetyBuffer.value" 
                                class="w-14 bg-surface-dark border border-surface-border rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                             />
                             <span class="text-[10px] text-slate-500 font-bold">sec</span>
                          </div>
                       </div>
                       <input 
                          type="range" 
                          min="0" 
                          max="5" 
                          step="1" 
                          v-model.number="state.startSafetyBuffer.value" 
                          class="w-full h-1 bg-surface-dark rounded-lg appearance-none cursor-pointer accent-accent-500"
                       />
                       <p class="text-[9px] text-slate-500 mt-2 italic font-medium leading-relaxed">
                          Adds padding before the hook starts to ensure opening words (e.g. "Ada") are not cut off.
                       </p>
                    </div>
                </div>

                <div class="mt-8 pt-6 border-t border-surface-border/50">
                   <button 
                     @click="() => { selectHook(selectedModalHook); selectedModalHook = null; }" 
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
            <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
            
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
                 @click="() => { duplicateModalOpen = false; analyzeCached(duplicateVideoId, true); }"
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

     <!-- Beautiful Glass Deletion Warning Modal -->
     <div v-if="deleteConfirmModalOpen && videoToDelete" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop filter blurring background -->
        <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="deleteConfirmModalOpen = false"></div>
        
        <!-- Content Card -->
        <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
           <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
           
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
           <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
           
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
                          {{ formatSec(clip.duration) }}
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
const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const viewMode = ref<'grid' | 'list'>('grid')
const { 
  cachedVideos, isCachedLoading, lastAccessedVideo, lastAccessedVideoId, 
  setLastAccessed, isNavigatingToEditor,
  thumbnailEnabled, contentAudit, customBlacklist,
  videoTitle, lastAccessedClip
} = state
const readyClips = useState<any[]>('readyClips', () => [])
const isReadyClipsLoading = ref(false)
const activeTab = ref<'generated' | 'saved'>('generated')
const hoveredHookIndex = ref<number | null>(null)
const selectedModalHook = ref<any | null>(null)
const modalVideoPlayer = ref<HTMLVideoElement | null>(null)
const deleteConfirmModalOpen = ref(false)
const videoToDelete = ref<any | null>(null)
const clipDeleteConfirmModalOpen = ref(false)
const clipToDelete = ref<any | null>(null)
const showAllReadyClips = ref(false)
const loadedClips = ref(new Set<string>())

// Library Duplicate Intercept state & helpers
const duplicateModalOpen = ref(false)
const duplicateVideoId = ref('')

function extractYoutubeId(url: string): string | null {
  const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i
  const match = url.match(reg)
  return match ? (match[1] ?? null) : null
}

function handleAnalyzeClick() {
  const url = state.youtubeUrl.value
  if (!url) return
  
  const videoId = extractYoutubeId(url)
  if (videoId && cachedVideos.value.some(v => v.video_id === videoId)) {
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
  }

  // Always reset active hook when returning to home, so background analysis polling can update videoUrl
  state.activeHook.value = null

  await state.fetchPrompts()
  await state.fetchSavedHooks()
  await state.fetchCached()
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

// Manage Mode
const isManageMode = ref(false)
const selectedClips = ref(new Set<string>())
const isBatchDeleting = ref(false)
const showSuccessState = ref(false)
const lastDeletedCount = ref(0)
let successTimeout: any = null

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

function handleClipClick(clip: any) {
  if (isManageMode.value) {
    const next = new Set(selectedClips.value)
    if (next.has(clip.clip_id)) {
      next.delete(clip.clip_id)
    } else {
      next.add(clip.clip_id)
    }
    selectedClips.value = next
  } else {
    const parentVid = cachedVideos.value.find(v => v.folder_name === clip.folder_name)
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
  } catch (e: any) {
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
}

function isHookSaved(hook: any) {
  return state.savedHooks.value.some(h => Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1)
}

function isHookRendered(hook: any) {
  if (!readyClips.value?.length || !state.folderName.value || !hook) return false
  return readyClips.value.some(c => {
    if (c.folder_name !== state.folderName.value) return false
    const parts = c.clip_id.split('_')
    if (parts.length < 2) return false
    const cStart = parseFloat(parts[0])
    const cEnd = parseFloat(parts[1])
    return Math.abs(cStart - hook.start) < 1.1 && Math.abs(cEnd - hook.end) < 1.1
  })
}

async function toggleSaveHook(hook: any) {
  const existing = state.savedHooks.value.find(h => Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1)
  if (existing) {
    if (existing._id) {
      await state.deleteSavedHook(existing._id)
    }
  } else {
    await state.saveHook(hook)
  }
}

const currentPrompt = computed(() => {
  return state.promptsList.value.find(p => p.id === state.selectedPrompt.value)
})

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

async function analyzeCached(videoId: string, force = false) {
  state.jobStatus.value = 'queued'
  state.jobError.value = null
  state.hooks.value = []
  state.outputUrl.value = null
  state.activeHook.value = null // Reset active hook

  try {
    const currentPrompt = state.promptsList.value.find(p => p.id === state.selectedPrompt.value)
    const res = await $fetch<{ job_id: string; status: string }>(`${API_BASE}/api/analyze-cached/${videoId}?force=${force}`, { 
      method: 'POST',
      body: { 
        prompt_file: state.selectedPrompt.value,
        num_hooks: currentPrompt?.numHooks ?? 10,
        auto_hooks: currentPrompt?.autoHooks ?? false
      }
    })
    state.jobId.value = res.job_id
    state.jobStatus.value = res.status
    state.startPolling()
  } catch (e: any) {
    state.jobStatus.value = 'error'
    state.jobError.value = e.message || 'Failed to analyze cached video'
  }
}

function confirmRedownload(vid: any) {
  if (window.confirm(`Are you sure you want to re-download "${vid.title}"? This will replace the existing file.`)) {
    deleteThenRedownload(vid.folder_name, vid.video_id)
  }
}

async function deleteThenRedownload(folderName: string, videoId: string) {
  try {
    await $fetch(`${API_BASE}/api/cached/${folderName}`, { method: 'DELETE' })
    state.youtubeUrl.value = `https://youtube.com/watch?v=${videoId}`
    state.analyzeUrl()
    await state.fetchCached()
  } catch (e: any) {
    state.jobError.value = e.message || 'Failed to re-download'
  }
}

function confirmDelete(vid: any) {
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
    
    await state.fetchCached()
    state.showToast('Video source successfully deleted.', 'success')
  } catch (e: any) {
    state.jobError.value = e.message || 'Failed to delete'
    state.showToast(e.message || 'Failed to delete', 'error')
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
    const res = await $fetch<{ clips: any[] }>(`${API_BASE}/api/ready-clips`)
    readyClips.value = res.clips || []
  } catch { 
    if (readyClips.value.length === 0) readyClips.value = [] 
  } finally {
    isReadyClipsLoading.value = false
  }
}

async function loadReadyClip(clip: any) {
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
    if (parts.length >= 2) {
      const clipStart = parseFloat(parts[0]) || 0
      const clipEnd = parseFloat(parts[1]) || 0
      
      // Ensure saved hooks are loaded
      await state.fetchSavedHooks()
      
      // Look in saved hooks first
      const savedIdx = state.savedHooks.value.findIndex((h: any) => {
        const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
        const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
        return Math.abs(hStart - clipStart) < 1.1 && Math.abs(hEnd - clipEnd) < 1.1
      })
      
      if (savedIdx >= 0) {
        hookIndex = savedIdx
        tab = 'saved'
      } else {
        // Look in generated hooks
        const genIdx = state.hooks.value.findIndex((h: any) => {
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
    await navigateTo({
      path: '/editor',
      query: { 
        job_id: state.jobId.value || '',
        folder: clip.folder_name,
        hook_index: hookIndex,
        tab: tab
      }
    })
  } catch (e) {
    console.error('[yonru] Failed to load ready clip:', e)
    state.showToast('Failed to load clip data', 'error')
  }
}

function confirmDeleteClip(clip: any) {
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
  } catch (e: any) {
    console.error('Failed to delete clip(s)', e)
    state.showToast(e.message || 'Failed to delete clip(s)', 'error')
  } finally {
    clipDeleteConfirmModalOpen.value = false
    clipToDelete.value = null
    isBatchDeleting.value = false
  }
}

async function selectHook(hook: any) {
  if (isProcessing.value) return
  isNavigatingToEditor.value = true
  const minWait = new Promise(resolve => setTimeout(resolve, 600))
  state.activeHook.value = hook
  console.log('[clipper] Navigating to editor...')
  
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
