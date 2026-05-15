<template>
  <div v-if="state" class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-black text-white italic tracking-tighter uppercase">Safety Filter Settings</h3>
        <p class="text-xs text-slate-500 font-medium">Manage keywords that trigger TikTok shadowban warnings.</p>
      </div>
      <button @click="$emit('close')" class="w-8 h-8 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center text-slate-400 hover:text-white transition-colors">
        <Icon name="ri:close-line" />
      </button>
    </div>

    <!-- Add New Word -->
    <div class="space-y-3">
      <label class="text-[10px] text-slate-500 font-black uppercase tracking-widest block">Add New Keyword</label>
      <div class="flex gap-2">
        <div class="relative flex-1 group">
           <input 
             v-model="newWord" 
             @keyup.enter="addWord"
             type="text" 
             placeholder="e.g. gambling, blood" 
             class="w-full bg-surface-dark border border-surface-border/50 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none transition-all pr-10"
           />
           <Icon name="ri:filter-3-line" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
        </div>
        <button 
          @click="addWord"
          :disabled="!newWord.trim()"
          class="px-5 bg-accent-500 hover:bg-accent-400 text-black font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(207,255,80,0.2)] disabled:opacity-30 disabled:shadow-none"
        >
          Add
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Blacklist ({{ state.customBlacklist.value.length }})</label>
        <button 
          v-if="state.customBlacklist.value.length > 0"
          @click="resetBlacklist" 
          class="text-[9px] text-slate-600 hover:text-rose-500 font-bold uppercase tracking-widest transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
      
      <div class="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 space-y-2">
        <TransitionGroup 
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 -translate-x-4"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-4"
        >
          <div 
            v-for="word in state.customBlacklist.value" :key="word"
            class="flex items-center justify-between p-3 bg-surface-card/50 border border-surface-border rounded-xl group hover:border-accent-500/30 transition-all"
          >
            <div class="flex items-center gap-3">
               <div class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
               <span class="text-sm font-bold text-slate-200">{{ word }}</span>
            </div>
            <button 
              @click="removeWord(word)"
              class="w-7 h-7 rounded-lg hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
            >
              <Icon name="ri:delete-bin-line" class="text-sm" />
            </button>
          </div>
        </TransitionGroup>

        <div v-if="state.customBlacklist.value.length === 0" class="py-12 flex flex-col items-center justify-center text-center opacity-40">
           <Icon name="ri:ghost-line" class="text-4xl mb-3" />
           <p class="text-xs font-bold uppercase tracking-widest text-slate-400">Blacklist is empty</p>
        </div>
      </div>
    </div>

    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4">
       <Icon name="ri:information-line" class="text-xl text-blue-400 flex-shrink-0" />
       <p class="text-[11px] text-blue-300 leading-relaxed">
         <b>Pro Tip:</b> Content with flagged keywords is often <b>de-prioritized</b> by the TikTok algorithm. Use this tool to catch sensitive words before rendering to ensure your clip reaches the maximum audience.
       </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const state = useClipperState()
const newWord = ref('')

defineEmits(['close'])

function addWord() {
  if (!newWord.value.trim()) return
  const word = newWord.value.trim().toLowerCase()
  if (!state.customBlacklist.value.includes(word)) {
    state.customBlacklist.value.push(word)
    state.saveBlacklistToStorage()
  }
  newWord.value = ''
}

function removeWord(word) {
  state.customBlacklist.value = state.customBlacklist.value.filter(w => w !== word)
  state.saveBlacklistToStorage()
}

function resetBlacklist() {
  if (confirm('Reset blacklist to default TikTok sensitive words?')) {
    state.customBlacklist.value = [...state.DEFAULT_BLACKLIST]
    state.saveBlacklistToStorage()
  }
}
</script>
