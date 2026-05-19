<template>
  <div v-if="state" ref="container" class="relative shrink-0 flex items-center justify-center transition-all duration-500" :style="containerStyle">
    
    <!-- 1080x1920 Canvas scaled to fit container -->
    <div class="absolute top-1/2 left-1/2 w-[1080px] h-[1920px] overflow-hidden rounded-[36px] bg-black" :style="contentStyle">
      
      <!-- Safe Area UI overlay -->
      <div class="absolute inset-0 z-50 pointer-events-none p-12 pb-36 flex flex-col justify-between">
         <div class="flex justify-between items-start">
            <div class="flex flex-col gap-4 opacity-30">
               <Icon name="ri:focus-3-line" class="text-6xl" />
               <div class="text-[30px] mono border-[3px] border-white/20 px-3 py-1">1080x1920 PREVIEW</div>
            </div>
         </div>
         <div class="flex justify-between items-end opacity-30">
            <Icon name="ri:add-line" class="text-[72px] rotate-45" />
            <Icon name="ri:add-line" class="text-[72px] rotate-45" />
         </div>
      </div>

      <!-- Rendered video output -->
      <div v-if="state?.outputUrl?.value" class="absolute inset-0 z-30 bg-black flex items-center justify-center">
        <video :src="state?.outputUrl?.value" class="w-full h-full object-contain" autoplay />
        <div class="absolute top-12 right-12 z-40">
          <a :href="state?.outputUrl?.value" download class="bg-accent-500 text-black text-[36px] font-bold px-8 py-4 rounded-xl flex items-center gap-3 hover:bg-accent-600 transition-colors shadow-2xl">
            <Icon name="ri:download-line" />
            DOWNLOAD
          </a>
        </div>
      </div>

      <!-- Draggable crop preview -->
      <div v-if="state?.videoUrl?.value && !state?.outputUrl?.value" 
           class="absolute inset-0 z-30 bg-black cursor-grab active:cursor-grabbing select-none"
           @mousedown="startDrag"
           @mousemove="onDrag"
           @mouseup="stopDrag"
           @mouseleave="stopDrag"
           @touchstart.prevent="startDragTouch"
           @touchmove.prevent="onDragTouch"
           @touchend="stopDrag"
      >
        <video 
          ref="previewVideo" 
          id="preview-video-element"
          :src="state?.videoUrl?.value" 
          :muted="false"
          class="absolute inset-0 pointer-events-none transition-opacity duration-300"
          :class="state?.useNativePlayer?.value ? 'opacity-100' : 'opacity-0'"
          :style="videoTransformStyle"
          @loadedmetadata="onVideoLoaded"
          @loadeddata="onVideoReady"
          @loadstart="state.isMediaLoading.value = true"
          @canplay="onVideoReady"
          @canplaythrough="onVideoReady"
          @timeupdate="onNativeTimeUpdate"
          @error="(e) => onNativeVideoError(e)"
          playsinline
          crossorigin="anonymous"
          preload="auto"
        />

        <!-- Remotion Player Bridge -->
        <iframe
          v-if="!state?.useNativePlayer?.value"
          ref="remotionIframe"
          src="http://localhost:3003"
          @load="syncRemotionProps"
          class="absolute inset-0 w-full h-full border-none pointer-events-none z-20 transition-opacity duration-300"
          :class="!state.useNativePlayer.value ? 'opacity-100' : 'opacity-0'"
          allow="autoplay"
        ></iframe>
        
        <!-- Crop guide lines -->
        <div class="absolute inset-0 pointer-events-none z-10">
          <div class="absolute inset-y-0 w-[3px] bg-white/20" style="left: 33.33%"></div>
          <div class="absolute inset-y-0 w-[3px] bg-white/20" style="left: 66.66%"></div>
          <div class="absolute inset-x-0 h-[3px] bg-white/20" style="top: 33.33%"></div>
          <div class="absolute inset-x-0 h-[3px] bg-white/20" style="top: 66.66%"></div>
        </div>


        <!-- Drag indicator -->
        <div class="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center gap-4">
          <div class="bg-black/70 backdrop-blur-3xl px-8 py-4 rounded-full border-[3px] border-white/20 text-[28px] mono text-white flex items-center gap-3">
            <Icon name="ri:drag-move-2-line" class="text-accent-500 text-[36px]" />
            DRAG TO PAN • {{ Math.round(state.cropPercentX.value) }}%
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!state.videoUrl.value && !state.outputUrl.value && !isProcessing && !state.isMediaLoading.value" class="text-center flex flex-col items-center justify-center text-slate-500 p-12 absolute inset-0 z-0 bg-surface-dark/80 text-[42px]">
        <div class="w-[192px] h-[192px] rounded-full bg-surface-panel border-[3px] border-surface-border flex items-center justify-center mb-12">
          <Icon name="ri:play-line" class="text-[96px] text-slate-400" />
        </div>
        <h3 class="font-medium text-slate-300">NO MEDIA LOADED</h3>
        <p class="text-[32px] mt-4 max-w-[600px] text-slate-500 leading-relaxed">Paste a YouTube URL and click extract to begin processing.</p>
      </div>


      
      <!-- Subtitle Overlay / position indicator (Hidden if Remotion handles it) -->
      <div class="absolute left-1/2 -translate-x-1/2 z-40 pointer-events-none w-full px-[5%] flex justify-center transition-opacity duration-300" :class="state.useNativePlayer.value ? 'opacity-100' : 'opacity-0 hidden'" :style="subtitleIndicatorStyle">
        <div v-if="activeSubtitleWords && activeSubtitleWords.length > 0" 
             class="font-bold text-center leading-tight tracking-wide flex flex-wrap justify-center items-center gap-x-4 gap-y-2"
             :style="{ 
               fontFamily: state.font.value, 
               fontSize: `${state.fontSize.value}px`, 
               color: 'white',
               fontWeight: state.subtitleFontWeight.value ? String(state.subtitleFontWeight.value) : '900',
               wordSpacing: `${state.subtitleWordSpacing.value}px`
             }">
          <template v-for="(w, idx) in activeSubtitleWords" :key="idx">
            <span :style="getWordStyle(w)">{{ formatWordText(w.text) }}</span>
            <span v-if="idx < activeSubtitleWords.length - 1" style="display: inline-block; white-space: pre;" class="select-none"> </span>
          </template>
        </div>
        <div v-else class="bg-accent-500/20 border-[3px] border-accent-500/40 rounded-xl px-12 py-4 text-[30px] text-accent-500 mono text-center whitespace-nowrap backdrop-blur-md transition-opacity duration-500" :class="state.isPlaying.value ? 'opacity-0' : 'opacity-100'">
          SUBTITLE — {{ state.font.value }} {{ state.fontSize.value }}px
        </div>
      </div>

      <!-- Text Layers (Konva) -->
      <ClientOnly>
      <div v-if="state.videoUrl.value && !state.thumbnailEditMode.value" 
           class="absolute inset-0 z-[45]" 
           :class="activeTextItems.length > 0 ? 'pointer-events-auto' : 'pointer-events-none'">
        <v-stage :config="{ width: 1080, height: 1920 }" @click="handleStageClick" @tap="handleStageClick">
          <v-layer>
            <v-label 
              v-for="item in activeTextItems" 
              :key="`${fontsLoaded}-${item.id}-${item.content}-${item.fontSize}-${item.font}-${item.fontWeight}-${item.showStroke}-${item.showBackground}-${item.textTransform}-${item.color}`"
              :config="{
                x: item.x ?? 540,
                y: item.y ?? 960,
                name: item.id,
                draggable: true,
                offset: { x: 0, y: 0 }
              }" 
              @dragend="onTextDragEnd($event, item)"
              @dragmove="onTextDragEnd($event, item)"
              @transform="handleTransform($event, item)"
              @click="selectItem(item)"
              @tap="selectItem(item)"
              @mouseenter="handleMouseEnterLabel"
              @mouseleave="handleMouseLeaveLabel"
              @draw="onLabelRender"
            >
              <v-tag 
                :config="{
                  fill: item.backgroundColor || '#000000',
                  opacity: item.showBackground ? (item.backgroundOpacity ?? 0.7) : 0,
                  cornerRadius: 10,
                  padding: 0,
                  listening: false
                }"
              />
              <v-text 
                :config="{
                  text: (item.textTransform === 'uppercase' ? (item.content || 'NEW TEXT').toUpperCase() : (item.textTransform === 'lowercase' ? (item.content || 'NEW TEXT').toLowerCase() : (item.content || 'NEW TEXT'))),
                  fontSize: item.fontSize || 80,
                  fill: item.color || '#FFFFFF',
                  fontFamily: item.font || 'Outfit',
                  fontStyle: item.fontWeight ? String(item.fontWeight) : '900',
                  align: item.align || 'center',
                  verticalAlign: 'middle',
                  lineHeight: item.lineHeight ?? 1.1,
                  stroke: item.strokeColor || '#000000',
                  strokeWidth: item.showStroke ? (item.strokeWidth ?? 5) : 0,
                  strokeEnabled: item.showStroke,
                  shadowColor: item.shadowColor || '#000000',
                  shadowBlur: item.shadowBlur ?? 10,
                  shadowOffset: { x: item.shadowOffsetX ?? 5, y: item.shadowOffsetY ?? 5 },
                  shadowOpacity: item.shadowOpacity ?? 0.5,
                  shadowEnabled: true,
                  letterSpacing: item.letterSpacing ?? 0,
                  opacity: item.opacity ?? 1,
                  padding: 15,
                  perfectDrawEnabled: false
                }" 
              />
            </v-label>
            <v-transformer
              v-if="isTimelineTextActiveAndSelected"
              ref="transformerRef"
              :config="{
                enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
                rotateEnabled: false,
                keepRatio: true,
                borderStroke: '#ef4444',
                anchorStroke: '#ef4444',
                anchorFill: '#ffffff',
                anchorSize: 12,
                borderDash: [3, 3]
              }"
            />
          </v-layer>
        </v-stage>
      </div>
      </ClientOnly>

      <!-- Thumbnail Preview Mode (active in edit mode OR during thumbnail time window) -->
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="(state.thumbnailEditMode.value || isInThumbnailWindow) && state.thumbnailUrl.value" class="absolute inset-0 z-[50] bg-black">
          <!-- Thumbnail Background Image -->
          <img 
            :src="state.thumbnailUrl.value" 
            class="absolute inset-0 w-full h-full object-cover select-none"
            :style="{ objectPosition: `${state.thumbnailXOffset.value}% center` }"
          />
          
          <!-- Thumbnail Text Overlays (Konva for dragging) -->
          <ClientOnly>
          <div class="absolute inset-0 z-[55]">
            <v-stage :config="{ width: 1080, height: 1920 }">
              <v-layer>
                <!-- Background click/drag area for panning the background image -->
                <v-rect
                  :config="{
                    width: 1080,
                    height: 1920,
                    fill: 'transparent'
                  }"
                  @mousedown="startThumbBgDrag"
                  @touchstart="startThumbBgDragTouch"
                />
                <v-label 
                  v-for="overlay in state.thumbnailTextOverlays.value" 
                  :key="`${fontsLoaded}-${overlay.id}-${overlay.text}-${overlay.fontSize}-${overlay.fontFamily}-${overlay.fontWeight}-${overlay.showStroke}-${overlay.showBackground}-${overlay.backgroundPadding}-${overlay.textTransform}-${overlay.color}`"
                  :config="{
                    x: overlay.x ?? 540,
                    y: overlay.y ?? 960,
                    rotation: overlay.rotation ?? 0,
                    draggable: true,
                    offset: { x: 0, y: 0 }
                  }"
                  @dragend="onThumbnailLabelDragEnd($event, overlay)"
                >
                   <v-tag 
                    :config="{
                      fill: overlay.backgroundColor || '#000000',
                      opacity: overlay.showBackground ? (overlay.backgroundOpacity ?? 0.7) : 0,
                      cornerRadius: 10,
                      padding: 0,
                      listening: false
                    }"
                  />
                  <v-text 
                    :config="{
                      text: (overlay.textTransform === 'uppercase' ? (overlay.text || '').toUpperCase() : (overlay.text || '')),
                      fontSize: overlay.fontSize ?? 100,
                      fill: overlay.color || '#FFFFFF',
                      fontFamily: overlay.fontFamily || 'Montserrat',
                      fontStyle: overlay.fontWeight ? String(overlay.fontWeight) : '900',
                      align: 'center',
                      verticalAlign: 'middle',
                      lineHeight: 1.1,
                      stroke: overlay.strokeColor || '#000000',
                      strokeWidth: overlay.showStroke !== false ? (overlay.strokeWidth ?? 5) : 0,
                      strokeEnabled: overlay.showStroke !== false,
                      shadowColor: 'black',
                      shadowBlur: 15,
                      shadowOffset: { x: 3, y: 5 },
                      shadowOpacity: 0.6,
                      offsetX: 0,
                      offsetY: 0,
                      padding: overlay.backgroundPadding ?? 20,
                      perfectDrawEnabled: false
                    }" 
                  />
                </v-label>
              </v-layer>
            </v-stage>
          </div>
          </ClientOnly>

          <!-- Editing indicator -->
          <div class="absolute top-12 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
            <div class="bg-emerald-500/90 backdrop-blur-md text-black px-8 py-3 rounded-full text-[28px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl">
              <Icon name="ri:image-edit-fill" class="text-[32px]" />
              {{ state.thumbnailEditMode.value ? 'THUMBNAIL EDIT MODE' : 'THUMBNAIL' }}
            </div>
          </div>
        </div>
      </Transition>

      <!-- Title safe area -->
      <div class="absolute border-[6px] border-red-500/20 pointer-events-none rounded-[24px] z-10 mix-blend-screen border-dashed" style="top: 10%; bottom: 15%; left: 10%; right: 10%;"></div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
