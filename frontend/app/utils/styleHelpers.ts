import type { TimelineTrackItem } from '../types/clipper'

/**
 * Style Helpers — pure-function extraction from useInteractiveText composable.
 */

export function hexToRgba(hex: string, opacity: number): string {
  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c.charAt(0) + c.charAt(0) + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2)
  }
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

export function getEditingStyle(item: Partial<TimelineTrackItem>) {
  const showBackground = item.showBackground
  const bgColor = item.backgroundColor || '#000000'
  const bgOpacity = item.showBackground ? (item.backgroundOpacity ?? 0.7) : 0
  const color = item.color || '#FFFFFF'
  const fontSize = item.fontSize || 80
  const fontFamily = item.font || 'Outfit'
  const fontWeight = item.fontWeight ? String(item.fontWeight) : '900'
  const textTransform = item.textTransform || 'none'
  const align = item.align || 'center'
  const lineHeight = item.lineHeight ?? 1.1
  const letterSpacing = item.letterSpacing ?? 0
  const opacity = item.opacity ?? 1
  const padding = '15px'
  
  const showStroke = item.showStroke
  const strokeWidth = showStroke ? (item.strokeWidth ?? 5) : 0
  const strokeColor = item.strokeColor || '#000000'
  
  const shadowColor = item.shadowColor || '#000000'
  const shadowBlur = item.shadowBlur ?? 10
  const shadowOffsetX = item.shadowOffsetX ?? 5
  const shadowOffsetY = item.shadowOffsetY ?? 5
  const shadowOpacity = item.shadowOpacity ?? 0.5
  
  const rgbaBg = showBackground ? hexToRgba(bgColor, bgOpacity) : 'transparent'
  const rgbaShadow = hexToRgba(shadowColor, shadowOpacity)
  
  return {
    position: 'absolute' as const,
    left: `${item.x ?? 540}px`,
    top: `${item.y ?? 960}px`,
    
    fontFamily: `"${fontFamily}", sans-serif`,
    fontSize: `${fontSize}px`,
    fontWeight: fontWeight,
    textTransform: textTransform,
    textAlign: align,
    lineHeight: lineHeight,
    letterSpacing: `${letterSpacing}px`,
    color: color,
    opacity: opacity,
    
    backgroundColor: rgbaBg,
    borderRadius: '10px',
    padding: padding,
    
    '-webkit-text-stroke': showStroke ? `${strokeWidth}px ${strokeColor}` : 'none',
    textShadow: `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${rgbaShadow}`,
    
    caretColor: color,
    minWidth: '100px',
    minHeight: '1em',
    maxWidth: '1000px',
    display: 'inline-block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word' as const,
  }
}

export function transformText(text: string, transform?: string): string {
  if (!text) return ''
  if (transform === 'uppercase') return text.toUpperCase()
  if (transform === 'lowercase') return text.toLowerCase()
  if (transform === 'capitalize') {
    return text.replace(/\b\w/g, char => char.toUpperCase())
  }
  return text
}

/**
 * Generates an 8-directional outer outline shadow for text previews.
 * Prevents -webkit-text-stroke from eating inwards into glyph fill on small fonts,
 * creating a crisp, authentic outer outline around characters.
 */
export function getOuterStrokeShadow(strokeWidth?: number, strokeColor: string = '#000000'): string {
  if (!strokeWidth || strokeWidth <= 0) {
    return '0 1px 3px rgba(0,0,0,0.8)'
  }
  // Scale down stroke width for compact preview boxes (~13px font size)
  const d = Math.max(1, Math.round(strokeWidth * 0.45 * 10) / 10)
  return [
    `-${d}px -${d}px 0 ${strokeColor}`,
    `0 -${d}px 0 ${strokeColor}`,
    `${d}px -${d}px 0 ${strokeColor}`,
    `${d}px 0 0 ${strokeColor}`,
    `${d}px ${d}px 0 ${strokeColor}`,
    `0 ${d}px 0 ${strokeColor}`,
    `-${d}px ${d}px 0 ${strokeColor}`,
    `-${d}px 0 0 ${strokeColor}`,
    `0 0 ${d}px ${strokeColor}`,
    '0 2px 4px rgba(0,0,0,0.95)',
  ].join(', ')
}

