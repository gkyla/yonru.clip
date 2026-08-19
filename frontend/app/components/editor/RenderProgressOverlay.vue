<template>
  <Transition
    enter-active-class="transition duration-400 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="isVisible"
      data-testid="render-overlay"
      class="absolute inset-0 z-[70] bg-[#060608]/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-4 sm:p-6 select-none animate-in fade-in duration-300 overflow-y-auto overflow-x-hidden"
    >
      <!-- Ambient Dynamic Stage Glow -->
      <div
        class="absolute w-[50vw] h-[50vw] rounded-full blur-[160px] -top-1/3 -right-1/3 mix-blend-screen transition-colors duration-1000 pointer-events-none -z-10"
        :class="ambientGlowColor"
      ></div>
      <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none -z-10"></div>

      <!-- Inner Scaled Wrapper with Auto-Centering to Prevent Any Clipping -->
      <div class="w-full max-w-lg flex flex-col items-center justify-center my-auto py-2 z-10">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-500 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-300 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <!-- ========================================================= -->
          <!-- STATE 1: ACTIVE RENDERING (3-STAGE PIPELINE STYLE) -->
          <!-- ========================================================= -->
          <div v-if="renderStatus === 'rendering'" key="rendering" class="w-full flex flex-col items-center justify-center">
            <!-- Hero Centerpiece Spinner (Matching PipelineOverlay.vue 1:1) -->
            <div class="relative mb-10 z-10 flex items-center justify-center">
              <div
                class="absolute w-40 h-40 rounded-full blur-[60px] animate-pulse transition-colors duration-700"
                :class="spinnerPulseColor"
              ></div>
              <div
                class="w-28 h-28 rounded-full border-[4px] border-surface-border relative transition-all duration-700 z-10 flex items-center justify-center"
                :class="spinnerGlowShadow"
              >
                <!-- Spinning Outer Ring Accent -->
                <div
                  class="absolute inset-[-4px] rounded-full border-[4px] border-transparent animate-spin transition-colors duration-700"
                  :class="spinnerBorderAccent"
                ></div>
                <!-- Central Active Animated Icon -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <Icon
                    :name="currentStageIcon"
                    class="text-4xl transition-all duration-300 ease-out transform animate-pulse"
                    :class="spinnerIconColor"
                  />
                </div>
              </div>
            </div>

            <!-- Title & Subtitle (Dynamic per Stage) -->
            <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10 flex items-center justify-center gap-2">
              <span>{{ currentStageTitle }}</span>
            </h2>
            <p class="text-slate-500 text-sm max-w-sm mb-8 z-10 font-medium h-5 flex items-center justify-center">
              <span class="truncate">{{ currentStatusMessage }}</span>
            </p>

            <!-- Connected 3-Stage Horizontal Pill Stepper (Matching PipelineOverlay.vue Exactly) -->
            <div class="flex items-center justify-center gap-2 sm:gap-3 z-10 mb-10 flex-nowrap">
              <template v-for="(stage, idx) in PIPELINE_STAGES" :key="stage.id">
                <!-- Step Pill Badge -->
                <div
                  data-testid="stepper-stage"
                  class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500 whitespace-nowrap shadow-sm"
                  :class="[
                    idx < activeStageIndex
                      ? 'bg-accent-500/10 border-accent-500/40 text-accent-500 shadow-[0_0_12px_rgba(207,255,80,0.15)]'
                      : idx === activeStageIndex
                        ? stageActivePillStyle(stage.id)
                        : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'
                  ]"
                >
                  <Icon :name="idx < activeStageIndex ? 'ri:check-line' : stage.icon" class="text-sm" />
                  <span>{{ stage.label }}</span>
                </div>

                <!-- Connecting Line between badges -->
                <div
                  v-if="idx < PIPELINE_STAGES.length - 1"
                  class="w-6 sm:w-8 h-px transition-colors duration-500"
                  :class="idx < activeStageIndex ? 'bg-accent-500/50' : 'bg-surface-border/30'"
                ></div>
              </template>
            </div>

            <!-- Telemetry & Progress Deck (Card style) -->
            <div class="w-full bg-surface-dark/80 border border-surface-border/60 rounded-2xl p-4 sm:p-5 z-10 backdrop-blur-md shadow-2xl mb-3 text-left">
              <!-- Top Row: Percentage, Frame Counter & Live Timers -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-baseline gap-2">
                  <span class="text-lg sm:text-xl font-black tracking-tight text-accent-500 tabular-nums">
                    {{ Math.round(effectiveProgress) }}%
                  </span>
                  <span v-if="renderStage === 'rendering' && renderFrame > 0 && renderTotalFrames > 0" class="text-xs text-slate-300">
                    Frame {{ renderFrame }} / {{ renderTotalFrames }} · 30 FPS
                  </span>
                  <span v-else class="text-xs text-slate-400">
                    Remotion 30 FPS
                  </span>
                </div>

                <!-- Live Timers (Elapsed & Countdown ETA) -->
                <div class="flex items-center gap-2.5 text-xs">
                  <div class="flex items-center gap-1 text-slate-300">
                    <Icon name="ri:time-line" class="text-xs text-slate-500" />
                    <span>{{ elapsedFormatted }}</span>
                  </div>
                  <div v-if="etaFormatted" class="flex items-center gap-1 text-slate-300">
                    <span class="text-slate-700">|</span>
                    <span class="text-slate-500">ETA:</span>
                    <span class="text-accent-400 font-bold">{{ etaFormatted }}</span>
                  </div>
                  <div v-else-if="activeStageIndex === 0 || (activeStageIndex === 1 && renderFrame === 0)" class="text-slate-500 text-[11px]">
                    prep...
                  </div>
                </div>
              </div>

              <!-- Progress Bar with Luminous Animated Shimmer Wave -->
              <div class="relative h-2.5 bg-surface-border/40 rounded-full overflow-hidden p-[1px]">
                <div
                  class="relative h-full bg-gradient-to-r from-accent-500 via-emerald-400 to-accent-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(207,255,80,0.5)] overflow-hidden"
                  :style="{ width: `${effectiveProgress}%` }"
                >
                  <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer-wave"></div>
                </div>
              </div>
            </div>

            <!-- Rotating Creator Pro Tips Pill (Fixed Height 48px to Eliminate Layout Shift) -->
            <div class="w-full bg-surface-dark/50 border border-surface-border/40 rounded-xl px-4 py-2 z-10 flex items-center gap-3 text-left backdrop-blur-sm h-12 min-h-[48px] max-h-[48px] overflow-hidden">
              <div class="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Icon name="ri:lightbulb-fill" class="text-xs text-amber-400" />
              </div>
              <div class="flex-1 min-w-0 flex items-center h-full">
                <Transition mode="out-in" enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-1" leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0 -translate-y-1">
                  <p :key="currentTipIndex" class="text-[11px] text-slate-300 font-medium leading-snug line-clamp-2">
                    {{ PRO_TIPS[currentTipIndex] }}
                  </p>
                </Transition>
              </div>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- STATE 2: SUCCESS CELEBRATION STATE -->
          <!-- ========================================================= -->
          <div v-else-if="renderStatus === 'done'" key="done" class="w-full flex flex-col items-center justify-center">
            <!-- Hero Centerpiece Spinner (Double Check / Ready) -->
            <div class="relative mb-10 z-10 flex items-center justify-center">
              <div
                class="w-28 h-28 rounded-full border-[4px] border-surface-border relative z-10 flex items-center justify-center shadow-[0_0_30px_#CFFF50_inset,0_0_50px_rgba(207,255,80,0.4)]"
              >
                <div class="absolute inset-[-4px] rounded-full border-[4px] border-transparent border-t-accent-500"></div>
                <Icon name="ri:check-double-fill" class="text-5xl text-accent-500 animate-in zoom-in-75 duration-500" />
              </div>
            </div>

            <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10">
              Clip Rendered Successfully!
            </h2>
            <p class="text-slate-400 text-sm max-w-md mb-8 z-10 font-medium">
              Rendered in <span class="text-accent-400 font-bold font-mono">{{ finalElapsedDuration }}</span> · Full HD 1080x1920 MP4
            </p>

            <!-- Action Buttons -->
            <div class="flex items-center gap-3 z-10">
              <button
                data-testid="preview-close-btn"
                @click="dismissOverlay"
                class="px-6 py-2.5 rounded-full border border-surface-border text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Preview / Close
              </button>
              <button
                data-testid="download-btn"
                @click="downloadVideo"
                class="px-6 py-2.5 rounded-full bg-accent-500 hover:bg-accent-400 text-black text-xs font-extrabold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(207,255,80,0.4)] flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Icon name="ri:download-2-fill" class="text-sm" />
                <span>Download Video</span>
              </button>
            </div>
          </div>

          <!-- ========================================================= -->
          <!-- STATE 3: ERROR STATE -->
          <!-- ========================================================= -->
          <div v-else-if="renderStatus === 'error'" key="error" class="w-full flex flex-col items-center justify-center">
            <!-- Hero Centerpiece Spinner (Error Warning) -->
            <div class="relative mb-10 z-10 flex items-center justify-center">
              <div class="absolute w-40 h-40 bg-rose-500/15 rounded-full blur-[60px]"></div>
              <div
                class="w-28 h-28 rounded-full border-[4px] border-rose-500/20 relative z-10 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)_inset,0_0_40px_rgba(239,68,68,0.3)]"
              >
                <Icon name="ri:error-warning-fill" class="text-4xl text-rose-500" />
              </div>
            </div>

            <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10 uppercase">
              Render Encountered an Issue
            </h2>
            <p class="text-slate-400 text-sm max-w-md mb-8 z-10 font-medium">
              {{ jobError || 'An unexpected error occurred during Remotion video rendering.' }}
            </p>

            <!-- Action Buttons -->
            <div class="flex items-center gap-3 z-10">
              <button
                data-testid="dismiss-error-btn"
                @click="dismissOverlay"
                class="px-6 py-2.5 rounded-full border border-surface-border text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              >
                Dismiss
              </button>
              <button
                data-testid="retry-render-btn"
                @click="retryRender"
                class="px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-2"
              >
                <Icon name="ri:refresh-line" class="text-sm" />
                <span>Retry Render</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const state = useClipperState()

