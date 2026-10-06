<template>
  <div
    class="mobile-preview-player shorts-page-layout absolute inset-0 pointer-events-none select-none z-[60] overflow-hidden flex flex-col justify-between transition-opacity duration-200"
    :style="{ opacity: (opacity ?? 100) / 100 }"
  >
    <!-- Subtle Contrast Vignettes (Top & Bottom) -->
    <div
      class="absolute top-0 inset-x-0 h-[260px] bg-gradient-to-b from-black/75 via-black/25 to-transparent pointer-events-none"
    ></div>
    <div
      class="absolute bottom-0 inset-x-0 h-[520px] bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
    ></div>

    <!-- Header Title Area (Status Bar & Top Navigation Bar calibrated 1:1 for 1080x1920 canvas) -->
    <header
      class="shorts-header-container w-full flex flex-col items-center shrink-0 z-10 pointer-events-none pt-3"
    >
      <!-- Tier 1: Authentic Mobile Status Bar (85px height calibrated to standard mobile) -->
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

      <!-- Tier 2: YouTube Shorts Top Navigation Bar (115px height, Total Top 200px) -->
      <div
        class="shorts-nav-bar-container w-full h-[115px] px-11 flex items-center justify-between pointer-events-none select-none"
      >
        <!-- Left: Camera Button (Create Shorts) -->
        <div
          class="shorts-camera-button flex items-center justify-center cursor-pointer"
        >
          <svg
            class="w-[48px] h-[48px] text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"
            />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </div>

        <!-- Right Action Group: Search & More 3-dots -->
        <div class="header-right-actions flex items-center gap-7 text-white">
          <!-- Search Icon Button -->
          <div
            class="shorts-search-button flex items-center justify-center cursor-pointer"
          >
            <svg
              class="w-[46px] h-[46px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          <!-- More Options (Vertical 3-dots) Button -->
          <div
            class="shorts-more-button flex items-center justify-center cursor-pointer"
          >
            <svg
              class="w-[46px] h-[46px]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </div>
        </div>
      </div>
    </header>

    <!-- Video Overlay Container (Metadata & Right Action Rail) positioned at the bottom -->
    <div
      class="video-overlay-container absolute inset-x-0 bottom-0 pointer-events-none z-10 flex flex-col justify-end"
    >
      <div
        class="sidebar-metadata-container w-full px-11 pb-7 flex items-end justify-between relative"
      >
        <!-- Bottom Left: Channel Metadata & Title/Sound Info -->
        <div
          class="meta-data max-w-[760px] flex flex-col gap-3.5 text-white z-10"
        >
          <!-- Creator Channel & Subscribe Row -->
          <div class="channel-info-row flex items-center gap-3.5">
            <!-- Channel Avatar (calibrated with Yonru logo fallback) -->
            <div class="avatar-container relative w-[76px] h-[76px] shrink-0">
              <div
                class="w-full h-full rounded-full border-2 border-white/20 overflow-hidden bg-[#09090B] flex items-center justify-center p-2.5 shadow-md"
              >
                <img
                  :src="displayAvatar"
                  alt="channel avatar"
                  class="avatar w-full h-full object-contain"
                  crossorigin="anonymous"
                  @error="onAvatarError"
                />
              </div>
            </div>

            <!-- Channel Handle -->
            <div
              class="channel-handle text-[36px] font-bold tracking-tight text-white drop-shadow-md truncate max-w-[380px]"
            >
              {{ displayUsername }}
            </div>

            <!-- Authentic Red Subscribe Pill Button -->
            <div
              class="subscribe-button px-5 py-2.5 rounded-full bg-[#CC0000] text-white text-[26px] font-bold tracking-wide shadow-lg flex items-center justify-center shrink-0 cursor-pointer"
            >
              {{ displaySubscribeText }}
            </div>
          </div>

          <!-- Video Title / Caption -->
          <div
            class="caption text-[34px] font-normal leading-snug text-white/95 line-clamp-2 drop-shadow-md"
          >
            {{ displayCaption }}
          </div>

          <!-- Sound / Audio Tag Track -->
          <div
            class="sound-container flex items-center gap-3 text-[30px] font-medium text-white/90 drop-shadow-md"
          >
            <!-- Music Note Icon -->
            <div
              class="music-icon shrink-0 text-white flex items-center justify-center"
            >
              <svg
                class="w-[30px] h-[30px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>

            <!-- Sound Title (Scrolling / Truncated) -->
            <div
              class="sound-title overflow-hidden w-[540px] whitespace-nowrap relative"
            >
              <span class="truncate block">{{ displaySoundTitle }}</span>
            </div>
          </div>
        </div>

        <!-- Bottom Right: YouTube Shorts Action Rail Stack (Thumbs Up, Dislike, Comments, Share, Remix, Audio Cover) -->
        <div
          class="overlay-sidebar flex flex-col items-center gap-[30px] z-10 shrink-0 pb-1"
        >
          <!-- 1. Like Button (Thumbs Up) -->
          <div
            class="action-item flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              class="icon-wrapper w-[64px] h-[64px] flex items-center justify-center"
            >
              <svg
                class="w-[52px] h-[52px] text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayLikes }}
            </span>
          </div>

          <!-- 2. Dislike Button (Thumbs Down) -->
          <div
            class="action-item flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              class="icon-wrapper w-[64px] h-[64px] flex items-center justify-center"
            >
              <svg
                class="w-[52px] h-[52px] text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"
                />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayDislikesText }}
            </span>
          </div>

          <!-- 3. Comments Button -->
          <div
            class="action-item flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              class="icon-wrapper w-[64px] h-[64px] flex items-center justify-center"
            >
              <svg
                class="w-[52px] h-[52px] text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayComments }}
            </span>
          </div>

          <!-- 4. Share Button -->
          <div
            class="action-item flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              class="icon-wrapper w-[64px] h-[64px] flex items-center justify-center"
            >
              <svg
                class="w-[52px] h-[52px] text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m15 14 5-5-5-5" />
                <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayShareText }}
            </span>
          </div>

          <!-- 5. Remix Button -->
          <div
            class="action-item flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              class="icon-wrapper w-[64px] h-[64px] flex items-center justify-center"
            >
              <svg
                class="w-[52px] h-[52px] text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayRemixText }}
            </span>
          </div>

          <!-- 6. Audio Thumbnail Box -->
          <div
            class="audio-cover-box relative w-[72px] h-[72px] rounded-xl overflow-hidden border-[2.5px] border-white/80 bg-[#09090B] flex items-center justify-center shadow-lg mt-1"
          >
            <img
              :src="displayAudioCover"
              alt="audio track thumbnail"
              class="w-full h-full object-cover"
              crossorigin="anonymous"
            />
          </div>
        </div>
      </div>

      <!-- Tier 3: Signature YouTube Red Scrubber Progress Line (4px height) -->
      <div
        class="shorts-progress-bar w-full h-[5px] bg-white/25 relative overflow-hidden pointer-events-none"
      >
        <div
          class="h-full bg-[#CC0000] transition-all duration-100 ease-linear"
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
  name: 'YouTubeShortsSafeZoneOverlay'
});

