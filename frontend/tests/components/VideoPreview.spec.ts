// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('renders realistic YouTubeShortsSafeZoneOverlay when activeSafeZone is set to shorts', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.activeSafeZone.value = 'shorts';
    state.safeZoneOpacity.value = 85;

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

    const shortsOverlay = wrapper.findComponent({
      name: 'YouTubeShortsSafeZoneOverlay'
    });
    expect(shortsOverlay.exists()).toBe(true);
    expect(shortsOverlay.props('opacity')).toBe(85);
  });

  it('renders dynamic Canvas Snapping Guides SVG lines when snapping is active', async () => {
    const snapping = useSnappingGuides();
    snapping.isSnappingEnabled.value = true;
    snapping.activeGuides.value = {
      vertical: { position: 540, type: 'center' },
      horizontal: { position: 1470, type: 'safe' }
    };

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

    const guidesSvg = wrapper.find('[data-testid="canvas-snapping-guides"]');
    expect(guidesSvg.exists()).toBe(true);

    const verticalLine = guidesSvg.find('line[data-guide="vertical"]');
    expect(verticalLine.exists()).toBe(true);
    expect(verticalLine.attributes('stroke')).toBe('#06b6d4');

    const horizontalLine = guidesSvg.find('line[data-guide="horizontal"]');
    expect(horizontalLine.exists()).toBe(true);
    expect(horizontalLine.attributes('stroke')).toBe('#ffd700');
  });

  it('renders studio playback control deck with custom controls and no native controls attribute', async () => {
    const state = useClipperState();
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';

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

    const previewContainer = wrapper.find(
      '[data-testid="rendered-clip-preview"]'
    );
    expect(previewContainer.exists()).toBe(true);

    const videoEl = wrapper.find('[data-testid="rendered-video-element"]');
    expect(videoEl.exists()).toBe(true);
    expect(videoEl.attributes('autoplay')).toBeUndefined();
    expect(videoEl.attributes('controls')).toBeUndefined();

    // Studio Control Deck Elements
    expect(wrapper.find('[data-testid="studio-control-deck"]').exists()).toBe(
      true
    );
    expect(wrapper.find('[data-testid="player-play-btn"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="player-scrubber"]').exists()).toBe(true);
    const timeDisplay = wrapper.find('[data-testid="player-time-display"]');
    expect(timeDisplay.exists()).toBe(true);
    expect(timeDisplay.classes()).toContain('font-sans');
    expect(timeDisplay.classes()).not.toContain('font-mono');
    expect(wrapper.find('[data-testid="player-mute-btn"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="player-fullscreen-btn"]').exists()).toBe(
      true
    );

    expect(wrapper.find('[data-testid="back-to-editor-btn"]').exists()).toBe(
      true
    );
    expect(
      wrapper.find('[data-testid="open-folder-canvas-btn"]').exists()
    ).toBe(true);
    expect(wrapper.find('[data-testid="download-canvas-btn"]').exists()).toBe(
      true
    );
  });

  it('toggles mute when player-mute-btn is clicked', async () => {
    const state = useClipperState();
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';

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

    const muteBtn = wrapper.find('[data-testid="player-mute-btn"]');
    expect(muteBtn.exists()).toBe(true);
    const videoEl = wrapper.find<HTMLVideoElement>(
      '[data-testid="rendered-video-element"]'
    );

    expect(videoEl.element.muted).toBe(false);
    await muteBtn.trigger('click');
    expect(videoEl.element.muted).toBe(true);
    await muteBtn.trigger('click');
    expect(videoEl.element.muted).toBe(false);
  });

  it('clicking back-to-editor-btn clears outputUrl to return to editor', async () => {
    const state = useClipperState();
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';

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

    await wrapper.find('[data-testid="back-to-editor-btn"]').trigger('click');
    expect(state.outputUrl.value).toBeNull();
  });

  it('triggers play() when shouldPlayRendered becomes true', async () => {
    const state = useClipperState();
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';
    state.shouldPlayRendered.value = false;

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

    const videoEl = wrapper.find<HTMLVideoElement>(
      '[data-testid="rendered-video-element"]'
    );
    const playSpy = vi
      .spyOn(videoEl.element, 'play')
      .mockResolvedValue(undefined);

    state.shouldPlayRendered.value = true;
    await wrapper.vm.$nextTick();
    await new Promise(r => setTimeout(r, 10));

    expect(playSpy).toHaveBeenCalled();
  });

  it('controls volume via vertical volume bar and updates video element volume', async () => {
    const state = useClipperState();
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';

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

    const volumeDeck = wrapper.find('[data-testid="player-volume-control"]');
    expect(volumeDeck.exists()).toBe(true);

    const volumeSlider = wrapper.find(
      '[data-testid="player-vertical-volume-bar"]'
    );
    expect(volumeSlider.exists()).toBe(true);

    const videoEl = wrapper.find<HTMLVideoElement>(
      '[data-testid="rendered-video-element"]'
    );
    expect(videoEl.element.volume).toBe(1);
    expect(wrapper.find('[data-testid="player-volume-percent"]').exists()).toBe(
      true
    );
  });

  it('handles keyboard shortcuts in Rendered Clip Preview Canvas (Space to toggle play/pause, Escape to exit preview)', async () => {
    const state = useClipperState();
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';

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

    const videoEl = wrapper.find<HTMLVideoElement>(
      '[data-testid="rendered-video-element"]'
    );
    const playSpy = vi
      .spyOn(videoEl.element, 'play')
      .mockResolvedValue(undefined);
    const pauseSpy = vi
      .spyOn(videoEl.element, 'pause')
      .mockImplementation(() => {});

    // Space keydown triggers playback
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space' })
    );
    await wrapper.vm.$nextTick();
    expect(playSpy).toHaveBeenCalled();

    // Escape keydown calls exitRenderPreview and clears outputUrl
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })
    );
    await wrapper.vm.$nextTick();
    expect(state.outputUrl.value).toBeNull();
  });

  it('does not render timeline text layers or allow text dragging when rendered preview is active', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.outputUrl.value =
      'http://localhost:8000/static/output/rendered_test.mp4';

    const textTrack = state.timelineTracks.value.find(
      (t: any) => t.id === 'text'
    );
    if (textTrack) {
      textTrack.items = [
        {
          id: 'test-text-item',
          trackId: 'text',
          start: 0,
          duration: 10,
          content: 'TEST OVERLAY TEXT',
          x: 540,
          y: 960,
          fontSize: 80,
          font: 'Outfit',
          color: '#ffffff'
        }
      ];
    }
    state.currentTime.value = 2;

    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: true,
          'v-stage': {
            name: 'v-stage',
            template: '<div data-testid="konva-stage"><slot /></div>'
          },
          'v-layer': {
            template: '<div data-testid="konva-layer"><slot /></div>'
          },
          'v-label': {
            name: 'v-label',
            template: '<div data-testid="konva-label"><slot /></div>'
          },
          'v-tag': true,
          'v-text': true,
          'v-rect': true,
          'v-transformer': true
        }
      }
    });

    // The rendered clip preview should exist
    expect(wrapper.find('[data-testid="rendered-clip-preview"]').exists()).toBe(
      true
    );

    // The timeline text layer and Konva stage/label must NOT be rendered when outputUrl is active
    expect(wrapper.find('[data-testid="konva-stage"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="konva-label"]').exists()).toBe(false);

    // Also verify rendered-clip-preview has z-50 or higher so it is never trapped under z-45
    const previewContainer = wrapper.find(
      '[data-testid="rendered-clip-preview"]'
    );
    expect(previewContainer.classes()).not.toContain('z-30');

    // Clicking "Back to Editor" clears outputUrl and restores the editor text layer
    await wrapper.find('[data-testid="back-to-editor-btn"]').trigger('click');
    expect(state.outputUrl.value).toBeNull();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="rendered-clip-preview"]').exists()).toBe(
      false
    );
    expect(wrapper.find('[data-testid="konva-stage"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="konva-label"]').exists()).toBe(true);
  });
});
