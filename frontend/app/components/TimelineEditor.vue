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
            ref="audioBtnEl"
            class="px-2 py-1 rounded hover:bg-white/5 text-[9px] font-bold tracking-wider flex items-center gap-1.5 transition-colors"
            :class="
              isAudioLibraryOpen
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-slate-400'
            "
            @click="toggleAudioLibrary"
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
    <div class="flex-1 flex overflow-hidden relative select-none min-h-0">
      <!-- Track Headers Rail (Pinned corner + synced vertical scroll) -->
      <div
        class="w-40 bg-[#111113] border-r border-white/5 flex flex-col shrink-0 z-40 min-h-0"
      >
        <div
          class="h-6 shrink-0 border-b border-white/5 bg-[#0d0d0f] px-2 flex items-center justify-between gap-1"
        >
          <button
            type="button"
            data-testid="add-text-track-btn"
            title="Add Text Track"
            class="px-1.5 py-0.5 rounded bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 text-[9px] font-bold tracking-wide flex items-center gap-0.5 transition-colors"
            @click="handleAddTrack('text')"
          >
            <Icon name="ri:add-line" class="text-[10px]" /> Text
          </button>
          <button
            type="button"
            data-testid="add-audio-track-btn"
            title="Add Audio Track"
            class="px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[9px] font-bold tracking-wide flex items-center gap-0.5 transition-colors"
            @click="handleAddTrack('audio')"
          >
            <Icon name="ri:add-line" class="text-[10px]" /> Audio
          </button>
        </div>

        <div
          ref="headerScrollEl"
          data-testid="track-headers-scroll"
          class="flex-1 overflow-y-auto overflow-x-hidden tl-header-scroll min-h-0"
          @scroll="onHeaderScroll"
        >
          <div
            v-for="track in state.timelineTracks.value"
            :key="track.id"
            :data-testid="'track-header-' + track.id"
            :data-track-id="track.id"
            :data-active-track="isTrackActive(track) ? 'true' : 'false'"
            class="border-b border-white/5 px-2.5 flex items-center gap-1.5 relative transition-colors"
            :class="[
              trackHeaderRowClass(track),
              !isVideoTrack(track) ? 'cursor-pointer' : ''
            ]"
            :style="{ height: trackH + 'px' }"
            @click="handleSelectTrack(track)"
          >
            <div
              class="absolute left-0 top-0 bottom-0"
              :class="[
                trackBorderColor(track),
                isTrackActive(track) ? 'w-[3px]' : 'w-[2px] opacity-60'
              ]"
            ></div>
            <Icon
              :name="trackIcon(track)"
              class="text-[10px] shrink-0"
              :class="trackColor(track)"
            />
            <span
              class="text-[9px] font-bold uppercase tracking-wider truncate flex-1 text-slate-300"
            >
              {{ track.name }}
            </span>
            <div
              v-if="!isVideoTrack(track)"
              class="flex items-center gap-0.5 shrink-0"
              @click.stop
            >
              <button
                v-if="isAudioTrack(track)"
                type="button"
                :data-testid="'toggle-mute-' + track.id"
                :aria-label="(track.muted ? 'Unmute ' : 'Mute ') + track.name"
                :aria-pressed="Boolean(track.muted)"
                :title="track.muted ? 'Unmute Track' : 'Mute Track'"
                class="p-1 rounded transition-colors"
                :class="
                  track.muted
                    ? 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                "
                @click="handleToggleMute(track.id)"
              >
                <Icon
                  :name="
                    track.muted ? 'ri:volume-mute-line' : 'ri:volume-up-line'
                  "
                  class="text-[11px]"
                />
              </button>
              <button
                v-if="isTextTrack(track)"
                type="button"
                :data-testid="'toggle-hide-' + track.id"
                :aria-label="(track.hidden ? 'Show ' : 'Hide ') + track.name"
                :aria-pressed="Boolean(track.hidden)"
                :title="track.hidden ? 'Show Track' : 'Hide Track'"
                class="p-1 rounded transition-colors"
                :class="
                  track.hidden
                    ? 'text-violet-300 bg-violet-500/15 hover:bg-violet-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                "
                @click="handleToggleVisibility(track.id)"
              >
                <Icon
                  :name="track.hidden ? 'ri:eye-off-line' : 'ri:eye-line'"
                  class="text-[11px]"
                />
              </button>
              <button
                type="button"
                :data-testid="'delete-track-' + track.id"
                :disabled="!isTrackDeletable(track.id)"
                :aria-label="'Delete ' + track.name"
                :title="
                  isTrackDeletable(track.id)
                    ? 'Delete Track'
                    : 'At least 1 track required'
                "
                class="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                @click="handleDeleteTrack(track.id)"
              >
                <Icon name="ri:delete-bin-line" class="text-[11px]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Scrollable Timeline -->
      <div
        ref="scrollEl"
        class="flex-1 overflow-auto relative tl-scroll min-h-0"
        @scroll="onScroll"
        @wheel="onWheel"
      >
        <!-- Sticky Time Ruler & Pinned Scrubbing Head -->
        <div
          class="sticky top-0 z-40 bg-[#0d0d0f] border-b border-white/5 cursor-pointer select-none timeline-ruler"
          :style="{ height: '24px', width: totalW + 'px' }"
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
                    ? 'border-white/25 h-[10px]'
                    : 'border-white/10 h-[5px]'
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
            <div
              data-testid="timeline-playhead-head"
              class="absolute top-0 bottom-[-1px] z-20 pointer-events-none"
              :style="{ left: playheadPx + 'px', width: '2px' }"
            >
              <div
                data-testid="timeline-playhead-handle"
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

        <!-- Track Content Area -->
        <div
          data-testid="timeline-tracks-canvas"
          class="relative"
          :style="{
            width: totalW + 'px',
            minHeight: 'calc(100% - 24px)'
          }"
          @mousedown="onTrackBgClick"
        >
          <div
            v-for="track in state.timelineTracks.value"
            :key="track.id"
            :data-testid="'track-lane-' + track.id"
            :data-track-id="track.id"
            :data-track-type="resolveTrackType(track) || track.type"
            class="relative border-b border-white/[0.03] transition-colors"
            :class="trackLaneClass(track)"
            :style="{ height: trackH + 'px' }"
          >
            <!-- Cover Slide block -->
            <div
              v-if="isVideoTrack(track) && isCoverActive"
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
            <div
              v-else-if="isCoverActive && thumbW > 0 && !isAudioTrack(track)"
              data-testid="cover-slide-zone"
              class="absolute top-[4px] rounded-[3px] border-r border-dashed border-emerald-500/25 flex items-center px-2 gap-1 pointer-events-none overflow-hidden"
              :style="{
                left: 0,
                width: thumbW + 'px',
                height: trackH - 8 + 'px',
                background:
                  'repeating-linear-gradient(-45deg, rgba(6,78,59,0.18), rgba(6,78,59,0.18) 4px, rgba(6,78,59,0.06) 4px, rgba(6,78,59,0.06) 8px)'
              }"
              title="Cover Slide Intro Zone"
            >
              <span
                class="text-[7px] font-semibold text-emerald-400/70 truncate tracking-wider"
                >Cover</span
              >
            </div>
            <!-- Track items -->
            <div
              v-for="item in track.items"
              :key="item.id"
              class="absolute top-[4px] rounded-[3px] cursor-move flex items-center px-2 gap-1.5 overflow-hidden border-l-[3px] transition-opacity duration-200"
              :class="[
                itemClasses(track.type, item),
                track.muted || track.hidden ? 'opacity-45' : ''
              ]"
              :style="itemStyle(track, item)"
              @mousedown.stop="startMove($event, track.id, item)"
            >
              <span class="text-[8px] font-bold truncate opacity-90">{{
                item.content ||
                item.name ||
                resolveTrackType(track) ||
                track.type
              }}</span>
              <span class="text-[7px] mono opacity-60 ml-auto shrink-0"
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

            <!-- Flagged markers layer (rendered over Main Video track) -->
            <template
              v-if="
                isVideoTrack(track) && state.contentAudit.value?.flaggedSegments
              "
            >
              <div
                v-for="(v, i) in state.contentAudit.value.flaggedSegments"
                :key="'v-' + i"
                class="absolute top-[4px] rounded-[3px] bg-rose-500/25 border-x border-rose-500/50 pointer-events-none z-20"
                :style="{
                  left: getMarkerLeft(getRelativeMarkerTime(v.start)) + 'px',
                  width: Math.max(2, v.duration * pxPerSec) + 'px',
                  height: trackH - 8 + 'px'
                }"
              >
                <div
                  class="absolute -top-[1px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                ></div>
              </div>
            </template>
          </div>

          <!-- Playhead vertical guide across all track lanes down to the bottom layer -->
          <div
            data-testid="timeline-playhead"
            class="absolute top-0 bottom-0 z-30 pointer-events-none bg-[#ff3b30]"
            :style="{ left: playheadPx + 'px', width: '2px' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Properties Inspector Panel (Extracted Deep Module) -->
    <TimelinePropertiesInspector
      :cover-enabled="isCoverActive"
      :cover-duration="activeCoverDuration"
      @delete="deleteSelected"
      @commit-history="state.commitToHistory"
    />

    <!-- Workspace Audio Library Popover -->
    <AudioLibraryPopover
      v-model="isAudioLibraryOpen"
      :items="state.audioLibrary?.value || []"
      :loading="state.isAudioLibraryLoading?.value || false"
      :anchor-rect="audioAnchorRect"
      :duplicate-prompt="duplicateAudioPrompt"
      @close="closeAudioLibrary"
      @insert="insertAudioFromLibrary"
      @delete="handleDeleteLibraryAudio"
      @trigger-upload="triggerAudioUpload"
      @confirm-replace="confirmReplaceDuplicateAudio"
      @confirm-use-existing="confirmUseExistingDuplicateAudio"
      @cancel-duplicate="duplicateAudioPrompt = null"
    />

    <input
      ref="audioInput"
      type="file"
      class="hidden"
      :accept="AUDIO_INPUT_ACCEPT"
      @change="handleAudioFile"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import {
  calculateRulerTicks,
  calculateSnapTime,
  calculateDragBounds,
  splitTimelineItem,
  deleteTimelineItemWithRipple,
  findTrackByItemId,
  getItemLeftPx,
  canDeleteTimelineTrack,
  hasTrackIntervalOverlap,
  isAudioTrack,
  isTextTrack,
  isVideoTrack,
  resolveTrackType,
  AUDIO_INPUT_ACCEPT,
  isValidAudioFile,
  resolveAudioFileDuration
} from '../utils/timelineHelpers';
import type { TrackRef } from '../utils/timelineHelpers';
import type {
  TimelineTrack,
  TimelineTrackItem,
  TimelineTrackType,
  AudioLibraryItem,
  AnchorRect,
  DuplicateAudioPrompt
} from '../types/clipper';

