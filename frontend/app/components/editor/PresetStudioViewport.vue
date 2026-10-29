<template>
  <div
    class="preset-studio-viewport relative w-full h-full flex items-center justify-center overflow-hidden select-none"
    :data-preset-id="preset.id"
    :data-animation="preset.animation"
    :data-animation-mode="animationMode"
    :data-highlight-mode="preset.highlightMode"
    :data-background="preset.background"
    :data-stagger-delay="formattedStaggerDelay"
    :style="rootStyle"
  >
    <div
      class="viewport-text-wrapper inline-flex w-fit max-w-max items-center justify-center transition-all leading-tight text-center relative"
      :class="[backgroundClasses, animationClass]"
      :style="wrapperStyle"
    >
      <template v-for="(word, index) in words" :key="index">
        <span
          class="viewport-word inline-block relative transition-all"
          :class="getWordClasses(index)"
          :data-viewport-word="word"
          :data-word-index="index"
          :data-highlight-active="isHighlightTarget(index) ? 'true' : undefined"
          :style="getWordStyle(index)"
          ><span class="viewport-word-text">{{ word }}</span
          ><span
            v-if="
              isHighlightTarget(index) && preset.highlightMode === 'underline'
            "
            class="viewport-underline-bar absolute -bottom-1 left-0.5 right-0.5 h-[2px] rounded-full pointer-events-none"
            :class="getUnderlineClasses(index)"
            :style="{
              backgroundColor: preset.highlightColor,
              boxShadow: `0 0 4px ${preset.highlightColor}66`
            }"
          ></span></span
        ><span v-if="index < words.length - 1" class="viewport-space">{{
          ' '
        }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SubtitlePreset } from '../../constants/subtitlePresets';
import { getOuterStrokeShadow } from '../../utils/subtitleStyleCoordinator';

interface Props {
  preset: SubtitlePreset;
  sampleWords?: string[];
  staggerDelay?: string | number;
  fontSize?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  sampleWords: () => ['THAT', 'WAS', 'CRAZY'],
  staggerDelay: 0,
  fontSize: 13
});

const words = computed(() => {
  if (Array.isArray(props.sampleWords)) {
    return props.sampleWords;
  }
  return ['THAT', 'WAS', 'CRAZY'];
});

const formattedStaggerDelay = computed(() => {
  if (typeof props.staggerDelay === 'number') {
    return Number.isFinite(props.staggerDelay)
      ? `${props.staggerDelay}s`
      : '0s';
  }
  return props.staggerDelay || '0s';
});

const rootStyle = computed(() => {
  return {
    '--stagger-delay': formattedStaggerDelay.value,
    '--highlight-color': props.preset.highlightColor,
    '--primary-color': props.preset.color
  };
});

const animationMode = computed(() => {
  if (
    props.preset.animation === 'karaoke' ||
    props.preset.animation === 'typewriter'
  ) {
    return 'sequential';
  }
  return 'chunk';
});

const animationClass = computed(() => {
  switch (props.preset.animation) {
    case 'pop':
      return 'kinetic-pop';
    case 'bounce':
      return 'kinetic-bounce';
    case 'slide-up':
      return 'kinetic-slide-up';
    case 'fade':
      return 'kinetic-fade';
    case 'karaoke':
      return 'kinetic-karaoke';
    case 'typewriter':
      return 'kinetic-typewriter';
    default:
      return '';
  }
});

const backgroundClasses = computed(() => {
  switch (props.preset.background) {
    case 'box':
      return 'bg-slate-950/85 px-2.5 py-1 rounded-md';
    case 'blur':
      return 'bg-slate-900/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10';
    default:
      return 'px-1.5 py-0.5';
  }
});

const wrapperStyle = computed(() => {
  const fSize =
    typeof props.fontSize === 'number' ? `${props.fontSize}px` : props.fontSize;

  const style: Record<string, string | number> = {
    fontFamily: props.preset.font,
    fontSize: fSize,
    fontWeight: props.preset.fontWeight,
    color: props.preset.color,
    textTransform: props.preset.textTransform || 'none',
    textShadow: getOuterStrokeShadow(props.preset.strokeWidth)
  };

  if (props.preset.background === 'blur') {
    style.borderRadius = '0.4em';
    style.border = '1px solid rgba(255,255,255,0.1)';
    style.backdropFilter = 'blur(12px)';
    style.WebkitBackdropFilter = 'blur(12px)';
  } else if (props.preset.background === 'box') {
    style.borderRadius = '0.32em';
  }

  return style;
});

