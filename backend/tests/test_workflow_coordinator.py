import pytest
import sys
import os
import json
from unittest.mock import MagicMock, patch

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.workflow_coordinator import ClipWorkflowCoordinator
from core.clip_session_store import ClipSessionStore
from core.job_store import InMemoryJobStore


@pytest.fixture
def mock_dependencies():
    from core.asset_repository import AssetStore
    asset_repo = MagicMock()
    asset_repo.sanitize_and_prepare_hooks = lambda raw_hooks, video_info: AssetStore.sanitize_and_prepare_hooks(asset_repo, raw_hooks, video_info)
    return {
        "job_store": InMemoryJobStore(),
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
    
    mock_hooks_response = [
        {"start": 5.0, "end": 25.0, "title": "Mock Hook"}
    ]
    
    with patch.object(coordinator.hook_discovery_engine, "discover_from_transcript", return_value=mock_hooks_response):
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
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
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

    clip_dir = clips_dir / "src_folder" / "clip_10_30"
    clip_dir.mkdir(parents=True)
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")

    mock_dependencies["speech_transcriber"].transcribe.return_value = [
        {"start": 0.5, "duration": 1.0, "text": "Hello"}
    ]

    (tmp_path / "default_style_settings.json").write_text(json.dumps({"font": "Arial"}), encoding="utf-8")
    (tmp_path / "default_thumbnail_style.json").write_text(json.dumps({"thumbnailDuration": 2.5, "fontSize": 80}), encoding="utf-8")

    with patch.object(ClipSessionStore, "create_clip", return_value={"file_path": str(clip_file), "duration": 20.0}), \
         patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
        coordinator.run_local_cut(job_id, 10.0, 30.0)

    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_path"] == str(clip_file)
    assert coordinator.jobs[job_id]["clip_duration"] == 20.0
    clip = coordinator.jobs[job_id]["clip"]
    assert clip is not None
    assert clip["transcript_quote"] == "Hello"

    with open(clip_dir / "transcript.json", "r") as f:
        saved_transcript = json.load(f)
    assert len(saved_transcript) == 1
    assert saved_transcript[0]["text"] == "Hello"

    assert (clip_dir / "style_settings.json").exists()
    with open(clip_dir / "cover_config.json", "r") as f:
        cover_config = json.load(f)
    assert cover_config["duration"] == 2.5
    assert cover_config["enabled"] is False
    assert not (clip_dir / "thumbnail_config.json").exists()


def test_run_local_cut_reuse_transcript(mock_dependencies, tmp_path):
    """Verify run_local_cut reuses the existing transcript and style if present."""
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
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

    clip_dir = clips_dir / "src_folder" / "clip_10_30_reuse"
    clip_dir.mkdir(parents=True)
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")

    transcript_file = clip_dir / "transcript.json"
    transcript_file.write_text(json.dumps([
        {"start": 0.5, "duration": 1.0, "text": "Reused"}
    ]))

    with patch.object(ClipSessionStore, "create_clip", return_value={"file_path": str(clip_file), "duration": 20.0}):
        coordinator.run_local_cut(job_id, 10.0, 30.0)

    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_path"] == str(clip_file)
    mock_dependencies["speech_transcriber"].transcribe.assert_not_called()


def test_run_local_cut_whisper_fails(mock_dependencies, tmp_path):
    """Verify run_local_cut writes a fallback empty transcript and finishes normally if Whisper fails."""
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
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

    clip_dir = clips_dir / "src_folder" / "clip_10_30_fail"
    clip_dir.mkdir(parents=True)
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")

    mock_dependencies["speech_transcriber"].transcribe.side_effect = Exception("Whisper failed")

    with patch.object(ClipSessionStore, "create_clip", return_value={"file_path": str(clip_file), "duration": 20.0}), \
         patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
        coordinator.run_local_cut(job_id, 10.0, 30.0)

    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_path"] == str(clip_file)

    transcript_path = clip_dir / "transcript.json"
    assert transcript_path.exists()
    with open(transcript_path, "r") as f:
        saved_transcript = json.load(f)
    assert saved_transcript == []


def test_run_local_cut_whisper_fails_fallback_to_global_transcript(mock_dependencies, tmp_path):
    """Verify run_local_cut recovers and slices cached youtube-transcript.json when Whisper fails."""
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
    )
    
    job_id = "test_job_fail_with_global"
    video_dir = tmp_path / "video_source"
    video_dir.mkdir()
    video_file = video_dir / "full.mp4"
    video_file.write_text("dummy")
    
    # Save a cached global youtube-transcript.json
    global_transcript = [
        {"start": 5.0, "duration": 2.0, "text": "Before clip"},
        {"start": 12.0, "duration": 3.0, "text": "Inside segment one"},
        {"start": 20.0, "duration": 4.0, "text": "Inside segment two"},
        {"start": 35.0, "duration": 2.0, "text": "After clip"}
    ]
    (video_dir / "youtube-transcript.json").write_text(json.dumps(global_transcript))
    
    coordinator.jobs[job_id] = {
        "status": "queued",
        "full_video_path": str(video_file),
        "video_info": {"fps": 30.0},
        "clip": None
    }
    
    clip_dir = clips_dir / "src_folder" / "clip_10_30_recovered"
    clip_dir.mkdir(parents=True)
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")
    
    mock_dependencies["speech_transcriber"].transcribe.side_effect = Exception("Whisper failed")
    
    with patch.object(ClipSessionStore, "create_clip", return_value={"file_path": str(clip_file), "duration": 20.0}), \
         patch.object(ClipSessionStore, "extract_clip_audio", return_value="dummy_audio.wav"):
        coordinator.run_local_cut(job_id, 10.0, 30.0)
    
    assert coordinator.jobs[job_id]["status"] == "ready"
    transcript_path = clip_dir / "transcript.json"
    assert transcript_path.exists()
    with open(transcript_path, "r") as f:
        saved_transcript = json.load(f)
        
    assert len(saved_transcript) == 2
    assert saved_transcript[0]["text"] == "Inside segment one"
    assert saved_transcript[0]["start"] == 2.0  # 12.0 - 10.0
    assert saved_transcript[1]["text"] == "Inside segment two"
    assert saved_transcript[1]["start"] == 10.0  # 20.0 - 10.0



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
    
    # Mock HookDiscoveryEngine
    mock_hooks_response = [
        {"start": 0.0, "end": 3.0, "title": "Hook from cache"}
    ]
    
    with patch.object(coordinator.hook_discovery_engine, "discover_from_transcript", return_value=mock_hooks_response) as mock_discover:
        # Run analysis (force_reanalyze=True to bypass step -1, but it should still hit Step 0 transcript cache)
        coordinator.run_full_analysis(job_id, "https://youtube.com/watch?v=cachedtrans123", "id", force_reanalyze=True)
        
        # Verify hook_discovery_engine was called with the cached transcript segment
        called_segments = mock_discover.call_args[0][0] if mock_discover.call_args[0] else mock_discover.call_args[1].get("transcript_segments")
        assert called_segments == [
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
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
    )

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
    assert (clip_dir / "cover_config.json").exists()
    assert not (clip_dir / "thumbnail_config.json").exists()
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
    """Verify load_ready_clip loads existing clip via single get_clip_session call and returns unified payload."""
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    sources_dir = tmp_path / "sources"
    sources_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].source_dir = str(sources_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)
    mock_dependencies["asset_repository"].get_saved_hooks.return_value = [{"id": "sh1", "theme": "Saved"}]

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
    )

    mock_dependencies["asset_repository"].get_cached_video_by_folder.return_value = {
        "folder_name": "vid_folder_1",
        "video_id": "yt_123",
        "file_path": str(tmp_path / "full.mp4"),
        "fps": 30.0,
        "duration": 120.0
    }
    mock_dependencies["asset_repository"].transcoder.probe_video.return_value = MagicMock(duration=15.0)

    clip_dir = clips_dir / "vid_folder_1" / "10_25_awesome_clip"
    clip_dir.mkdir(parents=True)
    (clip_dir / "video.mp4").write_text("dummy video")
    (clip_dir / "transcript.json").write_text(json.dumps([{"text": "Sample clip text", "start": 0.0, "duration": 2.0}]))

    source_folder = sources_dir / "vid_folder_1"
    source_folder.mkdir(parents=True)
    (source_folder / "hooks.json").write_text(json.dumps([{"start": 10.0, "end": 25.0, "title": "Hook 1"}]))

    res = coordinator.load_ready_clip("vid_folder_1", "10_25_awesome_clip", whisper_model="base")

    assert res["status"] == "ready"
    assert "job_id" in res
    assert res["job"]["clip"]["transcript_quote"] == "Sample clip text"
    assert res["job"]["clip"]["theme"] == "awesome clip"
    assert len(res["job"]["hooks"]) == 1
    assert res["saved_hooks"] == [{"id": "sh1", "theme": "Saved"}]
    assert res["session"]["folder_name"] == "vid_folder_1"
    assert res["session"]["clip_id"] == "10_25_awesome_clip"
    assert res["session"]["crop_map"] == [{"time": 0.0, "x": 960}]
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
    """get_job_summary returns a lightweight JobStore poll projection without reading or healing ClipSessionStore."""
    clips_dir = tmp_path / "clips"
    clips_dir.mkdir()
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )

    clip_dir = clips_dir / "folder_abc" / "clip_xyz"
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
            "theme": "Test Theme",
            "transcript_quote": "Hydrated word",
        },
        "hooks": [{"title": "Hook A"}]
    }

    with patch.object(
        coordinator.clip_session_store,
        "get_clip_session",
        wraps=coordinator.clip_session_store.get_clip_session,
    ) as mock_get_session:
        summary = coordinator.get_job_summary(job_id)

    assert summary["job_id"] == job_id
    assert summary["status"] == "ready"
    assert summary["folder_name"] == "folder_abc"
    assert summary["clip"] == {
        "asset_url": "/assets/clips/folder_abc/clip_xyz/video.mp4",
        "duration": 15.0,
        "start": 0.0,
        "end": 15.0,
        "theme": "Test Theme",
        "transcript_quote": "Hydrated word",
    }
    assert "transcript" not in summary["clip"]
    assert "history" not in summary
    assert summary["hooks"] == [{"title": "Hook A"}]
    mock_get_session.assert_not_called()
    assert not (clip_dir / "style_settings.json").exists()
    assert not (clip_dir / "cover_config.json").exists()


