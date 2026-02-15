"""
Zone POIs: fetch real locations (open areas, hospitals, parks, shelters) and assign to risk zones.
Uses zones_geojson (grid polygons) for point-in-polygon; per-zone rules filter by type.
Only on-land POIs are returned.
"""
from typing import Any, Literal

from shapely.geometry import Point, shape
from shapely.ops import unary_union

from app.landmask import is_land

# Types we use for zone POIs (normalized from Overpass + Google)
ZONE_POI_TYPES = ("hospital", "shelter", "park", "open_area")

# Per-zone allowed types: high=open_area only; medium=open_area+hospital; low=all
ALLOWED_BY_LEVEL: dict[str, tuple[str, ...]] = {
    "high": ("open_area",),
    "medium": ("open_area", "hospital"),
    "low": ("hospital", "open_area", "park", "shelter"),
}

# Cap per zone to avoid clutter (per type, then take up to this many per zone total)
MAX_POIS_PER_ZONE = 50


def _build_level_polygons(zones_geojson: dict[str, Any]) -> dict[str, Any]:
    """
    Build a Shapely (multi)polygon per level from zones_geojson.
    Returns dict level -> geometry (Polygon or MultiPolygon), or empty if no features.
    """
    out: dict[str, Any] = {}
    features = (zones_geojson or {}).get("features") or []
    by_level: dict[str, list[Any]] = {"high": [], "medium": [], "low": []}

    for f in features:
        level = (f.get("properties") or {}).get("level")
        if level not in by_level:
            continue
        geom = f.get("geometry")
        if not geom:
            continue
        try:
            shp = shape(geom)
            if shp.is_empty:
                continue
            by_level[level].append(shp)
        except Exception:
            continue

    for level in ("high", "medium", "low"):
        if not by_level[level]:
            continue
        union = unary_union(by_level[level])
        if union.is_empty:
            continue
        out[level] = union
    return out


def _normalize_type(t: str) -> str:
    """Map API types to zone POI types: hospital, shelter, park, open_area."""
    t = (t or "").strip().lower()
    if t in ("hospital", "clinic", "ambulance"):
        return "hospital"
    if t == "shelter":
        return "shelter"
    if t == "park":
        return "park"
    if t in ("open_area", "stadium", "grass", "recreation"):
        return "open_area"
    return "other"


def _assign_zone(
    lat: float, lng: float, level_polygons: dict[str, Any]
) -> Literal["high", "medium", "low"] | None:
    """
    Assign highest-risk zone that contains the point (high > medium > low).
    GeoJSON/Shapely use (lng, lat) for Point.
    """
    pt = Point(lng, lat)
    for level in ("high", "medium", "low"):
        poly = level_polygons.get(level)
        if poly is not None and poly.contains(pt):
            return level
    return None


def compute_zone_pois(
    zones_geojson: dict[str, Any] | None,
    epicenter_lat: float,
    epicenter_lng: float,
    high_km: float,
    med_km: float,
    low_km: float,
    pre_fetched_infra: list[dict[str, Any]] | None = None,
    pre_fetched_places: list[dict[str, Any]] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """
    Assign POI candidates to zones by point-in-polygon, apply per-zone type filter.
    Returns { "high": [...], "medium": [...], "low": [...] }.
    If pre_fetched_infra and pre_fetched_places are provided, skips API calls (faster).
    """
    result: dict[str, list[dict[str, Any]]] = {"high": [], "medium": [], "low": []}

    level_polygons: dict[str, Any] = {}
    if zones_geojson and (zones_geojson.get("features")):
        level_polygons = _build_level_polygons(zones_geojson)
    if not level_polygons:
        return result

    candidates: list[dict[str, Any]] = []
    seen: set[tuple[float, float]] = set()

    # Use pre-fetched data when available (avoids duplicate Overpass + Google calls)
    if pre_fetched_infra is not None and pre_fetched_places is not None:
        for n in pre_fetched_infra:
            t = n.get("type", "")
            if t in ("hospital", "clinic", "ambulance"):
                norm = "hospital"
            elif t == "shelter":
                norm = "shelter"
            else:
                continue
            key = (round(n["lat"], 5), round(n["lng"], 5))
            if key in seen:
                continue
            seen.add(key)
            candidates.append({"name": n["name"], "type": norm, "lat": n["lat"], "lng": n["lng"]})
        for n in pre_fetched_places:
            norm = _normalize_type(n.get("type", ""))
            if norm == "other":
                continue
            key = (round(n["lat"], 5), round(n["lng"], 5))
            if key in seen:
                continue
            seen.add(key)
            candidates.append({"name": n["name"], "type": norm, "lat": n["lat"], "lng": n["lng"]})
    else:
        from app.overpass import fetch_zone_pois_candidates
        from app.places import fetch_places_infra

        max_radius_km = max(high_km, med_km, low_km, 1.0)
        half_km = min(max_radius_km, 50.0)
        overpass_list, overpass_ok = fetch_zone_pois_candidates(
            epicenter_lat, epicenter_lng, half_km
        )
        if overpass_ok and overpass_list:
            for n in overpass_list:
                key = (round(n["lat"], 5), round(n["lng"], 5))
                if key in seen:
                    continue
                seen.add(key)
                candidates.append({"name": n["name"], "type": n["type"], "lat": n["lat"], "lng": n["lng"]})
        places_list, places_ok = fetch_places_infra(
            epicenter_lat, epicenter_lng, radius_km=max_radius_km
        )
        if places_ok and places_list:
            for n in places_list:
                norm = _normalize_type(n.get("type", ""))
                if norm == "other":
                    continue
                key = (round(n["lat"], 5), round(n["lng"], 5))
                if key in seen:
                    continue
                seen.add(key)
                candidates.append({"name": n["name"], "type": norm, "lat": n["lat"], "lng": n["lng"]})

    # Assign each candidate to at most one zone (highest risk) and apply type filter; only on-land POIs
    by_zone: dict[str, list[dict[str, Any]]] = {"high": [], "medium": [], "low": []}
    for c in candidates:
        if not is_land(c["lat"], c["lng"]):
            continue
        zone = _assign_zone(c["lat"], c["lng"], level_polygons)
        if zone is None:
            continue
        allowed = ALLOWED_BY_LEVEL.get(zone, ())
        if c["type"] not in allowed:
            continue
        by_zone[zone].append({"name": c["name"], "type": c["type"], "lat": c["lat"], "lng": c["lng"]})

    # Cap per zone
    for level in ("high", "medium", "low"):
        result[level] = by_zone[level][:MAX_POIS_PER_ZONE]

    return result
