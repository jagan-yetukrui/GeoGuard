"""
Patriot AI prompt builder per intent.
Strict rules: always include emergency disclaimer, never claim certainty, short and operational.
Return ONLY valid JSON matching schema, no markdown.
"""
from typing import Any


DISCLAIMER = "If you are in immediate danger, call emergency services now."


def _base_system_prompt() -> str:
    return f"""You are Patriot AI, an emergency assistant for earthquake response.
Rules:
- Always include: "{DISCLAIMER}"
- Never claim certainty. Use the confidence field (low/medium/high) based on data completeness.
- Be short and operational. No fluff.
- Return ONLY valid JSON matching the schema. No markdown, no code blocks, no explanation outside JSON."""


def build_prompt(intent: str, context: dict[str, Any]) -> tuple[str, str]:
    """
    Build (system_prompt, user_message) for the given intent and context.
    Returns prompts that elicit JSON-only responses.
    """
    system = _base_system_prompt()
    ctx_str = str(context)

    if intent == "safe_directions":
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {}, "checklists": [], "confidence": "low"|"medium"|"high"}
- title: "Safest Route Guidance"
- steps: 6-10 short steps
- warnings: aftershocks, debris, gas leaks
- include nearest shelter and ETA if available in context"""
        user = f"Generate safest route guidance. Context: {ctx_str}"

    elif intent == "hot_spots_summary":
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {}, "checklists": [], "confidence": "low"|"medium"|"high"}
- summary: explain collapse hotspots and where not to go
- steps: avoidance directions for citizen and responder
- confidence based on data completeness"""
        user = f"Summarize collapse hotspots and avoidance. Context: {ctx_str}"

    elif intent == "call_script_911":
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {"911": str, "sms": str}, "checklists": [], "confidence": "low"|"medium"|"high"}
- scripts.911: ready-to-read script, 15-30 seconds, calm and structured
- scripts.sms: short SMS version
- Keep it calm, structured"""
        user = f"Generate 911 call script. Context: {ctx_str}"

    elif intent == "activation_messages":
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {"loved_ones": str, "rescue_teams": str, "situation_broadcast": str, "sos_contacts": str}, "checklists": [], "confidence": "low"|"medium"|"high"}
- Each script short, includes location, situation, needs, and [LINK] placeholder
- loved_ones: message for family
- rescue_teams: message for responders
- situation_broadcast: general broadcast
- sos_contacts: for emergency contacts"""
        user = f"Generate activation messages. Context: {ctx_str}"

    elif intent == "volunteer_tasks":
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {}, "checklists": [{"title": str, "items": [str]}], "confidence": "low"|"medium"|"high"}
- checklists: "Search & Rescue", "Medical", "Logistics", "Comms"
- Each with 5-8 tasks, use [P0], [P1] for priority tags"""
        user = f"Generate volunteer task checklists. Context: {ctx_str}"

    elif intent == "situation_brief":
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {}, "checklists": [], "confidence": "low"|"medium"|"high"}
- Briefing suitable for Incident Commander
- Include current shortages and priority routes"""
        user = f"Generate situation brief for Incident Commander. Context: {ctx_str}"

    else:
        system += """
Output schema: {"title": str, "summary": str, "steps": [str], "warnings": [str], "scripts": {}, "checklists": [], "confidence": "low"|"medium"|"high"}"""
        user = f"Generate emergency guidance for intent={intent}. Context: {ctx_str}"

    return system, user
