# 0016. Opportunistic Bun Package Management with Node Runtime Guardrails

Date: 2026-09-27

## Status

Accepted

## Context

Yonru.clip requires fast initialization for local development and CI workflows across multiple JavaScript/TypeScript packages (`frontend/` for Nuxt 4 and `shared/remotion/` for Remotion composition).
While Bun provides 10x-20x faster package installation times compared to npm, adopting Bun as a full runtime replacement introduces critical architectural hazards:
1. **Remotion Headless Rendering Hazard**: Official Remotion documentation (`docs/bun.mdx`) notes that running Remotion server-side rendering scripts under Bun can cause processes not to terminate/quit automatically upon completion. Because `backend/core/render_engine.py` monitors process output streams and awaits process termination codes, a hanging CLI process would cause video exports to stall and fail. Furthermore, Remotion disables `lazyComponent` under Bun.
2. **Framework & Plugin Tooling**: Nuxt 4 (`^4.4.2`) and its dev server rely on Vite, `@vitejs/plugin-react` (for the Remotion player bridge), and `@nuxt/test-utils` (tightly coupled to Vitest). Replacing the bundler or test runner with `bun build` / `bun test` violates Nuxt's Vue compiler pipeline and breaks Nuxt testing harnesses.
3. **Cross-Platform Developer Environments**: Yonru.clip actively supports macOS, Linux, and Windows (`run.py` process group orchestration). Mandating Bun as a hard prerequisite introduces friction for users who only have Node.js LTS installed.

## Decision

We adopt an **Opportunistic Package Management with Node Runtime Guardrails** model:

1. **Opportunistic Package Installation**:
   - `run.py` checks for the presence of `bun` in `PATH` via `shutil.which("bun")`.
   - If `bun` is available, package bootstrap runs `bun install` for near-instant dependency installation (~2-4s).
   - If `bun` is absent, `run.py` gracefully degrades to `npm install` without throwing errors or prompting the user.
2. **Lockfile & Repository Hygiene**:
   - `package-lock.json` remains the authoritative source of truth for version locking across Git commits.
   - `bun.lock` and `bun.lockb` are added to `.gitignore` to prevent repository noise and lockfile desynchronization.
3. **Strict Node.js Runtime Preservation**:
   - Development servers (`npm run dev`), frontend builds (`nuxt build`), and headless video rendering (`npx remotion render` in `render_engine.py`) strictly execute under Node.js LTS.
   - Vitest remains the test runner for frontend code (`npm test` / `vitest run`).

## Consequences

### Positive
- **10x Faster Package Setup**: Developers and CI agents with Bun benefit from rapid package resolution and symlinking during initial bootstrap.
- **Zero Barrier to Entry**: Users without Bun can clone and run `python run.py` immediately via Node.js fallback.
- **Render Reliability Preserved**: Headless video export remains completely immune to Bun server-side process exit hangs.
- **Zero Framework Breakdown**: Nuxt 4 Vue SFC compilation and Vitest test harnesses operate on their standard, tested runners.

### Negative / Trade-offs
- Developers with Bun installed will have dependencies installed by Bun while developers without Bun use npm, though `package-lock.json` ensures package version parity.
