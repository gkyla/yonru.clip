// jobCoordinator.ts - Ingestion Job Coordinator domain engine
import type {
  Hook,
  TranscriptSegment,
  SubtitleStyleSettings,
  ThumbnailConfig,
  JobApiResponse,
  TimelineTrack,
  HistorySnapshot,
  HookExtractionMode,
  HookIntentPreset
} from '../types/clipper'

export type HttpFetcher = <T>(url: string, options?: { method?: string; body?: any; headers?: Record<string, string> }) => Promise<T>

export interface AnalysisSpec {
  url: string
  language?: string
  promptFile?: string
  numHooks?: number
  autoHooks?: boolean
  extractionMode?: HookExtractionMode
  presetId?: HookIntentPreset
  focusTopic?: string | null
  minDuration?: number
  maxDuration?: number
  force?: boolean
}

export interface CachedAnalysisSpec {
  videoId: string
  promptFile?: string
  numHooks?: number
  autoHooks?: boolean
  extractionMode?: HookExtractionMode
  presetId?: HookIntentPreset
  focusTopic?: string | null
  minDuration?: number
  maxDuration?: number
  force?: boolean
}

export interface ClipExtractSpec {
  jobId: string
  startTime: number
  endTime: number
  theme?: string
  whisperModel?: string
}

export interface HydratedClipBundle {
  folderName: string
  clipId: string
  transcript: TranscriptSegment[]
  styleSettings: Partial<SubtitleStyleSettings>
  cropMap: Array<{ time: number; x: number }>
  timelineTracks: TimelineTrack[]
  thumbnailConfig: ThumbnailConfig | null
  history?: { undo_stack?: HistorySnapshot[]; redo_stack?: HistorySnapshot[] } | null
  videoFps?: number
  videoDuration?: number
  assetUrl?: string
  activeHook?: Hook | null
  hooks?: Hook[]
  savedHooks?: Hook[]
}

export interface JobUpdateCallbacks {
  onStatusChange?: (status: string) => void
  onDownloadProgress?: (percent: number) => void
  onVideoMetadata?: (metadata: {
    title?: string
    duration?: number
    fps?: number
    hasHeatmap?: boolean
    hasPreview?: boolean
    hdReady?: boolean
    videoUrl?: string | null
    folderName?: string | null
  }) => void
  onHooksDiscovered?: (hooks: Hook[], activeHook?: Hook | null) => void
  onSavedHooksDiscovered?: (savedHooks: Hook[]) => void
  onClipReady?: (bundle: HydratedClipBundle) => void
  onSelfHeal?: (folderName: string, clipId: string) => Promise<void> | void
  onError?: (error: string) => void
}

export const DEFAULT_SUBTITLE_STYLES: Partial<SubtitleStyleSettings> = {
  videoLayout: 'vertical',
  subtitlePosition: 'center',
  subtitleOffset: 50,
  subtitleSyncOffset: 150,
  font: 'Montserrat',
  fontSize: 50,
  cropMode: 'face_tracking',
  cropMap: [],
  cropPercentX: 50,
  subtitleMode: 'word',
  subtitleAnimation: 'pop',
  subtitleHighlightMode: 'color',
  subtitleHighlightColor: '#CFFF50',
  subtitleTextColor: '#FFFFFF',
  subtitleStrokeColor: '#000000',
  subtitleStrokeWidth: 0,
  subtitleFontWeight: 900,
  subtitleTextTransform: 'uppercase',
  subtitleBackground: 'none',
  subtitleBackgroundOpacity: 0.7,
  subtitleWordSpacing: 0,
  volume: 0.5,
  subtitlePreset: 'bold-podcast'
}

export class IngestionJobCoordinator {
  private apiBase: string
  private fetcher?: HttpFetcher
  private pollInterval: ReturnType<typeof setInterval> | null = null
  private activeJobId: string | null = null
  private pollIntervalMs: number

  constructor(
    apiBase: string = 'http://localhost:8000',
    fetcher?: HttpFetcher,
    pollIntervalMs: number = 1000
  ) {
    this.apiBase = apiBase
    this.fetcher = fetcher
    this.pollIntervalMs = pollIntervalMs
  }

