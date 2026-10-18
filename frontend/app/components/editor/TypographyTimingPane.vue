<template>
  <div class="space-y-4">
    <!-- Font Family & Text Transform -->
    <div class="space-y-2.5">
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between"
      >
        <span>Font & Case</span>
        <Icon name="ri:font-family" class="text-slate-400" />
      </h2>

      <div>
        <label
          class="text-[9px] text-slate-400 block mb-1 font-bold uppercase tracking-wider"
          >Font Family</label
        >
        <select
          v-if="state?.font"
          v-model="state.font.value"
          class="w-full bg-surface-dark/60 border border-surface-border rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:border-accent-500 transition-colors"
        >
          <option v-for="f in FONT_OPTIONS" :key="f" :value="f">
            {{ f }}
          </option>
          <option value="Arial">Arial (System)</option>
        </select>
      </div>

      <div>
        <label
          class="text-[9px] text-slate-400 block mb-1 font-bold uppercase tracking-wider"
          >Text Case</label
        >
        <div class="grid grid-cols-3 gap-1">
          <button
            v-for="tt in ['uppercase', 'capitalize', 'none']"
            :key="tt"
            class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all uppercase tracking-wider hover:bg-surface-card cursor-pointer"
            :class="
              state?.subtitleTextTransform?.value === tt
                ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
                : 'text-slate-400 hover:border-accent-500/40'
            "
            @click="state.subtitleTextTransform.value = tt"
          >
            {{ tt === 'none' ? 'Normal' : tt }}
          </button>
        </div>
      </div>
    </div>

    <hr class="border-surface-border/40" />

    <!-- Dual-Column Numeric Inputs Grid -->
    <div class="space-y-2.5">
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between"
      >
        <span>Sizing & Weights</span>
        <Icon name="ri:equalizer-line" class="text-slate-400" />
      </h2>

      <!-- Row 1: Font Size & Font Weight -->
      <div class="grid grid-cols-2 gap-1.5">
        <div
          class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-1.5 space-y-1"
        >
          <div class="flex justify-between items-center">
            <span
              class="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider"
              >Size</span
            >
            <span
              class="mono text-[8.5px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
              >{{ state?.fontSize?.value }}px</span
            >
          </div>
          <input
            v-if="state?.fontSize"
            v-model.number="state.fontSize.value"
            type="range"
            min="40"
            max="140"
            class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div
          class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-1.5 space-y-1"
        >
          <div class="flex justify-between items-center">
            <span
              class="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider"
              >Weight</span
            >
            <span
              v-if="!SINGLE_WEIGHT_FONTS.has(state?.font?.value)"
              class="mono text-[8.5px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
              >{{ state?.subtitleFontWeight?.value }}</span
            >
            <span v-else class="text-[8px] text-slate-500 font-bold uppercase"
              >Fixed</span
            >
          </div>
          <input
            v-if="
              !SINGLE_WEIGHT_FONTS.has(state?.font?.value) &&
              state?.subtitleFontWeight
            "
            v-model.number="state.subtitleFontWeight.value"
            type="range"
            min="400"
            max="900"
            step="100"
            class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
          />
          <div v-else class="h-1 bg-surface-border/40 rounded-lg"></div>
        </div>
      </div>

      <!-- Row 2: Stroke Width & Word Spacing -->
      <div class="grid grid-cols-2 gap-1.5">
        <div
          class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-1.5 space-y-1"
        >
          <div class="flex justify-between items-center">
            <span
              class="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider"
              >Stroke</span
            >
            <span
              class="mono text-[8.5px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
              >{{ state?.subtitleStrokeWidth?.value }}px</span
            >
          </div>
          <input
            v-if="state?.subtitleStrokeWidth"
            v-model.number="state.subtitleStrokeWidth.value"
            type="range"
            min="0"
            max="8"
            step="1"
            class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div
          class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-1.5 space-y-1"
        >
          <div class="flex justify-between items-center">
            <span
              class="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider"
              >Spacing</span
            >
            <span
              class="mono text-[8.5px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
              >{{ state?.subtitleWordSpacing?.value }}px</span
            >
          </div>
          <input
            v-if="state?.subtitleWordSpacing"
            v-model.number="state.subtitleWordSpacing.value"
            :disabled="state?.renderStatus?.value === 'rendering'"
            type="range"
            min="-20"
            max="80"
            step="1"
            class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30"
          />
        </div>
      </div>
    </div>

    <hr class="border-surface-border/40" />

    <!-- Compact Color Swatch Bar -->
    <div class="space-y-2.5">
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between"
      >
        <span>Color System</span>
        <Icon name="ri:palette-fill" class="text-slate-400" />
      </h2>

      <!-- Swatch Trigger Bar -->
      <div
        class="grid grid-cols-3 gap-1.5 bg-surface-dark/60 border border-surface-border/80 rounded-xl p-1"
      >
        <button
          class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border cursor-pointer"
          :class="
            activeColorPicker === 'text'
              ? 'border-accent-500 bg-accent-500/10'
              : 'border-surface-border/50 hover:bg-surface-card'
          "
          @click="
            activeColorPicker = activeColorPicker === 'text' ? null : 'text'
          "
        >
          <div
            class="w-5 h-5 rounded-md border border-white/20 shadow-sm"
            :style="{ background: state?.subtitleTextColor?.value }"
          ></div>
          <span
            class="text-[9px] font-bold uppercase tracking-wider text-slate-300"
            >Text</span
          >
        </button>

        <button
          class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border cursor-pointer"
          :class="
            activeColorPicker === 'highlight'
              ? 'border-accent-500 bg-accent-500/10'
              : 'border-surface-border/50 hover:bg-surface-card'
          "
          @click="
            activeColorPicker =
              activeColorPicker === 'highlight' ? null : 'highlight'
          "
        >
          <div
            class="w-5 h-5 rounded-md border border-white/20 shadow-sm"
            :style="{ background: state?.subtitleHighlightColor?.value }"
          ></div>
          <span
            class="text-[9px] font-bold uppercase tracking-wider text-slate-300"
            >Highlight</span
          >
        </button>

        <button
          class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border cursor-pointer"
          :class="
            activeColorPicker === 'stroke'
              ? 'border-accent-500 bg-accent-500/10'
              : 'border-surface-border/50 hover:bg-surface-card'
          "
          @click="
            activeColorPicker = activeColorPicker === 'stroke' ? null : 'stroke'
          "
        >
          <div
            class="w-5 h-5 rounded-md border border-white/20 shadow-sm"
            :style="{ background: state?.subtitleStrokeColor?.value }"
          ></div>
          <span
            class="text-[9px] font-bold uppercase tracking-wider text-slate-300"
            >Stroke</span
          >
        </button>
      </div>

      <!-- Inline Swatch Palette Popover Drawer -->
      <div
        v-if="activeColorPicker"
        class="bg-surface-dark/80 border border-surface-border rounded-xl p-2.5 space-y-2 animate-in zoom-in-95 duration-150"
      >
        <div class="flex justify-between items-center">
          <span
            class="text-[9px] font-bold uppercase tracking-wider text-accent-500"
          >
            Select {{ activeColorPicker }} Color
          </span>
          <button
            class="text-slate-500 hover:text-white cursor-pointer"
            @click="activeColorPicker = null"
          >
            <Icon name="ri:close-line" class="text-sm" />
          </button>
        </div>

        <!-- Palette options for Text & Highlight -->
        <div
          v-if="
            activeColorPicker === 'text' || activeColorPicker === 'highlight'
          "
          class="flex gap-1.5 flex-wrap"
        >
          <button
            v-for="c in palette"
            :key="activeColorPicker + '-' + c"
            class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110 cursor-pointer"
            :class="
              (activeColorPicker === 'text'
                ? state?.subtitleTextColor?.value
                : state?.subtitleHighlightColor?.value) === c
                ? 'border-accent-500 scale-110'
                : 'border-transparent'
            "
            :style="{ background: c }"
            @click="
              activeColorPicker === 'text'
                ? (state.subtitleTextColor.value = c)
                : (state.subtitleHighlightColor.value = c)
            "
          ></button>
          <input
            type="color"
            :value="
              activeColorPicker === 'text'
                ? state?.subtitleTextColor?.value
                : state?.subtitleHighlightColor?.value
            "
            class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent"
            title="Custom color"
            @input="
              e =>
                activeColorPicker === 'text'
                  ? (state.subtitleTextColor.value = e.target.value)
                  : (state.subtitleHighlightColor.value = e.target.value)
            "
          />
        </div>

        <!-- Palette options for Stroke -->
        <div
          v-if="activeColorPicker === 'stroke'"
          class="flex gap-1.5 flex-wrap"
        >
          <button
            v-for="c in [
              '#000000',
              '#FFFFFF',
              '#1a1a1a',
              '#333333',
              '#EF4444',
              '#3B82F6'
            ]"
            :key="'stroke-' + c"
            class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110 cursor-pointer"
            :class="
              state?.subtitleStrokeColor?.value === c
                ? 'border-accent-500 scale-110'
                : 'border-white/10'
            "
            :style="{ background: c }"
            @click="state.subtitleStrokeColor.value = c"
          ></button>
          <input
            v-if="state?.subtitleStrokeColor"
            v-model="state.subtitleStrokeColor.value"
            type="color"
            class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent"
            title="Custom color"
          />
        </div>
      </div>
    </div>

    <hr class="border-surface-border/40" />

    <!-- Text Background -->
    <div class="space-y-2.5">
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between"
      >
        <span>Text Background</span>
        <Icon name="ri:shape-2-line" class="text-slate-400" />
      </h2>
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="bg in backgrounds"
          :key="bg.id"
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all hover:bg-surface-card cursor-pointer"
          :class="
            state?.subtitleBackground?.value === bg.id
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
              : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
          "
          @click="state.subtitleBackground.value = bg.id"
        >
          {{ bg.label }}
        </button>
      </div>

      <!-- Opacity Slider -->
      <div
        v-if="state?.subtitleBackground?.value !== 'none'"
        class="mt-2.5 bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1 transition-all"
      >
        <div class="flex justify-between items-center">
          <span
            class="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"
          >
            <Icon name="ri:drop-line" class="text-accent-500" />
            Opacity
          </span>
          <span
            class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
            >{{
              Math.round(
                (state?.subtitleBackgroundOpacity?.value ?? 0.7) * 100
              )
            }}%</span
          >
        </div>
        <input
          v-if="state?.subtitleBackgroundOpacity"
          v-model.number="state.subtitleBackgroundOpacity.value"
          :disabled="state?.renderStatus?.value === 'rendering'"
          type="range"
          min="0"
          max="1"
          step="0.05"
          class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, useAttrs } from 'vue';
import {
  useClipperState,
  FONT_OPTIONS
} from '../../composables/useClipperState';

const props = defineProps({
  clipperState: {
    type: Object,
    default: null
  }
});

const attrs = useAttrs();

let defaultState = null;
try {
  defaultState = useClipperState();
} catch {
  // Graceful fallback for test environments
}

const state = props.clipperState || attrs.state || defaultState;

const activeColorPicker = ref(null); // null | 'text' | 'highlight' | 'stroke'

const SINGLE_WEIGHT_FONTS = new Set([
  'Bebas Neue',
  'Anton',
  'Bangers',
  'Permanent Marker',
  'Russo One',
  'Luckiest Guy',
  'Titan One',
  'Lilita One',
  'Passion One'
]);

const palette = [
  '#FFFFFF',
  '#CFFF50',
  '#FFD700',
  '#EF4444',
  '#60A5FA',
  '#A78BFA',
  '#34D399',
  '#FB923C',
  '#F472B6',
  '#000000'
];

const backgrounds = [
  { id: 'none', label: 'None' },
  { id: 'box', label: 'Dark Box' },
  { id: 'blur', label: 'Blur Pill' }
];
</script>
