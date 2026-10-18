<template>
  <div class="w-full max-w-5xl z-10 flex flex-col mt-6 mb-10 gap-5">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/50 pb-5"
    >
      <div>
        <h2
          class="text-3xl font-bold tracking-tight text-white mb-1 flex items-center gap-2.5"
        >
          <span>Settings</span>
        </h2>
        <p class="text-slate-400 text-sm">
          Configure your API keys, local software tools, and transcription
          engines.
        </p>
      </div>

      <!-- Quick Health Refresh Action -->
      <button
        :disabled="checkingHealth"
        class="flex items-center gap-1.5 px-3.5 py-2 bg-surface-dark/80 hover:bg-surface-dark border border-surface-border hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-all disabled:opacity-50 self-start sm:self-auto cursor-pointer shadow-sm"
        @click="checkSystemHealth"
      >
        <Icon
          name="ri:refresh-line"
          :class="{ 'animate-spin': checkingHealth }"
          class="text-accent-500 text-sm"
        />
        {{ checkingHealth ? 'Checking Health...' : 'Refresh Health' }}
      </button>
    </div>

    <!-- Global Prerequisite Alert Banner -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <div
        v-if="state.isAnyPrerequisiteMissing.value"
        class="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-start sm:items-center gap-3">
          <div class="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Icon :name="warningDetails.icon" class="text-lg" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-white leading-snug">
              {{ warningDetails.title }}
            </h4>
            <p class="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {{ warningDetails.description }}
            </p>
          </div>
        </div>

        <button
          class="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs rounded-lg transition-all shrink-0 self-start sm:self-center cursor-pointer"
          @click="switchTab(normalizeTab(firstMissingPrerequisiteSection))"
        >
          {{ warningDetails.buttonText }}
        </button>
      </div>
    </Transition>

    <!-- Two-Column Settings Layout -->
    <div class="flex flex-col md:flex-row gap-6 items-start w-full">
      <!-- Left Column / Navigation Sidebar -->
      <aside
        class="w-full md:w-60 lg:w-64 shrink-0 flex flex-col gap-3 md:sticky md:top-2 self-start"
      >
        <!-- Navigation Panel -->
        <div
          ref="navContainerRef"
          class="bg-surface-panel border border-surface-border rounded-2xl p-2 flex flex-row md:flex-col gap-1 shadow-xl overflow-x-auto md:overflow-visible custom-scrollbar relative"
        >
          <!-- Animated Sliding Indicator Line (Desktop) -->
          <div
            class="hidden md:block absolute left-0 w-[2.5px] bg-accent-500 rounded-r-full pointer-events-none transition-all duration-300 ease-out shadow-[0_0_8px_rgba(255,215,0,0.4)]"
            :style="{
              top: `${indicatorTop}px`,
              height: `${indicatorHeight}px`,
              opacity: indicatorOpacity
            }"
          ></div>

          <div
            class="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden md:block"
          >
            Preferences
          </div>

          <button
            v-for="section in sections"
            :key="section.id"
            :ref="el => setButtonRef(section.id, el)"
            class="flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 group relative shrink-0 cursor-pointer outline-none select-none min-h-[42px] md:min-h-0"
            :class="
              activeTab === section.id
                ? 'text-white font-medium bg-surface-dark/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-surface-dark/30'
            "
            @click="switchTab(section.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <Icon
                :name="section.icon"
                class="text-base shrink-0 transition-colors"
                :class="
                  activeTab === section.id
                    ? 'text-accent-500'
                    : 'text-slate-500 group-hover:text-slate-300'
                "
              />
              <div class="flex flex-col min-w-0">
                <span
                  class="text-xs truncate font-medium leading-tight"
                  :class="
                    activeTab === section.id
                      ? 'text-white'
                      : 'text-slate-300 group-hover:text-white'
                  "
                >
                  {{ section.label }}
                </span>
                <span
                  class="text-[10px] text-slate-500 hidden md:block truncate mt-1 leading-none"
                >
                  {{ section.desc }}
                </span>
              </div>
            </div>

            <!-- Status Badges (Subtle / Monochromatic) -->
            <div
              v-if="section.badgeType !== 'none'"
              class="ml-2 shrink-0 flex items-center"
            >
              <!-- Warning Pill -->
              <span
                v-if="section.badgeType === 'warning'"
                class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20"
              >
                {{ section.badgeText }}
              </span>

              <!-- Neutral / Info Pill -->
              <span
                v-else-if="section.badgeText"
                class="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium bg-black/40 border border-white/5 text-slate-400"
              >
                {{ section.badgeText }}
              </span>
            </div>
          </button>

          <!-- Discreet Footer Notice -->
          <div
            class="hidden md:flex items-center gap-1.5 px-3 pt-3 pb-1 mt-1 border-t border-surface-border/40 text-[11px] text-slate-500"
          >
            <Icon name="ri:lock-line" class="text-slate-400 shrink-0 text-xs" />
            <span class="truncate"
              >Stored locally in
              <code class="font-mono text-slate-400 text-[10px]"
                >.env</code
              ></span
            >
          </div>
        </div>
      </aside>

      <!-- Right Column / Active Section Panel -->
      <main
        class="flex-1 min-w-0 w-full bg-surface-panel border border-surface-border rounded-2xl p-6 sm:p-8 shadow-xl relative min-h-[560px] self-start"
      >
        <Transition name="section-fade" mode="out-in">
          <!-- System Health Diagnostics Dashboard -->
          <HealthDiagnosticsPane
            v-if="activeTab === 'health'"
            :health-data="healthData"
            :is-health-ok="isHealthOk"
            @switch-tab="switchTab"
          />

          <!-- Gemini API Keys Configuration -->
          <GeminiKeysPane
            v-else-if="activeTab === 'api'"
            v-model:keys-list="keysList"
            :has-unsaved-changes="hasUnsavedChanges"
            :testing-key="testingKey"
            :test-result="testResult"
            :dragged-index="draggedIndex"
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

          <!-- Environment Setup -->
          <EnvironmentPathsPane
            v-else-if="activeTab === 'env'"
            v-model:ffmpeg-path="ffmpegPath"
            v-model:node-path="nodePath"
            :ffmpeg-validation="ffmpegValidation"
            :node-validation="nodeValidation"
            :ffmpeg-status-badge="ffmpegStatusBadge"
            :node-status-badge="nodeStatusBadge"
            :saving-env-paths="savingEnvPaths"
            :health-data="healthData"
            @test-binary-path="testBinaryPath"
            @reset-env-path="resetEnvPath"
            @save-env-paths="saveEnvPaths"
          />
        </Transition>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import HealthDiagnosticsPane from './settings/HealthDiagnosticsPane.vue';
