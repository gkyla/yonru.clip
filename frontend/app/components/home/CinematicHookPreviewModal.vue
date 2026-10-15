<template>
  <!-- Cinematic Modal Overlay -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 scale-98"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-98"
  >
    <div
      v-if="modelValue && currentHook"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/90 backdrop-blur-xl"
        @click="closeModal"
      ></div>

      <!-- Modal Content -->
      <div
        class="relative w-full max-w-5xl bg-surface-dark border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div class="absolute top-4 right-4 z-50">
          <button
            aria-label="Close modal"
            class="w-10 h-10 bg-black/50 hover:bg-black text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all border border-white/10 hover:border-white/30 cursor-pointer"
            @click="closeModal"
          >
            <Icon name="ri:close-line" class="text-xl" />
          </button>
        </div>
        <div class="flex flex-col md:flex-row h-full overflow-hidden">
          <!-- Video Player (50/50) -->
          <div
            class="md:w-1/2 bg-black relative aspect-video md:aspect-auto flex-shrink-0 flex items-center justify-center"
          >
            <video
              v-if="modalVideoUrl && !hasVideoError"
              ref="modalVideoPlayer"
              :src="modalVideoUrl"
              controls
              autoplay
              class="w-full h-full object-contain max-h-[70vh]"
              @timeupdate="onModalTimeUpdate"
              @loadedmetadata="onModalLoadedMetadata"
              @volumechange="onVolumeChange"
              @error="onVideoError"
            ></video>
            <div
              v-if="state.hasPreview.value && modalVideoUrl && !hasVideoError"
              class="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-0.5 flex items-center gap-1 select-none group/resolution"
            >
              <Icon
                name="ri:speed-line"
                class="text-[11px] text-slate-400 ml-1.5 mr-0.5"
              />

              <!-- SD Toggle Button -->
              <button
                class="px-2 py-1 text-[9px] font-black tracking-widest rounded transition-all cursor-pointer"
                :class="
                  !forceHighRes
                    ? 'bg-accent-500 text-black shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                "
                @click="toggleResolution(false)"
              >
                SD
              </button>

              <!-- HD Toggle Button -->
              <button
                class="px-2 py-1 text-[9px] font-black tracking-widest rounded transition-all mr-0.5"
                :class="[
                  state.hdReady.value
                    ? forceHighRes
                      ? 'bg-accent-500 text-black shadow-md cursor-pointer'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer'
                    : 'text-slate-500 cursor-not-allowed opacity-60'
                ]"
                @click="state.hdReady.value && toggleResolution(true)"
              >
                <span v-if="state.hdReady.value">HD</span>
                <span v-else-if="state.downloadPercent.value > 0"
                  >HD ({{ state.downloadPercent.value }}%)</span
                >
                <span v-else>HD (QUEUED)</span>
              </button>

              <!-- Custom Tooltip on Hover -->
              <div
                class="absolute top-full left-0 mt-2 w-64 bg-[#171a21] border border-surface-border text-[10px] text-slate-300 p-3 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:pointer-events-auto transition-all -translate-y-1 group-hover/resolution:translate-y-0 z-30 font-medium normal-case tracking-normal"
              >
                <h5
                  class="text-accent-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1"
                >
                  <Icon name="ri:information-line" class="text-xs" />
                  Preview Quality
                </h5>
                <p v-if="state.hdReady.value" class="leading-relaxed">
                  This toggle applies to the preview only. The timeline editor
                  always uses the original high-definition (HD) version.
                </p>
                <p v-else class="leading-relaxed">
                  The high-definition (HD) version is downloading in the
                  background. You can preview the optimized SD version in the
                  meantime.
                </p>
                <div
                  class="absolute bottom-full left-4 -mb-[5px] border-4 border-transparent border-b-[#171a21]/95"
                ></div>
              </div>
            </div>
            <div
              v-else-if="!modalVideoUrl || hasVideoError"
              class="w-full h-full flex flex-col items-center justify-center text-slate-500"
            >
              <Icon name="ri:film-line" class="text-4xl mb-2 opacity-50" />
              <p class="text-sm font-medium">Video source unavailable</p>
            </div>
          </div>

          <!-- Sidebar Info (50/50) -->
          <div
            class="md:w-1/2 p-6 md:p-8 flex flex-col border-t md:border-t-0 md:border-l border-surface-border bg-surface-panel/50 overflow-y-auto custom-scrollbar select-text relative"
          >
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-4">
                <!-- Virality Score Pill in Modal -->
                <div
                  v-if="currentHook.virality_score !== undefined"
                  class="px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider flex items-center gap-1.5 shadow-sm"
                  :class="{
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40':
                      currentHook.virality_score >= 90,
                    'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40':
                      currentHook.virality_score >= 75 &&
                      currentHook.virality_score < 90,
                    'bg-slate-700/40 text-slate-300 border border-slate-600/40':
                      currentHook.virality_score < 75
                  }"
                >
                  <Icon
                    :name="
                      currentHook.virality_score >= 90
                        ? 'ri:fire-fill'
                        : currentHook.virality_score >= 75
                          ? 'ri:flashlight-fill'
                          : 'ri:bar-chart-2-fill'
                    "
                    class="text-sm"
                  />
                  <span>VIRAL SCORE: {{ currentHook.virality_score }}/100</span>
                </div>

                <button
                  aria-label="Toggle Bookmark Hook"
                  title="Bookmark Hook"
                  class="text-slate-400 hover:text-amber-400 transition-colors ml-auto cursor-pointer"
                  @click.stop="toggleSaveHook"
                >
                  <Icon
                    :name="isSaved ? 'ri:bookmark-fill' : 'ri:bookmark-line'"
                    class="text-xl"
                    :class="{
                      'text-amber-400': isSaved
                    }"
                  />
                </button>
              </div>

              <p
                v-if="videoTitle"
                class="text-xs text-slate-400 font-medium mb-1 truncate"
              >
                {{ videoTitle }}
              </p>

              <h3
                class="text-xl md:text-2xl font-bold text-white mb-3 leading-tight"
              >
                {{ currentHook.theme || 'Untitled Hook' }}
              </h3>

              <div class="flex flex-wrap items-center gap-2 mb-4">
                <div
                  class="flex items-center gap-2 bg-surface-dark border border-surface-border/50 px-3 py-2 rounded-lg w-max"
                >
                  <Icon name="ri:time-line" class="text-slate-400" />
                  <span class="text-slate-300 font-mono text-xs"
                    >{{
                      state.formatDuration(
                        Math.max(
                          0,
                          currentHook.start - state.startSafetyBuffer.value
                        )
                      )
                    }}
                    - {{ state.formatDuration(currentHook.end) }}</span
                  >
                  <span class="text-accent-500 font-bold ml-1 text-xs">{{
                    formatHookDuration(
                      Math.max(
                        0,
                        currentHook.start - state.startSafetyBuffer.value
                      ),
                      currentHook.end
                    )
                  }}</span>
                </div>

                <button
                  ref="timingTriggerBtnRef"
                  class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-dark hover:bg-surface-panel border border-surface-border hover:border-accent-500/50 text-slate-300 hover:text-accent-500 text-xs font-bold transition-all cursor-pointer select-none"
                  :class="{
                    'border-accent-500/50 text-accent-500 bg-surface-panel':
                      showAdjustDuration
                  }"
                  @click="showAdjustDuration = !showAdjustDuration"
                >
                  <Icon name="ri:settings-4-line" />
                  Adjust Start - End
                  <Icon
                    name="ri:arrow-down-s-line"
                    class="text-xs transition-transform duration-200"
                    :class="{ 'rotate-180': showAdjustDuration }"
                  />
                </button>
              </div>

              <!-- Floating Timing Adjustment Panel Overlay -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="transform -translate-y-2 opacity-0 scale-95"
                enter-to-class="transform translate-y-0 opacity-100 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="transform translate-y-0 opacity-100 scale-100"
                leave-to-class="transform -translate-y-2 opacity-0 scale-95"
              >
                <div
                  v-if="showAdjustDuration"
                  ref="timingPanelRef"
                  class="absolute left-6 right-6 md:left-8 md:right-8 top-[148px] z-40 bg-[#141822] backdrop-blur-2xl border border-surface-border rounded-2xl p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span
                      class="text-[10px] font-black tracking-widest text-slate-400 uppercase"
                      >Adjust Clip Timing</span
                    >
                    <button
                      v-if="
                        currentHook &&
                        (currentHook.start !== currentHook.originalStart ||
                          currentHook.end !== currentHook.originalEnd)
                      "
                      class="text-[9px] text-accent-500 hover:text-accent-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer"
                      @click="resetToDefaultDuration"
                    >
                      <Icon name="ri:restart-line" />
                      Reset to Default
                    </button>
                    <span v-else class="text-[9px] text-slate-500 font-mono"
                      >Total Video:
                      {{
                        state.formatDuration(state.videoDuration.value || 0)
                      }}</span
                    >
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1"
                        >Start Time</label
                      >
                      <div class="relative flex items-center">
                        <input
                          v-model="startInputStr"
                          type="text"
                          placeholder="mm:ss"
                          class="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                          @change="onTimeInputChange('start')"
                          @keydown.up.prevent="onTimeInputStep('start', 1)"
                          @keydown.down.prevent="onTimeInputStep('start', -1)"
                        />
                        <span
                          class="absolute right-3 text-[10px] text-slate-500 font-bold"
                          >mm:ss</span
                        >
                      </div>
                      <span
                        class="text-[10px] text-slate-500 block mt-1 font-mono"
                        >{{
                          Math.max(
                            0,
                            currentHook.start - state.startSafetyBuffer.value
                          ).toFixed(1)
                        }}s</span
                      >
                    </div>
                    <div>
                      <label
                        class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1"
                        >End Time</label
                      >
                      <div class="relative flex items-center">
                        <input
                          v-model="endInputStr"
                          type="text"
                          placeholder="mm:ss"
                          class="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                          @change="onTimeInputChange('end')"
                          @keydown.up.prevent="onTimeInputStep('end', 1)"
                          @keydown.down.prevent="onTimeInputStep('end', -1)"
                        />
                        <span
                          class="absolute right-3 text-[10px] text-slate-500 font-bold"
                          >mm:ss</span
                        >
                      </div>
                      <span
                        class="text-[10px] text-slate-500 block mt-1 font-mono"
                        >{{ currentHook.end.toFixed(1) }}s</span
                      >
                    </div>
                  </div>

                  <!-- Two-Tier Hook Timing Slider -->
                  <TwoTierTimingSlider
                    ref="timingSliderRef"
                    :start="
                      Math.max(
                        0,
                        currentHook.start - state.startSafetyBuffer.value
                      )
                    "
                    :end="currentHook.end"
                    :video-duration="state.videoDuration.value || 0"
                    :current-time="modalCurrentTime"
                    @update:start="onSliderUpdateStart"
                    @update:end="onSliderUpdateEnd"
                    @seek="onSliderSeek"
                    @drag-end="onSliderDragEnd"
                  />

                  <div class="flex justify-end pt-1">
                    <button
                      class="px-3 py-1.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-accent-400 transition-colors cursor-pointer"
                      @click="showAdjustDuration = false"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </Transition>

              <!-- Tabbed Switcher (Virality Breakdown [Tab 1 Default] vs Transcript Quote [Tab 2]) -->
              <div
                class="flex items-center p-1 bg-surface-dark/90 border border-surface-border/60 rounded-xl mb-4 select-none"
              >
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                  :class="
                    activeModalTab === 'breakdown'
                      ? 'bg-surface-panel text-accent-500 shadow-sm border border-surface-border'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  "
                  @click="
                    e => {
                      activeModalTab = 'breakdown';
                      (e.currentTarget as HTMLElement)?.blur();
                    }
                  "
                >
                  <Icon name="ri:sparkling-fill" class="text-xs" />
                  <span>Virality Breakdown</span>
                </button>
                <button
                  class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                  :class="
                    activeModalTab === 'transcript'
                      ? 'bg-surface-panel text-accent-500 shadow-sm border border-surface-border'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                  "
                  @click="
                    e => {
                      activeModalTab = 'transcript';
                      (e.currentTarget as HTMLElement)?.blur();
                    }
                  "
                >
                  <Icon name="ri:chat-quote-line" class="text-xs" />
                  <span>Transcript Quote</span>
                </button>
              </div>

              <!-- Tab 1: Virality Breakdown (Default) -->
              <div
                v-if="activeModalTab === 'breakdown'"
                class="animate-in fade-in duration-200"
              >
                <div
                  v-if="currentHook.virality_reason"
                  class="h-[210px] p-5 bg-black/40 border border-surface-border/80 rounded-xl text-left shadow-lg relative overflow-hidden group flex flex-col"
                >
                  <div
                    class="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"
                  >
                    <Icon
                      name="ri:sparkling-fill"
                      class="text-9xl text-accent-500"
                    />
                  </div>
                  <div
                    class="text-[10px] font-black text-accent-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 shrink-0"
                  >
                    <Icon name="ri:sparkling-fill" class="text-xs" />
                    Virality Analysis
                  </div>
                  <div
                    class="flex-1 overflow-y-auto custom-scrollbar relative z-10 pr-1"
                  >
                    <p
                      class="text-xs md:text-sm text-slate-200 leading-relaxed font-normal"
                    >
                      {{ currentHook.virality_reason }}
                    </p>
                  </div>
                </div>
                <div
                  v-else
                  class="h-[210px] p-6 bg-black/20 border border-surface-border rounded-xl flex items-center justify-center text-center text-slate-500 text-xs"
                >
                  No virality breakdown available for this hook.
                </div>
              </div>

              <!-- Tab 2: Transcript Quote -->
              <div
                v-else-if="activeModalTab === 'transcript'"
                class="animate-in fade-in duration-200"
              >
                <div
                  class="h-[210px] p-5 bg-black/40 border border-surface-border/80 rounded-xl relative group overflow-hidden text-left flex flex-col"
                >
                  <Icon
                    name="ri:quote-text"
                    class="absolute -top-2 -right-2 text-6xl text-surface-border opacity-20 group-hover:text-accent-500/10 transition-colors pointer-events-none"
                  />
                  <div
                    class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 shrink-0"
                  >
                    <Icon name="ri:mic-line" class="text-xs text-slate-400" />
                    Spoken Dialog
                  </div>
                  <div
                    class="flex-1 overflow-y-auto custom-scrollbar relative z-10 pr-1"
                  >
                    <p
                      class="text-slate-200 text-sm italic leading-relaxed font-serif"
                    >
                      "{{
                        currentHook.transcript_quote ||
                        'No transcript quote available for this hook.'
                      }}"
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8 pt-6 border-t border-surface-border/50">
              <button
                class="w-full py-4 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(255,215,0,0.2)] hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                @click="handleGoToEditor"
              >
                <Icon name="ri:scissors-cut-fill" class="text-xl" />
                Go to Editor
              </button>
              <p
                class="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-bold"
              >
                Opens Subtitle Editor
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { Hook, ReadyClip } from '../../types/clipper';
import TwoTierTimingSlider from './TwoTierTimingSlider.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    hook: Hook | null;
    videoUrl?: string | null;
    videoTitle?: string;
    readyClips?: ReadyClip[];
    folderName?: string | null;
    showAdjustDuration?: boolean;
  }>(),
  {
    videoUrl: null,
    videoTitle: '',
    readyClips: () => [],
    folderName: null,
    showAdjustDuration: undefined
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'update:showAdjustDuration', val: boolean): void;
  (e: 'openInEditor', hook: Hook): void;
  (e: 'saveHook', hook: Hook): void;
  (e: 'removeSavedHook', hook: Hook): void;
}>();

