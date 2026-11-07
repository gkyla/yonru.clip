// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import TimelineEditor from '../../app/components/TimelineEditor.vue';
import { ref } from 'vue';

const mockCurrentTime = ref(0);
const mockIsPlaying = ref(false);
const mockSeekTo = vi.fn((t: number) => {
  mockCurrentTime.value = t;
});

const mockState = {
  currentTime: mockCurrentTime,
  isPlaying: mockIsPlaying,
  timelineDuration: ref(60),
  videoDuration: ref(60),
  thumbnailEnabled: ref(false),
  thumbnailDuration: ref(3),
  useNativePlayer: ref(false),
  canUndo: ref(false),
  canRedo: ref(false),
  isSavingHistory: ref(false),
  volume: ref(1),
  videoLayout: ref('portrait'),
  selectedTimelineItem: ref<any>(null),
  outputUrl: ref<string | null>(null),
  isRenderPreviewActive: ref(false),
  isEditorLocked: ref(false),
  renderStatus: ref('ready'),
  contentAudit: ref({ flaggedSegments: [] }),
  timelineTracks: ref([
    {
      id: 'video',
      name: 'Video',
      type: 'video',
      items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 30 }]
    },
    {
      id: 'subtitle',
      name: 'Subtitle',
      type: 'subtitle',
      items: [{ id: 's1', content: 'Hello world', start: 0, duration: 10 }]
    }
  ]),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },
  seekTo: mockSeekTo,
  addTimelineItem: vi.fn(),
  saveTimelineTracks: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  commitToHistory: vi.fn(),
  showToast: vi.fn()
};

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState,
  FONT_OPTIONS: ['Inter', 'Montserrat', 'Roboto', 'Arial']
}));

