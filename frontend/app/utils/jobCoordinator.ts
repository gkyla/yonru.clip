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

export type PollingPhase =
  | 'idle'
  | 'analyzing'
  | 'hd_prefetch'
  | 'thumbnail_backfill'
  | 'extracting_clip';

export interface IngestionJobCoordinatorOptions {
  pollIntervalMs?: number;
  maxThumbnailBackfillPolls?: number;
  maxStagnantHdPrefetchPolls?: number;
  maxConsecutiveErrors?: number;
}

export interface PollingContext {
  folderName?: string | null;
  clipId?: string | null;
  phase?: PollingPhase;
  skipInitialSavedHooks?: boolean;
  delayFirstPoll?: boolean;
  initialStatus?: string | null;
  initialHooks?: Hook[] | null;
}

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

export interface VideoMetadataUpdate {
  title?: string;
  duration?: number;
  fps?: number;
  hasHeatmap?: boolean;
  hasPreview?: boolean;
  hdReady?: boolean;
  videoUrl?: string | null;
  folderName?: string | null;
}

export interface JobUpdateCallbacks {
  onStatusChange?: (status: string) => void;
  onDownloadProgress?: (percent: number) => void;
  onVideoMetadata?: (metadata: VideoMetadataUpdate) => void;
  onHooksDiscovered?: (hooks: Hook[], activeHook?: Hook | null) => void;
  onSavedHooksDiscovered?: (savedHooks: Hook[]) => void;
  onClipReady?: (bundle: HydratedClipBundle) => void;
  onSelfHeal?: (folderName: string, clipId: string) => Promise<void> | void;
  onError?: (error: string, detail?: PipelineErrorDetail | null) => void;
}

interface AnalyzeUrlResponse {
  job_id: string;
  status: string;
}

interface CachedVideoPayload {
  title?: string;
  duration?: number;
  fps?: number;
  heatmap?: number[];
  has_heatmap?: boolean;
  has_preview?: boolean;
  hd_ready?: boolean;
  asset_url?: string;
  folder_name?: string;
}

interface CachedAnalyzeResponse {
  job_id: string;
  status: string;
  fps?: number;
  folder_name?: string;
  video?: CachedVideoPayload;
  video_info?: CachedVideoPayload;
  hooks?: Hook[];
  saved_hooks?: Hook[];
}

interface ExtractClipResponse {
  status?: string;
  job_id?: string;
}

interface HttpErrorLike {
  status?: number;
  message?: string;
}

const DEFAULT_MAX_THUMBNAIL_BACKFILL_POLLS = 8;
const DEFAULT_MAX_STAGNANT_HD_PREFETCH_POLLS = 45;
const DEFAULT_MAX_CONSECUTIVE_ERRORS = 3;

export class IngestionJobCoordinator {
  private apiBase: string;
  private fetcher?: HttpFetcher;
  private sessionClient: ClipSessionClient;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private isPollLoopActive = false;
  private pollToken = 0;
  private jobSessionToken = 0;
  private pollingPhase: PollingPhase = 'idle';
  private activeJobId: string | null = null;
  private pollIntervalMs: number;
  private maxThumbnailBackfillPolls: number;
  private maxStagnantHdPrefetchPolls: number;
  private maxConsecutiveErrors: number;

