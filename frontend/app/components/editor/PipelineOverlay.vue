<template>
  <Transition
    enter-active-class="transition duration-400 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-show="isOverlayVisible"
      class="absolute inset-0 z-[70] bg-[#060608]/95 backdrop-blur-xl flex flex-col items-center justify-center text-center"
    >
      <template v-if="state.jobStatus.value === 'error'">
        <div
          class="absolute w-[50vw] h-[50vw] rounded-full blur-[160px] -top-1/3 -right-1/3 mix-blend-screen bg-rose-500/10 pointer-events-none"
        ></div>
        <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

        <div class="relative mb-8 z-10 flex items-center justify-center">
          <div class="absolute w-40 h-40 bg-rose-500/10 rounded-full blur-[60px]"></div>
          <div
            class="w-24 h-24 rounded-full border-[4px] border-rose-500/20 relative z-10 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)_inset,0_0_40px_rgba(239,68,68,0.3)]"
          >
            <Icon name="ri:error-warning-fill" class="text-4xl text-rose-500" />
          </div>
        </div>

        <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10 uppercase italic">
          Extraction Failed
        </h2>
        <p class="text-slate-400 text-sm max-w-md mb-8 px-4 z-10 leading-relaxed font-medium">
          {{ state.jobError.value || 'An unexpected error occurred during clip ingestion.' }}
        </p>

        <div class="flex items-center gap-4 z-10">
          <button
            @click="emit('error-back')"
            class="px-6 py-2.5 rounded-full border border-surface-border text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            Go Back
          </button>
          <button
            v-if="state.activeHook.value"
            @click="emit('error-retry')"
            class="px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            Retry Cut
          </button>
        </div>
      </template>
      <template v-else>
        <!-- Ambient glow -->
        <div
          class="absolute w-[50vw] h-[50vw] rounded-full blur-[160px] -top-1/3 -right-1/3 mix-blend-screen transition-colors duration-1000"
          :class="
            pipelineStep === 'cutting'
              ? 'bg-sky-500/8'
              : pipelineStep === 'transcribing'
                ? 'bg-violet-500/8'
                : state.isMediaLoading?.value
                  ? 'bg-accent-500/8'
                  : ''
          "
        ></div>
        <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

        <!-- Main spinner -->
        <div class="relative mb-10 z-10 flex items-center justify-center">
          <div class="absolute w-40 h-40 bg-accent-500/10 rounded-full blur-[60px] animate-pulse"></div>
          <div
            class="w-28 h-28 rounded-full border-[4px] border-surface-border relative transition-all duration-700 z-10 flex items-center justify-center"
            :class="
              pipelineStep === 'cutting'
                ? 'shadow-[0_0_30px_#38bdf8_inset,0_0_50px_rgba(56,189,248,0.4)]'
                : pipelineStep === 'transcribing'
                  ? 'shadow-[0_0_30px_#a78bfa_inset,0_0_50px_rgba(167,139,250,0.4)]'
                  : 'shadow-[0_0_30px_#CFFF50_inset,0_0_50px_rgba(207,255,80,0.4)]'
            "
          >
            <div
              class="absolute inset-[-4px] rounded-full border-[4px] border-transparent animate-spin transition-colors duration-700"
              :class="
                pipelineStep === 'cutting'
                  ? 'border-t-sky-500'
                  : pipelineStep === 'transcribing'
                    ? 'border-t-violet-400'
                    : 'border-t-accent-500'
              "
            ></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <!-- Scissors (Cutting) -->
              <Icon
                name="ri:scissors-cut-fill"
                class="absolute text-4xl text-sky-400 transition-all duration-300 ease-out transform"
                :class="
                  pipelineStep === 'cutting' && state.jobStatus.value !== 'ready'
                    ? 'opacity-100 scale-100 animate-pulse'
                    : 'opacity-0 scale-75 pointer-events-none'
                "
              />

              <!-- Microphone (Transcribing) -->
              <Icon
                name="ri:mic-ai-fill"
                class="absolute text-4xl text-violet-400 transition-all duration-300 ease-out transform"
                :class="
                  pipelineStep === 'transcribing' && state.jobStatus.value !== 'ready'
                    ? 'opacity-100 scale-100 animate-pulse'
                    : 'opacity-0 scale-75 pointer-events-none'
                "
              />

              <!-- Double Check (Ready) -->
              <Icon
                name="ri:check-double-fill"
                class="absolute text-4xl text-accent-500 transition-all duration-300 ease-out transform"
                :class="
                  state.jobStatus.value === 'ready'
                    ? 'opacity-100 scale-100 animate-pulse'
                    : 'opacity-0 scale-75 pointer-events-none'
                "
              />
            </div>
          </div>
        </div>

        <!-- Title -->
        <h2 class="text-2xl font-black tracking-tight text-white mb-2 z-10">
          {{
            pipelineStep === 'cutting'
              ? 'Cutting Segment'
              : pipelineStep === 'transcribing'
                ? `Transcribing (${(state.whisperModel?.value || '').toUpperCase()})`
                : state.isMediaLoading?.value
                  ? 'Loading Media...'
                  : 'Ready!'
          }}
        </h2>
        <p class="text-slate-500 text-sm max-w-sm mb-10 z-10">
          {{
            state.isMediaLoading?.value
              ? 'Synchronizing assets and buffering video stream...'
              : pipelineStep === 'cutting'
                ? 'Extracting clip from cached 1080p video via local FFmpeg...'
                : pipelineStep === 'transcribing'
                  ? `Running Whisper AI ${(state.whisperModel?.value || '').toUpperCase()} for high-precision word-level timestamps...`
                  : 'Finalizing assets and preparing editor...'
          }}
        </p>

        <!-- Step indicators -->
        <div class="flex items-center gap-3 z-10 mb-6">
          <!-- Step 1: Cut -->
          <div
            class="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500"
            :class="
              pipelineStep === 'cutting'
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                : pipelineStepIdx > 0
                  ? 'bg-accent-500/10 border-accent-500/30 text-accent-500'
                  : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'
            "
          >
            <Icon :name="pipelineStepIdx > 0 ? 'ri:check-line' : 'ri:scissors-cut-line'" class="text-sm" />
            <span>Cut</span>
          </div>
          <div
            class="w-8 h-px transition-colors duration-500"
            :class="pipelineStepIdx > 0 ? 'bg-accent-500/50' : 'bg-surface-border/30'"
          ></div>
          <!-- Step 2: Transcribe -->
          <div
            class="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500"
            :class="
              pipelineStep === 'transcribing'
                ? 'bg-violet-500/10 border-violet-500/40 text-violet-400'
                : pipelineStepIdx > 1
                  ? 'bg-accent-500/10 border-accent-500/30 text-accent-500'
                  : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'
            "
          >
            <Icon :name="pipelineStepIdx > 1 ? 'ri:check-line' : 'ri:mic-ai-line'" class="text-sm" />
            <span>Transcribe</span>
          </div>
          <div
            class="w-8 h-px transition-colors duration-500"
            :class="pipelineStepIdx > 1 ? 'bg-accent-500/50' : 'bg-surface-border/30'"
          ></div>
          <!-- Step 3: Ready -->
          <div
            class="flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-widest transition-all duration-500"
            :class="
              pipelineStepIdx > 1
                ? 'bg-accent-500/10 border-accent-500/30 text-accent-500'
                : 'bg-surface-dark/50 border-surface-border/30 text-slate-600'
            "
          >
            <Icon name="ri:check-double-line" class="text-sm" />
            <span>Ready</span>
          </div>
        </div>

        <!-- Hook info -->
        <div
          v-if="state?.activeHook?.value"
          class="bg-surface-dark/60 border border-surface-border/40 rounded-xl px-5 py-3 z-10 max-w-md"
        >
          <p class="text-[10px] uppercase tracking-widest text-slate-600 font-bold mb-1">
            Processing Hook
          </p>
          <p class="text-white font-bold text-sm truncate">
            {{ state?.activeHook?.value?.theme || 'Untitled Hook' }}
          </p>
          <p class="text-slate-500 text-[10px] mt-1 font-mono">
            {{ state?.formatDuration(state?.activeHook?.value?.start) }} →
            {{ state?.formatDuration(state?.activeHook?.value?.end) }}
          </p>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  pipelineStep: string
  pipelineStepIdx: number
}>()

const emit = defineEmits<{
  (e: 'error-back'): void
  (e: 'error-retry'): void
}>()

const state = useClipperState()
const isOverlayVisible = useState<boolean>('isOverlayVisible', () => false)
</script>
