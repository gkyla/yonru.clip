<template>
  <div class="flex items-center h-full relative">
    <!-- Editor Workspace Action Rail (Positioned directly beside VideoPreview) -->
    <div
      v-if="state?.activeHook?.value"
      class="flex flex-col items-center gap-3 z-[60] relative"
    >
      <!-- Subtitles Button -->
      <div class="relative group">
        <button
          @click="toggleTab('edit')"
          class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md"
          style="border-radius: 10px;"
          :class="
            isPanelOpen && editorTab === 'edit'
              ? 'bg-accent-500/20 text-accent-500 border-accent-500/40 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
              : 'bg-[#0e0e12]/90 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
          "
        >
          <Icon name="ri:edit-box-line" class="text-lg" />
        </button>
        <div
          class="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 border border-white/10 shadow-lg pointer-events-none rounded-lg z-[70]"
        >
          Subtitles
        </div>
      </div>

      <!-- Thumbnail Button -->
      <div class="relative group">
        <button
          @click="toggleTab('thumbnail')"
          class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md"
          style="border-radius: 10px;"
          :class="
            isPanelOpen && editorTab === 'thumbnail'
              ? 'bg-accent-500/20 text-accent-500 border-accent-500/40 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
              : 'bg-[#0e0e12]/90 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
          "
        >
          <Icon name="ri:image-line" class="text-lg" />
        </button>
        <div
          class="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 border border-white/10 shadow-lg pointer-events-none rounded-lg z-[70]"
        >
          Thumbnail
        </div>
      </div>

      <!-- Raw Quote Button -->
      <div class="relative group">
        <button
          @click="toggleTab('quote')"
          class="w-9 h-9 flex items-center justify-center border transition-all duration-200 shadow-md"
          style="border-radius: 10px;"
          :class="
            isPanelOpen && editorTab === 'quote'
              ? 'bg-accent-500/20 text-accent-500 border-accent-500/40 shadow-[0_0_12px_rgba(207,255,80,0.25)]'
              : 'bg-[#0e0e12]/90 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
          "
        >
          <Icon name="ri:double-quotes-l" class="text-lg" />
        </button>
        <div
          class="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 hidden group-hover:block whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2.5 py-1 border border-white/10 shadow-lg pointer-events-none rounded-lg z-[70]"
        >
          Raw Quote
        </div>
      </div>
    </div>

    <!-- Floating Subtitle Panel (Drawer Overlay) -->
    <Transition
      enter-active-class="transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform"
      enter-from-class="translate-x-full opacity-0"
      enter-to-class="translate-x-0 opacity-100"
      leave-active-class="transition-all duration-200 ease-[cubic-bezier(0.4,0,1,1)] transform"
      leave-from-class="translate-x-0 opacity-100"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-if="isPanelOpen && state?.activeHook?.value"
        class="absolute right-0 top-0 bottom-0 w-[500px] z-50 bg-[#0e0e12]/95 backdrop-blur-2xl border border-b-0 border-r-0 border-t-0 border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden rounded-3xl p-6 pt-4 text-white"
      >
        <Transition name="panel-tab-fade" mode="out-in">
          <!-- Edit Subtitles Tab -->
          <div v-if="editorTab === 'edit'" key="edit" class="flex flex-col h-full overflow-hidden p-0">
            <!-- Subtitle Header Bar -->
            <div class="flex items-center justify-between gap-2 mb-3 shrink-0">
              <div class="flex items-center gap-2">
                <button
                  @click="isAutoScrollEnabled = !isAutoScrollEnabled"
                  class="h-8 px-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                  :class="
                    isAutoScrollEnabled
                      ? 'bg-accent-500/10 text-accent-500 border-accent-500/30 shadow-[0_0_10px_rgba(207,255,80,0.1)]'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  "
                  :title="isAutoScrollEnabled ? 'Auto-Scroll Active' : 'Auto-Scroll Paused'"
                >
                  <Icon
                    :name="isAutoScrollEnabled ? 'ri:flashlight-fill' : 'ri:flashlight-line'"
                    class="text-xs"
                  />
                  <span>Auto-Scroll {{ isAutoScrollEnabled ? 'ON' : 'OFF' }}</span>
                </button>

                <div
                  class="h-8 px-2.5 rounded-xl border border-white/10 bg-black/40 text-slate-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0"
                >
                  <Icon name="ri:chat-3-line" class="text-xs text-sky-400" />
                  <span>{{ visibleSegments.length }} Segments</span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <!-- Live Auto-Save Status Badge -->
                <div
                  class="h-8 px-2.5 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 select-none"
                  :class="
                    isAutoSaving
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  "
                >
                  <Icon
                    :name="isAutoSaving ? 'ri:loader-4-line' : 'ri:checkbox-circle-line'"
                    class="text-xs"
                    :class="{ 'animate-spin': isAutoSaving }"
                  />
                  <span>{{ isAutoSaving ? 'Saving...' : 'Saved' }}</span>
                </div>

                <!-- Close Button (X) -->
                <button
                  @click="isPanelOpen = false"
                  class="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  title="Close Panel"
                >
                  <Icon name="ri:close-line" class="text-base" />
                </button>
              </div>
            </div>

            <!-- Subtitle Segment List -->
            <div class="flex-1 overflow-hidden relative">
              <div
                ref="subtitleContainer"
                @mouseenter="isHoveringSubtitles = true"
                @mouseleave="isHoveringSubtitles = false"
                class="h-full overflow-y-auto pr-1.5 space-y-1.5 custom-scrollbar scroll-smooth relative"
              >
                <div
                  v-for="(seg, i) in visibleSegments"
                  :key="i"
                  :id="`seg-${i}`"
                  class="bg-[#14141a]/80 border rounded-xl p-2 transition-all duration-200 flex items-center gap-2.5 group relative"
                  :class="[
                    activeSegIdx === i
                      ? 'border-accent-500/60 bg-accent-500/[0.1] shadow-[0_2px_16px_rgba(207,255,80,0.12)] ring-1 ring-accent-500/30'
                      : 'border-white/5 hover:border-white/20 hover:bg-[#1a1a24]/90'
                  ]"
                >
                  <!-- From-To Sec Timing Inputs -->
                  <div
                    class="flex items-center gap-0.5 shrink-0 bg-black/50 border border-white/5 px-1.5 py-0.5 rounded-lg"
                  >
                    <input
                      :value="seg.start"
                      @input="
                        (e) => {
                          updateSegmentStart(seg, parseFloat((e.target as HTMLInputElement).value))
                          triggerDebouncedAutoSave()
                        }
                      "
                      type="number"
                      step="0.01"
                      class="bg-transparent text-[10px] text-slate-200 font-mono w-9 text-center focus:outline-none focus:text-accent-500 font-bold transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="Start time (sec)"
                    />
                    <span class="text-[9px] text-slate-500 font-mono select-none">–</span>
                    <input
                      :value="Number((seg.start + seg.duration).toFixed(2))"
                      @input="
                        (e) => {
                          const newEnd = parseFloat((e.target as HTMLInputElement).value)
                          if (!isNaN(newEnd) && newEnd > seg.start) {
                            updateSegmentDuration(seg, parseFloat((newEnd - seg.start).toFixed(2)))
                            triggerDebouncedAutoSave()
                          }
                        }
                      "
                      type="number"
                      step="0.01"
                      class="bg-transparent text-[10px] text-slate-200 font-mono w-9 text-center focus:outline-none focus:text-accent-500 font-bold transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      title="End time (sec)"
                    />
                    <Icon name="ri:time-line" class="text-[11px] text-slate-400 shrink-0 ml-0.5" />
                  </div>

                  <!-- Inline Subtitle Text Editor -->
                  <textarea
                    :value="seg.text"
                    @input="
                      (e) => {
                        updateSegmentText(seg, (e.target as HTMLTextAreaElement).value)
                        autoGrow(e)
                        triggerDebouncedAutoSave()
                      }
                    "
                    rows="1"
                    class="flex-1 bg-transparent border-none text-white text-xs focus:outline-none resize-none font-semibold leading-snug py-0.5"
                    placeholder="Enter subtitle text..."
                  ></textarea>

                  <!-- Jump to Segment Start Button -->
                  <button
                    @click="jumpTo(seg.start)"
                    class="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-accent-500 hover:bg-white/10 rounded-lg transition-all shrink-0 active:scale-95"
                    title="Play from this segment start"
                  >
                    <Icon name="ri:play-mini-fill" class="text-base" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Raw Quote Tab -->
          <div
            v-else-if="editorTab === 'quote'"
            key="quote"
            class="flex flex-col h-full overflow-hidden p-0"
          >
            <!-- Header Bar -->
            <div class="pb-1 mb-3 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-2.5">
                <div class="flex items-center gap-1.5">
                  <Icon name="ri:chat-quote-line" class="text-sky-400 text-base" />
                  <span class="text-xs font-bold text-white tracking-wide">Raw Quote</span>
                </div>
                <span
                  class="bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1"
                >
                  QUOTE #{{ String((activeHookIndex >= 0 ? activeHookIndex : 0) + 1).padStart(2, '0') }}
                </span>
              </div>

              <div class="flex items-center gap-2">
                <button
                  @click="copyQuoteToClipboard"
                  class="h-8 px-3 flex items-center justify-center gap-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0"
                  title="Copy full quote text"
                >
                  <Icon :name="copied ? 'ri:check-line' : 'ri:file-copy-line'" class="text-xs" />
                  <span>{{ copied ? 'Copied' : 'Copy Quote' }}</span>
                </button>
                <button
                  @click="isPanelOpen = false"
                  class="w-8 h-8 flex items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                  title="Close Panel"
                >
                  <Icon name="ri:close-line" class="text-base" />
                </button>
              </div>
            </div>

            <!-- Topic Banner -->
            <div
              class="bg-[#14141a]/90 border border-white/5 rounded-xl p-3 mb-3 shrink-0 flex items-center gap-2.5"
            >
              <div
                class="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0"
              >
                <Icon name="ri:mic-line" class="text-sky-400 text-sm" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Podcast Speaker Context
                </div>
                <div
                  class="text-xs text-slate-200 font-semibold truncate"
                  :title="state?.activeHook?.value?.theme || 'Untitled Hook'"
                >
                  {{ state?.activeHook?.value?.theme || 'Untitled Hook' }}
                </div>
              </div>
            </div>

            <!-- Transcript Quote Excerpt Card -->
            <div class="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
              <div
                class="flex-1 bg-[#14141a]/60 border border-white/10 border-l-4 border-l-sky-400 rounded-2xl relative overflow-hidden flex flex-col min-h-0"
              >
                <div
                  class="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5 shrink-0"
                >
                  <span
                    class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Icon name="ri:volume-up-line" class="text-sky-400 text-xs" />
                    Audio Transcript Excerpt
                  </span>
                  <span class="text-[10px] font-mono text-slate-500">
                    {{ quoteWordCount }} words
                  </span>
                </div>

                <div class="relative z-10 overflow-y-auto p-4 custom-scrollbar flex-1 w-full">
                  <p class="text-slate-100 text-sm leading-relaxed font-sans select-text whitespace-pre-wrap">
                    {{
                      state?.activeHook?.value?.transcript_quote ||
                      'No transcript quote available for this segment.'
                    }}
                  </p>
                </div>
              </div>

              <!-- Metadata Stats -->
              <div class="flex items-center gap-2 shrink-0 pt-0.5 pb-1">
                <div
                  class="bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider"
                >
                  <Icon name="ri:text" class="text-sky-400 text-xs" />
                  <span>{{ quoteWordCount }} Words</span>
                </div>
                <div
                  class="bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider"
                >
                  <Icon name="ri:character-recognition-line" class="text-sky-400 text-xs" />
                  <span>{{ quoteCharCount }} Chars</span>
                </div>
                <div
                  class="bg-black/40 border border-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider"
                >
                  <Icon name="ri:time-line" class="text-sky-400 text-xs" />
                  <span>~{{ quoteReadingTime }}s Audio Read</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Thumbnail Editor Tab -->
          <div
            v-else-if="editorTab === 'thumbnail'"
            key="thumbnail"
            class="flex flex-col h-full overflow-hidden"
          >
            <ThumbnailEditor @close="isPanelOpen = false" />
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  groupTranscript,
  updateSegmentText,
  updateSegmentStart,
  updateSegmentDuration
} from '../../utils/subtitleChunker'
import type { ChunkerSegment } from '../../utils/subtitleChunker'
import type { Hook } from '../../types/clipper'

