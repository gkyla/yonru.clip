import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SafetyGeneralPane from '../../app/components/safety/SafetyGeneralPane.vue';
import SafetyCategoriesPane from '../../app/components/safety/SafetyCategoriesPane.vue';
import SafetyBlacklistPane from '../../app/components/safety/SafetyBlacklistPane.vue';
import SafetyWhitelistPane from '../../app/components/safety/SafetyWhitelistPane.vue';

function createMockSafetyState() {
  const saveBlacklistToStorage = vi.fn();
  const selectBleepAudio = vi.fn((id: string) => {
    state.selectedBleepAudioId.value = id;
  });
  const addCustomBleepFile = vi.fn((file: any) => {
    const item = {
      id: 'custom_' + Date.now(),
      name: file.name,
      data: file.data,
      isPreset: false
    };
    state.bleepLibrary.value.push(item);
    state.selectedBleepAudioId.value = item.id;
    return item;
  });
  const removeCustomBleepFile = vi.fn((id: string) => {
    state.bleepLibrary.value = state.bleepLibrary.value.filter(
      i => i.id !== id
    );
    state.selectedBleepAudioId.value = 'default_preset';
  });

  const state = {
    customBlacklist: ref<string[]>([]),
    customWhitelist: ref<string[]>([]),
    safetySensitivity: ref<'strict' | 'standard' | 'manual'>('standard'),
    maskingStyle: ref('asterisk'),
    audioBleepEnabled: ref(false),
    audioBleepSource: ref('mute'),
    bleepLibrary: ref<any[]>([
      {
        id: 'default_preset',
        name: 'Standard Bleep',
        data: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=',
        isPreset: true
      }
    ]),
    selectedBleepAudioId: ref('default_preset'),
    customBleepFile: ref<any>(null),
    bleepPaddingOffset: ref(0),
    activeCategories: ref<Record<string, boolean>>({
      violence: true,
      sexual: true,
      profanity: true
    }),
    categorizedBlacklist: ref<Record<string, string[]>>({
      violence: ['kill', 'death', 'murder'],
      sexual: ['porn', 'kontol'],
      profanity: ['f*ck', 'shit']
    }),
    saveBlacklistToStorage,
    selectBleepAudio,
    addCustomBleepFile,
    removeCustomBleepFile
  };

  return state;
}

