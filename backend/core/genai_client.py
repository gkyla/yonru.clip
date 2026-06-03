import time
from abc import ABC, abstractmethod
from google import genai
from google.genai import types

class GenAIClient(ABC):
    @abstractmethod
    def generate_json(self, prompt: str, model_name: str) -> str:
        """Sends the prompt to GenAI provider and returns the raw JSON text response."""
        pass


class GeminiGenAIClient(GenAIClient):
    # Class-level state to track key degradation: key_string -> { "degraded_until": float, "permanent": bool }
    _degradation_cache = {}

    def __init__(self, api_key: str = None):
        self.api_keys = []
        self.key_titles = {}
        
        if api_key:
            api_key_stripped = api_key.strip()
            if api_key_stripped.startswith("[") and api_key_stripped.endswith("]"):
                try:
                    import json
                    data = json.loads(api_key_stripped)
                    if isinstance(data, list):
                        for index, item in enumerate(data):
                            if isinstance(item, dict) and item.get("value"):
                                val = item["value"].strip()
                                title = item.get("title", "").strip() or f"Key #{index + 1}"
                                self.api_keys.append(val)
                                self.key_titles[val] = title
                except Exception as e:
                    print(f"[gemini] Failed to parse key JSON metadata: {e}")
            
            # Fallback to comma-separated format
            if not self.api_keys:
                raw_keys = [k.strip() for k in api_key.split(",") if k.strip()]
                for index, k in enumerate(raw_keys):
                    self.api_keys.append(k)
                    self.key_titles[k] = f"Key #{index + 1}"

    @classmethod
    def clear_degradation(cls, key: str):
        """Reset degradation status for a key (typically called on manual validation check)."""
        key_stripped = key.strip()
        if key_stripped in cls._degradation_cache:
            del cls._degradation_cache[key_stripped]
            print(f"[gemini] Cleared degradation status for key: {key_stripped[:6]}...")

    def _get_active_keys(self) -> list[str]:
        """Filter list of keys to find non-degraded or recovered keys."""
        now = time.time()
        active = []
        for key in self.api_keys:
            status = self._degradation_cache.get(key)
            if not status:
                active.append(key)
                continue
            
            if status.get("permanent"):
                continue
                
            if status.get("degraded_until", 0) > now:
                continue
                
            # Cooldown has expired, remove from cache dynamically
            del self._degradation_cache[key]
            active.append(key)
            
        # If all keys are degraded/skipped, fall back to trying all keys as a last resort
        if not active:
            return self.api_keys
        return active

    def generate_json(self, prompt: str, model_name: str) -> str:
        active_keys = self._get_active_keys()
        if not active_keys:
            raise ValueError("No Gemini API keys provided.")
            
        last_exception = None
        for key in active_keys:
            try:
                client = genai.Client(api_key=key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                
                # Success! Clear degradation if it was marked
                if key in self._degradation_cache:
                    del self._degradation_cache[key]
                    
                return response.text
            except Exception as e:
                last_exception = e
                error_msg = str(e)
                
                # Parse standard Gemini error types for degradation classification
                is_quota = "quota" in error_msg.lower() or "429" in error_msg
                is_auth = "API_KEY_INVALID" in error_msg or "400" in error_msg or "403" in error_msg
                
                key_title = self.key_titles.get(key, f"key {key[:6]}...")
                if is_auth:
                    # Permanent failure
                    self._degradation_cache[key] = {"degraded_until": 0, "permanent": True}
                    print(f"[gemini] Key '{key_title}' permanently degraded due to authentication failure: {error_msg}")
                elif is_quota:
                    # Transient failure, 5 minutes cooldown
                    self._degradation_cache[key] = {"degraded_until": time.time() + 300, "permanent": False}
                    print(f"[gemini] Key '{key_title}' degraded for 5m (quota limits): {error_msg}")
                else:
                    # Connection or other internal errors, 1 minute cooldown
                    self._degradation_cache[key] = {"degraded_until": time.time() + 60, "permanent": False}
                    print(f"[gemini] Key '{key_title}' degraded for 1m (unexpected error): {error_msg}")
                    
        # If all keys failed, raise the final exception
        if last_exception:
            raise last_exception
        raise ValueError("Gemini content generation failed with all available keys.")


class MockGenAIClient(GenAIClient):
    def __init__(self, mock_response: str = "[]"):
        self.mock_response = mock_response
        self.last_prompt = None

    def generate_json(self, prompt: str, model_name: str) -> str:
        self.last_prompt = prompt
        return self.mock_response
