<template>
  <!-- Backdrop Overlay (Only in floating mode) -->
  <Transition
    v-if="isFloating"
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="!isCollapsed"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[55]"
      @click="isCollapsed = true"
    ></div>
  </Transition>

  <!-- Container with dynamic footprint -->
  <div
    class="h-full shrink-0 font-sans select-none overflow-visible"
    :class="[
      isFloating ? 'w-[64px] relative z-[60]' : 'relative z-30',
      isDragging
        ? 'transition-none'
        : 'transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
    ]"
    :style="{
      width: isFloating ? '64px' : isCollapsed ? '64px' : `${sidebarWidth}px`
    }"
  >
    <aside
      class="bg-[#09090b]/95 backdrop-blur-xl flex flex-col h-full overflow-visible border-r border-white/[0.08] shadow-[0_0_25px_rgba(0,0,0,0.6)]"
      :class="[
        isFloating
          ? 'absolute top-0 left-0 shadow-2xl border-r border-white/[0.08]'
          : 'relative w-full h-full',
        !isCollapsed && isFloating ? 'bg-[#09090b]' : '',
        isDragging
          ? 'transition-none'
          : 'transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
      ]"
      :style="{ width: isCollapsed ? '64px' : `${sidebarWidth}px` }"
    >
      <!-- Resizer Handle (Only when expanded) -->
      <div
        v-if="!isCollapsed"
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-500/50 transition-colors z-40 group"
        @mousedown="startDrag"
      >
        <div class="absolute inset-y-0 -left-1 -right-1"></div>
      </div>

      <!-- Sidebar Content -->
      <div class="flex flex-col h-full w-full overflow-visible">
        <!-- Header (Unified Fixed Origin for Toggle Button) -->
        <div
          class="h-14 border-b border-white/[0.08] flex items-center px-3 shrink-0 overflow-hidden"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Sidebar Toggle Button -->
            <button
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              :title="
                isCollapsed
                  ? 'Expand Sidebar (Cmd+B)'
                  : 'Collapse Sidebar (Cmd+B)'
              "
              @click="isCollapsed = !isCollapsed"
            >
              <Icon
                :name="
                  isCollapsed ? 'lucide:panel-left' : 'lucide:panel-left-close'
                "
                class="text-lg"
              />
            </button>

            <!-- Brand Logo & Title with Asymmetrical Timing -->
            <div
              class="flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap transition-all ease-in-out"
              :class="
                isCollapsed
                  ? 'max-w-0 opacity-0 duration-80 pointer-events-none'
                  : 'max-w-[200px] opacity-100 duration-200 delay-100 pointer-events-auto'
              "
            >
              <NuxtLink
                to="/"
                class="flex items-center min-w-0 group cursor-pointer overflow-hidden whitespace-nowrap py-0.5"
                title="Yonru — Home"
              >
                <!-- Full Horizontal Logo Lockup: [ | ] Yonru. -->
                <svg
                  viewBox="70 65 480 128"
                  class="h-7 w-auto transition-transform duration-200 group-hover:scale-[1.03] select-none"
                  fill="none"
                  role="img"
                  aria-label="Yonru."
                >
                  <!-- [ | ] Symbol -->
                  <g transform="translate(48, 48) scale(0.625)">
                    <path
                      d="M 94 56 H 56 V 200 H 94"
                      stroke="#FFFFFF"
                      stroke-width="26"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M 162 56 H 200 V 200 H 162"
                      stroke="#FFFFFF"
                      stroke-width="26"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <rect
                      x="114"
                      y="68"
                      width="28"
                      height="120"
                      rx="14"
                      fill="#ffd700"
                    />
                  </g>
                  <!-- Wordmark "Yonru." with Brand Gold Accent Dot -->
                  <text
                    x="215"
                    y="160"
                    font-family="'Outfit', system-ui, -apple-system, sans-serif"
                    font-size="106"
                    font-weight="700"
                    letter-spacing="-2"
                    fill="#FFFFFF"
                  >
                    Yonru
                    <tspan fill="#ffd700">.</tspan>
                  </text>
                </svg>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Main Content Area with Fixed Anchors and Asymmetrical Timing -->
        <div
          class="flex-1 min-h-0 relative flex flex-col p-3 pt-2 gap-3.5"
          :class="
            isCollapsed
              ? 'overflow-visible select-none'
              : 'overflow-y-auto overflow-x-hidden custom-scrollbar'
          "
        >
          <!-- Section 1: Spotlight Search Trigger (Dual-Layer Fixed Anchor) -->
          <div class="relative w-full h-10 flex items-center shrink-0">
            <!-- Collapsed Circular Search Button Layer -->
            <div
              class="absolute left-0 top-2 w-10 h-10 flex items-center justify-center transition-all ease-in-out"
              :class="
                isCollapsed
                  ? 'opacity-100 duration-150 delay-100 pointer-events-auto'
                  : 'opacity-0 duration-80 pointer-events-none'
              "
            >
              <div class="relative group">
                <button
                  class="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/30 text-white/70 hover:text-white hover:scale-105 flex items-center justify-center cursor-pointer relative transition-all"
                  title="Search (Cmd+K)"
                  @click="palette.open"
                >
                  <Icon name="lucide:search" class="text-base" />
                </button>
                <div
                  class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-white/15 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5"
                >
                  <span>Search</span>
                  <kbd
                    class="px-1 py-0.2 bg-white/[0.08] border border-white/10 rounded font-mono text-[9px] text-white/60"
                    >⌘K</kbd
                  >
                </div>
              </div>
            </div>

            <!-- Expanded Wide Search Bar Layer -->
            <div
              class="w-full h-10 transition-all ease-in-out overflow-hidden mt-4"
              :class="
                isCollapsed
                  ? 'opacity-0 duration-80 pointer-events-none max-w-0'
                  : 'opacity-100 duration-200 delay-100 pointer-events-auto max-w-full'
              "
            >
              <button
                class="w-full h-10 flex items-center justify-between px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-accent-500/40 hover:shadow-[0_0_15px_rgba(255,215,0,0.06)] transition-all group cursor-pointer text-left whitespace-nowrap"
                title="Search (Cmd+K)"
                @click="palette.open"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <Icon
                    name="lucide:search"
                    class="text-sm text-white/50 group-hover:text-accent-500 transition-colors shrink-0"
                  />
                  <span
                    class="text-xs text-white/50 group-hover:text-white/80 font-medium truncate transition-colors"
                  >
                    Search or jump to...
                  </span>
                </div>
                <kbd
                  class="px-1.5 py-0.5 text-[9px] font-mono font-bold text-white/50 bg-white/[0.06] border border-white/10 rounded group-hover:border-white/20 group-hover:text-white/70 transition-all shrink-0"
                >
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>

          <!-- Divider (Collapsed Only) -->
          <div
            class="border-t border-white/[0.08] transition-all duration-300 shrink-0"
            :class="
              isCollapsed ? 'w-7 mx-auto my-0.5 relative top-2' : 'hidden'
            "
          ></div>

          <!-- Section 2: Main Navigation Items -->
          <SidebarNavList
            :is-collapsed="isCollapsed"
            :active-view="activeView"
            :is-any-prerequisite-missing="
              state?.isAnyPrerequisiteMissing?.value
            "
            @navigate="handleNav"
          />

          <!-- Divider -->
          <div
            class="border-t border-white/[0.08] transition-all duration-300 shrink-0"
            :class="isCollapsed ? 'w-7 mx-auto my-0.5' : 'hidden'"
          ></div>

          <!-- Section 3: Workspace Card -->
          <SidebarWorkspaceCard
            :is-collapsed="isCollapsed"
            :is-processing="isProcessing"
            :processing-title="processingTitle"
            :processing-status="processingStatus"
            :last-clip="lastClip"
            :last-video="lastVideo"
            :last-clip-thumbnail="lastClipThumbnail"
            :is-current-clip-active="isCurrentClipActive"
            @continue-editing="handleContinueEditingClick"
            @thumbnail-error="handleThumbnailError"
          />

          <!-- Section 4: Changelog (Persistent 40px Hitbox) -->
          <div class="relative group w-full mt-auto pt-2 shrink-0">
            <button
              class="h-10 flex items-center rounded-xl text-white/80 hover:text-white hover:bg-white/[0.04] transition-colors duration-200 cursor-pointer w-full overflow-hidden"
              :title="isCollapsed ? 'Changelog' : undefined"
              @click="handleNav('changelog')"
            >
              <div class="w-10 h-10 shrink-0 flex items-center justify-center">
                <Icon
                  name="lucide:history"
                  class="text-lg group-hover:scale-105 transition-transform"
                />
              </div>
              <div
                class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0"
                :class="
                  isCollapsed
                    ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none'
                    : 'max-w-[160px] opacity-100 duration-200 delay-75 translate-x-0'
                "
              >
                <span class="text-sm font-medium pr-3">Changelog</span>
              </div>
            </button>

            <div
              v-if="isCollapsed"
              class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap"
            >
              Changelog
            </div>
          </div>
        </div>

        <!-- Section 5: Utility Footer -->
        <SidebarUtilityFooter
          :is-collapsed="isCollapsed"
          :status-color="statusColor"
          :status-label="statusLabel"
        />
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useCommandPalette } from '~/composables/useCommandPalette';
import SidebarNavList from './sidebar/SidebarNavList.vue';
import SidebarWorkspaceCard from './sidebar/SidebarWorkspaceCard.vue';
import SidebarUtilityFooter from './sidebar/SidebarUtilityFooter.vue';

