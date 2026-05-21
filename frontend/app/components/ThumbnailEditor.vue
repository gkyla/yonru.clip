<template>
  <div v-if="state" class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="border-b border-surface-border/50 pb-4 mb-4 flex justify-between items-start">
      <div>
        <h3 class="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1 flex items-center gap-2">
          <Icon name="ri:image-edit-line" class="text-sm" /> Thumbnail Editor
        </h3>
        <p class="text-[9px] text-slate-500 max-w-[250px]">
          Auto-generate a thumbnail frame prepended to your clip for YouTube Shorts.
        </p>
      </div>
      <button 
        @click="handleSave" 
        class="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-lg active:scale-95"
      >
        Save Config
      </button>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">

      <!-- Enable Toggle -->
      <div class="flex items-center justify-between bg-surface-dark/50 border border-surface-border/50 rounded-xl px-4 py-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" :class="state.thumbnailEnabled.value ? 'bg-emerald-500/20' : 'bg-white/5'">
            <Icon name="ri:image-line" class="text-lg" :class="state.thumbnailEnabled.value ? 'text-emerald-400' : 'text-slate-600'" />
          </div>
          <div>
            <span class="text-xs font-bold text-white">Thumbnail Frame</span>
            <p class="text-[9px] text-slate-500">Prepend still image at start of video</p>
          </div>
        </div>
        <button 
          @click="state.toggleThumbnail()"
          class="w-10 h-5 rounded-none transition-all relative"
          :class="state.thumbnailEnabled.value ? 'bg-emerald-500' : 'bg-white/10'"
        >
          <div 
            class="w-4 h-4 rounded-none bg-white shadow absolute top-0.5 transition-all"
            :class="state.thumbnailEnabled.value ? 'left-5.5' : 'left-0.5'"
          />
        </button>
      </div>

      <!-- Screenshot Capture -->
      <div v-if="state.thumbnailEnabled.value" class="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
        
        <!-- Screenshot Preview -->
        <div class="relative rounded-xl overflow-hidden border border-surface-border/50 bg-black aspect-[9/16] max-h-[200px]">
          <img 
            v-if="state.thumbnailUrl.value" 
            :src="state.thumbnailUrl.value" 
            class="w-full h-full object-cover"
            @error="state.thumbnailUrl.value = null"
          />
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-slate-600">
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
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500">Duration</label>
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
          <div class="flex justify-between text-[8px] text-slate-600 mt-1">
            <span>0.5s</span>
            <span>5s</span>
          </div>
        </div>

        <!-- Horizontal Position Slider -->
        <div v-if="state.thumbnailUrl.value" class="bg-surface-dark/50 border border-surface-border/50 rounded-xl p-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500">Horizontal Shift</label>
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
          <div class="flex justify-between text-[8px] text-slate-600 mt-1">
            <span>Left</span>
            <span>Center</span>
            <span>Right</span>
          </div>
        </div>

        <!-- Text Overlays Section -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Icon name="ri:text" class="text-sm text-violet-400" />
              Text Overlays
            </label>
            <button 
              @click="state.addThumbnailText()"
              class="flex items-center gap-1.5 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/30 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
            >
              <Icon name="ri:add-line" class="text-xs" />
              Add Text
            </button>
          </div>

          <!-- Text Overlay Items -->
          <div 
            v-for="(overlay, idx) in state.thumbnailTextOverlays.value" 
            :key="overlay.id"
            class="bg-surface-dark/50 border border-surface-border/50 rounded-xl p-4 space-y-3 group relative"
          >
            <!-- Overlay Header -->
            <div class="flex justify-between items-center">
              <span class="text-[9px] font-bold uppercase tracking-widest text-violet-400">Text {{ idx + 1 }}</span>
              <button 
                @click="state.removeThumbnailText(overlay.id)"
                class="text-red-400/50 hover:text-red-400 transition-colors p-1"
              >
                <Icon name="ri:delete-bin-line" class="text-sm" />
              </button>
            </div>

            <!-- Text Input -->
            <textarea 
              v-model="overlay.text"
              rows="2"
              class="w-full bg-black/40 border border-surface-border/50 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none focus:border-violet-500/50 resize-none transition-all"
              placeholder="Enter text..."
            />

            <!-- Font Family -->
            <div>
              <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Font</label>
              <select 
                v-model="overlay.fontFamily"
                class="w-full bg-black/40 border border-surface-border/50 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500/50 appearance-none cursor-pointer"
              >
                <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>

            <!-- Font Size + Weight Row -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Size ({{ overlay.fontSize }}px)</label>
                <input 
                  type="range" v-model.number="overlay.fontSize"
                  min="20" max="200" step="5"
                  class="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div v-if="!SINGLE_WEIGHT_FONTS.has(overlay.fontFamily)">
                <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Weight ({{ overlay.fontWeight }})</label>
                <input 
                  type="range" v-model.number="overlay.fontWeight"
                  min="100" max="900" step="100"
                  class="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div v-else>
                <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Weight</label>
                <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider bg-black/20 rounded py-1.5 px-3 border border-white/5">
                  Fixed Weight
                </div>
              </div>
            </div>

            <!-- Stroke Toggle -->
            <div class="flex items-center justify-between bg-black/20 p-2 rounded-lg border border-white/5">
              <span class="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Icon name="ri:edit-box-line" class="text-xs text-violet-400" />
                Enable Stroke
              </span>
              <button 
                @click="overlay.showStroke = !overlay.showStroke"
                class="relative w-8 h-4 rounded-none transition-colors duration-300"
                :class="overlay.showStroke ? 'bg-violet-500' : 'bg-white/10'"
              >
                <div class="absolute top-0.5 left-0.5 w-3 h-3 rounded-none bg-white transition-transform duration-300 shadow-sm"
                     :class="overlay.showStroke ? 'translate-x-4' : 'translate-x-0'"
                ></div>
              </button>
            </div>

            <!-- Colors Row (Conditional Stroke) -->
            <div class="grid gap-3" :class="overlay.showStroke ? 'grid-cols-2' : 'grid-cols-1'">
              <div>
                <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Text Color</label>
                <div class="flex items-center gap-2">
                  <input type="color" v-model="overlay.color" class="w-7 h-7 rounded cursor-pointer bg-transparent border-none" />
                  <input type="text" v-model="overlay.color" class="flex-1 bg-black/40 border border-surface-border/50 rounded px-2 py-1 text-[10px] text-white mono" />
                </div>
              </div>
              <div v-if="overlay.showStroke">
                <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Stroke Color</label>
                <div class="flex items-center gap-2">
                  <input type="color" v-model="overlay.strokeColor" class="w-7 h-7 rounded cursor-pointer bg-transparent border-none" />
                  <input type="text" v-model="overlay.strokeColor" class="flex-1 bg-black/40 border border-surface-border/50 rounded px-2 py-1 text-[10px] text-white mono" />
                </div>
              </div>
            </div>

            <!-- Stroke Width (Conditional) -->
            <div v-if="overlay.showStroke">
              <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Stroke Width ({{ overlay.strokeWidth }})</label>
              <input 
                type="range" v-model.number="overlay.strokeWidth"
                min="0" max="20" step="1"
                class="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Text Transform -->
            <div>
              <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Transform</label>
              <div class="flex gap-1">
                <button 
                  v-for="t in ['uppercase', 'lowercase', 'none']" :key="t"
                  @click="overlay.textTransform = t"
                  class="flex-1 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-all border"
                  :class="overlay.textTransform === t ? 'bg-violet-500/20 border-violet-500/40 text-violet-400' : 'bg-transparent border-surface-border/30 text-slate-500'"
                >
                  {{ t === 'none' ? 'Aa' : t === 'uppercase' ? 'AA' : 'aa' }}
                </button>
              </div>
            </div>

            <!-- Background Box -->
            <div class="space-y-3 pt-2 border-t border-surface-border/30">
              <div class="flex items-center justify-between">
                <label class="text-[8px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                  <Icon name="ri:square-line" class="text-xs" />
                  Background Box
                </label>
                <button 
                  @click="overlay.showBackground = !overlay.showBackground"
                  class="w-8 h-4 rounded-none transition-all relative"
                  :class="overlay.showBackground ? 'bg-violet-500' : 'bg-white/10'"
                >
                  <div 
                    class="w-3 h-3 rounded-none bg-white shadow absolute top-0.5 transition-all"
                    :class="overlay.showBackground ? 'left-4.5' : 'left-0.5'"
                  />
                </button>
              </div>

              <div v-if="overlay.showBackground" class="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Box Color</label>
                    <div class="flex items-center gap-2">
                      <input type="color" v-model="overlay.backgroundColor" class="w-6 h-6 rounded cursor-pointer bg-transparent border-none" />
                      <input type="text" v-model="overlay.backgroundColor" class="flex-1 bg-black/40 border border-surface-border/50 rounded px-2 py-0.5 text-[9px] text-white mono" />
                    </div>
                  </div>
                  <div>
                    <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Opacity ({{ (overlay.backgroundOpacity * 100).toFixed(0) }}%)</label>
                    <input 
                      type="range" v-model.number="overlay.backgroundOpacity"
                      min="0" max="1" step="0.1"
                      class="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Padding ({{ overlay.backgroundPadding }}px)</label>
                  <input 
                    type="range" v-model.number="overlay.backgroundPadding"
                    min="0" max="200" step="1"
                    class="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <!-- Rotation -->
            <div>
              <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Rotation ({{ overlay.rotation }}°)</label>
              <input 
                type="range" v-model.number="overlay.rotation"
                min="-45" max="45" step="1"
                class="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <!-- Position (Display Only) -->
            <div class="flex items-center gap-2 text-[9px] text-slate-500">
              <Icon name="ri:drag-move-2-line" class="text-xs" />
              <span>Drag in preview to position • X:{{ overlay.x }} Y:{{ overlay.y }}</span>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="state.thumbnailTextOverlays.value.length === 0" class="text-center py-6 text-slate-600">
            <Icon name="ri:text" class="text-2xl mb-2" />
            <p class="text-[9px] uppercase tracking-widest font-bold">No text overlays</p>
            <p class="text-[8px] text-slate-700 mt-1">Click "Add Text" to overlay text on your thumbnail</p>
          </div>
        </div>

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

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FONT_OPTIONS } from '../composables/useClipperState'
const state = useClipperState()

const fontOptions = FONT_OPTIONS

const SINGLE_WEIGHT_FONTS = new Set([
  'Bebas Neue', 'Anton', 'Bangers', 'Permanent Marker', 'Russo One',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
])

async function handleSave() {
  await state.saveThumbnailConfig()
  state.showToast('Thumbnail config saved!', 'success')
}
</script>
