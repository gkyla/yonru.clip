# Developer Agent Coordination Guidelines (AGENTS.md)

This document formalizes the development guidelines, testing loops, and architectural rules for agentic assistants working on the **yonru.clip** codebase.

## Technology Stack & Framework Anchoring
- **Frontend**: **Nuxt 4 (`^4.4.x`)** using the `frontend/app/` directory structure, **Vue 3.5+**, **Vite**, and **TailwindCSS**. Developer agents must strictly anchor all mental models and documentation to Nuxt 4 (never Nuxt 3).
- **Backend**: **Python 3.12+**, **FastAPI**, and **Pyright**.
- **Inspection Rule**: Always check `frontend/package.json` before diagnosing issues or proposing framework changes.

## Detailed Guidelines

For specific guidelines, see:
- [Architecture & State Management](.agents/instructions/architecture.md)
- [Testing & TDD Loop](.agents/instructions/testing.md)
- [TypeScript & Frontend Style](.agents/instructions/typescript.md)
- [Security Guidelines](.agents/instructions/security.md)
- [Development Environment](.agents/instructions/development.md)

## Active Workspace Rules

For core workflow rules that are automatically loaded and enforced:
- [GitHub / Git Workflow Rules](.agents/rules/github-workflow-rules.md)
- [RTK Command Proxy Rules](.agents/rules/antigravity-rtk-rules.md)

## Agent skills

### Issue tracker

Issues and PRDs for this repo live as GitHub issues. See [issue-tracker.md](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/agents/issue-tracker.md).

### Triage labels

Canonical triage roles mapped 1:1 to repo labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [triage-labels.md](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/agents/triage-labels.md).

### Domain docs

Single-context repository layout (`CONTEXT.md` + `docs/adr/`). See [domain.md](file:///Users/gitkyla/Documents/Codes/yonru.clip/docs/agents/domain.md).

