import React, { useMemo } from 'react';
import { AbsoluteFill, Video, OffthreadVideo, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, useRemotionEnvironment } from 'remotion';
import { AnimatedSubtitles } from './AnimatedSubtitles';
import { CanvasVideoCompositor } from './CanvasVideoCompositor';
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
  splitOffsetXTop = 0,
  splitOffsetYTop = 0,
  splitOffsetXBottom = 0,
  splitOffsetYBottom = 0,
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
    // Use 1ms epsilon for IEEE 754 float precision & 3-decimal JSON rounding without bleeding into preceding frames
    const timeEpsilon = 0.001;
    let prevIdx = 0;
    for (let i = 0; i < cropMap.length; i++) {
      if (cropMap[i].time <= currentTime + timeEpsilon) {
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
  
  // Single / Landscape Display - Constant Video Dimensions
  const videoDisplayW = isLandscape ? CONTAINER_W : CONTAINER_H * videoAspect;
  const videoDisplayH = isLandscape ? (CONTAINER_W / videoAspect) : CONTAINER_H;
  const maxOffset = Math.max(0, videoDisplayW - CONTAINER_W);
  
  const rawSourceW = sourceWidth || (isLandscape ? 1080 : 1920);
  const singleScale = videoDisplayW / rawSourceW;
  const targetTranslateX = isLandscape ? 0 : (CONTAINER_W / 2) - (activeFraming.x * singleScale);
  const translateX = isLandscape ? 0 : Math.max(-maxOffset, Math.min(0, targetTranslateX));
  const translateY = isLandscape ? (CONTAINER_H - videoDisplayH) / 2 : 0;

  // Split Viewport Display (1080x960 each viewport) with Constant Video Dimensions & Pure GPU Transforms
  const PANEL_H = CONTAINER_H / 2;

  // Top Speaker Viewport Zoom & Transform with Zoom-Relative Framing Offset
  const effectiveZoomTop = Math.max(1.0, Math.min(2.5, splitZoomTop || 1.0));
  const currentScaleTop = 0.5 * effectiveZoomTop;
  const topDisplayW = videoDisplayW * currentScaleTop;
  const topDisplayH = videoDisplayH * currentScaleTop;
  const topMaxOffset = Math.max(0, topDisplayW - CONTAINER_W);
  const topExtraH = Math.max(0, topDisplayH - PANEL_H);

  // Horizontal Framing Nudge (bounded by CONTAINER_W * 0.35, strictly clamped to video bounds)
  const topNudgeX = ((splitOffsetXTop || 0) / 100) * (CONTAINER_W * 0.35);
  const targetTopTranslateX = (CONTAINER_W / 2) - ((activeFraming.top_x / rawSourceW) * topDisplayW) + topNudgeX;
  const topTranslateX = Math.max(-topMaxOffset, Math.min(0, targetTopTranslateX));

  // Vertical Headroom Shift (base 25% natural headroom + user offset, strictly clamped to [ -topExtraH, 0 ])
  const baseTopTranslateY = -topExtraH * 0.25;
  const topNudgeY = ((splitOffsetYTop || 0) / 100) * (topExtraH * 0.5);
  const topTranslateY = Math.max(-topExtraH, Math.min(0, baseTopTranslateY + topNudgeY));

  // Bottom Speaker Viewport Zoom & Transform with Constant Video Dimensions & Pure GPU Transforms
  const effectiveZoomBottom = Math.max(1.0, Math.min(2.5, splitZoomBottom || 1.0));
  const currentScaleBottom = 0.5 * effectiveZoomBottom;
  const bottomDisplayW = videoDisplayW * currentScaleBottom;
  const bottomDisplayH = videoDisplayH * currentScaleBottom;
  const bottomMaxOffset = Math.max(0, bottomDisplayW - CONTAINER_W);
  const bottomExtraH = Math.max(0, bottomDisplayH - PANEL_H);

  const effectiveBottomX = activeFraming.bottom_x;

  // Horizontal Framing Nudge (bounded by CONTAINER_W * 0.35, strictly clamped to video bounds)
  const bottomNudgeX = ((splitOffsetXBottom || 0) / 100) * (CONTAINER_W * 0.35);
  const targetBottomTranslateX = (CONTAINER_W / 2) - ((effectiveBottomX / rawSourceW) * bottomDisplayW) + bottomNudgeX;
  const bottomTranslateX = Math.max(-bottomMaxOffset, Math.min(0, targetBottomTranslateX));

  // Vertical Headroom Shift (base 25% natural headroom + user offset, strictly clamped to [ -bottomExtraH, 0 ])
  const baseBottomTranslateY = -bottomExtraH * 0.25;
  const bottomNudgeY = ((splitOffsetYBottom || 0) / 100) * (bottomExtraH * 0.5);
  const bottomTranslateY = Math.max(-bottomExtraH, Math.min(0, baseBottomTranslateY + bottomNudgeY));


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
          const renderMediaViewports = (mediaStartFrame?: number, durationFrames?: number) => {
            if (isRendering) {
              // HEADLESS RENDER: Frame-accurate native Remotion OffthreadVideo
              return (
                <AbsoluteFill style={{ overflow: 'hidden' }}>
                  {/* Top Viewport (Split mode: Top Speaker | Single mode: Full Framing) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: CONTAINER_W,
                      height: (!isLandscape && isSplit) ? `${PANEL_H}px` : `${CONTAINER_H}px`,
                      overflow: 'hidden',
                      zIndex: 1,
                    }}
                  >
                    <OffthreadVideo
                      src={videoSrc}
                      volume={volume}
                      startFrom={mediaStartFrame}
                      endAt={durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined}
                      style={{
                        height: `${videoDisplayH}px`,
                        width: `${videoDisplayW}px`,
                        maxWidth: 'none',
                        transformOrigin: '0 0',
                        transform: (!isLandscape && isSplit)
                          ? `translate3d(${topTranslateX}px, ${topTranslateY}px, 0) scale(${currentScaleTop})`
                          : `translate3d(${translateX}px, ${translateY}px, 0) scale(1)`,
                        objectFit: 'cover',
                      }}
                    />
                  </div>

                  {/* Bottom Viewport (Split mode only - Conditional Mount with volume=0) */}
                  {!isLandscape && isSplit && (
                    <div
                      style={{
                        position: 'absolute',
                        top: `${PANEL_H}px`,
                        left: 0,
                        width: CONTAINER_W,
                        height: `${PANEL_H}px`,
                        overflow: 'hidden',
                        zIndex: 2,
                      }}
                    >
                      <OffthreadVideo
                        src={videoSrc}
                        volume={0}
                        startFrom={mediaStartFrame}
                        endAt={durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined}
                        style={{
                          height: `${videoDisplayH}px`,
                          width: `${videoDisplayW}px`,
                          maxWidth: 'none',
                          transformOrigin: '0 0',
                          transform: `translate3d(${bottomTranslateX}px, ${bottomTranslateY}px, 0) scale(${currentScaleBottom})`,
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                  )}

                  {/* Center Seam Divider (Split mode only) */}
                  {!isLandscape && isSplit && (
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
                      }}
                    />
                  )}
                </AbsoluteFill>
              );
            }

            // EDITOR PREVIEW: Single-decoder HTML5 Canvas Compositor (Zero "muka kembar", fast scrubbing)
            return (
              <AbsoluteFill style={{ overflow: 'hidden' }}>
                <CanvasVideoCompositor
                  videoSrc={videoSrc}
                  volume={volume}
                  mediaStartFrame={mediaStartFrame}
                  durationFrames={durationFrames}
                  fps={fps}
                  CONTAINER_W={CONTAINER_W}
                  CONTAINER_H={CONTAINER_H}
                  PANEL_H={PANEL_H}
                  isLandscape={isLandscape}
                  isSplit={isSplit}
                  videoDisplayW={videoDisplayW}
                  videoDisplayH={videoDisplayH}
                  rawSourceW={rawSourceW}
                  sourceHeight={sourceHeight}
                  translateX={translateX}
                  translateY={translateY}
                  topTranslateX={topTranslateX}
                  topTranslateY={topTranslateY}
                  currentScaleTop={currentScaleTop}
                  bottomTranslateX={bottomTranslateX}
                  bottomTranslateY={bottomTranslateY}
                  currentScaleBottom={currentScaleBottom}
                  cropMap={cropMap}
                  cropX={cropX}
                  cropPercentXTop={cropPercentXTop}
                  cropPercentXBottom={cropPercentXBottom}
                  splitZoomTop={splitZoomTop}
                  splitZoomBottom={splitZoomBottom}
                  splitOffsetXTop={splitOffsetXTop}
                  splitOffsetYTop={splitOffsetYTop}
                  splitOffsetXBottom={splitOffsetXBottom}
                  splitOffsetYBottom={splitOffsetYBottom}
                />
              </AbsoluteFill>
            );
          };

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
