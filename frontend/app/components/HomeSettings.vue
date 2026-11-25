<template>
  <div class="w-full min-w-0 max-w-5xl z-10 flex flex-col mt-6 mb-10 gap-5">
    <!-- Header -->
    <div class="min-w-0 mb-3">
      <h1 class="text-2xl font-bold tracking-tight text-white mb-0.5">
        Settings
      </h1>
      <p class="text-slate-400 text-xs leading-relaxed">
        Configure your AI models, API keys, local tools, and transcription
        engines.
      </p>
    </div>

    <!-- Global Prerequisite Alert Banner -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="state.isAnyPrerequisiteMissing.value"
        role="alert"
        class="p-3 border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex items-start sm:items-center gap-2.5">
          <div
            class="p-1.5 border border-amber-500/30 bg-amber-500/15 text-amber-300 shrink-0"
          >
            <Icon
              :name="warningDetails.icon"
              class="text-base"
              aria-hidden="true"
            />
          </div>
          <div>
            <h2 class="text-xs font-bold text-white leading-snug">
              {{ warningDetails.title }}
            </h2>
            <p class="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {{ warningDetails.description }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold text-xs transition-colors shrink-0 self-start sm:self-center cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
          @click="switchTab(normalizeTab(firstMissingPrerequisiteSection))"
        >
          {{ warningDetails.buttonText }}
        </button>
      </div>
    </Transition>

    <!-- Two-Column Settings Layout -->
    <div class="flex flex-col lg:flex-row gap-5 items-start w-full min-w-0">
      <!-- Left Column / Navigation Sidebar -->
      <aside
        class="w-full min-w-0 lg:w-[290px] lg:sticky lg:top-2 flex flex-col gap-3 shrink-0 self-start"
      >
        <div
          class="bg-surface-panel border border-surface-border p-3 sm:p-3.5 flex flex-col gap-3"
        >
          <div
            class="px-1 text-[11px] font-semibold text-slate-400 hidden lg:block"
          >
            Preferences
          </div>

          <nav
            aria-label="Settings sections"
            class="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-1.5"
          >
            <button
              v-for="section in sections"
              :key="section.id"
              type="button"
              :aria-current="activeTab === section.id ? 'page' : undefined"
              class="flex items-center justify-between gap-2 px-2.5 py-2 [@media(pointer:coarse)]:min-h-[44px] w-full text-left transition-colors group cursor-pointer select-none border-l-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-[-2px]"
              :class="
                activeTab === section.id
                  ? 'border-accent-500 bg-surface-dark/70 text-white font-medium'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-surface-dark/40'
              "
              @click="switchTab(section.id)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Icon
                  :name="section.icon"
                  class="text-base shrink-0 transition-colors"
                  :class="
                    activeTab === section.id
                      ? 'text-accent-500'
                      : 'text-slate-400 group-hover:text-slate-200'
                  "
                  aria-hidden="true"
                />
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-semibold truncate leading-tight">
                    {{ section.label }}
                  </span>
                  <span
                    class="text-[11px] text-slate-400 hidden lg:block truncate mt-0.5 leading-snug"
                  >
                    {{ section.desc }}
                  </span>
                </div>
              </div>

              <span
                v-if="section.badgeType !== 'none' && section.badgeText"
                data-testid="section-status"
                class="ml-1.5 shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap transition-colors"
                :class="{
                  'text-amber-300': section.badgeType === 'warning',
                  'text-emerald-300': section.badgeType === 'ok',
                  'text-slate-300':
                    section.badgeType === 'neutral' && activeTab === section.id,
                  'text-slate-400 group-hover:text-slate-200':
                    section.badgeType === 'neutral' && activeTab !== section.id
                }"
              >
                <span
                  v-if="
                    section.badgeType === 'ok' ||
                    section.badgeType === 'warning'
                  "
                  aria-hidden="true"
                  class="w-1.5 h-1.5 rounded-full shrink-0"
                  :class="
                    section.badgeType === 'warning'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  "
                ></span>
                <span>{{ section.badgeText }}</span>
              </span>
            </button>
          </nav>
        </div>
      </aside>

      <!-- Right Column / Active Section Panel -->
      <main
        class="flex-1 min-w-0 w-full bg-surface-panel border border-surface-border p-6 sm:p-8 min-h-[560px] flex flex-col self-start relative"
      >
        <Transition name="section-fade" mode="out-in">
          <!-- AI Model & Gemini API Keys Configuration -->
          <GeminiKeysPane
            v-if="activeTab === 'api'"
            v-model:keys-list="keysList"
            :selected-model="selectedGeminiModel"
            :model-options="hookDiscoveryModels"
            :saving-model="savingGeminiModel"
            :model-save-error="modelSaveError"
            :has-unsaved-changes="hasUnsavedChanges"
            :testing-key="testingKey"
            :test-result="testResult"
            :dragged-index="draggedIndex"
            @select-model="updateGeminiModel"
            @add-key="addKey"
            @remove-key="removeKey"
            @move-key="moveKey"
            @drag-start="dragStart"
            @drag-enter="dragEnter"
            @drag-end="dragEnd"
            @save-api-keys="saveApiKeys"
            @test-api-keys="testApiKeys"
          />

          <!-- Whisper AI Configuration -->
          <TranscriptionEnginePane
            v-else-if="activeTab === 'whisper'"
            :hardware-profile="hardwareProfile"
            :detecting-hardware="detectingHardware"
            :hardware-error="hardwareError"
            @detect-hardware="handleDetectHardware"
          />

          <!-- YouTube Cookies Configuration -->
          <YouTubeCookiesPane
            v-else-if="activeTab === 'cookies'"
            :cookies-status="cookiesStatus"
            :deleting-cookies="deletingCookies"
            @upload-text="uploadCookiesText"
            @delete-cookies="deleteCookies"
          />

          <!-- Local System Tools & Binary Paths -->
          <SystemEnvironmentPane
            v-else-if="activeTab === 'system'"
            v-model:ffmpeg-path="ffmpegPath"
            v-model:node-path="nodePath"
            :health-data="healthData"
            :checking-health="checkingHealth"
            :health-error="healthError"
            :saved-ffmpeg-path="savedFfmpegPath"
            :saved-node-path="savedNodePath"
            :ffmpeg-validation="ffmpegValidation"
            :node-validation="nodeValidation"
            :saving-tool="savingTool"
            @recheck="checkSystemHealth"
            @test-binary-path="testBinaryPath"
            @save-binary-path="saveBinaryPath"
            @reset-binary-path="resetBinaryPath"
          />
        </Transition>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import GeminiKeysPane from './settings/GeminiKeysPane.vue';
