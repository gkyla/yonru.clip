<template>
  <div
    v-if="state"
    ref="sidebarRef"
    class="h-full flex flex-col relative bg-surface-panel/50 border-r border-surface-border shrink-0 select-none overflow-hidden"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <!-- Segmented Tab Navigation Header (Always Clear & Interactive) -->
    <div
      class="px-2.5 pt-2.5 pb-2 border-b border-surface-border/50 bg-surface-dark/40 shrink-0"
    >
      <div
        class="grid grid-cols-3 gap-1 bg-surface-dark/80 p-0.5 rounded-xl border border-surface-border/60"
      >
        <button
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="
            activeTab === 'style'
              ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
              : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
          "
          @click="activeTab = 'style'"
        >
          <Icon name="ri:palette-line" class="text-xs shrink-0" />
          <span>Presets</span>
        </button>

        <button
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="
            activeTab === 'type'
              ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
              : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
          "
          @click="activeTab = 'type'"
        >
          <Icon name="ri:font-size" class="text-xs shrink-0" />
          <span>Text</span>
        </button>

        <button
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="
            activeTab === 'layout'
              ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
              : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
          "
          @click="activeTab = 'layout'"
        >
          <Icon name="ri:layout-grid-line" class="text-xs shrink-0" />
          <span>Layout</span>
        </button>
      </div>
    </div>

    <!-- Scrollable Tab Content View (Dimmed during pipeline/render) -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div
        class="flex flex-col px-2.5 py-3 gap-3.5 transition-all duration-300 min-h-full"
        :class="{
          'opacity-40 pointer-events-none':
            state.jobStatus.value !== 'ready' ||
            isOverlayVisible ||
            state.renderStatus.value === 'rendering',
        }"
      >
        <Transition name="panel-tab-fade" mode="out-in">
          <!-- TAB 1: PRESETS & STYLE -->
          <div v-if="activeTab === 'style'" key="style" class="space-y-4">
            <!-- Active Style Preset Showcase Card -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h2
                  class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5"
                >
                  <Icon name="ri:magic-line" class="text-accent-500" />
                  <span>Style Presets</span>
                </h2>
                <button
                  class="text-[9px] font-bold text-accent-500 hover:text-accent-400 uppercase tracking-wider flex items-center gap-1 hover:underline"
                  @click="showPresetStudio = true"
                >
                  <Icon name="ri:apps-2-line" class="text-xs" />
                  <span>Browse All ({{ SUBTITLE_PRESETS.length }})</span>
                </button>
              </div>

              <!-- Active Preset Card (Clean 2-Tier with Preset Studio Viewport) -->
              <div
                class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 relative overflow-hidden group"
              >
                <!-- Tier 1: Preset Identity & Change Action -->
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <Transition
                      enter-active-class="transition-opacity duration-200 ease-out"
                      enter-from-class="opacity-0"
                      enter-to-class="opacity-100"
                      leave-active-class="transition-opacity duration-150 ease-in"
                      leave-from-class="opacity-100"
                      leave-to-class="opacity-0"
                      mode="out-in"
                    >
                      <div :key="currentPreset.id" class="truncate">
                        <div
                          class="text-[10px] font-black text-white uppercase tracking-wider truncate flex items-center gap-1.5"
                        >
                          <span>{{ currentPreset.name }}</span>
                        </div>
                        <span
                          class="text-[8px] text-slate-500 font-bold uppercase tracking-wider block truncate"
                          >{{ currentPreset.font }} •
                          {{ currentPreset.animation }}</span
                        >
                      </div>
                    </Transition>
                  </div>

                  <button
                    class="px-2 py-1 rounded-lg bg-surface-card hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shrink-0"
                    @click="showPresetStudio = true"
                  >
                    <span>Change</span>
                    <Icon name="ri:arrow-right-s-line" class="text-xs" />
                  </button>
                </div>

                <!-- Tier 2: Preset Studio Viewport (~80px height live studio canvas) -->
                <div
                  class="w-full h-20 rounded-lg flex items-center justify-center relative border border-white/10 px-3 overflow-hidden bg-gradient-to-b from-slate-900/90 via-slate-950 to-black shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]"
                >
                  <Transition
                    enter-active-class="transition-opacity duration-200 ease-out"
                    enter-from-class="opacity-0"
                    enter-to-class="opacity-100"
                    leave-active-class="transition-opacity duration-150 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                    mode="out-in"
                  >
                    <!-- Kinetic Subtitle Text Sample -->
                    <span
                      :key="currentPreset.id"
                      :style="{
                        fontFamily: currentPreset.font,
                        fontSize: '13px',
                        fontWeight: currentPreset.fontWeight,
                        color: currentPreset.color,
                        textTransform:
                          currentPreset.textTransform === 'uppercase'
                            ? 'uppercase'
                            : 'none',
                        textShadow: getOuterStrokeShadow(currentPreset.strokeWidth),
                      }"
                      class="px-2 py-1 rounded leading-tight transition-all text-center inline-block truncate max-w-full"
                      :class="{
                        'bg-slate-950/85 px-2 py-1 rounded':
                          currentPreset.background === 'box',
                        'bg-slate-900/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10':
                          currentPreset.background === 'blur',
                      }"
                    >
                      <template
                        v-if="
                          currentPreset.highlightMode === 'color' ||
                          currentPreset.highlightMode === 'box' ||
                          currentPreset.highlightMode === 'scale'
                        "
                      >
                        <span>MAKE IT </span>
                        <span
                          :style="{ color: currentPreset.highlightColor }"
                          :class="{
                            'bg-red-500/25 px-1 rounded':
                              currentPreset.highlightMode === 'box',
                            'scale-110 inline-block font-black':
                              currentPreset.highlightMode === 'scale',
                          }"
                          >VIRAL</span
                        >
                      </template>
                      <template
                        v-else-if="currentPreset.highlightMode === 'underline'"
                      >
                        <span>MAKE IT </span>
                        <span
                          class="relative inline-block font-bold"
                          :style="{ color: currentPreset.highlightColor }"
                        >
                          VIRAL
                          <span
                            class="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full"
                            :style="{
                              backgroundColor: currentPreset.highlightColor,
                            }"
                          />
                        </span>
                      </template>
                      <template v-else>
                        <span>MAKE IT VIRAL</span>
                      </template>
                    </span>
                  </Transition>
                </div>
              </div>

              <!-- Quick Styles Micro-Grid -->
              <div>
                <span
                  class="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mb-1.5 block"
                  >Quick Styles</span
                >
                <div class="grid grid-cols-2 gap-1">
                  <button
                    v-for="preset in quickPresets"
                    :key="preset.id"
                    :disabled="state.renderStatus.value === 'rendering'"
                    class="bg-surface-dark/50 border border-surface-border rounded-lg px-2 py-1.5 text-left transition-all flex items-center justify-between gap-1 hover:bg-surface-card disabled:opacity-50 disabled:cursor-not-allowed group min-w-0"
                    :class="
                      state.subtitlePreset.value === preset.id
                        ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)] font-bold'
                        : 'text-slate-400 hover:border-accent-500/30 hover:text-white'
                    "
                    @click="applyPreset(preset)"
                  >
                    <div class="flex items-center gap-1.5 min-w-0 truncate">
                      <Icon :name="preset.icon" class="text-xs shrink-0" />
                      <span
                        class="text-[8.5px] uppercase tracking-wider truncate"
                        >{{ preset.name }}</span
                      >
                    </div>
                    <span
                      class="w-2 h-2 rounded-full shrink-0 border border-white/20 ml-1"
                      :style="{ background: preset.highlightColor }"
                    />
                  </button>
                </div>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Display Mode -->
            <div>
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
              >
                <span>Display Mode</span>
                <Icon name="ri:text-wrap" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="mode in [
                    { id: 'word', label: '1 Word' },
                    { id: '3_words', label: '3 Words' },
                    { id: '4_words', label: '4 Words' },
                  ]"
                  :key="mode.id"
                  :disabled="state.renderStatus.value === 'rendering'"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-card"
                  :class="
                    state.subtitleMode.value === mode.id
                      ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]'
                      : 'text-slate-400 hover:border-accent-500/30 hover:text-white'
                  "
                  @click="state.subtitleMode.value = mode.id"
                >
                  {{ mode.label }}
                </button>
              </div>
            </div>

            <!-- Subtitle Sync Timing -->
            <div
              class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 space-y-1.5"
            >
              <div class="flex justify-between items-center">
                <span
                  class="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <Icon name="ri:timer-line" class="text-accent-500" />
                  Sync Offset (Timing)
                </span>
                <span
                  class="mono text-[10px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                  >{{ state.subtitleSyncOffset.value }}ms</span
                >
              </div>
              <input
                v-model.number="state.subtitleSyncOffset.value"
                :disabled="state.renderStatus.value === 'rendering'"
                type="range"
                min="-2000"
                max="2000"
                step="50"
                class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30"
              />
              <div
                class="flex justify-between text-[8px] text-slate-500 font-bold"
              >
                <span>EARLIER (-ms)</span>
                <span>LATER (+ms)</span>
              </div>
            </div>

            <!-- Animation Type -->
            <div>
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
              >
                <span>Animation</span>
                <Icon name="ri:play-circle-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="anim in animations"
                  :key="anim.id"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] transition-all flex flex-col items-center gap-0.5 hover:bg-surface-card"
                  :class="
                    state.subtitleAnimation.value === anim.id
                      ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)] font-bold'
                      : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
                  "
                  @click="state.subtitleAnimation.value = anim.id"
                >
                  <Icon :name="anim.icon" class="text-xs" />
                  <span class="font-bold tracking-wider uppercase text-[8px]">{{
                    anim.label
                  }}</span>
                </button>
              </div>
            </div>

            <!-- Highlight Mode -->
            <div
              v-if="
                state.subtitleMode.value !== 'word' ||
                state.subtitleAnimation.value === 'karaoke'
              "
            >
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
              >
                <span>Highlight Mode</span>
                <Icon name="ri:mark-pen-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="hl in highlights"
                  :key="hl.id"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all hover:bg-surface-card"
                  :class="
                    state.subtitleHighlightMode.value === hl.id
                      ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]'
                      : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
                  "
                  @click="state.subtitleHighlightMode.value = hl.id"
                >
                  {{ hl.label }}
                </button>
              </div>
            </div>

            <!-- Text Background -->
            <div>
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
              >
                <span>Text Background</span>
                <Icon name="ri:shape-2-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="bg in backgrounds"
                  :key="bg.id"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all hover:bg-surface-card"
                  :class="
                    state.subtitleBackground.value === bg.id
                      ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]'
                      : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
                  "
                  @click="state.subtitleBackground.value = bg.id"
                >
                  {{ bg.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- TAB 2: TYPOGRAPHY & COLORS -->
          <div v-else-if="activeTab === 'type'" key="type" class="space-y-4">
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
                    class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all uppercase tracking-wider hover:bg-surface-card"
                    :class="
                      state.subtitleTextTransform.value === tt
                        ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]'
                        : 'text-slate-400 hover:border-accent-500/40'
                    "
                    @click="state.subtitleTextTransform.value = tt"
                  >
                    {{ tt === "none" ? "Normal" : tt }}
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
                      >{{ state.fontSize.value }}px</span
                    >
                  </div>
                  <input
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
                      v-if="!SINGLE_WEIGHT_FONTS.has(state.font.value)"
                      class="mono text-[8.5px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                      >{{ state.subtitleFontWeight.value }}</span
                    >
                    <span
                      v-else
                      class="text-[8px] text-slate-500 font-bold uppercase"
                      >Fixed</span
                    >
                  </div>
                  <input
                    v-if="!SINGLE_WEIGHT_FONTS.has(state.font.value)"
                    v-model.number="state.subtitleFontWeight.value"
                    type="range"
                    min="400"
                    max="900"
                    step="100"
                    class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                  />
                  <div v-else class="h-1 bg-surface-border/40 rounded-lg" />
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
                      >{{ state.subtitleStrokeWidth.value }}px</span
                    >
                  </div>
                  <input
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
                      >{{ state.subtitleWordSpacing.value }}px</span
                    >
                  </div>
                  <input
                    v-model.number="state.subtitleWordSpacing.value"
                    :disabled="state.renderStatus.value === 'rendering'"
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
                  class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border"
                  :class="
                    activeColorPicker === 'text'
                      ? 'border-accent-500 bg-accent-500/10'
                      : 'border-surface-border/50 hover:bg-surface-card'
                  "
                  @click="
                    activeColorPicker =
                      activeColorPicker === 'text' ? null : 'text'
                  "
                >
                  <div
                    class="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                    :style="{ background: state.subtitleTextColor.value }"
                  />
                  <span
                    class="text-[9px] font-bold uppercase tracking-wider text-slate-300"
                    >Text</span
                  >
                </button>

                <button
                  class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border"
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
                    :style="{ background: state.subtitleHighlightColor.value }"
                  />
                  <span
                    class="text-[9px] font-bold uppercase tracking-wider text-slate-300"
                    >Highlight</span
                  >
                </button>

                <button
                  class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border"
                  :class="
                    activeColorPicker === 'stroke'
                      ? 'border-accent-500 bg-accent-500/10'
                      : 'border-surface-border/50 hover:bg-surface-card'
                  "
                  @click="
                    activeColorPicker =
                      activeColorPicker === 'stroke' ? null : 'stroke'
                  "
                >
                  <div
                    class="w-5 h-5 rounded-md border border-white/20 shadow-sm"
                    :style="{ background: state.subtitleStrokeColor.value }"
                  />
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
                    class="text-slate-500 hover:text-white"
                    @click="activeColorPicker = null"
                  >
                    <Icon name="ri:close-line" class="text-sm" />
                  </button>
                </div>

                <!-- Palette options for Text & Highlight -->
                <div
                  v-if="
                    activeColorPicker === 'text' ||
                    activeColorPicker === 'highlight'
                  "
                  class="flex gap-1.5 flex-wrap"
                >
                  <button
                    v-for="c in palette"
                    :key="activeColorPicker + '-' + c"
                    class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110"
                    :class="
                      (activeColorPicker === 'text'
                        ? state.subtitleTextColor.value
                        : state.subtitleHighlightColor.value) === c
                        ? 'border-accent-500 scale-110'
                        : 'border-transparent'
                    "
                    :style="{ background: c }"
                    @click="
                      activeColorPicker === 'text'
                        ? (state.subtitleTextColor.value = c)
                        : (state.subtitleHighlightColor.value = c)
                    "
                  />
                  <input
                    type="color"
                    :value="
                      activeColorPicker === 'text'
                        ? state.subtitleTextColor.value
                        : state.subtitleHighlightColor.value
                    "
                    class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent"
                    title="Custom color"
                    @input="
                      (e) =>
                        activeColorPicker === 'text'
                          ? (state.subtitleTextColor.value = e.target.value)
                          : (state.subtitleHighlightColor.value =
                              e.target.value)
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
                      '#3B82F6',
                    ]"
                    :key="'stroke-' + c"
                    class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110"
                    :class="
                      state.subtitleStrokeColor.value === c
                        ? 'border-accent-500 scale-110'
                        : 'border-white/10'
                    "
                    :style="{ background: c }"
                    @click="state.subtitleStrokeColor.value = c"
                  />
                  <input
                    v-model="state.subtitleStrokeColor.value"
                    type="color"
                    class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent"
                    title="Custom color"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: LAYOUT & EXPORT -->
          <div
            v-else-if="activeTab === 'layout'"
            key="layout"
            class="space-y-4"
          >
            <!-- Video Layout Mode (Target Ratio) -->
            <div>
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 flex items-center justify-between"
              >
                <span>Video Layout Mode</span>
                <Icon name="ri:aspect-ratio-line" class="text-slate-400" />
              </h2>
              <div
                class="grid grid-cols-2 gap-1 bg-surface-dark/80 p-0.5 rounded-xl border border-surface-border/60"
              >
                <button
                  class="py-1.5 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                  :class="
                    (state.videoLayout?.value || 'vertical') === 'vertical'
                      ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
                  "
                  @click="
                    state.videoLayout
                      ? (state.videoLayout.value = 'vertical')
                      : null
                  "
                >
                  <Icon name="ri:smartphone-line" class="text-xs shrink-0" />
                  <span>Vertical (9:16)</span>
                </button>
                <button
                  class="py-1.5 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                  :class="
                    state.videoLayout?.value === 'landscape'
                      ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
                  "
                  @click="
                    state.videoLayout
                      ? (state.videoLayout.value = 'landscape')
                      : null
                  "
                >
                  <Icon name="ri:landscape-line" class="text-xs shrink-0" />
                  <span>Landscape (Fit)</span>
                </button>
              </div>
            </div>

            <!-- Crop Mode (Vertical Only) -->
            <Transition
              :css="false"
              @enter="onCropEnter"
              @after-enter="onCropAfterEnter"
              @leave="onCropLeave"
            >
              <div
                v-if="(state.videoLayout?.value || 'vertical') === 'vertical'"
                class="space-y-3"
              >
                <hr class="border-surface-border/40" />
                <div>
                  <h2
                    class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 flex items-center justify-between"
                  >
                    <span>Crop Mode</span>
                    <Icon name="ri:crop-line" class="text-slate-400" />
                  </h2>
                  <div
                    class="grid grid-cols-2 gap-1 bg-surface-dark/80 p-0.5 rounded-xl border border-surface-border/60"
                  >
                    <button
                      class="py-1.5 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                      :class="
                        state.cropMode.value === 'face_tracking'
                          ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
                      "
                      @click="state.cropMode.value = 'face_tracking'"
                    >
                      <Icon name="ri:scan-line" class="text-xs shrink-0" />
                      <span>Face Track</span>
                    </button>
                    <button
                      class="py-1.5 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                      :class="
                        state.cropMode.value === 'manual'
                          ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
                          : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
                      "
                      @click="state.cropMode.value = 'manual'"
                    >
                      <Icon
                        name="ri:drag-move-2-line"
                        class="text-xs shrink-0"
                      />
                      <span>Manual Pan</span>
                    </button>
                  </div>
                </div>

                <Transition
                  :css="false"
                  @enter="onSlideEnter"
                  @after-enter="onSlideAfterEnter"
                  @leave="onSlideLeave"
                >
                  <div
                    v-if="state.cropMode.value === 'manual'"
                    class="overflow-hidden space-y-2"
                  >
                    <div
                      class="bg-surface-dark/50 border border-surface-border rounded-xl p-2 mt-2"
                    >
                      <label
                        class="text-[9px] text-slate-400 flex justify-between uppercase font-bold tracking-wider mb-1"
                      >
                        <span>Horizontal Position (Solo)</span>
                        <span class="mono text-accent-500 font-bold"
                          >{{ Math.round(state.cropPercentX.value) }}%</span
                        >
                      </label>
                      <input
                        v-model.number="state.cropPercentX.value"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                      />
                      <div
                        class="flex justify-between text-[8px] text-slate-500 mt-0.5 mono font-bold"
                      >
                        <span>LEFT</span>
                        <span>CENTER</span>
                        <span>RIGHT</span>
                      </div>
                    </div>

                    <!-- Dual Split Sliders (When split mode is detected or active) -->
                    <div
                      v-if="isCurrentSplit || hasAnySplit"
                      class="bg-surface-dark/50 border border-accent-500/30 rounded-xl p-2.5 space-y-2.5"
                    >
                      <div class="flex items-center justify-between">
                        <span
                          class="text-[10px] text-accent-500 font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Icon name="ri:layout-row-line" />
                          Stacked Dual Speakers
                        </span>
                        <span
                          v-if="isCurrentSplit"
                          class="text-[8px] uppercase px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-500 font-bold"
                          >Active Now</span
                        >
                      </div>

                      <!-- Top Speaker -->
                      <div>
                        <label
                          class="text-[9px] text-slate-400 flex justify-between uppercase font-bold tracking-wider mb-1"
                        >
                          <span>Top Speaker (Left)</span>
                          <span class="mono text-accent-500 font-bold"
                            >{{
                              Math.round(state.cropPercentXTop?.value ?? 50)
                            }}%</span
                          >
                        </label>
                        <input
                          v-model.number="state.cropPercentXTop.value"
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      <!-- Bottom Speaker -->
                      <div>
                        <label
                          class="text-[9px] text-slate-400 flex justify-between uppercase font-bold tracking-wider mb-1"
                        >
                          <span>Bottom Speaker (Right)</span>
                          <span class="mono text-accent-500 font-bold"
                            >{{
                              Math.round(state.cropPercentXBottom?.value ?? 50)
                            }}%</span
                          >
                        </label>
                        <input
                          v-model.number="state.cropPercentXBottom.value"
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </Transition>

                <Transition
                  :css="false"
                  @enter="onFadeEnter"
                  @leave="onFadeLeave"
                >
                  <div
                    v-if="state.cropMode.value === 'face_tracking'"
                    class="overflow-hidden space-y-2 mt-2"
                  >
                    <p
                      class="text-[9px] text-slate-400 flex items-center gap-1.5"
                    >
                      <Icon
                        name="ri:sparkling-fill"
                        class="text-accent-500 text-xs shrink-0"
                      />
                      <span>Responsive dynamic tracking active.</span>
                    </p>

                    <!-- Stacked Multi-Speaker Framing Zoom Controls (Option 1: Segmented Speaker Switcher) -->
                    <div
                      v-if="isCurrentSplit || hasAnySplit"
                      class="bg-surface-dark/50 border border-accent-500/30 rounded-xl p-2.5 space-y-2.5"
                    >
                      <div class="flex items-center justify-between">
                        <span
                          class="text-[10px] text-accent-500 font-bold uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Icon name="ri:zoom-in-line" class="text-xs" />
                          Stacked Speaker Zoom
                        </span>
                        <div class="flex items-center gap-1.5">
                          <span
                            v-if="isCurrentSplit"
                            class="text-[7.5px] uppercase px-1.5 py-0.2 rounded bg-accent-500/20 text-accent-500 font-bold"
                            >Split Active</span
                          >
                          <button
                            v-if="
                              (state.splitZoomTop?.value ?? 1.0) !== 1.0 ||
                              (state.splitZoomBottom?.value ?? 1.0) !== 1.0 ||
                              (state.splitOffsetXTop?.value ?? 0) !== 0 ||
                              (state.splitOffsetYTop?.value ?? 0) !== 0 ||
                              (state.splitOffsetXBottom?.value ?? 0) !== 0 ||
                              (state.splitOffsetYBottom?.value ?? 0) !== 0
                            "
                            class="text-[7.5px] uppercase px-1.5 py-0.5 rounded bg-surface-border text-slate-300 hover:text-white transition-colors"
                            title="Reset All Zoom & Framing"
                            @click="resetSplitZoom"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      <!-- Segmented Speaker Switcher -->
                      <div
                        class="grid grid-cols-2 gap-1 bg-surface-dark/80 p-0.5 rounded-lg border border-surface-border/60"
                      >
                        <button
                          type="button"
                          class="py-1 px-1.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 truncate"
                          :class="
                            activeSplitSpeaker === 'top'
                              ? 'bg-accent-500 text-black shadow-sm font-black'
                              : 'text-slate-400 hover:text-white hover:bg-surface-card/40'
                          "
                          @click="activeSplitSpeaker = 'top'"
                        >
                          <Icon
                            name="ri:layout-top-line"
                            class="text-xs shrink-0"
                          />
                          <span class="truncate">Top Speaker</span>
                          <span
                            class="mono text-[7.5px] opacity-80 shrink-0 font-normal"
                            >({{
                              (state.splitZoomTop?.value ?? 1.0).toFixed(1)
                            }}x)</span
                          >
                        </button>
                        <button
                          type="button"
                          class="py-1 px-1.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 truncate"
                          :class="
                            activeSplitSpeaker === 'bottom'
                              ? 'bg-accent-500 text-black shadow-sm font-black'
                              : 'text-slate-400 hover:text-white hover:bg-surface-card/40'
                          "
                          @click="activeSplitSpeaker = 'bottom'"
                        >
                          <Icon
                            name="ri:layout-bottom-line"
                            class="text-xs shrink-0"
                          />
                          <span class="truncate">Bottom Speaker</span>
                          <span
                            class="mono text-[7.5px] opacity-80 shrink-0 font-normal"
                            >({{
                              (state.splitZoomBottom?.value ?? 1.0).toFixed(1)
                            }}x)</span
                          >
                        </button>
                      </div>

                      <!-- Top Speaker Controls (Kept in DOM via v-show for test stability) -->
                      <div
                        v-show="activeSplitSpeaker === 'top'"
                        class="space-y-2"
                      >
                        <div>
                          <div
                            class="flex justify-between items-center text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1"
                          >
                            <span
                              class="flex items-center gap-1 text-slate-300"
                            >
                              <Icon
                                name="ri:layout-top-line"
                                class="text-accent-500 text-xs shrink-0"
                              />
                              <span>Top Speaker Zoom</span>
                            </span>
                            <span
                              class="mono text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                              >{{
                                (state.splitZoomTop?.value ?? 1.0).toFixed(2)
                              }}x</span
                            >
                          </div>
                          <input
                            v-model.number="state.splitZoomTop.value"
                            type="range"
                            min="1"
                            max="2.5"
                            step="0.05"
                            class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <!-- Top Framing Adjustments (Disclosed when zoom > 1.0) -->
                        <div
                          v-if="(state.splitZoomTop?.value ?? 1.0) > 1.0"
                          class="p-2 rounded-lg bg-surface-dark/70 border border-white/5 space-y-1.5 animate-in fade-in duration-150"
                        >
                          <div
                            class="flex items-center justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider"
                          >
                            <span
                              class="flex items-center gap-1 text-accent-400"
                            >
                              <Icon
                                name="ri:focus-3-line"
                                class="text-[10px]"
                              />
                              <span>Framing Position</span>
                            </span>
                            <button
                              v-if="
                                (state.splitOffsetXTop?.value ?? 0) !== 0 ||
                                (state.splitOffsetYTop?.value ?? 0) !== 0
                              "
                              class="text-[7px] uppercase px-1.5 py-0.2 rounded bg-surface-border text-slate-300 hover:text-white transition-colors"
                              @click="resetTopFraming"
                            >
                              Reset
                            </button>
                          </div>

                          <!-- Headroom Slider -->
                          <div v-if="state.splitOffsetYTop">
                            <div
                              class="flex justify-between items-center text-[8px] text-slate-400 mb-0.5"
                            >
                              <span>Vertical Headroom</span>
                              <span class="mono text-accent-500 font-bold"
                                >{{
                                  Math.round(state.splitOffsetYTop?.value ?? 0)
                                }}%</span
                              >
                            </div>
                            <input
                              v-model.number="state.splitOffsetYTop.value"
                              type="range"
                              min="-50"
                              max="50"
                              step="1"
                              class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          <!-- Horizontal Nudge Slider -->
                          <div v-if="state.splitOffsetXTop">
                            <div
                              class="flex justify-between items-center text-[8px] text-slate-400 mb-0.5"
                            >
                              <span>Horizontal Nudge</span>
                              <span class="mono text-accent-500 font-bold"
                                >{{
                                  Math.round(state.splitOffsetXTop?.value ?? 0)
                                }}%</span
                              >
                            </div>
                            <input
                              v-model.number="state.splitOffsetXTop.value"
                              type="range"
                              min="-50"
                              max="50"
                              step="1"
                              class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <!-- Bottom Speaker Controls (Kept in DOM via v-show for test stability) -->
                      <div
                        v-show="activeSplitSpeaker === 'bottom'"
                        class="space-y-2"
                      >
                        <div>
                          <div
                            class="flex justify-between items-center text-[9px] text-slate-400 uppercase font-bold tracking-wider mb-1"
                          >
                            <span
                              class="flex items-center gap-1 text-slate-300"
                            >
                              <Icon
                                name="ri:layout-bottom-line"
                                class="text-accent-500 text-xs shrink-0"
                              />
                              <span>Bottom Speaker Zoom</span>
                            </span>
                            <span
                              class="mono text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                              >{{
                                (state.splitZoomBottom?.value ?? 1.0).toFixed(
                                  2,
                                )
                              }}x</span
                            >
                          </div>
                          <input
                            v-model.number="state.splitZoomBottom.value"
                            type="range"
                            min="1"
                            max="2.5"
                            step="0.05"
                            class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                          />
                        </div>

                        <!-- Bottom Framing Adjustments (Disclosed when zoom > 1.0) -->
                        <div
                          v-if="(state.splitZoomBottom?.value ?? 1.0) > 1.0"
                          class="p-2 rounded-lg bg-surface-dark/70 border border-white/5 space-y-1.5 animate-in fade-in duration-150"
                        >
                          <div
                            class="flex items-center justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider"
                          >
                            <span
                              class="flex items-center gap-1 text-accent-400"
                            >
                              <Icon
                                name="ri:focus-3-line"
                                class="text-[10px]"
                              />
                              <span>Framing Position</span>
                            </span>
                            <button
                              v-if="
                                (state.splitOffsetXBottom?.value ?? 0) !== 0 ||
                                (state.splitOffsetYBottom?.value ?? 0) !== 0
                              "
                              class="text-[7px] uppercase px-1.5 py-0.2 rounded bg-surface-border text-slate-300 hover:text-white transition-colors"
                              @click="resetBottomFraming"
                            >
                              Reset
                            </button>
                          </div>

                          <!-- Headroom Slider -->
                          <div v-if="state.splitOffsetYBottom">
                            <div
                              class="flex justify-between items-center text-[8px] text-slate-400 mb-0.5"
                            >
                              <span>Vertical Headroom</span>
                              <span class="mono text-accent-500 font-bold"
                                >{{
                                  Math.round(
                                    state.splitOffsetYBottom?.value ?? 0,
                                  )
                                }}%</span
                              >
                            </div>
                            <input
                              v-model.number="state.splitOffsetYBottom.value"
                              type="range"
                              min="-50"
                              max="50"
                              step="1"
                              class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          <!-- Horizontal Nudge Slider -->
                          <div v-if="state.splitOffsetXBottom">
                            <div
                              class="flex justify-between items-center text-[8px] text-slate-400 mb-0.5"
                            >
                              <span>Horizontal Nudge</span>
                              <span class="mono text-accent-500 font-bold"
                                >{{
                                  Math.round(
                                    state.splitOffsetXBottom?.value ?? 0,
                                  )
                                }}%</span
                              >
                            </div>
                            <input
                              v-model.number="state.splitOffsetXBottom.value"
                              type="range"
                              min="-50"
                              max="50"
                              step="1"
                              class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </Transition>

            <hr class="border-surface-border/40" />

            <!-- Safe Zone Overlay -->
            <div>
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between"
              >
                <span>Safe Zone Overlay</span>
                <Icon name="ri:layout-grid-line" class="text-slate-400" />
              </h2>
              <div class="space-y-2.5">
                <!-- Platform Selector Grid -->
                <div
                  class="grid grid-cols-4 gap-1 bg-surface-dark/80 p-0.5 rounded-xl border border-surface-border/60"
                >
                  <button
                    v-for="platform in [
                      { id: 'none', label: 'None', icon: 'ri:eye-off-line' },
                      { id: 'tiktok', label: 'TikTok', icon: 'ri:tiktok-fill' },
                      {
                        id: 'reels',
                        label: 'Reels',
                        icon: 'ri:instagram-line',
                      },
                      {
                        id: 'shorts',
                        label: 'Shorts',
                        icon: 'ri:youtube-fill',
                      },
                    ]"
                    :key="platform.id"
                    class="py-1 px-1 rounded-lg text-[8.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                    :class="
                      activeSafeZone === platform.id
                        ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
                    "
                    @click="activeSafeZone = platform.id"
                  >
                    <Icon :name="platform.icon" class="text-xs shrink-0" />
                    <span>{{ platform.label }}</span>
                  </button>
                </div>

                <!-- Customizations (only visible if platform is selected) -->
                <div
                  v-if="activeSafeZone !== 'none'"
                  class="space-y-2.5 pt-2 border-t border-surface-border/30 animate-in fade-in duration-150"
                >
                  <div>
                    <label
                      class="text-[9px] text-slate-400 flex justify-between mb-1 font-bold uppercase tracking-wider"
                    >
                      <span>Overlay Opacity</span>
                      <span
                        class="mono text-accent-500 bg-accent-500/10 px-1 rounded"
                        >{{ safeZoneOpacity }}%</span
                      >
                    </label>
                    <input
                      v-model.number="safeZoneOpacity"
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <label
                      class="text-[9px] text-slate-400 flex items-center justify-between mb-1 font-bold uppercase tracking-wider"
                    >
                      <span>Overlay Color</span>
                      <div
                        class="w-3 h-3 rounded border border-white/20"
                        :style="{ background: safeZoneColor }"
                      />
                    </label>
                    <div class="flex gap-1.5 flex-wrap">
                      <button
                        v-for="c in [
                          '#000000',
                          '#ef4444',
                          '#3b82f6',
                          '#10b981',
                          '#f59e0b',
                        ]"
                        :key="'sz-color-' + c"
                        class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110"
                        :class="
                          safeZoneColor === c
                            ? 'border-accent-500 scale-110'
                            : 'border-transparent'
                        "
                        :style="{ background: c }"
                        @click="safeZoneColor = c"
                      />
                      <input
                        v-model="safeZoneColor"
                        type="color"
                        class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent"
                        title="Custom color"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Positioning & Y-Offset -->
            <div class="space-y-2.5">
              <h2
                class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between"
              >
                <span>Positioning & Vertical Offset</span>
                <Icon name="ri:align-center" class="text-slate-400" />
              </h2>

              <div
                class="grid grid-cols-3 gap-1 bg-surface-dark/80 p-0.5 rounded-xl border border-surface-border/60"
              >
                <button
                  v-for="pos in ['top', 'center', 'bottom']"
                  :key="pos"
                  :disabled="state.renderStatus.value === 'rendering'"
                  class="py-1.5 px-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center capitalize"
                  :class="
                    state.subtitlePosition.value === pos
                      ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-surface-card/50'
                  "
                  @click="state.subtitlePosition.value = pos"
                >
                  {{ pos }}
                </button>
              </div>

              <!-- Auto-Adaptive Subtitle Placement Toggle -->
              <div
                class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 space-y-1.5"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <Icon
                      name="ri:magic-line"
                      class="text-accent-500 text-xs"
                    />
                    <span class="text-[10px] text-slate-300 font-bold"
                      >Auto-Adaptive Subtitle</span
                    >
                  </div>
                  <button
                    type="button"
                    class="w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5"
                    :class="
                      (state.autoAdaptiveSubtitles?.value ?? true)
                        ? 'bg-accent-500'
                        : 'bg-surface-border'
                    "
                    @click="toggleAutoAdaptiveSubtitles"
                  >
                    <div
                      class="w-3 h-3 rounded-full bg-black shadow-md transition-transform transform"
                      :class="
                        (state.autoAdaptiveSubtitles?.value ?? true)
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      "
                    />
                  </button>
                </div>
                <p class="text-[8px] text-slate-400 leading-tight">
                  {{
                    (state.autoAdaptiveSubtitles?.value ?? true)
                      ? "Automatically floats over dividing seam during multi-speaker split."
                      : "Fixed to custom position presets regardless of video framing."
                  }}
                </p>
              </div>

              <div
                class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1"
              >
                <div class="flex justify-between items-center">
                  <span
                    class="text-[9px] text-slate-400 font-bold uppercase tracking-wider"
                    >Y-Offset (Vertical)</span
                  >
                  <span
                    class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                    >{{ state.subtitleOffset.value }}px</span
                  >
                </div>
                <input
                  v-model.number="state.subtitleOffset.value"
                  :disabled="state.renderStatus.value === 'rendering'"
                  type="range"
                  min="0"
                  max="500"
                  class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30"
                />
              </div>

              <div
                v-if="state.subtitleBackground.value !== 'none'"
                class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1"
              >
                <div class="flex justify-between items-center">
                  <span
                    class="text-[9px] text-slate-400 font-bold uppercase tracking-wider"
                    >BG Opacity</span
                  >
                  <span
                    class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                    >{{
                      Math.round(state.subtitleBackgroundOpacity.value * 100)
                    }}%</span
                  >
                </div>
                <input
                  v-model.number="state.subtitleBackgroundOpacity.value"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Extremely Compact Ultra-Slim Main Action Footer (Dimmed during pipeline/render) -->
    <div
      class="px-2.5 py-2 border-t border-surface-border bg-surface-panel/95 backdrop-blur-md shrink-0 space-y-2 transition-all duration-300"
      :class="{
        'opacity-40 pointer-events-none':
          state.jobStatus.value !== 'ready' ||
          isOverlayVisible ||
          state.renderStatus.value === 'rendering',
      }"
    >
      <!-- Render Status Download Alert Banner (Compact) -->
      <div
        v-if="
          state.renderStatus.value === 'ready' ||
          state.renderStatus.value === 'done'
        "
        class="bg-accent-500/10 border border-accent-500/30 rounded-lg p-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
      >
        <Icon
          name="ri:checkbox-circle-fill"
          class="text-lg text-accent-500 shrink-0"
        />
        <div class="flex-1 overflow-hidden">
          <p
            class="text-[8px] font-bold text-accent-400 uppercase tracking-wider"
          >
            Render Complete
          </p>
          <a
            :href="state.outputUrl.value"
            target="_blank"
            class="text-[11px] text-white underline font-medium hover:text-accent-500 transition-colors block truncate"
            >Download Result</a
          >
        </div>
      </div>

      <!-- Single Line Flex Controls (Save Default + RENDER CLIP) -->
      <div class="flex items-center gap-1.5">
        <!-- Save Style Button with Custom Instant Tooltip -->
        <div class="relative group shrink-0">
          <button
            :disabled="
              state?.jobStatus?.value !== 'ready' ||
              isOverlayVisible ||
              state?.renderStatus?.value === 'rendering'
            "
            class="bg-surface-dark/80 border border-surface-border/80 hover:border-accent-500/50 text-slate-300 hover:text-accent-400 p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 hover:bg-surface-card disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-surface-border/80 disabled:hover:text-slate-300 disabled:hover:bg-surface-dark/80"
            @click="
              state.saveDefaultStyleSettings();
              if (state.showToast)
                state.showToast('Default style saved!', 'success');
            "
          >
            <Icon name="ri:save-3-line" class="text-sm text-accent-500" />
            <span class="text-[9.5px] font-bold uppercase tracking-wider"
              >Save Style</span
            >
          </button>

          <!-- Custom Instant Tooltip Popup -->
          <div
            class="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap"
          >
            <div
              class="bg-surface-panel border border-surface-border text-slate-200 text-[9px] font-semibold py-1.5 px-2.5 rounded-lg shadow-xl backdrop-blur-md flex items-center gap-1.5"
            >
              <Icon
                name="ri:information-fill"
                class="text-accent-500 text-xs shrink-0"
              />
              <span
                >Save this style as global default style for future clips</span
              >
            </div>
          </div>
        </div>

        <button
          :disabled="
            state?.jobStatus?.value !== 'ready' ||
            isOverlayVisible ||
            state?.renderStatus?.value === 'rendering'
          "
          class="flex-1 bg-accent-500/80 text-black font-black uppercase tracking-wider rounded-xl py-2 px-2.5 text-xs hover:bg-accent-400 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(207,255,80,0.18)] hover:shadow-[0_0_20px_rgba(207,255,80,0.3)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none min-w-0 truncate"
          @click="prepareRender"
        >
          <Icon
            :name="
              state?.renderStatus?.value === 'rendering'
                ? 'ri:loader-4-line'
                : 'ri:movie-fill'
            "
            :class="{
              'animate-spin': state?.renderStatus?.value === 'rendering',
            }"
            class="text-sm shrink-0"
          />
          <span class="truncate">{{
            state?.renderStatus?.value === "rendering"
              ? "RENDERING..."
              : "RENDER CLIP"
          }}</span>
        </button>
      </div>
    </div>

    <!-- Drag Handle -->
    <div
      class="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-30 group"
      @mousedown="startResize"
    >
      <div
        class="absolute inset-y-0 right-0 w-[2px] bg-transparent group-hover:bg-accent-500 group-active:bg-accent-500 transition-all group-hover:shadow-[0_0_8px_#CFFF50]"
        :class="{ 'bg-accent-500 shadow-[0_0_8px_#CFFF50]': isResizing }"
      />
    </div>

    <!-- Naming Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isNamingClip"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-md"
            @click="isNamingClip = false"
          />

          <div
            class="relative bg-surface-panel border border-surface-border p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300"
          >
            <h3
              class="text-xl font-black text-white mb-2 uppercase tracking-tighter italic"
            >
              Name Your Clip
            </h3>
            <p class="text-slate-400 text-xs mb-6">
              Enter a title for your final video file.
            </p>

            <div class="space-y-4">
              <div>
                <label
                  class="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5 block"
                  >File Name</label
                >
                <div class="relative group">
                  <input
                    v-model="renderName"
                    class="w-full bg-surface-dark border border-surface-border/50 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-3 text-white font-bold outline-none transition-all pr-12 text-sm"
                    placeholder="e.g. My Viral Hook"
                    autoFocus
                    @keyup.enter="startFinalRender"
                  />
                  <span
                    class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono"
                    >.mp4</span
                  >
                </div>
                <p class="text-[9px] text-slate-600 mt-2 italic">
                  Spaces will be converted to underscores.
                </p>
              </div>

              <div class="flex gap-3 pt-2">
                <button
                  class="flex-1 px-4 py-3 rounded-xl border border-surface-border text-slate-400 font-bold text-xs hover:bg-surface-card transition-all"
                  @click="isNamingClip = false"
                >
                  Cancel
                </button>
                <button
                  class="flex-[1.5] bg-accent-500 hover:bg-accent-400 text-black px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(207,255,80,0.2)]"
                  @click="startFinalRender"
                >
                  Start Render
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Blacklist Settings Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showBlacklistSettings"
          class="fixed inset-0 z-[110] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/80 backdrop-blur-xl"
            @click="showBlacklistSettings = false"
          />
          <div
            class="relative bg-surface-panel border border-surface-border rounded-3xl shadow-2xl max-w-4xl max-h-[90vh] w-full flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden"
          >
            <BlacklistSettings @close="showBlacklistSettings = false" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Preset Studio Modal -->
    <PresetStudioModal
      :show="showPresetStudio"
      :active-preset-id="state.subtitlePreset.value"
      @close="showPresetStudio = false"
      @select="applyPreset"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { FONT_OPTIONS } from "../composables/useClipperState";