const yonruLogo = '/favicon.svg';

interface Props {
  opacity?: number;
  username?: string;
  caption?: string;
  soundTitle?: string;
  avatarUrl?: string;
  progress?: number;
  likes?: string;
  dislikesText?: string;
  comments?: string;
  shareText?: string;
  remixText?: string;
  subscribeText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  opacity: 100,
  username: '@yonru.clip',
  caption: '',
  soundTitle: '',
  avatarUrl: '',
  progress: undefined,
  likes: '120 rb',
  dislikesText: 'Dislike',
  comments: '1.428',
  shareText: 'Share',
  remixText: 'Remix',
  subscribeText: 'Subscribe'
});

const state = useClipperState();
const avatarFallback = ref(false);

const progressPercent = computed(() => {
  if (typeof props.progress === 'number') {
    return Math.min(100, Math.max(0, props.progress));
  }
  const current = state.currentTime?.value || 0;
  const duration = state.timelineDuration?.value || 0;
  if (duration <= 0) return 35;
  return Math.min(100, Math.max(0, (current / duration) * 100));
});

const displayUsername = computed(() => {
  if (props.username) return props.username;
  return '@yonru.clip';
});

const displayCaption = computed(() => {
  if (props.caption) return props.caption;
  const theme = state.activeHook?.value?.theme;
  if (theme) {
    return `${theme} #shorts #viral #yonruclip`;
  }
  return 'Rahasia Meningkatkan Fokus dan Produktivitas Otak #shorts #tips #fokus';
});

const displayAvatar = computed(() => {
  if (avatarFallback.value) return yonruLogo;
  if (props.avatarUrl) return props.avatarUrl;
  return yonruLogo;
});

const displayAudioCover = computed(() => {
  return state.activeHook?.value?.thumbnail_url || yonruLogo;
});

const displaySoundTitle = computed(() => {
  if (props.soundTitle) return props.soundTitle;
  const rawTitle = state.videoTitle?.value || 'yonru.clip';
  return `Original audio - ${rawTitle}`;
});

const displayLikes = computed(() => props.likes || '120 rb');
const displayDislikesText = computed(() => props.dislikesText || 'Dislike');
const displayComments = computed(() => props.comments || '1.428');
const displayShareText = computed(() => props.shareText || 'Share');
const displayRemixText = computed(() => props.remixText || 'Remix');
const displaySubscribeText = computed(() => props.subscribeText || 'Subscribe');

const onAvatarError = () => {
  avatarFallback.value = true;
};
</script>

<style scoped>
.shorts-page-layout {
  font-family:
    'YouTube Sans',
    'Roboto',
    -apple-system,
    BlinkMacSystemFont,
    'Inter',
    'Segoe UI',
    Helvetica,
    Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