import TranscriptionEnginePane from './settings/TranscriptionEnginePane.vue';
import YouTubeCookiesPane from './settings/YouTubeCookiesPane.vue';
import SystemEnvironmentPane from './settings/SystemEnvironmentPane.vue';
import {
  HOOK_DISCOVERY_MODELS,
  getHookDiscoveryModelOption,
  normalizeHookDiscoveryModel
} from '../utils/hookDiscoveryModels';
import type {
  GeminiKeyTestResultStatus,
  GeminiKeyValidationStatus,
  HookDiscoveryModelId
} from '../types/clipper';

const state = useClipperState();
const route = useRoute();
const router = useRouter();
const API_BASE = resolveApiBase();

export type SettingsTab = 'api' | 'whisper' | 'cookies' | 'system';
const validTabs: SettingsTab[] = ['api', 'whisper', 'cookies', 'system'];

const normalizeTab = (val: string | null | undefined): SettingsTab => {
  if (!val) return 'api';
  const clean = val.replace(/^settings-/, '');
  if (clean === 'health' || clean === 'env' || clean === 'system') {
    return 'system';
  }
  if (clean === 'transcription' || clean === 'whisper') {
    return 'whisper';
  }
  if (validTabs.includes(clean as SettingsTab)) {
    return clean as SettingsTab;
  }
  return 'api';
};

// Active Tab state with URL query synchronization
const initialTab =
  typeof route.query.tab === 'string' ? normalizeTab(route.query.tab) : 'api';
const activeTab = ref<SettingsTab>(initialTab);

