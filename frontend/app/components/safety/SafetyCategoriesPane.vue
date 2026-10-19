<template>
  <div class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar min-h-0">
    <!-- Warning if Custom Only mode is active -->
    <div
      v-if="state.safetySensitivity.value === 'manual'"
      class="flex flex-col items-center justify-center text-center p-5 border border-dashed border-accent-500/20 rounded-2xl bg-accent-500/[0.02]"
    >
      <Icon
        name="ri:information-line"
        class="text-2xl text-accent-400 mb-1.5"
      />
      <h4 class="text-xs font-black text-slate-200 uppercase tracking-wider">
        Kategori Bawaan Sedang Dinonaktifkan
      </h4>
      <p class="text-xs text-slate-400 mt-1 max-w-[340px] leading-relaxed">
        Filter Scope saat ini disetel ke <b>Custom Only</b>. Hanya kata-kata di
        tab Blacklist Kustom yang difilter.
      </p>
      <button
        class="mt-3 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all"
        @click="
          state.safetySensitivity.value = 'standard';
          state.saveBlacklistToStorage();
        "
      >
        Aktifkan Kategori (Beralih ke Standard)
      </button>
    </div>

    <!-- Category Toggles & Words -->
    <div v-else class="space-y-4">
      <!-- 3 Category Checkboxes -->
      <div>
        <span
          class="text-xs text-slate-400 font-black uppercase tracking-widest block mb-2"
          >Kategori Aktif</span
        >
        <div class="grid grid-cols-3 gap-2">
          <div
            v-for="(val, cat) in state.activeCategories.value"
            :key="cat"
            class="p-2.5 border rounded-xl transition-all duration-300 flex items-center justify-between cursor-pointer"
            :class="
              val
                ? 'bg-white/[0.03] border-accent-500/30'
                : 'bg-white/[0.01] border-white/5 opacity-60'
            "
            @click="
              state.activeCategories.value[cat] =
                !state.activeCategories.value[cat];
              state.saveBlacklistToStorage();
            "
          >
            <div class="flex items-center gap-1.5 min-w-0">
              <Icon
                :name="
                  cat === 'violence'
                    ? 'ri:skull-line'
                    : cat === 'sexual'
                      ? 'ri:hearts-line'
                      : 'ri:chat-voice-line'
                "
                class="text-xs flex-shrink-0"
                :class="val ? 'text-accent-500' : 'text-slate-500'"
              />
              <span
                class="text-xs font-bold uppercase tracking-wide text-slate-200 truncate"
                >{{ cat }}</span
              >
            </div>
            <input
              type="checkbox"
              :checked="val"
              class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
              @click.stop
              @change="
                state.activeCategories.value[cat] = $event.target.checked;
                state.saveBlacklistToStorage();
              "
            />
          </div>
        </div>
      </div>

      <!-- Expanded Category Words -->
      <div class="space-y-3">
        <div v-for="(val, cat) in state.activeCategories.value" :key="cat">
          <div
            v-if="val && state.categorizedBlacklist?.value?.[cat]"
            class="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-2.5"
          >
            <!-- Category Header -->
            <div class="flex items-center justify-between">
              <span
                class="text-xs text-accent-400 font-bold uppercase tracking-wider flex items-center gap-1.5"
              >
                <span class="capitalize">{{ cat }}</span>
                <span class="text-[10px] text-slate-500 font-mono font-normal"
                  >({{ getCategoryWords(cat).length }} kata)</span
                >
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  v-if="editingCategory === cat"
                  class="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                  @click="resetCategoryToDefault(cat)"
                >
                  <Icon name="ri:restart-line" class="text-xs" />
                  Reset
                </button>
                <button
                  class="px-2.5 py-0.5 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-slate-300 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                  @click="
                    editingCategory = editingCategory === cat ? null : cat
                  "
                >
                  <Icon
                    :name="
                      editingCategory === cat ? 'ri:check-line' : 'ri:edit-line'
                    "
                    class="text-xs"
                  />
                  {{ editingCategory === cat ? 'Done' : 'Edit' }}
                </button>
              </div>
            </div>

            <!-- Inline Add Input in Edit Mode -->
            <div v-if="editingCategory === cat" class="flex gap-1.5">
              <input
                v-model="newCategoryWord"
                type="text"
                placeholder="Tambahkan kata (pisahkan koma jika banyak)..."
                class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-accent-500 transition-colors font-medium"
                @keyup.enter="addCategoryWord(cat)"
              />
              <button
                :disabled="!newCategoryWord.trim()"
                class="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-30 text-black font-black text-xs rounded-xl transition-all flex-shrink-0"
                @click="addCategoryWord(cat)"
              >
                Add
              </button>
            </div>

            <!-- Compact Chips Container -->
            <div
              class="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar"
            >
              <span
                v-for="word in getCategoryWords(cat)"
                :key="word"
                class="px-2 py-0.5 bg-black/40 border border-white/5 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-colors flex items-center gap-1 group/badge"
              >
                {{ word }}
                <button
                  v-if="editingCategory === cat"
                  class="text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center ml-0.5"
                  title="Hapus kata"
                  @click="deleteCategoryWord(cat, word)"
                >
                  <Icon name="ri:close-line" class="text-xs" />
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  DEFAULT_CATEGORIZED_BLACKLIST,
  SEVERE_WORDS
} from '../../utils/safetyEngine';

const props = defineProps({
  state: {
    type: Object,
    default: () => useClipperState()
  }
});

const state = props.state;

const editingCategory = ref(null);
const newCategoryWord = ref('');

function getCategoryWords(cat) {
  const allWords = state.categorizedBlacklist.value[cat] || [];
  if (state.safetySensitivity.value === 'standard') {
    const defaultSet = new Set(DEFAULT_CATEGORIZED_BLACKLIST[cat]);
    return allWords.filter(word => {
      const clean =
        word.startsWith('/') && word.endsWith('/') ? word.slice(1, -1) : word;
      const isSevere = SEVERE_WORDS.has(clean.toLowerCase().trim());
      const isUserAdded = !defaultSet.has(word);
      return isSevere || isUserAdded;
    });
  }
  return allWords;
}

function addCategoryWord(cat) {
  if (!newCategoryWord.value.trim()) return;
  const tokens = newCategoryWord.value
    .split(/[,;\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return;

  let added = false;
  for (const token of tokens) {
    if (!state.categorizedBlacklist.value[cat].includes(token)) {
      state.categorizedBlacklist.value[cat].push(token);
      added = true;
    }
  }
  if (added) state.saveBlacklistToStorage();
  newCategoryWord.value = '';
}

function deleteCategoryWord(cat, word) {
  state.categorizedBlacklist.value[cat] = state.categorizedBlacklist.value[
    cat
  ].filter(w => w !== word);
  state.saveBlacklistToStorage();
}

function resetCategoryToDefault(cat) {
  if (confirm(`Reset ${cat} category to default word list?`)) {
    state.categorizedBlacklist.value[cat] = [
      ...DEFAULT_CATEGORIZED_BLACKLIST[cat]
    ];
    state.saveBlacklistToStorage();
  }
}
</script>
