import type { CropMapEntry, SubtitleWord } from './types';

export type { CropMapEntry };

export const CROP_TIME_EPSILON = 0.001;
const WORD_TIMING_EPSILON = 0.05;

export interface TimelineVideoSegmentBounds {
  id?: string;
  start: number;
  duration: number;
  mediaStart?: number;
}

export interface SegmentFrameWindow {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  mediaStartFrame: number;
}

export interface IndexedVideoSegment<
  T extends TimelineVideoSegmentBounds = TimelineVideoSegmentBounds
> {
  readonly segment: T;
  readonly window: SegmentFrameWindow;
}

export interface CropSplitWindow {
  start: number;
  end: number;
}

export interface ViewportFramingParams {
  cropMap?: readonly CropMapEntry[];
  cropMapIndex?: CropMapIndex;
  cropX?: number;
  cropPercentXTop?: number;
  cropPercentXBottom?: number;
  splitZoomTop?: number;
  splitZoomBottom?: number;
  splitOffsetXTop?: number;
  splitOffsetYTop?: number;
  splitOffsetXBottom?: number;
  splitOffsetYBottom?: number;
  rawSourceW: number;
  isLandscape: boolean;
  videoDisplayW: number;
  videoDisplayH: number;
  CONTAINER_W: number;
  CONTAINER_H: number;
  PANEL_H: number;
}

export interface ViewportFramingResult {
  mode: 'single' | 'split';
  x: number;
  top_x: number;
  bottom_x: number;
  isSplitActive: boolean;
  curTranslateX: number;
  curTranslateY: number;
  curTopTranslateX: number;
  curTopTranslateY: number;
  curBottomTranslateX: number;
  curBottomTranslateY: number;
  curScaleTop: number;
  curScaleBottom: number;
}

export interface IndexedSubtitleChunk {
  readonly chunk: SubtitleWord;
  readonly words: readonly SubtitleWord[];
}

export function getSegmentFrameWindow(
  segment: TimelineVideoSegmentBounds,
  fps: number
): SegmentFrameWindow {
  const startFrame = Math.round(segment.start * fps);
  const endFrame = Math.round((segment.start + segment.duration) * fps);
  const durationFrames = Math.max(0, endFrame - startFrame);
  const mediaStartFrame = Math.round((segment.mediaStart ?? 0) * fps);
  return {
    startFrame,
    endFrame,
    durationFrames,
    mediaStartFrame
  };
}

export function coalesceContiguousVideoSegments<
  T extends TimelineVideoSegmentBounds
>(items: readonly T[] | undefined, contiguityEpsilon: number = 0.005): T[] {
  if (!items || items.length === 0) {
    return [];
  }

  const validSorted = items
    .filter(
      item =>
        item &&
        typeof item.start === 'number' &&
        Number.isFinite(item.start) &&
        typeof item.duration === 'number' &&
        Number.isFinite(item.duration) &&
        item.duration > 0
    )
    .slice()
    .sort((a, b) => a.start - b.start);

  const firstValid = validSorted[0];
  if (!firstValid) {
    return [];
  }

  const coalesced: T[] = [{ ...firstValid }];

  for (let i = 1; i < validSorted.length; i++) {
    const prev = coalesced[coalesced.length - 1];
    const next = validSorted[i];
    if (!prev || !next) {
      continue;
    }

    const prevTimelineEnd = prev.start + prev.duration;
    const prevMediaStart = prev.mediaStart ?? 0;
    const prevMediaEnd = prevMediaStart + prev.duration;
    const nextMediaStart = next.mediaStart ?? 0;

    const isTimelineContiguous =
      Math.abs(next.start - prevTimelineEnd) <= contiguityEpsilon;
    const isMediaContiguous =
      Math.abs(nextMediaStart - prevMediaEnd) <= contiguityEpsilon;

    if (isTimelineContiguous && isMediaContiguous) {
      const mergedEnd = Math.max(prevTimelineEnd, next.start + next.duration);
      prev.duration = mergedEnd - prev.start;
    } else {
      coalesced.push({ ...next });
    }
  }

  return coalesced;
}