def test_extract_clip_thumbnail_bounds_clamping(mock_dependencies, tmp_path):
    mock_clip_store = MagicMock()
    mock_clip_store.extract_cover_frame.return_value = {
        "status": "ok",
        "timestamp": 9.9,
        "cover_url": "/assets/clips/my_folder/clip_1/cover.jpg",
        "thumbnail_url": "/assets/clips/my_folder/clip_1/cover.jpg"
    }
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        clip_session_store=mock_clip_store,
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
    
    # Request timestamp 25.0
    res = coordinator.extract_clip_cover(job_id, timestamp=25.0)
    assert res["status"] == "ok"
    assert res["timestamp"] == 9.9
    assert "cover.jpg" in res["cover_url"]
    
    # Verify coordinator delegates directly to clip_session_store without callback leaks
    mock_clip_store.extract_cover_frame.assert_called_once_with(
        "my_folder", "clip_1", timestamp=25.0
    )


def test_coordinator_injects_transcoder_into_session_store(mock_dependencies, tmp_path):
    """Verify ClipWorkflowCoordinator injects asset_repository.transcoder into ClipSessionStore."""
    mock_transcoder = MagicMock()
    mock_dependencies["asset_repository"].transcoder = mock_transcoder
    mock_dependencies["asset_repository"].clips_dir = str(tmp_path / "clips")
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
    )

    store = coordinator.clip_session_store
    assert store.transcoder is mock_transcoder


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


