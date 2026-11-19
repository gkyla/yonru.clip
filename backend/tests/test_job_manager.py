import json
import os
import sys
import threading
import time
from unittest.mock import patch

import pytest

# Path resolution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.job_store import (
    ACTIVE_JOB_STATUSES,
    InMemoryJobStore,
    JSONFileJobStore,
)


class MutableClock:
    def __init__(self, initial: float = 1_700_000_000.0):
        self.now = initial

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> float:
        self.now += seconds
        return self.now


def test_in_memory_job_store_crud_timestamps_and_defensive_copies():
    clock = MutableClock(1000.0)
    store = InMemoryJobStore(clock=clock)

    created = store.create_job("job_1", {"url": "https://example.com/1", "hooks": [{"title": "A"}]})
    assert created["job_id"] == "job_1"
    assert created["status"] == "pending"
    assert created["created_at"] == 1000.0
    assert created["updated_at"] == 1000.0

    # Mutating returned dict must not mutate internal store state
    created["status"] = "hacked"
    created["hooks"].append({"title": "Mutated"})

    fetched = store.get_job("job_1")
    assert fetched is not None
    assert fetched["status"] == "pending"
    assert fetched["hooks"] == [{"title": "A"}]

    # Update advances updated_at while preserving created_at
    clock.advance(25.0)
    updated = store.update_job("job_1", status="ready", progress=100)
    assert updated["created_at"] == 1000.0
    assert updated["updated_at"] == 1025.0
    assert updated["status"] == "ready"
    assert updated["progress"] == 100

    # list_all_jobs returns defensive copies
    all_jobs = store.list_all_jobs()
    assert list(all_jobs.keys()) == ["job_1"]
    all_jobs["job_1"]["status"] = "corrupted"
    assert store["job_1"]["status"] == "ready"

    # Mapping helpers
    assert store["job_1"]["status"] == "ready"
    assert "job_1" in store
    assert len(store) == 1
    assert store.get("missing") is None


def test_json_file_store_single_file_atomic_writes_and_no_save_leaks(tmp_path):
    store_dir = tmp_path / "jobs"
    store = JSONFileJobStore(str(store_dir))

    # Leaky whole-store / raw-dict methods must be removed
    assert not hasattr(store, "save")
    assert not hasattr(store, "items")
    assert not hasattr(store, "values")

    store.create_job("job_a", {"status": "ready"})
    store.create_job("job_b", {"status": "ready"})
    store.create_job("job_c", {"status": "ready"})

    # Externally remove job_a file on disk
    job_a_path = store_dir / "job_a.json"
    os.remove(job_a_path)

    persisted_ids = []
    orig_persist = store._persist_job

    def spy_persist(job_id: str, data: dict) -> None:
        persisted_ids.append(job_id)
        orig_persist(job_id, data)

    with patch.object(store, "_persist_job", side_effect=spy_persist):
        store.update_job("job_b", status="error", error="boom")

    # Updating job_b writes ONLY job_b and never resurrects deleted job_a or rewrites job_c
    assert persisted_ids == ["job_b"]
    assert not job_a_path.exists()
    assert [p.name for p in store_dir.iterdir() if p.suffix == ".tmp"] == []

    # Reload from fresh store verifies persistence of job_b without resurrecting job_a
    reloaded = JSONFileJobStore(str(store_dir))
    assert reloaded.get_job("job_a") is None
    assert reloaded["job_b"]["status"] == "error"
    assert reloaded["job_c"]["status"] == "ready"


def test_set_download_progress_is_pure_in_memory_until_completion(tmp_path):
    store_dir = tmp_path / "jobs"
    store = JSONFileJobStore(str(store_dir))
    store.create_job("dl_job", {"status": "hooks_ready", "download_percent": 0.0})

    with patch.object(store, "_persist_job") as spy_persist:
        for step in range(1, 100):
            store.set_download_progress("dl_job", step + 0.04)
        # Missing job is a safe no-op
        store.set_download_progress("does_not_exist", 50.0)

        assert spy_persist.call_count == 0

    current = store.get_job("dl_job")
    assert current is not None
    assert current["download_percent"] == 99.0

    # Disk still has initial 0.0 until final update_job
    with open(store_dir / "dl_job.json", "r", encoding="utf-8") as f:
        on_disk = json.load(f)
    assert on_disk["download_percent"] == 0.0

    store.update_job("dl_job", status="ready", download_percent=100.0)
    with open(store_dir / "dl_job.json", "r", encoding="utf-8") as f:
        on_disk_after = json.load(f)
    assert on_disk_after["download_percent"] == 100.0
    assert on_disk_after["status"] == "ready"


