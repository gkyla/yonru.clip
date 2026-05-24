import pytest
import os
import sys

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.subtitle_engine import DefaultSubtitleEngine, MockSubtitleEngine


def test_subtitle_engine_word_grouping():
    """Verify word-count groupings like 1_word, 3_word, etc."""
    engine = DefaultSubtitleEngine()
    segments = [{"start": 0.0, "duration": 2.0, "text": "hello sweet world"}]
    
    # 1. Single word mode
    words = engine.format_subtitles(segments, "1_word", 0, 2.0, 0.0, True)
    assert len(words) == 3
    assert words[0]["word"] == "hello"
    assert words[1]["word"] == "sweet"
    assert words[2]["word"] == "world"
    
    # Check linear duration interpolation
    assert round(words[0]["end"] - words[0]["start"], 3) == 0.667

    # 2. Multi word mode (3 words grouped together)
    grouped = engine.format_subtitles(segments, "3_word", 0, 2.0, 0.0, True)
    assert len(grouped) == 1
    assert grouped[0]["word"] == "hello sweet world"
    assert grouped[0]["start"] == 0.0
    assert grouped[0]["end"] == 2.0


def test_subtitle_engine_char_limits():
    """Verify character limit groupings like 12_chars."""
    engine = DefaultSubtitleEngine()
    segments = [{"start": 0.0, "duration": 3.0, "text": "hello sweet world"}]
    
    # Limit of 12 splits "hello sweet" (11 chars) and "world" (5 chars)
    chars = engine.format_subtitles(segments, "12_chars", 0, 3.0, 0.0, True)
    assert len(chars) == 2
    assert chars[0]["word"] == "hello sweet"
    assert chars[1]["word"] == "world"
    
    # Timing bounds checking
    assert chars[0]["start"] == 0.0
    assert round(chars[0]["end"], 2) == 2.0
    assert round(chars[1]["start"], 2) == 2.0
    assert chars[1]["end"] == 3.0


def test_subtitle_engine_sync_offsets():
    """Verify timing sync offset pushes start and end timestamps correctly."""
    engine = DefaultSubtitleEngine()
    segments = [{"start": 1.0, "duration": 1.0, "text": "test"}]
    
    # Delay by 500ms should move start/end by +0.5s
    offset = engine.format_subtitles(segments, "word", 500, 5.0, 0.0, True)
    assert len(offset) == 1
    assert offset[0]["start"] == 1.5
    assert offset[0]["end"] == 2.5
    
    # Shift earlier by 500ms
    early = engine.format_subtitles(segments, "word", -500, 5.0, 0.0, True)
    assert len(early) == 1
    assert early[0]["start"] == 0.5
    assert early[0]["end"] == 1.5


def test_subtitle_engine_absolute_timing_bounds():
    """Verify absolute timing clamps boundaries of segments within active clip window."""
    engine = DefaultSubtitleEngine()
    segments = [
        {"start": 10.0, "duration": 5.0, "text": "starts before"},
        {"start": 12.0, "duration": 4.0, "text": "inside clip"},
        {"start": 18.0, "duration": 5.0, "text": "starts after"}
    ]
    
    # Active clip starts at 11.0s and ends at 17.0s (duration 6.0s)
    # is_relative = False (absolute coordinates)
    words = engine.format_subtitles(
        segments=segments,
        subtitle_mode="word",
        sync_offset_ms=0,
        clip_duration=6.0,
        clip_start=11.0,
        is_relative=False
    )
    
    # 'starts before' starts at 10.0, ends at 15.0 -> inside active window from 11.0 to 15.0
    # 'inside clip' is 12.0 to 16.0 -> completely inside
    # 'starts after' is 18.0 to 23.0 -> completely outside
    
    texts = [w["word"] for w in words]
    assert "inside" in texts
    assert "clip" in texts
    assert "after" not in texts
    
    # The absolute window from 11.0 to 17.0 maps to clip-relative 0.0 to 6.0
    # 'inside clip' starting at 12.0s absolute maps to 1.0s clip-relative
    inside_word = next(w for w in words if w["word"] == "inside")
    assert inside_word["start"] == 1.0


def test_mock_subtitle_engine():
    """Verify mock subtitle engine captures calls and returns mocked output."""
    mock_output = [{"start": 0.0, "end": 1.0, "word": "mocked"}]
    mock_engine = MockSubtitleEngine(mock_output)
    
    res = mock_engine.format_subtitles([], "word", 0, 5.0)
    assert res == mock_output
    assert len(mock_engine.calls) == 1
    assert mock_engine.calls[0]["subtitle_mode"] == "word"
