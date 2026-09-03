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
      @click="isCollapsed = true"
      class="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[55]"
    ></div>
  </Transition>

  <!-- Container with dynamic footprint -->
  <div 
    class="h-full shrink-0 font-sans select-none overflow-visible"
    :class="[
      isFloating ? 'w-[64px] relative z-[60]' : 'relative z-30',
      isDragging ? 'transition-none' : 'transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
    ]"
    :style="{ width: isFloating ? '64px' : (isCollapsed ? '64px' : `${sidebarWidth}px`) }"
  >
    <aside 
      class="bg-[#09090b]/95 backdrop-blur-xl flex flex-col h-full overflow-visible border-r border-white/[0.08] shadow-[0_0_25px_rgba(0,0,0,0.6)]"
      :class="[
        isFloating ? 'absolute top-0 left-0 shadow-2xl border-r border-white/[0.08]' : 'relative w-full h-full',
        !isCollapsed && isFloating ? 'bg-[#09090b]' : '',
        isDragging ? 'transition-none' : 'transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]'
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
        <div class="h-14 border-b border-white/[0.08] flex items-center px-3 shrink-0 overflow-hidden">
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Sidebar Toggle Button -->
            <button 
              @click="isCollapsed = !isCollapsed"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              :title="isCollapsed ? 'Expand Sidebar (Cmd+B)' : 'Collapse Sidebar (Cmd+B)'"
            >
              <Icon :name="isCollapsed ? 'lucide:panel-left' : 'lucide:panel-left-close'" class="text-lg" />
            </button>

            <!-- Brand Logo & Title with Asymmetrical Timing -->
            <div 
              class="flex items-center gap-2 min-w-0 overflow-hidden whitespace-nowrap transition-all ease-in-out"
              :class="isCollapsed 
                ? 'max-w-0 opacity-0 duration-80 pointer-events-none' 
                : 'max-w-[200px] opacity-100 duration-200 delay-100 pointer-events-auto'"
            >
              <NuxtLink to="/" class="flex items-center gap-2 min-w-0 group cursor-pointer overflow-hidden whitespace-nowrap">
                <div class="w-6 h-6 rounded-md bg-accent-500 flex items-center justify-center text-black font-black text-xs shadow-[0_0_12px_rgba(207,255,80,0.35)] group-hover:scale-105 transition-all shrink-0">
                  Y
                </div>
                <div class="overflow-hidden min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-white tracking-wide text-xs">YONRU</span>
                  </div>
                  <p class="text-[9px] text-accent-500 font-semibold font-mono whitespace-nowrap truncate">Short Video Clipper</p>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Main Content Area with Fixed Anchors and Asymmetrical Timing -->
        <div 
          class="flex-1 min-h-0 relative flex flex-col p-3 pt-2 gap-3.5"
          :class="isCollapsed ? 'overflow-visible select-none' : 'overflow-y-auto overflow-x-hidden custom-scrollbar'"
        >
          <!-- Section 1: Spotlight Search Trigger (Dual-Layer Fixed Anchor) -->
          <div class="relative w-full h-10 flex items-center shrink-0">
            <!-- Collapsed Circular Search Button Layer -->
            <div 
              class="absolute left-0 top-2 w-10 h-10 flex items-center justify-center transition-all ease-in-out"
              :class="isCollapsed 
                ? 'opacity-100 duration-150 delay-100 pointer-events-auto' 
                : 'opacity-0 duration-80 pointer-events-none'"
            >
              <div class="relative group">
                <button 
                  @click="palette.open"
                  class="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 hover:border-white/30 text-white/70 hover:text-white hover:scale-105 flex items-center justify-center cursor-pointer relative transition-all"
                  title="Search (Cmd+K)"
                >
                  <Icon name="lucide:search" class="text-base" />
                </button>
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-white/15 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                  <span>Search</span>
                  <kbd class="px-1 py-0.2 bg-white/[0.08] border border-white/10 rounded font-mono text-[9px] text-white/60">⌘K</kbd>
                </div>
              </div>
            </div>

            <!-- Expanded Wide Search Bar Layer -->
            <div 
              class="w-full h-10 transition-all ease-in-out overflow-hidden mt-4"
              :class="isCollapsed 
                ? 'opacity-0 duration-80 pointer-events-none max-w-0' 
                : 'opacity-100 duration-200 delay-100 pointer-events-auto max-w-full'"
            >
              <button 
                @click="palette.open"
                class="w-full h-10 flex items-center justify-between px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-accent-500/40 hover:shadow-[0_0_15px_rgba(207,255,80,0.06)] transition-all group cursor-pointer text-left whitespace-nowrap"
                title="Search (Cmd+K)"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <Icon 
                    name="lucide:search" 
                    class="text-sm text-white/50 group-hover:text-accent-500 transition-colors shrink-0" 
                  />
                  <span class="text-xs text-white/50 group-hover:text-white/80 font-medium truncate transition-colors">
                    Search or jump to...
                  </span>
                </div>
                <kbd class="px-1.5 py-0.5 text-[9px] font-mono font-bold text-white/50 bg-white/[0.06] border border-white/10 rounded group-hover:border-white/20 group-hover:text-white/70 transition-all shrink-0">
                  ⌘K
                </kbd>
              </button>
            </div>
          </div>

          <!-- Divider (Collapsed Only) -->
          <div 
            class="border-t border-white/[0.08] transition-all duration-300 shrink-0"
            :class="isCollapsed ? 'w-7 mx-auto my-0.5 relative top-2' : 'hidden'"
          ></div>

          <!-- Section 2: Main Navigation Items & Persistent Single Active Pill -->
          <div class="flex flex-col gap-1 shrink-0" :class="isCollapsed ? '-mt-[19px]' : ''">
            <!-- Header Label (Synchronous 0ms Delay, Fixed Height) -->
            <div 
              class="overflow-hidden whitespace-nowrap transition-all duration-150 ease-out h-5 flex items-center"
              :class="isCollapsed 
                ? 'max-w-0 opacity-0 pointer-events-none' 
                : 'max-w-[200px] opacity-100 pointer-events-auto'"
            >
              <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Main Navigation</span>
            </div>

            <!-- Navigation Buttons Stack -->
            <div class="relative flex flex-col gap-2 w-full mt-0.5 ">
              <!-- Persistent Single Sliding Active Pill Indicator -->
              <span 
                v-if="activeNavIndex >= 0"
                class="absolute -left-3 w-1 rounded-r-full bg-accent-500 shadow-[0_0_8px_rgba(207,255,80,0.6)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none z-10"
                :style="{
                  top: `${activeNavIndex * 48 + 10}px`,
                  height: '20px'
                }"
              ></span>

              <!-- Persistent Navigation Item Hitboxes -->
              <div v-for="item in navItemsConfig" :key="item.id" class="relative group w-full">
                <button 
                  @click="handleNav(item.id)"
                  class="h-10 flex items-center rounded-xl transition-colors duration-200 cursor-pointer w-full overflow-hidden"
                  :class="[
                    activeView === item.id 
                      ? 'bg-white/[0.06] text-white font-semibold' 
                      : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
                  ]"
                  :title="isCollapsed ? item.label : undefined"
                >
                  <!-- 40px Stationary Icon Hitbox -->
                  <div class="w-10 h-10 shrink-0 flex items-center justify-center relative">
                    <Icon 
                      :name="item.icon" 
                      class="text-lg group-hover:scale-105 transition-transform" 
                      :class="activeView === item.id ? 'text-accent-500' : 'text-white/70 group-hover:text-white'"
                    />
                    <div 
                      v-if="item.id === 'settings' && state?.isAnyPrerequisiteMissing?.value" 
                      class="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-amber"
                      title="Prerequisite setup requires attention in Settings"
                    ></div>
                  </div>

                  <!-- Horizontally Collapsing Label -->
                  <div 
                    class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0"
                    :class="isCollapsed 
                      ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none' 
                      : 'max-w-[160px] opacity-100 duration-200 delay-75 translate-x-0'"
                  >
                    <span class="text-sm font-medium pr-3">{{ item.label }}</span>
                  </div>
                </button>

                <!-- Collapsed Flyout Tooltip -->
                <div 
                  v-if="isCollapsed"
                  class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap"
                >
                  {{ item.label }}
                </div>
              </div>
            </div>
          </div>

          <!-- Divider -->
          <div 
            class="border-t border-white/[0.08] transition-all duration-300 shrink-0"
            :class="isCollapsed ? 'w-7 mx-auto my-0.5' : 'hidden'"
          ></div>

          <!-- Section 3: Workspace (Unified Anchor & Horizontal Unfold) -->
          <div class="flex flex-col gap-1 shrink-0 relative w-full" :class="isCollapsed ? '-mt-[19px]' : ''">
            <!-- Header Label (Synchronous 0ms Delay, Fixed Height, Identical to Main Navigation) -->
            <div 
              class="overflow-hidden whitespace-nowrap transition-all duration-150 ease-out h-5 flex items-center"
              :class="isCollapsed 
                ? 'max-w-0 opacity-0 pointer-events-none' 
                : 'max-w-[200px] opacity-100 pointer-events-auto'"
            >
              <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Workspace</span>
            </div>

            <!-- Unified Workspace Card Container -->
            <div class="relative group w-full">
              <!-- Case 1: Active Job Processing -->
              <div 
                v-if="isProcessing"
                class="border border-transparent flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out w-full overflow-hidden"
                :class="isCollapsed 
                  ? 'h-10 p-0 bg-transparent border-transparent duration-80 ease-in' 
                  : 'h-[68px] p-2 bg-amber-500/5 border-amber-500/20 delay-75'"
              >
                <!-- Stationary Left Anchor -->
                <div 
                  class="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 animate-pulse-subtle transition-all duration-200 ease-out"
                  :class="isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-lg'"
                >
                  <Icon name="lucide:loader-2" class="animate-spin text-amber-400" :class="isCollapsed ? 'text-base' : 'text-lg'" />
                </div>

                <!-- Right Details (Horizontal Unfold) -->
                <div 
                  class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0 flex-1"
                  :class="isCollapsed 
                    ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none' 
                    : 'max-w-[240px] opacity-100 duration-200 delay-75 translate-x-0'"
                >
                  <div class="flex flex-col justify-center min-w-0 pr-1">
                    <div class="flex items-center gap-1.5 leading-none">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
                      <span class="text-[9.5px] font-bold text-amber-400 tracking-wider uppercase">Active Job</span>
                    </div>
                    <p class="text-xs text-white font-semibold truncate leading-tight mt-1">{{ processingTitle }}</p>
                    <p class="text-[10px] text-amber-300/70 uppercase tracking-wider font-mono truncate mt-0.5">{{ processingStatus }}</p>
                  </div>
                </div>
              </div>

              <!-- Case 2: Continue Editing / Last Accessed Clip Available -->
              <button 
                v-else-if="lastClip && lastVideo"
                :disabled="isCurrentClipActive"
                @click="isCurrentClipActive ? null : handleContinueEditingClick()"
                class="border border-transparent flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out group w-full text-left"
                :class="[
                  isCurrentClipActive 
                    ? 'cursor-default opacity-85' 
                    : 'cursor-pointer hover:border-accent-500/40 hover:bg-white/[0.06]',
                  isCollapsed 
                    ? 'h-10 p-0 bg-transparent border-transparent duration-80 ease-in overflow-visible' 
                    : 'h-[68px] p-2 bg-white/[0.03] border-white/[0.08] delay-75 overflow-hidden'
                ]"
                :title="isCollapsed ? (lastClip.theme || lastClip.title || 'Last Accessed Clip') : undefined"
              >
                <!-- Media Anchor Wrapper (overflow-visible for unclipped badge) -->
                <div 
                  class="shrink-0 relative flex items-center justify-center transition-all duration-200 ease-out"
                  :class="isCollapsed ? 'w-10 h-10' : 'w-12 h-12'"
                >
                  <!-- Inner Thumbnail Box (overflow-hidden to round the image) -->
                  <div 
                    class="w-full h-full bg-[#141419] overflow-hidden border border-white/[0.08] relative flex items-center justify-center transition-all duration-200 ease-out group-hover:border-accent-500/30"
                    :class="isCollapsed ? 'rounded-xl' : 'rounded-lg'"
                  >
                    <img 
                      v-if="lastClipThumbnail" 
                      :src="lastClipThumbnail" 
                      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                      alt="Clip Thumbnail" 
                      @error="handleThumbnailError"
                    />
                    <Icon v-else name="lucide:clapperboard" class="text-white/60" :class="isCollapsed ? 'text-base' : 'text-lg'" />
                    
                    <!-- Hover Play Overlay in Expanded Mode -->
                    <div 
                      v-if="!isCurrentClipActive && !isCollapsed"
                      class="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <div class="w-6 h-6 rounded-full bg-accent-500 flex items-center justify-center shadow-lg shadow-accent-500/30">
                        <Icon name="lucide:play" class="text-black text-xs fill-black" />
                      </div>
                    </div>
                  </div>

                  <!-- Active Notification Dot in Collapsed Mode (Unclipped Floating Badge) -->
                  <div 
                    v-if="isCollapsed" 
                    class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent-500 rounded-full border-2 border-[#09090b] shadow-[0_0_8px_rgba(207,255,80,0.8)] z-20 pointer-events-none"
                  ></div>
                </div>

                <!-- Right Details (Horizontal Unfold) -->
                <div 
                  class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0 flex-1"
                  :class="isCollapsed 
                    ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none' 
                    : 'max-w-[240px] opacity-100 duration-200 delay-75 translate-x-0'"
                >
                  <div class="flex flex-col justify-center min-w-0 pr-1">
                    <div class="flex items-center gap-1.5 leading-none">
                      <span 
                        v-if="isCurrentClipActive" 
                        class="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"
                      ></span>
                      <p 
                        class="text-[9.5px] font-bold uppercase tracking-wider"
                        :class="isCurrentClipActive ? 'text-indigo-400' : 'text-accent-500'"
                      >
                        {{ isCurrentClipActive ? 'ON EDITING' : 'CONTINUE EDITING' }}
                      </p>
                    </div>
                    <p class="text-xs text-white font-semibold truncate leading-tight mt-1">{{ lastClip.theme || lastClip.title || 'Untitled Clip' }}</p>
                    <p class="text-[10px] text-white/50 truncate mt-0.5">{{ lastVideo.title || 'Untitled Video' }}</p>
                  </div>
                </div>
              </button>

              <!-- Case 3: Empty State (No Recent Clip) -->
              <div 
                v-else
                class="border border-transparent flex items-center gap-2.5 rounded-xl transition-all duration-200 ease-out w-full overflow-hidden"
                :class="isCollapsed 
                  ? 'h-10 p-0 bg-transparent border-transparent duration-80 ease-in' 
                  : 'h-[68px] p-2 bg-white/[0.02] border-dashed border-white/[0.08] delay-75'"
              >
                <!-- Media Anchor -->
                <div 
                  class="bg-white/[0.03] border border-white/[0.08] text-white/35 flex items-center justify-center shrink-0 transition-all duration-200 ease-out"
                  :class="isCollapsed ? 'w-10 h-10 rounded-xl' : 'w-12 h-12 rounded-lg'"
                >
                  <Icon name="lucide:clapperboard" :class="isCollapsed ? 'text-base' : 'text-lg'" />
                </div>

                <!-- Right Details (Horizontal Unfold) -->
                <div 
                  class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0 flex-1"
                  :class="isCollapsed 
                    ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none' 
                    : 'max-w-[240px] opacity-100 duration-200 delay-75 translate-x-0'"
                >
                  <div class="flex flex-col justify-center min-w-0 pr-1">
                    <p class="text-[9.5px] font-bold uppercase tracking-wider text-white/40 leading-none">Last Accessed Clip</p>
                    <p class="text-xs text-white/60 font-medium truncate mt-1">No recent clip</p>
                    <p class="text-[10px] text-white/35 truncate mt-0.5">Open a clip to begin</p>
                  </div>
                </div>
              </div>

              <!-- Collapsed Mode Workspace Hover Card Drawer -->
              <div 
                v-if="isCollapsed"
                class="absolute left-full top-0 ml-3 bg-[#121216] border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-3 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-x-1 group-hover:translate-x-0 z-[100] flex flex-col gap-2 cursor-default"
              >
                <span class="text-[9px] font-bold uppercase tracking-wider text-white/50 pb-1 border-b border-white/[0.06]">Workspace</span>
                
                <div v-if="isProcessing" class="bg-amber-500/5 rounded-xl p-2.5 border border-amber-500/10">
                  <div class="flex items-center gap-1.5 mb-1">
                    <Icon name="lucide:loader-2" class="text-xs text-amber-400 animate-spin" />
                    <span class="text-[9px] font-bold text-amber-400 uppercase">Active Job</span>
                  </div>
                  <p class="text-xs text-white font-medium line-clamp-1">{{ processingTitle }}</p>
                  <p class="text-[9px] text-amber-300/70 font-mono mt-0.5">{{ processingStatus }}</p>
                </div>

                <div 
                  v-else-if="lastClip && lastVideo" 
                  class="flex items-center gap-2.5 p-1 rounded-xl transition-all"
                  :class="!isCurrentClipActive ? 'hover:bg-white/[0.04] cursor-pointer' : ''"
                  @click="!isCurrentClipActive && handleContinueEditingClick()"
                >
                  <div class="w-11 h-11 rounded-lg bg-[#141419] overflow-hidden shrink-0 border border-white/[0.08] relative flex items-center justify-center">
                    <img 
                      v-if="lastClipThumbnail" 
                      :src="lastClipThumbnail" 
                      class="w-full h-full object-cover" 
                      alt="Clip Thumbnail" 
                      @error="handleThumbnailError"
                    />
                    <Icon v-else name="lucide:clapperboard" class="text-white/60 text-sm" />
                  </div>
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <p 
                      class="text-[9px] font-bold uppercase tracking-wider"
                      :class="isCurrentClipActive ? 'text-indigo-400' : 'text-accent-500'"
                    >
                      {{ isCurrentClipActive ? 'ON EDITING' : 'LAST ACCESSED CLIP' }}
                    </p>
                    <p class="text-xs text-white font-medium truncate leading-tight">{{ lastClip.theme || lastClip.title || 'Untitled Clip' }}</p>
                    <p class="text-[9px] text-white/60 truncate">{{ lastVideo.title || 'Untitled Video' }}</p>
                  </div>
                </div>
                <div v-else class="text-[10px] text-white/45 italic text-center py-1">No last accessed clip.</div>
              </div>
            </div>
          </div>

          <!-- Section 4: Changelog (Persistent 40px Hitbox) -->
          <div class="relative group w-full mt-auto pt-2 shrink-0">
            <button 
              @click="handleNav('changelog')"
              class="h-10 flex items-center rounded-xl text-white/80 hover:text-white hover:bg-white/[0.04] transition-colors duration-200 cursor-pointer w-full overflow-hidden"
              :title="isCollapsed ? 'Changelog' : undefined"
            >
              <div class="w-10 h-10 shrink-0 flex items-center justify-center">
                <Icon name="lucide:history" class="text-lg group-hover:scale-105 transition-transform" />
              </div>
              <div 
                class="overflow-hidden whitespace-nowrap transition-all ease-in-out min-w-0"
                :class="isCollapsed 
                  ? 'max-w-0 opacity-0 duration-80 -translate-x-1 pointer-events-none' 
                  : 'max-w-[160px] opacity-100 duration-200 delay-75 translate-x-0'"
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

        <!-- Section 5: Utility Footer (Dual-Layer Fixed Anchor) -->
        <div class="border-t border-white/[0.08] shrink-0 relative overflow-visible p-3 h-[116px] flex flex-col justify-center">
          <!-- Collapsed Footer Layer (Vertical Stack) -->
          <div 
            class="w-10 mx-auto flex flex-col items-center gap-1 overflow-visible transition-all ease-in-out"
            :class="isCollapsed 
              ? 'opacity-100 duration-150 delay-100 pointer-events-auto' 
              : 'opacity-0 duration-80 pointer-events-none absolute inset-x-0 top-3'"
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
                <img :src="SAWERIA_LOGO" alt="Saweria" class="w-4 h-4 object-contain group-hover/saweria:scale-110 transition-transform" />
              </a>
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-[#FAAE2B]/30 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
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
                <img :src="TRAKTEER_LOGO" alt="Trakteer" class="w-4 h-4 object-contain group-hover/trakteer:scale-110 transition-transform" />
              </a>
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-[#BE1E2D]/30 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-[#FF5A65]"></span>
                <span>Trakteer (@gitkyla)</span>
              </div>
            </div>

            <!-- Divider -->
            <div class="w-6 border-t border-white/[0.08] my-0.5"></div>

            <!-- Status Dot -->
            <div class="flex justify-center relative group py-0.5">
              <div class="w-2.5 h-2.5 rounded-full cursor-help" :class="statusColor"></div>
              <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full" :class="statusColor"></span>
                <span>{{ statusLabel }}</span>
              </div>
            </div>
          </div>

          <!-- Expanded Footer Layer (2-Column Grid) -->
          <div 
            class="w-full flex flex-col gap-2.5 overflow-hidden transition-all ease-in-out"
            :class="isCollapsed 
              ? 'opacity-0 duration-80 pointer-events-none max-w-0 max-h-0' 
              : 'opacity-100 duration-200 delay-100 pointer-events-auto max-w-full max-h-32'"
          >
            <!-- Support on Section -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between px-1">
                <span class="text-[9px] font-bold uppercase tracking-wider text-white/50">Support on</span>
                <span class="text-[10px] text-accent-500 font-semibold">@gitkyla</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <a 
                  href="https://saweria.co/gitkyla" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/[0.03] hover:bg-[#FAAE2B]/15 border border-white/[0.06] hover:border-[#FAAE2B]/30 text-white/90 hover:text-white text-[11px] font-bold transition-all group shadow-sm hover:scale-[1.02] cursor-pointer" 
                  title="Support @gitkyla on Saweria"
                >
                  <img :src="SAWERIA_LOGO" alt="Saweria" class="w-4 h-4 object-contain shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Saweria</span>
                </a>
                <a 
                  href="https://trakteer.id/gitkyla" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-white/[0.03] hover:bg-[#BE1E2D]/20 border border-white/[0.06] hover:border-[#BE1E2D]/40 text-white/90 hover:text-white text-[11px] font-bold transition-all group shadow-sm hover:scale-[1.02] cursor-pointer" 
                  title="Support @gitkyla on Trakteer"
                >
                  <img :src="TRAKTEER_LOGO" alt="Trakteer" class="w-4 h-4 object-contain shrink-0 group-hover:scale-110 transition-transform" />
                  <span>Trakteer</span>
                </a>
              </div>
            </div>

            <!-- Status & Version Row -->
            <div class="flex items-center justify-between px-1 pt-2 border-t border-white/[0.06]">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="statusColor"></span>
                <span class="text-[10px] font-medium text-white/80">{{ statusLabel }}</span>
              </div>
              <span class="text-[9px] text-white/45 font-mono">v0.4.2</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { SAWERIA_LOGO, TRAKTEER_LOGO } from '~/utils/donationLogos'
import { useCommandPalette } from '~/composables/useCommandPalette'

const state = useClipperState()
const palette = useCommandPalette()

const isCurrentClipActive = computed(() => {
  return props.activeView === 'editor'
})

const statusColor = computed(() => {
  const status = state?.jobStatus?.value || 'idle'
  const map: Record<string, string> = {
    idle: 'bg-emerald-500/80',
    queued: 'bg-amber-500',
    downloading_audio: 'bg-sky-500 animate-pulse',
    transcribing: 'bg-violet-500 animate-pulse',
    generating_hooks: 'bg-fuchsia-500 animate-pulse',
    hooks_ready: 'bg-accent-500 shadow-[0_0_8px_#CFFF50]',
    extracting_video: 'bg-sky-500 animate-pulse',
    cutting: 'bg-sky-400 animate-pulse',
    ready: 'bg-accent-500 shadow-[0_0_8px_#CFFF50]',
    error: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
  }
  return map[status] || 'bg-slate-600'
})

const statusLabel = computed(() => {
  return state?.jobStatus?.value?.toUpperCase()?.replace('_', ' ') || 'IDLE'
})

const props = withDefaults(defineProps<{
  activeView: string
  cachedVideos: any[]
  isProcessing: boolean
  processingStatus?: string
  processingTitle?: string
  lastVideo?: any
  lastClip?: any
  API_BASE: string
  defaultCollapsed?: boolean
  isFloating?: boolean
}>(), {
  defaultCollapsed: true,
  isFloating: false
})

const lastVideo = computed(() => {
  return props.lastVideo !== undefined ? props.lastVideo : state?.lastAccessedVideo?.value
})

const lastClip = computed(() => {
  return props.lastClip !== undefined ? props.lastClip : state?.lastAccessedClip?.value
})

const thumbnailLoadFailed = ref(false)

watch(() => lastClip.value?.clip_id, () => {
  thumbnailLoadFailed.value = false
})

const lastClipThumbnail = computed(() => {
  if (thumbnailLoadFailed.value) {
    const video = lastVideo.value
    if (video?.thumbnail) {
      return `${props.API_BASE}/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`
    }
    if (video?.thumbnail_url) {
      return video.thumbnail_url.startsWith('http')
        ? `${props.API_BASE}/api/proxy-image?url=${encodeURIComponent(video.thumbnail_url)}`
        : `${props.API_BASE}${video.thumbnail_url}`
    }
    return null
  }

  const clip = lastClip.value
  const video = lastVideo.value
  if (!clip) return null

  // 1. Explicit thumbnail_url stored on the clip
  if (clip.thumbnail_url) {
    return clip.thumbnail_url.startsWith('http')
      ? `${props.API_BASE}/api/proxy-image?url=${encodeURIComponent(clip.thumbnail_url)}`
      : `${props.API_BASE}${clip.thumbnail_url}`
  }

  // 2. Smart Dynamic Resolver: extract start timestamp from clip_id (e.g., "15_45" -> thumb_15.jpg)
  const folder = clip.folder || clip.folder_name
  if (folder && clip.clip_id) {
    const parts = clip.clip_id.split('_')
    const startSec = parseInt(parts[0] || '')
    if (!isNaN(startSec)) {
      return `${props.API_BASE}/assets/sources/${folder}/thumb_${startSec}.jpg`
    }
  }

  // 3. Fallback to parent video thumbnail
  if (video?.thumbnail) {
    return `${props.API_BASE}/api/proxy-image?url=${encodeURIComponent(video.thumbnail)}`
  }
  if (video?.thumbnail_url) {
    return video.thumbnail_url.startsWith('http')
      ? `${props.API_BASE}/api/proxy-image?url=${encodeURIComponent(video.thumbnail_url)}`
      : `${props.API_BASE}${video.thumbnail_url}`
  }

  return null
})

function handleThumbnailError() {
  thumbnailLoadFailed.value = true
}

const navItemsConfig = [
  { id: 'home', label: 'Home', icon: 'lucide:home' },
  { id: 'prompts', label: 'Prompts', icon: 'lucide:sparkles' },
  { id: 'docs', label: 'Documentation', icon: 'lucide:book-open' },
  { id: 'settings', label: 'Settings', icon: 'lucide:settings' }
] as const
const navItemsList = ['home', 'prompts', 'docs', 'settings'] as const
const activeNavIndex = computed(() => {
  return navItemsList.indexOf(props.activeView as any)
})

const emit = defineEmits<{
  (e: 'update:activeView', view: string): void
}>()

function useSafeState<T>(key: string, init: () => T) {
  try {
    return useState<T>(key, init)
  } catch {
    return ref(init())
  }
}

const isCollapsed = props.isFloating 
  ? ref(props.defaultCollapsed ?? true)
  : useSafeState<boolean>('yonru_sidebar_collapsed', () => props.defaultCollapsed ?? true)

watch(isCollapsed, (newVal) => {
  if (!props.isFloating) {
    localStorage.setItem('yonru_sidebar_collapsed', newVal.toString())
  }
})
const sidebarWidth = ref(280)
const minWidth = 240
const maxWidth = 480
let isDragging = false

function useSafeRouter() {
  try {
    const r = useRouter()
    if (r && typeof r.push === 'function') return r
  } catch {}
  try {
    if (typeof (globalThis as any).useRouter === 'function') {
      return (globalThis as any).useRouter()
    }
  } catch {}
  return { push: () => {} }
}

function handleNav(view: string) {
  if (props.activeView === view) {
    if (props.isFloating) {
      isCollapsed.value = true
    }
    return
  }
  const router = useSafeRouter()
  emit('update:activeView', view)
  if (view === 'settings') {
    router.push('/settings')
  } else if (view === 'prompts') {
    router.push('/prompts')
  } else if (view === 'docs') {
    router.push('/docs')
  } else if (view === 'changelog') {
    router.push('/changelog')
  } else if (view === 'home') {
    router.push('/')
  } 
  if (props.isFloating) {
    isCollapsed.value = true
  }
}

async function handleContinueEditingClick() {
  if (isCurrentClipActive.value) return
  const router = useSafeRouter()
  const clip = lastClip.value
  const video = lastVideo.value
  if (!clip || !video) return
  
  try {
    if (state?.isNavigatingToEditor) {
      state.isNavigatingToEditor.value = true
    }
    const minWait = new Promise(resolve => setTimeout(resolve, 600))
    
    const folder = clip.folder || clip.folder_name
    await state.loadReadyClipIntoEditor(folder, clip.clip_id)
    
    let hookIndex = 0
    let tab = 'generated'
    
    const clipId = clip.clip_id || ''
    const parts = clipId.split('_')
    if (parts.length >= 2) {
      const clipStart = parseFloat(parts[0]) || 0
      const clipEnd = parseFloat(parts[1]) || 0
      
      function findBestMatchingHookIndex(list: any[], targetStart: number, targetEnd: number) {
        let bestIndex = -1
        let minDiff = 5.0
        list.forEach((h, idx) => {
          const hStart = typeof h.start === 'string' ? parseFloat(h.start) : h.start
          const hEnd = typeof h.end === 'string' ? parseFloat(h.end) : h.end
          const diff = Math.abs(hStart - targetStart) + Math.abs(hEnd - targetEnd)
          if (diff < minDiff) {
            minDiff = diff
            bestIndex = idx
          }
        })
        return { index: bestIndex, diff: minDiff }
      }

      const savedMatch = findBestMatchingHookIndex(state.savedHooks.value, clipStart, clipEnd)
      const genMatch = findBestMatchingHookIndex(state.hooks.value, clipStart, clipEnd)

      if (savedMatch.index >= 0 && (genMatch.index < 0 || savedMatch.diff <= genMatch.diff)) {
        hookIndex = savedMatch.index
        tab = 'saved'
      } else if (genMatch.index >= 0) {
        hookIndex = genMatch.index
        tab = 'generated'
      }
    }
    
    await minWait
    emit('update:activeView', 'editor')
    await router.push({
      path: '/editor',
      query: { 
        job_id: state.jobId.value || '',
        folder: folder,
        hook_index: hookIndex,
        tab: tab
      }
    })
  } catch (e) {
    console.error('[yonru] Failed to continue editing clip:', e)
    if (state?.isNavigatingToEditor) {
      state.isNavigatingToEditor.value = false
    }
    state.showToast?.('Failed to load clip data', 'error')
  }
}

function startDrag() {
  isDragging = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onDrag(e: MouseEvent) {
  if (!isDragging) return
  let newWidth = e.clientX
  if (newWidth < minWidth) newWidth = minWidth
  if (newWidth > maxWidth) newWidth = maxWidth
  sidebarWidth.value = newWidth
}

function stopDrag() {
  if (isDragging) {
    isDragging = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    localStorage.setItem('yonru_sidebar_width', sidebarWidth.value.toString())
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault()
    isCollapsed.value = !isCollapsed.value
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    if (!props.isFloating) {
      const saved = localStorage.getItem('yonru_sidebar_collapsed')
      if (saved !== null) {
        isCollapsed.value = saved === 'true'
      } else if (props.defaultCollapsed !== undefined) {
        isCollapsed.value = props.defaultCollapsed
      } else {
        isCollapsed.value = true
      }
    }
    const savedWidth = localStorage.getItem('yonru_sidebar_width')
    if (savedWidth) {
      sidebarWidth.value = parseInt(savedWidth)
    }
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('keydown', handleKeydown)
  
  if (typeof window !== 'undefined' && !state?.systemHealth?.value && !state?.checkingHealth?.value) {
    state.checkSystemHealth()
  }
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 9999px;
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse-amber {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
    box-shadow: 0 0 0 4px rgba(245, 158, 11, 0);
  }
}
.animate-pulse-amber {
  animation: pulse-amber 2s infinite;
}
</style>
