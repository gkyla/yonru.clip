# TypeScript & Frontend Style Guidelines

## Overview
Coding and design guidelines for frontend and TypeScript development in the **yonru.clip** codebase.

## Rules

### 1. Strict Type Safety
Always follow these type safety guidelines to satisfy compiler checks and ensure robustness:

- **No `any`**: Explicitly avoid `any` or `any[]` declarations. Use `unknown` or `Record<string, unknown>` for arbitrary/dynamic JSON payloads, and leverage type guards or runtime validation instead of loose assertions.
- **Explicit `useState` Type Parameters**: Always specify type parameters on Nuxt's global state hook: `useState<T>('key', () => defaultVal)`.
- **Strict Indexing Guardrails**: Nuxt 4 configures `noUncheckedIndexedAccess: true` by default. Index-based element accesses (e.g., `array[0]`) must be explicitly checked (via `if (item)` or `??`) or asserted (via `!`) to satisfy the compiler.
- **Centralized Type Repository**: Co-locate all core data definitions (such as hooks, timeline tracks, and style settings) inside `frontend/app/types/clipper.ts`.
- **Prefer `interface` over `type`**: Use `interface` for declaring new object shapes (for better compiler error messages and extendability), and use `type` for unions, intersections, or complex utility mappings.
- **Avoid Type Assertions**: Avoid unsafe type assertions (e.g., `as T`) in core logic. Use proper type guards (`isT`) or let TypeScript infer types automatically. Assertions should only be used as a last resort at interface boundaries or seams (such as mapping third-party/external library states).
