"""
Safe route generation: escape paths from high-risk zones to shelters.
For demo purposes, uses a simulated user location within the red zone.
"""
import math
from typing import Any
from app.utils import haversine_km


def get_demo_user_location(
    epicenter_lat: float,
    epicenter_lng: float,
    high_km: float,
) -> tuple[float, float]:
    """
    Generate a demo user location within the high-risk zone.
    Places user at ~70% of the high_km radius in a direction away from plate boundary.
    """
    demo_distance_km = high_km * 0.7
    demo_bearing_deg = 45.0  # Northeast direction (demo)
    
    lat_rad = epicenter_lat * math.pi / 180.0
    d = demo_distance_km / 111.0
    demo_lat = epicenter_lat + d * math.cos(demo_bearing_deg * math.pi / 180.0)
    demo_lng = epicenter_lng + d * math.sin(demo_bearing_deg * math.pi / 180.0) / max(0.01, math.cos(lat_rad))
    
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
    min_distance = float('inf')
    
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
    nearest_shelter = find_nearest_shelter(user_lat, user_lng, stations, max_stations_to_check=3)
    
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
                [nearest_shelter["lng"], nearest_shelter["lat"]]
            ],
            "reason": f"Alternative route with deflection away from epicenter ({nearest_shelter['distance_km']} km)",
        }
        routes.append(indirect_route)
    
    # Optional: Add secondary shelter if available
    if len(stations) > 1:
        second_nearest = find_nearest_shelter(user_lat, user_lng, stations[1:], max_stations_to_check=2)
        if second_nearest and second_nearest["lng"] != nearest_shelter["lng"]:
            alternate_route = {
                "name": f"Alternate shelter: {second_nearest.get('name', 'Shelter')}",
                "points": [[user_lng, user_lat], [second_nearest["lng"], second_nearest["lat"]]],
                "reason": f"Secondary shelter option ({second_nearest['distance_km']} km away)",
            }
            routes.append(alternate_route)
    
    return routes


def classify_shelter_quality(station_type: str) -> str:
    """Classify shelter quality based on type."""
    type_quality = {
        "medical": "Medical facility (excellent shelter)",
        "shelter": "Designated shelter (good)",
        "comms": "Emergency facility (basic shelter)",
        "supply": "Supply depot (adequate shelter)",
    }
    return type_quality.get(station_type, "Safe location")
