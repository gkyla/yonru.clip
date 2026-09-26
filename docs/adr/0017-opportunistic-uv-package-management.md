# 0017. Opportunistic uv Package Management and Content Hash Sentinel Caching

Date: 2026-09-27

## Status

Accepted

## Context

Yonru.clip relies on heavy AI and media processing Python packages in `backend/requirements.txt` (`faster-whisper`, `mediapipe`, `opencv-python-headless`, `google-genai`).
Previously, `run.py` unconditionally verified dependencies on every single boot using `pip install -r requirements.txt`. Even when all dependencies were already satisfied, this repeated evaluation introduced 2-3 seconds of unnecessary startup latency and noisy log output.
Additionally, when re-provisioning or updating environments, standard `pip install` resolves and extracts large binary wheels serially, taking 45 seconds to over 2 minutes. Astral's `uv` toolchain provides 10x-100x faster package resolution and parallelized installation using copy-on-write and global cache hardlinking.

## Decision

We adopt a two-tier optimization architecture:

1. **Content Hash Sentinel (`.requirements.hash`)**:
   - `run.py` computes the SHA-256 hash of `backend/requirements.txt`.
   - The hash is recorded in `backend/venv/.requirements.hash` upon successful dependency synchronization.
   - On subsequent launches, if the virtual environment is valid and the stored hash matches the current hash, dependency verification is completely skipped, eliminating 100% of pip/uv overhead during daily startups (0.00ms).
   - If `backend/requirements.txt` is updated (e.g. following a `git pull`), the hash mismatch is automatically detected and triggers dependency installation.

2. **Opportunistic uv Package Management with Standard Fallback**:
   - When dependency installation or environment re-provisioning is required, `run.py` checks for `uv` in `PATH` and standard local directories (`~/.local/bin/uv`, `~/.cargo/bin/uv`).
   - If `uv` is available, virtual environment provisioning utilizes `uv venv` and dependency synchronization runs `uv pip install --python <venv_python> -r requirements.txt`.
   - If `uv` is absent or encounters issues, `run.py` seamlessly falls back to Python's standard `venv` module and `python -m pip install -r requirements.txt`.

3. **Strict Python Runtime Preservation**:
   - The backend service runtime strictly remains standard Python executing FastAPI and Uvicorn (`python -m uvicorn main:app`). `uv` is used solely as an installation accelerator.

## Consequences

### Positive
- **Instant Daily Startup (0.00ms)**: Subsequent launches skip dependency checks completely when requirements have not changed.
- **10x-100x Faster Dependency Resolution**: When changes do occur, developers and CI agents with `uv` experience near-instant resolution and hardlinked installation.
- **Zero Barrier to Entry**: Standard Python users can run `python run.py` without installing `uv`.
- **Self-Healing Accuracy**: Any edits to `requirements.txt` immediately invalidate the sentinel, preventing stale environment bugs.

### Negative / Trade-offs
- Adds a small local sentinel file (`backend/venv/.requirements.hash`) contained entirely within the ignored `backend/venv/` directory.
