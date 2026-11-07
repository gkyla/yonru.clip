import type {
  CropMapPoint,
  TimelineTrack,
  TimelineTrackItem,
  TranscriptSegment
} from '../types/clipper';

export type TimelineItem = TimelineTrackItem;

export interface RulerTick {
  pos: number;
  major: boolean;
  label: string | null;
}

export function resolveCoverOffsetSec(
  coverEnabled?: boolean,
  coverDuration?: number
): number {
  return coverEnabled ? Math.max(0, Number(coverDuration) || 0) : 0;
}

export function isAudioTrack(
  track:
    TimelineTrack | { id?: string; type?: string } | string | undefined | null
): boolean {
  if (!track) return false;
  if (typeof track === 'string') return track === 'audio';
  return track.id === 'audio' || track.type === 'audio';
}

export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.aac',
  '.m4a',
  '.flac'
] as const;

export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
  'audio/flac',
  'audio/x-flac'
] as const;

export const AUDIO_INPUT_ACCEPT = [
  ...SUPPORTED_AUDIO_EXTENSIONS,
  ...SUPPORTED_AUDIO_MIME_TYPES
].join(',');

export function isValidAudioFile(
  file?: {
    name?: string;
    type?: string;
  } | null
): boolean {
  if (!file || !file.name) return false;

  const fileName = file.name.trim();
  const lowerName = fileName.toLowerCase();

  // Explicitly reject video container formats (especially MP4)
  if (
    lowerName.endsWith('.mp4') ||
    lowerName.endsWith('.mov') ||
    lowerName.endsWith('.webm') ||
    lowerName.endsWith('.mkv') ||
    lowerName.endsWith('.avi')
  ) {
    return false;
  }

  // Reject any video/ MIME type
  if (file.type && file.type.toLowerCase().startsWith('video/')) {
    return false;
  }

  // Check if extension is one of the supported audio extensions
  const hasSupportedExtension = SUPPORTED_AUDIO_EXTENSIONS.some(ext =>
    lowerName.endsWith(ext)
  );

  if (!hasSupportedExtension) {
    return false;
  }

  // If MIME type is present and non-empty, ensure it's not a disallowed container
  if (file.type) {
    const lowerType = file.type.toLowerCase();
    // In macOS, .mp4 files can report 'audio/mp4'. Reject audio/mp4 container.
    if (lowerType === 'audio/mp4') {
      return false;
    }
  }

  return true;
}

export function resolveAudioFileDuration(
  source: File | Blob | string,
  timeoutMs = typeof process !== 'undefined' &&
  (process.env?.VITEST || process.env?.NODE_ENV === 'test')
    ? 20
    : 1500
): Promise<number> {
  return new Promise(resolve => {
    // If not in a browser environment, return default 5.0
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(5.0);
      return;
    }

    let urlToRevoke: string | null = null;
    let resolved = false;

    const cleanup = () => {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
        urlToRevoke = null;
      }
    };

    const safeResolve = (duration: number) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        const validDuration =
          Number.isFinite(duration) && duration > 0
            ? Math.round(duration * 10) / 10
            : 5.0;
        resolve(validDuration);
      }
    };

    const timer = setTimeout(() => {
      safeResolve(5.0);
    }, timeoutMs);

    try {
      let src = '';
      if (typeof source === 'string') {
        src = source;
      } else if (source instanceof Blob) {
        urlToRevoke = URL.createObjectURL(source);
        src = urlToRevoke;
      } else {
        safeResolve(5.0);
        return;
      }

      const audio = new Audio();
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        clearTimeout(timer);
        safeResolve(audio.duration);
      };

      audio.onerror = () => {
        clearTimeout(timer);
        safeResolve(5.0);
      };

      audio.src = src;
    } catch {
      clearTimeout(timer);
      safeResolve(5.0);
    }
  });
}

