// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PromptTemplateList from '../../../app/components/prompts/PromptTemplateList.vue';

describe('PromptTemplateList Component', () => {
  const samplePrompts = [
    {
      id: 'p-1',
      name: 'Podcast Intro Hooks',
      suitableFor: ['podcast', 'comedy', 'humor', 'talkshow']
    },
    {
      id: 'p-2',
      name: 'Tutorial Explainer',
      suitableFor: ['tech', 'education']
    }
  ];

  it('renders search input and prompt items', () => {
    const wrapper = mount(PromptTemplateList, {
      props: {
        prompts: samplePrompts,
        selectedId: 'p-1',
        searchQuery: ''
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    expect(wrapper.find('input[placeholder*="Search prompts"]').exists()).toBe(
      true
    );
    expect(wrapper.text()).toContain('Podcast Intro Hooks');
    expect(wrapper.text()).toContain('Tutorial Explainer');
    expect(wrapper.text()).toContain('2 items');
  });

  it('emits update:searchQuery when typing into search input', async () => {
    const wrapper = mount(PromptTemplateList, {
      props: {
        prompts: samplePrompts,
        selectedId: 'p-1',
        searchQuery: ''
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    const searchInput = wrapper.find('input[placeholder*="Search prompts"]');
    await searchInput.setValue('Tutorial');

    expect(wrapper.emitted('update:searchQuery')).toBeDefined();
    expect(wrapper.emitted('update:searchQuery')![0]).toEqual(['Tutorial']);
  });

  it('filters prompt cards according to searchQuery prop', () => {
    const wrapper = mount(PromptTemplateList, {
      props: {
        prompts: samplePrompts,
        selectedId: 'p-1',
        searchQuery: 'Tutorial'
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    expect(wrapper.text()).toContain('Tutorial Explainer');
    expect(wrapper.text()).not.toContain('Podcast Intro Hooks');
    expect(wrapper.text()).toContain('1 items');
  });

  it('displays empty state message when no prompts match', () => {
    const wrapper = mount(PromptTemplateList, {
      props: {
        prompts: samplePrompts,
        selectedId: 'p-1',
        searchQuery: 'NonExistent'
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    expect(wrapper.text()).toContain('No templates match the criteria.');
  });

  it('emits select event when a prompt card is clicked', async () => {
    const wrapper = mount(PromptTemplateList, {
      props: {
        prompts: samplePrompts,
        selectedId: 'p-1',
        searchQuery: ''
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    const secondCard = wrapper
      .findAll('button')
      .find(b => b.text().includes('Tutorial Explainer'));
    expect(secondCard).toBeDefined();

    await secondCard!.trigger('click');
    expect(wrapper.emitted('select')).toBeDefined();
    expect(wrapper.emitted('select')![0][0]).toEqual(samplePrompts[1]);
  });

  it('renders max 2 tags and +N count badge with tooltips', () => {
    const wrapper = mount(PromptTemplateList, {
      props: {
        prompts: samplePrompts,
        selectedId: 'p-1',
        searchQuery: ''
      },
      global: {
        stubs: {
          Icon: true
        }
      }
    });

    expect(wrapper.text()).toContain('podcast');
    expect(wrapper.text()).toContain('comedy');
    expect(wrapper.text()).toContain('+2');
    expect(wrapper.text()).toContain('#podcast');
    expect(wrapper.text()).toContain('#humor, #talkshow');
  });
});
