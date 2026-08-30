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

    def detect_hardware_profile(self) -> Dict[str, Any]:
        """Detect local CPU, physical RAM, and GPU capability to recommend an optimal Whisper model."""
        import platform
        import subprocess

        # 1. CPU detection
        cpu_arch = platform.machine().lower()
        system_os = platform.system()
        cpu_cores = os.cpu_count() or 4
        cpu_brand = platform.processor() or cpu_arch

        if system_os == "Darwin":
            try:
                res = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True, timeout=2)
                if res.returncode == 0 and res.stdout.strip():
                    cpu_brand = res.stdout.strip()
                elif cpu_arch in ["arm64", "aarch64"]:
                    cpu_brand = "Apple Silicon"
            except Exception:
                if cpu_arch in ["arm64", "aarch64"]:
                    cpu_brand = "Apple Silicon"
        elif system_os == "Linux":
            try:
                with open("/proc/cpuinfo", "r") as f:
                    for line in f:
                        if "model name" in line:
                            cpu_brand = line.split(":", 1)[1].strip()
                            break
            except Exception:
                pass

        # 2. Total RAM detection (in GB)
        total_ram_gb = 8.0
        try:
            if system_os == "Darwin":
                res = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, timeout=2)
                if res.returncode == 0 and res.stdout.strip():
                    total_ram_gb = round(int(res.stdout.strip()) / (1024 ** 3), 1)
                elif hasattr(os, "sysconf") and "SC_PAGE_SIZE" in os.sysconf_names and "SC_PHYS_PAGES" in os.sysconf_names:
                    total_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
                    total_ram_gb = round(total_bytes / (1024 ** 3), 1)
            elif hasattr(os, "sysconf") and "SC_PAGE_SIZE" in os.sysconf_names and "SC_PHYS_PAGES" in os.sysconf_names:
                total_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
                total_ram_gb = round(total_bytes / (1024 ** 3), 1)
            elif system_os == "Windows":
                import ctypes
                class MEMORYSTATUSEX(ctypes.Structure):
                    _fields_ = [
                        ("dwLength", ctypes.c_ulong),
                        ("dwMemoryLoad", ctypes.c_ulong),
                        ("ullTotalPhys", ctypes.c_ulonglong),
                        ("ullAvailPhys", ctypes.c_ulonglong),
                        ("ullTotalPageFile", ctypes.c_ulonglong),
                        ("ullAvailPageFile", ctypes.c_ulonglong),
                        ("ullTotalVirtual", ctypes.c_ulonglong),
                        ("ullAvailVirtual", ctypes.c_ulonglong),
                        ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                    ]
                stat = MEMORYSTATUSEX()
                stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
                windll = getattr(ctypes, "windll", None)
                if windll and windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                    total_ram_gb = round(stat.ullTotalPhys / (1024 ** 3), 1)
        except Exception:
            pass

        # 3. GPU / Acceleration Detection
        gpu_info = {
            "type": "cpu",
            "name": "Standard CPU / Integrated Graphics",
            "vram_gb": None
        }

        is_apple_silicon = (system_os == "Darwin" and cpu_arch in ["arm64", "aarch64"])
        if is_apple_silicon:
            gpu_info = {
                "type": "apple_silicon",
                "name": f"{cpu_brand} (Unified Memory)",
                "vram_gb": total_ram_gb
            }
        else:
            nvidia_smi = shutil.which("nvidia-smi")
            if nvidia_smi:
                try:
                    res = subprocess.run(
                        [nvidia_smi, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                        capture_output=True,
                        text=True,
                        timeout=3
                    )
                    if res.returncode == 0 and res.stdout.strip():
                        first_line = res.stdout.strip().splitlines()[0]
                        parts = first_line.split(",")
                        gpu_name = parts[0].strip()
                        vram_mb = float(parts[1].strip()) if len(parts) > 1 else 0.0
                        vram_gb = round(vram_mb / 1024.0, 1)
                        gpu_info = {
                            "type": "cuda",
                            "name": gpu_name,
                            "vram_gb": vram_gb
                        }
                except Exception:
                    pass

        # 4. Recommendation Heuristics
        recommended_model = "base"
        recommendation_reason = "Standard balanced configuration for clear audio."

        has_cuda = gpu_info["type"] == "cuda"
        cuda_vram = gpu_info["vram_gb"] or 0.0

        if is_apple_silicon:
            if total_ram_gb >= 32.0:
                recommended_model = "large-v3"
                recommendation_reason = f"Your system has {total_ram_gb} GB unified memory, capable of running Large-v3 for state-of-the-art precision."
            elif total_ram_gb >= 16.0:
                recommended_model = "small"
                recommendation_reason = f"Your system has {total_ram_gb} GB unified memory. 'Small' delivers superior multilingual accuracy with fast transcription."
            else:
                recommended_model = "base"
                recommendation_reason = f"With {total_ram_gb} GB unified memory, 'Base' provides great speed and stability without memory pressure."
        elif has_cuda:
            if cuda_vram >= 10.0 and total_ram_gb >= 16.0:
                recommended_model = "large-v3"
                recommendation_reason = f"Dedicated GPU ({gpu_info['name']} with {cuda_vram} GB VRAM) supports Large-v3 for maximum accuracy."
            elif cuda_vram >= 6.0:
                recommended_model = "medium"
                recommendation_reason = f"Dedicated GPU ({cuda_vram} GB VRAM) supports Medium for high precision transcription."
            elif cuda_vram >= 4.0:
                recommended_model = "small"
                recommendation_reason = f"Dedicated GPU ({cuda_vram} GB VRAM) is optimal for Small with enhanced multilingual vocabulary."
            else:
                recommended_model = "base"
                recommendation_reason = f"Dedicated GPU ({cuda_vram} GB VRAM) is well-suited for Base model transcription."
        else:
            if total_ram_gb < 8.0 or cpu_cores < 4:
                recommended_model = "tiny"
                recommendation_reason = f"System has {total_ram_gb} GB RAM and {cpu_cores} CPU cores. 'Tiny' is recommended to avoid heavy CPU load."
            elif total_ram_gb < 16.0:
                recommended_model = "base"
                recommendation_reason = f"System has {total_ram_gb} GB RAM. 'Base' offers the best balance of transcription speed and memory efficiency."
            elif total_ram_gb < 32.0 and cpu_cores >= 6:
                recommended_model = "small"
                recommendation_reason = f"System has {total_ram_gb} GB RAM with {cpu_cores} cores. 'Small' provides significantly better multilingual accuracy."
            else:
                recommended_model = "small"
                recommendation_reason = f"For CPU execution, 'Small' is recommended to preserve fast response times while delivering high accuracy."

        # 5. Estimated Transcription Time per 60-Second Video Clip
        baselines = {
            "tiny": 4.0,
            "base": 8.0,
            "small": 22.0,
            "medium": 55.0,
            "large-v3": 120.0
        }

        if has_cuda:
            if cuda_vram >= 10.0:
                speed_factor = 0.35
            elif cuda_vram >= 6.0:
                speed_factor = 0.45
            else:
                speed_factor = 0.60
        elif is_apple_silicon:
            if total_ram_gb >= 16.0:
                speed_factor = 0.65
            else:
                speed_factor = 0.75
        elif cpu_cores >= 8:
            speed_factor = 0.85
        elif cpu_cores >= 4 and total_ram_gb >= 8.0:
            speed_factor = 1.0
        else:
            speed_factor = 1.5

        model_estimates: Dict[str, Dict[str, Any]] = {}
        for m, base_sec in baselines.items():
            est_sec = max(1, round(base_sec * speed_factor))
            model_estimates[m] = {
                "estimated_seconds": est_sec,
                "display_text": f"~{est_sec}s / 60s clip"
            }

        # 6. Top-3 Intent Tiers: Fastest Draft, Sweet Spot (Balanced), Best Accuracy
        fastest_model = "tiny"
        balanced_model = recommended_model

        if is_apple_silicon:
            if total_ram_gb >= 32.0:
                accurate_model = "large-v3"
            elif total_ram_gb >= 8.0:
                accurate_model = "medium"
            else:
                accurate_model = "small"
        elif has_cuda:
            if cuda_vram >= 10.0:
                accurate_model = "large-v3"
            elif cuda_vram >= 5.0:
                accurate_model = "medium"
            else:
                accurate_model = "small"
        else:
            if total_ram_gb >= 24.0 and cpu_cores >= 8:
                accurate_model = "large-v3"
            elif total_ram_gb >= 16.0:
                accurate_model = "medium"
            else:
                accurate_model = "small"

        top_intents = {
            "fastest": {
                "model": fastest_model,
                "label": "Fastest Draft",
                "tag": "Fastest",
                "estimated_seconds": model_estimates[fastest_model]["estimated_seconds"],
                "display_time": model_estimates[fastest_model]["display_text"],
                "desc": "Ultra-fast preview transcription"
            },
            "balanced": {
                "model": balanced_model,
                "label": "Sweet Spot",
                "tag": "Balanced",
                "estimated_seconds": model_estimates[balanced_model]["estimated_seconds"],
                "display_time": model_estimates[balanced_model]["display_text"],
                "desc": "Best balance of speed and clear audio precision"
            },
            "accurate": {
                "model": accurate_model,
                "label": "Best Accuracy",
                "tag": "Accurate",
                "estimated_seconds": model_estimates[accurate_model]["estimated_seconds"],
                "display_time": model_estimates[accurate_model]["display_text"],
                "desc": "High precision for complex accents and dialogue"
            }
        }

        # 7. Capacity and warnings per model
        model_capacities: Dict[str, Dict[str, Any]] = {}
        for m in ["tiny", "base", "small", "medium", "large-v3"]:
            status = "supported"
            warning = None
            if m == "tiny":
                status = "optimal" if recommended_model == "tiny" else "supported"
            elif m == "base":
                status = "optimal" if recommended_model == "base" else "supported"
            elif m == "small":
                if total_ram_gb < 8.0:
                    status = "heavy"
                    warning = "May cause high CPU usage or delays on low-RAM systems."
                else:
                    status = "optimal" if recommended_model == "small" else "supported"
            elif m == "medium":
                if (has_cuda and cuda_vram < 5.0) or (not has_cuda and total_ram_gb < 16.0):
                    status = "heavy"
                    warning = "Requires ~5 GB free memory; may be slow or cause lag on your PC."
                else:
                    status = "optimal" if recommended_model == "medium" else "supported"
            elif m == "large-v3":
                if (has_cuda and cuda_vram < 10.0) or (not has_cuda and total_ram_gb < 24.0):
                    status = "heavy"
                    warning = "Requires ~10 GB free memory; likely slow on standard systems."
                else:
                    status = "optimal" if recommended_model == "large-v3" else "supported"

            model_capacities[m] = {
                "status": status,
                "warning": warning
            }

        return {
            "cpu": {
                "brand": cpu_brand,
                "arch": cpu_arch,
                "cores": cpu_cores,
                "os": system_os
            },
            "memory": {
                "total_gb": total_ram_gb
            },
            "gpu": gpu_info,
            "recommended_model": recommended_model,
            "recommendation_reason": recommendation_reason,
            "top_intents": top_intents,
            "model_estimates": model_estimates,
            "model_capacities": model_capacities
        }