export function getItemLeftPx(
  track:
    TimelineTrack | { id?: string; type?: string } | string | undefined | null,
  startSec: number,
  pxPerSec: number,
  coverActive: boolean,
  thumbOffsetPx: number
): number {
  const base = (Number(startSec) || 0) * pxPerSec;
  return isAudioTrack(track) || !coverActive ? base : base + thumbOffsetPx;
}

export function toGlobalTimelineStart(
  relativeStart: number,
  coverEnabled?: boolean,
  coverDuration?: number
): number {
  const start = Number(relativeStart) || 0;
  const offset = resolveCoverOffsetSec(coverEnabled, coverDuration);
  return Math.round((start + offset) * 1000) / 1000;
}

export function fromGlobalTimelineStart(
  globalStart: number,
  coverEnabled?: boolean,
  coverDuration?: number
): number {
  const globalSec = Number(globalStart) || 0;
  const offset = resolveCoverOffsetSec(coverEnabled, coverDuration);
  return Math.max(0, Math.round((globalSec - offset) * 1000) / 1000);
}

export function isTimelineItemActiveAtTime(
  item: { start: number; duration: number },
  currentTime: number,
  coverEnabled?: boolean,
  coverDuration?: number
): boolean {
  const offset = resolveCoverOffsetSec(coverEnabled, coverDuration);
  if (offset > 0 && currentTime < offset) {
    return false;
  }
  const relTime = currentTime - offset;
  const start = Number(item.start) || 0;
  const duration = Number(item.duration) || 0;
  if (duration <= 0) return false;
  return relTime >= start && relTime < start + duration;
}

export function calculateTimelineDuration(
  tracks: TimelineTrack[],
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  videoDuration: number
): number {
  let maxGlobal = 0;
  let hasItems = false;
  const offset = thumbnailEnabled ? thumbnailDuration : 0;

  tracks.forEach(track => {
    // Audio layers MUST NEVER extend the timeline duration past the video clip
    if (isAudioTrack(track)) return;

    if (track.items && track.items.length > 0) hasItems = true;
    track.items.forEach(item => {
      const end = item.start + item.duration + offset;
      maxGlobal = Math.max(maxGlobal, end);
    });
  });

  if (hasItems) {
    return maxGlobal > 0 ? maxGlobal : 1 + offset;
  }
  return (videoDuration > 0 ? videoDuration : 60) + offset;
}

export function calculateVideoTime(
  currentTime: number,
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  tracks: TimelineTrack[]
): number {
  const thumbSec = thumbnailEnabled ? thumbnailDuration : 0;
  const t = Math.max(0, currentTime - thumbSec);
  const videoTrack = tracks.find(tr => tr.id === 'video');
  if (!videoTrack || !videoTrack.items || videoTrack.items.length === 0)
    return t;

  const activeItem =
    videoTrack.items.find(i => t >= i.start && t <= i.start + i.duration) ||
    videoTrack.items[videoTrack.items.length - 1];

  if (activeItem) {
    const mediaStart =
      activeItem.mediaStart !== undefined
        ? activeItem.mediaStart
        : activeItem.start;
    return mediaStart + (t - activeItem.start);
  }

  return t;
}

export function getCropEntryAtMediaTime(
  cropMap: ReadonlyArray<CropMapPoint> | undefined,
  mediaTime: number
): CropMapPoint | null {
  if (!cropMap || cropMap.length === 0) {
    return null;
  }
  const timeEpsilon = 0.001;
  let active = cropMap[0]!;
  for (const entry of cropMap) {
    if (entry.time <= mediaTime + timeEpsilon) {
      active = entry;
    } else {
      break;
    }
  }
  return active;
}

export function isSplitFramingAtTimelineTime(
  cropMap: ReadonlyArray<CropMapPoint> | undefined,
  currentTime: number,
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  tracks: TimelineTrack[]
): boolean {
  if (!cropMap || cropMap.length === 0) {
    return false;
  }
  const mediaTime = calculateVideoTime(
    currentTime,
    thumbnailEnabled,
    thumbnailDuration,
    tracks
  );
  const active = getCropEntryAtMediaTime(cropMap, mediaTime);
  return active?.mode === 'split';
}

