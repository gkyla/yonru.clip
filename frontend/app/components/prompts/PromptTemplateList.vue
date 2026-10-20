<template>
  <aside
    class="w-full lg:w-[290px] lg:sticky lg:top-2 flex flex-col gap-3 shrink-0 self-start"
  >
    <div
      class="bg-surface-panel border border-surface-border rounded-2xl p-3 sm:p-3.5 flex flex-col gap-3 shadow-xl"
    >
      <!-- Search bar -->
      <div class="relative w-full">
        <input
          :value="searchQuery"
          type="text"
          placeholder="Search prompts..."
          class="w-full bg-surface-dark border border-surface-border text-white pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all text-xs font-medium placeholder-slate-500"
          @input="onSearchInput"
        />
        <Icon
          name="ri:search-2-line"
          class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm"
        />
        <button
          v-if="searchQuery"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
          @click="clearSearch"
        >
          <Icon name="ri:close-circle-fill" class="text-xs" />
        </button>
      </div>

      <!-- Prompts Count Subheader -->
      <div
        class="flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-widest text-slate-500"
      >
        <span>Templates</span>
        <span class="text-[9px] text-slate-600 font-mono font-normal"
          >{{ filteredPrompts.length }} items</span
        >
      </div>

      <!-- Scrollable List of Templates -->
      <div
        class="flex flex-col gap-1.5 max-h-[560px] overflow-y-auto custom-scrollbar p-0.5 w-full"
      >
        <div
          v-if="filteredPrompts.length === 0"
          class="text-center py-8 text-xs text-slate-500 italic"
        >
          No templates match the criteria.
        </div>
        <button
          v-for="p in filteredPrompts"
          v-else
          :key="p.id"
          class="w-full text-left rounded-xl p-3 cursor-pointer transition-all flex flex-col gap-1.5 group select-none relative outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-500/50"
          :class="
            selectedId === p.id
              ? 'bg-accent-500/10 border border-accent-500/30 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-surface-dark/70 border border-transparent bg-surface-dark/40'
          "
          @click="onSelect(p)"
        >
          <!-- Active Indicator Bar -->
          <div
            v-if="selectedId === p.id"
            class="absolute left-0 top-2.5 bottom-2.5 w-1 bg-accent-500 rounded-r"
          ></div>

          <div class="flex justify-between items-center w-full gap-2 pl-0.5">
            <span
              class="font-bold text-xs truncate transition-colors"
              :class="
                selectedId === p.id
                  ? 'text-white'
                  : 'text-slate-300 group-hover:text-white'
              "
            >
              {{ p.name }}
            </span>
            <Icon
              name="ri:checkbox-circle-fill"
              class="text-accent-500 text-xs shrink-0 transition-opacity"
              :class="selectedId === p.id ? 'opacity-100' : 'opacity-0'"
            />
          </div>

          <!-- Single-Line Compact Tags with Custom Tooltips & +N Badge -->
          <div
            v-if="p.suitableFor && p.suitableFor.length"
            class="flex items-center gap-1 overflow-hidden w-full pl-0.5"
          >
            <div
              v-for="tag in p.suitableFor.slice(0, 2)"
              :key="tag"
              class="group/tag relative inline-flex items-center shrink-0"
            >
              <span
                class="text-[9px] bg-black/40 border border-white/5 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold max-w-[80px] truncate shrink-0"
              >
                {{ tag }}
              </span>

              <!-- Custom Hover Tooltip -->
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-[#0a0c12] border border-slate-700/80 text-white text-[10px] font-mono font-bold rounded-lg shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9),0_0_15px_rgba(255,215,0,0.12)] opacity-0 group-hover/tag:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform translate-y-1 group-hover/tag:translate-y-0 flex items-center gap-0.5"
              >
                <span class="text-accent-500 font-black">#</span>
                <span>{{ tag }}</span>
                <div
                  class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0c12] border-b border-r border-slate-700/80 transform rotate-45"
                ></div>
              </div>
            </div>

            <!-- +N Badge with Custom Tooltip showing remaining tags -->
            <div
              v-if="p.suitableFor.length > 2"
              class="group/more relative inline-flex items-center shrink-0"
            >
              <span
                class="text-[9px] bg-surface-dark border border-surface-border text-slate-500 px-1 py-0.5 rounded font-mono font-bold shrink-0"
              >
                +{{ p.suitableFor.length - 2 }}
              </span>

              <!-- Custom Tooltip showing hidden tags list -->
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-[#0a0c12] border border-slate-700/80 text-white text-[10px] font-mono font-bold rounded-lg shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9),0_0_15px_rgba(255,215,0,0.12)] opacity-0 group-hover/more:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform translate-y-1 group-hover/more:translate-y-0"
              >
                <span class="text-accent-500 font-black mr-1"
                  >+{{ p.suitableFor.length - 2 }} more:</span
                >
                <span class="text-slate-200 font-normal">{{
                  p.suitableFor
                    .slice(2)
                    .map((t: string) => `#${t}`)
                    .join(', ')
                }}</span>
                <div
                  class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0c12] border-b border-r border-slate-700/80 transform rotate-45"
                ></div>
              </div>
            </div>
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
