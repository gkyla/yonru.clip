<template>
  <article
    data-testid="ready-clip-card"
    :data-selected="selectable && selected ? 'true' : 'false'"
    class="group relative flex flex-col overflow-hidden transition-colors duration-150"
    :class="
      selectable && selected
        ? 'border border-accent-500/60 bg-accent-500/[0.04]'
        : 'border border-surface-border bg-surface-card hover:border-white/25 hover:bg-surface-panel/70'
    "
    @mouseenter="onCardMouseEnter"
    @mouseleave="onCardMouseLeave"
  >
    <!-- Primary Card Trigger -->
    <button
      type="button"
      data-testid="ready-clip-card-trigger"
      class="flex-1 flex flex-col text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/80"
      @click="handleCardClick"
    >
      <!-- Media Thumbnail / Hover Preview Area -->
      <div class="aspect-video w-full bg-black relative overflow-hidden">
        <img
          v-if="thumbnailSrc && !thumbnailError"
          :src="thumbnailSrc"
          :alt="displayTheme"
          width="640"
          height="360"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover opacity-90 group-hover:opacity-75 transition-opacity duration-200"
          @error="thumbnailError = true"
        />

        <video
          v-else-if="videoSrc && !fallbackVideoError"
          :src="videoSrc"
          loading="lazy"
          preload="metadata"
          muted
          playsinline
          width="640"
          height="360"
          class="w-full h-full object-cover opacity-85"
          @error="fallbackVideoError = true"
        ></video>

        <div
          v-else
          class="w-full h-full flex items-center justify-center bg-surface-panel/60 text-slate-500"
        >
          <Icon name="ri:film-line" class="text-3xl" aria-hidden="true" />
        </div>

        <!-- Hover-Intent Video Preview (Mounted only after 150ms hover when not selecting) -->
        <video
          v-if="isHoverPreviewMounted && videoSrc"
          ref="hoverVideoRef"
          data-testid="ready-clip-hover-video"
          :src="videoSrc"
          muted
          loop
          playsinline
          preload="auto"
          width="640"
          height="360"
          class="absolute inset-0 w-full h-full object-cover transition-opacity duration-200 pointer-events-none"
          :class="isHoverVideoReady ? 'opacity-100' : 'opacity-0'"
          @canplay="onHoverVideoReady"
        ></video>

        <!-- Center Play Cue (Browse Mode only) -->
        <div
          v-if="!(selectable && selectionActive)"
          class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          aria-hidden="true"
        >
          <div
            class="w-10 h-10 bg-black/75 border border-white/20 flex items-center justify-center text-accent-500"
          >
            <Icon name="ri:play-fill" class="text-lg" />
          </div>
        </div>

        <!-- Bottom Overlay Chips (Channel Left, Duration Right) -->
        <div
          class="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between gap-2"
        >
          <span
            v-if="displayChannel"
            data-testid="ready-clip-channel"
            class="bg-black/85 border border-white/10 px-2 py-0.5 text-xs font-medium text-slate-200 truncate min-w-0 max-w-[60%]"
          >
            {{ displayChannel }}
          </span>
          <span
            data-testid="ready-clip-duration"
            class="ml-auto shrink-0 bg-black/85 border border-white/10 px-2 py-0.5 text-xs font-medium text-white tabular-nums"
          >
            {{ formattedDuration }}
          </span>
        </div>
      </div>

      <!-- Metadata Footer (Clean 2-line hierarchy: Clip title + Video title; calm surface with zero divider border) -->
      <div
        data-testid="ready-clip-footer"
        class="p-3.5 sm:p-4 flex-1 flex flex-col gap-1"
      >
        <h4
          data-testid="ready-clip-title"
          :title="displayTheme"
          class="text-sm font-semibold text-white line-clamp-1 leading-snug"
        >
          {{ displayTheme }}
        </h4>
        <p
          data-testid="ready-clip-source-title"
          :title="displaySourceTitle"
          class="text-xs text-slate-400 truncate leading-snug"
        >
          {{ displaySourceTitle }}
        </p>
      </div>
    </button>

    <!-- Sibling Top-Left Selection Checkbox (Modal Only) -->
    <button
      v-if="selectable"
      type="button"
      role="checkbox"
      data-testid="ready-clip-select-checkbox"
      :aria-checked="selected"
      :aria-label="
        selected
          ? `Deselect clip ${displayTheme}`
          : `Select clip ${displayTheme}`
      "
      class="absolute top-0.5 left-0.5 z-20 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center cursor-pointer transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      :class="
        selected || selectionActive
          ? 'opacity-100'
          : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100'
      "
      @click.stop="handleCheckboxClick"
    >
      <span
        class="w-5 h-5 border flex items-center justify-center transition-colors duration-150"
        :class="
          selected
            ? 'bg-accent-500 border-accent-500 text-black'
            : 'bg-black/80 border-white/45 text-transparent hover:border-white'
        "
      >
        <Icon
          v-if="selected"
          name="ri:check-line"
          class="text-sm font-bold"
          aria-hidden="true"
        />
      </span>
    </button>

    <!-- Sibling Top-Right Dedicated Delete Button -->
    <button
      type="button"
      data-testid="ready-clip-delete-btn"
      :aria-label="`Delete clip ${displayTheme}`"
      title="Delete clip"
      class="absolute top-0.5 right-0.5 z-20 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center cursor-pointer transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      :class="'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100'"
      @click.stop="emit('request-delete', clip)"
    >
      <span
        class="w-7 h-7 bg-black/80 border border-white/20 text-slate-300 hover:bg-red-600 hover:border-red-500 hover:text-white flex items-center justify-center transition-colors duration-150"
      >
        <Icon name="ri:delete-bin-line" class="text-sm" aria-hidden="true" />
      </span>
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import type { ReadyClip } from '../../types/clipper';
import { formatClipDuration } from '../../composables/useReadyClipsLibrary';

