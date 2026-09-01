<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div 
        v-if="palette.isOpen.value"
        class="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md flex items-start justify-center pt-[12vh] sm:pt-[15vh] px-3 sm:px-4 font-sans select-none overflow-hidden"
        @click.self="palette.close"
        @keydown="handleKeydown"
      >
        <!-- Spotlight Dialog Container -->
        <div 
          class="w-full max-w-2xl bg-[#0e1015]/95 border border-white/15 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150"
          @click.stop
        >
          <!-- Top Search Header Bar -->
          <div class="relative flex items-center px-4 py-3.5 border-b border-white/[0.08] bg-white/[0.02]">
            <Icon 
              name="lucide:search" 
              class="text-lg text-accent-500 mr-3 shrink-0" 
            />
            
            <input 
              ref="searchInputRef"
              v-model="palette.searchQuery.value"
              type="text"
              placeholder="Search videos, clips, prompts, or settings..."
              class="w-full bg-transparent border-none text-sm sm:text-base text-white placeholder-white/40 focus:outline-none focus:ring-0 font-medium"
              @keydown.down.prevent="palette.selectNext"
              @keydown.up.prevent="palette.selectPrev"
              @keydown.enter.prevent="palette.executeSelected"
              @keydown.esc.prevent="palette.close"
            />

            <!-- Clear / Close Action Badges -->
            <div class="flex items-center gap-1.5 shrink-0 ml-2">
              <button 
                v-if="palette.searchQuery.value"
                @click="palette.searchQuery.value = ''"
                class="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors text-xs cursor-pointer"
                title="Clear Search"
              >
                <Icon name="lucide:x" class="text-sm" />
              </button>
              <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-white/50 bg-white/[0.06] border border-white/10 rounded">
                ESC
              </kbd>
            </div>
          </div>

          <!-- Category Quick Filter Chips (Horizontal Scrollable) -->
          <div class="flex items-center gap-1.5 px-3.5 py-2 border-b border-white/[0.06] bg-black/20 overflow-x-auto custom-scrollbar text-xs">
            <button 
              v-for="cat in CATEGORY_FILTERS" 
              :key="cat.id"
              @click="palette.activeCategoryFilter.value = cat.id"
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
              :class="palette.activeCategoryFilter.value === cat.id 
                ? 'bg-accent-500 text-black font-bold' 
                : 'text-white/60 hover:text-white hover:bg-white/[0.05]'"
            >
              <Icon 
                v-if="cat.icon" 
                :name="cat.icon" 
                class="text-xs" 
                :class="palette.activeCategoryFilter.value === cat.id ? 'text-black' : (cat.id !== 'all' ? getCategoryIconColor(cat.id as CommandPaletteCategory) : '')" 
              />
              <span>{{ cat.label }}</span>
            </button>
          </div>

          <!-- Results Scroll Area -->
          <div 
            ref="resultsContainerRef"
            class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3 min-h-[160px] max-h-[50vh]"
          >
            <!-- Empty Search State -->
            <div 
              v-if="palette.filteredItems.value.length === 0" 
              class="py-12 px-4 text-center flex flex-col items-center justify-center text-white/40"
            >
              <div class="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-3">
                <Icon name="lucide:search-x" class="text-2xl text-white/30" />
              </div>
              <p class="text-sm font-semibold text-white/80 mb-1">No matching results found</p>
              <p class="text-xs text-white/40 max-w-xs">
                No actions, clips, or settings matched "<span class="text-white/70 font-mono">{{ palette.searchQuery.value }}</span>".
              </p>
            </div>

            <!-- Grouped Search Results -->
            <template v-else>
              <div 
                v-for="group in palette.groupedItems.value" 
                :key="group.key || group.label"
                class="space-y-1"
              >
                <!-- Group Category Header -->
                <div class="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center justify-between">
                  <span>{{ group.label }}</span>
                  <span class="text-[9px] font-mono text-white/30">{{ group.items.length }}</span>
                </div>

                <!-- Hierarchical Nested Subgroups (e.g. Prompt Template -> Preset Prompt & Custom Prompt) -->
                <template v-if="group.subgroups && group.subgroups.length > 0">
                  <div 
                    v-for="subgroup in group.subgroups" 
                    :key="subgroup.key"
                    class="space-y-1 pl-2 border-l border-white/[0.08] ml-2 mt-1 mb-2.5"
                  >
                    <!-- Sub-Group Header -->
                    <div class="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent-400/90 flex items-center justify-between">
                      <div class="flex items-center gap-1.5">
                        <span class="w-1 h-1 rounded-full bg-accent-500"></span>
                        <span>{{ subgroup.label }}</span>
                      </div>
                      <span class="text-[9px] font-mono text-white/30">{{ subgroup.items.length }}</span>
                    </div>

                    <!-- Sub-Group Items -->
                    <div 
                      v-for="item in subgroup.items" 
                      :key="item.id"
                      :data-item-id="item.id"
                      @click="palette.executeItem(item)"
                      @mouseenter="handleMouseEnter(item)"
                      class="group flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-100 cursor-pointer border relative overflow-hidden"
                      :class="getItemIndex(item) === palette.selectedIndex.value
                        ? 'bg-white/[0.08] border-white/15 text-white' 
                        : 'border-transparent text-white/70 hover:bg-white/[0.04] hover:text-white'"
                    >
                      <!-- Active Left Accent Indicator Pill -->
                      <div 
                        v-if="getItemIndex(item) === palette.selectedIndex.value"
                        class="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-accent-500"
                      ></div>

                      <!-- Left: Icon & Title & Subtitle -->
                      <div class="flex items-center gap-3 min-w-0 flex-1">
                        <div 
                          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.08] bg-[#121216] transition-transform duration-150 group-hover:scale-105 shadow-inner"
                        >
                          <Icon :name="item.icon" class="text-sm" :class="getCategoryIconColor(item.category)" />
                        </div>

                        <div class="overflow-hidden min-w-0 flex-1 grid gap-0.5">
                          <div class="flex items-center gap-2">
                            <span class="text-xs sm:text-sm font-semibold truncate text-white leading-tight">
                              {{ item.title }}
                            </span>
                            <span 
                              v-if="item.badge" 
                              class="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase tracking-wider border shrink-0"
                              :class="getBadgeClass(item.category)"
                            >
                              {{ item.badge }}
                            </span>
                          </div>
                          <p 
                            v-if="item.subtitle" 
                            class="text-[11px] text-white/50 truncate leading-none"
                          >
                            {{ item.subtitle }}
                          </p>
                        </div>
                      </div>

                      <!-- Right: Action Hint Button -->
                      <div class="flex items-center gap-1.5 shrink-0 ml-3">
                        <span 
                          class="text-[10px] font-semibold text-white/40 group-hover:text-accent-400 transition-colors uppercase tracking-wider font-mono flex items-center gap-1"
                        >
                          <span>{{ item.actionLabel || 'Apply' }}</span>
                          <kbd class="px-1 py-0.5 text-[9px] bg-white/[0.06] border border-white/10 rounded font-mono text-white/60">
                            ↵
                          </kbd>
                        </span>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- Standard Flat Group Items -->
                <template v-else>
                  <div 
                    v-for="item in group.items" 
                    :key="item.id"
                    :data-item-id="item.id"
                    @click="palette.executeItem(item)"
                    @mouseenter="handleMouseEnter(item)"
                    class="group flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-100 cursor-pointer border relative overflow-hidden"
                    :class="getItemIndex(item) === palette.selectedIndex.value
                      ? 'bg-white/[0.08] border-white/15 text-white' 
                      : 'border-transparent text-white/70 hover:bg-white/[0.04] hover:text-white'"
                  >
                    <!-- Active Left Accent Indicator Pill -->
                    <div 
                      v-if="getItemIndex(item) === palette.selectedIndex.value"
                      class="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-accent-500"
                    ></div>

                    <!-- Left: Icon & Title & Subtitle -->
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <div 
                        class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.08] bg-[#121216] transition-transform duration-150 group-hover:scale-105 shadow-inner"
                      >
                        <Icon :name="item.icon" class="text-sm" :class="getCategoryIconColor(item.category)" />
                      </div>

                      <div class="overflow-hidden min-w-0 flex-1 grid gap-0.5">
                        <div class="flex items-center gap-2">
                          <span class="text-xs sm:text-sm font-semibold truncate text-white leading-tight">
                            {{ item.title }}
                          </span>
                          <span 
                            v-if="item.badge" 
                            class="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase tracking-wider border shrink-0"
                            :class="getBadgeClass(item.category)"
                          >
                            {{ item.badge }}
                          </span>
                        </div>
                        <p 
                          v-if="item.subtitle" 
                          class="text-[11px] text-white/50 truncate leading-none"
                        >
                          {{ item.subtitle }}
                        </p>
                      </div>
                    </div>

                    <!-- Right: Action Hint Button -->
                    <div class="flex items-center gap-1.5 shrink-0 ml-3">
                      <span 
                        class="text-[10px] font-semibold text-white/40 group-hover:text-accent-400 transition-colors uppercase tracking-wider font-mono flex items-center gap-1"
                      >
                        <span>{{ item.actionLabel || 'Open' }}</span>
                        <kbd class="px-1 py-0.5 text-[9px] bg-white/[0.06] border border-white/10 rounded font-mono text-white/60">
                          ↵
                        </kbd>
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- Bottom Spotlight Footer -->
          <div class="px-4 py-2.5 bg-black/40 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-white/40">
            <!-- Left: Match Count & Mode -->
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full bg-accent-500 animate-pulse"></span>
              <span class="font-mono text-[10px]">
                {{ palette.filteredItems.value.length }} {{ palette.filteredItems.value.length === 1 ? 'result' : 'results' }}
              </span>
            </div>

            <!-- Right: Keyboard Shortcut Legend -->
            <div class="hidden sm:flex items-center gap-3 text-[10px] font-mono text-white/45">
              <span class="flex items-center gap-1">
                <kbd class="px-1 py-0.2 bg-white/[0.06] border border-white/10 rounded">↑</kbd>
                <kbd class="px-1 py-0.2 bg-white/[0.06] border border-white/10 rounded">↓</kbd>
                <span>Navigate</span>
              </span>
              <span class="flex items-center gap-1">
                <kbd class="px-1 py-0.2 bg-white/[0.06] border border-white/10 rounded">↵</kbd>
                <span>Select</span>
              </span>
              <span class="flex items-center gap-1">
                <kbd class="px-1 py-0.2 bg-white/[0.06] border border-white/10 rounded">esc</kbd>
                <span>Close</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useCommandPalette } from '../composables/useCommandPalette'
