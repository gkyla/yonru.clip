import pytest
import sys
import os
import json
from unittest.mock import MagicMock, patch

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.workflow_coordinator import ClipWorkflowCoordinator

class MockJobStore(dict):
    def save(self):
        pass

@pytest.fixture
def mock_dependencies():
    return {
        "job_store": MockJobStore(),
        "asset_repository": MagicMock(),
        "youtube_client": MagicMock(),
        "speech_transcriber": MagicMock(),
        "prompt_repository": MagicMock(),
        "config_store": MagicMock()
    }

def test_run_full_analysis_cache_hit(mock_dependencies, tmp_path):
    """Verify run_full_analysis skips network calls and reads cached video and hooks if available."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    # Setup mock job
    job_id = "test_job"
    coordinator.jobs[job_id] = {
        "status": "queued",
        "url": "https://youtube.com/watch?v=cached123",
        "video_info": None,
        "full_video_path": None,
        "hooks": None,
        "error": None
    }
    
    # Create temp files for mock cache
    video_file = tmp_path / "video.mp4"
    video_file.write_text("dummy video")
    hooks_file = tmp_path / "hooks.json"
    hooks_file.write_text(json.dumps([
        {"start": 10.0, "end": 30.0, "duration": 20.0, "title": "Hook 1"}
    ]))
    
    mock_dependencies["asset_repository"].get_cached_video.return_value = {
        "file_path": str(video_file),
        "fps": 30.0,
        "duration": 60.0
    }
    
    coordinator.run_full_analysis(job_id, "https://youtube.com/watch?v=cached123", "id", force_reanalyze=False)
    
    # Assertions
    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["full_video_path"] == str(video_file)
    hooks = coordinator.jobs[job_id]["hooks"]
    assert hooks is not None
    assert len(hooks) == 1
    assert hooks[0]["start"] == 10.0
    assert hooks[0]["end"] == 30.0
    
    # Ensure no network calls were made
    mock_dependencies["youtube_client"].extract_video_id.assert_not_called()
    mock_dependencies["asset_repository"].get_or_create_source.assert_not_called()

def test_run_full_analysis_success_flow(mock_dependencies, tmp_path):
    """Verify successful run_full_analysis flow with transcript checking, download, and hook generation."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    job_id = "test_job"
    coordinator.jobs[job_id] = {
        "status": "queued",
        "url": "https://youtube.com/watch?v=new123",
        "video_info": None,
        "full_video_path": None,
        "hooks": None,
        "error": None
    }
    
    mock_dependencies["youtube_client"].extract_video_id.return_value = "new123"
    mock_dependencies["youtube_client"].fetch_transcript.return_value = [
        {"text": "Hello world", "start": 0.0, "duration": 2.0}
    ]
    
    video_file = tmp_path / "video.mp4"
    video_file.write_text("dummy video")
    mock_dependencies["asset_repository"].get_cached_video.return_value = None
    mock_dependencies["asset_repository"].get_or_create_source.return_value = {
        "file_path": str(video_file),
        "duration": 120.0,
        "fps": 30.0
    }
    
    mock_dependencies["config_store"].get.return_value = "fake-gemini-key"
    
    mock_hooks_response = json.dumps([
        {"start": 5.0, "end": 25.0, "title": "Mock Hook"}
    ])
    
    with patch("core.hook_generator.HookGenerator") as MockHookGenerator:
        mock_generator_instance = MockHookGenerator.return_value
        mock_generator_instance.find_hooks_from_transcript.return_value = mock_hooks_response
        
        coordinator.run_full_analysis(job_id, "https://youtube.com/watch?v=new123", "id", force_reanalyze=False)
    
    # Assertions
    assert coordinator.jobs[job_id]["status"] == "hooks_ready"
    assert coordinator.jobs[job_id]["full_video_path"] == str(video_file)
    hooks = coordinator.jobs[job_id]["hooks"]
    assert hooks is not None
    assert len(hooks) == 1
    assert hooks[0]["start"] == 5.0
    assert hooks[0]["end"] == 25.0
    assert hooks[0]["duration"] == 20.0

