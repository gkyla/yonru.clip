import os
import json
import tempfile
import pytest
from core.clip_session_store import ClipSessionStore

def test_path_traversal_detection():
    """Verify that path traversal attempts in folder_name or clip_id raise ValueError."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        os.makedirs(clips_dir, exist_ok=True)
        store = ClipSessionStore(clips_dir=clips_dir)

        malicious_cases = [
            ("../secret", "clip_1"),
            ("folder", "../clip_1"),
            ("../../etc", "passwd"),
            ("/etc", "passwd"),
            ("folder/sub", "clip_1"),
            ("folder", "clip/../../secret"),
            ("..\\windows", "clip"),
            ("folder", "nul"),
        ]

        for folder_name, clip_id in malicious_cases:
            with pytest.raises(ValueError, match="Path traversal detected"):
                store.resolve_clip_dir(folder_name, clip_id)

            with pytest.raises(ValueError, match="Path traversal detected"):
                store.get_clip_session(folder_name, clip_id)

            with pytest.raises(ValueError, match="Path traversal detected"):
                store.save_clip_session(folder_name, clip_id, {"transcript": []})


def test_get_clip_session_and_defaults_auto_healing():
    """Verify get_clip_session loads all manifests and auto-heals missing defaults."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        output_dir = temp_dir
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=output_dir)

        folder_name = "test_video_123"
        clip_id = "0.0_15.0_hook"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # Place a dummy video.mp4 and poster.jpg
        open(os.path.join(clip_dir, "video.mp4"), "w").close()
        with open(os.path.join(clip_dir, "poster.jpg"), "w") as f:
            f.write("fake poster content")

        session = store.get_clip_session(folder_name, clip_id)

        # Verify unified payload structure
        assert session["folder_name"] == folder_name
        assert session["clip_id"] == clip_id
        assert session["transcript"] == []
        assert isinstance(session["style_settings"], dict)
        assert session["style_settings"]["videoLayout"] == "vertical"
        assert session["style_settings"]["subtitlePreset"] == "bold-podcast"
        assert session["timeline"] == []
        assert session["timeline_tracks"] == []
        assert session["history"] == {"undo_stack": [], "redo_stack": []}
        assert session["undo_stack"] == []
        assert session["redo_stack"] == []
        assert isinstance(session["cover_config"], dict)
        assert session["cover_config"]["enabled"] is False
        assert session["cover_config"]["duration"] == 1.0
        assert session["crop_map"] is None
        assert session["asset_url"] == f"/assets/clips/{folder_name}/{clip_id}/video.mp4"
        assert session["thumbnail_url"] == f"/assets/clips/{folder_name}/{clip_id}/thumbnail.jpg"

        # Verify files were healed on disk
        assert os.path.exists(os.path.join(clip_dir, "style_settings.json"))
        assert os.path.exists(os.path.join(clip_dir, "cover_config.json"))
        assert os.path.exists(os.path.join(clip_dir, "thumbnail_config.json"))
        assert os.path.exists(os.path.join(clip_dir, "transcript.json"))
        # Verify poster was copied to thumbnail.jpg
        assert os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))
        with open(os.path.join(clip_dir, "thumbnail.jpg"), "r") as f:
            assert f.read() == "fake poster content"