  private async executeFetch<T>(url: string, options?: { method?: string; body?: any; headers?: Record<string, string> }): Promise<T> {
    if (this.fetcher) {
      return this.fetcher<T>(url, options)
    }
    if (typeof (globalThis as any).$fetch === 'function') {
      return (globalThis as any).$fetch(url, options)
    }
    const res = await fetch(url, {
      method: options?.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      body: options?.body ? JSON.stringify(options.body) : undefined
    })
    if (!res.ok) {
      const err: any = new Error(res.statusText)
      err.status = res.status
      throw err
    }
    return res.json()
  }

  public resetSubtitleStyles(): Partial<SubtitleStyleSettings> {
    return { ...DEFAULT_SUBTITLE_STYLES }
  }

  public mergeSubtitleStyles(
    base: Partial<SubtitleStyleSettings>,
    overrides?: Partial<SubtitleStyleSettings> | null
  ): Partial<SubtitleStyleSettings> {
    if (!overrides) return { ...base }
    return {
      videoLayout: overrides.videoLayout ?? base.videoLayout,
      subtitlePosition: overrides.subtitlePosition ?? base.subtitlePosition,
      subtitleOffset: overrides.subtitleOffset !== undefined ? overrides.subtitleOffset : base.subtitleOffset,
      subtitleSyncOffset: overrides.subtitleSyncOffset !== undefined ? overrides.subtitleSyncOffset : base.subtitleSyncOffset,
      font: overrides.font ?? base.font,
      fontSize: overrides.fontSize !== undefined ? overrides.fontSize : base.fontSize,
      cropMode: overrides.cropMode ?? base.cropMode,
      cropMap: overrides.cropMap ?? base.cropMap,
      cropPercentX: overrides.cropPercentX !== undefined ? overrides.cropPercentX : base.cropPercentX,
      subtitleMode: overrides.subtitleMode ?? base.subtitleMode,
      subtitleAnimation: overrides.subtitleAnimation ?? base.subtitleAnimation,
      subtitleHighlightMode: overrides.subtitleHighlightMode ?? base.subtitleHighlightMode,
      subtitleHighlightColor: overrides.subtitleHighlightColor ?? base.subtitleHighlightColor,
      subtitleTextColor: overrides.subtitleTextColor ?? base.subtitleTextColor,
      subtitleStrokeColor: overrides.subtitleStrokeColor ?? base.subtitleStrokeColor,
      subtitleStrokeWidth: overrides.subtitleStrokeWidth !== undefined ? overrides.subtitleStrokeWidth : base.subtitleStrokeWidth,
      subtitleFontWeight: overrides.subtitleFontWeight !== undefined ? overrides.subtitleFontWeight : base.subtitleFontWeight,
      subtitleTextTransform: overrides.subtitleTextTransform ?? base.subtitleTextTransform,
      subtitleBackground: overrides.subtitleBackground ?? base.subtitleBackground,
      subtitleBackgroundOpacity: overrides.subtitleBackgroundOpacity !== undefined ? overrides.subtitleBackgroundOpacity : base.subtitleBackgroundOpacity,
      subtitleWordSpacing: overrides.subtitleWordSpacing !== undefined ? overrides.subtitleWordSpacing : base.subtitleWordSpacing,
      volume: overrides.volume !== undefined ? overrides.volume : base.volume,
      subtitlePreset: overrides.subtitlePreset ?? base.subtitlePreset
    }
  }

  public isPolling(): boolean {
    return this.pollInterval !== null
  }

  public getActiveJobId(): string | null {
    return this.activeJobId
  }

  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  public async analyzeUrl(spec: AnalysisSpec, callbacks: JobUpdateCallbacks = {}): Promise<string> {
    this.stopPolling()
    callbacks.onStatusChange?.('queued')
    callbacks.onDownloadProgress?.(0)

    try {
      const forceQuery = spec.force ? '?force=true' : ''
      const res = await this.executeFetch<{ job_id: string; status: string }>(
        `${this.apiBase}/api/analyze-url${forceQuery}`,
        {
          method: 'POST',
          body: {
            url: spec.url,
            language: spec.language || 'id',
            prompt_file: spec.promptFile || 'prompt.json',
            num_hooks: spec.numHooks ?? 10,
            auto_hooks: spec.autoHooks ?? false,
            extraction_mode: spec.extractionMode || 'preset',
            preset_id: spec.presetId || 'auto',
            focus_topic: spec.focusTopic ? spec.focusTopic.trim() : null,
            min_duration: spec.minDuration || 30,
            max_duration: spec.maxDuration || 180
          }
        }
      )

      this.activeJobId = res.job_id
      callbacks.onStatusChange?.(res.status)
      this.startPolling(res.job_id, {}, callbacks)
      return res.job_id
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to start analysis'
      callbacks.onStatusChange?.('error')
      callbacks.onError?.(msg)
      throw e
    }
  }

