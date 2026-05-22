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

          <!-- YouTube Cookies Diagnostics -->
          <div class="p-4 rounded-xl border bg-[#111318] border-surface-border flex items-start gap-3">
            <div class="p-2 rounded-lg bg-surface-dark">
              <Icon 
                :name="healthData?.cookies?.exists ? 'ri:checkbox-circle-fill' : 'ri:error-warning-fill'"
                :class="healthData?.cookies?.exists ? 'text-accent-500' : 'text-slate-500'"
                class="text-2xl shrink-0" 
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-widest text-slate-400">YouTube Cookies</span>
                <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter" :class="healthData?.cookies?.exists ? 'bg-accent-500/10 text-accent-500' : 'bg-surface-dark border border-surface-border text-slate-500'">
                  {{ healthData?.cookies?.status || 'Detecting...' }}
                </span>
              </div>
              <p class="text-[10px] text-slate-500 mt-1.5 leading-normal">
                Helps bypass YouTube's download rate-limits and bot-detection filters.
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

      <!-- YouTube Cookies Configuration -->
      <div>
        <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Icon name="ri:shield-keyhole-fill" class="text-accent-500" /> YouTube Cookies (yt-dlp)
        </h3>
        <p class="text-sm text-slate-400 mb-6">Import your YouTube cookies to bypass rate limits, captchas, and bot detection when fetching or downloading videos.</p>
        
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Uploader / Manager Box -->
          <div class="lg:col-span-7 flex flex-col gap-4">
            
            <!-- Upload Drag & Drop Area -->
            <div 
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="handleFileDrop"
              :class="dragOver ? 'border-accent-500 bg-accent-500/5' : 'border-surface-border bg-surface-dark/30 hover:border-slate-700'"
              class="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer relative"
              @click="$refs.fileInput.click()"
            >
              <input 
                ref="fileInput" 
                type="file" 
                accept=".txt" 
                class="hidden" 
                @change="handleFileSelect" 
              />
              
              <Icon 
                name="ri:file-upload-line" 
                class="text-4xl text-slate-500 mb-3 group-hover:text-accent-500 transition-colors"
                :class="{ 'text-accent-500 scale-110': dragOver }"
              />
              <span class="text-sm font-bold text-slate-300">
                Drag & drop your <code class="font-mono text-accent-500">cookies.txt</code> here
              </span>
              <span class="text-xs text-slate-500 mt-1.5">
                Or click to browse files from your computer
              </span>
            </div>

            <!-- Cookies Status / Actions -->
            <div v-if="cookiesStatus.exists" class="flex flex-col p-4 rounded-xl border border-surface-border bg-surface-dark/50">
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                  <Icon name="ri:file-text-fill" class="text-accent-500 text-lg" />
                  <div class="flex flex-col">
                    <span class="text-xs font-bold text-white">cookies.txt (Active)</span>
                    <span class="text-[10px] text-slate-500 font-mono mt-0.5">
                      Size: {{ formatBytes(cookiesStatus.size_bytes) }} • Updated: {{ formatDate(cookiesStatus.last_modified) }}
                    </span>
                  </div>
                </div>
                
                <button 
                  @click="deleteCookies"
                  :disabled="deletingCookies"
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Icon name="ri:delete-bin-line" />
                  {{ deletingCookies ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </div>
            
            <div v-else class="flex items-center gap-2.5 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-xs leading-relaxed">
              <Icon name="ri:alert-fill" class="text-lg shrink-0" />
              <p>No cookies active. Downloads may succeed but are highly vulnerable to YouTube's "Sign in to confirm you're not a bot" restriction.</p>
            </div>

          </div>

          <!-- Interactive Guide Accordion -->
          <div class="lg:col-span-5 flex flex-col gap-3">
            <h4 class="text-xs font-black uppercase tracking-widest text-slate-500 mb-1 pl-1">How to obtain cookies?</h4>
            
            <div class="border border-surface-border rounded-xl overflow-hidden bg-surface-dark/30">
              <!-- Step 1 Accordion -->
              <div class="border-b border-surface-border">
                <button 
                  @click="activeStep = activeStep === 1 ? 0 : 1"
                  class="w-full flex justify-between items-center p-3 text-left hover:bg-surface-dark/50 transition-colors"
                >
                  <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-[10px] font-black">1</span>
                    Install Browser Extension
                  </span>
                  <Icon :name="activeStep === 1 ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500" />
                </button>
                <div v-show="activeStep === 1" class="p-3 bg-surface-dark/10 border-t border-surface-border/50 text-[11px] leading-relaxed text-slate-400 flex flex-col gap-2">
                  <p>Install the trusted, open-source <strong>"Get cookies.txt LOCALLY"</strong> extension in your browser:</p>
                  <a 
                    href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/ccloeocionehidjhhicdjiijlkocoodm" 
                    target="_blank"
                    class="inline-flex items-center gap-1.5 self-start text-accent-500 font-bold hover:underline"
                  >
                    <Icon name="ri:chrome-fill" /> Get extension for Chrome / Brave
                  </a>
                  <a 
                    href="https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/" 
                    target="_blank"
                    class="inline-flex items-center gap-1.5 self-start text-accent-500 font-bold hover:underline"
                  >
                    <Icon name="ri:firefox-fill" /> Get extension for Firefox
                  </a>
                </div>
              </div>

              <!-- Step 2 Accordion -->
              <div class="border-b border-surface-border">
                <button 
                  @click="activeStep = activeStep === 2 ? 0 : 2"
                  class="w-full flex justify-between items-center p-3 text-left hover:bg-surface-dark/50 transition-colors"
                >
                  <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-[10px] font-black">2</span>
                    Navigate & Log In
                  </span>
                  <Icon :name="activeStep === 2 ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500" />
                </button>
                <div v-show="activeStep === 2" class="p-3 bg-surface-dark/10 border-t border-surface-border/50 text-[11px] leading-relaxed text-slate-400 flex flex-col gap-2">
                  <p>Go to <a href="https://youtube.com" target="_blank" class="text-accent-500 hover:underline font-bold">youtube.com</a> in a new tab.</p>
                  <p>For best results, make sure you are logged in to your Google Account. This ensures YouTube treats your request as a real session.</p>
                </div>
              </div>

              <!-- Step 3 Accordion -->
              <div>
                <button 
                  @click="activeStep = activeStep === 3 ? 0 : 3"
                  class="w-full flex justify-between items-center p-3 text-left hover:bg-surface-dark/50 transition-colors"
                >
                  <span class="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <span class="w-5 h-5 rounded-full bg-accent-500/10 text-accent-500 flex items-center justify-center text-[10px] font-black">3</span>
                    Export & Upload
                  </span>
                  <Icon :name="activeStep === 3 ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500" />
                </button>
                <div v-show="activeStep === 3" class="p-3 bg-surface-dark/10 border-t border-surface-border/50 text-[11px] leading-relaxed text-slate-400 flex flex-col gap-2.5">
                  <p>1. While on the YouTube tab, click the <strong>Get cookies.txt LOCALLY</strong> extension icon in your toolbar.</p>
                  <p>2. Select the option <strong>"youtube.com"</strong> (under Active Tab) and click the <strong>"Export as Netscape format"</strong> or download icon.</p>
                  <p>3. Drop the downloaded <code class="font-mono text-accent-500">youtube.com_cookies.txt</code> file directly into the drag box on the left!</p>
                </div>
              </div>
            </div>

          </div>
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
  exists?: boolean
}
interface HealthResponse {
  ffmpeg: HealthItem
  node: HealthItem
  python_env: HealthItem
  gemini_api: HealthItem
  cookies: HealthItem
}

const healthData = ref<HealthResponse | null>(null)
const checkingHealth = ref(false)

const dragOver = ref(false)
const activeStep = ref(1)
const deletingCookies = ref(false)
const cookiesStatus = ref({ exists: false, size_bytes: 0, last_modified: null })

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

async function fetchCookiesStatus() {
  try {
    const res = await $fetch<{ exists: boolean; size_bytes: number; last_modified: string | null }>(`${API_BASE}/api/cookies-status`)
    cookiesStatus.value = res
  } catch (e) {
    console.error('Failed to fetch cookies status', e)
  }
}

async function uploadCookiesText(text: string) {
  try {
    const res = await $fetch<{ status: string; message: string }>(`${API_BASE}/api/upload-cookies`, {
      method: 'POST',
      body: { cookies_text: text }
    })
    if (res.status === 'ok') {
      state.showToast('cookies.txt uploaded successfully!', 'success')
      fetchCookiesStatus()
      checkSystemHealth()
    } else {
      state.showToast('Failed to upload cookies', 'error')
    }
  } catch (e: any) {
    const errDetail = e.data?.detail || 'Invalid cookies format. Ensure it is Netscape format.'
    state.showToast(errDetail, 'error')
  }
}

function handleFileSelect(event: any) {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    uploadCookiesText(text)
  }
  reader.readAsText(file)
}

function handleFileDrop(event: any) {
  dragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (!file) return
  
  if (!file.name.endsWith('.txt')) {
    state.showToast('Please upload a valid .txt cookie file', 'error')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    uploadCookiesText(text)
  }
  reader.readAsText(file)
}

async function deleteCookies() {
  deletingCookies.value = true
  try {
    await $fetch(`${API_BASE}/api/delete-cookies`, {
      method: 'DELETE'
    })
    state.showToast('cookies.txt deleted successfully', 'success')
    fetchCookiesStatus()
    checkSystemHealth()
  } catch (e) {
    state.showToast('Failed to delete cookies', 'error')
  } finally {
    deletingCookies.value = false
  }
}

// Helpers
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(isoString: string | null) {
  if (!isoString) return 'Never'
  const date = new Date(isoString)
  return date.toLocaleString()
}

onMounted(() => {
  fetchSettings()
  checkSystemHealth()
  fetchCookiesStatus()
})
</script>
