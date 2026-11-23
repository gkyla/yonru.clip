<template>
  <div ref="rootRef" class="relative select-none" :data-testid="testId">
    <button
      ref="triggerRef"
      type="button"
      :data-testid="`${testId}-trigger`"
      :aria-label="`${label}: ${activeOption?.label ?? ''}`"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      class="min-h-[44px] sm:min-h-[38px] bg-surface-dark border px-3 rounded-none text-xs flex items-center justify-between gap-2.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      :class="[
        triggerClass,
        uppercase ? 'font-bold uppercase tracking-wider' : 'font-medium',
        open
          ? 'border-accent-500/60 text-white'
          : 'border-surface-border text-slate-200 hover:border-white/25 hover:text-white'
      ]"
      @click="toggleOpen"
      @keydown="handleTriggerKeydown"
    >
      <span class="flex items-center gap-2 min-w-0">
        <Icon
          v-if="activeOption?.icon"
          :name="activeOption.icon"
          class="text-accent-500 text-sm shrink-0"
          aria-hidden="true"
        />
        <span class="truncate">{{ activeOption?.label }}</span>
        <span
          v-if="activeOption?.meta"
          class="text-[11px] font-medium tabular-nums text-slate-400 shrink-0"
        >
          ({{ activeOption.meta }})
        </span>
      </span>
      <Icon
        name="ri:arrow-down-s-line"
        class="text-slate-400 text-sm shrink-0 transition-transform duration-200 motion-reduce:transition-none"
        :class="{ 'rotate-180 text-accent-500': open }"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out motion-reduce:transition-none"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in motion-reduce:transition-none"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="open"
        :id="listboxId"
        role="listbox"
        :aria-label="label"
        :data-testid="`${testId}-panel`"
        class="absolute top-full mt-1.5 bg-[#171a21] border border-surface-border rounded-none shadow-2xl py-1 z-50"
        :class="panelClass"
        @keydown="handleListboxKeydown"
      >
        <div class="overflow-y-auto max-h-60 custom-scrollbar">
          <button
            v-for="(opt, idx) in options"
            :key="opt.value"
            :ref="el => setOptionRef(idx, el)"
            type="button"
            role="option"
            :aria-selected="opt.value === modelValue"
            :data-testid="`${testId}-option`"
            :data-value="opt.value"
            :tabindex="idx === focusedIndex ? 0 : -1"
            class="w-full px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-[36px] flex items-center justify-between gap-2 text-left text-xs transition-colors select-none cursor-pointer focus-visible:outline-none focus-visible:bg-accent-500/15 focus-visible:text-accent-400 hover:bg-accent-500/10 hover:text-accent-400"
            :class="[
              opt.value === modelValue
                ? 'bg-accent-500/[0.08] text-accent-400 font-bold'
                : 'text-slate-300 font-medium',
              uppercase ? 'uppercase tracking-wider' : ''
            ]"
            @click="selectOption(opt.value)"
          >
            <span class="flex items-center gap-2 min-w-0">
              <Icon
                v-if="opt.icon"
                :name="opt.icon"
                class="text-xs shrink-0"
                :class="
                  opt.value === modelValue
                    ? 'text-accent-500'
                    : 'text-slate-400'
                "
                aria-hidden="true"
              />
              <span class="truncate" :title="opt.label">{{ opt.label }}</span>
            </span>
            <span class="flex items-center gap-2 shrink-0">
              <span
                v-if="opt.meta"
                class="text-[11px] font-medium tabular-nums"
                :class="
                  opt.value === modelValue
                    ? 'text-accent-400/90'
                    : 'text-slate-400'
                "
              >
                {{ opt.meta }}
              </span>
              <Icon
                v-if="opt.value === modelValue"
                name="ri:checkbox-circle-fill"
                class="text-accent-500 text-xs shrink-0"
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUpdate,
  onUnmounted,
  ref,
  useId,
  watch,
  type ComponentPublicInstance
} from 'vue';

