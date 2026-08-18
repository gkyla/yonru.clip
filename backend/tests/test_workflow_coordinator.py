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
    def get_job(self, job_id: str):
        return self.get(job_id)
    def update_job(self, job_id: str, **kwargs):
        if job_id not in self:
            self[job_id] = {}
        self[job_id].update(kwargs)
        return self[job_id]

@pytest.fixture
def mock_dependencies():
    from core.asset_repository import AssetStore
    asset_repo = MagicMock()
    asset_repo.sanitize_and_prepare_hooks = lambda raw_hooks, video_info: AssetStore.sanitize_and_prepare_hooks(asset_repo, raw_hooks, video_info)
    return {
        "job_store": MockJobStore(),
        "asset_repository": asset_repo,
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
    coordinator.run_source_download = MagicMock()
    
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
        "duration": 60.0,
        "folder_name": "video_cached123",
        "hd_ready": True
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
    coordinator.run_source_download = MagicMock()
    
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
        "fps": 30.0,
        "folder_name": "video_new123"
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

def test_run_local_cut_whisper_fails(mock_dependencies, tmp_path):
    """Verify run_local_cut writes a fallback empty transcript and finishes normally if Whisper fails."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    job_id = "test_job_fail"
    video_file = tmp_path / "video.mp4"
    video_file.write_text("dummy")
    
    coordinator.jobs[job_id] = {
        "status": "queued",
        "full_video_path": str(video_file),
        "video_info": {"fps": 30.0},
        "clip": None
    }
    
    clip_dir = tmp_path / "clip_10_30_fail"
    clip_dir.mkdir()
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")
    
    mock_dependencies["asset_repository"].create_clip.return_value = {
        "file_path": str(clip_file),
        "duration": 20.0
    }
    mock_dependencies["asset_repository"].extract_audio_from_local.return_value = "dummy_audio.wav"
    mock_dependencies["speech_transcriber"].transcribe.side_effect = Exception("Whisper failed")
    
    coordinator.run_local_cut(job_id, 10.0, 30.0)
    
    # Assertions
    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_path"] == str(clip_file)
    
    # Verify fallback empty transcript was created
    transcript_path = clip_dir / "transcript.json"
    assert transcript_path.exists()
    with open(transcript_path, "r") as f:
        saved_transcript = json.load(f)
    assert saved_transcript == []


def test_run_full_analysis_uses_cached_youtube_transcript(mock_dependencies, tmp_path):
    """Verify that run_full_analysis loads cached youtube-transcript.json and bypasses YouTube client fetch."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    coordinator.run_source_download = MagicMock()
    
    job_id = "test_job_transcript_cache"
    coordinator.jobs[job_id] = {
        "status": "queued",
        "url": "https://youtube.com/watch?v=cachedtrans123",
        "video_info": None,
        "full_video_path": None,
        "hooks": None,
        "error": None
    }
    
    # Create mock folder and cached files
    video_dir = tmp_path / "video_cachedtrans123"
    video_dir.mkdir()
    video_file = video_dir / "full.mp4"
    video_file.write_text("dummy video")
    
    # Save a cached youtube-transcript.json
    transcript_cache_file = video_dir / "youtube-transcript.json"
    transcript_cache_file.write_text(json.dumps([
        {"text": "Cached transcript hello", "start": 0.0, "duration": 3.0}
    ]))
    
    # Setup mock asset repository to return this cached video
    mock_dependencies["asset_repository"].get_cached_video.return_value = {
        "file_path": str(video_file),
        "duration": 60.0,
        "fps": 30.0,
        "folder_name": "video_cachedtrans123"
    }
    mock_dependencies["asset_repository"].get_or_create_source.return_value = {
        "file_path": str(video_file),
        "duration": 60.0,
        "fps": 30.0,
        "folder_name": "video_cachedtrans123"
    }
    
    mock_dependencies["youtube_client"].extract_video_id.return_value = "cachedtrans123"
    mock_dependencies["config_store"].get.return_value = "fake-gemini-key"
    
    # Mock HookGenerator
    mock_hooks_response = json.dumps([
        {"start": 0.0, "end": 3.0, "title": "Hook from cache"}
    ])
    
    with patch("core.hook_generator.HookGenerator") as MockHookGenerator:
        mock_generator_instance = MockHookGenerator.return_value
        mock_generator_instance.find_hooks_from_transcript.return_value = mock_hooks_response
        
        # Run analysis (force_reanalyze=True to bypass step -1, but it should still hit Step 0 transcript cache)
        coordinator.run_full_analysis(job_id, "https://youtube.com/watch?v=cachedtrans123", "id", force_reanalyze=True)
        
        # Verify HookGenerator was called with the cached transcript segment
        called_args = mock_generator_instance.find_hooks_from_transcript.call_args[1]
        assert called_args["transcript_segments"] == [
            {"text": "Cached transcript hello", "start": 0.0, "duration": 3.0}
        ]
        
    # Assertions
    assert coordinator.jobs[job_id]["status"] == "hooks_ready"
    hooks = coordinator.jobs[job_id]["hooks"]
    assert len(hooks) == 1
    
    # Verify youtube_client.fetch_transcript was NOT called
    mock_dependencies["youtube_client"].fetch_transcript.assert_not_called()


def test_provision_clip_cached_ready(mock_dependencies, tmp_path):
    """Verify provision_clip returns status 'ready' immediately if clip and transcript exist on disk."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    # Setup mock asset repository clips_dir and output_dir
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    coordinator.asset_repository.clips_dir = str(clips_dir)
    coordinator.asset_repository.output_dir = str(tmp_path)
    
    # Create fake default files in output_dir
    (tmp_path / "default_style_settings.json").write_text(json.dumps({"fontSize": 48}))
    (tmp_path / "default_thumbnail_style.json").write_text(json.dumps({"thumbnailDuration": 2.0}))
    
    # Setup job
    job_id = "job_cached_ready"
    video_path = tmp_path / "sources" / "vid1" / "video.mp4"
    video_path.parent.mkdir(parents=True)
    video_path.write_text("dummy video")
    
    coordinator.jobs[job_id] = {
        "status": "pending",
        "video_info": {
            "file_path": str(video_path),
            "fps": 30.0,
            "duration": 60.0
        }
    }
    
    # Setup clip directory on disk with valid transcript
    clip_dir = clips_dir / "vid1" / "10_25_test_theme"
    clip_dir.mkdir(parents=True)
    (clip_dir / "video.mp4").write_text("dummy clip")
    (clip_dir / "transcript.json").write_text(json.dumps([{"text": "hello", "start": 0.0, "duration": 1.0}]))
    
    # Mock face tracker on coordinator to avoid mediapipe overhead
    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]
    coordinator.face_tracker = mock_tracker
    
    # Provision clip
    res = coordinator.provision_clip(
        job_id=job_id,
        start_time=10.0,
        end_time=25.0,
        theme="test theme",
        whisper_model="base"
    )
    
    # Verify return value and job state
    assert res["status"] == "ready"
    assert res["job_id"] == job_id
    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_path"] == str(clip_dir / "video.mp4")
    assert coordinator.jobs[job_id]["clip_duration"] == 15.0
    assert coordinator.jobs[job_id]["clip_start"] == 10.0
    
    # Verify default files and crop_map were seeded
    assert (clip_dir / "style_settings.json").exists()
    assert (clip_dir / "thumbnail_config.json").exists()
    assert (clip_dir / "crop_map.json").exists()


def test_provision_clip_new_cut_enqueues_background_task(mock_dependencies, tmp_path):
    """Verify provision_clip sets status to 'cutting' and enqueues background cut when clip does not exist."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    coordinator.asset_repository.clips_dir = str(clips_dir)
    coordinator.asset_repository.output_dir = str(tmp_path)
    
    job_id = "job_new_cut"
    video_path = tmp_path / "sources" / "vid2" / "video.mp4"
    video_path.parent.mkdir(parents=True)
    video_path.write_text("dummy video")
    
    coordinator.jobs[job_id] = {
        "status": "pending",
        "video_info": {
            "file_path": str(video_path),
            "fps": 30.0,
            "duration": 60.0
        }
    }
    
    mock_bg_tasks = MagicMock()
    
    res = coordinator.provision_clip(
        job_id=job_id,
        start_time=5.0,
        end_time=20.0,
        theme="fresh clip",
        whisper_model="base",
        background_tasks=mock_bg_tasks
    )
    
    assert res["status"] == "cutting"
    assert res["job_id"] == job_id
    assert coordinator.jobs[job_id]["status"] == "cutting"
    mock_bg_tasks.add_task.assert_called_once_with(
        coordinator.run_local_cut,
        job_id,
        5.0,
        20.0,
        "fresh clip",
        "base"
    )


def test_provision_clip_corrupt_transcript_cleans_and_schedules(mock_dependencies, tmp_path):
    """Verify provision_clip deletes corrupt transcript.json and triggers background cut."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    coordinator.asset_repository.clips_dir = str(clips_dir)
    coordinator.asset_repository.output_dir = str(tmp_path)
    
    job_id = "job_corrupt"
    video_path = tmp_path / "sources" / "vid3" / "video.mp4"
    video_path.parent.mkdir(parents=True)
    video_path.write_text("dummy video")
    
    coordinator.jobs[job_id] = {
        "status": "pending",
        "video_info": {
            "file_path": str(video_path),
            "fps": 30.0,
            "duration": 60.0
        }
    }
    
    # Clip exists but transcript is invalid JSON
    clip_dir = clips_dir / "vid3" / "0_10"
    clip_dir.mkdir(parents=True)
    (clip_dir / "video.mp4").write_text("dummy clip")
    transcript_file = clip_dir / "transcript.json"
    transcript_file.write_text("NOT_JSON{{{")
    
    mock_bg_tasks = MagicMock()
    
    res = coordinator.provision_clip(
        job_id=job_id,
        start_time=0.0,
        end_time=10.0,
        whisper_model="base",
        background_tasks=mock_bg_tasks
    )
    
    assert res["status"] == "cutting"
    assert not transcript_file.exists()
    mock_bg_tasks.add_task.assert_called_once()


def test_load_ready_clip_success(mock_dependencies, tmp_path):
    """Verify load_ready_clip loads existing clip, seeds defaults and crop map, and returns complete payload."""
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    sources_dir = tmp_path / "sources"
    sources_dir.mkdir()
    coordinator.asset_repository.clips_dir = str(clips_dir)
    coordinator.asset_repository.source_dir = str(sources_dir)
    coordinator.asset_repository.output_dir = str(tmp_path)
    
    # Mock video info
    mock_dependencies["asset_repository"].get_cached_video_by_folder.return_value = {
        "folder_name": "vid_folder_1",
        "video_id": "yt_123",
        "file_path": str(tmp_path / "full.mp4"),
        "fps": 30.0,
        "duration": 120.0
    }
    mock_dependencies["asset_repository"].get_video_duration.return_value = 15.0
    
    # Create clip on disk
    clip_dir = clips_dir / "vid_folder_1" / "10_25_awesome_clip"
    clip_dir.mkdir(parents=True)
    (clip_dir / "video.mp4").write_text("dummy video")
    (clip_dir / "transcript.json").write_text(json.dumps([{"text": "Sample clip text", "start": 0.0, "duration": 2.0}]))
    
    # Create source hooks
    source_folder = sources_dir / "vid_folder_1"
    source_folder.mkdir(parents=True)
    (source_folder / "hooks.json").write_text(json.dumps([{"start": 10.0, "end": 25.0, "title": "Hook 1"}]))
    
    # Mock face tracker
    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]
    coordinator.face_tracker = mock_tracker
    
    res = coordinator.load_ready_clip("vid_folder_1", "10_25_awesome_clip", whisper_model="base")
    
    assert res["status"] == "ready"
    assert "job_id" in res
    assert res["job"]["clip"]["transcript_quote"] == "Sample clip text"
    assert res["job"]["clip"]["theme"] == "awesome clip"
    assert len(res["job"]["hooks"]) == 1
    assert (clip_dir / "crop_map.json").exists()


def test_replay_cached_analysis_instant_ready(mock_dependencies, tmp_path):
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    source_dir = tmp_path / "sources" / "vid_123"
    source_dir.mkdir(parents=True)
    video_path = source_dir / "full.mp4"
    video_path.write_text("dummy video")
    hooks_path = source_dir / "hooks.json"
    hooks_path.write_text(json.dumps([{"start": 5.0, "end": 20.0, "title": "Hook 1"}]))
    
    mock_dependencies["asset_repository"].get_cached_video.return_value = {
        "video_id": "vid_123",
        "title": "Cached Video Title",
        "duration": 60.0,
        "file_path": str(video_path),
        "folder_name": "vid_123",
        "hd_ready": True,
        "fps": 30.0,
        "asset_url": "/assets/sources/vid_123/full.mp4"
    }
    
    res = coordinator.replay_cached_analysis(video_id="vid_123", force=False)
    assert res["status"] == "ready"
    assert res["cached"] is True
    assert len(res["hooks"]) == 1
    assert res["video"]["title"] == "Cached Video Title"
    assert res["job_id"] in coordinator.jobs
    assert coordinator.jobs[res["job_id"]]["status"] == "ready"


def test_replay_cached_analysis_prefetch_hd(mock_dependencies, tmp_path):
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    coordinator.run_source_download = MagicMock()
    
    source_dir = tmp_path / "sources" / "vid_456"
    source_dir.mkdir(parents=True)
    video_path = source_dir / "preview.mp4"
    video_path.write_text("dummy preview")
    hooks_path = source_dir / "hooks.json"
    hooks_path.write_text(json.dumps([{"start": 10.0, "end": 25.0, "title": "Preview Hook"}]))
    
    mock_dependencies["asset_repository"].get_cached_video.return_value = {
        "video_id": "vid_456",
        "title": "Preview Video",
        "duration": 60.0,
        "file_path": str(video_path),
        "folder_name": "vid_456",
        "hd_ready": False,
        "fps": 30.0,
        "asset_url": "/assets/sources/vid_456/preview.mp4"
    }
    
    background_tasks = MagicMock()
    res = coordinator.replay_cached_analysis(video_id="vid_456", background_tasks=background_tasks, force=False)
    assert res["status"] == "hooks_ready"
    assert res["cached"] is True
    assert background_tasks.add_task.called
    assert coordinator.jobs[res["job_id"]]["status"] == "hooks_ready"


def test_replay_cached_analysis_not_found_raises(mock_dependencies):
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    mock_dependencies["asset_repository"].get_cached_video.return_value = None
    
    with pytest.raises(FileNotFoundError, match="Cached video for ID missing_id not found"):
        coordinator.replay_cached_analysis(video_id="missing_id")


def test_get_job_summary_hydration(mock_dependencies, tmp_path):
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    clip_dir = tmp_path / "clips" / "folder_abc" / "clip_xyz"
    clip_dir.mkdir(parents=True)
    clip_video = clip_dir / "video.mp4"
    clip_video.write_text("clip content")
    transcript_file = clip_dir / "transcript.json"
    transcript_file.write_text(json.dumps([{"start": 0.0, "duration": 1.5, "text": "Hydrated word"}]))
    history_file = clip_dir / "history.json"
    history_file.write_text(json.dumps({"undo_stack": [{"step": 1}], "redo_stack": []}))
    
    job_id = "summary_job_1"
    coordinator.jobs[job_id] = {
        "status": "ready",
        "clip_path": str(clip_video),
        "clip_duration": 15.0,
        "clip": {
            "asset_url": "/assets/clips/folder_abc/clip_xyz/video.mp4",
            "duration": 15.0,
            "start": 0.0,
            "end": 15.0,
            "theme": "Test Theme"
        },
        "hooks": [{"title": "Hook A"}]
    }
    
    summary = coordinator.get_job_summary(job_id)
    assert summary["job_id"] == job_id
    assert summary["status"] == "ready"
    assert summary["folder_name"] == "folder_abc"
    assert summary["clip"]["transcript"] == [{"start": 0.0, "duration": 1.5, "text": "Hydrated word"}]
    assert summary["history"] == {"undo_stack": [{"step": 1}], "redo_stack": []}
    assert summary["hooks"] == [{"title": "Hook A"}]


def test_extract_clip_thumbnail_bounds_clamping(mock_dependencies, tmp_path):
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    clip_dir = tmp_path / "clips" / "my_folder" / "clip_1"
    clip_dir.mkdir(parents=True)
    clip_path = clip_dir / "video.mp4"
    clip_path.write_text("dummy")
    
    job_id = "thumb_job"
    coordinator.jobs[job_id] = {
        "status": "ready",
        "clip_path": str(clip_path),
        "clip_duration": 10.0
    }
    
    mock_dependencies["asset_repository"].extract_clip_screenshot.return_value = True
    
    # Request timestamp 25.0 beyond duration 10.0 -> clamped to 9.9
    res = coordinator.extract_clip_thumbnail(job_id, timestamp=25.0)
    assert res["status"] == "ok"
    assert res["timestamp"] == 9.9
    assert "thumbnail.jpg" in res["thumbnail_url"]
    
    # Verify mock was called with clamped timestamp
    mock_dependencies["asset_repository"].extract_clip_screenshot.assert_called_with(
        str(clip_path), 9.9, str(clip_dir / "thumbnail.jpg")
    )


def test_get_or_create_crop_map_workflow(mock_dependencies, tmp_path):
    clips_dir = tmp_path / "clips"
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    
    clip_dir = clips_dir / "folder_test" / "clip_test"
    clip_dir.mkdir(parents=True)
    video_path = clip_dir / "video.mp4"
    video_path.write_text("video dummy")
    
    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [
        {"time": 0.0, "x": 500},
        {"time": 1.0, "x": 650}
    ]
    
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker
    )
    
    # 1. First run computes and writes crop_map.json
    res1 = coordinator.get_or_create_crop_map("folder_test", "clip_test")
    assert res1["status"] == "ready"
    assert len(res1["crop_map"]) == 2
    assert res1["crop_map"][0]["x"] == 500
    assert (clip_dir / "crop_map.json").exists()
    assert mock_tracker.analyze_video.call_count == 1
    
    # 2. Second run reads from crop_map.json without re-running tracker
    res2 = coordinator.get_or_create_crop_map("folder_test", "clip_test")
    assert res2["status"] == "ready"
    assert len(res2["crop_map"]) == 2
    assert mock_tracker.analyze_video.call_count == 1


def test_get_or_create_crop_map_path_traversal(mock_dependencies, tmp_path):
    clips_dir = tmp_path / "clips"
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    
    with pytest.raises(ValueError, match="Path traversal detected"):
        coordinator.get_or_create_crop_map("../../etc", "passwd")





