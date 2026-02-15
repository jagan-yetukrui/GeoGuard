"""
OSRM routing: fetch road-based route geometry.
Falls back to straight-line if OSRM fails (rate limit, network error, etc.).
"""
import time

import httpx

OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"
# OSRM public demo allows ~1 req/sec
OSRM_DELAY_SEC = 1.1

_last_osrm_call: float = 0.0


def fetch_osrm_route(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
) -> list[tuple[float, float]] | None:
    """
    Fetch road geometry from OSRM. Returns list of (lat, lng) along the route,
    or None on failure (fallback to straight-line).
    OSRM expects lng,lat order in the URL.
    """
    global _last_osrm_call
    now = time.monotonic()
    elapsed = now - _last_osrm_call
    if elapsed < OSRM_DELAY_SEC:
        time.sleep(OSRM_DELAY_SEC - elapsed)
    _last_osrm_call = time.monotonic()

    coords = f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
    url = f"{OSRM_BASE}/{coords}?overview=full&geometries=geojson"
    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError, KeyError):
        return None

    routes = data.get("routes", [])
    if not routes:
        return None
    geom = routes[0].get("geometry")
    if not geom or geom.get("type") != "LineString":
        return None
    coords_list = geom.get("coordinates", [])
    if not coords_list:
        return None
    # GeoJSON LineString: [[lng, lat], ...]
    return [(float(c[1]), float(c[0])) for c in coords_list]