const state = useClipperState()

const previewVideo = ref<HTMLVideoElement | null>(null)
const remotionIframe = ref<HTMLIFrameElement | null>(null)

// --- FONT LOADING SYNC ---
const fontsLoaded = ref(0)
const loadedFonts = new Set<string>()

onMounted(() => {
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(() => {
      fontsLoaded.value++
    })
  }
})

watch(() => state.thumbnailTextOverlays.value.map(o => `${o.fontWeight || 900}-${o.fontFamily || 'Montserrat'}`), (fontKeys) => {
  if (typeof document === 'undefined' || !document.fonts) return
  fontKeys.forEach(fontKey => {
    if (!loadedFonts.has(fontKey)) {
      loadedFonts.add(fontKey)
      const parts = fontKey.split('-')
      const weight = parts[0]
      const family = parts.slice(1).join('-')
      
      document.fonts.load(`${weight} 10px "${family}"`).then(() => {
        fontsLoaded.value++
      }).catch(e => console.warn('Font load error:', e))
    }
  })
}, { immediate: true, deep: true })

// Thumbnail time offset: how many seconds the thumbnail occupies at start
const thumbOffset = computed(() => {
  if (!state.thumbnailEnabled.value) return 0
  return state.thumbnailDuration.value
})

// True when playhead is in the thumbnail window
const isInThumbnailWindow = computed(() => {
  return state.thumbnailEnabled.value && state.currentTime.value < thumbOffset.value
})

