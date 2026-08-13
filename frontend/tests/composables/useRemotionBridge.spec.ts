// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick, createApp, defineComponent } from 'vue'
import { useState } from '#app'
import { useRemotionBridge } from '../../app/composables/useRemotionBridge'
import { useClipperState } from '../../app/composables/useClipperState'
import { MockPlayerBridge } from '../../app/utils/playerBridge'

vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ status: 'ok' }))

// Helper to wrap composables that use Vue lifecycle hooks
function withSetup<T>(composable: () => T) {
  let result: T | undefined
  const app = createApp(defineComponent({
    setup() {
      result = composable()
      return () => {}
    }
  }))
  app.mount(document.createElement('div'))
  return [result!, app] as const
}

describe('useRemotionBridge Composable', () => {
  let bridge: MockPlayerBridge
  let state: any

  beforeEach(() => {
    // Reset global Nuxt states
    const volume = useState<number>('volume', () => 1)
    const isPlaying = useState<boolean>('isPlaying', () => false)
    const currentTime = useState<number>('currentTime', () => 0)
    const videoUrl = useState<string>('videoUrl', () => '')
    const cropPercentX = useState<number>('cropPercentX', () => 50)
    const fullTranscript = useState<any[]>('fullTranscript', () => [])
    const subtitleMode = useState<string>('subtitleMode', () => 'word')
    const timelineTracks = useState<any[]>('timelineTracks', () => [
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
      { id: 'text', name: 'Text layers', type: 'text', items: [] },
      { id: 'subtitle', name: 'Subtitle', type: 'subtitle', items: [] }
    ])
    const isTimelineShifting = useState<boolean>('isTimelineShifting', () => false)
    const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
    const thumbnailDuration = useState<number>('thumbnailDuration', () => 0)
    const useNativePlayer = useState<boolean>('useNativePlayer', () => false)
    const videoFps = useState<number>('videoFps', () => 30)

    volume.value = 0.8
    isPlaying.value = false
    currentTime.value = 0
    videoUrl.value = 'http://localhost:8000/assets/test.mp4'
    cropPercentX.value = 50
    fullTranscript.value = []
    subtitleMode.value = 'word'
    timelineTracks.value = [
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
      { id: 'text', name: 'Text layers', type: 'text', items: [] },
      { id: 'subtitle', name: 'Subtitle', type: 'subtitle', items: [] }
    ]
    isTimelineShifting.value = false
    thumbnailEnabled.value = false
    thumbnailDuration.value = 0
    useNativePlayer.value = false
    videoFps.value = 30

    bridge = new MockPlayerBridge()
    state = useClipperState()
  })

  it('synchronizes props automatically on setup', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()

    // Find the updateProps call
    const updateCall = bridge.calls.find(c => c.type === 'updateProps')
    expect(updateCall).toBeDefined()
    expect(updateCall?.payload.videoPath).toContain('http://localhost:8000/assets/test.mp4?t=test-buster')
    expect(updateCall?.payload.volume).toBe(0.8)
    expect(updateCall?.payload.cropX).toBe(960) // 50% of 1920

    app.unmount()
  })

  it('triggers play/pause events when isPlaying changes', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()
    bridge.calls = [] // Clear initial calls

    state.isPlaying.value = true
    await nextTick()
    expect(bridge.calls.some(c => c.type === 'play')).toBe(true)

    state.isPlaying.value = false
    await nextTick()
    expect(bridge.calls.some(c => c.type === 'pause')).toBe(true)

    app.unmount()
  })

  it('triggers props update when volume changes', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()
    bridge.calls = [] // Clear initial calls

    state.volume.value = 0.4
    await nextTick()

    const updateCall = bridge.calls.find(c => c.type === 'updateProps')
    expect(updateCall).toBeDefined()
    expect(updateCall?.payload.volume).toBe(0.4)

    app.unmount()
  })

  it('triggers seek when currentTime changes and player is paused', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()
    bridge.calls = [] // Clear initial calls

    state.currentTime.value = 10.5
    await nextTick()

    const seekCall = bridge.calls.find(c => c.type === 'seek')
    expect(seekCall).toBeDefined()
    expect(seekCall?.frame).toBe(315) // 10.5s * 30fps = 315

    app.unmount()
  })

  it('seeks on external currentTime change even if player is playing', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()
    state.isPlaying.value = true
    await nextTick()
    bridge.calls = [] // Clear initial calls

    state.currentTime.value = 12.0
    await nextTick()

    const seekCall = bridge.calls.find(c => c.type === 'seek')
    expect(seekCall?.frame).toBe(360)

    app.unmount()
  })

  it('handles REMOTION_TIMEUPDATE events and updates state.currentTime', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()

    bridge.emitMessage({
      type: 'REMOTION_TIMEUPDATE',
      currentTime: 15.75
    })

    await nextTick()
    expect(state.currentTime.value).toBe(15.75)

    app.unmount()
  })

  it('handles IFRAME_READY events and performs initial sync and seek', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()
    bridge.calls = [] // Clear setup calls

    bridge.emitMessage({
      type: 'IFRAME_READY'
    })

    await nextTick()
    // Should have updated props and seeked to current time
    expect(bridge.calls.some(c => c.type === 'updateProps')).toBe(true)
    expect(bridge.calls.some(c => c.type === 'seek')).toBe(true)

    app.unmount()
  })

  it('mutes video volume when currentTime overlaps a flagged segment', async () => {
    const mockVideoEl = {
      volume: 0.5,
      muted: false,
      paused: false,
      play: async () => {},
      pause: () => {}
    } as any
    const previewVideo = ref<HTMLVideoElement | null>(mockVideoEl)

    // Mock contentAudit flagged segments on the state object using defineProperty BEFORE setup
    Object.defineProperty(state, 'contentAudit', {
      value: ref({
        flaggedSegments: [{ start: 2.0, duration: 1.5 }]
      }),
      writable: true,
      configurable: true
    })
    state.audioBleepEnabled.value = true
    state.useNativePlayer.value = true
    state.subtitleSyncOffset.value = 0
    state.volume.value = 0.5
    state.isPlaying.value = true

    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()

    // 1. Outside flagged segment (currentTime = 0.5) -> volume should be state.volume
    state.currentTime.value = 0.5
    await nextTick()
    expect(mockVideoEl.volume).toBe(0.5)
    expect(mockVideoEl.muted).toBe(false)

    // 2. Inside flagged segment (currentTime = 2.5) -> volume should be 0, muted should be true
    state.currentTime.value = 2.5
    await nextTick()
    expect(mockVideoEl.volume).toBe(0)
    expect(mockVideoEl.muted).toBe(true)

    // 3. Back outside (currentTime = 4.0) -> volume and muted restored
    state.currentTime.value = 4.0
    await nextTick()
    expect(mockVideoEl.volume).toBe(0.5)
    expect(mockVideoEl.muted).toBe(false)

    app.unmount()
  })

  it('keeps native video element paused when isPlaying changes and useNativePlayer is false', async () => {
    const mockPlay = vi.fn().mockResolvedValue(undefined)
    const mockPause = vi.fn()
    const mockVideoEl = {
      volume: 1.0,
      muted: false,
      paused: true,
      play: mockPlay,
      pause: mockPause
    } as any
    const previewVideo = ref<HTMLVideoElement | null>(mockVideoEl)

    state.useNativePlayer.value = false

    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()

    state.isPlaying.value = true
    await nextTick()

    // Native video play should NOT have been called because useNativePlayer is false
    expect(mockPlay).not.toHaveBeenCalled()
    expect(bridge.calls.some(c => c.type === 'play')).toBe(true)

    app.unmount()
  })

  it('automatically triggers props update when videoLayout state changes', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)

    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    state.videoLayout.value = 'landscape'
    await nextTick()

    const updateCalls = bridge.calls.filter(c => c.type === 'updateProps')
    expect(updateCalls.length).toBeGreaterThan(0)
    expect(updateCalls[updateCalls.length - 1]?.payload?.videoLayout).toBe('landscape')

    app.unmount()
  })

  it('passes cropMap when cropMode is face_tracking and updates on cropMap/cropMode change', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)

    state.cropMode.value = 'face_tracking'
    state.cropMap.value = [{ time: 0, x: 500 }, { time: 2, x: 800 }]

    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      ref(0),
      ref(false),
      ref('test-buster')
    ))

    await nextTick()
    bridge.calls = [] // Clear initial calls

    state.cropMap.value = [{ time: 0, x: 600 }, { time: 3, x: 900 }]
    await nextTick()

    let updateCalls = bridge.calls.filter(c => c.type === 'updateProps')
    expect(updateCalls.length).toBeGreaterThan(0)
    expect(updateCalls[updateCalls.length - 1]?.payload?.cropMap).toEqual([{ time: 0, x: 600 }, { time: 3, x: 900 }])

    // Switch to manual cropMode -> cropMap sent to bridge should be empty
    state.cropMode.value = 'manual'
    await nextTick()

    updateCalls = bridge.calls.filter(c => c.type === 'updateProps')
    expect(updateCalls[updateCalls.length - 1]?.payload?.cropMap).toEqual([])

    app.unmount()
  })
})
