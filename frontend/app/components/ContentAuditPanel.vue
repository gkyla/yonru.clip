<template>
  <div v-if="state" class="bg-surface-dark flex flex-col transition-all duration-500">
    <!-- Diagnostic fallback if audit is missing -->
    <div v-if="!audit" class="p-8 text-center bg-surface-card/30">
      <Icon name="ri:loader-4-line" class="text-3xl text-accent-500 animate-spin mb-2" />
      <p class="text-accent-500 text-xs font-black uppercase tracking-widest">Audit Engine Loading</p>
      <p class="text-slate-500 text-[10px] mt-1 italic">Waiting for transcript data...</p>
    </div>

    <template v-else>
      <div 
        class="px-4 py-3 bg-surface-card border-b border-surface-border flex items-center justify-between cursor-pointer hover:bg-surface-card/80 shrink-0 transition-all duration-500"
        :class="{'ring-1 ring-inset ring-rose-500 shadow-[inset_0_0_10px_rgba(244,63,94,0.3)] animate-pulse': audit && audit.flaggedWords.length > 0}"
        @click="$emit('toggle-expand')"
      >
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full animate-pulse" :class="scoreColorClass"></div>
          <h3 class="text-[10px] font-black uppercase tracking-tighter italic text-slate-200">Content Safety Audit</h3>
        </div>
        <div class="flex items-center gap-1.5">
           <span class="text-xs font-black italic tracking-tighter" :class="scoreTextClass">{{ audit ? Math.round(audit.score) : 'Lite' }}</span>
           <Icon name="ri:shield-check-fill" :class="scoreTextClass" class="text-sm" />
           <Icon :name="expanded ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500 text-lg ml-1" />
        </div>
      </div>

      <!-- Body wrapper with CSS grid for smooth auto-height animation -->
      <div 
        class="grid transition-[grid-template-rows] duration-500 ease-in-out"
        :style="{ gridTemplateRows: expanded ? '1fr' : '0fr' }"
      >
        <div class="overflow-hidden">
          <!-- Safety Meter -->
          <div class="p-4 space-y-5 custom-scrollbar min-h-0 overflow-y-auto" style="max-height: calc(75vh - 45px);">
            <div>
              <div class="flex justify-between items-end mb-3">
                <div>
                  <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mb-1">Global Safety Meter</p>
                  <p class="text-xs font-black italic tracking-tighter" :class="scoreTextClass">
                    {{ scoreLabel }}
                  </p>
                </div>
                <div class="text-right">
                   <span class="text-2xl font-black italic tracking-tighter" :class="scoreTextClass">{{ Math.round(audit.score) }}</span>
                   <span class="text-[10px] text-slate-600 font-bold ml-1">/100</span>
                </div>
              </div>
          
          <!-- Progress Bar -->
          <div class="h-3 bg-white/5 rounded-full p-0.5 overflow-hidden flex gap-0.5">
             <div 
               v-for="i in 20" :key="i"
               class="h-full flex-1 transition-all duration-700"
               :class="[
                 i <= (audit.score / 5) ? scoreBgClass : 'bg-white/5',
                 i === 1 ? 'rounded-l-sm' : '',
                 i === 20 ? 'rounded-r-sm' : ''
               ]"
               :style="{ transitionDelay: (i * 20) + 'ms' }"
             ></div>
          </div>
        </div>

        <!-- Detail Checks -->
        <div class="grid grid-cols-1 gap-3">
          <!-- Technical: Duration -->
          <div class="bg-surface-card/50 border border-surface-border/50 rounded-xl p-3 flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" :class="audit.isDurationOk ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'">
              <Icon :name="audit.isDurationOk ? 'ri:time-line' : 'ri:error-warning-line'" class="text-lg" />
            </div>
            <div class="flex-1 min-w-0">
               <div class="flex items-center justify-between mb-0.5">
                 <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Content Duration</p>
                 <Icon :name="audit.isDurationOk ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'" :class="audit.isDurationOk ? 'text-emerald-500' : 'text-amber-500'" class="text-xs" />
               </div>
               <p class="text-xs text-slate-200 font-medium">{{ audit.durationReason }} ({{ Math.round(state.timelineDuration.value) }}s)</p>
            </div>
          </div>

          <!-- Safety: Subtitles -->
          <div class="bg-surface-card/50 border border-surface-border/50 rounded-xl p-3 flex flex-col gap-3">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" :class="audit.flaggedWords.length === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'">
                <Icon :name="audit.flaggedWords.length === 0 ? 'ri:chat-check-line' : 'ri:chat-delete-line'" class="text-lg" />
              </div>
              <div class="flex-1 min-w-0">
                 <div class="flex items-center justify-between mb-0.5">
                   <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Subtitle Safety</p>
                   <Icon :name="audit.flaggedWords.length === 0 ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'" :class="audit.flaggedWords.length === 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-xs" />
                 </div>
                 <p class="text-xs text-slate-200 font-medium">{{ audit.flaggedWords.length === 0 ? 'No sensitive words detected' : `${audit.flaggedWords.length} sensitive words found` }}</p>
              </div>
            </div>

            <!-- Flagged Words List -->
            <div v-if="audit.flaggedWords.length > 0" class="pl-11 space-y-3">
               <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest">Shadowban Keywords Detected:</p>
               <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="word in audit.flaggedWords" :key="word"
                    class="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] font-bold rounded-md border border-rose-500/30 flex items-center gap-1.5"
                  >
                    <Icon name="ri:alarm-warning-line" class="text-[10px]" />
                    {{ word }}
                  </span>
               </div>
               
               <button 
                 @click="state.maskFlaggedWords()"
                 class="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
               >
                 <Icon name="ri:magic-line" />
                 Auto-Fix (Mask Words)
               </button>

               <p class="text-[9px] text-slate-500 italic">Flagged words appear as "K*lling" or "Unal*ve" to bypass automated filters.</p>
            </div>
          </div>
        </div>

        <hr class="border-surface-border/50" />

        <!-- Deep Audit Section -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-1.5">
              <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">AI Context Audit (Tier 2)</p>
              <div class="group relative flex items-center">
                <Icon name="ri:information-line" class="text-slate-500 hover:text-slate-300 text-xs cursor-help transition-colors" />
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-surface-dark border border-surface-border rounded shadow-xl text-[9px] font-mono text-slate-300 leading-tight opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 normal-case tracking-normal text-center">
                  Use Gemini AI to detect hidden shadowban risks, nuanced policy violations, and inflammatory tone.
                </div>
              </div>
            </div>
            <div v-if="state.deepAuditResults.value" class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[9px] font-black rounded uppercase">Deep Scan Active</div>
          </div>
          
          <button 
            v-if="!state.deepAuditResults.value"
            @click="state.runDeepAudit()"
            :disabled="state.isDeepAuditing.value"
            class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            <Icon :name="state.isDeepAuditing.value ? 'ri:loader-4-line' : 'ri:brain-line'" :class="{ 'animate-spin': state.isDeepAuditing.value }" />
            {{ state.isDeepAuditing.value ? 'Scanning Context...' : 'Analyze Context & Tone' }}
          </button>

          <div v-else class="space-y-4">
             <div class="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl relative overflow-hidden">
                <div class="absolute top-0 right-0 p-2 opacity-20">
                   <Icon name="ri:brain-line" class="text-2xl text-blue-400" />
                </div>
                <div class="flex items-center gap-2 mb-2">
                   <div class="w-1.5 h-1.5 rounded-full" :class="state.deepAuditResults.value.riskLevel === 'high' ? 'bg-rose-500 animate-pulse' : (state.deepAuditResults.value.riskLevel === 'medium' ? 'bg-amber-400' : 'bg-emerald-400')"></div>
                   <span class="text-[10px] font-black uppercase text-blue-300">Risk Assessment: {{ state.deepAuditResults.value.riskLevel }}</span>
                </div>
                <p class="text-[11px] text-slate-300 italic mb-3 pr-6 leading-relaxed">{{ state.deepAuditResults.value.suggestions }}</p>
                
                <div v-if="state.deepAuditResults.value.violations?.length" class="space-y-1.5">
                   <div v-for="(v, i) in state.deepAuditResults.value.violations" :key="i" class="flex items-start gap-2 text-[10px] text-slate-400">
                      <Icon name="ri:alert-line" class="text-amber-500 mt-0.5 flex-shrink-0" />
                      <span>{{ v }}</span>
                   </div>
                </div>
             </div>
             
             <button 
               @click="state.deepAuditResults.value = null"
               class="w-full py-2 text-[9px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
             >
               Reset AI Scan
             </button>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="pt-2">
          <button 
            class="w-full py-2.5 bg-surface-card hover:bg-surface-card/80 border border-surface-border text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 group"
            @click="$emit('settings')"
          >
            <Icon name="ri:equalizer-line" class="text-xs group-hover:rotate-90 transition-transform" />
            Customize Filter Blacklist
          </button>
        </div>
        </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'