const videoTime = computed(() => {
  const t = Math.max(0, state.currentTime.value - thumbOffset.value)
  const videoTrack = state.timelineTracks.value.find(tr => tr.id === 'video')
  if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0) return t
  
  const activeItem = videoTrack.items.find((i: any) => t >= i.start && t < i.start + i.duration)
  if (activeItem) {
    const mediaStart = activeItem.mediaStart !== undefined ? activeItem.mediaStart : activeItem.start
    return mediaStart + (t - activeItem.start)
  }
  return t
})

let readyTimeout: any = null

function onVideoReady() {
  if (!state.videoUrl.value) return
  if (readyTimeout) clearTimeout(readyTimeout)
  readyTimeout = setTimeout(() => {
    state.isMediaLoading.value = false
    console.log('[clipper] Video ready and loaded')
  }, 400)
}

function onNativeVideoError(e: Event) {
  const video = e.target as HTMLVideoElement
  const error = video.error
  console.error('[clipper] Native Video Error:', {
    code: error?.code,
    message: error?.message,
    url: state.videoUrl.value
  })
  
  // If we have a URL, treat it as ready to clear the loader, but log the failure
  if (state?.videoUrl.value) {
    onVideoReady()
  }
}

const stableVideoBuster = ref<string>(Date.now().toString())
let safetyTimeout: any = null

