<template>
  <div v-if="state" class="p-6 space-y-6 bg-[#0e0e12] border border-white/5 rounded-3xl text-white">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/5 pb-4">
      <div>
        <h3 class="text-base font-black text-white tracking-tight uppercase flex items-center gap-2">
          <Icon name="ri:shield-keyhole-line" class="text-accent-500" />
          Content Safety Configuration
        </h3>
        <p class="text-xs text-slate-500 font-medium">Configure censoring sensitivity, platform overlays, and word blacklists.</p>
      </div>
      <button @click="$emit('close')" class="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors">
        <Icon name="ri:close-line" />
      </button>
    </div>

    <!-- 2-Column Responsive Layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[380px]">
      
      <!-- COLUMN 1: Engine Controls & Platform Filters -->
      <div class="space-y-5 border-r border-white/5 pr-0 md:pr-6">
        
        <!-- 1. Safety Sensitivity Level -->
        <div class="space-y-2">
          <label class="text-xs text-slate-500 font-black uppercase tracking-widest block">Safety Sensitivity</label>
          <div class="grid grid-cols-3 gap-1.5 p-1 bg-white/[0.02] border border-white/5 rounded-xl">
            <button 
              v-for="level in ['conservative', 'moderate', 'relaxed']" 
              :key="level"
              @click="state.safetySensitivity.value = level; state.saveBlacklistToStorage()"
              class="py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all"
              :class="state.safetySensitivity.value === level 
                ? 'bg-accent-500 text-black shadow-[0_0_12px_rgba(207,255,80,0.3)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'"
            >
              {{ level }}
            </button>
          </div>
          <p class="text-xs text-slate-500 leading-relaxed italic">
            {{ 
              state.safetySensitivity.value === 'conservative' 
                ? 'Censors all possible slang & profanity. Highly advertiser-friendly.' :
              state.safetySensitivity.value === 'moderate'
                ? 'Standard filter targeting critical shadowban keywords.'
                : 'Only filters words you manually add to your custom blacklist.'
            }}
          </p>
        </div>

        <!-- 2. Auto-Masking Censorship Style -->
        <div class="space-y-2">
          <label class="text-xs text-slate-500 font-black uppercase tracking-widest block">Auto-Fix Masking Style</label>
          <div class="relative group">
            <select 
              v-model="state.maskingStyle.value"
              @change="state.saveBlacklistToStorage()"
              class="w-full bg-white/[0.02] border border-white/5 focus:border-accent-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none transition-all appearance-none cursor-pointer pr-10"
            >
              <option value="asterisk">Asterisks (e.g. k*lling)</option>
              <option value="block">Full Block (e.g. *******)</option>
              <option value="bleep_marker">Bleep Tag (e.g. [BLEEP])</option>
            </select>
            <Icon name="ri:arrow-down-s-line" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>



        <!-- 4. Guidelines & Audio Options -->
        <div class="space-y-3 pt-2 border-t border-white/5">
          <!-- Audio Bleep option -->
          <label class="flex items-center justify-between cursor-pointer group">
            <div class="flex flex-col">
              <span class="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Icon name="ri:volume-mute-line" class="text-xs text-accent-500" />
                Mute/Bleep Audio
              </span>
              <span class="text-xs text-slate-500 mt-0.5">Bleep audio during final video render</span>
            </div>
            <input 
              type="checkbox" 
              v-model="state.audioBleepEnabled.value"
              class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-4 h-4 cursor-pointer"
            />
          </label>

          <!-- Guideline settings link / checkbox list -->
          <div class="space-y-2 pt-1">
            <span class="text-xs text-slate-500 font-bold uppercase tracking-wider block">Scan Layout Guidelines</span>
            <div class="flex flex-wrap gap-2">
              <label 
                v-for="platform in ['tiktok', 'reels', 'shorts']" 
                :key="platform"
                class="px-2.5 py-1 rounded-lg border text-xs font-black uppercase tracking-widest cursor-pointer select-none transition-colors flex items-center gap-1.5"
                :class="state.activePlatformFilters.value[platform]
                  ? 'bg-accent-500/10 border-accent-500/30 text-accent-500'
                  : 'bg-white/[0.01] border-white/5 text-slate-500'"
              >
                <input 
                  type="checkbox" 
                  v-model="state.activePlatformFilters.value[platform]"
                  class="hidden"
                />
                {{ platform }}
              </label>
            </div>
          </div>
        </div>

      </div>

      <!-- COLUMN 2: Keyword & Exception Lists -->
      <div class="flex flex-col space-y-4">
        
        <!-- Tab Selectors -->
        <div class="flex border-b border-white/5">
          <button 
            @click="activeTab = 'categories'"
            class="flex-1 pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors"
            :class="activeTab === 'categories' 
              ? 'border-accent-500 text-accent-500' 
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >
            Categories
          </button>
          <button 
            @click="activeTab = 'blacklist'"
            class="flex-1 pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors"
            :class="activeTab === 'blacklist' 
              ? 'border-accent-500 text-accent-500' 
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >
            Custom Blacklist
          </button>
          <button 
            @click="activeTab = 'whitelist'"
            class="flex-1 pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors"
            :class="activeTab === 'whitelist' 
              ? 'border-accent-500 text-accent-500' 
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >
            Whitelist
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 flex flex-col min-h-0">
          
          <!-- Tab 1: Categories -->
          <div v-if="activeTab === 'categories'" class="flex-1 flex flex-col space-y-4 min-h-0">
            <div class="space-y-3 flex-1 flex flex-col min-h-0">
              <span class="text-xs text-slate-500 font-black uppercase tracking-widest block">Categorized Filters</span>
              <div class="grid grid-cols-3 gap-2 shrink-0">
                <div 
                  v-for="(val, cat) in state.activeCategories.value" 
                  :key="cat"
                  class="p-2.5 bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 rounded-xl transition-colors flex flex-col gap-1.5"
                >
                  <label class="flex items-center justify-between cursor-pointer select-none">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <Icon 
                        :name="cat === 'violence' ? 'ri:skull-line' : cat === 'sexual' ? 'ri:hearts-line' : 'ri:chat-voice-line'" 
                        class="text-xs flex-shrink-0"
                        :class="val ? 'text-accent-500' : 'text-slate-600'" 
                      />
                      <span class="text-xs font-bold uppercase tracking-wide text-slate-300 truncate">{{ cat }}</span>
                    </div>
                    <input 
                      type="checkbox" 
                      v-model="state.activeCategories.value[cat]"
                      class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                    />
                  </label>
                </div>
              </div>

              <!-- Expanded Category Word Lists -->
              <div class="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[350px]">
                <div 
                  v-for="(val, cat) in state.activeCategories.value" 
                  :key="cat"
                >
                  <div 
                    v-if="val && state.categorizedBlacklist?.value?.[cat]"
                    class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-2"
                  >
                    <!-- Category Header with Edit and Reset buttons -->
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-accent-500 font-bold uppercase tracking-wider">{{ cat }} words ({{ state.categorizedBlacklist.value[cat].length }}):</span>
                      <div class="flex items-center gap-1.5">
                        <button 
                          v-if="editingCategory === cat"
                          @click="resetCategoryToDefault(cat)"
                          class="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs font-black uppercase tracking-wider flex items-center gap-0.5 transition-colors"
                        >
                          <Icon name="ri:restart-line" class="text-xs" />
                          Reset
                        </button>
                        <button 
                          @click="editingCategory = editingCategory === cat ? null : cat"
                          class="px-2 py-0.5 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-slate-400 border border-white/10 rounded text-xs font-black uppercase tracking-wider flex items-center gap-0.5 transition-colors"
                        >
                          <Icon :name="editingCategory === cat ? 'ri:check-line' : 'ri:edit-line'" class="text-xs" />
                          {{ editingCategory === cat ? 'Done' : 'Edit' }}
                        </button>
                      </div>
                    </div>

                    <!-- Add word inline input inside Category -->
                    <div v-if="editingCategory === cat" class="flex gap-1.5 mt-0.5">
                      <input 
                        v-model="newCategoryWord"
                        @keyup.enter="addCategoryWord(cat)"
                        type="text" 
                        placeholder="Add word..." 
                        class="flex-1 bg-white/[0.02] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-accent-500 transition-colors"
                      />
                      <button 
                        @click="addCategoryWord(cat)"
                        :disabled="!newCategoryWord.trim()"
                        class="px-2 py-1 bg-accent-500 hover:bg-accent-600 disabled:opacity-35 text-black font-black text-xs rounded transition-all flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    <!-- Word List Badges (with delete toggle in Edit Mode) -->
                    <div class="flex flex-wrap gap-1">
                      <span 
                        v-for="word in state.categorizedBlacklist.value[cat]" 
                        :key="word"
                        class="px-2 py-0.5 bg-white/[0.02] border border-white/5 rounded text-xs font-mono text-slate-400 hover:text-white transition-colors flex items-center gap-1 group/badge"
                      >
                        {{ word }}
                        <button 
                          v-if="editingCategory === cat"
                          @click="deleteCategoryWord(cat, word)"
                          class="text-slate-500 hover:text-rose-500 transition-colors flex items-center justify-center"
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

          <!-- Tab 2: Custom Blacklist -->
          <div v-if="activeTab === 'blacklist'" class="flex-1 flex flex-col space-y-3 min-h-0">
            <span class="text-xs text-slate-500 font-black uppercase tracking-widest block">Custom Blacklist Keywords</span>
            
            <!-- Add Word Box -->
            <div class="flex gap-2">
              <div class="relative flex-1 group">
                <input 
                  v-model="newWord" 
                  @keyup.enter="addWord"
                  type="text" 
                  placeholder="e.g. casino, badword" 
                  class="w-full bg-white/[0.02] border border-white/5 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
                />
                <Icon name="ri:add-circle-line" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <button 
                @click="addWord"
                :disabled="!newWord.trim()"
                class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500"
              >
                Add
              </button>
            </div>

            <!-- Search Word List -->
            <div class="relative group">
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Search custom words..."
                class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
              />
              <Icon name="ri:search-2-line" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs" />
            </div>

            <!-- Word List Scroller -->
            <div class="flex-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
              <TransitionGroup 
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-x-2"
                enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-x-0"
                leave-to-class="opacity-0 translate-x-2"
              >
                <div 
                  v-for="word in filteredWords" :key="word"
                  class="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-white/10 transition-all"
                >
                  <div class="flex items-center gap-2">
                     <div class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                     <span class="text-xs font-bold text-slate-200">{{ word }}</span>
                  </div>
                  <button 
                    @click="removeWord(word)"
                    class="w-6 h-6 rounded-md hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 transition-all flex items-center justify-center"
                  >
                    <Icon name="ri:delete-bin-line" class="text-xs" />
                  </button>
                </div>
              </TransitionGroup>

              <!-- Empty states -->
              <div v-if="filteredWords.length === 0" class="py-6 flex flex-col items-center justify-center text-center opacity-40">
                 <Icon name="ri:ghost-line" class="text-2xl mb-1 text-slate-500" />
                 <p class="text-xs font-bold uppercase tracking-widest text-slate-400">No custom words</p>
              </div>
            </div>

            <!-- Bottom Action Reset -->
            <div class="flex justify-between items-center pt-2 border-t border-white/5">
              <span class="text-xs text-slate-500">Total Custom: {{ state.customBlacklist.value.length }} words</span>
              <button 
                @click="resetList"
                class="text-xs text-slate-600 hover:text-rose-500 font-black uppercase tracking-widest transition-colors"
              >
                Clear Custom
              </button>
            </div>
          </div>

          <!-- Tab 3: Whitelist -->
          <div v-if="activeTab === 'whitelist'" class="flex-1 flex flex-col space-y-3 min-h-0">
            <!-- Add Word Box -->
            <div class="flex gap-2">
              <div class="relative flex-1 group">
                <input 
                  v-model="newWord" 
                  @keyup.enter="addWord"
                  type="text" 
                  placeholder="e.g. killing, blood" 
                  class="w-full bg-white/[0.02] border border-white/5 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
                />
                <Icon name="ri:add-circle-line" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <button 
                @click="addWord"
                :disabled="!newWord.trim()"
                class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500"
              >
                Add
              </button>
            </div>

            <!-- Search Word List -->
            <div class="relative group">
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Search exceptions..."
                class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
              />
              <Icon name="ri:search-2-line" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs" />
            </div>

            <!-- Word List Scroller -->
            <div class="flex-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
              <TransitionGroup 
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-x-2"
                enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-x-0"
                leave-to-class="opacity-0 translate-x-2"
              >
                <div 
                  v-for="word in filteredWords" :key="word"
                  class="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-white/10 transition-all"
                >
                  <div class="flex items-center gap-2">
                     <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                     <span class="text-xs font-bold text-slate-200">{{ word }}</span>
                  </div>
                  <button 
                    @click="removeWord(word)"
                    class="w-6 h-6 rounded-md hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 transition-all flex items-center justify-center"
                  >
                    <Icon name="ri:delete-bin-line" class="text-xs" />
                  </button>
                </div>
              </TransitionGroup>

              <!-- Empty states -->
              <div v-if="filteredWords.length === 0" class="py-12 flex flex-col items-center justify-center text-center opacity-40">
                 <Icon name="ri:ghost-line" class="text-3xl mb-2 text-slate-500" />
                 <p class="text-xs font-bold uppercase tracking-widest text-slate-400">List is empty</p>
              </div>
            </div>

            <!-- Bottom Action Reset -->
            <div class="flex justify-between items-center pt-2 border-t border-white/5">
              <span class="text-xs text-slate-500">Total Exceptions: {{ state.customWhitelist.value.length }} words</span>
              <button 
                @click="resetList"
                class="text-xs text-slate-600 hover:text-rose-500 font-black uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- Bottom Pro Tip Banner -->
    <div class="bg-accent-500/5 border border-accent-500/10 rounded-2xl p-4 flex gap-3.5 mt-2">
       <Icon name="ri:information-line" class="text-lg text-accent-500 flex-shrink-0 mt-0.5" />
       <p class="text-xs text-slate-400 leading-relaxed">
         <b>Safety Audit Pro-Tip:</b> Use the <b>Whitelist</b> tab to bypass warnings for words like "kill" or "blood" if they represent gameplay terms or brand names. All custom keywords are synchronized automatically with local storage.
       </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { DEFAULT_CATEGORIZED_BLACKLIST } from '../composables/useSafetyAuditor'

