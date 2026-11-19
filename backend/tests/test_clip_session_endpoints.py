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
    """Configures FastAPI TestClient with isolated temp clips, sources, and output directories."""
    from core.face_tracker import MockFaceTracker

    clips_dir = tmp_path / "temp_assets" / "clips"
    sources_dir = tmp_path / "temp_assets" / "sources"
    output_dir = tmp_path / "temp_assets"
    clips_dir.mkdir(parents=True, exist_ok=True)
    sources_dir.mkdir(parents=True, exist_ok=True)

    mock_tracker = MockFaceTracker(mock_result=[{"time": 0.0, "x": 960}])
    test_store = ClipSessionStore(
        clips_dir=str(clips_dir),
        output_dir=str(output_dir),
        face_tracker=mock_tracker,
    )

    monkeypatch.setattr(main, "clip_session_store", test_store)
    if hasattr(main, "asset_repository"):
        monkeypatch.setattr(main.asset_repository, "clips_dir", str(clips_dir))
        monkeypatch.setattr(main.asset_repository, "source_dir", str(sources_dir))
        monkeypatch.setattr(main.asset_repository, "output_dir", str(output_dir))
    if hasattr(main, "workflow_coordinator"):
        monkeypatch.setattr(main.workflow_coordinator, "clip_session_store", test_store)

    return TestClient(app), str(clips_dir), str(output_dir)


def test_get_clip_session_endpoint_and_healing(client_with_temp_storage):
    """GET /api/clip-session/{folder_name}/{clip_id} returns canonical {status, session} and heals defaults."""
    client, clips_dir, _ = client_with_temp_storage
    folder_name = "test_vid_session"
    clip_id = "clip_0_10"
    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)

    with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
        f.write("dummy video")

    res = client.get(f"/api/clip-session/{folder_name}/{clip_id}")
    assert res.status_code == 200
    data = res.json()

    assert set(data.keys()) == {"status", "session"}
    assert data["status"] == "ok"

    session = data["session"]
    assert session["folder_name"] == folder_name
    assert session["clip_id"] == clip_id
    assert session["transcript"] == []
    assert isinstance(session["style_settings"], dict)
    assert session["style_settings"]["videoLayout"] == "vertical"
    assert session["timeline"] == []
    assert session["history"] == {"undo_stack": [], "redo_stack": []}
    assert isinstance(session["cover_config"], dict)
    assert session["crop_map"] == [{"time": 0.0, "x": 960}]
    assert session["asset_url"] == f"/assets/clips/{folder_name}/{clip_id}/video.mp4"

    assert os.path.exists(os.path.join(clip_dir, "style_settings.json"))
    assert os.path.exists(os.path.join(clip_dir, "cover_config.json"))
    assert os.path.exists(os.path.join(clip_dir, "transcript.json"))


def test_put_clip_session_endpoint_partial_and_complete(client_with_temp_storage):
    """PUT /api/clip-session/{folder_name}/{clip_id} saves canonical partial manifests and returns compact ack."""
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
    assert res1.json() == {"status": "ok", "folder_name": folder_name, "clip_id": clip_id}

    with open(os.path.join(clip_dir, "transcript.json"), "r") as f:
        assert json.load(f) == sample_transcript

    # 2. Partial update: style_settings, timeline, and history
    sample_styles = {"font": "Montserrat", "fontSize": 64, "videoLayout": "portrait"}
    sample_tracks = [{"id": "video", "type": "video", "items": []}]
    sample_history = {"undo_stack": ["u1", "u2"], "redo_stack": []}
    res2 = client.put(f"/api/clip-session/{folder_name}/{clip_id}", json={
        "style_settings": sample_styles,
        "timeline": sample_tracks,
        "history": sample_history,
    })
    assert res2.status_code == 200
    assert res2.json() == {"status": "ok", "folder_name": folder_name, "clip_id": clip_id}

    # 3. Partial update: cover_config and crop_map
    sample_crop = [{"time": 0.0, "x": 960}]
    sample_cover = {"enabled": True, "duration": 2.5, "xOffset": 40}
    res3 = client.put(f"/api/clip-session/{folder_name}/{clip_id}", json={
        "cover_config": sample_cover,
        "crop_map": sample_crop
    })
    assert res3.status_code == 200
    assert res3.json() == {"status": "ok", "folder_name": folder_name, "clip_id": clip_id}

    # Verify via GET /api/clip-session
    get_res = client.get(f"/api/clip-session/{folder_name}/{clip_id}")
    assert get_res.status_code == 200
    session = get_res.json()["session"]
    assert session["transcript"] == sample_transcript
    assert session["style_settings"]["fontSize"] == 64
    assert session["timeline"] == sample_tracks
    assert session["history"] == sample_history
    assert session["cover_config"]["enabled"] is True
    assert session["crop_map"] == sample_crop
    assert not os.path.exists(os.path.join(clip_dir, "thumbnail_config.json"))


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


