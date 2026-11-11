<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[65]"
      @mousedown.self="emit('close')"
    >
      <div
        data-testid="audio-library-popover"
        class="audio-library-popover fixed w-[360px] h-[460px] max-h-[calc(100vh-260px)] min-h-[360px] bg-[#111113]/95 backdrop-blur-xl border border-b-0 border-white/10 shadow-[0_-20px_25px_-5px_rgba(0,0,0,0.8),-16px_-8px_20px_-6px_rgba(0,0,0,0.7),16px_-8px_20px_-6px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden select-none z-[66] mb-0.5"
        :style="popoverPositionStyle"
        @mousedown.stop
      >
        <!-- Header -->
        <div
          class="px-3.5 py-2.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]"
        >
          <div class="flex items-center gap-1 min-w-0">
            <div
              class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            >
              <Icon name="ri:music-2-line" class="text-emerald-400 text-xs" />
            </div>
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[11px] font-extrabold text-white tracking-wide">
                Audio Library
              </span>
              <span
                class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/5"
              >
                {{ items.length }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="audio-library-upload-btn"
              class="px-2.5 py-1.5 rounded-lg bg-surface-card hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border text-[9px] font-bold tracking-wider shadow-md shadow-black/40 hover:shadow-black/60 transition-all flex items-center gap-1 cursor-pointer"
              @click="emit('trigger-upload')"
            >
              <span class="mr-1">+</span>
              <span>Add Audio</span>
            </button>
            <button
              type="button"
              class="w-6 h-6 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close (Esc)"
              @click="emit('close')"
            >
              <Icon name="ri:close-line" class="text-sm" />
            </button>
          </div>
        </div>

        <!-- Duplicate Confirmation Dialog (Inline Overlay) -->
        <div
          v-if="duplicatePrompt"
          data-testid="audio-duplicate-confirm-dialog"
          class="p-4 bg-[#16161a] border-b border-amber-500/20 flex flex-col gap-3"
        >
          <div class="flex items-start gap-2.5">
            <div
              class="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5"
            >
              <Icon name="ri:alert-line" class="text-amber-400 text-sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-bold text-white leading-snug">
                Audio "{{ duplicatePrompt.existingItem.name }}" already exists
                in the Audio Library
              </p>
              <p class="text-[10px] text-slate-400 mt-1 leading-relaxed">
                Do you want to replace the existing file in the library with the
                new version, or use the existing audio?
              </p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              data-testid="audio-duplicate-cancel-btn"
              class="px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-[10px] font-bold transition-colors cursor-pointer"
              @click="emit('cancel-duplicate')"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="audio-duplicate-use-existing-btn"
              class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold transition-colors cursor-pointer"
              @click="emit('confirm-use-existing')"
            >
              Use Existing
            </button>
            <button
              type="button"
              data-testid="audio-duplicate-replace-btn"
              class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-extrabold transition-colors cursor-pointer"
              @click="emit('confirm-replace')"
            >
              Replace
            </button>
          </div>
        </div>

        <!-- Search Input -->
        <div
          v-if="items.length > 0 && !duplicatePrompt"
          class="px-3 py-2 border-b border-white/5 bg-black/20"
        >
          <div class="relative flex items-center">
            <Icon
              name="ri:search-line"
              class="text-slate-500 text-xs absolute left-2.5 pointer-events-none"
            />
            <input
              v-model="searchQuery"
              data-testid="audio-library-search"
              type="text"
              placeholder="Search audio library..."
              class="w-full pl-7 pr-7 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 focus:border-emerald-500/40 focus:outline-none text-[11px] text-slate-200 placeholder-slate-500"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2 text-slate-500 hover:text-slate-300"
              @click="searchQuery = ''"
            >
              <Icon name="ri:close-circle-fill" class="text-xs" />
            </button>
          </div>
        </div>

        <!-- Audio List Body -->
        <div
          v-if="!duplicatePrompt"
          class="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-[140px] flex flex-col"
        >
          <div
            v-if="loading"
            class="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500 py-8"
          >
            <Icon
              name="ri:loader-4-line"
              class="text-lg text-emerald-400 animate-spin"
            />
            <span class="text-[10px] font-medium"
              >Loading audio library...</span
            >
          </div>

          <div
            v-else-if="items.length === 0"
            class="flex-1 flex flex-col items-center justify-center text-center gap-2.5 py-6 px-4"
          >
            <div
              class="w-10 h-10 rounded-full bg-white/[0.03] border border-white/5 flex items-center justify-center text-slate-500"
            >
              <Icon name="ri:folder-music-line" class="text-lg" />
            </div>
            <p class="text-[11px] font-bold text-slate-300">
              Audio Library is empty
            </p>
            <p class="text-[10px] text-slate-500 max-w-[230px] leading-relaxed">
              Uploaded audio is automatically saved to your workspace library
              for reuse anytime.
            </p>
            <button
              type="button"
              class="mt-1 px-3.5 py-1.5 rounded-lg bg-surface-card hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border text-[9.5px] font-bold tracking-wider shadow-md shadow-black/40 hover:shadow-black/60 transition-all flex items-center gap-1.5 cursor-pointer"
              @click="emit('trigger-upload')"
            >
              <span class="mr-1">+</span>
              <span>Add First Audio</span>
            </button>
          </div>

          <div
            v-else-if="filteredItems.length === 0"
            class="flex-1 flex flex-col items-center justify-center text-center py-8 text-[11px] text-slate-500"
          >
            No audio matching "{{ searchQuery }}"
          </div>

          <div v-else class="space-y-1">
            <div
              v-for="item in filteredItems"
              :key="item.id"
              data-testid="audio-library-item"
              class="group flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10 transition-all"
            >
              <!-- Preview Play/Pause Button -->
              <button
                type="button"
                data-testid="audio-library-preview-btn"
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                :class="
                  playingItemId === item.id
                    ? 'bg-emerald-500 text-black'
                    : 'bg-black/40 text-emerald-400 hover:bg-emerald-500/20 border border-white/5'
                "
                :title="
                  playingItemId === item.id ? 'Stop Preview' : 'Preview Audio'
                "
                @click.stop="togglePreview(item)"
              >
                <Icon
                  :name="
                    playingItemId === item.id ? 'ri:stop-fill' : 'ri:play-fill'
                  "
                  class="text-xs"
                />
              </button>

              <!-- Clickable Name & Duration to Insert -->
              <button
                type="button"
                data-testid="audio-library-insert-btn"
                class="flex-1 min-w-0 text-left flex items-center justify-between gap-2 cursor-pointer"
                title="Add to Timeline"
                @click="handleInsert(item)"
              >
                <div class="min-w-0 flex-1">
                  <p
                    class="text-[11px] font-bold text-slate-200 group-hover:text-white truncate"
                  >
                    {{ item.name }}
                  </p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      class="text-[9px] font-mono text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.2 rounded"
                    >
                      {{ formatAudioDuration(item.duration) }}
                    </span>
                    <span
                      v-if="item.size"
                      class="text-[9px] font-mono text-slate-500"
                    >
                      {{ formatFileSize(item.size) }}
                    </span>
                  </div>
                </div>

                <span
                  class="px-2 py-1 rounded-md bg-emerald-500/10 group-hover:bg-emerald-500 group-hover:text-black text-emerald-300 text-[9px] font-extrabold tracking-wider uppercase transition-colors shrink-0"
                >
                  + Add
                </span>
              </button>

              <!-- Delete Button -->
              <button
                type="button"
                data-testid="audio-library-delete-btn"
                class="w-6 h-6 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                title="Remove from Audio Library"
                @click.stop="emit('delete', item.id)"
              >
                <Icon name="ri:delete-bin-6-line" class="text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import type {
  AudioLibraryItem,
  DuplicateAudioPrompt,
  AnchorRect
} from '../../types/clipper';