def test_load_ready_clip_calls_get_clip_session_once(mock_dependencies, tmp_path):
    """Verify load_ready_clip hydrates via single clip_session_store.get_clip_session call."""
    output_dir = tmp_path / "custom_output"
    clips_dir = output_dir / "clips"
    clip_dir = clips_dir / "video1" / "0_10"
    clip_dir.mkdir(parents=True)
    (clip_dir / "video.mp4").write_text("dummy")

    mock_dependencies["asset_repository"].output_dir = str(output_dir)
    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].get_cached_video_by_folder.return_value = {
        "folder_name": "video1",
        "video_id": "yt1",
        "file_path": str(tmp_path / "full.mp4"),
        "fps": 30.0,
    }
    mock_dependencies["asset_repository"].get_saved_hooks.return_value = []

    mock_store = MagicMock()
    mock_store.resolve_clip_dir.return_value = str(clip_dir)
    mock_store.get_clip_session.return_value = {
        "folder_name": "video1",
        "clip_id": "0_10",
        "transcript": [],
        "style_settings": {"videoLayout": "vertical"},
        "timeline": [],
        "history": {"undo_stack": [], "redo_stack": []},
        "cover_config": {"enabled": False},
        "crop_map": [{"time": 0.0, "x": 960}],
        "asset_url": "/assets/clips/video1/0_10/video.mp4",
        "thumbnail_url": "/assets/clips/video1/0_10/thumbnail.jpg",
        "cover_url": None,
    }

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        clip_session_store=mock_store,
    )

    with patch("threading.Thread"):
        res = coordinator.load_ready_clip("video1", "0_10")

    mock_store.get_clip_session.assert_called_once_with("video1", "0_10")
    assert res["session"]["crop_map"] == [{"time": 0.0, "x": 960}]


