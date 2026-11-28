/** @jsxImportSource react */
import React, { useCallback, useMemo, useRef } from 'react';
import {
  AbsoluteFill,
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
  computeLandscapeBlurSpec,
  drawLandscapeBlurFrame
} from './CanvasVideoCompositor';
import { TimelineFrameRetention } from './TimelineFrameRetention';
import {
  createCensoredAudioIndex,
  createTimelineFramingIndex,
  createTimelineSegmentIndex,
  indexTimelineTextLayers,
  type TimelineFramingIndex,
  type TimelineSegmentIndex
} from './TimelineFramingIndex';
import type { YonruClipProps, ThumbnailTextOverlay } from './types';
import { getFont } from './fonts';

const OVERFLOW_HIDDEN_STYLE: React.CSSProperties = { overflow: 'hidden' };
const Z_INDEX_1_STYLE: React.CSSProperties = { zIndex: 1 };
const Z_INDEX_1_OVERFLOW_HIDDEN_STYLE: React.CSSProperties = {
  zIndex: 1,
  overflow: 'hidden'
};

interface HeadlessMediaViewportsProps {
  videoSrc: string;
  frameVolume: number | ((f: number) => number);
  mediaStartFrame?: number;
  durationFrames?: number;
  fps: number;
  segmentIndex?: TimelineSegmentIndex;
  framingIndex: TimelineFramingIndex;
  isLandscape: boolean;
  landscapeBackground?: 'black' | 'blur';
  landscapeBlurRadius?: number;
  landscapeDarkness?: number;
  CONTAINER_W: number;
  CONTAINER_H: number;
  PANEL_H: number;
  videoDisplayW: number;
  videoDisplayH: number;
  rawSourceW?: number;
  sourceHeight?: number;
}

