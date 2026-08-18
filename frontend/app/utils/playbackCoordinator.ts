// playbackCoordinator.ts - Video Playback Coordinator domain engine (ADR-0004, ADR-0005)
import { parseSubtitleWords } from './remotionHelpers'
import { PlayerBridge } from './playerBridge'
import type {
  Hook,
  TranscriptSegment,
  ThumbnailTextOverlay,
  TimelineTrack
} from '../types/clipper'

export interface PlaybackStateSnapshot {
  currentTime: number
  videoTime: number
  timelineDuration: number
  videoFps: number
  volume: number
  isPlaying: boolean
  useNativePlayer: boolean
  isTimelineShifting: boolean
  videoUrl: string | null
  outputUrl: string | null
  stableVideoBuster: string

  // Transcript & Subtitles
  fullTranscript: TranscriptSegment[]
  subtitleSyncOffset: number
  subtitleMode: string
  activeHook: Hook | null
  showIframeDebug: boolean

  // Layout & Crop
  videoLayout: 'vertical' | 'landscape'
  subtitlePosition: string
  subtitleOffset: number
  cropMode: string
  cropMap: Array<{ time: number; x: number }>
  cropPercentX: number

  // Typography & Styling
  font: string
  fontSize: number
  subtitleFontWeight: number
  subtitleTextColor: string
  subtitleHighlightColor: string
  subtitleStrokeColor: string
  subtitleStrokeWidth: number
  subtitleTextTransform: string
  subtitleAnimation: string
  subtitleHighlightMode: string
  subtitleBackground: string
  subtitleBackgroundOpacity: number
  subtitleWordSpacing: number

  // Tracks & Thumbnail
  timelineTracks: TimelineTrack[]
  thumbnailEnabled: boolean
  thumbnailDuration: number
  thumbnailTextOverlays: ThumbnailTextOverlay[]
  isInThumbnailWindow: boolean

  // Censorship & Bleeps
  audioBleepEnabled: boolean
  audioBleepSource?: string
  customBleepData?: string
  flaggedSegments?: Array<{ start: number; duration: number }>
}

export class VideoPlaybackCoordinator {
  private bridge: PlayerBridge
  private lastSeekFrame: number | null = null
  private lastMuteState: boolean | null = null
  private lastAudioData: string | null = null
  private nativeVideoStarted: boolean = false

  constructor(bridge: PlayerBridge) {
    this.bridge = bridge
  }

  public getLastSeekFrame(): number | null {
    return this.lastSeekFrame
  }

  public getLastMuteState(): boolean | null {
    return this.lastMuteState
  }

  public isNativeVideoStarted(): boolean {
    return this.nativeVideoStarted
  }

  public setNativeVideoStarted(val: boolean): void {
    this.nativeVideoStarted = val
  }

  public resetState(): void {
    this.lastSeekFrame = null
    this.lastMuteState = null
    this.lastAudioData = null
    this.nativeVideoStarted = false
  }

  public isInsideFlaggedSegment(snapshot: PlaybackStateSnapshot): boolean {
    if (!snapshot.audioBleepEnabled) return false

    const firstStart = snapshot.fullTranscript?.[0]?.start || 0
    const isTranscriptZeroBased = snapshot.activeHook
      ? firstStart < (snapshot.activeHook.start || 0) - 2
      : true

    const thumbSec = snapshot.thumbnailEnabled ? (snapshot.thumbnailDuration || 0) : 0
    const relativeTime = Math.max(0, snapshot.currentTime - thumbSec)

    // Note: Audio waveform in video matches currentTime directly without subtitleSyncOffset
    const searchTime = isTranscriptZeroBased
      ? relativeTime
      : (snapshot.activeHook?.start || 0) + relativeTime

    const segments = snapshot.flaggedSegments || []
    return segments.some((seg) => searchTime >= seg.start && searchTime <= seg.start + seg.duration)
  }

  public getTargetVolume(snapshot: PlaybackStateSnapshot): number {
    const isCensored = this.isInsideFlaggedSegment(snapshot) && snapshot.isPlaying
    return isCensored ? 0 : snapshot.volume
  }

  public isTargetMuted(snapshot: PlaybackStateSnapshot): boolean {
    const isCensored = this.isInsideFlaggedSegment(snapshot) && snapshot.isPlaying
    if (isCensored) return true
    return !snapshot.useNativePlayer
  }

