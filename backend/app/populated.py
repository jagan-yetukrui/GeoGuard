"""
Populated-area check: exclude remote locations where there is no infrastructure data.
Uses Natural Earth 50m populated places. On failure returns False so we never show remote and never crash.
"""
from math import cos, radians, sin, sqrt, atan2
from typing import Any

POPULATED_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson"
RADIUS_KM = 30.0  # Within this distance of a populated place = "populated"

# Grid: (cell_lat, cell_lng) -> list of (lat, lng)
_grid: dict[tuple[int, int], list[tuple[float, float]]] = {}


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in km between two points (WGS84)."""
    R = 6371.0
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c


def _load() -> None:
    global _grid
    if _grid:
        return
    try:
        import httpx
        with httpx.Client(timeout=30.0) as client:
            r = client.get(POPULATED_URL)
            r.raise_for_status()
            data = r.json()
        for f in data.get("features", []):
            geom = f.get("geometry")
            if geom and geom.get("type") == "Point":
                coords = geom.get("coordinates", [])
                if len(coords) >= 2:
                    lng, lat = float(coords[0]), float(coords[1])
                    cell = (int(lat), int(lng))
                    if cell not in _grid:
                        _grid[cell] = []
                    _grid[cell].append((lat, lng))
    except Exception:
        _grid = {}  # On failure, no points = all considered remote (filtered out)


def is_populated(lat: float, lng: float, radius_km: float = RADIUS_KM) -> bool:
    """
    Return True if (lat, lng) is within radius_km of a populated place, False otherwise.
    Safe to call from any thread; never raises.
    """
    try:
        _load()
        if not _grid:
            return False
        # 30km ~ 0.3 deg; check cells within 1 deg
        cell_lat, cell_lng = int(lat), int(lng)
        deg_per_km = 1.0 / 111.0
        lat_delta = radius_km * deg_per_km
        lng_delta = radius_km * deg_per_km / max(0.1, abs(cos(radians(lat))))
        for dlat in (-1, 0, 1):
            for dlng in (-1, 0, 1):
                cell = (cell_lat + dlat, cell_lng + dlng)
                for plat, plng in _grid.get(cell, []):
                    if abs(plat - lat) > lat_delta or abs(plng - lng) > lng_delta:
                        continue
                    if _haversine_km(lat, lng, plat, plng) <= radius_km:
                        return True
        return False
    except Exception:
        return False


def filter_populated_points(
    points: list[dict[str, Any]],
    lat_key: str = "lat",
    lng_key: str = "lng",
    radius_km: float = RADIUS_KM,
) -> list[dict[str, Any]]:
    """Return only items where is_populated(p[lat_key], p[lng_key]) is True."""
    return [p for p in points if is_populated(p.get(lat_key, 0), p.get(lng_key, 0), radius_km)]
