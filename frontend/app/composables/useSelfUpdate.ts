import { ref, type Ref } from 'vue';
import { resolveApiBase } from '../utils/apiBase';
import { normalizeVersion } from '../utils/changelogMarkdown';
import { useAppNotifier, type ToastType } from './useAppNotifier';

export interface PreflightCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string | null;
}

export interface ActiveJobSummary {
  jobId: string;
  status: string;
}

export interface SelfUpdatePreflightResponse {
  supported: boolean;
  canUpdate: boolean;
  currentVersion: string;
  targetVersion: string;
  targetTag: string;
  mode: 'production' | 'dev' | 'standalone' | string;
  branch: string;
  initialCommit: string;
  checks: PreflightCheck[];
  dirtyFiles: string[];
  activeJobs: ActiveJobSummary[];
  activeRenders: number;
  blockingReason: string | null;
  manualCommand: string;
}

export type SelfUpdateStepStatus = 'pending' | 'active' | 'done' | 'failed';

export interface SelfUpdateStep {
  id: string;
  label: string;
  status: SelfUpdateStepStatus;
}

export type SelfUpdateStateName =
  | 'idle'
  | 'pending_restart'
  | 'updating'
  | 'restarting'
  | 'completed'
  | 'failed';

export interface SelfUpdateStatusResponse {
  updateId?: string;
  state: SelfUpdateStateName;
  step: string;
  message: string;
  currentVersion: string;
  targetVersion: string | null;
  targetTag: string | null;
  mode?: string;
  initialCommit?: string;
  rolledBack: boolean;
  error: string | null;
  updatedAt?: string;
  steps: SelfUpdateStep[];
}

export type SelfUpdateOutcome = 'completed' | 'failed' | 'blocked' | 'timeout';

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export type SelfUpdateFetcher = (
  url: string,
  init?: RequestInit
) => Promise<FetchResponseLike>;

export interface UseSelfUpdateOptions {
  apiBase?: string;
  fetcher?: SelfUpdateFetcher;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  devServerUrl?: string;
  devServerProbe?: (url: string) => Promise<boolean>;
  reloadPage?: () => void;
  onToast?: (message: string, type: ToastType) => void;
  sleep?: (ms: number) => Promise<void>;
}

export interface ReconcileStatusOptions {
  onCompleted?: () => Promise<void> | void;
}

const DEFAULT_POLL_INTERVAL_MS = 750;
const DEFAULT_MAX_WAIT_MS = 180_000;
const VALID_STATES: ReadonlySet<string> = new Set([
  'idle',
  'pending_restart',
  'updating',
  'restarting',
  'completed',
  'failed'
]);

function useSafeState<T>(key: string, init: () => T): Ref<T> {
  try {
    return useState<T>(key, init);
  } catch {
    return ref(init()) as Ref<T>;
  }
}

async function defaultFetcher(
  url: string,
  init?: RequestInit
): Promise<FetchResponseLike> {
  return await fetch(url, init);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function defaultReloadPage(): void {
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload();
  }
}