def test_delete_source_video_cascading(mock_dependencies):
    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"]
    )
    mock_store = MagicMock()
    coordinator.clip_session_store = mock_store
    mock_store.delete_source_clips.return_value = 3
    mock_dependencies["asset_repository"].delete_cached_video.return_value = True

    # Setup active jobs
    coordinator.jobs["job_src"] = {
        "status": "processing",
        "video_info": {"folder_name": "target_folder"}
    }
    coordinator.jobs["job_other"] = {
        "status": "processing",
        "video_info": {"folder_name": "other_folder"}
    }

    result = coordinator.delete_source_video("target_folder")

    assert result["deleted"] == 2
    assert result["folder"] == "target_folder"
    assert coordinator.jobs["job_src"]["status"] == "cancelled"
    assert coordinator.jobs["job_other"]["status"] == "processing"
    mock_store.delete_source_clips.assert_called_once_with("target_folder", job_store=coordinator.jobs)
    mock_dependencies["asset_repository"].delete_cached_video.assert_called_once_with("target_folder")


def test_run_local_cut_uses_injected_clip_session_store(mock_dependencies, tmp_path):
    """Verify run_local_cut delegates directly to injected clip_session_store without touching asset_repository."""
    mock_clip_store = MagicMock()
    clip_file = tmp_path / "mock_video.mp4"
    clip_file.write_text("mock")
    mock_clip_store.create_clip.return_value = {
        "file_path": str(clip_file),
        "duration": 15.0
    }
    mock_clip_store.extract_clip_audio.return_value = "dummy.wav"

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        clip_session_store=mock_clip_store
    )
    
    job_id = "test_injected_store_job"
    video_file = tmp_path / "video.mp4"
    video_file.write_text("dummy source")
    coordinator.jobs[job_id] = {
        "status": "queued",
        "full_video_path": str(video_file),
        "video_info": {"fps": 30.0},
        "clip": None
    }
    mock_dependencies["speech_transcriber"].transcribe.return_value = [
        {"start": 0.0, "duration": 1.0, "text": "Injected Store"}
    ]
    
    coordinator.run_local_cut(job_id, 5.0, 20.0)
    
    assert coordinator.jobs[job_id]["status"] == "ready"
    assert coordinator.jobs[job_id]["clip_duration"] == 15.0
    mock_clip_store.create_clip.assert_called_once_with(str(video_file), 5.0, 20.0, theme=None)
    mock_clip_store.extract_clip_audio.assert_called_once_with(str(clip_file))


