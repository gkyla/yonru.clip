<template>
  <div v-if="state" class="flex h-screen w-full bg-[#060608] overflow-hidden">
    <!-- Navigation Sidebar -->
    <HomeSidebar 
      v-model:activeView="sidebarView"
      :cached-videos="state.cachedVideos.value"
      :is-processing="isProcessing"
      :processing-title="state.videoTitle.value"
      :processing-status="loadingLabel"
      :last-video="state.lastAccessedVideo.value"
      :API_BASE="state.API_BASE"
      :default-collapsed="true"
      :is-floating="true"
      @update:activeView="handleSidebarNav"
    />

    <div class="flex-1 flex flex-col overflow-hidden relative">
      <TheTopbar />
      <div class="flex-1 flex overflow-hidden">
         <!-- Settings Sidebar -->
         <SidebarSettings />
       
       <!-- Content / Preview Area -->
    <div class="flex-1 flex flex-col items-center bg-surface-dark relative">
      <!-- Rendering Overlay -->
      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-300 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="state?.renderStatus?.value === 'rendering'" class="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
          <div class="relative mb-8">
            <div class="w-24 h-24 rounded-full border-4 border-accent-500/20 border-t-accent-500 animate-spin shadow-[0_0_30px_rgba(207,255,80,0.2),0_0_15px_rgba(207,255,80,0.1)_inset]"></div>
            <Icon name="ri:movie-2-fill" class="absolute inset-0 m-auto text-3xl text-accent-500 animate-pulse" />
          </div>
          <h2 class="text-2xl font-black italic tracking-tighter uppercase mb-2">Baking Your Clip</h2>
          <p class="text-slate-400 text-sm font-medium tracking-wide mb-6">
            {{ state?.renderStage?.value === 'starting' ? 'Preparing Remotion engine...' : state?.renderStage?.value === 'bundling' ? 'Bundling React components...' : state?.renderStage?.value === 'encoding' ? 'Encoding & muxing final video...' : 'Rendering frames via Remotion...' }}
          </p>
          
          <!-- Progress Bar -->
          <div class="w-80 max-w-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold uppercase tracking-widest text-accent-500">{{ state?.renderProgress?.value || 0 }}%</span>
              <span v-if="state?.renderEta?.value > 0" class="text-xs mono text-slate-500">
                ~{{ state?.renderEta?.value >= 60 ? Math.floor(state?.renderEta?.value / 60) + 'm ' + (state?.renderEta?.value % 60) + 's' : state?.renderEta?.value + 's' }} remaining
              </span>
              <span v-else-if="state?.renderStage?.value === 'starting'" class="text-xs mono text-slate-500">estimating...</span>
            </div>
            <div class="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-accent-500 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(207,255,80,0.4)]"
                :style="{ width: (state?.renderProgress?.value || 0) + '%' }"
              ></div>
            </div>
            <p class="text-[10px] text-slate-600 mt-2 text-center uppercase tracking-widest font-bold">
              {{ state?.renderStage?.value || 'initializing' }}
            </p>
          </div>
        </div>
      </Transition>

      <div id="previewArea" class="flex-1 flex overflow-hidden min-h-0 relative p-8 flex-row">
           <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
          
           <!-- Pipeline Loading Overlay -->
           <Transition
             enter-active-class="transition duration-400 ease-out"
             enter-from-class="opacity-0"
             enter-to-class="opacity-100"
             leave-active-class="transition duration-300 ease-in"
             leave-from-class="opacity-100"
             leave-to-class="opacity-0"
           >
             <div v-if="isPipelineActive" class="absolute inset-0 z-50 bg-[#060608]/95 backdrop-blur-xl flex flex-col items-center justify-center text-center">
               <!-- Ambient glow -->
               <div class="absolute w-[50vw] h-[50vw] rounded-full blur-[160px] -top-1/3 -right-1/3 mix-blend-screen transition-colors duration-1000"
                 :class="state.isMediaLoading.value ? 'bg-accent-500/8' : pipelineStep === 'cutting' ? 'bg-sky-500/8' : pipelineStep === 'transcribing' ? 'bg-violet-500/8' : 'bg-accent-500/10'"
               ></div>
               <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

               <!-- Main spinner -->
               <div class="relative mb-10 z-10 flex items-center justify-center">
                  <div class="absolute w-40 h-40 bg-accent-500/10 rounded-full blur-[60px] animate-pulse"></div>
                  <div class="w-28 h-28 rounded-full border-[3px] border-surface-border/30 shadow-[0_0_20px_rgba(207,255,80,0.3)] relative">
                   <div class="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
                     :class="state.isMediaLoading.value ? 'border-t-accent-500 border-r-accent-500/30' : pipelineStep === 'cutting' ? 'border-t-sky-500 border-r-sky-500/30' : pipelineStep === 'transcribing' ? 'border-t-violet-400 border-r-violet-400/30' : 'border-t-accent-500 border-r-accent-500/30'"
                   ></div>
                   <div class="absolute inset-0 flex items-center justify-center">
                     <Icon 
                       :name="state.isMediaLoading.value ? 'ri:loader-4-line' : pipelineStep === 'cutting' ? 'ri:scissors-cut-fill' : pipelineStep === 'transcribing' ? 'ri:mic-ai-fill' : 'ri:check-double-fill'" 
                       class="text-4xl"
                       :class="state.isMediaLoading.value ? 'text-accent-500 animate-spin' : (pipelineStep === 'cutting' ? 'text-sky-400 animate-pulse' : pipelineStep === 'transcribing' ? 'text-violet-400 animate-pulse' : 'text-accent-500 animate-pulse')"
                     />
                   </div>
                 </div>
               </div>

               <!-- Title -->
                <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10">
                  {{ pipelineStep === 'cutting' ? 'Cutting Segment' : pipelineStep === 'transcribing' ? `Transcribing (${state.whisperModel.value.toUpperCase()})` : state.isMediaLoading.value ? 'Loading Media...' : 'Almost Ready' }}
                </h2>
               <p class="text-slate-500 text-sm max-w-sm mb-10 z-10">
                 {{ state.isMediaLoading.value ? 'Synchronizing assets and buffering video stream...' : pipelineStep === 'cutting' ? 'Extracting clip from cached 1080p video via local FFmpeg...' : pipelineStep === 'transcribing' ? `Running Whisper AI ${state.whisperModel.value.toUpperCase()} for high-precision word-level timestamps...` : 'Finalizing assets and preparing editor...' }}
               </p>

               <!-- Step indicators -->
               <div class="flex items-center gap-3 z-10 mb-6">
                 <!-- Step 1: Cut -->
                 <div class="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500"
                   :class="pipelineStep === 'cutting' 
                     ? 'bg-sky-500/10 border-sky-500/40 text-sky-400' 
                     : pipelineStepIdx > 0 
                       ? 'bg-accent-500/10 border-accent-500/30 text-accent-500' 
                       : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'"
                 >
                   <Icon :name="pipelineStepIdx > 0 ? 'ri:check-line' : 'ri:scissors-cut-line'" class="text-sm" />
                   <span>Cut</span>
                 </div>
                 <div class="w-8 h-px transition-colors duration-500" :class="pipelineStepIdx > 0 ? 'bg-accent-500/50' : 'bg-surface-border/30'"></div>
                 <!-- Step 2: Transcribe -->
                 <div class="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500"
                   :class="pipelineStep === 'transcribing' 
                     ? 'bg-violet-500/10 border-violet-500/40 text-violet-400' 
                     : pipelineStepIdx > 1 
                       ? 'bg-accent-500/10 border-accent-500/30 text-accent-500' 
                       : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'"
                 >
                   <Icon :name="pipelineStepIdx > 1 ? 'ri:check-line' : 'ri:mic-ai-line'" class="text-sm" />
                   <span>Transcribe</span>
                 </div>
                 <div class="w-8 h-px transition-colors duration-500" :class="pipelineStepIdx > 1 ? 'bg-accent-500/50' : 'bg-surface-border/30'"></div>
                 <!-- Step 3: Ready -->
                 <div class="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500"
                   :class="pipelineStepIdx > 1 
                     ? 'bg-accent-500/10 border-accent-500/30 text-accent-500' 
                     : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'"
                 >
                   <Icon name="ri:check-double-line" class="text-sm" />
                   <span>Ready</span>
                 </div>
               </div>

               <!-- Hook info -->
               <div v-if="state?.activeHook?.value" class="bg-surface-dark/60 border border-surface-border/40 rounded-xl px-5 py-3 z-10 max-w-md">
                 <p class="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-1">Processing Hook</p>
                 <p class="text-white font-bold text-sm truncate">{{ state?.activeHook?.value?.theme || 'Untitled Hook' }}</p>
                 <p class="text-slate-500 text-[10px] mt-1 font-mono">
                   {{ state?.formatDuration(state?.activeHook?.value?.start) }} → {{ state?.formatDuration(state?.activeHook?.value?.end) }}
                 </p>
               </div>
             </div>
           </Transition>
           
           <div class="flex gap-12 items-center justify-center z-10 w-full max-w-5xl">
               <!-- The 9:16 Canvas -->             
               <VideoPreview />

                <!-- Subtitle Editor Panel -->
                <div v-if="state?.activeHook?.value" class="w-80 md:w-[450px] bg-surface-panel/50 backdrop-blur-xl border border-surface-border rounded-2xl p-6 flex flex-col h-[540px] shadow-2xl overflow-hidden">
                    
                    <!-- Tabs -->
                    <div class="flex border-b border-surface-border/50 mb-4">
                        <button 
                          @click="editorTab = 'edit'"
                          class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all"
                          :class="editorTab === 'edit' ? 'bg-accent-500 text-black' : 'text-slate-500 hover:bg-surface-card'"
                        >
                          Edit Subtitles
                        </button>
                        <button 
                          @click="editorTab = 'thumbnail'"
                          class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all"
                          :class="editorTab === 'thumbnail' ? 'bg-emerald-500 text-black' : 'text-slate-500 hover:bg-surface-card'"
                        >
                          Thumbnail
                        </button>
                        <button 
                          @click="editorTab = 'quote'"
                          class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all"
                          :class="editorTab === 'quote' ? 'bg-sky-500 text-white' : 'text-slate-500 hover:bg-surface-card'"
                        >
                          Raw Quote
                        </button>
                    </div>

                    <div v-if="editorTab === 'edit'" class="flex flex-col h-full overflow-hidden">
                        <div class="border-b border-surface-border/50 pb-4 mb-4 flex justify-between items-start">
                            <div>
                              <h3 class="text-[10px] uppercase tracking-widest text-accent-500 font-bold mb-1 flex items-center gap-2">
                                 <Icon name="ri:edit-box-line" class="text-sm" /> Subtitle Editor
                              </h3>
                                <div class="flex items-center gap-2 group/title">
                                  <input 
                                    :value="state?.activeHook?.value?.theme"
                                    @input="e => { if (state?.activeHook?.value) { state.activeHook.value.theme = (e.target as HTMLInputElement).value; state.updateHooks() } }"
                                    class="bg-surface-dark/50 border border-surface-border/50 hover:border-accent-500/50 focus:border-accent-500 focus:outline-none text-white font-bold leading-tight truncate w-64 px-2 py-1 rounded transition-all text-sm"
                                    placeholder="Enter clip name..."
                                  />
                                  <Icon name="ri:edit-2-line" class="text-slate-500 group-hover/title:text-accent-500 transition-colors text-xs" />
                                </div>
                            </div>
                            <button 
                              @click="handleSave" 
                              class="bg-accent-500 hover:bg-accent-400 text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95"
                            >
                              Save Edits
                            </button>
                        </div>

                        <!-- Sub-tabs: One Word / All Words -->
                        <div class="flex mb-3 bg-black/20 rounded-lg p-0.5 border border-white/5">
                          <button 
                            @click="subtitleSubTab = 'one'"
                            class="flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                            :class="subtitleSubTab === 'one' ? 'bg-accent-500/20 text-accent-500 shadow-sm' : 'text-slate-500 hover:text-slate-300'"
                          >
                            <Icon name="ri:list-check-2" class="text-xs" /> One Word
                          </button>
                          <button 
                            @click="subtitleSubTab = 'all'; localBulkText = allWordsText"
                            class="flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                            :class="subtitleSubTab === 'all' ? 'bg-sky-500/20 text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'"
                          >
                            <Icon name="ri:file-text-line" class="text-xs" /> All Words
                          </button>
                        </div>

                        <!-- ONE WORD: Per-segment editor -->
                        <div v-if="subtitleSubTab === 'one'" class="flex-1 overflow-hidden">
                          <div 
                              class="h-full overflow-y-auto pr-2 custom-scrollbar space-y-3 scroll-smooth relative" 
                              ref="subtitleContainer"
                              @mouseenter="isHoveringSubtitles = true"
                              @mouseleave="isHoveringSubtitles = false"
                          >
                              <div 
                                v-for="(seg, i) in visibleSegments" :key="i"
                                :id="`seg-${i}`"
                                class="bg-surface-dark/50 border p-3 rounded-xl transition-all flex flex-col gap-2 group relative overflow-hidden"
                                :class="[
                                  activeSegIdx === i 
                                    ? 'border-accent-500 ring-1 ring-accent-500/20 bg-accent-500/5' 
                                    : 'border-surface-border/50 hover:border-accent-500/30'
                                ]"
                              >
                                <div v-if="activeSegIdx === i" class="absolute left-0 top-0 bottom-0 w-1 bg-accent-500 shadow-[0_0_10px_#CFFF50]"></div>
                                <div class="flex items-center justify-between">
                                   <div class="flex items-center gap-2">
                                     <input 
                                       v-model.number="seg.start" 
                                       type="number" step="0.01" 
                                       class="bg-black/40 border border-surface-border text-[10px] text-slate-400 px-2 py-0.5 rounded w-16 focus:outline-none focus:border-accent-500/50"
                                     />
                                     <span class="text-[10px] text-slate-600">to</span>
                                     <input 
                                       v-model.number="seg.duration" 
                                       type="number" step="0.01" 
                                       class="bg-black/40 border border-surface-border text-[10px] text-slate-400 px-2 py-0.5 rounded w-16 focus:outline-none focus:border-accent-500/50"
                                     />
                                     <span class="text-[8px] text-slate-700 uppercase font-bold tracking-tighter">SEC</span>
                                   </div>
                                   <button @click="jumpTo(seg.start)" class="opacity-0 group-hover:opacity-100 text-accent-500 hover:text-white transition-all">
                                     <Icon name="ri:play-mini-fill" />
                                   </button>
                                </div>
                                <textarea 
                                  v-model="seg.text" 
                                  rows="1"
                                  class="w-full bg-transparent border-none text-white text-sm focus:outline-none resize-none font-medium leading-relaxed italic"
                                  @input="autoGrow"
                                ></textarea>
                              </div>
                          </div>
                        </div>

                        <!-- ALL WORDS: Single textarea with all text -->
                        <div v-else class="flex-1 overflow-hidden flex flex-col gap-3">
                          <p class="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Continuous text view. Edits are automatically distributed across segments based on their timing. Ideal for bulk spelling fixes.</p>
                           <div class="flex-1 relative overflow-hidden group/bulk">
                             <!-- Mirror Backdrop for Highlighting -->
                              <div 
                               ref="bulkBackdrop"
                               class="absolute inset-0 p-4 text-sm font-medium leading-[2] italic whitespace-pre-wrap break-words pointer-events-none text-transparent border border-transparent select-none"
                               aria-hidden="true"
                               v-html="bulkHighlightHTML"
                             ></div>

                             <textarea 
                               v-model="localBulkText"
                               ref="bulkTextarea"
                               @input="onAllWordsInput"
                               @scroll="syncBulkScroll"
                               class="absolute inset-0 w-full h-full bg-black/30 border border-surface-border/50 rounded-xl p-4 text-white text-sm focus:outline-none focus:border-sky-500/50 resize-none font-medium leading-[2] italic custom-scrollbar transition-all"
                               spellcheck="false"
                             ></textarea>
                           </div>
                          <div class="flex items-center justify-between">
                            <span class="text-[9px] text-accent-500 uppercase tracking-widest font-bold">
                              ✓ Live Syncing to Segments
                            </span>
                          </div>
                        </div>
                    </div>

                    <!-- Raw Quote Tab -->
                    <div v-else-if="editorTab === 'quote'" class="flex flex-col h-full overflow-hidden">
                        <div class="border-b border-surface-border/50 pb-4 mb-4">
                            <h3 class="text-[10px] uppercase tracking-widest text-sky-400 font-bold mb-2 flex items-center gap-2">
                               <Icon name="ri:quote-text" class="text-sm" /> Transcript Quote
                            </h3>
                            <h4 class="text-white font-bold leading-tight">{{ state?.activeHook?.value?.theme || 'Untitled Hook' }}</h4>
                        </div>
                        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <p class="text-slate-300 text-sm md:text-base leading-relaxed italic font-serif">
                                "{{ state?.activeHook?.value?.transcript_quote || '' }}"
                            </p>
                        </div>
                    </div>

                    <!-- Thumbnail Tab -->
                    <div v-else-if="editorTab === 'thumbnail'" class="flex flex-col h-full overflow-hidden">
                        <ThumbnailEditor />
                    </div>

            </div>
        </div>
    </div>
