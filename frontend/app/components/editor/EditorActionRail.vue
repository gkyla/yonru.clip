<template>
  <!-- Editor Workspace Action Rail (Positioned directly beside VideoPreview at top right) -->
  <div
    v-if="state?.activeHook?.value || state?.videoUrl?.value"
    class="flex flex-col items-center gap-3 relative"
  >
    <!-- Subtitles Button -->
    <div class="relative z-20">
      <button
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px"
        :class="
          isPanelOpen && editorTab === 'edit'
            ? 'bg-white/15 text-white border-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-[#14141a]'
        "
        @click="$emit('toggleTab', 'edit')"
        @mouseenter="showTooltip('edit', $event)"
        @mouseleave="hideTooltip"
      >
        <Icon
          :name="
            isPanelOpen && editorTab === 'edit'
              ? 'ri:closed-captioning-fill'
              : 'ri:closed-captioning-line'
          "
          class="text-lg transition-colors duration-200"
          :class="
            state?.subtitlesEnabled?.value === false ? 'text-amber-400/80' : ''
          "
        />
      </button>
    </div>

    <!-- Thumbnail Button -->
    <div class="relative z-20">
      <button
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px"
        :class="
          isPanelOpen && editorTab === 'thumbnail'
            ? 'bg-white/15 text-white border-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-[#14141a]'
        "
        @click="$emit('toggleTab', 'thumbnail')"
        @mouseenter="showTooltip('thumbnail', $event)"
        @mouseleave="hideTooltip"
      >
        <Icon
          name="ri:image-line"
          class="text-lg transition-colors duration-200"
        />
      </button>
    </div>

    <!-- Raw Quote Button -->
    <div class="relative z-20">
      <button
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px"
        :class="
          isPanelOpen && editorTab === 'quote'
            ? 'bg-white/15 text-white border-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-[#14141a]'
        "
        @click="$emit('toggleTab', 'quote')"
        @mouseenter="showTooltip('quote', $event)"
        @mouseleave="hideTooltip"
      >
        <Icon
          name="ri:double-quotes-l"
          class="text-lg transition-colors duration-200"
        />
      </button>
    </div>

    <!-- Canvas Snapping Guides Magnet Toggle Button -->
    <div class="relative z-20">
      <button
        data-testid="snapping-toggle-btn"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px"
        :class="
          snapping.isSnappingEnabled.value
            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20 hover:bg-[#14141a]'
        "
        @click="snapping.toggleSnapping()"
        @mouseenter="showTooltip('snapping', $event)"
        @mouseleave="hideTooltip"
      >
        <svg
          class="w-4 h-4 transition-transform duration-200"
          :class="snapping.isSnappingEnabled.value ? 'scale-110' : 'opacity-60'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M4 10V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5a3 3 0 0 0 6 0V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5a8 8 0 0 1-16 0Z"
          />
          <line x1="4" y1="8" x2="9" y2="8" />
          <line x1="15" y1="8" x2="20" y2="8" />
        </svg>
      </button>
    </div>

    <!-- Teleported Floating Tooltip -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="
            hoveredTab &&
            (state?.activeHook?.value || state?.videoUrl?.value) &&
            state?.renderStatus?.value !== 'rendering'
          "
          class="fixed -translate-y-1/2 whitespace-nowrap bg-black/95 text-white text-[10px] font-bold px-2.5 py-1 border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.8)] pointer-events-none rounded-lg z-[9999]"
          :style="{
            top: `${tooltipCoords.top}px`,
            left: `${tooltipCoords.left}px`
          }"
        >
          {{
            hoveredTab === 'edit'
              ? state?.subtitlesEnabled?.value === false
                ? 'Subtitles (OFF)'
                : 'Subtitles'
              : hoveredTab === 'thumbnail'
                ? 'Cover Slide'
                : hoveredTab === 'quote'
                  ? 'Raw Quote'
                  : snapping.isSnappingEnabled.value
                    ? 'Snapping Guides (ON - Hold Alt to bypass)'
                    : 'Snapping Guides (OFF)'
          }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useClipperState } from '../../composables/useClipperState';
import { useSnappingGuides } from '../../composables/useSnappingGuides';

defineProps<{
  isPanelOpen: boolean;
  editorTab: 'edit' | 'quote' | 'thumbnail';
}>();

defineEmits<{
  (e: 'toggleTab', tab: 'edit' | 'quote' | 'thumbnail'): void;
}>();

const state = useClipperState();
const snapping = useSnappingGuides();

const hoveredTab = ref<'edit' | 'quote' | 'thumbnail' | 'snapping' | null>(
  null
);
const tooltipCoords = ref({ top: 0, left: 0 });

const showTooltip = (
  tab: 'edit' | 'quote' | 'thumbnail' | 'snapping',
  event: MouseEvent
) => {
  const target = event.currentTarget as HTMLElement;
  if (!target) return;
  const rect = target.getBoundingClientRect();
  tooltipCoords.value = {
    top: rect.top + rect.height / 2,
    left: rect.right + 10
  };
  hoveredTab.value = tab;
};

const hideTooltip = () => {
  hoveredTab.value = null;
};
</script>
