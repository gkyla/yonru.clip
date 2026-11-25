<template>
  <main
    class="flex-1 min-w-0 w-full bg-surface-panel border border-surface-border p-6 sm:p-8 min-h-[560px] flex flex-col self-start relative"
  >
    <!-- Empty Selection State -->
    <div
      v-if="!editingId && !isCreatingNew"
      class="flex-1 w-full h-full flex flex-col items-center justify-center text-center p-8"
    >
      <div
        class="w-12 h-12 bg-surface-dark border border-surface-border flex items-center justify-center mb-3 text-slate-400"
      >
        <Icon name="ri:chat-quote-line" class="text-xl" aria-hidden="true" />
      </div>
      <h2 class="text-white font-bold text-sm mb-1">No Template Selected</h2>
      <p class="text-slate-400 text-xs max-w-sm leading-relaxed mb-5">
        Choose a prompt from the left list to edit, or create a new one.
      </p>
      <button
        type="button"
        class="px-3.5 py-2 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-500 text-slate-200 hover:text-white font-semibold text-xs transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
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
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border/60 pb-3.5"
      >
        <div class="flex items-center gap-2.5 flex-wrap">
          <h2 class="text-sm font-bold text-white">
            {{
              editingId ? 'Modify Prompt Template' : 'New Prompt Configuration'
            }}
          </h2>
          <span
            v-if="isDirty"
            data-testid="prompt-unsaved-status"
            class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300"
          >
            <span
              class="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
              aria-hidden="true"
            ></span>
            <span>Unsaved</span>
          </span>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <!-- When editing existing template: Delete Button -->
          <button
            v-if="editingId"
            type="button"
            class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark border border-surface-border text-slate-300 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 text-xs font-medium transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('delete')"
          >
            Delete
          </button>

          <!-- When editing existing template: Revert Button -->
          <button
            v-if="editingId"
            type="button"
            :disabled="!isDirty"
            class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:border-surface-border flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            title="Revert modifications to saved version"
            @click="$emit('revert')"
          >
            <Icon name="ri:restart-line" class="text-xs" aria-hidden="true" />
            <span>Revert</span>
          </button>

          <!-- When creating new template: Cancel Button -->
          <button
            v-else
            type="button"
            class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('cancel')"
          >
            Cancel
          </button>

          <button
            type="button"
            :disabled="!promptName || !promptText"
            class="px-3.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="$emit('save')"
          >
            {{ editingId ? 'Update Prompt' : 'Save Prompt' }}
          </button>
        </div>
      </div>

      <!-- Row 1: Prompt Name -->
      <div class="flex flex-col gap-1.5">
        <label class="text-xs font-semibold text-slate-300">
          Prompt Name
        </label>
        <input
          :value="promptName"
          type="text"
          placeholder="e.g. Comedy Podcast Hooks"
          class="w-full bg-surface-dark border border-surface-border hover:border-slate-600 text-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 transition-colors text-xs font-medium placeholder-slate-500"
          @input="onNameInput"
        />
      </div>

      <!-- Row 2: Suitable For Tags -->
      <div class="flex flex-col gap-1.5 relative">
        <label class="text-xs font-semibold text-slate-300">
          Suitable For
        </label>
        <div class="flex items-center gap-1.5 flex-wrap min-h-[34px]">
          <span
            v-for="(tag, index) in suitableFor"
            :key="index"
            class="bg-surface-dark border border-surface-border text-slate-200 text-xs font-medium px-2.5 py-1 flex items-center gap-1.5 select-none"
          >
            <span class="text-accent-500 font-semibold">#</span>
            <span class="max-w-[160px] truncate">{{ tag }}</span>
            <button
              type="button"
              :aria-label="`Remove tag ${tag}`"
              class="text-slate-400 hover:text-red-300 transition-colors p-0.5 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              @click="$emit('remove-tag', index)"
            >
              <Icon name="ri:close-line" class="text-xs" aria-hidden="true" />
            </button>
          </span>

          <!-- + Add Tag Trigger Button & Popover -->
          <PromptTagPopover
            :suggested-tags="suggestedTags"
            @add-tag="$emit('add-tag', $event)"
          />
        </div>
      </div>

      <!-- Row 3: Content Style Editor Canvas -->
      <div class="flex flex-col gap-1.5 flex-1 min-h-[420px]">
        <label class="text-xs font-semibold text-slate-300">
          Prompt Instructions
        </label>
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
