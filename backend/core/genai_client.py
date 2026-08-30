import time
import json
import re
from typing import Optional, List, Dict, Any
from abc import ABC, abstractmethod
from google import genai
from google.genai import types

PLACEHOLDER_EXACT_MATCHES = {
    "your_gemini_api_key_here",
    "your_api_key_here",
    "your_key_here",
    "your_api_key",
    "your_gemini_api_key",
    "changeme",
    "placeholder",
    "dummy",
    "default",
    "none",
    "null",
}


def is_placeholder_api_key(key: Optional[str]) -> bool:
    """Return True if the key is empty, whitespace, or a common template placeholder."""
    if not key:
        return True
    cleaned = key.strip().strip("\"'")
    if not cleaned:
        return True
    lower = cleaned.lower()
    if lower in PLACEHOLDER_EXACT_MATCHES:
        return True
    # Matches patterns like your_..._here or <your_...>
    if re.match(r"^your_.*_here$", lower):
        return True
    if lower.startswith("<") and lower.endswith(">"):
        return True
    return False


def extract_valid_gemini_keys(raw_config: Optional[str]) -> List[str]:
    """Parse raw GEMINI_API_KEY configuration and return only valid, non-placeholder keys."""
    if not raw_config:
        return []
    stripped = raw_config.strip()
    if not stripped:
        return []

    valid_keys: List[str] = []
    if stripped.startswith("[") and stripped.endswith("]"):
        try:
            data = json.loads(stripped)
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get("value"):
                        val = str(item["value"]).strip()
                        if not is_placeholder_api_key(val):
                            valid_keys.append(val)
                    elif isinstance(item, str):
                        val = item.strip()
                        if not is_placeholder_api_key(val):
                            valid_keys.append(val)
                return valid_keys
        except Exception:
            pass

    # Comma-separated or single string fallback
    parts = [k.strip() for k in stripped.split(",") if k.strip()]
    for part in parts:
        if not is_placeholder_api_key(part):
            valid_keys.append(part)
    return valid_keys


def sanitize_gemini_api_key_config(raw_config: Optional[str]) -> str:
    """Return a sanitized string for GEMINI_API_KEY with all placeholder keys removed."""
    if not raw_config:
        return ""
    stripped = raw_config.strip()
    if not stripped:
        return ""
    if stripped.startswith("[") and stripped.endswith("]"):
        try:
            data = json.loads(stripped)
            if isinstance(data, list):
                filtered = [
                    item
                    for item in data
                    if isinstance(item, dict) and not is_placeholder_api_key(str(item.get("value", "")))
                ]
                return json.dumps(filtered) if filtered else ""
        except Exception:
            pass

    parts = [k.strip() for k in stripped.split(",") if k.strip() and not is_placeholder_api_key(k)]
    return ",".join(parts) if parts else ""


class GenAIClient(ABC):
    @abstractmethod
    def generate_json(self, prompt: str, model_name: str) -> str:
        """Sends the prompt to GenAI provider and returns the raw JSON text response."""
        pass


class GeminiGenAIClient(GenAIClient):
    # Class-level state to track key degradation: key_string -> { "degraded_until": float, "permanent": bool }
    _degradation_cache = {}

    def __init__(self, api_key: Optional[str] = None):
        self.api_keys = []
        self.key_titles = {}

        if api_key:
            api_key_stripped = api_key.strip()
            if api_key_stripped.startswith("[") and api_key_stripped.endswith("]"):
                try:
                    data = json.loads(api_key_stripped)
                    if isinstance(data, list):
                        for index, item in enumerate(data):
                            if isinstance(item, dict) and item.get("value"):
                                val = str(item["value"]).strip()
                                if not is_placeholder_api_key(val):
                                    title = item.get("title", "").strip() or f"Key #{index + 1}"
                                    self.api_keys.append(val)
                                    self.key_titles[val] = title
                except Exception as e:
                    print(f"[gemini] Failed to parse key JSON metadata: {e}")

            # Fallback to comma-separated format
            if not self.api_keys:
                raw_keys = [k.strip() for k in api_key.split(",") if k.strip()]
                for index, k in enumerate(raw_keys):
                    if not is_placeholder_api_key(k):
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
                    
                text = response.text
                if text is None:
                    raise ValueError("Gemini API returned an empty text response.")
                return text
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
