import React from 'react';
import { Composition, getInputProps } from 'remotion';
import { YonruClip } from './Composition';
import { YonruClipProps } from './types';
import './fonts.css';

export const RemotionRoot: React.FC = () => {
  const inputProps = getInputProps() as any;
  const duration = inputProps.durationInFrames || 300;

  return (
    <>
      <Composition
        id="YonruClip"
        component={YonruClip}
        durationInFrames={duration}
        fps={inputProps.fps || 30}
        width={1080}
        height={1920}
        defaultProps={{
          videoPath: '',
          words: [],
          cropX: 0,
          position: 'center'
        } as YonruClipProps}
      />
    </>
  );
};