  public assembleRemotionProps(
    snapshot: PlaybackStateSnapshot,
    sourceDimensions: { width: number; height: number } = { width: 1920, height: 1080 }
  ): Record<string, any> {
    const syncOffsetMs = snapshot.subtitleSyncOffset
    const mode = snapshot.subtitleMode || 'word'

    const { wordsData, allWordTimings } = parseSubtitleWords(
      snapshot.fullTranscript || [],
      syncOffsetMs,
      mode
    )

    const cropXPixel = ((snapshot.cropPercentX ?? 50) / 100) * 1920

    let videoSrc = snapshot.videoUrl || ''
    if (videoSrc.includes('localhost:8000') && !videoSrc.includes('?t=')) {
      videoSrc += (videoSrc.includes('?') ? '&' : '?') + 't=' + snapshot.stableVideoBuster
    }

    return {
      videoPath: videoSrc,
      words: wordsData,
      wordTimings: allWordTimings,
      cropX: isNaN(cropXPixel) ? 960 : cropXPixel,
      cropMap: snapshot.cropMode === 'face_tracking' ? JSON.parse(JSON.stringify(snapshot.cropMap || [])) : [],
      sourceWidth: sourceDimensions.width,
      sourceHeight: sourceDimensions.height,
      position: snapshot.subtitlePosition,
      videoLayout: snapshot.videoLayout || 'vertical',
      subtitleOffset: snapshot.subtitleOffset,
      durationInFrames: Math.floor(snapshot.timelineDuration * (snapshot.videoFps || 30)),
      fps: snapshot.videoFps || 30,
      hideSubtitles: !!snapshot.outputUrl && snapshot.videoUrl === snapshot.outputUrl,
      showDebug: snapshot.showIframeDebug,
      volume: snapshot.volume,
      timelineTextItems: [],
      timelineAudioItems: JSON.parse(JSON.stringify(snapshot.timelineTracks?.find(t => t.id === 'audio')?.items || [])),
      timelineVideoItems: JSON.parse(JSON.stringify(snapshot.timelineTracks?.find(t => t.id === 'video')?.items || [])),
      thumbnailEnabled: snapshot.thumbnailEnabled,
      thumbnailDuration: snapshot.thumbnailDuration,
      thumbnailTextOverlays: JSON.parse(JSON.stringify(snapshot.thumbnailTextOverlays || [])),
      subtitleStyle: {
        fontFamily: snapshot.font,
        fontSize: snapshot.fontSize,
        fontWeight: snapshot.subtitleFontWeight,
        color: snapshot.subtitleTextColor,
        highlightColor: snapshot.subtitleHighlightColor,
        strokeColor: snapshot.subtitleStrokeColor,
        strokeWidth: snapshot.subtitleStrokeWidth,
        textTransform: snapshot.subtitleTextTransform,
        animation: snapshot.subtitleAnimation,
        highlightMode: snapshot.subtitleHighlightMode,
        background: snapshot.subtitleBackground,
        backgroundOpacity: snapshot.subtitleBackgroundOpacity,
        wordSpacing: snapshot.subtitleWordSpacing
      }
    }
  }

  public syncProps(
    snapshot: PlaybackStateSnapshot,
    sourceDimensions: { width: number; height: number } = { width: 1920, height: 1080 }
  ): void {
    const props = this.assembleRemotionProps(snapshot, sourceDimensions)
    this.bridge.updateProps(props)

    if (!snapshot.isPlaying) {
      const targetFrame = Math.floor(snapshot.currentTime * (snapshot.videoFps || 30))
      this.bridge.seek(targetFrame)
      this.lastSeekFrame = targetFrame
    }
  }

  public handlePlayStateChange(
    playing: boolean,
    snapshot: PlaybackStateSnapshot,
    nativeVideo?: { paused: boolean; muted: boolean; volume: number; currentTime: number; play: () => Promise<void>; pause: () => void } | null
  ): void {
    if (!playing) {
      this.nativeVideoStarted = false
    }

    if (nativeVideo) {
      // Strict Single Master Player Mode (ADR-0004)
      if (playing && snapshot.useNativePlayer) {
        if (snapshot.isInThumbnailWindow) {
          nativeVideo.currentTime = 0
          nativeVideo.muted = true
        } else {
          nativeVideo.muted = this.isTargetMuted(snapshot)
          nativeVideo.volume = this.getTargetVolume(snapshot)
          nativeVideo.currentTime = snapshot.videoTime
          nativeVideo.play().catch(e => console.warn('Native play blocked:', e))
        }
      } else {
        if (!nativeVideo.paused) nativeVideo.pause()
      }
    }

    if (playing) {
      this.bridge.play()
    } else {
      this.bridge.pause()
    }
  }