import GeminiKeysPane from './settings/GeminiKeysPane.vue';
import TranscriptionEnginePane from './settings/TranscriptionEnginePane.vue';
import YouTubeCookiesPane from './settings/YouTubeCookiesPane.vue';
import EnvironmentPathsPane from './settings/EnvironmentPathsPane.vue';

const state = useClipperState();
const route = useRoute();
const router = useRouter();
const API_BASE = resolveApiBase();

const navContainerRef = ref<HTMLElement | null>(null);
const navButtonRefs = ref<Record<string, HTMLElement>>({});
const indicatorTop = ref(0);
const indicatorHeight = ref(18);
const indicatorOpacity = ref(0);

function setButtonRef(id: string, el: any) {
  if (el) {
    navButtonRefs.value[id] = (el.$el || el) as HTMLElement;
  }
}

const updateIndicator = () => {
  nextTick(() => {
    const el = navButtonRefs.value[activeTab.value];
    const container = navContainerRef.value;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const barHeight = 18;
      indicatorTop.value =
        elRect.top - containerRect.top + (elRect.height - barHeight) / 2;
      indicatorHeight.value = barHeight;
      indicatorOpacity.value = 1;
    }
  });
};

export type SettingsTab = 'health' | 'api' | 'whisper' | 'cookies' | 'env';
const validTabs: SettingsTab[] = ['health', 'api', 'whisper', 'cookies', 'env'];

const normalizeTab = (val: string | null | undefined): SettingsTab => {
  if (!val) return 'health';
  const clean = val.replace(/^settings-/, '');
  if (validTabs.includes(clean as SettingsTab)) {
    return clean as SettingsTab;
  }
  return 'health';
};

// Active Tab state with URL query synchronization
const initialTab =
  typeof route.query.tab === 'string'
    ? normalizeTab(route.query.tab)
    : 'health';
const activeTab = ref<SettingsTab>(initialTab);

watch(activeTab, () => {
  updateIndicator();
});

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
const isHealthOk = computed(() => {
  const health = state.systemHealth.value;
  if (!health) return true;
  const systemKeys = ['ffmpeg', 'node', 'python_env'];
  return !systemKeys.some(key => {
    const item = (health as any)[key];
    return !item || item.status !== 'OK';
  });
});

