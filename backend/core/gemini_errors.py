import json
import re
from dataclasses import dataclass
from typing import Any, Dict, Literal, Optional, Tuple

from core.gemini_models import DEFAULT_GEMINI_MODEL, get_gemini_model_label

ErrorOrigin = Literal["provider", "config", "network", "output", "pipeline"]
ErrorCode = Literal[
    "high_demand",
    "quota_exceeded",
    "provider_error",
    "model_unavailable",
    "missing_api_key",
    "auth_error",
    "network_error",
    "invalid_response",
    "no_hooks_found",
    "pipeline_error",
]

_API_KEY_PATTERN = re.compile(r"AIza[0-9A-Za-z_-]{10,}")
_QUERY_KEY_PATTERN = re.compile(r"([?&]key=)[^&\s\"']+", re.IGNORECASE)


def redact_api_keys(text: str) -> str:
    """Mask any Google/Gemini API keys inside raw error strings before surfacing them to the UI."""
    if not text:
        return ""
    masked = _API_KEY_PATTERN.sub("AIza***REDACTED***", text)
    return _QUERY_KEY_PATTERN.sub(r"\1***REDACTED***", masked)


def _first_line(text: str, max_len: int = 160) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped[:max_len]
    return ""


def _extract_status_code(exc: Exception) -> Optional[int]:
    for attr in ("code", "status_code"):
        val = getattr(exc, attr, None)
        if isinstance(val, int):
            return val
    return None


def _has_status_code(text: str, status_code: int) -> bool:
    return re.search(rf"\b{status_code}\b", text) is not None


@dataclass(frozen=True)
class ErrorDetail:
    """Structured failure payload attributed by Error Origin for UI and API responses."""

    origin: ErrorOrigin
    code: ErrorCode
    title: str
    message: str
    hint: str
    model: Optional[str] = None
    raw_error: Optional[str] = None
    retryable: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "origin": self.origin,
            "code": self.code,
            "title": self.title,
            "message": self.message,
            "hint": self.hint,
            "model": self.model,
            "raw_error": self.raw_error,
            "retryable": self.retryable,
        }


class HookDiscoveryError(RuntimeError):
    """Structured exception raised when Hook Discovery fails with a known Error Origin."""

    def __init__(self, detail: ErrorDetail):
        self.detail = detail
        self.model_name = detail.model or DEFAULT_GEMINI_MODEL
        self.raw_error = detail.raw_error or ""
        super().__init__(detail.message)


class HookDiscoveryQuotaError(HookDiscoveryError):
    """Raised when all configured API keys hit quota or rate limits (429) for the active model."""

    def __init__(
        self,
        model_name: str,
        raw_error: str = "",
        model_label: Optional[str] = None,
    ):
        label = model_label or get_gemini_model_label(model_name)
        redacted_raw = redact_api_keys(raw_error)
        if model_name != DEFAULT_GEMINI_MODEL:
            message = (
                f"Quota or rate limit exceeded (429) for {label} ({model_name}) "
                "across all configured Gemini API keys. Switch to Gemini 3.5 Flash-Lite "
                "in Settings > AI Model for a higher free-tier allowance, or add a fallback API key."
            )
            hint = (
                "Switch to Gemini 3.5 Flash-Lite in Settings > AI Model, "
                "add a fallback API key, or wait for your quota to reset."
            )
        else:
            message = (
                f"Quota or rate limit exceeded (429) for {label} ({model_name}) "
                "across all configured Gemini API keys. Wait for quota reset, add a fallback API key "
                "in Settings > AI Model, or check your Google AI Studio rate limits."
            )
            hint = (
                "Wait for your free-tier quota to reset, add a fallback API key "
                "in Settings > AI Model, or check Google AI Studio rate limits."
            )

        detail = ErrorDetail(
            origin="provider",
            code="quota_exceeded",
            title="Gemini quota or rate limit reached",
            message=message,
            hint=hint,
            model=model_name,
            raw_error=redacted_raw or None,
            retryable=True,
        )
        super().__init__(detail)


