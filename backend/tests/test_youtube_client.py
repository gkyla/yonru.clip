import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.youtube_client import YouTubeClient


def test_fetch_transcript_normalizes_overlapping_captions_monotonically():
    """Rolling YouTube captions are clamped to prevent overlapping or backward word timestamps."""
    raw_captions = [
        {"start": 0.12, "duration": 3.68, "text": "Yuk sekarang kita mulai"},
        {"start": 1.80, "duration": 3.40, "text": "makannya kita atur"},
        {"start": 3.80, "duration": 2.32, "text": "kalimat terakhir"},
    ]

    mock_transcript = MagicMock()
    mock_transcript.language = "Indonesian"
    mock_transcript.fetch.return_value = raw_captions

    mock_list = MagicMock()
    mock_list.find_transcript.return_value = mock_transcript

    with patch("youtube_transcript_api.YouTubeTranscriptApi") as mock_api_cls:
        mock_api_cls.return_value.list.return_value = mock_list
        words = YouTubeClient().fetch_transcript("video_123")

    assert [w["text"] for w in words] == [
        "Yuk", "sekarang", "kita", "mulai",
        "makannya", "kita", "atur",
        "kalimat", "terakhir",
    ]

    for i, word in enumerate(words):
        assert word["duration"] >= 0.0
        if i > 0:
            prev_end = words[i - 1]["start"] + words[i - 1]["duration"]
            assert word["start"] >= words[i - 1]["start"]
            assert word["start"] >= prev_end - 1e-6

    # First caption's words fit before second caption starts at 1.80s
    assert words[3]["start"] + words[3]["duration"] <= 1.80 + 1e-6
    # Second caption's words start at 1.80s and end before third caption starts at 3.80s
    assert abs(words[4]["start"] - 1.80) < 1e-6
    assert words[6]["start"] + words[6]["duration"] <= 3.80 + 1e-6
