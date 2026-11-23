<template>
  <dialog
    ref="dialogRef"
    data-testid="ready-clip-delete-modal"
    aria-labelledby="ready-clip-delete-title"
    aria-describedby="ready-clip-delete-desc"
    :closedby="isDeleting ? 'none' : 'closerequest'"
    class="yonru-modal-dialog w-[calc(100%-2rem)] max-w-md bg-surface-dark border border-surface-border text-slate-100 p-0 shadow-2xl m-auto flex-col overflow-hidden"
    @cancel="handleCancel"
    @close="handleNativeClose"
  >
    <div v-if="shouldRenderContent" class="p-6 flex flex-col gap-5">
      <!-- Warning Icon & Title -->
      <div class="flex items-start gap-4">
        <div
          class="w-11 h-11 shrink-0 bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-center"
        >
          <Icon name="ri:delete-bin-line" class="text-xl" aria-hidden="true" />
        </div>
        <div class="min-w-0 flex-1">
          <h3
            id="ready-clip-delete-title"
            class="text-lg font-bold text-white tracking-tight"
          >
            {{
              isBulkDelete
                ? `Delete ${displayedClips.length} clips?`
                : 'Delete clip?'
            }}
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            Confirm before removing files from your library.
          </p>
        </div>
      </div>

      <!-- Target Clip Summary -->
      <div class="bg-surface-card border border-surface-border p-3.5">
        <template v-if="!isBulkDelete && singleClip">
          <p class="text-xs font-semibold text-white truncate">
            {{ singleClip.theme || 'Untitled Clip' }}
          </p>
          <p
            v-if="singleClip.channel?.trim()"
            class="text-xs font-medium text-slate-300 truncate mt-0.5"
          >
            {{ singleClip.channel.trim() }}
          </p>
          <p class="text-xs text-slate-400 truncate mt-0.5">
            {{ singleClip.title || singleClip.folder_name }}
          </p>
        </template>
        <ul v-else class="space-y-1.5 text-xs text-slate-200 m-0 p-0 list-none">
          <li
            v-for="clip in previewClips"
            :key="`${clip.folder_name}::${clip.clip_id}`"
            class="flex items-center justify-between gap-3"
          >
            <span class="font-medium text-white truncate">
              {{ clip.theme || 'Untitled Clip' }}
            </span>
            <span class="text-slate-400 text-xs shrink-0">
              {{ clip.title || clip.folder_name }}
            </span>
          </li>
          <li v-if="remainingCount > 0" class="text-xs text-slate-400 pt-0.5">
            and {{ remainingCount }} more
          </li>
        </ul>
      </div>

      <!-- Permanent Removal Caution -->
      <div
        id="ready-clip-delete-desc"
        class="flex items-start gap-3 bg-red-500/5 border border-red-500/25 p-3.5 text-xs"
      >
        <Icon
          name="ri:error-warning-line"
          class="text-red-400 text-base shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <p
            class="font-bold text-red-300 uppercase tracking-wider text-[11px]"
          >
            Permanent removal
          </p>
          <p class="text-slate-300 leading-relaxed mt-1">
            This permanently deletes the local video file, transcript, and saved
            timeline tracks. You cannot undo this.
          </p>
        </div>
      </div>

      <!-- Action Buttons (Safe action gets autofocus) -->
      <div class="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          autofocus
          data-testid="confirm-delete-cancel-btn"
          :disabled="isDeleting"
          class="px-4 py-2 min-h-[44px] sm:min-h-[40px] bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="confirm-delete-submit-btn"
          :disabled="isDeleting"
          class="px-4 py-2 min-h-[44px] sm:min-h-[40px] bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          @click="emit('confirm')"
        >
          <Icon
            v-if="isDeleting"
            name="ri:loader-4-line"
            class="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          <Icon v-else name="ri:delete-bin-line" aria-hidden="true" />
          <span>
            {{
              isDeleting
                ? 'Deleting...'
                : isBulkDelete
                  ? `Delete ${displayedClips.length} clips`
                  : 'Delete clip'
            }}
          </span>
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ReadyClip } from '../../types/clipper';
import {
  attachLightDismiss,
  closeModalDialog,
  openModalDialog,
  supportsTopLayerExit
} from '../../utils/topLayerDialog';

const props = withDefaults(
  defineProps<{
    open: boolean;
    clips: ReadyClip[];
    isDeleting?: boolean;
  }>(),
  {
    isDeleting: false
  }
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const shouldRenderContent = ref(props.open);
const displayedClips = ref<ReadyClip[]>(props.open ? props.clips.slice() : []);
let cleanupLightDismiss: (() => void) | null = null;

watch(
  [() => props.open, () => props.clips],
  ([isOpen, nextClips]) => {
    if (isOpen && nextClips.length > 0) {
      displayedClips.value = nextClips.slice();
    }
  },
  { immediate: true }
);

const isBulkDelete = computed(() => displayedClips.value.length > 1);
const singleClip = computed(() => displayedClips.value[0] ?? null);
const previewClips = computed(() => displayedClips.value.slice(0, 3));
const remainingCount = computed(() =>
  Math.max(0, displayedClips.value.length - 3)
);

watch(
  () => props.open,
  async isOpen => {
    if (isOpen) {
      shouldRenderContent.value = true;
      await nextTick();
      openModalDialog(dialogRef.value);
      return;
    }

    await closeModalDialog(dialogRef.value);
    if (!props.open) {
      shouldRenderContent.value = false;
      displayedClips.value = [];
    }
  },
  { immediate: true, flush: 'post' }
);

onMounted(() => {
  const dialog = dialogRef.value;
  if (!dialog) return;
  cleanupLightDismiss = attachLightDismiss(
    dialog,
    () => emit('close'),
    () => !props.isDeleting
  );
});

onUnmounted(() => {
  cleanupLightDismiss?.();
  cleanupLightDismiss = null;
});

function handleCancel(event: Event): void {
  if (props.isDeleting) {
    event.preventDefault();
    return;
  }
  if (!supportsTopLayerExit()) {
    event.preventDefault();
  }
  emit('close');
}

function handleNativeClose(): void {
  if (props.open && !props.isDeleting) {
    emit('close');
  }
}
</script>
