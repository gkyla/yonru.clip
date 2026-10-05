<template>
  <div
    class="mobile-preview-player reels-page-layout absolute inset-0 pointer-events-none select-none z-[60] overflow-hidden flex flex-col justify-between transition-opacity duration-200"
    :style="{ opacity: (opacity ?? 100) / 100 }"
  >
    <!-- Subtle Contrast Vignettes (Top & Bottom) -->
    <div
      class="absolute top-0 inset-x-0 h-[280px] bg-gradient-to-b from-black/75 via-black/25 to-transparent pointer-events-none"
    ></div>
    <div
      class="absolute bottom-0 inset-x-0 h-[520px] bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
    ></div>

    <!-- Header Title Area (iOS/Mobile Status Bar & Reels Navigation calibrated 1:1) -->
    <header
      class="reels-header-container w-full flex flex-col items-center shrink-0 z-10 pointer-events-none pt-3"
    >
      <!-- Tier 1: Authentic Mobile Status Bar (85px height unified) -->
      <div
        class="status-bar-container w-full h-[85px] px-11 flex items-center justify-between pointer-events-none select-none"
      >
        <!-- Time (9:41) -->
        <div
          class="status-time text-[42px] font-semibold text-white tracking-tight"
        >
          9:41
        </div>

        <!-- System Status Icons (Signal, Wi-Fi, Battery) -->
        <div class="status-icons flex items-center gap-6 text-white">
          <!-- Cellular 4-bars -->
          <svg
            class="w-10 h-7"
            viewBox="0 0 20 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x="1" y="11" width="3" height="5" rx="0.5" fill="white" />
            <rect x="6" y="8" width="3" height="8" rx="0.5" fill="white" />
            <rect
              x="11"
              y="4.5"
              width="3"
              height="11.5"
              rx="0.5"
              fill="white"
            />
            <rect x="16" y="1" width="3" height="15" rx="0.5" fill="white" />
          </svg>

          <!-- Wi-Fi -->
          <svg
            class="w-10 h-7"
            viewBox="0 0 24 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 14.5C12.8284 14.5 13.5 15.1716 13.5 16C13.5 16.8284 12.8284 17.5 12 17.5C11.1716 17.5 10.5 16.8284 10.5 16C10.5 15.1716 11.1716 14.5 12 14.5Z"
              fill="white"
            />
            <path
              d="M7.76 11.76C10.1 9.42 13.9 9.42 16.24 11.76"
              stroke="white"
              stroke-width="2.5"
              stroke-linecap="round"
            />
            <path
              d="M4.22 8.22C8.51 3.93 15.49 3.93 19.78 8.22"
              stroke="white"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </svg>

          <!-- Battery -->
          <div class="battery-indicator flex items-center">
            <div
              class="w-14 h-7 rounded-[7px] border-[3px] border-white/95 p-[2.5px] flex items-center"
            >
              <div class="w-full h-full bg-white rounded-[3px]"></div>
            </div>
            <div
              class="w-1.5 h-3.5 bg-white/95 rounded-r-[2px] ml-[1.5px]"
            ></div>
          </div>
        </div>
      </div>

      <!-- Tier 2: Reels Header Row (Plus, Centered Reels ⌵ & Friends) (110px height) -->
      <div
        class="reels-nav-bar-container relative w-full h-[110px] px-11 flex items-center justify-between pointer-events-none select-none"
      >
        <!-- Left: Create / Plus Icon -->
        <button
          class="reels-plus-button flex items-center justify-center cursor-pointer z-20 w-[50px] h-[50px]"
        >
          <svg
            class="w-[42px] h-[42px] text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <!-- Center: Reels ⌵ & Friends Tab -->
        <div
          class="absolute inset-0 flex items-center justify-center gap-8 pointer-events-none select-none"
        >
          <!-- Reels Dropdown Menu -->
          <div class="reels-brand flex items-center gap-2.5 cursor-pointer">
            <span class="text-[52px] font-bold text-white tracking-tight"
              >Reels</span
            >
            <svg
              class="reels-chevron-icon w-[30px] h-[30px] text-white mt-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <!-- Friends Tab with overlapping avatar bubbles (English) -->
          <div
            class="friends-tab relative flex items-center cursor-pointer opacity-90"
          >
            <span class="text-[48px] font-semibold text-white/90 tracking-tight"
              >Friends</span
            >
            <!-- Overlapping avatar bubbles floating beside text without shifting flexbox center -->
            <div
              class="flex items-center -space-x-2.5 absolute left-full ml-3 top-1/2 -translate-y-1/2 shrink-0 pointer-events-none"
            >
              <div
                class="w-[38px] h-[38px] rounded-full bg-slate-300 border-[2px] border-black overflow-hidden flex items-center justify-center"
              >
                <svg
                  class="w-[26px] h-[26px] text-slate-700"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  />
                </svg>
              </div>
              <div
                class="w-[38px] h-[38px] rounded-full bg-neutral-800 border-[2px] border-black overflow-hidden flex items-center justify-center"
              >
                <svg
                  class="w-[26px] h-[26px] text-slate-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Empty balance spacer -->
        <div class="w-[50px] h-[50px]"></div>
      </div>
    </header>

    <!-- Video Overlay Container (Metadata & Right Sidebar) positioned at the bottom of the screen -->
    <div
      class="video-overlay-container absolute inset-x-0 bottom-0 pointer-events-none z-10 flex flex-col justify-end"
    >
      <div
        class="sidebar-metadata-container w-full px-11 pb-9 flex items-end justify-between relative"
      >
        <!-- Meta Data (Creator Profile, Username + Sound Stack, Follow Button, Caption) -->
        <div
          class="meta-data max-w-[760px] flex flex-col gap-3 text-white z-10"
        >
          <!-- Creator Info Row (Avatar + Column[Username, Audio] + Follow/Ikuti Button) -->
          <div class="creator-row flex items-center gap-3.5">
            <!-- Avatar (Clean circular profile picture) -->
            <div
              class="avatar-container w-[92px] h-[92px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-neutral-800 border-[2px] border-white/20"
            >
              <img
                :src="displayAvatar"
                alt="creator avatar"
                class="w-full h-full object-cover"
                crossorigin="anonymous"
                @error="onAvatarError"
              />
            </div>

            <!-- Vertical Stack: Username + Sound -->
            <div class="flex flex-col justify-center min-w-0">
              <!-- Username (without @) -->
              <span
                class="username text-[36px] font-bold tracking-tight text-white truncate"
              >
                {{ displayUsername }}
              </span>

              <!-- Sound / Music right beneath username -->
              <div
                class="sound-container flex items-center gap-2 text-[28px] font-medium text-white/90 max-w-[460px] overflow-hidden mt-0.5"
              >
                <!-- Music Note SVG -->
                <svg class="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="white">
                  <path
                    d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                  />
                </svg>
                <div class="overflow-hidden whitespace-nowrap">
                  <span class="truncate">{{ displaySoundTitle }}</span>
                </div>
              </div>
            </div>

            <!-- Follow Pill Button -->
            <button
              class="reels-follow-btn px-5 py-1.5 min-w-[116px] h-[50px] rounded-[12px] border-[2px] border-white/90 text-[26px] font-bold text-white tracking-wide backdrop-blur-sm cursor-pointer ml-1 self-center shrink-0 flex items-center justify-center"
            >
              {{ followText || 'Follow' }}
            </button>
          </div>

          <!-- Caption Container -->
          <div
            class="caption text-[30px] font-normal leading-snug text-white/95 line-clamp-2"
          >
            {{ displayCaption }}
          </div>
        </div>

        <!-- Overlay Sidebar (Like, Comment, Repost, Share, Bookmark, More, Audio Cover Square) -->
        <div
          class="overlay-sidebar flex flex-col items-center gap-[28px] z-10 shrink-0"
        >
          <!-- 1. Like Action (Instagram Heart Outline calibrated 1:1) -->
          <div
            class="action-item flex flex-col items-center gap-1 cursor-pointer"
          >
            <svg
              class="w-[66px] h-[58px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              />
            </svg>
            <span class="text-[24px] font-bold text-white tracking-tight">
              211RB
            </span>
          </div>

          <!-- 2. Comment Action (Instagram Speech Bubble) -->
          <div
            class="action-item flex flex-col items-center gap-1 cursor-pointer"
          >
            <svg
              class="w-[62px] h-[62px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M 20.2 14.5 A 8.6 8.6 0 1 0 15 19.8 H 20.2 V 14.5 Z" />
            </svg>
            <span class="text-[24px] font-bold text-white tracking-tight">
              92
            </span>
          </div>

          <!-- 3. Repost / Remix Action (Two Curved Arrows from Screenshot) -->
          <div
            class="action-item flex flex-col items-center gap-1 cursor-pointer"
          >
            <svg
              class="w-[62px] h-[60px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M 6.5 11 V 8.5 A 2.5 2.5 0 0 1 9 6 H 17" />
              <polyline points="13.5 2.5 17 6 13.5 9.5" />
              <path d="M 17.5 13 V 15.5 A 2.5 2.5 0 0 1 15 18 H 7" />
              <polyline points="10.5 14.5 7 18 10.5 21.5" />
            </svg>
            <span class="text-[24px] font-bold text-white tracking-tight">
              17,3RB
            </span>
          </div>

          <!-- 4. Share / Send Action (Instagram Official Share Kite/Plane) -->
          <div
            class="action-item flex flex-col items-center gap-1 cursor-pointer"
          >
            <svg
              class="w-[62px] h-[62px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M 5.5 6 H 18.5 C 19.3 6 19.7 6.8 19.2 7.5 L 13.5 19.5 C 13.1 20.3 11.9 20.3 11.5 19.5 L 10.5 13.5 L 4.8 7.5 C 4.3 6.8 4.7 6 5.5 6 Z"
              />
              <line x1="10.5" y1="13.5" x2="16.5" y2="8.5" />
            </svg>
            <span class="text-[24px] font-bold text-white tracking-tight">
              143RB
            </span>
          </div>

          <!-- 5. Bookmark / Save Action (Instagram Ribbon) -->
          <div
            class="action-item flex flex-col items-center gap-1 cursor-pointer"
          >
            <svg
              class="w-[54px] h-[62px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M 5 4.5 H 19 V 20.5 L 12 14.5 L 5 20.5 Z" />
            </svg>
            <span class="text-[24px] font-bold text-white tracking-tight">
              15,6RB
            </span>
          </div>

          <!-- 6. More Options Action (Two Parallel Lines with bottom short ═) -->
          <div
            class="action-item flex flex-col items-center justify-center cursor-pointer py-1"
          >
            <svg
              class="w-[48px] h-[24px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="2.8"
              stroke-linecap="round"
            >
              <line x1="3" y1="8" x2="21" y2="8" />
              <line x1="3" y1="16" x2="13.5" y2="16" />
            </svg>
          </div>

          <!-- 7. Audio Album Artwork Square -->
          <div
            class="reels-audio-square relative w-[68px] h-[68px] rounded-[13px] border-[2.5px] border-white overflow-hidden mt-0.5 bg-neutral-900 flex items-center justify-center"
          >
            <img
              :src="displayAvatar"
              alt="audio thumbnail"
              class="w-full h-full object-cover"
              crossorigin="anonymous"
            />
          </div>
        </div>
      </div>

      <!-- Playback Scrubber Progress Bar at the very bottom edge -->
      <div class="reels-progress-bar w-full h-[4px] bg-white/20 relative">
        <div
          class="h-full bg-white/90 rounded-r-full transition-all duration-100 ease-linear"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useClipperState } from '../../composables/useClipperState';