import { SUBTITLE_PRESETS } from "../constants/subtitlePresets";
import { getOuterStrokeShadow } from "../utils/styleHelpers";
import PresetStudioModal from "./editor/PresetStudioModal.vue";

const state = useClipperState();
const { activeSafeZone, safeZoneOpacity, safeZoneColor, isOverlayVisible } =
  state;

const showPresetStudio = ref(false);

const currentPreset = computed(() => {
  return (
    SUBTITLE_PRESETS.find((p) => p.id === state.subtitlePreset.value) ||
    SUBTITLE_PRESETS[0]
  );
});

// Quick-switch presets: top 6 presets from library
const quickPresets = computed(() => {
  return SUBTITLE_PRESETS.slice(0, 6);
});

const isCurrentSplit = computed(() => {
  if (!state.cropMap?.value || state.cropMap.value.length === 0) return false;
  const t = state.currentTime?.value || 0;
  let active = state.cropMap.value[0];
  for (const entry of state.cropMap.value) {
    if (entry.time <= t) active = entry;
    else break;
  }
  return active?.mode === "split";
});

const hasAnySplit = computed(() => {
  return state.cropMap?.value?.some((entry) => entry.mode === "split") ?? false;
});

function toggleAutoAdaptiveSubtitles() {
  if (state.autoAdaptiveSubtitles) {
    state.autoAdaptiveSubtitles.value = !state.autoAdaptiveSubtitles.value;
  }
}

