<template>
  <div
    v-if="state"
    class="p-5 md:p-6 space-y-4 bg-[#0e0e12] border border-white/10 rounded-3xl text-white h-[600px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] shadow-black/80 w-full max-w-2xl mx-auto"
  >
    <!-- Modal Header -->
    <div
      class="flex items-center justify-between border-b border-white/5 pb-4 flex-shrink-0"
    >
      <div>
        <h3
          class="text-base font-black text-white tracking-tight uppercase flex items-center gap-2"
        >
          <Icon name="ri:shield-keyhole-line" class="text-accent-500 text-lg" />
          Content Safety Configuration
        </h3>
        <p class="text-xs text-slate-500 font-medium mt-0.5">
          Configure detection scope, censoring styles, and word blacklists.
        </p>
      </div>
      <button
        aria-label="Close settings"
        class="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        @click="$emit('close')"
      >
        <Icon name="ri:close-line" class="text-base" />
      </button>
    </div>

    <!-- Top-Level Tab Navigation -->
    <div
      class="grid grid-cols-4 gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-2xl flex-shrink-0"
    >
      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'general'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'general'"
      >
        <Icon name="ri:sound-module-line" class="text-xs" />
        <span class="truncate">General</span>
      </button>

      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'categories'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'categories'"
      >
        <Icon name="ri:apps-2-line" class="text-xs" />
        <span class="truncate">Categories</span>
      </button>

      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'blacklist'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'blacklist'"
      >
        <Icon name="ri:forbid-2-line" class="text-xs" />
        <span class="truncate">Blacklist</span>
        <span
          v-if="state.customBlacklist?.value?.length"
          class="px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-rose-500/20 text-rose-300 font-bold ml-0.5"
        >
          {{ state.customBlacklist.value.length }}
        </span>
      </button>

      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'whitelist'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'whitelist'"
      >
        <Icon name="ri:checkbox-circle-line" class="text-xs" />
        <span class="truncate">Whitelist</span>
        <span
          v-if="state.customWhitelist?.value?.length"
          class="px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-emerald-500/20 text-emerald-300 font-bold ml-0.5"
        >
          {{ state.customWhitelist.value.length }}
        </span>
      </button>
    </div>

    <!-- Dynamic Content Panes -->
    <SafetyGeneralPane v-if="activeTab === 'general'" :state="state" />

    <SafetyCategoriesPane
      v-else-if="activeTab === 'categories'"
      :state="state"
    />

    <SafetyBlacklistPane v-else-if="activeTab === 'blacklist'" :state="state" />

    <SafetyWhitelistPane v-else-if="activeTab === 'whitelist'" :state="state" />

    <!-- Subtle Modal Footer -->
    <div
      class="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0"
    >
      <span class="flex items-center gap-1">
        <Icon name="ri:information-line" class="text-accent-500/80 text-xs" />
        Semua perubahan kata disinkronkan otomatis ke penyimpanan lokal.
      </span>
      <span class="text-[10px] font-mono text-slate-600 hidden sm:inline"
        >ESC untuk menutup</span
      >
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import SafetyGeneralPane from './safety/SafetyGeneralPane.vue';
import SafetyCategoriesPane from './safety/SafetyCategoriesPane.vue';
import SafetyBlacklistPane from './safety/SafetyBlacklistPane.vue';
import SafetyWhitelistPane from './safety/SafetyWhitelistPane.vue';

const props = defineProps({
  state: {
    type: Object,
    default: () => useClipperState()
  }
});

const state = props.state;
const activeTab = ref('general');

const emit = defineEmits(['close']);

// Keyboard Escape listener
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  if (state && state.loadBlacklistFromStorage) {
    state.loadBlacklistFromStorage();
  }
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
