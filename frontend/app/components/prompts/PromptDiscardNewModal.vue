<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      class="fixed inset-0 z-[140] flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/80 cursor-pointer"
        @click="$emit('close')"
      ></div>

      <!-- Content Card -->
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-discard-title"
        class="modal-dialog-card relative w-full max-w-md bg-surface-panel border border-surface-border p-6 sm:p-8 flex flex-col z-[150]"
      >
        <!-- Top-Right Close Button (X) -->
        <button
          type="button"
          aria-label="Keep editing"
          title="Keep Editing (Esc)"
          class="absolute top-4 right-4 w-8 h-8 bg-surface-dark hover:bg-surface-card border border-surface-border text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          @click="$emit('close')"
        >
          <Icon name="ri:close-line" class="text-base" aria-hidden="true" />
        </button>

        <div
          class="w-11 h-11 bg-surface-dark border border-surface-border text-red-400 flex items-center justify-center mb-4"
        >
          <Icon name="ri:delete-bin-line" class="text-xl" aria-hidden="true" />
        </div>

        <h3
          id="prompt-discard-title"
          class="text-lg font-bold text-white mb-1.5"
        >
          Discard New Template Draft?
        </h3>
        <p class="text-slate-400 text-xs leading-relaxed mb-5">
          Discard this new prompt draft? All entered details will be lost and
          the editor will close.
        </p>

        <!-- Context summary card -->
        <div
          class="bg-surface-dark/60 border border-surface-border p-3.5 mb-6 flex flex-col gap-1.5"
        >
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-slate-400">Draft Template</span>
            <span
              class="text-red-300 font-medium inline-flex items-center gap-1.5"
            >
              <span
                class="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"
                aria-hidden="true"
              ></span>
              <span>Unsaved new template</span>
            </span>
          </div>
          <span class="text-white font-mono text-xs font-semibold truncate">
            {{ promptName || 'Untitled New Template' }}
          </span>
        </div>

        <!-- Action Buttons -->
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full"
        >
          <button
            type="button"
            class="flex-1 py-2.5 px-4 bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 text-red-200 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('confirm')"
          >
            <Icon
              name="ri:delete-bin-line"
              class="text-sm"
              aria-hidden="true"
            />
            <span>Yes, Discard</span>
          </button>

          <button
            type="button"
            class="sm:w-auto py-2.5 px-4 bg-surface-dark border border-surface-border hover:bg-surface-card hover:border-slate-500 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('close')"
          >
            No, Keep Editing
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  show: boolean;
  promptName?: string;
}

withDefaults(defineProps<Props>(), {
  promptName: ''
});

defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
