"""
Patriot AI client: OpenAI-compatible API via httpx.
Enforces JSON-only responses. Returns 502 on API failure, 503 when key missing.
"""
import json
import logging
import re

import httpx

from app.settings import get_patriot_ai_api_key, settings

logger = logging.getLogger(__name__)


class PatriotAIError(Exception):
    """Patriot AI API error; use status_code and detail for HTTP response."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _extract_json(text: str) -> dict | None:
    """Extract JSON object from response, stripping markdown code blocks if present."""
    if not text or not text.strip():
        return None
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def patriot_assist(system_prompt: str, user_message: str) -> dict:
    """
    Send request to Patriot AI. Returns parsed JSON dict.
    Raises PatriotAIError on failure.
    """
    key = get_patriot_ai_api_key()
    if not key:
        raise PatriotAIError(503, "PATRIOT_AI_API_KEY missing. Set it in backend/.env and restart.")

    base_url = (settings.patriot_ai_base_url or "https://api.openai.com/v1").rstrip("/")
    model = settings.patriot_ai_model or "gpt-4o-mini"
    url = f"{base_url}/chat/completions"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            r = client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
            )
    except httpx.HTTPError as e:
        err_msg = str(e)
        logger.warning("Patriot AI request failed: %s", err_msg, exc_info=True)
        raise PatriotAIError(502, f"Patriot AI request failed: {err_msg}")

    if r.status_code != 200:
        err_body = r.text[:500] if r.text else ""
        logger.warning("Patriot AI HTTP %s: %s", r.status_code, err_body)
        raise PatriotAIError(502, f"Patriot AI error: HTTP {r.status_code}. {err_body}")

    try:
        data = r.json()
    except json.JSONDecodeError as e:
        raise PatriotAIError(502, f"Patriot AI returned invalid JSON: {e}")

    content = None
    for choice in data.get("choices", []):
        msg = choice.get("message", {})
        if isinstance(msg.get("content"), str):
            content = msg["content"]
            break

    if not content:
        raise PatriotAIError(502, "Patriot AI returned empty response.")

    parsed = _extract_json(content)
    if not parsed or not isinstance(parsed, dict):
        raise PatriotAIError(502, "Patriot AI did not return valid JSON.")

    # Ensure required fields
    if "title" not in parsed:
        parsed["title"] = "Emergency Guidance"
    if "summary" not in parsed:
        parsed["summary"] = ""
    if "steps" not in parsed or not isinstance(parsed["steps"], list):
        parsed["steps"] = []
    if "warnings" not in parsed or not isinstance(parsed["warnings"], list):
        parsed["warnings"] = []
    if "scripts" not in parsed or not isinstance(parsed["scripts"], dict):
        parsed["scripts"] = {}
    if "checklists" not in parsed or not isinstance(parsed["checklists"], list):
        parsed["checklists"] = []
    if parsed.get("confidence") not in ("low", "medium", "high"):
        parsed["confidence"] = "medium"

    return parsed
