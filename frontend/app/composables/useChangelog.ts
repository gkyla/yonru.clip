import { ref } from 'vue';

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  badge?: string;
  isLatest?: boolean;
  githubReleaseUrl?: string;
  body?: unknown;
}

export function useChangelog(queryOverride?: ((col: string) => any) | null) {
  const releases = ref<ChangelogItem[]>([]);
  const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle');

  async function fetchReleases() {
    status.value = 'pending';
    try {
      let queryFn: ((col: string) => any) | null | undefined = queryOverride;

      if (
        queryFn === undefined &&
        typeof (globalThis as any).queryCollection !== 'undefined'
      ) {
        queryFn = (globalThis as any).queryCollection;
      }

      if (queryFn === undefined) {
        try {
          if (typeof queryCollection === 'function') {
            queryFn = queryCollection;
          }
        } catch {
          // queryCollection is not in scope
        }
      }

      if (typeof queryFn === 'function') {
        const result = await queryFn('changelog').order('date', 'DESC').all();
        releases.value = (result || []) as ChangelogItem[];
      } else {
        releases.value = [];
      }
      status.value = 'success';
    } catch (err) {
      console.error('Failed to query changelog collection:', err);
      status.value = 'error';
      releases.value = [];
    }
  }

  return {
    releases,
    status,
    fetchReleases
  };
}