export function findSplitTimelineJumpTime(
  cropMap: ReadonlyArray<CropMapPoint> | undefined,
  currentTime: number,
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  tracks: TimelineTrack[]
): number | null {
  if (!cropMap || cropMap.length === 0) {
    return null;
  }

  const thumbOffset = thumbnailEnabled ? thumbnailDuration : 0;
  const videoTrack = tracks.find(tr => tr.id === 'video');
  const videoItems = (videoTrack?.items ?? [])
    .filter(item => item.duration > 0)
    .slice()
    .sort((a, b) => a.start - b.start);

  // Collect contiguous split windows in source media time
  const splitWindows: Array<{ start: number; end: number }> = [];
  let i = 0;
  while (i < cropMap.length) {
    const entry = cropMap[i]!;
    if (entry.mode === 'split') {
      const winStart = entry.time;
      let j = i + 1;
      while (j < cropMap.length && cropMap[j]!.mode === 'split') {
        j++;
      }
      const winEnd =
        j < cropMap.length ? cropMap[j]!.time : Number.POSITIVE_INFINITY;
      splitWindows.push({ start: winStart, end: winEnd });
      i = j;
    } else {
      i++;
    }
  }

  if (splitWindows.length === 0) {
    return null;
  }

  const candidateTargets: number[] = [];

  if (videoItems.length === 0) {
    for (const win of splitWindows) {
      candidateTargets.push(thumbOffset + win.start + 0.05);
    }
  } else {
    for (const seg of videoItems) {
      const segMediaStart =
        seg.mediaStart !== undefined ? seg.mediaStart : seg.start;
      const segMediaEnd = segMediaStart + seg.duration;
      for (const win of splitWindows) {
        const overlapStart = Math.max(segMediaStart, win.start);
        const overlapEnd = Math.min(segMediaEnd, win.end);
        if (overlapEnd - overlapStart > 0.01) {
          const timelineEntry =
            thumbOffset + seg.start + (overlapStart - segMediaStart);
          const segTimelineEnd = thumbOffset + seg.start + seg.duration;
          candidateTargets.push(
            Math.min(
              timelineEntry + 0.05,
              Math.max(timelineEntry, segTimelineEnd - 0.01)
            )
          );
        }
      }
    }
  }

  if (candidateTargets.length === 0) {
    return null;
  }

  candidateTargets.sort((a, b) => a - b);
  const nextTarget = candidateTargets.find(t => t > currentTime + 0.02);
  return nextTarget ?? candidateTargets[0]!;
}

export function splitTimelineItem(
  item: TimelineItem,
  cutTime: number,
  newIdGenerator: () => string = () => Math.random().toString(36).substr(2, 9)
): { firstItem: TimelineItem; secondItem: TimelineItem } | null {
  if (cutTime <= item.start || cutTime >= item.start + item.duration) {
    return null;
  }

  const splitOffset = cutTime - item.start;
  const originalMediaStart =
    item.mediaStart !== undefined ? item.mediaStart : 0;
  const newMediaStart = originalMediaStart + splitOffset;
  const dur2 = item.start + item.duration - cutTime;

  const firstItem: TimelineItem = {
    ...item,
    duration: cutTime - item.start
  };

  const secondItem: TimelineItem = {
    ...item,
    id: newIdGenerator(),
    start: cutTime,
    duration: dur2,
    mediaStart: newMediaStart
  };

  return { firstItem, secondItem };
}

