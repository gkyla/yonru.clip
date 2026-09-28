<template>
  <div
    v-if="state"
    class="p-5 md:p-6 space-y-4 bg-[#0e0e12] border border-white/10 rounded-3xl text-white h-[600px] max-h-[88vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.8)] shadow-black/80 w-full max-w-2xl mx-auto"
  >
    <!-- Modal Header -->
    <div
      class="flex items-center justify-between border-b border-white/5 pb-4 flex-shrink-0"
    >
      <div>
        <h3
          class="text-base font-black text-white tracking-tight uppercase flex items-center gap-2"
        >
          <Icon name="ri:shield-keyhole-line" class="text-accent-500 text-lg" />
          Content Safety Configuration
        </h3>
        <p class="text-xs text-slate-500 font-medium mt-0.5">
          Configure detection scope, censoring styles, and word blacklists.
        </p>
      </div>
      <button
        aria-label="Close settings"
        class="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        @click="$emit('close')"
      >
        <Icon name="ri:close-line" class="text-base" />
      </button>
    </div>

    <!-- Top-Level Tab Navigation -->
    <div
      class="grid grid-cols-4 gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-2xl flex-shrink-0"
    >
      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'general'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'general'"
      >
        <Icon name="ri:sound-module-line" class="text-xs" />
        <span class="truncate">General</span>
      </button>

      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'categories'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'categories'"
      >
        <Icon name="ri:apps-2-line" class="text-xs" />
        <span class="truncate">Categories</span>
      </button>

      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'blacklist'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'blacklist'"
      >
        <Icon name="ri:forbid-2-line" class="text-xs" />
        <span class="truncate">Blacklist</span>
        <span
          v-if="state.customBlacklist?.value?.length"
          class="px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-rose-500/20 text-rose-300 font-bold ml-0.5"
        >
          {{ state.customBlacklist.value.length }}
        </span>
      </button>

      <button
        type="button"
        class="py-2 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
        :class="
          activeTab === 'whitelist'
            ? 'bg-white/10 text-white shadow-sm font-black'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
        "
        @click="activeTab = 'whitelist'"
      >
        <Icon name="ri:checkbox-circle-line" class="text-xs" />
        <span class="truncate">Whitelist</span>
        <span
          v-if="state.customWhitelist?.value?.length"
          class="px-1.5 py-0.2 text-[9px] font-mono rounded-full bg-emerald-500/20 text-emerald-300 font-bold ml-0.5"
        >
          {{ state.customWhitelist.value.length }}
        </span>
      </button>
    </div>

    <!-- Tab 1: General & Audio Engine Controls -->
    <div
      v-if="activeTab === 'general'"
      class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar min-h-0"
    >
      <!-- 1. Safety Filter Scope -->
      <div
        class="space-y-2 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl"
      >
        <div class="flex items-center justify-between">
          <label
            class="text-xs text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5"
          >
            <Icon name="ri:filter-3-line" class="text-accent-500 text-xs" />
            Safety Filter Scope
          </label>
          <span class="text-[10px] text-slate-500 font-mono"
            >Detection threshold</span
          >
        </div>

        <div
          class="grid grid-cols-3 gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-xl"
        >
          <button
            v-for="item in [
              { key: 'strict', label: 'Strict' },
              { key: 'standard', label: 'Standard' },
              { key: 'manual', label: 'Custom Only' }
            ]"
            :key="item.key"
            type="button"
            class="py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all"
            :class="
              state.safetySensitivity.value === item.key
                ? 'bg-accent-500 text-black shadow-sm font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.02]'
            "
            @click="
              state.safetySensitivity.value = item.key;
              state.saveBlacklistToStorage();
            "
          >
            {{ item.label }}
          </button>
        </div>

        <p
          class="text-xs text-slate-400 leading-relaxed font-medium bg-black/30 border border-white/5 rounded-xl p-2.5"
        >
          <span
            v-if="state.safetySensitivity.value === 'strict'"
            class="text-slate-300"
          >
            • <b class="text-white">Strict:</b> Menandai semua kata sensitif dan
            slang kasar dari seluruh kategori aktif (Kekerasan, Seksual, Kata
            Kasar) + Blacklist Kustom.
          </span>
          <span
            v-else-if="state.safetySensitivity.value === 'standard'"
            class="text-slate-300"
          >
            • <b class="text-white">Standard:</b> Hanya menandai kata berat
            risiko shadowban kritis (e.g. suicide, murder, porn, kontol, f*ck).
            Slang ringan tetap diizinkan.
          </span>
          <span v-else class="text-slate-300">
            • <b class="text-white">Custom Only:</b> Mengabaikan kategori
            bawaan. Hanya memfilter kata-kata dari tab Blacklist Kustom Anda.
          </span>
        </p>
      </div>

      <!-- 2. Auto-Fix Masking Style -->
      <div
        class="space-y-2 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl"
      >
        <label
          class="text-xs text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5"
        >
          <Icon name="ri:font-color" class="text-accent-500 text-xs" />
          Auto-Fix Masking Style
        </label>
        <div class="relative group">
          <select
            v-model="state.maskingStyle.value"
            class="w-full bg-black/40 border border-white/10 focus:border-accent-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-200 outline-none transition-all appearance-none cursor-pointer pr-10"
            @change="state.saveBlacklistToStorage()"
          >
            <option value="asterisk">Asterisks (e.g. k*lling)</option>
            <option value="block">Full Block (e.g. *******)</option>
            <option value="bleep_marker">Bleep Tag (e.g. [BLEEP])</option>
          </select>
          <Icon
            name="ri:arrow-down-s-line"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-base"
          />
        </div>
      </div>

      <!-- 3. Audio Censorship & Sound Picker -->
      <div
        class="space-y-3 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl"
      >
        <label
          class="flex items-center justify-between cursor-pointer select-none"
        >
          <div class="flex flex-col">
            <span
              class="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5"
            >
              <Icon
                :name="
                  state.audioBleepEnabled.value
                    ? 'ri:volume-up-line'
                    : 'ri:volume-mute-line'
                "
                class="text-sm text-accent-500"
              />
              Mute/Bleep Audio
            </span>
            <span class="text-xs text-slate-500 mt-0.5"
              >Censor audio during final video render</span
            >
          </div>
          <input
            v-model="state.audioBleepEnabled.value"
            type="checkbox"
            class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-4 h-4 cursor-pointer"
            @change="state.saveBlacklistToStorage()"
          />
        </label>

        <!-- Nested Audio Controls when enabled -->
        <div
          v-if="state.audioBleepEnabled.value"
          class="space-y-3 pt-2 border-t border-white/5"
        >
          <!-- Bleep Sound Type -->
          <div class="space-y-1.5">
            <div class="flex items-center gap-1.5">
              <label
                class="text-[10px] text-slate-400 font-black uppercase tracking-wider block"
              >
                Bleep Sound Type
              </label>
              <div class="relative group/tooltip flex items-center">
                <Icon
                  name="ri:question-line"
                  class="text-slate-500 hover:text-slate-300 text-xs cursor-help transition-colors"
                />
                <div
                  class="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-surface-dark/95 border border-surface-border/80 rounded-xl shadow-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-[10px] text-slate-300 leading-normal opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 tracking-normal normal-case space-y-1.5"
                >
                  <p>
                    <strong class="text-white font-bold"
                      >Mute Audio (Default):</strong
                    >
                    Senyap tanpa suara efek ketika kata sensitif diucapkan.
                  </p>
                  <p>
                    <strong class="text-accent-400 font-bold"
                      >Custom Sound File:</strong
                    >
                    Memainkan nada bleep standar atau audio yang Anda upload.
                  </p>
                </div>
              </div>
            </div>

            <div
              class="grid grid-cols-2 gap-1 p-1 bg-black/40 border border-white/5 rounded-xl"
            >
              <button
                type="button"
                class="py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all"
                :class="
                  state.audioBleepSource.value === 'mute'
                    ? 'bg-white/10 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-white font-bold'
                "
                @click="
                  state.audioBleepSource.value = 'mute';
                  state.saveBlacklistToStorage();
                "
              >
                Mute Audio (Default)
              </button>
              <button
                type="button"
                class="py-2 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all"
                :class="
                  state.audioBleepSource.value === 'custom'
                    ? 'bg-white/10 text-white shadow-sm font-black'
                    : 'text-slate-400 hover:text-white font-bold'
                "
                @click="
                  state.audioBleepSource.value = 'custom';
                  state.saveBlacklistToStorage();
                "
              >
                Custom Sound File
              </button>
            </div>
          </div>

          <!-- Custom File Section / Bleep Sound Library -->
          <div
            v-if="state.audioBleepSource.value === 'custom'"
            class="space-y-2 pt-1"
          >
            <input
              ref="bleepFileInput"
              type="file"
              class="hidden"
              accept="audio/*"
              @change="handleBleepUpload"
            />

            <!-- Library Items List -->
            <div
              class="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar"
            >
              <div
                v-for="item in state.bleepLibrary.value"
                :key="item.id"
                class="p-2 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all duration-200"
                :class="
                  state.selectedBleepAudioId.value === item.id
                    ? 'bg-accent-500/10 border-accent-500/50 shadow-sm'
                    : 'bg-black/30 border-white/5 hover:border-white/20 hover:bg-white/[0.04]'
                "
                @click="state.selectBleepAudio(item.id)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Icon
                    :name="
                      item.isPreset ? 'ri:volume-up-line' : 'ri:music-2-line'
                    "
                    class="text-sm flex-shrink-0"
                    :class="
                      state.selectedBleepAudioId.value === item.id
                        ? 'text-accent-400'
                        : 'text-slate-400'
                    "
                  />
                  <div class="flex flex-col min-w-0">
                    <span
                      class="text-xs font-bold truncate"
                      :class="
                        state.selectedBleepAudioId.value === item.id
                          ? 'text-white'
                          : 'text-slate-300'
                      "
                    >
                      {{ item.name }}
                    </span>
                    <span
                      class="text-[9px] font-mono font-medium"
                      :class="
                        item.isPreset ? 'text-accent-400/80' : 'text-slate-500'
                      "
                    >
                      {{ item.isPreset ? 'Default Preset' : 'Custom Upload' }}
                    </span>
                  </div>
                </div>

                <div
                  class="flex items-center gap-1.5 flex-shrink-0"
                  @click.stop
                >
                  <!-- Play/Preview button -->
                  <button
                    type="button"
                    class="p-1.5 bg-white/[0.04] hover:bg-white/[0.1] hover:text-white text-slate-300 rounded-lg transition-colors"
                    :title="
                      isPlayingPreview && previewingAudioId === item.id
                        ? 'Pause Preview'
                        : 'Play Preview'
                    "
                    @click="toggleBleepPreview(item)"
                  >
                    <Icon
                      :name="
                        isPlayingPreview && previewingAudioId === item.id
                          ? 'ri:pause-line'
                          : 'ri:play-line'
                      "
                      class="text-xs"
                    />
                  </button>

                  <!-- Delete button for custom upload items -->
                  <button
                    v-if="!item.isPreset"
                    type="button"
                    class="p-1.5 bg-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded-lg transition-colors"
                    title="Delete File"
                    @click="state.removeCustomBleepFile(item.id)"
                  >
                    <Icon name="ri:delete-bin-line" class="text-xs" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Upload Custom Sound Button -->
            <div
              class="border border-dashed border-white/10 hover:border-accent-500/50 hover:bg-white/[0.02] rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 group/upload"
              @click="bleepFileInput?.click()"
            >
              <Icon
                name="ri:upload-cloud-2-line"
                class="text-sm text-slate-500 group-hover/upload:text-accent-500 transition-colors"
              />
              <span class="text-xs font-bold text-slate-300"
                >Upload Custom Sound</span
              >
              <span class="text-[9px] text-slate-500 font-mono"
                >(.mp3, .wav, max 1MB)</span
              >
            </div>

            <div
              v-if="bleepUploadError"
              class="text-[10px] text-rose-400 font-medium flex items-center gap-1"
            >
              <Icon
                name="ri:error-warning-line"
                class="text-xs flex-shrink-0"
              />
              <span>{{ bleepUploadError }}</span>
            </div>
          </div>

          <!-- Collapsible Timing Offset -->
          <details
            class="group/timing text-[10px] rounded-xl border border-white/5 bg-black/20 p-2.5 transition-all"
          >
            <summary
              class="flex items-center justify-between cursor-pointer list-none select-none text-slate-400 hover:text-white transition-colors"
            >
              <span class="font-bold flex items-center gap-1.5">
                <Icon
                  name="ri:sound-module-line"
                  class="text-xs text-accent-400"
                />
                Timing Offset (Opsional)
              </span>
              <Icon
                name="ri:arrow-down-s-line"
                class="text-xs transition-transform duration-200 group-open/timing:rotate-180"
              />
            </summary>

            <div class="space-y-1.5 pt-2.5 mt-2 border-t border-white/5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <label
                    class="text-[9px] text-slate-400 font-bold uppercase tracking-wider block"
                    >Padding Buffer</label
                  >
                  <div class="relative group/tooltip flex items-center">
                    <Icon
                      name="ri:question-line"
                      class="text-slate-500 hover:text-slate-300 text-xs cursor-help transition-colors"
                    />
                    <div
                      class="absolute left-0 bottom-full mb-1.5 w-64 p-2.5 bg-surface-dark/95 border border-surface-border/80 rounded-xl shadow-black/80 shadow-[0_12px_40px_rgba(0,0,0,0.95)] text-[10px] text-slate-300 leading-normal opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity duration-200 z-50 tracking-normal normal-case space-y-1.5"
                    >
                      <p>
                        <strong class="text-white font-bold"
                          >Padding Buffer:</strong
                        >
                        Buffer milidetik tambahan jika rekaman video memiliki
                        echo atau pantulan suara.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button
                    v-if="(state.bleepPaddingOffset?.value ?? 0) !== 0"
                    type="button"
                    class="text-[9px] text-accent-400 hover:text-accent-300 hover:underline transition-colors font-medium"
                    @click="
                      if (state.bleepPaddingOffset)
                        state.bleepPaddingOffset.value = 0;
                      state.saveBlacklistToStorage();
                    "
                  >
                    Reset (0ms)
                  </button>
                  <span class="text-[10px] font-mono font-bold text-accent-400"
                    >{{ state.bleepPaddingOffset?.value ?? 0 }}ms</span
                  >
                </div>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  :value="state.bleepPaddingOffset?.value ?? 0"
                  class="w-full accent-accent-500 cursor-pointer h-1.5 bg-white/10 rounded-lg"
                  @input="
                    state.bleepPaddingOffset.value = Number(
                      $event.target.value
                    );
                    state.saveBlacklistToStorage();
                  "
                />
                <input
                  type="number"
                  min="0"
                  max="500"
                  :value="state.bleepPaddingOffset?.value ?? 0"
                  class="w-14 px-1.5 py-0.5 bg-white/[0.03] border border-white/10 rounded text-[10px] font-mono text-center text-white focus:outline-none focus:border-accent-500"
                  @input="
                    state.bleepPaddingOffset.value = Math.max(
                      0,
                      Number($event.target.value)
                    );
                    state.saveBlacklistToStorage();
                  "
                />
              </div>
              <p class="text-[8px] text-slate-500 leading-tight">
                Default 0ms. Hanya disesuaikan jika video memiliki gema atau
                pantulan suara.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- Tab 2: Word Categories -->
    <div
      v-if="activeTab === 'categories'"
      class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar min-h-0"
    >
      <!-- Warning if Custom Only mode is active -->
      <div
        v-if="state.safetySensitivity.value === 'manual'"
        class="flex flex-col items-center justify-center text-center p-5 border border-dashed border-accent-500/20 rounded-2xl bg-accent-500/[0.02]"
      >
        <Icon
          name="ri:information-line"
          class="text-2xl text-accent-400 mb-1.5"
        />
        <h4 class="text-xs font-black text-slate-200 uppercase tracking-wider">
          Kategori Bawaan Sedang Dinonaktifkan
        </h4>
        <p class="text-xs text-slate-400 mt-1 max-w-[340px] leading-relaxed">
          Filter Scope saat ini disetel ke <b>Custom Only</b>. Hanya kata-kata
          di tab Blacklist Kustom yang difilter.
        </p>
        <button
          class="mt-3 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all"
          @click="
            state.safetySensitivity.value = 'standard';
            state.saveBlacklistToStorage();
          "
        >
          Aktifkan Kategori (Beralih ke Standard)
        </button>
      </div>

      <!-- Category Toggles & Words -->
      <div v-else class="space-y-4">
        <!-- 3 Category Checkboxes -->
        <div>
          <span
            class="text-xs text-slate-400 font-black uppercase tracking-widest block mb-2"
            >Kategori Aktif</span
          >
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="(val, cat) in state.activeCategories.value"
              :key="cat"
              class="p-2.5 border rounded-xl transition-all duration-300 flex items-center justify-between cursor-pointer"
              :class="
                val
                  ? 'bg-white/[0.03] border-accent-500/30'
                  : 'bg-white/[0.01] border-white/5 opacity-60'
              "
              @click="
                state.activeCategories.value[cat] =
                  !state.activeCategories.value[cat];
                state.saveBlacklistToStorage();
              "
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <Icon
                  :name="
                    cat === 'violence'
                      ? 'ri:skull-line'
                      : cat === 'sexual'
                        ? 'ri:hearts-line'
                        : 'ri:chat-voice-line'
                  "
                  class="text-xs flex-shrink-0"
                  :class="val ? 'text-accent-500' : 'text-slate-500'"
                />
                <span
                  class="text-xs font-bold uppercase tracking-wide text-slate-200 truncate"
                  >{{ cat }}</span
                >
              </div>
              <input
                type="checkbox"
                :checked="val"
                class="rounded border-white/10 bg-surface-dark text-accent-500 focus:ring-accent-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0"
                @click.stop
                @change="
                  state.activeCategories.value[cat] = $event.target.checked;
                  state.saveBlacklistToStorage();
                "
              />
            </div>
          </div>
        </div>

        <!-- Expanded Category Words -->
        <div class="space-y-3">
          <div v-for="(val, cat) in state.activeCategories.value" :key="cat">
            <div
              v-if="val && state.categorizedBlacklist?.value?.[cat]"
              class="p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-2.5"
            >
              <!-- Category Header -->
              <div class="flex items-center justify-between">
                <span
                  class="text-xs text-accent-400 font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  <span class="capitalize">{{ cat }}</span>
                  <span class="text-[10px] text-slate-500 font-mono font-normal"
                    >({{ getCategoryWords(cat).length }} kata)</span
                  >
                </span>
                <div class="flex items-center gap-1.5">
                  <button
                    v-if="editingCategory === cat"
                    class="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                    @click="resetCategoryToDefault(cat)"
                  >
                    <Icon name="ri:restart-line" class="text-xs" />
                    Reset
                  </button>
                  <button
                    class="px-2.5 py-0.5 bg-white/[0.03] hover:bg-white/[0.08] hover:text-white text-slate-300 border border-white/10 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors"
                    @click="
                      editingCategory = editingCategory === cat ? null : cat
                    "
                  >
                    <Icon
                      :name="
                        editingCategory === cat
                          ? 'ri:check-line'
                          : 'ri:edit-line'
                      "
                      class="text-xs"
                    />
                    {{ editingCategory === cat ? 'Done' : 'Edit' }}
                  </button>
                </div>
              </div>

              <!-- Inline Add Input in Edit Mode -->
              <div v-if="editingCategory === cat" class="flex gap-1.5">
                <input
                  v-model="newCategoryWord"
                  type="text"
                  placeholder="Tambahkan kata (pisahkan koma jika banyak)..."
                  class="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-accent-500 transition-colors font-medium"
                  @keyup.enter="addCategoryWord(cat)"
                />
                <button
                  :disabled="!newCategoryWord.trim()"
                  class="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-30 text-black font-black text-xs rounded-xl transition-all flex-shrink-0"
                  @click="addCategoryWord(cat)"
                >
                  Add
                </button>
              </div>

              <!-- Compact Chips Container -->
              <div
                class="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar"
              >
                <span
                  v-for="word in getCategoryWords(cat)"
                  :key="word"
                  class="px-2 py-0.5 bg-black/40 border border-white/5 rounded-lg text-xs font-mono text-slate-300 hover:text-white transition-colors flex items-center gap-1 group/badge"
                >
                  {{ word }}
                  <button
                    v-if="editingCategory === cat"
                    class="text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center ml-0.5"
                    title="Hapus kata"
                    @click="deleteCategoryWord(cat, word)"
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

    <!-- Tab 3: Custom Blacklist -->
    <div
      v-if="activeTab === 'blacklist'"
      class="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0 flex flex-col"
    >
      <!-- Add Word Input Bar (With Comma Multi-Word Support) -->
      <div class="flex gap-2 flex-shrink-0">
        <div class="relative flex-1 group">
          <input
            v-model="newWord"
            type="text"
            placeholder="Tambah kata kustom (e.g. judi, slot, gacor)..."
            class="w-full bg-black/40 border border-white/10 group-hover:border-white/20 focus:border-accent-500 rounded-xl px-3.5 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
            @keyup.enter="addWord"
          />
          <Icon
            name="ri:add-circle-line"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </div>
        <button
          :disabled="!newWord.trim()"
          class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-wider rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500 flex-shrink-0"
          @click="addWord"
        >
          Add
        </button>
      </div>

      <!-- Search Word Input -->
      <div class="relative group flex-shrink-0">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari kata di daftar kustom..."
          class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
        />
        <Icon
          name="ri:search-2-line"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs"
        />
      </div>

      <!-- High-Density Tag Grid Scroller -->
      <div
        class="flex-1 min-h-[160px] p-3 bg-black/30 border border-white/5 rounded-2xl overflow-y-auto custom-scrollbar"
      >
        <div
          v-if="filteredWords.length > 0"
          class="flex flex-wrap gap-1.5 content-start"
        >
          <span
            v-for="word in filteredWords"
            :key="word"
            class="px-2.5 py-1 bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1.5 group/chip transition-all"
          >
            <span
              class="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"
            ></span>
            <span>{{ word }}</span>
            <button
              class="text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center ml-0.5"
              title="Hapus kata"
              @click="removeWord(word)"
            >
              <Icon name="ri:close-line" class="text-xs" />
            </button>
          </span>
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="h-full min-h-[160px] flex flex-col items-center justify-center text-center opacity-40"
        >
          <Icon name="ri:forbid-2-line" class="text-2xl mb-1 text-slate-500" />
          <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
            Tidak ada kata kustom
          </p>
          <span class="text-[10px] text-slate-500 mt-0.5"
            >Ketik di atas (pisahkan koma untuk memasukkan banyak kata
            sekaligus).</span
          >
        </div>
      </div>

      <!-- Footer Action -->
      <div
        class="flex justify-between items-center pt-2 border-t border-white/5 flex-shrink-0"
      >
        <span class="text-xs text-slate-500"
          >Total Kustom: {{ state.customBlacklist.value.length }} kata</span
        >
        <button
          class="text-xs text-slate-500 hover:text-rose-400 font-bold tracking-wider transition-colors"
          @click="resetList"
        >
          Bersihkan Semua
        </button>
      </div>
    </div>

    <!-- Tab 4: Whitelist -->
    <div
      v-if="activeTab === 'whitelist'"
      class="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar min-h-0 flex flex-col"
    >
      <!-- Add Whitelist Input Bar (With Comma Multi-Word Support) -->
      <div class="flex gap-2 flex-shrink-0">
        <div class="relative flex-1 group">
          <input
            v-model="newWord"
            type="text"
            placeholder="Tambah pengecualian (e.g. killing, blood)..."
            class="w-full bg-black/40 border border-white/10 group-hover:border-white/20 focus:border-accent-500 rounded-xl px-3.5 py-2 text-xs text-white font-bold outline-none transition-all pr-10"
            @keyup.enter="addWord"
          />
          <Icon
            name="ri:add-circle-line"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
        </div>
        <button
          :disabled="!newWord.trim()"
          class="px-4 bg-accent-500 hover:bg-accent-600 text-black font-black text-xs tracking-wider rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-accent-500 flex-shrink-0"
          @click="addWord"
        >
          Add
        </button>
      </div>

      <!-- Search Whitelist Input -->
      <div class="relative group flex-shrink-0">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari pengecualian whitelist..."
          class="w-full bg-white/[0.01] border border-white/5 group-hover:border-white/10 focus:border-white/20 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none transition-all pl-8"
        />
        <Icon
          name="ri:search-2-line"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-xs"
        />
      </div>

      <!-- High-Density Tag Grid Scroller -->
      <div
        class="flex-1 min-h-[160px] p-3 bg-black/30 border border-white/5 rounded-2xl overflow-y-auto custom-scrollbar"
      >
        <div
          v-if="filteredWords.length > 0"
          class="flex flex-wrap gap-1.5 content-start"
        >
          <span
            v-for="word in filteredWords"
            :key="word"
            class="px-2.5 py-1 bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-lg text-xs font-mono text-slate-200 flex items-center gap-1.5 group/chip transition-all"
          >
            <span
              class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
            ></span>
            <span>{{ word }}</span>
            <button
              class="text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center ml-0.5"
              title="Hapus pengecualian"
              @click="removeWord(word)"
            >
              <Icon name="ri:close-line" class="text-xs" />
            </button>
          </span>
        </div>

        <!-- Empty State -->
        <div
          v-else
          class="h-full min-h-[160px] flex flex-col items-center justify-center text-center opacity-40"
        >
          <Icon
            name="ri:checkbox-circle-line"
            class="text-2xl mb-1 text-slate-500"
          />
          <p class="text-xs font-bold uppercase tracking-widest text-slate-400">
            Daftar Whitelist Kosong
          </p>
          <span class="text-[10px] text-slate-500 mt-0.5"
            >Kata di whitelist tidak akan difilter atau dibleep pada
            audio.</span
          >
        </div>
      </div>

      <!-- Footer Action -->
      <div
        class="flex justify-between items-center pt-2 border-t border-white/5 flex-shrink-0"
      >
        <span class="text-xs text-slate-500"
          >Total Pengecualian:
          {{ state.customWhitelist.value.length }} kata</span
        >
        <button
          class="text-xs text-slate-500 hover:text-rose-400 font-bold tracking-wider transition-colors"
          @click="resetList"
        >
          Bersihkan Semua
        </button>
      </div>
    </div>

    <!-- Subtle Modal Footer -->
    <div
      class="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0"
    >
      <span class="flex items-center gap-1">
        <Icon name="ri:information-line" class="text-accent-500/80 text-xs" />
        Semua perubahan kata disinkronkan otomatis ke penyimpanan lokal.
      </span>
      <span class="text-[10px] font-mono text-slate-600 hidden sm:inline"
        >ESC untuk menutup</span
      >
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  DEFAULT_CATEGORIZED_BLACKLIST,
  SEVERE_WORDS
} from '../utils/safetyEngine';

