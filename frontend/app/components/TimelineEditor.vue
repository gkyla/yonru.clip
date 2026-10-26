<template>
  <div
    class="flex-1 flex flex-col bg-[#0a0a0c] overflow-hidden h-full transition-all duration-300"
    :class="{
      'opacity-40 pointer-events-none':
        isOverlayVisible ||
        state?.renderStatus?.value === 'rendering' ||
        state?.isRenderPreviewActive?.value ||
        state?.isEditorLocked?.value
    }"
  >
    <!-- Toolbar -->
    <div
      class="h-10 flex items-center justify-between px-4 bg-[#111113] border-b border-white/5"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex items-center gap-0.5 bg-black/40 rounded p-0.5 border border-white/5"
        >
          <button
            class="px-2 py-1 rounded hover:bg-white/5 text-slate-400 text-[9px] font-bold tracking-wider flex items-center gap-1.5"
            @click="addText"
          >
            <Icon name="ri:text" class="text-violet-400 text-xs" /> TEXT
          </button>
          <button
            class="px-2 py-1 rounded hover:bg-white/5 text-slate-400 text-[9px] font-bold tracking-wider flex items-center gap-1.5"
            @click="triggerAudioUpload"
          >
            <Icon name="ri:music-2-line" class="text-green-400 text-xs" /> AUDIO
          </button>
        </div>
        <div class="h-4 w-px bg-white/10"></div>
        <button
          :disabled="!state.selectedTimelineItem.value"
          class="p-1 rounded hover:bg-white/10 text-slate-500 disabled:opacity-20"
          title="Split (K)"
          @click="splitSelected"
        >
          <Icon name="ri:scissors-cut-line" class="text-sm" />
        </button>
        <button
          :disabled="!state.selectedTimelineItem.value"
          class="p-1 rounded hover:bg-red-500/20 text-red-400/60 disabled:opacity-20"
          title="Delete"
          @click="deleteSelected"
        >
          <Icon name="ri:delete-bin-line" class="text-sm" />
        </button>
        <div class="h-4 w-px bg-white/10"></div>
        <button
          class="p-1 rounded text-[9px] font-bold flex items-center gap-1"
          :class="
            snapEnabled
              ? 'bg-sky-500/20 text-sky-400'
              : 'text-slate-600 hover:bg-white/5'
          "
          @click="snapEnabled = !snapEnabled"
        >
          <Icon name="ri:drag-move-2-line" class="text-sm" /> SNAP
        </button>
        <div class="h-4 w-px bg-white/10"></div>
        <button
          :disabled="!state.canUndo.value"
          class="relative group p-1 rounded hover:bg-white/10 text-slate-500 disabled:opacity-20 transition-all text-[10px] font-bold flex items-center gap-1"
          @click="state.undo()"
        >
          <Icon name="ri:arrow-go-back-line" class="text-sm" /> Undo
          <span
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-slate-200 text-[9px] px-2 py-0.5 rounded shadow-xl whitespace-nowrap pointer-events-none z-50 border border-white/10 font-medium"
          >
            Cmd + Z / Ctrl + Z
          </span>
        </button>
        <button
          :disabled="!state.canRedo.value"
          class="relative group p-1 rounded hover:bg-white/10 text-slate-500 disabled:opacity-20 transition-all text-[10px] font-bold flex items-center gap-1"
          @click="state.redo()"
        >
          <Icon name="ri:arrow-go-forward-line" class="text-sm" /> Redo
          <span
            class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-slate-200 text-[9px] px-2 py-0.5 rounded shadow-xl whitespace-nowrap pointer-events-none z-50 border border-white/10 font-medium"
          >
            Cmd + Shift + Z / Ctrl + Shift + Z
          </span>
        </button>
        <!-- Saving indicator -->
        <Transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 translate-x-[-4px]"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="state.isSavingHistory.value"
            class="flex items-center gap-2"
          >
            <div class="h-4 w-px bg-white/10"></div>
            <span
              class="flex items-center gap-1 text-[9px] text-amber-400/80 font-bold uppercase tracking-wider"
            >
              <Icon name="ri:loader-4-line" class="text-xs animate-spin" />
              Saving...
            </span>
          </div>
        </Transition>
      </div>
      <div class="flex items-center gap-4">
        <div
          class="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-white/5"
        >
          <button class="text-white hover:text-red-400" @click="togglePlay">
            <Icon
              :name="state.isPlaying.value ? 'ri:pause-fill' : 'ri:play-fill'"
              class="text-base"
            />
          </button>
          <div class="mono text-[10px] flex items-center gap-1">
            <span class="text-red-400 font-bold">{{
              state.formatDuration(state.currentTime.value)
            }}</span>
            <span class="text-slate-600">/</span>
            <span class="text-slate-500">{{
              state.formatDuration(state.timelineDuration.value)
            }}</span>
          </div>
        </div>
        <div class="flex items-center gap-0.5 bg-white/5 rounded p-0.5">
          <button
            class="p-1 hover:bg-white/10 rounded text-slate-500"
            @click="zoomOut"
          >
            <Icon name="ri:subtract-line" class="text-xs" />
          </button>
          <div class="w-8 text-center text-[8px] mono text-slate-600">
            {{ Math.round(pxPerSec) }}
          </div>
          <button
            class="p-1 hover:bg-white/10 rounded text-slate-500"
            @click="zoomIn"
          >
            <Icon name="ri:add-line" class="text-xs" />
          </button>
        </div>
        <div class="flex items-center gap-2 bg-white/5 rounded px-2 py-1">
          <button
            class="text-slate-500 hover:text-white"
            @click="state.volume.value = state.volume.value === 0 ? 0.5 : 0"
          >
            <Icon
              :name="
                state.volume.value === 0
                  ? 'ri:volume-mute-line'
                  : 'ri:volume-up-line'
              "
              class="text-xs"
            />
          </button>
          <input
            v-model.number="state.volume.value"
            type="range"
            min="0"
            max="1"
            step="0.01"
            class="w-16 accent-red-500 h-0.5 bg-white/10 rounded appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>

    <!-- Timeline Body -->
    <div class="flex-1 flex overflow-hidden relative select-none">
      <!-- Track Labels -->
      <div
        class="w-24 bg-[#111113] border-r border-white/5 flex flex-col shrink-0 z-40"
      >
        <div class="h-5 border-b border-white/5"></div>
        <div
          v-for="track in state.timelineTracks.value"
          :key="track.id"
          class="border-b border-white/5 px-3 flex items-center gap-1.5 relative"
          :style="{ height: trackH + 'px' }"
        >
          <div
            class="absolute left-0 top-0 bottom-0 w-[3px]"
            :class="trackBorderColor(track.type)"
          ></div>
          <Icon
            :name="trackIcon(track.type)"
            class="text-[10px] opacity-50"
            :class="trackColor(track.type)"
          />
          <span
            class="text-[8px] font-bold uppercase tracking-widest truncate"
            :class="
              track.id === 'subtitle' && !state.subtitlesEnabled?.value
                ? 'text-slate-500 opacity-80'
                : 'text-slate-600'
            "
          >
            {{ track.name }}
            <span
              v-if="track.id === 'subtitle' && !state.subtitlesEnabled?.value"
              class="text-[7px] text-amber-500/80 font-bold ml-1"
              >(OFF)</span
            >
          </span>
        </div>
      </div>

      <!-- Scrollable Timeline -->
      <div
        ref="scrollEl"
        class="flex-1 overflow-x-auto overflow-y-hidden relative tl-scroll"
        @scroll="onScroll"
        @wheel.prevent="onWheel"
      >
        <!-- Ruler -->
        <div
          class="sticky top-0 z-30 bg-[#0d0d0f] border-b border-white/5 cursor-pointer select-none timeline-ruler"
          :style="{ height: '20px' }"
          @mousedown="startRulerScrub"
        >
          <div
            class="relative h-full ruler-container"
            :style="{ width: totalW + 'px' }"
          >
            <template v-for="tick in rulerTicks" :key="tick.pos">
              <div
                class="absolute bottom-0 border-l"
                :class="
                  tick.major
                    ? 'border-white/20 h-[10px]'
                    : 'border-white/8 h-[5px]'
                "
                :style="{ left: tick.pos + 'px' }"
              >
                <span
                  v-if="tick.label"
                  class="absolute -top-[12px] left-[3px] text-[8px] mono text-slate-600 whitespace-nowrap select-none"
                  >{{ tick.label }}</span
                >
              </div>
            </template>
          </div>
        </div>

        <!-- Track Content Area -->
        <div
          class="relative"
          :style="{ width: totalW + 'px' }"
          @mousedown="onTrackBgClick"
        >
          <div
            v-for="track in state.timelineTracks.value"
            :key="track.id"
            class="relative border-b border-white/[0.03]"
            :style="{ height: trackH + 'px' }"
          >
            <!-- Cover Slide block -->
            <div
              v-if="
                track.type === 'video' &&
                (state.coverEnabled?.value ?? state.thumbnailEnabled.value)
              "
              class="absolute top-[4px] rounded-[3px] border-l-[3px] border-emerald-500 flex items-center px-2 gap-1 pointer-events-none"
              :style="{
                left: 0,
                width: thumbW + 'px',
                height: trackH - 8 + 'px',
                background: '#064e3b'
              }"
              title="Cover Slide"
            >
              <Icon
                name="ri:image-edit-fill"
                class="text-emerald-400 text-[10px] shrink-0"
              />
              <span
                class="text-[7px] font-bold text-emerald-400 truncate tracking-wider"
                >Cover Slide</span
              >
            </div>
            <!-- Track items -->
            <div
              v-for="item in track.items"
              :key="item.id"
              class="absolute top-[4px] rounded-[3px] cursor-move flex items-center px-2 gap-1.5 overflow-hidden border-l-[3px] transition-opacity duration-200"
              :class="[
                itemClasses(track.type, item),
                track.id === 'subtitle' && !state.subtitlesEnabled?.value
                  ? '!opacity-35 grayscale-[0.5]'
                  : ''
              ]"
              :style="itemStyle(track, item)"
              @mousedown.stop="startMove($event, track.id, item)"
            >
              <span class="text-[8px] font-bold truncate opacity-80">{{
                item.content || item.name || track.type
              }}</span>
              <span class="text-[7px] mono opacity-40 ml-auto shrink-0"
                >{{ item.duration.toFixed(1) }}s</span
              >
              <!-- Resize handles -->
              <div
                class="absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-white/10"
                @mousedown.stop="startResize($event, track.id, item, 'start')"
              >
                <div
                  class="absolute right-[1px] top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20 rounded"
                ></div>
              </div>
              <div
                class="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-white/10"
                @mousedown.stop="startResize($event, track.id, item, 'end')"
              >
                <div
                  class="absolute left-[1px] top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20 rounded"
                ></div>
              </div>
            </div>

            <!-- Flagged markers layer (only for subtitle track) -->
            <template
              v-if="
                track.id === 'subtitle' &&
                state.contentAudit.value?.flaggedSegments
              "
            >
              <div
                v-for="(v, i) in state.contentAudit.value.flaggedSegments"
                :key="'v-' + i"
                class="absolute top-0 bottom-0 bg-rose-500/20 border-x border-rose-500/40 pointer-events-none z-10"
                :style="{
                  left: getMarkerLeft(getRelativeMarkerTime(v.start)) + 'px',
                  width: v.duration * pxPerSec + 'px'
                }"
              >
                <div
                  class="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                ></div>
              </div>
            </template>
          </div>
        </div>

        <!-- Playhead (positioned in canvas coordinates) -->
        <div
          class="absolute top-0 bottom-0 z-50 pointer-events-none"
          :style="{ left: playheadPx + 'px', width: '2px' }"
        >
          <div
            class="w-0 h-0 absolute -left-[5px] top-0 cursor-ew-resize pointer-events-auto"
            style="
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #ff3b30;
            "
            @mousedown.stop="startRulerScrub"
          ></div>
          <div
            class="absolute top-[8px] bottom-0 left-0 w-[2px] bg-[#ff3b30]"
          ></div>
        </div>
      </div>
    </div>

    <!-- Properties Inspector Panel (Extracted Deep Module) -->
    <TimelinePropertiesInspector
      @delete="deleteSelected"
      @commit-history="state.commitToHistory"
    />

    <input
      ref="audioInput"
      type="file"
      class="hidden"
      accept="audio/*"
      @change="handleAudioFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  calculateRulerTicks,
  calculateSnapTime,
  calculateDragBounds,
  splitTimelineItem,
  deleteTimelineItemWithRipple
} from '../utils/timelineHelpers';