describe('TimelineEditor Component', () => {
  beforeEach(() => {
    mockCurrentTime.value = 0;
    mockIsPlaying.value = false;
    mockSeekTo.mockClear();
    mockState.selectedTimelineItem.value = null;
  });

  afterEach(() => {
    mockIsPlaying.value = false;
  });

  it('renders timeline tracks and playhead at initial position 0', () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.tl-scroll').exists()).toBe(true);
    expect(mockCurrentTime.value).toBe(0);
  });

  it('does not mutate currentTime when timeline viewport is scrolled manually', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const scrollEl = wrapper.find('.tl-scroll');
    expect(scrollEl.exists()).toBe(true);

    // Simulate user scrolling viewport to the right (e.g. 500px)
    const element = scrollEl.element as HTMLElement;
    Object.defineProperty(element, 'scrollLeft', {
      value: 500,
      writable: true
    });
    Object.defineProperty(element, 'clientWidth', {
      value: 800,
      writable: true
    });

    await scrollEl.trigger('scroll');

    // Current playhead time MUST remain 0 (decoupled viewport)
    expect(mockCurrentTime.value).toBe(0);
  });

  it('seeks to calculated time when user clicks on the ruler', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const rulerContainer = wrapper.find('.ruler-container');
    expect(rulerContainer.exists()).toBe(true);

    // Mock getBoundingClientRect
    vi.spyOn(rulerContainer.element, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 0,
      width: 2000,
      height: 20,
      right: 2100,
      bottom: 20,
      x: 100,
      y: 0,
      toJSON: () => {}
    });

    // Click at clientX = 500 (offset from left = 400px, at 50px/sec => 8s)
    await wrapper.find('.timeline-ruler').trigger('mousedown', {
      button: 0,
      clientX: 500
    });

    expect(mockSeekTo).toHaveBeenCalled();
    const seekArg = mockSeekTo.mock.calls[0][0];
    expect(seekArg).toBeGreaterThan(0);
    expect(seekArg).toBeLessThanOrEqual(60);
  });

  it('keeps scroll position at the end after playback has finished and reset to 0', async () => {
    vi.useFakeTimers();
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const scrollEl = wrapper.find('.tl-scroll');
    const element = scrollEl.element as HTMLElement;
    Object.defineProperty(element, 'scrollLeft', { value: 0, writable: true });
    Object.defineProperty(element, 'clientWidth', {
      value: 800,
      writable: true
    });

    // 1. Play starts
    mockIsPlaying.value = true;
    await wrapper.vm.$nextTick();

    // 2. Playback finishes, time resets to 0, playing becomes false
    mockCurrentTime.value = 60;
    await wrapper.vm.$nextTick();
    mockIsPlaying.value = false;
    mockCurrentTime.value = 0;
    await wrapper.vm.$nextTick();

    // 3. User scrolls to 1200px
    element.scrollLeft = 1200;
    await scrollEl.trigger('scroll');

    // 4. Fast forward past isUserScrolling timeout (150ms)
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();

    // 5. Background time update arrives while paused
    mockCurrentTime.value = 0.001;
    await wrapper.vm.$nextTick();

    expect(element.scrollLeft).toBe(1200);
    vi.useRealTimers();
  });

  it('smoothly scrolls viewport to center playhead on discrete ruler click', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const scrollEl = wrapper.find('.tl-scroll');
    const element = scrollEl.element as HTMLElement;
    element.scrollTo = vi.fn();
    Object.defineProperty(element, 'clientWidth', {
      value: 800,
      writable: true
    });

    const rulerContainer = wrapper.find('.ruler-container');
    vi.spyOn(rulerContainer.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 3000,
      height: 20,
      right: 3000,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Discrete click on ruler at clientX = 1500 (second 30 at 50px/sec)
    await wrapper.find('.timeline-ruler').trigger('mousedown', {
      button: 0,
      clientX: 1500
    });
    window.dispatchEvent(new MouseEvent('mouseup'));
    await wrapper.vm.$nextTick();

    expect(element.scrollTo).toHaveBeenCalledWith({
      left: expect.any(Number),
      behavior: 'smooth'
    });
  });

  it('does not set isUserScrolling during active playback scroll events', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const scrollEl = wrapper.find('.tl-scroll');
    mockIsPlaying.value = true;
    await wrapper.vm.$nextTick();

    // Trigger scroll event during active playback (as dispatched by startRaf)
    await scrollEl.trigger('scroll');

    const vm = wrapper.vm as any;
    expect(vm.isUserScrolling).toBe(false);
  });

  it('smoothly centers playhead after drag scrub release', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const scrollEl = wrapper.find('.tl-scroll');
    const element = scrollEl.element as HTMLElement;
    element.scrollTo = vi.fn();
    Object.defineProperty(element, 'clientWidth', {
      value: 800,
      writable: true
    });

    const rulerContainer = wrapper.find('.ruler-container');
    vi.spyOn(rulerContainer.element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 3000,
      height: 20,
      right: 3000,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    // Start scrub at clientX = 500
    await wrapper.find('.timeline-ruler').trigger('mousedown', {
      button: 0,
      clientX: 500
    });

    // Drag to clientX = 1200
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1200 }));
    await wrapper.vm.$nextTick();

    // Release mouse
    window.dispatchEvent(new MouseEvent('mouseup'));
    await wrapper.vm.$nextTick();

    expect(element.scrollTo).toHaveBeenCalledWith({
      left: expect.any(Number),
      behavior: 'smooth'
    });
  });

  it('dims timeline and suppresses keyboard shortcuts when render preview / editor locked is active', async () => {
    mockState.isEditorLocked.value = true;
    mockState.outputUrl.value = 'http://localhost/out.mp4';
    mockState.isRenderPreviewActive.value = true;

    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          TimelinePropertiesInspector: true
        }
      }
    });

    const root = wrapper.find('div');
    expect(root.classes()).toContain('opacity-40');
    expect(root.classes()).toContain('pointer-events-none');

    const togglePlaySpy = vi.spyOn(wrapper.vm as any, 'togglePlay');

    // Space keydown should be blocked
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', code: 'Space' })
    );
    await wrapper.vm.$nextTick();

    expect(togglePlaySpy).not.toHaveBeenCalled();

    // Reset lock
    mockState.isEditorLocked.value = false;
    mockState.outputUrl.value = null;
    mockState.isRenderPreviewActive.value = false;
  });

  it('renders Cover Slide intro zone across non-video tracks and aligns 2 adjacent 5s text blocks', async () => {
    mockState.thumbnailEnabled.value = true;
    mockState.thumbnailDuration.value = 1.5;
    const prevTracks = mockState.timelineTracks.value;
    mockState.timelineTracks.value = [
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 12 }]
      },
      {
        id: 'text',
        name: 'Text layers',
        type: 'text',
        items: [
          { id: 't1', content: 'Layer 1', start: 0, duration: 5 },
          { id: 't2', content: 'Layer 2', start: 5, duration: 5 }
        ]
      }
    ];

    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          Teleport: true,
          Transition: true,
          TimelinePropertiesInspector: true
        }
      }
    });

    const coverZones = wrapper.findAll('[data-testid="cover-slide-zone"]');
    expect(coverZones.length).toBe(1);
    expect(coverZones[0]!.attributes('style')).toContain('width: 150px');

    const textBlocks = wrapper
      .findAll('.tl-scroll .cursor-move')
      .filter(el => el.text().includes('Layer'));
    expect(textBlocks).toHaveLength(2);
    expect(textBlocks[0]!.attributes('style')).toContain('left: 150px');
    expect(textBlocks[0]!.attributes('style')).toContain('width: 500px');
    expect(textBlocks[1]!.attributes('style')).toContain('left: 650px');
    expect(textBlocks[1]!.attributes('style')).toContain('width: 500px');

    mockState.thumbnailEnabled.value = false;
    mockState.thumbnailDuration.value = 3;
    mockState.timelineTracks.value = prevTracks;
  });

  it('excludes audio track from hatched intro zone and positions audio item at 0px without cover offset', async () => {
    mockState.thumbnailEnabled.value = true;
    mockState.thumbnailDuration.value = 1.5;
    const prevTracks = mockState.timelineTracks.value;
    mockState.timelineTracks.value = [
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 12 }]
      },
      {
        id: 'audio',
        name: 'Audio layers',
        type: 'audio',
        items: [{ id: 'a1', name: 'Intro SFX', start: 0, duration: 4 }]
      },
      {
        id: 'text',
        name: 'Text layers',
        type: 'text',
        items: [{ id: 't1', content: 'Layer 1', start: 0, duration: 5 }]
      }
    ];

    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          Teleport: true,
          Transition: true,
          TimelinePropertiesInspector: true
        }
      }
    });

    // Hatched zone should render ONLY on Text track (1 zone), NOT on Audio track
    const coverZones = wrapper.findAll('[data-testid="cover-slide-zone"]');
    expect(coverZones.length).toBe(1);

    // Audio item starting at 0.0s should start at left: 0px (not shifted by 150px!)
    const audioBlock = wrapper
      .findAll('.tl-scroll .cursor-move')
      .find(el => el.text().includes('Intro SFX'));
    expect(audioBlock).toBeDefined();
    expect(audioBlock!.attributes('style')).toContain('left: 0px');
    expect(audioBlock!.attributes('style')).toContain('width: 400px');

    // Text item starting at 0.0s relative should be shifted by 150px
    const textBlock = wrapper
      .findAll('.tl-scroll .cursor-move')
      .find(el => el.text().includes('Layer 1'));
    expect(textBlock).toBeDefined();
    expect(textBlock!.attributes('style')).toContain('left: 150px');

    mockState.thumbnailEnabled.value = false;
    mockState.thumbnailDuration.value = 3;
    mockState.timelineTracks.value = prevTracks;
  });

  it('restricts audio input accept attribute to pure audio formats excluding mp4 and rejects mp4 upload with toast', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          Teleport: true,
          Transition: true,
          TimelinePropertiesInspector: true
        }
      }
    });

    const audioInput = wrapper.find<HTMLInputElement>('input[type="file"]');
    expect(audioInput.exists()).toBe(true);

    // 1. Accept attribute check: must not be wildcard audio/* and must exclude .mp4
    const accept = audioInput.attributes('accept') || '';
    expect(accept).not.toBe('audio/*');
    expect(accept).toContain('.mp3');
    expect(accept).toContain('.wav');
    expect(accept).not.toContain('.mp4');

    // 2. Reject .mp4 file selection with error toast and do not add item
    mockState.showToast.mockClear();
    mockState.addTimelineItem.mockClear();

    const mp4File = new File(['dummy'], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(audioInput.element, 'files', {
      value: [mp4File],
      writable: true
    });

    await audioInput.trigger('change');

    expect(mockState.showToast).toHaveBeenCalledWith(
      expect.stringContaining('Hanya file audio'),
      'error'
    );
    expect(mockState.addTimelineItem).not.toHaveBeenCalled();
    expect(mockState.commitToHistory).not.toHaveBeenCalled();

    // 3. Valid .mp3 file upload proceeds and adds timeline item
    mockState.showToast.mockClear();
    mockState.addTimelineItem.mockClear();
    mockState.commitToHistory.mockClear();

    const mp3File = new File(['dummy-audio'], 'intro-whoosh.mp3', {
      type: 'audio/mpeg'
    });
    Object.defineProperty(audioInput.element, 'files', {
      value: [mp3File],
      writable: true
    });

    await audioInput.trigger('change');
    // Allow async duration detection & FileReader onload to fire
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockState.showToast).not.toHaveBeenCalled();
    expect(mockState.commitToHistory).toHaveBeenCalled();
    expect(mockState.addTimelineItem).toHaveBeenCalledWith(
      'audio',
      expect.objectContaining({
        name: 'intro-whoosh.mp3',
        duration: expect.any(Number)
      })
    );
  });

  it('selects the newly created split piece and clears selection on delete', async () => {
    const prevTracks = mockState.timelineTracks.value;
    const audioItem = {
      id: 'audio-item-1',
      name: 'Song.mp3',
      start: 0,
      duration: 30,
      type: 'audio'
    };
    mockState.timelineTracks.value = [
      {
        id: 'video',
        name: 'Video',
        type: 'video',
        items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 15 }]
      },
      {
        id: 'audio',
        name: 'Audio layers',
        type: 'audio',
        items: [audioItem]
      }
    ];
    mockState.selectedTimelineItem.value = audioItem;
    mockState.currentTime.value = 15;

    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true,
          Teleport: true,
          Transition: true,
          TimelinePropertiesInspector: true
        }
      }
    });

    // 1. Trigger split via split button
    const splitBtn = wrapper.find('button[title*="Split"]');
    expect(splitBtn.exists()).toBe(true);
    await splitBtn.trigger('click');

    expect(mockState.commitToHistory).toHaveBeenCalled();
    expect(mockState.addTimelineItem).toHaveBeenCalledWith(
      'audio',
      expect.objectContaining({
        start: 15,
        duration: 15
      })
    );
    // Selected item must be updated to the second piece (the split tail)
    expect(mockState.selectedTimelineItem.value).toEqual(
      expect.objectContaining({
        start: 15,
        duration: 15
      })
    );

    // 2. Trigger delete
    const deleteBtn = wrapper.find('button[title*="Delete"]');
    expect(deleteBtn.exists()).toBe(true);
    await deleteBtn.trigger('click');

    // Selected item must be cleared to null
    expect(mockState.selectedTimelineItem.value).toBeNull();

    mockState.timelineTracks.value = prevTracks;
  });
});
