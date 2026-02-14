"""
ElevenLabs text-to-speech: convert text to audio, return base64.
"""
import base64
import logging

from app.settings import get_elevenlabs_api_key, settings

logger = logging.getLogger(__name__)


class VoiceAPIError(Exception):
    """ElevenLabs API returned an error; use status_code and detail for HTTP response."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def text_to_speech_base64(text: str) -> tuple[str, str] | None:
    """
    Return (base64_audio, content_type) or None if key missing / no text.
    Raises VoiceAPIError on ElevenLabs API failure (caller should return 502).
    """
    key = get_elevenlabs_api_key()
    if not key:
        logger.info("ELEVENLABS_API_KEY present: False")
        return None
    logger.info("ELEVENLABS_API_KEY present: True")
    if not text.strip():
        return None
    voice_id = settings.elevenlabs_voice_id or "21m00Tcm4TlvDq8ikWAM"
    try:
        from elevenlabs.client import ElevenLabs

        client = ElevenLabs(api_key=key)
        audio = client.text_to_speech.convert(
            text=text[:5000],
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        chunks = list(audio)
        data = b"".join(chunks) if chunks else b""
        return base64.b64encode(data).decode("utf-8"), "audio/mpeg"
    except VoiceAPIError:
        raise
    except Exception as e:
        err_msg = str(e)
        logger.warning("ElevenLabs TTS failed: %s", err_msg, exc_info=True)
        status = 502
        if hasattr(e, "status_code"):
            status = int(getattr(e, "status_code", 502))
        body = getattr(e, "body", None)
        if body is not None:
            try:
                body_str = body.decode("utf-8", errors="replace") if isinstance(body, bytes) else str(body)
                logger.warning("ElevenLabs response body: %s", body_str[:500])
                err_msg = body_str[:200] if len(body_str) > 200 else body_str
            except Exception:
                pass
        raise VoiceAPIError(status, f"ElevenLabs error: {err_msg}")