function resolveDefaultDevServerUrl(): string | null {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/`;
  }
  return null;
}

async function defaultDevServerProbe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPreflightResponse(
  value: unknown
): value is SelfUpdatePreflightResponse {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.supported === 'boolean' &&
    typeof value.canUpdate === 'boolean' &&
    typeof value.targetVersion === 'string' &&
    Array.isArray(value.checks)
  );
}

function isStatusResponse(value: unknown): value is SelfUpdateStatusResponse {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.state === 'string' &&
    VALID_STATES.has(value.state) &&
    typeof value.step === 'string'
  );
}

function extractDetailMessage(payload: unknown, fallback: string): string {
  if (isObjectRecord(payload) && typeof payload.detail === 'string') {
    return payload.detail;
  }
  return fallback;
}

function formatUpdateFailureMessage(payload: SelfUpdateStatusResponse): string {
  return (
    payload.error ||
    payload.message ||
    'Self-update failed and was rolled back.'
  );
}

export function buildTagManualCommand(version: string): string {
  const clean = normalizeVersion(version);
  return clean
    ? `git fetch origin --tags && git merge --ff-only v${clean} && python run.py`
    : 'git fetch origin --tags && python run.py';
}

export function useSelfUpdate(options: UseSelfUpdateOptions = {}) {
  const preflight = useSafeState<SelfUpdatePreflightResponse | null>(
    'yonru_self_update_preflight',
    () => null
  );
  const preflightError = useSafeState<string | null>(
    'yonru_self_update_preflight_error',
    () => null
  );
  const isCheckingPreflight = useSafeState<boolean>(
    'yonru_self_update_checking_preflight',
    () => false
  );
  const status = useSafeState<SelfUpdateStatusResponse | null>(
    'yonru_self_update_status',
    () => null
  );
  const isUpdating = useSafeState<boolean>(
    'yonru_self_update_updating',
    () => false
  );
  const isReconnecting = useSafeState<boolean>(
    'yonru_self_update_reconnecting',
    () => false
  );
  const updateError = useSafeState<string | null>(
    'yonru_self_update_error',
    () => null
  );

  // Capture Nuxt notifier synchronously during setup so async post-mount callbacks keep access to useState
  let defaultShowToast:
    ((message: string, type?: ToastType) => void) | undefined;
  if (!options.onToast) {
    try {
      defaultShowToast = useAppNotifier().showToast;
    } catch {
      // ignore outside setup/Nuxt context
    }
  }

  const apiBase = options.apiBase ?? resolveApiBase();
  const fetcher = options.fetcher ?? defaultFetcher;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const sleep = options.sleep ?? defaultSleep;
  const reloadPage = options.reloadPage ?? defaultReloadPage;
  const devProbe = options.devServerProbe ?? defaultDevServerProbe;

  function emitToast(message: string, type: ToastType): void {
    const handler = options.onToast ?? defaultShowToast;
    handler?.(message, type);
  }

  function resetState(): void {
    preflight.value = null;
    preflightError.value = null;
    isCheckingPreflight.value = false;
    status.value = null;
    isUpdating.value = false;
    isReconnecting.value = false;
    updateError.value = null;
  }

  async function runPreflight(
    targetVersion: string
  ): Promise<SelfUpdatePreflightResponse | null> {
    const clean = normalizeVersion(targetVersion);
    isCheckingPreflight.value = true;
    preflightError.value = null;
    updateError.value = null;
    try {
      const url = `${apiBase}/api/self-update/preflight?target_version=${encodeURIComponent(clean)}`;
      const res = await fetcher(url, { cache: 'no-store' });
      const payload = await res.json();
      if (!res.ok) {
        preflightError.value = extractDetailMessage(
          payload,
          `Pre-flight check failed (${res.status}).`
        );
        return null;
      }
      if (!isPreflightResponse(payload)) {
        preflightError.value = 'Unexpected pre-flight response from backend.';
        return null;
      }
      preflight.value = payload;
      return payload;
    } catch {
      preflightError.value =
        'Unable to reach the local Yonru backend for pre-flight checks.';
      return null;
    } finally {
      isCheckingPreflight.value = false;
    }
  }

  async function waitForDevServerIfNeeded(
    statusData: SelfUpdateStatusResponse,
    deadlineMs: number
  ): Promise<boolean> {
    if (statusData.mode !== 'dev') {
      return true;
    }
    const devUrl = options.devServerUrl ?? resolveDefaultDevServerUrl();
    if (!devUrl) {
      return true;
    }
    while (Date.now() < deadlineMs) {
      if (await devProbe(devUrl)) {
        return true;
      }
      await sleep(pollIntervalMs);
    }
    return false;
  }

  async function pollUntilTerminal(
    expectedTargetVersion: string
  ): Promise<SelfUpdateOutcome> {
    const normalizedTarget = normalizeVersion(expectedTargetVersion);
    const deadlineMs = Date.now() + maxWaitMs;
    isUpdating.value = true;

    while (Date.now() < deadlineMs) {
      try {
        const res = await fetcher(`${apiBase}/api/self-update/status`, {
          cache: 'no-store'
        });

        if (res.status === 503) {
          isReconnecting.value = true;
          await sleep(pollIntervalMs);
          continue;
        }

        if (res.ok) {
          isReconnecting.value = false;
          const rawPayload = await res.json();
          if (isStatusResponse(rawPayload)) {
            status.value = rawPayload;

            if (rawPayload.state === 'failed') {
              isUpdating.value = false;
              updateError.value = formatUpdateFailureMessage(rawPayload);
              return 'failed';
            }

            if (rawPayload.state === 'completed') {
              const bootedVersion = normalizeVersion(
                rawPayload.currentVersion || ''
              );
              const targetMatches =
                !normalizedTarget || bootedVersion === normalizedTarget;

              if (targetMatches) {
                const devReady = await waitForDevServerIfNeeded(
                  rawPayload,
                  deadlineMs
                );
                if (!devReady) {
                  isUpdating.value = false;
                  updateError.value =
                    'Update installed, but the development frontend server took too long to restart. Please reload manually.';
                  return 'timeout';
                }
                isUpdating.value = false;
                reloadPage();
                return 'completed';
              }
            }
          }
        }
      } catch {
        // Expected while launcher restarts FastAPI and shuts down child servers
        isReconnecting.value = true;
      }

      await sleep(pollIntervalMs);
    }

    isUpdating.value = false;
    isReconnecting.value = false;
    updateError.value =
      'Timed out waiting for Yonru to finish restarting. Refresh the page to check the current version.';
    return 'timeout';
  }

  async function startUpdate(
    targetVersion: string
  ): Promise<SelfUpdateOutcome> {
    const clean = normalizeVersion(targetVersion);
    updateError.value = null;
    isReconnecting.value = false;

    try {
      const res = await fetcher(`${apiBase}/api/self-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion: clean })
      });
      const payload = await res.json();

      if (!res.ok) {
        if (isObjectRecord(payload) && isPreflightResponse(payload.preflight)) {
          preflight.value = payload.preflight;
        }
        updateError.value = extractDetailMessage(
          payload,
          `Update could not start (${res.status}).`
        );
        return 'blocked';
      }

      if (isStatusResponse(payload)) {
        status.value = payload;
      }
    } catch {
      updateError.value = 'Unable to contact backend to start self-update.';
      return 'blocked';
    }

    return await pollUntilTerminal(clean);
  }

  async function acknowledgeUpdate(): Promise<void> {
    try {
      const res = await fetcher(`${apiBase}/api/self-update/acknowledge`, {
        method: 'POST'
      });
      if (res.ok) {
        const payload = await res.json();
        if (isStatusResponse(payload)) {
          status.value = payload;
        }
      }
    } catch {
      // best-effort reset
    }
  }

  async function dismissFailure(): Promise<void> {
    updateError.value = null;
    await acknowledgeUpdate();
  }

  async function reconcileStatusOnMount(
    reconcileOptions: ReconcileStatusOptions = {}
  ): Promise<void> {
    try {
      const res = await fetcher(`${apiBase}/api/self-update/status`, {
        cache: 'no-store'
      });
      if (!res.ok) {
        return;
      }
      const rawPayload = await res.json();
      if (!isStatusResponse(rawPayload)) {
        return;
      }
      status.value = rawPayload;

      if (rawPayload.state === 'completed') {
        const versionTag =
          rawPayload.targetTag ||
          (rawPayload.targetVersion
            ? `v${normalizeVersion(rawPayload.targetVersion)}`
            : '');
        emitToast(
          `Updated Yonru Clip${versionTag ? ` to ${versionTag}` : ''}.`,
          'success'
        );
        await reconcileOptions.onCompleted?.();
        await acknowledgeUpdate();
        return;
      }

      if (rawPayload.state === 'failed') {
        updateError.value = formatUpdateFailureMessage(rawPayload);
        return;
      }

      if (
        rawPayload.state === 'pending_restart' ||
        rawPayload.state === 'updating' ||
        rawPayload.state === 'restarting'
      ) {
        await pollUntilTerminal(rawPayload.targetVersion ?? '');
      }
    } catch {
      // ignore if backend not ready yet
    }
  }

  return {
    preflight,
    preflightError,
    isCheckingPreflight,
    status,
    isUpdating,
    isReconnecting,
    updateError,
    runPreflight,
    startUpdate,
    acknowledgeUpdate,
    dismissFailure,
    reconcileStatusOnMount,
    resetState
  };
}