def test_active_queries_and_zero_stat_syscalls_at_runtime(tmp_path):
    store_dir = tmp_path / "jobs"
    store = JSONFileJobStore(str(store_dir))
    store.create_job("j_cut", {"status": "cutting", "clip_id": "10_20_Hook"})
    store.create_job("j_trans", {"status": "transcribing", "clip": {"clip_id": "30_40_Clip"}})
    store.create_job("j_dl", {"status": "DOWNLOADING_VIDEO", "clip_id": "ignored"})
    store.create_job("j_ready", {"status": "ready", "clip_id": "50_60_Done"})

    with patch("core.job_store.os.path.exists", side_effect=AssertionError("unexpected os.path.exists")), \
         patch("core.job_store.os.stat", side_effect=AssertionError("unexpected os.stat")):
        active_jobs = store.list_active_jobs()
        assert {(j["job_id"], j["status"]) for j in active_jobs} == {
            ("j_cut", "cutting"),
            ("j_trans", "transcribing"),
            ("j_dl", "downloading_video"),
        }

        active_clip_ids = store.list_active_clip_ids()
        assert active_clip_ids == {"10_20_Hook", "30_40_Clip"}

        assert store["j_ready"]["status"] == "ready"
        assert len(store.list_all_jobs()) == 4


def test_cancel_source_jobs_matches_all_location_shapes_and_writes_minimally(tmp_path):
    store_dir = tmp_path / "jobs"
    store = JSONFileJobStore(str(store_dir))
    folder = "Channel_Video_abc123XYZ01"

    store.create_job("by_top_folder", {"status": "queued", "folder_name": folder})
    store.create_job("by_clip_folder", {"status": "cutting", "clip": {"folder_name": folder}})
    store.create_job("by_vi_folder", {"status": "processing", "video_info": {"folder_name": folder}})
    store.create_job("by_vi_path", {
        "status": "generating_hooks",
        "video_info": {"file_path": f"temp_assets/sources/{folder}/full.mp4"},
    })
    store.create_job("by_clip_path", {
        "status": "transcribing",
        "clip_path": f"temp_assets/clips/{folder}/10_20_Hook/video.mp4",
    })
    store.create_job("by_url_id", {"status": "downloading_video", "url": "https://youtube.com/watch?v=abc123XYZ01"})
    store.create_job("terminal_same_source", {"status": "ready", "video_info": {"folder_name": folder}})
    store.create_job("active_other_source", {"status": "cutting", "video_info": {"folder_name": "Other_99999999999"}})

    persisted_ids = []
    orig_persist = store._persist_job

    def spy_persist(job_id: str, data: dict) -> None:
        persisted_ids.append(job_id)
        orig_persist(job_id, data)

    with patch.object(store, "_persist_job", side_effect=spy_persist):
        cancelled_count = store.cancel_source_jobs(folder, reason="Source deleted.", active_only=True)

    assert cancelled_count == 6
    assert set(persisted_ids) == {
        "by_top_folder",
        "by_clip_folder",
        "by_vi_folder",
        "by_vi_path",
        "by_clip_path",
        "by_url_id",
    }
    for jid in persisted_ids:
        job = store.get_job(jid)
        assert job is not None
        assert job["status"] == "cancelled"
        assert job["error"] == "Source deleted."

    assert store["terminal_same_source"]["status"] == "ready"
    assert store["active_other_source"]["status"] == "cutting"

    # active_only=False also cancels already-terminal matching jobs
    assert store.cancel_source_jobs(folder, reason="Purged.", active_only=False) == 7
    assert store["terminal_same_source"]["status"] == "cancelled"


def test_sync_source_hooks_persists_matching_jobs_safely(tmp_path):
    store_dir = tmp_path / "jobs"
    store = JSONFileJobStore(str(store_dir))
    folder = "Demo_Vid_12345678901"

    store.create_job("match_job", {"status": "ready", "video_info": {"folder_name": folder}, "hooks": []})
    store.create_job("other_job", {"status": "ready", "video_info": {"folder_name": "Other_00000000000"}, "hooks": [{"id": "keep"}]})

    persisted = []
    orig_persist = store._persist_job
    with patch.object(store, "_persist_job", side_effect=lambda jid, d: (persisted.append(jid), orig_persist(jid, d))):
        new_hooks = [{"id": "h1", "theme": "Updated"}]
        count = store.sync_source_hooks(folder, new_hooks)
        new_hooks.append({"id": "mutated_after_call"})

    assert count == 1
    assert persisted == ["match_job"]
    assert store["match_job"]["hooks"] == [{"id": "h1", "theme": "Updated"}]
    assert store["other_job"]["hooks"] == [{"id": "keep"}]

    reloaded = JSONFileJobStore(str(store_dir))
    assert reloaded["match_job"]["hooks"] == [{"id": "h1", "theme": "Updated"}]


