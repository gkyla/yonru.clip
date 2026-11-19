import os
import json
import tempfile
from unittest.mock import MagicMock
import pytest
from core.clip_session_store import ClipSessionStore
from core.media_transcoder import FakeMediaAdapter, MediaSpecs, MediaTranscoder

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
    """Verify get_clip_session returns canonical keys, heals defaults, and respects ensure_crop_map flag."""
    from core.face_tracker import MockFaceTracker

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        output_dir = temp_dir
        mock_tracker = MockFaceTracker(mock_result=[{"time": 0.0, "x": 640}])
        store = ClipSessionStore(
            clips_dir=clips_dir,
            output_dir=output_dir,
            face_tracker=mock_tracker,
        )

        folder_name = "test_video_123"
        clip_id = "0.0_15.0_hook"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # Place a dummy video.mp4 and poster.jpg
        open(os.path.join(clip_dir, "video.mp4"), "w").close()
        with open(os.path.join(clip_dir, "poster.jpg"), "w") as f:
            f.write("fake poster content")

        # 1. Calling with ensure_crop_map=False skips face tracking
        session_no_crop = store.get_clip_session(folder_name, clip_id, ensure_crop_map=False)
        assert session_no_crop["crop_map"] is None
        assert len(mock_tracker.analyzed_paths) == 0

        # 2. Default ensure_crop_map=True computes and caches crop_map
        session = store.get_clip_session(folder_name, clip_id)

        expected_keys = {
            "folder_name",
            "clip_id",
            "transcript",
            "style_settings",
            "timeline",
            "history",
            "cover_config",
            "crop_map",
            "asset_url",
            "thumbnail_url",
            "cover_url",
        }
        assert set(session.keys()) == expected_keys
        assert session["folder_name"] == folder_name
        assert session["clip_id"] == clip_id
        assert session["transcript"] == []
        assert isinstance(session["style_settings"], dict)
        assert session["style_settings"]["videoLayout"] == "vertical"
        assert session["style_settings"]["subtitlePreset"] == "bold-podcast"
        assert session["timeline"] == []
        assert session["history"] == {"undo_stack": [], "redo_stack": []}
        assert isinstance(session["cover_config"], dict)
        assert session["cover_config"]["enabled"] is False
        assert session["cover_config"]["duration"] == 1.0
        assert session["crop_map"] == [{"time": 0.0, "x": 640}]
        assert len(mock_tracker.analyzed_paths) == 1
        assert session["asset_url"] == f"/assets/clips/{folder_name}/{clip_id}/video.mp4"
        assert session["thumbnail_url"] == f"/assets/clips/{folder_name}/{clip_id}/thumbnail.jpg"
        assert session["cover_url"] is None

        # Verify files were healed on disk
        assert os.path.exists(os.path.join(clip_dir, "style_settings.json"))
        assert os.path.exists(os.path.join(clip_dir, "cover_config.json"))
        assert not os.path.exists(os.path.join(clip_dir, "thumbnail_config.json"))
        assert os.path.exists(os.path.join(clip_dir, "transcript.json"))
        assert os.path.exists(os.path.join(clip_dir, "crop_map.json"))
        with open(os.path.join(clip_dir, "thumbnail.jpg"), "r") as f:
            assert f.read() == "fake poster content"


