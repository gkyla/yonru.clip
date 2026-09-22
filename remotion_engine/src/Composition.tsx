import React, { useMemo } from 'react';
import { AbsoluteFill, Video, OffthreadVideo, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, useRemotionEnvironment } from 'remotion';
import { AnimatedSubtitles } from './AnimatedSubtitles';
import { YonruClipProps, ThumbnailTextOverlay } from './types';
import { getFont } from './fonts';

function transformText(text: string, transform?: string): string {
  if (!text) return '';
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') {
    return text.replace(/\b\w/g, char => char.toUpperCase());
  }
  return text;
}

export const YonruClip: React.FC<YonruClipProps> = ({
  videoPath,
  words,
  wordTimings,
  cropX,
  cropPercentXTop,
  cropPercentXBottom,
  splitZoomTop = 1.0,
  splitZoomBottom = 1.0,
  cropMap = [],
  position,
  videoLayout = 'vertical',
  subtitleOffset = 50,
  autoAdaptiveSubtitles = true,
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
  thumbnailXOffset = 50,
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
    console.log('[Remotion Render] Props:', { videoPath, wordsCount: words?.length, position, videoLayout, thumbnailEnabled, thumbnailFrames });
  }

  // Filter active text items (adjusted for thumbnail offset)
  const activeTextItems = timelineTextItems.filter(item => 
    currentTime >= item.start && currentTime <= (item.start + item.duration)
  );

  // Determine active framing with Continuous Sub-Frame LERP and Instant Snap Cuts
  const activeFraming = useMemo(() => {
    const rawSourceW = sourceWidth || 1920;
    const defaultTop = cropPercentXTop !== undefined ? (cropPercentXTop / 100) * rawSourceW : (cropX || rawSourceW / 2);
    const defaultBottom = cropPercentXBottom !== undefined ? (cropPercentXBottom / 100) * rawSourceW : (cropX || rawSourceW / 2);

    if (!cropMap || cropMap.length === 0) {
      return {
        mode: 'single' as const,
        x: cropX ?? rawSourceW / 2,
        top_x: defaultTop,
        bottom_x: defaultBottom,
      };
    }

    const CUT_THRESHOLD = rawSourceW * 0.15;


    // Scan for adjacent keyframes
    let prevIdx = 0;
    for (let i = 0; i < cropMap.length; i++) {
      if (cropMap[i].time <= currentTime) {
        prevIdx = i;
      } else {
        break;
      }
    }

    const prevEntry = cropMap[prevIdx];
    const nextEntry = prevIdx < cropMap.length - 1 ? cropMap[prevIdx + 1] : null;

    // If only one entry or at/after the last keyframe, use prevEntry
    if (!nextEntry || prevEntry.time === nextEntry.time) {
      const mode = prevEntry.mode || 'single';
      return {
        mode,
        x: prevEntry.x,
        top_x: prevEntry.top_x ?? prevEntry.x,
        bottom_x: prevEntry.bottom_x ?? prevEntry.x,
      };
    }

    // Layout mode change -> Instant Jump Cut
    if ((prevEntry.mode || 'single') !== (nextEntry.mode || 'single')) {
      const mode = prevEntry.mode || 'single';
      return {
        mode,
        x: prevEntry.x,
        top_x: prevEntry.top_x ?? prevEntry.x,
        bottom_x: prevEntry.bottom_x ?? prevEntry.x,
      };
    }

    const mode = prevEntry.mode || 'single';
    const duration = nextEntry.time - prevEntry.time;
    const progress = Math.max(0, Math.min(1, (currentTime - prevEntry.time) / duration));
    // Smoothstep ease-in-out: 3t^2 - 2t^3
    const smoothT = progress * progress * (3 - 2 * progress);

    if (mode === 'split') {
      const prevTop = prevEntry.top_x ?? prevEntry.x;
      const nextTop = nextEntry.top_x ?? nextEntry.x;
      const prevBot = prevEntry.bottom_x ?? prevEntry.x;
      const nextBot = nextEntry.bottom_x ?? nextEntry.x;

      const top_x = Math.abs(nextTop - prevTop) > CUT_THRESHOLD
        ? prevTop
        : prevTop + (nextTop - prevTop) * smoothT;

      const bottom_x = Math.abs(nextBot - prevBot) > CUT_THRESHOLD
        ? prevBot
        : prevBot + (nextBot - prevBot) * smoothT;

      return {
        mode: 'split' as const,
        x: top_x,
        top_x: cropPercentXTop !== undefined ? (cropPercentXTop / 100) * rawSourceW : top_x,
        bottom_x: cropPercentXBottom !== undefined ? (cropPercentXBottom / 100) * rawSourceW : bottom_x,
      };
    } else {
      const delta = Math.abs(nextEntry.x - prevEntry.x);
      const x = delta > CUT_THRESHOLD
        ? prevEntry.x
        : prevEntry.x + (nextEntry.x - prevEntry.x) * smoothT;

      return {
        mode: 'single' as const,
        x,
        top_x: x,
        bottom_x: x,
      };
    }
  }, [cropMap, currentTime, cropX, cropPercentXTop, cropPercentXBottom, sourceWidth]);
  
  if (frame % 30 === 0) {
    console.log(`[Remotion] frame=${frame} time=${currentTime.toFixed(2)} mode=${activeFraming.mode} activeX=${activeFraming.x.toFixed(0)}`);
  }

  // Exact math from VideoPreview.vue to guarantee 1:1 match
  const isLandscape = videoLayout === 'landscape';
  const isSplit = !isLandscape && activeFraming.mode === 'split';
  const videoAspect = (sourceWidth && sourceHeight) ? (sourceWidth / sourceHeight) : (16 / 9);
  const CONTAINER_W = 1080;
  const CONTAINER_H = 1920;
  
  // Single / Landscape Display
  const videoDisplayW = isLandscape ? CONTAINER_W : CONTAINER_H * videoAspect;
  const videoDisplayH = isLandscape ? (CONTAINER_W / videoAspect) : CONTAINER_H;
  const maxOffset = Math.max(0, videoDisplayW - CONTAINER_W);
  
  const scale = videoDisplayW / (sourceWidth || (isLandscape ? 1080 : 1920));
  const targetTranslateX = isLandscape ? 0 : (CONTAINER_W / 2) - (activeFraming.x * scale);
  const translateX = isLandscape ? 0 : Math.max(-maxOffset, Math.min(0, targetTranslateX));
  const translateY = isLandscape ? (CONTAINER_H - videoDisplayH) / 2 : 0;

  // Split Viewport Display (1080x960 each viewport) with Face-Anchored Viewport Framing Zoom
  const PANEL_H = CONTAINER_H / 2;
  const baseSplitDisplayW = PANEL_H * videoAspect;
  const baseSplitScale = baseSplitDisplayW / (sourceWidth || 1920);

  // Top Speaker Viewport Zoom & Transform
  const effectiveZoomTop = Math.max(1.0, Math.min(2.5, splitZoomTop || 1.0));
  const topDisplayW = baseSplitDisplayW * effectiveZoomTop;
  const topDisplayH = PANEL_H * effectiveZoomTop;
  const topScale = baseSplitScale * effectiveZoomTop;
  const topMaxOffset = Math.max(0, topDisplayW - CONTAINER_W);

  const targetTopTranslateX = (CONTAINER_W / 2) - (activeFraming.top_x * topScale);
  const topTranslateX = Math.max(-topMaxOffset, Math.min(0, targetTopTranslateX));
  // Natural headroom bias: 25% top crop, 75% bottom crop
  const topTranslateY = -(topDisplayH - PANEL_H) * 0.25;

  // Bottom Speaker Viewport Zoom & Transform
  const effectiveZoomBottom = Math.max(1.0, Math.min(2.5, splitZoomBottom || 1.0));
  const bottomDisplayW = baseSplitDisplayW * effectiveZoomBottom;
  const bottomDisplayH = PANEL_H * effectiveZoomBottom;
  const bottomScale = baseSplitScale * effectiveZoomBottom;
  const bottomMaxOffset = Math.max(0, bottomDisplayW - CONTAINER_W);

  const targetBottomTranslateX = (CONTAINER_W / 2) - (activeFraming.bottom_x * bottomScale);
  const bottomTranslateX = Math.max(-bottomMaxOffset, Math.min(0, targetBottomTranslateX));
  // Natural headroom bias: 25% top crop, 75% bottom crop
  const bottomTranslateY = -(bottomDisplayH - PANEL_H) * 0.25;


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
                objectFit: 'cover',
                objectPosition: `${thumbnailXOffset}% center`
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
                  textTransform: overlay.textTransform || 'none',
                  paintOrder: overlay.showStroke !== false ? 'stroke fill' : undefined,
                  WebkitTextStroke: overlay.showStroke !== false 
                    ? `${(overlay.strokeWidth || 5) * 2}px ${overlay.strokeColor || '#000000'}` 
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
                {transformText(overlay.text || '', overlay.textTransform)}
              </div>
            ))}
          </AbsoluteFill>
        </Sequence>
      )}

      {/* ===== MAIN VIDEO ===== */}
      <Sequence from={thumbnailFrames} name="MainVideo">
        {(() => {
          const renderMediaViewports = (mediaStartFrame?: number, durationFrames?: number) => (
            <AbsoluteFill style={{ overflow: 'hidden' }}>
              {/* Primary Viewport (Top Speaker in Split, or Full Framing in Single/Landscape) */}
              <div 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: CONTAINER_W, 
                  height: isSplit ? `${PANEL_H}px` : `${CONTAINER_H}px`, 
                  overflow: 'hidden' 
                }}
              >
                <Video 
                  src={videoSrc} 
                  volume={volume}
                  crossOrigin="anonymous"
                  startFrom={mediaStartFrame}
                  endAt={durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined}
                  style={{ 
                    height: isSplit ? `${topDisplayH}px` : `${videoDisplayH}px`, 
                    width: isSplit ? `${topDisplayW}px` : `${videoDisplayW}px`, 
                    maxWidth: 'none',
                    transform: isSplit 
                      ? `translate(${topTranslateX}px, ${topTranslateY}px)` 
                      : `translate(${translateX}px, ${translateY}px)`,
                    objectFit: 'cover'
                  }} 
                />
              </div>

              {/* Secondary Viewport (Bottom Speaker in Split) */}
              {!isLandscape && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: `${PANEL_H}px`, 
                    left: 0, 
                    width: CONTAINER_W, 
                    height: `${PANEL_H}px`, 
                    overflow: 'hidden',
                    opacity: isSplit ? 1 : 0,
                    pointerEvents: 'none',
                    visibility: isSplit ? 'visible' : 'hidden'
                  }}
                >
                  <Video 
                    src={videoSrc} 
                    volume={0}
                    crossOrigin="anonymous"
                    startFrom={mediaStartFrame}
                    endAt={durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined}
                    style={{ 
                      height: `${bottomDisplayH}px`, 
                      width: `${bottomDisplayW}px`, 
                      maxWidth: 'none',
                      transform: `translate(${bottomTranslateX}px, ${bottomTranslateY}px)`,
                      objectFit: 'cover'
                    }} 
                  />
                </div>
              )}

              {/* Center Seam Divider (2px dark line with subtle shadow) */}
              {!isLandscape && (
                <div 
                  style={{ 
                    position: 'absolute', 
                    top: `${PANEL_H - 1}px`, 
                    left: 0, 
                    width: '100%', 
                    height: '2px', 
                    backgroundColor: 'rgba(0, 0, 0, 0.85)', 
                    boxShadow: '0 0 10px 2px rgba(0, 0, 0, 0.75)',
                    zIndex: 15,
                    pointerEvents: 'none',
                    opacity: isSplit ? 1 : 0,
                    visibility: isSplit ? 'visible' : 'hidden'
                  }} 
                />
              )}
            </AbsoluteFill>
          );

          if (videoPath && timelineVideoItems && timelineVideoItems.length > 0) {
            return timelineVideoItems.map(item => {
              const startFrame = Math.round(item.start * fps);
              const durationFrames = Math.round(item.duration * fps);
              const mediaStartFrame = Math.round((item.mediaStart ?? 0) * fps);
              return (
                <Sequence key={item.id} from={startFrame} durationInFrames={durationFrames} name={`VideoSegment-${item.id}`}>
                  {renderMediaViewports(mediaStartFrame, durationFrames)}
                </Sequence>
              );
            });
          }

          return videoPath ? renderMediaViewports() : null;
        })()}

        {/* Subtitles layer */}
        {!hideSubtitles && (() => {
          const useCenterSeam = isSplit && autoAdaptiveSubtitles;
          return (
            <AbsoluteFill style={{
              justifyContent: useCenterSeam ? 'center' : (position === 'top' ? 'flex-start' : position === 'center' ? 'center' : 'flex-end'),
              alignItems: 'center',
              paddingTop: !useCenterSeam && position === 'top' ? `${subtitleOffset}px` : 0,
              paddingBottom: !useCenterSeam && position === 'bottom' ? `${subtitleOffset}px` : 0,
              transform: useCenterSeam ? `translateY(${subtitleOffset}px)` : undefined,
              zIndex: 20
            }}>
              <AnimatedSubtitles
                words={words}
                wordTimings={wordTimings}
                showDebug={showDebug}
                style={subtitleStyle}
              />
            </AbsoluteFill>
          );
        })()}

        {/* Timeline Text layers */}
        {activeTextItems.map((item) => {
          const getBgColor = (it: any) => {
            if (!it.showBackground) return 'transparent';
            const baseColor = it.backgroundColor || '#000000';
            if (baseColor.startsWith('#')) {
              const opacityVal = it.backgroundOpacity !== undefined ? it.backgroundOpacity : 0.7;
              const hexOpacity = Math.round(opacityVal * 255).toString(16).padStart(2, '0');
              return `${baseColor}${hexOpacity}`;
            }
            return baseColor;
          };

          const getTextShadow = (it: any) => {
            if (it.shadowGlow === 'glow') {
              const glow = it.glowColor || '#FFFFFF';
              return `0 0 10px ${glow}, 0 0 20px ${glow}, 0 0 30px ${glow}`;
            }
            if (it.shadowGlow === 'shadow') {
              const dist = it.shadowDistance !== undefined ? it.shadowDistance : 4;
              const blur = it.shadowBlur !== undefined ? it.shadowBlur : 8;
              const color = it.shadowColor || 'rgba(0,0,0,0.6)';
              return `${dist}px ${dist}px ${blur}px ${color}`;
            }
            return 'none';
          };

          const textStroke = item.strokeWidth && item.strokeWidth > 0 
            ? `${item.strokeWidth}px ${item.strokeColor || '#000000'}` 
            : undefined;

          return (
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
                color: item.color || '#FFFFFF',
                fontSize: `${item.fontSize || 80}px`,
                fontFamily: getFont(item.font || 'Outfit'),
                fontWeight: item.fontWeight || 900,
                fontStyle: item.fontStyle || 'normal',
                textDecoration: item.textDecoration || 'none',
                textTransform: item.textTransform || 'none',
                textAlign: item.textAlign || 'center',
                letterSpacing: `${item.letterSpacing !== undefined ? item.letterSpacing : 0}px`,
                wordSpacing: `${item.wordSpacing !== undefined ? item.wordSpacing : 0}px`,
                lineHeight: item.lineHeight !== undefined ? item.lineHeight : 1.1,
                opacity: item.opacity !== undefined ? item.opacity : 1.0,
                // No transform: Konva label config resets offset to {x:0,y:0} on every
                // reactive update, so stored coordinates are top-left based, not center.
                whiteSpace: 'pre-wrap',
                maxWidth: '900px',
                // Background Box
                backgroundColor: getBgColor(item),
                padding: `${item.showBackground ? (item.backgroundPadding !== undefined ? item.backgroundPadding : 15) : 15}px`,
                borderRadius: item.showBackground ? `${item.backgroundRoundness !== undefined ? item.backgroundRoundness : 10}px` : 0,
                display: 'inline-block',
                width: 'fit-content',
                // Text Stroke
                paintOrder: item.showStroke ? 'stroke fill' : undefined,
                WebkitTextStroke: item.showStroke && item.strokeWidth ? `${item.strokeWidth * 2}px ${item.strokeColor || '#000000'}` : textStroke,
                // Text Shadow / Glow
                textShadow: getTextShadow(item),
              }}>
                {item.content || ''}
              </div>
            </AbsoluteFill>
          );
        })}

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
