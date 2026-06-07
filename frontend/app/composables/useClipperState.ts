// Composable for managing the entire clipper state
import { useSystemDiagnostics } from './useSystemDiagnostics'
import { useSafetyAuditor, DEFAULT_BLACKLIST } from './useSafetyAuditor'
import { useTimelineState } from './useTimelineState'
import { useClipperJob } from './useClipperJob'
import { useClipperThumbnail } from './useClipperThumbnail'
import { useClipperExport } from './useClipperExport'

import fontsManifest from '../../../shared/fonts_manifest.json'

export const FONT_OPTIONS = fontsManifest.fonts.map((f: any) => f.name)

export const useClipperState = () => {
  // API Base
  const API_BASE = 'http://localhost:8000'

  // Instantiate Sub-composables for separated concerns
  const diagnostics = useSystemDiagnostics()
  const auditor = useSafetyAuditor()
  const timeline = useTimelineState()
  const job = useClipperJob()
  const thumbnailState = useClipperThumbnail()

  // Job state delegated from useClipperJob sub-composable
  const { jobId, isMediaLoading, jobStatus, jobError, isNavigatingToEditor, startSafetyBuffer } = job

  // Thumbnail state delegated from useClipperThumbnail sub-composable
  const {
    thumbnailEnabled, thumbnailUrl, thumbnailDuration, thumbnailScreenshotTime,
    thumbnailTextOverlays, thumbnailEditMode, thumbnailXOffset, isDeletingThumbnail, isCapturingThumbnail,
    defaultThumbnailStyle,
    resetThumbnailState, captureScreenshot, addThumbnailText, removeThumbnailText,
    saveThumbnailConfig, loadThumbnailConfig, toggleThumbnail, deleteThumbnail,
    loadDefaultThumbnailStyle, saveDefaultThumbnailStyle, applyDefaultThumbnailStyle
  } = thumbnailState

  // Export state delegated from useClipperExport sub-composable
  const exportState = useClipperExport({
    saveTranscript,
    saveStyleSettings,
    saveTimelineTracks: () => timeline.saveTimelineTracks(),
    saveThumbnailConfig
  })
  const { renderStatus, renderProgress, renderStage, renderEta, outputUrl, renderClip } = exportState


  // Video info
  const videoTitle = useState<string>('videoTitle', () => '')
  const videoDuration = useState<number>('videoDuration', () => 0)
  const hasHeatmap = useState<boolean>('hasHeatmap', () => false)
  const videoUrl = useState<string | null>('videoUrl', () => null)
  const videoFps = useState<number>('videoFps', () => 30)

  // Hooks
  const hooks = useState<any[]>('hooks', () => [])
  const savedHooks = useState<any[]>('savedHooks', () => [])
  const activeHook = useState<any | null>('activeHook', () => null)
  
  // Toast state
  const toast = useState<{message: string, type: 'success' | 'error' | 'info'} | null>('clipperToast', () => null)
  let toastTimeout: any = null

  // Centralized reactive timeout mediator for decoupled shared reactivity
  watch(toast, (newVal) => {
    if (newVal) {
      if (toastTimeout) clearTimeout(toastTimeout)
      toastTimeout = setTimeout(() => {
        toast.value = null
      }, 3000)
    }
  })

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    toast.value = { message, type }
  }
  const segmentPadding = 2 // Match backend YouTubeParser safe_start buffer

  const folderName = useState<string | null>('folderName', () => null)
  const clipId = useState<string | null>('clipId', () => null)
  const fullTranscript = useState<any[]>('fullTranscript', () => [])

  // Prompts
  const promptsList = useState<{id: string, name: string, suitableFor: string[], prompt?: string, numHooks?: number, autoHooks?: boolean}[]>('promptsList', () => [])
  const selectedPrompt = useState<string>('selectedPrompt', () => 'prompt.json')

  // Settings
  const youtubeUrl = useState<string>('youtubeUrl', () => '')
  const language = useState<string>('language', () => 'id')
  const subtitlePosition = useState<string>('subtitlePosition', () => 'center')
  const subtitleOffset = useState<number>('subtitleOffset', () => 50)
  const subtitleSyncOffset = useState<number>('subtitleSyncOffset', () => -500) // Default -500ms offset
  const font = useState<string>('font', () => 'Montserrat')
  const fontSize = useState<number>('fontSize', () => 100)
  const faceTracking = useState<boolean>('faceTracking', () => false)
  const cropMode = useState<string>('cropMode', () => 'manual') // 'manual' | 'face_tracking'
  const cropPercentX = useState<number>('cropPercentX', () => 50) // 0=left, 50=center, 100=right
  const subtitleMode = useState<'word' | '3_words' | '4_words'>('subtitleMode', () => 'word')
  const whisperModel = useState<string>('whisperModel', () => 'base')
  const useNativePlayer = useState<boolean>('useNativePlayer', () => false)
  const showIframeDebug = useState<boolean>('showIframeDebug', () => false)
  const volume = useState<number>('volume', () => 0.5)

  // Subtitle style
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
  const subtitlePreset = useState<string>('subtitlePreset', () => 'bold-podcast')



  // Playback state (Shared Clock)
  const isPlaying = useState<boolean>('isPlaying', () => false)
  const currentTime = useState<number>('currentTime', () => 0)


  
  // Cache / Library
  const cachedVideos = useState<any[]>('cachedVideos', () => [])
  const isCachedLoading = useState<boolean>('isCachedLoading', () => false)
  const lastAccessedVideoId = useState<string | null>('lastAccessedVideoId', () => null)
  const lastAccessedClip = useState<{folder: string, clip_id: string, title?: string} | null>('lastAccessedClip', () => null)


  let isPersistenceInitialized = false



  const lastAccessedVideo = computed(() => {
    const clip = lastAccessedClip.value
    // Prioritize parent video of the last accessed clip
    if (clip && clip.folder) {
      const vid = cachedVideos.value.find(v => v.folder_name === clip.folder)
      if (vid) return vid
    }
    // Fallback to last accessed video ID
    if (!lastAccessedVideoId.value) return null
    return cachedVideos.value.find(v => v.video_id === lastAccessedVideoId.value) || null
  })

  async function fetchCached() {
    if (cachedVideos.value.length === 0) {
      isCachedLoading.value = true
    }
    try {
      const res = await $fetch<{ videos: any[] }>(`${API_BASE}/api/cached`)
      cachedVideos.value = res.videos || []
    } catch { 
      if (cachedVideos.value.length === 0) cachedVideos.value = [] 
    } finally {
      isCachedLoading.value = false
    }
  }

  function setLastAccessed(vidId: string) {
    lastAccessedVideoId.value = vidId
    if (import.meta.client) localStorage.setItem('yonru_last_video', vidId)
  }

  function setLastClip(folder: string, clipId: string, title?: string) {
    lastAccessedClip.value = { folder, clip_id: clipId, title: title || 'Current Clip' }
    if (import.meta.client) localStorage.setItem('yonru_last_clip', JSON.stringify({ folder, clip_id: clipId, title: title || 'Current Clip' }))
  }

  // --- Actions ---
  const { analyzeUrl, startPolling, stopPolling, extractClip, loadReadyClipIntoEditor } = job



  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function fetchPrompts() {
    try {
      const res = await $fetch<{ prompts: {id: string, name: string, suitableFor: string[], prompt?: string}[] }>(`${API_BASE}/api/prompts`)
      promptsList.value = res.prompts || []
      if (promptsList.value.length > 0 && !promptsList.value.find(p => p.id === selectedPrompt.value)) {
        const firstPrompt = promptsList.value[0]
        if (firstPrompt) {
          selectedPrompt.value = firstPrompt.id
        }
      }
    } catch (e) {
      console.error('Failed to fetch prompts', e)
    }
  }

  async function editPrompt(id: string, name: string, suitableFor: string[], prompt: string, numHooks: number = 10, autoHooks: boolean = false) {
    try {
      await $fetch(`${API_BASE}/api/prompts/edit`, {
        method: 'PUT',
        body: { id, promptName: name, suitableFor, prompt, numHooks, autoHooks }
      })
      await fetchPrompts()
      showToast('Prompt updated successfully', 'success')
      return true
    } catch (e) {
      showToast('Failed to update prompt', 'error')
      return false
    }
  }

  async function fetchSavedHooks() {
    if (!folderName.value) return
    try {
      const res = await $fetch<{ saved_hooks: any[] }>(`${API_BASE}/api/cached/${folderName.value}/saved_hooks`)
      savedHooks.value = res.saved_hooks || []
    } catch {
      savedHooks.value = []
    }
  }

  async function saveHook(hook: any) {
    if (!folderName.value) return
    try {
      const res = await $fetch<{ saved_hooks: any[] }>(`${API_BASE}/api/cached/saved_hooks`, {
        method: 'POST',
        body: { folder_name: folderName.value, hook }
      })
      savedHooks.value = res.saved_hooks || []
      return true
    } catch { return false }
  }

  async function deleteSavedHook(hookId: string) {
    if (!folderName.value) return
    try {
      const res = await $fetch<{ saved_hooks: any[] }>(`${API_BASE}/api/cached/${folderName.value}/saved_hooks/${hookId}`, {
        method: 'DELETE'
      })
      savedHooks.value = res.saved_hooks || []
    } catch {}
  }

  async function updateHooks() {
    if (!folderName.value || !hooks.value) return
    try {
      await $fetch(`${API_BASE}/api/hooks`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          hooks: hooks.value
        }
      })
      showToast('Hook names updated', 'success')
    } catch (e: any) {
      showToast('Failed to update hook names', 'error')
    }
  }

  async function saveTranscript(isSilent = false) {
    if (!folderName.value || !fullTranscript.value) return
    const silent = isSilent === true

    // Sanitize transcript data to strip out non-serializable circular references (such as flatWords)
    const cleanTranscript = fullTranscript.value.map((seg: any) => ({
      start: typeof seg.start === 'string' ? parseFloat(seg.start) : seg.start,
      duration: typeof seg.duration === 'string' ? parseFloat(seg.duration) : seg.duration,
      text: seg.text
    }))

    try {
      await $fetch(`${API_BASE}/api/transcript`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          transcript: cleanTranscript
        }
      })
      if (!silent) {
        showToast('Edits saved successfully!', 'success')
      }
    } catch (e) {
      if (!silent) {
        showToast('Failed to save edits', 'error')
      }
    }
  }

  // --- Timeline Actions ---

  async function saveStyleSettings() {
    if (!folderName.value || !clipId.value) return
    const settings = {
      subtitlePreset: subtitlePreset.value,
      subtitlePosition: subtitlePosition.value,
      subtitleOffset: subtitleOffset.value,
      subtitleSyncOffset: subtitleSyncOffset.value,
      font: font.value,
      fontSize: fontSize.value,
      cropPercentX: cropPercentX.value,
      subtitleMode: subtitleMode.value,
      subtitleAnimation: subtitleAnimation.value,
      subtitleHighlightMode: subtitleHighlightMode.value,
      subtitleHighlightColor: subtitleHighlightColor.value,
      subtitleTextColor: subtitleTextColor.value,
      subtitleStrokeColor: subtitleStrokeColor.value,
      subtitleStrokeWidth: subtitleStrokeWidth.value,
      subtitleFontWeight: subtitleFontWeight.value,
      subtitleTextTransform: subtitleTextTransform.value,
      subtitleBackground: subtitleBackground.value,
      subtitleBackgroundOpacity: subtitleBackgroundOpacity.value,
      subtitleWordSpacing: subtitleWordSpacing.value,
      volume: volume.value
    }
    try {
      await $fetch(`${API_BASE}/api/style-settings`, {
        method: 'PUT',
        body: { folder_name: folderName.value, clip_id: clipId.value, settings }
      })
    } catch (e) {}
  }

  async function saveDefaultStyleSettings() {
    const settings = {
      subtitlePreset: subtitlePreset.value,
      subtitlePosition: subtitlePosition.value,
      subtitleOffset: subtitleOffset.value,
      subtitleSyncOffset: subtitleSyncOffset.value,
      font: font.value,
      fontSize: fontSize.value,
      cropPercentX: cropPercentX.value,
      subtitleMode: subtitleMode.value,
      subtitleAnimation: subtitleAnimation.value,
      subtitleHighlightMode: subtitleHighlightMode.value,
      subtitleHighlightColor: subtitleHighlightColor.value,
      subtitleTextColor: subtitleTextColor.value,
      subtitleStrokeColor: subtitleStrokeColor.value,
      subtitleStrokeWidth: subtitleStrokeWidth.value,
      subtitleFontWeight: subtitleFontWeight.value,
      subtitleTextTransform: subtitleTextTransform.value,
      subtitleBackground: subtitleBackground.value,
      subtitleBackgroundOpacity: subtitleBackgroundOpacity.value,
      subtitleWordSpacing: subtitleWordSpacing.value,
      volume: volume.value
    }
    try {
      await $fetch(`${API_BASE}/api/default-style-settings`, {
        method: 'PUT',
        body: { settings }
      })
    } catch (e) {}
  }

  function initPersistence() {
    if (import.meta.server || isPersistenceInitialized) return
    isPersistenceInitialized = true
    
    auditor.loadBlacklistFromStorage()

    const p = localStorage.getItem('yonru_prompt')
    if (p) selectedPrompt.value = p
    
    const m = localStorage.getItem('yonru_model')
    if (m) whisperModel.value = m

    const lv = localStorage.getItem('yonru_last_video')
    if (lv) lastAccessedVideoId.value = lv

    const lc = localStorage.getItem('yonru_last_clip')
    if (lc) {
      try { lastAccessedClip.value = JSON.parse(lc) } catch {}
    }

    const savedStyle = localStorage.getItem('defaultTimelineTextStyle')
    if (savedStyle) {
      try { timeline.defaultTimelineTextStyle.value = JSON.parse(savedStyle) } catch {}
    }

    loadDefaultThumbnailStyle()

    watch(selectedPrompt, (val) => localStorage.setItem('yonru_prompt', val))
    watch(whisperModel, (val) => localStorage.setItem('yonru_model', val))

    watch(timeline.timelineTracks, () => {
      timeline.saveTimelineTracks()
    }, { deep: true })

    // Debounced persistence for history stacks
    let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null
    watch(
      [() => timeline.timelineUndoStack.value.length, () => timeline.timelineRedoStack.value.length],
      () => {
        if (timeline.isHydratingHistory.value) return
        if (timeline.timelineUndoStack.value.length === 0 && timeline.timelineRedoStack.value.length === 0) return

        timeline.hasUnsavedHistory.value = true
        if (historyDebounceTimer) clearTimeout(historyDebounceTimer)
        historyDebounceTimer = setTimeout(() => {
          timeline.saveHistoryToBackend()
        }, 1500)
      }
    )

    // Beforeunload guard — warn on refresh while saving or with unsaved history
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (timeline.hasUnsavedHistory.value || timeline.isSavingHistory.value) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)



    watch(
      [font, fontSize, subtitleFontWeight, subtitleTextTransform, subtitleTextColor,
       subtitleStrokeColor, subtitleStrokeWidth, subtitleBackground, subtitleBackgroundOpacity, subtitleWordSpacing],
      () => {
        const textTrack = timeline.timelineTracks.value.find((t: any) => t.id === 'text')
        if (!textTrack) return
        textTrack.items.forEach((item: any) => {
          if (item.linkToGlobal !== false) {
            timeline.syncGlobalStylesToItem(item)
          }
        })
      }
    )
  }

  function resetWorkspace() {
    folderName.value = null
    clipId.value = null
    jobId.value = null
    jobStatus.value = 'idle'
    hooks.value = []
    savedHooks.value = []
    activeHook.value = null
    fullTranscript.value = []
    if (timeline.timelineTracks.value && timeline.timelineTracks.value[0]) {
      timeline.timelineTracks.value[0].items = []
    }
    videoUrl.value = null
    outputUrl.value = null
    renderStatus.value = 'idle'
    isMediaLoading.value = false
    resetThumbnailState()
  }



  function maskFlaggedWords() {
    auditor.maskFlaggedWords()
  }

  return {
    contentAudit: auditor.contentAudit, 
    customBlacklist: auditor.customBlacklist, 
    safeZoneVisible: auditor.safeZoneVisible, 
    saveBlacklistToStorage: auditor.saveBlacklistToStorage, 
    DEFAULT_BLACKLIST,
    thumbnailEnabled, 
    thumbnailUrl, 
    thumbnailDuration, 
    thumbnailScreenshotTime,
    thumbnailTextOverlays, 
    thumbnailEditMode,
    thumbnailXOffset,
    isCapturingThumbnail,
    defaultThumbnailStyle,
    // Other State
    jobId, isMediaLoading, jobStatus, jobError,
    isNavigatingToEditor,
    startSafetyBuffer,
    videoTitle, videoDuration, hasHeatmap, videoUrl, videoFps,
    hooks, savedHooks, activeHook, segmentPadding, folderName, clipId, fullTranscript,
    promptsList, selectedPrompt,
    youtubeUrl, language, subtitlePosition, subtitleOffset, subtitleSyncOffset,
    font, fontSize, faceTracking, cropMode, cropPercentX, subtitleMode, whisperModel, useNativePlayer, showIframeDebug,
    subtitleAnimation, subtitleHighlightMode, subtitleHighlightColor, subtitleTextColor,
    subtitleStrokeColor, subtitleStrokeWidth, subtitleFontWeight, subtitleTextTransform,
    subtitleBackground, subtitleBackgroundOpacity, subtitleWordSpacing, subtitlePreset, volume,
    isPlaying, currentTime, videoTime: timeline.videoTime,
    isTimelineShifting: timeline.isTimelineShifting,
    renderStatus, renderProgress, renderStage, renderEta, outputUrl,
    cachedVideos, isCachedLoading, lastAccessedVideoId, lastAccessedVideo, lastAccessedClip,
    timelineTracks: timeline.timelineTracks, timelineDuration: timeline.timelineDuration, selectedTimelineItem: timeline.selectedTimelineItem,
    defaultTimelineTextStyle: timeline.defaultTimelineTextStyle,
    deepAuditResults: auditor.deepAuditResults, isDeepAuditing: auditor.isDeepAuditing,
    systemHealth: diagnostics.systemHealth, checkingHealth: diagnostics.checkingHealth, isAnyPrerequisiteMissing: diagnostics.isAnyPrerequisiteMissing, settingsScrollTarget: diagnostics.settingsScrollTarget,
    // Actions
    analyzeUrl, extractClip, loadReadyClipIntoEditor, renderClip, startPolling, stopPolling,
    checkSystemHealth: diagnostics.checkSystemHealth,
    formatDuration, fetchPrompts, editPrompt, fetchSavedHooks, saveHook, deleteSavedHook,
    saveTranscript, saveStyleSettings, saveDefaultStyleSettings, updateHooks,
    runDeepAudit: auditor.runDeepAudit, maskFlaggedWords,
    fetchCached, setLastAccessed, setLastClip,
    saveTimelineTracks: timeline.saveTimelineTracks,
    addTimelineItem: timeline.addTimelineItem, deleteTimelineItem: timeline.deleteTimelineItem, updateTimelineItem: timeline.updateTimelineItem, saveTimelineTextStyleAsDefault: timeline.saveTimelineTextStyleAsDefault, syncGlobalStylesToItem: timeline.syncGlobalStylesToItem,
    canUndo: timeline.canUndo,
    canRedo: timeline.canRedo,
    commitToHistory: timeline.commitToHistory,
    isSavingHistory: timeline.isSavingHistory,
    hasUnsavedHistory: timeline.hasUnsavedHistory,
    undo: () => {
      timeline.undo()
      saveTranscript(true)
    },
    redo: () => {
      timeline.redo()
      saveTranscript(true)
    },
    captureScreenshot, addThumbnailText, removeThumbnailText, saveThumbnailConfig, loadThumbnailConfig, deleteThumbnail,
    toggleThumbnail,
    resetWorkspace,
    toast, showToast, initPersistence,
    loadDefaultThumbnailStyle, saveDefaultThumbnailStyle, applyDefaultThumbnailStyle
  }
}
