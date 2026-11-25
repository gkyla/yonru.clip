<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      class="fixed inset-0 z-[120] flex items-center justify-center p-4"
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
        aria-labelledby="prompt-delete-title"
        class="modal-dialog-card relative w-full max-w-md bg-surface-panel border border-surface-border p-6 sm:p-8 flex flex-col z-[130]"
      >
        <div
          class="w-11 h-11 bg-surface-dark border border-surface-border text-red-400 flex items-center justify-center mb-4"
        >
          <Icon
            name="ri:delete-bin-2-line"
            class="text-xl"
            aria-hidden="true"
          />
        </div>

        <h3 id="prompt-delete-title" class="text-lg font-bold text-white mb-2">
          Delete Prompt Template?
        </h3>

        <!-- Target template name -->
        <div
          class="bg-surface-dark/60 border border-surface-border p-3.5 mb-4 flex flex-col gap-1"
        >
          <span class="text-[11px] font-medium text-slate-400">
            Selected Template
          </span>
          <span class="text-white font-mono text-xs font-semibold truncate">
            {{ promptName || 'Untitled Template' }}
          </span>
        </div>

        <!-- Warning details -->
        <div
          class="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 p-3.5 text-xs mb-6"
        >
          <Icon
            name="ri:error-warning-line"
            class="text-red-400 text-sm shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h4 class="text-red-300 font-semibold text-xs mb-0.5">
              Permanent Removal
            </h4>
            <p class="text-slate-300 leading-relaxed">
              This will permanently delete this prompt template. This action
              cannot be undone.
            </p>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex items-center gap-2.5 w-full">
          <button
            type="button"
            class="flex-1 py-2.5 px-4 bg-surface-dark border border-surface-border hover:bg-surface-card hover:border-slate-500 text-slate-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 py-2.5 px-4 bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 text-red-200 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('confirm')"
          >
            Confirm Delete
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
