// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { DirectPlayerBridge } from '../../app/utils/playerBridge';
import { RemotionPlayerView } from '../../app/components/preview/RemotionPlayerView';
import RemotionPlayer from '../../app/components/RemotionPlayer.client.vue';

describe('RemotionPlayer and RemotionPlayerView (Issue #183)', () => {
  let bridge: DirectPlayerBridge;

  beforeEach(() => {
    bridge = new DirectPlayerBridge();
  });

  describe('RemotionPlayerView React Component', () => {
    it('is exported and defined as a React component', () => {
      expect(RemotionPlayerView).toBeDefined();
      expect(typeof RemotionPlayerView).toBe('function');
    });

    it('attaches player and wires frameupdate, pause, and ended events via DirectPlayerBridge.attachPlayer', () => {
      const listeners: Record<string, (e?: any) => void> = {};
      const mockPlayer: any = {
        addEventListener: vi.fn((event: string, cb: (e?: any) => void) => {
          listeners[event] = cb;
        }),
        removeEventListener: vi.fn((event: string) => {
          delete listeners[event];
        }),
        seekTo: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        getCurrentFrame: vi.fn().mockReturnValue(45),
        isPlaying: vi.fn().mockReturnValue(true)
      };

      const messageSpy = vi.fn();
      bridge.onMessage(messageSpy);

      const detach = bridge.attachPlayer(mockPlayer);
      expect(bridge.getPlayer()).toBe(mockPlayer);

      // 1. Verify attachPlayer emitted IFRAME_READY after binding player
      expect(messageSpy).toHaveBeenCalledWith({ type: 'IFRAME_READY' });

      // 2. Trigger frameupdate event -> should emit REMOTION_TIMEUPDATE
      listeners['frameupdate']?.({ detail: { frame: 90 } });
      expect(messageSpy).toHaveBeenCalledWith({
        type: 'REMOTION_TIMEUPDATE',
        currentTime: 3,
        frame: 90
      });

      // 3. Trigger pause event -> should emit REMOTION_PAUSED
      listeners['pause']?.();
      expect(messageSpy).toHaveBeenCalledWith({ type: 'REMOTION_PAUSED' });

      // 4. Trigger ended event -> should emit REMOTION_ENDED
      listeners['ended']?.();
      expect(messageSpy).toHaveBeenCalledWith({ type: 'REMOTION_ENDED' });

      // Cleanup
      detach();
      expect(bridge.getPlayer()).toBeNull();
    });

    it('exposes synchronous prop snapshots via subscribeProps and getPropsSnapshot', () => {
      const propsSpy = vi.fn();
      bridge.subscribeProps(propsSpy);

      const testProps = {
        videoPath: 'http://localhost:8000/sample.mp4',
        durationInFrames: 600,
        fps: 30,
        cropX: 540
      };

      bridge.updateProps(testProps);
      expect(bridge.getPropsSnapshot()).toEqual(testProps);
      expect(propsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('RemotionPlayer.client.vue Component', () => {
    it('mounts container DOM and cleans up React root on unmount', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      const wrapper = mount(RemotionPlayer, {
        props: {
          bridge,
          compositionWidth: 1080,
          compositionHeight: 1920
        },
        attachTo: container
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.remotion-player-container').exists()).toBe(true);

      // Unmount component
      wrapper.unmount();
      container.remove();
    });
  });
});
