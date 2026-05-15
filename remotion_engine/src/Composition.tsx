import React, { useMemo } from 'react';
import { AbsoluteFill, Video, OffthreadVideo, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, useRemotionEnvironment } from 'remotion';
import { AnimatedSubtitles } from './AnimatedSubtitles';
import { YonruClipProps, ThumbnailTextOverlay } from './types';
import { getFont } from './fonts';

export const YonruClip: React.FC<YonruClipProps> = ({
  videoPath,
  words,
  wordTimings,
  cropX,
  cropMap = [],
  position,
  subtitleOffset = 50,
  showDebug,
  subtitleStyle,
  timelineTextItems = [],
  timelineAudioItems = [],
  timelineVideoItems = [],
  volume = 0.5,
  hideSubtitles = false,
  thumbnailEnabled = false,
  thumbnailDuration = 1,
  thumbnailImagePath,
  thumbnailTextOverlays = [],
  sourceWidth,
  sourceHeight,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();

  const thumbnailFrames = thumbnailEnabled ? Math.round(thumbnailDuration * fps) : 0;
  const currentTime = Math.max(0, (frame - thumbnailFrames)) / fps;

  const isUrl = videoPath && (videoPath.startsWith('http') || videoPath.startsWith('blob:'));
  const videoSrc = videoPath ? (isUrl ? videoPath : staticFile(videoPath)) : '';

  if (isRendering) {
    console.log('[Remotion Render] Props:', { videoPath, wordsCount: words?.length, position, thumbnailEnabled, thumbnailFrames });
  }

  // Filter active text items (adjusted for thumbnail offset)
  const activeTextItems = timelineTextItems.filter(item => 
    currentTime >= item.start && currentTime <= (item.start + item.duration)
  );

  // Determine active cropX
  const activeCropX = useMemo(() => {
    if (!cropMap || cropMap.length === 0) return cropX;
    
    // Find the latest entry that is <= currentTime (the "Hold" logic)
    // Since cropMap is sorted by time, we look for the last one that has passed.
    let lastValid = cropMap[0];
    for (const entry of cropMap) {
      if (entry.time <= currentTime) {
        lastValid = entry;
      } else {
        break; // We found a future point, stop searching
      }
    }
    
    return lastValid.x;
  }, [cropMap, currentTime, cropX]);
  
    if (frame % 30 === 0) {
      console.log(`[Remotion] frame=${frame} time=${currentTime.toFixed(2)} activeCropX=${activeCropX}`);
    }

  // Exact math from VideoPreview.vue to guarantee 1:1 match
  const videoAspect = (sourceWidth && sourceHeight) ? (sourceWidth / sourceHeight) : (16 / 9);
  const CONTAINER_W = 1080;
  const CONTAINER_H = 1920;
  const videoDisplayW = CONTAINER_H * videoAspect;
  const maxOffset = Math.max(0, videoDisplayW - CONTAINER_W);
  
  // Target center calculation: map the activeCropX pixel exactly to the center of the container
  const scale = videoDisplayW / (sourceWidth || 1920);
  const targetTranslateX = (CONTAINER_W / 2) - (activeCropX * scale);
  // Clamp to prevent black bars revealing the container background
  const translateX = Math.max(-maxOffset, Math.min(0, targetTranslateX));

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      {/* ===== THUMBNAIL SLIDE ===== */}
      {thumbnailEnabled && thumbnailImagePath && (
        <Sequence from={0} durationInFrames={thumbnailFrames} name="Thumbnail">
          <AbsoluteFill>
            <Img 
              src={staticFile(thumbnailImagePath)} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover' 
              }} 
            />
            {/* Thumbnail text overlays */}
            {thumbnailTextOverlays.map((overlay: ThumbnailTextOverlay) => (
              <div
                key={overlay.id}
                style={{
                  position: 'absolute',
                  left: `${overlay.x}px`,
                  top: `${overlay.y}px`,
                  transform: overlay.rotation ? `rotate(${overlay.rotation}deg)` : undefined,
                  transformOrigin: 'top left',
                  color: overlay.color || '#FFFFFF',
                  fontSize: `${overlay.fontSize || 80}px`,
                  fontFamily: getFont(overlay.fontFamily || 'Montserrat'),
                  fontWeight: overlay.fontWeight || 900,
                  textTransform: overlay.textTransform === 'uppercase' ? 'uppercase' : 'none',
                  WebkitTextStroke: overlay.showStroke !== false 
                    ? `${overlay.strokeWidth || 5}px ${overlay.strokeColor || '#000000'}` 
                    : undefined,
                  textShadow: '3px 5px 15px rgba(0,0,0,0.6)',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'center',
                  lineHeight: 1.1,
                  // Background Box
                  backgroundColor: overlay.showBackground 
                    ? (overlay.backgroundColor?.startsWith('#') 
                        ? `${overlay.backgroundColor}${Math.round((overlay.backgroundOpacity ?? 0.7) * 255).toString(16).padStart(2, '0')}`
                        : overlay.backgroundColor)
                    : 'transparent',
                  padding: `${overlay.backgroundPadding ?? 20}px`,
                  borderRadius: overlay.showBackground ? '10px' : 0,
                  display: 'inline-block',
                  width: 'fit-content',
                }}
              >
                {overlay.textTransform === 'uppercase' ? (overlay.text || '').toUpperCase() : (overlay.text || '')}
              </div>
            ))}
          </AbsoluteFill>
        </Sequence>
      )}

      {/* ===== MAIN VIDEO ===== */}
      <Sequence from={thumbnailFrames} name="MainVideo">
        {/* Video layer */}
        {videoPath && timelineVideoItems && timelineVideoItems.length > 0 ? (
          timelineVideoItems.map(item => {
            const startFrame = Math.round(item.start * fps);
            const durationFrames = Math.round(item.duration * fps);
            const mediaStartFrame = Math.round((item.mediaStart ?? 0) * fps);
            
            return (
              <Sequence key={item.id} from={startFrame} durationInFrames={durationFrames} name={`VideoSegment-${item.id}`}>
                <AbsoluteFill>
                  <OffthreadVideo 
                    src={videoSrc} 
                    volume={volume}
                    crossOrigin="anonymous"
                    startFrom={mediaStartFrame}
                    endAt={mediaStartFrame + durationFrames}
                    style={{ 
                      height: '100%', 
                      width: `${videoDisplayW}px`, 
                      maxWidth: 'none',
                      transform: `translateX(${translateX}px)`,
                      objectFit: 'cover'
                    }} 
                  />
                </AbsoluteFill>
              </Sequence>
            );
          })
        ) : videoPath && (
          <AbsoluteFill>
            <Video 
              src={videoSrc} 
              volume={volume}
              crossOrigin="anonymous"
              style={{ 
                height: '100%', 
                width: `${videoDisplayW}px`, 
                maxWidth: 'none',
                transform: `translateX(${translateX}px)`,
                objectFit: 'cover'
              }} 
            />
          </AbsoluteFill>
        )}

        {/* Subtitles layer */}
        {!hideSubtitles && (
          <AbsoluteFill style={{
            justifyContent: position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end',
            alignItems: 'center',
            paddingTop: position === 'top' ? `${subtitleOffset}px` : 0,
            paddingBottom: position === 'bottom' ? `${subtitleOffset}px` : 0,
            zIndex: 10
          }}>
            <AnimatedSubtitles
              words={words}
              wordTimings={wordTimings}
              showDebug={showDebug}
              style={subtitleStyle}
            />
          </AbsoluteFill>
        )}

        {/* Timeline Text layers */}
        {activeTextItems.map((item) => (
          <AbsoluteFill 
            key={item.id}
            style={{
              zIndex: 20,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none'
            }}
          >
            <div style={{
              position: 'absolute',
              left: `${item.x}px`,
              top: `${item.y}px`,
              color: item.color || 'white',
              fontSize: `${item.fontSize || 80}px`,
              fontFamily: item.font || 'Outfit',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              textShadow: '0 5px 15px rgba(0,0,0,0.5)',
              whiteSpace: 'pre-wrap',
              maxWidth: '900px'
            }}>
              {item.content || 'NEW TEXT'}
            </div>
          </AbsoluteFill>
        ))}

        {/* Timeline Audio layers */}
        {timelineAudioItems.map((item) => (
          <Sequence 
            key={item.id}
            from={Math.round(item.start * fps)} 
            durationInFrames={Math.round(item.duration * fps)}
            name={`Audio-${item.name}`}
          >
            <Audio src={item.src} volume={item.volume ?? 1} />
          </Sequence>
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};
