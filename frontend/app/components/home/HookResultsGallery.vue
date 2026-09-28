<template>
  <div
    id="hooks-header"
    class="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full p-8 -mt-8"
  >
    <div class="flex flex-col mb-6">
      <div
        class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4"
      >
        <div class="flex flex-col gap-2 shrink-0">
          <h3
            class="text-xl font-bold text-white tracking-tight flex items-center gap-2"
          >
            <Icon name="ri:fire-fill" class="text-accent-500" />
            <span>Generated Hooks</span>
            <!-- HD Caching Badge -->
            <Transition name="scale-fade">
              <span
                v-if="!state.hdReady.value && state.downloadPercent.value < 100"
                class="inline-flex items-center gap-1.5 px-2 border border-accent-500/20 bg-accent-500/[0.05] rounded-none text-[9px] font-black uppercase tracking-wider text-accent-500 animate-pulse"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full bg-accent-500 animate-ping"
                ></span>
                Caching HD Source... {{ state.downloadPercent.value }}%
              </span>
              <span
                v-else-if="
                  state.hdReady.value || state.downloadPercent.value === 100
                "
                class="inline-flex items-center gap-1.5 px-2 border border-emerald-500/20 bg-emerald-500/[0.05] rounded-none text-[9px] font-black uppercase tracking-wider text-emerald-400"
              >
                <Icon name="ri:checkbox-circle-fill" class="text-[10px]" />
                HD Ready
              </span>
            </Transition>
          </h3>
          <p class="text-slate-400 text-xs">
            Select a hook to cut the segment and start editing.
          </p>
        </div>
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto"
        >
          <!-- Tab Switcher -->
          <div
            class="flex items-center bg-surface-dark border border-surface-border p-1 rounded-none shrink-0 h-9 select-none"
          >
            <button
              class="px-3 rounded-none transition-colors duration-150 cursor-pointer h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider focus:outline-none focus-visible:outline-none focus:ring-0"
              :class="
                activeTab === 'generated'
                  ? 'bg-surface-panel text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              "
              @click="activeTab = 'generated'"
            >
              All Hooks ({{ state.hooks.value.length }})
            </button>
            <button
              class="px-3 rounded-none transition-colors duration-150 cursor-pointer h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider focus:outline-none focus-visible:outline-none focus:ring-0"
              :class="
                activeTab === 'saved'
                  ? 'bg-surface-panel text-white shadow'
                  : 'text-slate-500 hover:text-slate-300'
              "
              @click="activeTab = 'saved'"
            >
              Saved Hooks ({{ state.savedHooks.value.length }})
            </button>
          </div>

          <!-- Back to Library Button -->
          <button
            class="h-9 px-4 bg-surface-dark border border-surface-border rounded-none cursor-pointer text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-accent-500 hover:border-accent-500 transition-colors duration-150 flex items-center justify-center gap-2 shadow-sm focus:outline-none focus-visible:outline-none focus:ring-0"
            @click="$emit('back-to-library')"
          >
            <Icon name="ri:arrow-left-line" class="text-sm" />
            <span>Back to Library</span>
          </button>
        </div>
      </div>
    </div>

    <Transition name="fade-layout" mode="out-in">
      <!-- Generated Hooks List -->
      <div
        v-if="activeTab === 'generated'"
        key="generated"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <div
          v-if="state.hooks.value.length === 0"
          class="col-span-full py-12 bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-none flex flex-col items-center justify-center text-center p-8"
        >
          <div
            class="w-12 h-12 bg-surface-dark border border-surface-border/50 flex items-center justify-center mb-4 text-slate-500 rounded-none"
          >
            <Icon name="ri:fire-line" class="text-2xl" />
          </div>
          <h4
            class="text-white font-bold text-xs mb-1 uppercase tracking-wider"
          >
            No Hooks Extracted
          </h4>
          <p
            class="text-slate-400 text-xs max-w-sm normal-case tracking-normal"
          >
            We couldn't extract any segments from this video. Try adjusting the
            prompt template or using another URL.
          </p>
        </div>
        <div
          v-for="(hook, idx) in state.hooks.value"
          :key="idx"
          class="bg-surface-panel border border-surface-border hover:border-accent-500/50 rounded-2xl cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col overflow-visible hover:z-30"
          @click="onHookCardClick(hook)"
          @mouseenter="hoveredHookIndex = Number(idx)"
          @mouseleave="hoveredHookIndex = null"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-accent-500/0 to-accent-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl z-0"
          ></div>

          <!-- Video Preview Area -->
          <div
            class="w-full aspect-video bg-black relative rounded-t-2xl shrink-0 border-b border-surface-border z-10"
          >
            <!-- Video / Media Canvas (Clipped Corners) -->
            <div
              class="absolute inset-0 overflow-hidden rounded-t-2xl"
              style="
                backface-visibility: hidden;
                transform: translate3d(0, 0, 0);
                -webkit-backface-visibility: hidden;
                -webkit-transform: translate3d(0, 0, 0);
              "
            >
              <Icon
                name="ri:film-line"
                class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity"
              />
              <img
                v-if="hook.thumbnail_url"
                :src="API_BASE + hook.thumbnail_url"
                class="absolute inset-0 w-full h-full object-cover z-10 select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                alt="Hook thumbnail"
              />
              <video
                v-else-if="cardPreviewVideoUrl"
                :src="
                  cardPreviewVideoUrl +
                  '#t=' +
                  Math.max(0, hook.start - state.startSafetyBuffer.value)
                "
                muted
                preload="metadata"
                class="absolute inset-0 w-full h-full object-cover z-10 focus:outline-none select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                style="
                  backface-visibility: hidden;
                  transform: translate3d(0, 0, 0);
                  -webkit-backface-visibility: hidden;
                  -webkit-transform: translate3d(0, 0, 0);
                "
                @mouseenter="
                  e => {
                    const p = (e.target as HTMLVideoElement).play();
                    if (p !== undefined) p.catch(() => {});
                  }
                "
                @mouseleave="
                  e => {
                    (e.target as HTMLVideoElement).pause();
                    (e.target as HTMLVideoElement).currentTime = Math.max(
                      0,
                      hook.start - state.startSafetyBuffer.value
                    );
                  }
                "
                @timeupdate="
                  e => {
                    if (
                      selectedModalHook === null &&
                      (e.target as HTMLVideoElement).currentTime >= hook.end
                    )
                      (e.target as HTMLVideoElement).currentTime = Math.max(
                        0,
                        hook.start - state.startSafetyBuffer.value
                      );
                  }
                "
              ></video>

              <!-- Centered Play Icon Overlay on Hover -->
              <div
                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none"
              >
                <div
                  class="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-accent-500 shadow-2xl scale-90 group-hover:scale-100 transition-transform"
                >
                  <Icon
                    name="ri:play-circle-fill"
                    class="text-3xl text-accent-500"
                  />
                </div>
              </div>
            </div>

            <!-- Floating Media Badge Overlay: Top-Left (Unified Hook Score Pill) -->
            <div
              class="absolute top-2.5 left-2.5 z-40 flex items-center gap-1.5 pointer-events-auto"
            >
              <div
                class="flex items-center bg-black border border-white/10 rounded-lg p-0.5 shadow-lg select-none"
              >
                <span
                  class="px-2 py-0.5 text-[9px] font-mono font-black tracking-widest text-accent-500"
                >
                  HOOK {{ String(Number(idx) + 1).padStart(2, '0') }}
                </span>

                <!-- Virality Score Sub-Pill -->
                <div
                  v-if="hook.virality_score !== undefined"
                  class="relative group/viral flex items-center"
                >
                  <div
                    class="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider flex items-center gap-1 cursor-help transition-all"
                    :class="{
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]':
                        hook.virality_score >= 90,
                      'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]':
                        hook.virality_score >= 75 && hook.virality_score < 90,
                      'bg-slate-700/50 text-slate-300 border border-slate-600/40':
                        hook.virality_score < 75
                    }"
                  >
                    <Icon
                      :name="
                        hook.virality_score >= 90
                          ? 'ri:fire-fill'
                          : hook.virality_score >= 75
                            ? 'ri:flashlight-fill'
                            : 'ri:bar-chart-2-fill'
                      "
                      class="text-[10px]"
                    />
                    <span>{{ hook.virality_score }}</span>
                  </div>

                  <!-- Tooltip with Virality Explanation (Opens downward into video canvas) -->
                  <div
                    v-if="hook.virality_reason"
                    class="absolute top-full left-0 mt-2 w-72 bg-[#171a21] border border-surface-border text-[11px] text-slate-200 p-3.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 pointer-events-none group-hover/viral:opacity-100 group-hover/viral:pointer-events-auto transition-all duration-200 -translate-y-1 group-hover/viral:translate-y-0 z-50 font-medium normal-case tracking-normal text-left"
                  >
                    <div
                      class="absolute bottom-full left-4 -mb-[1px] border-4 border-transparent border-b-[#171a21]"
                    ></div>
                    <div
                      class="text-[10px] font-bold text-accent-500 uppercase tracking-widest mb-1 flex items-center gap-1"
                    >
                      <Icon name="ri:sparkling-fill" class="text-xs" />
                      Virality Breakdown ({{ hook.virality_score }}/100)
                    </div>
                    <div class="text-slate-300 leading-snug">
                      {{ hook.virality_reason }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating Media Badge Overlay: Top-Right (Ready Indicator & Bookmark Action) -->
            <div
              class="absolute top-2.5 right-2.5 z-40 flex items-center gap-2 pointer-events-auto"
            >
              <!-- Ambient Ready Indicator -->
              <div
                v-if="isHookRendered(hook)"
                class="relative group/tooltip flex items-center"
              >
                <div
                  class="px-2 py-1 bg-black border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-help shadow-lg"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  ></span>
                  <span>Ready</span>
                </div>
                <!-- Custom Tooltip (Opens downward) -->
                <div
                  class="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-emerald-500/30 text-[10px] text-slate-200 p-2.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all -translate-y-1 group-hover/tooltip:translate-y-0 z-50 font-medium normal-case tracking-normal text-center"
                >
                  <div
                    class="absolute bottom-full right-4 -mb-[1px] border-4 border-transparent border-b-slate-900"
                  ></div>
                  This clip has already been cut and transcribed, ready for
                  editing!
                </div>
              </div>

              <!-- Glassmorphic Bookmark Toggle Button -->
              <button
                aria-label="Bookmark Hook"
                class="w-7 h-7 rounded-lg bg-black border border-white/10 hover:border-amber-400/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                :class="
                  isHookSaved(hook)
                    ? 'text-amber-400 border-amber-400/30'
                    : 'text-slate-400 hover:text-amber-300'
                "
                @click.stop="toggleSaveHook(hook)"
              >
                <Icon
                  :name="
                    isHookSaved(hook) ? 'ri:bookmark-fill' : 'ri:bookmark-line'
                  "
                  class="text-sm"
                />
              </button>
            </div>

            <!-- Floating Media Badge Overlay: Bottom-Right Duration -->
            <div
              class="absolute bottom-2.5 right-2.5 bg-black px-2 py-0.5 rounded-md text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10 shadow-lg"
            >
              {{ formatHookDuration(hook.start, hook.end) }}
            </div>
          </div>
          <!-- Streamlined Editorial Card Body -->
          <div class="p-4 flex-1 flex flex-col relative z-10">
            <h4
              class="text-white font-bold mb-2 text-base leading-snug group-hover:text-accent-500 transition-colors line-clamp-2 min-h-[2.75rem] cursor-text select-text"
            >
              {{ hook.theme || 'Untitled Hook' }}
            </h4>

            <div class="py-0.5 my-1 transition-colors flex-1">
              <p
                class="text-slate-400 text-xs line-clamp-2 italic leading-relaxed cursor-text select-text"
              >
                "{{
                  hook.transcript_quote ||
                  'No transcript quote available for this hook.'
                }}"
              </p>
            </div>

            <div
              class="mt-3 pt-3 border-t border-surface-border/40 flex items-center justify-between text-[11px]"
            >
              <span
                class="text-slate-400 font-mono font-semibold text-[11px] flex items-center gap-1.5"
              >
                <Icon name="ri:time-line" class="text-xs text-slate-500" />
                {{ state.formatDuration(hook.start) }}
                <span class="text-slate-600">→</span>
                {{ state.formatDuration(hook.end) }}
              </span>

              <div
                class="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-accent-500 transition-colors flex items-center gap-1"
              >
                <span>Preview Segment</span>
                <Icon
                  name="ri:arrow-right-line"
                  class="text-xs group-hover:translate-x-0.5 transition-transform"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Saved Hooks List -->
      <div
        v-else-if="activeTab === 'saved'"
        key="saved"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <div
          v-if="state.savedHooks.value.length === 0"
          class="col-span-full py-12 bg-surface-panel/30 border border-surface-border/50 border-dashed rounded-2xl flex flex-col items-center justify-center text-center p-8"
        >
          <div
            class="w-12 h-12 bg-surface-dark border border-surface-border/50 flex items-center justify-center mb-4 text-slate-500 rounded-xl"
          >
            <Icon name="ri:bookmark-line" class="text-2xl text-amber-400/60" />
          </div>
          <h4
            class="text-white font-bold text-xs mb-1 uppercase tracking-wider"
          >
            No Saved Hooks Yet
          </h4>
          <p
            class="text-slate-400 text-xs max-w-sm normal-case tracking-normal"
          >
            Click the bookmark icon on any generated hook to save it here for
            editing later.
          </p>
        </div>
        <div
          v-for="(hook, idx) in state.savedHooks.value"
          v-else
          :key="hook._id || idx"
          class="bg-surface-panel border border-surface-border hover:border-amber-400/50 rounded-2xl cursor-pointer group transition-all hover:bg-surface-card relative shadow-xl flex flex-col overflow-visible hover:z-30"
          @click="onHookCardClick(hook)"
          @mouseenter="hoveredHookIndex = Number(idx) + 1000"
          @mouseleave="hoveredHookIndex = null"
        >
          <div
            class="absolute inset-0 bg-gradient-to-br from-amber-400/0 to-amber-400/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl z-0"
          ></div>

          <!-- Video Preview Area -->
          <div
            class="w-full aspect-video bg-black relative rounded-t-2xl shrink-0 border-b border-surface-border z-10"
          >
            <!-- Video / Media Canvas (Clipped Corners) -->
            <div
              class="absolute inset-0 overflow-hidden rounded-t-2xl"
              style="
                backface-visibility: hidden;
                transform: translate3d(0, 0, 0);
                -webkit-backface-visibility: hidden;
                -webkit-transform: translate3d(0, 0, 0);
              "
            >
              <Icon
                name="ri:film-line"
                class="absolute inset-0 m-auto text-slate-700 text-3xl opacity-50 group-hover:opacity-20 transition-opacity"
              />
              <img
                v-if="hook.thumbnail_url"
                :src="API_BASE + hook.thumbnail_url"
                class="absolute inset-0 w-full h-full object-cover z-10 select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                alt="Hook thumbnail"
              />
              <video
                v-else-if="cardPreviewVideoUrl"
                :src="
                  cardPreviewVideoUrl +
                  '#t=' +
                  Math.max(0, hook.start - state.startSafetyBuffer.value)
                "
                muted
                preload="metadata"
                class="absolute inset-0 w-full h-full object-cover z-10 focus:outline-none select-none pointer-events-none transition-transform duration-500 group-hover:scale-105"
                style="
                  backface-visibility: hidden;
                  transform: translate3d(0, 0, 0);
                  -webkit-backface-visibility: hidden;
                  -webkit-transform: translate3d(0, 0, 0);
                "
                @mouseenter="
                  e => {
                    const p = (e.target as HTMLVideoElement).play();
                    if (p !== undefined) p.catch(() => {});
                  }
                "
                @mouseleave="
                  e => {
                    (e.target as HTMLVideoElement).pause();
                    (e.target as HTMLVideoElement).currentTime = Math.max(
                      0,
                      hook.start - state.startSafetyBuffer.value
                    );
                  }
                "
                @timeupdate="
                  e => {
                    if (
                      selectedModalHook === null &&
                      (e.target as HTMLVideoElement).currentTime >= hook.end
                    )
                      (e.target as HTMLVideoElement).currentTime = Math.max(
                        0,
                        hook.start - state.startSafetyBuffer.value
                      );
                  }
                "
              ></video>

              <!-- Centered Play Icon Overlay on Hover -->
              <div
                class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none"
              >
                <div
                  class="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-400 shadow-2xl scale-90 group-hover:scale-100 transition-transform"
                >
                  <Icon
                    name="ri:play-circle-fill"
                    class="text-3xl text-amber-400"
                  />
                </div>
              </div>
            </div>

            <!-- Floating Media Badge Overlay: Top-Left (Unified Hook Score Pill - Saved) -->
            <div
              class="absolute top-2.5 left-2.5 z-40 flex items-center gap-1.5 pointer-events-auto"
            >
              <div
                class="flex items-center bg-black border border-amber-500/30 rounded-lg p-0.5 shadow-lg select-none"
              >
                <span
                  class="px-2 py-0.5 text-[9px] font-mono font-black tracking-widest text-amber-400"
                >
                  SAVED {{ String(Number(idx) + 1).padStart(2, '0') }}
                </span>

                <!-- Virality Score Sub-Pill -->
                <div
                  v-if="hook.virality_score !== undefined"
                  class="relative group/viral flex items-center"
                >
                  <div
                    class="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider flex items-center gap-1 cursor-help transition-all"
                    :class="{
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]':
                        hook.virality_score >= 90,
                      'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.2)]':
                        hook.virality_score >= 75 && hook.virality_score < 90,
                      'bg-slate-700/50 text-slate-300 border border-slate-600/40':
                        hook.virality_score < 75
                    }"
                  >
                    <Icon
                      :name="
                        hook.virality_score >= 90
                          ? 'ri:fire-fill'
                          : hook.virality_score >= 75
                            ? 'ri:flashlight-fill'
                            : 'ri:bar-chart-2-fill'
                      "
                      class="text-[10px]"
                    />
                    <span>{{ hook.virality_score }}</span>
                  </div>

                  <!-- Tooltip with Virality Explanation (Opens downward into video canvas) -->
                  <div
                    v-if="hook.virality_reason"
                    class="absolute top-full left-0 mt-2 w-72 bg-[#171a21] border border-surface-border text-[11px] text-slate-200 p-3.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 pointer-events-none group-hover/viral:opacity-100 group-hover/viral:pointer-events-auto transition-all duration-200 -translate-y-1 group-hover/viral:translate-y-0 z-50 font-medium normal-case tracking-normal text-left"
                  >
                    <div
                      class="absolute bottom-full left-4 -mb-[1px] border-4 border-transparent border-b-[#171a21]"
                    ></div>
                    <div
                      class="text-[10px] font-bold text-accent-500 uppercase tracking-widest mb-1 flex items-center gap-1"
                    >
                      <Icon name="ri:sparkling-fill" class="text-xs" />
                      Virality Breakdown ({{ hook.virality_score }}/100)
                    </div>
                    <div class="text-slate-300 leading-snug">
                      {{ hook.virality_reason }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Floating Media Badge Overlay: Top-Right (Ready Indicator & Active Bookmark) -->
            <div
              class="absolute top-2.5 right-2.5 z-40 flex items-center gap-2 pointer-events-auto"
            >
              <!-- Ambient Ready Indicator -->
              <div
                v-if="isHookRendered(hook)"
                class="relative group/tooltip flex items-center"
              >
                <div
                  class="px-2 py-1 bg-black border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-help shadow-lg"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                  ></span>
                  <span>Ready</span>
                </div>
                <!-- Custom Tooltip (Opens downward) -->
                <div
                  class="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-emerald-500/30 text-[10px] text-slate-200 p-2.5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto transition-all -translate-y-1 group-hover/tooltip:translate-y-0 z-50 font-medium normal-case tracking-normal text-center"
                >
                  <div
                    class="absolute bottom-full right-4 -mb-[1px] border-4 border-transparent border-b-slate-900"
                  ></div>
                  This clip has already been cut and transcribed, ready for
                  editing!
                </div>
              </div>

              <!-- Glassmorphic Active Bookmark Button -->
              <button
                aria-label="Bookmark Hook"
                class="w-7 h-7 rounded-lg bg-black border border-amber-400/40 text-amber-400 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg cursor-pointer"
                @click.stop="toggleSaveHook(hook)"
              >
                <Icon name="ri:bookmark-fill" class="text-sm" />
              </button>
            </div>

            <!-- Floating Media Badge Overlay: Bottom-Right Duration -->
            <div
              class="absolute bottom-2.5 right-2.5 bg-black px-2 py-0.5 rounded-md text-[10px] text-white font-mono font-bold tracking-widest backdrop-blur-md z-20 border border-white/10 shadow-lg"
            >
              {{ formatHookDuration(hook.start, hook.end) }}
            </div>
          </div>
          <!-- Streamlined Editorial Card Body -->
          <div class="p-4 flex-1 flex flex-col relative z-10">
            <h4
              class="text-white font-bold mb-2 text-base leading-snug group-hover:text-amber-400 transition-colors line-clamp-2 min-h-[2.75rem] cursor-text select-text"
            >
              {{ hook.theme || 'Untitled Hook' }}
            </h4>

            <div class="py-0.5 my-1 transition-colors flex-1">
              <p
                class="text-slate-400 text-xs line-clamp-2 italic leading-relaxed cursor-text select-text"
              >
                "{{
                  hook.transcript_quote ||
                  'No transcript quote available for this hook.'
                }}"
              </p>
            </div>

            <div
              class="mt-3 pt-3 border-t border-surface-border/40 flex items-center justify-between text-[11px]"
            >
              <span
                class="text-slate-400 font-mono font-semibold text-[11px] flex items-center gap-1.5"
              >
                <Icon name="ri:time-line" class="text-xs text-slate-500" />
                {{ state.formatDuration(hook.start) }}
                <span class="text-slate-600">→</span>
                {{ state.formatDuration(hook.end) }}
              </span>

              <div
                class="text-[10px] font-black uppercase tracking-widest text-amber-400/60 group-hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <span>Preview Segment</span>
                <Icon
                  name="ri:arrow-right-line"
                  class="text-xs group-hover:translate-x-0.5 transition-transform"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Cinematic Modal Overlay -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-98"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-98"
    >
      <div
        v-if="selectedModalHook"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/90 backdrop-blur-xl"
          @click="selectedModalHook = null"
        ></div>

        <!-- Modal Content -->
        <div
          class="relative w-full max-w-5xl bg-surface-dark border border-surface-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        >
          <div class="absolute top-4 right-4 z-50">
            <button
              class="w-10 h-10 bg-black/50 hover:bg-black text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all border border-white/10 hover:border-white/30 cursor-pointer"
              @click="selectedModalHook = null"
            >
              <Icon name="ri:close-line" class="text-xl" />
            </button>
          </div>
          <div class="flex flex-col md:flex-row h-full overflow-hidden">
            <!-- Video Player (50/50) -->
            <div
              class="md:w-1/2 bg-black relative aspect-video md:aspect-auto flex-shrink-0 flex items-center justify-center"
            >
              <video
                v-if="modalVideoUrl && !hasVideoError"
                ref="modalVideoPlayer"
                :src="modalVideoUrl"
                controls
                autoplay
                class="w-full h-full object-contain max-h-[70vh]"
                @timeupdate="onModalTimeUpdate"
                @loadedmetadata="onModalLoadedMetadata"
                @volumechange="onVolumeChange"
                @error="onVideoError"
              ></video>
              <div
                v-if="state.hasPreview.value && modalVideoUrl && !hasVideoError"
                class="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-0.5 flex items-center gap-1 select-none group/resolution"
              >
                <Icon
                  name="ri:speed-line"
                  class="text-[11px] text-slate-400 ml-1.5 mr-0.5"
                />

                <!-- SD Toggle Button -->
                <button
                  class="px-2 py-1 text-[9px] font-black tracking-widest rounded transition-all cursor-pointer"
                  :class="
                    !forceHighRes
                      ? 'bg-accent-500 text-black shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  "
                  @click="toggleResolution(false)"
                >
                  SD
                </button>

                <!-- HD Toggle Button -->
                <button
                  class="px-2 py-1 text-[9px] font-black tracking-widest rounded transition-all mr-0.5"
                  :class="[
                    state.hdReady.value
                      ? forceHighRes
                        ? 'bg-accent-500 text-black shadow-md cursor-pointer'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer'
                      : 'text-slate-500 cursor-not-allowed opacity-60'
                  ]"
                  @click="state.hdReady.value && toggleResolution(true)"
                >
                  <span v-if="state.hdReady.value">HD</span>
                  <span v-else-if="state.downloadPercent.value > 0"
                    >HD ({{ state.downloadPercent.value }}%)</span
                  >
                  <span v-else>HD (QUEUED)</span>
                </button>

                <!-- Custom Tooltip on Hover -->
                <div
                  class="absolute top-full left-0 mt-2 w-64 bg-[#171a21] border border-surface-border text-[10px] text-slate-300 p-3 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover/resolution:opacity-100 group-hover/resolution:pointer-events-auto transition-all -translate-y-1 group-hover/resolution:translate-y-0 z-30 font-medium normal-case tracking-normal"
                >
                  <h5
                    class="text-accent-500 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1"
                  >
                    <Icon name="ri:information-line" class="text-xs" />
                    Preview Quality
                  </h5>
                  <p v-if="state.hdReady.value" class="leading-relaxed">
                    This toggle applies to the preview only. The timeline editor
                    always uses the original high-definition (HD) version.
                  </p>
                  <p v-else class="leading-relaxed">
                    The high-definition (HD) version is downloading in the
                    background. You can preview the optimized SD version in the
                    meantime.
                  </p>
                  <div
                    class="absolute bottom-full left-4 -mb-[5px] border-4 border-transparent border-b-[#171a21]/95"
                  ></div>
                </div>
              </div>
              <div
                v-else-if="!modalVideoUrl || hasVideoError"
                class="w-full h-full flex flex-col items-center justify-center text-slate-500"
              >
                <Icon name="ri:film-line" class="text-4xl mb-2 opacity-50" />
                <p class="text-sm font-medium">Video source unavailable</p>
              </div>
            </div>

            <!-- Sidebar Info (50/50) -->
            <div
              class="md:w-1/2 p-6 md:p-8 flex flex-col border-t md:border-t-0 md:border-l border-surface-border bg-surface-panel/50 overflow-y-auto custom-scrollbar select-text relative"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-4">
                  <!-- Virality Score Pill in Modal -->
                  <div
                    v-if="selectedModalHook.virality_score !== undefined"
                    class="px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider flex items-center gap-1.5 shadow-sm"
                    :class="{
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40':
                        selectedModalHook.virality_score >= 90,
                      'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40':
                        selectedModalHook.virality_score >= 75 &&
                        selectedModalHook.virality_score < 90,
                      'bg-slate-700/40 text-slate-300 border border-slate-600/40':
                        selectedModalHook.virality_score < 75
                    }"
                  >
                    <Icon
                      :name="
                        selectedModalHook.virality_score >= 90
                          ? 'ri:fire-fill'
                          : selectedModalHook.virality_score >= 75
                            ? 'ri:flashlight-fill'
                            : 'ri:bar-chart-2-fill'
                      "
                      class="text-sm"
                    />
                    <span
                      >VIRAL SCORE:
                      {{ selectedModalHook.virality_score }}/100</span
                    >
                  </div>

                  <button
                    class="text-slate-400 hover:text-amber-400 transition-colors ml-auto cursor-pointer"
                    @click.stop="toggleSaveHook(selectedModalHook)"
                  >
                    <Icon
                      :name="
                        isHookSaved(selectedModalHook)
                          ? 'ri:bookmark-fill'
                          : 'ri:bookmark-line'
                      "
                      class="text-xl"
                      :class="{
                        'text-amber-400': isHookSaved(selectedModalHook)
                      }"
                    />
                  </button>
                </div>

                <h3
                  class="text-xl md:text-2xl font-bold text-white mb-3 leading-tight"
                >
                  {{ selectedModalHook.theme || 'Untitled Hook' }}
                </h3>

                <div class="flex flex-wrap items-center gap-2 mb-4">
                  <div
                    class="flex items-center gap-2 bg-surface-dark border border-surface-border/50 px-3 py-2 rounded-lg w-max"
                  >
                    <Icon name="ri:time-line" class="text-slate-400" />
                    <span class="text-slate-300 font-mono text-xs"
                      >{{
                        state.formatDuration(
                          Math.max(
                            0,
                            selectedModalHook.start -
                              state.startSafetyBuffer.value
                          )
                        )
                      }}
                      - {{ state.formatDuration(selectedModalHook.end) }}</span
                    >
                    <span class="text-accent-500 font-bold ml-1 text-xs">{{
                      formatHookDuration(
                        Math.max(
                          0,
                          selectedModalHook.start -
                            state.startSafetyBuffer.value
                        ),
                        selectedModalHook.end
                      )
                    }}</span>
                  </div>

                  <button
                    ref="timingTriggerBtnRef"
                    class="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-dark hover:bg-surface-panel border border-surface-border hover:border-accent-500/50 text-slate-300 hover:text-accent-500 text-xs font-bold transition-all cursor-pointer select-none"
                    :class="{
                      'border-accent-500/50 text-accent-500 bg-surface-panel':
                        showAdjustDuration
                    }"
                    @click="showAdjustDuration = !showAdjustDuration"
                  >
                    <Icon name="ri:settings-4-line" />
                    Adjust Start - End
                    <Icon
                      name="ri:arrow-down-s-line"
                      class="text-xs transition-transform duration-200"
                      :class="{ 'rotate-180': showAdjustDuration }"
                    />
                  </button>
                </div>

                <!-- Floating Timing Adjustment Panel Overlay -->
                <Transition
                  enter-active-class="transition duration-150 ease-out"
                  enter-from-class="transform -translate-y-2 opacity-0 scale-95"
                  enter-to-class="transform translate-y-0 opacity-100 scale-100"
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="transform translate-y-0 opacity-100 scale-100"
                  leave-to-class="transform -translate-y-2 opacity-0 scale-95"
                >
                  <div
                    v-if="showAdjustDuration"
                    ref="timingPanelRef"
                    class="absolute left-6 right-6 md:left-8 md:right-8 top-[148px] z-40 bg-[#141822] backdrop-blur-2xl border border-surface-border rounded-2xl p-4 md:p-5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] space-y-4"
                  >
                    <div class="flex items-center justify-between">
                      <span
                        class="text-[10px] font-black tracking-widest text-slate-400 uppercase"
                        >Adjust Clip Timing</span
                      >
                      <button
                        v-if="
                          selectedModalHook &&
                          (selectedModalHook.start !==
                            selectedModalHook.originalStart ||
                            selectedModalHook.end !==
                              selectedModalHook.originalEnd)
                        "
                        class="text-[9px] text-accent-500 hover:text-accent-400 font-bold uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer"
                        @click="resetToDefaultDuration"
                      >
                        <Icon name="ri:restart-line" />
                        Reset to Default
                      </button>
                      <span v-else class="text-[9px] text-slate-500 font-mono"
                        >Total Video:
                        {{
                          state.formatDuration(state.videoDuration.value || 0)
                        }}</span
                      >
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1"
                          >Start Time</label
                        >
                        <div class="relative flex items-center">
                          <input
                            v-model="startInputStr"
                            type="text"
                            placeholder="mm:ss"
                            class="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                            @change="onTimeInputChange('start')"
                            @keydown.up.prevent="onTimeInputStep('start', 1)"
                            @keydown.down.prevent="onTimeInputStep('start', -1)"
                          />
                          <span
                            class="absolute right-3 text-[10px] text-slate-500 font-bold"
                            >mm:ss</span
                          >
                        </div>
                        <span
                          class="text-[10px] text-slate-500 block mt-1 font-mono"
                          >{{
                            Math.max(
                              0,
                              selectedModalHook.start -
                                state.startSafetyBuffer.value
                            ).toFixed(1)
                          }}s</span
                        >
                      </div>
                      <div>
                        <label
                          class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1"
                          >End Time</label
                        >
                        <div class="relative flex items-center">
                          <input
                            v-model="endInputStr"
                            type="text"
                            placeholder="mm:ss"
                            class="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-accent-500 focus:outline-none focus:border-accent-500"
                            @change="onTimeInputChange('end')"
                            @keydown.up.prevent="onTimeInputStep('end', 1)"
                            @keydown.down.prevent="onTimeInputStep('end', -1)"
                          />
                          <span
                            class="absolute right-3 text-[10px] text-slate-500 font-bold"
                            >mm:ss</span
                          >
                        </div>
                        <span
                          class="text-[10px] text-slate-500 block mt-1 font-mono"
                          >{{ selectedModalHook.end.toFixed(1) }}s</span
                        >
                      </div>
                    </div>

                    <!-- Two-Tier Hook Timing Slider -->
                    <div class="space-y-3 pt-1">
                      <!-- Tier 1: Macro Source Video Overview -->
                      <div class="space-y-1">
                        <div
                          class="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider"
                        >
                          <span
                            class="flex items-center gap-1.5 text-slate-400"
                          >
                            <Icon
                              name="ri:film-line"
                              class="text-xs text-accent-500"
                            />
                            Full Video Overview
                          </span>
                          <span class="font-mono text-slate-500">
                            {{ state.formatDuration(0) }} /
                            {{
                              state.formatDuration(
                                state.videoDuration.value || 0
                              )
                            }}
                          </span>
                        </div>
                        <div
                          class="relative w-full h-3 px-1.5 flex items-center select-none bg-black/50 border border-white/5 rounded-lg overflow-hidden"
                        >
                          <!-- Full Track -->
                          <div
                            class="relative w-full h-1 bg-surface-dark border border-surface-border/40 rounded-full overflow-hidden"
                          >
                            <!-- Macro Active Hook Range -->
                            <div
                              class="absolute h-full bg-accent-500 rounded-full"
                              :style="{
                                left:
                                  (Math.max(
                                    0,
                                    selectedModalHook.start -
                                      state.startSafetyBuffer.value
                                  ) /
                                    (state.videoDuration.value || 100)) *
                                    100 +
                                  '%',
                                width:
                                  Math.max(
                                    0.5,
                                    ((selectedModalHook.end -
                                      Math.max(
                                        0,
                                        selectedModalHook.start -
                                          state.startSafetyBuffer.value
                                      )) /
                                      (state.videoDuration.value || 100)) *
                                      100
                                  ) + '%'
                              }"
                            ></div>
                          </div>
                          <!-- Zoom Window Viewport Bracket -->
                          <div
                            class="absolute top-0 bottom-0 border-x-2 border-accent-500/60 bg-accent-500/10 pointer-events-none transition-all duration-75"
                            :style="{
                              left:
                                (microWindowStart /
                                  (state.videoDuration.value || 100)) *
                                  100 +
                                '%',
                              width:
                                Math.max(
                                  1,
                                  ((microWindowEnd - microWindowStart) /
                                    (state.videoDuration.value || 100)) *
                                    100
                                ) + '%'
                            }"
                          ></div>
                        </div>
                      </div>

                      <!-- Tier 2: Micro Context Timeline (Zoomed Boundary Adjustment) -->
                      <div class="space-y-1.5">
                        <div
                          class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider"
                        >
                          <span
                            class="flex items-center gap-1.5 text-slate-300"
                          >
                            <Icon
                              name="ri:scissors-cut-line"
                              class="text-xs text-accent-500"
                            />
                            Adjust Hook Boundaries
                          </span>
                          <span
                            class="text-[9px] font-mono text-accent-400 font-bold bg-accent-500/10 border border-accent-500/20 px-1.5 py-0.5 rounded"
                          >
                            Zoomed Window
                          </span>
                        </div>

                        <div
                          class="relative w-full h-10 px-2.5 flex items-center select-none bg-black/60 border border-surface-border/80 rounded-xl"
                        >
                          <div
                            ref="modalHookSliderRef"
                            id="modal-hook-slider"
                            class="relative w-full h-full flex items-center cursor-pointer"
                            @mousedown="onSliderClick"
                            @touchstart="onSliderClick"
                          >
                            <!-- Slider Track -->
                            <div
                              class="absolute left-0 right-0 h-2 bg-surface-dark border border-surface-border/60 rounded-full"
                            ></div>

                            <!-- Highlighted Active range -->
                            <div
                              class="absolute h-2 bg-accent-500 rounded-full shadow-[0_0_12px_rgba(207,255,80,0.3)]"
                              :style="{
                                left:
                                  ((Math.max(
                                    0,
                                    selectedModalHook.start -
                                      state.startSafetyBuffer.value
                                  ) -
                                    microWindowStart) /
                                    microDuration) *
                                    100 +
                                  '%',
                                width:
                                  ((selectedModalHook.end -
                                    Math.max(
                                      0,
                                      selectedModalHook.start -
                                        state.startSafetyBuffer.value
                                    )) /
                                    microDuration) *
                                    100 +
                                  '%'
                              }"
                            ></div>

                            <!-- Start Handle -->
                            <div
                              class="absolute w-5 h-5 rounded-full bg-accent-500 border-2 border-white cursor-ew-resize -translate-x-1/2 flex items-center justify-center shadow-lg hover:scale-125 active:scale-125 transition-transform z-10"
                              :style="{
                                left:
                                  ((Math.max(
                                    0,
                                    selectedModalHook.start -
                                      state.startSafetyBuffer.value
                                  ) -
                                    microWindowStart) /
                                    microDuration) *
                                    100 +
                                  '%'
                              }"
                              @mousedown.stop="startDrag('start')"
                              @touchstart.stop="startDrag('start')"
                            >
                              <div
                                class="w-1.5 h-1.5 bg-black rounded-full"
                              ></div>
                            </div>

                            <!-- End Handle -->
                            <div
                              class="absolute w-5 h-5 rounded-full bg-accent-500 border-2 border-white cursor-ew-resize -translate-x-1/2 flex items-center justify-center shadow-lg hover:scale-125 active:scale-125 transition-transform z-10"
                              :style="{
                                left:
                                  ((selectedModalHook.end - microWindowStart) /
                                    microDuration) *
                                    100 +
                                  '%'
                              }"
                              @mousedown.stop="startDrag('end')"
                              @touchstart.stop="startDrag('end')"
                            >
                              <div
                                class="w-1.5 h-1.5 bg-black rounded-full"
                              ></div>
                            </div>
                          </div>
                        </div>

                        <!-- Time markers for micro window -->
                        <div
                          class="flex items-center justify-between text-[9px] text-slate-500 font-mono px-1"
                        >
                          <span>{{ formatMMSS(microWindowStart) }}</span>
                          <span class="text-slate-400 font-bold">
                            Clip Duration:
                            {{
                              formatMMSS(
                                Math.max(
                                  0,
                                  selectedModalHook.end -
                                    Math.max(
                                      0,
                                      selectedModalHook.start -
                                        state.startSafetyBuffer.value
                                    )
                                )
                              )
                            }}
                          </span>
                          <span>{{ formatMMSS(microWindowEnd) }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex justify-end pt-1">
                      <button
                        class="px-3 py-1.5 bg-accent-500 text-black text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-accent-400 transition-colors cursor-pointer"
                        @click="showAdjustDuration = false"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </Transition>

                <!-- Tabbed Switcher (Virality Breakdown [Tab 1 Default] vs Transcript Quote [Tab 2]) -->
                <div
                  class="flex items-center p-1 bg-surface-dark/90 border border-surface-border/60 rounded-xl mb-4 select-none"
                >
                  <button
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                    :class="
                      activeModalTab === 'breakdown'
                        ? 'bg-surface-panel text-accent-500 shadow-sm border border-surface-border'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    "
                    @click="
                      e => {
                        activeModalTab = 'breakdown';
                        (e.currentTarget as HTMLElement)?.blur();
                      }
                    "
                  >
                    <Icon name="ri:sparkling-fill" class="text-xs" />
                    <span>Virality Breakdown</span>
                  </button>
                  <button
                    class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                    :class="
                      activeModalTab === 'transcript'
                        ? 'bg-surface-panel text-accent-500 shadow-sm border border-surface-border'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    "
                    @click="
                      e => {
                        activeModalTab = 'transcript';
                        (e.currentTarget as HTMLElement)?.blur();
                      }
                    "
                  >
                    <Icon name="ri:chat-quote-line" class="text-xs" />
                    <span>Transcript Quote</span>
                  </button>
                </div>

                <!-- Tab 1: Virality Breakdown (Default) -->
                <div
                  v-if="activeModalTab === 'breakdown'"
                  class="animate-in fade-in duration-200"
                >
                  <div
                    v-if="selectedModalHook.virality_reason"
                    class="h-[210px] p-5 bg-black/40 border border-surface-border/80 rounded-xl text-left shadow-lg relative overflow-hidden group flex flex-col"
                  >
                    <div
                      class="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none"
                    >
                      <Icon
                        name="ri:sparkling-fill"
                        class="text-9xl text-accent-500"
                      />
                    </div>
                    <div
                      class="text-[10px] font-black text-accent-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 shrink-0"
                    >
                      <Icon name="ri:sparkling-fill" class="text-xs" />
                      Virality Analysis
                    </div>
                    <div
                      class="flex-1 overflow-y-auto custom-scrollbar relative z-10 pr-1"
                    >
                      <p
                        class="text-xs md:text-sm text-slate-200 leading-relaxed font-normal"
                      >
                        {{ selectedModalHook.virality_reason }}
                      </p>
                    </div>
                  </div>
                  <div
                    v-else
                    class="h-[210px] p-6 bg-black/20 border border-surface-border rounded-xl flex items-center justify-center text-center text-slate-500 text-xs"
                  >
                    No virality breakdown available for this hook.
                  </div>
                </div>

                <!-- Tab 2: Transcript Quote -->
                <div
                  v-else-if="activeModalTab === 'transcript'"
                  class="animate-in fade-in duration-200"
                >
                  <div
                    class="h-[210px] p-5 bg-black/40 border border-surface-border/80 rounded-xl relative group overflow-hidden text-left flex flex-col"
                  >
                    <Icon
                      name="ri:quote-text"
                      class="absolute -top-2 -right-2 text-6xl text-surface-border opacity-20 group-hover:text-accent-500/10 transition-colors pointer-events-none"
                    />
                    <div
                      class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 shrink-0"
                    >
                      <Icon name="ri:mic-line" class="text-xs text-slate-400" />
                      Spoken Dialog
                    </div>
                    <div
                      class="flex-1 overflow-y-auto custom-scrollbar relative z-10 pr-1"
                    >
                      <p
                        class="text-slate-200 text-sm italic leading-relaxed font-serif"
                      >
                        "{{
                          selectedModalHook.transcript_quote ||
                          'No transcript quote available for this hook.'
                        }}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-8 pt-6 border-t border-surface-border/50">
                <button
                  class="w-full py-4 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(207,255,80,0.2)] hover:shadow-[0_0_30px_rgba(207,255,80,0.4)] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  @click="
                    () => {
                      if (selectedModalHook) {
                        $emit('select-hook', selectedModalHook);
                        selectedModalHook = null;
                      }
                    }
                  "
                >
                  <Icon name="ri:scissors-cut-fill" class="text-xl" />
                  Go to Editor
                </button>
                <p
                  class="text-center text-[10px] text-slate-500 mt-4 uppercase tracking-widest font-bold"
                >
                  Opens Subtitle Editor
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { Hook, ReadyClip, PromptTemplate } from '../../types/clipper';

