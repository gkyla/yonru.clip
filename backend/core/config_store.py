import os
from abc import ABC, abstractmethod
from typing import Optional, Dict

class ConfigStore(ABC):
    @abstractmethod
    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Retrieve a configuration value."""
        pass

    @abstractmethod
    def set(self, key: str, value: str) -> None:
        """Update a configuration value."""
        pass

    @abstractmethod
    def load(self) -> None:
        """Reload configuration from storage."""
        pass


class DotEnvConfigStore(ConfigStore):
    def __init__(self, env_file: str = ".env"):
        self.env_file = os.path.abspath(env_file)
        self._cache: Dict[str, str] = {}
        self.load()

    def load(self) -> None:
        self._cache = {}
        if os.path.exists(self.env_file):
            with open(self.env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        self._cache[key.strip()] = val.strip().strip("'\"")
                        
        # Synchronize cached values with os.environ
        for k, v in self._cache.items():
            os.environ[k] = v

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        # Return cache, or environment variable, or default
        return self._cache.get(key, os.environ.get(key, default))

    def set(self, key: str, value: str) -> None:
        self._cache[key] = value
        os.environ[key] = value
        
        # Write back to .env file safely preserving other variables
        lines = []
        written = False
        if os.path.exists(self.env_file):
            with open(self.env_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
                
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped and not stripped.startswith("#") and "=" in stripped:
                    k, _ = stripped.split("=", 1)
                    if k.strip() == key:
                        lines[i] = f"{key}={value}\n"
                        written = True
                        break
        
        if not written:
            # Ensure line break on the last line before appending
            if lines and not lines[-1].endswith("\n"):
                lines[-1] += "\n"
            lines.append(f"{key}={value}\n")
            
        with open(self.env_file, "w", encoding="utf-8") as f:
            f.writelines(lines)


class InMemoryConfigStore(ConfigStore):
    def __init__(self, initial_config: Optional[Dict[str, str]] = None):
        self._cache: Dict[str, str] = initial_config or {}

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        return self._cache.get(key, default)

    def set(self, key: str, value: str) -> None:
        self._cache[key] = value

    def load(self) -> None:
        pass
