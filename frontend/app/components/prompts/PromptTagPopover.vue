<template>
  <div ref="tagPopoverRef" class="relative">
    <button
      type="button"
      class="px-2.5 py-1 bg-surface-dark hover:bg-surface-card border border-dashed border-surface-border hover:border-accent-500/60 text-slate-300 hover:text-accent-400 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
      :class="{
        'border-accent-500 text-accent-400 bg-accent-500/10': isTagPopoverOpen
      }"
      @click.stop="openTagPopover"
    >
      <Icon name="ri:add-line" class="text-xs" aria-hidden="true" />
      <span>Tag</span>
    </button>

    <!-- Floating Popover -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isTagPopoverOpen"
        class="absolute top-full left-0 mt-1.5 w-64 bg-surface-panel border border-surface-border p-2.5 z-50 text-left"
        @click.stop
      >
        <div
          class="text-xs font-semibold text-slate-300 mb-1.5 px-0.5 flex items-center justify-between"
        >
          <span>Add Tags</span>
          <button
            type="button"
            aria-label="Close tag popover"
            class="text-slate-400 hover:text-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
            @click="isTagPopoverOpen = false"
          >
            <Icon name="ri:close-line" class="text-xs" aria-hidden="true" />
          </button>
        </div>

        <div
          class="flex items-center gap-1.5 bg-surface-dark border border-surface-border px-2 py-1.5 focus-within:border-accent-500 transition-colors"
        >
          <Icon
            name="ri:hashtag"
            class="text-accent-500 text-xs shrink-0"
            aria-hidden="true"
          />
          <input
            ref="tagInputRef"
            v-model="newTagInput"
            type="text"
            aria-label="New tag name"
            placeholder="Tag name (Enter to add)"
            class="w-full bg-transparent text-white text-xs focus:outline-none placeholder-slate-500"
            @keydown.enter.prevent="addTagFromInput"
            @keydown.esc="isTagPopoverOpen = false"
          />
          <button
            v-if="newTagInput.trim()"
            type="button"
            class="px-2 py-0.5 bg-accent-500 text-black text-[11px] font-bold hover:bg-accent-400 transition-colors shrink-0 cursor-pointer"
            @click="addTagFromInput"
          >
            Add
          </button>
        </div>

        <!-- Available Tag Suggestions from existing prompts -->
        <div
          v-if="suggestedTags.length > 0"
          class="mt-2 pt-2 border-t border-surface-border/60 flex flex-col gap-1.5"
        >
          <span class="text-[11px] font-medium text-slate-400 px-0.5"
            >Suggested</span
          >
          <div
            class="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar"
          >
            <button
              v-for="st in suggestedTags"
              :key="st"
              type="button"
              class="text-[11px] bg-surface-dark hover:bg-accent-500/15 hover:text-accent-400 border border-surface-border px-2 py-0.5 text-slate-300 transition-colors cursor-pointer select-none"
              @click="addSuggested(st)"
            >
              + {{ st }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';

interface Props {
  suggestedTags?: string[];
}

withDefaults(defineProps<Props>(), {
  suggestedTags: () => []
});

const emit = defineEmits<{
  'add-tag': [tag: string];
}>();

const isTagPopoverOpen = ref(false);
const newTagInput = ref('');
const tagInputRef = ref<HTMLInputElement | null>(null);
const tagPopoverRef = ref<HTMLElement | null>(null);

function openTagPopover() {
  isTagPopoverOpen.value = !isTagPopoverOpen.value;
  if (isTagPopoverOpen.value) {
    nextTick(() => {
      tagInputRef.value?.focus();
    });
  }
}

function closeTagPopover() {
  isTagPopoverOpen.value = false;
}

function addTagFromInput() {
  const val = newTagInput.value.trim();
  if (!val) return;
  const tagsToAdd = val
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  for (const t of tagsToAdd) {
    emit('add-tag', t);
  }
  newTagInput.value = '';
  nextTick(() => {
    tagInputRef.value?.focus();
  });
}

function addSuggested(tag: string) {
  emit('add-tag', tag);
}

function handleClickOutside(e: MouseEvent) {
  if (tagPopoverRef.value && !tagPopoverRef.value.contains(e.target as Node)) {
    isTagPopoverOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

defineExpose({
  isTagPopoverOpen,
  openTagPopover,
  closeTagPopover
});
</script>