const props = defineProps<{
  previewVideoUrl: string | null;
  readyClips: ReadyClip[];
}>();

const emit = defineEmits<{
  (e: 'select-hook', hook: Hook): void;
  (e: 'back-to-library'): void;
}>();

const state = useClipperState();
const API_BASE = 'http://localhost:8000';

const activeTab = ref<'generated' | 'saved'>('generated');
const hoveredHookIndex = ref<number | null>(null);
const selectedModalHook = ref<Hook | null>(null);
const modalVideoPlayer = ref<HTMLVideoElement | null>(null);
const forceHighRes = ref(state.hdReady.value);
const isTogglingResolution = ref(false);
const savedPlaybackTime = ref<number | null>(null);

const hasVideoError = ref(false);

function onVideoError() {
  hasVideoError.value = true;
}

const cardPreviewVideoUrl = computed(() => {
  if (props.previewVideoUrl) return props.previewVideoUrl;
  if (state.videoUrl.value) {
    if (
      state.hasPreview.value &&
      state.videoUrl.value.includes('/assets/sources/') &&
      state.videoUrl.value.endsWith('/full.mp4')
    ) {
      return state.videoUrl.value.replace('/full.mp4', '/preview.mp4');
    }
    return state.videoUrl.value;
  }
  if (state.folderName.value) {
    const filename = state.hasPreview.value ? 'preview.mp4' : 'full.mp4';
    return `${API_BASE}/assets/sources/${state.folderName.value}/${filename}`;
  }
  return null;
});

