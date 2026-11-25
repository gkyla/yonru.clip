// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { computed, ref } from 'vue';
import HomeSettings from '../../app/components/HomeSettings.vue';
import { HOOK_DISCOVERY_MODELS } from '../../app/utils/hookDiscoveryModels';
import { isPrerequisiteMissing } from '../../app/utils/systemDiagnostics';
import { useRouter, useRoute } from '#imports';

// Mock useClipperState
const mockSettingsScrollTarget = ref<string | null>(null);
const mockSystemHealth = ref<any>({});
const mockHealthError = ref<string | null>(null);
const mockHardwareProfile = ref<any>(null);
const mockDetectingHardware = ref(false);
const mockHardwareError = ref<string | null>(null);
const mockDetectHardwareProfile = vi.fn();
const mockWhisperModel = ref('base');
const mockGeminiModel = ref('gemini-3.5-flash-lite');
const mockShowToast = vi.fn();
const mockCheckSystemHealth = vi.fn();

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    systemHealth: mockSystemHealth,
    checkingHealth: ref(false),
    healthError: mockHealthError,
    isAnyPrerequisiteMissing: computed(() =>
      isPrerequisiteMissing(mockSystemHealth.value)
    ),
    settingsScrollTarget: mockSettingsScrollTarget,
    hardwareProfile: mockHardwareProfile,
    detectingHardware: mockDetectingHardware,
    hardwareError: mockHardwareError,
    detectHardwareProfile: mockDetectHardwareProfile,
    whisperModel: mockWhisperModel,
    geminiModel: mockGeminiModel,
    hookDiscoveryModels: HOOK_DISCOVERY_MODELS,
    language: ref('auto'),
    whisperModels: [
      {
        id: 'tiny',
        name: 'Tiny',
        speed: 'Ultra Fast',
        acc: 'Basic',
        desc: 'Minimal accuracy, best for quick testing on weak hardware.'
      },
      {
        id: 'base',
        name: 'Base',
        speed: 'Very Fast',
        acc: 'Good',
        desc: 'Great balance for clear audio. Default choice.'
      },
      {
        id: 'small',
        name: 'Small',
        speed: 'Fast',
        acc: 'Better',
        desc: 'Significantly better for non-English or noisy audio.'
      },
      {
        id: 'medium',
        name: 'Medium',
        speed: 'Moderate',
        acc: 'Excellent',
        desc: 'High precision. Requires decent hardware (~5GB VRAM).'
      },
      {
        id: 'large-v3',
        name: 'Large-v3',
        speed: 'Slow',
        acc: 'State-of-the-Art',
        desc: 'Highest accuracy possible. Best for complex dialogue.'
      }
    ],
    showToast: mockShowToast,
    checkSystemHealth: mockCheckSystemHealth
  })
}));

