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
      class="viewport-text-wrapper inline-flex items-center justify-center transition-all leading-tight text-center relative"
      :class="[backgroundClasses, animationClass]"
      :style="wrapperStyle"
    >
      <template v-for="(word, index) in words" :key="index">
        <span
          class="viewport-word inline-block relative"
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
            :style="{ backgroundColor: preset.highlightColor }"
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

const words = computed(() => props.sampleWords);

const formattedStaggerDelay = computed(() => {
  if (typeof props.staggerDelay === 'number') {
    return `${props.staggerDelay}s`;
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
      return 'bg-slate-950/85 px-2.5 py-1 rounded-lg';
    case 'blur':
      return 'bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10';
    default:
      return 'px-1.5 py-0.5';
  }
});

const wrapperStyle = computed(() => {
  const fSize =
    typeof props.fontSize === 'number' ? `${props.fontSize}px` : props.fontSize;

  return {
    fontFamily: props.preset.font,
    fontSize: fSize,
    fontWeight: props.preset.fontWeight,
    color: props.preset.color,
    textTransform:
      props.preset.textTransform === 'uppercase'
        ? ('uppercase' as const)
        : props.preset.textTransform === 'capitalize'
          ? ('capitalize' as const)
          : ('none' as const),
    textShadow: getOuterStrokeShadow(props.preset.strokeWidth)
  };
});

function isHighlightTarget(index: number): boolean {
  if (props.preset.highlightMode === 'none') {
    return false;
  }
  // The standardized 3-word phrase ("THAT WAS CRAZY") highlights the 3rd word "CRAZY"
  return index === words.value.length - 1;
}

function getWordClasses(index: number) {
  const isTarget = isHighlightTarget(index);
  const classes: Record<string, boolean> = {
    'font-black': isTarget && props.preset.highlightMode === 'scale'
  };

  if (props.preset.animation === 'karaoke') {
    classes[`kinetic-karaoke-word-${index}`] = true;
  } else if (props.preset.animation === 'typewriter') {
    classes[`kinetic-typewriter-word-${index}`] = true;
  }

  return classes;
}

function getWordStyle(index: number) {
  const style: Record<string, string | number> = {};

  if (isHighlightTarget(index)) {
    if (props.preset.highlightMode === 'color') {
      style.color = props.preset.highlightColor;
    } else if (props.preset.highlightMode === 'box') {
      style.backgroundColor = props.preset.highlightColor;
      style.color = 'rgb(0, 0, 0)';
      style.borderRadius = '4px';
      style.padding = '1px 5px';
      style.textShadow = 'none';
    }
  }

  return style;
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
  will-change: transform, opacity, color;
}

@keyframes kinetic-karaoke-w0 {
  0% {
    opacity: 0.8;
  }
  5% {
    color: var(--highlight-color);
    transform: scale(1.08);
    opacity: 1;
  }
  14.5% {
    color: var(--highlight-color);
    transform: scale(1.08);
    opacity: 1;
  }
  15% {
    color: inherit;
    transform: scale(1);
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
  will-change: transform, opacity, color;
}

@keyframes kinetic-karaoke-w1 {
  0%,
  14.5% {
    opacity: 0.6;
    color: inherit;
    transform: scale(1);
  }
  15% {
    color: var(--highlight-color);
    transform: scale(1.08);
    opacity: 1;
  }
  29.2% {
    color: var(--highlight-color);
    transform: scale(1.08);
    opacity: 1;
  }
  29.7% {
    color: inherit;
    transform: scale(1);
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
  will-change: transform, opacity, color;
}

@keyframes kinetic-karaoke-w2 {
  0%,
  29.2% {
    opacity: 0.6;
  }
  29.7% {
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