function switchTab(tab: SettingsTab) {
  activeTab.value = tab;
  if (route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } }).catch(() => {});
  }
}

// Sync with programmatic scroll/tab targets (e.g. from topbar alerts)
watch(
  () => state.settingsScrollTarget.value,
  async newTarget => {
    if (newTarget) {
      await nextTick();
      const tab = normalizeTab(newTarget);
      switchTab(tab);
      state.settingsScrollTarget.value = null;
    }
  },
  { immediate: true }
);

// Sync when URL query changes externally
watch(
  () => route.query.tab,
  newTab => {
    if (newTab && typeof newTab === 'string') {
      const tab = normalizeTab(newTab);
      if (activeTab.value !== tab) {
        activeTab.value = tab;
      }
    }
  }
);

// Section Status Computations
const healthData = computed(() => state.systemHealth.value);
const checkingHealth = computed(() => state.checkingHealth.value);
const healthError = computed(() => state.healthError?.value || null);

const isHealthOk = computed(() => {
  const health = healthData.value;
  if (!health || typeof health !== 'object') return true;
  const systemKeys = ['ffmpeg', 'node', 'python_env'] as const;
  return !systemKeys.some(key => {
    const item = health[key];
    return item ? item.status !== 'OK' : false;
  });
});

const hasValidApiKey = computed(() => {
  const health = healthData.value;
  if (health?.gemini_api?.has_key) return true;
  return keysList.value.some(
    k =>
      k.value.trim().length > 0 &&
      (k.status === 'valid' ||
        k.status === 'idle' ||
        k.status === 'unavailable')
  );
});

const selectedGeminiModel = ref<HookDiscoveryModelId>(
  normalizeHookDiscoveryModel(state.geminiModel?.value)
);
const savingGeminiModel = ref(false);
const modelSaveError = ref('');
const hookDiscoveryModels = state.hookDiscoveryModels ?? HOOK_DISCOVERY_MODELS;
const activeGeminiModelOption = computed(() =>
  getHookDiscoveryModelOption(selectedGeminiModel.value)
);

const activeWhisperModelLabel = computed(() => {
  const currentId = state.whisperModel?.value || 'base';
  const match = state.whisperModels?.find(
    (m: { id: string; name: string }) => m.id === currentId
  );
  return match?.name || currentId;
});

// Sidebar Sections Definition (AI Model -> Transcription -> YouTube Cookies -> System)
const sections = computed(() => [
  {
    id: 'api' as SettingsTab,
    label: 'AI Model',
    desc: 'Model & API keys',
    icon: 'ri:equalizer-line',
    badgeType: hasValidApiKey.value ? 'neutral' : 'warning',
    badgeText: hasValidApiKey.value
      ? activeGeminiModelOption.value.shortLabel
      : 'Required'
  },
  {
    id: 'whisper' as SettingsTab,
    label: 'Transcription',
    desc: 'Speech-to-text',
    icon: 'codicon:voice-mode',
    badgeType: 'neutral',
    badgeText: activeWhisperModelLabel.value
  },
  {
    id: 'cookies' as SettingsTab,
    label: 'YouTube Cookies',
    desc: 'Optional download auth',
    icon: 'ri:shield-keyhole-fill',
    badgeType: cookiesStatus.value.exists ? 'ok' : 'neutral',
    badgeText: cookiesStatus.value.exists ? 'Active' : 'Optional'
  },
  {
    id: 'system' as SettingsTab,
    label: 'System',
    desc: 'Local tools & paths',
    icon: 'ri:terminal-window-line',
    badgeType: healthError.value || !isHealthOk.value ? 'warning' : 'ok',
    badgeText: healthError.value
      ? 'Error'
      : isHealthOk.value
        ? 'OK'
        : 'Needs fix'
  }
]);

export interface KeyListItem {
  id: string;
  title: string;
  value: string;
  show: boolean;
  status: GeminiKeyValidationStatus;
  error: string;
  raw_error?: string;
  showRawError?: boolean;
  activeFlash: boolean;
}
const keysList = ref<KeyListItem[]>([]);