const modalVideoUrl = computed(() => {
  if (forceHighRes.value && state.hdReady.value && state.videoUrl.value) {
    return state.videoUrl.value;
  }
  if (props.previewVideoUrl) {
    return props.previewVideoUrl;
  }
  if (state.videoUrl.value) {
    return state.videoUrl.value;
  }
  if (state.folderName.value) {
    const filename =
      forceHighRes.value && state.hdReady.value
        ? 'full.mp4'
        : state.hasPreview.value
          ? 'preview.mp4'
          : 'full.mp4';
    return `${API_BASE}/assets/sources/${state.folderName.value}/${filename}`;
  }
  return null;
});

const showAdjustDuration = ref(false);
const timingPanelRef = ref<HTMLElement | null>(null);
const timingTriggerBtnRef = ref<HTMLElement | null>(null);
const modalHookSliderRef = ref<HTMLElement | null>(null);
const dragMode = ref<'start' | 'end' | null>(null);
const dragInitialStart = ref(0);
const dragInitialEnd = ref(0);
const isPreviewingDelta = ref(false);
const microWindowStart = ref(0);
const microWindowEnd = ref(100);
const startInputStr = ref('00:00');
const endInputStr = ref('00:00');
const activeModalTab = ref<'breakdown' | 'transcript'>('breakdown');

