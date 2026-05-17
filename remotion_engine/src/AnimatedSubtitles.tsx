import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { SubtitleWord, SubtitleStyle, DEFAULT_SUBTITLE_STYLE, AnimationType } from './types';
import { getFont } from './fonts';
import './fonts.css';

interface AnimatedSubtitlesProps {
  words: SubtitleWord[];
  wordTimings?: SubtitleWord[];
  showDebug?: boolean;
  style?: SubtitleStyle;
}

export const AnimatedSubtitles: React.FC<AnimatedSubtitlesProps> = ({
  words,
  wordTimings,
  showDebug,
  style: styleProp
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const s = { ...DEFAULT_SUBTITLE_STYLE, ...styleProp };
  const fontFamily = getFont(s.fontFamily);


  // Find currently active chunk
  const activeWord = words.find(w => currentTime >= w.start && currentTime <= w.end);

  if (!activeWord) {
    if (showDebug && words.length > 0) {
      return (
        <div style={{ color: 'yellow', fontSize: '30px', background: 'rgba(0,0,0,0.5)', zIndex: 100, position: 'absolute', top: '10%', padding: '20px' }}>
          Debug: Found {words.length} words. Time: {currentTime.toFixed(2)}s.
          First: {words[0].word} ({words[0].start.toFixed(2)}-{words[0].end.toFixed(2)})
        </div>
      );
    }
    if (showDebug && words.length === 0) {
      return (
        <div style={{ color: 'red', fontSize: '30px', background: 'rgba(0,0,0,0.5)', zIndex: 100, position: 'absolute', top: '10%', padding: '20px' }}>
          Debug: NO WORDS RECEIVED.
        </div>
      );
    }
    return null;
  }

  // Base text style
  const baseTextStyle: React.CSSProperties = {
    fontFamily,
    fontSize: `${s.fontSize}px`,
    fontWeight: s.fontWeight,
    color: s.color,
    WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.strokeColor}` : undefined,
    textShadow: s.strokeWidth > 0 
      ? `-${s.strokeWidth}px -${s.strokeWidth}px 0 ${s.strokeColor}, ${s.strokeWidth}px -${s.strokeWidth}px 0 ${s.strokeColor}, -${s.strokeWidth}px ${s.strokeWidth}px 0 ${s.strokeColor}, ${s.strokeWidth}px ${s.strokeWidth}px 0 ${s.strokeColor}, 0 10px 20px rgba(0,0,0,0.8)`
      : `0 10px 20px rgba(0,0,0,0.8)`,
    textTransform: s.textTransform,
    lineHeight: 1.1,
    textAlign: 'center' as const,
    maxWidth: '900px',
    wordBreak: 'break-word' as const,
  };

  // Background wrapper
  const bgStyle = getBackgroundStyle(s);

  // Delegate to animation renderer
  const content = renderAnimation(s.animation, activeWord, wordTimings, s, baseTextStyle, frame, fps, currentTime);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px',
      width: '100%',
    }}>
      <div style={bgStyle}>
        {content}
      </div>
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
        padding: '16px 32px',
      };
    case 'gradient':
      return {
        background: `linear-gradient(180deg, transparent, rgba(0,0,0,${s.backgroundOpacity}))`,
        borderRadius: '16px',
        padding: '16px 32px',
      };
    case 'blur':
      return {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        background: `rgba(0,0,0,${s.backgroundOpacity * 0.4})`,
        borderRadius: '20px',
        padding: '16px 32px',
        border: '1px solid rgba(255,255,255,0.1)',
      };
    default:
      return {};
  }
}

// --- Animation Router ---
function renderAnimation(
  animation: AnimationType,
  activeWord: SubtitleWord,
  wordTimings: SubtitleWord[] | undefined,
  s: SubtitleStyle,
  baseStyle: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number,
): React.ReactElement {
  switch (animation) {
    case 'pop':
      return renderPop(activeWord, s, baseStyle, frame, fps, wordTimings, currentTime);
    case 'slide-up':
      return renderSlideUp(activeWord, s, baseStyle, frame, fps, wordTimings, currentTime);
    case 'fade':
      return renderFade(activeWord, s, baseStyle, frame, fps, wordTimings, currentTime);
    case 'bounce':
      return renderBounce(activeWord, s, baseStyle, frame, fps, wordTimings, currentTime);
    case 'typewriter':
      return renderTypewriter(activeWord, s, baseStyle, frame, fps);
    case 'karaoke':
      return renderKaraoke(activeWord, wordTimings, s, baseStyle, frame, fps, currentTime);
    case 'none':
    default:
      return (
        <span style={{ ...baseStyle, display: 'inline-block' }}>
          {renderChunkTextWithHighlight(activeWord, wordTimings, s, currentTime)}
        </span>
      );
  }
}

// --- HIGHLIGHT UTILITY FOR CHUNKS ---
function renderChunkTextWithHighlight(
  activeChunk: SubtitleWord,
  wordTimings: SubtitleWord[] | undefined,
  s: SubtitleStyle,
  currentTime: number,
  options?: { dimPast?: boolean }
) {
  if (s.highlightMode === 'none' || !s.highlightMode) {
    return activeChunk.word;
  }

  // Find per-word timings within this chunk's time range
  const chunkWords = wordTimings?.filter(
    w => w.start >= activeChunk.start - 0.05 && w.end <= activeChunk.end + 0.05
  ) || [];

  // Fallback: split chunk text into individual words with evenly distributed timing
  if (chunkWords.length === 0) {
    const splitWords = activeChunk.word.split(/\s+/);
    const chunkDuration = activeChunk.end - activeChunk.start;
    const wordDur = chunkDuration / splitWords.length;
    splitWords.forEach((w, i) => {
      chunkWords.push({
        word: w,
        start: activeChunk.start + i * wordDur,
        end: activeChunk.start + (i + 1) * wordDur,
      });
    });
  }

  const dimPast = options?.dimPast ?? false;

  return (
    <>
      {chunkWords.map((w, i) => {
        const isActive = currentTime >= w.start && currentTime <= w.end;
        const isPast = currentTime > w.end;

        let wordStyle: React.CSSProperties = { display: 'inline', transition: 'all 0.1s' };

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
              wordStyle.borderBottom = `4px solid ${s.highlightColor}`;
              wordStyle.paddingBottom = '4px';
              break;
            case 'box':
              wordStyle.background = s.highlightColor;
              wordStyle.color = '#000';
              wordStyle.borderRadius = '8px';
              wordStyle.padding = '2px 8px';
              wordStyle.WebkitTextStroke = 'none';
              break;
          }
        } else if (isPast && dimPast) {
          wordStyle.opacity = 0.5;
        }

        return (
          <React.Fragment key={i}>
            <span style={wordStyle}>{w.word}</span>
            {i < chunkWords.length - 1 && ' '}
          </React.Fragment>
        );
      })}
    </>
  );
}

// --- POP (Enhanced) ---
function renderPop(
  word: SubtitleWord,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  wordTimings: SubtitleWord[] | undefined,
  currentTime: number
) {
  const startFrame = word.start * fps;
  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 12, stiffness: 200, mass: 0.5 },
    durationInFrames: 12,
  });

  const scale = interpolate(progress, [0, 1], [0.7, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const rotate = interpolate(progress, [0, 0.5, 1], [-2, 1, 0]);

  return (
    <span style={{
      ...style,
      display: 'inline-block',
      transform: `scale(${scale}) rotate(${rotate}deg)`,
      opacity,
    }}>
      {renderChunkTextWithHighlight(word, wordTimings, s, currentTime)}
    </span>
  );
}

// --- SLIDE UP ---
function renderSlideUp(
  word: SubtitleWord,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  wordTimings: SubtitleWord[] | undefined,
  currentTime: number
) {
  const startFrame = word.start * fps;
  const progress = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 15,
  });

  const translateY = interpolate(progress, [0, 1], [60, 0]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  return (
    <span style={{
      ...style,
      display: 'inline-block',
      transform: `translateY(${translateY}px)`,
      opacity,
    }}>
      {renderChunkTextWithHighlight(word, wordTimings, s, currentTime)}
    </span>
  );
}

// --- FADE ---
function renderFade(
  word: SubtitleWord,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  wordTimings: SubtitleWord[] | undefined,
  currentTime: number
) {
  const startFrame = word.start * fps;
  const endFrame = word.end * fps;
  const duration = endFrame - startFrame;
  const localFrame = frame - startFrame;

  const opacity = interpolate(
    localFrame,
    [0, Math.min(6, duration * 0.2), Math.max(duration - 6, duration * 0.8), duration],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <span style={{
      ...style,
      display: 'inline-block',
      opacity,
    }}>
      {renderChunkTextWithHighlight(word, wordTimings, s, currentTime)}
    </span>
  );
}

// --- BOUNCE ---
function renderBounce(
  word: SubtitleWord,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  wordTimings: SubtitleWord[] | undefined,
  currentTime: number
) {
  const startFrame = word.start * fps;
  const drop = spring({
    fps,
    frame: frame - startFrame,
    config: { damping: 8, stiffness: 250, mass: 0.6 },
    durationInFrames: 15,
  });

  const translateY = interpolate(drop, [0, 1], [-120, 0]);
  const scaleX = interpolate(drop, [0, 0.8, 1], [0.8, 1.05, 1]);
  const scaleY = interpolate(drop, [0, 0.8, 1], [1.2, 0.95, 1]);
  const opacity = interpolate(drop, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <span style={{
      ...style,
      display: 'inline-block',
      transform: `translateY(${translateY}px) scaleX(${scaleX}) scaleY(${scaleY})`,
      opacity,
    }}>
      {renderChunkTextWithHighlight(word, wordTimings, s, currentTime)}
    </span>
  );
}

// --- TYPEWRITER ---
function renderTypewriter(word: SubtitleWord, s: SubtitleStyle, style: React.CSSProperties, frame: number, fps: number) {
  const startFrame = word.start * fps;
  const endFrame = word.end * fps;
  const duration = endFrame - startFrame;
  const localFrame = Math.max(0, frame - startFrame);
  
  const text = word.word;
  const typingDuration = Math.min(duration * 0.7, text.length * 2); // 2 frames per char
  const progress = Math.min(1, localFrame / typingDuration);
  const visibleChars = Math.floor(progress * text.length);
  const visibleText = text.substring(0, visibleChars);
  const showCursor = localFrame < typingDuration + 8; // Blink cursor for 8 frames after done

  return (
    <span style={{ ...style, display: 'inline-block', position: 'relative' }}>
      {visibleText}
      {showCursor && (
        <span style={{
          borderRight: `4px solid ${s.highlightColor}`,
          marginLeft: '4px',
          animation: 'none',
          opacity: Math.floor(localFrame / 4) % 2 === 0 ? 1 : 0,
        }}>&nbsp;</span>
      )}
    </span>
  );
}

// --- KARAOKE ---
function renderKaraoke(
  activeChunk: SubtitleWord,
  wordTimings: SubtitleWord[] | undefined,
  s: SubtitleStyle,
  style: React.CSSProperties,
  frame: number,
  fps: number,
  currentTime: number,
) {
  // Entry animation for the whole chunk
  const chunkStartFrame = activeChunk.start * fps;
  const entryProgress = spring({
    fps,
    frame: frame - chunkStartFrame,
    config: { damping: 16, stiffness: 150, mass: 0.6 },
    durationInFrames: 12,
  });
  const chunkOpacity = interpolate(entryProgress, [0, 1], [0, 1]);
  const chunkScale = interpolate(entryProgress, [0, 1], [0.9, 1]);

  return (
    <span style={{
      ...style,
      display: 'inline-block',
      transform: `scale(${chunkScale})`,
      opacity: chunkOpacity,
    }}>
      {renderChunkTextWithHighlight(activeChunk, wordTimings, s, currentTime, { dimPast: true })}
    </span>
  );
}
