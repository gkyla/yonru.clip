import { computed, ref } from 'vue';
import {
  compareSemver,
  normalizeVersion,
  sanitizeExternalUrl
} from '../utils/changelogMarkdown';
import {
  useReleaseUpdates,
  type ReleasesApiResponse
} from './useReleaseUpdates';

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  badge?: string;
  isLatest?: boolean;
  isInstalled?: boolean;
  isAvailableUpdate?: boolean;
  source?: 'local' | 'remote';
  githubReleaseUrl?: string;
  body?: unknown;
  rawBody?: string;
}

export interface ChangelogQueryHandle {
  order: (
    field: string,
    dir: 'ASC' | 'DESC'
  ) => { all: () => Promise<ChangelogItem[]> };
}

export type ChangelogQueryFn = (col: string) => ChangelogQueryHandle;

export interface UseChangelogOptions {
  queryOverride?: ChangelogQueryFn | null;
  fetcher?: (url: string) => Promise<ReleasesApiResponse>;
  apiBase?: string;
}

function resolveQueryFn(
  explicitOverride?: ChangelogQueryFn | null
): ChangelogQueryFn | null {
  if (explicitOverride !== undefined) {
    return explicitOverride;
  }

  const globalObj = globalThis as Record<string, unknown>;
  if (globalObj.queryCollection !== undefined) {
    return typeof globalObj.queryCollection === 'function'
      ? (globalObj.queryCollection as ChangelogQueryFn)
      : null;
  }

  try {
    if (typeof queryCollection === 'function') {
      return queryCollection as unknown as ChangelogQueryFn;
    }
  } catch {
    // queryCollection is not in scope
  }

  return null;
}

export function useChangelog(
  queryOverrideOrOptions?: ChangelogQueryFn | null | UseChangelogOptions,
  extraOptions?: Omit<UseChangelogOptions, 'queryOverride'>
) {
  const options: UseChangelogOptions =
    typeof queryOverrideOrOptions === 'function' ||
    queryOverrideOrOptions === null
      ? { queryOverride: queryOverrideOrOptions, ...extraOptions }
      : (queryOverrideOrOptions ?? {});

  const releaseUpdates = useReleaseUpdates();
  const localReleases = ref<ChangelogItem[]>([]);
  const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle');
  const hasLoaded = ref<boolean>(false);

  const releases = computed<ChangelogItem[]>(() => {
    if (!hasLoaded.value || status.value === 'error') {
      return [];
    }

    const installed = releaseUpdates.installedVersion.value;
    const hideStaleLatest =
      releaseUpdates.hasAvailableUpdate.value ||
      releaseUpdates.remoteOffline.value;

    const sortedLocals = [...localReleases.value].sort((a, b) =>
      compareSemver(b.version || '', a.version || '')
    );

    const localVersionSet = new Set(
      sortedLocals.map(item => normalizeVersion(item.version || ''))
    );

    const normalizedLocals: ChangelogItem[] = sortedLocals.map((item, idx) => {
      const norm = normalizeVersion(item.version || '');
      const isInstalled = compareSemver(norm, installed) === 0;
      const isStaticLatestBadge = item.badge?.trim().toLowerCase() === 'latest';
      const dropLatestBadge =
        isStaticLatestBadge && (hideStaleLatest || idx > 0);
      const cleanedBadge = dropLatestBadge ? undefined : item.badge;

      return {
        ...item,
        version: norm || item.version,
        badge: cleanedBadge,
        isLatest: dropLatestBadge ? false : item.isLatest,
        isInstalled,
        isAvailableUpdate: false,
        source: 'local',
        githubReleaseUrl:
          sanitizeExternalUrl(item.githubReleaseUrl) ?? undefined
      };
    });

    const remoteItems: ChangelogItem[] = [];
    for (const remote of releaseUpdates.availableUpdates.value) {
      const norm = normalizeVersion(remote.version);
      if (localVersionSet.has(norm)) continue;
      remoteItems.push({
        version: norm,
        date: remote.date,
        title: remote.title,
        badge: 'Available Update',
        isLatest: false,
        isInstalled: false,
        isAvailableUpdate: true,
        source: 'remote',
        githubReleaseUrl:
          sanitizeExternalUrl(remote.githubReleaseUrl) ?? undefined,
        rawBody: remote.body || ''
      });
    }

    return [...remoteItems, ...normalizedLocals].sort((a, b) =>
      compareSemver(b.version || '', a.version || '')
    );
  });

  async function fetchReleases(fetchOpts?: { force?: boolean }): Promise<void> {
    if (!hasLoaded.value || status.value === 'error') {
      status.value = 'pending';
    }
    let localFailed = false;

    const loadLocal = async () => {
      try {
        const queryFn = resolveQueryFn(options.queryOverride);
        if (typeof queryFn === 'function') {
          const result = await queryFn('changelog').order('date', 'DESC').all();
          localReleases.value = Array.isArray(result) ? result : [];
        } else {
          localReleases.value = [];
        }
      } catch (err) {
        console.error('Failed to query changelog collection:', err);
        localFailed = true;
        localReleases.value = [];
      }
    };

    await Promise.all([
      loadLocal(),
      releaseUpdates.checkForUpdates({
        force: fetchOpts?.force,
        apiBase: options.apiBase,
        fetcher: options.fetcher
      })
    ]);

    hasLoaded.value = true;
    status.value = localFailed ? 'error' : 'success';
  }

  async function refreshReleases(): Promise<void> {
    await fetchReleases({ force: true });
  }

  return {
    releases,
    status,
    installedVersion: releaseUpdates.installedVersion,
    hasAvailableUpdate: releaseUpdates.hasAvailableUpdate,
    latestAvailableRelease: releaseUpdates.latestAvailableRelease,
    latestAvailableVersion: releaseUpdates.latestAvailableVersion,
    isRefreshing: releaseUpdates.isCheckingUpdates,
    isOffline: releaseUpdates.remoteOffline,
    remoteError: releaseUpdates.remoteError,
    fetchReleases,
    refreshReleases
  };
}
