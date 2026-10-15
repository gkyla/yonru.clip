<template>
  <div class="two-tier-timing-slider space-y-3 pt-1">
    <!-- Tier 1: Macro Source Video Overview -->
    <div class="space-y-1">
      <div
        class="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider"
      >
        <span class="flex items-center gap-1.5 text-slate-400">
          <Icon name="ri:film-line" class="text-xs text-accent-500" />
          Full Video Overview
        </span>
        <span class="font-mono text-slate-500">
          {{ formatDuration(0) }} /
          {{ formatDuration(videoDuration || 0) }}
        </span>
      </div>
      <div
        class="relative w-full h-3 px-1.5 flex items-center select-none bg-black/50 border border-white/5 rounded-lg overflow-hidden cursor-pointer"
        @click="onMacroClick"
      >
        <!-- Full Track -->
        <div
          class="relative w-full h-1 bg-surface-dark border border-surface-border/40 rounded-full overflow-hidden"
        >
          <!-- Macro Active Hook Range -->
          <div
            class="absolute h-full bg-accent-500 rounded-full"
            :style="{
              left: (Math.max(0, start) / (videoDuration || 100)) * 100 + '%',
              width:
                Math.max(
                  0.5,
                  ((end - Math.max(0, start)) / (videoDuration || 100)) * 100
                ) + '%'
            }"
          ></div>
        </div>
        <!-- Zoom Window Viewport Bracket -->
        <div
          class="absolute top-0 bottom-0 border-x-2 border-accent-500/60 bg-accent-500/10 pointer-events-none transition-all duration-75"
          :style="{
            left: (microWindowStart / (videoDuration || 100)) * 100 + '%',
            width:
              Math.max(
                1,
                ((microWindowEnd - microWindowStart) / (videoDuration || 100)) *
                  100
              ) + '%'
          }"
        ></div>
        <!-- Macro Playhead Indicator -->
        <div
          v-if="currentTime !== undefined && currentTime >= 0"
          data-test="macro-playhead"
          class="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)] pointer-events-none z-10"
          :style="{
            left:
              Math.max(
                0,
                Math.min(100, (currentTime / (videoDuration || 100)) * 100)
              ) + '%'
          }"
        ></div>
      </div>
    </div>

    <!-- Tier 2: Micro Context Timeline (Zoomed Boundary Adjustment) -->
    <div class="space-y-1.5">
      <div
        class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider"
      >
        <span class="flex items-center gap-1.5 text-slate-300">
          <Icon name="ri:scissors-cut-line" class="text-xs text-accent-500" />
          Adjust Hook Boundaries
        </span>
        <span
          class="text-[9px] font-mono text-accent-400 font-bold bg-accent-500/10 border border-accent-500/20 px-1.5 py-0.5 rounded"
        >
          Zoomed Window
        </span>
      </div>

      <div
        class="relative w-full h-10 px-2.5 flex items-center select-none bg-black/60 border border-surface-border/80 rounded-xl"
      >
        <div
          id="modal-hook-slider"
          ref="modalHookSliderRef"
          class="relative w-full h-full flex items-center cursor-pointer"
          @mousedown="onSliderClick"
          @touchstart="onSliderClick"
        >
          <!-- Slider Track -->
          <div
            class="absolute left-0 right-0 h-2 bg-surface-dark border border-surface-border/60 rounded-full"
          ></div>

          <!-- Highlighted Active range -->
          <div
            class="absolute h-2 bg-accent-500 rounded-full shadow-[0_0_12px_rgba(255,215,0,0.3)]"
            :style="{
              left:
                ((Math.max(0, start) - microWindowStart) / microDuration) *
                  100 +
                '%',
              width: ((end - Math.max(0, start)) / microDuration) * 100 + '%'
            }"
          ></div>

          <!-- Micro Playhead Indicator -->
          <div
            v-if="
              currentTime !== undefined &&
              currentTime >= microWindowStart &&
              currentTime <= microWindowEnd
            "
            data-test="micro-playhead"
            class="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] pointer-events-none z-20 -translate-x-1/2"
            :style="{
              left:
                ((currentTime - microWindowStart) / microDuration) * 100 + '%'
            }"
          ></div>

          <!-- Start Handle -->
          <div
            data-test="start-handle"
            class="absolute w-5 h-5 rounded-full bg-accent-500 border-2 border-white cursor-ew-resize -translate-x-1/2 flex items-center justify-center shadow-lg hover:scale-125 active:scale-125 transition-transform z-30"
            :style="{
              left:
                ((Math.max(0, start) - microWindowStart) / microDuration) *
                  100 +
                '%'
            }"
            @mousedown.stop="startDrag('start')"
            @touchstart.stop="startDrag('start')"
          >
            <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
          </div>

          <!-- End Handle -->
          <div
            data-test="end-handle"
            class="absolute w-5 h-5 rounded-full bg-accent-500 border-2 border-white cursor-ew-resize -translate-x-1/2 flex items-center justify-center shadow-lg hover:scale-125 active:scale-125 transition-transform z-30"
            :style="{
              left: ((end - microWindowStart) / microDuration) * 100 + '%'
            }"
            @mousedown.stop="startDrag('end')"
            @touchstart.stop="startDrag('end')"
          >
            <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
          </div>
        </div>
      </div>

      <!-- Time markers for micro window -->
      <div
        class="flex items-center justify-between text-[9px] text-slate-500 font-mono px-1"
      >
        <span>{{ formatDuration(microWindowStart) }}</span>
        <span class="text-slate-400 font-bold">
          Clip Duration:
          {{ formatDuration(Math.max(0, end - Math.max(0, start))) }}
        </span>
        <span>{{ formatDuration(microWindowEnd) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    start: number;
    end: number;
    videoDuration: number;
    currentTime?: number;
  }>(),
  {
    currentTime: undefined
  }
);