function isHighlightTarget(index: number): boolean {
  if (props.preset.highlightMode === 'none') {
    return false;
  }
  // The kinetic sweep engine animates the first 3 tokens (0, 1, 2)
  return index < 3;
}

function getWordClasses(index: number) {
  const classes: Record<string, boolean> = {};

  if (props.preset.highlightMode === 'box') {
    classes['viewport-word-box'] = true;
  }

  if (index < 3) {
    if (props.preset.animation === 'karaoke') {
      classes[`kinetic-karaoke-word-${index}`] = true;
    } else if (props.preset.animation === 'typewriter') {
      classes[`kinetic-typewriter-word-${index}`] = true;
    }

    if (props.preset.highlightMode === 'color') {
      classes[`kinetic-sweep-color-${index}`] = true;
    } else if (props.preset.highlightMode === 'scale') {
      classes[`kinetic-sweep-scale-${index}`] = true;
    } else if (props.preset.highlightMode === 'box') {
      classes[`kinetic-sweep-box-${index}`] = true;
    }
  }

  return classes;
}

function getUnderlineClasses(index: number) {
  return {
    [`kinetic-sweep-underline-${index}`]: true
  };
}

function getWordStyle(_index: number) {
  return {};
}
</script>

<style scoped>
/* Kinetic Chunk Animations (2.4s cycle) */
.kinetic-pop {
  animation: kinetic-pop-anim 2.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    infinite;
  animation-delay: var(--stagger-delay, 0s);
  transform-origin: center center;
  will-change: transform, opacity;
}

@keyframes kinetic-pop-anim {
  0% {
    transform: scale(0.6) rotate(-1.5deg);
    opacity: 0;
  }
  12% {
    transform: scale(1.12) rotate(0.8deg);
    opacity: 1;
  }
  25% {
    transform: scale(0.98) rotate(-0.2deg);
    opacity: 1;
  }
  35% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  83.3% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 0;
  }
}

.kinetic-bounce {
  animation: kinetic-bounce-anim 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s);
  transform-origin: center center;
  will-change: transform, opacity;
}

