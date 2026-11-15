import os
import sys
import httpx
import pytest

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import main
from core.job_store import InMemoryJobStore
from core.self_update_service import (
    FakeGitPort,
    FakeSupervisorPort,
    RenderActivityTracker,
    SelfUpdateService,
)


@pytest.mark.anyio
async def test_preflight_passes_when_supervised_clean_main_ancestor_and_idle(tmp_path, monkeypatch):
    """GET /api/self-update/preflight reports ready when supervised, clean on main, tag is ff ancestor, and idle."""
    git_port = FakeGitPort(
        branch="main",
        head_commit="1111111",
        dirty_files=[],
        tags={"v0.4.0": "2222222"},
        ancestors={("1111111", "refs/tags/v0.4.0"): True},
    )
    supervisor_port = FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=True, dev_mode=False)
    job_store = InMemoryJobStore()
    render_tracker = RenderActivityTracker()

    service = SelfUpdateService(
        current_version="0.3.0",
        git_port=git_port,
        supervisor_port=supervisor_port,
        job_store=job_store,
        render_tracker=render_tracker,
    )
    monkeypatch.setattr(main, "self_update_service", service)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        res = await client.get("/api/self-update/preflight?target_version=0.4.0")

    assert res.status_code == 200
    body = res.json()
    assert body["supported"] is True
    assert body["canUpdate"] is True
    assert body["currentVersion"] == "0.3.0"
    assert body["targetVersion"] == "0.4.0"
    assert body["targetTag"] == "v0.4.0"
    assert body["branch"] == "main"
    assert body["initialCommit"] == "1111111"
    assert body["blockingReason"] is None
    assert body["dirtyFiles"] == []
    assert body["activeJobs"] == []
    assert body["activeRenders"] == 0
    assert body["manualCommand"] == "git fetch origin --tags && git merge --ff-only v0.4.0 && python run.py"
    assert all(check["passed"] is True for check in body["checks"])


@pytest.mark.anyio
async def test_preflight_blocks_while_render_endpoint_or_pipeline_job_is_active(tmp_path, monkeypatch):
    """Pre-flight must block while an MP4 render or pipeline job is running and unblock once finished."""
    git_port = FakeGitPort(
        branch="main",
        head_commit="1111111",
        dirty_files=[],
        tags={"v0.4.0": "2222222"},
        ancestors={("1111111", "refs/tags/v0.4.0"): True},
    )
    supervisor_port = FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=True)
    job_store = InMemoryJobStore()
    render_tracker = RenderActivityTracker()
    service = SelfUpdateService(
        current_version="0.3.0",
        git_port=git_port,
        supervisor_port=supervisor_port,
        job_store=job_store,
        render_tracker=render_tracker,
    )
    monkeypatch.setattr(main, "self_update_service", service)
    monkeypatch.setattr(main, "render_activity_tracker", render_tracker)

    job_store.create_job("job-ready", {"status": "ready"})
    preflight_during_render = {}

    class StubRenderEngine:
        def render(self, job, req, output_name=None):
            nonlocal preflight_during_render
            preflight_during_render = service.preflight("0.4.0")
            return {"output_url": "/static/output/out.mp4"}

    monkeypatch.setattr(main, "jobs", job_store)
    monkeypatch.setattr(main, "render_engine", StubRenderEngine())

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        render_res = await client.post(
            "/api/render",
            json={"job_id": "job-ready", "hook_index": 0},
        )
        assert render_res.status_code == 200
        assert preflight_during_render["canUpdate"] is False
        assert preflight_during_render["activeRenders"] == 1

        after_render = (await client.get("/api/self-update/preflight?target_version=0.4.0")).json()
        assert after_render["canUpdate"] is True
        assert after_render["activeRenders"] == 0

        # Active pipeline job also blocks pre-flight
        job_store.create_job("job-busy", {"status": "downloading_video"})
        during_job = (await client.get("/api/self-update/preflight?target_version=0.4.0")).json()
        assert during_job["canUpdate"] is False
        assert during_job["activeJobs"] == [{"jobId": "job-busy", "status": "downloading_video"}]


