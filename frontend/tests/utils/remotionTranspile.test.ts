import { describe, it, expect } from 'vitest'
import {
  YonruClip,
  CanvasVideoCompositor,
  AnimatedSubtitles,
  DEFAULT_SUBTITLE_STYLE
} from '@yonru/remotion'

describe('Shared Remotion TSX Transpilation', () => {
  it('resolves and exports React TSX components from @yonru/remotion', () => {
    expect(YonruClip).toBeDefined()
    expect(typeof YonruClip).toBe('function')

    expect(CanvasVideoCompositor).toBeDefined()
    expect(typeof CanvasVideoCompositor).toBe('function')

    expect(AnimatedSubtitles).toBeDefined()
    expect(typeof AnimatedSubtitles).toBe('function')
  })

  it('resolves default styling constants from shared remotion package', () => {
    expect(DEFAULT_SUBTITLE_STYLE).toBeDefined()
    expect(DEFAULT_SUBTITLE_STYLE.fontFamily).toBe('Montserrat')
    expect(DEFAULT_SUBTITLE_STYLE.color).toBe('#FFFFFF')
  })
})
