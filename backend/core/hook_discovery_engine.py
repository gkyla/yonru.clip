import os
import json
import time
from typing import Optional, List, Dict, Any, Callable
from dataclasses import dataclass

from core.genai_client import GenAIClient, GeminiGenAIClient, extract_valid_gemini_keys
from core.gemini_errors import (
    HookDiscoveryError,
    HookDiscoveryQuotaError,
    classify_gemini_exception,
    invalid_response_error,
    missing_api_key_error,
)
from core.gemini_models import (
    ALLOWED_GEMINI_MODELS,
    DEFAULT_GEMINI_MODEL,
    HOOK_DISCOVERY_MODELS,
    LEGACY_DEPRECATED_GEMINI_MODELS,
    get_gemini_model_label,
    normalize_gemini_model,
    validate_gemini_model,
)
from core.prompt_repository import FilePromptRepository, PromptRepository
from core.modular_prompt_builder import ModularCompositePromptBuilder
from core.media_transcoder import MediaTranscoder


@dataclass
class HookDiscoveryOptions:
    num_hooks: int = 10
    auto_hooks: bool = False
    preset_id: str = "auto"
    extraction_mode: str = "preset"
    prompt_file: Optional[str] = None
    focus_topic: Optional[str] = None
    min_duration: int = 15
    max_duration: int = 180


