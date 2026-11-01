# 0027. Scoped Changelog Grouping and Smart Hierarchical Nesting

Date: 2026-11-02

## Status

Accepted

## Context

Following [ADR 0025](0025-content-driven-changelog-and-unified-semver.md), Yonru Clip adopted Conventional Commits and automated release notes generation via `@nuxt/content` v3 and root `CHANGELOG.md`.

However, as features scale, multiple commits frequently share the same component scope within a single release cycle (e.g. four consecutive `feat(editor):` commits in release `v0.2.0`). Generating flat bullet points resulted in repetitive bold prefixes:
```markdown
- **Editor**: show custom preset indicator and sync studio preview with text case (#306)
- **Editor**: integrate PresetStudioViewport into modal grid and sidebar pane (#304)
- **Editor**: add PresetStudioViewport with kinetic animation engine (#303)
- **Editor**: deferred render autoplay, studio control deck, and workspace preview isolation (#295)
```

This caused visual clutter, reduced scanability, and wasted vertical real estate in both the web UI (`HomeChangelog.vue`) and GitHub release documentation.

## Decision

1. **Smart Hierarchical Nesting Algorithm**:
   - **Multi-Item Scopes ($\ge 2$ commits)**: Consolidated under a single bold parent scope item with indented sub-bullet points:
     ```markdown
     - **Editor**:
       - Show custom preset indicator and sync studio preview with text case (#306)
       - Integrate PresetStudioViewport into modal grid and sidebar pane (#304)
     ```
   - **Single-Item Scopes (1 commit)**: Kept inline on a single line to preserve density without redundant nesting overhead:
     ```markdown
     - **Home**: Show skeleton loading during initial load of ready clips
     ```
   - **Unscoped Commits**: Rendered inline as standard bullet points without bold prefix:
     ```markdown
     - Add global analytics dashboard
     ```

2. **Uniform Presentation**:
   - The grouping applies uniformly to both the developer-facing root `CHANGELOG.md` and the user-facing modular document `frontend/content/changelog/<version>.md`.

3. **Clean Sub-List Styling in Web UI (`HomeChangelog.vue`)**:
   - Sub-lists rendered by `@nuxt/content` (`ul ul`) are styled with clean indentation and distinct micro-bullets (`0.25rem`) without vertical border lines for a lighter, uncluttered layout aligned with the studio dark-mode design system.

4. **Automated Release Helper (`scripts/release.js`)**:
   - Implemented `formatScopedEntries()` in `scripts/release.js` to automatically parse and group conventional commits during `npm run release`.

## Consequences

- Release notes and UI timeline feeds are clean, grouped, and immediately scanable by component.
- Redundant repetition of identical component scopes is eliminated.
- Automated release generation strictly respects component hierarchies across future releases.
