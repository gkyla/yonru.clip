// useClipperJob.ts - Extracted video ingestion and polling lifecycle
import { useTimelineState } from './useTimelineState'

export const useClipperJob = () => {
  const API_BASE = 'http://localhost:8000'
  const timeline = useTimelineState()

  // Ingestion global states (shared via useState keys)
  const jobId = useState<string | null>('jobId', () => null)
  const isMediaLoading = useState<boolean>('isMediaLoading', () => false)
  const jobStatus = useState<string>('jobStatus', () => 'idle')
  const jobError = useState<string | null>('jobError', () => null)
  const isNavigatingToEditor = useState<boolean>('isNavigatingToEditor', () => false)

  // Shared state references needed by polling and actions
  const videoTitle = useState<string>('videoTitle', () => '')
  const videoDuration = useState<number>('videoDuration', () => 0)
  const hasHeatmap = useState<boolean>('hasHeatmap', () => false)
  const videoUrl = useState<string | null>('videoUrl', () => null)
  const videoFps = useState<number>('videoFps', () => 30)
  const hooks = useState<any[]>('hooks', () => [])
  const savedHooks = useState<any[]>('savedHooks', () => [])
  const activeHook = useState<any | null>('activeHook', () => null)
  const folderName = useState<string | null>('folderName', () => null)
  const clipId = useState<string | null>('clipId', () => null)
  const fullTranscript = useState<any[]>('fullTranscript', () => [])
  const isPlaying = useState<boolean>('isPlaying', () => false)
  const currentTime = useState<number>('currentTime', () => 0)
  
  // Settings/prompts
  const promptsList = useState<{id: string, name: string, suitableFor: string[], prompt?: string, numHooks?: number, autoHooks?: boolean}[]>('promptsList', () => [])
  const selectedPrompt = useState<string>('selectedPrompt', () => 'prompt.json')
  const youtubeUrl = useState<string>('youtubeUrl', () => '')
  const language = useState<string>('language', () => 'id')
  const whisperModel = useState<string>('whisperModel', () => 'base')

  // Subtitle positions / styling
  const subtitlePosition = useState<string>('subtitlePosition', () => 'center')
  const subtitleOffset = useState<number>('subtitleOffset', () => 50)
  const subtitleSyncOffset = useState<number>('subtitleSyncOffset', () => -500)
  const font = useState<string>('font', () => 'Montserrat')
  const fontSize = useState<number>('fontSize', () => 100)
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

  // Thumbnail state
  const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
  const thumbnailUrl = useState<string | null>('thumbnailUrl', () => null)
  const thumbnailDuration = useState<number>('thumbnailDuration', () => 1.0)
  const thumbnailScreenshotTime = useState<number>('thumbnailScreenshotTime', () => 0)
  const thumbnailTextOverlays = useState<any[]>('thumbnailTextOverlays', () => [])
  const thumbnailEditMode = useState<boolean>('thumbnailEditMode', () => false)
  const thumbnailXOffset = useState<number>('thumbnailXOffset', () => 50)
  const outputUrl = useState<string | null>('outputUrl', () => null)
  const renderStatus = useState<string>('renderStatus', () => 'idle')

  // Polling state
  let pollInterval: ReturnType<typeof setInterval> | null = null

  // Helpers
  async function fetchSavedHooks() {
    if (!folderName.value) return
    try {
      const res = await $fetch<{ saved_hooks: any[] }>(`${API_BASE}/api/cached/${folderName.value}/saved_hooks`)
      savedHooks.value = res.saved_hooks || []
    } catch {
      savedHooks.value = []
    }
  }

  function resetThumbnailState() {
    timeline.isSavingLocked.value = true
    thumbnailEnabled.value = false
    thumbnailUrl.value = null
    thumbnailDuration.value = 1.0
    thumbnailScreenshotTime.value = 0
    thumbnailXOffset.value = 50
    thumbnailTextOverlays.value = []
    thumbnailEditMode.value = false
    nextTick(() => {
      timeline.isSavingLocked.value = false
    })
  }

  async function loadThumbnailConfig() {
    if (!folderName.value || !clipId.value) return
    try {
      const res = await $fetch<{ config: any }>(`${API_BASE}/api/thumbnail/config/${folderName.value}/${clipId.value}`)
      if (res.config) {
        timeline.isSavingLocked.value = true
        thumbnailEnabled.value = res.config.enabled ?? false
        thumbnailDuration.value = res.config.duration ?? 1.0
        thumbnailScreenshotTime.value = res.config.screenshotTime ?? 0
        thumbnailXOffset.value = res.config.xOffset ?? 50
        thumbnailTextOverlays.value = (res.config.textOverlays ?? []).map((o: any) => ({
          x: 540,
          y: 960,
          fontSize: 100,
          fontFamily: 'Montserrat',
          fontWeight: 900,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 5,
          showStroke: true,
          textTransform: 'uppercase',
          rotation: 0,
          showBackground: false,
          backgroundColor: '#000000',
          backgroundOpacity: 0.7,
          backgroundPadding: 20,
          ...o
        }))
        
        const baseClipUrl = `${API_BASE}/assets/clips/${folderName.value}/${clipId.value}`
        try {
          const thumbUrl = `${baseClipUrl}/thumbnail.jpg?t=${Date.now()}`
          thumbnailUrl.value = thumbUrl
        } catch { }
      }
    } catch (e) {}
  }

  async function analyzeUrl(force = false) {
    if (!youtubeUrl.value) return

    jobStatus.value = 'queued'
    jobError.value = null
    hooks.value = []
    videoUrl.value = null
    outputUrl.value = null
    activeHook.value = null

    try {
      const currentPrompt = promptsList.value.find(p => p.id === selectedPrompt.value)
      const res = await $fetch<{ job_id: string; status: string }>(`${API_BASE}/api/analyze-url?force=${force}`, {
        method: 'POST',
        body: { 
          url: youtubeUrl.value, 
          language: language.value, 
          prompt_file: selectedPrompt.value,
          num_hooks: currentPrompt?.numHooks ?? 10,
          auto_hooks: currentPrompt?.autoHooks ?? false
        }
      })

      jobId.value = res.job_id
      jobStatus.value = res.status
      startPolling()
    } catch (e: any) {
      jobStatus.value = 'error'
      jobError.value = e.message || 'Failed to start analysis'
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval)
    pollInterval = setInterval(async () => {
      if (!jobId.value) return
      try {
        const res = await $fetch<any>(`${API_BASE}/api/job/${jobId.value}`).catch(e => {
          if (e.status === 404) {
            jobStatus.value = 'error'
            jobError.value = 'Job session expired. Please re-analyze the video.'
            stopPolling()
          }
          return null
        })
        if (!res) return

        jobStatus.value = res.status

        if (res.video) {
          if (res.video.title) videoTitle.value = res.video.title
          if (res.video.duration) videoDuration.value = res.video.duration
          if (res.video.fps) videoFps.value = res.video.fps
          hasHeatmap.value = res.video.has_heatmap || false
          
          const targetUrl = res.video.asset_url ? `${API_BASE}${res.video.asset_url}` : null
          if (!activeHook.value && targetUrl && videoUrl.value !== targetUrl) {
            videoUrl.value = targetUrl
          }
        }

        const respFolder = res.folder_name || (res.video ? res.video.folder_name : null)
        if (respFolder) {
          if (folderName.value !== respFolder || savedHooks.value.length === 0) {
            folderName.value = respFolder
            fetchSavedHooks()
          }
        }

        if (res.clip && res.clip.asset_url) {
          if (res.fps) videoFps.value = res.fps
          const targetUrl = `${API_BASE}${res.clip.asset_url}`
          if (videoUrl.value !== targetUrl || fullTranscript.value.length === 0) {
            videoUrl.value = targetUrl
            if (res.clip.duration) {
              videoDuration.value = res.clip.duration
            }
            
            if (res.clip.transcript && fullTranscript.value.length === 0) {
              fullTranscript.value = res.clip.transcript
            }
            
            if (!activeHook.value) {
              activeHook.value = {
                theme: res.clip.theme || 'Extracted Clip',
                start: res.clip.start || 0,
                end: res.clip.end || res.clip.duration || 0,
                duration: res.clip.duration || 0,
                transcript_quote: res.clip.transcript_quote || ''
              }
            } else if (res.clip.transcript_quote && !activeHook.value.transcript_quote) {
              activeHook.value.transcript_quote = res.clip.transcript_quote
            }

            if (res.hooks && res.hooks.length > 0) {
              const currentHasQuotes = hooks.value.some(h => h.transcript_quote && h.transcript_quote !== 'No transcript preview available.')
              const newHasQuotes = res.hooks.some((h: any) => h.transcript_quote && h.transcript_quote !== 'No transcript preview available.')
              
              if (hooks.value.length === 0 || hooks.value.length !== res.hooks.length || (!currentHasQuotes && newHasQuotes)) {
                console.log('[polling] Syncing hooks list, count:', res.hooks.length)
                hooks.value = res.hooks
              }
            }
            
            if (res.clip && activeHook.value) {
              if (res.clip.transcript_quote && (!activeHook.value.transcript_quote || activeHook.value.transcript_quote === 'No transcript preview available.')) {
                console.log('[polling] Syncing active hook quote')
                activeHook.value.transcript_quote = res.clip.transcript_quote
              }
            }
            
            const parts = res.clip.asset_url.split('/')
            const newClipId = parts.length >= 5 ? parts[4] : null
            
            if (videoUrl.value !== targetUrl || fullTranscript.value.length === 0 || (newClipId && clipId.value !== newClipId)) {
              if (newClipId) clipId.value = newClipId
              timeline.isSavingLocked.value = true
              try {
                const baseClipUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'))
                const transcriptUrl = baseClipUrl + '/transcript.json?t=' + Date.now()
                const styleUrl = baseClipUrl + '/style_settings.json?t=' + Date.now()

                try {
                  const clipTranscript = await $fetch<any[]>(transcriptUrl)
                  if (clipTranscript && clipTranscript.length > 0) {
                    fullTranscript.value = clipTranscript
                    console.log('[clipper] Loaded isolated clip transcript')
                  }
                } catch (te) {
                  console.warn('[clipper] Failed to load clip transcript:', te)
                }

                try {
                  const styles = await $fetch<any>(styleUrl)
                  if (styles) {
                    if (styles.subtitlePosition) subtitlePosition.value = styles.subtitlePosition
                    if (styles.subtitleOffset !== undefined) subtitleOffset.value = styles.subtitleOffset
                    if (styles.subtitleSyncOffset !== undefined) subtitleSyncOffset.value = styles.subtitleSyncOffset
                    if (styles.font) font.value = styles.font
                    if (styles.fontSize !== undefined) fontSize.value = styles.fontSize
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
                    console.log('[clipper] Loaded clip style settings')
                  }
                } catch (se) {
                  console.log('[clipper] No style settings yet for this clip')
                }

                let timelineLoaded = false
                try {
                  const timelineUrl = baseClipUrl + '/timeline.json?t=' + Date.now()
                  console.log('[clipper] Fetching timeline from:', timelineUrl)
                  const tracks = await $fetch<any[]>(timelineUrl)
                  if (tracks && tracks.length > 0) {
                    timeline.timelineTracks.value = tracks
                    timelineLoaded = true
                    console.log('[clipper] Loaded clip timeline into state')
                  }
                } catch (te) {}

                if (!timelineLoaded && (timeline.timelineTracks.value[0]?.items?.length === 0)) {
                  timeline.timelineTracks.value[0].items = [{
                    id: 'main-video',
                    name: 'Main Video',
                    start: 0,
                    mediaStart: 0,
                    duration: res.clip.duration || videoDuration.value
                  }]
                }

                loadThumbnailConfig()
              } catch (e) {
                console.warn('[clipper] No clip assets yet')
              } finally {
                setTimeout(() => {
                  timeline.isSavingLocked.value = false
                }, 500)
              }
            }
          }
        }

        if (res.hooks) {
          hooks.value = res.hooks
        }

        if (res.error) {
          jobError.value = res.error
        }

        if (['hooks_ready', 'ready', 'error'].includes(res.status)) {
          stopPolling()
        }
      } catch (e) {}
    }, 2000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  async function extractClip(hook: any) {
    if (!jobId.value) return
    
    isPlaying.value = false
    currentTime.value = 0
    activeHook.value = hook
    clipId.value = null
    videoUrl.value = null
    outputUrl.value = null
    renderStatus.value = 'idle'
    fullTranscript.value = []
    timeline.timelineTracks.value[0].items = []
    resetThumbnailState()
    
    isMediaLoading.value = true
    jobStatus.value = 'idle'
    
    try {
      const res = await $fetch<{ job_id: string; status: string }>(`${API_BASE}/api/extract-clip`, {
        method: 'POST',
        body: { 
            job_id: jobId.value, 
            start_time: Math.floor(hook.start),
            end_time: Math.ceil(hook.end),
            theme: hook.theme,
            whisper_model: whisperModel.value
        }
      })
      jobStatus.value = res.status
      startPolling()
    } catch (e: any) {
      jobError.value = e.message || 'Failed to start extraction'
    }
  }

  async function loadReadyClipIntoEditor(folder: string, id: string) {
    jobStatus.value = 'queued'
    jobError.value = null
    
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
    activeHook.value = {
      theme: theme,
      start: start_time,
      end: end_time,
      duration: end_time - start_time
    }
    clipId.value = id
    folderName.value = folder
    videoUrl.value = null
    outputUrl.value = null
    renderStatus.value = 'idle'
    fullTranscript.value = []
    timeline.timelineTracks.value[0].items = []
    isMediaLoading.value = true
    resetThumbnailState()

    try {
      const res = await $fetch<any>(`${API_BASE}/api/load-ready-clip`, {
        method: 'POST',
        body: { folder_name: folder, clip_id: id }
      })
      
      jobId.value = res.job_id
      jobStatus.value = res.status
      
      if (res.hooks) {
        hooks.value = res.hooks
      }

      if (res.clip && res.clip.asset_url) {
        if (res.fps) videoFps.value = res.fps
        videoUrl.value = `${API_BASE}${res.clip.asset_url}`
        if (res.clip.duration) {
          videoDuration.value = res.clip.duration
        }
        
        activeHook.value = {
          ...activeHook.value,
          ...res.clip
        }
      }
        
      if (timeline.timelineTracks.value[0]) {
        timeline.timelineTracks.value[0].items = [{
          id: 'main-video',
          name: 'Main Video',
          start: 0,
          mediaStart: 0,
          duration: res.clip.duration || videoDuration.value
        }]
      }

      if (!activeHook.value) {
        activeHook.value = {
          theme: res.clip.theme || 'Ready Clip',
          start: res.clip.start || 0,
          end: res.clip.end || res.clip.duration || 0,
          duration: res.clip.duration || 0
        }
      }

      // Synchronously trigger loading transcript & style settings to avoid 2s polling delay
      if (res.clip && res.clip.asset_url) {
        const targetUrl = `${API_BASE}${res.clip.asset_url}`
        const baseClipUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'))
        const transcriptUrl = baseClipUrl + '/transcript.json?t=' + Date.now()
        const styleUrl = baseClipUrl + '/style_settings.json?t=' + Date.now()

        // Load Transcript
        try {
          const clipTranscript = await $fetch<any[]>(transcriptUrl)
          if (clipTranscript && clipTranscript.length > 0) {
            fullTranscript.value = clipTranscript
          }
        } catch (te) {}

        // Load Style Settings
        try {
          const styles = await $fetch<any>(styleUrl)
          if (styles) {
            if (styles.subtitlePosition) subtitlePosition.value = styles.subtitlePosition
            if (styles.subtitleOffset !== undefined) subtitleOffset.value = styles.subtitleOffset
            if (styles.subtitleSyncOffset !== undefined) subtitleSyncOffset.value = styles.subtitleSyncOffset
            if (styles.font) font.value = styles.font
            if (styles.fontSize !== undefined) fontSize.value = styles.fontSize
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
          }
        } catch (se) {}

        // Load Timeline
        let timelineLoaded = false
        try {
          const timelineUrl = baseClipUrl + '/timeline.json?t=' + Date.now()
          const tracks = await $fetch<any[]>(timelineUrl)
          if (tracks && tracks.length > 0) {
            timeline.timelineTracks.value = tracks
            timelineLoaded = true
          }
        } catch (te) {}

        if (!timelineLoaded && (timeline.timelineTracks.value[0]?.items?.length === 0)) {
          timeline.timelineTracks.value[0].items = [{
            id: 'main-video',
            name: 'Main Video',
            start: 0,
            mediaStart: 0,
            duration: res.clip.duration || videoDuration.value
          }]
        }

        loadThumbnailConfig()
      }

      startPolling()
    } catch (e: any) {
      jobStatus.value = 'error'
      jobError.value = e.message || 'Failed to load clip'
    }
  }

  // Cleanup polling on composable unmount/deconstruction if desired
  onBeforeUnmount(() => {
    stopPolling()
  })

  return {
    jobId,
    isMediaLoading,
    jobStatus,
    jobError,
    isNavigatingToEditor,
    analyzeUrl,
    startPolling,
    stopPolling,
    extractClip,
    loadReadyClipIntoEditor
  }
}