const HeadlessMediaViewports: React.FC<HeadlessMediaViewportsProps> = ({
  videoSrc,
  frameVolume,
  mediaStartFrame,
  durationFrames,
  fps,
  segmentIndex,
  framingIndex,
  isLandscape,
  landscapeBackground = 'black',
  landscapeBlurRadius = 25,
  landscapeDarkness = 35,
  CONTAINER_W,
  CONTAINER_H,
  PANEL_H,
  videoDisplayW,
  videoDisplayH,
  rawSourceW = 1920,
  sourceHeight = 1080
}) => {
  const localFrame = useCurrentFrame();
  const segmentMediaTime =
    mediaStartFrame !== undefined
      ? (mediaStartFrame + Math.max(0, localFrame)) / fps
      : segmentIndex
        ? segmentIndex.resolveMediaTime(localFrame)
        : Math.max(0, localFrame) / fps;

  const segFraming = framingIndex.computeFraming(segmentMediaTime);
  const segIsSplit = segFraming.isSplitActive;

  const useLandscapeBlur = isLandscape && landscapeBackground === 'blur';
  const blurSpec = computeLandscapeBlurSpec({
    containerWidth: CONTAINER_W,
    containerHeight: CONTAINER_H,
    sourceWidth: rawSourceW,
    sourceHeight,
    blurRadius: landscapeBlurRadius
  });
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const blurConfig = {
    enabled: useLandscapeBlur,
    containerWidth: CONTAINER_W,
    containerHeight: CONTAINER_H,
    blurRadius: landscapeBlurRadius,
    fallbackSourceWidth: rawSourceW,
    fallbackSourceHeight: sourceHeight
  };
  const blurConfigRef = useRef(blurConfig);
  blurConfigRef.current = blurConfig;

  const setBlurCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    if (blurCanvasRef.current !== el) {
      blurCanvasRef.current = el;
      blurCtxRef.current = null;
    }
  }, []);

  // Keep referentially stable so Remotion <OffthreadVideo>/<Img> never re-runs its decode effect
  const handleBlurVideoFrame = useCallback((frame: CanvasImageSource) => {
    const cfg = blurConfigRef.current;
    const canvas = blurCanvasRef.current;
    if (!cfg.enabled || !canvas) {
      return;
    }
    try {
      const result = drawLandscapeBlurFrame(canvas, frame, {
        containerWidth: cfg.containerWidth,
        containerHeight: cfg.containerHeight,
        blurRadius: cfg.blurRadius,
        fallbackSourceWidth: cfg.fallbackSourceWidth,
        fallbackSourceHeight: cfg.fallbackSourceHeight,
        cachedCtx: blurCtxRef.current
      });
      blurCtxRef.current = result.ctx;
    } catch {
      // Ignored if frame source cannot be drawn
    }
  }, []);

  return (
    <AbsoluteFill style={OVERFLOW_HIDDEN_STYLE}>
      {/* Landscape Blurred Video Background (Unified 1/8-scale Canvas) */}
      {useLandscapeBlur && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${CONTAINER_W}px`,
            height: `${CONTAINER_H}px`,
            overflow: 'hidden',
            backgroundColor: '#000000',
            zIndex: 0
          }}
        >
          <canvas
            ref={setBlurCanvasRef}
            data-testid="headless-landscape-blur-canvas"
            width={blurSpec.blurWidth}
            height={blurSpec.blurHeight}
            style={{
              width: `${CONTAINER_W}px`,
              height: `${CONTAINER_H}px`,
              display: 'block'
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
          onVideoFrame={useLandscapeBlur ? handleBlurVideoFrame : undefined}
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

interface PreviewVideoSegmentSlotProps {
  segmentId: string | number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  mediaStartFrame: number;
  fps: number;
  videoSrc: string;
  frameVolume: number | ((f: number) => number);
  CONTAINER_W: number;
  CONTAINER_H: number;
  PANEL_H: number;
  isLandscape: boolean;
  landscapeBackground: 'black' | 'blur';
  landscapeBlurRadius: number;
  landscapeDarkness: number;
  videoDisplayW: number;
  videoDisplayH: number;
  rawSourceW: number;
  sourceHeight?: number;
  framingIndex: TimelineFramingIndex;
}

const PreviewVideoSegmentSlot: React.FC<PreviewVideoSegmentSlotProps> = ({
  segmentId,
  startFrame,
  endFrame,
  durationFrames,
  mediaStartFrame,
  fps,
  videoSrc,
  frameVolume,
  CONTAINER_W,
  CONTAINER_H,
  PANEL_H,
  isLandscape,
  landscapeBackground,
  landscapeBlurRadius,
  landscapeDarkness,
  videoDisplayW,
  videoDisplayH,
  rawSourceW,
  sourceHeight,
  framingIndex
}) => {
  // Compute active status outside <Sequence premountFor>: Remotion freezes
  // useCurrentFrame() at 0 inside premounted sequences.
  const mainVideoFrame = useCurrentFrame();
  const isSegmentActive =
    mainVideoFrame >= startFrame && mainVideoFrame < endFrame;
  const premountFrames =
    startFrame > 0 ? Math.min(Math.round(fps * 1.5), startFrame) : 0;

  return (
    <Sequence
      from={startFrame}
      durationInFrames={durationFrames}
      premountFor={premountFrames > 0 ? premountFrames : undefined}
      name={`VideoSegment-${segmentId}`}
      style={Z_INDEX_1_STYLE}
    >
      <AbsoluteFill style={OVERFLOW_HIDDEN_STYLE}>
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
          videoDisplayW={videoDisplayW}
          videoDisplayH={videoDisplayH}
          rawSourceW={rawSourceW}
          sourceHeight={sourceHeight}
          framingIndex={framingIndex}
          isActive={isSegmentActive}
        />
      </AbsoluteFill>
    </Sequence>
  );
};

interface AdaptiveSubtitleLayerProps {
  segmentIndex: TimelineSegmentIndex;
  framingIndex: TimelineFramingIndex;
  autoAdaptiveSubtitles: boolean;
  position: YonruClipProps['position'];
  subtitleOffset: number;
  words: YonruClipProps['words'];
  wordTimings: YonruClipProps['wordTimings'];
  showDebug?: boolean;
  subtitleStyle?: YonruClipProps['subtitleStyle'];
}

const AdaptiveSubtitleLayer: React.FC<AdaptiveSubtitleLayerProps> = ({
  segmentIndex,
  framingIndex,
  autoAdaptiveSubtitles,
  position,
  subtitleOffset,
  words,
  wordTimings,
  showDebug,
  subtitleStyle
}) => {
  const mainVideoFrame = useCurrentFrame();
  const activeMediaTime = segmentIndex.resolveMediaTime(mainVideoFrame);
  const isSplit = autoAdaptiveSubtitles
    ? framingIndex.isSplitAt(activeMediaTime)
    : false;
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
          !useCenterSeam && position === 'top' ? `${subtitleOffset}px` : 0,
        paddingBottom:
          !useCenterSeam && position === 'bottom' ? `${subtitleOffset}px` : 0,
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
};

interface TimelineTextOverlayItem {
  id: string;
  content?: string;
  start: number;
  duration: number;
  x: number;
  y: number;
  color?: string;
  fontSize?: number;
  font?: string;
  fontWeight?: React.CSSProperties['fontWeight'];
  fontStyle?: React.CSSProperties['fontStyle'];
  textDecoration?: React.CSSProperties['textDecoration'];
  textTransform?: React.CSSProperties['textTransform'];
  textAlign?: React.CSSProperties['textAlign'];
  letterSpacing?: number;
  wordSpacing?: number;
  lineHeight?: number;
  opacity?: number;
  showBackground?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundPadding?: number;
  backgroundRoundness?: number;
  showStroke?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  shadowGlow?: string;
  glowColor?: string;
  shadowDistance?: number;
  shadowBlur?: number;
  shadowColor?: string;
}

function getTextOverlayBgColor(item: TimelineTextOverlayItem): string {
  if (!item.showBackground) return 'transparent';
  const baseColor = item.backgroundColor || '#000000';
  if (baseColor.startsWith('#')) {
    const opacityVal =
      item.backgroundOpacity !== undefined ? item.backgroundOpacity : 0.7;
    const hexOpacity = Math.round(opacityVal * 255)
      .toString(16)
      .padStart(2, '0');
    return `${baseColor}${hexOpacity}`;
  }
  return baseColor;
}

function getTextOverlayShadow(item: TimelineTextOverlayItem): string {
  if (item.shadowGlow === 'glow') {
    const glow = item.glowColor || '#FFFFFF';
    return `0 0 10px ${glow}, 0 0 20px ${glow}, 0 0 30px ${glow}`;
  }
  if (item.shadowGlow === 'shadow') {
    const dist = item.shadowDistance !== undefined ? item.shadowDistance : 4;
    const blur = item.shadowBlur !== undefined ? item.shadowBlur : 8;
    const color = item.shadowColor || 'rgba(0,0,0,0.6)';
    return `${dist}px ${dist}px ${blur}px ${color}`;
  }
  return 'none';
}

interface TimelineTextLayerCardProps {
  item: TimelineTextOverlayItem;
  zIndex: number;
}

const TimelineTextLayerCard: React.FC<TimelineTextLayerCardProps> = React.memo(
  ({ item, zIndex }) => {
    const effectiveStrokeWidth = item.showStroke ? (item.strokeWidth ?? 5) : 0;
    const hasOutline = Boolean(item.showStroke) && effectiveStrokeWidth > 0;

    return (
      <AbsoluteFill
        style={{
          zIndex,
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
            lineHeight: item.lineHeight !== undefined ? item.lineHeight : 1.1,
            opacity: item.opacity !== undefined ? item.opacity : 1.0,
            // No transform: Konva label config resets offset to {x:0,y:0} on every
            // reactive update, so stored coordinates are top-left based, not center.
            whiteSpace: 'pre-wrap',
            maxWidth: '900px',
            // Background Box
            backgroundColor: getTextOverlayBgColor(item),
            padding: `${item.showBackground ? (item.backgroundPadding !== undefined ? item.backgroundPadding : 15) : 15}px`,
            borderRadius: item.showBackground
              ? `${item.backgroundRoundness !== undefined ? item.backgroundRoundness : 10}px`
              : 0,
            display: 'inline-block',
            width: 'fit-content',
            // Text Outline
            paintOrder: hasOutline ? 'stroke fill' : undefined,
            WebkitTextStroke: hasOutline
              ? `${effectiveStrokeWidth * 2}px ${item.strokeColor || '#000000'}`
              : undefined,
            // Text Shadow / Glow
            textShadow: getTextOverlayShadow(item)
          }}
        >
          {item.content || ''}
        </div>
      </AbsoluteFill>
    );
  }
);
TimelineTextLayerCard.displayName = 'TimelineTextLayerCard';

interface TimelineTextLayersProps {
  timelineTextItems: readonly TimelineTextOverlayItem[];
  fps: number;
}

const TimelineTextLayers: React.FC<TimelineTextLayersProps> = React.memo(
  ({ timelineTextItems, fps }) => {
    const layers = useMemo(
      () => indexTimelineTextLayers(timelineTextItems, fps),
      [timelineTextItems, fps]
    );

    if (layers.length === 0) {
      return null;
    }

    return (
      <>
        {layers.map(layer => (
          <Sequence
            key={layer.key}
            from={layer.startFrame}
            durationInFrames={layer.durationFrames}
            layout="none"
            name={`TextLayer-${layer.key}`}
          >
            <TimelineTextLayerCard item={layer.item} zIndex={layer.zIndex} />
          </Sequence>
        ))}
      </>
    );
  }
);
TimelineTextLayers.displayName = 'TimelineTextLayers';

function transformText(text: string, transform?: string): string {
  if (!text) return '';
  if (transform === 'uppercase') return text.toUpperCase();
  if (transform === 'lowercase') return text.toLowerCase();
  if (transform === 'capitalize') {
    return text.replace(/\b\w/g, char => char.toUpperCase());
  }
  return text;
}

function resolveMediaSrc(rawSrc: string | undefined): string {
  if (!rawSrc) return '';
  const isDirectUrl =
    rawSrc.startsWith('http://') ||
    rawSrc.startsWith('https://') ||
    rawSrc.startsWith('blob:') ||
    rawSrc.startsWith('data:') ||
    rawSrc.startsWith('/');
  return isDirectUrl ? rawSrc : staticFile(rawSrc);
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

  // Automated Micro-Envelope (15ms zero-crossing) & Frame-Locked Volume Ducking
  const baseVolume = volume;

  const isUrl =
    videoPath &&
    (videoPath.startsWith('http') || videoPath.startsWith('blob:'));
  const videoSrc = videoPath ? (isUrl ? videoPath : staticFile(videoPath)) : '';
  const resolvedBleepAudioSrc = useMemo(
    () => resolveMediaSrc(bleepAudioSrc),
    [bleepAudioSrc]
  );

  // Pre-index contiguous video segments and frame windows once per clip edit
  const segmentIndex = useMemo(
    () => createTimelineSegmentIndex(timelineVideoItems, fps),
    [timelineVideoItems, fps]
  );

  // Normalize/merge censored intervals once and anchor ducking + bleeps to MainVideo coordinates
  const censoredAudioIndex = useMemo(
    () => createCensoredAudioIndex(censoredSegments, fps),
    [censoredSegments, fps]
  );
  const defaultSegmentVolume = useMemo(
    () => censoredAudioIndex.createSegmentVolume(baseVolume, 0),
    [censoredAudioIndex, baseVolume]
  );
  const segmentVolumes = useMemo(
    () =>
      segmentIndex.windows.map(({ window }) =>
        censoredAudioIndex.createSegmentVolume(baseVolume, window.startFrame)
      ),
    [segmentIndex, censoredAudioIndex, baseVolume]
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

  const framingIndex = useMemo(
    () =>
      createTimelineFramingIndex({
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
        {videoPath && !isRendering && (
          <TimelineFrameRetention
            videoSrc={videoSrc}
            width={CONTAINER_W}
            height={CONTAINER_H}
            fps={fps}
            timelineVideoItems={segmentIndex.coalesced}
            segmentIndex={segmentIndex}
          >
            {segmentIndex.coalesced.length > 0 ? (
              segmentIndex.windows.map(({ segment, window }, idx) => (
                <PreviewVideoSegmentSlot
                  key={segment.id ?? `seg-${idx}`}
                  segmentId={segment.id ?? idx}
                  startFrame={window.startFrame}
                  endFrame={window.endFrame}
                  durationFrames={window.durationFrames}
                  mediaStartFrame={window.mediaStartFrame}
                  fps={fps}
                  videoSrc={videoSrc}
                  frameVolume={segmentVolumes[idx] ?? defaultSegmentVolume}
                  CONTAINER_W={CONTAINER_W}
                  CONTAINER_H={CONTAINER_H}
                  PANEL_H={PANEL_H}
                  isLandscape={isLandscape}
                  landscapeBackground={landscapeBackground}
                  landscapeBlurRadius={landscapeBlurRadius}
                  landscapeDarkness={landscapeDarkness}
                  videoDisplayW={videoDisplayW}
                  videoDisplayH={videoDisplayH}
                  rawSourceW={rawSourceW}
                  sourceHeight={sourceHeight}
                  framingIndex={framingIndex}
                />
              ))
            ) : (
              <AbsoluteFill style={Z_INDEX_1_OVERFLOW_HIDDEN_STYLE}>
                <CanvasVideoCompositor
                  videoSrc={videoSrc}
                  volume={defaultSegmentVolume}
                  fps={fps}
                  CONTAINER_W={CONTAINER_W}
                  CONTAINER_H={CONTAINER_H}
                  PANEL_H={PANEL_H}
                  isLandscape={isLandscape}
                  landscapeBackground={landscapeBackground}
                  landscapeBlurRadius={landscapeBlurRadius}
                  landscapeDarkness={landscapeDarkness}
                  videoDisplayW={videoDisplayW}
                  videoDisplayH={videoDisplayH}
                  rawSourceW={rawSourceW}
                  sourceHeight={sourceHeight}
                  framingIndex={framingIndex}
                  isActive={true}
                />
              </AbsoluteFill>
            )}
          </TimelineFrameRetention>
        )}

        {videoPath &&
          isRendering &&
          (segmentIndex.coalesced.length > 0 ? (
            segmentIndex.windows.map(({ segment, window }, idx) => (
              <Sequence
                key={segment.id ?? `seg-${idx}`}
                from={window.startFrame}
                durationInFrames={window.durationFrames}
                name={`VideoSegment-${segment.id ?? idx}`}
              >
                <HeadlessMediaViewports
                  videoSrc={videoSrc}
                  frameVolume={segmentVolumes[idx] ?? defaultSegmentVolume}
                  mediaStartFrame={window.mediaStartFrame}
                  durationFrames={window.durationFrames}
                  fps={fps}
                  segmentIndex={segmentIndex}
                  framingIndex={framingIndex}
                  isLandscape={isLandscape}
                  landscapeBackground={landscapeBackground}
                  landscapeBlurRadius={landscapeBlurRadius}
                  landscapeDarkness={landscapeDarkness}
                  CONTAINER_W={CONTAINER_W}
                  CONTAINER_H={CONTAINER_H}
                  PANEL_H={PANEL_H}
                  videoDisplayW={videoDisplayW}
                  videoDisplayH={videoDisplayH}
                  rawSourceW={rawSourceW}
                  sourceHeight={sourceHeight}
                />
              </Sequence>
            ))
          ) : (
            <HeadlessMediaViewports
              videoSrc={videoSrc}
              frameVolume={defaultSegmentVolume}
              fps={fps}
              segmentIndex={segmentIndex}
              framingIndex={framingIndex}
              isLandscape={isLandscape}
              landscapeBackground={landscapeBackground}
              landscapeBlurRadius={landscapeBlurRadius}
              landscapeDarkness={landscapeDarkness}
              CONTAINER_W={CONTAINER_W}
              CONTAINER_H={CONTAINER_H}
              PANEL_H={PANEL_H}
              videoDisplayW={videoDisplayW}
              videoDisplayH={videoDisplayH}
              rawSourceW={rawSourceW}
              sourceHeight={sourceHeight}
            />
          ))}

        {/* Subtitles layer */}
        {!hideSubtitles && (
          <AdaptiveSubtitleLayer
            segmentIndex={segmentIndex}
            framingIndex={framingIndex}
            autoAdaptiveSubtitles={autoAdaptiveSubtitles}
            position={position}
            subtitleOffset={subtitleOffset}
            words={words}
            wordTimings={wordTimings}
            showDebug={showDebug}
            subtitleStyle={subtitleStyle}
          />
        )}

        {/* Timeline Text layers (ordered bottom-to-top so upper tracks paint above lower tracks) */}
        {timelineTextItems.length > 0 && (
          <TimelineTextLayers timelineTextItems={timelineTextItems} fps={fps} />
        )}

        {/* Frame-Locked Censorship Bleep Audio Layers */}
        {resolvedBleepAudioSrc &&
          censoredAudioIndex.bleepWindows.map((win, idx) => (
            <Sequence
              key={`bleep-${idx}-${win.startFrame}`}
              from={win.startFrame}
              durationInFrames={win.durationFrames}
              name={`Bleep-${idx}`}
            >
              <Audio src={resolvedBleepAudioSrc} loop volume={1} />
            </Sequence>
          ))}
      </Sequence>

      {/* Global Span Timeline Audio layers */}
      {timelineAudioItems.map(item => {
        const resolvedAudioSrc = resolveMediaSrc(item.src || '');
        return (
          <Sequence
            key={item.id}
            from={Math.round(item.start * fps)}
            durationInFrames={Math.round(item.duration * fps)}
            name={`Audio-${item.name}`}
          >
            <Audio
              src={resolvedAudioSrc}
              volume={item.volume ?? 1}
              startFrom={Math.round((item.mediaStart || 0) * fps)}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