const props = defineProps<{
  modelValue: boolean;
  items: AudioLibraryItem[];
  loading?: boolean;
  anchorRect?: AnchorRect | null;
  duplicatePrompt?: DuplicateAudioPrompt | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'close'): void;
  (e: 'insert', item: AudioLibraryItem): void;
  (e: 'delete', id: string): void;
  (e: 'trigger-upload'): void;
  (e: 'confirm-replace'): void;
  (e: 'confirm-use-existing'): void;
  (e: 'cancel-duplicate'): void;
}>();

const searchQuery = ref('');
const playingItemId = ref<string | null>(null);
let previewAudio: HTMLAudioElement | null = null;

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.items;
  return props.items.filter(item => item.name.toLowerCase().includes(q));
});

const popoverPositionStyle = computed(() => {
  const rect = props.anchorRect;
  if (!rect || typeof window === 'undefined') {
    return {
      bottom: '264px',
      left: '84px'
    };
  }
  const viewportHeight = window.innerHeight || 800;
  const viewportWidth = window.innerWidth || 1280;
  const bottomOffset = Math.max(16, viewportHeight - rect.top + 8);
  const clampedLeft = Math.min(
    Math.max(12, rect.left),
    Math.max(12, viewportWidth - 376)
  );
  return {
    bottom: `${bottomOffset}px`,
    left: `${clampedLeft}px`
  };
});

function stopPreview() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.currentTime = 0;
    previewAudio = null;
  }
  playingItemId.value = null;
}

function togglePreview(item: AudioLibraryItem) {
  if (playingItemId.value === item.id) {
    stopPreview();
    return;
  }
  stopPreview();
  if (typeof Audio === 'undefined' || !item.src) return;
  try {
    previewAudio = new Audio(item.src);
    playingItemId.value = item.id;
    previewAudio.onended = () => {
      playingItemId.value = null;
      previewAudio = null;
    };
    previewAudio.onerror = () => {
      playingItemId.value = null;
      previewAudio = null;
    };
    previewAudio.play().catch(() => {
      playingItemId.value = null;
      previewAudio = null;
    });
  } catch {
    playingItemId.value = null;
  }
}

function handleInsert(item: AudioLibraryItem) {
  stopPreview();
  emit('insert', item);
}

function formatAudioDuration(sec: number): string {
  const total = Math.max(0, Number(sec || 0));
  if (total < 60) {
    return `${total.toFixed(1)}s`;
  }
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

watch(
  () => props.modelValue,
  isOpen => {
    if (!isOpen) {
      stopPreview();
      searchQuery.value = '';
    }
  }
);

onUnmounted(() => {
  stopPreview();
});
</script>

<style scoped>
.audio-library-popover {
  border-bottom: none !important;
  box-shadow:
    0 -20px 25px -5px rgba(0, 0, 0, 0.8),
    -16px -8px 20px -6px rgba(0, 0, 0, 0.7),
    16px -8px 20px -6px rgba(0, 0, 0, 0.7);
}

@supports (position-area: block-start) {
  .audio-library-popover {
    position-try-fallbacks:
      flip-block,
      flip-inline,
      flip-block flip-inline;
  }
}
</style>
