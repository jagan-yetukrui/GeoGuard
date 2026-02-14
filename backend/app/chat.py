"""
Gemini-powered 911-style chat: answers user questions using current disaster/plan context.
"""
import logging

from app.settings import get_gemini_api_key

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_FALLBACK_MODEL = "gemini-1.5-flash"


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
    if not key:
        logger.warning("Chat: GEMINI_API_KEY not set")
        return None
    msg_stripped = (message or "").strip()
    if not msg_stripped:
        logger.warning("Chat: empty message received")
        return None
    try:
        import google.generativeai as genai

        genai.configure(api_key=key)

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

User question: {msg_stripped}

Reply (plain text, no markdown):"""

        for model_name in (GEMINI_MODEL, GEMINI_FALLBACK_MODEL):
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                if response and getattr(response, "text", None):
                    return response.text.strip()
                # Empty or blocked response
                block_reason = ""
                if response:
                    if getattr(response, "prompt_feedback", None) and getattr(
                        response.prompt_feedback, "block_reason", None
                    ):
                        block_reason = f" block_reason={response.prompt_feedback.block_reason}"
                    if getattr(response, "candidates", None) and len(response.candidates):
                        c = response.candidates[0]
                        if getattr(c, "finish_reason", None):
                            block_reason += f" finish_reason={c.finish_reason}"
                logger.warning(
                    "Chat: Gemini returned no text (model=%s)%s",
                    model_name,
                    block_reason or " (no candidates or feedback)",
                )
            except Exception as e:
                logger.warning("Chat: Gemini failed with model %s: %s", model_name, e)
                continue
        return None
    except Exception as e:
        logger.warning("Gemini chat failed: %s", e, exc_info=True)
        return None
