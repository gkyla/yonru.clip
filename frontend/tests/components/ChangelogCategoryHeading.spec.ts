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
  it('renders Features heading with chef emoji and solid white text', () => {
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
    const emoji = wrapper.find('.category-emoji');
    expect(emoji.exists()).toBe(true);
    expect(emoji.text()).toBe('👨‍🍳');
    expect(wrapper.classes()).toContain('text-xl');
    expect(wrapper.classes()).toContain('sm:text-2xl');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Features');
    expect(title.classes()).toContain('text-white');
    expect(wrapper.html()).not.toContain('bg-gradient-to-r');
  });

  it('renders Improvements heading with wrench emoji and solid white text', () => {
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
    const emoji = wrapper.find('.category-emoji');
    expect(emoji.exists()).toBe(true);
    expect(emoji.text()).toBe('🔧');
    expect(wrapper.classes()).toContain('text-xl');
    expect(wrapper.classes()).toContain('sm:text-2xl');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Improvements');
    expect(title.classes()).toContain('text-white');
    expect(wrapper.html()).not.toContain('bg-gradient-to-r');
  });

  it('renders Bug Fixes heading with ladybug emoji and solid white text', () => {
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
    const emoji = wrapper.find('.category-emoji');
    expect(emoji.exists()).toBe(true);
    expect(emoji.text()).toBe('🐞');
    expect(wrapper.classes()).toContain('text-xl');
    expect(wrapper.classes()).toContain('sm:text-2xl');
    const title = wrapper.find('.changelog-category-title');
    expect(title.text()).toBe('Bug Fixes');
    expect(title.classes()).toContain('text-white');
    expect(wrapper.html()).not.toContain('bg-gradient-to-r');
  });

  it('renders generic fallback heading with solid white text and without icon or emoji', () => {
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
    expect(wrapper.find('.category-emoji').exists()).toBe(false);
  });
});
