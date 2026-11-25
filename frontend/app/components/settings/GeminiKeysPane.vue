<template>
  <div id="settings-api" key="api" class="scroll-mt-24 flex flex-col gap-6">
    <div>
      <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <Icon
          name="ri:equalizer-line"
          class="text-accent-500"
          aria-hidden="true"
        />
        <span>AI Model</span>
      </h3>
      <p class="text-sm text-slate-400">
        Select the Hook Discovery Model and manage Gemini API failover keys.
      </p>
    </div>

    <!-- Hook Discovery Model Selection -->
    <section
      aria-labelledby="hook-discovery-model-label"
      class="p-4 border bg-surface-dark/40 border-surface-border/60 flex flex-col gap-3.5 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label
          id="hook-discovery-model-label"
          for="hook-discovery-model-select"
          class="text-sm font-semibold text-white"
        >
          Hook Discovery Model
        </label>

        <div class="flex items-center gap-2.5 text-xs">
          <span
            v-if="savingModel"
            role="status"
            aria-live="polite"
            class="inline-flex items-center gap-1.5 text-accent-400 font-medium"
          >
            <Icon
              name="ri:loader-4-line"
              class="animate-spin text-xs"
              aria-hidden="true"
            />
            <span>Saving...</span>
          </span>
          <span class="text-slate-400">
            Provider:
            <span class="text-slate-200 font-medium">
              {{ activeModelOption.providerLabel }}
            </span>
          </span>
        </div>
      </div>

      <div class="relative">
        <select
          id="hook-discovery-model-select"
          name="gemini_model"
          :value="activeModelId"
          :disabled="savingModel"
          aria-describedby="hook-discovery-model-desc"
          :aria-invalid="modelSaveError ? 'true' : undefined"
          class="hook-model-select w-full min-h-[44px] bg-[#0c0e14] border border-surface-border hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 focus-visible:border-accent-500 text-white text-sm font-medium pl-3.5 pr-10 py-2.5 appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          @change="handleModelChange"
        >
          <option
            v-for="option in resolvedModelOptions"
            :key="option.id"
            :value="option.id"
            class="bg-[#0c0e14] text-slate-100"
          >
            {{ option.name }}
          </option>
        </select>
        <Icon
          name="ri:arrow-down-s-line"
          aria-hidden="true"
          class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base"
        />
      </div>

      <div id="hook-discovery-model-desc" class="flex flex-col gap-2.5">
        <p class="text-xs text-slate-300 leading-relaxed max-w-[72ch]">
          {{ activeModelOption.desc }}
        </p>

        <div
          class="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-surface-border/40 text-xs"
        >
          <div class="flex flex-wrap items-center gap-2">
            <code
              class="font-mono text-[11px] text-slate-300 bg-black/40 border border-white/10 px-2 py-0.5 whitespace-nowrap"
            >
              {{ activeModelOption.id }}
            </code>
            <span class="text-slate-400">
              {{ activeModelOption.quotaNote }}
            </span>
          </div>

          <a
            href="https://aistudio.google.com/rate-limit"
            target="_blank"
            rel="noopener noreferrer"
            class="text-slate-300 hover:text-accent-400 underline underline-offset-4 decoration-slate-600 hover:decoration-accent-400 transition-colors inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 whitespace-nowrap"
          >
            <span>Check Google AI Studio rate limits</span>
            <Icon
              name="ri:external-link-line"
              aria-hidden="true"
              class="text-xs"
            />
          </a>
        </div>
      </div>

      <div
        v-if="modelSaveError"
        role="alert"
        class="p-2.5 border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-center gap-2"
      >
        <Icon
          name="ri:error-warning-line"
          aria-hidden="true"
          class="text-sm text-red-400 shrink-0"
        />
        <span>{{ modelSaveError }}</span>
      </div>
    </section>

    <hr class="border-surface-border/50" />

    <!-- Gemini API Keys Section -->
    <div>
      <div class="flex justify-between items-center mb-2">
        <h4 class="text-base font-bold text-white flex items-center gap-2">
          <Icon
            name="ri:key-2-fill"
            class="text-accent-500"
            aria-hidden="true"
          />
          <span>Gemini API Keys</span>
        </h4>

        <button
          v-if="keysList.length > 0"
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 shadow-sm"
          @click="emit('addKey')"
        >
          <Icon
            name="ri:add-line"
            class="text-accent-500 text-sm"
            aria-hidden="true"
          />
          <span>Add Fallback Key</span>
        </button>
      </div>
      <p class="text-sm text-slate-400">
        Configure fallback Gemini API keys to ensure high availability. The
        first valid key in the list is treated as the Primary key.
      </p>
    </div>

    <TransitionGroup
      name="list-keys"
      tag="div"
      class="flex flex-col gap-2.5 relative"
    >
      <div
        v-for="(keyItem, index) in keysList"
        :key="keyItem.id"
        draggable="true"
        class="group p-3 rounded-xl border bg-surface-dark/40 border-surface-border/60 hover:border-slate-700/80 transition-all duration-200 flex flex-col gap-2 shadow-sm"
        :class="{
          'border-accent-500 shadow-[0_0_12px_rgba(255,215,0,0.15)]':
            keyItem.activeFlash,
          'opacity-30 border-dashed border-accent-500/50 bg-accent-500/5 cursor-grabbing':
            index === draggedIndex
        }"
        @dragstart="emit('dragStart', index, $event)"
        @dragover.prevent
        @dragenter="emit('dragEnter', index)"
        @dragend="emit('dragEnd')"
      >
        <!-- Main Single-Row Layout -->
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        >
          <!-- Left: Drag handle, Order Badge, Reorder buttons -->
          <div class="flex items-center gap-2 shrink-0">
            <!-- Drag handle -->
            <span
              class="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-0.5 flex items-center justify-center w-5"
              title="Drag to reorder"
            >
              <Icon name="ri:draggable" class="text-base" />
            </span>

            <!-- Order badge with fixed width for pixel-perfect vertical alignment -->
            <span
              class="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md border flex items-center justify-center gap-1.5 w-[94px] shrink-0 select-none"
              :class="
                index === 0
                  ? 'bg-accent-500/10 border-accent-500/30 text-accent-400 font-bold'
                  : 'bg-black/40 border-white/5 text-slate-400'
              "
            >
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="index === 0 ? 'bg-accent-500' : 'bg-slate-500'"
              ></span>
              <span class="truncate"
                >#{{ index + 1 }}
                {{ index === 0 ? 'Primary' : 'Fallback' }}</span
              >
            </span>

            <!-- Compact Reorder Buttons -->
            <div
              class="flex items-center bg-black/40 border border-white/5 rounded-md p-0.5 shrink-0"
            >
              <button
                type="button"
                :disabled="index === 0"
                class="p-0.5 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
                title="Move Up"
                aria-label="Move key up"
                @click="emit('moveKey', index, -1)"
              >
                <Icon
                  name="ri:arrow-up-s-line"
                  class="text-xs"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                :disabled="index === keysList.length - 1"
                class="p-0.5 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
                title="Move Down"
                aria-label="Move key down"
                @click="emit('moveKey', index, 1)"
              >
                <Icon
                  name="ri:arrow-down-s-line"
                  class="text-xs"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <!-- Middle: Inline Split Columns (Label + Key) -->
          <div
            class="flex-1 flex flex-col sm:flex-row items-center gap-2 min-w-0"
          >
            <!-- Title/Alias input -->
            <div class="w-full sm:w-1/3 min-w-[120px]">
              <input
                v-model="keyItem.title"
                type="text"
                aria-label="API key label"
                placeholder="Label (e.g. Work Key)"
                class="w-full bg-[#0c0e14] border border-surface-border/60 hover:border-slate-700 focus:border-accent-500/50 text-slate-200 placeholder-slate-600 px-2.5 py-1.5 rounded-lg focus:outline-none text-xs"
              />
            </div>

            <!-- Key input with eye toggle -->
            <div class="w-full sm:flex-1 relative">
              <input
                v-model="keyItem.value"
                :type="keyItem.show ? 'text' : 'password'"
                aria-label="Gemini API key value"
                placeholder="AIzaSy..."
                class="w-full bg-[#0c0e14] border border-surface-border/60 hover:border-slate-700 focus:border-accent-500/50 text-white placeholder-slate-600 px-2.5 py-1.5 rounded-lg focus:outline-none font-mono text-xs pr-8"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
                :title="keyItem.show ? 'Hide key' : 'Reveal key'"
                :aria-label="keyItem.show ? 'Hide key' : 'Reveal key'"
                @click="keyItem.show = !keyItem.show"
              >
                <Icon
                  :name="keyItem.show ? 'ri:eye-off-line' : 'ri:eye-line'"
                  class="text-xs"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <!-- Right: Status Badge & Delete Button -->
          <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <!-- Status Badge -->
            <span
              class="text-[9px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1 border"
              :class="{
                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400':
                  keyItem.status === 'valid',
                'bg-red-500/10 border-red-500/20 text-red-400':
                  keyItem.status === 'invalid',
                'bg-amber-500/10 border-amber-500/25 text-amber-300':
                  keyItem.status === 'unavailable',
                'bg-black/40 border-white/5 text-slate-500':
                  keyItem.status === 'idle',
                'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse':
                  keyItem.status === 'testing'
              }"
            >
              <span
                class="w-1 h-1 rounded-full"
                :class="{
                  'bg-emerald-400': keyItem.status === 'valid',
                  'bg-red-400': keyItem.status === 'invalid',
                  'bg-amber-300': keyItem.status === 'unavailable',
                  'bg-slate-500': keyItem.status === 'idle',
                  'bg-amber-400': keyItem.status === 'testing'
                }"
              ></span>
              {{
                keyItem.status === 'valid'
                  ? 'Valid'
                  : keyItem.status === 'invalid'
                    ? 'Invalid'
                    : keyItem.status === 'unavailable'
                      ? 'Service Busy'
                      : keyItem.status === 'testing'
                        ? 'Testing...'
                        : 'Not Tested'
              }}
            </span>

            <!-- Delete Button -->
            <button
              type="button"
              class="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
              title="Remove Key"
              aria-label="Remove API key"
              @click="emit('removeKey', index)"
            >
              <Icon
                name="ri:delete-bin-6-line"
                class="text-xs"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <!-- Micro Error Drawer (Expanded when status is invalid or unavailable) -->
        <div
          v-if="
            (keyItem.status === 'invalid' ||
              keyItem.status === 'unavailable') &&
            keyItem.error
          "
          class="pt-2 border-t flex flex-col gap-2 -mx-3 -mb-3 p-3 rounded-b-xl"
          :class="
            keyItem.status === 'unavailable'
              ? 'border-amber-500/20 bg-amber-500/5'
              : 'border-red-500/20 bg-red-500/5'
          "
        >
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div class="flex items-start gap-1.5 min-w-0">
              <Icon
                name="ri:error-warning-line"
                class="text-sm shrink-0 mt-0.5"
                :class="
                  keyItem.status === 'unavailable'
                    ? 'text-amber-400'
                    : 'text-red-400'
                "
              />
              <span
                class="text-[11px] leading-relaxed font-medium"
                :class="
                  keyItem.status === 'unavailable'
                    ? 'text-amber-200'
                    : 'text-red-300'
                "
                >{{ keyItem.error }}</span
              >
            </div>

            <!-- Inline Action Pills -->
            <div
              class="flex items-center gap-1.5 shrink-0 self-start sm:self-center"
            >
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[10px] px-2 py-0.5 rounded-md font-medium border transition-colors flex items-center gap-1 cursor-pointer"
                :class="
                  keyItem.status === 'unavailable'
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border-amber-500/30'
                    : 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                "
                title="Open Google AI Studio"
              >
                AI Studio
                <Icon name="ri:external-link-line" class="text-[10px]" />
              </a>

              <button
                v-if="keyItem.raw_error"
                type="button"
                class="text-[10px] px-2 py-0.5 bg-black/40 hover:bg-black/60 text-slate-400 hover:text-slate-200 border border-white/10 rounded-md font-mono transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
                :title="
                  keyItem.showRawError
                    ? 'Hide technical details'
                    : 'Show technical details'
                "
                @click="keyItem.showRawError = !keyItem.showRawError"
              >
                {{ keyItem.showRawError ? 'Hide Details' : 'Details' }}
                <Icon
                  :name="
                    keyItem.showRawError
                      ? 'ri:arrow-up-s-line'
                      : 'ri:arrow-down-s-line'
                  "
                  class="text-xs"
                />
              </button>
            </div>
          </div>

          <!-- Expandable Raw Error Codeblock -->
          <div
            v-if="keyItem.showRawError && keyItem.raw_error"
            class="mt-1 p-2 rounded-lg bg-[#08090d] border text-[10px] font-mono text-slate-400 overflow-x-auto select-all max-h-32 custom-scrollbar"
            :class="
              keyItem.status === 'unavailable'
                ? 'border-amber-500/25'
                : 'border-red-500/20'
            "
          >
            {{ keyItem.raw_error }}
          </div>
        </div>
      </div>

      <!-- Empty state if all keys removed -->
      <div
        v-if="keysList.length === 0"
        :key="'empty'"
        class="p-6 rounded-xl border border-dashed border-surface-border bg-surface-dark/10 text-center flex flex-col items-center justify-center gap-2"
      >
        <p class="text-xs text-slate-500">
          No API keys configured. Gemini features will not be available.
        </p>
        <button
          type="button"
          class="px-3.5 py-1.5 bg-surface-card border border-surface-border hover:border-accent-500/50 text-white rounded-lg text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          @click="emit('addKey')"
        >
          Add API Key
        </button>
      </div>
    </TransitionGroup>

    <!-- Bottom Action Toolbar -->
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-surface-border/40"
    >
      <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
        <Icon name="ri:shield-check-line" class="text-accent-500 text-xs" />
        <span
          >Saved locally to
          <code class="text-slate-400 font-mono">.env</code></span
        >
      </div>

      <div
        class="flex items-center gap-2.5 sm:ml-auto w-full sm:w-auto justify-end"
      >
        <!-- Unsaved Status Pill -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-x-2"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 translate-x-2"
        >
          <span
            v-if="hasUnsavedChanges"
            class="text-[10px] text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md shrink-0"
          >
            <span
              class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"
            ></span>
            Unsaved changes
          </span>
        </Transition>

        <!-- Save Keys Button -->
        <button
          v-if="keysList.length > 0"
          type="button"
          class="px-3.5 py-1.5 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 shadow-sm"
          @click="emit('saveApiKeys')"
        >
          Save Keys
        </button>

        <!-- Test Connections Button -->
        <button
          v-if="keysList.length > 0"
          type="button"
          :disabled="testingKey"
          class="px-3.5 py-1.5 bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 shadow-sm"
          @click="emit('testApiKeys')"
        >
          <Icon name="ri:flashlight-fill" class="text-xs" />
          {{ testingKey ? 'Testing...' : 'Test Connections' }}
        </button>
      </div>
    </div>

    <!-- Live Test Result Banner -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="testBannerMeta"
        class="p-3 rounded-xl border text-xs leading-normal flex items-start gap-2.5"
        :class="testBannerMeta.containerClass"
      >
        <Icon
          :name="testBannerMeta.icon"
          class="text-base shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <span class="font-bold block mb-0.5">{{ testBannerMeta.title }}</span>
          <p class="text-slate-300 text-[11px]">
            {{ testResult.message }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { KeyListItem } from '../HomeSettings.vue';
import type {
  GeminiKeyTestResultStatus,
  HookDiscoveryModelId,
  HookDiscoveryModelOption
} from '../../types/clipper';
import {
  DEFAULT_HOOK_DISCOVERY_MODEL,
  HOOK_DISCOVERY_MODELS,
  getHookDiscoveryModelOption,
  normalizeHookDiscoveryModel
} from '../../utils/hookDiscoveryModels';

const keysList = defineModel<KeyListItem[]>('keysList', { required: true });

const props = withDefaults(
  defineProps<{
    selectedModel?: HookDiscoveryModelId;
    modelOptions?: readonly HookDiscoveryModelOption[];
    savingModel?: boolean;
    modelSaveError?: string;
    hasUnsavedChanges: boolean;
    testingKey: boolean;
    testResult: {
      status: GeminiKeyTestResultStatus;
      message: string;
    };
    draggedIndex: number | null;
  }>(),
  {
    selectedModel: DEFAULT_HOOK_DISCOVERY_MODEL,
    modelOptions: () => HOOK_DISCOVERY_MODELS,
    savingModel: false,
    modelSaveError: ''
  }
);

const emit = defineEmits<{
  (e: 'selectModel', modelId: HookDiscoveryModelId): void;
  (e: 'addKey'): void;
  (e: 'removeKey', index: number): void;
  (e: 'moveKey', index: number, direction: number): void;
  (e: 'dragStart', index: number, event: DragEvent): void;
  (e: 'dragEnter', index: number): void;
  (e: 'dragEnd'): void;
  (e: 'saveApiKeys'): void;
  (e: 'testApiKeys'): void;
}>();

const resolvedModelOptions = computed(() =>
  props.modelOptions.length > 0 ? props.modelOptions : HOOK_DISCOVERY_MODELS
);

const activeModelId = computed(() =>
  normalizeHookDiscoveryModel(props.selectedModel)
);

const activeModelOption = computed(() => {
  const fromProp = resolvedModelOptions.value.find(
    m => m.id === activeModelId.value
  );
  return fromProp ?? getHookDiscoveryModelOption(activeModelId.value);
});

const TEST_BANNER_META: Record<
  Exclude<GeminiKeyTestResultStatus, 'idle'>,
  { containerClass: string; icon: string; title: string }
> = {
  valid: {
    containerClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    icon: 'ri:checkbox-circle-fill',
    title: 'Gemini API keys verified successfully'
  },
  unavailable: {
    containerClass: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
    icon: 'ri:cloud-off-line',
    title: 'Gemini service temporarily unavailable'
  },
  invalid: {
    containerClass: 'bg-red-500/10 border-red-500/20 text-red-400',
    icon: 'ri:error-warning-fill',
    title: 'Connection check failed'
  }
};

const testBannerMeta = computed(() => {
  if (props.testResult.status === 'idle') return null;
  return TEST_BANNER_META[props.testResult.status];
});

function handleModelChange(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  if (!target) return;
  emit('selectModel', normalizeHookDiscoveryModel(target.value));
}
</script>

<style scoped>
/* Progressive enhancement for Customizable Select in Chromium 135+ / Safari 27+ */
@supports (appearance: base-select) {
  .hook-model-select,
  .hook-model-select::picker(select) {
    appearance: base-select;
  }

  .hook-model-select::picker-icon {
    display: none;
  }

  .hook-model-select::picker(select) {
    background-color: #0c0e14;
    border: 1px solid #27272a;
    border-radius: 0;
    color: #f1f5f9;
    padding: 0.25rem;
  }

  .hook-model-select option {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
  }

  .hook-model-select option::checkmark {
    color: #ffd700;
  }
}

/* FLIP list transition for reordering fallback key cards */
.list-keys-move,
.list-keys-enter-active,
.list-keys-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.list-keys-enter-from,
.list-keys-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.list-keys-leave-active {
  position: absolute;
  left: 0;
  right: 0;
}
</style>