function resetSplitZoom() {
  if (state.splitZoomTop) state.splitZoomTop.value = 1.0;
  if (state.splitZoomBottom) state.splitZoomBottom.value = 1.0;
  if (state.splitOffsetXTop) state.splitOffsetXTop.value = 0;
  if (state.splitOffsetYTop) state.splitOffsetYTop.value = 0;
  if (state.splitOffsetXBottom) state.splitOffsetXBottom.value = 0;
  if (state.splitOffsetYBottom) state.splitOffsetYBottom.value = 0;
}

function resetTopFraming() {
  if (state.splitOffsetXTop) state.splitOffsetXTop.value = 0;
  if (state.splitOffsetYTop) state.splitOffsetYTop.value = 0;
}

function resetBottomFraming() {
  if (state.splitOffsetXBottom) state.splitOffsetXBottom.value = 0;
  if (state.splitOffsetYBottom) state.splitOffsetYBottom.value = 0;
}

// Segmented Navigation Tab State

const activeTab = ref("style"); // 'style' | 'type' | 'layout'
const activeColorPicker = ref(null); // null | 'text' | 'highlight' | 'stroke'
const activeSplitSpeaker = ref("top"); // 'top' | 'bottom'

const showBlacklistSettings = ref(false);
const isNamingClip = ref(false);
const renderName = ref("");

