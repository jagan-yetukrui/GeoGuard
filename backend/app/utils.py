import math
from typing import Any

# When hospital and clinic/ambulance are within this distance (km), treat as same facility
MEDICAL_COLOCATION_KM = 0.15  # ~150m
# When same name at same location, treat as duplicate
NAME_LOCATION_DEDUPE_KM = 0.3  # ~300m


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in km between two points (WGS84)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _medical_priority(t: str) -> int:
    """Higher = prefer when deduping. hospital > clinic > ambulance."""
    if t == "hospital":
        return 3
    if t == "clinic":
        return 2
    if t == "ambulance":
        return 1
    return 0


def dedupe_medical_same_location(
    nodes: list[dict[str, Any]],
    lat_key: str = "lat",
    lng_key: str = "lng",
    type_key: str = "type",
    radius_km: float = MEDICAL_COLOCATION_KM,
) -> list[dict[str, Any]]:
    """
    When hospital and clinic/ambulance are at the same location (within radius_km),
    keep only the hospital. Other node types are unchanged.
    """
    medical_types = {"hospital", "clinic", "ambulance"}
    medical = [n for n in nodes if n.get(type_key) in medical_types]
    other = [n for n in nodes if n.get(type_key) not in medical_types]
    if not medical:
        return nodes
    kept: list[dict[str, Any]] = []
    for n in medical:
        nlat, nlng = n.get(lat_key, 0), n.get(lng_key, 0)
        merged = False
        for k in kept:
            if haversine_km(nlat, nlng, k[lat_key], k[lng_key]) <= radius_km:
                # Same location: prefer hospital over clinic over ambulance
                if _medical_priority(n.get(type_key, "")) > _medical_priority(k.get(type_key, "")):
                    kept.remove(k)
                    kept.append(n)
                merged = True
                break
        if not merged:
            kept.append(n)
    return other + kept


# Category groups for nearest-fallback: (our_type, osm_types)
INFRA_CATEGORIES: list[tuple[str, tuple[str, ...]]] = [
    ("hospital", ("hospital", "clinic", "ambulance")),
    ("fire_station", ("fire_station",)),
    ("police", ("police",)),
    ("shelter", ("shelter",)),
]


def add_nearest_fallback_infra(
    infra_in_zone: list[dict[str, Any]],
    infra_all: list[dict[str, Any]],
    center_lat: float,
    center_lng: float,
    zone_radius_km: float,
    per_category: int = 2,
) -> list[dict[str, Any]]:
    """
    When a category (hospital, fire_station, police, shelter) has fewer than per_category
    nodes in infra_in_zone, add the nearest per_category from infra_all that are outside
    the zone. Returns merged list (in_zone first, then fallbacks).
    """
    result = list(infra_in_zone)
    in_zone_coords = {(round(n["lat"], 5), round(n["lng"], 5)) for n in infra_in_zone}

    for our_type, osm_types in INFRA_CATEGORIES:
        count_in_zone = sum(1 for n in infra_in_zone if n.get("type") in osm_types)
        if count_in_zone >= per_category:
            continue
        # Get nodes outside zone of this type, sorted by distance
        outside = [
            n for n in infra_all
            if n.get("type") in osm_types
            and haversine_km(center_lat, center_lng, n["lat"], n["lng"]) > zone_radius_km
        ]
        outside.sort(key=lambda n: haversine_km(center_lat, center_lng, n["lat"], n["lng"]))
        needed = per_category - count_in_zone
        for n in outside[:needed]:
            key = (round(n["lat"], 5), round(n["lng"], 5))
            if key in in_zone_coords:
                continue
            in_zone_coords.add(key)
            result.append(n)
    return result


def dedupe_by_name_and_location(
    nodes: list[dict[str, Any]],
    lat_key: str = "lat",
    lng_key: str = "lng",
    name_key: str = "name",
    radius_km: float = NAME_LOCATION_DEDUPE_KM,
) -> list[dict[str, Any]]:
    """
    Remove duplicates where same name appears at same/nearby location.
    Keeps first occurrence. Use after dedupe_medical_same_location.
    """
    if not nodes:
        return nodes
    kept: list[dict[str, Any]] = []
    for n in nodes:
        nname = (n.get(name_key) or "").strip().lower()
        nlat, nlng = n.get(lat_key, 0), n.get(lng_key, 0)
        found = False
        for k in kept:
            kname = (k.get(name_key) or "").strip().lower()
            if nname and kname and nname == kname:
                if haversine_km(nlat, nlng, k[lat_key], k[lng_key]) <= radius_km:
                    found = True
                    break
        if not found:
            kept.append(n)
    return kept
