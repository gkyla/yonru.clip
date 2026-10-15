<template>
  <div
    id="hooks-header"
    class="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full p-8 -mt-8"
  >
    <div class="flex flex-col mb-6">
      <div
        class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4"
      >
        <div class="flex flex-col gap-2 shrink-0">
          <h3
            class="text-xl font-bold text-white tracking-tight flex items-center gap-2"
          >
            <Icon name="ri:fire-fill" class="text-accent-500" />
            <span>Generated Hooks</span>
            <!-- HD Caching Badge -->
            <Transition name="scale-fade">
              <span
                v-if="!state.hdReady.value && state.downloadPercent.value < 100"
                class="inline-flex items-center gap-1.5 px-2 border border-accent-500/20 bg-accent-500/[0.05] rounded-none text-[9px] font-black uppercase tracking-wider text-accent-500 animate-pulse"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full bg-accent-500 animate-ping"
                ></span>
                Caching HD Source... {{ state.downloadPercent.value }}%
              </span>
              <span
                v-else-if="
                  state.hdReady.value || state.downloadPercent.value === 100
                "
                class="inline-flex items-center gap-1.5 px-2 border border-emerald-500/20 bg-emerald-500/[0.05] rounded-none text-[9px] font-black uppercase tracking-wider text-emerald-400"
              >
                <Icon name="ri:checkbox-circle-fill" class="text-[10px]" />
                HD Ready
              </span>
            </Transition>
          </h3>
          <p class="text-slate-400 text-xs">
            Select a hook to cut the segment and start editing.
          </p>
        </div>
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto"
        >
          <!-- Tab Switcher -->
          <div
            class="flex items-center bg-surface-dark border border-surface-border p-1 rounded-none shrink-0 h-9 select-none"
          >
            <button
              class="px-3 rounded-none transition-colors duration-150 cursor-pointer h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider focus:outline-none focus-visible:outline-none focus:ring-0"
              :class="
                activeTab === 'generated'
                  ? 'bg-surface-panel text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              "
              @click="activeTab = 'generated'"
            >
              All Hooks ({{ state.hooks.value.length }})
            </button>
            <button
              class="px-3 rounded-none transition-colors duration-150 cursor-pointer h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider focus:outline-none focus-visible:outline-none focus:ring-0"
              :class="
                activeTab === 'saved'
                  ? 'bg-surface-panel text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              "
              @click="activeTab = 'saved'"
            >
              Saved Hooks ({{ state.savedHooks.value.length }})
            </button>
          </div>

          <!-- Back to Library Button -->
          <button
            class="h-9 px-4 bg-surface-dark border border-surface-border rounded-none cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-accent-500 hover:border-accent-500 transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none focus-visible:outline-none focus:ring-0"
            @click="$emit('back-to-library')"
          >
            <Icon name="ri:arrow-left-line" class="text-sm" />
            <span>Back to Library</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Unified Hooks Grid -->
    <Transition name="fade-layout" mode="out-in">
      <div
        :key="activeTab"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <!-- Empty State -->
        <div
          v-if="displayedHooks.length === 0"
          class="col-span-full py-12 bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8"
        >
          <div
            class="w-12 h-12 bg-surface-dark border border-surface-border/50 flex items-center justify-center mb-4 text-slate-500 rounded-xl"
          >
            <Icon
              :name="
                activeTab === 'saved' ? 'ri:bookmark-line' : 'ri:fire-line'
              "
              class="text-2xl"
              :class="
                activeTab === 'saved' ? 'text-amber-400/60' : 'text-slate-500'
              "
            />
          </div>
          <h4
            class="text-white font-bold text-xs mb-1 uppercase tracking-wider"
          >
            {{
              activeTab === 'saved'
                ? 'No Saved Hooks Yet'
                : 'No Hooks Extracted'
            }}
          </h4>
          <p
            class="text-slate-400 text-xs max-w-sm normal-case tracking-normal"
          >
            {{
              activeTab === 'saved'
                ? 'Click the bookmark icon on any generated hook to save it here for editing later.'
                : "We couldn't extract any segments from this video. Try adjusting the prompt template or using another URL."
            }}
          </p>
        </div>

        <!-- Consolidated Hook Cards -->
        <div
          v-for="(hook, idx) in displayedHooks"
          :key="hook._id || idx"
          class="bg-surface-panel border border-surface-border rounded-2xl cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col overflow-visible hover:z-30"
          :class="
            activeTab === 'saved'
              ? 'hover:border-amber-400/50'
              : 'hover:border-accent-500/50'
          "
          @click="onHookCardClick(hook)"
          @mouseenter="
            hoveredHookIndex =
              activeTab === 'saved' ? Number(idx) + 1000 : Number(idx)
          "
          @mouseleave="hoveredHookIndex = null"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl z-0"
            :class="
              activeTab === 'saved'
                ? 'from-amber-400/0 to-amber-400/5'
                : 'from-accent-500/0 to-accent-500/5'
            "
          ></div>

          <!-- Video Preview Area -->
          <div
            class="w-full aspect-video bg-black relative rounded-t-2xl shrink-0 border-b border-surface-border z-10"
          >
            <div
              class="absolute inset-0 overflow-hidden rounded-t-2xl"
              style="
                backface-visibility: hidden;
                transform: translate3d(0, 0, 0);
                -webkit-backface-visibility: hidden;
                -webkit-transform: translate3d(0, 0, 0);
              "
            >
              <Icon
                name="ri:film-line"
                class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity"
              />
              <img
                v-if="hook.thumbnail_url"
                :src="API_BASE + hook.thumbnail_url"
                class="absolute inset-0 w-full h-full object-cover z-10 select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                alt="Hook thumbnail"
              />
              <video
                v-else-if="cardPreviewVideoUrl"
                :src="
                  cardPreviewVideoUrl +
                  '#t=' +
                  Math.max(0, hook.start - state.startSafetyBuffer.value)
                "
                muted
                preload="metadata"
                class="absolute inset-0 w-full h-full object-cover z-10 focus:outline-none select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                style="
                  backface-visibility: hidden;
                  transform: translate3d(0, 0, 0);
                  -webkit-backface-visibility: hidden;
                  -webkit-transform: translate3d(0, 0, 0);
                "
                @mouseenter="
                  e => {
                    const p = (e.target as HTMLVideoElement).play();
                    if (p !== undefined) p.catch(() => {});
                  }
                "
                @mouseleave="
                  e => {
                    (e.target as HTMLVideoElement).pause();
                    (e.target as HTMLVideoElement).currentTime = Math.max(
                      0,
                      hook.start - state.startSafetyBuffer.value
                    );
                  }
                "
                @timeupdate="
                  e => {
                    if (
                      selectedModalHook === null &&
                      (e.target as HTMLVideoElement).currentTime >= hook.end
                    )
                      (e.target as HTMLVideoElement).currentTime = Math.max(
                        0,
                        hook.start - state.startSafetyBuffer.value
                      );
                  }
                "
              ></video>

              <!-- Play Icon Overlay on Hover -->
              <div
                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none"
              >
                <div
                  class="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform"
                  :class="
                    activeTab === 'saved' ? 'text-amber-400' : 'text-accent-500'
                  "
                >
                  <Icon
                    name="ri:play-circle-fill"
                    class="text-3xl"
                    :class="
                      activeTab === 'saved'
                        ? 'text-amber-400'
                        : 'text-accent-500'
                    "
                  />
                </div>
              </div>
            </div>

            <!-- Top-Left Media Badge (Unified Hook Score Pill) -->
            <div
              class="absolute top-2.5 left-2.5 z-40 flex items-center gap-1.5 pointer-events-auto"
            >
              <div
                class="flex items-center bg-black border border-white/10 rounded-lg p-0.5 shadow-lg select-none"
              >
                <span
                  class="px-2 py-0.5 text-[9px] font-mono font-black tracking-widest"
                  :class="
                    activeTab === 'saved' ? 'text-amber-400' : 'text-accent-500'
                  "
                >
                  {{
                    (activeTab === 'saved' ? 'SAVED ' : 'HOOK ') +
                    String(Number(idx) + 1).padStart(2, '0')
                  }}
                </span>

                <!-- Virality Score Sub-Pill -->
                <div
                  v-if="hook.virality_score !== undefined"
                  class="relative group/viral flex items-center"
                >
                  <div
                    class="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider flex items-center gap-1 cursor-help transition-all"
                    :class="{
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]':
                        hook.virality_score >= 90,
                      'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]':
                        hook.virality_score >= 75 && hook.virality_score < 90,
                      'bg-slate-700/50 text-slate-300 border border-slate-600/40':
                        hook.virality_score < 75
                    }"
                  >
                    <Icon
                      :name="
                        hook.virality_score >= 90
                          ? 'ri:fire-fill'
                          : hook.virality_score >= 75
                            ? 'ri:flashlight-fill'
                            : 'ri:bar-chart-2-fill'
                      "
                      class="text-[10px]"
                    />
                    <span>{{ hook.virality_score }}</span>
                  </div>

                  <!-- Virality Explanation Tooltip -->
                  <div
                    v-if="hook.virality_reason"
                    class="absolute top-full left-0 mt-2 w-72 bg-[#171a21] border border-surface-border text-[11px] text-slate-200 p-3.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 pointer-events-none group-hover/viral:opacity-100 group-hover/viral:pointer-events-auto transition-all duration-200 -translate-y-1 group-hover/viral:translate-y-0 z-50 font-medium normal-case tracking-normal text-left"
                  >
                    <div
                      class="absolute bottom-full left-4 -mb-[1px] border-4 border-transparent border-b-[#171a21]"
                    ></div>
                    <div
                      class="text-[10px] font-bold text-accent-500 uppercase tracking-widest mb-1 flex items-center gap-1"
                    >
                      <Icon name="ri:sparkling-fill" class="text-xs" />
                      Virality Breakdown ({{ hook.virality_score }}/100)
                    </div>
                    <div class="text-slate-300 leading-snug">
                      {{ hook.virality_reason }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top-Right Media Badge (Ready Indicator & Bookmark Action) -->
            <div
              class="absolute top-2.5 right-2.5 z-40 flex items-center gap-2 pointer-events-auto"
            >
              <!-- Ambient Ready Indicator -->
              <div
                v-if="isHookRendered(hook)"
                class="relative group/tooltip flex items-center"
              >
                <div
                  class="px-2 py-1 bg-black border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-help shadow-lg"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  ></span>
                  <span>Ready</span>
                </div>
                <div
                  class="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-emerald-500/30 text-[10px] text-slate-200 p-2.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all -translate-y-1 group-hover/tooltip:translate-y-0 z-50 font-medium normal-case tracking-normal text-center"
                >
                  <div
                    class="absolute bottom-full right-4 -mb-[1px] border-4 border-transparent border-b-slate-900"
                  ></div>
                  This clip has already been cut and transcribed, ready for
                  editing!
                </div>
              </div>

              <!-- Bookmark Toggle Button -->
              <button
                aria-label="Bookmark Hook"
                class="w-7 h-7 rounded-lg bg-black border border-white/10 hover:border-amber-400/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                :class="
                  isHookSaved(hook)
                    ? 'text-amber-400 border-amber-400/30'
                    : 'text-slate-400 hover:text-amber-300'
                "
                @click.stop="toggleSaveHook(hook)"
              >
                <Icon
                  :name="
                    isHookSaved(hook) ? 'ri:bookmark-fill' : 'ri:bookmark-line'
                  "
                  class="text-sm"
                />
              </button>
            </div>

            <!-- Bottom-Right Duration Badge -->
            <div
              class="absolute bottom-2.5 right-2.5 bg-black px-2 py-0.5 rounded-md text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10 shadow-lg"
            >
              {{ formatHookDuration(hook.start, hook.end) }}
            </div>
          </div>

          <!-- Streamlined Editorial Card Body -->
          <div class="p-4 flex-1 flex flex-col relative z-10">
            <h4
              class="text-white font-bold mb-2 text-base leading-snug transition-colors line-clamp-2 min-h-[2.75rem] cursor-text select-text"
              :class="
                activeTab === 'saved'
                  ? 'group-hover:text-amber-400'
                  : 'group-hover:text-accent-500'
              "
            >
              {{ hook.theme || 'Untitled Hook' }}
            </h4>

            <div class="py-0.5 my-1 transition-colors flex-1">
              <p
                class="text-slate-400 text-xs line-clamp-2 italic leading-relaxed cursor-text select-text"
              >
                "{{
                  hook.transcript_quote ||
                  'No transcript quote available for this hook.'
                }}"
              </p>
            </div>

            <div
              class="mt-3 pt-3 border-t border-surface-border/40 flex items-center justify-between text-[11px]"
            >
              <span
                class="text-slate-400 font-mono font-semibold text-[11px] flex items-center gap-1.5"
              >
                <Icon name="ri:time-line" class="text-xs text-slate-500" />
                {{ state.formatDuration(hook.start) }}
                <span class="text-slate-600">→</span>
                {{ state.formatDuration(hook.end) }}
              </span>

              <div
                class="text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1"
                :class="
                  activeTab === 'saved'
                    ? 'text-slate-400 group-hover:text-amber-400'
                    : 'text-slate-400 group-hover:text-accent-500'
                "
              >
                <span>Preview Segment</span>
                <Icon
                  name="ri:arrow-right-line"
                  class="text-xs group-hover:translate-x-0.5 transition-transform"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Cinematic Hook Preview Modal Extraction -->
    <CinematicHookPreviewModal
      ref="previewModalRef"
      v-model="isModalOpen"
      v-model:show-adjust-duration="localShowAdjustDuration"
      :hook="selectedModalHook"
      :video-url="previewVideoUrl"
      :ready-clips="readyClips"
      :folder-name="state.folderName.value"
      @open-in-editor="onModalOpenInEditor"
      @save-hook="onModalSaveHook"
      @remove-saved-hook="onModalRemoveSavedHook"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Hook, ReadyClip } from '../../types/clipper';
