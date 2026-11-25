import pytest
from core.modular_prompt_builder import ModularCompositePromptBuilder

def test_default_auto_preset_generation():
    builder = ModularCompositePromptBuilder()
    transcript_text = "[0.00s - 5.00s] Halo semuanya\n[5.00s - 15.00s] Ini adalah podcast rahasia"
    
    prompt = builder.build_prompt(
        transcript_text=transcript_text,
        preset_id="auto",
        focus_topic=None,
        min_duration=30,
        max_duration=180,
        num_hooks=10,
        auto_hooks=True,
        video_duration=None
    )
    
    # 1. Guardrails Check
    assert "NO OVERLAP RULE (CRITICAL)" in prompt
    assert "ACKNOWLEDGMENT FILLER TRAP" in prompt
    assert "THOUGHT COMPLETION RULE (CRITICAL" in prompt or "4-STEP VERIFICATION" in prompt
    assert "LANGUAGE & BILINGUAL RULES" in prompt or "CODE-SWITCHING" in prompt
    assert "FIRST 3 SECONDS TEST" in prompt
    
    # 2. Duration & Constraints
    assert "30 AND 180 SECONDS" in prompt
    assert "Aim for 30-90 seconds" in prompt
    assert "35-90" not in prompt

    # 3. Output Schema with Theme First + Segment IDs + Virality
    assert '"theme" (string)' in prompt
    assert '"start_id" (integer)' in prompt
    assert '"end_id" (integer)' in prompt
    assert '"virality_score" (integer 0-100)' in prompt
    assert '"virality_reason" (string' in prompt
    assert "OUTPUT FORMAT (JSON Array):" in prompt
    assert transcript_text in prompt

def test_archetype_specific_directives():
    builder = ModularCompositePromptBuilder()
    
    # Humor Archetype
    prompt_humor = builder.build_prompt(
        transcript_text="sample text",
        preset_id="humor"
    )
    assert "HUMOR & RELATABLE" in prompt_humor.upper() or "FUNNY" in prompt_humor.upper()
    assert "punchline" in prompt_humor.lower()
    
    # Educational Archetype
    prompt_edu = builder.build_prompt(
        transcript_text="sample text",
        preset_id="educational"
    )
    assert "MYTH" in prompt_edu.upper() or "EDUCATION" in prompt_edu.upper() or "FAKTA" in prompt_edu.upper()
    assert "debunk" in prompt_edu.lower() or "misinformation" in prompt_edu.lower() or "mitos" in prompt_edu.lower()
    
    # Storytelling Archetype
    prompt_story = builder.build_prompt(
        transcript_text="sample text",
        preset_id="storytelling"
    )
    assert "STORY" in prompt_story.upper() or "NARRATIVE" in prompt_story.upper()
    assert "conflict" in prompt_story.lower() or "twist" in prompt_story.lower() or "turning point" in prompt_story.lower()

    # Debate / Hot Takes Archetype
    prompt_debate = builder.build_prompt(
        transcript_text="sample text",
        preset_id="debate"
    )
    assert "OPINION" in prompt_debate.upper() or "HOT TAKE" in prompt_debate.upper() or "DEBATE" in prompt_debate.upper() or "BLAK-BLAKAN" in prompt_debate.upper()

def test_topic_focus_injection():
    builder = ModularCompositePromptBuilder()
    
    # With topic focus
    prompt_with_topic = builder.build_prompt(
        transcript_text="sample text",
        preset_id="auto",
        focus_topic="diet mitos"
    )
    assert "TOPIC FOCUS DIRECTIVE" in prompt_with_topic
    assert "diet mitos" in prompt_with_topic
    
    # Without topic focus
    prompt_no_topic = builder.build_prompt(
        transcript_text="sample text",
        preset_id="auto",
        focus_topic=""
    )
    assert "TOPIC FOCUS DIRECTIVE" not in prompt_no_topic

def test_video_duration_constraint_injection():
    builder = ModularCompositePromptBuilder()
    prompt = builder.build_prompt(
        transcript_text="sample text",
        preset_id="auto",
        video_duration=145.5
    )
    assert "VIDEO DURATION: The total length is 145.5 seconds" in prompt

def test_custom_archetype_injection():
    builder = ModularCompositePromptBuilder()
    custom_content = "INTENT ARCHETYPE — CUSTOM TECH CODING FAILS:\nLook for moments where developer talks about 3am production outages."
    prompt = builder.build_prompt(
        transcript_text="sample text",
        custom_archetype=custom_content,
        focus_topic="database crash",
        min_duration=45,
        max_duration=120
    )
    
    # Custom archetype is injected
    assert custom_content in prompt
    
    # Core guardrails and duration constraints are preserved dynamically without hardcoded 30-90 / 35-90
    assert "TOPIC FOCUS DIRECTIVE" in prompt
    assert "database crash" in prompt
    assert "45 AND 120 SECONDS" in prompt
    assert "Aim for 45-90 seconds" in prompt
    assert "30-90" not in prompt
    assert "35-90" not in prompt
    assert "NO OVERLAP RULE (CRITICAL)" in prompt
    assert "THOUGHT COMPLETION RULE (CRITICAL" in prompt
    assert "OUTPUT FORMAT (JSON Array):" in prompt


