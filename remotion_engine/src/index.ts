import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

try {
  registerRoot(RemotionRoot);
} catch {
  // Ignore if already registered
}

export * from '../../shared/remotion/src/index';
