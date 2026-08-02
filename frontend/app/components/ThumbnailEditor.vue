<template>
  <div v-if="state" class="flex flex-col h-full overflow-hidden p-0">
    <!-- Header -->
    <div class="pb-1 mb-3 flex items-center justify-between shrink-0">
      <!-- Title & Switch -->
      <div class="flex items-center gap-2.5">
        <div class="flex items-center gap-1.5">
          <Icon name="ri:image-edit-line" class="text-emerald-400 text-base" />
          <span class="text-xs font-bold text-white tracking-wide">Thumbnail</span>
        </div>
        <!-- Compact Header Toggle Switch -->
        <button 
          @click="state.toggleThumbnail()"
          class="w-8 h-4 rounded-full transition-all relative shrink-0"
          :class="state.thumbnailEnabled.value ? 'bg-emerald-500' : 'bg-white/20'"
          :title="state.thumbnailEnabled.value ? 'Thumbnail Enabled' : 'Thumbnail Disabled'"
        >
          <div 
            class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-200 shadow-sm"
            :class="state.thumbnailEnabled.value ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <div ref="dropdownRef" class="relative flex items-center">
          <div class="flex items-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl overflow-hidden active:scale-95 transition-all h-8">
            <button 
              @click="handleSave" 
              class="h-full px-3 text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-transparent hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors border-r border-emerald-500/30 flex items-center justify-center"
            >
              Save Config
            </button>
            <button 
              @click="isDropdownOpen = !isDropdownOpen"
              class="h-full px-2 text-emerald-400 bg-transparent hover:bg-emerald-500/10 active:bg-emerald-500/20 transition-colors flex items-center justify-center"
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

        <!-- Close Button (X) aligned right -->
        <button 
          @click="emit('close')"
          class="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Close Panel"
        >
          <Icon name="ri:close-line" class="text-base" />
        </button>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-2.5">

      <!-- Screenshot Capture & Overlays -->
      <div v-if="state.thumbnailEnabled.value" class="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">

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
            <div v-if="state.thumbnailUrl.value" class="absolute bottom-1 right-1 bg-black/70 backdrop-blur-md px-1 py-0.5 rounded text-[8px] mono text-emerald-400 font-bold border border-emerald-500/30 z-20">
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
            class="flex-1 h-8 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 active:scale-95 text-[9px] font-black uppercase tracking-wider"
          >
            <Icon :name="state.isCapturingThumbnail.value ? 'ri:loader-4-line' : 'ri:refresh-line'" class="text-sm" :class="{ 'animate-spin': state.isCapturingThumbnail.value }" />
            Random Frame
          </button>
          <button 
            @click="state.captureScreenshot(state.videoTime.value)"
            :disabled="state.isCapturingThumbnail.value"
            class="flex-1 h-8 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 active:scale-95 text-[9px] font-black uppercase tracking-wider"
          >
            <Icon :name="state.isCapturingThumbnail.value ? 'ri:loader-4-line' : 'ri:focus-3-line'" class="text-sm" :class="{ 'animate-spin': state.isCapturingThumbnail.value }" />
            Current Frame
          </button>
          <button 
            v-if="state.thumbnailUrl.value"
            @click="state.deleteThumbnail()"
            :disabled="state.isCapturingThumbnail.value"
            class="h-8 px-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center active:scale-95"
            title="Delete Thumbnail"
          >
            <Icon name="ri:delete-bin-line" class="text-sm" />
          </button>
        </div>

        <!-- Text Overlays Section (Option B Segmented) -->
        <div class="space-y-3 pt-4">
          <!-- Section Header -->
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Icon name="ri:text" class="text-xs text-emerald-400" />
              </div>
              <span class="text-xs font-bold text-white tracking-wide">Text Overlays</span>
              <span v-if="state.thumbnailTextOverlays.value.length > 0" class="text-[9px] mono font-bold text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/5">
                {{ state.thumbnailTextOverlays.value.length }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <button 
                v-if="state.defaultThumbnailStyle.value && state.thumbnailTextOverlays.value.length > 0"
                @click="state.applyDefaultThumbnailStyle()"
                class="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 h-7 px-2.5 rounded-lg text-[9px] font-bold tracking-wider transition-all active:scale-95 hover:text-white"
                title="Reset overlay styles to default template"
              >
                <Icon name="ri:refresh-line" class="text-xs text-slate-400" />
                <span>Default Style</span>
              </button>
              <button 
                @click="handleAddTextOverlay()"
                class="flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 h-7 px-3 rounded-lg text-[9px] font-bold tracking-wider transition-all active:scale-95 shadow-sm"
              >
                <Icon name="ri:add-line" class="text-xs" />
                <span>Add Text</span>
              </button>
            </div>
          </div>

          <!-- Segmented Overlay Selector Bar (Option B) -->
          <div v-if="state.thumbnailTextOverlays.value.length > 0" class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar-horizontal select-none">
            <button 
              v-for="(overlay, idx) in state.thumbnailTextOverlays.value" 
              :key="overlay.id"
              @click="activeOverlayId = overlay.id"
              class="h-7 px-2.5 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1.5 shrink-0 active:scale-95 shadow-sm max-w-[130px]"
              :class="(activeOverlayId === overlay.id || (!activeOverlayId && idx === 0))
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10 font-extrabold' 
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'"
              :title="overlay.text || `Text ${Number(idx) + 1}`"
            >
              <div 
                class="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                :style="{ backgroundColor: overlay.color || '#ffffff' }"
              />
              <span class="truncate">#{{ Number(idx) + 1 }} {{ getOverlayLabel(overlay, idx) }}</span>
            </button>
          </div>

          <!-- Active Overlay Editing Card -->
          <div 
            v-if="activeOverlay" 
            class="bg-surface-dark/60 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-lg select-none"
          >
            <!-- Card Header: Title + Snippet + Delete Button -->
            <div class="flex justify-between items-center pb-2 border-b border-white/5">
              <div class="flex items-center gap-2 min-w-0 pr-2">
                <div 
                  class="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-sm"
                  :style="{ backgroundColor: activeOverlay.color || '#ffffff' }"
                />
                <span class="text-xs font-extrabold text-white tracking-wide">Text {{ activeOverlayIndex + 1 }}</span>
                <span v-if="activeOverlay.text" class="text-[10px] text-slate-400 truncate italic max-w-[160px]">
                  "{{ activeOverlay.text }}"
                </span>
                <span v-else class="text-[10px] text-slate-600 italic">Empty</span>
              </div>
              
              <button 
                @click="handleRemoveTextOverlay(activeOverlay.id)"
                class="text-slate-400 hover:text-red-400 transition-colors px-2 py-1 hover:bg-red-500/10 rounded-lg flex items-center gap-1 text-[9px] font-bold"
                title="Delete Text Overlay"
              >
                <Icon name="ri:delete-bin-line" class="text-xs" />
                <span>Delete</span>
              </button>
            </div>

            <!-- Quick Style Presets (Visual Badge Chips) -->
            <div class="space-y-1">
              <span class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Quick Style Presets</span>
              <div class="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar-horizontal">
                <button 
                  v-for="preset in QUICK_PRESETS" :key="preset.name"
                  @click="applyPreset(activeOverlay, preset)"
                  class="px-2.5 py-1 rounded-lg text-[9px] font-bold border whitespace-nowrap active:scale-95 transition-all shadow-sm flex items-center gap-1"
                  :class="preset.previewClass"
                >
                  <span>{{ preset.name }}</span>
                </button>
              </div>
            </div>

            <!-- Mini Tabs Navigation (Segmented Control Bar) -->
            <div class="flex bg-white/5 rounded-xl p-0.5 gap-0.5 border border-white/5">
              <button 
                v-for="t in [
                  { id: 'text', icon: 'ri:text-wrap', label: 'Text' },
                  { id: 'style', icon: 'ri:font-size-2', label: 'Style' },
                  { id: 'box', icon: 'ri:square-line', label: 'Box' },
                  { id: 'layout', icon: 'ri:drag-move-2-line', label: 'Layout' }
                ]" :key="t.id"
                @click="setActiveTab(activeOverlay.id, t.id)"
                class="flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                :class="getActiveTab(activeOverlay.id) === t.id ? 'bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30 shadow-sm' : 'text-slate-400 hover:text-white'"
              >
                <Icon :name="t.icon" class="text-xs" />
                <span>{{ t.label }}</span>
              </button>
            </div>

            <!-- Tab Contents -->
            <div class="pt-1">
              <!-- Text Tab Content -->
              <div v-if="getActiveTab(activeOverlay.id) === 'text'" class="space-y-3 animate-in fade-in duration-150 w-full">
                <div>
                  <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1">Content</label>
                  <textarea 
                    v-model="activeOverlay.text"
                    rows="3"
                    class="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-emerald-500/50 resize-none transition-all placeholder:text-slate-600"
                    placeholder="Type text overlay content here..."
                  ></textarea>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500 shrink-0">Capitalization</label>
                  <div class="flex gap-1 flex-1">
                    <button 
                      v-for="t in ['uppercase', 'lowercase', 'capitalize', 'none']" :key="t"
                      @click="applyTextTransform(activeOverlay, t)"
                      class="flex-1 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border"
                      :class="activeOverlay.textTransform === t ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'"
                    >
                      {{ t === 'none' ? 'None' : t === 'uppercase' ? 'AA' : t === 'lowercase' ? 'aa' : 'Aa' }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Style Tab Content -->
              <div v-else-if="getActiveTab(activeOverlay.id) === 'style'" class="space-y-3 animate-in fade-in duration-150 w-full">
                <div>
                  <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1">Font Family</label>
                  <div class="relative">
                    <select 
                      v-model="activeOverlay.fontFamily"
                      class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer pr-8"
                    >
                      <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
                    </select>
                    <Icon name="ri:arrow-down-s-line" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <div class="flex justify-between items-center mb-1">
                      <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Size</label>
                      <span class="text-[9px] mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{{ activeOverlay.fontSize }}px</span>
                    </div>
                    <input 
                      type="range" v-model.number="activeOverlay.fontSize"
                      min="20" max="200" step="5"
                      class="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div v-if="!SINGLE_WEIGHT_FONTS.has(activeOverlay.fontFamily)">
                    <div class="flex justify-between items-center mb-1">
                      <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Weight</label>
                      <span class="text-[9px] mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{{ activeOverlay.fontWeight }}</span>
                    </div>
                    <input 
                      type="range" v-model.number="activeOverlay.fontWeight"
                      min="100" max="900" step="100"
                      class="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div v-else>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1">Weight</label>
                    <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider bg-white/5 rounded-lg py-1 px-2 border border-white/5">
                      Fixed Weight
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1">Text Color</label>
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-xl overflow-hidden border border-white/10 relative shrink-0">
                      <input type="color" v-model="activeOverlay.color" class="w-12 h-12 -top-2 -left-2 absolute cursor-pointer bg-transparent border-none" />
                    </div>
                    <input type="text" v-model="activeOverlay.color" class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1 text-xs text-white mono focus:outline-none focus:border-emerald-500/50" />
                  </div>
                </div>

                <div class="pt-2 border-t border-white/5">
                  <div class="flex items-center justify-between">
                    <span class="text-[9px] font-bold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                      <Icon name="ri:edit-box-line" class="text-xs text-emerald-400" /> Enable Stroke
                    </span>
                    <button 
                      @click="activeOverlay.showStroke = !activeOverlay.showStroke"
                      class="relative w-10 h-5 rounded-full transition-colors duration-300"
                      :class="activeOverlay.showStroke ? 'bg-emerald-500' : 'bg-white/10'"
                    >
                      <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-md"
                           :class="activeOverlay.showStroke ? 'translate-x-5' : 'translate-x-0'"
                      ></div>
                    </button>
                  </div>
                  <div v-if="activeOverlay.showStroke" class="space-y-3 pt-3 animate-in fade-in duration-150">
                    <div>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1">Stroke Color</label>
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl overflow-hidden border border-white/10 relative shrink-0">
                          <input type="color" v-model="activeOverlay.strokeColor" class="w-12 h-12 -top-2 -left-2 absolute cursor-pointer bg-transparent border-none" />
                        </div>
                        <input type="text" v-model="activeOverlay.strokeColor" class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1 text-xs text-white mono focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                    <div>
                      <div class="flex justify-between items-center mb-1">
                        <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Stroke Width</label>
                        <span class="text-[9px] mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{{ activeOverlay.strokeWidth }}px</span>
                      </div>
                      <input 
                        type="range" v-model.number="activeOverlay.strokeWidth"
                        min="0" max="20" step="1"
                        class="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Box Tab Content -->
              <div v-else-if="getActiveTab(activeOverlay.id) === 'box'" class="space-y-3 animate-in fade-in duration-150 w-full">
                <div class="flex items-center justify-between">
                  <span class="text-[9px] font-bold uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
                    <Icon name="ri:checkbox-blank-line" class="text-xs text-emerald-400" /> Enable Background Box
                  </span>
                  <button 
                    @click="activeOverlay.showBackground = !activeOverlay.showBackground"
                    class="relative w-10 h-5 rounded-full transition-colors duration-300"
                    :class="activeOverlay.showBackground ? 'bg-emerald-500' : 'bg-white/10'"
                  >
                    <div class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-md"
                         :class="activeOverlay.showBackground ? 'translate-x-5' : 'translate-x-0'"
                    ></div>
                  </button>
                </div>
                <div v-if="activeOverlay.showBackground" class="space-y-3 pt-2 border-t border-white/5 animate-in fade-in duration-150">
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1">Box Color</label>
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl overflow-hidden border border-white/10 relative shrink-0">
                          <input type="color" v-model="activeOverlay.backgroundColor" class="w-12 h-12 -top-2 -left-2 absolute cursor-pointer bg-transparent border-none" />
                        </div>
                        <input type="text" v-model="activeOverlay.backgroundColor" class="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white mono focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                    <div>
                      <div class="flex justify-between items-center mb-1">
                        <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Opacity</label>
                        <span class="text-[9px] mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{{ ((activeOverlay.backgroundOpacity ?? 0.7) * 100).toFixed(0) }}%</span>
                      </div>
                      <input 
                        type="range" v-model.number="activeOverlay.backgroundOpacity"
                        min="0" max="1" step="0.1"
                        class="w-full accent-emerald-500 h-1.5 mt-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between items-center mb-1">
                      <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Padding</label>
                      <span class="text-[9px] mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{{ activeOverlay.backgroundPadding }}px</span>
                    </div>
                    <input 
                      type="range" v-model.number="activeOverlay.backgroundPadding"
                      min="0" max="200" step="1"
                      class="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <!-- Layout Tab Content -->
              <div v-else-if="getActiveTab(activeOverlay.id) === 'layout'" class="space-y-3 animate-in fade-in duration-150 w-full">
                <div>
                  <div class="flex justify-between items-center mb-1">
                    <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500">Rotation</label>
                    <div class="flex items-center gap-1.5">
                      <span class="text-[9px] mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{{ activeOverlay.rotation }}°</span>
                      <button @click="activeOverlay.rotation = 0" class="text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/5 transition-colors">
                        Reset
                      </button>
                    </div>
                  </div>
                  <input 
                    type="range" v-model.number="activeOverlay.rotation"
                    min="-45" max="45" step="1"
                    class="w-full accent-emerald-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div class="flex items-center gap-2 text-[9px] text-slate-300 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
                  <Icon name="ri:drag-move-2-line" class="text-xs text-emerald-400" />
                  <span>Drag overlay in video canvas to position (X: {{ activeOverlay.x }}%, Y: {{ activeOverlay.y }}%)</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Empty State -->
          <div v-if="state.thumbnailTextOverlays.value.length === 0" class="text-center py-8 px-4 text-slate-400 border border-dashed border-white/15 rounded-2xl bg-surface-dark/30 flex flex-col items-center justify-center">
            <div class="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mb-2.5 border border-white/10">
              <Icon name="ri:text" class="text-lg text-slate-400" />
            </div>
            <p class="text-[10px] uppercase tracking-widest font-bold text-white mb-1">No Text Overlays Added</p>
            <p class="text-[9px] text-slate-500 max-w-[200px] mb-3">Add text overlays to render custom headings on your thumbnail frame</p>
            <button 
              @click="handleAddTextOverlay()"
              class="flex items-center gap-1.5 bg-emerald-500 text-black px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wider hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
            >
              <Icon name="ri:add-line" class="text-sm" />
              <span>Add First Text Overlay</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Thumbnail Disabled Empty State Container -->
      <div v-else class="h-full flex flex-col items-center justify-center text-center p-6 bg-surface-dark/30 border border-dashed border-white/10 rounded-2xl animate-in fade-in duration-200 min-h-[320px]">
        <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-slate-400 shadow-inner">
          <Icon name="ri:image-line" class="text-xl" />
        </div>
        <h4 class="text-xs font-bold text-white mb-1 tracking-wide">Thumbnail Frame Disabled</h4>
        <p class="text-[10px] text-slate-400 max-w-[220px] mb-4 leading-relaxed">
          Enable thumbnail frame to prepend a cover frame image and overlay custom text headings at the start of your clip.
        </p>
        <button 
          @click="state.toggleThumbnail()"
          class="flex items-center gap-1.5 bg-emerald-500 text-black px-4 py-2 rounded-xl text-[10px] font-extrabold tracking-wider hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-emerald-500/10"
        >
          <Icon name="ri:power-flash-line" class="text-sm" />
          <span>Enable Thumbnail</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
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

// Segmented Overlay Selector State (Option B with VideoPreview canvas click sync)
const activeOverlayId = computed({
  get: () => state?.activeThumbnailTextId?.value || null,
  set: (val: string | null) => {
    if (state?.activeThumbnailTextId) {
      state.activeThumbnailTextId.value = val
    }
  }
})

// Auto-select first overlay if none is currently selected
watch(() => state.thumbnailTextOverlays.value, (newOverlays) => {
  if (newOverlays && newOverlays.length > 0) {
    const exists = newOverlays.some((o: any) => o.id === state.activeThumbnailTextId.value)
    if (!exists && newOverlays[0]?.id) {
      state.activeThumbnailTextId.value = newOverlays[0].id
    }
  } else if (state?.activeThumbnailTextId) {
    state.activeThumbnailTextId.value = null
  }
}, { immediate: true })

const activeOverlay = computed(() => {
  if (!state?.thumbnailTextOverlays?.value?.length) return null
  return state.thumbnailTextOverlays.value.find((o: any) => o.id === activeOverlayId.value) || state.thumbnailTextOverlays.value[0] || null
})

const activeOverlayIndex = computed(() => {
  const currentId = activeOverlay.value?.id
  if (!currentId || !state?.thumbnailTextOverlays?.value) return -1
  return state.thumbnailTextOverlays.value.findIndex((o: any) => o.id === currentId)
})

function getOverlayLabel(overlay: any, idx: number): string {
  if (!overlay.text || !overlay.text.trim()) {
    return 'Text'
  }
  const trimmed = overlay.text.trim()
  return trimmed.length > 6 ? `${trimmed.slice(0, 6)}...` : trimmed
}

function handleAddTextOverlay() {
  state.addThumbnailText()
  if (state.thumbnailTextOverlays.value.length > 0) {
    const newlyAdded = state.thumbnailTextOverlays.value[state.thumbnailTextOverlays.value.length - 1]
    if (newlyAdded?.id) {
      activeOverlayId.value = newlyAdded.id
    }
  }
}

function handleRemoveTextOverlay(id: string) {
  state.removeThumbnailText(id)
  if (activeOverlayId.value === id) {
    activeOverlayId.value = state.thumbnailTextOverlays.value[0]?.id || null
  }
}

// Mini-tabs state management per overlay
const activeOverlayTabs = ref<Record<string, 'text' | 'style' | 'box' | 'layout'>>({})
const expandedOverlays = ref<Record<string, boolean>>({})

function toggleOverlayExpand(id: string) {
  expandedOverlays.value[id] = !isOverlayExpanded(id)
}

function isOverlayExpanded(id: string): boolean {
  if (expandedOverlays.value[id] === undefined) {
    expandedOverlays.value[id] = true
  }
  return expandedOverlays.value[id]
}

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
    previewClass: 'bg-white text-black border-white',
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
    previewClass: 'bg-[#CFFF50] text-black border-[#CFFF50]',
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
    previewClass: 'bg-zinc-800 text-white border-zinc-700',
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
    previewClass: 'bg-red-500 text-white border-red-400',
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
    previewClass: 'bg-emerald-500 text-black border-emerald-400 font-bold',
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


const emit = defineEmits(['close'])
const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (state?.thumbnailEnabled?.value) {
    state.thumbnailEditMode.value = true
  }
})

watch(() => state?.thumbnailEnabled?.value, (enabled) => {
  if (enabled) {
    state.thumbnailEditMode.value = true
  } else {
    state.thumbnailEditMode.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (state?.thumbnailEditMode) {
    state.thumbnailEditMode.value = false
  }
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
