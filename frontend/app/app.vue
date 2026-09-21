<template>
  <div
    class="h-screen bg-[#060608] text-slate-300 font-sans flex flex-col overflow-hidden selection:bg-accent-500/30"
  >
    <!-- Top Route Progress Bar -->
    <NuxtLoadingIndicator
      v-if="showLoadingIndicator"
      :height="3"
      color="linear-gradient(to right, #CFFF50, #9eff00)"
      :throttle="0"
    />

    <!-- Page Content -->
    <NuxtErrorBoundary>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <template #error="{ error, clearError }">
        <div class="flex-1 flex items-center justify-center bg-red-950/50 p-8">
          <div
            class="max-w-xl bg-surface-panel border border-red-500/30 rounded-2xl p-8 text-center"
          >
            <Icon
              name="ri:error-warning-fill"
              class="text-5xl text-red-500 mb-4"
            />
            <h2
              class="text-xl font-black text-red-400 uppercase tracking-wider mb-2"
            >
              Page Crash
            </h2>
            <p class="text-sm text-slate-400 mb-4">
              A runtime error prevented this page from loading:
            </p>
            <pre
              class="text-left bg-black/50 border border-red-500/20 rounded-xl p-4 text-xs text-red-300 overflow-auto max-h-48 mb-6 font-mono"
              >{{ error }}</pre
            >
            <button
              class="bg-accent-500 text-black px-6 py-2 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-accent-400 transition-all"
              @click="clearError"
            >
              Clear & Retry
            </button>
          </div>
        </div>
      </template>
    </NuxtErrorBoundary>

    <!-- Editor Transition Overlay (Global) -->
    <Transition
      enter-active-class="transition duration-300 ease-in-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-300 ease-in-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="state.isNavigatingToEditor.value"
        class="fixed inset-0 z-[99999] bg-[#060608]/90 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden select-none"
      >
        <div
          class="absolute inset-0 bg-noise opacity-[0.015] mix-blend-overlay pointer-events-none"
        />

        <!-- Micro Brand Mark with Sleek Spinner Ring -->
        <div
          class="relative flex items-center justify-center w-14 h-14 mb-6 z-10"
        >
          <div
            class="w-14 h-14 rounded-full border-[1.5px] border-white/10 border-t-accent-500 animate-spin absolute inset-0"
          />
          <div
            class="w-8 h-8 rounded-[7px] bg-accent-500 flex items-center justify-center text-black font-black text-xs shadow-[0_0_16px_rgba(207,255,80,0.15)] relative z-10"
          >
            Y
          </div>
        </div>

        <template
          v-if="!state.hdReady.value && state.downloadPercent.value < 100"
        >
          <h2
            class="text-sm font-semibold text-white tracking-tight mb-1.5 relative z-10"
          >
            Preparing Video Assets
          </h2>
          <p class="text-slate-400 font-mono text-xs relative z-10 mb-4">
            Caching high-resolution 1080p source...
          </p>
          <div
            class="w-56 bg-white/[0.08] rounded-full h-1.5 overflow-hidden relative z-10 p-0 mb-2"
          >
            <div
              class="h-full bg-accent-500 rounded-full transition-all duration-300"
              :style="{ width: `${state.downloadPercent.value}%` }"
            />
          </div>
          <span class="text-slate-500 font-mono text-[11px] relative z-10">
            <span class="text-accent-500 font-semibold"
              >{{ state.downloadPercent.value }}%</span
            >
            completed
          </span>
        </template>
        <template v-else>
          <h2
            class="text-sm font-semibold text-white tracking-tight mb-1.5 relative z-10"
          >
            Initializing Editor
          </h2>
          <p class="text-slate-400 text-xs relative z-10">
            Loading timeline & media assets...
          </p>
        </template>
      </div>
    </Transition>

    <!-- Toast Notifications -->
    <div
      class="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
    >
      <Transition
        enter-active-class="transition duration-500 ease-out transform"
        enter-from-class="translate-y-4 opacity-0 scale-95"
        enter-to-class="translate-y-0 opacity-100 scale-100"
        leave-active-class="transition duration-300 ease-in transform"
        leave-from-class="translate-y-0 opacity-100 scale-100"
        leave-to-class="translate-y-4 opacity-0 scale-95"
      >
        <div
          v-if="state.toast.value"
          class="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl min-w-[300px]"
          :class="[
            state.toast.value.type === 'success'
              ? 'bg-accent-500/10 border-accent-500/20 text-accent-500'
              : state.toast.value.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-500'
                : 'bg-white/10 border-white/20 text-white',
          ]"
        >
          <Icon
            :name="
              state.toast.value.type === 'success'
                ? 'ri:checkbox-circle-fill'
                : 'ri:error-warning-fill'
            "
            class="text-xl shrink-0"
          />
          <span class="text-sm font-bold tracking-wide uppercase">{{
            state.toast.value.message
          }}</span>
        </div>
      </Transition>
    </div>

    <!-- Global Spotlight Command Palette -->
    <CommandPaletteModal />

    <!-- Hidden Font Preloader -->
    <div class="font-preloader" aria-hidden="true">
      <span class="font-p-montserrat">a</span>
      <span class="font-p-inter">a</span>
      <span class="font-p-bebas">a</span>
      <span class="font-p-oswald">a</span>
      <span class="font-p-poppins">a</span>
      <span class="font-p-outfit">a</span>
      <span class="font-p-noto">a</span>
      <span class="font-p-roboto">a</span>
      <span class="font-p-playfair">a</span>
      <span class="font-p-anton">a</span>
      <span class="font-p-bangers">a</span>
      <span class="font-p-marker">a</span>
      <span class="font-p-russo">a</span>
      <span class="font-p-teko">a</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const state = useClipperState();

// Track unique routes visited in this session to show progress bar only on first visit
const visitedRoutes = ref(new Set<string>());
const showLoadingIndicator = ref(true);

if (import.meta.client) {
  if (route.path && !route.path.startsWith("/editor")) {
    visitedRoutes.value.add(route.path);
  }

  router.beforeEach((to) => {
    if (to.path.startsWith("/editor")) {
      showLoadingIndicator.value = false;
      return;
    }
    if (!visitedRoutes.value.has(to.path)) {
      visitedRoutes.value.add(to.path);
      showLoadingIndicator.value = true;
    } else {
      showLoadingIndicator.value = false;
    }
  });
}

onMounted(() => {
  state.initPersistence();
});
</script>

<style>
.nuxt-loading-indicator {
  box-shadow:
    0 0 10px rgba(207, 255, 80, 0.7),
    0 0 5px rgba(207, 255, 80, 0.4) !important;
}
</style>
