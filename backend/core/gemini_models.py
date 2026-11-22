from typing import Dict, List, Optional

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite"
LEGACY_DEPRECATED_GEMINI_MODELS = frozenset({"gemini-2.5-flash"})

HOOK_DISCOVERY_MODELS: List[Dict[str, str]] = [
    {
        "id": "gemini-3.5-flash-lite",
        "provider": "gemini",
        "label": "Gemini 3.5 Flash-Lite",
        "short_label": "3.5 LITE",
        "tier": "Default",
        "description": "Fastest response with the highest free-tier daily allowance. Best default for everyday clipping.",
    },
    {
        "id": "gemini-3.6-flash",
        "provider": "gemini",
        "label": "Gemini 3.6 Flash",
        "short_label": "3.6 FLASH",
        "tier": "Balanced",
        "description": "Stronger narrative reasoning for nuanced dialogue, with a moderate free-tier daily allowance.",
    },
    {
        "id": "gemini-3.8-flash",
        "provider": "gemini",
        "label": "Gemini 3.8 Flash",
        "short_label": "3.8 FLASH",
        "tier": "Highest Quality",
        "description": "Deepest hook reasoning for complex long-form discussions, with the strictest free-tier daily cap.",
    },
]

ALLOWED_GEMINI_MODELS = frozenset(m["id"] for m in HOOK_DISCOVERY_MODELS)
_MODEL_LABELS_BY_ID = {m["id"]: m["label"] for m in HOOK_DISCOVERY_MODELS}


def _clean_model_id(raw_model: str) -> str:
    return raw_model.strip().strip("\"'")


def get_gemini_model_label(model_id: str) -> str:
    """Return the creator-facing label for a Hook Discovery Model ID."""
    return _MODEL_LABELS_BY_ID.get(model_id, model_id)


def normalize_gemini_model(raw_model: Optional[str]) -> str:
    """Normalize unset, deprecated, or unrecognized model values safely to the default model."""
    if not isinstance(raw_model, str):
        return DEFAULT_GEMINI_MODEL
    cleaned = _clean_model_id(raw_model)
    if not cleaned or cleaned in LEGACY_DEPRECATED_GEMINI_MODELS:
        return DEFAULT_GEMINI_MODEL
    if cleaned not in ALLOWED_GEMINI_MODELS:
        return DEFAULT_GEMINI_MODEL
    return cleaned


def validate_gemini_model(raw_model: Optional[str]) -> str:
    """Validate an explicit Hook Discovery Model selection, raising ValueError for unknown IDs."""
    if raw_model is None:
        return DEFAULT_GEMINI_MODEL
    if not isinstance(raw_model, str):
        raise ValueError("Hook Discovery Model must be a string.")
    cleaned = _clean_model_id(raw_model)
    if not cleaned or cleaned in LEGACY_DEPRECATED_GEMINI_MODELS:
        return DEFAULT_GEMINI_MODEL
    if cleaned in ALLOWED_GEMINI_MODELS:
        return cleaned
    allowed_list = ", ".join(m["id"] for m in HOOK_DISCOVERY_MODELS)
    raise ValueError(
        f"Unsupported Hook Discovery Model '{raw_model}'. Allowed models: {allowed_list}."
    )
