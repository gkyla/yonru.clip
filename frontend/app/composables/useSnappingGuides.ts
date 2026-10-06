import { ref } from 'vue';
import { useState } from '#app';

export interface GuideLine {
  position: number;
  type: 'center' | 'safe';
  orientation: 'vertical' | 'horizontal';
}

export interface ActiveGuides {
  vertical?: { position: number; type: 'center' | 'safe' };
  horizontal?: { position: number; type: 'center' | 'safe' };
}

export interface SnapParams {
  x: number;
  y: number;
  width: number;
  height: number;
  isCentered?: boolean;
  platform?: 'none' | 'tiktok' | 'reels' | 'shorts' | string;
  isAltPressed?: boolean;
}

export interface SnapResult {
  snappedX: number;
  snappedY: number;
  activeGuides: ActiveGuides;
}

export interface SafeBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
export const CANVAS_CENTER_X = 540;
export const CANVAS_CENTER_Y = 960;
export const SNAP_THRESHOLD = 20;

export const PLATFORM_SAFE_BOUNDS: Record<string, SafeBounds> = {
  tiktok: {
    top: 210,
    bottom: 1470,
    left: 40,
    right: 940
  },
  reels: {
    top: 230,
    bottom: 1460,
    left: 40,
    right: 950
  },
  shorts: {
    top: 170,
    bottom: 1540,
    left: 40,
    right: 950
  },
  none: {
    top: 192,
    bottom: 1728,
    left: 108,
    right: 972
  }
};

function safeUseState<T>(key: string, init: () => T) {
  try {
    return useState<T>(key, init);
  } catch {
    return ref(init());
  }
}

export const useSnappingGuides = () => {
  const isSnappingEnabled = safeUseState<boolean>(
    'isSnappingEnabled',
    () => true
  );
  const activeGuides = safeUseState<ActiveGuides>(
    'activeSnappingGuides',
    () => ({})
  );

  function clearGuides() {
    activeGuides.value = {};
  }

  function toggleSnapping() {
    isSnappingEnabled.value = !isSnappingEnabled.value;
  }

  function calculateSnap(params: SnapParams): SnapResult {
    const {
      x,
      y,
      width,
      height,
      isCentered = true,
      platform = 'none',
      isAltPressed = false
    } = params;

    if (!isSnappingEnabled.value || isAltPressed) {
      clearGuides();
      return {
        snappedX: x,
        snappedY: y,
        activeGuides: {}
      };
    }

    let snappedX = x;
    let snappedY = y;
    const guides: ActiveGuides = {};

    // Determine center and edge coordinates based on anchor point
    const centerX = isCentered ? x : x + width / 2;
    const centerY = isCentered ? y : y + height / 2;

    const left = isCentered ? x - width / 2 : x;
    const right = isCentered ? x + width / 2 : x + width;
    const top = isCentered ? y - height / 2 : y;
    const bottom = isCentered ? y + height / 2 : y + height;

    // --- HORIZONTAL SNAP (X-Axis) ---
    // 1. Axial Center Line (X = 540)
    if (Math.abs(centerX - CANVAS_CENTER_X) <= SNAP_THRESHOLD) {
      snappedX = isCentered ? CANVAS_CENTER_X : CANVAS_CENTER_X - width / 2;
      guides.vertical = { position: CANVAS_CENTER_X, type: 'center' };
    } else {
      // 2. Safe zone boundaries (Left and Right edges)
      const bounds =
        PLATFORM_SAFE_BOUNDS[platform] ?? PLATFORM_SAFE_BOUNDS.none;
      if (Math.abs(left - bounds.left) <= SNAP_THRESHOLD) {
        snappedX = isCentered ? bounds.left + width / 2 : bounds.left;
        guides.vertical = { position: bounds.left, type: 'safe' };
      } else if (Math.abs(right - bounds.right) <= SNAP_THRESHOLD) {
        snappedX = isCentered ? bounds.right - width / 2 : bounds.right - width;
        guides.vertical = { position: bounds.right, type: 'safe' };
      }
    }

    // --- VERTICAL SNAP (Y-Axis) ---
    // 1. Axial Center Line (Y = 960)
    if (Math.abs(centerY - CANVAS_CENTER_Y) <= SNAP_THRESHOLD) {
      snappedY = isCentered ? CANVAS_CENTER_Y : CANVAS_CENTER_Y - height / 2;
      guides.horizontal = { position: CANVAS_CENTER_Y, type: 'center' };
    } else {
      // 2. Safe zone boundaries (Top and Bottom edges)
      const bounds =
        PLATFORM_SAFE_BOUNDS[platform] ?? PLATFORM_SAFE_BOUNDS.none;
      if (Math.abs(top - bounds.top) <= SNAP_THRESHOLD) {
        snappedY = isCentered ? bounds.top + height / 2 : bounds.top;
        guides.horizontal = { position: bounds.top, type: 'safe' };
      } else if (Math.abs(bottom - bounds.bottom) <= SNAP_THRESHOLD) {
        snappedY = isCentered
          ? bounds.bottom - height / 2
          : bounds.bottom - height;
        guides.horizontal = { position: bounds.bottom, type: 'safe' };
      }
    }

    activeGuides.value = guides;

    return {
      snappedX,
      snappedY,
      activeGuides: guides
    };
  }

  return {
    isSnappingEnabled,
    activeGuides,
    calculateSnap,
    clearGuides,
    toggleSnapping
  };
};
