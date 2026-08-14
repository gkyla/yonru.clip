import pytest
import json
import sys
import os

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.hook_generator import HookGenerator
from core.genai_client import GenAIClient, MockGenAIClient

# Mock custom exception to simulate Google GenAI API errors robustly
class MockAPIError(Exception):
    def __init__(self, message, code):
        super().__init__(message)
        self.code = code
        self.message = message

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
            "end": 5.5,
            "duration_seconds": 5.5,
            "transcript_quote": "This is a compelling clip hook sentence. Everyone should watch this video.",
            "theme": "Introduction Hook"
        }
    ])

def test_success_on_first_try(sample_transcript, sample_gemini_response):
    """Verify that direct success on the first API call works correctly."""
    mock_client = MockGenAIClient(sample_gemini_response)
    generator = HookGenerator(genai_client=mock_client)
    
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is not None
    parsed = json.loads(result)
    assert len(parsed) == 1
    assert parsed[0]["theme"] == "Introduction Hook"

def test_retry_on_transient_rate_limit_and_succeed(sample_transcript, sample_gemini_response):
    """Verify rate limit retry works: transient failure on first, succeeds on second."""
    class RetryMockClient(GenAIClient):
        def __init__(self):
            self.call_count = 0
        def generate_json(self, prompt, model_name):
            self.call_count += 1
            if self.call_count == 1:
                raise MockAPIError("Rate Limit Exceeded", 429)
            return sample_gemini_response

    mock_client = RetryMockClient()
    generator = HookGenerator(genai_client=mock_client)
    
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is not None
    parsed = json.loads(result)
    assert parsed[0]["theme"] == "Introduction Hook"
    assert mock_client.call_count == 2

def test_retry_exhaustion_on_transient_rate_limit(sample_transcript):
    """Verify that a persistent transient failure retries exactly 3 times and returns None."""
    class PersistentFailureMockClient(GenAIClient):
        def __init__(self):
            self.call_count = 0
        def generate_json(self, prompt, model_name):
            self.call_count += 1
            raise MockAPIError("Service Unavailable", 503)

    mock_client = PersistentFailureMockClient()
    generator = HookGenerator(genai_client=mock_client)
    
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is None
    assert mock_client.call_count == 3

def test_fail_immediately_on_fatal_unauthorized_error(sample_transcript):
    """Verify that fatal error (401 Unauthorized) fails immediately without retry."""
    class FatalFailureMockClient(GenAIClient):
        def __init__(self):
            self.call_count = 0
        def generate_json(self, prompt, model_name):
            self.call_count += 1
            raise MockAPIError("Unauthorized API Key", 401)

    mock_client = FatalFailureMockClient()
    generator = HookGenerator(genai_client=mock_client)
    
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is None
    assert mock_client.call_count == 1


def test_group_words_into_sentences():
    """Verify that _group_words_into_sentences correctly groups word-level and sentence-level inputs."""
    generator = HookGenerator(genai_client=MockGenAIClient())
    
    # 1. Test word-level input
    word_level = [
        {"start": 0.0, "duration": 0.5, "text": "Hello"},
        {"start": 0.5, "duration": 0.5, "text": "world."},
        {"start": 1.0, "duration": 0.5, "text": "This"},
        {"start": 1.5, "duration": 0.5, "text": "is"},
        {"start": 2.0, "duration": 0.5, "text": "a"},
        {"start": 2.5, "duration": 0.5, "text": "test."}
    ]
    grouped = generator._group_words_into_sentences(word_level)
    assert len(grouped) == 2
    assert grouped[0]["text"] == "Hello world."
    assert grouped[0]["start"] == 0.0
    assert abs(grouped[0]["duration"] - 1.0) < 1e-5
    
    assert grouped[1]["text"] == "This is a test."
    assert grouped[1]["start"] == 1.0
    assert abs(grouped[1]["duration"] - 2.0) < 1e-5

    # 2. Test max_words limit
    many_words = [{"start": float(i), "duration": 1.0, "text": f"word{i}"} for i in range(25)]
    grouped_limit = generator._group_words_into_sentences(many_words, max_words=10)
    assert len(grouped_limit) == 3
    assert len(grouped_limit[0]["text"].split()) == 10
    assert len(grouped_limit[1]["text"].split()) == 10
    assert len(grouped_limit[2]["text"].split()) == 5

    # 3. Test silence gap limit
    silence_input = [
        {"start": 0.0, "duration": 1.0, "text": "first"},
        {"start": 1.0, "duration": 1.0, "text": "second"},
        {"start": 5.0, "duration": 1.0, "text": "third"}
    ]
    grouped_silence = generator._group_words_into_sentences(silence_input, max_silence=2.0)
    assert len(grouped_silence) == 2
    assert grouped_silence[0]["text"] == "first second"
    assert grouped_silence[1]["text"] == "third"

def test_hook_generator_with_preset_mode_and_virality_sorting(sample_transcript):
    """Verify that preset extraction works and sorts hooks descending by virality_score."""
    raw_response = json.dumps([
        {
            "start": 0.0,
            "end": 35.0,
            "duration_seconds": 35.0,
            "transcript_quote": "Hook 1 quote",
            "theme": "Lower Virality Hook",
            "virality_score": 78,
            "virality_reason": "Good explanation but lacks emotional opening."
        },
        {
            "start": 40.0,
            "end": 90.0,
            "duration_seconds": 50.0,
            "transcript_quote": "Hook 2 quote",
            "theme": "Top Viral Hook",
            "virality_score": 95,
            "virality_reason": "Exceptional first 3 seconds hook with strong contrast."
        }
    ])
    
    mock_client = MockGenAIClient(raw_response)
    generator = HookGenerator(genai_client=mock_client)
    
    result = generator.find_hooks_from_transcript(
        sample_transcript,
        extraction_mode="preset",
        preset_id="educational",
        focus_topic="diet",
        min_duration=30,
        max_duration=180
    )
    
    assert result is not None
    parsed = json.loads(result)
    assert len(parsed) == 2
    # Verify descending sort by virality_score
    assert parsed[0]["virality_score"] == 95
    assert parsed[0]["theme"] == "Top Viral Hook"
    assert parsed[1]["virality_score"] == 78

def test_hook_generator_virality_score_fallback(sample_transcript):
    """Verify fallback defaults if LLM output omits virality_score or virality_reason."""
    raw_response = json.dumps([
        {
            "start": 0.0,
            "end": 30.0,
            "duration_seconds": 30.0,
            "transcript_quote": "Hook without virality quote",
            "theme": "Fallback Hook"
        }
    ])
    
    mock_client = MockGenAIClient(raw_response)
    generator = HookGenerator(genai_client=mock_client)
    
    result = generator.find_hooks_from_transcript(sample_transcript, extraction_mode="preset")
    assert result is not None
    parsed = json.loads(result)
    assert parsed[0]["virality_score"] >= 0
    assert "virality_reason" in parsed[0]


