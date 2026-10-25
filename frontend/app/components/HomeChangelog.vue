<template>
  <div class="w-full max-w-5xl z-10 flex flex-col mt-6 mb-16 gap-5">
    <!-- Header Section -->
    <header
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/50 pb-5"
    >
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-white mb-1">
          Changelog
        </h1>
        <p class="text-slate-400 text-sm">
          Follow the progress and new capabilities of Yonru Clip as we evolve
          the platform.
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-3 shrink-0">
        <a
          href="https://github.com/gkyla/yonru.clip/releases"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white text-xs font-medium transition-colors cursor-pointer group"
        >
          <Icon
            name="lucide:github"
            class="text-base text-slate-300 group-hover:text-white transition-colors"
          />
          <span>GitHub Releases</span>
          <Icon
            name="lucide:external-link"
            class="text-xs text-slate-400 group-hover:text-white transition-colors"
          />
        </a>
      </div>
    </header>

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

      <!-- Empty State -->
      <div
        v-else-if="!releases || releases.length === 0"
        class="bg-surface-panel border border-surface-border rounded-2xl p-12 text-center my-6"
      >
        <Icon
          name="lucide:history"
          class="text-4xl text-slate-500 mb-3 mx-auto"
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
          :key="release.version || index"
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
                <Icon name="lucide:tag" class="text-xs shrink-0" />
                <span>v{{ release.version }}</span>
                <Icon
                  v-if="release.githubReleaseUrl"
                  name="lucide:external-link"
                  class="text-[10px] text-accent-400/50 group-hover/ver:text-accent-300 shrink-0"
                />
              </component>

              <!-- Optional Badge -->
              <span
                v-if="release.badge"
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
                  index === 0
                    ? 'bg-accent-500 border-accent-400 shadow-[0_0_12px_rgba(255,215,0,0.6)]'
                    : 'bg-[#121216] border-white/30 group-hover:border-accent-500/60'
                ]"
              ></div>
            </div>

            <!-- Release Card -->
            <div
              class="bg-surface-panel/90 border border-surface-border rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-accent-500/[0.02]"
            >
              <!-- Release Title -->
              <h2
                class="text-xl sm:text-2xl font-bold text-white mb-4 tracking-tight leading-snug"
              >
                {{ release.title }}
              </h2>

              <!-- Markdown Body Content -->
              <div class="changelog-content text-slate-300">
                <ContentRenderer
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
import ChangelogCategoryHeading from './ChangelogCategoryHeading.vue';

const { releases, status, fetchReleases } = useChangelog();

onMounted(() => {
  fetchReleases();
});

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

:deep(.changelog-content > p) {
  margin-top: 0.75rem;
  margin-bottom: 1.25rem;
  color: #cbd5e1;
}

:deep(.changelog-content h3) {
  font-size: 1.125rem;
  font-weight: 700;
  margin-top: 1.75rem;
  margin-bottom: 0.75rem;
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
</style>