def test_run_full_analysis_no_transcript(mock_dependencies):
    """Verify run_full_analysis fails gracefully when no transcript is found."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    job_id = "test_job"
    coordinator.jobs[job_id] = {
        "status": "queued",
        "url": "https://youtube.com/watch?v=new123",
        "error": None
    }
    
    mock_dependencies["youtube_client"].extract_video_id.return_value = "new123"
    mock_dependencies["youtube_client"].fetch_transcript.return_value = None # No transcript
    mock_dependencies["asset_repository"].get_cached_video.return_value = None
    
    coordinator.run_full_analysis(job_id, "https://youtube.com/watch?v=new123", "id")
    
    assert coordinator.jobs[job_id]["status"] == "error"
    error_msg = coordinator.jobs[job_id]["error"]
    assert error_msg is not None
    assert "No transcript found" in error_msg

def test_run_local_cut_success_flow(mock_dependencies, tmp_path):
    """Verify run_local_cut successfully cuts and transcribes the clip, and saves it."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    job_id = "test_job"
    video_file = tmp_path / "video.mp4"
    video_file.write_text("dummy")
    
    coordinator.jobs[job_id] = {
        "status": "queued",
        "full_video_path": str(video_file),
        "video_info": {"fps": 30.0},
        "clip": None
    }
    
    clip_dir = tmp_path / "clip_10_30"
    clip_dir.mkdir()
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")
    
    mock_dependencies["asset_repository"].create_clip.return_value = {
        "file_path": str(clip_file),
        "duration": 20.0
    }
    mock_dependencies["asset_repository"].extract_audio_from_local.return_value = "dummy_audio.wav"
    mock_dependencies["speech_transcriber"].transcribe.return_value = [
        {"start": 0.5, "duration": 1.0, "text": "Hello"}
    ]
    
    # Backup existing default style settings and thumbnail styles
    style_settings_backup = None
    if os.path.exists("temp_assets/default_style_settings.json"):
        try:
            with open("temp_assets/default_style_settings.json", "r", encoding="utf-8") as f:
                style_settings_backup = f.read()
        except Exception:
            pass

    thumbnail_style_backup = None
    if os.path.exists("temp_assets/default_thumbnail_style.json"):
        try:
            with open("temp_assets/default_thumbnail_style.json", "r", encoding="utf-8") as f:
                thumbnail_style_backup = f.read()
        except Exception:
            pass

    # Mock default style settings file and default thumbnail style
    os.makedirs("temp_assets", exist_ok=True)
    with open("temp_assets/default_style_settings.json", "w", encoding="utf-8") as f:
        json.dump({"font": "Arial"}, f)
    with open("temp_assets/default_thumbnail_style.json", "w", encoding="utf-8") as f:
        json.dump({"thumbnailDuration": 2.5, "fontSize": 80}, f)
        
    try:
        coordinator.run_local_cut(job_id, 10.0, 30.0)
        
        # Assertions
        assert coordinator.jobs[job_id]["status"] == "ready"
        assert coordinator.jobs[job_id]["clip_path"] == str(clip_file)
        assert coordinator.jobs[job_id]["clip_duration"] == 20.0
        clip = coordinator.jobs[job_id]["clip"]
        assert clip is not None
        assert clip["transcript_quote"] == "Hello"
        
        # Verify transcription file created
        transcript_path = clip_dir / "transcript.json"
        assert transcript_path.exists()
        with open(transcript_path, "r") as f:
            saved_transcript = json.load(f)
        assert len(saved_transcript) == 1
        assert saved_transcript[0]["text"] == "Hello"
        
        # Verify style settings file copied
        style_settings_path = clip_dir / "style_settings.json"
        assert style_settings_path.exists()

        # Verify default thumbnail config populated
        thumbnail_config_path = clip_dir / "thumbnail_config.json"
        assert thumbnail_config_path.exists()
        with open(thumbnail_config_path, "r") as f:
            thumb_config = json.load(f)
        assert thumb_config["duration"] == 2.5
        assert thumb_config["enabled"] is False
    finally:
        # Restore backups or clean up
        if style_settings_backup is not None:
            with open("temp_assets/default_style_settings.json", "w", encoding="utf-8") as f:
                f.write(style_settings_backup)
        elif os.path.exists("temp_assets/default_style_settings.json"):
            os.remove("temp_assets/default_style_settings.json")

        if thumbnail_style_backup is not None:
            with open("temp_assets/default_thumbnail_style.json", "w", encoding="utf-8") as f:
                f.write(thumbnail_style_backup)
        elif os.path.exists("temp_assets/default_thumbnail_style.json"):
            os.remove("temp_assets/default_thumbnail_style.json")

def test_run_local_cut_reuse_transcript(mock_dependencies, tmp_path):
    """Verify run_local_cut reuses the existing transcript and style if present."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    job_id = "test_job"
    video_file = tmp_path / "video.mp4"
    video_file.write_text("dummy")
    
    coordinator.jobs[job_id] = {
        "status": "queued",
        "full_video_path": str(video_file),
        "video_info": {"fps": 30.0},
        "clip": None
    }
    
    clip_dir = tmp_path / "clip_10_30_reuse"
    clip_dir.mkdir()
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")
    
    transcript_file = clip_dir / "transcript.json"
    transcript_file.write_text(json.dumps([
        {"start": 0.5, "duration": 1.0, "text": "Reused"}
    ]))
    
    mock_dependencies["asset_repository"].create_clip.return_value = {
        "file_path": str(clip_file),
        "duration": 20.0
    }
    
    coordinator.run_local_cut(job_id, 10.0, 30.0)
    
    # Assertions
    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_path"] == str(clip_file)
    
    # Ensure speech transcriber was NOT called
    mock_dependencies["speech_transcriber"].transcribe.assert_not_called()
