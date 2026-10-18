<template>
  <div
    id="settings-whisper"
    key="whisper"
    class="scroll-mt-24 flex flex-col gap-6"
  >
    <div>
      <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <Icon name="ri:cpu-fill" class="text-accent-500" />
        Transcription Engine (Whisper)
      </h3>
      <p class="text-sm text-slate-400">
        Choose the AI model size used for local transcription. Larger models are
        more accurate but slower and require more VRAM/CPU.
      </p>
    </div>

    <!-- Compact Hardware Status Bar -->
    <!-- Case A: Scanning in progress -->
    <div
      v-if="detectingHardware"
      class="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-dark/60 border border-surface-border text-xs text-slate-300"
    >
      <Icon
        name="ri:loader-4-line"
        class="animate-spin text-accent-500 text-base shrink-0"
      />
      <span class="font-medium"
        >Analyzing CPU, RAM, and hardware acceleration capabilities...</span
      >
    </div>

    <!-- Case B: Detected Profile Available (Slim Unified Bar) -->
    <div
      v-else-if="hardwareProfile"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-surface-dark/70 border border-surface-border/70 text-xs"
    >
      <div class="flex items-center gap-2.5 flex-wrap min-w-0">
        <span class="flex items-center gap-1.5 font-medium text-slate-200">
          <Icon name="ri:cpu-line" class="text-accent-500 shrink-0" />
          <span class="truncate" :title="hardwareProfile.cpu.brand">{{
            hardwareProfile.cpu.brand
          }}</span>
          <span class="text-[10px] text-slate-500 font-mono"
            >({{ hardwareProfile.cpu.cores }} cores)</span
          >
        </span>
        <span class="text-slate-600 hidden sm:inline">•</span>
        <span class="flex items-center gap-1.5 font-medium text-slate-200">
          <Icon name="ri:database-2-line" class="text-accent-500 shrink-0" />
          <span>{{ hardwareProfile.memory.total_gb }} GB RAM</span>
        </span>
        <span class="text-slate-600 hidden sm:inline">•</span>
        <span class="flex items-center gap-1.5 font-medium text-slate-200">
          <Icon name="ri:artboard-line" class="text-accent-500 shrink-0" />
          <span class="truncate" :title="hardwareProfile.gpu.name">{{
            hardwareProfile.gpu.name
          }}</span>
        </span>
      </div>

      <div class="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
        <button
          :disabled="detectingHardware"
          class="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg hover:bg-surface-dark border border-surface-border/60 transition-colors cursor-pointer disabled:opacity-50 font-medium"
          title="Re-scan hardware capabilities"
          @click="emit('detectHardware')"
        >
          <Icon
            name="ri:refresh-line"
            :class="{ 'animate-spin': detectingHardware }"
            class="text-accent-500"
          />
          <span>Re-scan</span>
        </button>
      </div>
    </div>

    <!-- Case C: Initial State / Unscanned (Slim Sleek Banner) -->
    <div
      v-else
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-surface-dark/50 border border-surface-border text-xs"
    >
      <div class="flex items-center gap-2.5 text-slate-300">
        <Icon name="ri:time-line" class="text-accent-500 text-base shrink-0" />
        <span class="leading-relaxed"
          >Calculate estimated transcription speed based on your computer
          hardware.</span
        >
      </div>
      <button
        :disabled="detectingHardware"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs rounded-lg transition-all shadow-sm shrink-0 cursor-pointer self-start sm:self-center"
        @click="emit('detectHardware')"
      >
        <Icon name="ri:timer-flash-line" class="text-xs" />
        <span>Calculate Speed</span>
      </button>
    </div>

    <!-- Model Grid (Streamlined, Clean, Breathable) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
      <button
        v-for="model in state.whisperModels"
        :key="model.id"
        class="flex flex-col p-4 rounded-xl border text-left transition-all group relative cursor-pointer"
        :class="[
          state.whisperModel.value === model.id
            ? 'bg-accent-500/10 border-accent-500 shadow-sm'
            : 'bg-surface-dark/50 border-surface-border hover:border-accent-500/40 hover:bg-surface-dark/70'
        ]"
        @click="state.whisperModel.value = model.id"
      >
        <!-- Card Header -->
        <div class="flex justify-between items-center mb-2 gap-2">
          <span
            class="font-black uppercase tracking-wider text-xs"
            :class="
              state.whisperModel.value === model.id
                ? 'text-accent-500'
                : 'text-slate-200'
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
            class="text-base shrink-0 transition-colors"
            :class="
              state.whisperModel.value === model.id
                ? 'text-accent-500'
                : 'text-slate-600 group-hover:text-slate-400'
            "
          />
        </div>

        <!-- Hero Time Metric -->
        <div class="flex items-center gap-2 mb-2.5 text-[11px] font-medium">
          <span
            v-if="hardwareProfile?.model_estimates?.[model.id]"
            class="text-accent-400 font-mono font-bold flex items-center gap-1.5"
          >
            <Icon name="ri:timer-line" class="text-xs" />
            {{ hardwareProfile.model_estimates[model.id].display_text }}
          </span>
          <span v-else class="text-slate-400 flex items-center gap-1.5">
            <Icon name="ri:speed-line" class="text-xs" />
            {{ model.speed }}
          </span>
        </div>

        <!-- Clean Description -->
        <p class="text-[11px] leading-relaxed text-slate-400 flex-1">
          {{ model.desc }}
        </p>

        <!-- Heavy Resource Warning -->
        <div
          v-if="
            hardwareProfile?.model_capacities?.[model.id]?.status === 'heavy'
          "
          class="mt-3 pt-2 border-t border-surface-border/40 flex items-start gap-1.5 text-[10px] text-amber-400/90 font-medium leading-normal"
        >
          <Icon
            name="ri:error-warning-line"
            class="text-xs shrink-0 text-amber-400 mt-0.5"
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
const props = defineProps<{
  hardwareProfile: any;
  detectingHardware: boolean;
}>();

const emit = defineEmits<{
  (e: 'detectHardware'): void;
}>();

const state = useClipperState();
</script>