def test_custom_archetype_html_sanitization():
    builder = ModularCompositePromptBuilder()
    raw_html_archetype = (
        "<p><strong>Focus:</strong> Highlight contrarian takes &amp; sharp moments.</p>"
        "<ul><li>Include clips with virality_score &lt; 75 if concise</li>"
        "<li>Allow scores <75 when funny</li>"
        "<li>Use line<br/>breaks cleanly&nbsp;here</li></ul>"
    )
    prompt = builder.build_prompt(
        transcript_text="sample text",
        preset_id="humor",
        custom_archetype=raw_html_archetype,
    )

    assert "<p>" not in prompt
    assert "<strong>" not in prompt
    assert "<ul>" not in prompt
    assert "<br/>" not in prompt
    assert "&amp;" not in prompt
    assert "&nbsp;" not in prompt
    assert "Focus: Highlight contrarian takes & sharp moments." in prompt
    assert "- Include clips with virality_score < 75 if concise" in prompt
    assert "- Allow scores <75 when funny" in prompt
    assert "- Use line\nbreaks cleanly here" in prompt

    # Empty HTML-only custom archetype falls back cleanly to built-in preset
    fallback_prompt = builder.build_prompt(
        transcript_text="sample text",
        preset_id="humor",
        custom_archetype="<p><br>&nbsp;</p>",
    )
    assert "punchline" in fallback_prompt.lower()


def test_soft_duration_scaled_coverage_floor():
    builder = ModularCompositePromptBuilder()

    # ~25.6 minute video -> soft floor 7+, no upper cap, skip-if-weak escape hatch
    long_prompt = builder.build_prompt(
        transcript_text="sample text",
        preset_id="auto",
        auto_hooks=True,
        video_duration=1536.0,
    )
    assert "COVERAGE SANITY CHECK" in long_prompt
    assert "7+" in long_prompt
    assert "NO upper cap" in long_prompt
    assert "chronologically" in long_prompt.lower()
    assert "inventing weak filler" in long_prompt.lower()
    assert "Quality over quantity" not in long_prompt

    # Short video (< 3 min) -> no numeric floor, still scans full timeline without stopping early
    short_prompt = builder.build_prompt(
        transcript_text="sample text",
        preset_id="auto",
        auto_hooks=True,
        video_duration=120.0,
    )
    assert "COVERAGE SANITY CHECK" not in short_prompt
    assert "NO upper cap" in short_prompt
    assert "do not stop early" in short_prompt.lower()


def test_output_schema_uses_theme_first_segment_ids_without_quotes():
    builder = ModularCompositePromptBuilder()
    prompt = builder.build_prompt(
        transcript_text="[#0 | 0.00s-10.00s] Sample content",
        preset_id="auto",
    )

    assert '"transcript_quote"' not in prompt
    assert '"start"' not in prompt
    assert '"end"' not in prompt
    assert '"duration_seconds"' not in prompt
    assert '"theme" (string)' in prompt
    assert '"start_id" (integer)' in prompt
    assert '"end_id" (integer)' in prompt
    assert '"virality_score" (integer 0-100)' in prompt
    assert '"virality_reason" (string)' in prompt or '"virality_reason" (string' in prompt
    output_section = prompt.split("OUTPUT FORMAT (JSON Array):")[1]
    assert (
        output_section.index('"theme"')
        < output_section.index('"start_id"')
        < output_section.index('"end_id"')
        < output_section.index('"virality_score"')
        < output_section.index('"virality_reason"')
    )
    assert "do NOT copy or repeat spoken transcript text" in prompt


def test_back_to_back_hooks_allowed_and_universal_guardrails():
    builder = ModularCompositePromptBuilder()
    prompt = builder.build_prompt(
        transcript_text="[#0 | 0.00s-10.00s] Sample content",
        preset_id="auto",
    )

    # Back-to-back adjacent hooks allowed; restrictive gap/winner-takes-all rules removed
    assert "clear gap" not in prompt.lower()
    assert "select only the single strongest" not in prompt.lower()
    assert "back-to-back" in prompt.lower()

    # Language-agnostic and genre-neutral guardrails (payoff completion + boundary filler trim)
    assert "MEDICAL & LOGICAL COMPLETENESS" not in prompt
    assert "medical caveats" not in prompt.lower()
    assert "Scan at least 60 seconds" not in prompt
    assert "any spoken language" in prompt.lower()
    assert "first clean conclusion" not in prompt.lower()
    assert "complete the full payoff" in prompt.lower()
    assert "never begin `start_id` on host transition cues" in prompt.lower()





