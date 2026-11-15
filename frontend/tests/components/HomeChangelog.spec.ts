import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import HomeChangelog from '../../app/components/HomeChangelog.vue';
import type { ChangelogItem } from '../../app/composables/useChangelog';
import type { RemoteReleaseDto } from '../../app/composables/useReleaseUpdates';
import type {
  SelfUpdatePreflightResponse,
  SelfUpdateStatusResponse
} from '../../app/composables/useSelfUpdate';

const mockReleasesData: ChangelogItem[] = [
  {
    version: '0.3.0',
    date: '2026-11-13',
    title: 'Multi-Track NLE Timeline & Audio Library',
    isInstalled: true,
    isAvailableUpdate: false,
    source: 'local',
    githubReleaseUrl: 'https://github.com/gkyla/yonru.clip/releases/tag/v0.3.0'
  },
  {
    version: '0.1.0',
    date: '2026-10-21',
    title: 'Welcome to Yonru Clip',
    badge: 'Initial Release',
    isInstalled: false,
    isAvailableUpdate: false,
    source: 'local',
    githubReleaseUrl: 'https://github.com/gkyla/yonru.clip/releases/tag/v0.1.0'
  }
];

const mockReleases = ref<ChangelogItem[]>(mockReleasesData);
const mockStatus = ref<'idle' | 'pending' | 'success' | 'error'>('success');
const mockInstalledVersion = ref('0.3.0');
const mockHasAvailableUpdate = ref(false);
const mockLatestAvailableVersion = ref<string | null>(null);
const mockLatestAvailableRelease = ref<RemoteReleaseDto | null>(null);
const mockIsRefreshing = ref(false);
const mockIsOffline = ref(false);
const mockRemoteError = ref<string | null>(null);
const mockFetchReleases = vi.fn();
const mockRefreshReleases = vi.fn();
const mockShowToast = vi.fn();

const mockPreflight = ref<SelfUpdatePreflightResponse | null>(null);
const mockPreflightError = ref<string | null>(null);
const mockIsCheckingPreflight = ref(false);
const mockUpdateStatus = ref<SelfUpdateStatusResponse | null>(null);
const mockIsUpdating = ref(false);
const mockIsReconnecting = ref(false);
const mockUpdateError = ref<string | null>(null);
const mockRunPreflight = vi.fn();
const mockStartUpdate = vi.fn();
const mockDismissFailure = vi.fn();
const mockReconcileStatusOnMount = vi.fn();

vi.mock('../../app/composables/useChangelog', () => ({
  useChangelog: () => ({
    releases: mockReleases,
    status: mockStatus,
    installedVersion: mockInstalledVersion,
    hasAvailableUpdate: mockHasAvailableUpdate,
    latestAvailableVersion: mockLatestAvailableVersion,
    latestAvailableRelease: mockLatestAvailableRelease,
    isRefreshing: mockIsRefreshing,
    isOffline: mockIsOffline,
    remoteError: mockRemoteError,
    fetchReleases: mockFetchReleases,
    refreshReleases: mockRefreshReleases
  })
}));

vi.mock('../../app/composables/useSelfUpdate', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../../app/composables/useSelfUpdate')
    >();
  return {
    ...actual,
    useSelfUpdate: () => ({
      preflight: mockPreflight,
      preflightError: mockPreflightError,
      isCheckingPreflight: mockIsCheckingPreflight,
      status: mockUpdateStatus,
      isUpdating: mockIsUpdating,
      isReconnecting: mockIsReconnecting,
      updateError: mockUpdateError,
      runPreflight: mockRunPreflight,
      startUpdate: mockStartUpdate,
      acknowledgeUpdate: vi.fn(),
      dismissFailure: mockDismissFailure,
      reconcileStatusOnMount: mockReconcileStatusOnMount,
      resetState: vi.fn()
    })
  };
});

vi.mock('../../app/composables/useAppNotifier', () => ({
  useAppNotifier: () => ({
    toast: ref(null),
    showToast: mockShowToast,
    dismissToast: vi.fn()
  })
}));

const defaultStubs = {
  Icon: true,
  NuxtIcon: true,
  ContentRenderer: {
    template: '<div class="content-renderer-stub">Release body content</div>'
  }
};

