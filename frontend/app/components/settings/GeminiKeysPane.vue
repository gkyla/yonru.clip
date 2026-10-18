<template>
  <div id="settings-api" key="api" class="scroll-mt-24 flex flex-col gap-6">
    <div>
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          <Icon name="ri:key-2-fill" class="text-accent-500" />
          <span>Gemini API Keys</span>
        </h3>

        <button
          v-if="keysList.length > 0"
          class="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer shadow-sm"
          @click="emit('addKey')"
        >
          <Icon name="ri:add-line" class="text-accent-500 text-sm" />
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
                :disabled="index === 0"
                class="p-0.5 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer flex items-center justify-center"
                title="Move Up"
                @click="emit('moveKey', index, -1)"
              >
                <Icon name="ri:arrow-up-s-line" class="text-xs" />
              </button>
              <button
                :disabled="index === keysList.length - 1"
                class="p-0.5 text-slate-500 hover:text-white transition-colors disabled:opacity-20 disabled:hover:text-slate-500 cursor-pointer flex items-center justify-center"
                title="Move Down"
                @click="emit('moveKey', index, 1)"
              >
                <Icon name="ri:arrow-down-s-line" class="text-xs" />
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
                placeholder="Label (e.g. Work Key)"
                class="w-full bg-[#0c0e14] border border-surface-border/60 hover:border-slate-700 focus:border-accent-500/50 text-slate-200 placeholder-slate-600 px-2.5 py-1.5 rounded-lg focus:outline-none text-xs"
              />
            </div>

            <!-- Key input with eye toggle -->
            <div class="w-full sm:flex-1 relative">
              <input
                v-model="keyItem.value"
                :type="keyItem.show ? 'text' : 'password'"
                placeholder="AIzaSy..."
                class="w-full bg-[#0c0e14] border border-surface-border/60 hover:border-slate-700 focus:border-accent-500/50 text-white placeholder-slate-600 px-2.5 py-1.5 rounded-lg focus:outline-none font-mono text-xs pr-8"
              />
              <button
                class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
                :title="keyItem.show ? 'Hide key' : 'Reveal key'"
                @click="keyItem.show = !keyItem.show"
              >
                <Icon
                  :name="keyItem.show ? 'ri:eye-off-line' : 'ri:eye-line'"
                  class="text-xs"
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
                  'bg-slate-500': keyItem.status === 'idle',
                  'bg-amber-400': keyItem.status === 'testing'
                }"
              ></span>
              {{
                keyItem.status === 'valid'
                  ? 'Valid'
                  : keyItem.status === 'invalid'
                    ? 'Invalid'
                    : keyItem.status === 'testing'
                      ? 'Testing...'
                      : 'Not Tested'
              }}
            </span>

            <!-- Delete Button -->
            <button
              class="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded hover:bg-red-500/10"
              title="Remove Key"
              @click="emit('removeKey', index)"
            >
              <Icon name="ri:delete-bin-6-line" class="text-xs" />
            </button>
          </div>
        </div>

        <!-- Micro Error Drawer (Expanded only when status is invalid) -->
        <div
          v-if="keyItem.status === 'invalid' && keyItem.error"
          class="pt-2 border-t border-red-500/20 flex flex-col gap-2 bg-red-500/5 -mx-3 -mb-3 p-3 rounded-b-xl"
        >
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
          >
            <div class="flex items-start gap-1.5 min-w-0">
              <Icon
                name="ri:error-warning-line"
                class="text-sm shrink-0 mt-0.5 text-red-400"
              />
              <span
                class="text-[11px] leading-relaxed text-red-300 font-medium"
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
                class="text-[10px] px-2 py-0.5 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer"
                title="Open Google AI Studio"
              >
                AI Studio
                <Icon name="ri:external-link-line" class="text-[10px]" />
              </a>

              <button
                v-if="keyItem.raw_error"
                class="text-[10px] px-2 py-0.5 bg-black/40 hover:bg-black/60 text-slate-400 hover:text-slate-200 border border-white/10 rounded-md font-mono transition-colors flex items-center gap-1 cursor-pointer"
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
            class="mt-1 p-2 rounded-lg bg-[#08090d] border border-red-500/20 text-[10px] font-mono text-slate-400 overflow-x-auto select-all max-h-32 custom-scrollbar"
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
          class="px-3.5 py-1.5 bg-surface-card border border-surface-border hover:border-accent-500/50 text-white rounded-lg text-xs font-medium transition-all cursor-pointer"
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
          class="px-3.5 py-1.5 bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg transition-all shrink-0 cursor-pointer shadow-sm"
          @click="emit('saveApiKeys')"
        >
          Save Keys
        </button>

        <!-- Test Connections Button -->
        <button
          v-if="keysList.length > 0"
          :disabled="testingKey"
          class="px-3.5 py-1.5 bg-accent-500 hover:bg-accent-400 text-black font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0 cursor-pointer shadow-sm"
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
        v-if="testResult.status !== 'idle'"
        class="p-3 rounded-xl border text-xs leading-normal flex items-start gap-2.5"
        :class="
          testResult.status === 'valid'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        "
      >
        <Icon
          :name="
            testResult.status === 'valid'
              ? 'ri:checkbox-circle-fill'
              : 'ri:error-warning-fill'
          "
          class="text-base shrink-0 mt-0.5"
        />
        <div>
          <span class="font-bold block mb-0.5">{{
            testResult.status === 'valid'
              ? 'Gemini API keys verified successfully'
              : 'Connection check failed'
          }}</span>
          <p class="text-slate-300 text-[11px]">
            {{ testResult.message }}
          </p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { KeyListItem } from '../HomeSettings.vue';

const keysList = defineModel<KeyListItem[]>('keysList', { required: true });

const props = defineProps<{
  hasUnsavedChanges: boolean;
  testingKey: boolean;
  testResult: {
    status: 'idle' | 'valid' | 'invalid';
    message: string;
  };
  draggedIndex: number | null;
}>();

const emit = defineEmits<{
  (e: 'addKey'): void;
  (e: 'removeKey', index: number): void;
  (e: 'moveKey', index: number, direction: number): void;
  (e: 'dragStart', index: number, event: DragEvent): void;
  (e: 'dragEnter', index: number): void;
  (e: 'dragEnd'): void;
  (e: 'saveApiKeys'): void;
  (e: 'testApiKeys'): void;
}>();
</script>

<style scoped>
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