const state = useClipperState();
const API_BASE = resolveApiBase();

const currentHook = ref<Hook | null>(props.hook);
const modalVideoPlayer = ref<HTMLVideoElement | null>(null);
const forceHighRes = ref(state.hdReady.value);
const isTogglingResolution = ref(false);
const savedPlaybackTime = ref<number | null>(null);
const hasVideoError = ref(false);

const timingSliderRef = ref<InstanceType<typeof TwoTierTimingSlider> | null>(
  null
);
const modalCurrentTime = ref(0);
const showAdjustDuration = ref(props.showAdjustDuration ?? false);
const timingPanelRef = ref<HTMLElement | null>(null);
const timingTriggerBtnRef = ref<HTMLElement | null>(null);
const isPreviewingDelta = ref(false);
const startInputStr = ref('00:00');
const endInputStr = ref('00:00');
const activeModalTab = ref<'breakdown' | 'transcript'>('breakdown');

watch(
  () => props.showAdjustDuration,
  val => {
    if (val !== undefined && val !== showAdjustDuration.value) {
      showAdjustDuration.value = val;
    }
  }
);

watch(showAdjustDuration, val => {
  emit('update:showAdjustDuration', val);
});

const modalVideoUrl = computed(() => {
  if (forceHighRes.value && state.hdReady.value && state.videoUrl.value) {
    return state.videoUrl.value;
  }
  if (props.videoUrl) {
    return props.videoUrl;
  }
  if (
    !forceHighRes.value &&
    state.videoUrl.value &&
    state.videoUrl.value.endsWith('/full.mp4') &&
    state.hasPreview.value
  ) {
    return state.videoUrl.value.replace('/full.mp4', '/preview.mp4');
  }
  const folder = props.folderName ?? state.folderName.value;
  if (folder) {
    const filename =
      forceHighRes.value && state.hdReady.value
        ? 'full.mp4'
        : state.hasPreview.value
          ? 'preview.mp4'
          : 'full.mp4';
    return `${API_BASE}/assets/sources/${folder}/${filename}`;
  }
  if (state.videoUrl.value) {
    return state.videoUrl.value;
  }
  return null;
});