const state = useClipperState();
const newWord = ref('');
const searchQuery = ref('');
const activeTab = ref('general');

const editingCategory = ref(null);
const newCategoryWord = ref('');

function getCategoryWords(cat) {
  const allWords = state.categorizedBlacklist.value[cat] || [];
  if (state.safetySensitivity.value === 'standard') {
    const defaultSet = new Set(DEFAULT_CATEGORIZED_BLACKLIST[cat]);
    return allWords.filter(word => {
      const clean =
        word.startsWith('/') && word.endsWith('/') ? word.slice(1, -1) : word;
      const isSevere = SEVERE_WORDS.has(clean.toLowerCase().trim());
      const isUserAdded = !defaultSet.has(word);
      return isSevere || isUserAdded;
    });
  }
  return allWords;
}

function addCategoryWord(cat) {
  if (!newCategoryWord.value.trim()) return;
  const tokens = newCategoryWord.value
    .split(/[,;\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return;

  let added = false;
  for (const token of tokens) {
    if (!state.categorizedBlacklist.value[cat].includes(token)) {
      state.categorizedBlacklist.value[cat].push(token);
      added = true;
    }
  }
  if (added) state.saveBlacklistToStorage();
  newCategoryWord.value = '';
}

function deleteCategoryWord(cat, word) {
  state.categorizedBlacklist.value[cat] = state.categorizedBlacklist.value[
    cat
  ].filter(w => w !== word);
  state.saveBlacklistToStorage();
}

function resetCategoryToDefault(cat) {
  if (confirm(`Reset ${cat} category to default word list?`)) {
    state.categorizedBlacklist.value[cat] = [
      ...DEFAULT_CATEGORIZED_BLACKLIST[cat]
    ];
    state.saveBlacklistToStorage();
  }
}

const emit = defineEmits(['close']);

// Keyboard Escape listener
function handleKeyDown(e) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  if (state && state.loadBlacklistFromStorage) {
    state.loadBlacklistFromStorage();
  }
  window.addEventListener('keydown', handleKeyDown);
});

