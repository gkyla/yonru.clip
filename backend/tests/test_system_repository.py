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