const emit = defineEmits<{
  (e: 'update:start' | 'update:end' | 'seek', val: number): void;
  (e: 'drag-start', mode: 'start' | 'end'): void;
  (
    e: 'drag-end',
    payload: {
      mode: 'start' | 'end';
      initialStart: number;
      initialEnd: number;
      start: number;
      end: number;
    }
  ): void;
}>();

const modalHookSliderRef = ref<HTMLElement | null>(null);
const dragMode = ref<'start' | 'end' | null>(null);
const dragInitialStart = ref(0);
const dragInitialEnd = ref(0);
const currentStartVal = ref(props.start);
const currentEndVal = ref(props.end);
const microWindowStart = ref(0);
const microWindowEnd = ref(100);
const edgeScrollDirection = ref<-1 | 1 | 0>(0);

let edgeScrollRaf: number | null = null;
let lastScrollTimestamp: number | null = null;

const microDuration = computed(() => {
  return Math.max(1, microWindowEnd.value - microWindowStart.value);
});

function formatDuration(sec: number): string {
  const safeSec = Math.max(0, sec);
  const m = Math.floor(safeSec / 60);
  const s = Math.floor(safeSec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateMicroWindow(startVal: number, endVal: number, padding = 30) {
  const total = props.videoDuration || 3600;
  microWindowStart.value = Math.max(
    0,
    parseFloat((startVal - padding).toFixed(1))
  );
  microWindowEnd.value = Math.min(
    total,
    parseFloat((endVal + padding).toFixed(1))
  );
}

// Keep micro window updated when start/end/duration change outside of dragging
watch(
  [() => props.start, () => props.end, () => props.videoDuration],
  ([newStart, newEnd]) => {
    if (!dragMode.value) {
      currentStartVal.value = newStart;
      currentEndVal.value = newEnd;
      updateMicroWindow(newStart, newEnd);
    }
  },
  { immediate: true }
);

function stepEdgeAutoScroll(timestamp: number) {
  if (!edgeScrollDirection.value || !dragMode.value) {
    stopEdgeAutoScroll();
    return;
  }

  if (lastScrollTimestamp === null) {
    lastScrollTimestamp = timestamp;
  }
  const elapsedSec = Math.min(0.1, (timestamp - lastScrollTimestamp) / 1000);
  lastScrollTimestamp = timestamp;

  const scrollRate = 8; // 8 seconds of footage per second of dwell
  const delta = scrollRate * elapsedSec;
  const totalDuration = props.videoDuration || 3600;

  if (edgeScrollDirection.value === 1 && dragMode.value === 'end') {
    const current = currentEndVal.value;
    if (current < totalDuration) {
      const newEnd = Math.min(totalDuration, current + delta);
      const actualDelta = newEnd - current;
      currentEndVal.value = newEnd;
      const roundedEnd = parseFloat(newEnd.toFixed(2));
      emit('update:end', roundedEnd);
      emit('seek', roundedEnd);

      microWindowEnd.value = Math.min(
        totalDuration,
        parseFloat((microWindowEnd.value + actualDelta).toFixed(2))
      );
      microWindowStart.value = Math.max(
        0,
        parseFloat((microWindowStart.value + actualDelta).toFixed(2))
      );
    } else {
      stopEdgeAutoScroll();
      return;
    }
  } else if (edgeScrollDirection.value === -1 && dragMode.value === 'start') {
    const current = currentStartVal.value;
    if (current > 0) {
      const newStart = Math.max(0, current - delta);
      const actualDelta = current - newStart;
      currentStartVal.value = newStart;
      const roundedStart = parseFloat(newStart.toFixed(2));
      emit('update:start', roundedStart);
      emit('seek', roundedStart);

      microWindowStart.value = Math.max(
        0,
        parseFloat((microWindowStart.value - actualDelta).toFixed(2))
      );
      microWindowEnd.value = Math.max(
        microWindowStart.value + 10,
        parseFloat((microWindowEnd.value - actualDelta).toFixed(2))
      );
    } else {
      stopEdgeAutoScroll();
      return;
    }
  }

  if (typeof window !== 'undefined') {
    edgeScrollRaf = requestAnimationFrame(stepEdgeAutoScroll);
  }
}

function startEdgeAutoScroll(direction: -1 | 1) {
  if (edgeScrollDirection.value === direction && edgeScrollRaf !== null) return;
  edgeScrollDirection.value = direction;
  lastScrollTimestamp = null;
  if (edgeScrollRaf === null && typeof window !== 'undefined') {
    edgeScrollRaf = requestAnimationFrame(stepEdgeAutoScroll);
  }
}

function stopEdgeAutoScroll() {
  edgeScrollDirection.value = 0;
  lastScrollTimestamp = null;
  if (edgeScrollRaf !== null && typeof window !== 'undefined') {
    cancelAnimationFrame(edgeScrollRaf);
    edgeScrollRaf = null;
  }
}

function startDrag(
  mode: 'start' | 'end',
  initialStart?: number,
  initialEnd?: number
) {
  dragMode.value = mode;
  dragInitialStart.value =
    initialStart !== undefined ? initialStart : Math.max(0, props.start);
  dragInitialEnd.value = initialEnd !== undefined ? initialEnd : props.end;
  currentStartVal.value = dragInitialStart.value;
  currentEndVal.value = dragInitialEnd.value;

  emit('drag-start', mode);

  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', onDragging);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchmove', onDragging, { passive: false });
    window.addEventListener('touchend', stopDragging);
  }
}

