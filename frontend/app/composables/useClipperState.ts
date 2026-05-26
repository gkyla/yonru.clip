// Composable for managing the entire clipper state
import { useSystemDiagnostics } from './useSystemDiagnostics'
import { useSafetyAuditor, DEFAULT_BLACKLIST } from './useSafetyAuditor'
import { useTimelineState } from './useTimelineState'
import { useClipperJob } from './useClipperJob'
import { useClipperThumbnail } from './useClipperThumbnail'

export const FONT_OPTIONS = [
  'Montserrat', 'Inter', 'Bebas Neue', 'Oswald', 'Poppins', 
  'Outfit', 'Noto Sans', 'Roboto Condensed', 'Playfair Display',
  'Anton', 'Bangers', 'Permanent Marker', 'Russo One', 'Teko',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
]

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
  const { jobId, isMediaLoading, jobStatus, jobError, isNavigatingToEditor } = job

  // Thumbnail state delegated from useClipperThumbnail sub-composable
  const {
    thumbnailEnabled, thumbnailUrl, thumbnailDuration, thumbnailScreenshotTime,
    thumbnailTextOverlays, thumbnailEditMode, thumbnailXOffset, isDeletingThumbnail, isCapturingThumbnail,
    resetThumbnailState, captureScreenshot, addThumbnailText, removeThumbnailText,
    saveThumbnailConfig, loadThumbnailConfig, toggleThumbnail, deleteThumbnail
  } = thumbnailState

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

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    toast.value = { message, type }
    if (toastTimeout) clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      toast.value = null
    }, 3000)
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

  // Render state
  const renderStatus = useState<string>('renderStatus', () => 'idle')
  const renderProgress = useState<number>('renderProgress', () => 0)
  const renderStage = useState<string>('renderStage', () => '')
  const renderEta = useState<number>('renderEta', () => 0)
  const outputUrl = useState<string | null>('outputUrl', () => null)
  
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

  async function renderClip(hookIndex = 0, outputName?: string) {
    if (!jobId.value) return
    renderStatus.value = 'rendering'
    renderProgress.value = 0
    renderStage.value = 'starting'
    renderEta.value = 0
    outputUrl.value = null

    try {
      await saveTranscript()
      
      const body = {
        job_id: jobId.value,
        hook_index: hookIndex,
        subtitle_position: subtitlePosition.value,
        subtitle_offset: subtitleOffset.value,
        font: font.value,
        font_size: fontSize.value,
        face_tracking: cropMode.value === 'face_tracking',
        crop_percent_x: cropPercentX.value,
        subtitle_sync_offset: subtitleSyncOffset.value,
        subtitle_mode: subtitleMode.value,
        timeline_tracks: timeline.timelineTracks.value,
        subtitle_animation: subtitleAnimation.value,
        subtitle_highlight_mode: subtitleHighlightMode.value,
        subtitle_highlight_color: subtitleHighlightColor.value,
        subtitle_text_color: subtitleTextColor.value,
        subtitle_stroke_color: subtitleStrokeColor.value,
        subtitle_stroke_width: subtitleStrokeWidth.value,
        subtitle_font_weight: subtitleFontWeight.value,
        subtitle_text_transform: subtitleTextTransform.value,
        subtitle_background: subtitleBackground.value,
        subtitle_background_opacity: subtitleBackgroundOpacity.value,
        subtitle_word_spacing: subtitleWordSpacing.value,
        volume: volume.value,
        fps: videoFps.value,
        transcript: fullTranscript.value,
        thumbnail_enabled: thumbnailEnabled.value,
        thumbnail_duration: thumbnailDuration.value,
        thumbnail_text_overlays: thumbnailTextOverlays.value,
        thumbnail_x_offset: thumbnailXOffset.value,
        output_name: outputName
      }

      const response = await fetch(`${API_BASE}/api/render-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`Render failed: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.stage === 'bundling') {
                renderProgress.value = data.percent || 0
                renderStage.value = 'bundling'
                renderEta.value = 0
              } else if (data.stage === 'rendering') {
                renderProgress.value = data.percent || 0
                renderStage.value = 'rendering'
                renderEta.value = data.etaSeconds || 0
              } else if (data.stage === 'encoding') {
                renderStage.value = 'encoding'
                renderProgress.value = data.percent || 96
              } else if (data.stage === 'starting') {
                renderStage.value = 'starting'
                renderProgress.value = 0
              } else if (data.stage === 'done') {
                renderStatus.value = 'done'
                renderProgress.value = 100
                renderStage.value = ''
                renderEta.value = 0
                outputUrl.value = `${API_BASE}${data.outputUrl}`
                videoUrl.value = outputUrl.value
              } else if (data.stage === 'error') {
                renderStatus.value = 'error'
                jobError.value = data.message || 'Render failed'
                renderProgress.value = 0
                renderStage.value = ''
              }
            } catch {}
          }
        }
      }

      if (renderStatus.value === 'rendering') {
        renderStatus.value = 'error'
        jobError.value = 'Render stream ended unexpectedly'
      }
    } catch (e: any) {
      renderStatus.value = 'error'
      jobError.value = e.message || 'Render failed'
      renderProgress.value = 0
      renderStage.value = ''
    }
  }

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
    try {
      await $fetch(`${API_BASE}/api/transcript`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          transcript: fullTranscript.value
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

    watch(selectedPrompt, (val) => localStorage.setItem('yonru_prompt', val))
    watch(whisperModel, (val) => localStorage.setItem('yonru_model', val))

    watch(timeline.timelineTracks, () => {
      timeline.saveTimelineTracks()
    }, { deep: true })



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
    // Other State
    jobId, isMediaLoading, jobStatus, jobError,
    isNavigatingToEditor,
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
    captureScreenshot, addThumbnailText, removeThumbnailText, saveThumbnailConfig, loadThumbnailConfig, deleteThumbnail,
    toggleThumbnail,
    resetWorkspace,
    toast, showToast, initPersistence
  }
}
