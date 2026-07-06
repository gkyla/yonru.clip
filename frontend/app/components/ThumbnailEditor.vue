<template>
  <div v-if="state" class="flex flex-col h-full overflow-hidden p-1.5">
    <!-- Header -->
    <div class="border-b border-white/10 pb-4 mb-4 flex flex-col gap-3.5 shrink-0">
      <!-- Top Row: Badge & Save Action -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_2px_10px_rgba(16,185,129,0.02)]">
            <Icon name="ri:image-edit-line" />
            THUMBNAIL #{{ String((activeHookIndex >= 0 ? activeHookIndex : 0) + 1).padStart(2, '0') }}
          </span>
          <span class="mono text-[10px] text-slate-500 font-bold tracking-wider">
            Active Hook
          </span>
        </div>
        <div ref="dropdownRef" class="relative flex items-center">
          <!-- Unified Wrapper for button-radius, border and scale feedback consistency -->
          <div class="flex items-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl overflow-hidden active:scale-95 transition-all h-8">
            <button 
              @click="handleSave" 
              class="h-full px-3.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-transparent hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors border-r border-emerald-500/30 flex items-center justify-center"
            >
              Save Config
            </button>
            <button 
              @click="isDropdownOpen = !isDropdownOpen"
              class="h-full px-2 text-emerald-400 bg-transparent hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors flex items-center justify-center h-full"
              title="More save options"
            >
              <Icon name="ri:arrow-down-s-line" class="text-sm transition-transform duration-300" :class="{ 'rotate-180': isDropdownOpen }" />
            </button>
          </div>

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
      
      <!-- Bottom Row: Info Description -->
      <div class="relative flex items-center w-full">
        <p class="text-xs text-slate-300 leading-relaxed italic">
          Configuring still image prepended to "{{ state?.activeHook?.value?.theme || 'Untitled Hook' }}".
        </p>
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

        <!-- Two Column Layout: Preview on Left, Sliders on Right -->
        <div class="flex gap-3">
          <!-- Left: Screenshot Preview -->
          <div class="w-[95px] shrink-0 relative rounded-xl overflow-hidden border border-surface-border/50 bg-black aspect-[9/16] h-[170px]">
            <img 
              v-if="state.thumbnailUrl.value" 
              :src="state.thumbnailUrl.value" 
              class="w-full h-full object-cover"
              :style="{ objectPosition: `${state.thumbnailXOffset.value}% center` }"
              @error="state.thumbnailUrl.value = null"
            />
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-slate-400">
              <Icon name="ri:image-add-line" class="text-2xl mb-1" />
              <span class="text-[8px] uppercase tracking-widest font-bold">No Frame</span>
            </div>
            <!-- Screenshot time badge -->
            <div v-if="state.thumbnailUrl.value" class="absolute bottom-1 right-1 bg-black/70 backdrop-blur-md px-1 py-0.5 rounded text-[8px] mono text-emerald-400 font-bold border border-emerald-500/30">
              {{ state.thumbnailScreenshotTime.value.toFixed(1) }}s
            </div>
          </div>

          <!-- Right: Sliders Stacked -->
          <div class="flex-1 flex flex-col justify-between h-[170px]">
            <!-- Duration Slider -->
            <div class="bg-surface-dark/50 border border-surface-border/50 rounded-xl p-2.5 flex-1 flex flex-col justify-center">
              <div class="flex justify-between items-center mb-1">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-300">Duration</label>
                <div class="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <input 
                    type="number" 
                    v-model.number="state.thumbnailDuration.value"
                    min="0"
                    max="5"
                    step="0.1"
                    class="bg-transparent text-[9px] mono text-emerald-400 font-bold w-6 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div class="flex flex-col gap-0.5">
                    <button @click="state.thumbnailDuration.value = Math.round(Math.min(5, state.thumbnailDuration.value + 0.1) * 10) / 10" class="text-[6px] text-emerald-400/50 hover:text-emerald-400 transition-colors leading-none">
                      <Icon name="ri:arrow-up-s-fill" />
                    </button>
                    <button @click="state.thumbnailDuration.value = Math.round(Math.max(0, state.thumbnailDuration.value - 0.1) * 10) / 10" class="text-[6px] text-emerald-400/50 hover:text-emerald-400 transition-colors leading-none">
                      <Icon name="ri:arrow-down-s-fill" />
                    </button>
                  </div>
                  <span class="text-[10px] mono text-emerald-400/60 font-bold">s</span>
                </div>
              </div>
              <input 
                type="range" 
                :value="state.thumbnailDuration.value"
                @input="(e: any) => state.thumbnailDuration.value = parseFloat(e.target.value)"
                min="0.5" max="5" step="0.5" 
                class="w-full accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-slate-300 mt-1">
                <span>0.5s</span>
                <span>5s</span>
              </div>
            </div>

            <!-- Spacer between the two boxes -->
            <div class="h-2"></div>

            <!-- Horizontal Position Slider -->
            <div class="bg-surface-dark/50 border border-surface-border/50 rounded-xl p-2.5 flex-1 flex flex-col justify-center" :class="{ 'opacity-50': !state.thumbnailUrl.value }">
              <div class="flex justify-between items-center mb-1">
                <label class="text-[9px] font-black uppercase tracking-widest text-slate-300">Shift</label>
                <div class="flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <input 
                    type="number" 
                    v-model.number="state.thumbnailXOffset.value"
                    min="0"
                    max="100"
                    step="1"
                    :disabled="!state.thumbnailUrl.value"
                    class="bg-transparent text-[9px] mono text-emerald-400 font-bold w-6 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:cursor-not-allowed"
                    @input="state.saveThumbnailConfig()"
                  />
                  <span class="text-[10px] mono text-emerald-400/60 font-bold">%</span>
                </div>
              </div>
              <input 
                type="range" 
                v-model.number="state.thumbnailXOffset.value"
                min="0" max="100" step="1" 
                :disabled="!state.thumbnailUrl.value"
                class="w-full accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                @change="state.saveThumbnailConfig()"
              />
              <div class="flex justify-between text-[10px] text-slate-300 mt-1">
                <span>L</span>
                <span>C</span>
                <span>R</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Capture & Delete Buttons -->
        <div class="flex gap-3">
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

        <!-- Text Overlays Section -->
        <div class="space-y-3 pt-5 ">
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
                Load Default Style
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
                <span class="text-[10px] font-bold uppercase tracking-widest text-violet-400">Text {{ Number(idx) + 1 }}</span>
              </div>
              <button 
                @click="state.removeThumbnailText(overlay.id)"
                class="text-red-400/50 hover:text-red-400 transition-colors p-1 bg-white/5 hover:bg-red-500/10 rounded"
                title="Delete Text"
              >
                <Icon name="ri:delete-bin-line" class="text-sm" />
              </button>
            </div>

            <div class="p-3.5 space-y-3.5 select-none">
              <!-- Quick Style Presets Bar -->
              <div class="flex flex-col gap-1.5 bg-black/20 p-2 rounded-xl border border-white/5">
                <span class="text-[8px] font-black uppercase tracking-widest text-slate-500">Quick Presets</span>
                <div class="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar-horizontal">
                  <button 
                    v-for="preset in QUICK_PRESETS" :key="preset.name"
                    @click="applyPreset(overlay, preset)"
                    class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white text-[9px] font-bold border border-white/5 whitespace-nowrap active:scale-95 transition-all"
                  >
                    {{ preset.name }}
                  </button>
                </div>
              </div>

              <!-- Mini Tabs Navigation Bar -->
              <div class="flex bg-black/40 border border-white/5 rounded-xl p-1 gap-1">
                <button 
                  v-for="t in [
                    { id: 'text', icon: 'ri:text-wrap', label: 'Text' },
                    { id: 'style', icon: 'ri:font-size-2', label: 'Style' },
                    { id: 'box', icon: 'ri:square-line', label: 'Box' },
                    { id: 'layout', icon: 'ri:drag-move-2-line', label: 'Layout' }
                  ]" :key="t.id"
                  @click="setActiveTab(overlay.id, t.id)"
                  class="flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-200 flex items-center justify-center gap-1 border border-transparent"
                  :class="getActiveTab(overlay.id) === t.id ? 'bg-white/10 text-violet-400 border-white/10 shadow-sm' : 'text-slate-400 hover:text-white'"
                >
                  <Icon :name="t.icon" class="text-xs" />
                  <span>{{ t.label }}</span>
                </button>
              </div>

              <!-- Tab Contents -->
              <div class="bg-black/20 border border-white/5 rounded-xl p-3.5 space-y-3.5 min-h-[140px] flex flex-col justify-center">
                <!-- Text Tab Content -->
                <div v-if="getActiveTab(overlay.id) === 'text'" class="space-y-3 animate-in fade-in duration-200 w-full">
                  <textarea 
                    v-model="overlay.text"
                    rows="3"
                    class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500/50 resize-none transition-all"
                    placeholder="Enter text..."
                  ></textarea>
                  <div>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Transform</label>
                    <div class="flex gap-1">
                      <button 
                        v-for="t in ['uppercase', 'lowercase', 'capitalize', 'none']" :key="t"
                        @click="applyTextTransform(overlay, t)"
                        class="flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all border"
                        :class="overlay.textTransform === t ? 'bg-violet-500/20 border-violet-500/40 text-violet-400' : 'bg-transparent border-white/10 text-slate-500 hover:text-slate-400'"
                      >
                        {{ t === 'none' ? 'None' : t === 'uppercase' ? 'AA' : t === 'lowercase' ? 'aa' : 'Aa' }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Style Tab Content -->
                <div v-else-if="getActiveTab(overlay.id) === 'style'" class="space-y-3 animate-in fade-in duration-200 w-full">
                  <div>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Font Family</label>
                    <select 
                      v-model="overlay.fontFamily"
                      class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
                    >
                      <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
                    </select>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Size ({{ overlay.fontSize }}px)</label>
                      <input 
                        type="range" v-model.number="overlay.fontSize"
                        min="20" max="200" step="5"
                        class="w-full accent-violet-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div v-if="!SINGLE_WEIGHT_FONTS.has(overlay.fontFamily)">
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Weight ({{ overlay.fontWeight }})</label>
                      <input 
                        type="range" v-model.number="overlay.fontWeight"
                        min="100" max="900" step="100"
                        class="w-full accent-violet-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    <div v-else>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Weight</label>
                      <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-black/20 rounded py-1 px-2 border border-white/5">
                        Fixed
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Text Color</label>
                    <div class="flex items-center gap-2">
                      <input type="color" v-model="overlay.color" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                      <input type="text" v-model="overlay.color" class="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white mono" />
                    </div>
                  </div>
                  <div class="flex items-center justify-between py-1">
                    <span class="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Icon name="ri:edit-box-line" class="text-xs" /> Enable Stroke
                    </span>
                    <button 
                      @click="overlay.showStroke = !overlay.showStroke"
                      class="relative w-10 h-5 rounded-none transition-colors duration-300"
                      :class="overlay.showStroke ? 'bg-violet-500' : 'bg-white/10'"
                    >
                      <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-none bg-white transition-transform duration-300 shadow-sm"
                           :class="overlay.showStroke ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </button>
                  </div>
                  <div v-if="overlay.showStroke" class="space-y-3 bg-black/20 p-2.5 rounded-lg border border-white/5 animate-in fade-in duration-200">
                    <div>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Stroke Color</label>
                      <div class="flex items-center gap-2">
                        <input type="color" v-model="overlay.strokeColor" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                        <input type="text" v-model="overlay.strokeColor" class="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white mono" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Stroke Width ({{ overlay.strokeWidth }})</label>
                      <input 
                        type="range" v-model.number="overlay.strokeWidth"
                        min="0" max="20" step="1"
                        class="w-full accent-violet-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <!-- Box Tab Content -->
                <div v-else-if="getActiveTab(overlay.id) === 'box'" class="space-y-3 animate-in fade-in duration-200 w-full">
                  <div class="flex items-center justify-between py-1">
                    <span class="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Icon name="ri:checkbox-blank-line" class="text-xs" /> Enable Box
                    </span>
                    <button 
                      @click="overlay.showBackground = !overlay.showBackground"
                      class="relative w-10 h-5 rounded-none transition-colors duration-300"
                      :class="overlay.showBackground ? 'bg-violet-500' : 'bg-white/10'"
                    >
                      <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-none bg-white transition-transform duration-300 shadow-sm"
                           :class="overlay.showBackground ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </button>
                  </div>
                  <div v-if="overlay.showBackground" class="space-y-3 bg-black/20 p-2.5 rounded-lg border border-white/5 animate-in fade-in duration-200">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Box Color</label>
                        <div class="flex items-center gap-2">
                          <input type="color" v-model="overlay.backgroundColor" class="w-8 h-8 rounded cursor-pointer bg-transparent border-none" />
                          <input type="text" v-model="overlay.backgroundColor" class="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white mono" />
                        </div>
                      </div>
                      <div>
                        <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Opacity ({{ ((overlay.backgroundOpacity ?? 0.7) * 100).toFixed(0) }}%)</label>
                        <input 
                          type="range" v-model.number="overlay.backgroundOpacity"
                          min="0" max="1" step="0.1"
                          class="w-full accent-violet-500 h-1.5 mt-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                    <div>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Padding ({{ overlay.backgroundPadding }}px)</label>
                      <input 
                        type="range" v-model.number="overlay.backgroundPadding"
                        min="0" max="200" step="1"
                        class="w-full accent-violet-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <!-- Layout Tab Content -->
                <div v-else-if="getActiveTab(overlay.id) === 'layout'" class="space-y-3 animate-in fade-in duration-200 w-full">
                  <div>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Rotation ({{ overlay.rotation }}°)</label>
                    <input 
                      type="range" v-model.number="overlay.rotation"
                      min="-45" max="45" step="1"
                      class="w-full accent-violet-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div class="flex items-center gap-2 text-[9px] text-slate-400 bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                    <Icon name="ri:drag-move-2-line" class="text-xs text-violet-400" />
                    <span>Drag in preview to position • X:{{ overlay.x }} Y:{{ overlay.y }}</span>
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
import { ref, computed } from 'vue'
import { FONT_OPTIONS } from '../composables/useClipperState'
const state = useClipperState()

const activeHookIndex = computed(() => {
  if (!state?.activeHook?.value) return -1
  const active = state.activeHook.value
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end
  
  // Search in generated hooks first
  let idx = state.hooks?.value?.findIndex((h: any) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })
  
  if (idx !== -1 && idx !== undefined) return idx
  
  // Search in saved hooks
  idx = state.savedHooks?.value?.findIndex((h: any) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })
  
  return idx !== undefined ? idx : -1
})

