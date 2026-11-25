<template>
  <div
    id="settings-system"
    key="system"
    class="scroll-mt-24 flex flex-col gap-4"
  >
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
    >
      <div>
        <h2
          class="text-base font-bold text-white mb-0.5 flex items-center gap-2"
        >
          <Icon
            name="ri:terminal-window-line"
            class="text-accent-500"
            aria-hidden="true"
          />
          <span>System</span>
        </h2>
        <p class="text-xs text-slate-400">
          Local tools required for video processing, rendering, and
          transcription.
        </p>
      </div>

      <button
        type="button"
        :disabled="checkingHealth"
        class="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-600 text-slate-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 self-start sm:self-center cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('recheck')"
      >
        <Icon
          name="ri:refresh-line"
          :class="{ 'motion-safe:animate-spin': checkingHealth }"
          class="text-accent-500 text-xs"
          aria-hidden="true"
        />
        <span>{{ checkingHealth ? 'Checking...' : 'Re-check' }}</span>
      </button>
    </div>

    <!-- Service Error State -->
    <div
      v-if="healthError"
      role="alert"
      class="border border-red-500/35 bg-red-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <div class="flex items-start gap-2">
        <Icon
          name="ri:error-warning-fill"
          class="text-red-400 text-sm shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p class="text-xs text-red-200 leading-relaxed">{{ healthError }}</p>
      </div>

      <button
        type="button"
        :disabled="checkingHealth"
        class="px-2.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] border border-red-400/40 bg-red-500/15 hover:bg-red-500/25 text-red-100 text-xs font-semibold transition-colors cursor-pointer shrink-0 self-start sm:self-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('recheck')"
      >
        Retry check
      </button>
    </div>

    <!-- Initial Loading State -->
    <div
      v-else-if="checkingHealth && !healthData"
      aria-busy="true"
      aria-live="polite"
      class="border border-surface-border bg-surface-dark/40 divide-y divide-surface-border/70"
    >
      <div
        class="px-3.5 py-2.5 text-xs text-slate-300 flex items-center gap-2 bg-surface-dark/60"
      >
        <Icon
          name="ri:loader-4-line"
          class="motion-safe:animate-spin text-accent-500 text-sm shrink-0"
          aria-hidden="true"
        />
        <span>Checking local system tools...</span>
      </div>
      <div
        v-for="label in ['FFmpeg', 'Node.js', 'Python Environment']"
        :key="label"
        class="p-3 flex items-center justify-between gap-2.5"
      >
        <span class="text-[13px] font-medium text-slate-300">{{ label }}</span>
        <span class="text-xs text-slate-400 font-mono">Checking...</span>
      </div>
    </div>

    <!-- Local Prerequisites List -->
    <div
      v-else
      class="border border-surface-border bg-surface-dark/40 divide-y divide-surface-border/70"
    >
      <!-- Binary Prerequisites (FFmpeg, Node.js) -->
      <div
        v-for="tool in binaryTools"
        :key="tool.id"
        :data-testid="`system-tool-${tool.id}`"
        class="p-3 sm:p-3.5 flex flex-col gap-2.5"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <div class="flex flex-col gap-0.5 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[13px] font-semibold text-white">
                {{ tool.name }}
              </span>
              <span class="text-[11px] text-slate-400">{{ tool.role }}</span>

              <span
                v-if="tool.isOk"
                class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300"
              >
                <Icon
                  name="ri:checkbox-circle-fill"
                  class="text-xs shrink-0"
                  aria-hidden="true"
                />
                <span>OK</span>
              </span>

              <span
                v-else-if="tool.isMissing"
                class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300"
              >
                <Icon
                  name="ri:error-warning-fill"
                  class="text-xs shrink-0"
                  aria-hidden="true"
                />
                <span>Needs attention</span>
              </span>

              <span v-else class="text-[11px] font-medium text-slate-400">
                Not checked
              </span>

              <span
                v-if="tool.savedPath.trim()"
                class="text-[11px] font-medium text-accent-400 border border-accent-500/30 bg-accent-500/10 px-1.5 py-0.5"
              >
                Custom path
              </span>
            </div>

            <code
              v-if="tool.isOk && tool.activePath"
              class="font-mono text-[11px] text-slate-300 break-all"
            >
              {{ tool.activePath }}
            </code>
          </div>

          <button
            type="button"
            :aria-expanded="tool.expanded"
            :aria-controls="tool.panelId"
            class="px-2.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] border border-surface-border bg-surface-dark hover:bg-surface-card hover:border-slate-600 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0 self-start sm:self-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="toggleToolExpanded(tool.id)"
          >
            {{ tool.expanded ? 'Hide path' : 'Custom path' }}
            <span class="sr-only"> for {{ tool.name }}</span>
          </button>
        </div>

        <!-- Missing Tool Remediation Notice (OS-neutral) -->
        <div
          v-if="tool.isMissing"
          class="border border-amber-500/35 bg-amber-500/10 py-2.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
        >
          <p class="text-amber-100 leading-relaxed">
            {{ tool.name }} was not found in your system PATH. Install
            {{ tool.name }} or enter a custom executable path below.
          </p>
          <a
            :href="tool.downloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-accent-400 hover:text-accent-300 underline underline-offset-4 font-semibold shrink-0 [@media(pointer:coarse)]:min-h-[44px] sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
          >
            <span>{{ tool.downloadLabel }}</span>
            <Icon
              name="ri:external-link-line"
              class="text-xs"
              aria-hidden="true"
            />
          </a>
        </div>

        <!-- Inline Custom Path Disclosure Panel -->
        <form
          v-if="tool.expanded"
          :id="tool.panelId"
          class="mt-0.5 pt-2.5 border-t border-surface-border/70 flex flex-col gap-2.5"
          @submit.prevent="emit('saveBinaryPath', tool.id)"
        >
          <div class="flex flex-col gap-0.5">
            <label
              :for="tool.inputId"
              class="text-xs font-medium text-slate-200"
            >
              Custom {{ tool.name }} path
            </label>
            <p
              :id="tool.hintId"
              class="text-[11px] text-slate-400 leading-relaxed"
            >
              Enter a binary file or folder path, or leave blank to use system
              PATH.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              :id="tool.inputId"
              :name="`${tool.id}_path`"
              :value="tool.path"
              type="text"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              :aria-describedby="
                tool.validation.tested
                  ? `${tool.hintId} ${tool.feedbackId}`
                  : tool.hintId
              "
              :aria-invalid="
                tool.validation.tested && !tool.validation.valid
                  ? 'true'
                  : undefined
              "
              :placeholder="tool.placeholder"
              class="w-full sm:flex-1 [@media(pointer:coarse)]:min-h-[44px] bg-[#0c0e14] border border-surface-border hover:border-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 text-slate-100 placeholder-slate-500 px-2.5 py-1.5 font-mono text-xs"
              @input="
                updateToolPath(
                  tool.id,
                  ($event.target as HTMLInputElement).value
                )
              "
            />

            <div class="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                :disabled="tool.validation.testing || savingTool === tool.id"
                class="px-2.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] border border-surface-border bg-surface-dark hover:bg-surface-card hover:border-slate-600 text-slate-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
                @click="emit('testBinaryPath', tool.id)"
              >
                {{ tool.validation.testing ? 'Testing...' : 'Test' }}
                <span class="sr-only"> {{ tool.name }} path</span>
              </button>

              <button
                type="submit"
                :disabled="tool.validation.testing || savingTool === tool.id"
                class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-accent-500 hover:bg-accent-400 text-black text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
              >
                {{ savingTool === tool.id ? 'Saving...' : 'Save' }}
                <span class="sr-only"> {{ tool.name }} path</span>
              </button>

              <button
                v-if="tool.path.trim() || tool.savedPath.trim()"
                type="button"
                :disabled="savingTool === tool.id"
                class="px-2.5 py-1.5 [@media(pointer:coarse)]:min-h-[44px] border border-surface-border bg-transparent hover:bg-surface-card text-slate-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
                @click="emit('resetBinaryPath', tool.id)"
              >
                Reset to default
                <span class="sr-only"> for {{ tool.name }}</span>
              </button>
            </div>
          </div>

          <div
            v-if="tool.validation.tested"
            :id="tool.feedbackId"
            :role="tool.validation.valid ? 'status' : 'alert'"
            class="p-2.5 border text-xs flex items-start gap-2"
            :class="
              tool.validation.valid
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/35 bg-red-500/10 text-red-200'
            "
          >
            <Icon
              :name="
                tool.validation.valid
                  ? 'ri:checkbox-circle-fill'
                  : 'ri:close-circle-fill'
              "
              class="text-sm shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div class="flex flex-col gap-0.5 min-w-0">
              <span>{{ tool.validation.message }}</span>
              <code
                v-if="tool.validation.detectedPath"
                class="font-mono text-[11px] text-slate-300 break-all"
              >
                {{ tool.validation.detectedPath }}
              </code>
            </div>
          </div>
        </form>
      </div>

      <!-- Row 3: Python Environment -->
      <div
        data-testid="system-tool-python"
        class="p-3 sm:p-3.5 flex flex-col gap-2.5"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-[13px] font-semibold text-white">
              Python Environment
            </span>
            <span class="text-[11px] text-slate-400">
              Speech transcription and media processing runtime
            </span>

            <span
              v-if="isPythonOk"
              class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300"
            >
              <Icon
                name="ri:checkbox-circle-fill"
                class="text-xs shrink-0"
                aria-hidden="true"
              />
              <span>OK</span>
            </span>

            <span
              v-else-if="isPythonMissing"
              class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300"
            >
              <Icon
                name="ri:error-warning-fill"
                class="text-xs shrink-0"
                aria-hidden="true"
              />
              <span>Needs attention</span>
            </span>

            <span v-else class="text-[11px] font-medium text-slate-400">
              Not checked
            </span>
          </div>

          <span
            v-if="isPythonOk"
            class="text-[11px] text-slate-300 font-medium self-start sm:self-center"
          >
            Ready
          </span>
        </div>

        <div
          v-if="isPythonMissing"
          class="border border-amber-500/35 bg-amber-500/10 py-2.5 px-3 text-xs text-amber-100 leading-relaxed"
        >
          Python dependencies appear incomplete or unavailable. Restart the app
          with
          <code class="font-mono text-white">python run.py</code>
          or check your Python environment installation.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PathValidationState } from '../HomeSettings.vue';