const state = useClipperState()

const isPanelOpen = ref(false)
const editorTab = ref<'edit' | 'quote' | 'thumbnail'>('edit')

const toggleTab = (tab: 'edit' | 'quote' | 'thumbnail') => {
  if (isPanelOpen.value && editorTab.value === tab) {
    isPanelOpen.value = false
  } else {
    editorTab.value = tab
    isPanelOpen.value = true
  }
}

const activeHookIndex = computed(() => {
  if (!state?.activeHook?.value) return -1
  const active = state.activeHook.value
  const aStart = typeof active.start === 'string' ? parseFloat(active.start) : active.start
  const aEnd = typeof active.end === 'string' ? parseFloat(active.end) : active.end

  let idx = state.hooks?.value?.findIndex((h: Hook) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })

  if (idx !== -1 && idx !== undefined) return idx

  idx = state.savedHooks?.value?.findIndex((h: Hook) => {
    const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
    const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
    return Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1
  })

  return idx !== undefined ? idx : -1
})

const copied = ref(false)
function copyQuoteToClipboard() {
  if (!state?.activeHook?.value?.transcript_quote) return
  navigator.clipboard.writeText(state.activeHook.value.transcript_quote)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

const quoteWordCount = computed(() => {
  const quote = state?.activeHook?.value?.transcript_quote || ''
  const clean = quote.trim()
  return clean ? clean.split(/\s+/).length : 0
})

const quoteCharCount = computed(() => {
  return (state?.activeHook?.value?.transcript_quote || '').length
})

const quoteReadingTime = computed(() => {
  return Math.max(1, Math.round(quoteWordCount.value / 3.3))
})

const subtitleContainer = ref<HTMLElement | null>(null)
const isHoveringSubtitles = ref(false)
const isAutoScrollEnabled = ref(true)
const isAutoSaving = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

function triggerDebouncedAutoSave() {
  isAutoSaving.value = true
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(async () => {
    try {
      await state.saveTranscript(true)
    } catch {
      // ignore
    } finally {
      isAutoSaving.value = false
    }
  }, 1000)
}

const absoluteTime = computed(() => state?.currentTime?.value || 0)
const visibleSegments = computed(() => {
  const flatWords = state?.fullTranscript?.value || []
  return groupTranscript(flatWords as unknown as ChunkerSegment[], state.subtitleMode.value)
})

const activeSegIdx = computed(() => {
  if (!state?.fullTranscript?.value || !state?.activeHook?.value) return -1

  const offsetSec = (state?.subtitleSyncOffset?.value || 0) / 1000
  const firstStart = state?.fullTranscript?.value[0]?.start || 0
  const isTranscriptZeroBased = firstStart < (state?.activeHook?.value?.start || 0) - 2

  const thumbSec = state?.thumbnailEnabled?.value ? state?.thumbnailDuration?.value : 0
  const relativeTime = Math.max(0, absoluteTime.value - thumbSec)

  const searchTime = isTranscriptZeroBased
    ? relativeTime + offsetSec
    : (state?.activeHook?.value?.start || 0) + relativeTime + offsetSec

  return visibleSegments.value.findIndex((s: ChunkerSegment) => {
    const end = s.end ?? s.start + s.duration
    return searchTime >= s.start && searchTime < end
  })
})

watch(activeSegIdx, (idx) => {
  if (isAutoScrollEnabled.value && idx !== -1 && subtitleContainer.value && !isHoveringSubtitles.value) {
    const el = document.getElementById(`seg-${idx}`)
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }
})

function jumpTo(segmentStart: number) {
  if (!state?.currentTime) return

  const thumbSec = state?.thumbnailEnabled?.value ? (state?.thumbnailDuration?.value || 0) : 0
  const firstStart = state?.fullTranscript?.value?.[0]?.start || 0
  const hookStart = state?.activeHook?.value?.start || 0
  const isTranscriptZeroBased = firstStart < hookStart - 2

  const relativeSegStart = isTranscriptZeroBased
    ? segmentStart
    : Math.max(0, segmentStart - hookStart)

  const targetTime = thumbSec + relativeSegStart
  state.seekTo(targetTime)
}

function autoGrow(e: Event) {
  const target = e.target as HTMLTextAreaElement
  if (target) {
    target.style.height = 'auto'
    target.style.height = target.scrollHeight + 'px'
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isPanelOpen.value) {
    isPanelOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
})
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
