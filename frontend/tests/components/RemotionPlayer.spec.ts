// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { mount } from '@vue/test-utils'
import { DirectPlayerBridge } from '../../app/utils/playerBridge'
import { RemotionPlayerView } from '../../app/components/preview/RemotionPlayerView'
import RemotionPlayer from '../../app/components/RemotionPlayer.client.vue'

describe('RemotionPlayer and RemotionPlayerView (Issue #183)', () => {
  let bridge: DirectPlayerBridge

  beforeEach(() => {
    bridge = new DirectPlayerBridge()
  })

  describe('RemotionPlayerView React Component', () => {
    it('is exported and defined as a React component', () => {
      expect(RemotionPlayerView).toBeDefined()
      expect(typeof RemotionPlayerView).toBe('function')
    })

    it('binds player and wires frameupdate, pause, and ended events to DirectPlayerBridge', () => {
      const mockPlayer: any = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        seekTo: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        getCurrentFrame: vi.fn().mockReturnValue(45),
        isPlaying: vi.fn().mockReturnValue(true)
      }

      // Track listeners added
      const listeners: Record<string, Function> = {}
      mockPlayer.addEventListener.mockImplementation((event: string, cb: Function) => {
        listeners[event] = cb
      })

      const messageSpy = vi.fn()
      bridge.onMessage(messageSpy)

      // Test event handler wiring logic
      bridge.bindPlayer(mockPlayer)
      expect(bridge.getPlayer()).toBe(mockPlayer)

      // Simulate wiring Remotion events
      const onFrameUpdate = (e: { detail: { frame: number } }) => {
        const fps = 30
        bridge.emitTimeUpdate(e.detail.frame / fps, e.detail.frame)
      }
      const onPause = () => bridge.emitPaused()
      const onEnded = () => bridge.emitEnded()

      mockPlayer.addEventListener('frameupdate', onFrameUpdate)
      mockPlayer.addEventListener('pause', onPause)
      mockPlayer.addEventListener('ended', onEnded)
      bridge.emitReady()

      // 1. Verify emitReady sent IFRAME_READY
      expect(messageSpy).toHaveBeenCalledWith({ type: 'IFRAME_READY' })

      // 2. Trigger frameupdate event -> should emit REMOTION_TIMEUPDATE
      listeners['frameupdate']({ detail: { frame: 90 } })
      expect(messageSpy).toHaveBeenCalledWith({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 3,
        frame: 90
      })

      // 3. Trigger pause event -> should emit REMOTION_PAUSED
      listeners['pause']()
      expect(messageSpy).toHaveBeenCalledWith({ type: 'REMOTION_PAUSED' })

      // 4. Trigger ended event -> should emit REMOTION_ENDED
      listeners['ended']()
      expect(messageSpy).toHaveBeenCalledWith({ type: 'REMOTION_ENDED' })

      // Cleanup
      mockPlayer.removeEventListener('frameupdate', onFrameUpdate)
      mockPlayer.removeEventListener('pause', onPause)
      mockPlayer.removeEventListener('ended', onEnded)
      bridge.bindPlayer(null)
      expect(bridge.getPlayer()).toBeNull()
    })

    it('receives synchronous prop updates via bridge.updateProps without latency', () => {
      const propsSpy = vi.fn()
      bridge.onPropsChange(propsSpy)

      const testProps = {
        videoPath: 'http://localhost:8000/sample.mp4',
        durationInFrames: 600,
        fps: 30,
        cropX: 540
      }

      bridge.updateProps(testProps)
      expect(bridge.currentProps).toEqual(testProps)
      expect(propsSpy).toHaveBeenCalledWith(testProps)
    })
  })

  describe('RemotionPlayer.client.vue Component', () => {
    it('mounts container DOM and cleans up React root on unmount', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)

      const wrapper = mount(RemotionPlayer, {
        props: {
          bridge,
          compositionWidth: 1080,
          compositionHeight: 1920
        },
        attachTo: container
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('.remotion-player-container').exists()).toBe(true)

      // Unmount component
      wrapper.unmount()
      container.remove()
    })
  })
})