import TimelinePropertiesInspector from './editor/TimelinePropertiesInspector.vue';

const state = useClipperState();
const isOverlayVisible = useState<boolean>('isOverlayVisible', () => false);

const pxPerSec = ref(100);
const scrollEl = ref<HTMLElement | null>(null);
const audioInput = ref<HTMLInputElement | null>(null);
const snapEnabled = ref(true);
const trackH = 40;
const isUserScrolling = ref(false);
let scrollTimeout: any = null;
let isProgrammaticScroll = false;

// --- Cover Slide ---
const thumbW = computed(() => {
  const isEnabled = state.coverEnabled?.value ?? state.thumbnailEnabled.value;
  const duration =
    state.coverDuration?.value ?? state.thumbnailDuration.value ?? 3;
  return isEnabled ? duration * pxPerSec.value : 0;
});
const thumbOffsetPx = computed(() => thumbW.value);

function getItemLeft(track: any, item: any) {
  const base = item.start * pxPerSec.value;
  const isEnabled = state.coverEnabled?.value ?? state.thumbnailEnabled.value;
  return isEnabled ? base + thumbOffsetPx.value : base;
}

function getMarkerLeft(val: number) {
  const base = val * pxPerSec.value;
  const isEnabled = state.coverEnabled?.value ?? state.thumbnailEnabled.value;
  return isEnabled ? base + thumbOffsetPx.value : base;
}

