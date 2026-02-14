"""
Help stations (3-6) and routes (2-4). Prefer polygon edges and infra; fallback to offset circles.
Routes: straight-line polylines with name and reason (estimated routes).
"""
import math
from typing import Any, Literal

STATION_NAMES = ("Station Alpha", "Station Bravo", "Station Charlie", "Station Delta", "Station Echo", "Station Foxtrot")
STATION_TYPES: tuple[Literal["medical", "shelter", "comms", "supply"], ...] = ("medical", "shelter", "comms", "supply")

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


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _sample_polygon_boundary(features: list[dict], level: str, n_points: int) -> list[tuple[float, float]]:
    """Sample (lat, lng) points on boundary of the first feature with given level."""
    points: list[tuple[float, float]] = []
    for f in features:
        if f.get("properties", {}).get("level") != level:
            continue
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates", [])
        if geom.get("type") == "Polygon" and coords:
            ring = coords[0]
            step = max(1, len(ring) // n_points)
            for i in range(0, len(ring), step):
                lng, lat = ring[i][0], ring[i][1]
                points.append((lat, lng))
                if len(points) >= n_points:
                    return points[:n_points]
        elif geom.get("type") == "MultiPolygon":
            for part in coords:
                if part and part[0]:
                    ring = part[0]
                    step = max(1, len(ring) // n_points)
                    for i in range(0, len(ring), step):
                        lng, lat = ring[i][0], ring[i][1]
                        points.append((lat, lng))
                        if len(points) >= n_points:
                            return points[:n_points]
    return points


def generate_stations(
    center_lat: float,
    center_lng: float,
    high_km: float,
    med_km: float,
    max_stations: int = 6,
    zones_geojson: dict[str, Any] | None = None,
    infra_nodes: list[dict[str, Any]] | None = None,
) -> list[dict]:
    stations = []
    infra = infra_nodes or []
    features = (zones_geojson or {}).get("features") or []

    if features and len(features) >= 2:
        boundary_high = _sample_polygon_boundary(features, "high", 3)
        boundary_med = _sample_polygon_boundary(features, "medium", 3)
        candidates: list[dict] = []
        for i, (lat, lng) in enumerate(boundary_high):
            candidates.append({
                "name": STATION_NAMES[min(i, len(STATION_NAMES) - 1)],
                "lat": lat, "lng": lng,
                "type": "medical",
                "reason": "Near high-risk zone edge",
            })
        for i, (lat, lng) in enumerate(boundary_med):
            candidates.append({
                "name": STATION_NAMES[min(len(candidates), len(STATION_NAMES) - 1)],
                "lat": lat, "lng": lng,
                "type": "shelter",
                "reason": "Near medium-risk zone edge",
            })
        for node in infra[: max(0, max_stations - len(candidates))]:
            candidates.append({
                "name": node.get("name", "Infra")[:80],
                "lat": node["lat"], "lng": node["lng"],
                "type": INFRA_TYPE_MAP.get(node.get("type", "other"), "supply"),
                "reason": f"OSM: {node.get('type', 'infra')}",
            })
        n = min(max_stations, len(STATION_NAMES), max(3, len(candidates)))
        for i in range(n):
            if i < len(candidates):
                c = candidates[i]
                stations.append({
                    "name": str(c["name"])[:80],
                    "lat": round(c["lat"], 5),
                    "lng": round(c["lng"], 5),
                    "type": c["type"],
                    "reason": c["reason"],
                })
            else:
                bearing = 360.0 * i / max(n, 1)
                radius = high_km * 0.7 if i % 2 == 0 else med_km * 0.5
                radius = max(radius, 2.0)
                lat, lng = _offset_km_to_lat_lng(center_lat, center_lng, radius, bearing)
                stype = STATION_TYPES[i % len(STATION_TYPES)]
                stations.append({
                    "name": STATION_NAMES[i],
                    "lat": round(lat, 5),
                    "lng": round(lng, 5),
                    "type": stype,
                    "reason": f"Positioned at {radius:.0f} km for zone coverage.",
                })
    else:
        n = min(max_stations, 6, len(STATION_NAMES))
        step_deg = 360.0 / max(n, 1)
        for i in range(n):
            bearing = i * step_deg
            radius = high_km * 0.7 if i % 2 == 0 else med_km * 0.5
            radius = max(radius, 2.0)
            slat, slng = _offset_km_to_lat_lng(center_lat, center_lng, radius, bearing)
            stype = STATION_TYPES[i % len(STATION_TYPES)]
            reason = f"Positioned at {radius:.0f} km for zone coverage and access redundancy."
            stations.append({
                "name": STATION_NAMES[i],
                "lat": round(slat, 5),
                "lng": round(slng, 5),
                "type": stype,
                "reason": reason,
            })

    if len(stations) < max_stations and infra:
        used = {(s["lat"], s["lng"]) for s in stations}
        for node in infra:
            if len(stations) >= max_stations:
                break
            key = (round(node["lat"], 5), round(node["lng"], 5))
            if key in used:
                continue
            used.add(key)
            stations.append({
                "name": node.get("name", "Infra")[:80],
                "lat": round(node["lat"], 5),
                "lng": round(node["lng"], 5),
                "type": INFRA_TYPE_MAP.get(node.get("type", "other"), "supply"),
                "reason": f"OSM infrastructure: {node.get('type', 'facility')}",
            })
    return stations[:max_stations]


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
