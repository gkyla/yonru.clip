import type { SubtitleStyleSettings } from '../types/clipper';
import {
  SUBTITLE_PRESETS,
  type SubtitlePreset
} from '../constants/subtitlePresets';

export interface RemotionSubtitleStyleProps {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  textTransform: string;
  animation: string;
  highlightMode: string;
  background: string;
  backgroundOpacity: number;
  wordSpacing: number;
}

export interface RemotionStyleBundle {
  position: string;
  videoLayout: 'vertical' | 'landscape';
  landscapeBackground: 'black' | 'blur';
  landscapeBlurRadius: number;
  landscapeDarkness: number;
  subtitleOffset: number;
  autoAdaptiveSubtitles: boolean;
  subtitlesEnabled: boolean;
  subtitleStyle: RemotionSubtitleStyleProps;
}

export interface BackendRenderStylePayload {
  video_layout: string;
  landscape_background: string;
  landscape_blur_radius: number;
  landscape_darkness: number;
  subtitle_position: string;
  subtitle_offset: number;
  font: string;
  font_size: number;
  subtitle_sync_offset: number;
  subtitle_mode: string;
  subtitle_animation: string;
  subtitle_highlight_mode: string;
  subtitle_highlight_color: string;
  subtitle_text_color: string;
  subtitle_stroke_color: string;
  subtitle_stroke_width: number;
  subtitle_font_weight: number;
  subtitle_text_transform: string;
  subtitle_background: string;
  subtitle_background_opacity: number;
  subtitle_word_spacing: number;
  subtitles_enabled: boolean;
}

export const DEFAULT_SUBTITLE_STYLES: SubtitleStyleSettings = {
  videoLayout: 'vertical',
  landscapeBackground: 'black',
  landscapeBlurRadius: 25,
  landscapeDarkness: 35,
  subtitlePosition: 'center',
  subtitleOffset: 50,
  subtitleSyncOffset: 150,
  autoAdaptiveSubtitles: true,
  font: 'Montserrat',
  fontSize: 50,
  cropMode: 'face_tracking',
  cropMap: [],
  cropPercentX: 50,
  cropPercentXTop: 50,
  cropPercentXBottom: 50,
  splitZoomTop: 1.0,
  splitZoomBottom: 1.0,
  splitOffsetXTop: 0,
  splitOffsetYTop: 0,
  splitOffsetXBottom: 0,
  splitOffsetYBottom: 0,
  subtitleMode: 'word',
  subtitleAnimation: 'pop',
  subtitleHighlightMode: 'color',
  subtitleHighlightColor: '#CFFF50',
  subtitleTextColor: '#FFFFFF',
  subtitleStrokeColor: '#000000',
  subtitleStrokeWidth: 0,
  subtitleFontWeight: 900,
  subtitleTextTransform: 'uppercase',
  subtitleBackground: 'none',
  subtitleBackgroundOpacity: 0.7,
  subtitleWordSpacing: 0,
  volume: 0.5,
  subtitlePreset: 'bold-podcast',
  subtitlesEnabled: true
};

/**
 * SubtitleStyleCoordinator — Deep Domain Engine for Subtitle Typography,
 * Visual Highlight Pacing, Layout Bounds, Remotion Marshaling, and Backend Render Serialization.
 */
export class SubtitleStyleCoordinator {
  private settings: SubtitleStyleSettings;

  constructor(initialSettings?: Partial<SubtitleStyleSettings> | null) {
    this.settings = this.merge(DEFAULT_SUBTITLE_STYLES, initialSettings);
  }

  public getSettings(): SubtitleStyleSettings {
    return { ...this.settings };
  }

  public static merge(
    base: SubtitleStyleSettings = DEFAULT_SUBTITLE_STYLES,
    overrides?: Partial<SubtitleStyleSettings> | null
  ): SubtitleStyleSettings {
    return new SubtitleStyleCoordinator(base).merge(base, overrides);
  }

