import os
import re
import time
import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlparse
import httpx


_SEMVER_RE = re.compile(r"^[vV]?(\d+)\.(\d+)\.(\d+)$")


def parse_semver(tag: str) -> Optional[Tuple[int, int, int]]:
    """Parse a strict X.Y.Z semantic version string (with optional leading 'v')."""
    if not isinstance(tag, str):
        return None
    match = _SEMVER_RE.match(tag.strip())
    if not match:
        return None
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def _normalize_date(raw_date: Optional[str]) -> str:
    if not raw_date or not isinstance(raw_date, str):
        return ""
    return raw_date[:10] if len(raw_date) >= 10 else raw_date


def _sanitize_github_url(raw_url: Optional[str], repo: str, tag_name: str) -> str:
    fallback = f"https://github.com/{repo}/releases/tag/{tag_name}"
    if not isinstance(raw_url, str):
        return fallback
    trimmed = raw_url.strip()
    parsed = urlparse(trimmed)
    if parsed.scheme in ("https", "http") and bool(parsed.netloc):
        return trimmed
    return fallback


class ReleaseService:
    """Fetches, filters, and caches stable GitHub Releases with ETag and offline fallback."""

    def __init__(
        self,
        current_version: str,
        repo: str = "gkyla/yonru.clip",
        cache_path: Optional[str] = None,
        ttl_seconds: int = 21600,
        transport: Optional[httpx.AsyncBaseTransport] = None,
        timeout: float = 5.0,
        clock: Optional[Callable[[], float]] = None,
    ):
        self.current_version = current_version.lstrip("vV")
        self.repo = repo
        self.cache_path = cache_path
        self.ttl_seconds = ttl_seconds
        self.transport = transport
        self.timeout = timeout
        self._clock = clock or time.time
        self._lock = asyncio.Lock()
        self._cache: Optional[Dict[str, Any]] = None

    def _load_cache(self) -> Optional[Dict[str, Any]]:
        if self._cache is not None:
            return self._cache
        if not self.cache_path or not os.path.isfile(self.cache_path):
            return None
        try:
            with open(self.cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("releases"), list):
                self._cache = {
                    "etag": data.get("etag"),
                    "fetched_at": float(data.get("fetched_at") or 0.0),
                    "releases": data["releases"],
                }
                return self._cache
        except Exception:
            return None
        return None

    def _save_cache(self, etag: Optional[str], fetched_at: float, releases: List[Dict[str, Any]]) -> None:
        self._cache = {
            "etag": etag,
            "fetched_at": fetched_at,
            "releases": releases,
        }
        if not self.cache_path:
            return
        cache_dir = os.path.dirname(os.path.abspath(self.cache_path))
        os.makedirs(cache_dir, exist_ok=True)
        tmp_path = f"{self.cache_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(self._cache, f)
        os.replace(tmp_path, self.cache_path)

    def _build_response(
        self,
        releases: List[Dict[str, Any]],
        fetched_at: Optional[float],
        *,
        cached: bool,
        stale: bool,
        offline: bool,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        fetched_iso = (
            datetime.fromtimestamp(fetched_at, tz=timezone.utc).isoformat()
            if fetched_at is not None and fetched_at > 0
            else None
        )
        return {
            "currentVersion": self.current_version,
            "releases": releases,
            "cached": cached,
            "stale": stale,
            "offline": offline,
            "fetchedAt": fetched_iso,
            "error": error,
        }

    def _normalize_releases(self, items: Any) -> List[Dict[str, Any]]:
        if not isinstance(items, list):
            return []

        normalized: List[Tuple[Tuple[int, int, int], Dict[str, Any]]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("draft") or item.get("prerelease"):
                continue

            tag_name = str(item.get("tag_name") or "").strip()
            parsed = parse_semver(tag_name)
            if parsed is None:
                continue

            version_str = f"{parsed[0]}.{parsed[1]}.{parsed[2]}"
            title = str(item.get("name") or "").strip() or tag_name or f"v{version_str}"
            published_at = item.get("published_at") or item.get("created_at") or ""

            normalized.append(
                (
                    parsed,
                    {
                        "version": version_str,
                        "tagName": tag_name,
                        "title": title,
                        "date": _normalize_date(published_at),
                        "publishedAt": published_at,
                        "body": str(item.get("body") or ""),
                        "githubReleaseUrl": _sanitize_github_url(
                            item.get("html_url"), self.repo, tag_name
                        ),
                    },
                )
            )

        normalized.sort(key=lambda pair: pair[0], reverse=True)
        return [entry for _, entry in normalized]

    async def get_releases(self, force: bool = False) -> Dict[str, Any]:
        """Return canonical currentVersion alongside normalized stable GitHub releases."""
        async with self._lock:
            now = self._clock()
            cache = self._load_cache()
            if (
                not force
                and cache is not None
                and (now - float(cache.get("fetched_at") or 0.0)) < self.ttl_seconds
            ):
                return self._build_response(
                    cache["releases"],
                    cache.get("fetched_at"),
                    cached=True,
                    stale=False,
                    offline=False,
                )

            url = f"https://api.github.com/repos/{self.repo}/releases?per_page=30"
            headers = {
                "Accept": "application/vnd.github+json",
                "User-Agent": f"yonru-clip/{self.current_version}",
                "X-GitHub-Api-Version": "2022-11-28",
            }
            if cache and cache.get("etag"):
                headers["If-None-Match"] = str(cache["etag"])

            try:
                async with httpx.AsyncClient(
                    transport=self.transport,
                    timeout=self.timeout,
                ) as client:
                    response = await client.get(url, headers=headers)
                    if response.status_code == 304 and cache is not None:
                        cached_releases = list(cache["releases"])
                        self._save_cache(cache.get("etag"), now, cached_releases)
                        return self._build_response(
                            cached_releases,
                            now,
                            cached=True,
                            stale=False,
                            offline=False,
                        )

                    response.raise_for_status()
                    releases = self._normalize_releases(response.json())
                    etag = response.headers.get("ETag") or response.headers.get("etag")
                    self._save_cache(etag, now, releases)
                    return self._build_response(
                        releases,
                        now,
                        cached=False,
                        stale=False,
                        offline=False,
                    )
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status in (403, 429):
                    err_msg = f"GitHub API rate limit reached ({status})."
                else:
                    err_msg = f"GitHub Releases returned HTTP {status}."
            except (httpx.HTTPError, ValueError, OSError) as exc:
                err_msg = f"Could not reach GitHub Releases: {exc}"

            if cache is not None:
                return self._build_response(
                    list(cache["releases"]),
                    cache.get("fetched_at"),
                    cached=True,
                    stale=True,
                    offline=True,
                    error=err_msg,
                )

            return self._build_response(
                [],
                None,
                cached=False,
                stale=False,
                offline=True,
                error=err_msg,
            )
