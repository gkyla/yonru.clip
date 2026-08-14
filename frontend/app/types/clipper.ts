export type HookIntentPreset = 'auto' | 'humor' | 'educational' | 'storytelling' | 'debate'
export type HookExtractionMode = 'preset' | 'custom'

export interface Hook {
  id?: string
  _id?: string
  theme: string
  title?: string
  start: number
  end: number
  duration?: number
  transcript_quote?: string
  originalStart?: number
  originalEnd?: number
  thumbnail_url?: string
  virality_score?: number
  virality_reason?: string
}

export interface CachedVideo {
  video_id: string
  title: string
  duration: number
  folder_name: string
  has_heatmap?: boolean
  fps?: number
  asset_url?: string
  thumbnail?: string
  thumbnail_url?: string
}

export interface ThumbnailTextOverlay {
  id: string
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  color: string
  x: number
  y: number
  rotation?: number
  textTransform?: string
  showStroke?: boolean
  strokeColor?: string
  strokeWidth?: number
  showBackground?: boolean
  backgroundColor?: string
  backgroundOpacity?: number
  backgroundPadding?: number
}

export interface TimelineTrackItem {
  id: string
  name?: string
  start: number
  mediaStart?: number
  duration: number
  content?: string
  font?: string
  fontSize?: number
  fontWeight?: string | number
  textTransform?: string
  align?: 'left' | 'center' | 'right'
  color?: string
  opacity?: number
  strokeColor?: string
  strokeWidth?: number
  showStroke?: boolean
  showBackground?: boolean
  backgroundColor?: string
  backgroundOpacity?: number
  letterSpacing?: number
  wordSpacing?: number
  lineHeight?: number
  shadowBlur?: number
  shadowColor?: string
  shadowOpacity?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  linkToGlobal?: boolean
  x?: number
  y?: number
  src?: string | ArrayBuffer | null
  type?: 'video' | 'audio' | 'text'
}

export interface TimelineTrack {
  id: 'video' | 'audio' | 'text' | 'subtitle'
  name: string
  type: 'video' | 'audio' | 'text' | 'subtitle'
  items: TimelineTrackItem[]
}

export interface TranscriptWord {
  text: string
  start: number
  duration: number
  end?: number
}

export interface TranscriptSegment {
  id?: string
  text: string
  start: number
  duration: number
  words?: TranscriptWord[]
}

export interface DeepAuditResult {
  riskLevel: string
  violations: string[]
  suggestions: string
}

export interface PromptTemplate {
  id: string
  name: string
  suitableFor: string[]
  prompt?: string
  numHooks?: number
  autoHooks?: boolean
}

export interface HistorySnapshot {
  tracks: TimelineTrack[]
  transcript: TranscriptSegment[]
  selectedId: string | null
}

export interface SubtitleStyleSettings {
  videoLayout?: 'vertical' | 'landscape'
  subtitlePosition?: string
  subtitleOffset?: number
  subtitleSyncOffset?: number
  font?: string
  fontSize?: number
  cropMode?: string
  cropMap?: Array<{ time: number, x: number }>
  cropPercentX?: number
  subtitleMode?: 'word' | '3_words' | '4_words'
  subtitleAnimation?: string
  subtitleHighlightMode?: string
  subtitleHighlightColor?: string
  subtitleTextColor?: string
  subtitleStrokeColor?: string
  subtitleStrokeWidth?: number
  subtitleFontWeight?: number
  subtitleTextTransform?: string
  subtitleBackground?: string
  subtitleBackgroundOpacity?: number
  subtitleWordSpacing?: number
  volume?: number
  subtitlePreset?: string
}

export interface WhisperModelOption {
  id: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3'
  name: string
  speed: string
  acc: string
  desc: string
}

export interface ReadyClip {
  folder_name: string
  clip_id: string
  title?: string
  duration?: number
  created_at?: string
  video_id?: string
  theme?: string
  start_time?: number
  end_time?: number
  asset_url?: string
}

export interface ThumbnailConfig {
  enabled?: boolean
  duration?: number
  screenshotTime?: number
  textOverlays?: ThumbnailTextOverlay[]
  xOffset?: number
}

export interface JobApiResponse {
  job_id?: string
  status: string
  folder_name?: string
  fps?: number
  error?: string
  download_percent?: number
  video?: {
    title?: string
    duration?: number
    fps?: number
    has_heatmap?: boolean
    asset_url?: string
    folder_name?: string
    hd_ready?: boolean
    has_preview?: boolean
  }
  clip?: {
    asset_url?: string
    duration?: number
    transcript?: TranscriptSegment[]
    theme?: string
    start?: number
    end?: number
    transcript_quote?: string
  }
  hooks?: Hook[]
  history?: {
    undo_stack?: HistorySnapshot[]
    redo_stack?: HistorySnapshot[]
  }
}

export type DefaultThumbnailStyle = Partial<ThumbnailTextOverlay> & { thumbnailDuration?: number }