</div>

    <!-- Hooks Panel -->
       <div class="w-80 border-l border-surface-border bg-surface-panel flex flex-col overflow-hidden text-white">
          <div class="border-b border-surface-border flex flex-col shrink-0">
            <div class="flex items-center justify-between px-4 h-10">
               <span class="text-[10px] uppercase text-slate-400 font-bold tracking-widest flex items-center gap-2">
                 <Icon name="ri:list-settings-line" class="text-sky-500" /> Hooks Panel
               </span>
               <button 
                 v-if="state?.activeHook?.value && !isCurrentHookSaved"
                 @click="state.saveHook(state.activeHook.value)"
                 class="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all"
               >
                 <Icon name="ri:bookmark-line" />
                 Save Current
               </button>
            </div>
            <div class="flex border-t border-surface-border">
               <button 
                 @click="panelTab = 'generated'"
                 class="flex-1 py-2 text-[10px] font-black tracking-widest uppercase transition-all"
                 :class="panelTab === 'generated' ? 'bg-amber-500 text-black' : 'text-slate-500 hover:bg-surface-card'"
               >
                  Generated ({{ state.hooks.value.length }})
               </button>
               <button 
                 @click="panelTab = 'saved'"
                 class="flex-1 py-2 text-[10px] font-black tracking-widest uppercase transition-all"
                 :class="panelTab === 'saved' ? 'bg-amber-500 text-black' : 'text-slate-500 hover:bg-surface-card'"
               >
                  Saved ({{ state.savedHooks.value.length }})
               </button>
            </div>
          </div>

          <div v-if="panelTab === 'generated'" ref="hooksContainer" class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div v-if="!state.hooks.value.length" class="text-center text-slate-600 text-xs p-6">
              No hooks generated yet.
            </div>
            <button
              v-for="(hook, idx) in state.hooks.value"
              :key="idx"
              @click="selectSidebarHook(hook)"
              :disabled="isPipelineActive"
              class="w-full text-left p-3 rounded-lg border transition-all text-xs group relative overflow-hidden"
              :class="[
                isActiveHook(hook)
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-[inset_0_0_10px_rgba(245,158,11,0.05)] hook-item-active' 
                  : 'bg-surface-dark/50 border-surface-border hover:border-amber-500/30 hover:bg-surface-card text-slate-400',
                isPipelineActive ? 'opacity-50 cursor-not-allowed' : ''
              ]"
            >
              <div v-if="isActiveHook(hook)" class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div>
              <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-[10px] uppercase tracking-wider" :class="isActiveHook(hook) ? 'text-amber-400' : 'text-slate-500'">
                  HOOK {{ String(idx + 1).padStart(2, '0') }}
                </span>
                <span class="mono text-[10px]" :class="isActiveHook(hook) ? 'text-sky-400 font-bold' : 'text-slate-300'">
                  {{ state.formatDuration(hook.start) }} – {{ state.formatDuration(hook.end) }}
                  <span class="ml-1 text-accent-500 font-bold">({{ Math.floor(hook.end - hook.start) >= 60 ? Math.floor((hook.end - hook.start) / 60) + 'm ' + Math.floor((hook.end - hook.start) % 60) + 's' : Math.floor(hook.end - hook.start) + 's' }})</span>
                </span>
              </div>
              <p class="font-medium truncate" :class="isActiveHook(hook) ? 'text-white' : 'text-slate-300'">{{ hook.theme || 'Untitled' }}</p>
              <p class="text-[10px] mt-1 line-clamp-2 italic opacity-70">"{{ (hook.transcript_quote || '').length > 80 ? (hook.transcript_quote || '').substring(0, 77) + '...' : (hook.transcript_quote || '') }}"</p>
            </button>
          </div>

          <div v-else class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <div v-if="!state.savedHooks.value.length" class="text-center text-slate-600 text-xs p-6">
              No saved hooks for this video yet.
            </div>
            <button
              v-for="(hook, idx) in state.savedHooks.value"
              :key="hook._id || idx"
              @click="selectSidebarHook(hook)"
              :disabled="isPipelineActive"
              class="w-full text-left p-3 rounded-lg border transition-all text-xs group relative overflow-hidden"
              :class="[
                isActiveHook(hook)
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-[inset_0_0_10px_rgba(245,158,11,0.05)]' 
                  : 'bg-surface-dark/50 border-surface-border hover:border-amber-500/30 hover:bg-surface-card text-slate-400',
                isPipelineActive ? 'opacity-50 cursor-not-allowed' : ''
              ]"
            >
              <div v-if="isActiveHook(hook)" class="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_10px_#f59e0b]"></div>
              <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-[10px] uppercase tracking-wider" :class="isActiveHook(hook) ? 'text-amber-400' : 'text-slate-500'">
                  SAVED {{ String(idx + 1).padStart(2, '0') }}
                </span>
                <span class="mono text-[10px]" :class="isActiveHook(hook) ? 'text-sky-400 font-bold' : 'text-slate-300'">
                  {{ state.formatDuration(hook.start) }} – {{ state.formatDuration(hook.end) }}
                  <span class="ml-1 text-accent-500 font-bold">({{ Math.floor(hook.end - hook.start) >= 60 ? Math.floor((hook.end - hook.start) / 60) + 'm ' + Math.floor((hook.end - hook.start) % 60) + 's' : Math.floor(hook.end - hook.start) + 's' }})</span>
                 </span>
              </div>
              <p class="font-medium truncate" :class="isActiveHook(hook) ? 'text-white' : 'text-slate-300'">{{ hook.theme || 'Untitled' }}</p>
              <p class="text-[10px] mt-1 line-clamp-2 italic opacity-70">"{{ (hook.transcript_quote || '').length > 80 ? (hook.transcript_quote || '').substring(0, 77) + '...' : (hook.transcript_quote || '') }}"</p>
            </button>
          </div>
       </div>
    </div>
    
    <!-- Timeline -->
    <div class="h-64 border-t border-surface-border flex flex-col bg-[#060608] z-40 relative">
       <TimelineEditor />
    </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
