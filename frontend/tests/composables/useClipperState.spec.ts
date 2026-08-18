// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick, watchEffect } from 'vue'
import { useClipperState } from '../../app/composables/useClipperState'
import { useState } from '#imports'

describe('useClipperState Composable', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
    const state = useClipperState()
    state.cropMode.value = 'face_tracking'
    state.cropMap.value = []
  })

  it('updates lastAccessedClip when a valid clip finishes loading (ready)', async () => {
    const state = useClipperState()
    
    // Reset state first
    state.resetWorkspace()
    state.lastAccessedClip.value = null
    await nextTick()

    // Initialize persistence (setup watch)
    state.initPersistence()

    // Simulate active hook
    state.activeHook.value = {
      theme: 'My Active Clip',
      start: 10,
      end: 20,
      duration: 10
    }

    // Set clip state to ready
    state.folderName.value = 'folderA'
    state.clipId.value = 'clipA'
    state.jobStatus.value = 'ready'

    // Wait for watchers
    await nextTick()

    interface LastClip {
      folder: string
      clip_id: string
      title?: string
    }

    const lastClip = state.lastAccessedClip.value as LastClip | null
    expect(lastClip).toEqual({
      folder: 'folderA',
      clip_id: 'clipA',
      title: 'My Active Clip'
    })
    expect(localStorage.getItem('yonru_last_clip')).toContain('clipA')
  })

  it('does NOT update lastAccessedClip when loading a cached library video without a clip (repro bug)', async () => {
    const state = useClipperState()
    
    // Reset and initialize
    state.resetWorkspace()
    state.lastAccessedClip.value = null
    await nextTick()
    
    state.initPersistence()

    // 1. Load a valid clip first
    state.activeHook.value = { theme: 'First Clip', start: 10, end: 20, duration: 10 }
    state.folderName.value = 'folderA'
    state.clipId.value = 'clipA'
    state.jobStatus.value = 'ready'
    await nextTick()

    interface LastClip {
      folder: string
      clip_id: string
      title?: string
    }

    const firstLastClip = state.lastAccessedClip.value as LastClip | null
    expect(firstLastClip?.folder).toBe('folderA')
    expect(firstLastClip?.clip_id).toBe('clipA')

    // 2. Simulate loading hooks for a cached library video (which sets jobStatus to queued and clears clipId)
    state.clipId.value = null
    state.jobStatus.value = 'queued'
    await nextTick()
    
    // Simulate API poll response returning folderB and ready status (for the cached library hooks)
    state.folderName.value = 'folderB'
    state.jobStatus.value = 'ready'
    await nextTick()

    // Assert that lastAccessedClip was NOT overwritten and still points to the first clip (folderA, clipA)
    const secondLastClip = state.lastAccessedClip.value as LastClip | null
    expect(secondLastClip?.folder).toBe('folderA')
    expect(secondLastClip?.clip_id).toBe('clipA')
  })

  it('handles pagination, searching, sorting, and item accumulation in fetchCached', async () => {
    const state = useClipperState()
    state.resetWorkspace()
    await nextTick()

    // Mock fetch resolution for page 1
    const firstPageMock = {
      videos: [
        { video_id: 'vid1', title: 'Video 1', duration: 10, folder_name: 'Vid_1' },
        { video_id: 'vid2', title: 'Video 2', duration: 20, folder_name: 'Vid_2' }
      ],
      total: 4,
      has_more: true
    }
    const mockFetch = vi.fn().mockResolvedValue(firstPageMock)
    vi.stubGlobal('$fetch', mockFetch)

    // Set search and sort state
    state.cachedVideosSearch.value = 'test'
    state.cachedVideosSortBy.value = 'title'
    state.cachedVideosSortOrder.value = 'asc'
    state.cachedVideosLimit.value = 2

    // 1. Initial page 1 fetch
    await state.fetchCached(true)

    expect(state.cachedVideosPage.value).toBe(1)
    expect(state.cachedVideos.value).toHaveLength(2)
    expect(state.cachedVideos.value[0]!.video_id).toBe('vid1')
    expect(state.cachedVideosTotal.value).toBe(4)
    expect(state.cachedVideosHasMore.value).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/cached',
      {
        params: {
          page: 1,
          limit: 2,
          sort_by: 'title',
          order: 'asc',
          search: 'test'
        }
      }
    )

    // Mock fetch resolution for page 2
    const secondPageMock = {
      videos: [
        { video_id: 'vid3', title: 'Video 3', duration: 30, folder_name: 'Vid_3' },
        { video_id: 'vid4', title: 'Video 4', duration: 40, folder_name: 'Vid_4' }
      ],
      total: 4,
      has_more: false
    }
    mockFetch.mockResolvedValueOnce(secondPageMock)

    // 2. Fetch page 2 (incremental load)
    state.cachedVideosPage.value = 2
    await state.fetchCached(false)

    expect(state.cachedVideosPage.value).toBe(2)
    expect(state.cachedVideos.value).toHaveLength(4) // Accumulated
    expect(state.cachedVideos.value[2]!.video_id).toBe('vid3')
    expect(state.cachedVideosHasMore.value).toBe(false)
  })

  it('discards stale/out-of-order fetchCached responses to prevent race conditions (flickering)', async () => {
    const state = useClipperState()
    state.resetWorkspace()
    await nextTick()

    let resolveA: any
    let resolveB: any
    const promiseA = new Promise((resolve) => { resolveA = resolve })
    const promiseB = new Promise((resolve) => { resolveB = resolve })

    let callCount = 0
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) return promiseA
      return promiseB
    })
    vi.stubGlobal('$fetch', mockFetch)

    // Trigger request A (first/stale query)
    const runA = state.fetchCached(true)

    // Trigger request B (second/latest query)
    const runB = state.fetchCached(true)

    // Resolve the latest request B first
    resolveB({
      videos: [{ video_id: 'vidB', title: 'Latest Video', duration: 10, folder_name: 'Vid_B' }],
      total: 1,
      has_more: false
    })
    await runB

    expect(state.cachedVideos.value).toHaveLength(1)
    expect(state.cachedVideos.value[0]!.video_id).toBe('vidB')

    // Now resolve the older/stale request A
    resolveA({
      videos: [{ video_id: 'vidA', title: 'Stale Video', duration: 10, folder_name: 'Vid_A' }],
      total: 1,
      has_more: false
    })
    await runA

    // The state must NOT change to vidA, it should remain vidB!
    expect(state.cachedVideos.value[0]!.video_id).toBe('vidB')
  })

  it('retains lastAccessedVideo via fallback cache when cachedVideos is sorted or paginated out', async () => {
    const state = useClipperState()
    state.resetWorkspace()
    await nextTick()

    state.initPersistence()

    // 1. Populate cachedVideos with target video
    const video = { video_id: 'target_vid', title: 'Target Video', duration: 100, folder_name: 'target_folder' }
    state.cachedVideos.value = [video]
    
    // Set as last accessed
    state.setLastAccessed('target_vid')
    state.setLastClip('target_folder', 'clip123', 'My Clip')
    await nextTick()

    // Video resolved from cachedVideos
    expect(state.lastAccessedVideo.value).toEqual(video)

    // 2. Clear/sort cachedVideos so it no longer contains target_vid
    state.cachedVideos.value = [
      { video_id: 'other_vid', title: 'Other Video', duration: 50, folder_name: 'other_folder' }
    ]
    await nextTick()

    // Video must still be resolved via fallback cache
    expect(state.lastAccessedVideo.value).toEqual(video)
  })

  it('does not cause recursive update loops when lastAccessedVideo is used in a reactive effect', async () => {
    const state = useClipperState()
    state.resetWorkspace()
    await nextTick()

    const video = { video_id: 'target_vid', title: 'Target Video', duration: 100, folder_name: 'target_folder' }
    state.cachedVideos.value = [video]

    const warnSpy = vi.spyOn(console, 'warn')
    const errorSpy = vi.spyOn(console, 'error')

    let evaluations = 0
    const stop = watchEffect(() => {
      evaluations++
      const current = state.lastAccessedVideo.value
      const stored = state.lastAccessedVideoStored.value
    })

    // Simulate loading a ready clip
    state.setLastClip('target_folder', 'clip123', 'My Clip')
    await nextTick()

    stop()

    const consoleLogs = [...warnSpy.mock.calls, ...errorSpy.mock.calls].map(call => call.join(' ')).join('\n')
    expect(consoleLogs).not.toContain('Maximum recursive updates exceeded')
    expect(evaluations).toBeLessThan(10)
  })

  it('sets isCachedLoading to true on sort/reset fetch even if cachedVideos has items', async () => {
    const state = useClipperState()
    state.resetWorkspace()
    await nextTick()

    // Setup initial videos
    state.cachedVideos.value = [
      { video_id: 'vid1', title: 'Video 1', duration: 10, folder_name: 'Vid_1' }
    ]
    expect(state.isCachedLoading.value).toBe(false)

    // Stub mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      videos: [],
      total: 0,
      has_more: false
    })
    vi.stubGlobal('$fetch', mockFetch)

    // Trigger fetchCached with reset=true
    const runFetch = state.fetchCached(true)
    
    expect(state.isCachedLoading.value).toBe(true)

    await runFetch
    expect(state.isCachedLoading.value).toBe(false)
  })

  it('handles isCachedMoreLoading and cachedVideosFetchError for subsequent page fetches', async () => {
    const state = useClipperState()
    state.resetWorkspace()
    await nextTick()

    // 1. Initial page 1 fetch success
    const mockFetch = vi.fn().mockResolvedValue({
      videos: [{ video_id: 'vid1', title: 'Video 1', duration: 10, folder_name: 'Vid_1' }],
      total: 2,
      has_more: true
    })
    vi.stubGlobal('$fetch', mockFetch)

    await state.fetchCached(true)
    expect(state.isCachedLoading.value).toBe(false)
    expect(state.isCachedMoreLoading.value).toBe(false)
    expect(state.cachedVideosFetchError.value).toBe(false)

    // 2. Fetch page 2 fails
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    state.cachedVideosPage.value = 2

    const runFetch = state.fetchCached(false)
    expect(state.isCachedLoading.value).toBe(false)
    expect(state.isCachedMoreLoading.value).toBe(true)
    expect(state.cachedVideosFetchError.value).toBe(false)

    await runFetch
    expect(state.isCachedMoreLoading.value).toBe(false)
    expect(state.cachedVideosFetchError.value).toBe(true)

    // 3. Retry succeeds
    mockFetch.mockResolvedValueOnce({
      videos: [{ video_id: 'vid2', title: 'Video 2', duration: 20, folder_name: 'Vid_2' }],
      total: 2,
      has_more: false
    })

    const runRetry = state.fetchCached(false)
    expect(state.cachedVideosFetchError.value).toBe(false) // cleared immediately when starting retry
    expect(state.isCachedMoreLoading.value).toBe(true)

    await runRetry
    expect(state.isCachedMoreLoading.value).toBe(false)
    expect(state.cachedVideosFetchError.value).toBe(false)
    expect(state.cachedVideos.value).toHaveLength(2)
  })

  it('manages videoLayout state and persists videoLayout in saveStyleSettings', async () => {
    const state = useClipperState()
    expect(state.videoLayout.value).toBe('vertical')

    state.videoLayout.value = 'landscape'
    expect(state.videoLayout.value).toBe('landscape')

    const mockFetch = vi.fn().mockResolvedValue({})
    vi.stubGlobal('$fetch', mockFetch)

    state.folderName.value = 'folderX'
    state.clipId.value = 'clipX'

    await state.saveStyleSettings()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/style-settings'),
      expect.objectContaining({
        method: 'PUT',
        body: expect.objectContaining({
          settings: expect.objectContaining({
            videoLayout: 'landscape'
          })
        })
      })
    )
  })

  it('initializes cropMode to face_tracking by default and exposes cropMap', () => {
    const state = useClipperState()
    expect(state.cropMode.value).toBe('face_tracking')
    expect(state.cropMap.value).toEqual([])
  })
})



