// jobCoordinator.ts - Ingestion Job Coordinator domain engine
import { resolveApiBase } from './apiBase';
import {
  ClipSessionClient,
  executeSessionFetch,
  type ClipSessionData,
  type HttpFetchOptions,
  type HttpFetcher
} from './clipSessionClient';
import { normalizeTimelineTracks } from './timelineHelpers';
import {
  DEFAULT_SUBTITLE_STYLES,
  SubtitleStyleCoordinator
} from './subtitleStyleCoordinator';
import type {
  Hook,
  TranscriptSegment,
  SubtitleStyleSettings,
  ThumbnailConfig,
  JobApiResponse,
  PipelineErrorDetail,
  TimelineTrack,
  HistorySnapshot,
  HookExtractionMode,
  HookIntentPreset
} from '../types/clipper';

export interface AnalysisSpec {
  url: string;
  language?: string;
  promptFile?: string;
  numHooks?: number;
  autoHooks?: boolean;
  extractionMode?: HookExtractionMode;
  presetId?: HookIntentPreset;
  focusTopic?: string | null;
  minDuration?: number;
  maxDuration?: number;
  force?: boolean;
}

export interface CachedAnalysisSpec {
  videoId: string;
  promptFile?: string;
  numHooks?: number;
  autoHooks?: boolean;
  extractionMode?: HookExtractionMode;
  presetId?: HookIntentPreset;
  focusTopic?: string | null;
  minDuration?: number;
  maxDuration?: number;
  force?: boolean;
}

export interface ClipExtractSpec {
  jobId: string;
  startTime: number;
  endTime: number;
  theme?: string;
  whisperModel?: string;
}

export interface HydratedClipBundle {
  folderName: string;
  clipId: string;
  status?: string;
  transcript: TranscriptSegment[];
  styleSettings: Partial<SubtitleStyleSettings>;
  cropMap: Array<{ time: number; x: number }>;
  timelineTracks: TimelineTrack[];
  thumbnailConfig: ThumbnailConfig | null;
  coverUrl?: string | null;
  history?: {
    undo_stack?: HistorySnapshot[];
    redo_stack?: HistorySnapshot[];
  } | null;
  videoFps?: number;
  videoDuration?: number;
  assetUrl?: string;
  activeHook?: Hook | null;
  hooks?: Hook[];
  savedHooks?: Hook[];
}

export interface JobUpdateCallbacks {
  onStatusChange?: (status: string) => void;
  onDownloadProgress?: (percent: number) => void;
  onVideoMetadata?: (metadata: {
    title?: string;
    duration?: number;
    fps?: number;
    hasHeatmap?: boolean;
    hasPreview?: boolean;
    hdReady?: boolean;
    videoUrl?: string | null;
    folderName?: string | null;
  }) => void;
  onHooksDiscovered?: (hooks: Hook[], activeHook?: Hook | null) => void;
  onSavedHooksDiscovered?: (savedHooks: Hook[]) => void;
  onClipReady?: (bundle: HydratedClipBundle) => void;
  onSelfHeal?: (folderName: string, clipId: string) => Promise<void> | void;
  onError?: (error: string, detail?: PipelineErrorDetail | null) => void;
}

export class IngestionJobCoordinator {
  private apiBase: string;
  private fetcher?: HttpFetcher;
  private sessionClient: ClipSessionClient;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private activeJobId: string | null = null;
  private pollIntervalMs: number;

  constructor(
    apiBase: string = resolveApiBase(),
    fetcher?: HttpFetcher,
    pollIntervalMs: number = 1000
  ) {
    this.apiBase = apiBase;
    this.fetcher = fetcher;
    this.sessionClient = new ClipSessionClient(this.apiBase, this.fetcher);
    this.pollIntervalMs = pollIntervalMs;
  }

  public getApiBase(): string {
    return this.apiBase;
  }

  private async executeFetch<T>(
    url: string,
    options?: HttpFetchOptions
  ): Promise<T> {
    return executeSessionFetch<T>(url, options, this.fetcher);
  }

  public isPolling(): boolean {
    return this.pollInterval !== null;
  }

