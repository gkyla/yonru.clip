<template>
  <div class="flex-1 flex flex-col bg-[#0a0a0c] select-none overflow-hidden h-full">
    <!-- Toolbar -->
    <div class="h-10 flex items-center justify-between px-4 bg-[#111113] border-b border-white/5">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-0.5 bg-black/40 rounded p-0.5 border border-white/5">
          <button @click="addText" class="px-2 py-1 rounded hover:bg-white/5 text-slate-400 text-[9px] font-bold tracking-wider flex items-center gap-1.5">
            <Icon name="ri:text" class="text-violet-400 text-xs" /> TEXT
          </button>
          <button @click="triggerAudioUpload" class="px-2 py-1 rounded hover:bg-white/5 text-slate-400 text-[9px] font-bold tracking-wider flex items-center gap-1.5">
            <Icon name="ri:music-2-line" class="text-green-400 text-xs" /> AUDIO
          </button>
        </div>
        <div class="h-4 w-px bg-white/10"></div>
        <button @click="splitSelected" :disabled="!state.selectedTimelineItem.value" class="p-1 rounded hover:bg-white/10 text-slate-500 disabled:opacity-20" title="Split (K)">
          <Icon name="ri:scissors-cut-line" class="text-sm" />
        </button>
        <button @click="deleteSelected" :disabled="!state.selectedTimelineItem.value" class="p-1 rounded hover:bg-red-500/20 text-red-400/60 disabled:opacity-20" title="Delete">
          <Icon name="ri:delete-bin-line" class="text-sm" />
        </button>
        <div class="h-4 w-px bg-white/10"></div>
        <button @click="snapEnabled = !snapEnabled" class="p-1 rounded text-[9px] font-bold flex items-center gap-1" :class="snapEnabled ? 'bg-sky-500/20 text-sky-400' : 'text-slate-600 hover:bg-white/5'">
          <Icon name="ri:drag-move-2-line" class="text-sm" /> SNAP
        </button>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-white/5">
          <button @click="togglePlay" class="text-white hover:text-red-400">
            <Icon :name="state.isPlaying.value ? 'ri:pause-fill' : 'ri:play-fill'" class="text-base" />
          </button>
          <div class="mono text-[10px] flex items-center gap-1">
            <span class="text-red-400 font-bold">{{ state.formatDuration(state.currentTime.value) }}</span>
            <span class="text-slate-600">/</span>
            <span class="text-slate-500">{{ state.formatDuration(state.timelineDuration.value) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-0.5 bg-white/5 rounded p-0.5">
          <button @click="zoomOut" class="p-1 hover:bg-white/10 rounded text-slate-500"><Icon name="ri:subtract-line" class="text-xs" /></button>
          <div class="w-8 text-center text-[8px] mono text-slate-600">{{ Math.round(pxPerSec) }}</div>
          <button @click="zoomIn" class="p-1 hover:bg-white/10 rounded text-slate-500"><Icon name="ri:add-line" class="text-xs" /></button>
        </div>
        <div class="flex items-center gap-2 bg-white/5 rounded px-2 py-1">
          <button @click="state.volume.value = state.volume.value === 0 ? 0.5 : 0" class="text-slate-500 hover:text-white">
            <Icon :name="state.volume.value === 0 ? 'ri:volume-mute-line' : 'ri:volume-up-line'" class="text-xs" />
          </button>
          <input v-model.number="state.volume.value" type="range" min="0" max="1" step="0.01" class="w-16 accent-red-500 h-0.5 bg-white/10 rounded appearance-none cursor-pointer" />
        </div>
      </div>
    </div>

    <!-- Timeline Body -->
    <div class="flex-1 flex overflow-hidden relative">
      <!-- Track Labels -->
      <div class="w-24 bg-[#111113] border-r border-white/5 flex flex-col shrink-0 z-40">
        <div class="h-5 border-b border-white/5"></div>
        <div v-for="track in state.timelineTracks.value" :key="track.id"
             class="border-b border-white/5 px-3 flex items-center gap-1.5 relative"
             :style="{ height: trackH + 'px' }">
          <div class="absolute left-0 top-0 bottom-0 w-[3px]" :class="trackBorderColor(track.type)"></div>
          <Icon :name="trackIcon(track.type)" class="text-[10px] opacity-50" :class="trackColor(track.type)" />
          <span class="text-[8px] font-bold uppercase tracking-widest text-slate-600 truncate">{{ track.name }}</span>
        </div>
      </div>

      <!-- Scrollable Timeline -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden relative tl-scroll" ref="scrollEl"
           @scroll="onScroll" @wheel.prevent="onWheel">
        <!-- Ruler -->
        <div class="sticky top-0 z-30 bg-[#0d0d0f] border-b border-white/5 cursor-pointer"
             :style="{ height: '20px' }" @mousedown="onRulerClick">
          <div class="relative h-full" :style="{ width: totalW + 'px' }">
            <template v-for="tick in rulerTicks" :key="tick.pos">
              <div class="absolute bottom-0 border-l" :class="tick.major ? 'border-white/20 h-[10px]' : 'border-white/8 h-[5px]'"
                   :style="{ left: tick.pos + 'px' }">
                <span v-if="tick.label" class="absolute -top-[12px] left-[3px] text-[8px] mono text-slate-600 whitespace-nowrap">{{ tick.label }}</span>
              </div>
            </template>
          </div>
        </div>

        <!-- Track Content Area -->
        <div class="relative" :style="{ width: totalW + 'px' }" @mousedown="onTrackBgClick">
          <div v-for="track in state.timelineTracks.value" :key="track.id"
               class="relative border-b border-white/[0.03]"
               :style="{ height: trackH + 'px' }">
            <!-- Thumbnail block -->
            <div v-if="track.type === 'video' && state.thumbnailEnabled.value"
                 class="absolute top-[4px] rounded-[3px] border-l-[3px] border-emerald-500 flex items-center px-2 gap-1 pointer-events-none"
                 :style="{ left: 0, width: thumbW + 'px', height: (trackH - 8) + 'px', background: '#064e3b' }">
              <Icon name="ri:image-edit-fill" class="text-emerald-400 text-[10px] shrink-0" />
              <span class="text-[7px] font-bold text-emerald-400 truncate uppercase tracking-wider">Thumb</span>
            </div>
            <!-- Track items -->
            <div v-for="item in track.items" :key="item.id"
                 class="absolute top-[4px] rounded-[3px] cursor-move flex items-center px-2 gap-1.5 overflow-hidden border-l-[3px]"
                 :class="itemClasses(track.type, item)"
                 :style="itemStyle(track, item)"
                 @mousedown.stop="startMove($event, track.id, item)">
              <span class="text-[8px] font-bold truncate opacity-80">{{ item.content || item.name || track.type }}</span>
              <span class="text-[7px] mono opacity-40 ml-auto shrink-0">{{ item.duration.toFixed(1) }}s</span>
              <!-- Resize handles -->
              <div class="absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-white/10"
                   @mousedown.stop="startResize($event, track.id, item, 'start')">
                <div class="absolute right-[1px] top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20 rounded"></div>
              </div>
              <div class="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-white/10"
                   @mousedown.stop="startResize($event, track.id, item, 'end')">
                <div class="absolute left-[1px] top-1/2 -translate-y-1/2 w-[1px] h-3 bg-white/20 rounded"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Fixed-center Playhead (positioned relative to scroll) -->
        <div class="absolute top-0 bottom-0 z-50 pointer-events-none" :style="{ left: playheadPx + 'px', width: '2px' }">
          <div class="w-0 h-0 absolute -left-[5px] top-0" style="border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #ff3b30;"></div>
          <div class="absolute top-[8px] bottom-0 left-0 w-[2px] bg-[#ff3b30]"></div>
        </div>
      </div>

      <!-- Center line indicator (visual guide showing center) -->
      <div class="absolute top-10 bottom-0 w-[2px] bg-red-500/10 pointer-events-none z-[45]"
           :style="{ left: centerLinePx + 'px' }"></div>
    </div>

    <!-- Edit Panel -->
    <div v-if="state.selectedTimelineItem.value" class="absolute top-10 right-4 bottom-4 w-64 bg-[#111113]/95 backdrop-blur border border-white/10 rounded-lg shadow-2xl z-[60] flex flex-col">
      <div class="p-3 border-b border-white/5 flex items-center justify-between">
        <span class="text-[9px] font-bold uppercase tracking-widest text-slate-500">Properties</span>
        <button @click="state.selectedTimelineItem.value = null" class="text-slate-600 hover:text-white p-0.5"><Icon name="ri:close-line" class="text-sm" /></button>
      </div>
      <div class="flex-1 overflow-y-auto p-3 space-y-3">
        <div v-if="state.selectedTimelineItem.value.content !== undefined">
          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Text</label>
          <textarea v-model="state.selectedTimelineItem.value.content" class="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/50 resize-none" rows="2"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Start</label>
            <input type="number" step="0.1" v-model.number="state.selectedTimelineItem.value.start" class="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white mono" />
          </div>
          <div>
            <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Duration</label>
            <input type="number" step="0.1" v-model.number="state.selectedTimelineItem.value.duration" class="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white mono" />
          </div>
        </div>
        <div v-if="state.selectedTimelineItem.value.fontSize !== undefined">
          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Size ({{ state.selectedTimelineItem.value.fontSize }})</label>
          <input type="range" min="20" max="200" v-model.number="state.selectedTimelineItem.value.fontSize" class="w-full accent-red-500 h-0.5" />
        </div>
        <div v-if="state.selectedTimelineItem.value.color">
          <label class="block text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1">Color</label>
          <div class="flex gap-1">
            <input type="color" v-model="state.selectedTimelineItem.value.color" class="w-6 h-6 rounded cursor-pointer bg-transparent border-none" />
            <input type="text" v-model="state.selectedTimelineItem.value.color" class="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] text-white mono" />
          </div>
        </div>
      </div>
      <div class="p-3 border-t border-white/5">
        <button @click="deleteSelected" class="w-full py-1.5 rounded border border-red-500/20 text-red-400 text-[9px] font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white">Delete</button>
      </div>
    </div>

    <input type="file" ref="audioInput" class="hidden" accept="audio/*" @change="handleAudioFile" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

const state = useClipperState()
const pxPerSec = ref(100)
const scrollEl = ref<HTMLElement | null>(null)
const audioInput = ref<HTMLInputElement | null>(null)
const snapEnabled = ref(true)
const trackH = 40
const isUserScrolling = ref(false)
let scrollTimeout: any = null

// --- Thumbnail ---
const thumbW = computed(() => state.thumbnailEnabled.value ? state.thumbnailDuration.value * pxPerSec.value : 0)
const thumbOffsetPx = computed(() => thumbW.value)

function getItemLeft(track: any, item: any) {
  const base = item.start * pxPerSec.value
  return state.thumbnailEnabled.value ? base + thumbOffsetPx.value : base
}

// --- Layout ---
const totalW = computed(() => {
  return Math.max(state.timelineDuration.value * pxPerSec.value, 2000)
})

const containerW = computed(() => scrollEl.value?.clientWidth || 800)
const centerLinePx = computed(() => 96 + containerW.value / 2) // 96 = track label width

// Playhead position in content coordinates
const playheadPx = computed(() => state.currentTime.value * pxPerSec.value)

// --- Ruler ---
const rulerTicks = computed(() => {
  const ticks: { pos: number; major: boolean; label: string | null }[] = []
  const dur = totalW.value / pxPerSec.value
  let step: number, labelEvery: number

  if (pxPerSec.value >= 200) { step = 0.1; labelEvery = 1 }
  else if (pxPerSec.value >= 100) { step = 0.25; labelEvery = 1 }
  else if (pxPerSec.value >= 50) { step = 0.5; labelEvery = 5 }
  else { step = 1; labelEvery = 5 }

  for (let t = 0; t <= dur; t = Math.round((t + step) * 1000) / 1000) {
    const pos = t * pxPerSec.value
    const isMajor = Math.abs(t % labelEvery) < 0.001 || Math.abs(t % labelEvery - labelEvery) < 0.001
    const showLabel = isMajor && t > 0
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    const ms = Math.round((t % 1) * 10)
    const label = showLabel ? (t >= 60 ? `${m}:${s.toString().padStart(2, '0')}` : (t % 1 === 0 ? `${s}s` : `${s}.${ms}s`)) : null
    ticks.push({ pos, major: isMajor, label })
  }
  return ticks
})

// --- Track helpers ---
function trackIcon(type: string) {
  return type === 'video' ? 'ri:film-line' : type === 'audio' ? 'ri:volume-up-line' : 'ri:text'
}
function trackColor(type: string) {
  return type === 'video' ? 'text-sky-400' : type === 'audio' ? 'text-green-400' : 'text-violet-400'
}
function trackBorderColor(type: string) {
  return type === 'video' ? 'bg-sky-500' : type === 'audio' ? 'bg-green-500' : 'bg-violet-500'
}

const itemBg: Record<string, string> = { video: '#1a365d', audio: '#1a3a1a', text: '#2d1b5e' }
const itemBorder: Record<string, string> = { video: '#3182ce', audio: '#38a169', text: '#805ad5' }

function itemClasses(type: string, item: any) {
  return item.id === state.selectedTimelineItem.value?.id ? 'border border-white/80' : 'border border-transparent'
}

function itemStyle(track: any, item: any) {
  const t = track.type
  return {
    left: getItemLeft(track, item) + 'px',
    width: item.duration * pxPerSec.value + 'px',
    height: (trackH - 8) + 'px',
    background: itemBg[t] || itemBg.text,
    borderLeftColor: itemBorder[t] || itemBorder.text,
  }
}

// --- Zoom ---
function zoomIn() { pxPerSec.value = Math.min(500, pxPerSec.value * 1.25) }
function zoomOut() { pxPerSec.value = Math.max(10, pxPerSec.value / 1.25) }

function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    // Pinch-to-zoom
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  } else {
    // Horizontal scroll = scrub
    if (scrollEl.value) {
      scrollEl.value.scrollLeft += e.deltaY + e.deltaX
    }
  }
}

