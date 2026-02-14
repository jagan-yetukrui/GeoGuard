"""
Risk grid: 80km x 80km around epicenter, 1km resolution.
Score each cell 0-1; classify by quantiles (high 12%, medium 25%, low 40%).
Return cells with level and factor breakdown for explanation.
"""
import math
from typing import Any, Literal

from app.utils import clamp

# Weights (explainable constants)
W_SHAKING = 0.35
W_DEPTH = 0.20
W_PLATE = 0.15
W_HISTORICAL = 0.15
W_DENSITY = 0.10
W_VULNERABILITY = 0.05

# Quantiles
Q_HIGH = 0.12   # top 12%
Q_MEDIUM = 0.25  # next 25%
Q_LOW = 0.40     # next 40%

BBOX_KM = 80.0
RESOLUTION_KM = 2.0  # 2km cells for performance (~40x40 = 1600 cells)


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


def _cell_centers(lat0: float, lng0: float) -> list[tuple[float, float]]:
    """Return (lat, lng) of each grid cell center. 80km x 80km, RESOLUTION_KM step."""
    half = BBOX_KM / 2.0
    km_per_deg_lat = 111.0
    km_per_deg_lng = 111.0 * max(0.01, math.cos(math.radians(lat0)))
    centers = []
    km_y = -half
    while km_y <= half:
        km_x = -half
        while km_x <= half:
            dlat = km_y / km_per_deg_lat
            dlng = km_x / km_per_deg_lng
            centers.append((lat0 + dlat, lng0 + dlng))
            km_x += RESOLUTION_KM
        km_y += RESOLUTION_KM
    return centers


def compute_risk_grid(
    epicenter_lat: float,
    epicenter_lng: float,
    magnitude: float,
    depth_km: float,
    plate_km: float | None,
    similar_quakes: list[dict[str, Any]],
    density_proxy: float = 0.5,
    infra_count: int = 0,
    density_per_cell: dict[tuple[float, float], float] | None = None,
) -> tuple[list[dict[str, Any]], int, str, dict[str, Any], list[dict[str, Any]]]:
    """
    Compute risk score for each cell; classify into high/medium/low.
    Returns: (cells, damage_score, confidence, explanation, factor_breakdown_list)
    """
    from app.plates import distance_km_to_plate

    centers = _cell_centers(epicenter_lat, epicenter_lng)
    plate_factor_center = (
        clamp((200.0 - plate_km) / 200.0, 0.0, 1.0) if plate_km is not None else 0.5
    )
    # Historical severity proxy: mean mag of similar quakes (normalized)
    hist_severity = 0.5
    if similar_quakes:
        mean_mag = sum(q["mag"] for q in similar_quakes) / len(similar_quakes)
        hist_severity = clamp((mean_mag - 3.5) / 4.0, 0.0, 1.0)

    shallow_factor = clamp((70.0 - depth_km) / 70.0, 0.0, 1.0)
    shaking_base = clamp(magnitude / 6.0, 0.0, 1.0)

    cells: list[dict[str, Any]] = []
    for lat, lng in centers:
        cell_key = (round(lat, 5), round(lng, 5))
        density = (
            density_per_cell.get(cell_key, 0.5)
            if density_per_cell is not None
            else density_proxy
        )
        dist_km = _haversine_km(epicenter_lat, epicenter_lng, lat, lng)
        # Shaking: decay with distance, scaled by depth (shallow = stronger at surface)
        shaking = (magnitude / (dist_km + 10.0)) / max(magnitude / 10.0, 0.5)
        shaking = clamp(shaking * (1.2 - 0.4 * (depth_km / 100.0)), 0.0, 1.0)

        cell_plate_km = distance_km_to_plate(lat, lng)
        plate_f = (
            clamp((200.0 - cell_plate_km) / 200.0, 0.0, 1.0) if cell_plate_km is not None else plate_factor_center
        )

        # Vulnerability: high if density high and infra sparse (simplified)
        vuln = density * (1.0 - 0.3 * min(infra_count / 10.0, 1.0))
        vuln = clamp(vuln, 0.0, 1.0)

        score = (
            W_SHAKING * shaking
            + W_DEPTH * shallow_factor
            + W_PLATE * plate_f
            + W_HISTORICAL * hist_severity
            + W_DENSITY * density
            + W_VULNERABILITY * vuln
        )
        score = clamp(score, 0.0, 1.0)
        cells.append({"lat": lat, "lng": lng, "score": score})

    if not cells:
        return [], 0, "low", {"notes": "No grid cells"}, []

    # Classify by quantiles
    sorted_cells = sorted(cells, key=lambda c: c["score"], reverse=True)
    n = len(sorted_cells)
    n_high = max(1, int(n * Q_HIGH))
    n_med = max(0, int(n * Q_MEDIUM))
    n_low = max(0, int(n * Q_LOW))
    for i, c in enumerate(sorted_cells):
        if i < n_high:
            c["level"] = "high"
        elif i < n_high + n_med:
            c["level"] = "medium"
        elif i < n_high + n_med + n_low:
            c["level"] = "low"
        else:
            c["level"] = "safe"

    # Overall damage score 0-100 (area-weighted or mean of high cells)
    high_scores = [c["score"] for c in sorted_cells if c["level"] == "high"]
    damage_score = round(100.0 * (sum(high_scores) / len(high_scores) if high_scores else 0.0))

    plate_plausible = plate_km is not None and plate_km <= 2000.0
    has_data = infra_count >= 3 or len(similar_quakes) >= 3
    if (
        plate_plausible
        and magnitude >= 5.5
        and has_data
        and (plate_km is None or plate_km <= 1000.0)
    ):
        confidence: Literal["low", "medium", "high"] = "high"
    elif magnitude >= 4.5 and (plate_plausible or infra_count > 0 or similar_quakes):
        confidence = "medium"
    else:
        confidence = "low"

    factor_breakdown = [
        {"name": "shaking", "contribution": round(W_SHAKING * 100)},
        {"name": "depth", "contribution": round(W_DEPTH * 100)},
        {"name": "plate_proximity", "contribution": round(W_PLATE * 100)},
        {"name": "historical_similarity", "contribution": round(W_HISTORICAL * 100)},
        {"name": "density", "contribution": round(W_DENSITY * 100)},
        {"name": "vulnerability", "contribution": round(W_VULNERABILITY * 100)},
    ]
    explanation = {
        "plate_distance_km": plate_km,
        "density_method": "placeholder",
        "infra_count": infra_count,
        "similar_quakes_used": len(similar_quakes),
        "notes": f"Grid {len(cells)} cells; quantiles high {Q_HIGH*100:.0f}% medium {Q_MEDIUM*100:.0f}% low {Q_LOW*100:.0f}%.",
    }
    return cells, damage_score, confidence, explanation, factor_breakdown
