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
      @click="isCollapsed = true; isProfileMenuOpen = false"
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
              @click="isCollapsed = !isCollapsed; isProfileMenuOpen = false"
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
              <!-- Top Section: Niche Profile Switcher Card -->
              <div class="p-3 pb-0 shrink-0 relative overflow-visible z-50">
                <div class="relative profile-popover-container" ref="profileContainerRef">
                  <button 
                    @click.stop="toggleProfileMenu"
                    class="w-full flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/15 transition-all group cursor-pointer text-left"
                    :class="{ 'border-accent-500/30 bg-accent-500/5': isProfileMenuOpen }"
                  >
                    <div class="flex items-center gap-3 min-w-0">
                      <div 
                        class="w-10 h-10 rounded-full bg-gradient-to-br border border-white/20 flex items-center justify-center text-white shrink-0 relative shadow-sm"
                        :class="activeProfile.gradient || 'from-lime-400 to-emerald-600'"
                      >
                        <Icon :name="activeProfile.icon || 'lucide:sparkles'" class="text-base text-white" />
                        <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#09090b]"></span>
                      </div>
                      <div class="overflow-hidden min-w-0 grid justify-center gap-0.5">
                        <p class="text-[12px] font-semibold text-white truncate leading-tight">{{ activeProfile.name }}</p>
                        <span class="inline-block text-[9px] text-white/70 bg-white/[0.04]px-1.5 py-0.5 rounded font-medium truncate max-w-[150px] leading-none">{{ activeProfile.niche }}</span>
                      </div>
                    </div>
                    <Icon 
                      name="lucide:chevrons-up-down" 
                      class="text-white/60 group-hover:text-white text-xs shrink-0 transition-transform duration-200"
                      :class="{ 'rotate-180 text-accent-500': isProfileMenuOpen }" 
                    />
                  </button>

                  <!-- Floating Niche Profile Popover Menu (Flyout to the RIGHT) -->
                  <Transition
                    enter-active-class="transition duration-150 ease-out"
                    enter-from-class="opacity-0 translate-x-2 scale-95"
                    enter-to-class="opacity-100 translate-x-0 scale-100"
                    leave-active-class="transition duration-100 ease-in"
                    leave-from-class="opacity-100 translate-x-0 scale-100"
                    leave-to-class="opacity-0 translate-x-2 scale-95"
                  >
                    <div 
                      v-if="isProfileMenuOpen" 
                      @click.stop
                      class="absolute left-full top-0 ml-3 w-72 bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-3 z-[9999] flex flex-col gap-2.5 backdrop-blur-xl"
                    >
                      <Transition
                        mode="out-in"
                        :enter-active-class="navigationDirection === 'forward' ? 'transition-all duration-150 ease-out' : 'transition-all duration-150 ease-out'"
                        :enter-from-class="navigationDirection === 'forward' ? 'opacity-0 translate-x-3' : 'opacity-0 -translate-x-3'"
                        :enter-to-class="'opacity-100 translate-x-0'"
                        :leave-active-class="navigationDirection === 'forward' ? 'transition-all duration-100 ease-in' : 'transition-all duration-100 ease-in'"
                        :leave-from-class="'opacity-100 translate-x-0'"
                        :leave-to-class="navigationDirection === 'forward' ? 'opacity-0 -translate-x-3' : 'opacity-0 translate-x-3'"
                      >
                        <!-- MODE 1: Profile List -->
                        <div v-if="!isCreatingProfile" key="profile-list" class="flex flex-col gap-2">
                          <div class="px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.06] flex items-center justify-between">
                            <span>Switch Profile</span>
                            <span class="text-[8px] text-accent-500 font-mono">{{ profiles.length }} PROFILES</span>
                          </div>

                          <!-- Profile Items List with TransitionGroup -->
                          <TransitionGroup 
                            tag="div" 
                            class="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-0.5"
                            enter-active-class="transition-all duration-200 ease-out"
                            enter-from-class="opacity-0 -translate-y-1.5 scale-95"
                            enter-to-class="opacity-100 translate-y-0 scale-100"
                            leave-active-class="transition-all duration-150 ease-in"
                            leave-from-class="opacity-100 translate-y-0 scale-100"
                            leave-to-class="opacity-0 -translate-y-1.5 scale-95"
                            move-class="transition-all duration-200 ease-out"
                          >
                            <div 
                              v-for="profile in profiles" 
                              :key="profile.id"
                              @click="selectProfile(profile)"
                              class="flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group relative hover:bg-white/[0.04]"
                              :class="activeProfile.id === profile.id ? 'bg-white/[0.06] border border-white/15' : 'border border-transparent'"
                            >
                              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <!-- Dynamic Gradient Avatar (Circle) -->
                                <div 
                                  class="w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white shrink-0 border border-white/15 shadow-sm transition-transform duration-200 group-hover:scale-105"
                                  :class="profile.gradient || 'from-lime-400 to-emerald-600'"
                                >
                                  <Icon :name="profile.icon || 'lucide:sparkles'" class="text-sm text-white" />
                                </div>
                                <div class="overflow-hidden min-w-0 flex-1 grid gap-0.5">
                                  <p class="text-[11px] font-semibold text-white truncate leading-tight">{{ profile.name }}</p>
                                  <span class="inline-block text-[9px] text-white/60 py-0.5 rounded truncate max-w-[130px] leading-none">{{ profile.niche }}</span>
                                </div>
                              </div>

                              <div class="flex items-center gap-1 shrink-0 ml-2">
                                <!-- Active Checkmark -->
                                <Icon v-if="activeProfile.id === profile.id" name="lucide:check" class="text-xs text-accent-500 mr-0.5" />
                                
                                <!-- Edit button -->
                                <button 
                                  @click.stop="startEditProfile(profile, $event)"
                                  class="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 cursor-pointer"
                                  title="Edit Profile"
                                >
                                  <Icon name="lucide:pencil" class="text-[10px]" />
                                </button>

                                <!-- Delete button (if > 1) -->
                                <button 
                                  v-if="profiles.length > 1"
                                  @click.stop="deleteProfile(profile.id, $event)"
                                  class="w-6 h-6 rounded-md hover:bg-red-500/20 flex items-center justify-center text-white/40 hover:text-red-400 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 cursor-pointer"
                                  title="Delete Profile"
                                >
                                  <Icon name="lucide:trash-2" class="text-[10px]" />
                                </button>
                              </div>
                            </div>
                          </TransitionGroup>

                          <!-- Add New Profile Action -->
                          <div class="pt-1 border-t border-white/[0.06]">
                            <button 
                              @click="startCreateProfile"
                              class="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-white/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/15 text-[11px] font-medium transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                            >
                              <Icon name="lucide:plus" class="text-xs text-accent-500" />
                              <span>Create Profile</span>
                            </button>
                          </div>
                        </div>

                        <!-- MODE 2: Inline Creation / Edit Form -->
                        <div v-else key="profile-form" class="flex flex-col gap-2.5">
                          <div class="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                            <button 
                              @click="cancelProfileForm" 
                              class="flex items-center gap-1 text-[10px] font-medium text-white/60 hover:text-white cursor-pointer transition-all active:scale-95"
                            >
                              <Icon name="lucide:arrow-left" class="text-xs" />
                              <span>Back</span>
                            </button>
                            <span class="text-[9px] font-bold uppercase tracking-wider text-accent-500 font-mono">
                              {{ editingProfileId ? 'Edit Profile' : 'New Profile' }}
                            </span>
                          </div>

                          <!-- Live Avatar & Preview Banner -->
                          <div class="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <div 
                              class="w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white shrink-0 border border-white/20 shadow-sm transition-all duration-200 ease-out"
                              :class="profileForm.gradient"
                            >
                              <Icon :name="profileForm.icon" class="text-lg text-white" />
                            </div>
                            <div class="overflow-hidden min-w-0 flex-1">
                              <p class="text-xs font-semibold text-white truncate">{{ profileForm.name || 'Untitled Profile' }}</p>
                              <p class="text-[10px] text-white/60 truncate mt-0.5">{{ profileForm.niche || 'General' }}</p>
                            </div>
                          </div>

                          <!-- Input 1: Profile Name -->
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Profile Name</label>
                            <input 
                              v-model="profileForm.name" 
                              type="text" 
                              placeholder="e.g. Podcast Shorts"
                              maxlength="30"
                              class="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent-500/60 focus:bg-white/[0.06] focus:outline-none transition-all"
                            />
                          </div>

                          <!-- Input 2: Category (Manual Input + Quick Presets) -->
                          <div class="flex flex-col gap-1">
                            <div class="flex items-center justify-between">
                              <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Category</label>
                              <span class="text-[8px] text-white/40">Manual or Preset</span>
                            </div>
                            <input 
                              v-model="profileForm.niche" 
                              type="text" 
                              placeholder="e.g. Finance & Crypto, Cooking, Vlog"
                              maxlength="35"
                              class="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent-500/60 focus:bg-white/[0.06] focus:outline-none transition-all"
                            />
                            <div class="flex flex-wrap gap-1 mt-0.5">
                              <button 
                                v-for="cat in CATEGORY_TAG_PRESETS" 
                                :key="cat.niche"
                                type="button"
                                @click="applyQuickCategory(cat)"
                                class="px-2 py-0.5 rounded-md text-[9px] font-medium transition-all active:scale-95 hover:scale-105 border cursor-pointer"
                                :class="profileForm.niche === cat.niche ? 'bg-white/15 border-accent-500/60 text-white font-bold' : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.06]'"
                              >
                                {{ cat.niche.split(' ')[0] }}
                              </button>
                            </div>
                          </div>

                          <!-- Icon Grid Selector -->
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Icon</label>
                            <div class="grid grid-cols-5 gap-1.5">
                              <button 
                                v-for="item in ICON_PRESETS" 
                                :key="item.icon"
                                type="button"
                                @click="profileForm.icon = item.icon"
                                class="h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 hover:scale-105 border cursor-pointer"
                                :class="profileForm.icon === item.icon ? 'bg-accent-500/20 border-accent-500 text-accent-500' : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.06]'"
                                :title="item.label"
                              >
                                <Icon :name="item.icon" class="text-xs" />
                              </button>
                            </div>
                          </div>

                          <!-- Color Gradient Selector -->
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Color Palette</label>
                            <div class="grid grid-cols-8 gap-1.5">
                              <button 
                                v-for="grad in GRADIENT_PRESETS" 
                                :key="grad.gradient"
                                type="button"
                                @click="profileForm.gradient = grad.gradient"
                                class="w-6 h-6 rounded-full bg-gradient-to-br transition-all active:scale-90 hover:scale-110 border cursor-pointer mx-auto"
                                :class="[
                                  grad.gradient,
                                  profileForm.gradient === grad.gradient ? 'border-white scale-110 shadow-sm' : 'border-white/10 hover:scale-105 opacity-80 hover:opacity-100'
                                ]"
                                :title="grad.name"
                              ></button>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                            <button 
                              type="button"
                              @click="cancelProfileForm"
                              class="flex-1 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] border border-white/[0.06] text-[10px] font-medium transition-all active:scale-95 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button 
                              type="button"
                              :disabled="!profileForm.name.trim()"
                              @click="saveProfileForm"
                              class="flex-1 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-black text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-sm"
                            >
                              {{ editingProfileId ? 'Save' : 'Create' }}
                            </button>
                          </div>
                        </div>
                      </Transition>
                    </div>
                  </Transition>
                </div>
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
                  @click="handleNav('docs')"
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
          <!-- Top Stack: Profile & Navigation Icons -->
          <div class="flex flex-col items-center gap-3.5 w-full px-2">
            <!-- Collapsed Profile Avatar Trigger (Dynamic Gradient Avatar - Circle) -->
            <div class="relative profile-popover-container">
              <button 
                @click.stop="toggleProfileMenu"
                class="w-10 h-10 rounded-full bg-gradient-to-br border border-white/20 flex items-center justify-center text-white cursor-pointer relative hover:scale-105 transition-all shadow-sm"
                :class="activeProfile.gradient || 'from-lime-400 to-emerald-600'"
                title="Switch Profile"
              >
                <Icon :name="activeProfile.icon || 'lucide:sparkles'" class="text-base text-white" />
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#09090b]"></span>
              </button>
              
              <!-- Floating Profile Popover Menu in Collapsed Mode (Flyout to the RIGHT) -->
              <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 translate-x-2 scale-95"
                enter-to-class="opacity-100 translate-x-0 scale-100"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100 translate-x-0 scale-100"
                leave-to-class="opacity-0 translate-x-2 scale-95"
              >
                <div 
                  v-if="isProfileMenuOpen" 
                  @click.stop
                  class="absolute left-full top-0 ml-3 w-72 bg-[#121216] border border-white/10 rounded-2xl shadow-2xl p-3 z-[9999] flex flex-col gap-2.5 backdrop-blur-xl"
                >
                      <Transition
                        mode="out-in"
                        :enter-active-class="navigationDirection === 'forward' ? 'transition-all duration-150 ease-out' : 'transition-all duration-150 ease-out'"
                        :enter-from-class="navigationDirection === 'forward' ? 'opacity-0 translate-x-3' : 'opacity-0 -translate-x-3'"
                        :enter-to-class="'opacity-100 translate-x-0'"
                        :leave-active-class="navigationDirection === 'forward' ? 'transition-all duration-100 ease-in' : 'transition-all duration-100 ease-in'"
                        :leave-from-class="'opacity-100 translate-x-0'"
                        :leave-to-class="navigationDirection === 'forward' ? 'opacity-0 -translate-x-3' : 'opacity-0 translate-x-3'"
                      >
                        <!-- MODE 1: Profile List -->
                        <div v-if="!isCreatingProfile" key="profile-list" class="flex flex-col gap-2">
                          <div class="px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50 border-b border-white/[0.06] flex items-center justify-between">
                            <span>Switch Profile</span>
                            <span class="text-[8px] text-accent-500 font-mono">{{ profiles.length }} PROFILES</span>
                          </div>

                          <!-- Profile Items List with TransitionGroup -->
                          <TransitionGroup 
                            tag="div" 
                            class="flex flex-col gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-0.5"
                            enter-active-class="transition-all duration-200 ease-out"
                            enter-from-class="opacity-0 -translate-y-1.5 scale-95"
                            enter-to-class="opacity-100 translate-y-0 scale-100"
                            leave-active-class="transition-all duration-150 ease-in"
                            leave-from-class="opacity-100 translate-y-0 scale-100"
                            leave-to-class="opacity-0 -translate-y-1.5 scale-95"
                            move-class="transition-all duration-200 ease-out"
                          >
                            <div 
                              v-for="profile in profiles" 
                              :key="profile.id"
                              @click="selectProfile(profile)"
                              class="flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer group relative hover:bg-white/[0.04]"
                              :class="activeProfile.id === profile.id ? 'bg-white/[0.06] border border-white/15' : 'border border-transparent'"
                            >
                              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <!-- Dynamic Gradient Avatar (Circle) -->
                                <div 
                                  class="w-8 h-8 rounded-full bg-gradient-to-br flex items-center justify-center text-white shrink-0 border border-white/15 shadow-sm transition-transform duration-200 group-hover:scale-105"
                                  :class="profile.gradient || 'from-lime-400 to-emerald-600'"
                                >
                                  <Icon :name="profile.icon || 'lucide:sparkles'" class="text-sm text-white" />
                                </div>
                                <div class="overflow-hidden min-w-0 flex-1 grid gap-0.5">
                                  <p class="text-[11px] font-semibold text-white truncate leading-tight">{{ profile.name }}</p>
                                  <span class="inline-block text-[9px] text-white/60 py-0.5 rounded mt-0.5 truncate max-w-[130px] leading-none">{{ profile.niche }}</span>
                                </div>
                              </div>

                              <div class="flex items-center gap-1 shrink-0 ml-2">
                                <!-- Active Checkmark -->
                                <Icon v-if="activeProfile.id === profile.id" name="lucide:check" class="text-xs text-accent-500 mr-0.5" />
                                
                                <!-- Edit button -->
                                <button 
                                  @click.stop="startEditProfile(profile, $event)"
                                  class="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 cursor-pointer"
                                  title="Edit Profile"
                                >
                                  <Icon name="lucide:pencil" class="text-[10px]" />
                                </button>

                                <!-- Delete button (if > 1) -->
                                <button 
                                  v-if="profiles.length > 1"
                                  @click.stop="deleteProfile(profile.id, $event)"
                                  class="w-6 h-6 rounded-md hover:bg-red-500/20 flex items-center justify-center text-white/40 hover:text-red-400 opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 cursor-pointer"
                                  title="Delete Profile"
                                >
                                  <Icon name="lucide:trash-2" class="text-[10px]" />
                                </button>
                              </div>
                            </div>
                          </TransitionGroup>

                          <!-- Add New Profile Action -->
                          <div class="pt-1 border-t border-white/[0.06]">
                            <button 
                              @click="startCreateProfile"
                              class="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-white/80 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/15 text-[11px] font-medium transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                            >
                              <Icon name="lucide:plus" class="text-xs text-accent-500" />
                              <span>Create Profile</span>
                            </button>
                          </div>
                        </div>

                        <!-- MODE 2: Inline Creation / Edit Form -->
                        <div v-else key="profile-form" class="flex flex-col gap-2.5">
                          <div class="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                            <button 
                              @click="cancelProfileForm" 
                              class="flex items-center gap-1 text-[10px] font-medium text-white/60 hover:text-white cursor-pointer transition-all active:scale-95"
                            >
                              <Icon name="lucide:arrow-left" class="text-xs" />
                              <span>Back</span>
                            </button>
                            <span class="text-[9px] font-bold uppercase tracking-wider text-accent-500 font-mono">
                              {{ editingProfileId ? 'Edit Profile' : 'New Profile' }}
                            </span>
                          </div>

                          <!-- Live Avatar & Preview Banner -->
                          <div class="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <div 
                              class="w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white shrink-0 border border-white/20 shadow-sm transition-all duration-200 ease-out"
                              :class="profileForm.gradient"
                            >
                              <Icon :name="profileForm.icon" class="text-lg text-white" />
                            </div>
                            <div class="overflow-hidden min-w-0 flex-1">
                              <p class="text-xs font-semibold text-white truncate">{{ profileForm.name || 'Untitled Profile' }}</p>
                              <p class="text-[10px] text-white/60 truncate mt-0.5">{{ profileForm.niche || 'General' }}</p>
                            </div>
                          </div>

                          <!-- Input 1: Profile Name -->
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Profile Name</label>
                            <input 
                              v-model="profileForm.name" 
                              type="text" 
                              placeholder="e.g. Podcast Shorts"
                              maxlength="30"
                              class="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent-500/60 focus:bg-white/[0.06] focus:outline-none transition-all"
                            />
                          </div>

                          <!-- Input 2: Category (Manual Input + Quick Presets) -->
                          <div class="flex flex-col gap-1">
                            <div class="flex items-center justify-between">
                              <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Category</label>
                              <span class="text-[8px] text-white/40">Manual or Preset</span>
                            </div>
                            <input 
                              v-model="profileForm.niche" 
                              type="text" 
                              placeholder="e.g. Finance & Crypto, Cooking, Vlog"
                              maxlength="35"
                              class="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 focus:border-accent-500/60 focus:bg-white/[0.06] focus:outline-none transition-all"
                            />
                            <div class="flex flex-wrap gap-1 mt-0.5">
                              <button 
                                v-for="cat in CATEGORY_TAG_PRESETS" 
                                :key="cat.niche"
                                type="button"
                                @click="applyQuickCategory(cat)"
                                class="px-2 py-0.5 rounded-md text-[9px] font-medium transition-all active:scale-95 hover:scale-105 border cursor-pointer"
                                :class="profileForm.niche === cat.niche ? 'bg-white/15 border-accent-500/60 text-white font-bold' : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.06]'"
                              >
                                {{ cat.niche.split(' ')[0] }}
                              </button>
                            </div>
                          </div>

                          <!-- Icon Grid Selector -->
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Icon</label>
                            <div class="grid grid-cols-5 gap-1.5">
                              <button 
                                v-for="item in ICON_PRESETS" 
                                :key="item.icon"
                                type="button"
                                @click="profileForm.icon = item.icon"
                                class="h-7 rounded-lg flex items-center justify-center transition-all active:scale-90 hover:scale-105 border cursor-pointer"
                                :class="profileForm.icon === item.icon ? 'bg-accent-500/20 border-accent-500 text-accent-500' : 'bg-white/[0.03] border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.06]'"
                                :title="item.label"
                              >
                                <Icon :name="item.icon" class="text-xs" />
                              </button>
                            </div>
                          </div>

                          <!-- Color Gradient Selector -->
                          <div class="flex flex-col gap-1">
                            <label class="text-[9px] font-bold uppercase tracking-wider text-white/50">Color Palette</label>
                            <div class="grid grid-cols-8 gap-1.5">
                              <button 
                                v-for="grad in GRADIENT_PRESETS" 
                                :key="grad.gradient"
                                type="button"
                                @click="profileForm.gradient = grad.gradient"
                                class="w-6 h-6 rounded-full bg-gradient-to-br transition-all active:scale-90 hover:scale-110 border cursor-pointer mx-auto"
                                :class="[
                                  grad.gradient,
                                  profileForm.gradient === grad.gradient ? 'border-white scale-110 shadow-sm' : 'border-white/10 hover:scale-105 opacity-80 hover:opacity-100'
                                ]"
                                :title="grad.name"
                              ></button>
                            </div>
                          </div>

                          <!-- Action Buttons -->
                          <div class="flex items-center gap-1.5 pt-1 border-t border-white/[0.06]">
                            <button 
                              type="button"
                              @click="cancelProfileForm"
                              class="flex-1 py-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] border border-white/[0.06] text-[10px] font-medium transition-all active:scale-95 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button 
                              type="button"
                              :disabled="!profileForm.name.trim()"
                              @click="saveProfileForm"
                              class="flex-1 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-black text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-sm"
                            >
                              {{ editingProfileId ? 'Save' : 'Create' }}
                            </button>
                          </div>
                        </div>
                      </Transition>
                </div>
              </Transition>
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
                @click="handleNav('docs')"
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

