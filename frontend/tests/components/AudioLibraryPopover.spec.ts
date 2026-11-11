// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import AudioLibraryPopover from '../../app/components/editor/AudioLibraryPopover.vue';
import TimelineEditor from '../../app/components/TimelineEditor.vue';
import type {
  AudioLibraryItem,
  TimelineTrackItem
} from '../../app/types/clipper';

const sampleItems: AudioLibraryItem[] = [
  {
    id: 'lib-1',
    name: 'whoosh_intro.mp3',
    filename: 'whoosh_intro.mp3',
    url: '/assets/audio_library/whoosh_intro.mp3',
    src: 'http://localhost:8000/assets/audio_library/whoosh_intro.mp3',
    duration: 2.4,
    size: 24500,
    created_at: 1700000100
  },
  {
    id: 'lib-2',
    name: 'cinematic_boom.wav',
    filename: 'cinematic_boom.wav',
    url: '/assets/audio_library/cinematic_boom.wav',
    src: 'http://localhost:8000/assets/audio_library/cinematic_boom.wav',
    duration: 4.8,
    size: 84000,
    created_at: 1700000200
  }
];

const mockAudioLibrary = ref<AudioLibraryItem[]>([...sampleItems]);
const mockIsAudioLibraryLoading = ref(false);
const mockFetchAudioLibrary = vi.fn().mockResolvedValue(undefined);
const mockUploadAudioFile = vi.fn();
const mockDeleteAudioItem = vi.fn().mockResolvedValue(true);
const mockAddTimelineItem = vi.fn();
const mockCommitToHistory = vi.fn();
const mockShowToast = vi.fn();

const mockState = {
  currentTime: ref(0),
  isPlaying: ref(false),
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
  selectedTimelineItem: ref<TimelineTrackItem | null>(null),
  outputUrl: ref<string | null>(null),
  isRenderPreviewActive: ref(false),
  isEditorLocked: ref(false),
  renderStatus: ref('ready'),
  contentAudit: ref({ flaggedSegments: [] }),
  timelineTracks: ref([
    { id: 'video', name: 'Video', type: 'video', items: [] },
    { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
    { id: 'text', name: 'Text layers', type: 'text', items: [] }
  ]),
  audioLibrary: mockAudioLibrary,
  isAudioLibraryLoading: mockIsAudioLibraryLoading,
  fetchAudioLibrary: mockFetchAudioLibrary,
  uploadAudioFile: mockUploadAudioFile,
  deleteAudioItem: mockDeleteAudioItem,
  formatDuration: (sec: number) =>
    `00:${Math.floor(sec).toString().padStart(2, '0')}`,
  seekTo: vi.fn(),
  addTimelineItem: mockAddTimelineItem,
  saveTimelineTracks: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  commitToHistory: mockCommitToHistory,
  showToast: mockShowToast
};

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState,
  FONT_OPTIONS: ['Inter']
}));