function safePlayVideo() {
  if (!modalVideoPlayer.value) return;
  try {
    const p = modalVideoPlayer.value.play?.();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  } catch {
    // Ignore autoplay restriction or unmounted element
  }
}

function safeSetCurrentTime(time: number) {
  if (!modalVideoPlayer.value) return;
  try {
    modalVideoPlayer.value.currentTime = time;
  } catch {
    // Ignore happy-dom or unready video element errors
  }
}

const isSaved = computed(() => {
  if (!currentHook.value) return false;
  return state.savedHooks.value.some(
    (h: Hook) =>
      Math.abs(h.start - currentHook.value!.start) < 0.1 &&
      Math.abs(h.end - currentHook.value!.end) < 0.1
  );
});

// Backward compatibility & delegation for TwoTierTimingSlider
const modalHookSliderRef = computed(
  () => timingSliderRef.value?.modalHookSliderRef ?? null
);
const dragMode = computed(() => timingSliderRef.value?.dragMode ?? null);
const dragInitialStart = computed(
  () => timingSliderRef.value?.dragInitialStart ?? 0
);
const dragInitialEnd = computed(
  () => timingSliderRef.value?.dragInitialEnd ?? 0
);
const microWindowStart = computed({
  get: () => timingSliderRef.value?.microWindowStart ?? 0,
  set: v => {
    if (timingSliderRef.value) timingSliderRef.value.microWindowStart = v;
  }
});
const microWindowEnd = computed({
  get: () => timingSliderRef.value?.microWindowEnd ?? 100,
  set: v => {
    if (timingSliderRef.value) timingSliderRef.value.microWindowEnd = v;
  }
});
const edgeScrollDirection = computed(
  () => timingSliderRef.value?.edgeScrollDirection ?? 0
);

