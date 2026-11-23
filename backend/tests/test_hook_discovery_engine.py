import pytest
import json
import os
import sys
from pathlib import Path

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.hook_discovery_engine import (
    DEFAULT_GEMINI_MODEL,
    HookDiscoveryEngine,
    HookDiscoveryError,
    HookDiscoveryOptions,
    HookDiscoveryQuotaError,
)
from core.config_store import InMemoryConfigStore
from core.media_transcoder import MediaTranscoder, FakeMediaAdapter
from core.genai_client import MockGenAIClient, GenAIClient

class MockAPIError(Exception):
    def __init__(self, message, code):
        super().__init__(message)
        self.code = code
        self.message = message

@pytest.fixture
def fake_transcoder():
    return MediaTranscoder(adapter=FakeMediaAdapter())

@pytest.fixture
def sample_transcript():
    return [
        {"start": 0.0, "duration": 2.5, "text": "This is a compelling clip hook sentence."},
        {"start": 2.5, "duration": 3.0, "text": "Everyone should watch this video."}
    ]

@pytest.fixture
def sample_gemini_response():
    return json.dumps([
        {
            "start": 0.0,
            "end": 20.0,
            "duration_seconds": 20.0,
            "transcript_quote": "This is a compelling clip hook sentence.",
            "theme": "Top Viral Intro",
            "virality_score": 92,
            "virality_reason": "Punchy hook"
        },
        {
            "start": 25.0,
            "end": 45.0,
            "duration_seconds": 20.0,
            "transcript_quote": "Everyone should watch this video.",
            "theme": "Secondary Point",
            "virality_score": 75,
            "virality_reason": "Clear narrative transition"
        }
    ])

def test_load_cached_hooks_when_file_exists(tmp_path, fake_transcoder):
    video_dir = tmp_path / "video_source_1"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    
    cached_hooks = [
        {"start": 10.0, "end": 30.0, "duration": 20.0, "theme": "Existing Cached Hook"}
    ]
    hooks_file = video_dir / "hooks.json"
    hooks_file.write_text(json.dumps(cached_hooks))
    
    engine = HookDiscoveryEngine(media_transcoder=fake_transcoder)
    video_info = {
        "file_path": str(video_file),
        "duration": 100.0,
        "folder_name": "video_source_1"
    }
    
    result = engine.load_cached_hooks(video_info)
    assert result is not None
    assert len(result) == 1
    assert result[0]["theme"] == "Existing Cached Hook"
    assert result[0]["start"] == 10.0
    assert result[0]["duration"] == 20.0
    assert "thumbnail_url" in result[0]

def test_load_cached_hooks_returns_none_when_no_cache(tmp_path, fake_transcoder):
    video_dir = tmp_path / "video_source_2"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    
    engine = HookDiscoveryEngine(media_transcoder=fake_transcoder)
    video_info = {
        "file_path": str(video_file),
        "duration": 100.0,
        "folder_name": "video_source_2"
    }
    
    result = engine.load_cached_hooks(video_info)
    assert result is None

def test_get_or_discover_hooks_cache_hit_skips_gemini(tmp_path, fake_transcoder):
    video_dir = tmp_path / "video_source_3"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    
    cached_hooks = [
        {"start": 5.0, "end": 25.0, "duration": 20.0, "theme": "Cache Hit"}
    ]
    (video_dir / "hooks.json").write_text(json.dumps(cached_hooks))
    
    class ExplodingClient(GenAIClient):
        def generate_json(self, prompt, model_name):
            raise AssertionError("Gemini should not be called when cached hooks exist!")
            
    engine = HookDiscoveryEngine(genai_client=ExplodingClient(), media_transcoder=fake_transcoder)
    video_info = {
        "file_path": str(video_file),
        "duration": 100.0,
        "folder_name": "video_source_3"
    }
    
    result = engine.get_or_discover_hooks(video_info, transcript_segments=[])
    assert len(result) == 1
    assert result[0]["theme"] == "Cache Hit"