  public merge(
    base: SubtitleStyleSettings = this.settings,
    overrides?: Partial<SubtitleStyleSettings> | null
  ): SubtitleStyleSettings {
    if (!overrides) {
      return { ...base };
    }

    const merged: SubtitleStyleSettings = {
      videoLayout: overrides.videoLayout ?? base.videoLayout ?? 'vertical',
      landscapeBackground:
        overrides.landscapeBackground ?? base.landscapeBackground ?? 'black',
      landscapeBlurRadius:
        overrides.landscapeBlurRadius !== undefined
          ? overrides.landscapeBlurRadius
          : (base.landscapeBlurRadius ?? 25),
      landscapeDarkness:
        overrides.landscapeDarkness !== undefined
          ? overrides.landscapeDarkness
          : (base.landscapeDarkness ?? 35),
      subtitlePosition:
        overrides.subtitlePosition ?? base.subtitlePosition ?? 'center',
      subtitleOffset:
        overrides.subtitleOffset !== undefined
          ? overrides.subtitleOffset
          : (base.subtitleOffset ?? 50),
      subtitleSyncOffset:
        overrides.subtitleSyncOffset !== undefined
          ? overrides.subtitleSyncOffset
          : (base.subtitleSyncOffset ?? 150),
      autoAdaptiveSubtitles:
        overrides.autoAdaptiveSubtitles !== undefined
          ? overrides.autoAdaptiveSubtitles
          : (base.autoAdaptiveSubtitles ?? true),
      font: overrides.font ?? base.font ?? 'Montserrat',
      fontSize:
        overrides.fontSize !== undefined
          ? overrides.fontSize
          : (base.fontSize ?? 50),
      cropMode: overrides.cropMode ?? base.cropMode ?? 'face_tracking',
      cropMap: overrides.cropMap
        ? [...overrides.cropMap]
        : base.cropMap
          ? [...base.cropMap]
          : [],
      cropPercentX:
        overrides.cropPercentX !== undefined
          ? overrides.cropPercentX
          : (base.cropPercentX ?? 50),
      cropPercentXTop:
        overrides.cropPercentXTop !== undefined
          ? overrides.cropPercentXTop
          : (base.cropPercentXTop ?? 50),
      cropPercentXBottom:
        overrides.cropPercentXBottom !== undefined
          ? overrides.cropPercentXBottom
          : (base.cropPercentXBottom ?? 50),
      splitZoomTop:
        overrides.splitZoomTop !== undefined
          ? overrides.splitZoomTop
          : (base.splitZoomTop ?? 1.0),
      splitZoomBottom:
        overrides.splitZoomBottom !== undefined
          ? overrides.splitZoomBottom
          : (base.splitZoomBottom ?? 1.0),
      splitOffsetXTop:
        overrides.splitOffsetXTop !== undefined
          ? overrides.splitOffsetXTop
          : (base.splitOffsetXTop ?? 0),
      splitOffsetYTop:
        overrides.splitOffsetYTop !== undefined
          ? overrides.splitOffsetYTop
          : (base.splitOffsetYTop ?? 0),
      splitOffsetXBottom:
        overrides.splitOffsetXBottom !== undefined
          ? overrides.splitOffsetXBottom
          : (base.splitOffsetXBottom ?? 0),
      splitOffsetYBottom:
        overrides.splitOffsetYBottom !== undefined
          ? overrides.splitOffsetYBottom
          : (base.splitOffsetYBottom ?? 0),
      subtitleMode: overrides.subtitleMode ?? base.subtitleMode ?? 'word',
      subtitleAnimation:
        overrides.subtitleAnimation ?? base.subtitleAnimation ?? 'pop',
      subtitleHighlightMode:
        overrides.subtitleHighlightMode ??
        base.subtitleHighlightMode ??
        'color',
      subtitleHighlightColor:
        overrides.subtitleHighlightColor ??
        base.subtitleHighlightColor ??
        '#CFFF50',
      subtitleTextColor:
        overrides.subtitleTextColor ?? base.subtitleTextColor ?? '#FFFFFF',
      subtitleStrokeColor:
        overrides.subtitleStrokeColor ?? base.subtitleStrokeColor ?? '#000000',
      subtitleStrokeWidth:
        overrides.subtitleStrokeWidth !== undefined
          ? overrides.subtitleStrokeWidth
          : (base.subtitleStrokeWidth ?? 0),
      subtitleFontWeight:
        overrides.subtitleFontWeight !== undefined
          ? overrides.subtitleFontWeight
          : (base.subtitleFontWeight ?? 900),
      subtitleTextTransform:
        overrides.subtitleTextTransform ??
        base.subtitleTextTransform ??
        'uppercase',
      subtitleBackground:
        overrides.subtitleBackground ?? base.subtitleBackground ?? 'none',
      subtitleBackgroundOpacity:
        overrides.subtitleBackgroundOpacity !== undefined
          ? overrides.subtitleBackgroundOpacity
          : (base.subtitleBackgroundOpacity ?? 0.7),
      subtitleWordSpacing:
        overrides.subtitleWordSpacing !== undefined
          ? overrides.subtitleWordSpacing
          : (base.subtitleWordSpacing ?? 0),
      volume:
        overrides.volume !== undefined
          ? overrides.volume
          : (base.volume ?? 0.5),
      subtitlePreset:
        overrides.subtitlePreset ?? base.subtitlePreset ?? 'bold-podcast',
      subtitlesEnabled:
        overrides.subtitlesEnabled !== undefined
          ? overrides.subtitlesEnabled
          : (base.subtitlesEnabled ?? true)
    };

    this.settings = merged;
    return { ...this.settings };
  }