/**
 * Pre-indexed timeline video segments supporting O(1) cursor and O(log K) binary search lookups.
 */
export class TimelineSegmentIndex<
  T extends TimelineVideoSegmentBounds = TimelineVideoSegmentBounds
> {
  readonly fps: number;
  readonly hasRawItems: boolean;
  readonly coalesced: readonly T[];
  readonly windows: readonly IndexedVideoSegment<T>[];
  readonly needsRetention: boolean;

  private readonly firstCoalescedWindow: SegmentFrameWindow | null;
  private readonly hasOverlappingWindows: boolean;
  private cursor = 0;

  constructor(items: readonly T[] | undefined, fps: number) {
    this.fps = fps > 0 ? fps : 30;
    this.hasRawItems = Boolean(items && items.length > 0);
    const coalesced = coalesceContiguousVideoSegments(items);
    this.coalesced = coalesced;

    const firstCoalesced = coalesced[0];
    this.firstCoalescedWindow = firstCoalesced
      ? getSegmentFrameWindow(firstCoalesced, this.fps)
      : null;

    const windows: IndexedVideoSegment<T>[] = [];
    let overlapping = false;
    let prevEndFrame = -Infinity;

    for (const seg of coalesced) {
      const win = getSegmentFrameWindow(seg, this.fps);
      if (win.durationFrames <= 0) {
        continue;
      }
      if (win.startFrame < prevEndFrame) {
        overlapping = true;
      }
      prevEndFrame = Math.max(prevEndFrame, win.endFrame);
      windows.push({ segment: seg, window: win });
    }

    this.windows = windows;
    this.hasOverlappingWindows = overlapping;
    this.needsRetention = windows.length > 1;
  }

  private windowContainsFrame(idx: number, frame: number): boolean {
    const entry = this.windows[idx];
    if (!entry) return false;
    return frame >= entry.window.startFrame && frame < entry.window.endFrame;
  }

  private isUpperBoundStartMatch(
    idx: number,
    frame: number,
    len: number
  ): boolean {
    const entry = this.windows[idx];
    if (!entry || entry.window.startFrame > frame) return false;
    if (idx === len - 1) return true;
    const next = this.windows[idx + 1];
    return !next || next.window.startFrame > frame;
  }

  isFrameCovered(mainVideoFrame: number): boolean {
    if (mainVideoFrame < 0) {
      return false;
    }
    if (!this.hasRawItems) {
      return true;
    }
    const len = this.windows.length;
    if (len === 0) {
      return false;
    }

    const c = this.cursor;
    if (c >= 0 && c < len) {
      if (this.windowContainsFrame(c, mainVideoFrame)) {
        return true;
      }
      if (c + 1 < len && this.windowContainsFrame(c + 1, mainVideoFrame)) {
        this.cursor = c + 1;
        return true;
      }
      if (c - 1 >= 0 && this.windowContainsFrame(c - 1, mainVideoFrame)) {
        this.cursor = c - 1;
        return true;
      }
    }

    const first = this.windows[0];
    if (!first || mainVideoFrame < first.window.startFrame) {
      this.cursor = 0;
      return false;
    }

    let lo = 0;
    let hi = len - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      const entry = this.windows[mid];
      if (entry && entry.window.startFrame <= mainVideoFrame) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    const candidate = this.windows[lo];
    if (candidate && mainVideoFrame < candidate.window.endFrame) {
      this.cursor = lo;
      return true;
    }

    if (this.hasOverlappingWindows) {
      for (let j = lo - 1; j >= 0; j--) {
        if (this.windowContainsFrame(j, mainVideoFrame)) {
          this.cursor = j;
          return true;
        }
      }
    }

    return false;
  }

  resolveMediaTime(mainVideoFrame: number): number {
    const clampedFrame = Math.max(0, mainVideoFrame);
    if (!this.firstCoalescedWindow) {
      return clampedFrame / this.fps;
    }
    if (clampedFrame < this.firstCoalescedWindow.startFrame) {
      return this.firstCoalescedWindow.mediaStartFrame / this.fps;
    }

    const len = this.windows.length;
    if (len === 0) {
      return clampedFrame / this.fps;
    }

    if (this.hasOverlappingWindows) {
      let lastPriorWin: SegmentFrameWindow | null = null;
      for (const entry of this.windows) {
        const win = entry.window;
        if (clampedFrame >= win.startFrame && clampedFrame < win.endFrame) {
          return (
            (win.mediaStartFrame + (clampedFrame - win.startFrame)) / this.fps
          );
        }
        if (clampedFrame >= win.endFrame) {
          lastPriorWin = win;
        }
      }
      if (lastPriorWin) {
        return (
          (lastPriorWin.mediaStartFrame + lastPriorWin.durationFrames) /
          this.fps
        );
      }
      return clampedFrame / this.fps;
    }

    const first = this.windows[0];
    if (!first || clampedFrame < first.window.startFrame) {
      return clampedFrame / this.fps;
    }

    const c = this.cursor;
    let idx = -1;
    if (c >= 0 && c < len) {
      if (this.isUpperBoundStartMatch(c, clampedFrame, len)) {
        idx = c;
      } else if (
        c + 1 < len &&
        this.isUpperBoundStartMatch(c + 1, clampedFrame, len)
      ) {
        idx = c + 1;
      } else if (
        c - 1 >= 0 &&
        this.isUpperBoundStartMatch(c - 1, clampedFrame, len)
      ) {
        idx = c - 1;
      }
    }

    if (idx === -1) {
      let lo = 0;
      let hi = len - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >>> 1;
        const entry = this.windows[mid];
        if (entry && entry.window.startFrame <= clampedFrame) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      idx = lo;
    }

    this.cursor = idx;
    const matched = this.windows[idx];
    if (!matched) {
      return clampedFrame / this.fps;
    }
    const win = matched.window;
    if (clampedFrame < win.endFrame) {
      return (win.mediaStartFrame + (clampedFrame - win.startFrame)) / this.fps;
    }
    return (win.mediaStartFrame + win.durationFrames) / this.fps;
  }
}

