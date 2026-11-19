import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ClipSessionSaveScheduler,
  DEFAULT_DOMAIN_DELAYS_MS,
  type ClipSessionSaveDomain,
  type ClipSessionTarget
} from '../../app/utils/clipSessionSaveScheduler';
import type { ClipSessionPatch } from '../../app/types/clipper';

function deferred<T>() {
  let resolve!: (val: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ClipSessionSaveScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid multi-domain edits into a single PUT /api/clip-session payload', async () => {
    let target: ClipSessionTarget | null = {
      folderName: 'folder-1',
      clipId: 'clip-1'
    };
    const pendingStates: boolean[] = [];
    const patchSession = vi.fn().mockResolvedValue({
      status: 'ok',
      folder_name: 'folder-1',
      clip_id: 'clip-1'
    });

    const scheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () => target,
        onPendingStateChange: p => pendingStates.push(p),
        buildDomainPatch: domains => {
          const patch: ClipSessionPatch = {};
          if (domains.has('transcript')) {
            patch.transcript = [{ start: 0, duration: 2, text: 'edited' }];
          }
          if (domains.has('style_settings')) {
            patch.style_settings = { font: 'Outfit', fontSize: 55 };
          }
          if (domains.has('timeline')) {
            patch.timeline = [
              { id: 'text', name: 'Text 1', type: 'text', items: [] }
            ];
          }
          if (domains.has('cover_config')) {
            patch.cover_config = { enabled: true, duration: 1.5, xOffset: 60 };
          }
          if (domains.has('history')) {
            patch.history = { undo_stack: [], redo_stack: [] };
          }
          return patch;
        }
      }
    });

    scheduler.markDirty('style_settings');
    await vi.advanceTimersByTimeAsync(100);
    scheduler.markDirty('timeline');
    await vi.advanceTimersByTimeAsync(100);
    scheduler.markDirty('cover_config'); // shortest delay: 300ms
    scheduler.markDirty('transcript');
    scheduler.markDirty('history');

    expect(scheduler.hasPendingWork()).toBe(true);
    expect(patchSession).not.toHaveBeenCalled();

    // Advance just past shortest dirty domain delay (300ms)
    await vi.advanceTimersByTimeAsync(DEFAULT_DOMAIN_DELAYS_MS.cover_config);

    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(patchSession).toHaveBeenCalledWith('folder-1', 'clip-1', {
      transcript: [{ start: 0, duration: 2, text: 'edited' }],
      style_settings: { font: 'Outfit', fontSize: 55 },
      timeline: [{ id: 'text', name: 'Text 1', type: 'text', items: [] }],
      cover_config: { enabled: true, duration: 1.5, xOffset: 60 },
      history: { undo_stack: [], redo_stack: [] }
    });

    // Advancing longer timers must not emit any trailing PUTs
    await vi.advanceTimersByTimeAsync(2000);
    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(scheduler.hasPendingWork()).toBe(false);
    expect(pendingStates[0]).toBe(true);
    expect(pendingStates[pendingStates.length - 1]).toBe(false);

    target = null;
    scheduler.dispose();
  });

  it('enforces strict single-flight serialization and coalesces mid-flight edits into one follow-up PUT', async () => {
    const firstDeferred = deferred<{
      status: string;
      folder_name: string;
      clip_id: string;
    }>();
    const secondDeferred = deferred<{
      status: string;
      folder_name: string;
      clip_id: string;
    }>();

    let concurrent = 0;
    let maxConcurrent = 0;
    let callCount = 0;

    const patchSession = vi.fn().mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      callCount++;
      try {
        if (callCount === 1) {
          return await firstDeferred.promise;
        }
        return await secondDeferred.promise;
      } finally {
        concurrent--;
      }
    });

    let fontSize = 40;
    const scheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () => ({ folderName: 'f1', clipId: 'c1' }),
        buildDomainPatch: domains => ({
          ...(domains.has('style_settings')
            ? { style_settings: { fontSize } }
            : {}),
          ...(domains.has('timeline')
            ? {
                timeline: [
                  { id: 't1', name: 'Text 1', type: 'text', items: [] }
                ]
              }
            : {})
        })
      }
    });

    // Trigger PUT #1
    const firstSave = scheduler.saveNow(['style_settings']);
    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(scheduler.hasPendingWork()).toBe(true);

    // 20 rapid edits arriving while PUT #1 is still in flight
    for (let i = 1; i <= 20; i++) {
      fontSize = 40 + i;
      scheduler.markDirty(i % 2 === 0 ? 'timeline' : 'style_settings');
      await vi.advanceTimersByTimeAsync(50);
    }

    // Advance past debounce while PUT #1 is STILL in flight — must NOT launch concurrent PUT #2
    await vi.advanceTimersByTimeAsync(1000);
    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(maxConcurrent).toBe(1);

    // Finish PUT #1 -> follow-up PUT #2 starts automatically once with latest state
    firstDeferred.resolve({ status: 'ok', folder_name: 'f1', clip_id: 'c1' });
    await firstSave;
    await Promise.resolve();

    expect(patchSession).toHaveBeenCalledTimes(2);
    expect(patchSession).toHaveBeenNthCalledWith(2, 'f1', 'c1', {
      style_settings: { fontSize: 60 },
      timeline: [{ id: 't1', name: 'Text 1', type: 'text', items: [] }]
    });

    secondDeferred.resolve({ status: 'ok', folder_name: 'f1', clip_id: 'c1' });
    await vi.advanceTimersByTimeAsync(2000);

    expect(patchSession).toHaveBeenCalledTimes(2);
    expect(maxConcurrent).toBe(1);
    expect(scheduler.hasPendingWork()).toBe(false);
    scheduler.dispose();
  });

  it('ignores markDirty when isLocked is true or target is missing', async () => {
    let locked = true;
    let target: ClipSessionTarget | null = { folderName: 'f', clipId: 'c' };
    const patchSession = vi.fn().mockResolvedValue({ status: 'ok' });

    const scheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () => target,
        isLocked: () => locked,
        buildDomainPatch: () => ({ style_settings: { font: 'Inter' } })
      }
    });

    expect(scheduler.markDirty('style_settings')).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(patchSession).not.toHaveBeenCalled();

    locked = false;
    target = null;
    expect(scheduler.markDirty('style_settings')).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(patchSession).not.toHaveBeenCalled();
    scheduler.dispose();
  });

  it('cancels pending debounce timers on flush() and saveNow() without double PUTs', async () => {
    const patchSession = vi.fn().mockResolvedValue({ status: 'ok' });
    let currentFont = 'Montserrat';

    const scheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () => ({ folderName: 'f', clipId: 'c' }),
        buildDomainPatch: domains => ({
          ...(domains.has('style_settings')
            ? { style_settings: { font: currentFont } }
            : {}),
          ...(domains.has('transcript')
            ? { transcript: [{ start: 0, duration: 1, text: 'hello' }] }
            : {})
        })
      }
    });

    currentFont = 'Outfit';
    scheduler.markDirty('style_settings');
    await scheduler.flush();
    expect(patchSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(patchSession).toHaveBeenCalledTimes(1);

    // Dirty style + immediate saveNow(['transcript']) merges dirty domain & cancels timer
    patchSession.mockClear();
    currentFont = 'Inter';
    scheduler.markDirty('style_settings');
    await scheduler.saveNow(['transcript']);

    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(patchSession).toHaveBeenCalledWith('f', 'c', {
      transcript: [{ start: 0, duration: 1, text: 'hello' }],
      style_settings: { font: 'Inter' }
    });

    await vi.advanceTimersByTimeAsync(2000);
    expect(patchSession).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it('flushes frozen patch to outgoing target via enqueueFrozenPatch and clears stale timers', async () => {
    let activeTarget: ClipSessionTarget | null = {
      folderName: 'old-folder',
      clipId: 'old-clip'
    };
    const patchSession = vi.fn().mockResolvedValue({ status: 'ok' });

    const scheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () => activeTarget,
        buildDomainPatch: () => ({ style_settings: { font: 'ShouldNotLeak' } })
      }
    });

    scheduler.markDirty('style_settings');
    expect(
      scheduler.hasDirtyDomains({
        folderName: 'old-folder',
        clipId: 'old-clip'
      })
    ).toBe(true);

    // Switch target & enqueue frozen snapshot for outgoing clip
    activeTarget = { folderName: 'new-folder', clipId: 'new-clip' };
    await scheduler.enqueueFrozenPatch(
      { folderName: 'old-folder', clipId: 'old-clip' },
      {
        style_settings: { font: 'OldClipFont' },
        history: { undo_stack: [], redo_stack: [] }
      },
      ['style_settings', 'history']
    );

    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(patchSession).toHaveBeenCalledWith('old-folder', 'old-clip', {
      style_settings: { font: 'OldClipFont' },
      history: { undo_stack: [], redo_stack: [] }
    });

    // Advancing timers must not flush anything against new-folder/new-clip
    await vi.advanceTimersByTimeAsync(3000);
    expect(patchSession).toHaveBeenCalledTimes(1);
    expect(scheduler.hasPendingWork()).toBe(false);
    scheduler.dispose();
  });

  it('recovers cleanly from failed background PUTs and rejects when throwOnError is true', async () => {
    const afterEvents: Array<{
      domains: ClipSessionSaveDomain[];
      ok: boolean;
    }> = [];
    const patchSession = vi
      .fn()
      .mockRejectedValueOnce(new Error('Disk temporarily busy'))
      .mockRejectedValueOnce(new Error('Explicit failure'))
      .mockResolvedValue({ status: 'ok' });

    const scheduler = new ClipSessionSaveScheduler({
      client: { patchSession },
      source: {
        getTarget: () => ({ folderName: 'f', clipId: 'c' }),
        buildDomainPatch: () => ({ timeline: [] }),
        onAfterPatch: (domains, _target, ok) => {
          afterEvents.push({ domains: Array.from(domains), ok });
        }
      }
    });

    // Background debounced failure should not reject or stall queue
    scheduler.markDirty('timeline');
    await vi.advanceTimersByTimeAsync(DEFAULT_DOMAIN_DELAYS_MS.timeline);
    expect(afterEvents[0]).toEqual({ domains: ['timeline'], ok: false });
    expect(scheduler.hasPendingWork()).toBe(false);

    // Explicit throwOnError: true rejects caller promise
    await expect(
      scheduler.saveNow(['timeline'], { throwOnError: true })
    ).rejects.toThrow('Explicit failure');

    // Subsequent save succeeds
    await expect(
      scheduler.saveNow(['timeline'], { throwOnError: true })
    ).resolves.toEqual({ status: 'ok' });
    expect(scheduler.hasPendingWork()).toBe(false);
    scheduler.dispose();
  });
});