def is_quota_error(exc: Exception) -> bool:
    """Return True when the provider returned a 429 quota or rate-limit failure."""
    if isinstance(exc, HookDiscoveryQuotaError):
        return True
    code = _extract_status_code(exc)
    if code == 429:
        return True
    lower = str(exc).lower()
    return (
        _has_status_code(lower, 429)
        or "quota" in lower
        or "resource_exhausted" in lower
    )


def is_auth_error(exc: Exception) -> bool:
    """Return True when the provider rejected the API key or project permissions."""
    if isinstance(exc, json.JSONDecodeError):
        return False
    code = _extract_status_code(exc)
    if code in (400, 401, 403):
        return True
    lower = str(exc).lower()
    if (
        _has_status_code(lower, 400)
        or _has_status_code(lower, 401)
        or _has_status_code(lower, 403)
    ):
        return True
    return any(
        token in lower
        for token in (
            "api_key_invalid",
            "invalid_argument",
            "unauthenticated",
            "permission_denied",
            "invalid api key",
        )
    )


def is_5xx_or_overload_error(exc: Exception) -> bool:
    """Return True when the provider returned 503 high demand or another 5xx server outage."""
    code = _extract_status_code(exc)
    if isinstance(exc, (json.JSONDecodeError, TimeoutError, ConnectionError)) and code is None:
        return False
    if code in (500, 502, 503, 504):
        return True
    lower = str(exc).lower()
    if any(_has_status_code(lower, s) for s in (500, 502, 503, 504)):
        return True
    return any(
        token in lower
        for token in (
            "unavailable",
            "high demand",
            "overloaded",
            "deadline_exceeded",
            "internal server error",
            "service unavailable",
        )
    )


def is_network_error(exc: Exception) -> bool:
    """Return True for connection, DNS, SSL, or socket timeout errors."""
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True
    lower = str(exc).lower()
    return any(
        token in lower
        for token in (
            "timeout",
            "timed out",
            "connect",
            "connection",
            "ssl",
            "dns",
            "name or service not known",
            "network",
            "unreachable",
            "nodename nor servname",
        )
    )


def _network_error(model_name: str, raw_text: str) -> HookDiscoveryError:
    return HookDiscoveryError(
        ErrorDetail(
            origin="network",
            code="network_error",
            title="Could not reach Gemini servers",
            message=(
                "Yonru Clip could not connect to Google's Gemini API due to a network or timeout error."
            ),
            hint="Check your internet connection, proxy, or firewall and retry.",
            model=model_name,
            raw_error=raw_text or None,
            retryable=True,
        )
    )


def missing_api_key_error(model_name: str = DEFAULT_GEMINI_MODEL) -> HookDiscoveryError:
    """Create a structured config error when no valid Gemini API key is configured."""
    return HookDiscoveryError(
        ErrorDetail(
            origin="config",
            code="missing_api_key",
            title="Gemini API key not configured",
            message=(
                "No valid Gemini API key is configured in Settings. "
                "Yonru Clip needs a Gemini API key to discover hooks from transcripts."
            ),
            hint="Open Settings > AI Model and add at least one valid Gemini API key.",
            model=model_name,
            raw_error=None,
            retryable=False,
        )
    )


def no_hooks_found_error(model_name: str = DEFAULT_GEMINI_MODEL) -> HookDiscoveryError:
    """Create a structured output error when Gemini succeeded but returned no usable hooks."""
    label = get_gemini_model_label(model_name)
    return HookDiscoveryError(
        ErrorDetail(
            origin="output",
            code="no_hooks_found",
            title="No usable hooks found in transcript",
            message=(
                f"{label} ({model_name}) analyzed the transcript, but none of the returned "
                "moments matched your clip duration or prompt filters."
            ),
            hint="Try adjusting Min/Max Duration, clearing Specific Topic Focus, or switching prompt presets.",
            model=model_name,
            raw_error=None,
            retryable=True,
        )
    )


