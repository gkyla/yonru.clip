import pytest
import json
import os
import sys
from pathlib import Path

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.hook_discovery_engine import (
    DEFAULT_GEMINI_MODEL,
    HOOK_DISCOVERY_MODELS,
    HookDiscoveryEngine,
    HookDiscoveryError,
    HookDiscoveryOptions,
    HookDiscoveryQuotaError,
)
from core.config_store import InMemoryConfigStore
from core.media_transcoder import MediaTranscoder, FakeMediaAdapter
from core.genai_client import (
    HOOK_DISCOVERY_RESPONSE_SCHEMA,
    GenAIClient,
    MockGenAIClient,
)

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
            "end": 35.0,
            "duration_seconds": 35.0,
            "transcript_quote": "This is a compelling clip hook sentence.",
            "theme": "Top Viral Intro",
            "virality_score": 92,
            "virality_reason": "Punchy hook"
        },
        {
            "start": 40.0,
            "end": 75.0,
            "duration_seconds": 35.0,
            "transcript_quote": "Everyone should watch this video.",
            "theme": "Secondary Point",
            "virality_score": 75,
            "virality_reason": "Clear narrative transition"
        }
    ])

def test_load_cached_hooks_when_file_exists_is_strictly_readonly(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)
    video_dir = tmp_path / "video_source_1"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()

    cached_hooks = [
        {"start": 10.0, "end": 30.0, "duration": 20.0, "theme": "Existing Cached Hook"},
        {"start": 40.0, "end": 65.0, "duration": 25.0, "theme": "Thumb Present Hook"},
    ]
    hooks_file = video_dir / "hooks.json"
    hooks_file.write_text(json.dumps(cached_hooks))
    (video_dir / "thumb_40.jpg").write_bytes(b"\xff\xd8\xff")

    engine = HookDiscoveryEngine(media_transcoder=transcoder)
    video_info = {
        "file_path": str(video_file),
        "duration": 100.0,
        "folder_name": "video_source_1"
    }

    result = engine.load_cached_hooks(video_info)
    assert result is not None
    assert len(result) == 2
    assert result[0]["theme"] == "Existing Cached Hook"
    assert result[0]["start"] == 10.0
    assert result[0]["duration"] == 20.0
    assert result[0]["thumbnail_url"] is None
    assert not (video_dir / "thumb_10.jpg").exists()
    assert result[1]["thumbnail_url"] == "/assets/sources/video_source_1/thumb_40.jpg"
    assert adapter.calls == []

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

def test_get_or_discover_hooks_cache_hit_backfills_missing_thumbs_and_preserves_edits(tmp_path):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)
    video_dir = tmp_path / "video_source_3"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()

    hooks_file = video_dir / "hooks.json"
    cached_hooks = [
        {"start": 5.0, "end": 25.0, "duration": 20.0, "theme": "Cache Hit"},
        {"start": 30.0, "end": 55.0, "duration": 25.0, "theme": "Already Ready"},
    ]
    hooks_file.write_text(json.dumps(cached_hooks))
    (video_dir / "thumb_30.jpg").write_bytes(b"\xff\xd8\xff")

    class ExplodingClient(GenAIClient):
        def generate_json(self, prompt, model_name):
            raise AssertionError("Gemini should not be called when cached hooks exist!")

    engine = HookDiscoveryEngine(genai_client=ExplodingClient(), media_transcoder=transcoder)
    video_info = {
        "file_path": str(video_file),
        "duration": 100.0,
        "folder_name": "video_source_3"
    }

    result = engine.get_or_discover_hooks(video_info, transcript_segments=[])
    assert len(result) == 2
    assert result[0]["theme"] == "Cache Hit"
    assert result[0]["thumbnail_url"] == "/assets/sources/video_source_3/thumb_5.jpg"
    assert (video_dir / "thumb_5.jpg").exists()
    # Only the missing thumbnail triggered FFmpeg; duration came from video_info -> 0 ffprobe calls
    assert len([c for c in adapter.calls if c[0] == "ffprobe_info"]) == 0
    assert len([c for c in adapter.calls if c[0] == "run_ffmpeg"]) == 1


