<template>
  <div v-if="state" class="p-6 space-y-6 bg-[#0e0e12] border border-white/5 rounded-3xl text-white max-h-[85vh] md:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/5 pb-4 flex-shrink-0">
      <div>
        <h3 class="text-base font-black text-white tracking-tight uppercase flex items-center gap-2">
          <Icon name="ri:shield-keyhole-line" class="text-accent-500" />
          Content Safety Configuration
        </h3>
        <p class="text-xs text-slate-500 font-medium">Configure censoring sensitivity, platform overlays, and word blacklists.</p>
      </div>
      <button @click="$emit('close')" class="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors">
        <Icon name="ri:close-line" />
      </button>
    </div>

    <!-- 2-Column Responsive Layout -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
      
      <!-- COLUMN 1: Engine Controls & Platform Filters -->
      <div class="space-y-5 border-r border-white/5 pr-0 md:pr-6">
        
        <!-- 1. Safety Sensitivity Level -->
        <div class="space-y-2">
          <label class="text-xs text-slate-500 font-black uppercase tracking-widest block">Safety Sensitivity</label>
          <div class="grid grid-cols-3 gap-1.5 p-1 bg-white/[0.02] border border-white/5 rounded-xl">
            <button 
              v-for="level in ['strict', 'standard', 'manual']" 
              :key="level"
              @click="state.safetySensitivity.value = level; state.saveBlacklistToStorage()"
              class="py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all"
              :class="state.safetySensitivity.value === level 
                ? 'bg-accent-500 text-black shadow-[0_0_12px_rgba(207,255,80,0.3)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'"
            >
              {{ level }}
            </button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed bg-white/[0.01] border border-white/5 rounded-xl p-3 mt-1.5 whitespace-pre-line font-medium">
            {{ 
              state.safetySensitivity.value === 'strict' 
                ? '• Subtitles: Censors all active categories (Violence, Sexual, Profanity) including mild slang + Custom Blacklist.\n• Audio: Only bleeped if "Mute/Bleep Audio" is enabled below (bleeps all Strict category words).' :
              state.safetySensitivity.value === 'standard'
                ? '• Subtitles: Censors only critical/severe shadowban keywords (e.g. suicide, murder, porn, f*ck, bangsat, kontol). Allows mild slang.\n• Audio: Only bleeped if "Mute/Bleep Audio" is enabled below (bleeps only Standard category words).'
                : '• Subtitles: Censors Custom Blacklist only (ignores built-in categories).\n• Audio: Only bleeped if "Mute/Bleep Audio" is enabled below (bleeps only Custom Blacklist words).'
            }}
          </p>
        </div>

        <!-- 2. Auto-Masking Censorship Style -->
        <div class="space-y-2">
          <label class="text-xs text-slate-500 font-black uppercase tracking-widest block">Auto-Fix Masking Style</label>
          <div class="relative group">
            <select 
              v-model="state.maskingStyle.value"
              @change="state.saveBlacklistToStorage()"
              class="w-full bg-white/[0.02] border border-white/5 focus:border-accent-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none transition-all appearance-none cursor-pointer pr-10"
            >
              <option value="asterisk">Asterisks (e.g. k*lling)</option>
              <option value="block">Full Block (e.g. *******)</option>
              <option value="bleep_marker">Bleep Tag (e.g. [BLEEP])</option>
            </select>
            <Icon name="ri:arrow-down-s-line" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>



        <!-- 4. Guidelines & Audio Options -->
        <div class="space-y-3 pt-2 border-t border-white/5">
          <!-- Audio Bleep option -->
          <div class="space-y-2">
            <label class="flex items-center justify-between cursor-pointer group">
              <div class="flex flex-col">
                <span class="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Icon :name="state.audioBleepEnabled.value ? 'ri:volume-up-line' : 'ri:volume-mute-line'" class="text-xs text-accent-500" />
                  Mute/Bleep Audio
                </span>
                <span class="text-xs text-slate-500 mt-0.5">Censor audio during final video render</span>
              </div>
              <input 
                type="checkbox" 
                v-model="state.audioBleepEnabled.value"
                @change="state.saveBlacklistToStorage()"
                class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-4 h-4 cursor-pointer"
              />
            </label>

            <!-- Audio Bleep options container -->
            <div v-if="state.audioBleepEnabled.value" class="pl-4 border-l border-white/10 space-y-3 pt-1 pb-2">
              <!-- Selector -->
              <div class="space-y-1">
                <div class="flex items-center gap-1.5">
                  <label class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Bleep Sound Type</label>
                  <div class="relative group/tooltip flex items-center">
                    <Icon name="ri:question-line" class="text-slate-500 hover:text-slate-300 text-xs cursor-help transition-colors" />
                    <div class="absolute left-0 bottom-full mb-1.5 w-60 p-2.5 bg-surface-dark/95 border border-surface-border/80 rounded-xl shadow-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-[10px] text-slate-300 leading-normal opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 tracking-normal normal-case space-y-1.5">
                      <p><strong class="text-white font-bold">Mute Audio (Default):</strong> Mutes spoken audio during sensitive words without playing any sound effects.</p>
                      <p><strong class="text-accent-400 font-bold">Custom Sound File:</strong> Plays a bleep sound (default preset or custom uploaded audio file) when sensitive words are spoken.</p>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1 p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
                  <button
                    type="button"
                    @click="state.audioBleepSource.value = 'mute'; state.saveBlacklistToStorage()"
                    class="py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all"
                    :class="state.audioBleepSource.value === 'mute'
                      ? 'bg-white/10 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-white font-bold'"
                  >
                    Mute Audio (Default)
                  </button>
                  <button
                    type="button"
                    @click="state.audioBleepSource.value = 'custom'; state.saveBlacklistToStorage()"
                    class="py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all"
                    :class="state.audioBleepSource.value === 'custom'
                      ? 'bg-white/10 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-white font-bold'"
                  >
                    Custom Sound File
                  </button>
                </div>
              </div>

              <!-- Custom File Section / Bleep Sound Library -->
              <div v-if="state.audioBleepSource.value === 'custom'" class="space-y-2">
                <input
                  type="file"
                  ref="bleepFileInput"
                  class="hidden"
                  accept="audio/*"
                  @change="handleBleepUpload"
                />

                <!-- Library Items List -->
                <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div
                    v-for="item in state.bleepLibrary.value"
                    :key="item.id"
                    @click="state.selectBleepAudio(item.id)"
                    class="p-2 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-200"
                    :class="state.selectedBleepAudioId.value === item.id
                      ? 'bg-accent-500/10 border-accent-500/50 shadow-sm'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]'"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <Icon
                        :name="item.isPreset ? 'ri:volume-up-line' : 'ri:music-2-line'"
                        class="text-sm flex-shrink-0"
                        :class="state.selectedBleepAudioId.value === item.id ? 'text-accent-400' : 'text-slate-400'"
                      />
                      <div class="flex flex-col min-w-0">
                        <span class="text-xs font-bold truncate" :class="state.selectedBleepAudioId.value === item.id ? 'text-white' : 'text-slate-300'">
                          {{ item.name }}
                        </span>
                        <span class="text-[9px] font-mono font-medium" :class="item.isPreset ? 'text-accent-400/80' : 'text-slate-500'">
                          {{ item.isPreset ? 'Default Preset' : 'Custom Upload' }}
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 flex-shrink-0" @click.stop>
                      <!-- Play/Preview button -->
                      <button
                        type="button"
                        @click="toggleBleepPreview(item)"
                        class="p-1 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-slate-400 rounded transition-colors"
                        :title="isPlayingPreview && previewingAudioId === item.id ? 'Pause Preview' : 'Play Preview'"
                      >
                        <Icon :name="isPlayingPreview && previewingAudioId === item.id ? 'ri:pause-line' : 'ri:play-line'" class="text-xs" />
                      </button>
                      
                      <!-- Delete button for custom upload items -->
                      <button
                        v-if="!item.isPreset"
                        type="button"
                        @click="state.removeCustomBleepFile(item.id)"
                        class="p-1 bg-white/[0.03] hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded transition-colors"
                        title="Delete File"
                      >
                        <Icon name="ri:delete-bin-line" class="text-xs" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Add New Custom Audio Upload Button -->
                <div
                  @click="bleepFileInput?.click()"
                  class="border border-dashed border-white/10 hover:border-accent-500/50 hover:bg-white/[0.02] rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 group/upload"
                >
                  <Icon name="ri:upload-cloud-2-line" class="text-base text-slate-500 group-hover/upload:text-accent-500 transition-colors" />
                  <span class="text-xs font-bold text-slate-300">Upload Custom Sound</span>
                  <span class="text-[9px] text-slate-500 font-mono">(.mp3, .wav, max 1MB)</span>
                </div>

                <!-- Error message if any -->
                <div v-if="bleepUploadError" class="text-[10px] text-rose-400 font-medium flex items-center gap-1">
                  <Icon name="ri:error-warning-line" class="text-xs flex-shrink-0" />
                  <span>{{ bleepUploadError }}</span>
                </div>
              </div>

              <!-- Audio Mute Scope Selector -->
              <div class="space-y-1 pt-1">
                <div class="flex items-center gap-1.5">
                  <label class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Audio Mute Scope</label>
                  <div class="relative group/tooltip flex items-center">
                    <Icon name="ri:question-line" class="text-slate-500 hover:text-slate-300 text-xs cursor-help transition-colors" />
                    <div class="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-surface-dark/95 border border-surface-border/80 rounded-xl shadow-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-[10px] text-slate-300 leading-normal opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 tracking-normal normal-case space-y-1.5">
                      <p><strong class="text-white font-bold">Full Word:</strong> Mutes or bleeps the full duration of sensitive words from start to end.</p>
                      <p><strong class="text-accent-400 font-bold">Partial End:</strong> Mutes only the ending 50% syllable duration (initial syllable remains audible for spoken context).</p>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1 p-0.5 bg-white/[0.02] border border-white/5 rounded-lg">
                  <button
                    type="button"
                    @click="if (state.bleepMode) state.bleepMode.value = 'full'; state.saveBlacklistToStorage()"
                    class="py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all"
                    :class="state.bleepMode?.value !== 'partial_end'
                      ? 'bg-white/10 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-white font-bold'"
                  >
                    Full Word
                  </button>
                  <button
                    type="button"
                    @click="if (state.bleepMode) state.bleepMode.value = 'partial_end'; state.saveBlacklistToStorage()"
                    class="py-1 text-[10px] font-black uppercase tracking-wider rounded transition-all"
                    :class="state.bleepMode?.value === 'partial_end'
                      ? 'bg-white/10 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-white font-bold'"
                  >
                    Partial End
                  </button>
                </div>
              </div>

              <!-- Bleep Padding Offset Slider/Input -->
              <div class="space-y-1 pt-1">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <label class="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Bleep Padding</label>
                    <div class="relative group/tooltip flex items-center">
                      <Icon name="ri:question-line" class="text-slate-500 hover:text-slate-300 text-xs cursor-help transition-colors" />
                      <div class="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-surface-dark/95 border border-surface-border/80 rounded-xl shadow-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-[10px] text-slate-300 leading-normal opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 tracking-normal normal-case space-y-1.5">
                        <p><strong class="text-white font-bold">Bleep Padding (ms):</strong> Configurable time buffer in milliseconds added before and after flagged word timestamps to prevent phoneme leakage during audio muting.</p>
                      </div>
                    </div>
                  </div>
                  <span class="text-[10px] font-mono font-bold text-accent-400">{{ state.bleepPaddingOffset?.value ?? 50 }}ms</span>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="10"
                    :value="state.bleepPaddingOffset?.value ?? 50"
                    @input="state.bleepPaddingOffset.value = Number(($event.target).value); state.saveBlacklistToStorage()"
                    class="w-full accent-accent-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                  />
                  <input
                    type="number"
                    min="0"
                    max="500"
                    :value="state.bleepPaddingOffset?.value ?? 50"
                    @input="state.bleepPaddingOffset.value = Math.max(0, Number(($event.target).value)); state.saveBlacklistToStorage()"
                    class="w-14 px-1.5 py-0.5 bg-white/[0.03] border border-white/10 rounded text-[10px] font-mono text-center text-white focus:outline-none focus:border-accent-500"
                  />
                </div>
                <p class="text-[9px] text-slate-500 leading-tight">Safety margin before & after flagged words to prevent phoneme leakage.</p>
              </div>
            </div>
          </div>

          <!-- Guideline settings link / checkbox list -->
          <div class="space-y-2 pt-1">
            <span class="text-xs text-slate-500 font-bold uppercase tracking-wider block">Scan Layout Guidelines</span>
            <div class="flex flex-wrap gap-2">
              <label 
                v-for="platform in ['tiktok', 'reels', 'shorts']" 
                :key="platform"
                class="px-2.5 py-1 rounded-lg border text-xs font-black uppercase tracking-widest cursor-pointer select-none transition-colors flex items-center gap-1.5"
                :class="state.activePlatformFilters.value[platform]
                  ? 'bg-accent-500/10 border-accent-500/30 text-accent-500'
                  : 'bg-white/[0.01] border-white/5 text-slate-500'"
              >
                <input 
                  type="checkbox" 
                  v-model="state.activePlatformFilters.value[platform]"
                  class="hidden"
                />
                {{ platform }}
              </label>
            </div>
          </div>
        </div>

      </div>

      <!-- COLUMN 2: Keyword & Exception Lists -->
      <div class="flex flex-col space-y-4">
        
        <!-- Tab Selectors -->
        <div class="flex border-b border-white/5">
          <button 
            @click="activeTab = 'categories'"
            class="flex-1 pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors"
            :class="activeTab === 'categories' 
              ? 'border-accent-500 text-accent-500' 
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >
            Categories
          </button>
          <button 
            @click="activeTab = 'blacklist'"
            class="flex-1 pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors"
            :class="activeTab === 'blacklist' 
              ? 'border-accent-500 text-accent-500' 
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >
            Custom Blacklist
          </button>
          <button 
            @click="activeTab = 'whitelist'"
            class="flex-1 pb-2.5 text-xs font-black uppercase tracking-widest border-b-2 transition-colors"
            :class="activeTab === 'whitelist' 
              ? 'border-accent-500 text-accent-500' 
              : 'border-transparent text-slate-500 hover:text-slate-300'"
          >
            Whitelist
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 flex flex-col min-h-0">
          
          <!-- Tab 1: Categories -->
          <div v-if="activeTab === 'categories'" class="flex-1 flex flex-col space-y-4 min-h-0">
            <!-- If in Manual mode, show notice -->
            <div v-if="state.safetySensitivity.value === 'manual'" class="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
              <Icon name="ri:settings-5-line" class="text-3xl text-slate-500 mb-2" />
              <h4 class="text-xs font-black text-slate-300 uppercase tracking-wider">Categories Disabled</h4>
              <p class="text-xs text-slate-500 mt-1 max-w-[280px] leading-relaxed">
                You are currently in <b>Manual Sensitivity Mode</b>. Built-in categories are ignored, and only your Custom Blacklist will be filtered.
              </p>
              <button 
                @click="state.safetySensitivity.value = 'standard'; state.saveBlacklistToStorage()"
                class="mt-4 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Switch to Standard
              </button>
            </div>

            <div v-else class="space-y-3 flex-1 flex flex-col min-h-0">
              <span class="text-xs text-slate-500 font-black uppercase tracking-widest block">Categorized Filters</span>
              <div class="grid grid-cols-3 gap-2 shrink-0">
                <div 
                  v-for="(val, cat) in state.activeCategories.value" 
                  :key="cat"
                  class="p-2.5 border rounded-xl transition-all duration-700 flex flex-col gap-1.5"
                  :class="[
                    val ? 'hover:bg-white/[0.03]' : '',
                    categoriesFlash 
                      ? 'border-accent-500/20 bg-accent-500/[0.01] shadow-[0_0_20px_rgba(207,255,80,0.1)]' 
                      : 'bg-white/[0.01] border-white/5'
                  ]"
                >
                  <label class="flex items-center justify-between cursor-pointer select-none">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <Icon 
                        :name="cat === 'violence' ? 'ri:skull-line' : cat === 'sexual' ? 'ri:hearts-line' : 'ri:chat-voice-line'" 
                        class="text-xs flex-shrink-0"
                        :class="val ? 'text-accent-500' : 'text-slate-600'" 
                      />
                      <span class="text-xs font-bold uppercase tracking-wide text-slate-300 truncate">{{ cat }}</span>
                    </div>
                    <input 
                      type="checkbox" 
                      v-model="state.activeCategories.value[cat]"
                      class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                    />
                  </label>
                </div>
              </div>

              <!-- Expanded Category Word Lists -->
              <div class="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar pr-1 max-h-[350px]">
                <div 
                  v-for="(val, cat) in state.activeCategories.value" 
                  :key="cat"
                >
                  <div 
                    v-if="val && state.categorizedBlacklist?.value?.[cat]"
                    class="p-3 border rounded-xl flex flex-col gap-2 transition-all duration-700"
                    :class="[
                      categoriesFlash 
                        ? 'border-accent-500/20 bg-accent-500/[0.01] shadow-[0_0_20px_rgba(207,255,80,0.1)]' 
                        : 'bg-white/[0.01] border-white/5'
                    ]"
                  >
                    <!-- Category Header with Edit and Reset buttons -->
                    <div class="flex items-center justify-between">
                      <span class="text-xs text-accent-500 font-bold uppercase tracking-wider">{{ cat }} words ({{ getCategoryWords(cat).length }}):</span>
                      <div class="flex items-center gap-1.5">
                        <button 
                          v-if="editingCategory === cat"
                          @click="resetCategoryToDefault(cat)"
                          class="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs font-black uppercase tracking-wider flex items-center gap-0.5 transition-colors"
                        >
                          <Icon name="ri:restart-line" class="text-xs" />
                          Reset
                        </button>
                        <button 
                          @click="editingCategory = editingCategory === cat ? null : cat"
                          class="px-2 py-0.5 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-slate-400 border border-white/10 rounded text-xs font-black uppercase tracking-wider flex items-center gap-0.5 transition-colors"
                        >
                          <Icon :name="editingCategory === cat ? 'ri:check-line' : 'ri:edit-line'" class="text-xs" />
                          {{ editingCategory === cat ? 'Done' : 'Edit' }}
                        </button>
                      </div>
                    </div>

                    <!-- Add word inline input inside Category -->
                    <div v-if="editingCategory === cat" class="flex gap-1.5 mt-0.5">
                      <input 
                        v-model="newCategoryWord"
                        @keyup.enter="addCategoryWord(cat)"
                        type="text" 
                        placeholder="Add word..." 
                        class="flex-1 bg-white/[0.02] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-accent-500 transition-colors"
                      />
                      <button 
                        @click="addCategoryWord(cat)"
                        :disabled="!newCategoryWord.trim()"
                        class="px-2 py-1 bg-accent-500 hover:bg-accent-600 disabled:opacity-35 text-black font-black text-xs rounded transition-all flex-shrink-0"
                      >
                        Add
                      </button>
                    </div>

                    <!-- Word List Badges (with delete toggle in Edit Mode) -->
                    <div class="flex flex-wrap gap-1">
                      <span 
                        v-for="word in getCategoryWords(cat)" 
                        :key="word"
                        class="px-2 py-0.5 bg-white/[0.02] border border-white/5 rounded text-xs font-mono text-slate-400 hover:text-white transition-colors flex items-center gap-1 group/badge"
                      >
                        {{ word }}
                        <button 
                          v-if="editingCategory === cat"
                          @click="deleteCategoryWord(cat, word)"
                          class="text-slate-500 hover:text-rose-500 transition-colors flex items-center justify-center"
                        >
                          <Icon name="ri:close-line" class="text-xs" />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: Custom Blacklist -->
          <div v-if="activeTab === 'blacklist'" class="flex-1 flex flex-col space-y-3 min-h-0">
            <span class="text-xs text-slate-500 font-black uppercase tracking-widest block">Custom Blacklist Keywords</span>
            
            <!-- Add Word Box -->
            <div class="flex gap-2">
              <div class="relative flex-1 group">
                <input 
                  v-model="newWord" 
                  @keyup.enter="addWord"
                  type="text" 
                  placeholder="e.g. casino, badword" 
                  class="w-full bg-white/[0.02] border border-white/5 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
                />
                <Icon name="ri:add-circle-line" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <button 
                @click="addWord"
                :disabled="!newWord.trim()"
                class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500"
              >
                Add
              </button>
            </div>

            <!-- Search Word List -->
            <div class="relative group">
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Search custom words..."
                class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
              />
              <Icon name="ri:search-2-line" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs" />
            </div>

            <!-- Word List Scroller -->
            <div class="flex-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
              <TransitionGroup 
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-x-2"
                enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-x-0"
                leave-to-class="opacity-0 translate-x-2"
              >
                <div 
                  v-for="word in filteredWords" :key="word"
                  class="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-white/10 transition-all"
                >
                  <div class="flex items-center gap-2">
                     <div class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                     <span class="text-xs font-bold text-slate-200">{{ word }}</span>
                  </div>
                  <button 
                    @click="removeWord(word)"
                    class="w-6 h-6 rounded-md hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 transition-all flex items-center justify-center"
                  >
                    <Icon name="ri:delete-bin-line" class="text-xs" />
                  </button>
                </div>
              </TransitionGroup>

              <!-- Empty states -->
              <div v-if="filteredWords.length === 0" class="py-6 flex flex-col items-center justify-center text-center opacity-40">
                 <Icon name="ri:ghost-line" class="text-2xl mb-1 text-slate-500" />
                 <p class="text-xs font-bold uppercase tracking-widest text-slate-400">No custom words</p>
              </div>
            </div>

            <!-- Bottom Action Reset -->
            <div class="flex justify-between items-center pt-2 border-t border-white/5">
              <span class="text-xs text-slate-500">Total Custom: {{ state.customBlacklist.value.length }} words</span>
              <button 
                @click="resetList"
                class="text-xs text-slate-600 hover:text-rose-500 font-black uppercase tracking-widest transition-colors"
              >
                Clear Custom
              </button>
            </div>
          </div>

          <!-- Tab 3: Whitelist -->
          <div v-if="activeTab === 'whitelist'" class="flex-1 flex flex-col space-y-3 min-h-0">
            <!-- Add Word Box -->
            <div class="flex gap-2">
              <div class="relative flex-1 group">
                <input 
                  v-model="newWord" 
                  @keyup.enter="addWord"
                  type="text" 
                  placeholder="e.g. killing, blood" 
                  class="w-full bg-white/[0.02] border border-white/5 group-hover:border-accent-500/30 focus:border-accent-500 rounded-xl px-4 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
                />
                <Icon name="ri:add-circle-line" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
              <button 
                @click="addWord"
                :disabled="!newWord.trim()"
                class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-widest rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500"
              >
                Add
              </button>
            </div>

            <!-- Search Word List -->
            <div class="relative group">
              <input 
                v-model="searchQuery"
                type="text"
                placeholder="Search exceptions..."
                class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
              />
              <Icon name="ri:search-2-line" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs" />
            </div>

            <!-- Word List Scroller -->
            <div class="flex-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
              <TransitionGroup 
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-x-2"
                enter-to-class="opacity-100 translate-x-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="opacity-100 translate-x-0"
                leave-to-class="opacity-0 translate-x-2"
              >
                <div 
                  v-for="word in filteredWords" :key="word"
                  class="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-xl group hover:border-white/10 transition-all"
                >
                  <div class="flex items-center gap-2">
                     <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                     <span class="text-xs font-bold text-slate-200">{{ word }}</span>
                  </div>
                  <button 
                    @click="removeWord(word)"
                    class="w-6 h-6 rounded-md hover:bg-rose-500/10 text-slate-600 hover:text-rose-500 transition-all flex items-center justify-center"
                  >
                    <Icon name="ri:delete-bin-line" class="text-xs" />
                  </button>
                </div>
              </TransitionGroup>

              <!-- Empty states -->
              <div v-if="filteredWords.length === 0" class="py-12 flex flex-col items-center justify-center text-center opacity-40">
                 <Icon name="ri:ghost-line" class="text-3xl mb-2 text-slate-500" />
                 <p class="text-xs font-bold uppercase tracking-widest text-slate-400">List is empty</p>
              </div>
            </div>

            <!-- Bottom Action Reset -->
            <div class="flex justify-between items-center pt-2 border-t border-white/5">
              <span class="text-xs text-slate-500">Total Exceptions: {{ state.customWhitelist.value.length }} words</span>
              <button 
                @click="resetList"
                class="text-xs text-slate-600 hover:text-rose-500 font-black uppercase tracking-widest transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- Bottom Pro Tip Banner -->
    <div class="bg-accent-500/5 border border-accent-500/10 rounded-2xl p-4 flex gap-3.5 mt-2">
       <Icon name="ri:information-line" class="text-lg text-accent-500 flex-shrink-0 mt-0.5" />
       <p class="text-xs text-slate-400 leading-relaxed">
         <b>Safety Audit Pro-Tip:</b> Use the <b>Whitelist</b> tab to bypass warnings for words like "kill" or "blood" if they represent gameplay terms or brand names. All custom keywords are synchronized automatically with local storage.
       </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { DEFAULT_CATEGORIZED_BLACKLIST, SEVERE_WORDS } from '../composables/useSafetyAuditor'