watch(() => state.videoUrl.value, (url) => {
  if (url) {
    stableVideoBuster.value = Date.now().toString()
  }
  if (readyTimeout) clearTimeout(readyTimeout)
  if (safetyTimeout) clearTimeout(safetyTimeout)
  if (url) {
    state.isMediaLoading.value = true
    // Safety timeout: 4s to hide loading even if events fail
    safetyTimeout = setTimeout(() => {
      if (state.isMediaLoading.value) state.isMediaLoading.value = false
    }, 4000)
  }
}, { immediate: true })

  // --- REMOTION SYNC ---
  function syncRemotionProps() {
    if (!remotionIframe.value || !remotionIframe.value.contentWindow) return
    
    const hook = state?.activeHook?.value
    let wordsData: any[] = []
    let allWordTimings: any[] = []
    
    const hookDuration = hook ? (hook.duration || (hook.end - hook.start)) : 15
    const syncOffsetSec = state.subtitleSyncOffset.value / 1000
    
    const flatWords: { text: string, start: number, duration: number, end: number }[] = []
    if (state.fullTranscript.value) {
      state.fullTranscript.value.forEach(s => {
        const segText = (s.text || '').trim()
        if (!segText) return
        
        const relativeStart = s.start + syncOffsetSec
        const segmentDuration = s.duration
        if (segmentDuration <= 0) return
        
        const rawWords = segText.split(/\s+/)
        const wordDur = segmentDuration / Math.max(1, rawWords.length)
        
        rawWords.forEach((w: string, idx: number) => {
          const wStart = relativeStart + (idx * wordDur)
          const wEnd = relativeStart + ((idx + 1) * wordDur)
          
          flatWords.push({
            text: w,
            start: wStart,
            duration: wordDur,
            end: wEnd
          })
          
          allWordTimings.push({
            word: w,
            start: wStart,
            end: wEnd
          })
        })
      })
    }
    
    if (flatWords.length > 0) {
      const mode = state.subtitleMode.value || 'word'
      
      if (mode === 'word' || mode === '1_word') {
        flatWords.forEach(w => {
          wordsData.push({
            word: w.text,
            start: w.start,
            end: w.end
          })
        })
      } else if (mode.endsWith('_words')) {
        let numWords = 1
        const match = mode.match(/^(\d+)_(?:word|words)$/)
        if (match) {
          numWords = parseInt(match[1]) || 1
        }
        
        for (let i = 0; i < flatWords.length; i += numWords) {
          const chunk = flatWords.slice(i, i + numWords)
          const start = chunk[0].start
          const end = chunk[chunk.length - 1].end
          const text = chunk.map(w => w.text).join(' ')
          wordsData.push({
            word: text,
            start,
            end
          })
        }
      } else {
        // Character limit based (e.g. 10_chars, 15_chars, 20_chars)
        const limit = parseInt(mode) || 0
        if (limit <= 0) {
          flatWords.forEach(w => {
            wordsData.push({
              word: w.text,
              start: w.start,
              end: w.end
            })
          })
        } else {
          let currentChunk: typeof flatWords = []
          let currentLen = 0
          
          for (const w of flatWords) {
            if (currentLen + w.text.length > limit && currentChunk.length > 0) {
              const start = currentChunk[0].start
              const end = currentChunk[currentChunk.length - 1].end
              const text = currentChunk.map(c => c.text).join(' ')
              wordsData.push({
                word: text,
                start,
                end
              })
              
              currentChunk = [w]
              currentLen = w.text.length
            } else {
              currentChunk.push(w)
              currentLen += w.text.length + (currentChunk.length > 1 ? 1 : 0)
            }
          }
          if (currentChunk.length > 0) {
            const start = currentChunk[0].start
            const end = currentChunk[currentChunk.length - 1].end
            const text = currentChunk.map(c => c.text).join(' ')
            wordsData.push({
              word: text,
              start,
              end
            })
          }
        }
      }
    }
  
    // Probe actual width vs percent. The backend sends cropX pixel. We send cropX pixel.
    const cropXPixel = ((state.cropPercentX.value ?? 50) / 100) * 1920
    
    // Add cache-buster for local assets to prevent "Format error" from stale cache
    let videoSrc = state.videoUrl.value || ''
    if (videoSrc.includes('localhost:8000') && !videoSrc.includes('?t=')) {
      videoSrc += (videoSrc.includes('?') ? '&' : '?') + 't=' + stableVideoBuster.value
    }

    const remotionProps = {
      videoPath: videoSrc,
      words: wordsData,
      wordTimings: allWordTimings,
      cropX: isNaN(cropXPixel) ? 960 : cropXPixel,
      sourceWidth: previewVideo.value?.videoWidth || 1920,
      sourceHeight: previewVideo.value?.videoHeight || 1080,
      position: state.subtitlePosition.value,
      subtitleOffset: state.subtitleOffset.value,
      durationInFrames: Math.floor(state.timelineDuration.value * (state.videoFps.value || 30)),
      fps: state.videoFps.value || 30,
      hideSubtitles: !!state.outputUrl.value && state.videoUrl.value === state.outputUrl.value,
      showDebug: state.showIframeDebug.value,
      volume: state.volume.value, // Let Remotion handle audio for perfect sync
      timelineTextItems: [], // Pass empty array to prevent double rendering in preview (interactive Konva renders them instead)
      timelineAudioItems: JSON.parse(JSON.stringify(state.timelineTracks.value.find(t => t.id === 'audio')?.items || [])),
      timelineVideoItems: JSON.parse(JSON.stringify(state.timelineTracks.value.find(t => t.id === 'video')?.items || [])),
      // Thumbnail props (preview only — actual thumbnail image is handled by renderer)
      thumbnailEnabled: state.thumbnailEnabled.value, // Must be true so Remotion delays <Video> audio past thumbnail window
      thumbnailDuration: state.thumbnailDuration.value,
      thumbnailTextOverlays: JSON.parse(JSON.stringify(state.thumbnailTextOverlays.value || [])),
      subtitleStyle: {
        fontFamily: state.font.value,
        fontSize: state.fontSize.value,
        fontWeight: state.subtitleFontWeight.value,
        color: state.subtitleTextColor.value,
        highlightColor: state.subtitleHighlightColor.value,
        strokeColor: state.subtitleStrokeColor.value,
        strokeWidth: state.subtitleStrokeWidth.value,
        textTransform: state.subtitleTextTransform.value,
        animation: state.subtitleAnimation.value,
        highlightMode: state.subtitleHighlightMode.value,
        background: state.subtitleBackground.value,
        backgroundOpacity: state.subtitleBackgroundOpacity.value,
        wordSpacing: state.subtitleWordSpacing.value,
      }
    }
  
    if (state.showIframeDebug.value) {
      console.log('[Remotion] Sending Props:', remotionProps)
    }

    // Deep-clone to strip Vue reactive proxies (postMessage requires structured-cloneable data)
    remotionIframe.value.contentWindow.postMessage({
      type: 'UPDATE_PROPS',
      payload: JSON.parse(JSON.stringify(remotionProps))
    }, '*')
  }

watch([
  () => state.videoUrl.value,
  () => state.cropPercentX.value,
  () => state.subtitlePosition.value,
  () => state.subtitleOffset.value,
  () => state.subtitleSyncOffset.value,
  () => state?.activeHook?.value,
  () => state.fullTranscript.value,
  () => state.subtitleMode.value,
  () => state.showIframeDebug.value,
  () => state.font.value,
  () => state.fontSize.value,
  () => state.subtitleAnimation.value,
  () => state.subtitleHighlightMode.value,
  () => state.subtitleHighlightColor.value,
  () => state.subtitleTextColor.value,
  () => state.subtitleStrokeColor.value,
  () => state.subtitleStrokeWidth.value,
  () => state.subtitleFontWeight.value,
  () => state.subtitleTextTransform.value,
  () => state.subtitleBackground.value,
  () => state.subtitleBackgroundOpacity.value,
  () => state.subtitleWordSpacing.value,
  () => state.timelineTracks.value,
], () => {
  syncRemotionProps()
}, { deep: true, immediate: true })

// --- PLAY/PAUSE ---
watch(() => state.isPlaying.value, (playing) => {
  console.log('[VideoPreview] isPlaying →', playing)
  
  if (previewVideo.value) {
    if (playing) {
      if (isInThumbnailWindow.value) {
        // During thumbnail: keep native video PAUSED at time 0.
        previewVideo.value.currentTime = 0
        previewVideo.value.muted = true
        // Don't call play()
      } else {
        // Normal play
        previewVideo.value.muted = !state.useNativePlayer.value
        if (state.useNativePlayer.value) {
          previewVideo.value.volume = state.volume.value
        }
        previewVideo.value.currentTime = videoTime.value
        previewVideo.value.play().catch(e => console.warn('Native play blocked:', e))
      }
    } else {
      previewVideo.value.pause()
    }
  }

  if (remotionIframe.value && remotionIframe.value.contentWindow) {
    remotionIframe.value.contentWindow.postMessage({
      type: playing ? 'PLAY' : 'PAUSE'
    }, '*')
  }
})

// --- VOLUME ---
watch(() => state.volume.value, (newVol) => {
  if (previewVideo.value && !isInThumbnailWindow.value) {
    previewVideo.value.volume = newVol
  }
  if (remotionIframe.value && remotionIframe.value.contentWindow) {
    remotionIframe.value.contentWindow.postMessage({
      type: 'UPDATE_PROPS',
      payload: { volume: newVol } // Let Remotion handle audio for perfect sync
    }, '*')
  }
})

