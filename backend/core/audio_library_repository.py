import os
import re
import json
import uuid
import time
import hashlib
import threading
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Literal
from core.clip_session_store import ClipSessionStore

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".aac", ".m4a", ".flac"}
DuplicateHandlingMode = Literal["prompt", "use_existing", "replace"]


class AudioLibraryStore(ABC):
    @abstractmethod
    def list_items(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def save_item(
        self,
        filename: str,
        content_bytes: bytes,
        duration: float = 0.0,
        on_duplicate: DuplicateHandlingMode = "prompt",
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    def delete_item(self, item_id: str) -> Dict[str, Any]:
        pass


class AudioLibraryRepository(AudioLibraryStore):
    """
    Deep module managing workspace-wide persistent audio assets in temp_assets/audio_library/
    and audio_library.json catalog, including duplicate detection and reference-checked cleanup.
    """

    def __init__(
        self,
        output_dir: str = "temp_assets",
        clip_session_store: Optional[ClipSessionStore] = None,
    ):
        self.output_dir = output_dir
        self.audio_dir = os.path.abspath(os.path.join(output_dir, "audio_library"))
        self.catalog_path = os.path.join(self.audio_dir, "audio_library.json")
        self.clip_session_store = clip_session_store
        self._lock = threading.Lock()
        os.makedirs(self.audio_dir, exist_ok=True)

    def _sanitize_filename(self, filename: str) -> str:
        base, ext = os.path.splitext(os.path.basename(filename))
        ext = ext.lower()
        clean_base = re.sub(r"[^\w\s.-]", "_", base).strip()
        clean_base = re.sub(r"\s+", "_", clean_base)
        clean_base = re.sub(r"_+", "_", clean_base).strip("_.")[:60]
        if not clean_base:
            clean_base = "audio"
        return f"{clean_base}{ext}"

    def _resolve_safe_audio_path(self, filename: str) -> str:
        base_dir = os.path.abspath(self.audio_dir)
        resolved = os.path.abspath(os.path.join(base_dir, os.path.basename(filename)))
        if os.path.commonpath([base_dir, resolved]) != base_dir:
            raise ValueError("Invalid audio filename path")
        return resolved

    def _read_catalog(self) -> List[Dict[str, Any]]:
        if not os.path.isfile(self.catalog_path):
            return []
        try:
            with open(self.catalog_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception:
            return []

    def _write_catalog(self, items: List[Dict[str, Any]]) -> None:
        os.makedirs(self.audio_dir, exist_ok=True)
        tmp_path = f"{self.catalog_path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)
        os.replace(tmp_path, self.catalog_path)

    def list_items(self) -> List[Dict[str, Any]]:
        with self._lock:
            items = self._read_catalog()
            return sorted(items, key=lambda x: x.get("created_at", 0), reverse=True)

    def save_item(
        self,
        filename: str,
        content_bytes: bytes,
        duration: float = 0.0,
        on_duplicate: DuplicateHandlingMode = "prompt",
    ) -> Dict[str, Any]:
        _, ext = os.path.splitext(filename)
        if ext.lower() not in ALLOWED_AUDIO_EXTENSIONS:
            raise ValueError(
                f"Unsupported audio format '{ext}'. Supported formats: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}"
            )
        if on_duplicate not in ("prompt", "use_existing", "replace"):
            raise ValueError(f"Unsupported on_duplicate mode '{on_duplicate}'")

        sha256_hash = hashlib.sha256(content_bytes).hexdigest()

        with self._lock:
            items = self._read_catalog()
            safe_filename = self._sanitize_filename(filename)

            existing_idx = next(
                (
                    idx
                    for idx, item in enumerate(items)
                    if item.get("filename", "").lower() == safe_filename.lower()
                    or item.get("name", "").lower() == filename.lower()
                    or item.get("sha256") == sha256_hash
                ),
                None,
            )

            if existing_idx is not None:
                existing_item = items[existing_idx]
                if on_duplicate == "prompt":
                    return {"status": "duplicate", "item": existing_item}
                if on_duplicate == "use_existing":
                    return {"status": "existing", "item": existing_item}
                target_filename = existing_item.get("filename") or safe_filename
                file_path = self._resolve_safe_audio_path(target_filename)
                with open(file_path, "wb") as f:
                    f.write(content_bytes)
                now = time.time()
                updated_item = {
                    **existing_item,
                    "name": filename,
                    "filename": target_filename,
                    "url": f"/assets/audio_library/{target_filename}",
                    "duration": float(duration or existing_item.get("duration") or 0.0),
                    "size": len(content_bytes),
                    "sha256": sha256_hash,
                    "updated_at": now,
                }
                items[existing_idx] = updated_item
                self._write_catalog(items)
                return {"status": "replaced", "item": updated_item}

            item_id = uuid.uuid4().hex[:12]
            file_path = self._resolve_safe_audio_path(safe_filename)
            if os.path.isfile(file_path):
                base_part, ext_part = os.path.splitext(safe_filename)
                safe_filename = f"{base_part}_{item_id[:6]}{ext_part}"
                file_path = self._resolve_safe_audio_path(safe_filename)

            with open(file_path, "wb") as f:
                f.write(content_bytes)

            now = time.time()
            new_item = {
                "id": item_id,
                "name": filename,
                "filename": safe_filename,
                "url": f"/assets/audio_library/{safe_filename}",
                "duration": float(duration or 0.0),
                "size": len(content_bytes),
                "sha256": sha256_hash,
                "created_at": now,
                "updated_at": now,
            }
            items.append(new_item)
            self._write_catalog(items)
            return {"status": "created", "item": new_item}

    def delete_item(self, item_id: str) -> Dict[str, Any]:
        with self._lock:
            items = self._read_catalog()
            target_item = next((i for i in items if i.get("id") == item_id), None)
            if not target_item:
                raise FileNotFoundError(f"Audio library item '{item_id}' not found")

            remaining = [i for i in items if i.get("id") != item_id]
            self._write_catalog(remaining)

            filename = target_item.get("filename", "")
            url = target_item.get("url", f"/assets/audio_library/{filename}")

            still_in_catalog = any(
                i.get("filename") == filename for i in remaining
            )
            referenced_by_clips = (
                self.clip_session_store.is_audio_asset_referenced(filename, url)
                if self.clip_session_store is not None
                else False
            )
            file_retained = still_in_catalog or referenced_by_clips

            if not file_retained and filename:
                file_path = self._resolve_safe_audio_path(filename)
                if os.path.isfile(file_path):
                    try:
                        os.remove(file_path)
                    except OSError:
                        pass

            return {
                "status": "deleted",
                "id": item_id,
                "file_retained": file_retained,
            }
