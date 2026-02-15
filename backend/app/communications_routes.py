"""
Crisis communications API: templates and message generation.
"""
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.patriotai_loader import get_comm_template, get_comm_templates_list

router = APIRouter(tags=["communications"])


def _fill_template(text: str, context: dict[str, Any]) -> str:
    """Replace {placeholder} with context.get(placeholder, '')."""
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        return str(context.get(key, ""))
    return re.sub(r"\{(\w+)\}", repl, text)


def _has_required(template: dict[str, Any], context: dict[str, Any]) -> bool:
    """Check if context has all required_inputs (non-empty)."""
    required = template.get("required_inputs", [])
    for key in required:
        val = context.get(key)
        if val is None or (isinstance(val, str) and not val.strip()):
            return False
    return True


@router.get("/communications/templates")
def communications_templates() -> list[dict[str, Any]]:
    """Return list of {id, title, channel, audience, priority} for all templates."""
    return get_comm_templates_list()


class CommunicationsGenerateBody(BaseModel):
    template_id: str = Field(..., description="Template ID from /communications/templates")
    context: dict[str, Any] = Field(default_factory=dict, description="Placeholder values")


@router.post("/communications/generate")
def communications_generate(body: CommunicationsGenerateBody) -> dict[str, Any]:
    """
    Generate message from template. Uses fallback_template if required inputs missing.
    """
    template = get_comm_template(body.template_id)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template not found: {body.template_id}")

    if _has_required(template, body.context):
        text = template.get("template_text", "")
    else:
        text = template.get("fallback_template", template.get("template_text", ""))

    message = _fill_template(text, body.context)

    return {
        "template_id": body.template_id,
        "message": message,
        "channel": template.get("channel", ""),
        "audience": template.get("audience", ""),
        "priority": template.get("priority", ""),
    }