// --- Listen for REMOTION_TIMEUPDATE from iframe ---
let isInternalTimeUpdate = false

function onRemotionMessage(event: MessageEvent) {
  const data = event.data
  if (!data) return
  if (data.type === 'REMOTION_TIMEUPDATE') {
    isInternalTimeUpdate = true
    state.currentTime.value = data.currentTime
    
    // Self-healing sync: force native video to strictly follow Remotion's clock.
    // This fixes the "video telat 1s" issue where Remotion drops frames on <Video> mount,
    // causing the JS clock to fall behind the native hardware audio clock.
    if (state.isPlaying.value && previewVideo.value && !isInThumbnailWindow.value) {
      const expectedTime = videoTime.value
      const diff = previewVideo.value.currentTime - expectedTime
      
      // If native video drifts more than 250ms ahead/behind Remotion, force a seek
      if (Math.abs(diff) > 0.25) {
        console.warn(`[VideoPreview] Sync drift detected! Native: ${previewVideo.value.currentTime.toFixed(2)}s, Expected: ${expectedTime.toFixed(2)}s. Force syncing...`)
        previewVideo.value.currentTime = expectedTime
      }
    }

    nextTick(() => { isInternalTimeUpdate = false })
  } else if (data.type === 'IFRAME_READY') {
    console.log('[VideoPreview] Remotion Iframe Ready. Syncing...')
    syncRemotionProps()
  }
}

function onNativeTimeUpdate(e: Event) {
  if (!state.useNativePlayer.value) return
  const video = e.target as HTMLVideoElement
  if (!video || video.paused) return

  isInternalTimeUpdate = true
  const thumbSec = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
  const videoTrack = state.timelineTracks.value.find(tr => tr.id === 'video')
  
  if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0) {
    state.currentTime.value = video.currentTime + thumbSec
  } else {
    const activeItem = videoTrack.items.find((i: any) => {
      const mediaStart = i.mediaStart !== undefined ? i.mediaStart : i.start
      return video.currentTime >= mediaStart && video.currentTime <= mediaStart + i.duration
    })
    if (activeItem) {
      const mediaStart = activeItem.mediaStart !== undefined ? activeItem.mediaStart : activeItem.start
      const relativeOffset = video.currentTime - mediaStart
      state.currentTime.value = activeItem.start + relativeOffset + thumbSec
    } else {
      state.currentTime.value = video.currentTime + thumbSec
    }
  }
  nextTick(() => {
    isInternalTimeUpdate = false
  })
}

// Track whether native video has started for this playback session
let nativeVideoStarted = false

watch(() => state.isPlaying.value, (playing) => {
  if (!playing) nativeVideoStarted = false
})

// --- SEEKING / BOUNDARY CROSSING ---
watch(() => state.currentTime.value, (newTime) => {
  // During playback: handle thumbnail→video boundary
  if (state.isPlaying.value && previewVideo.value && state.thumbnailEnabled.value) {
    if (isInThumbnailWindow.value) {
      // Still in thumbnail — native video should be paused at 0
      nativeVideoStarted = false
    } else if (!nativeVideoStarted) {
      // Just crossed the boundary! Start native video from appropriate relative time.
      nativeVideoStarted = true
      previewVideo.value.currentTime = videoTime.value
      previewVideo.value.muted = !state.useNativePlayer.value
      if (state.useNativePlayer.value) {
        previewVideo.value.volume = state.volume.value
      }
      previewVideo.value.play().catch(e => console.warn('Native play at boundary:', e))
      console.log(`[VideoPreview] Crossed thumb boundary — started native video from ${videoTime.value}s`)
    }
  }

  if (isInternalTimeUpdate) return
  
  if (previewVideo.value && !state.isPlaying.value) {
    if (isInThumbnailWindow.value) {
      previewVideo.value.currentTime = 0
    } else {
      previewVideo.value.currentTime = videoTime.value
    }
  }
  
  if (remotionIframe.value && remotionIframe.value.contentWindow && !state.isPlaying.value) {
    remotionIframe.value.contentWindow.postMessage({
      type: 'SEEK',
      frame: Math.floor(newTime * (state.videoFps.value || 30))
    }, '*')
  }
})

watch(() => state.useNativePlayer.value, (useNative) => {
  if (previewVideo.value) {
    if (useNative) {
      previewVideo.value.muted = false
      previewVideo.value.volume = state.volume.value
    } else {
      previewVideo.value.muted = true
    }
  }
})

onMounted(() => {
  window.addEventListener('message', onRemotionMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', onRemotionMessage)
  handleWindowMouseUp()
  handleWindowTouchEnd()
})

// Native dimensions from metadata
const videoAspect = ref(16 / 9)

function onVideoLoaded(e: Event) {
  onVideoReady()
  const target = e.target as HTMLVideoElement
  console.log('[VideoPreview] Metadata loaded. Duration:', target.duration)
  if (target.duration && isFinite(target.duration)) {
    state.videoDuration.value = target.duration
  }
  if (target.videoWidth && target.videoHeight) {
    videoAspect.value = target.videoWidth / target.videoHeight
  }
}

const container = ref<HTMLElement | null>(null)
const containerHeight = ref(640)
const previewScale = computed(() => containerHeight.value / 1920)
const displayWidth = computed(() => 1080 * previewScale.value)

const containerStyle = computed(() => ({
  height: '100%',
  maxHeight: '90vh',
  width: `${displayWidth.value}px`,
  outline: '1px solid rgba(255,255,255,0.1)',
  outlineOffset: '12px',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  borderRadius: '1.5rem'
}))

const contentStyle = computed(() => ({
  transform: `translate(-50%, -50%) scale(${previewScale.value})`,
}))

// Observe height changes
if (import.meta.client) {
  const updateSize = () => {
    if (container.value) {
      containerHeight.value = container.value.offsetHeight
    }
  }
  const observer = new ResizeObserver(updateSize)
  onMounted(() => {
    if (container.value) observer.observe(container.value)
    updateSize()
  })
  onUnmounted(() => observer.disconnect())
  window.addEventListener('resize', updateSize)
}

// 1080x1920 literal canvas parameters
const CONTAINER_W = 1080
const CONTAINER_H = 1920

const videoDisplayW = computed(() => CONTAINER_H * videoAspect.value) 
const maxOffset = computed(() => Math.max(0, videoDisplayW.value - CONTAINER_W)) 

const videoTransformStyle = computed(() => {
  const pct = state.cropPercentX.value / 100
  const offset = -(pct * maxOffset.value)
  return {
    width: `${videoDisplayW.value}px`,
    transform: `translateX(${offset}px)`,
  }
})

// -- Drag State --
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartPercent = ref(50)

function startDrag(e: MouseEvent) {
  if (state.cropMode.value !== 'manual') return
  // Don't start pan drag if a timeline text overlay is selected (let Konva handle it)
  if (state.selectedTimelineItem.value?.type === 'text' && activeTextItems.value.length > 0) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartPercent.value = state.cropPercentX.value
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value || maxOffset.value === 0) return
  const dx = e.clientX - dragStartX.value
  
  // dx is in screen pixels. Map to 1080 scale using current previewScale.
  const scaledDx = dx / previewScale.value
  
  // Moving mouse right (positive dx) means panning left to show left content, i.e. decreasing percent?
  // Wait, in cropPercentX, typical convention: 0 is completely left. 100 is completely right.
  // Transform is `-(pct * maxOffset)`. 
  // If moving mouse left (negative dx), we want to view more of the RIGHT side. Percent should increase.
  const percentDelta = (scaledDx / maxOffset.value) * -100
  state.cropPercentX.value = Math.max(0, Math.min(100, dragStartPercent.value + percentDelta))
}

