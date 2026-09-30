// coverEngine.ts - Cover Composition Coordinator domain engine
import type {
  CoverTextOverlay,
  DefaultCoverStyle,
  CoverConfig,
  ThumbnailTextOverlay,
  DefaultThumbnailStyle,
  ThumbnailConfig
} from '../types/clipper';

export interface CoverTextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  showStroke: boolean;
  textTransform: string;
  rotation: number;
  showBackground: boolean;
  backgroundColor: string;
  backgroundOpacity: number;
  backgroundPadding: number;
}

export type ThumbnailTextStyle = CoverTextStyle;

export class CoverCompositionCoordinator {
  public static readonly DEFAULT_START_X = 540;
  public static readonly DEFAULT_START_Y = 960;
  public static readonly DEFAULT_STEP_X = 40;
  public static readonly DEFAULT_STEP_Y = 80;

  public static resolveCoverTextStyle(
    firstOverlay?: Partial<CoverTextOverlay> | null,
    defaultStyle?: DefaultCoverStyle | null
  ): CoverTextStyle {
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
      };
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
      };
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
    };
  }

  public static resolveThumbnailTextStyle(
    firstOverlay?: Partial<ThumbnailTextOverlay> | null,
    defaultStyle?: DefaultThumbnailStyle | null
  ): ThumbnailTextStyle {
    return this.resolveCoverTextStyle(firstOverlay, defaultStyle);
  }

  public static calculateNextOverlayPosition(
    existingOverlays: Array<{ x: number; y: number }>,
    startX = CoverCompositionCoordinator.DEFAULT_START_X,
    startY = CoverCompositionCoordinator.DEFAULT_START_Y,
    stepX = CoverCompositionCoordinator.DEFAULT_STEP_X,
    stepY = CoverCompositionCoordinator.DEFAULT_STEP_Y
  ): { x: number; y: number } {
    let newX = startX;
    let newY = startY;

    while (existingOverlays.some(o => o.x === newX && o.y === newY)) {
      newX += stepX;
      newY += stepY;
    }

    return { x: newX, y: newY };
  }

  public static mapCoverOverlays(
    overlays?: Partial<CoverTextOverlay>[]
  ): CoverTextOverlay[] {
    if (!overlays) return [];
    return overlays.map((o: Partial<CoverTextOverlay>): CoverTextOverlay => ({
      id: o.id || '',
      text: o.text || '',
      x: o.x ?? CoverCompositionCoordinator.DEFAULT_START_X,
      y: o.y ?? CoverCompositionCoordinator.DEFAULT_START_Y,
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
    }));
  }

  public static mapThumbnailOverlays(
    overlays?: Partial<ThumbnailTextOverlay>[]
  ): ThumbnailTextOverlay[] {
    return this.mapCoverOverlays(overlays);
  }

  public static createOverlay(
    existingOverlays: CoverTextOverlay[],
    defaultStyle?: DefaultCoverStyle | null,
    text: string = 'YOUR TEXT'
  ): CoverTextOverlay {
    const style = this.resolveCoverTextStyle(existingOverlays[0], defaultStyle);
    const { x, y } = this.calculateNextOverlayPosition(existingOverlays);

    return {
      id: Math.random().toString(36).substring(2, 11),
      text,
      x,
      y,
      ...style
    };
  }

  public static applyDefaultStyleToOverlays(
    overlays: CoverTextOverlay[],
    style: DefaultCoverStyle
  ): CoverTextOverlay[] {
    return overlays.map(o => ({
      ...o,
      fontSize: style.fontSize ?? o.fontSize,
      fontFamily: style.fontFamily ?? o.fontFamily,
      fontWeight: style.fontWeight ?? o.fontWeight,
      color: style.color ?? o.color,
      strokeColor: style.strokeColor ?? o.strokeColor,
      strokeWidth: style.strokeWidth ?? o.strokeWidth,
      showStroke: style.showStroke ?? o.showStroke,
      textTransform: style.textTransform ?? o.textTransform,
      rotation: style.rotation ?? o.rotation,
      showBackground: style.showBackground ?? o.showBackground,
      backgroundColor: style.backgroundColor ?? o.backgroundColor,
      backgroundOpacity: style.backgroundOpacity ?? o.backgroundOpacity,
      backgroundPadding: style.backgroundPadding ?? o.backgroundPadding
    }));
  }

  public static extractDefaultStyleFromOverlay(
    overlay: CoverTextOverlay,
    duration: number = 1.0
  ): DefaultCoverStyle {
    return {
      thumbnailDuration: duration,
      fontSize: overlay.fontSize,
      fontFamily: overlay.fontFamily,
      fontWeight: overlay.fontWeight,
      color: overlay.color,
      strokeColor: overlay.strokeColor,
      strokeWidth: overlay.strokeWidth,
      showStroke: overlay.showStroke,
      textTransform: overlay.textTransform,
      rotation: overlay.rotation,
      showBackground: overlay.showBackground,
      backgroundColor: overlay.backgroundColor,
      backgroundOpacity: overlay.backgroundOpacity,
      backgroundPadding: overlay.backgroundPadding
    };
  }

  public static calculateDurationTimeShift(
    prevDuration: number,
    newDuration: number,
    currentTime: number,
    coverEnabled: boolean
  ): number {
    if (!coverEnabled) return currentTime;
    const diff = newDuration - prevDuration;
    return Math.max(0, currentTime + diff);
  }

  public static calculateToggleTimeShift(
    enabling: boolean,
    duration: number,
    currentTime: number
  ): number {
    if (enabling) {
      return currentTime + duration;
    }
    return Math.max(0, currentTime - duration);
  }

  public static calculateScreenshotRequestTimestamp(
    timestamp?: number | null,
    videoFps: number = 30
  ): number | null {
    if (timestamp === undefined || timestamp === null) return null;
    const frameOffset = 3 / (videoFps || 30);
    return Math.max(0, timestamp - frameOffset);
  }
}

export const ThumbnailCompositionCoordinator = CoverCompositionCoordinator;

// Re-export functional aliases for backward compatibility
export const resolveCoverTextStyle =
  CoverCompositionCoordinator.resolveCoverTextStyle.bind(
    CoverCompositionCoordinator
  );
export const resolveThumbnailTextStyle = resolveCoverTextStyle;

export const calculateNextOverlayPosition =
  CoverCompositionCoordinator.calculateNextOverlayPosition.bind(
    CoverCompositionCoordinator
  );

export const mapCoverOverlays =
  CoverCompositionCoordinator.mapCoverOverlays.bind(
    CoverCompositionCoordinator
  );
export const mapThumbnailOverlays = mapCoverOverlays;