const state = useClipperState()
const newWord = ref('')
const searchQuery = ref('')
const activeTab = ref('categories')

const editingCategory = ref(null)
const newCategoryWord = ref('')

const categoriesFlash = ref(false)

function triggerFlash() {
  categoriesFlash.value = true
  setTimeout(() => {
    categoriesFlash.value = false
  }, 800)
}

watch(activeTab, (newTab) => {
  if (newTab === 'categories') {
    triggerFlash()
  }
})

watch(() => state.safetySensitivity.value, () => {
  if (activeTab.value === 'categories') {
    triggerFlash()
  }
})

function getCategoryWords(cat) {
  const allWords = state.categorizedBlacklist.value[cat] || []
  if (state.safetySensitivity.value === 'standard') {
    const defaultSet = new Set(DEFAULT_CATEGORIZED_BLACKLIST[cat])
    return allWords.filter(word => {
      const clean = word.startsWith('/') && word.endsWith('/') ? word.slice(1, -1) : word
      const isSevere = SEVERE_WORDS.has(clean.toLowerCase().trim())
      const isUserAdded = !defaultSet.has(word)
      return isSevere || isUserAdded
    })
  }
  return allWords
}

function addCategoryWord(cat) {
  if (!newCategoryWord.value.trim()) return
  const word = newCategoryWord.value.trim().toLowerCase()
  if (!state.categorizedBlacklist.value[cat].includes(word)) {
    state.categorizedBlacklist.value[cat].push(word)
    state.saveBlacklistToStorage()
  }
  newCategoryWord.value = ''
}

