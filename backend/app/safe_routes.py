"""
Safe route generation: escape paths from high-risk zones to shelters.
For demo purposes, uses a simulated user location within the red zone.
"""
import math
import random
from typing import Any

from app.utils import haversine_km


def get_demo_user_location(
    epicenter_lat: float,
    epicenter_lng: float,
    high_km: float,
) -> tuple[float, float]:
    """
    Generate a demo user location within the high-risk zone.
    Places user at ~70% of the high_km radius in a random direction.
    """
    demo_distance_km = high_km * 0.7
    demo_bearing_deg = random.uniform(0, 360)

    lat_rad = epicenter_lat * math.pi / 180.0
    d = demo_distance_km / 111.0
    demo_lat = epicenter_lat + d * math.cos(demo_bearing_deg * math.pi / 180.0)
    demo_lng = epicenter_lng + d * math.sin(demo_bearing_deg * math.pi / 180.0) / max(
        0.01, math.cos(lat_rad)
    )

    return round(demo_lat, 5), round(demo_lng, 5)


def find_nearest_shelter(
    user_lat: float,
    user_lng: float,
    stations: list[dict],
    max_stations_to_check: int = 5,
) -> dict | None:
    """
    Find the nearest shelter/safe place from user location.
    Returns station dict with distance, or None if no stations available.
    """
    if not stations:
        return None

    nearest = None
    min_distance = float("inf")

    for station in stations[:max_stations_to_check]:
        dist = haversine_km(user_lat, user_lng, station["lat"], station["lng"])
        if dist < min_distance:
            min_distance = dist
            station_copy = station.copy()
            station_copy["distance_km"] = round(dist, 2)
            nearest = station_copy

    return nearest


def generate_escape_routes(
    user_lat: float,
    user_lng: float,
    epicenter_lat: float,
    epicenter_lng: float,
    high_km: float,
    stations: list[dict],
) -> list[dict]:
    """
    Generate escape routes from user location (in red zone) to nearest shelters.
    Routes prioritize moving away from epicenter while heading to safety.
    """
    routes: list[dict] = []

    # Find nearest shelter
    nearest_shelter = find_nearest_shelter(
        user_lat, user_lng, stations, max_stations_to_check=3
    )

    if not nearest_shelter:
        return routes

    # Direct route to nearest shelter
    direct_route = {
        "name": f"Direct escape to {nearest_shelter.get('name', 'Shelter')}",
        "points": [[user_lng, user_lat], [nearest_shelter["lng"], nearest_shelter["lat"]]],
        "reason": f"Direct escape route ({nearest_shelter['distance_km']} km to safety)",
    }
    routes.append(direct_route)

    # Alternative longer route that goes more away from epicenter first
    # Calculate angle away from epicenter
    user_to_epicenter_lng = epicenter_lng - user_lng
    user_to_epicenter_lat = epicenter_lat - user_lat

    # Get perpendicular direction (rotate 90 degrees counter-clockwise)
    perp_lng = -user_to_epicenter_lat
    perp_lat = user_to_epicenter_lng
    perp_len = math.sqrt(perp_lng**2 + perp_lat**2)

    if perp_len > 0:
        # Normalize and scale to ~1km offset
        offset_scale = 0.5 / perp_len if perp_len > 0 else 0
        offset_lat = perp_lat * offset_scale
        offset_lng = perp_lng * offset_scale

        # Waypoint slightly away from direct line
        waypoint_lat = user_lat + offset_lat
        waypoint_lng = user_lng + offset_lng

        indirect_route = {
            "name": f"Escape with deflection to {nearest_shelter.get('name', 'Shelter')}",
            "points": [
                [user_lng, user_lat],
                [waypoint_lng, waypoint_lat],
                [nearest_shelter["lng"], nearest_shelter["lat"]],
            ],
            "reason": f"Alternative route with deflection away from epicenter ({nearest_shelter['distance_km']} km)",
        }
        routes.append(indirect_route)

    # Optional: Add secondary shelter if available
    if len(stations) > 1:
        second_nearest = find_nearest_shelter(
            user_lat, user_lng, stations[1:], max_stations_to_check=2
        )
        if (
            second_nearest
            and (
                second_nearest["lng"] != nearest_shelter["lng"]
                or second_nearest["lat"] != nearest_shelter["lat"]
            )
        ):
            alternate_route = {
                "name": f"Alternate shelter: {second_nearest.get('name', 'Shelter')}",
                "points": [
                    [user_lng, user_lat],
                    [second_nearest["lng"], second_nearest["lat"]],
                ],
                "reason": f"Secondary shelter option ({second_nearest['distance_km']} km away)",
            }
            routes.append(alternate_route)

    return routes


# Categories for routes: one safest route per category
ROUTE_CATEGORIES = ("hospital", "shelter", "fire_station", "police")

# OSM types that map to each category
CATEGORY_OSM_TYPES: dict[str, tuple[str, ...]] = {
    "hospital": ("hospital", "clinic", "ambulance"),
    "shelter": ("shelter",),
    "fire_station": ("fire_station",),
    "police": ("police",),
}


