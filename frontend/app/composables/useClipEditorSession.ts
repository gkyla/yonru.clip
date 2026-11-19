// Composable for managing the clip editor session, transcript editing & sanitization,
// multi-track timeline autosave, style snapshot persistence, and render spec assembly.
import type {
  Hook,
  TranscriptSegment,
  CropMapPoint,
  HistorySnapshot
} from '../types/clipper';
import type { RenderSpec } from '../types/render';
import { resolveApiBase } from '../utils/apiBase';
import {
  ClipSessionClient,
  saveDefaultStyleSettings as saveDefaultStyleSettingsRequest,
  type ClipSessionPatch
} from '../utils/clipSessionClient';
import {
  ClipSessionSaveScheduler,
  type ClipSessionSaveDomain,
  type ClipSessionTarget
} from '../utils/clipSessionSaveScheduler';
import { useAppNotifier } from './useAppNotifier';
import { useCachedLibrary } from './useCachedLibrary';
import { useTimelineState } from './useTimelineState';
import { useSubtitleStyle } from './useSubtitleStyle';
import { useSafetyAuditor } from './useSafetyAuditor';
import { useClipperCover } from './useClipperCover';
import { useClipperExport } from './useClipperExport';

/**
 * Sanitizes transcript segments by ensuring numeric start/duration
 * and stripping non-serializable circular references (such as flatWords, parent pointers, etc.)
 */
export function sanitizeTranscript(
  transcript: TranscriptSegment[]
): TranscriptSegment[] {
  if (!Array.isArray(transcript)) return [];
  return transcript.map(seg => {
    const cleanSeg: TranscriptSegment = {
      text: typeof seg.text === 'string' ? seg.text : String(seg.text || ''),
      start:
        typeof seg.start === 'string'
          ? parseFloat(seg.start) || 0
          : typeof seg.start === 'number' && !isNaN(seg.start)
            ? seg.start
            : 0,
      duration:
        typeof seg.duration === 'string'
          ? parseFloat(seg.duration) || 0
          : typeof seg.duration === 'number' && !isNaN(seg.duration)
            ? seg.duration
            : 0
    };

    if (seg.id !== undefined && seg.id !== null) {
      cleanSeg.id = String(seg.id);
    }
    if (seg.rawText !== undefined && seg.rawText !== null) {
      cleanSeg.rawText = String(seg.rawText);
    }

    if (Array.isArray(seg.words)) {
      cleanSeg.words = seg.words.map(w => ({
        text: typeof w.text === 'string' ? w.text : String(w.text || ''),
        start:
          typeof w.start === 'string'
            ? parseFloat(w.start as any) || 0
            : typeof w.start === 'number' && !isNaN(w.start)
              ? w.start
              : 0,
        duration:
          typeof w.duration === 'string'
            ? parseFloat(w.duration as any) || 0
            : typeof w.duration === 'number' && !isNaN(w.duration)
              ? w.duration
              : 0,
        ...(w.end !== undefined
          ? {
              end:
                typeof w.end === 'string'
                  ? parseFloat(w.end as any) || 0
                  : typeof w.end === 'number' && !isNaN(w.end)
                    ? w.end
                    : 0
            }
          : {}),
        ...(w.rawText !== undefined ? { rawText: String(w.rawText) } : {}),
        ...(w.isMasked !== undefined ? { isMasked: Boolean(w.isMasked) } : {})
      }));
    }

    return cleanSeg;
  });
}

export interface ClipEditorSessionDependencies {
  notifier?: ReturnType<typeof useAppNotifier>;
  library?: ReturnType<typeof useCachedLibrary>;
  timeline?: ReturnType<typeof useTimelineState>;
  subtitleStyle?: ReturnType<typeof useSubtitleStyle>;
  auditor?: ReturnType<typeof useSafetyAuditor>;
  job?: ReturnType<typeof useClipperJob>;
  coverState?: ReturnType<typeof useClipperCover>;
  thumbnailState?: ReturnType<typeof useClipperCover>;
  exportState?: ReturnType<typeof useClipperExport>;
  sessionClient?: Pick<ClipSessionClient, 'patchSession'>;
}

