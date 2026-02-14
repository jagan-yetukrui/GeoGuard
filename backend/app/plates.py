import json
from pathlib import Path

from shapely.geometry import LineString, Point

_BOUNDARIES: list[LineString] = []


def _load_boundaries() -> list[LineString]:
    global _BOUNDARIES
    if _BOUNDARIES:
        return _BOUNDARIES
    data_path = Path(__file__).resolve().parent.parent / "data" / "plate_boundaries.geojson"
    if not data_path.exists():
        return []
    try:
        with open(data_path) as f:
            data = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    features = data.get("features", [])
    lines: list[LineString] = []
    for f in features:
        geom = f.get("geometry")
        if not geom or geom.get("type") != "LineString":
            continue
        coords = geom.get("coordinates", [])
        if len(coords) < 2:
            continue
        try:
            lines.append(LineString(coords))
        except (TypeError, ValueError):
            continue
    _BOUNDARIES = lines
    return _BOUNDARIES


def distance_km_to_plate(lat: float, lng: float) -> float | None:
    boundaries = _load_boundaries()
    if not boundaries:
        return None
    point = Point(lng, lat)
    min_dist_deg = min(line.distance(point) for line in boundaries)
    deg_to_km = 111.0
    return min_dist_deg * deg_to_km
