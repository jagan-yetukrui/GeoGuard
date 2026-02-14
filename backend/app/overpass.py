"""
Overpass API: fetch infrastructure nodes (hospitals, shelters, etc.) in bbox.
Cache 30 min. Density proxy: fallback placeholder or optional building count.
"""
import time
import math
from typing import Any

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CACHE_TTL_SECONDS = 30 * 60  # 30 minutes
_cache: dict[str, Any] = {}
_cache_time: float = 0.0


def _bbox_around(lat: float, lng: float, half_km: float = 40.0) -> tuple[float, float, float, float]:
    """Return (south, west, north, east) in degrees."""
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians(lat)))
    dlat = half_km / km_per_deg_lat
    dlng = half_km / km_per_deg_lng
    south = lat - dlat
    north = lat + dlat
    west = lng - dlng
    east = lng + dlng
    return south, west, north, east


def _build_infra_query(south: float, west: float, north: float, east: float) -> str:
    return f"""
[out:json][timeout:25];
(
  node({south},{west},{north},{east})["amenity"="hospital"];
  node({south},{west},{north},{east})["amenity"="clinic"];
  node({south},{west},{north},{east})["emergency"="ambulance_station"];
  node({south},{west},{north},{east})["amenity"="fire_station"];
  node({south},{west},{north},{east})["amenity"="police"];
  node({south},{west},{north},{east})["amenity"="shelter"];
  way({south},{west},{north},{east})["amenity"="hospital"];
  way({south},{west},{north},{east})["amenity"="clinic"];
  way({south},{west},{north},{east})["amenity"="fire_station"];
  way({south},{west},{north},{east})["amenity"="police"];
);
out center;
"""


def _parse_element(el: dict, osm_type: str) -> dict[str, Any] | None:
    lat, lng = None, None
    if osm_type == "node":
        lat = el.get("lat")
        lng = el.get("lon")
    else:
        center = el.get("center", {})
        lat = center.get("lat")
        lng = center.get("lng")
    if lat is None or lng is None:
        return None
    tags = el.get("tags") or {}
    name = tags.get("name") or tags.get("brand") or "Unnamed"
    amenity = tags.get("amenity", "")
    emergency = tags.get("emergency", "")
    if amenity == "hospital":
        type_ = "hospital"
    elif amenity == "clinic":
        type_ = "clinic"
    elif emergency == "ambulance_station":
        type_ = "ambulance"
    elif amenity == "fire_station":
        type_ = "fire_station"
    elif amenity == "police":
        type_ = "police"
    elif amenity == "shelter":
        type_ = "shelter"
    else:
        type_ = amenity or "other"
    return {"name": str(name)[:100], "type": type_, "lat": float(lat), "lng": float(lng)}


def fetch_infra_nodes(lat: float, lng: float) -> tuple[list[dict[str, Any]], bool]:
    """
    Fetch infrastructure nodes in ~80km box around (lat, lng).
    Returns (list of {name, type, lat, lng}, success).
    On failure returns ([], False); explanation should note infra unavailable.
    """
    global _cache, _cache_time
    south, west, north, east = _bbox_around(lat, lng, 40.0)
    key = f"{south:.4f},{west:.4f},{north:.4f},{east:.4f}"
    now = time.monotonic()
    if key in _cache and (now - _cache_time) < CACHE_TTL_SECONDS:
        return _cache[key], True
    try:
        query = _build_infra_query(south, west, north, east)
        with httpx.Client(timeout=30.0) as client:
            r = client.post(OVERPASS_URL, content=query)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError, KeyError):
        return [], False
    nodes: list[dict[str, Any]] = []
    seen = set()
    for el in data.get("elements", []):
        osm_type = el.get("type", "node")
        parsed = _parse_element(el, osm_type)
        if not parsed:
            continue
        key_pt = (round(parsed["lat"], 5), round(parsed["lng"], 5))
        if key_pt in seen:
            continue
        seen.add(key_pt)
        nodes.append(parsed)
    nodes.sort(key=lambda n: (n["lat"], n["lng"]))
    _cache[key] = nodes
    _cache_time = now
    return nodes, True


def get_density_proxy(lat: float, lng: float, infra_nodes: list[dict[str, Any]]) -> float:
    """
    Simple density proxy: 0.5 placeholder. Option B/C: coarse grid count or place fallback.
    """
    if not infra_nodes:
        return 0.5
    n = len(infra_nodes)
    return min(0.5 + n * 0.02, 1.0)


def _build_building_query(south: float, west: float, north: float, east: float) -> str:
    return f"""
[out:json][timeout:20];
(
  node({south},{west},{north},{east})["building"];
  way({south},{west},{north},{east})["building"];
  way({south},{west},{north},{east})["landuse"="residential"];
);
out center;
"""


def _build_highway_query(south: float, west: float, north: float, east: float) -> str:
    return f"""
[out:json][timeout:20];
way({south},{west},{north},{east})["highway"];
out center;
"""


