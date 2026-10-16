// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePromptRepository } from '../../app/composables/usePromptRepository';
import type { PromptTemplate } from '../../app/types/clipper';

describe('usePromptRepository Composable', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ prompts: [] }));
    const repo = usePromptRepository();
    repo.promptsList.value = [];
    repo.selectedPrompt.value = 'prompt.json';
    repo.extractionMode.value = 'preset';
    repo.selectedPresetId.value = 'auto';
    repo.focusTopic.value = '';
    repo.minDuration.value = 30;
    repo.maxDuration.value = 180;
  });

  it('initializes with default prompt and preset parameters', () => {
    const repo = usePromptRepository();

    expect(repo.promptsList.value).toEqual([]);
    expect(repo.selectedPrompt.value).toBe('prompt.json');
    expect(repo.extractionMode.value).toBe('preset');
    expect(repo.selectedPresetId.value).toBe('auto');
    expect(repo.focusTopic.value).toBe('');
    expect(repo.minDuration.value).toBe(30);
    expect(repo.maxDuration.value).toBe(180);
  });

  describe('fetchPrompts', () => {
    it('fetches prompt templates from /api/prompts and updates promptsList', async () => {
      const mockPrompts: PromptTemplate[] = [
        { id: 'custom-1.json', name: 'Tech Breakdown', suitableFor: ['tech'] },
        { id: 'custom-2.json', name: 'Humor Clip', suitableFor: ['comedy'] }
      ];
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockResolvedValue({ prompts: mockPrompts })
      );

      const repo = usePromptRepository();
      await repo.fetchPrompts();

      expect(repo.promptsList.value).toEqual(mockPrompts);
      // Since 'prompt.json' was not in the returned list, auto-selects the first one
      expect(repo.selectedPrompt.value).toBe('custom-1.json');
    });

    it('preserves selectedPrompt if it exists in the fetched list', async () => {
      const mockPrompts: PromptTemplate[] = [
        { id: 'custom-1.json', name: 'Tech Breakdown', suitableFor: ['tech'] },
        { id: 'prompt.json', name: 'Default Prompt', suitableFor: ['general'] }
      ];
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockResolvedValue({ prompts: mockPrompts })
      );

      const repo = usePromptRepository();
      repo.selectedPrompt.value = 'prompt.json';
      await repo.fetchPrompts();

      expect(repo.selectedPrompt.value).toBe('prompt.json');
    });

    it('handles network errors gracefully without throwing', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Network error'))
      );

      const repo = usePromptRepository();
      await expect(repo.fetchPrompts()).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('createPrompt / addPrompt', () => {
    it('creates a new prompt template and triggers success notification', async () => {
      const mockFetch = vi
        .fn()
        .mockImplementation((url: string, opts?: any) => {
          if (url.includes('/api/prompts/add')) {
            return Promise.resolve({ status: 'ok' });
          }
          if (url.includes('/api/prompts')) {
            return Promise.resolve({
              prompts: [
                {
                  id: 'new-prompt.json',
                  name: 'New Template',
                  suitableFor: ['test'],
                  prompt: 'Test'
                }
              ]
            });
          }
          return Promise.resolve({});
        });
      vi.stubGlobal('$fetch', mockFetch);

      const mockNotifier = {
        toast: ref(null),
        showToast: vi.fn(),
        dismissToast: vi.fn()
      };
      const repo = usePromptRepository(mockNotifier);

      const success = await repo.createPrompt(
        'New Template',
        ['test'],
        'Test content',
        10,
        true
      );

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/prompts/add'),
        expect.objectContaining({
          method: 'POST',
          body: {
            promptName: 'New Template',
            suitableFor: ['test'],
            prompt: 'Test content',
            numHooks: 10,
            autoHooks: true
          }
        })
      );
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Prompt saved successfully',
        'success'
      );
      expect(repo.promptsList.value.length).toBe(1);
    });

    it('handles createPrompt failure gracefully', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Server error'))
      );

      const mockNotifier = {
        toast: ref(null),
        showToast: vi.fn(),
        dismissToast: vi.fn()
      };
      const repo = usePromptRepository(mockNotifier);

      const success = await repo.createPrompt(
        'Fail Template',
        ['test'],
        'Test'
      );

      expect(success).toBe(false);
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Failed to save prompt',
        'error'
      );
    });

    it('exposes addPrompt as a backward-compatible alias for createPrompt', async () => {
      const repo = usePromptRepository();
      expect(repo.addPrompt).toBe(repo.createPrompt);
    });
  });

  describe('editPrompt', () => {
    it('updates an existing prompt template and triggers success notification', async () => {
      const mockFetch = vi
        .fn()
        .mockImplementation((url: string, opts?: any) => {
          if (url.includes('/api/prompts/edit')) {
            return Promise.resolve({ status: 'ok' });
          }
          if (url.includes('/api/prompts')) {
            return Promise.resolve({
              prompts: [
                {
                  id: 'p1.json',
                  name: 'Updated Template',
                  suitableFor: ['updated'],
                  prompt: 'Updated'
                }
              ]
            });
          }
          return Promise.resolve({});
        });
      vi.stubGlobal('$fetch', mockFetch);

      const mockNotifier = {
        toast: ref(null),
        showToast: vi.fn(),
        dismissToast: vi.fn()
      };
      const repo = usePromptRepository(mockNotifier);

      const success = await repo.editPrompt(
        'p1.json',
        'Updated Template',
        ['updated'],
        'Updated prompt',
        15,
        false
      );

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/prompts/edit'),
        expect.objectContaining({
          method: 'PUT',
          body: {
            id: 'p1.json',
            promptName: 'Updated Template',
            suitableFor: ['updated'],
            prompt: 'Updated prompt',
            numHooks: 15,
            autoHooks: false
          }
        })
      );
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Prompt updated successfully',
        'success'
      );
    });

    it('handles editPrompt failure gracefully', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Not found'))
      );

      const mockNotifier = {
        toast: ref(null),
        showToast: vi.fn(),
        dismissToast: vi.fn()
      };
      const repo = usePromptRepository(mockNotifier);

      const success = await repo.editPrompt(
        'invalid.json',
        'Invalid',
        [],
        'content'
      );

      expect(success).toBe(false);
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Failed to update prompt',
        'error'
      );
    });
  });

  describe('deletePrompt', () => {
    it('deletes an existing prompt template and triggers success notification', async () => {
      const mockFetch = vi
        .fn()
        .mockImplementation((url: string, opts?: any) => {
          if (url.includes('/api/prompts/custom.json')) {
            return Promise.resolve({ status: 'ok' });
          }
          if (url.includes('/api/prompts')) {
            return Promise.resolve({ prompts: [] });
          }
          return Promise.resolve({});
        });
      vi.stubGlobal('$fetch', mockFetch);

      const mockNotifier = {
        toast: ref(null),
        showToast: vi.fn(),
        dismissToast: vi.fn()
      };
      const repo = usePromptRepository(mockNotifier);

      const success = await repo.deletePrompt('custom.json');

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/prompts/custom.json'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Prompt template removed',
        'success'
      );
    });

    it('handles deletePrompt failure gracefully', async () => {
      vi.stubGlobal(
        '$fetch',
        vi.fn().mockRejectedValue(new Error('Delete error'))
      );

      const mockNotifier = {
        toast: ref(null),
        showToast: vi.fn(),
        dismissToast: vi.fn()
      };
      const repo = usePromptRepository(mockNotifier);

      const success = await repo.deletePrompt('custom.json');

      expect(success).toBe(false);
      expect(mockNotifier.showToast).toHaveBeenCalledWith(
        'Failed to remove prompt template',
        'error'
      );
    });
  });
});
