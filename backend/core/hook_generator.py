import os
import json
from core.genai_client import GeminiGenAIClient
from core.prompt_repository import FilePromptRepository

class HookGenerator:
    def __init__(self, api_key=None, genai_client=None, prompt_repository=None):
        self.client = genai_client or GeminiGenAIClient(api_key=api_key)
        self.model_name = "gemini-2.5-flash"
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
                    silence = w_start - current_end
                    if silence > max_silence or len(current_words) >= max_words:
                        grouped.append({
                            "start": current_start,
                            "duration": current_end - current_start,
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
                        "duration": current_end - current_start,
                        "text": " ".join(current_words)
                    })
                    current_words = []
                    current_start = None
                    current_end = None
                    
        if current_words:
            grouped.append({
                "start": current_start,
                "duration": current_end - current_start,
                "text": " ".join(current_words)
            })
            
        return grouped

    def find_hooks_from_transcript(self, transcript_segments: list, num_hooks: int = 3, auto_hooks: bool = False, video_duration: float = None, prompt_file: str = "prompt.json"):
        """
        Send raw transcript text to Gemini to identify hooks. 
        Much faster and more accurate than analyzing raw audio.
        """
        grouped_segments = self._group_words_into_sentences(transcript_segments)
        print(f"[gemini] Requesting transcript-based analysis for {len(transcript_segments)} segments grouped into {len(grouped_segments)} sentences (auto={auto_hooks}, num={num_hooks})...")
        
        # Format transcript for prompt
        transcript_text = ""
        for s in grouped_segments:
            start = float(s["start"])
            dur = float(s["duration"])
            transcript_text += f"[{start:.2f}s - {start+dur:.2f}s] {s['text']}\n"

        duration_constraint = ""
        if video_duration:
            duration_constraint = f"\n            VIDEO DURATION: The total length is {video_duration:.1f} seconds. ALL timestamps MUST be within 0 and {video_duration:.1f}."

        prompt_template = self.repository.get_prompt_text(prompt_file)
        if prompt_template is None:
            print(f"[gemini] Failed to load prompt file {prompt_file} via repository")
            return None
            
        try:
            # Build hook count instruction
            if auto_hooks:
                hook_count_instruction = "Find ALL naturally compelling hooks in the transcript. Do not force a specific number — return as many or as few as genuinely qualify. Quality over quantity."
            else:
                hook_count_instruction = f"Find exactly {num_hooks} hooks."
                
            fixed_suffix = """

OUTPUT FORMAT (JSON Array):
Each object must have:
- "start" (number): start time in seconds.
- "end" (number): end time in seconds.
- "duration_seconds" (number).
- "transcript_quote" (string): exact spoken words.
- "theme" (string): short title.

TRANSCRIPT DATA:
{transcript_text}"""
            prompt_template += fixed_suffix
                
            prompt = prompt_template.format(
                num_hooks=hook_count_instruction,
                duration_constraint=duration_constraint,
                transcript_text=transcript_text
            )
        except Exception as e:
            print(f"[gemini] Failed to build prompt template: {e}")
            return None

            
        max_retries = 3
        for attempt in range(max_retries):
            print(f"[gemini] Requesting text analysis (Attempt {attempt + 1}/{max_retries})...")
            try:
                raw_json = self.client.generate_json(prompt, self.model_name)
                parsed = json.loads(raw_json)
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"[gemini] Successfully generated {len(parsed)} hooks from transcript.")
                    return json.dumps(parsed)
            except Exception as e:
                print(f"[gemini] Error analyzing transcript (Retry {attempt+1}): {e}")
                # Check for fatal HTTP/API status codes to fail fast
                code = getattr(e, "code", None) or getattr(e, "status_code", None)
                if code and code in [400, 401, 403, 404]:
                    print(f"[gemini] Fatal error {code}. Failing fast without retry.")
                    break
        
        return None
