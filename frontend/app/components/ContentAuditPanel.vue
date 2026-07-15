<template>
  <div v-if="state" class="bg-transparent flex flex-col transition-all duration-500">
    <!-- Diagnostic fallback if audit is missing -->
    <div v-if="!audit" class="p-8 text-center bg-surface-card/30">
      <Icon name="ri:loader-4-line" class="text-3xl text-accent-500 animate-spin mb-2" />
      <p class="text-accent-500 text-xs font-black uppercase tracking-widest">Audit Engine Loading</p>
      <p class="text-slate-500 text-[10px] mt-1 italic">Waiting for transcript data...</p>
    </div>

    <template v-else>
      <div 
        class="px-4 h-10 border-b border-surface-border/30 flex items-center justify-between cursor-pointer hover:bg-white/[0.03] shrink-0 transition-all duration-500"
        :class="audit && audit.flaggedWords.length > 0 
          ? 'bg-rose-500/5 border-rose-500/20 text-rose-400 hover:bg-rose-500/10' 
          : 'bg-transparent text-slate-400'"
        @click="$emit('toggle-expand')"
      >
        <div class="flex items-center gap-2">
          <Icon :name="audit && audit.flaggedWords.length > 0 ? 'ri:shield-flash-line' : 'ri:shield-keyhole-line'" :class="audit && audit.flaggedWords.length > 0 ? 'text-rose-500' : 'text-accent-500'" class="text-xs" />
          <h3 class="text-[10px] font-bold uppercase tracking-widest" :class="audit && audit.flaggedWords.length > 0 ? 'text-rose-300' : 'text-slate-400'">Content Safety Audit</h3>
          
          <!-- Glowing Warning Light for risks -->
          <span v-if="audit && audit.flaggedWords.length > 0" class="relative flex h-1.5 w-1.5 ml-0.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
          </span>
          <div v-else class="w-1.5 h-1.5 rounded-full ml-0.5" :class="scoreBgClass"></div>
        </div>
        <div class="flex items-center">
           <!-- Violations count badge in header -->
           <span class="text-xs font-black tracking-tighter mr-2" :class="scoreTextClass">{{ audit ? Math.round(audit.score) : 'Lite' }}</span>
           <span 
             v-if="audit && audit.flaggedWords.length > 0" 
             class="px-1 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[8px] font-black uppercase tracking-wider flex items-center gap-1"
           >
             <Icon name="ri:alert-line" class="text-[9px]" />
             {{ audit.flaggedWords.length }} {{ audit.flaggedWords.length === 1 ? 'Risk' : 'Risks' }}
           </span>
           <Icon :name="audit && audit.flaggedWords.length > 0 ? 'ri:shield-alert-fill' : 'ri:shield-check-fill'" :class="scoreTextClass" class="text-sm" />
           <Icon :name="expanded ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-slate-500 text-lg ml-1" />
        </div>
      </div>

      <!-- Body wrapper with CSS grid for smooth auto-height animation -->
      <div 
        class="grid transition-[grid-template-rows] duration-500 ease-in-out"
        :style="{ gridTemplateRows: expanded ? '1fr' : '0fr' }"
      >
        <div class="overflow-hidden">
          <!-- Safety Bento Card -->
          <div class="p-4 space-y-4 custom-scrollbar min-h-0 overflow-y-auto" style="max-height: 420px;">
            <!-- Warnings Ignored Banner -->
            <div 
              v-if="state.isWarningIgnored.value" 
              class="px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-center justify-between gap-3 text-amber-400/90 transition-all duration-300"
            >
              <div class="flex items-center gap-2">
                <Icon name="ri:error-warning-line" class="text-xs text-amber-500 animate-pulse" />
                <span class="text-[9px] font-black uppercase tracking-widest leading-none">Warnings Ignored</span>
              </div>
              <button 
                @click="state.restoreSafetyWarnings()"
                class="px-2 py-1 bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-wider transition-colors"
              >
                Restore
              </button>
            </div>
            <!-- Bento Score Card with Radial SVG Progress Ring -->
            <div class="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex justify-center items-center gap-4 relative group hover:border-white/10 transition-colors">
              <!-- Background Glow Container to clip the radial glow without clipping the tooltip -->
              <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div class="absolute -left-6 -bottom-6 w-24 h-24 rounded-full blur-2xl opacity-10 transition-opacity group-hover:opacity-20" :class="scoreBgClass"></div>
              </div>
              
              <!-- SVG Radial Gauge Ring -->
              <div class="relative w-14 h-14 flex items-center justify-center flex-shrink-0 z-10">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 56 56">
                  <!-- Background Track Circle -->
                  <circle 
                    cx="28" cy="28" r="24" 
                    fill="transparent" 
                    class="stroke-white/5" 
                    stroke-width="4.5"
                  />
                  <!-- Colored Progress Circle -->
                  <circle 
                    cx="28" cy="28" r="24" 
                    fill="transparent" 
                    class="transition-all duration-1000 ease-out"
                    :class="[
                      audit.score >= 90 ? 'stroke-emerald-500' :
                      audit.score >= 70 ? 'stroke-accent-500' :
                      audit.score >= 40 ? 'stroke-amber-500' :
                      'stroke-rose-500'
                    ]"
                    stroke-width="4.5"
                    stroke-linecap="round"
                    :stroke-dasharray="150.79"
                    :stroke-dashoffset="150.79 * (1 - audit.score / 100)"
                  />
                </svg>
                <!-- Centered Score Text -->
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-sm font-black tracking-tight" :class="scoreTextClass">{{ Math.round(audit.score) }}</span>
                </div>
              </div>

              <!-- Labels -->
              <div class="flex flex-col gap-1 z-10 flex-1 min-w-0">
                <span class="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-none">Safety Eligibility</span>
                <span class="text-xs font-bold tracking-tight uppercase truncate" :class="scoreTextClass">
                  {{ scoreLabel }}
                </span>
              </div>

              <!-- Info Tooltip (Right) -->
              <div class="relative group/tooltip flex items-center flex-shrink-0 z-[99]">
                <Icon name="ri:question-line" class="text-slate-500 hover:text-slate-300 text-sm cursor-help transition-colors" />
                <div class="absolute top-full right-0 mt-1.5 w-56 p-2.5 bg-surface-dark/95 border border-surface-border/80 rounded-xl shadow-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-[9px] text-slate-300 leading-normal opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200 z-30 tracking-normal normal-case">
                  <p class="font-bold text-slate-200 mb-1 border-b border-white/5 pb-1">Safety Classifications:</p>
                  <ul class="space-y-1">
                    <li><span class="text-emerald-400 font-semibold">Excellent:</span> Safe from filters, maximum reach.</li>
                    <li><span class="text-accent-400 font-semibold">Caution:</span> Minor duration or word warning.</li>
                    <li><span class="text-amber-400 font-semibold">Restricted:</span> Mild profanity; limited recommendation.</li>
                    <li><span class="text-rose-400 font-semibold">Danger:</span> High risk of shadowban or policy violation.</li>
                  </ul>
                </div>
              </div>
            </div>

        <!-- Detail Checks -->
        <div class="grid grid-cols-1 gap-3">
          <!-- Safe Zone Collision Audit -->
          <div 
            class="border rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-500"
            :class="state.layoutAudit.value.isSafe 
              ? 'bg-surface-card/50 border-surface-border/50' 
              : 'bg-amber-500/5 border-amber-500/20'"
          >
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" :class="state.layoutAudit.value.isSafe ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'">
                <Icon :name="state.layoutAudit.value.isSafe ? 'ri:layout-grid-line' : 'ri:error-warning-line'" class="text-lg" />
              </div>
              <div class="flex-1 min-w-0">
                 <div class="flex items-center justify-between mb-0.5">
                   <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Safe Zone Alignment</p>
                   <Icon :name="state.layoutAudit.value.isSafe ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'" :class="state.layoutAudit.value.isSafe ? 'text-emerald-500' : 'text-amber-500'" class="text-xs" />
                 </div>
                 <p class="text-xs text-slate-200 font-medium">{{ state.layoutAudit.value.reason }}</p>
              </div>
            </div>
            
            <!-- Auto-fix action for safe zone collision -->
            <div v-if="!state.layoutAudit.value.isSafe" class="pl-11">
               <button 
                 @click="state.fitSubtitlesToSafeZone()"
                 class="w-full py-1.5 bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
               >
                 <Icon name="ri:focus-3-line" class="group-hover:scale-110 transition-transform" />
                 Auto-Fit to Safe Zone
               </button>
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
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Shadowban & Slang Scan</p>
                    <Icon :name="audit.flaggedWords.length === 0 ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'" :class="audit.flaggedWords.length === 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-xs" />
                  </div>
                  <p class="text-xs text-slate-200 font-medium">{{ audit.flaggedWords.length === 0 ? 'No sensitive words or localized slang detected' : `${audit.flaggedWords.length} sensitive words/slang found` }}</p>
              </div>
            </div>

            <!-- Flagged Words List -->
            <div v-if="audit.flaggedWords.length > 0" class="pl-11 space-y-3">
               <p class="text-[9px] text-slate-500 font-black uppercase tracking-widest">Shadowban Keywords Detected:</p>
               <div class="flex flex-wrap gap-1.5">
                  <span 
                    v-for="word in audit.flaggedWords" :key="word"
                    class="px-2 py-0.5 bg-rose-950/30 text-rose-300 text-[10px] font-bold rounded-md border border-rose-500/20 flex items-center gap-1.5"
                  >
                    <Icon name="ri:alarm-warning-line" class="text-[10px] text-rose-500" />
                    {{ word }}
                  </span>
               </div>
               
               <button 
                  @click="state.maskFlaggedWords()"
                  class="w-full py-2 bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
                >
                 <Icon name="ri:magic-line" class="group-hover:rotate-12 transition-transform" />
                 Auto-Fix (Mask Words)
               </button>

               <p class="text-[9px] text-slate-500 italic">Flagged words appear as "K*lling" or "Unal*ve" to bypass automated filters.</p>
            </div>
          </div>
        </div>

        <!-- Subtitle Readability Section -->
        <div 
          class="border rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-500"
          :class="state.readabilityAudit.value.isSafe 
            ? 'bg-surface-card/50 border-surface-border/50' 
            : 'bg-amber-500/5 border-amber-500/20'"
        >
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" :class="state.readabilityAudit.value.isSafe ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'">
              <Icon :name="state.readabilityAudit.value.isSafe ? 'ri:font-size-2' : 'ri:font-color'" class="text-lg" />
            </div>
            <div class="flex-1 min-w-0">
               <div class="flex items-center justify-between mb-0.5">
                 <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Subtitle Readability</p>
                 <Icon :name="state.readabilityAudit.value.isSafe ? 'ri:checkbox-circle-fill' : 'ri:close-circle-fill'" :class="state.readabilityAudit.value.isSafe ? 'text-emerald-500' : 'text-amber-500'" class="text-xs" />
               </div>
               <p class="text-xs text-slate-200 font-medium">{{ state.readabilityAudit.value.reason }}</p>
            </div>
          </div>
          
          <!-- Auto-fix action for readability -->
          <div v-if="!state.readabilityAudit.value.isSafe" class="pl-11">
             <button 
               @click="state.fitSubtitlesToReadability()"
               class="w-full py-1.5 bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/[0.06] hover:border-white/20 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
             >
               <Icon name="ri:magic-line" class="group-hover:rotate-12 transition-transform" />
               Auto-Apply Text Outline
             </button>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="pt-2 flex flex-col gap-2">
          <button 
            v-if="!state.isWarningIgnored.value && audit && audit.score < 100"
            class="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 rounded-xl transition-all flex items-center justify-center gap-2 group active:scale-[0.98]"
            @click="state.ignoreSafetyWarnings()"
          >
            <Icon name="ri:spam-2-line" class="text-xs group-hover:scale-110 transition-transform" />
            Ignore Safety Warnings
          </button>

          <button 
            class="w-full py-2 bg-surface-card hover:bg-surface-card/80 border border-surface-border text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 group"
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
