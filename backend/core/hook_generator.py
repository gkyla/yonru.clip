import os
import json
from typing import Optional
from core.genai_client import GeminiGenAIClient
from core.prompt_repository import FilePromptRepository
from core.modular_prompt_builder import ModularCompositePromptBuilder

class HookGenerator:
    def __init__(self, api_key=None, genai_client=None, prompt_repository=None, modular_builder=None):
        self.client = genai_client or GeminiGenAIClient(api_key=api_key)
        self.model_name = "gemini-2.5-flash"
        self.modular_builder = modular_builder or ModularCompositePromptBuilder()
        if prompt_repository is not None:
            self.repository = prompt_repository
        else:
            base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")
            self.repository = FilePromptRepository(base_dir)

    def _group_words_into_sentences(self, segments: list, max_words: int = 15, max_silence: float = 1.5) -> list:
        grouped = []
        current_words = []
        current_start = None
        current_end = None
        
        for s in segments:
            start = float(s.get("start", 0.0))
            dur = float(s.get("duration", 0.0))
            end = start + dur
            text = s.get("text", "").strip()
            if not text:
                continue
                
            words = text.split()
            word_dur = dur / len(words) if len(words) > 0 else 0.0
            
            for i, w in enumerate(words):
                w_start = start + (i * word_dur)
                w_end = w_start + word_dur
                
                if not current_words:
                    current_start = w_start
                    current_end = w_end
                    current_words.append(w)
                else:
                    silence = w_start - current_end if current_end is not None else 0.0
                    if silence > max_silence or len(current_words) >= max_words:
                        grouped.append({
                            "start": current_start,
                            "duration": float(current_end) - float(current_start) if current_end is not None and current_start is not None else 0.0,
                            "text": " ".join(current_words)
                        })
                        current_start = w_start
                        current_end = w_end
                        current_words = [w]
                    else:
                        current_words.append(w)
                        current_end = w_end
                
                if w.endswith(('.', '?', '!', '"', '”', ':', ';')):
                    grouped.append({
                        "start": current_start,
                        "duration": float(current_end) - float(current_start) if current_end is not None and current_start is not None else 0.0,
                        "text": " ".join(current_words)
                    })
                    current_words = []
                    current_start = None
                    current_end = None
                    
        if current_words:
            grouped.append({
                "start": current_start,
                "duration": float(current_end) - float(current_start) if current_end is not None and current_start is not None else 0.0,
                "text": " ".join(current_words)
            })
            
        return grouped

    def find_hooks_from_transcript(
        self,
        transcript_segments: list,
        num_hooks: int = 10,
        auto_hooks: bool = False,
        video_duration: Optional[float] = None,
        prompt_file: Optional[str] = None,
        extraction_mode: str = "preset",
        preset_id: str = "auto",
        focus_topic: Optional[str] = None,
        min_duration: int = 30,
        max_duration: int = 180
    ):
        """
        Send raw transcript text to Gemini to identify hooks.
        Supports both Smart Presets (via ModularCompositePromptBuilder) and Custom Templates.
        """
        grouped_segments = self._group_words_into_sentences(transcript_segments)
        print(f"[gemini] Requesting transcript-based analysis for {len(transcript_segments)} segments grouped into {len(grouped_segments)} sentences (mode={extraction_mode}, preset={preset_id}, auto={auto_hooks}, num={num_hooks})...")
        
        # Format transcript for prompt
        transcript_text = ""
        for s in grouped_segments:
            start = float(s["start"])
            dur = float(s["duration"])
            transcript_text += f"[{start:.2f}s - {start+dur:.2f}s] {s['text']}\n"

        # Determine prompt based on extraction_mode
        custom_archetype = None
        if extraction_mode == "custom" and prompt_file:
            custom_archetype = self.repository.get_prompt_text(prompt_file)
            if custom_archetype is None:
                print(f"[gemini] Failed to load prompt file {prompt_file} via repository, falling back to preset builder")

        prompt = self.modular_builder.build_prompt(
            transcript_text=transcript_text,
            preset_id=preset_id,
            custom_archetype=custom_archetype,
            focus_topic=focus_topic,
            min_duration=min_duration,
            max_duration=max_duration,
            num_hooks=num_hooks,
            auto_hooks=True,
            video_duration=video_duration
        )

        max_retries = 3
        for attempt in range(max_retries):
            print(f"[gemini] Requesting text analysis (Attempt {attempt + 1}/{max_retries})...")
            try:
                raw_json = self.client.generate_json(prompt, self.model_name)
                parsed = json.loads(raw_json)
                if isinstance(parsed, list) and len(parsed) > 0:
                    # Sanitize and ensure virality_score and virality_reason are present
                    for idx, hook in enumerate(parsed):
                        if not isinstance(hook, dict):
                            continue
                        # Default virality_score if missing or invalid
                        v_score = hook.get("virality_score")
                        if not isinstance(v_score, (int, float)) or v_score < 0 or v_score > 100:
                            hook["virality_score"] = 85 - (idx * 2) # Graceful tier fallback
                        else:
                            hook["virality_score"] = int(round(v_score))

                        if not hook.get("virality_reason"):
                            hook["virality_reason"] = "Compelling opening hook with natural narrative pacing."

                    # Sort hooks descending by virality_score
                    parsed.sort(key=lambda h: h.get("virality_score", 0), reverse=True)

                    print(f"[gemini] Successfully generated {len(parsed)} hooks from transcript.")
                    return json.dumps(parsed)
            except Exception as e:
                print(f"[gemini] Error analyzing transcript (Retry {attempt+1}): {e}")
                code = getattr(e, "code", None) or getattr(e, "status_code", None)
                if code and code in [400, 401, 403, 404]:
                    print(f"[gemini] Fatal error {code}. Failing fast without retry.")
                    break
        
        return None

