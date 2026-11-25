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

    @staticmethod
    def _format_sweet_spot(min_duration: int, max_duration: int) -> str:
        """Format target clip sweet spot dynamically from configured bounds."""
        if min_duration >= max_duration:
            return f"around {min_duration} seconds"
        sweet_max = min(max_duration, max(min_duration + 30, 90))
        return f"{min_duration}-{sweet_max} seconds"

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
                "Scan the ENTIRE transcript chronologically and extract EVERY standalone hook worth clipping (virality_score >= 70): standout peaks (90-100) AND strong secondary moments (70-89). Scan beginning, middle, and end evenly — do not stop early.",
            ]
            if soft_floor is not None and video_duration is not None:
                duration_mins = video_duration / 60.0
                coverage_lines.append(
                    f"COVERAGE SANITY CHECK: For a ~{duration_mins:.1f}-minute video, a thorough chronological scan typically uncovers at least {soft_floor}+ hooks — with NO upper cap. If more strong moments exist, return ALL of them; skip slow or repetitive parts rather than inventing weak filler."
                )
            else:
                coverage_lines.append(
                    "Return EVERY genuinely strong standalone hook across the timeline with NO upper cap — do not stop early, and skip weak filler."
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
Prioritize transcript segments discussing this topic or directly related themes while maintaining strong hook standards.
"""

        # 3. Video Duration & Dynamic Sweet Spot
        sweet_spot = self._format_sweet_spot(min_duration, max_duration)
        video_duration_clause = ""
        if video_duration:
            video_duration_clause = f"\nVIDEO DURATION: The total length is {video_duration:.1f} seconds. ALL selected segments MUST fall between 0 and {video_duration:.1f}."

        # 4. Assemble Composite Prompt
        prompt = f"""You are an expert editor for viral podcast shorts (YouTube Shorts / Reels / TikTok).

Read the transcript chronologically and select compelling, high-retention standalone moments ("hooks").
{hook_count_instruction}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{archetype_directive}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{topic_directive}
HOOK SELECTION & FIRST 3 SECONDS TEST:
1. CONTEXT INDEPENDENCE: Viewers must understand the clip without watching earlier parts of the video.
2. FIRST 3 SECONDS TEST: The opening line MUST immediately create curiosity, emotion, or surprise. Never open with greetings, intro chatter, or warm-up banter.

NO OVERLAP RULE (CRITICAL):
1. Hooks MUST NOT overlap (`next.start_id <= prev.end_id` on the same spoken span is forbidden).
2. Back-to-back adjacent hooks ARE allowed: when one standalone topic or Q&A ends and a new one starts right away, extract BOTH with no forced cooldown gap. Merge adjacent lines only when they belong to the same continuous point (within {max_duration}s).

BOUNDARY CLEANUP & ACKNOWLEDGMENT FILLER TRAP:
Transcript `#ID` boundaries do NOT always match complete thoughts across any spoken language:
1. NEVER begin `start_id` on host transition cues or filler words ("Next", "Oke, next", "Moving on", "Pertanyaan berikutnya", "Okay", "Yeah", "Iya", "Oke", or equivalents in any spoken language). Begin on the first real hook or question line.
2. Trailing listener backchannels, hesitations, or transitions in ANY spoken language ("yeah", "uh-huh", "right", "okay", "I see", "true", "hmm" / "iya", "iya sih", "oke", "oh gitu", "gitu", "betul", "nah", "next", "oke next" / equivalents in any spoken language) are NEVER valid endpoints. Look 2-3 segments ahead: extend past them if the speaker continues the same thought; otherwise stop on the previous substantive segment so trailing filler is excluded.

THOUGHT COMPLETION RULE (CRITICAL — PAYOFF VERIFICATION):
Before finalizing `end_id`, check 15-30 seconds ahead (and further if the same story/explanation is still unfolding):
1. INCOMPLETE THOUGHT SIGNALS (ANY LANGUAGE): Do NOT stop mid-clause, mid-list ("first..." / "pertama..."), or on a bridge phrase ("so...", "jadi...", "makanya...", "intinya...") when the next lines deliver the conclusion or a contrast/qualifier ("but...", "however...", "tapi...", "padahal...", "cuma...").
2. COMPLETE THE FULL PAYOFF (DO NOT CUT EARLY): Never stop on a teaser or cliffhanger ("the story doesn't end there...", "itu cerita belum selesai..."), bare numbers before the takeaway, or right before a "but / however / tapi / cuma" twist. End only after the speaker lands the full takeaway or resolution, when a new question/topic starts, or before exceeding {max_duration} seconds.

SEGMENT ID & DURATION RULES:
Transcript lines follow `[#ID | start-end] text`.
1. `start_id` and `end_id` MUST be exact integer `#ID` values taken directly from those lines (`0 <= start_id <= end_id`). Never invent IDs or output raw timestamps.
2. DURATION RANGE: The span of EACH hook (from segment `start_id` to segment `end_id`) MUST BE BETWEEN {min_duration} AND {max_duration} SECONDS. Clips under {min_duration}s are invalid — extend to complete the point or skip.
3. SWEET SPOT: Aim for {sweet_spot} when a point lands cleanly, allowing up to {max_duration} seconds when a continuous narrative genuinely needs it.{video_duration_clause}

LANGUAGE & BILINGUAL RULES:
1. Write `"theme"` in the EXACT ORIGINAL LANGUAGE spoken. Never translate non-English topics into English.
2. CODE-SWITCHING: Keep mixed languages and native slang (e.g., Indonesian + English) natural in `"theme"`.
3. Keep `"virality_reason"` concise in clear English.

OUTPUT FORMAT (JSON Array):
Keep each JSON object compact: do NOT copy or repeat spoken transcript text — the backend computes exact timestamps and slices the verbatim quote from your segment IDs.
Output a valid JSON array of objects using this exact key order:
- "theme" (string): short punchy title in the original language spoken.
- "start_id" (integer): exact integer `#ID` where the hook begins.
- "end_id" (integer): exact integer `#ID` where the complete payoff finishes.
- "virality_score" (integer 0-100): calibrated rating (90-100 = standout peak, 75-89 = strong engaging clip, 70-74 = solid secondary moment).
- "virality_reason" (string): concise 1-2 sentence explanation in English describing why this clip hooks viewers.

TRANSCRIPT DATA:
{transcript_text}"""
        return prompt
