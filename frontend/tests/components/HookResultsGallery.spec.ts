// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import HookResultsGallery from '../../app/components/home/HookResultsGallery.vue';
import { ref } from 'vue';

const mockState = {
  hooks: ref([
    {
      start: 10,
      end: 40,
      theme: 'How AI Automation Works',
      transcript_quote:
        'We built an agent that automates the entire workflow seamlessly.',
      virality_score: 95,
      virality_reason: 'High intrigue hook with strong value proposition.'
    },
    {
      start: 50,
      end: 80,
      theme: 'The Secret to Growth',
      transcript_quote: 'Growth comes from consistency and rapid iteration.',
      virality_score: 82,
      virality_reason: 'Solid topic but pacing is moderate.'
    },
    {
      start: 100,
      end: 130,
      theme: 'Behind the Scenes Setup',
      transcript_quote: 'Here is the setup we used in the studio.',
      virality_score: 65,
      virality_reason: 'Informational segment with low virality.'
    }
  ]),
  savedHooks: ref([
    {
      start: 10,
      end: 40,
      theme: 'How AI Automation Works',
      transcript_quote:
        'We built an agent that automates the entire workflow seamlessly.',
      virality_score: 95,
      virality_reason: 'High intrigue hook with strong value proposition.'
    }
  ]),
  folderName: ref('test_folder'),
  clipId: ref(''),
  jobStatus: ref('idle'),
  activeHook: ref(null),
  hdReady: ref(false),
  downloadPercent: ref(0),
  videoUrl: ref('http://localhost:8000/static/test_folder/full.mp4'),
  hasPreview: ref(true),
  videoDuration: ref(300),
  startSafetyBuffer: ref(2),
  saveHook: vi.fn(),
  deleteSavedHook: vi.fn(),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
};

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}));