export function deleteTimelineItemWithRipple(
  tracks: TimelineTrack[],
  transcript: any[],
  itemToDelete: TimelineItem,
  trackId: string,
  currentTime: number,
  thumbnailEnabled: boolean,
  thumbnailDuration: number
): {
  updatedTracks: TimelineTrack[];
  updatedTranscript: any[];
  updatedCurrentTime: number;
} {
  // 1. Remove deleted item from tracks
  const updatedTracks: TimelineTrack[] = tracks.map(track => ({
    ...track,
    items: track.items.filter(i => i.id !== itemToDelete.id)
  }));

  let updatedCurrentTime = currentTime;
  let updatedTranscript = transcript ? [...transcript] : [];

  // ONLY perform ripple edit if we deleted a video segment!
  if (trackId === 'video') {
    // Ripple edit: shift all items starting at or after deleted item to the left
    updatedTracks.forEach(track => {
      track.items.forEach(item => {
        if (item.start >= itemToDelete.start - 0.001) {
          item.start = Math.max(0, item.start - itemToDelete.duration);
        }
      });
    });

    // Update playhead position
    const offset = thumbnailEnabled ? thumbnailDuration : 0;
    const relTime = currentTime - offset;

    if (relTime > itemToDelete.start + itemToDelete.duration) {
      updatedCurrentTime = Math.max(0, currentTime - itemToDelete.duration);
    } else if (relTime >= itemToDelete.start) {
      updatedCurrentTime = itemToDelete.start + offset;
    }

    // Subtitle ripple edit
    if (transcript && transcript.length > 0) {
      const newTranscript: any[] = [];
      const delStart = itemToDelete.start;
      const delEnd = itemToDelete.start + itemToDelete.duration;

      transcript.forEach(s => {
        const segStart = s.start + offset;
        const segEnd = s.start + s.duration + offset;

        // Case 1: completely before deleted window
        if (segEnd <= delStart + 0.001) {
          newTranscript.push(s);
        }
        // Case 2: completely after deleted window
        else if (segStart >= delEnd - 0.001) {
          newTranscript.push({
            ...s,
            start: Math.max(0, s.start - itemToDelete.duration)
          });
        }
        // Case 3: overlaps with deleted window
        else {
          const rawWords = (s.text || '').trim().split(/\s+/);
          if (!rawWords.length || !(s.text || '').trim()) return;
          const wordDur = s.duration / rawWords.length;

          const block1Words: string[] = [];
          const block2Words: string[] = [];
          let block2StartIndex = -1;

          rawWords.forEach((w: string, i: number) => {
            const wordStart = segStart + i * wordDur;
            const wordEnd = wordStart + wordDur;

            if (wordEnd <= delStart + 0.001) {
              block1Words.push(w);
            } else if (wordStart >= delEnd - 0.001) {
              block2Words.push(w);
              if (block2StartIndex === -1) block2StartIndex = i;
            }
          });

          if (block1Words.length > 0) {
            newTranscript.push({
              ...s,
              text: block1Words.join(' '),
              duration: block1Words.length * wordDur
            });
          }

          if (block2Words.length > 0) {
            const originalStart =
              segStart + block2StartIndex * wordDur - offset;
            newTranscript.push({
              ...s,
              id: s.id + '_shifted',
              text: block2Words.join(' '),
              start: Math.max(0, originalStart - itemToDelete.duration),
              duration: block2Words.length * wordDur
            });
          }
        }
      });
      updatedTranscript = newTranscript;
    }
  }

  return {
    updatedTracks,
    updatedTranscript,
    updatedCurrentTime
  };
}