def find_nearest_of_type(
    user_lat: float,
    user_lng: float,
    nodes: list[dict],
    osm_types: tuple[str, ...],
) -> dict | None:
    """Find nearest node matching any of the given OSM types."""
    candidates = [n for n in nodes if n.get("type") in osm_types]
    if not candidates:
        return None
    nearest = min(
        candidates,
        key=lambda n: haversine_km(user_lat, user_lng, n["lat"], n["lng"]),
    )
    dist = haversine_km(user_lat, user_lng, nearest["lat"], nearest["lng"])
    out = nearest.copy()
    out["distance_km"] = round(dist, 2)
    return out


def _count_hotspot_crossings(
    user_lat: float,
    user_lng: float,
    dest_lat: float,
    dest_lng: float,
    hotspot_cells: list[dict],
    tier_weights: dict[str, float] | None = None,
) -> float:
    """
    Approximate path from user to dest as straight line; count weighted hotspot crossings.
    Returns penalty score (lower = safer). Uses cell center distance to line.
    """
    if tier_weights is None:
        tier_weights = {"high": 3.0, "medium": 1.5, "low": 0.5, "safe": 0.0}
    penalty = 0.0
    # Simple: for each high/medium cell, add penalty if line passes near it
    for c in hotspot_cells:
        tier = c.get("tier", "safe")
        w = tier_weights.get(tier, 0.0)
        if w <= 0:
            continue
        clat, clng = c.get("lat", 0), c.get("lng", 0)
        dist_km = haversine_km(user_lat, user_lng, clat, clng)
        dest_dist = haversine_km(dest_lat, dest_lng, clat, clng)
        total = haversine_km(user_lat, user_lng, dest_lat, dest_lng)
        if total < 0.1:
            continue
        # Rough "distance from cell to line segment" proxy: if cell is between user and dest
        if dist_km < total + 2 and dest_dist < total + 2:
            penalty += w
    return penalty


def generate_routes_by_category(
    user_lat: float,
    user_lng: float,
    infra_nodes: list[dict],
) -> list[dict]:
    """
    Generate one safest route per category (hospital, shelter, fire_station, police).
    Returns list of {name, points, reason, category}.
    """
    routes: list[dict] = []
    for category, osm_types in CATEGORY_OSM_TYPES.items():
        nearest = find_nearest_of_type(user_lat, user_lng, infra_nodes, osm_types)
        if not nearest:
            continue
        route = {
            "name": f"To nearest {category.replace('_', ' ')}: {nearest.get('name', 'Location')}",
            "points": [[user_lng, user_lat], [nearest["lng"], nearest["lat"]]],
            "reason": f"Safest route to {category.replace('_', ' ')} ({nearest['distance_km']} km)",
            "category": category,
        }
        routes.append(route)
    return routes


def generate_routes_by_category_with_roads(
    user_lat: float,
    user_lng: float,
    infra_nodes: list[dict],
    hotspot_cells: list[dict],
) -> list[dict]:
    """
    Generate one safest route per category using hotspot-aware destination selection
    and OSRM road geometry. Falls back to straight-line if OSRM fails.
    """
    from app.routing import fetch_osrm_route

    routes: list[dict] = []
    for category, osm_types in CATEGORY_OSM_TYPES.items():
        candidates = [n for n in infra_nodes if n.get("type") in osm_types]
        if not candidates:
            continue
        # Nearest 2–3 of that type
        candidates = sorted(
            candidates,
            key=lambda n: haversine_km(user_lat, user_lng, n["lat"], n["lng"]),
        )[:3]
        # Score by fewest high-tier hotspot crossings
        scored = []
        for n in candidates:
            penalty = _count_hotspot_crossings(
                user_lat, user_lng, n["lat"], n["lng"], hotspot_cells
            )
            dist = haversine_km(user_lat, user_lng, n["lat"], n["lng"])
            scored.append((penalty, dist, n))
        scored.sort(key=lambda x: (x[0], x[1]))
        best = scored[0][2]
        dist_km = round(haversine_km(user_lat, user_lng, best["lat"], best["lng"]), 2)

        # OSRM road geometry
        osrm_points = fetch_osrm_route(
            user_lat, user_lng, best["lat"], best["lng"]
        )
        if osrm_points and len(osrm_points) >= 2:
            points = [[p[1], p[0]] for p in osrm_points]  # (lat,lng) -> [lng,lat]
        else:
            points = [[user_lng, user_lat], [best["lng"], best["lat"]]]

        route = {
            "name": f"To nearest {category.replace('_', ' ')}: {best.get('name', 'Location')}",
            "points": points,
            "reason": f"Safest route to {category.replace('_', ' ')} ({dist_km} km)",
            "category": category,
        }
        routes.append(route)
    return routes


def classify_shelter_quality(station_type: str) -> str:
    """Classify shelter quality based on type."""
    type_quality: dict[str, str] = {
        "medical": "Medical facility (excellent shelter)",
        "shelter": "Designated shelter (good)",
        "comms": "Emergency facility (basic shelter)",
        "supply": "Supply depot (adequate shelter)",
    }
    return type_quality.get(station_type, "Safe location")