def test_atomic_partial_and_complete_persistence():
    """Verify that save_clip_session saves partial and complete payloads atomically."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "proj_xyz"
        clip_id = "clip_456"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # 1. Partial save: transcript
        sample_transcript = [{"text": "Hello world", "start": 0.0, "end": 2.0}]
        res1 = store.save_clip_session(folder_name, clip_id, {"transcript": sample_transcript})
        assert res1["transcript"] == sample_transcript
        with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
            assert json.load(f) == sample_transcript

        # 2. Partial save: style settings and timeline tracks alias
        new_styles = {"font": "Outfit", "fontSize": 72, "cropMode": "manual"}
        timeline_items = [{"id": "item1", "type": "subtitle", "start": 0.0, "duration": 2.0}]
        res2 = store.save_clip_session(folder_name, clip_id, {
            "style_settings": new_styles,
            "timeline_tracks": timeline_items
        })
        assert res2["style_settings"]["font"] == "Outfit"
        assert res2["timeline"] == timeline_items
        assert res2["timeline_tracks"] == timeline_items
        # Transcript preserved
        assert res2["transcript"] == sample_transcript
        with open(os.path.join(clip_dir, "timeline.json"), "r") as f:
            assert json.load(f) == timeline_items

        # 3. Partial save: history (via undo_stack / redo_stack) and cover_config
        res3 = store.save_clip_session(folder_name, clip_id, {
            "undo_stack": ["state1"],
            "redo_stack": ["state2"],
            "cover_config": {"enabled": True, "duration": 3.0, "xOffset": 45}
        })
        assert res3["history"] == {"undo_stack": ["state1"], "redo_stack": ["state2"]}
        assert res3["cover_config"]["enabled"] is True
        assert res3["cover_config"]["duration"] == 3.0
        # Check thumbnail_config synced
        with open(os.path.join(clip_dir, "thumbnail_config.json"), "r") as f:
            assert json.load(f)["duration"] == 3.0

        # 4. Partial save: crop_map
        crop_points = [{"time": 0.0, "x": 800}, {"time": 1.5, "x": 920}]
        res4 = store.save_clip_session(folder_name, clip_id, {"crop_map": crop_points})
        assert res4["crop_map"] == crop_points
        with open(os.path.join(clip_dir, "crop_map.json"), "r") as f:
            assert json.load(f) == crop_points


def test_atomic_rollback_on_failure():
    """Verify that if saving fails midway, existing files are preserved and no .tmp files linger."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "proj_safe"
        clip_id = "clip_789"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # Pre-seed original transcript and styles
        orig_transcript = [{"text": "Original speech", "start": 0.0, "end": 1.0}]
        orig_style = {"font": "Montserrat", "fontSize": 50}
        store.save_clip_session(folder_name, clip_id, {
            "transcript": orig_transcript,
            "style_settings": orig_style
        })

        # Attempt to save valid transcript + INVALID (non-serializable) timeline item
        invalid_payload = {
            "transcript": [{"text": "MODIFIED speech", "start": 0.0, "end": 1.0}],
            "timeline": [{"bad_set": {1, 2, 3}}]  # sets cannot be JSON serialized
        }

        with pytest.raises((TypeError, ValueError)):
            store.save_clip_session(folder_name, clip_id, invalid_payload)

        # Verify original transcript.json is completely UNCHANGED
        with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
            assert json.load(f) == orig_transcript

        # Verify NO .tmp files are left behind
        files_in_dir = os.listdir(clip_dir)
        tmp_files = [f for f in files_in_dir if ".tmp" in f]
        assert len(tmp_files) == 0


def test_convenience_methods_and_adapters():
    """Verify individual convenience methods delegate correctly to atomic store."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "convenience_proj"
        clip_id = "clip_101"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # 1. save_transcript
        assert store.save_transcript(folder_name, clip_id, [{"text": "word", "start": 0.0, "end": 0.5}])
        with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
            assert json.load(f)[0]["text"] == "word"

        # 2. save_style_settings
        assert store.save_style_settings(folder_name, clip_id, {"fontSize": 42})
        with open(os.path.join(clip_dir, "style_settings.json"), "r") as f:
            assert json.load(f)["fontSize"] == 42

        # 3. save_timeline
        assert store.save_timeline(folder_name, clip_id, [{"id": "trk1"}])
        with open(os.path.join(clip_dir, "timeline.json"), "r") as f:
            assert json.load(f)[0]["id"] == "trk1"

        # 4. save_history
        assert store.save_history(folder_name, clip_id, ["u1"], ["r1"])
        with open(os.path.join(clip_dir, "history.json"), "r") as f:
            hist = json.load(f)
            assert hist["undo_stack"] == ["u1"]
            assert hist["redo_stack"] == ["r1"]

        # 5. save_cover_config & get_cover_config
        assert store.save_cover_config(folder_name, clip_id, {"enabled": True, "xOffset": 60})
        cover_cfg = store.get_cover_config(folder_name, clip_id)
        assert cover_cfg is not None
        assert cover_cfg["enabled"] is True
        assert cover_cfg["xOffset"] == 60

        # 6. save_crop_map & get_crop_map
        assert store.save_crop_map(folder_name, clip_id, [{"time": 0.0, "x": 960}])
        crop_data = store.get_crop_map(folder_name, clip_id)
        assert crop_data == [{"time": 0.0, "x": 960}]

        # 7. delete_cover (preserves thumbnail.jpg)
        with open(os.path.join(clip_dir, "cover.jpg"), "w") as f:
            f.write("cover data")
        with open(os.path.join(clip_dir, "thumbnail.jpg"), "w") as f:
            f.write("thumbnail data")
        assert store.delete_cover(folder_name, clip_id)
        assert not os.path.exists(os.path.join(clip_dir, "cover.jpg"))
        assert os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))


def test_global_default_style_settings_and_cover_style():
    """Verify global default style settings and cover style getters/setters."""
    with tempfile.TemporaryDirectory() as temp_dir:
        store = ClipSessionStore(clips_dir=os.path.join(temp_dir, "clips"), output_dir=temp_dir)

        # 1. Default style settings
        custom_style = {"font": "Montserrat", "fontSize": 54, "videoLayout": "vertical"}
        assert store.save_default_style_settings(custom_style)
        assert store.get_default_style_settings() == custom_style

        # 2. Default cover style
        custom_cover_style = {"thumbnailDuration": 2.5, "fontSize": 64}
        assert store.save_default_cover_style(custom_cover_style)
        assert store.get_default_cover_style() == custom_cover_style
        # Backward compatibility alias
        assert store.get_default_thumbnail_style() == custom_cover_style


def test_list_all_and_ready_clips():
    """Verify list_all_clips and list_ready_clips scan directory and auto-heal manifests."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        # Create two ready clips in different folders
        c1_dir = os.path.join(clips_dir, "folder_a", "10_20_hook_a")
        c2_dir = os.path.join(clips_dir, "folder_b", "30_45_hook_b")
        os.makedirs(c1_dir, exist_ok=True)
        os.makedirs(c2_dir, exist_ok=True)

        open(os.path.join(c1_dir, "video.mp4"), "w").close()
        open(os.path.join(c2_dir, "video.mp4"), "w").close()

        # Mock duration function
        def mock_duration(path):
            return 10.0 if "10_20" in path else 15.0

        all_clips = store.list_all_clips(duration_fn=mock_duration)
        assert len(all_clips) == 2
        clip_ids = {c["clip_id"] for c in all_clips}
        assert clip_ids == {"10_20_hook_a", "30_45_hook_b"}

        # Filtering active clips
        ready = store.list_ready_clips(active_clip_ids={"10_20_hook_a"}, duration_fn=mock_duration)
        assert len(ready) == 1
        assert ready[0]["clip_id"] == "30_45_hook_b"
        assert ready[0]["duration"] == 15.0


