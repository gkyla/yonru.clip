import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PresetStudioViewport from '../../app/components/editor/PresetStudioViewport.vue';
import { SUBTITLE_PRESETS } from '../../app/constants/subtitlePresets';

describe('PresetStudioViewport Component', () => {
  const hormoziPreset = SUBTITLE_PRESETS.find(p => p.id === 'bold-podcast')!;

  it('renders the standardized 3-word phrase "THAT WAS CRAZY" with proper word tokenization', () => {
    const wrapper = mount(PresetStudioViewport, {
      props: {
        preset: hormoziPreset
      }
    });

    // Outer text contains full phrase
    expect(wrapper.text()).toContain('THAT WAS CRAZY');

    // 3 distinct word token elements are rendered
    const words = wrapper.findAll('[data-viewport-word]');
    expect(words.length).toBe(3);
    expect(words[0]!.text()).toBe('THAT');
    expect(words[1]!.text()).toBe('WAS');
    expect(words[2]!.text()).toBe('CRAZY');
  });

  it('binds typographic properties, stroke shadow, and metadata attributes correctly', () => {
    const wrapper = mount(PresetStudioViewport, {
      props: {
        preset: hormoziPreset
      }
    });

    // Root metadata attributes
    expect(wrapper.attributes('data-preset-id')).toBe('bold-podcast');
    expect(wrapper.attributes('data-animation')).toBe('pop');
    expect(wrapper.attributes('data-highlight-mode')).toBe('color');
    expect(wrapper.attributes('data-background')).toBe('none');

    // Typographic styling on text wrapper
    const textWrapper = wrapper.find('.viewport-text-wrapper');
    const style = textWrapper.attributes('style') || '';
    expect(style).toContain('font-family: Montserrat');
    expect(style).toContain('font-weight: 900');
    expect(style).toContain('color: #FFFFFF');
    expect(style).toContain('text-transform: uppercase');

    // Background styling across variants
    const blurPreset = SUBTITLE_PRESETS.find(p => p.id === 'clean-vlog')!;
    const blurWrapper = mount(PresetStudioViewport, {
      props: { preset: blurPreset }
    });
    expect(blurWrapper.attributes('data-background')).toBe('blur');
    expect(blurWrapper.find('.viewport-text-wrapper').classes()).toContain(
      'backdrop-blur-md'
    );

    const boxPreset = SUBTITLE_PRESETS.find(p => p.id === 'studio-talk')!;
    const boxWrapper = mount(PresetStudioViewport, {
      props: { preset: boxPreset }
    });
    expect(boxWrapper.attributes('data-background')).toBe('box');
    expect(boxWrapper.find('.viewport-text-wrapper').classes()).toContain(
      'bg-slate-950/85'
    );
  });

  describe('Kinetic animation engine & highlight modes', () => {
    it('applies chunk entrance animation classes for pop, bounce, slide-up, and fade', () => {
      // 1. Pop
      const popPreset = SUBTITLE_PRESETS.find(p => p.animation === 'pop')!;
      const popWrapper = mount(PresetStudioViewport, {
        props: { preset: popPreset }
      });
      expect(popWrapper.find('.viewport-text-wrapper').classes()).toContain(
        'kinetic-pop'
      );
      expect(popWrapper.attributes('data-animation-mode')).toBe('chunk');

      // 2. Bounce
      const bouncePreset = SUBTITLE_PRESETS.find(
        p => p.animation === 'bounce'
      )!;
      const bounceWrapper = mount(PresetStudioViewport, {
        props: { preset: bouncePreset }
      });
      expect(bounceWrapper.find('.viewport-text-wrapper').classes()).toContain(
        'kinetic-bounce'
      );
      expect(bounceWrapper.attributes('data-animation-mode')).toBe('chunk');

      // 3. Slide-up
      const slidePreset = SUBTITLE_PRESETS.find(
        p => p.animation === 'slide-up'
      )!;
      const slideWrapper = mount(PresetStudioViewport, {
        props: { preset: slidePreset }
      });
      expect(slideWrapper.find('.viewport-text-wrapper').classes()).toContain(
        'kinetic-slide-up'
      );
      expect(slideWrapper.attributes('data-animation-mode')).toBe('chunk');

      // 4. Fade
      const fadePreset = SUBTITLE_PRESETS.find(p => p.animation === 'fade')!;
      const fadeWrapper = mount(PresetStudioViewport, {
        props: { preset: fadePreset }
      });
      expect(fadeWrapper.find('.viewport-text-wrapper').classes()).toContain(
        'kinetic-fade'
      );
      expect(fadeWrapper.attributes('data-animation-mode')).toBe('chunk');
    });

    it('stages word timing across sequential animations (karaoke and typewriter)', () => {
      // 1. Karaoke
      const karaokePreset = SUBTITLE_PRESETS.find(
        p => p.animation === 'karaoke'
      )!;
      const karaokeWrapper = mount(PresetStudioViewport, {
        props: { preset: karaokePreset }
      });
      expect(karaokeWrapper.attributes('data-animation-mode')).toBe(
        'sequential'
      );
      expect(karaokeWrapper.find('.viewport-text-wrapper').classes()).toContain(
        'kinetic-karaoke'
      );

      const karaokeWords = karaokeWrapper.findAll('[data-viewport-word]');
      expect(karaokeWords[0]!.classes()).toContain('kinetic-karaoke-word-0');
      expect(karaokeWords[1]!.classes()).toContain('kinetic-karaoke-word-1');
      expect(karaokeWords[2]!.classes()).toContain('kinetic-karaoke-word-2');

      // 2. Typewriter
      const typewriterPreset = SUBTITLE_PRESETS.find(
        p => p.animation === 'typewriter'
      )!;
      const typewriterWrapper = mount(PresetStudioViewport, {
        props: { preset: typewriterPreset }
      });
      expect(typewriterWrapper.attributes('data-animation-mode')).toBe(
        'sequential'
      );
      expect(
        typewriterWrapper.find('.viewport-text-wrapper').classes()
      ).toContain('kinetic-typewriter');

      const typewriterWords = typewriterWrapper.findAll('[data-viewport-word]');
      expect(typewriterWords[0]!.classes()).toContain(
        'kinetic-typewriter-word-0'
      );
      expect(typewriterWords[1]!.classes()).toContain(
        'kinetic-typewriter-word-1'
      );
      expect(typewriterWords[2]!.classes()).toContain(
        'kinetic-typewriter-word-2'
      );
    });

    it('highlights the third word "CRAZY" according to highlightMode (color, scale, box, underline)', () => {
      // Color highlight
      const colorPreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'color'
      )!;
      const colorWrapper = mount(PresetStudioViewport, {
        props: { preset: colorPreset }
      });
      const colorThirdWord = colorWrapper.findAll('[data-viewport-word]')[2]!;
      expect(colorThirdWord.attributes('data-highlight-active')).toBe('true');
      expect(colorThirdWord.attributes('style')).toContain(
        `color: ${colorPreset.highlightColor}`
      );

      // Scale highlight
      const scalePreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'scale'
      )!;
      const scaleWrapper = mount(PresetStudioViewport, {
        props: { preset: scalePreset }
      });
      const scaleThirdWord = scaleWrapper.findAll('[data-viewport-word]')[2]!;
      expect(scaleThirdWord.attributes('data-highlight-active')).toBe('true');
      expect(scaleThirdWord.classes()).toContain('font-black');

      // Box highlight
      const boxHighlightPreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'box'
      )!;
      const boxWrapper = mount(PresetStudioViewport, {
        props: { preset: boxHighlightPreset }
      });
      const boxThirdWord = boxWrapper.findAll('[data-viewport-word]')[2]!;
      expect(boxThirdWord.attributes('data-highlight-active')).toBe('true');
      expect(boxThirdWord.attributes('style')).toContain(
        `background-color: ${boxHighlightPreset.highlightColor}`
      );
      expect(boxThirdWord.attributes('style')).toContain('color: rgb(0, 0, 0)');

      // Underline highlight
      const underlinePreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'underline'
      )!;
      const underlineWrapper = mount(PresetStudioViewport, {
        props: { preset: underlinePreset }
      });
      const underlineThirdWord = underlineWrapper.findAll(
        '[data-viewport-word]'
      )[2]!;
      expect(underlineThirdWord.attributes('data-highlight-active')).toBe(
        'true'
      );
      const underlineBar = underlineThirdWord.find('.viewport-underline-bar');
      expect(underlineBar.exists()).toBe(true);
      expect(underlineBar.attributes('style')).toContain(
        `background-color: ${underlinePreset.highlightColor}`
      );
    });

    it('binds stagger delay offset style property when provided', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          staggerDelay: '0.3s'
        }
      });

      expect(wrapper.attributes('data-stagger-delay')).toBe('0.3s');
      const style = wrapper.attributes('style') || '';
      expect(style).toContain('--stagger-delay: 0.3s');
    });

    it('converts numeric stagger delay prop into second units', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          staggerDelay: 0.4
        }
      });

      expect(wrapper.attributes('data-stagger-delay')).toBe('0.4s');
      const style = wrapper.attributes('style') || '';
      expect(style).toContain('--stagger-delay: 0.4s');
    });

    it('handles highlightMode "none" without active highlight attributes', () => {
      const nonePreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'none'
      )!;
      const wrapper = mount(PresetStudioViewport, {
        props: { preset: nonePreset }
      });

      const words = wrapper.findAll('[data-viewport-word]');
      for (const w of words) {
        expect(w.attributes('data-highlight-active')).toBeUndefined();
      }
    });

    it('renders custom sampleWords and custom fontSize when provided', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          sampleWords: ['UNREAL', 'MAGIC', 'ACTION'],
          fontSize: 18
        }
      });

      expect(wrapper.text()).toContain('UNREAL MAGIC ACTION');
      const words = wrapper.findAll('[data-viewport-word]');
      expect(words.length).toBe(3);
      expect(words[0]!.text()).toBe('UNREAL');
      expect(words[2]!.text()).toBe('ACTION');

      const style =
        wrapper.find('.viewport-text-wrapper').attributes('style') || '';
      expect(style).toContain('font-size: 18px');
    });

    it('mounts every preset from SUBTITLE_PRESETS cleanly without runtime error', () => {
      for (const preset of SUBTITLE_PRESETS) {
        const wrapper = mount(PresetStudioViewport, {
          props: { preset }
        });
        expect(wrapper.attributes('data-preset-id')).toBe(preset.id);
        expect(wrapper.attributes('data-animation')).toBe(preset.animation);
        expect(wrapper.attributes('data-highlight-mode')).toBe(
          preset.highlightMode
        );
        expect(wrapper.findAll('[data-viewport-word]').length).toBe(3);
      }
    });
  });
});
