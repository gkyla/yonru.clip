<template>
  <!-- Sticky Time Ruler & Pinned Scrubbing Head -->
  <div
    class="sticky top-0 z-40 bg-[#0d0d0f] border-b border-white/5 cursor-pointer select-none timeline-ruler"
    :style="{ height: '24px', width: totalW + 'px' }"
    @mousedown="onRulerMouseDown"
  >
    <div
      ref="rulerContainerRef"
      class="relative h-full ruler-container"
      :style="{ width: totalW + 'px' }"
    >
      <template v-for="tick in rulerTicks" :key="tick.pos">
        <div
          data-testid="ruler-tick"
          class="absolute bottom-0 border-l"
          :class="
            tick.major ? 'border-white/25 h-[10px]' : 'border-white/10 h-[5px]'
          "
          :style="{ left: tick.pos + 'px' }"
        >
          <span
            v-if="tick.label"
            class="absolute -top-[12px] left-[3px] text-[8px] mono text-slate-400 whitespace-nowrap select-none"
            >{{ tick.label }}</span
          >
        </div>
      </template>

      <!-- Scrubbing head stays pinned inside the sticky ruler while tracks scroll vertically -->
      <TimelinePlayhead
        variant="head"
        :px-per-sec="pxPerSec"
        @scrub-start="onRulerMouseDown"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { calculateRulerTicks } from '../../utils/timelineHelpers';
import TimelinePlayhead from './TimelinePlayhead.vue';

export interface RulerScrubStartPayload {
  event: MouseEvent;
  rulerLeft: number;
  startScrollLeft: number;
  computeTimeFromClientX: (
    clientX: number,
    currentScrollLeft?: number
  ) => number;
}

const props = withDefaults(
  defineProps<{
    totalW: number;
    pxPerSec: number;
    containerW: number;
    scrollLeft?: number;
    getScrollLeft?: () => number;
  }>(),
  {
    scrollLeft: 0,
    getScrollLeft: undefined
  }
);

const emit = defineEmits<{
  (e: 'scrub-start', payload: RulerScrubStartPayload): void;
}>();

const rulerContainerRef = ref<HTMLElement | null>(null);

let latestScrollLeft = Math.max(0, props.scrollLeft ?? 0);
let anchorScrollLeft = latestScrollLeft;

function computeWindowBounds(scrollLeft: number): {
  startPx: number;
  endPx: number;
} {
  const w = Math.max(1, props.containerW);
  const clampedScroll = Math.max(0, scrollLeft);
  return {
    startPx: Math.max(0, clampedScroll - w),
    endPx: Math.min(props.totalW, clampedScroll + 2 * w)
  };
}

const windowBounds = ref(computeWindowBounds(latestScrollLeft));

function recenterWindow(scrollLeft: number) {
  const clampedScroll = Math.max(0, scrollLeft);
  anchorScrollLeft = clampedScroll;
  const next = computeWindowBounds(clampedScroll);
  if (
    next.startPx !== windowBounds.value.startPx ||
    next.endPx !== windowBounds.value.endPx
  ) {
    windowBounds.value = next;
  }
}

function syncScrollLeft(nextScrollLeft: number) {
  const clamped = Math.max(0, nextScrollLeft);
  latestScrollLeft = clamped;
  const w = Math.max(1, props.containerW);
  const exitedLeft =
    clamped < anchorScrollLeft - 0.5 * w && windowBounds.value.startPx > 0;
  const exitedRight =
    clamped > anchorScrollLeft + 0.5 * w &&
    windowBounds.value.endPx < props.totalW;
  if (exitedLeft || exitedRight) {
    recenterWindow(clamped);
  }
}

watch(
  () => props.scrollLeft,
  val => {
    syncScrollLeft(val ?? 0);
  }
);

watch(
  [() => props.pxPerSec, () => props.containerW, () => props.totalW],
  () => {
    const activeScroll = props.getScrollLeft
      ? props.getScrollLeft()
      : latestScrollLeft;
    recenterWindow(activeScroll);
  }
);

const rulerTicks = computed(() =>
  calculateRulerTicks(props.totalW, props.pxPerSec, windowBounds.value)
);

function onRulerMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const cachedRulerLeft =
    rulerContainerRef.value?.getBoundingClientRect().left ?? 0;
  const cachedStartScrollLeft = props.getScrollLeft
    ? props.getScrollLeft()
    : latestScrollLeft;

  const computeTimeFromClientX = (
    clientX: number,
    currentScrollLeft?: number
  ) => {
    const liveScrollLeft =
      typeof currentScrollLeft === 'number'
        ? currentScrollLeft
        : props.getScrollLeft
          ? props.getScrollLeft()
          : latestScrollLeft;
    const scrollDelta = liveScrollLeft - cachedStartScrollLeft;
    const x = Math.max(0, clientX - cachedRulerLeft + scrollDelta);
    return props.pxPerSec > 0 ? x / props.pxPerSec : 0;
  };

  emit('scrub-start', {
    event: e,
    rulerLeft: cachedRulerLeft,
    startScrollLeft: cachedStartScrollLeft,
    computeTimeFromClientX
  });
}

defineExpose({
  syncScrollLeft
});
</script>
