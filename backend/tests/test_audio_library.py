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
def audio_library_client(tmp_path, monkeypatch):
    """Configures FastAPI TestClient with isolated temp_assets for AudioLibraryRepository and ClipSessionStore."""
    from core.audio_library_repository import AudioLibraryRepository

    output_dir = tmp_path / "temp_assets"
    clips_dir = output_dir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    test_clip_store = ClipSessionStore(clips_dir=str(clips_dir), output_dir=str(output_dir))
    test_audio_repo = AudioLibraryRepository(output_dir=str(output_dir), clip_session_store=test_clip_store)

    monkeypatch.setattr(main, "clip_session_store", test_clip_store)
    monkeypatch.setattr(main, "audio_library_repository", test_audio_repo, raising=False)

    return TestClient(app), test_audio_repo, str(clips_dir), str(output_dir)


def test_upload_and_list_audio_library_items(audio_library_client):
    """Uploading a valid audio file persists it in the workspace Audio Library and lists it via GET /api/audio-library."""
    client, _, _, output_dir = audio_library_client

    # Initial list is empty
    res_empty = client.get("/api/audio-library")
    assert res_empty.status_code == 200
    assert res_empty.json() == {"status": "ok", "items": []}

    # Upload a new audio file
    dummy_mp3 = b"ID3\x03\x00\x00\x00\x00\x00\x0fdummy_audio_bytes"
    res_upload = client.post(
        "/api/audio-library",
        files={"file": ("whoosh_intro.mp3", dummy_mp3, "audio/mpeg")},
        data={"duration": "2.45", "on_duplicate": "prompt"},
    )
    assert res_upload.status_code == 200
    payload = res_upload.json()
    assert payload["status"] == "created"
    item = payload["item"]
    assert item["name"] == "whoosh_intro.mp3"
    assert item["duration"] == pytest.approx(2.45)
    assert item["url"].startswith("/assets/audio_library/")
    assert item["size"] == len(dummy_mp3)

    # Verify file exists on disk in audio_library directory
    rel_filename = item["url"].replace("/assets/audio_library/", "")
    saved_file_path = os.path.join(output_dir, "audio_library", rel_filename)
    assert os.path.exists(saved_file_path)

    # List returns the newly saved item
    res_list = client.get("/api/audio-library")
    assert res_list.status_code == 200
    items = res_list.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == item["id"]
    assert items[0]["name"] == "whoosh_intro.mp3"


def test_duplicate_detection_prompt_replace_and_use_existing(audio_library_client):
    """Duplicate uploads return status='duplicate' on prompt, preserve existing on use_existing, and overwrite on replace."""
    client, _, _, output_dir = audio_library_client

    original_bytes = b"ID3_ORIGINAL_AUDIO_CONTENT"
    res1 = client.post(
        "/api/audio-library",
        files={"file": ("ding.mp3", original_bytes, "audio/mpeg")},
        data={"duration": "1.2", "on_duplicate": "prompt"},
    )
    assert res1.status_code == 200
    orig_item = res1.json()["item"]

    # 1. Uploading same filename with different content under on_duplicate='prompt' triggers duplicate status without overwriting
    modified_bytes = b"ID3_MODIFIED_AUDIO_CONTENT_LONGER"
    res_dup = client.post(
        "/api/audio-library",
        files={"file": ("ding.mp3", modified_bytes, "audio/mpeg")},
        data={"duration": "3.5", "on_duplicate": "prompt"},
    )
    assert res_dup.status_code == 200
    dup_payload = res_dup.json()
    assert dup_payload["status"] == "duplicate"
    assert dup_payload["item"]["id"] == orig_item["id"]
    assert dup_payload["item"]["size"] == len(original_bytes)

    # Verify disk file was NOT overwritten during prompt check
    saved_path = os.path.join(output_dir, "audio_library", orig_item["filename"])
    with open(saved_path, "rb") as f:
        assert f.read() == original_bytes

    # 2. Choosing on_duplicate='use_existing' returns the existing item untouched
    res_existing = client.post(
        "/api/audio-library",
        files={"file": ("ding.mp3", modified_bytes, "audio/mpeg")},
        data={"duration": "3.5", "on_duplicate": "use_existing"},
    )
    assert res_existing.status_code == 200
    assert res_existing.json()["status"] == "existing"
    assert res_existing.json()["item"]["size"] == len(original_bytes)

    # 3. Choosing on_duplicate='replace' overwrites the file and updates metadata without creating a second catalog entry
    res_replace = client.post(
        "/api/audio-library",
        files={"file": ("ding.mp3", modified_bytes, "audio/mpeg")},
        data={"duration": "3.5", "on_duplicate": "replace"},
    )
    assert res_replace.status_code == 200
    rep_payload = res_replace.json()
    assert rep_payload["status"] == "replaced"
    assert rep_payload["item"]["id"] == orig_item["id"]
    assert rep_payload["item"]["size"] == len(modified_bytes)
    assert rep_payload["item"]["duration"] == pytest.approx(3.5)

    with open(saved_path, "rb") as f:
        assert f.read() == modified_bytes

    items = client.get("/api/audio-library").json()["items"]
    assert len(items) == 1

    # 4. Rejects disallowed video container format (.mp4)
    res_bad = client.post(
        "/api/audio-library",
        files={"file": ("video.mp4", b"fake_mp4", "video/mp4")},
        data={"duration": "5.0"},
    )
    assert res_bad.status_code == 400