import type { SystemHealth } from '../../utils/systemDiagnostics';

type BinaryToolId = 'ffmpeg' | 'node';

const ffmpegPath = defineModel<string>('ffmpegPath', { required: true });
const nodePath = defineModel<string>('nodePath', { required: true });

const props = withDefaults(
  defineProps<{
    healthData: SystemHealth | null | undefined;
    checkingHealth: boolean;
    healthError?: string | null;
    savedFfmpegPath?: string;
    savedNodePath?: string;
    ffmpegValidation: PathValidationState;
    nodeValidation: PathValidationState;
    savingTool?: BinaryToolId | null;
  }>(),
  {
    healthError: null,
    savedFfmpegPath: '',
    savedNodePath: '',
    savingTool: null
  }
);

const emit = defineEmits<{
  (e: 'recheck'): void;
  (
    e: 'testBinaryPath' | 'saveBinaryPath' | 'resetBinaryPath',
    tool: BinaryToolId
  ): void;
}>();

const ffmpegExpanded = ref(false);
const nodeExpanded = ref(false);
const ffmpegManualToggle = ref(false);
const nodeManualToggle = ref(false);

const hasFfmpegStatus = computed(() =>
  Boolean(props.healthData?.ffmpeg?.status)
);
const isFfmpegOk = computed(() => props.healthData?.ffmpeg?.status === 'OK');
const isFfmpegMissing = computed(
  () => hasFfmpegStatus.value && !isFfmpegOk.value
);

