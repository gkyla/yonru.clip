<template>
  <div class="w-full max-w-7xl z-10 flex flex-col mt-6 mb-10 gap-6">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border/50 pb-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-white mb-1.5">Prompt Templates</h2>
        <p class="text-slate-400 text-sm">Design and fine-tune your AI analysis configurations.</p>
      </div>
      <!-- Quick "+ Create New" button for mobile/desktop -->
      <button 
        @click="startNewPrompt"
        class="px-5 py-2.5 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(207,255,80,0.15)] active:scale-95 flex items-center gap-2 self-start md:self-auto cursor-pointer"
        :class="{ 'ring-2 ring-accent-500/50': isCreatingNew && !editingId }"
      >
        <Icon name="ri:add-line" class="text-sm font-bold" />
        Create New
      </button>
    </div>

    <!-- Main Workspace: Split Pane -->
    <div class="flex flex-col lg:flex-row gap-6 items-start w-full">
      <!-- Left Column: Search, Category Filters, and Templates List -->
      <div class="w-full lg:w-[360px] lg:sticky lg:top-0 flex flex-col gap-4 shrink-0 bg-surface-panel/20 border border-surface-border/50 rounded-2xl p-4">
        
        <!-- Search bar -->
        <div class="relative w-full">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Search prompts..." 
            class="w-full bg-[#111318] border border-surface-border text-white pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all text-xs font-semibold placeholder-slate-600"
          />
          <Icon name="ri:search-2-line" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-base" />
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''" 
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
          >
            <Icon name="ri:close-circle-fill" />
          </button>
        </div>



        <!-- Scrollable List -->
        <div class="flex flex-col gap-2 max-h-[500px] overflow-y-auto p-1 custom-scrollbar w-full">
          <div v-if="filteredPrompts.length === 0" class="text-center py-8 text-xs text-slate-500 italic">
            No templates match the criteria.
          </div>
          <button 
            v-else
            v-for="p in filteredPrompts" 
            :key="p.id"
            @click="editExistingPrompt(p)"
            class="w-full text-left bg-surface-panel/30 border border-surface-border/50 hover:border-accent-500/30 hover:bg-surface-panel/50 rounded-xl p-3.5 cursor-pointer transition-all flex flex-col gap-2 group"
            :class="{ 'border-accent-500 bg-surface-panel shadow-[0_0_15px_rgba(207,255,80,0.05)] ring-1 ring-accent-500/30': editingId === p.id }"
          >
            <div class="flex justify-between items-start w-full">
              <span class="font-bold text-white text-xs leading-snug group-hover:text-accent-500 transition-colors">{{ p.name }}</span>
              <Icon 
                name="ri:checkbox-circle-fill" 
                class="text-accent-500 text-sm shrink-0 transition-opacity" 
                :class="editingId === p.id ? 'opacity-100' : 'opacity-0'" 
              />
            </div>
            <div class="flex flex-wrap gap-1.5" v-if="p.suitableFor && p.suitableFor.length">
              <span 
                v-for="tag in p.suitableFor.slice(0, 3)" 
                :key="tag" 
                class="text-[10px] bg-black/30 border border-white/5 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider font-semibold"
              >
                {{ tag }}
              </span>
              <span v-if="p.suitableFor.length > 3" class="text-[10px] text-slate-500 self-center font-bold pl-0.5">+{{ p.suitableFor.length - 3 }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Right Column: Editor Detail Canvas -->
      <div class="flex-1 w-full bg-surface-panel/40 border border-surface-border/50 rounded-2xl p-6 min-h-[500px] flex flex-col">
        <!-- Empty Selection State -->
        <div v-if="!editingId && !isCreatingNew" class="flex-1 flex flex-col items-center justify-center text-center p-8">
          <div class="w-16 h-16 bg-surface-dark/50 rounded-full border border-surface-border/50 flex items-center justify-center mb-4 text-slate-500 shadow-inner">
            <Icon name="ri:chat-quote-line" class="text-3xl" />
          </div>
          <h4 class="text-white font-bold text-sm mb-1.5 uppercase tracking-wider">No Template Selected</h4>
          <p class="text-slate-500 text-xs max-w-sm leading-relaxed mb-6">Select an existing template from the sidebar list to edit, or initialize a new prompt template configuration.</p>
          <button 
            @click="startNewPrompt"
            class="px-4 py-2 bg-surface-dark hover:bg-surface-panel border border-surface-border text-slate-300 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer"
          >
            + Create New Template
          </button>
        </div>

        <!-- Editor Form Canvas -->
        <div v-else class="flex flex-col gap-5 flex-1">
          <!-- Editor Title & Primary Actions -->
          <div class="flex items-center justify-between border-b border-surface-border/50 pb-4">
            <div class="flex items-center gap-2.5">
              <div class="w-2.5 h-2.5 rounded-full bg-accent-500 animate-pulse shadow-[0_0_8px_#CFFF50]"></div>
              <h3 class="text-sm font-black text-white uppercase tracking-wider">
                {{ editingId ? 'Modify Prompt Template' : 'New Prompt Configuration' }}
              </h3>
            </div>
            <div class="flex items-center gap-3">
              <button 
                v-if="editingId"
                @click="showDeleteModal = true"
                class="px-4 py-2 bg-[#ff4a4a]/10 border border-[#ff4a4a]/30 hover:border-[#ff4a4a] text-[#ff4a4a] hover:bg-[#ff4a4a]/20 font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer"
              >
                Delete
              </button>
              <button 
                @click="cancelEdit"
                class="px-4 py-2 bg-surface-dark border border-surface-border text-slate-400 hover:text-white font-bold uppercase tracking-wider text-[10px] rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                @click="savePrompt"
                :disabled="!promptName || !promptText"
                class="px-5 py-2 bg-accent-500 text-black font-black uppercase tracking-wider text-[10px] rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(207,255,80,0.15)] active:scale-95 cursor-pointer"
              >
                {{ editingId ? 'Update Prompt' : 'Save New Prompt' }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-4">
             <!-- Row 1: Name Input -->
             <div class="flex flex-col gap-1.5">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Prompt Name</label>
                <input 
                  v-model="promptName"
                  type="text" 
                  placeholder="e.g. Comedy Podcast Hooks" 
                  class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-xl focus:outline-none focus:border-accent-500/50 transition-all text-xs font-semibold"
                />
             </div>

             <!-- Row 2: Tag Editor & Architectural Info Banner -->
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
               <!-- Left Column: Suitable For Tags -->
               <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Suitable For (Tags)</label>
                  <div class="w-full bg-[#111318] border border-surface-border rounded-xl flex flex-col focus-within:border-accent-500/50 transition-all overflow-hidden min-h-[92px]">
                     <div class="flex items-center px-3 pt-3 pb-1 gap-1.5 flex-wrap" v-if="suitableFor.length > 0">
                       <span 
                         v-for="(tag, index) in suitableFor" 
                         :key="index"
                         class="bg-surface-panel border border-surface-border text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 group"
                       >
                         {{ tag }}
                         <button @click="removeTag(index)" class="text-slate-500 group-hover:text-red-400 focus:outline-none hover:scale-110 transition-transform cursor-pointer">
                           <Icon name="ri:close-line" />
                         </button>
                       </span>
                     </div>
                     <input 
                       v-model="newTag"
                       @keydown.enter.prevent="addTag"
                       @keydown.delete="handleDelete"
                       @input="handleTagInput"
                       type="text" 
                       placeholder="Type tag and press Enter or comma..." 
                       class="w-full bg-transparent text-white px-3 py-2 focus:outline-none text-[11px] font-semibold"
                     />
                  </div>
               </div>

               <!-- Right Column: Scoped Archetype Info Card -->
               <div class="bg-black/10 border border-surface-border/50 rounded-xl p-4 flex flex-col justify-center gap-2">
                 <div class="flex items-center gap-2 text-accent-500">
                   <Icon name="ri:shield-check-line" class="text-base" />
                   <span class="text-xs font-black uppercase tracking-wider">Scoped Archetype Directives</span>
                 </div>
                 <p class="text-[11px] text-slate-400 leading-relaxed font-medium">
                   Focus purely on describing your content criteria, tone, and key phrases. Core guardrails (<em class="text-slate-300">Thought Completion 4-Step</em>, <em class="text-slate-300">Anti-Overlap</em>, <em class="text-slate-300">Duration Range</em>, and <em class="text-slate-300">JSON output</em>) are automatically enforced by the analyzer engine.
                 </p>
               </div>
             </div>

             <!-- Row 3: Content Style Editor Canvas -->
             <div class="flex flex-col gap-1.5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Content Style & Extraction Criteria</label>
                  <span class="text-[10px] text-slate-500 font-mono">100% Natural AI Detection</span>
                </div>
                
                <PromptEditor 
                  ref="promptEditorRef"
                  v-slot="editor"
                  v-model="promptText"
                  class="font-mono"
                />
             </div>
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
import { ref, onMounted, computed, nextTick } from 'vue'

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const editingId = ref<string | null>(null)
const isCreatingNew = ref(false)

const promptName = ref('')
const suitableFor = ref<string[]>([])
const newTag = ref('')
const promptText = ref('')
const numHooks = ref(10)
const autoHooks = ref(true)

// Search State
const searchQuery = ref('')

// Refs
const promptEditorRef = ref<any>(null)

// Filtered prompts list
const filteredPrompts = computed(() => {
  return state.promptsList.value.filter((p: any) => {
    return p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

onMounted(() => {
  if (state.promptsList.value.length === 0) {
    state.fetchPrompts()
  }
})

function handleTagInput(e: Event) {
  if (newTag.value.includes(',')) {
    addTag()
  }
}

function addTag() {
  const tags = newTag.value.split(',').map(t => t.trim()).filter(t => t.length > 0)
  for (const tag of tags) {
    if (!suitableFor.value.includes(tag)) {
      suitableFor.value.push(tag)
    }
  }
  newTag.value = ''
}

function handleDelete() {
  if (newTag.value === '' && suitableFor.value.length > 0) {
    suitableFor.value.pop()
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
  newTag.value = ''
}

function startNewPrompt() {
  editingId.value = null
  isCreatingNew.value = true
  promptName.value = ''
  suitableFor.value = []
  promptText.value = ''
  numHooks.value = 10
  autoHooks.value = true
  newTag.value = ''
}

function cancelEdit() {
  editingId.value = null
  isCreatingNew.value = false
}

async function savePrompt() {
  if (!promptName.value || !promptText.value) return
  
  const tags = [...suitableFor.value]
  if (newTag.value.trim().length > 0) {
    tags.push(newTag.value.trim())
    newTag.value = ''
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
    newTag.value = ''
  }
}
</script>

<style scoped>
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
