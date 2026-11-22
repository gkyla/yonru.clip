<template>
  <div role="alert" aria-live="assertive" class="px-4 sm:px-8 w-full -mt-5">
    <div
      class="w-full bg-[#0b0c10] border p-4 sm:p-5 rounded-none text-left shadow-xl transition-colors"
      :class="
        originMeta.isExternalOrTransient
          ? 'border-amber-500/40'
          : 'border-red-500/40'
      "
    >
      <!-- Header: Error Origin Badge + Model/Code + Dismiss -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider"
            :class="
              originMeta.isExternalOrTransient
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            "
          >
            <Icon
              :name="originMeta.icon"
              class="text-xs shrink-0"
              aria-hidden="true"
            />
            <span>{{ originMeta.label }}</span>
          </span>

          <span
            v-if="normalizedDetail.model"
            class="px-2 py-0.5 bg-surface-dark border border-surface-border/70 text-[10px] font-mono text-slate-300"
          >
            {{ normalizedDetail.model }}
          </span>
        </div>

        <button
          type="button"
          aria-label="Dismiss error"
          class="-my-2.5 -mr-3 p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white border border-transparent hover:border-surface-border/70 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          @click="emit('dismiss')"
        >
          <Icon name="ri:close-line" class="text-base" aria-hidden="true" />
        </button>
      </div>

      <!-- Plain-Language Title, Explanation & Recovery Hint -->
      <div class="mt-2.5 space-y-1.5">
        <h3 class="text-sm font-bold text-white leading-snug">
          {{ normalizedDetail.title }}
        </h3>
        <p class="text-xs text-slate-300 leading-relaxed max-w-[74ch]">
          {{ normalizedDetail.message }}
        </p>
        <p
          v-if="normalizedDetail.hint"
          class="text-xs text-slate-400 leading-relaxed flex items-start gap-1.5 pt-0.5 max-w-[74ch]"
        >
          <Icon
            name="ri:lightbulb-line"
            class="text-sm text-accent-500 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{{ normalizedDetail.hint }}</span>
        </p>
      </div>

      <!-- Action Bar -->
      <div class="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          v-if="showRetryAction"
          type="button"
          class="min-h-[44px] px-4 py-2 bg-accent-500 hover:bg-accent-400 text-black text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          @click="emit('retry')"
        >
          <Icon name="ri:refresh-line" class="text-sm" aria-hidden="true" />
          <span>Retry</span>
        </button>

        <NuxtLink
          v-if="showSettingsAction"
          to="/settings?tab=api"
          class="min-h-[44px] px-4 py-2 bg-surface-dark hover:bg-white/5 text-slate-200 border border-surface-border/80 hover:border-accent-500/50 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
        >
          <Icon name="ri:equalizer-line" class="text-sm" aria-hidden="true" />
          <span>Open AI Model Settings</span>
        </NuxtLink>

        <button
          v-if="normalizedDetail.raw_error"
          type="button"
          :aria-expanded="showDetails"
          aria-controls="pipeline-error-raw-details"
          class="min-h-[44px] px-3 py-2 bg-black/30 hover:bg-black/50 text-slate-400 hover:text-slate-200 border border-surface-border/60 text-xs font-mono transition-colors inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          @click="showDetails = !showDetails"
        >
          <span>{{
            showDetails ? 'Hide technical details' : 'Technical details'
          }}</span>
          <Icon
            :name="showDetails ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'"
            class="text-sm"
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- Collapsible Raw Provider Output -->
      <pre
        v-if="showDetails && normalizedDetail.raw_error"
        id="pipeline-error-raw-details"
        class="mt-3 p-3 bg-[#07080b] border border-surface-border/60 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40 whitespace-pre-wrap break-words select-all"
        >{{ normalizedDetail.raw_error }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  PipelineErrorDetail,
  PipelineErrorOrigin
} from '../../types/clipper';

const props = withDefaults(
  defineProps<{
    error?: string | null;
    errorDetail?: PipelineErrorDetail | null;
    canRetry?: boolean;
  }>(),
  {
    error: null,
    errorDetail: null,
    canRetry: true
  }
);

const emit = defineEmits<{
  (e: 'retry'): void;
  (e: 'dismiss'): void;
}>();

const showDetails = ref(false);

watch(
  () => [props.error, props.errorDetail?.code, props.errorDetail?.raw_error],
  () => {
    showDetails.value = false;
  }
);

const normalizedDetail = computed<PipelineErrorDetail>(() => {
  if (props.errorDetail) {
    return props.errorDetail;
  }

  const rawMsg = (props.error || '').trim();
  const lower = rawMsg.toLowerCase();

  if (lower.includes('no transcript found')) {
    return {
      origin: 'pipeline',
      code: 'no_transcript',
      title: 'No closed-captions transcript found',
      message: rawMsg,
      hint: 'Choose a video that has YouTube captions or subtitles enabled.',
      retryable: false
    };
  }

  if (
    /\b503\b/.test(lower) ||
    lower.includes('high demand') ||
    lower.includes('unavailable')
  ) {
    return {
      origin: 'provider',
      code: 'high_demand',
      title: 'Gemini is experiencing high demand',
      message:
        rawMsg ||
        "Google's Gemini service is temporarily overloaded. This is an issue on Gemini's side, not a bug in Yonru Clip.",
      hint: 'Wait a moment and retry, or switch to another Hook Discovery Model in Settings > AI Model.',
      retryable: true
    };
  }

  return {
    origin: 'pipeline',
    code: 'pipeline_error',
    title: 'Analysis stopped',
    message: rawMsg || 'An unexpected error stopped the pipeline.',
    hint: 'Check the message above and retry when ready.',
    retryable: true
  };
});

const ORIGIN_META: Record<
  PipelineErrorOrigin,
  { label: string; icon: string; isExternalOrTransient: boolean }
> = {
  provider: {
    label: 'GEMINI SERVICE',
    icon: 'ri:cloud-off-line',
    isExternalOrTransient: true
  },
  config: {
    label: 'API KEY / CONFIG',
    icon: 'ri:key-2-line',
    isExternalOrTransient: false
  },
  network: {
    label: 'NETWORK',
    icon: 'ri:wifi-off-line',
    isExternalOrTransient: true
  },
  output: {
    label: 'AI OUTPUT',
    icon: 'ri:file-warning-line',
    isExternalOrTransient: false
  },
  pipeline: {
    label: 'PIPELINE',
    icon: 'ri:error-warning-line',
    isExternalOrTransient: false
  }
};

const originMeta = computed(
  () => ORIGIN_META[normalizedDetail.value.origin] ?? ORIGIN_META.pipeline
);

const showRetryAction = computed(() => {
  return Boolean(props.canRetry) && normalizedDetail.value.retryable !== false;
});

const showSettingsAction = computed(() => {
  const { origin, code } = normalizedDetail.value;
  return (
    origin === 'config' ||
    code === 'high_demand' ||
    code === 'quota_exceeded' ||
    code === 'model_unavailable'
  );
});
</script>