const hasNodeStatus = computed(() => Boolean(props.healthData?.node?.status));
const isNodeOk = computed(() => props.healthData?.node?.status === 'OK');
const isNodeMissing = computed(() => hasNodeStatus.value && !isNodeOk.value);

const hasPythonStatus = computed(() =>
  Boolean(props.healthData?.python_env?.status)
);
const isPythonOk = computed(
  () => props.healthData?.python_env?.status === 'OK'
);
const isPythonMissing = computed(
  () => hasPythonStatus.value && !isPythonOk.value
);

watch(
  [
    () => props.healthData?.ffmpeg?.status,
    ffmpegPath,
    () => props.savedFfmpegPath
  ],
  () => {
    if (ffmpegManualToggle.value) return;
    const hasOverride = Boolean(
      ffmpegPath.value.trim() || props.savedFfmpegPath.trim()
    );
    const missing = Boolean(
      props.healthData?.ffmpeg && props.healthData.ffmpeg.status !== 'OK'
    );
    if (hasOverride || missing) {
      ffmpegExpanded.value = true;
    }
  },
  { immediate: true }
);

watch(
  [() => props.healthData?.node?.status, nodePath, () => props.savedNodePath],
  () => {
    if (nodeManualToggle.value) return;
    const hasOverride = Boolean(
      nodePath.value.trim() || props.savedNodePath.trim()
    );
    const missing = Boolean(
      props.healthData?.node && props.healthData.node.status !== 'OK'
    );
    if (hasOverride || missing) {
      nodeExpanded.value = true;
    }
  },
  { immediate: true }
);

