/** @jsxImportSource react */
import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import {
  DEFAULT_SUBTITLE_STYLE,
  type SubtitleWord,
  type SubtitleStyle,
  type AnimationType
} from './types';
import {
  createSubtitleChunkIndex,
  type IndexedSubtitleChunk,
  type SubtitleChunkIndex
} from './TimelineFramingIndex';
import { getFont } from './fonts';
import './fonts.css';

export interface AnimatedSubtitlesProps {
  words: SubtitleWord[];
  wordTimings?: SubtitleWord[];
  subtitleIndex?: SubtitleChunkIndex;
  showDebug?: boolean;
  style?: SubtitleStyle;
}

export const AnimatedSubtitles: React.FC<AnimatedSubtitlesProps> = ({
  words = [],
  wordTimings = [],
  subtitleIndex,
  showDebug,
  style: styleProp
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const activeIndex = useMemo(
    () => subtitleIndex ?? createSubtitleChunkIndex(words, wordTimings),
    [subtitleIndex, words, wordTimings]
  );

  const { s, baseTextStyle, bgStyle } = useMemo(() => {
    const merged: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE, ...styleProp };
    const fontFamily = getFont(merged.fontFamily);
    const textStyle: React.CSSProperties = {
      fontFamily,
      fontSize: `${merged.fontSize}px`,
      fontWeight: merged.fontWeight,
      color: merged.color,
      paintOrder: merged.strokeWidth > 0 ? 'stroke fill' : undefined,
      WebkitTextStroke:
        merged.strokeWidth > 0
          ? `${merged.strokeWidth * 2}px ${merged.strokeColor}`
          : undefined,
      textShadow:
        merged.strokeWidth > 0
          ? `-${merged.strokeWidth}px -${merged.strokeWidth}px 0 ${merged.strokeColor}, ${merged.strokeWidth}px -${merged.strokeWidth}px 0 ${merged.strokeColor}, -${merged.strokeWidth}px ${merged.strokeWidth}px 0 ${merged.strokeColor}, ${merged.strokeWidth}px ${merged.strokeWidth}px 0 ${merged.strokeColor}, 0 10px 20px rgba(0,0,0,0.8)`
          : `0 10px 20px rgba(0,0,0,0.8)`,
      textTransform: merged.textTransform,
      wordSpacing: merged.wordSpacing ? `${merged.wordSpacing}px` : undefined,
      lineHeight: 1.1,
      textAlign: 'center' as const,
      maxWidth: '900px',
      wordBreak: 'break-word' as const
    };

    return {
      s: merged,
      baseTextStyle: textStyle,
      bgStyle: getBackgroundStyle(merged)
    };
  }, [styleProp]);

  const activeEntry = activeIndex.findActiveChunk(currentTime);

  if (!activeEntry) {
    const firstWord = words[0] ?? activeIndex.firstChunk;
    const wordCount = words.length || activeIndex.length;
    if (showDebug && firstWord) {
      return (
        <div
          style={{
            color: 'yellow',
            fontSize: '30px',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            position: 'absolute',
            top: '10%',
            padding: '20px'
          }}
        >
          Debug: Found {wordCount} words. Time: {currentTime.toFixed(2)}s.
          First: {firstWord.word} ({firstWord.start.toFixed(2)}-
          {firstWord.end.toFixed(2)})
        </div>
      );
    }
    if (showDebug && wordCount === 0) {
      return (
        <div
          style={{
            color: 'red',
            fontSize: '30px',
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
            position: 'absolute',
            top: '10%',
            padding: '20px'
          }}
        >
          Debug: NO WORDS RECEIVED.
        </div>
      );
    }
    return null;
  }

  // Delegate to animation renderer
  const content = renderAnimation(
    s.animation,
    activeEntry,
    s,
    baseTextStyle,
    frame,
    fps,
    currentTime
  );

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        width: '100%'
      }}
    >
      <div style={bgStyle}>{content}</div>
    </div>
  );
};

// --- Background Styles ---
function getBackgroundStyle(s: SubtitleStyle): React.CSSProperties {
  switch (s.background) {
    case 'box':
      return {
        background: `rgba(0,0,0,${s.backgroundOpacity})`,
        borderRadius: '16px',
        padding: '16px 32px'
      };
    case 'blur':
      return {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: `rgba(0,0,0,${s.backgroundOpacity * 0.4})`,
        borderRadius: '20px',
        padding: '16px 32px',
        border: '1px solid rgba(255,255,255,0.1)'
      };
    default:
      return {};
  }
}