const state = useClipperState()

// Niche Profile Definitions & Presets
export interface NicheProfile {
  id: string
  name: string
  niche: string
  icon?: string
  gradient?: string
  avatarInitial?: string
}

const ICON_PRESETS = [
  { icon: 'lucide:sparkles', label: 'AI / General' },
  { icon: 'lucide:gamepad-2', label: 'Gaming' },
  { icon: 'lucide:trending-up', label: 'Finance' },
  { icon: 'lucide:mic', label: 'Podcast' },
  { icon: 'lucide:cpu', label: 'Tech' },
  { icon: 'lucide:film', label: 'Cinema' },
  { icon: 'lucide:dumbbell', label: 'Fitness' },
  { icon: 'lucide:graduation-cap', label: 'Education' },
  { icon: 'lucide:music', label: 'Music' },
  { icon: 'lucide:newspaper', label: 'News' }
]

const GRADIENT_PRESETS = [
  { gradient: 'from-lime-400 to-emerald-600', name: 'Cyber Lime' },
  { gradient: 'from-violet-500 to-purple-800', name: 'Neon Violet' },
  { gradient: 'from-emerald-500 to-teal-700', name: 'Emerald Finance' },
  { gradient: 'from-amber-500 to-orange-600', name: 'Amber Gold' },
  { gradient: 'from-sky-400 to-blue-600', name: 'Electric Sky' },
  { gradient: 'from-rose-500 to-pink-600', name: 'Rose Bloom' },
  { gradient: 'from-fuchsia-500 to-rose-700', name: 'Fuchsia Magic' },
  { gradient: 'from-zinc-600 to-zinc-800', name: 'Dark Stealth' }
]

