<template>
  <div class="w-80 border-l border-white/10 bg-[#0e0e12]/90 backdrop-blur-xl flex flex-col overflow-hidden text-white relative">
    <!-- Content Safety Audit Panel -->
    <ContentAuditPanel
      class="border-b border-surface-border min-h-0 shrink-0"
      :expanded="isAuditExpanded"
      @toggle-expand="isAuditExpanded = !isAuditExpanded"
      @settings="emit('open-blacklist-settings')"
    />

    <div class="border-b border-surface-border/30 flex flex-col shrink-0">
      <div class="flex items-center justify-between px-4 h-10">
        <span class="text-[10px] uppercase text-slate-400 font-bold tracking-widest flex items-center gap-2">
          <Icon name="ri:list-settings-line" class="text-sky-500" /> Hooks Panel
        </span>
        <button
          v-if="state?.activeHook?.value && !isCurrentHookSaved"
          @click="emit('save-current-hook')"
          class="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all"
        >
          <Icon name="ri:bookmark-line" />
          Save Current
        </button>
        <button
          v-else-if="state?.activeHook?.value && isCurrentHookSaved"
          @click="emit('remove-current-saved-hook')"
          class="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter transition-all"
        >
          <Icon name="ri:delete-bin-line" />
          Remove Saved
        </button>
      </div>
      <div class="flex bg-black/40 border border-white/5 rounded-xl p-1 gap-1 mb-4 mx-4 mt-2">
        <button
          @click="emit('update:panelTab', 'generated')"
          class="flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
          :class="
            panelTab === 'generated'
              ? 'bg-white/10 text-amber-400 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
              : 'text-slate-400 border border-transparent hover:text-white'
          "
        >
          Generated ({{ state.hooks.value.length }})
        </button>
        <button
          @click="emit('update:panelTab', 'saved')"
          class="flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5"
          :class="
            panelTab === 'saved'
              ? 'bg-white/10 text-amber-400 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)]'
              : 'text-slate-400 border border-transparent hover:text-white'
          "
        >
          Saved ({{ state.savedHooks.value.length }})
        </button>
      </div>
    </div>

    <Transition name="panel-tab-fade" mode="out-in">
      <!-- Generated Tab -->
      <div
        v-if="panelTab === 'generated'"
        key="generated"
        ref="hooksContainer"
        class="flex-1 overflow-y-auto px-4 pb-4 pt-1.5 space-y-1.5 custom-scrollbar min-h-0"
      >
        <div v-if="!state.hooks.value.length" class="text-center text-slate-600 text-xs p-6">
          No hooks generated yet.
        </div>
        <button
          v-for="(hook, idx) in state.hooks.value"
          :key="idx"
          @click="emit('select-hook', hook)"
          :disabled="isOverlayVisible || isActiveHook(hook)"
          class="w-full text-left p-3.5 rounded-2xl border transition-all text-xs group relative hover:z-30 overflow-visible"
          :class="[
            isActiveHook(hook)
              ? 'bg-amber-500/[0.08] border-amber-500/60 text-amber-200 shadow-[0_4px_20px_rgba(245,158,11,0.08)] hook-item-active cursor-default'
              : 'bg-[#16161c]/60 border-white/10 hover:border-white/20 hover:bg-[#1f1f28]/70 text-slate-300',
            isOverlayVisible ? 'opacity-50 cursor-not-allowed' : ''
          ]"
        >
          <div class="flex justify-between items-center mb-1">
            <div class="flex items-center gap-2">
              <span
                class="font-bold text-[10px] uppercase tracking-wider"
                :class="isActiveHook(hook) ? 'text-amber-400' : 'text-slate-500'"
              >
                HOOK {{ String(Number(idx) + 1).padStart(2, '0') }}
              </span>

              <!-- Virality Score Badge -->
              <div
                v-if="hook.virality_score !== undefined"
                class="px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider flex items-center gap-0.5"
                :class="{
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40':
                    hook.virality_score >= 90,
                  'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40':
                    hook.virality_score >= 75 && hook.virality_score < 90,
                  'bg-slate-700/40 text-slate-300 border border-slate-600/40':
                    hook.virality_score < 75
                }"
              >
                <Icon
                  :name="
                    hook.virality_score >= 90
                      ? 'ri:fire-fill'
                      : hook.virality_score >= 75
                        ? 'ri:flashlight-fill'
                        : 'ri:bar-chart-2-fill'
                  "
                  class="text-[10px]"
                />
                <span>{{ hook.virality_score }}</span>
              </div>

              <!-- Ready Tooltip -->
              <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center z-20">
                <div
                  class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help"
                >
                  <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                </div>
                <div
                  class="absolute bottom-full ml-10 left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-[999] font-medium normal-case tracking-normal text-center"
                >
                  This clip has already been cut and transcribed, and is ready for editing!
                  <div
                    class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-slate-900"
                  ></div>
                </div>
              </div>
            </div>
            <span
              class="mono text-[10px]"
              :class="isActiveHook(hook) ? 'text-sky-400 font-bold' : 'text-slate-300'"
            >
              {{ state.formatDuration(hook.start) }} – {{ state.formatDuration(hook.end) }}
              <span class="ml-1 text-accent-500 font-bold">
                ({{
                  Math.floor(hook.end - hook.start) >= 60
                    ? Math.floor((hook.end - hook.start) / 60) +
                      'm ' +
                      Math.floor((hook.end - hook.start) % 60) +
                      's'
                    : Math.floor(hook.end - hook.start) + 's'
                }})
              </span>
            </span>
          </div>
          <p class="font-medium truncate" :class="isActiveHook(hook) ? 'text-white' : 'text-slate-300'">
            {{ hook.theme || 'Untitled' }}
          </p>
          <p class="text-[10px] mt-1 line-clamp-2 italic opacity-70">
            "{{
              (hook.transcript_quote || '').length > 80
                ? (hook.transcript_quote || '').substring(0, 77) + '...'
                : hook.transcript_quote || ''
            }}"
          </p>
        </button>
      </div>

      <!-- Saved Tab -->
      <div
        v-else
        key="saved"
        class="flex-1 overflow-y-auto px-4 pb-4 pt-1.5 space-y-1.5 custom-scrollbar min-h-0"
      >
        <div v-if="!state.savedHooks.value.length" class="text-center text-slate-600 text-xs p-6">
          No saved hooks for this video yet.
        </div>
        <button
          v-for="(hook, idx) in state.savedHooks.value"
          :key="hook._id || idx"
          @click="emit('select-hook', hook)"
          :disabled="isOverlayVisible || isActiveHook(hook)"
          class="w-full text-left p-3.5 rounded-2xl border transition-all text-xs group relative hover:z-30 overflow-visible"
          :class="[
            isActiveHook(hook)
              ? 'bg-amber-500/[0.08] border-amber-500/60 text-amber-200 shadow-[0_4px_20px_rgba(245,158,11,0.08)] hook-item-active cursor-default'
              : 'bg-[#16161c]/60 border-white/10 hover:border-white/20 hover:bg-[#1f1f28]/70 text-slate-300',
            isOverlayVisible ? 'opacity-50 cursor-not-allowed' : ''
          ]"
        >
          <div class="flex justify-between items-center mb-1">
            <div class="flex items-center gap-2">
              <span
                class="font-bold text-[10px] uppercase tracking-wider"
                :class="isActiveHook(hook) ? 'text-amber-400' : 'text-slate-500'"
              >
                SAVED {{ String(Number(idx) + 1).padStart(2, '0') }}
              </span>

              <!-- Virality Score Badge -->
              <div
                v-if="hook.virality_score !== undefined"
                class="px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider flex items-center gap-0.5"
                :class="{
                  'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40':
                    hook.virality_score >= 90,
                  'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40':
                    hook.virality_score >= 75 && hook.virality_score < 90,
                  'bg-slate-700/40 text-slate-300 border border-slate-600/40':
                    hook.virality_score < 75
                }"
              >
                <Icon
                  :name="
                    hook.virality_score >= 90
                      ? 'ri:fire-fill'
                      : hook.virality_score >= 75
                        ? 'ri:flashlight-fill'
                        : 'ri:bar-chart-2-fill'
                  "
                  class="text-[10px]"
                />
                <span>{{ hook.virality_score }}</span>
              </div>
              <div v-if="isHookRendered(hook)" class="relative group/tooltip flex items-center z-20">
                <div
                  class="text-emerald-400 text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-help"
                >
                  <Icon name="ri:checkbox-circle-fill" class="text-[10px]" /> Ready
                </div>
                <div
                  class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 border border-emerald-500/20 text-[10px] text-slate-200 p-2.5 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-50 font-medium normal-case tracking-normal text-center"
                >
                  This clip has already been cut and transcribed, and is ready for editing!
                  <div
                    class="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-slate-900"
                  ></div>
                </div>
              </div>
            </div>
            <span
              class="mono text-[10px]"
              :class="isActiveHook(hook) ? 'text-sky-400 font-bold' : 'text-slate-300'"
            >
              {{ state.formatDuration(hook.start) }} – {{ state.formatDuration(hook.end) }}
              <span class="ml-1 text-accent-500 font-bold">
                ({{
                  Math.floor(hook.end - hook.start) >= 60
                    ? Math.floor((hook.end - hook.start) / 60) +
                      'm ' +
                      Math.floor((hook.end - hook.start) % 60) +
                      's'
                    : Math.floor(hook.end - hook.start) + 's'
                }})
              </span>
            </span>
          </div>
          <p class="font-medium truncate" :class="isActiveHook(hook) ? 'text-white' : 'text-slate-300'">
            {{ hook.theme || 'Untitled' }}
          </p>
          <p class="text-[10px] mt-1 line-clamp-2 italic opacity-70">
            "{{
              (hook.transcript_quote || '').length > 80
                ? (hook.transcript_quote || '').substring(0, 77) + '...'
                : hook.transcript_quote || ''
            }}"
          </p>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { Hook } from '../../types/clipper'

const props = defineProps<{
  panelTab: 'generated' | 'saved'
  isCurrentHookSaved: boolean
  isOverlayVisible: boolean
  isHookRendered: (hook: Hook | null) => boolean
  isActiveHook: (hook: Hook) => boolean
}>()

const emit = defineEmits<{
  (e: 'update:panelTab', tab: 'generated' | 'saved'): void
  (e: 'select-hook', hook: Hook): void
  (e: 'save-current-hook'): void
  (e: 'remove-current-saved-hook'): void
  (e: 'open-blacklist-settings'): void
}>()

const state = useClipperState()
const isAuditExpanded = ref(false)
const hooksContainer = ref<HTMLElement | null>(null)

watch(
  [() => state.activeHook.value, () => state.hooks.value, () => state.savedHooks.value, () => props.panelTab],
  async () => {
    if (!state.activeHook.value) return

    await nextTick()
    setTimeout(() => {
      if (typeof document !== 'undefined') {
        const activeEl = document.querySelector('.hook-item-active')
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }, 100)
  },
  { immediate: true, deep: true }
)
</script>

<style scoped>
.panel-tab-fade-enter-active,
.panel-tab-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.panel-tab-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.panel-tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