function getRelativeMarkerTime(val: number) {
  const firstStart = state.fullTranscript.value?.[0]?.start || 0;
  const isTranscriptZeroBased = state.activeHook.value
    ? firstStart < (state.activeHook.value.start || 0) - 2
    : true;

  if (isTranscriptZeroBased) return val;
  return val - (state.activeHook.value?.start || 0);
}

// --- Layout ---
const totalW = computed(() => {
  return Math.max(state.timelineDuration.value * pxPerSec.value, 2000);
});

const containerW = computed(() => scrollEl.value?.clientWidth || 800);

// Playhead position in content coordinates
const playheadPx = computed(() => state.currentTime.value * pxPerSec.value);

// --- Ruler ---
const rulerTicks = computed(() =>
  calculateRulerTicks(totalW.value, pxPerSec.value)
);

// --- Track helpers ---
function trackIcon(type: string) {
  if (type === 'video') return 'ri:film-line';
  if (type === 'audio') return 'ri:volume-up-line';
  if (type === 'subtitle') return 'ri:chat-voice-line';
  return 'ri:text';
}
function trackColor(type: string) {
  if (type === 'video') return 'text-sky-400';
  if (type === 'audio') return 'text-green-400';
  if (type === 'subtitle') return 'text-accent-500';
  return 'text-violet-400';
}
function trackBorderColor(type: string) {
  if (type === 'video') return 'bg-sky-500';
  if (type === 'audio') return 'bg-green-500';
  if (type === 'subtitle') return 'bg-accent-500';
  return 'bg-violet-500';
}

