// @vitest-environment nuxt
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PromptUnsavedModal from '../../../app/components/prompts/PromptUnsavedModal.vue';
import PromptRevertModal from '../../../app/components/prompts/PromptRevertModal.vue';
import PromptDiscardNewModal from '../../../app/components/prompts/PromptDiscardNewModal.vue';
import PromptDeleteModal from '../../../app/components/prompts/PromptDeleteModal.vue';

describe('Prompt Modals', () => {
  describe('PromptUnsavedModal', () => {
    it('renders and emits actions correctly', async () => {
      const wrapper = mount(PromptUnsavedModal, {
        props: {
          show: true,
          promptName: 'Draft Prompt',
          pendingActionDescription: 'Switch to Next',
          canSave: true
        },
        global: { stubs: { Icon: true } }
      });

      expect(wrapper.text()).toContain('Unsaved Changes Detected');
      expect(wrapper.text()).toContain('Draft Prompt');
      expect(wrapper.text()).toContain('Switch to Next');

      const saveBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Save & Continue'));
      await saveBtn!.trigger('click');
      expect(wrapper.emitted('save-and-proceed')).toBeDefined();

      const discardBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Discard Changes'));
      await discardBtn!.trigger('click');
      expect(wrapper.emitted('discard-and-proceed')).toBeDefined();
    });
  });

  describe('PromptRevertModal', () => {
    it('renders and emits confirm and close', async () => {
      const wrapper = mount(PromptRevertModal, {
        props: {
          show: true,
          promptName: 'Revert Me'
        },
        global: { stubs: { Icon: true } }
      });

      expect(wrapper.text()).toContain('Revert Template Changes?');
      expect(wrapper.text()).toContain('Revert Me');

      const confirmBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Yes, Revert'));
      await confirmBtn!.trigger('click');
      expect(wrapper.emitted('confirm')).toBeDefined();

      const cancelBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('No, Keep Editing'));
      await cancelBtn!.trigger('click');
      expect(wrapper.emitted('close')).toBeDefined();
    });
  });

  describe('PromptDiscardNewModal', () => {
    it('renders and emits confirm and close', async () => {
      const wrapper = mount(PromptDiscardNewModal, {
        props: {
          show: true,
          promptName: 'New Untouched'
        },
        global: { stubs: { Icon: true } }
      });

      expect(wrapper.text()).toContain('Discard New Template Draft?');

      const confirmBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Yes, Discard'));
      await confirmBtn!.trigger('click');
      expect(wrapper.emitted('confirm')).toBeDefined();
    });
  });

  describe('PromptDeleteModal', () => {
    it('renders and emits confirm delete and cancel', async () => {
      const wrapper = mount(PromptDeleteModal, {
        props: {
          show: true,
          promptName: 'To Be Deleted'
        },
        global: { stubs: { Icon: true } }
      });

      expect(wrapper.text()).toContain('Delete Prompt Template?');
      expect(wrapper.text()).toContain('Permanent Removal');

      const confirmBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Confirm Delete'));
      await confirmBtn!.trigger('click');
      expect(wrapper.emitted('confirm')).toBeDefined();

      const cancelBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Cancel'));
      await cancelBtn!.trigger('click');
      expect(wrapper.emitted('close')).toBeDefined();
    });
  });
});