// Resize variables
const sidebarWidth = ref(340);
const isResizing = ref(false);
const sidebarRef = ref(null);

function startResize(e) {
  isResizing.value = true;
  document.addEventListener("mousemove", handleResize);
  document.addEventListener("mouseup", stopResize);
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
}

function handleResize(e) {
  if (!isResizing.value || !sidebarRef.value) return;
  const rect = sidebarRef.value.getBoundingClientRect();
  const newWidth = e.clientX - rect.left;
  // Clamp width between 280px and 340px
  sidebarWidth.value = Math.max(280, Math.min(340, newWidth));
}

function stopResize() {
  if (!isResizing.value) return;
  isResizing.value = false;
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
  document.body.style.userSelect = "";
  document.body.style.cursor = "";

  // Persist computed sidebar width to localStorage
  localStorage.setItem("yonru_sidebar_width", sidebarWidth.value.toString());
}

onMounted(() => {
  const savedWidth = localStorage.getItem("yonru_sidebar_width");
  if (savedWidth) {
    const widthNum = parseInt(savedWidth, 10);
    if (!isNaN(widthNum)) {
      sidebarWidth.value = Math.max(280, Math.min(340, widthNum));
    }
  }
});

onUnmounted(() => {
  document.removeEventListener("mousemove", handleResize);
  document.removeEventListener("mouseup", stopResize);
});

