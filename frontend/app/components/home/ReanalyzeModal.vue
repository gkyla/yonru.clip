<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="close"></div>
      
      <!-- Modal Card -->
      <div class="relative w-full max-w-xl bg-surface-dark border border-surface-border rounded-3xl p-7 sm:px-6 shadow-2xl flex flex-col overflow-visible animate-in fade-in zoom-in-95 duration-200 z-50">
        <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none rounded-3xl"></div>

        <!-- Header -->
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(207,255,80,0.15)]">
              <Icon name="ri:magic-line" class="text-2xl" />
            </div>
            <div>
              <h3 class="text-xl font-black text-white tracking-wide">Reanalyze Video Hooks</h3>
              <p class="text-slate-400 text-xs font-semibold">
                Re-evaluate hooks for this cached video with new criteria without re-downloading.
              </p>
            </div>
          </div>
          <button 
            @click="close" 
            class="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            title="Close"
          >
            <Icon name="ri:close-line" class="text-lg" />
          </button>
        </div>

        <!-- Target Video Mini Banner (if found) -->
        <div v-if="targetVideo" class="bg-surface-panel/40 border border-surface-border rounded-2xl p-2.5 mb-4 flex items-center gap-3 shrink-0">
          <div class="w-20 aspect-video bg-black rounded-lg overflow-hidden relative shrink-0 border border-white/10">
            <img 
              v-if="targetVideo.thumbnail_url" 
              :src="`${API_BASE}${targetVideo.thumbnail_url}`" 
              class="w-full h-full object-cover" 
              alt="Video Thumbnail"
            />
            <Icon v-else name="ri:film-line" class="absolute inset-0 m-auto text-slate-700 text-base" />
            <div class="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 rounded text-[8px] text-white font-mono font-bold">
              {{ formatDurationSec(targetVideo.duration) }}
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-white font-bold text-xs truncate">{{ targetVideo.title }}</h4>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] text-slate-500 font-mono">ID: {{ targetVideo.video_id }}</span>
              <span class="text-[10px] text-accent-500 font-bold bg-accent-500/10 px-1.5 py-0.5 rounded">Cached</span>
            </div>
          </div>
        </div>

        <!-- Form Controls -->
        <div class="flex flex-col gap-4">
          
          <!-- AI Prompt Template Dropdown Picker -->
          <div ref="dropdownContainerRef" class="flex flex-col gap-1.5 relative z-40">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400">Prompt Template</label>
              <NuxtLink to="/prompts" @click="close" class="text-accent-500 hover:underline text-[10px] font-bold flex items-center gap-1">
                <Icon name="ri:settings-4-line" class="text-xs" />
                Manage Prompts
              </NuxtLink>
            </div>

            <!-- Trigger Button -->
            <button
              type="button"
              @click="isDropdownOpen = !isDropdownOpen"
              class="w-full px-4 py-3 bg-surface-card hover:bg-surface-panel border border-surface-border text-white rounded-2xl transition-all flex items-center justify-between text-left active:scale-[0.99] select-none cursor-pointer"
              :class="{ 'border-accent-500/50 ring-2 ring-accent-500/10': isDropdownOpen }"
            >
              <div class="flex items-center gap-3 truncate">
                <div 
                  class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  :class="currentSelectedOption.isCustom ? 'bg-purple-500/20 text-purple-400' : 'bg-accent-500/20 text-accent-500'"
                >
                  <Icon :name="currentSelectedOption.icon" class="text-base" />
                </div>
                <div class="flex flex-col min-w-0 truncate">
                  <span class="text-xs font-bold truncate" :class="currentSelectedOption.isCustom ? 'text-purple-300' : 'text-white'">
                    {{ currentSelectedOption.label }}
                  </span>
                  <span class="text-[10px] text-slate-400 truncate">
                    {{ currentSelectedOption.isCustom ? 'Custom Template' : 'Smart Intent Preset' }}
                  </span>
                </div>
              </div>
              <Icon 
                name="ri:arrow-down-s-line" 
                class="text-slate-400 text-base transition-transform duration-200 shrink-0 ml-2" 
                :class="{ 'rotate-180': isDropdownOpen }" 
              />
            </button>

            <!-- Dropdown Popover Menu with 2 Tabs -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="transform scale-95 opacity-0 -translate-y-1"
              enter-to-class="transform scale-100 opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="transform scale-100 opacity-100 translate-y-0"
              leave-to-class="transform scale-95 opacity-0 -translate-y-1"
            >
              <div
                v-if="isDropdownOpen"
                class="absolute top-full mt-2 left-0 w-full bg-[#12151c] border border-surface-border rounded-2xl shadow-2xl p-3 z-[100] flex flex-col gap-2.5 ring-1 ring-white/10"
              >
                <!-- 2 Tabs Switcher inside Dropdown -->
                <div class="grid grid-cols-2 p-1 bg-surface-dark border border-surface-border rounded-xl gap-1 select-none">
                  <button
                    type="button"
                    @click="dropdownTab = 'preset'"
                    class="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    :class="dropdownTab === 'preset' ? 'bg-accent-500 text-black shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'"
                  >
                    <Icon name="ri:sparkling-fill" class="text-xs" />
                    <span>Smart Presets</span>
                  </button>
                  <button
                    type="button"
                    @click="dropdownTab = 'custom'"
                    class="py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    :class="dropdownTab === 'custom' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'"
                  >
                    <Icon name="ri:file-code-line" class="text-xs" />
                    <span>Custom Templates</span>
                  </button>
                </div>

                <!-- Tab 1: Smart Intent Presets (Full-width list) -->
                <div v-if="dropdownTab === 'preset'" class="flex flex-col gap-1 max-h-60 overflow-y-auto custom-scrollbar pr-0.5">
                  <button
                    v-for="preset in presetOptions"
                    :key="preset.id"
                    type="button"
                    @click="selectPreset(preset.id)"
                    class="w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between hover:bg-white/[0.04] cursor-pointer group"
                    :class="{ 'bg-accent-500/10 border border-accent-500/30 text-accent-400 font-bold': extractionMode === 'preset' && selectedPresetId === preset.id }"
                  >
                    <div class="flex items-center gap-2.5 min-w-0 truncate">
                      <Icon :name="preset.icon" class="text-base shrink-0" :class="extractionMode === 'preset' && selectedPresetId === preset.id ? 'text-accent-500' : 'text-slate-400 group-hover:text-white'" />
                      <div class="flex flex-col min-w-0 truncate">
                        <span class="text-xs truncate" :class="extractionMode === 'preset' && selectedPresetId === preset.id ? 'text-accent-400 font-bold' : 'text-slate-200 group-hover:text-white'">{{ preset.label }}</span>
                        <span class="text-[10px] text-slate-400 truncate">{{ preset.desc }}</span>
                      </div>
                    </div>
                    <Icon v-if="extractionMode === 'preset' && selectedPresetId === preset.id" name="ri:check-line" class="text-accent-500 text-base shrink-0 ml-2" />
                  </button>
                </div>

                <!-- Tab 2: Custom Templates (Full-width list) -->
                <div v-else class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between px-1">
                    <span class="text-[10px] text-slate-400">Created in Prompt Studio</span>
                    <NuxtLink to="/prompts" @click="close" class="text-accent-500 hover:underline text-[10px] font-bold flex items-center gap-1">
                      Manage Prompts &rarr;
                    </NuxtLink>
                  </div>

                  <div v-if="state.promptsList.value.length === 0" class="p-6 bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-xl text-center flex flex-col items-center justify-center">
                    <Icon name="ri:file-code-line" class="text-2xl text-slate-600 mb-1.5" />
                    <p class="text-xs text-slate-400 font-semibold mb-1">No custom prompt templates found.</p>
                    <NuxtLink to="/prompts" @click="close" class="text-xs text-accent-500 font-bold hover:underline">
                      Create template &rarr;
                    </NuxtLink>
                  </div>
                  <div v-else class="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                    <button
                      v-for="p in state.promptsList.value"
                      :key="p.id"
                      type="button"
                      @click="selectCustomPrompt(p.id)"
                      class="w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between hover:bg-white/[0.04] cursor-pointer group"
                      :class="{ 'bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold': extractionMode === 'custom' && selectedPromptFile === p.id }"
                    >
                      <div class="flex items-center gap-2.5 min-w-0 truncate">
                        <Icon name="ri:code-s-slash-line" class="text-base shrink-0" :class="extractionMode === 'custom' && selectedPromptFile === p.id ? 'text-purple-400' : 'text-slate-400 group-hover:text-white'" />
                        <div class="flex flex-col min-w-0 truncate">
                          <span class="text-xs truncate" :class="extractionMode === 'custom' && selectedPromptFile === p.id ? 'text-purple-300 font-bold' : 'text-slate-200 group-hover:text-white'">{{ p.name }}</span>
                          <span v-if="p.suitableFor?.length" class="text-[9px] text-slate-400 truncate">{{ p.suitableFor.join(', ') }}</span>
                        </div>
                      </div>
                      <Icon v-if="extractionMode === 'custom' && selectedPromptFile === p.id" name="ri:check-line" class="text-purple-400 text-base shrink-0 ml-2" />
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Dynamic Constraints: Duration & Topic Focus -->
          <div class="bg-surface-panel/30 border border-surface-border rounded-2xl p-3.5 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Icon name="ri:equalizer-line" class="text-accent-500 text-xs" />
                Duration & Topic Filters
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Target Duration -->
              <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-slate-400">Target Duration</label>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    v-for="d in durationPresets"
                    :key="d.label"
                    type="button"
                    @click="setDuration(d.min, d.max)"
                    class="py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer truncate"
                    :class="minDuration === d.min && maxDuration === d.max
                      ? 'bg-accent-500/15 border-accent-500/50 text-accent-400 shadow-sm'
                      : 'bg-surface-dark border-surface-border text-slate-400 hover:text-white hover:border-slate-600'"
                  >
                    {{ d.label }}
                  </button>
                </div>
              </div>

              <!-- Topic Focus -->
              <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <span>Topic Focus (Optional)</span>
                </label>
                <div class="relative flex items-center">
                  <input
                    v-model="focusTopic"
                    type="text"
                    placeholder="e.g. mitos air es, diet pemula..."
                    class="w-full bg-surface-dark border border-surface-border text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-accent-500/60 focus:ring-1 focus:ring-accent-500/20 placeholder-slate-500 pr-7 font-medium"
                  />
                  <button
                    v-if="focusTopic"
                    type="button"
                    @click="focusTopic = ''"
                    class="absolute right-2 text-slate-500 hover:text-white transition-colors"
                  >
                    <Icon name="ri:close-circle-fill" class="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer CTA Buttons -->
        <div class="flex items-center justify-end gap-3 mt-2 pt-4 shrink-0">
          <button
            type="button"
            @click="close"
            class="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleReanalyze"
            class="px-6 py-2.5 bg-accent-500 text-black hover:bg-accent-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(207,255,80,0.25)] active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Icon name="ri:magic-line" class="text-base" />
            <span>Start Reanalysis</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { CachedVideo, HookIntentPreset, PromptTemplate } from '../../types/clipper'