function toggleToolExpanded(tool: BinaryToolId) {
  if (tool === 'ffmpeg') {
    ffmpegManualToggle.value = true;
    ffmpegExpanded.value = !ffmpegExpanded.value;
  } else {
    nodeManualToggle.value = true;
    nodeExpanded.value = !nodeExpanded.value;
  }
}

function updateToolPath(tool: BinaryToolId, value: string) {
  if (tool === 'ffmpeg') {
    ffmpegPath.value = value;
  } else {
    nodePath.value = value;
  }
}

const binaryTools = computed(() => [
  {
    id: 'ffmpeg' as const,
    name: 'FFmpeg',
    role: 'Video and audio processing',
    isOk: isFfmpegOk.value,
    isMissing: isFfmpegMissing.value,
    activePath:
      typeof props.healthData?.ffmpeg?.path === 'string'
        ? props.healthData.ffmpeg.path
        : '',
    path: ffmpegPath.value,
    savedPath: props.savedFfmpegPath,
    validation: props.ffmpegValidation,
    expanded: ffmpegExpanded.value,
    panelId: 'ffmpeg-override-panel',
    inputId: 'ffmpeg-path-input',
    hintId: 'ffmpeg-path-hint',
    feedbackId: 'ffmpeg-path-feedback',
    placeholder: '/usr/local/bin/ffmpeg or C:\\ffmpeg\\bin',
    downloadUrl: 'https://ffmpeg.org/download.html',
    downloadLabel: 'Download FFmpeg (ffmpeg.org)'
  },
  {
    id: 'node' as const,
    name: 'Node.js',
    role: 'Remotion video rendering runtime',
    isOk: isNodeOk.value,
    isMissing: isNodeMissing.value,
    activePath:
      typeof props.healthData?.node?.path === 'string'
        ? props.healthData.node.path
        : '',
    path: nodePath.value,
    savedPath: props.savedNodePath,
    validation: props.nodeValidation,
    expanded: nodeExpanded.value,
    panelId: 'node-override-panel',
    inputId: 'node-path-input',
    hintId: 'node-path-hint',
    feedbackId: 'node-path-feedback',
    placeholder: '/usr/local/bin/node or C:\\Program Files\\nodejs',
    downloadUrl: 'https://nodejs.org/',
    downloadLabel: 'Download Node.js (nodejs.org)'
  }
]);
</script>