// --- Animation Router ---
function renderAnimation(
  animation: AnimationType,
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  baseStyle: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number
): React.ReactElement {
  switch (animation) {
    case 'pop':
      return renderPop(activeEntry, s, baseStyle, frame, fps, currentTime);
    case 'slide-up':
      return renderSlideUp(activeEntry, s, baseStyle, frame, fps, currentTime);
    case 'fade':
      return renderFade(activeEntry, s, baseStyle, frame, fps, currentTime);
    case 'bounce':
      return renderBounce(activeEntry, s, baseStyle, frame, fps, currentTime);
    case 'typewriter':
      return renderTypewriter(
        activeEntry,
        s,
        baseStyle,
        frame,
        fps,
        currentTime
      );
    case 'karaoke':
      return renderKaraoke(activeEntry, s, baseStyle, frame, fps, currentTime);
    case 'none':
    default:
      return (
        <span style={{ ...baseStyle, display: 'inline-block' }}>
          {renderChunkTextWithHighlight(activeEntry, s, currentTime)}
        </span>
      );
  }
}

// --- HIGHLIGHT UTILITY FOR CHUNKS ---
function renderChunkTextWithHighlight(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  currentTime: number,
  options?: { dimPast?: boolean }
) {
  const activeChunk = activeEntry.chunk;
  if (s.highlightMode === 'none' || !s.highlightMode) {
    return activeChunk.word;
  }

  const chunkWords = activeEntry.words;
  const dimPast = options?.dimPast ?? false;

  return (
    <>
      {chunkWords.map((w, i) => {
        const isActive = currentTime >= w.start && currentTime <= w.end;
        const isPast = currentTime > w.end;

        const wordStyle: React.CSSProperties = {
          display: 'inline',
          position: 'relative'
        };

        if (isActive) {
          switch (s.highlightMode) {
            case 'color':
              wordStyle.color = s.highlightColor;
              wordStyle.transform = 'scale(1.08)';
              wordStyle.display = 'inline-block';
              break;
            case 'scale':
              wordStyle.transform = 'scale(1.15)';
              wordStyle.display = 'inline-block';
              break;
            case 'underline':
              wordStyle.display = 'inline-block';
              break;
            case 'box':
              wordStyle.background = s.highlightColor;
              wordStyle.color = '#000';
              wordStyle.borderRadius = '8px';
              wordStyle.padding = '2px 8px';
              wordStyle.WebkitTextStroke = 'none';
              wordStyle.display = 'inline-block';
              break;
          }
        } else if (isPast && dimPast) {
          wordStyle.opacity = 0.5;
        }

        return (
          <React.Fragment key={i}>
            <span style={wordStyle}>
              {w.word}
              {s.highlightMode === 'underline' && isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '2px',
                    right: '2px',
                    height: '5px',
                    borderRadius: '9999px',
                    backgroundColor: s.highlightColor,
                    boxShadow: `0 0 8px ${s.highlightColor}66`,
                    display: 'block'
                  }}
                />
              )}
            </span>
            {i < chunkWords.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </>
  );
}

// --- POP (Elastic Spring Pop) ---
function renderPop(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number
) {
  const startFrame = activeEntry.chunk.start * fps;
  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 14, stiffness: 180, mass: 0.6 },
    durationInFrames: 14
  });

  const scale = interpolate(progress, [0, 0.7, 1], [0.6, 1.12, 1]);
  const opacity = interpolate(progress, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp'
  });
  const rotate = interpolate(progress, [0, 0.5, 1], [-1.5, 0.8, 0]);

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        opacity
      }}
    >
      {renderChunkTextWithHighlight(activeEntry, s, currentTime)}
    </span>
  );
}

// --- SLIDE UP ---
function renderSlideUp(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number
) {
  const startFrame = activeEntry.chunk.start * fps;
  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 15
  });

  const translateY = interpolate(progress, [0, 1], [60, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        transform: `translateY(${translateY}px)`,
        opacity
      }}
    >
      {renderChunkTextWithHighlight(activeEntry, s, currentTime)}
    </span>
  );
}

