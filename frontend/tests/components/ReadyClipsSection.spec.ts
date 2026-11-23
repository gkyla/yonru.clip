// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ReadyClipsSection from '../../app/components/home/ReadyClipsSection.vue';
import ReadyClipCard from '../../app/components/home/ReadyClipCard.vue';
import type { ReadyClip } from '../../app/types/clipper';

const mockState = {
  cachedVideos: {
    value: [] as Array<{ folder_name: string; video_id: string }>
  },
  setLastAccessed: vi.fn(),
  showToast: vi.fn(),
  lastAccessedClip: {
    value: null as { folder?: string; clip_id: string } | null
  }
};

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState
}));

vi.mock('../../app/utils/apiBase', () => ({
  resolveApiBase: () => 'http://localhost:8000'
}));

function buildClips(count: number): ReadyClip[] {
  const sources = [
    {
      folder_name: 'podcast_ep_42',
      title: 'Podcast Episode 42',
      channel: 'Tech Talks Daily'
    },
    {
      folder_name: 'camera_gear',
      title: 'Camera Gear Review',
      channel: 'Lens Studio'
    }
  ];

  return Array.from({ length: count }, (_, idx) => {
    const source = sources[idx % sources.length]!;
    const num = idx + 1;
    return {
      clip_id: `clip_${String(num).padStart(2, '0')}`,
      folder_name: source.folder_name,
      title: source.title,
      channel: source.channel,
      theme: `Highlight Clip ${String(num).padStart(2, '0')}`,
      duration: 20 + idx * 5,
      mtime: 1700000000 + (count - idx) * 100,
      asset_url: `/assets/clips/${source.folder_name}/clip_${num}.mp4`,
      thumbnail_url: `/assets/clips/${source.folder_name}/clip_${num}/thumbnail.jpg`
    };
  });
}