function onDragging(e: MouseEvent | TouchEvent) {
  if (!dragMode.value) return;

  const slider =
    modalHookSliderRef.value || document.getElementById('modal-hook-slider');
  if (!slider) return;

  const rect = slider.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  const percentage = Math.max(
    0,
    Math.min(1, (clientX - rect.left) / rect.width)
  );
  const totalDuration = props.videoDuration || 3600;
  const microDur = microDuration.value;
  const rawVal = microWindowStart.value + percentage * microDur;
  const newVal = parseFloat(rawVal.toFixed(1));

  const isAtRightEdge = percentage >= 0.98 || clientX >= rect.right - 4;
  const isAtLeftEdge = percentage <= 0.02 || clientX <= rect.left + 4;

  if (dragMode.value === 'start') {
    const minStart = microWindowStart.value;
    const maxStart = currentEndVal.value - 1.0;
    if (newVal <= maxStart) {
      const clampedStart = Math.max(minStart, newVal);
      currentStartVal.value = clampedStart;
      emit('update:start', clampedStart);
      emit('seek', clampedStart);
    }

    if (isAtLeftEdge) {
      startEdgeAutoScroll(-1);
    } else {
      stopEdgeAutoScroll();
    }
  } else if (dragMode.value === 'end') {
    const minEnd = currentStartVal.value + 1.0;
    const maxEnd = Math.min(totalDuration, microWindowEnd.value);
    if (newVal >= minEnd) {
      const clampedEnd = Math.min(maxEnd, newVal);
      currentEndVal.value = clampedEnd;
      emit('update:end', clampedEnd);
      emit('seek', clampedEnd);
    }

    if (isAtRightEdge) {
      startEdgeAutoScroll(1);
    } else {
      stopEdgeAutoScroll();
    }
  }
}