def test_ensure_hook_thumbnails_persist_merges_without_clobbering_concurrent_edits(tmp_path):
    video_dir = tmp_path / "video_merge"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()
    hooks_file = video_dir / "hooks.json"
    hooks_file.write_text(json.dumps([
        {"start": 10.0, "end": 30.0, "duration": 20.0, "theme": "Original Theme"}
    ]))

    def simulate_concurrent_edit(_args):
        hooks_file.write_text(json.dumps([
            {"start": 10.0, "end": 30.0, "duration": 20.0, "theme": "Creator Edited Theme"}
        ]))

    adapter = FakeMediaAdapter(ffmpeg_side_effect=simulate_concurrent_edit)
    engine = HookDiscoveryEngine(media_transcoder=MediaTranscoder(adapter=adapter))
    video_info = {"file_path": str(video_file), "duration": 100.0, "folder_name": "video_merge"}

    stale_snapshot = engine.load_cached_hooks(video_info)
    assert stale_snapshot is not None
    assert stale_snapshot[0]["thumbnail_url"] is None

    backfilled = engine.ensure_hook_thumbnails(stale_snapshot, video_info, persist=True)
    assert backfilled[0]["thumbnail_url"] == "/assets/sources/video_merge/thumb_10.jpg"

    persisted = json.loads(hooks_file.read_text())
    assert persisted[0]["theme"] == "Creator Edited Theme"
    assert persisted[0]["thumbnail_url"] == "/assets/sources/video_merge/thumb_10.jpg"


def test_get_or_discover_hooks_cache_miss_generates_and_persists(
    tmp_path, sample_transcript, sample_gemini_response
):
    adapter = FakeMediaAdapter()
    transcoder = MediaTranscoder(adapter=adapter)
    video_dir = tmp_path / "video_source_4"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()

    mock_client = MockGenAIClient(sample_gemini_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=transcoder)

    group_calls = 0
    orig_group = engine._group_words_into_sentences

    def spy_group(*args, **kwargs):
        nonlocal group_calls
        group_calls += 1
        return orig_group(*args, **kwargs)

    engine._group_words_into_sentences = spy_group

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

    assert group_calls == 1
    assert len(result) == 2
    # Verify descending sort by virality score
    assert result[0]["virality_score"] == 92
    assert result[1]["virality_score"] == 75
    # Verify thumbnails extracted via batch with 0 ffprobes
    assert result[0]["thumbnail_url"] == "/assets/sources/video_source_4/thumb_0.jpg"
    assert result[1]["thumbnail_url"] == "/assets/sources/video_source_4/thumb_40.jpg"
    assert len([c for c in adapter.calls if c[0] == "ffprobe_info"]) == 0
    assert len([c for c in adapter.calls if c[0] == "run_ffmpeg"]) == 2

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


def test_deprecated_hook_generator_compat_shims_removed(fake_transcoder):
    """Deprecated find_hooks_from_transcript and hook_generator shims have been removed."""
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(), media_transcoder=fake_transcoder)
    assert not hasattr(engine, "find_hooks_from_transcript")
    assert not hasattr(engine, "hook_generator")


def test_discover_from_transcript_uses_default_and_dynamic_config_models(
    sample_transcript, sample_gemini_response, fake_transcoder
):
    """Models are ordered smartest-to-lightest with gemini-4-hydrogen as default and dynamic config updates."""
    assert [m["id"] for m in HOOK_DISCOVERY_MODELS] == [
        "gemini-4-hydrogen",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
    ]
    config_store = InMemoryConfigStore()
    mock_client = MockGenAIClient(sample_gemini_response)
    engine = HookDiscoveryEngine(
        config_store=config_store,
        genai_client=mock_client,
        media_transcoder=fake_transcoder,
    )

    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == DEFAULT_GEMINI_MODEL == "gemini-4-hydrogen"

    config_store.set("GEMINI_MODEL", "gemini-2.5-flash")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-4-hydrogen"

    config_store.set("GEMINI_MODEL", "gemini-3.8-flash")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-3.8-flash"

    config_store.set("GEMINI_MODEL", "gemini-3.6-flash")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-3.6-flash"

    config_store.set("GEMINI_MODEL", "gemini-3.5-flash-lite")
    engine.discover_from_transcript(sample_transcript)
    assert mock_client.last_model_name == "gemini-3.5-flash-lite"


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


