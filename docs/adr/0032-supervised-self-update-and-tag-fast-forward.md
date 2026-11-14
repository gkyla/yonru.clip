# 0032. Supervised Self-Update and Tag-Pinned Fast-Forward

Date: 2026-11-14

## Status

Accepted — extends [ADR 0023](./0023-single-server-production-and-smart-build-lifecycle.md) and [ADR 0025](./0025-content-driven-changelog-and-unified-semver.md); Phase 2 design finalized via `/grill-with-docs` (implementation pending).

## Context

Phase 1 (PR `#320`) added remote GitHub Release discovery (`GET /api/releases`), `Installed Version` / `Available Update` tracking, and a copyable terminal command in `HomeChangelog.vue`. Phase 2 introduces a one-click **Update Now** workflow from the **Changelog View**.

Implementing self-update purely inside FastAPI introduces three non-obvious runtime hazards in `yonru.clip`:
1. **Dev Reloader Mid-Pull Crashes**: Under `python run.py --dev`, Uvicorn runs with `--reload` (a reloader parent monitoring `backend/` files) alongside Vite on port `3765`. Running `git` mutations from inside FastAPI triggers mid-flight reloads before new dependencies are installed and prevents `sys.exit()` from exiting the reloader parent back to `run.py`.
2. **Windows Venv File Locks & Orphaned Builds**: `BootstrappedLauncher` in `run.py` runs outside `backend/venv`, whereas Uvicorn executes inside `backend/venv`. Upgrading Python packages while Uvicorn holds open binaries locks files on Windows. Furthermore, `_bootstrap_node_project()` in `run.py` previously skipped package installation whenever `node_modules` already existed, missing newly added npm packages on update.
3. **Runtime-Mutated Tracked Prompt Store**: `backend/prompts/prompt.json` was tracked in Git while `FilePromptRepository` mutated it directly whenever creators edited prompts in the **Prompt Editor**, causing `git status` to appear dirty and blocking clean fast-forward merges.

## Decision

