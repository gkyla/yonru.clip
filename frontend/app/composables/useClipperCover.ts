// useClipperCover.ts - Lean reactive composable delegating to CoverCompositionCoordinator
import { useTimelineState } from './useTimelineState';
import {
  CoverCompositionCoordinator,
  mapCoverOverlays
} from '../utils/coverEngine';
import type {
  CoverTextOverlay,
  CoverConfig,
  DefaultCoverStyle
} from '../types/clipper';

export const useClipperCover = () => {
  const API_BASE = 'http://localhost:8000';
  const timeline = useTimelineState();

  // Ingestion & basic states shared via useState keys
  const jobId = useState<string | null>('jobId');
  const videoFps = useState<number>('videoFps', () => 30);
  const currentTime = useState<number>('currentTime', () => 0);
  const folderName = useState<string | null>('folderName');
  const clipId = useState<string | null>('clipId');

  // Cover core states
  const coverEnabled = useState<boolean>('coverEnabled', () => false);
  const coverUrl = useState<string | null>('coverUrl', () => null);
  const coverDuration = useState<number>('coverDuration', () => 1.0);
  const coverScreenshotTime = useState<number>('coverScreenshotTime', () => 0);
  const coverTextOverlays = useState<CoverTextOverlay[]>(
    'coverTextOverlays',
    () => []
  );
  const coverEditMode = useState<boolean>('coverEditMode', () => false);
  const coverXOffset = useState<number>('coverXOffset', () => 50);
  const defaultCoverStyle = useState<DefaultCoverStyle | null>(
    'defaultCoverStyle',
    () => null
  );
  const activeCoverTextId = useState<string | null>(
    'activeCoverTextId',
    () => null
  );

  // Loading/saving transient states
  const isDeletingCover = ref(false);
  const isCapturingCover = useState<boolean>('isCapturingCover', () => false);

  // Synchronize legacy useState keys for seamless compatibility across all composables & components
  const thumbnailEnabled = useState<boolean>(
    'thumbnailEnabled',
    () => coverEnabled.value
  );
  const thumbnailUrl = useState<string | null>(
    'thumbnailUrl',
    () => coverUrl.value
  );
  const thumbnailDuration = useState<number>(
    'thumbnailDuration',
    () => coverDuration.value
  );
  const thumbnailScreenshotTime = useState<number>(
    'thumbnailScreenshotTime',
    () => coverScreenshotTime.value
  );
  const thumbnailTextOverlays = useState<CoverTextOverlay[]>(
    'thumbnailTextOverlays',
    () => coverTextOverlays.value
  );
  const thumbnailEditMode = useState<boolean>(
    'thumbnailEditMode',
    () => coverEditMode.value
  );
  const thumbnailXOffset = useState<number>(
    'thumbnailXOffset',
    () => coverXOffset.value
  );
  const isCapturingThumbnail = useState<boolean>(
    'isCapturingThumbnail',
    () => isCapturingCover.value
  );

  // Two-way synchronization between cover* and legacy thumbnail* states
  watch(coverEnabled, v => {
    if (thumbnailEnabled.value !== v) thumbnailEnabled.value = v;
  });
  watch(thumbnailEnabled, v => {
    if (coverEnabled.value !== v) coverEnabled.value = v;
  });
  watch(coverUrl, v => {
    if (thumbnailUrl.value !== v) thumbnailUrl.value = v;
  });
  watch(thumbnailUrl, v => {
    if (coverUrl.value !== v) coverUrl.value = v;
  });
  watch(coverDuration, v => {
    if (thumbnailDuration.value !== v) thumbnailDuration.value = v;
  });
  watch(thumbnailDuration, v => {
    if (coverDuration.value !== v) coverDuration.value = v;
  });
  watch(coverScreenshotTime, v => {
    if (thumbnailScreenshotTime.value !== v) thumbnailScreenshotTime.value = v;
  });
  watch(thumbnailScreenshotTime, v => {
    if (coverScreenshotTime.value !== v) coverScreenshotTime.value = v;
  });
  watch(
    coverTextOverlays,
    v => {
      thumbnailTextOverlays.value = v;
    },
    { deep: true }
  );
  watch(
    thumbnailTextOverlays,
    v => {
      coverTextOverlays.value = v;
    },
    { deep: true }
  );
  watch(coverEditMode, v => {
    if (thumbnailEditMode.value !== v) thumbnailEditMode.value = v;
  });
  watch(thumbnailEditMode, v => {
    if (coverEditMode.value !== v) coverEditMode.value = v;
  });
  watch(coverXOffset, v => {
    if (thumbnailXOffset.value !== v) thumbnailXOffset.value = v;
  });
  watch(thumbnailXOffset, v => {
    if (coverXOffset.value !== v) coverXOffset.value = v;
  });
  watch(isCapturingCover, v => {
    if (isCapturingThumbnail.value !== v) isCapturingThumbnail.value = v;
  });
  watch(isCapturingThumbnail, v => {
    if (isCapturingCover.value !== v) isCapturingCover.value = v;
  });

  // Toast notification state
  const toast = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>('clipperToast');
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  function showToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) {
    toast.value = { message, type };
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.value = null;
    }, 3000);
  }

  // --- Watch Handlers for Cover side-effects ---
  let prevDuration = coverDuration.value;
  watch(coverDuration, newVal => {
    currentTime.value = CoverCompositionCoordinator.calculateDurationTimeShift(
      prevDuration,
      newVal,
      currentTime.value,
      coverEnabled.value
    );
    prevDuration = newVal;
  });

  watch(
    [coverEnabled, coverDuration, coverTextOverlays],
    () => {
      if (!timeline.isSavingLocked.value) {
        saveCoverConfig();
      }
    },
    { deep: true }
  );

  // --- Operations ---

  function resetCoverState() {
    timeline.isSavingLocked.value = true;
    coverEnabled.value = false;
    coverUrl.value = null;
    coverScreenshotTime.value = 0;
    coverTextOverlays.value = [];
    coverXOffset.value = 50;

    if (defaultCoverStyle.value?.thumbnailDuration !== undefined) {
      coverDuration.value = defaultCoverStyle.value.thumbnailDuration;
    } else {
      coverDuration.value = 1.0;
    }

    nextTick(() => {
      timeline.isSavingLocked.value = false;
    });
  }

  async function captureScreenshot(timestamp?: number, isAutoCapture = false) {
    if (!jobId.value) {
      isCapturingCover.value = false;
      showToast('No active job found to capture cover', 'error');
      return;
    }

    isCapturingCover.value = true;
    try {
      if (isAutoCapture) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const requestTimestamp =
        CoverCompositionCoordinator.calculateScreenshotRequestTimestamp(
          timestamp,
          videoFps.value || 30
        );

      const res = await $fetch<{
        status: string;
        timestamp: number;
        cover_url?: string;
        thumbnail_url?: string;
      }>(`${API_BASE}/api/cover/screenshot`, {
        method: 'POST',
        body: {
          job_id: jobId.value,
          timestamp: requestTimestamp
        }
      });
      const resolvedUrl = res.cover_url || res.thumbnail_url;
      coverUrl.value = `${API_BASE}${resolvedUrl}?t=${Date.now()}`;
      coverScreenshotTime.value = timestamp ?? res.timestamp;
      coverEnabled.value = true;
      showToast('Cover frame captured!', 'success');
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error('[cover] Failed to capture cover:', e);
      showToast('Failed to capture cover frame', 'error');
    } finally {
      isCapturingCover.value = false;
    }
  }

  function addCoverText() {
    const newOverlay = CoverCompositionCoordinator.createOverlay(
      coverTextOverlays.value,
      defaultCoverStyle.value
    );
    coverTextOverlays.value = [...coverTextOverlays.value, newOverlay];
  }

  function removeCoverText(id: string) {
    coverTextOverlays.value = coverTextOverlays.value.filter(t => t.id !== id);
  }

  async function saveCoverConfig() {
    if (!folderName.value || !clipId.value) return;
    try {
      await $fetch(`${API_BASE}/api/cover/config`, {
        method: 'PUT',
        body: {
          folder_name: folderName.value,
          clip_id: clipId.value,
          config: {
            enabled: coverEnabled.value,
            duration: coverDuration.value,
            screenshotTime: coverScreenshotTime.value,
            textOverlays: coverTextOverlays.value,
            xOffset: coverXOffset.value
          }
        }
      });
    } catch {}
  }

  async function loadCoverConfig() {
    if (!folderName.value || !clipId.value) return;
    try {
      if (!defaultCoverStyle.value) {
        await loadDefaultCoverStyle();
      }
      const res = await $fetch<{ config: CoverConfig; cover_url?: string }>(
        `${API_BASE}/api/cover/config/${folderName.value}/${clipId.value}`
      );
      if (res.config) {
        timeline.isSavingLocked.value = true;
        coverEnabled.value = res.config.enabled ?? false;
        coverDuration.value = res.config.duration ?? 1.0;
        coverScreenshotTime.value = res.config.screenshotTime ?? 0;
        coverXOffset.value = res.config.xOffset ?? 50;
        coverTextOverlays.value = mapCoverOverlays(res.config.textOverlays);

        const baseClipUrl = `${API_BASE}/assets/clips/${folderName.value}/${clipId.value}`;
        try {
          const cUrl =
            res.cover_url || `${baseClipUrl}/cover.jpg?t=${Date.now()}`;
          coverUrl.value = cUrl.startsWith('http')
            ? cUrl
            : `${API_BASE}${cUrl}?t=${Date.now()}`;
        } catch {}

        nextTick(() => {
          timeline.isSavingLocked.value = false;
        });
      } else {
        resetCoverState();
      }
    } catch {
      resetCoverState();
    }
  }

  async function toggleCover() {
    timeline.isTimelineShifting.value = true;
    timeline.isSavingLocked.value = true;

    try {
      if (!coverEnabled.value) {
        const originalTime = currentTime.value;

        if (!coverUrl.value) {
          if (!jobId.value) {
            isCapturingCover.value = false;
            return;
          }
          isCapturingCover.value = true;
          await new Promise(resolve => setTimeout(resolve, 350));
        }

        currentTime.value =
          CoverCompositionCoordinator.calculateToggleTimeShift(
            true,
            coverDuration.value,
            currentTime.value
          );
        coverEnabled.value = true;

        if (!coverUrl.value) {
          try {
            await captureScreenshot(originalTime, true);
          } catch (e) {
            console.error('[cover] Auto-capture during toggle failed:', e);
          } finally {
            isCapturingCover.value = false;
          }
        }
      } else {
        currentTime.value =
          CoverCompositionCoordinator.calculateToggleTimeShift(
            false,
            coverDuration.value,
            currentTime.value
          );
        coverEnabled.value = false;
      }

      await saveCoverConfig();
    } finally {
      isCapturingCover.value = false;
      nextTick(() => {
        timeline.isTimelineShifting.value = false;
        timeline.isSavingLocked.value = false;
      });
    }
  }

  async function deleteCover() {
    if (!folderName.value || !clipId.value) return;

    try {
      await $fetch(
        `${API_BASE}/api/cover/${folderName.value}/${clipId.value}`,
        {
          method: 'DELETE'
        }
      );

      timeline.isTimelineShifting.value = true;
      timeline.isSavingLocked.value = true;
      isDeletingCover.value = true;

      if (coverEnabled.value) {
        currentTime.value = Math.max(
          0,
          currentTime.value - coverDuration.value
        );
      }

      coverUrl.value = null;
      coverEnabled.value = false;
      coverScreenshotTime.value = 0;
      coverTextOverlays.value = [];
      coverDuration.value = 1.0;

      nextTick(() => {
        timeline.isTimelineShifting.value = false;
        timeline.isSavingLocked.value = false;
        isDeletingCover.value = false;
      });

      showToast('Cover slide deleted!', 'success');
    } catch {
      timeline.isTimelineShifting.value = false;
      timeline.isSavingLocked.value = false;
      isDeletingCover.value = false;
      showToast('Failed to delete cover slide', 'error');
    }
  }

  async function loadDefaultCoverStyle() {
    try {
      const res = await $fetch<{ style: DefaultCoverStyle }>(
        `${API_BASE}/api/default-cover-style`
      );
      defaultCoverStyle.value = res?.style || null;
    } catch {
      defaultCoverStyle.value = null;
    }
  }

  async function saveDefaultCoverStyle() {
    const first = coverTextOverlays.value[0];
    if (!first) {
      showToast(
        'Add at least one text overlay to save its style as default!',
        'error'
      );
      return;
    }

    const style = CoverCompositionCoordinator.extractDefaultStyleFromOverlay(
      first,
      coverDuration.value
    );

    try {
      await $fetch(`${API_BASE}/api/default-cover-style`, {
        method: 'PUT',
        body: { style }
      });
      defaultCoverStyle.value = style;
      showToast('Default cover style saved!', 'success');
    } catch {
      showToast('Failed to save default cover style', 'error');
    }
  }

  function applyDefaultCoverStyle() {
    if (!defaultCoverStyle.value) {
      showToast('No default style found to apply!', 'error');
      return;
    }

    coverTextOverlays.value =
      CoverCompositionCoordinator.applyDefaultStyleToOverlays(
        coverTextOverlays.value,
        defaultCoverStyle.value
      );
    showToast('Applied default style to text overlays', 'success');
  }

  return {
    // Canonical Cover Slide API
    coverEnabled,
    coverUrl,
    coverDuration,
    coverScreenshotTime,
    coverTextOverlays,
    coverEditMode,
    coverXOffset,
    activeCoverTextId,
    isDeletingCover,
    isCapturingCover,
    defaultCoverStyle,
    resetCoverState,
    captureScreenshot,
    addCoverText,
    removeCoverText,
    saveCoverConfig,
    loadCoverConfig,
    toggleCover,
    deleteCover,
    loadDefaultCoverStyle,
    saveDefaultCoverStyle,
    applyDefaultCoverStyle,

    // Backward compatibility aliases for thumbnail*
    thumbnailEnabled: coverEnabled,
    thumbnailUrl: coverUrl,
    thumbnailDuration: coverDuration,
    thumbnailScreenshotTime: coverScreenshotTime,
    thumbnailTextOverlays: coverTextOverlays,
    thumbnailEditMode: coverEditMode,
    thumbnailXOffset: coverXOffset,
    activeThumbnailTextId: activeCoverTextId,
    isDeletingThumbnail: isDeletingCover,
    isCapturingThumbnail: isCapturingCover,
    defaultThumbnailStyle: defaultCoverStyle,
    resetThumbnailState: resetCoverState,
    addThumbnailText: addCoverText,
    removeThumbnailText: removeCoverText,
    saveThumbnailConfig: saveCoverConfig,
    loadThumbnailConfig: loadCoverConfig,
    toggleThumbnail: toggleCover,
    deleteThumbnail: deleteCover,
    loadDefaultThumbnailStyle: loadDefaultCoverStyle,
    saveDefaultThumbnailStyle: saveDefaultCoverStyle,
    applyDefaultThumbnailStyle: applyDefaultCoverStyle,

    showToast
  };
};