const state = useClipperState()

const audit = computed(() => {
  const res = state?.contentAudit?.value
  console.log('[Audit] New data:', res)
  return res
})

onMounted(() => {
  console.log('[Audit] Component Mounted. State:', !!state)
})

const scoreLabel = computed(() => {
  if (!audit.value) return 'ANALYZING...'
  const score = audit.value.score
  if (score >= 90) return 'EXCELLENT ELIGIBILITY'
  if (score >= 70) return 'GOOD - MINOR RISKS'
  if (score >= 40) return 'CAUTION - RESTRICTED'
  return 'HIGH RISK OF SHADOWBAN'
})

const scoreColorClass = computed(() => {
  if (!audit.value) return 'bg-slate-500'
  const score = audit.value.score
  if (score >= 90) return 'text-emerald-500'
  if (score >= 70) return 'text-accent-500'
  if (score >= 40) return 'text-amber-500'
  return 'text-rose-500'
})

const scoreTextClass = computed(() => {
  if (!audit.value) return 'text-slate-500'
  const score = audit.value.score
  if (score >= 90) return 'text-emerald-500'
  if (score >= 70) return 'text-accent-500'
  if (score >= 40) return 'text-amber-500'
  return 'text-rose-500'
})

const scoreBgClass = computed(() => {
  if (!audit.value) return 'bg-slate-500'
  const score = audit.value.score
  if (score >= 90) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
  if (score >= 70) return 'bg-accent-500 shadow-[0_0_8px_rgba(207,255,80,0.5)]'
  if (score >= 40) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
  return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
})

defineProps({
  expanded: { type: Boolean, default: false }
})

defineEmits(['settings', 'toggle-expand'])
</script>
