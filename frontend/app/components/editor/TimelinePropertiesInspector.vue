<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-x-8"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-8"
    >
      <div
        v-if="activeItem"
        class="fixed top-[72px] right-6 bottom-[276px] w-[460px] bg-[#111113]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[60] flex flex-col overflow-hidden select-none"
      >
        <!-- Header -->
        <div
          class="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] relative z-20"
        >
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <span
              class="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400"
              >Properties</span
            >
          </div>
          <div class="flex items-center gap-2">
            <!-- Link with Global Style toggle (inline in header) -->
            <div
              v-if="activeItem?.content !== undefined"
              class="relative group"
            >
              <button
                class="flex items-center gap-1.5 px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider rounded-lg border transition-all duration-300 cursor-pointer"
                :class="
                  isLinkedToGlobal
                    ? 'bg-violet-500/15 text-violet-300 border-violet-500/30 hover:bg-violet-500/25'
                    : 'border-white/10 text-slate-500 hover:text-slate-400 hover:bg-white/5'
                "
                @click="toggleGlobalLink()"
              >
                <Icon
                  :name="isLinkedToGlobal ? 'ri:link' : 'ri:link-unlink'"
                  class="text-[10px]"
                />
                {{ isLinkedToGlobal ? 'LINKED' : 'CUSTOM' }}
              </button>

              <!-- Tooltip -->
              <div
                class="absolute right-0 top-full mt-2 w-56 bg-slate-950 border border-white/10 rounded-lg p-2.5 shadow-2xl text-[9px] text-slate-400 normal-case leading-normal pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 z-[70] origin-top-right backdrop-blur-md"
              >
                <div v-if="isLinkedToGlobal">
                  <span class="font-bold text-violet-400 block mb-0.5"
                    >Linked Mode</span
                  >
                  This text inherits styles from global settings. Editing any
                  styling below will automatically unlink it.
                </div>
                <div v-else>
                  <span class="font-bold text-amber-400 block mb-0.5"
                    >Custom Mode</span
                  >
                  This subtitle has unique custom styling. Click to link it back
                  and reset it to global style settings.
                </div>
              </div>
            </div>

            <!-- Close Button -->
            <button
              class="text-slate-600 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close"
              @click="closePanel"
            >
              <Icon name="ri:close-line" class="text-sm" />
            </button>
          </div>
        </div>

        <!-- Scrollable Body Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <!-- SECTION 1: TIMING & SPACING -->
          <div
            class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
            :class="
              activeSections.timing
                ? 'border-sky-500/20 shadow-[0_0_12px_rgba(56,189,248,0.03)]'
                : 'border-white/5'
            "
            @mousedown="commitHistory"
            @focusin="commitHistory"
          >
            <button
              class="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[9px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
              @click="toggleSection('timing')"
            >
              <span class="flex items-center gap-2"
                ><Icon name="ri:time-line" class="text-sky-400 text-xs" />
                Timing & Spacing</span
              >
              <Icon
                name="ri:arrow-down-s-line"
                class="text-xs transition-transform duration-300"
                :class="{ 'rotate-180': activeSections.timing }"
              />
            </button>
            <div
              class="grid transition-[grid-template-rows] duration-300 ease-in-out"
              :class="
                activeSections.timing ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              "
            >
              <div class="overflow-hidden">
                <div class="p-3 space-y-2.5 border-t border-white/5">
                  <!-- Text Content & Casing -->
                  <div v-if="activeItem.content !== undefined">
                    <div class="flex justify-between items-center mb-1.5">
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500"
                        >Text Content</label
                      >
                      <div class="flex gap-1">
                        <button
                          class="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-[8px] font-mono font-bold uppercase transition-all cursor-pointer"
                          title="Convert to uppercase"
                          @click="transformCase('upper')"
                        >
                          UPPER
                        </button>
                        <button
                          class="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-[8px] font-mono font-bold uppercase transition-all cursor-pointer"
                          title="Convert to lowercase"
                          @click="transformCase('lower')"
                        >
                          lower
                        </button>
                        <button
                          class="px-1.5 py-0.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-[8px] font-mono font-bold uppercase transition-all cursor-pointer"
                          title="Convert to title case"
                          @click="transformCase('title')"
                        >
                          Title
                        </button>
                      </div>
                    </div>
                    <textarea
                      v-model="activeItem.content"
                      class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500/50 resize-none"
                      rows="2"
                    ></textarea>
                  </div>

                  <!-- Start & Duration Inputs -->
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Start (s)</label
                      >
                      <input
                        v-model.number="activeItem.start"
                        type="number"
                        step="0.1"
                        class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white mono"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Duration (s)</label
                      >
                      <input
                        v-model.number="activeItem.duration"
                        type="number"
                        step="0.1"
                        class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white mono"
                      />
                    </div>
                  </div>

                  <!-- Alignment Buttons -->
                  <div v-if="activeItem.align !== undefined">
                    <label
                      class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                      >Alignment</label
                    >
                    <div
                      class="grid grid-cols-3 gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10"
                    >
                      <button
                        v-for="align in ['left', 'center', 'right']"
                        :key="align"
                        class="py-1 text-[9px] font-bold uppercase rounded-md transition-colors cursor-pointer"
                        :class="
                          activeItem.align === align
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'text-slate-500 hover:text-slate-300'
                        "
                        @click="activeItem.align = align"
                      >
                        {{ align }}
                      </button>
                    </div>
                  </div>

                  <!-- Blank Zone Alignment Snap for Landscape Mode -->
                  <div
                    v-if="currentVideoLayout === 'landscape'"
                    class="pt-2 border-t border-white/5 space-y-1"
                  >
                    <label
                      class="block text-[8px] font-bold uppercase tracking-widest text-accent-500 flex items-center justify-between"
                    >
                      <span>Blank Zone Snap</span>
                      <Icon
                        name="ri:layout-grid-line"
                        class="text-accent-500 text-[10px]"
                      />
                    </label>
                    <div class="grid grid-cols-2 gap-1.5">
                      <button
                        class="py-1 px-2 bg-surface-dark/80 hover:bg-surface-card border border-accent-500/30 hover:border-accent-500 text-accent-500 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Snap text overlay to top blank zone center"
                        @click="snapTopZone"
                      >
                        <Icon name="ri:align-top" class="text-xs" />
                        <span>Snap Top Zone</span>
                      </button>
                      <button
                        class="py-1 px-2 bg-surface-dark/80 hover:bg-surface-card border border-accent-500/30 hover:border-accent-500 text-accent-500 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Snap text overlay to bottom blank zone center"
                        @click="snapBottomZone"
                      >
                        <Icon name="ri:align-bottom" class="text-xs" />
                        <span>Snap Bottom Zone</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- STYLE SECTIONS WRAPPER (dimmed when linked) -->
          <div
            v-if="activeItem?.content !== undefined"
            class="space-y-3 transition-all duration-300 relative"
            :class="isLinkedToGlobal ? 'opacity-50' : 'opacity-100'"
            @mousedown="handleStyleInteraction"
            @focusin="handleStyleInteraction"
            @input="handleStyleInteraction"
            @change="handleStyleInteraction"
          >
            <!-- Inherited badge overlay -->
            <div v-if="isLinkedToGlobal" class="absolute -top-1 right-0 z-10">
              <span
                class="text-[7px] font-bold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5"
              >
                <Icon name="ri:arrow-down-s-line" class="text-[8px] inline" />
                Inherited
              </span>
            </div>

            <!-- SECTION 2: TYPOGRAPHY -->
            <div
              class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
              :class="
                activeSections.typography
                  ? 'border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.03)]'
                  : 'border-white/5'
              "
            >
              <button
                class="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[9px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
                @click="toggleSection('typography')"
              >
                <span class="flex items-center gap-2"
                  ><Icon name="ri:font-size-2" class="text-amber-400 text-xs" />
                  Typography</span
                >
                <Icon
                  name="ri:arrow-down-s-line"
                  class="text-xs transition-transform duration-300"
                  :class="{ 'rotate-180': activeSections.typography }"
                />
              </button>
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                :class="
                  activeSections.typography
                    ? 'grid-rows-[1fr]'
                    : 'grid-rows-[0fr]'
                "
              >
                <div class="overflow-hidden">
                  <div class="p-3 space-y-2.5 border-t border-white/5">
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Font Family</label
                      >
                      <select
                        v-model="activeItem.font"
                        class="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                      >
                        <option v-for="f in fontOptions" :key="f" :value="f">
                          {{ f }}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Font Size ({{ activeItem.fontSize ?? 80 }})</label
                      >
                      <input
                        v-model.number="activeItem.fontSize"
                        type="range"
                        min="20"
                        max="250"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >Weight</label
                        >
                        <select
                          v-model="activeItem.fontWeight"
                          class="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                        >
                          <option value="100">100 (Thin)</option>
                          <option value="300">300 (Light)</option>
                          <option value="400">400 (Regular)</option>
                          <option value="500">500 (Medium)</option>
                          <option value="700">700 (Bold)</option>
                          <option value="900">900 (Black)</option>
                        </select>
                      </div>
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >Case</label
                        >
                        <select
                          v-model="activeItem.textTransform"
                          class="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                        >
                          <option value="none">Normal</option>
                          <option value="uppercase">UPPERCASE</option>
                          <option value="lowercase">lowercase</option>
                          <option value="capitalize">Capitalize</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Line Height ({{ activeItem.lineHeight ?? 1.1 }})</label
                      >
                      <input
                        v-model.number="activeItem.lineHeight"
                        type="range"
                        min="0.8"
                        max="2.5"
                        step="0.05"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Letter Spacing ({{
                          activeItem.letterSpacing ?? 0
                        }}px)</label
                      >
                      <input
                        v-model.number="activeItem.letterSpacing"
                        type="range"
                        min="-10"
                        max="30"
                        step="1"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Word Spacing ({{
                          activeItem.wordSpacing ?? 0
                        }}px)</label
                      >
                      <input
                        v-model.number="activeItem.wordSpacing"
                        type="range"
                        min="-10"
                        max="50"
                        step="1"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 3: COLORS & BORDERS -->
            <div
              class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
              :class="
                activeSections.colors
                  ? 'border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.03)]'
                  : 'border-white/5'
              "
            >
              <button
                class="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[9px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
                @click="toggleSection('colors')"
              >
                <span class="flex items-center gap-2"
                  ><Icon name="ri:palette-line" class="text-rose-400 text-xs" />
                  Colors & Borders</span
                >
                <Icon
                  name="ri:arrow-down-s-line"
                  class="text-xs transition-transform duration-300"
                  :class="{ 'rotate-180': activeSections.colors }"
                />
              </button>
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                :class="
                  activeSections.colors ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                "
              >
                <div class="overflow-hidden">
                  <div class="p-3 space-y-2.5 border-t border-white/5">
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Text Color</label
                      >
                      <div class="flex gap-2">
                        <input
                          v-model="activeItem.color"
                          type="color"
                          class="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none"
                        />
                        <input
                          v-model="activeItem.color"
                          type="text"
                          class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[10px] text-white mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Opacity ({{
                          Math.round((activeItem.opacity ?? 1) * 100)
                        }}%)</label
                      >
                      <input
                        v-model.number="activeItem.opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                    <div class="flex items-center justify-between py-1">
                      <span
                        class="text-[9px] font-bold uppercase tracking-wider text-slate-400"
                        >Show Stroke</span
                      >
                      <button
                        class="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg border transition-all cursor-pointer"
                        :class="
                          activeItem.showStroke
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'border-white/10 text-slate-500 hover:text-slate-400'
                        "
                        @click="toggleStroke"
                      >
                        {{ activeItem.showStroke ? 'ON' : 'OFF' }}
                      </button>
                    </div>
                    <div
                      v-if="activeItem.showStroke"
                      class="space-y-2.5 bg-black/20 p-2.5 rounded-lg border border-white/5"
                    >
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >Stroke Color</label
                        >
                        <div class="flex gap-2">
                          <input
                            v-model="activeItem.strokeColor"
                            type="color"
                            class="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none"
                          />
                          <input
                            v-model="activeItem.strokeColor"
                            type="text"
                            class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[10px] text-white mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >Stroke Width ({{
                            activeItem.strokeWidth ?? 5
                          }}px)</label
                        >
                        <input
                          v-model.number="activeItem.strokeWidth"
                          type="range"
                          min="1"
                          max="25"
                          step="1"
                          class="w-full accent-red-500 h-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 4: BACKGROUND BOX -->
            <div
              class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
              :class="
                activeSections.box
                  ? 'border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.03)]'
                  : 'border-white/5'
              "
            >
              <button
                class="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[9px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
                @click="toggleSection('box')"
              >
                <span class="flex items-center gap-2"
                  ><Icon
                    name="ri:checkbox-blank-line"
                    class="text-emerald-400 text-xs"
                  />
                  Background Box</span
                >
                <Icon
                  name="ri:arrow-down-s-line"
                  class="text-xs transition-transform duration-300"
                  :class="{ 'rotate-180': activeSections.box }"
                />
              </button>
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                :class="
                  activeSections.box ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                "
              >
                <div class="overflow-hidden">
                  <div class="p-3 space-y-2.5 border-t border-white/5">
                    <div class="flex items-center justify-between py-1">
                      <span
                        class="text-[9px] font-bold uppercase tracking-wider text-slate-400"
                        >Show Background</span
                      >
                      <button
                        class="px-2.5 py-1 text-[9px] font-bold uppercase rounded-lg border transition-all cursor-pointer"
                        :class="
                          activeItem.showBackground
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'border-white/10 text-slate-500 hover:text-slate-400'
                        "
                        @click="toggleBackground"
                      >
                        {{ activeItem.showBackground ? 'ON' : 'OFF' }}
                      </button>
                    </div>
                    <div
                      v-if="activeItem.showBackground"
                      class="space-y-2.5 bg-black/20 p-2.5 rounded-lg border border-white/5"
                    >
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >BG Color</label
                        >
                        <div class="flex gap-2">
                          <input
                            v-model="activeItem.backgroundColor"
                            type="color"
                            class="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none"
                          />
                          <input
                            v-model="activeItem.backgroundColor"
                            type="text"
                            class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[10px] text-white mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >BG Opacity ({{
                            Math.round(
                              (activeItem.backgroundOpacity ?? 0.7) * 100
                            )
                          }}%)</label
                        >
                        <input
                          v-model.number="activeItem.backgroundOpacity"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          class="w-full accent-red-500 h-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 5: SHADOWS -->
            <div
              class="border rounded-xl bg-black/20 overflow-hidden transition-all duration-300"
              :class="
                activeSections.shadows
                  ? 'border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.03)]'
                  : 'border-white/5'
              "
            >
              <button
                class="w-full px-3 py-2 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-[9px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer"
                @click="toggleSection('shadows')"
              >
                <span class="flex items-center gap-2"
                  ><Icon
                    name="ri:shadow-line"
                    class="text-indigo-400 text-xs"
                  />
                  Text Shadows</span
                >
                <Icon
                  name="ri:arrow-down-s-line"
                  class="text-xs transition-transform duration-300"
                  :class="{ 'rotate-180': activeSections.shadows }"
                />
              </button>
              <div
                class="grid transition-[grid-template-rows] duration-300 ease-in-out"
                :class="
                  activeSections.shadows ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                "
              >
                <div class="overflow-hidden">
                  <div class="p-3 space-y-2.5 border-t border-white/5">
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Shadow Color</label
                      >
                      <div class="flex gap-2">
                        <input
                          v-model="activeItem.shadowColor"
                          type="color"
                          class="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-none"
                        />
                        <input
                          v-model="activeItem.shadowColor"
                          type="text"
                          class="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1 text-[10px] text-white mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Shadow Blur ({{
                          activeItem.shadowBlur ?? 10
                        }}px)</label
                      >
                      <input
                        v-model.number="activeItem.shadowBlur"
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                    <div>
                      <label
                        class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                        >Shadow Opacity ({{
                          Math.round((activeItem.shadowOpacity ?? 0.5) * 100)
                        }}%)</label
                      >
                      <input
                        v-model.number="activeItem.shadowOpacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        class="w-full accent-red-500 h-1"
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >Offset X</label
                        >
                        <input
                          v-model.number="activeItem.shadowOffsetX"
                          type="number"
                          class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white mono"
                        />
                      </div>
                      <div>
                        <label
                          class="block text-[8px] font-bold uppercase tracking-widest text-slate-500 mb-1"
                          >Offset Y</label
                        >
                        <input
                          v-model.number="activeItem.shadowOffsetY"
                          type="number"
                          class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[11px] text-white mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- end style sections wrapper -->
        </div>

        <!-- Panel Footer -->
        <div class="p-4 border-t border-white/5 space-y-2 bg-white/[0.01]">
          <div v-if="activeItem?.content !== undefined" class="flex gap-2">
            <button
              v-if="!isLinkedToGlobal"
              class="flex-1 py-2 rounded-lg bg-violet-600/15 border border-violet-500/25 text-violet-400 text-[9px] font-bold uppercase tracking-wider hover:bg-violet-500/25 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              @click="relinkToGlobal"
            >
              <Icon name="ri:link" class="text-xs" /> Reset to Global Style
            </button>
            <button
              class="flex-1 py-2 rounded-lg bg-red-600/15 border border-red-500/25 text-red-400 text-[9px] font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              @click="saveAsDefaultStyle"
            >
              Save as Default Style
            </button>
          </div>
          <button
            class="w-full py-2 rounded-lg border border-red-500/20 text-red-400 text-[9px] font-bold uppercase tracking-wider hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
            @click="deleteItem"
          >
            {{
              activeItem?.content !== undefined ? 'Delete Text' : 'Delete Item'
            }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import * as clipperStateModule from '../../composables/useClipperState';

interface Props {
  modelValue?: any | null;
  videoLayout?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  videoLayout: undefined
});

