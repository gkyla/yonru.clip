<template>
  <div class="w-full max-w-5xl z-10 flex flex-col mt-6 mb-10 gap-5">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/50 pb-5">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-white mb-1">Prompt Templates</h2>
        <p class="text-slate-400 text-sm">Design and fine-tune your AI analysis configurations.</p>
      </div>
      <!-- Quick "+ Create New" button -->
      <button 
        @click="startNewPrompt"
        class="px-4 py-2.5 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(207,255,80,0.15)] active:scale-95 flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        :class="{ 'ring-2 ring-accent-500/50': isCreatingNew && !editingId }"
      >
        <Icon name="ri:add-line" class="text-sm font-bold" />
        Create New
      </button>
    </div>

    <!-- Clean, Non-Technical Info Callout -->
    <div class="bg-[#111318]/90 border border-surface-border/70 rounded-xl p-3.5 sm:p-4 flex items-start gap-3 text-xs shadow-sm">
      <div class="p-1.5 rounded-lg bg-accent-500/10 border border-accent-500/20 text-accent-500 shrink-0 mt-0.5">
        <Icon name="ri:lightbulb-line" class="text-base" />
      </div>
      <div class="flex-1 min-w-0">
        <span class="font-bold text-white text-xs block mb-0.5">Kustomisasi Gaya Prompt</span>
        <p class="text-slate-400 text-xs leading-relaxed">
          Tentukan gaya bahasa, kepribadian, atau sudut pandang hook yang Anda targetkan (misal: format debat, studi kasus, atau punchline lucu).
        </p>
      </div>
    </div>

    <!-- Main Workspace: Split Pane -->
    <div class="flex flex-col lg:flex-row gap-5 items-start w-full">
      <!-- Left Column: Search & Templates List (w-full lg:w-[290px]) -->
      <div class="w-full lg:w-[290px] lg:sticky lg:top-4 flex flex-col gap-3 shrink-0 bg-[#111318]/80 border border-surface-border/60 rounded-2xl p-3.5">
        
        <!-- Search bar -->
        <div class="relative w-full">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search prompts..." 
            class="w-full bg-surface-dark border border-surface-border text-white pl-9 pr-8 py-2 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all text-xs font-medium placeholder-slate-500"
          />
          <Icon name="ri:search-2-line" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''" 
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          >
            <Icon name="ri:close-circle-fill" class="text-xs" />
          </button>
        </div>

        <!-- Prompts Count Subheader -->
        <div class="flex items-center justify-between px-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
          <span>Templates</span>
          <span>{{ filteredPrompts.length }} items</span>
        </div>

        <!-- Scrollable List of Templates -->
        <div class="flex flex-col gap-1.5 max-h-[560px] overflow-y-auto custom-scrollbar p-1 w-full">
          <div v-if="filteredPrompts.length === 0" class="text-center py-8 text-xs text-slate-500 italic">
            No templates match the criteria.
          </div>
          <button 
            v-else
            v-for="p in filteredPrompts" 
            :key="p.id"
            @click="editExistingPrompt(p)"
            class="w-full text-left bg-surface-dark/60 border border-surface-border/60 hover:border-slate-600 hover:bg-surface-panel/40 rounded-xl p-3 cursor-pointer transition-all flex flex-col gap-1.5 group select-none relative"
            :class="{ 'border-accent-500 bg-accent-500/10 shadow-[0_0_15px_rgba(207,255,80,0.05)] ring-1 ring-accent-500/40 z-10': editingId === p.id }"
          >
            <div class="flex justify-between items-center w-full gap-2">
              <span class="font-bold text-white text-xs truncate group-hover:text-accent-500 transition-colors">{{ p.name }}</span>
              <Icon 
                name="ri:checkbox-circle-fill" 
                class="text-accent-500 text-xs shrink-0 transition-opacity" 
                :class="editingId === p.id ? 'opacity-100' : 'opacity-0'" 
              />
            </div>

            <!-- Single-Line Compact Tags with Custom Tooltips & +N Badge -->
            <div class="flex items-center gap-1 overflow-hidden w-full" v-if="p.suitableFor && p.suitableFor.length">
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
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-[#0a0c12] border border-slate-700/80 text-white text-[10px] font-mono font-bold rounded-lg shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9),0_0_15px_rgba(207,255,80,0.12)] opacity-0 group-hover/tag:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform translate-y-1 group-hover/tag:translate-y-0 flex items-center gap-0.5">
                  <span class="text-accent-500 font-black">#</span>
                  <span>{{ tag }}</span>
                  <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0c12] border-b border-r border-slate-700/80 transform rotate-45"></div>
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
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-[#0a0c12] border border-slate-700/80 text-white text-[10px] font-mono font-bold rounded-lg shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9),0_0_15px_rgba(207,255,80,0.12)] opacity-0 group-hover/more:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform translate-y-1 group-hover/more:translate-y-0">
                  <span class="text-accent-500 font-black mr-1">+{{ p.suitableFor.length - 2 }} more:</span>
                  <span class="text-slate-200 font-normal">{{ p.suitableFor.slice(2).map((t: string) => `#${t}`).join(', ') }}</span>
                  <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0c12] border-b border-r border-slate-700/80 transform rotate-45"></div>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Right Column: Editor Detail Canvas -->
      <div class="flex-1 w-full bg-[#111318]/90 border border-surface-border rounded-2xl p-5 sm:p-6 min-h-[560px] flex flex-col shadow-sm">
        <!-- Empty Selection State -->
        <div v-if="!editingId && !isCreatingNew" class="flex-1 w-full h-full flex flex-col items-center justify-center text-center p-8">
          <div class="w-14 h-14 bg-surface-dark rounded-full border border-surface-border flex items-center justify-center mb-3 text-slate-500 shadow-inner">
            <Icon name="ri:chat-quote-line" class="text-2xl" />
          </div>
          <h4 class="text-white font-bold text-xs uppercase tracking-wider mb-1">No Template Selected</h4>
          <p class="text-slate-500 text-xs max-w-sm leading-relaxed mb-5">Select an existing template from the sidebar list to edit, or initialize a new prompt template configuration.</p>
          <button 
            @click="startNewPrompt"
            class="px-4 py-2 bg-surface-dark hover:bg-surface-panel border border-surface-border text-slate-300 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer hover:border-slate-600"
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
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border/50 pb-3.5">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full bg-accent-500 animate-pulse shadow-[0_0_8px_#CFFF50]"></div>
                <h3 class="text-xs font-black text-white uppercase tracking-wider">
                  {{ editingId ? 'Modify Prompt Template' : 'New Prompt Configuration' }}
                </h3>
              </div>
              <div class="flex items-center gap-2 self-end sm:self-auto">
                <button 
                  v-if="editingId"
                  @click="showDeleteModal = true"
                  class="px-3 py-1.5 bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 hover:border-[#ff4a4a] text-[#ff4a4a] hover:bg-[#ff4a4a]/20 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer"
                >
                  Delete
                </button>
                <button 
                  @click="cancelEdit"
                  class="px-3 py-1.5 bg-surface-dark border border-surface-border text-slate-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer hover:border-slate-600"
                >
                  Cancel
                </button>
                <button 
                  @click="savePrompt"
                  :disabled="!promptName || !promptText"
                  class="px-4 py-1.5 bg-accent-500 text-black font-black uppercase tracking-wider text-[10px] rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(207,255,80,0.15)] active:scale-95 cursor-pointer"
                >
                  {{ editingId ? 'Update Prompt' : 'Save Prompt' }}
                </button>
              </div>
            </div>

            <!-- Row 1: Prompt Name -->
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Prompt Name</label>
              <input 
                v-model="promptName"
                type="text" 
                placeholder="e.g. Comedy Podcast Hooks" 
                class="w-full bg-surface-dark border border-surface-border text-white px-3.5 py-2 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all text-xs font-semibold placeholder-slate-600"
              />
            </div>

            <!-- Row 2: Suitable For Tags (Option C: Pill List + Popover) -->
            <div class="flex flex-col gap-1.5 relative">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Suitable For (Tags)</label>
              <div class="flex items-center gap-1.5 flex-wrap min-h-[34px]">
                <!-- Active Tag Badges with Custom Tooltip -->
                <div 
                  v-for="(tag, index) in suitableFor" 
                  :key="index"
                  class="group/pill relative inline-flex items-center"
                >
                  <span 
                    class="bg-surface-dark border border-surface-border text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 group-hover/pill:border-slate-600 transition-colors select-none"
                  >
                    <span class="text-accent-500 font-bold text-[11px]">#</span>
                    <span class="max-w-[160px] truncate">{{ tag }}</span>
                    <button 
                      @click="removeTag(index)" 
                      class="text-slate-500 hover:text-red-400 transition-colors p-0.5 rounded focus:outline-none cursor-pointer"
                    >
                      <Icon name="ri:close-line" class="text-xs" />
                    </button>
                  </span>

                  <!-- Custom Hover Tooltip -->
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-[#0a0c12] border border-slate-700/80 text-white text-xs font-mono font-bold rounded-lg shadow-[0_10px_25px_-3px_rgba(0,0,0,0.9),0_0_15px_rgba(207,255,80,0.12)] opacity-0 group-hover/pill:opacity-100 transition-all duration-150 pointer-events-none whitespace-nowrap z-50 transform translate-y-1 group-hover/pill:translate-y-0 flex items-center gap-1">
                    <span class="text-accent-500 font-black">#</span>
                    <span>{{ tag }}</span>
                    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0a0c12] border-b border-r border-slate-700/80 transform rotate-45"></div>
                  </div>
                </div>

                <!-- + Add Tag Trigger Button & Popover -->
                <div class="relative" ref="tagPopoverRef">
                  <button 
                    @click.stop="openTagPopover"
                    class="px-2.5 py-1 bg-surface-dark hover:bg-surface-panel border border-dashed border-surface-border hover:border-accent-500/50 text-slate-400 hover:text-accent-500 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer select-none"
                    :class="{ 'border-accent-500 text-accent-500 bg-accent-500/10': isTagPopoverOpen }"
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
                      @click.stop
                      class="absolute top-full left-0 mt-1.5 w-64 bg-[#0f1117] border border-surface-border rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left"
                    >
                      <div class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1 flex items-center justify-between">
                        <span>Add Tags</span>
                        <button @click="isTagPopoverOpen = false" class="text-slate-500 hover:text-white cursor-pointer">
                          <Icon name="ri:close-line" class="text-xs" />
                        </button>
                      </div>

                      <div class="flex items-center gap-1.5 bg-surface-dark border border-surface-border rounded-lg px-2 py-1.5 focus-within:border-accent-500/60 transition-colors">
                        <Icon name="ri:hashtag" class="text-accent-500 text-xs shrink-0" />
                        <input 
                          ref="tagInputRef"
                          v-model="newTagInput"
                          @keydown.enter.prevent="addTagFromPopover"
                          @keydown.esc="isTagPopoverOpen = false"
                          type="text" 
                          placeholder="Tag name (Enter to add)" 
                          class="w-full bg-transparent text-white text-xs focus:outline-none placeholder-slate-500"
                        />
                        <button 
                          v-if="newTagInput.trim()"
                          @click="addTagFromPopover"
                          class="px-2 py-0.5 bg-accent-500 text-black text-[10px] font-black rounded uppercase tracking-wider hover:bg-accent-400 transition-colors shrink-0 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      <!-- Available Tag Suggestions from existing prompts -->
                      <div v-if="suggestedTags.length > 0" class="mt-2 pt-2 border-t border-surface-border/50 flex flex-col gap-1">
                        <span class="text-[9px] uppercase font-bold text-slate-500 px-1">Suggested</span>
                        <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar px-1">
                          <button
                            v-for="st in suggestedTags"
                            :key="st"
                            @click="addSuggestedTag(st)"
                            class="text-[10px] bg-white/5 hover:bg-accent-500/20 hover:text-accent-400 border border-white/5 px-2 py-0.5 rounded text-slate-300 transition-colors cursor-pointer select-none"
                          >
                            + {{ st }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Row 3: Content Style Editor Canvas -->
            <div class="flex flex-col gap-1 flex-1 min-h-[420px]">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-0.5">Content Style & Extraction Criteria</label>
              <PromptEditor 
                ref="promptEditorRef"
                v-slot="editor"
                v-model="promptText"
                class="font-mono flex-1 flex flex-col w-full"
              />
            </div>
          </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Delete Modal -->
  <div v-if="showDeleteModal" class="fixed inset-0 z-[120] flex items-center justify-center p-4">
    <!-- Backdrop filter blurring background -->
    <div class="absolute inset-0 bg-black/85 backdrop-blur-md" @click="showDeleteModal = false"></div>
    
    <!-- Content Card -->
    <div class="relative w-full max-w-lg bg-surface-dark border border-surface-border rounded-3xl p-8 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[130]">
       <div class="absolute inset-0 bg-noise opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
       
       <!-- Large warning shield icon -->
       <div class="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
          <Icon name="ri:delete-bin-2-line" class="text-3xl" />
       </div>

       <h3 class="text-2xl font-black text-white tracking-wide mb-3">Delete Prompt Template?</h3>
       
       <!-- Subtitle / target template name -->
       <div class="bg-surface-panel/30 border border-surface-border rounded-xl p-4 mb-6 flex flex-col gap-1">
          <span class="text-[10px] uppercase font-bold tracking-widest text-slate-500">
             Selected Template
          </span>
          <span class="text-white font-mono text-xs font-bold truncate">
             {{ promptName || 'Untitled Template' }}
          </span>
       </div>

       <!-- Warning details -->
       <div class="flex flex-col gap-4 text-xs mb-8">
          <div class="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-2xl p-4">
             <Icon name="ri:error-warning-line" class="text-red-400 text-lg shrink-0 mt-0.5" />
             <div>
                <h4 class="text-red-400 font-bold uppercase tracking-wider text-[10px] mb-1">Permanent Removal</h4>
                <p class="text-slate-400 leading-relaxed font-semibold">This will permanently delete this prompt template from the storage file. This action cannot be undone.</p>
             </div>
          </div>
       </div>

       <!-- Buttons -->
       <div class="flex items-center gap-3 w-full">
          <button 
            @click="showDeleteModal = false"
            class="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-[0.98] cursor-pointer"
          >
             Cancel
          </button>
          <button 
            @click="executeDeletePrompt"
            class="flex-1 py-3 bg-red-500 text-white hover:bg-red-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-[0.98] cursor-pointer"
          >
             Confirm Delete
          </button>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const editingId = ref<string | null>(null)
const isCreatingNew = ref(false)

const promptName = ref('')
const suitableFor = ref<string[]>([])
const isTagPopoverOpen = ref(false)
const newTagInput = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const tagPopoverRef = ref<HTMLElement | null>(null)

const promptText = ref('')
const numHooks = ref(10)
const autoHooks = ref(true)

// Search State
const searchQuery = ref('')

// Refs
const promptEditorRef = ref<any>(null)
const isSwitchingPrompt = ref(false)
let switchTimer: any = null

function triggerSwitchAnimation() {
  isSwitchingPrompt.value = false
  nextTick(() => {
    isSwitchingPrompt.value = true
    clearTimeout(switchTimer)
    switchTimer = setTimeout(() => {
      isSwitchingPrompt.value = false
    }, 280)
  })
}

// Filtered prompts list
const filteredPrompts = computed(() => {
  return state.promptsList.value.filter((p: any) => {
    return p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

// Suggested tags from other templates
const suggestedTags = computed(() => {
  const allTags = new Set<string>()
  state.promptsList.value.forEach((p: any) => {
    (p.suitableFor || []).forEach((t: string) => {
      const clean = t.trim()
      if (clean && !suitableFor.value.includes(clean)) {
        allTags.add(clean)
      }
    })
  })
  return Array.from(allTags).slice(0, 8)
})

onMounted(() => {
  if (state.promptsList.value.length === 0) {
    state.fetchPrompts()
  }
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

function handleClickOutside(e: MouseEvent) {
  if (tagPopoverRef.value && !tagPopoverRef.value.contains(e.target as Node)) {
    isTagPopoverOpen.value = false
  }
}

function openTagPopover() {
  isTagPopoverOpen.value = !isTagPopoverOpen.value
  if (isTagPopoverOpen.value) {
    nextTick(() => {
      tagInputRef.value?.focus()
    })
  }
}

function addTagFromPopover() {
  const val = newTagInput.value.trim()
  if (!val) return
  const tagsToAdd = val.split(',').map(t => t.trim()).filter(Boolean)
  for (const t of tagsToAdd) {
    if (!suitableFor.value.includes(t)) {
      suitableFor.value.push(t)
    }
  }
  newTagInput.value = ''
  nextTick(() => {
    tagInputRef.value?.focus()
  })
}

function addSuggestedTag(tag: string) {
  if (!suitableFor.value.includes(tag)) {
    suitableFor.value.push(tag)
  }
}

function removeTag(index: number) {
  suitableFor.value.splice(index, 1)
}

function editExistingPrompt(p: any) {
  editingId.value = p.id
  isCreatingNew.value = false
  promptName.value = p.name
  suitableFor.value = [...(p.suitableFor || [])]
  promptText.value = p.prompt || ''
  numHooks.value = p.numHooks ?? 10
  autoHooks.value = p.autoHooks ?? true
  isTagPopoverOpen.value = false
  newTagInput.value = ''
  triggerSwitchAnimation()
}

function startNewPrompt() {
  editingId.value = null
  isCreatingNew.value = true
  promptName.value = ''
  suitableFor.value = []
  promptText.value = ''
  numHooks.value = 10
  autoHooks.value = true
  isTagPopoverOpen.value = false
  newTagInput.value = ''
  triggerSwitchAnimation()
}

function cancelEdit() {
  editingId.value = null
  isCreatingNew.value = false
  isTagPopoverOpen.value = false
}

async function savePrompt() {
  if (!promptName.value || !promptText.value) return
  
  const tags = [...suitableFor.value]
  if (newTagInput.value.trim().length > 0) {
    const extra = newTagInput.value.trim().split(',').map(t => t.trim()).filter(Boolean)
    for (const t of extra) {
      if (!tags.includes(t)) tags.push(t)
    }
    newTagInput.value = ''
  }
  
  if (editingId.value) {
    const success = await state.editPrompt(editingId.value, promptName.value, tags, promptText.value, 10, true)
    if (success) {
      // Keep editing mode active on success
    }
  } else {
    try {
      await $fetch(`${API_BASE}/api/prompts/add`, {
        method: 'POST',
        body: { 
          promptName: promptName.value,
          suitableFor: tags,
          prompt: promptText.value,
          numHooks: 10,
          autoHooks: true
        }
      })
      state.showToast('Prompt saved successfully', 'success')
      await state.fetchPrompts()
      cancelEdit()
    } catch (e) {
      state.showToast('Failed to save prompt', 'error')
    }
  }
}

const showDeleteModal = ref(false)

async function executeDeletePrompt() {
  if (!editingId.value) return
  const success = await state.deletePrompt(editingId.value)
  if (success) {
    editingId.value = null
    isCreatingNew.value = false
    showDeleteModal.value = false
    promptName.value = ''
    promptText.value = ''
    suitableFor.value = []
    numHooks.value = 10
    autoHooks.value = false
    newTagInput.value = ''
    isTagPopoverOpen.value = false
  }
}
</script>

<style scoped>
@keyframes templateFade {
  0% {
    opacity: 0.15;
  }
  100% {
    opacity: 1;
  }
}

.animate-template-crossfade {
  animation: templateFade 280ms ease-out forwards;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 0;
}

.custom-horizontal-scrollbar::-webkit-scrollbar {
  height: 4px;
}
.custom-horizontal-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
</style>
