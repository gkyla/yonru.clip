import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import fs from 'node:fs';
import path from 'node:path';
import PresetStudioViewport from '../../app/components/editor/PresetStudioViewport.vue';
import { SUBTITLE_PRESETS } from '../../app/constants/subtitlePresets';
import { getOuterStrokeShadow } from '../../app/utils/subtitleStyleCoordinator';

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

    // Distinct non-collapsing word spaces are rendered between tokens
    const spaces = wrapper.findAll('.viewport-space');
    expect(spaces.length).toBe(2);
    expect(spaces[0]!.element.textContent).toBe(' ');
    expect(spaces[1]!.element.textContent).toBe(' ');
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
    const blurTextWrapper = blurWrapper.find('.viewport-text-wrapper');
    expect(blurTextWrapper.classes()).toContain('backdrop-blur-md');
    expect(blurTextWrapper.classes()).toContain('rounded-md');
    expect(blurTextWrapper.classes()).not.toContain('rounded-full');
    expect(blurTextWrapper.classes()).not.toContain('rounded-[20px]');
    expect(blurTextWrapper.classes()).toContain('w-fit');
    expect(blurTextWrapper.classes()).not.toContain('w-full');
    const blurStyle = blurTextWrapper.attributes('style') || '';
    expect(blurStyle).toContain('border-radius: 0.4em');
    expect(blurStyle).toContain('border: 1px solid rgba(255, 255, 255, 0.1)');

    const boxPreset = SUBTITLE_PRESETS.find(p => p.id === 'studio-talk')!;
    const boxWrapper = mount(PresetStudioViewport, {
      props: { preset: boxPreset }
    });
    expect(boxWrapper.attributes('data-background')).toBe('box');
    const boxTextWrapper = boxWrapper.find('.viewport-text-wrapper');
    expect(boxTextWrapper.classes()).toContain('bg-slate-950/85');
    expect(boxTextWrapper.classes()).toContain('rounded-md');
    expect(boxTextWrapper.classes()).not.toContain('rounded-[16px]');
    const boxStyle = boxTextWrapper.attributes('style') || '';
    expect(boxStyle).toContain('border-radius: 0.32em');
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

    it('orchestrates sequential Kinetic Word Sweep across all words according to highlightMode (color, scale, box, underline)', () => {
      // 1. Color highlight sweep
      const colorPreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'color'
      )!;
      const colorWrapper = mount(PresetStudioViewport, {
        props: { preset: colorPreset }
      });
      const colorWords = colorWrapper.findAll('[data-viewport-word]');
      expect(colorWords.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(colorWords[i]!.attributes('data-highlight-active')).toBe('true');
        expect(colorWords[i]!.classes()).toContain(`kinetic-sweep-color-${i}`);
      }

      // 2. Scale highlight sweep
      const scalePreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'scale'
      )!;
      const scaleWrapper = mount(PresetStudioViewport, {
        props: { preset: scalePreset }
      });
      const scaleWords = scaleWrapper.findAll('[data-viewport-word]');
      expect(scaleWords.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(scaleWords[i]!.attributes('data-highlight-active')).toBe('true');
        expect(scaleWords[i]!.classes()).toContain(`kinetic-sweep-scale-${i}`);
      }

      // 3. Box highlight sweep (with layout shift prevention padding)
      const boxHighlightPreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'box'
      )!;
      const boxWrapper = mount(PresetStudioViewport, {
        props: { preset: boxHighlightPreset }
      });
      const boxWords = boxWrapper.findAll('[data-viewport-word]');
      expect(boxWords.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(boxWords[i]!.attributes('data-highlight-active')).toBe('true');
        expect(boxWords[i]!.classes()).toContain('viewport-word-box');
        expect(boxWords[i]!.classes()).toContain(`kinetic-sweep-box-${i}`);
      }

      // 4. Underline highlight sweep
      const underlinePreset = SUBTITLE_PRESETS.find(
        p => p.highlightMode === 'underline'
      )!;
      const underlineWrapper = mount(PresetStudioViewport, {
        props: { preset: underlinePreset }
      });
      const underlineWords = underlineWrapper.findAll('[data-viewport-word]');
      expect(underlineWords.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(underlineWords[i]!.attributes('data-highlight-active')).toBe(
          'true'
        );
        const underlineBar = underlineWords[i]!.find('.viewport-underline-bar');
        expect(underlineBar.exists()).toBe(true);
        expect(underlineBar.classes()).toContain(
          `kinetic-sweep-underline-${i}`
        );
        expect(underlineBar.attributes('style')).toContain(
          `background-color: ${underlinePreset.highlightColor}`
        );
      }
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

  describe('R1: Minimal Glass Preset (clean-vlog) Parity', () => {
    const cleanVlogPreset = SUBTITLE_PRESETS.find(p => p.id === 'clean-vlog')!;

    it('shrink-wraps the frosted blur pill without spanning container width', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: { preset: cleanVlogPreset }
      });
      const textWrapper = wrapper.find('.viewport-text-wrapper');
      expect(textWrapper.classes()).toContain('inline-flex');
      expect(textWrapper.classes()).toContain('w-fit');
      expect(textWrapper.classes()).toContain('max-w-max');
      expect(textWrapper.classes()).not.toContain('w-full');
    });

    it('matches Remotion border, borderRadius, and backdropFilter with gentle rounded corners instead of pill', () => {
      // Test Minimal Glass (clean-vlog)
      const wrapper = mount(PresetStudioViewport, {
        props: { preset: cleanVlogPreset }
      });
      const textWrapper = wrapper.find('.viewport-text-wrapper');
      expect(textWrapper.classes()).toContain('backdrop-blur-md');
      expect(textWrapper.classes()).toContain('rounded-md');
      expect(textWrapper.classes()).not.toContain('rounded-full');
      expect(textWrapper.classes()).not.toContain('rounded-[20px]');
      expect(textWrapper.classes()).toContain('border');
      expect(textWrapper.classes()).toContain('border-white/10');

      const style = textWrapper.attributes('style') || '';
      expect(style).toContain('border-radius: 0.4em');
      expect(style).toContain('border: 1px solid rgba(255, 255, 255, 0.1)');
      expect(style).toContain('backdrop-filter: blur(12px)');
      expect(style).toContain('text-transform: uppercase');

      // Test Cyber Neon (cyber-neon)
      const cyberNeonPreset = SUBTITLE_PRESETS.find(
        p => p.id === 'cyber-neon'
      )!;
      const cyberWrapper = mount(PresetStudioViewport, {
        props: { preset: cyberNeonPreset }
      });
      const cyberTextWrapper = cyberWrapper.find('.viewport-text-wrapper');
      expect(cyberTextWrapper.classes()).toContain('backdrop-blur-md');
      expect(cyberTextWrapper.classes()).toContain('rounded-md');
      expect(cyberTextWrapper.classes()).not.toContain('rounded-full');
      expect(cyberTextWrapper.classes()).not.toContain('rounded-[20px]');
      const cyberStyle = cyberTextWrapper.attributes('style') || '';
      expect(cyberStyle).toContain('border-radius: 0.4em');
    });
  });

  describe('R2: Karaoke Presets & Past Word Dimming', () => {
    const karaokePresets = SUBTITLE_PRESETS.filter(
      p => p.animation === 'karaoke'
    );

    it('attaches both sequential karaoke classes and sweep highlight classes without conflict', () => {
      for (const preset of karaokePresets) {
        const wrapper = mount(PresetStudioViewport, {
          props: { preset }
        });
        const words = wrapper.findAll('[data-viewport-word]');
        expect(words.length).toBe(3);

        for (let i = 0; i < 3; i++) {
          expect(words[i]!.classes()).toContain(`kinetic-karaoke-word-${i}`);
          if (preset.highlightMode === 'scale') {
            expect(words[i]!.classes()).toContain(`kinetic-sweep-scale-${i}`);
          } else if (preset.highlightMode === 'color') {
            expect(words[i]!.classes()).toContain(`kinetic-sweep-color-${i}`);
          }
        }
      }
    });

    it('defines non-conflicting multi-animation compound CSS rules in stylesheet', () => {
      const componentPath = path.resolve(
        __dirname,
        '../../app/components/editor/PresetStudioViewport.vue'
      );
      const content = fs.readFileSync(componentPath, 'utf-8');

      // Verify compound multi-animation selectors exist to avoid shorthand collisions
      expect(content).toContain(
        '.kinetic-karaoke-word-0.kinetic-sweep-color-0'
      );
      expect(content).toContain(
        '.kinetic-karaoke-word-1.kinetic-sweep-color-1'
      );
      expect(content).toContain(
        '.kinetic-karaoke-word-2.kinetic-sweep-color-2'
      );
      expect(content).toContain(
        '.kinetic-karaoke-word-0.kinetic-sweep-scale-0'
      );
      expect(content).toContain(
        '.kinetic-karaoke-word-1.kinetic-sweep-scale-1'
      );
      expect(content).toContain(
        '.kinetic-karaoke-word-2.kinetic-sweep-scale-2'
      );
      expect(content).toContain('.kinetic-karaoke-word-0.kinetic-sweep-box-0');
      expect(content).toContain('.kinetic-karaoke-word-1.kinetic-sweep-box-1');
      expect(content).toContain('.kinetic-karaoke-word-2.kinetic-sweep-box-2');

      // Verify typewriter compound multi-animation selectors
      expect(content).toContain(
        '.kinetic-typewriter-word-0.kinetic-sweep-color-0'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-1.kinetic-sweep-color-1'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-2.kinetic-sweep-color-2'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-0.kinetic-sweep-scale-0'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-1.kinetic-sweep-scale-1'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-2.kinetic-sweep-scale-2'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-0.kinetic-sweep-box-0'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-1.kinetic-sweep-box-1'
      );
      expect(content).toContain(
        '.kinetic-typewriter-word-2.kinetic-sweep-box-2'
      );

      // Verify past word dimming keyframes set opacity: 0.5
      expect(content).toMatch(
        /@keyframes kinetic-karaoke-w0\s*\{[\s\S]*?opacity:\s*0\.5;/
      );
      expect(content).toMatch(
        /@keyframes kinetic-karaoke-w1\s*\{[\s\S]*?opacity:\s*0\.5;/
      );
    });

    it('handles custom typewriter preset paired with scale highlight without collision', () => {
      const customTypewriterScalePreset = {
        ...SUBTITLE_PRESETS.find(p => p.id === 'documentary')!,
        animation: 'typewriter' as const,
        highlightMode: 'scale' as const
      };
      const wrapper = mount(PresetStudioViewport, {
        props: { preset: customTypewriterScalePreset }
      });
      const words = wrapper.findAll('[data-viewport-word]');
      expect(words.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(words[i]!.classes()).toContain(`kinetic-typewriter-word-${i}`);
        expect(words[i]!.classes()).toContain(`kinetic-sweep-scale-${i}`);
      }
    });
  });

  describe('R3: Comprehensive 1:1 Preset Audit across all 12 target presets', () => {
    const targetPresetIds = [
      'bold-podcast',
      'clean-vlog',
      'street',
      'documentary',
      'karaoke',
      'minimal',
      'beast-punch',
      'red-alert',
      'studio-talk',
      'interview-pro',
      'cyber-neon',
      'comic-pop'
    ];

    it.each(targetPresetIds)(
      'preset "%s" has 1:1 typographic and visual parity with Remotion specification',
      presetId => {
        const preset = SUBTITLE_PRESETS.find(p => p.id === presetId)!;
        expect(preset).toBeDefined();

        const wrapper = mount(PresetStudioViewport, {
          props: { preset }
        });

        // 1. Root attributes
        expect(wrapper.attributes('data-preset-id')).toBe(preset.id);
        expect(wrapper.attributes('data-animation')).toBe(preset.animation);
        expect(wrapper.attributes('data-highlight-mode')).toBe(
          preset.highlightMode
        );
        expect(wrapper.attributes('data-background')).toBe(preset.background);

        const textWrapper = wrapper.find('.viewport-text-wrapper');
        const style = textWrapper.attributes('style') || '';

        // 2. Typography
        expect(style).toContain(preset.font);
        expect(style).toContain(`font-weight: ${preset.fontWeight}`);
        expect(style).toContain(`color: ${preset.color}`);
        expect(style).toContain(
          `text-transform: ${preset.textTransform === 'none' ? 'none' : preset.textTransform}`
        );

        // 3. Stroke shadows
        const expectedShadow = getOuterStrokeShadow(preset.strokeWidth);
        expect(style).toContain(`text-shadow: ${expectedShadow}`);

        // 4. Background styling parity
        if (preset.background === 'blur') {
          expect(textWrapper.classes()).toContain('backdrop-blur-md');
          expect(textWrapper.classes()).toContain('rounded-md');
          expect(textWrapper.classes()).not.toContain('rounded-full');
          expect(textWrapper.classes()).not.toContain('rounded-[20px]');
          expect(textWrapper.classes()).toContain('w-fit');
          expect(style).toContain('border-radius: 0.4em');
          expect(style).toContain('border: 1px solid rgba(255, 255, 255, 0.1)');
        } else if (preset.background === 'box') {
          expect(textWrapper.classes()).toContain('bg-slate-950/85');
          expect(textWrapper.classes()).toContain('rounded-md');
          expect(textWrapper.classes()).not.toContain('rounded-[16px]');
          expect(style).toContain('border-radius: 0.32em');
        } else {
          expect(textWrapper.classes()).not.toContain('backdrop-blur-md');
          expect(textWrapper.classes()).not.toContain('bg-slate-950/85');
        }

        // 5. Highlight Mode parity
        const words = wrapper.findAll('[data-viewport-word]');
        expect(words.length).toBe(3);

        for (let i = 0; i < 3; i++) {
          if (preset.highlightMode === 'none') {
            expect(
              words[i]!.attributes('data-highlight-active')
            ).toBeUndefined();
          } else {
            expect(words[i]!.attributes('data-highlight-active')).toBe('true');
          }

          if (preset.highlightMode === 'color') {
            expect(words[i]!.classes()).toContain(`kinetic-sweep-color-${i}`);
          } else if (preset.highlightMode === 'scale') {
            expect(words[i]!.classes()).toContain(`kinetic-sweep-scale-${i}`);
          } else if (preset.highlightMode === 'box') {
            expect(words[i]!.classes()).toContain('viewport-word-box');
            expect(words[i]!.classes()).toContain(`kinetic-sweep-box-${i}`);
          } else if (preset.highlightMode === 'underline') {
            const bar = words[i]!.find('.viewport-underline-bar');
            expect(bar.exists()).toBe(true);
            expect(bar.classes()).toContain(`kinetic-sweep-underline-${i}`);
          }
        }
      }
    );
  });

  describe('Edge cases & defensive boundaries', () => {
    it('handles empty sampleWords gracefully without crashing', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          sampleWords: []
        }
      });
      expect(wrapper.findAll('[data-viewport-word]').length).toBe(0);
      expect(wrapper.findAll('.viewport-space').length).toBe(0);
    });

    it('renders single word without trailing space element', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          sampleWords: ['LONE']
        }
      });
      const words = wrapper.findAll('[data-viewport-word]');
      expect(words.length).toBe(1);
      expect(words[0]!.text()).toBe('LONE');
      expect(wrapper.findAll('.viewport-space').length).toBe(0);
    });

    it('respects textTransform lowercase properly', () => {
      const lowercasePreset = {
        ...hormoziPreset,
        textTransform: 'lowercase' as any
      };
      const wrapper = mount(PresetStudioViewport, {
        props: { preset: lowercasePreset }
      });
      const style =
        wrapper.find('.viewport-text-wrapper').attributes('style') || '';
      expect(style).toContain('text-transform: lowercase');
    });

    it('handles null or non-array sampleWords by falling back safely to benchmark phrase', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          sampleWords: null as any
        }
      });
      expect(wrapper.text()).toContain('THAT WAS CRAZY');
      const words = wrapper.findAll('[data-viewport-word]');
      expect(words.length).toBe(3);
    });

    it('handles NaN numeric staggerDelay safely by defaulting to "0s"', () => {
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: hormoziPreset,
          staggerDelay: NaN
        }
      });
      expect(wrapper.attributes('data-stagger-delay')).toBe('0s');
      const style = wrapper.attributes('style') || '';
      expect(style).toContain('--stagger-delay: 0s');
    });

    it('restricts kinetic sweep target and avoids phantom underline bars for word sequences > 3 tokens', () => {
      const documentaryPreset = SUBTITLE_PRESETS.find(
        p => p.id === 'documentary'
      )!;
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: documentaryPreset,
          sampleWords: ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO']
        }
      });

      const words = wrapper.findAll('[data-viewport-word]');
      expect(words.length).toBe(5);

      // Tokens 0, 1, 2 participate in kinetic sweep
      for (let i = 0; i < 3; i++) {
        expect(words[i]!.attributes('data-highlight-active')).toBe('true');
        expect(words[i]!.find('.viewport-underline-bar').exists()).toBe(true);
        expect(words[i]!.classes()).toContain(`kinetic-typewriter-word-${i}`);
      }

      // Tokens 3, 4 render static without phantom active highlight or stuck underline bar
      for (let i = 3; i < 5; i++) {
        expect(words[i]!.attributes('data-highlight-active')).toBeUndefined();
        expect(words[i]!.find('.viewport-underline-bar').exists()).toBe(false);
        expect(words[i]!.classes()).not.toContain(
          `kinetic-typewriter-word-${i}`
        );
        expect(words[i]!.classes()).not.toContain(
          `kinetic-sweep-underline-${i}`
        );
      }
    });

    it('omits non-existent karaoke sweep classes for words beyond index 2', () => {
      const karaokePreset = SUBTITLE_PRESETS.find(p => p.id === 'karaoke')!;
      const wrapper = mount(PresetStudioViewport, {
        props: {
          preset: karaokePreset,
          sampleWords: ['ONE', 'TWO', 'THREE', 'FOUR']
        }
      });

      const words = wrapper.findAll('[data-viewport-word]');
      expect(words.length).toBe(4);

      expect(words[0]!.classes()).toContain('kinetic-karaoke-word-0');
      expect(words[0]!.classes()).toContain('kinetic-sweep-color-0');

      expect(words[3]!.classes()).not.toContain('kinetic-karaoke-word-3');
      expect(words[3]!.classes()).not.toContain('kinetic-sweep-color-3');
    });
  });
});
