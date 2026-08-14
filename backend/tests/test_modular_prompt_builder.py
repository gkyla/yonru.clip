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
    assert "sweet spot of 30-90 seconds" in prompt
    
    # 3. Output Schema with Virality Score & Explanation
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