def test_get_clip_session_cascades_style_settings():
    """Verify get_clip_session cascades CANONICAL_DEFAULT_STYLE_SETTINGS <- default_style_settings.json <- clip style_settings.json."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)
        store.save_default_style_settings({"font": "Outfit", "fontSize": 60})

        folder_name = "vid_cascade"
        clip_id = "0_10"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        with open(os.path.join(clip_dir, "style_settings.json"), "w", encoding="utf-8") as f:
            json.dump({"fontSize": 72}, f)

        session = store.get_clip_session(folder_name, clip_id, ensure_crop_map=False)
        assert session["style_settings"]["fontSize"] == 72
        assert session["style_settings"]["font"] == "Outfit"
        assert session["style_settings"]["subtitleSyncOffset"] == 150


def test_get_clip_session_migrates_legacy_cover_assets():
    """Verify get_clip_session migrates thumbnail_config.json -> cover_config.json and thumbnail.jpg -> cover.jpg internally."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "vid_legacy_cover"
        clip_id = "0_10"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        with open(os.path.join(clip_dir, "thumbnail_config.json"), "w", encoding="utf-8") as f:
            json.dump({"enabled": True, "duration": 2.0, "textOverlays": [], "xOffset": 50}, f)
        with open(os.path.join(clip_dir, "thumbnail.jpg"), "w", encoding="utf-8") as f:
            f.write("legacy thumb image")

        session = store.get_clip_session(folder_name, clip_id, ensure_crop_map=False)
        assert session["cover_config"]["enabled"] is True
        assert session["cover_config"]["duration"] == 2.0
        assert session["cover_url"] == f"/assets/clips/{folder_name}/{clip_id}/cover.jpg"
        assert os.path.exists(os.path.join(clip_dir, "cover_config.json"))
        assert os.path.exists(os.path.join(clip_dir, "cover.jpg"))
        assert os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))


def test_get_clip_session_extracts_legacy_inline_audio_to_library():
    """Verify legacy data:audio/... URIs in timeline and history are extracted to AudioLibraryStore."""
    import base64
    from core.audio_library_repository import AudioLibraryRepository

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        audio_repo = AudioLibraryRepository(output_dir=temp_dir)
        store = ClipSessionStore(
            clips_dir=clips_dir,
            output_dir=temp_dir,
            audio_library_store=audio_repo,
        )
        audio_repo.clip_session_store = store

        folder_name = "vid_legacy_audio"
        clip_id = "0_10"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        raw_bytes = b"fake-mp3-audio-payload"
        data_uri = "data:audio/mp3;base64," + base64.b64encode(raw_bytes).decode("ascii")

        with open(os.path.join(clip_dir, "timeline.json"), "w", encoding="utf-8") as f:
            json.dump(
                [
                    {
                        "id": "audio",
                        "type": "audio",
                        "items": [
                            {"id": "a1", "name": "whoosh.mp3", "start": 0.0, "duration": 2.5, "src": data_uri}
                        ],
                    }
                ],
                f,
            )
        with open(os.path.join(clip_dir, "history.json"), "w", encoding="utf-8") as f:
            json.dump(
                {
                    "undo_stack": [
                        {
                            "tracks": [
                                {
                                    "id": "audio",
                                    "type": "audio",
                                    "items": [
                                        {"id": "a1", "name": "whoosh.mp3", "start": 0.0, "duration": 2.5, "src": data_uri}
                                    ],
                                }
                            ],
                            "transcript": [],
                            "selectedId": None,
                        }
                    ],
                    "redo_stack": [],
                },
                f,
            )

        session = store.get_clip_session(folder_name, clip_id, ensure_crop_map=False)

        extracted_src = session["timeline"][0]["items"][0]["src"]
        assert extracted_src.startswith("/assets/audio_library/")
        assert session["history"]["undo_stack"][0]["tracks"][0]["items"][0]["src"] == extracted_src

        # Disk manifests updated so future reads and reference checks use Audio Library URL
        with open(os.path.join(clip_dir, "timeline.json"), "r", encoding="utf-8") as f:
            assert json.load(f)[0]["items"][0]["src"] == extracted_src
        assert len(audio_repo.list_items()) == 1


