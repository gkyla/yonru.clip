import type {
  PromptTemplate,
  HookExtractionMode,
  HookIntentPreset
} from '../types/clipper';
import { resolveApiBase } from '../utils/apiBase';
import { useAppNotifier } from './useAppNotifier';

export const usePromptRepository = (notifier = useAppNotifier()) => {
  const API_BASE = resolveApiBase();

  const promptsList = useState<PromptTemplate[]>('promptsList', () => []);
  const selectedPrompt = useState<string>(
    'selectedPrompt',
    () => 'prompt.json'
  );
  const extractionMode = useState<HookExtractionMode>(
    'extractionMode',
    () => 'preset'
  );
  const selectedPresetId = useState<HookIntentPreset>(
    'selectedPresetId',
    () => 'auto'
  );
  const focusTopic = useState<string>('focusTopic', () => '');
  const minDuration = useState<number>('minDuration', () => 30);
  const maxDuration = useState<number>('maxDuration', () => 180);

  async function fetchPrompts(): Promise<void> {
    try {
      const res = await $fetch<{
        prompts: PromptTemplate[];
      }>(`${API_BASE}/api/prompts`);
      promptsList.value = res.prompts || [];
      if (
        promptsList.value.length > 0 &&
        !promptsList.value.find(p => p.id === selectedPrompt.value)
      ) {
        const firstPrompt = promptsList.value[0];
        if (firstPrompt) {
          selectedPrompt.value = firstPrompt.id;
        }
      }
    } catch (e) {
      console.error('Failed to fetch prompts', e);
    }
  }

  async function createPrompt(
    name: string,
    suitableFor: string[],
    prompt: string,
    numHooks: number = 10,
    autoHooks: boolean = false
  ): Promise<boolean> {
    try {
      await $fetch(`${API_BASE}/api/prompts/add`, {
        method: 'POST',
        body: {
          promptName: name,
          suitableFor,
          prompt,
          numHooks,
          autoHooks
        }
      });
      await fetchPrompts();
      notifier.showToast('Prompt saved successfully', 'success');
      return true;
    } catch (e) {
      notifier.showToast('Failed to save prompt', 'error');
      return false;
    }
  }

  async function editPrompt(
    id: string,
    name: string,
    suitableFor: string[],
    prompt: string,
    numHooks: number = 10,
    autoHooks: boolean = false
  ): Promise<boolean> {
    try {
      await $fetch(`${API_BASE}/api/prompts/edit`, {
        method: 'PUT',
        body: {
          id,
          promptName: name,
          suitableFor,
          prompt,
          numHooks,
          autoHooks
        }
      });
      await fetchPrompts();
      notifier.showToast('Prompt updated successfully', 'success');
      return true;
    } catch (e) {
      notifier.showToast('Failed to update prompt', 'error');
      return false;
    }
  }

  async function deletePrompt(id: string): Promise<boolean> {
    try {
      await $fetch(`${API_BASE}/api/prompts/${id}`, {
        method: 'DELETE'
      });
      await fetchPrompts();
      notifier.showToast('Prompt template removed', 'success');
      return true;
    } catch (e) {
      notifier.showToast('Failed to remove prompt template', 'error');
      return false;
    }
  }

  return {
    promptsList,
    selectedPrompt,
    extractionMode,
    selectedPresetId,
    focusTopic,
    minDuration,
    maxDuration,
    fetchPrompts,
    createPrompt,
    addPrompt: createPrompt,
    editPrompt,
    deletePrompt
  };
};
