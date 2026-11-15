import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSelfUpdate } from '../../app/composables/useSelfUpdate';

interface MockHttpResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): MockHttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

describe('useSelfUpdate Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      (globalThis as { clearNuxtState?: () => void }).clearNuxtState?.();
    } catch {
      // ignore if outside Nuxt context
    }
    const state = useSelfUpdate();
    state.resetState();
  });

  it('fetches preflight checks for target version and populates preflight state', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        supported: true,
        canUpdate: true,
        currentVersion: '0.3.0',
        targetVersion: '0.4.0',
        targetTag: 'v0.4.0',
        mode: 'production',
        branch: 'main',
        initialCommit: 'abc1234',
        checks: [
          {
            id: 'supervisor',
            label: 'Managed by Yonru Launcher',
            passed: true,
            detail: null
          }
        ],
        dirtyFiles: [],
        activeJobs: [],
        activeRenders: 0,
        blockingReason: null,
        manualCommand:
          'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
      })
    );

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher
    });

    const result = await updater.runPreflight('0.4.0');

    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8765/api/self-update/preflight?target_version=0.4.0',
      expect.objectContaining({ cache: 'no-store' })
    );
    expect(result?.canUpdate).toBe(true);
    expect(updater.preflight.value?.targetTag).toBe('v0.4.0');
    expect(updater.isCheckingPreflight.value).toBe(false);
    expect(updater.preflightError.value).toBeNull();
  });

  it('polls status across transient restart errors, verifies new version and dev server readiness, then reloads', async () => {
    let statusCalls = 0;
    const devProbe = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const reloadPage = vi.fn();

    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/self-update') && init?.method === 'POST') {
        return jsonResponse(
          {
            state: 'pending_restart',
            step: 'stopping_services',
            message: 'Stopping services...',
            currentVersion: '0.3.0',
            targetVersion: '0.4.0',
            targetTag: 'v0.4.0',
            mode: 'dev',
            rolledBack: false,
            error: null,
            steps: []
          },
          202
        );
      }

      if (url.endsWith('/api/self-update/status')) {
        statusCalls += 1;
        if (statusCalls === 1) {
          return jsonResponse({
            state: 'updating',
            step: 'merging_tag',
            message: 'Updating repository to v0.4.0...',
            currentVersion: '0.3.0',
            targetVersion: '0.4.0',
            targetTag: 'v0.4.0',
            mode: 'dev',
            rolledBack: false,
            error: null,
            steps: []
          });
        }
        if (statusCalls === 2) {
          throw new TypeError('Failed to fetch (restarting)');
        }
        if (statusCalls === 3) {
          // Version still old during race; must NOT reload yet
          return jsonResponse({
            state: 'restarting',
            step: 'restarting',
            message: 'Restarting Yonru...',
            currentVersion: '0.3.0',
            targetVersion: '0.4.0',
            targetTag: 'v0.4.0',
            mode: 'dev',
            rolledBack: false,
            error: null,
            steps: []
          });
        }
        return jsonResponse({
          state: 'completed',
          step: 'completed',
          message: 'Updated to v0.4.0.',
          currentVersion: '0.4.0',
          targetVersion: '0.4.0',
          targetTag: 'v0.4.0',
          mode: 'dev',
          rolledBack: false,
          error: null,
          steps: []
        });
      }

      return jsonResponse({}, 404);
    });

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher,
      pollIntervalMs: 1,
      sleep: async () => Promise.resolve(),
      devServerUrl: 'http://localhost:3765',
      devServerProbe: devProbe,
      reloadPage
    });

    const outcome = await updater.startUpdate('0.4.0');

    expect(outcome).toBe('completed');
    expect(statusCalls).toBe(4);
    expect(devProbe).toHaveBeenCalledTimes(2);
    expect(reloadPage).toHaveBeenCalledTimes(1);
    expect(updater.isUpdating.value).toBe(false);
  });

  it('captures rollback failure and preserves error without reloading', async () => {
    let statusCalls = 0;
    const reloadPage = vi.fn();

    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/self-update') && init?.method === 'POST') {
        return jsonResponse(
          {
            state: 'pending_restart',
            step: 'stopping_services',
            message: 'Stopping services...',
            currentVersion: '0.3.0',
            targetVersion: '0.4.0',
            targetTag: 'v0.4.0',
            rolledBack: false,
            error: null,
            steps: []
          },
          202
        );
      }

      if (url.endsWith('/api/self-update/status')) {
        statusCalls += 1;
        return jsonResponse({
          state: 'failed',
          step: 'building_frontend',
          message: 'Update to v0.4.0 failed and was rolled back.',
          currentVersion: '0.3.0',
          targetVersion: '0.4.0',
          targetTag: 'v0.4.0',
          rolledBack: true,
          error: 'Vite build syntax error',
          steps: []
        });
      }

      return jsonResponse({}, 404);
    });

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher,
      pollIntervalMs: 1,
      sleep: async () => Promise.resolve(),
      reloadPage
    });

    const outcome = await updater.startUpdate('0.4.0');

    expect(outcome).toBe('failed');
    expect(statusCalls).toBe(1);
    expect(reloadPage).not.toHaveBeenCalled();
    expect(updater.status.value?.rolledBack).toBe(true);
    expect(updater.updateError.value).toContain('Vite build syntax error');
  });

  it('surfaces 409 trigger rejection cleanly without starting polling', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          detail: 'Cannot self-update while 1 render(s) are active.',
          preflight: {
            supported: true,
            canUpdate: false,
            currentVersion: '0.3.0',
            targetVersion: '0.4.0',
            targetTag: 'v0.4.0',
            mode: 'production',
            branch: 'main',
            initialCommit: 'abc',
            checks: [],
            dirtyFiles: [],
            activeJobs: [],
            activeRenders: 1,
            blockingReason: 'Cannot self-update while 1 render(s) are active.',
            manualCommand:
              'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
          }
        },
        409
      )
    );

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher
    });

    const outcome = await updater.startUpdate('0.4.0');

    expect(outcome).toBe('blocked');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(updater.updateError.value).toContain('1 render(s) are active');
    expect(updater.preflight.value?.canUpdate).toBe(false);
  });

  it('reconciles completed and rolled-back status on mount and acknowledges backend', async () => {
    const onToast = vi.fn();
    const onCompleted = vi.fn();

    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/self-update/status')) {
        return jsonResponse({
          state: 'completed',
          step: 'completed',
          message: 'Updated to v0.4.0.',
          currentVersion: '0.4.0',
          targetVersion: '0.4.0',
          targetTag: 'v0.4.0',
          rolledBack: false,
          error: null,
          steps: []
        });
      }
      if (
        url.endsWith('/api/self-update/acknowledge') &&
        init?.method === 'POST'
      ) {
        return jsonResponse({
          state: 'idle',
          step: 'idle',
          message: '',
          currentVersion: '0.4.0',
          targetVersion: null,
          targetTag: null,
          rolledBack: false,
          error: null,
          steps: []
        });
      }
      return jsonResponse({}, 404);
    });

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher,
      onToast
    });

    await updater.reconcileStatusOnMount({ onCompleted });

    expect(onToast).toHaveBeenCalledWith(
      'Updated Yonru Clip to v0.4.0.',
      'success'
    );
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8765/api/self-update/acknowledge',
      expect.objectContaining({ method: 'POST' })
    );
    expect(updater.status.value?.state).toBe('idle');
  });

  it('surfaces rollback failure on mount until dismissFailure acknowledges backend', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/self-update/status')) {
        return jsonResponse({
          state: 'failed',
          step: 'building_frontend',
          message: 'Update to v0.4.0 failed and was rolled back.',
          currentVersion: '0.3.0',
          targetVersion: '0.4.0',
          targetTag: 'v0.4.0',
          rolledBack: true,
          error: 'Vite build syntax error',
          steps: []
        });
      }
      if (
        url.endsWith('/api/self-update/acknowledge') &&
        init?.method === 'POST'
      ) {
        return jsonResponse({
          state: 'idle',
          step: 'idle',
          message: '',
          currentVersion: '0.3.0',
          targetVersion: null,
          targetTag: null,
          rolledBack: false,
          error: null,
          steps: []
        });
      }
      return jsonResponse({}, 404);
    });

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher
    });

    await updater.reconcileStatusOnMount();
    expect(updater.status.value?.state).toBe('failed');
    expect(updater.status.value?.rolledBack).toBe(true);
    expect(updater.updateError.value).toContain('Vite build syntax error');

    await updater.dismissFailure();
    expect(updater.updateError.value).toBeNull();
    expect(updater.status.value?.state).toBe('idle');
  });

  it('clears stale updateError when runPreflight runs again', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'A self-update is already in progress.' }, 409)
      )
      .mockResolvedValueOnce(
        jsonResponse({
          supported: true,
          canUpdate: true,
          currentVersion: '0.3.0',
          targetVersion: '0.4.0',
          targetTag: 'v0.4.0',
          mode: 'production',
          branch: 'main',
          initialCommit: 'abc',
          checks: [],
          dirtyFiles: [],
          activeJobs: [],
          activeRenders: 0,
          blockingReason: null,
          manualCommand:
            'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
        })
      );

    const updater = useSelfUpdate({
      apiBase: 'http://localhost:8765',
      fetcher
    });

    await updater.startUpdate('0.4.0');
    expect(updater.updateError.value).toContain('already in progress');

    await updater.runPreflight('0.4.0');
    expect(updater.updateError.value).toBeNull();
    expect(updater.preflight.value?.canUpdate).toBe(true);
  });
});
