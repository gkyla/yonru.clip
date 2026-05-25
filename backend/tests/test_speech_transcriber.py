import pytest
import sys
import os

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.speech_transcriber import MockSpeechTranscriber, MockSegment, MockWord


def test_clean_text():
    """Verify that clean_text removes commas and trims whitespace."""
    transcriber = MockSpeechTranscriber()
    
    assert transcriber.clean_text("Hello, world!") == "Hello world!"
    assert transcriber.clean_text("   text, with, commas   ") == "text with commas"
    assert transcriber.clean_text(",,,,,,") == ""


def test_transcribe_with_word_timestamps():
    """Verify transcription parses word-level timestamps when present."""
    mock_words = [
        MockWord(word="Hello,", start=0.0, end=0.5),
        MockWord(word="world!", start=0.6, end=1.2)
    ]
    mock_segments = [
        MockSegment(text="Hello, world!", start=0.0, end=1.5, words=mock_words)
    ]
    
    mock_client = MockSpeechTranscriber(mock_segments=mock_segments)
    results = mock_client.transcribe("dummy_audio.wav", language="en")
    
    assert mock_client.last_audio_path == "dummy_audio.wav"
    assert len(results) == 2
    
    assert results[0] == {
        "start": 0.0,
        "duration": pytest.approx(0.5),
        "text": "Hello"
    }
    assert results[1] == {
        "start": 0.6,
        "duration": pytest.approx(0.6),
        "text": "world!"
    }


def test_transcribe_fallback_to_segment_text():
    """Verify transcription falls back to segment text when word timestamps are absent."""
    mock_segments = [
        MockSegment(text="Segment one,", start=1.0, end=3.5, words=[]),
        MockSegment(text="Segment two", start=4.0, end=6.0, words=None)
    ]
    
    mock_client = MockSpeechTranscriber(mock_segments=mock_segments)
    results = mock_client.transcribe("dummy_audio.wav")
    
    assert len(results) == 2
    assert results[0] == {
        "start": 1.0,
        "duration": pytest.approx(2.5),
        "text": "Segment one"
    }
    assert results[1] == {
        "start": 4.0,
        "duration": pytest.approx(2.0),
        "text": "Segment two"
    }


def test_transcribe_skips_empty_cleaned_text():
    """Verify that segments or words with only commas/whitespace are skipped."""
    mock_words = [
        MockWord(word=", , ,", start=0.0, end=0.5),
        MockWord(word="Valid", start=0.6, end=1.2)
    ]
    mock_segments = [
        # Segment 1 has valid and invalid words
        MockSegment(text="Valid", start=0.0, end=1.5, words=mock_words),
        # Segment 2 has no words and invalid segment text
        MockSegment(text=",,,,", start=2.0, end=3.0, words=[])
    ]
    
    mock_client = MockSpeechTranscriber(mock_segments=mock_segments)
    results = mock_client.transcribe("dummy_audio.wav")
    
    assert len(results) == 1
    assert results[0] == {
        "start": 0.6,
        "duration": pytest.approx(0.6),
        "text": "Valid"
    }