def invalid_response_error(
    model_name: str,
    raw_error: str = "",
) -> HookDiscoveryError:
    """Create a structured output error when Gemini returns empty, blocked, or invalid JSON."""
    label = get_gemini_model_label(model_name)
    return HookDiscoveryError(
        ErrorDetail(
            origin="output",
            code="invalid_response",
            title="Gemini returned an unusable response",
            message=(
                f"{label} ({model_name}) returned an empty, blocked, or malformed response "
                "instead of valid hook timestamps."
            ),
            hint="Retry analysis, or try another Hook Discovery Model or prompt preset.",
            model=model_name,
            raw_error=redact_api_keys(raw_error) or None,
            retryable=True,
        )
    )


def classify_gemini_exception(
    exc: Exception,
    model_name: str = DEFAULT_GEMINI_MODEL,
    model_label: Optional[str] = None,
) -> HookDiscoveryError:
    """Map any Gemini SDK, HTTP, network, or parsing exception into a HookDiscoveryError."""
    if isinstance(exc, HookDiscoveryError):
        return exc

    label = model_label or get_gemini_model_label(model_name)
    raw_text = redact_api_keys(str(exc))
    lower = raw_text.lower()
    code = _extract_status_code(exc)

    # 1. Malformed JSON output (check before HTTP code substrings like "column 400 (char 500)")
    if isinstance(exc, json.JSONDecodeError):
        return invalid_response_error(model_name=model_name, raw_error=raw_text)

    # 2. Missing API key error (including placeholder-only / empty configs)
    if "no gemini api keys provided" in lower:
        return missing_api_key_error(model_name=model_name)

    # 3. Direct network/timeout exceptions without an HTTP status code
    if isinstance(exc, (TimeoutError, ConnectionError)) and code is None:
        return _network_error(model_name=model_name, raw_text=raw_text)

    # 4. Quota / rate limit (429)
    if is_quota_error(exc):
        return HookDiscoveryQuotaError(
            model_name=model_name,
            raw_error=raw_text,
            model_label=label,
        )

    # 5. High demand / 503 UNAVAILABLE on Gemini's side
    if (
        code == 503
        or _has_status_code(lower, 503)
        or "unavailable" in lower
        or "high demand" in lower
        or "overloaded" in lower
    ):
        return HookDiscoveryError(
            ErrorDetail(
                origin="provider",
                code="high_demand",
                title="Gemini is experiencing high demand",
                message=(
                    f"Google's Gemini service is temporarily overloaded for {label} ({model_name}) (503). "
                    "This is an issue on Gemini's side, not a bug in Yonru Clip."
                ),
                hint="Wait a moment and retry, or switch to another Hook Discovery Model in Settings > AI Model.",
                model=model_name,
                raw_error=raw_text or None,
                retryable=True,
            )
        )

    # 6. Other temporary Gemini 5xx server errors
    if (
        code in (500, 502, 504)
        or _has_status_code(lower, 500)
        or _has_status_code(lower, 502)
        or _has_status_code(lower, 504)
        or "deadline_exceeded" in lower
        or "internal server error" in lower
        or ("internal" in lower and "error" in lower)
    ):
        return HookDiscoveryError(
            ErrorDetail(
                origin="provider",
                code="provider_error",
                title="Gemini service temporarily unavailable",
                message=(
                    f"Google's Gemini service returned a temporary server error for {label} ({model_name}). "
                    "This is an issue on Gemini's side, not a bug in Yonru Clip."
                ),
                hint="Wait a few seconds and retry.",
                model=model_name,
                raw_error=raw_text or None,
                retryable=True,
            )
        )

    # 7. Model not found / unavailable for key or region (404)
    if code == 404 or _has_status_code(lower, 404) or "not_found" in lower:
        return HookDiscoveryError(
            ErrorDetail(
                origin="provider",
                code="model_unavailable",
                title="Selected Gemini model is unavailable",
                message=(
                    f"{label} ({model_name}) is currently not available for this API key or region (404)."
                ),
                hint="Choose another Hook Discovery Model in Settings > AI Model.",
                model=model_name,
                raw_error=raw_text or None,
                retryable=False,
            )
        )

    # 8. Auth / permission errors (403, then 400/401)
    if code == 403 or _has_status_code(lower, 403) or "permission_denied" in lower:
        return HookDiscoveryError(
            ErrorDetail(
                origin="config",
                code="auth_error",
                title="Gemini API permission denied",
                message=(
                    "Permission denied (403): your API key or Google Cloud project cannot access the Gemini API."
                ),
                hint="Enable the Generative Language API in Google AI Studio or replace the key in Settings > AI Model.",
                model=model_name,
                raw_error=raw_text or None,
                retryable=False,
            )
        )

    if is_auth_error(exc):
        return HookDiscoveryError(
            ErrorDetail(
                origin="config",
                code="auth_error",
                title="Gemini API key rejected",
                message=(
                    "Your Gemini API key was rejected as invalid or unauthorized. "
                    "Check that the full key was copied from Google AI Studio."
                ),
                hint="Update or test your Gemini API key in Settings > AI Model.",
                model=model_name,
                raw_error=raw_text or None,
                retryable=False,
            )
        )

    # 9. Network / timeout / SSL errors
    if is_network_error(exc):
        return _network_error(model_name=model_name, raw_text=raw_text)

    # 10. Empty / blocked / malformed response
    if (
        "json" in type(exc).__name__.lower()
        or "empty text response" in lower
        or "blocked" in lower
        or "safety" in lower
        or "finish_reason" in lower
        or isinstance(exc, ValueError)
    ):
        return invalid_response_error(model_name=model_name, raw_error=raw_text)

    # 11. Unclassified provider/runtime error with concise detail preserved
    summary = _first_line(raw_text) or "Unexpected Gemini API error"
    return HookDiscoveryError(
        ErrorDetail(
            origin="provider",
            code="provider_error",
            title="Gemini request failed",
            message=f"Gemini ({label}) returned an unexpected error: {summary}",
            hint="Wait a moment and retry, or inspect Technical details below.",
            model=model_name,
            raw_error=raw_text or None,
            retryable=True,
        )
    )


