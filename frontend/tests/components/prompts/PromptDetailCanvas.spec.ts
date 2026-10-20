// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PromptDetailCanvas from '../../../app/components/prompts/PromptDetailCanvas.vue';

describe('PromptDetailCanvas Component', () => {
  it('renders empty selection state when no template is selected and not creating new', () => {
    const wrapper = mount(PromptDetailCanvas, {
      props: {
        editingId: null,
        isCreatingNew: false,
        promptName: '',
        suitableFor: [],
        promptText: '',
        isDirty: false
      },
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true,
          PromptTagPopover: true
        }
      }
    });

    expect(wrapper.text()).toContain('No Template Selected');
    expect(wrapper.text()).toContain('+ Create New Template');
  });

  it('emits start-new event when clicking create new button in empty state', async () => {
    const wrapper = mount(PromptDetailCanvas, {
      props: {
        editingId: null,
        isCreatingNew: false,
        promptName: '',
        suitableFor: [],
        promptText: '',
        isDirty: false
      },
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true,
          PromptTagPopover: true
        }
      }
    });

    const createBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('+ Create New Template'));
    expect(createBtn).toBeDefined();

    await createBtn!.trigger('click');
    expect(wrapper.emitted('start-new')).toBeDefined();
  });

  it('renders editing form with name, tags, and action buttons when editingId is set', async () => {
    const wrapper = mount(PromptDetailCanvas, {
      props: {
        editingId: 'prompt-1',
        isCreatingNew: false,
        promptName: 'Comedy Roast',
        suitableFor: ['comedy', 'satire'],
        promptText: 'Extract punchy roasts',
        isDirty: true
      },
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true,
          PromptTagPopover: true
        }
      }
    });

    expect(wrapper.text()).toContain('Modify Prompt Template');
    expect(wrapper.text()).toContain('unsaved');

    const nameInput = wrapper.find(
      'input[placeholder*="Comedy Podcast Hooks"]'
    );
    expect((nameInput.element as HTMLInputElement).value).toBe('Comedy Roast');

    expect(wrapper.text()).toContain('comedy');
    expect(wrapper.text()).toContain('satire');

    const updateBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Update Prompt'));
    expect(updateBtn).toBeDefined();
    await updateBtn!.trigger('click');
    expect(wrapper.emitted('save')).toBeDefined();

    const deleteBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Delete'));
    expect(deleteBtn).toBeDefined();
    await deleteBtn!.trigger('click');
    expect(wrapper.emitted('delete')).toBeDefined();

    const revertBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Revert'));
    expect(revertBtn).toBeDefined();
    await revertBtn!.trigger('click');
    expect(wrapper.emitted('revert')).toBeDefined();
  });

  it('emits remove-tag when tag close button is clicked', async () => {
    const wrapper = mount(PromptDetailCanvas, {
      props: {
        editingId: 'prompt-1',
        isCreatingNew: false,
        promptName: 'Comedy Roast',
        suitableFor: ['comedy', 'satire'],
        promptText: 'Extract punchy roasts',
        isDirty: false
      },
      global: {
        stubs: {
          Icon: true,
          PromptEditor: true,
          PromptTagPopover: true
        }
      }
    });

    // Find remove button for first tag
    const tagCloseBtn = wrapper.find('button.text-slate-500');
    expect(tagCloseBtn.exists()).toBe(true);

    await tagCloseBtn.trigger('click');
    expect(wrapper.emitted('remove-tag')).toBeDefined();
    expect(wrapper.emitted('remove-tag')![0]).toEqual([0]);
  });
});
