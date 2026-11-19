/**
 * WorkspacePersistenceCoordinator — Deep Domain Engine for Workspace Storage,
 * Setting Hydration, Reactive Watchers, and BeforeUnload Lifecycle Guards.
 */

import { watch, type Ref } from 'vue';
import { isTextTrack } from './timelineHelpers';
import {
  ClipSessionSaveScheduler,
  type ClipSessionSaveDomain
} from './clipSessionSaveScheduler';
import type {
  HookExtractionMode,
  HookIntentPreset,
  CachedVideo,
  LastAccessedClip,
  TimelineTrack,
  TimelineTrackItem,
  CoverTextOverlay,
  TranscriptSegment
} from '../types/clipper';

export interface WorkspaceSettingsSchema {
  prompt?: string;
  extractionMode?: HookExtractionMode;
  presetId?: HookIntentPreset;
  focusTopic?: string;
  minDuration?: number;
  maxDuration?: number;
  whisperModel?: string;
  language?: string;
  lastVideoId?: string;
  lastVideoStored?: CachedVideo | null;
  lastClip?: LastAccessedClip | null;
  defaultTimelineTextStyle?: Record<string, any> | null;
}

export interface DomainPromptReactivityContext {
  selectedPrompt?: Ref<string>;
  extractionMode?: Ref<HookExtractionMode>;
  selectedPresetId?: Ref<HookIntentPreset>;
  focusTopic?: Ref<string>;
  minDuration?: Ref<number>;
  maxDuration?: Ref<number>;
}

export interface DomainLibraryReactivityContext {
  whisperModel?: Ref<string>;
  language?: Ref<string>;
  lastAccessedVideoId?: Ref<string | null>;
  lastAccessedVideoStored?: Ref<CachedVideo | null>;
  lastAccessedClip?: Ref<LastAccessedClip | null>;
  setLastClip?: (
    folder: string,
    clipId: string,
    title?: string,
    thumbnailUrl?: string,
    theme?: string,
    videoTitle?: string
  ) => void;
}

export interface DomainEditorSessionReactivityContext {
  folderName?: Ref<string | null>;
  clipId?: Ref<string | null>;
  fullTranscript?: Ref<TranscriptSegment[]>;
  saveStyleSettings?: () => Promise<void> | void;
  saveClipSession?: () => Promise<unknown> | void;
  saveTimelineTracks?: () => Promise<void> | void;
  saveHistoryToBackend?: () => Promise<void> | void;
  saveCoverConfig?: () => Promise<void> | void;
  saveTranscript?: (isSilent?: boolean) => Promise<void> | void;
  saveScheduler?: ClipSessionSaveScheduler;
  scheduleSessionSave?: (
    domain: ClipSessionSaveDomain,
    delayMs?: number
  ) => boolean;
  flushSessionSaves?: () => Promise<unknown>;
  hasPendingSessionSaves?: () => boolean;
}

export interface DomainCoverReactivityContext {
  coverEnabled?: Ref<boolean>;
  coverDuration?: Ref<number>;
  coverScreenshotTime?: Ref<number>;
  coverTextOverlays?: Ref<CoverTextOverlay[]>;
  coverXOffset?: Ref<number>;
  saveCoverConfig?: () => Promise<void> | void;
}

export interface DomainAuditorReactivityContext {
  loadBlacklistFromStorage: () => void;
}

export interface DomainTimelineReactivityContext {
  defaultTimelineTextStyle?: Ref<Record<string, any> | null>;
  timelineTracks?: Ref<TimelineTrack[]>;
  timelineUndoStack?: Ref<any[]>;
  timelineRedoStack?: Ref<any[]>;
  isHydratingHistory?: Ref<boolean>;
  hasUnsavedHistory?: Ref<boolean>;
  isSavingHistory?: Ref<boolean>;
  isSavingLocked?: Ref<boolean>;
  isDraggingTimelineItem?: Ref<boolean>;
  saveTimelineTracks?: () => void;
  saveHistoryToBackend?: () => void;
  syncGlobalStylesToItem?: (item: TimelineTrackItem) => void;
}

export interface DomainThumbnailReactivityContext {
  loadDefaultThumbnailStyle?: () => void;
}

