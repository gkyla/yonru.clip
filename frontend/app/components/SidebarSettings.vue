<template>
  <div 
    ref="sidebarRef"
    v-if="state" 
    class="h-full flex flex-col relative bg-surface-panel/50 border-r border-surface-border shrink-0 select-none overflow-hidden"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <!-- Segmented Tab Navigation Header -->
    <div class="px-3 pt-3 pb-2 border-b border-surface-border/50 bg-surface-dark/40 shrink-0">
      <div class="grid grid-cols-3 gap-1 bg-surface-dark/80 p-1 rounded-xl border border-surface-border/60">
        <button
          @click="activeTab = 'style'"
          class="tab-btn py-1.5 px-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="activeTab === 'style' 
            ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20' 
            : 'text-slate-400 hover:text-white hover:bg-surface-card/50'"
        >
          <Icon name="ri:palette-line" class="text-xs shrink-0" />
          <span>Presets</span>
        </button>

        <button
          @click="activeTab = 'type'"
          class="tab-btn py-1.5 px-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="activeTab === 'type' 
            ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20' 
            : 'text-slate-400 hover:text-white hover:bg-surface-card/50'"
        >
          <Icon name="ri:font-size" class="text-xs shrink-0" />
          <span>Text</span>
        </button>

        <button
          @click="activeTab = 'layout'"
          class="tab-btn py-1.5 px-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1"
          :class="activeTab === 'layout' 
            ? 'bg-accent-500 text-black shadow-md shadow-accent-500/20' 
            : 'text-slate-400 hover:text-white hover:bg-surface-card/50'"
        >
          <Icon name="ri:layout-grid-line" class="text-xs shrink-0" />
          <span>Layout</span>
        </button>
      </div>
    </div>

    <!-- Scrollable Tab Content View -->
    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <div 
        class="flex flex-col p-3.5 gap-4.5 transition-all duration-300 min-h-full"
        :class="{ 'opacity-40 pointer-events-none': state.jobStatus.value !== 'ready' }"
      >
        <Transition name="panel-tab-fade" mode="out-in">
          <!-- TAB 1: PRESETS & STYLE -->
          <div v-if="activeTab === 'style'" key="style" class="space-y-4">
            <!-- Style Presets Grid -->
            <div>
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Style Presets</span>
                <Icon name="ri:magic-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-2 gap-2">
                <button 
                  v-for="preset in presets" :key="preset.id"
                  @click="applyPreset(preset)"
                  :disabled="state.renderStatus.value === 'rendering'"
                  class="bg-surface-dark/60 border rounded-xl p-2 text-left transition-all flex flex-col gap-1.5 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group hover:bg-surface-card"
                  :class="state.subtitlePreset.value === preset.id 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[0_0_12px_rgba(207,255,80,0.12)] ring-1 ring-accent-500/40' 
                    : 'border-surface-border/80 text-slate-400 hover:border-accent-500/40 hover:text-white'"
                >
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs shrink-0">{{ preset.icon }}</span>
                    <span class="font-black uppercase tracking-wider text-[9px] truncate">{{ preset.name }}</span>
                  </div>
                  
                  <!-- Mini Preview Box -->
                  <div class="w-full h-7 bg-black/50 rounded-md flex items-center justify-center border border-white/5 relative overflow-hidden px-1">
                    <span 
                      :style="{
                        fontFamily: preset.font,
                        fontSize: '9px',
                        fontWeight: preset.fontWeight,
                        color: preset.color,
                        textTransform: preset.textTransform === 'uppercase' ? 'uppercase' : 'none',
                        paintOrder: preset.strokeWidth ? 'stroke fill' : 'normal',
                        WebkitTextStroke: preset.strokeWidth ? `${preset.strokeWidth / 3}px black` : 'none',
                        textShadow: preset.strokeWidth ? '0 1px 3px rgba(0,0,0,0.9)' : '0 1px 2px rgba(0,0,0,0.6)'
                      }"
                      class="px-1 py-0.5 rounded leading-none transition-all text-center inline-block truncate max-w-full"
                      :class="{
                        'bg-slate-950/80 px-1.5 py-0.5 rounded': preset.background === 'box',
                        'bg-slate-900/50 backdrop-blur px-1.5 py-0.5 rounded-full border border-white/10': preset.background === 'blur',
                        'bg-gradient-to-t from-black/80 to-transparent px-1.5 py-0.5 rounded': preset.background === 'gradient',
                      }"
                    >
                      <template v-if="preset.highlightMode === 'color' || preset.highlightMode === 'box' || preset.highlightMode === 'scale'">
                        <span>Cool </span>
                        <span :style="{ color: preset.highlightColor }" :class="{ 'bg-red-500/25 px-0.5 rounded': preset.highlightMode === 'box', 'scale-105 inline-block font-black': preset.highlightMode === 'scale' }">Clip</span>
                      </template>
                      <template v-else-if="preset.highlightMode === 'underline'">
                        <span>Cool </span>
                        <span class="relative inline-block font-bold" :style="{ color: preset.highlightColor }">
                          Clip
                          <span class="absolute -bottom-0.5 left-0 right-0 h-[2px] rounded-full" :style="{ backgroundColor: preset.highlightColor }" />
                        </span>
                      </template>
                      <template v-else>
                        <span>Cool Clip</span>
                      </template>
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Display Mode -->
            <div>
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Display Mode</span>
                <Icon name="ri:text-wrap" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-3 gap-1.5">
                <button 
                  v-for="mode in [
                    { id: 'word', label: '1 Word' },
                    { id: '3_words', label: '3 Words' },
                    { id: '4_words', label: '4 Words' }
                  ]" :key="mode.id"
                  @click="state.subtitleMode.value = mode.id"
                  :disabled="state.renderStatus.value === 'rendering'"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[10px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-card"
                  :class="state.subtitleMode.value === mode.id 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                    : 'text-slate-400 hover:border-accent-500/30 hover:text-white'"
                >{{ mode.label }}</button>
              </div>
            </div>

            <!-- Subtitle Sync Timing -->
            <div class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 space-y-1.5">
              <div class="flex justify-between items-center">
                <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Icon name="ri:timer-line" class="text-accent-500" />
                  Sync Offset (Timing)
                </span>
                <span class="mono text-[10px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ state.subtitleSyncOffset.value }}ms</span>
              </div>
              <input v-model.number="state.subtitleSyncOffset.value" :disabled="state.renderStatus.value === 'rendering'" type="range" min="-2000" max="2000" step="50" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30" />
              <div class="flex justify-between text-[8px] text-slate-500 font-bold">
                <span>EARLIER (-ms)</span>
                <span>LATER (+ms)</span>
              </div>
            </div>

            <!-- Animation Type -->
            <div>
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Animation</span>
                <Icon name="ri:play-circle-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-3 gap-1.5">
                <button 
                  v-for="anim in animations" :key="anim.id"
                  @click="state.subtitleAnimation.value = anim.id"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] transition-all flex flex-col items-center gap-0.5 hover:bg-surface-card"
                  :class="state.subtitleAnimation.value === anim.id 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)] font-bold' 
                    : 'text-slate-400 hover:border-accent-500/40 hover:text-white'"
                >
                  <Icon :name="anim.icon" class="text-xs" />
                  <span class="font-bold tracking-wider uppercase text-[8px]">{{ anim.label }}</span>
                </button>
              </div>
            </div>

            <!-- Highlight Mode -->
            <div v-if="state.subtitleMode.value !== 'word' || state.subtitleAnimation.value === 'karaoke'">
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Highlight Mode</span>
                <Icon name="ri:mark-pen-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-2 gap-1.5">
                <button 
                  v-for="hl in highlights" :key="hl.id"
                  @click="state.subtitleHighlightMode.value = hl.id"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all hover:bg-surface-card"
                  :class="state.subtitleHighlightMode.value === hl.id 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                    : 'text-slate-400 hover:border-accent-500/40 hover:text-white'"
                >{{ hl.label }}</button>
              </div>
            </div>

            <!-- Text Background -->
            <div>
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Text Background</span>
                <Icon name="ri:shape-2-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-3 gap-1.5">
                <button 
                  v-for="bg in backgrounds" :key="bg.id"
                  @click="state.subtitleBackground.value = bg.id"
                  class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all hover:bg-surface-card"
                  :class="state.subtitleBackground.value === bg.id 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                    : 'text-slate-400 hover:border-accent-500/40 hover:text-white'"
                >{{ bg.label }}</button>
              </div>
            </div>
          </div>

          <!-- TAB 2: TYPOGRAPHY & COLORS -->
          <div v-else-if="activeTab === 'type'" key="type" class="space-y-4">
            <!-- Font Family & Text Transform -->
            <div class="space-y-2.5">
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between">
                <span>Font & Case</span>
                <Icon name="ri:font-family" class="text-slate-400" />
              </h2>

              <div>
                <label class="text-[9px] text-slate-400 block mb-1 font-bold uppercase tracking-wider">Font Family</label>
                <select v-model="state.font.value" class="w-full bg-surface-dark/60 border border-surface-border rounded-xl p-2 text-xs font-bold text-white focus:outline-none focus:border-accent-500 transition-colors">
                  <option v-for="f in FONT_OPTIONS" :key="f" :value="f">{{ f }}</option>
                  <option value="Arial">Arial (System)</option>
                </select>
              </div>

              <div>
                <label class="text-[9px] text-slate-400 block mb-1 font-bold uppercase tracking-wider">Text Case</label>
                <div class="grid grid-cols-3 gap-1">
                  <button 
                    v-for="tt in ['uppercase', 'capitalize', 'none']" :key="tt"
                    @click="state.subtitleTextTransform.value = tt"
                    class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold transition-all uppercase tracking-wider hover:bg-surface-card"
                    :class="state.subtitleTextTransform.value === tt 
                      ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                      : 'text-slate-400 hover:border-accent-500/40'"
                  >{{ tt === 'none' ? 'Normal' : tt }}</button>
                </div>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Dual-Column Numeric Inputs Grid -->
            <div class="space-y-2.5">
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between">
                <span>Sizing & Weights</span>
                <Icon name="ri:equalizer-line" class="text-slate-400" />
              </h2>

              <!-- Row 1: Font Size & Font Weight -->
              <div class="grid grid-cols-2 gap-2.5">
                <div class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Size</span>
                    <span class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ state.fontSize.value }}px</span>
                  </div>
                  <input v-model.number="state.fontSize.value" type="range" min="40" max="140" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
                </div>

                <div class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Weight</span>
                    <span v-if="!SINGLE_WEIGHT_FONTS.has(state.font.value)" class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ state.subtitleFontWeight.value }}</span>
                    <span v-else class="text-[8px] text-slate-500 font-bold uppercase">Fixed</span>
                  </div>
                  <input v-if="!SINGLE_WEIGHT_FONTS.has(state.font.value)" v-model.number="state.subtitleFontWeight.value" type="range" min="400" max="900" step="100" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
                  <div v-else class="h-1 bg-surface-border/40 rounded-lg"></div>
                </div>
              </div>

              <!-- Row 2: Stroke Width & Word Spacing -->
              <div class="grid grid-cols-2 gap-2.5">
                <div class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Stroke</span>
                    <span class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ state.subtitleStrokeWidth.value }}px</span>
                  </div>
                  <input v-model.number="state.subtitleStrokeWidth.value" type="range" min="0" max="8" step="1" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
                </div>

                <div class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Spacing</span>
                    <span class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ state.subtitleWordSpacing.value }}px</span>
                  </div>
                  <input v-model.number="state.subtitleWordSpacing.value" :disabled="state.renderStatus.value === 'rendering'" type="range" min="-20" max="80" step="1" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30" />
                </div>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Compact Color Swatch Bar -->
            <div class="space-y-2.5">
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between">
                <span>Color System</span>
                <Icon name="ri:palette-fill" class="text-slate-400" />
              </h2>

              <!-- Swatch Trigger Bar -->
              <div class="grid grid-cols-3 gap-2 bg-surface-dark/60 border border-surface-border/80 rounded-xl p-1.5">
                <button 
                  @click="activeColorPicker = activeColorPicker === 'text' ? null : 'text'"
                  class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border"
                  :class="activeColorPicker === 'text' 
                    ? 'border-accent-500 bg-accent-500/10' 
                    : 'border-surface-border/50 hover:bg-surface-card'"
                >
                  <div class="w-5 h-5 rounded-md border border-white/20 shadow-sm" :style="{ background: state.subtitleTextColor.value }"></div>
                  <span class="text-[9px] font-bold uppercase tracking-wider text-slate-300">Text</span>
                </button>

                <button 
                  @click="activeColorPicker = activeColorPicker === 'highlight' ? null : 'highlight'"
                  class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border"
                  :class="activeColorPicker === 'highlight' 
                    ? 'border-accent-500 bg-accent-500/10' 
                    : 'border-surface-border/50 hover:bg-surface-card'"
                >
                  <div class="w-5 h-5 rounded-md border border-white/20 shadow-sm" :style="{ background: state.subtitleHighlightColor.value }"></div>
                  <span class="text-[9px] font-bold uppercase tracking-wider text-slate-300">Highlight</span>
                </button>

                <button 
                  @click="activeColorPicker = activeColorPicker === 'stroke' ? null : 'stroke'"
                  class="flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all border"
                  :class="activeColorPicker === 'stroke' 
                    ? 'border-accent-500 bg-accent-500/10' 
                    : 'border-surface-border/50 hover:bg-surface-card'"
                >
                  <div class="w-5 h-5 rounded-md border border-white/20 shadow-sm" :style="{ background: state.subtitleStrokeColor.value }"></div>
                  <span class="text-[9px] font-bold uppercase tracking-wider text-slate-300">Stroke</span>
                </button>
              </div>

              <!-- Inline Swatch Palette Popover Drawer -->
              <div v-if="activeColorPicker" class="bg-surface-dark/80 border border-surface-border rounded-xl p-2.5 space-y-2 animate-in zoom-in-95 duration-150">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] font-bold uppercase tracking-wider text-accent-500">
                    Select {{ activeColorPicker }} Color
                  </span>
                  <button @click="activeColorPicker = null" class="text-slate-500 hover:text-white">
                    <Icon name="ri:close-line" class="text-sm" />
                  </button>
                </div>

                <!-- Palette options for Text & Highlight -->
                <div v-if="activeColorPicker === 'text' || activeColorPicker === 'highlight'" class="flex gap-1.5 flex-wrap">
                  <button 
                    v-for="c in palette" :key="activeColorPicker+'-'+c"
                    @click="activeColorPicker === 'text' ? (state.subtitleTextColor.value = c) : (state.subtitleHighlightColor.value = c)"
                    class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110"
                    :class="(activeColorPicker === 'text' ? state.subtitleTextColor.value : state.subtitleHighlightColor.value) === c ? 'border-accent-500 scale-110' : 'border-transparent'"
                    :style="{ background: c }"
                  ></button>
                  <input 
                    type="color" 
                    :value="activeColorPicker === 'text' ? state.subtitleTextColor.value : state.subtitleHighlightColor.value"
                    @input="e => activeColorPicker === 'text' ? (state.subtitleTextColor.value = e.target.value) : (state.subtitleHighlightColor.value = e.target.value)"
                    class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent" 
                    title="Custom color" 
                  />
                </div>

                <!-- Palette options for Stroke -->
                <div v-if="activeColorPicker === 'stroke'" class="flex gap-1.5 flex-wrap">
                  <button 
                    v-for="c in ['#000000', '#FFFFFF', '#1a1a1a', '#333333', '#EF4444', '#3B82F6']" :key="'stroke-'+c"
                    @click="state.subtitleStrokeColor.value = c"
                    class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110"
                    :class="state.subtitleStrokeColor.value === c ? 'border-accent-500 scale-110' : 'border-white/10'"
                    :style="{ background: c }"
                  ></button>
                  <input type="color" v-model="state.subtitleStrokeColor.value" class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent" title="Custom color" />
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: LAYOUT & EXPORT -->
          <div v-else-if="activeTab === 'layout'" key="layout" class="space-y-4">
            <!-- Video Layout Mode -->
            <div>
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Video Layout Mode</span>
                <Icon name="ri:aspect-ratio-line" class="text-slate-400" />
              </h2>
              <div class="grid grid-cols-2 gap-1.5 bg-surface-dark/60 border border-surface-border/80 rounded-xl p-1">
                <button
                  @click="state.videoLayout ? (state.videoLayout.value = 'vertical') : null"
                  class="py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border"
                  :class="(state.videoLayout?.value || 'vertical') === 'vertical'
                    ? 'border-accent-500 bg-accent-500/10 text-accent-500 shadow-sm font-black'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-surface-card/50'"
                >
                  <Icon name="ri:smartphone-line" class="text-xs shrink-0" />
                  <span>Vertical (Crop)</span>
                </button>
                <button
                  @click="state.videoLayout ? (state.videoLayout.value = 'landscape') : null"
                  class="py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border"
                  :class="state.videoLayout?.value === 'landscape'
                    ? 'border-accent-500 bg-accent-500/10 text-accent-500 shadow-sm font-black'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-surface-card/50'"
                >
                  <Icon name="ri:landscape-line" class="text-xs shrink-0" />
                  <span>Landscape (Fit)</span>
                </button>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Safe Zone Overlay -->
            <div>
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Safe Zone Overlay</span>
                <Icon name="ri:layout-grid-line" class="text-slate-400" />
              </h2>
              <div class="space-y-2.5">
                <!-- Platform Selector Grid -->
                <div class="grid grid-cols-4 gap-1.5">
                  <button 
                    v-for="platform in [
                      { id: 'none', label: 'None', icon: 'ri:eye-off-line' },
                      { id: 'tiktok', label: 'TikTok', icon: 'ri:tiktok-fill' },
                      { id: 'reels', label: 'Reels', icon: 'ri:instagram-line' },
                      { id: 'shorts', label: 'Shorts', icon: 'ri:youtube-fill' }
                    ]" :key="platform.id"
                    @click="activeSafeZone = platform.id"
                    class="bg-surface-dark/50 border border-surface-border rounded-xl p-1.5 text-center text-[10px] transition-all hover:bg-surface-card flex flex-col items-center gap-1"
                    :class="activeSafeZone === platform.id 
                      ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)] font-bold' 
                      : 'text-slate-400 hover:border-accent-500/30 hover:text-white'"
                  >
                    <Icon :name="platform.icon" class="text-xs" />
                    <span class="font-bold tracking-wider text-[9px]">{{ platform.label }}</span>
                  </button>
                </div>

                <!-- Customizations (only visible if platform is selected) -->
                <div v-if="activeSafeZone !== 'none'" class="space-y-2.5 pt-2 border-t border-surface-border/30 animate-in fade-in duration-150">
                  <div>
                    <label class="text-[9px] text-slate-400 flex justify-between mb-1 font-bold uppercase tracking-wider">
                      <span>Overlay Opacity</span>
                      <span class="mono text-accent-500 bg-accent-500/10 px-1 rounded">{{ safeZoneOpacity }}%</span>
                    </label>
                    <input 
                      v-model.number="safeZoneOpacity" 
                      type="range" min="10" max="90" step="5" 
                      class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>

                  <div>
                    <label class="text-[9px] text-slate-400 flex items-center justify-between mb-1 font-bold uppercase tracking-wider">
                      <span>Overlay Color</span>
                      <div class="w-3 h-3 rounded border border-white/20" :style="{ background: safeZoneColor }"></div>
                    </label>
                    <div class="flex gap-1.5 flex-wrap">
                      <button 
                        v-for="c in ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b']" :key="'sz-color-'+c"
                        @click="safeZoneColor = c"
                        class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110"
                        :class="safeZoneColor === c ? 'border-accent-500 scale-110' : 'border-transparent'"
                        :style="{ background: c }"
                      ></button>
                      <input type="color" v-model="safeZoneColor" class="w-5 h-5 rounded-md border-0 cursor-pointer bg-transparent" title="Custom color" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <hr class="border-surface-border/40" />

            <!-- Positioning & Y-Offset -->
            <div class="space-y-2.5">
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center justify-between">
                <span>Positioning & Vertical Offset</span>
                <Icon name="ri:align-center" class="text-slate-400" />
              </h2>

              <div class="flex gap-1.5">
                <button 
                  v-for="pos in ['top', 'center', 'bottom']" :key="pos"
                  @click="state.subtitlePosition.value = pos"
                  :disabled="state.renderStatus.value === 'rendering'"
                  class="flex-1 bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-xs font-bold transition-all capitalize disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-card"
                  :class="state.subtitlePosition.value === pos 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                    : 'text-slate-400 hover:border-accent-500 hover:text-white'"
                >{{ pos }}</button>
              </div>

              <div class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Y-Offset (Vertical)</span>
                  <span class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ state.subtitleOffset.value }}px</span>
                </div>
                <input v-model.number="state.subtitleOffset.value" :disabled="state.renderStatus.value === 'rendering'" type="range" min="0" max="500" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30" />
              </div>

              <div v-if="state.subtitleBackground.value !== 'none'" class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2 space-y-1">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">BG Opacity</span>
                  <span class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded">{{ Math.round(state.subtitleBackgroundOpacity.value * 100) }}%</span>
                </div>
                <input v-model.number="state.subtitleBackgroundOpacity.value" type="range" min="0" max="1" step="0.05" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>

            <!-- Crop Mode (Vertical Only) -->
            <div v-if="(state.videoLayout?.value || 'vertical') === 'vertical'">
              <hr class="border-surface-border/40 mb-4" />
              <h2 class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center justify-between">
                <span>Crop Mode</span>
                <Icon name="ri:crop-line" class="text-slate-400" />
              </h2>
              
              <div class="flex gap-2 mb-2">
                <button 
                  @click="state.cropMode.value = 'manual'"
                  class="flex-1 bg-surface-dark/50 border rounded-xl p-2 text-center text-xs font-bold transition-all flex flex-col items-center gap-1 hover:bg-surface-card"
                  :class="state.cropMode.value === 'manual' 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                    : 'border-surface-border text-slate-400 hover:border-accent-500 hover:text-white'"
                >
                  <Icon name="ri:drag-move-2-line" class="text-base" />
                  Manual Pan
                </button>
                <button 
                  @click="state.cropMode.value = 'face_tracking'"
                  class="flex-1 bg-surface-dark/50 border rounded-xl p-2 text-center text-xs font-bold transition-all flex flex-col items-center gap-1 hover:bg-surface-card"
                  :class="state.cropMode.value === 'face_tracking' 
                    ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(207,255,80,0.1)]' 
                    : 'border-surface-border text-slate-400 hover:border-accent-500 hover:text-white'"
                >
                  <Icon name="ri:body-scan-line" class="text-base" />
                  AI Face Track
                </button>
              </div>

              <div v-if="state.cropMode.value === 'manual'" class="bg-surface-dark/50 border border-surface-border rounded-xl p-2">
                <label class="text-[9px] text-slate-400 flex justify-between uppercase font-bold tracking-wider mb-1">
                  <span>Horizontal Position</span>
                  <span class="mono text-accent-500 font-bold">{{ Math.round(state.cropPercentX.value) }}%</span>
                </label>
                <input v-model.number="state.cropPercentX.value" type="range" min="0" max="100" step="1" class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer" />
                <div class="flex justify-between text-[8px] text-slate-500 mt-0.5 mono font-bold">
                  <span>LEFT</span>
                  <span>CENTER</span>
                  <span>RIGHT</span>
                </div>
              </div>
              
              <p v-if="state.cropMode.value === 'face_tracking'" class="text-[9px] text-slate-400 mt-1.5 italic">
                AI will auto-detect the primary face and center the 9:16 crop during render.
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Extremely Compact Ultra-Slim Main Action Footer -->
    <div class="p-2.5 border-t border-surface-border bg-surface-panel/95 backdrop-blur-md shrink-0 space-y-2">
      <!-- Render Status Download Alert Banner (Compact) -->
      <div v-if="state.renderStatus.value === 'ready' || state.renderStatus.value === 'done'" class="bg-accent-500/10 border border-accent-500/30 rounded-lg p-2 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
        <Icon name="ri:checkbox-circle-fill" class="text-lg text-accent-500 shrink-0" />
        <div class="flex-1 overflow-hidden">
          <p class="text-[8px] font-bold text-accent-400 uppercase tracking-wider">Render Complete</p>
          <a :href="state.outputUrl.value" target="_blank" class="text-[11px] text-white underline font-medium hover:text-accent-500 transition-colors block truncate">Download Result</a>
        </div>
      </div>

      <!-- Single Line Flex Controls (Save Default + RENDER CLIP) -->
      <div class="flex items-center gap-2">
        <!-- Save Style Button with Custom Instant Tooltip -->
        <div class="relative group shrink-0">
          <button 
            @click="state.saveDefaultStyleSettings(); if (state.showToast) state.showToast('Default style saved!', 'success')"
            :disabled="state.jobStatus.value !== 'ready' || state.renderStatus.value === 'rendering'"
            class="bg-surface-dark/80 border border-surface-border/80 hover:border-accent-500/50 text-slate-300 hover:text-accent-400 p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 hover:bg-surface-card disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-surface-border/80 disabled:hover:text-slate-300 disabled:hover:bg-surface-dark/80"
          >
            <Icon name="ri:save-3-line" class="text-sm text-accent-500" />
            <span class="text-[10px] font-bold uppercase tracking-wider">Save Style</span>
          </button>

          <!-- Custom Instant Tooltip Popup -->
          <div class="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
            <div class="bg-surface-panel border border-surface-border text-slate-200 text-[9px] font-semibold py-1.5 px-2.5 rounded-lg shadow-xl backdrop-blur-md flex items-center gap-1.5">
              <Icon name="ri:information-fill" class="text-accent-500 text-xs shrink-0" />
              <span>Save this style as global default style for future clips</span>
            </div>
          </div>
        </div>

        <button 
          @click="prepareRender"
          :disabled="state.jobStatus.value !== 'ready' || state.renderStatus.value === 'rendering'"
          class="flex-1 bg-accent-500/80 text-black font-black uppercase tracking-wider rounded-xl py-2.5 px-3 text-xs hover:bg-accent-400 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(207,255,80,0.18)] hover:shadow-[0_0_20px_rgba(207,255,80,0.3)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <Icon :name="state.renderStatus.value === 'rendering' ? 'ri:loader-4-line' : 'ri:movie-fill'" :class="{ 'animate-spin': state.renderStatus.value === 'rendering' }" class="text-sm" />
          {{ state.renderStatus.value === 'rendering' ? 'RENDERING...' : 'RENDER CLIP' }}
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
      ></div>
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
        <div v-if="isNamingClip" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/60 backdrop-blur-md" @click="isNamingClip = false"></div>
          
          <div class="relative bg-surface-panel border border-surface-border p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300">
            <h3 class="text-xl font-black text-white mb-2 uppercase tracking-tighter italic">Name Your Clip</h3>
            <p class="text-slate-400 text-xs mb-6">Enter a title for your final video file.</p>
            
            <div class="space-y-4">
              <div>
                <label class="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1.5 block">File Name</label>
                <div class="relative group">
                  <input 
                    v-model="renderName"
                    @keyup.enter="startFinalRender"
                    class="w-full bg-surface-dark border border-surface-border/50 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-3 text-white font-bold outline-none transition-all pr-12 text-sm"
                    placeholder="e.g. My Viral Hook"
                    autoFocus
                  />
                  <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 font-mono">.mp4</span>
                </div>
                <p class="text-[9px] text-slate-600 mt-2 italic">Spaces will be converted to underscores.</p>
              </div>
              
              <div class="flex gap-3 pt-2">
                <button 
                  @click="isNamingClip = false"
                  class="flex-1 px-4 py-3 rounded-xl border border-surface-border text-slate-400 font-bold text-xs hover:bg-surface-card transition-all"
                >
                  Cancel
                </button>
                <button 
                  @click="startFinalRender"
                  class="flex-[1.5] bg-accent-500 hover:bg-accent-400 text-black px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(207,255,80,0.2)]"
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
        <div v-if="showBlacklistSettings" class="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/80 backdrop-blur-xl" @click="showBlacklistSettings = false"></div>
          <div class="relative bg-surface-panel border border-surface-border rounded-3xl shadow-2xl max-w-4xl max-h-[90vh] w-full flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden">
            <BlacklistSettings @close="showBlacklistSettings = false" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { FONT_OPTIONS } from '../composables/useClipperState'