const CATEGORY_TAG_PRESETS = [
  { name: 'Gaming Highlights', niche: 'Gaming & Streams', icon: 'lucide:gamepad-2', gradient: 'from-violet-500 to-purple-800' },
  { name: 'FinTrack Shorts', niche: 'Finance & Tech', icon: 'lucide:trending-up', gradient: 'from-emerald-500 to-teal-700' },
  { name: 'Podcast Clips', niche: 'Podcasts & Talk', icon: 'lucide:mic', gradient: 'from-sky-400 to-blue-600' },
  { name: 'Tech Insights', niche: 'Tech & AI', icon: 'lucide:cpu', gradient: 'from-amber-500 to-orange-600' },
  { name: 'Movie Recaps', niche: 'Cinema & Stories', icon: 'lucide:film', gradient: 'from-rose-500 to-pink-600' },
  { name: 'Fitness Tips', niche: 'Health & Fitness', icon: 'lucide:dumbbell', gradient: 'from-lime-400 to-emerald-600' }
]

function sanitizeProfile(p: any): NicheProfile {
  const icon = p.icon || (
    p.niche?.toLowerCase().includes('game') ? 'lucide:gamepad-2' :
    p.niche?.toLowerCase().includes('finance') || p.niche?.toLowerCase().includes('crypto') ? 'lucide:trending-up' :
    p.niche?.toLowerCase().includes('podcast') || p.niche?.toLowerCase().includes('talk') ? 'lucide:mic' :
    p.niche?.toLowerCase().includes('tech') || p.niche?.toLowerCase().includes('ai') ? 'lucide:cpu' :
    p.niche?.toLowerCase().includes('movie') || p.niche?.toLowerCase().includes('film') ? 'lucide:film' :
    p.niche?.toLowerCase().includes('fit') || p.niche?.toLowerCase().includes('health') ? 'lucide:dumbbell' :
    'lucide:sparkles'
  )
  const gradient = p.gradient || (
    p.niche?.toLowerCase().includes('game') ? 'from-violet-500 to-purple-800' :
    p.niche?.toLowerCase().includes('finance') || p.niche?.toLowerCase().includes('crypto') ? 'from-emerald-500 to-teal-700' :
    p.niche?.toLowerCase().includes('podcast') || p.niche?.toLowerCase().includes('talk') ? 'from-sky-400 to-blue-600' :
    p.niche?.toLowerCase().includes('tech') || p.niche?.toLowerCase().includes('ai') ? 'from-amber-500 to-orange-600' :
    p.niche?.toLowerCase().includes('movie') || p.niche?.toLowerCase().includes('film') ? 'from-rose-500 to-pink-600' :
    'from-lime-400 to-emerald-600'
  )
  return {
    id: p.id || `niche-${Date.now()}`,
    name: p.name || 'Personal Shorts',
    niche: p.niche || 'General',
    icon,
    gradient,
    avatarInitial: p.avatarInitial || p.name?.charAt(0)?.toUpperCase() || 'P'
  }
}

