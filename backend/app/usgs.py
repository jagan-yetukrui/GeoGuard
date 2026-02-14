import time
from typing import Any

import httpx

from app.settings import settings

USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"

_cache: dict[str, Any] = {}
_cache_time: float = 0.0


def _fetch_raw() -> list[dict] | None:
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(USGS_URL)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    features = data.get("features", [])
    return features


def _normalize(feature: dict) -> dict | None:
    props = feature.get("properties", {})
    geom = feature.get("geometry", {})
    coords = geom.get("coordinates", [])
    if len(coords) < 2:
        return None
    lng, lat = coords[0], coords[1]
    depth_km = float(coords[2]) if len(coords) > 2 else 0.0
    mag = props.get("mag")
    if mag is None:
        mag = 0.0
    else:
        try:
            mag = float(mag)
        except (TypeError, ValueError):
            mag = 0.0
    place = props.get("place") or ""
    ts = props.get("time")
    if ts is not None:
        try:
            time_str = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(ts / 1000.0))
        except (TypeError, ValueError):
            time_str = ""
    else:
        time_str = ""
    fid = feature.get("id") or ""
    return {
        "id": fid,
        "place": place,
        "time": time_str,
        "mag": mag,
        "depth_km": depth_km,
        "lat": lat,
        "lng": lng,
    }


def get_live_quake() -> dict | None:
    global _cache, _cache_time
    now = time.monotonic()
    if now - _cache_time > settings.usgs_cache_ttl_seconds:
        _cache = {}
        _cache_time = now
    if "quakes" not in _cache:
        features = _fetch_raw()
        if not features:
            return None
        quakes = []
        for f in features:
            q = _normalize(f)
            if q:
                quakes.append(q)
        _cache["quakes"] = quakes
    quakes = _cache["quakes"]
    if not quakes:
        return None
    strongest = max(quakes, key=lambda q: (q["mag"], q["time"]))
    return strongest


def get_quake_by_id(quake_id: str) -> dict | None:
    quakes = _cache.get("quakes")
    if not quakes:
        get_live_quake()
        quakes = _cache.get("quakes") or []
    for q in quakes:
        if q.get("id") == quake_id:
            return q
    return None
