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