  public async analyzeCached(spec: CachedAnalysisSpec, callbacks: JobUpdateCallbacks = {}): Promise<string> {
    this.stopPolling()
    callbacks.onStatusChange?.('queued')

    try {
      const forceQuery = spec.force ? '?force=true' : ''
      const res = await this.executeFetch<any>(
        `${this.apiBase}/api/analyze-cached/${spec.videoId}${forceQuery}`,
        {
          method: 'POST',
          body: {
            prompt_file: spec.promptFile || 'prompt.json',
            num_hooks: spec.numHooks ?? 10,
            auto_hooks: spec.autoHooks ?? false,
            extraction_mode: spec.extractionMode || 'preset',
            preset_id: spec.presetId || 'auto',
            focus_topic: spec.focusTopic ? spec.focusTopic.trim() : null,
            min_duration: spec.minDuration || 30,
            max_duration: spec.maxDuration || 180
          }
        }
      )

      this.activeJobId = res.job_id
      callbacks.onStatusChange?.(res.status)

      if (res.status === 'ready' || res.status === 'hooks_ready') {
        if (res.video_info) {
          callbacks.onVideoMetadata?.({
            title: res.video_info.title,
            duration: res.video_info.duration,
            fps: res.video_info.fps || res.fps || 30,
            hasHeatmap: (res.video_info.heatmap || []).length > 0,
            hasPreview: res.video_info.has_preview ?? false,
            hdReady: res.video_info.hd_ready ?? false,
            videoUrl: res.video_info.asset_url ? `${this.apiBase}${res.video_info.asset_url}` : null,
            folderName: res.video_info.folder_name
          })
        }
        if (res.hooks && Array.isArray(res.hooks)) {
          callbacks.onHooksDiscovered?.(res.hooks, res.hooks[0] || null)
        }
      }

      this.startPolling(res.job_id, {}, callbacks)
      return res.job_id
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to analyze cached video'
      callbacks.onStatusChange?.('error')
      callbacks.onError?.(msg)
      throw e
    }
  }

  public async extractClip(spec: ClipExtractSpec, callbacks: JobUpdateCallbacks = {}): Promise<any> {
    this.stopPolling()
    callbacks.onStatusChange?.('cutting')

    try {
      const res = await this.executeFetch<any>(`${this.apiBase}/api/extract-clip`, {
        method: 'POST',
        body: {
          job_id: spec.jobId,
          start_time: spec.startTime,
          end_time: spec.endTime,
          theme: spec.theme,
          whisper_model: spec.whisperModel || 'base'
        }
      })

      this.activeJobId = spec.jobId
      this.startPolling(spec.jobId, {}, callbacks)
      return res
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to extract clip'
      callbacks.onStatusChange?.('error')
      callbacks.onError?.(msg)
      throw e
    }
  }