describe('SafetyPanes Component Suite', () => {
  const globalStubs = {
    stubs: {
      Icon: true,
      NuxtIcon: true
    }
  };

  describe('SafetyGeneralPane', () => {
    let mockState: ReturnType<typeof createMockSafetyState>;

    beforeEach(() => {
      mockState = createMockSafetyState();
    });

    it('renders safety sensitivity options and switches sensitivity', async () => {
      const wrapper = mount(SafetyGeneralPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Safety Filter Scope');
      const strictBtn = wrapper
        .findAll('button')
        .find(b => b.text() === 'Strict');
      expect(strictBtn).toBeDefined();

      await strictBtn!.trigger('click');
      expect(mockState.safetySensitivity.value).toBe('strict');
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('updates masking style select input', async () => {
      const wrapper = mount(SafetyGeneralPane, {
        props: { state: mockState },
        global: globalStubs
      });

      const select = wrapper.find('select');
      expect(select.exists()).toBe(true);
      await select.setValue('block');

      expect(mockState.maskingStyle.value).toBe('block');
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('toggles audio bleep checkbox and shows audio source options', async () => {
      const wrapper = mount(SafetyGeneralPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).not.toContain('Bleep Sound Type');

      mockState.audioBleepEnabled.value = true;
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Bleep Sound Type');
      const customSoundBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Custom Sound File'));
      expect(customSoundBtn).toBeDefined();

      await customSoundBtn!.trigger('click');
      expect(mockState.audioBleepSource.value).toBe('custom');
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('manages timing padding buffer slider and reset button', async () => {
      mockState.audioBleepEnabled.value = true;
      mockState.bleepPaddingOffset.value = 50;

      const wrapper = mount(SafetyGeneralPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('50ms');
      const resetBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Reset'));
      expect(resetBtn).toBeDefined();

      await resetBtn!.trigger('click');
      expect(mockState.bleepPaddingOffset.value).toBe(0);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });
  });

  describe('SafetyCategoriesPane', () => {
    let mockState: ReturnType<typeof createMockSafetyState>;

    beforeEach(() => {
      mockState = createMockSafetyState();
    });

    it('shows banner when manual sensitivity mode is active and allows standard switch', async () => {
      mockState.safetySensitivity.value = 'manual';

      const wrapper = mount(SafetyCategoriesPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Kategori Bawaan Sedang Dinonaktifkan');
      const activateBtn = wrapper.find('button');
      await activateBtn.trigger('click');

      expect(mockState.safetySensitivity.value).toBe('standard');
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('toggles active category checkbox', async () => {
      const wrapper = mount(SafetyCategoriesPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('violence');
      const violenceCheckbox = wrapper.find('input[type="checkbox"]');
      expect(violenceCheckbox.exists()).toBe(true);

      await violenceCheckbox.setValue(false);
      expect(mockState.activeCategories.value.violence).toBe(false);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('allows toggling edit mode and adding tokens to category', async () => {
      const wrapper = mount(SafetyCategoriesPane, {
        props: { state: mockState },
        global: globalStubs
      });

      // Find Edit button for violence
      const editBtn = wrapper.findAll('button').find(b => b.text() === 'Edit');
      expect(editBtn).toBeDefined();
      await editBtn!.trigger('click');

      const input = wrapper.find('input[placeholder*="Tambahkan kata"]');
      expect(input.exists()).toBe(true);

      await input.setValue('stab, slash');
      const addBtn = wrapper.findAll('button').find(b => b.text() === 'Add');
      expect(addBtn).toBeDefined();
      await addBtn!.trigger('click');

      expect(mockState.categorizedBlacklist.value.violence).toContain('stab');
      expect(mockState.categorizedBlacklist.value.violence).toContain('slash');
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });
  });

  describe('SafetyBlacklistPane', () => {
    let mockState: ReturnType<typeof createMockSafetyState>;

    beforeEach(() => {
      mockState = createMockSafetyState();
    });

    it('renders empty state when blacklist is empty', () => {
      const wrapper = mount(SafetyBlacklistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Tidak ada kata kustom');
      expect(wrapper.text()).toContain('Total Kustom: 0 kata');
    });

    it('adds tokens from multi-word comma separated string', async () => {
      const wrapper = mount(SafetyBlacklistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      const input = wrapper.find('input[placeholder*="Tambah kata kustom"]');
      await input.setValue('spamd, scams, phishing');

      const addBtn = wrapper.findAll('button').find(b => b.text() === 'Add');
      expect(addBtn).toBeDefined();
      await addBtn!.trigger('click');

      expect(mockState.customBlacklist.value).toEqual([
        'spamd',
        'scams',
        'phishing'
      ]);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('filters words by search query and deletes a chip', async () => {
      mockState.customBlacklist.value = ['apple', 'banana', 'cherry'];

      const wrapper = mount(SafetyBlacklistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('apple');
      expect(wrapper.text()).toContain('banana');

      const searchInput = wrapper.find('input[placeholder*="Cari kata"]');
      await searchInput.setValue('ban');

      expect(wrapper.text()).toContain('banana');
      expect(wrapper.text()).not.toContain('apple');

      // Clear search to show all
      await searchInput.setValue('');
      const deleteButtons = wrapper.findAll('button[title="Hapus kata"]');
      expect(deleteButtons.length).toBe(3);

      await deleteButtons[0].trigger('click');
      expect(mockState.customBlacklist.value).toEqual(['banana', 'cherry']);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('clears all custom blacklist when reset confirmed', async () => {
      mockState.customBlacklist.value = ['test1', 'test2'];
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const wrapper = mount(SafetyBlacklistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      const clearBtn = wrapper
        .findAll('button')
        .find(b => b.text() === 'Bersihkan Semua');
      expect(clearBtn).toBeDefined();
      await clearBtn!.trigger('click');

      expect(mockState.customBlacklist.value).toEqual([]);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });
  });

  describe('SafetyWhitelistPane', () => {
    let mockState: ReturnType<typeof createMockSafetyState>;

    beforeEach(() => {
      mockState = createMockSafetyState();
    });

    it('renders empty state when whitelist is empty', () => {
      const wrapper = mount(SafetyWhitelistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      expect(wrapper.text()).toContain('Daftar Whitelist Kosong');
      expect(wrapper.text()).toContain('Total Pengecualian: 0 kata');
    });

    it('adds tokens and removes a token correctly', async () => {
      const wrapper = mount(SafetyWhitelistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      const input = wrapper.find('input[placeholder*="Tambah pengecualian"]');
      await input.setValue('safe_word, allowed_term');

      const addBtn = wrapper.findAll('button').find(b => b.text() === 'Add');
      await addBtn!.trigger('click');

      expect(mockState.customWhitelist.value).toEqual([
        'safe_word',
        'allowed_term'
      ]);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();

      const deleteBtn = wrapper.find('button[title="Hapus pengecualian"]');
      await deleteBtn.trigger('click');

      expect(mockState.customWhitelist.value).toEqual(['allowed_term']);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });

    it('resets all whitelist when confirmed', async () => {
      mockState.customWhitelist.value = ['whitelist1'];
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const wrapper = mount(SafetyWhitelistPane, {
        props: { state: mockState },
        global: globalStubs
      });

      const clearBtn = wrapper
        .findAll('button')
        .find(b => b.text() === 'Bersihkan Semua');
      await clearBtn!.trigger('click');

      expect(mockState.customWhitelist.value).toEqual([]);
      expect(mockState.saveBlacklistToStorage).toHaveBeenCalled();
    });
  });
});
