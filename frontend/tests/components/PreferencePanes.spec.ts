import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HealthDiagnosticsPane from '../../app/components/settings/HealthDiagnosticsPane.vue';
import GeminiKeysPane from '../../app/components/settings/GeminiKeysPane.vue';
import TranscriptionEnginePane from '../../app/components/settings/TranscriptionEnginePane.vue';
import YouTubeCookiesPane from '../../app/components/settings/YouTubeCookiesPane.vue';
import EnvironmentPathsPane from '../../app/components/settings/EnvironmentPathsPane.vue';
import { ref } from 'vue';

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

describe('HealthDiagnosticsPane Component', () => {
  it('renders health statuses and emits switchTab on action click', async () => {
    const healthData = {
      ffmpeg: { status: 'OK', path: '/usr/local/bin/ffmpeg' },
      node: { status: 'OK', path: '/usr/local/bin/node' },
      python_env: { status: 'OK' },
      gemini_api: { has_key: false },
      cookies: { exists: false }
    };

    const wrapper = mount(HealthDiagnosticsPane, {
      props: {
        healthData,
        isHealthOk: false
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Prerequisite Health & Diagnostics');
    expect(wrapper.text()).toContain('Action Required');
    expect(wrapper.text()).toContain('/usr/local/bin/ffmpeg');

    const configBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Configure API Key'));
    expect(configBtn).toBeDefined();
    await configBtn!.trigger('click');

    expect(wrapper.emitted('switchTab')).toBeTruthy();
    expect(wrapper.emitted('switchTab')![0]).toEqual(['api']);
  });
});

describe('GeminiKeysPane Component', () => {
  it('renders keys and emits action events', async () => {
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
        hasUnsavedChanges: true,
        testingKey: false,
        testResult: { status: 'idle', message: '' },
        draggedIndex: null,
        'onUpdate:keysList': (val: any) => wrapper.setProps({ keysList: val })
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Gemini API Keys');
    expect(wrapper.text()).toContain('#1 Primary');
    expect(wrapper.find('input[type="text"]').element.value).toBe(
      'Primary Key'
    );
    expect(wrapper.text()).toContain('Unsaved changes');

    // Add key button
    const addBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Add Fallback Key'));
    expect(addBtn).toBeDefined();
    await addBtn!.trigger('click');
    expect(wrapper.emitted('addKey')).toBeTruthy();

    // Save keys button
    const saveBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Save Keys'));
    expect(saveBtn).toBeDefined();
    await saveBtn!.trigger('click');
    expect(wrapper.emitted('saveApiKeys')).toBeTruthy();

    // Test connections button
    const testBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Test Connections'));
    expect(testBtn).toBeDefined();
    await testBtn!.trigger('click');
    expect(wrapper.emitted('testApiKeys')).toBeTruthy();
  });
});

describe('TranscriptionEnginePane Component', () => {
  it('renders calculate speed and model cards, emitting detectHardware on click', async () => {
    const wrapper = mount(TranscriptionEnginePane, {
      props: {
        hardwareProfile: null,
        detectingHardware: false
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Transcription Engine (Whisper)');
    expect(wrapper.text()).toContain('Calculate Speed');

    const detectBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Calculate Speed'));
    expect(detectBtn).toBeDefined();
    await detectBtn!.trigger('click');

    expect(wrapper.emitted('detectHardware')).toBeTruthy();

    // Select model card
    const tinyCard = wrapper
      .findAll('button')
      .find(b => b.text().includes('Tiny'));
    expect(tinyCard).toBeDefined();
    await tinyCard!.trigger('click');
    expect(mockWhisperModel.value).toBe('tiny');
  });
});

describe('YouTubeCookiesPane Component', () => {
  it('renders active cookie card and emits deleteCookies', async () => {
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
    expect(wrapper.text()).toContain('4 KB');

    const deleteBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Delete'));
    expect(deleteBtn).toBeDefined();
    await deleteBtn!.trigger('click');

    expect(wrapper.emitted('deleteCookies')).toBeTruthy();
  });
});

describe('EnvironmentPathsPane Component', () => {
  it('renders custom paths, validates test and clear override actions', async () => {
    const wrapper = mount(EnvironmentPathsPane, {
      props: {
        ffmpegPath: '/custom/bin/ffmpeg',
        nodePath: '',
        ffmpegValidation: {
          testing: false,
          tested: true,
          valid: true,
          message: 'Valid binary location.',
          detectedPath: '/custom/bin/ffmpeg'
        },
        nodeValidation: {
          testing: false,
          tested: false,
          valid: false,
          message: '',
          detectedPath: ''
        },
        ffmpegStatusBadge: {
          label: 'Custom Override',
          class: 'text-accent-400',
          dotClass: 'bg-accent-400'
        },
        nodeStatusBadge: {
          label: 'Auto-Detected',
          class: 'text-emerald-400',
          dotClass: 'bg-emerald-400'
        },
        savingEnvPaths: false,
        healthData: {
          ffmpeg: { path: '/opt/homebrew/bin/ffmpeg' },
          node: { path: '/opt/homebrew/bin/node' }
        },
        'onUpdate:ffmpegPath': (val: string) =>
          wrapper.setProps({ ffmpegPath: val }),
        'onUpdate:nodePath': (val: string) =>
          wrapper.setProps({ nodePath: val })
      },
      global: globalMountOptions
    });

    expect(wrapper.text()).toContain('Environment Paths');
    expect(wrapper.text()).toContain('FFmpeg Binary');
    expect(wrapper.text()).toContain('Node.js Runtime');
    expect(wrapper.text()).toContain('Valid binary location.');

    // Clear override button
    const clearBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Clear Override'));
    expect(clearBtn).toBeDefined();
    await clearBtn!.trigger('click');
    expect(wrapper.emitted('resetEnvPath')).toBeTruthy();
    expect(wrapper.emitted('resetEnvPath')![0]).toEqual(['ffmpeg']);

    // Save button
    const saveBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Save Environment Paths'));
    expect(saveBtn).toBeDefined();
    await saveBtn!.trigger('click');
    expect(wrapper.emitted('saveEnvPaths')).toBeTruthy();
  });
});
