import os
from pathlib import Path

from pydantic_settings import BaseSettings

# Load .env from backend/ so it works when running from project root or backend/
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"


def _read_env_file() -> None:
    """Load .env into os.environ so Settings can read it."""
    if not _ENV_FILE.exists():
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(_ENV_FILE, override=False)
    except Exception:
        pass
    # Fallback: read GEMINI_API_KEY and ELEVENLABS_API_KEY from file if still missing
    for env_key in ("GEMINI_API_KEY", "ELEVENLABS_API_KEY"):
        if os.environ.get(env_key):
            continue
        try:
            raw = _ENV_FILE.read_text(encoding="utf-8").lstrip("\ufeff")
            for line in raw.splitlines():
                line = line.strip().rstrip("\r")
                if line.startswith(f"{env_key}=") and "=" in line:
                    _, val = line.split("=", 1)
                    val = val.strip().strip("'\"").strip()
                    if val:
                        os.environ[env_key] = val
                    break
        except Exception:
            pass


_read_env_file()


class Settings(BaseSettings):
    cors_origins: str = "http://localhost:3000"
    usgs_cache_ttl_seconds: int = 30
    usgs_historical_days: int | None = None  # if set, fetch last N days M4+ from USGS for similarity
    historical_quakes_path: str | None = None  # default: project root / earthquake_2025.xlsx
    plate_boundaries_url: str | None = (
        "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json"
    )  # PB2002 global boundaries; fallback to local file on fetch failure
    gemini_api_key: str | None = None
    elevenlabs_api_key: str | None = None
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # Rachel; override via ELEVENLABS_VOICE_ID

    # Snowflake (optional; set in .env to avoid "extra forbidden" when .env has SNOWFLAKE_*)
    snowflake_user: str | None = None
    snowflake_password: str | None = None
    snowflake_account: str | None = None
    snowflake_warehouse: str = "COMPUTE_WH"
    snowflake_database: str = "EARTHQUAKE_PROJECT"
    snowflake_schema: str = "RAW_DATA"
    snowflake_default_table: str | None = None

    class Config:
        env_file = str(_ENV_FILE) if _ENV_FILE.exists() else ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# If pydantic didn't load the key (e.g. env_file path issue), set it from os.environ
if not settings.gemini_api_key and os.environ.get("GEMINI_API_KEY"):
    settings.gemini_api_key = os.environ["GEMINI_API_KEY"]
if not settings.elevenlabs_api_key and os.environ.get("ELEVENLABS_API_KEY"):
    settings.elevenlabs_api_key = os.environ["ELEVENLABS_API_KEY"]


def get_elevenlabs_api_key() -> str | None:
    """Return ElevenLabs API key from settings or by reading backend/.env."""
    key = settings.elevenlabs_api_key
    if key:
        return key
    if os.environ.get("ELEVENLABS_API_KEY"):
        return os.environ["ELEVENLABS_API_KEY"]
    if _ENV_FILE.exists():
        try:
            raw = _ENV_FILE.read_text(encoding="utf-8").lstrip("\ufeff")
            for line in raw.splitlines():
                line = line.strip().rstrip("\r")
                if line.startswith("ELEVENLABS_API_KEY=") and "=" in line:
                    _, val = line.split("=", 1)
                    val = val.strip().strip("'\"").strip()
                    if val:
                        return val
                    break
        except Exception:
            pass
    return None


def get_gemini_api_key() -> str | None:
    """Return Gemini API key from settings or by reading backend/.env. Use this for chat/brief."""
    key = settings.gemini_api_key
    if key:
        return key
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    if _ENV_FILE.exists():
        try:
            raw = _ENV_FILE.read_text(encoding="utf-8").lstrip("\ufeff")
            for line in raw.splitlines():
                line = line.strip().rstrip("\r")
                if line.startswith("GEMINI_API_KEY=") and "=" in line:
                    _, val = line.split("=", 1)
                    val = val.strip().strip("'\"").strip()
                    if val:
                        return val
                    break
        except Exception:
            pass
    return None
