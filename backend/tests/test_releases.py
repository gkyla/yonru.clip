import json
import os
import sys
import httpx
import pytest
from fastapi.testclient import TestClient

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from core.release_service import ReleaseService


@pytest.mark.anyio
async def test_release_service_normalizes_and_filters_stable_releases(tmp_path):
    """Filters out drafts, prereleases, and non-semver tags while sorting SemVer descending."""
    sample_payload = [
        {
            "tag_name": "v0.4.0",
            "name": "Release v0.4.0",
            "body": "### Features\n\n- Remote discovery",
            "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0",
            "published_at": "2026-11-15T10:00:00Z",
            "draft": False,
            "prerelease": False,
        },
        {
            "tag_name": "v0.10.0",
            "name": "Release v0.10.0",
            "body": "### Improvements\n\n- Big milestone",
            "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.10.0",
            "published_at": "2026-11-20T10:00:00Z",
            "draft": False,
            "prerelease": False,
        },
        {
            "tag_name": "v0.5.0-rc.1",
            "name": "RC 1",
            "body": "Prerelease",
            "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.5.0-rc.1",
            "published_at": "2026-11-18T10:00:00Z",
            "draft": False,
            "prerelease": True,
        },
        {
            "tag_name": "v0.6.0",
            "name": "Draft Release",
            "body": "Draft",
            "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.6.0",
            "published_at": "2026-11-19T10:00:00Z",
            "draft": True,
            "prerelease": False,
        },
        {
            "tag_name": "nightly-build",
            "name": "Nightly",
            "body": "Non semver",
            "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/nightly-build",
            "published_at": "2026-11-21T10:00:00Z",
            "draft": False,
            "prerelease": False,
        },
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/repos/gkyla/yonru.clip/releases"
        return httpx.Response(200, json=sample_payload, headers={"ETag": '"etag-1"'})

    service = ReleaseService(
        current_version="0.3.0",
        cache_path=str(tmp_path / "releases_cache.json"),
        transport=httpx.MockTransport(handler),
    )

    result = await service.get_releases()

    assert result["currentVersion"] == "0.3.0"
    assert result["cached"] is False
    assert result["stale"] is False
    assert result["offline"] is False
    assert [r["version"] for r in result["releases"]] == ["0.10.0", "0.4.0"]
    assert result["releases"][0]["tagName"] == "v0.10.0"
    assert result["releases"][0]["date"] == "2026-11-20"
    assert result["releases"][0]["githubReleaseUrl"] == "https://github.com/gkyla/yonru.clip/releases/tag/v0.10.0"


@pytest.mark.anyio
async def test_release_service_caches_in_memory_and_disk_within_ttl(tmp_path):
    """Serves cached releases within 6h TTL from memory and across restarts on disk."""
    calls = 0
    now = 1_700_000_000.0
    cache_file = tmp_path / "cache" / "github_releases.json"

    def clock() -> float:
        return now

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json=[
                {
                    "tag_name": "v0.4.0",
                    "name": "Release v0.4.0",
                    "body": "Body",
                    "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0",
                    "published_at": "2026-11-15T10:00:00Z",
                    "draft": False,
                    "prerelease": False,
                }
            ],
            headers={"ETag": '"etag-v1"'},
        )

    service = ReleaseService(
        current_version="0.3.0",
        cache_path=str(cache_file),
        ttl_seconds=21600,
        transport=httpx.MockTransport(handler),
        clock=clock,
    )

    first = await service.get_releases()
    assert first["cached"] is False
    assert calls == 1

    # Second call 1 hour later uses in-memory cache
    now += 3600
    second = await service.get_releases()
    assert second["cached"] is True
    assert second["releases"][0]["version"] == "0.4.0"
    assert calls == 1

    # New service instance reads persisted disk cache within TTL without network access
    offline_calls = 0

    def fail_on_network(request: httpx.Request) -> httpx.Response:
        nonlocal offline_calls
        offline_calls += 1
        return httpx.Response(500, json={"message": "should not call network"})

    restarted_service = ReleaseService(
        current_version="0.3.0",
        cache_path=str(cache_file),
        ttl_seconds=21600,
        transport=httpx.MockTransport(fail_on_network),
        clock=clock,
    )
    third = await restarted_service.get_releases()
    assert third["cached"] is True
    assert third["releases"][0]["version"] == "0.4.0"
    assert offline_calls == 0


