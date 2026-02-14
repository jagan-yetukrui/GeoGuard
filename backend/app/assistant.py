"""
Emergency Copilot: triage and 911 script generation using Gemini.
Decision support only — not a substitute for emergency services.
"""
import json
import re
from app.settings import get_gemini_api_key

GEMINI_MODEL = "gemini-2.5-flash"


def _call_gemini(prompt: str) -> str | None:
    key = get_gemini_api_key()
    if not key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        if not response or not response.text:
            return None
        return response.text.strip()
    except Exception:
        return None


def run_triage(
    situation_type: str,
    user_notes: str = "",
    lat: float | None = None,
    lng: float | None = None,
    quake_context: str | None = None,
    answers_so_far: dict[str, str] | None = None,
) -> dict | None:
    """
    Return { "risk_level": "critical"|"urgent"|"stable", "next_steps": [...], "questions": [...] }
    or None if unavailable.
    """
    answers = answers_so_far or {}
    loc = f"Location: {lat}, {lng}" if lat is not None and lng is not None else "Location: unknown"
    ctx = f"\nEarthquake context: {quake_context}" if quake_context else ""
    answers_blob = "\n".join(f"- {k}: {v}" for k, v in answers.items()) if answers else "None yet."

    prompt = f"""You are an emergency decision-support assistant. You do NOT replace 911. Output valid JSON only.

Situation type: {situation_type}
User notes: {user_notes or "None"}
{loc}{ctx}
Answers so far:
{answers_blob}

Classify risk_level as exactly one of: critical, urgent, stable.
- critical: immediate danger, life-threatening, call 911 now.
- urgent: needs help soon, possible injury or trapped.
- stable: information only, no immediate danger.

Provide 3-6 short next_steps (strings). First step for critical must be "Call local emergency services (e.g. 911) now."
Provide 0-4 short follow-up questions (strings) to ask the user, e.g. "Are you bleeding?", "Are you alone?", "Can you move?"

Reply with ONLY a JSON object, no markdown, no explanation:
{{"risk_level":"...","next_steps":["...","..."],"questions":["...","..."]}}"""

    out = _call_gemini(prompt)
    if not out:
        return None
    out = re.sub(r"^```\w*\n?|\n?```$", "", out).strip()
    try:
        data = json.loads(out)
        risk = data.get("risk_level", "stable")
        if risk not in ("critical", "urgent", "stable"):
            data["risk_level"] = "urgent"
        data["next_steps"] = data.get("next_steps") or []
        data["questions"] = data.get("questions") or []
        return data
    except (json.JSONDecodeError, TypeError):
        return None


def generate_911_summary(
    situation_type: str,
    risk_level: str,
    user_notes: str = "",
    location_text: str = "",
    answers: dict[str, str] | None = None,
    num_people: int | None = None,
    best_access: str = "",
) -> str | None:
    """
    Return a short script the user can read to dispatch (location, what happened, injuries, hazards, number of people, access).
    """
    answers_blob = "\n".join(f"- {k}: {v}" for k, v in (answers or {}).items()) or "Not provided."

    prompt = f"""You are generating a 911-ready script for someone to read to emergency dispatch. Output plain text only, no JSON.

Situation: {situation_type}
Risk level: {risk_level}
User notes: {user_notes or "None"}
Location: {location_text or "Unknown"}
Number of people (if known): {num_people or "Unknown"}
Best access / route: {best_access or "Not specified"}

Answers from user:
{answers_blob}

Generate a concise script (4-8 short sentences) that includes:
1. Location (address or coordinates/landmark)
2. What happened (earthquake, injury, trapped, etc.)
3. Injuries if any
4. Hazards (fire, gas, structure damage)
5. Number of people
6. Best way for responders to reach them

Write in a calm, clear way. Start with "I need to report an emergency." End with "Please send help." Do not use markdown or bullets."""

    return _call_gemini(prompt)


def generate_voice_intro(
    quake_place: str = "",
    quake_mag: float | None = None,
    depth_km: float | None = None,
    plan_summary: str = "",
    priority_actions: list[str] | None = None,
) -> str | None:
    """
    Generate a short spoken intro for the voice 911 assistant using live disaster data.
    Returns script text suitable for ElevenLabs TTS (2-4 sentences).
    """
    event_desc = f"M{quake_mag:.1f} earthquake at {quake_place}" if quake_mag is not None and quake_place else (quake_place or "Current earthquake event")
    if depth_km is not None:
        event_desc += f", depth {depth_km:.0f} kilometers."
    else:
        event_desc += "."
    actions = (priority_actions or [])[:3]
    actions_blob = " ".join(actions) if actions else "Follow local emergency guidance."

    prompt = f"""You are a calm voice assistant for earthquake response. Generate a brief spoken intro (2 to 4 short sentences) that:
1. Says this is GeoGuard voice assistant and you're here to help.
2. States the current event: {event_desc}
3. If we have a plan, mention one key action in plain language: {actions_blob}
4. Invite the user to ask a question or request steps.

Write only the script to be read aloud. No markdown, no labels. Use simple words and short sentences. Sound calm and clear."""

    return _call_gemini(prompt)
