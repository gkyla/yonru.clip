<template>
  <!-- Editor Workspace Action Rail (Positioned directly beside VideoPreview at top right) -->
  <div
    v-if="state?.activeHook?.value"
    class="flex flex-col items-center gap-3 z-[60] relative"
  >
    <!-- Subtitles Button -->
    <div class="relative group">
      <button
        @click="$emit('toggleTab', 'edit')"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md"
        style="border-radius: 10px;"
        :class="
          isPanelOpen && editorTab === 'edit'
            ? 'bg-accent-500/20 text-accent-500 border-accent-500/40 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
        "
      >
        <Icon name="ri:edit-box-line" class="text-lg" />
      </button>
      <div
        class="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 border border-white/10 shadow-lg pointer-events-none rounded-lg z-[70]"
      >
        Subtitles
      </div>
    </div>

    <!-- Thumbnail Button -->
    <div class="relative group">
      <button
        @click="$emit('toggleTab', 'thumbnail')"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md"
        style="border-radius: 10px;"
        :class="
          isPanelOpen && editorTab === 'thumbnail'
            ? 'bg-accent-500/20 text-accent-500 border-accent-500/40 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
        "
      >
        <Icon name="ri:image-line" class="text-lg" />
      </button>
      <div
        class="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 border border-white/10 shadow-lg pointer-events-none rounded-lg z-[70]"
      >
        Thumbnail
      </div>
    </div>

    <!-- Raw Quote Button -->
    <div class="relative group">
      <button
        @click="$emit('toggleTab', 'quote')"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md"
        style="border-radius: 10px;"
        :class="
          isPanelOpen && editorTab === 'quote'
            ? 'bg-accent-500/20 text-accent-500 border-accent-500/40 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
        "
      >
        <Icon name="ri:double-quotes-l" class="text-lg" />
      </button>
      <div
        class="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 border border-white/10 shadow-lg pointer-events-none rounded-lg z-[70]"
      >
        Raw Quote
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useClipperState } from '../../composables/useClipperState'

defineProps<{
  isPanelOpen: boolean
  editorTab: 'edit' | 'quote' | 'thumbnail'
}>()

defineEmits<{
  (e: 'toggleTab', tab: 'edit' | 'quote' | 'thumbnail'): void
}>()

const state = useClipperState()
</script>
