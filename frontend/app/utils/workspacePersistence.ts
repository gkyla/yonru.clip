/**
 * WorkspacePersistenceCoordinator — Deep Domain Engine for Workspace Storage,
 * Setting Hydration, Reactive Watchers, and BeforeUnload Lifecycle Guards.
 */

import { watch, type Ref } from 'vue'
import type {
  HookExtractionMode,
  HookIntentPreset,
  CachedVideo,
  LastAccessedClip,
  TimelineTrack,
  TimelineTrackItem
} from '../types/clipper'

export interface WorkspaceSettingsSchema {
  prompt?: string
  extractionMode?: HookExtractionMode
  presetId?: HookIntentPreset
  focusTopic?: string
  minDuration?: number
  maxDuration?: number
  whisperModel?: string
  language?: string
  lastVideoId?: string
  lastVideoStored?: CachedVideo | null
  lastClip?: LastAccessedClip | null
  defaultTimelineTextStyle?: Record<string, any> | null
}

export interface WorkspaceReactivityContext {
  selectedPrompt: Ref<string>
  extractionMode: Ref<HookExtractionMode>
  selectedPresetId: Ref<HookIntentPreset>
  focusTopic: Ref<string>
  minDuration: Ref<number>
  maxDuration: Ref<number>
  whisperModel: Ref<string>
  language: Ref<string>
  lastAccessedVideoId: Ref<string | null>
  lastAccessedVideoStored: Ref<CachedVideo | null>
  lastAccessedClip: Ref<LastAccessedClip | null>

  folderName: Ref<string | null>
  clipId: Ref<string | null>
  jobStatus: Ref<string>
  activeHook: Ref<{ theme?: string; title?: string; thumbnail_url?: string } | null>
  setLastClip: (folder: string, clipId: string, theme?: string, thumbnailUrl?: string) => void

  auditor: { loadBlacklistFromStorage: () => void }
  timeline: {
    defaultTimelineTextStyle: Ref<Record<string, any> | null>
    timelineTracks: Ref<TimelineTrack[]>
    timelineUndoStack: Ref<any[]>
    timelineRedoStack: Ref<any[]>
    isHydratingHistory: Ref<boolean>
    hasUnsavedHistory: Ref<boolean>
    isSavingHistory: Ref<boolean>
    saveTimelineTracks: () => void
    saveHistoryToBackend: () => void
    syncGlobalStylesToItem: (item: TimelineTrackItem) => void
  }
  loadDefaultThumbnailStyle: () => void

