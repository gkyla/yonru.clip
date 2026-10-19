<template>
  <!-- Section 3: Workspace (Unified Anchor & Horizontal Unfold) -->
  <div
    class="flex flex-col gap-1 shrink-0 relative w-full"
    :class="isCollapsed ? '-mt-[19px]' : ''"
  >
    <!-- Header Label (Synchronous 0ms Delay, Fixed Height, Identical to Main Navigation) -->
    <div
      class="overflow-hidden whitespace-nowrap transition-all duration-150 ease-out h-5 flex items-center"
      :class="
        isCollapsed
          ? 'max-w-0 opacity-0 pointer-events-none'
          : 'max-w-[200px] opacity-100 pointer-events-auto'
      "
    >
      <span
        class="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50"
        >Workspace</span
      >
    </div>

    <!-- Unified Workspace Card Container -->
    <div class="relative group w-full">
      <!-- Case 1: Active Job Processing -->
      <div
        v-if="isProcessing"
        class="border border-transparent flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out w-full overflow-hidden"
        :class="
          isCollapsed
            ? 'h-10 p-0 bg-transparent border-transparent duration-80 ease-in'
            : 'h-[68px] p-2 bg-amber-500/5 border-amber-500/20 delay-75'
        "
      >
        <!-- Stationary Left Anchor -->
        <div
          class="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 animate-pulse-subtle transition-all duration-200 ease-out"
          :class="isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-lg'"
        >
          <Icon
            name="lucide:loader-2"
            class="animate-spin text-amber-400"
            :class="isCollapsed ? 'text-base' : 'text-lg'"
          />
        </div>

        <!-- Right Details (Horizontal Unfold) -->
        <div
          class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0 flex-1"
          :class="
            isCollapsed
              ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none'
              : 'max-w-[240px] opacity-100 duration-200 delay-75 translate-x-0'
          "
        >
          <div class="flex flex-col justify-center min-w-0 pr-1">
            <div class="flex items-center gap-1.5 leading-none">
              <span
                class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
              ></span>
              <span
                class="text-[9.5px] font-bold text-amber-400 tracking-wider uppercase"
                >Active Job</span
              >
            </div>
            <p
              class="text-xs text-white font-semibold truncate leading-tight mt-1"
            >
              {{ processingTitle }}
            </p>
            <p
              class="text-[10px] text-amber-300/70 uppercase tracking-wider font-mono truncate mt-0.5"
            >
              {{ processingStatus }}
            </p>
          </div>
        </div>
      </div>

      <!-- Case 2: Continue Editing / Last Accessed Clip Available -->
      <button
        v-else-if="lastClip && (lastVideo || lastClip.video_title)"
        :disabled="isCurrentClipActive"
        class="border border-transparent flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out group w-full text-left"
        :class="[
          isCurrentClipActive
            ? 'cursor-default opacity-85'
            : 'cursor-pointer hover:border-accent-500/40 hover:bg-white/[0.06]',
          isCollapsed
            ? 'h-10 p-0 bg-transparent border-transparent duration-80 ease-in overflow-visible'
            : 'h-[68px] p-2 bg-white/[0.03] border-white/[0.08] delay-75 overflow-hidden'
        ]"
        :title="
          isCollapsed
            ? `${lastClip.theme || lastClip.title || 'Last Accessed Clip'}${lastClip.video_title || lastVideo?.title ? ' • ' + (lastClip.video_title || lastVideo?.title) : ''}`
            : undefined
        "
        @click="isCurrentClipActive ? null : $emit('continue-editing')"
      >
        <!-- Media Anchor Wrapper (overflow-visible for unclipped badge) -->
        <div
          class="shrink-0 relative flex items-center justify-center transition-all duration-200 ease-out"
          :class="isCollapsed ? 'w-10 h-10' : 'w-12 h-12'"
        >
          <!-- Inner Thumbnail Box (overflow-hidden to round the image) -->
          <div
            class="w-full h-full bg-[#141419] overflow-hidden border border-white/[0.08] relative flex items-center justify-center transition-all duration-200 ease-out group-hover:border-accent-500/30"
            :class="isCollapsed ? 'rounded-xl' : 'rounded-lg'"
          >
            <img
              v-if="lastClipThumbnail"
              :src="lastClipThumbnail"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              alt="Clip Thumbnail"
              @error="$emit('thumbnail-error')"
            />
            <Icon
              v-else
              name="lucide:clapperboard"
              class="text-white/60"
              :class="isCollapsed ? 'text-base' : 'text-lg'"
            />

            <!-- Hover Play Overlay in Expanded Mode -->
            <div
              v-if="!isCurrentClipActive && !isCollapsed"
              class="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <div
                class="w-6 h-6 rounded-full bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30"
              >
                <Icon
                  name="lucide:play"
                  class="text-black text-xs fill-black"
                />
              </div>
            </div>
          </div>

          <!-- Active Notification Dot in Collapsed Mode (Unclipped Floating Badge) -->
          <div
            v-if="isCollapsed"
            class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent-500 rounded-full border-2 border-[#09090b] shadow-[0_0_8px_rgba(255,215,0,0.8)] z-20 pointer-events-none"
          ></div>
        </div>

        <!-- Right Details (Horizontal Unfold) -->
        <div
          class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0 flex-1"
          :class="
            isCollapsed
              ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none'
              : 'max-w-[240px] opacity-100 duration-200 delay-75 translate-x-0'
          "
        >
          <div class="flex flex-col justify-center min-w-0 pr-1">
            <div class="flex items-center gap-1.5 leading-none">
              <span
                v-if="isCurrentClipActive"
                class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"
              ></span>
              <p
                class="text-[9.5px] font-bold uppercase tracking-wider"
                :class="
                  isCurrentClipActive ? 'text-indigo-400' : 'text-accent-500'
                "
              >
                {{ isCurrentClipActive ? 'ON EDITING' : 'CONTINUE EDITING' }}
              </p>
            </div>
            <p
              class="text-xs text-white font-semibold truncate leading-tight mt-1"
            >
              {{ lastClip.theme || lastClip.title || 'Untitled Clip' }}
            </p>
            <p class="text-[10px] text-white/50 truncate mt-0.5">
              {{ lastClip.video_title || lastVideo?.title || 'Untitled Video' }}
            </p>
          </div>
        </div>
      </button>

      <!-- Case 3: Empty State (No Recent Clip) -->
      <div
        v-else
        class="border border-transparent flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out w-full overflow-hidden"
        :class="
          isCollapsed
            ? 'h-10 p-0 bg-transparent border-transparent duration-80 ease-in'
            : 'h-[68px] p-2 bg-white/[0.02] border-dashed border-white/[0.08] delay-75'
        "
      >
        <!-- Media Anchor -->
        <div
          class="bg-white/[0.03] border border-white/[0.08] text-white/35 flex items-center justify-center shrink-0 transition-all duration-200 ease-out"
          :class="isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-lg'"
        >
          <Icon
            name="lucide:clapperboard"
            :class="isCollapsed ? 'text-base' : 'text-lg'"
          />
        </div>

        <!-- Right Details (Horizontal Unfold) -->
        <div
          class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0 flex-1"
          :class="
            isCollapsed
              ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none'
              : 'max-w-[240px] opacity-100 duration-200 delay-75 translate-x-0'
          "
        >
          <div class="flex flex-col justify-center min-w-0 pr-1">
            <p
              class="text-[9.5px] font-bold uppercase tracking-wider text-white/40 leading-none"
            >
              Last Accessed Clip
            </p>
            <p class="text-xs text-white/60 font-medium truncate mt-1">
              No recent clip
            </p>
            <p class="text-[10px] text-white/35 truncate mt-0.5">
              Open a clip to begin
            </p>
          </div>
        </div>
      </div>

      <!-- Collapsed Mode Workspace Hover Card Drawer -->
      <div
        v-if="isCollapsed"
        class="absolute left-full top-0 ml-3 bg-[#121216] border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-3 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-x-1 group-hover:translate-x-0 z-[100] flex flex-col gap-2 cursor-default"
      >
        <span
          class="text-[9px] font-bold uppercase tracking-wider text-white/50 pb-1 border-b border-white/[0.06]"
          >Workspace</span
        >

        <div
          v-if="isProcessing"
          class="bg-amber-500/5 rounded-xl p-2.5 border border-amber-500/10"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <Icon
              name="lucide:loader-2"
              class="text-xs text-amber-400 animate-spin"
            />
            <span class="text-[9px] font-bold text-amber-400 uppercase"
              >Active Job</span
            >
          </div>
          <p class="text-xs text-white font-medium line-clamp-1">
            {{ processingTitle }}
          </p>
          <p class="text-[9px] text-amber-300/70 font-mono mt-0.5">
            {{ processingStatus }}
          </p>
        </div>

        <div
          v-else-if="lastClip && (lastVideo || lastClip.video_title)"
          class="flex items-center gap-2.5 p-1 rounded-xl transition-all"
          :class="
            !isCurrentClipActive ? 'hover:bg-white/[0.04] cursor-pointer' : ''
          "
          @click="!isCurrentClipActive && $emit('continue-editing')"
        >
          <div
            class="w-11 h-11 rounded-lg bg-[#141419] overflow-hidden shrink-0 border border-white/[0.08] relative flex items-center justify-center"
          >
            <img
              v-if="lastClipThumbnail"
              :src="lastClipThumbnail"
              class="w-full h-full object-cover"
              alt="Clip Thumbnail"
              @error="$emit('thumbnail-error')"
            />
            <Icon
              v-else
              name="lucide:clapperboard"
              class="text-white/60 text-sm"
            />
          </div>
          <div class="flex flex-col gap-0.5 min-w-0 flex-1">
            <p
              class="text-[9px] font-bold uppercase tracking-wider"
              :class="
                isCurrentClipActive ? 'text-indigo-400' : 'text-accent-500'
              "
            >
              {{ isCurrentClipActive ? 'ON EDITING' : 'LAST ACCESSED CLIP' }}
            </p>
            <p class="text-xs text-white font-medium truncate leading-tight">
              {{ lastClip.theme || lastClip.title || 'Untitled Clip' }}
            </p>
            <p class="text-[9px] text-white/60 truncate">
              {{ lastClip.video_title || lastVideo?.title || 'Untitled Video' }}
            </p>
          </div>
        </div>
        <div v-else class="text-[10px] text-white/45 italic text-center py-1">
          No last accessed clip.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isCollapsed: boolean;
  isProcessing: boolean;
  processingTitle?: string;
  processingStatus?: string;
  lastClip?: any;
  lastVideo?: any;
  lastClipThumbnail?: string | null;
  isCurrentClipActive: boolean;
}>();

defineEmits<{
  (e: 'continue-editing'): void;
  (e: 'thumbnail-error'): void;
}>();
</script>

<style scoped>
@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.85;
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
