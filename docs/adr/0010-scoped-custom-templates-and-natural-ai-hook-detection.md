# 0010. Scoped Custom Templates & Universal Natural Hook Detection

Date: 2026-08-14

## Status

Accepted

## Context

Following the introduction of the [Modular Composite Prompt Builder](file:///Users/gitkyla/Documents/Codes/yonru.clip/CONTEXT.md#L269-L272) (ADR 0009), there was an architectural misalignment in how Custom Templates were processed compared to Smart Presets:
1. Custom Templates were treated as raw, full-prompt overrides. As a result, critical cutting guardrails (*Thought Completion 4-Step Verification*, *No Overlap Rule*, *Segment Boundary Traps*, and JSON schemas) had to be manually copy-pasted into every template in `prompt.json`.
2. Duration constraints and Topic Focus selections from the Unified Analyzer Panel were ignored during custom template analysis.
3. Templates retained legacy fixed hook count sliders (`num_hooks`), creating false-quota hallucinations on short videos and artificial omission on long videos.

## Decision

1. **Scoped Intent Archetype Override**: Custom Prompt Templates now strictly represent the *Intent Archetype Layer* within the `ModularCompositePromptBuilder`. The user's template content is injected directly as the archetype directive while inheriting all system Core Guardrails, standard JSON format, and bilingual protection automatically.
2. **Universal Dynamic Constraint Injection**: User selections for Duration (`min_duration`, `max_duration`) and Topic Focus (`focus_topic`) in the Unified Analyzer Panel apply uniformly across both Smart Presets and Custom Templates.
3. **100% Natural AI Hook Detection**: The system universally adopts `auto_hooks = true` ("Quality over quantity"). Fixed hook count limits (`num_hooks`) are removed from template configuration and UI editors.
4. **Clean Content-Only Template Storage**: All technical boilerplate (JSON schema, timestamp math, sentence continuity rules, language rules) is stripped from `backend/prompts/prompt.json` and future templates, leaving 100% pure content criteria and tone triggers.
5. **Simplified Template Editor**: The `/prompts` template editor UI is streamlined to focus solely on prompt name, category tags, and content guidelines without technical template variables (`{num_hooks}`, `{duration_constraint}`).

## Consequences

### Positive
- Prevents cutting regressions and hallucinated JSON outputs across all user-created templates.
- Eliminates cognitive load for creators; writing a custom template requires only 2–3 paragraphs of content style criteria.
- Unifies backend pipeline so that improvements to guardrails automatically benefit both presets and custom templates.
- Eliminates quota-forced low-quality hooks.

### Negative / Trade-offs
- Users can no longer arbitrarily override backend output JSON schemas through the custom template editor (which is desired for system stability).
