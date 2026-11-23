import html
import re
from typing import Optional, Dict

_RE_BR_TAG = re.compile(r"<br\s*/?>", re.IGNORECASE)
_RE_LIST_OPEN_TAG = re.compile(r"</?(?:ul|ol)(?:\s[^>]*)?>", re.IGNORECASE)
_RE_LI_OPEN_TAG = re.compile(r"<li(?:\s[^>]*)?>", re.IGNORECASE)
_RE_BLOCK_CLOSE_TAG = re.compile(r"</(?:p|div|li|h[1-6]|blockquote|tr)>", re.IGNORECASE)
_RE_HTML_TAG = re.compile(r"</?[a-zA-Z][^>]*>")
_RE_EXCESS_NEWLINES = re.compile(r"\n{3,}")


class ModularCompositePromptBuilder:
    """
    Modular Composite Prompt Builder
    Dynamically assembles Core Guardrails, Intent Archetypes, Topic Focus Directives,
    and Target Constraints into a high-precision prompt for Gemini hook extraction.
    """
    
    ARCHETYPES: Dict[str, str] = {
        "auto": """Identify compelling, high-retention podcast moments across all styles:
- Unusually honest, bold, or unfiltered statements
- Unexpectedly funny, witty, or relatable punchlines
- Surprising revelations, debunked misconceptions, or eye-opening facts
- Engaging storytelling with strong emotional peaks or plot twists
- Relatable thoughts that make viewers think "that is so honest" or "so relatable".""",

        "humor": """Prioritize funny, entertaining, and relatable moments:
- Spontaneous laughter, sharp comedic timing, and witty comebacks
- Absurd, hilarious, or self-deprecating personal experiences
- Punchlines and banter between speakers
- Highly relatable everyday observations that evoke humor
- Moments where the speaker is playfully blunt or sarcastic.""",

        "educational": """Prioritize educational breakdowns, medical/scientific revelations, and "MYTHS & FACTS" segments:
- Direct debunking of common myths, misconceptions, or dangerous misinformation
- Clear, simple analogies that make complex topics instantly understandable
- Authoritative, passionate, or eye-opening explanations from experts
- Surprising health, science, or life facts that contradict common belief
- Practical, actionable advice backed by solid reasoning.""",

        "storytelling": """Prioritize narrative story arcs and personal reflections:
- Gripping personal stories (real cases, turning points, failures, triumphs)
- Clear narrative structure: 1. Setup/Context, 2. Conflict/Shocking moment, 3. Resolution/Lesson
- Deep emotional moments, vulnerability, and life lessons
- Sudden twists or realizations where things didn't go as expected
- Stories that keep the audience eager to know what happened next.""",

        "debate": """Prioritize controversial, opinionated, and passionate discourse:
- Bold, unfiltered opinions that challenge mainstream consensus
- Passionate arguments, healthy debate, or strong rebuttals
- "Unpopular opinions" delivered with conviction and authentic emotion
- Statements that provoke immediate thought, curiosity, or discussion in the comments
- Raw, direct reactions to pressing societal or industry topics."""
    }

    def __init__(self):
        pass

    @staticmethod
    def _sanitize_archetype_text(text: str) -> str:
        """Strip rich-text HTML markup while keeping readable structure and entities intact."""
        normalized = _RE_BR_TAG.sub("\n", text)
        normalized = _RE_LIST_OPEN_TAG.sub("\n", normalized)
        normalized = _RE_LI_OPEN_TAG.sub("- ", normalized)
        normalized = _RE_BLOCK_CLOSE_TAG.sub("\n", normalized)
        normalized = _RE_HTML_TAG.sub("", normalized)
        normalized = html.unescape(normalized).replace("\u00a0", " ")
        lines = [line.strip() for line in normalized.splitlines()]
        collapsed = _RE_EXCESS_NEWLINES.sub("\n\n", "\n".join(lines))
        return collapsed.strip()

    @staticmethod
    def _compute_soft_hook_floor(video_duration: Optional[float]) -> Optional[int]:
        """Compute a soft duration-scaled coverage sanity floor (~1 hook per 3.5 minutes)."""
        if video_duration is None or video_duration < 180.0:
            return None
        return max(2, int(round(video_duration / 210.0)))

    def build_prompt(
        self,
        transcript_text: str,
        preset_id: str = "auto",
        custom_archetype: Optional[str] = None,
        focus_topic: Optional[str] = None,
        min_duration: int = 30,
        max_duration: int = 180,
        num_hooks: int = 10,
        auto_hooks: bool = True,
        video_duration: Optional[float] = None
    ) -> str:
        """
        Build the complete composite prompt.
        Supports both built-in Smart Presets and Scoped Custom Archetype Templates.
        """
        sanitized_custom = (
            self._sanitize_archetype_text(custom_archetype)
            if custom_archetype and custom_archetype.strip()
            else ""
        )
        if sanitized_custom:
            archetype_directive = sanitized_custom
        else:
            archetype_key = preset_id.lower() if preset_id else "auto"
            archetype_directive = self.ARCHETYPES.get(archetype_key, self.ARCHETYPES["auto"])

        # 1. Quantity & Chronological Coverage instruction
        soft_floor = self._compute_soft_hook_floor(video_duration)
        if auto_hooks:
            coverage_lines = [
                "Scan the ENTIRE transcript chronologically from start to finish and extract EVERY standalone, high-retention podcast moment (\"hook\") worth clipping (virality_score >= 70).",
                "Include BOTH standout viral peaks (90-100) AND strong, engaging secondary moments (70-89). Scan the beginning, middle, and ending evenly — do not stop early after 3-5 highlights.",
            ]
            if soft_floor is not None and video_duration is not None:
                duration_mins = video_duration / 60.0
                coverage_lines.append(
                    f"COVERAGE SANITY CHECK: For a ~{duration_mins:.1f}-minute video, a thorough chronological scan typically uncovers at least {soft_floor}+ distinct standalone hooks — with NO upper cap. "
                    f"Treat {soft_floor} as a soft coverage check, not a rigid quota: if more genuinely strong moments exist, return ALL of them; if parts of the video are genuinely slow or repetitive, skip them rather than inventing weak filler."
                )
            else:
                coverage_lines.append(
                    "Return EVERY genuinely strong standalone hook across the full timeline with NO upper cap — do not stop early at 3-5 hooks, and do not invent weak filler if fewer moments qualify."
                )
            hook_count_instruction = "\n".join(coverage_lines)
        else:
            hook_count_instruction = (
                f"Scan the ENTIRE transcript chronologically from start to finish and find {num_hooks} "
                "distinct standalone hooks distributed across the timeline."
            )

        # 2. Topic Focus Directive
        topic_directive = ""
        if focus_topic and focus_topic.strip():
            topic_directive = f"""
TOPIC FOCUS DIRECTIVE (HIGH PRIORITY):
The creator specifically requested hooks focusing on: "{focus_topic.strip()}".
Prioritize transcript segments discussing this topic or directly related themes while maintaining strong hook virality standards.
"""

        # 3. Video Duration Constraint
        video_duration_clause = ""
        if video_duration:
            video_duration_clause = f"\nVIDEO DURATION: The total length is {video_duration:.1f} seconds. ALL timestamps MUST be within 0 and {video_duration:.1f}."

        # 4. Assemble Composite Prompt
        prompt = f"""You are an expert editor for viral podcast shorts (YouTube Shorts / Reels / TikTok).

Your job is to read the transcript chronologically from start to finish and identify compelling, high-retention podcast moments ("hooks").
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
1. Hooks MUST NOT overlap in time (`next.start < prev.end` is forbidden). If a hook runs from 02:10 to 03:20, no other hook may start inside that timeframe.
2. Back-to-back / adjacent hooks ARE explicitly allowed: if one self-contained topic, story, or Q&A ends at 03:20 and a distinct new topic or question begins right away at 03:20 or 03:22, extract BOTH as separate hooks. Do NOT enforce an empty cooldown buffer between separate topics.
3. Merge adjacent segments ONLY when they belong to the same continuous argument or story (staying under the {max_duration}s limit). If two candidates overlap on the same spoken span and cannot be separated cleanly, keep only the stronger one.

SEGMENT BOUNDARY TRAP & ACKNOWLEDGMENT FILLER TRAP:
Transcript subtitle segments do NOT always align with complete thoughts. Treat each segment end as a CANDIDATE only.
Across ANY spoken language, brief listener acknowledgments, backchannel reactions, or trailing hesitation particles are NEVER valid endpoints when they appear at the end of a segment:
- English examples: "yeah", "uh-huh", "right", "okay", "I see", "true", "hmm"
- Indonesian examples: "iya", "iya sih", "oke", "oh", "oh gitu", "bener", "betul", "nah", "gitu", "hmm"
- Or the equivalent backchannel/filler expressions in ANY other spoken language.
When a candidate segment ends on one of these, read the next 2-3 segments and extend if the speaker continues the same thought.

THOUGHT COMPLETION RULE (CRITICAL — 4-STEP VERIFICATION):
Before finalizing any "end" timestamp, perform this 4-step verification:
STEP 1 — CHECK IMMEDIATE CONTEXT: Look 15-30 seconds ahead (and further only if the exact same point or story is clearly still unfolding) to confirm the thought has finished. Do NOT keep merging separate follow-up topics or new questions just to stretch clip length.
STEP 2 — CHECK FOR INCOMPLETE THOUGHT SIGNALS (ANY LANGUAGE):
The current end is NOT acceptable if:
- The sentence stops mid-clause with no conclusive phrasing.
- The speaker ends on a continuation transition introducing a payoff (e.g., "so...", "therefore...", "which means...", "the point is..." / "jadi...", "makanya...", "terus...", "intinya..." / equivalents in any spoken language) and the next sentence completes that thought.
- The speaker is still mid-list ("first...", "second..." / "pertama...", "kedua...") before wrapping up the point.
- A setup, premise, analogy, or punchline was introduced but its payoff has not landed yet.
- The segment ends on a trailing particle immediately followed by a contrast or qualifier ("but...", "however...", "except..." / "tapi...", "padahal...", "cuma..."). Always extend to complete the point.
STEP 3 — IMMEDIATE CAVEAT & CONTRAST CHECK:
If the next 1-3 segments add an essential qualifier, exception, nuance, or twist that directly modifies the claim just made (across any subject — business, tech, comedy, personal stories, science, health, etc.), extend to include it so the clip stays accurate and self-contained.
STEP 4 — STOP AT THE FIRST CLEAN CONCLUSION:
End cleanly as soon as the speaker delivers a natural punchline, resolution, or final takeaway — OR when a new question starts, the topic shifts, or the {max_duration}-second hard limit approaches (stop at the nearest complete sentence before the limit). Prefer tight, high-retention 35-90 second clips whenever a thought resolves cleanly, while allowing up to {max_duration} seconds when a continuous narrative genuinely needs it.

STRICT TIMESTAMP & DURATION RULES:
1. "start" and "end" MUST be exact timestamps taken DIRECTLY from the transcript segments provided. Do NOT invent timestamps.
2. DURATION RANGE: The duration of EACH hook (end - start) MUST BE BETWEEN {min_duration} AND {max_duration} SECONDS.
3. SWEET SPOT: Total duration should aim for the sweet spot of 30-90 seconds for maximum viewer retention, UNLESS the story or explanation is so engaging that it requires up to {max_duration} seconds.{video_duration_clause}

LANGUAGE & BILINGUAL RULES:
1. Output "theme" in the EXACT ORIGINAL LANGUAGE spoken. ABSOLUTELY NO ENGLISH TRANSLATION of non-English titles or phrases.
2. CODE-SWITCHING / MIXED LANGUAGE: If the speaker mixes languages (e.g., Indonesian + English like "Jujur gue ngerasa insecure banget...", or any other bilingual phrasing), keep the mixed wording, native slang, and conversational style intact in "theme".
3. Keep "virality_reason" concise in clear English.

OUTPUT FORMAT (JSON Array):
Keep each JSON object compact: do NOT copy or repeat spoken transcript text in the JSON — the backend slices the exact verbatim quote automatically from your start and end timestamps.
Output a valid JSON array of objects. Each object must contain:
- "start" (number): start timestamp in seconds taken directly from transcript metadata.
- "end" (number): end timestamp in seconds taken directly from transcript metadata.
- "duration_seconds" (number): duration (end - start).
- "theme" (string): short punchy title in the original language spoken.
- "virality_score" (integer 0-100): calibrated virality potential rating (90-100 = standout viral peak, 75-89 = strong engaging clip, 70-74 = solid secondary moment).
- "virality_reason" (string): a concise 1-2 sentence explanation in English describing why this specific hook is compelling and its viral mechanics.

TRANSCRIPT DATA:
{transcript_text}"""
        return prompt