const originalSerializedKeys = ref(JSON.stringify([]));
const hasUnsavedChanges = computed(() => {
  const current = JSON.stringify(
    keysList.value.map(k => ({ title: k.title.trim(), value: k.value.trim() }))
  );
  return current !== originalSerializedKeys.value;
});

function addKey() {
  keysList.value.push({
    id: Math.random().toString(36).substring(2, 9),
    title: '',
    value: '',
    show: false,
    status: 'idle',
    error: '',
    raw_error: '',
    showRawError: false,
    activeFlash: false
  });
}

function removeKey(index: number) {
  keysList.value.splice(index, 1);
}

function moveKey(index: number, direction: number) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= keysList.value.length) return;

  const itemCurrent = keysList.value[index];
  const itemNew = keysList.value[newIndex];
  if (itemCurrent && itemNew) {
    keysList.value[index] = itemNew;
    keysList.value[newIndex] = itemCurrent;

    itemCurrent.activeFlash = true;
    itemNew.activeFlash = true;
  }

  setTimeout(() => {
    const iCurrent = keysList.value[index];
    const iNew = keysList.value[newIndex];
    if (iCurrent) iCurrent.activeFlash = false;
    if (iNew) iNew.activeFlash = false;
  }, 600);
}

const draggedIndex = ref<number | null>(null);
const lastSwapTime = ref(0);
const lastSwappedIds = ref<[string, string] | null>(null);

function dragStart(index: number, event: DragEvent) {
  draggedIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', index.toString());
  }
}

function dragEnter(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return;
  const oldIndex = draggedIndex.value;

  const oldItem = keysList.value[oldIndex];
  const newItem = keysList.value[index];
  if (!oldItem || !newItem) return;

  const now = Date.now();
  if (
    lastSwappedIds.value &&
    ((lastSwappedIds.value[0] === oldItem.id &&
      lastSwappedIds.value[1] === newItem.id) ||
      (lastSwappedIds.value[0] === newItem.id &&
        lastSwappedIds.value[1] === oldItem.id))
  ) {
    if (now - lastSwapTime.value < 150) {
      return;
    }
  }

  const itemOld = keysList.value[oldIndex];
  const itemIndex = keysList.value[index];
  if (itemOld && itemIndex) {
    keysList.value[oldIndex] = itemIndex;
    keysList.value[index] = itemOld;

    itemOld.activeFlash = true;
    itemIndex.activeFlash = true;
  }

  draggedIndex.value = index;
  lastSwappedIds.value = [oldItem.id, newItem.id];
  lastSwapTime.value = now;

  const targetId1 = oldItem.id;
  const targetId2 = newItem.id;

  setTimeout(() => {
    const item1 = keysList.value.find(k => k.id === targetId1);
    if (item1) item1.activeFlash = false;
    const item2 = keysList.value.find(k => k.id === targetId2);
    if (item2) item2.activeFlash = false;
  }, 600);
}

function dragEnd() {
  draggedIndex.value = null;
  lastSwappedIds.value = null;
  lastSwapTime.value = 0;
}

const ffmpegPath = ref('');
const nodePath = ref('');
const savedFfmpegPath = ref('');
const savedNodePath = ref('');
const savingTool = ref<'ffmpeg' | 'node' | null>(null);

export interface PathValidationState {
  testing: boolean;
  tested: boolean;
  valid: boolean;
  message: string;
  detectedPath: string;
  isSystemDefault?: boolean;
}

function createEmptyValidationState(): PathValidationState {
  return {
    testing: false,
    tested: false,
    valid: false,
    message: '',
    detectedPath: ''
  };
}

const ffmpegValidation = ref<PathValidationState>(createEmptyValidationState());
const nodeValidation = ref<PathValidationState>(createEmptyValidationState());

// Global Prerequisite Warning Routing (System tools and Gemini API key only; Cookies are optional)
const firstMissingPrerequisiteSection = computed(() => {
  const health = healthData.value;
  if (!health) return 'settings-system';

  const systemKeys = ['ffmpeg', 'node', 'python_env'] as const;
  const isSystemMissing = systemKeys.some(key => {
    const item = health[key];
    return !item || item.status !== 'OK';
  });
  if (isSystemMissing) {
    return 'settings-system';
  }

  if (!health.gemini_api?.has_key) {
    return 'settings-api';
  }

  return 'settings-system';
});