const isEnvOk = computed(() => {
  const health = state.systemHealth.value;
  if (!health) return true;
  const ffmpegReady = Boolean(
    ffmpegPath.value.trim() || health.ffmpeg?.status === 'OK'
  );
  const nodeReady = Boolean(
    nodePath.value.trim() || health.node?.status === 'OK'
  );
  return ffmpegReady && nodeReady;
});

const hasValidApiKey = computed(() => {
  const health = state.systemHealth.value;
  if (health?.gemini_api?.has_key) return true;
  return keysList.value.some(
    k =>
      k.value.trim().length > 0 && (k.status === 'valid' || k.status === 'idle')
  );
});

const validKeysCount = computed(() => {
  return keysList.value.filter(
    k => k.value.trim().length > 0 && k.status === 'valid'
  ).length;
});

// Sidebar Sections Definition
const sections = computed(() => [
  {
    id: 'health' as SettingsTab,
    label: 'System Health',
    desc: 'Prerequisites & diagnostics',
    icon: 'ri:shield-cross-line',
    badgeType: isHealthOk.value ? 'ok' : 'warning',
    badgeText: isHealthOk.value ? 'OK' : 'Missing'
  },
  {
    id: 'api' as SettingsTab,
    label: 'Gemini API Keys',
    desc: 'Key pool & failover',
    icon: 'ri:key-2-fill',
    badgeType: hasValidApiKey.value ? 'ok' : 'warning',
    badgeText: hasValidApiKey.value
      ? validKeysCount.value > 0
        ? `${validKeysCount.value} Valid`
        : 'Configured'
      : 'Required'
  },
  {
    id: 'whisper' as SettingsTab,
    label: 'Whisper Engine',
    desc: 'Local speech-to-text',
    icon: 'ri:cpu-fill',
    badgeType: 'neutral',
    badgeText: state.whisperModel.value.toUpperCase()
  },
  {
    id: 'cookies' as SettingsTab,
    label: 'YouTube Cookies',
    desc: 'yt-dlp authorization',
    icon: 'ri:shield-keyhole-fill',
    badgeType: cookiesStatus.value.exists ? 'ok' : 'neutral',
    badgeText: cookiesStatus.value.exists ? 'Active' : 'Optional'
  },
  {
    id: 'env' as SettingsTab,
    label: 'Environment Paths',
    desc: 'Custom binary locations',
    icon: 'ri:terminal-window-fill',
    badgeType: 'none',
    badgeText: ''
  }
]);

const apiKey = ref('');
export interface KeyListItem {
  id: string;
  title: string;
  value: string;
  show: boolean;
  status: 'idle' | 'valid' | 'invalid' | 'testing';
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

