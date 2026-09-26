import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

try {
  registerRoot(RemotionRoot);
} catch {
  // Ignore if already registered
}

export { RemotionRoot } from './Root';
export { YonruClip } from './Composition';
export { CanvasVideoCompositor } from './CanvasVideoCompositor';
export type { CanvasVideoCompositorProps } from './CanvasVideoCompositor';
export { AnimatedSubtitles } from './AnimatedSubtitles';
export * from './types';
export * from './fonts';