def test_atomic_partial_and_complete_persistence():
    """Verify save_clip_session performs pure atomic partial-patch writes for canonical keys and returns compact ack."""
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
        assert res1 == {"folder_name": folder_name, "clip_id": clip_id}
        with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
            assert json.load(f) == sample_transcript

        # 2. Partial save: canonical style_settings and timeline; alias keys are ignored
        new_styles = {"font": "Outfit", "fontSize": 72, "cropMode": "manual"}
        timeline_items = [{"id": "video", "type": "video", "items": [{"id": "v1", "start": 0.0, "duration": 2.0}]}]
        res2 = store.save_clip_session(folder_name, clip_id, {
            "style_settings": new_styles,
            "timeline": timeline_items,
            "timeline_tracks": [{"ignored": True}],
            "settings": {"ignored": True},
        })
        assert res2 == {"folder_name": folder_name, "clip_id": clip_id}
        with open(os.path.join(clip_dir, "timeline.json"), "r") as f:
            assert json.load(f) == timeline_items

        # 3. Partial save: canonical history and cover_config
        res3 = store.save_clip_session(folder_name, clip_id, {
            "history": {"undo_stack": ["state1"], "redo_stack": ["state2"]},
            "cover_config": {"enabled": True, "duration": 3.0, "xOffset": 45}
        })
        assert res3 == {"folder_name": folder_name, "clip_id": clip_id}
        with open(os.path.join(clip_dir, "cover_config.json"), "r") as f:
            assert json.load(f)["duration"] == 3.0
        assert not os.path.exists(os.path.join(clip_dir, "thumbnail_config.json"))

        # 4. Partial save: crop_map
        crop_points = [{"time": 0.0, "x": 800}, {"time": 1.5, "x": 920}]
        res4 = store.save_clip_session(folder_name, clip_id, {"crop_map": crop_points})
        assert res4 == {"folder_name": folder_name, "clip_id": clip_id}

        # Verify combined state via get_clip_session
        session = store.get_clip_session(folder_name, clip_id, ensure_crop_map=False)
        assert session["transcript"] == sample_transcript
        assert session["style_settings"]["font"] == "Outfit"
        assert session["timeline"] == timeline_items
        assert session["history"] == {"undo_stack": ["state1"], "redo_stack": ["state2"]}
        assert session["cover_config"]["enabled"] is True
        assert session["crop_map"] == crop_points


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


def test_crop_map_and_delete_cover():
    """Verify crop_map persistence and delete_cover preserving thumbnail.jpg."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "convenience_proj"
        clip_id = "clip_101"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        assert store.save_crop_map(folder_name, clip_id, [{"time": 0.0, "x": 960}])
        crop_data = store.get_crop_map(folder_name, clip_id)
        assert crop_data == [{"time": 0.0, "x": 960}]

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
        adapter = FakeMediaAdapter()
        transcoder = MediaTranscoder(adapter=adapter)
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, media_transcoder=transcoder)

        # Create two ready clips in different folders
        c1_dir = os.path.join(clips_dir, "folder_a", "10_20_hook_a")
        c2_dir = os.path.join(clips_dir, "folder_b", "30_45_hook_b")
        os.makedirs(c1_dir, exist_ok=True)
        os.makedirs(c2_dir, exist_ok=True)

        v1 = os.path.join(c1_dir, "video.mp4")
        v2 = os.path.join(c2_dir, "video.mp4")
        open(v1, "w").close()
        open(v2, "w").close()

        adapter.probe_overrides[v1] = {"format": {"duration": "10.0"}, "streams": []}
        adapter.probe_overrides[v2] = {"format": {"duration": "15.0"}, "streams": []}

        all_clips = store.list_all_clips()
        assert len(all_clips) == 2
        clip_ids = {c["clip_id"] for c in all_clips}
        assert clip_ids == {"10_20_hook_a", "30_45_hook_b"}

        # Filtering active clips
        ready = store.list_ready_clips(active_clip_ids={"10_20_hook_a"})
        assert len(ready) == 1
        assert ready[0]["clip_id"] == "30_45_hook_b"
        assert ready[0]["duration"] == 15.0


def test_clip_session_store_media_delegations():
    """Verify ClipSessionStore media probing and screenshotting delegate directly to MediaTranscoder."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        mock_transcoder = MagicMock()
        mock_transcoder.probe_video.return_value = MediaSpecs(duration=18.5)
        mock_transcoder.capture_screenshot.return_value = True

        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, media_transcoder=mock_transcoder)

        # 1. ensure_clip_defaults generates thumbnail via extract_clip_screenshot directly
        clip_dir = os.path.join(clips_dir, "f1", "c1")
        os.makedirs(clip_dir, exist_ok=True)
        clip_vid = os.path.join(clip_dir, "video.mp4")
        open(clip_vid, "w").close()

        # 2. list_all_clips delegates duration probe directly to transcoder.probe_video
        clips = store.list_all_clips()
        assert len(clips) == 1
        assert clips[0]["duration"] == 18.5
        mock_transcoder.probe_video.assert_called_once_with(clip_vid)
        mock_transcoder.capture_screenshot.assert_called_with(
            clip_vid, 0.0, os.path.join(clip_dir, "thumbnail.jpg")
        )

        # 3. extract_cover_frame captures cover image and clamps timestamp via probe_video
        mock_transcoder.probe_video.reset_mock()
        mock_transcoder.capture_screenshot.reset_mock()
        res = store.extract_cover_frame("f1", "c1", timestamp=12.0)
        assert res["status"] == "ok"
        assert res["timestamp"] == 12.0
        mock_transcoder.probe_video.assert_called_once_with(clip_vid)
        mock_transcoder.capture_screenshot.assert_called_once_with(
            clip_vid, 12.0, os.path.join(clip_dir, "cover.jpg")
        )


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
        assert not os.path.exists(os.path.join(clip_dir, "thumbnail_config.json"))
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
        transcoder = MediaTranscoder(adapter=FakeMediaAdapter(default_duration=20.0))
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, media_transcoder=transcoder)

        clip_dir = os.path.join(clips_dir, "folder_2", "clip_2")
        os.makedirs(clip_dir, exist_ok=True)
        clip_path = os.path.join(clip_dir, "video.mp4")
        with open(clip_path, "w") as f:
            f.write("dummy clip video")

        # Static clip thumbnail
        thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
        with open(thumb_path, "w") as f:
            f.write("initial thumbnail")

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