function onCropEnter(el, done) {
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.overflow = "hidden";
  el.style.marginTop = "0px";
  void el.offsetHeight; // trigger reflow

  const targetHeight = el.scrollHeight;
  el.style.transition =
    "height 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out, margin-top 0.3s cubic-bezier(0.32, 0.72, 0, 1)";
  el.style.height = `${targetHeight}px`;
  el.style.opacity = "1";
  el.style.marginTop = "";

  let finished = false;
  const handleEnd = (e) => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener("transitionend", handleEnd);
      done();
    }
  };
  el.addEventListener("transitionend", handleEnd);
  setTimeout(() => handleEnd(), 350);
}

function onCropAfterEnter(el) {
  el.style.height = "";
  el.style.opacity = "";
  el.style.overflow = "";
  el.style.marginTop = "";
  el.style.transition = "";
}

function onCropLeave(el, done) {
  el.style.height = `${el.offsetHeight}px`;
  el.style.opacity = "1";
  el.style.overflow = "hidden";
  void el.offsetHeight; // trigger reflow

  el.style.transition =
    "height 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-in, margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1)";
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.marginTop = "0px";

  let finished = false;
  const handleEnd = (e) => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener("transitionend", handleEnd);
      done();
    }
  };
  el.addEventListener("transitionend", handleEnd);
  setTimeout(() => handleEnd(), 330);
}

