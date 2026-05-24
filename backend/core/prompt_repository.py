import os
import json
from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any

class PromptDTO:
    def __init__(self, id: str, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False):
        self.id = id
        self.name = name
        self.suitable_for = suitable_for
        self.prompt = prompt
        self.num_hooks = num_hooks
        self.auto_hooks = auto_hooks

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "suitableFor": self.suitable_for,
            "prompt": self.prompt,
            "numHooks": self.num_hooks,
            "autoHooks": self.auto_hooks
        }


class PromptRepository(ABC):
    @abstractmethod
    def list_prompts(self) -> List[PromptDTO]:
        """List all available prompts."""
        pass

    @abstractmethod
    def get_prompt_text(self, prompt_file: str) -> Optional[str]:
        """
        Load the raw template text for a given prompt identifier.
        Supports both direct filename (e.g. "prompt.json") and index-split (e.g. "prompt.json::1").
        """
        pass

    @abstractmethod
    def add_prompt(self, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        """Add a new prompt template to the default prompt store file."""
        pass

    @abstractmethod
    def edit_prompt(self, id: str, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        """Edit an existing prompt template by its unique ID."""
        pass


class FilePromptRepository(PromptRepository):
    def __init__(self, base_dir: str):
        self.base_dir = os.path.abspath(base_dir)

    def _get_file_path(self, filename: str) -> str:
        # Prevent directory traversal attacks
        safe_filename = os.path.basename(filename)
        return os.path.join(self.base_dir, safe_filename)

    def list_prompts(self) -> List[PromptDTO]:
        prompt_list = []
        if not os.path.exists(self.base_dir):
            return prompt_list

        for f in os.listdir(self.base_dir):
            if f.endswith(".json"):
                path_str = os.path.join(self.base_dir, f)
                try:
                    with open(path_str, "r", encoding="utf-8") as file:
                        data = json.load(file)
                        if isinstance(data, list):
                            for idx, item in enumerate(data):
                                name = item.get("promptName", f"{f} - {idx + 1}")
                                suitable = item.get("suitableFor", [])
                                prompt_list.append(PromptDTO(
                                    id=f"{f}::{idx}",
                                    name=name,
                                    suitable_for=suitable,
                                    prompt=item.get("prompt", ""),
                                    num_hooks=item.get("numHooks", 10),
                                    auto_hooks=item.get("autoHooks", False)
                                ))
                        elif isinstance(data, dict):
                            name = data.get("promptName", f)
                            suitable = data.get("suitableFor", [])
                            prompt_list.append(PromptDTO(
                                id=f"{f}::-1",
                                name=name,
                                suitable_for=suitable,
                                prompt=data.get("prompt", ""),
                                num_hooks=data.get("numHooks", 10),
                                auto_hooks=data.get("autoHooks", False)
                            ))
                except Exception as e:
                    print(f"[FilePromptRepository] Failed to load {f}: {e}")
        return prompt_list

    def get_prompt_text(self, prompt_file: str) -> Optional[str]:
        if "::" in prompt_file:
            filename, idx_str = prompt_file.split("::", 1)
            try:
                idx = int(idx_str)
            except ValueError:
                idx = -1
        else:
            filename = prompt_file
            idx = -1

        prompt_path = self._get_file_path(filename)
        if not os.path.exists(prompt_path):
            print(f"[FilePromptRepository] Prompt file not found: {prompt_path}")
            return None

        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and idx >= 0 and idx < len(data):
                    return data[idx].get("prompt", "")
                elif isinstance(data, dict):
                    return data.get("prompt", "")
                return ""
        except Exception as e:
            print(f"[FilePromptRepository] Failed to read prompt from {filename}: {e}")
            return None

    def add_prompt(self, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        os.makedirs(self.base_dir, exist_ok=True)
        prompt_file = self._get_file_path("prompt.json")
        
        data = []
        if os.path.exists(prompt_file):
            try:
                with open(prompt_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not isinstance(data, list):
                        data = [data]
            except Exception:
                data = []

        data.append({
            "promptName": name,
            "suitableFor": suitable_for,
            "prompt": prompt,
            "numHooks": num_hooks,
            "autoHooks": auto_hooks
        })

        with open(prompt_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

    def edit_prompt(self, id: str, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        if "::" not in id:
            raise ValueError("Invalid prompt id")

        filename, idx_str = id.split("::")
        try:
            idx = int(idx_str)
        except ValueError:
            raise ValueError("Invalid prompt index in ID")

        prompt_file = self._get_file_path(filename)
        if not os.path.exists(prompt_file):
            raise FileNotFoundError("Prompt file not found")

        with open(prompt_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, list) and 0 <= idx < len(data):
            data[idx]["promptName"] = name
            data[idx]["suitableFor"] = suitable_for
            data[idx]["prompt"] = prompt
            data[idx]["numHooks"] = num_hooks
            data[idx]["autoHooks"] = auto_hooks
        elif isinstance(data, dict) and idx == -1:
            data["promptName"] = name
            data["suitableFor"] = suitable_for
            data["prompt"] = prompt
            data["numHooks"] = num_hooks
            data["autoHooks"] = auto_hooks
        else:
            raise IndexError("Prompt index not found in file")

        with open(prompt_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)


class InMemoryPromptRepository(PromptRepository):
    def __init__(self, initial_prompts: List[PromptDTO] = None):
        self.prompts = {p.id: p for p in (initial_prompts or [])}

    def list_prompts(self) -> List[PromptDTO]:
        return list(self.prompts.values())

    def get_prompt_text(self, prompt_file: str) -> Optional[str]:
        # Emulate file or id lookup
        if prompt_file in self.prompts:
            return self.prompts[prompt_file].prompt
        
        # If it's prompt.json::idx, let's see if we can find it by matching DTO ID
        for p_id, p_dto in self.prompts.items():
            if p_id == prompt_file:
                return p_dto.prompt
        return None

    def add_prompt(self, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        # Generates a sequential index under mock "prompt.json"
        existing_in_file = [p for p in self.prompts.values() if p.id.startswith("prompt.json::")]
        next_idx = len(existing_in_file)
        new_id = f"prompt.json::{next_idx}"
        self.prompts[new_id] = PromptDTO(
            id=new_id,
            name=name,
            suitable_for=suitable_for,
            prompt=prompt,
            num_hooks=num_hooks,
            auto_hooks=auto_hooks
        )

    def edit_prompt(self, id: str, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        if id not in self.prompts:
            raise KeyError("Prompt not found")
        self.prompts[id].name = name
        self.prompts[id].suitable_for = suitable_for
        self.prompts[id].prompt = prompt
        self.prompts[id].num_hooks = num_hooks
        self.prompts[id].auto_hooks = auto_hooks
