from typing import Optional, Dict

class ModularCompositePromptBuilder:
    """
    Modular Composite Prompt Builder
    Dynamically assembles Core Guardrails, Intent Archetypes, Topic Focus Directives,
    and Target Constraints into a high-precision prompt for Gemini hook extraction.
    """
    
    ARCHETYPES: Dict[str, str] = {
        "auto": """INTENT ARCHETYPE — UNIVERSAL AUTO VIRAL:
Identify the absolute most captivating, high-retention podcast moments across all styles:
- Unusually honest, bold, or unfiltered statements
- Unexpectedly funny, witty, or relatable punchlines
- Surprising revelations, debunked misconceptions, or mind-blowing facts
- Engaging storytelling with strong emotional peaks or plot twists
- Relatable thoughts that make viewers think: "Ini jujur banget" or "Relate parah".""",

        "humor": """INTENT ARCHETYPE — HUMOR & RELATABLE MOMENTS:
Prioritize funny, entertaining, and relatable moments:
- Spontaneous laughter, sharp comedic timing, and witty comebacks
- Absurd, hilarious, or self-deprecating personal experiences
- Punchlines and banter between speakers
- Highly relatable everyday observations that evoke humor
- Moments where the speaker is playfully blunt or sarcastic.""",

        "educational": """INTENT ARCHETYPE — EDUCATIONAL & MYTH DEBUNKING:
Prioritize educational breakdowns, medical/scientific revelations, and "MYTHS & FACTS" segments:
- Direct debunking of common myths, misconceptions, or dangerous misinformation
- Clear, simple analogies that make complex topics instantly understandable
- Authoritative, passionate, or eye-opening explanations from experts
- Surprising health, science, or life facts that contradict common belief
- Practical, actionable advice backed by solid reasoning.""",

        "storytelling": """INTENT ARCHETYPE — DEEP TALK & STORYTELLING:
Prioritize narrative story arcs and personal reflections:
- Gripping personal stories (real cases, turning points, failures, triumphs)
- Clear narrative structure: 1. Setup/Context, 2. Conflict/Shocking moment, 3. Resolution/Lesson
- Deep emotional moments, vulnerability, and life lessons
- Sudden twists or realizations where things didn't go as expected
- Stories that keep the audience eager to know what happened next.""",

        "debate": """INTENT ARCHETYPE — HOT TAKES, OPINIONS & DEBATE:
Prioritize controversial, opinionated, and passionate discourse:
- Bold, unfiltered opinions that challenge mainstream consensus
- Passionate arguments, healthy debate, or strong rebuttals
- "Unpopular opinions" delivered with conviction and authentic emotion
- Statements that provoke immediate thought, curiosity, or discussion in the comments
- Raw, direct reactions to pressing societal or industry topics."""
    }

    def __init__(self):
        pass

    def build_prompt(
        self,
        transcript_text: str,
        preset_id: str = "auto",
        focus_topic: Optional[str] = None,
        min_duration: int = 30,
        max_duration: int = 180,
        num_hooks: int = 10,
        auto_hooks: bool = False,
        video_duration: Optional[float] = None
    ) -> str:
        """
        Build the complete composite prompt.
        """
        archetype_key = preset_id.lower() if preset_id else "auto"
        archetype_directive = self.ARCHETYPES.get(archetype_key, self.ARCHETYPES["auto"])

        # 1. Quantity instruction
        if auto_hooks:
            hook_count_instruction = "Find ALL naturally compelling hooks in the transcript. Do not force a specific number — return as many or as few as genuinely qualify. Quality over quantity."
        else:
            hook_count_instruction = f"Find exactly {num_hooks} hooks."

        # 2. Topic Focus Directive
        topic_directive = ""
        if focus_topic and focus_topic.strip():
            topic_directive = f"""
TOPIC FOCUS DIRECTIVE (HIGH PRIORITY):
The creator specifically requested hooks focusing on: "{focus_topic.strip()}".
Prioritize transcript segments discussing this topic or directly related themes while maintaining strict hook virality standards.
"""

        # 3. Video Duration Constraint
        video_duration_clause = ""
        if video_duration:
            video_duration_clause = f"\nVIDEO DURATION: The total length is {video_duration:.1f} seconds. ALL timestamps MUST be within 0 and {video_duration:.1f}."

        # 4. Assemble Composite Prompt
        prompt = f"""You are an expert editor for viral podcast shorts (YouTube Shorts / Reels / TikTok).

Your job is to read the transcript and identify the MOST VIRAL podcast moments ("hooks").
{hook_count_instruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{archetype_directive}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{topic_directive}
HOOK SELECTION & FIRST 3 SECONDS TEST:
1. CONTEXT INDEPENDENCE RULE: The segment must be completely understandable without earlier context from the video.
2. HOOK START RULE: The first sentence MUST already feel like an immediate hook when watched alone.
3. FIRST 3 SECONDS TEST: If the first 3 seconds do not create curiosity, emotion, surprise, or an engaging scene, skip it.
4. NEVER start a hook from greetings, host introduction, or generic filler talk.

NO OVERLAP RULE (CRITICAL):
1. Hooks MUST NOT overlap in time. If you identify a hook from 02:10 to 03:20, you CANNOT create another hook that starts or ends within that same timeframe.
2. If two candidate hooks overlap or are close together:
   - If they are part of the same continuous thought/story, combine them into ONE single hook (staying under the {max_duration}s limit).
   - If they are separate thoughts, select ONLY the single strongest, most viral one.
3. Ensure there is a clear gap between the end timestamp of one hook and the start timestamp of the next.

SEGMENT BOUNDARY TRAP & ACKNOWLEDGMENT FILLER TRAP:
YouTube transcript segments do NOT always align with complete thoughts. Treat each segment end as a CANDIDATE only.
The following acknowledgment words, when appearing as the LAST text of a segment, are NEVER valid endpoints:
"Iya sih", "Iya", "Oke", "Oh", "Hmm", "Gitu", "Nah", "Wah", "Oh gitu", "Oh oke", "I see", "Berarti", "Bener", "Bener sih", "Emang", "Emang sih", "Hm", "He", "Ya", "Iya dong", "Iya kan", "Betul", "Betul sih", "Yep", "Yap".
When the chosen segment ends with any of the above, read the next 2-3 segments and ALWAYS extend if the speaker continues.

THOUGHT COMPLETION RULE (CRITICAL — 4-STEP VERIFICATION):
Before finalizing any "end" timestamp, perform this 4-step verification:
STEP 1 — READ AHEAD AGGRESSIVELY: Scan at least 60 seconds beyond your initially chosen end timestamp.
STEP 2 — CHECK FOR INCOMPLETE THOUGHT SIGNALS:
The current end is NOT acceptable if:
- Sentence ends mid-clause with no conclusive phrasing.
- Speaker uses continuation words ("jadi...", "nah...", "kemudian...", "terus...", "makanya...", "karena itu...", "intinya...", "poinnya...") and the following sentence continues the topic.
- Speaker is still listing items ("pertama...", "kedua...") and the list is not complete.
- A term, analogy, or concept was introduced but not fully explained.
- Segment ends on a colloquial filler ("gitu", "kan", "nah", "nih", "tuh", "lho", "dong", "deh", "sih", "aja") AND the very next segment begins with a contrast/continuation word ("tapi", "kalau", "cuma", "padahal", "sebenarnya", "yang perlu diingat", "yang bahaya", "yang penting"). ALWAYS extend.
STEP 2.5 — CONTRAST & CAVEAT CHECK:
If the next 1-3 segments introduce a caveat, warning, or exception ("tapi yang perlu diingat...", "kecuali kalau...", "beda cerita kalau...", "yang bahaya itu..."), you MUST extend to include them. Logical and medical caveats are never optional.
STEP 3 — EXTEND UNTIL A HARD STOP SIGNAL:
Keep extending until:
- A complete, conclusive sentence that sounds genuinely final (e.g., "Jadi itulah pentingnya...", "Semoga bermanfaat.")
- The interviewer asks a completely new, unrelated question
- The speaker shifts to a completely new topic
- The {max_duration}-second hard limit is reached (find the nearest complete sentence before the limit).
STEP 4 — MEDICAL & LOGICAL COMPLETENESS:
Ensure the conclusion is fully delivered. If a complete explanation requires slightly more time, prioritize completeness over artificial brevity.

STRICT TIMESTAMP & DURATION RULES:
1. "start" and "end" MUST be exact timestamps taken DIRECTLY from the transcript segments provided. Do NOT invent timestamps.
2. DURATION RANGE: The duration of EACH hook (end - start) MUST BE BETWEEN {min_duration} AND {max_duration} SECONDS.
3. SWEET SPOT: Total duration should aim for the sweet spot of 30-90 seconds for maximum viewer retention, UNLESS the story or explanation is so engaging that it requires up to {max_duration} seconds.{video_duration_clause}

LANGUAGE & BILINGUAL RULES:
1. Output "transcript_quote" and "theme" in the EXACT ORIGINAL LANGUAGE spoken. ABSOLUTELY NO ENGLISH TRANSLATION of non-English sentences.
2. CODE-SWITCHING / MIXED LANGUAGE: If the speaker mixes Indonesian and English words (e.g. "Jujur gue ngerasa insecure banget..."), KEEP the English words exactly as they are.
3. Keep native slang, vocabulary, and grammar completely intact.
4. The "theme" (title) must be in the same language and conversational style as the transcript.

OUTPUT FORMAT (JSON Array):
Output a valid JSON array of objects. Each object must contain:
- "start" (number): start timestamp in seconds taken directly from transcript metadata.
- "end" (number): end timestamp in seconds taken directly from transcript metadata.
- "duration_seconds" (number): duration (end - start).
- "transcript_quote" (string): exact spoken words in original language.
- "theme" (string): short punchy title in original language.
- "virality_score" (integer 0-100): holistic virality potential rating evaluating hook curiosity, emotional delivery, and retention strength.
- "virality_reason" (string): a concise 1-2 sentence explanation in English describing why this specific hook is compelling and its viral mechanics.

TRANSCRIPT DATA:
{transcript_text}"""
        return prompt