function deleteCategoryWord(cat, word) {
  state.categorizedBlacklist.value[cat] = state.categorizedBlacklist.value[cat].filter(w => w !== word)
  state.saveBlacklistToStorage()
}

function resetCategoryToDefault(cat) {
  if (confirm(`Reset ${cat} category to default word list?`)) {
    state.categorizedBlacklist.value[cat] = [...DEFAULT_CATEGORIZED_BLACKLIST[cat]]
    state.saveBlacklistToStorage()
  }
}

defineEmits(['close'])

onMounted(() => {
  if (state && state.loadBlacklistFromStorage) {
    state.loadBlacklistFromStorage()
  }
  if (activeTab.value === 'categories') {
    triggerFlash()
  }
})

// Add word to current active list (blacklist or whitelist)
function addWord() {
  if (!newWord.value.trim()) return
  const word = newWord.value.trim().toLowerCase()
  
  if (activeTab.value === 'blacklist') {
    if (!state.customBlacklist.value.includes(word)) {
      state.customBlacklist.value.push(word)
      state.saveBlacklistToStorage()
    }
  } else {
    if (!state.customWhitelist.value.includes(word)) {
      state.customWhitelist.value.push(word)
      state.saveBlacklistToStorage()
    }
  }
  newWord.value = ''
}

