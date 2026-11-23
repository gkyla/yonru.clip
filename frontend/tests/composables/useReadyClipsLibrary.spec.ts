import { describe, it, expect } from 'vitest';
import { nextTick, ref } from 'vue';
import type { ReadyClip } from '../../app/types/clipper';
import {
  READY_CLIPS_BATCH_SIZE,
  formatClipDuration,
  getClipKey,
  useReadyClipsLibrary
} from '../../app/composables/useReadyClipsLibrary';

function createFixtureClips(count = 26): ReadyClip[] {
  const sources = [
    {
      folder_name: 'podcast_ep_42',
      title: 'Podcast Ep 42 AI Tools',
      channel: 'Tech Talks Daily'
    },
    {
      folder_name: 'camera_breakdown',
      title: 'Next-Gen Camera Breakdown',
      channel: 'Lens Studio'
    },
    {
      folder_name: 'live_qa',
      title: 'Live Q&A Highlights',
      channel: 'Creator Lab'
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
      theme: `Clip Topic ${String(num).padStart(2, '0')}`,
      duration: 20 + ((idx * 7) % 45),
      mtime: 1700000000 + (count - idx) * 100,
      asset_url: `/assets/clips/${source.folder_name}/clip_${num}.mp4`,
      thumbnail_url: `/assets/clips/${source.folder_name}/clip_${num}/thumbnail.jpg`
    };
  });
}