def test_quota_exhaustion_on_fallback_model_names_active_model(sample_transcript, fake_transcoder):
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


def test_quota_exhaustion_on_default_model_recommends_flash_lite_fallback(sample_transcript, fake_transcoder):
    """429 quota error on gemini-3.6-flash advises switching to Gemini 3.5 Flash-Lite."""
    config_store = InMemoryConfigStore({"GEMINI_MODEL": "gemini-3.6-flash"})

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
    assert "Gemini 3.6 Flash" in str(exc_info.value)
    assert "Gemini 3.5 Flash-Lite" in str(exc_info.value)


def test_quota_exhaustion_on_gemini_4_hydrogen_recommends_flash_lite_fallback(
    sample_transcript, fake_transcoder
):
    """429 quota error on gemini-4-hydrogen names Gemini 4 Hydrogen and recommends Gemini 3.5 Flash-Lite."""
    config_store = InMemoryConfigStore({"GEMINI_MODEL": "gemini-4-hydrogen"})

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
    assert "Gemini 4 Hydrogen" in str(exc_info.value)
    assert "Gemini 3.5 Flash-Lite" in str(exc_info.value)


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


def test_group_words_into_sentences_normalizes_overlapping_captions(fake_transcoder):
    """Overlapping/backwards-jumping YouTube caption runs become strictly monotonic in spoken order."""
    overlapping_words = [
        {"start": 0.12, "duration": 0.613, "text": "Yuk,"},
        {"start": 0.733, "duration": 0.613, "text": "sekarang"},
        {"start": 1.346, "duration": 0.614, "text": "kita"},
        {"start": 1.96, "duration": 1.84, "text": "jendela."},
        # Next caption starts earlier than previous caption's stretched display end
        {"start": 1.80, "duration": 0.567, "text": "Makannya"},
        {"start": 2.367, "duration": 0.567, "text": "kita"},
        {"start": 2.934, "duration": 2.266, "text": "atur."},
        # Third caption overlaps the second
        {"start": 3.80, "duration": 1.16, "text": "Kalimat"},
        {"start": 4.96, "duration": 1.16, "text": "terakhir."},
    ]
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(), media_transcoder=fake_transcoder)
    grouped = engine._group_words_into_sentences(overlapping_words)

    assert [g["text"] for g in grouped] == [
        "Yuk, sekarang kita jendela.",
        "Makannya kita atur.",
        "Kalimat terakhir.",
    ]
    for i, seg in enumerate(grouped):
        assert seg["duration"] >= 0.0
        if i > 0:
            prev_end = grouped[i - 1]["start"] + grouped[i - 1]["duration"]
            assert seg["start"] >= grouped[i - 1]["start"]
            assert seg["start"] >= prev_end - 1e-6


def test_discover_resolves_segment_ids_and_passes_structured_config(fake_transcoder):
    """Segment IDs resolve exact timestamps/quotes, strip IDs, skip invalid IDs, and pass temp=0.2 + schema."""
    transcript = [
        {"start": 0.0, "duration": 4.0, "text": "Intro chatter ignored."},
        {"start": 4.0, "duration": 18.0, "text": "Kenapa diet sering gagal padahal sudah olahraga?"},
        {"start": 22.0, "duration": 20.0, "text": "Karena jendela makan dan hormon insulin belum diatur."},
        {"start": 42.0, "duration": 5.0, "text": "Closing remark."},
    ]
    llm_response = json.dumps([
        {
            "theme": "Kenapa diet sering gagal",
            "start_id": 1,
            "end_id": 2,
            "virality_score": 91,
            "virality_reason": "Clear question and complete hormonal payoff.",
        },
        {
            "theme": "Out of bounds id",
            "start_id": 99,
            "end_id": 102,
            "virality_score": 80,
            "virality_reason": "Invalid segment id should be skipped.",
        },
    ])
    mock_client = MockGenAIClient(llm_response)
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(
        transcript,
        video_info={"duration": 120.0},
        options=HookDiscoveryOptions(min_duration=30, max_duration=180),
    )

    assert mock_client.last_temperature == 0.2
    assert mock_client.last_response_schema is HOOK_DISCOVERY_RESPONSE_SCHEMA
    assert mock_client.last_prompt is not None
    assert "[#0 | 0.00s-4.00s] Intro chatter ignored." in mock_client.last_prompt
    assert "[#1 | 4.00s-22.00s] Kenapa diet sering gagal" in mock_client.last_prompt

    assert len(hooks) == 1
    assert hooks[0]["start"] == 4.0
    assert hooks[0]["end"] == 42.0
    assert hooks[0]["duration_seconds"] == 38.0
    assert hooks[0]["transcript_quote"] == (
        "Kenapa diet sering gagal padahal sudah olahraga? "
        "Karena jendela makan dan hormon insulin belum diatur."
    )
    assert "start_id" not in hooks[0]
    assert "end_id" not in hooks[0]