export function calculateSnapTime(
  val: number,
  snapEnabled: boolean,
  pxPerSec: number,
  currentTime: number,
  tracks: TimelineTrack[],
  thumbnailEnabled: boolean,
  thumbnailDuration: number,
  activeDraggingItemId?: string,
  isAudio?: boolean
): number {
  if (!snapEnabled) return val;
  const tolerance = 5 / pxPerSec;

  const targets: number[] = [];

  // 1. Ruler interval snap
  let step = 1;
  if (pxPerSec >= 200) step = 0.1;
  else if (pxPerSec >= 100) step = 0.25;
  else if (pxPerSec >= 50) step = 0.5;

  const nearestRuler = Math.round(val / step) * step;
  targets.push(nearestRuler);

  const offset = thumbnailEnabled ? thumbnailDuration : 0;

  if (isAudio) {
    // 2. Audio magnetic snap targets: 0.0s, coverDuration (if cover active), and global currentTime
    targets.push(0.0);
    if (offset > 0) {
      targets.push(offset);
    }
    targets.push(currentTime);

    // 3. Audio clip edges: other audio items (in global ruler time) & non-audio items (shifted to global time)
    tracks.forEach(track => {
      const isOtherAudio = isAudioTrack(track);
      track.items.forEach(item => {
        if (activeDraggingItemId && item.id === activeDraggingItemId) return;
        const start = isOtherAudio ? item.start : item.start + offset;
        targets.push(start);
        targets.push(start + item.duration);
      });
    });
  } else {
    // 2. Playhead snap (video-relative coordinates)
    targets.push(currentTime - offset);

    // 3. Clip edge snap
    tracks.forEach(track => {
      const isOtherAudio = isAudioTrack(track);
      track.items.forEach(item => {
        if (activeDraggingItemId && item.id === activeDraggingItemId) return;
        if (isOtherAudio) {
          if (item.start >= offset) {
            targets.push(item.start - offset);
          }
          if (item.start + item.duration >= offset) {
            targets.push(item.start + item.duration - offset);
          }
        } else {
          targets.push(item.start);
          targets.push(item.start + item.duration);
        }
      });
    });
  }

  // Find closest target within tolerance
  let closest = val;
  let minDist = tolerance;
  for (const t of targets) {
    const dist = Math.abs(val - t);
    if (dist < minDist) {
      minDist = dist;
      closest = t;
    }
  }
  return closest;
}

export function calculateDragBounds(
  mode: 'move' | 'start' | 'end',
  startVal: number,
  dx: number,
  currentItem: TimelineItem,
  snapFn: (val: number) => number
): { newStart: number; newDuration: number } {
  if (mode === 'start') {
    let newStart = Math.max(0, startVal + dx);
    newStart = snapFn(newStart);
    const diff = currentItem.start - newStart;
    if (currentItem.duration + diff > 0.1) {
      return {
        newStart,
        newDuration: currentItem.duration + diff
      };
    }
    return {
      newStart: currentItem.start,
      newDuration: currentItem.duration
    };
  }

  if (mode === 'end') {
    let newDur = Math.max(0.1, startVal + dx);
    const newEnd = currentItem.start + newDur;
    const snappedEnd = snapFn(newEnd);
    newDur = Math.max(0.1, snappedEnd - currentItem.start);
    return {
      newStart: currentItem.start,
      newDuration: newDur
    };
  }

  // mode === 'move'
  let newStart = Math.max(0, startVal + dx);
  newStart = snapFn(newStart);
  return {
    newStart,
    newDuration: currentItem.duration
  };
}

export function calculateRulerTicks(
  totalW: number,
  pxPerSec: number
): RulerTick[] {
  const ticks: RulerTick[] = [];
  const dur = totalW / pxPerSec;
  let step: number;
  let labelEvery: number;

  if (pxPerSec >= 200) {
    step = 0.1;
    labelEvery = 1;
  } else if (pxPerSec >= 100) {
    step = 0.25;
    labelEvery = 1;
  } else if (pxPerSec >= 50) {
    step = 0.5;
    labelEvery = 5;
  } else {
    step = 1;
    labelEvery = 5;
  }

  for (let t = 0; t <= dur; t = Math.round((t + step) * 1000) / 1000) {
    const pos = t * pxPerSec;
    const isMajor =
      Math.abs(t % labelEvery) < 0.001 ||
      Math.abs((t % labelEvery) - labelEvery) < 0.001;
    const showLabel = isMajor && t > 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.round((t % 1) * 10);
    const label = showLabel
      ? t >= 60
        ? `${m}:${s.toString().padStart(2, '0')}`
        : t % 1 === 0
          ? `${s}s`
          : `${s}.${ms}s`
      : null;
    ticks.push({ pos, major: isMajor, label });
  }
  return ticks;
}
