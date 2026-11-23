<template>
  <dialog
    ref="dialogRef"
    data-testid="ready-clips-library-modal"
    aria-labelledby="ready-clips-library-title"
    closedby="closerequest"
    class="yonru-modal-dialog w-[calc(100%-2rem)] max-w-5xl h-[85vh] bg-surface-dark border border-surface-border text-slate-100 p-0 shadow-2xl m-auto flex-col overflow-hidden"
    @cancel="handleCancel"
    @close="handleNativeClose"
  >
    <template v-if="shouldRenderContent">
      <!-- Header & Compact Single-Row Toolbar -->
      <header
        class="relative z-30 px-5 py-4 sm:px-6 border-b border-surface-border bg-surface-panel/50 shrink-0 flex flex-col gap-3.5"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2.5 min-w-0">
            <Icon
              name="ri:scissors-cut-fill"
              class="text-accent-500 text-lg shrink-0"
              aria-hidden="true"
            />
            <h2
              id="ready-clips-library-title"
              class="text-lg sm:text-xl font-bold text-white tracking-tight truncate"
            >
              Ready Clips Library
            </h2>
            <span
              data-testid="library-total-count"
              class="text-xs font-medium text-slate-400 tabular-nums shrink-0"
            >
              ({{ readyClips.length }})
            </span>
          </div>

          <button
            type="button"
            data-testid="close-library-modal-btn"
            aria-label="Close Ready Clips Library"
            class="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] bg-surface-dark border border-surface-border text-slate-300 hover:text-white hover:border-white/30 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            @click="requestClose"
          >
            <Icon name="ri:close-line" class="text-xl" aria-hidden="true" />
          </button>
        </div>

        <!-- Compact Search / Source Filter / Sort Row -->
        <div
          v-if="readyClips.length > 0"
          class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div
            class="relative flex-1 flex items-center bg-surface-dark border border-surface-border focus-within:border-accent-500/70 transition-colors min-h-[44px] sm:min-h-[38px] px-3"
          >
            <label for="ready-clips-search" class="sr-only">
              Search clips, channels, or source videos
            </label>
            <Icon
              name="ri:search-line"
              class="text-slate-400 text-sm shrink-0 mr-2"
              aria-hidden="true"
            />
            <input
              id="ready-clips-search"
              v-model="searchQuery"
              data-testid="ready-clips-search-input"
              type="text"
              placeholder="Search clips, channels, or source videos..."
              class="w-full bg-transparent border-none text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-0"
            />
            <button
              v-if="searchQuery"
              type="button"
              data-testid="ready-clips-clear-search-btn"
              aria-label="Clear search"
              class="ml-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              @click="searchQuery = ''"
            >
              <Icon name="ri:close-line" class="text-base" aria-hidden="true" />
            </button>
          </div>

          <div class="flex items-center gap-2.5 shrink-0">
            <div class="flex-1 sm:flex-initial min-w-0">
              <LibraryDropdown
                ref="sourceDropdownRef"
                v-model="sourceFilter"
                :open="activeDropdown === 'source'"
                :options="sourceDropdownOptions"
                label="Filter by source video"
                test-id="ready-clips-source-dropdown"
                trigger-class="w-full sm:w-56"
                panel-class="w-full sm:w-72 left-0 sm:right-0 sm:left-auto"
                @update:open="setDropdownOpen('source', $event)"
              />
            </div>

            <div class="shrink-0">
              <LibraryDropdown
                ref="sortDropdownRef"
                :model-value="sortBy"
                :open="activeDropdown === 'sort'"
                :options="sortDropdownOptions"
                label="Sort clips"
                :uppercase="true"
                test-id="ready-clips-sort-dropdown"
                trigger-class="w-full sm:min-w-[168px]"
                panel-class="w-full sm:w-48 right-0"
                @update:model-value="sortBy = $event as ReadyClipsSortOption"
                @update:open="setDropdownOpen('sort', $event)"
              />
            </div>
          </div>
        </div>
      </header>

      <!-- Scrollable Library Body -->
      <div
        ref="scrollContainerRef"
        data-testid="ready-clips-scroll-container"
        class="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6"
      >
        <!-- Library Empty State -->
        <div
          v-if="readyClips.length === 0"
          data-testid="library-empty-state"
          class="h-full min-h-[280px] flex flex-col items-center justify-center text-center px-4"
        >
          <div
            class="w-16 h-16 bg-surface-panel border border-surface-border flex items-center justify-center mb-4 text-slate-400"
          >
            <Icon name="ri:inbox-line" class="text-3xl" aria-hidden="true" />
          </div>
          <h3 class="text-lg font-bold text-white mb-1.5">
            No ready clips yet
          </h3>
          <p class="text-sm text-slate-400 max-w-sm mb-6">
            Generate clips from any video on the home screen to see them here.
          </p>
          <button
            type="button"
            data-testid="library-empty-close-btn"
            class="px-5 py-2.5 min-h-[44px] sm:min-h-[40px] bg-accent-500 hover:bg-accent-400 text-black text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
            @click="requestClose"
          >
            Close
          </button>
        </div>

        <!-- Search / Filter No-Match State -->
        <div
          v-else-if="filteredClips.length === 0"
          data-testid="library-no-matches"
          class="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-4"
        >
          <div
            class="w-14 h-14 bg-surface-panel border border-surface-border flex items-center justify-center mb-4 text-slate-400"
          >
            <Icon name="ri:search-line" class="text-2xl" aria-hidden="true" />
          </div>
          <h3 class="text-base font-bold text-white mb-1.5">
            No matching clips
          </h3>
          <p class="text-xs sm:text-sm text-slate-400 max-w-sm mb-5">
            Try a different search term or source video filter.
          </p>
          <button
            type="button"
            data-testid="library-clear-filters-btn"
            class="px-4 py-2 min-h-[44px] sm:min-h-[38px] bg-surface-panel border border-surface-border hover:border-accent-500/60 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
            @click="clearFilters"
          >
            Clear filters
          </button>
        </div>

        <!-- Progressive Infinite-Scroll Clips Grid -->
        <div v-else class="flex flex-col gap-5">
          <div
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          >
            <ReadyClipCard
              v-for="clip in visibleClips"
              :key="getClipKey(clip)"
              :clip="clip"
              :api-base="apiBase"
              :selectable="true"
              :selected="selectedKeys.has(getClipKey(clip))"
              :selection-active="isSelectionMode"
              @open="handleOpenClip"
              @toggle-select="handleToggleSelect"
              @request-delete="handleSingleDeleteRequest"
            />
          </div>

          <!-- Sentinel & Keyboard Load-More Fallback -->
          <div
            v-if="hasMore"
            ref="sentinelRef"
            data-testid="ready-clips-sentinel"
            class="pt-2 pb-1 flex flex-wrap items-center justify-between gap-3 border-t border-surface-border/60 text-xs text-slate-400"
          >
            <span class="font-medium tabular-nums">
              Showing {{ visibleClips.length }} of {{ filteredClips.length }}
            </span>
            <button
              type="button"
              data-testid="ready-clips-load-more-btn"
              class="px-3.5 py-2 min-h-[44px] sm:min-h-[34px] bg-surface-panel border border-surface-border hover:border-accent-500/60 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              @click="loadMore"
            >
              Load more
            </button>
          </div>

          <!-- Quiet End-of-Library Marker -->
          <div
            v-else
            data-testid="ready-clips-end-marker"
            class="pt-2 pb-1 text-center text-xs font-medium text-slate-400 tabular-nums border-t border-surface-border/60"
          >
            All {{ filteredClips.length }} clips shown
          </div>
        </div>
      </div>

      <!-- Docked Bottom Bulk Action Bar (Normal Flex Flow, Never Overlapping Cards) -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="isSelectionMode"
          data-testid="ready-clips-bulk-bar"
          class="shrink-0 border-t border-surface-border bg-surface-panel/95 px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2.5 flex-wrap">
            <span
              data-testid="bulk-selected-count"
              class="text-xs sm:text-sm font-semibold text-white tabular-nums"
            >
              {{ selectedCount }} selected
            </span>
            <span
              v-if="selectedHiddenCount > 0"
              data-testid="bulk-hidden-count"
              class="text-xs font-medium text-accent-400 bg-accent-500/10 border border-accent-500/30 px-2 py-0.5 tabular-nums"
            >
              {{
                selectedOutsideFilterCount === 0
                  ? `+${selectedUnloadedCount} below fold`
                  : `+${selectedHiddenCount} not in view`
              }}
            </span>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid="bulk-select-all-btn"
              class="px-3 py-2 min-h-[44px] sm:min-h-[36px] bg-surface-dark border border-surface-border hover:border-accent-500/60 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              @click="toggleSelectAllMatching"
            >
              {{
                allFilteredSelected
                  ? 'Deselect all'
                  : `Select all (${filteredClips.length})`
              }}
            </button>

            <button
              type="button"
              data-testid="bulk-clear-btn"
              class="px-3 py-2 min-h-[44px] sm:min-h-[36px] bg-transparent border border-surface-border hover:border-white/30 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              @click="clearSelection"
            >
              Clear
            </button>

            <button
              type="button"
              data-testid="bulk-delete-btn"
              :disabled="isDeleting"
              class="px-4 py-2 min-h-[44px] sm:min-h-[36px] bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              @click="requestBulkDelete"
            >
              <Icon
                name="ri:delete-bin-line"
                class="text-sm"
                aria-hidden="true"
              />
              <span>Delete ({{ selectedCount }})</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Polite Screen-Reader Status Announcements -->
      <div class="sr-only" aria-live="polite">
        {{ liveAnnouncement }}
      </div>
    </template>
  </dialog>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  toRef,
  watch
} from 'vue';
import type { ReadyClip } from '../../types/clipper';
import {
  getClipKey,
  useReadyClipsLibrary,
  type ReadyClipsSortOption
} from '../../composables/useReadyClipsLibrary';
import {
  attachLightDismiss,
  closeModalDialog,
  openModalDialog,
  supportsTopLayerExit
} from '../../utils/topLayerDialog';
import LibraryDropdown, {
  type LibraryDropdownOption
} from './LibraryDropdown.vue';
import ReadyClipCard from './ReadyClipCard.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    readyClips: ReadyClip[];
    apiBase: string;
    hasDeleteConfirmOpen?: boolean;
    isDeleting?: boolean;
  }>(),
  {
    hasDeleteConfirmOpen: false,
    isDeleting: false
  }
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  'open-clip': [clip: ReadyClip];
  'request-delete': [clips: ReadyClip[]];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const scrollContainerRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const shouldRenderContent = ref(props.open);