describe('AudioLibraryPopover & TimelineEditor Audio Button Integration', () => {
  beforeEach(() => {
    mockAudioLibrary.value = [...sampleItems];
    mockFetchAudioLibrary.mockClear();
    mockUploadAudioFile.mockReset();
    mockDeleteAudioItem.mockClear();
    mockAddTimelineItem.mockClear();
    mockCommitToHistory.mockClear();
    mockShowToast.mockClear();
  });

  it('opens AudioLibraryPopover above the AUDIO button when clicked in TimelineEditor', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const audioBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('AUDIO'));
    expect(audioBtn).toBeDefined();

    await audioBtn!.trigger('click');
    await flushPromises();

    expect(mockFetchAudioLibrary).toHaveBeenCalled();
    expect(wrapper.find('[data-testid="audio-library-popover"]').exists()).toBe(
      true
    );
    expect(wrapper.text()).toContain('whoosh_intro.mp3');
    expect(wrapper.text()).toContain('cinematic_boom.wav');
  });

  it('filters audio items by search query and inserts selected item into timeline on click', async () => {
    const onInsert = vi.fn();
    const onClose = vi.fn();
    const wrapper = mount(AudioLibraryPopover, {
      props: {
        modelValue: true,
        items: sampleItems,
        loading: false,
        anchorRect: {
          top: 500,
          left: 80,
          bottom: 528,
          right: 140,
          width: 60,
          height: 28
        }
      },
      attrs: {
        onInsert,
        onClose
      },
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const searchInput = wrapper.find('[data-testid="audio-library-search"]');
    await searchInput.setValue('cinematic');

    const rows = wrapper.findAll('[data-testid="audio-library-item"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.text()).toContain('cinematic_boom.wav');

    // Click insert on the filtered item
    await rows[0]!
      .find('[data-testid="audio-library-insert-btn"]')
      .trigger('click');
    expect(onInsert).toHaveBeenCalledWith(sampleItems[1]);
  });

  it('shows Duplicate Confirmation Dialog when uploading an existing audio and handles Replace vs Use Existing', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    // Open popover
    const audioBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('AUDIO'));
    await audioBtn!.trigger('click');

    // Mock duplicate response on initial upload attempt
    mockUploadAudioFile.mockResolvedValueOnce({
      status: 'duplicate',
      item: sampleItems[0]!
    });

    const fileInput = wrapper.find('input[type="file"]');
    const dupFile = new File(['updated_bytes'], 'whoosh_intro.mp3', {
      type: 'audio/mpeg'
    });
    Object.defineProperty(fileInput.element, 'files', {
      value: [dupFile],
      configurable: true
    });
    await fileInput.trigger('change');
    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="audio-duplicate-confirm-dialog"]').exists()
      ).toBe(true);
    });

    // Confirmation dialog should be visible
    const confirmDialog = wrapper.find(
      '[data-testid="audio-duplicate-confirm-dialog"]'
    );

    // Click "Use Existing (No)" first to verify it inserts the existing item without replacing
    await confirmDialog
      .find('[data-testid="audio-duplicate-use-existing-btn"]')
      .trigger('click');
    await flushPromises();

    expect(mockAddTimelineItem).toHaveBeenCalledWith('audio', {
      name: 'whoosh_intro.mp3',
      src: sampleItems[0]!.src,
      duration: 2.4
    });
  });

  it('replaces existing audio and inserts into timeline when choosing Replace (Yes) in Duplicate Confirmation Dialog', async () => {
    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          Teleport: true,
          Transition: true
        }
      }
    });

    const audioBtn = wrapper
      .findAll('button')
      .find(b => b.text().includes('AUDIO'));
    await audioBtn!.trigger('click');

    const replacedItem: AudioLibraryItem = {
      ...sampleItems[0]!,
      duration: 3.9,
      src: 'http://localhost:8000/assets/audio_library/whoosh_intro.mp3?t=999'
    };

    mockUploadAudioFile
      .mockResolvedValueOnce({
        status: 'duplicate',
        item: sampleItems[0]!
      })
      .mockResolvedValueOnce({
        status: 'replaced',
        item: replacedItem
      });

    const fileInput = wrapper.find('input[type="file"]');
    const dupFile = new File(['new_version'], 'whoosh_intro.mp3', {
      type: 'audio/mpeg'
    });
    Object.defineProperty(fileInput.element, 'files', {
      value: [dupFile],
      configurable: true
    });
    await fileInput.trigger('change');
    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="audio-duplicate-confirm-dialog"]').exists()
      ).toBe(true);
    });

    const confirmDialog = wrapper.find(
      '[data-testid="audio-duplicate-confirm-dialog"]'
    );

    await confirmDialog
      .find('[data-testid="audio-duplicate-replace-btn"]')
      .trigger('click');
    await flushPromises();

    expect(mockUploadAudioFile).toHaveBeenLastCalledWith(
      dupFile,
      expect.any(Number),
      'replace'
    );
    expect(mockAddTimelineItem).toHaveBeenCalledWith('audio', {
      name: 'whoosh_intro.mp3',
      src: replacedItem.src,
      duration: 3.9
    });
  });
});
