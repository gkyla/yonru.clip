import type { Hook, ReadyClip } from '../types/clipper';

export interface HookClipMatcherOptions {
  readyClips?: ReadyClip[] | null;
  folderName?: string | null;
  safetyBuffer?: number;
  jobStatus?: string | null;
  activeHook?: Hook | null;
  clipId?: string | null;
}

export interface ClipHookLocation {
  hookIndex: number;
  tab: 'generated' | 'saved';
}

function findBestMatchingHookIndex(
  list: Hook[] | null | undefined,
  targetStart: number,
  targetEnd: number
): { index: number; diff: number } {
  if (!Array.isArray(list) || list.length === 0) {
    return { index: -1, diff: 5.0 };
  }

  let bestIndex = -1;
  let minDiff = 5.0;
  list.forEach((hook, idx) => {
    const hStart =
      typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start;
    const hEnd = typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end;
    if (!Number.isFinite(hStart) || !Number.isFinite(hEnd)) return;
    const diff = Math.abs(hStart - targetStart) + Math.abs(hEnd - targetEnd);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = idx;
    }
  });
  return { index: bestIndex, diff: minDiff };
}

/**
 * Resolves the matching hook index and sidebar tab ('generated' or 'saved')
 * for a given clip_id based on timestamp proximity.
 */
export function resolveClipHookLocation(
  clipId: string | null | undefined,
  hooks: Hook[] | null | undefined,
  savedHooks: Hook[] | null | undefined
): ClipHookLocation {
  if (!clipId) {
    return { hookIndex: 0, tab: 'generated' };
  }

  const parts = clipId.split('_');
  const part0 = parts[0];
  const part1 = parts[1];
  if (part0 === undefined || part1 === undefined) {
    return { hookIndex: 0, tab: 'generated' };
  }

  const clipStart = parseFloat(part0);
  const clipEnd = parseFloat(part1);
  if (Number.isNaN(clipStart) || Number.isNaN(clipEnd)) {
    return { hookIndex: 0, tab: 'generated' };
  }

  const savedMatch = findBestMatchingHookIndex(savedHooks, clipStart, clipEnd);
  const genMatch = findBestMatchingHookIndex(hooks, clipStart, clipEnd);

  if (
    savedMatch.index >= 0 &&
    (genMatch.index < 0 || savedMatch.diff <= genMatch.diff)
  ) {
    return { hookIndex: savedMatch.index, tab: 'saved' };
  }

  if (genMatch.index >= 0) {
    return { hookIndex: genMatch.index, tab: 'generated' };
  }

  return { hookIndex: 0, tab: 'generated' };
}

/**
 * Finds the matching ReadyClip for a given Hook based on:
 * 1. Timestamp boundaries matching custom safetyBuffer (tolerance < 1.5s)
 * 2. Timestamp boundaries matching default 2.0s buffer (tolerance < 1.5s)
 * 3. Timestamp boundaries matching zero buffer (tolerance < 1.5s)
 * 4. Overlap ratio >= 80% of hook duration
 * 5. Sanitized theme slug comparison
 */
