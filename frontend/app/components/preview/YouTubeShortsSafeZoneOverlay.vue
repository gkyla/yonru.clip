<template>
  <div
    class="mobile-preview-player shorts-page-layout absolute inset-0 pointer-events-none select-none z-[60] overflow-hidden flex flex-col justify-between transition-opacity duration-200"
    :style="{ opacity: (opacity ?? 100) / 100 }"
  >
    <!-- Subtle Contrast Vignettes (Top & Bottom) -->
    <div
      class="absolute top-0 inset-x-0 h-[280px] bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none"
    ></div>
    <div
      class="absolute bottom-0 inset-x-0 h-[520px] bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
    ></div>

    <!-- Header Title Area (Status Bar, Top Controls & Category Chips calibrated 1:1) -->
    <header
      class="shorts-header-container w-full flex flex-col items-center shrink-0 z-10 pointer-events-none pt-3 gap-2"
    >
      <!-- Tier 1: Authentic Mobile Status Bar (85px height calibrated to Vivo V29 & unified across platforms) -->
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

      <!-- Tier 2: YouTube Shorts Top Navigation Bar ("Shorts" + Speaker + Search + 3-dots) -->
      <div
        class="shorts-nav-bar-container w-full h-[95px] px-11 flex items-center justify-between pointer-events-none select-none"
      >
        <!-- Left: "Shorts" Bold Header Title -->
        <div class="shorts-title-brand flex items-center">
          <span
            class="text-[52px] font-bold text-white tracking-tight drop-shadow-md"
          >
            Shorts
          </span>
        </div>

        <!-- Right Action Group: Speaker Mute + Search + More Options (3-dots) -->
        <div class="header-right-actions flex items-center gap-7 text-white">
          <!-- Audio / Speaker Toggle Button -->
          <div
            class="shorts-speaker-button flex items-center justify-center cursor-pointer"
          >
            <svg
              class="w-[48px] h-[48px] text-white drop-shadow-md"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          </div>

          <!-- Search Icon Button -->
          <div
            class="shorts-search-button flex items-center justify-center cursor-pointer"
          >
            <svg
              class="w-[46px] h-[46px] text-white drop-shadow-md"
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
              class="w-[46px] h-[46px] text-white drop-shadow-md"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <circle cx="12" cy="5" r="2.2" />
              <circle cx="12" cy="12" r="2.2" />
              <circle cx="12" cy="19" r="2.2" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Tier 3: Category Carousel Chips Bar ([Subscription], [Live], [Lens]) (Option A) -->
      <div
        class="shorts-chips-carousel w-full px-11 flex items-center gap-3 overflow-hidden pointer-events-none select-none pt-1"
      >
        <!-- Subscription Chip -->
        <div
          class="chip-item flex items-center gap-2.5 px-5 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-sm"
        >
          <!-- Subscription Play Box Icon -->
          <svg
            class="w-[28px] h-[28px]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-10 9V11l5 2.5-5 2.5z"
            />
          </svg>
          <span class="text-[26px] font-semibold text-white/95"
            >Subscription</span
          >
        </div>

        <!-- Live Chip -->
        <div
          class="chip-item flex items-center gap-2.5 px-5 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-sm"
        >
          <!-- Live ((•)) Broadcast Icon -->
          <svg
            class="w-[28px] h-[28px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path
              d="M4.93 4.93a10 10 0 0 0 0 14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 7.76a6 6 0 0 0 0 8.48M16.24 7.76a6 6 0 0 1 0 8.48M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
            />
          </svg>
          <span class="text-[26px] font-semibold text-white/95">Live</span>
        </div>

        <!-- Lens Chip -->
        <div
          class="chip-item flex items-center gap-2.5 px-5 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white shadow-sm"
        >
          <!-- Google Lens Camera Icon -->
          <svg
            class="w-[28px] h-[28px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
          >
            <path
              d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"
              stroke-linecap="round"
            />
            <circle cx="12" cy="12" r="3.5" />
          </svg>
          <span class="text-[26px] font-semibold text-white/95">Lens</span>
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
          class="meta-data max-w-[760px] flex flex-col gap-3 text-white z-10"
        >
          <!-- Creator Channel & Modern White Subscribe Button Row -->
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

            <!-- Authentic Modern White Subscribe Pill Button -->
            <div
              class="subscribe-button px-5 py-2 rounded-full bg-white text-black text-[26px] font-bold tracking-tight shadow-md flex items-center justify-center shrink-0 cursor-pointer"
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

          <!-- Modern Translucent Audio Pill Tag (♪ Surface • Aero Chord) -->
          <div
            class="sound-pill-container inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 drop-shadow-md max-w-[560px] w-fit"
          >
            <!-- Music Note Icon -->
            <div
              class="music-icon shrink-0 text-white flex items-center justify-center"
            >
              <svg
                class="w-[26px] h-[26px]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </svg>
            </div>

            <!-- Sound Title (Truncated) -->
            <div
              class="sound-title overflow-hidden whitespace-nowrap text-[26px] font-medium text-white/95"
            >
              <span class="truncate block">{{ displaySoundTitle }}</span>
            </div>
          </div>
        </div>

        <!-- Bottom Right: Modern Action Rail Stack (Heart, Comment, Simpan, Bagikan, Remix, Audio Cover) -->
        <div
          class="overlay-sidebar flex flex-col items-center gap-[28px] z-10 shrink-0 pb-1"
        >
          <!-- 1. Heart (Like) Button -->
          <div
            class="action-item heart-action flex flex-col items-center gap-1 cursor-pointer"
          >
            <div
              class="icon-wrapper w-[64px] h-[64px] flex items-center justify-center"
            >
              <svg
                class="w-[54px] h-[54px] text-white drop-shadow-md"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayLikes }}
            </span>
          </div>

          <!-- 2. Comment Button (with 2 inner horizontal lines) -->
          <div
            class="action-item comment-action flex flex-col items-center gap-1 cursor-pointer"
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
                <line x1="8" y1="8" x2="16" y2="8" stroke-width="2.2" />
                <line x1="8" y1="12" x2="13" y2="12" stroke-width="2.2" />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayComments }}
            </span>
          </div>

          <!-- 3. Simpan / Bookmark Button -->
          <div
            class="action-item save-action flex flex-col items-center gap-1 cursor-pointer"
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
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displaySaveText }}
            </span>
          </div>

          <!-- 4. Bagikan / Share Button -->
          <div
            class="action-item share-action flex flex-col items-center gap-1 cursor-pointer"
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

          <!-- 5. Remix Button (Circular loop cycle arrows) -->
          <div
            class="action-item remix-action flex flex-col items-center gap-1 cursor-pointer"
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
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <polyline points="3 3 3 8 8 8" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <polyline points="16 16 21 16 21 21" />
              </svg>
            </div>
            <span
              class="action-label text-[24px] font-semibold text-white tracking-tight drop-shadow-md"
            >
              {{ displayRemixText }}
            </span>
          </div>

          <!-- 6. Audio Thumbnail Box (Rounded squircle container calibrated to YouTube Shorts) -->
          <div
            class="audio-cover-box relative w-[76px] h-[76px] rounded-[22px] overflow-hidden border-[3px] border-white/90 bg-[#09090B] flex items-center justify-center shadow-lg mt-1"
          >
            <img
              :src="displayAudioCover"
              alt="audio track thumbnail"
              class="w-full h-full object-cover rounded-[18px]"
              crossorigin="anonymous"
            />
          </div>
        </div>
      </div>

      <!-- Tier 4: Signature YouTube Red Scrubber Progress Line (4px height) -->
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
  comments?: string;
  saveText?: string;
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
  likes: '84 rb',
  comments: '3.621',
  saveText: 'Simpan',
  shareText: 'Bagikan',
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
    return `"${theme}" #pcgaming #benchmark #shorts #yonruclip`;
  }
  return 'And yes my school pc indeed has a flipping RTX 3060 #pcgaming #benchmark #shorts';
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
  const rawTitle = state.videoTitle?.value;
  if (rawTitle) {
    return `Surface • ${rawTitle}`;
  }
  return 'Surface • Aero Chord';
});

const displayLikes = computed(() => props.likes || '84 rb');
const displayComments = computed(() => props.comments || '3.621');
const displaySaveText = computed(() => props.saveText || 'Simpan');
const displayShareText = computed(() => props.shareText || 'Bagikan');
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