def test_removed_legacy_routes_and_cover_delete(client_with_temp_storage):
    """Verify removed single-field PUT and /api/cover/config routes are gone while DELETE /api/cover still preserves thumbnail.jpg."""
    client, clips_dir, _ = client_with_temp_storage
    folder_name = "test_vid_cover_del"
    clip_id = "clip_del_1"
    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)

    # Removed routes should return 404 or 405 (caught by SPA fallback on GET, 404/405 on PUT)
    assert client.put("/api/transcript", json={"folder_name": folder_name, "clip_id": clip_id, "transcript": []}).status_code in (404, 405)
    assert client.put("/api/style-settings", json={"folder_name": folder_name, "clip_id": clip_id, "settings": {}}).status_code in (404, 405)
    assert client.put("/api/timeline", json={"folder_name": folder_name, "clip_id": clip_id, "timeline_tracks": []}).status_code in (404, 405)
    assert client.put("/api/timeline-history", json={"folder_name": folder_name, "clip_id": clip_id, "undo_stack": [], "redo_stack": []}).status_code in (404, 405)
    assert client.put("/api/cover/config", json={"folder_name": folder_name, "clip_id": clip_id, "config": {}}).status_code in (404, 405)
    assert client.get(f"/api/cover/config/{folder_name}/{clip_id}").status_code == 404

    with open(os.path.join(clip_dir, "cover.jpg"), "w") as f:
        f.write("cover data")
    with open(os.path.join(clip_dir, "thumbnail.jpg"), "w") as f:
        f.write("thumb data")

    res = client.delete(f"/api/cover/{folder_name}/{clip_id}")
    assert res.status_code == 200
    assert not os.path.exists(os.path.join(clip_dir, "cover.jpg"))
    assert os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))


def test_load_ready_clip_endpoint_returns_unified_session_and_saved_hooks(client_with_temp_storage):
    """POST /api/load-ready-clip returns job metadata, saved_hooks, and canonical session in one round-trip."""
    client, clips_dir, output_dir = client_with_temp_storage
    folder_name = "test_vid_load_ready"
    clip_id = "10_25_viral_hook"

    source_dir = os.path.join(output_dir, "sources", folder_name)
    os.makedirs(source_dir, exist_ok=True)
    with open(os.path.join(source_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump({"video_id": "yt_abc", "title": "Source Title", "fps": 30.0}, f)
    with open(os.path.join(source_dir, "full.mp4"), "w") as f:
        f.write("source video")
    with open(os.path.join(source_dir, "hooks.json"), "w", encoding="utf-8") as f:
        json.dump([{"start": 10.0, "end": 25.0, "theme": "Viral Hook"}], f)
    with open(os.path.join(source_dir, "saved_hooks.json"), "w", encoding="utf-8") as f:
        json.dump([{"id": "saved-1", "theme": "Saved Hook"}], f)

    clip_dir = os.path.join(clips_dir, folder_name, clip_id)
    os.makedirs(clip_dir, exist_ok=True)
    with open(os.path.join(clip_dir, "video.mp4"), "w") as f:
        f.write("clip video")
    with open(os.path.join(clip_dir, "transcript.json"), "w", encoding="utf-8") as f:
        json.dump([{"start": 0.0, "duration": 1.2, "text": "Hello"}], f)

    res = client.post("/api/load-ready-clip", json={
        "folder_name": folder_name,
        "clip_id": clip_id,
    })
    assert res.status_code == 200
    data = res.json()
    assert set(data.keys()) == {"job_id", "status", "clip", "hooks", "saved_hooks", "fps", "session"}
    assert data["status"] == "ready"
    assert data["saved_hooks"] == [{"id": "saved-1", "theme": "Saved Hook"}]
    assert data["session"]["folder_name"] == folder_name
    assert data["session"]["clip_id"] == clip_id
    assert data["session"]["transcript"] == [{"start": 0.0, "duration": 1.2, "text": "Hello"}]
    assert data["session"]["crop_map"] == [{"time": 0.0, "x": 960}]


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



