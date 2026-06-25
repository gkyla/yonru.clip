import pytest
import sys
import os

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.asset_repository import AssetStore, MockAssetStore

def test_mock_asset_store_inheritance():
    """Verify that MockAssetStore correctly implements the AssetStore interface."""
    store = MockAssetStore()
    assert isinstance(store, AssetStore)

def test_mock_asset_store_caching_and_lookups():
    """Verify caching, retrieval, and metadata operations on the mock store."""
    mock_video = {
        "video_id": "vid123",
        "folder_name": "Test_Video_vid123",
        "youtube_url": "https://youtube.com/watch?v=vid123",
        "duration": 120.0
    }
    
    store = MockAssetStore(cached_videos=[mock_video])
    
    # Assert get_cached_video finds the source
    cached = store.get_cached_video("https://youtube.com/watch?v=vid123")
    assert cached is not None
    assert cached["video_id"] == "vid123"
    
    # Assert search by folder name
    cached_by_folder = store.get_cached_video_by_folder("Test_Video_vid123")
    assert cached_by_folder is not None
    assert cached_by_folder["duration"] == 120.0

def test_mock_asset_store_purges_and_clips():
    """Verify clip cuts and purges on the mock store."""
    store = MockAssetStore()
    
    # Test get_or_create_source mock flow
    source = store.get_or_create_source("https://youtube.com/watch?v=newvid")
    assert source is not None
    assert source["video_id"] == "mock_id"
    
    # Test create_clip mock flow
    clip = store.create_clip("mock_path/full.mp4", 10.0, 30.0, theme="test")
    assert clip is not None
    assert clip["duration"] == 20.0
    assert clip["theme"] == "test"
    
    # Test delete_clip mock flow
    assert store.delete_clip("mock_folder", "mock_clip") is True
    
    # Assert logs record calls properly
    assert ("create_clip", "mock_path/full.mp4", 10.0, 30.0, "test") in store.calls