function stopDrag() {
  isDragging.value = false
}

function startDragTouch(e: TouchEvent) {
  if (state.cropMode.value !== 'manual') return
  if (state.selectedTimelineItem.value?.type === 'text' && activeTextItems.value.length > 0) return
  isDragging.value = true
  dragStartX.value = e.touches[0].clientX
  dragStartPercent.value = state.cropPercentX.value
}

function onDragTouch(e: TouchEvent) {
  if (!isDragging.value || maxOffset.value === 0) return
  const dx = e.touches[0].clientX - dragStartX.value
  const scaledDx = dx / previewScale.value
  const percentDelta = (scaledDx / maxOffset.value) * -100
  state.cropPercentX.value = Math.max(0, Math.min(100, dragStartPercent.value + percentDelta))
}

// Ensure playback starts if component mounts while state is playing
watch(previewVideo, (el) => {
  if (el && state.isPlaying.value) {
    el.play().catch(() => {})
  }
})

// -- Processing/Status --
const isProcessing = computed(() => [
  'queued', 
  'downloading_video', 
  'extracting_audio',
  'downloading_ai_models',
  'transcribing',
  'generating_hooks', 
  'cutting', 
  'rendering'
].includes(state.jobStatus.value) || state.renderStatus.value === 'rendering')

const statusLabel = computed(() => {
  if (state.renderStatus.value === 'rendering') return 'RENDERING VIDEO...'
  const map: Record<string, string> = {
    queued: 'QUEUED...',
    downloading_video: 'DOWNLOADING 1080p...',
    extracting_audio: 'EXTRACTING AUDIO...',
    downloading_ai_models: 'FETCHING AI MODELS...',
    transcribing: 'TRANSCRIBING (WHISPER)...',
    generating_hooks: 'AI ANALYZING...',
    cutting: 'CUTTING SEGMENT...',
  }
  return map[state.jobStatus.value] || 'PROCESSING...'
})

const progressWidth = computed(() => {
  if (state.renderStatus.value === 'rendering') return '90%'
  const map: Record<string, string> = {
    queued: '5%',
    downloading_video: '20%',
    extracting_audio: '35%',
    downloading_ai_models: '50%',
    transcribing: '65%',
    generating_hooks: '80%',
    cutting: '95%',
    ready: '100%'
  }
  return map[state.jobStatus.value] || '0%'
})

const subtitleIndicatorStyle = computed(() => {
  const pos = state.subtitlePosition.value
  const offset = state.subtitleOffset.value
  if (pos === 'top') return { top: `${offset}px` }
  if (pos === 'bottom') return { bottom: `${offset}px` }
  return { top: '50%', transform: 'translate(-50%, -50%)' }
})

const currentSubtitleText = computed(() => {
  if (!state?.fullTranscript?.value || !state?.activeHook?.value) return ''
  
  const offsetSec = state.subtitleSyncOffset.value / 1000
  const firstStart = state.fullTranscript.value[0]?.start || 0
  const isTranscriptZeroBased = firstStart < (state?.activeHook?.value?.start || 0) - 2
  
  const thumbSec = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
  const relativeTime = Math.max(0, state.currentTime.value - thumbSec)
  
  const searchTime = isTranscriptZeroBased 
    ? relativeTime + offsetSec
    : (state?.activeHook?.value?.start || 0) + relativeTime + offsetSec

  // 1. Flatten all segments in fullTranscript into individual words
  const flatWords: { text: string, start: number, duration: number, end: number }[] = []
  
  for (const seg of state.fullTranscript.value) {
    const segText = (seg.text || '').trim()
    if (!segText) continue
    
    const words = segText.split(/\s+/)
    if (words.length === 1) {
      flatWords.push({
        text: words[0],
        start: seg.start,
        duration: seg.duration,
        end: seg.start + seg.duration
      })
    } else {
      const wordDur = seg.duration / words.length
      words.forEach((w, idx) => {
        flatWords.push({
          text: w,
          start: seg.start + (idx * wordDur),
          duration: wordDur,
          end: seg.start + ((idx + 1) * wordDur)
        })
      })
    }
  }

  if (flatWords.length === 0) return ''

  const mode = state.subtitleMode.value

  // 2. Group flatWords based on subtitleMode
  let groupedSegments: { text: string, start: number, duration: number, end: number }[] = []

  if (mode === 'word' || mode === '1_word') {
    groupedSegments = flatWords
  } else if (mode.endsWith('_words')) {
    let numWords = 1
    const match = mode.match(/^(\d+)_(?:word|words)$/)
    if (match) {
      numWords = parseInt(match[1]) || 1
    }
    
    for (let i = 0; i < flatWords.length; i += numWords) {
      const chunk = flatWords.slice(i, i + numWords)
      const start = chunk[0].start
      const end = chunk[chunk.length - 1].end
      const text = chunk.map(w => w.text).join(' ')
      groupedSegments.push({ text, start, duration: end - start, end })
    }
  } else {
    // Character limit based (e.g. 10_chars, 15_chars, 20_chars)
    const limit = parseInt(mode) || 0
    if (limit <= 0) {
      groupedSegments = flatWords
    } else {
      let currentChunk: typeof flatWords = []
      let currentLen = 0
      
      for (const w of flatWords) {
        if (currentLen + w.text.length > limit && currentChunk.length > 0) {
          const start = currentChunk[0].start
          const end = currentChunk[currentChunk.length - 1].end
          const text = currentChunk.map(c => c.text).join(' ')
          groupedSegments.push({ text, start, duration: end - start, end })
          
          currentChunk = [w]
          currentLen = w.text.length
        } else {
          currentChunk.push(w)
          currentLen += w.text.length + (currentChunk.length > 1 ? 1 : 0)
        }
      }
      if (currentChunk.length > 0) {
        const start = currentChunk[0].start
        const end = currentChunk[currentChunk.length - 1].end
        const text = currentChunk.map(c => c.text).join(' ')
        groupedSegments.push({ text, start, duration: end - start, end })
      }
    }
  }

  // 3. Find the active grouped segment matching searchTime
  const activeGroup = groupedSegments.find(s => searchTime >= s.start && searchTime <= s.end)
  return activeGroup ? activeGroup.text : ''
})

