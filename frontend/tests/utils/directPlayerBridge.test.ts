import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DirectPlayerBridge,
  type PlayerRefTarget
} from '../../app/utils/playerBridge'

describe('DirectPlayerBridge Unit Tests', () => {
  let bridge: DirectPlayerBridge
  let mockPlayer: {
    play: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    seekTo: ReturnType<typeof vi.fn>
    getCurrentFrame: ReturnType<typeof vi.fn>
    isPlaying: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockPlayer = {
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(),
      getCurrentFrame: vi.fn().mockReturnValue(120),
      isPlaying: vi.fn().mockReturnValue(true)
    }
    bridge = new DirectPlayerBridge()
  })

  describe('Player Reference Resolution & Binding', () => {
    it('initializes with null player and resolves to null safely', () => {
      expect(bridge.getPlayer()).toBeNull()
      expect(() => {
        bridge.play()
        bridge.pause()
        bridge.seek(100)
      }).not.toThrow()
    })

    it('binds to a React-style ref object ({ current: player })', () => {
      const reactRef = { current: mockPlayer }
      bridge.bindPlayer(reactRef)
      expect(bridge.getPlayer()).toBe(mockPlayer)

      bridge.play()
      expect(mockPlayer.play).toHaveBeenCalledTimes(1)
    })

    it('binds to a Vue-style ref object ({ value: player })', () => {
      const vueRef = { value: mockPlayer }
      bridge.bindPlayer(vueRef)
      expect(bridge.getPlayer()).toBe(mockPlayer)

      bridge.pause()
      expect(mockPlayer.pause).toHaveBeenCalledTimes(1)
    })

    it('binds to direct player object instance', () => {
      bridge.bindPlayer(mockPlayer)
      expect(bridge.getPlayer()).toBe(mockPlayer)

      bridge.seek(300)
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(300)
    })

    it('accepts player ref in constructor', () => {
      const ctorBridge = new DirectPlayerBridge({ current: mockPlayer })
      expect(ctorBridge.getPlayer()).toBe(mockPlayer)
      ctorBridge.play()
      expect(mockPlayer.play).toHaveBeenCalledTimes(1)
    })

    it('queries getCurrentFrame and isPlaying when available', () => {
      bridge.bindPlayer(mockPlayer)
      expect(bridge.getCurrentFrame()).toBe(120)
      expect(bridge.isPlaying()).toBe(true)

      const emptyBridge = new DirectPlayerBridge()
      expect(emptyBridge.getCurrentFrame()).toBeNull()
      expect(emptyBridge.isPlaying()).toBeNull()
    })
  })

  describe('Props Management & In-Memory Dispatching', () => {
    it('synchronously updates currentProps and notifies listeners', () => {
      const propsSpy = vi.fn()
      const messageSpy = vi.fn()

      const unsubProps = bridge.onPropsChange(propsSpy)
      const unsubMessage = bridge.onMessage(messageSpy)

      const testProps = {
        videoPath: 'https://localhost:8000/test.mp4',
        durationInFrames: 600,
        volume: 0.75
      }

      bridge.updateProps(testProps)

      expect(bridge.currentProps).toEqual(testProps)
      expect(propsSpy).toHaveBeenCalledWith(testProps)
      expect(messageSpy).toHaveBeenCalledWith({
        type: 'UPDATE_PROPS',
        payload: testProps
      })

      // Unsubscribe checks
      unsubProps()
      unsubMessage()
      bridge.updateProps({ volume: 0.2 })
      expect(propsSpy).toHaveBeenCalledTimes(1)
      expect(messageSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Remotion Event Notifications & Emitters', () => {
    it('emits generic messages to onMessage subscribers', () => {
      const listener = vi.fn()
      const unsub = bridge.onMessage(listener)

      bridge.emitMessage({ type: 'CUSTOM_EVENT', data: 42 })
      expect(listener).toHaveBeenCalledWith({ type: 'CUSTOM_EVENT', data: 42 })

      unsub()
      bridge.emitMessage({ type: 'ANOTHER_EVENT' })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('emits time updates matching REMOTION_TIMEUPDATE contract', () => {
      const listener = vi.fn()
      bridge.onMessage(listener)

      bridge.emitTimeUpdate(5.25, 157)
      expect(listener).toHaveBeenCalledWith({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 5.25,
        frame: 157
      })
    })

    it('emits pause, ended, and ready lifecycle events', () => {
      const listener = vi.fn()
      bridge.onMessage(listener)

      bridge.emitPaused()
      expect(listener).toHaveBeenCalledWith({ type: 'REMOTION_PAUSED' })

      bridge.emitEnded()
      expect(listener).toHaveBeenCalledWith({ type: 'REMOTION_ENDED' })

      bridge.emitReady()
      expect(listener).toHaveBeenCalledWith({ type: 'IFRAME_READY' })
    })
  })

  describe('Lifecycle Cleanup (destroy)', () => {
    it('resets player binding and clears all message and props listeners', () => {
      const propsListener = vi.fn()
      const messageListener = vi.fn()

      bridge.bindPlayer(mockPlayer)
      bridge.onPropsChange(propsListener)
      bridge.onMessage(messageListener)

      bridge.destroy()

      expect(bridge.getPlayer()).toBeNull()
      expect(bridge.currentProps).toBeNull()

      bridge.updateProps({ test: true })
      bridge.emitMessage({ type: 'TEST' })
      bridge.play()

      expect(propsListener).not.toHaveBeenCalled()
      expect(messageListener).not.toHaveBeenCalled()
      expect(mockPlayer.play).not.toHaveBeenCalled()
    })
  })

  describe('Integration with VideoPlaybackCoordinator', () => {
    it('dispatches play and seek commands via coordinator seamlessly', async () => {
      const { VideoPlaybackCoordinator } = await import('../../app/utils/playbackCoordinator')
      bridge.bindPlayer(mockPlayer)
      const coordinator = new VideoPlaybackCoordinator(bridge)

      const baseSnapshot = {
        currentTime: 0,
        videoTime: 0,
        timelineDuration: 30,
        videoFps: 30,
        volume: 0.8,
        isPlaying: false,
        useNativePlayer: false,
        isTimelineShifting: false,
        videoUrl: 'http://localhost:8000/video.mp4',
        outputUrl: null,
        stableVideoBuster: '123',
        fullTranscript: [],
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
      } as any

      coordinator.handlePlayStateChange(true, baseSnapshot, null)
      expect(mockPlayer.play).toHaveBeenCalledTimes(1)

      coordinator.handleTimeChange(4.0, baseSnapshot, null)
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(120) // 4.0 * 30fps
    })
  })
})