// 3-STAGE CANONICAL PIPELINE SPECIFICATION (MATCHING PIPELINEOVERLAY.VUE EXACTLY)
const PIPELINE_STAGES = [
  { id: 'bundle', label: 'Bundle', icon: 'ri:code-box-line' },
  { id: 'render', label: 'Render', icon: 'ri:film-line' },
  { id: 'encode', label: 'Encode', icon: 'ri:music-2-line' }
]

// CURATED CREATOR PRO TIPS (4s cycle)
const PRO_TIPS = [
  'Bold text with high-contrast outlines significantly improves caption readability on mobile feeds.',
  'Keeping subtitle word counts to 1–3 words per chunk boosts viewer retention by up to 24%.',
  'Always check Social Safe Zones to ensure platform UI buttons don\'t cover your captions.',
  'Adding an Elastic Spring Pop animation creates energetic pacing that captures viewers in the first 3s.',
  'Automated audio bleeping protects your clips from profanity shadowbans on TikTok and Instagram Reels.',
  'Highlighting spoken words with vibrant colors seamlessly guides your viewer\'s attention.'
]

// Reactive state references
const renderStatus = computed(() => state?.renderStatus?.value || 'idle')
const renderProgress = computed(() => state?.renderProgress?.value || 0)
const renderStage = computed(() => state?.renderStage?.value || '')
const renderEta = computed(() => state?.renderEta?.value || 0)
const renderFrame = computed(() => state?.renderFrame?.value || 0)
const renderTotalFrames = computed(() => state?.renderTotalFrames?.value || 0)
const jobError = computed(() => state?.jobError?.value || '')
const outputUrl = computed(() => state?.outputUrl?.value || null)