const warningDetails = computed(() => {
  const section = firstMissingPrerequisiteSection.value;
  if (section === 'settings-api') {
    return {
      title: 'Gemini API Key Required',
      description:
        'A Gemini API key is missing or invalid. Add a key to enable transcript analysis and AI hook discovery.',
      icon: 'ri:key-2-fill',
      buttonText: 'Configure API Key'
    };
  }
  return {
    title: 'System Prerequisites Missing',
    description:
      'Required local tools (FFmpeg, Node.js, or Python environment) need attention before processing videos.',
    icon: 'ri:alert-fill',
    buttonText: 'Review System Tools'
  };
});

const deletingCookies = ref(false);
const cookiesStatus = ref<{
  exists: boolean;
  size_bytes: number;
  last_modified: string | null;
}>({ exists: false, size_bytes: 0, last_modified: null });

const checkSystemHealth = () => state.checkSystemHealth();

// Hardware Detection & Recommendation State
const hardwareProfile = computed(() => state.hardwareProfile?.value || null);
const detectingHardware = computed(
  () => state.detectingHardware?.value || false
);
const hardwareError = computed(() => state.hardwareError?.value || null);

async function handleDetectHardware() {
  const profile = await state.detectHardwareProfile?.();
  if (profile) {
    state.showToast?.(
      `Detected ${profile.cpu.brand} (${profile.memory.total_gb} GB RAM). Recommended: ${profile.recommended_model.toUpperCase()}`,
      'success'
    );
  } else {
    state.showToast?.('Failed to detect hardware profile.', 'error');
  }
}

// API Key Validation state
const testingKey = ref(false);
const testResult = ref<{
  status: GeminiKeyTestResultStatus;
  message: string;
}>({ status: 'idle', message: '' });

async function testApiKeys() {
  const filledKeys = keysList.value.filter(k => k.value.trim().length > 0);
  if (filledKeys.length === 0) {
    state.showToast('No API keys to test.', 'error');
    return;
  }

  testingKey.value = true;
  testResult.value = { status: 'idle', message: '' };

  keysList.value.forEach(k => {
    if (k.value.trim()) {
      k.status = 'testing';
      k.error = '';
    }
  });

  try {
    const payload = JSON.stringify(
      keysList.value
        .map(k => ({ title: k.title.trim(), value: k.value.trim() }))
        .filter(k => k.value.length > 0)
    );

    const res = await $fetch<{
      status: Exclude<GeminiKeyTestResultStatus, 'idle'>;
      results: Array<{
        key: string;
        status: Exclude<GeminiKeyTestResultStatus, 'idle'>;
        error: string | null;
        raw_error?: string | null;
      }>;
      error?: string;
    }>(`${API_BASE}/api/validate-gemini-key`, {
      method: 'POST',
      body: {
        api_key: payload,
        model_name: selectedGeminiModel.value
      }
    });

    if (res.results && res.results.length > 0) {
      res.results.forEach(r => {
        const matchingKey = keysList.value.find(k => k.value.trim() === r.key);
        if (matchingKey) {
          matchingKey.status = r.status;
          matchingKey.error = r.error || '';
          matchingKey.raw_error = r.raw_error || '';
          matchingKey.showRawError = false;
        }
      });
    }

    if (res.status === 'valid') {
      testResult.value = {
        status: 'valid',
        message: 'All tested Gemini API keys are verified and working.'
      };
      state.showToast('All API keys verified successfully!', 'success');
      checkSystemHealth();
    } else if (res.status === 'unavailable') {
      testResult.value = {
        status: 'unavailable',
        message:
          res.error ||
          'Gemini service is temporarily busy or unreachable. Your keys could not be verified right now.'
      };
      state.showToast(
        'Gemini is temporarily unavailable. Keys were not marked invalid.',
        'info'
      );
    } else {
      testResult.value = {
        status: 'invalid',
        message:
          res.error ||
          'One or more API keys failed verification. Check details above.'
      };
      state.showToast('Validation failed for one or more keys.', 'error');
    }
  } catch (e: unknown) {
    const errObj = e as {
      statusCode?: number;
      status?: number;
      data?: { detail?: string };
      message?: string;
    };
    const httpStatus = errObj?.statusCode ?? errObj?.status;
    const isClientError =
      typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500;
    const fallbackStatus: Exclude<GeminiKeyTestResultStatus, 'idle'> =
      isClientError ? 'invalid' : 'unavailable';
    const errMsg =
      errObj?.data?.detail ||
      errObj?.message ||
      'Unable to verify API keys right now. Make sure the local app service is running and try again.';
    testResult.value = {
      status: fallbackStatus,
      message: errMsg
    };
    keysList.value.forEach(k => {
      if (k.value.trim()) {
        k.status = fallbackStatus;
        k.error = errMsg;
        k.raw_error =
          typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e);
        k.showRawError = false;
      }
    });
    state.showToast(
      fallbackStatus === 'unavailable'
        ? `Could not verify keys right now: ${errMsg}`
        : `Error testing keys: ${errMsg}`,
      fallbackStatus === 'unavailable' ? 'info' : 'error'
    );
  } finally {
    testingKey.value = false;
  }
}

