<template>
  <dialog
    ref="dialogRef"
    data-testid="self-update-dialog"
    aria-labelledby="self-update-dialog-title"
    :closedby="isProgressView ? 'none' : 'closerequest'"
    class="self-update-dialog bg-surface-panel text-slate-100 border border-white/15 rounded-2xl p-0 w-[calc(100%-2rem)] max-w-lg shadow-2xl m-auto"
    @cancel="handleCancel"
    @close="handleNativeClose"
  >
    <div class="p-6 flex flex-col gap-5">
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span
            class="self-start text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-accent-500/15 border border-accent-500/35 text-accent-300 font-mono"
          >
            v{{ targetVersion }}
          </span>
          <h2
            id="self-update-dialog-title"
            class="text-lg font-bold text-white tracking-tight"
          >
            {{ dialogTitle }}
          </h2>
        </div>

        <button
          v-if="canDismiss"
          type="button"
          aria-label="Close update dialog"
          class="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          @click="emit('close')"
        >
          <Icon name="lucide:x" class="text-base" aria-hidden="true" />
        </button>
      </div>

      <!-- Failure / Timeout / Rollback Recovery View -->
      <template v-if="isErrorRecoveryView">
        <div
          role="alert"
          class="rounded-xl bg-rose-500/10 border border-rose-500/35 px-4 py-3 text-xs sm:text-sm text-rose-200 flex flex-col gap-1.5"
        >
          <p class="font-semibold text-rose-100 m-0">
            {{ recoveryHeading }}
          </p>
          <p class="m-0 text-rose-200/90 break-words">
            {{ updateError || updateStatus?.message }}
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <p class="text-xs text-slate-400 m-0">
            Your local prompts were kept intact. You can inspect or run the
            release update manually:
          </p>
          <pre
            class="m-0 rounded-xl bg-[#09090b]/90 border border-white/10 px-3.5 py-2.5 overflow-x-auto text-xs font-mono text-slate-200"
          ><code>{{ manualCommand }}</code></pre>
        </div>

        <div class="flex justify-end gap-2.5 pt-1">
          <button
            type="button"
            autofocus
            data-testid="dismiss-self-update-btn"
            class="px-4 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
            @click="emit('dismissFailure')"
          >
            Dismiss
          </button>
        </div>
      </template>

      <!-- Active Update / Restart Progress View -->
      <template v-else-if="isProgressView">
        <div class="flex flex-col gap-3">
          <div
            class="flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-200"
          >
            <span class="font-medium">
              {{
                isReconnecting
                  ? 'Restarting local servers and verifying the new version...'
                  : updateStatus?.message || 'Preparing update...'
              }}
            </span>
            <span class="font-mono text-xs text-accent-300 shrink-0">
              {{ completedStepsCount }}/{{ totalStepsCount }}
            </span>
          </div>

          <progress
            :value="completedStepsCount"
            :max="Math.max(1, totalStepsCount)"
            class="self-update-progress w-full h-2 rounded-full overflow-hidden"
          ></progress>
        </div>

        <ol
          v-if="updateStatus?.steps?.length"
          class="flex flex-col gap-2 m-0 p-0 list-none"
        >
          <li
            v-for="step in updateStatus.steps"
            :key="step.id"
            class="flex items-center gap-3 px-3 py-2 rounded-xl border text-xs sm:text-sm"
            :class="[
              step.status === 'active'
                ? 'bg-accent-500/10 border-accent-500/40 text-white'
                : step.status === 'done'
                  ? 'bg-emerald-500/[0.06] border-emerald-500/25 text-emerald-200'
                  : step.status === 'failed'
                    ? 'bg-rose-500/10 border-rose-500/35 text-rose-200'
                    : 'bg-white/[0.02] border-white/5 text-slate-400'
            ]"
          >
            <Icon
              v-if="step.status === 'done'"
              name="lucide:check-circle-2"
              class="text-base text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <Icon
              v-else-if="step.status === 'active'"
              name="lucide:loader-2"
              class="text-base text-accent-300 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <Icon
              v-else-if="step.status === 'failed'"
              name="lucide:x-circle"
              class="text-base text-rose-400 shrink-0"
              aria-hidden="true"
            />
            <span
              v-else
              class="w-4 h-4 flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
            </span>
            <span class="font-medium">{{ step.label }}</span>
          </li>
        </ol>

        <p class="text-xs text-slate-400 m-0">
          Keep this window open while Yonru installs dependencies and restarts.
          The page will reload automatically once v{{ targetVersion }} is
          verified.
        </p>
      </template>

      <!-- Pre-Flight Confirmation View -->
      <template v-else>
        <p class="text-xs sm:text-sm text-slate-300 m-0">
          Update Yonru Clip from
          <strong class="text-white font-mono">v{{ installedVersion }}</strong>
          to
          <strong class="text-white font-mono">v{{ targetVersion }}</strong
          >. Yonru will pause briefly while services restart and will preserve
          your local prompts.
        </p>

        <div
          v-if="isCheckingPreflight"
          class="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-slate-300"
        >
          <Icon
            name="lucide:loader-2"
            class="text-sm text-accent-300 animate-spin motion-reduce:animate-none shrink-0"
            aria-hidden="true"
          />
          <span>Checking repository, active jobs, and launcher status...</span>
        </div>

        <div
          v-if="blockMessage"
          role="alert"
          class="rounded-xl bg-rose-500/10 border border-rose-500/35 px-3.5 py-2.5 text-xs text-rose-200 flex flex-col gap-2"
        >
          <p class="m-0">{{ blockMessage }}</p>

          <ul
            v-if="preflight?.dirtyFiles?.length"
            data-testid="preflight-dirty-files"
            class="m-0 pl-4 list-disc font-mono text-[11px] text-rose-100/90 space-y-0.5"
          >
            <li v-for="file in displayedDirtyFiles" :key="file">{{ file }}</li>
            <li v-if="extraDirtyFilesCount > 0">
              +{{ extraDirtyFilesCount }} more file(s)
            </li>
          </ul>
        </div>

        <ul
          v-if="preflight?.checks?.length"
          class="flex flex-col gap-2 m-0 p-0 list-none"
        >
          <li
            v-for="check in preflight.checks"
            :key="check.id"
            class="flex items-start gap-2.5 px-3 py-2 rounded-xl border text-xs"
            :class="[
              check.passed
                ? 'bg-emerald-500/[0.06] border-emerald-500/20 text-slate-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            ]"
          >
            <Icon
              :name="check.passed ? 'lucide:check' : 'lucide:alert-circle'"
              class="text-sm shrink-0 mt-0.5"
              :class="check.passed ? 'text-emerald-400' : 'text-rose-400'"
              aria-hidden="true"
            />
            <div class="flex flex-col gap-0.5">
              <span class="font-medium">{{ check.label }}</span>
              <span v-if="check.detail" class="text-[11px] text-slate-300/90">
                {{ check.detail }}
              </span>
            </div>
          </li>
        </ul>

        <div
          v-if="blockMessage"
          data-testid="modal-manual-fallback"
          class="flex flex-col gap-1.5"
        >
          <p class="text-xs text-slate-400 m-0">
            Manual terminal update fallback:
          </p>
          <pre
            class="m-0 rounded-xl bg-[#09090b]/90 border border-white/10 px-3.5 py-2.5 overflow-x-auto text-xs font-mono text-slate-200"
          ><code>{{ manualCommand }}</code></pre>
        </div>

        <div class="flex flex-wrap justify-end gap-2.5 pt-1">
          <button
            type="button"
            autofocus
            data-testid="cancel-self-update-btn"
            class="px-4 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-slate-200 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-self-update-btn"
            :disabled="!canConfirm"
            class="px-4 py-2 min-h-[44px] sm:min-h-[38px] rounded-xl bg-accent-500 hover:bg-accent-400 disabled:opacity-45 disabled:cursor-not-allowed text-black text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
            @click="emit('confirm')"
          >
            Confirm Update
          </button>
        </div>
      </template>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  buildTagManualCommand,
  type SelfUpdatePreflightResponse,
  type SelfUpdateStatusResponse
} from '~/composables/useSelfUpdate';

