// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useClipperJob } from '../../app/composables/useClipperJob'

// Mock useTimelineState
const mockTimelineTracks = { value: [{ items: [] as any[] }] }
const mockIsSavingLocked = { value: false }
vi.mock('../../app/composables/useTimelineState', () => ({
  useTimelineState: () => ({
    isSavingLocked: mockIsSavingLocked,
    timelineTracks: mockTimelineTracks,
    loadHistoryFromResponse: vi.fn()
  })
}))

// Mock resolveThumbnailTextStyle, calculateNextOverlayPosition, mapThumbnailOverlays
vi.mock('../../app/utils/thumbnailHelpers', () => ({
  resolveThumbnailTextStyle: vi.fn(),
  calculateNextOverlayPosition: vi.fn().mockReturnValue({ x: 50, y: 50 }),
  mapThumbnailOverlays: vi.fn().mockReturnValue([])
}))

describe('useClipperJob Sub-composable - Subtitle Style Loading', () => {
  let mockStyleResponse: any = null
  let mockDefaultStyleResponse: any = null

  beforeEach(() => {
    mockStyleResponse = null
    mockDefaultStyleResponse = null
    mockIsSavingLocked.value = false

    // Reset state values to defaults before each test
    const font = useState<string>('font')
    const fontSize = useState<number>('fontSize')
    const subtitlePreset = useState<string>('subtitlePreset')
    font.value = 'Montserrat'
    fontSize.value = 100
    subtitlePreset.value = 'bold-podcast'

    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/style_settings.json')) {
        if (mockStyleResponse) {
          return Promise.resolve(mockStyleResponse)
        }
        return Promise.reject({ status: 404 })
      }
      if (urlStr.includes('/default_style_settings.json')) {
        if (mockDefaultStyleResponse) {
          return Promise.resolve(mockDefaultStyleResponse)
        }
        return Promise.reject({ status: 404 })
      }
      if (urlStr.includes('/api/load-ready-clip')) {
        return Promise.resolve({
          job_id: 'job-123',
          status: 'ready',
          clip: {
            asset_url: '/assets/clips/folder/clip_id/video.mp4',
            duration: 10
          }
        })
      }
      if (urlStr.includes('/api/thumbnail/config')) {
        return Promise.resolve({ config: null })
      }
      return Promise.resolve({})
    }))
  })

  it('resets subtitle styles to defaults before loading custom styles', async () => {
    const font = useState<string>('font')
    const fontSize = useState<number>('fontSize')
    
    // Set non-default values first
    font.value = 'Impact'
    fontSize.value = 150

    mockStyleResponse = {
      font: 'Arial',
      fontSize: 120
    }

    const { loadReadyClipIntoEditor } = useClipperJob()
    await loadReadyClipIntoEditor('folder', '10_20_clip')

    expect(font.value).toBe('Arial')
    expect(fontSize.value).toBe(120)
  })

  it('falls back to global default style settings if custom style settings 404', async () => {
    const font = useState<string>('font')
    const fontSize = useState<number>('fontSize')
    
    font.value = 'Impact'
    fontSize.value = 150

    // No custom style, but global default exists
    mockDefaultStyleResponse = {
      font: 'Open Sans',
      fontSize: 90
    }

    const { loadReadyClipIntoEditor } = useClipperJob()
    await loadReadyClipIntoEditor('folder', '10_20_clip')

    expect(font.value).toBe('Open Sans')
    expect(fontSize.value).toBe(90)
  })

  it('falls back to hardcoded defaults if both custom and global style settings 404', async () => {
    const font = useState<string>('font')
    const fontSize = useState<number>('fontSize')
    
    font.value = 'Impact'
    fontSize.value = 150

    // Both style fetches will 404 based on mock implementation

    const { loadReadyClipIntoEditor } = useClipperJob()
    await loadReadyClipIntoEditor('folder', '10_20_clip')

    // Montserrat and 50 are the hardcoded defaults
    expect(font.value).toBe('Montserrat')
    expect(fontSize.value).toBe(50)
  })

  it('cascades global default settings under custom style settings overrides', async () => {
    const font = useState<string>('font')
    const fontSize = useState<number>('fontSize')
    const subtitlePreset = useState<string>('subtitlePreset')

    font.value = 'Impact'
    fontSize.value = 150
    subtitlePreset.value = 'clean-vlog'

    mockDefaultStyleResponse = {
      font: 'Open Sans',
      fontSize: 90,
      subtitlePreset: 'minimal'
    }

    mockStyleResponse = {
      fontSize: 110
    }

    const { loadReadyClipIntoEditor } = useClipperJob()
    await loadReadyClipIntoEditor('folder', '10_20_clip')

    // font and subtitlePreset should be inherited from global default
    // fontSize should be overridden by custom style
    expect(font.value).toBe('Open Sans')
    expect(fontSize.value).toBe(110)
    expect(subtitlePreset.value).toBe('minimal')
  })

  it('loads timeline when polling returns ready job and timeline is empty', async () => {
    vi.useFakeTimers()
    const { startPolling, stopPolling, jobId } = useClipperJob()
    
    jobId.value = 'job-123'
    mockTimelineTracks.value = [{ items: [] }] // Empty timeline
    
    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/job/job-123')) {
        return Promise.resolve({
          status: 'ready',
          clip: {
            asset_url: '/assets/clips/folder/clip-1/video.mp4',
            duration: 10,
            transcript: []
          }
        })
      }
      if (urlStr.includes('/timeline.json')) {
        return Promise.resolve([
          { items: [{ id: 'mock-item-from-file' }] }
        ])
      }
      return Promise.resolve({})
    }))

    startPolling()
    
    await vi.advanceTimersByTimeAsync(2000)
    
    expect(mockTimelineTracks.value[0]?.items.length).toBe(1)
    expect(mockTimelineTracks.value[0]?.items[0]?.id).toBe('mock-item-from-file')
    
    stopPolling()
    vi.useRealTimers()
  })

  it('locks saving during loadReadyClipIntoEditor to prevent premature auto-saves', async () => {
    vi.useFakeTimers()
    let wasLockedDuringFetch = false

    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url) => {
      const urlStr = String(url)
      if (urlStr.includes('/api/load-ready-clip')) {
        wasLockedDuringFetch = mockIsSavingLocked.value
        return Promise.resolve({
          job_id: 'job-123',
          status: 'ready',
          clip: {
            asset_url: '/assets/clips/folder/clip_id/video.mp4',
            duration: 10
          }
        })
      }
      return Promise.resolve({})
    }))

    const { loadReadyClipIntoEditor } = useClipperJob()
    
    const loadPromise = loadReadyClipIntoEditor('folder', '10_20_clip')
    await loadPromise
    
    expect(wasLockedDuringFetch).toBe(true)
    expect(mockIsSavingLocked.value).toBe(true)
    
    await vi.advanceTimersByTimeAsync(500)
    expect(mockIsSavingLocked.value).toBe(false)
    
    vi.useRealTimers()
  })

  it('transitions jobStatus to error and stops polling if an unexpected exception occurs during polling tick', async () => {
    vi.useFakeTimers()
    const { startPolling, stopPolling, jobId, jobStatus, jobError } = useClipperJob()
    
    jobId.value = 'job-123'
    jobStatus.value = 'cutting'
    jobError.value = null
    
    vi.stubGlobal('$fetch', vi.fn().mockImplementation(() => {
      throw new Error('Network failure or JSON parse error')
    }))

    startPolling()
    
    await vi.advanceTimersByTimeAsync(2000)
    
    expect(jobStatus.value).toBe('error')
    expect(jobError.value).toBe('Network failure or JSON parse error')
    
    stopPolling()
    vi.useRealTimers()
  })
})