const defaultFallbackProfile: NicheProfile = { 
  id: 'default', 
  name: 'Personal Shorts', 
  niche: 'General', 
  icon: 'lucide:sparkles',
  gradient: 'from-lime-400 to-emerald-600',
  avatarInitial: 'P' 
}

const profiles = ref<NicheProfile[]>([
  { id: 'default', name: 'Personal Shorts', niche: 'General', icon: 'lucide:sparkles', gradient: 'from-lime-400 to-emerald-600', avatarInitial: 'P' },
  { id: 'finance', name: 'FinTrack Shorts', niche: 'Finance & Tech', icon: 'lucide:trending-up', gradient: 'from-emerald-500 to-teal-700', avatarInitial: 'F' },
  { id: 'gaming', name: 'Gaming Highlights', niche: 'Gaming & Streams', icon: 'lucide:gamepad-2', gradient: 'from-violet-500 to-purple-800', avatarInitial: 'G' }
])

const activeProfileId = ref('default')
const isProfileMenuOpen = ref(false)
const isCreatingProfile = ref(false)
const editingProfileId = ref<string | null>(null)
const navigationDirection = ref<'forward' | 'backward'>('forward')
const profileForm = reactive({
  name: '',
  niche: '',
  icon: 'lucide:sparkles',
  gradient: 'from-lime-400 to-emerald-600'
})

