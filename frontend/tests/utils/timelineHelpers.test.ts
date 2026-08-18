import { describe, it, expect } from 'vitest'
import {
  calculateTimelineDuration,
  calculateVideoTime,
  splitTimelineItem,
  deleteTimelineItemWithRipple,
  calculateSnapTime,
  calculateDragBounds,
  calculateRulerTicks
} from '../../app/utils/timelineHelpers'

describe('Timeline Helpers TDD', () => {
  describe('Duration & VideoTime Calculations', () => {
    it('calculates duration correctly when there are no track items (empty timeline)', () => {
      expect(calculateTimelineDuration([], false, 3.0, 120)).toBe(120)
      expect(calculateTimelineDuration([], true, 3.0, 120)).toBe(123)
      expect(calculateTimelineDuration([], false, 3.0, 0)).toBe(60)
    })

    it('calculates duration correctly based on tracks with items', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10 },
            { id: 'v2', start: 10, duration: 25 }
          ]
        },
        {
          id: 'text' as const,
          name: 'Text Track',
          type: 'text' as const,
          items: [
            { id: 't1', start: 5, duration: 40 }
          ]
        }
      ]
      expect(calculateTimelineDuration(tracks, false, 5.0, 120)).toBe(45)
      expect(calculateTimelineDuration(tracks, true, 5.0, 120)).toBe(50)
    })

    it('calculates videoTime correctly inside active segment and across boundaries', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10, mediaStart: 15 },
            { id: 'v2', start: 10, duration: 25, mediaStart: 50 }
          ]
        }
      ]
      expect(calculateVideoTime(5.0, false, 0, tracks)).toBe(20.0)
      expect(calculateVideoTime(15.0, false, 0, tracks)).toBe(55.0)
      expect(calculateVideoTime(18.0, true, 3.0, tracks)).toBe(55.0)
    })
  })

  describe('Item Splitting', () => {
    it('returns null if cutTime is out of bounds', () => {
      const item = { id: 'v1', start: 5.0, duration: 10.0, mediaStart: 0 }
      expect(splitTimelineItem(item, 5.0)).toBeNull()
      expect(splitTimelineItem(item, 15.0)).toBeNull()
      expect(splitTimelineItem(item, 2.0)).toBeNull()
    })

    it('splits item and computes correct durations and mediaStarts', () => {
      const item = { id: 'v1', start: 10.0, duration: 20.0, mediaStart: 5.0 }
      const res = splitTimelineItem(item, 15.0, () => 'new_id_2')
      expect(res).not.toBeNull()
      expect(res?.firstItem).toEqual({
        id: 'v1',
        start: 10.0,
        duration: 5.0,
        mediaStart: 5.0
      })
      expect(res?.secondItem).toEqual({
        id: 'new_id_2',
        start: 15.0,
        duration: 15.0,
        mediaStart: 10.0
      })
    })
  })

  describe('Ripple Delete', () => {
    it('deletes item from non-video track without ripple shifting other tracks', () => {
      const tracks = [
        { id: 'text' as const, name: 'Text Track', type: 'text' as const, items: [{ id: 't1', start: 5, duration: 5 }, { id: 't2', start: 15, duration: 5 }] },
        { id: 'video' as const, name: 'Video Track', type: 'video' as const, items: [{ id: 'v1', start: 0, duration: 30 }] }
      ]
      const res = deleteTimelineItemWithRipple(
        tracks,
        [],
        { id: 't1', start: 5, duration: 5 },
        'text',
        10.0,
        false,
        0
      )
      expect(res.updatedTracks[0]?.items.length).toBe(1)
      expect(res.updatedTracks[0]?.items[0]?.id).toBe('t2')
      expect(res.updatedTracks[0]?.items[0]?.start).toBe(15) // Not shifted
      expect(res.updatedCurrentTime).toBe(10.0)
    })

    it('performs ripple delete on video track, shifting subsequent items and subtitles', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10 },
            { id: 'v2', start: 10, duration: 10 },
            { id: 'v3', start: 20, duration: 10 }
          ]
        }
      ]
      const transcript = [
        { id: 's1', start: 2, duration: 4, text: 'hello world' },
        { id: 's2', start: 12, duration: 6, text: 'middle section to delete' },
        { id: 's3', start: 22, duration: 4, text: 'ending section' }
      ]

      const res = deleteTimelineItemWithRipple(
        tracks,
        transcript,
        { id: 'v2', start: 10, duration: 10 },
        'video',
        25.0,
        false,
        0
      )

      // v3 shifted left by 10s: from 20s to 10s
      expect(res.updatedTracks[0]?.items.length).toBe(2)
      expect(res.updatedTracks[0]?.items[1]?.id).toBe('v3')
      expect(res.updatedTracks[0]?.items[1]?.start).toBe(10)

      // Playhead shifted from 25s to 15s
      expect(res.updatedCurrentTime).toBe(15.0)

      // Subtitles: s1 unchanged, s2 in deleted window removed, s3 shifted left by 10s (from 22 to 12)
      expect(res.updatedTranscript.length).toBe(2)
      expect(res.updatedTranscript[0]?.id).toBe('s1')
      expect(res.updatedTranscript[1]?.id).toBe('s3')
      expect(res.updatedTranscript[1]?.start).toBe(12)
    })
  })

  describe('Snapping Logic', () => {
    it('returns original value when snapping is disabled', () => {
      expect(calculateSnapTime(10.123, false, 100, 5, [], false, 0)).toBe(10.123)
    })

    it('snaps to nearest clip edge if within tolerance', () => {
      const tracks = [
        {
          id: 'video' as const,
          name: 'Video Track',
          type: 'video' as const,
          items: [
            { id: 'v1', start: 0, duration: 10 } // Edge at 10.0
          ]
        }
      ]
      // Tolerance at 100px/s is 5px / 100 = 0.05s
      expect(calculateSnapTime(9.98, true, 100, 0, tracks, false, 0)).toBe(10.0)
      expect(calculateSnapTime(10.02, true, 100, 0, tracks, false, 0)).toBe(10.0)
    })
  })

  describe('Drag Bounds', () => {
    it('calculates move bounds with snap', () => {
      const item = { id: 'v1', start: 5.0, duration: 10.0 }
      const res = calculateDragBounds('move', 5.0, 2.05, item, (v) => Math.round(v))
      expect(res.newStart).toBe(7.0)
      expect(res.newDuration).toBe(10.0)
    })

    it('calculates resize end bounds with minimum duration clamp', () => {
      const item = { id: 'v1', start: 5.0, duration: 10.0 }
      const res = calculateDragBounds('end', 10.0, -15.0, item, (v) => v)
      expect(res.newDuration).toBe(0.1)
    })
  })

  describe('Ruler Ticks Generation', () => {
    it('generates ticks and major labels based on zoom level', () => {
      const ticks = calculateRulerTicks(1000, 100)
      expect(ticks.length).toBeGreaterThan(0)
      expect(ticks[0]?.pos).toBe(0)
      const majorTicks = ticks.filter(t => t.major && t.label)
      expect(majorTicks.length).toBeGreaterThan(0)
    })
  })
})
