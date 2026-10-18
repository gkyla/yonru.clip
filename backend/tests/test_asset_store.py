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

def test_mock_asset_store_purges_and_sources():
    """Verify source fetching and purges on the mock store."""
    store = MockAssetStore()
    
    # Test get_or_create_source mock flow
    source = store.get_or_create_source("https://youtube.com/watch?v=newvid")
    assert source is not None
    assert source["video_id"] == "mock_id"
    
    # Test delete_cached_video mock flow
    assert store.delete_cached_video("mock_folder") == 1
    
    # Assert logs record calls properly
    assert ("delete_cached_video", "mock_folder") in store.calls
