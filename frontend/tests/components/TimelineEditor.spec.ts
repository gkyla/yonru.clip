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

const mockActiveTrackIds = ref({ text: 'text', audio: 'audio' });

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
  activeTrackIds: mockActiveTrackIds,
  timelineTracks: ref([
    {
      id: 'video',
      name: 'Video',
      type: 'video',
      items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 30 }]
    },
    {
      id: 'text',
      name: 'Text layers',
      type: 'text',
      items: [{ id: 't1', content: 'Hello world', start: 0, duration: 10 }]
    }
  ]),
  formatDuration: (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },
  seekTo: mockSeekTo,
  addTimelineItem: vi.fn(),
  addTrack: vi.fn(),
  deleteTrack: vi.fn(),
  canDeleteTrack: vi.fn((trackId: string) => {
    const target = mockState.timelineTracks.value.find(t => t.id === trackId);
    if (!target || target.type === 'video') return false;
    return (
      mockState.timelineTracks.value.filter(t => t.type === target.type)
        .length > 1
    );
  }),
  toggleTrackMute: vi.fn(),
  toggleTrackVisibility: vi.fn(),
  setActiveTrack: vi.fn((trackId: string) => {
    const target = mockState.timelineTracks.value.find(t => t.id === trackId);
    if (target && (target.type === 'text' || target.type === 'audio')) {
      mockActiveTrackIds.value = {
        ...mockActiveTrackIds.value,
        [target.type]: target.id
      };
    }
  }),
  moveTimelineItemToTrack: vi.fn(),
  saveTimelineTracks: vi.fn(),
  saveTranscript: vi.fn(),
  fullTranscript: ref([]),
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
    await vi.waitFor(() => {
      expect(mockState.commitToHistory).toHaveBeenCalled();
    });

    expect(mockState.showToast).not.toHaveBeenCalled();
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
      }),
      { forceTrack: true }
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

  it('renders content safety flagged markers over video track and omits subtitle track (ADR 0029)', async () => {
    const prevTracks = mockState.timelineTracks.value;
    mockState.timelineTracks.value = [
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 30 }]
      },
      {
        id: 'audio',
        name: 'Audio layers',
        type: 'audio',
        items: []
      },
      {
        id: 'text',
        name: 'Text layers',
        type: 'text',
        items: []
      }
    ];

    mockState.contentAudit.value = {
      flaggedSegments: [{ start: 5, duration: 1.5, word: 'badword' }]
    };

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

    // Subtitle track should not exist
    expect(wrapper.text()).not.toContain('Subtitle');
    expect(wrapper.text()).toContain('Main Video');
    expect(wrapper.text()).toContain('Audio layers');
    expect(wrapper.text()).toContain('Text layers');

    // Flagged marker indicator should be present
    const flaggedMarker = wrapper.find('.bg-rose-500\\/25');
    expect(flaggedMarker.exists()).toBe(true);

    mockState.contentAudit.value = { flaggedSegments: [] };
    mockState.timelineTracks.value = prevTracks;
  });

  describe('Multi-Track NLE UI & Vertical Drag Interactions', () => {
    it('supports + Text / + Audio track creation, Mute / Hide / Delete track toggles, minimum 1 track guard, active track selection, Cover Slide zones across all text tracks, and synced scroll', async () => {
      const prevTracks = mockState.timelineTracks.value;
      mockState.addTrack.mockClear();
      mockState.deleteTrack.mockClear();
      mockState.toggleTrackMute.mockClear();
      mockState.toggleTrackVisibility.mockClear();
      mockState.saveTimelineTracks.mockClear();
      mockState.setActiveTrack.mockClear();
      mockState.thumbnailEnabled.value = true;
      mockState.thumbnailDuration.value = 1.5;

      mockState.timelineTracks.value = [
        {
          id: 'text-2',
          name: 'Text 2',
          type: 'text',
          hidden: false,
          items: []
        },
        {
          id: 'text',
          name: 'Text 1',
          type: 'text',
          hidden: true,
          items: [{ id: 't1', content: 'Layer 1', start: 0, duration: 2 }]
        },
        {
          id: 'video',
          name: 'Main Video',
          type: 'video',
          items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 20 }]
        },
        {
          id: 'audio',
          name: 'Audio 1',
          type: 'audio',
          muted: true,
          items: [{ id: 'a1', name: 'BGM', start: 0, duration: 10 }]
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

      // 1. + Text and + Audio buttons trigger addTrack + save
      await wrapper.find('[data-testid="add-text-track-btn"]').trigger('click');
      expect(mockState.addTrack).toHaveBeenCalledWith('text');
      expect(mockState.saveTimelineTracks).toHaveBeenCalled();

      await wrapper
        .find('[data-testid="add-audio-track-btn"]')
        .trigger('click');
      expect(mockState.addTrack).toHaveBeenCalledWith('audio');

      // 2. Delete enabled on Text 2 (2 text tracks exist), disabled on Audio 1 (only 1 audio track), absent on Video
      const delText2 = wrapper.find('[data-testid="delete-track-text-2"]');
      expect(delText2.exists()).toBe(true);
      expect((delText2.element as HTMLButtonElement).disabled).toBe(false);
      await delText2.trigger('click');
      expect(mockState.deleteTrack).toHaveBeenCalledWith('text-2');

      const delAudio1 = wrapper.find('[data-testid="delete-track-audio"]');
      expect(delAudio1.exists()).toBe(true);
      expect((delAudio1.element as HTMLButtonElement).disabled).toBe(true);

      expect(wrapper.find('[data-testid="delete-track-video"]').exists()).toBe(
        false
      );

      // 3. Mute and Hide toggles work and items on muted/hidden tracks visually dim
      await wrapper.find('[data-testid="toggle-mute-audio"]').trigger('click');
      expect(mockState.toggleTrackMute).toHaveBeenCalledWith('audio');

      await wrapper.find('[data-testid="toggle-hide-text"]').trigger('click');
      expect(mockState.toggleTrackVisibility).toHaveBeenCalledWith('text');

      // 4. Selecting Text 2 header activates it
      await wrapper
        .find('[data-testid="track-header-text-2"]')
        .trigger('click');
      expect(mockState.setActiveTrack).toHaveBeenCalledWith('text-2');
      await wrapper.vm.$nextTick();
      expect(
        wrapper
          .find('[data-testid="track-header-text-2"]')
          .attributes('data-active-track')
      ).toBe('true');

      // 5. Cover Slide hatched zone renders on BOTH Text 2 and Text 1 (2 zones), NOT Audio 1
      expect(wrapper.findAll('[data-testid="cover-slide-zone"]').length).toBe(
        2
      );

      // 6. Vertical scroll sync between canvas scrollEl and header scroll container
      const tlScroll = wrapper.find('.tl-scroll').element as HTMLElement;
      const headerScroll = wrapper.find('[data-testid="track-headers-scroll"]')
        .element as HTMLElement;
      tlScroll.scrollTop = 48;
      await wrapper.find('.tl-scroll').trigger('scroll');
      expect(headerScroll.scrollTop).toBe(48);

      headerScroll.scrollTop = 16;
      await wrapper
        .find('[data-testid="track-headers-scroll"]')
        .trigger('scroll');
      expect(tlScroll.scrollTop).toBe(16);

      mockState.thumbnailEnabled.value = false;
      mockState.timelineTracks.value = prevTracks;
    });

    it('supports vertical cross-track pointer drag between same-type tracks while blocking incompatible or overlapping drops', async () => {
      const prevTracks = mockState.timelineTracks.value;
      mockState.moveTimelineItemToTrack.mockReset();
      mockState.moveTimelineItemToTrack.mockReturnValue(true);
      mockState.commitToHistory.mockClear();
      mockState.saveTimelineTracks.mockClear();

      mockState.timelineTracks.value = [
        {
          id: 'text-2',
          name: 'Text 2',
          type: 'text',
          items: [
            { id: 'top-txt', content: 'Upper Text', start: 0, duration: 4 }
          ]
        },
        {
          id: 'text',
          name: 'Text 1',
          type: 'text',
          items: [
            { id: 'busy-txt', content: 'Occupied Later', start: 8, duration: 4 }
          ]
        },
        {
          id: 'video',
          name: 'Main Video',
          type: 'video',
          items: [{ id: 'v1', name: 'Clip 1', start: 0, duration: 20 }]
        },
        {
          id: 'audio',
          name: 'Audio 1',
          type: 'audio',
          items: []
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

      const topEl = wrapper
        .findAll('.tl-scroll .cursor-move')
        .find(el => el.text().includes('Upper Text'));
      expect(topEl).toBeDefined();

      // 1. Drag down 1 row (+40px) from text-2 -> free interval on text -> valid drop
      await topEl!.trigger('mousedown', { clientX: 100, clientY: 50 });
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 100, clientY: 90 })
      );
      await wrapper.vm.$nextTick();
      expect(
        wrapper.find('[data-testid="track-lane-text"]').classes().join(' ')
      ).toContain('ring-sky-400');

      window.dispatchEvent(new MouseEvent('mouseup'));
      expect(mockState.commitToHistory).toHaveBeenCalled();
      expect(mockState.moveTimelineItemToTrack).toHaveBeenCalledWith(
        'top-txt',
        'text-2',
        'text',
        0,
        4
      );
      expect(mockState.saveTimelineTracks).toHaveBeenCalled();

      // 2. Drag down 2 rows (+80px) from text-2 -> Video (incompatible type) -> blocked & no move
      mockState.moveTimelineItemToTrack.mockClear();
      mockState.commitToHistory.mockClear();
      await topEl!.trigger('mousedown', { clientX: 100, clientY: 50 });
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 100, clientY: 130 })
      );
      await wrapper.vm.$nextTick();
      expect(
        wrapper.find('[data-testid="track-lane-video"]').classes().join(' ')
      ).toContain('ring-rose-500');
      window.dispatchEvent(new MouseEvent('mouseup'));
      expect(mockState.moveTimelineItemToTrack).not.toHaveBeenCalled();

      // 3. Drag horizontally into [8s..12s] (+800px at 100px/s) AND down 1 row (+40px) -> overlaps busy-txt [8..12] -> blocked
      await topEl!.trigger('mousedown', { clientX: 100, clientY: 50 });
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 900, clientY: 90 })
      );
      await wrapper.vm.$nextTick();
      expect(
        wrapper.find('[data-testid="track-lane-text"]').classes().join(' ')
      ).toContain('ring-rose-500');
      window.dispatchEvent(new MouseEvent('mouseup'));
      expect(mockState.moveTimelineItemToTrack).not.toHaveBeenCalled();

      mockState.timelineTracks.value = prevTracks;
    });

    it('pins scrubbing head inside sticky ruler and spans playhead guide line across all track lanes through audio-3', async () => {
      const prevTracks = mockState.timelineTracks.value;
      mockSeekTo.mockClear();
      mockState.timelineTracks.value = [
        { id: 'text-2', name: 'Text 2', type: 'text', items: [] },
        { id: 'text', name: 'Text 1', type: 'text', items: [] },
        { id: 'video', name: 'Main Video', type: 'video', items: [] },
        { id: 'audio', name: 'Audio 1', type: 'audio', items: [] },
        { id: 'audio-2', name: 'Audio 2', type: 'audio', items: [] },
        { id: 'audio-3', name: 'Audio 3', type: 'audio', items: [] }
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

      // Sticky scrubbing head stays inside the sticky top-0 ruler so it never hides on vertical scroll
      const stickyRuler = wrapper.find('.timeline-ruler');
      expect(stickyRuler.classes()).toContain('sticky');
      expect(stickyRuler.classes()).toContain('top-0');
      const head = stickyRuler.find('[data-testid="timeline-playhead-head"]');
      expect(head.exists()).toBe(true);
      const handle = head.find('[data-testid="timeline-playhead-handle"]');
      expect(handle.exists()).toBe(true);

      // Scrubbing via pinned handle works independently of vertical scroll
      await handle.trigger('mousedown', { button: 0, clientX: 250 });
      window.dispatchEvent(new MouseEvent('mouseup'));
      expect(mockSeekTo).toHaveBeenCalled();

      // Vertical playhead line lives inside the full-height tracks canvas wrapping text-2 through audio-3
      const tracksCanvas = wrapper.find(
        '[data-testid="timeline-tracks-canvas"]'
      );
      expect(tracksCanvas.exists()).toBe(true);
      expect(
        tracksCanvas.find('[data-testid="track-lane-audio-3"]').exists()
      ).toBe(true);
      const playhead = tracksCanvas.find('[data-testid="timeline-playhead"]');
      expect(playhead.exists()).toBe(true);
      expect(playhead.classes()).toContain('top-0');
      expect(playhead.classes()).toContain('bottom-0');

      mockState.timelineTracks.value = prevTracks;
    });

    it('highlights source lane rose and snaps back when horizontal drag overlaps a sibling item on the same track', async () => {
      const prevTracks = mockState.timelineTracks.value;
      mockState.commitToHistory.mockClear();
      mockState.saveTimelineTracks.mockClear();

      const itemA = { id: 'txt-a', content: 'A', start: 0, duration: 3 };
      const itemB = { id: 'txt-b', content: 'B', start: 5, duration: 3 };
      mockState.timelineTracks.value = [
        { id: 'text', name: 'Text 1', type: 'text', items: [itemA, itemB] },
        { id: 'video', name: 'Main Video', type: 'video', items: [] },
        { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
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

      const elA = wrapper
        .findAll('.tl-scroll .cursor-move')
        .find(el => el.text().includes('A'));
      expect(elA).toBeDefined();

      // Drag horizontally +500px (5s at 100px/s) into [5s..8s] where B sits
      await elA!.trigger('mousedown', { clientX: 100, clientY: 50 });
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 600, clientY: 50 })
      );
      await wrapper.vm.$nextTick();

      expect(
        wrapper.find('[data-testid="track-lane-text"]').classes().join(' ')
      ).toContain('ring-rose-500');

      window.dispatchEvent(new MouseEvent('mouseup'));
      expect(itemA.start).toBe(0);
      expect(mockState.commitToHistory).not.toHaveBeenCalled();
      expect(mockState.saveTimelineTracks).not.toHaveBeenCalled();

      mockState.timelineTracks.value = prevTracks;
    });

    it('keeps selectedTimelineItem referencing the live inserted item inside track.items after splitSelected', async () => {
      const prevTracks = mockState.timelineTracks.value;
      const origAdd = mockState.addTimelineItem;
      const item = {
        id: 'txt-split',
        content: 'Split',
        start: 0,
        duration: 10
      };
      mockState.timelineTracks.value = [
        { id: 'text', name: 'Text 1', type: 'text', items: [item] },
        { id: 'video', name: 'Main Video', type: 'video', items: [] },
        { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
      ];
      mockState.selectedTimelineItem.value = item;
      mockState.currentTime.value = 4;
      mockState.addTimelineItem = vi.fn((trackId: string, newItem: any) => {
        const cloned = { ...newItem, fromRuntime: true };
        mockState.timelineTracks.value = mockState.timelineTracks.value.map(
          t => (t.id === trackId ? { ...t, items: [...t.items, cloned] } : t)
        );
      });

      try {
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

        const splitBtn = wrapper.find('button[title*="Split"]');
        await splitBtn.trigger('click');

        const insertedInTrack = mockState.timelineTracks.value
          .find(t => t.id === 'text')
          ?.items.find(i => i.id !== 'txt-split');
        expect(insertedInTrack).toBeDefined();
        expect(mockState.selectedTimelineItem.value).toBe(insertedInTrack);
      } finally {
        mockState.addTimelineItem = origAdd;
        mockState.timelineTracks.value = prevTracks;
      }
    });
  });
});