const liveAnnouncement = ref('');
const activeDropdown = ref<'source' | 'sort' | null>(null);
const sourceDropdownRef = ref<InstanceType<typeof LibraryDropdown> | null>(
  null
);
const sortDropdownRef = ref<InstanceType<typeof LibraryDropdown> | null>(null);

let observer: IntersectionObserver | null = null;
let cleanupLightDismiss: (() => void) | null = null;

const {
  searchQuery,
  sourceFilter,
  sortBy,
  selectedKeys,
  sourceOptions,
  filteredClips,
  visibleClips,
  hasMore,
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
} = useReadyClipsLibrary(toRef(props, 'readyClips'));

const sourceDropdownOptions = computed<LibraryDropdownOption[]>(() => [
  {
    value: 'all',
    label: 'All source videos',
    icon: 'ri:folder-video-line',
    meta: String(props.readyClips.length)
  },
  ...sourceOptions.value.map(opt => ({
    value: opt.folder_name,
    label: opt.title,
    icon: 'ri:film-line',
    meta: String(opt.count)
  }))
]);

const sortDropdownOptions: LibraryDropdownOption[] = [
  { value: 'newest', label: 'Newest First', icon: 'ri:calendar-line' },
  { value: 'oldest', label: 'Oldest First', icon: 'ri:calendar-line' },
  { value: 'shortest', label: 'Shortest First', icon: 'ri:time-line' },
  { value: 'longest', label: 'Longest First', icon: 'ri:time-line' },
  { value: 'title_asc', label: 'Title A-Z', icon: 'ri:sort-asc' }
];

