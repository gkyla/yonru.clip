<template>
  <Transition name="modal-fade">
    <div
      v-if="show"
      class="fixed inset-0 z-[140] flex items-center justify-center p-4"
    >
      <!-- Backdrop filter blurring background -->
      <div
        class="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
        @click="$emit('close')"
      ></div>

      <!-- Content Card -->
      <div
        class="modal-dialog-card relative w-full max-w-lg bg-[#0e1017] border border-surface-border/80 rounded-3xl p-6 sm:p-8 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.9),0_0_30px_rgba(239,68,68,0.08)] flex flex-col overflow-hidden z-[150]"
      >
        <div
          class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"
        ></div>

        <!-- Top-Right Close Button (X) -->
        <button
          class="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer z-20 group"
          title="Keep Editing (Esc)"
          @click="$emit('close')"
        >
          <Icon
            name="ri:close-line"
            class="text-lg group-hover:rotate-90 transition-transform duration-200"
          />
        </button>

        <!-- Red Trash Icon -->
        <div
          class="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-400 flex items-center justify-center mb-5 shadow-[0_0_25px_rgba(239,68,68,0.15)]"
        >
          <Icon name="ri:delete-bin-line" class="text-2xl" />
        </div>

        <h3 class="text-xl font-black text-white tracking-wide mb-1.5">
          Discard New Template Draft?
        </h3>
        <p class="text-slate-400 text-xs leading-relaxed mb-5">
          Are you sure you want to discard this new prompt configuration? All
          entered information will be lost and the editor will close.
        </p>

        <!-- Context summary card -->
        <div
          class="bg-surface-panel/40 border border-surface-border/80 rounded-xl p-3.5 mb-6 flex flex-col gap-1.5"
        >
          <div
            class="flex items-center justify-between text-[10px] uppercase font-bold tracking-widest text-slate-500"
          >
            <span>Draft Configuration</span>
            <span
              class="text-red-400 font-semibold lowercase tracking-normal flex items-center gap-1"
            >
              <span
                class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"
              ></span>
              unsaved new template
            </span>
          </div>
          <span class="text-white font-mono text-xs font-bold truncate">
            {{ promptName || 'Untitled New Template' }}
          </span>
        </div>

        <!-- Action Buttons: Yes, Discard + No, Keep Editing -->
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full"
        >
          <button
            class="flex-1 py-3 px-4 bg-red-500 hover:bg-red-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            @click="$emit('confirm')"
          >
            <Icon name="ri:delete-bin-line" class="text-base font-bold" />
            <span>Yes, Discard</span>
          </button>

          <button
            class="sm:w-auto py-3 px-5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98] cursor-pointer"
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
