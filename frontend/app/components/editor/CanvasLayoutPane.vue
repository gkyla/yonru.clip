<template>
  <div class="space-y-4">
    <!-- Video Layout Mode (Target Ratio) -->
    <div>
      <h2
        class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 flex items-center justify-between"
      >
        <span>Video Layout Mode</span>
        <Icon name="ri:aspect-ratio-line" class="text-slate-400" />
      </h2>
      <div class="grid grid-cols-2 gap-1.5">
        <button
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 hover:bg-surface-card cursor-pointer"
          :class="
            (state.videoLayout?.value || 'vertical') === 'vertical'
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
              : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
          "
          @click="
            state.videoLayout ? (state.videoLayout.value = 'vertical') : null
          "
        >
          <Icon name="ri:smartphone-line" class="text-xs shrink-0" />
          <span>Vertical (9:16)</span>
        </button>
        <button
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 hover:bg-surface-card cursor-pointer"
          :class="
            state.videoLayout?.value === 'landscape'
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
              : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
          "
          @click="
            state.videoLayout ? (state.videoLayout.value = 'landscape') : null
          "
        >
          <Icon name="ri:landscape-line" class="text-xs shrink-0" />
          <span>Landscape (Fit)</span>
        </button>
      </div>
    </div>

    <!-- Landscape Background Treatment (Landscape Only) -->
    <Transition
      :css="false"
      @enter="onCropEnter"
      @after-enter="onCropAfterEnter"
      @leave="onCropLeave"
    >
      <div v-if="state.videoLayout?.value === 'landscape'" class="space-y-3">
        <hr class="border-surface-border/40" />
        <div>
          <h2
            class="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 flex items-center justify-between"
          >
            <span>Background Treatment</span>
            <Icon name="ri:drop-line" class="text-slate-400" />
          </h2>
          <div class="grid grid-cols-2 gap-1.5">
            <button
              class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 hover:bg-surface-card cursor-pointer"
              :class="
                (state.landscapeBackground?.value || 'black') === 'black'
                  ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
                  : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
              "
              @click="
                state.landscapeBackground
                  ? (state.landscapeBackground.value = 'black')
                  : null
              "
            >
              <Icon name="ri:contrast-drop-line" class="text-xs shrink-0" />
              <span>Solid Black</span>
            </button>
            <button
              class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 hover:bg-surface-card cursor-pointer"
              :class="
                state.landscapeBackground?.value === 'blur'
                  ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
                  : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
              "
              @click="
                state.landscapeBackground
                  ? (state.landscapeBackground.value = 'blur')
                  : null
              "
            >
              <Icon name="ri:blur-off-line" class="text-xs shrink-0" />
              <span>Blurred Video</span>
            </button>
          </div>
        </div>

        <!-- Blurred Video Fine-Tuning Sliders -->
        <div
          v-if="state.landscapeBackground?.value === 'blur'"
          class="space-y-2.5 pt-1 border-t border-surface-border/30"
        >
          <!-- Blur Radius Slider -->
          <div>
            <div
              class="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold mb-1"
            >
              <span class="text-slate-400">Blur Radius</span>
              <span class="text-accent-500 font-mono"
                >{{ state.landscapeBlurRadius?.value ?? 25 }}px</span
              >
            </div>
            <input
              v-if="state.landscapeBlurRadius"
              v-model.number="state.landscapeBlurRadius.value"
              type="range"
              min="5"
              max="50"
              step="1"
              class="w-full h-1 bg-surface-dark rounded-lg appearance-none cursor-pointer accent-accent-500"
            />
          </div>

          <!-- Overlay Dimming / Darkness Slider -->
          <div>
            <div
              class="flex items-center justify-between text-[9px] uppercase tracking-wider font-bold mb-1"
            >
              <span class="text-slate-400">Dimming Overlay</span>
              <span class="text-accent-500 font-mono"
                >{{ state.landscapeDarkness?.value ?? 35 }}%</span
              >
            </div>
            <input
              v-if="state.landscapeDarkness"
              v-model.number="state.landscapeDarkness.value"
              type="range"
              min="0"
              max="80"
              step="5"
              class="w-full h-1 bg-surface-dark rounded-lg appearance-none cursor-pointer accent-accent-500"
            />
          </div>
        </div>
      </div>
    </Transition>

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
          <div class="grid grid-cols-2 gap-1.5">
            <button
              class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 hover:bg-surface-card cursor-pointer"
              :class="
                state.cropMode?.value === 'face_tracking'
                  ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
                  : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
              "
              @click="state.cropMode.value = 'face_tracking'"
            >
              <Icon name="ri:scan-line" class="text-xs shrink-0" />
              <span>Face Track</span>
            </button>
            <button
              class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 hover:bg-surface-card cursor-pointer"
              :class="
                state.cropMode?.value === 'manual'
                  ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
                  : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
              "
              @click="state.cropMode.value = 'manual'"
            >
              <Icon name="ri:drag-move-2-line" class="text-xs shrink-0" />
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
            v-if="state.cropMode?.value === 'manual'"
            class="overflow-hidden space-y-2"
          >
            <div
              class="bg-surface-dark/50 border border-surface-border rounded-xl p-2 mt-2"
            >
              <label
                class="text-[9px] text-slate-400 flex justify-between uppercase font-bold tracking-wider mb-1"
              >
                <span>Horizontal Position</span>
                <span class="mono text-accent-500 font-bold"
                  >{{ Math.round(state.cropPercentX?.value ?? 50) }}%</span
                >
              </label>
              <input
                v-if="state.cropPercentX"
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
          </div>
        </Transition>

        <Transition :css="false" @enter="onFadeEnter" @leave="onFadeLeave">
          <div
            v-if="state.cropMode?.value === 'face_tracking'"
            class="overflow-hidden space-y-2 mt-2"
          >
            <p class="text-[10.5px] text-slate-400 flex items-center gap-1.5">
              <Icon
                name="ri:lightbulb-line"
                class="text-accent-500 text-sm shrink-0"
              />
              <span
                >You can zoom in/out speaker whenever screen is splitted</span
              >
            </p>

            <!-- Stacked Multi-Speaker Framing Zoom Controls (Dual Spatial Stack) -->
            <div v-if="isCurrentSplit || hasAnySplit" class="space-y-2.5 pt-1">
              <!-- Header Status & Global Reset -->
              <div class="flex items-center justify-between">
                <span
                  class="text-[10px] text-accent-500 font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <Icon name="ri:zoom-in-line" class="text-xs" />
                  Split Speaker Zoom
                </span>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="isCurrentSplit"
                    class="text-[7.5px] uppercase px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-500 font-bold border border-accent-500/30"
                    >Active</span
                  >
                  <span
                    v-else
                    class="text-[7.5px] uppercase px-1.5 py-0.5 rounded bg-surface-card text-slate-400 font-bold border border-surface-border"
                    >Inactive (Solo)</span
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
                    class="text-[7.5px] uppercase px-1.5 py-0.5 rounded bg-surface-border text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Reset All Zoom & Framing"
                    @click="resetSplitZoom"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <!-- Contextual Jump to Split Banner when currently on single-speaker shot -->
              <div
                v-if="!isCurrentSplit"
                class="flex items-center justify-between p-1.5 rounded-lg bg-surface-dark/70 border border-surface-border/60 text-[8.5px]"
              >
                <div
                  class="flex items-center gap-1 text-slate-400 truncate min-w-0"
                >
                  <Icon
                    name="ri:information-line"
                    class="text-xs text-slate-400 shrink-0"
                  />
                  <span class="truncate">Currently on single speaker</span>
                </div>
                <button
                  type="button"
                  class="text-[8px] font-bold text-accent-500 hover:text-accent-400 uppercase tracking-wider flex items-center gap-0.5 shrink-0 hover:underline px-1.5 py-0.5 rounded bg-accent-500/10 cursor-pointer"
                  @click="jumpToSplit"
                >
                  <span>Jump to Split</span>
                  <Icon name="ri:arrow-right-s-line" class="text-xs" />
                </button>
              </div>

              <!-- Top Speaker Spatial Card (Upper Half) -->
              <div
                class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 space-y-2"
              >
                <div
                  class="flex justify-between items-center text-[9px] font-bold tracking-wider uppercase"
                >
                  <span class="flex items-center gap-1.5 text-slate-300">
                    <Icon
                      name="ri:layout-top-line"
                      class="text-accent-500 text-xs shrink-0"
                    />
                    <span>Top Speaker Zoom</span>
                  </span>
                  <span
                    class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                    >{{ (state.splitZoomTop?.value ?? 1.0).toFixed(2) }}x</span
                  >
                </div>

                <input
                  v-if="state.splitZoomTop"
                  v-model.number="state.splitZoomTop.value"
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                />

                <!-- Top Framing Adjustments (Auto-Disclosed when zoom > 1.0) -->
                <div
                  v-if="(state.splitZoomTop?.value ?? 1.0) > 1.0"
                  class="pt-1.5 border-t border-surface-border/50 space-y-1.5 animate-in fade-in duration-150"
                >
                  <div
                    class="flex items-center justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider"
                  >
                    <span class="flex items-center gap-1 text-accent-400">
                      <Icon name="ri:focus-3-line" class="text-[9px]" />
                      <span>Framing Position</span>
                    </span>
                    <button
                      v-if="
                        (state.splitOffsetXTop?.value ?? 0) !== 0 ||
                        (state.splitOffsetYTop?.value ?? 0) !== 0
                      "
                      class="text-[7px] uppercase px-1.5 py-0.5 rounded bg-surface-border text-slate-300 hover:text-white transition-colors cursor-pointer"
                      @click="resetTopFraming"
                    >
                      Reset
                    </button>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5">
                    <!-- Up / Down (Vertical) -->
                    <div
                      v-if="state.splitOffsetYTop"
                      class="bg-surface-dark/60 rounded-lg p-1.5 space-y-0.5 border border-surface-border/40"
                    >
                      <div
                        class="flex justify-between items-center text-[7.5px] text-slate-400 uppercase font-bold"
                      >
                        <span>Up / Down</span>
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

                    <!-- Left / Right (Horizontal) -->
                    <div
                      v-if="state.splitOffsetXTop"
                      class="bg-surface-dark/60 rounded-lg p-1.5 space-y-0.5 border border-surface-border/40"
                    >
                      <div
                        class="flex justify-between items-center text-[7.5px] text-slate-400 uppercase font-bold"
                      >
                        <span>Left / Right</span>
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
              </div>

              <!-- Bottom Speaker Spatial Card (Lower Half) -->
              <div
                class="bg-surface-dark/40 border border-surface-border/80 rounded-xl p-2.5 space-y-2"
              >
                <div
                  class="flex justify-between items-center text-[9px] font-bold tracking-wider uppercase"
                >
                  <span class="flex items-center gap-1.5 text-slate-300">
                    <Icon
                      name="ri:layout-bottom-line"
                      class="text-accent-500 text-xs shrink-0"
                    />
                    <span>Bottom Speaker Zoom</span>
                  </span>
                  <span
                    class="mono text-[9px] text-accent-500 font-bold bg-accent-500/10 px-1 rounded"
                    >{{
                      (state.splitZoomBottom?.value ?? 1.0).toFixed(2)
                    }}x</span
                  >
                </div>

                <input
                  v-if="state.splitZoomBottom"
                  v-model.number="state.splitZoomBottom.value"
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer"
                />

                <!-- Bottom Framing Adjustments (Auto-Disclosed when zoom > 1.0) -->
                <div
                  v-if="(state.splitZoomBottom?.value ?? 1.0) > 1.0"
                  class="pt-1.5 border-t border-surface-border/50 space-y-1.5 animate-in fade-in duration-150"
                >
                  <div
                    class="flex items-center justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider"
                  >
                    <span class="flex items-center gap-1 text-accent-400">
                      <Icon name="ri:focus-3-line" class="text-[9px]" />
                      <span>Framing Position</span>
                    </span>
                    <button
                      v-if="
                        (state.splitOffsetXBottom?.value ?? 0) !== 0 ||
                        (state.splitOffsetYBottom?.value ?? 0) !== 0
                      "
                      class="text-[7px] uppercase px-1.5 py-0.5 rounded bg-surface-border text-slate-300 hover:text-white transition-colors cursor-pointer"
                      @click="resetBottomFraming"
                    >
                      Reset
                    </button>
                  </div>

                  <div class="grid grid-cols-2 gap-1.5">
                    <!-- Up / Down (Vertical) -->
                    <div
                      v-if="state.splitOffsetYBottom"
                      class="bg-surface-dark/60 rounded-lg p-1.5 space-y-0.5 border border-surface-border/40"
                    >
                      <div
                        class="flex justify-between items-center text-[7.5px] text-slate-400 uppercase font-bold"
                      >
                        <span>Up / Down</span>
                        <span class="mono text-accent-500 font-bold"
                          >{{
                            Math.round(state.splitOffsetYBottom?.value ?? 0)
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

                    <!-- Left / Right (Horizontal) -->
                    <div
                      v-if="state.splitOffsetXBottom"
                      class="bg-surface-dark/60 rounded-lg p-1.5 space-y-0.5 border border-surface-border/40"
                    >
                      <div
                        class="flex justify-between items-center text-[7.5px] text-slate-400 uppercase font-bold"
                      >
                        <span>Left / Right</span>
                        <span class="mono text-accent-500 font-bold"
                          >{{
                            Math.round(state.splitOffsetXBottom?.value ?? 0)
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
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="platform in [
              { id: 'none', label: 'None', icon: 'ri:eye-off-line' },
              { id: 'tiktok', label: 'TikTok', icon: 'ri:tiktok-fill' },
              {
                id: 'reels',
                label: 'Reels',
                icon: 'ri:instagram-line'
              },
              {
                id: 'shorts',
                label: 'Shorts',
                icon: 'ri:youtube-fill'
              }
            ]"
            :key="platform.id"
            class="bg-surface-dark/50 border border-surface-border rounded-lg py-1.5 px-1 text-center text-[8.5px] font-bold uppercase tracking-wider transition-all grid place-items-center gap-1 hover:bg-surface-card cursor-pointer"
            :class="
              activeSafeZone === platform.id
                ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
                : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
            "
            @click="activeSafeZone = platform.id"
          >
            <Icon :name="platform.icon" class="text-xs" />
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
              <span class="mono text-accent-500 bg-accent-500/10 px-1 rounded"
                >{{ safeZoneOpacity }}%</span
              >
            </label>
            <input
              v-model.number="safeZoneOpacity"
              type="range"
              min="10"
              max="100"
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
              ></div>
            </label>
            <div class="flex gap-1.5 flex-wrap">
              <button
                v-for="c in [
                  '#000000',
                  '#ef4444',
                  '#3b82f6',
                  '#10b981',
                  '#f59e0b'
                ]"
                :key="'sz-color-' + c"
                class="w-5 h-5 rounded-md border-2 transition-all hover:scale-110 cursor-pointer"
                :class="
                  safeZoneColor === c
                    ? 'border-accent-500 scale-110'
                    : 'border-transparent'
                "
                :style="{ background: c }"
                @click="safeZoneColor = c"
              ></button>
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
        <span>Subtitle Positioning</span>
        <Icon name="ri:align-center" class="text-slate-400" />
      </h2>

      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="pos in ['top', 'center', 'bottom']"
          :key="pos"
          :disabled="state.renderStatus?.value === 'rendering'"
          class="bg-surface-dark/50 border border-surface-border rounded-lg p-1.5 text-center text-[9px] font-bold tracking-wider transition-all flex items-center justify-center capitalize hover:bg-surface-card disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          :class="
            state.subtitlePosition?.value === pos
              ? 'border-accent-500 text-accent-500 bg-accent-500/5 shadow-[inset_0_0_8px_rgba(255,215,0,0.1)]'
              : 'text-slate-400 hover:border-accent-500/40 hover:text-white'
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
            <Icon name="ri:magic-line" class="text-accent-500 text-xs" />
            <span class="text-[10px] text-slate-300 font-bold"
              >Auto-Adaptive Subtitle</span
            >
          </div>
          <button
            type="button"
            class="w-8 h-4 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer"
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
            ></div>
          </button>
        </div>
        <p class="text-[10.5px] text-slate-400 leading-tight">
          {{
            (state.autoAdaptiveSubtitles?.value ?? true)
              ? 'Automatically positions to center when in split mode.'
              : 'Fixed to custom position presets regardless of video framing.'
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
            >{{ state.subtitleOffset?.value }}px</span
          >
        </div>
        <input
          v-if="state.subtitleOffset"
          v-model.number="state.subtitleOffset.value"
          :disabled="state.renderStatus?.value === 'rendering'"
          type="range"
          min="0"
          max="500"
          class="w-full accent-accent-500 h-1 bg-surface-border rounded-lg appearance-none cursor-pointer disabled:opacity-30"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, useAttrs } from 'vue';
import { useClipperState } from '../../composables/useClipperState';
import {
  isSplitFramingAtTimelineTime,
  findSplitTimelineJumpTime
} from '../../utils/timelineHelpers';

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

const activeSafeZone = state?.activeSafeZone;
const safeZoneOpacity = state?.safeZoneOpacity;
const safeZoneColor = state?.safeZoneColor;

const isCurrentSplit = computed(() => {
  if (!state?.cropMap?.value || state.cropMap.value.length === 0) return false;
  return isSplitFramingAtTimelineTime(
    state.cropMap.value,
    state.currentTime?.value || 0,
    state.thumbnailEnabled?.value ?? false,
    state.thumbnailDuration?.value ?? 0,
    state.timelineTracks?.value ?? []
  );
});

const hasAnySplit = computed(() => {
  return state?.cropMap?.value?.some(entry => entry.mode === 'split') ?? false;
});

function jumpToSplit() {
  if (!state?.cropMap?.value || state.cropMap.value.length === 0) return;
  const targetTime = findSplitTimelineJumpTime(
    state.cropMap.value,
    state.currentTime?.value || 0,
    state.thumbnailEnabled?.value ?? false,
    state.thumbnailDuration?.value ?? 0,
    state.timelineTracks?.value ?? []
  );
  if (targetTime !== null) {
    if (state.seekTo) {
      state.seekTo(targetTime);
    } else if (state.currentTime) {
      state.currentTime.value = targetTime;
    }
  }
}

function toggleAutoAdaptiveSubtitles() {
  if (state?.autoAdaptiveSubtitles) {
    state.autoAdaptiveSubtitles.value = !state.autoAdaptiveSubtitles.value;
  }
}

function resetSplitZoom() {
  if (state?.splitZoomTop) state.splitZoomTop.value = 1.0;
  if (state?.splitZoomBottom) state.splitZoomBottom.value = 1.0;
  if (state?.splitOffsetXTop) state.splitOffsetXTop.value = 0;
  if (state?.splitOffsetYTop) state.splitOffsetYTop.value = 0;
  if (state?.splitOffsetXBottom) state.splitOffsetXBottom.value = 0;
  if (state?.splitOffsetYBottom) state.splitOffsetYBottom.value = 0;
}

function resetTopFraming() {
  if (state?.splitOffsetXTop) state.splitOffsetXTop.value = 0;
  if (state?.splitOffsetYTop) state.splitOffsetYTop.value = 0;
}

function resetBottomFraming() {
  if (state?.splitOffsetXBottom) state.splitOffsetXBottom.value = 0;
  if (state?.splitOffsetYBottom) state.splitOffsetYBottom.value = 0;
}

function onCropEnter(el, done) {
  el.style.height = '0px';
  el.style.opacity = '0';
  el.style.overflow = 'hidden';
  el.style.marginTop = '0px';
  void el.offsetHeight; // trigger reflow

  const targetHeight = el.scrollHeight;
  el.style.transition =
    'height 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out, margin-top 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
  el.style.height = `${targetHeight}px`;
  el.style.opacity = '1';
  el.style.marginTop = '';

  let finished = false;
  const handleEnd = e => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener('transitionend', handleEnd);
      done();
    }
  };
  el.addEventListener('transitionend', handleEnd);
  setTimeout(() => handleEnd(), 350);
}

function onCropAfterEnter(el) {
  el.style.height = '';
  el.style.opacity = '';
  el.style.overflow = '';
  el.style.marginTop = '';
  el.style.transition = '';
}

function onCropLeave(el, done) {
  el.style.height = `${el.offsetHeight}px`;
  el.style.opacity = '1';
  el.style.overflow = 'hidden';
  void el.offsetHeight; // trigger reflow

  el.style.transition =
    'height 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-in, margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1)';
  el.style.height = '0px';
  el.style.opacity = '0';
  el.style.marginTop = '0px';

  let finished = false;
  const handleEnd = e => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener('transitionend', handleEnd);
      done();
    }
  };
  el.addEventListener('transitionend', handleEnd);
  setTimeout(() => handleEnd(), 330);
}

