// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import VideoPreview from '../../app/components/VideoPreview.vue';
import { useClipperState } from '../../app/composables/useClipperState';

describe('VideoPreview Component', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.videoUrl.value = null;
    state.outputUrl.value = null;
    state.useNativePlayer.value = false;
  });

  it('mounts successfully without TDZ ReferenceError on videoTime or isInThumbnailWindow', () => {
    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('mounts in-memory RemotionPlayer component inside ClientOnly instead of legacy iframe', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.useNativePlayer.value = false;

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: {
            template: '<div class="client-only-stub"><slot /></div>'
          },
          RemotionPlayer: {
            props: ['bridge'],
            template: '<div class="remotion-player-stub"></div>'
          },
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    // Confirm legacy iframe is completely eliminated
    expect(wrapper.find('iframe').exists()).toBe(false);

    // Confirm RemotionPlayer is mounted
    const playerStub = wrapper.find('.remotion-player-stub');
    expect(playerStub.exists()).toBe(true);
  });

  it('renders ClientOnly fallback placeholder when client fallback is active', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.useNativePlayer.value = false;

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: {
            template:
              '<div class="client-only-fallback"><slot name="fallback" /></div>'
          },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    expect(wrapper.text()).toContain('Loading video player...');
  });

  it('centers auto-adaptive subtitles strictly at 50% without offset when in split mode', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.useNativePlayer.value = true;
    state.autoAdaptiveSubtitles.value = true;
    state.subtitlePosition.value = 'bottom';
    state.subtitleOffset.value = 120;
    state.currentTime.value = 5.0;
    state.cropMap.value = [
      { time: 0, x: 500, mode: 'single' },
      { time: 4.0, x: 500, mode: 'split', top_x: 400, bottom_x: 600 }
    ];

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    const overlay = wrapper.find(
      '.absolute.left-1\\/2.-translate-x-1\\/2.z-40'
    );
    expect(overlay.exists()).toBe(true);
    const styleAttr = overlay.attributes('style') || '';
    expect(styleAttr).toContain('top: 50%');
    expect(styleAttr).toContain('transform: translate(-50%, -50%)');
    expect(styleAttr).not.toContain('120px');
  });

  it('respects user-selected position and subtitleOffset in single-speaker mode', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.useNativePlayer.value = true;
    state.autoAdaptiveSubtitles.value = true;
    state.subtitlePosition.value = 'bottom';
    state.subtitleOffset.value = 85;
    state.currentTime.value = 1.0;
    state.cropMap.value = [
      { time: 0, x: 500, mode: 'single' },
      { time: 4.0, x: 500, mode: 'split', top_x: 400, bottom_x: 600 }
    ];

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    const overlay = wrapper.find(
      '.absolute.left-1\\/2.-translate-x-1\\/2.z-40'
    );
    expect(overlay.exists()).toBe(true);
    const styleAttr = overlay.attributes('style') || '';
    expect(styleAttr).toContain('bottom: 85px');
  });

  it('renders realistic TikTokSafeZoneOverlay when activeSafeZone is set to tiktok', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.activeSafeZone.value = 'tiktok';
    state.safeZoneOpacity.value = 65;

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    const tikTokOverlay = wrapper.findComponent({
      name: 'TikTokSafeZoneOverlay'
    });
    expect(tikTokOverlay.exists()).toBe(true);
    expect(tikTokOverlay.props('opacity')).toBe(65);
  });

  it('renders realistic ReelsSafeZoneOverlay when activeSafeZone is set to reels', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.activeSafeZone.value = 'reels';
    state.safeZoneOpacity.value = 70;

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': true,
          'v-layer': true,
          'v-label': true,
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    const reelsOverlay = wrapper.findComponent({
      name: 'ReelsSafeZoneOverlay'
    });
    expect(reelsOverlay.exists()).toBe(true);
    expect(reelsOverlay.props('opacity')).toBe(70);
  });
});
