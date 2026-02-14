"""
Historical quakes for similarity: from earthquake_2025.xlsx and optionally USGS FDSNWS (last N days).
Expose get_historical_quakes() and find_similar_quakes(). Normalized keys: time, latitude, longitude, depth, mag, place, id, updated.
"""
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Any

import pandas as pd

from app.settings import settings

_QUAKES: list[dict[str, Any]] = []
_LOADED = False

# Column name mapping (xlsx may use different names)
COL_MAP = {
    "time": "time",
    "latitude": "latitude",
    "longitude": "longitude",
    "lat": "latitude",
    "lon": "longitude",
    "lng": "longitude",
    "depth": "depth",
    "mag": "mag",
    "magnitude": "mag",
    "place": "place",
    "id": "id",
}


def _resolve_path() -> Path:
    if getattr(settings, "historical_quakes_path", None):
        return Path(settings.historical_quakes_path)
    # Default: project root (parent of backend/)
    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir.parent / "earthquake_2025.xlsx"


def _usgs_to_historical(q: dict) -> dict[str, Any]:
    """Convert USGS-normalized quake (id, place, time, mag, depth_km, lat, lng) to historical shape."""
    return {
        "time": q.get("time", ""),
        "latitude": q["lat"],
        "longitude": q["lng"],
        "depth": q["depth_km"],
        "mag": q["mag"],
        "place": q.get("place", ""),
        "id": q.get("id", ""),
        "updated": q.get("time", ""),
    }


def _load_historical() -> list[dict[str, Any]]:
    global _QUAKES, _LOADED
    if _LOADED:
        return _QUAKES
    quakes: list[dict[str, Any]] = []

    # Optional: USGS last N days M4+
    days = getattr(settings, "usgs_historical_days", None)
    if days is not None and days > 0:
        from app.usgs import fetch_events
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=days)
        start_str = start.strftime("%Y-%m-%d")
        end_str = end.strftime("%Y-%m-%d")
        usgs_list = fetch_events(start_str, end_str, minmagnitude=4.0)
        for q in usgs_list:
            quakes.append(_usgs_to_historical(q))

    # Load xlsx if present
    path = _resolve_path()
    if path.exists():
        try:
            df = pd.read_excel(path, engine="openpyxl")
            rename = {}
            for c in df.columns:
                cstr = str(c).strip()
                if cstr in COL_MAP:
                    rename[c] = COL_MAP[cstr]
            df = df.rename(columns=rename)
            required = {"latitude", "longitude", "depth", "mag"}
            if required.issubset(df.columns):
                df = df.dropna(subset=list(required))
                for _, row in df.iterrows():
                    try:
                        lat = float(row["latitude"])
                        lng = float(row["longitude"])
                        depth = float(row["depth"])
                        mag = float(row["mag"])
                    except (TypeError, ValueError):
                        continue
                    quakes.append({
                        "time": str(row.get("time", "")),
                        "latitude": lat,
                        "longitude": lng,
                        "depth": depth,
                        "mag": mag,
                        "place": str(row.get("place", "")),
                        "id": str(row.get("id", "")),
                        "updated": str(row.get("updated", "")),
                    })
        except Exception:
            pass

    _QUAKES = quakes
    _LOADED = True
    return _QUAKES


def get_historical_quakes() -> list[dict[str, Any]]:
    """Return all loaded historical quakes (normalized)."""
    return _load_historical()


def _approx_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Approximate distance in km (WGS84)."""
    import math
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def find_similar_quakes(
    lat: float,
    lng: float,
    mag: float,
    depth_km: float,
    plate_km: float | None,
    k: int = 5,
    max_geo_km: float = 2000.0,
) -> list[dict[str, Any]]:
    """
    Find k historical quakes most similar by magnitude, depth, and plate distance.
    First narrows by geographic distance (within max_geo_km), then scores by similarity.
    """
    quakes = _load_historical()
    if not quakes:
        return []
    # Optional: pre-filter by geographic distance to limit plate-distance calls
    candidates = []
    for q in quakes:
        d = _approx_km(lat, lng, q["latitude"], q["longitude"])
        if d <= max_geo_km:
            candidates.append((d, q))
    if not candidates:
        # No nearby quakes: use global similarity
        candidates = [(float("inf"), q) for q in quakes]
    # Score: normalized distance in (mag, depth) space; optionally include plate
    from app.plates import distance_km_to_plate

    scored = []
    for geo_km, q in candidates:
        q_plate = distance_km_to_plate(q["latitude"], q["longitude"])
        mag_diff = abs(q["mag"] - mag) / max(mag, 0.1)
        depth_diff = abs(q["depth"] - depth_km) / max(depth_km, 1.0)
        plate_diff = 0.0
        if plate_km is not None and q_plate is not None:
            plate_diff = abs(q_plate - plate_km) / max(plate_km, 10.0)
        score = mag_diff + depth_diff + 0.5 * plate_diff
        scored.append((score, q))
    scored.sort(key=lambda x: x[0])
    return [q for _, q in scored[:k]]