function updateMicroWindow(start: number, end: number, padding = 30) {
  timingSliderRef.value?.updateMicroWindow?.(start, end, padding);
}

function startDrag(
  mode: 'start' | 'end',
  initialStart?: number,
  initialEnd?: number
) {
  timingSliderRef.value?.startDrag?.(mode, initialStart, initialEnd);
}

function stopDragging() {
  timingSliderRef.value?.stopDragging?.();
}

function stepEdgeAutoScroll(timestamp: number) {
  timingSliderRef.value?.stepEdgeAutoScroll?.(timestamp);
}

function onSliderUpdateStart(newStart: number) {
  if (!currentHook.value) return;
  currentHook.value.start = parseFloat(
    (newStart + state.startSafetyBuffer.value).toFixed(1)
  );
  startInputStr.value = formatMMSS(newStart);
}

function onSliderUpdateEnd(newEnd: number) {
  if (!currentHook.value) return;
  currentHook.value.end = parseFloat(newEnd.toFixed(1));
  endInputStr.value = formatMMSS(newEnd);
}

function onSliderSeek(time: number) {
  safeSetCurrentTime(time);
  modalCurrentTime.value = time;
}

function onSliderDragEnd(payload: {
  mode: 'start' | 'end';
  initialStart: number;
  initialEnd: number;
  start: number;
  end: number;
}) {
  const currentEnd = currentHook.value?.end ?? payload.end;
  const effectiveStart = currentHook.value
    ? Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
    : payload.start;
  const initialEnd = payload.initialEnd;

  if (payload.mode === 'end') {
    if (modalVideoPlayer.value) {
      if (currentEnd > initialEnd) {
        isPreviewingDelta.value = true;
        safeSetCurrentTime(initialEnd);
        safePlayVideo();
      } else if (currentEnd < initialEnd) {
        isPreviewingDelta.value = true;
        safeSetCurrentTime(Math.max(effectiveStart, currentEnd - 3));
        safePlayVideo();
      } else {
        safeSetCurrentTime(effectiveStart);
        safePlayVideo();
      }
    }
  } else if (payload.mode === 'start') {
    if (modalVideoPlayer.value) {
      safeSetCurrentTime(effectiveStart);
      safePlayVideo();
    }
  }
}

