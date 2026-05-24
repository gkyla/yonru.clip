import pytest
import os
import tempfile
import shutil
import sys

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.config_store import DotEnvConfigStore, InMemoryConfigStore


def test_in_memory_config_store():
    """Verify InMemoryConfigStore get and set functionality."""
    store = InMemoryConfigStore({"KEY_A": "VAL_A"})
    
    assert store.get("KEY_A") == "VAL_A"
    assert store.get("KEY_B") is None
    assert store.get("KEY_B", "DEFAULT") == "DEFAULT"

    store.set("KEY_B", "VAL_B")
    assert store.get("KEY_B") == "VAL_B"


def test_dotenv_config_store():
    """Verify DotEnvConfigStore loads, saves, and synchronizes with os.environ."""
    temp_dir = tempfile.mkdtemp()
    env_file = os.path.join(temp_dir, ".env")
    
    try:
        # 1. Seed initial env variables
        with open(env_file, "w", encoding="utf-8") as f:
            f.write("# comment line\n")
            f.write("KEY_1=VAL_1\n")
            f.write("KEY_2 = 'VAL_2'\n")

        # Set a backup environment value in global os.environ
        os.environ["KEY_BACKUP"] = "BACKUP_VAL"

        store = DotEnvConfigStore(env_file)
        
        # 2. Assert initial values are loaded and synced with cache
        assert store.get("KEY_1") == "VAL_1"
        assert store.get("KEY_2") == "VAL_2"
        # Check fallback value
        assert store.get("KEY_BACKUP") == "BACKUP_VAL"

        # 3. Set value (should update file and cache and os.environ)
        store.set("KEY_1", "NEW_VAL_1")
        assert store.get("KEY_1") == "NEW_VAL_1"
        assert os.environ["KEY_1"] == "NEW_VAL_1"

        # 4. Check file contents on disk
        with open(env_file, "r", encoding="utf-8") as f:
            content = f.read()
            assert "KEY_1=NEW_VAL_1" in content
            assert "# comment line" in content
            assert "KEY_2 = 'VAL_2'" in content

        # 5. Set new value not originally in file
        store.set("KEY_NEW", "NEW_VAL")
        assert store.get("KEY_NEW") == "NEW_VAL"
        assert os.environ["KEY_NEW"] == "NEW_VAL"
        
        with open(env_file, "r", encoding="utf-8") as f:
            content = f.read()
            assert "KEY_NEW=NEW_VAL" in content

    finally:
        shutil.rmtree(temp_dir)
        # Cleanup synced global keys
        for key in ["KEY_1", "KEY_2", "KEY_NEW", "KEY_BACKUP"]:
            if key in os.environ:
                del os.environ[key]
