export interface ThumbnailTextStyle {
  fontSize: number
  fontFamily: string
  fontWeight: number
  color: string
  strokeColor: string
  strokeWidth: number
  showStroke: boolean
  textTransform: string
  rotation: number
  showBackground: boolean
  backgroundColor: string
  backgroundOpacity: number
  backgroundPadding: number
}

export function resolveThumbnailTextStyle(
  firstOverlay: any,
  defaultStyle: any
): ThumbnailTextStyle {
  if (firstOverlay) {
    return {
      fontSize: firstOverlay.fontSize,
      fontFamily: firstOverlay.fontFamily,
      fontWeight: firstOverlay.fontWeight,
      color: firstOverlay.color,
      strokeColor: firstOverlay.strokeColor,
      strokeWidth: firstOverlay.strokeWidth,
      showStroke: firstOverlay.showStroke,
      textTransform: firstOverlay.textTransform,
      rotation: firstOverlay.rotation,
      showBackground: firstOverlay.showBackground,
      backgroundColor: firstOverlay.backgroundColor,
      backgroundOpacity: firstOverlay.backgroundOpacity,
      backgroundPadding: firstOverlay.backgroundPadding
    }
  }

  if (defaultStyle) {
    return {
      fontSize: defaultStyle.fontSize ?? 100,
      fontFamily: defaultStyle.fontFamily ?? 'Montserrat',
      fontWeight: defaultStyle.fontWeight ?? 900,
      color: defaultStyle.color ?? '#FFFFFF',
      strokeColor: defaultStyle.strokeColor ?? '#000000',
      strokeWidth: defaultStyle.strokeWidth ?? 5,
      showStroke: defaultStyle.showStroke ?? true,
      textTransform: defaultStyle.textTransform ?? 'uppercase',
      rotation: defaultStyle.rotation ?? 0,
      showBackground: defaultStyle.showBackground ?? false,
      backgroundColor: defaultStyle.backgroundColor ?? '#000000',
      backgroundOpacity: defaultStyle.backgroundOpacity ?? 0.7,
      backgroundPadding: defaultStyle.backgroundPadding ?? 20
    }
  }

  return {
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
  }
}

export function calculateNextOverlayPosition(
  existingOverlays: Array<{ x: number; y: number }>,
  startX = 540,
  startY = 960,
  stepX = 40,
  stepY = 80
): { x: number; y: number } {
  let newX = startX
  let newY = startY

  while (existingOverlays.some(o => o.x === newX && o.y === newY)) {
    newX += stepX
    newY += stepY
  }

  return { x: newX, y: newY }
}

export function mapThumbnailOverlays(overlays?: any[]): any[] {
  if (!overlays) return []
  return overlays.map((o: any) => ({
    x: 540,
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
    backgroundPadding: 20,
    ...o
  }))
}


