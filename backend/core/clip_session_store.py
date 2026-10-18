import os
import re
import sys
import json
import uuid
import shutil
import hashlib
import subprocess
from typing import Optional, Dict, Any, List, Set
from core.media_transcoder import MediaTranscoder, MediaProcessAdapter

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
        face_tracker: Optional[Any] = None
    ):
        self.clips_dir = clips_dir
        self.output_dir = output_dir if output_dir else os.path.dirname(self.clips_dir)
        self.source_dir = os.path.join(self.output_dir, "sources")
        self.config_store = config_store
        self.transcoder = media_transcoder or MediaTranscoder(config_store=self.config_store)
        self._env = getattr(self.transcoder.adapter, "_env", os.environ.copy())
        self.face_tracker = face_tracker

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

    def ensure_clip_defaults(self, folder_name: str, clip_id: str, screenshot_fn: Optional[Any] = None) -> None:
        """
        Auto-heals missing manifests (style_settings, cover_config, transcript,
        timeline, history, thumbnail) in the clip directory using canonical defaults.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        os.makedirs(clip_dir, exist_ok=True)

        # 1. Style settings
        clip_style_path = os.path.join(clip_dir, "style_settings.json")
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        if not os.path.exists(default_style_path):
            try:
                self._atomic_write_json(default_style_path, CANONICAL_DEFAULT_STYLE_SETTINGS)
            except Exception:
                pass

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

        # 4. Thumbnail image from poster or video frame
        thumb_img_path = os.path.join(clip_dir, "thumbnail.jpg")
        poster_img_path = os.path.join(clip_dir, "poster.jpg")
        if not os.path.exists(thumb_img_path) and os.path.exists(poster_img_path):
            try:
                shutil.copy2(poster_img_path, thumb_img_path)
            except Exception:
                pass
        elif not os.path.exists(thumb_img_path):
            video_path = os.path.join(clip_dir, "video.mp4")
            if os.path.exists(video_path):
                try:
                    if screenshot_fn:
                        screenshot_fn(video_path, 0.0, thumb_img_path)
                    else:
                        self.extract_clip_screenshot(video_path, 0.0, thumb_img_path)
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

    def ensure_crop_map(
        self,
        folder_name: str,
        clip_id: str,
        video_path: Optional[str] = None,
        tracker: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves cached Auto-Reframe crop map if present, or executes face tracking
        to compute, normalize, and atomically persist crop_map.json.
        Falls back to centered framing ([{"time": 0.0, "x": 960}]) on empty results
        or tracker exceptions.
        """
        existing = self.get_crop_map(folder_name, clip_id)
        if existing and len(existing) > 0:
            return existing

        active_tracker = tracker or self.face_tracker
        if not active_tracker:
            from core.face_tracker import FaceTracker
            active_tracker = FaceTracker()

        resolved_video_path = video_path or self._resolve_clip_path(folder_name, clip_id, "video.mp4")

        crop_map_points: List[Dict[str, Any]]
        try:
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
        theme: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cuts a Ready Clip (video.mp4) from a Source Video interval, auto-generates the static
        Clip Thumbnail (thumbnail.jpg), and seeds default manifests (style, cover, timeline, history).
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

        if os.path.exists(out_path):
            if not os.path.exists(thumb_path):
                poster_path = os.path.join(target_dir, "poster.jpg")
                if os.path.exists(poster_path):
                    try:
                        shutil.copy2(poster_path, thumb_path)
                    except Exception:
                        pass
                else:
                    try:
                        self.extract_clip_screenshot(out_path, 0.0, thumb_path)
                    except Exception as e:
                        print(f"[clip_session_store] Failed to extract thumbnail for existing clip: {e}")
            self.ensure_clip_defaults(folder_name, clip_id)
            return {
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
                "theme": theme
            }

        cmd = [
            "-accurate_seek",
            "-ss", str(start_time),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "superfast",
            "-crf", "23",
            "-c:a", "aac",
            "-avoid_negative_ts", "auto",
            "-y", out_path
        ]
        self._run_ffmpeg(cmd)

        try:
            self.extract_clip_screenshot(out_path, 0.0, thumb_path)
        except Exception as e:
            print(f"[clip_session_store] Failed to extract thumbnail for new clip: {e}")

        self.ensure_clip_defaults(folder_name, clip_id)

        return {
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
            "theme": theme
        }

    def extract_clip_audio(self, clip_path_or_folder: str, clip_id: Optional[str] = None) -> str:
        """
        Extracts high-stability 16kHz mono WAV audio (audio_v2.wav) from the Ready Clip
        for speech transcription. Accepts either absolute clip_path or (folder_name, clip_id).
        """
        if clip_id is not None:
            clip_dir = self.resolve_clip_dir(clip_path_or_folder, clip_id)
            clip_path = os.path.join(clip_dir, "video.mp4")
        else:
            clip_path = clip_path_or_folder
            clip_dir = os.path.dirname(clip_path)

        if not os.path.exists(clip_path):
            raise FileNotFoundError(f"Clip video not found at: {clip_path}")

        audio_path = os.path.join(clip_dir, "audio_v2.wav")
        if os.path.exists(audio_path):
            return audio_path

        self._run_ffmpeg([
            "-i", clip_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "16000",
            "-ac", "1",
            "-y", audio_path
        ])
        return audio_path

    def extract_cover_frame(
        self,
        folder_name: str,
        clip_id: str,
        timestamp: Optional[float] = None,
        screenshot_fn: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Extracts a single frame from the Ready Clip as a custom Cover Slide frame (cover.jpg),
        with timestamp bounds clamping, strictly leaving the Clip Thumbnail (thumbnail.jpg) intact.
        """
        clip_dir = self.resolve_clip_dir(folder_name, clip_id)
        clip_path = os.path.join(clip_dir, "video.mp4")
        if not os.path.exists(clip_path):
            raise ValueError(f"No clip video available at {clip_path}. Extract a clip first.")

        clip_duration = float(self.get_video_duration(clip_path) or 10.0)

        if timestamp is not None:
            ts = max(0.0, min(float(timestamp), max(0.0, clip_duration - 0.1)))
        else:
            import random
            ts = random.uniform(0.5, max(0.6, clip_duration * 0.8))

        cover_path = os.path.join(clip_dir, "cover.jpg")
        extract_fn = screenshot_fn or self.extract_clip_screenshot
        success = extract_fn(clip_path, ts, cover_path)
        if not success:
            raise RuntimeError("Failed to extract cover frame")

        asset_url = f"/assets/clips/{folder_name}/{clip_id}/cover.jpg"
        print(f"[cover] Captured frame at {ts:.3f}s -> {cover_path}")
        return {"status": "ok", "timestamp": round(ts, 3), "cover_url": asset_url, "thumbnail_url": asset_url}

    def _run_ffmpeg(self, args: list) -> bool:
        return self.transcoder.run_ffmpeg(args)

    def extract_clip_screenshot(self, clip_path: str, timestamp: float, output_path: str) -> bool:
        """Extract a single frame screenshot from video at timestamp."""
        if not os.path.exists(clip_path):
            return False
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        dur = self.get_video_duration(clip_path)
        if dur > 0:
            ts = max(0.0, min(float(timestamp), max(0.0, dur - 0.1)))
        else:
            ts = max(0.0, float(timestamp))
        cmd = [
            "-y",
            "-ss", str(round(ts, 3)),
            "-i", clip_path,
            "-vframes", "1",
            "-q:v", "2",
            output_path
        ]
        try:
            res = self._run_ffmpeg(cmd)
            return res and os.path.exists(output_path)
        except Exception as e:
            print(f"[clip_session_store] Failed to extract screenshot: {e}")
            return False

    def _ffprobe_info(self, file_path: str) -> dict:
        """Get video metadata via ffprobe."""
        return self.transcoder.adapter.ffprobe_info(file_path)

    def get_video_duration(self, file_path: str) -> float:
        """Returns video duration in seconds."""
        info = self._ffprobe_info(file_path)
        for stream in info.get("streams", []):
            if stream.get("codec_type") == "video" and stream.get("duration"):
                try:
                    return float(stream["duration"])
                except Exception:
                    pass
        fmt = info.get("format", {})
        try:
            return float(fmt.get("duration", 0))
        except (ValueError, TypeError):
            return 0.0



    # ── Ready Clips Discovery & Lifecycle ────────────────────────────

    def list_all_clips(
        self,
        screenshot_fn: Optional[Any] = None,
        duration_fn: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """Scans the clips directory and returns metadata for all ready clips."""
        results = []
        if not os.path.exists(self.clips_dir):
            return results

        try:
            video_entries = list(os.scandir(self.clips_dir))
        except OSError:
            return results

        for video_entry in video_entries:
            if video_entry.is_dir():
                parent_name = video_entry.name
                try:
                    clip_entries = list(os.scandir(video_entry.path))
                except OSError:
                    continue

                for clip_entry in clip_entries:
                    if not clip_entry.is_dir():
                        continue
                    clip_id = clip_entry.name
                    video_path = os.path.join(clip_entry.path, "video.mp4")
                    if not os.path.exists(video_path):
                        continue

                    # Ensure defaults / thumbnail auto-healing
                    try:
                        self.ensure_clip_defaults(parent_name, clip_id, screenshot_fn=screenshot_fn)
                    except Exception:
                        pass

                    mtime = os.path.getmtime(video_path)
                    duration = duration_fn(video_path) if duration_fn else self.get_video_duration(video_path)

                    title = "Unknown Clip"
                    meta_path = os.path.join(self.source_dir, parent_name, "metadata.json")
                    if os.path.exists(meta_path):
                        try:
                            with open(meta_path, "r", encoding="utf-8") as mf:
                                meta = json.load(mf)
                                title = meta.get("title") or meta.get("raw_title") or "Unknown Clip"
                        except Exception:
                            pass
                    if title == "Unknown Clip" and "_" in parent_name:
                        raw_p = " ".join(parent_name.split("_")[:-1])
                        if raw_p.startswith("[") and "] " in raw_p:
                            raw_p = raw_p.split("] ", 1)[1]
                        title = raw_p

                    theme = ""
                    start_time = 0.0
                    end_time = 0.0
                    parts = clip_id.split("_")
                    if len(parts) >= 2:
                        try:
                            start_time = float(parts[0])
                            end_time = float(parts[1])
                            if len(parts) >= 3:
                                theme = " ".join(parts[2:])
                            else:
                                m1, s1 = divmod(int(start_time), 60)
                                m2, s2 = divmod(int(end_time), 60)
                                theme = f"Clip {m1:02d}:{s1:02d} - {m2:02d}:{s2:02d}"
                        except Exception:
                            pass

                    thumbnail_url = f"/assets/clips/{parent_name}/{clip_id}/thumbnail.jpg"
                    cover_path = os.path.join(clip_entry.path, "cover.jpg")
                    cover_url = f"/assets/clips/{parent_name}/{clip_id}/cover.jpg" if os.path.exists(cover_path) else None

                    results.append({
                        "clip_id": clip_id,
                        "folder_name": parent_name,
                        "title": title,
                        "theme": theme.replace("_", " "),
                        "start_time": start_time,
                        "end_time": end_time,
                        "duration": duration,
                        "mtime": mtime,
                        "asset_url": f"/assets/clips/{parent_name}/{clip_id}/video.mp4",
                        "thumbnail_url": thumbnail_url,
                        "poster_url": thumbnail_url,
                        "cover_url": cover_url
                    })

        results.sort(key=lambda x: x["mtime"], reverse=True)
        return results

    def list_ready_clips(
        self,
        active_clip_ids: Optional[Set[str]] = None,
        screenshot_fn: Optional[Any] = None,
        duration_fn: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """List all ready clips, filtering out clips currently being processed."""
        clips = self.list_all_clips(screenshot_fn=screenshot_fn, duration_fn=duration_fn)
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
            return True
        return False

    def delete_clip_with_job(self, folder_name: str, clip_id: str, job_store: Any = None) -> bool:
        """Delete a specific clip folder and clean up any associated JobStore session."""
        success = self.delete_clip(folder_name, clip_id)
        if success and job_store is not None:
            hash_input = f"{folder_name}_{clip_id}"
            derived_job_id = hashlib.md5(hash_input.encode('utf-8')).hexdigest()[:8]
            if hasattr(job_store, "delete_job"):
                job_store.delete_job(derived_job_id)
            elif isinstance(job_store, dict) and derived_job_id in job_store:
                del job_store[derived_job_id]
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
                jobs_dict = job_store.items() if hasattr(job_store, "items") else []
                for j_id, j_info in list(jobs_dict):
                    if isinstance(j_info, dict):
                        clip_info = j_info.get("clip") or {}
                        if j_info.get("folder_name") == folder_name or clip_info.get("folder_name") == folder_name:
                            j_info["status"] = "cancelled"
                            j_info["error"] = "Clip deleted by user."
                            job_store[j_id] = j_info
                if hasattr(job_store, "save"):
                    try:
                        job_store.save()
                    except Exception:
                        pass

            clip_dirs = [d for d in os.listdir(source_clips_dir) if os.path.isdir(os.path.join(source_clips_dir, d))]
            deleted_count = len(clip_dirs) or 1
            shutil.rmtree(source_clips_dir)

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
                        return data
            except Exception:
                pass
        return dict(CANONICAL_DEFAULT_STYLE_SETTINGS)

    def save_default_style_settings(self, settings: Dict[str, Any]) -> bool:
        """Atomically saves global default style settings."""
        default_style_path = os.path.join(self.output_dir, "default_style_settings.json")
        try:
            self._atomic_write_json(default_style_path, settings)
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
        """Atomically saves global default cover style settings and syncs thumbnail style."""
        default_cover_path = os.path.join(self.output_dir, "default_cover_style.json")
        default_thumb_path = os.path.join(self.output_dir, "default_thumbnail_style.json")
        try:
            self._atomic_write_json(default_cover_path, style)
            self._atomic_write_json(default_thumb_path, style)
            return True
        except Exception:
            return False

    def get_default_thumbnail_style(self) -> Dict[str, Any]:
        return self.get_default_cover_style()

    def save_default_thumbnail_style(self, style: Dict[str, Any]) -> bool:
        return self.save_default_cover_style(style)