// Remove word from active list
function removeWord(word) {
  if (activeTab.value === 'blacklist') {
    state.customBlacklist.value = state.customBlacklist.value.filter(w => w !== word)
  } else {
    state.customWhitelist.value = state.customWhitelist.value.filter(w => w !== word)
  }
  state.saveBlacklistToStorage()
}

// Filter words based on search query
const filteredWords = computed(() => {
  const list = activeTab.value === 'blacklist' 
    ? (state.customBlacklist.value || [])
    : (state.customWhitelist.value || [])
    
  if (!searchQuery.value.trim()) return list
  const q = searchQuery.value.trim().toLowerCase()
  return list.filter(w => w.toLowerCase().includes(q))
})

// Reset current active list
function resetList() {
  const target = activeTab.value === 'blacklist' ? 'blacklist' : 'whitelist exceptions'
  if (confirm(`Are you sure you want to clear all custom ${target}?`)) {
    if (activeTab.value === 'blacklist') {
      state.customBlacklist.value = []
    } else {
      state.customWhitelist.value = []
    }
    state.saveBlacklistToStorage()
  }
}

const isPlayingPreview = ref(false)
const previewingAudioId = ref(null)
const bleepUploadError = ref('')
const bleepFileInput = ref(null)
let previewAudio = null

function handleBleepUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  
  if (file.size > 1024 * 1024) {
    bleepUploadError.value = 'File size exceeds 1MB limit'
    return
  }
  
  bleepUploadError.value = ''
  const reader = new FileReader()
  reader.onload = (event) => {
    if (event.target?.result) {
      state.addCustomBleepFile({
        name: file.name,
        data: event.target.result
      })
    }
  }
  reader.onerror = () => {
    bleepUploadError.value = 'Failed to read file'
  }
  reader.readAsDataURL(file)
}

function toggleBleepPreview(item) {
  const targetItem = item || state.bleepLibrary.value.find(i => i.id === state.selectedBleepAudioId.value)
  if (!targetItem?.data) return

  if (isPlayingPreview.value && previewingAudioId.value === targetItem.id) {
    if (previewAudio) {
      previewAudio.pause()
      isPlayingPreview.value = false
      previewingAudioId.value = null
    }
  } else {
    if (previewAudio) {
      previewAudio.pause()
    }
    previewAudio = new Audio(targetItem.data)
    previewingAudioId.value = targetItem.id
    previewAudio.onended = () => {
      isPlayingPreview.value = false
      previewingAudioId.value = null
    }
    previewAudio.onerror = () => {
      bleepUploadError.value = 'Failed to play audio preview'
      isPlayingPreview.value = false
      previewingAudioId.value = null
    }
    previewAudio.play().catch(e => {
      console.warn('Audio preview play failed:', e)
      isPlayingPreview.value = false
      previewingAudioId.value = null
    })
    isPlayingPreview.value = true
  }
}

function removeBleepFile() {
  if (state.selectedBleepAudioId.value) {
    state.removeCustomBleepFile(state.selectedBleepAudioId.value)
  }
  if (previewAudio) {
    previewAudio.pause()
    isPlayingPreview.value = false
    previewingAudioId.value = null
  }
}

onUnmounted(() => {
  if (previewAudio) {
    previewAudio.pause()
    previewAudio = null
  }
})
</script>