export function createTimelineSegmentIndex<
  T extends TimelineVideoSegmentBounds
>(items: readonly T[] | undefined, fps: number): TimelineSegmentIndex<T> {
  return new TimelineSegmentIndex(items, fps);
}

const segmentIndexCache = new WeakMap<
  readonly TimelineVideoSegmentBounds[],
  { length: number; byFps: Map<number, TimelineSegmentIndex> }
>();
const emptySegmentIndexByFps = new Map<number, TimelineSegmentIndex>();

export function getOrCreateTimelineSegmentIndex<
  T extends TimelineVideoSegmentBounds
>(items: readonly T[] | undefined, fps: number): TimelineSegmentIndex<T> {
  const safeFps = fps > 0 ? fps : 30;
  if (!items || items.length === 0) {
    const cachedEmpty = emptySegmentIndexByFps.get(safeFps);
    if (cachedEmpty) {
      return cachedEmpty as TimelineSegmentIndex<T>;
    }
    const created = new TimelineSegmentIndex<TimelineVideoSegmentBounds>(
      [],
      safeFps
    );
    emptySegmentIndexByFps.set(safeFps, created);
    return created as TimelineSegmentIndex<T>;
  }

  let entry = segmentIndexCache.get(items);
  if (!entry || entry.length !== items.length) {
    entry = { length: items.length, byFps: new Map() };
    segmentIndexCache.set(items, entry);
  }

  const existing = entry.byFps.get(safeFps);
  if (existing) {
    return existing as TimelineSegmentIndex<T>;
  }

  const created = new TimelineSegmentIndex<T>(items, safeFps);
  entry.byFps.set(safeFps, created as unknown as TimelineSegmentIndex);
  return created;
}

/**
 * Sorted crop-map index with O(1) playback cursor and O(log N) binary search.
 */
export class CropMapIndex<T extends CropMapEntry = CropMapEntry> {
  readonly length: number;

  private readonly entries: readonly T[];
  private cursor = 0;
  private cachedSplitWindows: readonly CropSplitWindow[] | null = null;