describe('useReadyClipsLibrary Composable', () => {
  it('loads 12 clips initially and progressively appends batches via loadMore', () => {
    const source = ref(createFixtureClips(26));
    const lib = useReadyClipsLibrary(source);

    expect(lib.visibleClips.value).toHaveLength(READY_CLIPS_BATCH_SIZE);
    expect(lib.hasMore.value).toBe(true);

    lib.loadMore();
    expect(lib.visibleClips.value).toHaveLength(24);
    expect(lib.hasMore.value).toBe(true);

    lib.loadMore();
    expect(lib.visibleClips.value).toHaveLength(26);
    expect(lib.hasMore.value).toBe(false);

    // Calling loadMore when exhausted is a safe no-op
    lib.loadMore();
    expect(lib.visibleClips.value).toHaveLength(26);
  });

  it('searches by theme, channel, or parent source title, filters by source video, and sorts across all modes', async () => {
    const clips: ReadyClip[] = [
      {
        clip_id: 'c1',
        folder_name: 'alpha_src',
        title: 'Alpha Podcast',
        channel: 'Alpha Network',
        theme: 'Zulu Intro',
        duration: 45,
        mtime: 300
      },
      {
        clip_id: 'c2',
        folder_name: 'alpha_src',
        title: 'Alpha Podcast',
        channel: 'Alpha Network',
        theme: 'Beta Breakdown',
        duration: 15,
        mtime: 100
      },
      {
        clip_id: 'c3',
        folder_name: 'beta_src',
        title: 'Camera Masterclass',
        channel: 'Lens Studio',
        theme: 'Alpha Hook',
        duration: 90,
        mtime: 200
      }
    ];
    const source = ref(clips);
    const lib = useReadyClipsLibrary(source);

    expect(lib.sourceOptions.value).toEqual([
      { folder_name: 'alpha_src', title: 'Alpha Podcast', count: 2 },
      { folder_name: 'beta_src', title: 'Camera Masterclass', count: 1 }
    ]);

    // Default newest (mtime desc)
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual([
      'c1',
      'c3',
      'c2'
    ]);

    lib.sortBy.value = 'oldest';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual([
      'c2',
      'c3',
      'c1'
    ]);

    lib.sortBy.value = 'shortest';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual([
      'c2',
      'c1',
      'c3'
    ]);

    lib.sortBy.value = 'longest';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual([
      'c3',
      'c1',
      'c2'
    ]);

    lib.sortBy.value = 'title_asc';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual([
      'c3',
      'c2',
      'c1'
    ]);

    // Search matches parent source title
    lib.searchQuery.value = 'masterclass';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual(['c3']);

    // Search matches channel name (case-insensitive)
    lib.searchQuery.value = 'lens studio';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual(['c3']);

    // Clear filters restores full list and resets visible batch size on query change
    lib.clearFilters();
    await nextTick();
    expect(lib.filteredClips.value).toHaveLength(3);

    lib.sourceFilter.value = 'alpha_src';
    expect(lib.filteredClips.value.map(c => c.clip_id)).toEqual(['c2', 'c1']);
  });

  it('supports Shift+Click contiguous range selection across filtered clips', () => {
    const source = ref(createFixtureClips(10));
    const lib = useReadyClipsLibrary(source);

    const first = lib.filteredClips.value[1]!;
    const fifth = lib.filteredClips.value[5]!;
    const zero = lib.filteredClips.value[0]!;

    lib.toggleSelectClip(fifth, false);
    expect(lib.selectedCount.value).toBe(1);

    // Backward range selection from index 5 to index 1 selects 5 clips (1..5)
    lib.toggleSelectClip(first, true);
    expect(lib.selectedCount.value).toBe(5);
    expect(lib.selectedKeys.value.has(getClipKey(zero))).toBe(false);
    expect(
      lib.selectedKeys.value.has(getClipKey(lib.filteredClips.value[3]!))
    ).toBe(true);
  });

  it('selects all matching filtered clips including unloaded items below fold and reports hidden counts', async () => {
    const source = ref(createFixtureClips(26));
    const lib = useReadyClipsLibrary(source);

    expect(lib.visibleClips.value).toHaveLength(12);
    expect(lib.filteredClips.value).toHaveLength(26);

    lib.toggleSelectAllMatching();
    expect(lib.allFilteredSelected.value).toBe(true);
    expect(lib.selectedCount.value).toBe(26);
    expect(lib.selectedUnloadedCount.value).toBe(14);
    expect(lib.selectedOutsideFilterCount.value).toBe(0);
    expect(lib.selectedHiddenCount.value).toBe(14);

    // Toggling Select All again clears all matching selections
    lib.toggleSelectAllMatching();
    expect(lib.selectedCount.value).toBe(0);
    expect(lib.isSelectionMode.value).toBe(false);

    // Search resets visible count to 12 when returning
    lib.loadMore();
    expect(lib.visibleCount.value).toBe(24);
    lib.searchQuery.value = 'Clip Topic 0';
    await nextTick();
    expect(lib.visibleCount.value).toBe(READY_CLIPS_BATCH_SIZE);
  });

  it('enforces Esc layer order (clear selection before close) and preserves scroll depth after deletions', async () => {
    const source = ref(createFixtureClips(26));
    const lib = useReadyClipsLibrary(source);

    lib.loadMore();
    expect(lib.visibleCount.value).toBe(24);

    lib.sourceFilter.value = 'live_qa';
    await nextTick();
    const target = lib.filteredClips.value[0]!;
    lib.toggleSelectClip(target);
    expect(lib.isSelectionMode.value).toBe(true);

    // First Esc clears selection only
    expect(lib.handleEscape()).toBe('cleared-selection');
    expect(lib.isSelectionMode.value).toBe(false);

    // Second Esc closes library modal
    expect(lib.handleEscape()).toBe('close-library');

    // Re-select target and delete all clips in live_qa folder -> prunes selection, resets empty filter, preserves visibleCount
    lib.loadMore();
    const savedVisible = lib.visibleCount.value;
    lib.toggleSelectClip(target);
    source.value = source.value.filter(c => c.folder_name !== 'live_qa');
    await nextTick();

    expect(lib.selectedCount.value).toBe(0);
    expect(lib.sourceFilter.value).toBe('all');
    expect(lib.visibleCount.value).toBe(savedVisible);
  });

  it('formats durations defensively into m:ss', () => {
    expect(formatClipDuration(0)).toBe('0:00');
    expect(formatClipDuration(undefined)).toBe('0:00');
    expect(formatClipDuration(-5)).toBe('0:00');
    expect(formatClipDuration(65.9)).toBe('1:05');
  });
});
