import { describe, it, expect } from 'vitest';
import {
  SubtitleStyleCoordinator,
  DEFAULT_SUBTITLE_STYLES
} from '../../app/utils/subtitleStyleCoordinator';
import { SUBTITLE_PRESETS } from '../../app/constants/subtitlePresets';

describe('SubtitleStyleCoordinator Domain Engine', () => {
  it('initializes with canonical default style settings', () => {
    const coordinator = new SubtitleStyleCoordinator();
    const settings = coordinator.getSettings();

    expect(settings.font).toBe('Montserrat');
    expect(settings.fontSize).toBe(50);
    expect(settings.videoLayout).toBe('vertical');
    expect(settings.subtitlePreset).toBe('bold-podcast');
    expect(settings.subtitlesEnabled).toBe(true);
    expect(settings.autoAdaptiveSubtitles).toBe(true);
  });

  it('correctly merges partial overrides without losing base properties', () => {
    const coordinator = new SubtitleStyleCoordinator({
      font: 'Outfit',
      fontSize: 60
    });

    const settings = coordinator.getSettings();
    expect(settings.font).toBe('Outfit');
    expect(settings.fontSize).toBe(60);
    expect(settings.subtitlePosition).toBe('center'); // preserved from default
    expect(settings.videoLayout).toBe('vertical'); // preserved
  });

  it('safely handles null and undefined in merge', () => {
    const coordinator = new SubtitleStyleCoordinator();
    const result1 = coordinator.merge(DEFAULT_SUBTITLE_STYLES, null);
    const result2 = coordinator.merge(DEFAULT_SUBTITLE_STYLES, undefined);

    expect(result1.font).toBe('Montserrat');
    expect(result2.font).toBe('Montserrat');
  });

  it('updates settings incrementally with update()', () => {
    const coordinator = new SubtitleStyleCoordinator();
    coordinator.update({
      subtitleHighlightColor: '#FF0000',
      subtitleAnimation: 'slide-up'
    });

    const settings = coordinator.getSettings();
    expect(settings.subtitleHighlightColor).toBe('#FF0000');
    expect(settings.subtitleAnimation).toBe('slide-up');
    expect(settings.font).toBe('Montserrat'); // unchanged
  });

  it('applies a preset by ID or object and updates typography and animation', () => {
    const coordinator = new SubtitleStyleCoordinator();
    const cleanVlogPreset = SUBTITLE_PRESETS.find(p => p.id === 'clean-vlog')!;

    coordinator.applyPreset('clean-vlog');
    const settings = coordinator.getSettings();

    expect(settings.subtitlePreset).toBe('clean-vlog');
    expect(settings.font).toBe(cleanVlogPreset.font);
    expect(settings.subtitleTextColor).toBe(cleanVlogPreset.color);
    expect(settings.subtitleHighlightColor).toBe(
      cleanVlogPreset.highlightColor
    );
  });

  it('ignores invalid preset ID gracefully', () => {
    const coordinator = new SubtitleStyleCoordinator();
    const before = coordinator.getSettings();

    coordinator.applyPreset('non-existent-preset-xyz');
    const after = coordinator.getSettings();

    expect(after).toEqual(before);
  });

  it('preserves non-typographic settings (layout, pacing, position) when applying a preset', () => {
    const coordinator = new SubtitleStyleCoordinator({
      videoLayout: 'landscape',
      landscapeBackground: 'blur',
      subtitlePosition: 'top',
      subtitleOffset: 85,
      subtitleSyncOffset: 220,
      subtitleMode: '3_words'
    });

    coordinator.applyPreset('clean-vlog');
    const settings = coordinator.getSettings();

    // Typographic fields updated
    expect(settings.subtitlePreset).toBe('clean-vlog');
    expect(settings.font).toBe('Outfit');

    // Non-typographic fields strictly preserved
    expect(settings.videoLayout).toBe('landscape');
    expect(settings.landscapeBackground).toBe('blur');
    expect(settings.subtitlePosition).toBe('top');
    expect(settings.subtitleOffset).toBe(85);
    expect(settings.subtitleSyncOffset).toBe(220);
    expect(settings.subtitleMode).toBe('3_words');
  });

  it('resets back to canonical default settings', () => {
    const coordinator = new SubtitleStyleCoordinator({
      font: 'Arial',
      fontSize: 100,
      videoLayout: 'landscape'
    });

    expect(coordinator.getSettings().font).toBe('Arial');
    coordinator.reset();
    expect(coordinator.getSettings().font).toBe('Montserrat');
    expect(coordinator.getSettings().videoLayout).toBe('vertical');
  });

  it('assembles RemotionStyleBundle with exact structure expected by Remotion Player', () => {
    const coordinator = new SubtitleStyleCoordinator({
      font: 'Bebas Neue',
      fontSize: 70,
      subtitlePosition: 'bottom',
      subtitleOffset: 40,
      subtitleTextColor: '#FFFFFF',
      subtitleHighlightColor: '#00FF00',
      landscapeBackground: 'blur'
    });

    const remotionBundle = coordinator.toRemotionProps();

    expect(remotionBundle.position).toBe('bottom');
    expect(remotionBundle.landscapeBackground).toBe('blur');
    expect(remotionBundle.subtitleOffset).toBe(40);
    expect(remotionBundle.subtitleStyle).toEqual({
      fontFamily: 'Bebas Neue',
      fontSize: 70,
      fontWeight: 900,
      color: '#FFFFFF',
      highlightColor: '#00FF00',
      strokeColor: '#000000',
      strokeWidth: 0,
      textTransform: 'uppercase',
      animation: 'pop',
      highlightMode: 'color',
      background: 'none',
      backgroundOpacity: 0.7,
      wordSpacing: 0
    });
  });

  it('assembles BackendRenderStylePayload with snake_case fields matching RenderRequest', () => {
    const coordinator = new SubtitleStyleCoordinator({
      font: 'Inter',
      fontSize: 48,
      videoLayout: 'landscape',
      landscapeBackground: 'blur',
      landscapeBlurRadius: 30,
      landscapeDarkness: 40,
      subtitlePosition: 'top',
      subtitleOffset: 60,
      subtitleSyncOffset: 200,
      subtitleMode: '3_words'
    });

    const payload = coordinator.toRenderPayload();

    expect(payload.font).toBe('Inter');
    expect(payload.font_size).toBe(48);
    expect(payload.video_layout).toBe('landscape');
    expect(payload.landscape_background).toBe('blur');
    expect(payload.landscape_blur_radius).toBe(30);
    expect(payload.landscape_darkness).toBe(40);
    expect(payload.subtitle_position).toBe('top');
    expect(payload.subtitle_offset).toBe(60);
    expect(payload.subtitle_sync_offset).toBe(200);
    expect(payload.subtitle_mode).toBe('3_words');
    expect(payload.subtitles_enabled).toBe(true);
  });

  it('static extractRemotionProps works from ad-hoc partial settings', () => {
    const bundle = SubtitleStyleCoordinator.extractRemotionProps({
      font: 'Roboto',
      fontSize: 42
    });

    expect(bundle.subtitleStyle.fontFamily).toBe('Roboto');
    expect(bundle.subtitleStyle.fontSize).toBe(42);
    expect(bundle.position).toBe('center');
  });

  it('static extractRenderPayload works from ad-hoc partial settings', () => {
    const payload = SubtitleStyleCoordinator.extractRenderPayload({
      font: 'Roboto',
      fontSize: 42,
      videoLayout: 'vertical'
    });

    expect(payload.font).toBe('Roboto');
    expect(payload.font_size).toBe(42);
    expect(payload.video_layout).toBe('vertical');
  });
});
