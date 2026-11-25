<template>
  <aside
    class="w-full min-w-0 lg:w-[290px] lg:sticky lg:top-2 flex flex-col gap-3 shrink-0 self-start"
  >
    <div
      class="bg-surface-panel border border-surface-border p-3 sm:p-3.5 flex flex-col gap-3"
    >
      <!-- Search bar -->
      <div class="relative w-full">
        <input
          :value="searchQuery"
          type="text"
          aria-label="Search prompts"
          placeholder="Search prompts..."
          class="w-full bg-surface-dark border border-surface-border hover:border-slate-600 text-white pl-9 pr-8 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 transition-colors text-xs font-medium placeholder-slate-500"
          @input="onSearchInput"
        />
        <Icon
          name="ri:search-2-line"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"
          aria-hidden="true"
        />
        <button
          v-if="searchQuery"
          type="button"
          aria-label="Clear search"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          @click="clearSearch"
        >
          <Icon
            name="ri:close-circle-fill"
            class="text-xs"
            aria-hidden="true"
          />
        </button>
      </div>

      <!-- Prompts Count Subheader -->
      <div
        class="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400"
      >
        <span>Templates</span>
        <span class="text-[11px] text-slate-400 font-mono font-normal"
          >{{ filteredPrompts.length }} items</span
        >
      </div>

      <!-- Scrollable List of Templates -->
      <div
        class="flex flex-col gap-1.5 max-h-[560px] overflow-y-auto custom-scrollbar w-full"
      >
        <div
          v-if="filteredPrompts.length === 0"
          class="text-center py-8 text-xs text-slate-400"
        >
          No templates match your search.
        </div>
        <button
          v-for="p in filteredPrompts"
          v-else
          :key="p.id"
          type="button"
          :aria-current="selectedId === p.id ? 'page' : undefined"
          class="w-full text-left px-2.5 py-2 [@media(pointer:coarse)]:min-h-[44px] cursor-pointer transition-colors flex flex-col gap-1 group select-none border-l-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-[-2px]"
          :class="
            selectedId === p.id
              ? 'border-accent-500 bg-surface-dark/70 text-white'
              : 'border-transparent text-slate-300 hover:text-white hover:bg-surface-dark/40'
          "
          @click="onSelect(p)"
        >
          <div class="flex justify-between items-center w-full gap-2">
            <span
              class="font-semibold text-[13px] truncate leading-snug transition-colors"
              :class="
                selectedId === p.id
                  ? 'text-white'
                  : 'text-slate-100 group-hover:text-white'
              "
            >
              {{ p.name }}
            </span>
            <Icon
              name="ri:checkbox-circle-fill"
              class="text-accent-500 text-xs shrink-0 transition-opacity"
              :class="selectedId === p.id ? 'opacity-100' : 'opacity-0'"
              aria-hidden="true"
            />
          </div>

          <!-- Borderless Tag Row with # Prefix + Middle Dots -->
          <div
            v-if="p.suitableFor && p.suitableFor.length"
            class="flex items-center gap-1 min-w-0 text-[11px] text-slate-400 leading-snug"
          >
            <span
              aria-hidden="true"
              class="font-semibold shrink-0 transition-colors"
              :class="
                selectedId === p.id
                  ? 'text-accent-500/80'
                  : 'text-slate-500 group-hover:text-slate-400'
              "
              >#</span
            >
            <span class="min-w-0 flex items-center overflow-hidden">
              <template
                v-for="(tag, idx) in p.suitableFor.slice(0, 2)"
                :key="tag"
              >
                <span
                  v-if="idx > 0"
                  aria-hidden="true"
                  class="mx-1.5 w-[3px] h-[3px] rounded-full bg-slate-400 shrink-0"
                ></span>
                <span class="truncate">{{ tag }}</span>
              </template>
            </span>

            <span
              v-if="p.suitableFor.length > 2"
              :title="p.suitableFor.slice(2).join(', ')"
              class="text-slate-500 shrink-0"
            >
              +{{ p.suitableFor.length - 2 }}
            </span>
          </div>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface PromptTemplateItem {
  id: string;
  name: string;
  suitableFor?: string[];
  prompt?: string;
  numHooks?: number;
  autoHooks?: boolean;
}

interface Props {
  prompts: PromptTemplateItem[];
  selectedId: string | null;
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: ''
});

const emit = defineEmits<{
  'update:searchQuery': [val: string];
  select: [prompt: PromptTemplateItem];
}>();

const filteredPrompts = computed(() => {
  const query = (props.searchQuery || '').toLowerCase();
  return (props.prompts || []).filter((p: PromptTemplateItem) => {
    return (p.name || '').toLowerCase().includes(query);
  });
});

function onSearchInput(e: Event) {
  emit('update:searchQuery', (e.target as HTMLInputElement).value);
}

function clearSearch() {
  emit('update:searchQuery', '');
}

function onSelect(prompt: PromptTemplateItem) {
  emit('select', prompt);
}

defineExpose({
  filteredPrompts
});
</script>
