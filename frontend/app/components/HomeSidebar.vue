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
    class="h-full shrink-0 transition-all duration-300 ease-in-out font-sans"
    :class="isFloating ? 'w-[64px] relative z-[60]' : 'relative border-r border-surface-border/50 z-30'"
    :style="{ width: isFloating ? '64px' : (isCollapsed ? '64px' : `${sidebarWidth}px`) }"
  >
    <aside 
      class="bg-surface-dark/90 backdrop-blur-md flex flex-col h-full transition-all duration-300 ease-in-out overflow-visible border-r border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.8)]"
      :class="[
        isFloating ? 'absolute top-0 left-0 shadow-2xl border-r border-surface-border/50' : 'relative w-full h-full',
        !isCollapsed && isFloating ? 'backdrop-blur-xl bg-surface-dark/95' : ''
      ]"
      :style="{ width: isCollapsed ? '64px' : `${sidebarWidth}px` }"
    >
      <!-- Toggle Button -->
      <div class="absolute -right-3 top-[72px] z-[9999]">
        <button 
          @click="isCollapsed = !isCollapsed"
          class="w-6 h-6 bg-surface-card border border-surface-border/80 rounded-full flex items-center justify-center text-slate-400 hover:text-accent-500 hover:border-accent-500/50 shadow-md transition-colors"
          :title="isCollapsed ? 'Expand Sidebar (Cmd+B)' : 'Collapse Sidebar (Cmd+B)'"
        >
          <Icon :name="isCollapsed ? 'ri:arrow-right-s-line' : 'ri:arrow-left-s-line'" />
        </button>
      </div>

      <!-- Resizer Handle -->
      <div 
        v-if="!isCollapsed"
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-500/50 transition-colors z-40 group"
        @mousedown="startDrag"
      >
        <div class="absolute inset-y-0 -left-1 -right-1"></div>
      </div>

      <!-- Sidebar Content -->
      <div 
        class="flex flex-col h-full w-full"
        :class="isCollapsed ? 'overflow-visible' : 'overflow-hidden'"
      >
        <!-- Header -->
        <div class="h-14 border-b border-surface-border/50 flex items-center px-4 gap-3 shrink-0 bg-black/20">
          <NuxtLink to="/" class="w-7 h-7 bg-accent-500 flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_rgba(207,255,80,0.3)] hover:scale-105 transition-transform cursor-pointer shrink-0">Y</NuxtLink>
          <div v-if="!isCollapsed" class="overflow-hidden">
            <h1 class="font-bold text-white tracking-widest text-[11px] leading-tight flex items-center gap-2 whitespace-nowrap">YONRU <span class="bg-surface-border/50 text-[7px] px-1.5 py-0.5 rounded text-slate-400 normal-case">INTERNAL</span></h1>
            <p class="text-[9px] text-accent-500 mono whitespace-nowrap font-semibold">AI SHORT ENGINE</p>
          </div>
        </div>

        <!-- Expanded Mode Scrollable Content -->
        <div v-if="!isCollapsed" class="flex-1 overflow-y-auto custom-scrollbar flex flex-col p-3 gap-4">
          
          <!-- Accordion 1: Core Navigation -->
          <div class="flex flex-col gap-1 border-b border-surface-border/20 pb-3">
            <div 
              @click="isNavOpen = !isNavOpen"
              class="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none"
            >
              <span>Navigation</span>
              <Icon :name="isNavOpen ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-xs" />
            </div>
            
            <div v-show="isNavOpen" class="flex flex-col gap-1 mt-1 transition-all duration-300">
              <button 
                @click="handleNav('home')"
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative group cursor-pointer"
                :class="activeView === 'home' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel/50'"
              >
                <div v-if="activeView === 'home'" class="absolute left-0 top-2 bottom-2 w-0.5 bg-accent-500 rounded-full"></div>
                <Icon name="ri:home-smile-fill" class="text-lg shrink-0" />
                <span class="whitespace-nowrap text-xs">Home</span>
              </button>

              <button 
                @click="handleNav('prompts')"
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative group cursor-pointer"
                :class="activeView === 'prompts' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel/50'"
              >
                <div v-if="activeView === 'prompts'" class="absolute left-0 top-2 bottom-2 w-0.5 bg-accent-500 rounded-full"></div>
                <Icon name="ri:chat-quote-fill" class="text-lg shrink-0" />
                <span class="whitespace-nowrap text-xs">Prompts</span>
              </button>

              <button 
                @click="handleNav('docs')"
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative group cursor-pointer"
                :class="activeView === 'docs' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel/50'"
              >
                <div v-if="activeView === 'docs'" class="absolute left-0 top-2 bottom-2 w-0.5 bg-accent-500 rounded-full"></div>
                <Icon name="ri:book-read-fill" class="text-lg shrink-0" />
                <span class="whitespace-nowrap text-xs">Documentation</span>
              </button>

              <button 
                @click="handleNav('settings')"
                class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative group cursor-pointer"
                :class="activeView === 'settings' ? 'bg-accent-500/10 text-accent-500 font-bold' : 'text-slate-400 hover:text-slate-200 hover:bg-surface-panel/50'"
              >
                <div v-if="activeView === 'settings'" class="absolute left-0 top-2 bottom-2 w-0.5 bg-accent-500 rounded-full"></div>
                <Icon name="ri:settings-4-fill" class="text-lg shrink-0" />
                <span class="whitespace-nowrap text-xs">Settings</span>
              </button>
            </div>
          </div>

          <!-- Accordion 2: Active Project & Cache -->
          <div class="flex flex-col gap-1 border-b border-surface-border/20 pb-3">
            <div 
              @click="isProjectOpen = !isProjectOpen"
              class="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none"
            >
              <span>Workspace</span>
              <div class="flex items-center gap-2">
                <span v-if="isProcessing" class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                <Icon :name="isProjectOpen ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-xs" />
              </div>
            </div>

            <div v-show="isProjectOpen" class="flex flex-col gap-3 mt-2">
              <!-- Active Job Panel -->
              <div v-if="isProcessing" class="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 animate-pulse-subtle">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span class="text-[9px] font-bold text-amber-500 tracking-wider uppercase">Active Job</span>
                </div>
                <p class="text-[11px] text-white font-medium line-clamp-1 mb-1">{{ processingTitle }}</p>
                <p class="text-[9px] text-slate-400 uppercase tracking-wider font-mono">{{ processingStatus }}</p>
              </div>

              <!-- Continue Editing Card -->
              <button 
                v-if="lastClip && lastVideo && !isProcessing"
                :disabled="isCurrentClipActive"
                @click="isCurrentClipActive ? null : handleContinueEditingClick()"
                class="flex items-center gap-3 p-2 rounded-xl transition-all group bg-surface-panel/30 border text-left w-full disabled:pointer-events-none"
                :class="isCurrentClipActive 
                  ? 'border-indigo-500/20 cursor-default' 
                  : 'border-white/5 hover:border-accent-500/20 cursor-pointer'"
              >
                <div class="w-10 h-10 rounded bg-surface-dark overflow-hidden shrink-0 border border-white/5 group-hover:border-accent-500/30 relative">
                   <img v-if="lastVideo.thumbnail" :src="`${API_BASE}/api/proxy-image?url=${encodeURIComponent(lastVideo.thumbnail)}`" class="w-full h-full object-cover" />
                   <div v-else class="w-full h-full flex items-center justify-center bg-accent-500/10 text-accent-500 text-xs">
                     <Icon name="ri:movie-2-line" />
                   </div>
                   <div 
                     v-if="!isCurrentClipActive"
                     class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Icon name="ri:edit-2-fill" class="text-white text-xs" />
                   </div>
                </div>
                <div class="overflow-hidden flex-1">
                  <p 
                    class="text-[9px] font-bold uppercase tracking-tighter leading-none mb-1"
                    :class="isCurrentClipActive ? 'text-slate-400' : 'text-accent-500'"
                  >
                    {{ isCurrentClipActive ? 'ON EDITING' : 'CONTINUE EDITING' }}
                  </p>
                  <p class="text-[11px] text-white font-bold truncate leading-tight">{{ lastClip.theme || lastClip.title || 'Untitled Clip' }}</p>
                  <p class="text-[9px] text-slate-500 truncate mt-0.5">{{ lastVideo.title || 'Untitled Video' }}</p>
                </div>
              </button>

              <div v-else-if="!isProcessing" class="text-center text-slate-600 text-[10px] py-4">
                No active projects.
              </div>
            </div>
          </div>

          <!-- Accordion 3: System Health & Status -->
          <div class="flex flex-col gap-1 pb-3">
            <div 
              @click="isHealthOpen = !isHealthOpen"
              class="flex items-center justify-between px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 cursor-pointer hover:text-slate-300 transition-colors select-none"
            >
              <span>System Health</span>
              <div class="flex items-center gap-2">
                <div 
                  v-if="state?.isAnyPrerequisiteMissing?.value"
                  class="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse-amber mr-1"
                ></div>
                <Icon :name="isHealthOpen ? 'ri:arrow-up-s-line' : 'ri:arrow-down-s-line'" class="text-xs" />
              </div>
            </div>

            <div v-show="isHealthOpen" class="flex flex-col gap-3 mt-2">
              
              <!-- System Status Dashboard Checklist -->
              <div class="bg-black/20 rounded-xl p-3 border border-white/5 flex flex-col gap-2">
                <!-- Status Row Template -->
                <button 
                  v-for="item in systemHealthItems"
                  :key="item.id"
                  @click="scrollToSettingsSection(item.id)"
                  class="flex items-center justify-between py-1.5 px-2 hover:bg-white/5 rounded text-[10px] text-slate-400 text-left font-bold transition-all border border-transparent hover:border-white/5 cursor-pointer"
                >
                  <div class="flex items-center gap-2">
                    <Icon 
                      :name="item.icon" 
                      class="text-sm shrink-0" 
                      :class="item.loading ? 'opacity-40 animate-pulse text-slate-500' : (item.ok ? 'text-slate-500' : 'text-amber-500')" 
                    />
                    <span class="tracking-wider uppercase" :class="{ 'opacity-60': item.loading }">{{ item.name }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 font-mono">
                    <Icon 
                      v-if="item.loading" 
                      name="ri:loader-4-line" 
                      class="animate-spin text-accent-500 text-xs" 
                    />
                    <template v-else>
                      <span class="w-1.5 h-1.5 rounded-full" :class="item.ok ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'"></span>
                      <span :class="item.ok ? 'text-slate-300' : 'text-amber-400 font-bold'">{{ item.label }}</span>
                    </template>
                  </div>
                </button>
              </div>

              <!-- Storage Summary -->
              <div class="flex items-center justify-between px-2 text-[10px] text-slate-500 font-bold">
                <div class="flex items-center gap-2">
                  <Icon name="ri:database-2-line" class="text-sm text-slate-600" />
                  <span>{{ cachedVideos.length }} SOURCE(S) CACHED</span>
                </div>
                <span class="text-[9px] text-slate-600 font-mono">V.0.4.2</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Collapsed Mode Column of Icons -->
        <div v-else class="flex-1 flex flex-col items-center py-6 justify-start bg-black/10 select-none">
          <!-- Top Stack: Navigation Icons & Diagnostics -->
          <div class="flex flex-col items-center gap-4 w-full">
            <!-- Nav Item: Home -->
            <div class="relative group">
              <button 
                @click="handleNav('home')"
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer"
                :class="activeView === 'home' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20 shadow-[0_0_15px_rgba(207,255,80,0.15)]' : 'text-slate-400 hover:text-white hover:bg-surface-panel/30 border border-transparent hover:border-white/5'"
              >
                <Icon name="ri:home-smile-fill" class="text-xl" />
              </button>
              <!-- Tooltip -->
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-50 whitespace-nowrap">
                Home
              </div>
            </div>

            <!-- Nav Item: Prompts -->
            <div class="relative group">
              <button 
                @click="handleNav('prompts')"
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer"
                :class="activeView === 'prompts' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20 shadow-[0_0_15px_rgba(207,255,80,0.15)]' : 'text-slate-400 hover:text-white hover:bg-surface-panel/30 border border-transparent hover:border-white/5'"
              >
                <Icon name="ri:chat-quote-fill" class="text-xl" />
              </button>
              <!-- Tooltip -->
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-50 whitespace-nowrap">
                Prompts
              </div>
            </div>

            <!-- Nav Item: Documentation -->
            <div class="relative group">
              <button 
                @click="handleNav('docs')"
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer"
                :class="activeView === 'docs' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20 shadow-[0_0_15px_rgba(207,255,80,0.15)]' : 'text-slate-400 hover:text-white hover:bg-surface-panel/30 border border-transparent hover:border-white/5'"
              >
                <Icon name="ri:book-read-fill" class="text-xl" />
              </button>
              <!-- Tooltip -->
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-50 whitespace-nowrap">
                Documentation
              </div>
            </div>

            <!-- Nav Item: Settings -->
            <div class="relative group">
              <button 
                @click="handleNav('settings')"
                class="w-10 h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer"
                :class="activeView === 'settings' ? 'bg-accent-500/10 text-accent-500 border border-accent-500/20 shadow-[0_0_15px_rgba(207,255,80,0.15)]' : 'text-slate-400 hover:text-white hover:bg-surface-panel/30 border border-transparent hover:border-white/5'"
              >
                <Icon name="ri:settings-4-fill" class="text-xl" />
              </button>
              <!-- Tooltip -->
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-3 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 z-50 whitespace-nowrap">
                Settings
              </div>
            </div>

            <!-- Separator Divider -->
            <div class="w-8 border-t border-white/10 my-1"></div>

            <!-- Workspace / Active Project Indicator -->
            <div class="relative group">
              <button 
                :disabled="isCurrentClipActive"
                @click="isCurrentClipActive ? null : handleContinueEditingClick()"
                class="w-10 h-10 rounded-xl bg-surface-panel/40 border text-slate-400 flex items-center justify-center transition-all relative disabled:pointer-events-none"
                :class="[
                  isProcessing ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse-subtle' : '',
                  isCurrentClipActive 
                    ? 'border-indigo-500/20 text-indigo-400 cursor-default' 
                    : 'border-white/5 hover:border-accent-500/20 hover:text-white cursor-pointer'
                ]"
              >
                <Icon :name="isProcessing ? 'ri:loader-4-line' : 'ri:movie-2-fill'" :class="{ 'animate-spin': isProcessing }" class="text-xl" />
                <div v-if="lastClip && lastVideo && !isProcessing" class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-500 rounded-full border-2 border-surface-dark shadow-[0_0_8px_rgba(207,255,80,0.6)]"></div>
              </button>
              <!-- Project hover card drawer -->
              <div class="absolute left-full top-0 ml-3 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-xl rounded-2xl shadow-2xl p-4 w-72 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-x-2 group-hover:translate-x-0 z-50 flex flex-col gap-3">
                <span class="text-[9px] font-black uppercase tracking-wider text-slate-500 pb-1 border-b border-white/5">Workspace</span>
                <!-- Processing job details -->
                <div v-if="isProcessing" class="bg-amber-500/5 rounded-xl p-3 border border-amber-500/10 animate-pulse-subtle">
                  <div class="flex items-center gap-2 mb-2">
                    <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                    <span class="text-[9px] font-bold text-amber-500 tracking-wider uppercase">Active Job</span>
                  </div>
                  <p class="text-[11px] text-white font-medium line-clamp-1 mb-1">{{ processingTitle }}</p>
                  <p class="text-[9px] text-slate-400 uppercase tracking-wider font-mono">{{ processingStatus }}</p>
                </div>
                <!-- Last Clip Card -->
                <button 
                  v-else-if="lastClip && lastVideo && !isProcessing"
                  :disabled="isCurrentClipActive"
                  @click="isCurrentClipActive ? null : handleContinueEditingClick()"
                  class="flex items-center gap-3 p-2 rounded-xl transition-all group bg-surface-panel/30 border text-left w-full disabled:pointer-events-none"
                  :class="isCurrentClipActive 
                    ? 'border-indigo-500/20 cursor-default' 
                    : 'border-white/5 hover:border-accent-500/20 cursor-pointer'"
                >
                  <div class="w-10 h-10 rounded bg-surface-dark overflow-hidden shrink-0 border border-white/5 group-hover:border-accent-500/30 relative">
                     <img v-if="lastVideo.thumbnail" :src="`${API_BASE}/api/proxy-image?url=${encodeURIComponent(lastVideo.thumbnail)}`" class="w-full h-full object-cover" />
                     <div v-else class="w-full h-full flex items-center justify-center bg-accent-500/10 text-accent-500 text-xs">
                       <Icon name="ri:movie-2-line" />
                     </div>
                     <div 
                       v-if="!isCurrentClipActive"
                       class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                       <Icon name="ri:edit-2-fill" class="text-white text-xs" />
                     </div>
                  </div>
                  <div class="overflow-hidden flex-1">
                     <p 
                       class="text-[9px] font-bold uppercase tracking-tighter leading-none mb-1"
                       :class="isCurrentClipActive ? 'text-slate-400' : 'text-accent-500'"
                     >
                       {{ isCurrentClipActive ? 'ON EDITING' : 'CONTINUE EDITING' }}
                     </p>
                     <p class="text-[11px] text-white font-bold truncate leading-tight">{{ lastClip.theme || lastClip.title || 'Untitled Clip' }}</p>
                     <p class="text-[9px] text-slate-500 truncate mt-0.5">{{ lastVideo.title || 'Untitled Video' }}</p>
                  </div>
                </button>
                <div v-else class="text-[10px] text-slate-500 italic text-center py-2">No active project.</div>
              </div>
            </div>

            <!-- System Health / Diagnostics Indicator -->
            <div class="relative group">
              <button 
                @click="scrollToSettingsSection('settings-health')"
                class="w-10 h-10 rounded-xl bg-surface-panel/40 border border-white/5 hover:border-accent-500/20 text-slate-400 hover:text-white flex items-center justify-center transition-all relative cursor-pointer"
              >
                <Icon name="ri:database-2-line" class="text-xl" />
                <!-- Status Dot Overlay -->
                <div class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-dark shadow-[0_0_6px_rgba(0,0,0,0.5)] animate-pulse-subtle" :class="healthDotColor"></div>
              </button>
              <!-- Health hover card drawer -->
              <div class="absolute left-full top-0 ml-3 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-xl rounded-2xl shadow-2xl p-4 w-72 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all translate-x-2 group-hover:translate-x-0 z-50 flex flex-col gap-3">
                <div class="flex justify-between items-center pb-1 border-b border-white/5">
                  <span class="text-[9px] font-black uppercase tracking-wider text-slate-500">System Health</span>
                  <div class="flex items-center gap-2">
                    <div 
                      v-if="state?.isAnyPrerequisiteMissing?.value"
                      class="w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse-amber"
                    ></div>
                    <span class="text-[9px] text-slate-600 font-mono">V.0.4.2</span>
                  </div>
                </div>

                <!-- System Status Dashboard Checklist -->
                <div class="bg-black/20 rounded-xl p-2 border border-white/5 flex flex-col gap-1.5">
                  <button 
                    v-for="item in systemHealthItems"
                    :key="item.id"
                    @click="scrollToSettingsSection(item.id)"
                    class="flex items-center justify-between py-1.5 px-2 hover:bg-white/5 rounded text-[10px] text-slate-400 text-left font-bold transition-all border border-transparent hover:border-white/5 cursor-pointer"
                  >
                    <div class="flex items-center gap-2">
                      <Icon 
                        :name="item.icon" 
                        class="text-sm shrink-0" 
                        :class="item.loading ? 'opacity-40 animate-pulse text-slate-500' : (item.ok ? 'text-slate-500' : 'text-amber-500')" 
                      />
                      <span class="tracking-wider uppercase" :class="{ 'opacity-60': item.loading }">{{ item.name }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 font-mono">
                      <Icon 
                        v-if="item.loading" 
                        name="ri:loader-4-line" 
                        class="animate-spin text-accent-500 text-xs" 
                      />
                      <template v-else>
                        <span class="w-1.5 h-1.5 rounded-full" :class="item.ok ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'"></span>
                        <span :class="item.ok ? 'text-slate-300' : 'text-amber-400 font-bold'">{{ item.label }}</span>
                      </template>
                    </div>
                  </button>
                </div>

                <!-- Storage Summary -->
                <div class="flex items-center justify-between px-2 text-[10px] text-slate-500 font-bold">
                  <div class="flex items-center gap-2">
                    <Icon name="ri:database-2-line" class="text-sm text-slate-600" />
                    <span>{{ cachedVideos.length }} SOURCE(S) CACHED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer / Status indicator -->
        <div class="mt-auto border-t border-surface-border/50 bg-black/15 p-4 shrink-0">
          <div v-if="!isCollapsed" class="flex items-center justify-between">
            <span class="text-[9px] uppercase font-bold text-slate-500 tracking-wider">System Status</span>
            <div class="flex items-center gap-1.5 mono text-[10px] text-slate-300 font-bold">
               <span class="w-1.5 h-1.5 rounded-full" :class="statusColor"></span>
               {{ statusLabel }}
            </div>
          </div>
          <div v-else class="flex justify-center relative group">
            <div class="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.1)] cursor-help" :class="statusColor"></div>
            <!-- Tooltip -->
            <div class="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-surface-dark/95 border border-surface-border/50 backdrop-blur-md rounded-lg py-1 px-2.5 text-[10px] font-bold text-white shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0 z-50 whitespace-nowrap flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full" :class="statusColor"></span>
              <span>System: {{ statusLabel }}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

const state = useClipperState()

const isCurrentClipActive = computed(() => {
  return props.activeView === 'editor'
})

const isSystemOK = computed(() => {
  const health = state?.systemHealth?.value
  if (!health) return false
  return ['ffmpeg', 'node', 'python_env'].every(key => health[key]?.status === 'OK')
})

const isApiConfigured = computed(() => {
  const health = state?.systemHealth?.value
  if (!health) return false
  return health.gemini_api?.status === 'Configured'
})

const isCookiesConfigured = computed(() => {
  const health = state?.systemHealth?.value
  if (!health) return false
  return health.cookies?.status === 'Configured'
})

const isHealthLoading = computed(() => {
  return state?.checkingHealth?.value || !state?.systemHealth?.value
})

const healthDotColor = computed(() => {
  if (isHealthLoading.value) return 'bg-indigo-500 animate-pulse'
  if (state?.isAnyPrerequisiteMissing?.value) return 'bg-amber-500 animate-pulse-amber'
  return 'bg-emerald-500'
})

const systemHealthItems = computed(() => [
  { 
    id: 'settings-health', 
    name: 'FFmpeg & Diagnostics', 
    ok: isSystemOK.value, 
    label: isSystemOK.value ? 'OK' : 'Error', 
    icon: 'ri:shield-cross-line', 
    loading: isHealthLoading.value 
  },
  { 
    id: 'settings-api', 
    name: 'Gemini API Key', 
    ok: isApiConfigured.value, 
    label: isApiConfigured.value ? 'OK' : 'Missing', 
    icon: 'ri:key-2-line', 
    loading: isHealthLoading.value 
  },
  { 
    id: 'settings-whisper', 
    name: 'Whisper Transcriber', 
    ok: true, 
    label: (state?.whisperModel?.value || 'BASE').toUpperCase(), 
    icon: 'ri:cpu-line', 
    loading: false 
  },
  { 
    id: 'settings-cookies', 
    name: 'YouTube Cookies', 
    ok: isCookiesConfigured.value, 
    label: isCookiesConfigured.value ? 'OK' : 'Unconfigured', 
    icon: 'ri:shield-keyhole-line', 
    loading: isHealthLoading.value 
  },
  { 
    id: 'settings-env', 
    name: 'Environment Paths', 
    ok: true, 
    label: 'Verified', 
    icon: 'ri:terminal-window-line', 
    loading: false 
  }
])

const statusColor = computed(() => {
  const status = state?.jobStatus?.value || 'idle'
  const map: Record<string, string> = {
    idle: 'bg-slate-600',
    queued: 'bg-amber-500',
    downloading_audio: 'bg-sky-500 animate-pulse',
    transcribing: 'bg-violet-500 animate-pulse',
    generating_hooks: 'bg-fuchsia-500 animate-pulse',
    hooks_ready: 'bg-accent-500 shadow-[0_0_8px_#CFFF50]',
    extracting_video: 'bg-sky-500 animate-pulse',
    cutting: 'bg-sky-400 animate-pulse',
    ready: 'bg-accent-500 shadow-[0_0_8px_#CFFF50]',
    error: 'bg-red-500 shadow-[0_0_8px_#ef4444]'
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
  processingTitle?: string
  processingStatus?: string
  lastVideo?: any
  lastClip?: any
  API_BASE: string
  defaultCollapsed?: boolean
  isFloating?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeView', view: string): void
}>()

const isCollapsed = props.isFloating 
  ? ref(props.defaultCollapsed ?? true)
  : useState<boolean>('yonru_sidebar_collapsed', () => props.defaultCollapsed ?? false)

watch(isCollapsed, (newVal) => {
  if (!props.isFloating) {
    localStorage.setItem('yonru_sidebar_collapsed', newVal.toString())
  }
})
const sidebarWidth = ref(320)
const minWidth = 280
const maxWidth = 600
let isDragging = false

// Accordion open states
const isNavOpen = ref(true)
const isProjectOpen = ref(true)
const isHealthOpen = ref(true)

function handleNav(view: string) {
  const router = useRouter()
  emit('update:activeView', view)
  if (view === 'settings') {
    router.push('/settings')
  } else if (view === 'prompts') {
    router.push('/prompts')
  } else if (view === 'docs') {
    router.push('/docs')
  } else if (view === 'home') {
    router.push('/')
  }
  if (props.isFloating) {
    isCollapsed.value = true
  }
}

async function handleContinueEditingClick() {
  if (isCurrentClipActive.value) return
  const router = useRouter()
  if (!props.lastClip || !props.lastVideo) return
  
  try {
    if (state?.isNavigatingToEditor) {
      state.isNavigatingToEditor.value = true
    }
    const minWait = new Promise(resolve => setTimeout(resolve, 600))
    
    const folder = props.lastClip.folder || props.lastClip.folder_name
    // Load the clip into state first to get a job_id
    await state.loadReadyClipIntoEditor(folder, props.lastClip.clip_id)
    
    // Find matching hook index in the loaded hooks list to highlight correctly
    let hookIndex = 0
    let tab = 'generated'
    
    const clipId = props.lastClip.clip_id || ''
    const parts = clipId.split('_')
    if (parts.length >= 2) {
      const clipStart = parseFloat(parts[0]) || 0
      const clipEnd = parseFloat(parts[1]) || 0
      
      // Helper to find the best matching hook by minimum timestamp distance
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

function scrollToSettingsSection(sectionId: string) {
  if (props.activeView !== 'settings') {
    handleNav('settings')
  }
  if (state?.settingsScrollTarget) {
    state.settingsScrollTarget.value = sectionId
  }
}

function startDrag(e: MouseEvent) {
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
  if (import.meta.client && !props.isFloating) {
    const saved = localStorage.getItem('yonru_sidebar_collapsed')
    if (saved !== null) {
      isCollapsed.value = saved === 'true'
    }
  }
  const savedWidth = localStorage.getItem('yonru_sidebar_width')
  if (savedWidth) {
    sidebarWidth.value = parseInt(savedWidth)
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('keydown', handleKeydown)
  
  // Load system health if not yet fetched
  if (import.meta.client && !state?.systemHealth?.value && !state?.checkingHealth?.value) {
    state.checkSystemHealth()
  }
  
  // Open workspace and health accordions if prerequisites are missing
  if (state?.isAnyPrerequisiteMissing?.value) {
    isHealthOpen.value = true
  }
  if (props.isProcessing || props.lastClip) {
    isProjectOpen.value = true
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
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.05);
  border-radius: 0;
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