def test_startup_orphan_recovery_reconciles_interrupted_active_jobs(tmp_path):
    store_dir = tmp_path / "jobs"
    store_dir.mkdir()

    with open(store_dir / "orphan_transcribe.json", "w", encoding="utf-8") as f:
        json.dump({"job_id": "orphan_transcribe", "status": "transcribing"}, f)
    with open(store_dir / "orphan_dl.json", "w", encoding="utf-8") as f:
        json.dump({"job_id": "orphan_dl", "status": "downloading_video"}, f)
    with open(store_dir / "done.json", "w", encoding="utf-8") as f:
        json.dump({"job_id": "done", "status": "ready"}, f)

    clock = MutableClock(2_000_000.0)
    store = JSONFileJobStore(str(store_dir), clock=clock)

    assert store.list_active_jobs() == []
    assert store.list_active_clip_ids() == set()

    for orphan_id in ("orphan_transcribe", "orphan_dl"):
        job = store.get_job(orphan_id)
        assert job is not None
        assert job["status"] == "error"
        assert job["error"] == "Interrupted by server restart"
        assert job["updated_at"] == 2_000_000.0

        with open(store_dir / f"{orphan_id}.json", "r", encoding="utf-8") as f:
            on_disk = json.load(f)
        assert on_disk["status"] == "error"
        assert on_disk["error"] == "Interrupted by server restart"

    assert store["done"]["status"] == "ready"


def test_retention_pruning_ttl_cap_legacy_mtime_and_active_protection(tmp_path):
    store_dir = tmp_path / "jobs"
    store_dir.mkdir()

    # Legacy file without updated_at/created_at using old file mtime
    legacy_old = store_dir / "legacy_old.json"
    legacy_old.write_text(json.dumps({"job_id": "legacy_old", "status": "ready"}), encoding="utf-8")
    os.utime(legacy_old, (100.0, 100.0))

    clock = MutableClock(1000.0)
    # 500s TTL -> legacy_old (age 900s) is pruned immediately on startup
    store = JSONFileJobStore(str(store_dir), max_age_seconds=500.0, max_completed_jobs=3, clock=clock)
    assert store.get_job("legacy_old") is None
    assert not legacy_old.exists()

    # Create an active job at t=1000 (must never be pruned by TTL or cap)
    store.create_job("active_keep", {"status": "cutting"})

    # Create 4 completed jobs at staggered timestamps (1010, 1020, 1030, 1040)
    for idx in range(4):
        clock.advance(10.0)
        store.create_job(f"done_{idx}", {"status": "ready"})

    # Cap is 3 completed jobs -> done_0 (oldest) should be pruned, active_keep untouched
    assert store.get_job("done_0") is None
    assert not (store_dir / "done_0.json").exists()
    assert store.get_job("done_1") is not None
    assert store.get_job("done_2") is not None
    assert store.get_job("done_3") is not None
    assert store.get_job("active_keep") is not None

    # Advance past TTL for done_1/done_2 (done_1 @1020, done_2 @1030, done_3 @1040, active_keep @1000)
    clock.now = 1535.0  # ages: active_keep=535 (>500, active!), done_1=515, done_2=505, done_3=495
    pruned = store.prune_expired()
    assert pruned == 2
    assert store.get_job("done_1") is None
    assert store.get_job("done_2") is None
    assert store.get_job("done_3") is not None
    assert store.get_job("active_keep") is not None


def test_path_traversal_blocked_on_writes_and_safe_on_delete(tmp_path):
    store_dir = tmp_path / "jobs"
    store = JSONFileJobStore(str(store_dir))

    for bad_id in ("../evil", "sub/dir", "sub\\dir", "..", "", "bad\0id"):
        with pytest.raises(ValueError):
            store.create_job(bad_id, {"status": "pending"})
        with pytest.raises(ValueError):
            store.update_job(bad_id, status="ready")

    outside = tmp_path / "outside.json"
    outside.write_text('{"keep": true}', encoding="utf-8")

    # delete_job on traversal path must not raise or delete files outside store_dir
    store.delete_job("../outside")
    assert outside.exists()


def test_job_store_deletion_and_legacy_monolithic_migration(tmp_path):
    # Test InMemoryJobStore deletion
    mem_store = InMemoryJobStore()
    mem_store.create_job("job_mem", {"status": "ready"})
    assert "job_mem" in mem_store
    mem_store.delete_job("job_mem")
    assert "job_mem" not in mem_store

    # Test legacy jobs.json migration to per-job directory
    legacy_file = tmp_path / "jobs.json"
    legacy_file.write_text(json.dumps({"migrated_1": {"status": "ready"}}), encoding="utf-8")
    store_dir = tmp_path / "jobs"

    file_store = JSONFileJobStore(str(store_dir))
    assert file_store["migrated_1"]["status"] == "ready"
    assert (store_dir / "migrated_1.json").exists()
    assert (tmp_path / "jobs.json.bak").exists()

    file_store.delete_job("migrated_1")
    assert "migrated_1" not in file_store
    assert not (store_dir / "migrated_1.json").exists()