import TimelinePropertiesInspector from './editor/TimelinePropertiesInspector.vue';
import AudioLibraryPopover from './editor/AudioLibraryPopover.vue';

const state = useClipperState();
const isOverlayVisible = useState<boolean>('isOverlayVisible', () => false);

const pxPerSec = ref(100);
const scrollEl = ref<HTMLElement | null>(null);
const headerScrollEl = ref<HTMLElement | null>(null);
const audioInput = ref<HTMLInputElement | null>(null);
const audioBtnEl = ref<HTMLElement | null>(null);
const isAudioLibraryOpen = ref(false);
const audioAnchorRect = ref<AnchorRect | null>(null);
const duplicateAudioPrompt = ref<DuplicateAudioPrompt | null>(null);
const snapEnabled = ref(true);
const trackH = 40;
const isUserScrolling = ref(false);
const dragTargetTrackId = ref<string | null>(null);
const dragTargetValid = ref(true);
let scrollTimeout: any = null;
let isProgrammaticScroll = false;

// --- Cover Slide ---
const isCoverActive = computed(
  () => state.coverEnabled?.value ?? state.thumbnailEnabled.value ?? false
);
const activeCoverDuration = computed(
  () => state.coverDuration?.value ?? state.thumbnailDuration.value ?? 3
);
const thumbW = computed(() =>
  isCoverActive.value ? activeCoverDuration.value * pxPerSec.value : 0
);
const thumbOffsetPx = computed(() => thumbW.value);