function onVideoError() {
  hasVideoError.value = true;
}

function formatHookDuration(start: number, end: number) {
  const diff = Math.abs(end - start);
  if (diff < 60) return `(${Math.floor(diff)}s)`;
  const m = Math.floor(diff / 60);
  const s = Math.floor(diff % 60);
  if (s === 0) return `(${m}m)`;
  return `(${m}m ${s}s)`;
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseMMSS(str: string): number | null {
  const parts = str.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0] || '0', 10);
    const s = parseInt(parts[1] || '0', 10);
    if (!isNaN(m) && !isNaN(s)) {
      return m * 60 + s;
    }
  }
  const val = parseFloat(str);
  if (!isNaN(val)) return val;
  return null;
}

function toggleSaveHook() {
  if (!currentHook.value) return;
  if (isSaved.value) {
    emit('removeSavedHook', currentHook.value);
  } else {
    emit('saveHook', currentHook.value);
  }
}

function toggleResolution(highRes: boolean) {
  if (forceHighRes.value === highRes) return;
  hasVideoError.value = false;

  if (modalVideoPlayer.value) {
    savedPlaybackTime.value = modalVideoPlayer.value.currentTime;
    isTogglingResolution.value = true;
  }
  forceHighRes.value = highRes;
}

function onModalLoadedMetadata(e: Event) {
  const videoEl = e.target as HTMLVideoElement;
  if (isTogglingResolution.value && savedPlaybackTime.value !== null) {
    videoEl.currentTime = savedPlaybackTime.value;
    isTogglingResolution.value = false;
    savedPlaybackTime.value = null;
  } else if (currentHook.value) {
    videoEl.currentTime = Math.max(
      0,
      currentHook.value.start - state.startSafetyBuffer.value
    );
  }
  modalCurrentTime.value = videoEl.currentTime;
  restoreModalVolume(videoEl);
}