// Visibility
const isVisible = computed(() => {
  return renderStatus.value === 'rendering' || renderStatus.value === 'done' || renderStatus.value === 'error'
})

// Stage Mapping (3 Canonical Pipeline Stages)
const activeStageIndex = computed(() => {
  if (renderStatus.value === 'done') return 3
  const stage = renderStage.value
  if (stage === 'starting' || stage === 'bundling') return 0
  if (stage === 'rendering') return 1
  if (stage === 'encoding') return 2
  return 0
})

// Visual Styles matching PipelineOverlay.vue
const ambientGlowColor = computed(() => {
  if (renderStatus.value === 'error') return 'bg-rose-500/10'
  if (renderStatus.value === 'done') return 'opacity-0'
  switch (activeStageIndex.value) {
    case 0:
      return 'bg-sky-500/8'
    case 1:
      return renderFrame.value === 0 ? 'bg-violet-500/8' : 'bg-accent-500/8'
    default:
      return 'bg-accent-500/8'
  }
})

const spinnerPulseColor = computed(() => {
  switch (activeStageIndex.value) {
    case 0:
      return 'bg-sky-500/10'
    case 1:
      return renderFrame.value === 0 ? 'bg-violet-500/10' : 'bg-accent-500/10'
    default:
      return 'bg-accent-500/10'
  }
})