const state = useClipperState()
const { activeSafeZone, safeZoneOpacity, safeZoneColor } = state

// Segmented Navigation Tab State
const activeTab = ref('style') // 'style' | 'type' | 'layout'
const activeColorPicker = ref(null) // null | 'text' | 'highlight' | 'stroke'

const showBlacklistSettings = ref(false)
const isNamingClip = ref(false)
const renderName = ref('')

// Resize variables
const sidebarWidth = ref(340)
const isResizing = ref(false)
const sidebarRef = ref(null)

function startResize(e) {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}

function handleResize(e) {
  if (!isResizing.value || !sidebarRef.value) return
  const rect = sidebarRef.value.getBoundingClientRect()
  const newWidth = e.clientX - rect.left
  // Clamp width between 280px and 340px
  sidebarWidth.value = Math.max(280, Math.min(340, newWidth))
}

function stopResize() {
  if (!isResizing.value) return
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
  
  // Persist computed sidebar width to localStorage
  localStorage.setItem('yonru_sidebar_width', sidebarWidth.value.toString())
}

onMounted(() => {
  const savedWidth = localStorage.getItem('yonru_sidebar_width')
  if (savedWidth) {
    const widthNum = parseInt(savedWidth, 10)
    if (!isNaN(widthNum)) {
      sidebarWidth.value = Math.max(280, Math.min(340, widthNum))
    }
  }
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})

