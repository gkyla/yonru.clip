/** @jsxImportSource react */
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { YonruClip } from '@yonru/remotion';
import type {
  DirectPlayerBridge,
  PreviewPlayer
} from '../../utils/playerBridge';

export interface RemotionPlayerViewProps {
  bridge: DirectPlayerBridge;
  compositionWidth?: number;
  compositionHeight?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const RemotionPlayerView: React.FC<RemotionPlayerViewProps> = ({
  bridge,
  compositionWidth = 1080,
  compositionHeight = 1920,
  style,
  className
}) => {
  const playerRef = useRef<PlayerRef>(null);
  const playerProps = useSyncExternalStore(
    bridge.subscribeProps,
    bridge.getPropsSnapshot,
    bridge.getPropsSnapshot
  );

  // Bind the mounted player to the bridge (events + IFRAME_READY).
  useEffect(() => {
    const player = playerRef.current;
    return player ? bridge.attachPlayer(player as PreviewPlayer) : undefined;
  }, [bridge]);

  const durationInFrames = Math.max(
    1,
    Number(playerProps?.durationInFrames) || 300
  );
  const fps = Math.max(1, Number(playerProps?.fps) || 30);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
    >
      <Player
        ref={playerRef}
        component={
          YonruClip as unknown as React.ComponentType<Record<string, unknown>>
        }
        inputProps={playerProps as Record<string, unknown>}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={compositionWidth}
        compositionHeight={compositionHeight}
        style={{
          width: '100%',
          height: '100%'
        }}
        controls={false}
        autoPlay={false}
        loop={false}
        spaceKeyToPlayOrPause={false}
        doubleClickToFullscreen={false}
        clickToPlay={false}
        errorFallback={({ error }) => {
          console.error(
            '[RemotionPlayer] Error during composition render:',
            error
          );
          return (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#090a0f',
                color: '#ff6b6b',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                Preview Playback Error
              </div>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.8,
                  maxWidth: 400,
                  wordBreak: 'break-word'
                }}
              >
                {error?.message || String(error)}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
};