def test_get_or_discover_hooks_cache_miss_generates_and_persists(
    tmp_path, fake_transcoder, sample_transcript, sample_gemini_response
):
    video_dir = tmp_path / "video_source_4"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    
    mock_client = MockGenAIClient(sample_gemini_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)
    
    video_info = {
        "file_path": str(video_file),
        "duration": 120.0,
        "folder_name": "video_source_4"
    }
    
    options = HookDiscoveryOptions(preset_id="educational", num_hooks=5)
    result = engine.get_or_discover_hooks(
        video_info=video_info,
        transcript_segments=sample_transcript,
        options=options
    )
    
    assert len(result) == 2
    # Verify descending sort by virality score
    assert result[0]["virality_score"] == 92
    assert result[1]["virality_score"] == 75
    # Verify thumbnails extracted
    assert result[0]["thumbnail_url"] == "/assets/sources/video_source_4/thumb_0.jpg"
    assert result[1]["thumbnail_url"] == "/assets/sources/video_source_4/thumb_25.jpg"
    
    # Verify written to disk cache
    hooks_file = video_dir / "hooks.json"
    assert hooks_file.exists()
    saved = json.loads(hooks_file.read_text())
    assert len(saved) == 2
    assert saved[0]["virality_score"] == 92

def test_get_or_discover_hooks_force_reanalyze(
    tmp_path, fake_transcoder, sample_transcript, sample_gemini_response
):
    video_dir = tmp_path / "video_source_5"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    
    # Existing outdated cache
    old_hooks = [{"start": 10.0, "end": 30.0, "theme": "Old Stale Hook"}]
    (video_dir / "hooks.json").write_text(json.dumps(old_hooks))
    
    mock_client = MockGenAIClient(sample_gemini_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)
    
    video_info = {
        "file_path": str(video_file),
        "duration": 120.0,
        "folder_name": "video_source_5"
    }
    
    result = engine.get_or_discover_hooks(
        video_info=video_info,
        transcript_segments=sample_transcript,
        force_reanalyze=True
    )
    
    assert len(result) == 2
    assert result[0]["theme"] == "Top Viral Intro"
    
    # Verify disk cache overwritten
    saved = json.loads((video_dir / "hooks.json").read_text())
    assert saved[0]["theme"] == "Top Viral Intro"

def test_sanitize_and_prepare_hooks_clamping_and_bounds(tmp_path, fake_transcoder):
    video_dir = tmp_path / "video_source_6"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    
    engine = HookDiscoveryEngine(media_transcoder=fake_transcoder)
    video_info = {
        "file_path": str(video_file),
        "duration": 300.0,
        "folder_name": "video_source_6"
    }
    
    raw_hooks = [
        # Out of bounds: start before 0
        {"start": -5.0, "end": 20.0, "title": "Negative Start"},
        # Out of bounds: start >= video duration
        {"start": 305.0, "end": 320.0, "title": "Past Duration"},
        # Dur < MIN_DUR (15s): 10.0 to 15.0 (5s) -> clamped to 10.0 to 25.0 (15s)
        {"start": 10.0, "end": 15.0, "title": "Too Short"},
        # Dur > MAX_DUR (180s): 0.0 to 250.0 -> clamped to 0.0 to 180.0 (180s)
        {"start": 0.0, "end": 250.0, "title": "Too Long"},
        # Normal hook
        {"start": 30.123, "end": 60.456, "title": "Normal"}
    ]
    
    cleaned = engine.sanitize_and_prepare_hooks(raw_hooks, video_info)
    assert len(cleaned) == 3
    
    # Check clamped short
    assert cleaned[0]["title"] == "Too Short"
    assert cleaned[0]["start"] == 10.0
    assert cleaned[0]["end"] == 25.0
    assert cleaned[0]["duration"] == 15.0
    
    # Check clamped long
    assert cleaned[1]["title"] == "Too Long"
    assert cleaned[1]["start"] == 0.0
    assert cleaned[1]["end"] == 180.0
    assert cleaned[1]["duration"] == 180.0
    
    # Check rounding
    assert cleaned[2]["title"] == "Normal"
    assert cleaned[2]["start"] == 30.12
    assert cleaned[2]["end"] == 60.46
    assert cleaned[2]["duration"] == 30.33
    
    # Check thumbnails generated via transcoder
    assert cleaned[0]["thumbnail_url"] == "/assets/sources/video_source_6/thumb_10.jpg"
    assert (video_dir / "thumb_10.jpg").exists()

