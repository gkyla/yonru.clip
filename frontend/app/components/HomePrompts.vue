<template>
  <div class="w-full max-w-4xl z-10 flex flex-col mt-12 mb-10 gap-6">
    <div>
      <h2 class="text-4xl font-bold tracking-tight text-white mb-4">Prompt Templates</h2>
      <p class="text-slate-400">Create and manage your AI prompts for analyzing videos.</p>
    </div>

    <!-- Available Prompts List -->
    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1 mb-2">Available Prompts</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          v-for="p in state.promptsList.value" :key="p.id"
          @click="editExistingPrompt(p)"
          class="bg-surface-panel/50 border border-surface-border hover:border-accent-500/50 rounded-xl p-4 cursor-pointer transition-all hover:bg-surface-panel flex flex-col gap-2"
          :class="{ 'border-accent-500 bg-surface-panel shadow-[0_0_15px_rgba(207,255,80,0.1)]': editingId === p.id }"
        >
          <div class="font-bold text-white text-sm">{{ p.name }}</div>
          <div class="flex flex-wrap gap-1">
            <span v-for="tag in p.suitableFor.slice(0,2)" :key="tag" class="text-[9px] bg-surface-dark border border-surface-border text-slate-400 px-1.5 py-0.5 rounded">
              {{ tag }}
            </span>
            <span v-if="p.suitableFor.length > 2" class="text-[9px] text-slate-500 px-1.5 py-0.5">+{{ p.suitableFor.length - 2 }}</span>
          </div>
        </div>
        
        <!-- Add New Card -->
        <div 
          @click="startNewPrompt"
          class="border border-dashed border-surface-border hover:border-accent-500/50 rounded-xl p-4 cursor-pointer transition-all flex items-center justify-center gap-2 text-slate-500 hover:text-accent-500 hover:bg-surface-panel/30"
          :class="{ 'border-solid border-accent-500 bg-surface-panel shadow-[0_0_15px_rgba(207,255,80,0.1)] text-accent-500': !editingId }"
        >
          <Icon name="ri:add-line" class="text-lg" />
          <span class="font-bold text-sm uppercase tracking-widest">Create New</span>
        </div>
      </div>
    </div>

    <!-- Editor Form -->
    <div class="bg-surface-panel border border-surface-border rounded-xl p-6 flex flex-col gap-6 shadow-xl mt-4">
      <div class="flex items-center justify-between border-b border-surface-border pb-4">
         <h3 class="text-lg font-bold text-white flex items-center gap-2">
           <Icon name="ri:chat-quote-fill" class="text-accent-500" /> {{ editingId ? 'Edit Prompt' : 'Add New Prompt' }}
         </h3>
      </div>

      <div class="flex flex-col gap-4">
         <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Prompt Name</label>
            <input 
              v-model="promptName"
              type="text" 
              placeholder="e.g. Comedy Podcast Hooks" 
              class="w-full bg-[#111318] border border-surface-border text-white px-4 py-2.5 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all text-sm"
            />
         </div>
         
         <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Suitable For</label>
            <div class="w-full bg-[#111318] border border-surface-border rounded-lg flex flex-col focus-within:border-accent-500/50 transition-all overflow-hidden">
               <div class="flex items-center px-4 pt-3 pb-1 gap-2 flex-wrap" v-if="suitableFor.length > 0">
                 <span 
                   v-for="(tag, index) in suitableFor" 
                   :key="index"
                   class="bg-surface-panel border border-surface-border text-slate-300 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5 group"
                 >
                   {{ tag }}
                   <button @click="removeTag(index)" class="text-slate-500 group-hover:text-red-400 focus:outline-none hover:scale-110 transition-transform">
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
                 placeholder="Type a tag and press Enter or comma" 
                 class="w-full bg-transparent text-white px-4 py-2.5 focus:outline-none text-sm"
               />
            </div>
         </div>

         <!-- Hook Count & Auto Mode -->
         <div class="flex gap-4">
           <div class="flex flex-col gap-1.5 flex-1">
             <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Number of Hooks</label>
             <div class="flex items-center gap-3">
               <input 
                 v-model.number="numHooks"
                 type="range" min="1" max="30" step="1"
                 class="flex-1 accent-accent-500 h-1.5 bg-surface-dark rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-accent-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                 :disabled="autoHooks"
               />
               <span class="text-white font-mono font-bold text-sm bg-surface-dark border border-surface-border px-3 py-1.5 rounded-lg min-w-[48px] text-center" :class="{ 'opacity-40': autoHooks }">{{ autoHooks ? '—' : numHooks }}</span>
             </div>
           </div>

           <div class="flex flex-col gap-1.5 w-56">
             <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">AI Mode</label>
             <button 
               @click="autoHooks = !autoHooks"
               class="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all text-sm font-bold"
               :class="autoHooks 
                 ? 'bg-accent-500/10 border-accent-500/50 text-accent-500' 
                 : 'bg-[#111318] border-surface-border text-slate-400 hover:border-accent-500/30 hover:text-slate-300'"
             >
               <div class="w-8 h-[18px] rounded-none transition-all relative" :class="autoHooks ? 'bg-accent-500' : 'bg-surface-border'">
                 <div class="absolute top-[3px] w-3 h-3 rounded-none bg-white shadow transition-all" :class="autoHooks ? 'left-[17px]' : 'left-[3px]'"></div>
               </div>
               <span>{{ autoHooks ? 'Natural' : 'Fixed Count' }}</span>
             </button>
             <p class="text-[10px] text-slate-500 pl-1">{{ autoHooks ? 'AI decides how many hooks naturally fit' : `Force exactly ${numHooks} hooks` }}</p>
           </div>
         </div>

         <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Prompt Template</label>
              <div class="flex items-center gap-2 text-[10px] text-slate-500 bg-surface-dark border border-surface-border px-2 py-1 rounded-md">
                <span class="uppercase font-bold tracking-widest">Available Variables:</span>
                <span 
                  class="font-mono px-1 rounded cursor-help transition-all" 
                  :class="promptText?.includes('{num_hooks}') ? 'text-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30 shadow-[0_0_8px_rgba(207,255,80,0.2)]' : 'text-slate-400 bg-surface-panel hover:text-slate-300'"
                  title="Injected dynamically based on AI Mode/Hook Count settings"
                >{num_hooks}</span>
                <span 
                  class="font-mono px-1 rounded cursor-help transition-all" 
                  :class="promptText?.includes('{duration_constraint}') ? 'text-accent-500 bg-accent-500/10 ring-1 ring-accent-500/30 shadow-[0_0_8px_rgba(207,255,80,0.2)]' : 'text-slate-400 bg-surface-panel hover:text-slate-300'"
                  title="Injected dynamically based on video duration constraints"
                >{duration_constraint}</span>
              </div>
            </div>
            <PromptEditor 
              v-model="promptText"
            />
         </div>

         <div class="flex justify-end gap-3 mt-2">
           <button 
             v-if="editingId"
             @click="startNewPrompt"
             class="px-5 py-2.5 bg-surface-dark border border-surface-border text-slate-300 font-bold uppercase tracking-wider text-xs rounded-lg hover:text-white transition-all"
           >
             Cancel
           </button>
           <button 
             @click="savePrompt"
             :disabled="!promptName || !promptText"
             class="px-6 py-2.5 bg-accent-500 text-black font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-accent-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
           >
             {{ editingId ? 'Update Prompt' : 'Save New Prompt' }}
           </button>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const state = useClipperState()
const API_BASE = 'http://localhost:8000'

const editingId = ref<string | null>(null)
const promptName = ref('')
const suitableFor = ref<string[]>([])
const newTag = ref('')
const promptText = ref('')
const numHooks = ref(10)
const autoHooks = ref(false)

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
  promptName.value = p.name
  suitableFor.value = [...(p.suitableFor || [])]
  promptText.value = p.prompt || ''
  numHooks.value = p.numHooks ?? 10
  autoHooks.value = p.autoHooks ?? false
  newTag.value = ''
}

function startNewPrompt() {
  editingId.value = null
  promptName.value = ''
  suitableFor.value = []
  promptText.value = ''
  numHooks.value = 10
  autoHooks.value = false
  newTag.value = ''
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
      startNewPrompt()
    } catch (e) {
      state.showToast('Failed to save prompt', 'error')
    }
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
</style>