function restoreModalVolume(el: HTMLVideoElement | null) {
  if (!el) return;
  if (typeof localStorage !== 'undefined') {
    const savedVolume = localStorage.getItem('yonru_preview_volume');
    const savedMuted = localStorage.getItem('yonru_preview_muted');
    if (savedVolume !== null) {
      el.volume = parseFloat(savedVolume);
    }
    if (savedMuted !== null) {
      el.muted = savedMuted === 'true';
    }
  }
}

function onVolumeChange() {
  const el = modalVideoPlayer.value;
  if (el && typeof localStorage !== 'undefined') {
    localStorage.setItem('yonru_preview_volume', el.volume.toString());
    localStorage.setItem('yonru_preview_muted', el.muted.toString());
  }
}

function resetToDefaultDuration() {
  if (
    currentHook.value &&
    currentHook.value.originalStart !== undefined &&
    currentHook.value.originalEnd !== undefined
  ) {
    currentHook.value.start = currentHook.value.originalStart;
    currentHook.value.end = currentHook.value.originalEnd;
    const effectiveStart = Math.max(
      0,
      currentHook.value.start - state.startSafetyBuffer.value
    );
    startInputStr.value = formatMMSS(effectiveStart);
    endInputStr.value = formatMMSS(currentHook.value.end);
    updateMicroWindow(effectiveStart, currentHook.value.end);
    if (modalVideoPlayer.value) {
      safeSetCurrentTime(effectiveStart);
      safePlayVideo();
    }
  }
}