describe('ReadyClipsSection & Ready Clips Library Components', () => {
  const sampleClip: ReadyClip = {
    clip_id: 'clip_1',
    folder_name: 'test_folder_1',
    title: 'Test Clip 1',
    channel: 'Yonru Channel',
    theme: 'Viral Highlight',
    duration: 45,
    mtime: 1700000000,
    asset_url: '/assets/clips/clip_1.mp4',
    thumbnail_url: '/assets/clips/test_folder_1/clip_1/thumbnail.jpg',
    created_at: '2024-09-03T12:00:00Z'
  };

  let triggerIntersection:
    ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockState.cachedVideos.value = [];
    mockState.setLastAccessed.mockClear();
    mockState.showToast.mockClear();
    mockState.lastAccessedClip.value = null;
    triggerIntersection = null;

    fetchMock = vi.fn().mockResolvedValue({ status: 'ok' });
    vi.stubGlobal('$fetch', fetchMock);

    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn().mockImplementation(callback => {
        triggerIntersection = callback;
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn()
        };
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

    expect(wrapper.find('[data-testid="ready-clips-skeletons"]').exists()).toBe(
      true
    );
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

    expect(wrapper.find('[data-testid="ready-clips-skeletons"]').exists()).toBe(
      false
    );
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
    expect(wrapper.text()).toContain('Yonru Channel');
    expect(wrapper.text()).toContain('Test Clip 1');
  });

  it('renders static Clip Thumbnail with bottom-left channel chip, 2-line footer, 150ms hover preview, and calm selection', async () => {
    vi.useFakeTimers();

    const wrapper = mount(ReadyClipCard, {
      props: {
        clip: sampleClip,
        apiBase: 'http://localhost:8000',
        selectable: true,
        selected: false,
        selectionActive: false
      },
      global: {
        stubs: { Icon: true }
      }
    });

    // Thumbnail bottom overlay renders Channel chip (left) alongside Duration chip (right) without monospace styling
    const thumbArea = wrapper.find('.aspect-video');
    const channelChip = thumbArea.find('[data-testid="ready-clip-channel"]');
    expect(channelChip.text()).toBe('Yonru Channel');
    expect(channelChip.classes()).toContain('truncate');
    expect(channelChip.classes()).toContain('max-w-[60%]');
    expect(thumbArea.find('[data-testid="ready-clip-duration"]').text()).toBe(
      '0:45'
    );

    // Metadata footer stays cleanly 2-line: 1) Clip title, 2) Video title (no channel inside footer)
    const footer = wrapper.find('[data-testid="ready-clip-footer"]');
    expect(footer.find('[data-testid="ready-clip-channel"]').exists()).toBe(
      false
    );
    const footerMetaNodes = footer.findAll(
      '[data-testid="ready-clip-title"], [data-testid="ready-clip-source-title"]'
    );
    expect(footerMetaNodes.map(node => node.attributes('data-testid'))).toEqual(
      ['ready-clip-title', 'ready-clip-source-title']
    );
    expect(footerMetaNodes.map(node => node.text())).toEqual([
      'Viral Highlight',
      'Test Clip 1'
    ]);
    expect(wrapper.find('.font-mono').exists()).toBe(false);

    // Static lazy thumbnail rendered; no eager video mounted initially
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('loading')).toBe('lazy');
    expect(
      wrapper.find('[data-testid="ready-clip-hover-video"]').exists()
    ).toBe(false);

    // Hover mounts preview video only after 150ms intent delay
    await wrapper.find('[data-testid="ready-clip-card"]').trigger('mouseenter');
    vi.advanceTimersByTime(140);
    await nextTick();
    expect(
      wrapper.find('[data-testid="ready-clip-hover-video"]').exists()
    ).toBe(false);

    vi.advanceTimersByTime(20);
    await nextTick();
    expect(
      wrapper.find('[data-testid="ready-clip-hover-video"]').exists()
    ).toBe(true);

    // Mouseleave unmounts hover preview cleanly
    await wrapper.find('[data-testid="ready-clip-card"]').trigger('mouseleave');
    expect(
      wrapper.find('[data-testid="ready-clip-hover-video"]').exists()
    ).toBe(false);

    // Active selection prevents hover preview and applies calm single-border styling (no ring-offset)
    await wrapper.setProps({ selected: true, selectionActive: true });
    await wrapper.find('[data-testid="ready-clip-card"]').trigger('mouseenter');
    vi.advanceTimersByTime(200);
    await nextTick();
    expect(
      wrapper.find('[data-testid="ready-clip-hover-video"]').exists()
    ).toBe(false);

    const card = wrapper.find('[data-testid="ready-clip-card"]');
    expect(card.classes()).toContain('border-accent-500/60');
    expect(card.classes()).not.toContain('ring-offset-4');

    // Missing/blank channel is omitted cleanly, and missing thumbnail falls back to lazy metadata video
    await wrapper.setProps({
      clip: { ...sampleClip, channel: '   ', thumbnail_url: undefined }
    });
    expect(wrapper.find('[data-testid="ready-clip-channel"]').exists()).toBe(
      false
    );
    expect(wrapper.find('img').exists()).toBe(false);
    const fallbackVideo = wrapper.find('video');
    expect(fallbackVideo.exists()).toBe(true);
    expect(fallbackVideo.attributes('preload')).toBe('metadata');
    expect(fallbackVideo.attributes('loading')).toBe('lazy');
  });

  it('opens max-w-5xl Ready Clips Library modal without ESC kbd badge or font-mono and progressively loads infinite batches', async () => {
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: buildClips(26),
        isReadyClipsLoading: false
      },
      global: {
        stubs: { Icon: true }
      }
    });

    await wrapper
      .find('[data-testid="view-all-ready-clips-btn"]')
      .trigger('click');
    await nextTick();

    const modal = wrapper.find('[data-testid="ready-clips-library-modal"]');
    expect(modal.attributes('open')).toBeDefined();
    expect(modal.classes()).toContain('max-w-5xl');
    expect(modal.find('kbd').exists()).toBe(false);
    expect(modal.find('.font-mono').exists()).toBe(false);
    expect(modal.text()).toContain('Ready Clips Library');
    expect(modal.text()).not.toContain('Initializing Library');
    expect(modal.findAll('[data-testid="ready-clip-card"]')).toHaveLength(12);
    expect(modal.find('[data-testid="ready-clips-sentinel"]').text()).toContain(
      'Showing 12 of 26'
    );

    // Trigger IntersectionObserver to load second batch (24)
    expect(triggerIntersection).not.toBeNull();
    triggerIntersection!([{ isIntersecting: true }]);
    await nextTick();
    expect(modal.findAll('[data-testid="ready-clip-card"]')).toHaveLength(24);

    // Click keyboard-accessible Load more button to load final batch (26)
    await modal
      .find('[data-testid="ready-clips-load-more-btn"]')
      .trigger('click');
    await nextTick();
    expect(modal.findAll('[data-testid="ready-clip-card"]')).toHaveLength(26);
    expect(
      modal.find('[data-testid="ready-clips-end-marker"]').text()
    ).toContain('All 26 clips shown');
  });

  it('operates custom Source/Sort dropdowns with mutual exclusion, channel search, Clear filters, and Esc precedence', async () => {
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: buildClips(14),
        isReadyClipsLoading: false
      },
      global: {
        stubs: { Icon: true }
      }
    });

    await wrapper
      .find('[data-testid="view-all-ready-clips-btn"]')
      .trigger('click');
    await nextTick();

    const modal = wrapper.find('[data-testid="ready-clips-library-modal"]');
    const searchInput = modal.find('[data-testid="ready-clips-search-input"]');

    // Search matches source title and channel name
    await searchInput.setValue('Camera Gear Review');
    expect(modal.findAll('[data-testid="ready-clip-card"]')).toHaveLength(7);

    await searchInput.setValue('Tech Talks Daily');
    expect(modal.findAll('[data-testid="ready-clip-card"]')).toHaveLength(7);

    // Open Source dropdown and select Camera Gear Review while Tech Talks Daily search is active -> no match
    await modal
      .find('[data-testid="ready-clips-source-dropdown-trigger"]')
      .trigger('click');
    await nextTick();
    expect(
      modal.find('[data-testid="ready-clips-source-dropdown-panel"]').exists()
    ).toBe(true);

    // Mutual exclusion: opening Sort closes Source dropdown automatically
    await modal
      .find('[data-testid="ready-clips-sort-dropdown-trigger"]')
      .trigger('click');
    await nextTick();
    expect(
      modal.find('[data-testid="ready-clips-sort-dropdown-panel"]').exists()
    ).toBe(true);
    expect(
      modal.find('[data-testid="ready-clips-source-dropdown-panel"]').exists()
    ).toBe(false);

    // Select Source filter option podcast_ep_42 while searching Tech Talks, then switch to camera_gear for no-match state
    await modal
      .find('[data-testid="ready-clips-source-dropdown-trigger"]')
      .trigger('click');
    await nextTick();
    await modal
      .find(
        '[data-testid="ready-clips-source-dropdown-option"][data-value="camera_gear"]'
      )
      .trigger('click');
    await nextTick();
    expect(modal.find('[data-testid="library-no-matches"]').exists()).toBe(
      true
    );

    await modal
      .find('[data-testid="library-clear-filters-btn"]')
      .trigger('click');
    expect(modal.findAll('[data-testid="ready-clip-card"]')).toHaveLength(12);

    // Keyboard navigation on Sort dropdown: ArrowDown opens menu, move down to Shortest First, Enter selects
    const sortTrigger = modal.find(
      '[data-testid="ready-clips-sort-dropdown-trigger"]'
    );
    await sortTrigger.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    await nextTick();

    const sortPanel = modal.find(
      '[data-testid="ready-clips-sort-dropdown-panel"]'
    );
    expect(sortPanel.exists()).toBe(true);
    await sortPanel.trigger('keydown', { key: 'ArrowDown' }); // oldest
    await sortPanel.trigger('keydown', { key: 'ArrowDown' }); // shortest
    await sortPanel.trigger('keydown', { key: 'Enter' });
    await nextTick();

    const firstCardTitle = modal
      .find('[data-testid="ready-clip-card"] h4')
      .text();
    expect(firstCardTitle).toBe('Highlight Clip 01');

    // Esc layer precedence: select a clip, open Source dropdown, then trigger modal cancel -> closes dropdown only
    await modal
      .findAll('[data-testid="ready-clip-select-checkbox"]')[0]!
      .trigger('click');
    await modal
      .find('[data-testid="ready-clips-source-dropdown-trigger"]')
      .trigger('click');
    await nextTick();
    expect(
      modal.find('[data-testid="ready-clips-source-dropdown-panel"]').exists()
    ).toBe(true);

    await modal.trigger('cancel');
    await nextTick();
    expect(
      modal.find('[data-testid="ready-clips-source-dropdown-panel"]').exists()
    ).toBe(false);
    expect(modal.find('[data-testid="bulk-selected-count"]').text()).toBe(
      '1 selected'
    );
    expect(modal.attributes('open')).toBeDefined();
  });

  it('switches between Browse and Selecting modes, selects all across unloaded clips, and deletes via Always-Modal confirmation', async () => {
    const clips = buildClips(26);
    mockState.lastAccessedClip.value = {
      folder: clips[0]!.folder_name,
      clip_id: clips[0]!.clip_id
    };

    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: clips,
        isReadyClipsLoading: false
      },
      global: {
        stubs: { Icon: true }
      }
    });

    // Browse mode inside library modal opens clip directly
    await wrapper
      .find('[data-testid="view-all-ready-clips-btn"]')
      .trigger('click');
    await nextTick();

    const modal = wrapper.find('[data-testid="ready-clips-library-modal"]');
    const triggers = modal.findAll('[data-testid="ready-clip-card-trigger"]');
    await triggers[0]!.trigger('click');
    expect(wrapper.emitted('load-clip')?.[0]?.[0]).toEqual(clips[0]);

    // Reopen library modal and enter selection mode via checkbox
    await wrapper
      .find('[data-testid="view-all-ready-clips-btn"]')
      .trigger('click');
    await nextTick();

    const checkboxes = modal.findAll(
      '[data-testid="ready-clip-select-checkbox"]'
    );
    await checkboxes[0]!.trigger('click');

    expect(modal.find('[data-testid="ready-clips-bulk-bar"]').exists()).toBe(
      true
    );
    expect(modal.find('[data-testid="bulk-selected-count"]').text()).toBe(
      '1 selected'
    );

    // Card click in Selecting mode toggles selection instead of navigating
    const modalTriggers = modal.findAll(
      '[data-testid="ready-clip-card-trigger"]'
    );
    await modalTriggers[1]!.trigger('click');
    expect(modal.find('[data-testid="bulk-selected-count"]').text()).toBe(
      '2 selected'
    );

    // Shift+Click selects range up to index 4 (clips 0..4 => 5 selected)
    await modalTriggers[4]!.trigger('click', { shiftKey: true });
    expect(modal.find('[data-testid="bulk-selected-count"]').text()).toBe(
      '5 selected'
    );

    // Select all targets all 26 matching clips including unloaded ones below fold
    await modal.find('[data-testid="bulk-select-all-btn"]').trigger('click');
    expect(modal.find('[data-testid="bulk-selected-count"]').text()).toBe(
      '26 selected'
    );
    expect(modal.find('[data-testid="bulk-hidden-count"]').text()).toBe(
      '+14 below fold'
    );

    // Esc layer 1: open delete confirm modal -> cancel closes confirm modal ONLY, preserving selection
    await modal.find('[data-testid="bulk-delete-btn"]').trigger('click');
    await nextTick();
    const deleteModal = wrapper.find('[data-testid="ready-clip-delete-modal"]');
    expect(deleteModal.attributes('open')).toBeDefined();
    expect(deleteModal.text()).toContain('Delete 26 clips?');
    expect(deleteModal.text()).toContain('and 23 more');
    expect(deleteModal.text()).toContain('Permanent removal');

    await deleteModal.trigger('cancel');
    await nextTick();
    expect(deleteModal.attributes('open')).toBeUndefined();
    expect(modal.find('[data-testid="bulk-selected-count"]').text()).toBe(
      '26 selected'
    );

    // Confirm bulk delete calls batch endpoint and dispatches Application Toast with zero duplicate green bar
    await modal.find('[data-testid="bulk-delete-btn"]').trigger('click');
    await nextTick();
    await deleteModal
      .find('[data-testid="confirm-delete-submit-btn"]')
      .trigger('click');
    await nextTick();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/ready-clips/delete-batch',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockState.showToast).toHaveBeenCalledWith(
      '26 clips successfully deleted.',
      'success'
    );
    expect(mockState.lastAccessedClip.value).toBeNull();
    expect(wrapper.emitted('refresh-clips')).toHaveLength(1);
    expect(modal.text()).not.toContain('Success!');
    expect(modal.attributes('open')).toBeDefined();

    // Emptying library keeps modal open on clean empty state with Close button
    await wrapper.setProps({ readyClips: [] });
    await nextTick();
    expect(modal.find('[data-testid="library-empty-state"]').exists()).toBe(
      true
    );
    expect(modal.find('[data-testid="library-empty-close-btn"]').text()).toBe(
      'Close'
    );
    expect(modal.text()).not.toContain('Back to Editor');

    // Layer 3 Esc closes library modal when no selection exists
    await modal.trigger('cancel');
    await nextTick();
    expect(modal.attributes('open')).toBeUndefined();
  });

  it('always opens confirmation modal on card trash click and clears selection on Esc before closing', async () => {
    const clips = buildClips(5);
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: clips,
        isReadyClipsLoading: false
      },
      global: {
        stubs: { Icon: true }
      }
    });

    await wrapper
      .find('[data-testid="view-all-ready-clips-btn"]')
      .trigger('click');
    await nextTick();

    const modal = wrapper.find('[data-testid="ready-clips-library-modal"]');

    // Layer 2 Esc: select a clip, press cancel on library -> clears selection, keeps modal open
    await modal
      .findAll('[data-testid="ready-clip-select-checkbox"]')[0]!
      .trigger('click');
    expect(modal.find('[data-testid="ready-clips-bulk-bar"]').exists()).toBe(
      true
    );

    await modal.trigger('cancel');
    await nextTick();
    expect(modal.find('[data-testid="ready-clips-bulk-bar"]').exists()).toBe(
      false
    );
    expect(modal.attributes('open')).toBeDefined();

    // Always-Modal single-clip delete on trash button click
    await modal
      .findAll('[data-testid="ready-clip-delete-btn"]')[0]!
      .trigger('click');
    await nextTick();

    const deleteModal = wrapper.find('[data-testid="ready-clip-delete-modal"]');
    expect(deleteModal.attributes('open')).toBeDefined();
    expect(deleteModal.text()).toContain('Delete clip?');
    expect(deleteModal.text()).toContain('Highlight Clip 01');

    await deleteModal
      .find('[data-testid="confirm-delete-submit-btn"]')
      .trigger('click');
    await nextTick();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/ready-clips/podcast_ep_42/clip_01',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(mockState.showToast).toHaveBeenCalledWith(
      'Clip successfully deleted.',
      'success'
    );
    expect(wrapper.emitted('refresh-clips')).toHaveLength(1);
  });

  it('keeps clip summary intact during delete modal close transition after Cancel', async () => {
    const wrapper = mount(ReadyClipsSection, {
      props: {
        readyClips: [sampleClip],
        isReadyClipsLoading: false
      },
      global: {
        stubs: { Icon: true }
      }
    });

    await wrapper
      .find('[data-testid="ready-clip-delete-btn"]')
      .trigger('click');
    await nextTick();

    const deleteModal = wrapper.find('[data-testid="ready-clip-delete-modal"]');

    let resolveExit!: () => void;
    const exitPromise = new Promise<void>(resolve => {
      resolveExit = resolve;
    });
    Object.defineProperty(deleteModal.element, 'getAnimations', {
      configurable: true,
      value: () => [{ finished: exitPromise }]
    });

    expect(deleteModal.text()).toContain('Viral Highlight');
    expect(deleteModal.text()).toContain('Yonru Channel');
    expect(deleteModal.text()).toContain('Test Clip 1');

    // Cancel clears pendingDeleteClips immediately in parent while exit animation is still running
    await deleteModal
      .find('[data-testid="confirm-delete-cancel-btn"]')
      .trigger('click');
    await nextTick();
    await nextTick();

    expect(deleteModal.text()).toContain('Viral Highlight');
    expect(deleteModal.text()).toContain('Yonru Channel');
    expect(deleteModal.text()).toContain('Test Clip 1');
    expect(deleteModal.text()).not.toContain('and 0 more');

    // Finish exit transition -> content unmounts cleanly
    resolveExit();
    await flushPromises();
    await nextTick();

    expect(deleteModal.text()).not.toContain('Viral Highlight');
    expect(deleteModal.attributes('open')).toBeUndefined();
  });
});
