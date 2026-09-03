<template>
  <div class="px-8 w-full mb-14">
     <div class="bg-[#0b0c10] border border-surface-border/60 p-8 sm:p-12 rounded-none shadow-2xl flex flex-col items-center justify-center min-h-[450px] relative overflow-hidden w-full">
         <div class="absolute inset-0 bg-noise opacity-[0.02] mix-blend-overlay"></div>
         <!-- Dynamic atmospheric lighting that glows behind the active step -->
         <div class="absolute w-[300px] h-[300px] bg-accent-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none"></div>
         <div class="absolute w-[200px] h-[200px] bg-violet-500/5 rounded-full blur-[80px] animate-pulse pointer-events-none -mr-40 -mt-20"></div>

         <div class="flex flex-col items-center gap-1.5 mb-8 z-10 text-center">
           <span class="text-[9px] uppercase tracking-[0.25em] font-black text-accent-500 mb-1">AUTOMATED WORKFLOW</span>
           <h3 class="font-black text-white tracking-widest text-lg sm:text-xl uppercase bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-500">ANALYZING VIDEO CONTENT</h3>
           <p class="text-[10px] text-slate-400 normal-case tracking-normal">Server is executing ingestion pipeline. You can safely return to library while it runs.</p>
         </div>

         <!-- Bento Stepper Grid -->
         <div class="grid gap-4 w-full z-10 mb-8" :class="[stages.length === 1 ? 'max-w-md mx-auto grid-cols-1' : stages.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto w-full' : 'grid-cols-1 sm:grid-cols-4 w-full']">
           <div 
             v-for="(stg, idx) in stages" 
             :key="stg.id"
             class="border p-5 flex flex-col justify-between min-h-[120px] transition-all duration-700 ease-out relative group"
             :class="[
               stg.state === 'active' 
                 ? 'border-accent-500/40 bg-gradient-to-br from-accent-500/[0.04] to-violet-500/[0.02] shadow-[0_0_20px_rgba(207,255,80,0.08)]' 
                 : stg.state === 'completed'
                 ? 'border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400'
                 : 'border-surface-border/50 bg-black/10 text-slate-500 opacity-60'
             ]"
           >
             <!-- Shimmer line on active card -->
             <div 
                class="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-accent-500 to-violet-500 shadow-[0_0_10px_#CFFF50] transition-opacity duration-700 ease-out pointer-events-none"
                :class="stg.state === 'active' ? 'opacity-100' : 'opacity-0'"
              ></div>
             
             <div class="flex justify-between items-start mb-3">
               <div 
                 class="w-8 h-8 flex items-center justify-center border text-sm transition-all duration-700 ease-out group-hover:scale-105"
                 :class="[
                   stg.state === 'active' 
                     ? 'border-accent-500/30 text-accent-500 bg-accent-500/10 shadow-[0_0_10px_rgba(207,255,80,0.2)]' 
                     : stg.state === 'completed'
                     ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                     : 'border-surface-border/50 text-slate-500'
                 ]"
               >
                 <Icon :name="stg.icon" />
               </div>
               
               <!-- Indicator Badge -->
               <div class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border transition-all duration-700 ease-out"
                    :class="[
                      stg.state === 'active' 
                        ? 'border-accent-500/30 text-accent-500 bg-accent-500/5 animate-pulse' 
                        : stg.state === 'completed'
                        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5'
                        : 'border-surface-border/50 text-slate-500'
                    ]">
                 {{ stg.state }}
               </div>
             </div>

             <div>
               <h4 class="text-xs font-black uppercase tracking-wider mb-1 transition-colors duration-700 ease-out" :class="stg.state === 'pending' ? 'text-slate-400' : 'text-white'">
                 {{ idx + 1 }}. {{ stg.name }}
               </h4>
               <p class="text-[11px] leading-snug transition-all duration-700 ease-out" :class="stg.state === 'pending' ? 'text-slate-500' : stg.state === 'completed' ? 'text-emerald-400' : 'text-slate-300'">
                 {{ stg.description }}
               </p>
             </div>
           </div>
         </div>

         <!-- Glowing progress line -->
         <div class="w-full bg-black/40 border border-surface-border/50 h-2.5 overflow-hidden mb-8 relative z-10 p-[2px]">
            <div 
              class="h-full bg-gradient-to-r from-accent-500 to-violet-500 relative shadow-[0_0_12px_rgba(207,255,80,0.5)]" 
              :class="state.isCachedAnalysis.value && !isReanalyzingCached ? 'animate-progress-sweep' : 'transition-all duration-700 ease-out'"
              :style="state.isCachedAnalysis.value && !isReanalyzingCached ? {} : { width: `${progressPercent}%` }"
            >
              <div class="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-shimmer-fast bg-[length:200%_100%]"></div>
            </div>
         </div>

         <!-- Cyber-deck Status Details Card -->
         <div class="w-full bg-black/30 border border-surface-border/50 p-5 font-mono text-xs text-slate-300 text-left z-10 shadow-inner flex flex-col md:flex-row justify-between gap-5 relative">
           <div class="flex-1 flex flex-col gap-1.5">
              <div class="flex items-center gap-2 border-b border-surface-border/50 pb-2 mb-1.5">
                 <span class="text-accent-500 font-bold tracking-wider">PIPELINE STAGE</span>
                 <span class="text-slate-200 font-bold uppercase tracking-wider animate-pulse-subtle">» {{ state.jobStatus.value.replace('_', ' ') }}</span>
              </div>
              <p class="leading-relaxed"><span class="text-slate-400 font-bold mr-1">Active Task:</span> <span class="text-slate-200">{{ loadingLabel }}</span></p>
              <p class="leading-relaxed"><span class="text-slate-400 font-bold mr-1">Engine Stack:</span> <span class="text-slate-200">yt-dlp + FFmpeg + Whisper + Gemini Flash 2.5</span></p>
           </div>
           <div class="flex-1 md:border-l border-surface-border/50 md:pl-5 flex flex-col gap-1.5">
              <div class="flex justify-between border-b border-surface-border/50 pb-2 mb-1.5">
                 <span class="text-slate-400 font-bold">SYSTEM METADATA</span>
                 <span class="text-slate-200 font-bold">{{ state.jobId.value || '—' }}</span>
              </div>
              <p class="leading-relaxed"><span class="text-slate-400 font-bold mr-1">Model Configuration:</span> <span class="text-slate-200">Whisper {{ (state.whisperModel.value || 'base').toUpperCase() }}</span></p>
              <p class="leading-relaxed truncate"><span class="text-slate-400 font-bold mr-1">Prompt Guidelines:</span> <span class="text-slate-200">{{ state.selectedPrompt.value }}</span></p>
           </div>
         </div>

         <!-- Cancel Escape Route -->
         <button 
           @click="$emit('cancel')" 
           class="z-10 mt-8 h-9 px-6 bg-surface-dark border border-surface-border/80 hover:border-red-500/30 hover:text-red-400 rounded-none cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none select-none active:scale-98"
         >
           <Icon name="ri:close-circle-line" class="text-sm" />
           <span>Cancel & Return to Library</span>
         </button>
     </div>
  </div>
</template>

<script setup lang="ts">
interface StageItem {
  id: string
  name: string
  description: string
  icon: string
  state: string
}

defineProps<{
  stages: StageItem[]
  progressPercent: number
  loadingLabel: string
  isReanalyzingCached?: boolean
}>()

defineEmits<{
  (e: 'cancel'): void
}>()

const state = useClipperState()
</script>

<style scoped>
@keyframes shimmer-fast {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer-fast {
  animation: shimmer-fast 1.5s infinite linear;
}

@keyframes progress-sweep {
  0% { width: 0%; }
  100% { width: 100%; }
}

.animate-progress-sweep {
  animation: progress-sweep 800ms cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}
</style>
