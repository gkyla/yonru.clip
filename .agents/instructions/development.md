# Development Environment Guidelines

## Overview
Guidelines for environment isolation, automated bootstraps, and pre-commit checks in the **yonru.clip** codebase.

## Rules

### 1. Self-Healing & Bootstrapping
- **Coordinator Dependency**: Always rely on the built-in system coordinator (`run.py`) to manage dependencies, provision virtual environments (`backend/venv`), and synchronize offline fonts. Avoid manually installing `pip` or `npm` packages globally.

### 2. Environment Isolation
- **No Global Commands**: Never run system global commands when verifying code.
- **Backend Execution**: Always use virtualenv binary paths directly (e.g., `backend/venv/bin/pytest` or `backend/venv/bin/python`).
- **Frontend Execution**: Use local package manager scripts (e.g., executing `npm run test` or `npm run typecheck` inside the `frontend/` folder).

### 3. Type Safety Enforcement
- **Mandatory Typecheck**: When modifying frontend code, developer agents MUST run `rtk npm run typecheck` inside the `frontend/` directory to ensure changes do not break type safety.
- **Git Hook Automation**: This check is automated via a Git pre-commit hook (Husky) which runs typecheck and unit tests before any commit is processed. Do NOT bypass this check (e.g., via `--no-verify`) unless explicitly instructed.
