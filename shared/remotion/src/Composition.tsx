import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Video,
  OffthreadVideo,
  Audio,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  useRemotionEnvironment
} from 'remotion';
import { AnimatedSubtitles } from './AnimatedSubtitles';
import {
  CanvasVideoCompositor,
  computeViewportFraming
} from './CanvasVideoCompositor';
import type { ViewportFramingParams } from './CanvasVideoCompositor';
import {
  TimelineFrameRetention,
  coalesceContiguousVideoSegments,
  getSegmentFrameWindow,
  resolveTimelineMediaTime
} from './TimelineFrameRetention';
import type { YonruClipProps, ThumbnailTextOverlay } from './types';
import { getFont } from './fonts';

interface HeadlessMediaViewportsProps {
  videoSrc: string;
  frameVolume: number | ((f: number) => number);
  mediaStartFrame?: number;
  durationFrames?: number;
  fps: number;
  fallbackMediaTime: number;
  framingParams: ViewportFramingParams;
  isLandscape: boolean;
  landscapeBackground?: 'black' | 'blur';
  landscapeBlurRadius?: number;
  landscapeDarkness?: number;
  CONTAINER_W: number;
  CONTAINER_H: number;
  PANEL_H: number;
  videoDisplayW: number;
  videoDisplayH: number;
}

