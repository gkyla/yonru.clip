import type { YonruClipProps } from '@yonru/remotion';

export type PreviewProps = Partial<YonruClipProps>;

/** Events the preview player sends back across the bridge. */
export type PlayerBridgeEvent =
  | { type: 'IFRAME_READY' }
  | { type: 'REMOTION_TIMEUPDATE'; currentTime: number; frame: number }
  | { type: 'REMOTION_PAUSED' }
  | { type: 'REMOTION_ENDED' };

export type PlayerBridgeListener = (event: PlayerBridgeEvent) => void;

export abstract class PlayerBridge {
  abstract updateProps(patch: PreviewProps): void;
  abstract seek(frame: number): void;
  abstract play(): void;
  abstract pause(): void;
  abstract onMessage(listener: PlayerBridgeListener): () => void;
  abstract destroy(): void;
}

export type MockBridgeCall =
  | { type: 'updateProps'; payload: PreviewProps }
  | { type: 'seek'; frame: number }
  | { type: 'play' }
  | { type: 'pause' };

/** Test double: records every call and keeps the merged props. */
export class MockPlayerBridge implements PlayerBridge {
  public calls: MockBridgeCall[] = [];
  public currentProps: PreviewProps = {};
  private listeners: Set<PlayerBridgeListener> = new Set();

  public updateProps(patch: PreviewProps): void {
    this.calls.push({ type: 'updateProps', payload: patch });
    this.currentProps = { ...this.currentProps, ...patch };
  }

  public seek(frame: number): void {
    this.calls.push({ type: 'seek', frame });
  }

  public play(): void {
    this.calls.push({ type: 'play' });
  }

  public pause(): void {
    this.calls.push({ type: 'pause' });
  }

  public onMessage(listener: PlayerBridgeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emitMessage(event: PlayerBridgeEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  public destroy(): void {
    this.listeners.clear();
  }
}

/** The parts of the Remotion PlayerRef the bridge drives. */
export interface PreviewPlayer {
  seekTo(frame: number): void;
  play(): void;
  pause(): void;
  getCurrentFrame?(): number;
  isPlaying?(): boolean;
  addEventListener(
    name: string,
    callback: (event: { detail?: { frame?: number } }) => void
  ): void;
  removeEventListener(
    name: string,
    callback: (event: { detail?: { frame?: number } }) => void
  ): void;
}

export type PlayerRefTarget =
  | { current: PreviewPlayer | null }
  | { value: PreviewPlayer | null }
  | PreviewPlayer;

const EMPTY_PROPS: PreviewProps = Object.freeze({}) as PreviewProps;

export class DirectPlayerBridge implements PlayerBridge {
  private playerRef: PlayerRefTarget | null = null;
  private listeners: Set<PlayerBridgeListener> = new Set();
  private propsListeners: Set<() => void> = new Set();
  public currentProps: PreviewProps | null = null;

  constructor(playerRef?: PlayerRefTarget | null) {
    if (playerRef) {
      this.bindPlayer(playerRef);
    }
  }

  /**
   * Bind or re-bind the player reference.
   * Supports React ref ({ current: ... }), Vue ref ({ value: ... }), or a direct Player.
   */
  public bindPlayer(playerRef: PlayerRefTarget | null): void {
    this.playerRef = playerRef;
  }

  public getPlayer(): PreviewPlayer | null {
    const ref = this.playerRef;
    if (!ref) return null;
    if ('current' in ref) return ref.current;
    if ('value' in ref) return ref.value;
    return ref;
  }

  /**
   * Bind a mounted player, forward its events, then announce IFRAME_READY.
   * Returns a function that unbinds the player and removes the listeners.
   */
  public attachPlayer(player: PreviewPlayer): () => void {
    const onFrameUpdate = (e: { detail?: { frame?: number } }) => {
      const frame = e?.detail?.frame ?? 0;
      const fps = this.currentProps?.fps || 30;
      this.emitTimeUpdate(frame / fps, frame);
    };
    const onPause = () => this.emitPaused();
    const onEnded = () => this.emitEnded();

    this.bindPlayer(player);
    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    this.emitReady();

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
      if (this.getPlayer() === player) this.bindPlayer(null);
    };
  }

  /**
   * Merge a props patch. Keys whose value did not change (Object.is) are
   * skipped; a patch with no changes does not allocate or notify.
   */
  public updateProps(patch: PreviewProps): void {
    const current = this.currentProps ?? EMPTY_PROPS;
    let next: PreviewProps | null = null;
    for (const key of Object.keys(patch) as Array<keyof PreviewProps>) {
      if (current === EMPTY_PROPS || !Object.is(current[key], patch[key])) {
        next ??= { ...current };
        (next as Record<string, unknown>)[key] = patch[key];
      }
    }
    if (!next) return;
    this.currentProps = next;
    this.propsListeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('[DirectPlayerBridge] Error in props listener:', err);
      }
    });
  }

  /** useSyncExternalStore subscribe function. */
  public subscribeProps = (listener: () => void): (() => void) => {
    this.propsListeners.add(listener);
    return () => {
      this.propsListeners.delete(listener);
    };
  };

  /** useSyncExternalStore snapshot function (stable until props change). */
  public getPropsSnapshot = (): PreviewProps => {
    return this.currentProps ?? EMPTY_PROPS;
  };

  public seek(frame: number): void {
    this.getPlayer()?.seekTo(frame);
  }

  public play(): void {
    this.getPlayer()?.play();
  }

  public pause(): void {
    this.getPlayer()?.pause();
  }

  public getCurrentFrame(): number | null {
    return this.getPlayer()?.getCurrentFrame?.() ?? null;
  }

  public isPlaying(): boolean | null {
    return this.getPlayer()?.isPlaying?.() ?? null;
  }

  public onMessage(listener: PlayerBridgeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emitMessage(event: PlayerBridgeEvent): void {
    if (!event) return;
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (err) {
        console.error('[DirectPlayerBridge] Error in message listener:', err);
      }
    });
  }

  public emitTimeUpdate(currentTime: number, frame: number): void {
    this.emitMessage({ type: 'REMOTION_TIMEUPDATE', currentTime, frame });
  }

  public emitPaused(): void {
    this.emitMessage({ type: 'REMOTION_PAUSED' });
  }

  public emitEnded(): void {
    this.emitMessage({ type: 'REMOTION_ENDED' });
  }

  public emitReady(): void {
    this.emitMessage({ type: 'IFRAME_READY' });
  }

  /** Clear listeners and release the bound player. */
  public destroy(): void {
    this.listeners.clear();
    this.propsListeners.clear();
    this.playerRef = null;
    this.currentProps = null;
  }
}