// --- Scroll ↔ Time sync ---
function onScroll() {
  if (!scrollEl.value) return
  isUserScrolling.value = true
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => { isUserScrolling.value = false }, 150)

  if (!state.isPlaying.value) {
    // Scroll = scrub: center of viewport = currentTime
    const centerX = scrollEl.value.scrollLeft + containerW.value / 2
    state.currentTime.value = Math.max(0, centerX / pxPerSec.value)
  }
}

// During playback, auto-scroll to keep playhead centered
let rafId: number | null = null

function startRaf() {
  if (rafId) return
  const loop = () => {
    const video = document.getElementById('preview-video-element') as HTMLVideoElement
    const thumbSec = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
    
    // Use native video to drive timeline AFTER the thumbnail window.
    // During thumbnail, Remotion is the sole clock (via REMOTION_TIMEUPDATE messages).
    // In Remotion mode, REMOTION_TIMEUPDATE overrides this, so this only matters
    // for useNativePlayer fallback mode.
    if (state.useNativePlayer.value && video && !video.paused && video.volume > 0 && state.currentTime.value >= thumbSec) {
      state.currentTime.value = video.currentTime + thumbSec
    }
    // Auto-scroll to center playhead
    if (scrollEl.value && !isUserScrolling.value) {
      const targetScroll = playheadPx.value - containerW.value / 2
      scrollEl.value.scrollLeft = Math.max(0, targetScroll)
    }
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)
}