const state = useClipperState();
const palette = useCommandPalette();

const isCurrentClipActive = computed(() => {
  return props.activeView === 'editor';
});

const statusColor = computed(() => {
  const status = state?.jobStatus?.value || 'idle';
  const map: Record<string, string> = {
    idle: 'bg-emerald-500/80',
    queued: 'bg-amber-500',
    downloading_audio: 'bg-sky-500 animate-pulse',
    transcribing: 'bg-violet-500 animate-pulse',
    generating_hooks: 'bg-fuchsia-500 animate-pulse',
    hooks_ready: 'bg-accent-500 shadow-[0_0_8px_#ffd700]',
    extracting_video: 'bg-sky-500 animate-pulse',
    cutting: 'bg-sky-400 animate-pulse',
    ready: 'bg-accent-500 shadow-[0_0_8px_#ffd700]',
    error: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
  };
  return map[status] || 'bg-slate-600';
});

const statusLabel = computed(() => {
  return state?.jobStatus?.value?.toUpperCase()?.replace('_', ' ') || 'IDLE';
});

const props = withDefaults(
  defineProps<{
    activeView: string;
    cachedVideos: any[];
    isProcessing: boolean;
    processingStatus?: string;
    processingTitle?: string;
    lastVideo?: any;
    lastClip?: any;
    API_BASE?: string;
    defaultCollapsed?: boolean;
    isFloating?: boolean;
  }>(),
  {
    API_BASE: () => resolveApiBase(),
    defaultCollapsed: true,
    isFloating: false
  }
);

