"""
Earthquake data source: USGS (real-time feed and FDSNWS Event API).
See https://earthquake.usgs.gov/fdsnws/event/1/ and https://earthquake.usgs.gov/earthquakes/feed/
"""
import time
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app.settings import settings

USGS_FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
USGS_FDSNWS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query"

_cache: dict[str, Any] = {}
_cache_time: float = 0.0


def _fetch_raw() -> list[dict] | None:
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(USGS_FEED_URL)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return None
    features = data.get("features", [])
    return features


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
    return _normalize(features[0])


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
        _cache["quakes"] = quakes
    return _cache.get("quakes") or []


def get_latest_quakes(limit: int = 5) -> list[dict]:
    """Return the most recent `limit` quakes from the USGS all_day feed (newest first)."""
    quakes = _ensure_cache()
    return quakes[:limit]


def get_live_quake() -> dict | None:
    """Return the single 'live' quake: highest magnitude among M4+ in the feed, else strongest."""
    quakes = _ensure_cache()
    if not quakes:
        return None
    significant = [q for q in quakes if q["mag"] >= 4.0]
    pool = significant if significant else quakes
    strongest = max(pool, key=lambda q: (q["mag"], q["time"]))
    return strongest


def get_quake_by_id(quake_id: str) -> dict | None:
    quakes = _ensure_cache()
    for q in quakes:
        if q.get("id") == quake_id:
            return q
    # Cache miss: try FDSNWS event-by-id
    return fetch_event_by_id(quake_id)