def test_run_source_download_streams_progress_in_memory_and_preserves_terminal_or_cut_status(mock_dependencies, tmp_path):
    """Verify run_source_download emits zero disk writes for chunk progress and preserves cutting/cancelled statuses."""
    from core.job_store import JSONFileJobStore

    store = JSONFileJobStore(str(tmp_path / "jobs"))
    store.create_job("dl_ready", {"status": "hooks_ready", "download_percent": 0.0})
    store.create_job("dl_cancelled", {"status": "hooks_ready", "download_percent": 0.0})
    store.create_job("dl_cutting", {"status": "hooks_ready", "download_percent": 0.0})

    def fake_get_or_create_source(url, force_download=True, quality="1080p", progress_callback=None):
        assert progress_callback is not None
        if "cancelled" in url:
            progress_callback(42.34)
            store.update_job("dl_cancelled", status="cancelled", error="Source video deleted by user.")
        elif "cutting" in url:
            progress_callback(67.89)
            store.update_job("dl_cutting", status="cutting")
        else:
            for pct in (10.1, 55.6, 99.0):
                progress_callback(pct)
        return {"file_path": str(tmp_path / "full.mp4"), "fps": 30.0}

    mock_dependencies["asset_repository"].get_or_create_source.side_effect = fake_get_or_create_source

    coordinator = ClipWorkflowCoordinator(
        job_store=store,
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
    )

    with patch.object(store, "set_download_progress", wraps=store.set_download_progress) as spy_progress, \
         patch.object(store, "_persist_job", wraps=store._persist_job) as spy_persist:
        coordinator.run_source_download("dl_ready", "https://youtube.com/watch?v=ready_vid")

    # 3 progress updates in memory + exactly 1 disk write on completion
    assert spy_progress.call_count == 3
    assert spy_persist.call_count == 1
    assert store["dl_ready"]["status"] == "ready"
    assert store["dl_ready"]["download_percent"] == 100.0

    # Cancelled and cutting jobs must not be overwritten back to "ready"
    coordinator.run_source_download("dl_cancelled", "https://youtube.com/watch?v=cancelled_vid")
    assert store["dl_cancelled"]["status"] == "cancelled"
    assert store["dl_cancelled"]["download_percent"] == 100.0

    coordinator.run_source_download("dl_cutting", "https://youtube.com/watch?v=cutting_vid")
    assert store["dl_cutting"]["status"] == "cutting"
    assert store["dl_cutting"]["download_percent"] == 100.0


def test_load_ready_clip_reads_transcript_once_via_session_store(mock_dependencies, tmp_path):
    """load_ready_clip reads transcript.json only once through get_clip_session and derives quote in memory."""
    import builtins

    clips_dir = tmp_path / "clips"
    sources_dir = tmp_path / "sources"
    clip_dir = clips_dir / "vid_once" / "10_25_clip"
    source_dir = sources_dir / "vid_once"
    clip_dir.mkdir(parents=True)
    source_dir.mkdir(parents=True)

    (clip_dir / "video.mp4").write_text("dummy clip")
    transcript_path = clip_dir / "transcript.json"
    transcript_path.write_text(
        json.dumps([
            {"text": "Hello", "start": 0.0, "duration": 1.0},
            {"text": "world", "start": 1.0, "duration": 1.0},
        ])
    )
    (source_dir / "full.mp4").write_text("dummy source")

    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].source_dir = str(sources_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)
    mock_dependencies["asset_repository"].get_saved_hooks.return_value = []
    mock_dependencies["asset_repository"].get_cached_video_by_folder.return_value = {
        "folder_name": "vid_once",
        "video_id": "yt_once",
        "file_path": str(source_dir / "full.mp4"),
        "fps": 30.0,
        "duration": 120.0,
    }
    mock_dependencies["asset_repository"].transcoder.probe_video.return_value = MagicMock(duration=15.0)

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
    )

    real_open = builtins.open
    transcript_reads = 0

    def counting_open(file, mode="r", *args, **kwargs):
        nonlocal transcript_reads
        if isinstance(file, (str, os.PathLike)) and os.fspath(file) == str(transcript_path) and "r" in mode:
            transcript_reads += 1
        return real_open(file, mode, *args, **kwargs)

    with patch("builtins.open", side_effect=counting_open):
        res = coordinator.load_ready_clip("vid_once", "10_25_clip", whisper_model="base")

    assert transcript_reads == 1
    assert res["status"] == "ready"
    assert res["job"]["clip"]["transcript_quote"] == "Hello world"
    assert len(res["session"]["transcript"]) == 2


