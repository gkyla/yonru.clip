<template>
  <div class="w-full max-w-5xl z-10 flex flex-col mt-6 mb-16 gap-5">
    <!-- Header Section -->
    <header
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/50 pb-5"
    >
      <div>
        <div class="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1.5">
          <h1 class="text-3xl font-bold tracking-tight text-white">
            Changelog
          </h1>
          <span
            data-testid="changelog-installed-version"
            class="text-sm font-normal text-slate-400 tabular-nums whitespace-nowrap"
          >
            (installed v{{ installedVersion }})
          </span>
        </div>
        <p class="text-slate-400 text-sm">
          Follow the progress and new capabilities of Yonru Clip as we evolve
          the platform.
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="flex flex-wrap items-center gap-2.5 shrink-0">
        <button
          type="button"
          data-testid="changelog-refresh-btn"
          class="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
          :disabled="isRefreshing"
          @click="refreshReleases()"
        >
          <Icon
            name="lucide:refresh-cw"
            class="text-sm text-slate-300"
            :class="{ 'animate-spin text-accent-400': isRefreshing }"
            aria-hidden="true"
          />
          <span>{{ isRefreshing ? 'Checking...' : 'Check for Updates' }}</span>
        </button>

        <a
          href="https://github.com/gkyla/yonru.clip/releases"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
        >
          <Icon
            name="lucide:github"
            class="text-base text-slate-300 group-hover:text-white transition-colors"
            aria-hidden="true"
          />
          <span>GitHub Releases</span>
          <Icon
            name="lucide:external-link"
            class="text-xs text-slate-400 group-hover:text-white transition-colors"
            aria-hidden="true"
          />
        </a>
      </div>
    </header>

    <!-- Non-blocking Offline Notice -->
    <div
      v-if="isOffline && remoteError"
      data-testid="remote-offline-notice"
      role="status"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 text-amber-200 text-xs"
    >
      <div class="flex items-center gap-2.5">
        <Icon
          name="lucide:wifi-off"
          class="text-sm text-amber-400 shrink-0"
          aria-hidden="true"
        />
        <span>{{ remoteError }}</span>
      </div>
      <button
        type="button"
        class="self-start sm:self-auto px-2.5 py-1 min-h-[44px] sm:min-h-[32px] rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        @click="refreshReleases()"
      >
        Retry
      </button>
    </div>

    <!-- Informational Available Update Banner -->
    <section
      v-if="hasAvailableUpdate && latestAvailableRelease"
      data-testid="available-update-banner"
      aria-label="Available Update"
      class="rounded-2xl bg-accent-500/[0.06] border border-accent-500/30 p-5 flex flex-col gap-4"
    >
      <div
        class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-accent-500/20 border border-accent-500/40 text-accent-300"
            >
              Available Update
            </span>
            <h2 class="text-base sm:text-lg font-bold text-white">
              Yonru Clip v{{ latestAvailableVersion }} is available
            </h2>
          </div>
          <p class="text-xs sm:text-sm text-slate-300">
            Currently running v{{ installedVersion }}. Pull the latest release
            locally when you are ready:
          </p>
        </div>

        <a
          v-if="latestReleaseUrl"
          :href="latestReleaseUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl bg-accent-500/15 hover:bg-accent-500/25 border border-accent-500/40 text-accent-300 text-xs font-semibold transition-colors shrink-0 self-start sm:self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
        >
          <span>View v{{ latestAvailableVersion }} on GitHub</span>
          <Icon
            name="lucide:external-link"
            class="text-xs"
            aria-hidden="true"
          />
        </a>
      </div>

      <!-- Copyable Manual Update Command -->
      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#09090b]/90 border border-white/10 px-3.5 py-2.5"
      >
        <pre
          class="m-0 min-w-0 max-w-full overflow-x-auto text-xs sm:text-sm font-mono text-slate-100"
        ><code id="manual-update-command">{{ UPDATE_COMMAND }}</code></pre>

        <div class="flex items-center gap-2 shrink-0">
          <span
            data-testid="copy-command-status"
            role="status"
            aria-live="polite"
            class="text-xs font-medium transition-opacity duration-150"
            :class="[
              copyState === 'failed'
                ? 'text-rose-300 opacity-100'
                : copyState === 'copied'
                  ? 'text-emerald-300 opacity-100'
                  : 'opacity-0 pointer-events-none'
            ]"
          >
            {{ copyStatusMessage }}
          </span>
          <button
            type="button"
            data-testid="copy-update-command-btn"
            aria-label="Copy update command"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 min-w-[44px] sm:min-w-[36px] min-h-[44px] sm:min-h-[36px] rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70"
            @click="copyUpdateCommand"
          >
            <Icon
              :name="copyState === 'copied' ? 'lucide:check' : 'lucide:copy'"
              class="text-sm"
              :class="
                copyState === 'copied' ? 'text-emerald-400' : 'text-slate-300'
              "
              aria-hidden="true"
            />
            <span>{{ copyState === 'copied' ? 'Copied' : 'Copy' }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- Timeline Container -->
    <main class="relative mt-2">
      <!-- Loading State -->
      <div v-if="status === 'pending'" class="flex flex-col gap-8 py-8">
        <div v-for="i in 2" :key="i" class="flex gap-6 animate-pulse">
          <div class="w-8 h-8 rounded-full bg-white/10 shrink-0 mt-1"></div>
          <div
            class="flex-1 bg-surface-panel/50 border border-surface-border rounded-2xl p-6 sm:p-8 space-y-4"
          >
            <div class="h-6 w-32 bg-white/10 rounded-md"></div>
            <div class="h-8 w-3/4 bg-white/10 rounded-md"></div>
            <div class="space-y-2 pt-2">
              <div class="h-4 w-full bg-white/5 rounded"></div>
              <div class="h-4 w-5/6 bg-white/5 rounded"></div>
              <div class="h-4 w-2/3 bg-white/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-else-if="status === 'error'"
        class="bg-surface-panel border border-rose-500/30 rounded-2xl p-10 text-center my-6 flex flex-col items-center gap-3"
      >
        <Icon
          name="lucide:alert-circle"
          class="text-4xl text-rose-400"
          aria-hidden="true"
        />
        <h3 class="text-lg font-bold text-white">Failed to Load Changelog</h3>
        <p class="text-sm text-slate-300 max-w-md">
          Local release documents could not be read. Try refreshing the
          changelog.
        </p>
        <button
          type="button"
          data-testid="changelog-retry-btn"
          class="mt-1 px-4 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          @click="refreshReleases()"
        >
          Retry
        </button>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!releases || releases.length === 0"
        class="bg-surface-panel border border-surface-border rounded-2xl p-12 text-center my-6"
      >
        <Icon
          name="lucide:history"
          class="text-4xl text-slate-500 mb-3 mx-auto"
          aria-hidden="true"
        />
        <h3 class="text-lg font-bold text-white mb-1">No Releases Found</h3>
        <p class="text-sm text-slate-400 max-w-sm mx-auto">
          No changelog markdown documents were discovered in the repository.
        </p>
      </div>

      <!-- Two-Column Timeline Releases Feed -->
      <div v-else class="space-y-16">
        <article
          v-for="(release, index) in releases"
          :key="`${release.source || 'local'}-${release.version || index}`"
          class="relative grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-6 md:gap-8 items-start group"
        >
          <!-- Left Meta Column (Version, Status, Date, GitHub Release) -->
          <div
            class="flex flex-col gap-3 md:sticky md:top-8 self-start md:text-right md:items-end pt-1"
          >
            <div
              class="flex flex-wrap md:flex-col items-center md:items-end gap-2"
            >
              <!-- Version Chip (Clickable to GitHub Release) -->
              <component
                :is="release.githubReleaseUrl ? 'a' : 'span'"
                :href="release.githubReleaseUrl || undefined"
                :target="release.githubReleaseUrl ? '_blank' : undefined"
                :rel="
                  release.githubReleaseUrl ? 'noopener noreferrer' : undefined
                "
                class="text-xs px-2.5 py-1 rounded-lg border border-accent-500/30 text-accent-400 font-bold tracking-wide shadow-sm flex items-center gap-1.5 transition-all group/ver"
                :class="{
                  'hover:bg-accent-500/10 hover:border-accent-500/60 hover:text-accent-300 cursor-pointer':
                    release.githubReleaseUrl
                }"
                :title="
                  release.githubReleaseUrl ? 'View GitHub Release' : undefined
                "
              >
                <Icon
                  name="lucide:tag"
                  class="text-xs shrink-0"
                  aria-hidden="true"
                />
                <span>v{{ release.version }}</span>
                <Icon
                  v-if="release.githubReleaseUrl"
                  name="lucide:external-link"
                  class="text-[10px] text-accent-400/50 group-hover/ver:text-accent-300 shrink-0"
                  aria-hidden="true"
                />
              </component>

              <!-- Available Update Badge -->
              <span
                v-if="release.isAvailableUpdate"
                class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-accent-500/15 border border-accent-500/35 text-accent-300"
              >
                Available Update
              </span>

              <!-- Installed Badge -->
              <span
                v-if="release.isInstalled"
                class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              >
                Installed
              </span>

              <!-- Optional Curated Badge -->
              <span
                v-if="release.badge && !release.isAvailableUpdate"
                class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-slate-300"
              >
                {{ release.badge }}
              </span>
            </div>

            <!-- Release Date -->
            <div
              class="flex items-center gap-1.5 text-xs text-slate-400 mt-1 md:justify-end"
            >
              <time :datetime="release.date">{{
                formatDate(release.date)
              }}</time>
            </div>
          </div>

          <!-- Right Column: Content Card with Vertical Timeline Connector -->
          <div class="relative pl-6 md:pl-8">
            <!-- Continuous Vertical Spine Line on the left of the card -->
            <div
              class="absolute left-0 top-3 bottom-0 w-px bg-gradient-to-b from-accent-500/40 via-white/10 to-transparent pointer-events-none"
              :class="{
                'bottom-0': index < releases.length - 1,
                'bottom-8': index === releases.length - 1
              }"
            ></div>

            <!-- Node Marker centered on the spine line -->
            <div
              class="absolute left-0 top-3.5 -translate-x-1/2 flex items-center justify-center z-10"
            >
              <div
                class="w-3.5 h-3.5 rounded-full border-2 transition-all duration-300"
                :class="[
                  index === 0 || release.isAvailableUpdate
                    ? 'bg-accent-500 border-accent-400 shadow-[0_0_12px_rgba(255,215,0,0.6)]'
                    : 'bg-[#121216] border-white/30 group-hover:border-accent-500/60'
                ]"
              ></div>
            </div>

            <!-- Release Card -->
            <div
              class="bg-surface-panel/90 border rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-accent-500/[0.02]"
              :class="
                release.isAvailableUpdate
                  ? 'border-accent-500/35'
                  : 'border-surface-border'
              "
            >
              <!-- Release Title -->
              <h2
                class="text-2xl sm:text-3xl font-extrabold text-white mb-4 tracking-tight leading-snug"
              >
                {{ release.title }}
              </h2>

              <!-- Markdown Body Content -->
              <div class="changelog-content text-slate-300">
                <ChangelogMarkdownRenderer
                  v-if="release.source === 'remote'"
                  :markdown="release.rawBody || ''"
                />
                <ContentRenderer
                  v-else
                  :value="release"
                  :components="{ h3: ChangelogCategoryHeading }"
                />
              </div>
            </div>
          </div>
        </article>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import ChangelogCategoryHeading from './ChangelogCategoryHeading.vue';
