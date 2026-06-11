// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from '#app'
import { useTimelineState } from '../../app/composables/useTimelineState'
import { useClipperState } from '../../app/composables/useClipperState'

// Mock $fetch so the async save-before-clear watcher resolves quickly in tests
vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ status: 'ok' }))

describe('useTimelineState History Tracking - Undo/Redo', () => {
  beforeEach(() => {
    // Reset global Nuxt states
    const thumbnailEnabled = useState<boolean>('thumbnailEnabled', () => false)
    const thumbnailDuration = useState<number>('thumbnailDuration', () => 0)
    const videoDuration = useState<number>('videoDuration', () => 60)
    const currentTime = useState<number>('currentTime', () => 0)
    const folderName = useState<string | null>('folderName', () => 'test_folder')
    const clipId = useState<string | null>('clipId', () => 'test_clip')
    
    thumbnailEnabled.value = false
    thumbnailDuration.value = 0
    videoDuration.value = 60
    currentTime.value = 0
    folderName.value = 'test_folder'
    clipId.value = 'test_clip'

    const undoStack = useState<any[]>('timelineUndoStack', () => [])
    const redoStack = useState<any[]>('timelineRedoStack', () => [])
    undoStack.value = []
    redoStack.value = []

    const tracks = useState<any[]>('timelineTracks', () => [
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
      { id: 'text', name: 'Text layers', type: 'text', items: [] }
    ])
    tracks.value = [
      { id: 'video', name: 'Main Video', type: 'video', items: [] },
      { id: 'audio', name: 'Audio layers', type: 'audio', items: [] },
      { id: 'text', name: 'Text layers', type: 'text', items: [] }
    ]

    const transcript = useState<any[]>('fullTranscript', () => [])
    transcript.value = [
      { id: '1', start: 0, duration: 2, text: 'Hello' },
      { id: '2', start: 2, duration: 3, text: 'World' }
    ]
  })

  it('initially has empty stacks', () => {
    const { canUndo, canRedo } = useTimelineState()
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(false)
  })

  it('pushes to undo stack when modify operations are triggered', () => {
    const { addTimelineItem, commitToHistory, canUndo, canRedo } = useTimelineState()

    commitToHistory()
    addTimelineItem('text', { content: 'Test Text', start: 5, duration: 3 })

    expect(canUndo.value).toBe(true)
    expect(canRedo.value).toBe(false)
  })

  it('does not push to stack if no changes are made', () => {
    const { commitToHistory } = useTimelineState()
    const undoStack = useState<any[]>('timelineUndoStack')

    commitToHistory()
    expect(undoStack.value.length).toBe(1)

    // Commit again without mutating anything
    commitToHistory()
    expect(undoStack.value.length).toBe(1) // Should still be 1 (ignored duplicate)
  })

  it('undo restores the state, redo reapplies it', () => {
    const { addTimelineItem, commitToHistory, undo, redo, timelineTracks, canUndo, canRedo } = useTimelineState()

    // 1. Initial items are empty
    expect(timelineTracks.value.find(t => t.id === 'text')?.items.length).toBe(0)

    // 2. Add item (explicitly committing beforehand)
    commitToHistory()
    addTimelineItem('text', { content: 'Undoable Item', start: 1, duration: 4 })
    expect(timelineTracks.value.find(t => t.id === 'text')?.items.length).toBe(1)
    expect(canUndo.value).toBe(true)

    // 3. Undo
    undo()
    expect(timelineTracks.value.find(t => t.id === 'text')?.items.length).toBe(0)
    expect(canUndo.value).toBe(false)
    expect(canRedo.value).toBe(true)

    // 4. Redo
    redo()
    expect(timelineTracks.value.find(t => t.id === 'text')?.items.length).toBe(1)
    expect(canUndo.value).toBe(true)
    expect(canRedo.value).toBe(false)
  })

  it('reverts fullTranscript alongside tracks on undo/redo', () => {
    const { deleteTimelineItem, undo, redo } = useTimelineState()
    const transcript = useState<any[]>('fullTranscript')
    const { timelineTracks } = useTimelineState()

    // Add an item first
    const { addTimelineItem } = useTimelineState()
    addTimelineItem('text', { id: 'text-1', content: 'Subtitle text', start: 1, duration: 4 })

    // Modify transcript text manually (e.g. user edit)
    const { commitToHistory } = useTimelineState()
    commitToHistory()
    transcript.value = [
      { id: '1', start: 0, duration: 2, text: 'Hello Mod' }
    ]

    // Undo should restore original transcript
    undo()
    expect(transcript.value[0].text).toBe('Hello')

    // Redo should apply the modification
    redo()
    expect(transcript.value[0].text).toBe('Hello Mod')
  })

  it('limits history stack size to 50', () => {
    const { commitToHistory } = useTimelineState()
    const undoStack = useState<any[]>('timelineUndoStack')
    const tracks = useState<any[]>('timelineTracks')

    for (let i = 0; i < 60; i++) {
      // Mutate something so it gets pushed
      tracks.value[0].items = [{ id: `item-${i}` }]
      commitToHistory()
    }

    expect(undoStack.value.length).toBe(50)
  })

  it('handles circular references in fullTranscript gracefully', () => {
    const { commitToHistory } = useTimelineState()
    const transcript = useState<any[]>('fullTranscript')

    // Create a circular structure similar to the real app
    const seg: any = { id: 'circular-1', start: 0, duration: 2, text: 'Circular' }
    const wordObj: any = { text: 'Circular', start: 0, end: 2, originalSegment: seg }
    seg.flatWords = [wordObj]

    transcript.value = [seg]

    // This should NOT throw an error
    expect(() => commitToHistory()).not.toThrow()
  })

  it('correctly undoes a split in a single undo step', () => {
    const { addTimelineItem, commitToHistory, undo, timelineTracks } = useTimelineState()

    // 1. Add item A (from start 0, duration 20)
    commitToHistory()
    addTimelineItem('video', { id: 'segment-1', start: 0, duration: 20 })

    // Clear history to start fresh
    const undoStack = useState<any[]>('timelineUndoStack')
    undoStack.value = []

    // 2. Perform a Split at time 10:
    commitToHistory() // Start of splitSelected
    const originalItem = timelineTracks.value[0]!.items[0]!
    originalItem.duration = 10
    addTimelineItem('video', { id: 'segment-2', start: 10, duration: 10 })

    expect(timelineTracks.value[0]!.items.length).toBe(2)

    // 3. User undoes the split
    undo()

    // It should immediately restore the original segment-1 (duration 20)
    expect(timelineTracks.value[0]!.items.length).toBe(1)
    expect(timelineTracks.value[0]!.items[0]!.id).toBe('segment-1')
    expect(timelineTracks.value[0]!.items[0]!.duration).toBe(20)
  })

  it('clears undo/redo stacks when folderName or clipId changes (hook isolation)', async () => {
    const { nextTick } = await import('vue')
    const { commitToHistory, timelineTracks } = useTimelineState()
    const folderName = useState<string | null>('folderName')
    const clipId = useState<string | null>('clipId')
    const undoStack = useState<any[]>('timelineUndoStack')
    const redoStack = useState<any[]>('timelineRedoStack')

    // Populate history
    commitToHistory()
    timelineTracks.value[0]!.items = [{ id: 'some-item', start: 0, duration: 1 }]
    commitToHistory()

    expect(undoStack.value.length).toBeGreaterThan(0)

    // Simulate switching hook/clip
    clipId.value = 'another_clip'
    await nextTick()

    // The watcher is async (save-before-clear), so wait for it to resolve
    await new Promise(resolve => setTimeout(resolve, 50))

    // Stacks should be cleared
    expect(undoStack.value.length).toBe(0)
    expect(redoStack.value.length).toBe(0)
  })

  it('correctly sets hasUnsavedHistory on stack modification but respects isHydratingHistory guard', async () => {
    const { initPersistence } = useClipperState()
    const { loadHistoryFromResponse, hasUnsavedHistory } = useTimelineState()
    const undoStack = useState<any[]>('timelineUndoStack')

    // Initialize persistence watchers
    initPersistence()

    // 1. Initial state
    hasUnsavedHistory.value = false

    // 2. Hydrate history from API response
    loadHistoryFromResponse({
      undo_stack: [{ tracks: [], transcript: [], selectedId: null }],
      redo_stack: []
    })

    // Hydrating history should keep hasUnsavedHistory false
    const { nextTick } = await import('vue')
    await nextTick()
    expect(hasUnsavedHistory.value).toBe(false)

    // 3. User commits to history / mutates stack
    undoStack.value.push({ tracks: [], transcript: [], selectedId: 'changed' })
    await nextTick()

    // Changing the stack length should set hasUnsavedHistory to true
    expect(hasUnsavedHistory.value).toBe(true)
  })

  it('worst-case: handles 55 sequential edits, respects 50 stack limit, and drops oldest states', () => {
    const { commitToHistory, undo, redo } = useTimelineState()
    const undoStack = useState<any[]>('timelineUndoStack')
    const redoStack = useState<any[]>('timelineRedoStack')
    const transcript = useState<any[]>('fullTranscript')

    // 1. Perform 55 sequential edits
    for (let i = 1; i <= 55; i++) {
      commitToHistory()
      transcript.value = [
        { id: '1', start: 0, duration: 2, text: `Edit ${i}` }
      ]
    }
    // Commit the final state
    commitToHistory()

    // Since stack capacity is 50, the undoStack length should be capped at 50
    expect(undoStack.value.length).toBe(50)

    // 2. Undo repeatedly to check boundaries
    let undoCount = 0
    while (undoStack.value.length > 0) {
      undo()
      undoCount++
    }

    // We should be able to undo exactly 50 times
    expect(undoCount).toBe(50)

    // The text should have reverted to "Edit 6" (since the first 5 edits were discarded)
    expect(transcript.value[0].text).toBe('Edit 6')

    // 3. Redo repeatedly to check boundaries
    let redoCount = 0
    while (redoStack.value.length > 0) {
      redo()
      redoCount++
    }

    expect(redoCount).toBe(50)
    expect(transcript.value[0].text).toBe('Edit 55')
  })

  it('worst-case: fork history clears the redo stack on new commit after undo', () => {
    const { commitToHistory, undo } = useTimelineState()
    const redoStack = useState<any[]>('timelineRedoStack')
    const transcript = useState<any[]>('fullTranscript')

    // Commit 1
    commitToHistory()
    transcript.value = [{ id: '1', start: 0, duration: 2, text: 'Initial' }]
    
    // Commit 2
    commitToHistory()
    transcript.value = [{ id: '1', start: 0, duration: 2, text: 'Modified A' }]
    
    // Commit 3
    commitToHistory()
    transcript.value = [{ id: '1', start: 0, duration: 2, text: 'Modified B' }]

    commitToHistory()

    // Undo twice
    undo()
    undo()
    expect(redoStack.value.length).toBe(2)

    // Make a new modification (fork history)
    commitToHistory()
    transcript.value = [{ id: '1', start: 0, duration: 2, text: 'Forked Edit' }]
    commitToHistory()

    // Redo stack must be cleared
    expect(redoStack.value.length).toBe(0)
  })

  it('worst-case: verifies structural sharing reference equality for unchanged items', () => {
    const { commitToHistory } = useTimelineState()
    const transcript = useState<any[]>('fullTranscript')
    const undoStack = useState<any[]>('timelineUndoStack')

    // Initialize large transcript
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `seg-${i}`,
      start: i,
      duration: 1,
      text: `Original ${i}`
    }))
    transcript.value = items

    // Commit initial state
    commitToHistory()

    // Mutate only the 5th item
    const modifiedItems = [...transcript.value]
    modifiedItems[5] = { ...modifiedItems[5], text: 'Changed 5' }
    transcript.value = modifiedItems

    // Commit again
    commitToHistory()

    const snapshot1 = undoStack.value[0]
    const snapshot2 = undoStack.value[1]

    // Verify structural sharing:
    // Unchanged elements should share identical references
    expect(snapshot2.transcript[0]).toBe(snapshot1.transcript[0])
    expect(snapshot2.transcript[1]).toBe(snapshot1.transcript[1])
    expect(snapshot2.transcript[4]).toBe(snapshot1.transcript[4])

    // The changed element must have a different reference
    expect(snapshot2.transcript[5]).not.toBe(snapshot1.transcript[5])
    expect(snapshot2.transcript[5].text).toBe('Changed 5')
    expect(snapshot1.transcript[5].text).toBe('Original 5')
  })
})

