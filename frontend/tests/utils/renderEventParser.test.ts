import { describe, it, expect } from 'vitest'
import { parseRenderEvent, type RenderState } from '../../app/utils/renderEventParser'

const initialTestState: RenderState = {
  progress: 10,
  stage: 'some_stage',
  eta: 50,
  status: 'rendering',
  outputUrl: null,
  videoUrl: null,
  jobError: ''
}

describe('Render Event Parser TDD', () => {
  it('returns current state untouched if event payload is empty, null, or undefined', () => {
    expect(parseRenderEvent(null, initialTestState, 'http://localhost:8000')).toEqual(initialTestState)
    expect(parseRenderEvent(undefined, initialTestState, 'http://localhost:8000')).toEqual(initialTestState)
  })

  it('handles starting stage by resetting progress to 0 and setting stage to starting', () => {
    const result = parseRenderEvent({ stage: 'starting' }, initialTestState, 'http://localhost:8000')
    expect(result.progress).toBe(0)
    expect(result.stage).toBe('starting')
    expect(result.status).toBe('rendering')
  })

  it('handles bundling stage correctly with percentage and resetting eta to 0', () => {
    const resultWithPercent = parseRenderEvent({ stage: 'bundling', percent: 45 }, initialTestState, 'http://localhost:8000')
    expect(resultWithPercent.progress).toBe(45)
    expect(resultWithPercent.stage).toBe('bundling')
    expect(resultWithPercent.eta).toBe(0)

    const resultWithNoPercent = parseRenderEvent({ stage: 'bundling' }, initialTestState, 'http://localhost:8000')
    expect(resultWithNoPercent.progress).toBe(0)
    expect(resultWithNoPercent.stage).toBe('bundling')
    expect(resultWithNoPercent.eta).toBe(0)
  })

  it('handles rendering stage correctly with percentage and etaSeconds', () => {
    const result = parseRenderEvent({ stage: 'rendering', percent: 72, etaSeconds: 15, frame: 216, totalFrames: 300 }, initialTestState, 'http://localhost:8000')
    expect(result.progress).toBe(72)
    expect(result.stage).toBe('rendering')
    expect(result.eta).toBe(15)
    expect(result.frame).toBe(216)
    expect(result.totalFrames).toBe(300)
  })

  it('preserves or updates totalFrames from starting event', () => {
    const result = parseRenderEvent({ stage: 'starting', totalFrames: 300 }, initialTestState, 'http://localhost:8000')
    expect(result.totalFrames).toBe(300)
    expect(result.frame).toBe(0)
  })

  it('handles encoding stage correctly with fallback to 96 percent', () => {
    const resultWithPercent = parseRenderEvent({ stage: 'encoding', percent: 98 }, initialTestState, 'http://localhost:8000')
    expect(resultWithPercent.progress).toBe(98)
    expect(resultWithPercent.stage).toBe('encoding')

    const resultWithNoPercent = parseRenderEvent({ stage: 'encoding' }, initialTestState, 'http://localhost:8000')
    expect(resultWithNoPercent.progress).toBe(96)
    expect(resultWithNoPercent.stage).toBe('encoding')
  })

  it('handles done stage correctly with reset stage, eta and formatted URLs', () => {
    const result = parseRenderEvent({ stage: 'done', outputUrl: '/assets/clip.mp4' }, initialTestState, 'http://localhost:8000')
    expect(result.status).toBe('done')
    expect(result.progress).toBe(100)
    expect(result.stage).toBe('')
    expect(result.eta).toBe(0)
    expect(result.outputUrl).toBe('http://localhost:8000/assets/clip.mp4')
    expect(result.videoUrl).toBe('http://localhost:8000/assets/clip.mp4')
  })

  it('handles error stage correctly with fallback error messages and progress reset', () => {
    const resultWithMsg = parseRenderEvent({ stage: 'error', message: 'Something crashed' }, initialTestState, 'http://localhost:8000')
    expect(resultWithMsg.status).toBe('error')
    expect(resultWithMsg.jobError).toBe('Something crashed')
    expect(resultWithMsg.progress).toBe(0)
    expect(resultWithMsg.stage).toBe('')

    const resultWithNoMsg = parseRenderEvent({ stage: 'error' }, initialTestState, 'http://localhost:8000')
    expect(resultWithNoMsg.status).toBe('error')
    expect(resultWithNoMsg.jobError).toBe('Render failed')
    expect(resultWithNoMsg.progress).toBe(0)
    expect(resultWithNoMsg.stage).toBe('')
  })
})
