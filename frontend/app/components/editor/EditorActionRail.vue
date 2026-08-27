<template>
  <!-- Editor Workspace Action Rail (Positioned directly beside VideoPreview at top right) -->
  <div
    v-if="state?.activeHook?.value"
    class="flex flex-col items-center gap-3 relative"
  >
    <!-- Subtitles Button -->
    <div class="relative z-20">
      <button
        @click="$emit('toggleTab', 'edit')"
        @mouseenter="showTooltip('edit', $event)"
        @mouseleave="hideTooltip"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px;"
        :class="
          isPanelOpen && editorTab === 'edit'
            ? 'bg-white/15 text-white border-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-[#14141a]'
        "
      >
        <Icon name="ri:edit-box-line" class="text-lg transition-colors duration-200" />
      </button>
    </div>

    <!-- Thumbnail Button -->
    <div class="relative z-20">
      <button
        @click="$emit('toggleTab', 'thumbnail')"
        @mouseenter="showTooltip('thumbnail', $event)"
        @mouseleave="hideTooltip"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px;"
        :class="
          isPanelOpen && editorTab === 'thumbnail'
            ? 'bg-white/15 text-white border-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-[#14141a]'
        "
      >
        <Icon name="ri:image-line" class="text-lg transition-colors duration-200" />
      </button>
    </div>

    <!-- Raw Quote Button -->
    <div class="relative z-20">
      <button
        @click="$emit('toggleTab', 'quote')"
        @mouseenter="showTooltip('quote', $event)"
        @mouseleave="hideTooltip"
        class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md group"
        style="border-radius: 10px;"
        :class="
          isPanelOpen && editorTab === 'quote'
            ? 'bg-white/15 text-white border-white/40 shadow-[0_0_14px_rgba(255,255,255,0.2)]'
            : 'bg-[#0e0e12]/90 border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-[#14141a]'
        "
      >
        <Icon name="ri:double-quotes-l" class="text-lg transition-colors duration-200" />
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
          v-if="hoveredTab && state?.activeHook?.value && state?.renderStatus?.value !== 'rendering'"
          class="fixed -translate-y-1/2 whitespace-nowrap bg-black/95 text-white text-[10px] font-bold px-2.5 py-1 border border-white/15 shadow-[0_4px_20px_rgba(0,0,0,0.8)] pointer-events-none rounded-lg z-[9999]"
          :style="{
            top: `${tooltipCoords.top}px`,
            left: `${tooltipCoords.left}px`
          }"
        >
          {{ hoveredTab === 'edit' ? 'Subtitles' : hoveredTab === 'thumbnail' ? 'Thumbnail' : 'Raw Quote' }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useClipperState } from '../../composables/useClipperState'

defineProps<{
  isPanelOpen: boolean
  editorTab: 'edit' | 'quote' | 'thumbnail'
}>()

defineEmits<{
  (e: 'toggleTab', tab: 'edit' | 'quote' | 'thumbnail'): void
}>()

const state = useClipperState()

const hoveredTab = ref<'edit' | 'quote' | 'thumbnail' | null>(null)
const tooltipCoords = ref({ top: 0, left: 0 })

const showTooltip = (tab: 'edit' | 'quote' | 'thumbnail', event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement
  if (!target) return
  const rect = target.getBoundingClientRect()
  tooltipCoords.value = {
    top: rect.top + rect.height / 2,
    left: rect.right + 10
  }
  hoveredTab.value = tab
}

const hideTooltip = () => {
  hoveredTab.value = null
}
</script>
