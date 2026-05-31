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

export function getEditingStyle(item: any) {
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