  constructor(cropMap: readonly T[] | undefined) {
    if (!cropMap || cropMap.length === 0) {
      this.entries = [];
      this.length = 0;
      return;
    }

    const copy: T[] = [];
    let sorted = true;
    let prevTime = -Infinity;

    for (let i = 0; i < cropMap.length; i++) {
      const entry = cropMap[i];
      if (!entry) continue;
      copy.push(entry);
      if (entry.time < prevTime) {
        sorted = false;
      }
      prevTime = entry.time;
    }

    if (!sorted) {
      copy.sort((a, b) => a.time - b.time);
    }

    this.entries = copy;
    this.length = copy.length;
  }

  private isUpperBoundHit(idx: number, limit: number, n: number): boolean {
    const curr = this.entries[idx];
    if (!curr || curr.time > limit) return false;
    if (idx === n - 1) return true;
    const next = this.entries[idx + 1];
    return !next || next.time > limit;
  }

  findPrevIndex(targetTime: number): number {
    const n = this.length;
    if (n === 0) {
      return -1;
    }

    const limit = targetTime + CROP_TIME_EPSILON;
    const first = this.entries[0];
    if (!first || first.time > limit) {
      this.cursor = 0;
      return 0;
    }

    const c = this.cursor;
    if (c >= 0 && c < n) {
      if (this.isUpperBoundHit(c, limit, n)) {
        return c;
      }
      if (c + 1 < n && this.isUpperBoundHit(c + 1, limit, n)) {
        this.cursor = c + 1;
        return c + 1;
      }
      if (c - 1 >= 0 && this.isUpperBoundHit(c - 1, limit, n)) {
        this.cursor = c - 1;
        return c - 1;
      }
    }

    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      const entry = this.entries[mid];
      if (entry && entry.time <= limit) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }

    this.cursor = lo;
    return lo;
  }

  getAtIndex(idx: number): T | undefined {
    return this.entries[idx];
  }

  getEntryAt(mediaTime: number): T | null {
    const idx = this.findPrevIndex(mediaTime);
    if (idx < 0) {
      return null;
    }
    return this.entries[idx] ?? null;
  }

  isSplitAt(mediaTime: number): boolean {
    return this.getEntryAt(mediaTime)?.mode === 'split';
  }

  getSplitWindows(): readonly CropSplitWindow[] {
    if (this.cachedSplitWindows !== null) {
      return this.cachedSplitWindows;
    }

    const splitWindows: CropSplitWindow[] = [];
    let i = 0;
    while (i < this.length) {
      const entry = this.entries[i];
      if (entry && entry.mode === 'split') {
        const winStart = entry.time;
        let j = i + 1;
        while (j < this.length && this.entries[j]?.mode === 'split') {
          j++;
        }
        const nextEntry = j < this.length ? this.entries[j] : undefined;
        const winEnd = nextEntry ? nextEntry.time : Number.POSITIVE_INFINITY;
        splitWindows.push({ start: winStart, end: winEnd });
        i = j;
      } else {
        i++;
      }
    }

    this.cachedSplitWindows = splitWindows;
    return splitWindows;
  }
}

export function createCropMapIndex<T extends CropMapEntry>(
  cropMap: readonly T[] | undefined
): CropMapIndex<T> {
  return new CropMapIndex(cropMap);
}

const cropMapIndexCache = new WeakMap<
  object,
  { length: number; index: CropMapIndex<CropMapEntry> }
>();
const EMPTY_CROP_MAP_INDEX = new CropMapIndex<CropMapEntry>([]);

export function getOrCreateCropMapIndex<T extends CropMapEntry>(
  cropMap: readonly T[] | undefined
): CropMapIndex<T> {
  if (!cropMap || cropMap.length === 0) {
    return EMPTY_CROP_MAP_INDEX as CropMapIndex<T>;
  }

  const cached = cropMapIndexCache.get(cropMap);
  if (cached && cached.length === cropMap.length) {
    return cached.index as CropMapIndex<T>;
  }

  const created = new CropMapIndex<T>(cropMap);
  cropMapIndexCache.set(cropMap, {
    length: cropMap.length,
    index: created as unknown as CropMapIndex<CropMapEntry>
  });
  return created;
}

