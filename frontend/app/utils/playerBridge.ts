export abstract class PlayerBridge {
  abstract updateProps(props: any): void
  abstract seek(frame: number): void
  abstract play(): void
  abstract pause(): void
  abstract onMessage(listener: (data: any) => void): () => void
  abstract destroy(): void
}

export class MockPlayerBridge implements PlayerBridge {
  public calls: { type: string; payload?: any; frame?: number }[] = []
  private listeners: Set<(data: any) => void> = new Set()

  public updateProps(props: any): void {
    this.calls.push({ type: 'updateProps', payload: props })
  }

  public seek(frame: number): void {
    this.calls.push({ type: 'seek', frame })
  }

  public play(): void {
    this.calls.push({ type: 'play' })
  }

  public pause(): void {
    this.calls.push({ type: 'pause' })
  }

  public onMessage(listener: (data: any) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public emitMessage(data: any): void {
    this.listeners.forEach((listener) => listener(data))
  }

  public destroy(): void {
    this.listeners.clear()
  }
}

export type PlayerRefTarget =
  | { current: any }
  | { value: any }
  | any

export class DirectPlayerBridge implements PlayerBridge {
  private playerRef: PlayerRefTarget | null = null
  private listeners: Set<(data: any) => void> = new Set()
  private propsListeners: Set<(props: any) => void> = new Set()
  public currentProps: any = null

  constructor(playerRef?: PlayerRefTarget | null) {
    if (playerRef) {
      this.bindPlayer(playerRef)
    }
  }

  /**
   * Bind or re-bind the player reference.
   * Supports React ref ({ current: ... }), Vue ref ({ value: ... }), or direct Player instance.
   */
  public bindPlayer(playerRef: PlayerRefTarget | null): void {
    this.playerRef = playerRef
  }

  /**
   * Resolve the active Player instance from the bound reference.
   */
  public getPlayer(): any {
    if (!this.playerRef) return null
    if (typeof this.playerRef === 'object') {
      if ('current' in this.playerRef) return this.playerRef.current
      if ('value' in this.playerRef) return this.playerRef.value
    }
    return this.playerRef
  }

  /**
   * Update Remotion composition inputProps synchronously in-memory.
   * Notifies props listeners and emits an UPDATE_PROPS message for any subscribers.
   */
  public updateProps(props: any): void {
    this.currentProps = props
    this.propsListeners.forEach((listener) => {
      try {
        listener(props)
      } catch (err) {
        console.error('[DirectPlayerBridge] Error in props listener:', err)
      }
    })
    this.emitMessage({
      type: 'UPDATE_PROPS',
      payload: props
    })
  }

  /**
   * Seek player to a specific frame.
   */
  public seek(frame: number): void {
    const player = this.getPlayer()
    if (player && typeof player.seekTo === 'function') {
      player.seekTo(frame)
    }
  }

  /**
   * Play player synchronously.
   */
  public play(): void {
    const player = this.getPlayer()
    if (player && typeof player.play === 'function') {
      player.play()
    }
  }

  /**
   * Pause player synchronously.
   */
  public pause(): void {
    const player = this.getPlayer()
    if (player && typeof player.pause === 'function') {
      player.pause()
    }
  }

  /**
   * Get current frame from player if available.
   */
  public getCurrentFrame(): number | null {
    const player = this.getPlayer()
    if (player && typeof player.getCurrentFrame === 'function') {
      return player.getCurrentFrame()
    }
    return null
  }

  /**
   * Check if player is playing if available.
   */
  public isPlaying(): boolean | null {
    const player = this.getPlayer()
    if (player && typeof player.isPlaying === 'function') {
      return player.isPlaying()
    }
    return null
  }

  /**
   * Subscribe to messages/events emitted by the player bridge.
   */
  public onMessage(listener: (data: any) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Subscribe directly to props updates.
   */
  public onPropsChange(listener: (props: any) => void): () => void {
    this.propsListeners.add(listener)
    return () => {
      this.propsListeners.delete(listener)
    }
  }

  /**
   * Emit an event message to all registered listeners.
   */
  public emitMessage(data: any): void {
    if (!data) return
    this.listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (err) {
        console.error('[DirectPlayerBridge] Error in message listener:', err)
      }
    })
  }

  /**
   * Convenience emitter for time updates from Remotion frameupdate events.
   */
  public emitTimeUpdate(currentTime: number, frame: number): void {
    this.emitMessage({
      type: 'REMOTION_TIMEUPDATE',
      currentTime,
      frame
    })
  }

  /**
   * Convenience emitter for pause events.
   */
  public emitPaused(): void {
    this.emitMessage({
      type: 'REMOTION_PAUSED'
    })
  }

  /**
   * Convenience emitter for ended events.
   */
  public emitEnded(): void {
    this.emitMessage({
      type: 'REMOTION_ENDED'
    })
  }

  /**
   * Convenience emitter for ready events.
   */
  public emitReady(): void {
    this.emitMessage({
      type: 'IFRAME_READY'
    })
  }

  /**
   * Cleanup listeners and release bound player reference.
   */
  public destroy(): void {
    this.listeners.clear()
    this.propsListeners.clear()
    this.playerRef = null
    this.currentProps = null
  }
}