export interface LibraryDropdownOption {
  value: string;
  label: string;
  icon?: string;
  meta?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    open: boolean;
    options: LibraryDropdownOption[];
    label: string;
    uppercase?: boolean;
    triggerClass?: string;
    panelClass?: string;
    testId?: string;
  }>(),
  {
    uppercase: false,
    triggerClass: '',
    panelClass: 'w-full right-0',
    testId: 'library-dropdown'
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:open': [value: boolean];
}>();

const listboxId = useId();
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const optionRefs = ref<HTMLButtonElement[]>([]);
const focusedIndex = ref(0);
const pendingFocusOption = ref(false);

const activeOption = computed<LibraryDropdownOption | undefined>(
  () =>
    props.options.find(opt => opt.value === props.modelValue) ??
    props.options[0]
);

onBeforeUpdate(() => {
  optionRefs.value = [];
});

function setOptionRef(
  idx: number,
  el: Element | ComponentPublicInstance | null
): void {
  if (el instanceof HTMLButtonElement) {
    optionRefs.value[idx] = el;
  }
}

function getActiveOptionIndex(fallbackLast = false): number {
  const idx = props.options.findIndex(opt => opt.value === props.modelValue);
  if (idx >= 0) return idx;
  if (fallbackLast && props.options.length > 0) {
    return props.options.length - 1;
  }
  return 0;
}

function focusTrigger(): void {
  triggerRef.value?.focus();
}

function focusOption(idx: number): void {
  if (props.options.length === 0) return;
  const clamped =
    ((idx % props.options.length) + props.options.length) %
    props.options.length;
  focusedIndex.value = clamped;
  optionRefs.value[clamped]?.focus();
}

function handleOutsidePointerDown(event: PointerEvent): void {
  const target = event.target as Node | null;
  if (rootRef.value && target && !rootRef.value.contains(target)) {
    emit('update:open', false);
  }
}

function attachOutsideListener(): void {
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', handleOutsidePointerDown);
  }
}

function detachOutsideListener(): void {
  if (typeof document !== 'undefined') {
    document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }
}

watch(
  () => props.open,
  async isOpen => {
    if (isOpen) {
      if (!pendingFocusOption.value) {
        focusedIndex.value = getActiveOptionIndex();
      }
      attachOutsideListener();
      if (pendingFocusOption.value) {
        pendingFocusOption.value = false;
        await nextTick();
        focusOption(focusedIndex.value);
      }
      return;
    }

    pendingFocusOption.value = false;
    detachOutsideListener();
  },
  { immediate: true }
);

onUnmounted(() => {
  detachOutsideListener();
});

function toggleOpen(): void {
  pendingFocusOption.value = false;
  emit('update:open', !props.open);
}

function selectOption(value: string): void {
  emit('update:modelValue', value);
  emit('update:open', false);
  focusTrigger();
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const targetIdx = getActiveOptionIndex(event.key === 'ArrowUp');
    if (props.open) {
      focusOption(targetIdx);
      return;
    }
    focusedIndex.value = targetIdx;
    pendingFocusOption.value = true;
    emit('update:open', true);
    return;
  }

  if (event.key === 'Escape' && props.open) {
    event.preventDefault();
    event.stopPropagation();
    emit('update:open', false);
  }
}

function handleListboxKeydown(event: KeyboardEvent): void {
  if (props.options.length === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusOption(focusedIndex.value + 1);
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusOption(focusedIndex.value - 1);
      break;
    case 'Home':
      event.preventDefault();
      focusOption(0);
      break;
    case 'End':
      event.preventDefault();
      focusOption(props.options.length - 1);
      break;
    case 'Enter':
    case ' ': {
      event.preventDefault();
      const opt = props.options[focusedIndex.value];
      if (opt) {
        selectOption(opt.value);
      }
      break;
    }
    case 'Escape':
      event.preventDefault();
      event.stopPropagation();
      emit('update:open', false);
      focusTrigger();
      break;
    case 'Tab':
      emit('update:open', false);
      break;
  }
}

defineExpose({
  focusTrigger
});
</script>
