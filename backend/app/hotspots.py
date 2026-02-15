"""
Collapse hotspot overlay: deterministic grid inside red/orange zone bbox.
Score cells by distance to epicenter, building count, road count.
Return hotspot_cells with tier (high/medium/low) by quantiles.
"""
import math
from typing import Any

from app.grid import RESOLUTION_KM, _cell_centers
from app.overpass import (
    fetch_building_points,
    fetch_highway_points,
    get_density_proxy,
    _assign_points_to_cells,
)
from app.utils import clamp


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def compute_hotspot_grid(
    epicenter_lat: float,
    epicenter_lng: float,
    high_km: float,
    medium_km: float,
    infra_nodes: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str]:
    """Compute collapse hotspot grid inside red/orange zone. Returns (cells, summary)."""
    centers = _cell_centers(epicenter_lat, epicenter_lng)
    zone_centers = [
        (clat, clng)
        for clat, clng in centers
        if _haversine_km(epicenter_lat, epicenter_lng, clat, clng) <= medium_km
    ]
    if not zone_centers:
        return [], "No hotspot data in zone."

    building_pts, building_ok = fetch_building_points(
        epicenter_lat, epicenter_lng, max(40.0, medium_km)
    )
    highway_pts, highway_ok = fetch_highway_points(
        epicenter_lat, epicenter_lng, max(40.0, medium_km)
    )
    density_proxy = get_density_proxy(epicenter_lat, epicenter_lng, infra_nodes)

    building_counts: dict[tuple[float, float], float] = {}
    road_counts: dict[tuple[float, float], float] = {}
    for clat, clng in zone_centers:
        key = (round(clat, 5), round(clng, 5))
        building_counts[key] = 0.0
        road_counts[key] = 0.0
    if building_ok and building_pts:
        building_counts = _assign_points_to_cells(
            building_pts, zone_centers, RESOLUTION_KM, weight=1.0
        )
    if highway_ok and highway_pts:
        road_counts = _assign_points_to_cells(
            highway_pts, zone_centers, RESOLUTION_KM, weight=0.5
        )

    max_b = max(building_counts.values()) or 1.0
    max_r = max(road_counts.values()) or 1.0

    cells: list[dict[str, Any]] = []
    for clat, clng in zone_centers:
        dist_km = _haversine_km(epicenter_lat, epicenter_lng, clat, clng)
        key = (round(clat, 5), round(clng, 5))
        dist_score = 1.0 - clamp(dist_km / (medium_km + 1.0), 0.0, 1.0)
        b_count = building_counts.get(key, 0.0) / max_b if max_b else density_proxy
        r_count = road_counts.get(key, 0.0) / max_r if max_r else 0.2
        score = 0.4 * dist_score + 0.35 * clamp(b_count, 0.0, 1.0) + 0.25 * clamp(r_count, 0.0, 1.0)
        score = clamp(score, 0.0, 1.0)
        cells.append({"lat": clat, "lng": clng, "score": score})

    if not cells:
        return [], "No hotspot data in zone."

    sorted_cells = sorted(cells, key=lambda c: c["score"], reverse=True)
    n = len(sorted_cells)
    n_high = max(1, int(n * 0.15))
    n_med = max(0, int(n * 0.25))
    n_low = max(0, int(n * 0.40))
    for i, c in enumerate(sorted_cells):
        if i < n_high:
            c["tier"] = "high"
        elif i < n_high + n_med:
            c["tier"] = "medium"
        elif i < n_high + n_med + n_low:
            c["tier"] = "low"
        else:
            c["tier"] = "safe"

    high_count = sum(1 for c in cells if c.get("tier") == "high")
    med_count = sum(1 for c in cells if c.get("tier") == "medium")
    low_count = sum(1 for c in cells if c.get("tier") == "low")
    summary = (
        f"{high_count} high-tier, {med_count} medium-tier, {low_count} low-tier "
        "collapse hotspots in red/orange zones. Avoid dense building areas near epicenter."
    )
    return cells, summary


def hotspot_cells_to_polygons(
    cells: list[dict[str, Any]], resolution_km: float = RESOLUTION_KM
) -> list[dict[str, Any]]:
    """Convert hotspot cells to GeoJSON-style polygons."""
    km_per_deg_lat = 111.0
    half = resolution_km / 2.0
    polygons: list[dict[str, Any]] = []
    for c in cells:
        lat, lng = c["lat"], c["lng"]
        km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians(lat)))
        dlat = half / km_per_deg_lat
        dlng = half / km_per_deg_lng
        coords = [
            [lng - dlng, lat - dlat],
            [lng + dlng, lat - dlat],
            [lng + dlng, lat + dlat],
            [lng - dlng, lat + dlat],
            [lng - dlng, lat - dlat],
        ]
        polygons.append({
            "type": "Polygon",
            "coordinates": [coords],
            "tier": c.get("tier", "safe"),
            "score": c.get("score", 0.0),
        })
    return polygons
