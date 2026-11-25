<template>
  <div id="settings-api" key="api" class="scroll-mt-24 flex flex-col gap-4">
    <div>
      <h2 class="text-base font-bold text-white mb-0.5 flex items-center gap-2">
        <Icon
          name="ri:equalizer-line"
          class="text-accent-500"
          aria-hidden="true"
        />
        <span>AI Model</span>
      </h2>
      <p class="text-xs text-slate-400">
        Select the Hook Discovery Model and manage Gemini API failover keys.
      </p>
    </div>

    <!-- Hook Discovery Model Selection -->
    <section
      aria-labelledby="hook-discovery-model-label"
      class="p-3.5 border bg-surface-dark/40 border-surface-border flex flex-col gap-2.5"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <label
          id="hook-discovery-model-label"
          for="hook-discovery-model-select"
          class="text-[13px] font-semibold text-white"
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
              class="motion-safe:animate-spin text-xs"
              aria-hidden="true"
            />
            <span>Saving...</span>
          </span>
          <span class="text-slate-300">
            Provider:
            <span class="text-white font-medium">
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
          class="hook-model-select w-full [@media(pointer:coarse)]:min-h-[44px] bg-[#0c0e14] border border-surface-border hover:border-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 text-white text-xs font-medium pl-3 pr-9 py-2 appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
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
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"
        />
      </div>

      <div id="hook-discovery-model-desc" class="flex flex-col gap-2">
        <p class="text-xs text-slate-300 leading-relaxed max-w-[72ch]">
          {{ activeModelOption.desc }}
        </p>

        <div
          class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-border/60 text-xs"
        >
          <div class="flex flex-wrap items-center gap-2">
            <code
              class="font-mono text-[11px] text-slate-200 bg-surface-dark border border-surface-border px-1.5 py-0.5 whitespace-nowrap"
            >
              {{ activeModelOption.id }}
            </code>
            <span class="text-slate-300">
              {{ activeModelOption.quotaNote }}
            </span>
          </div>

          <a
            href="https://aistudio.google.com/rate-limit"
            target="_blank"
            rel="noopener noreferrer"
            class="text-slate-200 hover:text-accent-400 underline underline-offset-4 decoration-slate-500 hover:decoration-accent-400 transition-colors inline-flex items-center gap-1 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 whitespace-nowrap"
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
        class="p-2.5 border border-red-500/35 bg-red-500/10 text-xs text-red-200 flex items-center gap-2"
      >
        <Icon
          name="ri:error-warning-line"
          aria-hidden="true"
          class="text-sm text-red-400 shrink-0"
        />
        <span>{{ modelSaveError }}</span>
      </div>
    </section>

    <hr class="border-surface-border/60" />

    <!-- Gemini API Keys Section -->
    <div>
      <div class="flex flex-wrap justify-between items-center gap-2.5 mb-1">
        <h3 class="text-sm font-bold text-white flex items-center gap-2">
          <Icon
            name="ri:key-2-fill"
            class="text-accent-500"
            aria-hidden="true"
          />
          <span>Gemini API Keys</span>
        </h3>

        <button
          v-if="keysList.length > 0"
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-600 text-slate-200 hover:text-white text-xs font-medium transition-colors shrink-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
          @click="emit('addKey')"
        >
          <Icon
            name="ri:add-line"
            class="text-accent-500 text-xs"
            aria-hidden="true"
          />
          <span>Add Fallback Key</span>
        </button>
      </div>
      <p class="text-xs text-slate-400 leading-relaxed">
        Add fallback Gemini API keys for automatic failover. The first valid key
        is used as Primary.
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
        class="group p-2.5 border bg-surface-dark/40 border-surface-border hover:border-slate-600 transition-colors flex flex-col gap-2"
        :class="{
          'border-accent-500 bg-accent-500/5': keyItem.activeFlash,
          'opacity-40 border-dashed border-accent-500/60 bg-accent-500/5 cursor-grabbing':
            index === draggedIndex
        }"
        @dragstart="emit('dragStart', index, $event)"
        @dragover.prevent
        @dragenter="emit('dragEnter', index)"
        @dragend="emit('dragEnd')"
      >
        <div
          class="flex flex-col lg:flex-row lg:items-center justify-between gap-2"
        >
          <!-- Priority, Reorder Controls -->
          <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
            <span
              class="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-200 flex items-center justify-center w-5 h-7"
              title="Drag to reorder"
              aria-hidden="true"
            >
              <Icon name="ri:draggable" class="text-sm" />
            </span>

            <span
              class="text-[11px] font-semibold px-2 py-0.5 border min-w-[84px] text-center select-none"
              :class="
                index === 0
                  ? 'bg-accent-500/10 border-accent-500/35 text-accent-400'
                  : 'bg-surface-dark border-surface-border text-slate-300'
              "
            >
              #{{ index + 1 }} {{ index === 0 ? 'Primary' : 'Fallback' }}
            </span>

            <div
              class="flex items-center border border-surface-border bg-surface-dark shrink-0"
            >
              <button
                type="button"
                :disabled="index === 0"
                class="h-7 w-7 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] text-slate-300 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-[-2px]"
                :aria-label="`Move key ${index + 1} up`"
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
                class="h-7 w-7 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] border-l border-surface-border text-slate-300 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-[-2px]"
                :aria-label="`Move key ${index + 1} down`"
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

          <!-- Label & Secret Input -->
          <div
            class="flex-1 flex flex-col sm:flex-row items-stretch gap-2 min-w-0"
          >
            <div class="w-full sm:w-1/3 min-w-[110px]">
              <input
                v-model="keyItem.title"
                type="text"
                :name="`key_title_${index}`"
                :aria-label="`Label for key ${index + 1}`"
                placeholder="Label (e.g. Work)"
                class="w-full [@media(pointer:coarse)]:min-h-[44px] bg-[#0c0e14] border border-surface-border hover:border-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 text-slate-100 placeholder-slate-500 px-2.5 py-1.5 text-xs"
              />
            </div>

            <div class="w-full sm:flex-1 relative flex items-center">
              <input
                v-model="keyItem.value"
                :type="keyItem.show ? 'text' : 'password'"
                :name="`key_value_${index}`"
                :aria-label="`Gemini API key value ${index + 1}`"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                placeholder="AIzaSy..."
                class="w-full [@media(pointer:coarse)]:min-h-[44px] bg-[#0c0e14] border border-surface-border hover:border-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2 text-white placeholder-slate-500 pl-2.5 pr-9 py-1.5 font-mono text-xs"
              />
              <button
                type="button"
                class="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-[-2px]"
                :aria-label="
                  keyItem.show
                    ? `Hide key ${index + 1}`
                    : `Reveal key ${index + 1}`
                "
                :aria-pressed="keyItem.show"
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

          <!-- Status Label & Remove Action -->
          <div class="flex items-center justify-end gap-1.5 shrink-0">
            <span
              class="text-[11px] px-2 py-0.5 font-medium border whitespace-nowrap"
              :class="{
                'bg-emerald-500/10 border-emerald-500/30 text-emerald-300':
                  keyItem.status === 'valid',
                'bg-red-500/10 border-red-500/30 text-red-300':
                  keyItem.status === 'invalid',
                'bg-amber-500/10 border-amber-500/30 text-amber-200':
                  keyItem.status === 'unavailable' ||
                  keyItem.status === 'testing',
                'bg-surface-dark border-surface-border text-slate-300':
                  keyItem.status === 'idle'
              }"
            >
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

            <button
              type="button"
              class="h-7 w-7 [@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:min-w-[44px] flex items-center justify-center border border-surface-border bg-surface-dark text-slate-300 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
              :aria-label="`Remove key ${index + 1}`"
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

        <!-- Inline Error Drawer -->
        <div
          v-if="
            (keyItem.status === 'invalid' ||
              keyItem.status === 'unavailable') &&
            keyItem.error
          "
          role="alert"
          class="border-t flex flex-col gap-2 p-2.5"
          :class="
            keyItem.status === 'unavailable'
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-red-500/30 bg-red-500/10'
          "
        >
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div class="flex items-start gap-2 min-w-0">
              <Icon
                name="ri:error-warning-line"
                class="text-sm shrink-0 mt-0.5"
                :class="
                  keyItem.status === 'unavailable'
                    ? 'text-amber-300'
                    : 'text-red-400'
                "
                aria-hidden="true"
              />
              <span
                class="text-xs leading-relaxed font-medium"
                :class="
                  keyItem.status === 'unavailable'
                    ? 'text-amber-100'
                    : 'text-red-200'
                "
              >
                {{ keyItem.error }}
              </span>
            </div>

            <div
              class="flex items-center gap-1.5 shrink-0 self-start sm:self-center"
            >
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[11px] px-2 py-1 font-medium border transition-colors inline-flex items-center gap-1 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
                :class="
                  keyItem.status === 'unavailable'
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-100 border-amber-500/35'
                    : 'bg-red-500/15 hover:bg-red-500/25 text-red-100 border-red-500/35'
                "
              >
                <span>AI Studio</span>
                <Icon
                  name="ri:external-link-line"
                  class="text-xs"
                  aria-hidden="true"
                />
              </a>

              <button
                v-if="keyItem.raw_error"
                type="button"
                :aria-expanded="Boolean(keyItem.showRawError)"
                class="text-[11px] px-2 py-1 bg-surface-dark hover:bg-surface-card text-slate-200 hover:text-white border border-surface-border font-mono transition-colors inline-flex items-center gap-1 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
                @click="keyItem.showRawError = !keyItem.showRawError"
              >
                <span>{{
                  keyItem.showRawError ? 'Hide Details' : 'Details'
                }}</span>
                <Icon
                  :name="
                    keyItem.showRawError
                      ? 'ri:arrow-up-s-line'
                      : 'ri:arrow-down-s-line'
                  "
                  class="text-xs"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <div
            v-if="keyItem.showRawError && keyItem.raw_error"
            class="mt-1 p-2 bg-[#08090d] border text-[11px] font-mono text-slate-300 overflow-x-auto select-all max-h-28 custom-scrollbar"
            :class="
              keyItem.status === 'unavailable'
                ? 'border-amber-500/30'
                : 'border-red-500/30'
            "
          >
            {{ keyItem.raw_error }}
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="keysList.length === 0"
        :key="'empty'"
        class="p-4 border border-dashed border-surface-border bg-surface-dark/20 text-center flex flex-col items-center justify-center gap-2.5"
      >
        <p class="text-xs text-slate-300">
          No API keys configured. Add a Gemini API key to enable AI hook
          discovery.
        </p>
        <button
          type="button"
          class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-card border border-surface-border hover:border-accent-500/60 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
          @click="emit('addKey')"
        >
          Add API Key
        </button>
      </div>
    </TransitionGroup>

    <!-- Bottom Action Toolbar -->
    <div
      v-if="keysList.length > 0 || hasUnsavedChanges"
      class="flex flex-wrap justify-end items-center gap-2 pt-2.5 border-t border-surface-border/60"
    >
      <span
        v-if="hasUnsavedChanges"
        role="status"
        class="text-[11px] text-amber-300 flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 px-2 py-1 shrink-0"
      >
        <span>Unsaved changes</span>
      </span>

      <button
        v-if="keysList.length > 0"
        type="button"
        class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-600 text-slate-200 hover:text-white font-medium text-xs transition-colors shrink-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('saveApiKeys')"
      >
        Save Keys
      </button>

      <button
        v-if="keysList.length > 0"
        type="button"
        :disabled="testingKey"
        class="px-3 py-1.5 [@media(pointer:coarse)]:min-h-[44px] bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        @click="emit('testApiKeys')"
      >
        <Icon
          :name="testingKey ? 'ri:loader-4-line' : 'ri:checkbox-circle-line'"
          :class="{ 'motion-safe:animate-spin': testingKey }"
          class="text-xs"
          aria-hidden="true"
        />
        <span>{{ testingKey ? 'Testing...' : 'Test Connections' }}</span>
      </button>
    </div>

    <!-- Live Test Result Banner -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="testBannerMeta"
        :role="testResult.status === 'invalid' ? 'alert' : 'status'"
        class="p-3 border text-xs leading-normal flex items-start gap-2"
        :class="testBannerMeta.containerClass"
      >
        <Icon
          :name="testBannerMeta.icon"
          class="text-base shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <span class="font-bold block mb-0.5">{{ testBannerMeta.title }}</span>
          <p class="text-slate-200 text-xs">
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
  (e: 'removeKey' | 'dragEnter', index: number): void;
  (e: 'moveKey', index: number, direction: number): void;
  (e: 'dragStart', index: number, event: DragEvent): void;
  (e: 'addKey' | 'dragEnd' | 'saveApiKeys' | 'testApiKeys'): void;
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
    containerClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    icon: 'ri:checkbox-circle-fill',
    title: 'Gemini API keys verified successfully'
  },
  unavailable: {
    containerClass: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
    icon: 'ri:cloud-off-line',
    title: 'Gemini service temporarily unavailable'
  },
  invalid: {
    containerClass: 'bg-red-500/10 border-red-500/35 text-red-200',
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
@media (prefers-reduced-motion: no-preference) {
  .list-keys-move,
  .list-keys-enter-active,
  .list-keys-leave-active {
    transition: all 0.25s ease;
  }

  .list-keys-enter-from,
  .list-keys-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }

  .list-keys-leave-active {
    position: absolute;
    left: 0;
    right: 0;
  }
}
</style>