const microDuration = computed(() => {
  return Math.max(1, microWindowEnd.value - microWindowStart.value);
});

function updateMicroWindow(start: number, end: number, padding = 30) {
  const total = state.videoDuration.value || 3600;
  microWindowStart.value = Math.max(
    0,
    parseFloat((start - padding).toFixed(1))
  );
  microWindowEnd.value = Math.min(
    total,
    parseFloat((end + padding).toFixed(1))
  );
}

function onHookCardClick(hook: Hook) {
  if (typeof window !== 'undefined') {
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      return;
    }
  }
  selectedModalHook.value = hook;
}

function formatHookDuration(start: number, end: number) {
  const diff = Math.abs(end - start);
  if (diff < 60) return `(${Math.floor(diff)}s)`;
  const m = Math.floor(diff / 60);
  const s = Math.floor(diff % 60);
  if (s === 0) return `(${m}m)`;
  return `(${m}m ${s}s)`;
}

function formatMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function parseMMSS(str: string): number | null {
  const parts = str.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0] || '0', 10);
    const s = parseInt(parts[1] || '0', 10);
    if (!isNaN(m) && !isNaN(s)) {
      return m * 60 + s;
    }
  }
  const val = parseFloat(str);
  if (!isNaN(val)) return val;
  return null;
}

