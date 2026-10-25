import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ChangelogCategoryHeading from '../../app/components/ChangelogCategoryHeading.vue';

const IconStub = {
  props: ['name'],
  template: '<span class="icon-stub" :data-icon="name"></span>'
};

const defaultStubs = {
  Icon: IconStub,
  NuxtIcon: IconStub
};

describe('ChangelogCategoryHeading Component', () => {
  it('renders Features heading with sparkles icon and solid emerald text', () => {
    const wrapper = mount(ChangelogCategoryHeading, {
      props: {
        id: 'features'
      },
      slots: {
        default: 'Features'
      },
      global: {
        stubs: defaultStubs
      }
    });

    expect(wrapper.text()).toContain('Features');
    const icon = wrapper.find('.icon-stub');
    expect(icon.exists()).toBe(true);
    expect(icon.attributes('data-icon')).toBe('lucide:sparkles');
    expect(wrapper.html()).toContain('border-emerald-500/30');
    expect(wrapper.html()).not.toContain('bg-emerald-500');
    expect(wrapper.classes()).toContain('text-lg');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Features');
    expect(title.classes()).toContain('text-emerald-400');
    expect(wrapper.html()).not.toContain('bg-gradient-to-r');
  });

  it('renders Improvements heading with wrench icon and solid amber text', () => {
    const wrapper = mount(ChangelogCategoryHeading, {
      props: {
        id: 'improvements'
      },
      slots: {
        default: 'Improvements'
      },
      global: {
        stubs: defaultStubs
      }
    });

    expect(wrapper.text()).toContain('Improvements');
    const icon = wrapper.find('.icon-stub');
    expect(icon.exists()).toBe(true);
    expect(icon.attributes('data-icon')).toBe('lucide:wrench');
    expect(wrapper.html()).toContain('border-amber-500/30');
    expect(wrapper.html()).not.toContain('bg-amber-500');
    expect(wrapper.classes()).toContain('text-lg');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Improvements');
    expect(title.classes()).toContain('text-amber-400');
    expect(wrapper.html()).not.toContain('bg-gradient-to-r');
  });

  it('renders Bug Fixes heading with bug icon and solid rose text', () => {
    const wrapper = mount(ChangelogCategoryHeading, {
      props: {
        id: 'bug-fixes'
      },
      slots: {
        default: 'Bug Fixes'
      },
      global: {
        stubs: defaultStubs
      }
    });

    expect(wrapper.text()).toContain('Bug Fixes');
    const icon = wrapper.find('.icon-stub');
    expect(icon.exists()).toBe(true);
    expect(icon.attributes('data-icon')).toBe('lucide:bug');
    expect(wrapper.html()).toContain('border-rose-500/30');
    expect(wrapper.html()).not.toContain('bg-rose-500');
    expect(wrapper.classes()).toContain('text-lg');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Bug Fixes');
    expect(title.classes()).toContain('text-rose-400');
    expect(wrapper.html()).not.toContain('bg-gradient-to-r');
  });

  it('renders generic fallback heading with solid white text and without icon', () => {
    const wrapper = mount(ChangelogCategoryHeading, {
      props: {
        id: 'overview'
      },
      slots: {
        default: 'Overview'
      },
      global: {
        stubs: defaultStubs
      }
    });

    expect(wrapper.text()).toContain('Overview');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Overview');
    expect(title.classes()).toContain('text-white');
    expect(wrapper.find('.icon-stub').exists()).toBe(false);
  });
});