def test_discover_trims_leading_and_trailing_boundary_fillers_preserving_content(fake_transcoder):
    """Standalone transition/backchannel lines are trimmed from boundaries without dropping real content."""
    transcript = [
        {"start": 0.0, "duration": 1.5, "text": "Next."},
        {"start": 1.5, "duration": 1.5, "text": "Oke, next."},
        {"start": 3.0, "duration": 18.0, "text": "Apakah penderita aritmia boleh lari jarak jauh?"},
        {"start": 21.0, "duration": 18.0, "text": "Ini penting: cek dokter dulu karena risikonya 30%."},
        {"start": 39.0, "duration": 2.0, "text": "Oh, gitu ya."},
        {"start": 41.0, "duration": 1.5, "text": "Gitu."},
        {"start": 42.5, "duration": 15.0, "text": "Sebanyak 30%."},
        {"start": 57.5, "duration": 16.0, "text": "Ini penting."},
        {"start": 73.5, "duration": 1.5, "text": "Yeah."},
        {"start": 75.0, "duration": 1.5, "text": "Right."},
        {"start": 76.5, "duration": 1.5, "text": "Oke."},
    ]
    llm_response = json.dumps([
        {
            "theme": "Bolehkah penderita aritmia lari",
            "start_id": 0,
            "end_id": 5,
            "virality_score": 89,
            "virality_reason": "Practical medical guidance.",
        },
        {
            "theme": "Persentase penting tetap utuh",
            "start_id": 6,
            "end_id": 10,
            "virality_score": 82,
            "virality_reason": "Preserves factual number and emphasis.",
        },
    ])
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(llm_response), media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(
        transcript,
        video_info={"duration": 120.0},
        options=HookDiscoveryOptions(min_duration=30, max_duration=180),
    )

    assert len(hooks) == 2
    assert hooks[0]["start"] == 3.0
    assert hooks[0]["end"] == 39.0
    assert hooks[0]["transcript_quote"] == (
        "Apakah penderita aritmia boleh lari jarak jauh? "
        "Ini penting: cek dokter dulu karena risikonya 30%."
    )
    assert hooks[1]["start"] == 42.5
    assert hooks[1]["end"] == 73.5
    assert hooks[1]["transcript_quote"] == "Sebanyak 30%. Ini penting."


