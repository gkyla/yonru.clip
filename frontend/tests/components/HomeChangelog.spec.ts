import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import HomeChangelog from '../../app/components/HomeChangelog.vue';
import type { ChangelogItem } from '../../app/composables/useChangelog';
import type { RemoteReleaseDto } from '../../app/composables/useReleaseUpdates';

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

    // Informational update banner
    const banner = wrapper.find('[data-testid="available-update-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('v0.4.0');
    expect(banner.text()).toContain('git pull && python run.py');
    expect(
      banner
        .find(
          'a[href="https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0"]'
        )
        .exists()
    ).toBe(true);

    // Copy button copies command and announces status without disabling button
    const copyBtn = wrapper.find('[data-testid="copy-update-command-btn"]');
    expect(copyBtn.exists()).toBe(true);
    await copyBtn.trigger('click');
    await flushPromises();

    expect(writeText).toHaveBeenCalledWith('git pull && python run.py');
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
});
