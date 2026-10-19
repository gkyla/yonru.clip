<template>
  <div class="flex-1 overflow-y-auto pr-1 space-y-4 custom-scrollbar min-h-0">
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
          • <b class="text-white">Standard:</b> Hanya menandai kata berat risiko
          shadowban kritis (e.g. suicide, murder, porn, kontol, f*ck). Slang
          ringan tetap diizinkan.
        </span>
        <span v-else class="text-slate-300">
          • <b class="text-white">Custom Only:</b> Mengabaikan kategori bawaan.
          Hanya memfilter kata-kata dari tab Blacklist Kustom Anda.
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

              <div class="flex items-center gap-1.5 flex-shrink-0" @click.stop>
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
            <Icon name="ri:error-warning-line" class="text-xs flex-shrink-0" />
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
                      Buffer milidetik tambahan jika rekaman video memiliki echo
                      atau pantulan suara.
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
                  state.bleepPaddingOffset.value = Number($event.target.value);
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
</template>

<script setup>
import { ref, onUnmounted } from 'vue';

const props = defineProps({
  state: {
    type: Object,
    default: () => useClipperState()
  }
});

const state = props.state;

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
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }
});
</script>