  // Swap
  const itemCurrent = keysList.value[index];
  const itemNew = keysList.value[newIndex];
  if (itemCurrent && itemNew) {
    keysList.value[index] = itemNew;
    keysList.value[newIndex] = itemCurrent;

    // Flash
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

function getKeyPreview(value: string) {
  const val = value.trim();
  if (val.length > 10) {
    return val.substring(0, 6) + '...' + val.slice(-4);
  }
  return '';
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

  // Prevent infinite rapid swap back-and-forth glitch loops
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

  // Swap
  const itemOld = keysList.value[oldIndex];
  const itemIndex = keysList.value[index];
  if (itemOld && itemIndex) {
    keysList.value[oldIndex] = itemIndex;
    keysList.value[index] = itemOld;

    // Flash highlight on both swapped items
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
const savingEnvPaths = ref(false);

export interface PathValidationState {
  testing: boolean;
  tested: boolean;
  valid: boolean;
  message: string;
  detectedPath: string;
  isSystemDefault?: boolean;
}

const ffmpegValidation = ref<PathValidationState>({
  testing: false,
  tested: false,
  valid: false,
  message: '',
  detectedPath: ''
});

const nodeValidation = ref<PathValidationState>({
  testing: false,
  tested: false,
  valid: false,
  message: '',
  detectedPath: ''
});

const fileInput = ref<HTMLInputElement | null>(null);

// Health & Diagnostics state
interface HealthItem {
  status: string;
  path?: string;
  has_key?: boolean;
  active?: boolean;
  exists?: boolean;
}
interface HealthResponse {
  ffmpeg: HealthItem;
  node: HealthItem;
  python_env: HealthItem;
  gemini_api: HealthItem;
  cookies: HealthItem;
}
const healthData = computed(() => state.systemHealth.value);
const checkingHealth = computed(() => state.checkingHealth.value);

const firstMissingPrerequisiteSection = computed(() => {
  const health = state.systemHealth.value;
  if (!health) return 'settings-health';

  // 1. Core system prerequisites (FFmpeg, Node, Python)
  const systemKeys = ['ffmpeg', 'node', 'python_env'];
  const isSystemMissing = systemKeys.some(key => {
    const item = health[key];
    return !item || item.status !== 'OK';
  });
  if (isSystemMissing) {
    return 'settings-health';
  }

  // 2. Gemini API key
  if (!health.gemini_api?.has_key) {
    return 'settings-api';
  }

  // 3. YouTube Cookies
  if (health.cookies?.status !== 'Configured') {
    return 'settings-cookies';
  }

  return 'settings-health';
});

const warningDetails = computed(() => {
  const section = firstMissingPrerequisiteSection.value;
  if (section === 'settings-api') {
    return {
      title: 'Gemini API Key Required',
      description:
        'The Gemini API Key is missing or invalid. Please configure it to enable transcription analysis and AI clipping features.',
      icon: 'ri:key-2-fill',
      buttonText: 'Configure API Key'
    };
  } else if (section === 'settings-cookies') {
    return {
      title: 'YouTube Cookies Missing',
      description:
        'A cookies.txt file has not been provided. Restricted or age-gated YouTube videos may fail to download without valid cookies.',
      icon: 'ri:shield-keyhole-fill',
      buttonText: 'Upload Cookies'
    };
  } else {
    return {
      title: 'System Prerequisites Missing',
      description:
        "Essential system tools (FFmpeg, Node.js, or Python environment) are not fully configured. Let's fix them to enable all features.",
      icon: 'ri:alert-fill',
      buttonText: 'Resolve Prerequisites'
    };
  }
});

const dragOver = ref(false);
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

function applyRecommendedModel(modelId: any) {
  if (modelId && state.whisperModel) {
    state.whisperModel.value = modelId;
    state.showToast?.(
      `Whisper ${String(modelId).toUpperCase()} applied as active transcription model.`,
      'success'
    );
  }
}

// API Key Validation state
const testingKey = ref(false);
const testResult = ref<{
  status: 'idle' | 'valid' | 'invalid';
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

  // Mark all filled keys as testing
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
      status: 'valid' | 'invalid';
      results: Array<{
        key: string;
        status: 'valid' | 'invalid';
        error: string | null;
        raw_error?: string | null;
      }>;
      error?: string;
    }>(`${API_BASE}/api/validate-gemini-key`, {
      method: 'POST',
      body: {
        api_key: payload
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
        message: 'All tested Gemini API keys are verified and functional!'
      };
      state.showToast('All API keys verified successfully!', 'success');
      checkSystemHealth();
    } else {
      testResult.value = {
        status: 'invalid',
        message:
          res.error ||
          'One or more API keys failed verification. Check details above.'
      };
      state.showToast('Validation failed for one or more keys.', 'error');
    }
  } catch (e: any) {
    const errMsg =
      e.data?.detail || e.message || 'Failed to connect to backend server';
    testResult.value = {
      status: 'invalid',
      message: errMsg
    };
    keysList.value.forEach(k => {
      if (k.value.trim()) {
        k.status = 'invalid';
        k.error = errMsg;
        k.raw_error =
          typeof e === 'object' ? JSON.stringify(e, null, 2) : String(e);
        k.showRawError = false;
      }
    });
    state.showToast(`Error testing keys: ${errMsg}`, 'error');
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
      nodePath.value = res.settings.NODE_PATH || '';

      const rawGemini = res.settings.GEMINI_API_KEY || '';
      let loadedKeys: KeyListItem[] = [];

      if (rawGemini.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(rawGemini);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validItems = parsed.filter(
              (item: any) => item && item.value && !isPlaceholderKey(item.value)
            );
            loadedKeys = validItems.map((item: any) => ({
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
  } catch (e: any) {
    const errMsg = e.data?.detail || e.message || 'Failed to save API keys';
    state.showToast(`Failed to save API keys: ${errMsg}`, 'error');
  }
}

const ffmpegStatusBadge = computed(() => {
  if (ffmpegPath.value.trim()) {
    return {
      label: 'Custom Override',
      class: 'bg-black/40 border border-accent-500/30 text-accent-400',
      dotClass: 'bg-accent-400'
    };
  }
  if (healthData.value?.ffmpeg?.status === 'OK') {
    return {
      label: 'Auto-Detected (System PATH)',
      class: 'bg-black/40 border border-white/5 text-emerald-400',
      dotClass: 'bg-emerald-400'
    };
  }
  return {
    label: 'Missing from PATH',
    class: 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
    dotClass: 'bg-amber-400'
  };
});

const nodeStatusBadge = computed(() => {
  if (nodePath.value.trim()) {
    return {
      label: 'Custom Override',
      class: 'bg-black/40 border border-accent-500/30 text-accent-400',
      dotClass: 'bg-accent-400'
    };
  }
  if (healthData.value?.node?.status === 'OK') {
    return {
      label: 'Auto-Detected (System PATH)',
      class: 'bg-black/40 border border-white/5 text-emerald-400',
      dotClass: 'bg-emerald-400'
    };
  }
  return {
    label: 'Optional (Not in PATH)',
    class: 'bg-black/40 border border-white/5 text-slate-400',
    dotClass: 'bg-slate-500'
  };
});

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
  } catch (e: any) {
    const errMsg =
      e.data?.detail || e.message || `Failed to validate ${tool} path`;
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

function resetEnvPath(tool: 'ffmpeg' | 'node') {
  if (tool === 'ffmpeg') {
    ffmpegPath.value = '';
    ffmpegValidation.value = {
      testing: false,
      tested: false,
      valid: false,
      message: '',
      detectedPath: ''
    };
  } else {
    nodePath.value = '';
    nodeValidation.value = {
      testing: false,
      tested: false,
      valid: false,
      message: '',
      detectedPath: ''
    };
  }
}

async function saveEnvPaths() {
  savingEnvPaths.value = true;
  try {
    // 1. Always validate both tools first before persisting
    const [ffmpegOk, nodeOk] = await Promise.all([
      testBinaryPath('ffmpeg'),
      testBinaryPath('node')
    ]);

    if (!ffmpegOk || !nodeOk) {
      const failedTools: string[] = [];
      if (!ffmpegOk) failedTools.push('FFmpeg');
      if (!nodeOk) failedTools.push('Node.js');
      state.showToast(
        `Validation failed for ${failedTools.join(' and ')}. Please provide valid executable locations before saving.`,
        'error'
      );
      return;
    }

    // 2. Only save if validation succeeded
    await $fetch(`${API_BASE}/api/system-settings`, {
      method: 'PUT',
      body: {
        FFMPEG_PATH: ffmpegPath.value,
        NODE_PATH: nodePath.value
      }
    });
    state.showToast(
      'Environment paths validated and saved successfully!',
      'success'
    );
    checkSystemHealth();
  } catch (e: any) {
    const errMsg =
      e.data?.detail || e.message || 'Failed to save environment paths';
    state.showToast(`Failed to save environment paths: ${errMsg}`, 'error');
  } finally {
    savingEnvPaths.value = false;
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
  } catch (e: any) {
    const errDetail =
      e.data?.detail || 'Invalid cookies format. Ensure it is Netscape format.';
    state.showToast(errDetail, 'error');
  }
}

function handleFileSelect(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    uploadCookiesText(text);
  };
  reader.readAsText(file);
}

function handleFileDrop(event: any) {
  dragOver.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;

  if (!file.name.endsWith('.txt')) {
    state.showToast('Please upload a valid .txt cookie file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    uploadCookiesText(text);
  };
  reader.readAsText(file);
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
  } catch (e) {
    state.showToast('Failed to delete cookies', 'error');
  } finally {
    deletingCookies.value = false;
  }
}

// Helpers
function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoString: string | null) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  return date.toLocaleString();
}

function copyToClipboard(text: string, label: string = 'Command') {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text);
    state.showToast(`${label} copied to clipboard!`, 'success');
  }
}

onMounted(() => {
  fetchSettings();
  checkSystemHealth();
  fetchCookiesStatus();
  updateIndicator();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateIndicator);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateIndicator);
  }
});
</script>

<style scoped>
@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.9;
  }
}
.animate-pulse-subtle {
  animation: pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Cross-fade transition for switching settings sections */
.section-fade-enter-active,
.section-fade-leave-active {
  transition:
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.section-fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.section-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