describe('HomeSettings Component', () => {
  let mockEnvConfig = 'key_1, key_2';

  beforeEach(() => {
    mockEnvConfig = 'key_1, key_2';
    mockSettingsScrollTarget.value = null;
    mockSystemHealth.value = {};
    mockHealthError.value = null;
    mockHardwareError.value = null;
    mockWhisperModel.value = 'base';
    mockGeminiModel.value = 'gemini-3.5-flash-lite';
    mockShowToast.mockClear();
    mockCheckSystemHealth.mockClear();

    // Mock global $fetch to return mock settings
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url, options) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: mockEnvConfig,
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        if (urlStr.includes('/api/cookies-status')) {
          return Promise.resolve({
            exists: false,
            size_bytes: 0,
            last_modified: null
          });
        }
        return Promise.resolve({});
      })
    );
  });

  it('populates keysList from plain comma-separated string on mount', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();

    const vm = wrapper.vm as any;
    expect(vm.keysList).toBeDefined();
    expect(vm.keysList.length).toBe(2);
    expect(vm.keysList[0].value).toBe('key_1');
    expect(vm.keysList[0].title).toBe('');
    expect(vm.keysList[1].value).toBe('key_2');
  });

  it('populates keysList from JSON formatted key configuration', async () => {
    mockEnvConfig =
      '[{"title":"Work Key","value":"key_work"},{"title":"Home Key","value":"key_home"}]';
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    expect(vm.keysList.length).toBe(2);
    expect(vm.keysList[0].value).toBe('key_work');
    expect(vm.keysList[0].title).toBe('Work Key');
    expect(vm.keysList[1].value).toBe('key_home');
    expect(vm.keysList[1].title).toBe('Home Key');
  });

  it('can dynamically add and remove fallback keys', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    expect(vm.keysList.length).toBe(2);

    // Add key
    vm.addKey();
    expect(vm.keysList.length).toBe(3);
    expect(vm.keysList[2].value).toBe('');
    expect(vm.keysList[2].title).toBe('');

    // Remove key
    vm.removeKey(0);
    expect(vm.keysList.length).toBe(2);
    expect(vm.keysList[0].value).toBe('key_2');
  });

  it('can reorder keys dynamically using moveKey and triggers activeFlash animation states', async () => {
    mockEnvConfig =
      '[{"title":"First","value":"k1"},{"title":"Second","value":"k2"},{"title":"Third","value":"k3"}]';
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    expect(vm.keysList[0].value).toBe('k1');
    expect(vm.keysList[1].value).toBe('k2');

    vi.useFakeTimers();

    // Move second key up
    vm.moveKey(1, -1);
    expect(vm.keysList[0].value).toBe('k2');
    expect(vm.keysList[0].title).toBe('Second');
    expect(vm.keysList[0].activeFlash).toBe(true);
    expect(vm.keysList[1].value).toBe('k1');
    expect(vm.keysList[1].title).toBe('First');
    expect(vm.keysList[1].activeFlash).toBe(true);

    // Fast-forward cooldown timers
    vi.advanceTimersByTime(600);
    expect(vm.keysList[0].activeFlash).toBe(false);
    expect(vm.keysList[1].activeFlash).toBe(false);

    // Move first key down
    vm.moveKey(0, 1);
    expect(vm.keysList[0].value).toBe('k1');
    expect(vm.keysList[1].value).toBe('k2');

    vi.useRealTimers();
  });

  it('supports drag-and-drop interactions to reorder keys', async () => {
    mockEnvConfig =
      '[{"title":"First","value":"k1"},{"title":"Second","value":"k2"}]';
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    expect(vm.draggedIndex).toBeNull();
    expect(vm.keysList[0].value).toBe('k1');
    expect(vm.keysList[1].value).toBe('k2');

    // Simulate dragstart
    const mockDataTransfer = {
      effectAllowed: '',
      setData: vi.fn()
    };
    const dragStartEvent = {
      dataTransfer: mockDataTransfer
    } as unknown as DragEvent;

    vm.dragStart(0, dragStartEvent);
    expect(vm.draggedIndex).toBe(0);
    expect(mockDataTransfer.effectAllowed).toBe('move');
    expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/plain', '0');

    vi.useFakeTimers();

    // Simulate dragenter on index 1 (swapping index 0 and 1)
    vm.dragEnter(1);
    expect(vm.keysList[0].value).toBe('k2');
    expect(vm.keysList[1].value).toBe('k1');
    expect(vm.draggedIndex).toBe(1);
    expect(vm.keysList[0].activeFlash).toBe(true);
    expect(vm.keysList[1].activeFlash).toBe(true);

    // Fast-forward cooldown timers
    vi.advanceTimersByTime(600);
    expect(vm.keysList[0].activeFlash).toBe(false);
    expect(vm.keysList[1].activeFlash).toBe(false);

    // Simulate dragenter on the same index (should do nothing)
    vm.dragEnter(1);
    expect(vm.keysList[0].value).toBe('k2');
    expect(vm.keysList[1].value).toBe('k1');

    // Simulate dragend
    vm.dragEnd();
    expect(vm.draggedIndex).toBeNull();

    vi.useRealTimers();
  });

  it('tracks hasUnsavedChanges when keys list is modified, added, or saved', async () => {
    mockEnvConfig = '[{"title":"First","value":"k1"}]';
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    // Initial state: no unsaved changes
    expect(vm.hasUnsavedChanges).toBe(false);

    // Add key: has unsaved changes
    vm.addKey();
    expect(vm.hasUnsavedChanges).toBe(true);

    // Remove the added key: back to no unsaved changes
    vm.removeKey(1);
    expect(vm.hasUnsavedChanges).toBe(false);

    // Modify existing key value: has unsaved changes
    vm.keysList[0].value = 'k1_modified';
    expect(vm.hasUnsavedChanges).toBe(true);

    // Save: back to no unsaved changes
    await vm.saveApiKeys();
    expect(vm.hasUnsavedChanges).toBe(false);
  });

  it('prevents rapid double-swap glitch loops of the same elements', async () => {
    mockEnvConfig =
      '[{"title":"First","value":"k1"},{"title":"Second","value":"k2"}]';
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    vi.useFakeTimers();

    // Start drag on index 0
    vm.dragStart(0, {
      dataTransfer: { effectAllowed: '', setData: vi.fn() }
    } as any);

    // First swap: enter index 1
    vm.dragEnter(1);
    expect(vm.keysList[0].value).toBe('k2');
    expect(vm.keysList[1].value).toBe('k1');

    // Rapid swap back: immediate dragenter on index 0 (within 50ms)
    vi.advanceTimersByTime(50);
    vm.dragEnter(0);
    // Should NOT swap back yet due to the rapid-swap cooldown
    expect(vm.keysList[0].value).toBe('k2');
    expect(vm.keysList[1].value).toBe('k1');

    // Swap back after cooldown: dragenter on index 0 after 200ms total (50ms + 150ms)
    vi.advanceTimersByTime(150);
    vm.dragEnter(0);
    // Should now successfully swap back
    expect(vm.keysList[0].value).toBe('k1');
    expect(vm.keysList[1].value).toBe('k2');

    vi.useRealTimers();
  });

  it('initializes default active tab to api, handles switchTab, and normalizes legacy tabs to system', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    const vm = wrapper.vm as any;
    expect(vm.activeTab).toBe('api');
    expect(vm.sections.map((s: any) => s.id)).toEqual([
      'api',
      'whisper',
      'cookies',
      'system'
    ]);

    expect(vm.normalizeTab('health')).toBe('system');
    expect(vm.normalizeTab('env')).toBe('system');
    expect(vm.normalizeTab('settings-health')).toBe('system');
    expect(vm.normalizeTab('settings-env')).toBe('system');
    expect(vm.normalizeTab('transcription')).toBe('whisper');

    vm.switchTab('whisper');
    expect(vm.activeTab).toBe('whisper');

    vm.switchTab('cookies');
    expect(vm.activeTab).toBe('cookies');

    vm.switchTab('system');
    expect(vm.activeTab).toBe('system');
  });

  it('syncs active tab when settingsScrollTarget changes including legacy health/env targets', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    const vm = wrapper.vm as any;
    expect(vm.activeTab).toBe('api');

    mockSettingsScrollTarget.value = 'settings-health';
    await wrapper.vm.$nextTick();
    await flushPromises();
    expect(vm.activeTab).toBe('system');
    expect(mockSettingsScrollTarget.value).toBeNull();

    mockSettingsScrollTarget.value = 'settings-env';
    await wrapper.vm.$nextTick();
    await flushPromises();
    expect(vm.activeTab).toBe('system');

    mockSettingsScrollTarget.value = 'settings-whisper';
    await wrapper.vm.$nextTick();
    await flushPromises();
    expect(vm.activeTab).toBe('whisper');
  });

  it('routes missing prerequisite alert banner to system or api and ignores missing cookies', async () => {
    mockSystemHealth.value = {
      ffmpeg: { status: 'OK', path: '/usr/bin/ffmpeg' },
      node: { status: 'OK', path: '/usr/bin/node' },
      python_env: { status: 'OK', active: true },
      gemini_api: { status: 'Configured', has_key: true },
      cookies: { status: 'Not Configured', exists: false }
    };

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });
    await flushPromises();

    // Optional cookies never trigger alert banner
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);

    // Missing Gemini API Key routes to AI Model tab
    mockSystemHealth.value = {
      ...mockSystemHealth.value,
      gemini_api: { status: 'Missing', has_key: false }
    };
    await wrapper.vm.$nextTick();
    const apiBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Configure API Key'));
    expect(apiBtn).toBeDefined();
    await apiBtn!.trigger('click');
    expect((wrapper.vm as any).activeTab).toBe('api');

    // Missing local tool routes to System tab
    mockSystemHealth.value = {
      ...mockSystemHealth.value,
      ffmpeg: { status: 'Missing', path: '' }
    };
    await wrapper.vm.$nextTick();
    const sysBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Review System Tools'));
    expect(sysBtn).toBeDefined();
    await sysBtn!.trigger('click');
    expect((wrapper.vm as any).activeTab).toBe('system');
  });

  it('tests API keys against /api/validate-gemini-key and updates status correctly', async () => {
    mockEnvConfig =
      '[{"title":"Main","value":"AIzaSy_valid_key"},{"title":"Alt","value":"AIzaSy_invalid_key"}]';

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url, options) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: mockEnvConfig,
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        if (urlStr.includes('/api/cookies-status')) {
          return Promise.resolve({
            exists: false,
            size_bytes: 0,
            last_modified: null
          });
        }
        if (urlStr.includes('/api/validate-gemini-key')) {
          return Promise.resolve({
            status: 'invalid',
            results: [
              {
                key: 'AIzaSy_valid_key',
                status: 'valid',
                error: null,
                raw_error: null
              },
              {
                key: 'AIzaSy_invalid_key',
                status: 'invalid',
                error: 'Permission Denied (403): Project access is denied.',
                raw_error: '403 PERMISSION_DENIED: project 123'
              }
            ]
          });
        }
        return Promise.resolve({});
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    expect(vm.keysList.length).toBe(2);
    expect(vm.keysList[0].status).toBe('idle');
    expect(vm.keysList[1].status).toBe('idle');

    await vm.testApiKeys();

    expect(vm.keysList[0].status).toBe('valid');
    expect(vm.keysList[0].error).toBe('');
    expect(vm.keysList[1].status).toBe('invalid');
    expect(vm.keysList[1].error).toContain('Permission Denied');
    expect(vm.keysList[1].raw_error).toContain('403 PERMISSION_DENIED');
    expect(vm.keysList[1].showRawError).toBe(false);

    // Toggle details
    vm.keysList[1].showRawError = true;
    expect(vm.keysList[1].showRawError).toBe(true);

    expect(vm.testResult.status).toBe('invalid');
  });

  it('marks key status as unavailable (Service Busy) instead of invalid when Gemini returns 503', async () => {
    mockEnvConfig = '[{"title":"Main","value":"AIzaSy_healthy_key"}]';

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: mockEnvConfig,
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        if (urlStr.includes('/api/cookies-status')) {
          return Promise.resolve({
            exists: false,
            size_bytes: 0,
            last_modified: null
          });
        }
        if (urlStr.includes('/api/validate-gemini-key')) {
          return Promise.resolve({
            status: 'unavailable',
            results: [
              {
                key: 'AIzaSy_healthy_key',
                status: 'unavailable',
                error:
                  'Gemini is experiencing high demand (503) for Gemini 3.5 Flash-Lite.',
                raw_error: '503 UNAVAILABLE'
              }
            ]
          });
        }
        return Promise.resolve({});
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();

    const aiModelTabBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('AI Model'));
    expect(aiModelTabBtn).toBeDefined();
    await aiModelTabBtn!.trigger('click');
    await flushPromises();

    const testConnectionsBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Test Connections'));
    expect(testConnectionsBtn).toBeDefined();
    await testConnectionsBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Service Busy');
    expect(wrapper.text()).toContain('Gemini service temporarily unavailable');
    expect(wrapper.text()).not.toContain('Connection check failed');
    expect(wrapper.html()).toContain('bg-amber-500/10');
  });

  it('marks key status as unavailable instead of invalid when validate-gemini-key fails with a network error', async () => {
    mockEnvConfig = '[{"title":"Main","value":"AIzaSy_healthy_key"}]';

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: mockEnvConfig,
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        if (urlStr.includes('/api/cookies-status')) {
          return Promise.resolve({
            exists: false,
            size_bytes: 0,
            last_modified: null
          });
        }
        if (urlStr.includes('/api/validate-gemini-key')) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({});
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();

    const aiModelTabBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('AI Model'));
    expect(aiModelTabBtn).toBeDefined();
    await aiModelTabBtn!.trigger('click');
    await flushPromises();

    const testConnectionsBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Test Connections'));
    expect(testConnectionsBtn).toBeDefined();
    await testConnectionsBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Service Busy');
    expect(wrapper.text()).toContain('Gemini service temporarily unavailable');
    expect(wrapper.text()).not.toContain('Connection check failed');
    expect(wrapper.text()).not.toContain('Invalid');
  });

  it('renders YouTube Cookies active card, handles replace toggle and delete action', async () => {
    let deletedCalled = false;
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url, options) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/cookies-status')) {
          return Promise.resolve({
            exists: true,
            size_bytes: 5120,
            last_modified: '2026-08-25T08:00:00Z'
          });
        }
        if (urlStr.includes('/api/delete-cookies')) {
          deletedCalled = true;
          return Promise.resolve({ status: 'ok', message: 'Cookies deleted' });
        }
        return Promise.resolve({ settings: { GEMINI_API_KEY: '[]' } });
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    vm.switchTab('cookies');
    await wrapper.vm.$nextTick();

    expect(vm.cookiesStatus.exists).toBe(true);
    expect(wrapper.text()).toContain('cookies.txt');
    expect(wrapper.text()).toContain('Active');
    expect(wrapper.text()).toContain('Delete');
    expect(wrapper.text()).toContain('Replace');
    expect(wrapper.text()).toContain('Saved in the app');

    // Test delete cookies
    await vm.deleteCookies();
    expect(deletedCalled).toBe(true);
  });

  it('renders YouTube Cookies dropzone with expanded collapsible export guide when unconfigured', async () => {
    mockSystemHealth.value = {
      ffmpeg: { status: 'OK', path: '/opt/homebrew/bin/ffmpeg' },
      node: { status: 'OK', path: '/opt/homebrew/bin/node' },
      python_env: { status: 'OK', active: true },
      gemini_api: { status: 'Configured', has_key: true },
      cookies: { status: 'Missing', exists: false }
    };

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({
        exists: false,
        size_bytes: 0,
        last_modified: null
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    vm.switchTab('cookies');
    await wrapper.vm.$nextTick();

    expect(vm.cookiesStatus.exists).toBe(false);
    expect(wrapper.text()).not.toContain('No cookies configured');
    expect(wrapper.text()).toContain('How to export cookies.txt');
    const guide = wrapper.find('details.cookies-guide');
    expect(guide.exists()).toBe(true);
    expect((guide.element as HTMLDetailsElement).open).toBe(true);
    expect(wrapper.text()).toContain('Official yt-dlp Cookies Wiki');
    expect(wrapper.text()).toContain('Chrome / Edge / Brave');
    expect(wrapper.text()).toContain('Firefox');
    expect(wrapper.text()).toContain('youtube.com');
  });

  it('renders merged System tab with local tools, detected paths, and re-check action', async () => {
    mockSystemHealth.value = {
      ffmpeg: { status: 'OK', path: '/opt/homebrew/bin/ffmpeg' },
      node: { status: 'OK', path: '/opt/homebrew/bin/node' },
      python_env: { status: 'OK', active: true },
      gemini_api: { status: 'Configured', has_key: true },
      cookies: { status: 'Not Configured', exists: false }
    };

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: '[]',
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        return Promise.resolve({
          exists: false,
          size_bytes: 0,
          last_modified: null
        });
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    vm.switchTab('system');
    await wrapper.vm.$nextTick();

    const systemPanel = wrapper.find('#settings-system');
    expect(systemPanel.exists()).toBe(true);
    expect(systemPanel.text()).toContain('System');
    expect(systemPanel.text()).toContain('FFmpeg');
    expect(systemPanel.text()).toContain('Node.js');
    expect(systemPanel.text()).toContain('Python Environment');
    expect(systemPanel.text()).toContain('/opt/homebrew/bin/ffmpeg');
    expect(systemPanel.text()).toContain('/opt/homebrew/bin/node');
    expect(systemPanel.text()).toContain('Ready');
    expect(systemPanel.text()).not.toContain('Gemini');
    expect(systemPanel.text()).not.toContain('Cookies');
    expect(wrapper.text()).not.toContain('.env');
    expect(systemPanel.text()).not.toContain('FastAPI');
    expect(systemPanel.text()).not.toContain('Backend');

    const recheckBtn = systemPanel
      .findAll('button')
      .find(b => b.text().includes('Re-check'));
    expect(recheckBtn).toBeDefined();
    await recheckBtn!.trigger('click');
    expect(mockCheckSystemHealth).toHaveBeenCalled();
  });

  it('validates and saves FFmpeg and Node.js paths independently and handles reset to default', async () => {
    const savedPayloads: any[] = [];
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url, options) => {
        const urlStr = String(url);
        if (
          urlStr.includes('/api/system-settings') &&
          options?.method === 'PUT'
        ) {
          savedPayloads.push(options.body);
          return Promise.resolve({ status: 'ok' });
        }
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: '[]',
              FFMPEG_PATH: '',
              NODE_PATH: '/saved/bin/node'
            }
          });
        }
        if (urlStr.includes('/api/validate-binary-path')) {
          const body = options?.body as any;
          if (
            body?.path === '/custom/bin/ffmpeg' ||
            (body?.tool === 'node' && body?.path === '')
          ) {
            return Promise.resolve({
              valid: true,
              detected_path: body?.path || '/opt/homebrew/bin/node',
              message: 'Valid binary location.'
            });
          }
          return Promise.resolve({
            valid: false,
            detected_path: '',
            message: 'Path does not exist on this machine.'
          });
        }
        return Promise.resolve({
          exists: false,
          size_bytes: 0,
          last_modified: null
        });
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    vm.switchTab('system');
    await wrapper.vm.$nextTick();

    // 1. Enter valid custom path for FFmpeg and an invalid path for Node.js
    vm.ffmpegPath = '/custom/bin/ffmpeg';
    vm.nodePath = '/invalid/nonexistent/dir';

    // Saving FFmpeg succeeds independently without being blocked by Node.js
    await vm.saveBinaryPath('ffmpeg');
    expect(vm.ffmpegValidation.tested).toBe(true);
    expect(vm.ffmpegValidation.valid).toBe(true);
    expect(vm.savedFfmpegPath).toBe('/custom/bin/ffmpeg');
    expect(savedPayloads).toEqual([{ FFMPEG_PATH: '/custom/bin/ffmpeg' }]);

    // 2. Saving invalid Node.js path is blocked
    await vm.saveBinaryPath('node');
    expect(vm.nodeValidation.tested).toBe(true);
    expect(vm.nodeValidation.valid).toBe(false);
    expect(savedPayloads.length).toBe(1);

    // 3. Reset Node.js override clears input and persists empty NODE_PATH
    await vm.resetBinaryPath('node');
    expect(vm.nodePath).toBe('');
    expect(vm.savedNodePath).toBe('');
    expect(vm.nodeValidation.tested).toBe(false);
    expect(savedPayloads[1]).toEqual({ NODE_PATH: '' });
  });

  it('filters out default template placeholder your_gemini_api_key_here and shows empty state', async () => {
    mockEnvConfig = 'your_gemini_api_key_here';

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;
    vm.switchTab('api');
    await wrapper.vm.$nextTick();

    expect(vm.keysList).toEqual([]);
    expect(wrapper.text()).toContain('No API keys configured');
  });

  it('filters out placeholder keys from JSON array config', async () => {
    mockEnvConfig = JSON.stringify([
      { title: 'Dummy Key', value: 'your_gemini_api_key_here' },
      { title: 'Real Key', value: 'AIzaSyValidToken123456789' }
    ]);

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    expect(vm.keysList.length).toBe(1);
    expect(vm.keysList[0].title).toBe('Real Key');
    expect(vm.keysList[0].value).toBe('AIzaSyValidToken123456789');
  });

  it('renders hardware capability assistant card on Whisper tab in unscanned state', async () => {
    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;
    vm.switchTab('whisper');
    await flushPromises();

    expect(wrapper.text()).toContain('Transcription');
    expect(wrapper.text()).toContain('Calculate estimated transcription speed');
    expect(wrapper.text()).toContain('Calculate Speed');
  });

  it('triggers detectHardwareProfile on button click and renders Bento specs with recommendation and top-3 intent tiers', async () => {
    const fakeProfile = {
      cpu: { brand: 'Apple M3', arch: 'arm64', cores: 8, os: 'Darwin' },
      memory: { total_gb: 16.0 },
      gpu: {
        type: 'apple_silicon',
        name: 'Apple M3 (Unified Memory)',
        vram_gb: 16.0
      },
      recommended_model: 'small',
      recommendation_reason: 'Optimal balance for 16GB RAM.',
      top_intents: {
        fastest: {
          model: 'tiny',
          label: 'Fastest Draft',
          tag: 'Fastest',
          estimated_seconds: 3,
          display_time: '~3s / 60s clip',
          desc: 'Ultra-fast preview'
        },
        balanced: {
          model: 'small',
          label: 'Sweet Spot',
          tag: 'Balanced',
          estimated_seconds: 16,
          display_time: '~16s / 60s clip',
          desc: 'Best balance'
        },
        accurate: {
          model: 'medium',
          label: 'Best Accuracy',
          tag: 'Accurate',
          estimated_seconds: 39,
          display_time: '~39s / 60s clip',
          desc: 'High precision'
        }
      },
      model_estimates: {
        tiny: { estimated_seconds: 3, display_text: '~3s / 60s clip' },
        base: { estimated_seconds: 6, display_text: '~6s / 60s clip' },
        small: { estimated_seconds: 16, display_text: '~16s / 60s clip' },
        medium: { estimated_seconds: 39, display_text: '~39s / 60s clip' },
        'large-v3': { estimated_seconds: 84, display_text: '~84s / 60s clip' }
      },
      model_capacities: {
        tiny: { status: 'supported' },
        base: { status: 'supported' },
        small: { status: 'optimal' },
        medium: { status: 'supported' },
        'large-v3': { status: 'heavy', warning: 'Requires ~10 GB free memory.' }
      }
    };
    mockDetectHardwareProfile.mockImplementation(async () => {
      mockHardwareProfile.value = fakeProfile;
      return fakeProfile;
    });

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;
    vm.switchTab('whisper');
    await flushPromises();

    const detectBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Calculate Speed'));
    expect(detectBtn).toBeDefined();
    await detectBtn!.trigger('click');
    await flushPromises();

    expect(mockDetectHardwareProfile).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Apple M3');
    expect(wrapper.text()).toContain('16 GB RAM');
    expect(wrapper.text()).toContain('Re-scan');
    expect(wrapper.text()).toContain('Tiny');
    expect(wrapper.text()).toContain('Base');
    expect(wrapper.text()).toContain('Small');
    expect(wrapper.text()).toContain('Medium');
    expect(wrapper.text()).toContain('Large-v3');
    expect(wrapper.text()).toContain('~3s / 60s clip');
    expect(wrapper.text()).toContain('~16s / 60s clip');
    expect(wrapper.text()).toContain('~39s / 60s clip');

    // Click tiny model card to select tiny
    const tinyCard = wrapper
      .findAll('button')
      .find(b => b.text().includes('Tiny'));
    expect(tinyCard).toBeDefined();
    await tinyCard!.trigger('click');
    await flushPromises();

    expect(mockWhisperModel.value).toBe('tiny');

    // Click medium model card to select medium
    const mediumCard = wrapper
      .findAll('button')
      .find(b => b.text().includes('Medium'));
    expect(mediumCard).toBeDefined();
    await mediumCard!.trigger('click');
    await flushPromises();

    expect(mockWhisperModel.value).toBe('medium');
  });

  it('displays warning badge on heavy model cards', async () => {
    mockHardwareProfile.value = {
      cpu: { brand: 'Intel Core i3', arch: 'x86_64', cores: 2, os: 'Linux' },
      memory: { total_gb: 4.0 },
      gpu: { type: 'cpu', name: 'Standard CPU', vram_gb: null },
      recommended_model: 'tiny',
      recommendation_reason: 'System has 4GB RAM.',
      model_capacities: {
        tiny: { status: 'optimal' },
        base: { status: 'supported' },
        small: {
          status: 'heavy',
          warning: 'May cause delays on low-RAM systems.'
        },
        medium: {
          status: 'heavy',
          warning:
            'Requires ~5 GB free memory; may be slow or cause lag on your PC.'
        },
        'large-v3': {
          status: 'heavy',
          warning:
            'Requires ~10 GB free memory; likely slow on standard systems.'
        }
      }
    };

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;
    vm.switchTab('whisper');
    await flushPromises();

    expect(wrapper.text()).toContain(
      'Requires ~5 GB free memory; may be slow or cause lag on your PC.'
    );
    expect(wrapper.text()).toContain(
      'Requires ~10 GB free memory; likely slow on standard systems.'
    );
  });

  it('renames api tab to AI Model with Required badge when unconfigured and model pill once configured', async () => {
    mockEnvConfig = '';

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;

    let apiSection = vm.sections.find((s: any) => s.id === 'api');
    expect(apiSection.label).toBe('AI Model');
    expect(apiSection.badgeType).toBe('warning');
    expect(apiSection.badgeText).toBe('Required');

    // Warning status renders dot without bordered box; neutral values render plain text without dot or border
    let statusIndicators = wrapper.findAll('[data-testid="section-status"]');
    expect(statusIndicators.length).toBe(4);
    expect(statusIndicators[0]?.text()).toBe('Required');
    expect(statusIndicators[0]?.classes()).not.toContain('border');
    expect(statusIndicators[0]?.find('span.rounded-full').exists()).toBe(true);
    expect(statusIndicators[1]?.text()).toBe('Base');
    expect(statusIndicators[1]?.classes()).not.toContain('border');
    expect(statusIndicators[1]?.find('span.rounded-full').exists()).toBe(false);
    expect(statusIndicators[2]?.text()).toBe('Optional');
    expect(statusIndicators[2]?.find('span.rounded-full').exists()).toBe(false);
    expect(statusIndicators[3]?.text()).toBe('OK');
    expect(statusIndicators[3]?.classes()).not.toContain('border');
    expect(statusIndicators[3]?.find('span.rounded-full').exists()).toBe(true);

    mockSystemHealth.value = { gemini_api: { has_key: true } };
    await wrapper.vm.$nextTick();

    apiSection = vm.sections.find((s: any) => s.id === 'api');
    expect(apiSection.badgeType).toBe('neutral');
    expect(apiSection.badgeText).toBe('4 Hydrogen');

    statusIndicators = wrapper.findAll('[data-testid="section-status"]');
    expect(statusIndicators[0]?.text()).toBe('4 Hydrogen');
    expect(statusIndicators[0]?.classes()).not.toContain('border');
    expect(statusIndicators[0]?.find('span.rounded-full').exists()).toBe(false);
  });

  it('hydrates GEMINI_MODEL (normalizing legacy 2.5), auto-saves selection changes, and sends model_name on key validation', async () => {
    let putBodies: any[] = [];
    let validateBody: any = null;

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url, options) => {
        const urlStr = String(url);
        if (
          urlStr.includes('/api/system-settings') &&
          options?.method === 'PUT'
        ) {
          putBodies.push(options.body);
          return Promise.resolve({ status: 'ok' });
        }
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: 'AIzaSy_test_key',
              GEMINI_MODEL: 'gemini-2.5-flash',
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        if (urlStr.includes('/api/validate-gemini-key')) {
          validateBody = options?.body;
          return Promise.resolve({
            status: 'valid',
            results: [
              {
                key: 'AIzaSy_test_key',
                status: 'valid',
                error: null,
                raw_error: null
              }
            ]
          });
        }
        return Promise.resolve({});
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;
    expect(vm.selectedGeminiModel).toBe('gemini-4-hydrogen');

    vm.switchTab('api');
    await wrapper.vm.$nextTick();

    const select = wrapper.find('#hook-discovery-model-select');
    expect(select.exists()).toBe(true);
    expect(select.find('option[value="gemini-4-hydrogen"]').exists()).toBe(
      true
    );
    await select.setValue('gemini-3.8-flash');
    await flushPromises();

    expect(putBodies).toEqual([{ GEMINI_MODEL: 'gemini-3.8-flash' }]);
    expect(mockGeminiModel.value).toBe('gemini-3.8-flash');
    expect(mockShowToast).toHaveBeenCalledWith(
      'Hook Discovery Model switched to Gemini 3.8 Flash.',
      'success'
    );

    await vm.testApiKeys();
    expect(validateBody).toMatchObject({ model_name: 'gemini-3.8-flash' });
  });

  it('rolls back selectedGeminiModel and displays error alert if PUT fails', async () => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation((url, options) => {
        const urlStr = String(url);
        if (
          urlStr.includes('/api/system-settings') &&
          options?.method === 'PUT'
        ) {
          return Promise.reject({
            data: { detail: 'Unsupported Hook Discovery Model' }
          });
        }
        if (urlStr.includes('/api/system-settings')) {
          return Promise.resolve({
            settings: {
              GEMINI_API_KEY: 'AIzaSy_test_key',
              GEMINI_MODEL: 'gemini-3.6-flash',
              FFMPEG_PATH: '',
              NODE_PATH: ''
            }
          });
        }
        return Promise.resolve({});
      })
    );

    const wrapper = mount(HomeSettings, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    await flushPromises();
    const vm = wrapper.vm as any;
    vm.switchTab('api');
    await wrapper.vm.$nextTick();

    expect(vm.selectedGeminiModel).toBe('gemini-3.6-flash');

    const select = wrapper.find('#hook-discovery-model-select');
    await select.setValue('gemini-3.8-flash');
    await flushPromises();

    expect(vm.selectedGeminiModel).toBe('gemini-3.6-flash');
    expect(mockGeminiModel.value).toBe('gemini-3.6-flash');
    expect(wrapper.find('[role="alert"]').text()).toContain(
      'Unsupported Hook Discovery Model'
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.stringContaining('Failed to switch Hook Discovery Model'),
      'error'
    );
  });
});
