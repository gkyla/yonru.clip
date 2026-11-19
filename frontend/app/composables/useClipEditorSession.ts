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
  patchSession,
  type ClipSessionPatch
} from '../utils/clipSessionClient';
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
  const volume = useState<number>('volume', () => 0.5);
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

  // Flush undo/redo history once per clip switch before stacks clear
  watch(
    [folderName, clipId],
    (_newVal, oldVal) => {
      const [oldFolder, oldClip] = oldVal || [null, null];
      const undoLen = timeline.timelineUndoStack?.value?.length ?? 0;
      const redoLen = timeline.timelineRedoStack?.value?.length ?? 0;
      if (oldFolder && oldClip && (undoLen > 0 || redoLen > 0)) {
        const snapshot = {
          undo_stack: [...(timeline.timelineUndoStack?.value ?? [])],
          redo_stack: [...(timeline.timelineRedoStack?.value ?? [])]
        };
        if (timeline.timelineUndoStack) timeline.timelineUndoStack.value = [];
        if (timeline.timelineRedoStack) timeline.timelineRedoStack.value = [];
        if (timeline.hasUnsavedHistory)
          timeline.hasUnsavedHistory.value = false;
        saveHistoryToBackend(oldFolder, oldClip, snapshot);
      }
    },
    { flush: 'sync' }
  );

  function buildCoverConfigPayload() {
    return {
      enabled: coverState.coverEnabled.value ?? false,
      duration: coverState.coverDuration.value ?? 1.0,
      screenshotTime: coverState.coverScreenshotTime.value ?? 0,
      textOverlays: coverState.coverTextOverlays.value || [],
      xOffset: coverState.coverXOffset.value ?? 50
    };
  }

  async function saveTranscript(isSilent = false) {
    if (!folderName.value || !fullTranscript.value || !clipId.value) return;
    const silent = isSilent === true;

    const cleanTranscript = sanitizeTranscript(fullTranscript.value);

    try {
      await patchSession(folderName.value, clipId.value, {
        transcript: cleanTranscript
      });
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
      style_settings: subtitleStyle.getStyleSnapshot(),
      timeline: timeline.timelineTracks.value,
      cover_config: buildCoverConfigPayload(),
      history: {
        undo_stack: timeline.timelineUndoStack.value,
        redo_stack: timeline.timelineRedoStack.value
      },
      ...(cropMap.value?.length > 0 ? { crop_map: cropMap.value } : {})
    };

    const payload: ClipSessionPatch = customPayload
      ? { ...defaultPayload, ...customPayload }
      : defaultPayload;

    try {
      const res = await patchSession(folderName.value, clipId.value, payload);
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
      await patchSession(folderName.value, clipId.value, {
        style_settings: subtitleStyle.getStyleSnapshot()
      });
    } catch {}
  }

  async function saveTimelineTracks() {
    if (timeline.isSavingLocked?.value) {
      return;
    }
    if (!folderName.value || !clipId.value) return;
    try {
      await patchSession(folderName.value, clipId.value, {
        timeline: timeline.timelineTracks.value
      });
    } catch (e) {
      console.error('[clipper] Failed to save timeline tracks:', e);
    }
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
    if (timeline.isSavingHistory) {
      timeline.isSavingHistory.value = true;
    }
    try {
      await patchSession(folder, clip, {
        history: stacksOverride ?? {
          undo_stack: timeline.timelineUndoStack.value,
          redo_stack: timeline.timelineRedoStack.value
        }
      });
      if (timeline.hasUnsavedHistory) {
        timeline.hasUnsavedHistory.value = false;
      }
    } catch (e) {
      console.error('[timeline] Failed to save history:', e);
    } finally {
      if (timeline.isSavingHistory) {
        timeline.isSavingHistory.value = false;
      }
    }
  }

  async function saveCoverConfig() {
    if (!folderName.value || !clipId.value) return;
    try {
      await patchSession(folderName.value, clipId.value, {
        cover_config: buildCoverConfigPayload()
      });
    } catch {}
  }

  async function toggleSubtitles() {
    subtitlesEnabled.value = !subtitlesEnabled.value;
    await saveStyleSettings();
  }

  async function saveDefaultStyleSettings() {
    try {
      await $fetch(`${API_BASE}/api/default-style-settings`, {
        method: 'PUT',
        body: { settings: subtitleStyle.getStyleSnapshot() }
      });
    } catch {}
  }

  function applyPreset(
    presetOrId: Parameters<typeof subtitleStyle.applyPreset>[0]
  ) {
    subtitleStyle.applyPreset(presetOrId);
    saveStyleSettings();
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
      saveTranscript(true);
    }
  }

  function redo() {
    const res = timeline.redo() as
      | { transcriptChanged?: boolean; tracksChanged?: boolean }
      | undefined
      | null;
    if (!res || res.transcriptChanged !== false) {
      saveTranscript(true);
    }
  }

  function resetSession() {
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
