import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import {
  WorkspacePersistenceCoordinator,
  type WorkspaceReactivityContext
} from '../../app/utils/workspacePersistence'

describe('WorkspacePersistenceCoordinator Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('loads empty settings when localStorage is empty', () => {
    const settings = WorkspacePersistenceCoordinator.loadSettings()
    expect(settings).toEqual({})
  })

  it('safely saves and loads primitive settings', () => {
    WorkspacePersistenceCoordinator.saveSetting(WorkspacePersistenceCoordinator.KEYS.PROMPT, 'custom prompt')
    WorkspacePersistenceCoordinator.saveSetting(WorkspacePersistenceCoordinator.KEYS.MIN_DURATION, 45)
    WorkspacePersistenceCoordinator.saveSetting(WorkspacePersistenceCoordinator.KEYS.MODEL, 'large-v3')

    const settings = WorkspacePersistenceCoordinator.loadSettings()
    expect(settings.prompt).toBe('custom prompt')
    expect(settings.minDuration).toBe(45)
    expect(settings.whisperModel).toBe('large-v3')
  })

  it('safely parses JSON object settings and gracefully recovers from corrupt JSON', () => {
    // Valid JSON
    const clipData = { folder: '2026-08', clip_id: 'clip-1', title: 'Test Theme' }
    WorkspacePersistenceCoordinator.saveSetting(WorkspacePersistenceCoordinator.KEYS.LAST_CLIP, clipData)

    let settings = WorkspacePersistenceCoordinator.loadSettings()
    expect(settings.lastClip).toEqual(clipData)

    // Corrupt JSON string in localStorage
    localStorage.setItem(WorkspacePersistenceCoordinator.KEYS.LAST_CLIP, '{corrupted-json')
    settings = WorkspacePersistenceCoordinator.loadSettings()
    expect(settings.lastClip).toBeNull()
  })

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
    }

    const unbind = WorkspacePersistenceCoordinator.bindReactivity(mockContext)
    expect(mockContext.auditor.loadBlacklistFromStorage).toHaveBeenCalled()
    expect(mockContext.loadDefaultThumbnailStyle).toHaveBeenCalled()

    // Mutate ref
    mockContext.selectedPrompt.value = 'New Reactive Prompt'
    // Vue watch triggers asynchronously on next tick or immediate in testing
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(localStorage.getItem(WorkspacePersistenceCoordinator.KEYS.PROMPT)).toBe('New Reactive Prompt')

    // Cleanup
    unbind()
  })
})