import ChangelogMarkdownRenderer from './ChangelogMarkdownRenderer.vue';
import { useChangelog } from '~/composables/useChangelog';
import { useAppNotifier } from '~/composables/useAppNotifier';
import { sanitizeExternalUrl } from '~/utils/changelogMarkdown';

const UPDATE_COMMAND = 'git pull && python run.py';

const {
  releases,
  status,
  installedVersion,
  hasAvailableUpdate,
  latestAvailableVersion,
  latestAvailableRelease,
  isRefreshing,
  isOffline,
  remoteError,
  fetchReleases,
  refreshReleases
} = useChangelog();

const notifier = useAppNotifier();

const copyState = ref<'idle' | 'copied' | 'failed'>('idle');
const copyStatusMessage = ref<string>('');
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;
let lastAnnouncement = '';

const latestReleaseUrl = computed(() => {
  return (
    sanitizeExternalUrl(latestAvailableRelease.value?.githubReleaseUrl) ??
    'https://github.com/gkyla/yonru.clip/releases'
  );
});

onMounted(() => {
  fetchReleases();
});

onUnmounted(() => {
  if (copyResetTimer) {
    clearTimeout(copyResetTimer);
    copyResetTimer = null;
  }
});

function reportCopyOutcome(ok: boolean) {
  if (copyResetTimer) {
    clearTimeout(copyResetTimer);
    copyResetTimer = null;
  }

  let message = ok ? 'Copied' : 'Copy failed';
  if (message === lastAnnouncement) {
    message += '\u00A0';
  }
  lastAnnouncement = message;

  copyState.value = ok ? 'copied' : 'failed';
  copyStatusMessage.value = message;

  if (ok) {
    notifier.showToast?.('Update command copied to clipboard!', 'success');
  } else {
    notifier.showToast?.('Could not copy update command.', 'error');
  }

  copyResetTimer = setTimeout(() => {
    copyState.value = 'idle';
    copyStatusMessage.value = '';
    copyResetTimer = null;
  }, 2000);
}