export function findMatchingClip(
  hook: Hook | null | undefined,
  readyClips?: ReadyClip[] | null,
  folderName?: string | null,
  safetyBuffer: number = 2.0
): ReadyClip | undefined {
  if (!readyClips?.length || !folderName || !hook) {
    return undefined;
  }

  const hStart =
    typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start;
  const hEnd = typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end;
  if (isNaN(hStart) || isNaN(hEnd)) {
    return undefined;
  }

  const hookDuration = hEnd - hStart;

  return readyClips.find(c => {
    if (c.folder_name !== folderName) return false;
    const parts = c.clip_id.split('_');
    const part0 = parts[0];
    const part1 = parts[1];
    if (part0 === undefined || part1 === undefined) return false;
    const cStart = parseFloat(part0);
    const cEnd = parseFloat(part1);
    if (isNaN(cStart) || isNaN(cEnd)) return false;

    // 1. Custom safety buffer interval
    const expectedStart = Math.max(0, Math.floor(hStart - safetyBuffer));
    const expectedEnd = Math.ceil(hEnd);
    if (
      Math.abs(cStart - expectedStart) < 1.5 &&
      Math.abs(cEnd - expectedEnd) < 1.5
    ) {
      return true;
    }

    // 2. Default 2.0s safety buffer interval
    const expectedStartDefault = Math.max(0, Math.floor(hStart - 2.0));
    if (
      Math.abs(cStart - expectedStartDefault) < 1.5 &&
      Math.abs(cEnd - expectedEnd) < 1.5
    ) {
      return true;
    }

    // 3. Zero safety buffer interval
    const expectedStartNone = Math.max(0, Math.floor(hStart));
    if (
      Math.abs(cStart - expectedStartNone) < 1.5 &&
      Math.abs(cEnd - expectedEnd) < 1.5
    ) {
      return true;
    }

    // 4. Overlap ratio >= 80%
    if (hookDuration > 0) {
      const overlapStart = Math.max(cStart, hStart);
      const overlapEnd = Math.min(cEnd, hEnd);
      const overlap = overlapEnd - overlapStart;
      if (overlap > 0 && overlap / hookDuration >= 0.8) {
        return true;
      }
    }

    // 5. Theme slug matching
    if (hook.theme && parts.length >= 3) {
      const cleanHookTheme = hook.theme
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const clipThemeStr = parts.slice(2).join(' ').replace(/_/g, ' ');
      const cleanClipTheme = clipThemeStr
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        cleanHookTheme &&
        cleanClipTheme &&
        (cleanClipTheme.includes(cleanHookTheme) ||
          cleanHookTheme.includes(cleanClipTheme))
      ) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Determines if a Hook is considered already rendered into a ReadyClip.
 * Returns false if background extraction is currently running for this hook or matching clip.
 */
export function isHookRendered(
  hook: Hook | null | undefined,
  readyClips?: ReadyClip[] | null,
  folderName?: string | null,
  jobStatus?: string | null,
  activeHook?: Hook | null,
  clipId?: string | null,
  safetyBuffer: number = 2.0
): boolean {
  if (!hook) return false;

  const status = jobStatus || '';
  if (['cutting', 'transcribing', 'queued'].includes(status)) {
    if (activeHook) {
      const hStart =
        typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start;
      const hEnd =
        typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end;
      const aStart =
        typeof activeHook.start === 'string'
          ? parseFloat(activeHook.start)
          : activeHook.start;
      const aEnd =
        typeof activeHook.end === 'string'
          ? parseFloat(activeHook.end)
          : activeHook.end;
      if (Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1) {
        return false;
      }
    }
  }

  const matchingClip = findMatchingClip(
    hook,
    readyClips,
    folderName,
    safetyBuffer
  );
  if (!matchingClip) return false;

  if (
    ['cutting', 'transcribing', 'queued'].includes(status) &&
    clipId === matchingClip.clip_id
  ) {
    return false;
  }

  return true;
}

/**
 * HookClipMatcher encapsulates hook-to-clip matching heuristics
 * and rendered state evaluation.
 */
export class HookClipMatcher {
  private options: HookClipMatcherOptions;

  constructor(options: HookClipMatcherOptions = {}) {
    this.options = options;
  }

  public findMatchingClip(
    hook: Hook | null | undefined,
    overrideBuffer?: number
  ): ReadyClip | undefined {
    return findMatchingClip(
      hook,
      this.options.readyClips,
      this.options.folderName,
      overrideBuffer ?? this.options.safetyBuffer ?? 2.0
    );
  }

  public isHookRendered(
    hook: Hook | null | undefined,
    overrideBuffer?: number
  ): boolean {
    return isHookRendered(
      hook,
      this.options.readyClips,
      this.options.folderName,
      this.options.jobStatus,
      this.options.activeHook,
      this.options.clipId,
      overrideBuffer ?? this.options.safetyBuffer ?? 2.0
    );
  }

  public static findMatchingClip = findMatchingClip;
  public static isHookRendered = isHookRendered;
  public static resolveClipHookLocation = resolveClipHookLocation;
}