@pytest.mark.anyio
async def test_release_service_sends_if_none_match_and_handles_304(tmp_path):
    """Sends If-None-Match when revalidating and refreshes TTL on 304 Not Modified."""
    now = 1_700_000_000.0
    received_headers = []
    cache_file = tmp_path / "releases_cache.json"

    def clock() -> float:
        return now

    def handler(request: httpx.Request) -> httpx.Response:
        received_headers.append(dict(request.headers))
        if request.headers.get("if-none-match") == '"etag-v1"':
            return httpx.Response(304)
        return httpx.Response(
            200,
            json=[
                {
                    "tag_name": "v0.4.0",
                    "name": "Release v0.4.0",
                    "body": "Body",
                    "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0",
                    "published_at": "2026-11-15T10:00:00Z",
                    "draft": False,
                    "prerelease": False,
                }
            ],
            headers={"ETag": '"etag-v1"'},
        )

    service = ReleaseService(
        current_version="0.3.0",
        cache_path=str(cache_file),
        ttl_seconds=21600,
        transport=httpx.MockTransport(handler),
        clock=clock,
    )

    first = await service.get_releases()
    assert first["cached"] is False
    assert len(received_headers) == 1

    # Advance past 6h TTL
    now += 22000
    revalidated = await service.get_releases()
    assert len(received_headers) == 2
    assert received_headers[1].get("if-none-match") == '"etag-v1"'
    assert revalidated["cached"] is True
    assert revalidated["stale"] is False
    assert revalidated["offline"] is False
    assert revalidated["releases"][0]["version"] == "0.4.0"

    # Next call right after 304 should hit fresh TTL cache without HTTP call
    now += 60
    cached_after_304 = await service.get_releases()
    assert len(received_headers) == 2
    assert cached_after_304["cached"] is True

    # force=True still revalidates with If-None-Match
    forced = await service.get_releases(force=True)
    assert len(received_headers) == 3
    assert received_headers[2].get("if-none-match") == '"etag-v1"'
    assert forced["releases"][0]["version"] == "0.4.0"


@pytest.mark.anyio
async def test_release_service_falls_back_gracefully_on_rate_limit_and_network_errors(tmp_path):
    """Returns stale cached releases or empty offline payload on rate limits or network errors."""
    now = 1_700_000_000.0
    cache_file = tmp_path / "releases_cache.json"

    def clock() -> float:
        return now

    def failing_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("Network unreachable", request=request)

    cold_service = ReleaseService(
        current_version="0.3.0",
        cache_path=str(tmp_path / "cold_cache.json"),
        transport=httpx.MockTransport(failing_handler),
        clock=clock,
    )
    cold_result = await cold_service.get_releases()
    assert cold_result["currentVersion"] == "0.3.0"
    assert cold_result["releases"] == []
    assert cold_result["cached"] is False
    assert cold_result["stale"] is False
    assert cold_result["offline"] is True
    assert cold_result["error"]

    # Populate warm cache, advance past TTL, then fail with 403 rate limit
    should_fail = False

    def rate_limit_handler(request: httpx.Request) -> httpx.Response:
        if should_fail:
            return httpx.Response(403, json={"message": "API rate limit exceeded"})
        return httpx.Response(
            200,
            json=[
                {
                    "tag_name": "v0.4.0",
                    "name": "Release v0.4.0",
                    "body": "Body",
                    "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0",
                    "published_at": "2026-11-15T10:00:00Z",
                    "draft": False,
                    "prerelease": False,
                }
            ],
            headers={"ETag": '"etag-v1"'},
        )

    warm_service = ReleaseService(
        current_version="0.3.0",
        cache_path=str(cache_file),
        ttl_seconds=21600,
        transport=httpx.MockTransport(rate_limit_handler),
        clock=clock,
    )
    await warm_service.get_releases()

    should_fail = True
    now += 22000
    fallback = await warm_service.get_releases()
    assert fallback["currentVersion"] == "0.3.0"
    assert fallback["cached"] is True
    assert fallback["stale"] is True
    assert fallback["offline"] is True
    assert "403" in str(fallback["error"]) or "rate limit" in str(fallback["error"]).lower()
    assert [r["version"] for r in fallback["releases"]] == ["0.4.0"]


def test_api_releases_endpoint_returns_current_version_and_supports_force(tmp_path, monkeypatch):
    """GET /api/releases exposes app.version and forwards ?force=true to ReleaseService."""
    import main

    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(
            200,
            json=[
                {
                    "tag_name": "v0.4.0",
                    "name": "Remote Discovery",
                    "body": "### Features\n\n- **Changelog**: Remote release checks",
                    "html_url": "https://github.com/gkyla/yonru.clip/releases/tag/v0.4.0",
                    "published_at": "2026-11-15T12:00:00Z",
                    "draft": False,
                    "prerelease": False,
                }
            ],
            headers={"ETag": '"etag-api"'},
        )

    mock_service = ReleaseService(
        current_version=main.app.version,
        cache_path=str(tmp_path / "api_cache.json"),
        transport=httpx.MockTransport(handler),
    )
    monkeypatch.setattr(main, "release_service", mock_service)

    client = TestClient(main.app)

    res1 = client.get("/api/releases")
    assert res1.status_code == 200
    body1 = res1.json()
    assert body1["currentVersion"] == main.app.version
    assert body1["cached"] is False
    assert [r["version"] for r in body1["releases"]] == ["0.4.0"]
    assert len(calls) == 1

    res2 = client.get("/api/releases")
    assert res2.status_code == 200
    assert res2.json()["cached"] is True
    assert len(calls) == 1

    res3 = client.get("/api/releases?force=true")
    assert res3.status_code == 200
    assert len(calls) == 2