const emit = defineEmits<{
  'update:modelValue': [value: any];
  close: [];
  delete: [item: any];
  'commit-history': [];
  'sync-global': [item: any];
}>();

// Opportunistically obtain state if available in context
let state: any = null;
try {
  state = useClipperState();
} catch {
  // Graceful fallback for isolated unit tests
}

const activeItem = computed({
  get() {
    if (props.modelValue !== undefined) {
      return props.modelValue;
    }
    return state?.selectedTimelineItem?.value ?? null;
  },
  set(val) {
    emit('update:modelValue', val);
    if (props.modelValue === undefined && state?.selectedTimelineItem) {
      state.selectedTimelineItem.value = val;
    }
  }
});

const currentVideoLayout = computed(() => {
  if (props.videoLayout !== undefined) {
    return props.videoLayout;
  }
  return state?.videoLayout?.value ?? 'vertical';
});

const fontOptions = (clipperStateModule as any)?.FONT_OPTIONS ?? [
  'Inter',
  'Montserrat',
  'Roboto',
  'Open Sans',
  'Poppins',
  'Arial'
];

const activeSections = ref<Record<string, boolean>>({
  timing: true,
  typography: true,
  colors: true,
  shadows: true,
  box: true
});

function toggleSection(key: string) {
  activeSections.value[key] = !activeSections.value[key];
}

