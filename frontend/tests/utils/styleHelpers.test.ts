import { describe, it, expect } from 'vitest'
import { hexToRgba, getEditingStyle } from '../../app/utils/styleHelpers'

describe('Style Helpers TDD', () => {
  it('converts 6-digit hex string to rgba correctly', () => {
    expect(hexToRgba('#000000', 0.7)).toBe('rgba(0, 0, 0, 0.7)')
    expect(hexToRgba('#FF0000', 1)).toBe('rgba(255, 0, 0, 1)')
    expect(hexToRgba('00FF00', 0.5)).toBe('rgba(0, 255, 0, 0.5)')
  })

  it('converts 3-digit shorthand hex string to rgba correctly', () => {
    expect(hexToRgba('#FFF', 1)).toBe('rgba(255, 255, 255, 1)')
    expect(hexToRgba('#000', 0.5)).toBe('rgba(0, 0, 0, 0.5)')
    expect(hexToRgba('F00', 0.8)).toBe('rgba(255, 0, 0, 0.8)')
  })

  it('maps text overlay settings to valid CSS properties using getEditingStyle', () => {
    const item = {
      x: 100,
      y: 200,
      font: 'Montserrat',
      fontSize: 50,
      fontWeight: 700,
      textTransform: 'uppercase',
      align: 'left' as const,
      lineHeight: 1.2,
      letterSpacing: 2,
      color: '#FF0000',
      opacity: 0.9,
      showBackground: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      showStroke: true,
      strokeWidth: 3,
      strokeColor: '#FFFFFF',
      shadowColor: '#111111',
      shadowBlur: 8,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      shadowOpacity: 0.6
    }

    const styles: any = getEditingStyle(item)

    expect(styles.position).toBe('absolute')
    expect(styles.left).toBe('100px')
    expect(styles.top).toBe('200px')
    expect(styles.fontFamily).toBe('"Montserrat", sans-serif')
    expect(styles.fontSize).toBe('50px')
    expect(styles.fontWeight).toBe('700')
    expect(styles.textTransform).toBe('uppercase')
    expect(styles.textAlign).toBe('left')
    expect(styles.lineHeight).toBe(1.2)
    expect(styles.letterSpacing).toBe('2px')
    expect(styles.color).toBe('#FF0000')
    expect(styles.opacity).toBe(0.9)
    expect(styles.backgroundColor).toBe('rgba(0, 0, 0, 0.7)')
    expect(styles.borderRadius).toBe('10px')
    expect(styles.padding).toBe('15px')
    expect(styles['-webkit-text-stroke']).toBe('3px #FFFFFF')
    expect(styles.textShadow).toBe('4px 4px 8px rgba(17, 17, 17, 0.6)')
  })
})
