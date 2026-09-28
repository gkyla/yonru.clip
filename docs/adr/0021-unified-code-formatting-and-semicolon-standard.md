# 0021. Unified Code Formatting and Semicolon Standard

Date: 2026-09-28

## Status

Accepted

## Context

During frontend development of Yonru Clip (Nuxt 4, Vue 3.5, TypeScript), formatting standards between `.vue` Single File Components and standalone `.ts` files diverged:
1. **Split Mental Model**: Semicolons were disabled globally in Prettier (`semi: false`), while `.vue` files attempted to override this (`semi: true`). Because Prettier's glob pattern `"files": "*.vue"` only matched root files, nested Vue components in `frontend/app/` fell back to omitting semicolons.
2. **Vue Template Parser Pitfall**: Vue's SFC compiler (`@vue/compiler-core` with Babel) parses multiline inline attribute expressions (e.g. `@click="state.a = 1; state.b = 2"`) as expressions. Removing semicolons in inline handlers frequently resulted in `SyntaxError: Unexpected token, expected ","`.
3. **Linter vs Formatter Friction**: ESLint's default `vue/html-self-closing` rule conflicted with Prettier's HTML void element formatting (`<input>` vs `<input />` and `<div></div>` vs `<div />`), generating hundreds of distracting warnings in terminal logs.

## Decision

1. **Universal Semicolon Enforcement (`semi: true`)**:
   - Enforce `semi: true` across all frontend file formats (`.vue`, `.ts`, `.js`, `.mjs`, `.json`, `.css`) in `.prettierrc`.
   - Eliminate per-file overrides to provide a single, unified mental model for all contributors.
2. **ESLint and Prettier Alignment**:
   - Align `vue/html-self-closing` in `eslint.config.mjs` with Prettier's HTML5 output:
     - `void: 'always'` (`<input />`, `<img />`)
     - `normal: 'never'` (`<div></div>`, `<span></span>`)
     - `component: 'always'` (`<MyComponent />`)
   - Relax `@typescript-eslint/no-unused-vars` and `vue/no-unused-vars` to `'warn'` so development workflows are not halted by unused variables during active iteration.
3. **Automated Formatting on Save & Pre-Commit**:
   - Configure `.vscode/settings.json` with `editor.formatOnSave: true`, `editor.defaultFormatter: esbenp.prettier-vscode`, and `editor.codeActionsOnSave` invoking `source.fixAll.eslint: explicit`.
   - Enforce formatting on staged files before commit via Husky and `lint-staged`.

## Consequences

### Positive
- Zero ambiguity: every statement across `.ts` composables, utilities, and `.vue` components consistently terminates with a semicolon.
- 100% immunity to Vue SFC multiline inline expression compiler errors.
- ESLint and Prettier work harmoniously without conflicting warnings or formatting ping-pong on save.
- All contributors automatically receive consistent code formatting on save and before commits without manual scripts.

### Negative / Trade-offs
- Developers accustomed to semicolon-free JavaScript/TypeScript must adhere to semicolons throughout the codebase.