def fetch_building_points(lat: float, lng: float, half_km: float = 40.0) -> tuple[list[tuple[float, float]], bool]:
    """
    Fetch building and landuse=residential points in bbox. Returns (list of (lat, lng), success).
    Cached 30 min by bbox key.
    """
    global _cache, _cache_time
    south, west, north, east = _bbox_around(lat, lng, half_km)
    key = f"buildings:{south:.4f},{west:.4f},{north:.4f},{east:.4f}"
    now = time.monotonic()
    if key in _cache and (now - _cache_time) < CACHE_TTL_SECONDS:
        return _cache[key], True
    try:
        query = _build_building_query(south, west, north, east)
        with httpx.Client(timeout=25.0) as client:
            r = client.post(OVERPASS_URL, content=query)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError, KeyError):
        _cache[key] = ([], False)
        _cache_time = now
        return [], False
    points: list[tuple[float, float]] = []
    for el in data.get("elements", []):
        osm_type = el.get("type", "node")
        if osm_type == "node":
            lat_v = el.get("lat")
            lng_v = el.get("lon")
        else:
            center = el.get("center", {})
            lat_v = center.get("lat")
            lng_v = center.get("lng")
        if lat_v is not None and lng_v is not None:
            points.append((float(lat_v), float(lng_v)))
    _cache[key] = (points, True)
    _cache_time = now
    return points, True


def fetch_highway_points(lat: float, lng: float, half_km: float = 40.0) -> tuple[list[tuple[float, float]], bool]:
    """
    Fetch highway way centroids in bbox. Returns (list of (lat, lng), success).
    Cached 30 min by bbox key.
    """
    global _cache, _cache_time
    south, west, north, east = _bbox_around(lat, lng, half_km)
    key = f"highways:{south:.4f},{west:.4f},{north:.4f},{east:.4f}"
    now = time.monotonic()
    if key in _cache and (now - _cache_time) < CACHE_TTL_SECONDS:
        return _cache[key], True
    try:
        query = _build_highway_query(south, west, north, east)
        with httpx.Client(timeout=25.0) as client:
            r = client.post(OVERPASS_URL, content=query)
            r.raise_for_status()
            data = r.json()
    except (httpx.HTTPError, ValueError, KeyError):
        _cache[key] = ([], False)
        _cache_time = now
        return [], False
    points: list[tuple[float, float]] = []
    for el in data.get("elements", []):
        if el.get("type") != "way":
            continue
        center = el.get("center", {})
        lat_v = center.get("lat")
        lng_v = center.get("lon")
        if lat_v is not None and lng_v is not None:
            points.append((float(lat_v), float(lng_v)))
    _cache[key] = (points, True)
    _cache_time = now
    return points, True


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


def _assign_points_to_cells(
    points: list[tuple[float, float]],
    centers: list[tuple[float, float]],
    resolution_km: float,
    weight: float = 1.0,
) -> dict[tuple[float, float], float]:
    """Assign points to nearest cell within resolution*1.5; return weighted count per cell."""
    counts: dict[tuple[float, float], float] = {}
    for clat, clng in centers:
        key = (round(clat, 5), round(clng, 5))
        counts[key] = 0.0
    for plat, plng in points:
        min_d = float("inf")
        best_key = None
        for clat, clng in centers:
            d = _haversine_km(plat, plng, clat, clng)
            if d < min_d:
                min_d = d
                best_key = (round(clat, 5), round(clng, 5))
        if best_key is not None and min_d <= resolution_km * 1.5:
            counts[best_key] = counts.get(best_key, 0.0) + weight
    return counts


def get_density_per_cell(
    centers: list[tuple[float, float]],
    lat0: float,
    lng0: float,
    resolution_km: float = 2.0,
) -> tuple[dict[tuple[float, float], float], str]:
    """
    Building count + highway count per grid cell; return density 0-1 per cell and method label.
    Buildings weighted 1.0, highways 0.5. Cells with no data get 0.2. Method: overpass_building_count,
    overpass_building_and_highway_count, or overpass_highway_count.
    """
    default_empty = 0.2
    building_pts, building_ok = fetch_building_points(lat0, lng0, 40.0)
    highway_pts, highway_ok = fetch_highway_points(lat0, lng0, 40.0)
    combined: dict[tuple[float, float], float] = {}
    for clat, clng in centers:
        key = (round(clat, 5), round(clng, 5))
        combined[key] = 0.0
    if building_ok and building_pts:
        b_counts = _assign_points_to_cells(building_pts, centers, resolution_km, weight=1.0)
        for k, v in b_counts.items():
            combined[k] = combined.get(k, 0.0) + v
    if highway_ok and highway_pts:
        h_counts = _assign_points_to_cells(highway_pts, centers, resolution_km, weight=0.5)
        for k, v in h_counts.items():
            combined[k] = combined.get(k, 0.0) + v
    has_building = building_ok and bool(building_pts)
    has_highway = highway_ok and bool(highway_pts)
    if has_building and has_highway:
        method = "overpass_building_and_highway_count"
    elif has_building:
        method = "overpass_building_count"
    elif has_highway:
        method = "overpass_highway_count"
    else:
        return ({}, "")
    max_count = max(combined.values()) or 1.0
    out: dict[tuple[float, float], float] = {}
    for k, v in combined.items():
        if v <= 0:
            out[k] = default_empty
        else:
            out[k] = min(1.0, v / max_count)
    return (out, method)
