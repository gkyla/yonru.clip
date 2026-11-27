import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveApiBase } from '../../app/utils/apiBase';
import {
  IngestionJobCoordinator,
  type AnalysisSpec,
  type CachedAnalysisSpec,
  type ClipExtractSpec
} from '../../app/utils/jobCoordinator';

describe('IngestionJobCoordinator Unit Tests', () => {
  let mockFetcher: ReturnType<typeof vi.fn>;
  let coordinator: IngestionJobCoordinator;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetcher = vi.fn();
    coordinator = new IngestionJobCoordinator(
      'http://localhost:8000',
      mockFetcher,
      100
    );
  });

  afterEach(() => {
    coordinator.stopPolling();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('API Base Resolution', () => {
    it('defaults apiBase to resolveApiBase() when not explicitly provided', () => {
      const defaultCoordinator = new IngestionJobCoordinator();
      expect(defaultCoordinator.getApiBase()).toBe(resolveApiBase());
    });
  });

  describe('analyzeUrl', () => {
    it('schedules analysis, sets queued status, and starts polling', async () => {
      mockFetcher.mockResolvedValueOnce({
        job_id: 'job-123',
        status: 'queued'
      });
      mockFetcher.mockResolvedValue({
        status: 'downloading',
        download_percent: 45.0
      });

      const statusSpy = vi.fn();
      const progressSpy = vi.fn();

      const spec: AnalysisSpec = {
        url: 'https://youtube.com/watch?v=sample123',
        language: 'id',
        extractionMode: 'preset',
        presetId: 'auto'
      };

      const jobId = await coordinator.analyzeUrl(spec, {
        onStatusChange: statusSpy,
        onDownloadProgress: progressSpy
      });

      expect(jobId).toBe('job-123');
      expect(statusSpy).toHaveBeenCalledWith('queued');
      expect(coordinator.isPolling()).toBe(true);

      // Advance timer to trigger poll
      await vi.advanceTimersByTimeAsync(100);
      expect(statusSpy).toHaveBeenCalledWith('downloading');
      expect(progressSpy).toHaveBeenCalledWith(45.0);
    });

    it('handles analysis API errors gracefully', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Network error'));
      const statusSpy = vi.fn();
      const errorSpy = vi.fn();

      await expect(
        coordinator.analyzeUrl(
          { url: 'https://invalid.com' },
          { onStatusChange: statusSpy, onError: errorSpy }
        )
      ).rejects.toThrow('Network error');

      expect(statusSpy).toHaveBeenCalledWith('error');
      expect(errorSpy).toHaveBeenCalledWith('Network error');
      expect(coordinator.isPolling()).toBe(false);
    });
  });

  describe('analyzeCached', () => {
    it('handles instant ready cached videos with metadata and hooks', async () => {
      mockFetcher.mockResolvedValueOnce({
        job_id: 'cached-job-1',
        status: 'ready',
        video_info: {
          title: 'Cached Sample Video',
          duration: 120,
          fps: 60,
          heatmap: [0.1, 0.5, 0.9],
          asset_url: '/assets/sources/cached/video.mp4',
          folder_name: 'cached_folder'
        },
        hooks: [{ theme: 'Hook 1', start: 10, end: 40, duration: 30 }]
      });

      const statusSpy = vi.fn();
      const metaSpy = vi.fn();
      const hooksSpy = vi.fn();

      const spec: CachedAnalysisSpec = { videoId: 'video-999' };
      const jobId = await coordinator.analyzeCached(spec, {
        onStatusChange: statusSpy,
        onVideoMetadata: metaSpy,
        onHooksDiscovered: hooksSpy
      });

      expect(jobId).toBe('cached-job-1');
      expect(statusSpy).toHaveBeenCalledWith('ready');
      expect(metaSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cached Sample Video',
          duration: 120,
          hasHeatmap: true,
          videoUrl: 'http://localhost:8000/assets/sources/cached/video.mp4'
        })
      );
      expect(hooksSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ theme: 'Hook 1' })]),
        expect.objectContaining({ theme: 'Hook 1' })
      );
    });

    it('handles cached videos with real backend schema returning res.video', async () => {
      mockFetcher.mockResolvedValueOnce({
        job_id: 'cached-job-real',
        status: 'hooks_ready',
        video: {
          title: 'Real Backend Video',
          duration: 180,
          fps: 30,
          has_heatmap: true,
          asset_url: '/assets/sources/real_folder/preview.mp4',
          folder_name: 'real_folder',
          hd_ready: false,
          has_preview: true
        },
        hooks: [{ theme: 'Hook 2', start: 20, end: 50, duration: 30 }]
      });

      const metaSpy = vi.fn();
      const hooksSpy = vi.fn();

      const spec: CachedAnalysisSpec = { videoId: 'video-real' };
      const jobId = await coordinator.analyzeCached(spec, {
        onVideoMetadata: metaSpy,
        onHooksDiscovered: hooksSpy
      });

      expect(jobId).toBe('cached-job-real');
      expect(metaSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Real Backend Video',
          duration: 180,
          hasHeatmap: true,
          hasPreview: true,
          hdReady: false,
          videoUrl:
            'http://localhost:8000/assets/sources/real_folder/preview.mp4',
          folderName: 'real_folder'
        })
      );
      expect(hooksSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ theme: 'Hook 2' })]),
        expect.objectContaining({ theme: 'Hook 2' })
      );
    });
  });

  describe('extractClip', () => {
    it('calls extract endpoint and starts polling', async () => {
      mockFetcher.mockResolvedValueOnce({ status: 'cutting' });
      const statusSpy = vi.fn();

      const spec: ClipExtractSpec = {
        jobId: 'job-extract-1',
        startTime: 10,
        endTime: 40,
        theme: 'Cool Theme'
      };

      await coordinator.extractClip(spec, { onStatusChange: statusSpy });

      expect(mockFetcher).toHaveBeenCalledWith(
        'http://localhost:8000/api/extract-clip',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            job_id: 'job-extract-1',
            start_time: 10,
            end_time: 40
          })
        })
      );
      expect(statusSpy).toHaveBeenCalledWith('cutting');
      expect(coordinator.isPolling()).toBe(true);
    });
  });

  describe('Polling & 404 Self-Healing', () => {
    it('triggers self-healing on 404 when clip context exists', async () => {
      const err404: any = new Error('Not Found');
      err404.status = 404;
      mockFetcher.mockRejectedValue(err404);

      const selfHealSpy = vi.fn();
      const errorSpy = vi.fn();

      coordinator.startPolling(
        'expired-job-id',
        { folderName: '2026-08-sample', clipId: 'clip-42' },
        { onSelfHeal: selfHealSpy, onError: errorSpy }
      );

      await vi.advanceTimersByTimeAsync(10);

      expect(selfHealSpy).toHaveBeenCalledWith('2026-08-sample', 'clip-42');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(coordinator.isPolling()).toBe(false);
    });

    it('reports session expired when 404 occurs without clip context', async () => {
      const err404: any = new Error('Not Found');
      err404.status = 404;
      mockFetcher.mockRejectedValue(err404);

      const statusSpy = vi.fn();
      const errorSpy = vi.fn();

      coordinator.startPolling(
        'expired-job-id',
        { folderName: null, clipId: null },
        { onStatusChange: statusSpy, onError: errorSpy }
      );

      await vi.advanceTimersByTimeAsync(10);

      expect(statusSpy).toHaveBeenCalledWith('error');
      expect(errorSpy).toHaveBeenCalledWith(
        'Job session expired. Please re-analyze the video.'
      );
      expect(coordinator.isPolling()).toBe(false);
    });

    it('stops polling on terminal error status', async () => {
      mockFetcher.mockResolvedValueOnce({
        status: 'error',
        error: 'FFmpeg segmentation fault'
      });

      const statusSpy = vi.fn();
      const errorSpy = vi.fn();

      coordinator.startPolling(
        'failed-job',
        {},
        { onStatusChange: statusSpy, onError: errorSpy }
      );

      await vi.advanceTimersByTimeAsync(10);

      expect(statusSpy).toHaveBeenCalledWith('error');
      expect(errorSpy).toHaveBeenCalledWith('FFmpeg segmentation fault');
      expect(coordinator.isPolling()).toBe(false);
    });
  });

  describe('Clip Session hydration via startPolling & loadReadyClip', () => {
    it('startPolling hydrates via clipSessionClient.loadSession without 7-fetch static JSON fan-out', async () => {
      const requestedUrls: string[] = [];
      mockFetcher.mockImplementation((url: string) => {
        requestedUrls.push(url);
        if (url.includes('/api/job/job-poll-1')) {
          return Promise.resolve({
            status: 'ready',
            fps: 30,
            folder_name: '[SUARA] Title',
            clip: {
              asset_url:
                '/assets/clips/[SUARA] Title/10_25_Cool Clip/video.mp4',
              duration: 15,
              start: 10,
              end: 25,
              theme: 'Cool Clip',
              transcript_quote: 'Quote'
            },
            hooks: [{ theme: 'Cool Clip', start: 10, end: 25 }]
          });
        }
        if (url.includes('/api/clip-session/')) {
          return Promise.resolve({
            status: 'ok',
            session: {
              folder_name: '[SUARA] Title',
              clip_id: '10_25_Cool Clip',
              transcript: [{ start: 0, duration: 1.5, text: 'Hello' }],
              style_settings: { font: 'Roboto', fontSize: 60 },
              timeline: [
                { id: 'video', name: 'Main Video', type: 'video', items: [] },
                { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
                { id: 'text', name: 'Text layers', type: 'text', items: [] },
                {
                  id: 'subtitle',
                  name: 'Subtitle',
                  type: 'subtitle',
                  items: []
                }
              ],
              history: { undo_stack: [], redo_stack: [] },
              cover_config: { enabled: true, duration: 2.0, xOffset: 50 },
              crop_map: [{ time: 0, x: 960 }],
              asset_url:
                '/assets/clips/%5BSUARA%5D%20Title/10_25_Cool%20Clip/video.mp4',
              thumbnail_url:
                '/assets/clips/%5BSUARA%5D%20Title/10_25_Cool%20Clip/thumbnail.jpg',
              cover_url:
                '/assets/clips/%5BSUARA%5D%20Title/10_25_Cool%20Clip/cover.jpg'
            }
          });
        }
        if (url.includes('/saved_hooks')) {
          return Promise.resolve({
            saved_hooks: [{ id: 'saved-1', theme: 'Saved Hook' }]
          });
        }
        return Promise.resolve({});
      });

      const onClipReady = vi.fn();
      coordinator.startPolling('job-poll-1', {}, { onClipReady });

      await vi.advanceTimersByTimeAsync(10);

      expect(onClipReady).toHaveBeenCalledTimes(1);
      const bundle = onClipReady.mock.calls[0]![0];
      expect(bundle.transcript).toEqual([
        { start: 0, duration: 1.5, text: 'Hello' }
      ]);
      expect(bundle.styleSettings.font).toBe('Roboto');
      expect(bundle.styleSettings.fontSize).toBe(60);
      expect(bundle.cropMap).toEqual([{ time: 0, x: 960 }]);
      expect(bundle.timelineTracks.map((t: { id: string }) => t.id)).toEqual([
        'text',
        'video',
        'audio'
      ]);
      expect(bundle.thumbnailConfig?.enabled).toBe(true);
      expect(bundle.coverUrl).toContain('cover.jpg');

      // Ensure static 7-fetch JSON files and /api/cover/config are never called
      expect(requestedUrls.some(u => u.includes('transcript.json'))).toBe(
        false
      );
      expect(requestedUrls.some(u => u.includes('style_settings.json'))).toBe(
        false
      );
      expect(requestedUrls.some(u => u.includes('/api/cover/config'))).toBe(
        false
      );
      expect(requestedUrls.some(u => u.includes('/api/clip-session/'))).toBe(
        true
      );
    });

    it('startPolling skips loadSession while job status is queued even if clip metadata is present', async () => {
      const requestedUrls: string[] = [];
      mockFetcher.mockImplementation((url: string) => {
        requestedUrls.push(url);
        if (url.includes('/api/job/job-queued-1')) {
          return Promise.resolve({
            status: 'queued',
            folder_name: 'f1',
            clip: {
              asset_url: '/assets/clips/f1/c1/video.mp4',
              duration: 10
            }
          });
        }
        return Promise.resolve({});
      });

      const onClipReady = vi.fn();
      coordinator.startPolling('job-queued-1', {}, { onClipReady });

      await vi.advanceTimersByTimeAsync(10);

      expect(onClipReady).not.toHaveBeenCalled();
      expect(requestedUrls.some(u => u.includes('/api/clip-session/'))).toBe(
        false
      );
      expect(coordinator.isPolling()).toBe(true);
    });

    it('loadReadyClip hydrates complete bundle from single POST /api/load-ready-clip response and preserves queued status', async () => {
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/api/load-ready-clip')) {
          return Promise.resolve({
            job_id: 'load-job-1',
            status: 'queued',
            fps: 60,
            clip: {
              duration: 45.0,
              theme: 'Loaded Ready Clip',
              transcript_quote: 'Famous quote',
              start: 0,
              end: 45
            },
            hooks: [{ theme: 'Hook A' }],
            saved_hooks: [{ id: 's1', theme: 'Saved 1' }],
            session: {
              folder_name: 'folder-1',
              clip_id: 'clip-1',
              transcript: [{ start: 0, duration: 2, text: 'Sample' }],
              style_settings: { font: 'Outfit', fontSize: 68 },
              timeline: [
                { id: 'video', name: 'Main Video', type: 'video', items: [] }
              ],
              history: { undo_stack: [{ selectedId: 'x' }], redo_stack: [] },
              cover_config: { enabled: true, duration: 1.5, xOffset: 40 },
              crop_map: [{ time: 0, x: 800 }],
              asset_url: '/assets/clips/folder-1/clip-1/video.mp4',
              thumbnail_url: '/assets/clips/folder-1/clip-1/thumbnail.jpg',
              cover_url: '/assets/clips/folder-1/clip-1/cover.jpg'
            }
          });
        }
        return Promise.reject(new Error(`Unexpected extra fetch to ${url}`));
      });

      const bundle = await coordinator.loadReadyClip('folder-1', 'clip-1');

      expect(mockFetcher).toHaveBeenCalledTimes(1);
      expect(bundle.status).toBe('queued');
      expect(bundle.videoFps).toBe(60);
      expect(bundle.videoDuration).toBe(45.0);
      expect(bundle.activeHook?.theme).toBe('Loaded Ready Clip');
      expect(bundle.activeHook?.transcript_quote).toBe('Famous quote');
      expect(bundle.savedHooks).toEqual([{ id: 's1', theme: 'Saved 1' }]);
      expect(bundle.history).toEqual({
        undo_stack: [{ selectedId: 'x' }],
        redo_stack: []
      });
      expect(bundle.styleSettings.font).toBe('Outfit');
      expect(bundle.cropMap).toEqual([{ time: 0, x: 800 }]);
      expect(bundle.thumbnailConfig?.enabled).toBe(true);
      expect(bundle.coverUrl).toBe('/assets/clips/folder-1/clip-1/cover.jpg');
      expect(bundle.assetUrl).toBe(
        'http://localhost:8000/assets/clips/folder-1/clip-1/video.mp4'
      );
      expect(coordinator.getActiveJobId()).toBe('load-job-1');
    });
  });

  describe('Bounded Polling Phases, Single-Flight & Diffed Emissions', () => {
    it('does not start polling when analyzeCached returns ready with hd_ready and hook thumbnails, and fetches saved_hooks once', async () => {
      const requestedUrls: string[] = [];
      mockFetcher.mockImplementation((url: string) => {
        requestedUrls.push(url);
        if (url.includes('/api/analyze-cached/cached-full')) {
          return Promise.resolve({
            job_id: 'job-cached-full',
            status: 'ready',
            video: {
              title: 'Full Ready Video',
              duration: 120,
              fps: 30,
              has_heatmap: false,
              asset_url: '/assets/sources/full_folder/full.mp4',
              folder_name: 'full_folder',
              hd_ready: true,
              has_preview: true
            },
            hooks: [
              {
                theme: 'Hook 1',
                start: 10,
                end: 40,
                thumbnail_url: '/assets/sources/full_folder/hook_0.jpg'
              }
            ]
          });
        }
        if (url.includes('/api/cached/full_folder/saved_hooks')) {
          return Promise.resolve({
            saved_hooks: [{ id: 's1', start: 5, end: 25, theme: 'Saved Hook' }]
          });
        }
        return Promise.resolve({});
      });

      const savedHooksSpy = vi.fn();
      const jobId = await coordinator.analyzeCached(
        { videoId: 'cached-full' },
        { onSavedHooksDiscovered: savedHooksSpy }
      );

      expect(jobId).toBe('job-cached-full');
      expect(coordinator.isPolling()).toBe(false);
      expect(coordinator.getPollingPhase()).toBe('idle');
      expect(savedHooksSpy).toHaveBeenCalledTimes(1);
      expect(savedHooksSpy).toHaveBeenCalledWith([
        { id: 's1', start: 5, end: 25, theme: 'Saved Hook' }
      ]);

      await vi.advanceTimersByTimeAsync(5000);
      expect(requestedUrls.some(u => u.includes('/api/job/'))).toBe(false);
    });

    it('runs bounded thumbnail_backfill polling for #362 missing thumbnails and halts once thumbnails arrive', async () => {
      let pollCount = 0;
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/api/analyze-cached/cached-backfill')) {
          return Promise.resolve({
            job_id: 'job-backfill',
            status: 'ready',
            video: {
              title: 'Backfill Video',
              duration: 120,
              folder_name: 'bf_folder',
              hd_ready: true
            },
            hooks: [{ theme: 'Hook Missing Thumb', start: 10, end: 40 }]
          });
        }
        if (url.includes('/api/cached/bf_folder/saved_hooks')) {
          return Promise.resolve({ saved_hooks: [] });
        }
        if (url.includes('/api/job/job-backfill')) {
          pollCount += 1;
          if (pollCount === 1) {
            return Promise.resolve({
              status: 'ready',
              folder_name: 'bf_folder',
              video: { hd_ready: true, folder_name: 'bf_folder' },
              hooks: [{ theme: 'Hook Missing Thumb', start: 10, end: 40 }]
            });
          }
          return Promise.resolve({
            status: 'ready',
            folder_name: 'bf_folder',
            video: { hd_ready: true, folder_name: 'bf_folder' },
            hooks: [
              {
                theme: 'Hook Missing Thumb',
                start: 10,
                end: 40,
                thumbnail_url: '/assets/sources/bf_folder/hook_0.jpg'
              }
            ]
          });
        }
        return Promise.resolve({});
      });

      const hooksSpy = vi.fn();
      await coordinator.analyzeCached(
        { videoId: 'cached-backfill' },
        { onHooksDiscovered: hooksSpy }
      );

      expect(coordinator.isPolling()).toBe(true);
      expect(coordinator.getPollingPhase()).toBe('thumbnail_backfill');
      expect(hooksSpy).toHaveBeenCalledTimes(1);

      // Tick 1: thumbnails still missing -> does NOT re-emit identical hooks
      await vi.advanceTimersByTimeAsync(100);
      expect(pollCount).toBe(1);
      expect(coordinator.isPolling()).toBe(true);
      expect(hooksSpy).toHaveBeenCalledTimes(1);

      // Tick 2: thumbnails backfilled -> emits updated hooks and halts immediately
      await vi.advanceTimersByTimeAsync(100);
      expect(pollCount).toBe(2);
      expect(hooksSpy).toHaveBeenCalledTimes(2);
      expect(coordinator.isPolling()).toBe(false);
      expect(coordinator.getPollingPhase()).toBe('idle');

      await vi.advanceTimersByTimeAsync(2000);
      expect(pollCount).toBe(2);
    });

    it('halts thumbnail_backfill after maxThumbnailBackfillPolls if thumbnails never populate', async () => {
      const boundedCoordinator = new IngestionJobCoordinator(
        'http://localhost:8000',
        mockFetcher,
        { pollIntervalMs: 50, maxThumbnailBackfillPolls: 3 }
      );

      let pollCount = 0;
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/api/analyze-cached/cached-never')) {
          return Promise.resolve({
            job_id: 'job-bf-cap',
            status: 'ready',
            video: { hd_ready: true, folder_name: 'cap_folder' },
            hooks: [{ theme: 'No Thumb Hook', start: 5, end: 25 }]
          });
        }
        if (url.includes('/saved_hooks')) {
          return Promise.resolve({ saved_hooks: [] });
        }
        if (url.includes('/api/job/job-bf-cap')) {
          pollCount += 1;
          return Promise.resolve({
            status: 'ready',
            video: { hd_ready: true, folder_name: 'cap_folder' },
            hooks: [{ theme: 'No Thumb Hook', start: 5, end: 25 }]
          });
        }
        return Promise.resolve({});
      });

      await boundedCoordinator.analyzeCached({ videoId: 'cached-never' });
      expect(boundedCoordinator.isPolling()).toBe(true);

      await vi.advanceTimersByTimeAsync(500);
      expect(pollCount).toBe(3);
      expect(boundedCoordinator.isPolling()).toBe(false);
      boundedCoordinator.stopPolling();
    });

    it('transitions analyzing -> hd_prefetch -> halts cleanly when ready + hd_ready without clip', async () => {
      let pollCount = 0;
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/api/analyze-url')) {
          return Promise.resolve({ job_id: 'job-url-1', status: 'queued' });
        }
        if (url.includes('/saved_hooks')) {
          return Promise.resolve({
            saved_hooks: [{ id: 'sh-1', start: 1, end: 15, theme: 'Saved' }]
          });
        }
        if (url.includes('/api/job/job-url-1')) {
          pollCount += 1;
          if (pollCount === 1) {
            return Promise.resolve({
              status: 'hooks_ready',
              download_percent: 35,
              folder_name: 'url_folder',
              video: { hd_ready: false, folder_name: 'url_folder' },
              hooks: [
                {
                  start: 10,
                  end: 30,
                  theme: 'Viral Hook',
                  thumbnail_url: '/thumb.jpg'
                }
              ]
            });
          }
          return Promise.resolve({
            status: 'ready',
            download_percent: 100,
            folder_name: 'url_folder',
            video: { hd_ready: true, folder_name: 'url_folder' },
            hooks: [
              {
                start: 10,
                end: 30,
                theme: 'Viral Hook',
                thumbnail_url: '/thumb.jpg'
              }
            ]
          });
        }
        return Promise.resolve({});
      });

      const savedHooksSpy = vi.fn();
      const hooksSpy = vi.fn();
      await coordinator.analyzeUrl(
        { url: 'https://youtube.com/watch?v=abc' },
        { onSavedHooksDiscovered: savedHooksSpy, onHooksDiscovered: hooksSpy }
      );

      // Tick 1 ran immediately on startPolling -> hooks_ready -> hd_prefetch
      await vi.advanceTimersByTimeAsync(10);
      expect(pollCount).toBe(1);
      expect(coordinator.getPollingPhase()).toBe('hd_prefetch');
      expect(coordinator.isPolling()).toBe(true);

      // Tick 2 -> ready + hd_ready -> halts immediately
      await vi.advanceTimersByTimeAsync(100);
      expect(pollCount).toBe(2);
      expect(coordinator.isPolling()).toBe(false);
      expect(coordinator.getPollingPhase()).toBe('idle');
      expect(savedHooksSpy).toHaveBeenCalledTimes(1);
      expect(hooksSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(pollCount).toBe(2);
    });

    it('halts stagnant hd_prefetch polling after maxStagnantHdPrefetchPolls without emitting error', async () => {
      const boundedCoordinator = new IngestionJobCoordinator(
        'http://localhost:8000',
        mockFetcher,
        { pollIntervalMs: 50, maxStagnantHdPrefetchPolls: 3 }
      );

      let pollCount = 0;
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/api/job/job-stalled')) {
          pollCount += 1;
          return Promise.resolve({
            status: 'hooks_ready',
            download_percent: 20,
            folder_name: 'stall_folder',
            video: { hd_ready: false, folder_name: 'stall_folder' },
            hooks: [
              { start: 0, end: 20, theme: 'Hook', thumbnail_url: '/t.jpg' }
            ]
          });
        }
        return Promise.resolve({ saved_hooks: [] });
      });

      const errorSpy = vi.fn();
      boundedCoordinator.startPolling(
        'job-stalled',
        { phase: 'hd_prefetch' },
        { onError: errorSpy }
      );

      await vi.advanceTimersByTimeAsync(1000);
      expect(pollCount).toBe(4);
      expect(boundedCoordinator.isPolling()).toBe(false);
      expect(errorSpy).not.toHaveBeenCalled();
      boundedCoordinator.stopPolling();
    });

    it('guarantees single-flight polling and drops stale in-flight results after stopPolling()', async () => {
      const pendingResolvers: Array<(val: unknown) => void> = [];
      let jobFetchCalls = 0;
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/api/job/job-slow')) {
          jobFetchCalls += 1;
          return new Promise(resolve => {
            pendingResolvers.push(resolve);
          });
        }
        return Promise.resolve({});
      });

      const statusSpy = vi.fn();
      coordinator.startPolling('job-slow', {}, { onStatusChange: statusSpy });

      expect(jobFetchCalls).toBe(1);

      // Advance well past pollIntervalMs while first fetch is still pending -> must NOT overlap
      await vi.advanceTimersByTimeAsync(500);
      expect(jobFetchCalls).toBe(1);

      // Cancel polling before slow response arrives
      coordinator.stopPolling();
      expect(coordinator.isPolling()).toBe(false);

      pendingResolvers[0]?.({ status: 'downloading', download_percent: 50 });
      await Promise.resolve();
      await Promise.resolve();

      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('fetches saved_hooks at most once per folder across multiple ticks', async () => {
      let savedHooksFetchCount = 0;
      let tick = 0;
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('/saved_hooks')) {
          savedHooksFetchCount += 1;
          return Promise.resolve({
            saved_hooks: [{ id: 's1', start: 0, end: 10, theme: 'Saved' }]
          });
        }
        if (url.includes('/api/job/job-saved-once')) {
          tick += 1;
          return Promise.resolve({
            status: 'downloading_video',
            download_percent: tick * 10,
            folder_name: 'same_folder'
          });
        }
        return Promise.resolve({});
      });

      coordinator.startPolling('job-saved-once');
      await vi.advanceTimersByTimeAsync(350);

      expect(tick).toBeGreaterThanOrEqual(3);
      expect(savedHooksFetchCount).toBe(1);
    });
  });
});