const MAX_DIRTY_FILES_DISPLAY = 10;

const props = defineProps<{
  open: boolean;
  installedVersion: string;
  targetVersion: string;
  preflight: SelfUpdatePreflightResponse | null;
  preflightError: string | null;
  isCheckingPreflight: boolean;
  updateStatus: SelfUpdateStatusResponse | null;
  isUpdating: boolean;
  isReconnecting: boolean;
  updateError: string | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
  dismissFailure: [];
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);

const isErrorRecoveryView = computed(() => {
  const s = props.updateStatus?.state;
  if (s === 'failed') {
    return true;
  }
  return Boolean(
    !props.isUpdating &&
    props.updateError &&
    (s === 'pending_restart' || s === 'updating' || s === 'restarting')
  );
});

const isProgressView = computed(() => {
  if (isErrorRecoveryView.value) {
    return false;
  }
  const s = props.updateStatus?.state;
  return (
    props.isUpdating ||
    s === 'pending_restart' ||
    s === 'updating' ||
    s === 'restarting'
  );
});

const canDismiss = computed(() => {
  return !isProgressView.value && !isErrorRecoveryView.value;
});

const dialogTitle = computed(() => {
  if (props.updateStatus?.state === 'failed') {
    return 'Self-Update Rolled Back';
  }
  if (isErrorRecoveryView.value) {
    return 'Update Verification Timed Out';
  }
  if (isProgressView.value) {
    return 'Updating Yonru Clip';
  }
  return 'Update Yonru Clip';
});

