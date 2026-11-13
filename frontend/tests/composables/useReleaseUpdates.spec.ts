import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useReleaseUpdates,
  type ReleasesApiResponse
} from '../../app/composables/useReleaseUpdates';

describe('useReleaseUpdates Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      (globalThis as { clearNuxtState?: () => void }).clearNuxtState?.();
    } catch {
      // ignore if outside Nuxt context
    }
    const state = useReleaseUpdates();
    state.installedVersion.value = '0.3.0';
    state.remoteReleases.value = [];
    state.hasCheckedUpdates.value = false;
    state.isCheckingUpdates.value = false;
    state.remoteOffline.value = false;
    state.remoteError.value = null;
  });

  it('checks /api/releases once unless forced and identifies newer stable updates', async () => {
    const fetcher = vi
      .fn<() => Promise<ReleasesApiResponse>>()
      .mockResolvedValue({
        currentVersion: '0.3.0',
        cached: true,
        stale: false,
        offline: false,
        releases: [
          {
            version: '0.5.0-rc.1',
            title: 'RC Release',
            date: '2026-11-20',
            prerelease: true
          },
          {
            version: '0.4.0',
            title: 'Hybrid Changelog',
            date: '2026-11-18',
            body: '### Features\n\n- Remote checks',
            githubReleaseUrl:
              'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
          },
          {
            version: '0.3.0',
            title: 'Current Release',
            date: '2026-11-13'
          }
        ]
      });

    const updates = useReleaseUpdates();
    await updates.checkForUpdates({
      apiBase: 'http://localhost:8765',
      fetcher
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8765/api/releases');
    expect(updates.installedVersion.value).toBe('0.3.0');
    expect(updates.hasAvailableUpdate.value).toBe(true);
    expect(updates.latestAvailableVersion.value).toBe('0.4.0');
    expect(updates.availableUpdates.value.map(r => r.version)).toEqual([
      '0.4.0'
    ]);

    // Subsequent non-forced call in same session skips duplicate request
    await updates.checkForUpdates({
      apiBase: 'http://localhost:8765',
      fetcher
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Forced call triggers ?force=true
    await updates.checkForUpdates({
      force: true,
      apiBase: 'http://localhost:8765',
      fetcher
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith(
      'http://localhost:8765/api/releases?force=true'
    );
  });

  it('handles offline or failing backend gracefully without throwing', async () => {
    const fetcher = vi
      .fn<() => Promise<ReleasesApiResponse>>()
      .mockRejectedValue(new Error('Network down'));

    const updates = useReleaseUpdates();
    await updates.checkForUpdates({
      apiBase: 'http://localhost:8765',
      fetcher
    });

    expect(updates.remoteOffline.value).toBe(true);
    expect(updates.remoteError.value).toBeTruthy();
    expect(updates.hasAvailableUpdate.value).toBe(false);
    expect(updates.installedVersion.value).toBe('0.3.0');
  });

  it('prevents stale earlier check from overwriting a newer forced check', async () => {
    let resolveSlowInitial!: (value: ReleasesApiResponse) => void;
    const slowInitialPromise = new Promise<ReleasesApiResponse>(resolve => {
      resolveSlowInitial = resolve;
    });

    let callCount = 0;
    const fetcher = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return slowInitialPromise;
      }
      return Promise.resolve({
        currentVersion: '0.3.0',
        releases: [
          {
            version: '0.4.0',
            title: 'Fresh Release',
            date: '2026-11-18'
          }
        ]
      });
    });

    const updates = useReleaseUpdates();
    const initialRun = updates.checkForUpdates({
      apiBase: 'http://localhost:8765',
      fetcher
    });
    const forcedRun = updates.checkForUpdates({
      force: true,
      apiBase: 'http://localhost:8765',
      fetcher
    });

    await forcedRun;
    expect(updates.latestAvailableVersion.value).toBe('0.4.0');

    // Slow initial request resolves offline afterwards and must NOT overwrite newer forced result
    resolveSlowInitial({
      currentVersion: '0.3.0',
      offline: true,
      error: 'Stale timeout',
      releases: []
    });
    await initialRun;

    expect(updates.latestAvailableVersion.value).toBe('0.4.0');
    expect(updates.remoteOffline.value).toBe(false);
    expect(updates.remoteError.value).toBeNull();
  });
});