async function copyUpdateCommand() {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      throw new Error('Clipboard API unavailable');
    }
    await navigator.clipboard.writeText(UPDATE_COMMAND);
    reportCopyOutcome(true);
  } catch {
    reportCopyOutcome(false);
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(d);
  } catch {
    return dateStr;
  }
}
</script>

<style scoped>
:deep(.changelog-content) {
  font-size: 0.925rem;
  line-height: 1.65;
}

:deep(.changelog-content > p),
:deep(.changelog-content .changelog-remote-markdown > p) {
  margin-top: 0.75rem;
  margin-bottom: 1.25rem;
  color: #cbd5e1;
}

:deep(.changelog-content h3) {
  font-size: 1.35rem;
  font-weight: 700;
  margin-top: 1.85rem;
  margin-bottom: 0.85rem;
  display: flex;
  align-items: center;
  letter-spacing: -0.01em;
}

:deep(.changelog-content h3 a) {
  color: inherit;
  text-decoration: none;
  cursor: default;
  pointer-events: none;
}

:deep(.changelog-content ul) {
  list-style-type: none;
  padding-left: 0;
  margin-top: 0.5rem;
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

:deep(.changelog-content li) {
  position: relative;
  padding-left: 1.5rem;
  color: #cbd5e1;
}

:deep(.changelog-content li::before) {
  content: '';
  position: absolute;
  left: 0.35rem;
  top: 0.65rem;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.3);
}

/* Sub-list indentation and styling for grouped scopes */
:deep(.changelog-content ul ul) {
  position: relative;
  margin-top: 0.375rem;
  margin-bottom: 0.25rem;
  margin-left: 0;
  padding-left: 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

:deep(.changelog-content ul ul li) {
  padding-left: 1rem;
  color: #e2e8f0;
  font-size: 0.875rem;
}

:deep(.changelog-content ul ul li::before) {
  left: 0.15rem;
  top: 0.55rem;
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 9999px;
  background-color: rgba(255, 255, 255, 0.45);
}

:deep(.changelog-content strong) {
  color: #ffffff;
  font-weight: 600;
}

:deep(.changelog-content p a),
:deep(.changelog-content li a) {
  color: #ffd700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

:deep(.changelog-content p a:hover),
:deep(.changelog-content li a:hover) {
  color: #ffe44d;
}

:deep(.changelog-content code) {
  background-color: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.15rem 0.35rem;
  border-radius: 0.375rem;
  font-size: 0.825em;
  font-family: monospace;
  color: #ffd700;
}

:deep(.changelog-content pre code) {
  background-color: transparent;
  border: 0;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
  color: inherit;
}
</style>