const activeSubtitleWords = computed(() => {
  if (!state?.fullTranscript?.value || !state?.activeHook?.value) return []
  
  const offsetSec = state.subtitleSyncOffset.value / 1000
  const firstStart = state.fullTranscript.value[0]?.start || 0
  const isTranscriptZeroBased = firstStart < (state?.activeHook?.value?.start || 0) - 2
  
  const thumbSec = state.thumbnailEnabled.value ? state.thumbnailDuration.value : 0
  const relativeTime = Math.max(0, state.currentTime.value - thumbSec)
  
  const searchTime = isTranscriptZeroBased 
    ? relativeTime + offsetSec
    : (state?.activeHook?.value?.start || 0) + relativeTime + offsetSec

  // 1. Flatten all segments in fullTranscript into individual words
  const flatWords: { text: string, start: number, duration: number, end: number }[] = []
  
  for (const seg of state.fullTranscript.value) {
    const segText = (seg.text || '').trim()
    if (!segText) continue
    
    const words = segText.split(/\s+/)
    if (words.length === 1) {
      flatWords.push({
        text: words[0],
        start: seg.start,
        duration: seg.duration,
        end: seg.start + seg.duration
      })
    } else {
      const wordDur = seg.duration / words.length
      words.forEach((w, idx) => {
        flatWords.push({
          text: w,
          start: seg.start + (idx * wordDur),
          duration: wordDur,
          end: seg.start + ((idx + 1) * wordDur)
        })
      })
    }
  }

  if (flatWords.length === 0) return []

  const mode = state.subtitleMode.value

  // 2. Group flatWords based on subtitleMode
  let groupedSegments: { words: typeof flatWords, start: number, duration: number, end: number }[] = []

  if (mode === 'word' || mode === '1_word') {
    groupedSegments = flatWords.map(w => ({ words: [w], start: w.start, duration: w.duration, end: w.end }))
  } else if (mode.endsWith('_words')) {
    let numWords = 1
    const match = mode.match(/^(\d+)_(?:word|words)$/)
    if (match) {
      numWords = parseInt(match[1]) || 1
    }
    
    for (let i = 0; i < flatWords.length; i += numWords) {
      const chunk = flatWords.slice(i, i + numWords)
      const start = chunk[0].start
      const end = chunk[chunk.length - 1].end
      groupedSegments.push({ words: chunk, start, duration: end - start, end })
    }
  } else {
    // Character limit based (e.g. 10_chars, 15_chars, 20_chars)
    const limit = parseInt(mode) || 0
    if (limit <= 0) {
      groupedSegments = flatWords.map(w => ({ words: [w], start: w.start, duration: w.duration, end: w.end }))
    } else {
      let currentChunk: typeof flatWords = []
      let currentLen = 0
      
      for (const w of flatWords) {
        if (currentLen + w.text.length > limit && currentChunk.length > 0) {
          const start = currentChunk[0].start
          const end = currentChunk[currentChunk.length - 1].end
          groupedSegments.push({ words: currentChunk, start, duration: end - start, end })
          
          currentChunk = [w]
          currentLen = w.text.length
        } else {
          currentChunk.push(w)
          currentLen += w.text.length + (currentChunk.length > 1 ? 1 : 0)
        }
      }
      if (currentChunk.length > 0) {
        const start = currentChunk[0].start
        const end = currentChunk[currentChunk.length - 1].end
        groupedSegments.push({ words: currentChunk, start, duration: end - start, end })
      }
    }
  }

  // 3. Find the active grouped segment matching searchTime
  const activeGroup = groupedSegments.find(s => searchTime >= s.start && searchTime <= s.end)
  if (!activeGroup) return []

  // 4. Return the words in the active group, with their individual timing and state relative to searchTime
  return activeGroup.words.map(w => {
    const isActive = searchTime >= w.start && searchTime <= w.end
    const isPast = searchTime > w.end
    return {
      text: w.text,
      start: w.start,
      end: w.end,
      isActive,
      isPast
    }
  })
})

const getWordStyle = (w: { text: string, isActive: boolean, isPast: boolean }) => {
  const hlMode = state.subtitleHighlightMode.value
  const hlColor = state.subtitleHighlightColor.value
  const strokeWidth = state.subtitleStrokeWidth.value
  const strokeColor = state.subtitleStrokeColor.value

  const baseStyle: Record<string, string | number> = {
    display: 'inline-block',
    transition: 'all 0.1s ease',
  }

  // Apply base stroke/textShadow to each word span
  if (strokeWidth > 0) {
    baseStyle.textShadow = `-${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px -${strokeWidth}px 0 ${strokeColor}, -${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, ${strokeWidth}px ${strokeWidth}px 0 ${strokeColor}, 0 8px 16px rgba(0,0,0,0.8)`
  } else {
    baseStyle.textShadow = '0 8px 16px rgba(0,0,0,0.8)'
  }

  if (w.isActive) {
    if (hlMode === 'color') {
      baseStyle.color = hlColor
      baseStyle.transform = 'scale(1.08)'
    } else if (hlMode === 'scale') {
      baseStyle.transform = 'scale(1.15)'
    } else if (hlMode === 'underline') {
      baseStyle.borderBottom = `6px solid ${hlColor}`
      baseStyle.paddingBottom = '4px'
    } else if (hlMode === 'box') {
      baseStyle.background = hlColor
      baseStyle.color = '#000000'
      baseStyle.borderRadius = '12px'
      baseStyle.padding = '4px 16px'
      baseStyle.textShadow = 'none' // Remove text shadow for box highlight
      baseStyle.transform = 'scale(1.05)'
    }
  }

  return baseStyle
}