import CinematicHookPreviewModal from './CinematicHookPreviewModal.vue';
import {
  findMatchingClip as matchClipDomain,
  isHookRendered as checkHookRenderedDomain
} from '../../utils/hookClipMatcher';

const props = defineProps<{
  previewVideoUrl: string | null;
  readyClips: ReadyClip[];
}>();

const emit = defineEmits<{
  (e: 'select-hook', hook: Hook): void;
  (e: 'back-to-library'): void;
}>();

const state = useClipperState();
const API_BASE = resolveApiBase();

const activeTab = ref<'generated' | 'saved'>('generated');
const hoveredHookIndex = ref<number | null>(null);
const selectedModalHook = ref<Hook | null>(null);

const isModalOpen = computed({
  get: () => selectedModalHook.value !== null,
  set: (val: boolean) => {
    if (!val) selectedModalHook.value = null;
  }
});

const previewModalRef = ref<InstanceType<
  typeof CinematicHookPreviewModal
> | null>(null);

const displayedHooks = computed(() => {
  return activeTab.value === 'saved'
    ? state.savedHooks.value
    : state.hooks.value;
});

const cardPreviewVideoUrl = computed(() => {
  if (props.previewVideoUrl) return props.previewVideoUrl;
  if (state.videoUrl.value) {
    if (
      state.hasPreview.value &&
      state.videoUrl.value.includes('/assets/sources/') &&
      state.videoUrl.value.endsWith('/full.mp4')
    ) {
      return state.videoUrl.value.replace('/full.mp4', '/preview.mp4');
    }
    return state.videoUrl.value;
  }
  if (state.folderName.value) {
    const filename = state.hasPreview.value ? 'preview.mp4' : 'full.mp4';
    return `${API_BASE}/assets/sources/${state.folderName.value}/${filename}`;
  }
  return null;
});

