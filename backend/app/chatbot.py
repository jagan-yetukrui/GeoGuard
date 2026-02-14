"""
Context-aware chatbot for earthquake response guidance.
Integrates with Google Generative AI to provide actionable suggestions based on:
- Current earthquake situation (magnitude, depth, location, impact zones)
- Risk assessment (damage score, confidence level)
- Response plan (stations, routes, prioritized actions)
- User queries about what to do, how to react, emergency procedures
"""

import json
from typing import Any
from app.settings import settings


def _format_context(
    quake_data: dict[str, Any] | None = None,
    plan_data: dict[str, Any] | None = None,
    damage_score: int | None = None,
    zones: list[dict[str, Any]] | None = None,
) -> str:
    """
    Format earthquake and plan context into a clear narrative for the AI model.
    """
    context_parts = []
    
    if quake_data:
        context_parts.append(
            f"EARTHQUAKE EVENT:\n"
            f"- Location: {quake_data.get('place', 'Unknown')}\n"
            f"- Magnitude: {quake_data.get('mag', 'Unknown')}\n"
            f"- Depth: {quake_data.get('depth_km', 'Unknown')} km\n"
            f"- Time: {quake_data.get('time', 'Unknown')}"
        )
    
    if damage_score is not None:
        severity = "CRITICAL" if damage_score > 7 else "HIGH" if damage_score > 5 else "MODERATE" if damage_score > 3 else "LOW"
        context_parts.append(f"DAMAGE SEVERITY: {severity} (Score: {damage_score}/10)")
    
    if zones:
        zone_summary = []
        for zone in zones:
            zone_summary.append(f"  • {zone.get('level', 'unknown').upper()}: {zone.get('radius_km', 0)}km radius")
        if zone_summary:
            context_parts.append("RISK ZONES:\n" + "\n".join(zone_summary))
    
    if plan_data:
        if plan_data.get('priority_actions'):
            actions = plan_data['priority_actions']
            context_parts.append(
                f"PRIORITY ACTIONS ({len(actions)}):\n" +
                "\n".join([f"  {i+1}. {a}" for i, a in enumerate(actions[:5])])
            )
        
        if plan_data.get('help_stations'):
            stations = plan_data['help_stations']
            context_parts.append(
                f"HELP STATIONS AVAILABLE ({len(stations)}):\n" +
                "\n".join([f"  • {s.get('type', 'unknown').upper()}: {s.get('name', 'Unknown')}" for s in stations[:3]])
            )
        
        if plan_data.get('summary'):
            context_parts.append(f"SITUATION SUMMARY:\n{plan_data['summary']}")
    
    return "\n\n".join(context_parts)


def get_chatbot_response(
    user_message: str,
    quake_data: dict[str, Any] | None = None,
    plan_data: dict[str, Any] | None = None,
    damage_score: int | None = None,
    zones: list[dict[str, Any]] | None = None,
    chat_history: list[dict[str, str]] | None = None,
) -> tuple[str, str | None]:
    """
    Generate a chatbot response using Google Generative AI.
    Returns (response_text, error_message)
    
    Args:
        user_message: The user's query or statement
        quake_data: Earthquake information (place, mag, depth_km, time)
        plan_data: Response plan (priority_actions, help_stations, summary)
        damage_score: Damage assessment (0-10)
        zones: Risk zones (level, radius_km)
        chat_history: Previous messages for context
    
    Returns:
        (response_text, error) - error is None if successful
    """
    if not settings.google_api_key:
        return "", "Google API key not configured"
    
    if not user_message.strip():
        return "", "Empty message"
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.google_api_key)
        
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Build system prompt with context
        context = _format_context(quake_data, plan_data, damage_score, zones)
        
        system_prompt = """You are GeoGuard, an emergency response AI assistant specialized in earthquake situations.
Your role is to:
1. Provide clear, actionable guidance on what to do NOW
2. Explain the current situation in simple, non-technical terms
3. Prioritize safety and rapid response
4. Give specific location-based recommendations when available
5. Keep responses concise (2-3 sentences max) for critical situations
6. Be calm and reassuring while maintaining urgency

If the user asks about something outside the current emergency context, acknowledge it but refocus on the emergency response.
Never speculate about earthquake causes or predictions."""
        
        # Build conversation history for multi-turn context
        messages = []
        
        if chat_history:
            for msg in chat_history[-4:]:  # Keep last 4 messages for context
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append({"role": role, "parts": [msg["content"]]})
        
        # Add current message
        full_prompt = f"{system_prompt}\n\n{context}\n\nUser: {user_message}"
        messages.append({"role": "user", "parts": [full_prompt]})
        
        # Get response
        response = model.generate_content(
            messages,
            generation_config=genai.types.GenerationConfig(
                temperature=1.0,
                max_output_tokens=256,
            )
        )
        
        if response.candidates:
            text = response.candidates[0].content.parts[0].text if response.candidates[0].content.parts else ""
            return text.strip(), None
        
        return "", "No response generated"
    
    except Exception as e:
        error_msg = f"Chatbot error: {str(e)}"
        return "", error_msg


def get_emergency_suggestions(
    severity: str = "high",
    quake_data: dict[str, Any] | None = None,
) -> list[str]:
    """
    Get quick emergency suggestions based on severity level.
    Used for rapid responses when AI is unavailable.
    """
    suggestions = {
        "critical": [
            "🚨 CRITICAL EARTHQUAKE - Take cover NOW!",
            "Move to interior rooms away from windows",
            "Drop, Cover, and Hold On if still shaking",
            "Do NOT attempt to leave buildings - aftershocks likely",
            "Check for injuries and trapped individuals",
            "Await emergency services - marked routes available on map",
        ],
        "high": [
            "⚠️ Major earthquake detected - Assess your location",
            "Check for visible damage to your building",
            "Stay away from damaged areas and debris",
            "Follow evacuation routes if recommended for your zone",
            "Listen for emergency broadcasting updates",
            "Move to nearby help stations (marked on map)",
        ],
        "moderate": [
            "Moderate earthquake - Check for injuries around you",
            "Stay alert for aftershocks",
            "Review emergency plan provided",
            "Be ready to evacuate if situation worsens",
            "Check status of nearby critical infrastructure",
        ],
        "low": [
            "Low-intensity earthquake detected",
            "Standard precautions recommended",
            "Monitor emergency channels for updates",
            "Ensure family members are safe",
        ]
    }
    
    return suggestions.get(severity, suggestions["moderate"])


def format_voice_briefing(plan_data: dict[str, Any] | None = None, damage_score: int | None = None) -> str:
    """
    Create a concise text briefing suitable for text-to-speech conversion.
    Used when user cannot interact via chat.
    """
    briefing_parts = []
    
    if damage_score is not None:
        if damage_score > 7:
            briefing_parts.append("This is a critical earthquake. Immediate action required.")
        elif damage_score > 5:
            briefing_parts.append("This is a severe earthquake. Follow emergency procedures.")
        else:
            briefing_parts.append("This is a moderate earthquake. Take precautions and stay alert.")
    
    if plan_data:
        if plan_data.get('priority_actions'):
            actions = plan_data['priority_actions'][:3]
            briefing_parts.append("Priority actions: " + "; ".join(actions))
        
        if plan_data.get('summary'):
            briefing_parts.append(f"Situation: {plan_data['summary'][:200]}")
    
    # Default briefing if no data
    if not briefing_parts:
        briefing_parts.append("Earthquake detected. Assess your location and move to safety.")
    
    return " ".join(briefing_parts)