interface FramingPrecomputedConstants {
  readonly rawSourceW: number;
  readonly isLandscape: boolean;
  readonly videoDisplayW: number;
  readonly CONTAINER_W: number;
  readonly fallbackX: number;
  readonly manualTop: number | undefined;
  readonly manualBottom: number | undefined;
  readonly cutThreshold: number;
  readonly maxOffset: number;
  readonly singleScale: number;
  readonly curTranslateY: number;
  readonly curScaleTop: number;
  readonly topDisplayW: number;
  readonly topMaxOffset: number;
  readonly topNudgeX: number;
  readonly curTopTranslateY: number;
  readonly curScaleBottom: number;
  readonly bottomDisplayW: number;
  readonly bottomMaxOffset: number;
  readonly bottomNudgeX: number;
  readonly curBottomTranslateY: number;
}

function buildFramingConstants(
  params: ViewportFramingParams
): FramingPrecomputedConstants {
  const {
    cropX,
    cropPercentXTop,
    cropPercentXBottom,
    splitZoomTop = 1.0,
    splitZoomBottom = 1.0,
    splitOffsetXTop = 0,
    splitOffsetYTop = 0,
    splitOffsetXBottom = 0,
    splitOffsetYBottom = 0,
    rawSourceW,
    isLandscape,
    videoDisplayW,
    videoDisplayH,
    CONTAINER_W,
    CONTAINER_H,
    PANEL_H
  } = params;

  const fallbackX = cropX ?? rawSourceW / 2;
  const manualTop =
    cropPercentXTop !== undefined
      ? (cropPercentXTop / 100) * rawSourceW
      : undefined;
  const manualBottom =
    cropPercentXBottom !== undefined
      ? (cropPercentXBottom / 100) * rawSourceW
      : undefined;

  const maxOffset = Math.max(0, videoDisplayW - CONTAINER_W);
  const singleScale = videoDisplayW / rawSourceW;
  const curTranslateY = isLandscape ? (CONTAINER_H - videoDisplayH) / 2 : 0;

  const effectiveZoomTop = Math.max(1.0, Math.min(2.5, splitZoomTop || 1.0));
  const curScaleTop = 0.5 * effectiveZoomTop;
  const topDisplayW = videoDisplayW * curScaleTop;
  const topDisplayH = videoDisplayH * curScaleTop;
  const topMaxOffset = Math.max(0, topDisplayW - CONTAINER_W);
  const topExtraH = Math.max(0, topDisplayH - PANEL_H);
  const topNudgeX = ((splitOffsetXTop || 0) / 100) * (CONTAINER_W * 0.35);
  const baseTopTranslateY = -topExtraH * 0.25;
  const topNudgeY = ((splitOffsetYTop || 0) / 100) * (topExtraH * 0.5);
  const curTopTranslateY = Math.max(
    -topExtraH,
    Math.min(0, baseTopTranslateY + topNudgeY)
  );

  const effectiveZoomBottom = Math.max(
    1.0,
    Math.min(2.5, splitZoomBottom || 1.0)
  );
  const curScaleBottom = 0.5 * effectiveZoomBottom;
  const bottomDisplayW = videoDisplayW * curScaleBottom;
  const bottomDisplayH = videoDisplayH * curScaleBottom;
  const bottomMaxOffset = Math.max(0, bottomDisplayW - CONTAINER_W);
  const bottomExtraH = Math.max(0, bottomDisplayH - PANEL_H);
  const bottomNudgeX = ((splitOffsetXBottom || 0) / 100) * (CONTAINER_W * 0.35);
  const baseBottomTranslateY = -bottomExtraH * 0.25;
  const bottomNudgeY = ((splitOffsetYBottom || 0) / 100) * (bottomExtraH * 0.5);
  const curBottomTranslateY = Math.max(
    -bottomExtraH,
    Math.min(0, baseBottomTranslateY + bottomNudgeY)
  );

  return {
    rawSourceW,
    isLandscape,
    videoDisplayW,
    CONTAINER_W,
    fallbackX,
    manualTop,
    manualBottom,
    cutThreshold: rawSourceW * 0.15,
    maxOffset,
    singleScale,
    curTranslateY,
    curScaleTop,
    topDisplayW,
    topMaxOffset,
    topNudgeX,
    curTopTranslateY,
    curScaleBottom,
    bottomDisplayW,
    bottomMaxOffset,
    bottomNudgeX,
    curBottomTranslateY
  };
}

