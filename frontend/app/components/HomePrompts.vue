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

             <!-- Row 2: Tag Editor & Configuration Grid -->
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

               <!-- Right Column: Settings Grid (AI Mode & Hook Count) -->
               <div class="bg-black/10 border border-surface-border/50 rounded-xl p-5 flex flex-col gap-3 justify-center">
                 <!-- AI Mode toggle -->
                 <div class="flex items-center justify-between gap-3">
                   <div class="flex flex-col">
                     <span class="text-xs font-black text-white uppercase tracking-wider">AI Mode Selection</span>
                     <span class="text-[10px] text-slate-500 leading-tight mt-0.5">{{ autoHooks ? 'Natural length detection' : 'Force count' }}</span>
                   </div>
                   <button 
                     @click="autoHooks = !autoHooks"
                     class="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border transition-all text-xs font-bold cursor-pointer"
                     :class="autoHooks 
                       ? 'bg-accent-500/10 border-accent-500/30 text-accent-500 shadow-[0_0_10px_rgba(207,255,80,0.05)]' 
                       : 'bg-[#111318] border-surface-border text-slate-400 hover:border-accent-500/30 hover:text-slate-300'"
                   >
                     <div class="w-6 h-3.5 rounded-none transition-all relative" :class="autoHooks ? 'bg-accent-500' : 'bg-surface-border'">
                       <div class="absolute top-[2px] w-2.5 h-2.5 rounded-none bg-white shadow transition-all" :class="autoHooks ? 'left-[12px]' : 'left-[2px]'"></div>
                     </div>
                     <span>{{ autoHooks ? 'Natural' : 'Fixed' }}</span>
                   </button>
                 </div>
 
                 <!-- Divider -->
                 <div class="border-t border-surface-border/30"></div>
 
                 <!-- Number of Hooks slider -->
                 <div class="flex flex-col gap-1">
                   <div class="flex justify-between items-center">
                     <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Number of Hooks</span>
                     <span class="text-white font-mono font-bold text-xs bg-[#111318] border border-surface-border px-2 py-0.5 rounded-md min-w-[32px] text-center" :class="{ 'opacity-30': autoHooks }">{{ autoHooks ? '—' : numHooks }}</span>
                   </div>
                   <div class="flex items-center gap-3 mt-1">
                     <input 
                       v-model.number="numHooks"
                       type="range" min="1" max="30" step="1"
                       class="flex-1 accent-accent-500 h-1 bg-surface-dark rounded-full appearance-none cursor-pointer disabled:opacity-30 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-accent-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow"
                       :disabled="autoHooks"
                     />
                   </div>
                 </div>
               </div>
             </div>

             <!-- Row 3: Monospaced Text Editor Canvas -->
             <div class="flex flex-col gap-1.5">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Prompt Template</label>
                  
                  <!-- Clickable badge variables legend -->
                  <div class="flex items-center gap-1.5 text-[9px] text-slate-500 bg-surface-dark border border-surface-border px-2 py-1 rounded-lg">
                    <span class="uppercase font-bold tracking-widest text-[8px]">Insert Variables:</span>
                    
                    <!-- num_hooks variable -->
                    <div class="relative group/tooltip">
                      <button 
                        @click="insertVariable('{num_hooks}')"
                        class="font-mono px-1.5 py-0.5 rounded cursor-pointer transition-all bg-surface-panel hover:text-accent-500 hover:bg-accent-500/10 hover:ring-1 hover:ring-accent-500/20 active:scale-95 text-slate-400"
                        :class="{ 'text-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30': promptText?.includes('{num_hooks}') }"
                      >
                        {num_hooks}
                      </button>
                      <!-- Tooltip Content -->
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-slate-950/95 border border-surface-border text-slate-200 p-3 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-[60] font-sans text-[11px] leading-relaxed text-left">
                        <div class="font-bold text-accent-500 mb-1 font-mono text-[10px] uppercase tracking-wider">{num_hooks} value:</div>
                        <div class="font-mono bg-black/40 p-2 border border-surface-border/50 rounded-lg text-slate-300 select-all whitespace-pre-wrap break-words">{{ editorVariables.num_hooks }}</div>
                        <!-- Tooltip Arrow -->
                        <div class="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/95"></div>
                      </div>
                    </div>                     <!-- duration_constraint variable -->
                    <div class="relative group/tooltip">
                      <button 
                        @click="insertVariable('{duration_constraint}')"
                        class="font-mono px-1.5 py-0.5 rounded cursor-pointer transition-all bg-surface-panel hover:text-accent-500 hover:bg-accent-500/10 hover:ring-1 hover:ring-accent-500/20 active:scale-95 text-slate-400"
                        :class="{ 'text-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30': promptText?.includes('{duration_constraint}') }"
                      >
                        {duration_constraint}
                      </button>
                      <!-- Tooltip Content -->
                      <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-slate-950/95 border border-surface-border text-slate-200 p-3 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-[60] font-sans text-[11px] leading-relaxed text-left">
                        <div class="font-bold text-accent-500 mb-1 font-mono text-[10px] uppercase tracking-wider">{duration_constraint} value:</div>
                        <div class="font-mono bg-black/40 p-2 border border-surface-border/50 rounded-lg text-slate-300 select-all whitespace-pre-wrap break-words mb-2">{{ editorVariables.duration_constraint.trim() }}</div>
                        <div class="text-[10px] text-slate-400 leading-normal border-t border-surface-border/50 pt-2">
                          <span class="text-accent-500 font-semibold">Note:</span> <code class="font-mono text-white">X.X</code> will be dynamically replaced with the actual video length by the backend during analysis.
                        </div>
                        <!-- Tooltip Arrow -->
                        <div class="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-950/95"></div>
                      </div>
                    </div>

                  </div>
                </div>
                
                <PromptEditor 
                  ref="promptEditorRef"
                  v-slot="editor"
                  v-model="promptText"
                  :variables="editorVariables"
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
const autoHooks = ref(false)