const state = useClipperState()
const route = useRoute()

// Sidebar View for Editor page
const sidebarView = ref('editor')

function handleSidebarNav(view: string) {
  if (view !== 'editor') {
    navigateTo('/')
    // We could pass a state here to tell index.vue which view to show
  }
}

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

onMounted(async () => {
  // Ensure library data is loaded for the sidebar dashboard
  state.fetchCached()
  state.fetchSavedHooks()
  
  if (process.client) {
    const saved = localStorage.getItem('yonru_last_video')
    if (saved) state.lastAccessedVideoId.value = saved
  }

  // Restore state from URL if refreshing
  const jobId = route.query.job_id as string
  const folder = route.query.folder as string
  const hookIndex = parseInt(route.query.hook_index as string)
  const tab = (route.query.tab as string) || 'generated'
  
  if (jobId) {
    state.jobId.value = jobId
    state.folderName.value = folder
    
    // We need to wait for hooks to load before we can select the active one
    let stopWatcher: any = null
    stopWatcher = watch([() => state?.jobStatus?.value, () => state?.hooks?.value, () => state?.savedHooks?.value], () => {
      const status = state?.jobStatus?.value || 'idle'
      const hooksAvailable = (state?.hooks?.value?.length || 0) > 0 || (state?.savedHooks?.value?.length || 0) > 0
      
      if (status === 'ready' || (status === 'hooks_ready' && hooksAvailable)) {
        const hooksList = tab === 'saved' ? state?.savedHooks?.value : state?.hooks?.value
        if (hooksList && hooksList[hookIndex]) {
          console.log('[editor] Restoring hook from index:', hookIndex)
          if (state?.activeHook) state.activeHook.value = hooksList[hookIndex]
          // Only trigger extraction if we don't already have a ready clip
          if (status !== 'ready') {
            state?.extractClip?.(hooksList[hookIndex])
          }
        }
        if (stopWatcher) stopWatcher()
      }
    }, { immediate: true })

    state?.startPolling?.()
  }
  state.initPersistence()
})