function prepareRender() {
  if (state.activeHook.value) {
    renderName.value = state.activeHook.value.theme || ''
  }
  isNamingClip.value = true
}

function startFinalRender() {
  if (!renderName.value.trim()) return
  isNamingClip.value = false
  state.renderClip(0, renderName.value.trim())
}

const SINGLE_WEIGHT_FONTS = new Set([
  'Bebas Neue', 'Anton', 'Bangers', 'Permanent Marker', 'Russo One',
  'Luckiest Guy', 'Titan One', 'Lilita One', 'Passion One'
])

const palette = [
  '#FFFFFF', '#CFFF50', '#FFD700', '#EF4444', '#60A5FA',
  '#A78BFA', '#34D399', '#FB923C', '#F472B6', '#000000'
]

const animations = [
  { id: 'pop', label: 'Pop', icon: 'ri:magic-line' },
  { id: 'slide-up', label: 'Slide', icon: 'ri:arrow-up-line' },
  { id: 'fade', label: 'Fade', icon: 'ri:contrast-drop-line' },
  { id: 'bounce', label: 'Bounce', icon: 'ri:basketball-line' },
  { id: 'typewriter', label: 'Type', icon: 'ri:keyboard-line' },
  { id: 'karaoke', label: 'Karaoke', icon: 'ri:mic-line' },
]