function stopDragging() {
  stopEdgeAutoScroll();
  const currentDrag = dragMode.value;
  const initStart = dragInitialStart.value;
  const initEnd = dragInitialEnd.value;
  const finalStart = currentStartVal.value;
  const finalEnd = currentEndVal.value;
  dragMode.value = null;

  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', onDragging);
    window.removeEventListener('mouseup', stopDragging);
    window.removeEventListener('touchmove', onDragging);
    window.removeEventListener('touchend', stopDragging);
  }

  if (!currentDrag) return;

  // Re-center micro window with fresh context padding once drag finishes
  updateMicroWindow(finalStart, finalEnd);

  emit('drag-end', {
    mode: currentDrag,
    initialStart: initStart,
    initialEnd: initEnd,
    start: finalStart,
    end: finalEnd
  });
}

function onSliderClick(e: MouseEvent | TouchEvent) {
  const slider =
    modalHookSliderRef.value || document.getElementById('modal-hook-slider');
  if (!slider) return;

  const rect = slider.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  const percentage = Math.max(
    0,
    Math.min(1, (clientX - rect.left) / rect.width)
  );
  const microDur = microDuration.value;
  const clickVal = parseFloat(
    (microWindowStart.value + percentage * microDur).toFixed(1)
  );

  const effectiveStart = Math.max(0, props.start);
  const distStart = Math.abs(clickVal - effectiveStart);
  const distEnd = Math.abs(clickVal - props.end);

  const mode = distStart < distEnd ? 'start' : 'end';
  const initialStart = effectiveStart;
  const initialEnd = props.end;

  if (mode === 'start') {
    if (clickVal <= props.end - 1.0) {
      const clampedStart = Math.max(0, clickVal);
      emit('update:start', clampedStart);
      emit('seek', clampedStart);
    }
  } else {
    const totalDuration = props.videoDuration || 3600;
    if (clickVal >= effectiveStart + 1.0) {
      const clampedEnd = Math.min(totalDuration, clickVal);
      emit('update:end', clampedEnd);
      emit('seek', clampedEnd);
    }
  }

  startDrag(mode, initialStart, initialEnd);
}

function onMacroClick(e: MouseEvent) {
  const trackEl = e.currentTarget as HTMLElement;
  const rect = trackEl.getBoundingClientRect();
  const percentage = Math.max(
    0,
    Math.min(1, (e.clientX - rect.left) / rect.width)
  );
  const totalDuration = props.videoDuration || 3600;
  const seekTime = parseFloat((percentage * totalDuration).toFixed(1));
  emit('seek', seekTime);
}

onUnmounted(() => {
  stopEdgeAutoScroll();
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousemove', onDragging);
    window.removeEventListener('mouseup', stopDragging);
    window.removeEventListener('touchmove', onDragging);
    window.removeEventListener('touchend', stopDragging);
  }
});

defineExpose({
  modalHookSliderRef,
  microWindowStart,
  microWindowEnd,
  dragMode,
  dragInitialStart,
  dragInitialEnd,
  edgeScrollDirection,
  startDrag,
  stopDragging,
  stepEdgeAutoScroll,
  updateMicroWindow,
  formatDuration
});
</script>
