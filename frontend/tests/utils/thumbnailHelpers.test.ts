import { describe, it, expect } from 'vitest'
import { resolveThumbnailTextStyle, calculateNextOverlayPosition, mapThumbnailOverlays } from '../../app/utils/thumbnailHelpers'

describe('thumbnailHelpers', () => {
  describe('resolveThumbnailTextStyle', () => {
    it('should return default style fallbacks when firstOverlay and defaultStyle are null', () => {
      const result = resolveThumbnailTextStyle(null, null)
      expect(result).toEqual({
        fontSize: 100,
        fontFamily: 'Montserrat',
        fontWeight: 900,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 5,
        showStroke: true,
        textTransform: 'uppercase',
        rotation: 0,
        showBackground: false,
        backgroundColor: '#000000',
        backgroundOpacity: 0.7,
        backgroundPadding: 20
      })
    })

    it('should prioritize style from firstOverlay when available', () => {
      const firstOverlay = {
        fontSize: 120,
        fontFamily: 'Roboto',
        fontWeight: 700,
        color: '#FF0000',
        strokeColor: '#FFFFFF',
        strokeWidth: 10,
        showStroke: false,
        textTransform: 'none',
        rotation: 15,
        showBackground: true,
        backgroundColor: '#FFFFFF',
        backgroundOpacity: 0.9,
        backgroundPadding: 30
      }
      const defaultStyle = { fontSize: 150, fontFamily: 'Arial' }

      const result = resolveThumbnailTextStyle(firstOverlay, defaultStyle)
      expect(result.fontSize).toBe(120)
      expect(result.fontFamily).toBe('Roboto')
      expect(result.color).toBe('#FF0000')
      expect(result.strokeWidth).toBe(10)
      expect(result.showStroke).toBe(false)
      expect(result.rotation).toBe(15)
    })

    it('should fallback to default style options when firstOverlay is null', () => {
      const defaultStyle = {
        fontSize: 80,
        fontFamily: 'Outfit',
        fontWeight: 600,
        color: '#CFFF50'
      }

      const result = resolveThumbnailTextStyle(null, defaultStyle)
      expect(result.fontSize).toBe(80)
      expect(result.fontFamily).toBe('Outfit')
      expect(result.fontWeight).toBe(600)
      expect(result.color).toBe('#CFFF50')
      // Fallback constants
      expect(result.strokeWidth).toBe(5)
      expect(result.showStroke).toBe(true)
      expect(result.textTransform).toBe('uppercase')
    })
  })

  describe('calculateNextOverlayPosition', () => {
    it('should return default starting coordinates when overlays list is empty', () => {
      const result = calculateNextOverlayPosition([])
      expect(result).toEqual({ x: 540, y: 960 })
    })

    it('should step away from existing overlay coordinates to avoid collision', () => {
      const existing = [
        { x: 540, y: 960 }
      ]
      const result = calculateNextOverlayPosition(existing)
      // default step is +40 for x, +80 for y
      expect(result).toEqual({ x: 580, y: 1040 })
    })

    it('should recursively step away when multiple collision coordinates exist', () => {
      const existing = [
        { x: 540, y: 960 },
        { x: 580, y: 1040 },
        { x: 620, y: 1120 }
      ]
      const result = calculateNextOverlayPosition(existing)
      expect(result).toEqual({ x: 660, y: 1200 })
    })

    it('should respect custom start positions and step sizes', () => {
      const existing = [
        { x: 100, y: 200 }
      ]
      const result = calculateNextOverlayPosition(existing, 100, 200, 50, 100)
      expect(result).toEqual({ x: 150, y: 300 })
    })
  })

  describe('mapThumbnailOverlays', () => {
    it('should map empty/undefined overlays array to empty array', () => {
      expect(mapThumbnailOverlays(undefined)).toEqual([])
      expect(mapThumbnailOverlays(null as any)).toEqual([])
    })

    it('should map existing overlay objects, filling in default values for missing attributes', () => {
      const input = [
        { text: 'hello', x: 200 }
      ]
      const result = mapThumbnailOverlays(input)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: '',
        text: 'hello',
        x: 200,
        y: 960,
        fontSize: 100,
        fontFamily: 'Montserrat',
        fontWeight: 900,
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 5,
        showStroke: true,
        textTransform: 'uppercase',
        rotation: 0,
        showBackground: false,
        backgroundColor: '#000000',
        backgroundOpacity: 0.7,
        backgroundPadding: 20
      })
    })
  })
})