describe('HookResultsGallery Component (Cinematic Hook Cards)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.savedHooks.value = [
      {
        start: 10,
        end: 40,
        theme: 'How AI Automation Works',
        transcript_quote:
          'We built an agent that automates the entire workflow seamlessly.',
        virality_score: 95,
        virality_reason: 'High intrigue hook with strong value proposition.'
      }
    ];
  });

  it('renders unified hook score pill in top-left overlay with virality color tiers', () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    });

    // First card: Hook 01 with score 95 (emerald tier)
    const text = wrapper.text();
    expect(text).toContain('HOOK 01');
    expect(text).toContain('95');

    // Check virality score color styling on first card
    const emeraldPills = wrapper.findAll('.text-emerald-400');
    expect(emeraldPills.length).toBeGreaterThan(0);

    // Check second card score 82 (cyan tier)
    expect(text).toContain('HOOK 02');
    expect(text).toContain('82');
    const cyanPills = wrapper.findAll('.text-cyan-400');
    expect(cyanPills.length).toBeGreaterThan(0);

    // Check third card score 65 (slate tier)
    expect(text).toContain('HOOK 03');
    expect(text).toContain('65');
  });

  it('renders ambient ready indicator when hook matches a ready clip', () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: [
          {
            clip_id: '8_40_How_AI_Automation_Works',
            folder_name: 'test_folder',
            theme: 'How AI Automation Works',
            asset_url: '/static/test_folder/clip1.mp4',
            title: 'Clip 1',
            duration: 30
          } as any
        ]
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    });

    expect(wrapper.text()).toContain('Ready');
  });

  it('toggles saved hook on bookmark click and prevents modal opening', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    });

    const bookmarkBtns = wrapper.findAll('button[aria-label="Bookmark Hook"]');
    expect(bookmarkBtns.length).toBeGreaterThan(0);

    // First hook in mockState is in savedHooks, but doesn't have _id so it calls saveHook for non-saved hooks
    // Second hook (idx 1) is not saved
    await bookmarkBtns[1]!.trigger('click');
    expect(mockState.saveHook).toHaveBeenCalledTimes(1);

    // Modal should not open
    const vm = wrapper.vm as any;
    expect(vm.selectedModalHook).toBeNull();
  });

  it('renders streamlined card body with theme, quote, timestamp range, and preview CTA', () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: false
        }
      }
    });

    expect(wrapper.text()).toContain('How AI Automation Works');
    expect(wrapper.text()).toContain(
      'We built an agent that automates the entire workflow seamlessly.'
    );
    expect(wrapper.text()).toContain('00:10');
    expect(wrapper.text()).toContain('00:40');
    expect(wrapper.text()).toContain('Preview Segment');
  });

  it('renders saved hooks tab with amber styling and active bookmark state', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: {
            template: '<div><slot /></div>'
          }
        }
      }
    });

    // Click Saved Hooks tab
    const vm = wrapper.vm as any;
    vm.activeTab = 'saved';
    await wrapper.vm.$nextTick();

    const text = wrapper.text();
    expect(text).toContain('SAVED 01');
    expect(text).toContain('How AI Automation Works');
  });

  it('resolves fallback source url from folderName when videoUrl and previewVideoUrl are null', async () => {
    mockState.videoUrl.value = null;
    mockState.folderName.value = 'fallback_folder';
    mockState.hasPreview.value = true;

    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: null,
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = mockState.hooks.value[0];
    await wrapper.vm.$nextTick();

    expect(vm.modalVideoUrl).toBe(
      'http://localhost:8000/assets/sources/fallback_folder/preview.mp4'
    );
    const modalVideo = wrapper.find('video[controls]');
    expect(modalVideo.exists()).toBe(true);
    expect(modalVideo.attributes('src')).toBe(
      'http://localhost:8000/assets/sources/fallback_folder/preview.mp4'
    );
  });

  it('displays fallback message gracefully when video triggers an error event', async () => {
    mockState.videoUrl.value =
      'http://localhost:8000/assets/sources/broken/full.mp4';

    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/assets/sources/broken/full.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = mockState.hooks.value[0];
    await wrapper.vm.$nextTick();

    const modalVideo = wrapper.find('video[controls]');
    expect(modalVideo.exists()).toBe(true);

    // Trigger video error on modal video
    await modalVideo.trigger('error');
    await wrapper.vm.$nextTick();

    // Modal video should unmount and fallback message should be visible
    expect(wrapper.find('video[controls]').exists()).toBe(false);
    expect(wrapper.text()).toContain('Video source unavailable');
  });

  it('renders Two-Tier Hook Timing Slider with Full Video Overview and Zoomed Window', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = { ...mockState.hooks.value[0] };
    vm.showAdjustDuration = true;
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('Full Video Overview');
    expect(wrapper.text()).toContain('Adjust Hook Boundaries');
    expect(wrapper.text()).toContain('Zoomed Window');
    expect(wrapper.text()).toContain('Clip Duration: 00:32');
    expect(wrapper.find('#modal-hook-slider').exists()).toBe(true);
  });

  it('synchronizes start and end input strings reactively during slider dragging', async () => {
    const wrapper = mount(HookResultsGallery, {
      attachTo: document.body,
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = { ...mockState.hooks.value[0], start: 10, end: 40 };
    vm.showAdjustDuration = true;
    await wrapper.vm.$nextTick();

    // Verify initial input strings (safetyBuffer = 2, so start is 10 - 2 = 8s -> 00:08)
    expect(vm.startInputStr).toBe('00:08');
    expect(vm.endInputStr).toBe('00:40');

    // Start dragging end handle
    vm.startDrag('end');
    expect(vm.dragInitialEnd).toBe(40);

    const sliderEl =
      vm.modalHookSliderRef || document.getElementById('modal-hook-slider');
    expect(sliderEl).toBeTruthy();
    if (sliderEl) {
      vi.spyOn(sliderEl, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        bottom: 20,
        right: 100,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => {}
      });
    }

    // Set micro window manually for deterministic test: 0 to 100s
    vm.microWindowStart = 0;
    vm.microWindowEnd = 100;

    // Drag to 60% of micro duration (60s)
    const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 60 });
    window.dispatchEvent(mouseMoveEvent);

    expect(vm.selectedModalHook.end).toBe(60);
    // endInputStr must be synchronized in real time!
    expect(vm.endInputStr).toBe('01:00');

    // Drag start handle to 20% (20s)
    vm.startDrag('start');
    const mouseMoveStartEvent = new MouseEvent('mousemove', { clientX: 20 });
    window.dispatchEvent(mouseMoveStartEvent);

    // startInputStr must be synchronized in real time!
    expect(vm.startInputStr).toBe('00:20');
    expect(vm.selectedModalHook.start).toBe(22); // 20 + safetyBuffer 2
    wrapper.unmount();
  });

  it('previews playback delta from old end to new end when extending end time', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = { ...mockState.hooks.value[0], start: 10, end: 40 };
    vm.showAdjustDuration = true;
    await wrapper.vm.$nextTick();

    const mockPlay = vi.fn().mockResolvedValue(undefined);
    vm.modalVideoPlayer = {
      currentTime: 0,
      play: mockPlay
    };

    // User starts dragging end from 40s
    vm.startDrag('end');
    expect(vm.dragInitialEnd).toBe(40);

    // Extend end to 65s
    vm.selectedModalHook.end = 65;
    vm.stopDragging();

    // Must seek to previous end time (40s) and play forward to preview newly added segment!
    expect(vm.modalVideoPlayer.currentTime).toBe(40);
    expect(mockPlay).toHaveBeenCalled();
    expect(vm.isPreviewingDelta).toBe(true);

    // When video reaches new end (65s), timeupdate should reset playback to effectiveStart (10 - 2 = 8s)
    let currentTime = 65;
    vm.onModalTimeUpdate({
      target: {
        get currentTime() {
          return currentTime;
        },
        set currentTime(val: number) {
          currentTime = val;
          vm.modalVideoPlayer.currentTime = val;
        }
      }
    } as any);

    expect(vm.modalVideoPlayer.currentTime).toBe(8);
    expect(vm.isPreviewingDelta).toBe(false);
  });

  it('previews tail context when shortening end time', async () => {
    const wrapper = mount(HookResultsGallery, {
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = { ...mockState.hooks.value[0], start: 10, end: 40 };
    vm.showAdjustDuration = true;
    await wrapper.vm.$nextTick();

    const mockPlay = vi.fn().mockResolvedValue(undefined);
    vm.modalVideoPlayer = {
      currentTime: 0,
      play: mockPlay
    };

    // User starts dragging end from 40s
    vm.startDrag('end');
    expect(vm.dragInitialEnd).toBe(40);

    // Shorten end to 30s
    vm.selectedModalHook.end = 30;
    vm.stopDragging();

    // Must seek to tail review (30 - 3 = 27s) and play forward
    expect(vm.modalVideoPlayer.currentTime).toBe(27);
    expect(mockPlay).toHaveBeenCalled();
    expect(vm.isPreviewingDelta).toBe(true);
  });

  it('prevents runaway window expansion and sensitivity explosion when scrubbing near slider boundary', async () => {
    const wrapper = mount(HookResultsGallery, {
      attachTo: document.body,
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = { ...mockState.hooks.value[0], start: 10, end: 40 };
    vm.showAdjustDuration = true;
    await wrapper.vm.$nextTick();

    const sliderEl =
      vm.modalHookSliderRef || document.getElementById('modal-hook-slider');
    if (sliderEl) {
      vi.spyOn(sliderEl, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        bottom: 20,
        right: 100,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => {}
      });
    }

    // Initial micro window: 0 to 70s
    vm.microWindowStart = 0;
    vm.microWindowEnd = 70;

    vm.startDrag('end');

    // Drag to right edge (clientX = 99) 3 times consecutively (simulating small mouse jitter at the edge)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99 }));
    const firstWindowEnd = vm.microWindowEnd;

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99 }));
    const secondWindowEnd = vm.microWindowEnd;

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99 }));
    const thirdWindowEnd = vm.microWindowEnd;

    // Window must NOT runaway expand on consecutive events at the same position!
    expect(secondWindowEnd).toBe(firstWindowEnd);
    expect(thirdWindowEnd).toBe(firstWindowEnd);

    vm.stopDragging();
    wrapper.unmount();
  });

  it('activates edge auto-scroll when dragging near boundary and scrolls smoothly', async () => {
    const wrapper = mount(HookResultsGallery, {
      attachTo: document.body,
      props: {
        previewVideoUrl: 'http://localhost:8000/static/test_folder/preview.mp4',
        readyClips: []
      },
      global: {
        stubs: {
          Icon: { template: '<span class="icon-stub"></span>' },
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    const vm = wrapper.vm as any;
    vm.selectedModalHook = { ...mockState.hooks.value[0], start: 10, end: 40 };
    vm.showAdjustDuration = true;
    await wrapper.vm.$nextTick();

    const sliderEl =
      vm.modalHookSliderRef || document.getElementById('modal-hook-slider');
    if (sliderEl) {
      vi.spyOn(sliderEl, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        bottom: 20,
        right: 100,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => {}
      });
    }

    vm.microWindowStart = 0;
    vm.microWindowEnd = 70;

    vm.startDrag('end');

    // Drag to right edge (clientX = 99)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 99 }));
    expect(vm.edgeScrollDirection).toBe(1);

    // Simulate stepEdgeAutoScroll frame advancing by 100ms
    vm.stepEdgeAutoScroll(1000);
    vm.stepEdgeAutoScroll(1100);

    // End boundary should have advanced smoothly
    expect(vm.selectedModalHook.end).toBeGreaterThan(69);

    // Move back to middle (clientX = 50)
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
    expect(vm.edgeScrollDirection).toBe(0);

    vm.stopDragging();
    wrapper.unmount();
  });
});