function isHookSaved(hook: Hook) {
  return state.savedHooks.value.some(
    (h: Hook) =>
      Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1
  );
}

function findMatchingClip(hook: Hook | null): ReadyClip | undefined {
  if (!props.readyClips?.length || !state.folderName.value || !hook)
    return undefined;
  return props.readyClips.find(c => {
    if (c.folder_name !== state.folderName.value) return false;
    const parts = c.clip_id.split('_');
    const part0 = parts[0];
    const part1 = parts[1];
    if (part0 === undefined || part1 === undefined) return false;
    const cStart = parseFloat(part0);
    const cEnd = parseFloat(part1);
    if (isNaN(cStart) || isNaN(cEnd)) return false;

    const safetyBuffer = state.startSafetyBuffer?.value ?? 2.0;
    const expectedStart = Math.max(0, Math.floor(hook.start - safetyBuffer));
    const expectedEnd = Math.ceil(hook.end);
    if (
      Math.abs(cStart - expectedStart) < 1.5 &&
      Math.abs(cEnd - expectedEnd) < 1.5
    ) {
      return true;
    }

    const expectedStartDefault = Math.max(0, Math.floor(hook.start - 2.0));
    if (
      Math.abs(cStart - expectedStartDefault) < 1.5 &&
      Math.abs(cEnd - expectedEnd) < 1.5
    ) {
      return true;
    }
    const expectedStartNone = Math.max(0, Math.floor(hook.start));
    if (
      Math.abs(cStart - expectedStartNone) < 1.5 &&
      Math.abs(cEnd - expectedEnd) < 1.5
    ) {
      return true;
    }

    const hookDuration = hook.end - hook.start;
    if (hookDuration <= 0) return false;
    const overlapStart = Math.max(cStart, hook.start);
    const overlapEnd = Math.min(cEnd, hook.end);
    const overlap = overlapEnd - overlapStart;
    if (overlap > 0 && overlap / hookDuration >= 0.8) {
      return true;
    }

    if (hook.theme && parts.length >= 3) {
      const cleanHookTheme = hook.theme
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const clipThemeStr = parts.slice(2).join(' ').replace(/_/g, ' ');
      const cleanClipTheme = clipThemeStr
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (
        cleanHookTheme &&
        cleanClipTheme &&
        (cleanClipTheme.includes(cleanHookTheme) ||
          cleanHookTheme.includes(cleanClipTheme))
      ) {
        return true;
      }
    }

    return false;
  });
}

