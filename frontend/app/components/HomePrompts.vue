<template>
  <div class="w-full max-w-5xl z-10 flex flex-col mt-6 mb-10 gap-5">
    <!-- Header Section -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/50 pb-5"
    >
      <div>
        <h2 class="text-3xl font-bold tracking-tight text-white mb-1">
          Prompt Templates
        </h2>
        <p class="text-slate-400 text-sm">
          Design and fine-tune your AI analysis configurations.
        </p>
      </div>
      <!-- Quick "+ Create New" button -->
      <button
        class="px-4 py-2.5 bg-accent-500 hover:bg-accent-400 text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(255,215,0,0.15)] active:scale-95 flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        :class="{ 'ring-2 ring-accent-500/50': isCreatingNew && !editingId }"
        @click="startNewPrompt"
      >
        <Icon name="ri:add-line" class="text-sm font-bold" />
        Create New
      </button>
    </div>

    <!-- Clean, Non-Technical Info Callout -->
    <div
      class="bg-surface-panel border border-surface-border rounded-2xl p-4 flex items-start gap-3.5 text-xs shadow-sm"
    >
      <div
        class="p-2 rounded-xl bg-accent-500/10 border border-accent-500/20 text-accent-500 shrink-0 mt-0.5"
      >
        <Icon name="ri:lightbulb-line" class="text-base" />
      </div>
      <div class="flex-1 min-w-0">
        <span class="font-bold text-white text-xs block mb-0.5"
          >Kustomisasi Gaya Prompt</span
        >
        <p class="text-slate-400 text-xs leading-relaxed">
          Tentukan gaya bahasa, kepribadian, atau sudut pandang hook yang Anda
          targetkan (misal: format debat, studi kasus, atau punchline lucu).
        </p>
      </div>
    </div>

    <!-- Main Workspace: Split Pane -->
    <div class="flex flex-col lg:flex-row gap-5 items-start w-full">
      <!-- Left Column: Search & Templates List -->
      <PromptTemplateList
        :prompts="state.promptsList.value"
        :selected-id="editingId"
        :search-query="searchQuery"
        @update:search-query="searchQuery = $event"
        @select="onSelectPrompt"
      />

      <!-- Right Column: Editor Detail Canvas -->
      <PromptDetailCanvas
        :editing-id="editingId"
        :is-creating-new="isCreatingNew"
        :prompt-name="promptName"
        :suitable-for="suitableFor"
        :prompt-text="promptText"
        :is-dirty="isDirty"
        :is-switching-prompt="isSwitchingPrompt"
        :suggested-tags="suggestedTags"
        @update:prompt-name="promptName = $event"
        @update:prompt-text="promptText = $event"
        @start-new="onStartNewPrompt"
        @delete="showDeleteModal = true"
        @revert="onRevertClick"
        @cancel="onCancelNewPrompt"
        @save="handleSaveButtonClick"
        @add-tag="addTag"
        @remove-tag="removeTag"
      />
    </div>

    <!-- Modals -->
    <PromptUnsavedModal
      :show="showUnsavedModal"
      :prompt-name="promptName"
      :pending-action-description="pendingActionDescription"
      :can-save="Boolean(promptName && promptText)"
      @keep-editing="keepEditing"
      @save-and-proceed="confirmSaveAndProceed"
      @discard-and-proceed="confirmDiscardAndProceed"
    />

    <PromptRevertModal
      :show="showRevertModal"
      :prompt-name="promptName"
      @close="showRevertModal = false"
      @confirm="executeRevertPrompt"
    />

    <PromptDiscardNewModal
      :show="showDiscardNewModal"
      :prompt-name="promptName"
      @close="showDiscardNewModal = false"
      @confirm="confirmDiscardNew"
    />

    <PromptDeleteModal
      :show="showDeleteModal"
      :prompt-name="promptName"
      @close="showDeleteModal = false"
      @confirm="executeDeletePrompt"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import PromptTemplateList, {
  type PromptTemplateItem
} from './prompts/PromptTemplateList.vue';
import PromptDetailCanvas from './prompts/PromptDetailCanvas.vue';
import PromptUnsavedModal from './prompts/PromptUnsavedModal.vue';
import PromptRevertModal from './prompts/PromptRevertModal.vue';
import PromptDiscardNewModal from './prompts/PromptDiscardNewModal.vue';
import PromptDeleteModal from './prompts/PromptDeleteModal.vue';

const state = useClipperState();
const API_BASE = resolveApiBase();

const editingId = ref<string | null>(null);
const isCreatingNew = ref(false);

const promptName = ref('');
const suitableFor = ref<string[]>([]);
const promptText = ref('');
const numHooks = ref(10);
const autoHooks = ref(true);

// Baseline Snapshot & Dirty State Tracking
interface PromptSnapshot {
  name: string;
  suitableFor: string[];
  prompt: string;
}

const baselineSnapshot = ref<PromptSnapshot | null>(null);
const showUnsavedModal = ref(false);
const showRevertModal = ref(false);
const showDiscardNewModal = ref(false);
const showDeleteModal = ref(false);

