"""
Patriot AI router: POST /api/patriot/assist for citizen and responder guidance.
Uses prompts from Emergency_response_prompt.json; Gemini when available, else OpenAI-compatible.
"""
import json
import logging
import re
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.patriotai_loader import get_emergency_global_rules, get_emergency_prompt
from app.patriot_client import PatriotAIError, patriot_assist
from app.settings import get_gemini_api_key

router = APIRouter(prefix="/patriot", tags=["patriot"])
logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_FALLBACK_MODEL = "gemini-1.5-flash"


def _fill_template(template: str, context: dict[str, Any]) -> str:
    """Replace {key} with context.get(key, 'unknown')."""
    def repl(m: re.Match[str]) -> str:
        key = m.group(1)
        val = context.get(key)
        if val is None:
            return "unknown"
        if isinstance(val, (dict, list)):
            return json.dumps(val)[:200]
        return str(val)
    return re.sub(r"\{(\w+)\}", repl, template)


def _call_gemini(system_prompt: str, user_message: str) -> str | None:
    """Call Gemini (same pattern as chat.py / assistant.py). Returns raw text or None."""
    key = get_gemini_api_key()
    if not key:
        return None
    import google.generativeai as genai
    genai.configure(api_key=key)
    full_prompt = f"""{system_prompt}

{user_message}

Reply with ONLY a valid JSON object. No markdown, no explanation. Required keys: title, summary, steps (array), warnings (array), do_now (array), confidence (low|medium|high), sources_used (array)."""
    for model_name in (GEMINI_MODEL, GEMINI_FALLBACK_MODEL):
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(full_prompt)
            if response and getattr(response, "text", None):
                return response.text.strip()
            if response and getattr(response, "prompt_feedback", None):
                block = getattr(response.prompt_feedback, "block_reason", None)
                if block:
                    logger.warning("Patriot Gemini blocked: model=%s block_reason=%s", model_name, block)
        except Exception as e:
            logger.warning("Patriot Gemini failed: model=%s err=%s", model_name, e)
            continue
    return None


def _extract_json(text: str) -> dict | None:
    """Parse JSON from response, stripping markdown code blocks if present (like assistant.py)."""
    if not text or not text.strip():
        return None
    text = text.strip()
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        text = m.group(1).strip()
    text = re.sub(r"^```\w*\n?|\n?```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("Patriot JSON parse failed: %s", e)
        return None


def _normalize_response(parsed: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    """Ensure required fields from output_schema exist."""
    out = {
        "title": parsed.get("title", "Emergency Guidance"),
        "summary": parsed.get("summary", ""),
        "steps": parsed.get("steps", []) if isinstance(parsed.get("steps"), list) else [],
        "warnings": parsed.get("warnings", []) if isinstance(parsed.get("warnings"), list) else [],
        "do_now": parsed.get("do_now", []) if isinstance(parsed.get("do_now"), list) else [],
        "confidence": parsed.get("confidence", "medium")
        if parsed.get("confidence") in ("low", "medium", "high")
        else "medium",
        "sources_used": parsed.get("sources_used", []) if isinstance(parsed.get("sources_used"), list) else [],
    }
    if "scripts" in parsed and isinstance(parsed["scripts"], dict):
        out["scripts"] = parsed["scripts"]
    if "checklists" in parsed and isinstance(parsed["checklists"], list):
        out["checklists"] = parsed["checklists"]
    return out


class PatriotAssistBody(BaseModel):
    prompt_id: str = Field(..., description="Prompt ID from Emergency_response_prompt.json")
    context: dict[str, Any] = Field(default_factory=dict)


class PatriotAssistResponse(BaseModel):
    title: str
    summary: str
    steps: list[str]
    warnings: list[str]
    do_now: list[str]
    confidence: Literal["low", "medium", "high"]
    sources_used: list[str]
    scripts: dict[str, str] = {}
    checklists: list[dict[str, Any]] = []


@router.post("/assist", response_model=PatriotAssistResponse)
def patriot_assist_endpoint(body: PatriotAssistBody):
    """Generate citizen or responder guidance using prompt_id and context."""
    prompt = get_emergency_prompt(body.prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt not found: {body.prompt_id}")

    global_rules = get_emergency_global_rules()
    rules_text = ""
    if global_rules:
        safety = global_rules.get("safety_rules", [])
        if safety:
            rules_text = "\n".join(f"- {s}" for s in safety)
        no_med = global_rules.get("no_medical_legal_guarantees", "")
        if no_med:
            rules_text += f"\n\n{no_med}"
        emergency = global_rules.get("emergency_services", "")
        if emergency:
            rules_text += f"\n\n{emergency}"

    system_prompt = prompt.get("system_prompt", "")
    if rules_text:
        system_prompt = f"{system_prompt}\n\nGlobal rules:\n{rules_text}"

    user_template = prompt.get("user_prompt_template", "")
    user_prompt = _fill_template(user_template, body.context)

    context_json = json.dumps(body.context, default=str)[:2000]
    user_message = f"{user_prompt}\n\nContext (JSON):\n{context_json}"

    parsed: dict[str, Any] | None = None
    gemini_key = get_gemini_api_key()

    if gemini_key:
        raw = _call_gemini(system_prompt, user_message)
        if raw:
            parsed = _extract_json(raw)
        if not parsed or not isinstance(parsed, dict):
            detail = (
                "Gemini returned invalid JSON. Try again."
                if raw
                else "Gemini unavailable. Check backend logs."
            )
            raise HTTPException(status_code=502, detail=detail)
    else:
        try:
            parsed = patriot_assist(system_prompt, user_message)
        except PatriotAIError as e:
            if e.status_code == 503:
                raise HTTPException(
                    status_code=503,
                    detail="PATRIOT_AI_API_KEY missing. Set it in backend/.env, or set GEMINI_API_KEY to use Gemini instead.",
                )
            raise HTTPException(status_code=502, detail=e.detail)
        if not parsed or not isinstance(parsed, dict):
            raise HTTPException(
                status_code=503,
                detail="No AI API key configured. Set GEMINI_API_KEY or PATRIOT_AI_API_KEY in backend/.env.",
            )

    schema = prompt.get("output_schema", {})
    normalized = _normalize_response(parsed, schema)

    return PatriotAssistResponse(
        title=normalized["title"],
        summary=normalized["summary"],
        steps=normalized["steps"],
        warnings=normalized["warnings"],
        do_now=normalized["do_now"],
        confidence=normalized["confidence"],
        sources_used=normalized["sources_used"],
        scripts=normalized.get("scripts", {}),
        checklists=normalized.get("checklists", []),
    )
