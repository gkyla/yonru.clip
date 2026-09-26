import React, { useEffect, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { YonruClip } from '@yonru/remotion'
import type { DirectPlayerBridge } from '../../utils/playerBridge'

export interface RemotionPlayerViewProps {
  bridge: DirectPlayerBridge
  compositionWidth?: number
  compositionHeight?: number
  style?: React.CSSProperties
  className?: string
}

export const RemotionPlayerView: React.FC<RemotionPlayerViewProps> = ({
  bridge,
  compositionWidth = 1080,
  compositionHeight = 1920,
  style,
  className
}) => {
  const playerRef = useRef<PlayerRef>(null)
  const [playerProps, setPlayerProps] = useState<Record<string, any>>(() => bridge.currentProps || {})

  // Keep a stable ref to current playerProps so event listeners use latest fps
  const playerPropsRef = useRef(playerProps)
  useEffect(() => {
    playerPropsRef.current = playerProps
  }, [playerProps])

  // Subscribe to prop updates from DirectPlayerBridge
  useEffect(() => {
    const unsubscribe = bridge.onPropsChange((newProps) => {
      if (newProps) {
        setPlayerProps(newProps)
      }
    })
    return () => {
      unsubscribe()
    }
  }, [bridge])

  // Bind player instance and wire up Remotion player events
  useEffect(() => {
    const player = playerRef.current
    if (!player) return

    bridge.bindPlayer(player)

    const onFrameUpdate = (e: { detail: { frame: number } }) => {
      const activeFps = playerPropsRef.current?.fps || 30
      const frame = e.detail?.frame ?? 0
      const currentTime = frame / activeFps
      bridge.emitTimeUpdate(currentTime, frame)
    }

    const onPause = () => {
      bridge.emitPaused()
    }

    const onEnded = () => {
      bridge.emitEnded()
    }

    player.addEventListener('frameupdate', onFrameUpdate)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onEnded)

    // Notify bridge and consumers that player is ready
    bridge.emitReady()

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onEnded)
      bridge.bindPlayer(null)
    }
  }, [bridge])

  const durationInFrames = Math.max(1, Number(playerProps?.durationInFrames) || 300)
  const fps = Math.max(1, Number(playerProps?.fps) || 30)

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
        component={YonruClip as any}
        inputProps={playerProps as any}
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
      />
    </div>
  )
}