const itemBg: Record<string, string> = {
  video: '#1a365d',
  audio: '#1a3a1a',
  text: '#2d1b5e',
  subtitle: 'rgba(255,215,0,0.05)'
};
const itemBorder: Record<string, string> = {
  video: '#3182ce',
  audio: '#38a169',
  text: '#805ad5',
  subtitle: '#ffd700'
};

function itemClasses(type: string, item: any) {
  return item.id === state.selectedTimelineItem.value?.id
    ? 'border border-white/80'
    : 'border border-transparent';
}

function itemStyle(track: any, item: any) {
  const t = track.type;
  return {
    left: getItemLeft(track, item) + 'px',
    width: item.duration * pxPerSec.value + 'px',
    height: trackH - 8 + 'px',
    background: itemBg[t] || itemBg.text,
    borderLeftColor: itemBorder[t] || itemBorder.text
  };
}

// --- Zoom ---
function zoomIn() {
  pxPerSec.value = Math.min(500, pxPerSec.value * 1.25);
}
function zoomOut() {
  pxPerSec.value = Math.max(10, pxPerSec.value / 1.25);
}

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Pinch-to-zoom
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  } else {
    // Horizontal scroll = pan timeline viewport
    if (scrollEl.value) {
      if (state.isPlaying.value) {
        isUserScrolling.value = true;
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          // Smooth glide back to playhead, then resume 60fps auto-follow
          smoothCenterPlayhead();
          setTimeout(() => {
            isUserScrolling.value = false;
          }, 400);
        }, 1200);
      }
      scrollEl.value.scrollLeft += e.deltaY + e.deltaX;
    }
  }
}

