import os
import re
import json
import math
import threading
import uuid
import shutil
import time
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Tuple
from abc import ABC, abstractmethod
from core.youtube_client import YouTubeClient
from core.media_transcoder import MediaSpecs, MediaTranscoder


@dataclass
class _SourceCatalogEntry:
    """Fingerprinted in-memory representation of a cached source video folder."""
    folder_name: str
    folder_path: str
    video_id: str
    target_path: str
    target_filename: str
    media_mtime_ns: int
    media_size: int
    mtime: float
    meta_sig: Optional[Tuple[int, int]]
    title: str
    raw_title: Optional[str]
    channel: str
    added_at: float
    hd_ready: bool
    has_preview: bool
    has_thumb: bool
    specs: Optional[MediaSpecs]
    raw_meta: Optional[Dict[str, Any]]

    @property
    def fingerprint(self) -> Tuple[str, int, int, Optional[Tuple[int, int]], bool, bool, bool]:
        return (
            self.target_filename,
            self.media_mtime_ns,
            self.media_size,
            self.meta_sig,
            self.has_thumb,
            self.has_preview,
            self.hd_ready,
        )


class AssetStore(ABC):

    @abstractmethod
    def get_cached_video(self, url: str) -> Optional[dict]:
        pass

    @abstractmethod
    def get_cached_video_by_folder(self, folder_name: str) -> Optional[dict]:
        pass

    @abstractmethod
    def get_or_create_source(self, url: str, force_download: bool = False, quality: str = "1080p", progress_callback = None) -> Optional[dict]:
        pass


    @abstractmethod
    def list_cached_videos(self, page: Optional[int] = None, limit: int = 6, search: Optional[str] = None, sort_by: str = "date", order: str = "desc") -> Any:
        pass

    @abstractmethod
    def delete_cached_video(self, folder_name: str) -> int:
        pass

    @abstractmethod
    def get_saved_hooks(self, folder_name: str) -> list:
        pass

    @abstractmethod
    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        pass

    @abstractmethod
    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        pass