function isPlaceholderKey(val: string | undefined | null): boolean {
  if (!val) return true;
  const cleaned = val.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return true;
  const lower = cleaned.toLowerCase();
  const exact = [
    'your_gemini_api_key_here',
    'your_api_key_here',
    'your_key_here',
    'your_api_key',
    'your_gemini_api_key',
    'changeme',
    'placeholder',
    'dummy',
    'default',
    'none',
    'null'
  ];
  if (exact.includes(lower)) return true;
  if (/^your_.*_here$/.test(lower)) return true;
  if (lower.startsWith('<') && lower.endsWith('>')) return true;
  return false;
}

async function fetchSettings() {
  try {
    const res = await $fetch<{ settings: Record<string, string> }>(
      `${API_BASE}/api/system-settings`
    );
    if (res.settings) {
      ffmpegPath.value = res.settings.FFMPEG_PATH || '';
      savedFfmpegPath.value = res.settings.FFMPEG_PATH || '';
      nodePath.value = res.settings.NODE_PATH || '';
      savedNodePath.value = res.settings.NODE_PATH || '';

      const normalizedModel = normalizeHookDiscoveryModel(
        res.settings.GEMINI_MODEL
      );
      selectedGeminiModel.value = normalizedModel;
      if (state.geminiModel) {
        state.geminiModel.value = normalizedModel;
      }

      const rawGemini = res.settings.GEMINI_API_KEY || '';
      let loadedKeys: KeyListItem[] = [];

      if (rawGemini.trim().startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(rawGemini);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validItems = parsed.filter(
              (item): item is { title?: string; value: string } =>
                typeof item === 'object' &&
                item !== null &&
                'value' in item &&
                typeof item.value === 'string' &&
                !isPlaceholderKey(item.value)
            );
            loadedKeys = validItems.map(item => ({
              id: Math.random().toString(36).substring(2, 9),
              title: item.title || '',
              value: item.value || '',
              show: false,
              status: 'idle',
              error: '',
              raw_error: '',
              showRawError: false,
              activeFlash: false
            }));
          }
        } catch (e) {
          console.error('Failed to parse GEMINI_API_KEY as JSON array', e);
        }
      } else if (rawGemini.trim()) {
        const parts = rawGemini
          .split(',')
          .map(s => s.trim())
          .filter(s => s && !isPlaceholderKey(s));
        if (parts.length > 0) {
          loadedKeys = parts.map(keyVal => ({
            id: Math.random().toString(36).substring(2, 9),
            title: '',
            value: keyVal,
            show: false,
            status: 'idle',
            error: '',
            raw_error: '',
            showRawError: false,
            activeFlash: false
          }));
        }
      }

      keysList.value = loadedKeys;
      originalSerializedKeys.value = JSON.stringify(
        loadedKeys.map(k => ({ title: k.title.trim(), value: k.value.trim() }))
      );
    }
  } catch (e) {
    console.error('Failed to fetch system settings', e);
  }
}

