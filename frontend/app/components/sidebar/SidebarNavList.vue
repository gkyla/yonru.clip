<template>
  <!-- Section 2: Main Navigation Items & Persistent Single Active Pill -->
  <div
    class="flex flex-col gap-1 shrink-0"
    :class="isCollapsed ? '-mt-[19px]' : ''"
  >
    <!-- Header Label (Synchronous 0ms Delay, Fixed Height) -->
    <div
      class="overflow-hidden whitespace-nowrap transition-all duration-150 ease-out h-5 flex items-center"
      :class="
        isCollapsed
          ? 'max-w-0 opacity-0 pointer-events-none'
          : 'max-w-[200px] opacity-100 pointer-events-auto'
      "
    >
      <span
        class="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50"
        >Main Navigation</span
      >
    </div>

    <!-- Navigation Buttons Stack -->
    <div class="relative flex flex-col gap-2 w-full mt-0.5">
      <!-- Persistent Single Sliding Active Pill Indicator -->
      <span
        v-if="activeNavIndex >= 0"
        class="absolute -left-3 w-1 rounded-r-full bg-accent-500 shadow-[0_0_8px_rgba(255,215,0,0.6)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none z-10"
        :style="{
          top: `${activeNavIndex * 48 + 10}px`,
          height: '20px'
        }"
      ></span>

      <!-- Persistent Navigation Item Hitboxes -->
      <div
        v-for="item in navItemsConfig"
        :key="item.id"
        class="relative group w-full"
      >
        <button
          class="h-10 flex items-center rounded-xl transition-colors duration-200 cursor-pointer w-full overflow-hidden"
          :class="[
            activeView === item.id
              ? 'bg-white/[0.06] text-white font-semibold'
              : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
          ]"
          :title="isCollapsed ? item.label : undefined"
          @click="$emit('navigate', item.id)"
        >
          <!-- 40px Stationary Icon Hitbox -->
          <div
            class="w-10 h-10 shrink-0 flex items-center justify-center relative"
          >
            <Icon
              :name="item.icon"
              class="text-lg group-hover:scale-105 transition-transform"
              :class="
                activeView === item.id
                  ? 'text-accent-500'
                  : 'text-white/70 group-hover:text-white'
              "
            />
            <div
              v-if="item.id === 'settings' && isAnyPrerequisiteMissing"
              class="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-amber"
              title="Prerequisite setup requires attention in Settings"
            ></div>
          </div>

          <!-- Horizontally Collapsing Label -->
          <div
            class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0"
            :class="
              isCollapsed
                ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none'
                : 'max-w-[160px] opacity-100 duration-200 delay-75 translate-x-0'
            "
          >
            <span class="text-sm font-medium pr-3">{{ item.label }}</span>
          </div>
        </button>

        <!-- Collapsed Flyout Tooltip -->
        <div
          v-if="isCollapsed"
          class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap"
        >
          {{ item.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  isCollapsed: boolean;
  activeView: string;
  isAnyPrerequisiteMissing?: boolean;
}>();

defineEmits<{
  (e: 'navigate', view: string): void;
}>();

const navItemsConfig = [
  { id: 'home', label: 'Home', icon: 'lucide:home' },
  { id: 'prompts', label: 'Prompts', icon: 'carbon:prompt-template' },
  { id: 'docs', label: 'Documentation', icon: 'lucide:book-open' },
  { id: 'settings', label: 'Settings', icon: 'lucide:settings' }
] as const;

const navItemsList = ['home', 'prompts', 'docs', 'settings'] as const;

const activeNavIndex = computed(() => {
  return navItemsList.indexOf(props.activeView as any);
});
</script>

<style scoped>
@keyframes pulse-amber {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0);
  }
}
.animate-pulse-amber {
  animation: pulse-amber 2s infinite;
}
</style>