// --- Scroll (Timeline Viewport Panning) ---
function onScroll() {
  if (!scrollEl.value) return;
  if (isProgrammaticScroll || state.isPlaying.value) return;
  isUserScrolling.value = true;
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    isUserScrolling.value = false;
  }, 150);
}

// --- Ruler Drag-to-Scrub ---
const isRulerDragging = ref(false);

function seekFromRulerEvent(e: MouseEvent) {
  if (!scrollEl.value) return;
  const rulerContainer = scrollEl.value.querySelector(
    '.ruler-container'
  ) as HTMLElement;
  if (!rulerContainer) return;
  const rect = rulerContainer.getBoundingClientRect();
  const x = Math.max(0, e.clientX - rect.left);
  const maxTime = state.timelineDuration.value || 0;
  const targetTime = Math.min(maxTime, Math.max(0, x / pxPerSec.value));
  state.seekTo(targetTime);
}

function smoothCenterPlayhead(targetTime?: number) {
  if (!scrollEl.value) return;
  const time =
    typeof targetTime === 'number' ? targetTime : state.currentTime.value;
  const targetPx = time * pxPerSec.value;
  const targetScroll = Math.max(0, targetPx - containerW.value / 2);

  isProgrammaticScroll = true;
  scrollEl.value.scrollTo({
    left: targetScroll,
    behavior: 'smooth'
  });
  setTimeout(() => {
    isProgrammaticScroll = false;
  }, 400);
}

let edgeScrollRafId: number | null = null;
let latestScrubEvent: MouseEvent | null = null;

function stopEdgeScroll() {
  if (edgeScrollRafId) {
    cancelAnimationFrame(edgeScrollRafId);
    edgeScrollRafId = null;
  }
}

function checkEdgeScroll(clientX: number) {
  if (!scrollEl.value) return;
  const rect = scrollEl.value.getBoundingClientRect();
  const edgeZone = 60;
  const leftDist = clientX - rect.left;
  const rightDist = rect.right - clientX;

  let speed = 0;

  if (leftDist < edgeZone) {
    const factor = Math.max(0, 1 - leftDist / edgeZone);
    speed = -Math.min(25, 4 + factor * 21);
  } else if (rightDist < edgeZone) {
    const factor = Math.max(0, 1 - rightDist / edgeZone);
    speed = Math.min(25, 4 + factor * 21);
  }

  if (speed !== 0) {
    if (!edgeScrollRafId) {
      const step = () => {
        if (!isRulerDragging.value || !scrollEl.value) {
          stopEdgeScroll();
          return;
        }
        scrollEl.value.scrollLeft += speed;
        if (latestScrubEvent) {
          seekFromRulerEvent(latestScrubEvent);
        }
        edgeScrollRafId = requestAnimationFrame(step);
      };
      edgeScrollRafId = requestAnimationFrame(step);
    }
  } else {
    stopEdgeScroll();
  }
}