  public update(patch: Partial<SubtitleStyleSettings>): SubtitleStyleSettings {
    return this.merge(this.settings, patch);
  }

  public applyPreset(
    presetOrId: SubtitlePreset | string
  ): SubtitleStyleSettings {
    const preset =
      typeof presetOrId === 'string'
        ? SUBTITLE_PRESETS.find(p => p.id === presetOrId)
        : presetOrId;

    if (!preset) {
      return { ...this.settings };
    }

    return this.update({
      subtitlePreset: preset.id,
      font: preset.font,
      fontSize: preset.fontSize,
      subtitleFontWeight: preset.fontWeight,
      subtitleTextColor: preset.color,
      subtitleHighlightColor: preset.highlightColor,
      subtitleAnimation: preset.animation,
      subtitleHighlightMode: preset.highlightMode,
      subtitleBackground: preset.background,
      subtitleStrokeWidth: preset.strokeWidth,
      subtitleTextTransform: preset.textTransform
    });
  }

  public reset(): SubtitleStyleSettings {
    this.settings = { ...DEFAULT_SUBTITLE_STYLES };
    return { ...this.settings };
  }

  public getOuterStrokeShadow(): string {
    return SubtitleStyleCoordinator.getOuterStrokeShadow(
      this.settings.subtitleStrokeWidth,
      this.settings.subtitleStrokeColor
    );
  }

  public toRemotionProps(): RemotionStyleBundle {
    return SubtitleStyleCoordinator.extractRemotionProps(this.settings);
  }

  public toRenderPayload(): BackendRenderStylePayload {
    return SubtitleStyleCoordinator.extractRenderPayload(this.settings);
  }

  public static getOuterStrokeShadow(
    strokeWidth?: number,
    strokeColor: string = '#000000'
  ): string {
    return getOuterStrokeShadow(strokeWidth, strokeColor);
  }