function onSlideEnter(el, done) {
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.overflow = "hidden";
  void el.offsetHeight; // trigger reflow

  const targetHeight = el.scrollHeight;
  el.style.transition =
    "height 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out";
  el.style.height = `${targetHeight}px`;
  el.style.opacity = "1";

  let finished = false;
  const handleEnd = (e) => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener("transitionend", handleEnd);
      done();
    }
  };
  el.addEventListener("transitionend", handleEnd);
  setTimeout(() => handleEnd(), 350);
}

function onSlideAfterEnter(el) {
  el.style.height = "";
  el.style.opacity = "";
  el.style.overflow = "";
  el.style.transition = "";
}

function onSlideLeave(el, done) {
  el.style.height = `${el.offsetHeight}px`;
  el.style.opacity = "1";
  el.style.overflow = "hidden";
  void el.offsetHeight; // trigger reflow

  el.style.transition =
    "height 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-in";
  el.style.height = "0px";
  el.style.opacity = "0";

  let finished = false;
  const handleEnd = (e) => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener("transitionend", handleEnd);
      done();
    }
  };
  el.addEventListener("transitionend", handleEnd);
  setTimeout(() => handleEnd(), 300);
}

function onFadeEnter(el, done) {
  el.style.height = "0px";
  el.style.opacity = "0";
  el.style.overflow = "hidden";
  void el.offsetHeight;

  const targetHeight = el.scrollHeight;
  el.style.transition =
    "height 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-out";
  el.style.height = `${targetHeight}px`;
  el.style.opacity = "1";

  let finished = false;
  const handleEnd = () => {
    if (!finished) {
      finished = true;
      el.removeEventListener("transitionend", handleEnd);
      done();
    }
  };
  el.addEventListener("transitionend", handleEnd);
  setTimeout(handleEnd, 300);
}

