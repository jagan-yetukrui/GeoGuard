"""
Turn grid cells (lat, lng, level) into GeoJSON FeatureCollection and safe staging points.
"""
import math
from typing import Any

from shapely.geometry import Polygon, box
from shapely.ops import unary_union


def _cell_polygon(lat: float, lng: float, resolution_km: float) -> Polygon:
    """Return a Shapely polygon for one grid cell (box in lat/lng)."""
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians(lat)))
    half = resolution_km / 2.0
    dlat = half / km_per_deg_lat
    dlng = half / km_per_deg_lng
    # GeoJSON order: lng, lat
    minx = lng - dlng
    maxx = lng + dlng
    miny = lat - dlat
    maxy = lat + dlat
    return box(minx, miny, maxx, maxy)


def polygonize(
    cells: list[dict[str, Any]],
    resolution_km: float = 2.0,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Union cells by level into (multi)polygons; produce safe staging points.
    Returns: (geojson_feature_collection, safe_points).
    """
    from app.grid import RESOLUTION_KM

    res = resolution_km or RESOLUTION_KM
    by_level: dict[str, list[Polygon]] = {"high": [], "medium": [], "low": []}
    safe_cells: list[dict[str, Any]] = []

    for c in cells:
        level = c.get("level")
        lat, lng = c["lat"], c["lng"]
        poly = _cell_polygon(lat, lng, res)
        if level in by_level:
            by_level[level].append(poly)
        elif level == "safe":
            safe_cells.append({"lat": lat, "lng": lng})

    features = []
    for level in ("high", "medium", "low"):
        if not by_level[level]:
            continue
        union = unary_union(by_level[level])
        if union.is_empty:
            continue
        # Convert to GeoJSON-friendly geom
        if hasattr(union, "geoms"):
            # MultiPolygon
            polygons = []
            for g in union.geoms:
                if g.geom_type == "Polygon" and not g.is_empty:
                    ring = _ring_to_geojson(g.exterior)
                    polygons.append([ring])
            if not polygons:
                continue
            if len(polygons) == 1:
                geom = {"type": "Polygon", "coordinates": polygons[0]}
            else:
                geom = {"type": "MultiPolygon", "coordinates": polygons}
        else:
            if union.geom_type == "Polygon" and not union.is_empty:
                ring = _ring_to_geojson(union.exterior)
                geom = {"type": "Polygon", "coordinates": [ring]}
            else:
                continue
        features.append({
            "type": "Feature",
            "properties": {"level": level},
            "geometry": geom,
        })

    # Safe staging points: use up to 5 safe cells (spread); or centroids at edge of low zone
    safe_points: list[dict[str, Any]] = []
    for i, s in enumerate(safe_cells[:5]):
        safe_points.append({
            "lat": round(s["lat"], 5),
            "lng": round(s["lng"], 5),
            "reason": "Low-risk staging area",
        })
    if not safe_points and by_level["low"]:
        # Add centroid of low zone as fallback
        low_union = unary_union(by_level["low"])
        if not low_union.is_empty and hasattr(low_union, "centroid"):
            c = low_union.centroid
            safe_points.append({
                "lat": round(c.y, 5),
                "lng": round(c.x, 5),
                "reason": "Low-risk zone centroid",
            })

    fc = {"type": "FeatureCollection", "features": features}
    return fc, safe_points


def _ring_to_geojson(ring: Any) -> list:
    """Convert Shapely LinearRing to GeoJSON coordinates (close the ring)."""
    coords = list(ring.coords)
    if not coords:
        return []
    # Ensure closed
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    return [[float(x), float(y)] for x, y in coords]
