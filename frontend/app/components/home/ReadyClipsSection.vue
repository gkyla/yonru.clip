<template>
  <div>
    <!-- Ready to Edit Section (Top 3 on Home) -->
    <div class="mb-4 overflow-visible p-8 pt-0">
      <div class="flex items-center justify-between mb-6">
        <h3
          class="text-xl font-bold text-white tracking-tight flex items-center gap-2"
        >
          <Icon
            name="ri:scissors-cut-fill"
            class="text-accent-500"
            aria-hidden="true"
          />
          Ready to Edit
        </h3>
        <button
          v-if="readyClips.length > 3"
          type="button"
          data-testid="view-all-ready-clips-btn"
          class="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-accent-500 transition-colors flex items-center gap-1.5 cursor-pointer py-2 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          @click="showLibraryModal = true"
        >
          View All ({{ readyClips.length }})
          <Icon name="ri:arrow-right-s-line" aria-hidden="true" />
        </button>
      </div>

      <!-- Skeletons -->
      <div
        v-if="isReadyClipsLoading"
        data-testid="ready-clips-skeletons"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        <div
          v-for="i in 3"
          :key="i"
          class="bg-surface-panel/30 border border-surface-border/50 flex flex-col animate-pulse overflow-hidden"
        >
          <div
            class="aspect-video bg-surface-dark flex items-center justify-center relative"
          >
            <div
              class="w-6 h-6 border-2 border-accent-500/10 border-t-accent-500/30 rounded-full animate-spin"
            ></div>
          </div>
          <div class="p-4 flex-1">
            <div class="w-full h-4 bg-surface-dark mb-2"></div>
            <div class="w-2/3 h-3 bg-surface-dark/60"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="readyClips.length === 0"
        data-testid="ready-clips-empty-state"
        class="bg-surface-panel/30 border border-surface-border/50 border-dashed p-12 flex flex-col items-center justify-center text-center"
      >
        <div
          class="w-16 h-16 bg-surface-dark rounded-full flex items-center justify-center mb-4 border border-surface-border/50"
        >
          <Icon
            name="ri:movie-2-line"
            class="text-3xl text-slate-500"
            aria-hidden="true"
          />
        </div>
        <h4 class="text-white font-bold text-lg mb-1">
          Your Video Library is Empty
        </h4>
        <p class="text-slate-400 text-sm max-w-sm">
          Paste a YouTube URL above to start generating viral clips
          automatically.
        </p>
      </div>

      <!-- Real Clips (Top 3 on Home) -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <ReadyClipCard
          v-for="clip in homeTopClips"
          :key="`${clip.folder_name}::${clip.clip_id}`"
          :clip="clip"
          :api-base="API_BASE"
          :selectable="false"
          @open="handleOpenClip"
          @request-delete="requestDeleteClips([$event])"
        />
      </div>
    </div>

    <!-- Ready Clips Library Modal -->
    <ReadyClipsLibraryModal
      v-model:open="showLibraryModal"
      :ready-clips="readyClips"
      :api-base="API_BASE"
      :has-delete-confirm-open="deleteConfirmOpen"
      :is-deleting="isDeletingClips"
      @open-clip="handleOpenClip"
      @request-delete="requestDeleteClips"
    />

    <!-- Always-Modal Permanent Removal Confirmation -->
    <ReadyClipDeleteModal
      :open="deleteConfirmOpen"
      :clips="pendingDeleteClips"
      :is-deleting="isDeletingClips"
      @close="closeDeleteConfirm"
      @confirm="executeDeleteClips"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CachedVideo, ReadyClip } from '../../types/clipper';
import ReadyClipCard from './ReadyClipCard.vue';
import ReadyClipsLibraryModal from './ReadyClipsLibraryModal.vue';
import ReadyClipDeleteModal from './ReadyClipDeleteModal.vue';

const props = defineProps<{
  readyClips: ReadyClip[];
  isReadyClipsLoading: boolean;
}>();

const emit = defineEmits<{
  'load-clip': [clip: ReadyClip];
  'refresh-clips': [];
}>();

const state = useClipperState();
const API_BASE = resolveApiBase();

const showLibraryModal = ref(false);
const deleteConfirmOpen = ref(false);
const pendingDeleteClips = ref<ReadyClip[]>([]);
const isDeletingClips = ref(false);

const homeTopClips = computed(() => props.readyClips.slice(0, 3));

function handleOpenClip(clip: ReadyClip): void {
  const parentVid = state.cachedVideos.value.find(
    (v: CachedVideo) => v.folder_name === clip.folder_name
  );
  if (parentVid) {
    state.setLastAccessed(parentVid.video_id);
  }
  showLibraryModal.value = false;
  emit('load-clip', clip);
}

function requestDeleteClips(clips: ReadyClip[]): void {
  if (clips.length === 0) return;
  pendingDeleteClips.value = clips;
  deleteConfirmOpen.value = true;
}

function closeDeleteConfirm(): void {
  if (isDeletingClips.value) return;
  deleteConfirmOpen.value = false;
  pendingDeleteClips.value = [];
}

function clearLastAccessedClipIfDeleted(deleted: ReadyClip[]): void {
  const lastClip = state.lastAccessedClip.value;
  if (!lastClip?.clip_id) return;

  const isMatch = deleted.some(
    clip =>
      clip.clip_id === lastClip.clip_id &&
      (!lastClip.folder || clip.folder_name === lastClip.folder)
  );
  if (!isMatch) return;

  state.lastAccessedClip.value = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('yonru_last_clip');
  }
}

async function executeDeleteClips(): Promise<void> {
  const targets = pendingDeleteClips.value.slice();
  if (targets.length === 0 || isDeletingClips.value) return;

  isDeletingClips.value = true;
  try {
    if (targets.length === 1) {
      const clip = targets[0]!;
      await $fetch(
        `${API_BASE}/api/ready-clips/${encodeURIComponent(clip.folder_name)}/${encodeURIComponent(clip.clip_id)}`,
        { method: 'DELETE' }
      );
      clearLastAccessedClipIfDeleted(targets);
      state.showToast('Clip successfully deleted.', 'success');
    } else {
      await $fetch(`${API_BASE}/api/ready-clips/delete-batch`, {
        method: 'POST',
        body: {
          clips: targets.map(clip => ({
            folder_name: clip.folder_name,
            clip_id: clip.clip_id
          }))
        }
      });
      clearLastAccessedClipIfDeleted(targets);
      state.showToast(
        `${targets.length} clips successfully deleted.`,
        'success'
      );
    }
    emit('refresh-clips');
  } catch (err: unknown) {
    console.error('Failed to delete clip(s)', err);
    const msg = err instanceof Error ? err.message : String(err);
    state.showToast(msg, 'error');
  } finally {
    isDeletingClips.value = false;
    deleteConfirmOpen.value = false;
    pendingDeleteClips.value = [];
  }
}
</script>
