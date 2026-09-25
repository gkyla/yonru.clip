<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="show" 
        class="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preset-studio-title"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity" 
          @click="emit('close')"
        />

        <!-- Modal Surface -->
        <div 
          class="relative bg-surface-panel border border-surface-border rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden"
          @keydown.esc="emit('close')"
        >
          <!-- Header -->
          <div class="px-5 py-4 border-b border-surface-border bg-surface-dark/70 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-accent-500/10 border border-accent-500/30 flex items-center justify-center text-accent-500">
                <Icon name="ri:palette-line" class="text-lg" />
              </div>
              <div>
                <h2 id="preset-studio-title" class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  Preset Studio
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-card border border-surface-border text-slate-400">
                    {{ filteredPresets.length }} Styles
                  </span>
                </h2>
                <p class="text-[11px] text-slate-400">
                  Select a caption style crafted for short-form pacing and visual retention.
                </p>
              </div>
            </div>

            <button 
              @click="emit('close')"
              class="w-7 h-7 rounded-lg border border-surface-border/60 hover:border-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Close preset studio"
            >
              <Icon name="ri:close-line" class="text-base" />
            </button>
          </div>

          <!-- Filter & Search Toolbar -->
          <div class="px-5 py-3 border-b border-surface-border/60 bg-surface-dark/40 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0">
            <!-- Category Pills -->
            <div class="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              <button
                v-for="cat in PRESET_CATEGORIES"
                :key="cat.id"
                @click="selectedCategory = cat.id"
                class="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 border"
                :class="selectedCategory === cat.id 
                  ? 'border-accent-500 bg-accent-500 text-black shadow-sm' 
                  : 'border-surface-border/60 bg-surface-dark/60 text-slate-400 hover:text-white hover:border-accent-500/40'"
              >
                <Icon :name="cat.icon" class="text-xs" />
                <span>{{ cat.label }}</span>
              </button>
            </div>

            <!-- Search Field -->
            <div class="relative w-full sm:w-56 shrink-0">
              <Icon name="ri:search-line" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Search style or font..."
                class="w-full bg-surface-dark/80 border border-surface-border rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-500 transition-colors"
              />
              <button 
                v-if="searchQuery" 
                @click="searchQuery = ''"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                aria-label="Clear search"
              >
                <Icon name="ri:close-circle-fill" />
              </button>
            </div>
          </div>

          <!-- Presets Grid -->
          <div class="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-[320px]">
            <div 
              v-if="filteredPresets.length > 0"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              <button
                v-for="preset in filteredPresets"
                :key="preset.id"
                @click="handleSelect(preset)"
                class="group relative rounded-xl border p-3 text-left transition-all duration-150 flex flex-col justify-between gap-2.5 bg-surface-dark/50 hover:bg-surface-card hover:scale-[1.01]"
                :class="activePresetId === preset.id 
                  ? 'border-accent-500 ring-1 ring-accent-500/50 bg-accent-500/[0.04] shadow-[0_0_15px_rgba(207,255,80,0.1)]' 
                  : 'border-surface-border/80 hover:border-accent-500/40'"
              >
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <div 
                      class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                      :class="activePresetId === preset.id 
                        ? 'bg-accent-500/10 border-accent-500/30 text-accent-500' 
                        : 'bg-surface-panel border-surface-border text-slate-400 group-hover:text-white'"
                    >
                      <Icon :name="preset.icon" class="text-sm" />
                    </div>
                    <div class="truncate">
                      <h3 class="text-xs font-black uppercase tracking-wider text-white truncate">
                        {{ preset.name }}
                      </h3>
                      <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        {{ preset.font }}
                      </span>
                    </div>
                  </div>

                  <!-- Active Indicator -->
                  <div 
                    v-if="activePresetId === preset.id"
                    class="px-1.5 py-0.5 rounded bg-accent-500 text-black text-[9px] font-black uppercase tracking-widest shrink-0 shadow-sm"
                  >
                    Active
                  </div>
                </div>

                <!-- Live Typography Preview Box -->
                <div class="w-full h-14 bg-black/60 rounded-lg flex items-center justify-center border border-white/5 px-2 overflow-hidden relative">
                  <span
                    :style="{
                      fontFamily: preset.font,
                      fontSize: '13px',
                      fontWeight: preset.fontWeight,
                      color: preset.color,
                      textTransform: preset.textTransform === 'uppercase' ? 'uppercase' : 'none',
                      textShadow: getOuterStrokeShadow(preset.strokeWidth)
                    }"
                    class="px-1.5 py-0.5 rounded leading-none transition-all text-center inline-block truncate max-w-full"
                    :class="{
                      'bg-slate-950/80 px-2 py-1 rounded': preset.background === 'box',
                      'bg-slate-900/50 backdrop-blur px-2 py-1 rounded-full border border-white/10': preset.background === 'blur',
                    }"
                  >
                    <template v-if="preset.highlightMode === 'color' || preset.highlightMode === 'box' || preset.highlightMode === 'scale'">
                      <span>Viral </span>
                      <span 
                        :style="{ color: preset.highlightColor }" 
                        :class="{
                          'bg-red-500/25 px-1 rounded': preset.highlightMode === 'box',
                          'scale-105 inline-block font-black': preset.highlightMode === 'scale'
                        }"
                      >Hook</span>
                    </template>
                    <template v-else-if="preset.highlightMode === 'underline'">
                      <span>Viral </span>
                      <span class="relative inline-block font-bold" :style="{ color: preset.highlightColor }">
                        Hook
                        <span 
                          class="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full" 
                          :style="{ backgroundColor: preset.highlightColor }" 
                        />
                      </span>
                    </template>
                    <template v-else>
                      <span>Viral Hook</span>
                    </template>
                  </span>
                </div>

                <!-- Description & Badges Footer -->
                <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-surface-border/40">
                  <span class="truncate pr-2 text-slate-400 text-[10px]">{{ preset.description }}</span>
                  <div class="flex items-center gap-1 shrink-0">
                    <span 
                      class="w-2.5 h-2.5 rounded-full border border-white/20 shadow-sm"
                      :style="{ background: preset.highlightColor }"
                      title="Highlight Color"
                    />
                  </div>
                </div>
              </button>
            </div>

            <!-- Empty State -->
            <div v-else class="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <Icon name="ri:search-line" class="text-3xl text-slate-600 mb-1" />
              <h4 class="text-xs font-bold text-white uppercase tracking-wider">No Presets Found</h4>
              <p class="text-[11px] text-slate-400 max-w-xs">
                No styles match "{{ searchQuery }}". Try clearing your search query or selecting a different category.
              </p>
              <button 
                @click="searchQuery = ''; selectedCategory = 'all'"
                class="mt-2 text-[10px] font-bold text-accent-500 hover:underline uppercase tracking-wider"
              >
                Reset Filters
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-surface-border bg-surface-dark/70 flex items-center justify-between shrink-0 text-[10px] text-slate-500">
            <span class="font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Icon name="ri:checkbox-circle-line" class="text-accent-500" />
              Click any style to apply instantly
            </span>
            <div class="flex items-center gap-2">
              <span class="bg-surface-card px-2 py-0.5 rounded border border-surface-border text-slate-400 mono font-bold">
                ESC
              </span>
              <span>to close</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { SUBTITLE_PRESETS, PRESET_CATEGORIES, type SubtitlePreset } from '../../constants/subtitlePresets'
import { getOuterStrokeShadow } from '../../utils/styleHelpers'

const props = defineProps<{
  show: boolean
  activePresetId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', preset: SubtitlePreset): void
}>()

const selectedCategory = ref<'all' | 'viral' | 'minimal' | 'podcast' | 'creative'>('all')
const searchQuery = ref('')

const filteredPresets = computed(() => {
  return SUBTITLE_PRESETS.filter(p => {
    const matchesCategory = selectedCategory.value === 'all' || p.category === selectedCategory.value
    const q = searchQuery.value.trim().toLowerCase()
    const matchesSearch = !q || 
      p.name.toLowerCase().includes(q) || 
      p.font.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })
})

function handleSelect(preset: SubtitlePreset) {
  emit('select', preset)
  emit('close')
}
</script>