function startRulerScrub(e: MouseEvent) {
  if (e.button !== 0) return;
  isRulerDragging.value = true;
  state.selectedTimelineItem.value = null;
  latestScrubEvent = e;

  seekFromRulerEvent(e);

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isRulerDragging.value) return;
    latestScrubEvent = moveEvent;
    seekFromRulerEvent(moveEvent);
    checkEdgeScroll(moveEvent.clientX);
  };

  const onMouseUp = () => {
    isRulerDragging.value = false;
    stopEdgeScroll();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    // Smooth glide to center playhead on release (Option A)
    smoothCenterPlayhead();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

// During playback, auto-scroll to keep playhead centered
let rafId: number | null = null;

function startRaf() {
  if (rafId) return;
  const loop = () => {
    if (!state.isPlaying.value || typeof document === 'undefined') {
      stopRaf();
      return;
    }
    const video = document.getElementById(
      'preview-video-element'
    ) as HTMLVideoElement;
    const thumbSec = state.thumbnailEnabled.value
      ? state.thumbnailDuration.value
      : 0;

    // Stop playback if end of timeline reached
    if (state.currentTime.value >= state.timelineDuration.value) {
      state.isPlaying.value = false;
      stopRaf();
      return;
    }

    // Use native video to drive timeline AFTER the thumbnail window.
    // During thumbnail, Remotion is the sole clock (via REMOTION_TIMEUPDATE messages).
    // In Remotion mode, REMOTION_TIMEUPDATE overrides this, so this only matters
    // for useNativePlayer fallback mode.
    if (
      state.useNativePlayer.value &&
      video &&
      !video.paused &&
      video.volume > 0 &&
      state.currentTime.value >= thumbSec
    ) {
      state.currentTime.value = video.currentTime + thumbSec;
    }
    // Auto-scroll to center playhead
    if (scrollEl.value && !isUserScrolling.value) {
      const targetScroll = Math.max(0, playheadPx.value - containerW.value / 2);
      if (Math.abs(scrollEl.value.scrollLeft - targetScroll) >= 0.5) {
        scrollEl.value.scrollLeft = targetScroll;
      }
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function stopRaf() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// Bring playhead into visible viewport if it moves outside visible area
function ensurePlayheadInView() {
  if (!scrollEl.value) return;
  const currentScroll = scrollEl.value.scrollLeft;
  const visibleWidth = containerW.value;
  const playhead = playheadPx.value;

  if (playhead < currentScroll || playhead > currentScroll + visibleWidth) {
    const targetScroll = Math.max(0, playhead - visibleWidth / 2);
    isProgrammaticScroll = true;
    scrollEl.value.scrollLeft = targetScroll;
    setTimeout(() => {
      isProgrammaticScroll = false;
    }, 50);
  }
}

watch(
  () => state.isPlaying.value,
  playing => {
    if (playing) {
      ensurePlayheadInView();
      startRaf();
    } else {
      stopRaf();
    }
  },
  { immediate: true }
);

// --- Play ---
function togglePlay() {
  state.isPlaying.value = !state.isPlaying.value;
}

function onTrackBgClick(e: MouseEvent) {
  if (e.target !== e.currentTarget) return;
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const targetTime = Math.max(0, x / pxPerSec.value);
  state.seekTo(targetTime);
  state.selectedTimelineItem.value = null;
  smoothCenterPlayhead(targetTime);
}

// --- Add items ---
function addText() {
  state.commitToHistory();
  state.addTimelineItem('text', {
    content: 'NEW TEXT',
    color: '#ffd700',
    fontSize: 80,
    x: 540,
    y: 960
  });
}
function triggerAudioUpload() {
  audioInput.value?.click();
}
function handleAudioFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    state.commitToHistory();
    state.addTimelineItem('audio', {
      name: file.name,
      src: ev.target?.result,
      duration: 5
    });
  };
  reader.readAsDataURL(file);
}

// --- Snap logic ---
function snapValue(val: number, trackId?: string): number {
  return calculateSnapTime(
    val,
    snapEnabled.value,
    pxPerSec.value,
    state.currentTime.value,
    state.timelineTracks.value,
    state.thumbnailEnabled.value,
    state.thumbnailDuration.value,
    draggingItem?.id
  );
}

// --- Drag/Resize ---
let draggingItem: any = null;
let dragStartX = 0;
let dragStartVal = 0;
let resizeMode: 'start' | 'end' | null = null;
let dragTrackId = '';
let dragStartSnapshot: any = null;

function startMove(e: MouseEvent, trackId: string, item: any) {
  state.selectedTimelineItem.value = item;
  draggingItem = item;
  dragTrackId = trackId;
  dragStartX = e.clientX;
  dragStartVal = item.start;
  resizeMode = null;
  dragStartSnapshot = {
    tracks: JSON.parse(JSON.stringify(state.timelineTracks.value)),
    transcript: state.fullTranscript.value
      ? state.fullTranscript.value.map((seg: any) => ({
          id: seg.id,
          start: seg.start,
          duration: seg.duration,
          text: seg.text,
          words: seg.words ? JSON.parse(JSON.stringify(seg.words)) : undefined
        }))
      : [],
    selectedId: state.selectedTimelineItem.value?.id || null
  };
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}

function startResize(
  e: MouseEvent,
  trackId: string,
  item: any,
  mode: 'start' | 'end'
) {
  state.selectedTimelineItem.value = item;
  draggingItem = item;
  dragTrackId = trackId;
  dragStartX = e.clientX;
  dragStartVal = mode === 'start' ? item.start : item.duration;
  resizeMode = mode;
  dragStartSnapshot = {
    tracks: JSON.parse(JSON.stringify(state.timelineTracks.value)),
    transcript: state.fullTranscript.value
      ? state.fullTranscript.value.map((seg: any) => ({
          id: seg.id,
          start: seg.start,
          duration: seg.duration,
          text: seg.text,
          words: seg.words ? JSON.parse(JSON.stringify(seg.words)) : undefined
        }))
      : [],
    selectedId: state.selectedTimelineItem.value?.id || null
  };
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}

function onDrag(e: MouseEvent) {
  if (!draggingItem) return;
  const dx = (e.clientX - dragStartX) / pxPerSec.value;
  const bounds = calculateDragBounds(
    resizeMode || 'move',
    dragStartVal,
    dx,
    draggingItem,
    val => snapValue(val, dragTrackId)
  );
  draggingItem.start = bounds.newStart;
  draggingItem.duration = bounds.newDuration;
}

function stopDrag() {
  draggingItem = null;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);

  if (dragStartSnapshot) {
    const currentTracks = JSON.stringify(state.timelineTracks.value);
    const originalTracks = JSON.stringify(dragStartSnapshot.tracks);
    if (currentTracks !== originalTracks) {
      const timelineUndoStack = useState<any[]>('timelineUndoStack');
      const timelineRedoStack = useState<any[]>('timelineRedoStack');
      timelineUndoStack.value.push(dragStartSnapshot);
      if (timelineUndoStack.value.length > 50) {
        timelineUndoStack.value.shift();
      }
      timelineRedoStack.value = []; // Clear redo stack
    }
    dragStartSnapshot = null;
  }
}

// --- Delete / Split ---
function deleteSelected() {
  if (!state.selectedTimelineItem.value) return;
  state.commitToHistory();
  const itemToDelete = { ...state.selectedTimelineItem.value };
  const id = itemToDelete.id;

  const track = state.timelineTracks.value.find((t: any) =>
    t.items.some((i: any) => i.id === id)
  );
  const trackId = track?.id || '';

  const result = deleteTimelineItemWithRipple(
    state.timelineTracks.value,
    state.fullTranscript.value,
    itemToDelete,
    trackId,
    state.currentTime.value,
    state.thumbnailEnabled.value,
    state.thumbnailDuration.value
  );

  state.timelineTracks.value = result.updatedTracks;
  state.currentTime.value = result.updatedCurrentTime;
  if (trackId === 'video') {
    state.fullTranscript.value = result.updatedTranscript;
    state.saveTranscript();
  }
  state.saveTimelineTracks();
}

function splitSelected() {
  const item = state.selectedTimelineItem.value;
  if (!item) return;
  const offset = state.thumbnailEnabled.value
    ? state.thumbnailDuration.value
    : 0;
  const cut = state.currentTime.value - offset;

  const splitResult = splitTimelineItem(item, cut);
  if (splitResult) {
    state.commitToHistory();
    item.duration = splitResult.firstItem.duration;
    const track = state.timelineTracks.value.find((t: any) =>
      t.items.some((i: any) => i.id === item.id)
    );
    if (track) {
      state.addTimelineItem(track.id, splitResult.secondItem);
      state.saveTimelineTracks();
    }
  }
}

// --- Keyboard ---
function onKeyDown(e: KeyboardEvent) {
  if (
    isOverlayVisible.value ||
    state?.renderStatus?.value === 'rendering' ||
    state?.isRenderPreviewActive?.value ||
    state?.isEditorLocked?.value
  ) {
    return;
  }
  if (
    e.target instanceof HTMLTextAreaElement ||
    e.target instanceof HTMLInputElement
  )
    return;
  if (e.target instanceof HTMLElement && e.target.isContentEditable) return;

  const isMeta = e.metaKey || e.ctrlKey;
  if (isMeta && e.key?.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) {
      state.redo();
    } else {
      state.undo();
    }
    return;
  } else if (isMeta && e.key?.toLowerCase() === 'y') {
    e.preventDefault();
    state.redo();
    return;
  }

  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
  else if (e.key === 'k' || e.key === 'K') splitSelected();
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  stopRaf();
  stopEdgeScroll();
});
</script>

<style scoped>
.tl-scroll::-webkit-scrollbar {
  height: 6px;
}
.tl-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.tl-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 0;
}
.tl-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}
</style>
