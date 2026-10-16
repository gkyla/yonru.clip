/**
 * Render Spec & Stream State Types
 * Canonical types for the deep render export pipeline.
 */

import type { TimelineTrack, CoverConfig } from './clipper';

export interface RenderSafetyConfig {
  audioBleepEnabled?: boolean;
  audioBleepSource?: 'mute' | 'custom';
  customBleepFile?: { name: string; data: string } | null;
  censoredSegments?: Array<Record<string, unknown>>;
  bleepPaddingOffset?: number;
  bleepMode?: 'full' | 'partial_end';
  safetySensitivity?: string;
  maskingStyle?: string;
}

export interface RenderSpec {
  jobId: string;
  hookIndex?: number;
  outputName?: string;
  volume?: number;
  fps?: number;
  videoLayout?: 'vertical' | 'landscape';
  landscapeBackground?: 'black' | 'blur';
  landscapeBlurRadius?: number;
  landscapeDarkness?: number;
  cropMode?: string;
  cropPercentX?: number;
  splitZoomTop?: number;
  splitZoomBottom?: number;
  splitOffsetXTop?: number;
  splitOffsetYTop?: number;
  splitOffsetXBottom?: number;
  splitOffsetYBottom?: number;
  subtitlesEnabled?: boolean;
  subtitlePayload?: Record<string, unknown>;
  timelineTracks?: TimelineTrack[];
  transcript?: Array<{
    start: number | string;
    duration: number | string;
    text: string;
  }>;
  cover?: CoverConfig;
  safety?: RenderSafetyConfig;
}

export interface RenderStreamState {
  progress: number;
  stage: string;
  eta: number;
  status: string;
  outputUrl: string | null;
  videoUrl?: string | null;
  jobError: string;
  frame?: number;
  totalFrames?: number;
}