const modalVideoUrl = computed(() => {
  if (
    previewModalRef.value &&
    previewModalRef.value.modalVideoUrl !== undefined
  ) {
    return previewModalRef.value.modalVideoUrl;
  }
  const isHighRes = state.hdReady.value;
  if (isHighRes && state.videoUrl.value) return state.videoUrl.value;
  if (props.previewVideoUrl) return props.previewVideoUrl;
  if (
    !isHighRes &&
    state.videoUrl.value &&
    state.videoUrl.value.endsWith('/full.mp4') &&
    state.hasPreview.value
  ) {
    return state.videoUrl.value.replace('/full.mp4', '/preview.mp4');
  }
  const folder = state.folderName.value;
  if (folder) {
    const filename = isHighRes
      ? 'full.mp4'
      : state.hasPreview.value
        ? 'preview.mp4'
        : 'full.mp4';
    return `${API_BASE}/assets/sources/${folder}/${filename}`;
  }
  return state.videoUrl.value || null;
});

function onHookCardClick(hook: Hook) {
  if (typeof window !== 'undefined') {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) return;
  }
  selectedModalHook.value = hook;
}

function formatHookDuration(start: number, end: number) {
  const diff = Math.abs(end - start);
  if (diff < 60) return `(${Math.floor(diff)}s)`;
  const m = Math.floor(diff / 60);
  const s = Math.floor(diff % 60);
  return s === 0 ? `(${m}m)` : `(${m}m ${s}s)`;
}

