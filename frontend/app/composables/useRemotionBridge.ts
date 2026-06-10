// useRemotionBridge.ts - Encapsulates Remotion player communication via PlayerBridge seam
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useClipperState } from './useClipperState'
import { parseSubtitleWords } from '../utils/remotionHelpers'
import { PlayerBridge } from '../utils/playerBridge'

export const useRemotionBridge = (
  bridge: PlayerBridge,
  previewVideo: { value: HTMLVideoElement | null },
  videoTime: { value: number },
  isInThumbnailWindow: { value: boolean },
  stableVideoBuster: { value: string }
) => {
  const state = useClipperState()
  const lastSeekFrame = ref<number | null>(null)
  
  // Internal flag to prevent recursive updates when synced from inside iframe timeupdates
  const isInternalTimeUpdate = ref(false)
  let nativeVideoStarted = false
  let unsubscribe: (() => void) | null = null

  function syncRemotionProps() {
    const syncOffsetMs = state.subtitleSyncOffset.value
    const mode = state.subtitleMode.value || 'word'

    const { wordsData, allWordTimings } = parseSubtitleWords(
      state.fullTranscript.value,
      syncOffsetMs,
      mode
    )
  
    const cropXPixel = ((state.cropPercentX.value ?? 50) / 100) * 1920
    
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
      volume: state.volume.value,
      timelineTextItems: [],
      timelineAudioItems: JSON.parse(JSON.stringify(state.timelineTracks.value.find(t => t.id === 'audio')?.items || [])),
      timelineVideoItems: JSON.parse(JSON.stringify(state.timelineTracks.value.find(t => t.id === 'video')?.items || [])),
      thumbnailEnabled: state.thumbnailEnabled.value,
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

    bridge.updateProps(JSON.parse(JSON.stringify(remotionProps)))

    if (!state.isPlaying.value) {
      const targetFrame = Math.floor(state.currentTime.value * (state.videoFps.value || 30))
      console.log('[VideoPreview] Forcing instant Remotion seek on props sync:', targetFrame)
      bridge.seek(targetFrame)
      lastSeekFrame.value = targetFrame
    }
  }

  function onRemotionMessage(data: any) {
    if (!data) return
    if (data.type === 'REMOTION_TIMEUPDATE') {
      isInternalTimeUpdate.value = true
      state.currentTime.value = data.currentTime
      
      if (state.isPlaying.value && previewVideo.value && !isInThumbnailWindow.value) {
        const expectedTime = videoTime.value
        const diff = previewVideo.value.currentTime - expectedTime
        
        if (Math.abs(diff) > 0.25) {
          console.warn(`[VideoPreview] Sync drift detected! Native: ${previewVideo.value.currentTime.toFixed(2)}s, Expected: ${expectedTime.toFixed(2)}s. Force syncing...`)
          previewVideo.value.currentTime = expectedTime
        }
      }

      nextTick(() => { isInternalTimeUpdate.value = false })
    } else if (data.type === 'IFRAME_READY') {
      console.log('[VideoPreview] Remotion Iframe Ready. Syncing...')
      syncRemotionProps()
      const targetFrame = Math.floor(state.currentTime.value * (state.videoFps.value || 30))
      console.log('[VideoPreview] Forcing instant Remotion seek on IFRAME_READY:', targetFrame)
      bridge.seek(targetFrame)
      lastSeekFrame.value = targetFrame
    }
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
    () => state.thumbnailEnabled.value,
    () => state.thumbnailDuration.value,
    () => state.thumbnailTextOverlays.value,
  ], () => {
    syncRemotionProps()
  }, { deep: true, immediate: true })

  watch(() => state.isPlaying.value, (playing) => {
    if (!playing) nativeVideoStarted = false
    
    if (previewVideo.value) {
      if (playing) {
        if (isInThumbnailWindow.value) {
          previewVideo.value.currentTime = 0
          previewVideo.value.muted = true
        } else {
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

    if (playing) {
      bridge.play()
    } else {
      bridge.pause()
    }
  })

  watch(() => state.volume.value, (newVol) => {
    if (previewVideo.value && !isInThumbnailWindow.value) {
      previewVideo.value.volume = newVol
    }
    bridge.updateProps({ volume: newVol })
  })

  watch(() => state.currentTime.value, (newTime) => {
    if (state.isTimelineShifting.value) return

    if (state.isPlaying.value && previewVideo.value && state.thumbnailEnabled.value) {
      if (isInThumbnailWindow.value) {
        if (!previewVideo.value.paused) previewVideo.value.pause()
        previewVideo.value.currentTime = 0
        previewVideo.value.muted = true
        nativeVideoStarted = false
      } else if (!nativeVideoStarted) {
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

    if (isInternalTimeUpdate.value) return
    
    if (previewVideo.value && !state.isPlaying.value) {
      if (isInThumbnailWindow.value) {
        if (previewVideo.value.currentTime !== 0) previewVideo.value.currentTime = 0
      } else {
        const targetTime = videoTime.value
        if (Math.abs(previewVideo.value.currentTime - targetTime) > 0.001) {
          previewVideo.value.currentTime = targetTime
        }
      }
    }
    
    if (!state.isPlaying.value) {
      const targetFrame = Math.floor(newTime * (state.videoFps.value || 30))
      if (lastSeekFrame.value !== targetFrame) {
        bridge.seek(targetFrame)
        lastSeekFrame.value = targetFrame
      }
    }
  })

  watch(() => state.isTimelineShifting.value, (shifting) => {
    if (!shifting) {
      if (previewVideo.value) {
        if (isInThumbnailWindow.value) {
          if (previewVideo.value.currentTime !== 0) previewVideo.value.currentTime = 0
        } else {
          const targetTime = videoTime.value
          if (Math.abs(previewVideo.value.currentTime - targetTime) > 0.001) {
            previewVideo.value.currentTime = targetTime
          }
        }
      }
      if (!state.isPlaying.value) {
        const targetFrame = Math.floor(state.currentTime.value * (state.videoFps.value || 30))
        if (lastSeekFrame.value !== targetFrame) {
          bridge.seek(targetFrame)
          lastSeekFrame.value = targetFrame
        }
      }
    }
  })

  onMounted(() => {
    unsubscribe = bridge.onMessage(onRemotionMessage)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })

  return {
    syncRemotionProps,
    isInternalTimeUpdate,
    setNativeVideoStarted: (val: boolean) => { nativeVideoStarted = val }
  }
}