export interface DomainSubtitleStyleReactivityContext {
  font?: Ref<string>;
  fontSize?: Ref<number>;
  subtitleFontWeight?: Ref<string | number>;
  subtitleTextTransform?: Ref<string>;
  subtitleTextColor?: Ref<string>;
  subtitleStrokeColor?: Ref<string>;
  subtitleStrokeWidth?: Ref<number>;
  subtitleBackground?: Ref<string>;
  subtitleBackgroundOpacity?: Ref<number>;
  subtitleWordSpacing?: Ref<number>;
  subtitlePreset?: Ref<string>;
  subtitlePosition?: Ref<string>;
  subtitleOffset?: Ref<number>;
  subtitleSyncOffset?: Ref<number>;
  subtitleAnimation?: Ref<string>;
  subtitleHighlightMode?: Ref<string>;
  subtitleHighlightColor?: Ref<string>;
  subtitleMode?: Ref<string>;
  subtitlesEnabled?: Ref<boolean>;
  videoLayout?: Ref<string>;
  landscapeBackground?: Ref<string>;
  landscapeBlurRadius?: Ref<number>;
  landscapeDarkness?: Ref<number>;
  autoAdaptiveSubtitles?: Ref<boolean>;
  cropMode?: Ref<string>;
  cropPercentX?: Ref<number>;
  cropPercentXTop?: Ref<number>;
  cropPercentXBottom?: Ref<number>;
  splitZoomTop?: Ref<number>;
  splitZoomBottom?: Ref<number>;
  splitOffsetXTop?: Ref<number>;
  splitOffsetYTop?: Ref<number>;
  splitOffsetXBottom?: Ref<number>;
  splitOffsetYBottom?: Ref<number>;
  volume?: Ref<number>;
}

export interface WorkspaceReactivityContext {
  // Domain-scoped contexts
  promptRepo?: DomainPromptReactivityContext;
  library?: DomainLibraryReactivityContext;
  editorSession?: DomainEditorSessionReactivityContext;
  auditor?: DomainAuditorReactivityContext;
  timeline?: DomainTimelineReactivityContext;
  thumbnail?: DomainThumbnailReactivityContext;
  cover?: DomainCoverReactivityContext;
  subtitleStyle?: DomainSubtitleStyleReactivityContext;

  // Backward-compatible flat context fields
  selectedPrompt?: Ref<string>;
  extractionMode?: Ref<HookExtractionMode>;
  selectedPresetId?: Ref<HookIntentPreset>;
  focusTopic?: Ref<string>;
  minDuration?: Ref<number>;
  maxDuration?: Ref<number>;
  whisperModel?: Ref<string>;
  language?: Ref<string>;
  lastAccessedVideoId?: Ref<string | null>;
  lastAccessedVideoStored?: Ref<CachedVideo | null>;
  lastAccessedClip?: Ref<LastAccessedClip | null>;

  folderName?: Ref<string | null>;
  clipId?: Ref<string | null>;
  fullTranscript?: Ref<TranscriptSegment[]>;
  jobStatus?: Ref<string>;
  activeHook?: Ref<{
    theme?: string;
    title?: string;
    thumbnail_url?: string;
  } | null>;
  setLastClip?: (
    folder: string,
    clipId: string,
    title?: string,
    thumbnailUrl?: string,
    theme?: string,
    videoTitle?: string
  ) => void;

  loadDefaultThumbnailStyle?: () => void;

  font?: Ref<string>;
  fontSize?: Ref<number>;
  subtitleFontWeight?: Ref<string | number>;
  subtitleTextTransform?: Ref<string>;
  subtitleTextColor?: Ref<string>;
  subtitleStrokeColor?: Ref<string>;
  subtitleStrokeWidth?: Ref<number>;
  subtitleBackground?: Ref<string>;
  subtitleBackgroundOpacity?: Ref<number>;
  subtitleWordSpacing?: Ref<number>;

