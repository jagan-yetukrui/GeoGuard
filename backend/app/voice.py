"""
ElevenLabs text-to-speech: convert text to audio, return base64.
"""
import base64
from app.settings import settings


def text_to_speech_base64(text: str) -> tuple[str, str] | None:
    """
    Return (base64_audio, content_type) or None if unavailable.
    """
    key = settings.elevenlabs_api_key
    if not key or not text.strip():
        return None
    try:
        from elevenlabs.client import ElevenLabs
        client = ElevenLabs(api_key=key)
        audio = client.text_to_speech.convert(
            text=text[:5000],
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        chunks = list(audio)
        data = b"".join(chunks) if chunks else b""
        return base64.b64encode(data).decode("utf-8"), "audio/mpeg"
    except Exception:
        return None