@pytest.mark.anyio
async def test_preflight_ignores_prompt_json_but_blocks_dirty_files_non_main_and_standalone(tmp_path, monkeypatch):
    """Pre-flight exempts legacy tracked prompt.json edits while blocking other dirty files, non-main, and standalone mode."""
    # 1. Legacy tracked backend/prompts/prompt.json edit alone must NOT block update
    git_prompt_only = FakeGitPort(
        branch="main",
        head_commit="1111111",
        dirty_files=["backend/prompts/prompt.json"],
        tags={"v0.4.0": "2222222"},
        ancestors={("1111111", "refs/tags/v0.4.0"): True},
    )
    service = SelfUpdateService(
        current_version="0.3.0",
        git_port=git_prompt_only,
        supervisor_port=FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=True),
        job_store=InMemoryJobStore(),
        render_tracker=RenderActivityTracker(),
    )
    monkeypatch.setattr(main, "self_update_service", service)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        res_clean = await client.get("/api/self-update/preflight?target_version=v0.4.0")
        assert res_clean.status_code == 200
        assert res_clean.json()["canUpdate"] is True
        assert res_clean.json()["dirtyFiles"] == []

        # 2. Other tracked modifications block update and surface dirtyFiles list
        git_dirty = FakeGitPort(
            branch="feat/local-experiment",
            head_commit="1111111",
            dirty_files=["backend/prompts/prompt.json", "backend/main.py"],
            tags={"v0.4.0": "2222222"},
            ancestors={("1111111", "refs/tags/v0.4.0"): False},
        )
        monkeypatch.setattr(
            main,
            "self_update_service",
            SelfUpdateService(
                current_version="0.3.0",
                git_port=git_dirty,
                supervisor_port=FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=False),
                job_store=InMemoryJobStore(),
                render_tracker=RenderActivityTracker(),
            ),
        )
        res_blocked = await client.get("/api/self-update/preflight?target_version=0.4.0")
        assert res_blocked.status_code == 200
        blocked = res_blocked.json()
        assert blocked["supported"] is False
        assert blocked["canUpdate"] is False
        assert blocked["dirtyFiles"] == ["backend/main.py"]
        failed_ids = {c["id"] for c in blocked["checks"] if not c["passed"]}
        assert failed_ids == {"supervisor", "branch", "clean_tree", "target_tag"}


@pytest.mark.anyio
async def test_trigger_self_update_signals_supervisor_and_enforces_single_flight(tmp_path, monkeypatch):
    """POST /api/self-update writes IPC request/status and rejects concurrent triggers with 409."""
    git_port = FakeGitPort(
        branch="main",
        head_commit="1111111",
        dirty_files=[],
        tags={"v0.4.0": "2222222"},
        ancestors={("1111111", "refs/tags/v0.4.0"): True},
    )
    supervisor_port = FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=True, dev_mode=True)
    service = SelfUpdateService(
        current_version="0.3.0",
        git_port=git_port,
        supervisor_port=supervisor_port,
        job_store=InMemoryJobStore(),
        render_tracker=RenderActivityTracker(),
    )
    monkeypatch.setattr(main, "self_update_service", service)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        res = await client.post(
            "/api/self-update",
            json={"targetVersion": "0.4.0"},
            headers={"Origin": "http://localhost:3765"},
        )
        assert res.status_code == 202
        body = res.json()
        assert body["state"] == "pending_restart"
        assert body["targetVersion"] == "0.4.0"
        assert body["targetTag"] == "v0.4.0"
        assert body["initialCommit"] == "1111111"
        assert supervisor_port.request is not None
        assert supervisor_port.request["targetTag"] == "v0.4.0"
        assert supervisor_port.request["initialCommit"] == "1111111"

        # Second trigger while update request is pending must be rejected (single-flight)
        dup = await client.post(
            "/api/self-update",
            json={"targetVersion": "0.4.0"},
            headers={"Origin": "http://localhost:3765"},
        )
        assert dup.status_code == 409


@pytest.mark.anyio
async def test_trigger_self_update_rejects_remote_ip_and_untrusted_origin(tmp_path, monkeypatch):
    """POST /api/self-update rejects non-loopback clients and untrusted Origin/Referer headers with 403."""
    git_port = FakeGitPort(
        branch="main",
        head_commit="1111111",
        dirty_files=[],
        tags={"v0.4.0": "2222222"},
        ancestors={("1111111", "refs/tags/v0.4.0"): True},
    )
    supervisor_port = FakeSupervisorPort(ipc_dir=str(tmp_path), supervised=True)
    service = SelfUpdateService(
        current_version="0.3.0",
        git_port=git_port,
        supervisor_port=supervisor_port,
        job_store=InMemoryJobStore(),
        render_tracker=RenderActivityTracker(),
    )
    monkeypatch.setattr(main, "self_update_service", service)

    # 1. Remote LAN client rejected even with local Origin header
    remote_transport = httpx.ASGITransport(app=main.app, client=("192.168.1.44", 51234))
    async with httpx.AsyncClient(transport=remote_transport, base_url="http://192.168.1.10:8765") as remote_client:
        remote_res = await remote_client.post(
            "/api/self-update",
            json={"targetVersion": "0.4.0"},
            headers={"Origin": "http://localhost:3765"},
        )
        assert remote_res.status_code == 403
        assert supervisor_port.request is None

    # 2. Loopback client with external or null Origin rejected
    local_transport = httpx.ASGITransport(app=main.app, client=("::1", 51234))
    async with httpx.AsyncClient(transport=local_transport, base_url="http://localhost:8765") as local_client:
        bad_origin = await local_client.post(
            "/api/self-update",
            json={"targetVersion": "0.4.0"},
            headers={"Origin": "https://evil.example"},
        )
        assert bad_origin.status_code == 403

        null_origin = await local_client.post(
            "/api/self-update",
            json={"targetVersion": "0.4.0"},
            headers={"Origin": "null"},
        )
        assert null_origin.status_code == 403
        assert supervisor_port.request is None


