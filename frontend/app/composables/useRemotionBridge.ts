// useRemotionBridge.ts - Lean reactive adapter delegating to VideoPlaybackCoordinator
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useClipperState } from './useClipperState'
import { PlayerBridge } from '../utils/playerBridge'
import {
  VideoPlaybackCoordinator,
  type PlaybackStateSnapshot
} from '../utils/playbackCoordinator'

export const useRemotionBridge = (
  bridge: PlayerBridge,
  previewVideo: { value: HTMLVideoElement | null },
  videoTime: { value: number },
  isInThumbnailWindow: { value: boolean },
  stableVideoBuster: { value: string }
) => {
  const state = useClipperState()
  const coordinator = new VideoPlaybackCoordinator(bridge)
  const isInternalTimeUpdate = ref(false)
  let unsubscribe: (() => void) | null = null
  let bleepAudioPlayer: HTMLAudioElement | null = null

  const getSnapshot = (): PlaybackStateSnapshot => ({
    currentTime: state.currentTime.value,
    videoTime: videoTime.value,
    timelineDuration: state.timelineDuration.value,
    videoFps: state.videoFps.value || 30,
    volume: state.volume.value,
    isPlaying: state.isPlaying.value,
    useNativePlayer: state.useNativePlayer.value,
    isTimelineShifting: state.isTimelineShifting.value,
    videoUrl: state.videoUrl.value,
    outputUrl: state.outputUrl.value,
    stableVideoBuster: stableVideoBuster.value,
    fullTranscript: state.fullTranscript.value,
    subtitleSyncOffset: state.subtitleSyncOffset.value,
    subtitleMode: state.subtitleMode.value || 'word',
    activeHook: state.activeHook?.value || null,
    showIframeDebug: state.showIframeDebug.value,
    videoLayout: state.videoLayout?.value || 'vertical',
    subtitlePosition: state.subtitlePosition.value,
    subtitleOffset: state.subtitleOffset.value,
    cropMode: state.cropMode?.value || 'face_tracking',
    cropMap: state.cropMap?.value || [],
    cropPercentX: state.cropPercentX.value ?? 50,
    font: state.font.value,
    fontSize: state.fontSize.value,
    subtitleFontWeight: state.subtitleFontWeight.value,
    subtitleTextColor: state.subtitleTextColor.value,
    subtitleHighlightColor: state.subtitleHighlightColor.value,
    subtitleStrokeColor: state.subtitleStrokeColor.value,
    subtitleStrokeWidth: state.subtitleStrokeWidth.value,
    subtitleTextTransform: state.subtitleTextTransform.value,
    subtitleAnimation: state.subtitleAnimation.value,
    subtitleHighlightMode: state.subtitleHighlightMode.value,
    subtitleBackground: state.subtitleBackground.value,
    subtitleBackgroundOpacity: state.subtitleBackgroundOpacity.value,
    subtitleWordSpacing: state.subtitleWordSpacing.value,
    timelineTracks: state.timelineTracks.value,
    thumbnailEnabled: state.thumbnailEnabled.value,
    thumbnailDuration: state.thumbnailDuration.value,
    thumbnailTextOverlays: state.thumbnailTextOverlays.value,
    isInThumbnailWindow: isInThumbnailWindow.value,
    audioBleepEnabled: state.audioBleepEnabled.value,
    audioBleepSource: state.audioBleepSource?.value,
    customBleepData: state.customBleepFile?.value?.data,
    flaggedSegments: state.contentAudit.value?.flaggedSegments
  })

  function syncRemotionProps() {
    coordinator.syncProps(getSnapshot(), {
      width: previewVideo.value?.videoWidth || 1920,
      height: previewVideo.value?.videoHeight || 1080
    })
  }

  function handleBleepAudio(audioResult: { audioDataChanged: boolean; isMuted: boolean }) {
    const currentAudioData = state.customBleepFile?.value?.data || ''

    if (audioResult.audioDataChanged) {
      if (bleepAudioPlayer) {
        bleepAudioPlayer.pause()
        bleepAudioPlayer = null
      }
    }

    if (audioResult.isMuted) {
      if (state.audioBleepSource?.value === 'custom' && currentAudioData) {
        if (!bleepAudioPlayer) {
          bleepAudioPlayer = new Audio(currentAudioData)
          bleepAudioPlayer.loop = true
        }
        if (bleepAudioPlayer.paused) {
          bleepAudioPlayer.currentTime = 0
          bleepAudioPlayer.play().catch(e => console.warn('Bleep playback failed:', e))
        }
      }
    } else {
      if (bleepAudioPlayer && !bleepAudioPlayer.paused) {
        bleepAudioPlayer.pause()
      }
    }
  }

  function onRemotionMessage(data: any) {
    if (!data) return
    if (data.type === 'REMOTION_TIMEUPDATE') {
      isInternalTimeUpdate.value = true

      const res = coordinator.handleRemotionTimeUpdate(data.currentTime, getSnapshot(), previewVideo.value)
      state.currentTime.value = res.newCurrentTime
      if (res.shouldPause) {
        state.isPlaying.value = false
      }

      nextTick(() => { isInternalTimeUpdate.value = false })
    } else if (data.type === 'IFRAME_READY') {
      console.log('[VideoPreview] Remotion Iframe Ready. Syncing...')
      syncRemotionProps()
      state.isMediaLoading.value = false
    }
  }

  watch([
    () => state.videoUrl.value,
    () => state.cropMode?.value,
    () => state.cropMap?.value,
    () => state.cropPercentX.value,
    () => state.subtitlePosition.value,
    () => state.videoLayout?.value,
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
    coordinator.handlePlayStateChange(playing, getSnapshot(), previewVideo.value)
  })

  watch(() => state.volume.value, () => {
    const res = coordinator.handleMuteVolumeChange(getSnapshot(), previewVideo.value)
    handleBleepAudio(res)
  })

  watch(() => state.currentTime.value, (newTime) => {
    if (isInternalTimeUpdate.value) return
    coordinator.handleTimeChange(newTime, getSnapshot(), previewVideo.value)
  })

  watch(() => state.isTimelineShifting.value, (shifting) => {
    if (!shifting) {
      coordinator.handleTimeChange(state.currentTime.value, getSnapshot(), previewVideo.value)
    }
  })

  watch([
    () => coordinator.isInsideFlaggedSegment(getSnapshot()),
    () => state.isPlaying.value,
    () => state.audioBleepSource?.value,
    () => state.customBleepFile?.value?.data,
    () => state.volume.value
  ], () => {
    const res = coordinator.handleMuteVolumeChange(getSnapshot(), previewVideo.value)
    handleBleepAudio(res)
  })

  onMounted(() => {
    unsubscribe = bridge.onMessage(onRemotionMessage)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
    if (bleepAudioPlayer) {
      bleepAudioPlayer.pause()
      bleepAudioPlayer = null
    }
  })

  return {
    syncRemotionProps,
    isInternalTimeUpdate,
    setNativeVideoStarted: (val: boolean) => coordinator.setNativeVideoStarted(val)
  }
}