const formatWordText = (text: string) => {
  if (state.subtitleTextTransform.value === 'uppercase') {
    return text.toUpperCase()
  }
  return text
}

// --- Timeline Text Overlays ---
const activeTextItems = computed(() => {
  const textTrack = state.timelineTracks.value.find(t => t.id === 'text')
  if (!textTrack) return []
  return textTrack.items.filter((item: any) => 
    state.currentTime.value >= item.start && 
    state.currentTime.value <= (item.start + item.duration)
  )
})

function onTextDragEnd(e: any, item: any) {
  item.x = Math.round(e.target.x())
  item.y = Math.round(e.target.y())
}

const transformerRef = ref<any>(null)

function isCurrentItemActive(item: any) {
  if (!item) return false
  return state.currentTime.value >= item.start && state.currentTime.value <= (item.start + item.duration)
}

const isTimelineTextActiveAndSelected = computed(() => {
  const item = state.selectedTimelineItem.value
  if (!item || item.type !== 'text') return false
  return isCurrentItemActive(item)
})

function updateTransformer() {
  if (!transformerRef.value) return
  const transformerNode = transformerRef.value.getNode()
  const stage = transformerNode.getStage()
  if (!stage) return

  const item = state.selectedTimelineItem.value
  if (item && item.type === 'text' && isTimelineTextActiveAndSelected.value) {
    const selectedNode = stage.findOne('.' + item.id)
    if (selectedNode) {
      transformerNode.nodes([selectedNode])
      transformerNode.getLayer().batchDraw()
      return
    }
  }
  transformerNode.nodes([])
  transformerNode.getLayer().batchDraw()
}

watch([() => state.selectedTimelineItem.value, () => state.currentTime.value, isTimelineTextActiveAndSelected], () => {
  nextTick(() => {
    updateTransformer()
  })
})

function handleTransform(e: any, item: any) {
  const node = e.target
  const scaleX = node.scaleX()
  
  // Calculate new font size based on scale
  const currentFontSize = item.fontSize || 80
  const newSize = Math.max(12, Math.round(currentFontSize * scaleX))
  
  // Update state properties
  item.fontSize = newSize
  
  // Reset scales to prevent visual stretching
  node.scaleX(1)
  node.scaleY(1)
  
  // Recalculate centering offset because size changed
  const width = node.width()
  const height = node.height()
  node.offsetX(width / 2)
  node.offsetY(height / 2)
  
  // Request redraw
  node.getLayer().batchDraw()
}

function onLabelRender(e: any) {
  const node = e.target
  const width = node.width()
  const height = node.height()
  node.offsetX(width / 2)
  node.offsetY(height / 2)
}

function handleStageClick(e: any) {
  const clickedOnStage = e.target === e.target.getStage()
  if (clickedOnStage) {
    state.selectedTimelineItem.value = null
  }
}

function handleMouseEnterLabel(e: any) {
  const stage = e.target.getStage()
  if (stage) stage.container().style.cursor = 'move'
}

function handleMouseLeaveLabel(e: any) {
  const stage = e.target.getStage()
  if (stage) stage.container().style.cursor = 'default'
}

function selectItem(item: any) {
  state.selectedTimelineItem.value = item
}

function onThumbnailLabelDragEnd(e: any, overlay: any) {
  overlay.x = e.target.x()
  overlay.y = e.target.y()
}

const isThumbBgDragging = ref(false)
const thumbBgDragStartX = ref(0)
const thumbBgDragStartOffset = ref(50)

function handleWindowMouseMove(e: MouseEvent) {
  if (!isThumbBgDragging.value) return
  const dx = e.clientX - thumbBgDragStartX.value
  const scaledDx = dx / previewScale.value
  
  // Calculate source aspect ratio
  const srcW = state.sourceWidth?.value || 1920
  const srcH = state.sourceHeight?.value || 1080
  
  // Width of panned landscape background under 'object-cover' (locked to 1920 height)
  const imgWidth = 1920 * (srcW / srcH)
  const excessWidth = Math.max(1, imgWidth - 1080)
  
  // Percent delta mapping client coordinates to offset percent
  const percentDelta = (scaledDx / excessWidth) * -100
  
  state.thumbnailXOffset.value = Math.max(0, Math.min(100, thumbBgDragStartOffset.value + percentDelta))
}

function handleWindowMouseUp() {
  if (isThumbBgDragging.value) {
    isThumbBgDragging.value = false
    window.removeEventListener('mousemove', handleWindowMouseMove)
    window.removeEventListener('mouseup', handleWindowMouseUp)
    // Save configuration auto-pushed to DB on drag release
    state.saveThumbnailConfig()
  }
}

function startThumbBgDrag(e: any) {
  if (!state.thumbnailEditMode.value) return
  const evt = e.evt || e
  isThumbBgDragging.value = true
  thumbBgDragStartX.value = evt.clientX
  thumbBgDragStartOffset.value = state.thumbnailXOffset.value
  
  window.addEventListener('mousemove', handleWindowMouseMove)
  window.addEventListener('mouseup', handleWindowMouseUp)
}

function handleWindowTouchMove(e: TouchEvent) {
  if (!isThumbBgDragging.value || !e.touches.length) return
  const dx = e.touches[0].clientX - thumbBgDragStartX.value
  const scaledDx = dx / previewScale.value
  
  const srcW = state.sourceWidth?.value || 1920
  const srcH = state.sourceHeight?.value || 1080
  
  const imgWidth = 1920 * (srcW / srcH)
  const excessWidth = Math.max(1, imgWidth - 1080)
  
  const percentDelta = (scaledDx / excessWidth) * -100
  
  state.thumbnailXOffset.value = Math.max(0, Math.min(100, thumbBgDragStartOffset.value + percentDelta))
}

function handleWindowTouchEnd() {
  if (isThumbBgDragging.value) {
    isThumbBgDragging.value = false
    window.removeEventListener('touchmove', handleWindowTouchMove)
    window.removeEventListener('touchend', handleWindowTouchEnd)
    state.saveThumbnailConfig()
  }
}

function startThumbBgDragTouch(e: any) {
  if (!state.thumbnailEditMode.value) return
  const evt = e.evt || e
  if (!evt.touches || !evt.touches.length) return
  isThumbBgDragging.value = true
  thumbBgDragStartX.value = evt.touches[0].clientX
  thumbBgDragStartOffset.value = state.thumbnailXOffset.value
  
  window.addEventListener('touchmove', handleWindowTouchMove)
  window.addEventListener('touchend', handleWindowTouchEnd)
}

</script>
