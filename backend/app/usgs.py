"""
Earthquake data source: USGS (real-time feed and FDSNWS Event API).
See https://earthquake.usgs.gov/fdsnws/event/1/ and https://earthquake.usgs.gov/earthquakes/feed/
"""
import time
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app.landmask import filter_land_points, is_land
from app.settings import settings

USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"
USGS_FEED_LIVE_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson"
USGS_FDSNWS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query"

_cache: dict[str, Any] = {}
_cache_time: float = 0.0


def _fetch_raw(url: str | None = None) -> list[dict] | None:
    target = url or USGS_FEED_URL
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(target)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    features = data.get("features", [])
    return features


def _fetch_and_normalize(url: str) -> list[dict]:
    """Fetch from URL and return normalized quakes on land (newest first). Excludes ocean only."""
    features = _fetch_raw(url)
    quakes = []
    if features:
        for f in features:
            q = _normalize(f)
            if q:
                quakes.append(q)
        quakes.sort(key=lambda q: q.get("time") or "", reverse=True)
        quakes = filter_land_points(quakes, lat_key="lat", lng_key="lng")
    return quakes


def fetch_event_by_id(event_id: str) -> dict | None:
    """Fetch a single event by ID from USGS FDSNWS. Returns normalized quake dict or None."""
    if not event_id or not event_id.strip():
        return None
    url = f"{USGS_FDSNWS_QUERY}?format=geojson&eventid={event_id.strip()}"
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    features = data.get("features", [])
    if not features:
        return None
    q = _normalize(features[0])
    if q and is_land(q["lat"], q["lng"]):
        return q
    return None


def fetch_events(
    starttime: str,
    endtime: str,
    minmagnitude: float = 4.0,
) -> list[dict]:
    """
    Fetch events from USGS FDSNWS in a time window. Returns list of normalized quake dicts.
    starttime/endtime: ISO8601 or YYYY-MM-DD.
    """
    params = {
        "format": "geojson",
        "starttime": starttime,
        "endtime": endtime,
        "minmagnitude": minmagnitude,
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.get(USGS_FDSNWS_QUERY, params=params)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return []
    features = data.get("features", [])
    quakes = []
    for f in features:
        q = _normalize(f)
        if q:
            quakes.append(q)
    return quakes


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


def _ensure_cache() -> list[dict]:
    """Populate cache from USGS feed if needed; return list of normalized quakes (newest first)."""
    global _cache, _cache_time
    now = time.monotonic()
    if now - _cache_time > settings.usgs_cache_ttl_seconds:
        _cache = {}
        _cache_time = now
    if "quakes" not in _cache:
        features = _fetch_raw()
        quakes = []
        if features:
            for f in features:
                q = _normalize(f)
                if q:
                    quakes.append(q)
            quakes.sort(key=lambda q: q.get("time") or "", reverse=True)
            quakes = filter_land_points(quakes, lat_key="lat", lng_key="lng")
        _cache["quakes"] = quakes
    return _cache.get("quakes") or []


def get_latest_quakes(limit: int = 5, exclude_live: bool = True) -> list[dict]:
    """
    Return the most recent `limit` M2.5+ quakes on land.
    When exclude_live=True (default), skips the live quake so Last 5 shows the ones before it.
    Uses 2.5_hour first, then 2.5_day.
    """
    hour_quakes = _fetch_and_normalize(USGS_FEED_LIVE_URL)
    if len(hour_quakes) < limit + (1 if exclude_live else 0):
        day_quakes = _ensure_cache()
        seen: set[str] = {q["id"] for q in hour_quakes}
        for q in day_quakes:
            if q["id"] not in seen:
                seen.add(q["id"])
                hour_quakes.append(q)
        hour_quakes.sort(key=lambda q: q.get("time") or "", reverse=True)
    if exclude_live and hour_quakes:
        live_id = hour_quakes[0]["id"]
        quakes = [q for q in hour_quakes if q["id"] != live_id]
    else:
        quakes = hour_quakes
    return quakes[:limit]


def get_live_quake() -> dict | None:
    """Return the most recent M2.5+ quake on land. Uses 2.5_hour first, then 2.5_day fallback."""
    hour_quakes = _fetch_and_normalize(USGS_FEED_LIVE_URL)
    if hour_quakes:
        return hour_quakes[0]
    quakes = _ensure_cache()
    return quakes[0] if quakes else None


def get_quake_by_id(quake_id: str) -> dict | None:
    quakes = _ensure_cache()
    for q in quakes:
        if q.get("id") == quake_id:
            return q
    # Cache miss: try FDSNWS event-by-id
    return fetch_event_by_id(quake_id)