defineOptions({
  name: 'ReelsSafeZoneOverlay'
});

const props = withDefaults(
  defineProps<{
    opacity?: number;
    username?: string;
    caption?: string;
    avatarUrl?: string;
    soundTitle?: string;
    followText?: string;
    progress?: number;
  }>(),
  {
    opacity: 100,
    username: '',
    caption: '',
    avatarUrl: '',
    soundTitle: '',
    followText: 'Follow',
    progress: undefined
  }
);

const state = useClipperState();

const avatarFallback = ref(false);

const fallbackAvatar =
  'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/d7f7b88ae256b2b09fd043a8bea92472~tplv-tiktokx-cropcenter:720:720.jpeg?dr=14579&refresh_token=42351ee0&x-expires=1791025200&x-signature=CIGbvjRlAwCvlcWIUhMtuMXlXUo%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2';

// Dynamic Data Resolution
const progressPercent = computed(() => {
  if (typeof props.progress === 'number') {
    return Math.min(100, Math.max(0, props.progress));
  }
  const current = state.currentTime?.value || 0;
  const duration = state.timelineDuration?.value || 0;
  if (duration <= 0) return 40;
  return Math.min(100, Math.max(0, (current / duration) * 100));
});

const displayUsername = computed(() => {
  if (props.username) return props.username;
  return 'yonru.clip';
});

const displayCaption = computed(() => {
  if (props.caption) return props.caption;
  const theme = state.activeHook?.value?.theme;
  if (theme) {
    return `${theme} #reels #viral #yonruclip`;
  }
  return 'Lütfen müziğin sesini kısma ... #reels #viral #yonruclip';
});

const displayAvatar = computed(() => {
  if (avatarFallback.value) return fallbackAvatar;
  if (props.avatarUrl) return props.avatarUrl;
  return state.activeHook?.value?.thumbnail_url || fallbackAvatar;
});

const displaySoundTitle = computed(() => {
  if (props.soundTitle) return props.soundTitle;
  const rawTitle = state.videoTitle?.value || 'yonru.clip';
  return `Original audio - ${rawTitle}`;
});

const onAvatarError = () => {
  avatarFallback.value = true;
};
</script>

<style scoped>
.reels-page-layout {
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter',
    'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@keyframes reelsMarquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.marquee-track {
  display: inline-flex;
  animation: reelsMarquee 12s linear infinite;
}
</style>
