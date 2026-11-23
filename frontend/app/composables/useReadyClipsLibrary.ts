import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { ReadyClip } from '../types/clipper';

export const READY_CLIPS_BATCH_SIZE = 12;

export type ReadyClipsSortOption =
  'newest' | 'oldest' | 'shortest' | 'longest' | 'title_asc';

export interface ReadyClipSourceOption {
  folder_name: string;
  title: string;
  count: number;
}

export interface ReadyClipsFilterOptions {
  searchQuery: string;
  sourceFilter: string;
  sortBy: ReadyClipsSortOption;
}

/**
 * Returns a unique composite key for a ReadyClip across source folders.
 */
export function getClipKey(
  clip: Pick<ReadyClip, 'folder_name' | 'clip_id'>
): string {
  return `${clip.folder_name}::${clip.clip_id}`;
}

/**
 * Formats clip duration seconds into `m:ss`.
 */
export function formatClipDuration(seconds?: number): string {
  const safe =
    typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? Math.floor(seconds)
      : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Builds deduplicated Source Video options with clip counts, ordered by count desc then title asc.
 */
export function buildSourceOptions(
  clips: ReadyClip[]
): ReadyClipSourceOption[] {
  const grouped = new Map<string, ReadyClipSourceOption>();
  for (const clip of clips) {
    const existing = grouped.get(clip.folder_name);
    if (existing) {
      existing.count += 1;
      if (!existing.title && clip.title) {
        existing.title = clip.title;
      }
    } else {
      grouped.set(clip.folder_name, {
        folder_name: clip.folder_name,
        title: clip.title || clip.folder_name,
        count: 1
      });
    }
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Filters Ready Clips by Source Video and search query (`theme`, `channel`, and parent `title`), then sorts cleanly.
 */
export function filterAndSortReadyClips(
  clips: ReadyClip[],
  options: ReadyClipsFilterOptions
): ReadyClip[] {
  const query = options.searchQuery.trim().toLowerCase();

  const filtered = clips.filter(clip => {
    if (
      options.sourceFilter !== 'all' &&
      clip.folder_name !== options.sourceFilter
    ) {
      return false;
    }
    if (query) {
      const themeMatch = (clip.theme || '').toLowerCase().includes(query);
      const channelMatch = (clip.channel || '').toLowerCase().includes(query);
      const titleMatch = (clip.title || '').toLowerCase().includes(query);
      if (!themeMatch && !channelMatch && !titleMatch) return false;
    }
    return true;
  });

  const sorted = filtered.slice();
  sorted.sort((a, b) => {
    const mtimeA = a.mtime ?? 0;
    const mtimeB = b.mtime ?? 0;
    const durA = a.duration ?? 0;
    const durB = b.duration ?? 0;

    switch (options.sortBy) {
      case 'oldest':
        return mtimeA - mtimeB;
      case 'shortest':
        return durA - durB || mtimeB - mtimeA;
      case 'longest':
        return durB - durA || mtimeB - mtimeA;
      case 'title_asc':
        return (
          (a.theme || 'Untitled Clip').localeCompare(
            b.theme || 'Untitled Clip'
          ) || mtimeB - mtimeA
        );
      case 'newest':
      default:
        return mtimeB - mtimeA;
    }
  });

  return sorted;
}

/**
 * Manages client-side search, source filtering, sorting, progressive infinite loading,
 * direct multi-selection (`Shift+Click` + cross-fold `Select all`), and 3-layer Esc handling
 * for the Ready Clips Library modal.
 */
export function useReadyClipsLibrary(
  clipsSource: Ref<ReadyClip[]> | ComputedRef<ReadyClip[]>
) {
  const searchQuery = ref('');
  const sourceFilter = ref('all');
  const sortBy = ref<ReadyClipsSortOption>('newest');
  const visibleCount = ref(READY_CLIPS_BATCH_SIZE);
  const selectedKeys = ref<Set<string>>(new Set());
  const lastSelectedAnchorKey = ref<string | null>(null);

  const sourceOptions = computed<ReadyClipSourceOption[]>(() =>
    buildSourceOptions(clipsSource.value)
  );

  const filteredClips = computed<ReadyClip[]>(() =>
    filterAndSortReadyClips(clipsSource.value, {
      searchQuery: searchQuery.value,
      sourceFilter: sourceFilter.value,
      sortBy: sortBy.value
    })
  );

  const visibleClips = computed<ReadyClip[]>(() =>
    filteredClips.value.slice(0, visibleCount.value)
  );

  const hasMore = computed<boolean>(
    () => visibleClips.value.length < filteredClips.value.length
  );

  const hasActiveFilters = computed<boolean>(
    () => searchQuery.value.trim().length > 0 || sourceFilter.value !== 'all'
  );

  const selectedClips = computed<ReadyClip[]>(() =>
    clipsSource.value.filter(clip => selectedKeys.value.has(getClipKey(clip)))
  );

  const selectedCount = computed<number>(() => selectedKeys.value.size);

  const isSelectionMode = computed<boolean>(() => selectedKeys.value.size > 0);

  const hiddenSelectionBreakdown = computed(() => {
    const filteredSet = new Set(filteredClips.value.map(getClipKey));
    const visibleSet = new Set(visibleClips.value.map(getClipKey));
    let unloaded = 0;
    let outsideFilter = 0;

    for (const key of selectedKeys.value) {
      if (!filteredSet.has(key)) {
        outsideFilter += 1;
      } else if (!visibleSet.has(key)) {
        unloaded += 1;
      }
    }

    return {
      unloaded,
      outsideFilter,
      total: unloaded + outsideFilter
    };
  });

  const selectedUnloadedCount = computed<number>(
    () => hiddenSelectionBreakdown.value.unloaded
  );

  const selectedOutsideFilterCount = computed<number>(
    () => hiddenSelectionBreakdown.value.outsideFilter
  );

  const selectedHiddenCount = computed<number>(
    () => hiddenSelectionBreakdown.value.total
  );

  const allFilteredSelected = computed<boolean>(() => {
    if (filteredClips.value.length === 0) return false;
    return filteredClips.value.every(clip =>
      selectedKeys.value.has(getClipKey(clip))
    );
  });

  // Reset rendered batch size when query, source filter, or sort order changes.
  watch([searchQuery, sourceFilter, sortBy], () => {
    visibleCount.value = READY_CLIPS_BATCH_SIZE;
  });

  // Keep selection and source filter valid after deletions without resetting scroll depth.
  watch(clipsSource, nextClips => {
    const validKeys = new Set(nextClips.map(getClipKey));

    let changed = false;
    const pruned = new Set<string>();
    for (const key of selectedKeys.value) {
      if (validKeys.has(key)) {
        pruned.add(key);
      } else {
        changed = true;
      }
    }
    if (changed) {
      selectedKeys.value = pruned;
    }

    if (
      lastSelectedAnchorKey.value &&
      !validKeys.has(lastSelectedAnchorKey.value)
    ) {
      lastSelectedAnchorKey.value = Array.from(pruned).at(-1) ?? null;
    }

    if (
      sourceFilter.value !== 'all' &&
      !nextClips.some(clip => clip.folder_name === sourceFilter.value)
    ) {
      sourceFilter.value = 'all';
    }
  });

  function loadMore(): void {
    const total = filteredClips.value.length;
    if (visibleCount.value >= total) return;
    visibleCount.value = Math.min(
      total,
      visibleCount.value + READY_CLIPS_BATCH_SIZE
    );
  }

  function toggleSelectClip(clip: ReadyClip, shiftKey = false): void {
    const key = getClipKey(clip);
    const next = new Set(selectedKeys.value);

    if (shiftKey && lastSelectedAnchorKey.value) {
      const list = filteredClips.value;
      const anchorIdx = list.findIndex(
        item => getClipKey(item) === lastSelectedAnchorKey.value
      );
      const targetIdx = list.findIndex(item => getClipKey(item) === key);

      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        for (let i = start; i <= end; i += 1) {
          const item = list[i];
          if (item) {
            next.add(getClipKey(item));
          }
        }
        selectedKeys.value = next;
        lastSelectedAnchorKey.value = key;
        return;
      }
    }

    const wasSelected = next.has(key);
    if (wasSelected) {
      next.delete(key);
    } else {
      next.add(key);
    }
    selectedKeys.value = next;

    if (next.size === 0) {
      lastSelectedAnchorKey.value = null;
    } else if (!wasSelected) {
      lastSelectedAnchorKey.value = key;
    } else if (lastSelectedAnchorKey.value === key) {
      lastSelectedAnchorKey.value = Array.from(next).at(-1) ?? null;
    }
  }

  function toggleSelectAllMatching(): void {
    const list = filteredClips.value;
    if (list.length === 0) return;

    const next = new Set(selectedKeys.value);
    if (allFilteredSelected.value) {
      for (const clip of list) {
        next.delete(getClipKey(clip));
      }
      selectedKeys.value = next;
      if (
        lastSelectedAnchorKey.value &&
        !next.has(lastSelectedAnchorKey.value)
      ) {
        lastSelectedAnchorKey.value = Array.from(next).at(-1) ?? null;
      }
      return;
    }

    for (const clip of list) {
      next.add(getClipKey(clip));
    }
    selectedKeys.value = next;
    const lastClip = list[list.length - 1];
    lastSelectedAnchorKey.value = lastClip ? getClipKey(lastClip) : null;
  }

  function clearSelection(): void {
    if (selectedKeys.value.size === 0 && lastSelectedAnchorKey.value === null) {
      return;
    }
    selectedKeys.value = new Set();
    lastSelectedAnchorKey.value = null;
  }

  function clearFilters(): void {
    searchQuery.value = '';
    sourceFilter.value = 'all';
  }

  function resetOnOpen(): void {
    visibleCount.value = READY_CLIPS_BATCH_SIZE;
    clearSelection();
  }

  function handleEscape(): 'cleared-selection' | 'close-library' {
    if (selectedKeys.value.size > 0) {
      clearSelection();
      return 'cleared-selection';
    }
    return 'close-library';
  }

  return {
    searchQuery,
    sourceFilter,
    sortBy,
    visibleCount,
    selectedKeys,
    lastSelectedAnchorKey,
    sourceOptions,
    filteredClips,
    visibleClips,
    hasMore,
    hasActiveFilters,
    selectedClips,
    selectedCount,
    isSelectionMode,
    selectedUnloadedCount,
    selectedOutsideFilterCount,
    selectedHiddenCount,
    allFilteredSelected,
    loadMore,
    toggleSelectClip,
    toggleSelectAllMatching,
    clearSelection,
    clearFilters,
    resetOnOpen,
    handleEscape
  };
}