function finalizeFramingResult(
  mode: 'single' | 'split',
  x: number,
  top_x: number,
  bottom_x: number,
  c: FramingPrecomputedConstants
): ViewportFramingResult {
  const isSplitActive = !c.isLandscape && mode === 'split';

  const targetTranslateX = c.isLandscape
    ? 0
    : c.CONTAINER_W / 2 - x * c.singleScale;
  const curTranslateX = c.isLandscape
    ? 0
    : Math.max(-c.maxOffset, Math.min(0, targetTranslateX));

  const targetTopTranslateX =
    c.CONTAINER_W / 2 - (top_x / c.rawSourceW) * c.topDisplayW + c.topNudgeX;
  const curTopTranslateX = Math.max(
    -c.topMaxOffset,
    Math.min(0, targetTopTranslateX)
  );

  const targetBottomTranslateX =
    c.CONTAINER_W / 2 -
    (bottom_x / c.rawSourceW) * c.bottomDisplayW +
    c.bottomNudgeX;
  const curBottomTranslateX = Math.max(
    -c.bottomMaxOffset,
    Math.min(0, targetBottomTranslateX)
  );

  return {
    mode,
    x,
    top_x,
    bottom_x,
    isSplitActive,
    curTranslateX,
    curTranslateY: c.curTranslateY,
    curTopTranslateX,
    curTopTranslateY: c.curTopTranslateY,
    curBottomTranslateX,
    curBottomTranslateY: c.curBottomTranslateY,
    curScaleTop: c.curScaleTop,
    curScaleBottom: c.curScaleBottom
  };
}

function resolveFramingWithIndex(
  targetTime: number,
  cropIndex: CropMapIndex,
  c: FramingPrecomputedConstants
): ViewportFramingResult {
  let mode: 'single' | 'split' = 'single';
  let x = c.fallbackX;
  let top_x = c.manualTop ?? c.fallbackX;
  let bottom_x = c.manualBottom ?? c.fallbackX;

  if (cropIndex.length > 0) {
    const prevIdx = cropIndex.findPrevIndex(targetTime);
    const prevEntry = prevIdx >= 0 ? cropIndex.getAtIndex(prevIdx) : undefined;
    const nextEntry =
      prevIdx >= 0 && prevIdx < cropIndex.length - 1
        ? cropIndex.getAtIndex(prevIdx + 1)
        : undefined;

    if (prevEntry) {
      mode = prevEntry.mode || 'single';
      x = prevEntry.x;
      top_x = prevEntry.top_x ?? prevEntry.x;
      bottom_x = prevEntry.bottom_x ?? prevEntry.x;

      if (nextEntry && prevEntry.time !== nextEntry.time) {
        if ((prevEntry.mode || 'single') === (nextEntry.mode || 'single')) {
          const duration = nextEntry.time - prevEntry.time;
          const progress = Math.max(
            0,
            Math.min(1, (targetTime - prevEntry.time) / duration)
          );
          const smoothT = progress * progress * (3 - 2 * progress);

          if (mode === 'split') {
            const prevTop = prevEntry.top_x ?? prevEntry.x;
            const nextTop = nextEntry.top_x ?? nextEntry.x;
            const prevBot = prevEntry.bottom_x ?? prevEntry.x;
            const nextBot = nextEntry.bottom_x ?? nextEntry.x;

            top_x =
              Math.abs(nextTop - prevTop) > c.cutThreshold
                ? prevTop
                : prevTop + (nextTop - prevTop) * smoothT;
            bottom_x =
              Math.abs(nextBot - prevBot) > c.cutThreshold
                ? prevBot
                : prevBot + (nextBot - prevBot) * smoothT;
          } else {
            const delta = Math.abs(nextEntry.x - prevEntry.x);
            x =
              delta > c.cutThreshold
                ? prevEntry.x
                : prevEntry.x + (nextEntry.x - prevEntry.x) * smoothT;
            top_x = x;
            bottom_x = x;
          }
        }
      }
    }

    if (c.manualTop !== undefined) top_x = c.manualTop;
    if (c.manualBottom !== undefined) bottom_x = c.manualBottom;
  }

  return finalizeFramingResult(mode, x, top_x, bottom_x, c);
}

