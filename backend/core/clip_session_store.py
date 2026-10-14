import os
import re
import json
import uuid
import shutil
from typing import Optional, Dict, Any, List

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

    def __init__(self, clips_dir: str = "temp_assets/clips", output_dir: Optional[str] = None):
        self.clips_dir = os.path.abspath(clips_dir)
        self.output_dir = os.path.abspath(output_dir) if output_dir else os.path.abspath(os.path.dirname(self.clips_dir))

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

        return target

    def _resolve_clip_path(self, folder_name: str, clip_id: str, filename: str) -> str:
        """Resolves an individual file inside a clip directory."""
        if "/" in filename or "\\" in filename or ".." in filename:
            raise ValueError(f"Path traversal detected in filename: {filename}")
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        return os.path.join(clip_dir, filename)

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
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, target_path)
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass

    def ensure_clip_defaults(self, folder_name: str, clip_id: str) -> None:
        """
        Auto-heals missing manifests (style_settings, cover_config, transcript,
        timeline, history, thumbnail) in the clip directory using canonical defaults.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # 1. Style settings
        clip_style_path = os.path.join(clip_dir, "style_settings.json")
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        if not os.path.exists(clip_style_path):
            style_data = CANONICAL_DEFAULT_STYLE_SETTINGS
            if os.path.exists(default_style_path):
                try:
                    with open(default_style_path, "r", encoding="utf-8") as f:
                        loaded = json.load(f)
                        if isinstance(loaded, dict):
                            style_data = loaded
                except Exception:
                    style_data = CANONICAL_DEFAULT_STYLE_SETTINGS
            else:
                try:
                    self._atomic_write_json(default_style_path, CANONICAL_DEFAULT_STYLE_SETTINGS)
                except Exception:
                    pass
            self._atomic_write_json(clip_style_path, style_data)

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
            self._atomic_write_json(clip_thumb_path, cover_data)
        elif not os.path.exists(clip_cover_path) and os.path.exists(clip_thumb_path):
            # Sync cover from thumbnail config
            try:
                shutil.copy2(clip_thumb_path, clip_cover_path)
            except Exception:
                pass
        elif os.path.exists(clip_cover_path) and not os.path.exists(clip_thumb_path):
            # Sync thumbnail config from cover
            try:
                shutil.copy2(clip_cover_path, clip_thumb_path)
            except Exception:
                pass

        # 3. Transcript
        clip_transcript_path = os.path.join(clip_dir, "transcript.json")
        if not os.path.exists(clip_transcript_path):
            self._atomic_write_json(clip_transcript_path, [])

        # 4. Thumbnail image from poster
        thumb_img_path = os.path.join(clip_dir, "thumbnail.jpg")
        poster_img_path = os.path.join(clip_dir, "poster.jpg")
        if not os.path.exists(thumb_img_path) and os.path.exists(poster_img_path):
            try:
                shutil.copy2(poster_img_path, thumb_img_path)
            except Exception:
                pass

    def get_clip_session(self, folder_name: str, clip_id: str) -> Dict[str, Any]:
        """
        Retrieves the complete aggregate state of a clip (transcript, style settings,
        timeline tracks, history stacks, cover configuration, crop map), auto-healing
        missing defaults if necessary.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        if not os.path.exists(clip_dir):
            os.makedirs(clip_dir, exist_ok=True)

        self.ensure_clip_defaults(folder_name, clip_id)

        # 1. Transcript
        transcript: List[Any] = []
        transcript_path = os.path.join(clip_dir, "transcript.json")
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8") as f:
                    transcript = json.load(f)
            except Exception:
                transcript = []

        # 2. Style settings
        style_settings: Dict[str, Any] = dict(CANONICAL_DEFAULT_STYLE_SETTINGS)
        style_path = os.path.join(clip_dir, "style_settings.json")
        if os.path.exists(style_path):
            try:
                with open(style_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        style_settings = loaded
            except Exception:
                pass

        # 3. Timeline
        timeline: List[Any] = []
        timeline_path = os.path.join(clip_dir, "timeline.json")
        if os.path.exists(timeline_path):
            try:
                with open(timeline_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, list):
                        timeline = loaded
            except Exception:
                timeline = []

        # 4. History
        history: Dict[str, List[Any]] = {"undo_stack": [], "redo_stack": []}
        history_path = os.path.join(clip_dir, "history.json")
        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        history = {
                            "undo_stack": loaded.get("undo_stack") or [],
                            "redo_stack": loaded.get("redo_stack") or []
                        }
            except Exception:
                history = {"undo_stack": [], "redo_stack": []}

        # 5. Cover config
        cover_config: Dict[str, Any] = dict(CANONICAL_DEFAULT_COVER_CONFIG)
        cover_path = os.path.join(clip_dir, "cover_config.json")
        thumb_path = os.path.join(clip_dir, "thumbnail_config.json")
        ref_cover = cover_path if os.path.exists(cover_path) else (thumb_path if os.path.exists(thumb_path) else None)
        if ref_cover:
            try:
                with open(ref_cover, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                    if isinstance(loaded, dict):
                        cover_config = loaded
            except Exception:
                pass

        # 6. Crop map
        crop_map = None
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        if os.path.exists(crop_map_path):
            try:
                with open(crop_map_path, "r", encoding="utf-8") as f:
                    crop_map = json.load(f)
            except Exception:
                crop_map = None

        # Asset presence & URLs
        has_video = os.path.exists(os.path.join(clip_dir, "video.mp4"))
        has_thumb = os.path.exists(os.path.join(clip_dir, "thumbnail.jpg"))
        has_cover = os.path.exists(os.path.join(clip_dir, "cover.jpg"))

        return {
            "folder_name": folder_name,
            "clip_id": clip_id,
            "transcript": transcript,
            "style_settings": style_settings,
            "timeline": timeline,
            "timeline_tracks": timeline,
            "history": history,
            "undo_stack": history["undo_stack"],
            "redo_stack": history["redo_stack"],
            "cover_config": cover_config,
            "crop_map": crop_map,
            "asset_url": f"/assets/clips/{folder_name}/{clip_id}/video.mp4" if has_video else None,
            "thumbnail_url": f"/assets/clips/{folder_name}/{clip_id}/thumbnail.jpg" if has_thumb else None,
            "cover_url": f"/assets/clips/{folder_name}/{clip_id}/cover.jpg" if has_cover else None,
        }

    def save_clip_session(self, folder_name: str, clip_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Atomically persists partial or complete clip manifests.
        Writes all updated files to temporary staging files (.tmp.<uuid>) before
        atomically replacing target files with os.replace.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        updates: Dict[str, Any] = {}

        if "transcript" in payload:
            updates["transcript.json"] = payload["transcript"]

        if "style_settings" in payload:
            updates["style_settings.json"] = payload["style_settings"]
        elif "settings" in payload:
            updates["style_settings.json"] = payload["settings"]

        if "timeline" in payload:
            updates["timeline.json"] = payload["timeline"]
        elif "timeline_tracks" in payload:
            updates["timeline.json"] = payload["timeline_tracks"]

        if "history" in payload:
            updates["history.json"] = payload["history"]
        elif "undo_stack" in payload or "redo_stack" in payload:
            existing_history_path = os.path.join(clip_dir, "history.json")
            undo_stack = payload.get("undo_stack", [])
            redo_stack = payload.get("redo_stack", [])
            if os.path.exists(existing_history_path):
                try:
                    with open(existing_history_path, "r", encoding="utf-8") as f:
                        curr = json.load(f)
                        if "undo_stack" not in payload:
                            undo_stack = curr.get("undo_stack", [])
                        if "redo_stack" not in payload:
                            redo_stack = curr.get("redo_stack", [])
                except Exception:
                    pass
            updates["history.json"] = {"undo_stack": undo_stack, "redo_stack": redo_stack}

        if "cover_config" in payload:
            updates["cover_config.json"] = payload["cover_config"]
            updates["thumbnail_config.json"] = payload["cover_config"]
        elif "thumbnail_config" in payload:
            updates["cover_config.json"] = payload["thumbnail_config"]
            updates["thumbnail_config.json"] = payload["thumbnail_config"]
        elif "config" in payload:
            updates["cover_config.json"] = payload["config"]
            updates["thumbnail_config.json"] = payload["config"]

        if "crop_map" in payload:
            updates["crop_map.json"] = payload["crop_map"]

        staged_files: List[tuple[str, str]] = []
        try:
            for filename, data in updates.items():
                target_path = os.path.join(clip_dir, filename)
                tmp_path = f"{target_path}.tmp.{uuid.uuid4().hex}"
                staged_files.append((tmp_path, target_path))
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                    f.flush()
                    os.fsync(f.fileno())

            # Atomically replace each target file
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

        return self.get_clip_session(folder_name, clip_id)

    # ── Convenience Methods & Backward Compatibility Adapters ────────

    def save_transcript(self, folder_name: str, clip_id: str, transcript: List[Any]) -> bool:
        """Saves clip transcript atomically."""
        self.save_clip_session(folder_name, clip_id, {"transcript": transcript})
        return True

    def save_style_settings(self, folder_name: str, clip_id: str, settings: Dict[str, Any]) -> bool:
        """Saves clip style settings atomically."""
        self.save_clip_session(folder_name, clip_id, {"style_settings": settings})
        return True

    def save_timeline(self, folder_name: str, clip_id: str, timeline_tracks: List[Any]) -> bool:
        """Saves clip timeline tracks atomically."""
        self.save_clip_session(folder_name, clip_id, {"timeline": timeline_tracks})
        return True

    def save_history(self, folder_name: str, clip_id: str, undo_stack: List[Any], redo_stack: List[Any]) -> bool:
        """Saves clip timeline undo/redo history stacks atomically."""
        self.save_clip_session(folder_name, clip_id, {"undo_stack": undo_stack, "redo_stack": redo_stack})
        return True

    def save_cover_config(self, folder_name: str, clip_id: str, config: Dict[str, Any]) -> bool:
        """Saves clip cover configuration atomically (and syncs thumbnail_config.json)."""
        self.save_clip_session(folder_name, clip_id, {"cover_config": config})
        return True

    def get_cover_config(self, folder_name: str, clip_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves clip cover configuration with fallback to thumbnail_config.json."""
        cover_path = self._resolve_clip_path(folder_name, clip_id, "cover_config.json")
        if os.path.exists(cover_path):
            try:
                with open(cover_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        thumb_path = self._resolve_clip_path(folder_name, clip_id, "thumbnail_config.json")
        if os.path.exists(thumb_path):
            try:
                with open(thumb_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

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

    def delete_cover(self, folder_name: str, clip_id: str) -> bool:
        """Safely removes custom cover image (cover.jpg) while strictly preserving thumbnail.jpg."""
        cover_path = self._resolve_clip_path(folder_name, clip_id, "cover.jpg")
        if os.path.exists(cover_path):
            try:
                os.remove(cover_path)
            except Exception:
                pass
        return True

    def migrate_legacy_cover_if_needed(self, folder_name: str, clip_id: str) -> Optional[str]:
        """Auto-migrates legacy cover.jpg from thumbnail.jpg if cover slide is enabled."""
        cover_path = self._resolve_clip_path(folder_name, clip_id, "cover.jpg")
        if os.path.exists(cover_path):
            return f"/assets/clips/{folder_name}/{clip_id}/cover.jpg"

        config = self.get_cover_config(folder_name, clip_id)
        if config and config.get("enabled"):
            thumb_path = self._resolve_clip_path(folder_name, clip_id, "thumbnail.jpg")
            if os.path.exists(thumb_path):
                try:
                    shutil.copy2(thumb_path, cover_path)
                    return f"/assets/clips/{folder_name}/{clip_id}/cover.jpg"
                except Exception:
                    pass
        return None


