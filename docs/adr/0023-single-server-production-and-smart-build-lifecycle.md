# 0023. Single-Server Production Serving and Smart Build Lifecycle

Date: 2026-10-13

## Status

Accepted

## Context

Previously, `run.py` coordinated local execution by running two persistent services in parallel:
1. The FastAPI backend via Uvicorn on port 8000 (with `--reload` active).
2. The Nuxt frontend via `npm run dev` on port 3000 (Vite development server with HMR).

While this setup supported rapid frontend UI iteration, it introduced noticeable inefficiencies for daily application usage:
- **Excessive Resource Overhead**: Keeping Vite's dev server active alongside FastAPI consumed extra memory (~80–150MB RSS for Node.js alone) and increased CPU idle cycles.
- **Unoptimized Assets**: Serving unbundled development code meant larger payloads, unoptimized chunk splitting, and redundant module transformation on every page request.
- **Uvicorn Reload Overhead**: Running Uvicorn with `--reload` in daily usage introduced persistent file system watchers (`watchfiles`), increasing CPU churn and risking unintended restarts when transient media files were written.
- **Generic Port Conflicts & Aggressive Sweeping**: Ports 8000 and 3000 are the most widely used defaults across web development (Django, Rails, Docker, Next.js, Vite). Yonru's automatic zombie process port sweeper killed unrelated external processes on ports 8000 and 3000 upon startup.

## Decision

We adopt a **Single-Server Production Architecture with Smart Build Lifecycle and Dedicated Ports**:

1. **Dedicated Application Ports**:
   - **Production / Backend Port**: **`8765`** (replaces generic `8000`).
   - **Frontend Dev Port**: **`3765`** (replaces generic `3000`).
   - Using distinctive, dedicated ports prevents accidental collision with existing dev servers and ensures that Yonru's zombie process cleaner never terminates external user applications.

2. **Single-Server FastAPI in Production Mode**:
   - In production mode (the default for `python run.py`), FastAPI serves both the REST API and the compiled static Nuxt SPA (`frontend/.output/public`) from port `8765`.
   - The Node.js runtime is strictly used during the compilation step (`npm run generate`) and exits cleanly before the server starts. No Node.js process remains running in production.
   - FastAPI mounts static asset directories (such as `_nuxt/`) and provides a client-side Single Page Application (SPA) fallback route for HTML5 History Mode navigation (e.g., `/editor`, `/settings`), serving `index.html` whenever the requested path does not map to a registered API endpoint or physical static file.
   - The API root status is relocated to `/api` or `/api/health`, while `/` serves the Web App UI.

3. **Dynamic Frontend API Base Resolution (`resolveApiBase`)**:
   - Frontend components dynamically resolve the backend URL via `resolveApiBase()`:
     - In production (origin port `8765`), requests use `window.location.origin` (same-origin, zero CORS overhead).
     - In development (origin port `3765`), requests route to `runtimeConfig.public.apiBase` or `http://localhost:8765`.

4. **CLI Modes & Flags in `run.py`**:
   - **Default (`python run.py`)**: Runs in **Production Mode** on `http://localhost:8765`. FastAPI is launched without `--reload`, and a single entrypoint is presented on the dashboard.
   - **`--dev` Flag (`python run.py --dev`)**: Runs in **Development Mode**. Launches the Vite dev server on port `3765` with HMR alongside Uvicorn on port `8765` with reload.
   - **`--port <int>`**: Customizes the backend/production server port (default: `8765`).
   - **`--frontend-port <int>`**: Customizes the frontend dev server port (default: `3765`).
   - **`--no-sweep`**: Disables automatic zombie port sweeping for multi-instance or restricted environments.
   - **`--build` Flag (`python run.py --build`)**: Manually forces a full frontend rebuild.

5. **Smart Build Sentinel & Change Detection**:
   - `run.py` computes a composite sha256 hash of `frontend/package.json`, `frontend/package-lock.json`, `frontend/nuxt.config.ts`, and the file manifest (paths and modification timestamps) of `frontend/app/`.
   - The resulting hash is stored in a sentinel file: `frontend/.output/.build.hash`.
   - If `frontend/.output/public` does not exist or the computed hash differs from the sentinel file, `run.py` automatically initiates `npm run generate`.
   - If the build artifact exists and the hash matches, `run.py` skips the build step and starts instantaneously (< 1 second).

## Consequences

### Positive
- **Optimal Memory & CPU Footprint**: Eliminates the persistent Node.js background process during production runtime and eliminates Uvicorn file watcher overhead.
- **Port Conflict Immunity**: Dedicated ports `8765` and `3765` do not clash with standard development servers.
- **Safe Port Sweeping**: Only Yonru-specific ports are swept, preventing accidental killing of third-party tools.
- **Unified Port Access**: Creators access the full Yonru application at `http://localhost:8765`.
- **Zero Configuration Friction**: Auto-build triggers seamlessly when code changes are detected or on first run; developers retain instant HMR by passing `--dev`.
- **Desktop Readiness**: A single Python/FastAPI server makes future local packaging (e.g., PyInstaller, portable bundles) straightforward.

### Negative / Trade-offs
- Initial build or rebuilt executions require ~15–25 seconds of compilation time before FastAPI starts.
- Developers working on UI changes must pass `--dev` to get Hot Module Replacement.
