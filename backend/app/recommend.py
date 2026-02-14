import math
from typing import Literal

STATION_NAMES = ("Station Alpha", "Station Bravo", "Station Charlie", "Station Delta", "Station Echo", "Station Foxtrot")
STATION_TYPES: tuple[Literal["medical", "shelter", "comms", "supply"], ...] = ("medical", "shelter", "comms", "supply")


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
) -> list[dict]:
    stations = []
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
    return stations


def generate_routes(
    center_lat: float,
    center_lng: float,
    high_km: float,
    stations: list[dict],
) -> list[list[list[float]]]:
    routes: list[list[list[float]]] = []
    for i, st in enumerate(stations[:2]):
        routes.append([
            [center_lng, center_lat],
            [st["lng"], st["lat"]],
        ])
    n_ring = 8
    ring_points: list[list[float]] = []
    for j in range(n_ring + 1):
        bearing = 360.0 * j / n_ring
        rlat, rlng = _offset_km_to_lat_lng(center_lat, center_lng, high_km, bearing)
        ring_points.append([rlng, rlat])
    routes.append(ring_points)
    return routes
