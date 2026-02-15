"""
Load PatriotAI JSON packs from backend/Prompts.
All prompts and templates must be loaded from these files; no hardcoded strings.
"""
import json
from pathlib import Path
from typing import Any

_PROMPTS_DIR = Path(__file__).resolve().parent.parent / "Prompts"
_emergency_data: dict[str, Any] | None = None
_comm_data: dict[str, Any] | None = None
_resource_data: dict[str, Any] | None = None


def _load_json(filename: str) -> dict[str, Any]:
    path = _PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"PatriotAI pack not found: {path}")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _ensure_emergency() -> dict[str, Any]:
    global _emergency_data
    if _emergency_data is None:
        _emergency_data = _load_json("Emergency_response_prompt.json")
    return _emergency_data


def _ensure_comm() -> dict[str, Any]:
    global _comm_data
    if _comm_data is None:
        _comm_data = _load_json("Crisis_communication_templates.json")
    return _comm_data


def _ensure_resource() -> dict[str, Any]:
    global _resource_data
    if _resource_data is None:
        _resource_data = _load_json("Resource_allocation_policy.json")
    return _resource_data


def get_emergency_prompt(prompt_id: str) -> dict[str, Any] | None:
    """Lookup prompt by id. Returns None if not found."""
    data = _ensure_emergency()
    prompts = data.get("prompts", [])
    for p in prompts:
        if p.get("id") == prompt_id:
            return p
    return None


def get_emergency_global_rules() -> dict[str, Any]:
    """Return global_rules from emergency response pack."""
    return _ensure_emergency().get("global_rules", {})


def get_comm_template(template_id: str) -> dict[str, Any] | None:
    """Lookup template by id. Returns None if not found."""
    data = _ensure_comm()
    templates = data.get("templates", [])
    for t in templates:
        if t.get("id") == template_id:
            return t
    return None


def get_comm_templates_list() -> list[dict[str, Any]]:
    """Return list of {id, title, channel, audience, priority} for all templates."""
    data = _ensure_comm()
    out = []
    for t in data.get("templates", []):
        out.append({
            "id": t.get("id", ""),
            "title": t.get("title", ""),
            "channel": t.get("channel", ""),
            "audience": t.get("audience", ""),
            "priority": t.get("priority", ""),
        })
    return out


def get_resource_policy() -> dict[str, Any]:
    """Return full resource allocation policy."""
    return _ensure_resource()
