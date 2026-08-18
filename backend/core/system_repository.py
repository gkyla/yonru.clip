import os
import shutil
import json
import datetime
from typing import Optional, Dict, Any, List
from core.config_store import ConfigStore


class SystemRepository:
    """Encapsulates system settings, Netscape cookie persistence, diagnostics, and face tracking caching."""

    def __init__(self, config_store: ConfigStore, cookies_path: Optional[str] = None):
        self.config_store = config_store
        self.cookies_path = os.path.abspath(
            cookies_path or os.path.join(os.path.dirname(__file__), "..", "cookies.txt")
        )

    def get_settings(self) -> Dict[str, str]:
        """Retrieve system settings from config store."""
        return {
            "GEMINI_API_KEY": self.config_store.get("GEMINI_API_KEY", "") or "",
            "FFMPEG_PATH": self.config_store.get("FFMPEG_PATH", "") or "",
            "NODE_PATH": self.config_store.get("NODE_PATH", "") or "",
        }

    def update_settings(
        self,
        gemini_api_key: Optional[str] = None,
        ffmpeg_path: Optional[str] = None,
        node_path: Optional[str] = None,
    ) -> None:
        """Update system settings in config store."""
        if gemini_api_key is not None:
            self.config_store.set("GEMINI_API_KEY", gemini_api_key)
        if ffmpeg_path is not None:
            self.config_store.set("FFMPEG_PATH", ffmpeg_path)
        if node_path is not None:
            self.config_store.set("NODE_PATH", node_path)

    def validate_gemini_keys(self, api_key_string: str) -> Dict[str, Any]:
        """Validate if the given Gemini API keys are active and functional."""
        from google import genai
        from core.genai_client import GeminiGenAIClient

        temp_client = GeminiGenAIClient(api_key=api_key_string)
        keys = temp_client.api_keys

        if not keys:
            return {"status": "invalid", "error": "No API keys provided.", "results": []}

        results = []
        all_valid = True

        for key in keys:
            try:
                client = genai.Client(api_key=key)
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents="Say 'OK'",
                )
                if response.text:
                    GeminiGenAIClient.clear_degradation(key)
                    results.append({"key": key, "status": "valid", "error": None})
                else:
                    all_valid = False
                    results.append({"key": key, "status": "invalid", "error": "Empty response from Gemini."})
            except Exception as e:
                all_valid = False
                error_msg = str(e)
                if "API_KEY_INVALID" in error_msg or "400" in error_msg:
                    error_msg = "The API key is invalid. Please check your spelling and try again."
                elif "quota" in error_msg.lower() or "429" in error_msg:
                    error_msg = "Gemini API Quota exceeded. Please check your Google AI Studio billing/plan."
                results.append({"key": key, "status": "invalid", "error": error_msg})

        return {
            "status": "valid" if all_valid else "invalid",
            "results": results,
        }

    def get_cookies_status(self) -> Dict[str, Any]:
        """Check if cookies.txt exists and return metadata."""
        exists = os.path.exists(self.cookies_path)
        size_bytes = 0
        last_modified = None

        if exists:
            try:
                size_bytes = os.path.getsize(self.cookies_path)
                mtime = os.path.getmtime(self.cookies_path)
                last_modified = datetime.datetime.fromtimestamp(mtime).isoformat()
            except Exception:
                pass

        return {
            "exists": exists,
            "size_bytes": size_bytes,
            "last_modified": last_modified,
            "path": self.cookies_path,
        }

    def save_cookies(self, cookies_text: str) -> None:
        """Validate and write cookies.txt locally."""
        content = cookies_text.strip()
        if not content:
            raise ValueError("Cookie content cannot be empty.")

        first_chunk = content[:150]
        if "# Netscape" not in first_chunk:
            raise ValueError(
                "Invalid cookie format. Please ensure you upload/paste a Netscape format cookies.txt file."
            )

        os.makedirs(os.path.dirname(self.cookies_path), exist_ok=True)
        with open(self.cookies_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content + "\n")
        print(f"[system] Saved cookies.txt at {self.cookies_path} (size: {len(content)} bytes)")

    def delete_cookies(self) -> bool:
        """Safely delete cookies.txt locally."""
        if os.path.exists(self.cookies_path):
            os.remove(self.cookies_path)
            print(f"[system] Deleted cookies.txt at {self.cookies_path}")
            return True
        return False

    def check_system_health(self) -> Dict[str, Any]:
        """Perform a diagnostic check on system dependencies."""
        # 1. FFmpeg
        custom_ffmpeg = self.config_store.get("FFMPEG_PATH", "") or ""
        ffmpeg_ok = False
        ffmpeg_bin = ""

        if custom_ffmpeg:
            for name in ["ffmpeg", "ffmpeg.exe"]:
                test_path = os.path.join(custom_ffmpeg, name)
                if os.path.exists(test_path) and os.path.isfile(test_path):
                    ffmpeg_ok = True
                    ffmpeg_bin = test_path
                    break

        if not ffmpeg_ok:
            found = shutil.which("ffmpeg")
            if found:
                ffmpeg_ok = True
                ffmpeg_bin = found

        # 2. Node.js
        custom_node = self.config_store.get("NODE_PATH", "") or ""
        node_ok = False
        node_bin = ""

        if custom_node:
            for name in ["node", "node.exe"]:
                test_path = os.path.join(custom_node, name)
                if os.path.exists(test_path) and os.path.isfile(test_path):
                    node_ok = True
                    node_bin = test_path
                    break

        if not node_ok:
            found = shutil.which("node")
            if found:
                node_ok = True
                node_bin = found

        # 3. Python virtual environment dependencies
        venv_ok = True
        try:
            import fastapi
            import uvicorn
            import google.genai
        except ImportError:
            venv_ok = False

        # 4. Check GEMINI_API_KEY
        gemini_key = self.config_store.get("GEMINI_API_KEY") or ""
        has_key = len(gemini_key.strip()) > 0

        # 5. Check cookies.txt
        cookies_configured = os.path.exists(self.cookies_path)

        return {
            "ffmpeg": {
                "status": "OK" if ffmpeg_ok else "Missing",
                "path": ffmpeg_bin or "Not Found",
            },
            "node": {
                "status": "OK" if node_ok else "Missing",
                "path": node_bin or "Not Found",
            },
            "python_env": {
                "status": "OK" if venv_ok else "Degraded",
                "active": True,
            },
            "gemini_api": {
                "status": "Configured" if has_key else "Not Configured",
                "has_key": has_key,
            },
            "cookies": {
                "status": "Configured" if cookies_configured else "Not Configured",
                "exists": cookies_configured,
            },
        }

    def get_or_create_crop_map(
        self, clip_dir: str, video_path: str, tracker: Optional[Any] = None
    ) -> List[Dict[str, Any]]:
        """Load cached crop_map.json or compute face tracking points and cache."""
        crop_map_path = os.path.join(clip_dir, "crop_map.json")
        if os.path.exists(crop_map_path):
            try:
                with open(crop_map_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
            except Exception:
                pass

        if tracker is None:
            from core.face_tracker import FaceTracker
            tracker = FaceTracker()

        try:
            crop_data = tracker.analyze_video(video_path)
            if isinstance(crop_data, (int, float)):
                crop_map_points = [{"time": 0.0, "x": int(crop_data)}]
            elif isinstance(crop_data, list) and len(crop_data) > 0:
                crop_map_points = crop_data
            else:
                crop_map_points = [{"time": 0.0, "x": 960}]
        except Exception as e:
            print(f"[system_repository] Face tracking failed for {video_path}: {e}")
            crop_map_points = [{"time": 0.0, "x": 960}]

        try:
            with open(crop_map_path, "w", encoding="utf-8") as f:
                json.dump(crop_map_points, f, ensure_ascii=False, indent=2)
            print(f"[system_repository] Saved crop_map.json ({len(crop_map_points)} points) to {crop_map_path}")
        except Exception as e:
            print(f"[system_repository] Failed to save crop_map.json: {e}")

        return crop_map_points
