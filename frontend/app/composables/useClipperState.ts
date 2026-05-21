// Composable for managing the entire clipper state
export const FONT_OPTIONS = [
  'Montserrat', 'Inter', 'Bebas Neue', 'Oswald', 'Poppins', 
  'Outfit', 'Noto Sans', 'Roboto Condensed', 'Playfair Display',
  'Anton', 'Bangers', 'Permanent Marker', 'Russo One', 'Teko',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
]

export const useClipperState = () => {
  // API Base
  const API_BASE = 'http://localhost:8000'

  // Job state
  const jobId = useState<string | null>('jobId', () => null)
  const isMediaLoading = useState<boolean>('isMediaLoading', () => false)
  const jobStatus = useState<string>('jobStatus', () => 'idle') // idle, queued, downloading, transcribing, ready, error
  const jobError = useState<string | null>('jobError', () => null)
  const isNavigatingToEditor = useState<boolean>('isNavigatingToEditor', () => false)

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
  const subtitleMode = useState<'word' | '3_words' | '4_words' | '10_chars' | '15_chars' | '20_chars'>('subtitleMode', () => 'word')
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

  // Thumbnail State
  const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
  const thumbnailUrl = useState<string | null>('thumbnailUrl', () => null)
  const thumbnailDuration = useState<number>('thumbnailDuration', () => 1.0)
  const thumbnailScreenshotTime = useState<number>('thumbnailScreenshotTime', () => 0)
  const thumbnailTextOverlays = useState<any[]>('thumbnailTextOverlays', () => [])
  const thumbnailEditMode = useState<boolean>('thumbnailEditMode', () => false)
  const thumbnailXOffset = useState<number>('thumbnailXOffset', () => 50)

  // Content Audit State
  const safeZoneVisible = useState<boolean>('safeZoneVisible', () => false)
  const customBlacklist = useState<string[]>('customBlacklist', () => [])
  
  const DEFAULT_BLACKLIST = [
    // Violence & Harm
    'kill', 'death', 'suicide', 'unalive', 'gun', 'blood', 'weapon', 'murder', 'shot',
    '/bunuh/', 'mati', 'tewas', '/darah/', '/senjata/', '/tembak/', 'perang', '/teroris/', '/bom/',
    // Sexual
    'sex', 'porn', 'seggs', 'hentai', 'nude', 'nudity', 'sexy',
    '/bokep/', '/telanjang/', '/seks/', '/mesum/', 's*ksi',
    // Sensitive
    'war', 'terror', 'bomb', 'crash', 'accident', 'crime',
    // Algospeak / Profanity
    'sh!t', 'f*ck', 'b!tch', 'damn', 'hell',
    '/anjing/', '/bangsat/', '/tolol/', '/goblok/', '/babi/', '/kontol/', '/memek/', '/itil/'
  ]

  // Persistence for blacklist
  const saveBlacklistToStorage = () => {
    if (import.meta.client) {
      localStorage.setItem('yonru_subtitle_blacklist', JSON.stringify(customBlacklist.value))
    }
  }

  const loadBlacklistFromStorage = () => {
    if (import.meta.client) {
      const saved = localStorage.getItem('yonru_subtitle_blacklist')
      if (saved) {
        try {
          customBlacklist.value = JSON.parse(saved)
        } catch (e) {
          customBlacklist.value = [...DEFAULT_BLACKLIST]
        }
      } else {
        customBlacklist.value = [...DEFAULT_BLACKLIST]
      }
    }
  }

  // Load on init
  if (import.meta.client) {
    loadBlacklistFromStorage()
  }

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

  const lastAccessedVideo = computed(() => {
    // Prioritize parent video of the last accessed clip
    if (lastAccessedClip.value?.folder) {
      const vid = cachedVideos.value.find(v => v.folder_name === lastAccessedClip.value.folder)
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

  // Timeline state
  const timelineTracks = useState<any[]>('timelineTracks', () => [
    { id: 'video', name: 'Main Video', type: 'video', items: [] },
    { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
    { id: 'text', name: 'Text layers', type: 'text', items: [] }
  ])
  const defaultTimelineTextStyle = useState<any | null>('defaultTimelineTextStyle', () => null)
  const timelineDuration = computed(() => {
    let max = 0
    let hasItems = false
    timelineTracks.value.forEach(track => {
      if (track.items.length > 0) hasItems = true
      track.items.forEach((item: any) => {
        max = Math.max(max, item.start + item.duration)
      })
    })
    
    const offset = (thumbnailEnabled.value ? thumbnailDuration.value : 0)
    
    if (hasItems) {
      return (max > 0 ? max : 1) + offset
    }
    return (videoDuration.value > 0 ? videoDuration.value : 60) + offset
  })

  const videoTime = computed(() => {
    const thumbSec = thumbnailEnabled.value ? thumbnailDuration.value : 0
    const t = Math.max(0, currentTime.value - thumbSec)
    const videoTrack = timelineTracks.value.find(tr => tr.id === 'video')
    if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0) return t
    
    const activeItem = videoTrack.items.find((i: any) => t >= i.start && t < i.start + i.duration)
    if (activeItem) {
      const mediaStart = activeItem.mediaStart !== undefined ? activeItem.mediaStart : activeItem.start
      return mediaStart + (t - activeItem.start)
    }
    return t
  })


  const deepAuditResults = useState<any | null>('deepAuditResults', () => null)
  const isDeepAuditing = ref(false)

  const contentAudit = computed(() => {
    const transcript = fullTranscript.value || []
    const combinedBlacklist = [...new Set([...DEFAULT_BLACKLIST, ...customBlacklist.value])]
    const mode = subtitleMode.value
    
    const flaggedWords: string[] = []
    const flaggedSegments: { start: number, duration: number, word: string, text: string }[] = []
    
    // 1. Flatten all segments in fullTranscript into individual words
    const flatWords: { text: string, start: number, duration: number, end: number }[] = []
    
    for (const seg of transcript) {
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

    if (flatWords.length > 0) {
      // 2. Group flatWords based on subtitleMode into chunks
      let chunks: { text: string, start: number, duration: number }[] = []

      if (mode === 'word' || mode === '1_word') {
        chunks = flatWords.map(w => ({ text: w.text, start: w.start, duration: w.duration }))
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
          chunks.push({ text, start, duration: end - start })
        }
      } else {
        // Character limit based (e.g. 10_chars, 15_chars, 20_chars)
        const limit = parseInt(mode) || 0
        if (limit <= 0) {
          chunks = flatWords.map(w => ({ text: w.text, start: w.start, duration: w.duration }))
        } else {
          let currentChunk: typeof flatWords = []
          let currentLen = 0
          
          for (const w of flatWords) {
            if (currentLen + w.text.length > limit && currentChunk.length > 0) {
              const start = currentChunk[0].start
              const end = currentChunk[currentChunk.length - 1].end
              const text = currentChunk.map(c => c.text).join(' ')
              chunks.push({ text, start, duration: end - start })
              
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
            chunks.push({ text, start, duration: end - start })
          }
        }
      }

      // Audit subtitle chunks
      chunks.forEach(chunk => {
        const lowerText = chunk.text.toLowerCase()
        combinedBlacklist.forEach(word => {
          if (!word) return
          let regex: RegExp
          if (word.startsWith('/') && word.endsWith('/')) {
            regex = new RegExp(word.slice(1, -1), 'i')
          } else {
            // Escape special chars for standard strings
            const escapedWord = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            regex = new RegExp(`\\b${escapedWord}\\b`, 'i')
          }
          if (regex.test(lowerText)) {
            flaggedSegments.push({ 
              start: chunk.start, 
              duration: chunk.duration, 
              word, 
              text: chunk.text 
            })
            if (!flaggedWords.includes(word)) flaggedWords.push(word)
          }
        })
      })
    }

    const duration = timelineDuration.value
    const isDurationOk = duration >= 5 && duration <= 60
    
    // Safety Score calculation
    let score = 100
    const uniqueTimeFlags = new Set(flaggedSegments.map(f => f.start.toFixed(2))).size
    score -= (uniqueTimeFlags * 12) 
    
    if (duration < 5 || duration > 90) score -= 30
    else if (duration > 60) score -= 10
    
    return {
      score: Math.max(0, score),
      flaggedWords,
      flaggedSegments,
      isDurationOk,
      uniqueFlagsCount: flaggedSegments.length,
      durationReason: duration < 5 ? 'Too short' : duration > 60 ? 'Long' : 'Optimal'
    }
  })
  const selectedTimelineItem = useState<any | null>('selectedTimelineItem', () => null)
  const isSavingLocked = ref(false)
  let isPersistenceInitialized = false

  // Polling interval ref
  let pollInterval: ReturnType<typeof setInterval> | null = null

  // --- Actions ---

  async function analyzeUrl(force = false) {
    if (!youtubeUrl.value) return

    jobStatus.value = 'queued'
    jobError.value = null
    hooks.value = []
    videoUrl.value = null
    outputUrl.value = null

    try {
      // Look up selected prompt settings
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
          
          // Force update URL if it changed or is missing (only if we aren't viewing a clip)
          const targetUrl = res.video.asset_url ? `${API_BASE}${res.video.asset_url}` : null
          if (!activeHook.value && targetUrl && videoUrl.value !== targetUrl) {
            videoUrl.value = targetUrl
          }
        }

        // Update folder name and fetch saved hooks
        const respFolder = res.folder_name || (res.video ? res.video.folder_name : null)
        if (respFolder) {
          if (folderName.value !== respFolder || savedHooks.value.length === 0) {
            folderName.value = respFolder
            fetchSavedHooks()
          }
        }

        // When a clip is cut, update videoUrl to the clip
        if (res.clip && res.clip.asset_url) {
          if (res.fps) videoFps.value = res.fps
          const targetUrl = `${API_BASE}${res.clip.asset_url}`
          if (videoUrl.value !== targetUrl || fullTranscript.value.length === 0) {
            videoUrl.value = targetUrl
            // Set video duration to clip duration
            if (res.clip.duration) {
              videoDuration.value = res.clip.duration
            }
            
            // If transcript is available and local is empty, populate it
            if (res.clip.transcript && fullTranscript.value.length === 0) {
              fullTranscript.value = res.clip.transcript
            }
            
            // Reconstruct activeHook if missing (triggers UI visibility)
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

            // Sync hooks list if provided (essential for Ready to Edit hydration)
            if (res.hooks && res.hooks.length > 0) {
              // Always update if current hooks is empty, or if length changed, or if content seems missing (e.g. no quotes)
              const currentHasQuotes = hooks.value.some(h => h.transcript_quote && h.transcript_quote !== 'No transcript preview available.')
              const newHasQuotes = res.hooks.some((h: any) => h.transcript_quote && h.transcript_quote !== 'No transcript preview available.')
              
              if (hooks.value.length === 0 || hooks.value.length !== res.hooks.length || (!currentHasQuotes && newHasQuotes)) {
                console.log('[polling] Syncing hooks list, count:', res.hooks.length)
                hooks.value = res.hooks
              }
            }
            
            // Sync active hook metadata (especially transcript_quote)
            if (res.clip && activeHook.value) {
              if (res.clip.transcript_quote && (!activeHook.value.transcript_quote || activeHook.value.transcript_quote === 'No transcript preview available.')) {
                console.log('[polling] Syncing active hook quote')
                activeHook.value.transcript_quote = res.clip.transcript_quote
              }
            }
            
            // Extract Clip ID for tracking
            const parts = res.clip.asset_url.split('/')
            const newClipId = parts.length >= 5 ? parts[4] : null
            
            // Load its specific assets if not already loaded for this clip
            if (videoUrl.value !== targetUrl || fullTranscript.value.length === 0 || (newClipId && clipId.value !== newClipId)) {
              if (newClipId) clipId.value = newClipId
              isSavingLocked.value = true
              try {
              const baseClipUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/'))
              const transcriptUrl = baseClipUrl + '/transcript.json?t=' + Date.now()
              const styleUrl = baseClipUrl + '/style_settings.json?t=' + Date.now()
              const timelineUrl = baseClipUrl + '/timeline.json?t=' + Date.now()

              // Load Transcript
              try {
                const clipTranscript = await $fetch<any[]>(transcriptUrl)
                if (clipTranscript && clipTranscript.length > 0) {
                  fullTranscript.value = clipTranscript
                  console.log('[clipper] Loaded isolated clip transcript')
                }
              } catch (te) {
                console.warn('[clipper] Failed to load clip transcript:', te)
              }

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
                  console.log('[clipper] Loaded clip style settings')
                }
              } catch (se) {
                console.log('[clipper] No style settings yet for this clip')
              }

              // Load Timeline
              let timelineLoaded = false
              try {
                const timelineUrl = baseClipUrl + '/timeline.json?t=' + Date.now()
                console.log('[clipper] Fetching timeline from:', timelineUrl)
                const tracks = await $fetch<any[]>(timelineUrl)
                if (tracks && tracks.length > 0) {
                  console.log('[clipper] Timeline JSON fetched, tracks count:', tracks.length)
                  timelineTracks.value = tracks
                  timelineLoaded = true
                  console.log('[clipper] Loaded clip timeline into state')
                } else {
                  console.log('[clipper] Timeline JSON was empty or invalid')
                }
              } catch (te) {
                console.log('[clipper] No timeline yet for this clip (or fetch failed)')
              }

              // If no timeline loaded, populate default video track
              if (!timelineLoaded && (timelineTracks.value[0]?.items?.length === 0)) {
                console.log('[clipper] Populating default video track')
                timelineTracks.value[0].items = [{
                  id: 'main-video',
                  name: 'Main Video',
                  start: 0,
                  mediaStart: 0,
                  duration: res.clip.duration || videoDuration.value
                }]
              }

              // Load Thumbnail Config
              loadThumbnailConfig()
            } catch (e) {
              console.warn('[clipper] No clip assets yet, will be loaded on polling finish')
            } finally {
              // Release lock after small delay to let any pending reactivity settle
              setTimeout(() => {
                isSavingLocked.value = false
                console.log('[clipper] Saving lock released')
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

      // Stop polling when hooks ready, clip ready, or error
      if (['hooks_ready', 'ready', 'error'].includes(res.status)) {
        stopPolling()
      }
    } catch (e) {
      // Keep polling on network blip
    }
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
    
    // Reset state for new hook
    isPlaying.value = false
    currentTime.value = 0
    activeHook.value = hook
    clipId.value = null
    videoUrl.value = null
    fullTranscript.value = []
    timelineTracks.value[0].items = []
    
    // Start with loading state (checks cache first)
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
    
    // Parse synthetic hook from ID (format: start_end_theme)
    let start_time = 0
    let end_time = 0
    let theme = 'Ready Clip'
    const parts = id.split('_')
    if (parts.length >= 2) {
      start_time = parseFloat(parts[0]) || 0
      end_time = parseFloat(parts[1]) || 0
      if (parts.length >= 3) {
        theme = parts.slice(2).join(' ').replace(/_/g, ' ')
      }
    }

    // Reset state for loading
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
    fullTranscript.value = []
    timelineTracks.value[0].items = []
    isMediaLoading.value = true

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
        
        // Update activeHook with full metadata from backend (including transcript_quote)
        activeHook.value = {
          ...activeHook.value,
          ...res.clip
        }
      }
        
        // Ensure timeline has the main video track populated
        if (timelineTracks.value[0]) {
          timelineTracks.value[0].items = [{
            id: 'main-video',
            name: 'Main Video',
            start: 0,
            mediaStart: 0,
            duration: res.clip.duration || videoDuration.value
          }]
          console.log('[clipper] Populated default video track for ready clip')
        }

        // Initialize activeHook if missing
        if (!activeHook.value) {
          activeHook.value = {
            theme: res.clip.theme || 'Ready Clip',
            start: res.clip.start || 0,
            end: res.clip.end || res.clip.duration || 0,
            duration: res.clip.duration || 0
          }
        }
      
        // Since it's marked 'ready' in backend, startPolling will trigger the asset load instantly (transcript, styles)
        startPolling()
      } catch (e: any) {
        jobStatus.value = 'error'
        jobError.value = e.message || 'Failed to load ready clip'
        isMediaLoading.value = false
      }
  }

  async function renderClip(hookIndex = 0, outputName?: string) {
    if (!jobId.value) return
    renderStatus.value = 'rendering'
    renderProgress.value = 0
    renderStage.value = 'starting'
    renderEta.value = 0
    outputUrl.value = null

    try {
      // Auto-save before render
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
        timeline_tracks: timelineTracks.value,
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

      // If stream ended without explicit done/error, check status
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

  // Format seconds to mm:ss
  function formatDuration(sec: number) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  async function fetchPrompts() {
    try {
      const res = await $fetch<{ prompts: {id: string, name: string, suitableFor: string[], prompt?: string}[] }>(`${API_BASE}/api/prompts`)
      promptsList.value = res.prompts || []
      // set default if nothing selected or current doesn't exist
      if (promptsList.value.length > 0 && !promptsList.value.find(p => p.id === selectedPrompt.value)) {
        selectedPrompt.value = promptsList.value[0].id
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

  async function saveTranscript() {
    if (!folderName.value || !fullTranscript.value) return
    try {
      await $fetch(`${API_BASE}/api/transcript`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          transcript: fullTranscript.value
        }
      })
      showToast('Edits saved successfully!', 'success')
      console.log('[clipper] Transcript saved successfully')
    } catch (e) {
      showToast('Failed to save edits', 'error')
      console.error('[clipper] Failed to save transcript:', e)
    }
  }

  // --- Timeline Actions ---
  function addTimelineItem(trackId: string, item: any) {
    const track = timelineTracks.value.find(t => t.id === trackId)
    if (track) {
      const startSec = item.start ?? currentTime.value
      const maxRemaining = Math.max(0.5, timelineDuration.value - startSec)
      const defaultDuration = item.duration ?? 5
      const durationSec = Math.min(defaultDuration, maxRemaining)

      let styleOverrides: any = {}
      if (trackId === 'text') {
        if (defaultTimelineTextStyle.value) {
          styleOverrides = { ...defaultTimelineTextStyle.value, linkToGlobal: true }
        } else {
          styleOverrides = getGlobalStyleSnapshot()
          styleOverrides.linkToGlobal = true
        }
      }

      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        start: startSec,
        mediaStart: item.mediaStart ?? 0,
        duration: durationSec,
        content: '',
        ...styleOverrides,
        ...item
      }
      track.items.push(newItem)
      selectedTimelineItem.value = newItem
    }
  }

  function saveTimelineTextStyleAsDefault(item: any) {
    const style = {
      font: item.font || font.value,
      fontSize: item.fontSize || 80,
      fontWeight: item.fontWeight || '900',
      textTransform: item.textTransform || 'none',
      align: item.align || 'center',
      color: item.color || '#FFFFFF',
      opacity: item.opacity ?? 1,
      strokeColor: item.strokeColor || '#000000',
      strokeWidth: item.strokeWidth ?? 5,
      showStroke: item.showStroke ?? false,
      showBackground: item.showBackground ?? false,
      backgroundColor: item.backgroundColor || '#000000',
      backgroundOpacity: item.backgroundOpacity ?? 0.7,
      letterSpacing: item.letterSpacing ?? 0,
      wordSpacing: item.wordSpacing ?? 0,
      lineHeight: item.lineHeight ?? 1.1,
      shadowBlur: item.shadowBlur ?? 10,
      shadowColor: item.shadowColor || '#000000',
      shadowOpacity: item.shadowOpacity ?? 0.5,
      shadowOffsetX: item.shadowOffsetX ?? 5,
      shadowOffsetY: item.shadowOffsetY ?? 5,
    }
    defaultTimelineTextStyle.value = style
    if (import.meta.client) {
      localStorage.setItem('defaultTimelineTextStyle', JSON.stringify(style))
    }
    showToast('Saved current style as manual text default!', 'success')
  }

  /** Build a style snapshot from the current global subtitle settings */
  function getGlobalStyleSnapshot() {
    return {
      font: font.value || 'Outfit',
      fontSize: 80,
      fontWeight: subtitleFontWeight.value ? String(subtitleFontWeight.value) : '900',
      textTransform: subtitleTextTransform.value || 'uppercase',
      align: 'center',
      color: subtitleTextColor.value || '#FFFFFF',
      opacity: 1,
      strokeColor: subtitleStrokeColor.value || '#000000',
      strokeWidth: subtitleStrokeWidth.value ?? 5,
      showStroke: (subtitleStrokeWidth.value ?? 0) > 0,
      showBackground: (subtitleBackground.value || 'none') !== 'none',
      backgroundColor: '#000000',
      backgroundOpacity: subtitleBackgroundOpacity.value ?? 0.7,
      letterSpacing: 0,
      wordSpacing: subtitleWordSpacing.value ?? 0,
      lineHeight: 1.1,
      shadowBlur: 10,
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowOffsetX: 5,
      shadowOffsetY: 5,
    }
  }

  /** Sync current global subtitle styles into a single timeline text item */
  function syncGlobalStylesToItem(item: any) {
    const snap = getGlobalStyleSnapshot()
    Object.assign(item, snap)
    item.linkToGlobal = true
  }

  function deleteTimelineItem(trackId: string, itemId: string) {
    const track = timelineTracks.value.find(t => t.id === trackId)
    if (track) {
      track.items = track.items.filter((i: any) => i.id !== itemId)
      if (selectedTimelineItem.value?.id === itemId) {
        selectedTimelineItem.value = null
      }
    }
  }

  function updateTimelineItem(trackId: string, itemId: string, updates: any) {
    const track = timelineTracks.value.find(t => t.id === trackId)
    if (track) {
      const item = track.items.find((i: any) => i.id === itemId)
      if (item) {
        Object.assign(item, updates)
      }
    }
  }

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
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          settings
        }
      })
      console.log('[clipper] Saved style settings')
    } catch (e) {
      console.error('[clipper] Failed to save style settings:', e)
    }
  }

  async function saveTimelineTracks() {
    if (isSavingLocked.value) {
      console.log('[clipper] saveTimelineTracks BLOCKED (lock active)')
      return
    }
    if (!folderName.value || !clipId.value) return
    
    console.log('[clipper] saveTimelineTracks triggered for:', folderName.value, clipId.value)
    console.log('[clipper] Tracks state:', JSON.stringify(timelineTracks.value).substring(0, 200) + '...')

    try {
      await $fetch(`${API_BASE}/api/timeline`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          timeline_tracks: timelineTracks.value
        }
      })
      console.log('[clipper] Saved timeline tracks successfully')
    } catch (e) {
      console.error('[clipper] Failed to save timeline tracks:', e)
    }
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
        body: {
          settings
        }
      })
      console.log('[clipper] Saved default style settings')
    } catch (e) {
      console.error('[clipper] Failed to save default style settings:', e)
    }
  }

  function initPersistence() {
    if (import.meta.server || isPersistenceInitialized) return
    isPersistenceInitialized = true
    
    // Load
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
      try { defaultTimelineTextStyle.value = JSON.parse(savedStyle) } catch {}
    }

    // Watch
    watch(selectedPrompt, (val) => localStorage.setItem('yonru_prompt', val))
    watch(whisperModel, (val) => localStorage.setItem('yonru_model', val))

    // Watch timeline to auto-save
    watch(timelineTracks, () => {
      saveTimelineTracks()
    }, { deep: true })

    // Watch thumbnail config to auto-save and auto-capture on first-time toggle
    watch(thumbnailEnabled, (val) => {
      if (val && !thumbnailUrl.value && !isSavingLocked.value) {
        captureScreenshot(currentTime.value)
      }
    })

    watch([thumbnailEnabled, thumbnailDuration, thumbnailTextOverlays], () => {
      if (!isSavingLocked.value) {
        saveThumbnailConfig()
      }
    }, { deep: true })

    // Watch global subtitle style changes and sync to linked timeline text items
    watch(
      [font, fontSize, subtitleFontWeight, subtitleTextTransform, subtitleTextColor,
       subtitleStrokeColor, subtitleStrokeWidth, subtitleBackground, subtitleBackgroundOpacity, subtitleWordSpacing],
      () => {
        const textTrack = timelineTracks.value.find((t: any) => t.id === 'text')
        if (!textTrack) return
        textTrack.items.forEach((item: any) => {
          if (item.linkToGlobal !== false) {
            syncGlobalStylesToItem(item)
          }
        })
      }
    )
  }

  // --- Thumbnail Actions ---

  async function captureScreenshot(timestamp?: number) {
    if (!jobId.value) return
    try {
      let requestTimestamp = timestamp ?? null
      if (timestamp !== undefined && timestamp !== null) {
        // Option B1: Dynamic Frame-rate Offset (3 frames back)
        const fps = videoFps.value || 30
        const frameOffset = 3 / fps
        requestTimestamp = Math.max(0, timestamp - frameOffset)
      }

      const res = await $fetch<{ status: string; timestamp: number; thumbnail_url: string }>(`${API_BASE}/api/thumbnail/screenshot`, {
        method: 'POST',
        body: {
          job_id: jobId.value,
          timestamp: requestTimestamp
        }
      })
      thumbnailUrl.value = `${API_BASE}${res.thumbnail_url}?t=${Date.now()}`
      // Keep the original requested playhead timestamp for the UI badge
      thumbnailScreenshotTime.value = timestamp ?? res.timestamp
      thumbnailEnabled.value = true
      showToast('Thumbnail captured!', 'success')
    } catch (e: any) {
      showToast('Failed to capture thumbnail', 'error')
    }
  }

  function addThumbnailText() {
    thumbnailTextOverlays.value = [
      ...thumbnailTextOverlays.value,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: 'YOUR TEXT',
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
        backgroundPadding: 20
      }
    ]
  }

  function removeThumbnailText(id: string) {
    thumbnailTextOverlays.value = thumbnailTextOverlays.value.filter(t => t.id !== id)
  }

  async function saveThumbnailConfig() {
    if (!folderName.value || !clipId.value) return
    try {
      await $fetch(`${API_BASE}/api/thumbnail/config`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          config: {
            enabled: thumbnailEnabled.value,
            duration: thumbnailDuration.value,
            screenshotTime: thumbnailScreenshotTime.value,
            textOverlays: thumbnailTextOverlays.value,
            xOffset: thumbnailXOffset.value
          }
        }
      })
      console.log('[clipper] Thumbnail config saved')
    } catch (e) {
      console.error('[clipper] Failed to save thumbnail config:', e)
    }
  }

  async function loadThumbnailConfig() {
    if (!folderName.value || !clipId.value) return
    try {
      const res = await $fetch<{ config: any }>(`${API_BASE}/api/thumbnail/config/${folderName.value}/${clipId.value}`)
      if (res.config) {
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
        
        // Try to load thumbnail image
        const baseClipUrl = `${API_BASE}/assets/clips/${folderName.value}/${clipId.value}`
        try {
          const thumbUrl = `${baseClipUrl}/thumbnail.jpg?t=${Date.now()}`
          thumbnailUrl.value = thumbUrl
        } catch { }
        
        console.log('[clipper] Thumbnail config loaded')
      }
    } catch (e) {
      console.log('[clipper] No thumbnail config for this clip')
    }
  }

  async function runDeepAudit() {
    if (!activeHook.value || isDeepAuditing.value) return
    isDeepAuditing.value = true
    deepAuditResults.value = null
    
    try {
      const response = await fetch(`${API_BASE}/audit/deep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: activeHook.value.transcript_quote,
          language: language.value
        })
      })
      if (!response.ok) throw new Error('Backend audit failed')
      const data = await response.json()
      deepAuditResults.value = data
    } catch (e) {
      console.error('[audit] Deep audit failed:', e)
      // Mock for development if backend missing
      setTimeout(() => {
        deepAuditResults.value = {
          riskLevel: 'medium',
          violations: ['Potential clickbait pattern detected', 'Sensitive health claim check recommended'],
          suggestions: 'Rephrase the opening sentence to be less inflammatory.'
        }
        isDeepAuditing.value = false
      }, 1500)
      return
    } finally {
      if (deepAuditResults.value) isDeepAuditing.value = false
    }
  }

  function maskFlaggedWords() {
    if (!fullTranscript.value) return
    const combinedBlacklist = [...new Set([...DEFAULT_BLACKLIST, ...customBlacklist.value])]
    
    fullTranscript.value = fullTranscript.value.map(seg => {
      let newText = seg.text
      combinedBlacklist.forEach(word => {
        let regex: RegExp
        if (word.startsWith('/') && word.endsWith('/')) {
          regex = new RegExp(word.slice(1, -1), 'gi')
        } else {
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')
        }
        newText = newText.replace(regex, (match) => {
          if (match.length <= 2) return match
          const mid = Math.floor(match.length / 2)
          return match.substring(0, mid) + '*' + match.substring(mid + 1)
        })
      })
      return { ...seg, text: newText }
    })
    saveTranscript()
    showToast('Subtitle keywords masked successfully', 'success')
  }

  return {
    contentAudit, 
    customBlacklist, 
    safeZoneVisible, 
    saveBlacklistToStorage, 
    DEFAULT_BLACKLIST,
    thumbnailEnabled, 
    thumbnailUrl, 
    thumbnailDuration, 
    thumbnailScreenshotTime,
    thumbnailTextOverlays, 
    thumbnailEditMode,
    thumbnailXOffset,
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
    isPlaying, currentTime, videoTime,
    renderStatus, renderProgress, renderStage, renderEta, outputUrl,
    cachedVideos, isCachedLoading, lastAccessedVideoId, lastAccessedVideo, lastAccessedClip,
    timelineTracks, timelineDuration, selectedTimelineItem,
    defaultTimelineTextStyle,
    deepAuditResults, isDeepAuditing,
    // Actions
    analyzeUrl, extractClip, loadReadyClipIntoEditor, renderClip, startPolling, stopPolling,
    formatDuration, fetchPrompts, editPrompt, fetchSavedHooks, saveHook, deleteSavedHook,
    saveTranscript, saveStyleSettings, saveDefaultStyleSettings, updateHooks,
    runDeepAudit, maskFlaggedWords,
    fetchCached, setLastAccessed, setLastClip,
    saveTimelineTracks,
    addTimelineItem, deleteTimelineItem, updateTimelineItem, saveTimelineTextStyleAsDefault, syncGlobalStylesToItem,
    captureScreenshot, addThumbnailText, removeThumbnailText, saveThumbnailConfig, loadThumbnailConfig,
    toast, showToast, initPersistence
  }
}