class HookDiscoveryEngine:
    """
    Unified backend module responsible for AI-assisted hook detection from speech transcripts,
    prompt orchestration, virality scoring, hook boundary and duration sanitization,
    thumbnail extraction via MediaTranscoder, and disk cache lifecycle management.
    """

    def __init__(
        self,
        config_store: Optional[Any] = None,
        genai_client: Optional[GenAIClient] = None,
        media_transcoder: Optional[MediaTranscoder] = None,
        prompt_repository: Optional[PromptRepository] = None,
        modular_builder: Optional[ModularCompositePromptBuilder] = None,
        model_name: str = DEFAULT_GEMINI_MODEL,
        hook_generator: Optional[Any] = None,
        sleep_fn: Callable[[float], None] = time.sleep,
    ):
        self.config_store = config_store
        self.model_name = normalize_gemini_model(model_name)
        self.modular_builder = modular_builder or ModularCompositePromptBuilder()
        self.transcoder = media_transcoder or MediaTranscoder(config_store=self.config_store)
        self._sleep = sleep_fn

        self._hook_generator = hook_generator

        if prompt_repository is not None:
            self.repository = prompt_repository
        else:
            base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")
            self.repository = FilePromptRepository(base_dir)

        if genai_client is not None:
            self._client: Optional[GenAIClient] = genai_client
        else:
            self._client = self._build_genai_client()

    def _resolve_raw_api_key(self) -> Optional[str]:
        api_key = None
        if self.config_store:
            raw_key = self.config_store.get("GEMINI_API_KEY")
            if isinstance(raw_key, str):
                api_key = raw_key
            elif raw_key is not None:
                api_key = str(raw_key)
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")
        return api_key

    def _build_genai_client(self) -> Optional[GenAIClient]:
        api_key = self._resolve_raw_api_key()
        if api_key and extract_valid_gemini_keys(api_key):
            return GeminiGenAIClient(api_key=api_key)
        return None

    @property
    def client(self) -> Optional[GenAIClient]:
        if self._client is None:
            self._client = self._build_genai_client()
        return self._client

    @client.setter
    def client(self, value: Optional[GenAIClient]) -> None:
        self._client = value

    @property
    def hook_generator(self):
        """Backward-compatible self-reference for legacy consumers expecting hook_generator."""
        return self

    def get_active_model_name(self) -> str:
        """Resolve active Hook Discovery Model dynamically from config_store or constructor fallback."""
        if self.config_store is not None:
            configured = self.config_store.get("GEMINI_MODEL")
            if isinstance(configured, str) and configured.strip():
                return normalize_gemini_model(configured)
        return normalize_gemini_model(self.model_name)

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
                            "text": " ".join(current_words),
                        })
                        current_start = w_start
                        current_end = w_end
                        current_words = [w]
                    else:
                        current_words.append(w)
                        current_end = w_end

                if w.endswith((".", "?", "!", "\"", "”", ":", ";")):
                    grouped.append({
                        "start": current_start,
                        "duration": float(current_end) - float(current_start) if current_end is not None and current_start is not None else 0.0,
                        "text": " ".join(current_words),
                    })
                    current_words = []
                    current_start = None
                    current_end = None

        if current_words:
            grouped.append({
                "start": current_start,
                "duration": float(current_end) - float(current_start) if current_end is not None and current_start is not None else 0.0,
                "text": " ".join(current_words),
            })

        return grouped

    def _get_cache_path(self, video_info: dict) -> Optional[str]:
        file_path = video_info.get("file_path")
        if not file_path:
            return None
        return os.path.join(os.path.dirname(file_path), "hooks.json")

    def load_cached_hooks(self, video_info: dict) -> Optional[List[Dict[str, Any]]]:
        """Load and sanitize cached hooks from hooks.json if it exists."""
        cache_path = self._get_cache_path(video_info)
        if not cache_path or not os.path.exists(cache_path):
            return None
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                raw_hooks = json.load(f)
            if not isinstance(raw_hooks, list):
                return None
            sanitized = self.sanitize_and_prepare_hooks(raw_hooks, video_info)
            return sanitized
        except Exception as e:
            print(f"[hook-discovery-engine] Failed to load cached hooks from {cache_path}: {e}")
            return None

    def discover_from_transcript(
        self,
        transcript_segments: list,
        video_info: Optional[dict] = None,
        options: Optional[HookDiscoveryOptions] = None,
    ) -> List[Dict[str, Any]]:
        """Direct AI transcript hook discovery with sentence grouping, retries, and scoring."""
        opts = options or HookDiscoveryOptions()
        video_duration = video_info.get("duration") if video_info else None

        active_model = self.get_active_model_name()
        client = self.client
        if not client:
            print("[hook-discovery-engine] No GenAI client or GEMINI_API_KEY available.")
            raise missing_api_key_error(active_model)

        grouped_segments = self._group_words_into_sentences(transcript_segments)
        print(
            f"[hook-discovery-engine] Requesting transcript-based analysis for {len(transcript_segments)} "
            f"segments grouped into {len(grouped_segments)} sentences "
            f"(mode={opts.extraction_mode}, preset={opts.preset_id}, auto={opts.auto_hooks}, num={opts.num_hooks})..."
        )

        transcript_text = ""
        for s in grouped_segments:
            start = float(s["start"])
            dur = float(s["duration"])
            transcript_text += f"[{start:.2f}s - {start+dur:.2f}s] {s['text']}\n"

        custom_archetype = None
        if opts.extraction_mode == "custom" and opts.prompt_file:
            custom_archetype = self.repository.get_prompt_text(opts.prompt_file)
            if custom_archetype is None:
                print(f"[hook-discovery-engine] Failed to load prompt file {opts.prompt_file} via repository, falling back to preset builder")

        prompt = self.modular_builder.build_prompt(
            transcript_text=transcript_text,
            preset_id=opts.preset_id,
            custom_archetype=custom_archetype,
            focus_topic=opts.focus_topic,
            min_duration=opts.min_duration,
            max_duration=opts.max_duration,
            num_hooks=opts.num_hooks,
            auto_hooks=True,
            video_duration=video_duration,
        )

        max_retries = 3
        last_error: Optional[HookDiscoveryError] = None
        for attempt in range(max_retries):
            print(
                f"[hook-discovery-engine] Requesting text analysis with model={active_model} "
                f"(Attempt {attempt + 1}/{max_retries})..."
            )
            try:
                raw_json = client.generate_json(prompt, active_model)
                parsed = json.loads(raw_json)
                if not isinstance(parsed, list):
                    raise invalid_response_error(active_model, raw_json)
                if len(parsed) == 0:
                    return []
                for idx, hook in enumerate(parsed):
                    if not isinstance(hook, dict):
                        continue
                    v_score = hook.get("virality_score")
                    if not isinstance(v_score, (int, float)) or v_score < 0 or v_score > 100:
                        hook["virality_score"] = 85 - (idx * 2)
                    else:
                        hook["virality_score"] = int(round(v_score))

                    if not hook.get("virality_reason"):
                        hook["virality_reason"] = "Compelling opening hook with natural narrative pacing."

                parsed.sort(key=lambda h: h.get("virality_score", 0), reverse=True)
                print(f"[hook-discovery-engine] Successfully discovered {len(parsed)} hooks from transcript.")
                return parsed
            except Exception as e:
                classified = classify_gemini_exception(
                    e,
                    model_name=active_model,
                    model_label=get_gemini_model_label(active_model),
                )
                last_error = classified

                if not classified.detail.retryable or classified.detail.code == "quota_exceeded":
                    print(
                        f"[hook-discovery-engine] Non-retryable error ({classified.detail.origin}/{classified.detail.code}) "
                        f"for {active_model}. Failing fast without retry."
                    )
                    raise classified from e

                print(
                    f"[hook-discovery-engine] Transient error ({classified.detail.origin}/{classified.detail.code}) "
                    f"on attempt {attempt + 1}/{max_retries}: {e}"
                )
                if attempt + 1 < max_retries:
                    delay = (
                        2.0 * (2 ** attempt)
                        if classified.detail.code in ("high_demand", "provider_error", "network_error")
                        else 1.0
                    )
                    self._sleep(delay)

        if last_error is not None:
            raise last_error
        raise invalid_response_error(active_model)

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
        max_duration: int = 180,
    ) -> Optional[str]:
        """Backward-compatible string JSON entry point for callers expecting HookGenerator.find_hooks_from_transcript."""
        opts = HookDiscoveryOptions(
            num_hooks=num_hooks,
            auto_hooks=auto_hooks,
            prompt_file=prompt_file,
            extraction_mode=extraction_mode,
            preset_id=preset_id,
            focus_topic=focus_topic,
            min_duration=min_duration,
            max_duration=max_duration,
        )
        hooks = self.discover_from_transcript(
            transcript_segments=transcript_segments,
            video_info={"duration": video_duration} if video_duration else None,
            options=opts,
        )
        return json.dumps(hooks) if hooks else None

    def get_or_discover_hooks(
        self,
        video_info: dict,
        transcript_segments: Optional[list] = None,
        options: Optional[HookDiscoveryOptions] = None,
        force_reanalyze: bool = False,
    ) -> List[Dict[str, Any]]:
        """Primary high-leverage entry point for hook discovery and persistence."""
        cache_path = self._get_cache_path(video_info)

        if not force_reanalyze:
            cached = self.load_cached_hooks(video_info)
            if cached is not None and len(cached) > 0:
                print(f"[hook-discovery-engine] Hooks loaded from cache: {cache_path}")
                return cached

        if not transcript_segments:
            print("[hook-discovery-engine] No transcript segments provided for generation.")
            return []

        raw_hooks = self.discover_from_transcript(transcript_segments, video_info=video_info, options=options)
        if not raw_hooks:
            return []

        sanitized = self.sanitize_and_prepare_hooks(raw_hooks, video_info)

        if cache_path:
            try:
                os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                tmp_cache = cache_path + ".tmp"
                with open(tmp_cache, "w", encoding="utf-8") as f:
                    json.dump(sanitized, f, ensure_ascii=False, indent=2)
                os.replace(tmp_cache, cache_path)
                print(f"[hook-discovery-engine] Saved {len(sanitized)} hooks to cache: {cache_path}")
            except Exception as e:
                print(f"[hook-discovery-engine] Failed to save hooks to cache: {e}")

        return sanitized

    def sanitize_and_prepare_hooks(self, raw_hooks: list, video_info: dict) -> List[Dict[str, Any]]:
        """Filter, clamp boundaries, and generate static sharp thumbnails via MediaTranscoder."""
        video_duration = video_info.get("duration", float("inf"))
        file_path = video_info.get("file_path")
        if not file_path:
            return []

        folder_name = video_info.get("folder_name") or os.path.basename(os.path.dirname(file_path))
        target_dir = os.path.dirname(file_path)

        MIN_DUR, MAX_DUR = 15, 180
        filtered = []
        for h in raw_hooks:
            try:
                h_start = float(h.get("start", 0))
                h_end = float(h.get("end", 0))
                h_dur = h_end - h_start

                if h_start < 0 or h_start >= video_duration or h_end > (video_duration + 5):
                    continue

                if h_dur < MIN_DUR:
                    h_end = h_start + MIN_DUR
                if (h_end - h_start) > MAX_DUR:
                    h_end = h_start + MAX_DUR

                h["start"] = round(h_start, 2)
                h["end"] = round(h_end, 2)
                h["duration"] = round(h_end - h_start, 2)

                thumb_name = f"thumb_{int(h_start)}.jpg"
                thumb_local_path = os.path.join(target_dir, thumb_name)

                # Delegate screenshot extraction cleanly to MediaTranscoder
                if not os.path.exists(thumb_local_path):
                    self.transcoder.capture_screenshot(
                        video_path=file_path,
                        timestamp=h_start,
                        output_path=thumb_local_path
                    )
                h["thumbnail_url"] = f"/assets/sources/{folder_name}/{thumb_name}"
                filtered.append(h)
            except Exception as e:
                print(f"[hook-discovery-engine] Failed to sanitize hook: {e}")

        return filtered
