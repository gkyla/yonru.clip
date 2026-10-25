import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import HomeChangelog from '../../app/components/HomeChangelog.vue';
import type { ChangelogItem } from '../../app/composables/useChangelog';

const mockReleasesData: ChangelogItem[] = [
  {
    version: '0.1.0',
    date: '2026-10-21',
    title: 'Welcome to Yonru Clip',
    badge: 'Initial Release',
    isLatest: true,
    githubReleaseUrl: 'https://github.com/gkyla/yonru.clip/releases/tag/v0.1.0'
  },
  {
    version: '0.0.9',
    date: '2026-10-10',
    title: 'Pre-Alpha Internal Prototype',
    badge: 'Archived',
    isLatest: false,
    githubReleaseUrl: 'https://github.com/gkyla/yonru.clip/releases/tag/v0.0.9'
  }
];

const mockReleases = ref<ChangelogItem[]>(mockReleasesData);
const mockStatus = ref<'idle' | 'pending' | 'success' | 'error'>('success');
const mockFetchReleases = vi.fn();

vi.mock('../../app/composables/useChangelog', () => ({
  useChangelog: () => ({
    releases: mockReleases,
    status: mockStatus,
    fetchReleases: mockFetchReleases
  })
}));

describe('HomeChangelog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReleases.value = [...mockReleasesData];
    mockStatus.value = 'success';
  });

  it('renders the header title and description', async () => {
    const wrapper = mount(HomeChangelog, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          ContentRenderer: {
            template:
              '<div class="content-renderer-stub">Release body content</div>'
          }
        }
      }
    });

    expect(wrapper.find('h1').text()).toContain('Changelog');
    expect(wrapper.text()).toContain(
      'Follow the progress and new capabilities of Yonru Clip'
    );
    expect(
      wrapper
        .find('a[href="https://github.com/gkyla/yonru.clip/releases"]')
        .exists()
    ).toBe(true);
    expect(mockFetchReleases).toHaveBeenCalled();
  });

  it('renders the releases feed with version chips, badges, and dates', async () => {
    const wrapper = mount(HomeChangelog, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          ContentRenderer: {
            template:
              '<div class="content-renderer-stub">Release body content</div>'
          }
        }
      }
    });

    const articles = wrapper.findAll('article');
    expect(articles.length).toBe(2);

    // First release (v0.1.0)
    expect(articles[0].text()).toContain('v0.1.0');
    expect(articles[0].text()).toContain('Initial Release');
    expect(articles[0].text()).toContain('Welcome to Yonru Clip');
    expect(
      articles[0]
        .find(
          'a[href="https://github.com/gkyla/yonru.clip/releases/tag/v0.1.0"]'
        )
        .exists()
    ).toBe(true);

    // Second release (v0.0.9)
    expect(articles[1].text()).toContain('v0.0.9');
    expect(articles[1].text()).toContain('Archived');
    expect(articles[1].text()).toContain('Pre-Alpha Internal Prototype');
  });

  it('renders empty state when releases array is empty', async () => {
    mockReleases.value = [];

    const wrapper = mount(HomeChangelog, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          ContentRenderer: true
        }
      }
    });

    expect(wrapper.text()).toContain('No Releases Found');
    expect(wrapper.text()).toContain(
      'No changelog markdown documents were discovered'
    );
  });

  it('renders loading skeleton when status is pending', async () => {
    mockStatus.value = 'pending';

    const wrapper = mount(HomeChangelog, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          ContentRenderer: true
        }
      }
    });

    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
