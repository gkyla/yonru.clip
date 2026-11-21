<template>
  <div
    data-testid="timeline-timecode"
    class="mono text-[10px] flex items-center gap-1"
  >
    <span class="text-red-400 font-bold">{{ formattedCurrentTime }}</span>
    <span class="text-slate-600">/</span>
    <span class="text-slate-500">{{ formattedDuration }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useClipperState } from '../../composables/useClipperState';

const state = useClipperState();

// Quantize to whole seconds so 60fps currentTime ticks only update the DOM at 1 Hz.
const currentWholeSec = computed(() =>
  Math.max(0, Math.floor(state.currentTime.value || 0))
);

const formattedCurrentTime = computed(() =>
  state.formatDuration(currentWholeSec.value)
);

const formattedDuration = computed(() =>
  state.formatDuration(state.timelineDuration.value || 0)
);
</script>