const activeProfile = computed<NicheProfile>(() => {
  const found = profiles.value.find(p => p.id === activeProfileId.value)
  return found ? sanitizeProfile(found) : defaultFallbackProfile
})

function toggleProfileMenu() {
  isProfileMenuOpen.value = !isProfileMenuOpen.value
  if (!isProfileMenuOpen.value) {
    isCreatingProfile.value = false
    editingProfileId.value = null
    navigationDirection.value = 'forward'
  }
}

function selectProfile(profile: NicheProfile) {
  activeProfileId.value = profile.id
  isProfileMenuOpen.value = false
  isCreatingProfile.value = false
  editingProfileId.value = null
  navigationDirection.value = 'forward'
  if (import.meta.client) {
    localStorage.setItem('yonru_active_niche_profile', profile.id)
  }
}

function startCreateProfile() {
  editingProfileId.value = null
  profileForm.name = ''
  profileForm.niche = ''
  profileForm.icon = 'lucide:sparkles'
  profileForm.gradient = 'from-lime-400 to-emerald-600'
  navigationDirection.value = 'forward'
  isCreatingProfile.value = true
}

function startEditProfile(profile: NicheProfile, e?: Event) {
  if (e) e.stopPropagation()
  const sanitized = sanitizeProfile(profile)
  editingProfileId.value = sanitized.id
  profileForm.name = sanitized.name
  profileForm.niche = sanitized.niche
  profileForm.icon = sanitized.icon || 'lucide:sparkles'
  profileForm.gradient = sanitized.gradient || 'from-lime-400 to-emerald-600'
  navigationDirection.value = 'forward'
  isCreatingProfile.value = true
}

