import { describe, it, expect } from 'vitest'
import { calculateCropPercent } from '../../app/utils/cropHelpers'

describe('cropHelpers', () => {
  describe('calculateCropPercent', () => {
    it('should correctly calculate the cropped percentage change', () => {
      // drag start percent = 50%
      // moving mouse right (positive dx = 20 pixels)
      // scale factor = 0.5
      // dx in 1080 scale = 20 / 0.5 = 40 pixels
      // maxOffset = 200 pixels
      // percentDelta = (40 / 200) * -100 = -20%
      // expected = 50% + (-20%) = 30%
      const result = calculateCropPercent(20, 50, 0.5, 200)
      expect(result).toBeCloseTo(30)
    })

    it('should clamp the crop percent to 100 on far left drag', () => {
      // dx is negative (mouse left)
      const result = calculateCropPercent(-500, 50, 0.5, 200)
      expect(result).toBe(100)
    })

    it('should clamp the crop percent to 0 on far right drag', () => {
      // dx is positive (mouse right)
      const result = calculateCropPercent(500, 50, 0.5, 200)
      expect(result).toBe(0)
    })

    it('should return original dragStartPercent when maxOffset or previewScale is 0', () => {
      expect(calculateCropPercent(100, 50, 0, 200)).toBe(50)
      expect(calculateCropPercent(100, 50, 0.5, 0)).toBe(50)
    })
  })
})