def test_delete_clip_and_delete_with_job():
    """Verify single clip deletion and job state cleanup."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "test_source"
        clip_id = "0_10"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        open(os.path.join(clip_dir, "video.mp4"), "w").close()

        import hashlib
        job_id = hashlib.md5(f"{folder_name}_{clip_id}".encode("utf-8")).hexdigest()[:8]
        fake_jobs = {job_id: {"status": "ready"}}

        assert os.path.exists(clip_dir)
        success = store.delete_clip_with_job(folder_name, clip_id, job_store=fake_jobs)
        assert success is True
        assert not os.path.exists(clip_dir)
        assert job_id not in fake_jobs


def test_delete_batch():
    """Verify batch deletion across multiple clips."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        # Create 3 clips
        for cid in ["clip_1", "clip_2", "clip_3"]:
            cdir = os.path.join(clips_dir, "common_folder", cid)
            os.makedirs(cdir, exist_ok=True)
            open(os.path.join(cdir, "video.mp4"), "w").close()

        items_to_delete = [
            {"folder_name": "common_folder", "clip_id": "clip_1"},
            {"folder_name": "common_folder", "clip_id": "clip_2"},
        ]

        result = store.delete_batch(items_to_delete)
        assert len(result) == 2
        assert all(r["success"] for r in result)
        assert not os.path.exists(os.path.join(clips_dir, "common_folder", "clip_1"))
        assert not os.path.exists(os.path.join(clips_dir, "common_folder", "clip_2"))
        assert os.path.exists(os.path.join(clips_dir, "common_folder", "clip_3"))