function stopRaf() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
}

watch(() => state.isPlaying.value, (playing) => {
  if (playing) startRaf()
  else stopRaf()
}, { immediate: true })

// When time changes externally (not from scroll), auto-scroll to center
watch(() => state.currentTime.value, () => {
  if (!state.isPlaying.value && !isUserScrolling.value && scrollEl.value) {
    const targetScroll = playheadPx.value - containerW.value / 2
    scrollEl.value.scrollLeft = Math.max(0, targetScroll)
  }
})

// --- Play ---
function togglePlay() { state.isPlaying.value = !state.isPlaying.value }

// --- Click handlers ---
function onRulerClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).querySelector('.relative')?.getBoundingClientRect()
  if (!rect) return
  const x = e.clientX - rect.left
  state.currentTime.value = Math.max(0, x / pxPerSec.value)
  state.selectedTimelineItem.value = null
}

function onTrackBgClick(e: MouseEvent) {
  if (e.target !== e.currentTarget) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = e.clientX - rect.left
  state.currentTime.value = Math.max(0, x / pxPerSec.value)
  state.selectedTimelineItem.value = null
}

// --- Add items ---
function addText() {
  state.addTimelineItem('text', { content: 'NEW TEXT', color: '#CFFF50', fontSize: 80, x: 540, y: 960 })
}
function triggerAudioUpload() { audioInput.value?.click() }
function handleAudioFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    state.addTimelineItem('audio', { name: file.name, src: ev.target?.result, duration: 5 })
  }
  reader.readAsDataURL(file)
}