  public handleTimeChange(
    newTime: number,
    snapshot: PlaybackStateSnapshot,
    nativeVideo?: { paused: boolean; muted: boolean; volume: number; currentTime: number; play: () => Promise<void>; pause: () => void } | null
  ): { targetFrame: number; shouldSeek: boolean; crossedThumbnailBoundary?: boolean } {
    let crossedThumbnailBoundary = false

    if (snapshot.isTimelineShifting) {
      return { targetFrame: Math.floor(newTime * (snapshot.videoFps || 30)), shouldSeek: false }
    }

    // Thumbnail boundary transition handling
    if (snapshot.useNativePlayer && snapshot.isPlaying && nativeVideo && snapshot.thumbnailEnabled) {
      if (snapshot.isInThumbnailWindow) {
        if (!nativeVideo.paused) nativeVideo.pause()
        nativeVideo.currentTime = 0
        nativeVideo.muted = true
        this.nativeVideoStarted = false
      } else if (!this.nativeVideoStarted) {
        this.nativeVideoStarted = true
        nativeVideo.currentTime = snapshot.videoTime
        nativeVideo.muted = this.isTargetMuted(snapshot)
        nativeVideo.volume = this.getTargetVolume(snapshot)
        nativeVideo.play().catch(e => console.warn('Native play at boundary:', e))
        crossedThumbnailBoundary = true
      }
    }

    // Native position alignment
    if (snapshot.useNativePlayer && nativeVideo) {
      if (snapshot.isInThumbnailWindow) {
        if (nativeVideo.currentTime !== 0) nativeVideo.currentTime = 0
      } else {
        const targetTime = snapshot.videoTime
        if (Math.abs(nativeVideo.currentTime - targetTime) > 0.001) {
          nativeVideo.currentTime = targetTime
        }
      }
    }

    const targetFrame = Math.floor(newTime * (snapshot.videoFps || 30))
    const shouldSeek = this.lastSeekFrame !== targetFrame

    if (shouldSeek) {
      this.bridge.seek(targetFrame)
      this.lastSeekFrame = targetFrame
    }

    return { targetFrame, shouldSeek, crossedThumbnailBoundary }
  }

  public handleMuteVolumeChange(
    snapshot: PlaybackStateSnapshot,
    nativeVideo?: { muted: boolean; volume: number } | null
  ): { muteStateChanged: boolean; isMuted: boolean; targetVolume: number; audioDataChanged: boolean } {
    const isMuted = this.isInsideFlaggedSegment(snapshot) && snapshot.isPlaying
    const currentAudioData = snapshot.customBleepData || ''
    const audioDataChanged = this.lastAudioData !== currentAudioData

    if (audioDataChanged) {
      this.lastAudioData = currentAudioData
      this.lastMuteState = null
    }

    // State Deduplication (ADR-0005)
    const muteStateChanged = this.lastMuteState !== isMuted
    if (muteStateChanged) {
      this.lastMuteState = isMuted
    }

    const targetVol = this.getTargetVolume(snapshot)

    if (isMuted) {
      if (snapshot.useNativePlayer && nativeVideo) {
        nativeVideo.volume = 0
        nativeVideo.muted = true
      }
      this.bridge.updateProps({ volume: 0 })
    } else {
      if (snapshot.useNativePlayer && nativeVideo && !snapshot.isInThumbnailWindow) {
        nativeVideo.muted = this.isTargetMuted(snapshot)
        nativeVideo.volume = targetVol
      }
      this.bridge.updateProps({ volume: targetVol })
    }

    return {
      muteStateChanged,
      isMuted,
      targetVolume: targetVol,
      audioDataChanged
    }
  }

  public handleRemotionTimeUpdate(
    remotionTime: number,
    snapshot: PlaybackStateSnapshot,
    nativeVideo?: { currentTime: number } | null
  ): { newCurrentTime: number; shouldPause: boolean; needsDriftSync: boolean } {
    let shouldPause = false
    let newCurrentTime = remotionTime
    let needsDriftSync = false

    if (remotionTime >= snapshot.timelineDuration && snapshot.isPlaying) {
      newCurrentTime = snapshot.timelineDuration
      shouldPause = true
      this.bridge.pause()
    }

    // Conditional Sync Drift Evaluation (ADR-0004)
    if (snapshot.useNativePlayer && snapshot.isPlaying && nativeVideo && !snapshot.isInThumbnailWindow) {
      const diff = nativeVideo.currentTime - snapshot.videoTime
      if (Math.abs(diff) > 0.25) {
        needsDriftSync = true
        nativeVideo.currentTime = snapshot.videoTime
      }
    }

    return { newCurrentTime, shouldPause, needsDriftSync }
  }
}