@keyframes kinetic-bounce-anim {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  15% {
    transform: scale(1.18);
    opacity: 1;
  }
  25% {
    transform: scale(0.96);
    opacity: 1;
  }
  35% {
    transform: scale(1);
    opacity: 1;
  }
  83.3% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

.kinetic-slide-up {
  animation: kinetic-slide-up-anim 2.4s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

@keyframes kinetic-slide-up-anim {
  0% {
    transform: translateY(20px);
    opacity: 0;
  }
  25% {
    transform: translateY(-2px);
    opacity: 1;
  }
  35% {
    transform: translateY(0);
    opacity: 1;
  }
  83.3% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(0);
    opacity: 0;
  }
}

.kinetic-fade {
  animation: kinetic-fade-anim 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: opacity;
}

@keyframes kinetic-fade-anim {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  83.3% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* Zero-layout-shift box highlight mode baseline */
.viewport-word-box {
  padding: 1px 5px;
  border-radius: 4px;
  background-color: transparent;
}

/* Natural word separation to prevent cramping across uppercase and condensed fonts */
.viewport-space {
  display: inline-block;
  width: 0.45em;
  white-space: pre;
  flex-shrink: 0;
  text-align: center;
}

/* Sequential Animations (2.4s cycle) */
.kinetic-karaoke {
  animation: kinetic-karaoke-chunk 2.4s ease-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

@keyframes kinetic-karaoke-chunk {
  0% {
    transform: scale(0.92);
    opacity: 0;
  }
  12% {
    transform: scale(1);
    opacity: 1;
  }
  83.3% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

.kinetic-karaoke-word-0 {
  animation: kinetic-karaoke-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: opacity;
}

@keyframes kinetic-karaoke-w0 {
  0% {
    opacity: 1;
  }
  14.5% {
    opacity: 1;
  }
  14.6% {
    opacity: 0.5;
  }
  83.3% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
  }
}

.kinetic-karaoke-word-1 {
  animation: kinetic-karaoke-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: opacity;
}

@keyframes kinetic-karaoke-w1 {
  0%,
  14.5% {
    opacity: 1;
  }
  14.6% {
    opacity: 1;
  }
  29.1% {
    opacity: 1;
  }
  29.2% {
    opacity: 0.5;
  }
  83.3% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
  }
}

.kinetic-karaoke-word-2 {
  animation: kinetic-karaoke-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: opacity;
}

@keyframes kinetic-karaoke-w2 {
  0%,
  29.1% {
    opacity: 1;
  }
  29.2% {
    opacity: 1;
  }
  83.3% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.kinetic-typewriter {
  animation: kinetic-typewriter-fade-out 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: opacity;
}

@keyframes kinetic-typewriter-fade-out {
  0%,
  83.3% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.kinetic-typewriter-word-0 {
  animation: kinetic-typewriter-w0 2.4s ease-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

@keyframes kinetic-typewriter-w0 {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  10% {
    opacity: 1;
    transform: translateY(0);
  }
  83.3% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(0);
  }
}

.kinetic-typewriter-word-1 {
  animation: kinetic-typewriter-w1 2.4s ease-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

@keyframes kinetic-typewriter-w1 {
  0%,
  14.5% {
    opacity: 0;
    transform: translateY(8px);
  }
  25% {
    opacity: 1;
    transform: translateY(0);
  }
  83.3% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(0);
  }
}

.kinetic-typewriter-word-2 {
  animation: kinetic-typewriter-w2 2.4s ease-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

@keyframes kinetic-typewriter-w2 {
  0%,
  29.2% {
    opacity: 0;
    transform: translateY(8px);
  }
  40% {
    opacity: 1;
    transform: translateY(0);
  }
  83.3% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(0);
  }
}

/* ==========================================================================
   Kinetic Word Sweep Engine (2.4s cycle)
   Word 0 ("THAT"):  0.00s – 0.35s (0.0% – 14.6%)
   Word 1 ("WAS"):   0.35s – 0.70s (14.6% – 29.2%)
   Word 2 ("CRAZY"): 0.70s – 2.00s (29.2% – 83.3%, held through reading pause)
   Exit / Reset:     2.00s – 2.40s (83.3% – 100.0%)
   ========================================================================== */

/* 1. Color Sweep */
.kinetic-sweep-color-0 {
  animation: kinetic-sweep-color-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: color, transform;
}

@keyframes kinetic-sweep-color-w0 {
  0% {
    color: var(--highlight-color);
    transform: scale(1.08);
  }
  14.5% {
    color: var(--highlight-color);
    transform: scale(1.08);
  }
  14.6% {
    color: inherit;
    transform: scale(1);
  }
  100% {
    color: inherit;
    transform: scale(1);
  }
}

.kinetic-sweep-color-1 {
  animation: kinetic-sweep-color-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: color, transform;
}

@keyframes kinetic-sweep-color-w1 {
  0%,
  14.5% {
    color: inherit;
    transform: scale(1);
  }
  14.6% {
    color: var(--highlight-color);
    transform: scale(1.08);
  }
  29.1% {
    color: var(--highlight-color);
    transform: scale(1.08);
  }
  29.2% {
    color: inherit;
    transform: scale(1);
  }
  100% {
    color: inherit;
    transform: scale(1);
  }
}

.kinetic-sweep-color-2 {
  animation: kinetic-sweep-color-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: color, transform;
}

@keyframes kinetic-sweep-color-w2 {
  0%,
  29.1% {
    color: inherit;
    transform: scale(1);
  }
  29.2% {
    color: var(--highlight-color);
    transform: scale(1.08);
  }
  83.3% {
    color: var(--highlight-color);
    transform: scale(1.08);
  }
  83.4% {
    color: inherit;
    transform: scale(1);
  }
  100% {
    color: inherit;
    transform: scale(1);
  }
}

/* 2. Scale Sweep */
.kinetic-sweep-scale-0 {
  animation: kinetic-sweep-scale-w0 2.4s cubic-bezier(0.34, 1.56, 0.64, 1)
    infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform;
}

@keyframes kinetic-sweep-scale-w0 {
  0% {
    transform: scale(1.15);
  }
  14.5% {
    transform: scale(1.15);
  }
  14.6% {
    transform: scale(1);
  }
  100% {
    transform: scale(1);
  }
}

.kinetic-sweep-scale-1 {
  animation: kinetic-sweep-scale-w1 2.4s cubic-bezier(0.34, 1.56, 0.64, 1)
    infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform;
}

@keyframes kinetic-sweep-scale-w1 {
  0%,
  14.5% {
    transform: scale(1);
  }
  14.6% {
    transform: scale(1.15);
  }
  29.1% {
    transform: scale(1.15);
  }
  29.2% {
    transform: scale(1);
  }
  100% {
    transform: scale(1);
  }
}

.kinetic-sweep-scale-2 {
  animation: kinetic-sweep-scale-w2 2.4s cubic-bezier(0.34, 1.56, 0.64, 1)
    infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: transform;
}

@keyframes kinetic-sweep-scale-w2 {
  0%,
  29.1% {
    transform: scale(1);
  }
  29.2% {
    transform: scale(1.15);
  }
  83.3% {
    transform: scale(1.15);
  }
  83.4% {
    transform: scale(1);
  }
  100% {
    transform: scale(1);
  }
}

/* 3. Box Sweep */
.kinetic-sweep-box-0 {
  animation: kinetic-sweep-box-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: background-color, color;
}

@keyframes kinetic-sweep-box-w0 {
  0% {
    background-color: var(--highlight-color);
    color: #000000;
    text-shadow: none;
  }
  14.5% {
    background-color: var(--highlight-color);
    color: #000000;
    text-shadow: none;
  }
  14.6% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
  100% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
}

.kinetic-sweep-box-1 {
  animation: kinetic-sweep-box-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: background-color, color;
}

@keyframes kinetic-sweep-box-w1 {
  0%,
  14.5% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
  14.6% {
    background-color: var(--highlight-color);
    color: #000000;
    text-shadow: none;
  }
  29.1% {
    background-color: var(--highlight-color);
    color: #000000;
    text-shadow: none;
  }
  29.2% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
  100% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
}

.kinetic-sweep-box-2 {
  animation: kinetic-sweep-box-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
  will-change: background-color, color;
}

@keyframes kinetic-sweep-box-w2 {
  0%,
  29.1% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
  29.2% {
    background-color: var(--highlight-color);
    color: #000000;
    text-shadow: none;
  }
  83.3% {
    background-color: var(--highlight-color);
    color: #000000;
    text-shadow: none;
  }
  83.4% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
  100% {
    background-color: transparent;
    color: inherit;
    text-shadow: inherit;
  }
}

/* 4. Underline Sweep */
.viewport-underline-bar {
  transform-origin: left center;
  will-change: opacity, transform;
  opacity: 0;
  transform: scaleX(0);
}

.kinetic-sweep-underline-0 {
  animation: kinetic-sweep-underline-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
}

@keyframes kinetic-sweep-underline-w0 {
  0% {
    opacity: 1;
    transform: scaleX(1);
  }
  14.5% {
    opacity: 1;
    transform: scaleX(1);
  }
  14.6% {
    opacity: 0;
    transform: scaleX(0);
  }
  100% {
    opacity: 0;
    transform: scaleX(0);
  }
}

.kinetic-sweep-underline-1 {
  animation: kinetic-sweep-underline-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
}

@keyframes kinetic-sweep-underline-w1 {
  0%,
  14.5% {
    opacity: 0;
    transform: scaleX(0);
  }
  14.6% {
    opacity: 1;
    transform: scaleX(1);
  }
  29.1% {
    opacity: 1;
    transform: scaleX(1);
  }
  29.2% {
    opacity: 0;
    transform: scaleX(0);
  }
  100% {
    opacity: 0;
    transform: scaleX(0);
  }
}

.kinetic-sweep-underline-2 {
  animation: kinetic-sweep-underline-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s);
}

@keyframes kinetic-sweep-underline-w2 {
  0%,
  29.1% {
    opacity: 0;
    transform: scaleX(0);
  }
  29.2% {
    opacity: 1;
    transform: scaleX(1);
  }
  83.3% {
    opacity: 1;
    transform: scaleX(1);
  }
  83.4% {
    opacity: 0;
    transform: scaleX(0);
  }
  100% {
    opacity: 0;
    transform: scaleX(0);
  }
}

/* ==========================================================================
   Multi-Animation Collision Resolution
   Allows simultaneous word opacity dimming / entrance and highlight sweeps
   ========================================================================== */

/* Karaoke + Color Sweep */
.kinetic-karaoke-word-0.kinetic-sweep-color-0 {
  animation:
    kinetic-karaoke-w0 2.4s ease-in-out infinite,
    kinetic-sweep-color-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, color, transform;
}

.kinetic-karaoke-word-1.kinetic-sweep-color-1 {
  animation:
    kinetic-karaoke-w1 2.4s ease-in-out infinite,
    kinetic-sweep-color-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, color, transform;
}

.kinetic-karaoke-word-2.kinetic-sweep-color-2 {
  animation:
    kinetic-karaoke-w2 2.4s ease-in-out infinite,
    kinetic-sweep-color-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, color, transform;
}

/* Karaoke + Scale Sweep */
.kinetic-karaoke-word-0.kinetic-sweep-scale-0 {
  animation:
    kinetic-karaoke-w0 2.4s ease-in-out infinite,
    kinetic-sweep-scale-w0 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, transform;
}

.kinetic-karaoke-word-1.kinetic-sweep-scale-1 {
  animation:
    kinetic-karaoke-w1 2.4s ease-in-out infinite,
    kinetic-sweep-scale-w1 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, transform;
}

.kinetic-karaoke-word-2.kinetic-sweep-scale-2 {
  animation:
    kinetic-karaoke-w2 2.4s ease-in-out infinite,
    kinetic-sweep-scale-w2 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, transform;
}

/* Karaoke + Box Sweep */
.kinetic-karaoke-word-0.kinetic-sweep-box-0 {
  animation:
    kinetic-karaoke-w0 2.4s ease-in-out infinite,
    kinetic-sweep-box-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, background-color, color;
}

.kinetic-karaoke-word-1.kinetic-sweep-box-1 {
  animation:
    kinetic-karaoke-w1 2.4s ease-in-out infinite,
    kinetic-sweep-box-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, background-color, color;
}

.kinetic-karaoke-word-2.kinetic-sweep-box-2 {
  animation:
    kinetic-karaoke-w2 2.4s ease-in-out infinite,
    kinetic-sweep-box-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: opacity, background-color, color;
}

/* Typewriter + Color Sweep */
.kinetic-typewriter-word-0.kinetic-sweep-color-0 {
  animation:
    kinetic-typewriter-w0 2.4s ease-out infinite,
    kinetic-sweep-color-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity, color;
}

.kinetic-typewriter-word-1.kinetic-sweep-color-1 {
  animation:
    kinetic-typewriter-w1 2.4s ease-out infinite,
    kinetic-sweep-color-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity, color;
}

.kinetic-typewriter-word-2.kinetic-sweep-color-2 {
  animation:
    kinetic-typewriter-w2 2.4s ease-out infinite,
    kinetic-sweep-color-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity, color;
}

/* Typewriter + Scale Sweep */
.kinetic-typewriter-word-0.kinetic-sweep-scale-0 {
  animation:
    kinetic-typewriter-w0 2.4s ease-out infinite,
    kinetic-sweep-scale-w0 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

.kinetic-typewriter-word-1.kinetic-sweep-scale-1 {
  animation:
    kinetic-typewriter-w1 2.4s ease-out infinite,
    kinetic-sweep-scale-w1 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

.kinetic-typewriter-word-2.kinetic-sweep-scale-2 {
  animation:
    kinetic-typewriter-w2 2.4s ease-out infinite,
    kinetic-sweep-scale-w2 2.4s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity;
}

/* Typewriter + Box Sweep */
.kinetic-typewriter-word-0.kinetic-sweep-box-0 {
  animation:
    kinetic-typewriter-w0 2.4s ease-out infinite,
    kinetic-sweep-box-w0 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity, background-color, color;
}

.kinetic-typewriter-word-1.kinetic-sweep-box-1 {
  animation:
    kinetic-typewriter-w1 2.4s ease-out infinite,
    kinetic-sweep-box-w1 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity, background-color, color;
}

.kinetic-typewriter-word-2.kinetic-sweep-box-2 {
  animation:
    kinetic-typewriter-w2 2.4s ease-out infinite,
    kinetic-sweep-box-w2 2.4s ease-in-out infinite;
  animation-delay: var(--stagger-delay, 0s), var(--stagger-delay, 0s);
  will-change: transform, opacity, background-color, color;
}

/* Accessibility: fallback for users with prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .kinetic-pop,
  .kinetic-bounce,
  .kinetic-slide-up,
  .kinetic-fade,
  .kinetic-karaoke,
  .kinetic-typewriter,
  .kinetic-karaoke-word-0,
  .kinetic-karaoke-word-1,
  .kinetic-karaoke-word-2,
  .kinetic-typewriter-word-0,
  .kinetic-typewriter-word-1,
  .kinetic-typewriter-word-2,
  .kinetic-sweep-color-0,
  .kinetic-sweep-color-1,
  .kinetic-sweep-color-2,
  .kinetic-sweep-scale-0,
  .kinetic-sweep-scale-1,
  .kinetic-sweep-scale-2,
  .kinetic-sweep-box-0,
  .kinetic-sweep-box-1,
  .kinetic-sweep-box-2,
  .kinetic-sweep-underline-0,
  .kinetic-sweep-underline-1,
  .kinetic-sweep-underline-2,
  .viewport-text-wrapper,
  .viewport-word,
  .viewport-underline-bar {
    animation: none !important;
    transform: none !important;
    opacity: 1 !important;
    transition: none !important;
  }
}
</style>
