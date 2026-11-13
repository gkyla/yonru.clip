import { computed, ref, type Ref } from 'vue';
import pkg from '../../package.json';
import { resolveApiBase } from '../utils/apiBase';
import {
  compareSemver,
  normalizeVersion,
  parseSemver,
  sanitizeExternalUrl
} from '../utils/changelogMarkdown';

export interface RemoteReleaseDto {
  version: string;
  tagName?: string;
  title: string;
  date: string;
  publishedAt?: string;
  body?: string;
  githubReleaseUrl?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export interface ReleasesApiResponse {
  currentVersion?: string;
  releases?: RemoteReleaseDto[];
  cached?: boolean;
  stale?: boolean;
  offline?: boolean;
  fetchedAt?: string | null;
  error?: string | null;
}

export interface CheckUpdatesOptions {
  force?: boolean;
  apiBase?: string;
  fetcher?: (url: string) => Promise<ReleasesApiResponse>;
}

const DEFAULT_INSTALLED_VERSION = normalizeVersion(pkg.version || '0.3.0');
let inFlightCheckPromise: Promise<void> | null = null;
let checkRequestSeq = 0;

function normalizeRemoteReleaseList(
  rawReleases: RemoteReleaseDto[],
  minExclusiveVersion?: string
): RemoteReleaseDto[] {
  const seen = new Set<string>();
  const normalized: RemoteReleaseDto[] = [];

  for (const raw of rawReleases) {
    if (!raw || raw.draft || raw.prerelease) continue;
    const norm = normalizeVersion(raw.version || raw.tagName || '');
    if (!parseSemver(norm) || seen.has(norm)) continue;
    if (minExclusiveVersion && compareSemver(norm, minExclusiveVersion) <= 0) {
      continue;
    }
    seen.add(norm);
    normalized.push({
      ...raw,
      version: norm,
      title: (raw.title || `v${norm}`).trim(),
      date: raw.date || raw.publishedAt || '',
      body: raw.body || '',
      githubReleaseUrl:
        sanitizeExternalUrl(raw.githubReleaseUrl) ??
        `https://github.com/gkyla/yonru.clip/releases/tag/v${norm}`
    });
  }

  return normalized.sort((a, b) => compareSemver(b.version, a.version));
}

function useSafeState<T>(key: string, init: () => T): Ref<T> {
  try {
    return useState<T>(key, init);
  } catch {
    return ref(init()) as Ref<T>;
  }
}

async function defaultFetchReleases(url: string): Promise<ReleasesApiResponse> {
  if (typeof $fetch === 'function') {
    return await $fetch<ReleasesApiResponse>(url);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as ReleasesApiResponse;
}

export function useReleaseUpdates() {
  const installedVersion = useSafeState<string>(
    'yonru_installed_version',
    () => DEFAULT_INSTALLED_VERSION
  );
  const remoteReleases = useSafeState<RemoteReleaseDto[]>(
    'yonru_remote_releases',
    () => []
  );
  const isCheckingUpdates = useSafeState<boolean>(
    'yonru_checking_updates',
    () => false
  );
  const hasCheckedUpdates = useSafeState<boolean>(
    'yonru_has_checked_updates',
    () => false
  );
  const remoteOffline = useSafeState<boolean>(
    'yonru_updates_offline',
    () => false
  );
  const remoteError = useSafeState<string | null>(
    'yonru_updates_error',
    () => null
  );
  const lastCheckedAt = useSafeState<string | null>(
    'yonru_updates_checked_at',
    () => null
  );

  const availableUpdates = computed<RemoteReleaseDto[]>(() => {
    const current = installedVersion.value || DEFAULT_INSTALLED_VERSION;
    return normalizeRemoteReleaseList(remoteReleases.value, current);
  });

  const hasAvailableUpdate = computed(() => availableUpdates.value.length > 0);
  const latestAvailableRelease = computed(
    () => availableUpdates.value[0] ?? null
  );
  const latestAvailableVersion = computed(
    () => latestAvailableRelease.value?.version ?? null
  );

  async function checkForUpdates(
    options: CheckUpdatesOptions = {}
  ): Promise<void> {
    const force = Boolean(options.force);
    if (!force && hasCheckedUpdates.value) {
      return;
    }
    if (!force && inFlightCheckPromise) {
      await inFlightCheckPromise;
      return;
    }

    const base = options.apiBase ?? resolveApiBase();
    const fetcher = options.fetcher ?? defaultFetchReleases;
    const querySuffix = force ? '?force=true' : '';
    const requestSeq = ++checkRequestSeq;

    const runCheck = async () => {
      isCheckingUpdates.value = true;
      try {
        const payload = await fetcher(`${base}/api/releases${querySuffix}`);
        if (requestSeq !== checkRequestSeq) {
          return;
        }
        if (payload.currentVersion && parseSemver(payload.currentVersion)) {
          installedVersion.value = normalizeVersion(payload.currentVersion);
        }

        if (Array.isArray(payload.releases)) {
          remoteReleases.value = normalizeRemoteReleaseList(payload.releases);
        }

        remoteOffline.value = Boolean(payload.offline);
        remoteError.value = payload.error ?? null;
        lastCheckedAt.value = payload.fetchedAt ?? new Date().toISOString();
        hasCheckedUpdates.value = true;
      } catch {
        if (requestSeq !== checkRequestSeq) {
          return;
        }
        remoteOffline.value = true;
        remoteError.value =
          'Unable to reach GitHub Releases right now. Showing local release notes.';
        hasCheckedUpdates.value = true;
      } finally {
        if (requestSeq === checkRequestSeq) {
          isCheckingUpdates.value = false;
          inFlightCheckPromise = null;
        }
      }
    };

    const pending = runCheck();
    inFlightCheckPromise = pending;
    await pending;
  }

  return {
    installedVersion,
    remoteReleases,
    availableUpdates,
    hasAvailableUpdate,
    latestAvailableRelease,
    latestAvailableVersion,
    isCheckingUpdates,
    hasCheckedUpdates,
    remoteOffline,
    remoteError,
    lastCheckedAt,
    checkForUpdates
  };
}
