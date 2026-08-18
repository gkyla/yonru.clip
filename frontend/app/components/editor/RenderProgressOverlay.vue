<template>
  <Transition
    enter-active-class="transition duration-500 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-300 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-show="state?.renderStatus?.value === 'rendering'"
      class="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white"
    >
      <div class="relative mb-8">
        <div
          class="w-24 h-24 rounded-full border-4 border-accent-500/20 border-t-accent-500 animate-spin shadow-[0_0_30px_rgba(207,255,80,0.2),0_0_15px_rgba(207,255,80,0.1)_inset]"
        ></div>
        <Icon
          name="ri:movie-2-fill"
          class="absolute inset-0 m-auto text-3xl text-accent-500 animate-pulse"
        />
      </div>
      <h2 class="text-2xl font-black italic tracking-tighter uppercase mb-2">Baking Your Clip</h2>
      <p class="text-slate-400 text-sm font-medium tracking-wide mb-6">
        {{
          state?.renderStage?.value === 'starting'
            ? 'Preparing Remotion engine...'
            : state?.renderStage?.value === 'bundling'
              ? 'Bundling React components...'
              : state?.renderStage?.value === 'encoding'
                ? 'Encoding & muxing final video...'
                : 'Rendering frames via Remotion...'
        }}
      </p>

      <!-- Progress Bar -->
      <div class="w-80 max-w-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold uppercase tracking-widest text-accent-500">
            {{ state?.renderProgress?.value || 0 }}%
          </span>
          <span v-if="(state?.renderEta?.value || 0) > 0" class="text-xs mono text-slate-500">
            ~{{
              (state?.renderEta?.value || 0) >= 60
                ? Math.floor((state?.renderEta?.value || 0) / 60) +
                  'm ' +
                  ((state?.renderEta?.value || 0) % 60) +
                  's'
                : (state?.renderEta?.value || 0) + 's'
            }}
            remaining
          </span>
          <span
            v-else-if="state?.renderStage?.value === 'starting'"
            class="text-xs mono text-slate-500"
          >
            estimating...
          </span>
        </div>
        <div class="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-accent-500 to-emerald-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(207,255,80,0.4)]"
            :style="{ width: (state?.renderProgress?.value || 0) + '%' }"
          ></div>
        </div>
        <p class="text-[10px] text-slate-600 mt-2 text-center uppercase tracking-widest font-bold">
          {{ state?.renderStage?.value || 'initializing' }}
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
const state = useClipperState()
</script>
