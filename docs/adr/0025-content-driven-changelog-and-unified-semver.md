# 0025. Content-Driven Changelog and Unified Semantic Versioning

Date: 2026-10-21

## Status

Accepted

## Context

Yonru Clip previously referenced a `/changelog` route within its Navigation Sidebar footer and Command Palette, but lacked the underlying route, page, and content infrastructure. Furthermore:
1. Version numbers were disparate and unsynchronized: `backend/main.py` hardcoded `FastAPI(..., version="2.0.0")` from a prior major rebrand, while `frontend/package.json` had no `version` field, and git tags were nonexistent.
2. Release notes had no canonical format, storage location, or presentation guidelines. Developers faced the ambiguity of choosing between hardcoded TypeScript arrays, monolithic root `CHANGELOG.md` files, or dynamic GitHub API queries.
3. Creators using Yonru locally (bootstrapped via `python run.py`) require fast, offline-resilient access to release notes without being subject to external API rate limits or network failures.

## Decision

1. **Unified Semantic Versioning (SemVer) Baseline (`v0.1.0`)**:
   - Establish a unified application version baseline starting at `v0.1.0`, reflecting the active public preview / beta state of the platform.
   - Synchronize the single source of truth across the entire workspace:
     - `frontend/package.json`: `"version": "0.1.0"`
     - `backend/main.py`: `app = FastAPI(title="Yonru API", version="0.1.0")`
     - Git tags: `v0.1.0`
     - Documented releases in `content/changelog/`

2. **Modular Content-Driven Architecture via `@nuxt/content` v3**:
   - Store release notes as isolated, per-version Markdown files in `content/changelog/` (e.g. `0.1.0.md`).
   - Every release document specifies structured YAML frontmatter:
     - `version`: e.g. `"0.1.0"`
     - `date`: Release date (YYYY-MM-DD)
     - `title`: Curated release highlight title
     - `badge`: Optional status chip (e.g. `"Initial Release"`, `"Latest"`)
   - Nuxt Content manages querying, caching, and MDC (Markdown Component) rendering without requiring third-party REST API dependencies or monolithic regex parsers.

3. **Changelog View & Linear-Style Vertical Timeline Feed**:
   - Expose the `/changelog` route mapped to `HomeChangelog.vue`.
   - Structure release notes into a clean vertical timeline feed with brand gold (`#ffd700`) node markers, clickable version chips, release dates, and categorized release items (`Features`, `Improvements`, `Bug Fixes`) styled with semantic Lucide icons (`lucide:sparkles`, `lucide:wrench`, `lucide:bug`) in tinted micro-badges and matching solid semantic colored titles (Emerald, Amber, Rose).
   - Provide direct external links to matching GitHub Releases (`https://github.com/gkyla/yonru.clip/releases/tag/v<version>`).

4. **Automated Release Note Generation from Conventional Commits**:
   - Provide an automated CLI release helper (`scripts/generate_release.py` / `npm run release`) that parses git history since the previous tag, categorizes commits (`feat` -> New, `refactor`/`style`/`perf` -> Improved, `fix` -> Fixed), increments the version across frontend and backend, and creates the draft Markdown document.

## Consequences

- All workspace components (frontend, backend, git, and UI) share a single unified version.
- Changelog documentation is fully offline-capable, type-safe, and free from git merge conflicts across release branches.
- Upgrading or cutting future releases is automated and follows standard Conventional Commits.
