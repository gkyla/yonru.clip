// usePreviewProjection.ts - binds the editor Clip Session to a Preview
// Projection and owns the DirectPlayerBridge that RemotionPlayer renders from.
import { onScopeDispose } from 'vue';
import { useClipperState } from './useClipperState';
import { DirectPlayerBridge } from '../utils/playerBridge';
import {
  createPreviewProjection,
  type PreviewProjectionOptions,
  type PreviewSessionSource
} from '../utils/previewProjection';

export interface UsePreviewProjectionOptions extends PreviewProjectionOptions {
  session?: PreviewSessionSource;
  bridge?: DirectPlayerBridge;
}

export function usePreviewProjection(
  options: UsePreviewProjectionOptions = {}
) {
  const { session = useClipperState(), bridge: givenBridge, ...rest } = options;
  const bridge = givenBridge ?? new DirectPlayerBridge();
  const projection = createPreviewProjection(session, bridge, rest);

  onScopeDispose(() => {
    projection.dispose();
    if (!givenBridge) bridge.destroy();
  });

  return { bridge, flush: projection.flush, dispose: projection.dispose };
}
