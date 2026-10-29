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
  computeViewportFraming
} from './CanvasVideoCompositor';
export type {
  CanvasVideoCompositorProps,
  ViewportFramingParams,
  ViewportFramingResult
} from './CanvasVideoCompositor';
export {
  TimelineFrameRetention,
  coalesceContiguousVideoSegments,
  getSegmentFrameWindow,
  isMainVideoFrameCovered,
  isInitialDecoderFrameAligned,
  resolveTimelineMediaTime
} from './TimelineFrameRetention';
export type {
  TimelineFrameRetentionProps,
  TimelineVideoSegmentBounds,
  SegmentFrameWindow,
  InitialDecoderFrameAlignmentParams
} from './TimelineFrameRetention';
export { AnimatedSubtitles } from './AnimatedSubtitles';
export * from './types';
export * from './fonts';