def test_transient_error_retry(sample_transcript, sample_gemini_response, fake_transcoder):
    class TransientClient(GenAIClient):
        def __init__(self):
            self.calls = 0
        def generate_json(self, prompt, model_name):
            self.calls += 1
            if self.calls == 1:
                raise MockAPIError("503 UNAVAILABLE. This model is currently experiencing high demand.", 503)
            return sample_gemini_response

    sleep_calls = []
    client = TransientClient()
    engine = HookDiscoveryEngine(
        genai_client=client,
        media_transcoder=fake_transcoder,
        sleep_fn=sleep_calls.append,
    )

    hooks = engine.discover_from_transcript(sample_transcript)
    assert len(hooks) == 2
    assert client.calls == 2
    assert sleep_calls == [2.0]

def test_fatal_error_fails_immediately(sample_transcript, fake_transcoder):
    class FatalClient(GenAIClient):
        def __init__(self):
            self.calls = 0
        def generate_json(self, prompt, model_name):
            self.calls += 1
            raise MockAPIError("Auth Failed API_KEY_INVALID AIzaSyTestSecretKey12345", 401)

    client = FatalClient()
    engine = HookDiscoveryEngine(
        genai_client=client,
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )

    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert client.calls == 1
    assert exc_info.value.detail.origin == "config"
    assert exc_info.value.detail.code == "auth_error"
    assert exc_info.value.detail.retryable is False
    assert "AIzaSyTestSecretKey12345" not in (exc_info.value.detail.raw_error or "")
    assert "AIza***REDACTED***" in (exc_info.value.detail.raw_error or "")


def test_retry_exhaustion_on_transient_rate_limit(sample_transcript, fake_transcoder):
    """Verify that persistent 503 high demand retries 3 times with 2s -> 4s backoff and raises provider error."""
    class PersistentFailureMockClient(GenAIClient):
        def __init__(self):
            self.call_count = 0
        def generate_json(self, prompt, model_name):
            self.call_count += 1
            raise MockAPIError("503 UNAVAILABLE. This model is currently experiencing high demand.", 503)

    sleep_calls = []
    mock_client = PersistentFailureMockClient()
    engine = HookDiscoveryEngine(
        genai_client=mock_client,
        media_transcoder=fake_transcoder,
        sleep_fn=sleep_calls.append,
    )

    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert mock_client.call_count == 3
    assert sleep_calls == [2.0, 4.0]
    assert exc_info.value.detail.origin == "provider"
    assert exc_info.value.detail.code == "high_demand"
    assert exc_info.value.detail.retryable is True
    assert "Gemini's side" in exc_info.value.detail.message


