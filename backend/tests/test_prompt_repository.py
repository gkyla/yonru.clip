import pytest
import tempfile
import json
import shutil
import sys
import os

# Dynamic path resolution to backend root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.prompt_repository import (
    PromptDTO,
    FilePromptRepository,
    InMemoryPromptRepository
)


def test_in_memory_prompt_repository():
    """Verify InMemoryPromptRepository listing, retrieving, adding, editing, and deleting."""
    initial_prompt = PromptDTO(
        id="prompt.json::0",
        name="Initial Hook",
        suitable_for=["education"],
        prompt="Initial prompt template",
        num_hooks=3,
        auto_hooks=False
    )
    repo = InMemoryPromptRepository([initial_prompt])

    # 1. List
    prompts = repo.list_prompts()
    assert len(prompts) == 1
    assert prompts[0].id == "prompt.json::0"
    assert prompts[0].name == "Initial Hook"

    # 2. Get Text
    assert repo.get_prompt_text("prompt.json::0") == "Initial prompt template"
    assert repo.get_prompt_text("nonexistent") is None

    # 3. Add
    repo.add_prompt(
        name="Added Hook",
        suitable_for=["fun"],
        prompt="Added prompt template",
        num_hooks=5,
        auto_hooks=True
    )
    prompts = repo.list_prompts()
    assert len(prompts) == 2
    added_uuid = prompts[1].id
    assert added_uuid != "prompt.json::1"
    assert len(added_uuid) > 10  # is a generated UUID
    assert prompts[1].name == "Added Hook"
    assert prompts[1].auto_hooks is True

    # 4. Edit
    repo.edit_prompt(
        id=added_uuid,
        name="Edited Hook",
        suitable_for=["humor"],
        prompt="Edited prompt template",
        num_hooks=7,
        auto_hooks=False
    )
    prompts = repo.list_prompts()
    assert len(prompts) == 2
    assert prompts[1].name == "Edited Hook"
    assert prompts[1].suitable_for == ["humor"]
    assert prompts[1].num_hooks == 7
    assert prompts[1].auto_hooks is False

    # 5. Invalid Edit raising error
    with pytest.raises(KeyError):
        repo.edit_prompt("invalid_id", "Name", [], "Prompt")

    # 6. Delete
    repo.delete_prompt(added_uuid)
    prompts = repo.list_prompts()
    assert len(prompts) == 1
    assert prompts[0].id == "prompt.json::0"

    with pytest.raises(KeyError):
        repo.delete_prompt(added_uuid)


def test_file_prompt_repository():
    """Verify FilePromptRepository against temporary directory file mutations."""
    temp_dir = tempfile.mkdtemp()
    try:
        repo = FilePromptRepository(temp_dir)

        # 1. Empty List
        assert len(repo.list_prompts()) == 0

        # 2. Add prompt (creates prompt.json)
        repo.add_prompt(
            name="Education Hook",
            suitable_for=["health"],
            prompt="Debunk the health myths using {num_hooks} hooks.",
            num_hooks=10,
            auto_hooks=False
        )

        prompts = repo.list_prompts()
        assert len(prompts) == 1
        uuid1 = prompts[0].id
        assert len(uuid1) > 10
        assert prompts[0].name == "Education Hook"
        assert prompts[0].suitable_for == ["health"]

        # 3. Get raw prompt text
        text = repo.get_prompt_text(uuid1)
        assert text == "Debunk the health myths using {num_hooks} hooks."

        # 4. Add another prompt (appends to prompt.json)
        repo.add_prompt(
            name="Story Hook",
            suitable_for=["life"],
            prompt="Tell a story.",
            num_hooks=5,
            auto_hooks=True
        )
        prompts = repo.list_prompts()
        assert len(prompts) == 2
        uuid2 = prompts[1].id
        assert uuid2 != uuid1

        # 5. Edit prompt
        repo.edit_prompt(
            id=uuid1,
            name="Updated Education Hook",
            suitable_for=["sains"],
            prompt="Debunk sciences myths.",
            num_hooks=8,
            auto_hooks=True
        )

        prompts = repo.list_prompts()
        assert len(prompts) == 2
        assert prompts[0].name == "Updated Education Hook"
        assert prompts[0].suitable_for == ["sains"]
        assert prompts[0].prompt == "Debunk sciences myths."
        assert prompts[0].num_hooks == 8
        assert prompts[0].auto_hooks is True

        # 6. Verify file contents on disk
        with open(os.path.join(temp_dir, "prompt.json"), "r", encoding="utf-8") as f:
            data = json.load(f)
            assert len(data) == 2
            assert data[0]["promptName"] == "Updated Education Hook"
            assert data[0]["id"] == uuid1
            assert data[1]["promptName"] == "Story Hook"
            assert data[1]["id"] == uuid2

        # 7. Delete prompt
        repo.delete_prompt(uuid1)
        prompts = repo.list_prompts()
        assert len(prompts) == 1
        assert prompts[0].id == uuid2
        assert prompts[0].name == "Story Hook"

        # Verify on disk
        with open(os.path.join(temp_dir, "prompt.json"), "r", encoding="utf-8") as f:
            data = json.load(f)
            assert len(data) == 1
            assert data[0]["id"] == uuid2

        # Delete the last prompt (file should be removed/deleted)
        repo.delete_prompt(uuid2)
        assert len(repo.list_prompts()) == 0
        assert not os.path.exists(os.path.join(temp_dir, "prompt.json"))

    finally:
        shutil.rmtree(temp_dir)