const state = useClipperState()
const newWord = ref('')
const searchQuery = ref('')
const activeTab = ref('categories')

const editingCategory = ref(null)
const newCategoryWord = ref('')

function addCategoryWord(cat) {
  if (!newCategoryWord.value.trim()) return
  const word = newCategoryWord.value.trim().toLowerCase()
  if (!state.categorizedBlacklist.value[cat].includes(word)) {
    state.categorizedBlacklist.value[cat].push(word)
    state.saveBlacklistToStorage()
  }
  newCategoryWord.value = ''
}

function deleteCategoryWord(cat, word) {
  state.categorizedBlacklist.value[cat] = state.categorizedBlacklist.value[cat].filter(w => w !== word)
  state.saveBlacklistToStorage()
}

function resetCategoryToDefault(cat) {
  if (confirm(`Reset ${cat} category to default word list?`)) {
    state.categorizedBlacklist.value[cat] = [...DEFAULT_CATEGORIZED_BLACKLIST[cat]]
    state.saveBlacklistToStorage()
  }
}

defineEmits(['close'])

onMounted(() => {
  if (state && state.loadBlacklistFromStorage) {
    state.loadBlacklistFromStorage()
  }
})

// Add word to current active list (blacklist or whitelist)
function addWord() {
  if (!newWord.value.trim()) return
  const word = newWord.value.trim().toLowerCase()
  
  if (activeTab.value === 'blacklist') {
    if (!state.customBlacklist.value.includes(word)) {
      state.customBlacklist.value.push(word)
      state.saveBlacklistToStorage()
    }
  } else {
    if (!state.customWhitelist.value.includes(word)) {
      state.customWhitelist.value.push(word)
      state.saveBlacklistToStorage()
    }
  }
  newWord.value = ''
}

// Remove word from active list
function removeWord(word) {
  if (activeTab.value === 'blacklist') {
    state.customBlacklist.value = state.customBlacklist.value.filter(w => w !== word)
  } else {
    state.customWhitelist.value = state.customWhitelist.value.filter(w => w !== word)
  }
  state.saveBlacklistToStorage()
}

// Filter words based on search query
const filteredWords = computed(() => {
  const list = activeTab.value === 'blacklist' 
    ? (state.customBlacklist.value || [])
    : (state.customWhitelist.value || [])
    
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.trim().toLowerCase()
  return list.filter(w => w.toLowerCase().includes(q))
})

// Reset current active list
function resetList() {
  const target = activeTab.value === 'blacklist' ? 'blacklist' : 'whitelist exceptions'
  if (confirm(`Are you sure you want to clear all custom ${target}?`)) {
    if (activeTab.value === 'blacklist') {
      state.customBlacklist.value = []
    } else {
      state.customWhitelist.value = []
    }
    state.saveBlacklistToStorage()
  }
}
</script>
