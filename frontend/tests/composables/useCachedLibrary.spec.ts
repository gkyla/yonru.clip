// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick, watchEffect } from 'vue';
import { useCachedLibrary } from '../../app/composables/useCachedLibrary';
import type { CachedVideo, Hook } from '../../app/types/clipper';
import { resolveApiBase } from '../../app/utils/apiBase';

describe('useCachedLibrary Composable', () => {
  const API_BASE = resolveApiBase();

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({ videos: [], total: 0, has_more: false })
    );
    const library = useCachedLibrary();
    library.cachedVideos.value = [];
    library.isCachedLoading.value = false;
    library.isCachedMoreLoading.value = false;
    library.cachedVideosFetchError.value = false;
    library.cachedVideosTotal.value = 0;
    library.cachedVideosPage.value = 1;
    library.cachedVideosLimit.value = 6;
    library.cachedVideosSearch.value = '';
    library.cachedVideosSortBy.value = 'date';
    library.cachedVideosSortOrder.value = 'desc';
    library.cachedVideosHasMore.value = false;
    library.lastAccessedVideoId.value = null;
    library.lastAccessedClip.value = null;
    library.lastAccessedVideoStored.value = null;
    library.savedHooks.value = [];
    const folderState = useState<string | null>('folderName', () => null);
    folderState.value = null;
  });

  describe('initialization', () => {
    it('initializes with default query parameters and reactive state', () => {
      const library = useCachedLibrary();

      expect(library.cachedVideos.value).toEqual([]);
      expect(library.isCachedLoading.value).toBe(false);
      expect(library.isCachedMoreLoading.value).toBe(false);
      expect(library.cachedVideosFetchError.value).toBe(false);
      expect(library.cachedVideosTotal.value).toBe(0);
      expect(library.cachedVideosPage.value).toBe(1);
      expect(library.cachedVideosLimit.value).toBe(6);
      expect(library.cachedVideosSearch.value).toBe('');
      expect(library.cachedVideosSortBy.value).toBe('date');
      expect(library.cachedVideosSortOrder.value).toBe('desc');
      expect(library.cachedVideosHasMore.value).toBe(false);
      expect(library.lastAccessedVideoId.value).toBeNull();
      expect(library.lastAccessedClip.value).toBeNull();
      expect(library.lastAccessedVideo.value).toBeNull();
      expect(library.savedHooks.value).toEqual([]);
    });
  });

  describe('fetchCached pagination, search, and sorting', () => {
    it('fetches page 1 with query parameters and updates collection', async () => {
      const library = useCachedLibrary();
      const mockVideos: CachedVideo[] = [
        {
          video_id: 'vid1',
          title: 'Video 1',
          duration: 120,
          folder_name: 'v1'
        },
        { video_id: 'vid2', title: 'Video 2', duration: 180, folder_name: 'v2' }
      ];
      const mockFetch = vi.fn().mockResolvedValue({
        videos: mockVideos,
        total: 10,
        has_more: true
      });
      vi.stubGlobal('$fetch', mockFetch);

      library.cachedVideosSearch.value = 'query';
      library.cachedVideosSortBy.value = 'title';
      library.cachedVideosSortOrder.value = 'asc';
      library.cachedVideosLimit.value = 2;

      await library.fetchCached(true);

      expect(library.cachedVideosPage.value).toBe(1);
      expect(library.cachedVideos.value).toEqual(mockVideos);
      expect(library.cachedVideosTotal.value).toBe(10);
      expect(library.cachedVideosHasMore.value).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/cached`, {
        params: {
          page: 1,
          limit: 2,
          sort_by: 'title',
          order: 'asc',
          search: 'query'
        }
      });
    });

    it('omits search query parameter when search is empty or cleared', async () => {
      const library = useCachedLibrary();
      const mockFetch = vi.fn().mockResolvedValue({
        videos: [],
        total: 0,
        has_more: false
      });
      vi.stubGlobal('$fetch', mockFetch);

      library.cachedVideosSearch.value = '';
      library.cachedVideosSortBy.value = 'date';
      library.cachedVideosSortOrder.value = 'desc';

      await library.fetchCached(true);

      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/cached`, {
        params: {
          page: 1,
          limit: 6,
          sort_by: 'date',
          order: 'desc'
        }
      });
    });

    it('handles sorting options changes in isolation', async () => {
      const library = useCachedLibrary();
      const mockFetch = vi.fn().mockResolvedValue({
        videos: [],
        total: 0,
        has_more: false
      });
      vi.stubGlobal('$fetch', mockFetch);

      // Sort by duration ascending
      library.cachedVideosSortBy.value = 'duration';
      library.cachedVideosSortOrder.value = 'asc';
      await library.fetchCached(true);

      expect(mockFetch).toHaveBeenLastCalledWith(`${API_BASE}/api/cached`, {
        params: {
          page: 1,
          limit: 6,
          sort_by: 'duration',
          order: 'asc'
        }
      });

      // Toggle order to desc
      library.cachedVideosSortOrder.value = 'desc';
      await library.fetchCached(true);

      expect(mockFetch).toHaveBeenLastCalledWith(`${API_BASE}/api/cached`, {
        params: {
          page: 1,
          limit: 6,
          sort_by: 'duration',
          order: 'desc'
        }
      });
    });

    it('accumulates videos on subsequent page loads without reset', async () => {
      const library = useCachedLibrary();
      const page1Videos: CachedVideo[] = [
        { video_id: 'vid1', title: 'Video 1', duration: 100, folder_name: 'v1' }
      ];
      const page2Videos: CachedVideo[] = [
        { video_id: 'vid2', title: 'Video 2', duration: 200, folder_name: 'v2' }
      ];

      const mockFetch = vi.fn().mockResolvedValueOnce({
        videos: page1Videos,
        total: 2,
        has_more: true
      });
      vi.stubGlobal('$fetch', mockFetch);

      await library.fetchCached(true);
      expect(library.cachedVideos.value).toEqual(page1Videos);

      mockFetch.mockResolvedValueOnce({
        videos: page2Videos,
        total: 2,
        has_more: false
      });

      library.cachedVideosPage.value = 2;
      await library.fetchCached(false);

      expect(library.cachedVideosPage.value).toBe(2);
      expect(library.cachedVideos.value).toEqual([
        ...page1Videos,
        ...page2Videos
      ]);
      expect(library.cachedVideosHasMore.value).toBe(false);
    });

    it('manages loading states for initial and subsequent fetches', async () => {
      const library = useCachedLibrary();
      let resolvePromise: any;
      const fetchPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      vi.stubGlobal('$fetch', vi.fn().mockReturnValue(fetchPromise));

      const runPage1 = library.fetchCached(true);
      expect(library.isCachedLoading.value).toBe(true);
      expect(library.isCachedMoreLoading.value).toBe(false);

      resolvePromise({ videos: [], total: 0, has_more: false });
      await runPage1;
      expect(library.isCachedLoading.value).toBe(false);

      // Subsequent page fetch
      library.cachedVideosPage.value = 2;
      const fetchPromise2 = new Promise(resolve => {
        resolvePromise = resolve;
      });
      vi.stubGlobal('$fetch', vi.fn().mockReturnValue(fetchPromise2));

      const runPage2 = library.fetchCached(false);
      expect(library.isCachedLoading.value).toBe(false);
      expect(library.isCachedMoreLoading.value).toBe(true);

      resolvePromise({ videos: [], total: 0, has_more: false });
      await runPage2;
      expect(library.isCachedMoreLoading.value).toBe(false);
    });

    it('handles fetch errors on page 1 and subsequent pages', async () => {
      const library = useCachedLibrary();
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      // Error on page 1
      await library.fetchCached(true);
      expect(library.cachedVideos.value).toEqual([]);
      expect(library.cachedVideosTotal.value).toBe(0);
      expect(library.cachedVideosHasMore.value).toBe(false);
      expect(library.cachedVideosFetchError.value).toBe(false);

      // Error on subsequent page
      library.cachedVideos.value = [
        { video_id: 'v1', title: 'V1', duration: 10, folder_name: 'f1' }
      ];
      library.cachedVideosPage.value = 2;

      await library.fetchCached(false);
      expect(library.cachedVideos.value).toHaveLength(1);
      expect(library.cachedVideosFetchError.value).toBe(true);
    });
  });

  describe('race condition cancellation', () => {
    it('discards stale responses when newer fetch is initiated', async () => {
      const library = useCachedLibrary();

      let resolveOlder: any;
      let resolveNewer: any;
      const olderPromise = new Promise(resolve => {
        resolveOlder = resolve;
      });
      const newerPromise = new Promise(resolve => {
        resolveNewer = resolve;
      });

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? olderPromise : newerPromise;
      });
      vi.stubGlobal('$fetch', mockFetch);

      const runOlder = library.fetchCached(true);
      const runNewer = library.fetchCached(true);

      // Newer resolves first
      resolveNewer({
        videos: [
          {
            video_id: 'v_newer',
            title: 'Newer',
            duration: 10,
            folder_name: 'fn_newer'
          }
        ],
        total: 1,
        has_more: false
      });
      await runNewer;

      expect(library.cachedVideos.value[0]?.video_id).toBe('v_newer');

      // Older resolves later
      resolveOlder({
        videos: [
          {
            video_id: 'v_older',
            title: 'Older',
            duration: 10,
            folder_name: 'fn_older'
          }
        ],
        total: 1,
        has_more: false
      });
      await runOlder;

      // Must NOT be overwritten by older request
      expect(library.cachedVideos.value[0]?.video_id).toBe('v_newer');
    });
  });

  describe('lastAccessedVideo multi-tier resolution and fallback cache', () => {
    it('resolves lastAccessedVideo prioritizing clip folder over video id', async () => {
      const library = useCachedLibrary();
      const videoA: CachedVideo = {
        video_id: 'vidA',
        title: 'Video A',
        duration: 10,
        folder_name: 'folderA'
      };
      const videoB: CachedVideo = {
        video_id: 'vidB',
        title: 'Video B',
        duration: 20,
        folder_name: 'folderB'
      };

      library.cachedVideos.value = [videoA, videoB];

      library.setLastAccessed('vidB');
      expect(library.lastAccessedVideo.value).toEqual(videoB);

      library.setLastClip('folderA', 'clip1', 'Clip Title');
      await nextTick();

      // Clip folder has higher priority than lastAccessedVideoId
      expect(library.lastAccessedVideo.value).toEqual(videoA);
    });

    it('falls back to lastAccessedVideoStored when target video is paginated out', async () => {
      const library = useCachedLibrary();
      const targetVideo: CachedVideo = {
        video_id: 'vid_target',
        title: 'Target Video',
        duration: 300,
        folder_name: 'folder_target'
      };

      library.cachedVideos.value = [targetVideo];
      library.setLastAccessed('vid_target');
      await nextTick();

      expect(library.lastAccessedVideo.value).toEqual(targetVideo);

      // Now video is paginated out of cachedVideos list
      library.cachedVideos.value = [
        {
          video_id: 'vid_other',
          title: 'Other Video',
          duration: 100,
          folder_name: 'folder_other'
        }
      ];
      await nextTick();

      // Fallback cache should still resolve target video
      expect(library.lastAccessedVideo.value).toEqual(targetVideo);
    });

    it('retains lastAccessedVideo via fallback cache when items are sorted out of the active list', async () => {
      const library = useCachedLibrary();
      const sortedOutVideo: CachedVideo = {
        video_id: 'vid_sorted_out',
        title: 'A Sorted Out Video',
        duration: 150,
        folder_name: 'folder_sorted'
      };

      library.cachedVideos.value = [sortedOutVideo];
      library.setLastClip('folder_sorted', 'clip_101', 'Sorted Clip');
      await nextTick();

      expect(library.lastAccessedVideo.value).toEqual(sortedOutVideo);

      // Simulate sorting reversing order such that only different videos are present
      library.cachedVideos.value = [
        {
          video_id: 'vid_z',
          title: 'Z Video',
          duration: 400,
          folder_name: 'folder_z'
        }
      ];
      await nextTick();

      // Fallback cache preserves the clip parent video
      expect(library.lastAccessedVideo.value).toEqual(sortedOutVideo);
    });

    it('resolves lastAccessedVideo when clip folder matches video_id', async () => {
      const library = useCachedLibrary();
      const videoById: CachedVideo = {
        video_id: 'youtube_id_123',
        title: 'YouTube ID Video',
        duration: 250,
        folder_name: 'different_folder_name'
      };

      library.cachedVideos.value = [videoById];
      library.setLastClip('youtube_id_123', 'clip_abc', 'YouTube Clip');
      await nextTick();

      expect(library.lastAccessedVideo.value).toEqual(videoById);
    });

    it('persists setLastAccessed and setLastClip to localStorage', () => {
      const library = useCachedLibrary();

      library.setLastAccessed('my_video_123');
      expect(localStorage.getItem('yonru_last_video')).toBe('my_video_123');

      library.setLastClip(
        'folderX',
        'clipY',
        'My Clip Title',
        '/thumb.jpg',
        'My Theme',
        'Parent Title'
      );
      const storedClip = JSON.parse(
        localStorage.getItem('yonru_last_clip') || '{}'
      );
      expect(storedClip).toEqual({
        folder: 'folderX',
        clip_id: 'clipY',
        title: 'My Theme',
        theme: 'My Theme',
        video_title: 'Parent Title',
        thumbnail_url: '/thumb.jpg'
      });
    });

    it('does not cause recursive update loops during reactive observation', async () => {
      const library = useCachedLibrary();
      const video: CachedVideo = {
        video_id: 'vid1',
        title: 'Vid 1',
        duration: 10,
        folder_name: 'f1'
      };
      library.cachedVideos.value = [video];

      let count = 0;
      const stop = watchEffect(() => {
        count++;
        const _v = library.lastAccessedVideo.value;
        const _s = library.lastAccessedVideoStored.value;
      });

      library.setLastClip('f1', 'c1', 'Test Clip');
      await nextTick();

      stop();
      expect(count).toBeLessThan(10);
    });
  });

  describe('saved hooks management', () => {
    it('fetches saved hooks for a folder from shared state and updates state', async () => {
      const folderState = useState<string | null>('folderName', () => null);
      folderState.value = 'my_folder';
      const library = useCachedLibrary();

      const mockHooks: Hook[] = [
        { start: 0, end: 10, theme: 'Hook 1' },
        { start: 15, end: 30, theme: 'Hook 2' }
      ];
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockResolvedValue({ saved_hooks: mockHooks })
      );

      await library.fetchSavedHooks();

      expect(library.savedHooks.value).toEqual(mockHooks);
      expect($fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/cached/my_folder/saved_hooks`
      );
    });

    it('allows overriding target folder in fetchSavedHooks', async () => {
      const library = useCachedLibrary();
      const mockHooks: Hook[] = [
        { start: 5, end: 20, theme: 'Direct Folder Hook' }
      ];
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockResolvedValue({ saved_hooks: mockHooks })
      );

      await library.fetchSavedHooks('explicit_folder');

      expect(library.savedHooks.value).toEqual(mockHooks);
      expect($fetch).toHaveBeenCalledWith(
        `${API_BASE}/api/cached/explicit_folder/saved_hooks`
      );
    });

    it('handles saved hooks fetch failure gracefully', async () => {
      const library = useCachedLibrary();
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Fetch failed'))
      );

      await library.fetchSavedHooks('failing_folder');

      expect(library.savedHooks.value).toEqual([]);
    });

    it('saves a hook and updates savedHooks collection', async () => {
      const folderState = useState<string | null>('folderName', () => null);
      folderState.value = 'folder_for_save';
      const library = useCachedLibrary();

      const newHook: Hook = { start: 10, end: 25, theme: 'Newly Saved' };
      const updatedList: Hook[] = [newHook];

      const mockFetch = vi.fn().mockResolvedValue({ saved_hooks: updatedList });
      vi.stubGlobal('$fetch', mockFetch);

      const success = await library.saveHook(newHook);

      expect(success).toBe(true);
      expect(library.savedHooks.value).toEqual(updatedList);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/cached/saved_hooks`,
        {
          method: 'POST',
          body: { folder_name: 'folder_for_save', hook: newHook }
        }
      );
    });

    it('returns false when saveHook is called without folder or on network failure', async () => {
      const library = useCachedLibrary();
      const hook: Hook = { start: 1, end: 5, theme: 'Test' };

      // No folder available
      const noFolderResult = await library.saveHook(hook);
      expect(noFolderResult).toBe(false);

      // Network error with explicit folder
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Save error'))
      );
      const errorResult = await library.saveHook(hook, 'folder_with_error');
      expect(errorResult).toBe(false);
    });

    it('deletes a saved hook and updates savedHooks', async () => {
      const library = useCachedLibrary();
      const remainingHooks: Hook[] = [
        { start: 0, end: 10, theme: 'Remaining' }
      ];
      const mockFetch = vi
        .fn()
        .mockResolvedValue({ saved_hooks: remainingHooks });
      vi.stubGlobal('$fetch', mockFetch);

      await library.deleteSavedHook('hook_to_delete', 'target_folder');

      expect(library.savedHooks.value).toEqual(remainingHooks);
      expect(mockFetch).toHaveBeenCalledWith(
        `${API_BASE}/api/cached/target_folder/saved_hooks/hook_to_delete`,
        { method: 'DELETE' }
      );
    });
  });
});
