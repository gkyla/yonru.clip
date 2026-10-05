<template>
  <div
    class="mobile-preview-player tiktok-page-layout absolute inset-0 pointer-events-none select-none z-[60] overflow-hidden flex flex-col justify-between transition-opacity duration-200"
    :style="{ opacity: (opacity ?? 100) / 100 }"
  >
    <!-- Subtle Contrast Vignettes (Top & Bottom) -->
    <div
      class="absolute top-0 inset-x-0 h-[290px] bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none"
    ></div>
    <div
      class="absolute bottom-0 inset-x-0 h-[520px] bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none"
    ></div>

    <!-- Header Title Area (Status Bar & Top Navigation Bar calibrated 1:1 for 1080x1920 canvas) -->
    <header
      class="tiktok-header-container w-full flex flex-col items-center shrink-0 z-10 pointer-events-none pt-4"
    >
      <!-- Tier 1: Authentic Mobile Status Bar (110px height) -->
      <div
        class="status-bar-container w-full h-[110px] px-14 flex items-center justify-between pointer-events-none select-none"
      >
        <!-- Time (9:41) -->
        <div
          class="status-time text-[46px] font-semibold text-white tracking-tight"
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

      <!-- Tier 2: Top Navigation Bar (LIVE, Following, For You, Search) (130px height) -->
      <div
        class="home-nav-bar-container w-full h-[130px] px-14 flex items-center justify-between pointer-events-none select-none"
      >
        <!-- LIVE Broadcast Button -->
        <div class="live-button flex items-center gap-3 cursor-pointer">
          <svg
            class="w-[52px] h-[52px]"
            width="52"
            height="52"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="2"
              y="5"
              width="24"
              height="18"
              rx="4"
              stroke="white"
              stroke-width="2.5"
            />
            <circle cx="14" cy="14" r="3" fill="white" />
            <path
              d="M10 11C9.33 11.83 9 12.87 9 14C9 15.13 9.33 16.17 10 17"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
            />
            <path
              d="M18 11C18.67 11.83 19 12.87 19 14C19 15.13 18.67 16.17 18 17"
              stroke="white"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span class="text-[34px] font-bold tracking-wider text-white"
            >LIVE</span
          >
        </div>

        <!-- Center Tabs: Following & For You -->
        <div class="nav-tabs flex items-center gap-12">
          <div
            class="tab-following text-[50px] font-semibold text-white/75 tracking-tight cursor-pointer"
          >
            Following
          </div>
          <div
            class="tab-foryou relative flex flex-col items-center cursor-pointer"
          >
            <span class="text-[54px] font-bold text-white tracking-tight"
              >For You</span
            >
            <!-- Authentic White Pill Underline Active Indicator -->
            <div
              class="active-indicator w-16 h-2 bg-white rounded-full mt-2"
            ></div>
          </div>
        </div>

        <!-- Search Icon Button -->
        <div
          class="search-button flex items-center justify-center cursor-pointer"
        >
          <svg
            class="w-[52px] h-[52px]"
            width="52"
            height="52"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.5 21C17.1944 21 21 17.1944 21 12.5C21 7.80558 17.1944 4 12.5 4C7.80558 4 4 7.80558 4 12.5C4 17.1944 7.80558 21 12.5 21Z"
              stroke="white"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M19 19L24.5 24.5"
              stroke="white"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
    </header>

    <!-- Video Overlay Container (Metadata & Right Sidebar) positioned at the bottom of the screen -->
    <div
      class="video-overlay-container absolute inset-x-0 bottom-7 pointer-events-none z-10 flex flex-col justify-end"
    >
      <div
        class="sidebar-metadata-container w-full pl-10 pr-6 pb-2 flex items-end justify-between relative"
      >
        <!-- Meta Data (Username, Caption, Tags, Sound Marquee) from Figma Specs -->
        <div
          class="meta-data max-w-[760px] flex flex-col gap-3 text-white z-10 pb-1"
        >
          <div class="meta-data-top flex flex-col gap-2.5">
            <!-- Username Container -->
            <div class="username-container flex items-center gap-2">
              <div
                class="username text-[44px] font-bold tracking-tight text-white"
              >
                @{{ displayUsername }}
              </div>
            </div>

            <!-- Caption Container -->
            <div
              class="caption text-[38px] font-normal leading-snug text-white/95 line-clamp-3"
            >
              {{ displayCaption }}
            </div>

            <!-- Tags Container -->
            <div class="tags-container"></div>

            <!-- Sound Container with Infinite Scrolling Marquee -->
            <div
              class="sound-container flex items-center gap-3 text-[34px] font-medium text-white/95 mt-0.5"
            >
              <!-- Authentic Figma Music Note Icon (Node 1:277) -->
              <div
                class="music-icon shrink-0 text-white flex items-center justify-center"
              >
                <svg
                  class="w-7 h-6"
                  viewBox="0 0 13 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M12.4763 8.18432C12.4794 8.48135 12.4952 8.78279 12.4384 9.07541C12.2486 10.0495 11.1021 10.7086 9.74401 10.6476C8.92686 10.6115 8.34362 10.3281 8.02662 9.77799C7.64657 9.11577 7.99183 8.39034 8.84618 8.02438C9.36924 7.80063 9.95583 7.72362 10.5341 7.63102C11.3264 7.50424 11.4106 7.4352 11.4018 6.84183C11.3846 5.68703 11.362 4.53237 11.3421 3.37814C11.3416 3.34354 11.3411 3.30829 11.3379 3.27373C11.312 3.02466 11.1943 2.95963 10.8591 3.01438C9.66748 3.20655 5.86123 3.8188 5.14836 3.93079C4.70203 4.00138 4.62329 4.07099 4.62598 4.40786C4.64 6.20719 4.66035 8.00627 4.66803 9.80502C4.66917 10.0263 4.63959 10.2527 4.57547 10.469C4.32505 11.3126 3.52262 11.8385 2.31842 11.9733C1.65844 12.0468 1.05092 11.9798 0.557365 11.6305C-0.313699 11.0153 -0.136109 9.86899 0.897014 9.3969C1.42166 9.15683 2.01336 9.05622 2.60505 8.95432C2.76403 8.92673 2.92205 8.89459 3.07731 8.85857C3.4257 8.77688 3.60263 8.6015 3.60453 8.33574C3.60536 8.05823 3.60619 7.78074 3.6034 7.50327C3.58083 5.67414 3.55737 3.84551 3.53481 2.01705C3.52814 1.51699 3.71953 1.3388 4.38802 1.22477C6.6455 0.840149 8.9022 0.455535 11.1605 0.0728554C11.3592 0.0395199 11.5617 0.0133154 11.7643 0.00147326C12.0457 -0.0140292 12.2563 0.0948143 12.3215 0.294397C12.3639 0.42311 12.3793 0.558707 12.3811 0.691232C12.4027 2.03923 12.4665 7.03454 12.4764 8.18422L12.4763 8.18432Z"
                    fill="white"
                  />
                </svg>
              </div>

              <!-- Sound Marquee Track -->
              <div
                class="sound overflow-hidden w-[540px] whitespace-nowrap relative"
              >
                <div class="marquee inline-flex gap-10 marquee-track">
                  <p class="inline-block">{{ displaySoundTitle }}</p>
                  <p class="inline-block">{{ displaySoundTitle }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Overlay Sidebar (Avatar, Follow, Interaction Vectors, Vinyl Disc) from Figma Specs -->
        <div
          class="overlay-sidebar flex flex-col items-center gap-11 z-10 shrink-0"
        >
          <!-- Avatar Container (Figma 47px -> 136px) -->
          <div class="avatar-container relative w-[136px] h-[136px] mb-2">
            <img
              :src="displayAvatar"
              alt="creator avatar"
              class="avatar w-full h-full rounded-full border-[3.5px] border-white object-cover bg-neutral-800"
              crossorigin="anonymous"
              @error="onAvatarError"
            />
            <!-- Follow Button (Figma Node 1:328 & 1:329) -->
            <img
              :src="followBtnSrc"
              alt="follow button"
              class="follow-btn absolute -bottom-3 left-1/2 -translate-x-1/2 w-[54px] h-[54px] rounded-full pointer-events-none"
              crossorigin="anonymous"
            />
          </div>

          <!-- Interaction Column: Crisp Vector SVGs calibrated 1:1 to official TikTok interaction.png -->
          <div class="interaction-column flex flex-col items-center gap-[54px]">
            <!-- 1. Like Action (Heart: 44x41 in interaction.png -> 90x84px) -->
            <div
              class="action-item flex flex-col items-center gap-2 cursor-pointer"
            >
              <svg
                class="w-[90px] h-[84px]"
                viewBox="0 0 36 33"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M18.0001 33C17.5032 33 17.008 32.8148 16.601 32.4426C15.1578 31.1408 13.7587 29.8863 12.4952 28.8169C8.88641 25.6106 5.72871 22.8671 3.56297 20.1709C1.12775 17.1498 0 14.2685 0 11.1549C0 8.08658 0.99206 5.29766 2.84229 3.25352C4.69253 1.16197 7.26344 0 10.0599 0C12.1357 0 14.03 0.697183 15.6987 1.99896C16.555 2.69615 17.3233 3.48592 18 4.46272C18.6767 3.48592 19.4432 2.69615 20.3013 1.99896C21.97 0.65182 23.8643 0 25.9401 0C28.7366 0 31.2635 1.16197 33.1577 3.25352C35.0079 5.29785 36 8.1338 36 11.1549C36 14.3159 34.8722 17.1498 32.437 20.1709C30.2714 22.867 27.1136 25.6085 23.5048 28.8169C22.2872 29.8863 20.844 31.1408 19.399 32.4426C18.992 32.8148 18.4968 33 17.9999 33H18.0001Z"
                  fill="white"
                />
              </svg>
              <span class="text-[30px] font-bold text-white tracking-tight">
                1.3M
              </span>
            </div>

            <!-- 2. Comment Action (Chat Bubble: 44x43 in interaction.png -> 90x88px) -->
            <div
              class="action-item flex flex-col items-center gap-2 cursor-pointer"
            >
              <svg
                class="w-[90px] h-[88px]"
                viewBox="0 0 35 34"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M35 15C35 17.2267 34.4339 19.3401 33.4185 21.2402C33.4103 21.2616 33.4013 21.283 33.3913 21.3043C31.514 25.3271 28.3888 28.6368 24.48 30.7415L20.1269 33.0855C19.0105 33.6867 17.6765 32.7936 17.807 31.5323L17.9661 29.9948C17.8112 29.9983 17.6558 30 17.5 30C7.83502 30 0 23.2843 0 15C0 6.71573 7.83502 0 17.5 0C27.165 0 35 6.71573 35 15ZM8.5 18C9.88071 18 11 16.8807 11 15.5C11 14.1193 9.88071 13 8.5 13C7.11929 13 6 14.1193 6 15.5C6 16.8807 7.11929 18 8.5 18ZM20 15.5C20 16.8807 18.8807 18 17.5 18C16.1193 18 15 16.8807 15 15.5C15 14.1193 16.1193 13 17.5 13C18.8807 13 20 14.1193 20 15.5ZM26.5 18C27.8807 18 29 16.8807 29 15.5C29 14.1193 27.8807 13 26.5 13C25.1193 13 24 14.1193 24 15.5C24 16.8807 25.1193 18 26.5 18Z"
                  fill="white"
                />
              </svg>
              <span class="text-[30px] font-bold text-white tracking-tight">
                10.7M
              </span>
            </div>

            <!-- 3. Bookmark / Favorite Action (Ribbon: 34x38 in interaction.png -> 70x78px) -->
            <div
              class="action-item flex flex-col items-center gap-2 cursor-pointer"
            >
              <svg
                class="w-[70px] h-[78px]"
                viewBox="0 0 34 38"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 0C1.79 0 0 1.79 0 4V36.5C0 37.65 1.34 38.29 2.24 37.58L17 27.6L31.76 37.58C32.66 38.29 34 37.65 34 36.5V4C34 1.79 32.21 0 30 0H4Z"
                  fill="white"
                />
              </svg>
              <span class="text-[30px] font-bold text-white tracking-tight">
                125.4K
              </span>
            </div>

            <!-- 4. Share Action (Curved Arrow: 46x36 in interaction.png -> 94x74px) -->
            <div
              class="action-item flex flex-col items-center gap-2 cursor-pointer"
            >
              <svg
                class="w-[94px] h-[74px]"
                viewBox="0 0 35 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M34.4853 15.237L22.2346 27.4877C21.7342 27.9881 20.9828 28.1375 20.3281 27.8667C19.6752 27.596 19.2486 26.9578 19.2486 26.2507V21.0283C7.5918 21.4254 3.02089 25.7026 2.97511 25.7484H2.97347C2.42057 26.2865 1.57893 26.3981 0.902972 26.024C0.227016 25.6483 -0.124065 24.8755 0.0399885 24.1209C0.0760824 23.9552 3.76425 8.17706 19.2485 7.06153V1.74931C19.2485 1.04219 19.675 0.403996 20.328 0.133261C20.9826 -0.137444 21.7341 0.0118548 22.2345 0.512248L34.4852 12.7629C34.8133 13.0911 34.9987 13.5357 34.9987 14C34.9987 14.4643 34.8133 14.9089 34.4852 15.237L34.4853 15.237Z"
                  fill="white"
                />
              </svg>
              <span class="text-[30px] font-bold text-white tracking-tight">
                30.9K
              </span>
            </div>

            <!-- Compatibility element for CDN image fallback test suite -->
            <img
              v-if="showLegacyInteraction"
              :src="interactionSrc"
              alt="interaction"
              class="hidden"
              crossorigin="anonymous"
              @error="showLegacyInteraction = false"
            />
          </div>

          <!-- Music Cover Container (Figma 48.5px -> 136px Animated Vinyl Disc) -->
          <div
            class="music-cover-container relative w-[136px] h-[136px] rounded-full bg-[#111] border-[8px] border-[#222] flex items-center justify-center spinning-vinyl mt-2"
          >
            <!-- Vinyl Inner Concentric Grooves -->
            <div
              class="absolute inset-2.5 rounded-full border border-white/10 pointer-events-none"
            ></div>
            <div
              class="absolute inset-5 rounded-full border border-white/5 pointer-events-none"
            ></div>
            <!-- Center Album Artwork -->
            <div
              class="w-[68px] h-[68px] rounded-full overflow-hidden bg-black flex items-center justify-center"
            >
              <img
                :src="displayAvatar"
                alt="sound cover"
                class="w-full h-full object-cover"
                crossorigin="anonymous"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useClipperState } from '../../composables/useClipperState';

