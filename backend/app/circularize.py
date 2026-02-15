"""
Perfect circular risk zones: concentric donut rings from epicenter.
Produces smooth GeoJSON (high=center circle, medium=ring, low=outer ring).
"""
import math
from typing import Any

from shapely.geometry import Point


def _km_to_degrees(lat: float, radius_km: float) -> float:
    """
    Approximate radius in degrees for a circle of radius_km at latitude lat.
    Uses geometric mean of lat/lng degree-per-km for near-circular shape in km.
    """
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians(lat)))
    # Geometric mean for roughly equal extent in both directions
    deg_per_km = math.sqrt(1.0 / (km_per_deg_lat * km_per_deg_lng))
    return radius_km * deg_per_km


def _ring_to_coords(ring) -> list:
    """Convert Shapely LinearRing to GeoJSON ring coordinates."""
    coords = list(ring.coords)
    if not coords or coords[0] != coords[-1]:
        coords.append(coords[0])
    return [[float(x), float(y)] for x, y in coords]


def _polygon_to_geojson(poly) -> dict[str, Any] | None:
    """Convert Shapely Polygon to GeoJSON geometry dict (handles holes)."""
    if poly.is_empty:
        return None
    exterior = _ring_to_coords(poly.exterior)
    coords = [exterior]
    for interior in poly.interiors:
        coords.append(_ring_to_coords(interior))
    return {"type": "Polygon", "coordinates": coords}


def circular_zones_geojson(
    lat: float,
    lng: float,
    high_km: float,
    med_km: float,
    low_km: float,
) -> dict[str, Any]:
    """
    Create concentric circular zones as GeoJSON FeatureCollection.
    - High: circle from 0 to high_km
    - Medium: donut from high_km to med_km
    - Low: donut from med_km to low_km

    Returns same schema as polygonize: {"type": "FeatureCollection", "features": [...]}
    for compatibility with zone_pois and MapView.
    """
    center = Point(lng, lat)

    features = []
    # Draw low → medium → high so center (high) renders on top
    for level, inner_km, outer_km in [
        ("low", med_km, low_km),
        ("medium", high_km, med_km),
        ("high", 0.0, high_km),
    ]:
        if outer_km <= inner_km or outer_km <= 0:
            continue

        outer_deg = _km_to_degrees(lat, outer_km)
        outer_circle = center.buffer(outer_deg, resolution=64)

        if inner_km <= 0:
            # High zone: full circle
            geom = outer_circle
        else:
            inner_deg = _km_to_degrees(lat, inner_km)
            inner_circle = center.buffer(inner_deg, resolution=64)
            geom = outer_circle.difference(inner_circle)

        if geom.is_empty:
            continue

        # Convert to GeoJSON
        if hasattr(geom, "geoms"):
            polygons = []
            for g in geom.geoms:
                if g.geom_type == "Polygon" and not g.is_empty:
                    gj = _polygon_to_geojson(g)
                    if gj:
                        polygons.append(gj["coordinates"])
            if not polygons:
                continue
            if len(polygons) == 1:
                geometry = {"type": "Polygon", "coordinates": polygons[0]}
            else:
                geometry = {"type": "MultiPolygon", "coordinates": polygons}
        else:
            geometry = _polygon_to_geojson(geom)
            if not geometry:
                continue

        features.append({
            "type": "Feature",
            "properties": {"level": level},
            "geometry": geometry,
        })

    return {"type": "FeatureCollection", "features": features}