const panelTab = ref<'generated' | 'saved'>((route.query.tab as any) || 'generated')

function selectSidebarHook(hook: any) {
  if (state.jobStatus.value === 'cutting') return
  
  // Find hook index
  const hooksList = panelTab.value === 'saved' ? state.savedHooks.value : state.hooks.value
  const hookIndex = hooksList.indexOf(hook)
  
  // Update route query silently so refresh works
  const router = useRouter()
  router.replace({
    query: {
      ...route.query,
      hook_index: hookIndex >= 0 ? hookIndex : 0,
      tab: panelTab.value
    }
  })
  
  // Start extraction
  state.extractClip(hook)
}


const editorTab = ref<'edit' | 'quote' | 'thumbnail'>('edit')
const subtitleSubTab = ref<'one' | 'all'>('one')
const subtitleContainer = ref<HTMLElement | null>(null)
const bulkTextarea = ref<HTMLTextAreaElement | null>(null)
const bulkBackdrop = ref<HTMLElement | null>(null)
const isHoveringSubtitles = ref(false)

const absoluteTime = computed(() => state?.currentTime?.value || 0)
const visibleSegments = computed(() => state?.fullTranscript?.value || [])

const activeSegIdx = computed(() => {
  const offset = (state?.subtitleSyncOffset?.value || 0) / 1000
  return visibleSegments.value.findIndex((s: any) => 
    absoluteTime.value >= (s.start + offset) && 
    absoluteTime.value < (s.start + s.duration + offset)
  )
})

