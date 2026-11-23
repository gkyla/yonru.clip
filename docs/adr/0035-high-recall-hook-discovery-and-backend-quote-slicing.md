# 0035. High-Recall Chronological Hook Discovery & Backend Quote Slicing

Status: Accepted (extends [ADR 0010](0010-scoped-custom-templates-and-natural-ai-hook-detection.md))

Switching the default Hook Discovery Model to `gemini-3.5-flash-lite` revealed that `ModularCompositePromptBuilder` suppressed recall on longer podcasts (~3–5 Hooks per 25–50+ minute video instead of 10–22) for two compounding reasons: asking the LLM to echo verbatim `transcript_quote` strings consumed ~75–85% of the output budget and induced early stopping, while hyper-strict wording ("MOST VIRAL", "Quality over quantity", mandatory "clear gap" between adjacent clips, forced 60-second lookahead, Indonesian/medical-only guardrails, and raw HTML leaked from custom templates) filtered out strong Tier 2 (`70–89`) moments. We decided to omit `transcript_quote` from the LLM JSON schema and slice it deterministically in `HookDiscoveryEngine` from the locally grouped transcript segments, while upgrading `ModularCompositePromptBuilder` for exhaustive chronological scanning with a soft duration-scaled coverage floor (~1 Hook per 3.5 minutes with no upper cap and a skip-if-weak escape hatch), back-to-back adjacent Hook support, runtime HTML sanitization for custom archetypes, language-agnostic/genre-neutral completion guardrails, and deterministic `> 20%` overlap deduplication.

## Considered Options

- **Multi-window transcript chunking**: Splitting long transcripts into overlapping time windows would guarantee mid-video attention, but multiplies API calls by 3–6x (burning free-tier daily quota) and adds cross-window Hook merging complexity. Single-pass discovery with compact output schema is tested first so quota stays low; chunking remains a clean additive layer inside `HookDiscoveryEngine` if 60–90+ minute videos still exhibit middle gaps.
- **Switching default model away from `gemini-3.5-flash-lite`**: Upgrading the default to a larger model recovers some recall immediately, but reduces free-tier daily quota. Keeping `gemini-3.5-flash-lite` as default and making the prompt/engine changes provider-agnostic improves Gemini, OpenAI, Claude, and Grok adapters behind `GenAIClient` alike.
- **UI Hook-yield slider**: Adding manual yield controls contradicts ADR 0010 and clutters the panel when `HookResultsGallery` already ranks and color-codes all discovered Hooks by `virality_score`.

## Consequences

- Downstream consumers and existing cached `hooks.json` files continue using the exact `transcript_quote` field without frontend or storage schema changes; when `video_info.duration` is missing, `HookDiscoveryEngine` derives it from transcript span, and falls back to any pre-existing quote if a sliced range has no words.
- Saved custom templates in `backend/prompts/prompt.json` remain untouched on disk because `ModularCompositePromptBuilder` strips rich-text HTML at prompt-build time.
- Returning both `90–100` peaks and `70–89` (plus borderline `<75`) Hooks increases recall; `HookResultsGallery` keeps the highest-scoring peaks at the top via descending `virality_score` sort while deduplicating `> 20%` overlaps.