  constructor(
    apiBase: string = resolveApiBase(),
    fetcher?: HttpFetcher,
    pollIntervalMsOrOptions: number | IngestionJobCoordinatorOptions = 1000
  ) {
    this.apiBase = apiBase;
    this.fetcher = fetcher;
    this.sessionClient = new ClipSessionClient(this.apiBase, this.fetcher);
    if (typeof pollIntervalMsOrOptions === 'number') {
      this.pollIntervalMs = pollIntervalMsOrOptions;
      this.maxThumbnailBackfillPolls = DEFAULT_MAX_THUMBNAIL_BACKFILL_POLLS;
      this.maxStagnantHdPrefetchPolls = DEFAULT_MAX_STAGNANT_HD_PREFETCH_POLLS;
      this.maxConsecutiveErrors = DEFAULT_MAX_CONSECUTIVE_ERRORS;
    } else {
      this.pollIntervalMs = pollIntervalMsOrOptions.pollIntervalMs ?? 1000;
      this.maxThumbnailBackfillPolls =
        pollIntervalMsOrOptions.maxThumbnailBackfillPolls ??
        DEFAULT_MAX_THUMBNAIL_BACKFILL_POLLS;
      this.maxStagnantHdPrefetchPolls =
        pollIntervalMsOrOptions.maxStagnantHdPrefetchPolls ??
        DEFAULT_MAX_STAGNANT_HD_PREFETCH_POLLS;
      this.maxConsecutiveErrors =
        pollIntervalMsOrOptions.maxConsecutiveErrors ??
        DEFAULT_MAX_CONSECUTIVE_ERRORS;
    }
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
    return this.isPollLoopActive;
  }

  public getPollingPhase(): PollingPhase {
    return this.pollingPhase;
  }

  public isPollingJob(jobId: string, phase?: PollingPhase): boolean {
    if (!this.isPollLoopActive || this.activeJobId !== jobId) {
      return false;
    }
    return phase ? this.pollingPhase === phase : true;
  }

  public getActiveJobId(): string | null {
    return this.activeJobId;
  }

  /**
   * Stops the active poll timer and phase without cancelling in-flight
   * one-shot requests belonging to the completed job session.
   */
  private haltPollTimer(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPollLoopActive = false;
    this.pollingPhase = 'idle';
  }

  public stopPolling(): void {
    this.haltPollTimer();
    this.pollToken += 1;
    this.jobSessionToken += 1;
  }

  private hooksNeedThumbnailBackfill(hooks?: Hook[] | null): boolean {
    return (
      Array.isArray(hooks) &&
      hooks.length > 0 &&
      hooks.some(h => !h.thumbnail_url)
    );
  }

  private buildHooksSignature(hooks: Hook[]): string {
    return JSON.stringify(
      hooks.map(h => [
        h.id ?? h._id ?? '',
        h.start,
        h.end,
        h.theme,
        h.thumbnail_url ?? '',
        h.virality_score ?? null
      ])
    );
  }

  private buildVideoMetaSignature(meta: VideoMetadataUpdate): string {
    return JSON.stringify([
      meta.title ?? '',
      meta.duration ?? 0,
      meta.fps ?? 0,
      meta.hasHeatmap ?? false,
      meta.hasPreview ?? false,
      meta.hdReady ?? false,
      meta.videoUrl ?? '',
      meta.folderName ?? ''
    ]);
  }