/**
 * Pre-indexed framing calculator that precomputes static viewport math once per edit
 * and resolves per-frame framing with O(1) cursor / O(log N) cropMap lookup.
 */
export class TimelineFramingIndex {
  readonly hasCropMap: boolean;

  private readonly cropIndex: CropMapIndex;
  private readonly constants: FramingPrecomputedConstants;
  private readonly staticResult: ViewportFramingResult;

  constructor(params: ViewportFramingParams) {
    this.cropIndex = params.cropMapIndex ?? createCropMapIndex(params.cropMap);
    this.hasCropMap = this.cropIndex.length > 0;
    this.constants = buildFramingConstants(params);
    this.staticResult = finalizeFramingResult(
      'single',
      this.constants.fallbackX,
      this.constants.manualTop ?? this.constants.fallbackX,
      this.constants.manualBottom ?? this.constants.fallbackX,
      this.constants
    );
  }

  isSplitAt(targetTime: number): boolean {
    if (this.constants.isLandscape || !this.hasCropMap) {
      return false;
    }
    return this.cropIndex.isSplitAt(targetTime);
  }

  computeFraming(targetTime: number): ViewportFramingResult {
    if (!this.hasCropMap) {
      return this.staticResult;
    }
    return resolveFramingWithIndex(targetTime, this.cropIndex, this.constants);
  }
}

export function createTimelineFramingIndex(
  params: ViewportFramingParams
): TimelineFramingIndex {
  return new TimelineFramingIndex(params);
}

export function computeViewportFraming(
  targetTime: number,
  params: ViewportFramingParams
): ViewportFramingResult {
  const constants = buildFramingConstants(params);
  const cropIndex =
    params.cropMapIndex ?? getOrCreateCropMapIndex(params.cropMap);
  return resolveFramingWithIndex(targetTime, cropIndex, constants);
}

function buildFallbackSplitWords(chunk: SubtitleWord): SubtitleWord[] {
  const splitWords = chunk.word.split(/\s+/);
  const chunkDuration = chunk.end - chunk.start;
  const wordDur = chunkDuration / splitWords.length;
  return splitWords.map((w, i) => ({
    word: w,
    start: chunk.start + i * wordDur,
    end: chunk.start + (i + 1) * wordDur
  }));
}

/**
 * Pre-indexed subtitle chunk and word-timing store with O(1) cursor and O(log N) lookup.
 */
export class SubtitleChunkIndex {
  readonly length: number;
  readonly firstChunk: SubtitleWord | undefined;

  private readonly entries: readonly IndexedSubtitleChunk[];
  private readonly prefixMaxEnd: readonly number[];
  private readonly isSortedByStart: boolean;
  private cursor = 0;

  constructor(
    chunks: readonly SubtitleWord[] | undefined,
    wordTimings?: readonly SubtitleWord[]
  ) {
    if (!chunks || chunks.length === 0) {
      this.entries = [];
      this.prefixMaxEnd = [];
      this.length = 0;
      this.firstChunk = undefined;
      this.isSortedByStart = true;
      return;
    }

    this.length = chunks.length;
    this.firstChunk = chunks[0];

    let chunksSorted = true;
    let prevChunkStart = -Infinity;
    const prefixMaxEnd = new Array<number>(chunks.length);
    let maxEnd = -Infinity;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      if (chunk.start < prevChunkStart) {
        chunksSorted = false;
      }
      prevChunkStart = chunk.start;
      maxEnd = Math.max(maxEnd, chunk.end);
      prefixMaxEnd[i] = maxEnd;
    }

