// useTimelineState.ts - Extracted timeline tracks and duration sequencing logic
import { nextTick } from 'vue';
import {
  calculateTimelineDuration,
  calculateVideoTime,
  fromGlobalTimelineStart,
  isAudioTrack,
  resolveCoverOffsetSec
} from '../utils/timelineHelpers';
import {
  TimelineTransactionEngine,
  areTranscriptsEqual
} from '../utils/timelineHistory';
import type {
  TimelineTrack,
  TimelineTrackItem,
  TranscriptSegment,
  HistorySnapshot
} from '../types/clipper';

export const useTimelineState = () => {
  const historyManager = new TimelineTransactionEngine(50);
  const API_BASE = resolveApiBase();

  const timelineTracks = useState<TimelineTrack[]>('timelineTracks', () => [
    { id: 'video', name: 'Main Video', type: 'video', items: [] },
    { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
    { id: 'text', name: 'Text layers', type: 'text', items: [] }
  ]);
  const defaultTimelineTextStyle = useState<Partial<TimelineTrackItem> | null>(
    'defaultTimelineTextStyle',
    () => null
  );
  const selectedTimelineItem = useState<TimelineTrackItem | null>(
    'selectedTimelineItem',
    () => null
  );
  const isSavingLocked = useState<boolean>('isSavingLocked', () => false);
  const isTimelineShifting = useState<boolean>(
    'isTimelineShifting',
    () => false
  );
  const isDraggingTimelineItem = useState<boolean>(
    'isDraggingTimelineItem',
    () => false
  );

  // External states synced globally via useState
  const coverEnabled = useState<boolean>('coverEnabled', () => false);
  const coverDuration = useState<number>('coverDuration', () => 1.0);
  const videoDuration = useState<number>('videoDuration');
  const currentTime = useState<number>('currentTime');
  const folderName = useState<string | null>('folderName');
  const clipId = useState<string | null>('clipId');
  const fullTranscript = useState<TranscriptSegment[]>(
    'fullTranscript',
    () => []
  );

  // History state for undo/redo
  const timelineUndoStack = useState<HistorySnapshot[]>(
    'timelineUndoStack',
    () => []
  );
  const timelineRedoStack = useState<HistorySnapshot[]>(
    'timelineRedoStack',
    () => []
  );
  const isSavingHistory = useState<boolean>('isSavingHistory', () => false);
  const hasUnsavedHistory = useState<boolean>('hasUnsavedHistory', () => false);
  const isHydratingHistory = useState<boolean>(
    'isHydratingHistory',
    () => false
  );
  const syncedAudioPayloads = useState<Record<string, boolean>>(
    'syncedAudioPayloads',
    () => ({})
  );

  function stripHeavyMediaFromSnapshots(
    snapshots: HistorySnapshot[]
  ): HistorySnapshot[] {
    return (snapshots || []).map(snap => ({
      ...snap,
      tracks: (snap.tracks || []).map(track => ({
        ...track,
        items: (track.items || []).map(item => {
          if (typeof item.src === 'string' && item.src.startsWith('data:')) {
            const { src: _omitted, ...rest } = item;
            return rest as TimelineTrackItem;
          }
          return item;
        })
      }))
    }));
  }

  function rehydrateMediaInSnapshots(
    snapshots: HistorySnapshot[],
    currentTracks: TimelineTrack[]
  ): HistorySnapshot[] {
    const srcById = new Map<string, string | ArrayBuffer>();
    const srcByName = new Map<string, string | ArrayBuffer>();
    for (const track of currentTracks || []) {
      for (const item of track.items || []) {
        if (item.src) {
          srcById.set(item.id, item.src);
          if (item.name) srcByName.set(item.name, item.src);
        }
      }
    }
    if (srcById.size === 0) return snapshots;
    return (snapshots || []).map(snap => ({
      ...snap,
      tracks: (snap.tracks || []).map(track => ({
        ...track,
        items: (track.items || []).map(item => {
          if (!item.src && (track.id === 'audio' || item.type === 'audio')) {
            const matchedSrc =
              srcById.get(item.id) ||
              (item.name ? srcByName.get(item.name) : undefined);
            if (matchedSrc) {
              return { ...item, src: matchedSrc };
            }
          }
          return item;
        })
      }))
    }));
  }

  // Isolate history to specific hook/clip — save before clearing (option A)
  watch([folderName, clipId], async (_newVal, oldVal) => {
    const [oldFolder, oldClip] = oldVal || [null, null];
    // Save current stacks to backend for the old clip before clearing
    if (
      oldFolder &&
      oldClip &&
      (timelineUndoStack.value.length > 0 || timelineRedoStack.value.length > 0)
    ) {
      try {
        await $fetch(
          `${API_BASE}/api/clip-session/${encodeURIComponent(oldFolder)}/${encodeURIComponent(oldClip)}`,
          {
            method: 'PUT',
            body: {
              undo_stack: stripHeavyMediaFromSnapshots(timelineUndoStack.value),
              redo_stack: stripHeavyMediaFromSnapshots(timelineRedoStack.value),
              _compact: true
            }
          }
        );
      } catch (e) {
        console.error(
          '[timeline] Failed to save history before clip switch:',
          e
        );
      }
    }
    isHydratingHistory.value = true;
    timelineUndoStack.value = [];
    timelineRedoStack.value = [];
    hasUnsavedHistory.value = false;
    nextTick(() => {
      isHydratingHistory.value = false;
    });
  });

  const canUndo = computed(() => timelineUndoStack.value.length > 0);
  const canRedo = computed(() => timelineRedoStack.value.length > 0);

  function commitToHistory() {
    historyManager.commit(
      timelineUndoStack.value,
      timelineRedoStack.value,
      timelineTracks.value,
      fullTranscript.value,
      selectedTimelineItem.value?.id || null
    );
  }

  function undo(): {
    transcriptChanged: boolean;
    tracksChanged: boolean;
  } | null {
    const previousState = historyManager.undo(
      timelineUndoStack.value,
      timelineRedoStack.value,
      timelineTracks.value,
      fullTranscript.value,
      selectedTimelineItem.value?.id || null
    );
    if (previousState) {
      const transcriptChanged = !areTranscriptsEqual(
        fullTranscript.value,
        previousState.transcript
      );
      timelineTracks.value = previousState.tracks;
      if (transcriptChanged) {
        fullTranscript.value = previousState.transcript;
      }
      if (previousState.selectedId) {
        const item = previousState.tracks
          .flatMap((t: TimelineTrack) => t.items)
          .find((i: TimelineTrackItem) => i.id === previousState.selectedId);
        selectedTimelineItem.value = item || null;
      } else {
        selectedTimelineItem.value = null;
      }
      return { transcriptChanged, tracksChanged: true };
    }
    return null;
  }

  function redo(): {
    transcriptChanged: boolean;
    tracksChanged: boolean;
  } | null {
    const nextState = historyManager.redo(
      timelineUndoStack.value,
      timelineRedoStack.value,
      timelineTracks.value,
      fullTranscript.value,
      selectedTimelineItem.value?.id || null
    );
    if (nextState) {
      const transcriptChanged = !areTranscriptsEqual(
        fullTranscript.value,
        nextState.transcript
      );
      timelineTracks.value = nextState.tracks;
      if (transcriptChanged) {
        fullTranscript.value = nextState.transcript;
      }
      if (nextState.selectedId) {
        const item = nextState.tracks
          .flatMap((t: TimelineTrack) => t.items)
          .find((i: TimelineTrackItem) => i.id === nextState.selectedId);
        selectedTimelineItem.value = item || null;
      } else {
        selectedTimelineItem.value = null;
      }
      return { transcriptChanged, tracksChanged: true };
    }
    return null;
  }

  async function saveHistoryToBackend() {
    if (!folderName.value || !clipId.value) return;
    isSavingHistory.value = true;
    try {
      await $fetch(
        `${API_BASE}/api/clip-session/${encodeURIComponent(folderName.value)}/${encodeURIComponent(clipId.value)}`,
        {
          method: 'PUT',
          body: {
            undo_stack: stripHeavyMediaFromSnapshots(timelineUndoStack.value),
            redo_stack: stripHeavyMediaFromSnapshots(timelineRedoStack.value),
            _compact: true
          }
        }
      );
      hasUnsavedHistory.value = false;
      console.log('[timeline] Saved history to backend');
    } catch (e) {
      console.error('[timeline] Failed to save history:', e);
    } finally {
      isSavingHistory.value = false;
    }
  }

  function loadHistoryFromResponse(
    historyData: {
      undo_stack?: HistorySnapshot[];
      redo_stack?: HistorySnapshot[];
    } | null
  ) {
    if (historyData && typeof historyData === 'object') {
      isHydratingHistory.value = true;
      timelineUndoStack.value = rehydrateMediaInSnapshots(
        historyData.undo_stack || [],
        timelineTracks.value
      );
      timelineRedoStack.value = rehydrateMediaInSnapshots(
        historyData.redo_stack || [],
        timelineTracks.value
      );
      hasUnsavedHistory.value = false;
      nextTick(() => {
        isHydratingHistory.value = false;
      });
      console.log(
        `[timeline] Hydrated history: ${timelineUndoStack.value.length} undo, ${timelineRedoStack.value.length} redo`
      );
    }
  }

  const timelineDuration = computed(() => {
    return calculateTimelineDuration(
      timelineTracks.value,
      coverEnabled.value,
      coverDuration.value,
      videoDuration.value
    );
  });

  const videoTime = computed(() => {
    return calculateVideoTime(
      currentTime.value,
      coverEnabled.value,
      coverDuration.value,
      timelineTracks.value
    );
  });

  async function saveTimelineTracks() {
    if (isSavingLocked.value) {
      console.log('[clipper] saveTimelineTracks BLOCKED (lock active)');
      return;
    }
    if (!folderName.value || !clipId.value) return;

    const currentFolder = folderName.value;
    const currentClip = clipId.value;
    const newlySyncedKeys: string[] = [];

    const payloadTracks = (timelineTracks.value || []).map(track => ({
      ...track,
      items: (track.items || []).map(item => {
        if (typeof item.src === 'string' && item.src.startsWith('data:')) {
          const cacheKey = `${currentFolder}/${currentClip}/${item.id}:${item.src.length}`;
          if (syncedAudioPayloads.value[cacheKey]) {
            return { ...item, src: '__cached_src__' };
          }
          newlySyncedKeys.push(cacheKey);
        }
        return item;
      })
    }));

    console.log(
      '[clipper] saveTimelineTracks triggered for:',
      currentFolder,
      currentClip
    );

    try {
      await $fetch(
        `${API_BASE}/api/clip-session/${encodeURIComponent(currentFolder)}/${encodeURIComponent(currentClip)}`,
        {
          method: 'PUT',
          body: {
            timeline_tracks: payloadTracks,
            _compact: true
          }
        }
      );
      for (const k of newlySyncedKeys) {
        syncedAudioPayloads.value[k] = true;
      }
      console.log('[clipper] Saved timeline tracks successfully');
    } catch (e) {
      console.error('[clipper] Failed to save timeline tracks:', e);
    }
  }

  function getGlobalStyleSnapshot() {
    const font = useState<string>('font');
    const subtitleFontWeight = useState<string | number>('subtitleFontWeight');
    const subtitleTextTransform = useState<string>('subtitleTextTransform');
    const subtitleTextColor = useState<string>('subtitleTextColor');
    const subtitleStrokeColor = useState<string>('subtitleStrokeColor');
    const subtitleStrokeWidth = useState<number>('subtitleStrokeWidth');
    const subtitleBackground = useState<string>('subtitleBackground');
    const subtitleBackgroundOpacity = useState<number>(
      'subtitleBackgroundOpacity'
    );
    const subtitleWordSpacing = useState<number>('subtitleWordSpacing');

    return {
      font: font.value || 'Outfit',
      fontSize: 80,
      fontWeight: subtitleFontWeight.value
        ? String(subtitleFontWeight.value)
        : '900',
      textTransform: subtitleTextTransform.value || 'uppercase',
      align: 'center' as const,
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
      shadowOffsetY: 5
    };
  }

  function addTimelineItem(trackId: string, item: Partial<TimelineTrackItem>) {
    const track = timelineTracks.value.find(t => t.id === trackId);
    if (track) {
      const coverOffset = resolveCoverOffsetSec(
        coverEnabled.value,
        coverDuration.value
      );
      const isAudio = isAudioTrack(track);
      let startSec: number;
      if (item.start !== undefined) {
        startSec = item.start;
      } else if (isAudio) {
        const cur = currentTime.value ?? 0;
        startSec = coverOffset > 0 && cur < coverOffset ? 0.0 : cur;
      } else {
        startSec = fromGlobalTimelineStart(
          currentTime.value ?? 0,
          coverEnabled.value,
          coverDuration.value
        );
      }
      const effectiveAudioSpan =
        Math.max(
          timelineDuration.value || 0,
          (videoDuration.value || 0) + coverOffset
        ) || 60;
      const maxRemaining = isAudio
        ? Math.max(0.5, effectiveAudioSpan - startSec)
        : Math.max(
            0.5,
            Math.max(0.5, timelineDuration.value - coverOffset) - startSec
          );
      const defaultDuration = item.duration ?? 5;
      const durationSec = Math.min(defaultDuration, maxRemaining);

      let styleOverrides: Partial<TimelineTrackItem> = {};
      if (trackId === 'text') {
        if (defaultTimelineTextStyle.value) {
          styleOverrides = {
            ...defaultTimelineTextStyle.value,
            linkToGlobal: true
          };
        } else {
          styleOverrides = getGlobalStyleSnapshot();
          styleOverrides.linkToGlobal = true;
        }
      }

      const baseContent = trackId === 'text' ? { content: '' } : {};

      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: trackId as any,
        ...baseContent,
        ...styleOverrides,
        ...item,
        start: startSec,
        mediaStart: item.mediaStart ?? 0,
        duration: durationSec
      };
      track.items.push(newItem);
      selectedTimelineItem.value = newItem;
    }
  }

  function deleteTimelineItem(trackId: string, itemId: string) {
    const track = timelineTracks.value.find(t => t.id === trackId);
    if (track) {
      track.items = track.items.filter(
        (i: TimelineTrackItem) => i.id !== itemId
      );
      if (selectedTimelineItem.value?.id === itemId) {
        selectedTimelineItem.value = null;
      }
    }
  }

  function updateTimelineItem(
    trackId: string,
    itemId: string,
    updates: Partial<TimelineTrackItem>
  ) {
    const track = timelineTracks.value.find(t => t.id === trackId);
    if (track) {
      const item = track.items.find((i: TimelineTrackItem) => i.id === itemId);
      if (item) {
        Object.assign(item, updates);
      }
    }
  }

  function syncGlobalStylesToItem(item: TimelineTrackItem) {
    const snap = getGlobalStyleSnapshot();
    Object.assign(item, snap);
    item.linkToGlobal = true;
  }

  function saveTimelineTextStyleAsDefault(item: TimelineTrackItem) {
    const font = useState<string>('font');
    const toast = useState<{
      message: string;
      type: 'success' | 'error' | 'info';
    } | null>('clipperToast');

    const style = {
      font: item.font || font.value || 'Montserrat',
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
      shadowOffsetY: item.shadowOffsetY ?? 5
    };
    defaultTimelineTextStyle.value = style;
    if (import.meta.client) {
      localStorage.setItem('defaultTimelineTextStyle', JSON.stringify(style));
    }
    toast.value = {
      message: 'Saved current style as manual text default!',
      type: 'success'
    };
  }

  return {
    timelineTracks,
    defaultTimelineTextStyle,
    selectedTimelineItem,
    isSavingLocked,
    isTimelineShifting,
    isDraggingTimelineItem,
    timelineDuration,
    videoTime,
    saveTimelineTracks,
    addTimelineItem,
    deleteTimelineItem,
    updateTimelineItem,
    syncGlobalStylesToItem,
    saveTimelineTextStyleAsDefault,
    // History controls
    canUndo,
    canRedo,
    commitToHistory,
    undo,
    redo,
    isSavingHistory,
    hasUnsavedHistory,
    saveHistoryToBackend,
    loadHistoryFromResponse,
    timelineUndoStack,
    timelineRedoStack,
    isHydratingHistory
  };
};
