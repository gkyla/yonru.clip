import type { ThumbnailTextOverlay, DefaultThumbnailStyle } from '../types/clipper'

export interface ThumbnailTextStyle {
  fontSize: number
  fontFamily: string
  fontWeight: number | string
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
  firstOverlay: Partial<ThumbnailTextOverlay> | null | undefined,
  defaultStyle: DefaultThumbnailStyle | null | undefined
): ThumbnailTextStyle {
  if (firstOverlay) {
    return {
      fontSize: firstOverlay.fontSize ?? 100,
      fontFamily: firstOverlay.fontFamily ?? 'Montserrat',
      fontWeight: firstOverlay.fontWeight ?? 900,
      color: firstOverlay.color ?? '#FFFFFF',
      strokeColor: firstOverlay.strokeColor || '#000000',
      strokeWidth: firstOverlay.strokeWidth || 0,
      showStroke: firstOverlay.showStroke || false,
      textTransform: firstOverlay.textTransform || 'none',
      rotation: firstOverlay.rotation || 0,
      showBackground: firstOverlay.showBackground || false,
      backgroundColor: firstOverlay.backgroundColor || '#000000',
      backgroundOpacity: firstOverlay.backgroundOpacity || 0,
      backgroundPadding: firstOverlay.backgroundPadding || 0
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

export function mapThumbnailOverlays(overlays?: Partial<ThumbnailTextOverlay>[]): ThumbnailTextOverlay[] {
  if (!overlays) return []
  return overlays.map((o: Partial<ThumbnailTextOverlay>): ThumbnailTextOverlay => ({
    id: o.id || '',
    text: o.text || '',
    x: o.x ?? 540,
    y: o.y ?? 960,
    fontSize: o.fontSize ?? 100,
    fontFamily: o.fontFamily ?? 'Montserrat',
    fontWeight: o.fontWeight ?? 900,
    color: o.color ?? '#FFFFFF',
    strokeColor: o.strokeColor ?? '#000000',
    strokeWidth: o.strokeWidth ?? 5,
    showStroke: o.showStroke ?? true,
    textTransform: o.textTransform ?? 'uppercase',
    rotation: o.rotation ?? 0,
    showBackground: o.showBackground ?? false,
    backgroundColor: o.backgroundColor ?? '#000000',
    backgroundOpacity: o.backgroundOpacity ?? 0.7,
    backgroundPadding: o.backgroundPadding ?? 20,
    ...o
  }))
}


