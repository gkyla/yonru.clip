// @vitest-environment nuxt
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref, watch, nextTick } from 'vue';
import TimelineEditor from '../../app/components/TimelineEditor.vue';

const mockSaveTimelineTracks = vi.fn();
const mockCommitToHistory = vi.fn();
const tracks = ref([
  {
    id: 'video',
    name: 'Main Video',
    type: 'video',
    items: [{ id: 'v1', start: 0, duration: 20 }]
  },
  {
    id: 'audio',
    name: 'Audio',
    type: 'audio',
    items: [
      {
        id: 'a1',
        type: 'audio',
        name: 'heavy-audio.mp3',
        start: 0,
        duration: 10,
        src: 'data:audio/mp3;base64,' + 'A'.repeat(50000)
      }
    ]
  }
]);

const mockState = {
  timelineTracks: tracks,
  selectedTimelineItem: ref(null),
  currentTime: ref(0),
  timelineDuration: ref(30),
  videoDuration: ref(30),
  thumbnailEnabled: ref(false),
  thumbnailDuration: ref(0),
  coverEnabled: ref(false),
  coverDuration: ref(0),
  isPlaying: ref(false),
  canUndo: ref(false),
  canRedo: ref(false),
  isSavingHistory: ref(false),
  volume: ref(1),
  saveTimelineTracks: mockSaveTimelineTracks,
  isDraggingTimelineItem: ref(false),
  showToast: vi.fn(),
  commitToHistory: mockCommitToHistory,
  formatDuration: (sec: number) => `${sec}s`,
  seekTo: vi.fn(),
  isRenderPreviewActive: ref(false),
  isEditorLocked: ref(false),
  fullTranscript: ref([]),
  renderStatus: ref('ready'),
  contentAudit: ref({ flaggedSegments: [] }),
  undo: vi.fn(),
  redo: vi.fn()
};

vi.mock('../../app/composables/useClipperState', () => ({
  useClipperState: () => mockState,
  FONT_OPTIONS: ['Inter', 'Roboto']
}));

describe('Timeline Drag Performance & Player Sync Bug Repro', () => {
  it('detects unthrottled saveTimelineTracks and unshielded dragging on mousemove', async () => {
    let watchSaveCount = 0;
    // Simulate workspacePersistence deep watch on timelineTracks
    watch(
      tracks,
      () => {
        if (mockState.isDraggingTimelineItem.value) return;
        watchSaveCount++;
        mockSaveTimelineTracks();
      },
      { deep: true }
    );

    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    const audioItems = wrapper.findAll('.cursor-move');
    expect(audioItems.length).toBeGreaterThanOrEqual(2);
    const audioEl = audioItems[1];

    // Trigger startMove on audio element
    await audioEl!.trigger('mousedown', { clientX: 100 });

    // Simulate 10 mousemove events (dragging across 10 ticks)
    for (let i = 1; i <= 10; i++) {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 100 + i * 5 })
      );
      await nextTick();
    }

    // Bug Check 1: During dragging, isDraggingTimelineItem flag should be true so Remotion & persistence are shielded
    expect(mockState.isDraggingTimelineItem.value).toBe(true);

    // Bug Check 2: Reactive watchSaveCount should NOT fire 10 times during 10 mousemoves
    expect(watchSaveCount).toBe(0);

    // End drag
    window.dispatchEvent(new MouseEvent('mouseup'));
    await nextTick();
    expect(mockState.isDraggingTimelineItem.value).toBe(false);
    // Must only save ONCE on drop, not twice (stopDrag + post-flush watcher)
    expect(mockSaveTimelineTracks).toHaveBeenCalledTimes(1);
  });

  it('defers reactive track mutations until mouseup while updating DOM position directly during mousemove', async () => {
    tracks.value[1]!.items[0]!.start = 0;
    mockCommitToHistory.mockClear();
    let startMutationCount = 0;
    watch(
      () => tracks.value[1]!.items[0]!.start,
      () => {
        startMutationCount++;
      }
    );

    const wrapper = mount(TimelineEditor, {
      global: {
        stubs: {
          Icon: true,
          NuxtIcon: true
        }
      }
    });

    const audioItems = wrapper.findAll('.cursor-move');
    const audioEl = audioItems[1]!;

    await audioEl!.trigger('mousedown', { clientX: 100 });

    // In a high-frequency drag (10 mousemoves of 5px each = 50px = 0.5s at 100px/sec)
    for (let i = 1; i <= 10; i++) {
      window.dispatchEvent(
        new MouseEvent('mousemove', { clientX: 100 + i * 5 })
      );
      await nextTick();
    }

    // Visual DOM position updates immediately during drag
    expect((audioEl.element as HTMLElement).style.left).toBe('50px');

    // Zero reactive state mutations occur during active mousemove ticks
    expect(startMutationCount).toBe(0);
    expect(tracks.value[1]!.items[0]!.start).toBe(0);

    // On mouseup, history is committed once and reactive start is updated once
    window.dispatchEvent(new MouseEvent('mouseup'));
    await nextTick();

    expect(mockCommitToHistory).toHaveBeenCalledTimes(1);
    expect(startMutationCount).toBe(1);
    expect(tracks.value[1]!.items[0]!.start).toBe(0.5);
  });

  it('routes timeline and history saves through useClipEditorSession with lightweight Audio Library URLs', async () => {
    const { useClipEditorSession } =
      await import('../../app/composables/useClipEditorSession');
    const { useTimelineState } =
      await import('../../app/composables/useTimelineState');
    const { useState } = await import('#app');

    const fetchMock = vi.fn().mockResolvedValue({ status: 'ok' });
    vi.stubGlobal('$fetch', fetchMock);

    useState<string | null>('folderName', () => 'test_folder').value =
      'test_folder';
    useState<string | null>('clipId', () => 'test_clip').value = 'test_clip';

    const timeline = useTimelineState();
    const session = useClipEditorSession({ timeline });
    timeline.timelineTracks.value = [
      {
        id: 'video',
        name: 'Main Video',
        type: 'video',
        items: [{ id: 'v1', start: 0, duration: 20 }]
      },
      {
        id: 'audio',
        name: 'Audio',
        type: 'audio',
        items: [
          {
            id: 'a1',
            type: 'audio',
            name: 'bgm.mp3',
            start: 0,
            duration: 10,
            src: '/assets/audio_library/bgm.mp3'
          }
        ]
      }
    ];
    timeline.timelineUndoStack.value = [];
    timeline.timelineRedoStack.value = [];

    for (let i = 1; i <= 5; i++) {
      timeline.commitToHistory();
      timeline.timelineTracks.value[1]!.items[0]!.start = i;
    }

    await session.saveHistoryToBackend();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].body).toHaveProperty('history');

    fetchMock.mockClear();
    await session.saveTimelineTracks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].body).toEqual({
      timeline: timeline.timelineTracks.value
    });
  });
});