def test_discover_enforces_real_min_duration_with_short_video_exemption(fake_transcoder):
    """Hooks shorter than opts.min_duration are dropped on normal videos, allowed when configurable or short video."""
    transcript = [
        {"start": 0.0, "duration": 17.0, "text": "Short seventeen second segment."},
        {"start": 20.0, "duration": 24.0, "text": "Twenty four second segment."},
        {"start": 50.0, "duration": 36.0, "text": "Complete thirty six second insight with full resolution."},
    ]
    llm_response = json.dumps([
        {"theme": "Hook 17s", "start_id": 0, "end_id": 0, "virality_score": 95},
        {"theme": "Hook 24s", "start_id": 1, "end_id": 1, "virality_score": 90},
        {"theme": "Hook 36s", "start_id": 2, "end_id": 2, "virality_score": 84},
    ])
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(llm_response), media_transcoder=fake_transcoder)

    hooks_min_30 = engine.discover_from_transcript(
        transcript,
        video_info={"duration": 120.0},
        options=HookDiscoveryOptions(min_duration=30, max_duration=180),
    )
    assert [h["theme"] for h in hooks_min_30] == ["Hook 36s"]

    hooks_min_15 = engine.discover_from_transcript(
        transcript,
        video_info={"duration": 120.0},
        options=HookDiscoveryOptions(min_duration=15, max_duration=180),
    )
    assert [h["theme"] for h in hooks_min_15] == ["Hook 17s", "Hook 24s", "Hook 36s"]

    short_video_hooks = engine.discover_from_transcript(
        [{"start": 0.0, "duration": 17.0, "text": "Compact teaser clip."}],
        video_info={"duration": 18.0},
        options=HookDiscoveryOptions(min_duration=30, max_duration=180),
    )
    assert [h["theme"] for h in short_video_hooks] == ["Hook 17s"]


def test_discover_snaps_overlong_segment_id_span_and_retrims_filler(fake_transcoder):
    """Spans exceeding max_duration snap back to last fitting sentence and re-trim newly exposed trailing filler."""
    transcript = [
        {"start": 0.0, "duration": 20.0, "text": "First complete setup sentence."},
        {"start": 20.0, "duration": 20.0, "text": "Core payoff lands cleanly here."},
        {"start": 40.0, "duration": 5.0, "text": "Oh, gitu ya."},
        {"start": 45.0, "duration": 30.0, "text": "Extra continuation that pushes duration past max limit."},
    ]
    llm_response = json.dumps([
        {
            "theme": "Overlong span snaps cleanly",
            "start_id": 0,
            "end_id": 3,
            "virality_score": 88,
            "virality_reason": "Strong opening payoff.",
        }
    ])
    engine = HookDiscoveryEngine(genai_client=MockGenAIClient(llm_response), media_transcoder=fake_transcoder)

    hooks = engine.discover_from_transcript(
        transcript,
        video_info={"duration": 120.0},
        options=HookDiscoveryOptions(min_duration=30, max_duration=50),
    )

    assert len(hooks) == 1
    assert hooks[0]["start"] == 0.0
    assert hooks[0]["end"] == 40.0
    assert hooks[0]["duration_seconds"] == 40.0
    assert hooks[0]["transcript_quote"] == "First complete setup sentence. Core payoff lands cleanly here."


def test_sanitize_and_prepare_hooks_updates_duration_seconds_and_reslices_on_clamp(tmp_path, fake_transcoder):
    """Clamping an overlong hook in sanitize_and_prepare_hooks snaps to segment boundary and updates quote/duration."""
    video_dir = tmp_path / "video_source_clamp"
    video_dir.mkdir()
    video_file = video_dir / "video.mp4"
    video_file.touch()

    grouped = [
        {"start": 0.0, "duration": 20.0, "text": "Opening premise sentence."},
        {"start": 20.0, "duration": 25.0, "text": "Second payoff sentence."},
        {"start": 45.0, "duration": 35.0, "text": "Trailing long section beyond limit."},
    ]
    raw_hooks = [
        {
            "start": 0.0,
            "end": 80.0,
            "duration_seconds": 80.0,
            "transcript_quote": "Opening premise sentence. Second payoff sentence. Trailing long section beyond limit.",
            "theme": "Overlong Hook",
        }
    ]
    engine = HookDiscoveryEngine(media_transcoder=fake_transcoder)
    cleaned = engine.sanitize_and_prepare_hooks(
        raw_hooks,
        {"file_path": str(video_file), "duration": 120.0, "folder_name": "video_source_clamp"},
        min_duration=30,
        max_duration=50,
        grouped_segments=grouped,
    )

    assert len(cleaned) == 1
    assert cleaned[0]["end"] == 45.0
    assert cleaned[0]["duration"] == 45.0
    assert cleaned[0]["duration_seconds"] == 45.0
    assert cleaned[0]["transcript_quote"] == "Opening premise sentence. Second payoff sentence."




