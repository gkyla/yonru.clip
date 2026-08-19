import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  IngestionJobCoordinator,
  DEFAULT_SUBTITLE_STYLES,
  type AnalysisSpec,
  type CachedAnalysisSpec,
  type ClipExtractSpec
} from '../../app/utils/jobCoordinator'

describe('IngestionJobCoordinator Unit Tests', () => {
  let mockFetcher: ReturnType<typeof vi.fn>
  let coordinator: IngestionJobCoordinator

  beforeEach(() => {
    vi.useFakeTimers()
    mockFetcher = vi.fn()
    coordinator = new IngestionJobCoordinator('http://localhost:8000', mockFetcher, 100)
  })

  afterEach(() => {
    coordinator.stopPolling()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Subtitle Style Management', () => {
    it('returns default subtitle styles', () => {
      const defaults = coordinator.resetSubtitleStyles()
      expect(defaults.font).toBe('Montserrat')
      expect(defaults.fontSize).toBe(50)
      expect(defaults.videoLayout).toBe('vertical')
      expect(defaults.subtitleMode).toBe('word')
    })

    it('correctly merges override styles onto baseline', () => {
      const merged = coordinator.mergeSubtitleStyles(DEFAULT_SUBTITLE_STYLES, {
        font: 'Roboto',
        fontSize: 32,
        subtitleStrokeWidth: 5
      })

      expect(merged.font).toBe('Roboto')
      expect(merged.fontSize).toBe(32)
      expect(merged.subtitleStrokeWidth).toBe(5)
      expect(merged.videoLayout).toBe('vertical') // Preserved from base
    })
  })

  describe('analyzeUrl', () => {
    it('schedules analysis, sets queued status, and starts polling', async () => {
      mockFetcher.mockResolvedValueOnce({ job_id: 'job-123', status: 'queued' })
      mockFetcher.mockResolvedValue({ status: 'downloading', download_percent: 45.0 })

      const statusSpy = vi.fn()
      const progressSpy = vi.fn()

      const spec: AnalysisSpec = {
        url: 'https://youtube.com/watch?v=sample123',
        language: 'id',
        extractionMode: 'preset',
        presetId: 'auto'
      }

      const jobId = await coordinator.analyzeUrl(spec, {
        onStatusChange: statusSpy,
        onDownloadProgress: progressSpy
      })

      expect(jobId).toBe('job-123')
      expect(statusSpy).toHaveBeenCalledWith('queued')
      expect(coordinator.isPolling()).toBe(true)

      // Advance timer to trigger poll
      await vi.advanceTimersByTimeAsync(100)
      expect(statusSpy).toHaveBeenCalledWith('downloading')
      expect(progressSpy).toHaveBeenCalledWith(45.0)
    })

    it('handles analysis API errors gracefully', async () => {
      mockFetcher.mockRejectedValueOnce(new Error('Network error'))
      const statusSpy = vi.fn()
      const errorSpy = vi.fn()

      await expect(
        coordinator.analyzeUrl(
          { url: 'https://invalid.com' },
          { onStatusChange: statusSpy, onError: errorSpy }
        )
      ).rejects.toThrow('Network error')

      expect(statusSpy).toHaveBeenCalledWith('error')
      expect(errorSpy).toHaveBeenCalledWith('Network error')
      expect(coordinator.isPolling()).toBe(false)
    })
  })

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
        hooks: [
          { theme: 'Hook 1', start: 10, end: 40, duration: 30 }
        ]
      })

      const statusSpy = vi.fn()
      const metaSpy = vi.fn()
      const hooksSpy = vi.fn()

      const spec: CachedAnalysisSpec = { videoId: 'video-999' }
      const jobId = await coordinator.analyzeCached(spec, {
        onStatusChange: statusSpy,
        onVideoMetadata: metaSpy,
        onHooksDiscovered: hooksSpy
      })

      expect(jobId).toBe('cached-job-1')
      expect(statusSpy).toHaveBeenCalledWith('ready')
      expect(metaSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cached Sample Video',
          duration: 120,
          hasHeatmap: true,
          videoUrl: 'http://localhost:8000/assets/sources/cached/video.mp4'
        })
      )
      expect(hooksSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ theme: 'Hook 1' })]),
        expect.objectContaining({ theme: 'Hook 1' })
      )
    })
  })

  describe('extractClip', () => {
    it('calls extract endpoint and starts polling', async () => {
      mockFetcher.mockResolvedValueOnce({ status: 'cutting' })
      const statusSpy = vi.fn()

      const spec: ClipExtractSpec = {
        jobId: 'job-extract-1',
        startTime: 10,
        endTime: 40,
        theme: 'Cool Theme'
      }

      await coordinator.extractClip(spec, { onStatusChange: statusSpy })

      expect(mockFetcher).toHaveBeenCalledWith(
        'http://localhost:8000/api/extract-clip',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({ job_id: 'job-extract-1', start_time: 10, end_time: 40 })
        })
      )
      expect(statusSpy).toHaveBeenCalledWith('cutting')
      expect(coordinator.isPolling()).toBe(true)
    })
  })

  describe('Polling & 404 Self-Healing', () => {
    it('triggers self-healing on 404 when clip context exists', async () => {
      const err404: any = new Error('Not Found')
      err404.status = 404
      mockFetcher.mockRejectedValue(err404)

      const selfHealSpy = vi.fn()
      const errorSpy = vi.fn()

      coordinator.startPolling(
        'expired-job-id',
        { folderName: '2026-08-sample', clipId: 'clip-42' },
        { onSelfHeal: selfHealSpy, onError: errorSpy }
      )

      await vi.advanceTimersByTimeAsync(10)

      expect(selfHealSpy).toHaveBeenCalledWith('2026-08-sample', 'clip-42')
      expect(errorSpy).not.toHaveBeenCalled()
      expect(coordinator.isPolling()).toBe(false)
    })

    it('reports session expired when 404 occurs without clip context', async () => {
      const err404: any = new Error('Not Found')
      err404.status = 404
      mockFetcher.mockRejectedValue(err404)

      const statusSpy = vi.fn()
      const errorSpy = vi.fn()

      coordinator.startPolling(
        'expired-job-id',
        { folderName: null, clipId: null },
        { onStatusChange: statusSpy, onError: errorSpy }
      )

      await vi.advanceTimersByTimeAsync(10)

      expect(statusSpy).toHaveBeenCalledWith('error')
      expect(errorSpy).toHaveBeenCalledWith('Job session expired. Please re-analyze the video.')
      expect(coordinator.isPolling()).toBe(false)
    })

    it('stops polling on terminal error status', async () => {
      mockFetcher.mockResolvedValueOnce({
        status: 'error',
        error: 'FFmpeg segmentation fault'
      })

      const statusSpy = vi.fn()
      const errorSpy = vi.fn()

      coordinator.startPolling('failed-job', {}, { onStatusChange: statusSpy, onError: errorSpy })

      await vi.advanceTimersByTimeAsync(10)

      expect(statusSpy).toHaveBeenCalledWith('error')
      expect(errorSpy).toHaveBeenCalledWith('FFmpeg segmentation fault')
      expect(coordinator.isPolling()).toBe(false)
    })
  })

  describe('loadClipAssets', () => {
    it('fetches multi-file assets in parallel and resolves cascaded bundle', async () => {
      mockFetcher.mockImplementation((url: string) => {
        if (url.includes('default_style_settings.json')) {
          return Promise.resolve({ font: 'Roboto', fontSize: 40 })
        }
        if (url.includes('style_settings.json')) {
          return Promise.resolve({ fontSize: 60, subtitleHighlightColor: '#FF0000' })
        }
        if (url.includes('transcript.json')) {
          return Promise.resolve([
            { start: 0, duration: 1.5, text: 'Hello world' }
          ])
        }
        if (url.includes('crop_map.json')) {
          return Promise.resolve([{ time: 0, x: 960 }])
        }
        if (url.includes('timeline.json')) {
          return Promise.resolve([
            { id: 'video', name: 'Video', type: 'video', items: [] }
          ])
        }
        if (url.includes('thumbnail/config')) {
          return Promise.resolve({
            config: { enabled: true, duration: 2.0, xOffset: 50 }
          })
        }
        if (url.includes('saved_hooks')) {
          return Promise.resolve({
            saved_hooks: [{ id: 'saved-1', theme: 'Saved Hook' }]
          })
        }
        return Promise.resolve({})
      })

      const bundle = await coordinator.loadClipAssets('test-folder', 'clip-101')

      expect(bundle.folderName).toBe('test-folder')
      expect(bundle.clipId).toBe('clip-101')
      expect(bundle.transcript).toHaveLength(1)
      expect(bundle.transcript[0]?.text).toBe('Hello world')
      expect(bundle.styleSettings.font).toBe('Roboto') // From default style
      expect(bundle.styleSettings.fontSize).toBe(60) // Overridden by clip style
      expect(bundle.styleSettings.subtitleHighlightColor).toBe('#FF0000')
      expect(bundle.cropMap).toEqual([{ time: 0, x: 960 }])
      expect(bundle.timelineTracks).toHaveLength(2) // Video track + subtitle track injected
      expect(bundle.thumbnailConfig?.enabled).toBe(true)
      expect(bundle.savedHooks).toHaveLength(1)
    })

    it('triggers on-demand crop map backfill when crop_map.json is missing', async () => {
      mockFetcher.mockImplementation((url: string, opts?: any) => {
        if (url.includes('crop_map.json')) {
          return Promise.reject(new Error('404 Not Found'))
        }
        if (url.includes('/track-face') && opts?.method === 'POST') {
          return Promise.resolve({
            status: 'ready',
            crop_map: [{ time: 0, x: 800 }, { time: 2.5, x: 820 }]
          })
        }
        return Promise.resolve({})
      })

      const bundle = await coordinator.loadClipAssets('folder-crop', 'clip-crop')
      expect(bundle.cropMap).toHaveLength(2)
      expect(bundle.cropMap[0]?.x).toBe(800)
    })
  })

  describe('loadReadyClip', () => {
    it('invokes API and resolves complete hydrated bundle', async () => {
      mockFetcher.mockImplementation((url: string, opts?: any) => {
        if (url.includes('/api/load-ready-clip')) {
          return Promise.resolve({
            job_id: 'load-job-1',
            status: 'ready',
            fps: 60,
            clip: {
              duration: 45.0,
              theme: 'Loaded Ready Clip',
              transcript_quote: 'Famous quote'
            },
            hooks: [{ theme: 'Hook A' }],
            history: { undo_stack: [], redo_stack: [] }
          })
        }
        if (url.includes('transcript.json')) {
          return Promise.resolve([{ start: 0, duration: 2, text: 'Sample' }])
        }
        return Promise.resolve({})
      })

      const bundle = await coordinator.loadReadyClip('folder-1', 'clip-1')

      expect(bundle.videoFps).toBe(60)
      expect(bundle.videoDuration).toBe(45.0)
      expect(bundle.activeHook?.theme).toBe('Loaded Ready Clip')
      expect(bundle.activeHook?.transcript_quote).toBe('Famous quote')
      expect(bundle.history).toEqual({ undo_stack: [], redo_stack: [] })
      expect(coordinator.getActiveJobId()).toBe('load-job-1')
    })
  })
})
