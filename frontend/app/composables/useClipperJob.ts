// useClipperJob.ts - Reactive bridge delegating to IngestionJobCoordinator
import { useTimelineState } from './useTimelineState'
import { mapThumbnailOverlays } from '../utils/thumbnailHelpers'
import {
  IngestionJobCoordinator,
  type HydratedClipBundle,
  type JobUpdateCallbacks
} from '../utils/jobCoordinator'
import type {
  Hook,
  TranscriptSegment,
  ThumbnailTextOverlay,
  SubtitleStyleSettings,
  HookExtractionMode,
  HookIntentPreset
} from '../types/clipper'

export const useClipperJob = () => {
  const API_BASE = 'http://localhost:8000'
  const timeline = useTimelineState()
  const coordinator = new IngestionJobCoordinator(API_BASE, undefined, 2000)

  // Ingestion global states (shared via useState keys)
  const jobId = useState<string | null>('jobId', () => null)
  const isMediaLoading = useState<boolean>('isMediaLoading', () => false)
  const jobStatus = useState<string>('jobStatus', () => 'idle')
  const jobError = useState<string | null>('jobError', () => null)
  const isNavigatingToEditor = useState<boolean>('isNavigatingToEditor', () => false)
  const isCachedAnalysis = useState<boolean>('isCachedAnalysis', () => false)
  const downloadPercent = useState<number>('downloadPercent', () => 0)
  const hdReady = useState<boolean>('hdReady', () => false)

  // Shared state references needed by polling and actions
  const videoTitle = useState<string>('videoTitle', () => '')
  const videoDuration = useState<number>('videoDuration', () => 0)
  const hasHeatmap = useState<boolean>('hasHeatmap', () => false)
  const hasPreview = useState<boolean>('hasPreview', () => false)
  const videoUrl = useState<string | null>('videoUrl', () => null)
  const videoFps = useState<number>('videoFps', () => 30)
  const hooks = useState<Hook[]>('hooks', () => [])
  const savedHooks = useState<Hook[]>('savedHooks', () => [])
  const activeHook = useState<Hook | null>('activeHook', () => null)
  const folderName = useState<string | null>('folderName', () => null)
  const clipId = useState<string | null>('clipId', () => null)
  const fullTranscript = useState<TranscriptSegment[]>('fullTranscript', () => [])
  const isPlaying = useState<boolean>('isPlaying', () => false)
  const currentTime = useState<number>('currentTime', () => 0)

  // Settings/prompts
  const promptsList = useState<{id: string, name: string, suitableFor: string[], prompt?: string, numHooks?: number, autoHooks?: boolean}[]>('promptsList', () => [])
  const selectedPrompt = useState<string>('selectedPrompt', () => 'prompt.json')
  const extractionMode = useState<HookExtractionMode>('extractionMode', () => 'preset')
  const selectedPresetId = useState<HookIntentPreset>('selectedPresetId', () => 'auto')
  const focusTopic = useState<string>('focusTopic', () => '')
  const minDuration = useState<number>('minDuration', () => 30)
  const maxDuration = useState<number>('maxDuration', () => 180)
  const youtubeUrl = useState<string>('youtubeUrl', () => '')
  const language = useState<string>('language', () => 'id')
  const whisperModel = useState<string>('whisperModel', () => 'base')
  const startSafetyBuffer = useState<number>('startSafetyBuffer', () => 2.0)

  // Subtitle positions / styling
  const videoLayout = useState<'vertical' | 'landscape'>('videoLayout', () => 'vertical')
  const subtitlePosition = useState<string>('subtitlePosition', () => 'center')
  const subtitleOffset = useState<number>('subtitleOffset', () => 50)
  const subtitleSyncOffset = useState<number>('subtitleSyncOffset', () => 150)
  const font = useState<string>('font', () => 'Montserrat')
  const fontSize = useState<number>('fontSize', () => 50)
  const cropMode = useState<string>('cropMode', () => 'face_tracking')
  const cropMap = useState<Array<{ time: number, x: number }>>('cropMap', () => [])
  const cropPercentX = useState<number>('cropPercentX', () => 50)
  const subtitleMode = useState<'word' | '3_words' | '4_words'>('subtitleMode', () => 'word')
  const subtitleAnimation = useState<string>('subtitleAnimation', () => 'pop')
  const subtitleHighlightMode = useState<string>('subtitleHighlightMode', () => 'color')
  const subtitleHighlightColor = useState<string>('subtitleHighlightColor', () => '#CFFF50')
  const subtitleTextColor = useState<string>('subtitleTextColor', () => '#FFFFFF')
  const subtitleStrokeColor = useState<string>('subtitleStrokeColor', () => '#000000')
  const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth', () => 4)
  const subtitleFontWeight = useState<number>('subtitleFontWeight', () => 900)
  const subtitleTextTransform = useState<string>('subtitleTextTransform', () => 'uppercase')
  const subtitleBackground = useState<string>('subtitleBackground', () => 'none')
  const subtitleBackgroundOpacity = useState<number>('subtitleBackgroundOpacity', () => 0.7)
  const subtitleWordSpacing = useState<number>('subtitleWordSpacing', () => 0)
  const volume = useState<number>('volume', () => 0.5)
  const subtitlePreset = useState<string>('subtitlePreset', () => 'bold-podcast')

  // Thumbnail state
  const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
  const thumbnailUrl = useState<string | null>('thumbnailUrl', () => null)
  const thumbnailDuration = useState<number>('thumbnailDuration', () => 1.0)
  const thumbnailScreenshotTime = useState<number>('thumbnailScreenshotTime', () => 0)
  const thumbnailTextOverlays = useState<ThumbnailTextOverlay[]>('thumbnailTextOverlays', () => [])
  const thumbnailEditMode = useState<boolean>('thumbnailEditMode', () => false)
  const thumbnailXOffset = useState<number>('thumbnailXOffset', () => 50)
  const outputUrl = useState<string | null>('outputUrl', () => null)
  const renderStatus = useState<string>('renderStatus', () => 'idle')

  function applySubtitleStyles(styles: Partial<SubtitleStyleSettings>) {
    if (styles.videoLayout) videoLayout.value = styles.videoLayout
    if (styles.subtitlePosition) subtitlePosition.value = styles.subtitlePosition
    if (styles.subtitleOffset !== undefined) subtitleOffset.value = styles.subtitleOffset
    if (styles.subtitleSyncOffset !== undefined) subtitleSyncOffset.value = styles.subtitleSyncOffset
    if (styles.font) font.value = styles.font
    if (styles.fontSize !== undefined) fontSize.value = styles.fontSize
    if (styles.cropMode) cropMode.value = styles.cropMode
    if (styles.cropMap) cropMap.value = styles.cropMap
    if (styles.cropPercentX !== undefined) cropPercentX.value = styles.cropPercentX
    if (styles.subtitleMode) subtitleMode.value = styles.subtitleMode
    if (styles.subtitleAnimation) subtitleAnimation.value = styles.subtitleAnimation
    if (styles.subtitleHighlightMode) subtitleHighlightMode.value = styles.subtitleHighlightMode
    if (styles.subtitleHighlightColor) subtitleHighlightColor.value = styles.subtitleHighlightColor
    if (styles.subtitleTextColor) subtitleTextColor.value = styles.subtitleTextColor
    if (styles.subtitleStrokeColor) subtitleStrokeColor.value = styles.subtitleStrokeColor
    if (styles.subtitleStrokeWidth !== undefined) subtitleStrokeWidth.value = styles.subtitleStrokeWidth
    if (styles.subtitleFontWeight !== undefined) subtitleFontWeight.value = styles.subtitleFontWeight
    if (styles.subtitleTextTransform) subtitleTextTransform.value = styles.subtitleTextTransform
    if (styles.subtitleBackground) subtitleBackground.value = styles.subtitleBackground
    if (styles.subtitleBackgroundOpacity !== undefined) subtitleBackgroundOpacity.value = styles.subtitleBackgroundOpacity
    if (styles.subtitleWordSpacing !== undefined) subtitleWordSpacing.value = styles.subtitleWordSpacing
    if (styles.volume !== undefined) volume.value = styles.volume
    if (styles.subtitlePreset) subtitlePreset.value = styles.subtitlePreset
  }

  function resetThumbnailState(keepLocked = false) {
    timeline.isSavingLocked.value = true
    thumbnailEnabled.value = false
    thumbnailUrl.value = null
    thumbnailDuration.value = 1.0
    thumbnailScreenshotTime.value = 0
    thumbnailXOffset.value = 50
    thumbnailTextOverlays.value = []
    thumbnailEditMode.value = false
    if (!keepLocked) {
      nextTick(() => {
        timeline.isSavingLocked.value = false
      })
    }
  }

  function applyHydratedClipBundle(bundle: HydratedClipBundle) {
    if (bundle.videoFps) videoFps.value = bundle.videoFps
    if (bundle.videoDuration) videoDuration.value = bundle.videoDuration
    if (bundle.folderName) folderName.value = bundle.folderName
    if (bundle.clipId) clipId.value = bundle.clipId
    if (bundle.assetUrl) videoUrl.value = bundle.assetUrl

    if (bundle.transcript && bundle.transcript.length > 0) {
      fullTranscript.value = bundle.transcript
    }

    if (bundle.styleSettings) {
      applySubtitleStyles(bundle.styleSettings)
    }

    if (bundle.cropMap && bundle.cropMap.length > 0) {
      cropMap.value = bundle.cropMap
    }

    if (bundle.timelineTracks && bundle.timelineTracks.length > 0) {
      timeline.timelineTracks.value = bundle.timelineTracks
    }

    if (timeline.timelineTracks.value[0]?.items?.length === 0) {
      timeline.timelineTracks.value[0].items = [{
        id: 'main-video',
        name: 'Main Video',
        start: 0,
        mediaStart: 0,
        duration: bundle.videoDuration || videoDuration.value
      }]
    }

    if (bundle.thumbnailConfig) {
      thumbnailEnabled.value = bundle.thumbnailConfig.enabled ?? false
      thumbnailDuration.value = bundle.thumbnailConfig.duration ?? 1.0
      thumbnailScreenshotTime.value = bundle.thumbnailConfig.screenshotTime ?? 0
      thumbnailXOffset.value = bundle.thumbnailConfig.xOffset ?? 50
      thumbnailTextOverlays.value = mapThumbnailOverlays(bundle.thumbnailConfig.textOverlays)
      thumbnailUrl.value = `${API_BASE}/assets/clips/${bundle.folderName}/${bundle.clipId}/thumbnail.jpg?t=${Date.now()}`
    }

    if (bundle.savedHooks && bundle.savedHooks.length > 0) {
      savedHooks.value = bundle.savedHooks
    }

    if (bundle.hooks && bundle.hooks.length > 0) {
      hooks.value = bundle.hooks
    }

    if (bundle.activeHook) {
      activeHook.value = bundle.activeHook
    }

    if (bundle.history) {
      timeline.loadHistoryFromResponse(bundle.history)
    }
  }

  const createJobCallbacks = (): JobUpdateCallbacks => ({
    onStatusChange: (status) => {
      jobStatus.value = status
    },
    onDownloadProgress: (percent) => {
      downloadPercent.value = percent
    },
    onVideoMetadata: (meta) => {
      if (meta.title) videoTitle.value = meta.title
      if (meta.duration) videoDuration.value = meta.duration
      if (meta.fps) videoFps.value = meta.fps
      if (meta.hasHeatmap !== undefined) hasHeatmap.value = meta.hasHeatmap
      if (meta.hasPreview !== undefined) hasPreview.value = meta.hasPreview
      if (meta.hdReady !== undefined) hdReady.value = meta.hdReady
      if (meta.videoUrl && !activeHook.value) videoUrl.value = meta.videoUrl
      if (meta.folderName && (!folderName.value || folderName.value !== meta.folderName)) {
        folderName.value = meta.folderName
      }
    },
    onHooksDiscovered: (discoveredHooks, firstHook) => {
      hooks.value = discoveredHooks
      if (firstHook && !activeHook.value) {
        activeHook.value = firstHook
      }
    },
    onSavedHooksDiscovered: (saved) => {
      savedHooks.value = saved
    },
    onClipReady: (bundle) => {
      applyHydratedClipBundle(bundle)
      isMediaLoading.value = false
    },
    onSelfHeal: async (selfHealFolder, selfHealClipId) => {
      await loadReadyClipIntoEditor(selfHealFolder, selfHealClipId)
    },
    onError: (err) => {
      jobError.value = err
      isMediaLoading.value = false
    }
  })

  async function analyzeUrl(force = false) {
    if (!youtubeUrl.value) return

    isCachedAnalysis.value = false
    downloadPercent.value = 0
    hdReady.value = false
    jobStatus.value = 'queued'
    jobError.value = null
    hooks.value = []
    savedHooks.value = []
    folderName.value = null
    videoUrl.value = null
    outputUrl.value = null
    activeHook.value = null
    clipId.value = null

    try {
      const currentPrompt = promptsList.value.find(p => p.id === selectedPrompt.value)
      const newJobId = await coordinator.analyzeUrl(
        {
          url: youtubeUrl.value,
          language: language.value,
          promptFile: selectedPrompt.value,
          numHooks: currentPrompt?.numHooks ?? 10,
          autoHooks: currentPrompt?.autoHooks ?? false,
          extractionMode: extractionMode.value,
          presetId: selectedPresetId.value,
          focusTopic: focusTopic.value ? focusTopic.value.trim() : null,
          minDuration: minDuration.value || 30,
          maxDuration: maxDuration.value || 180,
          force
        },
        createJobCallbacks()
      )
      jobId.value = newJobId
    } catch (e: any) {
      jobStatus.value = 'error'
      jobError.value = e instanceof Error ? e.message : 'Failed to start analysis'
    }
  }

  async function analyzeCached(
    videoId: string, 
    force = false, 
    options?: { 
      extractionMode?: HookExtractionMode
      presetId?: HookIntentPreset
      promptFile?: string
      focusTopic?: string
      minDuration?: number
      maxDuration?: number
      autoHooks?: boolean 
    }
  ) {
    if (!videoId) return

    isCachedAnalysis.value = true
    downloadPercent.value = 0
    hdReady.value = false
    jobStatus.value = 'queued'
    jobError.value = null
    hooks.value = []
    savedHooks.value = []
    folderName.value = null
    videoUrl.value = null
    outputUrl.value = null
    activeHook.value = null
    clipId.value = null
    timeline.isSavingLocked.value = true
    if (timeline.timelineTracks.value[0]) {
      timeline.timelineTracks.value[0].items = []
    }
    resetThumbnailState()

    try {
      const currentPrompt = promptsList.value.find(p => p.id === (options?.promptFile ?? selectedPrompt.value))
      const newJobId = await coordinator.analyzeCached(
        {
          videoId,
          force,
          extractionMode: options?.extractionMode ?? extractionMode.value ?? 'preset',
          presetId: options?.presetId ?? selectedPresetId.value ?? 'auto',
          promptFile: options?.promptFile ?? selectedPrompt.value ?? 'prompt.json',
          focusTopic: options?.focusTopic ?? (focusTopic.value ? focusTopic.value.trim() : null),
          minDuration: options?.minDuration ?? minDuration.value ?? 30,
          maxDuration: options?.maxDuration ?? maxDuration.value ?? 180,
          autoHooks: options?.autoHooks ?? currentPrompt?.autoHooks ?? true
        },
        createJobCallbacks()
      )
      jobId.value = newJobId
    } catch (e: any) {
      jobStatus.value = 'error'
      jobError.value = e instanceof Error ? e.message : 'Failed to analyze cached video'
    } finally {
      setTimeout(() => {
        timeline.isSavingLocked.value = false
      }, 500)
    }
  }

  function startPolling() {
    if (!jobId.value) return
    coordinator.startPolling(
      jobId.value,
      { folderName: folderName.value, clipId: clipId.value },
      createJobCallbacks()
    )
  }

  function stopPolling() {
    coordinator.stopPolling()
  }

  async function extractClip(hook: Hook) {
    if (!jobId.value) return

    isPlaying.value = false
    currentTime.value = 0
    activeHook.value = hook
    clipId.value = null
    videoUrl.value = null
    outputUrl.value = null
    renderStatus.value = 'idle'
    fullTranscript.value = []
    if (timeline.timelineTracks.value[0]) {
      timeline.timelineTracks.value[0].items = []
    }
    resetThumbnailState()

    isMediaLoading.value = true
    jobStatus.value = 'idle'

    try {
      await coordinator.extractClip(
        {
          jobId: jobId.value,
          startTime: Math.max(0, Math.floor(hook.start - startSafetyBuffer.value)),
          endTime: Math.ceil(hook.end),
          theme: hook.theme,
          whisperModel: whisperModel.value
        },
        createJobCallbacks()
      )
    } catch (e: any) {
      jobError.value = e instanceof Error ? e.message : 'Failed to start extraction'
    }
  }

  async function loadReadyClipIntoEditor(folder: string, id: string) {
    jobStatus.value = 'queued'
    jobError.value = null
    hdReady.value = true

    let start_time = 0
    let end_time = 0
    let theme = 'Ready Clip'
    const parts = id.split('_')
    if (parts.length >= 2) {
      start_time = parseFloat(parts[0] || '0') || 0
      end_time = parseFloat(parts[1] || '0') || 0
      if (parts.length >= 3) {
        theme = parts.slice(2).join(' ').replace(/_/g, ' ')
      }
    }

    isPlaying.value = false
    currentTime.value = 0
    const thumbSec = parseInt(parts[0] || '0')
    const calculatedThumb = !isNaN(thumbSec) && folder ? `/assets/sources/${folder}/thumb_${thumbSec}.jpg` : undefined
    activeHook.value = {
      theme: theme,
      start: start_time,
      end: end_time,
      duration: end_time - start_time,
      thumbnail_url: calculatedThumb
    }
    clipId.value = id
    folderName.value = folder
    videoUrl.value = null
    outputUrl.value = null
    renderStatus.value = 'idle'
    fullTranscript.value = []

    // Lock saving immediately during state initialization and fetch
    timeline.isSavingLocked.value = true

    if (timeline.timelineTracks.value[0]) {
      timeline.timelineTracks.value[0].items = []
    }
    isMediaLoading.value = true
    resetThumbnailState(true)

    try {
      const bundle = await coordinator.loadReadyClip(folder, id, whisperModel.value)
      jobId.value = coordinator.getActiveJobId()
      jobStatus.value = 'ready'

      applyHydratedClipBundle(bundle)
      startPolling()
    } catch (e: any) {
      jobStatus.value = 'error'
      jobError.value = e instanceof Error ? e.message : 'Failed to load clip'
    } finally {
      setTimeout(() => {
        timeline.isSavingLocked.value = false
      }, 500)
    }
  }

  // Cleanup polling on composable unmount
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      stopPolling()
    })
  }

  return {
    jobId,
    isMediaLoading,
    jobStatus,
    jobError,
    isNavigatingToEditor,
    analyzeUrl,
    analyzeCached,
    startPolling,
    stopPolling,
    extractClip,
    loadReadyClipIntoEditor,
    startSafetyBuffer,
    isCachedAnalysis,
    downloadPercent,
    hdReady
  }
}
