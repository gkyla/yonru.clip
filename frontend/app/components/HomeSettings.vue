<template>
  <div class="w-full max-w-4xl z-10 flex flex-col mt-12 mb-10">
    <h2 class="text-4xl font-bold tracking-tight text-white mb-4">Settings</h2>
    <p class="text-slate-400 mb-8">Configure your API keys and local environment setups here.</p>

    <div class="bg-surface-panel border border-surface-border rounded-xl p-6 flex flex-col gap-6 shadow-xl">
      
      <!-- System Health Diagnostics Dashboard -->
      <div>
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-white flex items-center gap-2">
            <Icon name="ri:shield-cross-fill" class="text-accent-500" /> Prerequisite Health & Diagnostics
          </h3>
          <button 
            @click="checkSystemHealth" 
            :disabled="checkingHealth"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-surface-dark border border-surface-border text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
          >
            <Icon name="ri:refresh-line" :class="{ 'animate-spin': checkingHealth }" />
            {{ checkingHealth ? 'Checking...' : 'Refresh Health' }}
          </button>
        </div>
        
        <p class="text-sm text-slate-400 mb-6">Verify the health and directory paths of local software components and APIs required for rendering and AI generation.</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- FFmpeg Diagnostics -->
          <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
            <div class="p-2 rounded-lg bg-surface-dark">
              <Icon 
                :name="healthData?.ffmpeg?.status === 'OK' ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'"
                :class="healthData?.ffmpeg?.status === 'OK' ? 'text-accent-500' : 'text-red-500'"
                class="text-2xl shrink-0" 
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">FFmpeg (Video Engine)</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" :class="healthData?.ffmpeg?.status === 'OK' ? 'bg-accent-500/10 text-accent-500' : 'bg-red-500/10 text-red-500'">
                  {{ healthData?.ffmpeg?.status || 'Detecting...' }}
                </span>
              </div>
              <p class="text-[10px] text-slate-500 truncate font-mono mt-1.5" :title="healthData?.ffmpeg?.path">
                Path: {{ healthData?.ffmpeg?.path || 'Not checked' }}
              </p>
              <p v-if="healthData && healthData.ffmpeg?.status !== 'OK'" class="text-[10px] text-amber-500 mt-1">
                Install FFmpeg to support sound track extraction and video conversion.
              </p>
            </div>
          </div>

          <!-- Node.js Diagnostics -->
          <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
            <div class="p-2 rounded-lg bg-surface-dark">
              <Icon 
                :name="healthData?.node?.status === 'OK' ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'"
                :class="healthData?.node?.status === 'OK' ? 'text-accent-500' : 'text-red-500'"
                class="text-2xl shrink-0" 
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Node.js (Remotion engine)</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" :class="healthData?.node?.status === 'OK' ? 'bg-accent-500/10 text-accent-500' : 'bg-red-500/10 text-red-500'">
                  {{ healthData?.node?.status || 'Detecting...' }}
                </span>
              </div>
              <p class="text-[10px] text-slate-500 truncate font-mono mt-1.5" :title="healthData?.node?.path">
                Path: {{ healthData?.node?.path || 'Not checked' }}
              </p>
              <p v-if="healthData && healthData.node?.status !== 'OK'" class="text-[10px] text-amber-500 mt-1">
                Required to compile React Remotion templates.
              </p>
            </div>
          </div>

          <!-- Python Virtual Environment Diagnostics -->
          <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
            <div class="p-2 rounded-lg bg-surface-dark">
              <Icon 
                :name="healthData?.python_env?.status === 'OK' ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'"
                :class="healthData?.python_env?.status === 'OK' ? 'text-accent-500' : 'text-red-500'"
                class="text-2xl shrink-0" 
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Python Virtualenv</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" :class="healthData?.python_env?.status === 'OK' ? 'bg-accent-500/10 text-accent-500' : 'bg-red-500/10 text-red-500'">
                  {{ healthData?.python_env?.status || 'Detecting...' }}
                </span>
              </div>
              <p class="text-[10px] text-slate-500 mt-1.5 leading-normal">
                Virtual environment packages (FastAPI, google-genai) are loaded.
              </p>
            </div>
          </div>

          <!-- Gemini API Diagnostics -->
          <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
            <div class="p-2 rounded-lg bg-surface-dark">
              <Icon 
                :name="healthData?.gemini_api?.has_key ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'"
                :class="healthData?.gemini_api?.has_key ? 'text-accent-500' : 'text-red-500'"
                class="text-2xl shrink-0" 
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">Gemini AI Key</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" :class="healthData?.gemini_api?.has_key ? 'bg-accent-500/10 text-accent-500' : 'bg-red-500/10 text-red-500'">
                  {{ healthData?.gemini_api?.status || 'Detecting...' }}
                </span>
              </div>
              <p class="text-[10px] text-slate-500 mt-1.5 leading-normal">
                Used to find viral hooks and generate engaging titles automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="h-px bg-surface-border w-full"></div>

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
            class="px-5 py-2.5 bg-surface-card border border-surface-border text-white font-bold uppercase tracking-wider text-[10px] rounded-lg hover:border-accent-500/50 hover:text-accent-500 transition-all"
          >
            Save Key
          </button>
          <button 
            @click="testApiKey"
            :disabled="testingKey"
            class="px-5 py-2.5 bg-accent-500 text-black font-bold uppercase tracking-wider text-[10px] rounded-lg hover:bg-accent-400 transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <Icon name="ri:flashlight-fill" />
            {{ testingKey ? 'Testing...' : 'Test Connection' }}
          </button>
        </div>

        <!-- Live Test Result Banner -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div 
            v-if="testResult.status !== 'idle'" 
            class="p-3.5 rounded-lg border text-xs leading-normal flex items-start gap-2.5 mt-3"
            :class="testResult.status === 'valid' ? 'bg-accent-500/10 border-accent-500/20 text-accent-400' : 'bg-red-500/10 border-red-500/20 text-red-400'"
          >
            <Icon :name="testResult.status === 'valid' ? 'ri:checkbox-circle-fill' : 'ri:error-warning-fill'" class="text-lg shrink-0 mt-0.5" />
            <div>
              <span class="font-bold block mb-0.5">{{ testResult.status === 'valid' ? 'Gemini API key is verified!' : 'Connection check failed' }}</span>
              <p class="text-slate-300">{{ testResult.message }}</p>
            </div>
          </div>
        </Transition>
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

