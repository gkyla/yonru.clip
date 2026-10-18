import pytest
import json
import os
import sys
from pathlib import Path

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.hook_discovery_engine import HookDiscoveryEngine, HookDiscoveryOptions
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
                raise MockAPIError("Rate limited", 429)
            return sample_gemini_response
            
    client = TransientClient()
    engine = HookDiscoveryEngine(genai_client=client, media_transcoder=fake_transcoder)
    
    hooks = engine.discover_from_transcript(sample_transcript)
    assert len(hooks) == 2
    assert client.calls == 2

def test_fatal_error_fails_immediately(sample_transcript, fake_transcoder):
    class FatalClient(GenAIClient):
        def __init__(self):
            self.calls = 0
        def generate_json(self, prompt, model_name):
            self.calls += 1
            raise MockAPIError("Auth Failed", 401)
            
    client = FatalClient()
    engine = HookDiscoveryEngine(genai_client=client, media_transcoder=fake_transcoder)
    
    hooks = engine.discover_from_transcript(sample_transcript)
    assert len(hooks) == 0
    assert client.calls == 1


def test_retry_exhaustion_on_transient_rate_limit(sample_transcript, fake_transcoder):
    """Verify that a persistent transient failure retries exactly 3 times and returns empty list."""
    class PersistentFailureMockClient(GenAIClient):
        def __init__(self):
            self.call_count = 0
        def generate_json(self, prompt, model_name):
            self.call_count += 1
            raise MockAPIError("Service Unavailable", 503)

    mock_client = PersistentFailureMockClient()
    engine = HookDiscoveryEngine(genai_client=mock_client, media_transcoder=fake_transcoder)
    
    result = engine.discover_from_transcript(sample_transcript)
    
    assert result == []
    assert mock_client.call_count == 3


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