function isHookRendered(hook: Hook | null) {
  if (!hook) return false;

  const status = state.jobStatus.value;
  if (['cutting', 'transcribing', 'queued'].includes(status)) {
    if (state.activeHook.value) {
      const hStart =
        typeof hook.start === 'string' ? parseFloat(hook.start) : hook.start;
      const hEnd =
        typeof hook.end === 'string' ? parseFloat(hook.end) : hook.end;
      const aStart =
        typeof state.activeHook.value.start === 'string'
          ? parseFloat(state.activeHook.value.start)
          : state.activeHook.value.start;
      const aEnd =
        typeof state.activeHook.value.end === 'string'
          ? parseFloat(state.activeHook.value.end)
          : state.activeHook.value.end;
      if (Math.abs(aStart - hStart) < 0.1 && Math.abs(aEnd - hEnd) < 0.1) {
        return false;
      }
    }
  }

  const matchingClip = findMatchingClip(hook);
  if (!matchingClip) return false;

  if (
    ['cutting', 'transcribing', 'queued'].includes(status) &&
    state.clipId.value === matchingClip.clip_id
  ) {
    return false;
  }

  return true;
}

async function toggleSaveHook(hook: Hook) {
  const existing = state.savedHooks.value.find(
    (h: Hook) =>
      Math.abs(h.start - hook.start) < 0.1 && Math.abs(h.end - hook.end) < 0.1
  );
  if (existing) {
    if (existing._id) {
      await state.deleteSavedHook(existing._id);
    }
  } else {
    await state.saveHook(hook);
  }
}

function toggleResolution(highRes: boolean) {
  if (forceHighRes.value === highRes) return;
  hasVideoError.value = false;

  if (modalVideoPlayer.value) {
    savedPlaybackTime.value = modalVideoPlayer.value.currentTime;
    isTogglingResolution.value = true;
  }
  forceHighRes.value = highRes;
}

function onModalLoadedMetadata(e: Event) {
  const videoEl = e.target as HTMLVideoElement;
  if (isTogglingResolution.value && savedPlaybackTime.value !== null) {
    videoEl.currentTime = savedPlaybackTime.value;
    isTogglingResolution.value = false;
    savedPlaybackTime.value = null;
  } else if (selectedModalHook.value) {
    videoEl.currentTime = Math.max(
      0,
      selectedModalHook.value.start - state.startSafetyBuffer.value
    );
  }
  restoreModalVolume(videoEl);
}

function restoreModalVolume(el: HTMLVideoElement | null) {
  if (!el) return;
  if (typeof localStorage !== 'undefined') {
    const savedVolume = localStorage.getItem('yonru_preview_volume');
    const savedMuted = localStorage.getItem('yonru_preview_muted');
    if (savedVolume !== null) {
      el.volume = parseFloat(savedVolume);
    }
    if (savedMuted !== null) {
      el.muted = savedMuted === 'true';
    }
  }
}

function onVolumeChange() {
  const el = modalVideoPlayer.value;
  if (el && typeof localStorage !== 'undefined') {
    localStorage.setItem('yonru_preview_volume', el.volume.toString());
    localStorage.setItem('yonru_preview_muted', el.muted.toString());
  }
}

watch(
  () => state.jobStatus.value,
  newStatus => {
    if (newStatus === 'queued') {
      activeTab.value = 'generated';
    }
  }
);

watch(modalVideoPlayer, el => {
  if (el) {
    restoreModalVolume(el);
  }
});

