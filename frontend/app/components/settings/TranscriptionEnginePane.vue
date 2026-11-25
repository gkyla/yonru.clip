<template>
  <div
    id="settings-whisper"
    key="whisper"
    class="scroll-mt-24 flex flex-col gap-4"
  >
    <div>
      <h2 class="text-base font-bold text-white mb-0.5 flex items-center gap-2">
        <Icon
          name="codicon:voice-mode"
          class="text-accent-500 text-base"
          aria-hidden="true"
        />
        <span>Transcription</span>
      </h2>
      <p class="text-xs text-slate-400 leading-relaxed">
        Choose the model size used for local transcription. Larger models
        improve accuracy at the cost of slower speed and higher memory usage.
      </p>
    </div>

    <!-- Hardware Status Bar -->
    <!-- Case A: Scanning in progress -->
    <div
      v-if="detectingHardware"
      aria-live="polite"
      class="flex items-center gap-2.5 px-3 py-2.5 bg-surface-dark/60 border border-surface-border text-xs text-slate-200"
    >
      <Icon
        name="ri:loader-4-line"
        class="motion-safe:animate-spin text-accent-500 text-sm shrink-0"
        aria-hidden="true"
      />
      <span class="font-medium">
        Analyzing CPU, memory, and GPU capabilities...
      </span>
    </div>

    <!-- Case B: Hardware scan failed -->
    <div
      v-else-if="hardwareError"
      role="alert"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2.5 border border-red-500/35 bg-red-500/10 text-xs"
    >
      <div class="flex items-start gap-2 text-red-200">
        <Icon
          name="ri:error-warning-fill"
          class="text-red-400 text-sm shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <span class="leading-relaxed">{{ hardwareError }}</span>
      </div>
      <button
        type="button"
        :disabled="detectingHardware"
        class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] border border-red-400/40 bg-red-500/15 hover:bg-red-500/25 text-red-100 text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('detectHardware')"
      >
        Retry scan
      </button>
    </div>

    <!-- Case C: Detected Profile Available (Structured Specs) -->
    <div
      v-else-if="hardwareProfile"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-surface-dark/70 border border-surface-border text-xs"
    >
      <dl class="flex flex-wrap items-center gap-x-4 gap-y-1.5 min-w-0">
        <div class="flex items-center gap-1.5">
          <dt class="text-slate-400">CPU:</dt>
          <dd
            class="font-medium text-slate-100 truncate"
            :title="hardwareProfile.cpu.brand"
          >
            {{ hardwareProfile.cpu.brand }}
            <span class="text-slate-400 font-mono text-[11px]">
              ({{ hardwareProfile.cpu.cores }} cores)
            </span>
          </dd>
        </div>

        <div class="flex items-center gap-1.5">
          <dt class="text-slate-400">Memory:</dt>
          <dd class="font-medium text-slate-100">
            {{ hardwareProfile.memory.total_gb }} GB RAM
          </dd>
        </div>

        <div class="flex items-center gap-1.5">
          <dt class="text-slate-400">GPU:</dt>
          <dd
            class="font-medium text-slate-100 truncate"
            :title="hardwareProfile.gpu.name"
          >
            {{ hardwareProfile.gpu.name }}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        :disabled="detectingHardware"
        class="inline-flex items-center justify-center gap-1.5 text-xs text-slate-200 hover:text-white px-2.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-600 transition-colors cursor-pointer disabled:opacity-50 font-medium shrink-0 self-start sm:self-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('detectHardware')"
      >
        <Icon
          name="ri:refresh-line"
          :class="{ 'motion-safe:animate-spin': detectingHardware }"
          class="text-accent-500 text-xs"
          aria-hidden="true"
        />
        <span>Re-scan</span>
      </button>
    </div>

    <!-- Case D: Unscanned Initial State -->
    <div
      v-else
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2.5 bg-surface-dark/50 border border-surface-border text-xs"
    >
      <div class="flex items-center gap-2 text-slate-300">
        <Icon
          name="ri:time-line"
          class="text-accent-500 text-sm shrink-0"
          aria-hidden="true"
        />
        <span class="leading-relaxed">
          Calculate estimated transcription speed based on your computer
          hardware.
        </span>
      </div>
      <button
        type="button"
        :disabled="detectingHardware"
        class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs transition-colors shrink-0 cursor-pointer self-start sm:self-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('detectHardware')"
      >
        <Icon name="ri:speed-up-line" class="text-xs" aria-hidden="true" />
        <span>Calculate Speed</span>
      </button>
    </div>

    <!-- Model Selection Radio Group -->
    <div
      role="radiogroup"
      aria-label="Transcription model"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5"
    >
      <button
        v-for="(model, index) in state.whisperModels"
        :key="model.id"
        :ref="el => setModelCardRef(index, el)"
        type="button"
        role="radio"
        :aria-checked="state.whisperModel.value === model.id"
        :tabindex="state.whisperModel.value === model.id ? 0 : -1"
        class="flex flex-col items-stretch border text-left transition-colors group relative cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        :class="
          state.whisperModel.value === model.id
            ? 'bg-accent-500/10 border-accent-500'
            : 'bg-surface-dark/50 border-surface-border hover:border-slate-500 hover:bg-surface-dark/70'
        "
        @click="state.whisperModel.value = model.id"
        @keydown="onModelKeydown(index, $event)"
      >
        <div class="p-3.5 flex flex-col w-full">
          <div class="flex justify-between items-center mb-1.5 gap-2">
            <span
              class="text-[13px] font-semibold"
              :class="
                state.whisperModel.value === model.id
                  ? 'text-accent-400'
                  : 'text-white'
              "
            >
              {{ model.name }}
            </span>

            <Icon
              :name="
                state.whisperModel.value === model.id
                  ? 'ri:checkbox-circle-fill'
                  : 'ri:checkbox-blank-circle-line'
              "
              class="text-sm shrink-0 transition-colors"
              :class="
                state.whisperModel.value === model.id
                  ? 'text-accent-500'
                  : 'text-slate-500 group-hover:text-slate-300'
              "
              aria-hidden="true"
            />
          </div>

          <div class="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium">
            <span
              v-if="hardwareProfile?.model_estimates?.[model.id]"
              class="text-accent-400 font-mono font-semibold flex items-center gap-1"
            >
              <Icon name="ri:timer-line" class="text-xs" aria-hidden="true" />
              <span>{{
                hardwareProfile.model_estimates[model.id].display_text
              }}</span>
            </span>
            <span v-else class="text-slate-300 flex items-center gap-1">
              <Icon name="ri:speed-line" class="text-xs" aria-hidden="true" />
              <span>{{ model.speed }}</span>
            </span>
          </div>

          <p class="text-[11px] leading-relaxed text-slate-300">
            {{ model.desc }}
          </p>
        </div>

        <div
          v-if="
            hardwareProfile?.model_capacities?.[model.id]?.status === 'heavy'
          "
          data-testid="heavy-model-warning"
          class="flex-1 w-full px-3.5 py-2.5 border-t flex items-start gap-2 text-[11px] text-amber-300 font-medium leading-normal"
          :class="
            state.whisperModel.value === model.id
              ? 'border-accent-500/30 bg-surface-dark/30'
              : 'border-surface-border/60 bg-surface-dark/40'
          "
        >
          <Icon
            name="ri:alert-line"
            class="text-xs shrink-0 text-amber-400 mt-0.5"
            aria-hidden="true"
          />
          <span>
            {{
              hardwareProfile.model_capacities[model.id].warning ||
              'May be slow on your PC'
            }}
          </span>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type { HardwareProfile } from '../../types/clipper';

