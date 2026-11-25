<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      class="fixed inset-0 z-[140] flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/80 cursor-pointer"
        @click="$emit('keep-editing')"
      ></div>

      <!-- Content Card -->
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-unsaved-title"
        class="modal-dialog-card relative w-full max-w-md bg-surface-panel border border-surface-border p-6 sm:p-8 flex flex-col z-[150]"
      >
        <!-- Top-Right Close Button (X) -->
        <button
          type="button"
          aria-label="Keep editing"
          title="Keep Editing (Esc)"
          class="absolute top-4 right-4 w-8 h-8 bg-surface-dark hover:bg-surface-card border border-surface-border text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          @click="$emit('keep-editing')"
        >
          <Icon name="ri:close-line" class="text-base" aria-hidden="true" />
        </button>

        <div
          class="w-11 h-11 bg-surface-dark border border-surface-border text-amber-400 flex items-center justify-center mb-4"
        >
          <Icon name="ri:alert-line" class="text-xl" aria-hidden="true" />
        </div>

        <h3
          id="prompt-unsaved-title"
          class="text-lg font-bold text-white mb-1.5"
        >
          Unsaved Changes Detected
        </h3>
        <p class="text-slate-400 text-xs leading-relaxed mb-5">
          You have unsaved changes to this prompt. Save before leaving or
          discard your edits?
        </p>

        <!-- Context summary card -->
        <div
          class="bg-surface-dark/60 border border-surface-border p-3.5 mb-6 flex flex-col gap-1.5"
        >
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-medium text-slate-400">Active Template</span>
            <span
              class="text-amber-300 font-medium inline-flex items-center gap-1.5"
            >
              <span
                class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                aria-hidden="true"
              ></span>
              <span>Unsaved draft</span>
            </span>
          </div>
          <span class="text-white font-mono text-xs font-semibold truncate">
            {{ promptName || 'Untitled Template' }}
          </span>
          <div
            v-if="pendingActionDescription"
            class="text-[11px] text-slate-400 border-t border-surface-border/60 pt-1.5 mt-0.5 flex items-center gap-1"
          >
            <span>Next:</span>
            <span class="text-slate-200 font-medium">{{
              pendingActionDescription
            }}</span>
          </div>
        </div>

        <!-- Action Buttons: Save & Continue + Discard Changes -->
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full"
        >
          <button
            type="button"
            :disabled="!canSave"
            class="flex-1 py-2.5 px-4 bg-accent-500 hover:bg-accent-400 text-black text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('save-and-proceed')"
          >
            <Icon name="ri:save-3-line" class="text-sm" aria-hidden="true" />
            <span>Save & Continue</span>
          </button>

          <button
            type="button"
            class="sm:w-auto py-2.5 px-4 bg-surface-dark border border-surface-border text-slate-300 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('discard-and-proceed')"
          >
            <Icon
              name="ri:delete-bin-line"
              class="text-sm"
              aria-hidden="true"
            />
            <span>Discard Changes</span>
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
  pendingActionDescription?: string;
  canSave?: boolean;
}

withDefaults(defineProps<Props>(), {
  promptName: '',
  pendingActionDescription: '',
  canSave: false
});

defineEmits<{
  'keep-editing': [];
  'save-and-proceed': [];
  'discard-and-proceed': [];
}>();
</script>
