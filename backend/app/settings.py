from pydantic_settings import BaseSettings


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

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