function setDropdownOpen(id: 'source' | 'sort', isOpen: boolean): void {
  if (isOpen) {
    activeDropdown.value = id;
    return;
  }
  if (activeDropdown.value === id) {
    activeDropdown.value = null;
  }
}

function closeActiveDropdown(restoreFocus = false): void {
  const previous = activeDropdown.value;
  if (!previous) return;
  activeDropdown.value = null;
  if (!restoreFocus) return;
  if (previous === 'source') {
    sourceDropdownRef.value?.focusTrigger();
  } else {
    sortDropdownRef.value?.focusTrigger();
  }
}

function disconnectObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function setupObserver(): void {
  disconnectObserver();
  if (
    !props.open ||
    !hasMore.value ||
    !sentinelRef.value ||
    typeof IntersectionObserver === 'undefined'
  ) {
    return;
  }

  observer = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadMore();
      }
    },
    {
      root: scrollContainerRef.value,
      rootMargin: '200px 0px',
      threshold: 0
    }
  );
  observer.observe(sentinelRef.value);
}

watch(
  () => props.open,
  async (isOpen, wasOpen) => {
    if (isOpen) {
      shouldRenderContent.value = true;
      if (!wasOpen) {
        activeDropdown.value = null;
        resetOnOpen();
        liveAnnouncement.value = '';
      }
      await nextTick();
      openModalDialog(dialogRef.value);
      setupObserver();
      return;
    }

    activeDropdown.value = null;
    disconnectObserver();
    await closeModalDialog(dialogRef.value);
    if (!props.open) {
      shouldRenderContent.value = false;
      clearSelection();
    }
  },
  { immediate: true, flush: 'post' }
);

