export interface SubtitleWord {
  start: number;
  end: number;
  word: string;
}

export interface CropMapEntry {
  time: number;
  x: number;
}

export type AnimationType = 'pop' | 'slide-up' | 'fade' | 'bounce' | 'typewriter' | 'karaoke' | 'none';
export type HighlightMode = 'color' | 'scale' | 'underline' | 'box' | 'none';
export type TextBackground = 'none' | 'box' | 'gradient' | 'blur';

export interface ThumbnailTextOverlay {
  id: string;
  text: string;
  x: number;        // 0-1080
  y: number;        // 0-1920
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  showStroke?: boolean;
  textTransform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  rotation: number;
  showBackground?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
  backgroundPadding?: number;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  textTransform: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  animation: AnimationType;
  highlightMode: HighlightMode;
  background: TextBackground;
  backgroundOpacity: number;
}

export interface YonruClipProps {
  videoPath: string;
  words: SubtitleWord[];
  // For karaoke: individual word timings within each chunk
  wordTimings?: SubtitleWord[];
  cropX: number;
  cropMap?: CropMapEntry[];
  position: 'top' | 'center' | 'bottom';
  subtitleOffset?: number;
  durationInFrames?: number;
  showDebug?: boolean;
  subtitleStyle?: SubtitleStyle;
  timelineTextItems?: any[];
  timelineAudioItems?: any[];
  timelineVideoItems?: any[];
  volume?: number;
  fps?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  hideSubtitles?: boolean;
  // Thumbnail
  thumbnailEnabled?: boolean;
  thumbnailDuration?: number;  // seconds
  thumbnailImagePath?: string;
  thumbnailTextOverlays?: ThumbnailTextOverlay[];
}

// Default subtitle style
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Montserrat',
  fontSize: 100,
  fontWeight: 900,
  color: '#FFFFFF',
  highlightColor: '#CFFF50',
  strokeColor: '#000000',
  strokeWidth: 4,
  textTransform: 'uppercase',
  animation: 'pop',
  highlightMode: 'color',
  background: 'none',
  backgroundOpacity: 0.7,
};

// Style presets
export interface StylePreset {
  id: string;
  name: string;
  icon: string;
  style: SubtitleStyle;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'bold-podcast',
    name: 'Bold Podcast',
    icon: '🎙️',
    style: {
      fontFamily: 'Montserrat',
      fontSize: 100,
      fontWeight: 900,
      color: '#FFFFFF',
      highlightColor: '#FFD700',
      strokeColor: '#000000',
      strokeWidth: 4,
      textTransform: 'uppercase',
      animation: 'pop',
      highlightMode: 'color',
      background: 'none',
      backgroundOpacity: 0.7,
    }
  },
  {
    id: 'clean-vlog',
    name: 'Clean Vlog',
    icon: '📹',
    style: {
      fontFamily: 'Inter',
      fontSize: 80,
      fontWeight: 700,
      color: '#FFFFFF',
      highlightColor: '#60A5FA',
      strokeColor: '#000000',
      strokeWidth: 3,
      textTransform: 'none',
      animation: 'slide-up',
      highlightMode: 'scale',
      background: 'none',
      backgroundOpacity: 0.6,
    }
  },
  {
    id: 'street',
    name: 'Street',
    icon: '🔥',
    style: {
      fontFamily: 'Bebas Neue',
      fontSize: 120,
      fontWeight: 400,
      color: '#FFFFFF',
      highlightColor: '#EF4444',
      strokeColor: '#000000',
      strokeWidth: 5,
      textTransform: 'uppercase',
      animation: 'bounce',
      highlightMode: 'box',
      background: 'none',
      backgroundOpacity: 0.8,
    }
  },
  {
    id: 'minimal',
    name: 'Minimal',
    icon: '✨',
    style: {
      fontFamily: 'Poppins',
      fontSize: 70,
      fontWeight: 600,
      color: '#FFFFFF',
      highlightColor: '#A78BFA',
      strokeColor: '#000000',
      strokeWidth: 2,
      textTransform: 'none',
      animation: 'fade',
      highlightMode: 'none',
      background: 'blur',
      backgroundOpacity: 0.5,
    }
  },
  {
    id: 'karaoke',
    name: 'Karaoke',
    icon: '🎤',
    style: {
      fontFamily: 'Oswald',
      fontSize: 90,
      fontWeight: 700,
      color: '#FFFFFF',
      highlightColor: '#CFFF50',
      strokeColor: '#000000',
      strokeWidth: 4,
      textTransform: 'uppercase',
      animation: 'karaoke',
      highlightMode: 'color',
      background: 'none',
      backgroundOpacity: 0.7,
    }
  },
  {
    id: 'documentary',
    name: 'Documentary',
    icon: '🎬',
    style: {
      fontFamily: 'Noto Sans',
      fontSize: 65,
      fontWeight: 500,
      color: '#FFFFFF',
      highlightColor: '#FCD34D',
      strokeColor: '#000000',
      strokeWidth: 2,
      textTransform: 'none',
      animation: 'typewriter',
      highlightMode: 'underline',
      background: 'box',
      backgroundOpacity: 0.6,
    }
  },
];

// Curated color palette
export const COLOR_PALETTE = [
  '#FFFFFF', // White
  '#CFFF50', // Accent lime
  '#FFD700', // Gold
  '#EF4444', // Red
  '#60A5FA', // Blue
  '#A78BFA', // Purple
  '#34D399', // Emerald
  '#FB923C', // Orange
  '#F472B6', // Pink
  '#000000', // Black
];

