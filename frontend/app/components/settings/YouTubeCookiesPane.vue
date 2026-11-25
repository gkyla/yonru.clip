<template>
  <div
    id="settings-cookies"
    key="cookies"
    class="scroll-mt-24 flex flex-col gap-5"
  >
    <div>
      <h2 class="text-base font-bold text-white mb-0.5 flex items-center gap-2">
        <Icon
          name="ri:shield-keyhole-fill"
          class="text-accent-500"
          aria-hidden="true"
        />
        <span>YouTube Cookies (yt-dlp)</span>
      </h2>
      <p class="text-xs text-slate-400 leading-relaxed">
        Optional browser
        <code class="font-mono text-slate-300">cookies.txt</code> file for
        downloading restricted or bot-checked YouTube videos.
      </p>
    </div>

    <!-- Active Cookies Card -->
    <div
      v-if="cookiesStatus.exists"
      :class="
        dragOver
          ? 'border-accent-500 bg-accent-500/5'
          : 'border-surface-border bg-surface-dark/40'
      "
      class="border flex flex-col transition-colors"
      @dragover.prevent="dragOver = true"
      @dragleave="handleDragLeave"
      @drop.prevent="handleFileDrop"
    >
      <div
        class="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div class="flex items-start sm:items-center gap-3.5 min-w-0">
          <div
            class="w-11 h-11 bg-surface-card border border-surface-border flex items-center justify-center text-emerald-400 shrink-0"
          >
            <Icon
              name="ri:shield-check-fill"
              class="text-xl"
              aria-hidden="true"
            />
          </div>
          <div class="flex flex-col gap-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2.5">
              <span class="text-sm font-bold text-white font-mono">
                cookies.txt
              </span>
              <span
                data-testid="cookies-active-status"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300"
              >
                <span
                  class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                  aria-hidden="true"
                ></span>
                <span>Active</span>
              </span>
            </div>
            <p
              data-testid="cookies-saved-note"
              class="text-xs text-slate-300 leading-relaxed"
            >
              Saved in the app and applied automatically when downloading
              YouTube videos.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <label
            :for="replaceInputId"
            class="inline-flex items-center justify-center gap-1.5 px-3 py-2 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark hover:bg-surface-card border border-surface-border hover:border-slate-500 text-slate-200 hover:text-white text-xs font-medium transition-colors cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-accent-500 focus-within:outline-offset-2"
          >
            <input
              :id="replaceInputId"
              ref="replaceFileInput"
              type="file"
              accept=".txt"
              class="sr-only"
              @change="handleFileSelect"
            />
            <Icon name="ri:upload-2-line" class="text-xs" aria-hidden="true" />
            <span>Replace</span>
          </label>

          <button
            type="button"
            data-testid="delete-cookies-btn"
            :disabled="deletingCookies"
            class="inline-flex items-center justify-center gap-1.5 px-3 py-2 [@media(pointer:coarse)]:min-h-[44px] bg-surface-dark border border-surface-border text-slate-300 hover:text-red-300 hover:border-red-500/40 hover:bg-red-500/10 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            @click="emit('deleteCookies')"
          >
            <Icon
              name="ri:delete-bin-line"
              class="text-xs"
              aria-hidden="true"
            />
            <span>{{ deletingCookies ? 'Deleting...' : 'Delete' }}</span>
          </button>
        </div>
      </div>

      <!-- Refresh / Expiry Note Strip -->
      <div
        class="px-5 py-3.5 sm:px-6 border-t border-surface-border/70 bg-surface-dark/30 flex items-center gap-2 text-xs text-slate-300"
      >
        <Icon
          :name="dragOver ? 'ri:upload-2-line' : 'ri:alert-line'"
          class="text-sm shrink-0"
          :class="dragOver ? 'text-accent-400' : 'text-amber-400'"
          aria-hidden="true"
        />
        <span v-if="dragOver">
          Release to replace your saved
          <code class="font-mono text-slate-200">cookies.txt</code> file.
        </span>
        <span v-else>
          You may need to export and replace
          <code class="font-mono text-slate-200">cookies.txt</code> if you sign
          out of YouTube or your session expires.
        </span>
      </div>
    </div>

    <!-- Primary Dropzone When Unconfigured -->
    <label
      v-else
      :for="uploadInputId"
      :class="
        dragOver
          ? 'border-accent-500 bg-accent-500/10'
          : 'border-slate-600/80 bg-surface-dark/40 hover:border-slate-400 hover:bg-surface-dark/60'
      "
      class="relative w-full min-h-[176px] border border-dashed flex flex-col items-center justify-center p-6 text-center transition-colors cursor-pointer group focus-within:outline focus-within:outline-2 focus-within:outline-accent-500 focus-within:outline-offset-2"
      @dragover.prevent="dragOver = true"
      @dragleave="handleDragLeave"
      @drop.prevent="handleFileDrop"
    >
      <input
        :id="uploadInputId"
        ref="uploadFileInput"
        type="file"
        accept=".txt"
        class="sr-only"
        @change="handleFileSelect"
      />

      <Icon
        name="ri:upload-cloud-2-line"
        class="text-xl text-slate-300 group-hover:text-accent-400 transition-colors mb-1.5"
        :class="{ 'text-accent-400': dragOver }"
        aria-hidden="true"
      />
      <span class="text-xs font-semibold text-slate-100 group-hover:text-white">
        Drop your
        <code class="font-mono text-accent-400">cookies.txt</code>
        here or
        <span class="text-accent-400 underline underline-offset-4"
          >choose a file</span
        >
      </span>
      <span class="text-[11px] text-slate-400 mt-1">
        Exported browser cookie file (<code class="font-mono">.txt</code>)
      </span>
    </label>

    <div
      v-if="dropError"
      role="alert"
      class="p-2.5 border border-red-500/35 bg-red-500/10 text-xs text-red-200 flex items-center gap-2"
    >
      <Icon
        name="ri:error-warning-line"
        class="text-sm text-red-400 shrink-0"
        aria-hidden="true"
      />
      <span>{{ dropError }}</span>
    </div>

    <!-- Why Cookies Are Used Note -->
    <section
      data-testid="cookies-purpose-note"
      class="border border-surface-border bg-surface-dark/40 p-5 flex flex-col gap-2.5"
    >
      <h3 class="text-xs font-semibold text-white flex items-center gap-2">
        <Icon
          name="ri:information-line"
          class="text-sm text-accent-500 shrink-0"
          aria-hidden="true"
        />
        <span>Why yt-dlp may need YouTube cookies</span>
      </h3>
      <p class="text-xs text-slate-300 leading-relaxed">
        Most public YouTube videos download without cookies, so you only need
        this if YouTube blocks a download.
      </p>
      <ul
        class="list-disc list-inside space-y-1 text-xs text-slate-400 leading-relaxed"
      >
        <li>
          Helps bypass bot checks like
          <span class="text-slate-200"
            >"Sign in to confirm you're not a bot"</span
          >.
        </li>
        <li>
          Lets you download age-restricted or account-gated videos your browser
          session can already watch.
        </li>
      </ul>
    </section>

    <!-- Collapsible Export Guide -->
    <details
      class="cookies-guide border border-surface-border bg-surface-dark/40"
      :open="guideOpen"
      @toggle="handleGuideToggle"
    >
      <summary
        class="cookies-summary flex items-center justify-between gap-2.5 px-5 py-3 [@media(pointer:coarse)]:min-h-[44px] text-xs font-semibold text-slate-200 hover:text-white hover:bg-surface-dark/60 cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-[-2px]"
      >
        <span class="flex items-center gap-2">
          <Icon
            name="ri:arrow-down-s-line"
            class="guide-chevron text-sm text-slate-300 shrink-0"
            aria-hidden="true"
          />
          <span>How to export cookies.txt</span>
        </span>
      </summary>

      <div
        class="px-5 pb-5 pt-3.5 border-t border-surface-border/70 flex flex-col gap-2.5 text-xs text-slate-300 leading-relaxed"
      >
        <ol class="list-decimal list-inside space-y-1.5">
          <li>
            Install the open-source
            <strong class="text-white">Get cookies.txt LOCALLY</strong>
            extension for
            <a
              href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent-400 hover:text-accent-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              >Chrome / Edge / Brave</a
            >
            or
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent-400 hover:text-accent-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              >Firefox</a
            >.
          </li>
          <li>
            Sign in to
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              class="text-accent-400 hover:text-accent-300 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
              >youtube.com</a
            >
            in that browser profile.
          </li>
          <li>
            Export the YouTube tab as a
            <code class="font-mono text-slate-200">cookies.txt</code>
            file and drop it above.
          </li>
        </ol>

        <div class="pt-2 border-t border-surface-border/50">
          <a
            href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-slate-300 hover:text-accent-400 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
          >
            <span>Official yt-dlp Cookies Wiki</span>
            <Icon
              name="ri:external-link-line"
              class="text-xs"
              aria-hidden="true"
            />
          </a>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue';