function onSlideEnter(el, done) {
  el.style.height = '0px';
  el.style.opacity = '0';
  el.style.overflow = 'hidden';
  void el.offsetHeight; // trigger reflow

  const targetHeight = el.scrollHeight;
  el.style.transition =
    'height 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease-out';
  el.style.height = `${targetHeight}px`;
  el.style.opacity = '1';

  let finished = false;
  const handleEnd = e => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener('transitionend', handleEnd);
      done();
    }
  };
  el.addEventListener('transitionend', handleEnd);
  setTimeout(() => handleEnd(), 350);
}

function onSlideAfterEnter(el) {
  el.style.height = '';
  el.style.opacity = '';
  el.style.overflow = '';
  el.style.transition = '';
}

function onSlideLeave(el, done) {
  el.style.height = `${el.offsetHeight}px`;
  el.style.opacity = '1';
  el.style.overflow = 'hidden';
  void el.offsetHeight; // trigger reflow

  el.style.transition =
    'height 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease-in';
  el.style.height = '0px';
  el.style.opacity = '0';

  let finished = false;
  const handleEnd = e => {
    if (e && e.target !== el) return;
    if (!finished) {
      finished = true;
      el.removeEventListener('transitionend', handleEnd);
      done();
    }
  };
  el.addEventListener('transitionend', handleEnd);
  setTimeout(() => handleEnd(), 300);
}

function onFadeEnter(el, done) {
  el.style.height = '0px';
  el.style.opacity = '0';
  el.style.overflow = 'hidden';
  void el.offsetHeight;

  const targetHeight = el.scrollHeight;
  el.style.transition =
    'height 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-out';
  el.style.height = `${targetHeight}px`;
  el.style.opacity = '1';

  let finished = false;
  const handleEnd = () => {
    if (!finished) {
      finished = true;
      el.removeEventListener('transitionend', handleEnd);
      done();
    }
  };
  el.addEventListener('transitionend', handleEnd);
  setTimeout(handleEnd, 300);
}

function onFadeLeave(el, done) {
  el.style.height = `${el.offsetHeight}px`;
  el.style.opacity = '1';
  el.style.overflow = 'hidden';
  void el.offsetHeight;

  el.style.transition =
    'height 0.2s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease-in';
  el.style.height = '0px';
  el.style.opacity = '0';

  let finished = false;
  const handleEnd = () => {
    if (!finished) {
      finished = true;
      el.removeEventListener('transitionend', handleEnd);
      done();
    }
  };
  el.addEventListener('transitionend', handleEnd);
  setTimeout(handleEnd, 250);
}
</script>
