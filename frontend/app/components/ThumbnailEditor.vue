<template>
  <div v-if="state" class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="border-b border-surface-border/50 pb-4 mb-4 flex justify-between items-start">
      <div>
        <h3 class="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1 flex items-center gap-2">
          <Icon name="ri:image-edit-line" class="text-sm" /> Thumbnail Editor
        </h3>
        <p class="text-[9px] text-slate-400 max-w-[250px]">
          Auto-generate a thumbnail frame prepended to your clip for YouTube Shorts.
        </p>
      </div>
      <div ref="dropdownRef" class="relative flex items-center">
        <button 
          @click="handleSave" 
          class="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-l-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 border-r border-black/10"
        >
          Save Config
        </button>
        <button 
          @click="isDropdownOpen = !isDropdownOpen"
          class="bg-emerald-500 hover:bg-emerald-400 text-black px-2 py-1.5 rounded-r-lg text-[10px] font-black transition-all shadow-lg active:scale-95 flex items-center justify-center h-[28px]"
          title="More save options"
        >
          <Icon name="ri:arrow-down-s-line" class="text-sm transition-transform duration-300" :class="{ 'rotate-180': isDropdownOpen }" />
        </button>

        <!-- Dropdown Menu -->
        <div 
          v-if="isDropdownOpen" 
          class="absolute right-0 top-full mt-2 w-48 bg-surface-dark border border-surface-border/50 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <button 
            @click="handleSaveDefault" 
            class="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
          >
            <Icon name="ri:save-line" class="text-sm text-emerald-400" />
            Save as Default Style
          </button>
        </div>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">

      <!-- Enable Toggle -->
      <div class="flex items-center justify-between bg-surface-dark/50 border border-surface-border/50 rounded-xl px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="state.thumbnailEnabled.value ? 'bg-emerald-500/20' : 'bg-white/5'">
            <Icon name="ri:image-line" class="text-lg" :class="state.thumbnailEnabled.value ? 'text-emerald-400' : 'text-slate-600'" />
          </div>
          <div>
            <span class="text-xs font-bold text-white">Thumbnail Frame</span>
            <p class="text-[9px] text-slate-400">Prepend still image at start of video</p>
          </div>
        </div>
        <button 
          @click="state.toggleThumbnail()"
          class="w-10 h-5 rounded-none transition-all relative"
          :class="state.thumbnailEnabled.value ? 'bg-emerald-500' : 'bg-white/10'"
        >
          <div 
            class="absolute top-0.5 left-0.5 w-4 h-4 rounded-none bg-white transition-transform duration-300 shadow-sm"
            :class="state.thumbnailEnabled.value ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Screenshot Capture -->
      <div v-if="state.thumbnailEnabled.value" class="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
        
        <!-- Preview Mode Toggle -->
        <div class="bg-surface-dark/50 border border-surface-border/50 rounded-xl px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ri:eye-line" class="text-emerald-400" />
            <span class="text-[10px] font-bold text-white">Preview Thumbnail</span>
          </div>
          <button 
            @click="state.thumbnailEditMode.value = !state.thumbnailEditMode.value"
            class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
            :class="state.thumbnailEditMode.value ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'"
          >
            {{ state.thumbnailEditMode.value ? 'Editing' : 'Off' }}
          </button>
        </div>

        <!-- Screenshot Preview -->
        <div class="relative rounded-xl overflow-hidden border border-surface-border/50 bg-black aspect-[9/16] max-h-[200px]">
          <img 
            v-if="state.thumbnailUrl.value" 
            :src="state.thumbnailUrl.value" 
            class="w-full h-full object-cover"
            :style="{ objectPosition: `${state.thumbnailXOffset.value}% center` }"
            @error="state.thumbnailUrl.value = null"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-slate-400">
            <Icon name="ri:image-add-line" class="text-3xl mb-2" />
            <span class="text-[9px] uppercase tracking-widest font-bold">No Screenshot</span>
          </div>
          <!-- Screenshot time badge -->
          <div v-if="state.thumbnailUrl.value" class="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[9px] mono text-emerald-400 font-bold border border-emerald-500/30">
            @ {{ state.thumbnailScreenshotTime.value.toFixed(1) }}s
          </div>
        </div>

        <!-- Capture & Delete Buttons -->
        <div class="flex gap-2">
          <button 
            @click="state.captureScreenshot()"
            :disabled="state.isCapturingThumbnail.value"
            class="flex-1 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon :name="state.isCapturingThumbnail.value ? 'ri:loader-4-line' : 'ri:refresh-line'" class="text-sm" :class="{ 'animate-spin': state.isCapturingThumbnail.value }" />
            Random Frame
          </button>
          <button 
            @click="state.captureScreenshot(state.videoTime.value)"
            :disabled="state.isCapturingThumbnail.value"
            class="flex-1 py-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase tracking-widest hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon :name="state.isCapturingThumbnail.value ? 'ri:loader-4-line' : 'ri:focus-3-line'" class="text-sm" :class="{ 'animate-spin': state.isCapturingThumbnail.value }" />
            Current Frame
          </button>
          <button 
            v-if="state.thumbnailUrl.value"
            @click="state.deleteThumbnail()"
            :disabled="state.isCapturingThumbnail.value"
            class="py-2.5 px-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center active:scale-95"
            title="Delete Thumbnail"
          >
            <Icon name="ri:delete-bin-line" class="text-sm" />
          </button>
        </div>

        <!-- Duration Slider -->
        <div class="bg-surface-dark/50 border border-surface-border/50 rounded-xl p-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-300">Duration</label>
            <div class="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <input 
                type="number" 
                v-model.number="state.thumbnailDuration.value"
                min="0"
                max="5"
                step="0.1"
                class="bg-transparent text-[10px] mono text-emerald-400 font-bold w-8 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div class="flex flex-col gap-0.5">
                <button @click="state.thumbnailDuration.value = Math.round(Math.min(5, state.thumbnailDuration.value + 0.1) * 10) / 10" class="text-[8px] text-emerald-400/50 hover:text-emerald-400 transition-colors leading-none">
                  <Icon name="ri:arrow-up-s-fill" />
                </button>
                <button @click="state.thumbnailDuration.value = Math.round(Math.max(0, state.thumbnailDuration.value - 0.1) * 10) / 10" class="text-[8px] text-emerald-400/50 hover:text-emerald-400 transition-colors leading-none">
                  <Icon name="ri:arrow-down-s-fill" />
                </button>
              </div>
              <span class="text-[9px] mono text-emerald-400/60 font-bold ml-0.5">s</span>
            </div>
          </div>
          <input 
            type="range" 
            :value="state.thumbnailDuration.value"
            @input="(e: any) => state.thumbnailDuration.value = parseFloat(e.target.value)"
            min="0.5" max="5" step="0.5" 
            class="w-full accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0.5s</span>
            <span>5s</span>
          </div>
        </div>

        <!-- Horizontal Position Slider -->
        <div v-if="state.thumbnailUrl.value" class="bg-surface-dark/50 border border-surface-border/50 rounded-xl p-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-300">Horizontal Shift</label>
            <div class="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <input 
                type="number" 
                v-model.number="state.thumbnailXOffset.value"
                min="0"
                max="100"
                step="1"
                class="bg-transparent text-[10px] mono text-emerald-400 font-bold w-8 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                @input="state.saveThumbnailConfig()"
              />
              <span class="text-[9px] mono text-emerald-400/60 font-bold">%</span>
            </div>
          </div>
          <input 
            type="range" 
            v-model.number="state.thumbnailXOffset.value"
            min="0" max="100" step="1" 
            class="w-full accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
            @change="state.saveThumbnailConfig()"
          />
          <div class="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>Left</span>
            <span>Center</span>
            <span>Right</span>
          </div>
        </div>

        <!-- Text Overlays Section -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Icon name="ri:text" class="text-sm text-violet-400" />
              Text Overlays
            </label>
            <div class="flex items-center gap-2">
              <button 
                v-if="state.defaultThumbnailStyle.value && state.thumbnailTextOverlays.value.length > 0"
                @click="state.applyDefaultThumbnailStyle()"
                class="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                title="Reset overlay styles to default template"
              >
                <Icon name="ri:refresh-line" class="text-xs" />
                Load Default
              </button>
              <button 
                @click="state.addThumbnailText()"
                class="flex items-center gap-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
              >
                <Icon name="ri:add-line" class="text-xs" />
                Add Text
              </button>
            </div>
          </div>

          <!-- Text Overlay Items -->
          <div 
            v-for="(overlay, idx) in state.thumbnailTextOverlays.value" 
            :key="overlay.id"
            class="bg-surface-dark/50 border border-surface-border/50 rounded-xl flex flex-col overflow-hidden group relative"
          >
            <!-- Overlay Header -->
            <div class="px-4 py-3 border-b border-surface-border/50 flex justify-between items-center bg-white/[0.02]">
              <div class="flex items-center gap-2">
                <Icon name="ri:text" class="text-violet-400 text-sm" />
                <span class="text-[10px] font-bold uppercase tracking-widest text-violet-400">Text {{ idx + 1 }}</span>
              </div>
              <button 
                @click="state.removeThumbnailText(overlay.id)"
                class="text-red-400/50 hover:text-red-400 transition-colors p-1 bg-white/5 hover:bg-red-500/10 rounded"
                title="Delete Text"
              >
                <Icon name="ri:delete-bin-line" class="text-sm" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-2 select-none">
              
              <!-- SECTION 1: CONTENT -->
              <div class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
                   :class="isSectionActive(overlay.id, 'content') ? 'border-sky-500/20 shadow-[0_0_12px_rgba(56,189,248,0.03)]' : 'border-white/5'">
                <button @click="toggleOverlaySection(overlay.id, 'content')" class="w-full px-4 py-2.5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  <span class="flex items-center gap-2"><Icon name="ri:text-wrap" class="text-sky-400 text-xs" /> Content & Transform</span>
                  <Icon name="ri:arrow-down-s-line" class="text-xs transition-transform duration-300" :class="{ 'rotate-180': isSectionActive(overlay.id, 'content') }" />
                </button>
                <div class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                     :class="isSectionActive(overlay.id, 'content') ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                  <div class="overflow-hidden">
                    <div class="p-3 space-y-3 border-t border-white/5">
                      <!-- Text Input -->
                      <textarea 
                        v-model="overlay.text"
                        rows="3"
                        class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500/50 resize-none transition-all"
                        placeholder="Enter text..."
                      ></textarea>
                      <!-- Text Transform -->
                      <div>
                        <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Transform</label>
                        <div class="flex gap-1">
                          <button 
                            v-for="t in ['uppercase', 'lowercase', 'none']" :key="t"
                            @click="overlay.textTransform = t"
                            class="flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all border"
                            :class="overlay.textTransform === t ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-transparent border-white/10 text-slate-500 hover:text-slate-400'"
                          >
                            {{ t === 'none' ? 'Aa' : t === 'uppercase' ? 'AA' : 'aa' }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SECTION 2: TYPOGRAPHY & STYLES -->
              <div class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
                   :class="isSectionActive(overlay.id, 'typography') ? 'border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.03)]' : 'border-white/5'">
                <button @click="toggleOverlaySection(overlay.id, 'typography')" class="w-full px-4 py-2.5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  <span class="flex items-center gap-2"><Icon name="ri:font-size-2" class="text-amber-400 text-xs" /> Typography & Styles</span>
                  <Icon name="ri:arrow-down-s-line" class="text-xs transition-transform duration-300" :class="{ 'rotate-180': isSectionActive(overlay.id, 'typography') }" />
                </button>
                <div class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                     :class="isSectionActive(overlay.id, 'typography') ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                  <div class="overflow-hidden">
                    <div class="p-3 space-y-4 border-t border-white/5">
                      <!-- Font Family -->
                      <div>
                        <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Font Family</label>
                        <select 
                          v-model="overlay.fontFamily"
                          class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                        >
                          <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
                        </select>
                      </div>

                      <!-- Font Size + Weight Row -->
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Size ({{ overlay.fontSize }}px)</label>
                          <input 
                            type="range" v-model.number="overlay.fontSize"
                            min="20" max="200" step="5"
                            class="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <div v-if="!SINGLE_WEIGHT_FONTS.has(overlay.fontFamily)">
                          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Weight ({{ overlay.fontWeight }})</label>
                          <input 
                            type="range" v-model.number="overlay.fontWeight"
                            min="100" max="900" step="100"
                            class="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        <div v-else>
                          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Weight</label>
                          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-black/20 rounded py-1.5 px-3 border border-white/5">
                            Fixed
                          </div>
                        </div>
                      </div>

                      <div class="h-px bg-white/10 w-full rounded-full my-2"></div>

                      <!-- Text Color -->
                      <div>
                        <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Text Color</label>
                        <div class="flex items-center gap-2">
                          <input type="color" v-model="overlay.color" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                          <input type="text" v-model="overlay.color" class="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1 text-xs text-white mono" />
                        </div>
                      </div>

                      <!-- Stroke Toggle -->
                      <div class="flex items-center justify-between py-1">
                        <span class="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Icon name="ri:edit-box-line" class="text-xs" />
                          Enable Stroke
                        </span>
                        <button 
                          @click="overlay.showStroke = !overlay.showStroke"
                          class="relative w-10 h-5 rounded-none transition-colors duration-300"
                          :class="overlay.showStroke ? 'bg-amber-500' : 'bg-white/10'"
                        >
                          <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-none bg-white transition-transform duration-300 shadow-sm"
                               :class="overlay.showStroke ? 'translate-x-5' : 'translate-x-0'"
                          ></div>
                        </button>
                      </div>

                      <!-- Conditional Stroke Settings -->
                      <div v-if="overlay.showStroke" class="space-y-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                        <div>
                          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Stroke Color</label>
                          <div class="flex items-center gap-2">
                            <input type="color" v-model="overlay.strokeColor" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                            <input type="text" v-model="overlay.strokeColor" class="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1 text-xs text-white mono" />
                          </div>
                        </div>
                        <div>
                          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Stroke Width ({{ overlay.strokeWidth }})</label>
                          <input 
                            type="range" v-model.number="overlay.strokeWidth"
                            min="0" max="20" step="1"
                            class="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              <!-- SECTION 4: BACKGROUND BOX -->
              <div class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
                   :class="isSectionActive(overlay.id, 'box') ? 'border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.03)]' : 'border-white/5'">
                <button @click="toggleOverlaySection(overlay.id, 'box')" class="w-full px-4 py-2.5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  <span class="flex items-center gap-2"><Icon name="ri:square-line" class="text-emerald-400 text-xs" /> Background Box</span>
                  <Icon name="ri:arrow-down-s-line" class="text-xs transition-transform duration-300" :class="{ 'rotate-180': isSectionActive(overlay.id, 'box') }" />
                </button>
                <div class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                     :class="isSectionActive(overlay.id, 'box') ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                  <div class="overflow-hidden">
                    <div class="p-3 space-y-3 border-t border-white/5">
                      
                      <!-- Background Toggle -->
                      <div class="flex items-center justify-between py-1">
                        <span class="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                          <Icon name="ri:checkbox-blank-line" class="text-xs" />
                          Enable Box
                        </span>
                        <button 
                          @click="overlay.showBackground = !overlay.showBackground"
                          class="relative w-10 h-5 rounded-none transition-colors duration-300"
                          :class="overlay.showBackground ? 'bg-emerald-500' : 'bg-white/10'"
                        >
                          <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-none bg-white transition-transform duration-300 shadow-sm"
                               :class="overlay.showBackground ? 'translate-x-5' : 'translate-x-0'"
                          ></div>
                        </button>
                      </div>

                      <div v-if="overlay.showBackground" class="space-y-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Box Color</label>
                            <div class="flex items-center gap-2">
                              <input type="color" v-model="overlay.backgroundColor" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                              <input type="text" v-model="overlay.backgroundColor" class="flex-1 bg-black/40 border border-white/10 rounded px-3 py-1 text-[10px] text-white mono" />
                            </div>
                          </div>
                          <div>
                            <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Opacity ({{ (overlay.backgroundOpacity * 100).toFixed(0) }}%)</label>
                            <input 
                              type="range" v-model.number="overlay.backgroundOpacity"
                              min="0" max="1" step="0.1"
                              class="w-full accent-emerald-500 h-1.5 mt-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Padding ({{ overlay.backgroundPadding }}px)</label>
                          <input 
                            type="range" v-model.number="overlay.backgroundPadding"
                            min="0" max="200" step="1"
                            class="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              <!-- SECTION 5: TRANSFORM -->
              <div class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
                   :class="isSectionActive(overlay.id, 'transform') ? 'border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.03)]' : 'border-white/5'">
                <button @click="toggleOverlaySection(overlay.id, 'transform')" class="w-full px-4 py-2.5 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[11px] font-bold uppercase tracking-widest text-slate-300">
                  <span class="flex items-center gap-2"><Icon name="ri:drag-move-2-line" class="text-indigo-400 text-xs" /> Transform & Position</span>
                  <Icon name="ri:arrow-down-s-line" class="text-xs transition-transform duration-300" :class="{ 'rotate-180': isSectionActive(overlay.id, 'transform') }" />
                </button>
                <div class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                     :class="isSectionActive(overlay.id, 'transform') ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'">
                  <div class="overflow-hidden">
                    <div class="p-3 space-y-3 border-t border-white/5">
                      <!-- Rotation -->
                      <div>
                        <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Rotation ({{ overlay.rotation }}°)</label>
                        <input 
                          type="range" v-model.number="overlay.rotation"
                          min="-45" max="45" step="1"
                          class="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <!-- Position -->
                      <div class="flex items-center gap-2 text-[9px] text-slate-400 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                        <Icon name="ri:drag-move-2-line" class="text-xs text-indigo-400" />
                        <span>Drag in preview to position • X:{{ overlay.x }} Y:{{ overlay.y }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Empty state -->
          <div v-if="state.thumbnailTextOverlays.value.length === 0" class="text-center py-6 text-slate-400 border border-dashed border-white/10 rounded-xl">
            <Icon name="ri:text" class="text-2xl mb-2 opacity-50" />
            <p class="text-[9px] uppercase tracking-widest font-bold">No text overlays</p>
            <p class="text-[8px] text-slate-500 mt-1">Click "Add Text" to overlay text on your thumbnail</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FONT_OPTIONS } from '../composables/useClipperState'
const state = useClipperState()

const fontOptions = FONT_OPTIONS

const SINGLE_WEIGHT_FONTS = new Set([
  'Bebas Neue', 'Anton', 'Bangers', 'Permanent Marker', 'Russo One',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
])

// Section state management per overlay
const activeOverlaySections = ref<Record<string, Record<string, boolean>>>({})

function toggleOverlaySection(overlayId: string, section: string) {
  if (!activeOverlaySections.value[overlayId]) {
    activeOverlaySections.value[overlayId] = {
      content: true,
      typography: true,
      box: true,
      transform: true
    }
  }
  activeOverlaySections.value[overlayId][section] = !activeOverlaySections.value[overlayId][section]
}

function isSectionActive(overlayId: string, section: string) {
  if (!activeOverlaySections.value[overlayId]) {
    return true // default to true
  }
  return activeOverlaySections.value[overlayId][section] !== false
}

import { onMounted, onUnmounted } from 'vue'

const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

async function handleSave() {
  await state.saveThumbnailConfig()
  state.showToast('Thumbnail config saved!', 'success')
}

async function handleSaveDefault() {
  isDropdownOpen.value = false
  await state.saveDefaultThumbnailStyle()
}
</script>