function applyQuickCategory(preset: typeof CATEGORY_TAG_PRESETS[0]) {
  if (!profileForm.name || profileForm.name === 'Personal Shorts') {
    profileForm.name = preset.name
  }
  profileForm.niche = preset.niche
  profileForm.icon = preset.icon
  profileForm.gradient = preset.gradient
}

function saveProfileForm() {
  if (!profileForm.name.trim()) return
  const cleanName = profileForm.name.trim()
  const cleanNiche = profileForm.niche.trim() || 'General'

  if (editingProfileId.value) {
    const idx = profiles.value.findIndex(p => p.id === editingProfileId.value)
    if (idx >= 0 && profiles.value[idx]) {
      profiles.value[idx] = {
        ...profiles.value[idx],
        name: cleanName,
        niche: cleanNiche,
        icon: profileForm.icon,
        gradient: profileForm.gradient,
        avatarInitial: cleanName.charAt(0).toUpperCase()
      }
    }
  } else {
    const newProfile: NicheProfile = {
      id: `niche-${Date.now()}`,
      name: cleanName,
      niche: cleanNiche,
      icon: profileForm.icon,
      gradient: profileForm.gradient,
      avatarInitial: cleanName.charAt(0).toUpperCase()
    }
    profiles.value.push(newProfile)
    activeProfileId.value = newProfile.id
  }

  if (import.meta.client) {
    localStorage.setItem('yonru_niche_profiles', JSON.stringify(profiles.value))
    localStorage.setItem('yonru_active_niche_profile', activeProfileId.value)
  }

  navigationDirection.value = 'backward'
  isCreatingProfile.value = false
  editingProfileId.value = null
}

