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
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
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
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
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
          class="tab-btn py-1.5 px-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
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
            state.jobStatus?.value !== 'ready' ||
            isOverlayVisible ||
            state.renderStatus?.value === 'rendering' ||
            state.isRenderPreviewActive?.value ||
            state.isEditorLocked?.value ||
            Boolean(state.outputUrl?.value)
        }"
      >
        <Transition name="panel-tab-fade" mode="out-in">
          <!-- TAB 1: PRESETS & STYLE PANE -->
          <SubtitlePresetPane
            v-if="activeTab === 'style'"
            key="style"
            :clipper-state="state"
            @open-studio="showPresetStudio = true"
          />

          <!-- TAB 2: TYPOGRAPHY & COLORS PANE -->
          <TypographyTimingPane
            v-else-if="activeTab === 'type'"
            key="type"
            :clipper-state="state"
          />

          <!-- TAB 3: LAYOUT & FRAMING PANE -->
          <CanvasLayoutPane
            v-else-if="activeTab === 'layout'"
            key="layout"
            :clipper-state="state"
          />
        </Transition>
      </div>
    </div>

    <!-- Extremely Compact Ultra-Slim Main Action Footer (Dimmed during pipeline/render) -->
    <div
      class="px-2.5 py-2 border-t border-surface-border bg-surface-panel/95 backdrop-blur-md shrink-0 space-y-2 transition-all duration-300"
      :class="{
        'opacity-40 pointer-events-none':
          state.jobStatus?.value !== 'ready' ||
          isOverlayVisible ||
          state.renderStatus?.value === 'rendering'
      }"
    >
      <!-- Render Status Download Alert Banner (Compact) -->
      <div
        v-if="
          state.renderStatus?.value === 'ready' ||
          state.renderStatus?.value === 'done'
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
            :href="state.outputUrl?.value"
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
              state.jobStatus?.value !== 'ready' ||
              isOverlayVisible ||
              state.renderStatus?.value === 'rendering' ||
              state.isRenderPreviewActive?.value ||
              state.isEditorLocked?.value ||
              Boolean(state.outputUrl?.value)
            "
            class="bg-surface-dark/80 border border-surface-border/80 hover:border-accent-500/50 text-slate-300 hover:text-accent-400 p-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 hover:bg-surface-card disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-surface-border/80 disabled:hover:text-slate-300 disabled:hover:bg-surface-dark/80 cursor-pointer"
            @click="handleSaveDefaultStyle"
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
            state.jobStatus?.value !== 'ready' ||
            isOverlayVisible ||
            state.renderStatus?.value === 'rendering' ||
            state.isRenderPreviewActive?.value ||
            state.isEditorLocked?.value ||
            Boolean(state.outputUrl?.value)
          "
          class="flex-1 bg-accent-500/80 text-black font-black uppercase tracking-wider rounded-xl py-2 px-2.5 text-xs hover:bg-accent-400 transition-all flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(255,215,0,0.18)] hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none min-w-0 truncate cursor-pointer"
          @click="prepareRender"
        >
          <Icon
            :name="
              state.renderStatus?.value === 'rendering'
                ? 'ri:loader-4-line'
                : 'ri:movie-fill'
            "
            :class="{
              'animate-spin': state.renderStatus?.value === 'rendering'
            }"
            class="text-sm shrink-0"
          />
          <span class="truncate">{{
            state.renderStatus?.value === 'rendering'
              ? 'RENDERING...'
              : 'RENDER CLIP'
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
        class="absolute inset-y-0 right-0 w-[2px] bg-transparent group-hover:bg-accent-500 group-active:bg-accent-500 transition-all group-hover:shadow-[0_0_8px_#ffd700]"
        :class="{ 'bg-accent-500 shadow-[0_0_8px_#ffd700]': isResizing }"
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
        <div
          v-if="isNamingClip"
          class="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <div
            class="absolute inset-0 bg-black/60 backdrop-blur-md"
            @click="isNamingClip = false"
          ></div>

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
                  class="flex-1 px-4 py-3 rounded-xl border border-surface-border text-slate-400 font-bold text-xs hover:bg-surface-card transition-all cursor-pointer"
                  @click="isNamingClip = false"
                >
                  Cancel
                </button>
                <button
                  class="flex-[1.5] bg-accent-500 hover:bg-accent-400 text-black px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,215,0,0.2)] cursor-pointer"
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
          ></div>
          <div class="relative w-full max-w-2xl z-10">
            <BlacklistSettings @close="showBlacklistSettings = false" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Preset Studio Modal -->
    <PresetStudioModal
      :show="showPresetStudio"
      :active-preset-id="state.subtitlePreset?.value"
      @close="showPresetStudio = false"
      @select="applyPreset"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useClipperState } from '../composables/useClipperState';
import PresetStudioModal from './editor/PresetStudioModal.vue';
import BlacklistSettings from './BlacklistSettings.vue';
import SubtitlePresetPane from './editor/SubtitlePresetPane.vue';
import TypographyTimingPane from './editor/TypographyTimingPane.vue';
import CanvasLayoutPane from './editor/CanvasLayoutPane.vue';

const state = useClipperState();
const { isOverlayVisible } = state;

const showPresetStudio = ref(false);
const showBlacklistSettings = ref(false);
const isNamingClip = ref(false);
const renderName = ref('');

// Segmented Navigation Tab State
const activeTab = ref('style'); // 'style' | 'type' | 'layout'

// Resize variables
const sidebarWidth = ref(340);
const isResizing = ref(false);
const sidebarRef = ref(null);

function startResize() {
  isResizing.value = true;
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
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
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.userSelect = '';
  document.body.style.cursor = '';

  // Persist computed sidebar width to localStorage
  localStorage.setItem('yonru_sidebar_width', sidebarWidth.value.toString());
}

onMounted(() => {
  const savedWidth = localStorage.getItem('yonru_sidebar_width');
  if (savedWidth) {
    const widthNum = parseInt(savedWidth, 10);
    if (!isNaN(widthNum)) {
      sidebarWidth.value = Math.max(280, Math.min(340, widthNum));
    }
  }
});

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
});

function prepareRender() {
  if (state.activeHook?.value) {
    renderName.value = state.activeHook.value.theme || '';
  }
  isNamingClip.value = true;
}

function startFinalRender() {
  if (!renderName.value.trim()) return;
  isNamingClip.value = false;
  state.renderClip(0, renderName.value.trim());
}

function applyPreset(preset) {
  if (state.applyPreset) {
    state.applyPreset(preset);
  } else {
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
  if (state.saveStyleSettings) {
    state.saveStyleSettings();
  }
}

function handleSaveDefaultStyle() {
  state.saveDefaultStyleSettings();
  if (state.showToast) {
    state.showToast('Default style saved!', 'success');
  }
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