    this.isSortedByStart = chunksSorted;
    this.prefixMaxEnd = prefixMaxEnd;

    let wordTimingsSorted = true;
    if (wordTimings && wordTimings.length > 0) {
      let prevWordStart = -Infinity;
      for (let i = 0; i < wordTimings.length; i++) {
        const w = wordTimings[i]!;
        if (w.start < prevWordStart || w.start > w.end) {
          wordTimingsSorted = false;
          break;
        }
        prevWordStart = w.start;
      }
    }

    const entries = new Array<IndexedSubtitleChunk>(chunks.length);
    if (
      chunksSorted &&
      wordTimings &&
      wordTimings.length > 0 &&
      wordTimingsSorted
    ) {
      let wStart = 0;
      const wLen = wordTimings.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const minStart = chunk.start - WORD_TIMING_EPSILON;
        const maxBound = chunk.end + WORD_TIMING_EPSILON;

        while (wStart < wLen && wordTimings[wStart]!.start < minStart) {
          wStart++;
        }

        const matched: SubtitleWord[] = [];
        for (let j = wStart; j < wLen; j++) {
          const w = wordTimings[j]!;
          if (w.start > maxBound) {
            break;
          }
          if (w.end <= maxBound) {
            matched.push(w);
          }
        }

        entries[i] = {
          chunk,
          words: matched.length > 0 ? matched : buildFallbackSplitWords(chunk)
        };
      }
    } else {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        const matched =
          wordTimings && wordTimings.length > 0
            ? wordTimings.filter(
                w =>
                  w.start >= chunk.start - WORD_TIMING_EPSILON &&
                  w.end <= chunk.end + WORD_TIMING_EPSILON
              )
            : [];
        entries[i] = {
          chunk,
          words: matched.length > 0 ? matched : buildFallbackSplitWords(chunk)
        };
      }
    }

    this.entries = entries;
  }

  private isFirstActiveMatch(idx: number, currentTime: number): boolean {
    const entry = this.entries[idx];
    if (!entry) return false;
    if (currentTime < entry.chunk.start || currentTime > entry.chunk.end) {
      return false;
    }
    if (idx === 0) return true;
    const prevMaxEnd = this.prefixMaxEnd[idx - 1];
    return prevMaxEnd !== undefined && prevMaxEnd < currentTime;
  }

  findActiveChunk(currentTime: number): IndexedSubtitleChunk | null {
    const n = this.entries.length;
    if (n === 0) {
      return null;
    }

    if (!this.isSortedByStart) {
      for (let i = 0; i < n; i++) {
        const entry = this.entries[i]!;
        if (
          currentTime >= entry.chunk.start &&
          currentTime <= entry.chunk.end
        ) {
          this.cursor = i;
          return entry;
        }
      }
      return null;
    }

    const c = this.cursor;
    if (c >= 0 && c < n) {
      if (this.isFirstActiveMatch(c, currentTime)) {
        return this.entries[c] ?? null;
      }
      if (c + 1 < n && this.isFirstActiveMatch(c + 1, currentTime)) {
        this.cursor = c + 1;
        return this.entries[c + 1] ?? null;
      }
      if (c - 1 >= 0 && this.isFirstActiveMatch(c - 1, currentTime)) {
        this.cursor = c - 1;
        return this.entries[c - 1] ?? null;
      }
    }

    const lastMaxEnd = this.prefixMaxEnd[n - 1];
    if (lastMaxEnd === undefined || lastMaxEnd < currentTime) {
      return null;
    }

    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      const midMax = this.prefixMaxEnd[mid];
      if (midMax !== undefined && midMax >= currentTime) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    const candidate = this.entries[lo];
    if (!candidate) {
      return null;
    }
    if (
      currentTime >= candidate.chunk.start &&
      currentTime <= candidate.chunk.end
    ) {
      this.cursor = lo;
      return candidate;
    }
    return null;
  }
}

export function createSubtitleChunkIndex(
  chunks: readonly SubtitleWord[] | undefined,
  wordTimings?: readonly SubtitleWord[]
): SubtitleChunkIndex {
  return new SubtitleChunkIndex(chunks, wordTimings);
}
