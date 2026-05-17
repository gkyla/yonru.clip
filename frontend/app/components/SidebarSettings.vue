<template>
  <div v-if="state" class="h-full flex flex-col p-5 gap-6 overflow-y-auto custom-scrollbar">

    
    <!-- Editor Sidebar -->

    <!-- Style Presets -->
    <div>
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center justify-between">
        Style Presets
        <Icon name="ri:palette-line" />
      </h2>
      <div class="grid grid-cols-3 gap-2">
        <button 
          v-for="preset in presets" :key="preset.id"
          @click="applyPreset(preset)"
          :disabled="state.renderStatus.value === 'rendering'"
          class="bg-surface-dark border rounded-lg p-2 text-center text-[9px] transition-all flex flex-col items-center gap-1.5 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
          :class="state.subtitlePreset.value === preset.id 
            ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.15)]' 
            : 'border-surface-border text-slate-400 hover:border-accent-500/50 hover:text-white'"
        >
          <span class="text-lg">{{ preset.icon }}</span>
          <span class="font-bold tracking-wider uppercase leading-tight">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <hr class="border-surface-border/50" />

    <!-- Subtitle Settings -->
    <div>
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center justify-between">
        Subtitle Config
        <Icon name="ri:settings-4-line" />
      </h2>
      
      <div class="space-y-4">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Language</label>
          <select v-model="state.language.value" class="w-full bg-surface-dark border border-surface-border rounded p-2 text-sm focus:outline-none focus:border-accent-500 transition-colors">
            <option value="id">Indonesian (ID)</option>
            <option value="en">English (EN)</option>
            <option value="ms">Malay (MS)</option>
            <option value="jw">Javanese (JW)</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-400 block mb-2">Display Mode</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button 
              v-for="mode in [
                { id: 'word', label: '1 Word' },
                { id: '3_words', label: '3 Words' },
                { id: '4_words', label: '4 Words' }
              ]" :key="mode.id"
              @click="state.subtitleMode.value = mode.id"
              :disabled="state.renderStatus.value === 'rendering'"
              class="bg-surface-dark border rounded p-1.5 text-center text-[10px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              :class="state.subtitleMode.value === mode.id 
                ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                : 'border-surface-border text-slate-400 hover:border-accent-500 hover:text-white'"
            >{{ mode.label }}</button>
          </div>
        </div>

        <!-- Animation Type -->
        <div>
          <label class="text-xs text-slate-400 block mb-2">Animation</label>
          <div class="grid grid-cols-3 gap-1.5">
            <button 
              v-for="anim in animations" :key="anim.id"
              @click="state.subtitleAnimation.value = anim.id"
              class="bg-surface-dark border rounded-lg p-1.5 text-center text-[9px] transition-all flex flex-col items-center gap-0.5"
              :class="state.subtitleAnimation.value === anim.id 
                ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                : 'border-surface-border text-slate-400 hover:border-accent-500/50 hover:text-white'"
            >
              <Icon :name="anim.icon" class="text-sm" />
              <span class="font-bold tracking-wider uppercase">{{ anim.label }}</span>
            </button>
          </div>
        </div>

        <!-- Highlight Mode (for multi-word) -->
        <div v-if="state.subtitleMode.value !== 'word' || state.subtitleAnimation.value === 'karaoke'">
          <label class="text-xs text-slate-400 block mb-2">Highlight Mode</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button 
              v-for="hl in highlights" :key="hl.id"
              @click="state.subtitleHighlightMode.value = hl.id"
              class="bg-surface-dark border rounded p-1.5 text-center text-[9px] transition-all"
              :class="state.subtitleHighlightMode.value === hl.id 
                ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                : 'border-surface-border text-slate-400 hover:border-accent-500/50 hover:text-white'"
            >{{ hl.label }}</button>
          </div>
        </div>
        
        <div>
          <label class="text-xs text-slate-400 block mb-2">Positioning</label>
          <div class="flex gap-2">
            <button 
              v-for="pos in ['top', 'center', 'bottom']" :key="pos"
              @click="state.subtitlePosition.value = pos"
              :disabled="state.renderStatus.value === 'rendering'"
              class="flex-1 bg-surface-dark border rounded p-1.5 text-center text-xs transition-all capitalize disabled:opacity-50 disabled:cursor-not-allowed"
              :class="state.subtitlePosition.value === pos 
                ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                : 'border-surface-border text-slate-400 hover:border-accent-500 hover:text-white'"
            >{{ pos }}</button>
          </div>
        </div>

        <!-- Text Background -->
        <div>
          <label class="text-xs text-slate-400 block mb-2">Text Background</label>
          <div class="grid grid-cols-2 gap-1.5">
            <button 
              v-for="bg in backgrounds" :key="bg.id"
              @click="state.subtitleBackground.value = bg.id"
              class="bg-surface-dark border rounded p-1.5 text-center text-[9px] transition-all"
              :class="state.subtitleBackground.value === bg.id 
                ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                : 'border-surface-border text-slate-400 hover:border-accent-500/50 hover:text-white'"
            >{{ bg.label }}</button>
          </div>
        </div>
      </div>
    </div>

    <hr class="border-surface-border/50" />

    <!-- Typography -->
    <div>
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center justify-between">
        Typography
        <Icon name="ri:font-size" />
      </h2>
      <div class="space-y-4">
        <div>
          <label class="text-xs text-slate-400 block mb-1">Font Family</label>
          <select v-model="state.font.value" class="w-full bg-surface-dark border border-surface-border rounded p-2 text-sm focus:outline-none focus:border-accent-500 transition-colors">
            <option v-for="f in FONT_OPTIONS" :key="f" :value="f">{{ f }}</option>
            <option value="Arial">Arial (System)</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-400 flex justify-between mb-2">
            <span>Font Size</span>
            <span class="mono text-accent-500 bg-accent-500/10 px-1 rounded">{{ state.fontSize.value }}px</span>
          </label>
          <input v-model.number="state.fontSize.value" type="range" min="40" max="140" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
        </div>

        <div v-if="!SINGLE_WEIGHT_FONTS.has(state.font.value)">
          <label class="text-xs text-slate-400 flex justify-between mb-2">
            <span>Font Weight</span>
            <span class="mono text-accent-500 bg-accent-500/10 px-1 rounded">{{ state.subtitleFontWeight.value }}</span>
          </label>
          <input v-model.number="state.subtitleFontWeight.value" type="range" min="400" max="900" step="100" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
        </div>
        <div v-else>
          <label class="text-xs text-slate-400 block mb-2">Font Weight</label>
          <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-surface-dark rounded py-2 px-3 border border-surface-border/50 text-center">
            Fixed Weight
          </div>
        </div>

        <div>
          <label class="text-xs text-slate-400 flex justify-between mb-2">
            <span>Stroke Width</span>
            <span class="mono text-accent-500 bg-accent-500/10 px-1 rounded">{{ state.subtitleStrokeWidth.value }}px</span>
          </label>
          <input v-model.number="state.subtitleStrokeWidth.value" type="range" min="0" max="8" step="1" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
        </div>

        <div>
          <label class="text-xs text-slate-400 block mb-2">Text Transform</label>
          <div class="flex gap-1.5">
            <button 
              v-for="tt in ['uppercase', 'capitalize', 'none']" :key="tt"
              @click="state.subtitleTextTransform.value = tt"
              class="flex-1 bg-surface-dark border rounded p-1.5 text-center text-[9px] font-bold transition-all uppercase tracking-wider"
              :class="state.subtitleTextTransform.value === tt 
                ? 'border-accent-500 text-accent-500' 
                : 'border-surface-border text-slate-400 hover:border-accent-500/50'"
            >{{ tt === 'none' ? 'Normal' : tt }}</button>
          </div>
        </div>
      </div>
    </div>

    <hr class="border-surface-border/50" />

    <!-- Colors -->
    <div>
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center justify-between">
        Colors
        <Icon name="ri:paint-brush-line" />
      </h2>
      <div class="space-y-4">
        <!-- Text Color -->
        <div>
          <label class="text-xs text-slate-400 flex items-center justify-between mb-2">
            <span>Text Color</span>
            <div class="w-4 h-4 rounded border border-white/20" :style="{ background: state.subtitleTextColor.value }"></div>
          </label>
          <div class="flex gap-1.5 flex-wrap">
            <button 
              v-for="c in palette" :key="'text-'+c"
              @click="state.subtitleTextColor.value = c"
              class="w-6 h-6 rounded-md border-2 transition-all hover:scale-110"
              :class="state.subtitleTextColor.value === c ? 'border-accent-500 scale-110' : 'border-transparent'"
              :style="{ background: c }"
            ></button>
            <input type="color" v-model="state.subtitleTextColor.value" class="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent" title="Custom color" />
          </div>
        </div>

        <!-- Highlight Color -->
        <div>
          <label class="text-xs text-slate-400 flex items-center justify-between mb-2">
            <span>Highlight Color</span>
            <div class="w-4 h-4 rounded border border-white/20" :style="{ background: state.subtitleHighlightColor.value }"></div>
          </label>
          <div class="flex gap-1.5 flex-wrap">
            <button 
              v-for="c in palette" :key="'hl-'+c"
              @click="state.subtitleHighlightColor.value = c"
              class="w-6 h-6 rounded-md border-2 transition-all hover:scale-110"
              :class="state.subtitleHighlightColor.value === c ? 'border-accent-500 scale-110' : 'border-transparent'"
              :style="{ background: c }"
            ></button>
            <input type="color" v-model="state.subtitleHighlightColor.value" class="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent" title="Custom color" />
          </div>
        </div>

        <!-- Stroke Color -->
        <div>
          <label class="text-xs text-slate-400 flex items-center justify-between mb-2">
            <span>Stroke Color</span>
            <div class="w-4 h-4 rounded border border-white/20" :style="{ background: state.subtitleStrokeColor.value }"></div>
          </label>
          <div class="flex gap-1.5 flex-wrap">
            <button 
              v-for="c in ['#000000', '#FFFFFF', '#1a1a1a', '#333333']" :key="'stroke-'+c"
              @click="state.subtitleStrokeColor.value = c"
              class="w-6 h-6 rounded-md border-2 transition-all hover:scale-110"
              :class="state.subtitleStrokeColor.value === c ? 'border-accent-500 scale-110' : 'border-white/10'"
              :style="{ background: c }"
            ></button>
            <input type="color" v-model="state.subtitleStrokeColor.value" class="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent" title="Custom color" />
          </div>
        </div>
      </div>
    </div>

    <hr class="border-surface-border/50" />

    <!-- Sync & Offset -->
    <div>
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center justify-between">
        Sync & Position
        <Icon name="ri:timer-line" />
      </h2>
      <div class="space-y-4">
        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs text-slate-400">Y-Offset</span>
            <div class="flex items-center gap-2">
              <input 
                v-model.number="state.subtitleOffset.value" 
                type="number" 
                :disabled="state.renderStatus.value === 'rendering'"
                class="w-16 bg-surface-dark border border-surface-border rounded px-1.5 py-0.5 text-[10px] mono text-accent-500 focus:border-accent-500 outline-none transition-colors"
              />
              <span class="text-[10px] text-slate-500">px</span>
            </div>
          </div>
          <input v-model.number="state.subtitleOffset.value" :disabled="state.renderStatus.value === 'rendering'" type="range" min="0" max="500" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" />
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <span class="text-xs text-slate-400">Sync Offset</span>
            <div class="flex items-center gap-2">
              <input 
                v-model.number="state.subtitleSyncOffset.value" 
                type="number" 
                :disabled="state.renderStatus.value === 'rendering'"
                class="w-16 bg-surface-dark border border-surface-border rounded px-1.5 py-0.5 text-[10px] mono text-accent-500 focus:border-accent-500 outline-none transition-colors"
              />
              <span class="text-[10px] text-slate-500">ms</span>
            </div>
          </div>
          <input v-model.number="state.subtitleSyncOffset.value" :disabled="state.renderStatus.value === 'rendering'" type="range" min="-2000" max="2000" step="50" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" />
          <div class="flex justify-between text-[10px] text-slate-600 mt-1">
             <span>EARLIER</span>
             <span>LATER</span>
          </div>
        </div>

        <div v-if="state.subtitleBackground.value !== 'none'">
          <label class="text-xs text-slate-400 flex justify-between mb-2">
            <span>BG Opacity</span>
            <span class="mono text-accent-500 bg-accent-500/10 px-1 rounded">{{ Math.round(state.subtitleBackgroundOpacity.value * 100) }}%</span>
          </label>
          <input v-model.number="state.subtitleBackgroundOpacity.value" type="range" min="0" max="1" step="0.05" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
        </div>
      </div>
    </div>

    <hr class="border-surface-border/50" />
    
    <!-- Crop Mode -->
    <div>
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center justify-between">
        Crop Mode
        <Icon name="ri:crop-line" />
      </h2>
      
      <div class="flex gap-2 mb-3">
        <button 
          @click="state.cropMode.value = 'manual'"
          class="flex-1 bg-surface-dark border rounded p-2 text-center text-xs transition-all flex flex-col items-center gap-1"
          :class="state.cropMode.value === 'manual' 
            ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
            : 'border-surface-border text-slate-400 hover:border-accent-500 hover:text-white'"
        >
          <Icon name="ri:drag-move-2-line" class="text-lg" />
          Manual Pan
        </button>
        <button 
          @click="state.cropMode.value = 'face_tracking'"
          class="flex-1 bg-surface-dark border rounded p-2 text-center text-xs transition-all flex flex-col items-center gap-1"
          :class="state.cropMode.value === 'face_tracking' 
            ? 'border-accent-500 text-accent-500 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
            : 'border-surface-border text-slate-400 hover:border-accent-500 hover:text-white'"
        >
          <Icon name="ri:body-scan-line" class="text-lg" />
          AI Face Track
        </button>
      </div>

      <!-- Manual crop percent indicator -->
      <div v-if="state.cropMode.value === 'manual'" class="bg-surface-dark border border-surface-border rounded p-3">
        <label class="text-[10px] text-slate-500 flex justify-between uppercase tracking-widest mb-2">
          <span>Horizontal Position</span>
          <span class="mono text-accent-500 font-bold">{{ Math.round(state.cropPercentX.value) }}%</span>
        </label>
        <input v-model.number="state.cropPercentX.value" type="range" min="0" max="100" step="1" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
        <div class="flex justify-between text-[9px] text-slate-600 mt-1 mono">
          <span>LEFT</span>
          <span>CENTER</span>
          <span>RIGHT</span>
        </div>
      </div>
      
      <p v-if="state.cropMode.value === 'face_tracking'" class="text-[10px] text-slate-500 mt-2 italic">
        AI will auto-detect the primary face and center the 9:16 crop on it during render.
      </p>
    </div>

    <!-- Advanced Settings -->
    <div class="pt-4 border-t border-surface-border/50">
      <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
        <Icon name="ri:settings-2-line" />
        Advanced
      </h2>
      <div class="flex items-center justify-between bg-surface-dark border border-surface-border rounded-lg p-3">
         <div>
            <p class="text-xs font-bold text-slate-300">Disable Remotion</p>
            <p class="text-[9px] text-slate-500 mt-0.5">Use raw native video</p>
         </div>
         <button 
            @click="state.useNativePlayer.value = !state.useNativePlayer.value"
            class="relative w-8 h-4 rounded-none transition-colors duration-300"
            :class="state.useNativePlayer.value ? 'bg-accent-500' : 'bg-surface-border'"
         >
            <div class="absolute top-0.5 left-0.5 w-3 h-3 rounded-none bg-white transition-transform duration-300 shadow-sm"
                 :class="state.useNativePlayer.value ? 'translate-x-4' : 'translate-x-0'"
            ></div>
         </button>
      </div>

      <div class="flex items-center justify-between bg-surface-dark border border-surface-border rounded-lg p-3 mt-3">
         <div>
            <p class="text-xs font-bold text-slate-300">Debug Info</p>
            <p class="text-[9px] text-slate-500 mt-0.5">Show Remotion debug stats</p>
         </div>
         <button 
            @click="state.showIframeDebug.value = !state.showIframeDebug.value"
            class="relative w-8 h-4 rounded-none transition-colors duration-300"
            :class="state.showIframeDebug.value ? 'bg-accent-500' : 'bg-surface-border'"
         >
            <div class="absolute top-0.5 left-0.5 w-3 h-3 rounded-none bg-white transition-transform duration-300 shadow-sm"
                 :class="state.showIframeDebug.value ? 'translate-x-4' : 'translate-x-0'"
            ></div>
         </button>
      </div>
    </div>

      <!-- Save Default Style -->
    <div>
      <button 
        @click="state.saveDefaultStyleSettings(); if (state.showToast) state.showToast('Default style saved!', 'success')"
        class="w-full bg-surface-dark border border-surface-border/50 hover:border-accent-500/50 text-slate-300 hover:text-accent-400 px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <Icon name="ri:save-3-line" class="text-base text-accent-500" />
        Save this style for future videos
      </button>
    </div>

    <!-- Render Section -->
    <div class="mt-auto pt-6 border-t border-surface-border space-y-3">
      <div v-if="state.renderStatus.value === 'ready' || state.renderStatus.value === 'done'" class="bg-accent-500/10 border border-accent-500/30 rounded-xl p-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
        <Icon name="ri:checkbox-circle-fill" class="text-2xl text-accent-500" />
        <div class="flex-1 overflow-hidden">
           <p class="text-[10px] font-bold text-accent-400 uppercase tracking-widest">Render Complete</p>
           <a :href="state.outputUrl.value" target="_blank" class="text-xs text-white underline font-medium hover:text-accent-500 transition-colors block truncate">Download Result</a>
        </div>
      </div>

      <button 
        @click="prepareRender"
        :disabled="state.jobStatus.value !== 'ready' || state.renderStatus.value === 'rendering'"
        class="w-full bg-accent-500 text-black font-bold uppercase tracking-wider rounded p-3 text-sm hover:bg-accent-600 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(207,255,80,0.15)] hover:shadow-[0_0_25px_rgba(207,255,80,0.25)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
      >
        <Icon :name="state.renderStatus.value === 'rendering' ? 'ri:loader-4-line' : 'ri:movie-fill'" :class="{ 'animate-spin': state.renderStatus.value === 'rendering' }" />
        {{ state.renderStatus.value === 'rendering' ? 'RENDERING...' : 'RENDER CLIP' }}
      </button>
    </div>

    <!-- Naming Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="isNamingClip" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <!-- Backdrop -->
           <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="isNamingClip = false"></div>
           
           <!-- Card -->
           <div class="relative bg-surface-panel border border-surface-border p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300">
              <h3 class="text-xl font-black text-white mb-2 uppercase tracking-tighter italic">Name Your Clip</h3>
              <p class="text-slate-400 text-xs mb-6">Enter a title for your final video file.</p>
              
              <div class="space-y-4">
                 <div>
                    <label class="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5 block">File Name</label>
                    <div class="relative group">
                       <input 
                         v-model="renderName"
                         @keyup.enter="startFinalRender"
                         class="w-full bg-surface-dark border border-surface-border/50 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-3 text-white font-bold outline-none transition-all pr-12"
                         placeholder="e.g. My Viral Hook"
                         autoFocus
                       />
                       <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono">.mp4</span>
                    </div>
                    <p class="text-[9px] text-slate-600 mt-2 italic">Spaces will be converted to underscores.</p>
                 </div>
                 
                 <div class="flex gap-3 pt-2">
                    <button 
                      @click="isNamingClip = false"
                      class="flex-1 px-4 py-3 rounded-xl border border-surface-border text-slate-400 font-bold text-xs hover:bg-surface-card transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      @click="startFinalRender"
                      class="flex-[1.5] bg-accent-500 hover:bg-accent-400 text-black px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(207,255,80,0.2)]"
                    >
                      Start Render
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </Transition>
    </Teleport>
    <!-- Blacklist Settings Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showBlacklistSettings" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
           <div class="absolute inset-0 bg-black/80 backdrop-blur-xl" @click="showBlacklistSettings = false"></div>
           <div class="relative bg-surface-panel border border-surface-border rounded-3xl shadow-2xl max-w-lg w-full animate-in zoom-in-95 duration-300 overflow-hidden">
              <BlacklistSettings @close="showBlacklistSettings = false" />
           </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { FONT_OPTIONS } from '../composables/useClipperState'