defineOptions({
  name: 'TikTokSafeZoneOverlay'
});

const props = withDefaults(
  defineProps<{
    opacity?: number;
    username?: string;
    caption?: string;
    avatarUrl?: string;
    soundTitle?: string;
  }>(),
  {
    opacity: 100,
    username: '',
    caption: '',
    avatarUrl: '',
    soundTitle: ''
  }
);

const state = useClipperState();

const avatarFallback = ref(false);
const showLegacyInteraction = ref(true);

// Figma Node 1:328 & 1:329 (Red circle #EA4359 with authentic white plus)
const followBtnSrc =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 21 21" fill="none"><circle cx="10.5" cy="10.5" r="10.5" fill="%23EA4359"/><path d="M14.5 9.5H11.5V6.5C11.5 5.95 11.05 5.5 10.5 5.5C9.95 5.5 9.5 5.95 9.5 6.5V9.5H6.5C5.95 9.5 5.5 9.95 5.5 10.5C5.5 11.05 5.95 11.5 6.5 11.5H9.5V14.5C9.5 15.05 9.95 15.5 10.5 15.5C11.05 15.5 11.5 15.05 11.5 14.5V11.5H14.5C15.05 11.5 15.5 11.05 15.5 10.5C15.5 9.95 15.05 9.5 14.5 9.5Z" fill="white"/></svg>';