def test_group_words_into_sentences(fake_transcoder):
    """Verify that _group_words_into_sentences correctly groups word-level and sentence-level inputs."""
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(), media_transcoder=fake_transcoder)
    
    # 1. Test word-level input
    word_level = [
        {"start": 0.0, "duration": 0.5, "text": "Hello"},
        {"start": 0.5, "duration": 0.5, "text": "world."},
        {"start": 1.0, "duration": 0.5, "text": "This"},
        {"start": 1.5, "duration": 0.5, "text": "is"},
        {"start": 2.0, "duration": 0.5, "text": "a"},
        {"start": 2.5, "duration": 0.5, "text": "test."},
    ]
    grouped = engine._group_words_into_sentences(word_level)
    assert len(grouped) == 2
    assert grouped[0]["text"] == "Hello world."
    assert grouped[0]["start"] == 0.0
    assert abs(grouped[0]["duration"] - 1.0) < 1e-5
    
    assert grouped[1]["text"] == "This is a test."
    assert grouped[1]["start"] == 1.0
    assert abs(grouped[1]["duration"] - 2.0) < 1e-5

    # 2. Test max_words limit
    many_words = [{"start": float(i), "duration": 1.0, "text": f"word{i}"} for i in range(25)]
    grouped_limit = engine._group_words_into_sentences(many_words, max_words=10)
    assert len(grouped_limit) == 3
    assert len(grouped_limit[0]["text"].split()) == 10
    assert len(grouped_limit[1]["text"].split()) == 10
    assert len(grouped_limit[2]["text"].split()) == 5

    # 3. Test silence gap limit
    silence_input = [
        {"start": 0.0, "duration": 1.0, "text": "first"},
        {"start": 1.0, "duration": 1.0, "text": "second"},
        {"start": 5.0, "duration": 1.0, "text": "third"},
    ]
    grouped_silence = engine._group_words_into_sentences(silence_input, max_silence=2.0)
    assert len(grouped_silence) == 2
    assert grouped_silence[0]["text"] == "first second"
    assert grouped_silence[1]["text"] == "third"


def test_hook_discovery_virality_score_fallback(sample_transcript, fake_transcoder):
    """Verify fallback defaults if LLM output omits virality_score or virality_reason."""
    raw_response = json.dumps([
        {
            "start": 0.0,
            "end": 30.0,
            "duration_seconds": 30.0,
            "transcript_quote": "Hook without virality quote",
            "theme": "Fallback Hook",
        }
    ])
    
    mock_client = MockGenAIClient(raw_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)
    
    result = engine.discover_from_transcript(sample_transcript)
    assert len(result) == 1
    assert result[0]["virality_score"] >= 0
    assert "virality_reason" in result[0]


def test_find_hooks_from_transcript_backward_compat(sample_transcript, sample_gemini_response, fake_transcoder):
    """Verify backward-compatible find_hooks_from_transcript string JSON output and hook_generator property."""
    mock_client = MockGenAIClient(sample_gemini_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)
    
    assert engine.hook_generator is engine
    
    raw_json = engine.find_hooks_from_transcript(sample_transcript)
    assert raw_json is not None
    parsed = json.loads(raw_json)
    assert len(parsed) == 2
    assert parsed[0]["theme"] == "Top Viral Intro"


def test_discover_from_transcript_uses_default_and_dynamic_config_models(
    sample_transcript, sample_gemini_response, fake_transcoder
):
    """Default model is gemini-3.5-flash-lite, legacy 2.5 normalizes, and config updates take effect dynamically."""
    config_store = InMemoryConfigStore()
    mock_client = MockGenAIClient(sample_gemini_response)
    engine = HookDiscoveryEngine(
        config_store=config_store,
        genai_client=mock_client,
        media_transcoder=fake_transcoder,
    )

    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == DEFAULT_GEMINI_MODEL == "gemini-3.5-flash-lite"

    config_store.set("GEMINI_MODEL", "gemini-2.5-flash")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-3.5-flash-lite"

    config_store.set("GEMINI_MODEL", "gemini-3.6-flash")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-3.6-flash"

    config_store.set("GEMINI_MODEL", "gemini-3.8-flash")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-3.8-flash"


