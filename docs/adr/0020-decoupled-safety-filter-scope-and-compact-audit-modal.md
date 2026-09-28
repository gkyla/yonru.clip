# 0020. Decoupled Safety Filter Scope & Compact Content Safety Modal

Date: 2026-09-28

## Status

Accepted

## Context

In Yonru Clip, creators customize sensitive word detection and censorship via the "Customize Filter Blacklist" modal (`BlacklistSettings.vue`). Two critical issues hampered user experience:
1. **Coupled & Confusing Safety Sensitivity**: The sensitivity setting (`strict`, `standard`, `manual`) attempted to explain both subtitle masking and audio bleeping in dense text paragraphs, even though audio bleeping was a separate toggle below. Furthermore, an engine inconsistency in `safetyEngine.ts` forced `standard` mode to pull in all words when audio bleeping was enabled, causing standard mode to behave identically to strict mode.
2. **2-Column Layout & Nested Scrollbars**: The desktop 2-column layout caused multiple conflicting scroll regions (modal body, left settings column, right tab content, and inner category chip scroller), violating the project's `/ui-ux-pro-max` guidelines. Managing custom words also lacked bulk multi-word input (e.g. comma-separated pasting).

## Decision

1. **Decoupled Safety Filter Scope**:
   - Establish **Safety Filter Scope** as a pure keyword detection threshold (`Strict`, `Standard`, `Custom Only`), strictly decoupled from remediation actions (Subtitle Masking and Audio Bleeping).
   - In `safetyEngine.ts`, ensure `standard` sensitivity exclusively checks severe shadowban keywords (plus user-added category words) regardless of whether `audioBleepEnabled` is `true` or `false`.
   - Rename the UI label `manual` to `Custom Only` (retaining the serialized value `'manual'` for 100% backward compatibility with `localStorage` and export pipelines).

2. **Unified Top-Level Tabbed Modal**:
   - Refactor `BlacklistSettings.vue` into a focused single-column modal (`max-w-2xl`) with 4 top-level tabs:
     - **General & Audio**: Safety Filter Scope selector, Subtitle Masking Style picker, and 3 direct Audio Bleep options (`Mute Only`, `Classic Bleep`, `Custom Sound`) with progressive disclosure for sound library/upload and collapsed advanced timing buffer.
     - **Word Categories**: Violence, Sexual, Profanity with clean toggles, chips, edit, and reset actions.
     - **Custom Blacklist**: Compact chip/tag grid with instant search, fast delete, count, and comma-separated multi-word entry.
     - **Whitelist**: Compact chip/tag grid for exception words with multi-word entry.

3. **Multi-Word Comma Input**:
   - Support pasting and entering comma-separated keywords (e.g. `casino, slot, judi`) to parse and append multiple entries in one action.

## Consequences

### Positive
- Crystal-clear creator mental model: Filter Scope decides *what* is flagged; Masking & Bleeping decide *how* it is censored.
- Eliminates nested scrollbars and layout shifting across viewport sizes.
- Creators can rapidly bulk-paste blacklist keywords.
- Zero breaking changes to `localStorage` schemas or backend export payloads.

### Negative / Trade-offs
- Users who previously saw all settings simultaneously in two columns now navigate between 4 top-level tabs.