const HOVER_INTENT_DELAY_MS = 150;

const props = withDefaults(
  defineProps<{
    clip: ReadyClip;
    apiBase: string;
    selectable?: boolean;
    selected?: boolean;
    selectionActive?: boolean;
  }>(),
  {
    selectable: false,
    selected: false,
    selectionActive: false
  }
);

const emit = defineEmits<{
  open: [clip: ReadyClip];
  'toggle-select': [payload: { clip: ReadyClip; shiftKey: boolean }];
  'request-delete': [clip: ReadyClip];
}>();

const thumbnailError = ref(false);
const fallbackVideoError = ref(false);
const isHoverPreviewMounted = ref(false);
const isHoverVideoReady = ref(false);
const hoverVideoRef = ref<HTMLVideoElement | null>(null);
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

function resolveMediaUrl(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${props.apiBase}${path}`;
}

const thumbnailSrc = computed(() => resolveMediaUrl(props.clip.thumbnail_url));
const videoSrc = computed(() => resolveMediaUrl(props.clip.asset_url));
const displayTheme = computed(() => props.clip.theme || 'Untitled Clip');
const displayChannel = computed(() => (props.clip.channel || '').trim());
const displaySourceTitle = computed(
  () => props.clip.title || props.clip.folder_name
);
const formattedDuration = computed(() =>
  formatClipDuration(props.clip.duration)
);

watch(
  () => props.clip.thumbnail_url,
  () => {
    thumbnailError.value = false;
  }
);

watch(
  () => props.clip.asset_url,
  () => {
    fallbackVideoError.value = false;
    clearHoverPreview();
  }
);

watch(
  () => props.selectionActive,
  active => {
    if (active) {
      clearHoverPreview();
    }
  }
);

function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearHoverTimer(): void {
  if (hoverTimer !== null) {
    clearTimeout(hoverTimer);
    hoverTimer = null;
  }
}

function clearHoverPreview(): void {
  clearHoverTimer();
  isHoverPreviewMounted.value = false;
  isHoverVideoReady.value = false;
}

function onCardMouseEnter(): void {
  if (props.selectionActive || !videoSrc.value || prefersReducedMotion()) {
    return;
  }
  clearHoverTimer();
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    if (!props.selectionActive && videoSrc.value) {
      isHoverPreviewMounted.value = true;
    }
  }, HOVER_INTENT_DELAY_MS);
}

function onCardMouseLeave(): void {
  clearHoverPreview();
}

function onHoverVideoReady(): void {
  isHoverVideoReady.value = true;
  const videoEl = hoverVideoRef.value;
  if (!videoEl) return;
  try {
    const playPromise = videoEl.play?.();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore autoplay blocks or unready test media elements.
  }
}

function handleCardClick(event: MouseEvent): void {
  if (props.selectable && props.selectionActive) {
    emit('toggle-select', { clip: props.clip, shiftKey: event.shiftKey });
    return;
  }
  emit('open', props.clip);
}

function handleCheckboxClick(event: MouseEvent): void {
  emit('toggle-select', { clip: props.clip, shiftKey: event.shiftKey });
}

onUnmounted(() => {
  clearHoverPreview();
});
</script>