const state = useClipperState()

const showBlacklistSettings = ref(false)
const isNamingClip = ref(false)
const renderName = ref('')

function prepareRender() {
  if (state.activeHook.value) {
    renderName.value = state.activeHook.value.theme || ''
  }
  isNamingClip.value = true
}

function startFinalRender() {
  if (!renderName.value.trim()) return
  isNamingClip.value = false
  state.renderClip(0, renderName.value.trim())
}

const SINGLE_WEIGHT_FONTS = new Set([
  'Bebas Neue', 'Anton', 'Bangers', 'Permanent Marker', 'Russo One',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
])

const palette = [
  '#FFFFFF', '#CFFF50', '#FFD700', '#EF4444', '#60A5FA',
  '#A78BFA', '#34D399', '#FB923C', '#F472B6', '#000000'
]

const animations = [
  { id: 'pop', label: 'Pop', icon: 'ri:magic-line' },
  { id: 'slide-up', label: 'Slide', icon: 'ri:arrow-up-line' },
  { id: 'fade', label: 'Fade', icon: 'ri:contrast-drop-line' },
  { id: 'bounce', label: 'Bounce', icon: 'ri:basketball-line' },
  { id: 'typewriter', label: 'Type', icon: 'ri:keyboard-line' },
  { id: 'karaoke', label: 'Karaoke', icon: 'ri:mic-line' },
]