// Search State
const searchQuery = ref('')

// Refs
const promptEditorRef = ref<any>(null)

// Filtered prompts list
const filteredPrompts = computed(() => {
  return state.promptsList.value.filter(p => {
    return p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

// Computed variables for editor WYSIWYG replacement
const editorVariables = computed(() => {
  return {
    num_hooks: autoHooks.value
      ? 'Find ALL naturally compelling hooks in the transcript. Do not force a specific number — return as many or as few as genuinely qualify. Quality over quantity.'
      : `Find exactly ${numHooks.value} hooks.`,
    duration_constraint: '\n            VIDEO DURATION: The total length is X.X seconds. ALL timestamps MUST be within 0 and X.X.'
  }
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
  autoHooks.value = p.autoHooks ?? false
  newTag.value = ''
}

function startNewPrompt() {
  editingId.value = null
  isCreatingNew.value = true
  promptName.value = ''
  suitableFor.value = []
  promptText.value = ''
  numHooks.value = 10
  autoHooks.value = false
  newTag.value = ''
}

function cancelEdit() {
  editingId.value = null
  isCreatingNew.value = false
}

// Click-to-insert or toggle variable logic
function insertVariable(variable: string) {
  const hasVar = promptText.value?.includes(variable)
  
  if (hasVar) {
    // Remove the variable
    if (promptEditorRef.value?.editor) {
      const editor = promptEditorRef.value.editor
      let tr = editor.state.tr
      const matches: { start: number; end: number }[] = []
      
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.isText && node.text) {
          let index = node.text.indexOf(variable)
          while (index !== -1) {
            matches.push({
              start: pos + index,
              end: pos + index + variable.length
            })
            index = node.text.indexOf(variable, index + 1)
          }
        }
      })
      
      // Sort in descending order of start position to prevent offset shifting
      matches.sort((a, b) => b.start - a.start)
      
      if (matches.length > 0) {
        matches.forEach(m => {
          tr = tr.delete(m.start, m.end)
        })
        editor.view.dispatch(tr)
      }
    } else {
      // Fallback for stubs or raw textareas in tests
      const el = document.querySelector('textarea')
      if (el) {
        promptText.value = promptText.value.replaceAll(variable, '')
      } else {
        promptText.value = (promptText.value || '').replaceAll(variable, '')
      }
    }
  } else {
    // Insert the variable at cursor position
    if (promptEditorRef.value?.editor) {
      promptEditorRef.value.editor.chain().focus().insertContent(variable).run()
    } else {
      // Fallback for stubs or raw textareas in tests
      const el = document.querySelector('textarea')
      if (el) {
        const start = el.selectionStart
        const end = el.selectionEnd
        const text = promptText.value || ''
        promptText.value = text.substring(0, start) + variable + text.substring(end)
        nextTick(() => {
          el.selectionStart = el.selectionEnd = start + variable.length
          el.focus()
        })
      } else {
        promptText.value = (promptText.value || '') + variable
      }
    }
  }
}

async function savePrompt() {
  if (!promptName.value || !promptText.value) return
  
  const tags = [...suitableFor.value]
  if (newTag.value.trim().length > 0) {
    tags.push(newTag.value.trim())
    newTag.value = ''
  }
  
  if (editingId.value) {
    const success = await state.editPrompt(editingId.value, promptName.value, tags, promptText.value, numHooks.value, autoHooks.value)
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
          numHooks: numHooks.value,
          autoHooks: autoHooks.value
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
