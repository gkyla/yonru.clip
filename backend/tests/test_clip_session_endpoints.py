import os
import json
import pytest
from fastapi.testclient import TestClient

import sys
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import main
from main import app
from core.clip_session_store import ClipSessionStore

@pytest.fixture
def client_with_temp_storage(tmp_path, monkeypatch):
    """Configures FastAPI TestClient with isolated temp clips and output directories."""
    clips_dir = tmp_path / "temp_assets" / "clips"
    output_dir = tmp_path / "temp_assets"
    clips_dir.mkdir(parents=True, exist_ok=True)

    test_store = ClipSessionStore(clips_dir=str(clips_dir), output_dir=str(output_dir))

    # Monkeypatch the module-level instances in main
    monkeypatch.setattr(main, "clip_session_store", test_store)
    if hasattr(main, "asset_repository"):
        monkeypatch.setattr(main.asset_repository, "clips_dir", str(clips_dir))
        monkeypatch.setattr(main.asset_repository, "output_dir", str(output_dir))
    if hasattr(main, "workflow_coordinator"):
        monkeypatch.setattr(main.workflow_coordinator, "clip_session_store", test_store)

    return TestClient(app), str(clips_dir), str(output_dir)


def test_get_clip_session_endpoint_and_healing(client_with_temp_storage):
    """GET /api/clip-session/{folder_name}/{clip_id} returns aggregate session and heals defaults."""
    client, clips_dir, _ = client_with_temp_storage
    folder_name = "test_vid_session"
    clip_id = "clip_0_10"
    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)

    # Pre-seed a dummy video
    with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
        f.write("dummy video")

    res = client.get(f"/api/clip-session/{folder_name}/{clip_id}")
    assert res.status_code == 200
    data = res.json()

    assert data["status"] == "ok"
    assert data["folder_name"] == folder_name
    assert data["clip_id"] == clip_id
    assert data["transcript"] == []
    assert isinstance(data["style_settings"], dict)
    assert data["style_settings"]["videoLayout"] == "vertical"
    assert data["timeline"] == []
    assert data["history"] == {"undo_stack": [], "redo_stack": []}
    assert isinstance(data["cover_config"], dict)
    assert data["crop_map"] is None
    assert data["asset_url"] == f"/assets/clips/{folder_name}/{clip_id}/video.mp4"

    # Verify files were healed on disk
    assert os.path.exists(os.path.join(clip_dir, "style_settings.json"))
    assert os.path.exists(os.path.join(clip_dir, "cover_config.json"))
    assert os.path.exists(os.path.join(clip_dir, "transcript.json"))


def test_put_clip_session_endpoint_partial_and_complete(client_with_temp_storage):
    """PUT /api/clip-session/{folder_name}/{clip_id} saves partial and complete manifests atomically."""
    client, clips_dir, _ = client_with_temp_storage
    folder_name = "test_vid_put"
    clip_id = "clip_put_1"
    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)

    # 1. Partial update: transcript
    sample_transcript = [{"text": "Hello world", "start": 0.0, "end": 1.5}]
    res1 = client.put(f"/api/clip-session/{folder_name}/{clip_id}", json={
        "transcript": sample_transcript
    })
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["transcript"] == sample_transcript

    with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
        assert json.load(f) == sample_transcript

    # 2. Partial update: style_settings, timeline_tracks, and history
    sample_styles = {"font": "Montserrat", "fontSize": 64, "videoLayout": "portrait"}
    sample_tracks = [{"id": "t1", "type": "subtitle"}]
    sample_undo = ["u1", "u2"]
    res2 = client.put(f"/api/clip-session/{folder_name}/{clip_id}", json={
        "style_settings": sample_styles,
        "timeline_tracks": sample_tracks,
        "undo_stack": sample_undo
    })
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["style_settings"]["font"] == "Montserrat"
    assert d2["timeline"] == sample_tracks
    assert d2["history"]["undo_stack"] == sample_undo
    # Transcript preserved
    assert d2["transcript"] == sample_transcript

    # 3. Partial update: cover_config and crop_map
    sample_crop = [{"time": 0.0, "x": 960}]
    sample_cover = {"enabled": True, "duration": 2.5, "xOffset": 40}
    res3 = client.put(f"/api/clip-session/{folder_name}/{clip_id}", json={
        "cover_config": sample_cover,
        "crop_map": sample_crop
    })
    assert res3.status_code == 200
    d3 = res3.json()
    assert d3["cover_config"]["enabled"] is True
    assert d3["crop_map"] == sample_crop

    with open(os.path.join(clip_dir, "cover_config.json"), "r") as f:
        assert json.load(f)["duration"] == 2.5
    with open(os.path.join(clip_dir, "thumbnail_config.json"), "r") as f:
        assert json.load(f)["duration"] == 2.5
    with open(os.path.join(clip_dir, "crop_map.json"), "r") as f:
        assert json.load(f) == sample_crop