const highlights = [
  { id: 'color', label: 'Color Swap' },
  { id: 'scale', label: 'Scale Pulse' },
  { id: 'underline', label: 'Underline' },
  { id: 'box', label: 'Box Highlight' },
  { id: 'none', label: 'None' },
]

const backgrounds = [
  { id: 'none', label: 'None' },
  { id: 'box', label: 'Dark Box' },
  { id: 'blur', label: 'Blur Pill' },
]

const presets = [
  { id: 'bold-podcast', name: 'Hormozi Bold', icon: '🎙️', font: 'Montserrat', fontSize: 50, fontWeight: 900, color: '#FFFFFF', highlightColor: '#CFFF50', animation: 'pop', highlightMode: 'color', background: 'none', strokeWidth: 0, textTransform: 'uppercase' },
  { id: 'clean-vlog', name: 'Minimal Glass', icon: '✨', font: 'Outfit', fontSize: 50, fontWeight: 700, color: '#FFFFFF', highlightColor: '#A78BFA', animation: 'karaoke', highlightMode: 'scale', background: 'blur', strokeWidth: 0, textTransform: 'capitalize' },
  { id: 'street', name: 'Urban Street', icon: '🔥', font: 'Outfit', fontSize: 50, fontWeight: 900, color: '#FFFFFF', highlightColor: '#E2F952', animation: 'pop', highlightMode: 'color', background: 'none', strokeWidth: 3, textTransform: 'uppercase' },
  { id: 'documentary', name: 'Cinematic Docu', icon: '🎬', font: 'Noto Sans', fontSize: 50, fontWeight: 600, color: '#FFFBEB', highlightColor: '#F59E0B', animation: 'typewriter', highlightMode: 'underline', background: 'none', strokeWidth: 2, textTransform: 'capitalize' },
  { id: 'karaoke', name: 'Rhythm Karaoke', icon: '🎤', font: 'Oswald', fontSize: 50, fontWeight: 700, color: '#F1F5F9', highlightColor: '#FFD700', animation: 'karaoke', highlightMode: 'color', background: 'none', strokeWidth: 4, textTransform: 'uppercase' },
  { id: 'minimal', name: 'Modern Vlog', icon: '📹', font: 'Poppins', fontSize: 50, fontWeight: 700, color: '#FFFFFF', highlightColor: '#38BDF8', animation: 'slide-up', highlightMode: 'scale', background: 'none', strokeWidth: 3, textTransform: 'capitalize' },
]

function applyPreset(preset) {
  state.subtitlePreset.value = preset.id
  state.font.value = preset.font
  state.fontSize.value = preset.fontSize
  state.subtitleFontWeight.value = preset.fontWeight
  state.subtitleTextColor.value = preset.color
  state.subtitleHighlightColor.value = preset.highlightColor
  state.subtitleAnimation.value = preset.animation
  state.subtitleHighlightMode.value = preset.highlightMode
  state.subtitleBackground.value = preset.background
  state.subtitleStrokeWidth.value = preset.strokeWidth
  state.subtitleTextTransform.value = preset.textTransform
}
</script>

<style scoped>
.panel-tab-fade-enter-active,
.panel-tab-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
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