const props = defineProps<{
  cookiesStatus: {
    exists: boolean;
    size_bytes: number;
    last_modified: string | null;
  };
  deletingCookies: boolean;
}>();

const emit = defineEmits<{
  (e: 'uploadText', text: string): void;
  (e: 'deleteCookies'): void;
}>();

const state = useClipperState();
const dragOver = ref(false);
const dropError = ref('');
const uploadInputId = useId();
const replaceInputId = useId();
const uploadFileInput = ref<HTMLInputElement | null>(null);
const replaceFileInput = ref<HTMLInputElement | null>(null);

const guideOpen = ref(!props.cookiesStatus.exists);

watch(
  () => props.cookiesStatus.exists,
  exists => {
    guideOpen.value = !exists;
  }
);

function handleGuideToggle(event: Event) {
  const detailsEl = event.target as HTMLDetailsElement | null;
  if (detailsEl) {
    guideOpen.value = detailsEl.open;
  }
}

function handleDragLeave(event: DragEvent) {
  const currentTarget = event.currentTarget as HTMLElement | null;
  const relatedTarget = event.relatedTarget as Node | null;
  if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
    return;
  }
  dragOver.value = false;
}

function readAndUploadCookieFile(file: File) {
  dropError.value = '';
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    emit('uploadText', text);
  };
  reader.readAsText(file);
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  readAndUploadCookieFile(file);
  if (input) input.value = '';
}

function handleFileDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;

  if (!file.name.endsWith('.txt')) {
    const msg = 'Please upload a valid .txt cookie file.';
    dropError.value = msg;
    state.showToast?.(msg, 'error');
    return;
  }

  readAndUploadCookieFile(file);
}
</script>

<style scoped>
.cookies-summary {
  list-style: none;
}

.cookies-summary::-webkit-details-marker {
  display: none;
}

.cookies-guide[open] .guide-chevron {
  transform: rotate(180deg);
}

.cookies-guide::details-content {
  interpolate-size: allow-keywords;
  overflow: clip;
  contain: layout;
}

.cookies-guide:not([open])::details-content {
  block-size: 0;
}

@media (prefers-reduced-motion: no-preference) {
  .guide-chevron {
    transition: transform 0.2s ease;
  }

  .cookies-guide::details-content {
    transition:
      block-size 0.22s ease,
      content-visibility 0.22s ease;
    transition-behavior: allow-discrete;
  }
}
</style>
