"""
Plate boundary data: PB2002 (Bird 2003), from configured URL or local file.
USGS plate boundary map uses the same source: https://earthquake.usgs.gov/arcgis/rest/services/eq/map_plateboundaries/MapServer
"""
import json
import math
from pathlib import Path

import httpx
from shapely.geometry import LineString

from app.settings import settings

_BOUNDARIES: list[LineString] = []
MAX_PLATE_DISTANCE_KM = 20000.0  # half Earth circumference; sanity cap

# Display-only: fewer, longer lines for map (USGS-style)
PLATE_DISPLAY_MIN_LENGTH_KM = 200  # minimum segment length to include in map GeoJSON
PLATE_DISPLAY_SIMPLIFY_TOLERANCE = 0.15  # Douglas-Peucker tolerance in degrees (0 = no simplify)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km between (lat1, lng1) and (lat2, lng2)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _densify_coords(coords: list[tuple[float, float]], max_segment_km: float = 50.0) -> list[tuple[float, float]]:
    """Add points along segments longer than max_segment_km so we don't miss nearest point on long segments."""
    if not coords:
        return []
    out: list[tuple[float, float]] = [coords[0]]
    km_per_deg_lat = 111.0
    for i in range(1, len(coords)):
        lng1, lat1 = coords[i - 1]
        lng2, lat2 = coords[i]
        km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians((lat1 + lat2) / 2)))
        dist_km = _haversine_km(lat1, lng1, lat2, lng2)
        if dist_km <= max_segment_km:
            out.append(coords[i])
            continue
        n = max(2, int(dist_km / max_segment_km) + 1)
        for j in range(1, n):
            t = j / n
            lat = lat1 + t * (lat2 - lat1)
            lng = lng1 + t * (lng2 - lng1)
            out.append((lng, lat))
        out.append(coords[i])
    return out


def _line_length_km(line: LineString) -> float:
    """Total length of a LineString in km (sum of haversine distances between consecutive points)."""
    coords = list(line.coords)
    if len(coords) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(coords)):
        lng1, lat1 = coords[i - 1]
        lng2, lat2 = coords[i]
        total += _haversine_km(lat1, lng1, lat2, lng2)
    return total


def _extract_lines(geom: dict) -> list[LineString]:
    """Extract LineStrings from a GeoJSON geometry (LineString or MultiLineString)."""
    lines: list[LineString] = []
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    if gtype == "LineString" and len(coords) >= 2:
        try:
            lines.append(LineString(coords))
        except (TypeError, ValueError):
            pass
    elif gtype == "MultiLineString":
        for part in coords:
            if len(part) >= 2:
                try:
                    lines.append(LineString(part))
                except (TypeError, ValueError):
                    continue
    return lines


def _load_boundaries() -> list[LineString]:
    global _BOUNDARIES
    if _BOUNDARIES:
        return _BOUNDARIES
    url = getattr(settings, "plate_boundaries_url", None) or None
    if url:
        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.get(url)
                r.raise_for_status()
                data = r.json()
        except (httpx.HTTPError, ValueError, json.JSONDecodeError):
            data = None
        if data:
            features = data.get("features", [])
            lines: list[LineString] = []
            for f in features:
                geom = f.get("geometry")
                if not geom:
                    continue
                lines.extend(_extract_lines(geom))
            if lines:
                _BOUNDARIES = lines
                return _BOUNDARIES
    # Fallback: local file
    data_path = Path(__file__).resolve().parent.parent / "data" / "plate_boundaries.geojson"
    if not data_path.exists():
        return []
    try:
        with open(data_path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    features = data.get("features", [])
    lines = []
    for f in features:
        geom = f.get("geometry")
        if not geom:
            continue
        lines.extend(_extract_lines(geom))
    _BOUNDARIES = lines
    return _BOUNDARIES


def get_boundaries_geojson() -> dict:
    """
    Return simplified plate boundaries for map display (USGS-style: fewer, longer lines).
    Full boundaries are still used for distance_km_to_plate. Filter by min length and
    apply Douglas-Peucker simplification so the map shows major boundaries only.
    """
    boundaries = _load_boundaries()
    features = []
    for line in boundaries:
        if _line_length_km(line) < PLATE_DISPLAY_MIN_LENGTH_KM:
            continue
        if PLATE_DISPLAY_SIMPLIFY_TOLERANCE > 0:
            line = line.simplify(PLATE_DISPLAY_SIMPLIFY_TOLERANCE)
        coords = [list(c) for c in line.coords]
        if len(coords) >= 2:
            features.append({
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "LineString", "coordinates": coords},
            })
    return {"type": "FeatureCollection", "features": features}


def distance_km_to_plate(lat: float, lng: float) -> float | None:
    """
    Great-circle distance in km from (lat, lng) to nearest point on any loaded boundary.
    Capped at MAX_PLATE_DISTANCE_KM so we never return impossible values.
    """
    boundaries = _load_boundaries()
    if not boundaries:
        return None
    min_km = float("inf")
    for line in boundaries:
        coords = list(line.coords)
        if not coords:
            continue
        densified = _densify_coords(coords)
        for lng_v, lat_v in densified:
            d = _haversine_km(lat, lng, lat_v, lng_v)
            min_km = min(min_km, d)
    if min_km == float("inf"):
        return None
    return min(min_km, MAX_PLATE_DISTANCE_KM)


def plate_motion_proxy_mm_yr(plate_distance_km: float | None) -> float | None:
    """
    Proxy for relative plate motion (mm/yr) when epicenter is near a boundary.
    Values consistent with published plate motion models (e.g. MORVEL, DeMets et al. 2010).
    For point-wise velocity use UNAVCO Plate Motion Calculator or similar.
    """
    if plate_distance_km is None:
        return None
    if plate_distance_km <= 50:
        return 35.0
    if plate_distance_km <= 100:
        return 25.0
    if plate_distance_km <= 200:
        return 15.0
    return None