  public static extractRemotionProps(
    settings: Partial<SubtitleStyleSettings>
  ): RemotionStyleBundle {
    return {
      position: settings.subtitlePosition || 'center',
      videoLayout: settings.videoLayout || 'vertical',
      landscapeBackground: settings.landscapeBackground || 'black',
      landscapeBlurRadius: settings.landscapeBlurRadius ?? 25,
      landscapeDarkness: settings.landscapeDarkness ?? 35,
      subtitleOffset: settings.subtitleOffset ?? 50,
      autoAdaptiveSubtitles: settings.autoAdaptiveSubtitles ?? true,
      subtitlesEnabled: settings.subtitlesEnabled ?? true,
      subtitleStyle: {
        fontFamily: settings.font || 'Montserrat',
        fontSize: settings.fontSize ?? 50,
        fontWeight: settings.subtitleFontWeight ?? 900,
        color: settings.subtitleTextColor || '#FFFFFF',
        highlightColor: settings.subtitleHighlightColor || '#CFFF50',
        strokeColor: settings.subtitleStrokeColor || '#000000',
        strokeWidth: settings.subtitleStrokeWidth ?? 0,
        textTransform: settings.subtitleTextTransform || 'uppercase',
        animation: settings.subtitleAnimation || 'pop',
        highlightMode: settings.subtitleHighlightMode || 'color',
        background: settings.subtitleBackground || 'none',
        backgroundOpacity: settings.subtitleBackgroundOpacity ?? 0.7,
        wordSpacing: settings.subtitleWordSpacing ?? 0
      }
    };
  }

  public static extractRenderPayload(
    settings: Partial<SubtitleStyleSettings>
  ): BackendRenderStylePayload {
    return {
      video_layout: settings.videoLayout || 'vertical',
      landscape_background: settings.landscapeBackground || 'black',
      landscape_blur_radius: settings.landscapeBlurRadius ?? 25,
      landscape_darkness: settings.landscapeDarkness ?? 35,
      subtitle_position: settings.subtitlePosition || 'center',
      subtitle_offset: settings.subtitleOffset ?? 50,
      font: settings.font || 'Montserrat',
      font_size: settings.fontSize ?? 50,
      subtitle_sync_offset: settings.subtitleSyncOffset ?? 150,
      subtitle_mode: settings.subtitleMode || 'word',
      subtitle_animation: settings.subtitleAnimation || 'pop',
      subtitle_highlight_mode: settings.subtitleHighlightMode || 'color',
      subtitle_highlight_color: settings.subtitleHighlightColor || '#CFFF50',
      subtitle_text_color: settings.subtitleTextColor || '#FFFFFF',
      subtitle_stroke_color: settings.subtitleStrokeColor || '#000000',
      subtitle_stroke_width: settings.subtitleStrokeWidth ?? 0,
      subtitle_font_weight: settings.subtitleFontWeight ?? 900,
      subtitle_text_transform: settings.subtitleTextTransform || 'uppercase',
      subtitle_background: settings.subtitleBackground || 'none',
      subtitle_background_opacity: settings.subtitleBackgroundOpacity ?? 0.7,
      subtitle_word_spacing: settings.subtitleWordSpacing ?? 0,
      subtitles_enabled: settings.subtitlesEnabled ?? true
    };
  }
}

/**
 * Generates an 8-directional outer outline shadow for text previews.
 * Prevents -webkit-text-stroke from eating inwards into glyph fill on small fonts,
 * creating a crisp, authentic outer outline around characters.
 */
export function getOuterStrokeShadow(
  strokeWidth?: number,
  strokeColor: string = '#000000'
): string {
  if (!strokeWidth || strokeWidth <= 0) {
    return '0 1px 3px rgba(0,0,0,0.8)';
  }
  // Scale down stroke width for compact preview boxes (~13px font size)
  const d = Math.max(1, Math.round(strokeWidth * 0.45 * 10) / 10);
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
    '0 2px 4px rgba(0,0,0,0.95)'
  ].join(', ');
}
