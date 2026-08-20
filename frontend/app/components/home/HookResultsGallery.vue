<template>
  <div id="hooks-header" class="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full p-8 -mt-8">
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
               @click="$emit('back-to-library')" 
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
                  
                  <!-- Virality Score Badge -->
                  <div v-if="hook.virality_score !== undefined" class="relative group/viral flex items-center">
                    <div 
                      class="px-2 py-0.5 rounded text-[10px] font-black tracking-wider flex items-center gap-1 cursor-help transition-all shadow-sm select-none"
                      :class="{
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]': hook.virality_score >= 90,
                        'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]': hook.virality_score >= 75 && hook.virality_score < 90,
                        'bg-slate-700/40 text-slate-300 border border-slate-600/40': hook.virality_score < 75
                      }"
                    >
                      <Icon :name="hook.virality_score >= 90 ? 'ri:fire-fill' : (hook.virality_score >= 75 ? 'ri:flashlight-fill' : 'ri:bar-chart-2-fill')" class="text-xs" />
                      <span>{{ hook.virality_score }}</span>
                    </div>

                    <!-- Tooltip with English Explanation -->
                    <div 
                      v-if="hook.virality_reason"
                      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#171a21]/95 backdrop-blur-md border border-surface-border text-[11px] text-slate-200 p-2.5 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/viral:opacity-100 group-hover/viral:pointer-events-auto transition-all translate-y-1 group-hover/viral:translate-y-0 z-40 font-medium normal-case tracking-normal text-left"
                    >
                      <div class="text-[10px] font-bold text-accent-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Icon name="ri:sparkling-fill" class="text-xs" />
                        Virality Breakdown ({{ hook.virality_score }}/100)
                      </div>
                      <div class="text-slate-300 leading-snug">{{ hook.virality_reason }}</div>
                      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-[#171a21]"></div>
                    </div>
                  </div>

                  <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center">
                    <div class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help">
                      <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                    </div>
                    <!-- Custom Tooltip -->
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-none shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-30 font-medium normal-case tracking-normal text-center">
                      This clip has already been cut and transcribed, and is ready for editing!
                      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                   <span class="text-slate-500 text-[10px] font-mono font-bold">{{ state.formatDuration(hook.start) }} - {{ state.formatDuration(hook.end) }}</span>
                   <button @click.stop="toggleSaveHook(hook)" class="text-slate-400 hover:text-amber-400 transition-colors z-20 cursor-pointer">
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
                  
                  <!-- Virality Score Badge -->
                  <div v-if="hook.virality_score !== undefined" class="relative group/viral flex items-center">
                    <div 
                      class="px-2 py-0.5 rounded text-[10px] font-black tracking-wider flex items-center gap-1 cursor-help transition-all shadow-sm select-none"
                      :class="{
                        'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]': hook.virality_score >= 90,
                        'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]': hook.virality_score >= 75 && hook.virality_score < 90,
                        'bg-slate-700/40 text-slate-300 border border-slate-600/40': hook.virality_score < 75
                      }"
                    >
                      <Icon :name="hook.virality_score >= 90 ? 'ri:fire-fill' : (hook.virality_score >= 75 ? 'ri:flashlight-fill' : 'ri:bar-chart-2-fill')" class="text-xs" />
                      <span>{{ hook.virality_score }}</span>
                    </div>

                    <!-- Tooltip with English Explanation -->
                    <div 
                      v-if="hook.virality_reason"
                      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#171a21]/95 backdrop-blur-md border border-surface-border text-[11px] text-slate-200 p-2.5 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/viral:opacity-100 group-hover/viral:pointer-events-auto transition-all translate-y-1 group-hover/viral:translate-y-0 z-40 font-medium normal-case tracking-normal text-left"
                    >
                      <div class="text-[10px] font-bold text-accent-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Icon name="ri:sparkling-fill" class="text-xs" />
                        Virality Breakdown ({{ hook.virality_score }}/100)
                      </div>
                      <div class="text-slate-300 leading-snug">{{ hook.virality_reason }}</div>
                      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-[#171a21]"></div>
                    </div>
                  </div>

                  <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center">
                    <div class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help">
                      <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                    </div>
                    <!-- Custom Tooltip -->
                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-none shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-30 font-medium normal-case tracking-normal text-center">
                      This clip has already been cut and transcribed, and is ready for editing!
                      <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-slate-900"></div>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                   <span class="text-slate-500 text-[10px] font-mono font-bold">{{ state.formatDuration(hook.start) }} - {{ state.formatDuration(hook.end) }}</span>
                   <button @click.stop="toggleSaveHook(hook)" class="text-amber-400 hover:text-red-400 transition-colors z-20 cursor-pointer">
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

     <!-- Cinematic Modal Overlay -->
     <div v-if="selectedModalHook" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/90 backdrop-blur-xl" @click="selectedModalHook = null"></div>
        
        <!-- Modal Content -->
        <div class="relative w-full max-w-5xl bg-surface-dark border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 max-h-[90vh]">
           <div class="absolute top-4 right-4 z-50">
              <button @click="selectedModalHook = null" class="w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all border border-white/10 hover:border-white/30 cursor-pointer">
                 <Icon name="ri:close-line" class="text-xl" />
               </button>
           </div>
           <div class="flex flex-col md:flex-row h-full overflow-hidden">
              <!-- Video Player (50/50) -->
              <div class="md:w-1/2 bg-black relative aspect-video md:aspect-auto flex-shrink-0 flex items-center justify-center">
                 <video 
                   ref="modalVideoPlayer"
                   v-if="modalVideoUrl"
                   :src="modalVideoUrl"
                   controls
                   autoplay
                   class="w-full h-full object-contain max-h-[70vh]"
                   @timeupdate="e => { if (selectedModalHook && (e.target as HTMLVideoElement).currentTime >= selectedModalHook.end) (e.target as HTMLVideoElement).currentTime = Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value); }"
                   @loadedmetadata="onModalLoadedMetadata"
                   @volumechange="onVolumeChange"
                 ></video>
                 <div v-if="state.hasPreview.value && modalVideoUrl" class="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-0.5 flex items-center gap-1 select-none group/resolution">
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
                       <div class="absolute bottom-full left-4 -mb-[5px] border-4 border-transparent border-b-[#171a21]/95"></div>
                    </div>
                 </div>
                 <div v-else-if="!modalVideoUrl" class="w-full h-full flex flex-col items-center justify-center text-slate-500">
                    <Icon name="ri:film-line" class="text-4xl mb-2 opacity-50" />
                    <p class="text-sm font-medium">Video source unavailable</p>
                 </div>
              </div>
              
              <!-- Sidebar Info (50/50) -->
              <div class="md:w-1/2 p-6 md:p-8 flex flex-col border-t md:border-t-0 md:border-l border-surface-border bg-surface-panel/50 overflow-y-auto custom-scrollbar select-text relative">
                 <div class="flex-1">
                    <div class="flex items-center gap-3 mb-4">

                       <!-- Virality Score Pill in Modal -->
                       <div 
                         v-if="selectedModalHook.virality_score !== undefined"
                         class="px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider flex items-center gap-1.5 shadow-sm"
                         :class="{
                           'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40': selectedModalHook.virality_score >= 90,
                           'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40': selectedModalHook.virality_score >= 75 && selectedModalHook.virality_score < 90,
                           'bg-slate-700/40 text-slate-300 border border-slate-600/40': selectedModalHook.virality_score < 75
                         }"
                       >
                         <Icon :name="selectedModalHook.virality_score >= 90 ? 'ri:fire-fill' : (selectedModalHook.virality_score >= 75 ? 'ri:flashlight-fill' : 'ri:bar-chart-2-fill')" class="text-sm" />
                         <span>VIRAL SCORE: {{ selectedModalHook.virality_score }}/100</span>
                       </div>

                       <button @click.stop="toggleSaveHook(selectedModalHook)" class="text-slate-400 hover:text-amber-400 transition-colors ml-auto cursor-pointer">
                          <Icon :name="isHookSaved(selectedModalHook) ? 'ri:bookmark-fill' : 'ri:bookmark-line'" class="text-xl" :class="{'text-amber-400': isHookSaved(selectedModalHook)}" />
                       </button>
                    </div>


                    <h3 class="text-xl md:text-2xl font-bold text-white mb-3 leading-tight">{{ selectedModalHook.theme || 'Untitled Hook' }}</h3>

                    

                    
                    <div class="flex flex-wrap items-center gap-2 mb-4">
                       <div class="flex items-center gap-2 bg-surface-dark border border-surface-border/50 px-3 py-2 rounded-lg w-max">
                          <Icon name="ri:time-line" class="text-slate-400" />
                          <span class="text-slate-300 font-mono text-xs">{{ state.formatDuration(Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value)) }} - {{ state.formatDuration(selectedModalHook.end) }}</span>
                          <span class="text-accent-500 font-bold ml-1 text-xs">{{ formatHookDuration(Math.max(0, selectedModalHook.start - state.startSafetyBuffer.value), selectedModalHook.end) }}</span>
                       </div>

                       <button 
                          @click="showAdjustDuration = !showAdjustDuration"
                          class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-dark hover:bg-surface-panel border border-surface-border hover:border-accent-500/50 text-slate-300 hover:text-accent-500 text-xs font-bold transition-all cursor-pointer select-none"
                          :class="{ 'border-accent-500/50 text-accent-500 bg-surface-panel': showAdjustDuration }"
                       >
                          <Icon name="ri:settings-4-line" />
                          Adjust Start - End
                          <Icon name="ri:arrow-down-s-line" class="text-xs transition-transform duration-200" :class="{ 'rotate-180': showAdjustDuration }" />
                       </button>
                    </div>

                    <!-- Floating Timing Adjustment Panel Overlay -->
                    <Transition
                       enter-active-class="transition duration-150 ease-out"
                       enter-from-class="transform -translate-y-2 opacity-0 scale-95"
                       enter-to-class="transform translate-y-0 opacity-100 scale-100"
                       leave-active-class="transition duration-100 ease-in"
                       leave-from-class="transform translate-y-0 opacity-100 scale-100"
                       leave-to-class="transform -translate-y-2 opacity-0 scale-95"
                    >
                       <div 
                          v-if="showAdjustDuration" 
                          class="absolute left-6 right-6 md:left-8 md:right-8 top-[148px] z-40 bg-[#141822]/98 backdrop-blur-2xl border border-surface-border rounded-2xl p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] space-y-4"
                       >
                          <div class="flex items-center justify-between">
                             <span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">Adjust Clip Timing</span>
                             <button 
                                v-if="selectedModalHook && (selectedModalHook.start !== selectedModalHook.originalStart || selectedModalHook.end !== selectedModalHook.originalEnd)"
                                @click="resetToDefaultDuration"
                                class="text-[9px] text-accent-500 hover:text-accent-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer"
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
                                       class="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
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
                                       class="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                                    />
                                    <span class="absolute right-3 text-[10px] text-slate-500 font-bold">mm:ss</span>
                                 </div>
                                 <span class="text-[10px] text-slate-500 block mt-1 font-mono">{{ selectedModalHook.end.toFixed(1) }}s</span>
                              </div>
                          </div>

                          <!-- Timeline Range Drag Control -->
                          <div class="space-y-1">
                             <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Drag to adjust</label>
                              <div class="relative w-full h-8 px-2 flex items-center select-none bg-black/40 border border-white/5 rounded-xl">
                                 <div 
                                    id="modal-hook-slider"
                                    class="relative w-full h-full flex items-center cursor-pointer"
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

                          <div class="flex justify-end pt-1">
                             <button 
                                @click="showAdjustDuration = false" 
                                class="px-3 py-1.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-accent-400 transition-colors cursor-pointer"
                             >
                                Done
                             </button>
                          </div>
                       </div>
                    </Transition>

                    <!-- Tabbed Switcher (Virality Breakdown [Tab 1 Default] vs Transcript Quote [Tab 2]) -->
                    <div class="flex items-center p-1 bg-surface-dark/90 border border-surface-border/60 rounded-xl mb-4 select-none">
                       <button 
                          @click="(e) => { activeModalTab = 'breakdown'; (e.currentTarget as HTMLElement)?.blur(); }" 
                          class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                          :class="activeModalTab === 'breakdown' ? 'bg-surface-panel text-accent-500 shadow-sm border border-surface-border' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'"
                       >
                          <Icon name="ri:sparkling-fill" class="text-xs" />
                          <span>Virality Breakdown</span>
                       </button>
                       <button 
                          @click="(e) => { activeModalTab = 'transcript'; (e.currentTarget as HTMLElement)?.blur(); }" 
                          class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                          :class="activeModalTab === 'transcript' ? 'bg-surface-panel text-accent-500 shadow-sm border border-surface-border' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'"
                       >
                          <Icon name="ri:chat-quote-line" class="text-xs" />
                          <span>Transcript Quote</span>
                       </button>
                    </div>

                    <!-- Tab 1: Virality Breakdown (Default) -->
                    <div v-if="activeModalTab === 'breakdown'" class="animate-in fade-in duration-200">
                       <div 
                         v-if="selectedModalHook.virality_reason"
                         class="h-[210px] p-5 bg-black/40 border border-surface-border/80 rounded-xl text-left shadow-lg relative overflow-hidden group flex flex-col"
                       >
                         <div class="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                            <Icon name="ri:sparkling-fill" class="text-9xl text-accent-500" />
                         </div>
                         <div class="text-[10px] font-black text-accent-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 shrink-0">
                           <Icon name="ri:sparkling-fill" class="text-xs" />
                           Virality Analysis
                         </div>
                         <div class="flex-1 overflow-y-auto custom-scrollbar relative z-10 pr-1">
                           <p class="text-xs md:text-sm text-slate-200 leading-relaxed font-normal">{{ selectedModalHook.virality_reason }}</p>
                         </div>
                       </div>
                       <div v-else class="h-[210px] p-6 bg-black/20 border border-surface-border rounded-xl flex items-center justify-center text-center text-slate-500 text-xs">
                         No virality breakdown available for this hook.
                       </div>
                    </div>

                    <!-- Tab 2: Transcript Quote -->
                    <div v-else-if="activeModalTab === 'transcript'" class="animate-in fade-in duration-200">
                       <div class="h-[210px] p-5 bg-black/40 border border-surface-border/80 rounded-xl relative group overflow-hidden text-left flex flex-col">
                          <Icon name="ri:quote-text" class="absolute -top-2 -right-2 text-6xl text-surface-border opacity-20 group-hover:text-accent-500/10 transition-colors pointer-events-none" />
                          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 shrink-0">
                            <Icon name="ri:mic-line" class="text-xs text-slate-400" />
                            Spoken Dialog
                          </div>
                          <div class="flex-1 overflow-y-auto custom-scrollbar relative z-10 pr-1">
                            <p class="text-slate-200 text-sm italic leading-relaxed font-serif">"{{ selectedModalHook.transcript_quote || 'No transcript quote available for this hook.' }}"</p>
                          </div>
                       </div>
                    </div>
                 </div>

                <div class="mt-8 pt-6 border-t border-surface-border/50">
                   <button 
                     @click="() => { if (selectedModalHook) { $emit('select-hook', selectedModalHook); selectedModalHook = null; } }" 
                     class="w-full py-4 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(207,255,80,0.2)] hover:shadow-[0_0_30px_rgba(207,255,80,0.4)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
  </div>
