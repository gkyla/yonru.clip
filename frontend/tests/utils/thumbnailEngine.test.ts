import { describe, it, expect } from 'vitest'
import {
  ThumbnailCompositionCoordinator,
  type ThumbnailTextStyle
} from '../../app/utils/thumbnailEngine'
import type { ThumbnailTextOverlay, DefaultThumbnailStyle } from '../../app/types/clipper'

describe('ThumbnailCompositionCoordinator Unit Tests', () => {
  describe('Style Cascade & Resolution', () => {
    it('inherits style from first overlay when existing overlays exist', () => {
      const firstOverlay: Partial<ThumbnailTextOverlay> = {
        fontSize: 120,
        fontFamily: 'Inter',
        color: '#FFFF00',
        strokeColor: '#FF0000',
        strokeWidth: 8,
        showStroke: true,
        textTransform: 'lowercase',
        backgroundColor: '#333333',
        backgroundOpacity: 0.9,
        backgroundPadding: 30
      }

      const defaultStyle: DefaultThumbnailStyle = {
        thumbnailDuration: 2.0,
        fontSize: 80,
        fontFamily: 'Roboto',
        color: '#FFFFFF'
      }

      const resolved = ThumbnailCompositionCoordinator.resolveThumbnailTextStyle(firstOverlay, defaultStyle)
      expect(resolved.fontSize).toBe(120)
      expect(resolved.fontFamily).toBe('Inter')
      expect(resolved.color).toBe('#FFFF00')
      expect(resolved.strokeColor).toBe('#FF0000')
      expect(resolved.strokeWidth).toBe(8)
    })

    it('falls back to default style when no existing overlay exists', () => {
      const defaultStyle: DefaultThumbnailStyle = {
        thumbnailDuration: 2.0,
        fontSize: 85,
        fontFamily: 'Outfit',
        color: '#00FF00',
        strokeColor: '#000000',
        strokeWidth: 6,
        showStroke: true,
        textTransform: 'uppercase',
        rotation: 5,
        showBackground: true,
        backgroundColor: '#111111',
        backgroundOpacity: 0.8,
        backgroundPadding: 25
      }

      const resolved = ThumbnailCompositionCoordinator.resolveThumbnailTextStyle(null, defaultStyle)
      expect(resolved.fontSize).toBe(85)
      expect(resolved.fontFamily).toBe('Outfit')
      expect(resolved.color).toBe('#00FF00')
      expect(resolved.strokeWidth).toBe(6)
      expect(resolved.rotation).toBe(5)
    })

    it('falls back to global defaults when neither overlay nor defaultStyle is provided', () => {
      const resolved = ThumbnailCompositionCoordinator.resolveThumbnailTextStyle(null, null)
      expect(resolved.fontSize).toBe(100)
      expect(resolved.fontFamily).toBe('Montserrat')
      expect(resolved.color).toBe('#FFFFFF')
      expect(resolved.strokeWidth).toBe(5)
    })
  })

  describe('Collision-Free Layout Positioning', () => {
    it('places initial overlay at default 540, 960', () => {
      const pos = ThumbnailCompositionCoordinator.calculateNextOverlayPosition([])
      expect(pos.x).toBe(540)
      expect(pos.y).toBe(960)
    })

    it('offsets position when colliding with existing overlays', () => {
      const existing = [
        { x: 540, y: 960 },
        { x: 580, y: 1040 }
      ]

      const pos = ThumbnailCompositionCoordinator.calculateNextOverlayPosition(existing)
      expect(pos.x).toBe(620)
      expect(pos.y).toBe(1120)
    })
  })

  describe('Overlay Creation & Transformation', () => {
    it('creates a new overlay with resolved styles and collision-free position', () => {
      const existing: ThumbnailTextOverlay[] = [
        {
          id: 'text-1',
          text: 'HOOK TITLE',
          x: 540,
          y: 960,
          fontSize: 110,
          fontFamily: 'Montserrat',
          fontWeight: 900,
          color: '#CFFF50',
          strokeColor: '#000000',
          strokeWidth: 6,
          showStroke: true,
          textTransform: 'uppercase',
          rotation: 0,
          showBackground: false,
          backgroundColor: '#000000',
          backgroundOpacity: 0.7,
          backgroundPadding: 20
        }
      ]

      const newOverlay = ThumbnailCompositionCoordinator.createOverlay(existing, null, 'SUBTITLE')
      expect(newOverlay.id).toBeTruthy()
      expect(newOverlay.text).toBe('SUBTITLE')
      expect(newOverlay.x).toBe(580)
      expect(newOverlay.y).toBe(1040)
      expect(newOverlay.fontSize).toBe(110)
      expect(newOverlay.color).toBe('#CFFF50')
    })

    it('applies default style to an array of existing overlays', () => {
      const overlays: ThumbnailTextOverlay[] = [
        {
          id: '1',
          text: 'ONE',
          x: 500,
          y: 800,
          fontSize: 60,
          fontFamily: 'Arial',
          fontWeight: 400,
          color: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          showStroke: false,
          textTransform: 'none',
          rotation: 0,
          showBackground: false,
          backgroundColor: '#000',
          backgroundOpacity: 0.5,
          backgroundPadding: 10
        }
      ]

      const style: DefaultThumbnailStyle = {
        thumbnailDuration: 1.5,
        fontSize: 90,
        fontFamily: 'Inter',
        color: '#FF00FF',
        showStroke: true,
        strokeWidth: 4
      }

      const updated = ThumbnailCompositionCoordinator.applyDefaultStyleToOverlays(overlays, style)
      expect(updated[0]?.fontSize).toBe(90)
      expect(updated[0]?.fontFamily).toBe('Inter')
      expect(updated[0]?.color).toBe('#FF00FF')
      expect(updated[0]?.showStroke).toBe(true)
    })
  })

  describe('Time Shift Mathematics', () => {
    it('calculates duration time shift when enabled', () => {
      const shifted = ThumbnailCompositionCoordinator.calculateDurationTimeShift(1.0, 2.5, 5.0, true)
      expect(shifted).toBe(6.5)
    })

    it('does not shift time if thumbnail is disabled', () => {
      const shifted = ThumbnailCompositionCoordinator.calculateDurationTimeShift(1.0, 2.5, 5.0, false)
      expect(shifted).toBe(5.0)
    })

    it('calculates toggle time shift for enable/disable', () => {
      expect(ThumbnailCompositionCoordinator.calculateToggleTimeShift(true, 1.5, 10.0)).toBe(11.5)
      expect(ThumbnailCompositionCoordinator.calculateToggleTimeShift(false, 1.5, 11.5)).toBe(10.0)
    })

    it('calculates screenshot frame offset to prevent boundary tearing', () => {
      const timestamp = 10.0
      const req = ThumbnailCompositionCoordinator.calculateScreenshotRequestTimestamp(timestamp, 30)
      expect(req).toBe(10.0 - (3 / 30)) // 9.9s
    })
  })
})