function isHookSaved(hook: Hook) {
  return state.savedHooks.value.some(
    (h: Hook) =>
      Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1
  );
}

function findMatchingClip(hook: Hook | null): ReadyClip | undefined {
  return matchClipDomain(
    hook,
    props.readyClips,
    state.folderName.value,
    state.startSafetyBuffer?.value ?? 2.0
  );
}

function isHookRendered(hook: Hook | null): boolean {
  return checkHookRenderedDomain(
    hook,
    props.readyClips,
    state.folderName.value,
    state.jobStatus.value,
    state.activeHook.value,
    state.clipId.value,
    state.startSafetyBuffer?.value ?? 2.0
  );
}

async function toggleSaveHook(hook: Hook) {
  const existing = state.savedHooks.value.find(
    (h: Hook) =>
      Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1
  );
  if (existing?._id) {
    await state.deleteSavedHook(existing._id);
  } else {
    await state.saveHook(hook);
  }
}

async function onModalSaveHook(hook: Hook) {
  await state.saveHook(hook);
}

async function onModalRemoveSavedHook(hook: Hook) {
  const existing = state.savedHooks.value.find(
    (h: Hook) =>
      Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1
  );
  if (existing?._id) await state.deleteSavedHook(existing._id);
}

function onModalOpenInEditor(hook: Hook) {
  emit('select-hook', hook);
  selectedModalHook.value = null;
}