const emit = defineEmits<{
  (e: 'reanalyze', videoId: string, force: boolean, options: {
    extractionMode: 'preset' | 'custom'
    presetId?: string
    promptFile?: string
    focusTopic?: string
    minDuration?: number
    maxDuration?: number
    autoHooks: boolean
  }): void
}>()

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const isOpen = ref(false)
const targetVideoId = ref('')
const targetVideo = ref<CachedVideo | null>(null)

const isDropdownOpen = ref(false)
const dropdownContainerRef = ref<HTMLElement | null>(null)
const dropdownTab = ref<'preset' | 'custom'>('preset')

const extractionMode = ref<'preset' | 'custom'>('preset')
const selectedPresetId = ref<HookIntentPreset>('auto')
const selectedPromptFile = ref('prompt.json')
const focusTopic = ref('')
const minDuration = ref(30)
const maxDuration = ref(180)

interface PresetOption {
  id: HookIntentPreset
  label: string
  icon: string
  desc: string
}

const presetOptions: PresetOption[] = [
  { id: 'auto', label: 'Auto Detect Virality', icon: 'ri:fire-fill', desc: 'Identifies highest-retention moments across all styles' },
  { id: 'humor', label: 'Funny & Relatable', icon: 'ri:emotion-laugh-line', desc: 'Focuses on punchlines, comedic timing, and humor' },
  { id: 'educational', label: 'Edukasi & Debunk', icon: 'ri:lightbulb-line', desc: 'Debunks myths, explains facts, and provides simple analogies' },
  { id: 'storytelling', label: 'Story & Deep Talk', icon: 'ri:mic-line', desc: 'Narrative story arcs, turning points, and personal reflections' },
  { id: 'debate', label: 'Hot Takes', icon: 'ri:flashlight-fill', desc: 'Bold opinions, passionate arguments, and controversial takes' }
]