def test_ensure_crop_map_cache_hit():
    """Verify ensure_crop_map returns cached keyframes without running face tracker."""
    from core.face_tracker import MockFaceTracker

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        mock_tracker = MockFaceTracker(mock_result=960)
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=mock_tracker)

        folder_name = "test_vid"
        clip_id = "0_15_hook"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        cached_crop_map = [{"time": 0.0, "x": 720}, {"time": 2.5, "x": 840}]
        store.save_crop_map(folder_name, clip_id, cached_crop_map)

        result = store.ensure_crop_map(folder_name, clip_id)
        assert result == cached_crop_map
        assert len(mock_tracker.analyzed_paths) == 0


def test_ensure_crop_map_cache_miss_scalar_normalization():
    """Verify ensure_crop_map runs tracker on cache miss, normalizes scalar coordinates, and persists."""
    from core.face_tracker import MockFaceTracker

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        mock_tracker = MockFaceTracker(mock_result=960.8)
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=mock_tracker)

        folder_name = "test_source_vid"
        clip_id = "10_20_part"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)
        video_path = os.path.join(clip_dir, "video.mp4")
        with open(video_path, "w") as f:
            f.write("dummy video content")

        result = store.ensure_crop_map(folder_name, clip_id)
        expected = [{"time": 0.0, "x": 960}]
        assert result == expected
        assert mock_tracker.analyzed_paths == [video_path]

        # Verify persisted atomically to disk
        assert store.get_crop_map(folder_name, clip_id) == expected


def test_ensure_crop_map_cache_miss_list_keyframes_and_overrides():
    """Verify ensure_crop_map with list keyframes respects tracker and video_path overrides."""
    from core.face_tracker import MockFaceTracker

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        default_tracker = MockFaceTracker(mock_result=960)
        custom_tracker = MockFaceTracker(mock_result=[{"time": 0.0, "x": 600}, {"time": 3.0, "x": 800}])
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=default_tracker)

        folder_name = "custom_folder"
        clip_id = "0_30"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        custom_video_path = os.path.join(temp_dir, "alternative_video.mp4")
        with open(custom_video_path, "w") as f:
            f.write("custom video")

        result = store.ensure_crop_map(folder_name, clip_id, video_path=custom_video_path, tracker=custom_tracker)
        expected = [{"time": 0.0, "x": 600}, {"time": 3.0, "x": 800}]

        assert result == expected
        assert len(default_tracker.analyzed_paths) == 0
        assert custom_tracker.analyzed_paths == [custom_video_path]
        assert store.get_crop_map(folder_name, clip_id) == expected


