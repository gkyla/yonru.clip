import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  VideoPlaybackCoordinator,
  type PlaybackStateSnapshot
} from '../../app/utils/playbackCoordinator'
import { MockPlayerBridge } from '../../app/utils/playerBridge'

describe('VideoPlaybackCoordinator Unit Tests', () => {
  let bridge: MockPlayerBridge
  let coordinator: VideoPlaybackCoordinator

  const baseSnapshot: PlaybackStateSnapshot = {
    currentTime: 0,
    videoTime: 0,
    timelineDuration: 30,
    videoFps: 30,
    volume: 0.8,
    isPlaying: false,
    useNativePlayer: false,
    isTimelineShifting: false,
    videoUrl: 'http://localhost:8000/assets/clips/f/c/video.mp4',
    outputUrl: null,
    stableVideoBuster: '123',
    fullTranscript: [{ start: 0, duration: 2, text: 'Hello world' }],
    subtitleSyncOffset: 0,
    subtitleMode: 'word',
    activeHook: null,
    showIframeDebug: false,
    videoLayout: 'vertical',
    subtitlePosition: 'center',
    subtitleOffset: 50,
    cropMode: 'manual',
    cropMap: [],
    cropPercentX: 50,
    font: 'Montserrat',
    fontSize: 50,
    subtitleFontWeight: 900,
    subtitleTextColor: '#FFFFFF',
    subtitleHighlightColor: '#CFFF50',
    subtitleStrokeColor: '#000000',
    subtitleStrokeWidth: 4,
    subtitleTextTransform: 'uppercase',
    subtitleAnimation: 'pop',
    subtitleHighlightMode: 'color',
    subtitleBackground: 'none',
    subtitleBackgroundOpacity: 0.7,
    subtitleWordSpacing: 0,
    timelineTracks: [],
    thumbnailEnabled: false,
    thumbnailDuration: 1.0,
    thumbnailTextOverlays: [],
    isInThumbnailWindow: false,
    audioBleepEnabled: false
  }

  beforeEach(() => {
    bridge = new MockPlayerBridge()
    coordinator = new VideoPlaybackCoordinator(bridge)
  })

  describe('Remotion Props Assembly', () => {
    it('assembles complete props with font, duration in frames, and crop coordinates', () => {
      const props = coordinator.assembleRemotionProps(baseSnapshot, { width: 1920, height: 1080 })
      expect(props.videoPath).toContain('t=123')
      expect(props.durationInFrames).toBe(900) // 30s * 30fps
      expect(props.cropX).toBe(960) // 50% of 1920
      expect(props.subtitleStyle.fontFamily).toBe('Montserrat')
      expect(props.words.length).toBeGreaterThan(0)
    })
  })

  describe('Single Master Player Mode (ADR-0004)', () => {
    it('keeps native video paused when isPlaying is true but useNativePlayer is false', () => {
      const nativeVideo = {
        paused: true,
        muted: true,
        volume: 0,
        currentTime: 0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      }

      coordinator.handlePlayStateChange(true, { ...baseSnapshot, useNativePlayer: false }, nativeVideo)

      expect(nativeVideo.play).not.toHaveBeenCalled()
      expect(bridge.calls.some(c => c.type === 'play')).toBe(true)
    })

    it('plays native video when isPlaying is true and useNativePlayer is true', () => {
      const nativeVideo = {
        paused: true,
        muted: true,
        volume: 0,
        currentTime: 0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      }

      coordinator.handlePlayStateChange(
        true,
        { ...baseSnapshot, useNativePlayer: true, videoTime: 5.0 },
        nativeVideo
      )

      expect(nativeVideo.play).toHaveBeenCalled()
      expect(nativeVideo.currentTime).toBe(5.0)
    })

    it('suppresses sync drift corrections when useNativePlayer is false', () => {
      const nativeVideo = { currentTime: 0 }
      const res = coordinator.handleRemotionTimeUpdate(
        10.0,
        { ...baseSnapshot, isPlaying: true, useNativePlayer: false, videoTime: 10.0 },
        nativeVideo
      )

      expect(res.needsDriftSync).toBe(false)
      expect(nativeVideo.currentTime).toBe(0) // Untouched
    })

    it('triggers sync drift correction when useNativePlayer is true and drift > 0.25s', () => {
      const nativeVideo = { currentTime: 5.0 }
      const res = coordinator.handleRemotionTimeUpdate(
        10.0,
        { ...baseSnapshot, isPlaying: true, useNativePlayer: true, videoTime: 10.0 },
        nativeVideo
      )

      expect(res.needsDriftSync).toBe(true)
      expect(nativeVideo.currentTime).toBe(10.0) // Corrected
    })
  })

  describe('Mute State Deduplication (ADR-0005)', () => {
    it('detects state transitions and returns muteStateChanged', () => {
      const flaggedSnapshot: PlaybackStateSnapshot = {
        ...baseSnapshot,
        isPlaying: true,
        audioBleepEnabled: true,
        currentTime: 1.0,
        flaggedSegments: [{ start: 0.5, duration: 1.0 }] // Covers 1.0s
      }

      const res1 = coordinator.handleMuteVolumeChange(flaggedSnapshot)
      expect(res1.muteStateChanged).toBe(true)
      expect(res1.isMuted).toBe(true)
      expect(res1.targetVolume).toBe(0)

      // Subsequent call in the same muted state
      const res2 = coordinator.handleMuteVolumeChange(flaggedSnapshot)
      expect(res2.muteStateChanged).toBe(false) // Deduplicated!
    })
  })

  describe('Thumbnail Window Transitions', () => {
    it('holds native video at 0 and muted while in thumbnail window', () => {
      const nativeVideo = {
        paused: false,
        muted: false,
        volume: 0.8,
        currentTime: 5.0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      }

      coordinator.handleTimeChange(
        0.5,
        {
          ...baseSnapshot,
          isPlaying: true,
          useNativePlayer: true,
          thumbnailEnabled: true,
          thumbnailDuration: 2.0,
          isInThumbnailWindow: true
        },
        nativeVideo
      )

      expect(nativeVideo.currentTime).toBe(0)
      expect(nativeVideo.muted).toBe(true)
      expect(nativeVideo.pause).toHaveBeenCalled()
    })

    it('triggers native video playback upon crossing thumbnail boundary', () => {
      const nativeVideo = {
        paused: true,
        muted: true,
        volume: 0,
        currentTime: 0,
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn()
      }

      const res = coordinator.handleTimeChange(
        2.5,
        {
          ...baseSnapshot,
          isPlaying: true,
          useNativePlayer: true,
          thumbnailEnabled: true,
          thumbnailDuration: 2.0,
          isInThumbnailWindow: false,
          videoTime: 0.5
        },
        nativeVideo
      )

      expect(res.crossedThumbnailBoundary).toBe(true)
      expect(nativeVideo.currentTime).toBe(0.5)
      expect(nativeVideo.play).toHaveBeenCalled()
    })
  })
})
