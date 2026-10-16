import type { CachedVideo, LastAccessedClip, Hook } from '../types/clipper';
import { resolveApiBase } from '../utils/apiBase';

export const useCachedLibrary = () => {
  const API_BASE = resolveApiBase();
  const folderName = useState<string | null>('folderName', () => null);

  // Cached Videos State & Pagination & Search & Sort
  const cachedVideos = useState<CachedVideo[]>('cachedVideos', () => []);
  const isCachedLoading = useState<boolean>('isCachedLoading', () => false);
  const isCachedMoreLoading = useState<boolean>(
    'isCachedMoreLoading',
    () => false
  );
  const cachedVideosFetchError = useState<boolean>(
    'cachedVideosFetchError',
    () => false
  );
  const cachedVideosTotal = useState<number>('cachedVideosTotal', () => 0);
  const cachedVideosPage = useState<number>('cachedVideosPage', () => 1);
  const cachedVideosLimit = useState<number>('cachedVideosLimit', () => 6);
  const cachedVideosSearch = useState<string>('cachedVideosSearch', () => '');
  const cachedVideosSortBy = useState<string>(
    'cachedVideosSortBy',
    () => 'date'
  );
  const cachedVideosSortOrder = useState<string>(
    'cachedVideosSortOrder',
    () => 'desc'
  );
  const cachedVideosHasMore = useState<boolean>(
    'cachedVideosHasMore',
    () => false
  );
  const cachedVideosRequestId = useState<number>(
    'cachedVideosRequestId',
    () => 0
  );

  // Last Accessed State & Fallback Cache
  const lastAccessedVideoId = useState<string | null>(
    'lastAccessedVideoId',
    () => null
  );
  const lastAccessedClip = useState<LastAccessedClip | null>(
    'lastAccessedClip',
    () => null
  );
  const lastAccessedVideoStored = useState<CachedVideo | null>(
    'lastAccessedVideoStored',
    () => null
  );

  // Saved Hooks State
  const savedHooks = useState<Hook[]>('savedHooks', () => []);

  function updateStoredVideo(vid: CachedVideo) {
    lastAccessedVideoStored.value = vid;
    if (import.meta.client) {
      localStorage.setItem('yonru_last_video_stored', JSON.stringify(vid));
    }
  }

  const lastAccessedVideo = computed(() => {
    const clip = lastAccessedClip.value;
    // 1. Prioritize parent video of the last accessed clip from cachedVideos
    if (clip && clip.folder) {
      const vid = cachedVideos.value.find(
        v => v.folder_name === clip.folder || v.video_id === clip.folder
      );
      if (vid) {
        return vid;
      }
    }
    // 2. Fallback to stored video matching last accessed clip
    if (clip && clip.folder && lastAccessedVideoStored.value) {
      const stored = lastAccessedVideoStored.value;
      if (
        stored.folder_name === clip.folder ||
        stored.video_id === clip.folder
      ) {
        return stored;
      }
    }
    // 3. Fallback to last accessed video ID from cachedVideos
    if (lastAccessedVideoId.value) {
      const vid = cachedVideos.value.find(
        v => v.video_id === lastAccessedVideoId.value
      );
      if (vid) {
        return vid;
      }
    }
    // 4. Fallback to stored video matching last accessed video ID
    if (lastAccessedVideoStored.value && lastAccessedVideoId.value) {
      const stored = lastAccessedVideoStored.value;
      if (stored.video_id === lastAccessedVideoId.value) {
        return stored;
      }
    }
    return null;
  });

  // Synchronize lastAccessedVideoStored reactively via watcher to avoid computed side-effects
  watch(
    [lastAccessedClip, lastAccessedVideoId, cachedVideos],
    ([clip, vidId, videos]) => {
      if (clip && clip.folder) {
        const vid = videos.find(
          v => v.folder_name === clip.folder || v.video_id === clip.folder
        );
        if (vid) {
          updateStoredVideo(vid);
          return;
        }
      }
      if (vidId) {
        const vid = videos.find(v => v.video_id === vidId);
        if (vid) {
          updateStoredVideo(vid);
        }
      }
    },
    { immediate: true }
  );

  async function fetchCached(reset = false) {
    if (reset) {
      cachedVideosPage.value = 1;
      cachedVideosFetchError.value = false;
      isCachedMoreLoading.value = false;
    }
    if (cachedVideosPage.value === 1) {
      isCachedLoading.value = true;
    } else {
      isCachedMoreLoading.value = true;
      cachedVideosFetchError.value = false;
    }

    cachedVideosRequestId.value++;
    const reqId = cachedVideosRequestId.value;
    const requestedPage = reset ? 1 : cachedVideosPage.value;

    try {
      const queryParams: Record<string, string | number> = {
        page: cachedVideosPage.value,
        limit: cachedVideosLimit.value,
        sort_by: cachedVideosSortBy.value,
        order: cachedVideosSortOrder.value
      };
      if (cachedVideosSearch.value) {
        queryParams.search = cachedVideosSearch.value;
      }

      const res = await $fetch<{
        videos: CachedVideo[];
        total: number;
        has_more: boolean;
      }>(`${API_BASE}/api/cached`, { params: queryParams });

      if (reqId !== cachedVideosRequestId.value) {
        return;
      }

      if (requestedPage === 1) {
        cachedVideos.value = res.videos || [];
      } else {
        cachedVideos.value = [...cachedVideos.value, ...(res.videos || [])];
      }
      cachedVideosTotal.value = res.total || 0;
      cachedVideosHasMore.value = res.has_more || false;
      cachedVideosFetchError.value = false;
    } catch (e) {
      if (reqId !== cachedVideosRequestId.value) {
        return;
      }
      console.error('Failed to fetch cached videos', e);
      if (requestedPage === 1) {
        cachedVideos.value = [];
        cachedVideosTotal.value = 0;
        cachedVideosHasMore.value = false;
      } else {
        cachedVideosFetchError.value = true;
      }
    } finally {
      if (reqId === cachedVideosRequestId.value) {
        isCachedLoading.value = false;
        isCachedMoreLoading.value = false;
      }
    }
  }

  function setLastAccessed(vidId: string) {
    lastAccessedVideoId.value = vidId;
    if (import.meta.client) localStorage.setItem('yonru_last_video', vidId);
  }

  function setLastClip(
    folder: string,
    clipId: string,
    title?: string,
    thumbnailUrl?: string,
    theme?: string,
    videoTitle?: string
  ) {
    const parentVideo = cachedVideos.value.find(
      v => v.folder_name === folder || v.video_id === folder
    );
    const resolvedVideoTitle = videoTitle || parentVideo?.title;
    const resolvedTheme = theme || title || 'Current Clip';
    const resolvedThumbnail =
      thumbnailUrl || `/assets/clips/${folder}/${clipId}/thumbnail.jpg`;

    const payload: LastAccessedClip = {
      folder,
      clip_id: clipId,
      title: resolvedTheme,
      theme: resolvedTheme,
      video_title: resolvedVideoTitle,
      thumbnail_url: resolvedThumbnail
    };
    lastAccessedClip.value = payload;
    if (import.meta.client)
      localStorage.setItem('yonru_last_clip', JSON.stringify(payload));
  }

  async function fetchSavedHooks(folder?: string) {
    const targetFolder = folder ?? folderName.value;
    if (!targetFolder) return;
    try {
      const res = await $fetch<{ saved_hooks: Hook[] }>(
        `${API_BASE}/api/cached/${targetFolder}/saved_hooks`
      );
      savedHooks.value = res.saved_hooks || [];
    } catch {
      savedHooks.value = [];
    }
  }

  async function saveHook(hook: Hook, folder?: string) {
    const targetFolder = folder ?? folderName.value;
    if (!targetFolder) return false;
    try {
      const res = await $fetch<{ saved_hooks: Hook[] }>(
        `${API_BASE}/api/cached/saved_hooks`,
        {
          method: 'POST',
          body: { folder_name: targetFolder, hook }
        }
      );
      savedHooks.value = res.saved_hooks || [];
      return true;
    } catch {
      return false;
    }
  }

  async function deleteSavedHook(hookId: string, folder?: string) {
    const targetFolder = folder ?? folderName.value;
    if (!targetFolder) return;
    try {
      const res = await $fetch<{ saved_hooks: Hook[] }>(
        `${API_BASE}/api/cached/${targetFolder}/saved_hooks/${hookId}`,
        {
          method: 'DELETE'
        }
      );
      savedHooks.value = res.saved_hooks || [];
    } catch {}
  }

  return {
    cachedVideos,
    isCachedLoading,
    isCachedMoreLoading,
    cachedVideosFetchError,
    cachedVideosTotal,
    cachedVideosPage,
    cachedVideosLimit,
    cachedVideosSearch,
    cachedVideosSortBy,
    cachedVideosSortOrder,
    cachedVideosHasMore,
    cachedVideosRequestId,
    lastAccessedVideoId,
    lastAccessedClip,
    lastAccessedVideoStored,
    lastAccessedVideo,
    savedHooks,
    updateStoredVideo,
    fetchCached,
    setLastAccessed,
    setLastClip,
    fetchSavedHooks,
    saveHook,
    deleteSavedHook
  };
};
