<template>
  <div class="space-y-4">
    <!-- Active Style Preset Showcase Card -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h2
          class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5"
        >
          <Icon name="ri:magic-line" class="text-accent-500" />
          <span>Style Presets</span>
        </h2>
        <button
          class="text-[9px] font-bold text-accent-500 hover:text-accent-400 uppercase tracking-wider flex items-center gap-1 hover:underline cursor-pointer"
          @click="emit('openStudio')"
        >
          <Icon name="ri:apps-2-line" class="text-xs" />
          <span>Browse All ({{ SUBTITLE_PRESETS.length }})</span>
        </button>
      </div>

      <!-- Active Preset Card (Clean 2-Tier with Preset Studio Viewport) -->
      <div
        class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 relative overflow-hidden group"
      >
        <!-- Tier 1: Preset Identity & Change Action -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2 min-w-0">
            <Transition
              enter-active-class="transition-opacity duration-200 ease-out"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-opacity duration-150 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
              mode="out-in"
            >
              <div :key="currentPreset.id" class="truncate">
                <div
                  class="text-[10px] font-black text-white uppercase tracking-wider truncate flex items-center gap-1.5"
                >
                  <span>{{ currentPreset.name }}</span>
                </div>
                <span
                  class="text-[8px] text-slate-500 font-bold uppercase tracking-wider block truncate"
                  >{{ currentPreset.font }} •
                  {{ currentPreset.animation }}</span
                >
              </div>
            </Transition>
          </div>

          <button
            class="px-2 py-1 rounded-lg bg-surface-card hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            @click="emit('openStudio')"
          >
            <span>Change</span>
            <Icon name="ri:arrow-right-s-line" class="text-xs" />
          </button>
        </div>

        <!-- Tier 2: Preset Studio Viewport (~80px height live studio canvas) -->
        <div
          class="w-full h-20 rounded-lg flex items-center justify-center relative border border-white/10 px-3 overflow-hidden bg-gradient-to-b from-slate-900/90 via-slate-950 to-black shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]"
        >
          <Transition
            enter-active-class="transition-opacity duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            mode="out-in"
          >
            <PresetStudioViewport
              :key="currentPreset.id"
              :preset="currentPreset"
            />
          </Transition>
        </div>
      </div>
    </div>

    <!-- Subtitle Pacing -->
    <div class="space-y-2">
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between"
      >
        <span>Subtitle Pacing</span>
        <Icon name="ri:speed-line" class="text-slate-400" />
      </h2>

      <!-- Subtitle Visibility Sub-row -->
      <div
        class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 flex items-center justify-between transition-all"
        :class="{
          'border-accent-500/30 bg-accent-500/5': state?.subtitlesEnabled?.value
        }"
      >
        <div class="flex items-center gap-2 min-w-0">
          <div
            class="w-2 h-2 rounded-full shrink-0"
            :class="
              state?.subtitlesEnabled?.value ? 'bg-accent-500' : 'bg-slate-600'
            "
          ></div>
          <div class="flex flex-col">
            <span
              class="text-[10px] font-bold"
              :class="
                state?.subtitlesEnabled?.value ? 'text-white' : 'text-slate-400'
              "
            >
              {{
                state?.subtitlesEnabled?.value
                  ? 'Subtitles Active'
                  : 'Subtitles Hidden'
              }}
            </span>
            <span class="text-[8.5px] text-slate-500 leading-tight">
              {{
                state?.subtitlesEnabled?.value
                  ? 'Visible in preview & export'
                  : 'Hidden from preview & export'
              }}
            </span>
          </div>
        </div>

        <button
          type="button"
          class="w-7 h-3.5 rounded-full transition-all relative shrink-0 cursor-pointer"
          :class="
            state?.subtitlesEnabled?.value ? 'bg-accent-500' : 'bg-white/20'
          "
          :title="
            state?.subtitlesEnabled?.value
              ? 'Disable Subtitles'
              : 'Enable Subtitles'
          "
          @click="
            state?.toggleSubtitles
              ? state.toggleSubtitles()
              : (state.subtitlesEnabled.value = !state?.subtitlesEnabled?.value)
          "
        >
          <div
            class="absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform duration-200 shadow-sm"
            :class="
              state?.subtitlesEnabled?.value
                ? 'translate-x-3.5'
                : 'translate-x-0'
            "
          ></div>
        </button>
      </div>

      <!-- Pacing Mode Selector -->
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="mode in [
            { id: 'word', label: '1 Word' },
            { id: '3_words', label: '3 Words' },
            { id: '4_words', label: '4 Words' }
          ]"
          :key="mode.id"
          :disabled="
            state?.renderStatus?.value === 'rendering' ||
            !state?.subtitlesEnabled?.value
          "
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[10px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-card cursor-pointer"
          :class="
            state?.subtitleMode?.value === mode.id &&
            state?.subtitlesEnabled?.value
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
              : 'text-slate-400 hover:border-accent-500/30 hover:text-white'
          "
          @click="state.subtitleMode.value = mode.id"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- Subtitle Sync Timing -->
    <div
      class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 space-y-1.5"
    >
      <div class="flex justify-between items-center">
        <span
          class="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"
        >
          <Icon name="ri:timer-line" class="text-accent-500" />
          Subtitle Offset (Timing)
        </span>
        <div class="flex items-center gap-1.5">
          <button
            v-if="state?.subtitleSyncOffset?.value !== 150"
            :disabled="state?.renderStatus?.value === 'rendering'"
            class="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-accent-500 bg-accent-500/10 hover:bg-accent-500/20 transition-all border border-accent-500/20 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Reset to default (150ms)"
            @click="state.subtitleSyncOffset.value = 150"
          >
            <Icon name="ri:restart-line" class="text-[10px]" />
            <span>Reset</span>
          </button>
          <span
            class="mono text-[10px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
            >{{ state?.subtitleSyncOffset?.value }}ms</span
          >
        </div>
      </div>
      <input
        v-if="state?.subtitleSyncOffset"
        v-model.number="state.subtitleSyncOffset.value"
        :disabled="state?.renderStatus?.value === 'rendering'"
        type="range"
        min="-2000"
        max="2000"
        step="50"
        class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30"
      />
      <div class="flex justify-between text-[8px] text-slate-500 font-bold">
        <span>EARLIER (-ms)</span>
        <span>LATER (+ms)</span>
      </div>
    </div>

    <!-- Animation Type -->
    <div>
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
      >
        <span>Animation</span>
        <Icon name="ri:play-circle-line" class="text-slate-400" />
      </h2>
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="anim in animations"
          :key="anim.id"
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] transition-all flex flex-col items-center gap-0.5 hover:bg-surface-card cursor-pointer"
          :class="
            state?.subtitleAnimation?.value === anim.id
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)] font-bold'
              : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
          "
          @click="state.subtitleAnimation.value = anim.id"
        >
          <Icon :name="anim.icon" class="text-xs" />
          <span class="font-bold tracking-wider uppercase text-[8px]">{{
            anim.label
          }}</span>
        </button>
      </div>
    </div>

    <!-- Highlight Mode -->
    <div
      v-if="
        state?.subtitleMode?.value !== 'word' ||
        state?.subtitleAnimation?.value === 'karaoke'
      "
    >
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
      >
        <span>Highlight Mode</span>
        <Icon name="ri:mark-pen-line" class="text-slate-400" />
      </h2>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          v-for="hl in highlights"
          :key="hl.id"
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all hover:bg-surface-card cursor-pointer"
          :class="
            state?.subtitleHighlightMode?.value === hl.id
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
              : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
          "
          @click="state.subtitleHighlightMode.value = hl.id"
        >
          {{ hl.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue';
import PresetStudioViewport from './PresetStudioViewport.vue';
import { useClipperState } from '../../composables/useClipperState';
import { SUBTITLE_PRESETS } from '../../constants/subtitlePresets';

const props = defineProps({
  clipperState: {
    type: Object,
    default: null
  }
});

const attrs = useAttrs();
const emit = defineEmits(['openStudio']);

let defaultState = null;
try {
  defaultState = useClipperState();
} catch {
  // Graceful fallback for test environments
}

const state = props.clipperState || attrs.state || defaultState;

const currentPreset = computed(() => {
  return (
    SUBTITLE_PRESETS.find(p => p.id === state?.subtitlePreset?.value) ||
    SUBTITLE_PRESETS[0]
  );
});

const animations = [
  { id: 'pop', label: 'Pop', icon: 'ri:magic-line' },
  { id: 'slide-up', label: 'Slide', icon: 'ri:arrow-up-line' },
  { id: 'fade', label: 'Fade', icon: 'ri:contrast-drop-line' },
  { id: 'bounce', label: 'Bounce', icon: 'ri:basketball-line' },
  { id: 'typewriter', label: 'Type', icon: 'ri:keyboard-line' },
  { id: 'karaoke', label: 'Karaoke', icon: 'ri:mic-line' }
];

const highlights = [
  { id: 'color', label: 'Color Swap' },
  { id: 'scale', label: 'Scale Pulse' },
  { id: 'underline', label: 'Underline' },
  { id: 'box', label: 'Box Highlight' },
  { id: 'none', label: 'None' }
];
</script>