def test_thread_safety_concurrent_updates_and_queries(tmp_path):
    store = JSONFileJobStore(str(tmp_path / "jobs"))
    store.create_job("concurrent_job", {"status": "downloading_video", "download_percent": 0.0})
    errors = []

    def writer(worker_id: int):
        try:
            for i in range(40):
                store.set_download_progress("concurrent_job", float(i))
                store.update_job("concurrent_job", **{f"worker_{worker_id}": i})
                time.sleep(0.0005)
        except Exception as exc:
            errors.append(exc)

    def reader():
        try:
            for _ in range(40):
                job = store.get_job("concurrent_job")
                assert job is not None
                active = store.list_active_jobs()
                assert len(active) == 1
                time.sleep(0.0005)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=writer, args=(idx,)) for idx in range(4)] + [
        threading.Thread(target=reader) for _ in range(2)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    final_job = store.get_job("concurrent_job")
    assert final_job is not None
    for idx in range(4):
        assert final_job[f"worker_{idx}"] == 39
    assert "downloading_video" in ACTIVE_JOB_STATUSES


@pytest.mark.anyio
async def test_api_ready_clips_excludes_active_clip_jobs(tmp_path, monkeypatch):
    """GET /api/ready-clips filters out clips currently active in JobStore."""
    import httpx
    import main
    from core.clip_session_store import ClipSessionStore
    from core.media_transcoder import FakeMediaAdapter, MediaTranscoder

    store_dir = tmp_path / "jobs"
    job_store = JSONFileJobStore(str(store_dir))
    job_store.create_job("active_cut_job", {"status": "cutting", "clip_id": "10_20_active"})
    job_store.create_job("done_job", {"status": "ready", "clip_id": "30_40_done"})

    clips_dir = tmp_path / "clips"
    active_dir = clips_dir / "source_folder" / "10_20_active"
    done_dir = clips_dir / "source_folder" / "30_40_done"
    active_dir.mkdir(parents=True)
    done_dir.mkdir(parents=True)
    active_vid = active_dir / "video.mp4"
    done_vid = done_dir / "video.mp4"
    active_vid.write_text("dummy", encoding="utf-8")
    done_vid.write_text("dummy", encoding="utf-8")

    adapter = FakeMediaAdapter()
    adapter.probe_overrides[str(active_vid)] = {"format": {"duration": "10.0"}, "streams": []}
    adapter.probe_overrides[str(done_vid)] = {"format": {"duration": "10.0"}, "streams": []}
    clip_store = ClipSessionStore(
        clips_dir=str(clips_dir),
        output_dir=str(tmp_path),
        media_transcoder=MediaTranscoder(adapter=adapter),
    )

    monkeypatch.setattr(main, "jobs", job_store)
    monkeypatch.setattr(main, "clip_session_store", clip_store)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        res = await client.get("/api/ready-clips")

    assert res.status_code == 200
    clips = res.json()["clips"]
    assert [c["clip_id"] for c in clips] == ["30_40_done"]


@pytest.mark.anyio
async def test_api_put_hooks_persists_through_job_store_across_reload(tmp_path, monkeypatch):
    """PUT /api/hooks updates and atomically persists hooks on matching jobs across store reload."""
    import httpx
    import main

    store_dir = tmp_path / "jobs"
    job_store = JSONFileJobStore(str(store_dir))
    folder = "Creator_Title_abc123XYZ01"
    job_store.create_job("match_1", {"status": "ready", "video_info": {"folder_name": folder}, "hooks": []})
    job_store.create_job("other_1", {"status": "ready", "video_info": {"folder_name": "Other_99999999999"}, "hooks": [{"id": "keep"}]})

    monkeypatch.setattr(main, "jobs", job_store)
    monkeypatch.setattr(main.asset_repository, "update_source_hooks", lambda f_name, hooks: f_name == folder)

    updated_hooks = [{"id": "h1", "theme": "Renamed Hook", "start": 5.0, "end": 25.0}]
    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        res = await client.put("/api/hooks", json={"folder_name": folder, "hooks": updated_hooks})

    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

    reloaded = JSONFileJobStore(str(store_dir))
    assert reloaded["match_1"]["hooks"] == updated_hooks
    assert reloaded["other_1"]["hooks"] == [{"id": "keep"}]