function onFadeLeave(el, done) {
  el.style.height = `${el.offsetHeight}px`;
  el.style.opacity = "1";
  el.style.overflow = "hidden";
  void el.offsetHeight;

  el.style.transition =
    "height 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease-in";
  el.style.height = "0px";
  el.style.opacity = "0";

  let finished = false;
  const handleEnd = () => {
    if (!finished) {
      finished = true;
      el.removeEventListener("transitionend", handleEnd);
      done();
    }
  };
  el.addEventListener("transitionend", handleEnd);
  setTimeout(handleEnd, 250);
}

function prepareRender() {
  if (state.activeHook.value) {
    renderName.value = state.activeHook.value.theme || "";
  }
  isNamingClip.value = true;
}

function startFinalRender() {
  if (!renderName.value.trim()) return;
  isNamingClip.value = false;
  state.renderClip(0, renderName.value.trim());
}

const SINGLE_WEIGHT_FONTS = new Set([
  "Bebas Neue",
  "Anton",
  "Bangers",
  "Permanent Marker",
  "Russo One",
  "Luckiest Guy",
  "Titan One",
  "Lilita One",
  "Passion One",
]);

const palette = [
  "#FFFFFF",
  "#CFFF50",
  "#FFD700",
  "#EF4444",
  "#60A5FA",
  "#A78BFA",
  "#34D399",
  "#FB923C",
  "#F472B6",
  "#000000",
];

