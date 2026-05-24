import pytest
import os
import sys
import tempfile
import shutil

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.youtube_parser import YouTubeParser
from core.youtube_client import MockYouTubeClient
from core.config_store import InMemoryConfigStore


def test_youtube_parser_delegation():
    """Verify YouTubeParser delegates properties and methods to client and repo correctly."""
    temp_dir = tempfile.mkdtemp()
    
    try:
        mock_info = {"title": "Test Delegation Video", "id": "delegated11"}
        mock_transcript = [{"start": 0.0, "duration": 2.0, "text": "hello"}]
        
        client = MockYouTubeClient(mock_info=mock_info, mock_transcript=mock_transcript)
        config = InMemoryConfigStore()
        
        parser = YouTubeParser(output_dir=temp_dir, youtube_client=client, config_store=config)
        
        # 1. Test video ID extraction
        assert parser.extract_video_id("https://youtube.com/watch?v=delegated11") == "delegated11"
        
        # 2. Test fast video info retrieval
        info = parser.get_video_info_fast("https://youtube.com/watch?v=delegated11")
        assert info["title"] == "Test Delegation Video"
        assert info["id"] == "delegated11"
        
        # 3. Test clips directory delegation
        expected_clips_dir = os.path.join(temp_dir, "clips")
        assert parser.clips_dir == expected_clips_dir
        
        # 4. Test fetch transcript delegation
        transcript = parser.fetch_transcript("delegated11")
        assert len(transcript) == 1
        assert transcript[0]["text"] == "hello"
        
    finally:
        shutil.rmtree(temp_dir)
