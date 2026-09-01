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
      isFloating ? 'w-[64px] relative z-[60]' : 'relative border-r border-white/10 z-30',
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
        <!-- Header (Unified Fixed Origin for Toggle Button - Rock Solid, No Flickering) -->
        <div class="h-14 border-b border-white/[0.08] flex items-center px-3 shrink-0 overflow-hidden">
          <!-- Left: Fixed Toggle Button & Brand Link -->
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Sidebar Toggle Button (Positioned at stable top-left origin, perfect 40px width matching rail) -->
            <button 
              @click="isCollapsed = !isCollapsed"
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              :title="isCollapsed ? 'Expand Sidebar (Cmd+B)' : 'Collapse Sidebar (Cmd+B)'"
            >
              <Icon :name="isCollapsed ? 'lucide:panel-left' : 'lucide:panel-left-close'" class="text-lg" />
            </button>

            <!-- Brand Logo & Title (Fixed-Width Curtain Mask, Smooth Opacity Fade) -->
            <Transition
              enter-active-class="transition-opacity duration-250 ease-out delay-75"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-opacity duration-150 ease-in-out pointer-events-none"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <NuxtLink v-if="!isCollapsed" to="/" class="flex items-center gap-2 min-w-0 group cursor-pointer overflow-hidden whitespace-nowrap">
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
            </Transition>
          </div>
        </div>

        <!-- Main Content Area with Smooth Crossfade Transition (No Layout Collapse & Zero Vertical Shift) -->
        <div class="flex-1 min-h-0 relative overflow-visible flex flex-col">
          <!-- Expanded Mode Container (Fixed Virtual Width Curtain Mask) -->
          <Transition
            enter-active-class="transition-opacity duration-250 ease-out delay-75"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-180 ease-in-out absolute inset-y-0 left-0 w-[280px] overflow-hidden pointer-events-none"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="!isCollapsed" class="h-full w-full flex flex-col min-h-0 overflow-visible">
              <!-- Top Section: Spotlight Command Palette Trigger -->
              <div class="p-3 pb-0 shrink-0 relative overflow-visible z-50">
                <button 
                  @click="palette.open"
                  class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-accent-500/40 hover:shadow-[0_0_15px_rgba(207,255,80,0.06)] transition-all group cursor-pointer text-left"
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

              <!-- Scrollable Content (Nav & Workspace & Changelog) -->
              <div class="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col p-3 pt-2 gap-5 min-h-0">

            <!-- Section 1: Main Navigation -->
            <div class="flex flex-col gap-1">
              <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Main Navigation</span>
              
              <div class="relative flex flex-col gap-1 mt-1">
                <!-- Sliding Active Pill Indicator in Expanded Mode -->
                <span 
                  v-if="activeNavIndex >= 0"
                  class="absolute left-0 w-1 rounded-r-full bg-accent-500 shadow-[0_0_8px_rgba(207,255,80,0.6)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none z-10"
                  :style="{
                    top: `${activeNavIndex * 44 + 10}px`,
                    height: '20px'
                  }"
                ></span>

                <!-- Nav: Home -->
                <button 
                  @click="handleNav('home')"
                  class="relative h-10 flex items-center gap-3 px-3 rounded-xl transition-colors duration-200 cursor-pointer group overflow-hidden"
                  :class="activeView === 'home' 
                    ? 'bg-white/[0.06] text-white font-semibold' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon 
                    name="lucide:home" 
                    class="text-lg shrink-0 group-hover:scale-105 transition-all" 
                    :class="activeView === 'home' ? 'text-accent-500' : 'text-white/70 group-hover:text-white'"
                  />
                  <span class="text-xs font-medium">Home</span>
                </button>

                <!-- Nav: Prompts -->
                <button 
                  @click="handleNav('prompts')"
                  class="relative h-10 flex items-center gap-3 px-3 rounded-xl transition-colors duration-200 cursor-pointer group overflow-hidden"
                  :class="activeView === 'prompts' 
                    ? 'bg-white/[0.06] text-white font-semibold' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon 
                    name="lucide:sparkles" 
                    class="text-lg shrink-0 group-hover:scale-105 transition-all" 
                    :class="activeView === 'prompts' ? 'text-accent-500' : 'text-white/70 group-hover:text-white'"
                  />
                  <span class="text-xs font-medium">Prompts</span>
                </button>

                <!-- Nav: Documentation -->
                <button 
                  @click="handleNav('docs')"
                  class="relative h-10 flex items-center gap-3 px-3 rounded-xl transition-colors duration-200 cursor-pointer group overflow-hidden"
                  :class="activeView === 'docs' 
                    ? 'bg-white/[0.06] text-white font-semibold' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon 
                    name="lucide:book-open" 
                    class="text-lg shrink-0 group-hover:scale-105 transition-all" 
                    :class="activeView === 'docs' ? 'text-accent-500' : 'text-white/70 group-hover:text-white'"
                  />
                  <span class="text-xs font-medium">Documentation</span>
                </button>

                <!-- Nav: Settings -->
                <button 
                  @click="handleNav('settings')"
                  class="relative h-10 flex items-center justify-between px-3 rounded-xl transition-colors duration-200 cursor-pointer group overflow-hidden"
                  :class="activeView === 'settings' 
                    ? 'bg-white/[0.06] text-white font-semibold' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <Icon 
                      name="lucide:settings" 
                      class="text-lg shrink-0 group-hover:scale-105 transition-all" 
                      :class="activeView === 'settings' ? 'text-accent-500' : 'text-white/70 group-hover:text-white'"
                    />
                    <span class="text-xs font-medium">Settings</span>
                  </div>
                  <!-- Warning Dot if Prerequisites Missing -->
                  <div 
                    v-if="state?.isAnyPrerequisiteMissing?.value" 
                    class="w-2 h-2 rounded-full bg-amber-500 animate-pulse-amber shrink-0"
                    title="Prerequisite setup requires attention in Settings"
                  ></div>
                </button>
              </div>
            </div>

            <!-- Section 2: Workspace -->
            <div class="flex flex-col gap-1.5">
              <span class="px-2 text-[10px] font-bold uppercase tracking-wider text-white/50">Workspace</span>

              <div class="flex flex-col gap-2 mt-0.5">
                <!-- Active Job Panel -->
                <div v-if="isProcessing" class="bg-amber-500/5 rounded-xl p-3 border border-amber-500/20 animate-pulse-subtle">
                  <div class="flex items-center gap-2 mb-1.5">
                    <Icon name="lucide:loader-2" class="text-xs text-amber-400 animate-spin" />
                    <span class="text-[9px] font-bold text-amber-400 tracking-wider uppercase">Active Job</span>
                  </div>
                  <p class="text-[11px] text-white font-medium line-clamp-1 mb-1">{{ processingTitle }}</p>
                  <p class="text-[9px] text-white/60 uppercase tracking-wider font-mono">{{ processingStatus }}</p>
                </div>

                <!-- Continue Editing Card -->
                <button 
                  v-if="lastClip && lastVideo && !isProcessing"
                  :disabled="isCurrentClipActive"
                  @click="isCurrentClipActive ? null : handleContinueEditingClick()"
                  class="flex items-center gap-3 p-2 rounded-xl transition-all group bg-white/[0.03] border text-left w-full disabled:pointer-events-none"
                  :class="isCurrentClipActive 
                    ? 'border-indigo-500/20 cursor-default opacity-80' 
                    : 'border-white/[0.08] hover:border-accent-500/30 hover:bg-white/[0.06] cursor-pointer'"
                >
                  <div class="w-10 h-10 rounded-lg bg-[#141419] overflow-hidden shrink-0 border border-white/[0.08] group-hover:border-accent-500/30 relative flex items-center justify-center">
                    <img 
                      v-if="lastClipThumbnail" 
                      :src="lastClipThumbnail" 
                      class="w-full h-full object-cover" 
                      alt="Clip Thumbnail"
                      @error="handleThumbnailError"
                    />
                    <Icon v-else name="lucide:clapperboard" class="text-white/60 text-sm" />
                    
                    <div 
                      v-if="!isCurrentClipActive"
                      class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Icon name="lucide:play" class="text-white text-xs fill-white" />
                    </div>
                  </div>
                  <div class="overflow-hidden flex-1 min-w-0">
                    <p 
                      class="text-[9px] font-bold uppercase tracking-tight leading-none mb-1"
                      :class="isCurrentClipActive ? 'text-white/60' : 'text-accent-500'"
                    >
                      {{ isCurrentClipActive ? 'ON EDITING' : 'CONTINUE EDITING' }}
                    </p>
                    <p class="text-[11px] text-white font-semibold truncate leading-tight">{{ lastClip.theme || lastClip.title || 'Untitled Clip' }}</p>
                    <p class="text-[9px] text-white/60 truncate mt-0.5">{{ lastVideo.title || 'Untitled Video' }}</p>
                  </div>
                </button>

                <div v-else-if="!isProcessing" class="px-2 py-3 rounded-xl border border-dashed border-white/[0.06] text-center text-white/45 text-[10px]">
                  No active projects
                </div>
              </div>
            </div>

              <!-- Changelog Navigation Action (Inside scroll body, pushed to bottom) -->
              <div class="mt-auto pt-2">
                <button 
                  @click="handleNav('changelog')"
                  class="h-10 flex items-center gap-3 px-3 rounded-xl text-white/80 hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer group w-full text-left"
                >
                  <Icon name="lucide:history" class="text-lg shrink-0 group-hover:scale-105 transition-transform" />
                  <span class="text-xs font-medium">Changelog</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>

          <!-- Collapsed Mode Column of Icons (Calibrated Smooth Crossfade) -->
          <Transition
            enter-active-class="transition-opacity duration-200 ease-out delay-75"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-100 ease-in absolute inset-0 w-16 overflow-hidden pointer-events-none"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="isCollapsed" class="h-full w-16 flex flex-col items-center py-3 justify-between bg-black/20 select-none overflow-visible">
          <!-- Top Stack: Command Palette & Navigation Icons -->
          <div class="flex flex-col items-center gap-3.5 w-full px-2">
            <!-- Collapsed Command Palette Trigger Button (Prominent Glowing Circular Button) -->
            <div class="relative group">
              <button 
                @click="palette.open"
                class="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400/20 via-emerald-500/10 to-teal-700/20 border border-accent-500/40 hover:border-accent-500 hover:scale-105 flex items-center justify-center text-accent-500 hover:text-white cursor-pointer relative transition-all shadow-[0_0_15px_rgba(207,255,80,0.15)] group-hover:shadow-[0_0_20px_rgba(207,255,80,0.3)]"
                title="Search (Cmd+K)"
              >
                <Icon name="lucide:search" class="text-base" />
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-500 border-2 border-[#09090b]"></span>
              </button>

              <!-- Flyout Tooltip to the Right -->
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-white/15 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                <span>Search</span>
                <kbd class="px-1 py-0.2 bg-white/[0.08] border border-white/10 rounded font-mono text-[9px] text-white/60">⌘K</kbd>
              </div>
            </div>

            <!-- Divider -->
            <div class="w-7 border-t border-white/[0.08] my-0.5"></div>

            <!-- Navigation Icons Stack with Sliding Indicator Pill -->
            <div class="relative flex flex-col items-center gap-3.5 w-full">
              <!-- Sliding Active Pill for Collapsed Rail -->
              <span 
                v-if="activeNavIndex >= 0" 
                class="absolute -left-2 w-1 rounded-r-full bg-accent-500 shadow-[0_0_8px_rgba(207,255,80,0.6)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] pointer-events-none z-10"
                :style="{
                  top: `${activeNavIndex * 54 + 10}px`,
                  height: '20px'
                }"
              ></span>

              <!-- Nav: Home -->
              <div class="relative group">
                <button 
                  @click="handleNav('home')"
                  class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 cursor-pointer"
                  :class="activeView === 'home' 
                    ? 'bg-white/[0.06] text-accent-500' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon name="lucide:home" class="text-lg" />
                </button>
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                  Home
                </div>
              </div>

              <!-- Nav: Prompts -->
              <div class="relative group">
                <button 
                  @click="handleNav('prompts')"
                  class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 cursor-pointer"
                  :class="activeView === 'prompts' 
                    ? 'bg-white/[0.06] text-accent-500' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon name="lucide:sparkles" class="text-lg" />
                </button>
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                  Prompts
                </div>
              </div>

              <!-- Nav: Docs -->
              <div class="relative group">
                <button 
                  @click="handleNav('docs')"
                  class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 cursor-pointer"
                  :class="activeView === 'docs' 
                    ? 'bg-white/[0.06] text-accent-500' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon name="lucide:book-open" class="text-lg" />
                </button>
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                  Documentation
                </div>
              </div>

              <!-- Nav: Settings -->
              <div class="relative group">
                <button 
                  @click="handleNav('settings')"
                  class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-200 cursor-pointer relative"
                  :class="activeView === 'settings' 
                    ? 'bg-white/[0.06] text-accent-500' 
                    : 'text-white/70 hover:text-white hover:bg-white/[0.04]'"
                >
                  <Icon name="lucide:settings" class="text-lg" />
                  <div 
                    v-if="state?.isAnyPrerequisiteMissing?.value" 
                    class="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-amber"
                    title="Prerequisite setup requires attention in Settings"
                  ></div>
                </button>
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                  Settings
                </div>
              </div>
            </div>

            <!-- Workspace / Movie icon in collapsed mode -->
            <div class="relative group">
              <button 
                :disabled="isCurrentClipActive"
                @click="isCurrentClipActive ? null : handleContinueEditingClick()"
                class="w-10 h-10 rounded-xl bg-white/[0.03] border text-white/70 flex items-center justify-center transition-all relative disabled:pointer-events-none"
                :class="[
                  isProcessing ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse-subtle' : '',
                  isCurrentClipActive 
                    ? 'border-indigo-500/20 text-indigo-400 cursor-default' 
                    : 'border-white/[0.08] hover:border-accent-500/30 hover:text-white cursor-pointer'
                ]"
              >
                <Icon :name="isProcessing ? 'lucide:loader-2' : 'lucide:clapperboard'" :class="{ 'animate-spin': isProcessing }" class="text-lg" />
                <div v-if="lastClip && lastVideo && !isProcessing" class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent-500 rounded-full border border-[#09090b]"></div>
              </button>

              <!-- Workspace hover card drawer -->
              <div class="absolute left-full top-0 ml-3 bg-[#121216] border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-3 w-64 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-x-1 group-hover:translate-x-0 z-[100] flex flex-col gap-2">
                <span class="text-[9px] font-bold uppercase tracking-wider text-white/50 pb-1 border-b border-white/[0.06]">Workspace</span>
                
                <div v-if="isProcessing" class="bg-amber-500/5 rounded-xl p-2.5 border border-amber-500/10">
                  <div class="flex items-center gap-1.5 mb-1">
                    <Icon name="lucide:loader-2" class="text-xs text-amber-400 animate-spin" />
                    <span class="text-[9px] font-bold text-amber-400 uppercase">Active Job</span>
                  </div>
                  <p class="text-[11px] text-white font-medium line-clamp-1">{{ processingTitle }}</p>
                  <p class="text-[9px] text-white/60 font-mono mt-0.5">{{ processingStatus }}</p>
                </div>

                <div v-else-if="lastClip && lastVideo" class="flex items-center gap-2.5">
                  <div class="w-10 h-10 rounded-lg bg-[#141419] overflow-hidden shrink-0 border border-white/[0.08] relative flex items-center justify-center">
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
                    <p class="text-[9px] font-bold uppercase text-accent-500">{{ isCurrentClipActive ? 'ON EDITING' : 'LAST CLIP' }}</p>
                    <p class="text-[11px] text-white font-medium truncate leading-tight">{{ lastClip.theme || lastClip.title || 'Untitled Clip' }}</p>
                    <p class="text-[9px] text-white/60 truncate">{{ lastVideo.title || 'Untitled Video' }}</p>
                  </div>
                </div>
                <div v-else class="text-[10px] text-white/45 italic text-center py-1">No active project.</div>
              </div>
            </div>
          </div>

          <!-- Bottom Stack: Changelog (Pinned to bottom of middle area) -->
          <div class="flex flex-col items-center w-full px-2 mt-auto">
            <!-- Changelog -->
            <div class="relative group">
              <button 
                @click="handleNav('changelog')"
                class="w-10 h-10 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer"
                title="Changelog"
              >
                <Icon name="lucide:history" class="text-lg" />
              </button>
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap">
                Changelog
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

        <!-- Unified Sidebar Utility Footer (Pinned at bottom, Constant Height) -->
        <div class="mt-auto border-t border-white/[0.08] bg-black/20 shrink-0 relative overflow-visible p-3 min-h-[110px] flex flex-col justify-center">
          <!-- Expanded Mode: [1] Cardless Support, [2] Status & Version (Curtain Mask) -->
          <Transition
            enter-active-class="transition-opacity duration-250 ease-out delay-75"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-180 ease-in-out absolute inset-y-0 left-0 p-3 w-[280px] overflow-hidden pointer-events-none"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="!isCollapsed" class="flex flex-col gap-2.5 w-full overflow-visible">
              <!-- Support on Section (Cardless & Borderless) -->
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between px-1">
                  <span class="text-[9px] font-bold uppercase tracking-wider text-white/50">Support on</span>
                  <span class="text-[10px] text-accent-500 font-semibold">@gitkyla</span>
                </div>

                <!-- Two Pill Platform Buttons (Saweria & Trakteer) -->
                <div class="grid grid-cols-2 gap-1.5">
                  <!-- Saweria Link -->
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

                  <!-- Trakteer Link -->
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
          </Transition>

          <!-- Collapsed Mode: Saweria + Trakteer + Status Dot (Calibrated Crossfade) -->
          <Transition
            enter-active-class="transition-opacity duration-200 ease-out delay-75"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-100 ease-in absolute inset-0 w-16 p-2 overflow-hidden pointer-events-none"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="isCollapsed" class="w-10 mx-auto flex flex-col items-center gap-1.5 overflow-visible">
              <!-- Direct Saweria Button -->
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
                <!-- Tooltip -->
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-[#FAAE2B]/30 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#FAAE2B]"></span>
                  <span>Saweria (@gitkyla)</span>
                </div>
              </div>

              <!-- Direct Trakteer Button -->
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
                <!-- Tooltip -->
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-[#121216]/95 border border-[#BE1E2D]/30 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#FF5A65]"></span>
                  <span>Trakteer (@gitkyla)</span>
                </div>
              </div>

              <!-- Divider between Support Buttons and Idle Status Indicator -->
              <div class="w-6 border-t border-white/[0.08] my-1"></div>

              <!-- Status Dot (Idle Symbol) -->
              <div class="flex justify-center relative group py-0.5">
                <div class="w-2.5 h-2.5 rounded-full cursor-help" :class="statusColor"></div>
                <!-- Tooltip -->
                <div class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#121216] border border-white/10 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-[100] whitespace-nowrap flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full" :class="statusColor"></span>
                  <span>{{ statusLabel }}</span>
                </div>
              </div>
            </div>
          </Transition>
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

const props = defineProps<{
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
}>()

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
  : useSafeState<boolean>('yonru_sidebar_collapsed', () => props.defaultCollapsed ?? false)

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
  if (import.meta.client) {
    if (!props.isFloating) {
      const saved = localStorage.getItem('yonru_sidebar_collapsed')
      if (saved !== null) {
        isCollapsed.value = saved === 'true'
      } else if (props.defaultCollapsed !== undefined) {
        isCollapsed.value = props.defaultCollapsed
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
  
  if (import.meta.client && !state?.systemHealth?.value && !state?.checkingHealth?.value) {
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