  font: Ref<string>
  fontSize: Ref<number>
  subtitleFontWeight: Ref<string | number>
  subtitleTextTransform: Ref<string>
  subtitleTextColor: Ref<string>
  subtitleStrokeColor: Ref<string>
  subtitleStrokeWidth: Ref<number>
  subtitleBackground: Ref<string>
  subtitleBackgroundOpacity: Ref<number>
  subtitleWordSpacing: Ref<number>
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
  } as const

  /**
   * Safely loads workspace settings from localStorage.
   */
  public static loadSettings(): WorkspaceSettingsSchema {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {}
    }

    const settings: WorkspaceSettingsSchema = {}

    try {
      const p = localStorage.getItem(this.KEYS.PROMPT)
      if (p) settings.prompt = p

      const em = localStorage.getItem(this.KEYS.EXTRACTION_MODE) as HookExtractionMode | null
      if (em) settings.extractionMode = em

      const sp = localStorage.getItem(this.KEYS.PRESET_ID) as HookIntentPreset | null
      if (sp) settings.presetId = sp

      const ft = localStorage.getItem(this.KEYS.FOCUS_TOPIC)
      if (ft) settings.focusTopic = ft

      const minD = localStorage.getItem(this.KEYS.MIN_DURATION)
      if (minD) settings.minDuration = parseInt(minD, 10) || 30

      const maxD = localStorage.getItem(this.KEYS.MAX_DURATION)
      if (maxD) settings.maxDuration = parseInt(maxD, 10) || 180

      const m = localStorage.getItem(this.KEYS.MODEL)
      if (m) settings.whisperModel = m

      const lang = localStorage.getItem(this.KEYS.LANGUAGE)
      if (lang) settings.language = lang

      const lv = localStorage.getItem(this.KEYS.LAST_VIDEO)
      if (lv) settings.lastVideoId = lv

      const lvs = localStorage.getItem(this.KEYS.LAST_VIDEO_STORED)
      if (lvs) {
        try {
          settings.lastVideoStored = JSON.parse(lvs)
        } catch {
          settings.lastVideoStored = null
        }
      }

      const lc = localStorage.getItem(this.KEYS.LAST_CLIP)
      if (lc) {
        try {
          settings.lastClip = JSON.parse(lc)
        } catch {
          settings.lastClip = null
        }
      }

      const savedStyle = localStorage.getItem(this.KEYS.DEFAULT_TEXT_STYLE)
      if (savedStyle) {
        try {
          settings.defaultTimelineTextStyle = JSON.parse(savedStyle)
        } catch {
          settings.defaultTimelineTextStyle = null
        }
      }
    } catch (e) {
      console.warn('[workspace-persistence] Failed to read localStorage settings:', e)
    }

    return settings
  }

  /**
   * Safely writes a single setting into localStorage.
   */
  public static saveSetting(key: string, value: any): void {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key)
      } else if (typeof value === 'object') {
        localStorage.setItem(key, JSON.stringify(value))
      } else {
        localStorage.setItem(key, String(value))
      }
    } catch (e) {
      console.warn(`[workspace-persistence] Failed to save setting "${key}":`, e)
    }
  }

  /**
   * Hydrates state refs from storage and sets up all reactive auto-saving watchers
   * and beforeunload handlers. Returns an unbind cleanup function.
   */
  public static bindReactivity(ctx: WorkspaceReactivityContext): () => void {
    if (typeof window === 'undefined') {
      return () => {}
    }

    // 1. Hydrate Blacklist & Custom Safety
    ctx.auditor.loadBlacklistFromStorage()

    // 2. Hydrate Settings into Vue State Refs
    const saved = this.loadSettings()
    if (saved.prompt !== undefined) ctx.selectedPrompt.value = saved.prompt
    if (saved.extractionMode !== undefined) ctx.extractionMode.value = saved.extractionMode
    if (saved.presetId !== undefined) ctx.selectedPresetId.value = saved.presetId
    if (saved.focusTopic !== undefined) ctx.focusTopic.value = saved.focusTopic
    if (saved.minDuration !== undefined) ctx.minDuration.value = saved.minDuration
    if (saved.maxDuration !== undefined) ctx.maxDuration.value = saved.maxDuration
    if (saved.whisperModel !== undefined) ctx.whisperModel.value = saved.whisperModel
    if (saved.language !== undefined) ctx.language.value = saved.language
    if (saved.lastVideoId !== undefined) ctx.lastAccessedVideoId.value = saved.lastVideoId
    if (saved.lastVideoStored !== undefined && saved.lastVideoStored !== null) {
      ctx.lastAccessedVideoStored.value = saved.lastVideoStored
    }
    if (saved.lastClip !== undefined && saved.lastClip !== null) {
      ctx.lastAccessedClip.value = saved.lastClip
    }
    if (saved.defaultTimelineTextStyle !== undefined && saved.defaultTimelineTextStyle !== null) {
      ctx.timeline.defaultTimelineTextStyle.value = saved.defaultTimelineTextStyle
    }

    // 3. Hydrate Default Thumbnail Style
    ctx.loadDefaultThumbnailStyle()

    // 4. Setup Reactive Watchers
    const unwatchList: Array<() => void> = []

    unwatchList.push(
      watch(
        [ctx.folderName, ctx.clipId, ctx.jobStatus],
        ([newFolder, newClipId, newStatus]) => {
          if (newFolder && newClipId && newStatus === 'ready') {
            ctx.setLastClip(
              newFolder,
              newClipId,
              ctx.activeHook.value?.theme || ctx.activeHook.value?.title || 'Current Clip',
              ctx.activeHook.value?.thumbnail_url
            )
          }
        }
      )
    )

    unwatchList.push(watch(ctx.selectedPrompt, (val) => this.saveSetting(this.KEYS.PROMPT, val)))
    unwatchList.push(watch(ctx.extractionMode, (val) => this.saveSetting(this.KEYS.EXTRACTION_MODE, val)))
    unwatchList.push(watch(ctx.selectedPresetId, (val) => this.saveSetting(this.KEYS.PRESET_ID, val)))
    unwatchList.push(watch(ctx.focusTopic, (val) => this.saveSetting(this.KEYS.FOCUS_TOPIC, val)))
    unwatchList.push(watch(ctx.minDuration, (val) => this.saveSetting(this.KEYS.MIN_DURATION, val)))
    unwatchList.push(watch(ctx.maxDuration, (val) => this.saveSetting(this.KEYS.MAX_DURATION, val)))
    unwatchList.push(watch(ctx.whisperModel, (val) => this.saveSetting(this.KEYS.MODEL, val)))
    unwatchList.push(watch(ctx.language, (val) => this.saveSetting(this.KEYS.LANGUAGE, val)))

    unwatchList.push(
      watch(
        ctx.timeline.timelineTracks,
        () => {
          ctx.timeline.saveTimelineTracks()
        },
        { deep: true }
      )
    )

    // Debounced persistence for history stacks
    let historyDebounceTimer: ReturnType<typeof setTimeout> | null = null
    unwatchList.push(
      watch(
        [() => ctx.timeline.timelineUndoStack.value.length, () => ctx.timeline.timelineRedoStack.value.length],
        () => {
          if (ctx.timeline.isHydratingHistory.value) return
          if (ctx.timeline.timelineUndoStack.value.length === 0 && ctx.timeline.timelineRedoStack.value.length === 0) return

          ctx.timeline.hasUnsavedHistory.value = true
          if (historyDebounceTimer) clearTimeout(historyDebounceTimer)
          historyDebounceTimer = setTimeout(() => {
            ctx.timeline.saveHistoryToBackend()
          }, 1500)
        }
      )
    )

    // Global Subtitle Style Syncing to Timeline Text Items
    unwatchList.push(
      watch(
        [
          ctx.font,
          ctx.fontSize,
          ctx.subtitleFontWeight,
          ctx.subtitleTextTransform,
          ctx.subtitleTextColor,
          ctx.subtitleStrokeColor,
          ctx.subtitleStrokeWidth,
          ctx.subtitleBackground,
          ctx.subtitleBackgroundOpacity,
          ctx.subtitleWordSpacing
        ],
        () => {
          const textTrack = ctx.timeline.timelineTracks.value.find((t: TimelineTrack) => t.id === 'text')
          if (!textTrack) return
          textTrack.items.forEach((item: TimelineTrackItem) => {
            if (item.linkToGlobal !== false) {
              ctx.timeline.syncGlobalStylesToItem(item)
            }
          })
        }
      )
    )

    // 5. BeforeUnload Guard
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (ctx.timeline.hasUnsavedHistory.value || ctx.timeline.isSavingHistory.value) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Return unbind cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (historyDebounceTimer) {
        clearTimeout(historyDebounceTimer)
        historyDebounceTimer = null
      }
      unwatchList.forEach(unwatch => unwatch())
    }
  }
}