// --- Snap logic ---
function snapValue(val: number, trackId?: string): number {
  if (!snapEnabled.value) return val
  const tolerance = 5 / pxPerSec.value // 5px snap tolerance in seconds

  // Snap targets
  const targets: number[] = []

  // Ruler snap
  let step = 1
  if (pxPerSec.value >= 200) step = 0.1
  else if (pxPerSec.value >= 100) step = 0.25
  else if (pxPerSec.value >= 50) step = 0.5

  const nearestRuler = Math.round(val / step) * step
  targets.push(nearestRuler)

  // Playhead snap
  const offset = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
  targets.push(state.currentTime.value - offset)

  // Clip edge snap
  state.timelineTracks.value.forEach(track => {
    track.items.forEach((item: any) => {
      if (draggingItem && item.id === draggingItem.id) return
      targets.push(item.start)
      targets.push(item.start + item.duration)
    })
  })

  // Find closest target
  let closest = val
  let minDist = tolerance
  for (const t of targets) {
    const dist = Math.abs(val - t)
    if (dist < minDist) { minDist = dist; closest = t }
  }
  return closest
}

// --- Drag/Resize ---
let draggingItem: any = null
let dragStartX = 0
let dragStartVal = 0
let resizeMode: 'start' | 'end' | null = null
let dragTrackId = ''

