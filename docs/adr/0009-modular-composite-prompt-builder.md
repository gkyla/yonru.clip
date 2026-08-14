# 0009. Modular Composite Prompt Builder & Intent Presets

Date: 2026-08-14

## Status

Accepted

## Context

Previously, `yonru.clip` relied on a raw "Prompt Template" selector where users had to either select from full-length system prompt JSON files or write their own complex prompt engineering rules before analyzing a video. This caused significant UX friction:
1. Casual users were forced to evaluate verbose prompt templates before processing a URL.
2. Improvements to critical cutting guardrails (such as the *No Overlap Rule*, *Thought Completion 4-Step Verification*, or *Bilingual Code-Switching Protection*) had to be manually duplicated across multiple prompt files.
3. Users could not easily guide hook detection towards specific vibes (e.g. Humor, Education, Storytelling) or topics without rewriting raw prompts.

## Decision

1. **Dual Extraction Mode**: Support two extraction modes in the Unified Analyzer Panel:
   - `Smart Presets` (Default, Zero-Friction): Creators choose from curated content archetypes without exposing raw prompt engineering.
   - `Custom Prompt` (Advanced): Power users can still pick or create full custom prompt templates from the template repository.
2. **Modular Composite Prompt Builder**: Ingested transcripts are processed via a modular backend prompt engine comprising four composable layers:
   - **Core Guardrails Layer**: Non-negotiable rules applied universally (strict timestamp derivation from transcript metadata, *No Overlap Rule*, *Segment Boundary & Acknowledgment Filler Trap*, *4-Step Thought Completion Verification*, *Bilingual Code-Switching Protection*, *First 3 Seconds Test*, and standard JSON schema).
   - **Intent Archetype Layer**: Calibrated directives for specific content vibes (`auto` / Auto Viral, `humor` / Funny & Relatable, `educational` / Educational & Debunk, `storytelling` / Deep Talk & Story, `debate` / Hot Takes & Opinions).
   - **Topic Focus Layer**: Optional user-specified focus keywords/topics dynamically injected as prioritization directives.
   - **Target Constraints**: Configurable duration boundaries defaulting to 30s–180s (with a sweet spot of 30–90s unless the story requires full completion).
3. **Virality Score & Explanation Engine**: Each generated hook includes a normalized `virality_score` (0–100) and an English `virality_reason` analyzing the structural strength of the first 3 seconds, emotional delivery, and retention potential. Extracted hooks are sorted descending by virality score by default.
4. **UI/UX Pro Max Alignment**: Implement preset selection using accessible, vector-icon horizontal pills with subtle micro-interactions (150–300ms transitions, WCAG AA contrast, and >=44px touch targets), backed by an expandable drawer for optional focus keywords and duration preferences. Virality scores render as color-coded glowing badges (Tier 1: 90–100 Emerald/Amber, Tier 2: 75–89 Cyan, Tier 3: <75 Slate) with tooltip reasoning.
5. **Backward-Compatible API Payload**: Extend `/api/process_url` and related endpoints to accept `extraction_mode`, `preset_id`, `focus_topic`, `min_duration`, and `max_duration` while seamlessly falling back to `custom` mode when legacy `prompt_file` identifiers are provided.

## Consequences

### Positive
- Eliminates onboarding friction; casual creators can generate hooks with a single click.
- Quality fixes to sentence boundaries and timestamp safety automatically propagate across all preset styles.
- Creators gain flexible topic targeting and duration control without writing prompt boilerplate.
- Existing custom prompt workflows remain fully functional without breaking changes.

### Negative / Trade-offs
- The backend prompt assembler requires comprehensive unit testing to verify that dynamically combined layers construct syntactically and semantically valid LLM prompts.