// Add word to current active list (blacklist or whitelist) with comma-separated multi-word support
function addWord() {
  if (!newWord.value.trim()) return;
  const tokens = newWord.value
    .split(/[,;\n]+/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return;

  if (activeTab.value === 'blacklist') {
    let added = false;
    for (const token of tokens) {
      if (!state.customBlacklist.value.includes(token)) {
        state.customBlacklist.value.push(token);
        added = true;
      }
    }
    if (added) state.saveBlacklistToStorage();
  } else if (activeTab.value === 'whitelist') {
    let added = false;
    for (const token of tokens) {
      if (!state.customWhitelist.value.includes(token)) {
        state.customWhitelist.value.push(token);
        added = true;
      }
    }
    if (added) state.saveBlacklistToStorage();
  }
  newWord.value = '';
}

// Remove word from active list
function removeWord(word) {
  if (activeTab.value === 'blacklist') {
    state.customBlacklist.value = state.customBlacklist.value.filter(
      w => w !== word
    );
  } else {
    state.customWhitelist.value = state.customWhitelist.value.filter(
      w => w !== word
    );
  }
  state.saveBlacklistToStorage();
}

// Filter words based on search query
const filteredWords = computed(() => {
  const list =
    activeTab.value === 'blacklist'
      ? state.customBlacklist.value || []
      : state.customWhitelist.value || [];

  if (!searchQuery.value.trim()) return list;
  const q = searchQuery.value.trim().toLowerCase();
  return list.filter(w => w.toLowerCase().includes(q));
});

// Reset current active list
function resetList() {
  const target =
    activeTab.value === 'blacklist' ? 'blacklist' : 'whitelist exceptions';
  if (confirm(`Are you sure you want to clear all custom ${target}?`)) {
    if (activeTab.value === 'blacklist') {
      state.customBlacklist.value = [];
    } else {
      state.customWhitelist.value = [];
    }
    state.saveBlacklistToStorage();
  }
}

const isPlayingPreview = ref(false);
const previewingAudioId = ref(null);
const bleepUploadError = ref('');
const bleepFileInput = ref(null);
let previewAudio = null;

function handleBleepUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 1024 * 1024) {
    bleepUploadError.value = 'File size exceeds 1MB limit';
    return;
  }

  bleepUploadError.value = '';
  const reader = new FileReader();
  reader.onload = event => {
    if (event.target?.result) {
      state.addCustomBleepFile({
        name: file.name,
        data: event.target.result
      });
    }
  };
  reader.onerror = () => {
    bleepUploadError.value = 'Failed to read file';
  };
  reader.readAsDataURL(file);
}

function toggleBleepPreview(item) {
  const targetItem =
    item ||
    state.bleepLibrary.value.find(
      i => i.id === state.selectedBleepAudioId.value
    );
  if (!targetItem?.data) return;

  if (isPlayingPreview.value && previewingAudioId.value === targetItem.id) {
    if (previewAudio) {
      previewAudio.pause();
      isPlayingPreview.value = false;
      previewingAudioId.value = null;
    }
  } else {
    if (previewAudio) {
      previewAudio.pause();
    }
    previewAudio = new Audio(targetItem.data);
    previewingAudioId.value = targetItem.id;
    previewAudio.onended = () => {
      isPlayingPreview.value = false;
      previewingAudioId.value = null;
    };
    previewAudio.onerror = () => {
      bleepUploadError.value = 'Failed to play audio preview';
      isPlayingPreview.value = false;
      previewingAudioId.value = null;
    };
    previewAudio.play().catch(e => {
      console.warn('Audio preview play failed:', e);
      isPlayingPreview.value = false;
      previewingAudioId.value = null;
    });
    isPlayingPreview.value = true;
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }
});
</script>
