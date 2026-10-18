<template>
  <div id="settings-env" key="env" class="scroll-mt-24 flex flex-col gap-6">
    <div>
      <h3 class="text-lg font-bold text-white mb-2 flex items-center gap-2">
        <Icon name="ri:terminal-window-fill" class="text-accent-500" />
        Environment Paths
      </h3>
      <p class="text-sm text-slate-400">
        If your prerequisite tools are installed in custom locations, provide
        their absolute paths. Otherwise, leave them blank to use system
        defaults.
      </p>
    </div>

    <div class="flex flex-col gap-5">
      <!-- FFmpeg Card -->
      <div
        class="p-4 rounded-xl border border-surface-border bg-surface-dark/30 flex flex-col gap-3.5 transition-all"
        data-testid="ffmpeg-env-card"
      >
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-center text-accent-400"
            >
              <Icon name="ri:movie-2-line" class="text-sm text-accent-500" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">FFmpeg Binary</h4>
              <p class="text-[11px] text-slate-400">
                Required for video slicing, thumbnail extraction, and 9:16
                rendering.
              </p>
            </div>
          </div>
          <!-- Status Badge -->
          <div class="flex items-center gap-2">
            <span
              class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
              :class="ffmpegStatusBadge.class"
            >
              <span
                class="w-1 h-1 rounded-full"
                :class="ffmpegStatusBadge.dotClass"
              ></span>
              {{ ffmpegStatusBadge.label }}
            </span>
          </div>
        </div>

        <!-- Active Binary Display -->
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0c0e14] border border-surface-border/60 text-xs"
        >
          <span
            class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider shrink-0"
            >Active Path:</span
          >
          <span
            class="font-mono text-[11px] text-slate-200 truncate"
            :title="healthData?.ffmpeg?.path || 'Not detected'"
          >
            {{ healthData?.ffmpeg?.path || 'Not detected in system PATH' }}
          </span>
        </div>

        <!-- Input & Test Button -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label
              class="text-xs font-bold text-slate-400 uppercase tracking-widest pl-0.5 flex items-center gap-1.5"
            >
              <span>Custom Path Override</span>
              <span
                class="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-surface-dark border border-surface-border text-slate-400"
                >optional</span
              >
            </label>
            <button
              v-if="ffmpegPath"
              type="button"
              class="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
              @click="emit('resetEnvPath', 'ffmpeg')"
            >
              <Icon name="ri:close-circle-line" class="text-xs" /> Clear
              Override
            </button>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="ffmpegPath"
              type="text"
              placeholder="e.g. C:\ffmpeg\bin or /opt/homebrew/bin/ffmpeg"
              class="w-full bg-[#111318] border border-surface-border text-white px-3.5 py-2 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-xs"
              @input="ffmpegValidation.tested = false"
            />
            <button
              :disabled="ffmpegValidation.testing"
              type="button"
              class="px-4 py-2 bg-surface-card border border-surface-border text-slate-200 hover:text-white hover:border-accent-500/40 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              @click="emit('testBinaryPath', 'ffmpeg')"
            >
              <Icon
                v-if="ffmpegValidation.testing"
                name="ri:loader-4-line"
                class="text-xs animate-spin text-accent-500"
              />
              <Icon
                v-else
                name="ri:search-eye-line"
                class="text-xs text-accent-500"
              />
              <span>Test Path</span>
            </button>
          </div>

          <!-- Inline Validation Result Feedback -->
          <div v-if="ffmpegValidation.tested" class="mt-1">
            <div
              v-if="ffmpegValidation.valid"
              class="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
            >
              <Icon
                name="ri:checkbox-circle-fill"
                class="text-emerald-400 text-sm shrink-0"
              />
              <div class="flex flex-col gap-0.5 truncate">
                <span class="font-semibold">{{
                  ffmpegValidation.message
                }}</span>
                <span
                  v-if="ffmpegValidation.detectedPath"
                  class="font-mono text-[10px] text-emerald-400 truncate"
                  >{{ ffmpegValidation.detectedPath }}</span
                >
              </div>
            </div>
            <div
              v-else
              class="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs"
            >
              <Icon
                name="ri:error-warning-fill"
                class="text-rose-400 text-sm shrink-0"
              />
              <span class="font-medium">{{ ffmpegValidation.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Node.js Card -->
      <div
        class="p-4 rounded-xl border border-surface-border bg-surface-dark/30 flex flex-col gap-3.5 transition-all"
        data-testid="node-env-card"
      >
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-lg bg-surface-dark border border-surface-border flex items-center justify-center text-accent-400"
            >
              <Icon name="ri:nodejs-line" class="text-sm text-accent-500" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">Node.js Runtime</h4>
              <p class="text-[11px] text-slate-400">
                Optional runtime for extractor JavaScript helpers & extensions.
              </p>
            </div>
          </div>
          <!-- Status Badge -->
          <div class="flex items-center gap-2">
            <span
              class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
              :class="nodeStatusBadge.class"
            >
              <span
                class="w-1 h-1 rounded-full"
                :class="nodeStatusBadge.dotClass"
              ></span>
              {{ nodeStatusBadge.label }}
            </span>
          </div>
        </div>

        <!-- Active Binary Display -->
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0c0e14] border border-surface-border/60 text-xs"
        >
          <span
            class="text-slate-400 text-[11px] font-semibold uppercase tracking-wider shrink-0"
            >Active Path:</span
          >
          <span
            class="font-mono text-[11px] text-slate-200 truncate"
            :title="healthData?.node?.path || 'Not detected'"
          >
            {{ healthData?.node?.path || 'Not detected in system PATH' }}
          </span>
        </div>

        <!-- Input & Test Button -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between">
            <label
              class="text-xs font-bold text-slate-400 uppercase tracking-widest pl-0.5 flex items-center gap-1.5"
            >
              <span>Custom Path Override</span>
              <span
                class="text-[10px] lowercase font-normal px-1.5 py-0.2 rounded bg-surface-dark border border-surface-border text-slate-400"
                >optional</span
              >
            </label>
            <button
              v-if="nodePath"
              type="button"
              class="text-[11px] text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
              @click="emit('resetEnvPath', 'node')"
            >
              <Icon name="ri:close-circle-line" class="text-xs" /> Clear
              Override
            </button>
          </div>

          <div class="flex items-center gap-2">
            <input
              v-model="nodePath"
              type="text"
              placeholder="e.g. C:\Program Files\nodejs or /usr/local/bin/node"
              class="w-full bg-[#111318] border border-surface-border text-white px-3.5 py-2 rounded-lg focus:outline-none focus:border-accent-500/50 transition-all font-mono text-xs"
              @input="nodeValidation.tested = false"
            />
            <button
              :disabled="nodeValidation.testing"
              type="button"
              class="px-4 py-2 bg-surface-card border border-surface-border text-slate-200 hover:text-white hover:border-accent-500/40 text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              @click="emit('testBinaryPath', 'node')"
            >
              <Icon
                v-if="nodeValidation.testing"
                name="ri:loader-4-line"
                class="text-xs animate-spin text-accent-500"
              />
              <Icon
                v-else
                name="ri:search-eye-line"
                class="text-xs text-accent-500"
              />
              <span>Test Path</span>
            </button>
          </div>

          <!-- Inline Validation Result Feedback -->
          <div v-if="nodeValidation.tested" class="mt-1">
            <div
              v-if="nodeValidation.valid"
              class="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs"
            >
              <Icon
                name="ri:checkbox-circle-fill"
                class="text-emerald-400 text-sm shrink-0"
              />
              <div class="flex flex-col gap-0.5 truncate">
                <span class="font-semibold">{{ nodeValidation.message }}</span>
                <span
                  v-if="nodeValidation.detectedPath"
                  class="font-mono text-[10px] text-emerald-400 truncate"
                  >{{ nodeValidation.detectedPath }}</span
                >
              </div>
            </div>
            <div
              v-else
              class="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs"
            >
              <Icon
                name="ri:error-warning-fill"
                class="text-rose-400 text-sm shrink-0"
              />
              <span class="font-medium">{{ nodeValidation.message }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex items-center justify-end gap-3 mt-2">
        <button
          :disabled="savingEnvPaths"
          class="px-4 py-2 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
          @click="emit('saveEnvPaths')"
        >
          <Icon
            v-if="savingEnvPaths"
            name="ri:loader-4-line"
            class="text-xs animate-spin text-accent-500"
          />
          <Icon v-else name="ri:save-line" class="text-xs text-accent-500" />
          <span>{{
            savingEnvPaths ? 'Saving Paths...' : 'Save Environment Paths'
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PathValidationState } from '../HomeSettings.vue';

const ffmpegPath = defineModel<string>('ffmpegPath', { required: true });
const nodePath = defineModel<string>('nodePath', { required: true });

const props = defineProps<{
  ffmpegValidation: PathValidationState;
  nodeValidation: PathValidationState;
  ffmpegStatusBadge: { label: string; class: string; dotClass: string };
  nodeStatusBadge: { label: string; class: string; dotClass: string };
  savingEnvPaths: boolean;
  healthData: any;
}>();

const emit = defineEmits<{
  (e: 'testBinaryPath', tool: 'ffmpeg' | 'node'): void;
  (e: 'resetEnvPath', tool: 'ffmpeg' | 'node'): void;
  (e: 'saveEnvPaths'): void;
}>();
</script>
