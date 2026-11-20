import os
import sys
import inspect
import threading
import anyio
import httpx
import pytest
from fastapi.routing import APIRoute

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

import main


def test_sync_routes_are_not_coroutines_except_explicit_async_routes():
    """Only routes with real awaits stay async def so sync routes run on the threadpool."""
    async_route_names = {
        route.endpoint.__name__
        for route in main.app.routes
        if isinstance(route, APIRoute) and inspect.iscoroutinefunction(route.endpoint)
    }
    assert async_route_names == {"list_releases", "upload_audio_library_item"}


@pytest.mark.anyio
async def test_upload_audio_library_item_offloads_save_item_to_thread(monkeypatch):
    """POST /api/audio-library offloads blocking disk save_item work off the event loop thread."""
    loop_thread_id = threading.current_thread().ident
    calls = []

    def fake_save_item(*, filename, content_bytes, duration=0.0, on_duplicate="prompt"):
        calls.append((threading.current_thread().ident, filename, content_bytes, duration, on_duplicate))
        return {"status": "created", "item": {"id": "a1", "url": "/assets/audio_library/test.mp3"}}

    monkeypatch.setattr(main.audio_library_repository, "save_item", fake_save_item)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        res = await client.post(
            "/api/audio-library",
            files={"file": ("test.mp3", b"ID3dummy", "audio/mpeg")},
            data={"duration": "1.5", "on_duplicate": "prompt"},
        )

    assert res.status_code == 200
    assert len(calls) == 1
    worker_thread_id = calls[0][0]
    assert worker_thread_id is not None
    assert worker_thread_id != loop_thread_id


@pytest.mark.anyio
async def test_sync_blocking_route_does_not_block_event_loop(monkeypatch):
    """A blocking sync route in flight does not freeze concurrent requests on the event loop."""
    entered = threading.Event()
    release = threading.Event()
    result_holder = {}

    def slow_list_ready_clips(active_clip_ids=None):
        entered.set()
        completed = release.wait(timeout=3.0)
        result_holder["timed_out"] = not completed
        return []

    monkeypatch.setattr(main.jobs, "list_active_clip_ids", lambda: set())
    monkeypatch.setattr(main.clip_session_store, "list_ready_clips", slow_list_ready_clips)

    transport = httpx.ASGITransport(app=main.app, client=("127.0.0.1", 51234))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost:8765") as client:
        async def run_slow():
            result_holder["slow_res"] = await client.get("/api/ready-clips")

        try:
            async with anyio.create_task_group() as tg:
                tg.start_soon(run_slow)

                with anyio.fail_after(2.0):
                    while not entered.is_set():
                        await anyio.sleep(0.01)

                with anyio.fail_after(1.0):
                    fast_res = await client.get("/api")

                assert fast_res.status_code == 200
                release.set()
        finally:
            release.set()

    assert result_holder.get("timed_out") is False
    assert result_holder["slow_res"].status_code == 200
    assert result_holder["slow_res"].json() == {"clips": []}
