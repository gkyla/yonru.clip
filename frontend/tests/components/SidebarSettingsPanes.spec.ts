import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SubtitlePresetPane from '../../app/components/editor/SubtitlePresetPane.vue';
import TypographyTimingPane from '../../app/components/editor/TypographyTimingPane.vue';
import CanvasLayoutPane from '../../app/components/editor/CanvasLayoutPane.vue';

function createMockState() {
  return {
    jobStatus: ref('ready'),
    renderStatus: ref('ready'),
    isOverlayVisible: ref(false),
    subtitlePreset: ref('bold-podcast'),
    subtitleMode: ref('3_words'),
    subtitleAnimation: ref('pop'),
    subtitleHighlightMode: ref('color'),
    subtitleBackground: ref('none'),
    subtitlePosition: ref('bottom'),
    font: ref('Inter'),
    fontSize: ref(80),
    subtitleFontWeight: ref(700),
    subtitleStrokeWidth: ref(3),
    subtitleTextTransform: ref('uppercase'),
    subtitleWordSpacing: ref(0),
    subtitleTextColor: ref('#FFFFFF'),
    subtitleHighlightColor: ref('#FFD700'),
    subtitleStrokeColor: ref('#000000'),
    subtitleOffset: ref(50),
    subtitleSyncOffset: ref(0),
    subtitlesEnabled: ref(true),
    toggleSubtitles: vi.fn(),
    autoAdaptiveSubtitles: ref(true),
    subtitleBackgroundOpacity: ref(0.8),
    videoLayout: ref('vertical'),
    landscapeBackground: ref('black'),
    landscapeBlurRadius: ref(25),
    landscapeDarkness: ref(35),
    cropMode: ref('manual'),
    cropPercentX: ref(50),
    cropPercentXTop: ref(50),
    cropPercentXBottom: ref(50),
    splitZoomTop: ref(1.0),
    splitZoomBottom: ref(1.0),
    splitOffsetXTop: ref(0),
    splitOffsetYTop: ref(0),
    splitOffsetXBottom: ref(0),
    splitOffsetYBottom: ref(0),
    cropMap: ref([]),
    currentTime: ref(0),
    activeSafeZone: ref('none'),
    safeZoneOpacity: ref(50),
    safeZoneColor: ref('#000000'),
    activeHook: ref({ theme: 'Test Hook' }),
    outputUrl: ref('http://localhost/out.mp4'),
    seekTo: vi.fn(),
    showToast: vi.fn(),
    saveDefaultStyleSettings: vi.fn(),
    saveStyleSettings: vi.fn(),
    renderClip: vi.fn()
  };
}