async function updateGeminiModel(newModel: HookDiscoveryModelId) {
  const normalizedTarget = normalizeHookDiscoveryModel(newModel);
  if (
    savingGeminiModel.value ||
    normalizedTarget === selectedGeminiModel.value
  ) {
    return;
  }

  const previousModel = selectedGeminiModel.value;
  selectedGeminiModel.value = normalizedTarget;
  modelSaveError.value = '';
  savingGeminiModel.value = true;

  try {
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: {
        GEMINI_MODEL: normalizedTarget
      }
    });

    if (state.geminiModel) {
      state.geminiModel.value = normalizedTarget;
    }
    const label = getHookDiscoveryModelOption(normalizedTarget).name;
    state.showToast?.(`Hook Discovery Model switched to ${label}.`, 'success');
    checkSystemHealth();
  } catch (e: unknown) {
    selectedGeminiModel.value = previousModel;
    const errObj = e as { data?: { detail?: string }; message?: string };
    const errMsg =
      errObj?.data?.detail ||
      errObj?.message ||
      'Failed to save Hook Discovery Model.';
    modelSaveError.value = errMsg;
    state.showToast?.(
      `Failed to switch Hook Discovery Model: ${errMsg}`,
      'error'
    );
  } finally {
    savingGeminiModel.value = false;
  }
}

async function saveApiKeys() {
  try {
    const payload = keysList.value
      .map(k => ({ title: k.title.trim(), value: k.value.trim() }))
      .filter(k => k.value.length > 0);

    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: {
        GEMINI_API_KEY: JSON.stringify(payload)
      }
    });

    originalSerializedKeys.value = JSON.stringify(
      keysList.value.map(k => ({
        title: k.title.trim(),
        value: k.value.trim()
      }))
    );
    state.showToast('API Keys saved successfully!', 'success');
    checkSystemHealth();
  } catch (e: unknown) {
    const errObj = e as { data?: { detail?: string }; message?: string };
    const errMsg =
      errObj?.data?.detail || errObj?.message || 'Failed to save API keys';
    state.showToast(`Failed to save API keys: ${errMsg}`, 'error');
  }
}

async function testBinaryPath(tool: 'ffmpeg' | 'node'): Promise<boolean> {
  const targetValidation =
    tool === 'ffmpeg' ? ffmpegValidation : nodeValidation;
  const currentPath = tool === 'ffmpeg' ? ffmpegPath.value : nodePath.value;

  targetValidation.value.testing = true;
  targetValidation.value.tested = false;

  try {
    const res = await $fetch<{
      valid: boolean;
      detected_path: string;
      is_system_default?: boolean;
      message: string;
    }>(`${API_BASE}/api/validate-binary-path`, {
      method: 'POST',
      body: {
        tool,
        path: currentPath
      }
    });
    targetValidation.value = {
      testing: false,
      tested: true,
      valid: res.valid,
      message: res.message,
      detectedPath: res.detected_path,
      isSystemDefault: res.is_system_default
    };
    return res.valid;
  } catch (e: unknown) {
    const errObj = e as { data?: { detail?: string }; message?: string };
    const errMsg =
      errObj?.data?.detail ||
      errObj?.message ||
      `Failed to validate ${tool} path`;
    targetValidation.value = {
      testing: false,
      tested: true,
      valid: false,
      message: errMsg,
      detectedPath: ''
    };
    return false;
  }
}

async function saveBinaryPath(tool: 'ffmpeg' | 'node') {
  const toolLabel = tool === 'ffmpeg' ? 'FFmpeg' : 'Node.js';
  const trimmedPath =
    tool === 'ffmpeg' ? ffmpegPath.value.trim() : nodePath.value.trim();

  if (tool === 'ffmpeg') {
    ffmpegPath.value = trimmedPath;
  } else {
    nodePath.value = trimmedPath;
  }

  savingTool.value = tool;
  try {
    const isValid = await testBinaryPath(tool);
    if (!isValid) {
      state.showToast(
        `${toolLabel} path validation failed. Fix the path before saving.`,
        'error'
      );
      return;
    }

    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body:
        tool === 'ffmpeg'
          ? { FFMPEG_PATH: trimmedPath }
          : { NODE_PATH: trimmedPath }
    });

    if (tool === 'ffmpeg') {
      savedFfmpegPath.value = trimmedPath;
    } else {
      savedNodePath.value = trimmedPath;
    }

    state.showToast(
      trimmedPath
        ? `${toolLabel} custom path saved.`
        : `${toolLabel} reset to system default.`,
      'success'
    );
    checkSystemHealth();
  } catch (e: unknown) {
    const errObj = e as { data?: { detail?: string }; message?: string };
    const errMsg =
      errObj?.data?.detail ||
      errObj?.message ||
      `Failed to save ${toolLabel} path`;
    state.showToast(`Failed to save ${toolLabel} path: ${errMsg}`, 'error');
  } finally {
    savingTool.value = null;
  }
}