const lastVideo = computed(() => {
  return props.lastVideo !== undefined
    ? props.lastVideo
    : state?.lastAccessedVideo?.value;
});

const lastClip = computed(() => {
  return props.lastClip !== undefined
    ? props.lastClip
    : state?.lastAccessedClip?.value;
});

const thumbnailFallbackStage = ref<number>(0);

watch([() => lastClip.value?.clip_id, () => lastClip.value?.folder], () => {
  thumbnailFallbackStage.value = 0;
});

function formatThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `${props.API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

const lastClipThumbnail = computed(() => {
  const clip = lastClip.value;
  const video = lastVideo.value;
  if (!clip) return null;

  // Stage 2: Exhausted both clip and video thumbnails -> fall back cleanly to Icon
  if (thumbnailFallbackStage.value >= 2) {
    return null;
  }

  // Stage 1: Fallback to parent video thumbnail
  if (thumbnailFallbackStage.value === 1) {
    if (video?.thumbnail_url) {
      return formatThumbnailUrl(video.thumbnail_url);
    }
    if (video?.thumbnail) {
      return formatThumbnailUrl(video.thumbnail);
    }
    return null;
  }

  // Stage 0: Try Clip Thumbnail (thumbnail_url) or legacy poster_url
  if (clip.thumbnail_url) {
    return formatThumbnailUrl(clip.thumbnail_url);
  }

  if (clip.poster_url) {
    return formatThumbnailUrl(clip.poster_url);
  }

  const folder = clip.folder || clip.folder_name;
  if (folder && clip.clip_id) {
    return `${props.API_BASE}/assets/clips/${folder}/${clip.clip_id}/thumbnail.jpg`;
  }

  // If Stage 0 has no candidate at all, try parent video directly
  if (video?.thumbnail_url) {
    return formatThumbnailUrl(video.thumbnail_url);
  }
  if (video?.thumbnail) {
    return formatThumbnailUrl(video.thumbnail);
  }

  return null;
});

function handleThumbnailError() {
  thumbnailFallbackStage.value += 1;
}

const emit = defineEmits<{
  (e: 'update:activeView', view: string): void;
}>();

function useSafeState<T>(key: string, init: () => T) {
  try {
    return useState<T>(key, init);
  } catch {
    return ref(init());
  }
}

const isCollapsed = props.isFloating
  ? ref(props.defaultCollapsed ?? true)
  : useSafeState<boolean>(
      'yonru_sidebar_collapsed',
      () => props.defaultCollapsed ?? true
    );

watch(isCollapsed, newVal => {
  if (!props.isFloating) {
    localStorage.setItem('yonru_sidebar_collapsed', newVal.toString());
  }
});
const sidebarWidth = ref(280);
const minWidth = 240;
const maxWidth = 480;
let isDragging = false;

function useSafeRouter() {
  try {
    const r = useRouter();
    if (r && typeof r.push === 'function') return r;
  } catch {}
  try {
    if (typeof (globalThis as any).useRouter === 'function') {
      return (globalThis as any).useRouter();
    }
  } catch {}
  return { push: () => {} };
}

function handleNav(view: string) {
  if (props.activeView === view) {
    if (props.isFloating) {
      isCollapsed.value = true;
    }
    return;
  }
  const router = useSafeRouter();
  emit('update:activeView', view);
  if (view === 'settings') {
    router.push('/settings');
  } else if (view === 'prompts') {
    router.push('/prompts');
  } else if (view === 'docs') {
    router.push('/docs');
  } else if (view === 'changelog') {
    router.push('/changelog');
  } else if (view === 'home') {
    router.push('/');
  }
  if (props.isFloating) {
    isCollapsed.value = true;
  }
}

async function handleContinueEditingClick() {
  if (isCurrentClipActive.value) return;
  const router = useSafeRouter();
  const clip = lastClip.value;
  if (!clip) return;

  try {
    if (state?.isNavigatingToEditor) {
      state.isNavigatingToEditor.value = true;
    }
    const minWait = new Promise(resolve => setTimeout(resolve, 600));

    const folder = clip.folder || clip.folder_name;
    await state.loadReadyClipIntoEditor(folder, clip.clip_id);

    let hookIndex = 0;
    let tab = 'generated';

    const clipId = clip.clip_id || '';
    const parts = clipId.split('_');
    if (parts.length >= 2) {
      const clipStart = parseFloat(parts[0]) || 0;
      const clipEnd = parseFloat(parts[1]) || 0;

      function findBestMatchingHookIndex(
        list: any[],
        targetStart: number,
        targetEnd: number
      ) {
        let bestIndex = -1;
        let minDiff = 5.0;
        list.forEach((h, idx) => {
          const hStart =
            typeof h.start === 'string' ? parseFloat(h.start) : h.start;
          const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end;
          const diff =
            Math.abs(hStart - targetStart) + Math.abs(hEnd - targetEnd);
          if (diff < minDiff) {
            minDiff = diff;
            bestIndex = idx;
          }
        });
        return { index: bestIndex, diff: minDiff };
      }

      const savedMatch = findBestMatchingHookIndex(
        state.savedHooks.value,
        clipStart,
        clipEnd
      );
      const genMatch = findBestMatchingHookIndex(
        state.hooks.value,
        clipStart,
        clipEnd
      );

      if (
        savedMatch.index >= 0 &&
        (genMatch.index < 0 || savedMatch.diff <= genMatch.diff)
      ) {
        hookIndex = savedMatch.index;
        tab = 'saved';
      } else if (genMatch.index >= 0) {
        hookIndex = genMatch.index;
        tab = 'generated';
      }
    }

    await minWait;
    emit('update:activeView', 'editor');
    await router.push({
      path: '/editor',
      query: {
        job_id: state.jobId.value || '',
        folder: folder,
        hook_index: hookIndex,
        tab: tab
      }
    });
  } catch (e) {
    console.error('[yonru] Failed to continue editing clip:', e);
    if (state?.isNavigatingToEditor) {
      state.isNavigatingToEditor.value = false;
    }
    state.showToast?.('Failed to load clip data', 'error');
  }
}

function startDrag() {
  isDragging = true;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function onDrag(e: MouseEvent) {
  if (!isDragging) return;
  let newWidth = e.clientX;
  if (newWidth < minWidth) newWidth = minWidth;
  if (newWidth > maxWidth) newWidth = maxWidth;
  sidebarWidth.value = newWidth;
}

function stopDrag() {
  if (isDragging) {
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('yonru_sidebar_width', sidebarWidth.value.toString());
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault();
    isCollapsed.value = !isCollapsed.value;
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    if (!props.isFloating) {
      const saved = localStorage.getItem('yonru_sidebar_collapsed');
      if (saved !== null) {
        isCollapsed.value = saved === 'true';
      } else if (props.defaultCollapsed !== undefined) {
        isCollapsed.value = props.defaultCollapsed;
      } else {
        isCollapsed.value = true;
      }
    }
    const savedWidth = localStorage.getItem('yonru_sidebar_width');
    if (savedWidth) {
      sidebarWidth.value = parseInt(savedWidth);
    }
  }
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
  window.addEventListener('keydown', handleKeydown);

  if (
    typeof window !== 'undefined' &&
    !state?.systemHealth?.value &&
    !state?.checkingHealth?.value
  ) {
    state.checkSystemHealth();
  }
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
}
</style>