watch(selectedModalHook, newHook => {
  hasVideoError.value = false;
  if (newHook) {
    if (newHook.originalStart === undefined) {
      newHook.originalStart = newHook.start;
    }
    if (newHook.originalEnd === undefined) {
      newHook.originalEnd = newHook.end;
    }
    const effectiveStart = Math.max(
      0,
      newHook.start - state.startSafetyBuffer.value
    );
    startInputStr.value = formatMMSS(effectiveStart);
    endInputStr.value = formatMMSS(newHook.end);
    updateMicroWindow(effectiveStart, newHook.end);
    activeModalTab.value = 'breakdown';
    forceHighRes.value = state.hdReady.value;
    isTogglingResolution.value = false;
    savedPlaybackTime.value = null;
    isPreviewingDelta.value = false;
  } else {
    showAdjustDuration.value = false;
    activeModalTab.value = 'breakdown';
    forceHighRes.value = state.hdReady.value;
    isTogglingResolution.value = false;
    savedPlaybackTime.value = null;
    isPreviewingDelta.value = false;
  }
});

watch(showAdjustDuration, val => {
  if (val && selectedModalHook.value) {
    updateMicroWindow(
      selectedModalHook.value.start - state.startSafetyBuffer.value,
      selectedModalHook.value.end
    );
  }
});

function resetToDefaultDuration() {
  if (
    selectedModalHook.value &&
    selectedModalHook.value.originalStart !== undefined &&
    selectedModalHook.value.originalEnd !== undefined
  ) {
    selectedModalHook.value.start = selectedModalHook.value.originalStart;
    selectedModalHook.value.end = selectedModalHook.value.originalEnd;
    const effectiveStart = Math.max(
      0,
      selectedModalHook.value.start - state.startSafetyBuffer.value
    );
    startInputStr.value = formatMMSS(effectiveStart);
    endInputStr.value = formatMMSS(selectedModalHook.value.end);
    updateMicroWindow(effectiveStart, selectedModalHook.value.end);
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = effectiveStart;
      modalVideoPlayer.value.play().catch(() => {});
    }
  }
}

function startDrag(
  mode: 'start' | 'end',
  initialStart?: number,
  initialEnd?: number
) {
  if (!selectedModalHook.value) return;
  dragMode.value = mode;
  dragInitialStart.value =
    initialStart !== undefined
      ? initialStart
      : Math.max(
          0,
          selectedModalHook.value.start - state.startSafetyBuffer.value
        );
  dragInitialEnd.value =
    initialEnd !== undefined ? initialEnd : selectedModalHook.value.end;

  window.addEventListener('mousemove', onDragging);
  window.addEventListener('mouseup', stopDragging);
  window.addEventListener('touchmove', onDragging, { passive: false });
  window.addEventListener('touchend', stopDragging);
}

let edgeScrollRaf: number | null = null;
let lastScrollTimestamp: number | null = null;
const edgeScrollDirection = ref<-1 | 1 | 0>(0);

function stepEdgeAutoScroll(timestamp: number) {
  if (
    !edgeScrollDirection.value ||
    !dragMode.value ||
    !selectedModalHook.value
  ) {
    stopEdgeAutoScroll();
    return;
  }

  if (lastScrollTimestamp === null) {
    lastScrollTimestamp = timestamp;
  }
  const elapsedSec = Math.min(0.1, (timestamp - lastScrollTimestamp) / 1000);
  lastScrollTimestamp = timestamp;

  const scrollRate = 8; // 8 seconds of footage per second of dwell
  const delta = scrollRate * elapsedSec;
  const totalDuration = state.videoDuration.value || 3600;

  if (edgeScrollDirection.value === 1 && dragMode.value === 'end') {
    if (selectedModalHook.value.end < totalDuration) {
      const newEnd = Math.min(
        totalDuration,
        selectedModalHook.value.end + delta
      );
      const actualDelta = newEnd - selectedModalHook.value.end;
      selectedModalHook.value.end = parseFloat(newEnd.toFixed(2));
      endInputStr.value = formatMMSS(selectedModalHook.value.end);

      microWindowEnd.value = Math.min(
        totalDuration,
        parseFloat((microWindowEnd.value + actualDelta).toFixed(2))
      );
      microWindowStart.value = Math.max(
        0,
        parseFloat((microWindowStart.value + actualDelta).toFixed(2))
      );

      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = selectedModalHook.value.end;
      }
    } else {
      stopEdgeAutoScroll();
      return;
    }
  } else if (edgeScrollDirection.value === -1 && dragMode.value === 'start') {
    const effectiveStart =
      selectedModalHook.value.start - state.startSafetyBuffer.value;
    if (effectiveStart > 0) {
      const newEffectiveStart = Math.max(0, effectiveStart - delta);
      const actualDelta = effectiveStart - newEffectiveStart;
      selectedModalHook.value.start = parseFloat(
        (newEffectiveStart + state.startSafetyBuffer.value).toFixed(2)
      );
      startInputStr.value = formatMMSS(newEffectiveStart);

      microWindowStart.value = Math.max(
        0,
        parseFloat((microWindowStart.value - actualDelta).toFixed(2))
      );
      microWindowEnd.value = Math.max(
        microWindowStart.value + 10,
        parseFloat((microWindowEnd.value - actualDelta).toFixed(2))
      );

      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = newEffectiveStart;
      }
    } else {
      stopEdgeAutoScroll();
      return;
    }
  }

  if (typeof window !== 'undefined') {
    edgeScrollRaf = requestAnimationFrame(stepEdgeAutoScroll);
  }
}

function startEdgeAutoScroll(direction: -1 | 1) {
  if (edgeScrollDirection.value === direction && edgeScrollRaf !== null) return;
  edgeScrollDirection.value = direction;
  lastScrollTimestamp = null;
  if (edgeScrollRaf === null && typeof window !== 'undefined') {
    edgeScrollRaf = requestAnimationFrame(stepEdgeAutoScroll);
  }
}

function stopEdgeAutoScroll() {
  edgeScrollDirection.value = 0;
  lastScrollTimestamp = null;
  if (edgeScrollRaf !== null && typeof window !== 'undefined') {
    cancelAnimationFrame(edgeScrollRaf);
    edgeScrollRaf = null;
  }
}

function onDragging(e: MouseEvent | TouchEvent) {
  if (!dragMode.value || !selectedModalHook.value) return;

  const slider =
    modalHookSliderRef.value || document.getElementById('modal-hook-slider');
  if (!slider) return;

  const rect = slider.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  const percentage = Math.max(
    0,
    Math.min(1, (clientX - rect.left) / rect.width)
  );
  const totalDuration = state.videoDuration.value || 3600;
  const microDur = microDuration.value;
  const rawVal = microWindowStart.value + percentage * microDur;
  const newVal = parseFloat(rawVal.toFixed(1));

  const isAtRightEdge = percentage >= 0.98 || clientX >= rect.right - 4;
  const isAtLeftEdge = percentage <= 0.02 || clientX <= rect.left + 4;

  if (dragMode.value === 'start') {
    const minStart = microWindowStart.value;
    const maxStart = selectedModalHook.value.end - 1.0;
    if (newVal <= maxStart) {
      const clampedStart = Math.max(minStart, newVal);
      selectedModalHook.value.start = parseFloat(
        (clampedStart + state.startSafetyBuffer.value).toFixed(1)
      );
      startInputStr.value = formatMMSS(clampedStart);

      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = clampedStart;
      }
    }

    if (isAtLeftEdge) {
      startEdgeAutoScroll(-1);
    } else {
      stopEdgeAutoScroll();
    }
  } else if (dragMode.value === 'end') {
    const effectiveStart = Math.max(
      0,
      selectedModalHook.value.start - state.startSafetyBuffer.value
    );
    const minEnd = effectiveStart + 1.0;
    const maxEnd = Math.min(totalDuration, microWindowEnd.value);
    if (newVal >= minEnd) {
      const clampedEnd = Math.min(maxEnd, newVal);
      selectedModalHook.value.end = parseFloat(clampedEnd.toFixed(1));
      endInputStr.value = formatMMSS(selectedModalHook.value.end);

      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = selectedModalHook.value.end;
      }
    }

    if (isAtRightEdge) {
      startEdgeAutoScroll(1);
    } else {
      stopEdgeAutoScroll();
    }
  }
}

function stopDragging() {
  stopEdgeAutoScroll();
  const currentDrag = dragMode.value;
  dragMode.value = null;
  window.removeEventListener('mousemove', onDragging);
  window.removeEventListener('mouseup', stopDragging);
  window.removeEventListener('touchmove', onDragging);
  window.removeEventListener('touchend', stopDragging);

  if (!currentDrag || !selectedModalHook.value) return;

  const effectiveStart = Math.max(
    0,
    selectedModalHook.value.start - state.startSafetyBuffer.value
  );
  const currentEnd = selectedModalHook.value.end;

  // Re-center micro window with fresh context padding once drag finishes
  updateMicroWindow(effectiveStart, currentEnd);

  if (currentDrag === 'end') {
    if (modalVideoPlayer.value) {
      if (currentEnd > dragInitialEnd.value) {
        // Extended: play delta from old end to new end
        isPreviewingDelta.value = true;
        modalVideoPlayer.value.currentTime = dragInitialEnd.value;
        modalVideoPlayer.value.play().catch(() => {});
      } else if (currentEnd < dragInitialEnd.value) {
        // Shortened: play tail context
        isPreviewingDelta.value = true;
        modalVideoPlayer.value.currentTime = Math.max(
          effectiveStart,
          currentEnd - 3
        );
        modalVideoPlayer.value.play().catch(() => {});
      } else {
        modalVideoPlayer.value.currentTime = effectiveStart;
        modalVideoPlayer.value.play().catch(() => {});
      }
    }
  } else if (currentDrag === 'start') {
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = effectiveStart;
      modalVideoPlayer.value.play().catch(() => {});
    }
  }
}