export const useClipEditorSession = (
  deps: ClipEditorSessionDependencies = {}
) => {
  const API_BASE = resolveApiBase();

  // Injected dependencies with lazy/default fallbacks
  const notifier = deps.notifier ?? useAppNotifier();
  const library = deps.library ?? useCachedLibrary();
  const timeline = deps.timeline ?? useTimelineState();
  const subtitleStyle = deps.subtitleStyle ?? useSubtitleStyle();
  const auditor = deps.auditor ?? useSafetyAuditor();
  const job = deps.job ?? useClipperJob();
  const coverState =
    deps.coverState ?? deps.thumbnailState ?? useClipperCover();
  const thumbnailState = coverState;
  const exportState = deps.exportState ?? useClipperExport();

  // Active clip & editor session state
  const folderName = useState<string | null>('folderName', () => null);
  const clipId = useState<string | null>('clipId', () => null);
  const fullTranscript = useState<TranscriptSegment[]>(
    'fullTranscript',
    () => []
  );
  const hooks = useState<Hook[]>('hooks', () => []);
  const activeHook = useState<Hook | null>('activeHook', () => null);
  const videoFps = useState<number>('videoFps', () => 30);
  const volume = subtitleStyle?.volume ?? useState<number>('volume', () => 0.5);
  const cropMode =
    subtitleStyle?.cropMode ??
    useState<string>('cropMode', () => 'face_tracking');
  const cropMap =
    subtitleStyle?.cropMap ??
    useState<Array<CropMapPoint>>('cropMap', () => []);
  const subtitlesEnabled =
    subtitleStyle?.subtitlesEnabled ??
    useState<boolean>('subtitlesEnabled', () => true);
  const autoAdaptiveSubtitles =
    subtitleStyle?.autoAdaptiveSubtitles ??
    useState<boolean>('autoAdaptiveSubtitles', () => true);
  const isSessionSaving = useState<boolean>('isSessionSaving', () => false);

  const sessionClient = deps.sessionClient ?? new ClipSessionClient(API_BASE);

  let lastFlushedHistoryMeta: {
    folder: string;
    clip: string;
    undoRef: HistorySnapshot[];
    undoLen: number;
    undoTop: HistorySnapshot | undefined;
    redoRef: HistorySnapshot[];
    redoLen: number;
    redoTop: HistorySnapshot | undefined;
  } | null = null;

  function buildCoverConfigPayload() {
    return {
      enabled: coverState?.coverEnabled?.value ?? false,
      duration: coverState?.coverDuration?.value ?? 1.0,
      screenshotTime: coverState?.coverScreenshotTime?.value ?? 0,
      textOverlays: coverState?.coverTextOverlays?.value || [],
      xOffset: coverState?.coverXOffset?.value ?? 50
    };
  }

  function buildDomainPatch(
    domains: ReadonlySet<ClipSessionSaveDomain>
  ): ClipSessionPatch {
    const patch: ClipSessionPatch = {};

    if (domains.has('transcript')) {
      patch.transcript = sanitizeTranscript(fullTranscript.value || []);
    }
    if (domains.has('style_settings')) {
      patch.style_settings = subtitleStyle?.getStyleSnapshot?.() ?? {};
    }
    if (
      domains.has('timeline') &&
      timeline.timelineTracks?.value !== undefined
    ) {
      patch.timeline = timeline.timelineTracks.value;
    }
    if (domains.has('cover_config')) {
      patch.cover_config = buildCoverConfigPayload();
    }
    if (domains.has('history')) {
      patch.history = {
        undo_stack: timeline.timelineUndoStack?.value ?? [],
        redo_stack: timeline.timelineRedoStack?.value ?? []
      };
    }

    return patch;
  }

  const saveScheduler = new ClipSessionSaveScheduler({
    client: sessionClient,
    source: {
      getTarget: (): ClipSessionTarget | null => {
        if (!folderName.value || !clipId.value) return null;
        return { folderName: folderName.value, clipId: clipId.value };
      },
      buildDomainPatch,
      isLocked: () => Boolean(timeline.isSavingLocked?.value),
      onPendingStateChange: pending => {
        isSessionSaving.value = pending;
      },
      onBeforePatch: domains => {
        if (domains.has('history') && timeline.isSavingHistory) {
          timeline.isSavingHistory.value = true;
        }
      },
      onAfterPatch: (domains, target, ok, error) => {
        if (domains.has('history')) {
          if (ok) {
            if (timeline.hasUnsavedHistory) {
              timeline.hasUnsavedHistory.value = false;
            }
            const undoStack = timeline.timelineUndoStack?.value ?? [];
            const redoStack = timeline.timelineRedoStack?.value ?? [];
            lastFlushedHistoryMeta = {
              folder: target.folderName,
              clip: target.clipId,
              undoRef: undoStack,
              undoLen: undoStack.length,
              undoTop: undoStack[undoStack.length - 1],
              redoRef: redoStack,
              redoLen: redoStack.length,
              redoTop: redoStack[redoStack.length - 1]
            };
          } else {
            console.error('[timeline] Failed to save history:', error);
          }
          if (timeline.isSavingHistory) {
            timeline.isSavingHistory.value = false;
          }
        }
        if (!ok && domains.has('timeline')) {
          console.error('[clipper] Failed to save timeline tracks:', error);
        }
      }
    }
  });

  async function loadReadyClipIntoEditor(folder: string, id: string) {
    await job.loadReadyClipIntoEditor(folder, id);
    const parentVideo = library.cachedVideos.value.find(
      v => v.folder_name === folder || v.video_id === folder
    );
    const videoTitle = parentVideo?.title;
    const theme =
      activeHook.value?.theme || activeHook.value?.title || 'Current Clip';
    library.setLastClip(
      folder,
      id,
      theme,
      activeHook.value?.thumbnail_url,
      theme,
      videoTitle
    );
  }

  // Flush pending dirty domains & undo/redo history once per clip switch before stacks clear
  watch(
    [folderName, clipId],
    (_newVal, oldVal) => {
      const [oldFolder, oldClip] = oldVal || [null, null];
      if (!oldFolder || !oldClip) {
        saveScheduler.cancelPending();
        return;
      }

      const oldTarget: ClipSessionTarget = {
        folderName: oldFolder,
        clipId: oldClip
      };
      const dirtyDomains = saveScheduler.hasDirtyDomains(oldTarget)
        ? new Set<ClipSessionSaveDomain>(saveScheduler.getDirtyDomains())
        : new Set<ClipSessionSaveDomain>();

      const undoStack = timeline.timelineUndoStack?.value ?? [];
      const redoStack = timeline.timelineRedoStack?.value ?? [];
      const hasHistoryItems = undoStack.length > 0 || redoStack.length > 0;
      const alreadyFlushedSameHistory =
        lastFlushedHistoryMeta !== null &&
        lastFlushedHistoryMeta.folder === oldFolder &&
        lastFlushedHistoryMeta.clip === oldClip &&
        lastFlushedHistoryMeta.undoRef === undoStack &&
        lastFlushedHistoryMeta.undoLen === undoStack.length &&
        lastFlushedHistoryMeta.undoTop === undoStack[undoStack.length - 1] &&
        lastFlushedHistoryMeta.redoRef === redoStack &&
        lastFlushedHistoryMeta.redoLen === redoStack.length &&
        lastFlushedHistoryMeta.redoTop === redoStack[redoStack.length - 1];

      if (hasHistoryItems && !alreadyFlushedSameHistory) {
        dirtyDomains.add('history');
      }

      if (dirtyDomains.size > 0) {
        const frozenPatch = buildDomainPatch(dirtyDomains);
        if (frozenPatch.history) {
          frozenPatch.history = {
            undo_stack: [...undoStack],
            redo_stack: [...redoStack]
          };
        }
        if (hasHistoryItems) {
          if (timeline.timelineUndoStack) timeline.timelineUndoStack.value = [];
          if (timeline.timelineRedoStack) timeline.timelineRedoStack.value = [];
          if (timeline.hasUnsavedHistory) {
            timeline.hasUnsavedHistory.value = false;
          }
        }
        saveScheduler.cancelPending();
        saveScheduler.enqueueFrozenPatch(oldTarget, frozenPatch, dirtyDomains);
      } else {
        saveScheduler.cancelPending();
      }
    },
    { flush: 'sync' }
  );

  function scheduleSessionSave(
    domain: ClipSessionSaveDomain,
    delayMs?: number
  ) {
    return saveScheduler.markDirty(
      domain,
      delayMs !== undefined ? { delayMs } : undefined
    );
  }

  function flushSessionSaves() {
    return saveScheduler.flush();
  }

  function hasPendingSessionSaves() {
    return saveScheduler.hasPendingWork();
  }

  async function saveTranscript(isSilent = false) {
    if (!folderName.value || !fullTranscript.value || !clipId.value) return;
    const silent = isSilent === true;

    try {
      await saveScheduler.saveNow(['transcript'], { throwOnError: true });
      if (!silent) {
        notifier.showToast('Edits saved successfully!', 'success');
      }
    } catch {
      if (!silent) {
        notifier.showToast('Failed to save edits', 'error');
      }
    }
  }

  async function saveClipSession(
    customPayload?: Partial<ClipSessionPatch>,
    isSilent = false
  ) {
    if (!folderName.value || !clipId.value) return;
    const silent = isSilent === true;

    const cleanTranscript = sanitizeTranscript(fullTranscript.value || []);

    const defaultPayload: ClipSessionPatch = {
      transcript: cleanTranscript,
      style_settings: subtitleStyle?.getStyleSnapshot?.() ?? {},
      timeline: timeline.timelineTracks?.value ?? [],
      cover_config: buildCoverConfigPayload(),
      history: {
        undo_stack: timeline.timelineUndoStack?.value ?? [],
        redo_stack: timeline.timelineRedoStack?.value ?? []
      },
      ...(cropMap.value?.length > 0 ? { crop_map: cropMap.value } : {})
    };

    const payload: ClipSessionPatch = customPayload
      ? { ...defaultPayload, ...customPayload }
      : defaultPayload;

    try {
      const res = await saveScheduler.saveNow(
        ['transcript', 'style_settings', 'timeline', 'cover_config', 'history'],
        { customPatch: payload, throwOnError: true }
      );
      if (!silent) {
        notifier.showToast('Edits saved successfully!', 'success');
      }
      return res;
    } catch (e) {
      if (!silent) {
        notifier.showToast('Failed to save clip session', 'error');
      }
      throw e;
    }
  }

  async function updateHooks() {
    if (!folderName.value || !hooks.value) return;
    try {
      await $fetch(`${API_BASE}/api/hooks`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          hooks: hooks.value
        }
      });
      notifier.showToast('Hook names updated', 'success');
    } catch {
      notifier.showToast('Failed to update hook names', 'error');
    }
  }

  async function saveStyleSettings() {
    if (!folderName.value || !clipId.value) return;
    try {
      await saveScheduler.saveNow(['style_settings']);
    } catch {}
  }

  async function saveTimelineTracks() {
    if (timeline.isSavingLocked?.value) {
      return;
    }
    if (!folderName.value || !clipId.value) return;
    await saveScheduler.saveNow(['timeline']);
  }

  async function saveHistoryToBackend(
    targetFolder?: string,
    targetClip?: string,
    stacksOverride?: {
      undo_stack: HistorySnapshot[];
      redo_stack: HistorySnapshot[];
    }
  ) {
    const folder = targetFolder ?? folderName.value;
    const clip = targetClip ?? clipId.value;
    if (!folder || !clip) return;
    await saveScheduler.saveNow(['history'], {
      targetOverride: { folderName: folder, clipId: clip },
      ...(stacksOverride ? { customPatch: { history: stacksOverride } } : {})
    });
  }

  async function saveCoverConfig() {
    if (!folderName.value || !clipId.value) return;
    try {
      await saveScheduler.saveNow(['cover_config']);
    } catch {}
  }

  function toggleSubtitles() {
    subtitlesEnabled.value = !subtitlesEnabled.value;
    scheduleSessionSave('style_settings');
  }

  async function saveDefaultStyleSettings() {
    try {
      await saveDefaultStyleSettingsRequest(
        subtitleStyle?.getStyleSnapshot?.() ?? {},
        { apiBase: API_BASE }
      );
    } catch {}
  }

  function applyPreset(
    presetOrId: Parameters<typeof subtitleStyle.applyPreset>[0]
  ) {
    subtitleStyle.applyPreset(presetOrId);
    scheduleSessionSave('style_settings');
  }

  function buildRenderSpec(hookIndex = 0, outputName?: string): RenderSpec {
    return {
      jobId: job.jobId.value || '',
      hookIndex,
      outputName,
      fps: videoFps.value,
      volume: volume.value,
      videoLayout: subtitleStyle.videoLayout.value,
      cropMode: subtitleStyle.cropMode.value,
      cropPercentX: subtitleStyle.cropPercentX.value,
      splitZoomTop: subtitleStyle.splitZoomTop.value,
      splitZoomBottom: subtitleStyle.splitZoomBottom.value,
      splitOffsetXTop: subtitleStyle.splitOffsetXTop.value,
      splitOffsetYTop: subtitleStyle.splitOffsetYTop.value,
      splitOffsetXBottom: subtitleStyle.splitOffsetXBottom.value,
      splitOffsetYBottom: subtitleStyle.splitOffsetYBottom.value,
      subtitlePayload: subtitleStyle.toRenderPayload(),
      timelineTracks: timeline.timelineTracks.value,
      transcript: fullTranscript.value || [],
      cover: {
        enabled: coverState.coverEnabled.value ?? false,
        duration: coverState.coverDuration.value ?? 1.0,
        screenshotTime: coverState.coverScreenshotTime.value ?? 0,
        textOverlays: coverState.coverTextOverlays.value || [],
        xOffset: coverState.coverXOffset.value ?? 50
      },
      safety: {
        audioBleepEnabled: auditor.audioBleepEnabled.value,
        audioBleepSource: auditor.audioBleepSource.value,
        customBleepFile: auditor.customBleepFile.value,
        censoredSegments: auditor.contentAudit.value?.flaggedSegments || [],
        bleepPaddingOffset: auditor.bleepPaddingOffset.value,
        bleepMode: auditor.bleepMode.value,
        safetySensitivity: auditor.safetySensitivity.value,
        maskingStyle: auditor.maskingStyle.value
      }
    };
  }

  async function renderClip(hookIndex = 0, outputName?: string) {
    if (!job.jobId.value) {
      exportState.renderStatus.value = 'error';
      job.jobError.value =
        'No active job ID found for render. Please reload the clip.';
      return;
    }

    try {
      if (folderName.value && clipId.value) {
        await saveClipSession(undefined, true);
      }

      const spec = buildRenderSpec(hookIndex, outputName);
      await exportState.exportClip(spec);
    } catch (e: unknown) {
      exportState.renderStatus.value = 'error';
      job.jobError.value =
        e instanceof Error ? e.message : 'Render initiation failed';
    }
  }

  function undo() {
    const res = timeline.undo() as
      | { transcriptChanged?: boolean; tracksChanged?: boolean }
      | undefined
      | null;
    if (!res || res.transcriptChanged !== false) {
      scheduleSessionSave('transcript');
    }
  }

  function redo() {
    const res = timeline.redo() as
      | { transcriptChanged?: boolean; tracksChanged?: boolean }
      | undefined
      | null;
    if (!res || res.transcriptChanged !== false) {
      scheduleSessionSave('transcript');
    }
  }

  function resetSession() {
    saveScheduler.cancelPending();
    lastFlushedHistoryMeta = null;
    folderName.value = null;
    clipId.value = null;
    hooks.value = [];
    activeHook.value = null;
    fullTranscript.value = [];
    cropMap.value = [];
  }

  return {
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
    saveScheduler,
    scheduleSessionSave,
    flushSessionSaves,
    hasPendingSessionSaves,
    loadReadyClipIntoEditor,
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
    redo,
    resetSession
  };
};
