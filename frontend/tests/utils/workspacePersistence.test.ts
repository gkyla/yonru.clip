import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ref } from 'vue';
import {
  WorkspacePersistenceCoordinator,
  type WorkspaceReactivityContext
} from '../../app/utils/workspacePersistence';
import { ClipSessionSaveScheduler } from '../../app/utils/clipSessionSaveScheduler';

describe('WorkspacePersistenceCoordinator Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads empty settings when localStorage is empty', () => {
    const settings = WorkspacePersistenceCoordinator.loadSettings();
    expect(settings).toEqual({});
  });

  it('safely saves and loads primitive settings', () => {
    WorkspacePersistenceCoordinator.saveSetting(
      WorkspacePersistenceCoordinator.KEYS.PROMPT,
      'custom prompt'
    );
    WorkspacePersistenceCoordinator.saveSetting(
      WorkspacePersistenceCoordinator.KEYS.MIN_DURATION,
      45
    );
    WorkspacePersistenceCoordinator.saveSetting(
      WorkspacePersistenceCoordinator.KEYS.MODEL,
      'large-v3'
    );

    const settings = WorkspacePersistenceCoordinator.loadSettings();
    expect(settings.prompt).toBe('custom prompt');
    expect(settings.minDuration).toBe(45);
    expect(settings.whisperModel).toBe('large-v3');
  });

  it('safely parses JSON object settings and gracefully recovers from corrupt JSON', () => {
    // Valid JSON
    const clipData = {
      folder: '2026-08',
      clip_id: 'clip-1',
      title: 'Test Theme'
    };
    WorkspacePersistenceCoordinator.saveSetting(
      WorkspacePersistenceCoordinator.KEYS.LAST_CLIP,
      clipData
    );

    let settings = WorkspacePersistenceCoordinator.loadSettings();
    expect(settings.lastClip).toEqual(clipData);

    // Corrupt JSON string in localStorage
    localStorage.setItem(
      WorkspacePersistenceCoordinator.KEYS.LAST_CLIP,
      '{corrupted-json'
    );
    settings = WorkspacePersistenceCoordinator.loadSettings();
    expect(settings.lastClip).toBeNull();
  });

  it('binds reactivity and updates localStorage on ref changes', async () => {
    const mockContext: WorkspaceReactivityContext = {
      selectedPrompt: ref(''),
      extractionMode: ref('preset'),
      selectedPresetId: ref('auto'),
      focusTopic: ref(''),
      minDuration: ref(30),
      maxDuration: ref(180),
      whisperModel: ref('base'),
      language: ref('id'),
      lastAccessedVideoId: ref(null),
      lastAccessedVideoStored: ref(null),
      lastAccessedClip: ref(null),
      folderName: ref(null),
      clipId: ref(null),
      jobStatus: ref('idle'),
      activeHook: ref(null),
      setLastClip: vi.fn(),
      auditor: { loadBlacklistFromStorage: vi.fn() },
      timeline: {
        defaultTimelineTextStyle: ref(null),
        timelineTracks: ref([]),
        timelineUndoStack: ref([]),
        timelineRedoStack: ref([]),
        isHydratingHistory: ref(false),
        hasUnsavedHistory: ref(false),
        isSavingHistory: ref(false),
        saveTimelineTracks: vi.fn(),
        saveHistoryToBackend: vi.fn(),
        syncGlobalStylesToItem: vi.fn()
      },
      loadDefaultThumbnailStyle: vi.fn(),
      font: ref('Montserrat'),
      fontSize: ref(24),
      subtitleFontWeight: ref(900),
      subtitleTextTransform: ref('uppercase'),
      subtitleTextColor: ref('#FFFFFF'),
      subtitleStrokeColor: ref('#000000'),
      subtitleStrokeWidth: ref(4),
      subtitleBackground: ref('none'),
      subtitleBackgroundOpacity: ref(0.7),
      subtitleWordSpacing: ref(0)
    };

    const unbind = WorkspacePersistenceCoordinator.bindReactivity(mockContext);
    expect(mockContext.auditor!.loadBlacklistFromStorage).toHaveBeenCalled();
    expect(mockContext.loadDefaultThumbnailStyle).toHaveBeenCalled();

    // Mutate ref
    mockContext.selectedPrompt!.value = 'New Reactive Prompt';
    // Vue watch triggers asynchronously on next tick or immediate in testing
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(
      localStorage.getItem(WorkspacePersistenceCoordinator.KEYS.PROMPT)
    ).toBe('New Reactive Prompt');

    // Cleanup
    unbind();
  });

  it('triggers debounced saveStyleSettings when subtitle styling ref changes while clip is active', async () => {
    vi.useFakeTimers();
    const saveStyleSettingsSpy = vi.fn();
    const mockContext: WorkspaceReactivityContext = {
      selectedPrompt: ref(''),
      extractionMode: ref('preset'),
      selectedPresetId: ref('auto'),
      focusTopic: ref(''),
      minDuration: ref(30),
      maxDuration: ref(180),
      whisperModel: ref('base'),
      language: ref('id'),
      lastAccessedVideoId: ref(null),
      lastAccessedVideoStored: ref(null),
      lastAccessedClip: ref(null),
      folderName: ref('folder1'),
      clipId: ref('clip1'),
      jobStatus: ref('ready'),
      activeHook: ref(null),
      setLastClip: vi.fn(),
      auditor: { loadBlacklistFromStorage: vi.fn() },
      timeline: {
        defaultTimelineTextStyle: ref(null),
        timelineTracks: ref([]),
        timelineUndoStack: ref([]),
        timelineRedoStack: ref([]),
        isHydratingHistory: ref(false),
        hasUnsavedHistory: ref(false),
        isSavingHistory: ref(false),
        isSavingLocked: ref(false),
        saveTimelineTracks: vi.fn(),
        saveHistoryToBackend: vi.fn(),
        syncGlobalStylesToItem: vi.fn()
      },
      loadDefaultThumbnailStyle: vi.fn(),
      font: ref('Montserrat'),
      fontSize: ref(24),
      subtitleFontWeight: ref(900),
      subtitleTextTransform: ref('uppercase'),
      subtitleTextColor: ref('#FFFFFF'),
      subtitleStrokeColor: ref('#000000'),
      subtitleStrokeWidth: ref(4),
      subtitleBackground: ref('none'),
      subtitleBackgroundOpacity: ref(0.7),
      subtitleWordSpacing: ref(0),
      saveStyleSettings: saveStyleSettingsSpy
    };

    const unbind = WorkspacePersistenceCoordinator.bindReactivity(mockContext);

    // Mutate font ref
    mockContext.font!.value = 'Bebas Neue';
    await vi.advanceTimersByTimeAsync(100);
    expect(saveStyleSettingsSpy).not.toHaveBeenCalled();

    // Advance full debounce time (800ms)
    await vi.advanceTimersByTimeAsync(800);
    expect(saveStyleSettingsSpy).toHaveBeenCalledTimes(1);

    unbind();
    vi.useRealTimers();
  });

  it('supports domain-scoped contexts (promptRepo, library, editorSession, subtitleStyle)', async () => {
    vi.useFakeTimers();
    const saveStyleSettingsSpy = vi.fn();
    const mockContext: WorkspaceReactivityContext = {
      promptRepo: {
        selectedPrompt: ref(''),
        extractionMode: ref('preset'),
        selectedPresetId: ref('auto'),
        focusTopic: ref(''),
        minDuration: ref(30),
        maxDuration: ref(180)
      },
      library: {
        whisperModel: ref('base'),
        language: ref('id'),
        lastAccessedVideoId: ref(null),
        lastAccessedVideoStored: ref(null),
        lastAccessedClip: ref(null)
      },
      editorSession: {
        folderName: ref('domainFolder'),
        clipId: ref('domainClip'),
        saveStyleSettings: saveStyleSettingsSpy
      },
      auditor: {
        loadBlacklistFromStorage: vi.fn()
      },
      thumbnail: {
        loadDefaultThumbnailStyle: vi.fn()
      },
      timeline: {
        timelineTracks: ref([]),
        saveTimelineTracks: vi.fn()
      },
      subtitleStyle: {
        font: ref('Montserrat'),
        fontSize: ref(32)
      }
    };

    const unbind = WorkspacePersistenceCoordinator.bindReactivity(mockContext);
    expect(mockContext.auditor?.loadBlacklistFromStorage).toHaveBeenCalled();
    expect(mockContext.thumbnail?.loadDefaultThumbnailStyle).toHaveBeenCalled();

    // Mutate prompt in promptRepo
    mockContext.promptRepo!.selectedPrompt!.value = 'Domain Prompt';
    await vi.advanceTimersByTimeAsync(10);
    expect(
      localStorage.getItem(WorkspacePersistenceCoordinator.KEYS.PROMPT)
    ).toBe('Domain Prompt');

    // Mutate font in subtitleStyle
    mockContext.subtitleStyle!.font!.value = 'Inter';
    await vi.advanceTimersByTimeAsync(800);
    expect(saveStyleSettingsSpy).toHaveBeenCalledTimes(1);

    unbind();
    vi.useRealTimers();
  });

  it('syncs global subtitle styles across all Text Tracks (text, text-2) while respecting linkToGlobal === false', async () => {
    const syncSpy = vi.fn();
    const fontRef = ref('Montserrat');
    const tracksRef = ref([
      {
        id: 'text-2',
        name: 'Text 2',
        type: 'text' as const,
        items: [
          { id: 't2-linked', start: 0, duration: 3, linkToGlobal: true },
          { id: 't2-unlinked', start: 4, duration: 3, linkToGlobal: false }
        ]
      },
      { id: 'video', name: 'Main Video', type: 'video' as const, items: [] },
      {
        id: 'text',
        name: 'Text 1',
        type: 'text' as const,
        items: [{ id: 't1-linked', start: 0, duration: 3 }]
      },
      { id: 'audio', name: 'Audio 1', type: 'audio' as const, items: [] }
    ]);

    const unbind = WorkspacePersistenceCoordinator.bindReactivity({
      timeline: {
        timelineTracks: tracksRef,
        syncGlobalStylesToItem: syncSpy
      },
      subtitleStyle: {
        font: fontRef
      }
    });

    fontRef.value = 'Roboto';
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(syncSpy).toHaveBeenCalledTimes(2);
    expect(syncSpy.mock.calls.map(c => c[0].id)).toEqual([
      't2-linked',
      't1-linked'
    ]);

    unbind();
  });

  it('triggers debounced saveCoverConfig when cover slide refs change and flushes on beforeunload', async () => {
    vi.useFakeTimers();
    const saveCoverConfigSpy = vi.fn();
    const coverEnabled = ref(false);
    const coverDuration = ref(1.0);
    const coverTextOverlays = ref([]);

    const unbind = WorkspacePersistenceCoordinator.bindReactivity({
      editorSession: {
        folderName: ref('folder1'),
        clipId: ref('clip1')
      },
      timeline: {
        isSavingLocked: ref(false)
      },
      cover: {
        coverEnabled,
        coverDuration,
        coverTextOverlays,
        saveCoverConfig: saveCoverConfigSpy
      }
    });

    coverEnabled.value = true;
    await vi.advanceTimersByTimeAsync(100);
    expect(saveCoverConfigSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    expect(saveCoverConfigSpy).toHaveBeenCalledTimes(1);

    // Mutate again and flush immediately via beforeunload
    coverDuration.value = 2.0;
    await vi.advanceTimersByTimeAsync(50);
    window.dispatchEvent(new Event('beforeunload'));
    expect(saveCoverConfigSpy).toHaveBeenCalledTimes(2);

    unbind();
    vi.useRealTimers();
  });

  it('debounces rapid timelineTracks edits instead of firing 0ms PUT storms', async () => {
    vi.useFakeTimers();
    const saveTimelineSpy = vi.fn();
    const timelineTracks = ref([
      {
        id: 'text',
        name: 'Text 1',
        type: 'text' as const,
        items: [{ id: 't1', start: 0, duration: 2, fontSize: 40 }]
      }
    ]);

    const unbind = WorkspacePersistenceCoordinator.bindReactivity({
      editorSession: {
        folderName: ref('f1'),
        clipId: ref('c1'),
        saveTimelineTracks: saveTimelineSpy
      },
      timeline: {
        isSavingLocked: ref(false),
        isDraggingTimelineItem: ref(false),
        timelineTracks
      }
    });

    for (let i = 1; i <= 15; i++) {
      timelineTracks.value[0]!.items[0]!.fontSize = 40 + i;
      await vi.advanceTimersByTimeAsync(20);
    }

    // Never fires on 0ms or mid-burst
    expect(saveTimelineSpy).not.toHaveBeenCalled();

    // Fires once after 400ms settle window
    await vi.advanceTimersByTimeAsync(400);
    expect(saveTimelineSpy).toHaveBeenCalledTimes(1);

    unbind();
  });

  it('coalesces global style cascade + timeline sync into a single combined PUT behind ClipSessionSaveScheduler', async () => {
    vi.useFakeTimers();
    const patchSession = vi.fn().mockResolvedValue({ status: 'ok' });
    const folderName = ref<string | null>('fCascade');
    const clipId = ref<string | null>('cCascade');
    const font = ref('Montserrat');
    const timelineTracks = ref([
      {
        id: 'text',
        name: 'Text 1',
        type: 'text' as const,
        items: [
          {
            id: 't1',
            start: 0,
            duration: 2,
            linkToGlobal: true,
            font: 'Montserrat'
          }
        ]
      }
    ]);

    const saveScheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () =>
          folderName.value && clipId.value
            ? { folderName: folderName.value, clipId: clipId.value }
            : null,
        buildDomainPatch: domains => ({
          ...(domains.has('style_settings')
            ? { style_settings: { font: font.value } }
            : {}),
          ...(domains.has('timeline') ? { timeline: timelineTracks.value } : {})
        })
      }
    });

    const unbind = WorkspacePersistenceCoordinator.bindReactivity({
      editorSession: {
        folderName,
        clipId,
        saveScheduler
      },
      timeline: {
        isSavingLocked: ref(false),
        timelineTracks,
        syncGlobalStylesToItem: item => {
          item.font = font.value;
        }
      },
      subtitleStyle: {
        font
      }
    });

    font.value = 'Bebas Neue';
    await vi.advanceTimersByTimeAsync(1000);

    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(patchSession).toHaveBeenCalledWith('fCascade', 'cCascade', {
      style_settings: { font: 'Bebas Neue' },
      timeline: [
        {
          id: 'text',
          name: 'Text 1',
          type: 'text',
          items: [
            {
              id: 't1',
              start: 0,
              duration: 2,
              linkToGlobal: true,
              font: 'Bebas Neue'
            }
          ]
        }
      ]
    });

    saveScheduler.dispose();
    unbind();
  });

  it('auto-saves framing and audio refs (cropMode, cropPercentX, splitZoomTop, splitOffsetXTop, volume) and respects isSavingLocked', async () => {
    vi.useFakeTimers();
    const saveStyleSpy = vi.fn();
    const isSavingLocked = ref(false);
    const cropMode = ref('face_tracking');
    const cropPercentX = ref(50);
    const splitZoomTop = ref(1.0);
    const splitOffsetXTop = ref(0);
    const volume = ref(0.5);

    const unbind = WorkspacePersistenceCoordinator.bindReactivity({
      editorSession: {
        folderName: ref('fFrame'),
        clipId: ref('cFrame'),
        saveStyleSettings: saveStyleSpy
      },
      timeline: {
        isSavingLocked,
        timelineTracks: ref([])
      },
      subtitleStyle: {
        cropMode,
        cropPercentX,
        splitZoomTop,
        splitOffsetXTop,
        volume
      }
    });

    cropMode.value = 'manual';
    await vi.advanceTimersByTimeAsync(800);
    expect(saveStyleSpy).toHaveBeenCalledTimes(1);

    cropPercentX.value = 65;
    splitZoomTop.value = 1.4;
    splitOffsetXTop.value = 12;
    volume.value = 0.8;
    await vi.advanceTimersByTimeAsync(800);
    expect(saveStyleSpy).toHaveBeenCalledTimes(2);

    // Locked hydration mutations must not schedule style saves
    isSavingLocked.value = true;
    cropMode.value = 'face_tracking';
    volume.value = 0.4;
    await vi.advanceTimersByTimeAsync(1000);
    expect(saveStyleSpy).toHaveBeenCalledTimes(2);

    unbind();
  });

  it('watches fullTranscript shallowly, respects isSavingLocked, and flushes dirty domains in one beforeunload call', async () => {
    vi.useFakeTimers();
    const patchSession = vi.fn().mockResolvedValue({ status: 'ok' });
    const folderName = ref<string | null>('fUnload');
    const clipId = ref<string | null>('cUnload');
    const fullTranscript = ref([{ start: 0, duration: 2, text: 'Initial' }]);
    const font = ref('Montserrat');
    const isSavingLocked = ref(false);

    const saveScheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () =>
          folderName.value && clipId.value
            ? { folderName: folderName.value, clipId: clipId.value }
            : null,
        isLocked: () => isSavingLocked.value,
        buildDomainPatch: domains => ({
          ...(domains.has('transcript')
            ? { transcript: fullTranscript.value }
            : {}),
          ...(domains.has('style_settings')
            ? { style_settings: { font: font.value } }
            : {})
        })
      }
    });

    const unbind = WorkspacePersistenceCoordinator.bindReactivity({
      editorSession: {
        folderName,
        clipId,
        fullTranscript,
        saveScheduler
      },
      timeline: {
        isSavingLocked,
        timelineTracks: ref([])
      },
      subtitleStyle: { font }
    });

    // Shallow replacement triggers transcript dirty marking
    fullTranscript.value = [{ start: 0, duration: 2, text: 'Updated' }];
    await vi.advanceTimersByTimeAsync(800);
    expect(patchSession).toHaveBeenCalledTimes(1);

    // Locked replacement must not trigger save
    isSavingLocked.value = true;
    fullTranscript.value = [{ start: 0, duration: 2, text: 'Locked Hydrate' }];
    await vi.advanceTimersByTimeAsync(800);
    expect(patchSession).toHaveBeenCalledTimes(1);

    // Dirty multiple domains & flush coherently on beforeunload
    isSavingLocked.value = false;
    font.value = 'Outfit';
    fullTranscript.value = [{ start: 0, duration: 2, text: 'Unsaved Unload' }];
    await vi.advanceTimersByTimeAsync(50);

    const unloadEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);
    expect(patchSession).toHaveBeenCalledTimes(2);
    expect(patchSession).toHaveBeenLastCalledWith('fUnload', 'cUnload', {
      transcript: [{ start: 0, duration: 2, text: 'Unsaved Unload' }],
      style_settings: { font: 'Outfit' }
    });

    saveScheduler.dispose();
    unbind();
  });
});