def test_quota_exhaustion_fails_fast_without_retries_or_downgrade(sample_transcript, fake_transcoder):
    """429/quota errors must fail fast on the first attempt with actionable model guidance."""
    config_store = InMemoryConfigStore({"GEMINI_MODEL": "gemini-3.8-flash"})

    class QuotaClient(GenAIClient):
        def __init__(self):
            self.calls = 0
            self.models_called = []

        def generate_json(self, prompt, model_name):
            self.calls += 1
            self.models_called.append(model_name)
            raise MockAPIError("429 RESOURCE_EXHAUSTED Quota exceeded", 429)

    client = QuotaClient()
    engine = HookDiscoveryEngine(
        config_store=config_store,
        genai_client=client,
        media_transcoder=fake_transcoder,
    )

    with pytest.raises(HookDiscoveryQuotaError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert client.calls == 1
    assert client.models_called == ["gemini-3.8-flash"]
    assert "Gemini 3.8 Flash" in str(exc_info.value)
    assert "Gemini 3.5 Flash-Lite" in str(exc_info.value)


def test_quota_exhaustion_on_default_model_names_active_model(sample_transcript, fake_transcoder):
    """When already on gemini-3.5-flash-lite, 429 error avoids suggesting switching to itself."""
    config_store = InMemoryConfigStore({"GEMINI_MODEL": "gemini-3.5-flash-lite"})

    class QuotaClient(GenAIClient):
        def __init__(self):
            self.calls = 0

        def generate_json(self, prompt, model_name):
            self.calls += 1
            raise MockAPIError("Quota exceeded for free tier", 429)

    client = QuotaClient()
    engine = HookDiscoveryEngine(
        config_store=config_store,
        genai_client=client,
        media_transcoder=fake_transcoder,
    )

    with pytest.raises(HookDiscoveryQuotaError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert client.calls == 1
    assert "Gemini 3.5 Flash-Lite" in str(exc_info.value)
    assert "Switch to" not in str(exc_info.value)


def test_missing_api_key_raises_config_error(sample_transcript, fake_transcoder, monkeypatch):
    """Missing API key raises structured config/missing_api_key error instead of returning []."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    engine = HookDiscoveryEngine(
        config_store=InMemoryConfigStore(),
        genai_client=None,
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert exc_info.value.detail.origin == "config"
    assert exc_info.value.detail.code == "missing_api_key"
    assert exc_info.value.detail.retryable is False


def test_model_unavailable_404_fails_fast(sample_transcript, fake_transcoder):
    class MissingModelClient(GenAIClient):
        def __init__(self):
            self.calls = 0

        def generate_json(self, prompt, model_name):
            self.calls += 1
            raise MockAPIError("404 NOT_FOUND model not found", 404)

    client = MissingModelClient()
    engine = HookDiscoveryEngine(
        genai_client=client,
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert client.calls == 1
    assert exc_info.value.detail.origin == "provider"
    assert exc_info.value.detail.code == "model_unavailable"
    assert exc_info.value.detail.retryable is False


def test_network_timeout_retries_and_raises_network_error(sample_transcript, fake_transcoder):
    class TimeoutClient(GenAIClient):
        def __init__(self):
            self.calls = 0

        def generate_json(self, prompt, model_name):
            self.calls += 1
            raise ConnectionError("Connection timed out while contacting generativelanguage.googleapis.com")

    sleep_calls = []
    client = TimeoutClient()
    engine = HookDiscoveryEngine(
        genai_client=client,
        media_transcoder=fake_transcoder,
        sleep_fn=sleep_calls.append,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert client.calls == 3
    assert sleep_calls == [2.0, 4.0]
    assert exc_info.value.detail.origin == "network"
    assert exc_info.value.detail.code == "network_error"
    assert exc_info.value.detail.retryable is True


def test_invalid_json_output_retries_and_raises_output_error(sample_transcript, fake_transcoder):
    class BadJsonClient(GenAIClient):
        def __init__(self):
            self.calls = 0

        def generate_json(self, prompt, model_name):
            self.calls += 1
            return "{not valid json"

    client = BadJsonClient()
    engine = HookDiscoveryEngine(
        genai_client=client,
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert client.calls == 3
    assert exc_info.value.detail.origin == "output"
    assert exc_info.value.detail.code == "invalid_response"
    assert exc_info.value.detail.retryable is True


@pytest.mark.parametrize("raw_key", ["your_gemini_api_key_here", "[]"])
def test_placeholder_or_empty_json_api_key_raises_missing_api_key(
    sample_transcript, fake_transcoder, monkeypatch, raw_key
):
    """Placeholder or empty JSON-array API key configs classify as missing_api_key, not auth_error."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    engine = HookDiscoveryEngine(
        config_store=InMemoryConfigStore({"GEMINI_API_KEY": raw_key}),
        genai_client=None,
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert exc_info.value.detail.origin == "config"
    assert exc_info.value.detail.code == "missing_api_key"
    assert exc_info.value.detail.retryable is False


def test_json_decode_error_with_http_like_numbers_classifies_as_invalid_response(
    sample_transcript, fake_transcoder
):
    """Malformed JSON offsets like 'column 400 (char 500)' must classify as output/invalid_response."""
    class JsonOffsetErrorClient(GenAIClient):
        def generate_json(self, prompt, model_name):
            raise json.JSONDecodeError("Expecting value", "{bad", 500)

    engine = HookDiscoveryEngine(
        genai_client=JsonOffsetErrorClient(),
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert exc_info.value.detail.origin == "output"
    assert exc_info.value.detail.code == "invalid_response"


def test_timeout_with_5000ms_classifies_as_network_error(sample_transcript, fake_transcoder):
    """Timeout message containing '5000ms' must classify as network/network_error, not provider 500."""
    class MillisecondTimeoutClient(GenAIClient):
        def generate_json(self, prompt, model_name):
            raise TimeoutError("Read timed out after 5000ms")

    engine = HookDiscoveryEngine(
        genai_client=MillisecondTimeoutClient(),
        media_transcoder=fake_transcoder,
        sleep_fn=lambda _: None,
    )
    with pytest.raises(HookDiscoveryError) as exc_info:
        engine.discover_from_transcript(sample_transcript)

    assert exc_info.value.detail.origin == "network"
    assert exc_info.value.detail.code == "network_error"


def test_discover_slices_verbatim_transcript_quote_when_llm_omits_it(fake_transcoder):
    """When LLM omits transcript_quote, engine deterministically slices verbatim text from [start, end]."""
    transcript = [
        {"start": 0.0, "duration": 5.0, "text": "Preceding intro banter."},
        {"start": 10.0, "duration": 15.0, "text": "First real hook opening sentence."},
        {"start": 25.0, "duration": 15.0, "text": "Payoff punchline lands here."},
        {"start": 40.0, "duration": 10.0, "text": "Following unrelated topic."},
    ]
    llm_response = json.dumps([
        {
            "start": 10.0,
            "end": 40.0,
            "theme": "Real Hook",
            "virality_score": 88,
            "virality_reason": "Sharp insight with clear payoff.",
        }
    ])
    mock_client = MockGenAIClient(llm_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(transcript, video_info={"duration": 60.0})
    assert len(hooks) == 1
    assert hooks[0]["transcript_quote"] == "First real hook opening sentence. Payoff punchline lands here."
    assert "Preceding intro banter" not in hooks[0]["transcript_quote"]
    assert "Following unrelated topic" not in hooks[0]["transcript_quote"]
    assert hooks[0]["duration_seconds"] == 30.0


def test_discover_preserves_existing_quote_when_transcript_range_empty(fake_transcoder):
    """Fallback preserves pre-existing quote (or sets empty string) if sliced range has no words."""
    transcript = [
        {"start": 0.0, "duration": 5.0, "text": "Only early audio."},
    ]
    llm_response = json.dumps([
        {
            "start": 30.0,
            "end": 60.0,
            "transcript_quote": "Legacy quote preserved.",
            "theme": "Out Of Range With Legacy Quote",
            "virality_score": 82,
            "virality_reason": "Fallback check.",
        },
        {
            "start": 70.0,
            "end": 100.0,
            "theme": "Out Of Range Without Quote",
            "virality_score": 76,
            "virality_reason": "Empty quote check.",
        },
    ])
    mock_client = MockGenAIClient(llm_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(transcript, video_info={"duration": 120.0})
    assert len(hooks) == 2
    assert hooks[0]["transcript_quote"] == "Legacy quote preserved."
    assert hooks[1]["transcript_quote"] == ""


def test_discover_deduplicates_heavy_overlaps_and_keeps_back_to_back_hooks(fake_transcoder):
    """Deduplicates >20% overlap keeping highest virality_score, while touching/slight overlaps survive."""
    transcript = [
        {"start": 0.0, "duration": 200.0, "text": "Continuous multi-topic podcast conversation."},
    ]
    # 1. Back-to-back pair: [0, 50] (score 91) and [50, 100] (score 84) -> both survive (0% overlap)
    # 2. Heavy overlap pair A (longer higher): [200, 280] (80s, score 95) vs [220, 260] (40s, score 89) -> 40/40 = 100% > 20% -> [200, 280] wins
    # 3. Heavy overlap pair B (shorter higher): [300, 380] (80s, score 78) vs [310, 350] (40s, score 93) -> 40/40 = 100% > 20% -> [310, 350] wins
    # 4. Slight overlap <= 20%: [400, 460] (60s, score 86) vs [450, 510] (60s, score 80) -> 10/60 = 16.7% <= 20% -> both survive
    llm_response = json.dumps([
        {"start": 0.0, "end": 50.0, "theme": "Back To Back 1", "virality_score": 91},
        {"start": 50.0, "end": 100.0, "theme": "Back To Back 2", "virality_score": 84},
        {"start": 220.0, "end": 260.0, "theme": "Weaker Shorter Overlap", "virality_score": 89},
        {"start": 200.0, "end": 280.0, "theme": "Stronger Longer Overlap", "virality_score": 95},
        {"start": 300.0, "end": 380.0, "theme": "Weaker Longer Overlap", "virality_score": 78},
        {"start": 310.0, "end": 350.0, "theme": "Stronger Shorter Overlap", "virality_score": 93},
        {"start": 400.0, "end": 460.0, "theme": "Slight Overlap 1", "virality_score": 86},
        {"start": 450.0, "end": 510.0, "theme": "Slight Overlap 2", "virality_score": 80},
    ])
    mock_client = MockGenAIClient(llm_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(transcript, video_info={"duration": 600.0})
    themes = [h["theme"] for h in hooks]
    assert "Stronger Longer Overlap" in themes
    assert "Weaker Shorter Overlap" not in themes
    assert "Stronger Shorter Overlap" in themes
    assert "Weaker Longer Overlap" not in themes
    assert "Back To Back 1" in themes
    assert "Back To Back 2" in themes
    assert "Slight Overlap 1" in themes
    assert "Slight Overlap 2" in themes
    assert len(hooks) == 6


def test_discover_preserves_tier3_hooks_sorted_descending(fake_transcoder):
    """Borderline Tier 3 hooks (<75) are preserved alongside higher tiers, sorted descending."""
    transcript = [{"start": 0.0, "duration": 300.0, "text": "Full timeline discussion."}]
    llm_response = json.dumps([
        {"start": 0.0, "end": 40.0, "theme": "Low", "virality_score": 68},
        {"start": 50.0, "end": 90.0, "theme": "Top", "virality_score": 94},
        {"start": 100.0, "end": 140.0, "theme": "Borderline", "virality_score": 72},
        {"start": 150.0, "end": 190.0, "theme": "Strong", "virality_score": 83},
    ])
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(llm_response), media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(transcript, video_info={"duration": 300.0})
    assert [h["virality_score"] for h in hooks] == [94, 83, 72, 68]


def test_discover_derives_video_duration_from_transcript_when_metadata_missing(fake_transcoder):
    """Falls back to transcript span when video_info is absent or lacks positive duration."""
    transcript = [
        {"start": 0.0, "duration": 450.0, "text": "First half of the podcast."},
        {"start": 450.0, "duration": 450.0, "text": "Second half up to fifteen minutes."},
    ]
    llm_response = json.dumps([
        {"start": 10.0, "end": 50.0, "theme": "Early Clip", "virality_score": 88}
    ])

    for info in (None, {"duration": None}, {"duration": 0}):
        mock_client = MockGenAIClient(llm_response)
        engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)
        engine.discover_from_transcript(transcript, video_info=info)

        assert mock_client.last_prompt is not None
        assert "VIDEO DURATION: The total length is 900.0 seconds" in mock_client.last_prompt
        assert "COVERAGE SANITY CHECK" in mock_client.last_prompt