const highlights = [
  { id: 'color', label: 'Color Swap' },
  { id: 'scale', label: 'Scale Pulse' },
  { id: 'underline', label: 'Underline' },
  { id: 'box', label: 'Box Highlight' },
  { id: 'none', label: 'None' },
]

const backgrounds = [
  { id: 'none', label: 'None' },
  { id: 'box', label: 'Dark Box' },
  { id: 'blur', label: 'Blur Pill' },
  { id: 'gradient', label: 'Gradient' },
]

const presets = [
  { id: 'bold-podcast', name: 'Podcast', icon: '🎙️', font: 'Montserrat', fontSize: 100, fontWeight: 900, color: '#FFFFFF', highlightColor: '#FFD700', animation: 'pop', highlightMode: 'color', background: 'none', strokeWidth: 4, textTransform: 'uppercase' },
  { id: 'clean-vlog', name: 'Vlog', icon: '📹', font: 'Inter', fontSize: 80, fontWeight: 700, color: '#FFFFFF', highlightColor: '#60A5FA', animation: 'slide-up', highlightMode: 'scale', background: 'none', strokeWidth: 3, textTransform: 'none' },
  { id: 'street', name: 'Street', icon: '🔥', font: 'Bebas Neue', fontSize: 120, fontWeight: 400, color: '#FFFFFF', highlightColor: '#EF4444', animation: 'bounce', highlightMode: 'box', background: 'none', strokeWidth: 5, textTransform: 'uppercase' },
  { id: 'minimal', name: 'Minimal', icon: '✨', font: 'Poppins', fontSize: 70, fontWeight: 600, color: '#FFFFFF', highlightColor: '#A78BFA', animation: 'fade', highlightMode: 'none', background: 'blur', strokeWidth: 2, textTransform: 'none' },
  { id: 'karaoke', name: 'Karaoke', icon: '🎤', font: 'Oswald', fontSize: 90, fontWeight: 700, color: '#FFFFFF', highlightColor: '#CFFF50', animation: 'karaoke', highlightMode: 'color', background: 'none', strokeWidth: 4, textTransform: 'uppercase' },
  { id: 'documentary', name: 'Docu', icon: '🎬', font: 'Noto Sans', fontSize: 65, fontWeight: 500, color: '#FFFFFF', highlightColor: '#FCD34D', animation: 'typewriter', highlightMode: 'underline', background: 'box', strokeWidth: 2, textTransform: 'none' },
]

function applyPreset(preset) {
  state.subtitlePreset.value = preset.id
  state.font.value = preset.font
  state.fontSize.value = preset.fontSize
  state.subtitleFontWeight.value = preset.fontWeight
  state.subtitleTextColor.value = preset.color
  state.subtitleHighlightColor.value = preset.highlightColor
  state.subtitleAnimation.value = preset.animation
  state.subtitleHighlightMode.value = preset.highlightMode
  state.subtitleBackground.value = preset.background
  state.subtitleStrokeWidth.value = preset.strokeWidth
  state.subtitleTextTransform.value = preset.textTransform
}
</script>
