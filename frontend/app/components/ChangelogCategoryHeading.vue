<template>
  <h3
    :id="id"
    class="changelog-category-header flex items-center gap-3 text-xl sm:text-2xl font-bold tracking-tight mt-8 mb-3.5"
  >
    <span
      v-if="categoryMeta.emoji || categoryMeta.icon"
      class="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 shadow-sm"
      :class="categoryMeta.badgeClass"
    >
      <span
        v-if="categoryMeta.emoji"
        class="category-emoji text-2xl leading-none select-none"
        role="img"
      >
        {{ categoryMeta.emoji }}
      </span>
      <Icon
        v-else-if="categoryMeta.icon"
        :name="categoryMeta.icon"
        :class="categoryMeta.iconColor"
        class="text-lg shrink-0"
      />
    </span>
    <span class="changelog-category-title font-bold tracking-tight text-white">
      <slot></slot>
    </span>
  </h3>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  id?: string;
}>();

interface CategoryConfig {
  emoji?: string;
  icon?: string;
  iconColor?: string;
  badgeClass?: string;
}

const categoryMeta = computed<CategoryConfig>(() => {
  const headingId = (props.id || '').toLowerCase();

  // Features (Violet / Chef 👨‍🍳)
  if (headingId.includes('feature') || headingId.includes('new')) {
    return {
      emoji: '👨‍🍳',
      badgeClass: ''
    };
  }

  // Improvements / Enhancements / Performance (Amber / Wrench 🔧)
  if (
    headingId.includes('improve') ||
    headingId.includes('perf') ||
    headingId.includes('enhanc')
  ) {
    return {
      emoji: '🔧',
      badgeClass: ''
    };
  }

  // Bug Fixes (Rose / Ladybug 🐞)
  if (headingId.includes('fix') || headingId.includes('bug')) {
    return {
      emoji: '🐞',
      badgeClass: ''
    };
  }

  // Fallback for standard headings
  return {
    badgeClass: 'bg-white/[0.04] border-white/10'
  };
});
</script>
