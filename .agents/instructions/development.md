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

### 4. Technology Stack & Framework Anchoring
- **Frontend Stack**: The frontend runs on **Nuxt 4 (`^4.4.x`)** with the `frontend/app/` directory structure, **Vue 3.5+**, **Vite**, and **TailwindCSS**. Developer agents must strictly anchor all mental models, solutions, and MCP queries to **Nuxt 4.x** standards (e.g., `/docs/4.x/` via Nuxt MCP) and never conflate or refer to Nuxt 3 conventions.
- **Backend Stack**: The backend runs on **Python 3.12+**, **FastAPI**, **Uvicorn**, and **Pyright**.
- **Mandatory Stack Inspection**: Before diagnosing bugs, proposing architecture changes, or consulting documentation, agents MUST check `frontend/package.json` and backend dependencies to confirm active library versions and avoid outdated API assumptions.
- **MCP Documentation Lookup**:
  - For Nuxt 4: Always use the dedicated `nuxt` MCP server (`get-documentation-page`, `list-documentation-pages`).
  - For all other packages & libraries (e.g., Vue 3.5, TipTap, Konva, WaveSurfer.js, FastAPI, Pydantic, TailwindCSS): Always use the `context7` MCP server (`resolve-library-id`, `query-docs`) to look up accurate, version-specific documentation before implementing.
