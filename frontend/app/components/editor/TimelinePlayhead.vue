<template>
  <div
    v-if="variant === 'head'"
    data-testid="timeline-playhead-head"
    class="absolute top-0 bottom-[-1px] z-20 pointer-events-none"
    :style="positionStyle"
  >
    <div
      data-testid="timeline-playhead-handle"
      class="w-0 h-0 absolute -left-[5px] top-0 cursor-ew-resize pointer-events-auto"
      style="
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #ff3b30;
      "
      @mousedown.stop="emit('scrub-start', $event)"
    ></div>
    <div class="absolute top-[8px] bottom-0 left-0 w-[2px] bg-[#ff3b30]"></div>
  </div>
  <div
    v-else
    data-testid="timeline-playhead"
    class="absolute top-0 bottom-0 z-30 pointer-events-none bg-[#ff3b30]"
    :style="positionStyle"
  ></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useClipperState } from '../../composables/useClipperState';

const props = defineProps<{
  variant: 'head' | 'line';
  pxPerSec: number;
}>();

const emit = defineEmits<{
  (e: 'scrub-start', event: MouseEvent): void;
}>();

const state = useClipperState();

const playheadPx = computed(
  () => (state.currentTime.value || 0) * props.pxPerSec
);

const positionStyle = computed(() => ({
  left: '0px',
  transform: `translate3d(${playheadPx.value}px, 0, 0)`,
  width: '2px',
  willChange: 'transform'
}));
</script>