  public async analyzeUrl(
    spec: AnalysisSpec,
    callbacks: JobUpdateCallbacks = {}
  ): Promise<string> {
    this.stopPolling();
    const sessionToken = ++this.jobSessionToken;
    callbacks.onStatusChange?.('queued');
    callbacks.onDownloadProgress?.(0);

    try {
      const forceQuery = spec.force ? '?force=true' : '';
      const res = await this.executeFetch<AnalyzeUrlResponse>(
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

      if (sessionToken !== this.jobSessionToken) {
        return res.job_id;
      }

      this.activeJobId = res.job_id;
      callbacks.onStatusChange?.(res.status);
      this.startPolling(
        res.job_id,
        { phase: 'analyzing', initialStatus: res.status },
        callbacks
      );
      return res.job_id;
    } catch (e: unknown) {
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
    const sessionToken = ++this.jobSessionToken;
    callbacks.onStatusChange?.('queued');

    try {
      const forceQuery = spec.force ? '?force=true' : '';
      const res = await this.executeFetch<CachedAnalyzeResponse>(
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

      if (sessionToken !== this.jobSessionToken) {
        return res.job_id;
      }

      this.activeJobId = res.job_id;
      callbacks.onStatusChange?.(res.status);

      if (res.status === 'ready' || res.status === 'hooks_ready') {
        const videoData = res.video || res.video_info;
        const respFolder = videoData?.folder_name || res.folder_name || null;
        const isHdReady =
          videoData?.hd_ready !== undefined
            ? Boolean(videoData.hd_ready)
            : res.status === 'ready';

        if (videoData) {
          callbacks.onVideoMetadata?.({
            title: videoData.title,
            duration: videoData.duration,
            fps: videoData.fps || res.fps || 30,
            hasHeatmap: Array.isArray(videoData.heatmap)
              ? videoData.heatmap.length > 0
              : Boolean(videoData.has_heatmap),
            hasPreview: videoData.has_preview ?? false,
            hdReady: isHdReady,
            videoUrl: videoData.asset_url
              ? `${this.apiBase}${videoData.asset_url}`
              : null,
            folderName: respFolder
          });
        }

        const discoveredHooks = Array.isArray(res.hooks) ? res.hooks : null;
        if (discoveredHooks) {
          callbacks.onHooksDiscovered?.(
            discoveredHooks,
            discoveredHooks[0] ?? null
          );
        }

        if (Array.isArray(res.saved_hooks) && res.saved_hooks.length > 0) {
          callbacks.onSavedHooksDiscovered?.(res.saved_hooks);
        } else if (respFolder) {
          const saved = await this.fetchSavedHooks(respFolder);
          if (sessionToken !== this.jobSessionToken) {
            return res.job_id;
          }
          if (saved.length > 0) {
            callbacks.onSavedHooksDiscovered?.(saved);
          }
        }

        const shouldBackfillThumbnails =
          this.hooksNeedThumbnailBackfill(discoveredHooks);

        if (res.status === 'ready' && isHdReady) {
          if (shouldBackfillThumbnails) {
            this.startPolling(
              res.job_id,
              {
                folderName: respFolder,
                phase: 'thumbnail_backfill',
                skipInitialSavedHooks: Boolean(respFolder),
                delayFirstPoll: true,
                initialStatus: res.status,
                initialHooks: discoveredHooks
              },
              callbacks
            );
          }
          return res.job_id;
        }

        this.startPolling(
          res.job_id,
          {
            folderName: respFolder,
            phase: 'hd_prefetch',
            skipInitialSavedHooks: Boolean(respFolder),
            delayFirstPoll: true,
            initialStatus: res.status,
            initialHooks: discoveredHooks
          },
          callbacks
        );
        return res.job_id;
      }

      this.startPolling(
        res.job_id,
        { phase: 'analyzing', initialStatus: res.status },
        callbacks
      );
      return res.job_id;
    } catch (e: unknown) {
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
  ): Promise<ExtractClipResponse> {
    this.stopPolling();
    const sessionToken = ++this.jobSessionToken;
    callbacks.onStatusChange?.('cutting');

    try {
      const res = await this.executeFetch<ExtractClipResponse>(
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

      if (sessionToken !== this.jobSessionToken) {
        return res;
      }

      this.activeJobId = spec.jobId;
      this.startPolling(spec.jobId, { phase: 'extracting_clip' }, callbacks);
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to extract clip';
      callbacks.onStatusChange?.('error');
      callbacks.onError?.(msg);
      throw e;
    }
  }

  public startPolling(
    jobId: string,
    context: PollingContext = {},
    callbacks: JobUpdateCallbacks = {}
  ): void {
    this.stopPolling();
    this.activeJobId = jobId;
    this.isPollLoopActive = true;
    const token = ++this.pollToken;
    const sessionToken = ++this.jobSessionToken;

    this.pollingPhase =
      context.phase && context.phase !== 'idle'
        ? context.phase
        : context.clipId
          ? 'extracting_clip'
          : 'analyzing';

    let lastStatus: string | null = context.initialStatus ?? null;
    let lastDownloadPercent: number | null = null;
    let lastVideoMetaSig: string | null = null;
    let lastHooksSig: string | null = Array.isArray(context.initialHooks)
      ? this.buildHooksSignature(context.initialHooks)
      : null;
    let lastSavedHooksSig: string | null = null;
    let savedHooksFetchedFolder: string | null =
      context.skipInitialSavedHooks && context.folderName
        ? context.folderName
        : null;
    let thumbnailBackfillTicks = 0;
    let stagnantHdTicks = 0;
    let hasHdProgressSample = false;
    let lastHdProgressSample: number | null = null;
    let stagnantExtractReadyTicks = 0;
    let consecutiveErrors = 0;

    const scheduleNextTick = () => {
      if (
        token !== this.pollToken ||
        !this.isPollLoopActive ||
        this.activeJobId !== jobId
      ) {
        return;
      }
      this.pollTimer = setTimeout(() => {
        this.pollTimer = null;
        void poll();
      }, this.pollIntervalMs);
    };

    const poll = async () => {
      if (
        token !== this.pollToken ||
        !this.isPollLoopActive ||
        this.activeJobId !== jobId
      ) {
        return;
      }

      try {
        const res = await this.executeFetch<JobApiResponse>(
          `${this.apiBase}/api/job/${jobId}`
        );

        if (
          token !== this.pollToken ||
          !this.isPollLoopActive ||
          this.activeJobId !== jobId
        ) {
          return;
        }

        if (!res) {
          if (this.pollingPhase === 'thumbnail_backfill') {
            thumbnailBackfillTicks += 1;
            if (thumbnailBackfillTicks >= this.maxThumbnailBackfillPolls) {
              this.haltPollTimer();
              return;
            }
          }
          scheduleNextTick();
          return;
        }

        consecutiveErrors = 0;

        if (res.status !== lastStatus) {
          lastStatus = res.status;
          callbacks.onStatusChange?.(res.status);
        }

        if (
          res.download_percent !== undefined &&
          res.download_percent !== lastDownloadPercent
        ) {
          lastDownloadPercent = res.download_percent;
          callbacks.onDownloadProgress?.(res.download_percent);
        }

        const respFolder =
          res.folder_name || (res.video ? res.video.folder_name : null);

        if (res.video) {
          const metaPayload: VideoMetadataUpdate = {
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
          };
          const metaSig = this.buildVideoMetaSignature(metaPayload);
          if (metaSig !== lastVideoMetaSig) {
            lastVideoMetaSig = metaSig;
            callbacks.onVideoMetadata?.(metaPayload);
          }
        }

        if (res.hooks && Array.isArray(res.hooks)) {
          const hooksSig = this.buildHooksSignature(res.hooks);
          if (hooksSig !== lastHooksSig) {
            lastHooksSig = hooksSig;
            callbacks.onHooksDiscovered?.(res.hooks, res.hooks[0] ?? null);
          }
        }

        if (respFolder && respFolder !== savedHooksFetchedFolder) {
          savedHooksFetchedFolder = respFolder;
          void this.fetchSavedHooks(respFolder)
            .then(saved => {
              if (sessionToken !== this.jobSessionToken) {
                return;
              }
              if (saved.length > 0) {
                const savedSig = this.buildHooksSignature(saved);
                if (savedSig !== lastSavedHooksSig) {
                  lastSavedHooksSig = savedSig;
                  callbacks.onSavedHooksDiscovered?.(saved);
                }
              }
            })
            .catch(() => {});
        }

        // Terminal status: error or cancelled
        if (res.status === 'error' || res.status === 'cancelled') {
          this.haltPollTimer();
          if (res.status === 'error') {
            const msg = res.error || 'Job encountered an error';
            if (res.error_detail != null) {
              callbacks.onError?.(msg, res.error_detail);
            } else {
              callbacks.onError?.(msg);
            }
          }
          return;
        }

        // Clip extraction is ready
        if (res.status === 'ready' && res.clip && res.clip.asset_url) {
          const parts = res.clip.asset_url.split('/');
          const clipId = parts.length >= 5 ? (parts[4] ?? null) : null;
          const folder =
            respFolder ||
            context.folderName ||
            (parts.length >= 5 && parts[2] === 'clips' ? (parts[3] ?? '') : '');

          if (folder && clipId) {
            const session = await this.sessionClient
              .loadSession(folder, clipId)
              .catch(() => null);

            if (
              token !== this.pollToken ||
              !this.isPollLoopActive ||
              this.activeJobId !== jobId
            ) {
              return;
            }

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
            this.haltPollTimer();
            callbacks.onClipReady?.(bundle);
            return;
          }

          this.haltPollTimer();
          return;
        }

        if (this.pollingPhase !== 'extracting_clip') {
          const isHdReady =
            res.video?.hd_ready !== undefined
              ? Boolean(res.video.hd_ready)
              : res.download_percent !== undefined
                ? res.download_percent >= 100
                : res.status === 'ready';

          if (
            res.status === 'hooks_ready' &&
            this.pollingPhase === 'analyzing'
          ) {
            this.pollingPhase = 'hd_prefetch';
            stagnantHdTicks = 0;
            hasHdProgressSample = true;
            lastHdProgressSample = res.download_percent ?? null;
          } else if (
            this.pollingPhase === 'hd_prefetch' &&
            !(res.status === 'ready' && isHdReady)
          ) {
            const progressSample = res.download_percent ?? null;
            if (!hasHdProgressSample) {
              hasHdProgressSample = true;
              lastHdProgressSample = progressSample;
            } else if (progressSample === lastHdProgressSample) {
              stagnantHdTicks += 1;
            } else {
              lastHdProgressSample = progressSample;
              stagnantHdTicks = 0;
            }

            if (stagnantHdTicks >= this.maxStagnantHdPrefetchPolls) {
              this.haltPollTimer();
              return;
            }
          }

          if (res.status === 'ready' && isHdReady) {
            if (!this.hooksNeedThumbnailBackfill(res.hooks)) {
              this.haltPollTimer();
              return;
            }

            if (this.pollingPhase !== 'thumbnail_backfill') {
              this.pollingPhase = 'thumbnail_backfill';
              thumbnailBackfillTicks = 0;
            } else {
              thumbnailBackfillTicks += 1;
              if (thumbnailBackfillTicks >= this.maxThumbnailBackfillPolls) {
                this.haltPollTimer();
                return;
              }
            }
          }
        } else if (res.status === 'ready') {
          // Guard against extracting_clip settling on ready without clip metadata
          stagnantExtractReadyTicks += 1;
          if (stagnantExtractReadyTicks >= 3) {
            this.haltPollTimer();
            return;
          }
        }
      } catch (err: unknown) {
        if (
          token !== this.pollToken ||
          !this.isPollLoopActive ||
          this.activeJobId !== jobId
        ) {
          return;
        }

        const httpErr = err as HttpErrorLike | null | undefined;
        if (httpErr?.status === 404) {
          // Self-heal check
          if (context.folderName && context.clipId) {
            console.log(
              '[jobCoordinator] 404 detected — self-healing session for',
              context.folderName,
              context.clipId
            );
            this.haltPollTimer();
            if (callbacks.onSelfHeal) {
              await callbacks.onSelfHeal(context.folderName, context.clipId);
            } else {
              const bundle = await this.loadReadyClip(
                context.folderName,
                context.clipId
              );
              if (token !== this.pollToken) {
                return;
              }
              callbacks.onClipReady?.(bundle);
            }
            return;
          }
          this.haltPollTimer();
          callbacks.onStatusChange?.('error');
          callbacks.onError?.(
            'Job session expired. Please re-analyze the video.'
          );
          return;
        }

        consecutiveErrors += 1;
        if (consecutiveErrors >= this.maxConsecutiveErrors) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Polling failed due to network error';
          this.haltPollTimer();
          callbacks.onStatusChange?.('error');
          callbacks.onError?.(msg);
          return;
        }
      }

      scheduleNextTick();
    };

    if (context.delayFirstPoll) {
      scheduleNextTick();
    } else {
      void poll();
    }
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
    this.stopPolling();
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