</template>

<script setup lang="ts">
import type { Hook, ReadyClip, PromptTemplate } from '../../types/clipper'

const props = defineProps<{
  previewVideoUrl: string | null
  readyClips: ReadyClip[]
}>()

const emit = defineEmits<{
  (e: 'select-hook', hook: Hook): void
  (e: 'back-to-library'): void
}>()

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const activeTab = ref<'generated' | 'saved'>('generated')
const hoveredHookIndex = ref<number | null>(null)
const selectedModalHook = ref<Hook | null>(null)
const modalVideoPlayer = ref<HTMLVideoElement | null>(null)
const forceHighRes = ref(state.hdReady.value)
const isTogglingResolution = ref(false)
const savedPlaybackTime = ref<number | null>(null)

const modalVideoUrl = computed(() => {
  if (forceHighRes.value && state.hdReady.value && state.videoUrl.value) {
    return state.videoUrl.value
  }
  return props.previewVideoUrl || state.videoUrl.value
})

const showAdjustDuration = ref(false)
const dragMode = ref<'start' | 'end' | null>(null)
const startInputStr = ref('00:00')
const endInputStr = ref('00:00')
const activeModalTab = ref<'breakdown' | 'transcript'>('breakdown')



function formatHookDuration(start: number, end: number) {
  const diff = Math.abs(end - start)
  if (diff < 60) return `(${Math.floor(diff)}s)`
  const m = Math.floor(diff / 60)
  const s = Math.floor(diff % 60)
  if (s === 0) return `(${m}m)`
  return `(${m}m ${s}s)`
}

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