def test_load_ready_clip_passes_real_source_video_info_to_load_cached_hooks(mock_dependencies, tmp_path):
    """load_ready_clip passes real source video_info and duration so late hooks are preserved and screenshotted from source."""
    from core.hook_discovery_engine import HookDiscoveryEngine

    clips_dir = tmp_path / "clips"
    sources_dir = tmp_path / "sources"
    source_folder = sources_dir / "vid_long"
    clip_dir = clips_dir / "vid_long" / "120_165_late_hook"
    source_folder.mkdir(parents=True)
    clip_dir.mkdir(parents=True)

    source_video_path = source_folder / "full.mp4"
    source_video_path.write_text("dummy full")
    (source_folder / "hooks.json").write_text(
        json.dumps([
            {"start": 120.0, "end": 165.0, "title": "Late Hook 1"},
            {"start": 450.0, "end": 495.0, "title": "Late Hook 2"},
        ])
    )
    (clip_dir / "video.mp4").write_text("dummy clip")
    (clip_dir / "transcript.json").write_text(
        json.dumps([{"text": "Clip line", "start": 0.0, "duration": 2.0}])
    )

    mock_transcoder = MagicMock()
    mock_transcoder.probe_video.return_value = MagicMock(duration=45.0)
    mock_transcoder.capture_screenshot.return_value = True

    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].source_dir = str(sources_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)
    mock_dependencies["asset_repository"].transcoder = mock_transcoder
    mock_dependencies["asset_repository"].get_saved_hooks.return_value = []
    mock_dependencies["asset_repository"].get_cached_video_by_folder.return_value = {
        "folder_name": "vid_long",
        "video_id": "yt_long",
        "file_path": str(source_video_path),
        "fps": 30.0,
        "duration": 600.0,
    }

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        hook_discovery_engine=HookDiscoveryEngine(media_transcoder=mock_transcoder),
        face_tracker=mock_tracker,
    )

    res = coordinator.load_ready_clip("vid_long", "120_165_late_hook")

    assert len(res["job"]["hooks"]) == 2
    assert [h["start"] for h in res["job"]["hooks"]] == [120.0, 450.0]
    hook_calls = [
        call
        for call in mock_transcoder.capture_screenshot.call_args_list
        if "thumb_" in str(call.kwargs.get("output_path", ""))
    ]
    assert len(hook_calls) == 2
    for call in hook_calls:
        assert call.kwargs.get("video_path") == str(source_video_path)
    assert res["job"]["clip"]["start"] == 120.0
    assert res["job"]["clip"]["end"] == 165.0


def test_run_local_cut_calls_ensure_clip_defaults_once_when_transcription_empty(mock_dependencies, tmp_path):
    """run_local_cut heals defaults exactly once even when transcription produces no words."""
    clips_dir = tmp_path / "clips"
    clip_dir = clips_dir / "vid_empty" / "0_10"
    clip_dir.mkdir(parents=True)
    clip_file = clip_dir / "video.mp4"
    clip_file.write_text("dummy clip")

    source_file = tmp_path / "full.mp4"
    source_file.write_text("dummy source")

    mock_dependencies["asset_repository"].clips_dir = str(clips_dir)
    mock_dependencies["asset_repository"].output_dir = str(tmp_path)
    mock_dependencies["speech_transcriber"].transcribe.return_value = []

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [{"time": 0.0, "x": 960}]

    coordinator = ClipWorkflowCoordinator(
        job_store=mock_dependencies["job_store"],
        asset_repository=mock_dependencies["asset_repository"],
        youtube_client=mock_dependencies["youtube_client"],
        speech_transcriber=mock_dependencies["speech_transcriber"],
        prompt_repository=mock_dependencies["prompt_repository"],
        config_store=mock_dependencies["config_store"],
        face_tracker=mock_tracker,
    )

    job_id = "job_empty_transcript"
    coordinator.jobs[job_id] = {
        "status": "queued",
        "full_video_path": str(source_file),
        "video_info": {"fps": 30.0},
        "clip": None,
    }

    with patch.object(
        coordinator.clip_session_store,
        "create_clip",
        return_value={"file_path": str(clip_file), "duration": 10.0, "start": 0.0, "end": 10.0},
    ), patch.object(
        coordinator.clip_session_store,
        "extract_clip_audio",
        return_value="dummy.wav",
    ), patch.object(
        coordinator.clip_session_store,
        "ensure_clip_defaults",
        wraps=coordinator.clip_session_store.ensure_clip_defaults,
    ) as spy_ensure:
        coordinator.run_local_cut(job_id, 0.0, 10.0)

    assert coordinator.jobs[job_id]["status"] == "ready"
    assert spy_ensure.call_count == 1



