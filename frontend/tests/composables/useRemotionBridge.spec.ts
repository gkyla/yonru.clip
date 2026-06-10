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
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] }
    ])

    volume.value = 0.8
    isPlaying.value = false
    currentTime.value = 0
    videoUrl.value = 'http://localhost:8000/assets/test.mp4'
    cropPercentX.value = 50
    fullTranscript.value = []
    subtitleMode.value = 'word'
    timelineTracks.value = [
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] }
    ]

    bridge = new MockPlayerBridge()
    state = useClipperState()
  })

  it('synchronizes props automatically on setup', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      0,
      false,
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
      0,
      false,
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
      0,
      false,
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
      0,
      false,
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

  it('does not seek on currentTime change if player is playing', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      0,
      false,
      ref('test-buster')
    ))

    await nextTick()
    state.isPlaying.value = true
    await nextTick()
    bridge.calls = [] // Clear initial calls

    state.currentTime.value = 12.0
    await nextTick()

    const seekCall = bridge.calls.find(c => c.type === 'seek')
    expect(seekCall).toBeUndefined()

    app.unmount()
  })

  it('handles REMOTION_TIMEUPDATE events and updates state.currentTime', async () => {
    const previewVideo = ref<HTMLVideoElement | null>(null)
    const [_, app] = withSetup(() => useRemotionBridge(
      bridge,
      previewVideo,
      0,
      false,
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
      0,
      false,
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
})