  public getActiveJobId(): string | null {
    return this.activeJobId;
  }

  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public async analyzeUrl(
    spec: AnalysisSpec,
    callbacks: JobUpdateCallbacks = {}
  ): Promise<string> {
    this.stopPolling();
    callbacks.onStatusChange?.('queued');
    callbacks.onDownloadProgress?.(0);

    try {
      const forceQuery = spec.force ? '?force=true' : '';
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
      );

      this.activeJobId = res.job_id;
      callbacks.onStatusChange?.(res.status);
      this.startPolling(res.job_id, {}, callbacks);
      return res.job_id;
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to start analysis';
      callbacks.onStatusChange?.('error');
      callbacks.onError?.(msg);
      throw e;
    }
  }

  public async analyzeCached(
    spec: CachedAnalysisSpec,
    callbacks: JobUpdateCallbacks = {}
  ): Promise<string> {
    this.stopPolling();
    callbacks.onStatusChange?.('queued');

    try {
      const forceQuery = spec.force ? '?force=true' : '';
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
      );

      this.activeJobId = res.job_id;
      callbacks.onStatusChange?.(res.status);

      if (res.status === 'ready' || res.status === 'hooks_ready') {
        const videoData = res.video || res.video_info;
        if (videoData) {
          callbacks.onVideoMetadata?.({
            title: videoData.title,
            duration: videoData.duration,
            fps: videoData.fps || res.fps || 30,
            hasHeatmap: Array.isArray(videoData.heatmap)
              ? videoData.heatmap.length > 0
              : Boolean(videoData.has_heatmap),
            hasPreview: videoData.has_preview ?? false,
            hdReady: videoData.hd_ready ?? false,
            videoUrl: videoData.asset_url
              ? `${this.apiBase}${videoData.asset_url}`
              : null,
            folderName: videoData.folder_name || res.folder_name
          });
        }
        if (res.hooks && Array.isArray(res.hooks)) {
          callbacks.onHooksDiscovered?.(res.hooks, res.hooks[0] || null);
        }
      }

      this.startPolling(res.job_id, {}, callbacks);
      return res.job_id;
    } catch (e: any) {
      const msg =
        e instanceof Error ? e.message : 'Failed to analyze cached video';
      callbacks.onStatusChange?.('error');
      callbacks.onError?.(msg);
      throw e;
    }
  }

  public async extractClip(
    spec: ClipExtractSpec,
    callbacks: JobUpdateCallbacks = {}
  ): Promise<any> {
    this.stopPolling();
    callbacks.onStatusChange?.('cutting');

    try {
      const res = await this.executeFetch<any>(
        `${this.apiBase}/api/extract-clip`,
        {
          method: 'POST',
          body: {
            job_id: spec.jobId,
            start_time: spec.startTime,
            end_time: spec.endTime,
            theme: spec.theme,
            whisper_model: spec.whisperModel || 'base'
          }
        }
      );

      this.activeJobId = spec.jobId;
      this.startPolling(spec.jobId, {}, callbacks);
      return res;
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Failed to extract clip';
      callbacks.onStatusChange?.('error');
      callbacks.onError?.(msg);
      throw e;
    }
  }

  public startPolling(
    jobId: string,
    context: { folderName?: string | null; clipId?: string | null } = {},
    callbacks: JobUpdateCallbacks = {}
  ): void {
    this.stopPolling();
    this.activeJobId = jobId;

    const poll = async () => {
      if (!this.activeJobId || this.activeJobId !== jobId) return;

      try {
        const res = await this.executeFetch<JobApiResponse>(
          `${this.apiBase}/api/job/${jobId}`
        );
        if (!res) return;

        callbacks.onStatusChange?.(res.status);

        if (res.download_percent !== undefined) {
          callbacks.onDownloadProgress?.(res.download_percent);
        }

        const respFolder =
          res.folder_name || (res.video ? res.video.folder_name : null);

        if (res.video) {
          callbacks.onVideoMetadata?.({
            title: res.video.title,
            duration: res.video.duration,
            fps: res.video.fps,
            hasHeatmap: res.video.has_heatmap || false,
            hasPreview: res.video.has_preview,
            hdReady: res.video.hd_ready,
            videoUrl: res.video.asset_url
              ? `${this.apiBase}${res.video.asset_url}`
              : null,
            folderName: respFolder
          });
        }

        if (res.hooks && Array.isArray(res.hooks)) {
          callbacks.onHooksDiscovered?.(res.hooks);
        }

        if (respFolder) {
          this.fetchSavedHooks(respFolder)
            .then(saved => {
              if (saved.length > 0) {
                callbacks.onSavedHooksDiscovered?.(saved);
              }
            })
            .catch(() => {});
        }

        // Terminal status: error
        if (res.status === 'error') {
          this.stopPolling();
          const msg = res.error || 'Job encountered an error';
          if (res.error_detail != null) {
            callbacks.onError?.(msg, res.error_detail);
          } else {
            callbacks.onError?.(msg);
          }
          return;
        }

        // Clip is ready
        if (res.status === 'ready' && res.clip && res.clip.asset_url) {
          const parts = res.clip.asset_url.split('/');
          const clipId = parts.length >= 5 ? parts[4] : null;
          const folder =
            respFolder ||
            context.folderName ||
            (parts.length >= 5 && parts[2] === 'clips' ? parts[3] : '');

          if (folder && clipId) {
            const session = await this.sessionClient
              .loadSession(folder, clipId)
              .catch(() => null);
            const bundle = this.hydrateBundleFromSession(
              folder,
              clipId,
              session,
              {
                status: res.status,
                fps: res.fps,
                duration: res.clip.duration,
                hooks: res.hooks,
                history: res.history ?? null,
                clip: res.clip
              }
            );
            callbacks.onClipReady?.(bundle);
          }

          this.stopPolling();
        }
      } catch (err: any) {
        if (err?.status === 404) {
          // Self-heal check
          if (context.folderName && context.clipId) {
            console.log(
              '[jobCoordinator] 404 detected — self-healing session for',
              context.folderName,
              context.clipId
            );
            this.stopPolling();
            if (callbacks.onSelfHeal) {
              await callbacks.onSelfHeal(context.folderName, context.clipId);
            } else {
              const bundle = await this.loadReadyClip(
                context.folderName,
                context.clipId
              );
              callbacks.onClipReady?.(bundle);
            }
            return;
          }
          this.stopPolling();
          callbacks.onStatusChange?.('error');
          callbacks.onError?.(
            'Job session expired. Please re-analyze the video.'
          );
        }
      }
    };

    // Trigger immediate first run, then start periodic interval
    poll();
    this.pollInterval = setInterval(poll, this.pollIntervalMs);
  }

  public async fetchSavedHooks(folderName: string): Promise<Hook[]> {
    try {
      const res = await this.executeFetch<{ saved_hooks: Hook[] }>(
        `${this.apiBase}/api/cached/${folderName}/saved_hooks`
      );
      return res.saved_hooks || [];
    } catch {
      return [];
    }
  }

  private hydrateBundleFromSession(
    folderName: string,
    clipId: string,
    session: ClipSessionData | null | undefined,
    meta: {
      status?: string;
      fps?: number;
      duration?: number;
      hooks?: Hook[];
      savedHooks?: Hook[];
      history?: {
        undo_stack?: HistorySnapshot[];
        redo_stack?: HistorySnapshot[];
      } | null;
      clip?: {
        duration?: number;
        start?: number;
        end?: number;
        theme?: string;
        transcript_quote?: string;
      };
    } = {}
  ): HydratedClipBundle {
    const safeFolder = encodeURIComponent(folderName);
    const safeClip = encodeURIComponent(clipId);
    const fallbackAssetUrl = `${this.apiBase}/assets/clips/${safeFolder}/${safeClip}/video.mp4`;

    const styleSettings = SubtitleStyleCoordinator.merge(
      { ...DEFAULT_SUBTITLE_STYLES },
      session?.style_settings ?? {}
    );

    const transcript = Array.isArray(session?.transcript)
      ? session.transcript
      : [];
    const cropMap = Array.isArray(session?.crop_map) ? session.crop_map : [];
    const rawTracks = Array.isArray(session?.timeline)
      ? session.timeline
      : null;
    const timelineTracks = normalizeTimelineTracks(rawTracks);
    const assetUrl = session?.asset_url
      ? session.asset_url.startsWith('http')
        ? session.asset_url
        : `${this.apiBase}${session.asset_url}`
      : fallbackAssetUrl;

    const clipMeta = meta.clip;
    const duration = meta.duration ?? clipMeta?.duration ?? 0;

    return {
      folderName: session?.folder_name || folderName,
      clipId: session?.clip_id || clipId,
      status: meta.status,
      transcript,
      styleSettings,
      cropMap,
      timelineTracks,
      thumbnailConfig: session?.cover_config ?? null,
      coverUrl: session?.cover_url ?? null,
      history: session?.history ?? meta.history ?? null,
      videoFps: meta.fps || 30,
      videoDuration: duration,
      assetUrl,
      hooks: meta.hooks || [],
      savedHooks: meta.savedHooks || [],
      activeHook: clipMeta?.theme
        ? {
            theme: clipMeta.theme,
            start: clipMeta.start || 0,
            end: clipMeta.end || duration || 0,
            duration,
            transcript_quote: clipMeta.transcript_quote || ''
          }
        : undefined
    };
  }

  public async loadReadyClip(
    folderName: string,
    clipId: string,
    whisperModel: string = 'base'
  ): Promise<HydratedClipBundle> {
    const res = await this.executeFetch<{
      job_id?: string;
      status?: string;
      fps?: number;
      clip?: {
        duration?: number;
        start?: number;
        end?: number;
        theme?: string;
        transcript_quote?: string;
      };
      hooks?: Hook[];
      saved_hooks?: Hook[];
      history?: {
        undo_stack?: HistorySnapshot[];
        redo_stack?: HistorySnapshot[];
      } | null;
      session?: ClipSessionData;
    }>(`${this.apiBase}/api/load-ready-clip`, {
      method: 'POST',
      body: {
        folder_name: folderName,
        clip_id: clipId,
        whisper_model: whisperModel
      }
    });

    if (res?.job_id) {
      this.activeJobId = res.job_id;
    }

    return this.hydrateBundleFromSession(folderName, clipId, res?.session, {
      status: res?.status,
      fps: res?.fps,
      duration: res?.clip?.duration,
      hooks: res?.hooks,
      savedHooks: res?.saved_hooks,
      history: res?.history,
      clip: res?.clip
    });
  }
}
