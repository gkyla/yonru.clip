// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useClipperExport } from '../../app/composables/useClipperExport'

// Mock useTimelineState
vi.mock('../../app/composables/useTimelineState', () => ({
  useTimelineState: () => ({
    timelineTracks: { value: [] }
  })
}))

describe('useClipperExport Composable', () => {
  let mockDeps: any
  let capturedBody: any = null

  beforeEach(() => {
    capturedBody = null
    mockDeps = {
      saveTranscript: vi.fn().mockResolvedValue(undefined),
      saveStyleSettings: vi.fn().mockResolvedValue(undefined),
      saveTimelineTracks: vi.fn().mockResolvedValue(undefined),
      saveThumbnailConfig: vi.fn().mockResolvedValue(undefined)
    }

    const jobId = useState<string | null>('jobId')
    const jobError = useState<string>('jobError')
    const renderStatus = useState<string>('renderStatus')
    const videoLayout = useState<string>('videoLayout')
    
    jobId.value = 'test-job-id'
    jobError.value = ''
    renderStatus.value = 'idle'
    videoLayout.value = 'landscape'

    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, opts) => {
      if (opts?.body) {
        try {
          capturedBody = JSON.parse(opts.body)
        } catch {}
      }
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => {
            let done = false
            return {
              read: () => {
                if (done) return Promise.resolve({ done: true, value: undefined })
                done = true
                const sse = 'data: {"stage":"done","percent":100,"outputUrl":"/static/output/clip.mp4"}\n\n'
                return Promise.resolve({ done: false, value: new TextEncoder().encode(sse) })
              }
            }
          }
        }
      })
    }))
  })

  it('includes video_layout in buildRenderBody payload and executes stream successfully', async () => {
    const { renderClip, renderStatus, outputUrl } = useClipperExport(mockDeps)

    await renderClip(0, 'My Test Output')

    expect(mockDeps.saveTranscript).toHaveBeenCalledWith(true)
    expect(mockDeps.saveStyleSettings).toHaveBeenCalled()
    expect(mockDeps.saveTimelineTracks).toHaveBeenCalled()
    expect(mockDeps.saveThumbnailConfig).toHaveBeenCalled()

    expect(capturedBody).not.toBeNull()
    expect(capturedBody.job_id).toBe('test-job-id')
    expect(capturedBody.output_name).toBe('My Test Output')
    expect(capturedBody.video_layout).toBe('landscape')

    expect(renderStatus.value).toBe('done')
    expect(outputUrl.value).toBe('http://localhost:8000/static/output/clip.mp4')
  })

  it('sets error status when jobId is missing rather than failing silently', async () => {
    const jobId = useState<string | null>('jobId')
    jobId.value = null

    const { renderClip, renderStatus } = useClipperExport(mockDeps)
    await renderClip(0, 'Test Output')

    expect(renderStatus.value).toBe('error')
    const jobError = useState<string>('jobError')
    expect(jobError.value).toContain('job ID')
  })
})