  subtitlePreset?: Ref<string>;
  subtitlePosition?: Ref<string>;
  subtitleOffset?: Ref<number>;
  subtitleSyncOffset?: Ref<number>;
  subtitleAnimation?: Ref<string>;
  subtitleHighlightMode?: Ref<string>;
  subtitleHighlightColor?: Ref<string>;
  subtitleMode?: Ref<string>;
  subtitlesEnabled?: Ref<boolean>;
  videoLayout?: Ref<string>;
  landscapeBackground?: Ref<string>;
  landscapeBlurRadius?: Ref<number>;
  landscapeDarkness?: Ref<number>;
  autoAdaptiveSubtitles?: Ref<boolean>;
  cropMode?: Ref<string>;
  cropPercentX?: Ref<number>;
  cropPercentXTop?: Ref<number>;
  cropPercentXBottom?: Ref<number>;
  splitZoomTop?: Ref<number>;
  splitZoomBottom?: Ref<number>;
  splitOffsetXTop?: Ref<number>;
  splitOffsetYTop?: Ref<number>;
  splitOffsetXBottom?: Ref<number>;
  splitOffsetYBottom?: Ref<number>;
  volume?: Ref<number>;
  saveStyleSettings?: () => Promise<void> | void;
  saveClipSession?: () => Promise<unknown> | void;
  saveTranscript?: (isSilent?: boolean) => Promise<void> | void;
  saveScheduler?: ClipSessionSaveScheduler;
}

export class WorkspacePersistenceCoordinator {
  public static readonly KEYS = {
    PROMPT: 'yonru_prompt',
    EXTRACTION_MODE: 'yonru_extraction_mode',
    PRESET_ID: 'yonru_preset_id',
    FOCUS_TOPIC: 'yonru_focus_topic',
    MIN_DURATION: 'yonru_min_duration',
    MAX_DURATION: 'yonru_max_duration',
    MODEL: 'yonru_model',
    LANGUAGE: 'yonru_language',
    LAST_VIDEO: 'yonru_last_video',
    LAST_VIDEO_STORED: 'yonru_last_video_stored',
    LAST_CLIP: 'yonru_last_clip',
    DEFAULT_TEXT_STYLE: 'defaultTimelineTextStyle'
  } as const;

  /**
   * Safely loads workspace settings from localStorage.
   */
  public static loadSettings(): WorkspaceSettingsSchema {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {};
    }

    const settings: WorkspaceSettingsSchema = {};

    try {
      const p = localStorage.getItem(this.KEYS.PROMPT);
      if (p) settings.prompt = p;

      const em = localStorage.getItem(
        this.KEYS.EXTRACTION_MODE
      ) as HookExtractionMode | null;
      if (em) settings.extractionMode = em;

      const sp = localStorage.getItem(
        this.KEYS.PRESET_ID
      ) as HookIntentPreset | null;
      if (sp) settings.presetId = sp;

      const ft = localStorage.getItem(this.KEYS.FOCUS_TOPIC);
      if (ft) settings.focusTopic = ft;

      const minD = localStorage.getItem(this.KEYS.MIN_DURATION);
      if (minD) settings.minDuration = parseInt(minD, 10) || 30;

      const maxD = localStorage.getItem(this.KEYS.MAX_DURATION);
      if (maxD) settings.maxDuration = parseInt(maxD, 10) || 180;

      const m = localStorage.getItem(this.KEYS.MODEL);
      if (m) settings.whisperModel = m;

      const lang = localStorage.getItem(this.KEYS.LANGUAGE);
      if (lang) settings.language = lang;

      const lv = localStorage.getItem(this.KEYS.LAST_VIDEO);
      if (lv) settings.lastVideoId = lv;

      const lvs = localStorage.getItem(this.KEYS.LAST_VIDEO_STORED);
      if (lvs) {
        try {
          settings.lastVideoStored = JSON.parse(lvs);
        } catch {
          settings.lastVideoStored = null;
        }
      }

      const lc = localStorage.getItem(this.KEYS.LAST_CLIP);
      if (lc) {
        try {
          settings.lastClip = JSON.parse(lc);
        } catch {
          settings.lastClip = null;
        }
      }

      const savedStyle = localStorage.getItem(this.KEYS.DEFAULT_TEXT_STYLE);
      if (savedStyle) {
        try {
          settings.defaultTimelineTextStyle = JSON.parse(savedStyle);
        } catch {
          settings.defaultTimelineTextStyle = null;
        }
      }
    } catch (e) {
      console.warn(
        '[workspace-persistence] Failed to read localStorage settings:',
        e
      );
    }