function onTimeInputChange(mode: 'start' | 'end') {
  if (!currentHook.value) return;

  const str = mode === 'start' ? startInputStr.value : endInputStr.value;
  const parsed = parseMMSS(str);

  if (parsed === null) {
    if (mode === 'start') {
      startInputStr.value = formatMMSS(
        Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
      );
    } else {
      endInputStr.value = formatMMSS(currentHook.value.end);
    }
    return;
  }

  const total = state.videoDuration.value || 3600;
  if (mode === 'start') {
    let newStart = Math.max(0, parsed);
    if (newStart > currentHook.value.end - 1.0) {
      newStart = currentHook.value.end - 1.0;
    }
    currentHook.value.start = parseFloat(
      (newStart + state.startSafetyBuffer.value).toFixed(1)
    );
    startInputStr.value = formatMMSS(
      Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
    );
    updateMicroWindow(
      currentHook.value.start - state.startSafetyBuffer.value,
      currentHook.value.end
    );
    if (modalVideoPlayer.value) {
      safeSetCurrentTime(
        Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
      );
      safePlayVideo();
    }
  } else {
    const oldEnd = currentHook.value.end;
    let newEnd = Math.min(total, parsed);
    const effectiveStart = Math.max(
      0,
      currentHook.value.start - state.startSafetyBuffer.value
    );
    if (newEnd < effectiveStart + 1.0) {
      newEnd = effectiveStart + 1.0;
    }
    currentHook.value.end = parseFloat(newEnd.toFixed(1));
    endInputStr.value = formatMMSS(currentHook.value.end);
    updateMicroWindow(effectiveStart, currentHook.value.end);
    if (modalVideoPlayer.value) {
      if (currentHook.value.end > oldEnd) {
        isPreviewingDelta.value = true;
        safeSetCurrentTime(oldEnd);
        safePlayVideo();
      } else if (currentHook.value.end < oldEnd) {
        isPreviewingDelta.value = true;
        safeSetCurrentTime(Math.max(effectiveStart, currentHook.value.end - 3));
        safePlayVideo();
      } else {
        safeSetCurrentTime(effectiveStart);
        safePlayVideo();
      }
    }
  }
}

function onTimeInputStep(mode: 'start' | 'end', delta: number) {
  if (!currentHook.value) return;

  const currentVal =
    mode === 'start'
      ? Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
      : currentHook.value.end;

  const newVal = currentVal + delta;
  const total = state.videoDuration.value || 3600;
  if (mode === 'start') {
    let newStart = Math.max(0, newVal);
    if (newStart > currentHook.value.end - 1.0) {
      newStart = currentHook.value.end - 1.0;
    }
    currentHook.value.start = parseFloat(
      (newStart + state.startSafetyBuffer.value).toFixed(1)
    );
    startInputStr.value = formatMMSS(
      Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
    );
    updateMicroWindow(
      currentHook.value.start - state.startSafetyBuffer.value,
      currentHook.value.end
    );
    if (modalVideoPlayer.value) {
      safeSetCurrentTime(
        Math.max(0, currentHook.value.start - state.startSafetyBuffer.value)
      );
      safePlayVideo();
    }
  } else {
    const oldEnd = currentHook.value.end;
    let newEnd = Math.min(total, newVal);
    const effectiveStart = Math.max(
      0,
      currentHook.value.start - state.startSafetyBuffer.value
    );
    if (newEnd < effectiveStart + 1.0) {
      newEnd = effectiveStart + 1.0;
    }
    currentHook.value.end = parseFloat(newEnd.toFixed(1));
    endInputStr.value = formatMMSS(currentHook.value.end);
    updateMicroWindow(effectiveStart, currentHook.value.end);
    if (modalVideoPlayer.value) {
      if (currentHook.value.end > oldEnd) {
        isPreviewingDelta.value = true;
        safeSetCurrentTime(oldEnd);
        safePlayVideo();
      } else if (currentHook.value.end < oldEnd) {
        isPreviewingDelta.value = true;
        safeSetCurrentTime(Math.max(effectiveStart, currentHook.value.end - 3));
        safePlayVideo();
      } else {
        safeSetCurrentTime(effectiveStart);
        safePlayVideo();
      }
    }
  }
}

