<template>
  <div
    class="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0 flex flex-col"
  >
    <!-- Add Whitelist Input Bar (With Comma Multi-Word Support) -->
    <div class="flex gap-2 flex-shrink-0">
      <div class="relative flex-1 group">
        <input
          v-model="newWord"
          type="text"
          placeholder="Tambah pengecualian (e.g. killing, blood)..."
          class="w-full bg-black/40 border border-white/10 group-hover:border-white/20 focus:border-accent-500 rounded-xl px-3.5 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
          @keyup.enter="addWord"
        />
        <Icon
          name="ri:add-circle-line"
          class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </div>
      <button
        :disabled="!newWord.trim()"
        class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-wider rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500 flex-shrink-0"
        @click="addWord"
      >
        Add
      </button>
    </div>

    <!-- Search Whitelist Input -->
    <div class="relative group flex-shrink-0">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Cari pengecualian whitelist..."
        class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
      />
      <Icon
        name="ri:search-2-line"
        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs"
      />
    </div>

    <!-- High-Density Tag Grid Scroller -->
    <div
      class="flex-1 min-h-[160px] p-3 bg-black/30 border border-white/5 rounded-2xl overflow-y-auto custom-scrollbar"
    >
      <div
        v-if="filteredWords.length > 0"
        class="flex flex-wrap gap-1.5 content-start"
      >
        <span
          v-for="word in filteredWords"
          :key="word"
          class="px-2.5 py-1 bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1.5 group/chip transition-all"
        >
          <span
            class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
          ></span>
          <span>{{ word }}</span>
          <button
            class="text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center ml-0.5"
            title="Hapus pengecualian"
            @click="removeWord(word)"
          >
            <Icon name="ri:close-line" class="text-xs" />
          </button>
        </span>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="h-full min-h-[160px] flex flex-col items-center justify-center text-center opacity-40"
      >
        <Icon
          name="ri:checkbox-circle-line"
          class="text-2xl mb-1 text-slate-500"
        />
        <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
          Daftar Whitelist Kosong
        </p>
        <span class="text-[10px] text-slate-500 mt-0.5"
          >Kata di whitelist tidak akan difilter atau dibleep pada audio.</span
        >
      </div>
    </div>

    <!-- Footer Action -->
    <div
      class="flex justify-between items-center pt-2 border-t border-white/5 flex-shrink-0"
    >
      <span class="text-xs text-slate-500"
        >Total Pengecualian: {{ state.customWhitelist.value.length }} kata</span
      >
      <button
        class="text-xs text-slate-500 hover:text-rose-400 font-bold tracking-wider transition-colors"
        @click="resetList"
      >
        Bersihkan Semua
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  state: {
    type: Object,
    default: () => useClipperState()
  }
});

const state = props.state;

const newWord = ref('');
const searchQuery = ref('');

function addWord() {
  if (!newWord.value.trim()) return;
  const tokens = newWord.value
    .split(/[,;\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return;

  let added = false;
  for (const token of tokens) {
    if (!state.customWhitelist.value.includes(token)) {
      state.customWhitelist.value.push(token);
      added = true;
    }
  }
  if (added) state.saveBlacklistToStorage();
  newWord.value = '';
}

function removeWord(word) {
  state.customWhitelist.value = state.customWhitelist.value.filter(
    w => w !== word
  );
  state.saveBlacklistToStorage();
}

const filteredWords = computed(() => {
  const list = state.customWhitelist.value || [];
  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.trim().toLowerCase();
  return list.filter(w => w.toLowerCase().includes(q));
});

function resetList() {
  if (
    confirm('Are you sure you want to clear all custom whitelist exceptions?')
  ) {
    state.customWhitelist.value = [];
    state.saveBlacklistToStorage();
  }
}
</script>
