<template>
  <div
    id="settings-cookies"
    key="cookies"
    class="scroll-mt-24 flex flex-col gap-6"
  >
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
    >
      <div>
        <h3 class="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <Icon name="ri:shield-keyhole-fill" class="text-accent-500" />
          YouTube Cookies (yt-dlp)
        </h3>
        <p class="text-sm text-slate-400">
          Import your YouTube cookies to bypass rate limits, captchas, and bot
          detection when fetching or downloading videos.
        </p>
      </div>
    </div>

    <!-- Section 1: Active Status / Uploader Box -->
    <div class="flex flex-col gap-4">
      <!-- Active Cookies Card (When Configured - Flat Surface Monokrom) -->
      <div
        v-if="cookiesStatus.exists"
        class="p-4 sm:p-5 rounded-xl border border-surface-border bg-surface-dark/40 flex flex-col gap-4 shadow-sm"
      >
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="flex items-start sm:items-center gap-3.5">
            <div
              class="w-10 h-10 rounded-lg bg-[#111318] border border-surface-border flex items-center justify-center text-accent-500 shrink-0"
            >
              <Icon name="ri:file-text-fill" class="text-xl" />
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-white font-mono"
                  >cookies.txt</span
                >
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                >
                  Active
                </span>
              </div>
              <span class="text-xs text-slate-400 font-mono mt-0.5">
                Size: {{ formatBytes(cookiesStatus.size_bytes) }} • Updated:
                {{ formatDate(cookiesStatus.last_modified) }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-center">
            <button
              :disabled="deletingCookies"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              @click="emit('deleteCookies')"
            >
              <Icon name="ri:delete-bin-line" class="text-sm" />
              {{ deletingCookies ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>

        <!-- Integrated Replace Dropzone (Always Open) -->
        <div
          :class="
            dragOver
              ? 'border-accent-500 bg-accent-500/5 ring-2 ring-accent-500/20'
              : 'border-surface-border/80 bg-[#0e1015]/90 hover:border-slate-600'
          "
          class="py-5 px-4 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center transition-all cursor-pointer group"
          @dragover.prevent="dragOver = true"
          @dragleave.prevent="dragOver = false"
          @drop.prevent="handleFileDrop"
          @click="fileInput?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".txt"
            class="hidden"
            @change="handleFileSelect"
          />
          <div
            class="w-8 h-8 rounded-lg bg-surface-dark border border-surface-border/80 flex items-center justify-center text-slate-400 group-hover:text-accent-500 group-hover:border-accent-500/30 transition-all mb-1 shadow-inner"
          >
            <Icon
              name="ri:upload-cloud-2-line"
              class="text-base"
              :class="{ 'text-accent-500 scale-110': dragOver }"
            />
          </div>
          <div
            class="flex items-center gap-1.5 text-xs text-slate-300 group-hover:text-white font-medium"
          >
            <span
              >Drop new
              <span class="text-accent-400 font-semibold font-mono"
                >cookies.txt</span
              >
              here to replace or
              <span class="text-accent-500 underline underline-offset-2"
                >browse</span
              ></span
            >
          </div>
          <span class="text-[11px] text-slate-500 mt-0.5"
            >This will immediately overwrite your active cookies file.</span
          >
        </div>
      </div>

      <!-- Unconfigured Notice (When No Cookies) -->
      <div
        v-else
        class="flex items-start gap-3 p-3.5 rounded-xl border border-surface-border bg-surface-dark/40 text-slate-300 text-xs leading-relaxed"
      >
        <Icon
          name="ri:alert-fill"
          class="text-amber-400 text-base shrink-0 mt-0.5"
        />
        <div class="flex flex-col gap-0.5">
          <span class="font-bold text-white">No cookies configured</span>
          <p class="text-slate-400">
            Video downloads and metadata fetching may work, but remain
            vulnerable to YouTube's "Sign in to confirm you're not a bot"
            restriction.
          </p>
        </div>
      </div>

      <!-- Upload Drag & Drop Area (When No Cookies Exist) -->
      <div
        v-if="!cookiesStatus.exists"
        :class="
          dragOver
            ? 'border-accent-500 bg-accent-500/5 ring-4 ring-accent-500/10'
            : 'border-surface-border bg-surface-dark/30 hover:border-slate-600 hover:bg-surface-dark/50'
        "
        class="w-full min-h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-200 cursor-pointer relative group"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="handleFileDrop"
        @click="fileInput?.click()"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".txt"
          class="hidden"
          @change="handleFileSelect"
        />

        <div
          class="w-10 h-10 rounded-xl bg-surface-dark border border-surface-border flex items-center justify-center text-slate-400 group-hover:text-accent-500 group-hover:border-accent-500/30 group-hover:scale-105 transition-all duration-200 mb-2.5 shadow-inner"
        >
          <Icon
            name="ri:upload-cloud-2-line"
            class="text-xl transition-transform"
            :class="{ 'text-accent-500 scale-110': dragOver }"
          />
        </div>
        <span
          class="text-sm font-bold text-slate-200 group-hover:text-white transition-colors"
        >
          Drag & drop your
          <span class="font-mono text-accent-500">cookies.txt</span> here
        </span>
        <span class="text-xs text-slate-500 mt-1.5">
          or
          <span
            class="text-accent-500 font-semibold underline underline-offset-2"
            >browse file</span
          >
          from your computer (Netscape format)
        </span>
      </div>
    </div>

    <!-- Section 2: Unified Horizontal Flow Track Guide -->
    <div class="flex flex-col gap-3">
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pl-0.5"
      >
        <div class="flex items-center gap-2">
          <Icon name="ri:route-line" class="text-accent-500 text-sm" />
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300">
            How to obtain cookies?
          </h4>
        </div>
        <a
          href="https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies"
          target="_blank"
          class="inline-flex items-center gap-1.5 text-xs text-accent-500 hover:text-accent-400 font-semibold transition-colors"
        >
          <Icon name="ri:github-fill" class="text-sm" /> Official yt-dlp Cookies
          Wiki
          <Icon name="ri:external-link-line" class="text-xs" />
        </a>
      </div>

      <!-- Unified Horizontal Pipeline Track -->
      <div
        class="rounded-xl border border-surface-border bg-surface-dark/40 overflow-hidden shadow-sm"
      >
        <div
          class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-surface-border/60"
        >
          <!-- Step 01 Segment -->
          <div
            class="p-4 sm:p-5 flex flex-col justify-between h-full relative group hover:bg-surface-dark/60 transition-colors"
          >
            <div class="flex flex-col">
              <div class="flex items-center justify-between gap-2 min-h-6">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-5 h-5 rounded-md bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center text-[10px] font-black shrink-0"
                    >01</span
                  >
                  <h5 class="text-xs font-bold text-slate-200 truncate">
                    Install Extension
                  </h5>
                </div>
                <Icon
                  name="ri:arrow-right-line"
                  class="hidden lg:block text-slate-600 group-hover:text-accent-500/70 transition-colors text-xs shrink-0"
                />
              </div>
              <p
                class="text-[11px] leading-relaxed text-slate-400 mt-2 min-h-8"
              >
                Install open-source browser extension
                <strong class="text-slate-300"
                  >"Get cookies.txt LOCALLY"</strong
                >
                to extract cookies:
              </p>
            </div>

            <div
              class="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-border/40"
            >
              <a
                href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
                target="_blank"
                class="inline-flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] font-semibold text-slate-300 hover:text-white hover:border-accent-500/40 hover:bg-accent-500/5 transition-all group/btn"
              >
                <span class="flex items-center gap-1.5">
                  <Icon
                    name="ri:chrome-fill"
                    class="text-accent-500 text-xs shrink-0"
                  />
                  <span>Chrome / Edge / Brave</span>
                </span>
                <Icon
                  name="ri:external-link-line"
                  class="text-slate-500 group-hover/btn:text-slate-300 text-[10px] shrink-0"
                />
              </a>
              <a
                href="https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/"
                target="_blank"
                class="inline-flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] font-semibold text-slate-300 hover:text-white hover:border-accent-500/40 hover:bg-accent-500/5 transition-all group/btn"
              >
                <span class="flex items-center gap-1.5">
                  <Icon
                    name="ri:firefox-fill"
                    class="text-accent-500 text-xs shrink-0"
                  />
                  <span>Firefox</span>
                </span>
                <Icon
                  name="ri:external-link-line"
                  class="text-slate-500 group-hover/btn:text-slate-300 text-[10px] shrink-0"
                />
              </a>
            </div>
          </div>

          <!-- Step 02 Segment -->
          <div
            class="p-4 sm:p-5 flex flex-col justify-between h-full relative group hover:bg-surface-dark/60 transition-colors"
          >
            <div class="flex flex-col">
              <div class="flex items-center justify-between gap-2 min-h-6">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-5 h-5 rounded-md bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center text-[10px] font-black shrink-0"
                    >02</span
                  >
                  <h5 class="text-xs font-bold text-slate-200 truncate">
                    Sign In to YouTube
                  </h5>
                </div>
                <Icon
                  name="ri:arrow-right-line"
                  class="hidden lg:block text-slate-600 group-hover:text-accent-500/70 transition-colors text-xs shrink-0"
                />
              </div>
              <p
                class="text-[11px] leading-relaxed text-slate-400 mt-2 min-h-8"
              >
                Open YouTube in a new tab and ensure your Google account is
                logged in for a valid active session.
              </p>
            </div>

            <div
              class="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-border/40"
            >
              <a
                href="https://youtube.com"
                target="_blank"
                class="inline-flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] font-semibold text-slate-300 hover:text-white hover:border-accent-500/40 hover:bg-accent-500/5 transition-all group/btn"
              >
                <span class="flex items-center gap-1.5">
                  <Icon
                    name="ri:youtube-fill"
                    class="text-red-500 text-xs shrink-0"
                  />
                  <span>Open youtube.com</span>
                </span>
                <Icon
                  name="ri:external-link-line"
                  class="text-slate-500 group-hover/btn:text-slate-300 text-[10px] shrink-0"
                />
              </a>
              <div
                class="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-slate-500"
              >
                <Icon
                  name="ri:information-line"
                  class="text-xs text-accent-500 shrink-0"
                />
                <span>Google Account required</span>
              </div>
            </div>
          </div>

          <!-- Step 03 Segment -->
          <div
            class="p-4 sm:p-5 flex flex-col justify-between h-full relative group hover:bg-surface-dark/60 transition-colors"
          >
            <div class="flex flex-col">
              <div class="flex items-center justify-between gap-2 min-h-6">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-5 h-5 rounded-md bg-accent-500/10 border border-accent-500/20 text-accent-500 flex items-center justify-center text-[10px] font-black shrink-0"
                    >03</span
                  >
                  <h5 class="text-xs font-bold text-slate-200 truncate">
                    Export Cookies
                  </h5>
                </div>
                <Icon
                  name="ri:check-double-line"
                  class="text-emerald-500/70 text-xs shrink-0"
                />
              </div>
              <p
                class="text-[11px] leading-relaxed text-slate-400 mt-2 min-h-8"
              >
                Open
                <strong class="text-slate-300"
                  >"Get cookies.txt LOCALLY"</strong
                >
                on YouTube, choose
                <strong class="text-slate-300">"Export as"</strong> with
                Netscape option, then drop file above.
              </p>
            </div>

            <div
              class="flex flex-col gap-1.5 mt-4 pt-3 border-t border-surface-border/40"
            >
              <div
                class="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg bg-[#111318] border border-surface-border text-[11px] text-accent-400 font-mono"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <Icon
                    name="ri:file-text-line"
                    class="text-xs shrink-0 text-accent-500"
                  />
                  <span class="truncate">youtube.com_cookies.txt</span>
                </div>
                <span
                  class="text-[9px] font-sans text-slate-500 uppercase tracking-wider font-semibold"
                  >Netscape</span
                >
              </div>
              <div
                class="flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-emerald-400/90"
              >
                <Icon
                  name="ri:check-line"
                  class="text-xs shrink-0 text-emerald-400"
                />
                <span>Drop exported .txt file above</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

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
const fileInput = ref<HTMLInputElement | null>(null);

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

function handleFileSelect(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    emit('uploadText', text);
  };
  reader.readAsText(file);
}

function handleFileDrop(event: any) {
  dragOver.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;

  if (!file.name.endsWith('.txt')) {
    state.showToast?.('Please upload a valid .txt cookie file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target?.result as string;
    emit('uploadText', text);
  };
  reader.readAsText(file);
}
</script>
