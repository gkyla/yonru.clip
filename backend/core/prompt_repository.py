import os
import json
import uuid
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

    @abstractmethod
    def delete_prompt(self, id: str) -> None:
        """Delete an existing prompt template by its unique ID."""
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
                    
                    modified = False
                    
                    if isinstance(data, list):
                        for idx, item in enumerate(data):
                            if not isinstance(item, dict):
                                continue
                            p_id = item.get("id")
                            if not p_id:
                                p_id = str(uuid.uuid4())
                                item["id"] = p_id
                                modified = True
                            
                            name = item.get("promptName", f"{f} - {idx + 1}")
                            suitable = item.get("suitableFor", [])
                            prompt_list.append(PromptDTO(
                                id=p_id,
                                name=name,
                                suitable_for=suitable,
                                prompt=item.get("prompt", ""),
                                num_hooks=item.get("numHooks", 10),
                                auto_hooks=item.get("autoHooks", False)
                            ))
                    elif isinstance(data, dict):
                        p_id = data.get("id")
                        if not p_id:
                            p_id = str(uuid.uuid4())
                            data["id"] = p_id
                            modified = True
                        
                        name = data.get("promptName", f)
                        suitable = data.get("suitableFor", [])
                        prompt_list.append(PromptDTO(
                            id=p_id,
                            name=name,
                            suitable_for=suitable,
                            prompt=data.get("prompt", ""),
                            num_hooks=data.get("numHooks", 10),
                            auto_hooks=data.get("autoHooks", False)
                        ))
                    
                    if modified:
                        with open(path_str, "w", encoding="utf-8") as file:
                            json.dump(data, file, indent=4, ensure_ascii=False)
                            
                except Exception as e:
                    print(f"[FilePromptRepository] Failed to load {f}: {e}")
        return prompt_list

    def get_prompt_text(self, prompt_file: str) -> Optional[str]:
        # Try finding by UUID first
        if os.path.exists(self.base_dir):
            for f in os.listdir(self.base_dir):
                if f.endswith(".json"):
                    path_str = os.path.join(self.base_dir, f)
                    try:
                        with open(path_str, "r", encoding="utf-8") as file:
                            data = json.load(file)
                            if isinstance(data, list):
                                for item in data:
                                    if isinstance(item, dict) and item.get("id") == prompt_file:
                                        return item.get("prompt", "")
                            elif isinstance(data, dict):
                                if data.get("id") == prompt_file:
                                    return data.get("prompt", "")
                    except Exception:
                        pass

        # Fallback to old filename / index-based ID resolution
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

        new_uuid = str(uuid.uuid4())
        data.append({
            "id": new_uuid,
            "promptName": name,
            "suitableFor": suitable_for,
            "prompt": prompt,
            "numHooks": num_hooks,
            "autoHooks": auto_hooks
        })

        with open(prompt_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

    def edit_prompt(self, id: str, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        found = False
        if os.path.exists(self.base_dir):
            for f in os.listdir(self.base_dir):
                if f.endswith(".json"):
                    path_str = os.path.join(self.base_dir, f)
                    try:
                        with open(path_str, "r", encoding="utf-8") as file:
                            data = json.load(file)
                        
                        modified = False
                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, dict) and item.get("id") == id:
                                    item["promptName"] = name
                                    item["suitableFor"] = suitable_for
                                    item["prompt"] = prompt
                                    item["numHooks"] = num_hooks
                                    item["autoHooks"] = auto_hooks
                                    modified = True
                                    found = True
                                    break
                        elif isinstance(data, dict):
                            if data.get("id") == id:
                                data["promptName"] = name
                                data["suitableFor"] = suitable_for
                                data["prompt"] = prompt
                                data["numHooks"] = num_hooks
                                data["autoHooks"] = auto_hooks
                                modified = True
                                found = True
                        
                        if modified:
                            with open(path_str, "w", encoding="utf-8") as file:
                                json.dump(data, file, indent=4, ensure_ascii=False)
                            break
                    except Exception as e:
                        print(f"[FilePromptRepository] Failed to read/write {f} in edit_prompt: {e}")
        
        # If not found by UUID, fallback to old index-based ID editing
        if not found:
            if "::" not in id:
                raise ValueError("Prompt not found or invalid ID")

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

    def delete_prompt(self, id: str) -> None:
        found = False
        if os.path.exists(self.base_dir):
            for f in os.listdir(self.base_dir):
                if f.endswith(".json"):
                    path_str = os.path.join(self.base_dir, f)
                    try:
                        with open(path_str, "r", encoding="utf-8") as file:
                            data = json.load(file)
                        
                        modified = False
                        if isinstance(data, list):
                            new_data = []
                            for item in data:
                                if isinstance(item, dict) and item.get("id") == id:
                                    modified = True
                                    found = True
                                else:
                                    new_data.append(item)
                            data = new_data
                        elif isinstance(data, dict):
                            if data.get("id") == id:
                                modified = True
                                found = True
                                data = None
                        
                        if modified:
                            if data is None or (isinstance(data, list) and len(data) == 0):
                                abs_path = os.path.abspath(path_str)
                                if os.path.commonpath([self.base_dir, abs_path]) == self.base_dir:
                                    os.remove(abs_path)
                                else:
                                    raise PermissionError("Attempted deletion outside base directory")
                            else:
                                with open(path_str, "w", encoding="utf-8") as file:
                                    json.dump(data, file, indent=4, ensure_ascii=False)
                            break
                    except Exception as e:
                        print(f"[FilePromptRepository] Failed to read/write/delete {f} in delete_prompt: {e}")
                        raise e
        
        # If not found by UUID, fallback to old index-based ID deletion
        if not found:
            if "::" not in id:
                raise ValueError("Prompt not found or invalid ID")

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
                data.pop(idx)
                modified = True
            elif isinstance(data, dict) and idx == -1:
                data = None
                modified = True
            else:
                raise IndexError("Prompt index not found in file")

            if modified:
                if data is None or (isinstance(data, list) and len(data) == 0):
                    abs_path = os.path.abspath(prompt_file)
                    if os.path.commonpath([self.base_dir, abs_path]) == self.base_dir:
                        os.remove(abs_path)
                    else:
                        raise PermissionError("Attempted deletion outside base directory")
                else:
                    with open(prompt_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=4, ensure_ascii=False)


class InMemoryPromptRepository(PromptRepository):
    def __init__(self, initial_prompts: List[PromptDTO] = None):
        self.prompts = {p.id: p for p in (initial_prompts or [])}

    def list_prompts(self) -> List[PromptDTO]:
        return list(self.prompts.values())

    def get_prompt_text(self, prompt_file: str) -> Optional[str]:
        if prompt_file in self.prompts:
            return self.prompts[prompt_file].prompt
        
        for p_id, p_dto in self.prompts.items():
            if p_id == prompt_file:
                return p_dto.prompt
        return None

    def add_prompt(self, name: str, suitable_for: List[str], prompt: str, num_hooks: int = 10, auto_hooks: bool = False) -> None:
        new_uuid = str(uuid.uuid4())
        self.prompts[new_uuid] = PromptDTO(
            id=new_uuid,
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

    def delete_prompt(self, id: str) -> None:
        if id not in self.prompts:
            raise KeyError("Prompt not found")
        del self.prompts[id]
