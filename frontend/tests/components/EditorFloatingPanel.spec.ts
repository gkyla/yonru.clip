// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import EditorFloatingPanel from '../../app/components/editor/EditorFloatingPanel.vue';
import { SubtitleLayoutEngine } from '../../app/utils/subtitleChunker';

const mockCurrentTime = ref(0);
const mockSubtitleMode = ref('word');
const mockSubtitleSyncOffset = ref(0);
const mockSubtitlesEnabled = ref(true);
const mockThumbnailEnabled = ref(false);
const mockThumbnailDuration = ref(0);
const mockIsSessionSaving = ref(false);
const mockActiveHook = ref<any>({
  start: 0,
  end: 10,
  theme: 'Hook Theme',
  transcript_quote: 'Hello world from Yonru'
});
const mockFullTranscript = ref([
  { text: 'hello', start: 0, duration: 1 },
  { text: 'world', start: 1, duration: 1 },
  { text: 'clip', start: 2, duration: 1 }
]);

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => ({
    currentTime: mockCurrentTime,
    subtitleMode: mockSubtitleMode,
    subtitleSyncOffset: mockSubtitleSyncOffset,
    subtitlesEnabled: mockSubtitlesEnabled,
    thumbnailEnabled: mockThumbnailEnabled,
    thumbnailDuration: mockThumbnailDuration,
    isSessionSaving: mockIsSessionSaving,
    activeHook: mockActiveHook,
    fullTranscript: mockFullTranscript,
    hooks: ref([mockActiveHook.value]),
    savedHooks: ref([]),
    seekTo: vi.fn(),
    toggleSubtitles: vi.fn(),
    scheduleSessionSave: vi.fn()
  })
}));

describe('EditorFloatingPanel Gating & Local State Persistence', () => {
  beforeEach(() => {
    mockCurrentTime.value = 0;
  });

  it('performs 0 findChunkIndexAt scans while closed or on quote/thumbnail tabs and preserves auto-scroll toggle', async () => {
    const findSpy = vi.spyOn(
      SubtitleLayoutEngine.prototype,
      'findChunkIndexAt'
    );

    const wrapper = mount(EditorFloatingPanel, {
      props: {
        isPanelOpen: false,
        editorTab: 'edit'
      },
      global: {
        stubs: {
          Icon: true,
          CoverEditor: true,
          Transition: { template: '<div><slot /></div>' }
        }
      }
    });

    // Closed panel: ticking currentTime does ZERO chunk lookups
    for (const t of [0.2, 1.4, 2.3]) {
      mockCurrentTime.value = t;
      await nextTick();
    }
    expect(findSpy).toHaveBeenCalledTimes(0);

    // Open on quote tab: ticking currentTime does ZERO chunk lookups
    await wrapper.setProps({ isPanelOpen: true, editorTab: 'quote' });
    mockCurrentTime.value = 0.5;
    await nextTick();
    mockCurrentTime.value = 1.5;
    await nextTick();
    expect(findSpy).toHaveBeenCalledTimes(0);

    // Open on thumbnail tab: ticking currentTime does ZERO chunk lookups
    await wrapper.setProps({ isPanelOpen: true, editorTab: 'thumbnail' });
    mockCurrentTime.value = 2.5;
    await nextTick();
    expect(findSpy).toHaveBeenCalledTimes(0);

    // Open on edit tab: active chunk lookup activates and highlights active segment
    await wrapper.setProps({ isPanelOpen: true, editorTab: 'edit' });
    mockCurrentTime.value = 1.5;
    await nextTick();
    expect(findSpy).toHaveBeenCalled();

    const seg1 = wrapper.find('#seg-1');
    expect(seg1.exists()).toBe(true);
    expect(seg1.classes().join(' ')).toContain('border-accent-500/60');

    // Toggle Auto-Scroll OFF, close panel, reopen -> local toggle state persists
    const autoScrollBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('Auto-Scroll'));
    expect(autoScrollBtn).toBeDefined();
    await autoScrollBtn!.trigger('click');
    expect(wrapper.text()).toContain('Auto-Scroll OFF');

    await wrapper.setProps({ isPanelOpen: false });
    await nextTick();
    await wrapper.setProps({ isPanelOpen: true });
    await nextTick();
    expect(wrapper.text()).toContain('Auto-Scroll OFF');

    findSpy.mockRestore();
  });
});
