// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';
import { useClipEditorSession } from '../../app/composables/useClipEditorSession';
import { useTimelineState } from '../../app/composables/useTimelineState';
import { resolveApiBase } from '../../app/utils/apiBase';

describe('Timeline Undo/Redo Performance & Compact Payload Feedback Loop', () => {
  const API_BASE = resolveApiBase();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('saveTranscript MUST send _compact: true to prevent heavy session dump from backend', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ status: 'ok', folder_name: 'f1', clip_id: 'c1' });
    vi.stubGlobal('$fetch', mockFetch);

    const session = useClipEditorSession();
    session.folderName.value = 'f1';
    session.clipId.value = 'c1';
    session.fullTranscript.value = [{ start: 0, duration: 1, text: 'Hello' }];

    await session.saveTranscript(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const fetchArgs = mockFetch.mock.calls[0];
    expect(fetchArgs[0]).toBe(`${API_BASE}/api/clip-session/f1/c1`);
    expect(fetchArgs[1]?.body).toHaveProperty('_compact', true);
  });

  it('undo MUST NOT send un-compact payload that causes backend to echo heavy timeline audio', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ status: 'ok', folder_name: 'f1', clip_id: 'c1' });
    vi.stubGlobal('$fetch', mockFetch);

    const mockTimeline = {
      undo: vi.fn(),
      redo: vi.fn(),
      timelineTracks: ref([
        {
          id: 'audio',
          type: 'audio',
          items: [
            {
              id: 'a1',
              start: 0,
              duration: 10,
              src: 'data:audio/mp3;base64,' + 'A'.repeat(1000)
            }
          ]
        }
      ]),
      saveTimelineTracks: vi.fn()
    };

    const session = useClipEditorSession({ timeline: mockTimeline as any });
    session.folderName.value = 'f1';
    session.clipId.value = 'c1';
    session.fullTranscript.value = [{ start: 0, duration: 1, text: 'Hello' }];

    session.undo();

    expect(mockTimeline.undo).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalled();
    for (const call of mockFetch.mock.calls) {
      expect(call[1]?.body).toHaveProperty('_compact', true);
    }
  });

  it('skips redundant saveTranscript network request when undo only reverts timeline tracks (e.g. audio block drag)', () => {
    const mockFetch = vi.fn().mockResolvedValue({ status: 'ok' });
    vi.stubGlobal('$fetch', mockFetch);

    const mockTimeline = {
      undo: vi
        .fn()
        .mockReturnValue({ transcriptChanged: false, tracksChanged: true }),
      redo: vi
        .fn()
        .mockReturnValue({ transcriptChanged: false, tracksChanged: true })
    };

    const session = useClipEditorSession({ timeline: mockTimeline as any });
    session.folderName.value = 'f1';
    session.clipId.value = 'c1';
    session.fullTranscript.value = [
      { start: 0, duration: 1, text: 'Unchanged' }
    ];

    session.undo();
    expect(mockTimeline.undo).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();

    session.redo();
    expect(mockTimeline.redo).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('useTimelineState.undo does not mutate fullTranscript ref or trigger transcriptChanged when only audio block moved', () => {
    const timeline = useTimelineState();
    const transcriptState = useState<any[]>('fullTranscript');
    transcriptState.value = [{ start: 0, duration: 2, text: 'Keep same ref' }];
    const initialTranscriptRef = transcriptState.value;

    // Set up an audio track item at 0s
    const audioTrack = timeline.timelineTracks.value.find(
      t => t.id === 'audio'
    )!;
    audioTrack.items = [
      {
        id: 'aud-1',
        type: 'audio',
        name: 'intro.mp3',
        start: 0,
        duration: 5,
        src: 'data:audio/mp3;base64,AAAA'
      }
    ];

    // Commit before moving audio block to 3s
    timeline.commitToHistory();
    audioTrack.items[0]!.start = 3;

    // Undo move
    const undoRes = timeline.undo();
    expect(undoRes).toEqual({ transcriptChanged: false, tracksChanged: true });
    expect(
      timeline.timelineTracks.value.find(t => t.id === 'audio')!.items[0]!.start
    ).toBe(0);
    // Reference must remain untouched to avoid triggering VideoPreview/Remotion transcript watchers
    expect(transcriptState.value).toBe(initialTranscriptRef);

    // Redo move
    const redoRes = timeline.redo();
    expect(redoRes).toEqual({ transcriptChanged: false, tracksChanged: true });
    expect(
      timeline.timelineTracks.value.find(t => t.id === 'audio')!.items[0]!.start
    ).toBe(3);
    expect(transcriptState.value).toBe(initialTranscriptRef);
  });
});
