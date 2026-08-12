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
export type TextBackground = 'none' | 'box' | 'blur';

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
  wordSpacing?: number;
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
  thumbnailXOffset?: number;
}

// Default subtitle style
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Montserrat',
  fontSize: 50,
  fontWeight: 900,
  color: '#FFFFFF',
  highlightColor: '#CFFF50',
  strokeColor: '#000000',
  strokeWidth: 0,
  textTransform: 'uppercase',
  animation: 'pop',
  highlightMode: 'color',
  background: 'none',
  backgroundOpacity: 0.7,
  wordSpacing: 0,
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
    name: 'Hormozi Bold',
    icon: '🎙️',
    style: {
      fontFamily: 'Montserrat',
      fontSize: 50,
      fontWeight: 900,
      color: '#FFFFFF',
      highlightColor: '#CFFF50',
      strokeColor: '#000000',
      strokeWidth: 0,
      textTransform: 'uppercase',
      animation: 'pop',
      highlightMode: 'color',
      background: 'none',
      backgroundOpacity: 0.7,
    }
  },
  {
    id: 'clean-vlog',
    name: 'Minimal Glass',
    icon: '✨',
    style: {
      fontFamily: 'Outfit',
      fontSize: 50,
      fontWeight: 700,
      color: '#FFFFFF',
      highlightColor: '#A78BFA',
      strokeColor: '#000000',
      strokeWidth: 0,
      textTransform: 'capitalize',
      animation: 'karaoke',
      highlightMode: 'scale',
      background: 'blur',
      backgroundOpacity: 0.6,
    }
  },
  {
    id: 'street',
    name: 'Urban Street',
    icon: '🔥',
    style: {
      fontFamily: 'Outfit',
      fontSize: 50,
      fontWeight: 900,
      color: '#FFFFFF',
      highlightColor: '#E2F952',
      strokeColor: '#000000',
      strokeWidth: 3,
      textTransform: 'uppercase',
      animation: 'pop',
      highlightMode: 'color',
      background: 'none',
      backgroundOpacity: 0.8,
    }
  },
  {
    id: 'documentary',
    name: 'Cinematic Docu',
    icon: '🎬',
    style: {
      fontFamily: 'Noto Sans',
      fontSize: 50,
      fontWeight: 600,
      color: '#FFFBEB',
      highlightColor: '#F59E0B',
      strokeColor: '#000000',
      strokeWidth: 2,
      textTransform: 'capitalize',
      animation: 'typewriter',
      highlightMode: 'underline',
      background: 'none',
      backgroundOpacity: 0.7,
    }
  },
  {
    id: 'karaoke',
    name: 'Rhythm Karaoke',
    icon: '🎤',
    style: {
      fontFamily: 'Oswald',
      fontSize: 50,
      fontWeight: 700,
      color: '#F1F5F9',
      highlightColor: '#FFD700',
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
    id: 'minimal',
    name: 'Modern Vlog',
    icon: '📹',
    style: {
      fontFamily: 'Poppins',
      fontSize: 50,
      fontWeight: 700,
      color: '#FFFFFF',
      highlightColor: '#38BDF8',
      strokeColor: '#000000',
      strokeWidth: 3,
      textTransform: 'capitalize',
      animation: 'slide-up',
      highlightMode: 'scale',
      background: 'none',
      backgroundOpacity: 0.5,
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

