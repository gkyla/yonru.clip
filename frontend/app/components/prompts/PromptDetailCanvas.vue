<template>
  <main
    class="flex-1 min-w-0 w-full bg-surface-panel border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl min-h-[560px] flex flex-col self-start relative"
  >
    <!-- Empty Selection State -->
    <div
      v-if="!editingId && !isCreatingNew"
      class="flex-1 w-full h-full flex flex-col items-center justify-center text-center p-8"
    >
      <div
        class="w-14 h-14 bg-surface-dark rounded-full border border-surface-border flex items-center justify-center mb-3 text-slate-500 shadow-inner"
      >
        <Icon name="ri:chat-quote-line" class="text-2xl" />
      </div>
      <h4 class="text-white font-bold text-xs uppercase tracking-wider mb-1">
        No Template Selected
      </h4>
      <p class="text-slate-500 text-xs max-w-sm leading-relaxed mb-5">
        Select an existing template from the sidebar list to edit, or initialize
        a new prompt template configuration.
      </p>
      <button
        class="px-4 py-2 bg-surface-dark hover:bg-surface-panel border border-surface-border text-slate-300 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer hover:border-slate-600"
        @click="$emit('start-new')"
      >
        + Create New Template
      </button>
    </div>

    <!-- Editor Form Canvas -->
    <div
      v-else
      class="flex flex-col gap-4 flex-1 w-full h-full"
      :class="{ 'animate-template-crossfade': isSwitchingPrompt }"
    >
      <!-- Editor Title & Action Bar -->
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border/50 pb-3.5"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-2 h-2 rounded-full transition-colors"
            :class="
              isDirty
                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse'
                : 'bg-accent-500 shadow-[0_0_8px_#ffd700]'
            "
          ></div>
          <h3
            class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2"
          >
            <span>{{
              editingId ? 'Modify Prompt Template' : 'New Prompt Configuration'
            }}</span>
            <span
              v-if="isDirty"
              class="text-[9px] bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
            >
              unsaved
            </span>
          </h3>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <!-- When editing existing template: Delete Button -->
          <button
            v-if="editingId"
            class="px-3 py-1.5 bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 hover:border-[#ff4a4a] text-[#ff4a4a] hover:bg-[#ff4a4a]/20 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer"
            @click="$emit('delete')"
          >
            Delete
          </button>

          <!-- When editing existing template: Revert Button -->
          <button
            v-if="editingId"
            :disabled="!isDirty"
            class="px-3 py-1.5 bg-surface-dark border border-surface-border text-slate-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:border-surface-border flex items-center gap-1"
            title="Revert modifications to saved version"
            @click="$emit('revert')"
          >
            <Icon name="ri:restart-line" class="text-xs" />
            <span>Revert</span>
          </button>

          <!-- When creating new template: Cancel Button -->
          <button
            v-else
            class="px-3 py-1.5 bg-surface-dark border border-surface-border text-slate-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer hover:border-slate-600"
            @click="$emit('cancel')"
          >
            Cancel
          </button>

          <button
            :disabled="!promptName || !promptText"
            class="px-4 py-1.5 bg-accent-500 text-black font-black uppercase tracking-wider text-[10px] rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(255,215,0,0.15)] active:scale-95 cursor-pointer"
            @click="$emit('save')"
          >
            {{ editingId ? 'Update Prompt' : 'Save Prompt' }}
          </button>
        </div>
      </div>

      <!-- Row 1: Prompt Name -->
      <div class="flex flex-col gap-1">
        <label
          class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5"
          >Prompt Name</label
        >
        <input
          :value="promptName"
          type="text"
          placeholder="e.g. Comedy Podcast Hooks"
          class="w-full bg-surface-dark border border-surface-border text-white px-3.5 py-2 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all text-xs font-semibold placeholder-slate-600"
          @input="onNameInput"
        />
      </div>

      <!-- Row 2: Suitable For Tags -->
      <div class="flex flex-col gap-1.5 relative">
        <label
          class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5"
          >Suitable For (Tags)</label
        >
        <div class="flex items-center gap-1.5 flex-wrap min-h-[34px]">
          <!-- Active Tag Badges with Custom Tooltip -->
          <div
            v-for="(tag, index) in suitableFor"
            :key="index"
            class="group/pill relative inline-flex items-center"
          >
            <span
              class="bg-surface-dark border border-surface-border text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 group-hover/pill:border-slate-600 transition-colors select-none"
            >
              <span class="text-accent-500 font-bold text-[11px]">#</span>
              <span class="max-w-[160px] truncate">{{ tag }}</span>
              <button
                class="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded focus:outline-none cursor-pointer"
                @click="$emit('remove-tag', index)"
              >
                <Icon name="ri:close-line" class="text-xs" />
              </button>
            </span>

            <!-- Custom Hover Tooltip -->
            <div
              class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-[#0a0c12] border border-slate-700/80 text-white text-xs font-mono font-bold rounded-lg shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9),0_0_15px_rgba(255,215,0,0.12)] opacity-0 group-hover/pill:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform translate-y-1 group-hover/pill:translate-y-0 flex items-center gap-1"
            >
              <span class="text-accent-500 font-black">#</span>
              <span>{{ tag }}</span>
              <div
                class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0c12] border-b border-r border-slate-700/80 transform rotate-45"
              ></div>
            </div>
          </div>

          <!-- + Add Tag Trigger Button & Popover -->
          <PromptTagPopover
            :suggested-tags="suggestedTags"
            @add-tag="$emit('add-tag', $event)"
          />
        </div>
      </div>

      <!-- Row 3: Content Style Editor Canvas -->
      <div class="flex flex-col gap-1 flex-1 min-h-[420px]">
        <label
          class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5"
          >Content Style & Extraction Criteria</label
        >
        <PromptEditor
          ref="promptEditorRef"
          :model-value="promptText"
          class="font-mono flex-1 flex flex-col w-full"
          @update:model-value="$emit('update:promptText', $event)"
        />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PromptTagPopover from './PromptTagPopover.vue';

interface Props {
  editingId: string | null;
  isCreatingNew: boolean;
  promptName: string;
  suitableFor: string[];
  promptText: string;
  isDirty: boolean;
  isSwitchingPrompt?: boolean;
  suggestedTags?: string[];
}

withDefaults(defineProps<Props>(), {
  isSwitchingPrompt: false,
  suggestedTags: () => []
});

const emit = defineEmits<{
  'update:promptName': [val: string];
  'update:promptText': [val: string];
  'start-new': [];
  delete: [];
  revert: [];
  cancel: [];
  save: [];
  'add-tag': [tag: string];
  'remove-tag': [index: number];
}>();

const promptEditorRef = ref<unknown>(null);

function onNameInput(e: Event) {
  emit('update:promptName', (e.target as HTMLInputElement).value);
}

defineExpose({
  promptEditorRef
});
</script>