def classify_validation_exception(
    exc: Exception,
    model_name: str = DEFAULT_GEMINI_MODEL,
    model_label: Optional[str] = None,
) -> Tuple[Literal["invalid", "unavailable"], str, ErrorDetail]:
    """Classify a Settings API key validation error without marking healthy keys invalid on 503/network outages."""
    err = classify_gemini_exception(exc, model_name=model_name, model_label=model_label)
    detail = err.detail
    if detail.code in ("high_demand", "provider_error", "network_error"):
        status: Literal["invalid", "unavailable"] = "unavailable"
        if detail.code == "high_demand":
            user_msg = (
                f"Gemini is experiencing high demand (503) for {model_label or get_gemini_model_label(model_name)} "
                f"({model_name}). Your key may still be valid; wait a moment and test again."
            )
        elif detail.code == "network_error":
            user_msg = "Connection Timeout: Unable to reach Google AI servers. Check your network or proxy and test again."
        else:
            user_msg = f"{detail.message} Your key could not be verified right now."
        return status, user_msg, detail

    if detail.code == "quota_exceeded":
        label = model_label or get_gemini_model_label(model_name)
        if model_name != DEFAULT_GEMINI_MODEL:
            user_msg = (
                f"Rate Limit / Quota exceeded (429) for {label} ({model_name}): "
                "Free tier limit reached. Switch to Gemini 3.5 Flash-Lite or use a fallback key."
            )
        else:
            user_msg = (
                f"Rate Limit / Quota exceeded (429) for {label} ({model_name}): "
                "Free tier RPM limit reached. Please wait a moment or use a fallback key."
            )
        return "invalid", user_msg, detail

    if detail.code == "model_unavailable":
        label = model_label or get_gemini_model_label(model_name)
        return (
            "invalid",
            f"Model Not Found (404): {label} ({model_name}) is not available for this API key or region.",
            detail,
        )

    return "invalid", detail.message, detail
