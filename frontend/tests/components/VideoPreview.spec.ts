// @vitest-environment nuxt
import { nextTick } from 'vue';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import VideoPreview from '../../app/components/VideoPreview.vue';
import { useClipperState } from '../../app/composables/useClipperState';
import type { DirectPlayerBridge } from '../../app/utils/playerBridge';

enableAutoUnmount(afterEach);

describe('VideoPreview Component', () => {
  beforeEach(() => {
    const state = useClipperState();
    state.videoUrl.value = null;
    state.outputUrl.value = null;
    state.isPlaying.value = false;
    state.isMediaLoading.value = false;
    state.videoDuration.value = 0;
    state.thumbnailEditMode.value = false;
    state.thumbnailEnabled.value = false;
    state.thumbnailUrl.value = null;
    state.coverEnabled.value = false;
    state.coverUrl.value = null;
    state.currentTime.value = 0;
    state.timelineTracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];
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

  it('mounts in-memory RemotionPlayer component inside ClientOnly with zero native preview <video> element', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';

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

    // Confirm legacy iframe and dead dual-decoder #preview-video-element are eliminated
    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(wrapper.find('#preview-video-element').exists()).toBe(false);
    expect(wrapper.find('video').exists()).toBe(false);

    // Confirm RemotionPlayer is mounted
    const playerStub = wrapper.find('.remotion-player-stub');
    expect(playerStub.exists()).toBe(true);
  });

  it('renders ClientOnly fallback placeholder when client fallback is active', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';

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

  it('projects single-decoder metadata, readiness, and auto-adaptive subtitle settings through the Remotion bridge', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.isMediaLoading.value = true;
    state.videoDuration.value = 0;
    state.autoAdaptiveSubtitles.value = true;
    state.subtitlePosition.value = 'bottom';
    state.subtitleOffset.value = 120;

    let capturedBridge: DirectPlayerBridge | null = null;
    const wrapper = mount(VideoPreview, {
      global: {
        stubs: {
          Icon: true,
          ClientOnly: { template: '<div><slot /></div>' },
          RemotionPlayer: {
            props: ['bridge'],
            setup(props: Record<string, unknown>) {
              capturedBridge = props.bridge as DirectPlayerBridge;
              return {};
            },
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

    expect(capturedBridge).not.toBeNull();
    capturedBridge!.emitMediaMetadata(1280, 720, 18.5);
    capturedBridge!.emitMediaReady();
    await nextTick();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    expect(state.videoDuration.value).toBe(18.5);
    expect(state.isMediaLoading.value).toBe(false);
    expect(capturedBridge!.currentProps).toEqual(
      expect.objectContaining({
        sourceWidth: 1280,
        sourceHeight: 720,
        autoAdaptiveSubtitles: true,
        position: 'bottom',
        subtitleOffset: 120
      })
    );
    expect((wrapper.vm as any).videoAspect).toBeCloseTo(1280 / 720);
  });

  it('gates Timeline Text Layer and Cover Slide Konva stages on item visibility and cover state', async () => {
    const state = useClipperState();
    state.videoUrl.value = 'http://localhost:8000/sample.mp4';
    state.thumbnailUrl.value = 'http://localhost:8000/cover.jpg';
    state.thumbnailEnabled.value = true;
    state.thumbnailDuration.value = 2.0;
    state.currentTime.value = 3.0; // outside cover window
    state.thumbnailEditMode.value = false;

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

    // Zero timeline text items and outside cover window => 0 Konva stages mounted
    expect(wrapper.findAll('[data-testid="konva-stage"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="cover-slide-preview"]').exists()).toBe(
      false
    );

    // Add a visible text item starting later (5s..10s); currentTime is 3s (cue gap)
    // Stage mounts and remains mounted across cue gaps
    state.timelineTracks.value = [
      {
        id: 'text',
        name: 'Text 1',
        type: 'text',
        hidden: false,
        items: [{ id: 't1', start: 5, duration: 5, content: 'Later' }]
      },
      { id: 'video', name: 'Main Video', type: 'video', items: [] }
    ];
    await nextTick();
    expect(wrapper.findAll('[data-testid="konva-stage"]')).toHaveLength(1);
    expect(wrapper.findAll('[data-testid="konva-label"]')).toHaveLength(0);

    // Entering Cover Slide edit mode mounts Cover Slide Konva stage and unmounts Timeline Text stage
    state.thumbnailEditMode.value = true;
    await nextTick();
    const coverStage = wrapper.find('[data-testid="cover-slide-preview"]');
    expect(coverStage.exists()).toBe(true);
    expect(coverStage.find('[data-testid="konva-stage"]').exists()).toBe(true);
  });

  it('pauses playback and detaches/reattaches window keydown and resize listeners cleanly across keepalive deactivation', async () => {
    const state = useClipperState();
    state.outputUrl.value = 'http://localhost:8000/static/output/rendered.mp4';
    state.isPlaying.value = true;

    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

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
    let isPaused = false;
    const playSpy = vi
      .spyOn(videoEl.element, 'play')
      .mockImplementation(async () => {
        isPaused = false;
      });
    const pauseSpy = vi
      .spyOn(videoEl.element, 'pause')
      .mockImplementation(() => {
        isPaused = true;
      });
    Object.defineProperty(videoEl.element, 'paused', {
      get: () => isPaused,
      configurable: true
    });

    const instance = wrapper.vm.$.vnode.component as {
      da?: Array<() => void>;
      a?: Array<() => void>;
    } | null;
    expect(instance?.da?.length).toBeGreaterThan(0);

    // Deactivate (navigating away under keepalive)
    instance?.da?.forEach(hook => hook());
    await nextTick();

    expect(state.isPlaying.value).toBe(false);
    expect(pauseSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));

    // Space keydown while deactivated must not trigger play()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space' })
    );
    await nextTick();
    expect(playSpy).not.toHaveBeenCalled();

    // Re-activate -> listeners reattach without duplicates
    addSpy.mockClear();
    instance?.a?.forEach(hook => hook());
    await nextTick();
    expect(
      addSpy.mock.calls.filter(call => String(call[0]) === 'keydown')
    ).toHaveLength(1);
    expect(
      addSpy.mock.calls.filter(call => String(call[0]) === 'resize')
    ).toHaveLength(1);

    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space' })
    );
    await nextTick();
    expect(playSpy).toHaveBeenCalledTimes(1);

    removeSpy.mockClear();
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
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