describe('HomeChangelog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReleases.value = [...mockReleasesData];
    mockStatus.value = 'success';
    mockInstalledVersion.value = '0.3.0';
    mockHasAvailableUpdate.value = false;
    mockLatestAvailableVersion.value = null;
    mockLatestAvailableRelease.value = null;
    mockIsRefreshing.value = false;
    mockIsOffline.value = false;
    mockRemoteError.value = null;
    mockPreflight.value = null;
    mockPreflightError.value = null;
    mockIsCheckingPreflight.value = false;
    mockUpdateStatus.value = null;
    mockIsUpdating.value = false;
    mockIsReconnecting.value = false;
    mockUpdateError.value = null;
    mockRunPreflight.mockResolvedValue(null);
    mockStartUpdate.mockResolvedValue('completed');
    mockDismissFailure.mockResolvedValue(undefined);
    mockReconcileStatusOnMount.mockResolvedValue(undefined);
  });

  it('renders header with plain inline installed version, refresh button, and GitHub releases link', () => {
    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    expect(wrapper.find('h1').text()).toBe('Changelog');
    const headerVersion = wrapper.find(
      '[data-testid="changelog-installed-version"]'
    );
    expect(headerVersion.exists()).toBe(true);
    expect(headerVersion.text()).toBe('(installed v0.3.0)');
    expect(headerVersion.classes().some(cls => cls.startsWith('bg-'))).toBe(
      false
    );
    expect(headerVersion.classes().some(cls => cls.startsWith('border'))).toBe(
      false
    );
    expect(
      wrapper
        .find('a[href="https://github.com/gkyla/yonru.clip/releases"]')
        .exists()
    ).toBe(true);
    expect(mockFetchReleases).toHaveBeenCalled();
  });

  it('triggers manual refresh when Check for Updates button is clicked', async () => {
    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    const refreshBtn = wrapper.find('[data-testid="changelog-refresh-btn"]');
    expect(refreshBtn.exists()).toBe(true);
    await refreshBtn.trigger('click');

    expect(mockRefreshReleases).toHaveBeenCalledTimes(1);
  });

  it('renders Available Update banner with copyable command, remote markdown body, and Installed badge', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    mockHasAvailableUpdate.value = true;
    mockLatestAvailableVersion.value = '0.4.0';
    mockLatestAvailableRelease.value = {
      version: '0.4.0',
      title: 'Hybrid Release Discovery',
      date: '2026-11-16',
      body: '### Features\n\n- **Changelog**: Remote release checks',
      githubReleaseUrl:
        'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
    };
    mockReleases.value = [
      {
        version: '0.4.0',
        date: '2026-11-16',
        title: 'Hybrid Release Discovery',
        badge: 'Available Update',
        isAvailableUpdate: true,
        isInstalled: false,
        source: 'remote',
        githubReleaseUrl:
          'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0',
        rawBody: '### Features\n\n- **Changelog**: Remote release checks'
      },
      ...mockReleasesData
    ];

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    // Informational update banner with Update Now button and collapsible tag-exact fallback
    const banner = wrapper.find('[data-testid="available-update-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('v0.4.0');
    expect(wrapper.find('[data-testid="update-now-btn"]').exists()).toBe(true);
    expect(banner.text()).toContain(
      'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
    );
    expect(
      banner
        .find(
          'a[href="https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0"]'
        )
        .exists()
    ).toBe(true);

    // Copy button copies tag-exact command and announces status without disabling button
    const copyBtn = wrapper.find('[data-testid="copy-update-command-btn"]');
    expect(copyBtn.exists()).toBe(true);
    await copyBtn.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith(
      'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
    );
    expect(copyBtn.attributes('disabled')).toBeUndefined();
    const statusRegion = wrapper.find('[data-testid="copy-command-status"]');
    expect(statusRegion.attributes('role')).toBe('status');
    expect(statusRegion.text()).toContain('Copied');

    // Timeline cards
    const articles = wrapper.findAll('article');
    expect(articles.length).toBe(3);

    // Remote card uses ChangelogMarkdownRenderer (not ContentRenderer stub) and shows Available Update
    expect(articles[0]?.text()).toContain('v0.4.0');
    expect(articles[0]?.text()).toContain('Available Update');
    expect(articles[0]?.text()).toContain('Remote release checks');
    expect(articles[0]?.find('.content-renderer-stub').exists()).toBe(false);

    // Highest local card shows Installed badge and renders via ContentRenderer
    expect(articles[1]?.text()).toContain('v0.3.0');
    expect(articles[1]?.text()).toContain('Installed');
    expect(articles[1]?.find('.content-renderer-stub').exists()).toBe(true);

    // Older local card retains Initial Release badge
    expect(articles[2]?.text()).toContain('v0.1.0');
    expect(articles[2]?.text()).toContain('Initial Release');
  });

  it('announces Copy failed in role=status when clipboard write rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    mockHasAvailableUpdate.value = true;
    mockLatestAvailableVersion.value = '0.4.0';
    mockLatestAvailableRelease.value = {
      version: '0.4.0',
      title: 'Hybrid Release Discovery',
      date: '2026-11-16',
      githubReleaseUrl:
        'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
    };

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    const copyBtn = wrapper.find('[data-testid="copy-update-command-btn"]');
    await copyBtn.trigger('click');
    await flushPromises();

    const statusRegion = wrapper.find('[data-testid="copy-command-status"]');
    expect(statusRegion.text()).toContain('Copy failed');
  });

  it('shows non-blocking offline notice while keeping local releases visible', () => {
    mockIsOffline.value = true;
    mockRemoteError.value = 'GitHub API rate limit reached (403).';

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    const notice = wrapper.find('[data-testid="remote-offline-notice"]');
    expect(notice.exists()).toBe(true);
    expect(notice.text()).toContain('GitHub API rate limit reached (403).');
    expect(wrapper.findAll('article').length).toBe(2);
  });

  it('renders error state with retry action when status is error', async () => {
    mockStatus.value = 'error';
    mockReleases.value = [];

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    expect(wrapper.text()).toContain('Failed to Load Changelog');
    const retryBtn = wrapper.find('[data-testid="changelog-retry-btn"]');
    expect(retryBtn.exists()).toBe(true);
    await retryBtn.trigger('click');
    expect(mockRefreshReleases).toHaveBeenCalledTimes(1);
  });

  it('renders empty state when releases array is empty', () => {
    mockReleases.value = [];

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    expect(wrapper.text()).toContain('No Releases Found');
    expect(wrapper.text()).toContain(
      'No changelog markdown documents were discovered'
    );
  });

  it('renders loading skeleton when status is pending', () => {
    mockStatus.value = 'pending';

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('opens preflight confirmation dialog when Update Now is clicked and starts update on confirm', async () => {
    mockHasAvailableUpdate.value = true;
    mockLatestAvailableVersion.value = '0.4.0';
    mockLatestAvailableRelease.value = {
      version: '0.4.0',
      title: 'One-Click Updater',
      date: '2026-11-16',
      githubReleaseUrl:
        'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
    };

    const passingPreflight: SelfUpdatePreflightResponse = {
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
        },
        {
          id: 'tag_fast_forward',
          label: 'Tag v0.4.0 verified',
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
    };
    mockPreflight.value = passingPreflight;
    mockRunPreflight.mockResolvedValue(passingPreflight);

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });

    await wrapper.find('[data-testid="update-now-btn"]').trigger('click');
    await flushPromises();

    expect(mockRunPreflight).toHaveBeenCalledWith('0.4.0');
    const dialog = wrapper.find('[data-testid="self-update-dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain('Managed by Yonru Launcher');
    expect(dialog.text()).toContain('Tag v0.4.0 verified');

    const confirmBtn = wrapper.find('[data-testid="confirm-self-update-btn"]');
    expect(confirmBtn.exists()).toBe(true);
    expect(confirmBtn.attributes('disabled')).toBeUndefined();
    await confirmBtn.trigger('click');
    await flushPromises();

    expect(mockStartUpdate).toHaveBeenCalledWith('0.4.0');
  });

  it('disables confirm CTA and auto-expands manual fallback when preflight blocks update', async () => {
    mockHasAvailableUpdate.value = true;
    mockLatestAvailableVersion.value = '0.4.0';
    mockLatestAvailableRelease.value = {
      version: '0.4.0',
      title: 'One-Click Updater',
      date: '2026-11-16',
      githubReleaseUrl:
        'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
    };

    const blockedPreflight: SelfUpdatePreflightResponse = {
      supported: false,
      canUpdate: false,
      currentVersion: '0.3.0',
      targetVersion: '0.4.0',
      targetTag: 'v0.4.0',
      mode: 'standalone',
      branch: 'main',
      initialCommit: 'abc1234',
      checks: [
        {
          id: 'supervisor',
          label: 'Managed by Yonru Launcher',
          passed: false,
          detail: 'Run via python run.py to enable automatic restarts.'
        }
      ],
      dirtyFiles: ['backend/main.py', 'run.py'],
      activeJobs: [],
      activeRenders: 0,
      blockingReason: 'Run via python run.py to enable automatic restarts.',
      manualCommand:
        'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
    };
    mockPreflight.value = blockedPreflight;
    mockRunPreflight.mockResolvedValue(blockedPreflight);

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });
    await flushPromises();

    const details = wrapper.find('[data-testid="manual-update-details"]');
    expect(details.attributes('open')).toBeDefined();

    await wrapper.find('[data-testid="update-now-btn"]').trigger('click');
    await flushPromises();

    const confirmBtn = wrapper.find('[data-testid="confirm-self-update-btn"]');
    expect(confirmBtn.attributes('disabled')).toBeDefined();
    const dialog = wrapper.find('[data-testid="self-update-dialog"]');
    expect(dialog.text()).toContain(
      'Run via python run.py to enable automatic restarts.'
    );
    const dirtyList = wrapper.find('[data-testid="preflight-dirty-files"]');
    expect(dirtyList.exists()).toBe(true);
    expect(dirtyList.text()).toContain('backend/main.py');
    const modalFallback = wrapper.find('[data-testid="modal-manual-fallback"]');
    expect(modalFallback.exists()).toBe(true);
    expect(modalFallback.text()).toContain(
      'git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py'
    );
  });

  it('renders live stepper during update, keeps dialog locked, and dismisses rollback failure', async () => {
    mockHasAvailableUpdate.value = true;
    mockLatestAvailableVersion.value = '0.4.0';
    mockLatestAvailableRelease.value = {
      version: '0.4.0',
      title: 'One-Click Updater',
      date: '2026-11-16',
      githubReleaseUrl:
        'https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0'
    };
    mockIsUpdating.value = true;
    mockUpdateStatus.value = {
      state: 'updating',
      step: 'building_frontend',
      message: 'Building production web interface...',
      currentVersion: '0.3.0',
      targetVersion: '0.4.0',
      targetTag: 'v0.4.0',
      rolledBack: false,
      error: null,
      steps: [
        { id: 'stopping_services', label: 'Stopping services', status: 'done' },
        {
          id: 'building_frontend',
          label: 'Building interface',
          status: 'active'
        }
      ]
    };

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });
    await flushPromises();

    const dialog = wrapper.find('[data-testid="self-update-dialog"]');
    expect(dialog.text()).toContain('Building production web interface...');
    expect(dialog.text()).toContain('Stopping services');
    expect(dialog.attributes('closedby')).toBe('none');

    // Simulate rollback failure after restart
    mockIsUpdating.value = false;
    mockUpdateStatus.value = {
      state: 'failed',
      step: 'building_frontend',
      message: 'Update to v0.4.0 failed and was rolled back.',
      currentVersion: '0.3.0',
      targetVersion: '0.4.0',
      targetTag: 'v0.4.0',
      rolledBack: true,
      error: 'Vite build syntax error',
      steps: [
        {
          id: 'building_frontend',
          label: 'Building interface',
          status: 'failed'
        }
      ]
    };
    mockUpdateError.value = 'Vite build syntax error';
    await flushPromises();

    expect(dialog.text()).toContain('Vite build syntax error');
    const dismissBtn = wrapper.find('[data-testid="dismiss-self-update-btn"]');
    expect(dismissBtn.exists()).toBe(true);
    await dismissBtn.trigger('click');
    await flushPromises();

    expect(mockDismissFailure).toHaveBeenCalledTimes(1);
  });

  it('unlocks dialog and renders timeout error recovery when verification times out', async () => {
    mockHasAvailableUpdate.value = true;
    mockLatestAvailableVersion.value = '0.4.0';
    mockIsUpdating.value = false;
    mockUpdateStatus.value = {
      state: 'restarting',
      step: 'restarting',
      message: 'Restarting Yonru...',
      currentVersion: '0.3.0',
      targetVersion: '0.4.0',
      targetTag: 'v0.4.0',
      rolledBack: false,
      error: null,
      steps: []
    };
    mockUpdateError.value =
      'Timed out waiting for Yonru to finish restarting. Refresh the page to check the current version.';

    const wrapper = mount(HomeChangelog, {
      global: { stubs: defaultStubs }
    });
    await flushPromises();

    const dialog = wrapper.find('[data-testid="self-update-dialog"]');
    expect(dialog.attributes('closedby')).toBe('closerequest');
    expect(dialog.text()).toContain(
      'Timed out waiting for Yonru to finish restarting.'
    );

    const dismissBtn = wrapper.find('[data-testid="dismiss-self-update-btn"]');
    expect(dismissBtn.exists()).toBe(true);
    await dismissBtn.trigger('click');
    await flushPromises();

    expect(mockDismissFailure).toHaveBeenCalledTimes(1);
  });
});