function isHookSaved(hook: Hook) {
  return state.savedHooks.value.some((h: Hook) => Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1)
}

function findMatchingClip(hook: Hook | null): ReadyClip | undefined {
  if (!props.readyClips?.length || !state.folderName.value || !hook) return undefined
  return props.readyClips.find(c => {
    if (c.folder_name !== state.folderName.value) return false
    const parts = c.clip_id.split('_')
    const part0 = parts[0]
    const part1 = parts[1]
    if (part0 === undefined || part1 === undefined) return false
    const cStart = parseFloat(part0)
    const cEnd = parseFloat(part1)
    if (isNaN(cStart) || isNaN(cEnd)) return false

    const safetyBuffer = state.startSafetyBuffer?.value ?? 2.0
    const expectedStart = Math.max(0, Math.floor(hook.start - safetyBuffer))
    const expectedEnd = Math.ceil(hook.end)
    if (Math.abs(cStart - expectedStart) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }

    const expectedStartDefault = Math.max(0, Math.floor(hook.start - 2.0))
    if (Math.abs(cStart - expectedStartDefault) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }
    const expectedStartNone = Math.max(0, Math.floor(hook.start))
    if (Math.abs(cStart - expectedStartNone) < 1.5 && Math.abs(cEnd - expectedEnd) < 1.5) {
      return true
    }

    const hookDuration = hook.end - hook.start
    if (hookDuration <= 0) return false
    const overlapStart = Math.max(cStart, hook.start)
    const overlapEnd = Math.min(cEnd, hook.end)
    const overlap = overlapEnd - overlapStart
    if (overlap > 0 && (overlap / hookDuration) >= 0.8) {
      return true
    }

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

watch(() => state.jobStatus.value, (newStatus) => {
  if (newStatus === 'queued') {
    activeTab.value = 'generated'
  }
})

watch(modalVideoPlayer, (el) => {
  if (el) {
    restoreModalVolume(el)
  }
})

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
    activeModalTab.value = 'breakdown'
    forceHighRes.value = state.hdReady.value
    isTogglingResolution.value = false
    savedPlaybackTime.value = null
  } else {
    showAdjustDuration.value = false
    activeModalTab.value = 'breakdown'
    forceHighRes.value = state.hdReady.value
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
