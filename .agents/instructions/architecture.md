# Architecture Guidelines

## Overview
Guidelines for managing project architecture, module depth, boundaries, and persistent state in the **yonru.clip** codebase.

## Rules

### 1. Deep Modules and Clean Seams
- **Prioritize Depth**: Write modules that concentrate rich, complex behavior behind highly simplified, stable public interfaces. Do not build shallow pass-through controllers.
- **Locality of Change**: Bugs, state transformations, and subprocess executions must remain isolated inside their specific adapter domains. Never leak raw file systems, job-polling mutations, or platform-specific FFmpeg details across seams.
- **Double Adapters**: Define clear seams via abstract ports (e.g., `AssetStore` abstract class) with at least two adapters:
  1. A production adapter (`AssetRepository`) communicating with the disk/subprocesses.
  2. A highly performant mock adapter (`MockAssetStore`) for deterministic unit/integration testing.

### 2. Frontend Composable Modularity
- **Decoupled Composables**: Refactor monolithic frontend composables (e.g., state composables exceeding 1,000 lines) into highly decoupled, specialized domain sub-composables (e.g., timeline sequencing, system diagnostics, safety auditing).
- **Facade Mediator Pattern**: Parent state composables must act strictly as clean mediator facades, delegating domain operations and state refs directly to sub-composables rather than maintaining duplicate local logic or shallow wrapper helpers.
- **Decoupled Shared Reactivity**: Leverage matching global state keys (e.g., Nuxt's `useState<T>('key')`) across sub-composables to share reactive state seamlessly, preventing parameter drill-down and keeping domain boundaries high.

### 3. Persistent State Guidelines
- **Atomic Updates**: Because state stores (like `JSONFileJobStore`) use directory-based per-job file storage, always retrieve, mutate locally, and explicitly re-assign the job dictionary (`self.jobs[job_id] = job`) to trigger thread-safe, atomic per-file serialization. Mutating in-place nested dictionaries directly on store objects is forbidden.