function syncBulkScroll() {
  if (bulkTextarea.value && bulkBackdrop.value) {
    bulkBackdrop.value.scrollTop = bulkTextarea.value.scrollTop
  }
}

watch(activeSegIdx, (idx) => {
  // Auto-scroll the 'One Word' view
  if (subtitleSubTab.value === 'one' && idx !== -1 && subtitleContainer.value && !isHoveringSubtitles.value) {
    const el = document.getElementById(`seg-${idx}`)
    if (el) {
      subtitleContainer.value.scrollTo({
        top: el.offsetTop - 80,
        behavior: 'smooth'
      })
    }
  }
  
  // Sync backdrop scroll
  if (subtitleSubTab.value === 'all') {
    syncBulkScroll()
  }
})

// Moved up

// Pipeline loading overlay
const pipelineStep = computed(() => state?.jobStatus?.value || 'idle')

const pipelineStepIdx = computed(() => {
  const map: Record<string, number> = { cutting: 0, transcribing: 1, ready: 2 }
  return map[pipelineStep.value] ?? 2
})

const isPipelineActive = computed(() => ['cutting', 'transcribing'].includes(state?.jobStatus?.value || '') || state?.isMediaLoading?.value)

// Moved up

// All Words computed: join all segment texts into a single paragraph
const allWordsText = computed(() => {
  return visibleSegments.value.map((s: any) => s.text).join(' ')
})