const spinnerGlowShadow = computed(() => {
  switch (activeStageIndex.value) {
    case 0:
      return 'shadow-[0_0_30px_#38bdf8_inset,0_0_50px_rgba(56,189,248,0.4)]'
    case 1:
      return renderFrame.value === 0
        ? 'shadow-[0_0_30px_#a78bfa_inset,0_0_50px_rgba(167,139,250,0.4)]'
        : 'shadow-[0_0_30px_#CFFF50_inset,0_0_50px_rgba(207,255,80,0.4)]'
    default:
      return 'shadow-[0_0_30px_#CFFF50_inset,0_0_50px_rgba(207,255,80,0.4)]'
  }
})

const spinnerBorderAccent = computed(() => {
  switch (activeStageIndex.value) {
    case 0:
      return 'border-t-sky-500'
    case 1:
      return renderFrame.value === 0 ? 'border-t-violet-400' : 'border-t-accent-500'
    default:
      return 'border-t-accent-500'
  }
})

const spinnerIconColor = computed(() => {
  switch (activeStageIndex.value) {
    case 0:
      return 'text-sky-400'
    case 1:
      return renderFrame.value === 0 ? 'text-violet-400' : 'text-accent-500'
    default:
      return 'text-accent-500'
  }
})

const currentStageIcon = computed(() => {
  if (activeStageIndex.value === 0) {
    return renderStage.value === 'starting' ? 'ri:folder-video-fill' : 'ri:code-box-fill'
  }
  if (activeStageIndex.value === 1) {
    return renderFrame.value === 0 ? 'ri:cpu-fill' : 'ri:film-fill'
  }
  if (activeStageIndex.value === 2) {
    return 'ri:music-2-fill'
  }
  return 'ri:movie-2-fill'
})

function stageActivePillStyle(stageId: string): string {
  if (stageId === 'bundle') {
    return 'bg-sky-500/10 border-sky-500/40 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
  }
  if (stageId === 'render') {
    return renderFrame.value === 0
      ? 'bg-violet-500/10 border-violet-500/40 text-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.25)]'
      : 'bg-accent-500/10 border-accent-500/40 text-accent-400 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
  }
  return 'bg-accent-500/10 border-accent-500/40 text-accent-400 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
}

const currentStageTitle = computed(() => {
  if (activeStageIndex.value === 0) {
    return renderStage.value === 'starting' ? 'Preparing Assets' : 'Bundling Assets'
  }
  if (activeStageIndex.value === 1) {
    return renderFrame.value === 0 ? 'Preparing Renderer' : 'Rendering Clip...'
  }
  if (activeStageIndex.value === 2) {
    return 'Encoding Clip...'
  }
  return 'Rendering Your Clip'
})

const currentStatusMessage = computed(() => {
  const stage = renderStage.value
  if (stage === 'starting') return 'Assembling clip timeline, tracks & style configurations...'
  if (stage === 'bundling') return 'Bundling Remotion React animation components...'
  if (stage === 'rendering') {
    if (renderFrame.value === 0) {
      return 'Engine & Canvas Prep: Launching Chromium renderer & hydrating Google Fonts...'
    }
    return renderTotalFrames.value > 0
      ? `Frame Rendering: Processing frame ${renderFrame.value} of ${renderTotalFrames.value}...`
      : 'Frame Rendering: Processing high-fps frames with kinetic typography...'
  }
  if (stage === 'encoding') {
    return 'Encoding: Muxing audio bleeps & encoding final H.264 video...'
  }
  return 'Processing video export...'
})

// ----------------------------------------------------
// PERCEIVED PROGRESS MICRO-CREEP
// ----------------------------------------------------
const microCreepProgress = ref(0)
let microCreepTimer: ReturnType<typeof setInterval> | null = null

function startMicroCreep() {
  stopMicroCreep()
  microCreepProgress.value = 15
  microCreepTimer = setInterval(() => {
    if (renderStage.value === 'rendering' && renderFrame.value === 0 && microCreepProgress.value < 22) {
      microCreepProgress.value += 0.3
    }
  }, 400)
}

function stopMicroCreep() {
  if (microCreepTimer) {
    clearInterval(microCreepTimer)
    microCreepTimer = null
  }
}

watch(
  [() => renderStage.value, () => renderFrame.value],
  ([newStage, newFrame]) => {
    if (newStage === 'rendering' && newFrame === 0) {
      startMicroCreep()
    } else {
      stopMicroCreep()
    }
  },
  { immediate: true }
)

const maxObservedProgress = ref(0)