function onModalTimeUpdate(e: Event) {
  if (!currentHook.value) return;
  const player = e.target as HTMLVideoElement;
  modalCurrentTime.value = player.currentTime;
  if (dragMode.value) return;

  const effectiveStart = Math.max(
    0,
    currentHook.value.start - state.startSafetyBuffer.value
  );
  const currentEnd = currentHook.value.end;

  if (player.currentTime >= currentEnd) {
    if (isPreviewingDelta.value) {
      isPreviewingDelta.value = false;
    }
    player.currentTime = effectiveStart;
  }
}

function closeModal() {
  emit('update:modelValue', false);
}

function handleGoToEditor() {
  if (currentHook.value) {
    emit('openInEditor', currentHook.value);
    closeModal();
  }
}

function handleClickOutsideTiming(e: MouseEvent) {
  if (!showAdjustDuration.value || dragMode.value) return;
  const target = e.target as Node;
  if (
    timingPanelRef.value &&
    !timingPanelRef.value.contains(target) &&
    timingTriggerBtnRef.value &&
    !timingTriggerBtnRef.value.contains(target)
  ) {
    showAdjustDuration.value = false;
  }
}

watch(
  () => props.hook,
  newHook => {
    currentHook.value = newHook;
    hasVideoError.value = false;
    if (newHook) {
      if (newHook.originalStart === undefined) {
        newHook.originalStart = newHook.start;
      }
      if (newHook.originalEnd === undefined) {
        newHook.originalEnd = newHook.end;
      }
      const effectiveStart = Math.max(
        0,
        newHook.start - state.startSafetyBuffer.value
      );
      startInputStr.value = formatMMSS(effectiveStart);
      endInputStr.value = formatMMSS(newHook.end);
      updateMicroWindow(effectiveStart, newHook.end);
      activeModalTab.value = 'breakdown';
      forceHighRes.value = state.hdReady.value;
      isTogglingResolution.value = false;
      savedPlaybackTime.value = null;
      isPreviewingDelta.value = false;
    } else {
      showAdjustDuration.value = false;
      activeModalTab.value = 'breakdown';
      forceHighRes.value = state.hdReady.value;
      isTogglingResolution.value = false;
      savedPlaybackTime.value = null;
      isPreviewingDelta.value = false;
    }
  },
  { immediate: true }
);

watch(showAdjustDuration, val => {
  if (val && currentHook.value) {
    updateMicroWindow(
      currentHook.value.start - state.startSafetyBuffer.value,
      currentHook.value.end
    );
  }
});

watch(modalVideoPlayer, el => {
  if (el) {
    restoreModalVolume(el);
  }
});

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', handleClickOutsideTiming);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousedown', handleClickOutsideTiming);
  }
});

defineExpose({
  modalHookSliderRef,
  dragMode,
  dragInitialStart,
  dragInitialEnd,
  microWindowStart,
  microWindowEnd,
  edgeScrollDirection,
  startDrag,
  stopDragging,
  stepEdgeAutoScroll,
  updateMicroWindow,
  currentHook,
  showAdjustDuration,
  modalVideoPlayer,
  startInputStr,
  endInputStr,
  isPreviewingDelta,
  onModalTimeUpdate,
  activeModalTab,
  forceHighRes,
  modalVideoUrl,
  hasVideoError,
  modalCurrentTime,
  toggleResolution,
  toggleSaveHook,
  resetToDefaultDuration,
  restoreModalVolume,
  onTimeInputChange,
  onTimeInputStep
});
</script>
