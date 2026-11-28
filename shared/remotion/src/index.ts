import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

try {
  registerRoot(RemotionRoot);
} catch {
  // Ignore if already registered
}

export { RemotionRoot } from './Root';
export { YonruClip } from './Composition';
export {
  CanvasVideoCompositor,
  computeViewportFraming,
  computeLandscapeBlurSpec,
  drawLandscapeBlurFrame
} from './CanvasVideoCompositor';
export type {
  CanvasVideoCompositorProps,
  ViewportFramingParams,
  ViewportFramingResult,
  LandscapeBlurSpec,
  LandscapeBlurSpecParams,
  DrawLandscapeBlurFrameParams,
  DrawLandscapeBlurFrameResult
} from './CanvasVideoCompositor';
export {
  TimelineFrameRetention,
  TimelineFrameRetentionContext,
  useFrameRetention,
  coalesceContiguousVideoSegments,
  getSegmentFrameWindow,
  isMainVideoFrameCovered,
  isInitialDecoderFrameAligned,
  resolveTimelineMediaTime
} from './TimelineFrameRetention';
export type {
  FrameRetentionCallback,
  TimelineFrameRetentionProps,
  TimelineVideoSegmentBounds,
  SegmentFrameWindow,
  InitialDecoderFrameAlignmentParams
} from './TimelineFrameRetention';
export { AnimatedSubtitles } from './AnimatedSubtitles';
export type { AnimatedSubtitlesProps } from './AnimatedSubtitles';
export {
  TimelineFramingIndex,
  CropMapIndex,
  TimelineSegmentIndex,
  SubtitleChunkIndex,
  CensoredAudioIndex,
  createTimelineFramingIndex,
  createCropMapIndex,
  getOrCreateCropMapIndex,
  createTimelineSegmentIndex,
  getOrCreateTimelineSegmentIndex,
  createSubtitleChunkIndex,
  createCensoredAudioIndex,
  mergeCensoredSegments,
  indexTimelineTextLayers
} from './TimelineFramingIndex';
export type {
  IndexedVideoSegment,
  IndexedSubtitleChunk,
  CropSplitWindow,
  CensoredAudioSegment,
  CensoredBleepWindow,
  TimelineTextLayerBounds,
  IndexedTimelineTextLayer
} from './TimelineFramingIndex';
export {
  PreviewMediaContext,
  usePreviewMediaCallbacks
} from './PreviewMediaContext';
export type {
  PreviewMediaCallbacks,
  PreviewMediaMetadata
} from './PreviewMediaContext';
export * from './types';
export * from './fonts';