const effectiveProgress = computed(() => {
  if (renderStatus.value === 'done') return 100
  let current = renderProgress.value
  if (renderStage.value === 'rendering' && renderFrame.value === 0) {
    current = Math.max(current, microCreepProgress.value)
  } else if (renderStage.value === 'encoding') {
    current = Math.max(current, 96)
  }
  if (current > maxObservedProgress.value) {
    maxObservedProgress.value = current
  }
  return Math.max(current, maxObservedProgress.value)
})

// ----------------------------------------------------
// TIMERS: ELAPSED TIME & DYNAMIC ETA
// ----------------------------------------------------
const elapsedMs = ref(0)
const finalElapsedDuration = ref('00:00')
let elapsedTicker: ReturnType<typeof setInterval> | null = null
let renderStartTime = 0

// Active countdown ETA ticker
const remainingEtaSeconds = ref<number | null>(null)
let etaTicker: ReturnType<typeof setInterval> | null = null

function startEtaTicker() {
  stopEtaTicker()
  etaTicker = setInterval(() => {
    if (remainingEtaSeconds.value !== null && remainingEtaSeconds.value > 0) {
      remainingEtaSeconds.value -= 1
    }
  }, 1000)
}

function stopEtaTicker() {
  if (etaTicker) {
    clearInterval(etaTicker)
    etaTicker = null
  }
}

watch(
  () => renderEta.value,
  (newEta) => {
    if (newEta && newEta > 0) {
      remainingEtaSeconds.value = newEta
    } else if (!newEta || newEta <= 0) {
      if (renderStage.value !== 'rendering' || renderFrame.value === 0) {
        remainingEtaSeconds.value = null
      }
    }
  },
  { immediate: true }
)

function startElapsedTicker() {
  stopElapsedTicker()
  startEtaTicker()
  maxObservedProgress.value = 0
  renderStartTime = Date.now()
  elapsedMs.value = 0
  elapsedTicker = setInterval(() => {
    elapsedMs.value = Date.now() - renderStartTime
  }, 100)
}

function stopElapsedTicker() {
  if (elapsedTicker) {
    clearInterval(elapsedTicker)
    elapsedTicker = null
  }
  stopEtaTicker()
}

function formatDurationSeconds(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.floor(totalSeconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const elapsedFormatted = computed(() => {
  return formatDurationSeconds(elapsedMs.value / 1000)
})

const etaFormatted = computed(() => {
  const eta = remainingEtaSeconds.value !== null ? remainingEtaSeconds.value : renderEta.value
  if (!eta || eta <= 0) return null
  if (eta >= 60) {
    const mins = Math.floor(eta / 60)
    const secs = eta % 60
    return `~${mins}m ${secs}s remaining`
  }
  return `~${eta}s remaining`
})

watch(
  () => renderStatus.value,
  (newStatus, oldStatus) => {
    if (newStatus === 'rendering') {
      startElapsedTicker()
    } else if (oldStatus === 'rendering') {
      finalElapsedDuration.value = elapsedFormatted.value
      stopElapsedTicker()
      stopMicroCreep()
    }
  },
  { immediate: true }
)

// ----------------------------------------------------
// ROTATING CREATOR PRO TIPS (4s cycle)
// ----------------------------------------------------
const currentTipIndex = ref(0)
let tipTimer: ReturnType<typeof setInterval> | null = null

function startTipRotation() {
  stopTipRotation()
  tipTimer = setInterval(() => {
    currentTipIndex.value = (currentTipIndex.value + 1) % PRO_TIPS.length
  }, 4000)
}

function stopTipRotation() {
  if (tipTimer) {
    clearInterval(tipTimer)
    tipTimer = null
  }
}

onMounted(() => {
  startTipRotation()
})

onUnmounted(() => {
  stopTipRotation()
  stopElapsedTicker()
  stopMicroCreep()
})

// ----------------------------------------------------
// ACTIONS: DOWNLOAD, DISMISS, RETRY
// ----------------------------------------------------
function downloadVideo() {
  if (!outputUrl.value) return
  const link = document.createElement('a')
  link.href = outputUrl.value
  link.download = outputUrl.value.split('/').pop() || 'yonru_clip.mp4'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function dismissOverlay() {
  if (state?.renderStatus) {
    state.renderStatus.value = 'idle'
  }
}

async function retryRender() {
  if (state?.renderClip) {
    await state.renderClip(0)
  }
}
</script>

<style scoped>
@keyframes shimmerWave {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

.animate-shimmer-wave {
  animation: shimmerWave 2s infinite linear;
}
</style>
