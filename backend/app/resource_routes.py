"""
Resource allocation API: POST /api/resources/calculate
"""
import math
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.overpass import fetch_infra_in_bbox, fetch_building_points
from app.resource_engine import calculate as resource_calculate

router = APIRouter(tags=["resources"])


def _bbox_from_geometry(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    """Derive (south, west, north, east) from bbox or polygon geometry."""
    if "bbox" in geometry:
        b = geometry["bbox"]
        if len(b) >= 4:
            # [minLng, minLat, maxLng, maxLat] or [south, west, north, east]
            if b[0] < -180 or b[0] > 180:  # lat-first format
                south, west, north, east = b[0], b[1], b[2], b[3]
            else:
                west, south, east, north = b[0], b[1], b[2], b[3]
            return south, west, north, east
    if "coordinates" in geometry:
        coords = geometry["coordinates"]
        if geometry.get("type") == "Polygon" and coords:
            ring = coords[0] if isinstance(coords[0][0], (int, float)) else coords
            lats = [p[1] for p in ring]
            lngs = [p[0] for p in ring]
            return min(lats), min(lngs), max(lats), max(lngs)
        if geometry.get("type") == "Point" and len(coords) >= 2:
            lat, lng = coords[1], coords[0]
            half = 0.5  # ~55km
            return lat - half, lng - half, lat + half, lng + half
    raise ValueError("geometry must have bbox or coordinates")


def _area_km2(south: float, west: float, north: float, east: float) -> float:
    """Approximate area in km²."""
    center_lat = (south + north) / 2
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians(center_lat)))
    height = (north - south) * km_per_deg_lat
    width = (east - west) * km_per_deg_lng
    return max(0.1, height * width)


class ResourceCalculateBody(BaseModel):
    zoneType: str = Field(..., description="red | orange | green (or high/medium/low)")
    geometry: dict[str, Any] = Field(..., description="bbox or polygon GeoJSON")
    time_since_event_minutes: float = Field(0, ge=0)
    vulnerability: dict[str, float] | None = Field(None)


@router.post("/resources/calculate")
def resources_calculate(body: ResourceCalculateBody) -> dict[str, Any]:
    """
    Calculate resource allocation for a zone.
    Estimates population from Overpass/bbox; applies policy rules.
    """
    try:
        south, west, north, east = _bbox_from_geometry(body.geometry)
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    infra_nodes, ok = fetch_infra_in_bbox(south, west, north, east)
    center_lat = (south + north) / 2
    center_lng = (west + east) / 2

    area_km2 = _area_km2(south, west, north, east)
    lat_km = (north - south) * 111.0
    lng_km = (east - west) * 111.0 * max(0.01, math.cos(math.radians(center_lat)))
    half_km = max(20.0, min(lat_km, lng_km) / 2)
    building_pts, building_ok = fetch_building_points(center_lat, center_lng, half_km)

    # Count only buildings inside the zone bbox. Normalize point format: (lat, lng) or [lng, lat]
    def _to_lat_lng(p):
        if p is None or not hasattr(p, "__len__") or len(p) < 2:
            return None
        a, b = p[0], p[1]
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            return (float(a), float(b))
        # Handle nested GeoJSON [lng, lat] where a might be iterable
        if isinstance(a, (list, tuple)) and len(a) >= 2:
            return (float(a[1]), float(a[0]))
        return None

    in_zone = []
    if building_ok and building_pts:
        for p in building_pts:
            pt = _to_lat_lng(p)
            if pt and south <= pt[0] <= north and west <= pt[1] <= east:
                in_zone.append(pt)

    # Realistic population density from building count (rural ~20–50/km², urban ~500–3000/km²)
    buildings_per_km2 = len(in_zone) / max(0.1, area_km2) if in_zone else 0.0
    if buildings_per_km2 < 0.5:
        people_per_km2 = 25.0  # rural (e.g. Cole OK ~22/km²)
    elif buildings_per_km2 < 5:
        people_per_km2 = 50.0 + buildings_per_km2 * 30  # sparse suburban
    elif buildings_per_km2 < 30:
        people_per_km2 = 150.0 + buildings_per_km2 * 25  # suburban
    else:
        people_per_km2 = min(3500.0, 400.0 + buildings_per_km2 * 40)  # urban
    people_per_km2 = max(15.0, min(people_per_km2, 3500.0))
    population_estimated = area_km2 * people_per_km2

    infra_counts = {"hospitals": 0, "shelters": 0, "police": 0, "fire": 0}
    for n in infra_nodes:
        t = n.get("type", "")
        if t in ("hospital", "clinic", "ambulance"):
            infra_counts["hospitals"] += 1
        elif t == "shelter":
            infra_counts["shelters"] += 1
        elif t == "police":
            infra_counts["police"] += 1
        elif t == "fire_station":
            infra_counts["fire"] += 1

    hospital_beds_estimated = infra_counts["hospitals"] * 125
    shelter_capacity_estimated = infra_counts["shelters"] * 100
    routes_available = max(1, len(infra_nodes) + 5)

    population_confidence = "high" if len(infra_nodes) >= 10 else "medium" if len(infra_nodes) >= 3 else "low"
    damage_score = 0.5
    hotspot_score = 0.5

    result = resource_calculate(
        zone_type=body.zoneType,
        population_estimated=population_estimated,
        population_confidence=population_confidence,
        infra_counts=infra_counts,
        hospital_beds_estimated=hospital_beds_estimated,
        shelter_capacity_estimated=shelter_capacity_estimated,
        routes_available=routes_available,
        damage_score=damage_score,
        hotspot_score=hotspot_score,
        time_since_event_minutes=body.time_since_event_minutes,
        vulnerability=body.vulnerability,
    )
    result["area_km2"] = round(area_km2, 2)
    result["population_density_people_per_km2"] = round(people_per_km2, 0)
    return result
