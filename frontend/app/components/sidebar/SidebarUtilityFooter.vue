<template>
  <!-- Section 5: Utility Footer (Dual-Layer Fixed Anchor) -->
  <div
    class="border-t border-white/[0.08] shrink-0 relative overflow-visible p-3 h-[116px] flex flex-col justify-center"
  >
    <!-- Collapsed Footer Layer (Vertical Stack) -->
    <div
      class="w-10 mx-auto flex flex-col items-center gap-1 overflow-visible transition-all ease-in-out"
      :class="
        isCollapsed
          ? 'opacity-100 duration-150 delay-100 pointer-events-auto'
          : 'opacity-0 duration-80 pointer-events-none absolute inset-x-0 top-3'
      "
    >
      <!-- Saweria Button -->
      <div class="relative group">
        <a
          href="https://saweria.co/gitkyla"
          target="_blank"
          rel="noopener noreferrer"
          class="w-8 h-8 rounded-xl flex items-center justify-center transition-all group/saweria hover:bg-white/[0.06] hover:scale-105 cursor-pointer"
          title="Support @gitkyla on Saweria"
        >
          <img
            :src="SAWERIA_LOGO"
            alt="Saweria"
            class="w-4 h-4 object-contain group-hover/saweria:scale-110 transition-transform"
          />
        </a>
        <div
          class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-[#FAAE2B]/30 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-[#FAAE2B]"></span>
          <span>Saweria (@gitkyla)</span>
        </div>
      </div>

      <!-- Trakteer Button -->
      <div class="relative group">
        <a
          href="https://trakteer.id/gitkyla"
          target="_blank"
          rel="noopener noreferrer"
          class="w-8 h-8 rounded-xl flex items-center justify-center transition-all group/trakteer hover:bg-white/[0.06] hover:scale-105 cursor-pointer"
          title="Support @gitkyla on Trakteer"
        >
          <img
            :src="TRAKTEER_LOGO"
            alt="Trakteer"
            class="w-4 h-4 object-contain group-hover/trakteer:scale-110 transition-transform"
          />
        </a>
        <div
          class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-[#BE1E2D]/30 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-[#FF5A65]"></span>
          <span>Trakteer (@gitkyla)</span>
        </div>
      </div>

      <!-- Divider -->
      <div class="w-6 border-t border-white/[0.08] my-0.5"></div>

      <!-- Status Dot -->
      <div class="flex justify-center relative group py-0.5">
        <div
          class="w-2.5 h-2.5 rounded-full cursor-help"
          :class="statusColor"
        ></div>
        <div
          class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-[100] whitespace-nowrap flex items-center gap-1.5"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="statusColor"></span>
          <span>{{ statusLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Expanded Footer Layer (2-Column Grid) -->
    <div
      class="w-full flex flex-col gap-2.5 overflow-hidden transition-all ease-in-out"
      :class="
        isCollapsed
          ? 'opacity-0 duration-80 pointer-events-none max-w-0 max-h-0'
          : 'opacity-100 duration-200 delay-100 pointer-events-auto max-w-full max-h-32'
      "
    >
      <!-- Support on Section -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between px-1">
          <span
            class="text-[9px] font-bold uppercase tracking-wider text-white/50"
            >Support on</span
          >
          <span class="text-[10px] text-accent-500 font-semibold"
            >@gitkyla</span
          >
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          <a
            href="https://saweria.co/gitkyla"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/[0.03] hover:bg-[#FAAE2B]/15 border border-white/[0.06] hover:border-[#FAAE2B]/30 text-white/90 hover:text-white text-[11px] font-bold transition-all group shadow-sm hover:scale-[1.02] cursor-pointer"
            title="Support @gitkyla on Saweria"
          >
            <img
              :src="SAWERIA_LOGO"
              alt="Saweria"
              class="w-4 h-4 object-contain shrink-0 group-hover:scale-110 transition-transform"
            />
            <span>Saweria</span>
          </a>
          <a
            href="https://trakteer.id/gitkyla"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/[0.03] hover:bg-[#BE1E2D]/20 border border-white/[0.06] hover:border-[#BE1E2D]/40 text-white/90 hover:text-white text-[11px] font-bold transition-all group shadow-sm hover:scale-[1.02] cursor-pointer"
            title="Support @gitkyla on Trakteer"
          >
            <img
              :src="TRAKTEER_LOGO"
              alt="Trakteer"
              class="w-4 h-4 object-contain shrink-0 group-hover:scale-110 transition-transform"
            />
            <span>Trakteer</span>
          </a>
        </div>
      </div>

      <!-- Status & Version Row -->
      <div
        class="flex items-center justify-between px-1 pt-2 border-t border-white/[0.06]"
      >
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" :class="statusColor"></span>
          <span class="text-[10px] font-medium text-white/80">{{
            statusLabel
          }}</span>
        </div>
        <span class="text-[9px] text-white/45 font-mono">v0.4.2</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SAWERIA_LOGO, TRAKTEER_LOGO } from '~/utils/donationLogos';

defineProps<{
  isCollapsed: boolean;
  statusColor: string;
  statusLabel: string;
}>();
</script>
