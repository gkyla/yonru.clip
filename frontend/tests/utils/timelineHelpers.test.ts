import { describe, it, expect } from 'vitest'
import { calculateTimelineDuration, calculateVideoTime } from '../../app/utils/timelineHelpers'

describe('Timeline Helpers TDD', () => {
  it('calculates duration correctly when there are no track items (empty timeline)', () => {
    // 1. thumbnail disabled, default video duration
    expect(calculateTimelineDuration([], false, 3.0, 120)).toBe(120)
    // 2. thumbnail enabled
    expect(calculateTimelineDuration([], true, 3.0, 120)).toBe(123)
    // 3. fallback video duration
    expect(calculateTimelineDuration([], false, 3.0, 0)).toBe(60)
  })

  it('calculates duration correctly based on tracks with items', () => {
    const tracks = [
      {
        id: 'video',
        items: [
          { start: 0, duration: 10 },
          { start: 10, duration: 25 }
        ]
      },
      {
        id: 'text',
        items: [
          { start: 5, duration: 40 }
        ]
      }
    ]
    expect(calculateTimelineDuration(tracks, false, 5.0, 120)).toBe(45)
    expect(calculateTimelineDuration(tracks, true, 5.0, 120)).toBe(50)
  })

  it('calculates videoTime correctly when there is no video track or empty track', () => {
    expect(calculateVideoTime(15.0, false, 3.0, [])).toBe(15.0)
    expect(calculateVideoTime(15.0, true, 3.0, [])).toBe(12.0)
    expect(calculateVideoTime(2.0, true, 3.0, [])).toBe(0)
  })

  it('calculates videoTime correctly when inside an active video track segment', () => {
    const tracks = [
      {
        id: 'video',
        items: [
          { start: 0, duration: 10, mediaStart: 0 },
          { start: 10, duration: 25, mediaStart: 50 }
        ]
      }
    ]
    expect(calculateVideoTime(15.0, false, 3.0, tracks)).toBe(55.0)
    expect(calculateVideoTime(18.0, true, 3.0, tracks)).toBe(55.0)

    const tracksNoMediaStart = [
      {
        id: 'video',
        items: [
          { start: 10, duration: 25 }
        ]
      }
    ]
    expect(calculateVideoTime(15.0, false, 3.0, tracksNoMediaStart)).toBe(15.0)
  })
})