    return settings;
  }

  /**
   * Safely writes a single setting into localStorage.
   */
  public static saveSetting(key: string, value: any): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else if (typeof value === 'object') {
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        localStorage.setItem(key, String(value));
      }
    } catch (e) {
      console.warn(
        `[workspace-persistence] Failed to save setting "${key}":`,
        e
      );
    }
  }

  /**
   * Hydrates state refs from storage and sets up all reactive auto-saving watchers
   * and beforeunload handlers. Supports both domain-scoped contexts and legacy flat contexts.
   * Returns an unbind cleanup function.
   */
  public static bindReactivity(ctx: WorkspaceReactivityContext): () => void {
    if (typeof window === 'undefined') {
      return () => {};
    }

    // 1. Resolve Domain-Scoped Contexts with Flat Fallbacks
    const promptRepo: DomainPromptReactivityContext = {
      selectedPrompt: ctx.promptRepo?.selectedPrompt ?? ctx.selectedPrompt,
      extractionMode: ctx.promptRepo?.extractionMode ?? ctx.extractionMode,
      selectedPresetId:
        ctx.promptRepo?.selectedPresetId ?? ctx.selectedPresetId,
      focusTopic: ctx.promptRepo?.focusTopic ?? ctx.focusTopic,
      minDuration: ctx.promptRepo?.minDuration ?? ctx.minDuration,
      maxDuration: ctx.promptRepo?.maxDuration ?? ctx.maxDuration
    };

    const library: DomainLibraryReactivityContext = {
      whisperModel: ctx.library?.whisperModel ?? ctx.whisperModel,
      language: ctx.library?.language ?? ctx.language,
      lastAccessedVideoId:
        ctx.library?.lastAccessedVideoId ?? ctx.lastAccessedVideoId,
      lastAccessedVideoStored:
        ctx.library?.lastAccessedVideoStored ?? ctx.lastAccessedVideoStored,
      lastAccessedClip: ctx.library?.lastAccessedClip ?? ctx.lastAccessedClip,
      setLastClip: ctx.library?.setLastClip ?? ctx.setLastClip
    };

    const editorSession: DomainEditorSessionReactivityContext = {
      folderName: ctx.editorSession?.folderName ?? ctx.folderName,
      clipId: ctx.editorSession?.clipId ?? ctx.clipId,
      fullTranscript: ctx.editorSession?.fullTranscript ?? ctx.fullTranscript,
      saveStyleSettings:
        ctx.editorSession?.saveStyleSettings ?? ctx.saveStyleSettings,
      saveClipSession:
        ctx.editorSession?.saveClipSession ?? ctx.saveClipSession,
      saveTimelineTracks:
        ctx.editorSession?.saveTimelineTracks ??
        ctx.timeline?.saveTimelineTracks,
      saveHistoryToBackend:
        ctx.editorSession?.saveHistoryToBackend ??
        ctx.timeline?.saveHistoryToBackend,
      saveCoverConfig:
        ctx.editorSession?.saveCoverConfig ?? ctx.cover?.saveCoverConfig,
      saveTranscript: ctx.editorSession?.saveTranscript ?? ctx.saveTranscript,
      saveScheduler: ctx.editorSession?.saveScheduler ?? ctx.saveScheduler
    };

    const timeline = ctx.timeline;
    const auditor = ctx.auditor;
    const thumbnail = ctx.thumbnail ?? {
      loadDefaultThumbnailStyle: ctx.loadDefaultThumbnailStyle
    };
    const cover = ctx.cover;

    const subtitleStyle: DomainSubtitleStyleReactivityContext = {
      font: ctx.subtitleStyle?.font ?? ctx.font,
      fontSize: ctx.subtitleStyle?.fontSize ?? ctx.fontSize,
      subtitleFontWeight:
        ctx.subtitleStyle?.subtitleFontWeight ?? ctx.subtitleFontWeight,
      subtitleTextTransform:
        ctx.subtitleStyle?.subtitleTextTransform ?? ctx.subtitleTextTransform,
      subtitleTextColor:
        ctx.subtitleStyle?.subtitleTextColor ?? ctx.subtitleTextColor,
      subtitleStrokeColor:
        ctx.subtitleStyle?.subtitleStrokeColor ?? ctx.subtitleStrokeColor,
      subtitleStrokeWidth:
        ctx.subtitleStyle?.subtitleStrokeWidth ?? ctx.subtitleStrokeWidth,
      subtitleBackground:
        ctx.subtitleStyle?.subtitleBackground ?? ctx.subtitleBackground,
      subtitleBackgroundOpacity:
        ctx.subtitleStyle?.subtitleBackgroundOpacity ??
        ctx.subtitleBackgroundOpacity,
      subtitleWordSpacing:
        ctx.subtitleStyle?.subtitleWordSpacing ?? ctx.subtitleWordSpacing,
      subtitlePreset: ctx.subtitleStyle?.subtitlePreset ?? ctx.subtitlePreset,
      subtitlePosition:
        ctx.subtitleStyle?.subtitlePosition ?? ctx.subtitlePosition,
      subtitleOffset: ctx.subtitleStyle?.subtitleOffset ?? ctx.subtitleOffset,
      subtitleSyncOffset:
        ctx.subtitleStyle?.subtitleSyncOffset ?? ctx.subtitleSyncOffset,
      subtitleAnimation:
        ctx.subtitleStyle?.subtitleAnimation ?? ctx.subtitleAnimation,
      subtitleHighlightMode:
        ctx.subtitleStyle?.subtitleHighlightMode ?? ctx.subtitleHighlightMode,
      subtitleHighlightColor:
        ctx.subtitleStyle?.subtitleHighlightColor ?? ctx.subtitleHighlightColor,
      subtitleMode: ctx.subtitleStyle?.subtitleMode ?? ctx.subtitleMode,
      subtitlesEnabled:
        ctx.subtitleStyle?.subtitlesEnabled ?? ctx.subtitlesEnabled,
      videoLayout: ctx.subtitleStyle?.videoLayout ?? ctx.videoLayout,
      landscapeBackground:
        ctx.subtitleStyle?.landscapeBackground ?? ctx.landscapeBackground,
      landscapeBlurRadius:
        ctx.subtitleStyle?.landscapeBlurRadius ?? ctx.landscapeBlurRadius,
      landscapeDarkness:
        ctx.subtitleStyle?.landscapeDarkness ?? ctx.landscapeDarkness,
      autoAdaptiveSubtitles:
        ctx.subtitleStyle?.autoAdaptiveSubtitles ?? ctx.autoAdaptiveSubtitles,
      cropMode: ctx.subtitleStyle?.cropMode ?? ctx.cropMode,
      cropPercentX: ctx.subtitleStyle?.cropPercentX ?? ctx.cropPercentX,
      cropPercentXTop:
        ctx.subtitleStyle?.cropPercentXTop ?? ctx.cropPercentXTop,
      cropPercentXBottom:
        ctx.subtitleStyle?.cropPercentXBottom ?? ctx.cropPercentXBottom,
      splitZoomTop: ctx.subtitleStyle?.splitZoomTop ?? ctx.splitZoomTop,
      splitZoomBottom:
        ctx.subtitleStyle?.splitZoomBottom ?? ctx.splitZoomBottom,
      splitOffsetXTop:
        ctx.subtitleStyle?.splitOffsetXTop ?? ctx.splitOffsetXTop,
      splitOffsetYTop:
        ctx.subtitleStyle?.splitOffsetYTop ?? ctx.splitOffsetYTop,
      splitOffsetXBottom:
        ctx.subtitleStyle?.splitOffsetXBottom ?? ctx.splitOffsetXBottom,
      splitOffsetYBottom:
        ctx.subtitleStyle?.splitOffsetYBottom ?? ctx.splitOffsetYBottom,
      volume: ctx.subtitleStyle?.volume ?? ctx.volume
    };

    // 2. Hydrate Blacklist & Custom Safety
    if (auditor?.loadBlacklistFromStorage) {
      auditor.loadBlacklistFromStorage();
    }

    // 3. Hydrate Settings into Vue State Refs
    const saved = this.loadSettings();
    if (saved.prompt !== undefined && promptRepo.selectedPrompt) {
      promptRepo.selectedPrompt.value = saved.prompt;
    }
    if (saved.extractionMode !== undefined && promptRepo.extractionMode) {
      promptRepo.extractionMode.value = saved.extractionMode;
    }
    if (saved.presetId !== undefined && promptRepo.selectedPresetId) {
      promptRepo.selectedPresetId.value = saved.presetId;
    }
    if (saved.focusTopic !== undefined && promptRepo.focusTopic) {
      promptRepo.focusTopic.value = saved.focusTopic;
    }
    if (saved.minDuration !== undefined && promptRepo.minDuration) {
      promptRepo.minDuration.value = saved.minDuration;
    }
    if (saved.maxDuration !== undefined && promptRepo.maxDuration) {
      promptRepo.maxDuration.value = saved.maxDuration;
    }
    if (saved.whisperModel !== undefined && library.whisperModel) {
      library.whisperModel.value = saved.whisperModel;
    }
    if (saved.language !== undefined && library.language) {
      library.language.value = saved.language;
    }
    if (saved.lastVideoId !== undefined && library.lastAccessedVideoId) {
      library.lastAccessedVideoId.value = saved.lastVideoId;
    }
    if (
      saved.lastVideoStored !== undefined &&
      saved.lastVideoStored !== null &&
      library.lastAccessedVideoStored
    ) {
      library.lastAccessedVideoStored.value = saved.lastVideoStored;
    }
    if (
      saved.lastClip !== undefined &&
      saved.lastClip !== null &&
      library.lastAccessedClip
    ) {
      library.lastAccessedClip.value = saved.lastClip;
    }
    if (
      saved.defaultTimelineTextStyle !== undefined &&
      saved.defaultTimelineTextStyle !== null &&
      timeline?.defaultTimelineTextStyle
    ) {
      timeline.defaultTimelineTextStyle.value = saved.defaultTimelineTextStyle;
    }

    // 4. Hydrate Default Thumbnail Style
    if (thumbnail?.loadDefaultThumbnailStyle) {
      thumbnail.loadDefaultThumbnailStyle();
    }

    // 5. Setup Reactive Watchers
    const unwatchList: Array<() => void> = [];

    if (promptRepo.selectedPrompt) {
      unwatchList.push(
        watch(promptRepo.selectedPrompt, val =>
          this.saveSetting(this.KEYS.PROMPT, val)
        )
      );
    }
    if (promptRepo.extractionMode) {
      unwatchList.push(
        watch(promptRepo.extractionMode, val =>
          this.saveSetting(this.KEYS.EXTRACTION_MODE, val)
        )
      );
    }
    if (promptRepo.selectedPresetId) {
      unwatchList.push(
        watch(promptRepo.selectedPresetId, val =>
          this.saveSetting(this.KEYS.PRESET_ID, val)
        )
      );
    }
    if (promptRepo.focusTopic) {
      unwatchList.push(
        watch(promptRepo.focusTopic, val =>
          this.saveSetting(this.KEYS.FOCUS_TOPIC, val)
        )
      );
    }
    if (promptRepo.minDuration) {
      unwatchList.push(
        watch(promptRepo.minDuration, val =>
          this.saveSetting(this.KEYS.MIN_DURATION, val)
        )
      );
    }
    if (promptRepo.maxDuration) {
      unwatchList.push(
        watch(promptRepo.maxDuration, val =>
          this.saveSetting(this.KEYS.MAX_DURATION, val)
        )
      );
    }
    if (library.whisperModel) {
      unwatchList.push(
        watch(library.whisperModel, val =>
          this.saveSetting(this.KEYS.MODEL, val)
        )
      );
    }
    if (library.language) {
      unwatchList.push(
        watch(library.language, val =>
          this.saveSetting(this.KEYS.LANGUAGE, val)
        )
      );
    }

    const saveTimelineFn =
      editorSession.saveTimelineTracks ?? timeline?.saveTimelineTracks;
    const saveHistoryFn =
      editorSession.saveHistoryToBackend ?? timeline?.saveHistoryToBackend;
    const saveStyleFn = editorSession.saveStyleSettings;
    const saveCoverFn = editorSession.saveCoverConfig ?? cover?.saveCoverConfig;
    const saveTranscriptFn = editorSession.saveTranscript;

    let localFallbackScheduler: ClipSessionSaveScheduler | null = null;
    const activeScheduler =
      editorSession.saveScheduler ??
      (() => {
        const hasAnySaveFn = Boolean(
          saveTimelineFn ||
          saveHistoryFn ||
          saveStyleFn ||
          saveCoverFn ||
          saveTranscriptFn
        );
        if (!hasAnySaveFn) {
          return null;
        }
        localFallbackScheduler = new ClipSessionSaveScheduler({
          client: {
            patchSession: async (folder, clip, patch) => {
              if (patch.style_settings !== undefined) {
                await saveStyleFn?.();
              }
              if (patch.timeline !== undefined) {
                await saveTimelineFn?.();
              }
              if (patch.cover_config !== undefined) {
                await saveCoverFn?.();
              }
              if (patch.history !== undefined) {
                await saveHistoryFn?.();
              }
              if (patch.transcript !== undefined) {
                await saveTranscriptFn?.(true);
              }
              return { status: 'ok', folder_name: folder, clip_id: clip };
            }
          },
          source: {
            getTarget: () => {
              if (
                !editorSession.folderName?.value ||
                !editorSession.clipId?.value
              ) {
                return null;
              }
              return {
                folderName: editorSession.folderName.value,
                clipId: editorSession.clipId.value
              };
            },
            isLocked: () => Boolean(timeline?.isSavingLocked?.value),
            buildDomainPatch: domains => {
              const patch: Record<string, any> = {};
              if (domains.has('style_settings') && saveStyleFn) {
                patch.style_settings = {};
              }
              if (domains.has('timeline') && saveTimelineFn) {
                patch.timeline = [];
              }
              if (domains.has('cover_config') && saveCoverFn) {
                patch.cover_config = {};
              }
              if (domains.has('history') && saveHistoryFn) {
                patch.history = { undo_stack: [], redo_stack: [] };
              }
              if (domains.has('transcript') && saveTranscriptFn) {
                patch.transcript = [];
              }
              return patch;
            }
          }
        });
        return localFallbackScheduler;
      })();

    // Debounced persistence for timeline tracks (400ms via coalescing scheduler)
    if (
      timeline?.timelineTracks &&
      activeScheduler &&
      (editorSession.saveScheduler || saveTimelineFn)
    ) {
      unwatchList.push(
        watch(
          timeline.timelineTracks,
          () => {
            if (
              timeline.isSavingLocked?.value ||
              timeline.isDraggingTimelineItem?.value
            ) {
              return;
            }
            activeScheduler.markDirty('timeline');
          },
          { deep: true }
        )
      );
    }

    // Debounced persistence for history stacks (1500ms via coalescing scheduler)
    if (
      timeline?.timelineUndoStack &&
      timeline?.timelineRedoStack &&
      (editorSession.saveScheduler || saveHistoryFn)
    ) {
      unwatchList.push(
        watch(
          [
            () => timeline.timelineUndoStack?.value.length ?? 0,
            () => timeline.timelineRedoStack?.value.length ?? 0
          ],
          () => {
            if (
              timeline.isHydratingHistory?.value ||
              timeline.isSavingLocked?.value
            ) {
              return;
            }
            if (
              (timeline.timelineUndoStack?.value.length ?? 0) === 0 &&
              (timeline.timelineRedoStack?.value.length ?? 0) === 0
            ) {
              return;
            }

            if (timeline.hasUnsavedHistory) {
              timeline.hasUnsavedHistory.value = true;
            }
            activeScheduler?.markDirty('history');
          }
        )
      );
    }

    // Global Subtitle Style Syncing to Timeline Text Items
    if (timeline?.timelineTracks && timeline.syncGlobalStylesToItem) {
      const styleSyncRefs = [
        subtitleStyle.font,
        subtitleStyle.fontSize,
        subtitleStyle.subtitleFontWeight,
        subtitleStyle.subtitleTextTransform,
        subtitleStyle.subtitleTextColor,
        subtitleStyle.subtitleStrokeColor,
        subtitleStyle.subtitleStrokeWidth,
        subtitleStyle.subtitleBackground,
        subtitleStyle.subtitleBackgroundOpacity,
        subtitleStyle.subtitleWordSpacing
      ].filter(Boolean) as Array<Ref<any>>;

      if (styleSyncRefs.length > 0) {
        unwatchList.push(
          watch(styleSyncRefs, () => {
            const textTracks = (timeline.timelineTracks?.value || []).filter(
              (t: TimelineTrack) => isTextTrack(t)
            );
            textTracks.forEach((textTrack: TimelineTrack) => {
              textTrack.items.forEach((item: TimelineTrackItem) => {
                if (item.linkToGlobal !== false) {
                  timeline.syncGlobalStylesToItem?.(item);
                }
              });
            });
          })
        );
      }
    }

    // Debounced persistence for subtitle, layout, framing, and audio styles (800ms)
    if (activeScheduler && (editorSession.saveScheduler || saveStyleFn)) {
      const watchedStyleRefs = [
        subtitleStyle.font,
        subtitleStyle.fontSize,
        subtitleStyle.subtitleFontWeight,
        subtitleStyle.subtitleTextTransform,
        subtitleStyle.subtitleTextColor,
        subtitleStyle.subtitleStrokeColor,
        subtitleStyle.subtitleStrokeWidth,
        subtitleStyle.subtitleBackground,
        subtitleStyle.subtitleBackgroundOpacity,
        subtitleStyle.subtitleWordSpacing,
        subtitleStyle.subtitlePreset,
        subtitleStyle.subtitlePosition,
        subtitleStyle.subtitleOffset,
        subtitleStyle.subtitleSyncOffset,
        subtitleStyle.subtitleAnimation,
        subtitleStyle.subtitleHighlightMode,
        subtitleStyle.subtitleHighlightColor,
        subtitleStyle.subtitleMode,
        subtitleStyle.subtitlesEnabled,
        subtitleStyle.videoLayout,
        subtitleStyle.landscapeBackground,
        subtitleStyle.landscapeBlurRadius,
        subtitleStyle.landscapeDarkness,
        subtitleStyle.autoAdaptiveSubtitles,
        subtitleStyle.cropMode,
        subtitleStyle.cropPercentX,
        subtitleStyle.cropPercentXTop,
        subtitleStyle.cropPercentXBottom,
        subtitleStyle.splitZoomTop,
        subtitleStyle.splitZoomBottom,
        subtitleStyle.splitOffsetXTop,
        subtitleStyle.splitOffsetYTop,
        subtitleStyle.splitOffsetXBottom,
        subtitleStyle.splitOffsetYBottom,
        subtitleStyle.volume
      ].filter(Boolean) as Array<Ref<any>>;

      if (watchedStyleRefs.length > 0) {
        unwatchList.push(
          watch(watchedStyleRefs, () => {
            if (timeline?.isSavingLocked?.value) return;
            activeScheduler.markDirty('style_settings');
          })
        );
      }
    }

    // Debounced persistence for Cover Slide configuration (300ms)
    if (
      cover &&
      activeScheduler &&
      (editorSession.saveScheduler || saveCoverFn)
    ) {
      const watchedCoverRefs = [
        cover.coverEnabled,
        cover.coverDuration,
        cover.coverScreenshotTime,
        cover.coverTextOverlays,
        cover.coverXOffset
      ].filter((r): r is NonNullable<typeof r> => Boolean(r));

      if (watchedCoverRefs.length > 0) {
        unwatchList.push(
          watch(
            watchedCoverRefs,
            () => {
              if (timeline?.isSavingLocked?.value) return;
              activeScheduler.markDirty('cover_config');
            },
            { deep: true }
          )
        );
      }
    }

    // Shallow persistence for fullTranscript reference replacements (800ms)
    if (
      editorSession.fullTranscript &&
      activeScheduler &&
      (editorSession.saveScheduler || saveTranscriptFn)
    ) {
      unwatchList.push(
        watch(editorSession.fullTranscript, () => {
          if (timeline?.isSavingLocked?.value) return;
          activeScheduler.markDirty('transcript');
        })
      );
    }

    // 6. BeforeUnload Guard & Coalesced Flush
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeScheduler?.hasPendingWork()) {
        activeScheduler.flush();
      }
      if (
        activeScheduler?.hasPendingWork() ||
        timeline?.hasUnsavedHistory?.value ||
        timeline?.isSavingHistory?.value
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Return unbind cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      localFallbackScheduler?.dispose();
      unwatchList.forEach(unwatch => unwatch());
    };
  }
}