function deleteProfile(id: string, e?: Event) {
  if (e) e.stopPropagation()
  if (profiles.value.length <= 1) return
  profiles.value = profiles.value.filter(p => p.id !== id)
  if (activeProfileId.value === id) {
    activeProfileId.value = profiles.value[0]?.id || 'default'
  }
  if (import.meta.client) {
    localStorage.setItem('yonru_niche_profiles', JSON.stringify(profiles.value))
    localStorage.setItem('yonru_active_niche_profile', activeProfileId.value)
  }
}

function cancelProfileForm() {
  navigationDirection.value = 'backward'
  isCreatingProfile.value = false
  editingProfileId.value = null
}

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
  isProfileMenuOpen.value = false
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
    isProfileMenuOpen.value = false
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (isProfileMenuOpen.value && target && !target.closest('.profile-popover-container')) {
    isProfileMenuOpen.value = false
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
    const savedProfiles = localStorage.getItem('yonru_niche_profiles')
    if (savedProfiles) {
      try {
        const parsed = JSON.parse(savedProfiles)
        if (Array.isArray(parsed) && parsed.length > 0) {
          profiles.value = parsed.map(sanitizeProfile)
        }
      } catch (err) {
        console.error('Failed to parse saved profiles', err)
      }
    }
    const savedActiveProfile = localStorage.getItem('yonru_active_niche_profile')
    if (savedActiveProfile && profiles.value.some(p => p.id === savedActiveProfile)) {
      activeProfileId.value = savedActiveProfile
    }
    
    window.addEventListener('click', handleClickOutside)
  }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
  window.addEventListener('keydown', handleKeydown)
  
  if (import.meta.client && !state?.systemHealth?.value && !state?.checkingHealth?.value) {
    state.checkSystemHealth()
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('click', handleClickOutside)
  }
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
