import os
import sys
import tempfile
import shutil
import pytest
from unittest.mock import MagicMock, patch

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config_store import InMemoryConfigStore
from core.system_repository import SystemRepository


@pytest.fixture
def temp_workspace():
    temp_dir = tempfile.mkdtemp()
    cookies_file = os.path.join(temp_dir, "cookies.txt")
    yield temp_dir, cookies_file
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_system_repository_settings(temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore({
        "GEMINI_API_KEY": "test_key",
        "FFMPEG_PATH": "/usr/local/bin",
        "NODE_PATH": "/usr/bin/node"
    })
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    settings = repo.get_settings()
    assert settings["GEMINI_API_KEY"] == "test_key"
    assert settings["FFMPEG_PATH"] == "/usr/local/bin"
    assert settings["NODE_PATH"] == "/usr/bin/node"

    repo.update_settings(gemini_api_key="updated_key", ffmpeg_path="/opt/ffmpeg", node_path=None)
    updated = repo.get_settings()
    assert updated["GEMINI_API_KEY"] == "updated_key"
    assert updated["FFMPEG_PATH"] == "/opt/ffmpeg"
    assert updated["NODE_PATH"] == "/usr/bin/node"


def test_system_repository_cookies_lifecycle(temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    # 1. Initial status: does not exist
    status = repo.get_cookies_status()
    assert status["exists"] is False
    assert status["size_bytes"] == 0
    assert status["last_modified"] is None
    assert status["path"] == cookies_file

    # 2. Save valid Netscape cookie file
    valid_cookie_text = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\tsecret_val"
    repo.save_cookies(valid_cookie_text)

    # 3. Status after saving
    status_after = repo.get_cookies_status()
    assert status_after["exists"] is True
    assert status_after["size_bytes"] > 0
    assert status_after["last_modified"] is not None

    with open(cookies_file, "r", encoding="utf-8") as f:
        content = f.read()
        assert valid_cookie_text in content

    # 4. Delete cookies
    deleted = repo.delete_cookies()
    assert deleted is True
    assert os.path.exists(cookies_file) is False

    # 5. Delete again when already deleted
    assert repo.delete_cookies() is False


def test_system_repository_cookies_validation_errors(temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    # Empty content
    with pytest.raises(ValueError, match="Cookie content cannot be empty"):
        repo.save_cookies("   ")

    # Invalid header
    with pytest.raises(ValueError, match="Invalid cookie format"):
        repo.save_cookies("invalid cookie text without header")


def test_system_repository_health_check(temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore({
        "GEMINI_API_KEY": "AIzaSy...",
        "FFMPEG_PATH": "",
        "NODE_PATH": ""
    })
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    # Save cookies to test configured state
    repo.save_cookies("# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t123")

    health = repo.check_system_health()
    assert health["gemini_api"]["status"] == "Configured"
    assert health["gemini_api"]["has_key"] is True
    assert health["cookies"]["status"] == "Configured"
    assert health["cookies"]["exists"] is True
    assert "ffmpeg" in health
    assert "node" in health
    assert "python_env" in health


def test_system_repository_placeholder_key_handling(temp_workspace):
    temp_dir, cookies_file = temp_workspace

    # 1. Plain template string
    config_store = InMemoryConfigStore({
        "GEMINI_API_KEY": "your_gemini_api_key_here",
        "FFMPEG_PATH": "",
        "NODE_PATH": ""
    })
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)
    assert repo.get_settings()["GEMINI_API_KEY"] == ""
    health = repo.check_system_health()
    assert health["gemini_api"]["status"] == "Not Configured"
    assert health["gemini_api"]["has_key"] is False

    # 2. JSON array with only placeholder
    config_store.set("GEMINI_API_KEY", '[{"title": "Primary", "value": "your_gemini_api_key_here"}]')
    assert repo.get_settings()["GEMINI_API_KEY"] == ""
    health = repo.check_system_health()
    assert health["gemini_api"]["status"] == "Not Configured"
    assert health["gemini_api"]["has_key"] is False

    # 3. JSON array with mixed valid and placeholder
    config_store.set("GEMINI_API_KEY", '[{"title": "Valid", "value": "AIzaSyReal"}, {"title": "Dummy", "value": "your_gemini_api_key_here"}]')
    assert repo.get_settings()["GEMINI_API_KEY"] == '[{"title": "Valid", "value": "AIzaSyReal"}]'
    health = repo.check_system_health()
    assert health["gemini_api"]["status"] == "Configured"
    assert health["gemini_api"]["has_key"] is True

    # 4. Empty string
    config_store.set("GEMINI_API_KEY", "")
    assert repo.get_settings()["GEMINI_API_KEY"] == ""
    health = repo.check_system_health()
    assert health["gemini_api"]["status"] == "Not Configured"
    assert health["gemini_api"]["has_key"] is False


def test_system_repository_validate_gemini_keys_empty(temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    res = repo.validate_gemini_keys("")
    assert res["status"] == "invalid"
    assert "No API keys provided" in res["error"]


@patch("google.genai.Client")
def test_system_repository_validate_gemini_keys_success(mock_genai_client, temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    mock_instance = MagicMock()
    mock_instance.models.generate_content.return_value = MagicMock(text="OK")
    mock_genai_client.return_value = mock_instance

    res = repo.validate_gemini_keys("valid_key_123")
    assert res["status"] == "valid"
    assert len(res["results"]) == 1
    assert res["results"][0]["key"] == "valid_key_123"
    assert res["results"][0]["status"] == "valid"


@patch("google.genai.Client")
def test_system_repository_validate_gemini_keys_quota_error(mock_genai_client, temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    mock_instance = MagicMock()
    mock_instance.models.generate_content.side_effect = Exception("429 RESOURCE_EXHAUSTED Quota exceeded")
    mock_genai_client.return_value = mock_instance

    res = repo.validate_gemini_keys("quota_exceeded_key")
    assert res["status"] == "invalid"
    assert len(res["results"]) == 1
    assert res["results"][0]["status"] == "invalid"
    assert "Quota exceeded" in res["results"][0]["error"]
    assert "429 RESOURCE_EXHAUSTED" in res["results"][0]["raw_error"]


def test_system_repository_validate_binary_path(temp_workspace):
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    # 1. Invalid tool name
    invalid_tool = repo.validate_binary_path("unknown_tool", "/bin")
    assert invalid_tool["valid"] is False
    assert "Unsupported tool" in invalid_tool["message"]

    # 2. Empty path (system fallback check)
    with patch("shutil.which", return_value="/usr/bin/ffmpeg"):
        empty_res = repo.validate_binary_path("ffmpeg", "")
        assert empty_res["valid"] is True
        assert empty_res["detected_path"] == "/usr/bin/ffmpeg"
        assert empty_res["is_system_default"] is True

    with patch("shutil.which", return_value=None):
        empty_none = repo.validate_binary_path("ffmpeg", "")
        assert empty_none["valid"] is False
        assert empty_none["is_system_default"] is True

        empty_node_none = repo.validate_binary_path("node", "")
        assert empty_node_none["valid"] is True
        assert empty_node_none["is_system_default"] is True
        assert "optional" in empty_node_none["message"]

    # 3. Valid directory containing binary
    fake_bin_dir = os.path.join(temp_dir, "bin")
    os.makedirs(fake_bin_dir, exist_ok=True)
    fake_ffmpeg = os.path.join(fake_bin_dir, "ffmpeg")
    with open(fake_ffmpeg, "w") as f:
        f.write("#!/bin/sh\necho ffmpeg")

    dir_res = repo.validate_binary_path("ffmpeg", fake_bin_dir)
    assert dir_res["valid"] is True
    assert dir_res["detected_path"] == fake_ffmpeg
    assert dir_res["is_system_default"] is False

    # 4. Valid direct binary file
    file_res = repo.validate_binary_path("ffmpeg", fake_ffmpeg)
    assert file_res["valid"] is True
    assert file_res["detected_path"] == fake_ffmpeg

    # 5. File exists but name does not match tool
    wrong_file = os.path.join(fake_bin_dir, "other_tool")
    with open(wrong_file, "w") as f:
        f.write("echo other")
    wrong_res = repo.validate_binary_path("ffmpeg", wrong_file)
    assert wrong_res["valid"] is False
    assert "does not match expected 'ffmpeg' binary" in wrong_res["message"]

    # 6. Non-existent path
    non_existent = repo.validate_binary_path("ffmpeg", "/path/that/does/not/exist/at/all")
    assert non_existent["valid"] is False
    assert "does not exist" in non_existent["message"]

    # 7. Directory exists but does not contain the binary
    empty_dir = os.path.join(temp_dir, "empty_dir")
    os.makedirs(empty_dir, exist_ok=True)
    no_bin_res = repo.validate_binary_path("node", empty_dir)
    assert no_bin_res["valid"] is False
    assert "no 'node' or 'node.exe' executable was found" in no_bin_res["message"]


def test_system_repository_detect_hardware_profile_real(temp_workspace):
    """Test detect_hardware_profile on real host system."""
    temp_dir, cookies_file = temp_workspace
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store, cookies_path=cookies_file)

    profile = repo.detect_hardware_profile()
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
        assert "estimated_seconds" in profile["model_estimates"][m]
        assert "display_text" in profile["model_estimates"][m]


def test_system_repository_detect_hardware_profile_apple_silicon():
    """Test recommendation heuristics for Apple Silicon 16GB."""
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store)

    def mock_subprocess_run(cmd, **kwargs):
        res = MagicMock()
        res.returncode = 0
        if "machdep.cpu.brand_string" in cmd:
            res.stdout = "Apple M2\n"
        elif "hw.memsize" in cmd:
            res.stdout = "17179869184\n"
        else:
            res.stdout = ""
        return res

    with patch("platform.system", return_value="Darwin"), \
         patch("platform.machine", return_value="arm64"), \
         patch("platform.processor", return_value="Apple M2"), \
         patch("os.cpu_count", return_value=8), \
         patch("subprocess.run", side_effect=mock_subprocess_run):

        profile = repo.detect_hardware_profile()
        assert profile["gpu"]["type"] == "apple_silicon"
        assert profile["memory"]["total_gb"] == 16.0
        assert profile["recommended_model"] == "small"
        assert profile["model_capacities"]["small"]["status"] == "optimal"


def test_system_repository_detect_hardware_profile_low_spec_cpu():
    """Test recommendation heuristics for low-spec machine (< 8GB RAM)."""
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store)

    with patch("platform.system", return_value="Linux"), \
         patch("platform.machine", return_value="x86_64"), \
         patch("os.cpu_count", return_value=2), \
         patch("shutil.which", return_value=None), \
         patch.object(os, "sysconf", side_effect=[4096, 1048576]): # 4GB RAM
        
        profile = repo.detect_hardware_profile()
        assert profile["gpu"]["type"] == "cpu"
        assert profile["recommended_model"] == "tiny"
        assert profile["model_capacities"]["medium"]["status"] == "heavy"
        assert profile["model_capacities"]["large-v3"]["status"] == "heavy"


def test_system_repository_detect_hardware_profile_nvidia_gpu():
    """Test recommendation heuristics for NVIDIA GPU with 6GB VRAM."""
    config_store = InMemoryConfigStore()
    repo = SystemRepository(config_store=config_store)

    def mock_subprocess_run(cmd, **kwargs):
        res = MagicMock()
        res.returncode = 0
        if any("nvidia-smi" in str(c) for c in cmd):
            res.stdout = "NVIDIA GeForce RTX 3060, 6144\n"
        else:
            res.stdout = ""
        return res

    with patch("platform.system", return_value="Linux"), \
         patch("platform.machine", return_value="x86_64"), \
         patch("os.cpu_count", return_value=12), \
         patch.object(os, "sysconf", side_effect=[4096, 4194304]), \
         patch("shutil.which", return_value="/usr/bin/nvidia-smi"), \
         patch("subprocess.run", side_effect=mock_subprocess_run):

        profile = repo.detect_hardware_profile()
        assert profile["gpu"]["type"] == "cuda"
        assert profile["gpu"]["name"] == "NVIDIA GeForce RTX 3060"
        assert profile["gpu"]["vram_gb"] == 6.0
        assert profile["recommended_model"] == "medium"
        assert profile["model_capacities"]["medium"]["status"] == "optimal"