def test_delete_audio_library_item_with_safe_reference_cleanup(audio_library_client):
    """Deleting an unreferenced item removes the disk file; deleting a clip-referenced item removes it from catalog but retains disk file."""
    client, _, clips_dir, output_dir = audio_library_client

    # Upload two items: unreferenced_sfx.mp3 and referenced_bgm.mp3
    res_unref = client.post(
        "/api/audio-library",
        files={"file": ("unreferenced_sfx.mp3", b"UNREF_BYTES", "audio/mpeg")},
        data={"duration": "1.0"},
    )
    unref_item = res_unref.json()["item"]

    res_ref = client.post(
        "/api/audio-library",
        files={"file": ("referenced_bgm.mp3", b"REF_BGM_BYTES", "audio/mpeg")},
        data={"duration": "15.0"},
    )
    ref_item = res_ref.json()["item"]

    # Seed a saved clip session whose timeline references referenced_bgm.mp3
    clip_dir = os.path.join(clips_dir, "sample_source", "clip_10_25")
    os.makedirs(clip_dir, exist_ok=True)
    with open(os.path.join(clip_dir, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(
            [
                {
                    "id": "audio",
                    "name": "Audio",
                    "type": "audio",
                    "items": [
                        {
                            "id": "aud-1",
                            "type": "audio",
                            "name": "referenced_bgm.mp3",
                            "src": f"http://localhost:8000{ref_item['url']}",
                            "start": 0.0,
                            "duration": 10.0,
                        }
                    ],
                }
            ],
            f,
        )

    # 1. Delete unreferenced item -> removed from catalog AND disk file removed
    del_unref = client.delete(f"/api/audio-library/{unref_item['id']}")
    assert del_unref.status_code == 200
    assert del_unref.json()["status"] == "deleted"
    assert del_unref.json()["file_retained"] is False
    assert not os.path.exists(os.path.join(output_dir, "audio_library", unref_item["filename"]))

    # 2. Delete referenced item -> removed from catalog, but disk file retained for Clip A integrity
    del_ref = client.delete(f"/api/audio-library/{ref_item['id']}")
    assert del_ref.status_code == 200
    assert del_ref.json()["status"] == "deleted"
    assert del_ref.json()["file_retained"] is True
    assert os.path.exists(os.path.join(output_dir, "audio_library", ref_item["filename"]))

    # Catalog is now completely empty
    assert client.get("/api/audio-library").json()["items"] == []

    # 3. Uploading a new file with the same name as a retained clip-referenced file disambiguates the filename instead of overwriting Clip A's file
    res_new_same_name = client.post(
        "/api/audio-library",
        files={"file": ("referenced_bgm.mp3", b"NEW_DIFFERENT_BGM_BYTES", "audio/mpeg")},
        data={"duration": "20.0"},
    )
    assert res_new_same_name.status_code == 200
    new_item = res_new_same_name.json()["item"]
    assert new_item["filename"] != ref_item["filename"]
    with open(os.path.join(output_dir, "audio_library", ref_item["filename"]), "rb") as f:
        assert f.read() == b"REF_BGM_BYTES"


def test_staged_render_context_stages_and_cleans_up_audio_library_files(tmp_path):
    """StagedRenderContext copies local audio_library assets into Remotion public/ and cleans them up on exit."""
    from core.render_engine import RenderComposition, StagedRenderContext

    assets_dir = tmp_path / "temp_assets"
    audio_lib_dir = assets_dir / "audio_library"
    audio_lib_dir.mkdir(parents=True, exist_ok=True)
    audio_file = audio_lib_dir / "swoosh.mp3"
    audio_file.write_bytes(b"SWOOSH_AUDIO_BYTES")

    dummy_video = tmp_path / "source.mp4"
    dummy_video.write_bytes(b"DUMMY_VIDEO")

    output_dir = tmp_path / "output"
    remotion_public = tmp_path / "remotion_public"

    comp = RenderComposition(
        original_video=str(dummy_video),
        crop_center_x=960,
        timeline_audio_items=[
            {
                "id": "aud-lib-1",
                "type": "audio",
                "name": "swoosh.mp3",
                "src": "http://localhost:8000/assets/audio_library/swoosh.mp3",
                "start": 0.0,
                "duration": 2.0,
            }
        ],
    )

    ctx = StagedRenderContext(comp, out_filename="clip_test.mp4", output_dir=str(output_dir))
    ctx.public_dir = str(remotion_public)
    ctx.audio_library_dir = str(audio_lib_dir)

    with ctx:
        assert ctx.props_path is not None
        with open(ctx.props_path, "r", encoding="utf-8") as f:
            props = json.load(f)
        staged_audio_items = props["timelineAudioItems"]
        assert len(staged_audio_items) == 1
        staged_src = staged_audio_items[0]["src"]
        assert staged_src.startswith("audio_clip_test.mp4_")
        staged_file_on_disk = remotion_public / staged_src
        assert staged_file_on_disk.exists()
        assert staged_file_on_disk.read_bytes() == b"SWOOSH_AUDIO_BYTES"

    # After context exit, staged audio file is cleaned up
    assert not (remotion_public / staged_src).exists()



