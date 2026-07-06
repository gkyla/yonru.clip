<template>
  <div class="h-screen w-full overflow-hidden bg-[#060608] relative">
    <div v-if="state" class="flex h-screen w-full bg-[#060608] overflow-hidden">
    <!-- Navigation Sidebar -->
    <!-- Blacklist Settings Modal -->
    <div v-if="showBlacklistSettings" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-black/80 backdrop-blur-xl" @click="showBlacklistSettings = false"></div>
       <div class="w-full max-w-md bg-surface-panel border border-surface-border rounded-3xl shadow-2xl relative overflow-hidden">
          <BlacklistSettings @close="showBlacklistSettings = false" />
       </div>
    </div>

    <HomeSidebar 
      v-model:activeView="sidebarView"
      :cached-videos="state.cachedVideos.value"
      :is-processing="isProcessing"
      :processing-title="state.videoTitle.value"
      :processing-status="loadingLabel"
      :last-video="state.lastAccessedVideo.value"
      :last-clip="state.lastAccessedClip.value"
      :API_BASE="API_BASE"
      :default-collapsed="true"
      :is-floating="true"
      @update:activeView="handleSidebarNav"
    />

    <div class="flex-1 flex flex-col overflow-hidden relative">
      <div class="flex-1 flex overflow-hidden">
         <!-- Settings Sidebar -->
         <SidebarSettings />
       
       <!-- Content / Preview Area -->
    <div class="flex-1 flex flex-col items-stretch bg-surface-dark relative">
      <!-- Rendering Overlay -->
      <Transition
        enter-active-class="transition duration-500 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-300 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-show="state?.renderStatus?.value === 'rendering'" class="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
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

      <div id="previewArea" class="flex-1 flex overflow-hidden min-h-0 relative flex-row w-full">
           <div class="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none mix-blend-overlay"></div>
          
           <!-- Pipeline Loading Overlay -->
           <Transition
             enter-active-class="transition duration-400 ease-out"
             enter-from-class="opacity-0"
             enter-to-class="opacity-100"
             leave-active-class="transition duration-300 ease-in"
             leave-from-class="opacity-100"
             leave-to-class="opacity-0"
           >
             <div v-show="isOverlayVisible" class="absolute inset-0 z-50 bg-[#060608]/95 backdrop-blur-xl flex flex-col items-center justify-center text-center">
               <template v-if="state.jobStatus.value === 'error'">
                 <div class="absolute w-[50vw] h-[50vw] rounded-full blur-[160px] -top-1/3 -right-1/3 mix-blend-screen bg-rose-500/10 pointer-events-none"></div>
                 <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
                 
                 <div class="relative mb-8 z-10 flex items-center justify-center">
                   <div class="absolute w-40 h-40 bg-rose-500/10 rounded-full blur-[60px]"></div>
                   <div class="w-24 h-24 rounded-full border-[4px] border-rose-500/20 relative z-10 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)_inset,0_0_40px_rgba(239,68,68,0.3)]">
                     <Icon name="ri:error-warning-fill" class="text-4xl text-rose-500" />
                   </div>
                 </div>

                 <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10 uppercase italic">Extraction Failed</h2>
                 <p class="text-slate-400 text-sm max-w-md mb-8 px-4 z-10 leading-relaxed font-medium">
                   {{ state.jobError.value || 'An unexpected error occurred during clip ingestion.' }}
                 </p>

                 <div class="flex items-center gap-4 z-10">
                   <button 
                     @click="handleErrorBack"
                     class="px-6 py-2.5 rounded-full border border-surface-border text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                   >
                     Go Back
                   </button>
                   <button 
                     v-if="state.activeHook.value"
                     @click="handleErrorRetry"
                     class="px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                   >
                     Retry Cut
                   </button>
                 </div>
               </template>
               <template v-else>
                 <!-- Ambient glow -->
                 <div class="absolute w-[50vw] h-[50vw] rounded-full blur-[160px] -top-1/3 -right-1/3 mix-blend-screen transition-colors duration-1000"
                   :class="pipelineStep === 'cutting' ? 'bg-sky-500/8' : pipelineStep === 'transcribing' ? 'bg-violet-500/8' : state.isMediaLoading?.value ? 'bg-accent-500/8' : ''"
                 ></div>
                 <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

                 <!-- Main spinner -->
                 <div class="relative mb-10 z-10 flex items-center justify-center">
                    <div class="absolute w-40 h-40 bg-accent-500/10 rounded-full blur-[60px] animate-pulse"></div>
                    <div class="w-28 h-28 rounded-full border-[4px] border-surface-border relative transition-all duration-700 z-10 flex items-center justify-center"
                      :class="pipelineStep === 'cutting' 
                        ? 'shadow-[0_0_30px_#38bdf8_inset,0_0_50px_rgba(56,189,248,0.4)]' 
                        : pipelineStep === 'transcribing' 
                          ? 'shadow-[0_0_30px_#a78bfa_inset,0_0_50px_rgba(167,139,250,0.4)]' 
                          : 'shadow-[0_0_30px_#CFFF50_inset,0_0_50px_rgba(207,255,80,0.4)]'"
                    >
                     <div class="absolute inset-[-4px] rounded-full border-[4px] border-transparent animate-spin transition-colors duration-700"
                       :class="pipelineStep === 'cutting' 
                         ? 'border-t-sky-500' 
                         : pipelineStep === 'transcribing' 
                           ? 'border-t-violet-400' 
                           : 'border-t-accent-500'"
                     ></div>
                     <div class="absolute inset-0 flex items-center justify-center">
                        <!-- Scissors (Cutting) -->
                        <Icon 
                          name="ri:scissors-cut-fill" 
                          class="absolute text-4xl text-sky-400 transition-all duration-300 ease-out transform"
                          :class="pipelineStep === 'cutting' && state.jobStatus.value !== 'ready' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-75 pointer-events-none'"
                        />

                        <!-- Microphone (Transcribing) -->
                        <Icon 
                          name="ri:mic-ai-fill" 
                          class="absolute text-4xl text-violet-400 transition-all duration-300 ease-out transform"
                          :class="pipelineStep === 'transcribing' && state.jobStatus.value !== 'ready' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-75 pointer-events-none'"
                        />

                        <!-- Double Check (Ready) -->
                        <Icon 
                          name="ri:check-double-fill" 
                          class="absolute text-4xl text-accent-500 transition-all duration-300 ease-out transform"
                          :class="state.jobStatus.value === 'ready' ? 'opacity-100 scale-100 animate-pulse' : 'opacity-0 scale-75 pointer-events-none'"
                        />
                      </div></div>
                 </div>

                 <!-- Title -->
                  <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10">
                    {{ pipelineStep === 'cutting' ? 'Cutting Segment' : pipelineStep === 'transcribing' ? `Transcribing (${(state.whisperModel?.value || '').toUpperCase()})` : state.isMediaLoading?.value ? 'Loading Media...' : 'Ready!' }}
                  </h2>
                 <p class="text-slate-500 text-sm max-w-sm mb-10 z-10">
                   {{ state.isMediaLoading?.value ? 'Synchronizing assets and buffering video stream...' : pipelineStep === 'cutting' ? 'Extracting clip from cached 1080p video via local FFmpeg...' : pipelineStep === 'transcribing' ? `Running Whisper AI ${(state.whisperModel?.value || '').toUpperCase()} for high-precision word-level timestamps...` : 'Finalizing assets and preparing editor...' }}
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
               </template>
             </div>
           </Transition>
           
           <div :class="{ 'select-none': isDragging }" class="flex items-stretch z-10 w-full max-w-full h-full p-0 overflow-hidden">
                <!-- Video Workspace Pane -->
                <div class="flex-1 flex items-center justify-center p-6 relative">
                  <VideoPreview />
                </div>

                 <!-- Subtitle Editor Panel -->
                 <div 
                    v-if="state?.activeHook?.value" 
                    :style="{ width: panelWidth + 'px', flex: 'none' }"
                    class="relative self-stretch bg-[#0e0e12]/90 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col shadow-2xl overflow-hidden"
                  >
                     <!-- Resize Drag Handle Overlay -->
                     <div 
                       @pointerdown="initResize"
                       class="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-sky-500/30 active:bg-sky-500 transition-colors z-50"
                       :class="isDragging ? 'bg-sky-500/50' : ''"
                     ></div>
                    
                    <!-- Tabs -->
                     <div class="flex bg-black/40 border border-white/5 rounded-xl p-1 gap-1 mb-6">
                         <button 
                           @click="editorTab = 'edit'"
                           class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
                           :class="editorTab === 'edit' ? 'bg-white/10 text-accent-500 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]' : 'text-slate-400 border border-transparent hover:text-white'"
                         >
                           <Icon name="ri:edit-box-line" class="text-xs" /> Edit Subtitles
                         </button>
                         <button 
                           @click="editorTab = 'thumbnail'"
                           class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
                           :class="editorTab === 'thumbnail' ? 'bg-white/10 text-emerald-400 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]' : 'text-slate-400 border border-transparent hover:text-white'"
                         >
                           <Icon name="ri:image-line" class="text-xs" /> Thumbnail
                         </button>
                         <button 
                           @click="editorTab = 'quote'"
                           class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
                           :class="editorTab === 'quote' ? 'bg-white/10 text-sky-400 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]' : 'text-slate-400 border border-transparent hover:text-white'"
                         >
                           <Icon name="ri:double-quotes-l" class="text-xs" /> Raw Quote
                         </button>
                     </div>

                     <div v-if="editorTab === 'edit'" class="flex flex-col h-full overflow-hidden">
                         <div class="border-b border-surface-border/50 pb-4 mb-4 flex justify-between items-center gap-4">
                             <div class="flex-1 flex items-center gap-2 group/title">
                               <input 
                                 :value="state?.activeHook?.value?.theme"
                                 @input="e => { if (state?.activeHook?.value) { state.activeHook.value.theme = (e.target as HTMLInputElement).value; state.updateHooks() } }"
                                 class="bg-black/35 border border-white/5 hover:border-accent-500/50 focus:border-accent-500 focus:outline-none text-white font-bold leading-tight truncate w-full max-w-[240px] px-3 py-1.5 rounded-xl transition-all text-xs"
                                 placeholder="Enter clip name..."
                               />
                             </div>
                             <button 
                               @click="handleSave()" 
                               class="bg-accent-500 hover:bg-accent-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 shrink-0"
                             >
                               Save Edits
                             </button>
                         </div>

                        <!-- Sub-tabs: One Word / All Words -->
                        <div class="flex mb-3 bg-black/20 rounded-lg p-0.5 border border-white/5">
                          <button 
                            @click="subtitleSubTab = 'one'"
                            class="flex-1 py-2.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                            :class="subtitleSubTab === 'one' ? 'bg-accent-500/20 text-accent-500 shadow-sm' : 'text-slate-500 hover:text-slate-300'"
                          >
                            <Icon name="ri:list-check-2" class="text-xs" /> {{ state.subtitleMode.value === 'word' ? '1 Word' : state.subtitleMode.value === '3_words' ? '3 Words' : '4 Words' }}
                          </button>
                          <button 
                            @click="subtitleSubTab = 'all'"
                            class="flex-1 py-2.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                            :class="subtitleSubTab === 'all' ? 'bg-sky-500/20 text-sky-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'"
                          >
                            <Icon name="ri:file-text-line" class="text-xs" /> All Words
                          </button>
                        </div>

                        <!-- ONE WORD: Per-segment editor -->
                         <div v-if="subtitleSubTab === 'one'" class="flex-1 overflow-hidden pl-0 relative">
                           <div 
                               class="h-full overflow-y-auto pr-3 custom-scrollbar scroll-smooth relative pl-[35px] ml-0" 
                               ref="subtitleContainer"
                               @mouseenter="isHoveringSubtitles = true"
                               @mouseleave="isHoveringSubtitles = false"
                           >

                               <div class="space-y-4 relative z-10">
                                  <!-- Vertical Timeline Line -->
                                  <div class="absolute -left-[20px] top-5 bottom-5 w-0.5 bg-surface-border/20 z-0"></div>
                                 <div 
                                   v-for="(seg, i) in visibleSegments" :key="i"
                                   :id="`seg-${i}`"
                                   class="bg-[#16161c]/60 border p-4 rounded-2xl transition-all flex flex-col gap-3 group relative"
                                   :class="[
                                     activeSegIdx === i 
                                       ? 'border-accent-500/60 bg-accent-500/[0.08] shadow-[0_4px_20px_rgba(207,255,80,0.08)]' 
                                       : 'border-white/10 hover:border-white/20 hover:bg-[#1f1f28]/70'
                                   ]"
                                 >
                                   <!-- Timeline connector dots -->
                                   <div 
                                     class="absolute rounded-full border-2 border-surface-dark transition-colors duration-300 z-20"
                                     :class="[
                                       activeSegIdx === i
                                         ? '-left-[28px] top-5 w-4 h-4 bg-accent-500 shadow-[0_0_10px_#CFFF50]'
                                         : '-left-[26px] top-[22px] w-3 h-3 bg-surface-border group-hover:bg-accent-500/50'
                                     ]"
                                   ></div>

                                   <div class="flex items-center justify-between">
                                      <div class="flex items-center gap-1.5">
                                        <input 
                                          :value="seg.start" 
                                          @input="e => { updateSegmentStart(seg, parseFloat((e.target as HTMLInputElement).value)); }"
                                          type="number" step="0.01" 
                                          class="bg-black/30 border border-white/5 text-[10px] text-slate-300 font-mono px-2 py-1 rounded-lg w-16 focus:outline-none focus:border-accent-500/50 transition-all"
                                        />
                                        <span class="text-[10px] text-slate-600 font-mono">to</span>
                                        <input 
                                          :value="seg.duration" 
                                          @input="e => { updateSegmentDuration(seg, parseFloat((e.target as HTMLInputElement).value)); }"
                                          type="number" step="0.01" 
                                          class="bg-black/30 border border-white/5 text-[10px] text-slate-300 font-mono px-2 py-1 rounded-lg w-16 focus:outline-none focus:border-accent-500/50 transition-all"
                                        />
                                        <span class="text-[8px] text-slate-500 font-black tracking-widest ml-1">SEC</span>
                                      </div>
                                      <button @click="jumpTo(seg.start)" class="opacity-0 group-hover:opacity-100 text-accent-500 hover:text-white transition-all p-1 hover:bg-white/5 rounded-lg">
                                        <Icon name="ri:play-mini-fill" class="text-lg" />
                                      </button>
                                   </div>
                                   <textarea 
                                     :value="seg.text" 
                                     @input="e => { updateSegmentText(seg, (e.target as HTMLTextAreaElement).value); autoGrow(e); }"
                                     rows="1"
                                     class="w-full bg-transparent border-none text-white text-sm focus:outline-none resize-none font-semibold leading-relaxed italic"
                                   ></textarea>
                                 </div>
                               </div>
                           </div>
                         </div>

                        <!-- ALL WORDS: Flowing Document View -->
                        <div v-else class="flex-1 overflow-hidden flex flex-col gap-3">
                          <p class="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Flowing document view. Active word glows dynamically. Click any sentence/block to edit inline seamlessly.</p>
                          
                          <!-- Scroll Container -->
                          <div 
                            ref="bulkContainer"
                            @mouseenter="handleBulkMouseEnter"
                            @mouseleave="handleBulkMouseLeave"
                            class="flex-1 overflow-y-auto bg-black/30 border border-surface-border/50 rounded-xl p-6 custom-scrollbar leading-[2.2]"
                          >
                            <div 
                              v-for="(seg, idx) in visibleSegments" 
                              :key="idx"
                              :id="'bulk-seg-' + idx"
                              :class="[
                                'inline-block transition-all duration-300 rounded select-none cursor-pointer',
                                idx === activeSegIdx 
                                  ? 'bg-sky-500/10 ring-1 ring-sky-500/20 shadow-[0_0_6px_rgba(56,189,248,0.1)] px-1 py-0.5 mx-0.5' 
                                  : 'hover:bg-white/5 px-0.5 mx-0'
                              ]"
                            >
                              <!-- Editing Mode -->
                              <div v-if="editingSegIdx === idx" class="inline-block">
                                <input
                                  v-model="editSegText"
                                  @blur="commitEdit(seg, idx)"
                                  @keydown.enter.prevent="commitEdit(seg, idx)"
                                  @keydown.esc.prevent="cancelEdit"
                                  autofocus
                                  class="bg-black/60 border border-sky-500/50 rounded px-1.5 py-0.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50 min-w-[80px] font-medium leading-relaxed italic"
                                />
                              </div>

                              <!-- Viewing Mode with Karaoke-Style Highlighting -->
                              <p 
                                v-else
                                @click="startEdit(seg, idx)" 
                                class="inline text-sm font-medium italic transition-colors"
                                :class="idx === activeSegIdx ? 'text-white' : 'text-slate-300 hover:text-white'"
                              >
                                <span 
                                  v-for="(word, wIdx) in (seg.text || '').trim().split(/\s+/)" 
                                  :key="wIdx"
                                  class="inline-block mr-1 transition-all duration-200"
                                  :class="[
                                    idx === activeSegIdx && wIdx === activeWordIdxInSeg
                                      ? 'bg-sky-500/40 text-white rounded-sm px-1 shadow-[0_0_8px_rgba(56,189,248,0.4)] ring-1 ring-sky-400/60 scale-105'
                                      : ''
                                  ]"
                                >
                                  {{ word }}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div class="flex items-center justify-between">
                            <span class="text-[9px] text-accent-500 uppercase tracking-widest font-bold flex items-center gap-1.5">
                              <span class="w-1.5 h-1.5 bg-accent-500 rounded-full animate-ping"></span>
                              Flowing Document Active
                            </span>
                          </div>
                        </div>
                    </div>

                    <!-- Raw Quote Tab -->
                    <div v-else-if="editorTab === 'quote'" class="flex flex-col h-full overflow-hidden">
                        <!-- Header Section -->
                        <div class="border-b border-white/10 pb-4 mb-4 flex items-center justify-between">
                            <div>
                                <h3 class="text-[10px] uppercase tracking-widest text-sky-400 font-bold mb-1 flex items-center gap-2">
                                   <Icon name="ri:quote-text" class="text-sm" /> Transcript Quote
                                </h3>
                                <h4 class="text-white font-bold leading-tight truncate max-w-[200px]">{{ state?.activeHook?.value?.theme || 'Untitled Hook' }}</h4>
                            </div>
                            <!-- Copy Button -->
                            <button 
                              @click="copyQuoteToClipboard" 
                              class="flex items-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                            >
                              <Icon :name="copied ? 'ri:check-line' : 'ri:file-copy-line'" />
                              {{ copied ? 'Copied' : 'Copy Quote' }}
                            </button>
                        </div>
                        
                        <!-- Main Quote Container -->
                        <div class="flex-1 flex flex-col gap-4 overflow-hidden min-h-0">
                            <!-- Premium Quote Card -->
                            <div class="flex-1 bg-white/[0.02] border border-white/5 rounded-2xl relative overflow-hidden flex flex-col min-h-0 pr-1">
                                <!-- Giant Decorative Quote Icon (Background) -->
                                <Icon name="ri:double-quotes-l" class="absolute -right-4 -bottom-6 text-9xl text-white/[0.02] transform -rotate-12 pointer-events-none" />
                                
                                <div class="relative z-10 overflow-y-auto pl-6 pr-5 py-6 custom-scrollbar h-full w-full">
                                    <span class="text-3xl text-sky-500/40 font-serif leading-none block mb-1">“</span>
                                    <p class="text-slate-200 text-sm md:text-base leading-relaxed italic font-serif px-4">
                                        {{ state?.activeHook?.value?.transcript_quote || 'No transcript quote available for this segment.' }}
                                    </p>
                                    <span class="text-3xl text-sky-500/40 font-serif leading-none block text-right mt-1">”</span>
                                </div>
                            </div>
                            
                            <!-- Metadata Stats Badges -->
                            <div class="flex items-center gap-2 flex-wrap pb-2">
                                <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    <Icon name="ri:text" class="text-sky-400" />
                                    <span>{{ quoteWordCount }} Words</span>
                                </div>
                                <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    <Icon name="ri:character-recognition-line" class="text-sky-400" />
                                    <span>{{ quoteCharCount }} Chars</span>
                                </div>
                                <div class="bg-white/[0.03] border border-white/5 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    <Icon name="ri:time-line" class="text-sky-400" />
                                    <span>~{{ quoteReadingTime }}s Read</span>
                                </div>
                            </div>
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
       <div class="w-80 border-l border-white/10 bg-[#0e0e12]/90 backdrop-blur-xl flex flex-col overflow-hidden text-white relative">
          <!-- Content Safety Audit Panel -->
          <ContentAuditPanel 
            class="border-b border-surface-border min-h-0 shrink-0" 
            :expanded="isAuditExpanded"
            @toggle-expand="isAuditExpanded = !isAuditExpanded"
            @settings="showBlacklistSettings = true" 
          />

          <div class="border-b border-surface-border/30 flex flex-col shrink-0">
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
            <div class="flex bg-black/40 border border-white/5 rounded-xl p-1 gap-1 mb-4 mx-4 mt-2">
               <button 
                 @click="panelTab = 'generated'"
                 class="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
                 :class="panelTab === 'generated' ? 'bg-white/10 text-amber-400 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]' : 'text-slate-400 border border-transparent hover:text-white'"
               >
                  Generated ({{ state.hooks.value.length }})
               </button>
               <button 
                 @click="panelTab = 'saved'"
                 class="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
                 :class="panelTab === 'saved' ? 'bg-white/10 text-amber-400 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]' : 'text-slate-400 border border-transparent hover:text-white'"
               >
                  Saved ({{ state.savedHooks.value.length }})
               </button>
            </div>
          </div>

          <div v-if="panelTab === 'generated'" ref="hooksContainer" class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar min-h-0">
            <div v-if="!state.hooks.value.length" class="text-center text-slate-600 text-xs p-6">
              No hooks generated yet.
            </div>
            <button
              v-for="(hook, idx) in state.hooks.value"
              :key="idx"
              @click="selectSidebarHook(hook)"
              :disabled="isOverlayVisible"
              class="w-full text-left p-3.5 rounded-2xl border transition-all text-xs group relative overflow-hidden"
              :class="[
                isActiveHook(hook)
                  ? 'bg-amber-500/[0.08] border-amber-500/60 text-amber-200 shadow-[0_4px_20px_rgba(245,158,11,0.08)] hook-item-active' 
                  : 'bg-[#16161c]/60 border-white/10 hover:border-white/20 hover:bg-[#1f1f28]/70 text-slate-300',
                isOverlayVisible ? 'opacity-50 cursor-not-allowed' : ''
              ]"
            >
              
              <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-[10px] uppercase tracking-wider" :class="isActiveHook(hook) ? 'text-amber-400' : 'text-slate-500'">
                    HOOK {{ String(Number(idx) + 1).padStart(2, '0') }}
                  </span>
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
                <span class="mono text-[10px]" :class="isActiveHook(hook) ? 'text-sky-400 font-bold' : 'text-slate-300'">
                  {{ state.formatDuration(hook.start) }} – {{ state.formatDuration(hook.end) }}
                  <span class="ml-1 text-accent-500 font-bold">({{ Math.floor(hook.end - hook.start) >= 60 ? Math.floor((hook.end - hook.start) / 60) + 'm ' + Math.floor((hook.end - hook.start) % 60) + 's' : Math.floor(hook.end - hook.start) + 's' }})</span>
                </span>
              </div>
              <p class="font-medium truncate" :class="isActiveHook(hook) ? 'text-white' : 'text-slate-300'">{{ hook.theme || 'Untitled' }}</p>
              <p class="text-[10px] mt-1 line-clamp-2 italic opacity-70">"{{ (hook.transcript_quote || '').length > 80 ? (hook.transcript_quote || '').substring(0, 77) + '...' : (hook.transcript_quote || '') }}"</p>
            </button>
          </div>

          <div v-else class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar min-h-0">
            <div v-if="!state.savedHooks.value.length" class="text-center text-slate-600 text-xs p-6">
              No saved hooks for this video yet.
            </div>
            <button
              v-for="(hook, idx) in state.savedHooks.value"
              :key="hook._id || idx"
              @click="selectSidebarHook(hook)"
              :disabled="isOverlayVisible"
              class="w-full text-left p-3.5 rounded-2xl border transition-all text-xs group relative overflow-hidden"
              :class="[
                isActiveHook(hook)
                  ? 'bg-amber-500/[0.08] border-amber-500/60 text-amber-200 shadow-[0_4px_20px_rgba(245,158,11,0.08)]' 
                  : 'bg-[#16161c]/60 border-white/10 hover:border-white/20 hover:bg-[#1f1f28]/70 text-slate-300',
                isOverlayVisible ? 'opacity-50 cursor-not-allowed' : ''
              ]"
            >
              
              <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-[10px] uppercase tracking-wider" :class="isActiveHook(hook) ? 'text-amber-400' : 'text-slate-500'">
                    SAVED {{ String(Number(idx) + 1).padStart(2, '0') }}
                  </span>
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

  <!-- Blacklist Settings Modal Overlay -->
  <div v-if="showBlacklistSettings" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="showBlacklistSettings = false">
     <div class="w-full max-w-lg">
        <BlacklistSettings @close="showBlacklistSettings = false" />
     </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onActivated, onDeactivated, onUnmounted } from 'vue'