def test_ensure_crop_map_fallback_on_empty_and_exceptions():
    """Verify ensure_crop_map safely falls back to x=960 center framing on empty results or exceptions."""
    from core.face_tracker import MockFaceTracker

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")

        # 1. Fallback on empty list
        empty_tracker = MockFaceTracker(mock_result=[])
        store_empty = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=empty_tracker)
        clip_dir_1 = os.path.join(clips_dir, "vid_1", "c_1")
        os.makedirs(clip_dir_1, exist_ok=True)
        with open(os.path.join(clip_dir_1, "video.mp4"), "w") as f:
            f.write("video")

        res_empty = store_empty.ensure_crop_map("vid_1", "c_1")
        assert res_empty == [{"time": 0.0, "x": 960}]
        assert store_empty.get_crop_map("vid_1", "c_1") == [{"time": 0.0, "x": 960}]

        # 2. Fallback on None return
        none_tracker = MockFaceTracker(mock_result=None)
        store_none = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=none_tracker)
        clip_dir_2 = os.path.join(clips_dir, "vid_2", "c_2")
        os.makedirs(clip_dir_2, exist_ok=True)
        with open(os.path.join(clip_dir_2, "video.mp4"), "w") as f:
            f.write("video")

        res_none = store_none.ensure_crop_map("vid_2", "c_2")
        assert res_none == [{"time": 0.0, "x": 960}]
        assert store_none.get_crop_map("vid_2", "c_2") == [{"time": 0.0, "x": 960}]

        # 3. Fallback on Tracker Exception
        class FailingTracker:
            def analyze_video(self, video_path, words_data=None):
                raise RuntimeError("Face detection pipeline crashed")

        store_error = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=FailingTracker())
        clip_dir_3 = os.path.join(clips_dir, "vid_3", "c_3")
        os.makedirs(clip_dir_3, exist_ok=True)
        with open(os.path.join(clip_dir_3, "video.mp4"), "w") as f:
            f.write("video")

        res_error = store_error.ensure_crop_map("vid_3", "c_3")
        assert res_error == [{"time": 0.0, "x": 960}]
        assert store_error.get_crop_map("vid_3", "c_3") == [{"time": 0.0, "x": 960}]


def test_ensure_crop_map_path_traversal():
    """Verify ensure_crop_map defends against path traversal in folder_name or clip_id."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        with pytest.raises(ValueError, match="Path traversal detected"):
            store.ensure_crop_map("../malicious", "clip_1")

        with pytest.raises(ValueError, match="Path traversal detected"):
            store.ensure_crop_map("folder_1", "../etc/passwd")


def test_ensure_crop_map_lazy_tracker_instantiation():
    """Verify ensure_crop_map lazily instantiates FaceTracker when none is injected."""
    from unittest.mock import patch, MagicMock

    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=None)

        clip_dir = os.path.join(clips_dir, "vid_lazy", "c_lazy")
        os.makedirs(clip_dir, exist_ok=True)
        with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
            f.write("video")

        mock_lazy_instance = MagicMock()
        mock_lazy_instance.analyze_video.return_value = [{"time": 0.0, "x": 960}]

        with patch("core.face_tracker.FaceTracker", return_value=mock_lazy_instance) as mock_ft_cls:
            result = store.ensure_crop_map("vid_lazy", "c_lazy")
            assert result == [{"time": 0.0, "x": 960}]
            mock_ft_cls.assert_called_once()
            mock_lazy_instance.analyze_video.assert_called_once_with(os.path.join(clip_dir, "video.mp4"))

def test_ensure_crop_map_missing_video_raises_filenotfound():
    """Verify ensure_crop_map raises FileNotFoundError when video.mp4 does not exist."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        with pytest.raises(FileNotFoundError, match="Clip video not found"):
            store.ensure_crop_map("nonexistent_folder", "nonexistent_clip")


