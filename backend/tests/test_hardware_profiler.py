import pytest
from core.hardware_profiler import (
    HardwareProfiler,
    PlatformHardwareMetricsSource,
    FakeHardwareMetricsSource,
    HostHardwareMetrics,
    CPUMetrics,
    GPUMetrics,
)


def test_platform_hardware_metrics_source_real():
    """Verify live OS hardware metrics probing succeeds without throwing."""
    source = PlatformHardwareMetricsSource()
    metrics = source.probe_metrics()

    assert isinstance(metrics, HostHardwareMetrics)
    assert metrics.cpu.brand
    assert metrics.cpu.arch
    assert metrics.cpu.cores >= 1
    assert metrics.cpu.system_os in ["Darwin", "Linux", "Windows"]
    assert metrics.total_ram_gb > 0.0
    assert metrics.gpu.type in ["apple_silicon", "cuda", "cpu"]
    assert metrics.gpu.name


def test_hardware_profiler_real_detect():
    """Verify HardwareProfiler produces a complete profile on the local host."""
    profiler = HardwareProfiler()
    profile = profiler.detect()

    assert "cpu" in profile
    assert "memory" in profile
    assert "gpu" in profile
    assert "recommended_model" in profile
    assert profile["recommended_model"] in ["tiny", "base", "small", "medium", "large-v3"]
    assert "recommendation_reason" in profile
    assert "top_intents" in profile
    assert "fastest" in profile["top_intents"]
    assert "balanced" in profile["top_intents"]
    assert "accurate" in profile["top_intents"]
    assert "model_estimates" in profile
    assert "model_capacities" in profile

    for m in ["tiny", "base", "small", "medium", "large-v3"]:
        assert m in profile["model_capacities"]
        assert profile["model_capacities"][m]["status"] in ["optimal", "supported", "heavy"]
        assert m in profile["model_estimates"]
        assert profile["model_estimates"][m]["estimated_seconds"] >= 1
        assert "display_text" in profile["model_estimates"][m]


def test_fake_metrics_apple_silicon_32gb():
    """Test recommendation heuristics and duration estimates for high-memory Apple Silicon."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Apple M3 Max",
        cpu_arch="arm64",
        cpu_cores=14,
        system_os="Darwin",
        total_ram_gb=36.0,
        gpu_type="apple_silicon",
        gpu_name="Apple M3 Max (Unified Memory)",
        gpu_vram_gb=36.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["gpu"]["type"] == "apple_silicon"
    assert profile["memory"]["total_gb"] == 36.0
    assert profile["recommended_model"] == "large-v3"
    assert "state-of-the-art precision" in profile["recommendation_reason"]
    assert profile["top_intents"]["accurate"]["model"] == "large-v3"
    assert profile["model_capacities"]["large-v3"]["status"] == "optimal"
    # speed factor 0.65 -> base (8.0 * 0.65 = 5.2 -> 5s)
    assert profile["model_estimates"]["base"]["estimated_seconds"] == 5
    assert profile["model_estimates"]["base"]["display_text"] == "~5s / 60s clip"


def test_fake_metrics_apple_silicon_16gb():
    """Test recommendation heuristics for standard 16GB Apple Silicon."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Apple M2",
        cpu_arch="arm64",
        cpu_cores=8,
        system_os="Darwin",
        total_ram_gb=16.0,
        gpu_type="apple_silicon",
        gpu_name="Apple M2 (Unified Memory)",
        gpu_vram_gb=16.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["recommended_model"] == "small"
    assert profile["top_intents"]["accurate"]["model"] == "medium"
    assert profile["model_capacities"]["small"]["status"] == "optimal"


def test_fake_metrics_apple_silicon_8gb():
    """Test recommendation heuristics for baseline 8GB Apple Silicon."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Apple M1",
        cpu_arch="arm64",
        cpu_cores=8,
        system_os="Darwin",
        total_ram_gb=8.0,
        gpu_type="apple_silicon",
        gpu_name="Apple M1 (Unified Memory)",
        gpu_vram_gb=8.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["recommended_model"] == "base"
    assert "without memory pressure" in profile["recommendation_reason"]
    # speed factor 0.75 -> base (8.0 * 0.75 = 6.0 -> 6s)
    assert profile["model_estimates"]["base"]["estimated_seconds"] == 6


def test_fake_metrics_nvidia_cuda_high_vram():
    """Test recommendation heuristics for high-end NVIDIA GPU (>= 10GB VRAM)."""
    source = FakeHardwareMetricsSource(
        cpu_brand="AMD Ryzen 9 5950X",
        cpu_arch="x86_64",
        cpu_cores=16,
        system_os="Linux",
        total_ram_gb=32.0,
        gpu_type="cuda",
        gpu_name="NVIDIA GeForce RTX 4090",
        gpu_vram_gb=24.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["gpu"]["type"] == "cuda"
    assert profile["gpu"]["name"] == "NVIDIA GeForce RTX 4090"
    assert profile["recommended_model"] == "large-v3"
    assert profile["top_intents"]["accurate"]["model"] == "large-v3"
    assert profile["model_capacities"]["large-v3"]["status"] == "optimal"
    # speed factor 0.35 -> large-v3 (120.0 * 0.35 = 42.0 -> 42s)
    assert profile["model_estimates"]["large-v3"]["estimated_seconds"] == 42


def test_fake_metrics_nvidia_cuda_mid_vram():
    """Test recommendation heuristics for mid-tier NVIDIA GPU (6GB VRAM)."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Intel Core i7-12700K",
        cpu_arch="x86_64",
        cpu_cores=12,
        system_os="Linux",
        total_ram_gb=16.0,
        gpu_type="cuda",
        gpu_name="NVIDIA GeForce RTX 3060",
        gpu_vram_gb=6.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["gpu"]["type"] == "cuda"
    assert profile["recommended_model"] == "medium"
    assert profile["top_intents"]["accurate"]["model"] == "medium"
    assert profile["model_capacities"]["medium"]["status"] == "optimal"
    # speed factor 0.45 -> base (8.0 * 0.45 = 3.6 -> 4s)
    assert profile["model_estimates"]["base"]["estimated_seconds"] == 4