// --- Global Style Link/Decouple ---
const isLinkedToGlobal = computed(() => {
  const item = activeItem.value;
  if (!item || item.content === undefined) return false;
  return item.linkToGlobal !== false;
});

function commitHistory() {
  emit('commit-history');
  state?.commitToHistory?.();
}

function decoupleItem() {
  const item = activeItem.value;
  if (item && item.linkToGlobal !== false) {
    item.linkToGlobal = false;
  }
}

function snapTopZone() {
  decoupleItem();
  if (activeItem.value) {
    activeItem.value.y = 328;
  }
}

function snapBottomZone() {
  decoupleItem();
  if (activeItem.value) {
    activeItem.value.y = 1592;
  }
}

function toggleStroke() {
  decoupleItem();
  if (activeItem.value) {
    activeItem.value.showStroke = !activeItem.value.showStroke;
  }
}

function toggleBackground() {
  decoupleItem();
  if (activeItem.value) {
    activeItem.value.showBackground = !activeItem.value.showBackground;
  }
}

function handleStyleInteraction(e: Event) {
  const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) {
    if (e.type === 'mousedown' || e.type === 'focusin') {
      commitHistory();
    }
    decoupleItem();
  }
}

function toggleGlobalLink() {
  const item = activeItem.value;
  if (!item) return;
  if (item.linkToGlobal !== false) {
    item.linkToGlobal = false;
  } else {
    relinkToGlobal();
  }
}

function relinkToGlobal() {
  const item = activeItem.value;
  if (!item) return;
  emit('sync-global', item);
  state?.syncGlobalStylesToItem?.(item);
}

function transformCase(mode: 'upper' | 'lower' | 'title') {
  const item = activeItem.value;
  if (!item || typeof item.content !== 'string') return;
  commitHistory();
  if (mode === 'upper') {
    item.content = item.content.toUpperCase();
  } else if (mode === 'lower') {
    item.content = item.content.toLowerCase();
  } else if (mode === 'title') {
    item.content = item.content.replace(/\b\w/g, (c: string) =>
      c.toUpperCase()
    );
  }
}

function saveAsDefaultStyle() {
  const item = activeItem.value;
  if (!item) return;
  state?.saveTimelineTextStyleAsDefault?.(item);
}

function closePanel() {
  emit('close');
  if (props.modelValue === undefined && state?.selectedTimelineItem) {
    state.selectedTimelineItem.value = null;
  }
}

function deleteItem() {
  const item = activeItem.value;
  emit('delete', item);
  if (props.modelValue === undefined && state?.selectedTimelineItem) {
    state.selectedTimelineItem.value = null;
  }
}
</script>
