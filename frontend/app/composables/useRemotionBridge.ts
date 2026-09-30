// useRemotionBridge.ts - Lean reactive adapter delegating to VideoPlaybackCoordinator
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useClipperState } from './useClipperState';
import type { PlayerBridge } from '../utils/playerBridge';
import {
  VideoPlaybackCoordinator,
  type PlaybackStateSnapshot
} from '../utils/playbackCoordinator';

export const useRemotionBridge = (
  bridge: PlayerBridge,
  previewVideo: { value: HTMLVideoElement | null },
  videoTime: { value: number },
  isInThumbnailWindow: { value: boolean },
  stableVideoBuster: { value: string }
) => {
  const state = useClipperState();
  const coordinator = new VideoPlaybackCoordinator(bridge);
  const isInternalTimeUpdate = ref(false);
  let unsubscribe: (() => void) | null = null;

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
    landscapeBackground: state.landscapeBackground?.value || 'black',
    landscapeBlurRadius: state.landscapeBlurRadius?.value ?? 25,
    landscapeDarkness: state.landscapeDarkness?.value ?? 35,
    subtitlePosition: state.subtitlePosition.value,
    subtitleOffset: state.subtitleOffset.value,
    autoAdaptiveSubtitles: state.autoAdaptiveSubtitles?.value ?? true,
    cropMode: state.cropMode?.value || 'face_tracking',
    cropMap: state.cropMap?.value || [],
    cropPercentX: state.cropPercentX.value ?? 50,
    cropPercentXTop: state.cropPercentXTop?.value ?? 50,
    cropPercentXBottom: state.cropPercentXBottom?.value ?? 50,
    splitZoomTop: state.splitZoomTop?.value ?? 1.0,
    splitZoomBottom: state.splitZoomBottom?.value ?? 1.0,
    splitOffsetXTop: state.splitOffsetXTop?.value ?? 0,
    splitOffsetYTop: state.splitOffsetYTop?.value ?? 0,
    splitOffsetXBottom: state.splitOffsetXBottom?.value ?? 0,
    splitOffsetYBottom: state.splitOffsetYBottom?.value ?? 0,
    font: state.font.value,
    fontSize: state.fontSize.value,
    subtitleFontWeight: state.subtitleFontWeight.value,
    subtitlesEnabled: state.subtitlesEnabled?.value ?? true,
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
    coverEnabled: state.coverEnabled?.value ?? state.thumbnailEnabled.value,
    coverDuration: state.coverDuration?.value ?? state.thumbnailDuration.value,
    coverTextOverlays:
      state.coverTextOverlays?.value ?? state.thumbnailTextOverlays.value,
    coverXOffset:
      state.coverXOffset?.value ?? state.thumbnailXOffset?.value ?? 50,
    coverImagePath: state.coverUrl?.value ?? state.thumbnailUrl?.value,
    thumbnailEnabled: state.thumbnailEnabled.value,
    thumbnailDuration: state.thumbnailDuration.value,
    thumbnailTextOverlays: state.thumbnailTextOverlays.value,
    thumbnailXOffset: state.thumbnailXOffset?.value ?? 50,
    thumbnailImagePath: state.thumbnailUrl?.value,
    isInThumbnailWindow: isInThumbnailWindow.value,
    audioBleepEnabled: state.audioBleepEnabled.value,
    audioBleepSource: state.audioBleepSource?.value,
    customBleepData: state.customBleepFile?.value?.data,
    flaggedSegments: state.contentAudit.value?.flaggedSegments
  });

  function syncRemotionProps() {
    coordinator.syncProps(getSnapshot(), {
      width: previewVideo.value?.videoWidth || 1920,
      height: previewVideo.value?.videoHeight || 1080
    });
  }

  function onRemotionMessage(data: any) {
    if (!data) return;
    if (data.type === 'REMOTION_TIMEUPDATE') {
      isInternalTimeUpdate.value = true;

      const res = coordinator.handleRemotionTimeUpdate(
        data.currentTime,
        getSnapshot(),
        previewVideo.value
      );
      state.currentTime.value = res.newCurrentTime;
      if (res.shouldPause) {
        state.isPlaying.value = false;
      }

      nextTick(() => {
        isInternalTimeUpdate.value = false;
      });
    } else if (data.type === 'REMOTION_ENDED') {
      state.isPlaying.value = false;
    } else if (data.type === 'REMOTION_PAUSED') {
      state.isPlaying.value = false;
    } else if (data.type === 'IFRAME_READY') {
      console.log('[VideoPreview] Remotion Iframe Ready. Syncing...');
      syncRemotionProps();
      state.isMediaLoading.value = false;
    }
  }

  watch(
    [
      () => state.videoUrl.value,
      () => state.cropMode?.value,
      () => state.cropMap?.value,
      () => state.cropPercentX.value,
      () => state.cropPercentXTop?.value,
      () => state.cropPercentXBottom?.value,
      () => state.splitZoomTop?.value,
      () => state.splitZoomBottom?.value,
      () => state.splitOffsetXTop?.value,
      () => state.splitOffsetYTop?.value,
      () => state.splitOffsetXBottom?.value,
      () => state.splitOffsetYBottom?.value,
      () => state.subtitlePosition.value,
      () => state.videoLayout?.value,
      () => state.landscapeBackground?.value,
      () => state.landscapeBlurRadius?.value,
      () => state.landscapeDarkness?.value,
      () => state.subtitleOffset.value,
      () => state.autoAdaptiveSubtitles?.value,
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
      () => state.subtitlesEnabled?.value,
      () => state.timelineTracks.value,
      () => state.thumbnailEnabled.value,
      () => state.thumbnailDuration.value,
      () => state.thumbnailTextOverlays.value,
      () => state.audioBleepEnabled?.value,
      () => state.audioBleepSource?.value,
      () => state.customBleepFile?.value?.data,
      () => state.contentAudit?.value?.flaggedSegments
    ],
    () => {
      syncRemotionProps();
    },
    { deep: true, immediate: true }
  );

  watch(
    () => state.isPlaying.value,
    playing => {
      coordinator.handlePlayStateChange(
        playing,
        getSnapshot(),
        previewVideo.value
      );
    }
  );

  watch(
    () => state.volume.value,
    () => {
      coordinator.handleMuteVolumeChange(getSnapshot(), previewVideo.value);
    }
  );

  watch(
    () => state.currentTime.value,
    newTime => {
      if (isInternalTimeUpdate.value) return;
      coordinator.handleTimeChange(newTime, getSnapshot(), previewVideo.value);
    }
  );

  watch(
    () => state.isTimelineShifting.value,
    shifting => {
      if (!shifting) {
        coordinator.handleTimeChange(
          state.currentTime.value,
          getSnapshot(),
          previewVideo.value
        );
      }
    }
  );

  watch(
    [
      () => coordinator.isInsideFlaggedSegment(getSnapshot()),
      () => state.isPlaying.value,
      () => state.audioBleepSource?.value,
      () => state.customBleepFile?.value?.data,
      () => state.volume.value
    ],
    () => {
      coordinator.handleMuteVolumeChange(getSnapshot(), previewVideo.value);
    }
  );

  onMounted(() => {
    unsubscribe = bridge.onMessage(onRemotionMessage);
  });

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  return {
    syncRemotionProps,
    isInternalTimeUpdate,
    setNativeVideoStarted: (val: boolean) =>
      coordinator.setNativeVideoStarted(val)
  };
};
