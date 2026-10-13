import {
  SubtitleStyleCoordinator,
  DEFAULT_SUBTITLE_STYLES,
  type RemotionStyleBundle,
  type BackendRenderStylePayload
} from '../utils/subtitleStyleCoordinator';
import {
  SUBTITLE_PRESETS,
  type SubtitlePreset
} from '../constants/subtitlePresets';
import type { SubtitleStyleSettings, CropMapPoint } from '../types/clipper';
import { resolveApiBase } from '../utils/apiBase';

export const useSubtitleStyle = () => {
  const API_BASE = resolveApiBase();
  const coordinator = new SubtitleStyleCoordinator();

  // Reactive state using Nuxt useState keys for cross-component reactivity
  const videoLayout = useState<'vertical' | 'landscape'>(
    'videoLayout',
    () => DEFAULT_SUBTITLE_STYLES.videoLayout ?? 'vertical'
  );
  const landscapeBackground = useState<'black' | 'blur'>(
    'landscapeBackground',
    () => DEFAULT_SUBTITLE_STYLES.landscapeBackground ?? 'black'
  );
  const landscapeBlurRadius = useState<number>(
    'landscapeBlurRadius',
    () => DEFAULT_SUBTITLE_STYLES.landscapeBlurRadius ?? 25
  );
  const landscapeDarkness = useState<number>(
    'landscapeDarkness',
    () => DEFAULT_SUBTITLE_STYLES.landscapeDarkness ?? 35
  );
  const subtitlePosition = useState<string>(
    'subtitlePosition',
    () => DEFAULT_SUBTITLE_STYLES.subtitlePosition ?? 'center'
  );
  const subtitleOffset = useState<number>(
    'subtitleOffset',
    () => DEFAULT_SUBTITLE_STYLES.subtitleOffset ?? 50
  );
  const subtitleSyncOffset = useState<number>(
    'subtitleSyncOffset',
    () => DEFAULT_SUBTITLE_STYLES.subtitleSyncOffset ?? 150
  );
  const autoAdaptiveSubtitles = useState<boolean>(
    'autoAdaptiveSubtitles',
    () => DEFAULT_SUBTITLE_STYLES.autoAdaptiveSubtitles ?? true
  );

  const font = useState<string>(
    'font',
    () => DEFAULT_SUBTITLE_STYLES.font ?? 'Montserrat'
  );
  const fontSize = useState<number>(
    'fontSize',
    () => DEFAULT_SUBTITLE_STYLES.fontSize ?? 50
  );

  // Layout & Crop
  const cropMode = useState<string>(
    'cropMode',
    () => DEFAULT_SUBTITLE_STYLES.cropMode ?? 'face_tracking'
  );
  const cropMap = useState<CropMapPoint[]>(
    'cropMap',
    () => DEFAULT_SUBTITLE_STYLES.cropMap ?? []
  );
  const cropPercentX = useState<number>(
    'cropPercentX',
    () => DEFAULT_SUBTITLE_STYLES.cropPercentX ?? 50
  );
  const cropPercentXTop = useState<number>(
    'cropPercentXTop',
    () => DEFAULT_SUBTITLE_STYLES.cropPercentXTop ?? 50
  );
  const cropPercentXBottom = useState<number>(
    'cropPercentXBottom',
    () => DEFAULT_SUBTITLE_STYLES.cropPercentXBottom ?? 50
  );
  const splitZoomTop = useState<number>(
    'splitZoomTop',
    () => DEFAULT_SUBTITLE_STYLES.splitZoomTop ?? 1.0
  );
  const splitZoomBottom = useState<number>(
    'splitZoomBottom',
    () => DEFAULT_SUBTITLE_STYLES.splitZoomBottom ?? 1.0
  );
  const splitOffsetXTop = useState<number>(
    'splitOffsetXTop',
    () => DEFAULT_SUBTITLE_STYLES.splitOffsetXTop ?? 0
  );
  const splitOffsetYTop = useState<number>(
    'splitOffsetYTop',
    () => DEFAULT_SUBTITLE_STYLES.splitOffsetYTop ?? 0
  );
  const splitOffsetXBottom = useState<number>(
    'splitOffsetXBottom',
    () => DEFAULT_SUBTITLE_STYLES.splitOffsetXBottom ?? 0
  );
  const splitOffsetYBottom = useState<number>(
    'splitOffsetYBottom',
    () => DEFAULT_SUBTITLE_STYLES.splitOffsetYBottom ?? 0
  );

  // Subtitle styling & typography
  const subtitleMode = useState<'word' | '3_words' | '4_words'>(
    'subtitleMode',
    () => DEFAULT_SUBTITLE_STYLES.subtitleMode ?? 'word'
  );
  const subtitleAnimation = useState<string>(
    'subtitleAnimation',
    () => DEFAULT_SUBTITLE_STYLES.subtitleAnimation ?? 'pop'
  );
  const subtitleHighlightMode = useState<string>(
    'subtitleHighlightMode',
    () => DEFAULT_SUBTITLE_STYLES.subtitleHighlightMode ?? 'color'
  );
  const subtitleHighlightColor = useState<string>(
    'subtitleHighlightColor',
    () => DEFAULT_SUBTITLE_STYLES.subtitleHighlightColor ?? '#CFFF50'
  );
  const subtitleTextColor = useState<string>(
    'subtitleTextColor',
    () => DEFAULT_SUBTITLE_STYLES.subtitleTextColor ?? '#FFFFFF'
  );
  const subtitleStrokeColor = useState<string>(
    'subtitleStrokeColor',
    () => DEFAULT_SUBTITLE_STYLES.subtitleStrokeColor ?? '#000000'
  );
  const subtitleStrokeWidth = useState<number>(
    'subtitleStrokeWidth',
    () => DEFAULT_SUBTITLE_STYLES.subtitleStrokeWidth ?? 0
  );
  const subtitleFontWeight = useState<number>(
    'subtitleFontWeight',
    () => DEFAULT_SUBTITLE_STYLES.subtitleFontWeight ?? 900
  );
  const subtitleTextTransform = useState<string>(
    'subtitleTextTransform',
    () => DEFAULT_SUBTITLE_STYLES.subtitleTextTransform ?? 'uppercase'
  );
  const subtitleBackground = useState<string>(
    'subtitleBackground',
    () => DEFAULT_SUBTITLE_STYLES.subtitleBackground ?? 'none'
  );
  const subtitleBackgroundOpacity = useState<number>(
    'subtitleBackgroundOpacity',
    () => DEFAULT_SUBTITLE_STYLES.subtitleBackgroundOpacity ?? 0.7
  );
  const subtitleWordSpacing = useState<number>(
    'subtitleWordSpacing',
    () => DEFAULT_SUBTITLE_STYLES.subtitleWordSpacing ?? 0
  );
  const volume = useState<number>(
    'volume',
    () => DEFAULT_SUBTITLE_STYLES.volume ?? 0.5
  );
  const subtitlePreset = useState<string>(
    'subtitlePreset',
    () => DEFAULT_SUBTITLE_STYLES.subtitlePreset ?? 'bold-podcast'
  );
  const selectedPreset = subtitlePreset;
  const subtitlesEnabled = useState<boolean>(
    'subtitlesEnabled',
    () => DEFAULT_SUBTITLE_STYLES.subtitlesEnabled ?? true
  );

  function getStyleSnapshot(): SubtitleStyleSettings {
    return {
      videoLayout: videoLayout.value,
      landscapeBackground: landscapeBackground.value,
      landscapeBlurRadius: landscapeBlurRadius.value,
      landscapeDarkness: landscapeDarkness.value,
      subtitlePosition: subtitlePosition.value,
      subtitleOffset: subtitleOffset.value,
      subtitleSyncOffset: subtitleSyncOffset.value,
      autoAdaptiveSubtitles: autoAdaptiveSubtitles.value,
      font: font.value,
      fontSize: fontSize.value,
      cropMode: cropMode.value,
      cropMap: cropMap.value,
      cropPercentX: cropPercentX.value,
      cropPercentXTop: cropPercentXTop.value,
      cropPercentXBottom: cropPercentXBottom.value,
      splitZoomTop: splitZoomTop.value,
      splitZoomBottom: splitZoomBottom.value,
      splitOffsetXTop: splitOffsetXTop.value,
      splitOffsetYTop: splitOffsetYTop.value,
      splitOffsetXBottom: splitOffsetXBottom.value,
      splitOffsetYBottom: splitOffsetYBottom.value,
      subtitleMode: subtitleMode.value,
      subtitleAnimation: subtitleAnimation.value,
      subtitleHighlightMode: subtitleHighlightMode.value,
      subtitleHighlightColor: subtitleHighlightColor.value,
      subtitleTextColor: subtitleTextColor.value,
      subtitleStrokeColor: subtitleStrokeColor.value,
      subtitleStrokeWidth: subtitleStrokeWidth.value,
      subtitleFontWeight: subtitleFontWeight.value,
      subtitleTextTransform: subtitleTextTransform.value,
      subtitleBackground: subtitleBackground.value,
      subtitleBackgroundOpacity: subtitleBackgroundOpacity.value,
      subtitleWordSpacing: subtitleWordSpacing.value,
      volume: volume.value,
      subtitlePreset: selectedPreset.value,
      subtitlesEnabled: subtitlesEnabled.value
    };
  }

  function loadStyleSettings(settings: Partial<SubtitleStyleSettings>) {
    const merged = coordinator.merge(getStyleSnapshot(), settings);

    if (merged.videoLayout !== undefined)
      videoLayout.value = merged.videoLayout;
    if (merged.landscapeBackground !== undefined)
      landscapeBackground.value = merged.landscapeBackground;
    if (merged.landscapeBlurRadius !== undefined)
      landscapeBlurRadius.value = merged.landscapeBlurRadius;
    if (merged.landscapeDarkness !== undefined)
      landscapeDarkness.value = merged.landscapeDarkness;
    if (merged.subtitlePosition !== undefined)
      subtitlePosition.value = merged.subtitlePosition;
    if (merged.subtitleOffset !== undefined)
      subtitleOffset.value = merged.subtitleOffset;
    if (merged.subtitleSyncOffset !== undefined)
      subtitleSyncOffset.value = merged.subtitleSyncOffset;
    if (merged.autoAdaptiveSubtitles !== undefined)
      autoAdaptiveSubtitles.value = merged.autoAdaptiveSubtitles;
    if (merged.font !== undefined) font.value = merged.font;
    if (merged.fontSize !== undefined) fontSize.value = merged.fontSize;
    if (merged.cropMode !== undefined) cropMode.value = merged.cropMode;
    if (merged.cropMap !== undefined) cropMap.value = merged.cropMap;
    if (merged.cropPercentX !== undefined)
      cropPercentX.value = merged.cropPercentX;
    if (merged.cropPercentXTop !== undefined)
      cropPercentXTop.value = merged.cropPercentXTop;
    if (merged.cropPercentXBottom !== undefined)
      cropPercentXBottom.value = merged.cropPercentXBottom;
    if (merged.splitZoomTop !== undefined)
      splitZoomTop.value = merged.splitZoomTop;
    if (merged.splitZoomBottom !== undefined)
      splitZoomBottom.value = merged.splitZoomBottom;
    if (merged.splitOffsetXTop !== undefined)
      splitOffsetXTop.value = merged.splitOffsetXTop;
    if (merged.splitOffsetYTop !== undefined)
      splitOffsetYTop.value = merged.splitOffsetYTop;
    if (merged.splitOffsetXBottom !== undefined)
      splitOffsetXBottom.value = merged.splitOffsetXBottom;
    if (merged.splitOffsetYBottom !== undefined)
      splitOffsetYBottom.value = merged.splitOffsetYBottom;
    if (merged.subtitleMode !== undefined)
      subtitleMode.value = merged.subtitleMode;
    if (merged.subtitleAnimation !== undefined)
      subtitleAnimation.value = merged.subtitleAnimation;
    if (merged.subtitleHighlightMode !== undefined)
      subtitleHighlightMode.value = merged.subtitleHighlightMode;
    if (merged.subtitleHighlightColor !== undefined)
      subtitleHighlightColor.value = merged.subtitleHighlightColor;
    if (merged.subtitleTextColor !== undefined)
      subtitleTextColor.value = merged.subtitleTextColor;
    if (merged.subtitleStrokeColor !== undefined)
      subtitleStrokeColor.value = merged.subtitleStrokeColor;
    if (merged.subtitleStrokeWidth !== undefined)
      subtitleStrokeWidth.value = merged.subtitleStrokeWidth;
    if (merged.subtitleFontWeight !== undefined)
      subtitleFontWeight.value = merged.subtitleFontWeight;
    if (merged.subtitleTextTransform !== undefined)
      subtitleTextTransform.value = merged.subtitleTextTransform;
    if (merged.subtitleBackground !== undefined)
      subtitleBackground.value = merged.subtitleBackground;
    if (merged.subtitleBackgroundOpacity !== undefined)
      subtitleBackgroundOpacity.value = merged.subtitleBackgroundOpacity;
    if (merged.subtitleWordSpacing !== undefined)
      subtitleWordSpacing.value = merged.subtitleWordSpacing;
    if (merged.volume !== undefined) volume.value = merged.volume;
    if (merged.subtitlePreset !== undefined)
      selectedPreset.value = merged.subtitlePreset;
    if (merged.subtitlesEnabled !== undefined)
      subtitlesEnabled.value = merged.subtitlesEnabled;
  }

  function resetStyleSettings() {
    loadStyleSettings(DEFAULT_SUBTITLE_STYLES);
  }

  function applyPreset(presetOrId: SubtitlePreset | string) {
    const preset =
      typeof presetOrId === 'string'
        ? SUBTITLE_PRESETS.find(p => p.id === presetOrId)
        : presetOrId;

    if (!preset) return;

    subtitlePreset.value = preset.id;
    font.value = preset.font;
    fontSize.value = preset.fontSize;
    subtitleFontWeight.value = preset.fontWeight;
    subtitleTextColor.value = preset.color;
    subtitleHighlightColor.value = preset.highlightColor;
    subtitleAnimation.value = preset.animation;
    subtitleHighlightMode.value = preset.highlightMode;
    subtitleBackground.value = preset.background;
    subtitleStrokeWidth.value = preset.strokeWidth;
    subtitleTextTransform.value = preset.textTransform;
  }

  function toggleSubtitles() {
    subtitlesEnabled.value = !subtitlesEnabled.value;
  }

  function toRemotionProps(): RemotionStyleBundle {
    return SubtitleStyleCoordinator.extractRemotionProps(getStyleSnapshot());
  }

  function toRenderPayload(): BackendRenderStylePayload {
    return SubtitleStyleCoordinator.extractRenderPayload(getStyleSnapshot());
  }

  async function saveStyleSettings(
    folderName: string,
    clipId: string
  ): Promise<void> {
    if (!folderName || !clipId) return;
    try {
      await $fetch(`${API_BASE}/api/style-settings`, {
        method: 'PUT',
        body: {
          folder_name: folderName,
          clip_id: clipId,
          settings: getStyleSnapshot()
        }
      });
    } catch (e) {
      console.error('Failed to save style settings', e);
    }
  }

  async function saveDefaultStyleSettings(): Promise<void> {
    try {
      await $fetch(`${API_BASE}/api/default-style-settings`, {
        method: 'PUT',
        body: {
          settings: getStyleSnapshot()
        }
      });
    } catch (e) {
      console.error('Failed to save default style settings', e);
    }
  }

  return {
    // Reactive properties
    videoLayout,
    landscapeBackground,
    landscapeBlurRadius,
    landscapeDarkness,
    subtitlePosition,
    subtitleOffset,
    subtitleSyncOffset,
    autoAdaptiveSubtitles,
    font,
    fontSize,
    cropMode,
    cropMap,
    cropPercentX,
    cropPercentXTop,
    cropPercentXBottom,
    splitZoomTop,
    splitZoomBottom,
    splitOffsetXTop,
    splitOffsetYTop,
    splitOffsetXBottom,
    splitOffsetYBottom,
    subtitleMode,
    subtitleAnimation,
    subtitleHighlightMode,
    subtitleHighlightColor,
    subtitleTextColor,
    subtitleStrokeColor,
    subtitleStrokeWidth,
    subtitleFontWeight,
    subtitleTextTransform,
    subtitleBackground,
    subtitleBackgroundOpacity,
    subtitleWordSpacing,
    volume,
    subtitlePreset,
    selectedPreset,
    subtitlesEnabled,

    // Projections
    getStyleSnapshot,
    toRemotionProps,
    toRenderPayload,

    // Actions
    loadStyleSettings,
    resetStyleSettings,
    applyPreset,
    toggleSubtitles,
    saveStyleSettings,
    saveDefaultStyleSettings
  };
};