def test_clip_session_path_traversal_rejection(client_with_temp_storage):
    """GET and PUT /api/clip-session reject directory traversal attacks with 400 Bad Request."""
    client, _, _ = client_with_temp_storage

    malicious_paths = [
        ("folder..", "clip"),
        ("folder", "clip.."),
        ("nul", "clip_1"),
        ("folder", "con"),
        ("aux", "clip"),
    ]

    for f_name, c_id in malicious_paths:
        res_get = client.get(f"/api/clip-session/{f_name}/{c_id}")
        assert res_get.status_code == 400
        assert "Path traversal detected" in res_get.json()["detail"]

        res_put = client.put(f"/api/clip-session/{f_name}/{c_id}", json={"transcript": []})
        assert res_put.status_code == 400
        assert "Path traversal detected" in res_put.json()["detail"]

    # Also test legacy endpoint JSON body path traversal rejection
    legacy_traversal = client.put("/api/transcript", json={
        "folder_name": "../../etc",
        "clip_id": "passwd",
        "transcript": []
    })
    assert legacy_traversal.status_code == 400
    assert "Path traversal detected" in legacy_traversal.json()["detail"]


def test_legacy_endpoints_backward_compatibility(client_with_temp_storage):
    """Verify legacy endpoints (/api/transcript, /api/style-settings, etc.) delegate to ClipSessionStore."""
    client, clips_dir, _ = client_with_temp_storage
    folder_name = "test_vid_legacy"
    clip_id = "clip_legacy_1"
    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)

    # 1. PUT /api/transcript
    t_words = [{"text": "legacy word", "start": 0.0, "end": 0.5}]
    res1 = client.put("/api/transcript", json={
        "folder_name": folder_name,
        "clip_id": clip_id,
        "transcript": t_words
    })
    assert res1.status_code == 200
    assert res1.json() == {"status": "ok"}
    with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
        assert json.load(f) == t_words

    # 2. PUT /api/style-settings
    styles = {"fontSize": 48, "videoLayout": "vertical"}
    res2 = client.put("/api/style-settings", json={
        "folder_name": folder_name,
        "clip_id": clip_id,
        "settings": styles
    })
    assert res2.status_code == 200
    assert res2.json() == {"status": "ok"}
    with open(os.path.join(clip_dir, "style_settings.json"), "r") as f:
        assert json.load(f)["fontSize"] == 48

    # 3. PUT /api/timeline
    tracks = [{"id": "trk_legacy", "type": "text"}]
    res3 = client.put("/api/timeline", json={
        "folder_name": folder_name,
        "clip_id": clip_id,
        "timeline_tracks": tracks
    })
    assert res3.status_code == 200
    assert res3.json() == {"status": "ok"}
    with open(os.path.join(clip_dir, "timeline.json"), "r") as f:
        assert json.load(f) == tracks

    # 4. PUT /api/timeline-history
    res4 = client.put("/api/timeline-history", json={
        "folder_name": folder_name,
        "clip_id": clip_id,
        "undo_stack": ["action1"],
        "redo_stack": ["action2"]
    })
    assert res4.status_code == 200
    assert res4.json() == {"status": "ok"}
    with open(os.path.join(clip_dir, "history.json"), "r") as f:
        hist = json.load(f)
        assert hist["undo_stack"] == ["action1"]
        assert hist["redo_stack"] == ["action2"]

    # 5. PUT and GET /api/cover/config
    cover_cfg = {"enabled": True, "duration": 1.5, "xOffset": 50, "textOverlays": []}
    res5 = client.put("/api/cover/config", json={
        "folder_name": folder_name,
        "clip_id": clip_id,
        "config": cover_cfg
    })
    assert res5.status_code == 200
    assert res5.json() == {"status": "ok"}

    res6 = client.get(f"/api/cover/config/{folder_name}/{clip_id}")
    assert res6.status_code == 200
    assert res6.json()["config"]["duration"] == 1.5

    # 6. DELETE /api/cover/{folder_name}/{clip_id}
    with open(os.path.join(clip_dir, "cover.jpg"), "w") as f:
        f.write("cover data")
    with open(os.path.join(clip_dir, "thumbnail.jpg"), "w") as f:
        f.write("thumb data")

    res7 = client.delete(f"/api/cover/{folder_name}/{clip_id}")
    assert res7.status_code == 200
    assert not os.path.exists(os.path.join(clip_dir, "cover.jpg"))
    assert os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))