type PendingAction =
  | { type: 'switch_prompt'; prompt: PromptTemplateItem }
  | { type: 'create_new' }
  | { type: 'cancel_edit' }
  | { type: 'route_leave'; to: string };

const pendingAction = ref<PendingAction | null>(null);

function updateBaselineSnapshot() {
  baselineSnapshot.value = {
    name: promptName.value,
    suitableFor: [...suitableFor.value],
    prompt: promptText.value
  };
}

function normalizePromptText(text: string): string {
  return (text || '').replace(/<p><\/p>/g, '').trim();
}

const isDirty = computed(() => {
  if (!editingId.value && !isCreatingNew.value) return false;
  if (!baselineSnapshot.value) return false;

  const nameChanged =
    promptName.value.trim() !== baselineSnapshot.value.name.trim();
  const textChanged =
    normalizePromptText(promptText.value) !==
    normalizePromptText(baselineSnapshot.value.prompt);
  const currentTags = [...suitableFor.value]
    .map(t => t.trim())
    .filter(Boolean)
    .sort()
    .join(',');
  const baselineTags = [...baselineSnapshot.value.suitableFor]
    .map(t => t.trim())
    .filter(Boolean)
    .sort()
    .join(',');
  const tagsChanged = currentTags !== baselineTags;

  return nameChanged || textChanged || tagsChanged;
});

const pendingActionDescription = computed(() => {
  if (!pendingAction.value) return '';
  if (pendingAction.value.type === 'switch_prompt') {
    return `Switch to "${pendingAction.value.prompt.name}"`;
  }
  if (pendingAction.value.type === 'create_new') {
    return 'Create New Template';
  }
  if (pendingAction.value.type === 'cancel_edit') {
    return 'Cancel & Close Editor';
  }
  if (pendingAction.value.type === 'route_leave') {
    return `Navigate to ${pendingAction.value.to}`;
  }
  return '';
});

// Search State
const searchQuery = ref('');

// Switch Animation State
const isSwitchingPrompt = ref(false);
let switchTimer: ReturnType<typeof setTimeout> | null = null;

function triggerSwitchAnimation() {
  isSwitchingPrompt.value = false;
  nextTick(() => {
    isSwitchingPrompt.value = true;
    if (switchTimer) clearTimeout(switchTimer);
    switchTimer = setTimeout(() => {
      isSwitchingPrompt.value = false;
    }, 280);
  });
}

// Suggested tags from other templates
const suggestedTags = computed(() => {
  const allTags = new Set<string>();
  (state.promptsList.value as PromptTemplateItem[]).forEach(
    (p: PromptTemplateItem) => {
      (p.suitableFor || []).forEach((t: string) => {
        const clean = t.trim();
        if (clean && !suitableFor.value.includes(clean)) {
          allTags.add(clean);
        }
      });
    }
  );
  return Array.from(allTags).slice(0, 8);
});

// Browser Unload Guard
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
}

// Router Navigation Guard Handler (Invoked by page route guard)
function handleRouteLeave(
  to: string | { fullPath?: string; path?: string },
  _from?: unknown
): boolean {
  if (isDirty.value) {
    const target = typeof to === 'string' ? to : to.fullPath || to.path || '/';
    pendingAction.value = { type: 'route_leave', to: target };
    showUnsavedModal.value = true;
    return false;
  }
  return true;
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (showUnsavedModal.value) {
      keepEditing();
    } else if (showRevertModal.value) {
      showRevertModal.value = false;
    } else if (showDiscardNewModal.value) {
      showDiscardNewModal.value = false;
    } else if (showDeleteModal.value) {
      showDeleteModal.value = false;
    }
  }
}

onMounted(async () => {
  if (state.promptsList.value.length === 0) {
    await state.fetchPrompts();
  }
  if (
    !editingId.value &&
    !isCreatingNew.value &&
    state.promptsList.value.length > 0
  ) {
    editExistingPrompt(state.promptsList.value[0]);
  }
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
  window.removeEventListener('keydown', handleKeyDown);
});

function addTag(tag: string) {
  const clean = tag.trim();
  if (clean && !suitableFor.value.includes(clean)) {
    suitableFor.value.push(clean);
  }
}

function removeTag(index: number) {
  suitableFor.value.splice(index, 1);
}

// Guarded Interaction Handlers
function onSelectPrompt(p: PromptTemplateItem) {
  if (p.id === editingId.value) return;
  if (isDirty.value) {
    pendingAction.value = { type: 'switch_prompt', prompt: p };
    showUnsavedModal.value = true;
  } else {
    editExistingPrompt(p);
  }
}

function onStartNewPrompt() {
  if (isCreatingNew.value) return;
  if (isDirty.value) {
    pendingAction.value = { type: 'create_new' };
    showUnsavedModal.value = true;
  } else {
    startNewPrompt();
  }
}

function onRevertClick() {
  if (!isDirty.value) return;
  showRevertModal.value = true;
}