import { groupTranscript, updateSegmentText, updateSegmentStart, updateSegmentDuration, redistributeTranscript } from '../utils/subtitleChunker'
import type { ChunkerSegment } from '../utils/subtitleChunker'
import type { Hook, ReadyClip } from '../types/clipper'
const state = useClipperState()
const route = useRoute()
const router = useRouter()

const isOverlayVisible = useState<boolean>('isOverlayVisible', () => false)
let overlayTimeout: ReturnType<typeof setTimeout> | null = null

const isAuditExpanded = ref(false)

const isCurrentHookSaved = computed(() => {
  if (!state?.activeHook?.value || !state?.savedHooks?.value?.length) return false
  const active = state.activeHook.value
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end

  return state.savedHooks.value.some((h: Hook) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })
})

// Read shared readyClips from dashboard (populated via useState in index.vue)
const readyClips = useState<ReadyClip[]>('readyClips', () => [])
const API_BASE = 'http://localhost:8000'

async function fetchReadyClips() {
  try {
    const res = await $fetch<{ clips: ReadyClip[] }>(`${API_BASE}/api/ready-clips`)
    readyClips.value = res.clips || []
  } catch (e) {
    console.error('[yonru] Failed to fetch ready clips in background:', e)
  }
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

// Sidebar View for Editor page
const sidebarView = ref('editor')

function handleSidebarNav(view: string) {
  if (view !== 'editor') {
    router.push('/')
    // We could pass a state here to tell index.vue which view to show
  }
}

function handleErrorBack() {
  state.jobStatus.value = 'idle'
  state.jobError.value = null
  state.isMediaLoading.value = false
  router.push('/')
}

function handleErrorRetry() {
  if (state.activeHook.value) {
    state.extractClip(state.activeHook.value)
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

const hasBeenMounted = ref(false)

onMounted(async () => {
  console.log('[yonru] Editor mounted (first time)')
  // Clear navigation overlay
  state.isNavigatingToEditor.value = false

  // Background fetch for ready clips to ensure it's fresh
  fetchReadyClips()

  // Ensure library data is loaded for the sidebar dashboard
  state.fetchCached()
  state.fetchSavedHooks()
  
  if (import.meta.client) {
    const saved = localStorage.getItem('yonru_last_video')
    if (saved) state.lastAccessedVideoId.value = saved
  }

  // Restore state from URL if refreshing
  restoreStateFromQuery()
  state.initPersistence()
  // Defer flag so onActivated (fires same tick) still sees false on first load
  nextTick(() => {
    hasBeenMounted.value = true
  })
})

onActivated(() => {
  if (hasBeenMounted.value) {
    console.log('[yonru] Editor activated (returned from cache)')
    sidebarView.value = 'editor'
    // With keepalive, onMounted only fires once.
    // Clear navigation overlay on subsequent visits.
    state.isNavigatingToEditor.value = false
    
    // Background fetch for ready clips to ensure it's fresh
    fetchReadyClips()

    // Ensure library data is loaded for the sidebar dashboard
    state.fetchCached()
    state.fetchSavedHooks()

    // Restore state from route queries
    restoreStateFromQuery()
  }
})

onDeactivated(() => {
  console.log('[yonru] Editor deactivated — stopping background polling')
  state.stopPolling()
  if (overlayTimeout) {
    clearTimeout(overlayTimeout)
    overlayTimeout = null
  }
})

const showBlacklistSettings = ref(false)
const panelTab = ref<'generated' | 'saved'>((route.query.tab as any) || 'generated')

function restoreStateFromQuery() {
  const jobId = route.query.job_id as string
  const folder = route.query.folder as string
  const clipId = route.query.clip_id as string
  const hookIndex = parseInt(route.query.hook_index as string)
  const tab = (route.query.tab as string) || 'generated'
  
  if (jobId) {
    console.log('[editor] Restoring state from query. JobID:', jobId, 'Folder:', folder, 'ClipID:', clipId, 'HookIndex:', hookIndex, 'Tab:', tab)
    state.jobId.value = jobId
    state.folderName.value = folder
    if (clipId) {
      state.clipId.value = clipId
    }
    panelTab.value = tab as any
    
    // We need to wait for hooks to load before we can select the active one
    let stopWatcher: (() => void) | null = null
    stopWatcher = watch([() => state?.jobStatus?.value, () => state?.hooks?.value, () => state?.savedHooks?.value], () => {
      const status = state?.jobStatus?.value || 'idle'
      const hooksAvailable = (state?.hooks?.value?.length || 0) > 0 || (state?.savedHooks?.value?.length || 0) > 0
      
      if (status === 'ready' || (status === 'hooks_ready' && hooksAvailable)) {
        const hooksList = tab === 'saved' ? state?.savedHooks?.value : state?.hooks?.value
        const targetIndex = isNaN(hookIndex) ? 0 : hookIndex
        if (hooksList && hooksList[targetIndex]) {
          console.log('[editor] Restoring hook from index:', targetIndex)
          if (state?.activeHook) state.activeHook.value = hooksList[targetIndex]
          // Only trigger extraction if we don't already have a ready clip
          if (status !== 'ready') {
            state?.extractClip?.(hooksList[targetIndex])
          }
        }
        if (stopWatcher) stopWatcher()
      }
    }, { immediate: true })

    state?.startPolling?.()
  }
}

async function selectSidebarHook(hook: Hook) {
  if (state.jobStatus.value === 'cutting') return
  
  // Explicitly save the current active hook settings before switching!
  if (state?.activeHook?.value && state?.clipId?.value) {
    console.log('[editor] Saving current hook state before switching...')
    await handleSave(true)
  }
  
  // Find hook index
  const hooksList = panelTab.value === 'saved' ? state.savedHooks.value : state.hooks.value
  const hookIndex = hooksList.indexOf(hook)
  
  // Check if hook is already rendered/ready
  const matchingClip = findMatchingClip(hook)

  // Update route query silently so refresh works
  const query: Record<string, string | number | (string | null)[] | null> = {
    ...route.query as Record<string, string | number | (string | null)[]>,
    hook_index: hookIndex >= 0 ? hookIndex : 0,
    tab: panelTab.value
  }
  if (matchingClip) {
    query.clip_id = matchingClip.clip_id
  } else {
    delete query.clip_id
  }
  router.replace({ query })
  
  if (matchingClip) {
    console.log('[editor] Hook is already rendered, loading ready clip:', matchingClip.clip_id)
    state.loadReadyClipIntoEditor(state.folderName.value || '', matchingClip.clip_id)
  } else {
    console.log('[editor] Hook is not rendered, starting extraction...')
    state.extractClip(hook)
  }
}


const editorTab = ref<'edit' | 'quote' | 'thumbnail'>('edit')
const subtitleSubTab = ref<'one' | 'all'>('one')

const copied = ref(false)
function copyQuoteToClipboard() {
  if (!state?.activeHook?.value?.transcript_quote) return
  navigator.clipboard.writeText(state.activeHook.value.transcript_quote)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

const quoteWordCount = computed(() => {
  const quote = state?.activeHook?.value?.transcript_quote || ''
  const clean = quote.trim()
  return clean ? clean.split(/\s+/).length : 0
})

const quoteCharCount = computed(() => {
  return (state?.activeHook?.value?.transcript_quote || '').length
})

const quoteReadingTime = computed(() => {
  return Math.max(1, Math.round(quoteWordCount.value / 3.3))
})
const subtitleContainer = ref<HTMLElement | null>(null)
const bulkContainer = ref<HTMLElement | null>(null)
const isHoveringSubtitles = ref(false)

const absoluteTime = computed(() => state?.currentTime?.value || 0)
const visibleSegments = computed(() => {
  const flatWords = state?.fullTranscript?.value || []
  return groupTranscript(flatWords as unknown as ChunkerSegment[], state.subtitleMode.value)
})

const activeSegIdx = computed(() => {
  if (!state?.fullTranscript?.value || !state?.activeHook?.value) return -1
  
  const offsetSec = (state?.subtitleSyncOffset?.value || 0) / 1000
  const firstStart = state?.fullTranscript?.value[0]?.start || 0
  const isTranscriptZeroBased = firstStart < (state?.activeHook?.value?.start || 0) - 2
  
  const thumbSec = state?.thumbnailEnabled?.value ? state?.thumbnailDuration?.value : 0
  const relativeTime = Math.max(0, absoluteTime.value - thumbSec)
  
  const searchTime = isTranscriptZeroBased 
    ? relativeTime + offsetSec
    : (state?.activeHook?.value?.start || 0) + relativeTime + offsetSec
    
  return visibleSegments.value.findIndex((s: ChunkerSegment) => 
    searchTime >= s.start && 
    searchTime < (s.end ?? 0)
  )
})

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
  
  // Auto-scroll the 'All Words' flowing document view with smooth vertical centering
  if (subtitleSubTab.value === 'all' && idx !== -1 && bulkContainer.value && !isHoveringBulk.value && editingSegIdx.value === -1) {
    const el = document.getElementById(`bulk-seg-${idx}`)
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }
})



watch(() => state.renderStatus.value, (newStatus) => {
  if (newStatus === 'done') {
    fetchReadyClips()
  }
})

watch(() => state.jobStatus.value, (newStatus) => {
  if (newStatus === 'ready') {
    fetchReadyClips()
  }
}, { immediate: true })

watch(() => state.jobId.value, (newJobId) => {
  if (newJobId && route.query.job_id !== newJobId) {
    const query = { ...route.query, job_id: newJobId }
    router.replace({ query })
  }
})

// Moved up

// Pipeline loading overlay
const pipelineStep = computed(() => {
  const status = state?.jobStatus?.value || 'idle'
  // Only force 'cutting' if the hook is not already rendered/ready on the server!
  if (state?.activeHook?.value && !isHookRendered(state.activeHook.value) && status !== 'ready') {
    return status === 'transcribing' ? 'transcribing' : 'cutting'
  }
  return status
})

const pipelineStepIdx = computed(() => {
  const map: Record<string, number> = { cutting: 0, transcribing: 1, ready: 2 }
  return map[pipelineStep.value] ?? 2
})

const isPipelineActive = computed(() => ['cutting', 'transcribing', 'error'].includes(state?.jobStatus?.value || '') || state?.isMediaLoading?.value)

watch(
  [isPipelineActive, () => state?.jobStatus?.value],
  ([active, status]) => {
    if (active) {
      isOverlayVisible.value = true
      if (overlayTimeout) {
        clearTimeout(overlayTimeout)
        overlayTimeout = null
      }
    } else {
      if (status === 'ready') {
        if (!overlayTimeout) {
          overlayTimeout = setTimeout(() => {
            isOverlayVisible.value = false
            overlayTimeout = null
          }, 800)
        }
      } else {
        isOverlayVisible.value = false
        if (overlayTimeout) {
          clearTimeout(overlayTimeout)
          overlayTimeout = null
        }
      }
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  if (overlayTimeout) {
    clearTimeout(overlayTimeout)
    overlayTimeout = null
  }
})

// Moved up

// All Words (Flowing Document View) State & Interactivity
const editingSegIdx = ref(-1)
const editSegText = ref('')
const isHoveringBulk = ref(false)
let autoScrollResumeTimeout: ReturnType<typeof setTimeout> | null = null

function handleBulkMouseEnter() {
  isHoveringBulk.value = true
  if (autoScrollResumeTimeout) clearTimeout(autoScrollResumeTimeout)
}

function handleBulkMouseLeave() {
  if (autoScrollResumeTimeout) clearTimeout(autoScrollResumeTimeout)
  autoScrollResumeTimeout = setTimeout(() => {
    isHoveringBulk.value = false
  }, 2000)
}

function startEdit(seg: ChunkerSegment, idx: number) {
  editingSegIdx.value = idx
  editSegText.value = seg.text || ''
}

function commitEdit(seg: ChunkerSegment, idx: number) {
  if (editingSegIdx.value !== idx) return
  const trimmed = editSegText.value.trim()
  seg.text = trimmed
  updateSegmentText(seg, trimmed)
  
  if (state?.fullTranscript?.value) {
    state.fullTranscript.value = [...state.fullTranscript.value]
  }
  editingSegIdx.value = -1
}

function cancelEdit() {
  editingSegIdx.value = -1
}

// Compute the active word index inside the active segment
const activeWordIdxInSeg = computed(() => {
  if (activeSegIdx.value === -1) return -1
  const seg = visibleSegments.value[activeSegIdx.value]
  if (!seg || !seg.text) return -1

  const offsetSec = (state?.subtitleSyncOffset?.value || 0) / 1000
  const firstStart = state?.fullTranscript?.value[0]?.start || 0
  const isTranscriptZeroBased = firstStart < (state?.activeHook?.value?.start || 0) - 2
  const thumbSec = state?.thumbnailEnabled?.value ? state?.thumbnailDuration?.value : 0
  const relativeTime = Math.max(0, absoluteTime.value - thumbSec)
  const searchTime = isTranscriptZeroBased 
    ? relativeTime + offsetSec
    : (state?.activeHook?.value?.start || 0) + relativeTime + offsetSec

  const words = seg.text.trim().split(/\s+/)
  if (!words.length || words.length === 1) return 0

  const duration = seg.duration
  const wordDur = duration / words.length

  const elapsed = searchTime - seg.start
  const wordIdx = Math.floor(elapsed / wordDur)
  return Math.max(0, Math.min(wordIdx, words.length - 1))
})

// Watchers

// Moved up to fix initialization order

function isActiveHook(hook: Hook) {
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
    if (typeof document !== 'undefined') {
      const activeEl = document.querySelector('.hook-item-active')
      if (activeEl && hooksContainer.value) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, 100)
}, { immediate: true })

function jumpTo(time: number) {
  const video = document.querySelector('video')
  if (video) {
    video.currentTime = time
  }
}

function autoGrow(e: Event) {
  const target = e.target as HTMLTextAreaElement
  if (target) {
    target.style.height = 'auto'
    target.style.height = target.scrollHeight + 'px'
  }
}
async function handleSave(isSilent = false) {
  const silent = isSilent === true
  await Promise.all([
    state.saveTranscript(silent),
    state.saveStyleSettings(),
    state.saveTimelineTracks(),
    state.saveThumbnailConfig()
  ])
}

// Draggable Subtitle Panel Sidebar Resizing State & Event Handlers
const panelWidth = ref(450)
const isDragging = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('yonru-editor-width')
  if (saved) {
    const parsed = parseInt(saved)
    if (!isNaN(parsed)) {
      panelWidth.value = Math.max(50, Math.min(800, parsed))
    }
  }
})

function initResize(e: PointerEvent) {
  e.preventDefault()
  isDragging.value = true
  const startWidth = panelWidth.value
  const startX = e.clientX

  const handlePointerMove = (moveEvent: PointerEvent) => {
    const deltaX = moveEvent.clientX - startX
    const newWidth = startWidth - deltaX
    panelWidth.value = Math.max(50, Math.min(800, newWidth))
  }

  const handlePointerUp = () => {
    isDragging.value = false
    localStorage.setItem('yonru-editor-width', panelWidth.value.toString())
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
  }

  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp)
}
</script>