const recoveryHeading = computed(() => {
  if (props.updateStatus?.rolledBack) {
    const version = props.updateStatus.currentVersion || props.installedVersion;
    return `Yonru rolled back safely to v${version}`;
  }
  if (props.updateStatus?.state === 'failed') {
    return 'Self-update stopped with an error';
  }
  return 'Could not confirm restart completion';
});

const manualCommand = computed(() => {
  return buildTagManualCommand(props.targetVersion);
});

const blockMessage = computed(() => {
  if (props.preflightError) {
    return props.preflightError;
  }
  if (props.updateError) {
    return props.updateError;
  }
  if (props.preflight && !props.preflight.canUpdate) {
    return (
      props.preflight.blockingReason ||
      'Pre-flight checks failed. Use the manual commands below.'
    );
  }
  return null;
});

const displayedDirtyFiles = computed(() => {
  return (props.preflight?.dirtyFiles ?? []).slice(0, MAX_DIRTY_FILES_DISPLAY);
});

const extraDirtyFilesCount = computed(() => {
  const total = props.preflight?.dirtyFiles?.length ?? 0;
  return total > MAX_DIRTY_FILES_DISPLAY ? total - MAX_DIRTY_FILES_DISPLAY : 0;
});

const canConfirm = computed(() => {
  return (
    !props.isCheckingPreflight &&
    !props.isUpdating &&
    Boolean(props.preflight?.canUpdate)
  );
});

const totalStepsCount = computed(() => props.updateStatus?.steps?.length ?? 0);
const completedStepsCount = computed(() => {
  const steps = props.updateStatus?.steps ?? [];
  return steps.filter(step => step.status === 'done').length;
});

function syncNativeDialog(isOpen: boolean): void {
  const dialog = dialogRef.value;
  if (!dialog) {
    return;
  }
  if (isOpen) {
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
    return;
  }
  if (dialog.open) {
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }
}

watch(
  () => props.open,
  async isOpen => {
    await nextTick();
    syncNativeDialog(isOpen);
  },
  { immediate: true, flush: 'post' }
);

function handleCancel(event: Event): void {
  if (isProgressView.value || isErrorRecoveryView.value) {
    event.preventDefault();
    return;
  }
  emit('close');
}

function handleNativeClose(): void {
  if (!isProgressView.value && !isErrorRecoveryView.value) {
    emit('close');
  }
}
</script>

<style scoped>
.self-update-dialog:modal {
  overscroll-behavior: contain;
}

.self-update-dialog::backdrop {
  overflow: hidden;
  overscroll-behavior: contain;
  background: rgba(6, 6, 10, 0.78);
  backdrop-filter: blur(4px);
}

.self-update-progress::-webkit-progress-bar {
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
}

.self-update-progress::-webkit-progress-value {
  background-color: #ffd700;
  border-radius: 9999px;
  transition: width 200ms ease;
}

.self-update-progress::-moz-progress-bar {
  background-color: #ffd700;
  border-radius: 9999px;
}

@media (prefers-reduced-motion: reduce) {
  .self-update-progress::-webkit-progress-value {
    transition: none;
  }
}
</style>
