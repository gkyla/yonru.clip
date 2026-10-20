<template>
  <div ref="tagPopoverRef" class="relative">
    <button
      class="px-2.5 py-1 bg-surface-dark hover:bg-surface-panel border border-dashed border-surface-border hover:border-accent-500/50 text-slate-400 hover:text-accent-500 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer select-none"
      :class="{
        'border-accent-500 text-accent-500 bg-accent-500/10': isTagPopoverOpen
      }"
      @click.stop="openTagPopover"
    >
      <Icon name="ri:add-line" class="text-xs font-bold" />
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
        class="absolute top-full left-0 mt-1.5 w-64 bg-[#0f1117] border border-surface-border rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left"
        @click.stop
      >
        <div
          class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between"
        >
          <span>Add Tags</span>
          <button
            class="text-slate-500 hover:text-white cursor-pointer"
            @click="isTagPopoverOpen = false"
          >
            <Icon name="ri:close-line" class="text-xs" />
          </button>
        </div>

        <div
          class="flex items-center gap-1.5 bg-surface-dark border border-surface-border rounded-lg px-2 py-1.5 focus-within:border-accent-500/60 transition-colors"
        >
          <Icon name="ri:hashtag" class="text-accent-500 text-xs shrink-0" />
          <input
            ref="tagInputRef"
            v-model="newTagInput"
            type="text"
            placeholder="Tag name (Enter to add)"
            class="w-full bg-transparent text-white text-xs focus:outline-none placeholder-slate-500"
            @keydown.enter.prevent="addTagFromInput"
            @keydown.esc="isTagPopoverOpen = false"
          />
          <button
            v-if="newTagInput.trim()"
            class="px-2 py-0.5 bg-accent-500 text-black text-[10px] font-black rounded uppercase tracking-wider hover:bg-accent-400 transition-colors shrink-0 cursor-pointer"
            @click="addTagFromInput"
          >
            Add
          </button>
        </div>

        <!-- Available Tag Suggestions from existing prompts -->
        <div
          v-if="suggestedTags.length > 0"
          class="mt-2 pt-2 border-t border-surface-border/50 flex flex-col gap-1"
        >
          <span class="text-[9px] uppercase font-bold text-slate-500 px-1"
            >Suggested</span
          >
          <div
            class="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar px-1"
          >
            <button
              v-for="st in suggestedTags"
              :key="st"
              class="text-[10px] bg-white/5 hover:bg-accent-500/20 hover:text-accent-400 border border-white/5 px-2 py-0.5 rounded text-slate-300 transition-colors cursor-pointer select-none"
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
