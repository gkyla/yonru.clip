import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import GeminiKeysPane from '../../app/components/settings/GeminiKeysPane.vue';
import TranscriptionEnginePane from '../../app/components/settings/TranscriptionEnginePane.vue';
import YouTubeCookiesPane from '../../app/components/settings/YouTubeCookiesPane.vue';
import SystemEnvironmentPane from '../../app/components/settings/SystemEnvironmentPane.vue';

const globalMountOptions = {
  stubs: {
    Icon: true,
    NuxtIcon: true
  }
};

const mockWhisperModel = ref('base');
vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    whisperModel: mockWhisperModel,
    whisperModels: [
      {
        id: 'tiny',
        name: 'Tiny',
        speed: 'Ultra Fast',
        desc: 'Fastest preview'
      },
      { id: 'base', name: 'Base', speed: 'Very Fast', desc: 'Default balance' }
    ],
    showToast: vi.fn()
  })
}));

describe('SystemEnvironmentPane Component', () => {
  const emptyValidation = {
    testing: false,
    tested: false,
    valid: false,
    message: '',
    detectedPath: ''
  };

  it('renders minimal OK rows with collapsed path panels when tools are healthy', async () => {
    const wrapper = mount(SystemEnvironmentPane, {
      props: {
        ffmpegPath: '',
        nodePath: '',
        savedFfmpegPath: '',
        savedNodePath: '',
        ffmpegValidation: { ...emptyValidation },
        nodeValidation: { ...emptyValidation },
        healthData: {
          ffmpeg: { status: 'OK', path: '/usr/local/bin/ffmpeg' },
          node: { status: 'OK', path: '/usr/local/bin/node' },
          python_env: { status: 'OK' }
        },
        checkingHealth: false,
        healthError: null
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('System');
    expect(wrapper.text()).toContain('FFmpeg');
    expect(wrapper.text()).toContain('/usr/local/bin/ffmpeg');
    expect(wrapper.text()).toContain('Node.js');
    expect(wrapper.text()).toContain('/usr/local/bin/node');
    expect(wrapper.text()).toContain('Python Environment');
    expect(wrapper.text()).toContain('Ready');
    expect(wrapper.text()).not.toContain('Gemini');
    expect(wrapper.text()).not.toContain('Cookies');
    expect(wrapper.text()).not.toContain('.env');
    expect(wrapper.text()).not.toContain('FastAPI');
    expect(wrapper.text()).not.toContain('Backend');

    expect(wrapper.find('#ffmpeg-override-panel').exists()).toBe(false);

    const toggleBtn = wrapper
      .find('[data-testid="system-tool-ffmpeg"]')
      .findAll('button')
      .find(b => b.text().includes('Custom path'));
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn!.attributes('aria-expanded')).toBe('false');
    await toggleBtn!.trigger('click');
    expect(toggleBtn!.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('#ffmpeg-override-panel').exists()).toBe(true);

    const recheckBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Re-check'));
    expect(recheckBtn).toBeDefined();
    await recheckBtn!.trigger('click');
    expect(wrapper.emitted('recheck')).toBeTruthy();
  });

  it('auto-expands missing tool path panel with OS-neutral links and emits per-tool actions', async () => {
    const wrapper = mount(SystemEnvironmentPane, {
      props: {
        ffmpegPath: '/custom/bin/ffmpeg',
        nodePath: '',
        savedFfmpegPath: '/custom/bin/ffmpeg',
        savedNodePath: '',
        ffmpegValidation: {
          testing: false,
          tested: true,
          valid: true,
          message: 'Valid binary location.',
          detectedPath: '/custom/bin/ffmpeg'
        },
        nodeValidation: { ...emptyValidation },
        healthData: {
          ffmpeg: { status: 'OK', path: '/custom/bin/ffmpeg' },
          node: { status: 'Missing', path: '' },
          python_env: { status: 'Missing' }
        },
        checkingHealth: false,
        healthError: null
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Needs attention');
    expect(wrapper.text()).toContain('Download Node.js (nodejs.org)');
    expect(wrapper.text()).toContain('python run.py');
    expect(wrapper.text()).not.toContain('brew install');
    expect(wrapper.text()).not.toContain('.env');
    expect(wrapper.text()).not.toContain('backend/requirements.txt');
    expect(wrapper.find('#node-override-panel').exists()).toBe(true);
    expect(wrapper.find('#ffmpeg-override-panel').exists()).toBe(true);
    expect(wrapper.text()).toContain('Valid binary location.');

    const testFfmpegBtn = wrapper
      .find('[data-testid="system-tool-ffmpeg"]')
      .findAll('button')
      .find(b => b.text().includes('Test'));
    await testFfmpegBtn!.trigger('click');
    expect(wrapper.emitted('testBinaryPath')?.[0]).toEqual(['ffmpeg']);

    await wrapper
      .find('[data-testid="system-tool-ffmpeg"] form')
      .trigger('submit');
    expect(wrapper.emitted('saveBinaryPath')?.[0]).toEqual(['ffmpeg']);

    const resetBtn = wrapper
      .find('[data-testid="system-tool-ffmpeg"]')
      .findAll('button')
      .find(b => b.text().includes('Reset to default'));
    await resetBtn!.trigger('click');
    expect(wrapper.emitted('resetBinaryPath')?.[0]).toEqual(['ffmpeg']);
  });

  it('renders loading and retryable backend error states', async () => {
    const loadingWrapper = mount(SystemEnvironmentPane, {
      props: {
        ffmpegPath: '',
        nodePath: '',
        ffmpegValidation: { ...emptyValidation },
        nodeValidation: { ...emptyValidation },
        healthData: null,
        checkingHealth: true,
        healthError: null
      },
      global: globalMountOptions
    });
    expect(loadingWrapper.text()).toContain('Checking local system tools...');

    const uncheckedWrapper = mount(SystemEnvironmentPane, {
      props: {
        ffmpegPath: '',
        nodePath: '',
        ffmpegValidation: { ...emptyValidation },
        nodeValidation: { ...emptyValidation },
        healthData: null,
        checkingHealth: false,
        healthError: null
      },
      global: globalMountOptions
    });
    expect(uncheckedWrapper.text()).toContain('Not checked');
    expect(uncheckedWrapper.text()).not.toContain('Needs attention');

    const errorWrapper = mount(SystemEnvironmentPane, {
      props: {
        ffmpegPath: '',
        nodePath: '',
        ffmpegValidation: { ...emptyValidation },
        nodeValidation: { ...emptyValidation },
        healthData: null,
        checkingHealth: false,
        healthError: 'Backend connection failed.'
      },
      global: globalMountOptions
    });
    expect(errorWrapper.find('[role="alert"]').text()).toContain(
      'Backend connection failed.'
    );
    const retryBtn = errorWrapper
      .findAll('button')
      .find(b => b.text().includes('Retry check'));
    await retryBtn!.trigger('click');
    expect(errorWrapper.emitted('recheck')).toBeTruthy();
  });
});

describe('GeminiKeysPane Component', () => {
  it('renders Hook Discovery Model selector, Gemini API Keys, and emits selectModel & key events', async () => {
    const keysList = [
      {
        id: 'k1',
        title: 'Primary Key',
        value: 'AIzaSy1234567890',
        show: false,
        status: 'valid' as const,
        error: '',
        activeFlash: false
      }
    ];

    const wrapper = mount(GeminiKeysPane, {
      props: {
        keysList,
        selectedModel: 'gemini-3.5-flash-lite' as const,
        savingModel: false,
        modelSaveError: '',
        hasUnsavedChanges: true,
        testingKey: false,
        testResult: { status: 'idle' as const, message: '' },
        draggedIndex: null,
        'onUpdate:keysList': (val: any) => wrapper.setProps({ keysList: val })
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('AI Model');
    expect(wrapper.text()).toContain('Hook Discovery Model');
    expect(wrapper.text()).toContain('Provider:');
    expect(wrapper.text()).toContain('Gemini');
    expect(wrapper.text()).toContain(
      'Fastest response with the highest free-tier daily allowance'
    );
    const rateLink = wrapper.find(
      'a[href="https://aistudio.google.com/rate-limit"]'
    );
    expect(rateLink.exists()).toBe(true);

    const modelSelect = wrapper.find('select#hook-discovery-model-select');
    expect(modelSelect.exists()).toBe(true);
    expect(modelSelect.findAll('option').length).toBe(4);
    expect(
      modelSelect
        .findAll('option')
        .map(o => (o.element as HTMLOptionElement).value)
    ).toEqual([
      'gemini-4-hydrogen',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite'
    ]);

    await modelSelect.setValue('gemini-3.6-flash');
    expect(wrapper.emitted('selectModel')?.[0]).toEqual(['gemini-3.6-flash']);

    expect(wrapper.text()).toContain('Gemini API Keys');
    expect(wrapper.text()).toContain('#1 Primary');
    expect(
      (wrapper.find('input[type="text"]').element as HTMLInputElement).value
    ).toBe('Primary Key');
    expect(wrapper.text()).toContain('Unsaved changes');

    expect(wrapper.text()).toContain('Save Keys');
    expect(wrapper.text()).toContain('Test Connections');
    expect(wrapper.text()).not.toContain('.env');

    const addBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Add Fallback Key'));
    await addBtn!.trigger('click');
    expect(wrapper.emitted('addKey')).toBeTruthy();

    const saveBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Save Keys'));
    await saveBtn!.trigger('click');
    expect(wrapper.emitted('saveApiKeys')).toBeTruthy();

    const testBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Test Connections'));
    await testBtn!.trigger('click');
    expect(wrapper.emitted('testApiKeys')).toBeTruthy();
  });

  it('displays loading indicator and error alert for model updates', () => {
    const wrapper = mount(GeminiKeysPane, {
      props: {
        keysList: [],
        selectedModel: 'gemini-3.8-flash' as const,
        savingModel: true,
        modelSaveError: 'Backend unreachable',
        hasUnsavedChanges: false,
        testingKey: false,
        testResult: { status: 'idle' as const, message: '' },
        draggedIndex: null
      },
      global: globalMountOptions
    });

    expect(wrapper.find('[role="status"]').text()).toContain('Saving...');
    expect(wrapper.find('[role="alert"]').text()).toContain(
      'Backend unreachable'
    );
    expect(
      (
        wrapper.find('select#hook-discovery-model-select')
          .element as HTMLSelectElement
      ).disabled
    ).toBe(true);
  });
});

describe('TranscriptionEnginePane Component', () => {
  it('renders calculate speed and accessible radio model cards, emitting detectHardware on click', async () => {
    const wrapper = mount(TranscriptionEnginePane, {
      props: {
        hardwareProfile: null,
        detectingHardware: false,
        hardwareError: null
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Transcription');
    expect(wrapper.text()).toContain('Calculate Speed');

    const detectBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Calculate Speed'));
    await detectBtn!.trigger('click');
    expect(wrapper.emitted('detectHardware')).toBeTruthy();

    const radioGroup = wrapper.find('[role="radiogroup"]');
    expect(radioGroup.exists()).toBe(true);

    const tinyCard = wrapper
      .findAll('button[role="radio"]')
      .find(b => b.text().includes('Tiny'));
    expect(tinyCard).toBeDefined();
    await tinyCard!.trigger('click');
    expect(mockWhisperModel.value).toBe('tiny');
    expect(tinyCard!.attributes('aria-checked')).toBe('true');
  });

  it('renders retryable alert when hardwareError is set', async () => {
    const wrapper = mount(TranscriptionEnginePane, {
      props: {
        hardwareProfile: null,
        detectingHardware: false,
        hardwareError: 'Hardware scan timed out.'
      },
      global: globalMountOptions
    });

    expect(wrapper.find('[role="alert"]').text()).toContain(
      'Hardware scan timed out.'
    );
    const retryBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Retry scan'));
    await retryBtn!.trigger('click');
    expect(wrapper.emitted('detectHardware')).toBeTruthy();
  });
});

describe('YouTubeCookiesPane Component', () => {
  it('renders active cookie card with collapsed guide and emits deleteCookies', async () => {
    const wrapper = mount(YouTubeCookiesPane, {
      props: {
        cookiesStatus: {
          exists: true,
          size_bytes: 4096,
          last_modified: '2026-09-01T12:00:00Z'
        },
        deletingCookies: false
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('cookies.txt');
    expect(wrapper.text()).toContain('Active');
    expect(wrapper.text()).not.toContain('File size');
    expect(wrapper.text()).not.toContain('Last updated');
    expect(wrapper.text()).not.toContain('4 KB');
    expect(wrapper.text()).not.toContain('Netscape');

    const activeStatus = wrapper.find('[data-testid="cookies-active-status"]');
    expect(activeStatus.exists()).toBe(true);
    expect(activeStatus.text()).toContain('Active');
    expect(activeStatus.classes()).not.toContain('border');
    expect(activeStatus.classes()).not.toContain('border-emerald-500/30');
    expect(activeStatus.classes()).not.toContain('bg-emerald-500/10');

    const savedNote = wrapper.find('[data-testid="cookies-saved-note"]');
    expect(savedNote.exists()).toBe(true);
    expect(savedNote.text()).toContain('Saved in the app');
    expect(savedNote.text().toLowerCase()).not.toContain('backend');
    expect(savedNote.text()).not.toContain('.env');

    const purposeNote = wrapper.find('[data-testid="cookies-purpose-note"]');
    expect(purposeNote.exists()).toBe(true);
    expect(purposeNote.text()).toContain('Why yt-dlp may need YouTube cookies');

    expect(wrapper.find('input[type="file"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Replace');

    const details = wrapper.find('details.cookies-guide');
    expect(details.exists()).toBe(true);
    expect((details.element as HTMLDetailsElement).open).toBe(false);

    const deleteBtn = wrapper.find('[data-testid="delete-cookies-btn"]');
    expect(deleteBtn.exists()).toBe(true);
    expect(deleteBtn.text()).toContain('Delete');
    expect(deleteBtn.classes()).toContain('bg-surface-dark');
    expect(deleteBtn.classes()).toContain('border-surface-border');
    expect(deleteBtn.classes()).not.toContain('bg-red-500/10');
    expect(deleteBtn.classes()).not.toContain('border-red-500/30');

    await deleteBtn.trigger('click');

    expect(wrapper.emitted('deleteCookies')).toBeTruthy();
  });
});
