import os
import json
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from core.genai_client import GenAIClient, GeminiGenAIClient
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
        model_name: str = "gemini-2.5-flash",
        hook_generator: Optional[Any] = None,
    ):
        self.config_store = config_store
        self.model_name = model_name
        self.modular_builder = modular_builder or ModularCompositePromptBuilder()
        self.transcoder = media_transcoder or MediaTranscoder(config_store=self.config_store)

        self._hook_generator = hook_generator

        if prompt_repository is not None:
            self.repository = prompt_repository
        else:
            base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "prompts")
            self.repository = FilePromptRepository(base_dir)

        if genai_client is not None:
            self._client: Optional[GenAIClient] = genai_client
        else:
            api_key = None
            if self.config_store:
                raw_key = self.config_store.get("GEMINI_API_KEY")
                if isinstance(raw_key, str):
                    api_key = raw_key
                elif raw_key is not None:
                    api_key = str(raw_key)
            if not api_key:
                api_key = os.environ.get("GEMINI_API_KEY")

            if api_key:
                self._client = GeminiGenAIClient(api_key=api_key)
            else:
                self._client = None

    def _get_hook_generator(self):
        if self._hook_generator is not None:
            if self._client and hasattr(self._hook_generator, "client"):
                self._hook_generator.client = self._client
            return self._hook_generator

        from core.hook_generator import HookGenerator
        api_key = None
        if self.config_store:
            raw_key = self.config_store.get("GEMINI_API_KEY")
            if isinstance(raw_key, str):
                api_key = raw_key
            elif raw_key is not None:
                api_key = str(raw_key)
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY")

        return HookGenerator(
            api_key=api_key,
            genai_client=self._client,
            prompt_repository=self.repository,
            modular_builder=self.modular_builder,
        )

    @property
    def hook_generator(self):
        return self._get_hook_generator()

    @property
    def client(self) -> Optional[GenAIClient]:
        if self._client is None and self.config_store:
            api_key = self.config_store.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY")
            if api_key:
                self._client = GeminiGenAIClient(api_key=api_key)
        return self._client

    def _group_words_into_sentences(self, segments: list, max_words: int = 15, max_silence: float = 1.5) -> list:
        gen = self._get_hook_generator()
        if hasattr(gen, "_group_words_into_sentences"):
            return gen._group_words_into_sentences(segments, max_words=max_words, max_silence=max_silence)
        return []

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
        """Direct AI transcript hook discovery delegating to hook_generator."""
        opts = options or HookDiscoveryOptions()
        video_duration = video_info.get("duration") if video_info else None

        gen = self._get_hook_generator()
        if self._client and hasattr(gen, "client"):
            gen.client = self._client

        raw_json = gen.find_hooks_from_transcript(
            transcript_segments=transcript_segments,
            num_hooks=opts.num_hooks,
            auto_hooks=opts.auto_hooks,
            video_duration=video_duration,
            prompt_file=opts.prompt_file,
            extraction_mode=opts.extraction_mode,
            preset_id=opts.preset_id,
            focus_topic=opts.focus_topic,
            min_duration=opts.min_duration,
            max_duration=opts.max_duration,
        )

        if raw_json:
            try:
                parsed = json.loads(raw_json)
                if isinstance(parsed, list):
                    return parsed
            except Exception as e:
                print(f"[hook-discovery-engine] Failed to parse hook generator response: {e}")
        return []

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
