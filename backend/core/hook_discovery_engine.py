import os
import re
import json
import math
import time
import inspect
from typing import Optional, List, Dict, Any, Callable, Tuple
from dataclasses import dataclass

from core.genai_client import (
    GenAIClient,
    GeminiGenAIClient,
    HOOK_DISCOVERY_RESPONSE_SCHEMA,
    extract_valid_gemini_keys,
)
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
    min_duration: int = 30
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

    _RE_BOUNDARY_PUNCT = re.compile(r"[^\w\s]+", re.UNICODE)
    _BOUNDARY_FILLER_PHRASES = frozenset({
        # Universal hesitations / backchannels
        "hm", "hmm", "hmmm", "mm", "mmm", "mm hmm", "mhm", "uh", "um", "uh huh",
        "ah", "eh", "oh", "ee", "eee",
        # English & Indonesian host transition cues
        "next", "next question", "next one", "moving on", "okay next", "ok next",
        "alright next", "all right next", "oke next", "lanjut", "lanjut ya",
        "oke lanjut", "kita lanjut", "pertanyaan berikutnya", "pertanyaan selanjutnya",
        "pertanyaan terakhir", "soal berikutnya",
        # English backchannels
        "ok", "okay", "alright", "all right", "yeah", "yes", "yep", "yup",
        "right", "true", "sure", "i see", "oh i see", "got it", "gotcha",
        "makes sense", "fair enough", "good point",
        # Indonesian backchannels
        "oke", "okeh", "okey", "ya", "iya", "iya ya", "iya sih", "iya kan",
        "ya kan", "yaudah", "ya sudah", "gitu", "gitu ya", "gitu sih", "oh gitu",
        "oh gitu ya", "begitu", "begitu ya", "oh begitu", "nah", "nah gitu",
        "betul", "betul ya", "bener", "bener banget", "benar", "siap", "sip", "baik",
    })
    _SINGLE_FILLER_TOKENS = frozenset({
        "next", "oke", "ok", "okay", "ya", "iya", "gitu", "oh", "nah",
        "betul", "bener", "benar", "yeah", "yes", "right", "hm", "hmm",
        "uh", "um", "eh", "ee", "lanjut",
    })

    @classmethod
    def _normalize_monotonic_words(cls, segments: list) -> List[Dict[str, Any]]:
        """De-overlap caption runs monotonically while preserving exact word order."""
        raw_words: List[Tuple[float, float, str, int, bool]] = []
        for seg_idx, s in enumerate(segments):
            if not isinstance(s, dict):
                continue
            start = float(s.get("start") or 0.0)
            dur = max(0.0, float(s.get("duration") or 0.0))
            text = str(s.get("text", "")).strip()
            if not text:
                continue
            words = text.split()
            word_dur = dur / len(words)
            is_single = len(words) == 1
            for i, w in enumerate(words):
                raw_words.append((start + (i * word_dur), word_dur, w, seg_idx, is_single))

        if not raw_words:
            return []

        runs: List[List[Tuple[float, float, str, int, bool]]] = [[raw_words[0]]]
        for item in raw_words[1:]:
            prev = runs[-1][-1]
            same_segment = item[3] == prev[3]
            contiguous_caption_word = (
                prev[4]
                and item[4]
                and abs(item[0] - (prev[0] + prev[1])) < 1e-3
                and abs(item[1] - prev[1]) < 1e-3
            )
            if same_segment or contiguous_caption_word:
                runs[-1].append(item)
            else:
                runs.append([item])

        normalized: List[Dict[str, Any]] = []
        cursor = 0.0
        for run_idx, run in enumerate(runs):
            run_start = max(cursor, run[0][0])
            run_raw_end = max(run_start, run[-1][0] + run[-1][1])
            if run_idx + 1 < len(runs):
                next_start = runs[run_idx + 1][0][0]
                run_end = min(run_raw_end, next_start) if next_start >= run_start else run_start
            else:
                run_end = run_raw_end

            word_dur = (run_end - run_start) / len(run)
            for word_idx, (_, _, word_text, _, _) in enumerate(run):
                normalized.append({
                    "start": run_start + (word_idx * word_dur),
                    "duration": word_dur,
                    "text": word_text,
                })
            cursor = run_end

        return normalized

    def _group_words_into_sentences(self, segments: list, max_words: int = 15, max_silence: float = 1.5) -> list:
        normalized_words = self._normalize_monotonic_words(segments)
        grouped = []
        current_words = []
        current_start: Optional[float] = None
        current_end: Optional[float] = None

        for w_item in normalized_words:
            w_start = float(w_item["start"])
            w_end = w_start + float(w_item["duration"])
            w = str(w_item["text"])

            if not current_words:
                current_start = w_start
                current_end = w_end
                current_words.append(w)
            else:
                silence = w_start - current_end if current_end is not None else 0.0
                if silence > max_silence or len(current_words) >= max_words:
                    grouped.append({
                        "start": current_start,
                        "duration": max(0.0, float(current_end) - float(current_start)) if current_end is not None and current_start is not None else 0.0,
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
                    "duration": max(0.0, float(current_end) - float(current_start)) if current_end is not None and current_start is not None else 0.0,
                    "text": " ".join(current_words),
                })
                current_words = []
                current_start = None
                current_end = None

        if current_words:
            grouped.append({
                "start": current_start,
                "duration": max(0.0, float(current_end) - float(current_start)) if current_end is not None and current_start is not None else 0.0,
                "text": " ".join(current_words),
            })

        return grouped

    @staticmethod
    def _safe_int(value: Any) -> Optional[int]:
        """Parse an integer or `#ID`-prefixed string safely, rejecting booleans and floats with fractions."""
        if isinstance(value, bool) or value is None:
            return None
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return int(value) if math.isfinite(value) and value.is_integer() else None
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned.startswith("#"):
                cleaned = cleaned[1:].strip()
            if not cleaned:
                return None
            try:
                return int(cleaned)
            except ValueError:
                return None
        return None

    @classmethod
    def _is_boundary_filler_segment(cls, text: str) -> bool:
        """Return True if text is solely a short transition cue or listener backchannel."""
        cleaned = cls._RE_BOUNDARY_PUNCT.sub(" ", text).lower()
        tokens = cleaned.split()
        if not tokens or len(tokens) > 5:
            return False
        if " ".join(tokens) in cls._BOUNDARY_FILLER_PHRASES:
            return True
        return len(tokens) <= 3 and all(tok in cls._SINGLE_FILLER_TOKENS for tok in tokens)

    @classmethod
    def _trim_boundary_fillers(
        cls, grouped_segments: list, start_id: int, end_id: int
    ) -> Tuple[int, int]:
        """Trim standalone transition/backchannel filler segments from both hook ends."""
        while start_id < end_id and cls._is_boundary_filler_segment(
            str(grouped_segments[start_id].get("text", ""))
        ):
            start_id += 1
        while end_id > start_id and cls._is_boundary_filler_segment(
            str(grouped_segments[end_id].get("text", ""))
        ):
            end_id -= 1
        return start_id, end_id

    @staticmethod
    def _slice_segments_quote(grouped_segments: list, start_id: int, end_id: int) -> str:
        """Join trimmed verbatim segment text across [start_id, end_id] inclusive."""
        parts = [
            str(seg.get("text", "")).strip()
            for seg in grouped_segments[start_id : end_id + 1]
            if str(seg.get("text", "")).strip()
        ]
        return " ".join(" ".join(parts).split())

    @staticmethod
    def _call_generate_json(
        client: GenAIClient,
        prompt: str,
        model_name: str,
        response_schema: Any,
        temperature: float,
    ) -> str:
        """Call client.generate_json while staying compatible with 2-arg client doubles."""
        kwargs: Dict[str, Any] = {}
        try:
            params = inspect.signature(client.generate_json).parameters
        except (TypeError, ValueError):
            params = {}
        accepts_kwargs = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())
        if accepts_kwargs or "response_schema" in params:
            kwargs["response_schema"] = response_schema
        if accepts_kwargs or "temperature" in params:
            kwargs["temperature"] = temperature
        generate_fn: Any = client.generate_json
        return generate_fn(prompt, model_name, **kwargs)

    @staticmethod
    def _safe_float(value: Any) -> Optional[float]:
        """Convert numeric value safely to a finite float, returning None otherwise."""
        if isinstance(value, bool) or value is None:
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        return parsed if math.isfinite(parsed) else None

    @classmethod
    def _extract_transcript_quote(
        cls, grouped_segments: list, start: Any, end: Any
    ) -> str:
        """Deterministically reconstruct verbatim spoken text from grouped segments in [start, end]."""
        hook_start = cls._safe_float(start)
        hook_end = cls._safe_float(end)
        if hook_start is None or hook_end is None or hook_end <= hook_start:
            return ""

        parts: List[str] = []
        tolerance = 0.15
        for seg in grouped_segments:
            seg_start = cls._safe_float(seg.get("start"))
            seg_dur = cls._safe_float(seg.get("duration"))
            if seg_start is None:
                continue
            seg_dur = max(0.0, seg_dur if seg_dur is not None else 0.0)
            seg_end = seg_start + seg_dur
            text = str(seg.get("text", "")).strip()
            if not text:
                continue

            if seg_dur == 0.0:
                if (hook_start - tolerance) <= seg_start <= (hook_end + tolerance):
                    parts.append(text)
            else:
                overlap = min(seg_end, hook_end) - max(seg_start, hook_start)
                if overlap > 0.0 and (
                    overlap >= (0.5 * seg_dur)
                    or (seg_start >= (hook_start - tolerance) and seg_end <= (hook_end + tolerance))
                ):
                    parts.append(text)

        return " ".join(" ".join(parts).split())

    @classmethod
    def _deduplicate_overlapping_hooks(
        cls, hooks: List[Dict[str, Any]], max_overlap_ratio: float = 0.20
    ) -> List[Dict[str, Any]]:
        """Drop lower-ranked duplicates overlapping an already-kept hook by >20% of the shorter clip."""
        kept: List[Dict[str, Any]] = []
        for candidate in hooks:
            cand_start = cls._safe_float(candidate.get("start"))
            cand_end = cls._safe_float(candidate.get("end"))
            if cand_start is None or cand_end is None or cand_end <= cand_start:
                kept.append(candidate)
                continue

            is_duplicate = False
            for existing in kept:
                ex_start = cls._safe_float(existing.get("start"))
                ex_end = cls._safe_float(existing.get("end"))
                if ex_start is None or ex_end is None or ex_end <= ex_start:
                    continue

                overlap = min(cand_end, ex_end) - max(cand_start, ex_start)
                if overlap <= 0.0:
                    continue

                shorter_dur = min(cand_end - cand_start, ex_end - ex_start)
                if shorter_dur > 0.0 and (overlap / shorter_dur) > max_overlap_ratio:
                    is_duplicate = True
                    break

            if not is_duplicate:
                kept.append(candidate)
        return kept

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

    def _resolve_hook_from_segment_ids(
        self,
        hook: Dict[str, Any],
        grouped_segments: list,
        effective_min_dur: float,
        effective_max_dur: float,
    ) -> Optional[Dict[str, Any]]:
        """Resolve integer segment IDs into trimmed boundaries, exact timestamps, and quote text."""
        start_id = self._safe_int(hook.get("start_id"))
        end_id = self._safe_int(hook.get("end_id"))
        if (
            not grouped_segments
            or start_id is None
            or end_id is None
            or start_id < 0
            or start_id >= len(grouped_segments)
            or end_id < start_id
        ):
            return None

        end_id = min(end_id, len(grouped_segments) - 1)
        start_id, end_id = self._trim_boundary_fillers(grouped_segments, start_id, end_id)

        def _seg_start(idx: int) -> float:
            return self._safe_float(grouped_segments[idx].get("start")) or 0.0

        def _seg_end(idx: int) -> float:
            return _seg_start(idx) + max(0.0, self._safe_float(grouped_segments[idx].get("duration")) or 0.0)

        span_start = _seg_start(start_id)
        while end_id > start_id and (_seg_end(end_id) - span_start) > effective_max_dur:
            end_id -= 1
        start_id, end_id = self._trim_boundary_fillers(grouped_segments, start_id, end_id)

        h_start = round(_seg_start(start_id), 2)
        h_end = round(_seg_end(end_id), 2)
        if (h_end - h_start) > effective_max_dur:
            h_end = round(h_start + effective_max_dur, 2)
        h_dur = round(h_end - h_start, 2)
        if h_dur <= 0.0 or h_dur < effective_min_dur:
            return None

        resolved = dict(hook)
        resolved["start"] = h_start
        resolved["end"] = h_end
        resolved["duration_seconds"] = h_dur
        sliced_quote = self._slice_segments_quote(grouped_segments, start_id, end_id)
        if sliced_quote:
            resolved["transcript_quote"] = sliced_quote
        elif "transcript_quote" not in resolved or resolved["transcript_quote"] is None:
            resolved["transcript_quote"] = ""
        resolved.pop("start_id", None)
        resolved.pop("end_id", None)
        return resolved

    def _resolve_hook_from_timestamps(
        self,
        hook: Dict[str, Any],
        grouped_segments: list,
        effective_min_dur: float,
        effective_max_dur: float,
    ) -> Optional[Dict[str, Any]]:
        """Legacy float timestamp fallback preserving min/max enforcement and quote slicing."""
        h_start = self._safe_float(hook.get("start"))
        h_end = self._safe_float(hook.get("end"))
        if h_start is None or h_end is None or h_end <= h_start:
            return None

        if (h_end - h_start) > effective_max_dur:
            h_end = round(h_start + effective_max_dur, 2)

        h_dur = round(h_end - h_start, 2)
        if h_dur <= 0.0 or h_dur < effective_min_dur:
            return None

        resolved = dict(hook)
        resolved["start"] = round(h_start, 2)
        resolved["end"] = round(h_end, 2)
        resolved["duration_seconds"] = h_dur
        sliced_quote = self._extract_transcript_quote(grouped_segments, resolved["start"], resolved["end"])
        if sliced_quote:
            resolved["transcript_quote"] = sliced_quote
        elif "transcript_quote" not in resolved or resolved["transcript_quote"] is None:
            resolved["transcript_quote"] = ""
        return resolved

    def discover_from_transcript(
        self,
        transcript_segments: list,
        video_info: Optional[dict] = None,
        options: Optional[HookDiscoveryOptions] = None,
    ) -> List[Dict[str, Any]]:
        """Direct AI transcript hook discovery with sentence grouping, retries, and scoring."""
        opts = options or HookDiscoveryOptions()
        meta_duration = self._safe_float(video_info.get("duration")) if video_info else None

        active_model = self.get_active_model_name()
        client = self.client
        if not client:
            print("[hook-discovery-engine] No GenAI client or GEMINI_API_KEY available.")
            raise missing_api_key_error(active_model)

        grouped_segments = self._group_words_into_sentences(transcript_segments)
        effective_video_duration = meta_duration if (meta_duration is not None and meta_duration > 0.0) else None
        if effective_video_duration is None and grouped_segments:
            span_end = max(
                (self._safe_float(s.get("start")) or 0.0)
                + max(0.0, self._safe_float(s.get("duration")) or 0.0)
                for s in grouped_segments
            )
            if span_end > 0.0:
                effective_video_duration = span_end
        print(
            f"[hook-discovery-engine] Requesting transcript-based analysis for {len(transcript_segments)} "
            f"segments grouped into {len(grouped_segments)} sentences "
            f"(mode={opts.extraction_mode}, preset={opts.preset_id}, auto={opts.auto_hooks}, num={opts.num_hooks})..."
        )

        transcript_lines = []
        for idx, s in enumerate(grouped_segments):
            start = float(s["start"])
            dur = float(s["duration"])
            transcript_lines.append(f"[#{idx} | {start:.2f}s-{start + dur:.2f}s] {s['text']}")
        transcript_text = ("\n".join(transcript_lines) + "\n") if transcript_lines else ""

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
            video_duration=effective_video_duration,
        )

        effective_min_dur = (
            0.0
            if (effective_video_duration is not None and effective_video_duration < float(opts.min_duration))
            else float(opts.min_duration)
        )
        effective_max_dur = max(float(opts.max_duration), effective_min_dur)

        max_retries = 3
        last_error: Optional[HookDiscoveryError] = None
        for attempt in range(max_retries):
            print(
                f"[hook-discovery-engine] Requesting text analysis with model={active_model} "
                f"(Attempt {attempt + 1}/{max_retries})..."
            )
            try:
                raw_json = self._call_generate_json(
                    client,
                    prompt,
                    active_model,
                    response_schema=HOOK_DISCOVERY_RESPONSE_SCHEMA,
                    temperature=0.2,
                )
                parsed = json.loads(raw_json)
                if not isinstance(parsed, list):
                    raise invalid_response_error(active_model, raw_json)
                if len(parsed) == 0:
                    return []
                resolved_hooks: List[Dict[str, Any]] = []
                for idx, raw_hook in enumerate(parsed):
                    if not isinstance(raw_hook, dict):
                        continue
                    uses_segment_ids = "start_id" in raw_hook or "end_id" in raw_hook
                    if uses_segment_ids:
                        hook = self._resolve_hook_from_segment_ids(
                            raw_hook, grouped_segments, effective_min_dur, effective_max_dur
                        )
                    else:
                        hook = self._resolve_hook_from_timestamps(
                            raw_hook, grouped_segments, effective_min_dur, effective_max_dur
                        )
                    if hook is None:
                        continue

                    v_score = hook.get("virality_score")
                    if not isinstance(v_score, (int, float)) or v_score < 0 or v_score > 100:
                        hook["virality_score"] = 85 - (idx * 2)
                    else:
                        hook["virality_score"] = int(round(v_score))

                    if not hook.get("virality_reason"):
                        hook["virality_reason"] = "Compelling opening hook with natural narrative pacing."
                    resolved_hooks.append(hook)

                resolved_hooks.sort(
                    key=lambda h: (
                        -int(h.get("virality_score", 0)),
                        self._safe_float(h.get("start")) or 0.0,
                    )
                )
                deduped_hooks = self._deduplicate_overlapping_hooks(resolved_hooks, max_overlap_ratio=0.20)
                dropped = len(resolved_hooks) - len(deduped_hooks)
                if dropped:
                    print(
                        f"[hook-discovery-engine] Discovered {len(deduped_hooks)} hooks from transcript "
                        f"({dropped} overlapping duplicate(s) removed)."
                    )
                else:
                    print(f"[hook-discovery-engine] Successfully discovered {len(deduped_hooks)} hooks from transcript.")
                return deduped_hooks
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

        opts = options or HookDiscoveryOptions()
        raw_hooks = self.discover_from_transcript(transcript_segments, video_info=video_info, options=opts)
        if not raw_hooks:
            return []

        grouped_segments = self._group_words_into_sentences(transcript_segments)
        sanitized = self.sanitize_and_prepare_hooks(
            raw_hooks,
            video_info,
            max_duration=opts.max_duration,
            grouped_segments=grouped_segments,
        )

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

    def sanitize_and_prepare_hooks(
        self,
        raw_hooks: list,
        video_info: dict,
        min_duration: Optional[float] = None,
        max_duration: Optional[float] = None,
        grouped_segments: Optional[list] = None,
    ) -> List[Dict[str, Any]]:
        """Filter, clamp boundaries, re-slice modified quotes, and generate sharp thumbnails."""
        video_duration = video_info.get("duration", float("inf"))
        file_path = video_info.get("file_path")
        if not file_path:
            return []

        folder_name = video_info.get("folder_name") or os.path.basename(os.path.dirname(file_path))
        target_dir = os.path.dirname(file_path)

        min_dur = 15.0 if min_duration is None else float(min_duration)
        max_dur = 180.0 if max_duration is None else float(max_duration)
        filtered = []
        for h in raw_hooks:
            try:
                h_start = float(h.get("start", 0))
                h_end = float(h.get("end", 0))

                if h_start < 0 or h_start >= video_duration or h_end > (video_duration + 5):
                    continue

                boundaries_changed = False
                if math.isfinite(video_duration) and h_end > video_duration:
                    h_end = video_duration
                    boundaries_changed = True

                if (h_end - h_start) < min_dur:
                    h_end = min(h_start + min_dur, video_duration) if math.isfinite(video_duration) else (h_start + min_dur)
                    boundaries_changed = True

                if (h_end - h_start) > max_dur:
                    snapped_end = None
                    if grouped_segments:
                        limit_end = h_start + max_dur
                        for seg in grouped_segments:
                            seg_s = self._safe_float(seg.get("start"))
                            seg_d = self._safe_float(seg.get("duration"))
                            if seg_s is None:
                                continue
                            seg_e = seg_s + max(0.0, seg_d if seg_d is not None else 0.0)
                            if h_start < seg_e <= limit_end and (snapped_end is None or seg_e > snapped_end):
                                snapped_end = seg_e
                    if snapped_end is not None and (snapped_end - h_start) >= min_dur:
                        h_end = snapped_end
                    else:
                        h_end = h_start + max_dur
                    boundaries_changed = True

                h["start"] = round(h_start, 2)
                h["end"] = round(h_end, 2)
                dur = round(h_end - h_start, 2)
                h["duration"] = dur
                h["duration_seconds"] = dur

                if boundaries_changed and grouped_segments:
                    sliced = self._extract_transcript_quote(grouped_segments, h["start"], h["end"])
                    if sliced:
                        h["transcript_quote"] = sliced

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