// Health & Diagnostics state
interface HealthItem {
  status: string
  path?: string
  has_key?: boolean
  active?: boolean
}
interface HealthResponse {
  ffmpeg: HealthItem
  node: HealthItem
  python_env: HealthItem
  gemini_api: HealthItem
}

const healthData = ref<HealthResponse | null>(null)
const checkingHealth = ref(false)

async function checkSystemHealth() {
  checkingHealth.value = true
  try {
    const res = await $fetch<HealthResponse>(`${API_BASE}/api/system-health`)
    healthData.value = res
  } catch (e) {
    console.error('Failed to fetch system health', e)
  } finally {
    checkingHealth.value = false
  }
}

// API Key Validation state
const testingKey = ref(false)
const testResult = ref<{ status: 'idle' | 'valid' | 'invalid'; message: string }>({ status: 'idle', message: '' })

async function testApiKey() {
  if (!apiKey.value.trim()) {
    testResult.value = { status: 'invalid', message: 'API key is empty.' }
    return
  }
  
  testingKey.value = true
  testResult.value = { status: 'idle', message: 'Checking key with Gemini...' }
  
  try {
    const res = await $fetch<{ status: string; error?: string }>(`${API_BASE}/api/validate-gemini-key`, {
      method: 'POST',
      body: { api_key: apiKey.value }
    })
    
    if (res.status === 'valid') {
      testResult.value = { status: 'valid', message: 'Connection successful! Your Gemini API key is valid and working.' }
      state.showToast('Gemini API connection verified!', 'success')
    } else {
      testResult.value = { status: 'invalid', message: res.error || 'The API key is invalid.' }
      state.showToast('Gemini connection check failed', 'error')
    }
  } catch (e: any) {
    testResult.value = { status: 'invalid', message: e.message || 'Network/Server connection failure.' }
    state.showToast('Failed to contact validator endpoint', 'error')
  } finally {
    testingKey.value = false
    // Refresh health diagnostics to update the dashboard checkmark
    checkSystemHealth()
  }
}

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
    checkSystemHealth()
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
    checkSystemHealth()
  } catch (e) {
    state.showToast('Failed to save environment paths', 'error')
  }
}

onMounted(() => {
  fetchSettings()
  checkSystemHealth()
})
</script>
