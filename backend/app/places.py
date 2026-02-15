"""
Google Places API (Nearby Search): fetch real locations (hospitals, shelters, etc.) around a point.
Requires GOOGLE_MAPS_API_KEY. Returns same shape as Overpass infra: {name, type, lat, lng}.
"""
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import httpx

NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
# Max radius for Nearby Search (meters)
MAX_RADIUS_M = 50000
# (type param for API, our type label). Use type for place types, keyword for "emergency shelter"
# park and stadium used for zone POIs (open areas)
SEARCHES: list[tuple[str | None, str | None, str]] = [
    ("hospital", None, "hospital"),
    ("fire_station", None, "fire_station"),
    ("police", None, "police"),
    (None, "emergency shelter", "shelter"),
    ("park", None, "park"),
    ("stadium", None, "open_area"),
]


def _fetch_nearby(
    lat: float,
    lng: float,
    radius_m: int,
    place_type: str | None,
    keyword: str | None,
    api_key: str,
) -> list[dict[str, Any]]:
    """One Nearby Search request. Use either place_type or keyword."""
    params: dict[str, str | int] = {
        "location": f"{lat},{lng}",
        "radius": min(radius_m, MAX_RADIUS_M),
        "key": api_key,
    }
    if keyword:
        params["keyword"] = keyword
    if place_type:
        params["type"] = place_type
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(NEARBY_URL, params=params)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError):
        return []
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        return []
    results = data.get("results") or []
    out: list[dict[str, Any]] = []
    for p in results:
        geom = p.get("geometry") or {}
        loc = geom.get("location") or {}
        plat, plng = loc.get("lat"), loc.get("lng")
        if plat is None or plng is None:
            continue
        name = (p.get("name") or "Unnamed").strip()[:100]
        out.append({
            "name": name or "Unnamed",
            "type": "other",
            "lat": float(plat),
            "lng": float(plng),
        })
    return out


def fetch_places_infra(lat: float, lng: float, radius_km: float = 50.0) -> tuple[list[dict[str, Any]], bool]:
    """
    Fetch hospitals, fire stations, police, and shelters from Google Places Nearby Search.
    Returns (list of {name, type, lat, lng}, success).
    When GOOGLE_MAPS_API_KEY is not set, returns ([], False).
    Runs all 6 place-type searches in parallel for speed.
    """
    api_key = (os.environ.get("GOOGLE_MAPS_API_KEY") or os.environ.get("PLACES_API_KEY") or "").strip()
    if not api_key:
        return [], False
    radius_m = int(radius_km * 1000)
    seen: set[tuple[float, float]] = set()
    merged: list[dict[str, Any]] = []

    def _one_search(args: tuple) -> list[dict[str, Any]]:
        place_type, keyword, our_type = args
        items = _fetch_nearby(lat, lng, radius_m, place_type, keyword, api_key)
        for n in items:
            n["type"] = our_type
        return items

    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_one_search, s): s for s in SEARCHES}
        for future in as_completed(futures):
            for n in future.result():
                key = (round(n["lat"], 5), round(n["lng"], 5))
                if key in seen:
                    continue
                seen.add(key)
                merged.append(n)
    merged.sort(key=lambda x: (x["lat"], x["lng"]))
    return merged, True