const animations = [
  { id: "pop", label: "Pop", icon: "ri:magic-line" },
  { id: "slide-up", label: "Slide", icon: "ri:arrow-up-line" },
  { id: "fade", label: "Fade", icon: "ri:contrast-drop-line" },
  { id: "bounce", label: "Bounce", icon: "ri:basketball-line" },
  { id: "typewriter", label: "Type", icon: "ri:keyboard-line" },
  { id: "karaoke", label: "Karaoke", icon: "ri:mic-line" },
];

const highlights = [
  { id: "color", label: "Color Swap" },
  { id: "scale", label: "Scale Pulse" },
  { id: "underline", label: "Underline" },
  { id: "box", label: "Box Highlight" },
  { id: "none", label: "None" },
];

const backgrounds = [
  { id: "none", label: "None" },
  { id: "box", label: "Dark Box" },
  { id: "blur", label: "Blur Pill" },
];

const presets = SUBTITLE_PRESETS;

function applyPreset(preset) {
  state.subtitlePreset.value = preset.id;
  state.font.value = preset.font;
  state.fontSize.value = preset.fontSize;
  state.subtitleFontWeight.value = preset.fontWeight;
  state.subtitleTextColor.value = preset.color;
  state.subtitleHighlightColor.value = preset.highlightColor;
  state.subtitleAnimation.value = preset.animation;
  state.subtitleHighlightMode.value = preset.highlightMode;
  state.subtitleBackground.value = preset.background;
  state.subtitleStrokeWidth.value = preset.strokeWidth;
  state.subtitleTextTransform.value = preset.textTransform;
}
</script>

<style scoped>
.panel-tab-fade-enter-active,
.panel-tab-fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.panel-tab-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.panel-tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