import type { CommandPaletteItem, CommandPaletteCategory } from '../types/clipper'

const palette = useCommandPalette()
const searchInputRef = ref<HTMLInputElement | null>(null)
const resultsContainerRef = ref<HTMLElement | null>(null)

const CATEGORY_FILTERS: { id: CommandPaletteCategory | 'all'; label: string; icon?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'navigation', label: 'Navigation', icon: 'lucide:compass' },
  { id: 'settings', label: 'Settings', icon: 'lucide:settings' },
  { id: 'prompts', label: 'Prompts', icon: 'lucide:sparkles' },
  { id: 'videos', label: 'Videos', icon: 'lucide:video' },
  { id: 'clips', label: 'Clips', icon: 'lucide:clapperboard' }
]

function getItemIndex(item: CommandPaletteItem): number {
  return palette.filteredItems.value.findIndex(i => i.id === item.id)
}

function handleMouseEnter(item: CommandPaletteItem) {
  const idx = getItemIndex(item)
  if (idx >= 0) {
    palette.selectedIndex.value = idx
  }
}

function getCategoryIconColor(category: CommandPaletteCategory): string {
  switch (category) {
    case 'navigation':
      return 'text-sky-400'
    case 'settings':
      return 'text-amber-400'
    case 'prompts':
      return 'text-purple-400'
    case 'videos':
      return 'text-blue-400'
    case 'clips':
      return 'text-emerald-400'
    default:
      return 'text-white/80'
  }
}

function getBadgeClass(category: CommandPaletteCategory): string {
  switch (category) {
    case 'navigation':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/30'
    case 'settings':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'prompts':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    case 'videos':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    case 'clips':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    default:
      return 'bg-white/10 text-white border-white/20'
  }
}

// Auto focus search input on modal open & scroll active item into view
watch(palette.isOpen, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    searchInputRef.value?.focus()
  }
})

watch(palette.selectedIndex, async (newIdx) => {
  await nextTick()
  if (!resultsContainerRef.value) return
  const activeEl = resultsContainerRef.value.querySelector(`[data-item-id="${palette.filteredItems.value[newIdx]?.id}"]`) as HTMLElement | null
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
})

// Global keyboard handler for ⌘K / Ctrl+K
function handleGlobalKeydown(e: KeyboardEvent) {
  // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    palette.toggle()
    return
  }

  // Close on Escape if modal is open
  if (palette.isOpen.value && e.key === 'Escape') {
    e.preventDefault()
    palette.close()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    palette.close()
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', handleGlobalKeydown)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleGlobalKeydown)
  }
})
</script>
