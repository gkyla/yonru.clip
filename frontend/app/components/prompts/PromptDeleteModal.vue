<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      class="fixed inset-0 z-[120] flex items-center justify-center p-4"
    >
      <!-- Backdrop filter blurring background -->
      <div
        class="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
        @click="$emit('close')"
      ></div>

      <!-- Content Card -->
      <div
        class="modal-dialog-card relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden z-[130]"
      >
        <div
          class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"
        ></div>

        <!-- Large warning shield icon -->
        <div
          class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
        >
          <Icon name="ri:delete-bin-2-line" class="text-3xl" />
        </div>

        <h3 class="text-2xl font-black text-white tracking-wide mb-3">
          Delete Prompt Template?
        </h3>

        <!-- Subtitle / target template name -->
        <div
          class="bg-surface-panel/30 border border-surface-border rounded-xl p-4 mb-6 flex flex-col gap-1"
        >
          <span
            class="text-[10px] uppercase font-bold tracking-widest text-slate-500"
          >
            Selected Template
          </span>
          <span class="text-white font-mono text-xs font-bold truncate">
            {{ promptName || 'Untitled Template' }}
          </span>
        </div>

        <!-- Warning details -->
        <div class="flex flex-col gap-4 text-xs mb-8">
          <div
            class="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-2xl p-4"
          >
            <Icon
              name="ri:error-warning-line"
              class="text-red-400 text-lg shrink-0 mt-0.5"
            />
            <div>
              <h4
                class="text-red-400 font-bold uppercase tracking-wider text-[10px] mb-1"
              >
                Permanent Removal
              </h4>
              <p class="text-slate-400 leading-relaxed font-semibold">
                This will permanently delete this prompt template from the
                storage file. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex items-center gap-3 w-full">
          <button
            class="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
            @click="$emit('close')"
          >
            Cancel
          </button>
          <button
            class="flex-1 py-3 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-[0.98] cursor-pointer"
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