function startMove(e: MouseEvent, trackId: string, item: any) {
  state.selectedTimelineItem.value = item
  draggingItem = item
  dragTrackId = trackId
  dragStartX = e.clientX
  dragStartVal = item.start
  resizeMode = null
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function startResize(e: MouseEvent, trackId: string, item: any, mode: 'start' | 'end') {
  state.selectedTimelineItem.value = item
  draggingItem = item
  dragTrackId = trackId
  dragStartX = e.clientX
  dragStartVal = mode === 'start' ? item.start : item.duration
  resizeMode = mode
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!draggingItem) return
  const dx = (e.clientX - dragStartX) / pxPerSec.value

  if (resizeMode === 'start') {
    let newStart = Math.max(0, dragStartVal + dx)
    newStart = snapValue(newStart, dragTrackId)
    const diff = draggingItem.start - newStart
    if (draggingItem.duration + diff > 0.1) {
      draggingItem.duration += diff
      draggingItem.start = newStart
    }
  } else if (resizeMode === 'end') {
    let newDur = Math.max(0.1, dragStartVal + dx)
    const newEnd = draggingItem.start + newDur
    const snappedEnd = snapValue(newEnd, dragTrackId)
    newDur = Math.max(0.1, snappedEnd - draggingItem.start)
    draggingItem.duration = newDur
  } else {
    let newStart = Math.max(0, dragStartVal + dx)
    newStart = snapValue(newStart, dragTrackId)
    draggingItem.start = newStart
  }
}