watch(
  [hasMore, sentinelRef, () => filteredClips.value.length],
  async () => {
    if (!props.open) return;
    await nextTick();
    setupObserver();
  },
  { flush: 'post' }
);

// Reset scroll to top on query, source filter, or sort changes; preserve scroll depth after deletions.
watch([searchQuery, sourceFilter, sortBy], () => {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = 0;
  }
});

onMounted(() => {
  const dialog = dialogRef.value;
  if (!dialog) return;
  cleanupLightDismiss = attachLightDismiss(
    dialog,
    requestClose,
    () => !props.hasDeleteConfirmOpen && !props.isDeleting
  );
});

onUnmounted(() => {
  disconnectObserver();
  cleanupLightDismiss?.();
  cleanupLightDismiss = null;
});

function requestClose(): void {
  if (props.hasDeleteConfirmOpen || props.isDeleting) return;
  activeDropdown.value = null;
  emit('update:open', false);
}

function handleCancel(event: Event): void {
  if (props.hasDeleteConfirmOpen || props.isDeleting) {
    event.preventDefault();
    return;
  }

  if (activeDropdown.value !== null) {
    event.preventDefault();
    closeActiveDropdown(true);
    return;
  }

  if (handleEscape() === 'cleared-selection') {
    event.preventDefault();
    liveAnnouncement.value = 'Selection cleared.';
    return;
  }

  if (!supportsTopLayerExit()) {
    event.preventDefault();
  }
  emit('update:open', false);
}

function handleNativeClose(): void {
  activeDropdown.value = null;
  disconnectObserver();
  if (props.open) {
    emit('update:open', false);
  }
}

function handleOpenClip(clip: ReadyClip): void {
  emit('open-clip', clip);
}

function handleToggleSelect(payload: {
  clip: ReadyClip;
  shiftKey: boolean;
}): void {
  toggleSelectClip(payload.clip, payload.shiftKey);
}

function handleSingleDeleteRequest(clip: ReadyClip): void {
  emit('request-delete', [clip]);
}

function requestBulkDelete(): void {
  if (selectedClips.value.length === 0) return;
  emit('request-delete', selectedClips.value);
}
</script>
