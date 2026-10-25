<template>
  <h3
    :id="id"
    class="changelog-category-header flex items-center gap-2.5 text-lg font-bold tracking-tight mt-7 mb-3"
  >
    <span
      v-if="categoryMeta.icon"
      class="inline-flex items-center justify-center w-7 h-7 rounded-md border shrink-0 shadow-sm"
      :class="categoryMeta.badgeClass"
    >
      <Icon
        :name="categoryMeta.icon"
        :class="categoryMeta.iconColor"
        class="text-base shrink-0"
      />
    </span>
    <span
      class="changelog-category-title font-bold tracking-tight"
      :class="categoryMeta.titleColor"
    >
      <slot />
    </span>
  </h3>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  id?: string;
}>();

interface CategoryConfig {
  icon?: string;
  iconColor?: string;
  titleColor: string;
  badgeClass?: string;
}

const categoryMeta = computed<CategoryConfig>(() => {
  const headingId = (props.id || '').toLowerCase();

  // Features (Emerald)
  if (headingId.includes('feature') || headingId.includes('new')) {
    return {
      icon: 'lucide:sparkles',
      iconColor: 'text-emerald-400',
      titleColor: 'text-emerald-400',
      badgeClass: 'border-emerald-500/30'
    };
  }

  // Improvements / Enhancements / Performance (Amber)
  if (
    headingId.includes('improve') ||
    headingId.includes('perf') ||
    headingId.includes('enhanc')
  ) {
    return {
      icon: 'lucide:wrench',
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-400',
      badgeClass: 'border-amber-500/30'
    };
  }

  // Bug Fixes (Rose)
  if (headingId.includes('fix') || headingId.includes('bug')) {
    return {
      icon: 'lucide:bug',
      iconColor: 'text-rose-400',
      titleColor: 'text-rose-400',
      badgeClass: 'border-rose-500/30'
    };
  }

  // Fallback for standard headings
  return {
    titleColor: 'text-white',
    badgeClass: 'border-white/10'
  };
});
</script>