def test_track_face_endpoint_existing_clip_and_cache(client_with_temp_storage, monkeypatch):
    """POST /api/clips/{folder_name}/{clip_id}/track-face generates and caches crop_map.json."""
    from unittest.mock import MagicMock
    client, clips_dir, _ = client_with_temp_storage
    folder_name = "test_vid_tf"
    clip_id = "clip_tf_1"
    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)

    with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
        f.write("dummy video data")

    mock_tracker = MagicMock()
    mock_tracker.analyze_video.return_value = [
        {"time": 0.0, "x": 550},
        {"time": 1.0, "x": 650}
    ]
    monkeypatch.setattr(main.clip_session_store, "face_tracker", mock_tracker)

    # 1. First invocation: computes, saves, and returns crop_map
    res1 = client.post(f"/api/clips/{folder_name}/{clip_id}/track-face")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "ready"
    assert data1["crop_map"] == [
        {"time": 0.0, "x": 550},
        {"time": 1.0, "x": 650}
    ]
    assert mock_tracker.analyze_video.call_count == 1
    assert os.path.exists(os.path.join(clip_dir, "crop_map.json"))

    # 2. Second invocation: reads from cached crop_map.json without re-running tracker
    res2 = client.post(f"/api/clips/{folder_name}/{clip_id}/track-face")
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "ready"
    assert data2["crop_map"] == [
        {"time": 0.0, "x": 550},
        {"time": 1.0, "x": 650}
    ]
    assert mock_tracker.analyze_video.call_count == 1


def test_track_face_endpoint_missing_clip_404(client_with_temp_storage):
    """POST /api/clips/{folder_name}/{clip_id}/track-face returns 404 on missing clip or video."""
    client, _, _ = client_with_temp_storage
    res = client.post("/api/clips/nonexistent_folder/nonexistent_clip/track-face")
    assert res.status_code == 404
    assert "Clip video not found" in res.json()["detail"]


def test_track_face_endpoint_path_traversal_400(client_with_temp_storage):
    """POST /api/clips/{folder_name}/{clip_id}/track-face returns 400 on path traversal."""
    client, _, _ = client_with_temp_storage
    for f_name, c_id in [("folder..", "clip_1"), ("folder_1", "clip.."), ("nul", "clip_1"), ("folder_1", "con")]:
        res = client.post(f"/api/clips/{f_name}/{c_id}/track-face")
        assert res.status_code == 400
        assert "Path traversal detected" in res.json()["detail"]