async function resetBinaryPath(tool: 'ffmpeg' | 'node') {
  const toolLabel = tool === 'ffmpeg' ? 'FFmpeg' : 'Node.js';
  const hadSavedOverride = Boolean(
    tool === 'ffmpeg'
      ? savedFfmpegPath.value.trim()
      : savedNodePath.value.trim()
  );

  if (tool === 'ffmpeg') {
    ffmpegPath.value = '';
    ffmpegValidation.value = createEmptyValidationState();
  } else {
    nodePath.value = '';
    nodeValidation.value = createEmptyValidationState();
  }

  if (!hadSavedOverride) return;

  savingTool.value = tool;
  try {
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: tool === 'ffmpeg' ? { FFMPEG_PATH: '' } : { NODE_PATH: '' }
    });
    if (tool === 'ffmpeg') {
      savedFfmpegPath.value = '';
    } else {
      savedNodePath.value = '';
    }
    state.showToast(`${toolLabel} reset to system default.`, 'success');
    checkSystemHealth();
  } catch (e: unknown) {
    const errObj = e as { data?: { detail?: string }; message?: string };
    const errMsg =
      errObj?.data?.detail ||
      errObj?.message ||
      `Failed to reset ${toolLabel} path`;
    state.showToast(`Failed to reset ${toolLabel} path: ${errMsg}`, 'error');
  } finally {
    savingTool.value = null;
  }
}

async function fetchCookiesStatus() {
  try {
    const res = await $fetch<{
      exists: boolean;
      size_bytes: number;
      last_modified: string | null;
    }>(`${API_BASE}/api/cookies-status`);
    cookiesStatus.value = res;
  } catch (e) {
    console.error('Failed to fetch cookies status', e);
  }
}

async function uploadCookiesText(text: string) {
  try {
    const res = await $fetch<{ status: string; message: string }>(
      `${API_BASE}/api/upload-cookies`,
      {
        method: 'POST',
        body: { cookies_text: text }
      }
    );
    if (res.status === 'ok') {
      state.showToast('cookies.txt uploaded successfully!', 'success');
      fetchCookiesStatus();
      checkSystemHealth();
    } else {
      state.showToast('Failed to upload cookies', 'error');
    }
  } catch (e: unknown) {
    const errObj = e as { data?: { detail?: string } };
    const errDetail =
      errObj?.data?.detail ||
      'Invalid cookies file. Please export a valid cookies.txt file from your browser.';
    state.showToast(errDetail, 'error');
  }
}

async function deleteCookies() {
  deletingCookies.value = true;
  try {
    await $fetch(`${API_BASE}/api/delete-cookies`, {
      method: 'DELETE'
    });
    state.showToast('cookies.txt deleted successfully', 'success');
    fetchCookiesStatus();
    checkSystemHealth();
  } catch {
    state.showToast('Failed to delete cookies', 'error');
  } finally {
    deletingCookies.value = false;
  }
}

onMounted(() => {
  fetchSettings();
  checkSystemHealth();
  fetchCookiesStatus();
});
</script>

<style scoped>
/* Cross-fade transition for switching settings sections */
@media (prefers-reduced-motion: no-preference) {
  .section-fade-enter-active,
  .section-fade-leave-active {
    transition:
      opacity 0.16s ease,
      transform 0.16s ease;
  }

  .section-fade-enter-from {
    opacity: 0;
    transform: translateY(4px);
  }

  .section-fade-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
