---
trigger: always_on
---

# UI Skills Workflow Rules

For any UI/frontend design, component, layout, styling, or UX review task (skip for pure backend, API, DB, or non-visual tasks), apply these three skills strictly in their assigned role and order:

1. **Design Direction & Layout (`frontend-design`) — BEFORE coding**:
   - Read `.agents/skills/frontend-design/SKILL.md` first to establish aesthetic direction, typography, color tokens, and layout plan before writing UI code.
   - Owns creative direction and restraint; does not override technical stack rules or quality gates.

2. **Technical Reference & Stack Lookup (`ui-ux-pro-max`) — DURING planning/implementation**:
   - Use `.agents/skills/ui-ux-pro-max/SKILL.md` and its `data/` search strictly as technical reference (UX rules, font pairings, palettes, and `nuxtjs.csv` for Nuxt 4 / Vue 3.5).
   - Never use `ui-ux-pro-max` for creative direction over `frontend-design`, and ignore any `Nuxt 3` or React snippets that conflict with this repo's **Nuxt 4 (`frontend/app/`)** stack in `AGENTS.md`.

3. **Quality Filter & Delivery Gate (`antislop`) — DURING / AFTER implementation**:
   - Read `.agents/skills/antislop/SKILL.md` and follow its `Two Usage Modes` flow as the final quality filter (purpose test, liveliness, empty/loading/error states, contrast, keyboard focus).
   - Filters and audits output; never invents aesthetic direction on its own and never overrides `AGENTS.md` or `.agents/instructions/`.