withDefaults(
  defineProps<{
    hardwareProfile: HardwareProfile | null;
    detectingHardware: boolean;
    hardwareError?: string | null;
  }>(),
  {
    hardwareError: null
  }
);

const emit = defineEmits<{
  (e: 'detectHardware'): void;
}>();

const state = useClipperState();
const modelCardRefs = ref<Array<HTMLButtonElement | null>>([]);

function setModelCardRef(
  index: number,
  el: Element | ComponentPublicInstance | null
) {
  if (el instanceof HTMLButtonElement) {
    modelCardRefs.value[index] = el;
  } else if (el && '$el' in el && el.$el instanceof HTMLButtonElement) {
    modelCardRefs.value[index] = el.$el;
  } else {
    modelCardRefs.value[index] = null;
  }
}

function onModelKeydown(index: number, event: KeyboardEvent) {
  const models = state.whisperModels;
  const count: number = models?.length ?? 0;
  if (!models || count === 0) return;

  let nextIndex: number | null = null;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (index + 1) % count;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (index - 1 + count) % count;
  }

  if (nextIndex === null) return;
  event.preventDefault();
  const nextModel = models[nextIndex];
  if (nextModel) {
    state.whisperModel.value = nextModel.id;
    modelCardRefs.value[nextIndex]?.focus();
  }
}
</script>
