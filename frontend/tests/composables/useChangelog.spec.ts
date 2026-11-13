import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChangelog } from '../../app/composables/useChangelog';
import {
  useReleaseUpdates,
  type ReleasesApiResponse
} from '../../app/composables/useReleaseUpdates';

function createSilentFetcher(
  payload: ReleasesApiResponse = { currentVersion: '0.3.0', releases: [] }
) {
  return vi.fn<() => Promise<ReleasesApiResponse>>().mockResolvedValue(payload);
}

describe('useChangelog Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as Record<string, unknown>).queryCollection;
    try {
      (globalThis as { clearNuxtState?: () => void }).clearNuxtState?.();
    } catch {
      // ignore if outside Nuxt context
    }
    const updates = useReleaseUpdates();
    updates.installedVersion.value = '0.3.0';
    updates.remoteReleases.value = [];
    updates.hasCheckedUpdates.value = false;
    updates.isCheckingUpdates.value = false;
    updates.remoteOffline.value = false;
    updates.remoteError.value = null;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).queryCollection;
  });

  it('initializes with default empty state', () => {
    const { releases, status } = useChangelog();
    expect(releases.value).toEqual([]);
    expect(status.value).toBe('idle');
  });

  it('fetches local releases successfully and marks highest local version as Installed', async () => {
    const mockData = [
      {
        version: '0.3.0',
        date: '2026-11-13',
        title: 'Multi-Track NLE Timeline',
        badge: 'Latest',
        isLatest: true
      },
      {
        version: '0.1.0',
        date: '2026-10-21',
        title: 'Initial Release',
        badge: 'Initial Release'
      }
    ];

    const mockAll = vi.fn().mockResolvedValue(mockData);
    const mockOrder = vi.fn().mockReturnValue({ all: mockAll });
    const mockQuery = vi.fn().mockReturnValue({ order: mockOrder });

    (globalThis as Record<string, unknown>).queryCollection = mockQuery;

    const fetcher = createSilentFetcher({
      currentVersion: '0.3.0',
      releases: []
    });

    const { releases, status, fetchReleases } = useChangelog({ fetcher });
    await fetchReleases();

    expect(status.value).toBe('success');
    expect(releases.value).toHaveLength(2);
    expect(releases.value[0]).toMatchObject({
      version: '0.3.0',
      title: 'Multi-Track NLE Timeline',
      source: 'local',
      isInstalled: true,
      isAvailableUpdate: false
    });
    expect(releases.value[1]).toMatchObject({
      version: '0.1.0',
      badge: 'Initial Release',
      source: 'local',
      isInstalled: false
    });
    expect(mockQuery).toHaveBeenCalledWith('changelog');
    expect(mockOrder).toHaveBeenCalledWith('date', 'DESC');
  });

  it('prepends newer stable remote releases with Available Update badge and hides stale Latest label', async () => {
    const mockLocal = [
      {
        version: '0.3.0',
        date: '2026-11-13',
        title: 'Local Current Release',
        badge: 'Latest',
        isLatest: true
      },
      {
        version: '0.2.0',
        date: '2026-11-02',
        title: 'Local Previous Release'
      }
    ];

    const mockQuery = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(mockLocal)
      })
    });

    const fetcher = createSilentFetcher({
      currentVersion: '0.3.0',
      releases: [
        {
          version: '0.4.0',
          title: 'Remote Discovery',
          date: '2026-11-16',
          body: '### Features\n\n- Remote update notice',
          githubReleaseUrl:
            'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
        },
        {
          // Same version as local installed version: local .md must win
          version: '0.3.0',
          title: 'Remote Copy Should Be Deduplicated',
          date: '2026-11-13',
          body: 'Should not appear'
        },
        {
          version: '0.5.0-beta.1',
          title: 'Prerelease Should Be Ignored',
          date: '2026-11-17',
          prerelease: true
        }
      ]
    });

    const {
      releases,
      hasAvailableUpdate,
      latestAvailableVersion,
      fetchReleases
    } = useChangelog({
      queryOverride: mockQuery,
      fetcher
    });

    await fetchReleases();

    expect(hasAvailableUpdate.value).toBe(true);
    expect(latestAvailableVersion.value).toBe('0.4.0');
    expect(releases.value.map(r => r.version)).toEqual([
      '0.4.0',
      '0.3.0',
      '0.2.0'
    ]);

    expect(releases.value[0]).toMatchObject({
      version: '0.4.0',
      source: 'remote',
      badge: 'Available Update',
      isAvailableUpdate: true,
      isInstalled: false,
      rawBody: '### Features\n\n- Remote update notice'
    });

    // Local 0.3.0 keeps local title, gets Installed badge, and drops misleading "Latest"
    expect(releases.value[1]).toMatchObject({
      version: '0.3.0',
      title: 'Local Current Release',
      source: 'local',
      isInstalled: true,
      isAvailableUpdate: false
    });
    expect(releases.value[1]?.badge).toBeUndefined();
  });

  it('keeps local releases rendering when remote check fails offline', async () => {
    const mockLocal = [
      {
        version: '0.3.0',
        date: '2026-11-13',
        title: 'Local Release',
        badge: 'Latest'
      }
    ];
    const mockQuery = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(mockLocal)
      })
    });
    const failingFetcher = vi
      .fn<() => Promise<ReleasesApiResponse>>()
      .mockRejectedValue(new Error('Offline'));

    const { releases, status, isOffline, remoteError, fetchReleases } =
      useChangelog({
        queryOverride: mockQuery,
        fetcher: failingFetcher
      });

    await fetchReleases();

    expect(status.value).toBe('success');
    expect(isOffline.value).toBe(true);
    expect(remoteError.value).toBeTruthy();
    expect(releases.value).toHaveLength(1);
    expect(releases.value[0]?.version).toBe('0.3.0');
    expect(releases.value[0]?.isInstalled).toBe(true);
    // Avoid unverified static "Latest" when offline
    expect(releases.value[0]?.badge).toBeUndefined();
  });

  it('supports manual refresh forcing remote re-fetch', async () => {
    const mockQuery = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        all: vi
          .fn()
          .mockResolvedValue([
            { version: '0.3.0', date: '2026-11-13', title: 'Local Release' }
          ])
      })
    });
    const fetcher = vi
      .fn<() => Promise<ReleasesApiResponse>>()
      .mockResolvedValueOnce({ currentVersion: '0.3.0', releases: [] })
      .mockResolvedValueOnce({
        currentVersion: '0.3.0',
        releases: [
          { version: '0.4.0', title: 'New Release', date: '2026-11-18' }
        ]
      });

    const { releases, status, fetchReleases, refreshReleases } = useChangelog({
      queryOverride: mockQuery,
      fetcher,
      apiBase: 'http://localhost:8765'
    });

    await fetchReleases();
    expect(releases.value.map(r => r.version)).toEqual(['0.3.0']);

    const refreshPromise = refreshReleases();
    // Refresh keeps already-loaded releases visible rather than flashing skeletons
    expect(status.value).toBe('success');
    expect(releases.value.map(r => r.version)).toEqual(['0.3.0']);

    await refreshPromise;
    expect(fetcher).toHaveBeenLastCalledWith(
      'http://localhost:8765/api/releases?force=true'
    );
    expect(releases.value.map(r => r.version)).toEqual(['0.4.0', '0.3.0']);
  });

  it('handles query error gracefully', async () => {
    const mockQuery = vi.fn().mockImplementation(() => {
      throw new Error('Database error');
    });

    (globalThis as Record<string, unknown>).queryCollection = mockQuery;

    const { releases, status, fetchReleases } = useChangelog({
      fetcher: createSilentFetcher()
    });
    await fetchReleases();

    expect(status.value).toBe('error');
    expect(releases.value).toEqual([]);
  });

  it('handles missing queryCollection gracefully via queryOverride null', async () => {
    const { releases, status, fetchReleases } = useChangelog(null, {
      fetcher: createSilentFetcher()
    });
    await fetchReleases();

    expect(status.value).toBe('success');
    expect(releases.value).toEqual([]);
  });

  it('handles missing queryCollection gracefully when globalThis is explicitly null', async () => {
    (globalThis as Record<string, unknown>).queryCollection = null;

    const { releases, status, fetchReleases } = useChangelog({
      fetcher: createSilentFetcher()
    });
    await fetchReleases();

    expect(status.value).toBe('success');
    expect(releases.value).toEqual([]);
  });

  it('drops unsafe local URLs, strips non-top Latest badges, and avoids false Installed when doc is missing', async () => {
    const mockLocal = [
      {
        version: '0.3.0',
        date: '2026-11-13',
        title: 'Older Document',
        badge: 'Latest',
        githubReleaseUrl: 'javascript:alert(1)'
      },
      {
        version: '0.2.0',
        date: '2026-11-01',
        title: 'Legacy Document',
        badge: 'Latest'
      }
    ];
    const mockQuery = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(mockLocal)
      })
    });
    const fetcher = createSilentFetcher({
      currentVersion: '0.3.1',
      releases: []
    });

    const { releases, fetchReleases } = useChangelog({
      queryOverride: mockQuery,
      fetcher
    });
    await fetchReleases();

    expect(releases.value[0]?.isInstalled).toBe(false);
    expect(releases.value[0]?.githubReleaseUrl).toBeUndefined();
    expect(releases.value[0]?.badge).toBe('Latest');
    expect(releases.value[1]?.badge).toBeUndefined();
  });
});
