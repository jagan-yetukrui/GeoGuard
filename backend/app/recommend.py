"""
Help stations and routes. Only real locations (OSM/Places infra) are used—no synthetic or estimated positions.
If no real infra is found on land, returns empty list; never invents locations.
"""
import math
from typing import Any, Literal

from app.landmask import is_land

INFRA_TYPE_MAP = {
    "hospital": "medical",
    "clinic": "medical",
    "ambulance": "medical",
    "shelter": "shelter",
    "fire_station": "comms",
    "police": "comms",
    "other": "supply",
}


def _offset_km_to_lat_lng(lat: float, lng: float, km: float, bearing_deg: float) -> tuple[float, float]:
    lat_rad = lat * math.pi / 180.0
    d = km / 111.0
    new_lat = lat + d * math.cos(bearing_deg * math.pi / 180.0)
    new_lng = lng + d * math.sin(bearing_deg * math.pi / 180.0) / max(0.01, math.cos(lat_rad))
    return new_lat, new_lng


def generate_stations(
    center_lat: float,
    center_lng: float,
    high_km: float,
    med_km: float,
    max_stations: int = 6,
    zones_geojson: dict[str, Any] | None = None,
    infra_nodes: list[dict[str, Any]] | None = None,
) -> list[dict]:
    """
    Return only real help stations from infra (OSM/Google Places). On-land only.
    Never invents or estimates positions; if no real locations found, returns [].
    """
    stations: list[dict] = []
    infra = infra_nodes or []
    seen: set[tuple[float, float]] = set()
    for node in infra:
        if len(stations) >= max_stations:
            break
        if not is_land(node["lat"], node["lng"]):
            continue
        key = (round(node["lat"], 5), round(node["lng"], 5))
        if key in seen:
            continue
        seen.add(key)
        name = (node.get("name") or "Unnamed")[:80]
        stations.append({
            "name": name,
            "lat": round(node["lat"], 5),
            "lng": round(node["lng"], 5),
            "type": INFRA_TYPE_MAP.get(node.get("type", "other"), "supply"),
            "reason": f"Real location: {node.get('type', 'facility')}",
        })
    return stations


def generate_routes(
    center_lat: float,
    center_lng: float,
    high_km: float,
    stations: list[dict],
) -> list[dict]:
    """Return list of { name, points: [[lng, lat], ...], reason }."""
    routes: list[dict] = []
    for i, st in enumerate(stations[:2]):
        routes.append({
            "name": f"Epicenter to {st.get('name', 'Station')}",
            "points": [[center_lng, center_lat], [st["lng"], st["lat"]]],
            "reason": "Estimated straight-line route to help station.",
        })
    n_ring = 8
    ring_points: list[list[float]] = []
    for j in range(n_ring + 1):
        bearing = 360.0 * j / n_ring
        rlat, rlng = _offset_km_to_lat_lng(center_lat, center_lng, high_km, bearing)
        ring_points.append([rlng, rlat])
    routes.append({
        "name": "High zone perimeter patrol",
        "points": ring_points,
        "reason": "Estimated patrol along high-risk zone boundary.",
    })
    return routes
