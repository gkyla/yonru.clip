// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import CinematicHookPreviewModal from '../../app/components/home/CinematicHookPreviewModal.vue';
import { ref } from 'vue';
import type { Hook } from '../../app/types/clipper';

const mockState = {
  savedHooks: ref<Hook[]>([
    {
      start: 10,
      end: 40,
      theme: 'Saved Viral Hook',
      transcript_quote: 'Saved quote here.',
      virality_score: 95,
      virality_reason: 'High intrigue hook.',
      _id: 'saved_1'
    }
  ]),
  folderName: ref('test_folder'),
  clipId: ref(''),
  jobStatus: ref('idle'),
  activeHook: ref(null),
  hdReady: ref(true),
  downloadPercent: ref(100),
  videoUrl: ref('http://localhost:8000/assets/sources/test_folder/full.mp4'),
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

describe('CinematicHookPreviewModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockState.savedHooks.value = [
      {
        start: 10,
        end: 40,
        theme: 'Saved Viral Hook',
        transcript_quote: 'Saved quote here.',
        virality_score: 95,
        virality_reason: 'High intrigue hook.',
        _id: 'saved_1'
      }
    ];
  });

  const sampleHook: Hook = {
    start: 10,
    end: 40,
    theme: 'How AI Automation Works',
    transcript_quote:
      'We built an agent that automates the entire workflow seamlessly.',
    virality_score: 95,
    virality_reason: 'High intrigue hook with strong value proposition.'
  };

  it('renders modal dialog when modelValue is true and displays hook details', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: sampleHook,
        videoUrl:
          'http://localhost:8000/assets/sources/test_folder/preview.mp4',
        videoTitle: 'Test Video Masterclass'
      },
      global: {
        stubs: {
          Icon: {
            template: '<span class="icon-stub" :data-name="$attrs.name"></span>'
          },
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: {
            template: '<div id="modal-hook-slider">SliderStub</div>'
          }
        }
      }
    });

    expect(wrapper.text()).toContain('How AI Automation Works');
    expect(wrapper.text()).toContain('VIRAL SCORE: 95/100');
    expect(wrapper.text()).toContain('Go to Editor');
    expect(wrapper.find('video').exists()).toBe(true);
  });

  it('does not render when modelValue is false', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: false,
        hook: sampleHook
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    expect(wrapper.find('video').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('How AI Automation Works');
  });

  it('emits update:modelValue with false when clicking close button or backdrop', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: sampleHook,
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    // Close button
    const closeBtn = wrapper.find('button[aria-label="Close modal"]');
    if (closeBtn.exists()) {
      await closeBtn.trigger('click');
    } else {
      // Find button with ri:close-line icon
      const buttons = wrapper.findAll('button');
      await buttons[0]!.trigger('click');
    }
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false]);
  });

  it('switches between Virality Breakdown and Transcript Quote tabs', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: sampleHook,
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    // Default tab is Virality Breakdown
    expect(wrapper.text()).toContain('Virality Analysis');
    expect(wrapper.text()).toContain(
      'High intrigue hook with strong value proposition.'
    );

    // Switch to Transcript Quote
    const quoteTabBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Transcript Quote'));
    expect(quoteTabBtn).toBeDefined();
    await quoteTabBtn!.trigger('click');

    expect(wrapper.text()).toContain('Spoken Dialog');
    expect(wrapper.text()).toContain(
      'We built an agent that automates the entire workflow seamlessly.'
    );
  });

  it('emits openInEditor and closes modal when clicking Go to Editor button', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: sampleHook,
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    const goToEditorBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Go to Editor'));
    expect(goToEditorBtn).toBeDefined();
    await goToEditorBtn!.trigger('click');

    expect(wrapper.emitted('openInEditor')).toBeTruthy();
    expect(wrapper.emitted('openInEditor')![0]![0]).toMatchObject({
      theme: 'How AI Automation Works'
    });
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([false]);
  });

  it('emits saveHook when unsaved hook bookmark is clicked and removeSavedHook when saved', async () => {
    const unsavedHook: Hook = {
      start: 50,
      end: 80,
      theme: 'Unsaved Viral Hook',
      virality_score: 88
    };

    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: unsavedHook,
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    const bookmarkBtn = wrapper.find(
      'button[aria-label="Toggle Bookmark Hook"]'
    );
    if (bookmarkBtn.exists()) {
      await bookmarkBtn.trigger('click');
    } else {
      // Find bookmark button in modal header
      const btn = wrapper
        .findAll('button')
        .find(
          b =>
            b.attributes('title')?.includes('Bookmark') ||
            b.classes().includes('text-slate-400')
        );
      await btn!.trigger('click');
    }

    expect(wrapper.emitted('saveHook')).toBeTruthy();
    expect(wrapper.emitted('saveHook')![0]![0]).toMatchObject({
      theme: 'Unsaved Viral Hook'
    });

    // Now test with already saved hook
    const savedWrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: mockState.savedHooks.value[0]!,
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    const savedBookmarkBtn = savedWrapper.find(
      'button[aria-label="Toggle Bookmark Hook"]'
    );
    if (savedBookmarkBtn.exists()) {
      await savedBookmarkBtn.trigger('click');
    } else {
      const btn = savedWrapper
        .findAll('button')
        .find(
          b =>
            b.attributes('title')?.includes('Bookmark') ||
            b.classes().includes('text-slate-400') ||
            b.classes().includes('text-amber-400')
        );
      await btn!.trigger('click');
    }

    expect(savedWrapper.emitted('removeSavedHook')).toBeTruthy();
    expect(savedWrapper.emitted('removeSavedHook')![0]![0]).toMatchObject({
      theme: 'Saved Viral Hook'
    });
  });

  it('toggles floating timing adjustment popover and modifies start/end via arrow keys', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: {
          start: 12.0,
          end: 20.0,
          theme: 'Timing Test Hook',
          virality_score: 90
        },
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    const vm = wrapper.vm as any;
    expect(vm.showAdjustDuration).toBe(false);

    // Click Adjust Start - End
    const adjustBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Adjust Start - End'));
    expect(adjustBtn).toBeDefined();
    await adjustBtn!.trigger('click');
    expect(vm.showAdjustDuration).toBe(true);

    const inputs = wrapper.findAll('input[type="text"]');
    expect(inputs.length).toBe(2);

    // Initial start input: 12 - 2 (buffer) = 10s => '00:10'
    const startInput = inputs[0]!;
    const endInput = inputs[1]!;

    await startInput.trigger('keydown.up');
    expect(vm.currentHook.start).toBe(13.0);
    expect(vm.startInputStr).toBe('00:11');

    await startInput.trigger('keydown.down');
    expect(vm.currentHook.start).toBe(12.0);
    expect(vm.startInputStr).toBe('00:10');

    await endInput.trigger('keydown.up');
    expect(vm.currentHook.end).toBe(21.0);
    expect(vm.endInputStr).toBe('00:21');

    await endInput.trigger('keydown.down');
    expect(vm.currentHook.end).toBe(20.0);
    expect(vm.endInputStr).toBe('00:20');
  });

  it('persists and restores audio volume in localStorage', async () => {
    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: sampleHook,
        videoUrl: 'http://localhost:8000/assets/sources/test_folder/preview.mp4'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    const video = wrapper.find('video');
    expect(video.exists()).toBe(true);
    const videoEl = video.element as HTMLVideoElement;

    videoEl.volume = 0.6;
    videoEl.muted = true;
    await video.trigger('volumechange');

    expect(localStorage.getItem('yonru_preview_volume')).toBe('0.6');
    expect(localStorage.getItem('yonru_preview_muted')).toBe('true');
  });

  it('toggles video preview resolution between HD and SD', async () => {
    mockState.videoUrl.value =
      'http://localhost:8000/assets/sources/test_folder/full.mp4';
    mockState.hdReady.value = true;

    const wrapper = mount(CinematicHookPreviewModal, {
      props: {
        modelValue: true,
        hook: sampleHook,
        folderName: 'test_folder'
      },
      global: {
        stubs: {
          Icon: true,
          Transition: { template: '<div><slot /></div>' },
          TwoTierTimingSlider: true
        }
      }
    });

    const video = wrapper.find('video');
    expect(video.exists()).toBe(true);
    // HD by default when hdReady is true
    expect(video.attributes('src')).toBe(
      'http://localhost:8000/assets/sources/test_folder/full.mp4'
    );

    // Switch to SD
    const sdBtn = wrapper.findAll('button').find(b => b.text() === 'SD');
    expect(sdBtn).toBeDefined();
    await sdBtn!.trigger('click');
    await wrapper.vm.$nextTick();

    expect(video.attributes('src')).toBe(
      'http://localhost:8000/assets/sources/test_folder/preview.mp4'
    );

    // Switch back to HD
    const hdBtn = wrapper.findAll('button').find(b => b.text() === 'HD');
    expect(hdBtn).toBeDefined();
    await hdBtn!.trigger('click');
    await wrapper.vm.$nextTick();

    expect(video.attributes('src')).toBe(
      'http://localhost:8000/assets/sources/test_folder/full.mp4'
    );
  });
});