class AssetRepository(AssetStore):
    def __init__(self, output_dir="temp_assets", youtube_client=None, config_store=None, media_transcoder=None):
        self.output_dir = output_dir
        self.source_dir = os.path.join(output_dir, "sources")
        self.clips_dir = os.path.join(output_dir, "clips")
        
        os.makedirs(self.source_dir, exist_ok=True)
        os.makedirs(self.clips_dir, exist_ok=True)
        
        self.cookie_path = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt"))
        self.client = youtube_client or YouTubeClient(cookie_path=self.cookie_path)
        self.config_store = config_store
        self.transcoder = media_transcoder or MediaTranscoder(config_store=self.config_store)
        self._env = getattr(self.transcoder.adapter, "_env", os.environ.copy())
        
        self._download_locks = {}
        self._repo_lock = threading.Lock()
        self._index_lock = threading.RLock()
        self._cache_epoch: int = 0
        self._source_catalog: Dict[str, _SourceCatalogEntry] = {}

    def invalidate_catalog(self, folder_name: Optional[str] = None) -> None:
        """Invalidate in-memory source catalog for one folder or all folders."""
        with self._index_lock:
            self._cache_epoch += 1
            if folder_name is None:
                self._source_catalog.clear()
            else:
                self._source_catalog.pop(folder_name, None)

    def _sanitize_filename(self, title: str) -> str:
        """Sanitize title for folder naming, truncating to 50 chars."""
        s = re.sub(r'[^\w\s-]', '_', title).strip()
        s = re.sub(r'\s+', '_', s)
        s = re.sub(r'_+', '_', s)
        clean = s.strip('_')[:50].strip('_')
        return clean or "Video"

    def _sanitize_channel_name(self, channel: Optional[str]) -> str:
        """Sanitize channel name for folder naming, truncating to 40 chars."""
        if not channel:
            return "Unknown Channel"
        s = re.sub(r'[^\w\s-]', '', channel).strip()
        s = re.sub(r'\s+', ' ', s)
        clean = s[:40].strip()
        return clean or "Unknown Channel"

    @staticmethod
    def _stat_sig(path: str) -> Optional[Tuple[int, int]]:
        try:
            st = os.stat(path)
            return (st.st_mtime_ns, st.st_size)
        except OSError:
            return None

    @staticmethod
    def _parse_folder_fallback_title(folder_name: str, video_id: str) -> str:
        title = folder_name.replace(f"_{video_id}", "")
        if title.startswith("[") and "] " in title:
            title = title.split("] ", 1)[1]
        return title.replace("_", " ")

    @classmethod
    def _extract_metadata_fields(
        cls,
        raw_meta: Optional[Dict[str, Any]],
        folder_name: str,
        video_id: str,
        default_added_at: Optional[float] = None,
    ) -> dict:
        """Resolve title, channel, and added_at from parsed metadata with folder-name fallback."""
        title = None
        channel = "Unknown Channel"
        added_at = default_added_at
        if isinstance(raw_meta, dict):
            title = raw_meta.get("title") or raw_meta.get("raw_title")
            if raw_meta.get("channel"):
                channel = raw_meta.get("channel")
            elif raw_meta.get("uploader"):
                channel = raw_meta.get("uploader")
            if raw_meta.get("added_at") is not None:
                try:
                    added_at = float(raw_meta["added_at"])
                except (TypeError, ValueError):
                    pass

        if not title:
            title = cls._parse_folder_fallback_title(folder_name, video_id)

        return {
            "title": str(title),
            "channel": str(channel),
            "added_at": added_at,
        }

    @classmethod
    def _write_source_metadata(cls, folder_path: str, payload: Dict[str, Any]) -> Optional[Tuple[int, int]]:
        """Atomically write source metadata.json and return its updated (mtime_ns, size) signature."""
        meta_path = os.path.join(folder_path, "metadata.json")
        tmp_path = os.path.join(folder_path, f"metadata.json.{uuid.uuid4().hex}.tmp")
        try:
            os.makedirs(folder_path, exist_ok=True)
            with open(tmp_path, "w", encoding="utf-8") as mf:
                json.dump(payload, mf, indent=2, ensure_ascii=False)
            os.replace(tmp_path, meta_path)
            return cls._stat_sig(meta_path)
        except Exception as exc:
            print(f"[asset_repository] Failed to write metadata.json: {exc}")
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            return None

    @staticmethod
    def _parse_persisted_media_specs(
        raw_meta: Optional[Dict[str, Any]],
        filename: str,
        mtime_ns: int,
        size: int,
    ) -> Optional[MediaSpecs]:
        """Return validated MediaSpecs if metadata.json holds matching fingerprinted specs."""
        if not isinstance(raw_meta, dict):
            return None
        ms = raw_meta.get("media_specs")
        if not isinstance(ms, dict):
            return None
        if ms.get("filename") != filename or ms.get("mtime_ns") != mtime_ns or ms.get("size") != size:
            return None

        raw_dur = ms.get("duration")
        raw_w = ms.get("width")
        raw_h = ms.get("height")
        raw_fps = ms.get("fps")
        if (
            isinstance(raw_dur, bool)
            or isinstance(raw_w, bool)
            or isinstance(raw_h, bool)
            or isinstance(raw_fps, bool)
            or not isinstance(raw_dur, (int, float, str))
            or not isinstance(raw_w, (int, float, str))
            or not isinstance(raw_h, (int, float, str))
            or not isinstance(raw_fps, (int, float, str))
        ):
            return None
        try:
            dur = float(raw_dur)
            width = int(raw_w)
            height = int(raw_h)
            fps = float(raw_fps)
        except (TypeError, ValueError):
            return None
        if not (math.isfinite(dur) and math.isfinite(fps)) or dur < 0.0 or width < 0 or height < 0 or fps <= 0.0:
            return None
        if dur <= 0.0 and (width <= 0 or height <= 0):
            return None

        return MediaSpecs(
            duration=round(dur, 3),
            width=width,
            height=height,
            fps=round(fps, 2),
        )

    @staticmethod
    def _build_media_specs_payload(
        filename: str,
        mtime_ns: int,
        size: int,
        specs: MediaSpecs,
    ) -> Dict[str, Any]:
        return {
            "filename": filename,
            "mtime_ns": mtime_ns,
            "size": size,
            "duration": specs.duration,
            "width": specs.width,
            "height": specs.height,
            "fps": specs.fps,
        }

    # ── High Leverage Deep Interface Methods ────────────────────────

    def _get_or_refresh_catalog_entry(
        self,
        folder_path: str,
        folder_name: str,
        fallback_video_id: str,
    ) -> Optional[_SourceCatalogEntry]:
        """Return a fingerprint-validated catalog entry or reload metadata.json on change."""
        full_path = os.path.join(folder_path, "full.mp4")
        preview_path = os.path.join(folder_path, "preview.mp4")
        full_sig = self._stat_sig(full_path)
        preview_sig = self._stat_sig(preview_path)
        has_preview = preview_sig is not None

        if full_sig is not None:
            target_path = full_path
            target_filename = "full.mp4"
            media_mtime_ns, media_size = full_sig
            hd_ready = True
        elif preview_sig is not None:
            target_path = preview_path
            target_filename = "preview.mp4"
            media_mtime_ns, media_size = preview_sig
            hd_ready = False
        else:
            with self._index_lock:
                self._source_catalog.pop(folder_name, None)
            return None

        meta_path = os.path.join(folder_path, "metadata.json")
        meta_sig = self._stat_sig(meta_path)
        has_thumb = os.path.exists(os.path.join(folder_path, "thumb.jpg"))
        fp = (target_filename, media_mtime_ns, media_size, meta_sig, has_thumb, has_preview, hd_ready)

        with self._index_lock:
            existing = self._source_catalog.get(folder_name)
            if existing is not None and existing.fingerprint == fp:
                return existing

        raw_meta: Optional[Dict[str, Any]] = None
        if meta_sig is not None:
            try:
                with open(meta_path, "r", encoding="utf-8") as mf:
                    parsed = json.load(mf)
                if isinstance(parsed, dict):
                    raw_meta = parsed
            except Exception:
                raw_meta = None

        mtime = float(media_mtime_ns) / 1_000_000_000.0
        resolved_video_id = (
            str(raw_meta["video_id"])
            if (raw_meta is not None and raw_meta.get("video_id"))
            else fallback_video_id
        )
        meta = self._extract_metadata_fields(
            raw_meta, folder_name, resolved_video_id, default_added_at=mtime
        )
        specs = self._parse_persisted_media_specs(
            raw_meta, target_filename, media_mtime_ns, media_size
        )
        if specs is not None:
            self.transcoder.seed_probe_cache(
                target_path, specs, mtime_ns=media_mtime_ns, size=media_size
            )

        raw_title_val = (
            str(raw_meta["raw_title"])
            if (raw_meta is not None and raw_meta.get("raw_title"))
            else None
        )
        added_at_val = float(meta["added_at"]) if meta["added_at"] is not None else mtime
        entry = _SourceCatalogEntry(
            folder_name=folder_name,
            folder_path=folder_path,
            video_id=resolved_video_id,
            target_path=target_path,
            target_filename=target_filename,
            media_mtime_ns=media_mtime_ns,
            media_size=media_size,
            mtime=mtime,
            meta_sig=meta_sig,
            title=meta["title"],
            raw_title=raw_title_val,
            channel=meta["channel"],
            added_at=added_at_val,
            hd_ready=hd_ready,
            has_preview=has_preview,
            has_thumb=has_thumb,
            specs=specs,
            raw_meta=dict(raw_meta) if raw_meta is not None else None,
        )
        with self._index_lock:
            self._source_catalog[folder_name] = entry
        return entry

    def _ensure_entry_specs(self, entry: _SourceCatalogEntry) -> MediaSpecs:
        """Return persisted MediaSpecs or probe once and atomically backfill metadata.json."""
        with self._index_lock:
            latest = self._source_catalog.get(entry.folder_name)
            if (
                latest is not None
                and latest.specs is not None
                and latest.target_filename == entry.target_filename
                and latest.media_mtime_ns == entry.media_mtime_ns
                and latest.media_size == entry.media_size
            ):
                return latest.specs
        if entry.specs is not None:
            return entry.specs

        specs = self.transcoder.probe_video(entry.target_path)
        has_valid_specs = specs.duration > 0.0 or (specs.width > 0 and specs.height > 0)
        if not has_valid_specs:
            return specs

        updated_meta: Dict[str, Any] = dict(entry.raw_meta) if entry.raw_meta is not None else {}
        updated_meta.setdefault("video_id", entry.video_id)
        updated_meta.setdefault("title", entry.title)
        if entry.raw_title is not None:
            updated_meta.setdefault("raw_title", entry.raw_title)
        updated_meta.setdefault("channel", entry.channel)
        updated_meta.setdefault("added_at", entry.added_at)
        updated_meta["media_specs"] = self._build_media_specs_payload(
            entry.target_filename,
            entry.media_mtime_ns,
            entry.media_size,
            specs,
        )

        new_meta_sig = self._write_source_metadata(entry.folder_path, updated_meta)
        with self._index_lock:
            target_entry = self._source_catalog.get(entry.folder_name, entry)
            target_entry.specs = specs
            target_entry.raw_meta = updated_meta
            if new_meta_sig is not None:
                target_entry.meta_sig = new_meta_sig
        return specs

    def _build_cached_video_info_from_entry(self, entry: _SourceCatalogEntry) -> dict:
        specs = self._ensure_entry_specs(entry)
        return {
            "video_id": entry.video_id,
            "title": entry.title,
            "channel": entry.channel,
            "added_at": entry.added_at,
            "duration": specs.duration,
            "fps": specs.fps,
            "file_path": entry.target_path,
            "folder_name": entry.folder_name,
            "asset_url": f"/assets/sources/{entry.folder_name}/{entry.target_filename}",
            "thumbnail_url": f"/assets/sources/{entry.folder_name}/thumb.jpg" if entry.has_thumb else None,
            "width": specs.width,
            "height": specs.height,
            "hd_ready": entry.hd_ready,
            "has_preview": entry.has_preview,
            "heatmap": [],
        }

    def get_cached_video(self, url: str) -> Optional[dict]:
        """Search sources/ subfolders for the video ID without spawning FFmpeg for thumbnails."""
        video_id = self.client.extract_video_id(url)
        if not video_id or not os.path.exists(self.source_dir):
            return None

        with os.scandir(self.source_dir) as entries:
            for entry in entries:
                if entry.is_dir() and entry.name.endswith(f"_{video_id}"):
                    catalog_entry = self._get_or_refresh_catalog_entry(entry.path, entry.name, video_id)
                    if catalog_entry is not None:
                        return self._build_cached_video_info_from_entry(catalog_entry)
        return None

    def get_cached_video_by_folder(self, folder_name: str) -> Optional[dict]:
        """Search sources/ subfolders by exact folder name without spawning FFmpeg for thumbnails."""
        target_dir = os.path.join(self.source_dir, folder_name)
        if os.path.exists(target_dir) and os.path.isdir(target_dir):
            video_id = folder_name.split("_")[-1]
            catalog_entry = self._get_or_refresh_catalog_entry(target_dir, folder_name, video_id)
            if catalog_entry is not None:
                return self._build_cached_video_info_from_entry(catalog_entry)
        return None

    def _ensure_source_thumbnail(self, cached: dict) -> dict:
        """Ensure an ingested source video has a static thumb.jpg on disk."""
        if cached.get("thumbnail_url"):
            return cached
        file_path = cached.get("file_path")
        folder_name = cached.get("folder_name")
        if not file_path or not folder_name:
            return cached
        thumb_path = os.path.join(os.path.dirname(file_path), "thumb.jpg")
        if os.path.exists(thumb_path) or self.transcoder.extract_frame(file_path, 5.0, thumb_path):
            self.invalidate_catalog(folder_name)
            updated = self.get_cached_video_by_folder(folder_name)
            if updated is not None:
                return updated
            return {**cached, "thumbnail_url": f"/assets/sources/{folder_name}/thumb.jpg"}
        return cached

    def get_or_create_source(self, url: str, force_download: bool = False, quality: str = "1080p", progress_callback = None) -> dict:
        """
        Gets metadata of a video by URL, downloading and extracting transcript/audio 
        automatically if not already cached.
        """
        video_id = self.client.extract_video_id(url)
        if not video_id:
            # Fall back to URL md5 hash if extract fails
            import hashlib
            video_id = hashlib.md5(url.encode()).hexdigest()
            
        lock_key = (video_id, quality)
        
        with self._repo_lock:
            if lock_key not in self._download_locks:
                self._download_locks[lock_key] = threading.Lock()
            download_lock = self._download_locks[lock_key]
            
        with download_lock:
            if not force_download:
                cached = self.get_cached_video(url)
                if cached:
                    if quality == "1080p" and not cached.get("hd_ready"):
                        pass
                    else:
                        return self._ensure_source_thumbnail(cached)
            else:
                # Even if force is True, if we are fetching 1080p and the file now exists on disk,
                # we don't need to force download it again.
                cached = self.get_cached_video(url)
                if cached and cached.get("hd_ready") and quality == "1080p":
                    return self._ensure_source_thumbnail(cached)
                if cached and quality == "360p":
                    return self._ensure_source_thumbnail(cached)

            # Otherwise, retrieve metadata and download
            info = self.client.get_video_info_fast(url)
            video_id = info["id"]
            channel = info.get("channel") or info.get("uploader") or "Unknown Channel"
            safe_channel = self._sanitize_channel_name(channel)
            safe_title = self._sanitize_filename(info["title"])
            folder_name = f"[{safe_channel}] {safe_title}_{video_id}"
            
            target_dir = os.path.join(self.source_dir, folder_name)
            os.makedirs(target_dir, exist_ok=True)

            existing_meta: Dict[str, Any] = {}
            meta_path = os.path.join(target_dir, "metadata.json")
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        parsed_existing = json.load(mf)
                    if isinstance(parsed_existing, dict):
                        existing_meta = parsed_existing
                except Exception:
                    existing_meta = {}

            added_at = time.time()
            if existing_meta.get("added_at") is not None:
                try:
                    added_at = float(existing_meta["added_at"])
                except (TypeError, ValueError):
                    pass

            self.client.download_video(url, target_dir, quality=quality, progress_callback=progress_callback)
            filename = "preview.mp4" if quality == "360p" else "full.mp4"
            file_path = os.path.join(target_dir, filename)
            specs = self.transcoder.probe_video(file_path)

            thumb_path = os.path.join(target_dir, "thumb.jpg")
            if not os.path.exists(thumb_path):
                self.transcoder.extract_frame(file_path, 5.0, thumb_path)

            updated_meta: Dict[str, Any] = {
                **existing_meta,
                "video_id": video_id,
                "title": info["title"],
                "raw_title": info["title"],
                "channel": channel,
                "added_at": added_at,
            }
            file_sig = self._stat_sig(file_path)
            if file_sig is not None and (specs.duration > 0.0 or (specs.width > 0 and specs.height > 0)):
                updated_meta["media_specs"] = self._build_media_specs_payload(
                    filename, file_sig[0], file_sig[1], specs
                )
            self._write_source_metadata(target_dir, updated_meta)
            self.invalidate_catalog(folder_name)

            refreshed = self._get_or_refresh_catalog_entry(target_dir, folder_name, video_id)
            if refreshed is not None:
                return self._build_cached_video_info_from_entry(refreshed)

            return {
                "video_id": video_id,
                "title": info["title"],
                "channel": channel,
                "added_at": added_at,
                "duration": specs.duration,
                "fps": specs.fps,
                "file_path": file_path,
                "folder_name": folder_name,
                "asset_url": f"/assets/sources/{folder_name}/{filename}",
                "thumbnail_url": f"/assets/sources/{folder_name}/thumb.jpg" if os.path.exists(thumb_path) else None,
                "width": specs.width,
                "height": specs.height,
                "hd_ready": (quality == "1080p"),
                "has_preview": os.path.exists(os.path.join(target_dir, "preview.mp4")),
                "heatmap": [],
            }

    def _hydrate_cached_video_list_item(self, entry: _SourceCatalogEntry) -> dict:
        """Assemble list item from fingerprinted catalog specs without triggering FFmpeg thumbnails."""
        specs = self._ensure_entry_specs(entry)
        return {
            "video_id": entry.video_id,
            "title": entry.title,
            "folder_name": entry.folder_name,
            "channel": entry.channel,
            "added_at": entry.added_at,
            "resolution": f"{specs.width}x{specs.height}",
            "duration": specs.duration,
            "mtime": entry.mtime,
            "asset_url": f"/assets/sources/{entry.folder_name}/{entry.target_filename}",
            "thumbnail_url": f"/assets/sources/{entry.folder_name}/thumb.jpg" if entry.has_thumb else None,
            "youtube_url": f"https://youtube.com/watch?v={entry.video_id}",
            "hd_ready": entry.hd_ready,
        }

    def list_cached_videos(
        self,
        page: Optional[int] = None,
        limit: int = 6,
        search: Optional[str] = None,
        sort_by: str = "date",
        order: str = "desc"
    ) -> Any:
        """List, search, sort, and paginate cached source videos."""
        if not os.path.exists(self.source_dir):
            return {"videos": [], "total": 0, "has_more": False} if page is not None else []

        candidates: List[_SourceCatalogEntry] = []
        seen_folders = set()
        with os.scandir(self.source_dir) as entries:
            for entry in entries:
                if entry.is_dir() and len(entry.name) >= 12 and entry.name[-12] == "_":
                    video_id = entry.name[-11:]
                    catalog_entry = self._get_or_refresh_catalog_entry(entry.path, entry.name, video_id)
                    if catalog_entry is not None:
                        seen_folders.add(entry.name)
                        candidates.append(catalog_entry)

        with self._index_lock:
            stale_folders = [k for k in self._source_catalog if k not in seen_folders]
            for stale_key in stale_folders:
                del self._source_catalog[stale_key]

        # If raw list requested without pagination
        if page is None:
            return [self._hydrate_cached_video_list_item(c) for c in candidates]

        # 1. Search Filter (case-insensitive) before any legacy fallback probing
        if search:
            search_lower = search.lower()
            candidates = [
                v for v in candidates
                if search_lower in v.title.lower()
                or search_lower in v.video_id.lower()
                or search_lower in v.channel.lower()
            ]

        # 2. Sorting
        if sort_by == "title":
            reverse = (order == "desc")
            candidates.sort(key=lambda x: x.title.lower(), reverse=reverse)
        else:
            reverse = (order != "asc")
            candidates.sort(key=lambda x: x.added_at, reverse=reverse)

        # 3. Pagination Slicing, then hydrate specs for visible slice only
        total = len(candidates)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_candidates = candidates[start_idx:end_idx]
        has_more = end_idx < total

        return {
            "videos": [self._hydrate_cached_video_list_item(c) for c in paginated_candidates],
            "total": total,
            "has_more": has_more
        }

    def delete_cached_video(self, folder_name: str) -> int:
        """Delete titled source folder securely with validation."""
        if not folder_name or not re.match(r"^[\w\s.\-\[\]]+$", folder_name) or ".." in folder_name:
            raise ValueError(f"Invalid or unsafe folder name: {folder_name}")

        base_src = os.path.abspath(self.source_dir)
        src_path = os.path.abspath(os.path.join(base_src, folder_name))
        
        if os.path.commonpath([base_src, src_path]) != base_src:
            raise ValueError(f"Path traversal detected: {folder_name}")

        if os.path.exists(src_path) and os.path.isdir(src_path):
            shutil.rmtree(src_path)
            self.invalidate_catalog(folder_name)
            return 1

        return 0


    # ── Hooks DB/JSON Operations ──────────────────────────────────

    def get_saved_hooks(self, folder_name: str) -> list:
        folder_path = os.path.join(self.source_dir, folder_name)
        saved_hooks_path = os.path.join(folder_path, "saved_hooks.json")
        if os.path.exists(saved_hooks_path):
            with open(saved_hooks_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        hooks = self.get_saved_hooks(folder_name)
        if not any(h.get('start') == hook.get('start') and h.get('end') == hook.get('end') for h in hooks):
            hook["_id"] = str(uuid.uuid4())
            hooks.append(hook)
            folder_path = os.path.join(self.source_dir, folder_name)
            saved_hooks_path = os.path.join(folder_path, "saved_hooks.json")
            with open(saved_hooks_path, "w", encoding="utf-8") as f:
                json.dump(hooks, f, indent=4)
        return hooks

    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        hooks = self.get_saved_hooks(folder_name)
        hooks = [h for h in hooks if h.get("_id") != hook_id]
        folder_path = os.path.join(self.source_dir, folder_name)
        saved_hooks_path = os.path.join(folder_path, "saved_hooks.json")
        with open(saved_hooks_path, "w", encoding="utf-8") as f:
            json.dump(hooks, f, indent=4)
        return hooks

    def update_source_hooks(self, folder_name: str, hooks: list) -> bool:
        base = os.path.realpath(self.source_dir)
        hooks_path = os.path.realpath(os.path.join(self.source_dir, folder_name, "hooks.json"))
        if os.path.commonpath([base, hooks_path]) != base:
            raise ValueError(f"Path traversal detected: {folder_name}/hooks.json")
        if not os.path.exists(hooks_path):
            return False
        with open(hooks_path, "w", encoding="utf-8") as f:
            json.dump(hooks, f, ensure_ascii=False, indent=2)
        return True




class MockAssetStore(AssetStore):

    def __init__(self, cached_videos=None, ready_clips=None, saved_hooks=None):
        self.cached_videos = cached_videos or []
        self.ready_clips = ready_clips or []
        self.saved_hooks = saved_hooks or {}
        self.calls = []

    def get_cached_video(self, url: str) -> Optional[dict]:
        self.calls.append(("get_cached_video", url))
        for v in self.cached_videos:
            if url in v.get("youtube_url", "") or url == v.get("video_id") or v.get("video_id") in url:
                return v
        return None

    def get_cached_video_by_folder(self, folder_name: str) -> Optional[dict]:
        self.calls.append(("get_cached_video_by_folder", folder_name))
        for v in self.cached_videos:
            if v.get("folder_name") == folder_name:
                return v
        return None

    def get_or_create_source(self, url: str, force_download: bool = False, quality: str = "1080p", progress_callback = None) -> Optional[dict]:
        self.calls.append(("get_or_create_source", url, force_download, quality))
        cached = self.get_cached_video(url)
        if cached:
            if quality == "1080p" and not cached.get("hd_ready"):
                pass
            else:
                return cached
        filename = "preview.mp4" if quality == "360p" else "full.mp4"
        mock_source = {
            "video_id": "mock_id",
            "title": "Mock Video",
            "channel": "Mock Channel",
            "added_at": 1600000000.0,
            "duration": 60.0,
            "fps": 30.0,
            "file_path": f"mock_path/{filename}",
            "folder_name": "Mock_Video_mock_id",
            "asset_url": f"/assets/sources/Mock_Video_mock_id/{filename}",
            "width": 1920,
            "height": 1080,
            "hd_ready": (quality == "1080p"),
            "has_preview": True,
            "mtime": 1600000000.0
        }
        self.cached_videos.append(mock_source)
        if progress_callback:
            progress_callback(100.0)
        return mock_source


    def list_cached_videos(self, page: Optional[int] = None, limit: int = 6, search: Optional[str] = None, sort_by: str = "date", order: str = "desc") -> Any:
        self.calls.append(("list_cached_videos", page, limit, search, sort_by, order))
        if page is not None:
            return {"videos": self.cached_videos, "total": len(self.cached_videos), "has_more": False}
        return self.cached_videos

    def delete_cached_video(self, folder_name: str) -> int:
        self.calls.append(("delete_cached_video", folder_name))
        return 1

    def get_saved_hooks(self, folder_name: str) -> list:
        self.calls.append(("get_saved_hooks", folder_name))
        return self.saved_hooks.get(folder_name, [])

    def add_saved_hook(self, folder_name: str, hook: dict) -> list:
        self.calls.append(("add_saved_hook", folder_name, hook))
        if folder_name not in self.saved_hooks:
            self.saved_hooks[folder_name] = []
        self.saved_hooks[folder_name].append(hook)
        return self.saved_hooks[folder_name]

    def delete_saved_hook(self, folder_name: str, hook_id: str) -> list:
        self.calls.append(("delete_saved_hook", folder_name, hook_id))
        if folder_name in self.saved_hooks:
            self.saved_hooks[folder_name] = [h for h in self.saved_hooks[folder_name] if h.get("_id") != hook_id]
        return self.saved_hooks.get(folder_name, [])