// --- FADE ---
function renderFade(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number
) {
  const startFrame = activeEntry.chunk.start * fps;
  const endFrame = activeEntry.chunk.end * fps;
  const duration = endFrame - startFrame;
  const localFrame = frame - startFrame;

  const opacity = interpolate(
    localFrame,
    [
      0,
      Math.min(6, duration * 0.2),
      Math.max(duration - 6, duration * 0.8),
      duration
    ],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        opacity
      }}
    >
      {renderChunkTextWithHighlight(activeEntry, s, currentTime)}
    </span>
  );
}

// --- BOUNCE (Elastic Spring Dynamic Pop) ---
function renderBounce(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number
) {
  const startFrame = activeEntry.chunk.start * fps;
  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 11, stiffness: 200, mass: 0.5 },
    durationInFrames: 15
  });

  const scale = interpolate(progress, [0, 0.6, 0.85, 1], [0.5, 1.18, 0.96, 1]);
  const opacity = interpolate(progress, [0, 0.25], [0, 1], {
    extrapolateRight: 'clamp'
  });

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        transform: `scale(${scale})`,
        opacity
      }}
    >
      {renderChunkTextWithHighlight(activeEntry, s, currentTime)}
    </span>
  );
}

// --- TYPEWRITER (Word Wave Reveal) ---
function renderTypewriter(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime?: number
) {
  const chunkWords = activeEntry.words;

  return (
    <span style={{ ...style, display: 'inline-block' }}>
      {chunkWords.map((w, i) => {
        const wordStartFrame = w.start * fps;
        const wordProgress = spring({
          fps,
          frame: frame - wordStartFrame,
          config: { damping: 16, stiffness: 160, mass: 0.6 },
          durationInFrames: 10
        });
        const wordOpacity = interpolate(wordProgress, [0, 1], [0, 1]);
        const wordTranslateY = interpolate(wordProgress, [0, 1], [12, 0]);
        const isActive =
          (currentTime ?? 0) >= w.start && (currentTime ?? 0) <= w.end;

        const wordStyle: React.CSSProperties = {
          display: 'inline-block',
          opacity: wordOpacity,
          transform: `translateY(${wordTranslateY}px)`,
          position: 'relative'
        };

        if (isActive) {
          switch (s.highlightMode) {
            case 'color':
              wordStyle.color = s.highlightColor;
              wordStyle.transform = `translateY(${wordTranslateY}px) scale(1.08)`;
              break;
            case 'scale':
              wordStyle.transform = `translateY(${wordTranslateY}px) scale(1.15)`;
              break;
            case 'box':
              wordStyle.background = s.highlightColor;
              wordStyle.color = '#000';
              wordStyle.borderRadius = '8px';
              wordStyle.padding = '2px 8px';
              wordStyle.WebkitTextStroke = 'none';
              break;
          }
        }

        return (
          <React.Fragment key={i}>
            <span style={wordStyle}>
              {w.word}
              {s.highlightMode === 'underline' && isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    left: '2px',
                    right: '2px',
                    height: '5px',
                    borderRadius: '9999px',
                    backgroundColor: s.highlightColor,
                    boxShadow: `0 0 8px ${s.highlightColor}66`,
                    display: 'block'
                  }}
                />
              )}
            </span>
            {i < chunkWords.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </span>
  );
}

// --- KARAOKE ---
function renderKaraoke(
  activeEntry: IndexedSubtitleChunk,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number
) {
  // Entry animation for the whole chunk
  const chunkStartFrame = activeEntry.chunk.start * fps;
  const entryProgress = spring({
    fps,
    frame: frame - chunkStartFrame,
    config: { damping: 16, stiffness: 150, mass: 0.6 },
    durationInFrames: 12
  });
  const chunkOpacity = interpolate(entryProgress, [0, 1], [0, 1]);
  const chunkScale = interpolate(entryProgress, [0, 1], [0.9, 1]);

  return (
    <span
      style={{
        ...style,
        display: 'inline-block',
        transform: `scale(${chunkScale})`,
        opacity: chunkOpacity
      }}
    >
      {renderChunkTextWithHighlight(activeEntry, s, currentTime, {
        dimPast: true
      })}
    </span>
  );
}
