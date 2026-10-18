<template>
  <div
    id="settings-health"
    key="health"
    class="scroll-mt-24 flex flex-col gap-6"
  >
    <div>
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          <Icon name="ri:shield-cross-line" class="text-accent-500" />
          <span>Prerequisite Health & Diagnostics</span>
        </h3>
        <span
          class="text-[10px] font-mono font-medium px-2 py-0.5 rounded flex items-center gap-1.5"
          :class="
            isHealthOk
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          "
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="isHealthOk ? 'bg-emerald-400' : 'bg-amber-400'"
          ></span>
          {{ isHealthOk ? 'Ready' : 'Action Required' }}
        </span>
      </div>
      <p class="text-sm text-slate-400">
        Verify the health and directory paths of local software components and
        APIs required for rendering and AI generation.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      <!-- FFmpeg Diagnostics -->
      <div
        class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ri:movie-2-line" class="text-accent-500 text-sm" />
            <span class="text-xs font-bold text-slate-200">FFmpeg</span>
          </div>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
            :class="
              healthData?.ffmpeg?.status === 'OK'
                ? 'bg-black/40 border border-white/5 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            "
          >
            <span
              class="w-1 h-1 rounded-full"
              :class="
                healthData?.ffmpeg?.status === 'OK'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              "
            ></span>
            {{ healthData?.ffmpeg?.status || 'Detecting...' }}
          </span>
        </div>
        <p
          class="text-[11px] text-slate-500 truncate font-mono"
          :title="healthData?.ffmpeg?.path"
        >
          {{
            healthData?.ffmpeg?.path
              ? `Path: ${healthData.ffmpeg.path}`
              : 'Path: Not detected'
          }}
        </p>
        <!-- If missing: 1-click copy install command & docs link -->
        <div
          v-if="healthData && healthData.ffmpeg?.status !== 'OK'"
          class="pt-2 border-t border-surface-border/40 flex flex-col gap-1.5"
        >
          <span class="text-[10px] text-amber-400 font-medium"
            >Missing dependency</span
          >
          <div
            class="flex items-center justify-between gap-2 bg-[#0c0e14] border border-surface-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300"
          >
            <span class="truncate">brew install ffmpeg</span>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy macOS brew command"
                @click="
                  copyToClipboard(
                    'brew install ffmpeg',
                    'FFmpeg install command'
                  )
                "
              >
                <Icon name="ri:file-copy-line" class="text-xs" />
              </button>
              <a
                href="https://ffmpeg.org"
                target="_blank"
                class="text-slate-500 hover:text-slate-300 transition-colors"
                title="Official Website"
              >
                <Icon name="ri:external-link-line" class="text-xs" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Node.js Diagnostics -->
      <div
        class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ri:nodejs-line" class="text-accent-500 text-sm" />
            <span class="text-xs font-bold text-slate-200">Node.js</span>
          </div>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
            :class="
              healthData?.node?.status === 'OK'
                ? 'bg-black/40 border border-white/5 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            "
          >
            <span
              class="w-1 h-1 rounded-full"
              :class="
                healthData?.node?.status === 'OK'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              "
            ></span>
            {{ healthData?.node?.status || 'Detecting...' }}
          </span>
        </div>
        <p
          class="text-[11px] text-slate-500 truncate font-mono"
          :title="healthData?.node?.path"
        >
          {{
            healthData?.node?.path
              ? `Path: ${healthData.node.path}`
              : 'Path: Not detected'
          }}
        </p>
        <!-- If missing: 1-click copy install command & docs link -->
        <div
          v-if="healthData && healthData.node?.status !== 'OK'"
          class="pt-2 border-t border-surface-border/40 flex flex-col gap-1.5"
        >
          <span class="text-[10px] text-amber-400 font-medium"
            >Missing dependency</span
          >
          <div
            class="flex items-center justify-between gap-2 bg-[#0c0e14] border border-surface-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300"
          >
            <span class="truncate">brew install node</span>
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy macOS brew command"
                @click="
                  copyToClipboard(
                    'brew install node',
                    'Node.js install command'
                  )
                "
              >
                <Icon name="ri:file-copy-line" class="text-xs" />
              </button>
              <a
                href="https://nodejs.org"
                target="_blank"
                class="text-slate-500 hover:text-slate-300 transition-colors"
                title="Official Website"
              >
                <Icon name="ri:external-link-line" class="text-xs" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Python Virtual Environment Diagnostics -->
      <div
        class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ri:terminal-box-line" class="text-accent-500 text-sm" />
            <span class="text-xs font-bold text-slate-200"
              >Python Virtualenv</span
            >
          </div>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
            :class="
              healthData?.python_env?.status === 'OK'
                ? 'bg-black/40 border border-white/5 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            "
          >
            <span
              class="w-1 h-1 rounded-full"
              :class="
                healthData?.python_env?.status === 'OK'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              "
            ></span>
            {{ healthData?.python_env?.status || 'Detecting...' }}
          </span>
        </div>
        <p class="text-[11px] text-slate-500 truncate">
          FastAPI backend and AI dependencies runtime.
        </p>
        <!-- If missing: 1-click copy install command -->
        <div
          v-if="healthData && healthData.python_env?.status !== 'OK'"
          class="pt-2 border-t border-surface-border/40 flex flex-col gap-1.5"
        >
          <span class="text-[10px] text-amber-400 font-medium"
            >Missing packages</span
          >
          <div
            class="flex items-center justify-between gap-2 bg-[#0c0e14] border border-surface-border/60 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-slate-300"
          >
            <span class="truncate">pip install -r requirements.txt</span>
            <button
              class="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copy command"
              @click="
                copyToClipboard(
                  'pip install -r requirements.txt',
                  'Pip command'
                )
              "
            >
              <Icon name="ri:file-copy-line" class="text-xs" />
            </button>
          </div>
        </div>
      </div>

      <!-- Gemini AI Key Card -->
      <div
        class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="ri:key-2-line" class="text-accent-500 text-sm" />
            <span class="text-xs font-bold text-slate-200">Gemini AI Key</span>
          </div>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
            :class="
              healthData?.gemini_api?.has_key
                ? 'bg-black/40 border border-white/5 text-emerald-400'
                : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
            "
          >
            <span
              class="w-1 h-1 rounded-full"
              :class="
                healthData?.gemini_api?.has_key
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              "
            ></span>
            {{ healthData?.gemini_api?.has_key ? 'Configured' : 'Missing' }}
          </span>
        </div>
        <p class="text-[11px] text-slate-500 truncate">
          AI transcript analysis and hook title detection.
        </p>
        <div
          v-if="healthData && !healthData.gemini_api?.has_key"
          class="pt-2 border-t border-surface-border/40 flex items-center justify-between"
        >
          <span class="text-[10px] text-amber-400 font-medium"
            >Key not configured</span
          >
          <button
            class="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
            @click="emit('switchTab', 'api')"
          >
            Configure API Key &rarr;
          </button>
        </div>
      </div>

      <!-- YouTube Cookies Diagnostics -->
      <div
        class="p-3.5 rounded-xl border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-2.5 md:col-span-2"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon
              name="ri:shield-keyhole-line"
              class="text-accent-500 text-sm"
            />
            <span class="text-xs font-bold text-slate-200"
              >YouTube Cookies</span
            >
          </div>
          <span
            class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1"
            :class="
              healthData?.cookies?.exists
                ? 'bg-black/40 border border-white/5 text-emerald-400'
                : 'bg-black/40 border border-white/5 text-slate-500'
            "
          >
            <span
              class="w-1 h-1 rounded-full"
              :class="
                healthData?.cookies?.exists ? 'bg-emerald-400' : 'bg-slate-600'
              "
            ></span>
            {{ healthData?.cookies?.exists ? 'Configured' : 'Optional' }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] text-slate-500 truncate">
            {{
              healthData?.cookies?.exists
                ? 'Active cookies.txt file for yt-dlp authentication.'
                : 'Optional yt-dlp authorization file to bypass download limits.'
            }}
          </p>
          <button
            class="text-[10px] text-slate-400 hover:text-white underline cursor-pointer shrink-0"
            @click="emit('switchTab', 'cookies')"
          >
            {{
              healthData?.cookies?.exists
                ? 'Manage Cookies &rarr;'
                : 'Upload Cookies &rarr;'
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SettingsTab } from '../HomeSettings.vue';

const props = defineProps<{
  healthData: any;
  isHealthOk: boolean;
}>();

const emit = defineEmits<{
  (e: 'switchTab', tab: SettingsTab): void;
}>();

const state = useClipperState();

function copyToClipboard(text: string, label: string = 'Command') {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text);
    state.showToast?.(`${label} copied to clipboard!`, 'success');
  }
}
</script>
