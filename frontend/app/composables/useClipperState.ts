// Composable for managing the entire clipper state
import { useSystemDiagnostics } from './useSystemDiagnostics';
import { useSafetyAuditor } from './useSafetyAuditor';
import {
  DEFAULT_BLACKLIST,
  CATEGORIZED_BLACKLIST
} from '../utils/safetyEngine';
import { useTimelineState } from './useTimelineState';
import { createDefaultTimelineTracks } from '../utils/timelineHelpers';
import { useClipperJob } from './useClipperJob';
import { useClipperCover } from './useClipperCover';
import { useClipperExport } from './useClipperExport';
import type { RenderSpec } from '../types/render';
import { useSubtitleStyle } from './useSubtitleStyle';
import { useAppNotifier } from './useAppNotifier';
import { usePromptRepository } from './usePromptRepository';
import { useCachedLibrary } from './useCachedLibrary';
import { useClipEditorSession } from './useClipEditorSession';
import { useAudioLibrary } from './useAudioLibrary';
import { useReleaseUpdates } from './useReleaseUpdates';
import { HOOK_DISCOVERY_MODELS } from '../utils/hookDiscoveryModels';

import fontsManifest from '../../../shared/fonts_manifest.json';
import type {
  Hook,
  CachedVideo,
  LastAccessedClip,
  TranscriptSegment,
  CropMapPoint
} from '../types/clipper';

export const FONT_OPTIONS = fontsManifest.fonts.map(
  (f: { name: string }) => f.name
);

export const WHISPER_MODELS = [
  {
    id: 'tiny',
    name: 'Tiny',
    speed: 'Ultra Fast',
    acc: 'Basic',
    desc: 'Minimal accuracy, best for quick testing on weak hardware.'
  },
  {
    id: 'base',
    name: 'Base',
    speed: 'Very Fast',
    acc: 'Good',
    desc: 'Great balance for clear audio. Default choice.'
  },
  {
    id: 'small',
    name: 'Small',
    speed: 'Fast',
    acc: 'Better',
    desc: 'Significantly better for non-English or noisy audio.'
  },
  {
    id: 'medium',
    name: 'Medium',
    speed: 'Moderate',
    acc: 'Excellent',
    desc: 'High precision. Requires decent hardware (~5GB VRAM).'
  },
  {
    id: 'large-v3',
    name: 'Large-v3',
    speed: 'Slow',
    acc: 'State-of-the-Art',
    desc: 'Highest accuracy possible. Best for complex dialogue.'
  }
] as const;

let cachedState: ReturnType<typeof createClipperState> | null = null;

export const useClipperState = () => {
  if (import.meta.server) {
    return createClipperState();
  }

  if (!cachedState) {
    cachedState = createClipperState();
  }
  return cachedState;
};