function getItemLeft(
  track: TimelineTrack | { id?: string; type?: string },
  item: TimelineTrackItem | { start: number }
) {
  return getItemLeftPx(
    track,
    item.start,
    pxPerSec.value,
    isCoverActive.value,
    thumbOffsetPx.value
  );
}

function getMarkerLeft(val: number) {
  const base = val * pxPerSec.value;
  return isCoverActive.value ? base + thumbOffsetPx.value : base;
}

function getRelativeMarkerTime(val: number) {
  const firstStart = state.fullTranscript?.value?.[0]?.start || 0;
  const isTranscriptZeroBased = state.activeHook?.value
    ? firstStart < (state.activeHook.value.start || 0) - 2
    : true;

  if (isTranscriptZeroBased) return val;
  return val - (state.activeHook?.value?.start || 0);
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
interface TrackStyleConfig {
  icon: string;
  color: string;
  borderColor: string;
  activeBg: string;
  itemBg: string;
  itemBorder: string;
}

const TRACK_STYLES: Record<TimelineTrackType, TrackStyleConfig> = {
  video: {
    icon: 'ri:film-line',
    color: 'text-sky-400',
    borderColor: 'bg-sky-500',
    activeBg: '',
    itemBg: '#1a365d',
    itemBorder: '#3182ce'
  },
  audio: {
    icon: 'ri:volume-up-line',
    color: 'text-green-400',
    borderColor: 'bg-green-500',
    activeBg: 'bg-emerald-500/10',
    itemBg: '#1a3a1a',
    itemBorder: '#38a169'
  },
  text: {
    icon: 'ri:text',
    color: 'text-violet-400',
    borderColor: 'bg-violet-500',
    activeBg: 'bg-violet-500/10',
    itemBg: '#2d1b5e',
    itemBorder: '#805ad5'
  }
};

function trackTypeOf(track: TrackRef): TimelineTrackType {
  return resolveTrackType(track) || 'text';
}
function trackIcon(track: TrackRef) {
  return TRACK_STYLES[trackTypeOf(track)].icon;
}
function trackColor(track: TrackRef) {
  return TRACK_STYLES[trackTypeOf(track)].color;
}
function trackBorderColor(track: TrackRef) {
  return TRACK_STYLES[trackTypeOf(track)].borderColor;
}
function isTrackActive(track: TimelineTrack) {
  const t = trackTypeOf(track);
  if (t !== 'text' && t !== 'audio') return false;
  return state?.activeTrackIds?.value?.[t] === track.id;
}
function isTrackDeletable(trackId: string) {
  if (state?.canDeleteTrack) {
    return state.canDeleteTrack(trackId);
  }
  return canDeleteTimelineTrack(state.timelineTracks.value || [], trackId);
}
function trackHeaderRowClass(track: TimelineTrack) {
  if (!isTrackActive(track)) return '';
  return TRACK_STYLES[trackTypeOf(track)].activeBg;
}
function trackLaneClass(track: TimelineTrack) {
  if (dragTargetTrackId.value === track.id) {
    return dragTargetValid.value
      ? 'bg-white/[0.04] ring-1 ring-inset ring-sky-400/60'
      : 'bg-rose-500/10 ring-1 ring-inset ring-rose-500/70';
  }
  if (isTrackActive(track)) {
    return 'bg-white/[0.015]';
  }
  return '';
}
function handleSelectTrack(track: TimelineTrack) {
  const t = trackTypeOf(track);
  if (t === 'text' || t === 'audio') {
    state.setActiveTrack?.(track.id);
  }
}
function handleAddTrack(type: 'text' | 'audio') {
  state.addTrack?.(type);
  state.saveTimelineTracks?.();
}
function handleDeleteTrack(trackId: string) {
  if (!isTrackDeletable(trackId)) return;
  const deleted = state.deleteTrack?.(trackId);
  if (deleted !== false) {
    state.saveTimelineTracks?.();
  }
}
function handleToggleMute(trackId: string) {
  state.toggleTrackMute?.(trackId);
  state.saveTimelineTracks?.();
}
function handleToggleVisibility(trackId: string) {
  state.toggleTrackVisibility?.(trackId);
  state.saveTimelineTracks?.();
}

function itemClasses(_type: string, item: TimelineTrackItem) {
  return item.id === state.selectedTimelineItem.value?.id
    ? 'border border-white/80'
    : 'border border-transparent';
}

function itemStyle(track: TimelineTrack, item: TimelineTrackItem) {
  const styleCfg = TRACK_STYLES[trackTypeOf(track)];
  return {
    left: getItemLeft(track, item) + 'px',
    width: item.duration * pxPerSec.value + 'px',
    height: trackH - 8 + 'px',
    background: styleCfg.itemBg,
    borderLeftColor: styleCfg.itemBorder
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
    return;
  }
  if (!scrollEl.value) return;

  const hasVerticalOverflow =
    scrollEl.value.scrollHeight > scrollEl.value.clientHeight + 1;
  const isHorizontalGesture =
    e.shiftKey ||
    Math.abs(e.deltaX) > Math.abs(e.deltaY) ||
    !hasVerticalOverflow;

  e.preventDefault();
  if (isHorizontalGesture) {
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
    scrollEl.value.scrollLeft += e.shiftKey
      ? e.deltaY + e.deltaX
      : e.deltaX || e.deltaY;
  } else {
    scrollEl.value.scrollTop += e.deltaY;
  }
}

// --- Scroll (Timeline Viewport Panning + Synced Vertical Header Scroll) ---
function syncVerticalScroll(
  source: HTMLElement | null,
  target: HTMLElement | null
) {
  if (!source || !target) return;
  if (Math.abs(target.scrollTop - source.scrollTop) >= 1) {
    target.scrollTop = source.scrollTop;
  }
}

function onHeaderScroll() {
  syncVerticalScroll(headerScrollEl.value, scrollEl.value);
}

function onScroll() {
  if (!scrollEl.value) return;
  syncVerticalScroll(scrollEl.value, headerScrollEl.value);
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
    const thumbSec = isCoverActive.value ? activeCoverDuration.value : 0;

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
function updateAudioAnchorRect() {
  if (!audioBtnEl.value) return;
  const r = audioBtnEl.value.getBoundingClientRect();
  audioAnchorRect.value = {
    top: r.top,
    left: r.left,
    bottom: r.bottom,
    right: r.right,
    width: r.width,
    height: r.height
  };
}

async function toggleAudioLibrary() {
  if (isAudioLibraryOpen.value) {
    closeAudioLibrary();
    return;
  }
  updateAudioAnchorRect();
  duplicateAudioPrompt.value = null;
  isAudioLibraryOpen.value = true;
  if (typeof state.fetchAudioLibrary === 'function') {
    await state.fetchAudioLibrary();
  }
}

function closeAudioLibrary() {
  isAudioLibraryOpen.value = false;
  duplicateAudioPrompt.value = null;
}

function insertAudioFromLibrary(item: AudioLibraryItem) {
  state.commitToHistory();
  state.addTimelineItem('audio', {
    name: item.name,
    src: item.src,
    duration: item.duration
  });
  closeAudioLibrary();
}

async function handleDeleteLibraryAudio(id: string) {
  if (typeof state.deleteAudioItem === 'function') {
    await state.deleteAudioItem(id);
  }
}

async function confirmReplaceDuplicateAudio() {
  const prompt = duplicateAudioPrompt.value;
  if (!prompt || typeof state.uploadAudioFile !== 'function') return;
  const res = await state.uploadAudioFile(
    prompt.file,
    prompt.duration,
    'replace'
  );
  duplicateAudioPrompt.value = null;
  if (res?.item) {
    insertAudioFromLibrary(res.item);
  }
}

function confirmUseExistingDuplicateAudio() {
  const prompt = duplicateAudioPrompt.value;
  if (!prompt) return;
  duplicateAudioPrompt.value = null;
  insertAudioFromLibrary(prompt.existingItem);
}

function triggerAudioUpload() {
  audioInput.value?.click();
}

async function handleAudioFile(e: Event) {
  const inputEl = e.target as HTMLInputElement;
  const file = inputEl.files?.[0];
  if (!file) return;

  if (!isValidAudioFile(file)) {
    state.showToast(
      'Hanya file audio (.mp3, .wav, .ogg, .aac, .m4a, .flac) yang didukung.',
      'error'
    );
    inputEl.value = '';
    return;
  }

  const duration = await resolveAudioFileDuration(file);

  if (typeof state.uploadAudioFile === 'function') {
    const res = await state.uploadAudioFile(file, duration, 'prompt');
    inputEl.value = '';
    if (!res) return;

    if (res.status === 'duplicate') {
      updateAudioAnchorRect();
      duplicateAudioPrompt.value = {
        file,
        duration,
        existingItem: res.item
      };
      isAudioLibraryOpen.value = true;
      return;
    }

    insertAudioFromLibrary(res.item);
    return;
  }

  const reader = new FileReader();
  reader.onload = ev => {
    state.commitToHistory();
    state.addTimelineItem('audio', {
      name: file.name,
      src: ev.target?.result,
      duration
    });
  };
  reader.readAsDataURL(file);
  inputEl.value = '';
}

// --- Snap logic ---
function snapValue(val: number, trackId?: string): number {
  const track = state.timelineTracks.value.find(
    (t: TimelineTrack) => t.id === (trackId || dragTrackId)
  );
  const isAudio =
    isAudioTrack(track) ||
    isAudioTrack(trackId) ||
    isAudioTrack(dragTrackId) ||
    isAudioTrack(draggingItem?.type);
  return calculateSnapTime(
    val,
    snapEnabled.value,
    pxPerSec.value,
    state.currentTime.value,
    state.timelineTracks.value,
    isCoverActive.value,
    activeCoverDuration.value,
    draggingItem?.id,
    isAudio
  );
}

// --- Drag/Resize ---
let draggingItem: any = null;
let draggingEl: HTMLElement | null = null;
let draggingDurationEl: HTMLElement | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragStartScrollTop = 0;
let dragSourceTrackIndex = -1;
let dragCandidateTrackIndex = -1;
let dragSourceType = '';
let dragStartVal = 0;
let initialItemStart = 0;
let initialItemDuration = 0;
let pendingStart = 0;
let pendingDuration = 0;
let resizeMode: 'start' | 'end' | null = null;
let dragTrackId = '';

function resolveCandidateTrackIndex(clientY: number): number {
  const tracks = state.timelineTracks.value || [];
  if (resizeMode || dragSourceTrackIndex < 0 || tracks.length === 0) {
    return dragSourceTrackIndex;
  }
  const currentScrollTop = scrollEl.value?.scrollTop ?? 0;
  const dy = clientY - dragStartY + (currentScrollTop - dragStartScrollTop);
  const rowDelta = Math.round(dy / trackH);
  return Math.max(
    0,
    Math.min(tracks.length - 1, dragSourceTrackIndex + rowDelta)
  );
}

function evaluateDragPlacement(
  candidateIdx: number,
  newStart: number,
  newDuration: number
) {
  const tracks = state.timelineTracks.value || [];
  const candidateTrack = candidateIdx >= 0 ? tracks[candidateIdx] : undefined;
  if (!candidateTrack) {
    dragTargetTrackId.value = null;
    dragTargetValid.value = true;
    dragCandidateTrackIndex = dragSourceTrackIndex;
    return;
  }

  const isSameTrack = candidateTrack.id === dragTrackId;
  const sameType =
    isSameTrack || resolveTrackType(candidateTrack) === dragSourceType;
  const overlaps = hasTrackIntervalOverlap(
    candidateTrack.items || [],
    newStart,
    newDuration,
    draggingItem?.id
  );
  const valid = sameType && !overlaps;

  if (isSameTrack) {
    dragTargetTrackId.value = valid ? null : candidateTrack.id;
    dragTargetValid.value = valid;
    dragCandidateTrackIndex = dragSourceTrackIndex;
    return;
  }

  dragTargetTrackId.value = candidateTrack.id;
  dragTargetValid.value = valid;
  dragCandidateTrackIndex = valid ? candidateIdx : dragSourceTrackIndex;
}

function restoreDraggedElementStyles() {
  if (!draggingEl) return;
  draggingEl.style.transform = '';
  const leftPx = getItemLeftPx(
    dragTrackId,
    initialItemStart,
    pxPerSec.value,
    isCoverActive.value,
    thumbOffsetPx.value
  );
  draggingEl.style.left = `${leftPx}px`;
  draggingEl.style.width = `${initialItemDuration * pxPerSec.value}px`;
  if (draggingDurationEl) {
    draggingDurationEl.textContent = `${initialItemDuration.toFixed(1)}s`;
  }
}

function initDragSession(
  e: MouseEvent,
  trackId: string,
  item: TimelineTrackItem,
  targetEl: HTMLElement | null,
  mode: 'start' | 'end' | null
) {
  state.selectedTimelineItem.value = item;
  if (state.isDraggingTimelineItem) {
    state.isDraggingTimelineItem.value = true;
  }
  draggingItem = item;
  draggingEl = targetEl;
  draggingDurationEl = draggingEl?.querySelector('.mono') || null;
  dragTrackId = trackId;
  dragStartX = e.clientX;
  dragStartY = e.clientY ?? 0;
  dragStartScrollTop = scrollEl.value?.scrollTop ?? 0;
  const tracks = state.timelineTracks.value || [];
  dragSourceTrackIndex = tracks.findIndex(
    (t: TimelineTrack) => t.id === trackId
  );
  dragCandidateTrackIndex = dragSourceTrackIndex;
  dragSourceType =
    resolveTrackType(tracks[dragSourceTrackIndex] ?? trackId) || '';
  dragTargetTrackId.value = null;
  dragTargetValid.value = true;
  dragStartVal = mode === 'end' ? item.duration : item.start;
  initialItemStart = item.start;
  initialItemDuration = item.duration;
  pendingStart = item.start;
  pendingDuration = item.duration;
  resizeMode = mode;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}

function startMove(e: MouseEvent, trackId: string, item: TimelineTrackItem) {
  initDragSession(
    e,
    trackId,
    item,
    (e.currentTarget as HTMLElement) || null,
    null
  );
}

function startResize(
  e: MouseEvent,
  trackId: string,
  item: TimelineTrackItem,
  mode: 'start' | 'end'
) {
  initDragSession(
    e,
    trackId,
    item,
    (e.currentTarget as HTMLElement)?.parentElement || null,
    mode
  );
}

function onDrag(e: MouseEvent) {
  if (!draggingItem) return;
  const dx = (e.clientX - dragStartX) / pxPerSec.value;
  const tracks = state.timelineTracks.value || [];
  const candidateIdx = resolveCandidateTrackIndex(e.clientY ?? dragStartY);
  const candidateTrack = candidateIdx >= 0 ? tracks[candidateIdx] : undefined;
  const sameTypeAsSource = Boolean(
    candidateTrack && resolveTrackType(candidateTrack) === dragSourceType
  );
  const previewTrackId =
    !resizeMode && candidateTrack && sameTypeAsSource
      ? candidateTrack.id
      : dragTrackId;

  const bounds = calculateDragBounds(
    resizeMode || 'move',
    dragStartVal,
    dx,
    {
      ...draggingItem,
      start: pendingStart,
      duration: pendingDuration
    },
    val => snapValue(val, previewTrackId)
  );
  pendingStart = bounds.newStart;
  pendingDuration = bounds.newDuration;

  evaluateDragPlacement(candidateIdx, pendingStart, pendingDuration);

  if (draggingEl) {
    const leftPx = getItemLeftPx(
      previewTrackId,
      pendingStart,
      pxPerSec.value,
      isCoverActive.value,
      thumbOffsetPx.value
    );
    draggingEl.style.left = `${leftPx}px`;
    draggingEl.style.width = `${pendingDuration * pxPerSec.value}px`;
    if (!resizeMode && dragSourceTrackIndex >= 0) {
      const rowOffsetPx =
        (dragCandidateTrackIndex - dragSourceTrackIndex) * trackH;
      draggingEl.style.transform =
        rowOffsetPx !== 0 ? `translateY(${rowOffsetPx}px)` : '';
    }
    if (draggingDurationEl && resizeMode) {
      draggingDurationEl.textContent = `${pendingDuration.toFixed(1)}s`;
    }
  }
}

function stopDrag() {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);

  const targetTrackId = dragTargetTrackId.value;
  const isTargetValid = dragTargetValid.value;
  dragTargetTrackId.value = null;
  dragTargetValid.value = true;

  if (draggingEl) {
    draggingEl.style.transform = '';
  }

  if (draggingItem) {
    const hasTimeChanged =
      Math.abs(pendingStart - initialItemStart) > 0.0001 ||
      Math.abs(pendingDuration - initialItemDuration) > 0.0001;
    const isCrossTrack = Boolean(
      targetTrackId && targetTrackId !== dragTrackId
    );
    let hasMutated = false;

    if (isCrossTrack && targetTrackId) {
      if (isTargetValid && state.moveTimelineItemToTrack) {
        state.commitToHistory?.();
        const moved = state.moveTimelineItemToTrack(
          draggingItem.id,
          dragTrackId,
          targetTrackId,
          pendingStart,
          pendingDuration
        );
        if (moved) {
          hasMutated = true;
        } else {
          restoreDraggedElementStyles();
        }
      } else {
        restoreDraggedElementStyles();
      }
    } else if (hasTimeChanged) {
      const tracks = state.timelineTracks.value || [];
      const sourceTrack = tracks.find(
        (t: TimelineTrack) => t.id === dragTrackId
      );
      const overlapsSameTrack =
        sourceTrack &&
        hasTrackIntervalOverlap(
          sourceTrack.items || [],
          pendingStart,
          pendingDuration,
          draggingItem.id
        );
      if (isTargetValid && !overlapsSameTrack) {
        state.commitToHistory?.();
        draggingItem.start = pendingStart;
        draggingItem.duration = pendingDuration;
        hasMutated = true;
      } else {
        restoreDraggedElementStyles();
      }
    }

    draggingItem = null;
    draggingEl = null;
    draggingDurationEl = null;

    if (hasMutated) {
      state.saveTimelineTracks?.();
      nextTick(() => {
        if (state.isDraggingTimelineItem) {
          state.isDraggingTimelineItem.value = false;
        }
      });
    } else if (state.isDraggingTimelineItem) {
      state.isDraggingTimelineItem.value = false;
    }
  } else if (state.isDraggingTimelineItem) {
    state.isDraggingTimelineItem.value = false;
  }
}

// --- Delete / Split ---
function deleteSelected() {
  if (!state.selectedTimelineItem.value) return;
  state.commitToHistory();
  const itemToDelete = { ...state.selectedTimelineItem.value };
  const track = findTrackByItemId(state.timelineTracks.value, itemToDelete.id);
  const trackId = track?.id || '';

  const result = deleteTimelineItemWithRipple(
    state.timelineTracks.value,
    state.fullTranscript?.value || [],
    itemToDelete,
    trackId,
    state.currentTime.value,
    isCoverActive.value,
    activeCoverDuration.value
  );

  state.timelineTracks.value = result.updatedTracks;
  state.currentTime.value = result.updatedCurrentTime;
  if (
    isVideoTrack(track || trackId) &&
    state.fullTranscript &&
    state.saveTranscript
  ) {
    state.fullTranscript.value = result.updatedTranscript;
    state.saveTranscript();
  }
  state.selectedTimelineItem.value = null;
  state.saveTimelineTracks();
}

function splitSelected() {
  const item = state.selectedTimelineItem.value;
  if (!item) return;
  const track = findTrackByItemId(state.timelineTracks.value, item.id);
  const isAudio = isAudioTrack(track) || isAudioTrack(item.type);
  const offset =
    isCoverActive.value && !isAudio ? activeCoverDuration.value : 0;
  const cut = state.currentTime.value - offset;

  const splitResult = splitTimelineItem(item, cut);
  if (splitResult) {
    state.commitToHistory();
    item.duration = splitResult.firstItem.duration;
    if (track) {
      state.addTimelineItem(track.id, splitResult.secondItem, {
        forceTrack: true
      });
      const updatedTrack = state.timelineTracks.value.find(
        (t: TimelineTrack) => t.id === track.id
      );
      const insertedSecondItem = updatedTrack?.items.find(
        (i: TimelineTrackItem) => i.id === splitResult.secondItem.id
      );
      state.selectedTimelineItem.value =
        insertedSecondItem ?? splitResult.secondItem;
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
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  stopRaf();
  stopEdgeScroll();
});
</script>

<style scoped>
.tl-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.tl-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.tl-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 0;
}
.tl-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.16);
}
.tl-header-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.tl-header-scroll::-webkit-scrollbar {
  display: none;
}
</style>
