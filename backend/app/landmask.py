"""
Land/water check: exclude map points that fall in ocean.
Uses global-land-mask (GLOBE 1 km grid). On failure returns False so we never show water and never crash.
"""
from typing import Any


def is_land(lat: float, lng: float) -> bool:
    """
    Return True if (lat, lng) is on land, False if in water or on check failure.
    Safe to call from any thread; never raises.
    """
    try:
        from global_land_mask import globe
        return bool(globe.is_land(lat, lng))
    except Exception:
        return False


def filter_land_points(
    points: list[dict[str, Any]],
    lat_key: str = "lat",
    lng_key: str = "lng",
) -> list[dict[str, Any]]:
    """Return only items where is_land(p[lat_key], p[lng_key]) is True."""
    return [p for p in points if is_land(p.get(lat_key, 0), p.get(lng_key, 0))]
