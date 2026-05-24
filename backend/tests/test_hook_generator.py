import pytest
import json
import sys
import os

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.hook_generator import HookGenerator

# Mock custom exception to simulate Google GenAI API errors robustly
class MockAPIError(Exception):
    def __init__(self, message, code):
        super().__init__(message)
        self.code = code
        self.message = message

@pytest.fixture
def mock_genai_client(mocker):
    """Fixture to mock genai.Client inside HookGenerator"""
    mock_client = mocker.Mock()
    mocker.patch("core.hook_generator.genai.Client", return_value=mock_client)
    return mock_client

@pytest.fixture
def sample_transcript():
    return [
        {"start": 0.0, "duration": 2.5, "text": "This is a compelling clip hook sentence."},
        {"start": 2.5, "duration": 3.0, "text": "Everyone should watch this video."}
    ]

@pytest.fixture
def sample_gemini_response(mocker):
    mock_resp = mocker.Mock()
    mock_resp.text = json.dumps([
        {
            "start": 0.0,
            "end": 5.5,
            "duration_seconds": 5.5,
            "transcript_quote": "This is a compelling clip hook sentence. Everyone should watch this video.",
            "theme": "Introduction Hook"
        }
    ])
    return mock_resp

def test_success_on_first_try(mock_genai_client, sample_transcript, sample_gemini_response):
    """
    TDD Test 1: Verification of direct success on the first API call.
    The client should make exactly 1 attempt and return the generated hooks.
    """
    mock_genai_client.models.generate_content.return_value = sample_gemini_response
    
    generator = HookGenerator(api_key="fake-key")
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is not None
    parsed = json.loads(result)
    assert len(parsed) == 1
    assert parsed[0]["theme"] == "Introduction Hook"
    assert mock_genai_client.models.generate_content.call_count == 1

def test_retry_on_transient_rate_limit_and_succeed(mock_genai_client, sample_transcript, sample_gemini_response):
    """
    TDD Test 2: Transient error (429 Rate Limit) on first call, success on second.
    Should retry exactly once more (2 calls total) and succeed.
    """
    # First call raises transient 429 error; second call succeeds
    mock_genai_client.models.generate_content.side_effect = [
        MockAPIError("Rate Limit Exceeded", 429),
        sample_gemini_response
    ]
    
    generator = HookGenerator(api_key="fake-key")
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is not None
    parsed = json.loads(result)
    assert parsed[0]["theme"] == "Introduction Hook"
    assert mock_genai_client.models.generate_content.call_count == 2

def test_retry_exhaustion_on_transient_rate_limit(mock_genai_client, sample_transcript):
    """
    TDD Test 3: Transient error (503 Service Unavailable) persists through all retries.
    Should attempt exactly 3 times (the maximum count) and return None.
    """
    # All three calls raise transient 503 error
    mock_genai_client.models.generate_content.side_effect = [
        MockAPIError("Service Unavailable", 503),
        MockAPIError("Service Unavailable", 503),
        MockAPIError("Service Unavailable", 503)
    ]
    
    generator = HookGenerator(api_key="fake-key")
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is None
    assert mock_genai_client.models.generate_content.call_count == 3

def test_fail_immediately_on_fatal_unauthorized_error(mock_genai_client, sample_transcript):
    """
    TDD Test 4: Fatal error (401 Unauthorized) occurs on first call.
    Should fail fast immediately (only 1 call total) and return None.
    """
    # First call raises fatal 401 Authentication Error
    mock_genai_client.models.generate_content.side_effect = MockAPIError("Unauthorized API Key", 401)
    
    generator = HookGenerator(api_key="fake-key")
    result = generator.find_hooks_from_transcript(sample_transcript)
    
    assert result is None
    # Must fail fast and NOT retry (exactly 1 call)
    assert mock_genai_client.models.generate_content.call_count == 1