const fontOptions = FONT_OPTIONS

const SINGLE_WEIGHT_FONTS = new Set([
  'Bebas Neue', 'Anton', 'Bangers', 'Permanent Marker', 'Russo One',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
])

// Mini-tabs state management per overlay
const activeOverlayTabs = ref<Record<string, 'text' | 'style' | 'box' | 'layout'>>({})

function getActiveTab(overlayId: string): 'text' | 'style' | 'box' | 'layout' {
  if (!activeOverlayTabs.value[overlayId]) {
    activeOverlayTabs.value[overlayId] = 'text'
  }
  return activeOverlayTabs.value[overlayId]
}

function setActiveTab(overlayId: string, tab: 'text' | 'style' | 'box' | 'layout') {
  activeOverlayTabs.value[overlayId] = tab
}

const QUICK_PRESETS = [
  {
    name: 'Solid White',
    style: {
      color: '#ffffff',
      showStroke: true,
      strokeColor: '#000000',
      strokeWidth: 6,
      showBackground: false
    }
  },
  {
    name: 'Accent Yellow',
    style: {
      color: '#CFFF50',
      showStroke: true,
      strokeColor: '#000000',
      strokeWidth: 6,
      showBackground: false
    }
  },
  {
    name: 'Dark Box',
    style: {
      color: '#ffffff',
      showStroke: false,
      showBackground: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      backgroundPadding: 16
    }
  },
  {
    name: 'Crimson Box',
    style: {
      color: '#ffffff',
      showStroke: false,
      showBackground: true,
      backgroundColor: '#ef4444',
      backgroundOpacity: 0.9,
      backgroundPadding: 16
    }
  },
  {
    name: 'Emerald Box',
    style: {
      color: '#ffffff',
      showStroke: false,
      showBackground: true,
      backgroundColor: '#10b981',
      backgroundOpacity: 0.9,
      backgroundPadding: 16
    }
  }
]

function applyPreset(overlay: any, preset: typeof QUICK_PRESETS[0]) {
  Object.assign(overlay, preset.style)
}

function applyTextTransform(overlay: any, mode: string) {
  overlay.textTransform = mode
  if (!overlay.text) return
  if (mode === 'uppercase') {
    overlay.text = overlay.text.toUpperCase()
  } else if (mode === 'lowercase') {
    overlay.text = overlay.text.toLowerCase()
  } else if (mode === 'capitalize') {
    overlay.text = overlay.text.toLowerCase().replace(/\b\w/g, (char: string) => char.toUpperCase())
  }
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