def test_delete_source_clips_and_job_cancellation():
    """Verify delete_source_clips purges folder and cancels associated background jobs."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "sample_source_vid"
        source_clips_dir = os.path.join(clips_dir, folder_name)
        for cid in ["clip_a", "clip_b"]:
            cdir = os.path.join(source_clips_dir, cid)
            os.makedirs(cdir, exist_ok=True)
            open(os.path.join(cdir, "video.mp4"), "w").close()

        fake_jobs = {
            "job1": {"status": "cutting", "clip": {"folder_name": folder_name, "clip_id": "clip_a"}},
            "job2": {"status": "transcribing", "folder_name": folder_name},
            "job3": {"status": "ready", "clip": {"folder_name": "other_folder", "clip_id": "clip_c"}},
        }

        assert os.path.exists(source_clips_dir)
        count = store.delete_source_clips(folder_name, job_store=fake_jobs)
        assert count == 2
        assert not os.path.exists(source_clips_dir)
        assert fake_jobs["job1"]["status"] == "cancelled"
        assert fake_jobs["job2"]["status"] == "cancelled"
        assert fake_jobs["job3"]["status"] == "ready"

        # Traversal protection
        with pytest.raises(ValueError, match="Path traversal detected"):
            store.delete_source_clips("../etc")


def test_derive_clip_id():
    """Verify derive_clip_id generates deterministic, safe clip IDs."""
    store = ClipSessionStore()
    assert store.derive_clip_id(10.0, 25.0) == "10_25"
    assert store.derive_clip_id(0.0, 15.0, theme="Funny Moment") == "0_15_Funny_Moment"
    assert store.derive_clip_id(12.5, 30.2, theme="Crazy / Epic & Wild?!") == "12_30_Crazy__Epic__Wild"


def test_create_clip_executes_ffmpeg_and_seeds_defaults():
    """Verify create_clip cuts Ready Clip via FFmpeg, extracts thumbnail, and seeds all default manifests."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        # Create dummy source video
        source_dir = os.path.join(temp_dir, "sources", "my_video_123")
        os.makedirs(source_dir, exist_ok=True)
        video_path = os.path.join(source_dir, "full.mp4")
        with open(video_path, "w") as f:
            f.write("dummy source video content")

        ffmpeg_calls = []
        def mock_run_ffmpeg(args):
            ffmpeg_calls.append(list(args))
            # If target out file is in args, create dummy output file
            out_file = args[-1]
            os.makedirs(os.path.dirname(out_file), exist_ok=True)
            with open(out_file, "w") as f:
                f.write("generated file")
            return True

        store._run_ffmpeg = mock_run_ffmpeg

        res = store.create_clip(video_path, start_time=10.0, end_time=25.0, theme="Best Part")

        assert res["clip_id"] == "10_25_Best_Part"
        assert res["folder_name"] == "my_video_123"
        assert res["duration"] == 15.0
        assert res["start"] == 10.0
        assert res["end"] == 25.0
        assert res["theme"] == "Best Part"
        assert res["asset_url"] == "/assets/clips/my_video_123/10_25_Best_Part/video.mp4"
        assert res["thumbnail_url"] == "/assets/clips/my_video_123/10_25_Best_Part/thumbnail.jpg"

        clip_dir = store.resolve_clip_dir("my_video_123", "10_25_Best_Part")
        assert os.path.exists(os.path.join(clip_dir, "video.mp4"))
        assert os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))
        assert os.path.exists(os.path.join(clip_dir, "style_settings.json"))
        assert os.path.exists(os.path.join(clip_dir, "cover_config.json"))
        assert os.path.exists(os.path.join(clip_dir, "thumbnail_config.json"))
        assert os.path.exists(os.path.join(clip_dir, "transcript.json"))

        # Verify ffmpeg arguments used -avoid_negative_ts auto and -accurate_seek
        cut_call = next(c for c in ffmpeg_calls if "-avoid_negative_ts" in c)
        assert "-accurate_seek" in cut_call
        idx = cut_call.index("-avoid_negative_ts")
        assert cut_call[idx + 1] == "auto"


def test_extract_clip_audio():
    """Verify extract_clip_audio extracts 16kHz mono WAV audio and caches result."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        clip_dir = os.path.join(clips_dir, "folder_1", "clip_1")
        os.makedirs(clip_dir, exist_ok=True)
        clip_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_path, "w") as f:
            f.write("dummy clip video")

        ffmpeg_calls = []
        def mock_run_ffmpeg(args):
            ffmpeg_calls.append(list(args))
            out_file = args[-1]
            with open(out_file, "w") as f:
                f.write("dummy wav audio")
            return True

        store._run_ffmpeg = mock_run_ffmpeg

        audio_path = store.extract_clip_audio(clip_path)
        assert audio_path == os.path.join(clip_dir, "audio_v2.wav")
        assert os.path.exists(audio_path)
        assert len(ffmpeg_calls) == 1
        assert "-ar" in ffmpeg_calls[0]
        assert "16000" in ffmpeg_calls[0]

        # Calling again should reuse cached wav without calling ffmpeg
        cached_audio = store.extract_clip_audio("folder_1", "clip_1")
        assert cached_audio == audio_path
        assert len(ffmpeg_calls) == 1


def test_extract_cover_frame():
    """Verify extract_cover_frame extracts custom frame, clamps timestamp, and leaves thumbnail intact."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        clip_dir = os.path.join(clips_dir, "folder_2", "clip_2")
        os.makedirs(clip_dir, exist_ok=True)
        clip_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_path, "w") as f:
            f.write("dummy clip video")

        # Static clip thumbnail
        thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
        with open(thumb_path, "w") as f:
            f.write("initial thumbnail")

        store.get_video_duration = lambda file_path: 20.0

        ffmpeg_calls = []
        def mock_run_ffmpeg(args):
            ffmpeg_calls.append(list(args))
            out_file = args[-1]
            with open(out_file, "w") as f:
                f.write("dummy cover image")
            return True

        store._run_ffmpeg = mock_run_ffmpeg

        res = store.extract_cover_frame("folder_2", "clip_2", timestamp=14.5)
        assert res["status"] == "ok"
        assert res["timestamp"] == 14.5
        assert res["cover_url"] == "/assets/clips/folder_2/clip_2/cover.jpg"

        # Verify cover.jpg was created and thumbnail.jpg remained untouched
        assert os.path.exists(os.path.join(clip_dir, "cover.jpg"))
        with open(thumb_path, "r") as f:
            assert f.read() == "initial thumbnail"


