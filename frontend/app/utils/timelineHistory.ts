/**
 * TimelineHistoryManager — Encapsulates structural sharing logic for the undo/redo stack
 * in the Transcription Editor. Avoids expensive JSON deep-clones by reusing unchanged
 * track items and transcript segments across snapshots.
 */

export interface TimelineSnapshot {
  tracks: any[]
  transcript: any[]
  selectedId: string | null
}

function areObjectsShallowEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  
  // We only compare primitive properties (skip arrays, nested objects, and circular refs)
  let lenA = 0
  let lenB = 0
  
  for (const k of keysA) {
    if (k === 'flatWords' || k === 'originalSegment' || Array.isArray(a[k]) || (a[k] !== null && typeof a[k] === 'object')) continue
    lenA++
  }
  for (const k of keysB) {
    if (k === 'flatWords' || k === 'originalSegment' || Array.isArray(b[k]) || (b[k] !== null && typeof b[k] === 'object')) continue
    lenB++
  }
  
  if (lenA !== lenB) return false
  
  for (const k of keysA) {
    if (k === 'flatWords' || k === 'originalSegment' || Array.isArray(a[k]) || (a[k] !== null && typeof a[k] === 'object')) continue
    if (a[k] !== b[k]) return false
  }
  
  return true
}

function areWordsEqual(wordsA: any[] | undefined, wordsB: any[] | undefined): boolean {
  if (!wordsA && !wordsB) return true
  if (!wordsA || !wordsB) return false
  if (wordsA.length !== wordsB.length) return false
  
  for (let i = 0; i < wordsA.length; i++) {
    const wA = wordsA[i]
    const wB = wordsB[i]
    if (!wA || !wB) return false
    if (wA.text !== wB.text || wA.start !== wB.start || wA.duration !== wB.duration) {
      return false
    }
  }
  return true
}

export class TimelineHistoryManager {
  private maxStackSize: number
  
  constructor(maxStackSize = 50) {
    this.maxStackSize = maxStackSize
  }
  
  private cloneTimelineItem(item: any): any {
    const cloned = { ...item }
    // Clean up circular properties that components might attach dynamically
    delete cloned.flatWords
    delete cloned.originalSegment
    return cloned
  }
  
  private cloneTranscriptSegment(seg: any): any {
    const cloned = { ...seg }
    delete cloned.flatWords
    delete cloned.originalSegment
    if (seg.words) {
      cloned.words = seg.words.map((w: any) => ({
        text: w.text,
        start: w.start,
        duration: w.duration,
        end: w.end
      }))
    }
    return cloned
  }
  
  /**
   * Commits the current state to the undo stack, using structural sharing.
   * Compares current states to the last snapshot on the stack to reuse references where possible.
   */
  public commit(
    undoStack: TimelineSnapshot[],
    redoStack: any[],
    currentTracks: any[],
    currentTranscript: any[],
    selectedId: string | null
  ): boolean {
    const lastSnapshot = undoStack[undoStack.length - 1]
    
    // 1. Build tracks with structural sharing
    const newTracks = currentTracks.map((track: any) => {
      const lastTrack = lastSnapshot?.tracks.find((t: any) => t.id === track.id)
      
      const newItems = track.items.map((item: any) => {
        const lastItem = lastTrack?.items.find((i: any) => i.id === item.id)
        if (lastItem && areObjectsShallowEqual(item, lastItem)) {
          return lastItem // Reuse reference
        }
        return this.cloneTimelineItem(item) // Clone updated or new item
      })
      
      // If items array is unchanged, reuse the track reference
      const isItemsArrayIdentical = lastTrack && 
        newItems.length === lastTrack.items.length &&
        newItems.every((item: any, idx: number) => item === lastTrack.items[idx])
        
      if (isItemsArrayIdentical) {
        return lastTrack
      }
      
      return {
        id: track.id,
        name: track.name,
        type: track.type,
        items: newItems
      }
    })
    
    // 2. Build transcript with structural sharing (compared by index or ID)
    let newTranscript = currentTranscript
    if (currentTranscript) {
      newTranscript = currentTranscript.map((seg: any, idx: number) => {
        const lastSeg = lastSnapshot?.transcript[idx]
        const isMatch = lastSeg && 
          seg.start === lastSeg.start &&
          seg.duration === lastSeg.duration &&
          seg.text === lastSeg.text &&
          areWordsEqual(seg.words, lastSeg.words)
          
        if (isMatch) {
          return lastSeg // Reuse reference
        }
        return this.cloneTranscriptSegment(seg) // Clone updated segment
      })
    }
    
    // 3. Check if there is a real change compared to the last snapshot
    if (lastSnapshot) {
      const isTracksUnchanged = newTracks.every((track, idx) => track === lastSnapshot.tracks[idx])
      const isTranscriptUnchanged = !newTranscript || (
        lastSnapshot.transcript &&
        newTranscript.length === lastSnapshot.transcript.length &&
        newTranscript.every((seg, idx) => seg === lastSnapshot.transcript[idx])
      )
      
      if (isTracksUnchanged && isTranscriptUnchanged) {
        return false // No change, skip commit
      }
    }
    
    // 4. Push new snapshot
    const snapshot: TimelineSnapshot = {
      tracks: newTracks,
      transcript: newTranscript || [],
      selectedId
    }
    
    undoStack.push(snapshot)
    if (undoStack.length > this.maxStackSize) {
      undoStack.shift()
    }
    
    // Clear redo stack on new commit
    redoStack.length = 0
    return true
  }

  /**
   * Pops the previous state from the undo stack and pushes the current state to the redo stack.
   * Returns the popped snapshot or null.
   */
  public undo(
    undoStack: TimelineSnapshot[],
    redoStack: TimelineSnapshot[],
    currentTracks: any[],
    currentTranscript: any[],
    selectedId: string | null
  ): TimelineSnapshot | null {
    if (undoStack.length === 0) return null

    // Clone current state to push onto redo stack
    const currentTracksCloned = currentTracks.map((track: any) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      items: track.items.map((item: any) => this.cloneTimelineItem(item))
    }))

    const currentTranscriptCloned = currentTranscript ? currentTranscript.map((seg: any) => this.cloneTranscriptSegment(seg)) : []

    const currentState: TimelineSnapshot = {
      tracks: currentTracksCloned,
      transcript: currentTranscriptCloned,
      selectedId
    }

    redoStack.push(currentState)
    return undoStack.pop() || null
  }

  /**
   * Pops the next state from the redo stack and pushes the current state to the undo stack.
   * Returns the popped snapshot or null.
   */
  public redo(
    undoStack: TimelineSnapshot[],
    redoStack: TimelineSnapshot[],
    currentTracks: any[],
    currentTranscript: any[],
    selectedId: string | null
  ): TimelineSnapshot | null {
    if (redoStack.length === 0) return null

    // Clone current state to push onto undo stack
    const currentTracksCloned = currentTracks.map((track: any) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      items: track.items.map((item: any) => this.cloneTimelineItem(item))
    }))

    const currentTranscriptCloned = currentTranscript ? currentTranscript.map((seg: any) => this.cloneTranscriptSegment(seg)) : []

    const currentState: TimelineSnapshot = {
      tracks: currentTracksCloned,
      transcript: currentTranscriptCloned,
      selectedId
    }

    undoStack.push(currentState)
    return redoStack.pop() || null
  }
}
