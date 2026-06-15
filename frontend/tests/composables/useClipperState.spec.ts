// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useClipperState } from '../../app/composables/useClipperState'
import { useState } from '#imports'

describe('useClipperState Composable', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({}))
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
})

