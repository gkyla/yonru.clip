// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useClipperJob } from '../../app/composables/useClipperJob';

import type { ClipSessionData, CropMapPoint } from '../../app/types/clipper';

// Mock useTimelineState
const mockTimelineTracks = {
  value: [
    { id: 'video', name: 'Main Video', type: 'video', items: [] as any[] }
  ]
};
const mockIsSavingLocked = { value: false };
vi.mock('../../app/composables/useTimelineState', () => ({
  useTimelineState: () => ({
    isSavingLocked: mockIsSavingLocked,
    timelineTracks: mockTimelineTracks,
    loadHistoryFromResponse: vi.fn()
  })
}));

// Mock resolveThumbnailTextStyle, calculateNextOverlayPosition, mapThumbnailOverlays
vi.mock('../../app/utils/thumbnailHelpers', () => ({
  resolveThumbnailTextStyle: vi.fn(),
  calculateNextOverlayPosition: vi.fn().mockReturnValue({ x: 50, y: 50 }),
  mapThumbnailOverlays: vi.fn().mockReturnValue([])
}));

describe('useClipperJob Sub-composable - Clip Session Hydration', () => {
  let mockSessionResponse: Partial<ClipSessionData> | null = null;
  let mockLoadReadyStatus = 'ready';

  beforeEach(() => {
    mockSessionResponse = null;
    mockLoadReadyStatus = 'ready';
    mockIsSavingLocked.value = false;

    const font = useState<string>('font');
    const fontSize = useState<number>('fontSize');
    const subtitlePreset = useState<string>('subtitlePreset');
    font.value = 'Montserrat';
    fontSize.value = 100;
    subtitlePreset.value = 'bold-podcast';

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/load-ready-clip')) {
          return Promise.resolve({
            job_id: 'job-123',
            status: mockLoadReadyStatus,
            clip: {
              asset_url: '/assets/clips/folder/10_20_clip/video.mp4',
              duration: 10
            },
            session: mockSessionResponse || {
              folder_name: 'folder',
              clip_id: '10_20_clip',
              transcript: [],
              style_settings: {},
              timeline: [],
              history: { undo_stack: [], redo_stack: [] },
              cover_config: { enabled: false },
              crop_map: []
            }
          });
        }
        return Promise.resolve({});
      })
    );
  });

  afterEach(() => {
    const { stopPolling } = useClipperJob();
    stopPolling();
  });

  it('hydrates custom styles from session and resets omitted keys to defaults', async () => {
    const font = useState<string>('font');
    const fontSize = useState<number>('fontSize');

    font.value = 'Impact';
    fontSize.value = 150;

    mockSessionResponse = {
      style_settings: {
        font: 'Arial',
        fontSize: 120
      }
    };

    const { loadReadyClipIntoEditor, jobStatus, isMediaLoading } =
      useClipperJob();
    await loadReadyClipIntoEditor('folder', '10_20_clip');

    const jobId = useState<string | null>('jobId');
    expect(jobId.value).toBe('job-123');
    expect(jobStatus.value).toBe('ready');
    expect(isMediaLoading.value).toBe(false);
    expect(font.value).toBe('Arial');
    expect(fontSize.value).toBe(120);
  });

  it('preserves queued status when load-ready-clip returns status === queued', async () => {
    vi.useFakeTimers();
    mockLoadReadyStatus = 'queued';
    const { loadReadyClipIntoEditor, jobStatus, stopPolling } = useClipperJob();

    await loadReadyClipIntoEditor('folder', '10_20_clip');

    expect(jobStatus.value).toBe('queued');
    stopPolling();
    vi.useRealTimers();
  });

  it('falls back to hardcoded defaults when session.style_settings is empty', async () => {
    const font = useState<string>('font');
    const fontSize = useState<number>('fontSize');

    font.value = 'Impact';
    fontSize.value = 150;

    const { loadReadyClipIntoEditor } = useClipperJob();
    await loadReadyClipIntoEditor('folder', '10_20_clip');

    expect(font.value).toBe('Montserrat');
    expect(fontSize.value).toBe(50);
  });

  it('loads timeline via GET /api/clip-session when polling returns ready job', async () => {
    vi.useFakeTimers();
    const { startPolling, stopPolling, jobId } = useClipperJob();

    jobId.value = 'job-123';
    mockTimelineTracks.value = [
      { id: 'video', name: 'Main Video', type: 'video', items: [] }
    ];

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/job/job-123')) {
          return Promise.resolve({
            status: 'ready',
            clip: {
              asset_url: '/assets/clips/folder/clip-1/video.mp4',
              duration: 10,
              transcript: []
            }
          });
        }
        if (urlStr.includes('/api/clip-session/folder/clip-1')) {
          return Promise.resolve({
            status: 'ok',
            session: {
              folder_name: 'folder',
              clip_id: 'clip-1',
              timeline: [
                {
                  id: 'video',
                  name: 'Main Video',
                  type: 'video',
                  items: [{ id: 'mock-item-from-session' }]
                }
              ],
              style_settings: {},
              transcript: [],
              crop_map: []
            }
          });
        }
        return Promise.resolve({});
      })
    );

    startPolling();

    await vi.advanceTimersByTimeAsync(2000);

    const videoTrack = mockTimelineTracks.value.find(
      t => t.type === 'video' || t.id === 'video'
    );
    expect(videoTrack?.items.length).toBe(1);
    expect(videoTrack?.items[0]?.id).toBe('mock-item-from-session');

    stopPolling();
    vi.useRealTimers();
  });

  it('populates main-video on the video track rather than timelineTracks[0] when Text Tracks precede Main Video', async () => {
    mockTimelineTracks.value = [
      { id: 'text', name: 'Text 1', type: 'text', items: [] },
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
    ];

    mockSessionResponse = {
      timeline: [
        { id: 'text-2', name: 'Text 2', type: 'text', items: [] },
        { id: 'text', name: 'Text 1', type: 'text', items: [] },
        { id: 'video', name: 'Main Video', type: 'video', items: [] },
        { id: 'audio', name: 'Audio 1', type: 'audio', items: [] }
      ]
    };

    const { loadReadyClipIntoEditor } = useClipperJob();
    await loadReadyClipIntoEditor('folder', 'clip-nle');

    expect(mockTimelineTracks.value[0]?.id).toBe('text-2');
    expect(mockTimelineTracks.value[0]?.items).toHaveLength(0);
    const videoTrack = mockTimelineTracks.value.find(t => t.type === 'video');
    expect(videoTrack?.items).toHaveLength(1);
    expect(videoTrack?.items[0]?.id).toBe('main-video');
  });

  it('normalizes empty timelineTracks array into default tracks and populates main-video', () => {
    mockTimelineTracks.value = [];
    const { applyHydratedClipBundle } = useClipperJob();

    applyHydratedClipBundle({
      folderName: 'test-folder',
      clipId: 'test-clip',
      transcript: [],
      styleSettings: {},
      cropMap: [],
      thumbnailConfig: null,
      timelineTracks: [],
      videoDuration: 18
    });

    expect(mockTimelineTracks.value.map(t => t.id)).toEqual([
      'text',
      'video',
      'audio'
    ]);
    const videoTrack = mockTimelineTracks.value.find(t => t.type === 'video');
    expect(videoTrack?.items).toHaveLength(1);
    expect(videoTrack?.items[0]?.duration).toBe(18);
  });

  it('locks saving during loadReadyClipIntoEditor to prevent premature auto-saves', async () => {
    vi.useFakeTimers();
    let wasLockedDuringFetch = false;

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/load-ready-clip')) {
          wasLockedDuringFetch = mockIsSavingLocked.value;
          return Promise.resolve({
            job_id: 'job-123',
            status: 'ready',
            clip: {
              asset_url: '/assets/clips/folder/clip_id/video.mp4',
              duration: 10
            }
          });
        }
        return Promise.resolve({});
      })
    );

    const { loadReadyClipIntoEditor } = useClipperJob();

    const loadPromise = loadReadyClipIntoEditor('folder', '10_20_clip');
    await loadPromise;

    expect(wasLockedDuringFetch).toBe(true);
    expect(mockIsSavingLocked.value).toBe(true);

    await vi.advanceTimersByTimeAsync(500);
    expect(mockIsSavingLocked.value).toBe(false);

    vi.useRealTimers();
  });

  it('transitions jobStatus to error and stops polling if an unexpected exception occurs during polling tick', async () => {
    vi.useFakeTimers();
    const { startPolling, stopPolling, jobId, jobStatus, jobError } =
      useClipperJob();

    jobId.value = 'job-123';
    jobStatus.value = 'cutting';
    jobError.value = null;

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(() => {
        throw new Error('Network failure or JSON parse error');
      })
    );

    startPolling();

    await vi.advanceTimersByTimeAsync(2000);

    stopPolling();
    vi.useRealTimers();
  });

  it('loads crop_map from session into cropMap state when available on clip load', async () => {
    const cropMap = useState<CropMapPoint[]>('cropMap');
    const cropMode = useState<string>('cropMode');
    cropMap.value = [];
    cropMode.value = 'manual';

    const mockCropMap = [
      { time: 0, x: 500 },
      { time: 2.5, x: 750 }
    ];

    mockSessionResponse = {
      crop_map: mockCropMap
    };

    const { loadReadyClipIntoEditor } = useClipperJob();
    await loadReadyClipIntoEditor('folder', '10_20_clip');

    expect(cropMap.value).toEqual(mockCropMap);
    expect(cropMode.value).toBe('face_tracking');
  });

  it('populates videoUrl during analyzeCached even when activeHook is populated', async () => {
    const videoUrl = useState<string | null>('videoUrl', () => null);
    const activeHook = useState<any>('activeHook', () => null);
    const clipId = useState<string>('clipId', () => '');
    videoUrl.value = null;
    activeHook.value = { theme: 'Existing Active Hook', start: 0, end: 10 };
    clipId.value = '';

    vi.stubGlobal(
      '$fetch',
      vi.fn().mockImplementation(url => {
        const urlStr = String(url);
        if (urlStr.includes('/api/analyze-cached/cached-123')) {
          return Promise.resolve({
            job_id: 'job-cached-123',
            status: 'hooks_ready',
            video: {
              title: 'Sample Video',
              duration: 120,
              fps: 30,
              has_heatmap: false,
              asset_url: '/assets/sources/sample_folder/full.mp4',
              folder_name: 'sample_folder',
              hd_ready: true,
              has_preview: true
            },
            hooks: [{ theme: 'First Hook', start: 5, end: 25, duration: 20 }]
          });
        }
        return Promise.resolve({});
      })
    );

    const { analyzeCached } = useClipperJob();
    await analyzeCached('cached-123');

    expect(videoUrl.value).toBe(
      `${resolveApiBase()}/assets/sources/sample_folder/full.mp4`
    );
  });

  it('calls loadReadyClip using dynamic resolveApiBase instead of hardcoded 8000', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        port: '8765',
        origin: 'http://localhost:8765'
      }
    });

    const job = useClipperJob();
    await job.loadReadyClipIntoEditor('test_folder', 'clip_1');

    const fetchMock = (globalThis as any).$fetch;
    const calls = fetchMock.mock.calls;
    const readyClipCall = calls.find((c: any) =>
      String(c[0]).includes('/api/load-ready-clip')
    );
    expect(readyClipCall).toBeDefined();
    expect(readyClipCall[0]).toBe('http://localhost:8765/api/load-ready-clip');
  });
});