const HeadlessMediaViewports: React.FC<HeadlessMediaViewportsProps> = ({
  videoSrc,
  frameVolume,
  mediaStartFrame,
  durationFrames,
  fps,
  fallbackMediaTime,
  framingParams,
  isLandscape,
  landscapeBackground = 'black',
  landscapeBlurRadius = 25,
  landscapeDarkness = 35,
  CONTAINER_W,
  CONTAINER_H,
  PANEL_H,
  videoDisplayW,
  videoDisplayH
}) => {
  const localFrame = useCurrentFrame();
  const segmentMediaTime =
    mediaStartFrame !== undefined
      ? (mediaStartFrame + Math.max(0, localFrame)) / fps
      : fallbackMediaTime;

  const segFraming = computeViewportFraming(segmentMediaTime, framingParams);
  const segIsSplit = segFraming.isSplitActive;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Landscape Blurred Video Background (Headless Render parity) */}
      {isLandscape && landscapeBackground === 'blur' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${CONTAINER_W}px`,
            height: `${CONTAINER_H}px`,
            overflow: 'hidden',
            zIndex: 0
          }}
        >
          <OffthreadVideo
            src={videoSrc}
            volume={0}
            muted={true}
            startFrom={mediaStartFrame}
            endAt={
              durationFrames
                ? (mediaStartFrame ?? 0) + durationFrames
                : undefined
            }
            style={{
              width: `${CONTAINER_W}px`,
              height: `${CONTAINER_H}px`,
              objectFit: 'cover',
              transform: 'scale(1.08)',
              filter: `blur(${Math.max(1, landscapeBlurRadius || 25)}px)`
            }}
          />
          {(landscapeDarkness ?? 35) > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: `rgba(0, 0, 0, ${Math.max(0, Math.min(100, landscapeDarkness ?? 35)) / 100})`
              }}
            />
          )}
        </div>
      )}

      {/* Top Viewport (Split mode: Top Speaker | Single mode: Full Framing) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CONTAINER_W,
          height:
            !isLandscape && segIsSplit ? `${PANEL_H}px` : `${CONTAINER_H}px`,
          overflow: 'hidden',
          zIndex: 1
        }}
      >
        <OffthreadVideo
          src={videoSrc}
          volume={frameVolume}
          startFrom={mediaStartFrame}
          endAt={
            durationFrames ? (mediaStartFrame ?? 0) + durationFrames : undefined
          }
          style={{
            height: `${videoDisplayH}px`,
            width: `${videoDisplayW}px`,
            maxWidth: 'none',
            transformOrigin: '0 0',
            transform:
              !isLandscape && segIsSplit
                ? `translate3d(${segFraming.curTopTranslateX}px, ${segFraming.curTopTranslateY}px, 0) scale(${segFraming.curScaleTop})`
                : `translate3d(${segFraming.curTranslateX}px, ${segFraming.curTranslateY}px, 0) scale(1)`,
            objectFit: 'cover'
          }}
        />
      </div>

      {/* Bottom Viewport (Split mode only - Conditional Mount with volume=0) */}
      {!isLandscape && segIsSplit && (
        <div
          style={{
            position: 'absolute',
            top: `${PANEL_H}px`,
            left: 0,
            width: CONTAINER_W,
            height: `${PANEL_H}px`,
            overflow: 'hidden',
            zIndex: 2
          }}
        >
          <OffthreadVideo
            src={videoSrc}
            volume={0}
            startFrom={mediaStartFrame}
            endAt={
              durationFrames
                ? (mediaStartFrame ?? 0) + durationFrames
                : undefined
            }
            style={{
              height: `${videoDisplayH}px`,
              width: `${videoDisplayW}px`,
              maxWidth: 'none',
              transformOrigin: '0 0',
              transform: `translate3d(${segFraming.curBottomTranslateX}px, ${segFraming.curBottomTranslateY}px, 0) scale(${segFraming.curScaleBottom})`,
              objectFit: 'cover'
            }}
          />
        </div>
      )}

      {/* Center Seam Divider (Split mode only) */}
      {!isLandscape && segIsSplit && (
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
            pointerEvents: 'none'
          }}
        />
      )}
    </AbsoluteFill>
  );
};

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
  words = [],
  wordTimings = [],
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
  landscapeBackground = 'black',
  landscapeBlurRadius = 25,
  landscapeDarkness = 35,
  subtitleOffset = 50,
  autoAdaptiveSubtitles = true,
  showDebug,
  subtitleStyle,
  timelineTextItems = [],
  timelineAudioItems = [],
  timelineVideoItems = [],
  volume = 0.5,
  hideSubtitles = false,
  coverEnabled,
  coverDuration,
  coverImagePath,
  coverTextOverlays,
  coverXOffset,
  thumbnailEnabled = false,
  thumbnailDuration = 1,
  thumbnailImagePath,
  thumbnailTextOverlays = [],
  thumbnailXOffset = 50,
  sourceWidth,
  sourceHeight,
  censoredSegments = [],
  bleepAudioSrc
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();

  const isCoverActive = coverEnabled ?? thumbnailEnabled;
  const activeCoverDuration = coverDuration ?? thumbnailDuration;
  const activeCoverImage = coverImagePath ?? thumbnailImagePath;
  const activeCoverOverlays = coverTextOverlays ?? thumbnailTextOverlays;
  const activeCoverXOffset = coverXOffset ?? thumbnailXOffset;

  const thumbnailFrames = isCoverActive
    ? Math.round(activeCoverDuration * fps)
    : 0;
  const currentTime = Math.max(0, frame - thumbnailFrames) / fps;

  // Automated Micro-Envelope (15ms zero-crossing) & Frame-Locked Volume Ducking
  const baseVolume = volume;

  // Normalize & merge overlapping or contiguous censored segments to prevent double-bleep audio phasing
  const mergedCensoredSegments = useMemo(() => {
    if (!censoredSegments || censoredSegments.length === 0) return [];
    const valid = censoredSegments
      .filter(
        s =>
          s &&
          typeof s.start === 'number' &&
          typeof s.duration === 'number' &&
          s.duration > 0
      )
      .map(s => ({
        start: Math.round(s.start * 1000) / 1000,
        duration: Math.round(s.duration * 1000) / 1000
      }))
      .sort((a, b) => a.start - b.start);

    if (valid.length === 0) return [];

    const merged: Array<{ start: number; duration: number }> = [];
    let current = { ...valid[0] };

    for (let i = 1; i < valid.length; i++) {
      const next = valid[i];
      const currentEnd =
        Math.round((current.start + current.duration) * 1000) / 1000;
      if (next.start <= currentEnd + 0.005) {
        const nextEnd = Math.round((next.start + next.duration) * 1000) / 1000;
        const newEnd = Math.max(currentEnd, nextEnd);
        current.duration = Math.round((newEnd - current.start) * 1000) / 1000;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
    return merged;
  }, [censoredSegments]);

  const frameVolume = useMemo(() => {
    if (mergedCensoredSegments.length === 0) {
      return baseVolume;
    }
    return (f: number) => {
      const time = Math.max(0, f - thumbnailFrames) / fps;
      const fadeSec = 0.015; // 15ms internal micro-envelope

      for (const seg of mergedCensoredSegments) {
        if (time >= seg.start && time <= seg.start + seg.duration) {
          if (time < seg.start + fadeSec) {
            const factor = (time - seg.start) / fadeSec;
            return baseVolume * (1 - factor);
          }
          if (time > seg.start + seg.duration - fadeSec) {
            const factor =
              (time - (seg.start + seg.duration - fadeSec)) / fadeSec;
            return baseVolume * factor;
          }
          return 0;
        }
      }
      return baseVolume;
    };
  }, [mergedCensoredSegments, baseVolume, thumbnailFrames, fps]);

  const isUrl =
    videoPath &&
    (videoPath.startsWith('http') || videoPath.startsWith('blob:'));
  const videoSrc = videoPath ? (isUrl ? videoPath : staticFile(videoPath)) : '';

  if (isRendering) {
    console.log('[Remotion Render] Props:', {
      videoPath,
      wordsCount: words?.length,
      position,
      videoLayout,
      thumbnailEnabled,
      thumbnailFrames
    });
  }

  // Filter active text items (adjusted for thumbnail offset)
  const activeTextItems = timelineTextItems.filter(
    item =>
      currentTime >= item.start && currentTime <= item.start + item.duration
  );

  // Coalesce unsorted split segments that are contiguous in both timeline time and media time
  const coalescedVideoSegments = useMemo(
    () => coalesceContiguousVideoSegments(timelineVideoItems),
    [timelineVideoItems]
  );

  // Exact math from VideoPreview.vue to guarantee 1:1 match
  const isLandscape = videoLayout === 'landscape';
  const videoAspect =
    sourceWidth && sourceHeight ? sourceWidth / sourceHeight : 16 / 9;
  const CONTAINER_W = 1080;
  const CONTAINER_H = 1920;
  const PANEL_H = CONTAINER_H / 2;

  // Single / Landscape Display - Constant Video Dimensions
  const videoDisplayW = isLandscape ? CONTAINER_W : CONTAINER_H * videoAspect;
  const videoDisplayH = isLandscape ? CONTAINER_W / videoAspect : CONTAINER_H;
  const rawSourceW = sourceWidth || (isLandscape ? 1080 : 1920);

  const mainVideoFrame = frame - thumbnailFrames;
  const activeMediaTime = useMemo(
    () => resolveTimelineMediaTime(mainVideoFrame, coalescedVideoSegments, fps),
    [mainVideoFrame, coalescedVideoSegments, fps]
  );

  const framingParams: ViewportFramingParams = useMemo(
    () => ({
      cropMap,
      cropX,
      cropPercentXTop,
      cropPercentXBottom,
      splitZoomTop,
      splitZoomBottom,
      splitOffsetXTop,
      splitOffsetYTop,
      splitOffsetXBottom,
      splitOffsetYBottom,
      rawSourceW,
      isLandscape,
      videoDisplayW,
      videoDisplayH,
      CONTAINER_W,
      CONTAINER_H,
      PANEL_H
    }),
    [
      cropMap,
      cropX,
      cropPercentXTop,
      cropPercentXBottom,
      splitZoomTop,
      splitZoomBottom,
      splitOffsetXTop,
      splitOffsetYTop,
      splitOffsetXBottom,
      splitOffsetYBottom,
      rawSourceW,
      isLandscape,
      videoDisplayW,
      videoDisplayH
    ]
  );

  // Determine active framing from physical source media time (never raw timeline time)
  const activeFraming = useMemo(
    () => computeViewportFraming(activeMediaTime, framingParams),
    [activeMediaTime, framingParams]
  );

  if (frame % 30 === 0) {
    console.log(
      `[Remotion] frame=${frame} time=${currentTime.toFixed(2)} mediaTime=${activeMediaTime.toFixed(2)} mode=${activeFraming.mode} activeX=${activeFraming.x.toFixed(0)}`
    );
  }

  const isSplit = activeFraming.isSplitActive;
  const translateX = activeFraming.curTranslateX;
  const translateY = activeFraming.curTranslateY;
  const topTranslateX = activeFraming.curTopTranslateX;
  const topTranslateY = activeFraming.curTopTranslateY;
  const currentScaleTop = activeFraming.curScaleTop;
  const bottomTranslateX = activeFraming.curBottomTranslateX;
  const bottomTranslateY = activeFraming.curBottomTranslateY;
  const currentScaleBottom = activeFraming.curScaleBottom;

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden' }}>
      {/* ===== COVER / THUMBNAIL SLIDE ===== */}
      {isCoverActive && activeCoverImage && (
        <Sequence from={0} durationInFrames={thumbnailFrames} name="Cover">
          <AbsoluteFill>
            <Img
              src={staticFile(activeCoverImage)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${activeCoverXOffset}% center`
              }}
            />
            {/* Cover text overlays */}
            {activeCoverOverlays.map((overlay: ThumbnailTextOverlay) => (
              <div
                key={overlay.id}
                style={{
                  position: 'absolute',
                  left: `${overlay.x}px`,
                  top: `${overlay.y}px`,
                  transform: overlay.rotation
                    ? `rotate(${overlay.rotation}deg)`
                    : undefined,
                  transformOrigin: 'top left',
                  color: overlay.color || '#FFFFFF',
                  fontSize: `${overlay.fontSize || 80}px`,
                  fontFamily: getFont(overlay.fontFamily || 'Montserrat'),
                  fontWeight: overlay.fontWeight || 900,
                  textTransform: overlay.textTransform || 'none',
                  paintOrder:
                    overlay.showStroke !== false ? 'stroke fill' : undefined,
                  WebkitTextStroke:
                    overlay.showStroke !== false
                      ? `${(overlay.strokeWidth || 5) * 2}px ${overlay.strokeColor || '#000000'}`
                      : undefined,
                  textShadow: '3px 5px 15px rgba(0,0,0,0.6)',
                  whiteSpace: 'pre-wrap',
                  textAlign: 'center',
                  lineHeight: 1.1,
                  // Background Box
                  backgroundColor: overlay.showBackground
                    ? overlay.backgroundColor?.startsWith('#')
                      ? `${overlay.backgroundColor}${Math.round(
                          (overlay.backgroundOpacity ?? 0.7) * 255
                        )
                          .toString(16)
                          .padStart(2, '0')}`
                      : overlay.backgroundColor
                    : 'transparent',
                  padding: `${overlay.backgroundPadding ?? 20}px`,
                  borderRadius: overlay.showBackground ? '10px' : 0,
                  display: 'inline-block',
                  width: 'fit-content'
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
          const renderMediaViewports = (
            mediaStartFrame?: number,
            durationFrames?: number,
            onFrameRendered?: (canvas: HTMLCanvasElement) => void,
            isActive: boolean = true
          ) => {
            if (isRendering) {
              // HEADLESS RENDER: Frame-accurate native Remotion OffthreadVideo synced to segment media time
              return (
                <HeadlessMediaViewports
                  videoSrc={videoSrc}
                  frameVolume={frameVolume}
                  mediaStartFrame={mediaStartFrame}
                  durationFrames={durationFrames}
                  fps={fps}
                  fallbackMediaTime={activeMediaTime}
                  framingParams={framingParams}
                  isLandscape={isLandscape}
                  landscapeBackground={landscapeBackground}
                  landscapeBlurRadius={landscapeBlurRadius}
                  landscapeDarkness={landscapeDarkness}
                  CONTAINER_W={CONTAINER_W}
                  CONTAINER_H={CONTAINER_H}
                  PANEL_H={PANEL_H}
                  videoDisplayW={videoDisplayW}
                  videoDisplayH={videoDisplayH}
                />
              );
            }

            // EDITOR PREVIEW: Single-decoder HTML5 Canvas Compositor (Zero "muka kembar", fast scrubbing)
            return (
              <AbsoluteFill style={{ overflow: 'hidden' }}>
                <CanvasVideoCompositor
                  videoSrc={videoSrc}
                  volume={frameVolume}
                  mediaStartFrame={mediaStartFrame}
                  durationFrames={durationFrames}
                  fps={fps}
                  CONTAINER_W={CONTAINER_W}
                  CONTAINER_H={CONTAINER_H}
                  PANEL_H={PANEL_H}
                  isLandscape={isLandscape}
                  landscapeBackground={landscapeBackground}
                  landscapeBlurRadius={landscapeBlurRadius}
                  landscapeDarkness={landscapeDarkness}
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
                  isActive={isActive}
                  onFrameRendered={onFrameRendered}
                />
              </AbsoluteFill>
            );
          };

          if (!videoPath) {
            return null;
          }

          if (!isRendering) {
            return (
              <TimelineFrameRetention
                videoSrc={videoSrc}
                width={CONTAINER_W}
                height={CONTAINER_H}
                mainVideoFrame={mainVideoFrame}
                fps={fps}
                timelineVideoItems={coalescedVideoSegments}
              >
                {onFrameRendered => {
                  if (coalescedVideoSegments.length > 0) {
                    return coalescedVideoSegments.map((item, idx) => {
                      const {
                        startFrame,
                        endFrame,
                        durationFrames,
                        mediaStartFrame
                      } = getSegmentFrameWindow(item, fps);
                      if (durationFrames <= 0) {
                        return null;
                      }
                      const isSegmentActive =
                        mainVideoFrame >= startFrame &&
                        mainVideoFrame < endFrame;
                      const premountFrames =
                        startFrame > 0
                          ? Math.min(Math.round(fps * 1.5), startFrame)
                          : 0;
                      return (
                        <Sequence
                          key={item.id ?? `seg-${idx}`}
                          from={startFrame}
                          durationInFrames={durationFrames}
                          premountFor={
                            premountFrames > 0 ? premountFrames : undefined
                          }
                          name={`VideoSegment-${item.id ?? idx}`}
                          style={{ zIndex: 1 }}
                        >
                          {renderMediaViewports(
                            mediaStartFrame,
                            durationFrames,
                            onFrameRendered,
                            isSegmentActive
                          )}
                        </Sequence>
                      );
                    });
                  }

                  return (
                    <AbsoluteFill style={{ zIndex: 1 }}>
                      {renderMediaViewports(
                        undefined,
                        undefined,
                        onFrameRendered,
                        true
                      )}
                    </AbsoluteFill>
                  );
                }}
              </TimelineFrameRetention>
            );
          }

          if (coalescedVideoSegments.length > 0) {
            return coalescedVideoSegments.map((item, idx) => {
              const { startFrame, durationFrames, mediaStartFrame } =
                getSegmentFrameWindow(item, fps);
              if (durationFrames <= 0) {
                return null;
              }
              return (
                <Sequence
                  key={item.id ?? `seg-${idx}`}
                  from={startFrame}
                  durationInFrames={durationFrames}
                  name={`VideoSegment-${item.id ?? idx}`}
                >
                  {renderMediaViewports(mediaStartFrame, durationFrames)}
                </Sequence>
              );
            });
          }

          return renderMediaViewports();
        })()}

        {/* Subtitles layer */}
        {!hideSubtitles &&
          (() => {
            const useCenterSeam = isSplit && autoAdaptiveSubtitles;
            return (
              <AbsoluteFill
                style={{
                  justifyContent: useCenterSeam
                    ? 'center'
                    : position === 'top'
                      ? 'flex-start'
                      : position === 'center'
                        ? 'center'
                        : 'flex-end',
                  alignItems: 'center',
                  paddingTop:
                    !useCenterSeam && position === 'top'
                      ? `${subtitleOffset}px`
                      : 0,
                  paddingBottom:
                    !useCenterSeam && position === 'bottom'
                      ? `${subtitleOffset}px`
                      : 0,
                  transform: undefined,
                  zIndex: 20
                }}
              >
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
        {activeTextItems.map(item => {
          const getBgColor = (it: any) => {
            if (!it.showBackground) return 'transparent';
            const baseColor = it.backgroundColor || '#000000';
            if (baseColor.startsWith('#')) {
              const opacityVal =
                it.backgroundOpacity !== undefined ? it.backgroundOpacity : 0.7;
              const hexOpacity = Math.round(opacityVal * 255)
                .toString(16)
                .padStart(2, '0');
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
              const dist =
                it.shadowDistance !== undefined ? it.shadowDistance : 4;
              const blur = it.shadowBlur !== undefined ? it.shadowBlur : 8;
              const color = it.shadowColor || 'rgba(0,0,0,0.6)';
              return `${dist}px ${dist}px ${blur}px ${color}`;
            }
            return 'none';
          };

          const textStroke =
            item.strokeWidth && item.strokeWidth > 0
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
              <div
                style={{
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
                  lineHeight:
                    item.lineHeight !== undefined ? item.lineHeight : 1.1,
                  opacity: item.opacity !== undefined ? item.opacity : 1.0,
                  // No transform: Konva label config resets offset to {x:0,y:0} on every
                  // reactive update, so stored coordinates are top-left based, not center.
                  whiteSpace: 'pre-wrap',
                  maxWidth: '900px',
                  // Background Box
                  backgroundColor: getBgColor(item),
                  padding: `${item.showBackground ? (item.backgroundPadding !== undefined ? item.backgroundPadding : 15) : 15}px`,
                  borderRadius: item.showBackground
                    ? `${item.backgroundRoundness !== undefined ? item.backgroundRoundness : 10}px`
                    : 0,
                  display: 'inline-block',
                  width: 'fit-content',
                  // Text Stroke
                  paintOrder: item.showStroke ? 'stroke fill' : undefined,
                  WebkitTextStroke:
                    item.showStroke && item.strokeWidth
                      ? `${item.strokeWidth * 2}px ${item.strokeColor || '#000000'}`
                      : textStroke,
                  // Text Shadow / Glow
                  textShadow: getTextShadow(item)
                }}
              >
                {item.content || ''}
              </div>
            </AbsoluteFill>
          );
        })}

        {/* Timeline Audio layers */}
        {timelineAudioItems.map(item => (
          <Sequence
            key={item.id}
            from={Math.round(item.start * fps)}
            durationInFrames={Math.round(item.duration * fps)}
            name={`Audio-${item.name}`}
          >
            <Audio src={item.src} volume={item.volume ?? 1} />
          </Sequence>
        ))}

        {/* Frame-Locked Censorship Bleep Audio Layers */}
        {bleepAudioSrc &&
          mergedCensoredSegments.map((seg, idx) => {
            const segStartFrame = thumbnailFrames + Math.round(seg.start * fps);
            const segDurationFrames = Math.max(
              1,
              Math.round(seg.duration * fps)
            );
            return (
              <Sequence
                key={`bleep-${idx}-${seg.start}`}
                from={segStartFrame}
                durationInFrames={segDurationFrames}
                name={`Bleep-${idx}`}
              >
                <Audio src={bleepAudioSrc} loop volume={1} />
              </Sequence>
            );
          })}
      </Sequence>
    </AbsoluteFill>
  );
};