def test_resolve_clip_artifacts_by_video_path_and_cover_precedence():
    """Verify resolve_clip_artifacts locates clip manifests and prefers cover.jpg over thumbnail.jpg."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)

        folder_name = "source_vid"
        clip_id = "0_15_hook"
        clip_dir = os.path.join(clips_dir, folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        video_path = os.path.join(clip_dir, "video.mp4")
        transcript_path = os.path.join(clip_dir, "transcript.json")
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        thumb_path = os.path.join(clip_dir, "thumbnail.jpg")
        cover_path = os.path.join(clip_dir, "cover.jpg")

        for path, content in (
            (video_path, "video"),
            (transcript_path, "[]"),
            (crop_map_path, '[{"time": 0.0, "x": 640}]'),
            (thumb_path, "thumb"),
            (cover_path, "cover"),
        ):
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)

        artifacts = store.resolve_clip_artifacts(video_path)
        assert artifacts is not None
        assert artifacts.folder_name == folder_name
        assert artifacts.clip_id == clip_id
        assert artifacts.clip_dir == clip_dir
        assert artifacts.video_path == video_path
        assert artifacts.transcript_path == transcript_path
        assert artifacts.crop_map_path == crop_map_path
        assert artifacts.cover_image_path == cover_path

        os.remove(cover_path)
        artifacts_thumb = store.resolve_clip_artifacts(video_path)
        assert artifacts_thumb is not None
        assert artifacts_thumb.cover_image_path == thumb_path

        os.remove(thumb_path)
        artifacts_no_cover = store.resolve_clip_artifacts(video_path)
        assert artifacts_no_cover is not None
        assert artifacts_no_cover.cover_image_path is None


def test_resolve_clip_artifacts_non_clip_and_traversal():
    """Verify resolve_clip_artifacts returns None for source videos and rejects traversal."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        sources_dir = os.path.join(temp_dir, "sources", "vid_1")
        os.makedirs(clips_dir, exist_ok=True)
        os.makedirs(sources_dir, exist_ok=True)
        source_video = os.path.join(sources_dir, "video.mp4")
        with open(source_video, "w", encoding="utf-8") as f:
            f.write("source")

        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir)
        assert store.resolve_clip_artifacts(source_video) is None
        assert store.resolve_clip_artifacts() is None

        with pytest.raises(ValueError, match="Path traversal detected"):
            store.resolve_clip_artifacts(folder_name="../malicious", clip_id="clip_1")

        # Stale folder_name/clip_id must not override an explicit Ready Clip video_path
        clip_dir = os.path.join(clips_dir, "fresh_vid", "10_20_fresh")
        os.makedirs(clip_dir, exist_ok=True)
        fresh_video = os.path.join(clip_dir, "video.mp4")
        with open(fresh_video, "w", encoding="utf-8") as f:
            f.write("fresh")
        resolved = store.resolve_clip_artifacts(fresh_video, folder_name="stale_vid", clip_id="0_5_stale")
        assert resolved is not None
        assert resolved.folder_name == "fresh_vid"
        assert resolved.clip_id == "10_20_fresh"


def test_ensure_crop_map_forwards_words_data_and_handles_scalar_cache():
    """Verify ensure_crop_map passes words_data when provided and normalizes scalar crop_map.json."""
    with tempfile.TemporaryDirectory() as temp_dir:
        clips_dir = os.path.join(temp_dir, "clips")
        clip_dir = os.path.join(clips_dir, "vid_words", "0_10_hook")
        os.makedirs(clip_dir, exist_ok=True)
        video_path = os.path.join(clip_dir, "video.mp4")
        with open(video_path, "w", encoding="utf-8") as f:
            f.write("video")

        captured = []

        class RecordingTracker:
            def analyze_video(self, path, words_data=None):
                captured.append((path, words_data))
                return [{"time": 0.0, "x": 540}]

        store = ClipSessionStore(clips_dir=clips_dir, output_dir=temp_dir, face_tracker=RecordingTracker())
        words = [{"word": "hello", "start": 0.0, "end": 0.5}]
        result = store.ensure_crop_map("vid_words", "0_10_hook", words_data=words)
        assert result == [{"time": 0.0, "x": 540}]
        assert captured == [(video_path, words)]
        assert store.get_crop_map("vid_words", "0_10_hook") == [{"time": 0.0, "x": 540}]

        # Legacy scalar number in crop_map.json should normalize cleanly without len() crash
        scalar_dir = os.path.join(clips_dir, "vid_scalar", "0_10_scalar")
        os.makedirs(scalar_dir, exist_ok=True)
        with open(os.path.join(scalar_dir, "crop_map.json"), "w", encoding="utf-8") as f:
            json.dump(720, f)

        scalar_result = store.ensure_crop_map("vid_scalar", "0_10_scalar")
        assert scalar_result == [{"time": 0.0, "x": 720}]