function createClipperState() {
  // Instantiate Sub-composables for separated concerns
  const diagnostics = useSystemDiagnostics();
  const auditor = useSafetyAuditor();
  const timeline = useTimelineState();
  const job = useClipperJob({ timeline });
  let editorSessionRef: ReturnType<typeof useClipEditorSession> | null = null;
  const coverState = useClipperCover({
    timeline,
    onSaveCoverConfig: () => editorSessionRef?.saveCoverConfig()
  });
  const thumbnailState = coverState;
  const subtitleStyle = useSubtitleStyle();
  const notifier = useAppNotifier();
  const promptRepo = usePromptRepository(notifier);
  const audioLib = useAudioLibrary(notifier);
  const releaseUpdates = useReleaseUpdates();

  const {
    audioLibrary,
    isAudioLibraryLoading,
    fetchAudioLibrary,
    uploadAudioFile,
    deleteAudioItem
  } = audioLib;

  // Application Notification state delegated from useAppNotifier sub-composable
  const { toast, showToast, dismissToast } = notifier;

  // Prompts & presets state delegated from usePromptRepository sub-composable
  const {
    promptsList,
    selectedPrompt,
    extractionMode,
    selectedPresetId,
    focusTopic,
    minDuration,
    maxDuration,
    fetchPrompts,
    createPrompt,
    addPrompt,
    editPrompt,
    deletePrompt
  } = promptRepo;

  const library = useCachedLibrary();

  // Cached video library & saved hooks state delegated from useCachedLibrary sub-composable
  const {
    cachedVideos,
    isCachedLoading,
    isCachedMoreLoading,
    cachedVideosFetchError,
    cachedVideosTotal,
    cachedVideosPage,
    cachedVideosLimit,
    cachedVideosSearch,
    cachedVideosSortBy,
    cachedVideosSortOrder,
    cachedVideosHasMore,
    lastAccessedVideoId,
    lastAccessedClip,
    lastAccessedVideoStored,
    lastAccessedVideo,
    savedHooks,
    readyClips,
    isReadyClipsLoading,
    hasReadyClipsLoaded,
    fetchCached,
    fetchReadyClips,
    invalidateReadyClipsCache,
    setLastAccessed,
    setLastClip,
    fetchSavedHooks,
    saveHook,
    deleteSavedHook
  } = library;

  // Job state delegated from useClipperJob sub-composable
  const {
    jobId,
    isMediaLoading,
    jobStatus,
    jobError,
    jobErrorDetail,
    lastAnalysisRequest,
    canRetryLastAnalysis,
    isNavigatingToEditor,
    hydratedSession,
    startSafetyBuffer,
    isCachedAnalysis,
    downloadPercent,
    hdReady
  } = job;

  // Cover & Thumbnail state delegated from useClipperCover sub-composable
  const {
    coverEnabled,
    coverUrl,
    coverDuration,
    coverScreenshotTime,
    coverTextOverlays,
    coverEditMode,
    coverXOffset,
    activeCoverTextId,
    isDeletingCover,
    isCapturingCover,
    defaultCoverStyle,
    resetCoverState,
    captureScreenshot,
    addCoverText,
    removeCoverText,
    toggleCover,
    deleteCover,
    loadDefaultCoverStyle,
    saveDefaultCoverStyle,
    applyDefaultCoverStyle,

    thumbnailEnabled,
    thumbnailUrl,
    thumbnailDuration,
    thumbnailScreenshotTime,
    thumbnailTextOverlays,
    thumbnailEditMode,
    thumbnailXOffset,
    activeThumbnailTextId,
    isDeletingThumbnail,
    isCapturingThumbnail,
    defaultThumbnailStyle,
    resetThumbnailState,
    addThumbnailText,
    removeThumbnailText,
    toggleThumbnail,
    deleteThumbnail,
    loadDefaultThumbnailStyle,
    saveDefaultThumbnailStyle,
    applyDefaultThumbnailStyle
  } = coverState;

  // Export state delegated from useClipperExport sub-composable
  const exportState = useClipperExport();
  const {
    renderStatus,
    renderProgress,
    renderStage,
    renderEta,
    outputUrl,
    isRenderPreviewActive,
    shouldPlayRendered,
    renderFrame,
    renderTotalFrames,
    renderStartTime,
    exportClip,
    cancelRender,
    openRenderFolder
  } = exportState;

  // Clip editor session state delegated from useClipEditorSession sub-composable
  const editorSession = useClipEditorSession({
    notifier,
    library,
    timeline,
    subtitleStyle,
    auditor,
    job,
    coverState,
    exportState
  });
  editorSessionRef = editorSession;

  const {
    folderName,
    clipId,
    fullTranscript,
    hooks,
    activeHook,
    videoFps,
    volume,
    cropMode,
    cropMap,
    subtitlesEnabled,
    autoAdaptiveSubtitles,
    isSessionSaving,
    scheduleSessionSave,
    flushSessionSaves,
    loadReadyClipIntoEditor,
    isClipSessionHydrated,
    activateClipSession,
    openReadyClipInEditor,
    saveTranscript,
    saveClipSession,
    updateHooks,
    saveStyleSettings,
    saveTimelineTracks,
    saveHistoryToBackend,
    saveCoverConfig,
    saveDefaultStyleSettings,
    toggleSubtitles,
    applyPreset,
    buildRenderSpec,
    renderClip,
    undo,
    redo
  } = editorSession;

  // Video info
  const videoTitle = useState<string>('videoTitle', () => '');
  const videoDuration = useState<number>('videoDuration', () => 0);
  const hasHeatmap = useState<boolean>('hasHeatmap', () => false);
  const hasPreview = useState<boolean>('hasPreview', () => false);
  const videoUrl = useState<string | null>('videoUrl', () => null);

  const activeSafeZone = useState<'none' | 'tiktok' | 'reels' | 'shorts'>(
    'activeSafeZone',
    () => 'none'
  );
  const safeZoneOpacity = useState<number>('safeZoneOpacity', () => 100);
  const safeZoneColor = useState<string>('safeZoneColor', () => '#000000');
  const isOverlayVisible = useState<boolean>('isOverlayVisible', () => false);
  const isEditorLocked = computed(() =>
    Boolean(
      isOverlayVisible.value ||
      renderStatus.value === 'rendering' ||
      isRenderPreviewActive.value
    )
  );

  const segmentPadding = 2; // Match backend YouTubeParser safe_start buffer

  // Settings
  const youtubeUrl = useState<string>('youtubeUrl', () => '');
  const language = useState<string>('language', () => 'auto');
  const videoLayout = useState<'vertical' | 'landscape'>(
    'videoLayout',
    () => 'vertical'
  );
  const landscapeBackground = useState<'black' | 'blur'>(
    'landscapeBackground',
    () => 'black'
  );
  const landscapeBlurRadius = useState<number>('landscapeBlurRadius', () => 25);
  const landscapeDarkness = useState<number>('landscapeDarkness', () => 35);
  const subtitlePosition = useState<string>('subtitlePosition', () => 'center');
  const subtitleOffset = useState<number>('subtitleOffset', () => 50);
  const subtitleSyncOffset = useState<number>('subtitleSyncOffset', () => 150); // Default 150ms offset
  const font = useState<string>('font', () => 'Montserrat');
  const fontSize = useState<number>('fontSize', () => 50);
  const faceTracking = useState<boolean>('faceTracking', () => false);
  const cropPercentX = useState<number>('cropPercentX', () => 50); // 0=left, 50=center, 100=right
  const cropPercentXTop = useState<number>('cropPercentXTop', () => 50);
  const cropPercentXBottom = useState<number>('cropPercentXBottom', () => 50);
  const splitZoomTop = useState<number>('splitZoomTop', () => 1.0);
  const splitZoomBottom = useState<number>('splitZoomBottom', () => 1.0);
  const splitOffsetXTop = useState<number>('splitOffsetXTop', () => 0);
  const splitOffsetYTop = useState<number>('splitOffsetYTop', () => 0);
  const splitOffsetXBottom = useState<number>('splitOffsetXBottom', () => 0);
  const splitOffsetYBottom = useState<number>('splitOffsetYBottom', () => 0);
  const subtitleMode = useState<'word' | '3_words' | '4_words'>(
    'subtitleMode',
    () => 'word'
  );
  const whisperModel = useState<string>('whisperModel', () => 'base');
  const showIframeDebug = useState<boolean>('showIframeDebug', () => false);

  // Subtitle style
  const subtitleAnimation = useState<string>('subtitleAnimation', () => 'pop');
  const subtitleHighlightMode = useState<string>(
    'subtitleHighlightMode',
    () => 'color'
  );
  const subtitleHighlightColor = useState<string>(
    'subtitleHighlightColor',
    () => '#CFFF50'
  );
  const subtitleTextColor = useState<string>(
    'subtitleTextColor',
    () => '#FFFFFF'
  );
  const subtitleStrokeColor = useState<string>(
    'subtitleStrokeColor',
    () => '#000000'
  );
  const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth', () => 4);
  const subtitleFontWeight = useState<number>('subtitleFontWeight', () => 900);
  const subtitleTextTransform = useState<string>(
    'subtitleTextTransform',
    () => 'uppercase'
  );
  const subtitleBackground = useState<string>(
    'subtitleBackground',
    () => 'none'
  );
  const subtitleBackgroundOpacity = useState<number>(
    'subtitleBackgroundOpacity',
    () => 0.7
  );
  const subtitleWordSpacing = useState<number>('subtitleWordSpacing', () => 0);
  const subtitlePreset = useState<string>(
    'subtitlePreset',
    () => 'bold-podcast'
  );

  // Playback state (Shared Clock)
  const isPlaying = useState<boolean>('isPlaying', () => false);
  const currentTime = useState<number>('currentTime', () => 0);

  let isPersistenceInitialized = false;

  // --- Actions ---
  const {
    analyzeUrl,
    analyzeCached,
    retryLastAnalysis,
    setJobError,
    clearJobError,
    startPolling,
    stopPolling,
    isPolling,
    isPollingJob,
    getPollingPhase,
    clearHydratedSession,
    extractClip
  } = job;

  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function seekTo(targetTime: number) {
    const sanitized = Math.max(
      0,
      typeof targetTime === 'number' ? targetTime : 0
    );
    currentTime.value = sanitized;
  }

  function initPersistence() {
    if (import.meta.server || isPersistenceInitialized) return;
    isPersistenceInitialized = true;

    WorkspacePersistenceCoordinator.bindReactivity({
      promptRepo,
      library,
      editorSession,
      auditor,
      timeline,
      thumbnail: {
        loadDefaultThumbnailStyle: thumbnailState.loadDefaultThumbnailStyle
      },
      cover: {
        coverEnabled,
        coverDuration,
        coverScreenshotTime,
        coverTextOverlays,
        coverXOffset,
        saveCoverConfig
      },
      subtitleStyle
    });
  }

  function resetWorkspace() {
    stopPolling();
    clearHydratedSession();
    editorSession.resetSession();
    jobId.value = null;
    jobStatus.value = 'idle';
    clearJobError();
    lastAnalysisRequest.value = null;
    savedHooks.value = [];
    timeline.timelineTracks.value = createDefaultTimelineTracks();
    videoUrl.value = null;
    outputUrl.value = null;
    renderStatus.value = 'idle';
    isMediaLoading.value = false;
    isCachedAnalysis.value = false;
    downloadPercent.value = 0;
    hdReady.value = false;
    resetThumbnailState();
  }

  function maskFlaggedWords() {
    auditor.maskFlaggedWords();
  }

  function revertMaskedWords() {
    auditor.revertMaskedWords();
  }

  return {
    contentAudit: auditor.contentAudit,
    customBlacklist: auditor.customBlacklist,
    customWhitelist: auditor.customWhitelist,
    safetySensitivity: auditor.safetySensitivity,
    maskingStyle: auditor.maskingStyle,
    audioBleepEnabled: auditor.audioBleepEnabled,
    audioBleepSource: auditor.audioBleepSource,
    customBleepFile: auditor.customBleepFile,
    bleepLibrary: auditor.bleepLibrary,
    selectedBleepAudioId: auditor.selectedBleepAudioId,
    selectBleepAudio: auditor.selectBleepAudio,
    addCustomBleepFile: auditor.addCustomBleepFile,
    removeCustomBleepFile: auditor.removeCustomBleepFile,
    bleepPaddingOffset: auditor.bleepPaddingOffset,
    isWarningIgnored: auditor.isWarningIgnored,
    activeCategories: auditor.activeCategories,
    activePlatformFilters: auditor.activePlatformFilters,
    categorizedBlacklist: auditor.categorizedBlacklist,
    safeZoneVisible: auditor.safeZoneVisible,
    saveBlacklistToStorage: auditor.saveBlacklistToStorage,
    layoutAudit: auditor.layoutAudit,
    readabilityAudit: auditor.readabilityAudit,
    DEFAULT_BLACKLIST,
    CATEGORIZED_BLACKLIST,
    thumbnailEnabled,
    thumbnailUrl,
    thumbnailDuration,
    thumbnailScreenshotTime,
    thumbnailTextOverlays,
    thumbnailEditMode,
    thumbnailXOffset,
    activeThumbnailTextId,
    isCapturingThumbnail,
    defaultThumbnailStyle,
    // Other State
    jobId,
    isMediaLoading,
    jobStatus,
    jobError,
    jobErrorDetail,
    lastAnalysisRequest,
    canRetryLastAnalysis,
    setJobError,
    clearJobError,
    isCachedAnalysis,
    isOverlayVisible,
    isNavigatingToEditor,
    downloadPercent,
    hdReady,
    startSafetyBuffer,
    videoTitle,
    videoDuration,
    hasHeatmap,
    hasPreview,
    videoUrl,
    videoFps,
    hooks,
    savedHooks,
    activeHook,
    segmentPadding,
    folderName,
    clipId,
    fullTranscript,
    promptsList,
    selectedPrompt,
    extractionMode,
    selectedPresetId,
    focusTopic,
    minDuration,
    maxDuration,
    youtubeUrl,
    language,
    videoLayout,
    landscapeBackground,
    landscapeBlurRadius,
    landscapeDarkness,
    subtitlePosition,
    subtitleOffset,
    subtitleSyncOffset,
    subtitlesEnabled,
    autoAdaptiveSubtitles,
    font,
    fontSize,
    faceTracking,
    cropMode,
    cropMap,
    cropPercentX,
    cropPercentXTop,
    cropPercentXBottom,
    splitZoomTop,
    splitZoomBottom,
    splitOffsetXTop,
    splitOffsetYTop,
    splitOffsetXBottom,
    splitOffsetYBottom,
    subtitleMode,
    whisperModel,
    showIframeDebug,
    whisperModels: WHISPER_MODELS,
    geminiModel: diagnostics.geminiModel,
    hookDiscoveryModels: HOOK_DISCOVERY_MODELS,
    activeSafeZone,
    safeZoneOpacity,
    safeZoneColor,
    subtitleAnimation,
    subtitleHighlightMode,
    subtitleHighlightColor,
    subtitleTextColor,
    subtitleStrokeColor,
    subtitleStrokeWidth,
    subtitleFontWeight,
    subtitleTextTransform,
    subtitleBackground,
    subtitleBackgroundOpacity,
    subtitleWordSpacing,
    subtitlePreset,
    volume,
    isPlaying,
    currentTime,
    videoTime: timeline.videoTime,
    isTimelineShifting: timeline.isTimelineShifting,
    isDraggingTimelineItem: timeline.isDraggingTimelineItem,
    renderStatus,
    renderProgress,
    renderStage,
    renderEta,
    outputUrl,
    isRenderPreviewActive,
    isEditorLocked,
    shouldPlayRendered,
    renderFrame,
    renderTotalFrames,
    renderStartTime,
    readyClips,
    isReadyClipsLoading,
    hasReadyClipsLoaded,
    hydratedSession,
    cachedVideos,
    isCachedLoading,
    isCachedMoreLoading,
    cachedVideosFetchError,
    lastAccessedVideoId,
    lastAccessedVideo,
    lastAccessedClip,
    lastAccessedVideoStored,
    cachedVideosTotal,
    cachedVideosPage,
    cachedVideosLimit,
    cachedVideosSearch,
    cachedVideosSortBy,
    cachedVideosSortOrder,
    cachedVideosHasMore,
    timelineTracks: timeline.timelineTracks,
    activeTrackIds: timeline.activeTrackIds,
    timelineDuration: timeline.timelineDuration,
    selectedTimelineItem: timeline.selectedTimelineItem,
    defaultTimelineTextStyle: timeline.defaultTimelineTextStyle,
    deepAuditResults: auditor.deepAuditResults,
    isDeepAuditing: auditor.isDeepAuditing,
    bleepMode: auditor.bleepMode,
    systemHealth: diagnostics.systemHealth,
    checkingHealth: diagnostics.checkingHealth,
    healthError: diagnostics.healthError,
    isAnyPrerequisiteMissing: diagnostics.isAnyPrerequisiteMissing,
    settingsScrollTarget: diagnostics.settingsScrollTarget,
    hardwareProfile: diagnostics.hardwareProfile,
    detectingHardware: diagnostics.detectingHardware,
    hardwareError: diagnostics.hardwareError,
    // Actions
    seekTo,
    analyzeUrl,
    analyzeCached,
    retryLastAnalysis,
    extractClip,
    loadReadyClipIntoEditor,
    isClipSessionHydrated,
    activateClipSession,
    openReadyClipInEditor,
    renderClip,
    buildRenderSpec,
    exportClip,
    cancelRender,
    startPolling,
    stopPolling,
    isPolling,
    isPollingJob,
    getPollingPhase,
    clearHydratedSession,
    checkSystemHealth: diagnostics.checkSystemHealth,
    detectHardwareProfile: diagnostics.detectHardwareProfile,
    formatDuration,
    fetchPrompts,
    createPrompt,
    addPrompt,
    editPrompt,
    deletePrompt,
    fetchSavedHooks,
    saveHook,
    deleteSavedHook,
    saveClipSession,
    saveTranscript,
    saveStyleSettings,
    isSessionSaving,
    scheduleSessionSave,
    flushSessionSaves,
    applyPreset,
    subtitleStyle,
    toggleSubtitles,
    saveDefaultStyleSettings,
    updateHooks,
    runDeepAudit: auditor.runDeepAudit,
    maskFlaggedWords,
    revertMaskedWords,
    fitSubtitlesToSafeZone: auditor.fitSubtitlesToSafeZone,
    fitSubtitlesToReadability: auditor.fitSubtitlesToReadability,
    ignoreSafetyWarnings: auditor.ignoreSafetyWarnings,
    restoreSafetyWarnings: auditor.restoreSafetyWarnings,
    fetchCached,
    fetchReadyClips,
    invalidateReadyClipsCache,
    setLastAccessed,
    setLastClip,
    saveTimelineTracks,
    saveHistoryToBackend,
    setActiveTrack: timeline.setActiveTrack,
    canDeleteTrack: timeline.canDeleteTrack,
    addTrack: timeline.addTrack,
    deleteTrack: timeline.deleteTrack,
    toggleTrackMute: timeline.toggleTrackMute,
    toggleTrackVisibility: timeline.toggleTrackVisibility,
    moveTimelineItemToTrack: timeline.moveTimelineItemToTrack,
    addTimelineItem: timeline.addTimelineItem,
    deleteTimelineItem: timeline.deleteTimelineItem,
    updateTimelineItem: timeline.updateTimelineItem,
    saveTimelineTextStyleAsDefault: timeline.saveTimelineTextStyleAsDefault,
    syncGlobalStylesToItem: timeline.syncGlobalStylesToItem,
    canUndo: timeline.canUndo,
    canRedo: timeline.canRedo,
    commitToHistory: timeline.commitToHistory,
    isSavingHistory: timeline.isSavingHistory,
    hasUnsavedHistory: timeline.hasUnsavedHistory,
    undo,
    redo,
    captureScreenshot,
    addThumbnailText,
    removeThumbnailText,
    saveThumbnailConfig: saveCoverConfig,
    deleteThumbnail,
    toggleThumbnail,
    resetWorkspace,
    openRenderFolder,
    toast,
    showToast,
    dismissToast,
    initPersistence,
    loadDefaultThumbnailStyle,
    saveDefaultThumbnailStyle,
    applyDefaultThumbnailStyle,

    // Canonical Cover Slide API
    coverEnabled,
    coverUrl,
    coverDuration,
    coverScreenshotTime,
    coverTextOverlays,
    coverEditMode,
    coverXOffset,
    activeCoverTextId,
    isDeletingCover,
    isCapturingCover,
    defaultCoverStyle,
    resetCoverState,
    addCoverText,
    removeCoverText,
    saveCoverConfig,
    toggleCover,
    deleteCover,
    loadDefaultCoverStyle,
    saveDefaultCoverStyle,
    applyDefaultCoverStyle,

    // Workspace Audio Library API
    audioLibrary,
    isAudioLibraryLoading,
    fetchAudioLibrary,
    uploadAudioFile,
    deleteAudioItem,

    // Hybrid Changelog & Remote Release Updates API
    installedVersion: releaseUpdates.installedVersion,
    hasAvailableUpdate: releaseUpdates.hasAvailableUpdate,
    latestAvailableVersion: releaseUpdates.latestAvailableVersion,
    checkForUpdates: releaseUpdates.checkForUpdates
  };
}