watch(
  () => state.jobStatus.value,
  newStatus => {
    if (newStatus === 'queued') activeTab.value = 'generated';
  }
);

// Backward compatibility & delegation properties for tests
const localShowAdjustDuration = ref(false);
const showAdjustDuration = computed({
  get: () =>
    previewModalRef.value?.showAdjustDuration ?? localShowAdjustDuration.value,
  set: (val: boolean) => {
    localShowAdjustDuration.value = val;
    if (previewModalRef.value) previewModalRef.value.showAdjustDuration = val;
  }
});

const localModalVideoPlayer = ref<any>(null);
const modalVideoPlayer = computed({
  get: () =>
    previewModalRef.value?.modalVideoPlayer ?? localModalVideoPlayer.value,
  set: (val: any) => {
    localModalVideoPlayer.value = val;
    if (previewModalRef.value) previewModalRef.value.modalVideoPlayer = val;
  }
});

const localStartInputStr = ref('00:00');
const startInputStr = computed({
  get: () => previewModalRef.value?.startInputStr ?? localStartInputStr.value,
  set: (val: string) => {
    localStartInputStr.value = val;
    if (previewModalRef.value) previewModalRef.value.startInputStr = val;
  }
});

const localEndInputStr = ref('00:00');
const endInputStr = computed({
  get: () => previewModalRef.value?.endInputStr ?? localEndInputStr.value,
  set: (val: string) => {
    localEndInputStr.value = val;
    if (previewModalRef.value) previewModalRef.value.endInputStr = val;
  }
});