  public startPolling(
    jobId: string,
    context: { folderName?: string | null; clipId?: string | null } = {},
    callbacks: JobUpdateCallbacks = {}
  ): void {
    this.stopPolling()
    this.activeJobId = jobId

    const poll = async () => {
      if (!this.activeJobId || this.activeJobId !== jobId) return

      try {
        const res = await this.executeFetch<JobApiResponse>(`${this.apiBase}/api/job/${jobId}`)
        if (!res) return

        callbacks.onStatusChange?.(res.status)

        if (res.download_percent !== undefined) {
          callbacks.onDownloadProgress?.(res.download_percent)
        }

        const respFolder = res.folder_name || (res.video ? res.video.folder_name : null)

        if (res.video) {
          callbacks.onVideoMetadata?.({
            title: res.video.title,
            duration: res.video.duration,
            fps: res.video.fps,
            hasHeatmap: res.video.has_heatmap || false,
            hasPreview: res.video.has_preview,
            hdReady: res.video.hd_ready,
            videoUrl: res.video.asset_url ? `${this.apiBase}${res.video.asset_url}` : null,
            folderName: respFolder
          })
        }

        if (res.hooks && Array.isArray(res.hooks)) {
          callbacks.onHooksDiscovered?.(res.hooks)
        }

        if (respFolder) {
          this.fetchSavedHooks(respFolder).then(saved => {
            if (saved.length > 0) {
              callbacks.onSavedHooksDiscovered?.(saved)
            }
          }).catch(() => {})
        }

        // Terminal status: error
        if (res.status === 'error') {
          this.stopPolling()
          callbacks.onError?.(res.error || 'Job encountered an error')
          return
        }

        // Clip is ready
        if (res.clip && res.clip.asset_url) {
          const parts = res.clip.asset_url.split('/')
          const clipId = parts.length >= 5 ? parts[4] : null
          const folder = respFolder || context.folderName || (parts.length >= 5 && parts[2] === 'clips' ? parts[3] : '')

          if (folder && clipId) {
            const bundle = await this.loadClipAssets(folder, clipId)
            bundle.videoFps = res.fps || 30
            bundle.videoDuration = res.clip.duration
            bundle.hooks = res.hooks || []
            bundle.history = res.history || null

            if (res.clip.theme) {
              bundle.activeHook = {
                theme: res.clip.theme,
                start: res.clip.start || 0,
                end: res.clip.end || res.clip.duration || 0,
                duration: res.clip.duration || 0,
                transcript_quote: res.clip.transcript_quote || ''
              }
            }

            callbacks.onClipReady?.(bundle)
          }

          if (res.status === 'ready') {
            this.stopPolling()
          }
        }
      } catch (err: any) {
        if (err?.status === 404) {
          // Self-heal check
          if (context.folderName && context.clipId) {
            console.log('[jobCoordinator] 404 detected — self-healing session for', context.folderName, context.clipId)
            this.stopPolling()
            if (callbacks.onSelfHeal) {
              await callbacks.onSelfHeal(context.folderName, context.clipId)
            } else {
              const bundle = await this.loadReadyClip(context.folderName, context.clipId)
              callbacks.onClipReady?.(bundle)
            }
            return
          }
          this.stopPolling()
          callbacks.onStatusChange?.('error')
          callbacks.onError?.('Job session expired. Please re-analyze the video.')
        }
      }
    }

    // Trigger immediate first run, then start periodic interval
    poll()
    this.pollInterval = setInterval(poll, this.pollIntervalMs)
  }

  public async fetchSavedHooks(folderName: string): Promise<Hook[]> {
    try {
      const res = await this.executeFetch<{ saved_hooks: Hook[] }>(`${this.apiBase}/api/cached/${folderName}/saved_hooks`)
      return res.saved_hooks || []
    } catch {
      return []
    }
  }

  public async backfillCropMap(folderName: string, clipId: string): Promise<Array<{ time: number; x: number }>> {
    try {
      const res = await this.executeFetch<{ status: string; crop_map: Array<{ time: number; x: number }> }>(
        `${this.apiBase}/api/clips/${folderName}/${clipId}/track-face`,
        { method: 'POST' }
      )
      return res?.crop_map && Array.isArray(res.crop_map) ? res.crop_map : []
    } catch {
      return []
    }
  }