function onTimeInputChange(mode: 'start' | 'end') {
  if (!selectedModalHook.value) return;

  const str = mode === 'start' ? startInputStr.value : endInputStr.value;
  const parsed = parseMMSS(str);

  if (parsed === null) {
    if (mode === 'start') {
      startInputStr.value = formatMMSS(
        Math.max(
          0,
          selectedModalHook.value.start - state.startSafetyBuffer.value
        )
      );
    } else {
      endInputStr.value = formatMMSS(selectedModalHook.value.end);
    }
    return;
  }

  const total = state.videoDuration.value || 3600;
  if (mode === 'start') {
    let newStart = Math.max(0, parsed);
    if (newStart > selectedModalHook.value.end - 1.0) {
      newStart = selectedModalHook.value.end - 1.0;
    }
    selectedModalHook.value.start = parseFloat(
      (newStart + state.startSafetyBuffer.value).toFixed(1)
    );
    startInputStr.value = formatMMSS(
      Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
    );
    updateMicroWindow(
      selectedModalHook.value.start - state.startSafetyBuffer.value,
      selectedModalHook.value.end
    );
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(
        0,
        selectedModalHook.value.start - state.startSafetyBuffer.value
      );
      modalVideoPlayer.value.play().catch(() => {});
    }
  } else {
    const oldEnd = selectedModalHook.value.end;
    let newEnd = Math.min(total, parsed);
    const effectiveStart = Math.max(
      0,
      selectedModalHook.value.start - state.startSafetyBuffer.value
    );
    if (newEnd < effectiveStart + 1.0) {
      newEnd = effectiveStart + 1.0;
    }
    selectedModalHook.value.end = parseFloat(newEnd.toFixed(1));
    endInputStr.value = formatMMSS(selectedModalHook.value.end);
    updateMicroWindow(effectiveStart, selectedModalHook.value.end);
    if (modalVideoPlayer.value) {
      if (selectedModalHook.value.end > oldEnd) {
        isPreviewingDelta.value = true;
        modalVideoPlayer.value.currentTime = oldEnd;
        modalVideoPlayer.value.play().catch(() => {});
      } else if (selectedModalHook.value.end < oldEnd) {
        isPreviewingDelta.value = true;
        modalVideoPlayer.value.currentTime = Math.max(
          effectiveStart,
          selectedModalHook.value.end - 3
        );
        modalVideoPlayer.value.play().catch(() => {});
      } else {
        modalVideoPlayer.value.currentTime = effectiveStart;
        modalVideoPlayer.value.play().catch(() => {});
      }
    }
  }
}

function onTimeInputStep(mode: 'start' | 'end', delta: number) {
  if (!selectedModalHook.value) return;

  const currentVal =
    mode === 'start'
      ? Math.max(
          0,
          selectedModalHook.value.start - state.startSafetyBuffer.value
        )
      : selectedModalHook.value.end;

  const newVal = currentVal + delta;
  const total = state.videoDuration.value || 3600;
  if (mode === 'start') {
    let newStart = Math.max(0, newVal);
    if (newStart > selectedModalHook.value.end - 1.0) {
      newStart = selectedModalHook.value.end - 1.0;
    }
    selectedModalHook.value.start = parseFloat(
      (newStart + state.startSafetyBuffer.value).toFixed(1)
    );
    startInputStr.value = formatMMSS(
      Math.max(0, selectedModalHook.value.start - state.startSafetyBuffer.value)
    );
    updateMicroWindow(
      selectedModalHook.value.start - state.startSafetyBuffer.value,
      selectedModalHook.value.end
    );
    if (modalVideoPlayer.value) {
      modalVideoPlayer.value.currentTime = Math.max(
        0,
        selectedModalHook.value.start - state.startSafetyBuffer.value
      );
      modalVideoPlayer.value.play().catch(() => {});
    }
  } else {
    const oldEnd = selectedModalHook.value.end;
    let newEnd = Math.min(total, newVal);
    const effectiveStart = Math.max(
      0,
      selectedModalHook.value.start - state.startSafetyBuffer.value
    );
    if (newEnd < effectiveStart + 1.0) {
      newEnd = effectiveStart + 1.0;
    }
    selectedModalHook.value.end = parseFloat(newEnd.toFixed(1));
    endInputStr.value = formatMMSS(selectedModalHook.value.end);
    updateMicroWindow(effectiveStart, selectedModalHook.value.end);
    if (modalVideoPlayer.value) {
      if (selectedModalHook.value.end > oldEnd) {
        isPreviewingDelta.value = true;
        modalVideoPlayer.value.currentTime = oldEnd;
        modalVideoPlayer.value.play().catch(() => {});
      } else if (selectedModalHook.value.end < oldEnd) {
        isPreviewingDelta.value = true;
        modalVideoPlayer.value.currentTime = Math.max(
          effectiveStart,
          selectedModalHook.value.end - 3
        );
        modalVideoPlayer.value.play().catch(() => {});
      } else {
        modalVideoPlayer.value.currentTime = effectiveStart;
        modalVideoPlayer.value.play().catch(() => {});
      }
    }
  }
}

function onSliderClick(e: MouseEvent | TouchEvent) {
  if (!selectedModalHook.value) return;
  const slider =
    modalHookSliderRef.value || document.getElementById('modal-hook-slider');
  if (!slider) return;

  const rect = slider.getBoundingClientRect();
  const clientX = 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
  const percentage = Math.max(
    0,
    Math.min(1, (clientX - rect.left) / rect.width)
  );
  const microDur = microDuration.value;
  const clickVal = parseFloat(
    (microWindowStart.value + percentage * microDur).toFixed(1)
  );

  const effectiveStart = Math.max(
    0,
    selectedModalHook.value.start - state.startSafetyBuffer.value
  );
  const distStart = Math.abs(clickVal - effectiveStart);
  const distEnd = Math.abs(clickVal - selectedModalHook.value.end);

  const mode = distStart < distEnd ? 'start' : 'end';
  const initialStart = effectiveStart;
  const initialEnd = selectedModalHook.value.end;

  if (mode === 'start') {
    if (clickVal <= selectedModalHook.value.end - 1.0) {
      const clampedStart = Math.max(0, clickVal);
      selectedModalHook.value.start = parseFloat(
        (clampedStart + state.startSafetyBuffer.value).toFixed(1)
      );
      startInputStr.value = formatMMSS(clampedStart);
      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = clampedStart;
      }
    }
  } else {
    const totalDuration = state.videoDuration.value || 3600;
    if (clickVal >= effectiveStart + 1.0) {
      const clampedEnd = Math.min(totalDuration, clickVal);
      selectedModalHook.value.end = parseFloat(clampedEnd.toFixed(1));
      endInputStr.value = formatMMSS(selectedModalHook.value.end);
      if (modalVideoPlayer.value) {
        modalVideoPlayer.value.currentTime = selectedModalHook.value.end;
      }
    }
  }

  startDrag(mode, initialStart, initialEnd);
}

function onModalTimeUpdate(e: Event) {
  if (!selectedModalHook.value) return;
  // If actively dragging slider, do not interrupt smooth frame scrubbing
  if (dragMode.value) return;

  const player = e.target as HTMLVideoElement;
  const effectiveStart = Math.max(
    0,
    selectedModalHook.value.start - state.startSafetyBuffer.value
  );
  const currentEnd = selectedModalHook.value.end;

  if (player.currentTime >= currentEnd) {
    if (isPreviewingDelta.value) {
      isPreviewingDelta.value = false;
    }
    player.currentTime = effectiveStart;
  }
}

function handleClickOutsideTiming(e: MouseEvent) {
  if (!showAdjustDuration.value || dragMode.value) return;
  const target = e.target as Node;
  if (
    timingPanelRef.value &&
    !timingPanelRef.value.contains(target) &&
    timingTriggerBtnRef.value &&
    !timingTriggerBtnRef.value.contains(target)
  ) {
    showAdjustDuration.value = false;
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', handleClickOutsideTiming);
  }
});

onUnmounted(() => {
  stopEdgeAutoScroll();
  if (typeof window !== 'undefined') {
    window.removeEventListener('mousedown', handleClickOutsideTiming);
  }
});
</script>

<style scoped>
.fade-layout-enter-active,
.fade-layout-leave-active {
  transition: opacity 200ms ease;
}
.fade-layout-enter-from,
.fade-layout-leave-to {
  opacity: 0;
}

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition:
    opacity 80ms ease,
    transform 80ms ease;
}
.scale-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.scale-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
