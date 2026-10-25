import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import changelog from '../../app/pages/changelog.vue';

// Mock useHead
vi.stubGlobal('useHead', vi.fn());

describe('Changelog Page', () => {
  it('renders successfully with HomeChangelog stubbed', () => {
    const wrapper = mount(changelog, {
      global: {
        stubs: {
          NuxtLayout: {
            template: '<div><slot /></div>'
          },
          HomeChangelog: {
            template:
              '<div class="home-changelog-stub">HomeChangelog Stub</div>'
          }
        }
      }
    });
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.home-changelog-stub').exists()).toBe(true);
  });
});
