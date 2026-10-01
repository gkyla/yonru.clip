<template>
  <div
    class="w-80 border-l border-surface-border bg-surface-panel/50 flex flex-col overflow-hidden text-white relative"
  >
    <!-- Content Safety Audit Panel -->
    <ContentAuditPanel
      class="border-b border-surface-border min-h-0 shrink-0"
      :expanded="isAuditExpanded"
      @toggle-expand="isAuditExpanded = !isAuditExpanded"
      @settings="emit('open-blacklist-settings')"
    />

    <div
      class="border-b border-surface-border/50 bg-surface-dark/40 flex flex-col shrink-0"
    >
      <div class="flex items-center justify-between px-3 h-10">
        <span
          class="text-[10px] uppercase text-slate-400 font-bold tracking-widest flex items-center gap-1.5"
        >
          <Icon name="ri:list-settings-line" class="text-sky-500 text-xs" />
          Hooks Panel
        </span>
        <button
          v-if="state?.activeHook?.value && !isCurrentHookSaved"
          type="button"
          class="flex items-center gap-1 bg-surface-card hover:bg-surface-border text-accent-500 border border-accent-500/30 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
          @click="emit('save-current-hook')"
        >
          <Icon name="ri:bookmark-line" class="text-xs" />
          <span>Save</span>
        </button>
        <button
          v-else-if="state?.activeHook?.value && isCurrentHookSaved"
          type="button"
          class="flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
          @click="emit('remove-current-saved-hook')"
        >
          <Icon name="ri:delete-bin-line" class="text-xs" />
          <span>Remove Saved</span>
        </button>
      </div>

      <!-- Segmented Tab Navigation Header -->
      <div
        class="grid grid-cols-2 gap-1 bg-surface-dark/80 p-0.5 rounded-xl border border-surface-border/60 mx-3 mb-2.5 mt-1"
      >
        <button
          type="button"
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="
            panelTab === 'generated'
              ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
          "
          @click="emit('update:panelTab', 'generated')"
        >
          <span>Generated</span>
          <span class="mono text-[8.5px] opacity-80 font-bold"
            >({{ state.hooks.value.length }})</span
          >
        </button>
        <button
          type="button"
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="
            panelTab === 'saved'
              ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20 font-bold'
              : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
          "
          @click="emit('update:panelTab', 'saved')"
        >
          <span>Saved</span>
          <span class="mono text-[8.5px] opacity-80 font-bold"
            >({{ state.savedHooks.value.length }})</span
          >
        </button>
      </div>
    </div>

    <Transition name="panel-tab-fade" mode="out-in">
      <!-- Generated Tab -->
      <div
        v-if="panelTab === 'generated'"
        key="generated"
        ref="hooksContainer"
        class="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2 custom-scrollbar min-h-0"
      >
        <div
          v-if="!state.hooks.value.length"
          class="text-center text-slate-500 text-xs p-6 italic"
        >
          No hooks generated yet.
        </div>
        <button
          v-for="(hook, idx) in state.hooks.value"
          :key="idx"
          type="button"
          :disabled="isOverlayVisible || isActiveHook(hook)"
          class="w-full text-left p-3 rounded-xl border transition-all text-xs group relative hover:z-30 overflow-visible"
          :class="[
            isActiveHook(hook)
              ? 'border-accent-500/50 bg-surface-dark/50 text-white hook-item-active cursor-default shadow-sm'
              : 'bg-surface-dark/50 border-surface-border hover:border-accent-500/30 hover:bg-surface-card text-slate-300',
            isOverlayVisible ? 'opacity-50 cursor-not-allowed' : ''
          ]"
          @click="emit('select-hook', hook)"
        >
          <!-- Row 1: Header (Identity on left, Metrics & Duration on right) -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span
              class="font-bold text-[10px] uppercase tracking-wider shrink-0"
              :class="isActiveHook(hook) ? 'text-accent-500' : 'text-slate-500'"
            >
              HOOK {{ String(Number(idx) + 1).padStart(2, '0') }}
            </span>

            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Virality Score Badge -->
              <div
                v-if="hook.virality_score !== undefined"
                class="px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-wider flex items-center gap-0.5 border shrink-0"
                :class="{
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30':
                    hook.virality_score >= 90,
                  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30':
                    hook.virality_score >= 75 && hook.virality_score < 90,
                  'bg-surface-dark/80 text-slate-400 border-surface-border':
                    hook.virality_score < 75
                }"
              >
                <Icon
                  :name="
                    hook.virality_score >= 90
                      ? 'fluent-emoji-flat:fire'
                      : hook.virality_score >= 75
                        ? 'emojione-v1:lightning-mood'
                        : 'ri:bar-chart-2-fill'
                  "
                  class="text-[9.5px] mr-0.5"
                />
                <span>{{ hook.virality_score }}</span>
              </div>

              <!-- Duration Chip -->
              <div
                class="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-dark/80 border border-surface-border/60 text-[9px] font-mono font-semibold"
                :class="
                  isActiveHook(hook)
                    ? 'text-accent-500 border-accent-500/30'
                    : 'text-slate-300'
                "
              >
                <Icon name="ri:time-line" class="text-[9.5px] opacity-70" />
                <span>{{ formatTotalDuration(hook) }}</span>
              </div>
            </div>
          </div>

          <!-- Row 2: Body (Theme Title & Transcript Quote) -->
          <p
            class="font-bold text-[12px] leading-snug truncate"
            :class="isActiveHook(hook) ? 'text-white' : 'text-slate-200'"
          >
            {{ hook.theme || 'Untitled' }}
          </p>
          <p
            class="text-[10.5px] mt-1 line-clamp-2 italic text-slate-400 group-hover:text-slate-300 leading-relaxed"
          >
            "{{
              (hook.transcript_quote || '').length > 80
                ? (hook.transcript_quote || '').substring(0, 77) + '...'
                : hook.transcript_quote || ''
            }}"
          </p>

          <!-- Row 3: Footer Meta Bar (Start-End Timestamp Range on left, Ready/Active status on right) -->
          <div
            class="border-t border-surface-border/40 pt-1.5 mt-2 flex items-center justify-between text-[10px] font-mono"
            :class="
              isActiveHook(hook)
                ? 'border-accent-500/20 text-slate-300'
                : 'text-slate-400'
            "
          >
            <div class="flex items-center gap-1.5">
              <Icon name="ri:movie-2-line" class="text-[11px] text-slate-500" />
              <span>{{ state.formatDuration(hook.start) }}</span>
              <span class="text-slate-600 font-sans text-[9px]">→</span>
              <span>{{ state.formatDuration(hook.end) }}</span>
            </div>

            <!-- Right Status Slot: Active, Ready Badge, or Select Link -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="isActiveHook(hook)"
                class="text-[9px] font-sans font-bold uppercase tracking-wider text-accent-500 flex items-center gap-1"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse"
                ></span>
                Active
              </span>
              <div
                v-if="isHookRendered(hook)"
                class="relative group/tooltip flex items-center z-20 shrink-0"
              >
                <div
                  class="px-1.5 py-0.5 rounded text-emerald-400 text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-help"
                >
                  <Icon name="ri:checkbox-circle-fill" class="text-[9.5px]" />
                  Ready
                </div>
                <div
                  class="absolute bottom-full right-0 mb-2 w-52 bg-surface-dark/95 border border-emerald-500/30 text-[10px] text-slate-200 p-2 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-50 font-medium normal-case tracking-normal text-center backdrop-blur-sm"
                >
                  This clip has already been cut and transcribed, and is ready
                  for editing!
                  <div
                    class="absolute top-full right-4 -mt-[5px] border-4 border-transparent border-t-surface-dark"
                  ></div>
                </div>
              </div>
              <span
                v-if="!isActiveHook(hook) && !isHookRendered(hook)"
                class="text-[9px] font-sans text-slate-500 group-hover:text-slate-300 flex items-center gap-0.5 transition-colors"
              >
                Select
                <Icon
                  name="ri:arrow-right-s-line"
                  class="text-xs transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </div>
        </button>
      </div>

      <!-- Saved Tab -->
      <div
        v-else
        key="saved"
        class="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2 custom-scrollbar min-h-0"
      >
        <div
          v-if="!state.savedHooks.value.length"
          class="text-center text-slate-500 text-xs p-6 italic"
        >
          No saved hooks for this video yet.
        </div>
        <button
          v-for="(hook, idx) in state.savedHooks.value"
          :key="hook._id || idx"
          type="button"
          :disabled="isOverlayVisible || isActiveHook(hook)"
          class="w-full text-left p-3 rounded-xl border transition-all text-xs group relative hover:z-30 overflow-visible"
          :class="[
            isActiveHook(hook)
              ? 'border-accent-500 bg-surface-dark/50 text-white hook-item-active cursor-default shadow-sm'
              : 'bg-surface-dark/50 border-surface-border hover:border-accent-500/30 hover:bg-surface-card text-slate-300',
            isOverlayVisible ? 'opacity-50 cursor-not-allowed' : ''
          ]"
          @click="emit('select-hook', hook)"
        >
          <!-- Row 1: Header (Identity on left, Metrics & Duration on right) -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span
              class="font-bold text-[10px] uppercase tracking-wider shrink-0"
              :class="isActiveHook(hook) ? 'text-accent-500' : 'text-slate-500'"
            >
              SAVED {{ String(Number(idx) + 1).padStart(2, '0') }}
            </span>

            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Virality Score Badge -->
              <div
                v-if="hook.virality_score !== undefined"
                class="px-1.5 py-0.5 rounded text-[8.5px] font-bold tracking-wider flex items-center gap-0.5 border shrink-0"
                :class="{
                  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30':
                    hook.virality_score >= 90,
                  'bg-cyan-500/10 text-cyan-400 border-cyan-500/30':
                    hook.virality_score >= 75 && hook.virality_score < 90,
                  'bg-surface-dark/80 text-slate-400 border-surface-border':
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
                  class="text-[9.5px]"
                />
                <span>{{ hook.virality_score }}</span>
              </div>

              <!-- Duration Chip -->
              <div
                class="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-dark/80 border border-surface-border/60 text-[9px] font-mono font-semibold"
                :class="
                  isActiveHook(hook)
                    ? 'text-accent-500 border-accent-500/30'
                    : 'text-slate-400'
                "
              >
                <Icon name="ri:time-line" class="text-[9.5px] opacity-70" />
                <span>{{ formatTotalDuration(hook) }}</span>
              </div>
            </div>
          </div>

          <!-- Row 2: Body (Theme Title & Transcript Quote) -->
          <p
            class="font-bold text-[12px] leading-snug truncate"
            :class="isActiveHook(hook) ? 'text-white' : 'text-slate-200'"
          >
            {{ hook.theme || 'Untitled' }}
          </p>
          <p
            class="text-[10.5px] mt-1 line-clamp-2 italic text-slate-400 group-hover:text-slate-300 leading-relaxed"
          >
            "{{
              (hook.transcript_quote || '').length > 80
                ? (hook.transcript_quote || '').substring(0, 77) + '...'
                : hook.transcript_quote || ''
            }}"
          </p>

          <!-- Row 3: Footer Meta Bar (Start-End Timestamp Range on left, Ready/Active status on right) -->
          <div
            class="border-t border-surface-border/40 pt-1.5 mt-2 flex items-center justify-between text-[10px] font-mono"
            :class="
              isActiveHook(hook)
                ? 'border-accent-500/20 text-slate-300'
                : 'text-slate-400'
            "
          >
            <div class="flex items-center gap-1.5">
              <Icon name="ri:movie-2-line" class="text-[11px] text-slate-500" />
              <span>{{ state.formatDuration(hook.start) }}</span>
              <span class="text-slate-600 font-sans text-[9px]">→</span>
              <span>{{ state.formatDuration(hook.end) }}</span>
            </div>

            <!-- Right Status Slot: Active, Ready Badge, or Select Link -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                v-if="isActiveHook(hook)"
                class="text-[9px] font-sans font-bold uppercase tracking-wider text-accent-500 flex items-center gap-1"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse"
                ></span>
                Active
              </span>
              <div
                v-if="isHookRendered(hook)"
                class="relative group/tooltip flex items-center z-20 shrink-0"
              >
                <div
                  class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[8px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-help"
                >
                  <Icon name="ri:checkbox-circle-fill" class="text-[9.5px]" />
                  Ready
                </div>
                <div
                  class="absolute bottom-full right-0 mb-2 w-52 bg-surface-dark/95 border border-emerald-500/30 text-[10px] text-slate-200 p-2 rounded-lg shadow-xl opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all translate-y-1 group-hover/tooltip:translate-y-0 z-50 font-medium normal-case tracking-normal text-center backdrop-blur-sm"
                >
                  This clip has already been cut and transcribed, and is ready
                  for editing!
                  <div
                    class="absolute top-full right-4 -mt-[5px] border-4 border-transparent border-t-surface-dark"
                  ></div>
                </div>
              </div>
              <span
                v-if="!isActiveHook(hook) && !isHookRendered(hook)"
                class="text-[9px] font-sans text-slate-500 group-hover:text-slate-300 flex items-center gap-0.5 transition-colors"
              >
                Select
                <Icon
                  name="ri:arrow-right-s-line"
                  class="text-xs transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </div>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { Hook } from '../../types/clipper';

const props = defineProps<{
  panelTab: 'generated' | 'saved';
  isCurrentHookSaved: boolean;
  isOverlayVisible: boolean;
  isHookRendered: (hook: Hook | null) => boolean;
  isActiveHook: (hook: Hook) => boolean;
}>();

const emit = defineEmits<{
  (e: 'update:panelTab', tab: 'generated' | 'saved'): void;
  (e: 'select-hook', hook: Hook): void;
  (e: 'save-current-hook'): void;
  (e: 'remove-current-saved-hook'): void;
  (e: 'open-blacklist-settings'): void;
}>();

const state = useClipperState();
const isAuditExpanded = ref(false);
const hooksContainer = ref<HTMLElement | null>(null);

function formatTotalDuration(hook: { start: number; end: number }): string {
  const diff = Math.max(0, Math.floor(hook.end - hook.start));
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

watch(
  [
    () => state.activeHook.value,
    () => state.hooks.value,
    () => state.savedHooks.value,
    () => props.panelTab
  ],
  async () => {
    if (!state.activeHook.value) return;

    await nextTick();
    setTimeout(() => {
      if (typeof document !== 'undefined') {
        const activeEl = document.querySelector('.hook-item-active');
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 100);
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.panel-tab-fade-enter-active,
.panel-tab-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
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