const currentSelectedOption = computed(() => {
  if (extractionMode.value === 'custom') {
    const found = state.promptsList.value.find((p: PromptTemplate) => p.id === selectedPromptFile.value)
    return {
      label: found?.name || 'Custom Prompt',
      icon: 'ri:file-code-line',
      isCustom: true
    }
  }
  const preset = presetOptions.find(p => p.id === selectedPresetId.value) || presetOptions[0]!
  return {
    label: preset.label,
    icon: preset.icon,
    isCustom: false
  }
})

const durationPresets = [
  { label: '30s - 60s', min: 30, max: 60 },
  { label: '60s - 90s', min: 60, max: 90 },
  { label: '90s - 180s', min: 90, max: 180 },
  { label: '30s - 180s (Default)', min: 30, max: 180 }
]

function selectPreset(id: HookIntentPreset) {
  extractionMode.value = 'preset'
  selectedPresetId.value = id
  isDropdownOpen.value = false
}

function selectCustomPrompt(id: string) {
  extractionMode.value = 'custom'
  selectedPromptFile.value = id
  isDropdownOpen.value = false
}

function setDuration(min: number, max: number) {
  minDuration.value = min
  maxDuration.value = max
}

function formatDurationSec(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function handleClickOutside(event: MouseEvent) {
  if (isDropdownOpen.value && dropdownContainerRef.value && !dropdownContainerRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})

function open(videoId: string) {
  targetVideoId.value = videoId
  isDropdownOpen.value = false
  
  // Look up video in state.cachedVideos
  const found = state.cachedVideos.value.find((v: CachedVideo) => v.video_id === videoId)
  targetVideo.value = found || null

  // Initialize from global state defaults
  extractionMode.value = state.extractionMode.value || 'preset'
  dropdownTab.value = extractionMode.value
  selectedPresetId.value = (state.selectedPresetId.value as HookIntentPreset) || 'auto'
  
  if (state.selectedPrompt.value) {
    selectedPromptFile.value = state.selectedPrompt.value
  } else if (state.promptsList.value.length > 0) {
    const firstPrompt = state.promptsList.value[0]
    if (firstPrompt) {
      selectedPromptFile.value = firstPrompt.id
    }
  }

  focusTopic.value = state.focusTopic.value || ''
  minDuration.value = state.minDuration.value || 30
  maxDuration.value = state.maxDuration.value || 180

  isOpen.value = true
}

function close() {
  isOpen.value = false
  isDropdownOpen.value = false
}

function handleReanalyze() {
  close()
  emit('reanalyze', targetVideoId.value, true, {
    extractionMode: extractionMode.value,
    presetId: extractionMode.value === 'preset' ? selectedPresetId.value : undefined,
    promptFile: extractionMode.value === 'custom' ? selectedPromptFile.value : undefined,
    focusTopic: focusTopic.value.trim() ? focusTopic.value.trim() : undefined,
    minDuration: minDuration.value,
    maxDuration: maxDuration.value,
    autoHooks: true // ADR-0010 Universal Natural Hook Detection
  })
}

defineExpose({
  open,
  close
})
</script>
