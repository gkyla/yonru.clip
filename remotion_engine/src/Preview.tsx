import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, PlayerRef } from '@remotion/player';
import { YonruClip } from './Composition';
import { YonruClipProps, DEFAULT_SUBTITLE_STYLE } from './types';

const App = () => {
  const playerRef = useRef<PlayerRef>(null);
  
  const [props, setProps] = useState<YonruClipProps>({
    videoPath: '',
    words: [],
    wordTimings: [],
    cropX: 0,
    position: 'center',
    durationInFrames: 300,
    showDebug: false,
    subtitleStyle: { ...DEFAULT_SUBTITLE_STYLE },
    volume: 0.5,
  });

  const activeFps = props.fps || 30;

  // --- Listen for commands from Nuxt parent ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (!data) return;

        if (data.type === 'UPDATE_PROPS') {
          console.log('[Remotion] UPDATE_PROPS received. volume:', data.payload?.volume);
          setProps(prev => ({ ...prev, ...data.payload }));
        } else if (data.type === 'PLAY') {
          console.log('[Remotion] PLAY command');
          playerRef.current?.play();
        } else if (data.type === 'PAUSE') {
          console.log('[Remotion] PAUSE command');
          playerRef.current?.pause();
        } else if (data.type === 'SEEK') {
          console.log('[Remotion] SEEK to frame:', data.frame);
          playerRef.current?.seekTo(data.frame);
        }
      } catch (err) {
        console.error("[Remotion] Failed to parse message", err);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Signal to parent that we are ready to receive props
    window.parent.postMessage({ type: 'IFRAME_READY' }, '*');
    
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // --- Send time updates back to Nuxt parent ---
  const onFrameUpdate = useCallback((e: any) => {
    const currentTime = e.detail.frame / activeFps;
    // Post back to parent so Nuxt timeline stays in sync
    window.parent.postMessage({
      type: 'REMOTION_TIMEUPDATE',
      currentTime,
      frame: e.detail.frame
    }, '*');
  }, [activeFps]);

  // --- Attach/detach the frame listener ---
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.addEventListener('frameupdate', onFrameUpdate);
    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
    };
  }, [onFrameUpdate]);

  // Volume as a number (Remotion Player wants a number or callback)
  const volume = typeof props.volume === 'number' ? props.volume : 0.5;

  return (
    <>
      <Player
        ref={playerRef}
        component={YonruClip}
        durationInFrames={props.durationInFrames || 300}
        compositionWidth={1080}
        compositionHeight={1920}
        fps={activeFps}
        inputProps={props}
        style={{
          width: '100%',
          height: '100%'
        }}
        controls={false}
        autoPlay={false}
        loop={false}
        volume={volume}
      />
      {props.showDebug && (
        <div style={{ position: 'absolute', top: '20%', left: '10%', zIndex: 999, color: 'lime', background: 'rgba(0,0,0,0.8)', fontSize: '20px', maxWidth: '80%', padding: '20px', wordWrap: 'break-word' }}>
          <h2>Iframe Debug:</h2>
          <p>Words received: {props.words?.length || 0}</p>
          <p>First word: {props.words?.[0] ? JSON.stringify(props.words[0]) : 'None'}</p>
          <p>Video Path: {props.videoPath}</p>
          <p>Duration: {props.durationInFrames} frames</p>
          <p>Volume: {volume}</p>
          <p>Font: {props.subtitleStyle?.fontFamily || 'default'}</p>
          <p>Animation: {props.subtitleStyle?.animation || 'default'}</p>
        </div>
      )}
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