def test_fake_metrics_nvidia_cuda_low_vram():
    """Test recommendation heuristics for entry NVIDIA GPU (4GB VRAM)."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Intel Core i5-11400",
        cpu_arch="x86_64",
        cpu_cores=6,
        system_os="Windows",
        total_ram_gb=16.0,
        gpu_type="cuda",
        gpu_name="NVIDIA GeForce GTX 1650",
        gpu_vram_gb=4.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["recommended_model"] == "small"
    assert profile["top_intents"]["accurate"]["model"] == "small"
    assert profile["model_capacities"]["small"]["status"] == "optimal"
    assert profile["model_capacities"]["medium"]["status"] == "heavy"
    assert "Requires ~5 GB free memory" in (profile["model_capacities"]["medium"]["warning"] or "")


def test_fake_metrics_nvidia_cuda_minimum_vram():
    """Test recommendation heuristics for sub-4GB NVIDIA GPU."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Intel Core i5-8250U",
        cpu_arch="x86_64",
        cpu_cores=4,
        system_os="Windows",
        total_ram_gb=8.0,
        gpu_type="cuda",
        gpu_name="NVIDIA GeForce MX250",
        gpu_vram_gb=2.0,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["recommended_model"] == "base"
    assert "well-suited for Base model" in profile["recommendation_reason"]


def test_fake_metrics_cpu_low_spec():
    """Test CPU heuristics for low-spec machine (<8GB RAM or <4 cores)."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Intel Celeron N4020",
        cpu_arch="x86_64",
        cpu_cores=2,
        system_os="Linux",
        total_ram_gb=4.0,
        gpu_type="cpu",
        gpu_name="Intel UHD Graphics 600",
        gpu_vram_gb=None,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["gpu"]["type"] == "cpu"
    assert profile["recommended_model"] == "tiny"
    assert profile["model_capacities"]["small"]["status"] == "heavy"
    assert profile["model_capacities"]["medium"]["status"] == "heavy"
    assert profile["model_capacities"]["large-v3"]["status"] == "heavy"
    # speed factor 1.5 -> base (8.0 * 1.5 = 12s)
    assert profile["model_estimates"]["base"]["estimated_seconds"] == 12


def test_fake_metrics_cpu_high_spec():
    """Test CPU heuristics for high-spec multi-core CPU (>=24GB RAM, >=8 cores)."""
    source = FakeHardwareMetricsSource(
        cpu_brand="AMD Ryzen 7 5800X",
        cpu_arch="x86_64",
        cpu_cores=8,
        system_os="Linux",
        total_ram_gb=32.0,
        gpu_type="cpu",
        gpu_name="Standard CPU / Integrated Graphics",
        gpu_vram_gb=None,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["recommended_model"] == "small"
    assert profile["top_intents"]["accurate"]["model"] == "large-v3"
    # speed factor 0.85 -> base (8.0 * 0.85 = 6.8 -> 7s)
    assert profile["model_estimates"]["base"]["estimated_seconds"] == 7


def test_fake_metrics_cpu_standard():
    """Test CPU heuristics for standard desktop CPU (8GB RAM, 4 cores)."""
    source = FakeHardwareMetricsSource(
        cpu_brand="Intel Core i3-10100",
        cpu_arch="x86_64",
        cpu_cores=4,
        system_os="Linux",
        total_ram_gb=8.0,
        gpu_type="cpu",
        gpu_name="Standard CPU / Integrated Graphics",
        gpu_vram_gb=None,
    )
    profiler = HardwareProfiler(metrics_source=source)
    profile = profiler.detect()

    assert profile["recommended_model"] == "base"
    # speed factor 1.0 -> base (8.0 * 1.0 = 8s)
    assert profile["model_estimates"]["base"]["estimated_seconds"] == 8