  public async loadClipAssets(
    folderName: string,
    clipId: string,
    baseClipUrl?: string
  ): Promise<HydratedClipBundle> {
    const targetBaseUrl = baseClipUrl || `${this.apiBase}/assets/clips/${folderName}/${clipId}`
    const now = Date.now()

    // 1. Fetch all assets concurrently with Promise.allSettled
    const [
      defaultStyleRes,
      clipStyleRes,
      transcriptRes,
      cropMapRes,
      timelineRes,
      thumbConfigRes,
      savedHooksRes
    ] = await Promise.allSettled([
      this.executeFetch<Record<string, unknown>>(`${this.apiBase}/assets/default_style_settings.json?t=${now}`).catch(() => null),
      this.executeFetch<Record<string, unknown>>(`${targetBaseUrl}/style_settings.json?t=${now}`).catch(() => null),
      this.executeFetch<TranscriptSegment[]>(`${targetBaseUrl}/transcript.json?t=${now}`).catch(() => null),
      this.executeFetch<Array<{ time: number; x: number }>>(`${targetBaseUrl}/crop_map.json?t=${now}`).catch(() => null),
      this.executeFetch<TimelineTrack[]>(`${targetBaseUrl}/timeline.json?t=${now}`).catch(() => null),
      this.executeFetch<{ config: ThumbnailConfig }>(`${this.apiBase}/api/thumbnail/config/${folderName}/${clipId}`).catch(() => null),
      this.executeFetch<{ saved_hooks: Hook[] }>(`${this.apiBase}/api/cached/${folderName}/saved_hooks`).catch(() => null)
    ])

    // Resolve style cascade: default -> custom clip
    let styles = { ...DEFAULT_SUBTITLE_STYLES }
    if (defaultStyleRes.status === 'fulfilled' && defaultStyleRes.value) {
      const rawDefault = (defaultStyleRes.value.settings || defaultStyleRes.value) as Partial<SubtitleStyleSettings>
      styles = this.mergeSubtitleStyles(styles, rawDefault)
    }
    if (clipStyleRes.status === 'fulfilled' && clipStyleRes.value) {
      const rawClip = (clipStyleRes.value.settings || clipStyleRes.value) as Partial<SubtitleStyleSettings>
      styles = this.mergeSubtitleStyles(styles, rawClip)
    }

    // Resolve transcript
    const transcript: TranscriptSegment[] = (transcriptRes.status === 'fulfilled' && Array.isArray(transcriptRes.value))
      ? transcriptRes.value
      : []

    // Resolve crop map or trigger on-demand backfill if empty
    let cropMap: Array<{ time: number; x: number }> = (cropMapRes.status === 'fulfilled' && Array.isArray(cropMapRes.value) && cropMapRes.value.length > 0)
      ? cropMapRes.value
      : []

    if (cropMap.length === 0) {
      cropMap = await this.backfillCropMap(folderName, clipId)
    }

    // Resolve timeline tracks or construct fallback tracks
    let timelineTracks: TimelineTrack[] = (timelineRes.status === 'fulfilled' && Array.isArray(timelineRes.value) && timelineRes.value.length > 0)
      ? timelineRes.value
      : [
          { id: 'video', name: 'Main Video', type: 'video', items: [] },
          { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
          { id: 'text', name: 'Text layers', type: 'text', items: [] },
          { id: 'subtitle', name: 'Subtitle', type: 'subtitle', items: [] }
        ]

    if (!timelineTracks.some(t => t.id === 'subtitle')) {
      timelineTracks.push({ id: 'subtitle', name: 'Subtitle', type: 'subtitle', items: [] })
    }

    // Resolve thumbnail config
    const thumbnailConfig: ThumbnailConfig | null = (thumbConfigRes.status === 'fulfilled' && thumbConfigRes.value?.config)
      ? thumbConfigRes.value.config
      : null

    // Resolve saved hooks
    const savedHooks: Hook[] = (savedHooksRes.status === 'fulfilled' && Array.isArray(savedHooksRes.value?.saved_hooks))
      ? savedHooksRes.value.saved_hooks
      : []

    return {
      folderName,
      clipId,
      transcript,
      styleSettings: styles,
      cropMap,
      timelineTracks,
      thumbnailConfig,
      savedHooks,
      assetUrl: `${targetBaseUrl}/video.mp4`
    }
  }

  public async loadReadyClip(
    folderName: string,
    clipId: string,
    whisperModel: string = 'base'
  ): Promise<HydratedClipBundle> {
    const res = await this.executeFetch<any>(`${this.apiBase}/api/load-ready-clip`, {
      method: 'POST',
      body: {
        folder_name: folderName,
        clip_id: clipId,
        whisper_model: whisperModel
      }
    })

    if (res?.job_id) {
      this.activeJobId = res.job_id
    }

    const bundle = await this.loadClipAssets(folderName, clipId)
    bundle.videoFps = res?.fps || 30
    bundle.videoDuration = res?.clip?.duration || 0
    bundle.hooks = res?.hooks || []
    bundle.history = res?.history || null

    if (res?.clip?.theme) {
      bundle.activeHook = {
        theme: res.clip.theme,
        start: res.clip.start || 0,
        end: res.clip.end || res.clip.duration || 0,
        duration: res.clip.duration || 0,
        transcript_quote: res.clip.transcript_quote || ''
      }
    }

    return bundle
  }
}