function executeRevertPrompt() {
  if (!baselineSnapshot.value) return;
  promptName.value = baselineSnapshot.value.name;
  suitableFor.value = [...baselineSnapshot.value.suitableFor];
  promptText.value = baselineSnapshot.value.prompt;
  showRevertModal.value = false;
  triggerSwitchAnimation();
}

function onCancelNewPrompt() {
  if (isDirty.value) {
    showDiscardNewModal.value = true;
  } else {
    cancelEdit();
  }
}

function confirmDiscardNew() {
  showDiscardNewModal.value = false;
  cancelEdit();
}

function editExistingPrompt(p: PromptTemplateItem) {
  editingId.value = p.id;
  isCreatingNew.value = false;
  promptName.value = p.name;
  suitableFor.value = [...(p.suitableFor || [])];
  promptText.value = p.prompt || '';
  numHooks.value = p.numHooks ?? 10;
  autoHooks.value = p.autoHooks ?? true;
  updateBaselineSnapshot();
  triggerSwitchAnimation();
}

function startNewPrompt() {
  editingId.value = null;
  isCreatingNew.value = true;
  promptName.value = '';
  suitableFor.value = [];
  promptText.value = '';
  numHooks.value = 10;
  autoHooks.value = true;
  updateBaselineSnapshot();
  triggerSwitchAnimation();
}

function cancelEdit() {
  editingId.value = null;
  isCreatingNew.value = false;
  baselineSnapshot.value = null;
}

function executePendingAction() {
  const action = pendingAction.value;
  pendingAction.value = null;
  if (!action) return;

  if (action.type === 'switch_prompt') {
    editExistingPrompt(action.prompt);
  } else if (action.type === 'create_new') {
    startNewPrompt();
  } else if (action.type === 'cancel_edit') {
    cancelEdit();
  } else if (action.type === 'route_leave') {
    cancelEdit();
    try {
      const router = useRouter();
      router.push(action.to);
    } catch {
      window.location.href = action.to;
    }
  }
}

function confirmDiscardAndProceed() {
  showUnsavedModal.value = false;
  executePendingAction();
}

async function confirmSaveAndProceed() {
  if (!promptName.value || !promptText.value) return;
  const success = await savePrompt(false);
  if (success !== false) {
    showUnsavedModal.value = false;
    executePendingAction();
  }
}

function keepEditing() {
  showUnsavedModal.value = false;
  pendingAction.value = null;
}

function handleSaveButtonClick() {
  savePrompt(true);
}

async function savePrompt(keepEditingActive: boolean = true): Promise<boolean> {
  if (!promptName.value || !promptText.value) return false;

  const tags = [...suitableFor.value];

  if (editingId.value) {
    const success = await state.editPrompt(
      editingId.value,
      promptName.value,
      tags,
      promptText.value,
      10,
      true
    );
    if (success) {
      updateBaselineSnapshot();
      return true;
    }
    return false;
  } else {
    try {
      const res = await $fetch<{ id?: string }>(`${API_BASE}/api/prompts/add`, {
        method: 'POST',
        body: {
          promptName: promptName.value,
          suitableFor: tags,
          prompt: promptText.value,
          numHooks: 10,
          autoHooks: true
        }
      });
      state.showToast('Prompt saved successfully', 'success');
      await state.fetchPrompts();
      if (res && res.id) {
        editingId.value = res.id;
        isCreatingNew.value = false;
      }
      updateBaselineSnapshot();
      if (!keepEditingActive) {
        cancelEdit();
      }
      return true;
    } catch {
      state.showToast('Failed to save prompt', 'error');
      return false;
    }
  }
}

async function executeDeletePrompt() {
  if (!editingId.value) return;
  const success = await state.deletePrompt(editingId.value);
  if (success) {
    editingId.value = null;
    isCreatingNew.value = false;
    showDeleteModal.value = false;
    promptName.value = '';
    promptText.value = '';
    suitableFor.value = [];
    numHooks.value = 10;
    autoHooks.value = false;
    baselineSnapshot.value = null;
  }
}

defineExpose({
  isDirty,
  showUnsavedModal,
  showRevertModal,
  showDiscardNewModal,
  showDeleteModal,
  handleRouteLeave,
  keepEditing,
  executeRevertPrompt,
  confirmDiscardNew,
  confirmDiscardAndProceed,
  confirmSaveAndProceed,
  editingId,
  isCreatingNew,
  promptName,
  autoHooks,
  promptText,
  pendingActionDescription,
  onStartNewPrompt,
  startNewPrompt,
  cancelEdit,
  savePrompt,
  executeDeletePrompt
});
</script>

<style scoped>
@keyframes templateFade {
  0% {
    opacity: 0.15;
  }
  100% {
    opacity: 1;
  }
}

.animate-template-crossfade {
  animation: templateFade 280ms ease-out forwards;
}

/* Dialog Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-active .modal-dialog-card,
.modal-fade-leave-active .modal-dialog-card {
  transition:
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-enter-from {
  opacity: 0;
}

.modal-fade-enter-from .modal-dialog-card {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-leave-to .modal-dialog-card {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 0;
}

.custom-horizontal-scrollbar::-webkit-scrollbar {
  height: 4px;
}
.custom-horizontal-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
</style>
