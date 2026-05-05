<template>
  <div class="w-full max-w-4xl z-10 flex flex-col mt-12 mb-10">
    <h2 class="text-4xl font-bold tracking-tight text-white mb-4">Settings</h2>
    <p class="text-slate-400 mb-8">Configure your API keys and local environment setups here.</p>

    <div class="bg-surface-panel border border-surface-border rounded-xl p-6 flex flex-col gap-6 shadow-xl">
      
      <!-- API Key Setting -->
      <div>
        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Icon name="ri:key-2-fill" class="text-accent-500" /> API Configuration
        </h3>
        <p class="text-sm text-slate-400 mb-4">Set up your Gemini API key to allow the AI to analyze your video transcripts.</p>
        <div class="flex gap-4">
          <div class="flex-1 relative">
             <input 
               v-model="apiKey"
               :type="showKey ? 'text' : 'password'" 
               placeholder="AIzaSy..." 
               class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-sm pr-10"
             />
             <button @click="showKey = !showKey" class="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
               <Icon :name="showKey ? 'ri:eye-off-fill' : 'ri:eye-fill'" class="text-lg" />
             </button>
          </div>
          <button 
            @click="saveApiKey"
            class="px-6 py-2.5 bg-accent-500 text-black font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-accent-400 transition-all"
          >
            Save Key
          </button>
        </div>
      </div>

      <div class="h-px bg-surface-border w-full"></div>

      <!-- Whisper AI Configuration -->
      <div>
        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Icon name="ri:microchip-fill" class="text-accent-500" /> Transcription Engine (Whisper)
        </h3>
        <p class="text-sm text-slate-400 mb-6">Choose the AI model size used for local transcription. Larger models are more accurate but slower and require more VRAM/CPU.</p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            v-for="model in [
              { id: 'tiny', name: 'Tiny', speed: 'Ultra Fast', acc: 'Basic', desc: 'Minimal accuracy, best for quick testing on weak hardware.' },
              { id: 'base', name: 'Base', speed: 'Very Fast', acc: 'Good', desc: 'Great balance for clear audio. Default choice.' },
              { id: 'small', name: 'Small', speed: 'Fast', acc: 'Better', desc: 'Significantly better for non-English or noisy audio.' },
              { id: 'medium', name: 'Medium', speed: 'Moderate', acc: 'Excellent', desc: 'High precision. Requires decent hardware (~5GB VRAM).' },
              { id: 'large-v3', name: 'Large-v3', speed: 'Slow', acc: 'State-of-the-Art', desc: 'Highest accuracy possible. Best for complex dialogue.' }
            ]" 
            :key="model.id"
            @click="state.whisperModel.value = model.id"
            class="flex flex-col p-4 rounded-xl border text-left transition-all group relative"
            :class="state.whisperModel.value === model.id 
              ? 'bg-accent-500/10 border-accent-500 shadow-[0_0_15px_rgba(207,255,80,0.1)]' 
              : 'bg-surface-dark/50 border-surface-border hover:border-accent-500/30'"
          >
            <div class="flex justify-between items-start mb-2">
              <span class="font-black uppercase tracking-widest text-xs" :class="state.whisperModel.value === model.id ? 'text-accent-500' : 'text-slate-300'">{{ model.name }}</span>
              <Icon v-if="state.whisperModel.value === model.id" name="ri:checkbox-circle-fill" class="text-accent-500 text-lg" />
            </div>
            <div class="flex gap-2 mb-3">
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-400 font-bold uppercase tracking-tighter">{{ model.speed }}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-surface-dark border border-surface-border text-slate-400 font-bold uppercase tracking-tighter">{{ model.acc }}</span>
            </div>
            <p class="text-[11px] leading-relaxed text-slate-500 group-hover:text-slate-400 transition-colors">{{ model.desc }}</p>
          </button>
        </div>
      </div>

      <div class="h-px bg-surface-border w-full"></div>

      <!-- Environment Setup -->
      <div>
        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Icon name="ri:terminal-window-fill" class="text-accent-500" /> Environment Paths
        </h3>
        <p class="text-sm text-slate-400 mb-4">If your prerequisite tools are installed in custom locations, provide their absolute paths. Otherwise, leave them blank to use system defaults.</p>
        
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
             <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">FFmpeg Path (FFMPEG_PATH)</label>
             <input 
               v-model="ffmpegPath"
               type="text" 
               placeholder="e.g. C:\ffmpeg\bin" 
               class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-sm"
             />
          </div>
          <div class="flex flex-col gap-1.5">
             <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Node.js Path (NODE_PATH)</label>
             <input 
               v-model="nodePath"
               type="text" 
               placeholder="e.g. C:\Program Files\nodejs" 
               class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-sm"
             />
          </div>
          <div class="flex justify-end mt-2">
            <button 
              @click="saveEnvPaths"
              class="px-6 py-2.5 bg-surface-card border border-surface-border text-white font-bold uppercase tracking-wider text-xs rounded-lg hover:border-accent-500/50 hover:text-accent-500 transition-all"
            >
              Save Paths
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const apiKey = ref('')
const showKey = ref(false)
const ffmpegPath = ref('')
const nodePath = ref('')

async function fetchSettings() {
  try {
    const res = await $fetch<{ settings: any }>(`${API_BASE}/api/system-settings`)
    if (res && res.settings) {
      apiKey.value = res.settings.GEMINI_API_KEY || ''
      ffmpegPath.value = res.settings.FFMPEG_PATH || ''
      nodePath.value = res.settings.NODE_PATH || ''
    }
  } catch (e) {
    console.error('Failed to fetch settings', e)
  }
}

async function saveApiKey() {
  try {
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: { GEMINI_API_KEY: apiKey.value }
    })
    state.showToast('API Key saved successfully', 'success')
  } catch (e) {
    state.showToast('Failed to save API Key', 'error')
  }
}

async function saveEnvPaths() {
  try {
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: { 
        FFMPEG_PATH: ffmpegPath.value,
        NODE_PATH: nodePath.value
      }
    })
    state.showToast('Environment paths saved', 'success')
  } catch (e) {
    state.showToast('Failed to save environment paths', 'error')
  }
}

onMounted(() => {
  fetchSettings()
})
</script>
