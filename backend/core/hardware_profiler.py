from abc import ABC, abstractmethod
from dataclasses import dataclass
import os
import platform
import shutil
import subprocess
from typing import Optional, Dict, Any, List


@dataclass
class CPUMetrics:
    """CPU telemetry specifications."""
    brand: str
    arch: str
    cores: int
    system_os: str


@dataclass
class GPUMetrics:
    """GPU acceleration specifications."""
    type: str  # 'apple_silicon' | 'cuda' | 'cpu'
    name: str
    vram_gb: Optional[float] = None


@dataclass
class HostHardwareMetrics:
    """Aggregated raw hardware telemetry probed from host operating system."""
    cpu: CPUMetrics
    total_ram_gb: float
    gpu: GPUMetrics


class HardwareMetricsSource(ABC):
    """Abstract seam providing host hardware metrics."""

    @abstractmethod
    def probe_metrics(self) -> HostHardwareMetrics:
        """Probe and return the host hardware specifications."""
        pass


class PlatformHardwareMetricsSource(HardwareMetricsSource):
    """Probes the live operating system (Darwin, Linux, Windows, NVIDIA CUDA) for host hardware metrics."""

    def probe_metrics(self) -> HostHardwareMetrics:
        # 1. CPU detection
        cpu_arch = platform.machine().lower()
        system_os = platform.system()
        cpu_cores = os.cpu_count() or 4
        cpu_brand = platform.processor() or cpu_arch

        if system_os == "Darwin":
            try:
                res = subprocess.run(
                    ["sysctl", "-n", "machdep.cpu.brand_string"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
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
                res = subprocess.run(
                    ["sysctl", "-n", "hw.memsize"],
                    capture_output=True,
                    text=True,
                    timeout=2,
                )
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
        gpu_info = GPUMetrics(
            type="cpu",
            name="Standard CPU / Integrated Graphics",
            vram_gb=None,
        )

        is_apple_silicon = (system_os == "Darwin" and cpu_arch in ["arm64", "aarch64"])
        if is_apple_silicon:
            gpu_info = GPUMetrics(
                type="apple_silicon",
                name=f"{cpu_brand} (Unified Memory)",
                vram_gb=total_ram_gb,
            )
        else:
            nvidia_smi = shutil.which("nvidia-smi")
            if nvidia_smi:
                try:
                    res = subprocess.run(
                        [nvidia_smi, "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                        capture_output=True,
                        text=True,
                        timeout=3,
                    )
                    if res.returncode == 0 and res.stdout.strip():
                        first_line = res.stdout.strip().splitlines()[0]
                        parts = first_line.split(",")
                        gpu_name = parts[0].strip()
                        vram_mb = float(parts[1].strip()) if len(parts) > 1 else 0.0
                        vram_gb = round(vram_mb / 1024.0, 1)
                        gpu_info = GPUMetrics(
                            type="cuda",
                            name=gpu_name,
                            vram_gb=vram_gb,
                        )
                except Exception:
                    pass

        return HostHardwareMetrics(
            cpu=CPUMetrics(
                brand=cpu_brand,
                arch=cpu_arch,
                cores=cpu_cores,
                system_os=system_os,
            ),
            total_ram_gb=total_ram_gb,
            gpu=gpu_info,
        )


class FakeHardwareMetricsSource(HardwareMetricsSource):
    """In-memory deterministic metrics source for matrix testing across simulated hardware architectures."""

    def __init__(
        self,
        cpu_brand: str = "Mock CPU",
        cpu_arch: str = "x86_64",
        cpu_cores: int = 8,
        system_os: str = "Linux",
        total_ram_gb: float = 16.0,
        gpu_type: str = "cpu",
        gpu_name: str = "Mock Integrated Graphics",
        gpu_vram_gb: Optional[float] = None,
    ):
        self.metrics = HostHardwareMetrics(
            cpu=CPUMetrics(
                brand=cpu_brand,
                arch=cpu_arch,
                cores=cpu_cores,
                system_os=system_os,
            ),
            total_ram_gb=total_ram_gb,
            gpu=GPUMetrics(
                type=gpu_type,
                name=gpu_name,
                vram_gb=gpu_vram_gb,
            ),
        )

    def probe_metrics(self) -> HostHardwareMetrics:
        return self.metrics


class HardwareProfiler:
    """Evaluates host hardware metrics to recommend optimal Whisper models and compute duration estimates."""

    BASELINES: Dict[str, float] = {
        "tiny": 4.0,
        "base": 8.0,
        "small": 22.0,
        "medium": 55.0,
        "large-v3": 120.0,
    }

    MODEL_KEYS: List[str] = ["tiny", "base", "small", "medium", "large-v3"]

    def __init__(self, metrics_source: Optional[HardwareMetricsSource] = None):
        self.metrics_source = metrics_source or PlatformHardwareMetricsSource()

    def detect(self) -> Dict[str, Any]:
        """Detect local CPU, physical RAM, and GPU capability to recommend an optimal Whisper model."""
        metrics = self.metrics_source.probe_metrics()

        cpu_brand = metrics.cpu.brand
        cpu_arch = metrics.cpu.arch
        cpu_cores = metrics.cpu.cores
        system_os = metrics.cpu.system_os
        total_ram_gb = metrics.total_ram_gb
        gpu_type = metrics.gpu.type
        gpu_name = metrics.gpu.name
        cuda_vram = metrics.gpu.vram_gb or 0.0

        is_apple_silicon = gpu_type == "apple_silicon"
        has_cuda = gpu_type == "cuda"

        # 1. Recommendation Heuristics
        recommended_model = "base"
        recommendation_reason = "Standard balanced configuration for clear audio."

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
                recommendation_reason = f"Dedicated GPU ({gpu_name} with {cuda_vram} GB VRAM) supports Large-v3 for maximum accuracy."
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

        # 2. Estimated Transcription Time per 60-Second Video Clip
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
        for m, base_sec in self.BASELINES.items():
            est_sec = max(1, round(base_sec * speed_factor))
            model_estimates[m] = {
                "estimated_seconds": est_sec,
                "display_text": f"~{est_sec}s / 60s clip",
            }

        # 3. Top-3 Intent Tiers: Fastest Draft, Sweet Spot (Balanced), Best Accuracy
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
                "desc": "Ultra-fast preview transcription",
            },
            "balanced": {
                "model": balanced_model,
                "label": "Sweet Spot",
                "tag": "Balanced",
                "estimated_seconds": model_estimates[balanced_model]["estimated_seconds"],
                "display_time": model_estimates[balanced_model]["display_text"],
                "desc": "Best balance of speed and clear audio precision",
            },
            "accurate": {
                "model": accurate_model,
                "label": "Best Accuracy",
                "tag": "Accurate",
                "estimated_seconds": model_estimates[accurate_model]["estimated_seconds"],
                "display_time": model_estimates[accurate_model]["display_text"],
                "desc": "High precision for complex accents and dialogue",
            },
        }

        # 4. Capacity and warnings per model
        model_capacities: Dict[str, Dict[str, Any]] = {}
        for m in self.MODEL_KEYS:
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
                "warning": warning,
            }

        return {
            "cpu": {
                "brand": cpu_brand,
                "arch": cpu_arch,
                "cores": cpu_cores,
                "os": system_os,
            },
            "memory": {
                "total_gb": total_ram_gb,
            },
            "gpu": {
                "type": gpu_type,
                "name": gpu_name,
                "vram_gb": metrics.gpu.vram_gb,
            },
            "recommended_model": recommended_model,
            "recommendation_reason": recommendation_reason,
            "top_intents": top_intents,
            "model_estimates": model_estimates,
            "model_capacities": model_capacities,
        }
