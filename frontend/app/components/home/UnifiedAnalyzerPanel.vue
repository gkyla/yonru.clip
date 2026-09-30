<template>
  <div class="px-4 sm:px-8 w-full mb-10 relative z-30">
    <div
      class="bg-[#111318]/90 backdrop-blur-xl border border-surface-border rounded-2xl p-3 sm:p-4 shadow-2xl relative z-30 transition-all duration-300 focus-within:border-slate-600/70 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.03)]"
    >
      <!-- Tier 1: YouTube URL Input + Analyze Button + Mobile Options Button -->
      <div class="flex items-center gap-2 sm:gap-3 relative">
        <div class="relative flex-1 flex items-center">
          <div
            class="absolute left-3.5 sm:left-4 text-slate-500 flex items-center pointer-events-none"
          >
            <Icon name="ri:youtube-fill" class="text-lg text-red-500/80" />
          </div>
          <input
            v-model="state.youtubeUrl.value"
            type="url"
            placeholder="Paste YouTube video URL (e.g. https://youtube.com/watch?v=...)"
            class="w-full bg-surface-dark/80 border border-surface-border/80 text-white pl-10 sm:pl-11 pr-20 py-3 sm:py-3.5 rounded-xl focus:outline-none focus:border-slate-500/60 focus:ring-1 focus:ring-slate-500/20 transition-all font-medium text-xs sm:text-sm placeholder-slate-500"
            :disabled="isProcessing"
            @keydown.enter="handleAnalyzeClick"
          />
          <div class="absolute right-2 sm:right-3 flex items-center gap-1.5">
            <button
              v-if="state.youtubeUrl.value"
              class="text-slate-500 hover:text-white transition-colors p-1 cursor-pointer"
              title="Clear URL"
              @click="state.youtubeUrl.value = ''"
            >
              <Icon name="ri:close-circle-fill" class="text-base" />
            </button>
            <button
              v-else
              :disabled="isProcessing"
              class="px-2.5 py-1 bg-surface-dark hover:bg-[#1a1e27] border border-surface-border hover:border-slate-600 rounded-lg text-slate-400 hover:text-slate-200 text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer select-none active:scale-95 disabled:opacity-50"
              title="Paste URL from Clipboard"
              @click="handlePasteUrl"
            >
              <Icon name="ri:clipboard-line" class="text-xs text-slate-400" />
              <span>Paste</span>
            </button>
          </div>
        </div>

        <!-- Mobile Options Trigger Button (< 640px) -->
        <button
          :disabled="isProcessing"
          class="sm:hidden p-3 bg-surface-dark border border-surface-border rounded-xl text-slate-300 hover:text-white transition-all flex items-center justify-center relative shrink-0 disabled:opacity-50 cursor-pointer"
          :class="{
            'border-accent-500/50 text-accent-500 bg-accent-500/10':
              hasActiveAdvancedFilters
          }"
          title="Analyzer Settings"
          @click="isMobileOptionsOpen = true"
        >
          <Icon name="ri:equalizer-line" class="text-lg" />
          <span
            v-if="hasActiveAdvancedFilters"
            class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-500 ring-2 ring-[#111318]"
          ></span>
        </button>

        <!-- Primary CTA Button -->
        <button
          :disabled="!state.youtubeUrl.value || isProcessing"
          class="w-11 h-11 sm:w-12 sm:h-12 bg-accent-500 hover:bg-accent-600 text-black rounded-xl border border-surface-border/80 flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111318] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          title="Detect Hooks (Enter)"
          aria-label="Detect Hooks (Enter)"
          @click="handleAnalyzeClick"
        >
          <Icon
            v-if="isProcessing"
            name="ri:loader-4-line"
            class="text-xl sm:text-2xl animate-spin text-black"
          />
          <Icon
            v-else
            name="codicon:search-sparkle"
            class="text-xl sm:text-2xl text-black"
          />
        </button>
      </div>

      <!-- Subtle Divider (Desktop/Tablet sm:block) -->
      <div
        class="hidden sm:block border-t border-surface-border/50 my-2.5"
      ></div>

      <!-- Tier 2: Dedicated Chips Toolbar (Desktop/Tablet sm:flex) -->
      <div
        class="hidden sm:flex items-center justify-between gap-2 text-left select-none text-xs"
      >
        <!-- Left: Dedicated Config Chips -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 1. Preset & Custom Template Dropdown Chip -->
          <div ref="presetDropdownRef" class="relative">
            <button
              :disabled="isProcessing"
              class="px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              :class="[
                isPresetDropdownOpen
                  ? 'bg-surface-panel border-accent-500/50 shadow-[0_0_10px_rgba(255,215,0,0.1)]'
                  : currentPresetOption.isCustom
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-300 hover:border-purple-500'
                    : 'bg-surface-dark border-surface-border text-slate-300 hover:border-slate-600 hover:text-white'
              ]"
              @click="isPresetDropdownOpen = !isPresetDropdownOpen"
            >
              <Icon
                :name="currentPresetOption.icon"
                class="text-sm"
                :class="
                  currentPresetOption.isCustom
                    ? 'text-purple-400'
                    : 'text-accent-500'
                "
              />
              <span class="font-semibold">{{ currentPresetOption.label }}</span>
              <Icon
                name="ri:arrow-down-s-line"
                class="text-slate-500 text-xs transition-transform duration-200"
                :class="{ 'rotate-180': isPresetDropdownOpen }"
              />
            </button>

            <!-- Preset & Custom Template Popover (Wider 2-Column Opaque Dark Layout) -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="transform scale-95 opacity-0 -translate-y-1"
              enter-to-class="transform scale-100 opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="transform scale-100 opacity-100 translate-y-0"
              leave-to-class="transform scale-95 opacity-0 -translate-y-1"
            >
              <div
                v-if="isPresetDropdownOpen"
                class="absolute top-full mt-2 left-0 w-[520px] bg-[#14171f] border border-surface-border rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in duration-150 grid grid-cols-2 gap-3"
              >
                <!-- Column 1: Smart Intent Presets -->
                <div
                  class="flex flex-col gap-1.5 pr-2 border-r border-surface-border/60"
                >
                  <div
                    class="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between"
                  >
                    <span class="flex items-center gap-1.5">
                      <Icon
                        name="ri:sparkling-fill"
                        class="text-accent-500 text-xs"
                      />
                      Smart Intent Presets
                    </span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <button
                      v-for="preset in presetOptions"
                      :key="preset.id"
                      class="w-full px-2.5 py-2 rounded-xl text-left transition-all flex items-start gap-2.5 hover:bg-white/[0.04] cursor-pointer group"
                      :class="{
                        'bg-accent-500/10 border border-accent-500/30 text-accent-400 font-bold':
                          state.extractionMode.value === 'preset' &&
                          state.selectedPresetId.value === preset.id
                      }"
                      @click="
                        state.extractionMode.value = 'preset';
                        state.selectedPresetId.value = preset.id;
                        isPresetDropdownOpen = false;
                      "
                    >
                      <Icon
                        :name="preset.icon"
                        class="text-base mt-0.5 shrink-0"
                        :class="
                          state.extractionMode.value === 'preset' &&
                          state.selectedPresetId.value === preset.id
                            ? 'text-accent-500'
                            : 'text-slate-400 group-hover:text-white'
                        "
                      />
                      <div class="flex-1 min-w-0">
                        <div
                          class="text-xs font-semibold leading-snug"
                          :class="
                            state.extractionMode.value === 'preset' &&
                            state.selectedPresetId.value === preset.id
                              ? 'text-accent-400'
                              : 'text-slate-200 group-hover:text-white'
                          "
                        >
                          {{ preset.label }}
                        </div>
                        <div
                          class="text-[10px] text-slate-400 leading-tight mt-0.5 font-normal line-clamp-2"
                        >
                          {{ preset.desc }}
                        </div>
                      </div>
                      <Icon
                        v-if="
                          state.extractionMode.value === 'preset' &&
                          state.selectedPresetId.value === preset.id
                        "
                        name="ri:check-line"
                        class="text-accent-500 text-xs shrink-0 mt-0.5"
                      />
                    </button>
                  </div>
                </div>

                <!-- Column 2: Custom Prompt Templates -->
                <div class="flex flex-col gap-1.5 pl-1">
                  <div
                    class="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-1 flex items-center justify-between"
                  >
                    <span class="flex items-center gap-1.5">
                      <Icon
                        name="ri:file-code-line"
                        class="text-purple-400 text-xs"
                      />
                      Custom Templates
                    </span>
                    <NuxtLink
                      to="/prompts"
                      class="text-accent-500 hover:underline normal-case text-[10px] font-bold"
                      @click="isPresetDropdownOpen = false"
                      >Manage</NuxtLink
                    >
                  </div>
                  <div
                    v-if="state.promptsList.value.length === 0"
                    class="p-4 text-center text-slate-500 text-[11px]"
                  >
                    No custom templates yet.
                  </div>
                  <div
                    v-else
                    class="flex flex-col gap-1 max-h-[260px] overflow-y-auto custom-scrollbar pr-1"
                  >
                    <button
                      v-for="p in state.promptsList.value"
                      :key="p.id"
                      class="w-full px-2.5 py-2 rounded-xl text-left transition-all flex items-center justify-between hover:bg-white/[0.04] cursor-pointer group"
                      :class="{
                        'bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold':
                          state.extractionMode.value === 'custom' &&
                          state.selectedPrompt.value === p.id
                      }"
                      @click="
                        state.extractionMode.value = 'custom';
                        state.selectedPrompt.value = p.id;
                        isPresetDropdownOpen = false;
                      "
                      @mouseenter="hoveredPrompt = p"
                      @mouseleave="hoveredPrompt = null"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <Icon
                          name="ri:code-s-slash-line"
                          class="text-xs shrink-0"
                          :class="
                            state.extractionMode.value === 'custom' &&
                            state.selectedPrompt.value === p.id
                              ? 'text-purple-400'
                              : 'text-slate-500 group-hover:text-slate-300'
                          "
                        />
                        <span
                          class="text-xs truncate"
                          :class="
                            state.extractionMode.value === 'custom' &&
                            state.selectedPrompt.value === p.id
                              ? 'text-purple-300'
                              : 'text-slate-200 group-hover:text-white'
                          "
                          >{{ p.name }}</span
                        >
                      </div>
                      <Icon
                        v-if="
                          state.extractionMode.value === 'custom' &&
                          state.selectedPrompt.value === p.id
                        "
                        name="ri:check-line"
                        class="text-purple-400 text-xs shrink-0"
                      />
                    </button>
                  </div>

                  <!-- Hover Tooltip preview for custom template -->
                  <div
                    v-if="hoveredPrompt && hoveredPrompt.suitableFor?.length"
                    class="mt-auto p-2 bg-surface-dark border border-surface-border rounded-xl text-[10px] text-slate-400"
                  >
                    <div
                      class="font-bold text-accent-500 uppercase tracking-wider mb-1"
                    >
                      Suitable For:
                    </div>
                    <div class="line-clamp-2 text-slate-300 leading-tight">
                      {{ hoveredPrompt.suitableFor.join(', ') }}
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- 2. Language Dropdown Chip -->
          <div ref="langDropdownRef" class="relative">
            <button
              :disabled="isProcessing"
              class="px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              :class="[
                isLangDropdownOpen
                  ? 'bg-surface-panel border-accent-500/50 shadow-[0_0_10px_rgba(255,215,0,0.1)]'
                  : state.language.value && state.language.value !== 'auto'
                    ? 'bg-accent-500/10 border-accent-500/40 text-accent-400'
                    : 'bg-surface-dark border-surface-border text-slate-300 hover:border-slate-600 hover:text-white'
              ]"
              @click="isLangDropdownOpen = !isLangDropdownOpen"
            >
              <Icon
                :name="currentLanguageOption.icon"
                class="text-sm text-slate-400"
              />
              <span class="font-semibold">{{
                currentLanguageOption.label
              }}</span>
              <Icon
                name="ri:arrow-down-s-line"
                class="text-slate-500 text-xs transition-transform duration-200"
                :class="{ 'rotate-180': isLangDropdownOpen }"
              />
            </button>

            <!-- Language Popover -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="transform scale-95 opacity-0 -translate-y-1"
              enter-to-class="transform scale-100 opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="transform scale-100 opacity-100 translate-y-0"
              leave-to-class="transform scale-95 opacity-0 -translate-y-1"
            >
              <div
                v-if="isLangDropdownOpen"
                class="absolute top-full mt-2 left-0 w-48 bg-[#14171f] border border-surface-border rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150 flex flex-col gap-1"
              >
                <div
                  class="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 py-1"
                >
                  Spoken Language
                </div>
                <button
                  v-for="lang in languageOptions"
                  :key="lang.id"
                  class="w-full px-2.5 py-2 rounded-lg text-left transition-all flex items-center justify-between hover:bg-white/[0.04] cursor-pointer"
                  :class="{
                    'bg-accent-500/10 text-accent-400 font-bold':
                      (state.language.value || 'auto') === lang.id
                  }"
                  @click="
                    state.language.value = lang.id;
                    isLangDropdownOpen = false;
                  "
                >
                  <div class="flex items-center gap-2">
                    <Icon
                      :name="lang.icon"
                      class="text-sm"
                      :class="
                        (state.language.value || 'auto') === lang.id
                          ? 'text-accent-500'
                          : 'text-slate-400'
                      "
                    />
                    <span class="text-xs text-slate-200">{{ lang.label }}</span>
                  </div>
                  <Icon
                    v-if="(state.language.value || 'auto') === lang.id"
                    name="ri:check-line"
                    class="text-accent-500 text-xs"
                  />
                </button>
              </div>
            </Transition>
          </div>

          <!-- 3. Target Duration Dropdown Chip -->
          <div ref="durationDropdownRef" class="relative">
            <button
              :disabled="isProcessing"
              class="px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              :class="[
                isDurationDropdownOpen
                  ? 'bg-surface-panel border-accent-500/50 shadow-[0_0_10px_rgba(255,215,0,0.1)]'
                  : state.minDuration.value !== 30 ||
                      state.maxDuration.value !== 180
                    ? 'bg-accent-500/10 border-accent-500/40 text-accent-400'
                    : 'bg-surface-dark border-surface-border text-slate-300 hover:border-slate-600 hover:text-white'
              ]"
              @click="isDurationDropdownOpen = !isDurationDropdownOpen"
            >
              <Icon name="ri:time-line" class="text-sm text-slate-400" />
              <span class="font-semibold">{{ currentDurationLabel }}</span>
              <Icon
                name="ri:arrow-down-s-line"
                class="text-slate-500 text-xs transition-transform duration-200"
                :class="{ 'rotate-180': isDurationDropdownOpen }"
              />
            </button>

            <!-- Duration Popover -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="transform scale-95 opacity-0 -translate-y-1"
              enter-to-class="transform scale-100 opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="transform scale-100 opacity-100 translate-y-0"
              leave-to-class="transform scale-95 opacity-0 -translate-y-1"
            >
              <div
                v-if="isDurationDropdownOpen"
                class="absolute top-full mt-2 left-0 w-64 bg-[#14171f] border border-surface-border rounded-xl shadow-2xl p-2 z-50 animate-in fade-in duration-150 flex flex-col gap-1"
              >
                <div
                  class="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-1"
                >
                  Target Duration Bracket
                </div>
                <button
                  v-for="dp in durationPresets"
                  :key="dp.label"
                  class="w-full px-2.5 py-2 rounded-lg text-left transition-all flex items-center justify-between hover:bg-white/[0.04] cursor-pointer"
                  :class="{
                    'bg-accent-500/10 text-accent-400 font-bold':
                      state.minDuration.value === dp.min &&
                      state.maxDuration.value === dp.max
                  }"
                  @click="
                    selectDurationPreset(dp.min, dp.max);
                    isDurationDropdownOpen = false;
                  "
                >
                  <div class="flex flex-col">
                    <span class="text-xs text-slate-200">{{ dp.label }}</span>
                    <span class="text-[10px] text-slate-500 font-mono"
                      >{{ dp.min }}s – {{ dp.max }}s</span
                    >
                  </div>
                  <Icon
                    v-if="
                      state.minDuration.value === dp.min &&
                      state.maxDuration.value === dp.max
                    "
                    name="ri:check-line"
                    class="text-accent-500 text-xs"
                  />
                </button>
              </div>
            </Transition>
          </div>

          <!-- 4. Topic Focus Chip & Mini Popover -->
          <div ref="topicPopoverRef" class="relative">
            <button
              :disabled="isProcessing"
              class="px-3 py-1.5 rounded-lg border transition-all duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              :class="[
                isTopicPopoverOpen
                  ? 'bg-surface-panel border-accent-500/50 shadow-[0_0_10px_rgba(255,215,0,0.1)]'
                  : state.focusTopic.value
                    ? 'bg-accent-500/10 border-accent-500/40 text-accent-400'
                    : 'bg-surface-dark border-surface-border text-slate-300 hover:border-slate-600 hover:text-white'
              ]"
              @click="isTopicPopoverOpen = !isTopicPopoverOpen"
            >
              <Icon
                name="ri:search-eye-line"
                class="text-sm"
                :class="
                  state.focusTopic.value ? 'text-accent-500' : 'text-slate-400'
                "
              />
              <span class="font-semibold max-w-[120px] truncate">
                {{
                  state.focusTopic.value
                    ? state.focusTopic.value
                    : 'Topic Focus'
                }}
              </span>
              <span
                v-if="state.focusTopic.value"
                class="hover:text-red-400 transition-colors p-0.5"
                @click.stop="state.focusTopic.value = ''"
              >
                <Icon name="ri:close-circle-fill" class="text-xs" />
              </span>
            </button>

            <!-- Topic Focus Popover Input -->
            <Transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="transform scale-95 opacity-0 -translate-y-1"
              enter-to-class="transform scale-100 opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="transform scale-100 opacity-100 translate-y-0"
              leave-to-class="transform scale-95 opacity-0 -translate-y-1"
            >
              <div
                v-if="isTopicPopoverOpen"
                class="absolute top-full mt-2 left-0 w-80 bg-[#14171f] border border-surface-border rounded-xl shadow-2xl p-3 z-50 animate-in fade-in duration-150 flex flex-col gap-2.5"
              >
                <div class="flex items-center justify-between">
                  <span
                    class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"
                  >
                    <Icon
                      name="ri:flashlight-fill"
                      class="text-accent-500 text-xs"
                    />
                    Specific Topic Focus
                  </span>
                  <button
                    v-if="state.focusTopic.value"
                    class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                    @click="state.focusTopic.value = ''"
                  >
                    Clear
                  </button>
                </div>
                <div class="relative flex items-center">
                  <input
                    v-model="state.focusTopic.value"
                    type="text"
                    placeholder="e.g. Mitos air es, diet pemula..."
                    class="w-full bg-surface-dark border border-surface-border text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-slate-500/60 focus:ring-1 focus:ring-slate-500/20 placeholder-slate-500"
                    autofocus
                    @keydown.enter="isTopicPopoverOpen = false"
                  />
                </div>
                <div
                  class="flex items-center justify-between pt-1 border-t border-surface-border/50"
                >
                  <span class="text-[10px] text-slate-500"
                    >Injects focused instruction</span
                  >
                  <button
                    class="text-[10px] text-accent-500 hover:underline font-bold cursor-pointer"
                    @click="isTopicPopoverOpen = false"
                  >
                    Done
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Right: Whisper Model Status & Settings Shortcut -->
        <div class="flex items-center gap-1.5 shrink-0 justify-end">
          <!-- Active Transcriber Interactive Pill Wrapper -->
          <div class="relative group">
            <button
              type="button"
              :disabled="isProcessing"
              aria-label="Speech Transcriber settings and model information"
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-dark border border-surface-border text-slate-400 text-[10px] font-bold tracking-wider uppercase hover:border-accent-500/50 hover:text-white hover:shadow-[0_0_12px_rgba(255,215,0,0.1)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              @click="
                state.settingsScrollTarget.value = 'settings-whisper';
                navigateTo('/settings');
              "
            >
              <Icon
                name="ri:mic-line"
                class="text-xs text-accent-500 shrink-0 group-hover:scale-110 transition-transform"
              />
              <span>{{
                (state?.whisperModel?.value || 'BASE').toUpperCase()
              }}</span>
              <span
                v-if="activeWhisperEstimate"
                class="text-accent-400 font-bold"
              >
                (~{{ activeWhisperEstimate.estimated_seconds }}s/60s)
              </span>
              <span v-else class="text-slate-500 font-normal font-mono">
                (?/60s)
              </span>
              <Icon
                name="ri:arrow-right-s-line"
                class="text-slate-500 text-xs shrink-0 group-hover:text-accent-400 group-hover:translate-x-0.5 transition-all"
              />
            </button>

            <!-- Transcription Model Tooltip Card (seamless hover bridge via pb-2.5) -->
            <div
              class="absolute bottom-full right-0 pb-2.5 w-72 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-50"
            >
              <div
                class="bg-[#0f1117] border border-accent-500/40 rounded-xl p-3.5 shadow-[0_0_24px_rgba(0,0,0,0.8),0_0_15px_rgba(255,215,0,0.12)] text-left cursor-pointer hover:border-accent-500/70 transition-all relative"
                @click="
                  state.settingsScrollTarget.value = 'settings-whisper';
                  navigateTo('/settings');
                "
              >
                <!-- Compact Header: Role + Model Name -->
                <div
                  class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-surface-border/60"
                >
                  <div
                    class="flex items-center gap-1.5 text-xs font-bold text-white"
                  >
                    <Icon name="ri:mic-fill" class="text-accent-500 text-sm" />
                    <span>Whisper {{ activeWhisperMetadata.name }}</span>
                  </div>
                  <span
                    class="text-[9px] text-slate-500 font-mono uppercase tracking-wider"
                  >
                    Transcriber
                  </span>
                </div>

                <!-- Clean Description matching /settings -->
                <p class="text-[11px] leading-relaxed text-slate-300 mb-2.5">
                  {{ activeWhisperMetadata.desc }}
                </p>

                <!-- Metric Chips: Estimated Duration & Accuracy -->
                <div class="flex items-center gap-1.5 mb-2.5 flex-wrap">
                  <span
                    v-if="activeWhisperEstimate"
                    class="text-[9px] px-2 py-0.5 rounded-md bg-surface-dark border border-accent-500/30 text-accent-400 font-mono font-bold flex items-center gap-1"
                  >
                    <Icon name="ri:timer-line" class="text-[10px]" />
                    {{ activeWhisperEstimate.display_text }}
                  </span>
                  <span
                    v-else
                    class="text-[9px] px-2 py-0.5 rounded-md bg-surface-dark border border-surface-border text-slate-400 font-bold flex items-center gap-1"
                  >
                    <Icon
                      name="ri:timer-line"
                      class="text-[10px] text-slate-500"
                    />
                    Not benchmarked
                  </span>
                  <span
                    class="text-[9px] px-2 py-0.5 rounded-md bg-surface-dark border border-surface-border text-slate-300 font-bold uppercase tracking-tighter flex items-center gap-1"
                  >
                    <span class="text-slate-500 font-normal">Accuracy:</span>
                    {{ activeWhisperMetadata.acc }}
                  </span>
                </div>

                <!-- Simple Click Hint Footer -->
                <div
                  class="pt-2 border-t border-surface-border/50 flex items-center justify-between text-[10px] text-slate-400 normal-case font-sans"
                >
                  <span
                    class="flex items-center gap-1 text-slate-400 group-hover:text-accent-400 transition-colors"
                  >
                    <Icon
                      :name="
                        activeWhisperEstimate
                          ? 'ri:settings-3-line'
                          : 'ri:timer-flash-line'
                      "
                      class="text-xs"
                    />
                    <span>{{
                      activeWhisperEstimate
                        ? 'Click to change settings'
                        : 'Click to calculate speed in settings'
                    }}</span>
                  </span>
                  <Icon
                    name="ri:arrow-right-s-line"
                    class="text-xs text-slate-500 group-hover:text-accent-400 transition-colors"
                  />
                </div>

                <div
                  class="absolute -bottom-1.5 right-6 w-3 h-3 bg-[#0f1117] border-b border-r border-accent-500/40 transform rotate-45 z-40"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile Action Sheet Modal (< 640px) -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isMobileOptionsOpen"
      class="fixed inset-0 z-50 flex items-end sm:hidden"
    >
      <div
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        @click="isMobileOptionsOpen = false"
      ></div>

      <div
        class="relative w-full bg-[#14171f] border-t border-surface-border rounded-t-2xl p-5 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom duration-200 text-left"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between pb-2 border-b border-surface-border/60"
        >
          <div class="flex items-center gap-2">
            <div
              class="w-8 h-8 rounded-xl bg-accent-500/10 border border-accent-500/30 flex items-center justify-center text-accent-500"
            >
              <Icon name="ri:equalizer-line" class="text-base" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">Analyzer Options</h4>
              <p class="text-[11px] text-slate-400">
                Configure AI extraction parameters
              </p>
            </div>
          </div>
          <button
            class="p-2 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            @click="isMobileOptionsOpen = false"
          >
            <Icon name="ri:close-line" class="text-xl" />
          </button>
        </div>

        <!-- Section: Presets -->
        <div class="flex flex-col gap-2">
          <label
            class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"
          >
            <Icon name="ri:sparkling-fill" class="text-accent-500 text-xs" />
            Intent Preset
          </label>
          <div class="grid grid-cols-1 gap-1.5">
            <button
              v-for="preset in presetOptions"
              :key="preset.id"
              class="w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer"
              :class="
                state.extractionMode.value === 'preset' &&
                state.selectedPresetId.value === preset.id
                  ? 'bg-accent-500/15 border-accent-500 text-accent-400 font-bold'
                  : 'bg-surface-dark border-surface-border text-slate-300'
              "
              @click="
                state.extractionMode.value = 'preset';
                state.selectedPresetId.value = preset.id;
              "
            >
              <div class="flex items-center gap-2.5">
                <Icon
                  :name="preset.icon"
                  class="text-base"
                  :class="
                    state.extractionMode.value === 'preset' &&
                    state.selectedPresetId.value === preset.id
                      ? 'text-accent-500'
                      : 'text-slate-400'
                  "
                />
                <div>
                  <div class="text-xs font-bold">{{ preset.label }}</div>
                  <div class="text-[10px] text-slate-400">
                    {{ preset.desc }}
                  </div>
                </div>
              </div>
              <Icon
                v-if="
                  state.extractionMode.value === 'preset' &&
                  state.selectedPresetId.value === preset.id
                "
                name="ri:check-line"
                class="text-accent-500 text-base shrink-0"
              />
            </button>
          </div>
        </div>

        <!-- Section: Custom Templates (if any) -->
        <div v-if="state.promptsList.value.length" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <label
              class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"
            >
              <Icon name="ri:file-code-line" class="text-purple-400 text-xs" />
              Or Custom Template
            </label>
            <NuxtLink
              to="/prompts"
              class="text-accent-500 text-[10px] font-bold hover:underline"
              @click="isMobileOptionsOpen = false"
              >Manage</NuxtLink
            >
          </div>
          <div class="grid grid-cols-1 gap-1.5">
            <button
              v-for="p in state.promptsList.value"
              :key="p.id"
              class="w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer"
              :class="
                state.extractionMode.value === 'custom' &&
                state.selectedPrompt.value === p.id
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                  : 'bg-surface-dark border-surface-border text-slate-300'
              "
              @click="
                state.extractionMode.value = 'custom';
                state.selectedPrompt.value = p.id;
              "
            >
              <span class="text-xs">{{ p.name }}</span>
              <Icon
                v-if="
                  state.extractionMode.value === 'custom' &&
                  state.selectedPrompt.value === p.id
                "
                name="ri:check-line"
                class="text-purple-400 text-base shrink-0"
              />
            </button>
          </div>
        </div>

        <!-- Section: Language & Duration in Grid -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Language -->
          <div class="flex flex-col gap-1.5">
            <label
              class="text-[10px] font-black uppercase tracking-wider text-slate-400"
              >Language</label
            >
            <select
              v-model="state.language.value"
              class="w-full bg-surface-dark border border-surface-border text-white text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-slate-500/60 focus:ring-1 focus:ring-slate-500/20"
            >
              <option v-for="l in languageOptions" :key="l.id" :value="l.id">
                {{ l.label }}
              </option>
            </select>
          </div>

          <!-- Duration -->
          <div class="flex flex-col gap-1.5">
            <label
              class="text-[10px] font-black uppercase tracking-wider text-slate-400"
              >Target Duration</label
            >
            <select
              :value="`${state.minDuration.value}-${state.maxDuration.value}`"
              class="w-full bg-surface-dark border border-surface-border text-white text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-slate-500/60 focus:ring-1 focus:ring-slate-500/20"
              @change="
                e => {
                  const val = (e.target as HTMLSelectElement).value;
                  const [min, max] = val.split('-').map(Number);
                  if (min !== undefined && max !== undefined)
                    selectDurationPreset(min, max);
                }
              "
            >
              <option
                v-for="dp in durationPresets"
                :key="dp.label"
                :value="`${dp.min}-${dp.max}`"
              >
                {{ dp.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Section: Topic Focus -->
        <div class="flex flex-col gap-1.5">
          <label
            class="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1"
          >
            <Icon name="ri:search-eye-line" class="text-accent-500 text-xs" />
            Topic Focus / Keyword
          </label>
          <div class="relative flex items-center">
            <input
              v-model="state.focusTopic.value"
              type="text"
              placeholder="e.g. Mitos air es, diet pemula..."
              class="w-full bg-surface-dark border border-surface-border text-white text-xs px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-slate-500/60 focus:ring-1 focus:ring-slate-500/20 placeholder-slate-500 pr-8"
            />
            <button
              v-if="state.focusTopic.value"
              class="absolute right-3 text-slate-500 hover:text-white text-xs cursor-pointer"
              @click="state.focusTopic.value = ''"
            >
              <Icon name="ri:close-circle-fill" />
            </button>
          </div>
        </div>

        <!-- Footer Action -->
        <button
          class="w-full py-3 bg-accent-500 text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-accent-400 transition-colors mt-2 cursor-pointer"
          @click="isMobileOptionsOpen = false"
        >
          Apply & Close
        </button>
      </div>
    </div>
  </Transition>

  <div
    v-if="state.jobError.value"
    class="text-red-400 text-sm mt-4 mono bg-red-500/10 inline-block px-3 py-1 rounded border border-red-500/20 shadow-lg"
  >
    {{ state.jobError.value }}
  </div>
</template>

<script setup lang="ts">
import type {
  PromptTemplate,
  WhisperModelOption,
  HookIntentPreset,
  HardwareModelEstimate
} from '../../types/clipper';

const props = defineProps<{
  isProcessing?: boolean;
}>();

const emit = defineEmits<{
  (e: 'analyze'): void;
}>();

const state = useClipperState();

const isPresetDropdownOpen = ref(false);
const presetDropdownRef = ref<HTMLElement | null>(null);

const isPromptDropdownOpen = ref(false);
const promptDropdownRef = ref<HTMLElement | null>(null);
const hoveredPrompt = ref<PromptTemplate | null>(null);

const isLangDropdownOpen = ref(false);
const langDropdownRef = ref<HTMLElement | null>(null);

const isDurationDropdownOpen = ref(false);
const durationDropdownRef = ref<HTMLElement | null>(null);

const isTopicPopoverOpen = ref(false);
const topicPopoverRef = ref<HTMLElement | null>(null);

const isMobileOptionsOpen = ref(false);

interface PresetOption {
  id: HookIntentPreset;
  label: string;
  icon: string;
  desc: string;
}

const presetOptions: PresetOption[] = [
  {
    id: 'auto',
    label: 'Auto Detect Virality',
    icon: 'ri:fire-fill',
    desc: 'Identifies highest-retention moments across all styles'
  },
  {
    id: 'humor',
    label: 'Funny & Relatable',
    icon: 'ri:emotion-laugh-line',
    desc: 'Focuses on punchlines, comedic timing, and humor'
  },
  {
    id: 'educational',
    label: 'Edukasi & Debunk',
    icon: 'ri:lightbulb-line',
    desc: 'Debunks myths, explains facts, and provides simple analogies'
  },
  {
    id: 'storytelling',
    label: 'Story & Deep Talk',
    icon: 'ri:mic-line',
    desc: 'Narrative story arcs, turning points, and personal reflections'
  },
  {
    id: 'debate',
    label: 'Hot Takes',
    icon: 'ri:flashlight-fill',
    desc: 'Bold opinions, passionate arguments, and controversial takes'
  }
];

const currentPrompt = computed(() => {
  return state.promptsList.value.find(
    (p: PromptTemplate) => p.id === state.selectedPrompt.value
  );
});

const currentPresetOption = computed(() => {
  if (state.extractionMode.value === 'custom') {
    const promptName = currentPrompt.value?.name;
    return {
      id: 'custom',
      label: promptName ? `Custom: ${promptName}` : 'Custom Template',
      icon: 'ri:file-code-line',
      desc: 'Using custom prompt template',
      isCustom: true
    };
  }
  const found = presetOptions.find(p => p.id === state.selectedPresetId.value);
  return found
    ? { ...found, isCustom: false }
    : { ...presetOptions[0]!, isCustom: false };
});

const durationPresets = [
  { label: '30s - 180s (Default / Full Story)', min: 30, max: 180 },
  { label: '< 60s (Quick Bites)', min: 15, max: 60 },
  { label: '60s - 180s (Deep Insight)', min: 60, max: 180 }
];

function selectDurationPreset(min: number, max: number) {
  state.minDuration.value = min;
  state.maxDuration.value = max;
}

const currentDurationLabel = computed(() => {
  const min = state.minDuration.value;
  const max = state.maxDuration.value;
  if (min === 30 && max === 180) return '30s - 180s';
  if (min === 15 && max === 60) return '< 60s';
  if (min === 60 && max === 180) return '60s - 180s';
  return `${min}s - ${max}s`;
});

const hasActiveAdvancedFilters = computed(() => {
  return Boolean(
    state.focusTopic.value ||
    state.extractionMode.value === 'custom' ||
    state.minDuration.value !== 30 ||
    state.maxDuration.value !== 180 ||
    (state.language.value && state.language.value !== 'auto')
  );
});

interface LanguageOption {
  id: string;
  label: string;
  icon: string;
  badge: string;
}

const languageOptions: LanguageOption[] = [
  { id: 'auto', label: 'Auto Detect', icon: 'ri:global-line', badge: 'AUTO' },
  { id: 'id', label: 'Indonesian (ID)', icon: 'ri:translate-2', badge: 'ID' },
  { id: 'en', label: 'English (EN)', icon: 'ri:translate', badge: 'EN' }
];

const currentLanguageOption = computed<LanguageOption>(() => {
  const val = state.language.value || 'auto';
  return languageOptions.find(l => l.id === val) || languageOptions[0]!;
});

const hardwareProfile = computed(() => state.hardwareProfile?.value || null);

const activeWhisperMetadata = computed(() => {
  const modelId = state.whisperModel.value || 'base';
  return (
    state.whisperModels.find((m: WhisperModelOption) => m.id === modelId) ||
    state.whisperModels[1]
  );
});

const activeWhisperEstimate = computed<HardwareModelEstimate | null>(() => {
  const estimates = hardwareProfile.value?.model_estimates as
    Record<string, HardwareModelEstimate> | undefined;
  if (!estimates) return null;
  const modelId = state.whisperModel.value || 'base';
  return estimates[modelId] || null;
});

async function handlePasteUrl() {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      if (text) {
        state.youtubeUrl.value = text.trim();
      }
    }
  } catch (err) {
    console.error('Failed to read from clipboard:', err);
  }
}

function handleAnalyzeClick() {
  emit('analyze');
}

function handleDocumentClick(e: MouseEvent) {
  const target = e.target as Node;
  if (presetDropdownRef.value && !presetDropdownRef.value.contains(target)) {
    isPresetDropdownOpen.value = false;
  }
  if (langDropdownRef.value && !langDropdownRef.value.contains(target)) {
    isLangDropdownOpen.value = false;
  }
  if (
    durationDropdownRef.value &&
    !durationDropdownRef.value.contains(target)
  ) {
    isDurationDropdownOpen.value = false;
  }
  if (topicPopoverRef.value && !topicPopoverRef.value.contains(target)) {
    isTopicPopoverOpen.value = false;
  }
  if (promptDropdownRef.value && !promptDropdownRef.value.contains(target)) {
    isPromptDropdownOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleDocumentClick);
  }
});
</script>
