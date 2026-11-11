// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAudioLibrary } from '../../app/composables/useAudioLibrary';
import { useTimelineState } from '../../app/composables/useTimelineState';

describe('useAudioLibrary Composable & Timeline Audio Duration Clamping', () => {
  beforeEach(() => {
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({ status: 'ok', items: [] })
    );
    const lib = useAudioLibrary();
    lib.audioLibrary.value = [];
  });

  it('fetches audio library items and resolves playable src URLs', async () => {
    const rawItems = [
      {
        id: 'aud-1',
        name: 'whoosh.mp3',
        filename: 'whoosh.mp3',
        url: '/assets/audio_library/whoosh.mp3',
        duration: 1.8,
        size: 12040,
        created_at: 1700000000,
        updated_at: 1700000000
      }
    ];
    vi.stubGlobal(
      '$fetch',
      vi.fn().mockResolvedValue({ status: 'ok', items: rawItems })
    );

    const lib = useAudioLibrary();
    await lib.fetchAudioLibrary();

    expect(lib.audioLibrary.value).toHaveLength(1);
    expect(lib.audioLibrary.value[0]?.name).toBe('whoosh.mp3');
    expect(lib.audioLibrary.value[0]?.src).toContain(
      '/assets/audio_library/whoosh.mp3'
    );
  });

  it('uploads audio file and surfaces duplicate confirmation status when backend reports duplicate', async () => {
    const existingItem = {
      id: 'aud-dup',
      name: 'ding.mp3',
      filename: 'ding.mp3',
      url: '/assets/audio_library/ding.mp3',
      duration: 1.2,
      size: 4096,
      created_at: 1700000000,
      updated_at: 1700000000
    };
    const mockFetch = vi
      .fn()
      .mockImplementation(
        (_url: string, opts?: { method?: string; body?: FormData }) => {
          if (opts?.method === 'POST' && opts.body) {
            const mode = opts.body.get('on_duplicate');
            if (mode === 'prompt') {
              return Promise.resolve({
                status: 'duplicate',
                item: existingItem
              });
            }
            if (mode === 'replace') {
              return Promise.resolve({
                status: 'replaced',
                item: { ...existingItem, duration: 3.4, updated_at: 1700000999 }
              });
            }
          }
          return Promise.resolve({ status: 'ok', items: [existingItem] });
        }
      );
    vi.stubGlobal('$fetch', mockFetch);

    const lib = useAudioLibrary();
    const dummyFile = new File(['audio'], 'ding.mp3', { type: 'audio/mpeg' });

    const promptRes = await lib.uploadAudioFile(dummyFile, 3.4, 'prompt');
    expect(promptRes?.status).toBe('duplicate');
    expect(promptRes?.item.id).toBe('aud-dup');

    const replaceRes = await lib.uploadAudioFile(dummyFile, 3.4, 'replace');
    expect(replaceRes?.status).toBe('replaced');
    expect(replaceRes?.item.duration).toBe(3.4);
  });

  it('deletes audio item from library and updates state list', async () => {
    const lib = useAudioLibrary();
    lib.audioLibrary.value = [
      {
        id: 'aud-del',
        name: 'pop.wav',
        filename: 'pop.wav',
        url: '/assets/audio_library/pop.wav',
        src: 'http://localhost:8000/assets/audio_library/pop.wav',
        duration: 0.5,
        size: 1024,
        created_at: 1700000000
      }
    ];

    vi.stubGlobal(
      '$fetch',
      vi
        .fn()
        .mockResolvedValue({
          status: 'deleted',
          id: 'aud-del',
          file_retained: false
        })
    );

    const ok = await lib.deleteAudioItem('aud-del');
    expect(ok).toBe(true);
    expect(lib.audioLibrary.value).toHaveLength(0);
  });

  it('clamps inserted timeline audio duration to remaining timeline duration when audio is longer than clip', () => {
    const videoDuration = useState<number>('videoDuration', () => 30);
    const currentTime = useState<number>('currentTime', () => 10);
    const coverEnabled = useState<boolean>('coverEnabled', () => false);
    videoDuration.value = 30;
    currentTime.value = 10;
    coverEnabled.value = false;

    const timeline = useTimelineState();
    const videoTrack = timeline.timelineTracks.value.find(
      t => t.id === 'video'
    );
    if (videoTrack) {
      videoTrack.items = [{ id: 'v1', type: 'video', start: 0, duration: 30 }];
    }
    const audioTrack = timeline.timelineTracks.value.find(
      t => t.id === 'audio'
    );
    if (audioTrack) {
      audioTrack.items = [];
    }

    // Add a 180s BGM at 10s on a 30s timeline -> should clamp duration to 20s
    timeline.addTimelineItem('audio', {
      name: 'long_bgm.mp3',
      src: '/assets/audio_library/long_bgm.mp3',
      duration: 180
    });

    const addedBgm = audioTrack?.items[0];
    expect(addedBgm?.start).toBe(10);
    expect(addedBgm?.duration).toBe(20);

    // Add a short 2.5s SFX at 10s -> should preserve 2.5s duration
    timeline.addTimelineItem('audio', {
      name: 'short_sfx.mp3',
      src: '/assets/audio_library/short_sfx.mp3',
      duration: 2.5
    });
    const addedSfx = audioTrack?.items[1];
    expect(addedSfx?.duration).toBe(2.5);
  });
});
