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
        """Retrieve system settings from config store, sanitizing placeholder API keys."""
        from core.genai_client import sanitize_gemini_api_key_config

        raw_gemini = self.config_store.get("GEMINI_API_KEY", "") or ""
        sanitized_gemini = sanitize_gemini_api_key_config(raw_gemini)

        return {
            "GEMINI_API_KEY": sanitized_gemini,
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
                    results.append({"key": key, "status": "valid", "error": None, "raw_error": None})
                else:
                    all_valid = False
                    results.append({"key": key, "status": "invalid", "error": "Empty response received from Gemini API.", "raw_error": "Response text is empty."})
            except Exception as e:
                all_valid = False
                raw_err = str(e)
                raw_lower = raw_err.lower()
                
                if "403" in raw_err or "permission_denied" in raw_lower:
                    user_msg = "Permission Denied (403): Project access is denied or Gemini API is not enabled on this Google Cloud / AI Studio account."
                elif "api_key_invalid" in raw_lower or "400" in raw_err or "invalid_argument" in raw_lower:
                    user_msg = "Invalid API Key (400): Key characters not recognized. Please copy the key from Google AI Studio."
                elif "429" in raw_err or "quota" in raw_lower or "resource_exhausted" in raw_lower:
                    user_msg = "Rate Limit / Quota exceeded (429): Free tier RPM limit reached. Please wait a moment or use a fallback key."
                elif "404" in raw_err or "not_found" in raw_lower:
                    user_msg = "Model Not Found (404): The selected model is not available for this API key or region."
                elif "timeout" in raw_lower or "connect" in raw_lower or "ssl" in raw_lower:
                    user_msg = "Connection Timeout: Unable to reach Google AI servers. Please check your network connection or proxy."
                else:
                    first_line = raw_err.strip().splitlines()[0] if raw_err else "Unknown API error"
                    user_msg = f"API Error: {first_line[:120]}"
                
                results.append({"key": key, "status": "invalid", "error": user_msg, "raw_error": raw_err})

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
            expanded_ffmpeg = os.path.expanduser(custom_ffmpeg.strip())
            if os.path.isfile(expanded_ffmpeg) and os.path.basename(expanded_ffmpeg).lower() in ["ffmpeg", "ffmpeg.exe"]:
                ffmpeg_ok = True
                ffmpeg_bin = expanded_ffmpeg
            elif os.path.isdir(expanded_ffmpeg):
                for name in ["ffmpeg", "ffmpeg.exe"]:
                    test_path = os.path.join(expanded_ffmpeg, name)
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
            expanded_node = os.path.expanduser(custom_node.strip())
            if os.path.isfile(expanded_node) and os.path.basename(expanded_node).lower() in ["node", "node.exe"]:
                node_ok = True
                node_bin = expanded_node
            elif os.path.isdir(expanded_node):
                for name in ["node", "node.exe"]:
                    test_path = os.path.join(expanded_node, name)
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
        from core.genai_client import extract_valid_gemini_keys

        gemini_key = self.config_store.get("GEMINI_API_KEY") or ""
        valid_keys = extract_valid_gemini_keys(gemini_key)
        has_key = len(valid_keys) > 0

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

    def validate_binary_path(self, tool: str, path: str) -> Dict[str, Any]:
        """Validate whether a path contains a usable binary for the specified tool ('ffmpeg' or 'node')."""
        normalized_tool = tool.strip().lower()
        if normalized_tool not in ["ffmpeg", "node"]:
            return {
                "valid": False,
                "detected_path": "",
                "message": f"Unsupported tool '{tool}'. Expected 'ffmpeg' or 'node'."
            }

        clean_path = path.strip()
        if not clean_path:
            system_bin = shutil.which(normalized_tool)
            if system_bin:
                return {
                    "valid": True,
                    "detected_path": system_bin,
                    "is_system_default": True,
                    "message": f"Auto-detected system default at {system_bin}."
                }
            if normalized_tool == "node":
                return {
                    "valid": True,
                    "detected_path": "",
                    "is_system_default": True,
                    "message": "Node.js is optional and currently not detected in system PATH."
                }
            return {
                "valid": False,
                "detected_path": "",
                "is_system_default": True,
                "message": f"No {normalized_tool} executable found in system PATH."
            }

        expanded_path = os.path.expanduser(clean_path)

        if os.path.isfile(expanded_path):
            basename = os.path.basename(expanded_path).lower()
            expected_names = [normalized_tool, f"{normalized_tool}.exe"]
            if basename in expected_names:
                return {
                    "valid": True,
                    "detected_path": expanded_path,
                    "is_system_default": False,
                    "message": f"Valid {normalized_tool} executable found at {expanded_path}."
                }
            else:
                return {
                    "valid": False,
                    "detected_path": expanded_path,
                    "is_system_default": False,
                    "message": f"File '{basename}' does not match expected '{normalized_tool}' binary."
                }

        if os.path.isdir(expanded_path):
            for name in [normalized_tool, f"{normalized_tool}.exe"]:
                candidate = os.path.join(expanded_path, name)
                if os.path.exists(candidate) and os.path.isfile(candidate):
                    return {
                        "valid": True,
                        "detected_path": candidate,
                        "is_system_default": False,
                        "message": f"Valid {normalized_tool} binary found in directory: {candidate}."
                    }
            return {
                "valid": False,
                "detected_path": "",
                "is_system_default": False,
                "message": f"Directory exists, but no '{normalized_tool}' or '{normalized_tool}.exe' executable was found inside."
            }

        return {
            "valid": False,
            "detected_path": "",
            "is_system_default": False,
            "message": f"Path '{clean_path}' does not exist on this machine."
        }