const localBulkText = ref('')

function onAllWordsInput() {
  const words = localBulkText.value.split(/\s+/).filter(w => w.length > 0)
  if (!words.length || !visibleSegments.value.length) return

  // Proportional redistribution
  const totalDuration = visibleSegments.value.reduce((acc, s) => acc + s.duration, 0)
  if (totalDuration <= 0) return
  
  let wordIdx = 0
  visibleSegments.value.forEach((seg, i) => {
    if (i === visibleSegments.value.length - 1) {
      seg.text = words.slice(wordIdx).join(' ')
      return
    }

    const quota = Math.max(1, Math.round((seg.duration / totalDuration) * words.length))
    seg.text = words.slice(wordIdx, wordIdx + quota).join(' ')
    wordIdx += quota
  })
}

// All Words highlighting logic
const bulkHighlightHTML = computed(() => {
  if (!localBulkText.value) return ''
  
  // Tokenize preserving spaces/newlines
  const tokens = localBulkText.value.split(/(\s+)/)
  const wordsOnly = tokens.filter(t => /\S/.test(t))
  
  if (!wordsOnly.length || !visibleSegments.value.length) {
    return localBulkText.value.replace(/\n/g, '<br/>')
  }

  const totalDuration = visibleSegments.value.reduce((acc, s) => acc + s.duration, 0)
  if (totalDuration <= 0) return localBulkText.value.replace(/\n/g, '<br/>')

  // Calculate quota for active segment
  let currentWordIdx = 0
  let activeWordStart = -1
  let activeWordEnd = -1

  visibleSegments.value.forEach((seg, i) => {
    let quota = 0
    if (i === visibleSegments.value.length - 1) {
      quota = wordsOnly.length - currentWordIdx
    } else {
      quota = Math.max(1, Math.round((seg.duration / totalDuration) * wordsOnly.length))
    }
    
    if (i === activeSegIdx.value) {
      activeWordStart = currentWordIdx
      activeWordEnd = currentWordIdx + quota
    }
    currentWordIdx += quota
  })

  // Reconstruct HTML
  let wordCounter = 0
  return tokens.map(token => {
    if (/\S/.test(token)) {
      const isHighlighted = wordCounter >= activeWordStart && wordCounter < activeWordEnd
      wordCounter++
      if (isHighlighted) {
        return `<span class="bg-sky-500/40 rounded-sm shadow-[0_0_8px_rgba(56,189,248,0.3)] ring-1 ring-sky-400/50">${token}</span>`
      }
      return token
    }
    return token.replace(/\n/g, '<br/>')
  }).join('')
})

// Watchers

// Moved up to fix initialization order

function isActiveHook(hook: any) {
  if (!state?.activeHook?.value) return false
  const active = state.activeHook.value
  const hStart = typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start
  const hEnd = typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end
  
  return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
}

const hooksContainer = ref<HTMLElement | null>(null)

watch([() => state.activeHook.value, () => state.hooks.value], async ([active, hooks]) => {
  if (!active || !hooks?.length) return
  
  await nextTick()
  setTimeout(() => {
    const activeEl = document.querySelector('.hook-item-active')
    if (activeEl && hooksContainer.value) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, 100)
}, { immediate: true })

function jumpTo(time: number) {
  const video = document.querySelector('video')
  if (video) {
    video.currentTime = time
  }
}

function autoGrow(e: any) {
  e.target.style.height = 'auto'
  e.target.style.height = e.target.scrollHeight + 'px'
}
async function handleSave() {
  await Promise.all([
    state.saveTranscript(),
    state.saveStyleSettings(),
    state.saveTimelineTracks(),
    state.saveThumbnailConfig()
  ])
}
</script>
