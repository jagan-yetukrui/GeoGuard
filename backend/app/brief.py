"""
Gemini-generated emergency summary and priority actions from plan (no coordinates).
"""
from app.settings import settings


def generate_brief(plan: dict) -> tuple[str, list[str], str] | None:
    """
    Call Gemini to produce summary, top 5 actions, and public message.
    Returns (summary, priority_actions, public_message) or None if unavailable.
    """
    key = settings.gemini_api_key
    if not key:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        summary_in = plan.get("summary", "")[:500]
        actions_in = plan.get("priority_actions", [])[:10]
        prompt = f"""You are an emergency response coordinator. Given this earthquake response plan summary and actions, return exactly three items in this format (no other text):

1. EMERGENCY SUMMARY: (2-3 calm, authoritative sentences for the public)
2. TOP 5 ACTIONS: (one per line, starting with "1." through "5.")
3. PUBLIC MESSAGE: (one short sentence suitable for broadcast)

Plan summary: {summary_in}
Planned actions: {chr(10).join(str(a) for a in actions_in)}

Output format:
EMERGENCY SUMMARY:
...
TOP 5 ACTIONS:
1. ...
2. ...
...
PUBLIC MESSAGE:
...
"""
        response = model.generate_content(prompt)
        if not response or not response.text:
            return None
        text = response.text.strip()
        summary = ""
        actions: list[str] = []
        public_message = ""
        section = None
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("EMERGENCY SUMMARY"):
                section = "summary"
                continue
            if line.startswith("TOP 5 ACTIONS"):
                section = "actions"
                continue
            if line.startswith("PUBLIC MESSAGE"):
                section = "public"
                continue
            if section == "summary" and line:
                summary = line
                section = None
            elif section == "actions" and line:
                if line[0].isdigit() and ". " in line:
                    actions.append(line.split(". ", 1)[1].strip())
                elif line:
                    actions.append(line)
            elif section == "public" and line:
                public_message = line
                section = None
        if not summary and "EMERGENCY SUMMARY" in text:
            summary = text.split("TOP 5 ACTIONS")[0].replace("EMERGENCY SUMMARY:", "").strip()[:300]
        if not actions:
            actions = (plan.get("priority_actions") or [])[:5]
        if not public_message:
            public_message = summary[:200] if summary else "Follow official evacuation and safety instructions."
        return (summary or "Emergency response plan activated.", actions[:5], public_message)
    except Exception:
        return None
