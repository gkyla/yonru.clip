// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ReadyClipsSection from '../../app/components/home/ReadyClipsSection.vue';
import type { ReadyClip } from '../../app/types/clipper';

const mockState = {
  cachedVideos: { value: [] },
  setLastAccessed: vi.fn(),
  showToast: vi.fn(),
  lastAccessedClip: { value: null }
};

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}));

vi.mock('../../app/utils/apiBase', () => ({
  resolveApiBase: () => 'http://localhost:8000'
}));

describe('ReadyClipsSection Component', () => {
  const sampleClip: ReadyClip = {
    clip_id: 'clip_1',
    folder_name: 'test_folder_1',
    title: 'Test Clip 1',
    theme: 'Viral Highlight',
    duration: 45,
    asset_url: '/assets/clips/clip_1.mp4',
    created_at: 1725400000
  };

  it('renders skeleton loading and hides empty state during loading', () => {
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: [],
        isReadyClipsLoading: true
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    // Skeleton loaders should be visible
    expect(wrapper.find('[data-testid="ready-clips-skeletons"]').exists()).toBe(
      true
    );
    // Empty state should NOT be rendered while loading
    expect(
      wrapper.find('[data-testid="ready-clips-empty-state"]').exists()
    ).toBe(false);
    expect(wrapper.text()).not.toContain('Your Video Library is Empty');
  });

  it('renders empty state when confirmed that loading is complete and clips are empty', () => {
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: [],
        isReadyClipsLoading: false
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    // Skeleton loaders should NOT be visible
    expect(wrapper.find('[data-testid="ready-clips-skeletons"]').exists()).toBe(
      false
    );
    // Empty state MUST be rendered
    expect(
      wrapper.find('[data-testid="ready-clips-empty-state"]').exists()
    ).toBe(true);
    expect(wrapper.text()).toContain('Your Video Library is Empty');
    expect(wrapper.text()).toContain('Paste a YouTube URL above');
  });

  it('renders clips cards and neither skeleton nor empty state when clips are populated', () => {
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: [sampleClip],
        isReadyClipsLoading: false
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    expect(wrapper.find('[data-testid="ready-clips-skeletons"]').exists()).toBe(
      false
    );
    expect(
      wrapper.find('[data-testid="ready-clips-empty-state"]').exists()
    ).toBe(false);
    expect(wrapper.text()).not.toContain('Your Video Library is Empty');
    expect(wrapper.text()).toContain('Viral Highlight');
    expect(wrapper.text()).toContain('Test Clip 1');
  });
});