@pytest.mark.anyio
async def test_status_promotes_completed_after_restart_and_acknowledge_clears(tmp_path, monkeypatch):
    """GET /api/self-update/status promotes restarting->completed on matching version and POST acknowledge resets to idle."""
    git_port = FakeGitPort(branch="main", head_commit="2222222")
    supervisor_port = FakeSupervisorPort(
        ipc_dir=str(tmp_path),
        supervised=True,
        initial_status={
            "updateId": "upd-1",
            "state": "restarting",
            "step": "restarting",
            "message": "Restarting Yonru...",
            "currentVersion": "0.3.0",
            "targetVersion": "0.4.0",
            "targetTag": "v0.4.0",
            "rolledBack": False,
            "error": None,
            "steps": [{"id": "restarting", "label": "Restarting Yonru", "status": "active"}],
        },
    )
    service = SelfUpdateService(
        current_version="0.4.0",
        git_port=git_port,
        supervisor_port=supervisor_port,
        job_store=InMemoryJobStore(),
        render_tracker=RenderActivityTracker(),
    )
    monkeypatch.setattr(main, "self_update_service", service)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        status_res = await client.get("/api/self-update/status")
        assert status_res.status_code == 200
        status_body = status_res.json()
        assert status_body["state"] == "completed"
        assert status_body["currentVersion"] == "0.4.0"
        assert status_body["targetVersion"] == "0.4.0"

        ack_res = await client.post("/api/self-update/acknowledge")
        assert ack_res.status_code == 200
        assert ack_res.json()["state"] == "idle"

        after_ack = (await client.get("/api/self-update/status")).json()
        assert after_ack["state"] == "idle"


def test_platform_git_port_inspects_real_repo_and_exempts_prompt_json(tmp_path):
    """PlatformGitPort inspects branch, dirty tracked files (exempting prompt.json), tags, and ff ancestors."""
    import subprocess
    from core.self_update_service import PlatformGitPort

    def git(*args):
        return subprocess.run(
            ["git", *args],
            cwd=str(tmp_path),
            check=True,
            capture_output=True,
            text=True,
        )

    git("init", "-b", "main")
    git("config", "user.email", "test@yonru.local")
    git("config", "user.name", "Test")

    prompts_dir = tmp_path / "backend" / "prompts"
    prompts_dir.mkdir(parents=True)
    prompt_file = prompts_dir / "prompt.json"
    prompt_file.write_text('[{"promptName": "Default"}]', encoding="utf-8")
    app_file = tmp_path / "app.py"
    app_file.write_text("v1\n", encoding="utf-8")

    git("add", ".")
    git("commit", "-m", "init")
    c1 = git("rev-parse", "HEAD").stdout.strip()

    app_file.write_text("v2\n", encoding="utf-8")
    git("add", "app.py")
    git("commit", "-m", "v0.4.0")
    git("tag", "-a", "v0.4.0", "-m", "Release 0.4.0")

    # Reset working tree back to c1 so v0.4.0 is strictly ahead
    git("reset", "--hard", c1)

    port = PlatformGitPort(str(tmp_path))
    assert port.get_current_branch() == "main"
    assert port.get_head_commit() == c1
    assert port.get_dirty_files() == []
    assert port.resolve_tag_commit("v0.4.0") is not None
    assert port.is_ancestor(c1, "refs/tags/v0.4.0") is True

    # Untracked files do not count as dirty; prompt.json modification is exempted; app.py modification blocks
    (tmp_path / "untracked.txt").write_text("hi", encoding="utf-8")
    prompt_file.write_text('[{"promptName": "Edited"}]', encoding="utf-8")
    assert port.get_dirty_files() == []

    app_file.write_text("dirty\n", encoding="utf-8")
    assert port.get_dirty_files() == ["app.py"]