const activeModalTab = computed({
  get: () => previewModalRef.value?.activeModalTab ?? 'breakdown',
  set: (val: 'breakdown' | 'transcript') => {
    if (previewModalRef.value) previewModalRef.value.activeModalTab = val;
  }
});

const isPreviewingDelta = computed({
  get: () => previewModalRef.value?.isPreviewingDelta ?? false,
  set: (val: boolean) => {
    if (previewModalRef.value) previewModalRef.value.isPreviewingDelta = val;
  }
});

const modalHookSliderRef = computed(
  () => previewModalRef.value?.modalHookSliderRef ?? null
);
const dragMode = computed(() => previewModalRef.value?.dragMode ?? null);
const dragInitialStart = computed(
  () => previewModalRef.value?.dragInitialStart ?? 0
);
const dragInitialEnd = computed(
  () => previewModalRef.value?.dragInitialEnd ?? 0
);
const microWindowStart = computed({
  get: () => previewModalRef.value?.microWindowStart ?? 0,
  set: v => {
    if (previewModalRef.value) previewModalRef.value.microWindowStart = v;
  }
});
const microWindowEnd = computed({
  get: () => previewModalRef.value?.microWindowEnd ?? 100,
  set: v => {
    if (previewModalRef.value) previewModalRef.value.microWindowEnd = v;
  }
});
const edgeScrollDirection = computed(
  () => previewModalRef.value?.edgeScrollDirection ?? 0
);

function updateMicroWindow(start: number, end: number, padding = 30) {
  previewModalRef.value?.updateMicroWindow?.(start, end, padding);
}

function startDrag(
  mode: 'start' | 'end',
  initialStart?: number,
  initialEnd?: number
) {
  previewModalRef.value?.startDrag?.(mode, initialStart, initialEnd);
}

function stopDragging() {
  previewModalRef.value?.stopDragging?.();
}

function stepEdgeAutoScroll(timestamp: number) {
  previewModalRef.value?.stepEdgeAutoScroll?.(timestamp);
}

function onModalTimeUpdate(e: Event) {
  previewModalRef.value?.onModalTimeUpdate(e);
}

function restoreModalVolume(el: HTMLVideoElement | null) {
  if (previewModalRef.value?.restoreModalVolume) {
    previewModalRef.value.restoreModalVolume(el);
    return;
  }
  if (!el) return;
  if (typeof localStorage !== 'undefined') {
    const savedVolume = localStorage.getItem('yonru_preview_volume');
    const savedMuted = localStorage.getItem('yonru_preview_muted');
    if (savedVolume !== null) el.volume = parseFloat(savedVolume);
    if (savedMuted !== null) el.muted = savedMuted === 'true';
  }
}

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
  selectedModalHook,
  showAdjustDuration,
  modalVideoPlayer,
  startInputStr,
  endInputStr,
  isPreviewingDelta,
  activeModalTab,
  modalVideoUrl,
  restoreModalVolume,
  onModalTimeUpdate,
  findMatchingClip
});
</script>

<style scoped>
.fade-layout-enter-active,
.fade-layout-leave-active {
  transition: opacity 200ms ease;
}
.fade-layout-enter-from,
.fade-layout-leave-to {
  opacity: 0;
}

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition:
    opacity 80ms ease,
    transform 80ms ease;
}
.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