function stopDrag() {
  draggingItem = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

// --- Delete / Split ---
function deleteSelected() {
  if (!state.selectedTimelineItem.value) return
  const itemToDelete = { ...state.selectedTimelineItem.value }
  const id = itemToDelete.id
  
  // Actually delete the item
  state.timelineTracks.value.forEach(track => state.deleteTimelineItem(track.id, id))

  // Perform Ripple Edit: Shift all items that start AT OR AFTER the deleted item to the left
  state.timelineTracks.value.forEach(track => {
    track.items.forEach((item: any) => {
      // Use a tiny epsilon because floating point math
      if (item.start >= itemToDelete.start - 0.001) {
        item.start = Math.max(0, item.start - itemToDelete.duration)
      }
    })
  })

  // Update playhead position:
  const offset = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
  const relTime = state.currentTime.value - offset

  if (relTime > itemToDelete.start + itemToDelete.duration) {
    state.currentTime.value = Math.max(0, state.currentTime.value - itemToDelete.duration)
  } else if (relTime >= itemToDelete.start) {
    state.currentTime.value = itemToDelete.start + offset
  }

  // Perform Ripple Edit on subtitles
  if (state.fullTranscript.value && state.fullTranscript.value.length > 0) {
    const newTranscript: any[] = []
    const delStart = itemToDelete.start
    const delEnd = itemToDelete.start + itemToDelete.duration
    
    // Normalize coordinates for comparison: 
    // Subtitle start is 0-based relative to video start (which is at thumbnailDuration on timeline)
    const offset = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
    
    state.fullTranscript.value.forEach(s => {
      // Subtitle time in timeline-absolute coordinates
      const segStart = s.start + offset
      const segEnd = (s.start + s.duration) + offset
      
      // Case 1: Segment is completely before deleted item -> Keep as is
      if (segEnd <= delStart + 0.001) {
        newTranscript.push(s)
      }
      // Case 2: Segment is completely after deleted item -> Shift left
      else if (segStart >= delEnd - 0.001) {
        newTranscript.push({
          ...s,
          start: Math.max(0, s.start - itemToDelete.duration)
        })
      }
      // Case 3: Segment overlaps with deleted item
      else {
        const rawWords = s.text.trim().split(/\s+/)
        if (!rawWords.length || !s.text.trim()) return
        const wordDur = s.duration / rawWords.length
        
        let block1Words: string[] = []
        let block2Words: string[] = []
        let block2StartIndex = -1
        
        rawWords.forEach((w: string, i: number) => {
          const wordStart = segStart + (i * wordDur)
          const wordEnd = wordStart + wordDur
          
          if (wordEnd <= delStart + 0.001) {
            block1Words.push(w)
          } else if (wordStart >= delEnd - 0.001) {
            block2Words.push(w)
            if (block2StartIndex === -1) block2StartIndex = i
          }
        })
        
        if (block1Words.length > 0) {
          newTranscript.push({
            ...s,
            text: block1Words.join(' '),
            duration: block1Words.length * wordDur
          })
        }
        
        if (block2Words.length > 0) {
          const originalStart = (segStart + (block2StartIndex * wordDur)) - offset
          newTranscript.push({
            ...s,
            id: s.id + '_shifted',
            text: block2Words.join(' '),
            start: Math.max(0, originalStart - itemToDelete.duration),
            duration: block2Words.length * wordDur
          })
        }
      }
    })
    state.fullTranscript.value = newTranscript
  }
  
  // Auto-save changes immediately to prevent data loss on refresh
  state.saveTranscript()
  state.saveTimelineTracks()
}

function splitSelected() {
  const item = state.selectedTimelineItem.value
  if (!item) return
  const offset = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
  const cut = state.currentTime.value - offset

  if (cut > item.start && cut < item.start + item.duration) {
    const splitOffset = cut - item.start
    const originalMediaStart = item.mediaStart !== undefined ? item.mediaStart : 0
    const newMediaStart = originalMediaStart + splitOffset
    
    const dur2 = (item.start + item.duration) - cut
    item.duration = cut - item.start
    
    const track = state.timelineTracks.value.find(t => t.items.some((i: any) => i.id === item.id))
    if (track) {
      state.addTimelineItem(track.id, { 
        ...item, 
        id: Math.random().toString(36).substr(2, 9), 
        start: cut, 
        duration: dur2,
        mediaStart: newMediaStart
      })
      // Auto-save timeline state
      state.saveTimelineTracks()
    }
  }
}

// --- Keyboard ---
function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
  if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
  else if (e.key === 'k' || e.key === 'K') splitSelected()
}

onMounted(() => { window.addEventListener('keydown', onKeyDown) })
onUnmounted(() => { window.removeEventListener('keydown', onKeyDown); stopRaf() })
</script>

<style scoped>
.tl-scroll::-webkit-scrollbar { height: 6px; }
.tl-scroll::-webkit-scrollbar-track { background: transparent; }
.tl-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 0; }
.tl-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
</style>
