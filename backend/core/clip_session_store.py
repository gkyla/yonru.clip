import os
import re
import math
import json
import uuid
import base64
import shutil
import hashlib
import tempfile
import threading
from dataclasses import dataclass
from typing import Optional, Dict, Any, List, Set, Tuple, Literal, Protocol, runtime_checkable
from core.media_transcoder import MediaTranscoder, MediaProcessAdapter

_DATA_AUDIO_RE = re.compile(r"^data:audio/([a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)
_AUDIO_MIME_EXTENSIONS = {
    "mpeg": ".mp3",
    "mp3": ".mp3",
    "wav": ".wav",
    "wave": ".wav",
    "x-wav": ".wav",
    "ogg": ".ogg",
    "aac": ".aac",
    "mp4": ".m4a",
    "x-m4a": ".m4a",
    "m4a": ".m4a",
    "flac": ".flac",
}

_CANONICAL_MANIFEST_FILES = {
    "transcript": "transcript.json",
    "style_settings": "style_settings.json",
    "timeline": "timeline.json",
    "history": "history.json",
    "cover_config": "cover_config.json",
    "crop_map": "crop_map.json",
}

_COMPACT_MANIFEST_FILES = frozenset({
    "history.json",
    "transcript.json",
    "crop_map.json",
    "timeline.json",
})


@runtime_checkable
class AudioLibraryStorePort(Protocol):
    def save_item(
        self,
        filename: str,
        content_bytes: bytes,
        duration: float = 0.0,
        on_duplicate: Literal["prompt", "use_existing", "replace"] = "use_existing",
    ) -> Dict[str, Any]: ...


@dataclass(frozen=True)
class ClipRenderArtifacts:
    """Resolved on-disk artifact paths for a Ready Clip managed by ClipSessionStore."""

    folder_name: str
    clip_id: str
    clip_dir: str
    video_path: str
    transcript_path: Optional[str]
    crop_map_path: Optional[str]
    cover_image_path: Optional[str]

CANONICAL_DEFAULT_STYLE_SETTINGS: Dict[str, Any] = {

    "videoLayout": "vertical",
    "subtitlePreset": "bold-podcast",
    "subtitlePosition": "center",
    "subtitleOffset": 50,
    "subtitleSyncOffset": 150,
    "font": "Montserrat",
    "fontSize": 50,
    "cropMode": "face_tracking",
    "cropPercentX": 50,
    "subtitleMode": "word",
    "subtitleAnimation": "pop",
    "subtitleHighlightMode": "color",
    "subtitleHighlightColor": "#CFFF50",
    "subtitleTextColor": "#FFFFFF",
    "subtitleStrokeColor": "#000000",
    "subtitleStrokeWidth": 0,
    "subtitleFontWeight": 900,
    "subtitleTextTransform": "uppercase",
    "subtitleBackground": "none",
    "subtitleBackgroundOpacity": 0.7,
    "subtitleWordSpacing": 0,
    "volume": 0.5
}

CANONICAL_DEFAULT_COVER_CONFIG: Dict[str, Any] = {
    "enabled": False,
    "duration": 1.0,
    "screenshotTime": 0,
    "textOverlays": [],
    "xOffset": 50
}


class ClipSessionStore:
    """
    Domain engine handling clip session retrieval, serialization,
    atomic persistence, defaults healing, and path traversal defense.
    """

    def __init__(
        self,
        clips_dir: str = "temp_assets/clips",
        output_dir: Optional[str] = None,
        config_store: Optional[Any] = None,
        media_transcoder: Optional[MediaTranscoder] = None,
        face_tracker: Optional[Any] = None,
        audio_library_store: Optional[AudioLibraryStorePort] = None,
    ):
        self.clips_dir = clips_dir
        self.output_dir = output_dir if output_dir else os.path.dirname(self.clips_dir)
        self.source_dir = os.path.join(self.output_dir, "sources")
        self.config_store = config_store
        self.transcoder = media_transcoder or MediaTranscoder(config_store=self.config_store)
        self.face_tracker = face_tracker
        self._face_tracker_lock = threading.Lock()
        self._crop_map_locks_guard = threading.Lock()
        self._crop_map_locks: Dict[Tuple[str, str], threading.Lock] = {}
        self.audio_library_store = audio_library_store
        self._index_lock = threading.RLock()
        self._cache_epoch: int = 0
        self._ready_clip_cache: Dict[Tuple[str, str], Tuple[Tuple[Any, ...], Dict[str, Any]]] = {}
        self._parent_meta_cache: Dict[str, Tuple[Optional[Tuple[int, int]], Tuple[str, Optional[str]]]] = {}

    def resolve_clip_dir(self, folder_name: str, clip_id: str) -> str:

        """
        Validates folder_name and clip_id against path traversal and resolves
        the canonical clip directory path.
        """
        if not folder_name or not clip_id:
            raise ValueError("Folder name and clip ID must not be empty")

        # Disallow slashes, backslashes, null bytes, parent dir tokens, or Windows device names
        if "/" in folder_name or "\\" in folder_name or "\0" in folder_name:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")
        if "/" in clip_id or "\\" in clip_id or "\0" in clip_id:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")
        if folder_name.strip() in {".", ".."} or clip_id.strip() in {".", ".."}:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")
        if ".." in folder_name or ".." in clip_id:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")
        if os.path.isabs(folder_name) or os.path.isabs(clip_id):
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        # Check Windows reserved device names
        reserved_pattern = r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$'
        if re.match(reserved_pattern, folder_name, re.IGNORECASE) or re.match(reserved_pattern, clip_id, re.IGNORECASE):
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        base = os.path.realpath(self.clips_dir)
        target = os.path.realpath(os.path.join(self.clips_dir, folder_name, clip_id))

        # Ensure target is strictly inside base directory and not base itself
        try:
            common = os.path.commonpath([base, target])
        except ValueError:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        if common != base or target == base:
            raise ValueError(f"Path traversal detected: {folder_name}/{clip_id}")

        return os.path.join(self.clips_dir, folder_name, clip_id)

    def _resolve_clip_path(self, folder_name: str, clip_id: str, filename: str) -> str:
        """Resolves an individual file inside a clip directory."""
        if "/" in filename or "\\" in filename or ".." in filename:
            raise ValueError(f"Path traversal detected in filename: {filename}")
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        return os.path.join(clip_dir, filename)

    def resolve_clip_artifacts(
        self,
        video_path: Optional[str] = None,
        *,
        folder_name: Optional[str] = None,
        clip_id: Optional[str] = None,
    ) -> Optional[ClipRenderArtifacts]:
        """Resolve canonical artifact paths for a Ready Clip from video_path or IDs."""
        if video_path:
            base = os.path.realpath(self.clips_dir)
            real_video_dir = os.path.realpath(os.path.dirname(video_path))
            try:
                rel = os.path.relpath(real_video_dir, base)
            except ValueError:
                return None
            parts = rel.split(os.sep)
            if len(parts) != 2 or any(part in {"", ".", ".."} for part in parts):
                return None
            resolved_folder, resolved_clip_id = parts[0], parts[1]
            clip_dir = self.resolve_clip_dir(resolved_folder, resolved_clip_id)
            real_clip_dir = os.path.realpath(clip_dir)
            real_video = os.path.realpath(video_path)
            try:
                if os.path.commonpath([real_clip_dir, real_video]) != real_clip_dir:
                    return None
            except ValueError:
                return None
            resolved_video = video_path
        elif folder_name and clip_id:
            clip_dir = self.resolve_clip_dir(folder_name, clip_id)
            resolved_folder = folder_name
            resolved_clip_id = clip_id
            resolved_video = os.path.join(clip_dir, "video.mp4")
        else:
            return None

        transcript_candidate = os.path.join(clip_dir, "transcript.json")
        crop_map_candidate = os.path.join(clip_dir, "crop_map.json")
        cover_candidate = os.path.join(clip_dir, "cover.jpg")
        thumb_candidate = os.path.join(clip_dir, "thumbnail.jpg")

        cover_image_path = (
            cover_candidate
            if os.path.exists(cover_candidate)
            else (thumb_candidate if os.path.exists(thumb_candidate) else None)
        )

        return ClipRenderArtifacts(
            folder_name=resolved_folder,
            clip_id=resolved_clip_id,
            clip_dir=clip_dir,
            video_path=resolved_video,
            transcript_path=transcript_candidate if os.path.exists(transcript_candidate) else None,
            crop_map_path=crop_map_candidate if os.path.exists(crop_map_candidate) else None,
            cover_image_path=cover_image_path,
        )

    @staticmethod
    def _sanitize_style_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
        """Strip clip-specific cropMap keyframes from style settings (ADR-0008)."""
        return {
            key: value
            for key, value in settings.items()
            if key not in ("cropMap", "crop_map")
        }

    @staticmethod
    def _dump_json_to_stream(file_obj: Any, target_path: str, data: Any) -> None:
        """Write compact JSON for large machine manifests and pretty JSON for small config files."""
        if os.path.basename(target_path) in _COMPACT_MANIFEST_FILES:
            json.dump(data, file_obj, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(data, file_obj, ensure_ascii=False, indent=2)

    def _atomic_write_json(self, target_path: str, data: Any) -> None:
        """
        Atomically writes json data to target_path using a temporary staging file
        in the same directory and os.replace.
        """
        dir_name = os.path.dirname(target_path)
        os.makedirs(dir_name, exist_ok=True)
        tmp_path = f"{target_path}.tmp.{uuid.uuid4().hex}"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                self._dump_json_to_stream(f, target_path, data)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, target_path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    def ensure_clip_defaults(self, folder_name: str, clip_id: str) -> bool:
        """
        Auto-heals missing manifests (style_settings, cover_config, transcript,
        thumbnail) in the clip directory using canonical defaults.
        Returns True if any disk state was written, invalidating the ready-clip
        listing cache only when thumbnail assets changed.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        if not os.path.exists(clip_dir):
            os.makedirs(clip_dir, exist_ok=True)

        mutated = False
        thumb_mutated = False

        # 1. Style settings
        clip_style_path = os.path.join(clip_dir, "style_settings.json")
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        if not os.path.exists(default_style_path):
            try:
                self._atomic_write_json(default_style_path, CANONICAL_DEFAULT_STYLE_SETTINGS)
                mutated = True
            except Exception:
                pass

        if not os.path.exists(clip_style_path):
            style_data = CANONICAL_DEFAULT_STYLE_SETTINGS
            if os.path.exists(default_style_path):
                try:
                    with open(default_style_path, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                        if isinstance(loaded, dict):
                            style_data = self._sanitize_style_settings(loaded)
                except Exception:
                    style_data = CANONICAL_DEFAULT_STYLE_SETTINGS
            self._atomic_write_json(clip_style_path, style_data)
            mutated = True

        # 2. Cover / thumbnail config
        clip_cover_path = os.path.join(clip_dir, "cover_config.json")
        clip_thumb_path = os.path.join(clip_dir, "thumbnail_config.json")
        if not os.path.exists(clip_cover_path) and not os.path.exists(clip_thumb_path):
            cover_data = dict(CANONICAL_DEFAULT_COVER_CONFIG)
            default_thumb_style_path = os.path.join(self.output_dir, "default_thumbnail_style.json")
            default_cover_style_path = os.path.join(self.output_dir, "default_cover_style.json")
            ref_path = default_cover_style_path if os.path.exists(default_cover_style_path) else default_thumb_style_path
            if os.path.exists(ref_path):
                try:
                    with open(ref_path, "r", encoding="utf-8") as f:
                        ref_style = json.load(f)
                        if isinstance(ref_style, dict) and "thumbnailDuration" in ref_style:
                            cover_data["duration"] = ref_style["thumbnailDuration"]
                except Exception:
                    pass
            self._atomic_write_json(clip_cover_path, cover_data)
            mutated = True
        elif not os.path.exists(clip_cover_path) and os.path.exists(clip_thumb_path):
            # Sync cover from legacy thumbnail config
            try:
                shutil.copy2(clip_thumb_path, clip_cover_path)
                mutated = True
            except Exception:
                pass

        # 3. Transcript
        clip_transcript_path = os.path.join(clip_dir, "transcript.json")
        if not os.path.exists(clip_transcript_path):
            self._atomic_write_json(clip_transcript_path, [])
            mutated = True

        # 4. Thumbnail image from poster or video frame
        thumb_img_path = os.path.join(clip_dir, "thumbnail.jpg")
        poster_img_path = os.path.join(clip_dir, "poster.jpg")
        if not os.path.exists(thumb_img_path) and os.path.exists(poster_img_path):
            try:
                shutil.copy2(poster_img_path, thumb_img_path)
                if os.path.exists(thumb_img_path):
                    mutated = True
                    thumb_mutated = True
            except Exception:
                pass
        elif not os.path.exists(thumb_img_path):
            video_path = os.path.join(clip_dir, "video.mp4")
            if os.path.exists(video_path):
                try:
                    if self.extract_clip_screenshot(video_path, 0.0, thumb_img_path):
                        mutated = True
                        thumb_mutated = True
                except Exception:
                    pass

        if thumb_mutated:
            self.invalidate_ready_clips_cache(folder_name, clip_id)
        return mutated

    def _read_json(self, path: str, expected_type: type, default: Any) -> Any:
        if not os.path.exists(path):
            return default
        try:
            with open(path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, expected_type):
                return loaded
        except Exception:
            pass
        return default

    def _extract_inline_audio_src(self, item: Dict[str, Any]) -> Optional[str]:
        """Extracts a legacy inline data:audio/... base64 URI into the Audio Library."""
        src = item.get("src")
        if not self.audio_library_store or not isinstance(src, str):
            return None
        match = _DATA_AUDIO_RE.match(src)
        if not match:
            return None

        subtype, b64_payload = match.group(1).lower(), match.group(2)
        ext = _AUDIO_MIME_EXTENSIONS.get(subtype, ".mp3")
        try:
            audio_bytes = base64.b64decode(b64_payload)
        except Exception:
            return None

        sha8 = hashlib.sha256(audio_bytes).hexdigest()[:8]
        raw_name = str(item.get("name") or item.get("id") or "audio")
        stem, _ = os.path.splitext(os.path.basename(raw_name))
        filename = f"{stem or 'audio'}_{sha8}{ext}"
        duration = float(item.get("duration") or 0.0)

        try:
            res = self.audio_library_store.save_item(
                filename, audio_bytes, duration=duration, on_duplicate="use_existing"
            )
            if isinstance(res, dict):
                item_dict = res.get("item")
                if isinstance(item_dict, dict):
                    url = item_dict.get("url")
                    return url if isinstance(url, str) else None
        except Exception:
            return None
        return None

    def _extract_inline_audio_in_tracks(self, tracks: List[Any]) -> tuple[List[Any], bool]:
        if not self.audio_library_store or not isinstance(tracks, list):
            return tracks, False
        changed = False
        new_tracks: List[Any] = []
        for tr in tracks:
            if not isinstance(tr, dict) or not isinstance(tr.get("items"), list):
                new_tracks.append(tr)
                continue
            new_items: List[Any] = []
            for it in tr["items"]:
                if isinstance(it, dict):
                    extracted_url = self._extract_inline_audio_src(it)
                    if extracted_url:
                        new_items.append({**it, "src": extracted_url})
                        changed = True
                        continue
                new_items.append(it)
            new_tracks.append({**tr, "items": new_items})
        return new_tracks, changed

    def _extract_inline_audio_in_history(self, history: Dict[str, Any]) -> tuple[Dict[str, Any], bool]:
        if not self.audio_library_store or not isinstance(history, dict):
            return history, False
        changed = False
        cleaned: Dict[str, Any] = {}
        for key in ("undo_stack", "redo_stack"):
            stack = history.get(key) or []
            if not isinstance(stack, list):
                cleaned[key] = []
                continue
            new_stack: List[Any] = []
            for snap in stack:
                if isinstance(snap, dict) and isinstance(snap.get("tracks"), list):
                    new_tracks, snap_changed = self._extract_inline_audio_in_tracks(snap["tracks"])
                    if snap_changed:
                        changed = True
                    new_stack.append({**snap, "tracks": new_tracks})
                else:
                    new_stack.append(snap)
            cleaned[key] = new_stack
        return cleaned, changed

    def get_clip_session(
        self,
        folder_name: str,
        clip_id: str,
        *,
        ensure_crop_map: bool = True,
    ) -> Dict[str, Any]:
        """
        Retrieves the canonical Clip Session aggregate (transcript, cascaded style settings,
        timeline, history, cover config, crop map, asset URLs), healing defaults, migrating
        legacy cover/audio assets, and computing crop_map when requested.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        if not os.path.exists(clip_dir):
            os.makedirs(clip_dir, exist_ok=True)

        self.ensure_clip_defaults(folder_name, clip_id)

        # 1. Transcript
        transcript: List[Any] = self._read_json(
            os.path.join(clip_dir, "transcript.json"), list, []
        )

        # 2. Cascaded style settings: CANONICAL <- default_style_settings.json <- clip style_settings.json
        style_settings: Dict[str, Any] = dict(CANONICAL_DEFAULT_STYLE_SETTINGS)
        default_style = self._read_json(
            os.path.join(self.output_dir, "default_style_settings.json"), dict, None
        )
        if default_style:
            style_settings.update(default_style)
        clip_style = self._read_json(
            os.path.join(clip_dir, "style_settings.json"), dict, None
        )
        if clip_style:
            style_settings.update(clip_style)
        style_settings = self._sanitize_style_settings(style_settings)

        # 3. Timeline (auto-extract legacy inline data:audio/... URIs if present)
        timeline_path = os.path.join(clip_dir, "timeline.json")
        timeline: List[Any] = self._read_json(timeline_path, list, [])
        timeline, timeline_migrated = self._extract_inline_audio_in_tracks(timeline)
        if timeline_migrated:
            self._atomic_write_json(timeline_path, timeline)

        # 4. History (auto-extract legacy inline data:audio/... URIs if present)
        history_path = os.path.join(clip_dir, "history.json")
        raw_history = self._read_json(history_path, dict, {})
        history: Dict[str, List[Any]] = {
            "undo_stack": raw_history.get("undo_stack") or [],
            "redo_stack": raw_history.get("redo_stack") or [],
        }
        history, history_migrated = self._extract_inline_audio_in_history(history)
        if history_migrated:
            self._atomic_write_json(history_path, history)

        # 5. Cover config + legacy thumbnail.jpg -> cover.jpg migration
        cover_config: Dict[str, Any] = dict(CANONICAL_DEFAULT_COVER_CONFIG)
        cover_path = os.path.join(clip_dir, "cover_config.json")
        thumb_config_path = os.path.join(clip_dir, "thumbnail_config.json")
        ref_cover = cover_path if os.path.exists(cover_path) else (
            thumb_config_path if os.path.exists(thumb_config_path) else None
        )
        if ref_cover:
            loaded_cover = self._read_json(ref_cover, dict, None)
            if loaded_cover:
                cover_config = loaded_cover

        cover_img_path = os.path.join(clip_dir, "cover.jpg")
        thumb_img_path = os.path.join(clip_dir, "thumbnail.jpg")
        if (
            not os.path.exists(cover_img_path)
            and cover_config.get("enabled")
            and os.path.exists(thumb_img_path)
        ):
            try:
                shutil.copy2(thumb_img_path, cover_img_path)
                self.invalidate_ready_clips_cache(folder_name, clip_id)
            except Exception:
                pass

        # 6. Crop map
        has_video = os.path.exists(os.path.join(clip_dir, "video.mp4"))
        if ensure_crop_map and has_video:
            crop_map = self.ensure_crop_map(folder_name, clip_id)
        else:
            crop_map = self.get_crop_map(folder_name, clip_id)

        has_thumb = os.path.exists(thumb_img_path)
        has_cover = os.path.exists(cover_img_path)

        return {
            "folder_name": folder_name,
            "clip_id": clip_id,
            "transcript": transcript,
            "style_settings": style_settings,
            "timeline": timeline,
            "history": history,
            "cover_config": cover_config,
            "crop_map": crop_map,
            "asset_url": f"/assets/clips/{folder_name}/{clip_id}/video.mp4" if has_video else None,
            "thumbnail_url": f"/assets/clips/{folder_name}/{clip_id}/thumbnail.jpg" if has_thumb else None,
            "cover_url": f"/assets/clips/{folder_name}/{clip_id}/cover.jpg" if has_cover else None,
        }

    def save_clip_session(self, folder_name: str, clip_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Atomically persists canonical clip session manifest patches without re-reading
        untouched files. Returns {"folder_name": folder_name, "clip_id": clip_id}.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        updates: Dict[str, Any] = {}
        for key, filename in _CANONICAL_MANIFEST_FILES.items():
            if key not in payload:
                continue
            value = payload[key]
            if key == "style_settings" and isinstance(value, dict):
                value = self._sanitize_style_settings(value)
            elif key == "timeline" and isinstance(value, list):
                value, _ = self._extract_inline_audio_in_tracks(value)
            elif key == "history" and isinstance(value, dict):
                value, _ = self._extract_inline_audio_in_history(value)
            updates[filename] = value

        staged_files: List[tuple[str, str]] = []
        try:
            for filename, data in updates.items():
                target_path = os.path.join(clip_dir, filename)
                tmp_path = f"{target_path}.tmp.{uuid.uuid4().hex}"
                staged_files.append((tmp_path, target_path))
                with open(tmp_path, "w", encoding="utf-8") as f:
                    self._dump_json_to_stream(f, target_path, data)
                    f.flush()
                    os.fsync(f.fileno())

            for tmp_path, target_path in staged_files:
                os.replace(tmp_path, target_path)
        except Exception:
            for tmp_path, _ in staged_files:
                if os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass
            raise

        return {"folder_name": folder_name, "clip_id": clip_id}

    def save_crop_map(self, folder_name: str, clip_id: str, crop_map: List[Any]) -> bool:
        """Saves auto-reframe crop map keyframes atomically."""
        self.save_clip_session(folder_name, clip_id, {"crop_map": crop_map})
        return True

    def get_crop_map(self, folder_name: str, clip_id: str) -> Optional[List[Any]]:
        """Retrieves cached auto-reframe crop map keyframes if present."""
        crop_map_path = self._resolve_clip_path(folder_name, clip_id, "crop_map.json")
        if os.path.exists(crop_map_path):
            try:
                with open(crop_map_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def _get_crop_map_lock(self, folder_name: str, clip_id: str) -> threading.Lock:
        key = (folder_name, clip_id)
        with self._crop_map_locks_guard:
            lock = self._crop_map_locks.get(key)
            if lock is None:
                lock = threading.Lock()
                self._crop_map_locks[key] = lock
            return lock

    @staticmethod
    def _normalize_cached_crop_map(existing: Any) -> Optional[List[Dict[str, Any]]]:
        if isinstance(existing, list) and len(existing) > 0:
            return existing
        if isinstance(existing, (int, float)) and not isinstance(existing, bool):
            return [{"time": 0.0, "x": int(existing)}]
        return None

    def ensure_crop_map(
        self,
        folder_name: str,
        clip_id: str,
        video_path: Optional[str] = None,
        tracker: Optional[Any] = None,
        words_data: Optional[List[Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves cached Auto-Reframe crop map if present, or executes face tracking
        under a per-clip single-flight lock to compute, normalize, and atomically persist crop_map.json.
        Falls back to centered framing ([{"time": 0.0, "x": 960}]) on empty results
        or tracker exceptions.
        """
        cached = self._normalize_cached_crop_map(self.get_crop_map(folder_name, clip_id))
        if cached is not None:
            return cached

        with self._get_crop_map_lock(folder_name, clip_id):
            cached = self._normalize_cached_crop_map(self.get_crop_map(folder_name, clip_id))
            if cached is not None:
                return cached

            active_tracker = tracker or self.face_tracker
            if not active_tracker:
                with self._face_tracker_lock:
                    if not self.face_tracker:
                        from core.face_tracker import FaceTracker
                        self.face_tracker = FaceTracker()
                    active_tracker = self.face_tracker

            resolved_video_path = video_path or self._resolve_clip_path(folder_name, clip_id, "video.mp4")
            if not os.path.exists(resolved_video_path):
                raise FileNotFoundError(f"Clip video not found at: {resolved_video_path}")

            crop_map_points: List[Dict[str, Any]]
            try:
                if words_data is not None:
                    crop_data = active_tracker.analyze_video(resolved_video_path, words_data=words_data)
                else:
                    crop_data = active_tracker.analyze_video(resolved_video_path)
                if isinstance(crop_data, (int, float)):
                    crop_map_points = [{"time": 0.0, "x": int(crop_data)}]
                elif isinstance(crop_data, list) and len(crop_data) > 0:
                    crop_map_points = crop_data
                else:
                    crop_map_points = [{"time": 0.0, "x": 960}]
            except Exception as e:
                print(f"[session] Face tracking failed for {resolved_video_path}, falling back to center: {e}")
                crop_map_points = [{"time": 0.0, "x": 960}]

            try:
                self.save_crop_map(folder_name, clip_id, crop_map_points)
            except Exception as e:
                print(f"[session] Failed to write crop_map.json: {e}")

            return crop_map_points

    def delete_cover(self, folder_name: str, clip_id: str) -> bool:
        """Safely removes custom cover image (cover.jpg) while strictly preserving thumbnail.jpg."""
        cover_path = self._resolve_clip_path(folder_name, clip_id, "cover.jpg")
        removed = False
        if os.path.exists(cover_path):
            try:
                os.remove(cover_path)
                removed = True
            except Exception:
                pass
        if removed:
            self.invalidate_ready_clips_cache(folder_name, clip_id)
        return True

    # ── Media Operations & Video Information ─────────────────────────

    def derive_clip_id(self, start_time: float, end_time: float, theme: Optional[str] = None) -> str:
        """Derives a deterministic, filesystem-safe clip_id from boundaries and theme."""
        safe_theme = ""
        if theme:
            safe_theme = re.sub(r'[^\w\s-]', '', theme).strip().replace(' ', '_')[:50]
        if safe_theme:
            return f"{int(start_time)}_{int(end_time)}_{safe_theme}"
        return f"{int(start_time)}_{int(end_time)}"

    def create_clip(
        self,
        video_path: str,
        start_time: float,
        end_time: float,
        theme: Optional[str] = None,
        *,
        extract_audio: bool = False,
    ) -> Dict[str, Any]:
        """
        Cuts a Ready Clip (video.mp4) and frame-0 Clip Thumbnail (thumbnail.jpg) in one
        FFmpeg pass (optionally producing an ephemeral WAV for transcription), and seeds
        default manifests (style, cover, transcript).
        """
        if not video_path or not os.path.exists(video_path):
            raise FileNotFoundError(f"Source video not found: {video_path}")
        if start_time < 0 or end_time <= start_time:
            raise ValueError(f"Invalid clip boundaries: start={start_time}, end={end_time}")

        folder_name = os.path.basename(os.path.dirname(video_path))
        clip_id = self.derive_clip_id(start_time, end_time, theme)
        target_dir = self.resolve_clip_dir(folder_name, clip_id)
        os.makedirs(target_dir, exist_ok=True)

        out_name = "video.mp4"
        out_path = os.path.join(target_dir, out_name)
        duration = round(end_time - start_time, 2)
        thumb_name = "thumbnail.jpg"
        thumb_path = os.path.join(target_dir, thumb_name)
        thumbnail_url = f"/assets/clips/{folder_name}/{clip_id}/{thumb_name}"
        cover_path = os.path.join(target_dir, "cover.jpg")
        cover_url = f"/assets/clips/{folder_name}/{clip_id}/cover.jpg" if os.path.exists(cover_path) else None

        result: Dict[str, Any] = {
            "file_path": out_path,
            "asset_url": f"/assets/clips/{folder_name}/{clip_id}/{out_name}",
            "thumbnail_url": thumbnail_url,
            "poster_url": thumbnail_url,
            "cover_url": cover_url,
            "duration": duration,
            "clip_id": clip_id,
            "folder_name": folder_name,
            "start": start_time,
            "end": end_time,
            "theme": theme,
        }

        if os.path.exists(out_path):
            self.ensure_clip_defaults(folder_name, clip_id)
            return result

        requested_audio_path = (
            os.path.join(tempfile.gettempdir(), f"yonru_clip_audio_{uuid.uuid4().hex}.wav")
            if extract_audio
            else None
        )
        extraction = self.transcoder.extract_clip_bundle(
            video_path,
            start_time,
            end_time,
            out_path,
            output_thumbnail_path=thumb_path,
            output_audio_path=requested_audio_path,
        )

        self.ensure_clip_defaults(folder_name, clip_id)
        self.invalidate_ready_clips_cache(folder_name, clip_id)

        if extract_audio:
            if extraction.audio_path:
                result["audio_path"] = extraction.audio_path
            else:
                result["audio_missing"] = True

        return result

    def extract_clip_audio(
        self,
        clip_path_or_folder: str,
        clip_id: Optional[str] = None,
        *,
        output_path: Optional[str] = None,
    ) -> str:
        """
        Extracts 16kHz mono WAV audio from the Ready Clip into an ephemeral temp file
        (or explicit output_path) for speech transcription.
        """
        if clip_id is not None:
            clip_dir = self.resolve_clip_dir(clip_path_or_folder, clip_id)
            clip_path = os.path.join(clip_dir, "video.mp4")
        else:
            clip_path = clip_path_or_folder

        if not os.path.exists(clip_path):
            raise FileNotFoundError(f"Clip video not found at: {clip_path}")

        target_wav_path = output_path or os.path.join(
            tempfile.gettempdir(), f"yonru_clip_audio_{uuid.uuid4().hex}.wav"
        )
        return self.transcoder.extract_audio(clip_path, target_wav_path, sample_rate=16000)

    def extract_cover_frame(
        self,
        folder_name: str,
        clip_id: str,
        timestamp: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Extracts a single frame from the Ready Clip as a custom Cover Slide frame (cover.jpg),
        with timestamp bounds clamping, strictly leaving the Clip Thumbnail (thumbnail.jpg) intact.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        clip_path = os.path.join(clip_dir, "video.mp4")
        if not os.path.exists(clip_path):
            raise ValueError(f"No clip video available at {clip_path}. Extract a clip first.")

        clip_duration = float(
            (self.transcoder.probe_video(clip_path).duration if self.transcoder else 0.0) or 10.0
        )

        if timestamp is not None:
            ts = max(0.0, min(float(timestamp), max(0.0, clip_duration - 0.1)))
        else:
            import random
            ts = random.uniform(0.5, max(0.6, clip_duration * 0.8))

        cover_path = os.path.join(clip_dir, "cover.jpg")
        success = self.extract_clip_screenshot(clip_path, ts, cover_path)
        if not success:
            raise RuntimeError("Failed to extract cover frame")

        self.invalidate_ready_clips_cache(folder_name, clip_id)
        asset_url = f"/assets/clips/{folder_name}/{clip_id}/cover.jpg"
        print(f"[cover] Captured frame at {ts:.3f}s -> {cover_path}")
        return {"status": "ok", "timestamp": round(ts, 3), "cover_url": asset_url, "thumbnail_url": asset_url}

    def extract_clip_screenshot(self, clip_path: str, timestamp: float, output_path: str) -> bool:
        """Extract a single frame screenshot from video at timestamp."""
        if not clip_path or not os.path.exists(clip_path):
            return False
        return self.transcoder.capture_screenshot(clip_path, timestamp, output_path)

    # ── Ready Clips Discovery & Lifecycle ────────────────────────────

    def invalidate_ready_clips_cache(
        self,
        folder_name: Optional[str] = None,
        clip_id: Optional[str] = None,
    ) -> None:
        """Invalidate cached Ready Clip metadata entries safely across threads."""
        with self._index_lock:
            self._cache_epoch += 1
            if folder_name is None:
                self._ready_clip_cache.clear()
                self._parent_meta_cache.clear()
                return
            if clip_id is not None:
                self._ready_clip_cache.pop((folder_name, clip_id), None)
                return
            stale_keys = [k for k in self._ready_clip_cache if k[0] == folder_name]
            for key in stale_keys:
                self._ready_clip_cache.pop(key, None)
            self._parent_meta_cache.pop(folder_name, None)

    @staticmethod
    def _parse_clip_id_metadata(clip_id: str) -> Tuple[float, float, str, bool]:
        """Parse start/end timestamps, display theme, and numeric bound validity from clip_id."""
        parts = clip_id.split("_")
        if len(parts) >= 2:
            try:
                start_time = float(parts[0])
                end_time = float(parts[1])
                if math.isfinite(start_time) and math.isfinite(end_time):
                    if len(parts) >= 3:
                        theme = " ".join(parts[2:]).replace("_", " ")
                    else:
                        m1, s1 = divmod(int(start_time), 60)
                        m2, s2 = divmod(int(end_time), 60)
                        theme = f"Clip {m1:02d}:{s1:02d} - {m2:02d}:{s2:02d}"
                    return start_time, end_time, theme, end_time > start_time
            except Exception:
                pass
        return 0.0, 0.0, "", False

    def _resolve_parent_metadata(
        self,
        parent_name: str,
        meta_cache: Optional[Dict[str, Tuple[str, Optional[str]]]] = None,
    ) -> Tuple[str, Optional[str]]:
        """Read and cache parent video title and channel from metadata.json with folder-name fallback."""
        if meta_cache is not None and parent_name in meta_cache:
            return meta_cache[parent_name]

        meta_path = os.path.join(self.source_dir, parent_name, "metadata.json")
        meta_sig: Optional[Tuple[int, int]] = None
        try:
            st = os.stat(meta_path)
            meta_sig = (st.st_mtime_ns, st.st_size)
        except OSError:
            meta_sig = None

        with self._index_lock:
            cached = self._parent_meta_cache.get(parent_name)
            if cached is not None and cached[0] == meta_sig:
                if meta_cache is not None:
                    meta_cache[parent_name] = cached[1]
                return cached[1]

        title = "Unknown Clip"
        channel: Optional[str] = None
        if meta_sig is not None:
            try:
                with open(meta_path, "r", encoding="utf-8") as mf:
                    meta = json.load(mf)
                    if isinstance(meta, dict):
                        raw_title = meta.get("title") or meta.get("raw_title")
                        if isinstance(raw_title, str) and raw_title.strip():
                            title = raw_title.strip()
                        raw_channel = meta.get("channel") or meta.get("uploader")
                        if isinstance(raw_channel, str) and raw_channel.strip():
                            channel = raw_channel.strip()
            except Exception:
                pass

        if channel is None and parent_name.startswith("[") and "] " in parent_name:
            parsed_channel = parent_name[1 : parent_name.index("] ")].strip()
            if parsed_channel:
                channel = parsed_channel

        if title == "Unknown Clip" and "_" in parent_name:
            raw_p = " ".join(parent_name.split("_")[:-1])
            if raw_p.startswith("[") and "] " in raw_p:
                raw_p = raw_p.split("] ", 1)[1]
            if raw_p:
                title = raw_p

        result = (title, channel)
        with self._index_lock:
            self._parent_meta_cache[parent_name] = (meta_sig, result)
        if meta_cache is not None:
            meta_cache[parent_name] = result
        return result

    def list_all_clips(self) -> List[Dict[str, Any]]:
        """Scans the clips directory read-only and returns mtime-cached metadata for all ready clips."""
        with self._index_lock:
            start_epoch = self._cache_epoch

        if not os.path.exists(self.clips_dir):
            with self._index_lock:
                if self._cache_epoch == start_epoch:
                    self._ready_clip_cache.clear()
                    self._parent_meta_cache.clear()
            return []

        try:
            video_entries = list(os.scandir(self.clips_dir))
        except OSError:
            return []

        results: List[Dict[str, Any]] = []
        call_meta_cache: Dict[str, Tuple[str, Optional[str]]] = {}
        seen_keys: Set[Tuple[str, str]] = set()
        seen_parents: Set[str] = set()
        new_entries: Dict[Tuple[str, str], Tuple[Tuple[Any, ...], Dict[str, Any]]] = {}

        for video_entry in video_entries:
            if not video_entry.is_dir():
                continue
            parent_name = video_entry.name
            seen_parents.add(parent_name)
            try:
                clip_entries = list(os.scandir(video_entry.path))
            except OSError:
                continue

            title, channel = self._resolve_parent_metadata(parent_name, call_meta_cache)

            for clip_entry in clip_entries:
                if not clip_entry.is_dir():
                    continue
                clip_id = clip_entry.name
                video_path = os.path.join(clip_entry.path, "video.mp4")
                try:
                    video_stat = os.stat(video_path)
                except OSError:
                    continue

                mtime = video_stat.st_mtime
                has_thumb = os.path.exists(os.path.join(clip_entry.path, "thumbnail.jpg"))
                has_poster = (not has_thumb) and os.path.exists(os.path.join(clip_entry.path, "poster.jpg"))
                has_cover = os.path.exists(os.path.join(clip_entry.path, "cover.jpg"))

                fingerprint = (
                    video_stat.st_mtime_ns,
                    video_stat.st_size,
                    has_thumb,
                    has_poster,
                    has_cover,
                    title,
                    channel,
                )
                cache_key = (parent_name, clip_id)
                seen_keys.add(cache_key)

                cached_entry: Optional[Dict[str, Any]] = None
                with self._index_lock:
                    cached = self._ready_clip_cache.get(cache_key)
                    if cached is not None and cached[0] == fingerprint:
                        cached_entry = cached[1]

                if cached_entry is not None:
                    results.append(dict(cached_entry))
                    continue

                start_time, end_time, theme, has_valid_bounds = self._parse_clip_id_metadata(clip_id)
                if has_valid_bounds:
                    duration = round(end_time - start_time, 3)
                else:
                    duration = self.transcoder.probe_video(video_path).duration if self.transcoder else 0.0

                thumbnail_url = (
                    f"/assets/clips/{parent_name}/{clip_id}/thumbnail.jpg"
                    if has_thumb
                    else (
                        f"/assets/clips/{parent_name}/{clip_id}/poster.jpg"
                        if has_poster
                        else None
                    )
                )
                cover_url = (
                    f"/assets/clips/{parent_name}/{clip_id}/cover.jpg"
                    if has_cover
                    else None
                )

                entry: Dict[str, Any] = {
                    "clip_id": clip_id,
                    "folder_name": parent_name,
                    "title": title,
                    "channel": channel,
                    "theme": theme,
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration": duration,
                    "mtime": mtime,
                    "asset_url": f"/assets/clips/{parent_name}/{clip_id}/video.mp4",
                    "thumbnail_url": thumbnail_url,
                    "poster_url": thumbnail_url,
                    "cover_url": cover_url,
                }
                new_entries[cache_key] = (fingerprint, entry)
                results.append(dict(entry))

        with self._index_lock:
            if self._cache_epoch == start_epoch:
                self._ready_clip_cache.update(new_entries)
                stale_clip_keys = [k for k in self._ready_clip_cache if k not in seen_keys]
                for key in stale_clip_keys:
                    self._ready_clip_cache.pop(key, None)
                stale_parent_keys = [p for p in self._parent_meta_cache if p not in seen_parents]
                for parent in stale_parent_keys:
                    self._parent_meta_cache.pop(parent, None)

        results.sort(key=lambda x: x["mtime"], reverse=True)
        return results

    def list_ready_clips(
        self,
        active_clip_ids: Optional[Set[str]] = None
    ) -> List[Dict[str, Any]]:
        """List all ready clips, filtering out clips currently being processed."""
        clips = self.list_all_clips()
        if not active_clip_ids:
            return clips
        return [c for c in clips if c.get("clip_id") not in active_clip_ids]

    def delete_clip(self, folder_name: str, clip_id: str) -> bool:
        """Delete a specific clip folder securely."""
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        if os.path.exists(clip_dir) and os.path.isdir(clip_dir):
            shutil.rmtree(clip_dir)
            # Clean up parent folder if empty
            parent_dir = os.path.dirname(clip_dir)
            if os.path.exists(parent_dir) and os.path.isdir(parent_dir):
                if not os.listdir(parent_dir):
                    try:
                        os.rmdir(parent_dir)
                    except OSError:
                        pass
            self.invalidate_ready_clips_cache(folder_name, clip_id)
            return True
        return False

    def delete_clip_with_job(self, folder_name: str, clip_id: str, job_store: Any = None) -> bool:
        """Delete a specific clip folder and clean up any associated JobStore session."""
        success = self.delete_clip(folder_name, clip_id)
        if success and job_store is not None:
            hash_input = f"{folder_name}_{clip_id}"
            derived_job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
            job_store.delete_job(derived_job_id)
        return success

    def delete_batch(self, clips: List[Dict[str, str]], job_store: Any = None) -> List[Dict[str, Any]]:
        """Batch delete multiple clips."""
        results = []
        for c in clips:
            f_name = c.get("folder_name", "")
            c_id = c.get("clip_id", "")
            if f_name and c_id:
                try:
                    deleted = self.delete_clip_with_job(f_name, c_id, job_store=job_store)
                    results.append({"folder_name": f_name, "clip_id": c_id, "success": deleted})
                except Exception as e:
                    results.append({"folder_name": f_name, "clip_id": c_id, "success": False, "error": str(e)})
        return results

    def delete_source_clips(self, folder_name: str, job_store: Any = None) -> int:
        """Delete all clips under a source folder securely and clean up associated JobStore sessions."""
        if not folder_name or "/" in folder_name or "\\" in folder_name or "\0" in folder_name:
            raise ValueError(f"Path traversal detected: {folder_name}")
        if folder_name.strip() in {".", ".."} or ".." in folder_name or os.path.isabs(folder_name):
            raise ValueError(f"Path traversal detected: {folder_name}")

        base_clips = os.path.abspath(self.clips_dir)
        source_clips_dir = os.path.abspath(os.path.join(base_clips, folder_name))
        if os.path.commonpath([base_clips, source_clips_dir]) != base_clips:
            raise ValueError(f"Path traversal detected: {folder_name}")

        deleted_count = 0
        if os.path.exists(source_clips_dir) and os.path.isdir(source_clips_dir):
            if job_store is not None:
                job_store.cancel_source_jobs(
                    folder_name,
                    reason="Clip deleted by user.",
                    active_only=True,
                )

            clip_dirs = [d for d in os.listdir(source_clips_dir) if os.path.isdir(os.path.join(source_clips_dir, d))]
            deleted_count = len(clip_dirs) or 1
            shutil.rmtree(source_clips_dir)

        if deleted_count > 0:
            self.invalidate_ready_clips_cache(folder_name)

        return deleted_count

    # ── Global Default Style Settings ───────────────────────────────

    def get_default_style_settings(self) -> Dict[str, Any]:
        """Retrieves global default style settings."""
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        if os.path.exists(default_style_path):
            try:
                with open(default_style_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        return self._sanitize_style_settings(data)
            except Exception:
                pass
        return dict(CANONICAL_DEFAULT_STYLE_SETTINGS)

    def save_default_style_settings(self, settings: Dict[str, Any]) -> bool:
        """Atomically saves global default style settings."""
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        try:
            clean_settings = (
                self._sanitize_style_settings(settings)
                if isinstance(settings, dict)
                else settings
            )
            self._atomic_write_json(default_style_path, clean_settings)
            return True
        except Exception:
            return False

    def get_default_cover_style(self) -> Dict[str, Any]:
        """Retrieves global default cover style settings."""
        default_cover_path = os.path.join(self.output_dir, "default_cover_style.json")
        if os.path.exists(default_cover_path):
            try:
                with open(default_cover_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        return data
            except Exception:
                pass
        default_thumb_path = os.path.join(self.output_dir, "default_thumbnail_style.json")
        if os.path.exists(default_thumb_path):
            try:
                with open(default_thumb_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        return data
            except Exception:
                pass
        return dict(CANONICAL_DEFAULT_COVER_CONFIG)

    def save_default_cover_style(self, style: Dict[str, Any]) -> bool:
        """Atomically saves global default cover style settings."""
        default_cover_path = os.path.join(self.output_dir, "default_cover_style.json")
        try:
            self._atomic_write_json(default_cover_path, style)
            return True
        except Exception:
            return False

    def is_audio_asset_referenced(self, filename: str, url: str) -> bool:
        """Checks whether any saved clip session manifest references the given audio asset."""
        if not self.clips_dir or not os.path.isdir(self.clips_dir):
            return False
        for root, _, files in os.walk(self.clips_dir):
            for manifest_name in ("timeline.json", "history.json"):
                if manifest_name in files:
                    manifest_path = os.path.join(root, manifest_name)
                    try:
                        with open(manifest_path, "r", encoding="utf-8") as f:
                            raw = f.read()
                        if url in raw or f"/audio_library/{filename}" in raw:
                            return True
                    except Exception:
                        continue
        return False