1. **Supervised Two-Stage Update & Launcher Re-Exec (`run.py` + Backend)**:
   - Backend performs **read-only pre-flight checks** (`git status`, `git fetch origin --tags`, ancestor/fast-forward validation, active job and MP4 render detection, loopback/origin trust verification) without mutating repository files.
   - When running under `run.py` (indicated via launcher supervision environment metadata), Backend signals an update request over an IPC control channel. `ServiceCoordinator` cleanly terminates all child process groups (`Backend` including `--reload` parent/worker, and `Frontend` Vite in `--dev`) **before** changing any repository files.
   - `run.py` performs the Git update, then re-execs itself (`os.execv` on POSIX, respawn-and-exit on Windows) preserving CLI flags (`--dev`, `--port`, `--frontend-port`, `--no-sweep`) and passing a skip-browser flag (`--no-browser`) so the newly pulled `run.py` executes bootstrap steps without opening a duplicate browser tab.
   - Extend `_bootstrap_node_project()` in `run.py` with a package-manifest hash sentinel (matching `_bootstrap_backend()`'s `.requirements.hash` pattern) so updates modifying `frontend/package.json` or `shared/remotion/package.json` install new packages automatically.
   - When Backend runs standalone without `run.py`, self-update restart is reported unavailable and the UI surfaces the manual terminal fallback.

2. **Tag-Pinned Fast-Forward (`refs/tags/vX.Y.Z`)**:
   - Self-Update runs `git fetch origin --tags` and `git merge --ff-only refs/tags/vX.Y.Z` on `main` (after verifying `HEAD` is on `main` and is an ancestor of the target release tag).
   - This guarantees the local workspace lands strictly on the published GitHub Release tag without entering detached `HEAD` and without pulling unreleased commits ahead of the tag on `origin/main`.
   - The manual fallback command in `HomeChangelog.vue` matches this tag-exact flow: `git fetch origin --tags && git merge --ff-only vX.Y.Z && python run.py`.

3. **Strict Clean-Tree Gate & Starter Prompt Template Separation**:
   - Pre-flight rejects self-update whenever tracked repository files have uncommitted modifications, displaying the dirty file list and manual fallback rather than using `git stash` (which risks conflict markers breaking JSON or Python startup).
   - Separate `backend/prompts/prompt.json` into a tracked starter template (`backend/prompts/prompt.example.json`) and a gitignored local runtime file (`backend/prompts/prompt.json`), seeded automatically on startup if missing (mirroring `backend/.env.example` → `backend/.env`).
   - During updates across versions where `prompt.json` was previously tracked, the updater backs up and restores local `prompt.json` edits so creator prompts are never lost or treated as a dirty-tree blocker.

4. **Temporary Status Server & Automatic Rollback**:
   - Once FastAPI releases the backend port (`8765`), `run.py` immediately serves a lightweight Python stdlib `http.server` on that port (with CORS headers for `--dev` on `3765`) exposing live step progress (`GET /api/self-update/status`).
   - If `git merge`, Python/Node dependency installation, or `npm run generate` fails, `run.py` rolls back via `git reset --hard <initial_commit>` (safe due to the clean-tree gate and `prompt.json` backup), records the error message, and restarts the previous working server version so the UI recovers cleanly and displays the failure details.

5. **Concurrency & Loopback Trust Guardrails**:
   - Pre-flight blocks updates while any background pipeline job (`queued`, `downloading_video`, `checking_transcript`, `transcribing`, `generating_hooks`, `cutting`, etc.) or active Remotion MP4 render is in progress.
   - Because `run.py` binds Uvicorn to `0.0.0.0` and FastAPI enables `allow_origins=["*"]`, update trigger endpoints enforce loopback client IP (`127.0.0.1` / `::1`) and local `Origin`/`Referer` (`localhost` / `127.0.0.1` / `[::1]`) checks alongside a single-flight lock.

6. **Changelog View UI & Post-Restart Verification (`HomeChangelog.vue`)**:
   - Place the primary **Update Now** button inside the `Available Update` banner alongside **View vX.Y.Z on GitHub**, with the manual fallback command tucked into a collapsible disclosure (auto-expanded when self-update is unavailable or blocked).
   - Clicking **Update Now** opens a pre-flight confirmation modal that displays checks, shows live progress during restart, verifies `currentVersion === targetVersion` (and Vite readiness in `--dev`) before reloading the page with a post-update confirmation toast, and preserves the modal error state on rollback.

## Considered Options

- **Backend-only self-update (`git pull` + `pip`/`npm` + respawn inside FastAPI) vs. Supervised Two-Stage (`run.py` + Backend)**: Rejected backend-only execution because `uvicorn --reload` triggers mid-pull reloads in `--dev` and Windows locks active `backend/venv` files.
- **Branch tracking pull (`git pull --ff-only`) vs. Tag-pinned fast-forward (`git merge --ff-only refs/tags/vX.Y.Z`)**: Rejected `git pull` to avoid pulling unreleased commits above the published GitHub Release tag while still keeping users on `main`.
- **Auto-stash dirty trees vs. Strict clean-tree gate + `prompt.example.json` split**: Rejected `git stash` / `stash pop` due to unattended merge-conflict risk; solved the sole legitimate runtime-mutated file (`prompt.json`) at the root via gitignore separation.
- **Blind reconnect polling vs. Temporary stdlib status server + auto-rollback**: Rejected blind polling because build/install failures would leave the browser hanging indefinitely on a dead port without error feedback or recovery.

## Consequences

- `run.py` gains an explicit supervision contract (env metadata, IPC control signal, `--no-browser` flag, temporary HTTP status server, and rollback handler), making headless self-update testable via seams.
- First-time updates crossing from `v0.3.0` (where `prompt.json` is still tracked) require backup/preserve handling during the merge transition so user-edited prompts survive intact.
- Remote LAN clients viewing the Web UI on `0.0.0.0` see update availability but cannot trigger host self-updates remotely.