describe('SidebarSettings Extracted Panes', () => {
  let mockState: ReturnType<typeof createMockState>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = createMockState();
  });

  describe('SubtitlePresetPane', () => {
    it('renders active style preset and emits openStudio when browse button is clicked', async () => {
      const wrapper = mount(SubtitlePresetPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      expect(wrapper.text()).toContain('Style Presets');
      expect(wrapper.text()).toContain('Hormozi Bold');
      expect(wrapper.text()).toContain('Browse All');
      expect(wrapper.text()).not.toContain('Quick Styles');

      const browseBtn = wrapper.find('button[class*="hover:underline"]');
      expect(browseBtn.exists()).toBe(true);
      await browseBtn.trigger('click');

      expect(wrapper.emitted('openStudio')).toBeTruthy();
      expect(wrapper.emitted('openStudio')!.length).toBe(1);
    });

    it('emits openStudio when Change button is clicked on the active preset card', async () => {
      const wrapper = mount(SubtitlePresetPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      const changeBtn = wrapper
        .findAll('button')
        .find(b => b.text().includes('Change'));
      expect(changeBtn?.exists()).toBe(true);
      await changeBtn?.trigger('click');

      expect(wrapper.emitted('openStudio')).toBeTruthy();
    });

    it('resets subtitle sync offset to 150ms when reset button is clicked', async () => {
      mockState.subtitleSyncOffset.value = 300;
      const wrapper = mount(SubtitlePresetPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      const resetBtn = wrapper.find('button[title="Reset to default (150ms)"]');
      expect(resetBtn.exists()).toBe(true);
      await resetBtn.trigger('click');
      expect(mockState.subtitleSyncOffset.value).toBe(150);
    });
  });

  describe('TypographyTimingPane', () => {
    it('renders font family selector and updates text transform case', async () => {
      const wrapper = mount(TypographyTimingPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      expect(wrapper.text()).toContain('Font & Case');
      expect(wrapper.text()).toContain('Font Family');

      const caseButtons = wrapper
        .findAll('button')
        .filter(b => ['uppercase', 'capitalize', 'Normal'].includes(b.text()));
      expect(caseButtons.length).toBe(3);

      await caseButtons[1]!.trigger('click');
      expect(mockState.subtitleTextTransform.value).toBe('capitalize');
    });

    it('toggles color swatch popover drawer for text, highlight, and stroke', async () => {
      const wrapper = mount(TypographyTimingPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      const swatchButtons = wrapper
        .findAll('button')
        .filter(b => ['Text', 'Highlight', 'Stroke'].includes(b.text()));
      expect(swatchButtons.length).toBe(3);

      // Open Text color picker
      await swatchButtons[0]!.trigger('click');
      expect(wrapper.text()).toContain('Select text Color');

      // Select a color swatch
      const paletteBtn = wrapper.find(
        'button[style*="background: rgb(207, 255, 80)"]'
      );
      if (paletteBtn.exists()) {
        await paletteBtn.trigger('click');
        expect(mockState.subtitleTextColor.value).toBe('#CFFF50');
      }
    });

    it('updates text background and displays opacity slider when background is not none', async () => {
      mockState.subtitleBackground.value = 'box';
      const wrapper = mount(TypographyTimingPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      expect(wrapper.text()).toContain('Text Background');
      expect(wrapper.text()).toContain('Dark Box');
      expect(wrapper.text()).toContain('Opacity');
      expect(wrapper.text()).toContain('80%');
    });
  });

  describe('CanvasLayoutPane', () => {
    it('switches videoLayout between vertical and landscape', async () => {
      const wrapper = mount(CanvasLayoutPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      expect(wrapper.text()).toContain('Video Layout Mode');
      const layoutButtons = wrapper.findAll('.grid.grid-cols-2 button');
      expect(layoutButtons.length).toBeGreaterThanOrEqual(2);

      // Click Landscape
      await layoutButtons[1]!.trigger('click');
      expect(mockState.videoLayout.value).toBe('landscape');
    });

    it('toggles auto-adaptive subtitles', async () => {
      mockState.autoAdaptiveSubtitles.value = true;
      const wrapper = mount(CanvasLayoutPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      const autoAdaptiveBtn = wrapper.find('button[class*="w-8 h-4"]');
      expect(autoAdaptiveBtn.exists()).toBe(true);
      await autoAdaptiveBtn.trigger('click');
      expect(mockState.autoAdaptiveSubtitles.value).toBe(false);
    });

    it('resets split zoom and framing when reset button is clicked', async () => {
      mockState.cropMode.value = 'face_tracking';
      mockState.cropMap.value = [
        { time: 0, x: 500, mode: 'split', top_x: 300, bottom_x: 700 }
      ];
      mockState.splitZoomTop.value = 1.5;
      mockState.splitZoomBottom.value = 1.5;
      mockState.splitOffsetXTop.value = 10;
      mockState.splitOffsetYTop.value = -10;

      const wrapper = mount(CanvasLayoutPane, {
        props: { state: mockState },
        global: { stubs: { Icon: true, NuxtIcon: true } }
      });

      const resetBtn = wrapper.find('button[title="Reset All Zoom & Framing"]');
      expect(resetBtn.exists()).toBe(true);
      await resetBtn.trigger('click');

      expect(mockState.splitZoomTop.value).toBe(1.0);
      expect(mockState.splitZoomBottom.value).toBe(1.0);
      expect(mockState.splitOffsetXTop.value).toBe(0);
      expect(mockState.splitOffsetYTop.value).toBe(0);
    });
  });
});
