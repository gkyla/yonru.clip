import { resolveApiBase } from './apiBase';
import type {
  ClipSessionAck,
  ClipSessionData,
  ClipSessionPatch
} from '../types/clipper';

export type {
  ClipSessionAck,
  ClipSessionData,
  ClipSessionHistoryPayload,
  ClipSessionPatch
} from '../types/clipper';

export interface HttpFetchOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export type HttpFetcher = <T>(
  url: string,
  options?: HttpFetchOptions
) => Promise<T>;

export interface ClipSessionClientOptions {
  apiBase?: string;
  fetcher?: HttpFetcher;
}

/**
 * Resolves the active HTTP transport: injected adapter, Nuxt $fetch, or Fetch API.
 */
export async function executeSessionFetch<T>(
  url: string,
  options?: HttpFetchOptions,
  fetcher?: HttpFetcher
): Promise<T> {
  if (fetcher) {
    return fetcher<T>(url, options);
  }
  const globalFetch = (globalThis as { $fetch?: HttpFetcher }).$fetch;
  if (typeof globalFetch === 'function') {
    return globalFetch<T>(url, options);
  }
  const res = await fetch(url, {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) {
    const err = new Error(res.statusText) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function loadSession(
  folderName: string,
  clipId: string,
  options?: ClipSessionClientOptions
): Promise<ClipSessionData> {
  const apiBase = options?.apiBase ?? resolveApiBase();
  const url = `${apiBase}/api/clip-session/${encodeURIComponent(folderName)}/${encodeURIComponent(clipId)}`;
  const res = await executeSessionFetch<{
    status: string;
    session: ClipSessionData;
  }>(url, undefined, options?.fetcher);
  return res.session;
}

export async function patchSession(
  folderName: string,
  clipId: string,
  patch: ClipSessionPatch,
  options?: ClipSessionClientOptions
): Promise<ClipSessionAck> {
  const apiBase = options?.apiBase ?? resolveApiBase();
  const url = `${apiBase}/api/clip-session/${encodeURIComponent(folderName)}/${encodeURIComponent(clipId)}`;
  return executeSessionFetch<ClipSessionAck>(
    url,
    {
      method: 'PUT',
      body: patch
    },
    options?.fetcher
  );
}

/**
 * Client adapter bound to a fixed apiBase and HttpFetcher.
 */
export class ClipSessionClient {
  private apiBase: string;
  private fetcher?: HttpFetcher;

  constructor(apiBase: string = resolveApiBase(), fetcher?: HttpFetcher) {
    this.apiBase = apiBase;
    this.fetcher = fetcher;
  }

  public loadSession(
    folderName: string,
    clipId: string
  ): Promise<ClipSessionData> {
    return loadSession(folderName, clipId, {
      apiBase: this.apiBase,
      fetcher: this.fetcher
    });
  }

  public patchSession(
    folderName: string,
    clipId: string,
    patch: ClipSessionPatch
  ): Promise<ClipSessionAck> {
    return patchSession(folderName, clipId, patch, {
      apiBase: this.apiBase,
      fetcher: this.fetcher
    });
  }
}