const interactionSrc =
  'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/ies/creator_center/static/image/interaction.6ba1e539.png';

const fallbackAvatar =
  'https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/d7f7b88ae256b2b09fd043a8bea92472~tplv-tiktokx-cropcenter:720:720.jpeg?dr=14579&refresh_token=42351ee0&x-expires=1791025200&x-signature=CIGbvjRlAwCvlcWIUhMtuMXlXUo%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2';

// Dynamic Data Resolution
const displayUsername = computed(() => {
  if (props.username) return props.username;
  return 'yonru.clip';
});

const displayCaption = computed(() => {
  if (props.caption) return props.caption;
  const theme = state.activeHook?.value?.theme;
  if (theme) {
    return `${theme} #fyp #viral #yonruclip`;
  }
  return 'Demam tinggi bisa menyebabkan kerusakan sel otak ?#drtirta #infokesehatan #sehat #kesehatan #fyp #myth';
});

const displayAvatar = computed(() => {
  if (avatarFallback.value) return fallbackAvatar;
  if (props.avatarUrl) return props.avatarUrl;
  return state.activeHook?.value?.thumbnail_url || fallbackAvatar;
});

const displaySoundTitle = computed(() => {
  if (props.soundTitle) return props.soundTitle;
  const rawTitle = state.videoTitle?.value || 'yonru.clip';
  return `Original sound - ${rawTitle}`;
});

const onAvatarError = () => {
  avatarFallback.value = true;
};
</script>

<style scoped>
.tiktok-page-layout {
  font-family:
    'TikTok Sans',
    'Proxima Nova',
    -apple-system,
    BlinkMacSystemFont,
    'Inter',
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@keyframes tiktokMarquee {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.marquee-track {
  display: inline-flex;
  animation: tiktokMarquee 12s linear infinite;
}

@keyframes spinSlow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinning-vinyl {
  animation: spinSlow 6s linear infinite;
}
</style>
