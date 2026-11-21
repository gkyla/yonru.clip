import React, { useContext } from 'react';

export interface PreviewMediaMetadata {
  width: number;
  height: number;
  duration: number;
}

export interface PreviewMediaCallbacks {
  onMediaMetadata?: (metadata: PreviewMediaMetadata) => void;
  onMediaReady?: () => void;
}

export const PreviewMediaContext =
  React.createContext<PreviewMediaCallbacks | null>(null);

export function usePreviewMediaCallbacks(): PreviewMediaCallbacks | null {
  return useContext(PreviewMediaContext);
}
