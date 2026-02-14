"""
Gemini-powered 911-style chat: answers user questions using current disaster/plan context.
"""
from app.settings import get_gemini_api_key

GEMINI_MODEL = "gemini-2.5-flash"


def chat_with_disaster_context(
    message: str,
    *,
    quake_place: str | None = None,
    quake_mag: float | None = None,
    quake_depth_km: float | None = None,
    plan_summary: str | None = None,
    priority_actions: list[str] | None = None,
    damage_score: int | None = None,
    confidence: str | None = None,
) -> str | None:
    """
    Call Gemini to answer the user's question using disaster context.
    Returns the model reply or None if unavailable.
    """
    key = get_gemini_api_key()
    if not key or not (message or "").strip():
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(GEMINI_MODEL)

        context_parts = []
        if quake_place or quake_mag is not None:
            event_line = f"Current event: {quake_place or 'Unknown location'}"
            if quake_mag is not None:
                event_line += f", magnitude M{quake_mag:.1f}"
            context_parts.append(event_line)
            if quake_depth_km is not None:
                context_parts.append(f"Depth: {quake_depth_km:.0f} km")
        if plan_summary:
            context_parts.append(f"Response plan summary: {plan_summary[:400]}")
        if priority_actions:
            context_parts.append("Priority actions: " + "; ".join(priority_actions[:8]))
        if damage_score is not None:
            context_parts.append(f"Damage score: {damage_score}/100 (confidence: {confidence or 'N/A'})")

        context_blob = "\n".join(context_parts) if context_parts else "No specific event or plan loaded."

        prompt = f"""You are a calm, helpful 911-style emergency assistant for earthquake response. Use the disaster context below to answer the user's question with practical, actionable suggestions. Keep replies concise (2-4 short paragraphs max). Do not invent data; base answers on the context. If the question is not about the current event or emergency response, briefly answer and suggest they check official sources.

Disaster context:
{context_blob}

User question: {message.strip()}

Reply (plain text, no markdown):"""

        response = model.generate_content(prompt)
        if not response or not response.text:
            return None
        return response.text.strip()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Gemini chat failed: %s", e)
        return None
